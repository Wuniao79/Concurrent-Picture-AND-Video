import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clapperboard,
  Download,
  FastForward,
  Library,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  Rewind,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { AssetLibraryItem, Language } from '../../types';
import { useAssetLibrary } from '../../hooks/useAssetLibrary';
import { AssetPickerModal } from '../modals/AssetPickerModal';
import { AssetNameModal } from '../modals/AssetNameModal';
import { fetchBlobWithProxy } from '../../utils/download';
import { addAssetLibraryBlobItem } from '../../utils/assetLibrary';

interface QuickTimelineModalProps {
  isOpen: boolean;
  language: Language;
  downloadProxyUrl?: string;
  timelineAudioSplitEnabled?: boolean;
  onClose: () => void;
}

type TimelineClip = {
  id: string;
  name: string;
  src: string;
  previewUrl: string;
  previewNeedsRevoke: boolean;
  durationSec?: number;
  thumbUrl?: string;
};

type PreviewMode = 'clip' | 'merged';

type ClipSegment = {
  clip: TimelineClip;
  durationSec: number;
  widthPx: number;
  startTimeSec: number;
  endTimeSec: number;
  startPx: number;
  endPx: number;
};

const TIMELINE_PX_PER_SEC = 24;
const TIMELINE_STEP_SEC = 5;
const TIMELINE_MIN_CLIP_PX = 120;
const TIMELINE_FALLBACK_DURATION_SEC = 10;
const TIMELINE_ADD_BLOCK_PX = 120;

const safeRevokeObjectUrl = (url: string) => {
  if (!url) return;
  if (!url.startsWith('blob:')) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const formatClock = (seconds: number) => {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
};

const isBlobUrl = (url: string) => url.startsWith('blob:');

const captureVideoThumbnail = async (src: string) => {
  if (!src) return { thumbUrl: null as string | null, durationSec: null as number | null };
  if (typeof document === 'undefined') return { thumbUrl: null, durationSec: null };

  return await new Promise<{ thumbUrl: string | null; durationSec: number | null }>((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let durationSec: number | null = null;
    let done = false;
    const finish = (thumbUrl: string | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try {
        video.removeAttribute('src');
        video.load();
      } catch {
        // ignore
      }
      resolve({ thumbUrl, durationSec });
    };

    const timer = window.setTimeout(() => finish(null), 6500);

    video.addEventListener(
      'error',
      () => {
        finish(null);
      },
      { once: true }
    );

    video.addEventListener(
      'loadedmetadata',
      () => {
        durationSec = Number.isFinite(video.duration) ? video.duration : null;
        const d = Number.isFinite(video.duration) ? video.duration : 0;
        const target = d > 0 ? Math.min(0.12, Math.max(0.05, d * 0.04)) : 0.1;
        try {
          video.currentTime = Math.min(target, Math.max(0, d - 0.05));
        } catch {
          // ignore
        }
      },
      { once: true }
    );

    video.addEventListener(
      'seeked',
      () => {
        try {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (!vw || !vh) {
            finish(null);
            return;
          }
          const maxW = 240;
          const scale = Math.min(1, maxW / vw);
          const cw = Math.max(1, Math.round(vw * scale));
          const ch = Math.max(1, Math.round(vh * scale));
          const canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            finish(null);
            return;
          }
          ctx.drawImage(video, 0, 0, cw, ch);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
          finish(dataUrl);
        } catch {
          finish(null);
        }
      },
      { once: true }
    );

    try {
      video.src = src;
      video.load();
    } catch {
      finish(null);
    }
  });
};

const pickRecorderMimeType = () => {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const t of candidates) {
    try {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      // ignore
    }
  }
  return '';
};

const inferVideoExt = (mimeType: string) => {
  const t = (mimeType || '').toLowerCase();
  if (t.includes('video/mp4')) return 'mp4';
  return 'webm';
};

const waitFor = (target: EventTarget, event: string) =>
  new Promise<void>((resolve) => {
    const handler = () => {
      target.removeEventListener(event, handler as any);
      resolve();
    };
    target.addEventListener(event, handler as any);
  });

