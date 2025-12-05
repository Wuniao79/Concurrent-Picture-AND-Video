import React from 'react';
import { Menu, PanelLeft, Settings, Trash2 } from 'lucide-react';
import { ApiMode, Language, Model } from '../types';

interface TopBarProps {
  language: Language;
  isSidebarOpen: boolean;
  isGridMode: boolean;
  onOpenSidebar: () => void;
  onToggleSidebar: () => void;
  availableModels: Model[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  confirmAndClearChats: () => void;
  laneCountInput: string;
  updateLaneCount: (value: string) => void;
  laneLocked: boolean;
  onToggleLaneLock: () => void;
  relayEnabled: boolean;
  relays: { id: string; name: string }[];
  activeRelayId: string;
  onSelectRelay: (id: string) => void;
  geminiKeysEnabled: boolean;
  geminiKeys: { id: string; name: string }[];
  activeGeminiKeyId: string;
  onSelectGeminiKey: (id: string) => void;
  apiMode: ApiMode;
  setApiMode: (mode: ApiMode) => void;
  onOpenSettings: () => void;
  onToggleHistory: () => void;
  isHistoryOpen: boolean;
  showHistoryButton: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  language,
  isSidebarOpen,
  isGridMode,
  onOpenSidebar,
  onToggleSidebar,
  availableModels,
  selectedModelId,
  onSelectModel,
  confirmAndClearChats,
  laneCountInput,
  updateLaneCount,
  laneLocked,
  onToggleLaneLock,
  relayEnabled,
  relays,
  activeRelayId,
  onSelectRelay,
  geminiKeysEnabled,
  geminiKeys,
  activeGeminiKeyId,
  onSelectGeminiKey,
  apiMode,
  setApiMode,
  onOpenSettings,
  onToggleHistory,
  isHistoryOpen,
  showHistoryButton,
}) => {
  const filteredModels =
    apiMode === 'gemini'
      ? availableModels.filter((m) => m.provider === 'gemini')
      : availableModels.filter((m) => !m.provider || m.provider === 'openai');

  const currentSelectedExists = filteredModels.some((m) => m.id === selectedModelId);
  const effectiveSelectedId = currentSelectedExists
    ? selectedModelId
    : filteredModels[0]?.id || selectedModelId;

  const appName = language === 'zh' ? '枭化物' : 'XiaoHuaWu';
  const appVersion = '2.2-V1';
  const showRelaySelect = apiMode === 'openai' && relayEnabled && relays.length > 0;
  const showGeminiKeySelect = apiMode === 'gemini' && geminiKeysEnabled && geminiKeys.length > 0;

  return (
    <header className="h-16 flex items-center justify-between px-4 sticky top-0 bg-white dark:bg-gray-900 z-20 border-b border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-3 w-1/4">
        {!isSidebarOpen && (
          <button
            onClick={onOpenSidebar}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <PanelLeft size={20} />
          </button>
        )}
        <div className="md:hidden">
          <button onClick={onToggleSidebar} className="p-2 text-gray-500">
            <Menu size={20} />
          </button>
        </div>
        <h1 className="font-bold text-gray-900 dark:text-white hidden md:block truncate flex items-center gap-2">
          <span>{appName}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{appVersion}</span>
        </h1>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1 border border-gray-200 dark:border-gray-700 h-9 gap-2">
        {(showRelaySelect || showGeminiKeySelect) && (
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg px-2 h-7 border border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {apiMode === 'openai'
                ? language === 'zh'
                  ? '选择中转站'
                  : 'Relay'
                : language === 'zh'
                ? '更多密钥'
                : 'Extra Keys'}
            </span>
            <select
              value={apiMode === 'openai' ? activeRelayId || '' : activeGeminiKeyId || ''}
              onChange={(e) =>
                apiMode === 'openai' ? onSelectRelay(e.target.value) : onSelectGeminiKey(e.target.value)
              }
              className="bg-transparent text-xs font-medium text-gray-800 dark:text-gray-100 focus:outline-none cursor-pointer dark:bg-gray-800 dark:text-white"
            >
              <option value="">{language === 'zh' ? '默认' : 'Default'}</option>
              {(apiMode === 'openai' ? relays : geminiKeys).map((item) => {
                const isDark =
                  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
                return (
                  <option
                    key={item.id}
                    value={item.id}
                    style={isDark ? { backgroundColor: '#1f2937', color: '#fff' } : undefined}
                  >
                    {item.name}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2">
          {language === 'zh' ? '选择模型' : 'Model'}:
        </span>
        <select
          onChange={(e) => onSelectModel(e.target.value)}
          className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer py-1 px-1 min-w-[220px]"
          value={effectiveSelectedId}
        >
          {filteredModels.map((m) => (
            <option key={m.id} value={m.id} className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
              {m.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-800">
          <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg px-2 h-7 border border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-1 hidden sm:inline">
              {language === 'zh' ? '并发数' : 'Lanes'}
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={laneCountInput}
              onChange={(e) => updateLaneCount(e.target.value)}
              disabled={laneLocked}
              className={`bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none w-12 pl-1 text-center ${
                laneLocked ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <button
            onClick={onToggleLaneLock}
            className={`px-3 h-7 rounded-lg text-sm font-medium border transition-colors ${
              laneLocked
                ? 'bg-gray-700 text-white border-gray-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {language === 'zh' ? (laneLocked ? '取消' : '锁定') : laneLocked ? 'Unlock' : 'Lock'}
          </button>
        </div>

        {showHistoryButton && (
          <button
            onClick={onToggleHistory}
            className={`flex items-center gap-1 px-3 h-8 text-sm font-medium border rounded-lg transition-colors ${
              isHistoryOpen
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={language === 'zh' ? '并发历史' : 'History'}
          >
            {language === 'zh' ? '并发历史' : 'History'}
          </button>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 w-auto">
        <button
          onClick={confirmAndClearChats}
          className="flex items-center gap-1 px-3 h-9 text-sm font-medium text-red-500 border border-gray-200 dark:border-gray-700 transition-colors mr-2"
          title={language === 'zh' ? '清空所有对话' : 'Clear All Chats'}
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">{language === 'zh' ? '清空' : 'Clear'}</span>
        </button>
        <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1 border border-gray-200 dark:border-gray-700 h-9 ml-2">
          <button
            type="button"
            onClick={() => setApiMode('openai')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              apiMode === 'openai' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            OpenAI
          </button>
          <button
            type="button"
            onClick={() => setApiMode('gemini')}
            className={`ml-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
              apiMode === 'gemini' ? 'bg-yellow-400 text-gray-900 shadow-sm' : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            Gemini
          </button>
        </div>
        <button
          onClick={onOpenSettings}
          className="flex items-center justify-center w-9 h-9 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
