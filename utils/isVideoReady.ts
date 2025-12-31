const decodeHtmlEntities = (input: string) =>
  (input || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

const cleanupUrl = (raw: string) => {
  let url = (raw || '').trim().replace(/^["']+|["']+$/g, '');
  url = decodeHtmlEntities(url);
  while (url && /[)\],.;:]+$/.test(url)) url = url.slice(0, -1);
  return url.trim();
};

const maybeDecode = (text: string) => {
  const t = text || '';
  if (t.includes('&lt;') || t.includes('&gt;') || t.includes('&quot;') || t.includes('&amp;') || t.includes('&#')) {
    return decodeHtmlEntities(t);
  }
  return t;
};

const VIDEO_URL_RE = /https?:\/\/[^\s<>"']+\.(?:mp4|webm|m3u8|mov)\b[^\s<>"']*/i;
const VIDEO_TAG_SRC_RE = /<video[^>]*\ssrc=['"]([^'"]+)['"][^>]*>/i;
const SOURCE_TAG_SRC_RE = /<source[^>]*\ssrc=['"]([^'"]+)['"][^>]*>/i;

export function extractFirstVideoUrlFromText(text: string): string | null {
  if (!text) return null;
  const decoded = maybeDecode(text);

  const videoTagMatch = decoded.match(VIDEO_TAG_SRC_RE);
  if (videoTagMatch && videoTagMatch[1]) {
    const url = cleanupUrl(videoTagMatch[1]);
    return url || null;
  }

  const sourceMatch = decoded.match(SOURCE_TAG_SRC_RE);
  if (sourceMatch && sourceMatch[1]) {
    const url = cleanupUrl(sourceMatch[1]);
    return url || null;
  }

  const urlMatch = decoded.match(VIDEO_URL_RE);
  if (urlMatch && urlMatch[0]) {
    const url = cleanupUrl(urlMatch[0]);
    return url || null;
  }

  return null;
}

export function isVideoReadyFromText(text: string): boolean {
  return Boolean(extractFirstVideoUrlFromText(text));
}

