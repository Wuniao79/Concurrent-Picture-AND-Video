import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message, ModelProvider, Role } from '../types';

const DEFAULT_GEMINI_TIMEOUT_MS = 120_000;
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';

const isLikelyGoogleApiKey = (key: string) => {
  const k = key.trim();
  return /^AIza[0-9A-Za-z\-_]{10,}$/.test(k);
};

const isLikelyGoogleGeminiEndpoint = (raw?: string) => {
  const input = (raw || '').trim();
  if (!input) return false;
  try {
    const url = new URL(input);
    return url.hostname === 'generativelanguage.googleapis.com';
  } catch {
    return input.includes('generativelanguage.googleapis.com');
  }
};

const normalizeGeminiBaseUrl = (raw?: string) => {
  const input = (raw || '').trim();
  if (!input) return '';
  try {
    const url = new URL(input);
    return url.origin.replace(/\/$/, '');
  } catch {
    return input.replace(/\/+$/, '');
  }
};

type GeminiRequestExtras = {
  geminiEnterpriseEnabled?: boolean;
  geminiEnterpriseProjectId?: string;
  geminiEnterpriseLocation?: string;
  geminiEnterpriseToken?: string;
};

const looksLikeImageOutputModel = (modelId: string) => {
  const m = (modelId || '').toLowerCase();
  if (!m) return false;
  if (m.includes('vision')) return false;
  return m.includes('image');
};

