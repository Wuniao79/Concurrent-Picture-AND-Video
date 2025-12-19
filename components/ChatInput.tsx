import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Plus, X, SlidersHorizontal, Expand, Minimize2, Lock, Unlock, Building2, Shuffle, Download, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string, images: string[]) => void;
  language: 'en' | 'zh' | 'system';
  isGenerating: boolean;
  inputDisabled?: boolean;
  inputDisabledHint?: string;
  onOpenSettings?: () => void;
  laneCountInput: string;
  updateLaneCount: (value: string) => void;
  laneLocked: boolean;
  onToggleLaneLock: () => void;
  moreImagesEnabled: boolean;
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
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  language,
  isGenerating,
  inputDisabled = false,
  inputDisabledHint,
  onOpenSettings,
  laneCountInput,
  updateLaneCount,
  laneLocked,
  onToggleLaneLock,
  moreImagesEnabled,
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
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const IMAGE_MAX_DIMENSION = 1024;
  const IMAGE_TARGET_MAX_BYTES = 1_200_000;
  const IMAGE_MAX_COUNT = moreImagesEnabled ? 5 : 1;

  useEffect(() => {
    if (!moreImagesEnabled && selectedImages.length > 1) {
      setSelectedImages((prev) => prev.slice(0, 1));
    }
  }, [moreImagesEnabled, selectedImages.length]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (inputDisabled) return;
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
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (inputDisabled) return;
    const files = Array.from(e.target.files || []);
    if (files.length > 0) void addImagesFromFiles(files);
    e.target.value = '';
  };

  return (
    <div className="w-full flex justify-center px-6 pb-5">
      <div className={`w-full ${isExpanded ? '' : 'max-w-6xl'}`}>
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
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={handleKeyDown}
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

                {onOpenSettings && (
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/60 dark:bg-gray-900/40 hover:bg-gray-100/70 dark:hover:bg-white/5 transition-colors text-gray-700 dark:text-gray-200"
                      aria-label={language === 'zh' ? '设置' : 'Settings'}
                    >
                      <SlidersHorizontal size={18} />
                    </button>
                    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-12 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 delay-0 group-hover:delay-1000">
                      <div className="rounded-lg bg-gray-900 text-white text-xs px-3 py-2 shadow-xl border border-white/10 text-center">
                        <div className="font-medium">{language === 'zh' ? '设置' : 'Settings'}</div>
                        <div className="text-[10px] text-white/75">{language === 'zh' ? '工具' : 'Tools'}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mx-1 h-6 w-px bg-gray-200/70 dark:bg-white/10" />

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