export const QuickTimelineModal: React.FC<QuickTimelineModalProps> = ({
  isOpen,
  language,
  downloadProxyUrl,
  timelineAudioSplitEnabled = false,
  onClose,
}) => {
  const t = (zh: string, en: string) => (language === 'zh' ? zh : en);
  const { items } = useAssetLibrary();
  const videoAssets = useMemo(() => items.filter((a) => a.kind === 'video'), [items]);

  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [audioClipIds, setAudioClipIds] = useState<string[]>([]);
  const [audioDragOverId, setAudioDragOverId] = useState<string | null>(null);
  const audioDragIdRef = useRef<string | null>(null);
  const [audioTrackMuted, setAudioTrackMuted] = useState(false);
  const audioTrackTouchedRef = useRef(false);
  const knownClipIdsRef = useRef<string[]>([]);

  const [previewMode, setPreviewMode] = useState<PreviewMode>('clip');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewTimeSec, setPreviewTimeSec] = useState(0);
  const [previewDurationSec, setPreviewDurationSec] = useState(0);
  const [previewMuted, setPreviewMuted] = useState(false);
  const [previewVolume, setPreviewVolume] = useState(0.9);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);

  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [mergedExt, setMergedExt] = useState<'webm' | 'mp4'>('webm');
  const mergedUrlRef = useRef<string | null>(null);
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);
  const [saveDraft, setSaveDraft] = useState<{ defaultName: string } | null>(null);
  const saveToastTimerRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const recordVideoRef = useRef<HTMLVideoElement>(null);
  const recordAudioRef = useRef<HTMLVideoElement>(null);
  const recordAudioCtxRef = useRef<AudioContext | null>(null);
  const recordAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const recordAudioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mergedBlobRef = useRef<Blob | null>(null);
  const mergedMimeTypeRef = useRef<string>('');
  const thumbJobRef = useRef(0);
  const pendingClipSeekRef = useRef<{ clipId: string; localTimeSec: number; autoPlay: boolean } | null>(null);
  const playheadDragRef = useRef<{ pointerId: number } | null>(null);

  useEffect(() => {
    mergedUrlRef.current = mergedUrl;
  }, [mergedUrl]);

  const cleanupAll = useCallback(() => {
    thumbJobRef.current += 1;
    setMergeError(null);
    setMergeProgress(null);
    setIsMerging(false);
    setIsSavingToLibrary(false);
    setSaveDraft(null);
    if (saveToastTimerRef.current) {
      window.clearTimeout(saveToastTimerRef.current);
      saveToastTimerRef.current = null;
    }
    setPickerOpen(false);
    setDragOverId(null);
    dragIdRef.current = null;
    setAudioClipIds([]);
    setAudioDragOverId(null);
    audioDragIdRef.current = null;
    setAudioTrackMuted(false);
    audioTrackTouchedRef.current = false;
    knownClipIdsRef.current = [];
    setPreviewMode('clip');
    setSelectedClipId(null);
    setIsPreviewPlaying(false);
    setPreviewTimeSec(0);
    setPreviewDurationSec(0);
    setPreviewMuted(false);
    setPreviewVolume(0.9);
    setIsPreviewFullscreen(false);
    if (mergedUrlRef.current) safeRevokeObjectUrl(mergedUrlRef.current);
    mergedUrlRef.current = null;
    setMergedUrl(null);
    setMergedExt('webm');
    mergedBlobRef.current = null;
    mergedMimeTypeRef.current = '';
    setClips((prev) => {
      prev.forEach((c) => {
        if (c.previewNeedsRevoke) safeRevokeObjectUrl(c.previewUrl);
      });
      return [];
    });
  }, []);

  useEffect(() => {
    if (isOpen) return;
    cleanupAll();
  }, [cleanupAll, isOpen]);

  const resolveClipDurationSec = (clip: TimelineClip) => {
    const duration = typeof clip.durationSec === 'number' ? clip.durationSec : NaN;
    if (Number.isFinite(duration) && duration > 0) return duration;
    return TIMELINE_FALLBACK_DURATION_SEC;
  };

  const resolveClipWidthPx = (durationSec: number) =>
    Math.max(TIMELINE_MIN_CLIP_PX, Math.round(durationSec * TIMELINE_PX_PER_SEC));

  const segments = useMemo<ClipSegment[]>(() => {
    let tCursor = 0;
    let pCursor = 0;
    return clips.map((clip) => {
      const durationSec = resolveClipDurationSec(clip);
      const widthPx = resolveClipWidthPx(durationSec);
      const seg: ClipSegment = {
        clip,
        durationSec,
        widthPx,
        startTimeSec: tCursor,
        endTimeSec: tCursor + durationSec,
        startPx: pCursor,
        endPx: pCursor + widthPx,
      };
      tCursor += durationSec;
      pCursor += widthPx;
      return seg;
    });
  }, [clips]);

  const timelineTotalTimeSec = segments.length > 0 ? segments[segments.length - 1].endTimeSec : 0;
  const timelineTotalPx = segments.length > 0 ? segments[segments.length - 1].endPx : 0;
  const timelineWidthPx = Math.max(720, timelineTotalPx + TIMELINE_ADD_BLOCK_PX);

  const resolveTimeToPx = useCallback(
    (timeSec: number) => {
      const tValue = clamp(timeSec, 0, Math.max(0, timelineTotalTimeSec));
      if (segments.length === 0) return 0;
      for (const seg of segments) {
        if (tValue <= seg.endTimeSec || seg === segments[segments.length - 1]) {
          const span = seg.durationSec > 0 ? seg.durationSec : 1;
          const ratio = (tValue - seg.startTimeSec) / span;
          return seg.startPx + ratio * seg.widthPx;
        }
      }
      return timelineTotalPx;
    },
    [segments, timelineTotalPx, timelineTotalTimeSec]
  );

  const resolvePxToTime = useCallback(
    (px: number) => {
      const pValue = clamp(px, 0, Math.max(0, timelineTotalPx));
      if (segments.length === 0) return 0;
      for (const seg of segments) {
        if (pValue <= seg.endPx || seg === segments[segments.length - 1]) {
          const spanPx = seg.widthPx > 0 ? seg.widthPx : 1;
          const ratio = (pValue - seg.startPx) / spanPx;
          return seg.startTimeSec + ratio * seg.durationSec;
        }
      }
      return timelineTotalTimeSec;
    },
    [segments, timelineTotalPx, timelineTotalTimeSec]
  );

  const rulerMarks = useMemo(() => {
    const marks: number[] = [];
    const total = Math.max(0, timelineTotalTimeSec);
    if (total <= 0) return marks;
    for (let sec = 0; sec <= total + 0.0001; sec += TIMELINE_STEP_SEC) {
      marks.push(sec);
    }
    if (marks.length > 0 && marks[marks.length - 1] !== total) {
      marks.push(total);
    }
    return marks;
  }, [timelineTotalTimeSec]);

  const segmentByClipId = useMemo(() => {
    const map = new Map<string, ClipSegment>();
    for (const seg of segments) map.set(seg.clip.id, seg);
    return map;
  }, [segments]);

  const clipById = useMemo(() => {
    const map = new Map<string, TimelineClip>();
    for (const clip of clips) map.set(clip.id, clip);
    return map;
  }, [clips]);

  const audioClips = useMemo(() => {
    const list: TimelineClip[] = [];
    for (const id of audioClipIds) {
      const clip = clipById.get(id);
      if (clip) list.push(clip);
    }
    return list;
  }, [audioClipIds, clipById]);

  const audioSegments = useMemo<ClipSegment[]>(() => {
    if (audioClips.length === 0) return [];
    const total = Math.max(0, timelineTotalTimeSec);
    if (total <= 0) return [];
    let tCursor = 0;
    return audioClips.map((clip) => {
      const durationSec = resolveClipDurationSec(clip);
      const startTimeSec = tCursor;
      const endTimeSec = tCursor + durationSec;
      const startPx = resolveTimeToPx(startTimeSec);
      const endPx = resolveTimeToPx(Math.min(endTimeSec, total));
      const widthPx = Math.max(1, Math.round(endPx - startPx));
      const seg: ClipSegment = {
        clip,
        durationSec,
        widthPx,
        startTimeSec,
        endTimeSec,
        startPx,
        endPx,
      };
      tCursor += durationSec;
      return seg;
    });
  }, [audioClips, resolveTimeToPx, timelineTotalTimeSec]);

  const selectedSegment = useMemo(() => {
    if (!selectedClipId) return segments[0] || null;
    return segmentByClipId.get(selectedClipId) || segments[0] || null;
  }, [segmentByClipId, segments, selectedClipId]);

  const selectedClip = useMemo(() => {
    if (!selectedClipId) return null;
    return clips.find((c) => c.id === selectedClipId) || null;
  }, [clips, selectedClipId]);

  useEffect(() => {
    if (clips.length === 0) {
      setSelectedClipId(null);
      return;
    }
    if (selectedClipId && clips.some((c) => c.id === selectedClipId)) return;
    setSelectedClipId(clips[0].id);
  }, [clips, selectedClipId]);

  useEffect(() => {
    const clipIds = clips.map((c) => c.id);
    const prevClipIds = knownClipIdsRef.current;
    const addedClipIds = clipIds.filter((id) => !prevClipIds.includes(id));
    knownClipIdsRef.current = clipIds;

    setAudioClipIds((prev) => {
      const filtered = prev.filter((id) => clipIds.includes(id));
      if (!timelineAudioSplitEnabled) return filtered;
      if (!audioTrackTouchedRef.current) return clipIds;
      if (addedClipIds.length === 0) return filtered;
      const next = [...filtered];
      for (const id of addedClipIds) {
        if (!next.includes(id)) next.push(id);
      }
      return next;
    });
  }, [clips, timelineAudioSplitEnabled]);

  useEffect(() => {
    if (!mergedUrl) return;
    setPreviewMode('merged');
  }, [mergedUrl]);

  const previewSrc = useMemo(() => {
    if (previewMode === 'merged' && mergedUrl) return mergedUrl;
    if (selectedClip) return selectedClip.previewUrl;
    if (mergedUrl) return mergedUrl;
    return null;
  }, [mergedUrl, previewMode, selectedClip]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    try {
      video.pause();
    } catch {
      // ignore
    }
    setIsPreviewPlaying(false);
    if (previewMode === 'merged') {
      setPreviewTimeSec(0);
      setPreviewDurationSec(0);
    }
  }, [previewMode, previewSrc]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    try {
      video.muted = previewMuted;
      video.volume = clamp(previewVolume, 0, 1);
    } catch {
      // ignore
    }
  }, [previewMuted, previewVolume, previewSrc]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    const handleLoaded = () => {
      if (previewMode === 'merged') {
        setPreviewDurationSec(Number.isFinite(video.duration) ? video.duration : 0);
        return;
      }
      setPreviewDurationSec(timelineTotalTimeSec);
    };

    const handleTime = () => {
      const localTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      if (previewMode === 'merged') {
        setPreviewTimeSec(localTime);
        return;
      }
      const base = selectedSegment?.startTimeSec ?? 0;
      const next = base + localTime;
      setPreviewTimeSec(clamp(next, 0, Math.max(0, timelineTotalTimeSec)));
    };

    const handlePlay = () => setIsPreviewPlaying(true);
    const handlePause = () => setIsPreviewPlaying(false);
    const handleEnded = () => {
      if (previewMode === 'merged') {
        setIsPreviewPlaying(false);
        return;
      }
      if (!selectedClipId || segments.length === 0) {
        setIsPreviewPlaying(false);
        return;
      }
      const idx = segments.findIndex((s) => s.clip.id === selectedClipId);
      if (idx < 0) {
        setIsPreviewPlaying(false);
        return;
      }
      if (idx >= segments.length - 1) {
        setIsPreviewPlaying(false);
        setPreviewTimeSec(Math.max(0, timelineTotalTimeSec));
        return;
      }
      const nextSeg = segments[idx + 1];
      pendingClipSeekRef.current = { clipId: nextSeg.clip.id, localTimeSec: 0, autoPlay: true };
      setPreviewTimeSec(nextSeg.startTimeSec);
      setPreviewDurationSec(timelineTotalTimeSec);
      setSelectedClipId(nextSeg.clip.id);
    };
    video.addEventListener('loadedmetadata', handleLoaded);
    video.addEventListener('timeupdate', handleTime);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    return () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('timeupdate', handleTime);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [previewMode, previewSrc, segments, selectedClipId, selectedSegment, timelineTotalTimeSec]);

  const resolveTimelineLocation = useCallback(
    (timeSec: number) => {
      const total = Math.max(0, timelineTotalTimeSec);
      const tValue = clamp(timeSec, 0, total);
      if (segments.length === 0) return null;
      for (let idx = 0; idx < segments.length; idx += 1) {
        const seg = segments[idx];
        const isLast = idx === segments.length - 1;
        if (tValue < seg.endTimeSec || isLast) {
          const rawLocal = tValue - seg.startTimeSec;
          const local = clamp(rawLocal, 0, Math.max(0, seg.durationSec));
          if (!isLast && local >= seg.durationSec - 0.001 && tValue > 0) {
            const nextSeg = segments[idx + 1];
            return { seg: nextSeg, index: idx + 1, globalTimeSec: nextSeg.startTimeSec, localTimeSec: 0 };
          }
          return { seg, index: idx, globalTimeSec: tValue, localTimeSec: local };
        }
      }
      return null;
    },
    [segments, timelineTotalTimeSec]
  );

  const applyPendingClipSeek = useCallback(
    async (pending: { clipId: string; localTimeSec: number; autoPlay: boolean }) => {
      const video = previewVideoRef.current;
      if (!video) return;
      if (previewMode !== 'clip') return;
      if (pending.clipId !== selectedClipId) return;
      try {
        const duration = Number.isFinite(video.duration) ? video.duration : pending.localTimeSec;
        const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : pending.localTimeSec;
        video.currentTime = clamp(pending.localTimeSec, 0, Math.max(0, safeDuration));
      } catch {
        // ignore
      }
      if (pending.autoPlay) {
        try {
          await video.play();
        } catch {
          // ignore
        }
      }
      pendingClipSeekRef.current = null;
    },
    [previewMode, selectedClipId]
  );

  useEffect(() => {
    if (previewMode !== 'clip') return;
    const pending = pendingClipSeekRef.current;
    if (!pending) return;
    if (!selectedClipId || pending.clipId !== selectedClipId) return;
    const video = previewVideoRef.current;
    if (!video) return;
    if (video.readyState >= 1) {
      void applyPendingClipSeek(pending);
      return;
    }
    const handler = () => {
      const nextPending = pendingClipSeekRef.current;
      if (!nextPending) return;
      void applyPendingClipSeek(nextPending);
    };
    video.addEventListener('loadedmetadata', handler, { once: true });
    return () => {
      video.removeEventListener('loadedmetadata', handler);
    };
  }, [applyPendingClipSeek, previewMode, previewSrc, selectedClipId]);

  useEffect(() => {
    if (previewMode !== 'clip') return;
    const total = Math.max(0, timelineTotalTimeSec);
    setPreviewDurationSec(total);
    setPreviewTimeSec((prev) => clamp(prev, 0, total));
  }, [previewMode, timelineTotalTimeSec]);

  useEffect(() => {
    if (!isPreviewPlaying) return;
    if (previewMode !== 'clip') return;
    const scroller = timelineScrollRef.current;
    if (!scroller) return;
    const px = resolveTimeToPx(previewTimeSec);
    const left = scroller.scrollLeft;
    const right = left + scroller.clientWidth;
    const pad = 160;
    if (px < left + pad) {
      scroller.scrollLeft = Math.max(0, px - pad);
    } else if (px > right - pad) {
      scroller.scrollLeft = Math.max(0, px - scroller.clientWidth + pad);
    }
  }, [isPreviewPlaying, previewMode, previewTimeSec, resolveTimeToPx]);

  useEffect(() => {
    const handleFs = () => {
      const current = previewFrameRef.current;
      const active = typeof document !== 'undefined' ? (document.fullscreenElement as Element | null) : null;
      setIsPreviewFullscreen(Boolean(current && active === current));
    };
    document.addEventListener('fullscreenchange', handleFs);
    return () => {
      document.removeEventListener('fullscreenchange', handleFs);
    };
  }, []);

  const togglePreviewFullscreen = useCallback(async () => {
    const el = previewFrameRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await el.requestFullscreen();
    } catch {
      // ignore
    }
  }, []);

  const togglePreviewPlay = async () => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (!previewSrc) return;
    try {
      if (!video.paused) {
        video.pause();
        return;
      }
      if (previewMode === 'clip' && segments.length > 0) {
        const target = previewTimeSec >= timelineTotalTimeSec - 0.05 ? 0 : previewTimeSec;
        const loc = resolveTimelineLocation(target);
        if (loc) {
          pendingClipSeekRef.current = { clipId: loc.seg.clip.id, localTimeSec: loc.localTimeSec, autoPlay: true };
          setPreviewMode('clip');
          setPreviewTimeSec(loc.globalTimeSec);
          setPreviewDurationSec(timelineTotalTimeSec);
          if (selectedClipId !== loc.seg.clip.id) {
            setSelectedClipId(loc.seg.clip.id);
            return;
          }
          const pending = pendingClipSeekRef.current;
          if (pending) await applyPendingClipSeek(pending);
          return;
        }
      }
      await video.play();
    } catch {
      // ignore
    }
  };

  const seekPreview = (nextTimeSec: number) => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (previewMode === 'merged') {
      const duration = Number.isFinite(video.duration) ? video.duration : previewDurationSec;
      const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
      const next = safeDuration > 0 ? clamp(nextTimeSec, 0, safeDuration) : Math.max(0, nextTimeSec);
      try {
        video.currentTime = next;
      } catch {
        // ignore
      }
      return;
    }

    const loc = resolveTimelineLocation(nextTimeSec);
    if (!loc) return;
    const autoPlay = !video.paused;
    pendingClipSeekRef.current = { clipId: loc.seg.clip.id, localTimeSec: loc.localTimeSec, autoPlay };
    setPreviewMode('clip');
    setPreviewTimeSec(loc.globalTimeSec);
    setPreviewDurationSec(timelineTotalTimeSec);
    if (selectedClipId !== loc.seg.clip.id) {
      setSelectedClipId(loc.seg.clip.id);
      return;
    }
    const pending = pendingClipSeekRef.current;
    if (pending) void applyPendingClipSeek(pending);
  };

  const scrubTimelineByClientX = (clientX: number) => {
    if (previewMode !== 'clip') return;
    const scroller = timelineScrollRef.current;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const px = clientX - rect.left + scroller.scrollLeft;
    const tValue = resolvePxToTime(px);
    seekPreview(tValue);
  };

  const handlePlayheadPointerDown = (e: React.PointerEvent) => {
    if (previewMode !== 'clip') return;
    e.preventDefault();
    e.stopPropagation();
    playheadDragRef.current = { pointerId: e.pointerId };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    scrubTimelineByClientX(e.clientX);
  };

  const handlePlayheadPointerMove = (e: React.PointerEvent) => {
    const cur = playheadDragRef.current;
    if (!cur || cur.pointerId !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    scrubTimelineByClientX(e.clientX);
  };

  const handlePlayheadPointerUp = (e: React.PointerEvent) => {
    const cur = playheadDragRef.current;
    if (!cur || cur.pointerId !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    playheadDragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const queueClipThumbnail = useCallback((clipId: string, previewUrl: string) => {
    if (!clipId) return;
    if (!isBlobUrl(previewUrl)) return;
    const token = thumbJobRef.current;
    void captureVideoThumbnail(previewUrl).then(({ thumbUrl, durationSec }) => {
      if (thumbJobRef.current !== token) return;
      setClips((prev) =>
        prev.map((c) => {
          if (c.id !== clipId) return c;
          let next = c;
          if (thumbUrl && c.thumbUrl !== thumbUrl) next = { ...next, thumbUrl };
          if (
            typeof durationSec === 'number' &&
            Number.isFinite(durationSec) &&
            durationSec > 0 &&
            (!(typeof c.durationSec === 'number') || Math.abs(c.durationSec - durationSec) >= 0.02)
          ) {
            next = { ...next, durationSec };
          }
          return next;
        })
      );
    });
  }, []);

  const addFiles = (files: File[]) => {
    const next: TimelineClip[] = [];
    for (const file of files) {
      if (!file || !file.type || !file.type.startsWith('video/')) continue;
      const url = URL.createObjectURL(file);
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      next.push({
        id,
        name: file.name || t('未命名视频', 'Unnamed video'),
        src: url,
        previewUrl: url,
        previewNeedsRevoke: true,
        durationSec: undefined,
      });
      queueClipThumbnail(id, url);
    }
    if (next.length === 0) return;
    setClips((prev) => [...prev, ...next]);
  };

  const addFromLibrary = (asset: AssetLibraryItem) => {
    const src = (asset?.src || '').trim();
    if (!src) return;
    const id = asset.id + '_' + Date.now();
    setClips((prev) => [
      ...prev,
      {
        id,
        name: asset.name || t('素材视频', 'Library video'),
        src,
        previewUrl: src,
        previewNeedsRevoke: false,
        durationSec: undefined,
      },
    ]);
    queueClipThumbnail(id, src);
  };

  const updateClipDuration = (id: string, durationSec: number) => {
    if (!id) return;
    if (!Number.isFinite(durationSec) || durationSec <= 0) return;
    setClips((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (typeof c.durationSec === 'number' && Math.abs(c.durationSec - durationSec) < 0.02) return c;
        return { ...c, durationSec };
      })
    );
  };

  const reorderByIds = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    setClips((prev) => {
      const fromIdx = prev.findIndex((c) => c.id === fromId);
      const toIdx = prev.findIndex((c) => c.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const reorderAudioByIds = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    audioTrackTouchedRef.current = true;
    setAudioClipIds((prev) => {
      const fromIdx = prev.findIndex((id) => id === fromId);
      const toIdx = prev.findIndex((id) => id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const removeAudioClip = (id: string) => {
    if (!id) return;
    audioTrackTouchedRef.current = true;
    setAudioClipIds((prev) => prev.filter((cid) => cid !== id));
    setAudioDragOverId((cur) => (cur === id ? null : cur));
  };

  const removeClip = (id: string) => {
    setClips((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target?.previewNeedsRevoke) safeRevokeObjectUrl(target.previewUrl);
      return prev.filter((c) => c.id !== id);
    });
    setDragOverId((cur) => (cur === id ? null : cur));
    setSelectedClipId((cur) => (cur === id ? null : cur));
    setAudioClipIds((prev) => prev.filter((cid) => cid !== id));
    setAudioDragOverId((cur) => (cur === id ? null : cur));
  };

  const clearTimeline = () => {
    if (clips.length === 0) return;
    const ok = window.confirm(t('确定清空时间线吗？', 'Clear the timeline?'));
    if (!ok) return;
    thumbJobRef.current += 1;
    setClips((prev) => {
      prev.forEach((c) => {
        if (c.previewNeedsRevoke) safeRevokeObjectUrl(c.previewUrl);
      });
      return [];
    });
    setAudioClipIds([]);
    setAudioDragOverId(null);
    audioDragIdRef.current = null;
    setAudioTrackMuted(false);
    audioTrackTouchedRef.current = false;
    knownClipIdsRef.current = [];
    setSelectedClipId(null);
    setDragOverId(null);
    setMergeError(null);
    setMergeProgress(null);
    setIsSavingToLibrary(false);
    setSaveDraft(null);
    if (saveToastTimerRef.current) {
      window.clearTimeout(saveToastTimerRef.current);
      saveToastTimerRef.current = null;
    }
    setMergedUrl((prev) => {
      if (prev) safeRevokeObjectUrl(prev);
      return null;
    });
    setMergedExt('webm');
    mergedBlobRef.current = null;
    mergedMimeTypeRef.current = '';
    setPreviewMode('clip');
  };

  const downloadMergedUrl = useCallback((url: string, ext: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    const safeExt = (ext || 'webm').replace(/[^a-z0-9]+/gi, '').toLowerCase() || 'webm';
    a.download = `timeline_${Date.now()}.${safeExt}`;
    a.click();
  }, []);

  const handleDownloadMerged = useCallback(() => {
    if (!mergedUrl) return;
    downloadMergedUrl(mergedUrl, mergedExt);
  }, [downloadMergedUrl, mergedExt, mergedUrl]);

  const mergeClips = useCallback(async (): Promise<{ url: string; ext: 'webm' | 'mp4' } | null> => {
    if (isMerging) return null;
    if (clips.length < 1) return null;
    setMergeError(null);
    setMergedUrl((prev) => {
      if (prev) safeRevokeObjectUrl(prev);
      return null;
    });
    setMergedExt('webm');
    mergedBlobRef.current = null;
    mergedMimeTypeRef.current = '';
    setIsMerging(true);
    setMergeProgress(t('准备合并…', 'Preparing…'));

    const tempUrlsToRevoke: string[] = [];
    try {
      const sources: string[] = [];
      for (let idx = 0; idx < clips.length; idx += 1) {
        const clip = clips[idx];
        if (clip.previewUrl.startsWith('blob:')) {
          sources.push(clip.previewUrl);
          continue;
        }
        setMergeProgress(t(`下载素材 ${idx + 1}/${clips.length}…`, `Downloading ${idx + 1}/${clips.length}…`));
        const blob = await fetchBlobWithProxy(clip.src, downloadProxyUrl);
        const url = URL.createObjectURL(blob);
        tempUrlsToRevoke.push(url);
        sources.push(url);
      }

      const video = recordVideoRef.current;
      if (!video) throw new Error(t('内部错误：缺少录制组件', 'Internal error: missing recorder'));
      if (typeof MediaRecorder === 'undefined') {
        throw new Error(t('当前浏览器不支持合并（缺少 MediaRecorder）', 'MediaRecorder not supported'));
      }

      const mimeType = pickRecorderMimeType();

      const waitForMediaEndOrError = (el: HTMLMediaElement) =>
        new Promise<void>((resolve) => {
          const cleanup = () => {
            el.removeEventListener('ended', cleanup);
            el.removeEventListener('error', cleanup);
            resolve();
          };
          el.addEventListener('ended', cleanup);
          el.addEventListener('error', cleanup);
        });

      const sourceByClipId = new Map<string, string>();
      for (let idx = 0; idx < clips.length; idx += 1) {
        const clip = clips[idx];
        const src = sources[idx];
        if (clip && src) sourceByClipId.set(clip.id, src);
      }

      const wantsAudio = timelineAudioSplitEnabled ? !audioTrackMuted && audioClipIds.length > 0 : true;
      const audioSources = wantsAudio
        ? timelineAudioSplitEnabled
          ? audioClipIds.map((id) => sourceByClipId.get(id)).filter((v): v is string => Boolean(v))
          : sources
        : [];

      let includeAudio = audioSources.length > 0;
      const audio = includeAudio ? recordAudioRef.current : null;
      if (includeAudio && !audio) includeAudio = false;

      let audioDestStream: MediaStream | null = null;
      if (includeAudio && audio) {
        const anyWindow = window as any;
        const AudioCtor: typeof AudioContext | undefined = anyWindow.AudioContext || anyWindow.webkitAudioContext;
        if (!AudioCtor) {
          includeAudio = false;
        } else {
          let audioCtx = recordAudioCtxRef.current;
          if (!audioCtx) {
            audioCtx = new AudioCtor();
            recordAudioCtxRef.current = audioCtx;
          }
          try {
            if (audioCtx.state === 'suspended') await audioCtx.resume();
          } catch {
            // ignore
          }

          let dest = recordAudioDestRef.current;
          if (!dest) {
            dest = audioCtx.createMediaStreamDestination();
            recordAudioDestRef.current = dest;
          }

          let sourceNode = recordAudioSourceRef.current;
          if (!sourceNode) {
            try {
              sourceNode = audioCtx.createMediaElementSource(audio);
              recordAudioSourceRef.current = sourceNode;
              sourceNode.connect(dest);
            } catch {
              includeAudio = false;
            }
          }

          if (includeAudio) {
            audioDestStream = dest.stream;
            audio.muted = false;
            audio.playsInline = true;
            audio.controls = false;
            audio.preload = 'auto';
            audio.loop = false;
            audio.playbackRate = 1;
            audio.pause();
            audio.src = audioSources[0] || '';
            audio.load();
            await Promise.race([waitFor(audio, 'loadedmetadata'), waitFor(audio, 'error')]);
          }
        }
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error(t('合并失败：无法初始化画布', 'Merge failed: canvas unavailable'));

      video.muted = true;
      video.playsInline = true;
      video.controls = false;
      video.preload = 'auto';
      video.loop = false;
      video.playbackRate = 1;

      video.pause();
      video.src = sources[0] || '';
      video.load();
      await waitFor(video, 'loadedmetadata');

      const vw0 = Number(video.videoWidth) || 0;
      const vh0 = Number(video.videoHeight) || 0;
      if (!vw0 || !vh0) throw new Error(t('合并失败：读取视频尺寸失败', 'Merge failed: invalid video size'));

      const maxW = 1920;
      const maxH = 1080;
      const scale = Math.min(1, maxW / vw0, maxH / vh0);
      canvas.width = Math.max(2, Math.round(vw0 * scale));
      canvas.height = Math.max(2, Math.round(vh0 * scale));
      try {
        ctx.imageSmoothingEnabled = true;
        (ctx as any).imageSmoothingQuality = 'high';
      } catch {
        // ignore
      }

      const drawFrame = () => {
        const vw = Number(video.videoWidth) || 0;
        const vh = Number(video.videoHeight) || 0;
        if (!vw || !vh) return;
        const cw = canvas.width;
        const ch = canvas.height;
        if (!cw || !ch) return;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, cw, ch);
        const s = Math.min(cw / vw, ch / vh);
        const dw = vw * s;
        const dh = vh * s;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;
        try {
          ctx.drawImage(video, dx, dy, dw, dh);
        } catch {
          // ignore
        }
      };

      let rafId = 0;
      let stopDrawing = false;
      let lastTs = 0;
      const fps = 30;
      const renderLoop = (ts: number) => {
        if (stopDrawing) return;
        if (!lastTs || ts - lastTs >= 1000 / fps) {
          lastTs = ts;
          if (video.readyState >= 2) drawFrame();
        }
        rafId = window.requestAnimationFrame(renderLoop);
      };
      rafId = window.requestAnimationFrame(renderLoop);

      const canvasStream = canvas.captureStream(fps);
      if (canvasStream.getVideoTracks().length === 0) {
        stopDrawing = true;
        window.cancelAnimationFrame(rafId);
        throw new Error(t('合并失败：无法捕获画布视频轨道', 'Merge failed: cannot capture canvas stream'));
      }

      const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
      if (includeAudio && audioDestStream) tracks.push(...audioDestStream.getAudioTracks());
      const outStream = new MediaStream(tracks);

      const recorder = new MediaRecorder(outStream, mimeType ? { mimeType } : undefined);
      const ext = inferVideoExt(recorder.mimeType || mimeType || 'video/webm') as 'webm' | 'mp4';
      const chunks: BlobPart[] = [];

      recorder.addEventListener('dataavailable', (e) => {
        const blob = (e as BlobEvent).data;
        if (blob && blob.size > 0) chunks.push(blob);
      });

      const stopPromise = new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.addEventListener('error', () => resolve(), { once: true });
      });

      recorder.start(800);

      let stopAudio = false;
      let stopAudioResolve: (() => void) | null = null;
      const stopAudioPromise =
        includeAudio && timelineAudioSplitEnabled
          ? new Promise<void>((resolve) => {
              stopAudioResolve = resolve;
            })
          : null;

      const stopAudioNow = () => {
        if (!includeAudio || !audio) return;
        if (!timelineAudioSplitEnabled) return;
        if (stopAudio) return;
        stopAudio = true;
        stopAudioResolve?.();
        stopAudioResolve = null;
        try {
          audio.pause();
        } catch {
          // ignore
        }
      };

      const audioTask =
        includeAudio && audio && timelineAudioSplitEnabled
          ? (async () => {
              for (let idx = 0; idx < audioSources.length; idx += 1) {
                if (stopAudio) break;
                if (idx > 0) {
                  audio.pause();
                  audio.src = audioSources[idx];
                  audio.load();
                  await Promise.race([waitFor(audio, 'loadedmetadata'), waitFor(audio, 'error')]);
                }
                try {
                  await audio.play();
                } catch {
                  // ignore
                }
                await Promise.race([waitForMediaEndOrError(audio), stopAudioPromise!]);
              }
            })()
          : null;

      for (let idx = 0; idx < sources.length; idx += 1) {
        setMergeProgress(t(`合并中 ${idx + 1}/${sources.length}…`, `Merging ${idx + 1}/${sources.length}…`));
        if (idx > 0) {
          video.pause();
          video.src = sources[idx];
          video.load();
          await waitFor(video, 'loadedmetadata');

          if (includeAudio && audio && !timelineAudioSplitEnabled) {
            audio.pause();
            audio.src = sources[idx];
            audio.load();
            await Promise.race([waitFor(audio, 'loadedmetadata'), waitFor(audio, 'error')]);
          }
        }
        if (includeAudio && audio && !timelineAudioSplitEnabled) {
          await Promise.allSettled([video.play(), audio.play()]);
          await Promise.all([waitForMediaEndOrError(video), waitForMediaEndOrError(audio)]);
        } else {
          try {
            await video.play();
          } catch {
            // ignore
          }
          await waitForMediaEndOrError(video);
        }
      }

      stopAudioNow();
      if (audioTask) await audioTask.catch(() => {});
      if (audio) {
        try {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        } catch {
          // ignore
        }
      }

      recorder.stop();
      await stopPromise;
      stopDrawing = true;
      window.cancelAnimationFrame(rafId);

      const outBlob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' });
      mergedBlobRef.current = outBlob;
      mergedMimeTypeRef.current = outBlob.type || recorder.mimeType || mimeType || 'video/webm';
      const outUrl = URL.createObjectURL(outBlob);
      setMergedUrl(outUrl);
      setMergedExt(ext);
      setMergeProgress(t(`合并完成（${ext.toUpperCase()}）`, `Done (${ext.toUpperCase()})`));
      return { url: outUrl, ext };
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      setMergeError(msg || t('合并失败', 'Merge failed'));
      setMergeProgress(null);
      return null;
    } finally {
      tempUrlsToRevoke.forEach((u) => safeRevokeObjectUrl(u));
      setIsMerging(false);
    }
  }, [audioClipIds, audioTrackMuted, clips, downloadProxyUrl, isMerging, t, timelineAudioSplitEnabled]);

  const mergeAndDownload = useCallback(async () => {
    const out = await mergeClips();
    if (out) downloadMergedUrl(out.url, out.ext);
  }, [downloadMergedUrl, mergeClips]);

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="w-[92%] max-w-5xl h-[78vh] bg-white/90 dark:bg-gray-900/90 border border-white/20 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/70 dark:border-white/10">
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Clapperboard size={18} />
            </div>
            <div>
              <div className="text-lg font-semibold">{t('时间线', 'Timeline')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('拖动片段排序后合并导出', 'Drag to reorder, then merge & export')}
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

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3">
                <span>
                  {t('片段', 'Clips')}: <span className="font-mono">{clips.length}</span>
                </span>
                <span>
                  {t('总时长', 'Total')}: <span className="font-mono">{formatClock(timelineTotalTimeSec)}</span>
                </span>
              </div>
              {mergedUrl && (
                <div className="flex items-center gap-2 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-900/40 p-1">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('clip')}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                      previewMode === 'clip'
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5'
                    }`}
                  >
                    {t('片段预览', 'Clips')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('merged')}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                      previewMode === 'merged'
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5'
                    }`}
                  >
                    {t('合并预览', 'Merged')}
                  </button>
                </div>
              )}
            </div>

              <div
                ref={previewFrameRef}
              className="flex-1 min-h-[220px] overflow-hidden rounded-xl border border-gray-200/70 dark:border-white/10 bg-black/40 relative"
              >
              {previewSrc ? (
                <video
                  ref={previewVideoRef}
                  src={previewSrc}
                  poster={previewMode === 'clip' ? selectedClip?.thumbUrl : undefined}
                  playsInline
                  preload="auto"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
                  {t('请添加视频片段', 'Add some video clips')}
                </div>
              )}

              {(isMerging || mergeProgress) && (
                <div className="absolute left-4 top-4 rounded-xl bg-black/55 text-white text-xs px-3 py-2 border border-white/10 flex items-center gap-2">
                  {isMerging && <Loader2 size={14} className="animate-spin" />}
                  <span className="whitespace-pre-line">{mergeProgress || t('处理中…', 'Working…')}</span>
                </div>
              )}

              {mergeError && (
                <div className="absolute left-4 bottom-4 rounded-xl bg-red-600/70 text-white text-xs px-3 py-2 border border-white/10 max-w-[80%]">
                  {mergeError}
                </div>
              )}

              {isPreviewFullscreen && (
                <div className="absolute inset-0 z-30 pointer-events-none">
                  <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-black/0 pointer-events-auto">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-mono text-white/85">
                        {formatClock(previewTimeSec)} / {formatClock(previewDurationSec)}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewMuted((v) => !v)}
                          className="h-9 w-9 rounded-xl border border-white/15 bg-black/30 text-white/85 hover:bg-black/45 hover:text-white inline-flex items-center justify-center"
                          aria-label={previewMuted ? t('取消静音', 'Unmute') : t('静音', 'Mute')}
                          title={previewMuted ? t('取消静音', 'Unmute') : t('静音', 'Mute')}
                        >
                          {previewMuted || previewVolume <= 0.001 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => void togglePreviewFullscreen()}
                          className="h-9 w-9 rounded-xl border border-white/15 bg-black/30 text-white/85 hover:bg-black/45 hover:text-white inline-flex items-center justify-center"
                          aria-label={t('退出全屏', 'Exit fullscreen')}
                          title={t('退出全屏', 'Exit fullscreen')}
                        >
                          <Minimize2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              try {
                                if (document.fullscreenElement) await document.exitFullscreen();
                              } catch {
                                // ignore
                              }
                              onClose();
                            })();
                          }}
                          className="h-9 w-9 rounded-xl border border-white/15 bg-black/30 text-white/85 hover:bg-black/45 hover:text-white inline-flex items-center justify-center"
                          aria-label={t('关闭', 'Close')}
                          title={t('关闭', 'Close')}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/75 to-black/0 pointer-events-auto">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => seekPreview(previewTimeSec - 5)}
                        disabled={!previewSrc}
                        className="h-10 w-10 rounded-xl border border-white/15 bg-black/30 text-white/85 hover:bg-black/45 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                        aria-label={t('后退 5 秒', 'Back 5s')}
                        title={t('后退 5 秒', 'Back 5s')}
                      >
                        <Rewind size={18} />
                      </button>

                      <button
                        type="button"
                        onClick={() => void togglePreviewPlay()}
                        disabled={!previewSrc}
                        className="h-10 w-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                        aria-label={isPreviewPlaying ? t('暂停', 'Pause') : t('播放', 'Play')}
                        title={isPreviewPlaying ? t('暂停', 'Pause') : t('播放', 'Play')}
                      >
                        {isPreviewPlaying ? <Pause size={18} /> : <Play size={18} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => seekPreview(previewTimeSec + 5)}
                        disabled={!previewSrc}
                        className="h-10 w-10 rounded-xl border border-white/15 bg-black/30 text-white/85 hover:bg-black/45 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                        aria-label={t('前进 5 秒', 'Forward 5s')}
                        title={t('前进 5 秒', 'Forward 5s')}
                      >
                        <FastForward size={18} />
                      </button>

                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, previewDurationSec || 0)}
                        step={0.05}
                        value={Math.min(previewTimeSec, previewDurationSec || previewTimeSec)}
                        onChange={(e) => seekPreview(Number(e.target.value))}
                        disabled={!previewSrc || previewDurationSec <= 0}
                        className="flex-1 min-w-[220px] accent-emerald-500 disabled:opacity-50"
                        aria-label={t('进度', 'Seek')}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-900/40 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => seekPreview(previewTimeSec - 5)}
                  disabled={!previewSrc}
                  className="h-9 w-9 rounded-xl border border-gray-200/70 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                  aria-label={t('后退 5 秒', 'Back 5s')}
                  title={t('后退 5 秒', 'Back 5s')}
                >
                  <Rewind size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => void togglePreviewPlay()}
                  disabled={!previewSrc}
                  className="h-9 w-9 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                  aria-label={isPreviewPlaying ? t('暂停', 'Pause') : t('播放', 'Play')}
                  title={isPreviewPlaying ? t('暂停', 'Pause') : t('播放', 'Play')}
                >
                  {isPreviewPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>

                <button
                  type="button"
                  onClick={() => seekPreview(previewTimeSec + 5)}
                  disabled={!previewSrc}
                  className="h-9 w-9 rounded-xl border border-gray-200/70 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                  aria-label={t('前进 5 秒', 'Forward 5s')}
                  title={t('前进 5 秒', 'Forward 5s')}
                >
                  <FastForward size={16} />
                </button>

                <div className="text-xs font-mono text-gray-600 dark:text-gray-300">
                  {formatClock(previewTimeSec)} / {formatClock(previewDurationSec)}
                </div>

                <input
                  type="range"
                  min={0}
                  max={Math.max(0, previewDurationSec || 0)}
                  step={0.05}
                  value={Math.min(previewTimeSec, previewDurationSec || previewTimeSec)}
                  onChange={(e) => seekPreview(Number(e.target.value))}
                  disabled={!previewSrc || previewDurationSec <= 0}
                  className="flex-1 min-w-[220px] accent-emerald-600 disabled:opacity-50"
                />

                <button
                  type="button"
                  onClick={() => setPreviewMuted((v) => !v)}
                  className="h-9 w-9 rounded-xl border border-gray-200/70 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 inline-flex items-center justify-center"
                  aria-label={previewMuted ? t('取消静音', 'Unmute') : t('静音', 'Mute')}
                  title={previewMuted ? t('取消静音', 'Unmute') : t('静音', 'Mute')}
                >
                  {previewMuted || previewVolume <= 0.001 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>

                <button
                  type="button"
                  onClick={() => void togglePreviewFullscreen()}
                  disabled={!previewSrc}
                  className="h-9 w-9 rounded-xl border border-gray-200/70 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                  aria-label={isPreviewFullscreen ? t('退出全屏', 'Exit fullscreen') : t('全屏', 'Fullscreen')}
                  title={isPreviewFullscreen ? t('退出全屏', 'Exit fullscreen') : t('全屏', 'Fullscreen')}
                >
                  {isPreviewFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                {mergedUrl && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!mergedBlobRef.current) return;
                        setSaveDraft({ defaultName: `timeline_${Date.now()}` });
                      }}
                      disabled={isSavingToLibrary || !mergedBlobRef.current}
                      className="h-9 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      <Library size={16} />
                      {t('保存到素材库', 'Save')}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMerged}
                      className="h-9 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 inline-flex items-center gap-2"
                    >
                      <Download size={16} />
                      {t('下载', 'Download')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200/70 dark:border-white/10 bg-gray-50/60 dark:bg-black/20">
            <div className="px-4 py-2.5 flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const list = Array.from(e.target.files || []);
                  if (list.length > 0) addFiles(list);
                  e.currentTarget.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 h-9 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 inline-flex items-center gap-2"
              >
                <Plus size={16} />
                {t('上传视频', 'Upload')}
              </button>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="px-4 h-9 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={videoAssets.length === 0}
              >
                <Library size={16} />
                {t('从素材库选取', 'From Library')}
              </button>
              <button
                type="button"
                onClick={clearTimeline}
                className="px-4 h-9 rounded-xl border border-red-200/70 dark:border-red-900/40 text-red-600 dark:text-red-300 hover:bg-red-50/80 dark:hover:bg-red-900/20 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={clips.length === 0}
              >
                <Trash2 size={16} />
                {t('清空', 'Clear')}
              </button>

              <div className="flex-1" />

              <button
                type="button"
                onClick={() => void mergeAndDownload()}
                disabled={isMerging || clips.length === 0}
                className="px-4 h-9 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isMerging ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
                {t('合并下载', 'Merge & Download')}
              </button>
            </div>

            <div className="px-4 pb-4">
              <div className="rounded-xl border border-gray-200/70 dark:border-white/10 bg-black/40 dark:bg-black/50 overflow-hidden">
                <div className={`flex ${timelineAudioSplitEnabled ? 'h-[184px]' : 'h-[140px]'}`}>
                  <div className="w-14 shrink-0 border-r border-white/10 bg-black/30 text-gray-200 flex flex-col items-center justify-start pt-6 gap-3">
                    <div className="h-9 w-9 rounded-xl border border-white/10 bg-black/20 text-white/80 flex items-center justify-center">
                      <Clapperboard size={16} />
                    </div>
                    {timelineAudioSplitEnabled && (
                      <button
                        type="button"
                        onClick={() => setAudioTrackMuted((v) => !v)}
                        className="h-9 w-9 rounded-xl border border-white/10 bg-black/20 text-white/70 hover:text-white hover:bg-white/5 flex items-center justify-center"
                        aria-label={audioTrackMuted ? t('取消静音轨道', 'Unmute lane') : t('静音轨道', 'Mute lane')}
                        title={audioTrackMuted ? t('取消静音轨道', 'Unmute lane') : t('静音轨道', 'Mute lane')}
                      >
                        {audioTrackMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                      </button>
                    )}
                  </div>

                  <div ref={timelineScrollRef} className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
                    <div className="relative" style={{ width: timelineWidthPx }}>
                      <div className="h-8 border-b border-white/10 relative">
                        {rulerMarks.map((sec) => {
                          const left = resolveTimeToPx(sec);
                          return (
                            <div key={sec} className="absolute top-0 bottom-0" style={{ left }}>
                              <div className="absolute top-1 -translate-x-1/2 text-[10px] font-mono text-white/60">
                                {formatClock(sec)}
                              </div>
                              <div className="absolute bottom-1 -translate-x-1/2 w-px h-3 bg-white/20" />
                            </div>
                          );
                        })}
                      </div>
 
                      <div
                        className={`relative ${timelineAudioSplitEnabled ? 'h-[128px]' : 'h-[84px]'} bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:120px_100%]`}
                      >
                        <div className="h-[84px] flex">
                          {segments.map((seg) => {
                            const clip = seg.clip;
                            const isSelected = clip.id === selectedClipId && previewMode === 'clip';
                            const isDragOver = dragOverId === clip.id;
                            return (
                              <div
                                key={clip.id}
                                role="button"
                                tabIndex={0}
                                draggable
                                title={clip.name}
                                aria-label={clip.name}
                                onClick={() => {
                                  pendingClipSeekRef.current = { clipId: clip.id, localTimeSec: 0, autoPlay: false };
                                  setPreviewMode('clip');
                                  setPreviewTimeSec(seg.startTimeSec);
                                  setPreviewDurationSec(timelineTotalTimeSec);
                                  setSelectedClipId(clip.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    pendingClipSeekRef.current = { clipId: clip.id, localTimeSec: 0, autoPlay: false };
                                    setPreviewMode('clip');
                                    setPreviewTimeSec(seg.startTimeSec);
                                    setPreviewDurationSec(timelineTotalTimeSec);
                                    setSelectedClipId(clip.id);
                                  }
                                }}
                                onDragStart={(e) => {
                                  dragIdRef.current = clip.id;
                                  try {
                                    e.dataTransfer.effectAllowed = 'move';
                                  } catch {
                                    // ignore
                                  }
                                }}
                                onDragEnd={() => {
                                  dragIdRef.current = null;
                                  setDragOverId(null);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setDragOverId(clip.id);
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const from = dragIdRef.current;
                                  if (from) reorderByIds(from, clip.id);
                                  dragIdRef.current = null;
                                  setDragOverId(null);
                                }}
                                className="relative h-full border-r border-white/10 cursor-pointer outline-none"
                                style={{ width: seg.widthPx }}
                              >
                                <div
                                  className={`group relative h-full m-[3px] rounded-xl overflow-hidden border border-white/10 bg-black/10 ${
                                    isSelected ? 'ring-2 ring-emerald-400/70 z-10' : ''
                                  } ${isDragOver ? 'ring-2 ring-blue-400/70 z-10' : ''}`}
                                >
                                  <video
                                    src={clip.previewUrl}
                                    muted
                                    playsInline
                                    preload={isBlobUrl(clip.previewUrl) ? 'auto' : 'metadata'}
                                    poster={clip.thumbUrl}
                                    onLoadedMetadata={(e) => updateClipDuration(clip.id, e.currentTarget.duration)}
                                    className="absolute inset-0 w-full h-full object-cover opacity-95 pointer-events-none"
                                  />
                                  {clip.thumbUrl && (
                                    <div
                                      className="absolute inset-0 pointer-events-none opacity-90"
                                      style={{
                                        backgroundImage: `url(${clip.thumbUrl})`,
                                        backgroundRepeat: 'repeat-x',
                                        backgroundSize: 'auto 100%',
                                      }}
                                    />
                                  )}
                                  <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[length:46px_100%] opacity-15 mix-blend-overlay" />
                                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-black/10 to-black/0" />

                                  <div className="absolute left-2 top-2 pointer-events-none text-[10px] font-mono text-white/70">
                                    {formatClock(seg.startTimeSec)}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeClip(clip.id);
                                    }}
                                    className="absolute right-2 top-2 h-7 w-7 rounded-lg bg-black/45 border border-white/10 text-white/80 hover:text-white hover:bg-black/65 inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label={t('删除片段', 'Remove')}
                                    title={t('删除片段', 'Remove')}
                                  >
                                    <X size={12} />
                                  </button>

                                  <div className="absolute left-2 right-2 bottom-2 pointer-events-none flex items-end justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-white truncate">{clip.name}</div>
                                    </div>
                                    <div className="text-[10px] font-mono text-white/70">{formatClock(seg.durationSec)}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-full border-r border-white/10 bg-black/10 hover:bg-white/5 text-white/70 hover:text-white inline-flex items-center justify-center"
                            style={{ width: TIMELINE_ADD_BLOCK_PX }}
                            title={t('添加视频', 'Add')}
                            aria-label={t('添加视频', 'Add')}
                          >
                            <Plus size={18} />
                          </button>
                        </div>

                        {timelineAudioSplitEnabled && (
                          <div
                            className={`h-[44px] border-t border-white/10 flex ${
                              audioTrackMuted ? 'opacity-50' : 'opacity-100'
                            }`}
                          >
                            {audioSegments.length === 0 ? (
                              <div className="flex-1 flex items-center justify-center text-xs text-white/40">
                                {t('音频轨道为空', 'Audio lane is empty')}
                              </div>
                            ) : (
                              audioSegments.map((seg) => {
                                const clip = seg.clip;
                                const isDragOver = audioDragOverId === clip.id;
                                return (
                                  <div
                                    key={`audio_${clip.id}`}
                                    role="button"
                                    tabIndex={0}
                                    draggable
                                    title={clip.name}
                                    aria-label={clip.name}
                                    onDragStart={(e) => {
                                      audioDragIdRef.current = clip.id;
                                      try {
                                        e.dataTransfer.effectAllowed = 'move';
                                      } catch {
                                        // ignore
                                      }
                                    }}
                                    onDragEnd={() => {
                                      audioDragIdRef.current = null;
                                      setAudioDragOverId(null);
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      setAudioDragOverId(clip.id);
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      const from = audioDragIdRef.current;
                                      if (from) reorderAudioByIds(from, clip.id);
                                      audioDragIdRef.current = null;
                                      setAudioDragOverId(null);
                                    }}
                                    className="relative h-full border-r border-white/10 cursor-pointer outline-none"
                                    style={{ width: seg.widthPx }}
                                  >
                                    <div
                                      className={`group relative h-full m-[3px] rounded-xl overflow-hidden border border-white/10 bg-black/10 ${
                                        isDragOver ? 'ring-2 ring-blue-400/70 z-10' : ''
                                      }`}
                                    >
                                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 via-emerald-500/10 to-transparent" />
                                      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[length:46px_100%] opacity-10 mix-blend-overlay" />
                                      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/55 via-black/10 to-black/0" />

                                      <div className="absolute left-2 top-2 pointer-events-none text-[10px] font-mono text-white/60">
                                        {formatClock(seg.startTimeSec)}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeAudioClip(clip.id);
                                        }}
                                        className="absolute right-2 top-2 h-6 w-6 rounded-lg bg-black/45 border border-white/10 text-white/80 hover:text-white hover:bg-black/65 inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label={t('移除音频', 'Remove audio')}
                                        title={t('移除音频', 'Remove audio')}
                                      >
                                        <X size={12} />
                                      </button>

                                      <div className="absolute left-2 right-2 bottom-2 pointer-events-none flex items-end justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="text-[11px] font-semibold text-white truncate">
                                            {clip.name}
                                          </div>
                                        </div>
                                        <div className="text-[10px] font-mono text-white/70">
                                          {formatClock(seg.durationSec)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}

                            <div
                              aria-hidden="true"
                              className="h-full border-r border-white/10 bg-black/5"
                              style={{ width: TIMELINE_ADD_BLOCK_PX }}
                            />
                          </div>
                        )}

                        <div
                          role="slider"
                          tabIndex={0}
                          aria-label={t('时间线游标', 'Timeline playhead')}
                          aria-valuemin={0}
                          aria-valuemax={Math.max(0, timelineTotalTimeSec)}
                          aria-valuenow={Math.max(0, Math.min(previewTimeSec, Math.max(0, timelineTotalTimeSec)))}
                          onPointerDown={handlePlayheadPointerDown}
                          onPointerMove={handlePlayheadPointerMove}
                          onPointerUp={handlePlayheadPointerUp}
                          onPointerCancel={handlePlayheadPointerUp}
                          className="absolute top-0 bottom-0 z-30 w-10 -translate-x-1/2 cursor-ew-resize touch-none select-none"
                          style={{ left: previewMode === 'clip' ? resolveTimeToPx(previewTimeSec) : 0 }}
                        >
                          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-white/85 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
                          <div className="absolute left-1/2 -translate-x-1/2 -top-1 h-3 w-3 rounded-full bg-white/90 border border-black/20 shadow-sm" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-14 shrink-0 border-l border-white/10 bg-black/30 flex flex-col items-center justify-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 w-9 rounded-xl border border-white/10 text-white/80 hover:text-white hover:bg-white/5 inline-flex items-center justify-center"
                      title={t('添加视频', 'Add')}
                      aria-label={t('添加视频', 'Add')}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AssetNameModal
        isOpen={Boolean(saveDraft)}
        language={language}
        title={t('保存到素材库', 'Save to Library')}
        defaultValue={saveDraft?.defaultName || ''}
        confirmText={t('保存', 'Save')}
        onCancel={() => {
          if (isSavingToLibrary) return;
          setSaveDraft(null);
        }}
        onConfirm={(name) => {
          const blob = mergedBlobRef.current;
          const safeName = (name || '').trim();
          if (!blob || !safeName) {
            setSaveDraft(null);
            return;
          }
          setIsSavingToLibrary(true);
          void (async () => {
            const created = await addAssetLibraryBlobItem({ kind: 'video', name: safeName, blob });
            setIsSavingToLibrary(false);
            setSaveDraft(null);
            setMergeError(null);
            setMergeProgress(created ? t('已保存到素材库', 'Saved to Library') : t('保存失败', 'Save failed'));
            if (saveToastTimerRef.current) {
              window.clearTimeout(saveToastTimerRef.current);
              saveToastTimerRef.current = null;
            }
            saveToastTimerRef.current = window.setTimeout(() => {
              setMergeProgress(null);
              saveToastTimerRef.current = null;
            }, 1800);
          })();
        }}
      />

      <AssetPickerModal
        isOpen={pickerOpen}
        language={language}
        assets={videoAssets}
        kind="video"
        title={t('从素材库选择视频', 'Pick videos')}
        onClose={() => setPickerOpen(false)}
        onPick={(asset) => {
          addFromLibrary(asset);
          setPickerOpen(false);
        }}
      />

      <video
        ref={recordVideoRef}
        className="fixed -left-[99999px] -top-[99999px] w-px h-px opacity-0 pointer-events-none"
      />
      <video
        ref={recordAudioRef}
        className="fixed -left-[99999px] -top-[99999px] w-px h-px opacity-0 pointer-events-none"
      />
    </div>
  );
};
