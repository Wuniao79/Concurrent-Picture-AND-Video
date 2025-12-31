import React, { useMemo, useState } from 'react';
import { Images, Library, Pencil, Trash2, Video } from 'lucide-react';
import type { AssetKind, AssetLibraryItem, Language } from '../types';
import { useAssetLibrary } from '../hooks/useAssetLibrary';
import { AssetNameModal } from './modals/AssetNameModal';

interface AssetLibraryPanelProps {
  language: Language;
  onToast?: (message: string) => void;
}

export const AssetLibraryPanel: React.FC<AssetLibraryPanelProps> = ({ language, onToast }) => {
  const t = (zh: string, en: string) => (language === 'zh' ? zh : en);
  const { items, stats, remove, update, clear } = useAssetLibrary();
  const [filter, setFilter] = useState<'all' | AssetKind>('all');
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<AssetLibraryItem | null>(null);

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return items
      .filter((it) => (filter === 'all' ? true : it.kind === filter))
      .filter((it) => {
        if (!q) return true;
        return (it.name || '').toLowerCase().includes(q);
      });
  }, [filter, items, query]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Library size={18} />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{t('素材库', 'Asset Library')}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('本地存储：不会上传到服务器', 'Local storage: never uploaded')}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const ok = window.confirm(
              t('确定清空素材库吗？该操作不可撤销。', 'Clear all assets? This cannot be undone.')
            );
            if (!ok) return;
            clear();
            onToast?.(t('已清空', 'Cleared'));
          }}
          disabled={stats.total <= 0}
          className="h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('清空', 'Clear')}
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2">
          {(
            [
              { id: 'all' as const, label: `${t('全部', 'All')} (${stats.total})`, icon: <Library size={14} /> },
              { id: 'video' as const, label: `${t('视频', 'Video')} (${stats.video})`, icon: <Video size={14} /> },
              { id: 'image' as const, label: `${t('图片', 'Image')} (${stats.image})`, icon: <Images size={14} /> },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`h-9 px-3 rounded-xl text-sm font-semibold border transition-colors inline-flex items-center gap-2 ${
                filter === tab.id
                  ? 'bg-gray-200 dark:bg-gray-700 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 md:flex md:justify-end">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('搜索名称…', 'Search name…')}
            className="w-full md:w-[320px] h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center text-sm text-gray-400">
          {t('暂无素材。你可以在生成结果里点击“添加到素材库”。', 'No assets yet. Use “Add to Library” on outputs.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-900/50 overflow-hidden"
            >
              <div className="h-44 bg-black/5 dark:bg-black/40 border-b border-gray-200/50 dark:border-white/10 overflow-hidden flex items-center justify-center">
                {asset.kind === 'image' ? (
                  <img src={asset.src} alt={asset.name} className="h-full w-full object-cover" />
                ) : (
                  <video src={asset.src} controls preload="metadata" className="h-full w-full object-cover bg-black" />
                )}
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{asset.name}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {asset.kind === 'video' ? t('视频', 'Video') : t('图片', 'Image')} ·{' '}
                      {new Date(asset.updatedAt || asset.createdAt || Date.now()).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setRenaming(asset)}
                      className="h-9 w-9 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 inline-flex items-center justify-center"
                      title={t('重命名', 'Rename')}
                      aria-label={t('重命名', 'Rename')}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ok = window.confirm(
                          t(`确定删除「${asset.name}」吗？`, `Delete "${asset.name}"?`)
                        );
                        if (!ok) return;
                        remove(asset.id);
                        onToast?.(t('已删除', 'Deleted'));
                      }}
                      className="h-9 w-9 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-300 hover:bg-red-50/80 dark:hover:bg-red-900/20 inline-flex items-center justify-center"
                      title={t('删除', 'Delete')}
                      aria-label={t('删除', 'Delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AssetNameModal
        isOpen={Boolean(renaming)}
        language={language}
        title={t('重命名素材', 'Rename')}
        defaultValue={renaming?.name || ''}
        onCancel={() => setRenaming(null)}
        onConfirm={(name) => {
          const target = renaming;
          if (!target) return;
          update(target.id, { name });
          setRenaming(null);
          onToast?.(t('已保存', 'Saved'));
        }}
      />
    </div>
  );
};
