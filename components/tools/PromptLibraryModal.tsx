import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignJustify,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  PenLine,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Language } from '../../types';

type PromptItem = {
  id?: string;
  title?: string;
  prompt?: string;
  preview?: string;
  mode?: string;
  category?: string;
  subCategory?: string;
  author?: string;
  link?: string;
  source?: 'custom';
};

type CategoryFilter = '全部' | '工作' | '生活' | '学习' | '有趣' | 'NSFW';
type ChipFilter = 'all' | 'recent' | 'favorites' | 'custom' | 'generate' | 'edit';
type PromptMode = 'generate' | 'edit';

const PROMPT_SOURCES = [
  'https://raw.githubusercontent.com/glidea/banana-prompt-quicker/refs/heads/main/prompts.json',
  'https://cdn.jsdelivr.net/gh/glidea/banana-prompt-quicker@main/prompts.json',
  'https://fastly.jsdelivr.net/gh/glidea/banana-prompt-quicker@main/prompts.json',
  'http://gh.halonice.com/https://raw.githubusercontent.com/glidea/banana-prompt-quicker/refs/heads/main/prompts.json',
];
const CUSTOM_PROMPTS_KEY = 'prompt_library_custom_v1';
const buildCustomId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const CATEGORY_OPTIONS: CategoryFilter[] = ['全部', '工作', '生活', '学习', '有趣', 'NSFW'];
const CUSTOM_CATEGORIES: CategoryFilter[] = ['工作', '生活', '学习', '有趣'];

const CHIPS: { id: ChipFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'recent', label: '最近一周' },
  { id: 'favorites', label: '收藏' },
  { id: 'custom', label: '自定义' },
  { id: 'generate', label: '文生图' },
  { id: 'edit', label: '编辑' },
];

const buildTimeoutFetch = async (url: string, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    return res;
  } finally {
    window.clearTimeout(timer);
  }
};

const readImageAsDataUrl = (file: File, maxSize = 1024, quality = 0.82) =>
  new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > width && height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(null);
      img.src = String(reader.result || '');
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

interface PromptLibraryModalProps {
  isOpen: boolean;
  language: Language;
  onClose: () => void;
}

const getItemKey = (item: PromptItem) =>
  item.id || `${item.title || ''}|${item.prompt || ''}|${item.author || ''}`.slice(0, 120);

const mapModeLabel = (mode?: string) => {
  if (!mode) return '';
  if (mode === 'generate') return '文生图';
  if (mode === 'edit') return '编辑';
  return mode;
};

