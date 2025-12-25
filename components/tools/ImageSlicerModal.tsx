import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Image as ImageIcon, Trash2, X } from 'lucide-react';
import { Language } from '../../types';

type SliceLine = {
  id: string;
  type: 'h' | 'v';
  percent: number;
};

type SliceResult = {
  id: string;
  url: string;
  width: number;
  height: number;
  blob: Blob;
};

const MIN_SLICE_PX = 4;

const createId = () => Math.random().toString(36).slice(2);

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const getMinGapPx = (axisSize: number) => {
  if (axisSize <= 0) return 0;
  return Math.max(1, Math.min(MIN_SLICE_PX, Math.floor(axisSize / 2)));
};

const clampLinePercent = (value: number, axisSize: number | null) => {
  const safeValue = clampPercent(value);
  if (!axisSize || axisSize <= 0) return safeValue;
  const minGap = getMinGapPx(axisSize);
  const minPercent = (minGap / axisSize) * 100;
  return Math.max(minPercent, Math.min(100 - minPercent, safeValue));
};

const buildStops = (percents: number[], axisSize: number) => {
  if (axisSize <= 0) return [0];
  const minGap = getMinGapPx(axisSize);
  const rawPositions = percents
    .map((percent) => Math.round((clampPercent(percent) / 100) * axisSize))
    .filter((pos) => pos > minGap && pos < axisSize - minGap)
    .sort((a, b) => a - b);

  const positions: number[] = [];
  rawPositions.forEach((pos) => {
    if (positions.length === 0 || pos - positions[positions.length - 1] >= minGap) {
      positions.push(pos);
    }
  });
  return [0, ...positions, axisSize];
};

interface ImageSlicerModalProps {
  isOpen: boolean;
  language: Language;
  onClose: () => void;
}

