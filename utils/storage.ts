export const safeStorageGet = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(key);
    if (v !== null) return v;
  } catch {
    // ignore
  }
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeStorageSet = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage may be full (e.g. base64 images); fall back to sessionStorage for this tab.
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // ignore storage failures
    }
  }
};
