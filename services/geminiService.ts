import { Message, Role } from '../types';

/**
 * 调用兼容 OpenAI /v1/chat/completions 的接口，支持：
 * - 文本 / 图像混合输入
 * - Sora 推理视频模型的「reasoning/thinking」流式输出
 *
 * 约定：
 * - onChunk 在流式时会被多次调用，每次仅返回「新增的一小段文本」
 * - App.tsx 负责把这些增量 chunk 叠加成完整消息
 * - 非流式模式仅回调一次，直接给完整文本
 */
export async function generateResponse(
  model: string,
  historyMessages: Message[],
  userText: string,
  onChunk: (text: string) => void,
  customApiKey?: string,
  shouldStream: boolean = true,
  imageDataUrl?: string,
  customApiUrl?: string
): Promise<void> {
  // --- 环境变量 & 配置 ---
  const apiBase =
    (customApiUrl && customApiUrl.trim()) ||
    (import.meta as any).env?.VITE_API_BASE_URL ||
    'https://api.openai.com';

  const apiKey =
    (customApiKey && customApiKey.trim()) ||
    (import.meta as any).env?.VITE_API_KEY ||
    (import.meta as any).env?.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('未配置 API Key，请在设置中填写。');
  }

  // --- 工具函数：从 content / reasoning_content 中提取文本 ---

  const extractTextFromContent = (content: any): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;

    // OpenAI vision / reasoning 等数组结构
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

    // OpenAI reasoning 模型：reasoning_content 是一个数组
    if (Array.isArray(container.reasoning_content)) {
      const t = extractTextFromContent(container.reasoning_content);
      if (t) return t;
    }

    // 有些服务可能使用 thinking 字段
    if (Array.isArray(container.thinking)) {
      const t = extractTextFromContent(container.thinking);
      if (t) return t;
    }

    if (typeof container.thinking === 'string') {
      return container.thinking;
    }

    return '';
  };

  /**
   * 兜底：深度遍历整个 JSON，收集看起来像「正文」的长文本。
   * 这是为了兼容各种非标准 Sora 返回结构，至少能把 thinking/日志展示出来。
   */
  const collectDeepText = (obj: any): string => {
    const MIN_LEN = 12;
    const IGNORE_KEYS = new Set([
      'id',
      'object',
      'model',
      'created',
      'role',
      'finish_reason',
      'type'
    ]);

    const pieces: string[] = [];

    const walk = (value: any, key?: string) => {
      if (!value) return;

      const keyLower = key?.toLowerCase() ?? '';

      if (typeof value === 'string') {
        const v = value.trim();
        if (!v) return;
        if (v.length < MIN_LEN) return;
        if (IGNORE_KEYS.has(keyLower)) return;
        // 过滤掉纯数字 / uuid 之类
        if (/^[0-9a-f\-]{6,}$/.test(v) && !v.includes(' ')) return;
        if (!pieces.includes(v)) {
          pieces.push(v);
        }
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

  // --- 将前端 Message 映射为 chat.completions 消息体 ---
  const messages: any[] = historyMessages.map((m) => {
    const base: any = {
      role: m.role === Role.USER ? 'user' : 'assistant',
      content: m.text || ''
    };

    // 历史消息里的图片目前直接忽略（只在当前轮传）
    return base;
  });

  // 当前用户消息：支持可选图像
  let userContent: any = userText;

  if (imageDataUrl) {
    // 按照 OpenAI vision/新接口格式：text + image_url 数组
    userContent = [
      { type: 'text', text: userText || '' },
      {
        type: 'image_url',
        image_url: {
          url: imageDataUrl
        }
      }
    ];
  }

  messages.push({
    role: 'user',
    content: userContent
  });

  const payload: any = {
    model,
    stream: shouldStream,
    messages
  };

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    Accept: shouldStream ? 'text/event-stream' : 'application/json'
  };

  const url = apiBase.replace(/\/$/, '') + '/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch {
      // ignore
    }
    let message = `请求失败：${response.status}`;
    if (errorText) message += ` - ${errorText}`;
    throw new Error(message);
  }

  // --- 非流式：一次性拿到全部 ---
  if (!shouldStream) {
    const json: any = await response.json();
    const choice = json?.choices?.[0];
    const msg = choice?.message ?? json?.message ?? {};

    let fullText = '';

    // 主内容
    fullText += extractTextFromContent(msg.content);

    // reasoning / thinking
    const reasoning = extractReasoningText(msg);
    if (reasoning) {
      fullText += (fullText ? '\n' : '') + reasoning;
    }

    // 兼容部分服务把日志写在最外层
    if (typeof json.log === 'string') {
      fullText += (fullText ? '\n' : '') + json.log;
    }
    if (typeof json.thinking === 'string') {
      fullText += (fullText ? '\n' : '') + json.thinking;
    }

    if (!fullText) {
      // 兜底：深度遍历 JSON，把看起来像正文的长文本提取出来
      fullText = collectDeepText(json) || JSON.stringify(json);
    }

    onChunk(fullText);
    return;
  }

  // --- 流式 SSE 处理 ---
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

    // 按空行拆分为多个 event
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

        // 标准 chat.completion.chunk 结构
        const choice = json?.choices?.[0];
        const delta = choice?.delta || choice?.message || json.delta || json.message;

        if (delta) {
          // 1) 推理 / thinking
          piece += extractReasoningText(delta);

          // 2) 主内容（包括最终 HTML，如 <video> ...）
          if (typeof delta.content === 'string') {
            piece += delta.content;
          } else if (delta.content) {
            piece += extractTextFromContent(delta.content);
          }

          // 3) 兼容字段：message / status_text / log / thinking
          if (typeof (delta as any).message === 'string') {
            piece += ((piece ? '\n' : '') + (delta as any).message);
          }
          if (typeof (delta as any).status_text === 'string') {
            piece += ((piece ? '\n' : '') + (delta as any).status_text);
          }
          if (typeof (delta as any).log === 'string') {
            piece += ((piece ? '\n' : '') + (delta as any).log);
          }
          if (typeof (delta as any).thinking === 'string') {
            piece += ((piece ? '\n' : '') + (delta as any).thinking);
          }
        }

        // 有些服务直接把 message / log / thinking 放在最外层
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
            // 兜底：遍历整个 JSON，尽量把所有「正文」提取出来
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
