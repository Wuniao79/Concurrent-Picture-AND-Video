# Sora2 Proxy (Local/Server)

This small proxy exists to solve:
- Browser CORS when calling `https://sora2.com/api/*` from `http://localhost:3000`
- Keeping Sora2 login/session on the proxy side (not in the frontend)

## Quick start

> Requires a local Chrome/Edge installed (this proxy uses `puppeteer-core` and will not download a bundled browser).

1. Install deps:

```bash
cd sora2-proxy
npm install
```

2. Start proxy (default port `4581`):

```bash
npm run dev
```

3. In the main app Settings → `Sora2`:
- Click **连接/授权** (it will open a real browser window for you to sign in to Sora2)
- After finishing login, click **完成登录**
- You can then use **搜索**

## Browser path

If the proxy cannot find Chrome/Edge automatically, set:

- `SORA2_BROWSER_PATH` (preferred)

Example (Windows PowerShell):

```powershell
$env:SORA2_BROWSER_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
npm run dev
```

## Endpoints

- `GET /health`
- `GET /auth/status`
- `POST /auth/start`
- `POST /auth/finish`
- `POST /auth/logout`
- `GET /api/search?q=...`

## Notes

- A local file `.sora2-session.json` will be created in `sora2-proxy/` to persist the session cookie header.
- If the session expires, just run the login flow again.
