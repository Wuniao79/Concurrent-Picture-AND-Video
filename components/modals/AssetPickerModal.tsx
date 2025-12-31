import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Library, Search, X } from 'lucide-react';
import type { AssetKind, AssetLibraryItem, Language } from '../../types';

interface AssetPickerModalProps {
  isOpen: boolean;
  language: Language;
  assets: AssetLibraryItem[];
  kind?: AssetKind;
  title?: string;
  onPick: (asset: AssetLibraryItem) => void;
  onClose: () => void;
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isOpen,
  language,
  assets,
  kind,
  title,
  onPick,
  onClose,
}) => {
  const t = (zh: string, en: string) => (language === 'zh' ? zh : en);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const base = Array.isArray(assets) ? assets : [];
    const q = (query || '').trim().toLowerCase();
    return base
      .filter((a) => (kind ? a.kind === kind : true))
      .filter((a) => {
        if (!q) return true;
        return (a.name || '').toLowerCase().includes(q);
      })
      .slice(0, 200);
  }, [assets, kind, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[2px] px-4">
      <div className="w-full max-w-3xl h-[78vh] bg-white/90 dark:bg-gray-900/90 border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Library size={18} />
            </div>
            <div>
              <div className="text-lg font-semibold">{title || t('从素材库选择', 'Pick from Library')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('点击条目即可选取', 'Click an item to pick')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl border border-gray-200/70 dark:border-white/10 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5"
            aria-label={t('关闭', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
              placeholder={t('搜索素材名称…', 'Search by name…')}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">
              {t('素材库为空或无匹配项', 'No assets found')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => onPick(asset)}
                  className="text-left rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-900/50 hover:bg-gray-100/70 dark:hover:bg-white/5 transition-colors overflow-hidden"
                >
                  <div className="h-32 bg-black/5 dark:bg-black/40 border-b border-gray-200/50 dark:border-white/10 overflow-hidden flex items-center justify-center">
                    {asset.kind === 'image' ? (
                      <img src={asset.src} alt={asset.name} className="h-full w-full object-cover" />
                    ) : (
                      <video
                        src={asset.src}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{asset.name}</div>
                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      {asset.kind === 'video' ? t('视频', 'Video') : t('图片', 'Image')} ·{' '}
                      {new Date(asset.updatedAt || asset.createdAt || Date.now()).toLocaleString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
