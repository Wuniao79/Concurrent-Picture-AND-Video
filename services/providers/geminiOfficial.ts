import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message } from '../../types';
import { buildGeminiOutput, createGeminiContents, extractGeminiTextAndImages, looksLikeImageOutputModel } from './geminiShared';
import { normalizeGeminiBaseUrl } from './geminiUtils';

type GeminiOfficialOptions = {
  model: string;
  historyMessages: Message[];
  userText: string;
  onChunk: (text: string) => void;
  apiKey: string;
  shouldStream: boolean;
  imageDataUrls?: string[];
  customBaseUrl?: string;
  timeoutMs: number;
  abortSignal?: AbortSignal;
};

export const generateGeminiOfficialResponse = async ({
  model,
  historyMessages,
  userText,
  onChunk,
  apiKey,
  shouldStream,
  imageDataUrls,
  customBaseUrl,
  timeoutMs,
  abortSignal,
}: GeminiOfficialOptions): Promise<void> => {
  const trimmedKey = (apiKey || '').trim();
  const geminiBaseUrl = normalizeGeminiBaseUrl(customBaseUrl);
  const wantsImageOutput = looksLikeImageOutputModel(model);
  const effectiveStream = Boolean(shouldStream && !wantsImageOutput);

  const client = new GoogleGenerativeAI(trimmedKey);
  const contents = createGeminiContents(historyMessages, userText, imageDataUrls);

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
      if (abortSignal?.aborted) throw streamErr;
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
};

