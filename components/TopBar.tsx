import React, { useEffect } from 'react';
import { History, Maximize2, Menu, Minimize2, PanelLeft, Settings, Trash2 } from 'lucide-react';
import { ApiMode, Language, Model, ModelModality } from '../types';

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
  showHistoryButton: boolean;
  isHistoryOpen: boolean;
  onToggleHistory: () => void;
  modelModalityFilter: ModelModality | null;
  onToggleModelModalityFilter: (next: ModelModality | null) => void;
  apiMode: ApiMode;
  setApiMode: (mode: ApiMode) => void;
  onOpenSettings: () => void;
  isFullView: boolean;
  onToggleFullView: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  language,
  isSidebarOpen,
  onOpenSidebar,
  onToggleSidebar,
  availableModels,
  selectedModelId,
  onSelectModel,
  confirmAndClearChats,
  showHistoryButton,
  isHistoryOpen,
  onToggleHistory,
  modelModalityFilter,
  onToggleModelModalityFilter,
  apiMode,
  setApiMode,
  onOpenSettings,
  isFullView,
  onToggleFullView,
}) => {
  const resolveModelModality = (model: Model): ModelModality => {
    if (model.modality) return model.modality;
    const id = (model.id || '').toLowerCase();
    if (id.includes('sora-video')) return 'video';
    if (id.includes('image')) return 'image';
    return 'text';
  };

  const filteredModels =
    apiMode === 'gemini'
      ? availableModels.filter((m) => m.provider === 'gemini')
      : availableModels.filter((m) => !m.provider || m.provider === 'openai');

  const filteredByModality = modelModalityFilter
    ? filteredModels.filter((m) => resolveModelModality(m) === modelModalityFilter)
    : filteredModels;

  useEffect(() => {
    if (!modelModalityFilter) return;
    if (filteredModels.length > 0 && filteredByModality.length === 0) {
      onToggleModelModalityFilter(null);
    }
  }, [modelModalityFilter, filteredModels.length, filteredByModality.length, onToggleModelModalityFilter]);

  const currentSelectedExists = filteredByModality.some((m) => m.id === selectedModelId);
  const effectiveSelectedId = currentSelectedExists ? selectedModelId : filteredByModality[0]?.id || selectedModelId;

  useEffect(() => {
    if (!effectiveSelectedId) return;
    if (effectiveSelectedId !== selectedModelId) {
      onSelectModel(effectiveSelectedId);
    }
  }, [effectiveSelectedId, selectedModelId, onSelectModel]);

  const appName = language === 'zh' ? '枭化物' : 'XiaoHuaWu';
  const appVersion = 'v4.3';

  return (
    <header
      className={`app-topbar h-16 flex items-center px-4 sticky top-0 bg-white dark:bg-gray-900 z-20 gap-4 ${
        isFullView ? '' : 'border-b border-gray-300 dark:border-gray-800'
      }`}
    >
      {/* Left: logo/name */}
      <div className="flex items-center gap-3 shrink-0 min-w-0">
        {!isSidebarOpen && (
          <button
            onClick={onOpenSidebar}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            aria-label={language === 'zh' ? '打开侧边栏' : 'Open sidebar'}
          >
            <PanelLeft size={20} />
          </button>
        )}
        <div className="md:hidden">
          <button onClick={onToggleSidebar} className="p-2 text-gray-500" aria-label={language === 'zh' ? '菜单' : 'Menu'}>
            <Menu size={20} />
          </button>
        </div>
        <h1 className="font-bold text-gray-900 dark:text-white hidden md:flex items-center gap-2 truncate">
          <span>{appName}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{appVersion}</span>
        </h1>
      </div>

      {/* Center: filters, model select, fullscreen, history */}
      <div className="flex-1 min-w-0 flex items-center justify-center gap-3 flex-nowrap overflow-x-auto scrollbar-hide">
        <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1 border border-gray-300 dark:border-gray-700 h-10">
          {[
            { id: 'video', label: language === 'zh' ? '视频' : 'Video' },
            { id: 'image', label: language === 'zh' ? '图片' : 'Image' },
            { id: 'text', label: language === 'zh' ? '文字' : 'Text' },
          ].map((item) => {
            const isActive = modelModalityFilter === item.id;
            const activeClass =
              item.id === 'video'
                ? 'bg-purple-600 text-white shadow-sm'
                : item.id === 'image'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-700 text-white shadow-sm';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  onToggleModelModalityFilter(modelModalityFilter === item.id ? null : (item.id as ModelModality))
                }
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  isActive ? activeClass : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 rounded-lg p-1 border border-gray-300 dark:border-gray-700 h-10">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2">
            {language === 'zh' ? '选择模型' : 'Model'}:
          </span>
          <select
            onChange={(e) => onSelectModel(e.target.value)}
            className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer py-1 px-1 min-w-[200px]"
            value={effectiveSelectedId}
          >
            {filteredByModality.map((m) => (
              <option key={m.id} value={m.id} className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onToggleFullView}
          className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
            isFullView
              ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600'
          }`}
          title={
            language === 'zh'
              ? isFullView
                ? '退出全屏'
                : '全屏视图'
              : isFullView
              ? 'Exit fullscreen'
              : 'Fullscreen view'
          }
          aria-label={
            language === 'zh'
              ? isFullView
                ? '退出全屏'
                : '进入全屏'
              : isFullView
              ? 'Exit fullscreen'
              : 'Enter fullscreen'
          }
        >
          {isFullView ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>

        {showHistoryButton && (
          <button
            onClick={onToggleHistory}
            className={`flex items-center gap-1.5 px-3 h-10 text-sm font-medium rounded-lg border transition-colors ${
              isHistoryOpen
                ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={language === 'zh' ? '打开侧边栏的并发历史面板' : 'Open history panel in sidebar'}
          >
            <History size={14} />
            <span className="hidden sm:inline">{language === 'zh' ? '并发历史' : 'History'}</span>
          </button>
        )}
      </div>

      {/* Right: clear, mode, settings */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        <button
          onClick={confirmAndClearChats}
          className="flex items-center gap-1 px-3 h-9 text-sm font-medium rounded-md text-red-500 border border-gray-300 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title={language === 'zh' ? '清空所有对话' : 'Clear all chats'}
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">{language === 'zh' ? '清空' : 'Clear'}</span>
        </button>

        <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1 border border-gray-300 dark:border-gray-700 h-9">
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
          aria-label={language === 'zh' ? '设置' : 'Settings'}
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
