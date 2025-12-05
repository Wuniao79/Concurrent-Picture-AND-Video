import React, { useMemo, useState } from 'react';
import { PanelLeftClose, Plus, Search, Settings, MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import { ChatColumn } from './ChatColumn';
import { LaneState, Model, Language } from '../types';
import { LaneHistoryItem } from '../utils/history';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isGridMode: boolean;
  activeLane?: LaneState;
  lanes: LaneState[];
  language: Language;
  fontSize: number;
  availableModels: Model[];
  onStartNewChat: () => void;
  onRemoveLane: (id: string) => void;
  onModelChange: (id: string, model: string) => void;
  onOpenSettings: () => void;
  showHistory: boolean;
  historyList: LaneHistoryItem[];
  activeHistoryId: string | null;
  onSelectHistory: (id: string) => void;
  onRenameHistory: (id: string, name: string) => void;
  onDeleteHistory: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isGridMode,
  activeLane,
  lanes,
  language,
  fontSize,
  availableModels,
  onStartNewChat,
  onRemoveLane,
  onModelChange,
  onOpenSettings,
  showHistory,
  historyList,
  activeHistoryId,
  onSelectHistory,
  onRenameHistory,
  onDeleteHistory,
}) => {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const sevenDaysAgo = useMemo(() => Date.now() - 7 * 24 * 60 * 60 * 1000, []);

  const filteredHistory = useMemo(() => {
    if (!normalizedSearch) return historyList;
    return historyList.filter((item) => {
      const name = item.name.toLowerCase();
      const model = item.model.toLowerCase();
      return name.includes(normalizedSearch) || model.includes(normalizedSearch);
    });
  }, [historyList, normalizedSearch]);

  const recentHistory = filteredHistory.filter(
    (item) => item.updatedAt >= sevenDaysAgo || item.createdAt >= sevenDaysAgo
  );
  const olderHistory = filteredHistory.filter((item) => !recentHistory.includes(item));

  const HistoryRow = (item: LaneHistoryItem) => {
    const isActive = item.id === activeHistoryId;
    const isMenuOpen = menuOpenId === item.id;
    return (
      <div
        key={item.id}
        onClick={() => onSelectHistory(item.id)}
        className={`relative group flex flex-col gap-1 px-3 py-2 rounded-lg cursor-pointer text-sm border ${
          isActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-white'
            : 'border-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-200/40 dark:hover:bg-gray-800/40'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="truncate font-semibold">{item.name}</span>
          <button
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(isMenuOpen ? null : item.id);
            }}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
        <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
          {language === 'zh' ? '模型' : 'Model'}: {item.model}
        </span>
        {isMenuOpen && (
          <div className="absolute right-2 top-8 z-20 w-32 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={(e) => {
                e.stopPropagation();
                const newName = prompt(language === 'zh' ? '重命名' : 'Rename', item.name);
                if (newName && newName.trim()) {
                  onRenameHistory(item.id, newName.trim());
                }
                setMenuOpenId(null);
              }}
            >
              <Edit2 size={14} /> {language === 'zh' ? '重命名' : 'Rename'}
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(language === 'zh' ? '删除这条历史吗？' : 'Delete this history?')) {
                  onDeleteHistory(item.id);
                }
                setMenuOpenId(null);
              }}
            >
              <Trash2 size={14} /> {language === 'zh' ? '删除' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const showNewChatHeader = showHistory || !isGridMode || !activeLane;

  return (
    <div
      className={`
        fixed inset-y-0 left-0 z-30 
        ${isGridMode ? 'w-[340px]' : 'w-[260px]'} 
        bg-[#f9fafb] dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}
    >
      <div className="p-3 flex items-center justify-between shrink-0 h-16">
        {showNewChatHeader ? (
          <>
            <button
              onClick={onStartNewChat}
              className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 transition-all text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm group"
            >
              <Plus
                size={16}
                className="text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
              />
              <span>{language === 'zh' ? '发起新对话' : 'New Chat'}</span>
            </button>
            <button onClick={onClose} className="p-2 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <PanelLeftClose size={20} />
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between w-full px-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <div
                className={`w-2 h-2 rounded-full ${
                  activeLane?.isThinking ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'
                }`}
              />
              <div className="font-medium text-sm truncate text-gray-700 dark:text-gray-200 max-w-[200px]">
                {activeLane ? activeLane.name : 'Select a Model'}
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <PanelLeftClose size={20} />
            </button>
          </div>
        )}
      </div>

      {showHistory ? (
        <>
          <div className="px-3 mb-2">
            <div className="relative group">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-gray-600 transition-colors"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={language === 'zh' ? '搜索历史' : 'Search history'}
                className="w-full pl-9 pr-3 py-2 bg-transparent hover:bg-gray-200/50 dark:hover:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-200 dark:focus:ring-gray-700 text-gray-600 dark:text-gray-300 placeholder-gray-400 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-6">
            <div className="space-y-4">
              {normalizedSearch ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-400 px-3">
                    {language === 'zh' ? '搜索结果' : 'Search results'}
                  </div>
                  {filteredHistory.length === 0 && (
                    <div className="px-3 text-xs text-gray-500 dark:text-gray-400">
                      {language === 'zh' ? '暂无匹配历史' : 'No matching history'}
                    </div>
                  )}
                  {filteredHistory.map((item) => HistoryRow(item))}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-400 px-3">
                      {language === 'zh' ? '最近7天' : 'Last 7 days'}
                    </div>
                    {recentHistory.length === 0 && (
                      <div className="px-3 text-xs text-gray-500 dark:text-gray-400">
                        {language === 'zh' ? '暂无记录' : 'No entries'}
                      </div>
                    )}
                    {recentHistory.map((item) => HistoryRow(item))}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-400 px-3">
                      {language === 'zh' ? '更早' : 'Earlier'}
                    </div>
                    {olderHistory.length === 0 && (
                      <div className="px-3 text-xs text-gray-500 dark:text-gray-400">
                        {language === 'zh' ? '暂无记录' : 'No entries'}
                      </div>
                    )}
                    {olderHistory.map((item) => HistoryRow(item))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      ) : isGridMode && activeLane ? (
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <ChatColumn
            lane={activeLane}
            onRemove={onRemoveLane}
            onModelChange={onModelChange}
            isMultiLane={false}
            fontSize={fontSize - 1}
            availableModels={availableModels}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4 text-center">
          <p>{language === 'zh' ? '选择模型查看对话' : 'Select a model to view chat here.'}</p>
        </div>
      )}

      <div className="p-3 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-gray-200/50 dark:hover:bg-gray-800 cursor-pointer w-full text-left transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <Settings size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {language === 'zh' ? '工具' : 'Tools'}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
