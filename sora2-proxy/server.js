import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.PORT || 4581);
const SESSION_FILE = path.resolve(process.cwd(), '.sora2-session.json');
const SORA2_BASE = 'https://sora2.com';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

let cookieHeader = '';
let authError = '';
let browser = null;
let page = null;
let isAuthPending = false;

const resolveBrowserExecutablePath = () => {
  const envPath = String(
    process.env.SORA2_BROWSER_PATH ||
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROME_PATH ||
      ''
  ).trim();
  if (envPath) return envPath;

  const candidates = [];
  const platform = process.platform;
  if (platform === 'win32') {
    candidates.push(
      'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      'C:\\\\Program Files\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
      'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe'
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }

  return '';
};

const buildCookieHeader = (cookies) =>
  cookies
    .filter((c) => c && c.name && typeof c.value !== 'undefined')
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

const normalizeCookieHeader = (raw) => {
  if (!raw) return '';
  const cleaned = String(raw)
    .trim()
    .replace(/^\s*cookie\s*:\s*/i, '')
    .replace(/\r/g, '')
    .replace(/\n+/g, '; ');

  const ignored = new Set(['path', 'domain', 'expires', 'max-age', 'secure', 'httponly', 'samesite']);
  const parts = cleaned
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf('=');
      if (idx <= 0) return null;
      const name = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (!name || !value) return null;
      if (ignored.has(name.toLowerCase())) return null;
      return `${name}=${value}`;
    })
    .filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const p of parts) {
    const name = p.split('=')[0];
    if (seen.has(name)) continue;
    seen.add(name);
    unique.push(p);
  }

  return unique.join('; ');
};

const loadSession = () => {
  try {
    if (!fs.existsSync(SESSION_FILE)) return;
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.cookieHeader === 'string') {
      cookieHeader = parsed.cookieHeader;
    }
  } catch {
    // ignore
  }
};

const saveSession = () => {
  try {
    fs.writeFileSync(
      SESSION_FILE,
      JSON.stringify({ cookieHeader, updatedAt: Date.now() }, null, 2),
      'utf-8'
    );
  } catch {
    // ignore
  }
};

const clearSession = () => {
  cookieHeader = '';
  authError = '';
  try {
    if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
  } catch {
    // ignore
  }
};

async function checkLoggedIn() {
  if (!cookieHeader) return false;
  try {
    const res = await fetch(`${SORA2_BASE}/dashboard`, {
      redirect: 'manual',
      headers: {
        cookie: cookieHeader,
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (res.status === 200) return true;
    if (res.status >= 300 && res.status < 400) return false;
    return false;
  } catch (err) {
    authError = String(err?.message || err || 'status check failed');
    return false;
  }
}

loadSession();

app.get('/health', (req, res) => {
  res.json({ ok: true, port: PORT });
});

app.get('/auth/status', async (req, res) => {
  const loggedIn = await checkLoggedIn();
  res.json({
    ok: true,
    state: loggedIn ? 'logged_in' : 'logged_out',
    pending: isAuthPending,
    error: authError || '',
  });
});

app.post('/auth/start', async (req, res) => {
  authError = '';
  if (isAuthPending) {
    res.json({ ok: true, state: 'pending' });
    return;
  }

  try {
    isAuthPending = true;
    const executablePath = resolveBrowserExecutablePath();
    if (!executablePath) {
      throw new Error(
        'No local Chrome/Edge found. Install Chrome/Edge or set SORA2_BROWSER_PATH to your browser executable.'
      );
    }
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      executablePath,
    });
    page = await browser.newPage();
    await page.goto(`${SORA2_BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
    res.json({ ok: true, state: 'pending' });
  } catch (err) {
    isAuthPending = false;
    authError = String(err?.message || err || 'failed to start auth');
    try {
      await browser?.close();
    } catch {
      // ignore
    }
    browser = null;
    page = null;
    res.status(500).json({ ok: false, error: authError });
  }
});

app.post('/auth/finish', async (req, res) => {
  authError = '';
  if (!browser || !page) {
    isAuthPending = false;
    res.status(400).json({ ok: false, error: 'No active login session. Call /auth/start first.' });
    return;
  }

  try {
    const cookies = await page.cookies(SORA2_BASE);
    const header = buildCookieHeader(cookies);
    if (!header) {
      throw new Error('No cookies found. Please complete login in the opened browser window.');
    }

    cookieHeader = header;
    saveSession();

    const loggedIn = await checkLoggedIn();
    if (!loggedIn) {
      authError = 'Login not detected. Please ensure you are fully signed in (dashboard accessible).';
      res.status(401).json({ ok: false, error: authError });
      return;
    }

    res.json({ ok: true, state: 'logged_in' });
  } catch (err) {
    authError = String(err?.message || err || 'failed to finish auth');
    res.status(500).json({ ok: false, error: authError });
  } finally {
    isAuthPending = false;
    try {
      await browser?.close();
    } catch {
      // ignore
    }
    browser = null;
    page = null;
  }
});

app.post('/auth/logout', async (req, res) => {
  clearSession();
  isAuthPending = false;
  try {
    await browser?.close();
  } catch {
    // ignore
  }
  browser = null;
  page = null;
  res.json({ ok: true });
});

app.post('/auth/import-cookie', async (req, res) => {
  authError = '';
  try {
    const rawCookie = req.body?.cookieHeader ?? req.body?.cookie ?? '';
    const normalized = normalizeCookieHeader(rawCookie);
    if (!normalized) {
      res.status(400).json({ ok: false, error: 'Empty cookie header.' });
      return;
    }

    cookieHeader = normalized;
    saveSession();

    const loggedIn = await checkLoggedIn();
    if (!loggedIn) {
      authError = 'Login not detected. The cookie may be invalid or expired.';
      res.status(401).json({ ok: false, error: authError });
      return;
    }

    res.json({ ok: true, state: 'logged_in' });
  } catch (err) {
    authError = String(err?.message || err || 'failed to import cookie');
    res.status(500).json({ ok: false, error: authError });
  } finally {
    isAuthPending = false;
    try {
      await browser?.close();
    } catch {
      // ignore
    }
    browser = null;
    page = null;
  }
});

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  try {
    const url = new URL(`${SORA2_BASE}/api/search`);
    if (q) url.searchParams.set('q', q);
    const upstream = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        cookie: cookieHeader || '',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        referer: `${SORA2_BASE}/`,
      },
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err || 'search failed') });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[sora2-proxy] listening on http://127.0.0.1:${PORT}`);
});
