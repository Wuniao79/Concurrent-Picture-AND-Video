import { GeminiImageSettings, Message, ModelProvider, Role } from '../types';
import { generateGeminiEnterpriseResponse } from './providers/geminiEnterprise';
import { generateGeminiOfficialResponse } from './providers/geminiOfficial';
import { generateOpenAICompatibleResponse } from './providers/openaiCompat';
import {
  DEFAULT_GEMINI_TIMEOUT_MS,
  isLikelyGoogleApiKey,
  isLikelyGoogleGeminiEndpoint,
} from './providers/geminiUtils';

const parseRetryDelayMs = (message: string): number | null => {
  if (!message) return null;
  const retryDelayMatch = message.match(/retryDelay\"?\s*:\s*\"?(\d+(?:\.\d+)?)s/i);
  if (retryDelayMatch) {
    const seconds = Number.parseFloat(retryDelayMatch[1]);
    return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds * 1000)) : null;
  }
  const retryInMatch = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (retryInMatch) {
    const seconds = Number.parseFloat(retryInMatch[1]);
    return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds * 1000)) : null;
  }
  return null;
};

const getErrorMessage = (err: any): string => {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err?.message) return String(err.message);
  return String(err);
};

const extractStatusCode = (err: any, message: string): number | undefined => {
  const direct =
    typeof err?.status === 'number'
      ? err.status
      : typeof err?.statusCode === 'number'
      ? err.statusCode
      : undefined;
  if (typeof direct === 'number') return direct;
  const match = message.match(/\b(400|401|403|408|409|429|500|502|503|504)\b/);
  if (!match) return undefined;
  return Number.parseInt(match[1], 10);
};

const sleepWithAbort = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('请求已取消'));
      return;
    }
    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, Math.max(0, ms));
    const onAbort = () => {
      cleanup();
      reject(new Error('请求已取消'));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

type GeminiRequestExtras = {
  geminiEnterpriseEnabled?: boolean;
  geminiEnterpriseProjectId?: string;
  geminiEnterpriseLocation?: string;
  geminiEnterpriseToken?: string;
  geminiImageSettings?: GeminiImageSettings;
};

/**
 * 统一的生成响应函数，支持 OpenAI 兼容接口与 Gemini 官方接口（含 Vertex 企业级）。
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

  const normalizedImageDataUrls = Array.isArray(imageDataUrls) ? imageDataUrls.filter(Boolean) : [];

  const enterpriseEnabled = provider === 'gemini' && Boolean(extras?.geminiEnterpriseEnabled);
  const fallbackEnvKey =
    provider === 'gemini'
      ? (import.meta as any).env?.GEMINI_API_KEY || (import.meta as any).env?.VITE_API_KEY
      : (import.meta as any).env?.VITE_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
  const resolvedApiKey = (customApiKey && customApiKey.trim()) || fallbackEnvKey;

  if (!resolvedApiKey && !enterpriseEnabled) {
    throw new Error('未配置API Key，请在设置中填写。');
  }

  const apiKey = (resolvedApiKey || '').trim();

  // --- Gemini (official + enterprise) ---
  if (provider === 'gemini') {
    const runGeminiWithRetry = async (
      runner: (emit: (text: string) => void) => Promise<void>
    ): Promise<void> => {
      const maxRetries = 2;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        let deliveredAny = false;
        const wrappedOnChunk = (text: string) => {
          if (text) deliveredAny = true;
          onChunk(text);
        };
        try {
          await runner(wrappedOnChunk);
          return;
        } catch (err: any) {
          if (abortSignal?.aborted) throw err;
          const message = getErrorMessage(err);
          const statusCode = extractStatusCode(err, message);
          const isRateLimit =
            statusCode === 429 || /\bquota\b/i.test(message) || /\brate limit\b/i.test(message);
          if (deliveredAny || !isRateLimit || attempt >= maxRetries) {
            throw err;
          }
          const retryDelayMs = parseRetryDelayMs(message) ?? Math.min(2000 * (attempt + 1), 10000);
          await sleepWithAbort(retryDelayMs, abortSignal);
        }
      }
    };

    const timeoutEnv = Number((import.meta as any).env?.VITE_GEMINI_TIMEOUT_MS);
    const timeoutMs =
      Number.isFinite(timeoutEnv) && timeoutEnv > 0 ? timeoutEnv : DEFAULT_GEMINI_TIMEOUT_MS;

    if (enterpriseEnabled) {
      const token = (extras?.geminiEnterpriseToken || '').trim();
      const projectId = (extras?.geminiEnterpriseProjectId || '').trim();
      const location = (extras?.geminiEnterpriseLocation || '').trim() || 'us-central1';

      if (!token) {
        throw new Error('企业API缺少访问令牌（Access Token），请在设置中填写。');
      }
      if (!projectId) {
        throw new Error('企业API缺少项目 ID（Project ID），请在设置中填写。');
      }

      await runGeminiWithRetry((emit) =>
        generateGeminiEnterpriseResponse({
          model,
          historyMessages,
          userText,
          onChunk: emit,
          token,
          projectId,
          location,
          shouldStream,
          imageDataUrls: normalizedImageDataUrls,
          timeoutMs,
          abortSignal,
          customApiBase,
          imageSettings: extras?.geminiImageSettings,
        })
      );
      return;
    }

    const trimmedKey = apiKey.trim();
    const hasCustomApiUrl = Boolean(customApiBase);
    const customApiIsGoogle = isLikelyGoogleGeminiEndpoint(customApiBase);
    const keyLooksGoogle = isLikelyGoogleApiKey(trimmedKey);

    if (hasCustomApiUrl) {
      if (customApiIsGoogle) {
        await runGeminiWithRetry((emit) =>
          generateGeminiOfficialResponse({
            model,
            historyMessages,
            userText,
            onChunk: emit,
            apiKey: trimmedKey,
            shouldStream,
            imageDataUrls: normalizedImageDataUrls,
            customBaseUrl: customApiBase,
            timeoutMs,
            abortSignal,
            imageSettings: extras?.geminiImageSettings,
          })
        );
        return;
      }

      // Custom non-Google base => OpenAI-compatible proxy.
      await runGeminiWithRetry((emit) =>
        generateOpenAICompatibleResponse({
          model,
          historyMessages,
          userText,
          onChunk: emit,
          apiKey: trimmedKey,
          shouldStream,
          imageDataUrls: normalizedImageDataUrls,
          apiBase: customApiBase,
          abortSignal,
        })
      );
      return;
    }

    if (!keyLooksGoogle) {
      throw new Error('Gemini API Key 不是官方 Key，请在设置中开启自定义地址并填写兼容接口，或使用官方 Google Key（AIza...）。');
    }

    // Official Gemini API (no custom base).
    await runGeminiWithRetry((emit) =>
      generateGeminiOfficialResponse({
        model,
        historyMessages,
        userText,
        onChunk: emit,
        apiKey: trimmedKey,
        shouldStream,
        imageDataUrls: normalizedImageDataUrls,
        customBaseUrl: '',
        timeoutMs,
        abortSignal,
        imageSettings: extras?.geminiImageSettings,
      })
    );
    return;
  }

  // --- OpenAI compatible API ---
  const apiBase = customApiBase || envApiBase || '';
  await generateOpenAICompatibleResponse({
    model,
    historyMessages,
    userText,
    onChunk,
    apiKey,
    shouldStream,
    imageDataUrls: normalizedImageDataUrls,
    apiBase: apiBase || 'https://api.openai.com',
    abortSignal,
  });
}
