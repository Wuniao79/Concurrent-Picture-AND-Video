import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LaneState, Language, Model, Role } from '../types';
import { MessageBubble } from './MessageBubble';
import { Loader2, X, Sparkles, MessageSquarePlus, EyeOff, Maximize2, Minimize2 } from 'lucide-react';

interface ChatColumnProps {
	  lane: LaneState;
	  onRemove: (id: string) => void;
	  onModelChange: (id: string, model: string) => void;
	  isMultiLane: boolean;
	  fullWidth?: boolean;
	  isFullView?: boolean;
	  showPreviewToggle?: boolean;
	  isPreviewActive?: boolean;
	  onTogglePreview?: () => void;
	  downloadProxyUrl?: string;
	  cacheHistoryId?: string | null;
	  cacheLaneId?: string | null;
	  fontSize: number;
	  availableModels: Model[];
	  language?: Language;
	  laneIndex?: number;
	  concurrencyIntervalSec?: number;
	  queueStartAt?: number | null;
}

export const ChatColumn: React.FC<ChatColumnProps> = ({
	  lane,
	  onRemove,
	  onModelChange,
	  isMultiLane,
	  fullWidth,
	  isFullView,
	  showPreviewToggle,
	  isPreviewActive,
	  onTogglePreview,
	  downloadProxyUrl,
	  cacheHistoryId,
	  cacheLaneId,
	  fontSize,
	  availableModels,
	  language,
	  laneIndex,
	  concurrencyIntervalSec,
	  queueStartAt,
	}) => {
	  const scrollRef = useRef<HTMLDivElement>(null);
	  const fullViewMode = Boolean(isFullView);
	  const showHeader = !fullViewMode || showPreviewToggle;
	  const currentModel = availableModels.find((m) => m.id === lane.model) || availableModels[0];
	  const interval = typeof concurrencyIntervalSec === 'number' && Number.isFinite(concurrencyIntervalSec) ? concurrencyIntervalSec : 0;
	  const scheduledAt = useMemo(() => {
	    if (typeof laneIndex !== 'number' || laneIndex < 1 || interval <= 0 || typeof queueStartAt !== 'number') return 0;
	    return queueStartAt + laneIndex * interval * 1000;
	  }, [laneIndex, interval, queueStartAt]);
	  const [now, setNow] = useState(() => Date.now());

	  useEffect(() => {
	    if (scrollRef.current) {
	      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
	    }
	  }, [lane.messages, lane.isThinking]);

	  useEffect(() => {
	    if (!scheduledAt || scheduledAt <= Date.now()) return;
	    setNow(Date.now());
	    const timer = window.setInterval(() => {
	      const tick = Date.now();
	      setNow(tick);
	      if (tick >= scheduledAt) {
	        window.clearInterval(timer);
	      }
	    }, 1000);
	    return () => window.clearInterval(timer);
	  }, [scheduledAt]);

	  const remainingMs = scheduledAt > 0 ? scheduledAt - now : 0;
	  const showQueue = remainingMs > 0;
	  const formatClockTime = (timestamp: number) => {
	    const locale = language === 'zh' || language === 'system' ? 'zh-CN' : 'en-US';
	    try {
	      return new Date(timestamp).toLocaleTimeString(locale, { hour12: false });
	    } catch {
	      return '';
	    }
	  };
	  const formatRemaining = (ms: number) => {
	    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
	    const minutes = Math.floor(totalSeconds / 60);
	    const seconds = totalSeconds % 60;
	    if (minutes > 0) return `${minutes}m${String(seconds).padStart(2, '0')}s`;
	    return `${seconds}s`;
	  };
	  const queuedLabel = showQueue
	    ? `${language === 'zh' || language === 'system' ? '预计' : 'ETA'} ${formatClockTime(
	        scheduledAt
	      )} (${formatRemaining(remainingMs)})`
	    : '';

	  const lastModelMsg = [...lane.messages].reverse().find((m) => m.role === Role.MODEL);
	  const awaitingFirstChunk = Boolean(lane.isThinking && lastModelMsg && !(lastModelMsg.text || '').trim());
	  const baseStartAt =
	    scheduledAt > 0 ? scheduledAt : typeof queueStartAt === 'number' && Number.isFinite(queueStartAt) ? queueStartAt : 0;
	  const waitingMs = baseStartAt > 0 ? now - baseStartAt : 0;
	  const showPendingHint = Boolean(awaitingFirstChunk && !showQueue && waitingMs >= 8000);

  // Check if the latest user message has an image but the model doesn't support vision
  const latestUserMsg = [...lane.messages].reverse().find(m => m.role === Role.USER);
  const latestUserImages =
    latestUserMsg?.images && latestUserMsg.images.length > 0
      ? latestUserMsg.images
      : latestUserMsg?.image
      ? [latestUserMsg.image]
      : [];
  const showVisionWarning = latestUserImages.length > 0 && currentModel && !currentModel.vision;
  const assistantLabel = currentModel?.name || lane.model;

  return (
    <div
      className={`app-panel flex flex-col h-full bg-white dark:bg-gray-900 ${
        isMultiLane
          ? 'border-r border-gray-200 dark:border-gray-800 min-w-0 w-full'
          : fullWidth
          ? 'w-full'
          : 'w-full max-w-4xl mx-auto'
      }`}
    >
      
      {/* Column Header */}
      {showHeader && (
        <div className="app-panel h-14 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 bg-white dark:bg-gray-900 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-md ${
                isMultiLane ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300' : 'bg-transparent text-gray-800 dark:text-gray-200'
              }`}
            >
              {isMultiLane ? <Sparkles size={16} /> : null}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[200px]">
                  {assistantLabel}
                </span>
                {currentModel && !currentModel.vision && (
                  <span className="text-gray-400 dark:text-gray-500" title="No Vision Support">
                    <EyeOff size={12} />
                  </span>
                )}
              </div>
              {isMultiLane && (
                <span className="text-[10px] text-gray-400 font-medium uppercase">Temperature: {lane.temperature}</span>
              )}
            </div>
          </div>

          {(isMultiLane || showPreviewToggle) && (
            <div className="flex items-center gap-1">
              {showPreviewToggle && onTogglePreview && (
                <button
                  onClick={onTogglePreview}
                  className={`p-1.5 rounded-md transition-colors ${
                    isPreviewActive
                      ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  title={isPreviewActive ? 'Exit preview' : 'Full preview'}
                  aria-label={isPreviewActive ? 'Exit preview' : 'Full preview'}
                >
                  {isPreviewActive ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              )}
              {isMultiLane && (
                <button
                  onClick={() => onRemove(lane.id)}
                  className="text-gray-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Close Panel"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className={`flex-1 overflow-y-auto space-y-2 scroll-smooth custom-scrollbar ${fullViewMode ? 'p-4 pt-2' : 'p-4'}`}
      >
        {lane.messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-300 select-none">
             <MessageSquarePlus size={48} className="mb-4 opacity-20" />
          </div>
        )}

        {lane.messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            fontSize={fullViewMode && msg.role === Role.MODEL ? Math.max(12, fontSize - 2) : fontSize}
            assistantLabel={assistantLabel}
            showAssistantLabel={fullViewMode && msg.role === Role.MODEL}
            language={language}
            downloadProxyUrl={downloadProxyUrl}
            cacheHistoryId={cacheHistoryId}
            cacheLaneId={cacheLaneId}
          />
        ))}

        {showVisionWarning && (
             <div className="mx-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg text-xs text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                 <EyeOff size={12} />
                 <span>This model cannot see images. The image was not sent.</span>
             </div>
        )}

	        {/* Thinking Indicator */}
	        {lane.isThinking && (
	          <div className="flex justify-start w-full">
	             <div className="flex items-center gap-3 px-4 py-3">
	                <div className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm">
	                   <Loader2 size={14} className="animate-spin text-brand-600" />
	                </div>
	                <div className="flex flex-col min-w-0">
	                  <span className="text-sm text-gray-400 animate-pulse">
	                    {showQueue
	                      ? language === 'zh' || language === 'system'
	                        ? '排队中...'
	                        : 'Queued...'
	                      : language === 'zh' || language === 'system'
	                      ? '生成中...'
	                      : 'Generating...'}
	                  </span>
	                  {queuedLabel && (
	                    <span className="text-[10px] text-gray-400 truncate block">{queuedLabel}</span>
	                  )}
	                  {showPendingHint && (
	                    <span className="text-[10px] text-gray-400 truncate block">
	                      {language === 'zh' || language === 'system'
	                        ? '长时间无输出：可能被浏览器/中转并发限制排队'
	                        : 'No output yet: may be queued by browser/proxy connection limits'}
	                    </span>
	                  )}
	                </div>
	             </div>
	          </div>
	        )}

        {/* Error Display */}
        {lane.error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-400 text-sm mt-2 flex items-start gap-2">
             <div className="w-2 h-2 rounded-full bg-red-500 mt-2" />
             <div className="flex-1 min-w-0 break-words">{lane.error}</div>
             {typeof lane.errorCode === 'number' && lane.errorCode >= 400 && (
               <div className="text-xs font-semibold text-red-500 dark:text-red-400 whitespace-nowrap">
                 [{lane.errorCode}]
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};
