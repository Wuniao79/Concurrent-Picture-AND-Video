export const DEFAULT_GEMINI_TIMEOUT_MS = 120_000;
export const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';

export const isLikelyGoogleApiKey = (key: string) => {
  const k = key.trim();
  return /^AIza[0-9A-Za-z\-_]{10,}$/.test(k);
};

export const isLikelyGoogleGeminiEndpoint = (raw?: string) => {
  const input = (raw || '').trim();
  if (!input) return false;
  try {
    const url = new URL(input);
    return url.hostname === 'generativelanguage.googleapis.com';
  } catch {
    return input.includes('generativelanguage.googleapis.com');
  }
};

export const normalizeGeminiBaseUrl = (raw?: string) => {
  const input = (raw || '').trim();
  if (!input) return '';
  try {
    const url = new URL(input);
    return url.origin.replace(/\/$/, '');
  } catch {
    return input.replace(/\/+$/, '');
  }
};

