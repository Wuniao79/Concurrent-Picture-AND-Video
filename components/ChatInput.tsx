import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Plus, X, Expand, Minimize2, Lock, Unlock, Building2, Shuffle, Download, Loader2, ChevronDown, ChevronUp, Sparkles, SlidersHorizontal, Image as ImageIcon, Film, LayoutGrid, Layers } from 'lucide-react';
import { RoleCardItem, ToolView } from '../types';

type InputTrigger = {
  type: '@' | '/';
  start: number;
  query: string;
};

type CardSuggestion = {
  id: string;
  kind: 'role' | 'prompt';
  label: string;
  insertText: string;
  meta: string;
  avatarDataUrl?: string;
};

interface ChatInputProps {
  onSend: (text: string, images: string[]) => void;
  language: 'en' | 'zh' | 'system';
  isGenerating: boolean;
  inputDisabled?: boolean;
  inputDisabledHint?: string;
  onOpenSettings?: () => void;
  onOpenTool?: (tool: ToolView) => void;
  laneCountInput: string;
  updateLaneCount: (value: string) => void;
  laneLocked: boolean;
  onToggleLaneLock: () => void;
  moreImagesEnabled: boolean;
  roleCardsEnabled?: boolean;
  roleCards?: RoleCardItem[];
  showEnterpriseButton?: boolean;
  enterpriseEnabled?: boolean;
  onToggleEnterpriseEnabled?: () => void;
  showRelaySelect?: boolean;
  relays?: { id: string; name: string }[];
  activeRelayId?: string;
  onSelectRelay?: (id: string) => void;
  showKeyRotationButton?: boolean;
  keyRotationEnabled?: boolean;
  onToggleKeyRotation?: () => void;
  showBulkDownload?: boolean;
  bulkDownloadDisabled?: boolean;
  bulkDownloadLoading?: boolean;
  bulkDownloadMessage?: string;
  bulkDownloadMessageTone?: 'neutral' | 'success' | 'error';
  onBulkDownload?: () => void;
  showStopQueue?: boolean;
  onStopQueue?: () => void;
  isCollapsed?: boolean;
  onCollapseChange?: (next: boolean) => void;
  isFullView?: boolean;
  laneNavItems?: { id: string; label: string; isActive?: boolean; status?: 'idle' | 'running' | 'done' | 'error' }[];
  onSelectLane?: (id: string) => void;
  isMultiLaneLayout?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  language,
  isGenerating,
  inputDisabled = false,
  inputDisabledHint,
  onOpenTool,
  laneCountInput,
  updateLaneCount,
  laneLocked,
  onToggleLaneLock,
  moreImagesEnabled,
  roleCardsEnabled = false,
  roleCards = [],
  showEnterpriseButton,
  enterpriseEnabled,
  onToggleEnterpriseEnabled,
  showRelaySelect,
  relays,
  activeRelayId,
  onSelectRelay,
  showKeyRotationButton,
  keyRotationEnabled,
  onToggleKeyRotation,
  showBulkDownload,
  bulkDownloadDisabled,
  bulkDownloadLoading,
  bulkDownloadMessage,
  bulkDownloadMessageTone = 'neutral',
  onBulkDownload,
  showStopQueue,
  onStopQueue,
  isCollapsed,
  onCollapseChange,
  isFullView,
  laneNavItems,
  onSelectLane,
  isMultiLaneLayout = false,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestMenuRef = useRef<HTMLDivElement>(null);
  const [trigger, setTrigger] = useState<InputTrigger | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const effectiveCollapsed = typeof isCollapsed === 'boolean' ? isCollapsed : localCollapsed;
  const t = (zh: string, en: string) => (language === 'zh' ? zh : en);
  const setCollapsed = (next: boolean) => {
    if (onCollapseChange) {
      onCollapseChange(next);
    } else {
      setLocalCollapsed(next);
    }
  };

