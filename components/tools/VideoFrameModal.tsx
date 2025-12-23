import React, { useEffect, useRef, useState } from 'react';
import { Download, Film, X } from 'lucide-react';
import { Language } from '../../types';

interface VideoFrameModalProps {
  isOpen: boolean;
  language: Language;
  onClose: () => void;
}

type FrameResult = {
  url: string;
  blob: Blob;
};

const MAX_SECONDS = 30;

export const VideoFrameModal: React.FC<VideoFrameModalProps> = ({ isOpen, language, onClose }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstFrame, setFirstFrame] = useState<FrameResult | null>(null);
  const [lastFrame, setLastFrame] = useState<FrameResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoUrlRef = useRef<string | null>(null);
  const firstFrameRef = useRef<FrameResult | null>(null);
  const lastFrameRef = useRef<FrameResult | null>(null);

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
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      if (firstFrameRef.current) URL.revokeObjectURL(firstFrameRef.current.url);
      if (lastFrameRef.current) URL.revokeObjectURL(lastFrameRef.current.url);
    };
  }, []);

  const resetFrames = () => {
    if (firstFrame) URL.revokeObjectURL(firstFrame.url);
    if (lastFrame) URL.revokeObjectURL(lastFrame.url);
    setFirstFrame(null);
    setLastFrame(null);
  };

  const handleFile = (file: File) => {
    if (!file || !file.type.startsWith('video/')) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    resetFrames();
    setDuration(null);
    setError(null);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.duration > MAX_SECONDS) {
      setError(language === 'zh' ? '视频超过 30 秒，请上传更短的视频。' : 'Video exceeds 30 seconds.');
      if (videoUrl) URL.revokeObjectURL(videoUrl);
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
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = Math.max(0, Math.min(time, video.duration || time));
    });

  const captureFrame = async (type: 'first' | 'last') => {
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

  const downloadFrame = (frame: FrameResult, filename: string) => {
    const tempUrl = URL.createObjectURL(frame.blob);
    const link = document.createElement('a');
    link.href = tempUrl;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(tempUrl), 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="w-[94%] max-w-4xl h-[78vh] bg-white/90 dark:bg-gray-900/90 border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Film size={18} />
            </div>
            <div>
              <div className="text-lg font-semibold">{language === 'zh' ? '提取视频首尾帧' : 'Video Frames'}</div>
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
          {duration !== null && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {language === 'zh' ? '时长' : 'Duration'}: {duration.toFixed(2)}s
            </div>
          )}
          {error && <div className="text-xs text-red-500">{error}</div>}
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
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => captureFrame('first')}
                disabled={!videoUrl || duration === null}
                className="px-4 h-9 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {language === 'zh' ? '提取首帧' : 'First frame'}
              </button>
              <button
                type="button"
                onClick={() => captureFrame('last')}
                disabled={!videoUrl || duration === null}
                className="px-4 h-9 rounded-xl border border-gray-200/70 dark:border-white/10 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-50"
              >
                {language === 'zh' ? '提取尾帧' : 'Last frame'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-900/70 p-4 flex flex-col gap-4">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {language === 'zh' ? '提取结果' : 'Frames'}
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[{ label: language === 'zh' ? '首帧' : 'First', data: firstFrame, name: 'first' },
                { label: language === 'zh' ? '尾帧' : 'Last', data: lastFrame, name: 'last' }].map((item) => (
                <div key={item.name} className="rounded-xl border border-gray-200/70 dark:border-white/10 p-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{item.label}</div>
                  {item.data ? (
                    <>
                      <img src={item.data.url} alt={item.label} className="w-full rounded-lg border border-gray-200/70 dark:border-white/10" />
                      <button
                        type="button"
                        onClick={() => downloadFrame(item.data!, `frame_${item.name}.png`)}
                        className="mt-3 h-8 px-3 rounded-lg border border-gray-200/70 dark:border-white/10 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 inline-flex items-center gap-2"
                      >
                        <Download size={12} />
                        {language === 'zh' ? '下载' : 'Download'}
                      </button>
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
    </div>
  );
};
