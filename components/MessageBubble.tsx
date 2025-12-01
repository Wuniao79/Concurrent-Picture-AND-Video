import React, { useState } from "react";
import { Message, Role } from "../types";
import {
  Bot,
  User,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  ChevronRight,
} from "lucide-react";

interface MessageBubbleProps {
  message: Message;
  fontSize?: number;
}

/**
 * 从 Sora 的返回里解析：
 * - 进度日志（在 <video> 前面的那一段文字）
 * - <video> 的 src
 * - Post ID（用于 Remix）
 */
function parseSoraPayload(text: string) {
  const result: {
    logsText: string | null;
    videoSrc: string | null;
    fullHtml: string | null;
    remixId: string | null;
  } = {
    logsText: null,
    videoSrc: null,
    fullHtml: null,
    remixId: null,
  };

  if (!text) return result;

  const trimmed = text.trim();
  result.fullHtml = trimmed;

  // 提取 <video src="...">
  const videoRegex =
    /<video[^>]*src=['"]([^'"]+)['"][^>]*>(?:[\s\S]*?<\/video>)?|<video[^>]*src=['"]([^'"]+)['"][^>]*\/?>/i;
  const videoMatch = trimmed.match(videoRegex);

  if (videoMatch) {
    const videoTag = videoMatch[0];
    const videoSrc = videoMatch[1] || videoMatch[2] || null;
    result.videoSrc = videoSrc;

    const idx = trimmed.indexOf(videoTag);
    if (idx > -1) {
      const before = trimmed.slice(0, idx).trim();
      result.logsText = before || null; // 这里就是你要的进度日志 + Post ID 那段文字
    }
  }

  // 提取 Post ID
  const remixMatch = trimmed.match(/Post ID:\s*([^\s]+)/i);
  if (remixMatch) {
    result.remixId = remixMatch[1];
  }

  // 如果压根没有 video，但文本看起来是 Sora 的日志 / 进度，也保留 logsText 用于折叠展示
  if (!result.videoSrc) {
    const looksLikeSoraLogs =
      /Generation Process Begins/i.test(trimmed) ||
      /Video Generation Progress/i.test(trimmed);

    if (looksLikeSoraLogs) {
      result.logsText = trimmed;
      result.fullHtml = null;
    } else {
      // 普通模型文本，走默认渲染
      result.logsText = null;
      result.fullHtml = null;
    }
  }

  return result;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  fontSize = 16,
}) => {
  const isUser = message.role === Role.USER;
  const [copied, setCopied] = useState(false);
  const [copiedRemix, setCopiedRemix] = useState(false);

  const [previewImage, setPreviewImage] = useState<string | null>(null);

const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  const { logsText, videoSrc, fullHtml, remixId } = parseSoraPayload(
    message.text
  );

  const durationSeconds =
    typeof message.generationDurationMs === 'number'
      ? (message.generationDurationMs / 1000).toFixed(1)
      : null;

  const handleCopyRemix = async () => {
    if (!remixId) return;
    try {
      await navigator.clipboard.writeText(remixId);
      setCopiedRemix(true);
      setTimeout(() => setCopiedRemix(false), 1500);
    } catch (e) {
      console.error("Copy remix failed", e);
    }
  };


  const renderModelContent = () => {
    // —— 仅有 Sora 日志（生成中，视频还未就绪） ——
    if (!videoSrc && logsText) {
      return (
        <div className="space-y-3">
          <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 px-3 py-2 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
            <summary className="flex items-center gap-1 cursor-pointer select-none text-gray-600 dark:text-gray-300">
              <ChevronRight className="w-3 h-3 inline-block" />
              <span>
                {durationSeconds
                  ? `生成成功（用时 ${durationSeconds} 秒）`
                  : '生成中...'}
              </span>
            </summary>
            <div className="mt-2 whitespace-pre-wrap">
              {logsText}
            </div>
          </details>
        </div>
      );
    }

    // —— Sora 视频消息：进度日志 + 视频 + Remix 按钮 ——
    if (videoSrc) {
      return (
        <div className="space-y-3">
          {/* 进度日志 + Post ID 文本区域（可折叠） */}
          {logsText && (
            <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 px-3 py-2 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
              <summary className="flex items-center gap-1 cursor-pointer select-none text-gray-600 dark:text-gray-300">
                <ChevronRight className="w-3 h-3 inline-block" />
                <span>
                  {durationSeconds
                    ? `生成成功（用时 ${durationSeconds} 秒）`
                    : '生成中...'}
                </span>
              </summary>
              <div className="mt-2 whitespace-pre-wrap">
                {logsText}
              </div>
            </details>
          )}

          {/* 视频播放器 */}
          <video
            src={videoSrc}
            controls
            className="w-full aspect-video max-h-[640px] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm bg-black"
          />

          <div className="mt-2">
            <button
              onClick={async () => {
                if (!videoSrc) return;
                try {
                  const response = await fetch(videoSrc);
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `video_${Date.now()}.mp4`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  console.error("下载视频失败:", err);
                }
              }}
              className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded-md border border-green-700 shadow-sm"
            >
              下载视频
            </button>
          </div>

          {/* Remix + 原始 HTML */}
          {(remixId || fullHtml) && (
            <div className="flex flex-col gap-2">
              {remixId && (
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="truncate">Post ID: {remixId}</span>
                  <button
                    onClick={handleCopyRemix}
                    className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium"
                  >
                    {copiedRemix ? "已复制" : "复制 Remix"}
                  </button>
                </div>
              )}

              {fullHtml && (
                <details className="text-xs text-gray-500 dark:text-gray-400">
                  <summary className="flex items-center gap-1 cursor-pointer select-none">
                    <ChevronRight className="w-3 h-3" />
                    <span>查看原始 HTML</span>
                  </summary>
                  <pre className="mt-1 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/60 overflow-auto text-[11px] leading-relaxed text-gray-800 dark:text-gray-200">
                    {fullHtml}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      );
    }
    // —— 普通模型文本消息 ——
    const isLongThinkingLike = () => {
      const text = message.text || '';
      if (text.length < 400) return false;
      const lowered = text.toLowerCase();
      const patterns = [
        'understanding the inquiry',
        'clarifying user intent',
        'dissecting the query',
        "i'm currently",
        "i am currently",
        'my goal is',
        'as an ai',
        "i've moved on to",
      ];
      return patterns.some((p) => lowered.includes(p));
    };

    if (isLongThinkingLike()) {
      const fullText = message.text || '';
      const parts = fullText.split(/\n{2,}/);
      if (parts.length > 1) {
        const answer = parts[parts.length - 1].trim();
        const reasoning = parts.slice(0, - 1).join('\n\n').trim();

        if (reasoning.length > 300 && answer.length > 0) {
          return (
            <>
              <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 px-3 py-2 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
                <summary className="flex items-center gap-1 cursor-pointer select-none text-gray-600 dark:text-gray-300">
                  <ChevronRight className="w-3 h-3 inline-block" />
                  <span>
                    {durationSeconds
                      ? `生成过程（用时 ${durationSeconds} 秒）`
                      : '查看生成过程 / Thinking'}
                  </span>
                </summary>
                <div
                  className="mt-2 whitespace-pre-wrap break-words"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {reasoning}
                </div>
              </details>

              <div
                className="mt-3 whitespace-pre-wrap break-words"
                style={{ fontSize: `${fontSize}px` }}
              >
                {answer}
              </div>
            </>
          );
        }
      }
      // 如果无法可靠拆分出推理和答案，就直接正常展示，避免把最终回答也收进去
    }

        const fullText = message.text || '';
    const imageMarkdownRegex = /!\[[^\]]*]\((data:image\/[a-zA-Z0-9+]+;base64,[^)]+)\)/g;
    const imageMatches = Array.from(fullText.matchAll(imageMarkdownRegex));
    const hasImages = imageMatches.length > 0;
    const strippedText = hasImages ? fullText.replace(imageMarkdownRegex, '').trim() : fullText;

    if (hasImages) {
      return (
        <div className="space-y-3">
          {strippedText && (
            <div
              className="whitespace-pre-wrap break-words"
              style={{ fontSize: `${fontSize}px` }}
            >
              {strippedText}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {imageMatches.map((m, idx) => {
              const src = m[1];

              return (
                <div key={idx} className="max-w-full flex flex-col gap-2">
                  <img
                    src={src}
                    alt={`Generated image ${idx + 1}`}
                    onClick={() => setPreviewImage(src)}
                    className="cursor-pointer rounded-xl border border-gray-700 max-h-[420px] max-w-full object-contain bg-black hover:opacity-80 transition"
                  />

                  <button
                    onClick={async () => {
                      const link = document.createElement('a');
                      link.href = src;
                      link.download = `generated_image_${idx + 1}.png`;
                      link.click();
                    }}
                    className="w-fit px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded-md border border-green-700 shadow-sm"
                  >
                    下载图片
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div
        className="whitespace-pre-wrap break-words"
        style={{ fontSize: `${fontSize}px` }}
      >
        {fullText}
      </div>
    );
  };

  return (
    <div
      className={`group flex w-full mb-6 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`flex max-w-[95%] md:max-w-[90%] lg:max-w-[85%] ${
          isUser ? "flex-row-reverse" : "flex-row"
        } gap-4`}
      >
        {/* 头像 */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-sm flex items-center justify-center ${
            isUser ? "bg-gray-500" : "bg-brand-500"
          } text-white shadow-sm`}
        >
          {isUser ? <User size={18} /> : <Bot size={18} />}
        </div>

        {/* 气泡主体 */}
        <div className="flex-1 min-w-0">
          <div
            className={`rounded-2xl px-4 py-3 shadow-sm ${
              isUser
                ? "bg-gray-900 text-gray-50"
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
            }`}
          >
            {isUser ? (
              <div
                className="whitespace-pre-wrap break-words"
                style={{ fontSize: `${fontSize}px` }}
              >
                {message.text}
              </div>
            ) : (
              renderModelContent()
            )}
          </div>

          {/* 底部小工具栏：复制 / 反馈 */}
        </div>
      </div>
    
      {/* 全屏图片预览层 */}
      {previewImage && (
        <div
          className="fixed left-0 top-0 w-screen h-screen bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative">
            <img
              src={previewImage}
              alt="preview"
              className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl object-contain"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage(null);
              }}
              className="absolute -top-4 -right-4 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold shadow-lg cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
