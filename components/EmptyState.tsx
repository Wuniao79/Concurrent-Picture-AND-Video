import React from 'react';
import { ArrowUp } from 'lucide-react';
import { Language } from '../types';

interface EmptyStateProps {
  language: Language;
  onSendQuickPrompt: (text: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ language, onSendQuickPrompt }) => {
  const cards = [
    {
      title: language === 'zh' ? '总结文章' : 'Summarize Text',
      desc: language === 'zh' ? '总结下面文章' : 'Summarize the article below',
      prompt: language === 'zh' ? '请帮我总结这篇文章的要点。' : 'Please summarize the key points of this article.',
    },
    {
      title: language === 'zh' ? '解释概念' : 'Explain Concept',
      desc: language === 'zh' ? '向初学者解释这个概念' : 'Explain this to a beginner',
      prompt: language === 'zh' ? '请像对待初学者一样解释量子纠缠。' : 'Explain quantum entanglement to a beginner.',
    },
    {
      title: language === 'zh' ? '写代码' : 'Code Expert',
      desc: language === 'zh' ? '编写一个 Python 脚本' : 'Write a Python script',
      prompt: language === 'zh' ? '请帮我写一个Python脚本来实现文件批量重命名。' : 'Write a Python script to batch rename files.',
    },
    {
      title: language === 'zh' ? '从图片提取文字' : 'OCR',
      desc: language === 'zh' ? '从附加的图片中提取文字' : 'Extract text from image',
      prompt: language === 'zh' ? '请分析这张图片并提取其中的文字。' : 'Please extract text from the attached image.',
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
            onClick={() => onSendQuickPrompt(card.prompt)}
            className="p-5 bg-gray-100/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl text-left transition-colors h-40 flex flex-col justify-between group border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
          >
            <div>
              <div className="font-medium text-gray-900 dark:text-white mb-1">{card.title}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{card.desc}</div>
            </div>
            <div className="flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded text-gray-500 dark:text-gray-300 shadow-sm">
                {language === 'zh' ? '提示' : 'Prompt'}
              </span>
              <div className="p-1.5 bg-white dark:bg-gray-700 rounded-md shadow-sm text-gray-400 dark:text-gray-300">
                <ArrowUp size={12} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
