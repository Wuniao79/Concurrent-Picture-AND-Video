export type SoraPayloadParseResult = {
  logsText: string | null;
  videoSrc: string | null;
  fullHtml: string | null;
  remixId: string | null;
};

const decodeHtmlEntities = (input: string) =>
  (input || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

const stripHtml = (input: string) =>
  decodeHtmlEntities(input)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cleanupToken = (value: string) => {
  const trimmed = (value || '').trim().replace(/^["']+|["']+$/g, '');
  return trimmed.replace(/[)\],.;:]+$/g, '').trim();
};

const cleanupUrl = (raw: string) => {
  let url = cleanupToken(decodeHtmlEntities(raw || ''));
  while (url && /[)\],.]+$/.test(url)) url = url.slice(0, -1);
  return url;
};

const extractUrls = (input: string) => {
  const urls: string[] = [];
  const regex = /https?:\/\/[^\s<>"']+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const cleaned = cleanupUrl(match[0] || '');
    if (cleaned && !urls.includes(cleaned)) urls.push(cleaned);
  }
  return urls;
};

const isLikelyVideoUrl = (url: string) => {
  const u = (url || '').toLowerCase();
  if (!u.startsWith('http')) return false;
  return /\b\.(?:mp4|webm|m3u8|mov)\b/.test(u);
};

const extractPostIdFromUrl = (rawUrl: string): string | null => {
  const cleaned = cleanupUrl(rawUrl);
  if (!cleaned) return null;

  try {
    const u = new URL(cleaned);
    const byParam =
      u.searchParams.get('post_id') ||
      u.searchParams.get('postId') ||
      u.searchParams.get('post') ||
      u.searchParams.get('remix') ||
      '';
    if (byParam) return cleanupToken(byParam);

    const pathMatch = u.pathname.match(/\/(?:posts?|remix)\/([A-Za-z0-9_-]{6,})/i);
    if (pathMatch && pathMatch[1]) return cleanupToken(pathMatch[1]);
  } catch {
    // ignore invalid URLs
  }

  const rawMatch = cleaned.match(/(?:post_id|postId|remixId)\s*=\s*([A-Za-z0-9_-]{6,})/i);
  if (rawMatch && rawMatch[1]) return cleanupToken(rawMatch[1]);
  return null;
};

/**
 * 解析 Sora 返回，拆出视频、日志、Remix/Post ID。
 */
export function parseSoraPayload(text: string): SoraPayloadParseResult {
  const result: SoraPayloadParseResult = {
    logsText: null,
    videoSrc: null,
    fullHtml: null,
    remixId: null,
  };

  if (!text) return result;
  const trimmed = text.trim();
  if (!trimmed) return result;

  const decodedTrimmed = decodeHtmlEntities(trimmed);
  const plainText = stripHtml(decodedTrimmed);
  const urls = extractUrls(decodedTrimmed);

  const looksLikeHtml = /<\s*(?:video|source|html|body|script|div)\b/i.test(decodedTrimmed);
  result.fullHtml = looksLikeHtml ? trimmed : null;

  const videoRegex =
    /<video[^>]*src=['"]([^'"]+)['"][^>]*>(?:[\s\S]*?<\/video>)?|<video[^>]*src=['"]([^'"]+)['"][^>]*\/?>/i;
  const videoMatch = decodedTrimmed.match(videoRegex);

  if (videoMatch) {
    const videoTag = videoMatch[0];
    const videoSrc = cleanupUrl(videoMatch[1] || videoMatch[2] || '');
    result.videoSrc = videoSrc || null;

    const idx = decodedTrimmed.indexOf(videoTag);
    if (idx > -1) {
      const before = decodedTrimmed.slice(0, idx).trim();
      result.logsText = before || null;
    }
  }

  if (!result.videoSrc) {
    const sourceMatch = decodedTrimmed.match(/<source[^>]*src=['"]([^'"]+)['"][^>]*>/i);
    if (sourceMatch && sourceMatch[1]) {
      const src = cleanupUrl(sourceMatch[1]);
      result.videoSrc = src || null;

      if (result.videoSrc) {
        const videoIdx = decodedTrimmed.search(/<\s*video\b/i);
        const cutIdx = videoIdx >= 0 ? videoIdx : decodedTrimmed.indexOf(sourceMatch[0]);
        if (cutIdx > -1) {
          const before = decodedTrimmed.slice(0, cutIdx).trim();
          result.logsText = before || null;
        }
      }
    }
  }

  if (!result.videoSrc) {
    const directVideoUrl = urls.find(isLikelyVideoUrl);
    if (directVideoUrl) {
      result.videoSrc = directVideoUrl;
      const idx = decodedTrimmed.indexOf(directVideoUrl);
      if (idx > -1) {
        const before = decodedTrimmed.slice(0, idx).trim();
        const after = decodedTrimmed.slice(idx + directVideoUrl.length).trim();
        const merged = [before, after].filter(Boolean).join('\n').trim();
        result.logsText = merged || null;
      }
    }
  }

  const remixPatterns: RegExp[] = [
    /Post\s*ID\s*[:：]\s*([A-Za-z0-9_-]{6,})/i,
    /PostId\s*[:：]\s*([A-Za-z0-9_-]{6,})/i,
    /Remix\s*ID\s*[:：]\s*([A-Za-z0-9_-]{6,})/i,
    /post_id\s*[:=]\s*["']?([A-Za-z0-9_-]{6,})["']?/i,
    /postId\s*[:=]\s*["']?([A-Za-z0-9_-]{6,})["']?/i,
    /data-post-id=["']([^"']+)["']/i,
    /data-postid=["']([^"']+)["']/i,
    /\/(?:posts?|remix)\/([A-Za-z0-9_-]{6,})/i,
  ];

  const remixSearchSpace = [plainText, decodedTrimmed];
  for (const source of remixSearchSpace) {
    for (const pattern of remixPatterns) {
      const match = source.match(pattern);
      if (match && match[1]) {
        result.remixId = cleanupToken(match[1]);
        break;
      }
    }
    if (result.remixId) break;
  }

  if (!result.remixId && urls.length > 0) {
    for (const url of urls) {
      const id = extractPostIdFromUrl(url);
      if (id) {
        result.remixId = id;
        break;
      }
    }
  }

  if (!result.videoSrc) {
    const looksLikeSoraLogs =
      /Generation Process Begins/i.test(decodedTrimmed) || /Video Generation Progress/i.test(decodedTrimmed);

    if (looksLikeSoraLogs) {
      result.logsText = decodedTrimmed;
    } else {
      result.logsText = null;
    }

    // 非视频结果：不展示“查看原始 HTML”，避免误导。
    result.fullHtml = null;
  }

  return result;
}

