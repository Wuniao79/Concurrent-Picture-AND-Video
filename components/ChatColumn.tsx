import React, { useRef, useEffect } from 'react';
import { LaneState, Model } from '../types';
import { MessageBubble } from './MessageBubble';
import { Loader2, X, Sparkles, MoreHorizontal, MessageSquarePlus, EyeOff } from 'lucide-react';

interface ChatColumnProps {
  lane: LaneState;
  onRemove: (id: string) => void;
  onModelChange: (id: string, model: string) => void;
  isMultiLane: boolean;
  fontSize: number;
  availableModels: Model[];
}

export const ChatColumn: React.FC<ChatColumnProps> = ({ lane, onRemove, onModelChange, isMultiLane, fontSize, availableModels }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentModel = availableModels.find(m => m.id === lane.model);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lane.messages, lane.isThinking]);

  // Check if the latest user message has an image but the model doesn't support vision
  const latestUserMsg = [...lane.messages].reverse().find(m => m.role === 'user');
  const showVisionWarning = latestUserMsg?.image && currentModel && !currentModel.vision;

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 ${isMultiLane ? 'border-r border-gray-200 dark:border-gray-800 min-w-[420px] w-full md:w-[520px]' : 'w-full max-w-4xl mx-auto'}`}>
      
      {/* Column Header */}
      <div className="h-14 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${isMultiLane ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300' : 'bg-transparent text-gray-800 dark:text-gray-200'}`}>
             {isMultiLane ? <Sparkles size={16} /> : null}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
                <select 
                value={lane.model}
                onChange={(e) => onModelChange(lane.id, e.target.value)}
                className="bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors max-w-[180px] truncate"
                >
                {availableModels.map(m => (
                    <option key={m.id} value={m.id} className="bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">
                    {m.name}
                    </option>
                ))}
                </select>
                {currentModel && !currentModel.vision && (
                     <span className="text-gray-400 dark:text-gray-500" title="No Vision Support">
                        <EyeOff size={12} />
                     </span>
                )}
            </div>
            {isMultiLane && <span className="text-[10px] text-gray-400 font-medium uppercase">Temperature: {lane.temperature}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <MoreHorizontal size={16} />
          </button>
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
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth custom-scrollbar"
      >
        {lane.messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-300 select-none">
             <MessageSquarePlus size={48} className="mb-4 opacity-20" />
          </div>
        )}

        {lane.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} fontSize={fontSize} />
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
                <span className="text-sm text-gray-400 animate-pulse">生成中...</span>
             </div>
          </div>
        )}

        {/* Error Display */}
        {lane.error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-lg text-red-600 dark:text-red-400 text-sm mt-2 flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-red-500" />
             {lane.error}
          </div>
        )}
      </div>
    </div>
  );
};