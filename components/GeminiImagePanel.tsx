import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GeminiAspectRatio, GeminiImageSettings, GeminiResolution, Language } from '../types';

const RES_OPTIONS: GeminiResolution[] = ['1K', '2K', '4K'];
const RATIO_OPTIONS: { value: GeminiAspectRatio; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '21:9', label: '21:9' },
  { value: '16:9', label: '16:9' },
  { value: '3:2', label: '3:2' },
  { value: '4:3', label: '4:3' },
  { value: '5:4', label: '5:4' },
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
  { value: '3:4', label: '3:4' },
  { value: '2:3', label: '2:3' },
  { value: '9:16', label: '9:16' },
];

interface GeminiImagePanelProps {
  language: Language;
  isOpen: boolean;
  onToggle: () => void;
  settings: GeminiImageSettings;
  onChange: (next: GeminiImageSettings) => void;
}

export const GeminiImagePanel: React.FC<GeminiImagePanelProps> = ({
  language,
  isOpen,
  onToggle,
  settings,
  onChange,
}) => {
  const panelContent = (
    <div className="w-[280px] sm:w-[300px] max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-gray-900/90 shadow-xl p-4">
      <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
        {language === 'zh' ? '绘图设置' : 'Image Settings'}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {language === 'zh' ? '仅在 Gemini 模式生效' : 'Gemini mode only'}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {language === 'zh' ? '总开关' : 'Master switch'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {language === 'zh' ? '关闭时不发送参数' : 'Off = do not send params'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...settings, enabled: !settings.enabled })}
          className={`h-7 w-12 rounded-full p-1 transition-colors ${
            settings.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
          }`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white shadow-sm block transition-transform ${
              settings.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className={`${settings.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
          {language === 'zh' ? '分辨率' : 'Resolution'}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {RES_OPTIONS.map((res) => (
            <button
              key={res}
              type="button"
              onClick={() => onChange({ ...settings, resolution: res })}
              className={`h-9 rounded-xl border text-xs font-semibold ${
                settings.resolution === res
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white/80 dark:bg-gray-800/60 border-gray-200/70 dark:border-white/10 text-gray-600 dark:text-gray-300'
              }`}
            >
              {res}
            </button>
          ))}
        </div>

        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
          {language === 'zh' ? '长宽比（默认 Auto）' : 'Aspect ratio (Auto)'}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {RATIO_OPTIONS.map((ratio) => (
            <button
              key={ratio.value}
              type="button"
              onClick={() => onChange({ ...settings, aspectRatio: ratio.value })}
              className={`h-12 rounded-xl border text-[11px] font-semibold flex items-center justify-center ${
                settings.aspectRatio === ratio.value
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white/80 dark:bg-gray-800/60 border-gray-200/70 dark:border-white/10 text-gray-600 dark:text-gray-300'
              }`}
            >
              {ratio.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2">
      {isOpen && panelContent}
      <button
        type="button"
        onClick={onToggle}
        className="h-9 w-9 rounded-full border border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-gray-900/90 text-gray-600 dark:text-gray-300 flex items-center justify-center shadow-md"
        aria-label={language === 'zh' ? '绘图设置' : 'Image settings'}
      >
        {isOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </div>
  );
};

