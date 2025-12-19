import React from 'react';
import { LaneState } from '../types';

interface ChatGridItemProps {
  lane: LaneState;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
}

export const ChatGridItem: React.FC<ChatGridItemProps> = ({ lane, isActive, onClick, onDoubleClick }) => {
  const hasHttpError = lane.errorCode === 400 || lane.errorCode === 401 || lane.errorCode === 500;
  const hasError = Boolean(lane.error) || hasHttpError;

  return (
    <div 
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`
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
        <span className="text-[10px] text-gray-400 truncate block">{lane.model}</span>
    </div>
  );
};
