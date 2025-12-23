import { GeminiImageSettings, Message, Role } from '../../types';
import { createHttpError } from '../httpError';
import { buildGeminiOutput, createGeminiContents, extractGeminiTextAndImages, looksLikeImageOutputModel } from './geminiShared';
import { isLikelyGoogleGeminiEndpoint, normalizeGeminiBaseUrl } from './geminiUtils';

type GeminiEnterpriseOptions = {
  model: string;
  historyMessages: Message[];
  userText: string;
  onChunk: (text: string) => void;
  token: string;
  projectId: string;
  location: string;
  shouldStream: boolean;
  imageDataUrls?: string[];
  timeoutMs: number;
  abortSignal?: AbortSignal;
  customApiBase?: string;
  imageSettings?: GeminiImageSettings;
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

const historyHasImages = (historyMessages: Message[]) =>
  historyMessages.some(
    (m) => m.role === Role.USER && ((Array.isArray(m.images) && m.images.length > 0) || Boolean(m.image))
  );

export const generateGeminiEnterpriseResponse = async ({
  model,
  historyMessages,
  userText,
  onChunk,
  token,
  projectId,
  location,
  shouldStream,
  imageDataUrls,
  timeoutMs,
  abortSignal,
  customApiBase,
  imageSettings,
}: GeminiEnterpriseOptions): Promise<void> => {
  const normalizedImageDataUrls = Array.isArray(imageDataUrls) ? imageDataUrls.filter(Boolean) : [];
  const hasAnyInputImages = normalizedImageDataUrls.length > 0 || historyHasImages(historyMessages);
  const wantsImageOutput = looksLikeImageOutputModel(model);
  const effectiveImageSettings = imageSettings?.enabled ? imageSettings : undefined;
  const shouldStreamEnterprise = Boolean(shouldStream && !hasAnyInputImages && !wantsImageOutput);

  const origin =
    (!isLikelyGoogleGeminiEndpoint(customApiBase) ? normalizeGeminiBaseUrl(customApiBase) : '') ||
    `https://${location}-aiplatform.googleapis.com`;
  const endpointBase = origin.replace(/\/$/, '');

  const contents = createGeminiContents(historyMessages, userText, normalizedImageDataUrls);
  const payload: any = { contents };
  if (wantsImageOutput) {
    const generationConfig: any = { responseModalities: ['TEXT', 'IMAGE'] };
    if (effectiveImageSettings) {
      generationConfig.imageConfig = {
        imageSize: effectiveImageSettings.resolution,
      };
      if (effectiveImageSettings.aspectRatio && effectiveImageSettings.aspectRatio !== 'auto') {
        generationConfig.imageConfig.aspectRatio = effectiveImageSettings.aspectRatio;
      }
    }
    payload.generationConfig = generationConfig;
  }

  const requestOnce = async (stream: boolean) => {
    const methodPath = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    const url = `${endpointBase}/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(
      location
    )}/publishers/google/models/${encodeURIComponent(model)}:${methodPath}`;

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
      throw createHttpError(
        res.status,
        `企业API请求失败: ${res.status}${errorText ? ` - ${errorText}` : ''}`,
        errorText
      );
    }

    const json = await res.json();
    const output = buildGeminiOutput(json);
    if (!output) {
      throw new Error('企业API返回为空（可能提示词被拦截或模型无输出）');
    }
    onChunk(output);
  };

  try {
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
          throw createHttpError(
            res.status,
            `企业API请求失败: ${res.status}${errorText ? ` - ${errorText}` : ''}`,
            errorText
          );
        }
        await streamGeminiSse(res, onChunk);
        return;
      } catch (err: any) {
        if (abortSignal?.aborted) {
          throw new Error('请求已取消');
        }
        // Fallback to non-streaming for flaky SSE or unsupported models.
        await runNonStream();
        return;
      }
    }

    await runNonStream();
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
};
