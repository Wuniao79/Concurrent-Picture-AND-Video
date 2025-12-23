export const buildProxyUrl = (proxyBase: string, targetUrl: string) => {
  const base = (proxyBase || '').trim();
  if (!base) return targetUrl;
  const encoded = encodeURIComponent(targetUrl);
  if (base.includes('{url}')) {
    return base.replace(/\{url\}/g, encoded);
  }
  return `${base}${encoded}`;
};

export const fetchBlobWithProxy = async (url: string, proxyBase?: string) => {
  const attempt = async (target: string) => {
    const response = await fetch(target);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.blob();
  };

  try {
    return await attempt(url);
  } catch (err) {
    const proxy = (proxyBase || '').trim();
    if (!proxy || url.startsWith('data:')) throw err;
    return attempt(buildProxyUrl(proxy, url));
  }
};
