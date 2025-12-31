import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssetKind, Language, Message, Role } from "../types";
import { Bot, User, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { fetchBlobWithProxy } from "../utils/download";
import { buildImageCacheId, getImageCacheRecord, putImageCacheRecord } from "../utils/imageCache";
import { parseSoraPayload } from "../utils/parseSoraPayload";
import { isVideoReadyFromText } from "../utils/isVideoReady";
import { addAssetLibraryBlobItem } from "../utils/assetLibrary";
import { AssetNameModal } from "./modals/AssetNameModal";

const EMPTY_SORA_PARSE = Object.freeze({
  logsText: null as string | null,
  videoSrc: null as string | null,
  fullHtml: null as string | null,
  remixId: null as string | null,
});

interface MessageBubbleProps {
  message: Message;
  fontSize?: number;
  assistantLabel?: string;
  showAssistantLabel?: boolean;
  language?: Language;
  downloadProxyUrl?: string;
  cacheHistoryId?: string | null;
  cacheLaneId?: string | null;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  fontSize = 16,
  assistantLabel,
  showAssistantLabel = false,
  language = "zh",
  downloadProxyUrl,
  cacheHistoryId,
  cacheLaneId,
}) => {
  const isUser = message.role === Role.USER;
  const [copiedRemix, setCopiedRemix] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [assetDraft, setAssetDraft] = useState<{ kind: AssetKind; src: string; defaultName: string } | null>(null);
  const [assetToast, setAssetToast] = useState<string | null>(null);
  const manualCopyInputRef = useRef<HTMLInputElement | null>(null);
  const shouldShowAssistantLabel = !isUser && showAssistantLabel && !!assistantLabel;
  const fullText = message.text || "";
  const assetToastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (assetToastTimerRef.current) {
        window.clearTimeout(assetToastTimerRef.current);
        assetToastTimerRef.current = null;
      }
    };
  }, []);

  const showAssetToast = (text: string, durationMs: number | null = 1500) => {
    if (!text) return;
    setAssetToast(text);
    if (assetToastTimerRef.current) window.clearTimeout(assetToastTimerRef.current);
    assetToastTimerRef.current = null;
    if (durationMs == null || durationMs <= 0) return;
    assetToastTimerRef.current = window.setTimeout(() => {
      setAssetToast(null);
      assetToastTimerRef.current = null;
    }, durationMs);
  };

  const openAddToLibrary = (kind: AssetKind, src: string, defaultName: string) => {
    const safeSrc = (src || "").trim();
    if (!safeSrc) return;
    setAssetDraft({ kind, src: safeSrc, defaultName: (defaultName || "").trim() || "asset" });
  };

  const extractMarkdownImages = (text: string) => {
    if (!text) return [] as string[];
    const results: string[] = [];
    const regex = /!\[[^\]]*]\((\S+?)(?:\s+["'][^"']*["'])?\)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) results.push(match[1]);
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

  const stripMarkdownImages = (text: string) => {
    if (!text) return '';
    return text.replace(/!\[[^\]]*]\((\S+?)(?:\s+["'][^"']*["'])?\)/g, '').trim();
  };

  const stripInlineImageData = (text: string) => {
    if (!text) return '';
    return text.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, '').trim();
  };

  const resolveImageExtension = (src: string, mimeType?: string) => {
    if (mimeType) {
      const cleaned = mimeType.toLowerCase().split(';')[0];
      if (cleaned.startsWith('image/')) {
        const ext = cleaned.replace('image/', '');
        if (ext === 'jpeg') return 'jpg';
        if (ext.includes('+xml')) return 'svg';
        if (ext) return ext;
      }
    }
    if (src.startsWith('data:image/')) {
      const match = /^data:image\/([^;]+);/i.exec(src);
      return match?.[1]?.toLowerCase() || 'png';
    }
    const cleaned = src.split('?')[0].split('#')[0];
    const lastDot = cleaned.lastIndexOf('.');
    if (lastDot !== -1) {
      const ext = cleaned.slice(lastDot + 1).toLowerCase();
      if (ext && ext.length <= 5) return ext;
    }
    return 'png';
  };

  const handleDownloadImage = async (src: string, nameBase: string, cacheId?: string) => {
    let cachedBlob: Blob | null = null;
    if (cacheId) {
      const cached = await getImageCacheRecord(cacheId);
      if (cached?.blob) {
        cachedBlob = cached.blob;
      }
    }
    const ext = resolveImageExtension(src, cachedBlob?.type);
    const filename = `${nameBase}.${ext}`;
    if (cachedBlob) {
      const url = window.URL.createObjectURL(cachedBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      return;
    }
    if (src.startsWith('data:image/')) {
      const link = document.createElement('a');
      link.href = src;
      link.download = filename;
      link.click();
      return;
    }
    try {
      const blob = await fetchBlobWithProxy(src, downloadProxyUrl);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      if (cacheId && cacheHistoryId && cacheLaneId) {
        await putImageCacheRecord({
          id: cacheId,
          historyId: cacheHistoryId,
          laneId: cacheLaneId,
          messageId: message.id,
          imageIndex: 0,
          source: src,
          createdAt: Date.now(),
          mimeType: blob.type || '',
          blob,
        });
      }
    } catch (err) {
      console.error('下载图片失败:', err);
      window.open(src, '_blank', 'noopener,noreferrer');
    }
  };

  const normalizeMarkdown = (text: string) => {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    let inFence = false;
    const normalized = lines.map((line) => {
      const fence = line.trimStart().startsWith("```");
      if (fence) {
        inFence = !inFence;
        return line.trimEnd();
      }
      if (inFence) return line;
      // 防止模型缩进导致整段被当成 code block，去掉前置多余空格
      return line.replace(/^\s{2,}/, " ").replace(/\s+$/g, "");
    });
    return normalized.join("\n").trim();
  };

  const renderMarkdownContent = (content: string) => (
    <div className="markdown-body" style={{ fontSize: `${fontSize}px` }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ inline, className, children, ...props }: any) {
          if (inline) {
            return (
              <code className="markdown-inline-code" {...props}>
                {children}
              </code>
            );
          }
          return (
            <pre className="markdown-pre">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          );
          },
          a({ children, ...props }: any) {
          return (
            <a {...props} target="_blank" rel="noreferrer">
              {children}
            </a>
          );
          },
          img({ src, alt, ...props }: any) {
          return (
            <img
              {...props}
              src={src || ""}
              alt={alt || ""}
              className="max-w-full rounded-lg border border-gray-200 dark:border-gray-800"
            />
          );
          },
          table({ children }: any) {
          return (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          );
          },
        }}
      >
        {normalizeMarkdown(content)}
      </ReactMarkdown>
    </div>
  );

  const shouldParseSora = useMemo(() => {
    if (isUser) return false;
    if (!fullText) return false;
    if (isVideoReadyFromText(fullText)) return true;
    return /Generation Process Begins|Video Generation Progress|Post\s*ID|Remix\s*ID|post_id|postId|data-post-id/i.test(
      fullText
    );
  }, [isUser, fullText]);

  const { logsText, videoSrc, fullHtml, remixId } = useMemo(() => {
    if (!shouldParseSora) return EMPTY_SORA_PARSE;
    return parseSoraPayload(fullText);
  }, [shouldParseSora, fullText]);

  const durationSeconds =
    typeof message.generationDurationMs === "number"
      ? (message.generationDurationMs / 1000).toFixed(1)
      : null;
  const isVideoMessage = Boolean(videoSrc);

  const handleCopyRemix = useCallback(async () => {
    if (!remixId) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(remixId);
      setCopiedRemix(true);
      setTimeout(() => setCopiedRemix(false), 1500);
    } catch (e) {
      console.error("Copy remix failed", e);
      setCopyError("复制失败：请手动复制下方内容（可能未授予剪贴板权限）");
      window.setTimeout(() => manualCopyInputRef.current?.select(), 30);
    }
  }, [remixId]);

  const [videoDownloading, setVideoDownloading] = useState(false);
  const [videoDownloadError, setVideoDownloadError] = useState<string | null>(null);
  const handleDownloadVideo = useCallback(async () => {
    if (!videoSrc) return;
    setVideoDownloadError(null);
    setVideoDownloading(true);
    try {
      const blob = await fetchBlobWithProxy(videoSrc, downloadProxyUrl);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video_${Date.now()}.mp4`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("下载视频失败:", err);
      setVideoDownloadError("下载失败：可尝试打开原链接或检查代理/跨域限制");
      try {
        window.open(videoSrc, "_blank", "noopener,noreferrer");
      } catch {
        // ignore
      }
    } finally {
      setVideoDownloading(false);
    }
  }, [videoSrc, downloadProxyUrl]);

  const handleOpenSourceVideo = useCallback(() => {
    if (!videoSrc) return;
    const url = videoSrc.trim();
    if (!url) return;

    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      try {
        window.open(url, "_blank");
      } catch {
        // ignore
      }
    }
  }, [videoSrc]);

  const messageImages =
    Array.isArray(message.images) && message.images.length > 0
      ? message.images.filter(Boolean)
      : message.image
      ? [message.image]
      : [];
  const markdownImages = extractMarkdownImages(fullText);
  const inlineImages = extractInlineImagesFromText(fullText);
  const allImages = Array.from(new Set([...messageImages, ...markdownImages, ...inlineImages]));
  const shouldStrip = markdownImages.length > 0 || inlineImages.length > 0;
  const strippedText = shouldStrip ? stripInlineImageData(stripMarkdownImages(fullText)) : fullText;
  const imageCacheReady = Boolean(cacheHistoryId && cacheLaneId && message.id);
  const imageCacheKey = allImages.join('|');
  const cachedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!imageCacheReady || allImages.length === 0 || isUser) return;
    let cancelled = false;
    const run = async () => {
      for (let idx = 0; idx < allImages.length; idx += 1) {
        if (cancelled) return;
        const src = allImages[idx];
        const cacheId = buildImageCacheId(cacheHistoryId as string, cacheLaneId as string, message.id, idx);
        if (cachedIdsRef.current.has(cacheId)) continue;
        cachedIdsRef.current.add(cacheId);
        const existing = await getImageCacheRecord(cacheId);
        if (existing?.blob) continue;
        try {
          const blob = await fetchBlobWithProxy(src, downloadProxyUrl);
          await putImageCacheRecord({
            id: cacheId,
            historyId: cacheHistoryId as string,
            laneId: cacheLaneId as string,
            messageId: message.id,
            imageIndex: idx,
            source: src,
            createdAt: Date.now(),
            mimeType: blob.type || '',
            blob,
          });
        } catch {
          // ignore caching errors
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [imageCacheKey, imageCacheReady, cacheHistoryId, cacheLaneId, message.id, downloadProxyUrl, isUser, allImages]);

  const renderModelContent = () => {
    // 仅有 Sora 日志（生成中，视频未就绪）
    if (!videoSrc && logsText) {
      return (
        <div className="space-y-3">
          <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 px-3 py-2 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
            <summary className="flex items-center gap-1 cursor-pointer select-none text-gray-600 dark:text-gray-300">
              <ChevronRight className="w-3 h-3 inline-block" />
              <span>
                {durationSeconds
                  ? `生成成功（用时${durationSeconds} 秒）`
                  : "生成中..."}
              </span>
            </summary>
            <div className="mt-2">{renderMarkdownContent(logsText)}</div>
          </details>
        </div>
      );
    }

    // Sora 视频消息：进度日志 + 视频 + Remix 按钮
    if (videoSrc) {
      return (
        <div className="space-y-3">
          {logsText && (
            <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 px-3 py-2 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
              <summary className="flex items-center gap-1 cursor-pointer select-none text-gray-600 dark:text-gray-300">
                <ChevronRight className="w-3 h-3 inline-block" />
                <span>
                  {durationSeconds
                    ? `生成成功（用时${durationSeconds} 秒）`
                    : "生成中..."}
                </span>
              </summary>
              <div className="mt-2">{renderMarkdownContent(logsText)}</div>
            </details>
          )}

           <video
             src={videoSrc}
             controls
             className="w-full aspect-video max-h-[70vh] min-h-[220px] rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm bg-black"
           />

              <div className="mt-2 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleDownloadVideo}
                    disabled={videoDownloading}
                    className={`px-3 py-1 text-white text-xs rounded-md border shadow-sm ${
                      videoDownloading
                        ? "bg-green-700 border-green-800 opacity-70 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-500 border-green-700"
                    }`}
                  >
                    {videoDownloading ? "下载中..." : "下载视频"}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenSourceVideo}
                    className="px-3 py-1 text-white text-xs rounded-md border border-blue-700 shadow-sm bg-blue-600 hover:bg-blue-500"
                  >
                    源视频打开
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddToLibrary("video", videoSrc, `video_${Date.now()}`)}
                    className="px-3 py-1 text-white text-xs rounded-md border border-purple-700 shadow-sm bg-purple-600 hover:bg-purple-500"
                  >
                    添加到素材库
                  </button>
                </div>
                {videoDownloadError && (
                  <div className="text-[11px] text-red-500 flex flex-wrap items-center gap-2">
                    <span className="break-words">{videoDownloadError}</span>
                    <button onClick={handleOpenSourceVideo} className="underline hover:text-red-400">
                      打开原链接
                    </button>
                  </div>
                )}
                {assetToast && <div className="text-[11px] text-emerald-500">{assetToast}</div>}
              </div>

          {(remixId || fullHtml) && (
            <div className="flex flex-col gap-2">
              {remixId && (
                <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">Post ID: {remixId}</span>
                    <button
                      onClick={handleCopyRemix}
                      className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium whitespace-nowrap"
                    >
                      {copiedRemix ? "已复制" : "复制 Remix"}
                    </button>
                  </div>
                  {copyError && (
                    <div className="text-[11px] text-red-500 space-y-1">
                      <div>{copyError}</div>
                      <div className="flex items-center gap-2">
                        <input
                          ref={manualCopyInputRef}
                          value={remixId}
                          readOnly
                          onFocus={(e) => e.currentTarget.select()}
                          className="flex-1 min-w-0 px-2 py-1 rounded border border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                        />
                        <button
                          onClick={() => manualCopyInputRef.current?.select()}
                          className="px-2 py-1 rounded border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          选择
                        </button>
                      </div>
                    </div>
                  )}
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

    // 普通模型文本消息
    const shouldCollapseReasoning = (text: string) => {
      const prefixPatterns = [
        /^\s*\*{1,3}\s*Decoding\b/i,
        /^\s*\*{1,3}\s*Decoding the Greeting\b/i,
        /^\s*\*{1,3}\s*Decoding "Hello"/i,
        /^\s*\*{1,3}\s*Considering\b/i,
        /^\s*\*{1,3}\s*Generating\b/i,
        /^\s*\*{1,3}\s*Expanding\b/i,
        /^\s*\*{1,3}\s*Examining the Core Query\b/i,
        /^\s*\*{1,3}\s*Initiating Analysis Process\b/i,
      ];
      return prefixPatterns.some((p) => p.test(text));
    };

    const isLongThinkingLike = () => {
      const text = message.text || "";
      if (text.length < 400) return false;
      const lowered = text.toLowerCase();
      const patterns = [
        "understanding the inquiry",
        "clarifying user intent",
        "dissecting the query",
        "i'm currently",
        "i am currently",
        "my goal is",
        "as an ai",
        "i've moved on to",
      ];
      return patterns.some((p) => lowered.includes(p));
    };

    if (shouldCollapseReasoning(fullText)) {
      return (
        <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 px-3 py-2 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
          <summary className="flex items-center gap-1 cursor-pointer select-none text-gray-600 dark:text-gray-300">
            <ChevronRight className="w-3 h-3 inline-block" />
            <span>
              {durationSeconds
                ? `思考过程（用时 ${durationSeconds} 秒）`
                : "已折叠思考过程"}
            </span>
          </summary>
          <div className="mt-2">{renderMarkdownContent(fullText)}</div>
        </details>
      );
    }

    if (isLongThinkingLike()) {
      const parts = fullText.split(/\n{2,}/);
      if (parts.length > 1) {
        const answer = parts[parts.length - 1].trim();
        const reasoning = parts.slice(0, -1).join("\n\n").trim();

        if (reasoning.length > 300 && answer.length > 0) {
          return (
            <>
              <details className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 px-3 py-2 text-xs leading-relaxed text-gray-700 dark:text-gray-200">
                <summary className="flex items-center gap-1 cursor-pointer select-none text-gray-600 dark:text-gray-300">
                  <ChevronRight className="w-3 h-3 inline-block" />
                  <span>
                    {durationSeconds
                      ? `生成过程（用时${durationSeconds} 秒）`
                      : "查看生成过程 / Thinking"}
                  </span>
                </summary>
                <div className="mt-2">{renderMarkdownContent(reasoning)}</div>
              </details>

              <div className="mt-3">{renderMarkdownContent(answer)}</div>
            </>
          );
        }
      }
    }

    if (allImages.length > 0) {
      return (
        <div className="space-y-3">
          {strippedText && <div>{renderMarkdownContent(strippedText)}</div>}
          <div className="flex flex-wrap gap-3">
            {allImages.map((src, idx) => {
              const labelIndex = idx + 1;
              const timestamp = typeof message.timestamp === 'number' ? message.timestamp : Date.now();
              const nameBase = `generated_image_${timestamp}_${String(labelIndex).padStart(2, '0')}`;
              const cacheId =
                imageCacheReady && cacheHistoryId && cacheLaneId
                  ? buildImageCacheId(cacheHistoryId, cacheLaneId, message.id, idx)
                  : undefined;

              return (
                <div key={idx} className="max-w-full flex flex-col gap-2">
                  <img
                    src={src}
                    alt={`Generated image ${idx + 1}`}
                    onClick={() => setPreviewImage(src)}
                    className="cursor-pointer rounded-xl border border-gray-700 max-h-[420px] max-w-full object-contain bg-black hover:opacity-80 transition"
                  />

                  <button
                    onClick={() => handleDownloadImage(src, nameBase, cacheId)}
                    className="w-fit px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded-md border border-green-700 shadow-sm"
                  >
                    下载图片 {labelIndex}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddToLibrary("image", src, nameBase)}
                    className="w-fit px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md border border-blue-700 shadow-sm"
                  >
                    添加到素材库
                  </button>
                </div>
              );
            })}
          </div>
          {assetToast && <div className="text-[11px] text-emerald-500">{assetToast}</div>}
        </div>
      );
    }

    return renderMarkdownContent(fullText);
  };

  const renderUserContent = () => {
    const userText = message.text || '';
    const cleaned = stripInlineImageData(stripMarkdownImages(userText)).trim();
    const lineCount = cleaned ? cleaned.split('\n').filter(Boolean).length : 0;
    const shouldCollapse = cleaned.length > 120 || lineCount > 4;
    if (!shouldCollapse || !cleaned) {
      return renderMarkdownContent(userText);
    }
    const previewBase = cleaned.replace(/\s+/g, ' ');
    const preview = previewBase.length > 60 ? `${previewBase.slice(0, 60)}…` : previewBase;
    return (
      <details className="rounded-lg border border-gray-700/60 bg-gray-900/40 px-3 py-2 text-sm text-gray-100">
        <summary className="cursor-pointer select-none text-gray-200 flex items-center gap-2">
          <span className="text-xs font-semibold">已收起</span>
          <span className="text-[10px] text-gray-400 truncate" title={preview}>
            {preview}
          </span>
        </summary>
        <div className="mt-2">{renderMarkdownContent(userText)}</div>
      </details>
    );
  };

  return (
    <div
      className={`group flex w-full mb-6 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`flex flex-col ${
          isVideoMessage
            ? "w-full max-w-full"
            : "max-w-[95%] md:max-w-[90%] lg:max-w-[85%]"
        } ${isUser ? "items-end" : "items-start"}`}
      >
        {shouldShowAssistantLabel && (
          <div className="mb-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-700 dark:text-gray-200 truncate">
              {assistantLabel}
            </span>
          </div>
        )}

        <div className={`flex ${isUser ? "flex-row-reverse" : "flex-row"} gap-4`}>
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-sm flex items-center justify-center ${
              isUser ? "bg-gray-500" : "bg-brand-500"
            } text-white shadow-sm`}
          >
            {isUser ? <User size={18} /> : <Bot size={18} />}
          </div>

          <div className="flex-1 min-w-0">
            <div
              className={`rounded-2xl px-4 py-3 shadow-sm ${
                isUser
                  ? "bg-gray-900 text-gray-50"
                  : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
              }`}
            >
              {isUser ? renderUserContent() : renderModelContent()}
            </div>
          </div>
        </div>
      </div>

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

      <AssetNameModal
        isOpen={Boolean(assetDraft)}
        language={language}
        defaultValue={assetDraft?.defaultName || ""}
        onCancel={() => setAssetDraft(null)}
        onConfirm={(name) => {
          const draft = assetDraft;
          if (!draft) return;
          setAssetDraft(null);
          showAssetToast(language === 'zh' ? '正在保存到素材库…' : 'Saving to library…', null);
          void (async () => {
            try {
              const blob = await fetchBlobWithProxy(draft.src, downloadProxyUrl);
              const created = await addAssetLibraryBlobItem({ kind: draft.kind, name, blob });
              showAssetToast(created ? (language === 'zh' ? '已添加到素材库' : 'Added to library') : language === 'zh' ? '添加失败' : 'Failed');
            } catch (e: any) {
              const msg = String(e?.message || e || '');
              showAssetToast(
                language === 'zh' ? `添加失败：${msg || '未知错误'}` : `Failed: ${msg || 'Unknown error'}`,
                2200
              );
            }
          })();
        }}
      />
    </div>
  );
};
