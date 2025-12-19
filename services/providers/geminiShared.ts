import { Message, Role } from '../../types';

const normalizeModelIdValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof (value as any).id !== 'undefined') {
    return String((value as any).id);
  }
  return String(value ?? '');
};

export const looksLikeImageOutputModel = (modelId: unknown) => {
  const m = normalizeModelIdValue(modelId).toLowerCase();
  if (!m) return false;
  if (m.includes('vision')) return false;
  return m.includes('image');
};

export const createGeminiContents = (historyMessages: Message[], userText: string, imageDataUrls?: string[]) => {
  const getImagesFromMessage = (msg: Message): string[] => {
    if (Array.isArray(msg.images) && msg.images.length > 0) {
      return msg.images.filter(Boolean);
    }
    if (msg.image) return [msg.image];
    return [];
  };

  const toGeminiParts = (msg: Message) => {
    const parts: any[] = [];
    if (msg.text) parts.push({ text: msg.text });
    for (const imageDataUrl of getImagesFromMessage(msg)) {
      const [meta, data] = imageDataUrl.split(',');
      const mime = meta?.split(';')[0]?.replace('data:', '') || 'image/png';
      parts.push({
        inlineData: {
          mimeType: mime,
          data: data || imageDataUrl,
        },
      });
    }
    return parts.length ? parts : [{ text: '' }];
  };

  const contents = historyMessages.map((m) => ({
    role: m.role === Role.USER ? 'user' : 'model',
    parts: toGeminiParts(m),
  }));

  contents.push({
    role: 'user',
    parts: toGeminiParts({
      id: 'tmp',
      role: Role.USER,
      text: userText,
      timestamp: Date.now(),
      images: imageDataUrls && imageDataUrls.length > 0 ? imageDataUrls : undefined,
      image: imageDataUrls?.[0] || undefined,
    }),
  });

  return contents;
};

export const extractGeminiTextAndImages = (response: any) => {
  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  const parts = candidates?.[0]?.content?.parts;
  const textPieces: string[] = [];
  const images: string[] = [];
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (!part) continue;
      if (typeof part.text === 'string' && part.text) {
        textPieces.push(part.text);
      }
      const inlineData = part.inlineData;
      const mimeType = inlineData?.mimeType;
      const data = inlineData?.data;
      if (
        inlineData &&
        typeof mimeType === 'string' &&
        mimeType.startsWith('image/') &&
        typeof data === 'string' &&
        data
      ) {
        images.push(`data:${mimeType};base64,${data}`);
      }
    }
  }
  return { text: textPieces.join(''), images };
};

export const buildGeminiOutput = (response: any) => {
  const { text, images } = extractGeminiTextAndImages(response);
  const imageMarkdown = images.map((u) => `![](${u})`).join('\n\n');
  return [text, imageMarkdown].filter(Boolean).join('\n\n');
};
