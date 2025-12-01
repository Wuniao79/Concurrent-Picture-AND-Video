import React, { useRef, useState } from 'react';
import { ArrowUp, Mic, Image as ImageIcon, X, Settings } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string, image: string | null) => void;
  language: 'en' | 'zh' | 'system';
  isGenerating: boolean;
  onOpenSettings?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, language, isGenerating, onOpenSettings }) => {
  const [promptInput, setPromptInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTriggerSend();
    }
  };

  const handleTriggerSend = () => {
    if ((!promptInput.trim() && !selectedImage) || isGenerating) return;
    onSend(promptInput, selectedImage);
    setPromptInput('');
    setSelectedImage(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-3xl mx-auto relative w-full">
        {/* Image Preview */}
        {selectedImage && (
            <div className="relative mb-2 inline-block">
                <img src={selectedImage} alt="Preview" className="h-20 w-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm" />
                <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                >
                    <X size={12} />
                </button>
            </div>
        )}

        <div className="relative bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-[26px] shadow-sm focus-within:ring-1 focus-within:ring-gray-300 dark:focus-within:ring-gray-600 focus-within:border-gray-400 dark:focus-within:border-gray-500 transition-all">
            <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={language === 'zh' ? "询问任何问题 (输入 /help 查看所有命令)" : "Ask anything..."}
                className="w-full bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 px-12 py-4 pr-12 text-base resize-none max-h-48 min-h-[56px] focus:outline-none rounded-[26px]"
                rows={1}
                style={{ height: 'auto', minHeight: '56px' }}
            />
            
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageSelect}
            />
            
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute left-4 bottom-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                title="Upload Image"
            >
                <ImageIcon size={20} />
            </button>

            <div className="absolute right-3 bottom-2.5 flex items-center gap-2">
                <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <Mic size={18} />
                </button>
                <button 
                    onClick={handleTriggerSend}
                    disabled={(!promptInput.trim() && !selectedImage) || isGenerating}
                    className={`
                        w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200
                        ${(promptInput.trim() || selectedImage)
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-black shadow-md hover:bg-gray-700 dark:hover:bg-gray-200' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}
                    `}
                >
                    {isGenerating ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin" />
                    ) : (
                        <ArrowUp size={16} />
                    )}
                </button>
            </div>
        </div>
        
        {/* Tools / Settings Button (Restored) */}
        <div className="flex items-center justify-between mt-2 px-2">
            <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                {onOpenSettings && (
                    <button 
                        onClick={onOpenSettings}
                        className="flex items-center gap-1.5 text-xs hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                        <Settings size={12} />
                        <span>{language === 'zh' ? '工具' : 'Tools'}</span>
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};