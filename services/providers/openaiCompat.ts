import { Message, Role } from '../../types';
import { createHttpError } from '../httpError';

type OpenAiCompatOptions = {
  model: string;
  historyMessages: Message[];
  userText: string;
  onChunk: (text: string) => void;
  apiKey: string;
  shouldStream: boolean;
  imageDataUrls?: string[];
  apiBase?: string;
  abortSignal?: AbortSignal;
};

const extractTextFromContent = (content: any): string => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part) return '';
        if (typeof part === 'string') return part;
        if (typeof part.text === 'string') return part.text;
        if (typeof part.content === 'string') return part.content;
        if (Array.isArray(part.content)) {
          return part.content
            .map((p: any) => {
              if (!p) return '';
              if (typeof p === 'string') return p;
              if (typeof p.text === 'string') return p.text;
              if (typeof p.content === 'string') return p.content;
              return '';
            })
            .join('');
        }
        if (part.data) {
          if (typeof part.data === 'string') return part.data;
          if (Array.isArray(part.data)) {
            return part.data
              .map((p: any) => {
                if (!p) return '';
                if (typeof p === 'string') return p;
                if (typeof p.text === 'string') return p.text;
                return '';
              })
              .join('');
          }
        }
        return '';
      })
      .join('');
  }
  if (typeof content.text === 'string') return content.text;
  if (typeof content.content === 'string') return content.content;
  return '';
};

const extractReasoningText = (container: any): string => {
  if (!container) return '';
  if (Array.isArray(container.reasoning_content)) {
    const t = extractTextFromContent(container.reasoning_content);
    if (t) return t;
  }
  if (Array.isArray(container.thinking)) {
    const t = extractTextFromContent(container.thinking);
    if (t) return t;
  }
  if (typeof container.thinking === 'string') {
    return container.thinking;
  }
  return '';
};

const collectDeepText = (obj: any): string => {
  const MIN_LEN = 12;
  const IGNORE_KEYS = new Set(['id', 'object', 'model', 'created', 'role', 'finish_reason', 'type']);
  const pieces: string[] = [];
  const walk = (value: any, key?: string) => {
    if (!value) return;
    const keyLower = key?.toLowerCase() ?? '';
    if (typeof value === 'string') {
      const v = value.trim();
      if (!v) return;
      if (v.length < MIN_LEN) return;
      if (IGNORE_KEYS.has(keyLower)) return;
      if (/^[0-9a-f\-]{6,}$/.test(v) && !v.includes(' ')) return;
      if (!pieces.includes(v)) pieces.push(v);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, key));
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => walk(v, k));
    }
  };
  walk(obj);
  return pieces.join('\n');
};

const getImagesFromMessage = (m: Message): string[] => {
  if (m.role !== Role.USER) return [];
  if (Array.isArray(m.images) && m.images.length > 0) return m.images.filter(Boolean);
  if (m.image) return [m.image];
  return [];
};

const toOpenAiUserContent = (text: string, images: string[]) => {
  if (!images || images.length === 0) return text || '';
  return [
    { type: 'text', text: text || '' },
    ...images.map((url) => ({
      type: 'image_url',
      image_url: { url },
    })),
  ];
};

const hasAnyInputImages = (historyMessages: Message[], imageDataUrls?: string[]) => {
  const input = Array.isArray(imageDataUrls) ? imageDataUrls.filter(Boolean) : [];
  if (input.length > 0) return true;
  return historyMessages.some((m) => getImagesFromMessage(m).length > 0);
};

