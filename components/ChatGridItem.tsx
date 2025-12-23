import React, { useEffect, useMemo, useState } from 'react';
import { LaneState, Language } from '../types';

interface ChatGridItemProps {
  lane: LaneState;
  laneIndex: number;
  concurrencyIntervalSec?: number;
  queueStartAt?: number | null;
  language?: Language;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
}

export const ChatGridItem: React.FC<ChatGridItemProps> = ({
  lane,
  laneIndex,
  concurrencyIntervalSec,
  queueStartAt,
  language,
  isActive,
  onClick,
  onDoubleClick,
}) => {
  const hasHttpError = typeof lane.errorCode === 'number' && lane.errorCode >= 400;
  const hasError = Boolean(lane.error) || hasHttpError;
  const interval = typeof concurrencyIntervalSec === 'number' ? concurrencyIntervalSec : 0;
  const scheduledAt = useMemo(() => {
    if (laneIndex < 1 || interval <= 0 || typeof queueStartAt !== 'number') return 0;
    return queueStartAt + laneIndex * interval * 1000;
  }, [queueStartAt, laneIndex, interval]);
  const [now, setNow] = useState(() => Date.now());

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

  return (
    <div 
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`
        chat-grid-card
        cursor-pointer
        bg-white dark:bg-gray-800 
        border rounded-xl p-4 h-24 flex flex-col justify-center relative group hover:shadow-md transition-all
        ${isActive 
          ? 'border-brand-500 dark:border-brand-500 ring-2 ring-brand-500/20' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
      `}
    >
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 overflow-hidden">
                {/* Status Light */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    hasError
                      ? 'bg-red-500'
                      : (typeof lane.progress === 'number' && lane.progress < 100) || lane.isThinking
                      ? 'bg-yellow-400 animate-pulse'
                      : 'bg-green-500'
                }`} />
                <span className="font-medium text-sm text-gray-700 dark:text-gray-200 truncate" title={lane.name}>
                    {lane.name}
                </span>
                {typeof lane.progress === 'number' && (
                  <span className="ml-2 text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    [{lane.progress}%]
                  </span>
                )}
                {hasHttpError && (
                  <span className="ml-2 text-[11px] text-red-500 dark:text-red-400 whitespace-nowrap">
                    [{lane.errorCode}]
                  </span>
                )}
            </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-400 truncate block">{lane.model}</span>
          {queuedLabel && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {queuedLabel}
            </span>
          )}
        </div>
    </div>
  );
};
