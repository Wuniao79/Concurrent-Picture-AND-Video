import React, { useState } from 'react';
import { MoreHorizontal, Trash2, Edit2 } from 'lucide-react';
import { LaneHistoryItem, } from '../utils/history';
import { Language } from '../types';

interface HistoryListProps {
  items: LaneHistoryItem[];
  activeId: string | null;
  language: Language;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ items, activeId, language, onSelect, onRename, onDelete }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const startEdit = (item: LaneHistoryItem) => {
    setEditingId(item.id);
    setDraftName(item.name);
  };

  const commitEdit = () => {
    if (editingId) {
      onRename(editingId, draftName || 'Untitled');
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <div
            key={item.id}
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
              isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
            }`}
            onClick={() => onSelect(item.id)}
          >
            <div className="flex flex-col">
              {editingId === item.id ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="bg-transparent border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm"
                />
              ) : (
                <div
                  className="font-semibold text-gray-800 dark:text-gray-100"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEdit(item);
                  }}
                >
                  {item.name}
                </div>
              )}
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {language === 'zh' ? '模型' : 'Model'}: {item.model}
              </div>
            </div>
            <div className="relative">
              <details className="group">
                <summary className="list-none">
                  <button
                    className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </summary>
                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg z-10">
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(item);
                    }}
                  >
                    <Edit2 size={14} /> {language === 'zh' ? '重命名' : 'Rename'}
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(language === 'zh' ? '确认删除该历史？' : 'Delete this history?')) {
                        onDelete(item.id);
                      }
                    }}
                  >
                    <Trash2 size={14} /> {language === 'zh' ? '删除' : 'Delete'}
                  </button>
                </div>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
};
