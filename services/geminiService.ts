import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message, ModelProvider, Role } from '../types';

/**
 * 统一的生成响应函数，支持 OpenAI 兼容接口与 Gemini 官方接口。
 * onChunk 在流式时多次调用，非流式时仅调用一次返回完整文本。
 */
export async function generateResponse(
  model: string,
  historyMessages: Message[],
  userText: string,
  onChunk: (text: string) => void,
  customApiKey?: string,
  shouldStream: boolean = true,
  imageDataUrl?: string,
  customApiUrl?: string,
  provider: ModelProvider = 'openai',
  abortSignal?: AbortSignal
): Promise<void> {
  const apiBase =
    (customApiUrl && customApiUrl.trim()) ||
    (import.meta as any).env?.VITE_API_BASE_URL ||
    '';

  const apiKey =
    (customApiKey && customApiKey.trim()) ||
    (import.meta as any).env?.VITE_API_KEY ||
    (import.meta as any).env?.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('未配置API Key，请在设置中填写。');
  }

  // --- Gemini 官方 API ---
  if (provider === 'gemini') {
    const client = new GoogleGenerativeAI(apiKey);

    const toGeminiParts = (msg: Message) => {
      const parts: any[] = [];
      if (msg.text) parts.push({ text: msg.text });
      if (msg.image) {
        const [meta, data] = msg.image.split(',');
        const mime = meta?.split(';')[0]?.replace('data:', '') || 'image/png';
        parts.push({
          inlineData: {
            mimeType: mime,
            data: data || msg.image,
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
        image: imageDataUrl || undefined,
      }),
    });

    const modelClient = client.getGenerativeModel({ model });

    if (!shouldStream) {
    const res = await modelClient.generateContent({ contents });
    const text = res.response?.text?.();
    if (text) onChunk(text);
    return;
  }

    const stream = await modelClient.generateContentStream({ contents });
    for await (const chunk of stream.stream) {
      const piece = chunk.text();
      if (piece) onChunk(piece);
    }
    return;
  }

  // --- OpenAI 兼容 API ---

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

  const messages: any[] = historyMessages.map((m) => ({
    role: m.role === Role.USER ? 'user' : 'assistant',
    content: m.text || '',
  }));

  let userContent: any = userText;
  if (imageDataUrl) {
    userContent = [
      { type: 'text', text: userText || '' },
      {
        type: 'image_url',
        image_url: {
          url: imageDataUrl,
        },
      },
    ];
  }

  messages.push({ role: 'user', content: userContent });

  const payload: any = {
    model,
    stream: shouldStream,
    messages,
  };

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    Accept: shouldStream ? 'text/event-stream' : 'application/json',
  };

  const finalApiBase = apiBase || 'https://api.openai.com';

  const url = finalApiBase.replace(/\/$/, '') + '/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: abortSignal,
  });

  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch {
      // ignore
    }
    let message = `请求失败: ${response.status}`;
    if (errorText) message += ` - ${errorText}`;
    throw new Error(message);
  }

  if (!shouldStream) {
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
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const lines = event.split('\n').map((l) => l.trim());
      for (const line of lines) {
        if (!line || !line.startsWith('data:')) continue;
        const dataStr = line.slice('data:'.length).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        let json: any;
        try {
          json = JSON.parse(dataStr);
        } catch {
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
          if (typeof (delta as any).status_text === 'string') piece += ((piece ? '\n' : '') + (delta as any).status_text);
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
}