export const PromptLibraryModal: React.FC<PromptLibraryModalProps> = ({ isOpen, language, onClose }) => {
  const [items, setItems] = useState<PromptItem[]>([]);
  const [customItems, setCustomItems] = useState<PromptItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('全部');
  const [chipFilter, setChipFilter] = useState<ChipFilter>('all');
  const [hideNsfw, setHideNsfw] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftMode, setDraftMode] = useState<PromptMode>('generate');
  const [draftCategory, setDraftCategory] = useState<CategoryFilter>('工作');
  const [draftSubCategory, setDraftSubCategory] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftPreview, setDraftPreview] = useState<string | null>(null);
  const [draftError, setDraftError] = useState('');
  const loadedRef = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('mousedown', handleClick);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const stored = localStorage.getItem(CUSTOM_PROMPTS_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const next = parsed.map((item: PromptItem) => ({
          ...item,
          id: item.id || buildCustomId(),
          source: 'custom',
        }));
        setCustomItems(next);
      }
    } catch {
      // ignore
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(customItems.slice(0, 200)));
    } catch {
      // ignore
    }
  }, [customItems, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (loadedRef.current && reloadKey === 0) return;
    let alive = true;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      for (const source of PROMPT_SOURCES) {
        try {
          const res = await buildTimeoutFetch(source);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error('empty');
          }
          if (alive) {
            setItems(data);
            loadedRef.current = true;
          }
          setIsLoading(false);
          return;
        } catch {
          // try next source
        }
      }
      if (alive) {
        setError(language === 'zh' ? '提示词加载失败，请稍后再试。' : 'Failed to load prompts.');
        setIsLoading(false);
      }
    };

    void fetchData();
    return () => {
      alive = false;
    };
  }, [isOpen, language, reloadKey]);

  const mergedItems = useMemo(() => [...customItems, ...items], [customItems, items]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return mergedItems.filter((item) => {
      const key = getItemKey(item);
      const category = (item.category || '').trim();
      const categoryLower = category.toLowerCase();
      const mode = (item.mode || '').toLowerCase();
      const title = (item.title || '').toLowerCase();
      const prompt = (item.prompt || '').toLowerCase();

      if (hideNsfw && categoryLower.includes('nsfw')) return false;
      if (categoryFilter !== '全部') {
        if (categoryFilter === 'NSFW') {
          if (!categoryLower.includes('nsfw')) return false;
        } else if (!category.includes(categoryFilter)) {
          return false;
        }
      }
      if (chipFilter === 'favorites' && !favorites.has(key)) return false;
      if (chipFilter === 'generate' && mode !== 'generate') return false;
      if (chipFilter === 'edit' && mode !== 'edit') return false;
      if (chipFilter === 'custom' && item.source !== 'custom') return false;

      if (!term) return true;
      return title.includes(term) || prompt.includes(term) || categoryLower.includes(term);
    });
  }, [mergedItems, categoryFilter, chipFilter, favorites, hideNsfw, searchTerm]);

  const toggleFavorite = (item: PromptItem) => {
    const key = getItemKey(item);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const copyPrompt = async (prompt: string) => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = prompt;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, chipFilter, hideNsfw]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, safePage]);

  const emptySlots = Math.max(0, PAGE_SIZE - pageItems.length);

  const resetDraft = () => {
    setDraftTitle('');
    setDraftMode('generate');
    setDraftCategory('工作');
    setDraftSubCategory('');
    setDraftPrompt('');
    setDraftPreview(null);
    setDraftError('');
    if (uploadRef.current) {
      uploadRef.current.value = '';
    }
  };

  const handleSaveDraft = () => {
    setDraftError('');
    const title = draftTitle.trim();
    const prompt = draftPrompt.trim();
    if (!title) {
      setDraftError(language === 'zh' ? '请输入标题。' : 'Title is required.');
      return;
    }
    if (!prompt) {
      setDraftError(language === 'zh' ? '请输入 Prompt 内容。' : 'Prompt is required.');
      return;
    }
    const category = draftSubCategory.trim()
      ? `${draftCategory}/${draftSubCategory.trim()}`
      : draftCategory;
    const item: PromptItem = {
      id: buildCustomId(),
      title,
      prompt,
      preview: draftPreview || undefined,
      mode: draftMode,
      category,
      subCategory: draftSubCategory.trim() || undefined,
      author: '@local',
      source: 'custom',
    };
    setCustomItems((prev) => [item, ...prev]);
    setCurrentPage(1);
    setIsAddOpen(false);
    resetDraft();
  };

  const handleDeleteCustom = (itemId: string, fallbackKey: string) => {
    const confirmed = window.confirm(language === 'zh' ? '确定删除这条自定义提示词吗？' : 'Delete this custom prompt?');
    if (!confirmed) return;
    setCustomItems((prev) => prev.filter((item) => item.id !== itemId));
    setFavorites((prev) => {
      if (!prev.has(itemId) && !prev.has(fallbackKey)) return prev;
      const next = new Set(prev);
      next.delete(itemId);
      next.delete(fallbackKey);
      return next;
    });
  };

  const handleSelectCover = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const dataUrl = await readImageAsDataUrl(file);
    if (dataUrl) {
      setDraftPreview(dataUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="w-[96%] max-w-6xl h-[88vh] bg-white/90 dark:bg-gray-900/90 border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {language === 'zh' ? '提示词快查' : 'Prompt Library'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl border border-gray-200/70 dark:border-white/10 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5"
            aria-label={language === 'zh' ? '关闭' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-5 flex flex-col gap-4">
          <div className="relative z-30 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  language === 'zh' ? '搜索关键词 (标题、提示词、分类)...' : 'Search keywords (title, prompt, tags)...'
                }
                className="w-full h-10 pl-10 pr-4 rounded-full border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-10 w-10 rounded-full border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
                aria-label={language === 'zh' ? '筛选视图' : 'Filter'}
              >
                <AlignJustify size={16} className="mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => setHideNsfw((prev) => !prev)}
                className={`h-10 w-10 rounded-full border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 flex items-center justify-center ${
                  hideNsfw ? 'text-white bg-gray-900 dark:bg-white/10' : 'text-gray-500'
                }`}
                aria-label={language === 'zh' ? '屏蔽 NSFW' : 'Hide NSFW'}
              >
                {hideNsfw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <div className="relative z-40" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  className="h-10 px-4 rounded-full border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"
                >
                  {categoryFilter}
                  <ChevronDown size={14} />
                </button>
                {isMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-36 rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-gray-900 shadow-lg overflow-hidden z-50">
                    <button
                      type="button"
                      onClick={() => setHideNsfw((prev) => !prev)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5 flex items-center justify-between"
                    >
                      <span>{language === 'zh' ? '屏蔽 NSFW' : 'Hide NSFW'}</span>
                      <span className={`text-xs ${hideNsfw ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {hideNsfw ? 'ON' : 'OFF'}
                      </span>
                    </button>
                    <div className="h-px bg-gray-200/70 dark:bg-white/10" />
                    {CATEGORY_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setCategoryFilter(opt);
                          setIsMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm ${
                          opt === categoryFilter
                            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setChipFilter(chip.id)}
                className={`px-4 h-9 rounded-full text-xs font-semibold border transition-colors ${
                  chipFilter === chip.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white/70 dark:bg-gray-800/60 border-gray-200/70 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5'
                }`}
              >
                {chip.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setIsAddOpen(true);
                setDraftError('');
              }}
              className="h-9 w-9 rounded-full bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center"
              aria-label={language === 'zh' ? '新增' : 'Add'}
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
            {isLoading && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 gap-2">
                <Loader2 className="animate-spin" size={20} />
                <div>{language === 'zh' ? '正在加载提示词...' : 'Loading prompts...'}</div>
              </div>
            )}

            {!isLoading && error && (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 gap-3">
                <div>{error}</div>
                <button
                  type="button"
                  onClick={() => {
                    loadedRef.current = false;
                    setItems([]);
                    setError(null);
                    setReloadKey((prev) => prev + 1);
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/10 text-sm hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  {language === 'zh' ? '重试' : 'Retry'}
                </button>
              </div>
            )}

            {!isLoading && !error && filteredItems.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                {language === 'zh' ? '没有找到匹配的提示词' : 'No prompts found.'}
              </div>
            )}

            {!isLoading && !error && filteredItems.length > 0 && (
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <div className="grid grid-cols-5 grid-rows-3 gap-3 flex-1 min-h-0">
                  {pageItems.map((item, idx) => {
                    const title = item.title || 'Untitled';
                    const prompt = item.prompt || '';
                  const key = getItemKey(item);
                  const itemId = item.id || key;
                  const modeLabel = mapModeLabel(item.mode);
                  const isFav = favorites.has(key);
                  const isCustom = item.source === 'custom';
                    return (
                      <div
                        key={`${title}-${idx}`}
                        className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 overflow-hidden shadow-sm h-full flex flex-col"
                      >
                        <div className="relative h-28 bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0">
                          {item.preview ? (
                            <img
                              src={item.preview}
                              alt={title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">
                              {language === 'zh' ? '暂无预览图' : 'No preview'}
                            </div>
                          )}
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(item)}
                            className="h-7 w-7 rounded-full bg-gray-900/70 text-white flex items-center justify-center shadow"
                          >
                            <Star size={12} fill={isFav ? 'currentColor' : 'none'} />
                          </button>
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustom(itemId, key)}
                              className="h-7 w-7 rounded-full bg-red-500/90 text-white flex items-center justify-center shadow"
                              aria-label={language === 'zh' ? '删除' : 'Delete'}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                            {item.category && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/90 text-gray-700">
                                {item.category}
                              </span>
                            )}
                            {modeLabel && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/90 text-white">
                                {modeLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="p-3 flex flex-col gap-2 flex-1 min-h-0">
                          <div className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2">{title}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                            {prompt || (language === 'zh' ? '暂无提示词内容' : 'No prompt text')}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400">
                            <div className="truncate">{item.author || 'Unknown'}</div>
                            <button
                              type="button"
                              onClick={() => copyPrompt(prompt)}
                              className="h-6 px-2 rounded-full border border-gray-200/70 dark:border-white/10 flex items-center gap-1 hover:bg-gray-100/70 dark:hover:bg-white/5"
                            >
                              <Copy size={11} />
                              {language === 'zh' ? '复制' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {Array.from({ length: emptySlots }).map((_, idx) => (
                    <div
                      key={`empty-${idx}`}
                      className="rounded-2xl border border-dashed border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-gray-800/30"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 pt-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className="px-3 h-8 rounded-full border border-gray-200/70 dark:border-white/10 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5"
                    disabled={safePage === 1}
                  >
                    {language === 'zh' ? '上一页' : 'Prev'}
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const page = idx + 1;
                      const active = page === safePage;
                      return (
                        <button
                          key={`page-${page}`}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`h-8 w-8 rounded-full text-xs font-semibold border ${
                            active
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-gray-200/70 dark:border-white/10 text-gray-500 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    className="px-3 h-8 rounded-full border border-gray-200/70 dark:border-white/10 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5"
                    disabled={safePage === totalPages}
                  >
                    {language === 'zh' ? '下一页' : 'Next'}
                  </button>
                </div>
            </div>
          )}
          </div>
        </div>
      </div>
      {isAddOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[92%] max-w-2xl bg-gray-950 text-white rounded-2xl border border-white/10 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">
                {language === 'zh' ? '添加自定义 Prompt' : 'Add Custom Prompt'}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  resetDraft();
                }}
                className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10"
                aria-label={language === 'zh' ? '关闭' : 'Close'}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder={language === 'zh' ? '标题' : 'Title'}
                className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDraftMode('generate')}
                  className={`h-11 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                    draftMode === 'generate'
                      ? 'bg-white/10 border-white/30 text-white'
                      : 'border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <ImageIcon size={16} />
                  {language === 'zh' ? '文生图' : 'Generate'}
                </button>
                <button
                  type="button"
                  onClick={() => setDraftMode('edit')}
                  className={`h-11 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                    draftMode === 'edit'
                      ? 'bg-white/10 border-white/30 text-white'
                      : 'border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <PenLine size={16} />
                  {language === 'zh' ? '编辑' : 'Edit'}
                </button>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => uploadRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    uploadRef.current?.click();
                  }
                }}
                className="h-36 rounded-2xl border border-dashed border-white/10 bg-white/5 flex items-center justify-center text-gray-400 text-sm cursor-pointer overflow-hidden"
              >
                {draftPreview ? (
                  <img src={draftPreview} alt="cover" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon size={22} />
                    <div>{language === 'zh' ? '点击上传封面图' : 'Upload cover image'}</div>
                  </div>
                )}
              </div>
              <input
                ref={uploadRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleSelectCover(e.target.files)}
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value as CategoryFilter)}
                  className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  {CUSTOM_CATEGORIES.map((opt) => (
                    <option key={opt} value={opt} className="text-gray-900">
                      {opt}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={draftSubCategory}
                  onChange={(e) => setDraftSubCategory(e.target.value)}
                  placeholder={language === 'zh' ? '子分类 (可选)' : 'Subcategory (optional)'}
                  className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <textarea
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                placeholder={language === 'zh' ? 'Prompt 内容' : 'Prompt content'}
                className="w-full h-28 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
              />

              {draftError && <div className="text-xs text-red-400">{draftError}</div>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    resetDraft();
                  }}
                  className="h-10 px-4 rounded-xl border border-white/10 text-sm text-gray-300 hover:bg-white/5"
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                >
                  {language === 'zh' ? '保存' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