export const ImageSlicerModal: React.FC<ImageSlicerModalProps> = ({ isOpen, language, onClose }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [mode, setMode] = useState<'h' | 'v'>('h');
  const [lines, setLines] = useState<SliceLine[]>([]);
  const [forceSquare, setForceSquare] = useState(false);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<SliceResult[]>([]);
  const [dragging, setDragging] = useState<SliceLine | null>(null);
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetResults = useCallback(() => {
    setResults((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      resetResults();
    };
  }, [isOpen, resetResults]);

  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc);
    };
  }, [imageSrc]);

  const handleFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setLines([]);
    resetResults();
  };

  const onImageLoad = () => {
    if (!imageRef.current) return;
    setNaturalSize({
      w: imageRef.current.naturalWidth,
      h: imageRef.current.naturalHeight,
    });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!imageSrc || !imageBoxRef.current) return;
    if (dragging) return;
    const rect = imageBoxRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    const percent = mode === 'h' ? (y / rect.height) * 100 : (x / rect.width) * 100;
    const axisSize = naturalSize ? (mode === 'h' ? naturalSize.h : naturalSize.w) : mode === 'h' ? rect.height : rect.width;
    const nextLine: SliceLine = { id: createId(), type: mode, percent: clampLinePercent(percent, axisSize) };
    setLines((prev) => [...prev, nextLine]);
  };

  useEffect(() => {
    if (!dragging || !imageBoxRef.current) return;
    const handleMove = (event: PointerEvent) => {
      const rect = imageBoxRef.current?.getBoundingClientRect();
      if (!rect) return;
      const percent =
        dragging.type === 'h'
          ? ((event.clientY - rect.top) / rect.height) * 100
          : ((event.clientX - rect.left) / rect.width) * 100;
      const axisSize = naturalSize ? (dragging.type === 'h' ? naturalSize.h : naturalSize.w) : dragging.type === 'h' ? rect.height : rect.width;
      const next = clampLinePercent(percent, axisSize);
      setLines((prev) => prev.map((line) => (line.id === dragging.id ? { ...line, percent: next } : line)));
    };
    const handleUp = () => setDragging(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, naturalSize]);

  const sortedLines = useMemo(() => {
    const horizontal = lines.filter((l) => l.type === 'h').map((l) => l.percent).sort((a, b) => a - b);
    const vertical = lines.filter((l) => l.type === 'v').map((l) => l.percent).sort((a, b) => a - b);
    return { horizontal, vertical };
  }, [lines]);

  const generateSlices = async () => {
    if (!imageRef.current || !naturalSize) return;
    resetResults();
    setIsProcessing(true);

    const { w, h } = naturalSize;
    const xStops = buildStops(sortedLines.vertical, w);
    const yStops = buildStops(sortedLines.horizontal, h);
    const nextResults: SliceResult[] = [];

    for (let row = 0; row < yStops.length - 1; row += 1) {
      for (let col = 0; col < xStops.length - 1; col += 1) {
        const x0 = xStops[col];
        const x1 = xStops[col + 1];
        const y0 = yStops[row];
        const y1 = yStops[row + 1];
        const sliceW = Math.max(1, x1 - x0);
        const sliceH = Math.max(1, y1 - y0);
        const canvas = document.createElement('canvas');
        if (forceSquare) {
          const maxDim = Math.max(sliceW, sliceH);
          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, maxDim, maxDim);
          const offsetX = (maxDim - sliceW) / 2;
          const offsetY = (maxDim - sliceH) / 2;
          ctx.drawImage(imageRef.current, x0, y0, sliceW, sliceH, offsetX, offsetY, sliceW, sliceH);
        } else {
          canvas.width = sliceW;
          canvas.height = sliceH;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.drawImage(imageRef.current, x0, y0, sliceW, sliceH, 0, 0, sliceW, sliceH);
        }

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        nextResults.push({
          id: createId(),
          url,
          width: canvas.width,
          height: canvas.height,
          blob,
        });
      }
    }

    setResults(nextResults);
    setIsProcessing(false);
  };

  const downloadAll = () => {
    results.forEach((item, idx) => {
      const link = document.createElement('a');
      link.href = item.url;
      link.download = `slice_${idx + 1}.png`;
      link.click();
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="w-[94%] max-w-6xl h-[84vh] bg-white/90 dark:bg-gray-900/90 border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <ImageIcon size={18} />
            </div>
            <div>
              <div className="text-lg font-semibold">{language === 'zh' ? '图片分割工厂' : 'Image Slicer'}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {language === 'zh' ? '自由切片，支持一键下载' : 'Slice and export quickly.'}
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
            accept="image/*"
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
            {language === 'zh' ? '上传图片' : 'Upload'}
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {language === 'zh' ? '模式' : 'Mode'}:
            <button
              type="button"
              onClick={() => setMode('h')}
              className={`px-3 h-8 rounded-lg border text-xs font-semibold ${
                mode === 'h'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white/70 dark:bg-gray-800/60 border-gray-200/70 dark:border-white/10 text-gray-600 dark:text-gray-300'
              }`}
            >
              {language === 'zh' ? '横线' : 'Horizontal'}
            </button>
            <button
              type="button"
              onClick={() => setMode('v')}
              className={`px-3 h-8 rounded-lg border text-xs font-semibold ${
                mode === 'v'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white/70 dark:bg-gray-800/60 border-gray-200/70 dark:border-white/10 text-gray-600 dark:text-gray-300'
              }`}
            >
              {language === 'zh' ? '竖线' : 'Vertical'}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceSquare}
                onChange={(e) => setForceSquare(e.target.checked)}
              />
              {language === 'zh' ? '1:1 补全' : 'Force square'}
            </label>
            {forceSquare && (
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="h-6 w-6 rounded border border-gray-200"
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => setLines([])}
            className="px-3 h-9 rounded-xl border border-gray-200/70 dark:border-white/10 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5 flex items-center gap-2"
          >
            <Trash2 size={14} />
            {language === 'zh' ? '清空辅助线' : 'Clear lines'}
          </button>
          <button
            type="button"
            onClick={generateSlices}
            disabled={!imageSrc || isProcessing}
            className="px-4 h-9 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {isProcessing ? (language === 'zh' ? '处理中...' : 'Processing...') : language === 'zh' ? '生成切片' : 'Slice'}
          </button>
          <button
            type="button"
            onClick={downloadAll}
            disabled={results.length === 0}
            className="px-4 h-9 rounded-xl border border-gray-200/70 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-50"
          >
            {language === 'zh' ? '一键下载' : 'Download all'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-900/70 p-4">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
              {language === 'zh' ? '切片画布' : 'Canvas'}
            </div>
            <div
              className="relative w-full min-h-[320px] border border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800/50"
            >
              {!imageSrc && (
                <div className="text-sm text-gray-400 text-center px-4">
                  {language === 'zh' ? '点击上传图片后开始分割' : 'Upload an image to start slicing.'}
                </div>
              )}
              {imageSrc && (
                <div
                  ref={imageBoxRef}
                  className="relative inline-block max-w-full"
                  onClick={handleCanvasClick}
                >
                  <img
                    ref={imageRef}
                    src={imageSrc}
                    alt="slice-source"
                    onLoad={onImageLoad}
                    className="max-h-[420px] w-auto max-w-full object-contain"
                  />
                  {lines.map((line) => (
                    <div
                      key={line.id}
                      className={`absolute ${line.type === 'h' ? 'left-0 right-0 h-0.5' : 'top-0 bottom-0 w-0.5'} bg-blue-500/80`}
                      style={
                        line.type === 'h'
                          ? { top: `${line.percent}%` }
                          : { left: `${line.percent}%` }
                      }
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setDragging(line);
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLines((prev) => prev.filter((l) => l.id !== line.id));
                        }}
                        className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-500 flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-900/70 p-4">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
              {language === 'zh' ? '切片结果' : 'Slices'}
            </div>
            {results.length === 0 ? (
              <div className="text-sm text-gray-400">
                {language === 'zh' ? '暂无结果，点击生成切片' : 'No slices yet.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {results.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = item.url;
                      link.download = `slice_${idx + 1}.png`;
                      link.click();
                    }}
                    className="group rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-900/60 overflow-hidden text-left"
                  >
                    <img src={item.url} alt={`slice-${idx + 1}`} className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800" />
                    <div className="p-2 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
                      <span>{item.width}×{item.height}</span>
                      <Download size={12} className="opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

