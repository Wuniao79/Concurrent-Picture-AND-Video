import React, { useEffect, useRef, useState } from 'react';
import { Edit2, X } from 'lucide-react';
import type { Language } from '../../types';

interface AssetNameModalProps {
  isOpen: boolean;
  language: Language;
  title?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}

export const AssetNameModal: React.FC<AssetNameModalProps> = ({
  isOpen,
  language,
  title,
  placeholder,
  defaultValue,
  confirmText,
  onCancel,
  onConfirm,
}) => {
  const t = (zh: string, en: string) => (language === 'zh' ? zh : en);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValue((defaultValue || '').trim());
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [defaultValue, isOpen]);

  if (!isOpen) return null;

  const canConfirm = Boolean(value.trim());

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[2px] px-4">
      <div className="w-full max-w-md bg-white/90 dark:bg-gray-900/90 border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Edit2 size={18} />
            </div>
            <div className="text-lg font-semibold">{title || t('命名素材', 'Name asset')}</div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="h-9 w-9 rounded-xl border border-gray-200/70 dark:border-white/10 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5"
            aria-label={t('关闭', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('素材名称', 'Asset name')}</div>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancel();
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!canConfirm) return;
                  onConfirm(value.trim());
                }
              }}
              placeholder={placeholder || t('例如：角色开场视频', 'e.g. intro video')}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5"
            >
              {t('取消', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={() => onConfirm(value.trim())}
              disabled={!canConfirm}
              className="h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {confirmText || t('保存', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

