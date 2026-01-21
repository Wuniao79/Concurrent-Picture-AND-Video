import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Film, Library, X } from 'lucide-react';
import { Language } from '../../types';
import { useAssetLibrary } from '../../hooks/useAssetLibrary';
import { AssetPickerModal } from '../modals/AssetPickerModal';
import { AssetNameModal } from '../modals/AssetNameModal';
import { addAssetLibraryBlobItem } from '../../utils/assetLibrary';

interface VideoFrameModalProps {
  isOpen: boolean;
  language: Language;
  onClose: () => void;
}

type FrameResult = {
  url: string;
  blob: Blob;
};

type ViewMode = 'frames' | 'collage';
type CollageGrid = 3 | 5;
type CollageSize = { w: number; h: number };

const MAX_SECONDS = 30;

export const VideoFrameModal: React.FC<VideoFrameModalProps> = ({ isOpen, language, onClose }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstFrame, setFirstFrame] = useState<FrameResult | null>(null);
  const [lastFrame, setLastFrame] = useState<FrameResult | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('frames');
  const [collageGrid, setCollageGrid] = useState<CollageGrid>(3);
  const [collageSize, setCollageSize] = useState<CollageSize | null>(null);
  const [collageFilled, setCollageFilled] = useState(0);
  const [isCollageRendering, setIsCollageRendering] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveDraft, setSaveDraft] = useState<{ blob: Blob; defaultName: string } | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveToastTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const collageCanvasRef = useRef<HTMLCanvasElement>(null);
  const collageFilledRef = useRef(0);
  const collageRenderingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoUrlRef = useRef<string | null>(null);
  const firstFrameRef = useRef<FrameResult | null>(null);
  const lastFrameRef = useRef<FrameResult | null>(null);
  const { items } = useAssetLibrary();
  const videoAssets = useMemo(() => items.filter((a) => a.kind === 'video'), [items]);

  const safeRevoke = (url: string | null) => {
    if (!url) return;
    if (!url.startsWith('blob:')) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    videoUrlRef.current = videoUrl;
  }, [videoUrl]);

  useEffect(() => {
    firstFrameRef.current = firstFrame;
  }, [firstFrame]);

  useEffect(() => {
    lastFrameRef.current = lastFrame;
  }, [lastFrame]);

  useEffect(() => {
    return () => {
      safeRevoke(videoUrlRef.current);
      if (firstFrameRef.current) URL.revokeObjectURL(firstFrameRef.current.url);
      if (lastFrameRef.current) URL.revokeObjectURL(lastFrameRef.current.url);
      if (saveToastTimerRef.current) window.clearTimeout(saveToastTimerRef.current);
    };
  }, []);

  const showSaveToast = (text: string, durationMs: number | null = 1500) => {
    if (!text) return;
    setSaveToast(text);
    if (saveToastTimerRef.current) window.clearTimeout(saveToastTimerRef.current);
    saveToastTimerRef.current = null;
    if (durationMs == null || durationMs <= 0) return;
    saveToastTimerRef.current = window.setTimeout(() => {
      setSaveToast(null);
      saveToastTimerRef.current = null;
    }, durationMs);
  };

  const resetFrames = () => {
    if (firstFrame) URL.revokeObjectURL(firstFrame.url);
    if (lastFrame) URL.revokeObjectURL(lastFrame.url);
    setFirstFrame(null);
    setLastFrame(null);
  };

  const resetCollage = () => {
    const canvas = collageCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }
    collageFilledRef.current = 0;
    collageRenderingRef.current = false;
    setCollageSize(null);
    setCollageFilled(0);
    setIsCollageRendering(false);
  };

  const handleFile = (file: File) => {
    if (!file || !file.type.startsWith('video/')) return;
    safeRevoke(videoUrl);
    resetFrames();
    resetCollage();
    setDuration(null);
    setError(null);
    setViewMode('frames');
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
  };

  const handlePickAsset = (src: string) => {
    const url = (src || '').trim();
    if (!url) return;
    safeRevoke(videoUrl);
    resetFrames();
    resetCollage();
    setDuration(null);
    setError(null);
    setViewMode('frames');
    setVideoUrl(url);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.duration > MAX_SECONDS) {
      setError(language === 'zh' ? '视频超过 30 秒，请上传更短的视频。' : 'Video exceeds 30 seconds.');
      safeRevoke(videoUrl);
      setVideoUrl(null);
      return;
    }
    setDuration(video.duration);
  };

  const seekTo = (time: number) =>
    new Promise<void>((resolve) => {
      const video = videoRef.current;
      if (!video) {
        resolve();
        return;
      }
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        video.removeEventListener('seeked', onSeeked);
        window.clearTimeout(timer);
        resolve();
      };
      const onSeeked = () => {
        cleanup();
      };
      const timer = window.setTimeout(() => cleanup(), 6000);
      video.addEventListener('seeked', onSeeked);
      try {
        video.currentTime = Math.max(0, Math.min(time, video.duration || time));
      } catch {
        cleanup();
      }
    });

  const captureFrame = async (type: 'first' | 'last') => {
    setViewMode('frames');
    const video = videoRef.current;
    if (!video) return;
    if (duration === null) return;
    const targetTime = type === 'first' ? 0 : Math.max(0, duration - 0.05);
    await seekTo(targetTime);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1;
    canvas.height = video.videoHeight || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    if (type === 'first') {
      if (firstFrame) URL.revokeObjectURL(firstFrame.url);
      setFirstFrame({ url, blob });
    } else {
      if (lastFrame) URL.revokeObjectURL(lastFrame.url);
      setLastFrame({ url, blob });
    }
  };

  const captureCollage = async () => {
    setViewMode('collage');
    const video = videoRef.current;
    const canvas = collageCanvasRef.current;
    if (!video || !canvas) return;
    if (!videoUrl || duration === null) return;
    if (collageRenderingRef.current || isCollageRendering) return;
    if (!video.videoWidth || !video.videoHeight) {
      setError(language === 'zh' ? '视频尚未就绪，无法抽帧。' : 'Video not ready.');
      return;
    }

    const total = collageGrid * collageGrid;
    const idx = collageFilledRef.current;
    if (idx >= total) {
      showSaveToast(language === 'zh' ? '宫格已满，请先下载或切换宫格。' : 'Grid is full. Download or change grid.');
      return;
    }

    collageRenderingRef.current = true;
    setIsCollageRendering(true);
    setError(null);

    try {
      const grid = collageGrid;
      const vw = video.videoWidth || 1;
      const vh = video.videoHeight || 1;
      const baseW = 1200;
      const initCellW = Math.max(1, Math.round(baseW / grid));
      const initCellH = Math.max(1, Math.round((initCellW * vh) / vw));
      const expectedW = initCellW * grid;
      const expectedH = initCellH * grid;

      if (canvas.width !== expectedW || canvas.height !== expectedH) {
        canvas.width = expectedW;
        canvas.height = expectedH;
        const initCtx = canvas.getContext('2d');
        if (initCtx) {
          initCtx.fillStyle = '#ffffff';
          initCtx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }

      if (!collageSize) {
        setCollageSize({ w: canvas.width, h: canvas.height });
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const cellW = canvas.width / grid;
      const cellH = canvas.height / grid;
      const col = idx % grid;
      const row = Math.floor(idx / grid);
      const x = col * cellW;
      const y = row * cellH;

      const srcW = video.videoWidth || 1;
      const srcH = video.videoHeight || 1;
      const scale = Math.max(cellW / srcW, cellH / srcH);
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const dx = x + (cellW - drawW) / 2;
      const dy = y + (cellH - drawH) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cellW, cellH);
      ctx.clip();
      ctx.drawImage(video, dx, dy, drawW, drawH);
      ctx.restore();

      collageFilledRef.current = idx + 1;
      setCollageFilled(idx + 1);
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      setError(
        language === 'zh'
          ? `抽帧失败：${msg || '未知错误'}`
          : `Failed to capture frame: ${msg || 'Unknown error'}`
      );
    } finally {
      collageRenderingRef.current = false;
      setIsCollageRendering(false);
    }
  };

  const clearLastCollageFrame = () => {
    setViewMode('collage');
    if (collageRenderingRef.current || isCollageRendering) return;
    const canvas = collageCanvasRef.current;
    if (!canvas) return;

    const idx = collageFilledRef.current - 1;
    if (idx < 0) return;

    if (canvas.width <= 0 || canvas.height <= 0) {
      collageFilledRef.current = 0;
      setCollageFilled(0);
      setCollageSize(null);
      return;
    }

    const grid = collageGrid;
    const cellW = canvas.width / grid;
    const cellH = canvas.height / grid;
    const col = idx % grid;
    const row = Math.floor(idx / grid);
    const x = col * cellW;
    const y = row * cellH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, cellW, cellH);
    ctx.restore();

    collageFilledRef.current = idx;
    setCollageFilled(idx);
  };

  const downloadFrame = (frame: FrameResult, filename: string) => {
    const tempUrl = URL.createObjectURL(frame.blob);
    const link = document.createElement('a');
    link.href = tempUrl;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(tempUrl), 1000);
  };

  const downloadCollage = () => {
    const canvas = collageCanvasRef.current;
    if (!canvas || canvas.width <= 0) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `video_collage_${collageGrid}x${collageGrid}_${Date.now()}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="w-[94%] max-w-4xl h-[78vh] bg-white/90 dark:bg-gray-900/90 border border-gray-200/80 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Film size={18} />
            </div>
            <div>
              <div className="text-lg font-semibold">{language === 'zh' ? '提取视频帧' : 'Video Frames'}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {language === 'zh' ? '支持 30 秒内视频' : 'Up to 30s videos'}
              </div>
            </div>
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

        <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10 flex flex-wrap gap-3 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.currentTarget.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 h-9 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5"
          >
            {language === 'zh' ? '上传视频' : 'Upload Video'}
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={videoAssets.length === 0}
            className="px-4 h-9 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            <Library size={16} />
            {language === 'zh' ? '从素材库选取' : 'From Library'}
          </button>
          {duration !== null && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {language === 'zh' ? '时长' : 'Duration'}: {duration.toFixed(2)}s
            </div>
          )}
          {error && <div className="text-xs text-red-500">{error}</div>}
          {saveToast && <div className="text-xs text-emerald-600 dark:text-emerald-400">{saveToast}</div>}
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-900/70 p-4 flex flex-col gap-4">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {language === 'zh' ? '视频预览' : 'Preview'}
            </div>
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                onLoadedMetadata={handleLoadedMetadata}
                className="w-full rounded-xl border border-gray-200/70 dark:border-white/10 bg-black"
              />
            ) : (
              <div className="h-48 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center text-gray-400 text-sm">
                {language === 'zh' ? '请上传视频' : 'Upload a video file'}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => captureFrame('first')}
                disabled={!videoUrl || duration === null}
                className={
                  viewMode === 'frames'
                    ? 'px-5 h-10 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50'
                    : 'px-5 h-10 rounded-xl border border-gray-200/70 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-50'
                }
              >
                {language === 'zh' ? '提取首帧' : 'First frame'}
              </button>
              <button
                type="button"
                onClick={() => captureFrame('last')}
                disabled={!videoUrl || duration === null}
                className="px-5 h-10 rounded-xl border border-gray-200/70 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-50"
              >
                {language === 'zh' ? '提取尾帧' : 'Last frame'}
              </button>
              <button
                type="button"
                onClick={() => void captureCollage()}
                disabled={!videoUrl || duration === null || isCollageRendering}
                className={
                  viewMode === 'collage'
                    ? 'px-5 h-10 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50'
                    : 'px-5 h-10 rounded-xl border border-gray-200/70 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-50'
                }
              >
                {language === 'zh' ? '视频抽帧' : 'Extract frames'}
              </button>
              <button
                type="button"
                onClick={clearLastCollageFrame}
                disabled={collageFilled <= 0 || isCollageRendering}
                className="px-4 h-10 rounded-xl border border-gray-200/70 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-50"
              >
                {language === 'zh' ? '清除上一帧' : 'Undo'}
              </button>
              {viewMode === 'collage' && (
                <button
                  type="button"
                  onClick={downloadCollage}
                  disabled={collageFilled <= 0 || isCollageRendering}
                  className="px-4 h-10 rounded-xl border border-gray-200/70 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Download size={16} />
                  {language === 'zh' ? '下载拼贴' : 'Download'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {language === 'zh' ? '视频拼接宫格数量' : 'Grid size'}
              </div>
              {[
                { value: 3 as const, labelZh: '3*3宫格', labelEn: '3×3' },
                { value: 5 as const, labelZh: '5*5宫格', labelEn: '5×5' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isCollageRendering}
                  onClick={() => {
                    if (collageGrid === opt.value) return;
                    setCollageGrid(opt.value);
                    resetCollage();
                  }}
                  className={
                    collageGrid === opt.value
                      ? 'h-8 px-3 rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed'
                      : 'h-8 px-3 rounded-lg border border-gray-200/70 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed'
                  }
                >
                  {language === 'zh' ? opt.labelZh : opt.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-900/70 p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {viewMode === 'collage' ? (language === 'zh' ? '拼贴预览' : 'Collage') : language === 'zh' ? '提取结果' : 'Frames'}
              </div>
              {viewMode === 'collage' && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {language === 'zh'
                    ? `已填充 ${collageFilled}/${collageGrid * collageGrid}`
                    : `Filled ${collageFilled}/${collageGrid * collageGrid}`}
                </div>
              )}
            </div>
            <div className={viewMode === 'collage' ? '' : 'hidden'}>
              <div className="relative min-h-[240px] rounded-xl border border-dashed border-gray-200/70 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-center overflow-hidden">
                {!(collageSize || collageFilled > 0) && (
                  <div className="text-xs text-gray-400">
                    {isCollageRendering
                      ? language === 'zh'
                        ? '正在抽帧…'
                        : 'Capturing…'
                      : language === 'zh'
                        ? '暂停视频后点击「视频抽帧」把当前画面填入宫格'
                        : 'Pause the video, then click “Extract frames” to fill the grid'}
                  </div>
                )}
                <canvas
                  ref={collageCanvasRef}
                  className={collageSize || collageFilled > 0 ? 'max-w-full h-auto' : 'hidden'}
                />
              </div>
              {collageSize && (
                <div className="text-[11px] text-gray-400">
                  {collageSize.w} × {collageSize.h}
                </div>
              )}
            </div>

            <div className={viewMode === 'collage' ? 'hidden' : 'grid grid-cols-1 gap-4'}>
              {[
                { label: language === 'zh' ? '首帧' : 'First', data: firstFrame, name: 'first' },
                { label: language === 'zh' ? '尾帧' : 'Last', data: lastFrame, name: 'last' },
              ].map((item) => (
                  <div key={item.name} className="rounded-xl border border-gray-200/70 dark:border-white/10 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{item.label}</div>
                    {item.data ? (
                      <>
                        <img
                          src={item.data.url}
                          alt={item.label}
                          className="w-full rounded-lg border border-gray-200/70 dark:border-white/10"
                        />
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => downloadFrame(item.data!, `frame_${item.name}.png`)}
                            className="h-8 px-3 rounded-lg border border-gray-200/70 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 inline-flex items-center gap-2"
                          >
                            <Download size={12} />
                            {language === 'zh' ? '下载' : 'Download'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSaveDraft({ blob: item.data!.blob, defaultName: `frame_${item.name}_${Date.now()}` })
                            }
                            disabled={isSaving}
                            className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                          >
                            <Library size={12} />
                            {language === 'zh' ? '保存到素材库' : 'Save'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="h-24 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center text-gray-400 text-xs">
                        {language === 'zh' ? '暂无' : 'Empty'}
                      </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AssetPickerModal
        isOpen={pickerOpen}
        language={language}
        assets={videoAssets}
        kind="video"
        title={language === 'zh' ? '从素材库选择视频' : 'Pick a video'}
        onClose={() => setPickerOpen(false)}
        onPick={(asset) => {
          setPickerOpen(false);
          handlePickAsset(asset.src);
        }}
      />

      <AssetNameModal
        isOpen={Boolean(saveDraft)}
        language={language}
        title={language === 'zh' ? '保存到素材库' : 'Save to Library'}
        defaultValue={saveDraft?.defaultName || ''}
        onCancel={() => setSaveDraft(null)}
        onConfirm={(name) => {
          const draft = saveDraft;
          if (!draft) return;
          setSaveDraft(null);
          showSaveToast(language === 'zh' ? '正在保存…' : 'Saving…', null);
          setIsSaving(true);
          void (async () => {
            try {
              const safeName = (name || '').trim() || draft.defaultName || `frame_${Date.now()}`;
              const created = await addAssetLibraryBlobItem({ kind: 'image', name: safeName, blob: draft.blob });
              showSaveToast(created ? (language === 'zh' ? '已保存到素材库' : 'Saved') : language === 'zh' ? '保存失败' : 'Failed');
            } catch (e: any) {
              const msg = String(e?.message || e || '');
              showSaveToast(
                language === 'zh' ? `保存失败：${msg || '未知错误'}` : `Failed: ${msg || 'Unknown error'}`,
                2200
              );
            } finally {
              setIsSaving(false);
            }
          })();
        }}
      />
    </div>
  );
};