export const generateOpenAICompatibleResponse = async ({
  model,
  historyMessages,
  userText,
  onChunk,
  apiKey,
  shouldStream,
  imageDataUrls,
  apiBase,
  abortSignal,
}: OpenAiCompatOptions): Promise<void> => {
  const normalizedImageDataUrls = Array.isArray(imageDataUrls) ? imageDataUrls.filter(Boolean) : [];
  const shouldStreamApi = Boolean(shouldStream);

  const messages: any[] = historyMessages.map((m) => {
    const role = m.role === Role.USER ? 'user' : 'assistant';
    if (role !== 'user') {
      return { role, content: m.text || '' };
    }
    const images = getImagesFromMessage(m);
    return { role, content: toOpenAiUserContent(m.text || '', images) };
  });

  messages.push({
    role: 'user',
    content: toOpenAiUserContent(userText || '', normalizedImageDataUrls),
  });

  const payload: any = {
    model,
    stream: shouldStreamApi,
    messages,
  };

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${(apiKey || '').trim()}`,
    Accept: shouldStreamApi ? 'text/event-stream' : 'application/json',
  };

  const finalApiBase = (apiBase || '').trim() || 'https://api.openai.com';
  const url = finalApiBase.replace(/\/$/, '') + '/v1/chat/completions';

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: abortSignal,
    });
  } catch (err: any) {
    if (abortSignal?.aborted) {
      throw new Error('请求已取消');
    }
    const message = err?.message ? String(err.message) : String(err);
    if (hasAnyInputImages(historyMessages, normalizedImageDataUrls)) {
      throw new Error(
        `图片请求失败：${message}（可能图片过大或当前中转不支持图片；已自动关闭流式，可尝试压缩图片/更换中转）`
      );
    }
    throw new Error(message || 'Failed to fetch');
  }

  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch {
      // ignore
    }
    let message = `请求失败: ${response.status}`;
    if (errorText) message += ` - ${errorText}`;
    throw createHttpError(response.status, message, errorText);
  }

  if (!shouldStreamApi) {
    const json: any = await response.json();
    const choice = json?.choices?.[0];
    const msg = choice?.message ?? json?.message ?? {};
    let fullText = '';
    fullText += extractTextFromContent(msg.content);
    const reasoning = extractReasoningText(msg);
    if (reasoning) {
      fullText += (fullText ? '\n' : '') + reasoning;
    }
    if (typeof json.log === 'string') {
      fullText += (fullText ? '\n' : '') + json.log;
    }
    if (typeof json.thinking === 'string') {
      fullText += (fullText ? '\n' : '') + json.thinking;
    }
    if (!fullText) {
      fullText = collectDeepText(json) || JSON.stringify(json);
    }
    onChunk(fullText);
    return;
  }

  const body = response.body;
  if (!body) {
    throw new Error('Stream body is empty');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Normalize CRLF so we can reliably split SSE frames.
    buffer = buffer.replace(/\r\n/g, '\n');
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const lines = event.split('\n').map((l) => l.trim());
      for (const line of lines) {
        if (!line || !line.startsWith('data:')) continue;
        const dataStr = line.slice('data:'.length).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        // Some proxies stream plain-text SSE (e.g. Sora logs). Treat non-JSON payloads as text.
        const looksJson = dataStr.startsWith('{') || dataStr.startsWith('[');
        let json: any = null;
        if (looksJson) {
          try {
            json = JSON.parse(dataStr);
          } catch {
            continue;
          }
        } else {
          onChunk(dataStr);
          continue;
        }
        let piece = '';
        const choice = json?.choices?.[0];
        const delta = choice?.delta || choice?.message || json.delta || json.message;
        if (delta) {
          piece += extractReasoningText(delta);
          if (typeof delta.content === 'string') {
            piece += delta.content;
          } else if (delta.content) {
            piece += extractTextFromContent(delta.content);
          }
          if (typeof (delta as any).message === 'string') piece += ((piece ? '\n' : '') + (delta as any).message);
          if (typeof (delta as any).status_text === 'string')
            piece += ((piece ? '\n' : '') + (delta as any).status_text);
          if (typeof (delta as any).log === 'string') piece += ((piece ? '\n' : '') + (delta as any).log);
          if (typeof (delta as any).thinking === 'string') piece += ((piece ? '\n' : '') + (delta as any).thinking);
        }
        if (!piece) {
          if (typeof json.message === 'string') {
            piece = json.message;
          } else if (typeof json.status_text === 'string') {
            piece = json.status_text;
          } else if (typeof json.log === 'string') {
            piece = json.log;
          } else if (typeof json.thinking === 'string') {
            piece = json.thinking;
          } else if (json?.choices?.[0]?.message) {
            const m = json.choices[0].message;
            let t = extractTextFromContent(m.content);
            const r = extractReasoningText(m);
            if (r) t += (t ? '\n' : '') + r;
            piece = t;
          } else {
            piece = collectDeepText(json);
          }
        }
        if (piece) {
          onChunk(piece);
        }
      }
    }
  }
};