  const IMAGE_MAX_DIMENSION = 1024;
  const IMAGE_TARGET_MAX_BYTES = 1_200_000;
  const IMAGE_MAX_COUNT = moreImagesEnabled ? 5 : 1;

  useEffect(() => {
    if (!moreImagesEnabled && selectedImages.length > 1) {
      setSelectedImages((prev) => prev.slice(0, 1));
    }
  }, [moreImagesEnabled, selectedImages.length]);

  useEffect(() => {
    if (effectiveCollapsed && isExpanded) {
      setIsExpanded(false);
    }
  }, [effectiveCollapsed, isExpanded]);

  useEffect(() => {
    if (!isToolMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (toolMenuRef.current && !toolMenuRef.current.contains(event.target as Node)) {
        setIsToolMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('mousedown', handleClick);
    };
  }, [isToolMenuOpen]);

  const normalizedRoleCards = useMemo(() => (Array.isArray(roleCards) ? roleCards : []), [roleCards]);

  const roleSuggestions = useMemo<CardSuggestion[]>(() => {
    return normalizedRoleCards
      .filter((item) => item.kind === 'role')
      .map((item) => {
        const alias = (item.alias || '').trim();
        const atId = (item.atId || '').trim();
        return {
          id: item.id,
          kind: 'role' as const,
          label: alias,
          insertText: atId ? `@${atId.replace(/^@+/, '')}` : '',
          meta: atId ? `@${atId.replace(/^@+/, '')}` : '',
          avatarDataUrl: item.avatarDataUrl,
        };
      })
      .filter((item) => item.label && item.insertText);
  }, [normalizedRoleCards]);

  const promptSuggestions = useMemo<CardSuggestion[]>(() => {
    return normalizedRoleCards
      .filter((item) => item.kind === 'prompt')
      .map((item) => {
        const alias = (item.alias || '').trim();
        const insertContent = (item.insertContent || '').trim();
        const preview = insertContent.length > 40 ? `${insertContent.slice(0, 40)}…` : insertContent;
        return {
          id: item.id,
          kind: 'prompt' as const,
          label: alias,
          insertText: insertContent,
          meta: preview,
          avatarDataUrl: item.avatarDataUrl,
        };
      })
      .filter((item) => item.label && item.insertText);
  }, [normalizedRoleCards]);

  const filteredSuggestions = useMemo<CardSuggestion[]>(() => {
    if (!roleCardsEnabled || !trigger) return [];
    const q = (trigger.query || '').trim().toLowerCase();
    const base = trigger.type === '@' ? roleSuggestions : [...roleSuggestions, ...promptSuggestions];
    if (!q) return base;
    return base.filter((item) => {
      const label = (item.label || '').toLowerCase();
      const meta = (item.meta || '').toLowerCase();
      return label.includes(q) || meta.includes(q);
    });
  }, [promptSuggestions, roleCardsEnabled, roleSuggestions, trigger]);

  useEffect(() => {
    if (!roleCardsEnabled && trigger) {
      setTrigger(null);
      setActiveSuggestionIndex(0);
    }
  }, [roleCardsEnabled, trigger]);

  useEffect(() => {
    setActiveSuggestionIndex((prev) => {
      if (filteredSuggestions.length <= 0) return 0;
      return Math.min(prev, filteredSuggestions.length - 1);
    });
  }, [filteredSuggestions.length]);

  useEffect(() => {
    if (!trigger) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (suggestMenuRef.current && suggestMenuRef.current.contains(target)) return;
      if (textareaRef.current && textareaRef.current.contains(target)) return;
      setTrigger(null);
    };
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('mousedown', handleClick);
    };
  }, [trigger]);

  const findLastTrigger = (textBeforeCaret: string, kind: '@' | '/'): InputTrigger | null => {
    for (let idx = textBeforeCaret.length - 1; idx >= 0; idx -= 1) {
      if (textBeforeCaret[idx] !== kind) continue;
      if (idx > 0) {
        const prev = textBeforeCaret[idx - 1];
        if (/[A-Za-z0-9_]/.test(prev)) continue;
      }
      const query = textBeforeCaret.slice(idx + 1);
      if (/\s/.test(query)) continue;
      return { type: kind, start: idx, query };
    }
    return null;
  };

  const resolveTrigger = (value: string, caret: number): InputTrigger | null => {
    if (!roleCardsEnabled) return null;
    const safeCaret = Math.max(0, Math.min(value.length, caret));
    const prefix = value.slice(0, safeCaret);
    const atTrigger = findLastTrigger(prefix, '@');
    const slashTrigger = findLastTrigger(prefix, '/');
    if (atTrigger && slashTrigger) {
      return atTrigger.start > slashTrigger.start ? atTrigger : slashTrigger;
    }
    return atTrigger || slashTrigger;
  };

  const syncTriggerFromTextarea = (el: HTMLTextAreaElement) => {
    if (!roleCardsEnabled) {
      setTrigger(null);
      return;
    }
    const caret = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
    const next = resolveTrigger(el.value || '', caret);
    setTrigger(next);
    const prev = trigger;
    const hasChanged =
      (!prev && !!next) ||
      (!!prev && !next) ||
      (prev && next && (prev.type !== next.type || prev.start !== next.start || prev.query !== next.query));
    if (hasChanged) {
      setActiveSuggestionIndex(0);
    }
  };

  const applySuggestion = (item: CardSuggestion) => {
    const el = textareaRef.current;
    if (!el) return;
    const current = trigger;
    if (!current) return;
    const start = Math.max(0, Math.min(promptInput.length, current.start));
    const typedEnd = current.start + 1 + (current.query || '').length;
    const end = Math.max(start, Math.min(promptInput.length, typedEnd));

    const before = promptInput.slice(0, start);
    const after = promptInput.slice(end);
    let insert = item.insertText || '';
    if (insert && !/\s$/.test(insert)) {
      const nextChar = after[0];
      if (!nextChar || !/\s/.test(nextChar)) {
        insert += ' ';
      }
    }

    const nextValue = `${before}${insert}${after}`;
    const nextCursor = before.length + insert.length;
    setPromptInput(nextValue);
    setTrigger(null);
    setActiveSuggestionIndex(0);

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const estimateDataUrlBytes = (dataUrl: string) => {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return dataUrl.length;
    const base64 = dataUrl.slice(comma + 1).trim();
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = src;
    });

  const optimizeImageDataUrl = async (dataUrl: string) => {
    const initialBytes = estimateDataUrlBytes(dataUrl);
    const img = await loadImage(dataUrl);

    const maxDim = Math.max(img.naturalWidth || img.width || 0, img.naturalHeight || img.height || 0);
    const needsResize = maxDim > IMAGE_MAX_DIMENSION;
    const needsCompress = initialBytes > IMAGE_TARGET_MAX_BYTES;

    if (!needsResize && !needsCompress) return dataUrl;

    const srcW = img.naturalWidth || img.width || 1;
    const srcH = img.naturalHeight || img.height || 1;
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(srcW, srcH));
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0, targetW, targetH);

    const mime = 'image/jpeg';
    let quality = 0.86;
    let out = canvas.toDataURL(mime, quality);

    while (estimateDataUrlBytes(out) > IMAGE_TARGET_MAX_BYTES && quality > 0.5) {
      quality = Math.max(0.5, quality - 0.12);
      out = canvas.toDataURL(mime, quality);
    }

    // If still too large, scale down further and retry once more.
    if (estimateDataUrlBytes(out) > IMAGE_TARGET_MAX_BYTES && Math.max(targetW, targetH) > 640) {
      const shrink = 640 / Math.max(targetW, targetH);
      const w2 = Math.max(1, Math.round(targetW * shrink));
      const h2 = Math.max(1, Math.round(targetH * shrink));
      canvas.width = w2;
      canvas.height = h2;
      const ctx2 = canvas.getContext('2d');
      if (ctx2) {
        ctx2.drawImage(img, 0, 0, w2, h2);
        quality = 0.78;
        out = canvas.toDataURL(mime, quality);
      }
    }

    return out;
  };

  const getImageFromFile = async (file: File) => {
    try {
      const raw = await readFileAsDataUrl(file);
      const optimized = await optimizeImageDataUrl(raw);
      return optimized;
    } catch {
      try {
        const fallback = await readFileAsDataUrl(file);
        return fallback;
      } catch {
        // ignore
      }
    }
    return null;
  };

  const addImagesFromFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    const imageFiles = files.filter((f) => f && f.type && f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const remainingSlots = moreImagesEnabled ? Math.max(0, IMAGE_MAX_COUNT - selectedImages.length) : 1;
    if (remainingSlots <= 0) return;

    const nextImages: string[] = [];
    for (const file of imageFiles.slice(0, remainingSlots)) {
      // eslint-disable-next-line no-await-in-loop
      const dataUrl = await getImageFromFile(file);
      if (dataUrl) nextImages.push(dataUrl);
    }

    if (nextImages.length === 0) return;

    setSelectedImages((prev) => {
      if (!moreImagesEnabled) return [nextImages[0]];
      const merged = [...prev, ...nextImages];
      return merged.slice(0, IMAGE_MAX_COUNT);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (inputDisabled) return;

    if (roleCardsEnabled && trigger) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setTrigger(null);
        return;
      }

      if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => Math.min(prev + 1, Math.max(0, filteredSuggestions.length - 1)));
        return;
      }

      if (e.key === 'ArrowUp' && filteredSuggestions.length > 0) {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if ((e.key === 'Enter' || e.key === 'Tab') && filteredSuggestions.length > 0) {
        e.preventDefault();
        applySuggestion(filteredSuggestions[activeSuggestionIndex] || filteredSuggestions[0]);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTriggerSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (inputDisabled) return;
    const dt = e.clipboardData;
    if (!dt) return;

    const files: File[] = [];
    for (const item of Array.from(dt.items || [])) {
      if (item.kind === 'file' && item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length === 0 && dt.files && dt.files.length > 0) {
      for (const file of Array.from(dt.files)) {
        if (file && file.type && file.type.startsWith('image/')) files.push(file);
      }
    }
    if (files.length === 0) return;

    e.preventDefault();
    void addImagesFromFiles(files);
  };

  const handleTriggerSend = () => {
    if (inputDisabled) return;
    if ((!promptInput.trim() && selectedImages.length === 0) || isGenerating) return;
    onSend(promptInput, selectedImages);
    setPromptInput('');
    setSelectedImages([]);
    setTrigger(null);
    setActiveSuggestionIndex(0);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (inputDisabled) return;
    const files = Array.from(e.target.files || []);
    if (files.length > 0) void addImagesFromFiles(files);
    e.target.value = '';
  };

  const widthClass = isExpanded ? '' : isMultiLaneLayout ? 'max-w-none' : 'max-w-6xl';

  if (effectiveCollapsed) {
    const navItems = Array.isArray(laneNavItems) ? laneNavItems.slice(0, 20) : [];
    const showLaneNav = Boolean(isFullView && navItems.length > 0 && onSelectLane);
    const layoutClass = showLaneNav ? 'justify-between' : 'justify-end';
    return (
      <div className="w-full flex justify-center px-6 pb-4">
        <div className={`w-full ${widthClass} flex items-end ${layoutClass} gap-4`}>
          {showLaneNav && (
            <div className="grid grid-cols-10 gap-0.5">
              {navItems.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectLane?.(item.id)}
                  className={`h-7 w-8 text-[9px] font-semibold rounded-md border transition-colors flex items-center gap-0.5 px-0.5 ${
                    item.isActive
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white/60 dark:bg-gray-900/40 border-gray-200/70 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5'
                  }`}
                  title={item.label || String(idx + 1)}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                      item.status === 'error'
                        ? 'bg-red-500'
                        : item.status === 'running'
                        ? 'bg-yellow-400 animate-pulse'
                        : item.status === 'done'
                        ? 'bg-emerald-400'
                        : 'bg-gray-400/70'
                    }`}
                  />
                  <span className="text-left">{item.label || idx + 1}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="h-12 w-12 flex flex-col items-center justify-center gap-0.5 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 text-[9px] font-semibold hover:bg-gray-100/70 dark:hover:bg-white/5 transition-colors"
            title={language === 'zh' ? '打开输入栏' : 'Show input'}
            aria-label={language === 'zh' ? '打开输入栏' : 'Show input'}
          >
            <ChevronUp size={18} />
            <span>{language === 'zh' ? '打开' : 'Open'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center px-6 pb-5">
      <div className={`w-full ${widthClass}`}>
        {selectedImages.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-3">
            {selectedImages.map((img, idx) => (
              <div key={idx} className="relative inline-block">
                <img
                  src={img}
                  alt="Preview"
                  className="h-16 w-auto rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-md bg-black/10"
                />
                <button
                  onClick={() => setSelectedImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                  title={language === 'zh' ? '移除图片' : 'Remove image'}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative rounded-[24px] p-[1px] bg-gradient-to-br from-blue-500/35 via-slate-500/10 to-emerald-500/25 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.7)]">
          <div
            className={`relative rounded-[23px] bg-white/80 text-gray-900 backdrop-blur-xl border border-white/60 dark:bg-[#0b1220]/75 dark:text-gray-100 dark:border-white/10 shadow-lg transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500/20 ${
              isExpanded ? 'min-h-[320px]' : 'min-h-[88px]'
            }`}
          >
            <div className={`px-4 ${isExpanded ? 'pt-4 pb-3' : 'pt-3 pb-2'}`}>
              <textarea
                ref={textareaRef}
                value={promptInput}
                onChange={(e) => {
                  setPromptInput(e.target.value);
                  syncTriggerFromTextarea(e.target);
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={(e) => syncTriggerFromTextarea(e.currentTarget)}
                onClick={(e) => syncTriggerFromTextarea(e.currentTarget)}
                onSelect={(e) => syncTriggerFromTextarea(e.currentTarget)}
                onPaste={handlePaste}
                disabled={inputDisabled}
                placeholder={
                  language === 'zh'
                    ? '输入问题…（Enter 发送，Shift+Enter 换行）'
                    : 'Ask anything… (Enter to send, Shift+Enter for newline)'
                }
                className={`w-full bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500/70 dark:placeholder-gray-400/60 text-base resize-none focus:outline-none rounded-2xl px-3 py-2.5 border border-transparent focus:border-blue-500/25 focus:bg-white/60 dark:focus:bg-white/5 transition-colors ${
                  isExpanded ? 'min-h-[220px]' : 'min-h-[56px]'
                } ${inputDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                rows={isExpanded ? 10 : 3}
              />
              {inputDisabled && inputDisabledHint && (
                <div className="mt-2 px-3 text-xs text-gray-500 dark:text-gray-400">{inputDisabledHint}</div>
              )}
            </div>

            {roleCardsEnabled && trigger && (
              <div
                ref={suggestMenuRef}
                className="absolute left-4 right-4 sm:right-auto bottom-full mb-3 z-50 sm:w-[360px]"
              >
                <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/95 dark:bg-[#0b1220]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/5 overflow-hidden p-2.5">
                  <div className="px-2 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
                    <span className="font-semibold">
                      {trigger.type === '@' ? t('@ 角色', '@ Roles') : t('/ 角色 / 提示词', '/ Roles / Prompts')}
                    </span>
                    <span className="font-mono">{filteredSuggestions.length}</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredSuggestions.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {t('没有匹配项', 'No matches')}
                      </div>
                    ) : (
                      filteredSuggestions.map((item, idx) => {
                        const isActive = idx === activeSuggestionIndex;
                        const badge = item.kind === 'role' ? t('角色', 'Role') : t('提示词', 'Prompt');
                        const badgeClass =
                          item.kind === 'role'
                            ? 'border-emerald-500/20 text-emerald-700 dark:text-emerald-200 bg-emerald-500/10'
                            : 'border-indigo-500/20 text-indigo-700 dark:text-indigo-200 bg-indigo-500/10';
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              applySuggestion(item);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-left transition-colors border ${
                              isActive
                                ? 'bg-blue-500/10 border-blue-500/20'
                                : 'border-transparent hover:bg-gray-100/70 dark:hover:bg-white/5'
                            }`}
                          >
                            <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 ring-1 ring-gray-200/80 dark:ring-white/10">
                              {item.avatarDataUrl ? (
                                <img src={item.avatarDataUrl} alt="avatar" className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-300">
                                  {item.kind === 'role' ? '@' : '/'}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {item.label}
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{item.meta}</div>
                            </div>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] border ${badgeClass}`}>
                              {badge}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="px-2 pt-2 text-[11px] text-gray-400 dark:text-gray-500">
                    {t('↑↓ 选择，Enter/Tab 确认，Esc 关闭', '↑↓ to navigate, Enter/Tab to insert, Esc to close')}
                  </div>
                </div>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              multiple={moreImagesEnabled}
              onChange={handleImageSelect}
              disabled={inputDisabled}
            />

            <div className={`px-3 ${isExpanded ? 'pb-4' : 'pb-3'} flex items-center justify-between gap-3`}>
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      if (inputDisabled) return;
                      fileInputRef.current?.click();
                    }}
                    disabled={inputDisabled}
                    className={`h-9 w-9 inline-flex items-center justify-center rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-gray-900/40 transition-colors text-gray-700 dark:text-gray-200 ${
                      inputDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100/70 dark:hover:bg-white/5'
                    }`}
                    aria-label={language === 'zh' ? '上传图片' : 'Upload image'}
                  >
                    <Plus size={18} />
                  </button>
                  <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-12 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 delay-0 group-hover:delay-1000">
                    <div className="rounded-lg bg-gray-900 text-white text-xs px-3 py-2 shadow-xl border border-white/10 text-center">
                      <div className="font-medium">{language === 'zh' ? '上传' : 'Upload'}</div>
                      <div className="text-[10px] text-white/75">{language === 'zh' ? '图片' : 'Image'}</div>
                    </div>
                  </div>
                </div>

                {onOpenTool && (
                  <div className="relative" ref={toolMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsToolMenuOpen((prev) => !prev)}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-gray-900/40 hover:bg-gray-100/70 dark:hover:bg-white/5 transition-colors text-gray-700 dark:text-gray-200"
                      aria-label={language === 'zh' ? '工具' : 'Tools'}
                    >
                      <SlidersHorizontal size={18} />
                    </button>
                    {isToolMenuOpen && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/95 dark:bg-gray-900/95 shadow-xl p-2 text-sm">
                        {[
                          { id: 'promptLibrary' as ToolView, label: language === 'zh' ? '图片提示词库' : 'Prompt Library', icon: Sparkles },
                          { id: 'slicer' as ToolView, label: language === 'zh' ? '图片分割工厂' : 'Image Slicer', icon: ImageIcon },
                          { id: 'videoFrames' as ToolView, label: language === 'zh' ? '提取视频首尾帧' : 'Video Frames', icon: Film },
                          { id: 'xhs' as ToolView, label: language === 'zh' ? 'XHS 灵感实验室' : 'XHS Lab', icon: LayoutGrid },
                          { id: 'more' as ToolView, label: language === 'zh' ? '更多功能' : 'More', icon: Layers, disabled: true },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            disabled={item.disabled}
                            onClick={() => {
                              if (item.disabled) return;
                              onOpenTool(item.id);
                              setIsToolMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                              item.disabled
                                ? 'text-gray-400 cursor-default'
                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5'
                            }`}
                          >
                            <item.icon size={16} />
                            <span className="text-xs font-semibold">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 bg-white/60 dark:bg-gray-900/40 border border-gray-200/70 dark:border-white/10 shadow-sm">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-300 hidden sm:inline">
                    {language === 'zh' ? '并发' : 'Lanes'}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={laneCountInput}
                    onChange={(e) => updateLaneCount(e.target.value)}
                    disabled={laneLocked}
                    className={`bg-transparent text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none w-10 text-center ${
                      laneLocked ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                    aria-label={language === 'zh' ? '并发数' : 'Lane count'}
                  />
                  <button
                    type="button"
                    onClick={onToggleLaneLock}
                    className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border transition-colors ${
                      laneLocked
                        ? 'bg-gray-800 text-white border-gray-700 dark:bg-blue-600 dark:border-blue-500'
                        : 'bg-white/70 dark:bg-gray-800/60 text-gray-800 dark:text-gray-100 border-gray-200/70 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    title={
                      language === 'zh'
                        ? laneLocked
                          ? '解锁并发数'
                          : '锁定并发数'
                        : laneLocked
                        ? 'Unlock lanes'
                        : 'Lock lanes'
                    }
                    aria-label={language === 'zh' ? (laneLocked ? '解锁' : '锁定') : laneLocked ? 'Unlock' : 'Lock'}
	                  >
	                    {laneLocked ? <Unlock size={16} /> : <Lock size={16} />}
	                  </button>
	                </div>

                  {showRelaySelect && relays && onSelectRelay && (
                    <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 bg-white/60 dark:bg-gray-900/40 border border-gray-200/70 dark:border-white/10 shadow-sm">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-300 hidden sm:inline">
                        {language === 'zh' ? '中转站' : 'Relay'}
                      </span>
                      <select
                        value={activeRelayId || ''}
                        onChange={(e) => onSelectRelay(e.target.value)}
                        className="bg-transparent text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none cursor-pointer min-w-[88px]"
                      >
                        <option value="" className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                          {language === 'zh' ? '默认' : 'Default'}
                        </option>
                        {relays.map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                            className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                          >
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {showKeyRotationButton && onToggleKeyRotation && (
                    <button
                      type="button"
                      onClick={onToggleKeyRotation}
                      aria-pressed={Boolean(keyRotationEnabled)}
                      className={`h-9 inline-flex items-center gap-2 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                        keyRotationEnabled
                          ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                          : 'bg-white/60 dark:bg-gray-900/40 text-gray-800 dark:text-gray-100 border-gray-200/70 dark:border-white/10 hover:bg-gray-100/70 dark:hover:bg-white/5'
                      }`}
                      title={
                        language === 'zh'
                          ? keyRotationEnabled
                            ? '密钥轮询（已启用，点击关闭）'
                            : '密钥轮询（未启用，点击开启）'
                          : keyRotationEnabled
                          ? 'Key rotation (enabled, click to disable)'
                          : 'Key rotation (disabled, click to enable)'
                      }
                    >
                      <Shuffle size={14} />
                      <span>{language === 'zh' ? '密钥轮询' : 'Key rotation'}</span>
                    </button>
                  )}

	                {showEnterpriseButton && onToggleEnterpriseEnabled && (
	                  <button
	                    type="button"
	                    onClick={onToggleEnterpriseEnabled}
	                    className={`h-9 inline-flex items-center gap-2 px-3 rounded-xl border text-xs font-semibold transition-colors ${
	                      enterpriseEnabled
	                        ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
	                        : 'bg-white/60 dark:bg-gray-900/40 text-gray-800 dark:text-gray-100 border-gray-200/70 dark:border-white/10 hover:bg-gray-100/70 dark:hover:bg-white/5'
	                    }`}
	                    title={
	                      language === 'zh'
	                        ? enterpriseEnabled
	                          ? '企业级（已启用）'
	                          : '企业级（Vertex AI）'
	                        : enterpriseEnabled
	                        ? 'Enterprise (active)'
	                        : 'Enterprise (Vertex AI)'
	                    }
	                  >
	                    <Building2 size={14} />
	                    <span>{language === 'zh' ? '企业级' : 'Enterprise'}</span>
	                  </button>
	                )}
	              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  {showBulkDownload && onBulkDownload && (
                    <button
                      type="button"
                      onClick={onBulkDownload}
                      disabled={bulkDownloadDisabled || bulkDownloadLoading}
                      className={`h-9 inline-flex items-center gap-2 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                        bulkDownloadDisabled || bulkDownloadLoading
                          ? 'bg-gray-200/80 dark:bg-white/5 text-gray-400 border-gray-200/60 dark:border-white/10 cursor-not-allowed'
                          : 'bg-white/60 dark:bg-gray-900/40 text-gray-800 dark:text-gray-100 border-gray-200/70 dark:border-white/10 hover:bg-gray-100/70 dark:hover:bg-white/5'
                      }`}
                      title={
                        bulkDownloadLoading
                          ? language === 'zh'
                            ? '下载中...'
                            : 'Downloading...'
                          : bulkDownloadDisabled
                          ? language === 'zh'
                            ? '暂无可下载的图片'
                            : 'No images to download'
                          : language === 'zh'
                          ? '一键下载所有图片'
                          : 'Download all images'
                      }
                    >
                      {bulkDownloadLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      <span>
                        {bulkDownloadLoading
                          ? language === 'zh'
                            ? '下载中...'
                            : 'Downloading...'
                          : language === 'zh'
                          ? '一键下载'
                          : 'Download all'}
                      </span>
                    </button>
                  )}
                  {showStopQueue && onStopQueue && (
                    <button
                      type="button"
                      onClick={onStopQueue}
                      className="h-9 inline-flex items-center gap-2 px-3 rounded-xl border text-xs font-semibold transition-colors bg-red-600 border-red-600 text-white hover:bg-red-700"
                      title={language === 'zh' ? '终止后续排队' : 'Stop queued lanes'}
                    >
                      <X size={14} />
                      <span>{language === 'zh' ? '终止排队' : 'Stop queue'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsExpanded((v) => !v)}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-gray-900/30 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-colors text-gray-700 dark:text-gray-200"
                    title={
                      language === 'zh'
                        ? isExpanded
                          ? '退出全屏输入'
                          : '全屏输入'
                        : isExpanded
                        ? 'Exit fullscreen'
                        : 'Fullscreen input'
                    }
                  >
                    {isExpanded ? <Minimize2 size={18} /> : <Expand size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollapsed(true)}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/40 dark:bg-gray-900/30 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-colors text-gray-700 dark:text-gray-200"
                    title={language === 'zh' ? '收起输入栏' : 'Collapse input'}
                    aria-label={language === 'zh' ? '收起输入栏' : 'Collapse input'}
                  >
                    <ChevronDown size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerSend}
                    disabled={inputDisabled || (!promptInput.trim() && selectedImages.length === 0) || isGenerating}
                    className={`h-10 w-10 rounded-full inline-flex items-center justify-center border transition-all duration-200 ${
                      !inputDisabled && (promptInput.trim() || selectedImages.length > 0) && !isGenerating
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500/40 shadow-md hover:from-blue-700 hover:to-indigo-700'
                        : 'bg-gray-200/80 dark:bg-white/5 text-gray-400 border-gray-200/60 dark:border-white/10 cursor-not-allowed opacity-70'
                    }`}
                    aria-label={language === 'zh' ? '发送' : 'Send'}
                    title={language === 'zh' ? '发送' : 'Send'}
                  >
                    {isGenerating ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <ArrowUp size={18} />
                    )}
                  </button>
                </div>
                {showBulkDownload && bulkDownloadMessage && (
                  <div
                    className={`text-[10px] ${
                      bulkDownloadMessageTone === 'success'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : bulkDownloadMessageTone === 'error'
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {bulkDownloadMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