const createGeminiContents = (historyMessages: Message[], userText: string, imageDataUrls?: string[]) => {
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

const extractGeminiTextAndImages = (response: any) => {
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

const buildGeminiOutput = (response: any) => {
  const { text, images } = extractGeminiTextAndImages(response);
  const imageMarkdown = images.map((u) => `![](${u})`).join('\n\n');
  const output = [text, imageMarkdown].filter(Boolean).join('\n\n');
  return output;
};

const streamGeminiSse = async (response: Response, onChunk: (t: string) => void) => {
  const body = response.body;
  if (!body) throw new Error('Stream body is empty');
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
        const piece = extractGeminiTextAndImages(json).text;
        if (piece) onChunk(piece);
      }
    }
  }
};

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
  imageDataUrls?: string[],
  customApiUrl?: string,
  provider: ModelProvider = 'openai',
  abortSignal?: AbortSignal,
  extras?: GeminiRequestExtras
): Promise<void> {
  const envApiBase = ((import.meta as any).env?.VITE_API_BASE_URL || '').trim();
  const customApiBase = (customApiUrl || '').trim();
  const apiBase = customApiBase || envApiBase || '';

  const normalizedImageDataUrls = Array.isArray(imageDataUrls) ? imageDataUrls.filter(Boolean) : [];
  const hasImageInput = normalizedImageDataUrls.length > 0;
  const historyHasImages = historyMessages.some(
    (m) => m.role === Role.USER && ((Array.isArray(m.images) && m.images.length > 0) || Boolean(m.image))
  );
  const hasAnyInputImages = hasImageInput || historyHasImages;

  const enterpriseEnabled = provider === 'gemini' && Boolean(extras?.geminiEnterpriseEnabled);
  const resolvedApiKey =
    (customApiKey && customApiKey.trim()) ||
    (import.meta as any).env?.VITE_API_KEY ||
    (import.meta as any).env?.GEMINI_API_KEY;

  if (!resolvedApiKey && !enterpriseEnabled) {
    throw new Error('未配置API Key，请在设置中填写。');
  }

  const apiKey = (resolvedApiKey || '').trim();

  // --- Gemini 官方 API ---
  if (provider === 'gemini') {
    const timeoutEnv = Number((import.meta as any).env?.VITE_GEMINI_TIMEOUT_MS);
    const timeoutMs =
      Number.isFinite(timeoutEnv) && timeoutEnv > 0 ? timeoutEnv : DEFAULT_GEMINI_TIMEOUT_MS;

    if (enterpriseEnabled) {
      try {
        const token = (extras?.geminiEnterpriseToken || '').trim();
        const projectId = (extras?.geminiEnterpriseProjectId || '').trim();
        const location = (extras?.geminiEnterpriseLocation || '').trim() || 'us-central1';

        if (!token) {
          throw new Error('企业API缺少访问令牌（Access Token），请在设置中填写。');
        }
        if (!projectId) {
          throw new Error('企业API缺少项目 ID（Project ID），请在设置中填写。');
        }

        const wantsImageOutput = looksLikeImageOutputModel(model);
        const shouldStreamEnterprise = Boolean(shouldStream && !hasAnyInputImages && !wantsImageOutput);

        const origin =
          (!isLikelyGoogleGeminiEndpoint(customApiBase) ? normalizeGeminiBaseUrl(customApiBase) : '') ||
          `https://${location}-aiplatform.googleapis.com`;
        const endpointBase = origin.replace(/\/$/, '');

        const contents = createGeminiContents(historyMessages, userText, normalizedImageDataUrls);
        const payload: any = { contents };
        if (wantsImageOutput) {
          payload.generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
        }

        const requestOnce = async (stream: boolean) => {
          const methodPath = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
          const url = `${endpointBase}/v1/projects/${encodeURIComponent(
            projectId
          )}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(
            model
          )}:${methodPath}`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          if (abortSignal) {
            if (abortSignal.aborted) controller.abort();
            else abortSignal.addEventListener('abort', () => controller.abort(), { once: true });
          }

          try {
            return await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                Accept: stream ? 'text/event-stream' : 'application/json',
              },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }
        };

        const runNonStream = async () => {
          const res = await requestOnce(false);
          if (!res.ok) {
            let errorText = '';
            try {
              errorText = await res.text();
            } catch {
              // ignore
            }
            throw new Error(`企业API请求失败: ${res.status}${errorText ? ` - ${errorText}` : ''}`);
          }

          const json = await res.json();
          const output = buildGeminiOutput(json);
          if (!output) {
            throw new Error('企业API返回为空（可能提示词被拦截或模型无输出）');
          }
          onChunk(output);
        };

        if (shouldStreamEnterprise) {
          try {
            const res = await requestOnce(true);
            if (!res.ok) {
              let errorText = '';
              try {
                errorText = await res.text();
              } catch {
                // ignore
              }
              throw new Error(`企业API请求失败: ${res.status}${errorText ? ` - ${errorText}` : ''}`);
            }
            await streamGeminiSse(res, onChunk);
            return;
          } catch (err: any) {
            if (abortSignal?.aborted) {
              throw new Error('请求已取消');
            }
            await runNonStream();
            return;
          }
        }

        await runNonStream();
        return;
      } catch (err: any) {
        if (abortSignal?.aborted) {
          throw new Error('请求已取消');
        }
        if (err?.name === 'AbortError') {
          throw new Error('企业API请求超时，请稍后重试');
        }
        const message = err?.message ? String(err.message) : String(err);
        if (message.startsWith('企业API')) {
          throw new Error(message);
        }
        throw new Error(`企业API请求失败：${message}`);
      }
    }

    const trimmedKey = apiKey.trim();
    const hasCustomApiUrl = Boolean(customApiBase);
    const customApiIsGoogle = isLikelyGoogleGeminiEndpoint(customApiBase);
    const keyLooksGoogle = isLikelyGoogleApiKey(trimmedKey);

    // Rules:
    // - If a custom API URL is provided, treat it as authoritative:
    //    - Google official domain => use Gemini official API
    //    - otherwise => treat as OpenAI-compatible proxy
    // - If no custom API URL, use official API only for real Google keys (AIza...).
    const shouldUseOfficialGemini = hasCustomApiUrl ? customApiIsGoogle : keyLooksGoogle;

	    if (shouldUseOfficialGemini) {
	      const client = new GoogleGenerativeAI(trimmedKey);
	      const geminiBaseUrl = customApiIsGoogle ? normalizeGeminiBaseUrl(customApiBase) : '';
	      const wantsImageOutput = looksLikeImageOutputModel(model);
	      const effectiveStream = Boolean(shouldStream && !wantsImageOutput);
	      const contents = createGeminiContents(historyMessages, userText, normalizedImageDataUrls);

	      const modelParams: any = { model };
	      if (wantsImageOutput) {
	        modelParams.generationConfig = {
	          responseModalities: ['TEXT', 'IMAGE'],
	        };
	      }

	      const modelClient = client.getGenerativeModel(
	        modelParams,
	        {
	          apiVersion: 'v1beta',
	          ...(geminiBaseUrl ? { baseUrl: geminiBaseUrl } : {}),
	        }
	      );

      const requestOptions: any = { timeout: timeoutMs };
      if (abortSignal) requestOptions.signal = abortSignal;

      try {
        const emitFinalResponse = async () => {
          const res = await modelClient.generateContent({ contents }, requestOptions);
          const output = buildGeminiOutput(res.response);
          if (!output) {
            throw new Error('Gemini 返回为空（可能提示词被拦截或模型无输出）');
          }
          onChunk(output);
        };

	        if (!effectiveStream) {
	          await emitFinalResponse();
	          return;
	        }

        try {
          let deliveredAny = false;
          const stream = await modelClient.generateContentStream({ contents }, requestOptions);
          for await (const chunk of stream.stream) {
            const piece = chunk.text();
            if (piece) {
              deliveredAny = true;
              onChunk(piece);
            }
          }

          const finalResponse = await stream.response;
          const { images } = extractGeminiTextAndImages(finalResponse);
          if (images.length > 0) {
            const imageMarkdown = images.map((u) => `![](${u})`).join('\n\n');
            onChunk((deliveredAny ? '\n\n' : '') + imageMarkdown);
            deliveredAny = true;
          }

          if (!deliveredAny) {
            const output = buildGeminiOutput(finalResponse);
            if (!output) {
              throw new Error('Gemini 返回为空（可能提示词被拦截或模型无输出）');
            }
            onChunk(output);
          }
          return;
        } catch (streamErr: any) {
          if (abortSignal?.aborted) {
            throw streamErr;
          }
          // Some Gemini endpoints/models reject streaming. Fallback to non-streaming.
          await emitFinalResponse();
          return;
        }
      } catch (err: any) {
        if (abortSignal?.aborted) {
          throw new Error('请求已取消');
        }
        if (err?.name === 'AbortError') {
          throw new Error('Gemini 请求超时，请稍后重试');
        }
        const message = err?.message ? String(err.message) : String(err);
        throw new Error(`Gemini 请求失败：${message}`);
      }
    }
  }

  // --- OpenAI 兼容 API ---

  const shouldStreamApi = Boolean(shouldStream);

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
    Authorization: `Bearer ${apiKey}`,
    Accept: shouldStreamApi ? 'text/event-stream' : 'application/json',
  };

  const finalApiBase = apiBase || 'https://api.openai.com';

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
    if (hasAnyInputImages) {
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
    throw new Error(message);
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
