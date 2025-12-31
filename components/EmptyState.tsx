import React from 'react';
import { Film, Image, Sparkles, Layers } from 'lucide-react';
import { Language, ToolView } from '../types';

interface EmptyStateProps {
  language: Language;
  onOpenTool: (tool: ToolView) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ language, onOpenTool }) => {
  const cards = [
    {
      id: 'slicer' as ToolView,
      title: language === 'zh' ? '图片分割工厂' : 'Image Slicer',
      desc: language === 'zh' ? '切片、九宫格、一键导出' : 'Slice images into grids',
      icon: Image,
      enabled: true,
    },
    {
      id: 'videoFrames' as ToolView,
      title: language === 'zh' ? '提取视频首尾帧' : 'Video Frames',
      desc: language === 'zh' ? '上传 30 秒内视频并导出首/尾帧' : 'Extract first/last frame',
      icon: Film,
      enabled: true,
    },
    {
      id: 'xhs' as ToolView,
      title: language === 'zh' ? 'XHS 灵感实验室' : 'XHS Lab',
      desc: language === 'zh' ? '灵感输入与内容结构输出' : 'Idea to outline',
      icon: Sparkles,
      enabled: true,
    },
    {
      id: 'more' as ToolView,
      title: language === 'zh' ? '更多功能' : 'More Tools',
      desc: language === 'zh' ? '敬请期待' : 'Coming soon',
      icon: Layers,
      enabled: false,
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
      <div className="mb-12 text-center">
        <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
          {language === 'zh' ? '欢迎使用并发创作工作站' : 'How can I help you today?'}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {cards.map((card, i) => (
          <button
            key={i}
            onClick={() => card.enabled && onOpenTool(card.id)}
            disabled={!card.enabled}
            className={`p-5 rounded-2xl text-left transition-colors h-40 flex flex-col justify-between group border ${
              card.enabled
                ? 'bg-gray-100/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200/70 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600'
                : 'bg-gray-100/30 dark:bg-gray-800/30 border-gray-200/50 dark:border-gray-800/60 opacity-60 cursor-default'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400">
                <card.icon size={18} />
                <span className="text-xs uppercase tracking-wide">{language === 'zh' ? '工具' : 'Tool'}</span>
              </div>
              <div className="font-medium text-gray-900 dark:text-white mb-1">{card.title}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{card.desc}</div>
            </div>
            <div className="flex justify-end items-center text-xs text-gray-400 dark:text-gray-500">
              {card.enabled ? (language === 'zh' ? '点击进入' : 'Enter') : language === 'zh' ? '即将开放' : 'Soon'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
