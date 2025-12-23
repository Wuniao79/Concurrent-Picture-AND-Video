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

type GeminiImageItem = {
  dataUrl: string;
  thoughtSignature?: string;
};

const parseSignatureTitle = (title?: string) => {
  if (!title) return undefined;
  const trimmed = title.trim();
  const match = trimmed.match(/^(?:ts|thought|thought_signature):(.+)$/i);
  if (!match || !match[1]) return undefined;
  const raw = match[1];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export const formatGeminiImageMarkdown = (image: GeminiImageItem) => {
  if (!image.thoughtSignature) return `![](${image.dataUrl})`;
  const encoded = encodeURIComponent(image.thoughtSignature);
  return `![](${image.dataUrl} \"ts:${encoded}\")`;
};

export const createGeminiContents = (historyMessages: Message[], userText: string, imageDataUrls?: string[]) => {
  const extractMarkdownImagesFromText = (text: string) => {
    if (!text) return [] as Array<{ url: string; signature?: string }>;
    const results: Array<{ url: string; signature?: string }> = [];
    const regex = /!\[[^\]]*]\((\S+?)(?:\s+["']([^"']*)["'])?\)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const url = match[1];
      if (!url) continue;
      const signature = parseSignatureTitle(match[2]);
      results.push({ url, signature });
    }
    return results;
  };

  const extractInlineImagesFromText = (text: string) => {
    if (!text) return [] as string[];
    const results: string[] = [];
    const regex = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match[0]) results.push(match[0]);
    }
    return results;
  };

  const getImagesFromMessage = (msg: Message): GeminiImageItem[] => {
    const images = new Map<string, string | undefined>();
    const addImage = (url: string, signature?: string) => {
      if (!url) return;
      if (!images.has(url)) {
        images.set(url, signature);
      } else if (signature && !images.get(url)) {
        images.set(url, signature);
      }
    };

    if (Array.isArray(msg.images) && msg.images.length > 0) {
      msg.images.filter(Boolean).forEach((img) => addImage(img));
    }
    if (msg.image) addImage(msg.image);
    extractMarkdownImagesFromText(msg.text || '').forEach((img) => addImage(img.url, img.signature));
    extractInlineImagesFromText(msg.text || '').forEach((img) => addImage(img));

    return Array.from(images.entries()).map(([dataUrl, thoughtSignature]) => ({
      dataUrl,
      thoughtSignature,
    }));
  };

  const stripInlineImageData = (text: string) => {
    if (!text) return '';
    return text
      .replace(/!\[[^\]]*]\(data:image\/[a-zA-Z0-9.+-]+;base64,[^)]+?(?:\s+["'][^"']*["'])?\)/g, '[image]')
      .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, '[image]');
  };

  const toGeminiParts = (msg: Message) => {
    const parts: any[] = [];
    const images = getImagesFromMessage(msg);
    const modelSignature = images.find((img) => img.thoughtSignature)?.thoughtSignature;
    const cleanedText = stripInlineImageData(msg.text || '').trim();
    if (cleanedText) {
      const textPart: any = { text: cleanedText };
      if (msg.role === Role.MODEL && modelSignature) {
        textPart.thoughtSignature = modelSignature;
        textPart.thought_signature = modelSignature;
      }
      parts.push(textPart);
    }
    for (const imageDataUrl of images) {
      if (!imageDataUrl.dataUrl.startsWith('data:image/')) continue;
      const [meta, data] = imageDataUrl.dataUrl.split(',');
      const mime = meta?.split(';')[0]?.replace('data:', '') || 'image/png';
      const part: any = {
        inlineData: {
          mimeType: mime,
          data: data || imageDataUrl.dataUrl,
        },
      };
      const signature = imageDataUrl.thoughtSignature || (msg.role === Role.MODEL ? modelSignature : undefined);
      if (signature) {
        part.thoughtSignature = signature;
        part.thought_signature = signature;
      }
      parts.push(part);
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
  const images: GeminiImageItem[] = [];
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (!part) continue;
      if (typeof part.text === 'string' && part.text) {
        textPieces.push(part.text);
      }
      const inlineData = part.inlineData;
      const mimeType = inlineData?.mimeType;
      const data = inlineData?.data;
      const thoughtSignature =
        part.thoughtSignature || part.thought_signature || inlineData?.thoughtSignature || inlineData?.thought_signature;
      if (
        inlineData &&
        typeof mimeType === 'string' &&
        mimeType.startsWith('image/') &&
        typeof data === 'string' &&
        data
      ) {
        images.push({
          dataUrl: `data:${mimeType};base64,${data}`,
          thoughtSignature: typeof thoughtSignature === 'string' ? thoughtSignature : undefined,
        });
      }
    }
  }
  return { text: textPieces.join(''), images };
};

export const buildGeminiOutput = (response: any) => {
  const { text, images } = extractGeminiTextAndImages(response);
  const imageMarkdown = images.map((img) => formatGeminiImageMarkdown(img)).join('\n\n');
  return [text, imageMarkdown].filter(Boolean).join('\n\n');
};
