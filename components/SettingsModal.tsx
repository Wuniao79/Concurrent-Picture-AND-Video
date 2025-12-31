import React, { useEffect, useRef, useState } from 'react';
import {
  AtSign,
  Cpu,
  Database,
  Eye,
  Globe,
  Github,
  Info,
  KeyRound,
  Link as LinkIcon,
  Lock,
  Monitor,
  Moon,
  Edit2,
  Plus,
  Settings,
  Search,
  Sparkles,
  Library,
  Sun,
  Star,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { ApiMode, Language, Model, ModelModality, ModelProvider, RoleCardItem, ThemeMode } from '../types';
import { RelaySite, GeminiKeySite } from '../hooks/useSettings';
import { v4 as uuidv4 } from 'uuid';
import { generateResponse } from '../services/geminiService';
import { AssetLibraryPanel } from './AssetLibraryPanel';

const readImageAsDataUrl = (file: File, maxSize = 512, quality = 0.82) =>
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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  downloadProxyUrl: string;
  setDownloadProxyUrl: (v: string) => void;
  timelineAudioSplitEnabled: boolean;
  setTimelineAudioSplitEnabled: (v: boolean) => void;
  concurrencyIntervalSec: number;
  setConcurrencyIntervalSec: (v: number) => void;
  isStreamEnabled: boolean;
  setIsStreamEnabled: (s: boolean) => void;
  apiMode: ApiMode;
  setApiMode: (mode: ApiMode) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  openaiApiUrl: string;
  setOpenaiApiUrl: (url: string) => void;
  geminiApiUrl: string;
  setGeminiApiUrl: (url: string) => void;
  geminiCustomBaseEnabled: boolean;
  setGeminiCustomBaseEnabled: (v: boolean) => void;
  geminiEnterpriseEnabled: boolean;
  setGeminiEnterpriseEnabled: (v: boolean) => void;
  geminiEnterpriseProjectId: string;
  setGeminiEnterpriseProjectId: (v: string) => void;
  geminiEnterpriseLocation: string;
  setGeminiEnterpriseLocation: (v: string) => void;
  geminiEnterpriseToken: string;
  setGeminiEnterpriseToken: (v: string) => void;
  availableModels: Model[];
  setAvailableModels: (models: Model[]) => void;
  devExperimentalEnabled: boolean;
  setDevExperimentalEnabled: (v: boolean) => void;
  laneCountLimit: number;
  setLaneCountLimit: (v: number) => void;
  historyButtonEnabled: boolean;
  setHistoryButtonEnabled: (v: boolean) => void;
  moreImagesEnabled: boolean;
  setMoreImagesEnabled: (v: boolean) => void;
  sora2piEnabled: boolean;
  setSora2piEnabled: (v: boolean) => void;
  roleCardsEnabled: boolean;
  setRoleCardsEnabled: (v: boolean) => void;
  roleCards: RoleCardItem[];
  setRoleCards: (items: RoleCardItem[]) => void;
  devTbd1Enabled: boolean;
  setDevTbd1Enabled: (v: boolean) => void;
  devTbd2Enabled: boolean;
  setDevTbd2Enabled: (v: boolean) => void;
  devFuture1Enabled: boolean;
  setDevFuture1Enabled: (v: boolean) => void;
  devFuture2Enabled: boolean;
  setDevFuture2Enabled: (v: boolean) => void;
  devFuture3Enabled: boolean;
  setDevFuture3Enabled: (v: boolean) => void;
  laneLimitUnlocked: boolean;
  setLaneLimitUnlocked: (v: boolean) => void;
  relays: RelaySite[];
  setRelays: (sites: RelaySite[]) => void;
  activeRelayId: string;
  setActiveRelayId: (id: string) => void;
  relayEnabled: boolean;
  setRelayEnabled: (v: boolean) => void;
  geminiKeys: GeminiKeySite[];
  setGeminiKeys: (sites: GeminiKeySite[]) => void;
  geminiKeyPoolEnabled: boolean;
  setGeminiKeyPoolEnabled: (v: boolean) => void;
  todayConcurrencyCount: number;
  totalConcurrencyCount: number;
  downloadDirectorySupported: boolean;
  downloadDirectoryName: string | null;
  onPickDownloadDirectory: () => Promise<FileSystemDirectoryHandle | null>;
  onClearDownloadDirectory: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  setTheme,
  language,
  setLanguage,
  fontSize,
  setFontSize,
  downloadProxyUrl,
  setDownloadProxyUrl,
  timelineAudioSplitEnabled,
  setTimelineAudioSplitEnabled,
  concurrencyIntervalSec,
  setConcurrencyIntervalSec,
  isStreamEnabled,
  setIsStreamEnabled,
  apiMode,
  setApiMode,
  openaiApiKey,
  setOpenaiApiKey,
  geminiApiKey,
  setGeminiApiKey,
  openaiApiUrl,
  setOpenaiApiUrl,
  geminiApiUrl,
  setGeminiApiUrl,
  geminiCustomBaseEnabled,
  setGeminiCustomBaseEnabled,
  geminiEnterpriseEnabled,
  setGeminiEnterpriseEnabled,
  geminiEnterpriseProjectId,
  setGeminiEnterpriseProjectId,
  geminiEnterpriseLocation,
  setGeminiEnterpriseLocation,
  geminiEnterpriseToken,
  setGeminiEnterpriseToken,
  availableModels,
  setAvailableModels,
  devExperimentalEnabled,
  setDevExperimentalEnabled,
  laneCountLimit,
  setLaneCountLimit,
  historyButtonEnabled,
  setHistoryButtonEnabled,
  moreImagesEnabled,
  setMoreImagesEnabled,
  sora2piEnabled,
  setSora2piEnabled,
  roleCardsEnabled,
  setRoleCardsEnabled,
  roleCards,
  setRoleCards,
  devTbd1Enabled,
  setDevTbd1Enabled,
  devTbd2Enabled,
  setDevTbd2Enabled,
  devFuture1Enabled,
  setDevFuture1Enabled,
  devFuture2Enabled,
  setDevFuture2Enabled,
  devFuture3Enabled,
  setDevFuture3Enabled,
  laneLimitUnlocked,
  setLaneLimitUnlocked,
  relays,
  setRelays,
  activeRelayId,
  setActiveRelayId,
  relayEnabled,
  setRelayEnabled,
  geminiKeys,
  setGeminiKeys,
  geminiKeyPoolEnabled,
  setGeminiKeyPoolEnabled,
  todayConcurrencyCount,
  totalConcurrencyCount,
  downloadDirectorySupported,
  downloadDirectoryName,
  onPickDownloadDirectory,
  onClearDownloadDirectory,
}) => {
  const t = (zh: string, en: string) => (language === 'zh' ? zh : en);

  const resolveModelModality = (model: Model): ModelModality => {
    if (model.modality) return model.modality;
    const id = (model.id || '').toLowerCase();
    if (id.includes('sora-video')) return 'video';
    if (id.includes('image')) return 'image';
    return 'text';
  };

  const renderModalityBadge = (modality: ModelModality) => {
    const label =
      modality === 'video' ? t('视频', 'Video') : modality === 'image' ? t('图片', 'Image') : t('文字', 'Text');
    const colorClass =
      modality === 'video'
        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
        : modality === 'image'
        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
        : 'bg-gray-200/70 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200';
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${colorClass}`}>
        {label}
      </span>
    );
  };

  const [activeTab, setActiveTab] = useState<
    'interface' | 'models' | 'apikey' | 'data' | 'assets' | 'sora2api' | 'roleCards' | 'about' | 'dev'
  >('interface');

  useEffect(() => {
    if (!sora2piEnabled && activeTab === 'sora2api') {
      setActiveTab('interface');
    }
  }, [activeTab, sora2piEnabled]);

  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelVision, setNewModelVision] = useState(true);
  const [newModelProvider, setNewModelProvider] = useState<ModelProvider>('openai');
  const [newModelModality, setNewModelModality] = useState<ModelModality>('text');
  const [modelFilter, setModelFilter] = useState<'all' | 'openai' | 'gemini'>('all');
  const [starCount, setStarCount] = useState<number | null>(null);
  const [starLoading, setStarLoading] = useState(false);
  const [showRelayMenu, setShowRelayMenu] = useState(false);
  const [geminiKeyTestLoading, setGeminiKeyTestLoading] = useState(false);
  const [geminiKeyTestResults, setGeminiKeyTestResults] = useState<
    Record<string, { ok: boolean; status?: number; message?: string }>
  >({});
  const [geminiKeyImportOpen, setGeminiKeyImportOpen] = useState(false);
  const [geminiKeyImportText, setGeminiKeyImportText] = useState('');
  const [modelsCollapsed, setModelsCollapsed] = useState(false);
  const [modelsSearch, setModelsSearch] = useState('');
  const [modelEditOpen, setModelEditOpen] = useState(false);
  const [modelEditOriginal, setModelEditOriginal] = useState<{ id: string; provider: ModelProvider } | null>(null);
  const [modelDraftId, setModelDraftId] = useState('');
  const [modelDraftName, setModelDraftName] = useState('');
  const [modelDraftVision, setModelDraftVision] = useState(true);
  const [modelDraftProvider, setModelDraftProvider] = useState<ModelProvider>('openai');
  const [modelDraftModality, setModelDraftModality] = useState<ModelModality>('text');
  const [modelDraftError, setModelDraftError] = useState('');

  const [roleCardAddOpen, setRoleCardAddOpen] = useState(false);
  const [roleCardsSearch, setRoleCardsSearch] = useState('');
  const [roleCardEditingId, setRoleCardEditingId] = useState<string | null>(null);
  const [roleCardDraftKind, setRoleCardDraftKind] = useState<'role' | 'prompt'>('role');
  const [roleCardDraftAlias, setRoleCardDraftAlias] = useState('');
  const [roleCardDraftAtId, setRoleCardDraftAtId] = useState('');
  const [roleCardDraftInsertContent, setRoleCardDraftInsertContent] = useState('');
  const [roleCardDraftAvatar, setRoleCardDraftAvatar] = useState<string | null>(null);
  const [roleCardDraftNote, setRoleCardDraftNote] = useState('');
  const [roleCardDraftError, setRoleCardDraftError] = useState('');
  const roleCardAvatarInputRef = useRef<HTMLInputElement>(null);
  const roleCardImportInputRef = useRef<HTMLInputElement>(null);
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [avatarCropZoom, setAvatarCropZoom] = useState(1);
  const [avatarCropOffset, setAvatarCropOffset] = useState({ x: 0, y: 0 });
  const [avatarCropNaturalSize, setAvatarCropNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const avatarCropImgRef = useRef<HTMLImageElement | null>(null);
  const avatarCropDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const isOpenaiMode = apiMode === 'openai';
  const [aboutVersionTapCount, setAboutVersionTapCount] = useState(0);
  const [laneLimitGateOpen, setLaneLimitGateOpen] = useState(false);
  const [laneLimitGateText, setLaneLimitGateText] = useState('');
  const [laneLimitGateError, setLaneLimitGateError] = useState('');
  const LANE_LIMIT_GATE_PHRASE = '我是开发者，我自愿承担后果。';
  const clampConcurrencyInterval = (value: number) => Math.max(0.1, Math.min(60, value));
  const formatConcurrencyInterval = (value: number) => {
    if (!Number.isFinite(value)) return '0.5';
    const fixed = value.toFixed(2);
    return fixed.replace(/\.?0+$/, '');
  };
  const [intervalDraft, setIntervalDraft] = useState(() => formatConcurrencyInterval(concurrencyIntervalSec));

  const toastTimerRef = useRef<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const showToast = (message: string) => {
    if (!message) return;
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 1500);
  };

  const copyText = async (text: string, toastLabel?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        // ignore
      }
    }
    showToast(toastLabel || t('已复制', 'Copied'));
  };

  const resetRoleCardDraft = () => {
    setRoleCardEditingId(null);
    setRoleCardDraftKind('role');
    setRoleCardDraftAlias('');
    setRoleCardDraftAtId('');
    setRoleCardDraftInsertContent('');
    setRoleCardDraftAvatar(null);
    setRoleCardDraftNote('');
    setRoleCardDraftError('');
    setAvatarCropOpen(false);
    setAvatarCropSrc(null);
    setAvatarCropZoom(1);
    setAvatarCropOffset({ x: 0, y: 0 });
    setAvatarCropNaturalSize(null);
    avatarCropImgRef.current = null;
    avatarCropDragRef.current = null;
    if (roleCardAvatarInputRef.current) {
      roleCardAvatarInputRef.current.value = '';
    }
  };

  const AVATAR_CROP_VIEW_SIZE = 320;
  const AVATAR_CROP_PADDING = 18;
  const AVATAR_CROP_OUTPUT_SIZE = 256;

  const resolveAvatarCropScale = () => {
    if (!avatarCropNaturalSize) return null;
    const cropSize = AVATAR_CROP_VIEW_SIZE - AVATAR_CROP_PADDING * 2;
    const baseScale = Math.max(cropSize / avatarCropNaturalSize.w, cropSize / avatarCropNaturalSize.h);
    return { cropSize, baseScale, scale: baseScale * avatarCropZoom };
  };

  const clampAvatarCropOffset = (next: { x: number; y: number }, scale: number) => {
    if (!avatarCropNaturalSize) return next;
    const viewCenter = AVATAR_CROP_VIEW_SIZE / 2;
    const cropLeft = AVATAR_CROP_PADDING;
    const cropRight = AVATAR_CROP_VIEW_SIZE - AVATAR_CROP_PADDING;
    const cropTop = AVATAR_CROP_PADDING;
    const cropBottom = AVATAR_CROP_VIEW_SIZE - AVATAR_CROP_PADDING;

    const halfW = (avatarCropNaturalSize.w * scale) / 2;
    const halfH = (avatarCropNaturalSize.h * scale) / 2;

    const minX = cropRight - viewCenter - halfW;
    const maxX = cropLeft - viewCenter + halfW;
    const minY = cropBottom - viewCenter - halfH;
    const maxY = cropTop - viewCenter + halfH;

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    return {
      x: clamp(next.x, minX, maxX),
      y: clamp(next.y, minY, maxY),
    };
  };

  useEffect(() => {
    if (!avatarCropOpen || !avatarCropNaturalSize) return;
    const cropSize = AVATAR_CROP_VIEW_SIZE - AVATAR_CROP_PADDING * 2;
    const baseScale = Math.max(cropSize / avatarCropNaturalSize.w, cropSize / avatarCropNaturalSize.h);
    const scale = baseScale * avatarCropZoom;

    setAvatarCropOffset((prev) => {
      const viewCenter = AVATAR_CROP_VIEW_SIZE / 2;
      const cropLeft = AVATAR_CROP_PADDING;
      const cropRight = AVATAR_CROP_VIEW_SIZE - AVATAR_CROP_PADDING;
      const cropTop = AVATAR_CROP_PADDING;
      const cropBottom = AVATAR_CROP_VIEW_SIZE - AVATAR_CROP_PADDING;

      const halfW = (avatarCropNaturalSize.w * scale) / 2;
      const halfH = (avatarCropNaturalSize.h * scale) / 2;

      const minX = cropRight - viewCenter - halfW;
      const maxX = cropLeft - viewCenter + halfW;
      const minY = cropBottom - viewCenter - halfH;
      const maxY = cropTop - viewCenter + halfH;

      const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
      const next = {
        x: clamp(prev.x, minX, maxX),
        y: clamp(prev.y, minY, maxY),
      };
      if (next.x === prev.x && next.y === prev.y) return prev;
      return next;
    });
  }, [avatarCropOpen, avatarCropZoom, avatarCropNaturalSize]);

  const openAvatarCropper = (dataUrl: string) => {
    setAvatarCropSrc(dataUrl);
    setAvatarCropOpen(true);
    setAvatarCropZoom(1);
    setAvatarCropOffset({ x: 0, y: 0 });
    setAvatarCropNaturalSize(null);
    avatarCropImgRef.current = null;
    avatarCropDragRef.current = null;
  };

  const closeAvatarCropper = () => {
    setAvatarCropOpen(false);
    setAvatarCropSrc(null);
    setAvatarCropZoom(1);
    setAvatarCropOffset({ x: 0, y: 0 });
    setAvatarCropNaturalSize(null);
    avatarCropImgRef.current = null;
    avatarCropDragRef.current = null;
  };

  const commitAvatarCrop = () => {
    const img = avatarCropImgRef.current;
    const src = avatarCropSrc;
    if (!img || !src || !avatarCropNaturalSize) {
      closeAvatarCropper();
      return;
    }

    const resolved = resolveAvatarCropScale();
    if (!resolved) {
      closeAvatarCropper();
      return;
    }

    const { cropSize, scale } = resolved;
    const viewCenter = AVATAR_CROP_VIEW_SIZE / 2;
    const halfW = (avatarCropNaturalSize.w * scale) / 2;
    const halfH = (avatarCropNaturalSize.h * scale) / 2;
    const imageTopLeftX = viewCenter + avatarCropOffset.x - halfW;
    const imageTopLeftY = viewCenter + avatarCropOffset.y - halfH;

    const sxRaw = (AVATAR_CROP_PADDING - imageTopLeftX) / scale;
    const syRaw = (AVATAR_CROP_PADDING - imageTopLeftY) / scale;
    const sSize = cropSize / scale;

    const sx = Math.max(0, Math.min(avatarCropNaturalSize.w - sSize, sxRaw));
    const sy = Math.max(0, Math.min(avatarCropNaturalSize.h - sSize, syRaw));

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_CROP_OUTPUT_SIZE;
    canvas.height = AVATAR_CROP_OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, AVATAR_CROP_OUTPUT_SIZE, AVATAR_CROP_OUTPUT_SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(AVATAR_CROP_OUTPUT_SIZE / 2, AVATAR_CROP_OUTPUT_SIZE / 2, AVATAR_CROP_OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, AVATAR_CROP_OUTPUT_SIZE, AVATAR_CROP_OUTPUT_SIZE);
    ctx.restore();

    setRoleCardDraftAvatar(canvas.toDataURL('image/png'));
    closeAvatarCropper();
    showToast(t('已裁剪', 'Cropped'));
  };

  const openRoleCardEditor = (id?: string) => {
    setRoleCardDraftError('');

    if (!id) {
      resetRoleCardDraft();
      setRoleCardAddOpen(true);
      return;
    }

    const target = roleCards.find((item) => item.id === id);
    if (!target) {
      resetRoleCardDraft();
      setRoleCardAddOpen(true);
      return;
    }

    setRoleCardEditingId(target.id);
    setRoleCardDraftKind(target.kind);
    setRoleCardDraftAlias(target.alias || '');
    setRoleCardDraftAtId(target.atId || '');
    setRoleCardDraftInsertContent(target.insertContent || '');
    setRoleCardDraftAvatar(target.avatarDataUrl || null);
    setRoleCardDraftNote(target.note || '');
    if (roleCardAvatarInputRef.current) {
      roleCardAvatarInputRef.current.value = '';
    }
    setRoleCardAddOpen(true);
  };

  const handleSelectRoleCardAvatar = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file || !file.type || !file.type.startsWith('image/')) return;
    const dataUrl = await readImageAsDataUrl(file, 1024, 0.9);
    if (dataUrl) openAvatarCropper(dataUrl);
    if (roleCardAvatarInputRef.current) {
      roleCardAvatarInputRef.current.value = '';
    }
  };

  const handlePasteRoleCardAvatar = async () => {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      showToast(t('当前环境不支持读取剪贴板图片', 'Clipboard image not supported.'));
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const ext = imageType.split('/')[1] || 'png';
        const file = new File([blob], `clipboard.${ext}`, { type: imageType });
        const dataUrl = await readImageAsDataUrl(file, 1024, 0.9);
        if (dataUrl) {
          openAvatarCropper(dataUrl);
          showToast(t('已读取剪贴板图片', 'Clipboard image loaded.'));
          return;
        }
      }
      showToast(t('剪贴板中没有图片', 'No image in clipboard.'));
    } catch {
      showToast(t('读取剪贴板失败，请手动上传', 'Failed to read clipboard.'));
    }
  };

  const handleSaveRoleCard = () => {
    setRoleCardDraftError('');
    const alias = roleCardDraftAlias.trim();
    if (!alias) {
      setRoleCardDraftError(t('请输入简称。', 'Alias is required.'));
      return;
    }

    const note = roleCardDraftNote.trim();
    const avatarDataUrl = roleCardDraftAvatar || undefined;
    const now = Date.now();
    const existing = roleCardEditingId ? roleCards.find((item) => item.id === roleCardEditingId) : undefined;

    if (roleCardDraftKind === 'role') {
      const atId = roleCardDraftAtId.trim().replace(/^@+/, '');
      if (!atId) {
        setRoleCardDraftError(t('请输入 @ 的非中文ID。', 'ID is required.'));
        return;
      }
      if (/[\u4e00-\u9fff]/.test(atId)) {
        setRoleCardDraftError(t('@ID 不能包含中文。', 'ID must not contain Chinese characters.'));
        return;
      }
      if (/\s/.test(atId)) {
        setRoleCardDraftError(t('@ID 不能包含空格。', 'ID must not contain spaces.'));
        return;
      }

      const item: RoleCardItem = {
        id: existing?.id || uuidv4(),
        kind: 'role',
        alias,
        atId,
        avatarDataUrl,
        note: note || undefined,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      const next = existing
        ? roleCards.map((current) => (current.id === item.id ? item : current))
        : [item, ...roleCards].slice(0, 200);
      setRoleCards(next);
      setRoleCardAddOpen(false);
      resetRoleCardDraft();
      showToast(existing ? t('已保存', 'Saved') : t('已添加角色', 'Role added'));
      return;
    }

    const insertContent = roleCardDraftInsertContent.trim();
    if (!insertContent) {
      setRoleCardDraftError(t('请输入插入内容。', 'Insert content is required.'));
      return;
    }

    const item: RoleCardItem = {
      id: existing?.id || uuidv4(),
      kind: 'prompt',
      alias,
      insertContent,
      avatarDataUrl,
      note: note || undefined,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const next = existing
      ? roleCards.map((current) => (current.id === item.id ? item : current))
      : [item, ...roleCards].slice(0, 200);
    setRoleCards(next);
    setRoleCardAddOpen(false);
    resetRoleCardDraft();
    showToast(existing ? t('已保存', 'Saved') : t('已添加提示词', 'Prompt added'));
  };

  const handleDeleteRoleCard = (id: string) => {
    const target = roleCards.find((item) => item.id === id);
    const label = (target?.alias || '').trim();
    const confirmed = window.confirm(
      label ? t(`确定删除「${label}」吗？`, `Delete "${label}"?`) : t('确定删除此条目吗？', 'Delete this item?')
    );
    if (!confirmed) return;
    setRoleCards(roleCards.filter((item) => item.id !== id));
    showToast(t('已删除', 'Deleted'));
  };

  const handleExportRoleCards = () => {
    if (roleCards.length === 0) {
      showToast(t('暂无可导出的条目', 'No items to export.'));
      return;
    }
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: roleCards,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `role-cards-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(t('已导出', 'Exported.'));
  };

  const normalizeImportedRoleCard = (raw: any, fallbackIndex: number) => {
    if (!raw || typeof raw !== 'object') return null;
    const kind = raw.kind === 'prompt' ? 'prompt' : raw.kind === 'role' ? 'role' : null;
    if (!kind) return null;
    const alias = String(raw.alias || '').trim();
    if (!alias) return null;
    const now = Date.now();
    const base = {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uuidv4(),
      alias,
      avatarDataUrl: typeof raw.avatarDataUrl === 'string' ? raw.avatarDataUrl : undefined,
      note: typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : undefined,
      createdAt: Number.isFinite(raw.createdAt) ? Number(raw.createdAt) : now + fallbackIndex,
      updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : now + fallbackIndex,
    };

    if (kind === 'role') {
      const atId = String(raw.atId || '').trim().replace(/^@+/, '');
      if (!atId) return null;
      return { ...base, kind, atId } as RoleCardItem;
    }

    const insertContent = String(raw.insertContent || '').trim();
    if (!insertContent) return null;
    return { ...base, kind, insertContent } as RoleCardItem;
  };

  const handleImportRoleCards = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rawItems = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null;
      if (!rawItems) {
        showToast(t('导入失败：格式不正确', 'Import failed: invalid format.'));
        return;
      }

      const imported: RoleCardItem[] = [];
      rawItems.forEach((item: any, idx: number) => {
        const normalized = normalizeImportedRoleCard(item, idx);
        if (normalized) imported.push(normalized);
      });

      if (imported.length === 0) {
        showToast(t('没有可导入的条目', 'No valid items to import.'));
        return;
      }

      const importedIds = new Set(imported.map((item) => item.id));
      const merged = [...imported, ...roleCards.filter((item) => !importedIds.has(item.id))].slice(0, 200);
      setRoleCards(merged);

      const truncated = merged.length < imported.length + roleCards.filter((item) => !importedIds.has(item.id)).length;
      showToast(
        truncated
          ? t(`已导入 ${imported.length} 条（已截断为 200 条）`, `Imported ${imported.length} items (trimmed to 200).`)
          : t(`已导入 ${imported.length} 条`, `Imported ${imported.length} items.`)
      );
    } catch {
      showToast(t('导入失败，请检查文件', 'Import failed.'));
    } finally {
      if (roleCardImportInputRef.current) {
        roleCardImportInputRef.current.value = '';
      }
    }
  };

  const filteredRoleCards = React.useMemo(() => {
    const normalizedRaw = roleCardsSearch.trim().toLowerCase();
    const normalized = normalizedRaw.replace(/^[@/]+/, '');
    if (!normalizedRaw) return roleCards;

    return roleCards.filter((item) => {
      const alias = (item.alias || '').toLowerCase();
      const note = (item.note || '').toLowerCase();
      const atId = (item.atId || '').toLowerCase();
      const insertContent = (item.insertContent || '').toLowerCase();
      const searchable = [
        alias,
        note,
        atId,
        `@${atId}`,
        insertContent,
        item.kind === 'role' ? t('角色', 'role') : t('提示词', 'prompt'),
      ]
        .filter(Boolean)
        .join('\n');

      return searchable.includes(normalizedRaw) || (normalized !== normalizedRaw && searchable.includes(normalized));
    });
  }, [roleCards, roleCardsSearch, t]);

  useEffect(() => {
    setIntervalDraft(formatConcurrencyInterval(concurrencyIntervalSec));
  }, [concurrencyIntervalSec]);

  const commitConcurrencyInterval = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      const fallback = clampConcurrencyInterval(0.1);
      setConcurrencyIntervalSec(Number(fallback.toFixed(2)));
      setIntervalDraft(formatConcurrencyInterval(fallback));
      return;
    }
    const parsed = Number.parseFloat(trimmed);
    if (Number.isNaN(parsed)) {
      setIntervalDraft(formatConcurrencyInterval(concurrencyIntervalSec));
      return;
    }
    const clamped = clampConcurrencyInterval(parsed);
    const rounded = Number(clamped.toFixed(2));
    setConcurrencyIntervalSec(rounded);
    setIntervalDraft(formatConcurrencyInterval(rounded));
  };


  const enterpriseFeatureEnabled = Boolean(devExperimentalEnabled && devTbd1Enabled);
  const enterpriseLocationValue = (geminiEnterpriseLocation || 'us-central1').trim() || 'us-central1';
  const enterpriseFixedBaseUrl = `https://${enterpriseLocationValue}-aiplatform.googleapis.com`;
  const isEnterpriseActive = apiMode === 'gemini' && enterpriseFeatureEnabled && geminiEnterpriseEnabled;

  useEffect(() => {
    if (!isOpen) {
      setAboutVersionTapCount(0);
      setLaneLimitGateOpen(false);
      setLaneLimitGateText('');
      setLaneLimitGateError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab !== 'about') {
      setAboutVersionTapCount(0);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!laneLimitGateOpen) return;
    setLaneLimitGateError('');
  }, [laneLimitGateOpen, laneLimitGateText]);

  const handleAboutVersionTap = () => {
    if (laneLimitUnlocked) return;
    setAboutVersionTapCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setLaneLimitGateOpen(true);
        return 0;
      }
      return next;
    });
  };

  const confirmLaneLimitUnlock = () => {
    if (laneLimitUnlocked) return;
    if (laneLimitGateText !== LANE_LIMIT_GATE_PHRASE) {
      setLaneLimitGateError(t('请输入完整声明文本后才能确认。', 'Type the exact phrase to confirm.'));
      return;
    }
    setLaneLimitUnlocked(true);
    setLaneLimitGateOpen(false);
    setLaneLimitGateText('');
    setLaneLimitGateError('');
  };

  const preventCopyPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
  };

  const APP_VERSION = 'v4.2';

  const handleCopyVersionHover = async () => {
    try {
      if (!navigator?.clipboard?.writeText) return;
      await navigator.clipboard.writeText(APP_VERSION);
    } catch {
      // ignore clipboard failures
    }
  };

  const canManageExtras = isOpenaiMode ? relayEnabled : geminiKeyPoolEnabled && !isEnterpriseActive;
  const extraLabel = isOpenaiMode ? t('更多中转站', 'More relays') : t('密钥轮询', 'Key rotation');
  const extraButtonLabel = isOpenaiMode ? t('更多站点', 'More sites') : t('更多密钥', 'More keys');
  const invalidGeminiKeyCount = Object.values(geminiKeyTestResults).filter(
    (r) => !r.ok && (r.status === 401 || r.status === 403)
  ).length;

  const normalizedNewModelName = newModelName.trim().toLowerCase();
  const hasDuplicateModelName = Boolean(
    normalizedNewModelName &&
      availableModels.some((m) => (m.name || '').trim().toLowerCase() === normalizedNewModelName)
  );

  useEffect(() => {
    const fetchStars = async () => {
      setStarLoading(true);
      try {
        const res = await fetch('https://api.github.com/repos/Wuniao79/Concurrent-Picture-AND-Video');
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (typeof data?.stargazers_count === 'number') {
          setStarCount(data.stargazers_count);
        }
      } catch {
        setStarCount(null);
      } finally {
        setStarLoading(false);
      }
    };
    fetchStars();
  }, []);

  const extractStatusCode = (err: any): number | undefined => {
    if (!err) return undefined;
    if (typeof err === 'number') return err;

    const direct =
      typeof err?.status === 'number'
        ? err.status
        : typeof err?.statusCode === 'number'
        ? err.statusCode
        : undefined;
    if (typeof direct === 'number') return direct;

    const message = typeof err === 'string' ? err : err?.message ? String(err.message) : String(err);
    const match = message.match(/\b(400|401|403|429|500)\b/);
    if (!match) return undefined;
    return parseInt(match[1], 10);
  };

  const resolveGeminiTestModelId = (): string => {
    const geminiTextModel = availableModels.find((m) => m.provider === 'gemini' && resolveModelModality(m) === 'text');
    return geminiTextModel?.id || 'gemini-3-pro-preview';
  };

  const handleTestGeminiKeys = async () => {
    if (apiMode !== 'gemini') return;
    if (isEnterpriseActive) return;

    const candidates = geminiKeys.filter((k) => Boolean((k.apiKey || '').trim()));
    if (candidates.length === 0) {
      alert(t('没有可测试的密钥，请先填写至少一条。', 'No keys to test. Please fill at least one key.'));
      return;
    }

    setGeminiKeyTestLoading(true);
    const nextResults: Record<string, { ok: boolean; status?: number; message?: string }> = {};
    const modelId = resolveGeminiTestModelId();
    const apiBase = geminiCustomBaseEnabled ? (geminiApiUrl || '').trim() : '';

    try {
      for (const keyItem of candidates) {
        try {
          let last = '';
          await generateResponse(
            modelId,
            [],
            'ping',
            (chunk) => {
              last = chunk;
            },
            (keyItem.apiKey || '').trim(),
            false,
            undefined,
            apiBase,
            'gemini'
          );
          if (!last) {
            // Some endpoints return empty on invalid keys; treat as failure to be safe.
            nextResults[keyItem.id] = { ok: false, status: 500, message: 'Empty response' };
          } else {
            nextResults[keyItem.id] = { ok: true };
          }
        } catch (err: any) {
          const message = err?.message ? String(err.message) : String(err);
          const status = extractStatusCode(err) ?? extractStatusCode(message);
          nextResults[keyItem.id] = { ok: false, status, message };
        }
        // Update progressively so users see results quickly.
        setGeminiKeyTestResults((prev) => ({ ...prev, ...nextResults }));
      }
    } finally {
      setGeminiKeyTestLoading(false);
    }
  };

  const handleDeleteInvalidGeminiKeys = () => {
    if (apiMode !== 'gemini') return;

    const invalidIds = Object.entries(geminiKeyTestResults)
      .filter(([, r]) => !r.ok && (r.status === 401 || r.status === 403))
      .map(([id]) => id);

    if (invalidIds.length === 0) {
      alert(t('没有检测到失效密钥（401/403）。', 'No invalid keys detected (401/403).'));
      return;
    }

    const confirmed = confirm(
      t(`将删除 ${invalidIds.length} 条失效密钥，是否继续？`, `Delete ${invalidIds.length} invalid keys. Continue?`)
    );
    if (!confirmed) return;

    const idSet = new Set(invalidIds);
    const next = geminiKeys.filter((k) => !idSet.has(k.id));
    if (next.length === 0) {
      setGeminiKeys([{ id: uuidv4(), name: t('密钥1', 'Key 1'), apiKey: '', enabled: false }]);
      setGeminiKeyTestResults({});
      return;
    }
    setGeminiKeys(next);
    setGeminiKeyTestResults((prev) => {
      const cloned = { ...prev };
      invalidIds.forEach((id) => {
        delete cloned[id];
      });
      return cloned;
    });
  };

  const handleImportGeminiKeys = () => {
    if (apiMode !== 'gemini') return;
    if (isEnterpriseActive) return;

    const raw = (geminiKeyImportText || '').replace(/\r\n/g, '\n');
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      alert(t('请粘贴密钥：一行一个。', 'Paste keys: one per line.'));
      return;
    }

    const existing = new Set(geminiKeys.map((k) => (k.apiKey || '').trim()).filter(Boolean));
    const toAdd: string[] = [];
    let duplicateCount = 0;

    for (const line of lines) {
      const key = line.trim();
      if (!key) continue;
      if (existing.has(key)) {
        duplicateCount += 1;
        continue;
      }
      existing.add(key);
      toAdd.push(key);
    }

    if (toAdd.length === 0) {
      alert(
        duplicateCount > 0
          ? t(`没有可导入的新密钥（重复 ${duplicateCount} 条）。`, `No new keys to import (${duplicateCount} duplicates).`)
          : t('没有可导入的新密钥。', 'No new keys to import.')
      );
      return;
    }

    const baseIndex = geminiKeys.length;
    const formatName = (n: number) => (language === 'zh' ? `密钥${n}` : `Key ${n}`);
    const newItems: GeminiKeySite[] = toAdd.map((apiKey, idx) => ({
      id: uuidv4(),
      name: formatName(baseIndex + idx + 1),
      apiKey,
      enabled: true,
    }));

    setGeminiKeys([...geminiKeys, ...newItems]);
    setGeminiKeyImportText('');
    setGeminiKeyImportOpen(false);

    alert(
      duplicateCount > 0
        ? t(
            `已导入 ${newItems.length} 条密钥（忽略重复 ${duplicateCount} 条）。`,
            `Imported ${newItems.length} keys (skipped ${duplicateCount} duplicates).`
          )
        : t(`已导入 ${newItems.length} 条密钥。`, `Imported ${newItems.length} keys.`)
    );
  };

  const handleAddModel = () => {
    if (!newModelId || !newModelName) return;
    const trimmedId = newModelId.trim();
    const trimmedName = newModelName.trim();
    if (!trimmedId || !trimmedName) return;
    const newModel: Model = {
      id: trimmedId,
      name: trimmedName,
      vision: newModelVision,
      provider: newModelProvider,
      modality: newModelModality,
    };

    // Avoid duplicates within the same provider (duplicates across providers are allowed).
    const normalizedProvider = newModelProvider === 'gemini' ? 'gemini' : 'openai';
    const next = (() => {
      const idx = availableModels.findIndex(
        (m) => m.id === trimmedId && ((m.provider === 'gemini' ? 'gemini' : 'openai') === normalizedProvider)
      );
      if (idx === -1) return [...availableModels, newModel];
      const copy = [...availableModels];
      copy[idx] = { ...copy[idx], ...newModel };
      return copy;
    })();

    setAvailableModels(next);
    setNewModelId('');
    setNewModelName('');
    setNewModelVision(true);
    setNewModelProvider('openai');
    setNewModelModality('text');
  };

  const handleDeleteModel = (id: string, provider?: ModelProvider) => {
    if (availableModels.length <= 1) return;
    const normalizedProvider = provider === 'gemini' ? 'gemini' : 'openai';
    setAvailableModels(
      availableModels.filter(
        (m) => !(m.id === id && (m.provider === 'gemini' ? 'gemini' : 'openai') === normalizedProvider)
      )
    );
  };

  const openModelEditor = (model: Model) => {
    setModelDraftError('');
    setModelEditOriginal({
      id: model.id,
      provider: model.provider === 'gemini' ? 'gemini' : 'openai',
    });
    setModelDraftId(model.id || '');
    setModelDraftName(model.name || '');
    setModelDraftVision(Boolean(model.vision));
    setModelDraftProvider(model.provider === 'gemini' ? 'gemini' : 'openai');
    setModelDraftModality(resolveModelModality(model));
    setModelEditOpen(true);
  };

  const closeModelEditor = () => {
    setModelEditOpen(false);
    setModelEditOriginal(null);
    setModelDraftError('');
  };

  const saveModelEditor = () => {
    setModelDraftError('');
    const trimmedId = modelDraftId.trim();
    const trimmedName = modelDraftName.trim();
    if (!trimmedId || !trimmedName) {
      setModelDraftError(t('请填写模型ID与名称。', 'Model ID and name are required.'));
      return;
    }

    const updated: Model = {
      id: trimmedId,
      name: trimmedName,
      vision: modelDraftVision,
      provider: modelDraftProvider,
      modality: modelDraftModality,
    };

    const old = modelEditOriginal;
    const oldProvider = old?.provider === 'gemini' ? 'gemini' : 'openai';
    const normalizedProvider = modelDraftProvider === 'gemini' ? 'gemini' : 'openai';
    const withoutOld = old
      ? availableModels.filter((m) => !(m.id === old.id && (m.provider === 'gemini' ? 'gemini' : 'openai') === oldProvider))
      : [...availableModels];

    const idx = withoutOld.findIndex(
      (m) => m.id === trimmedId && (m.provider === 'gemini' ? 'gemini' : 'openai') === normalizedProvider
    );
    const next = (() => {
      if (idx === -1) return [...withoutOld, updated];
      const copy = [...withoutOld];
      copy[idx] = { ...copy[idx], ...updated };
      return copy;
    })();

    setAvailableModels(next);
    closeModelEditor();
    showToast(t('已保存', 'Saved'));
  };

  if (!isOpen) return null;

  const sora2apiImageModels = [
    { id: 'gpt-image', descZh: '文生图（正方形）', descEn: 'Text-to-image (square)', size: '360×360' },
    { id: 'gpt-image-landscape', descZh: '文生图（横屏）', descEn: 'Text-to-image (landscape)', size: '540×360' },
    { id: 'gpt-image-portrait', descZh: '文生图（竖屏）', descEn: 'Text-to-image (portrait)', size: '360×540' },
  ];

  const sora2apiVideoStandardModels = [
    { id: 'sora2-landscape-10s', durationSec: 10, orientation: 'landscape', descZh: '文生视频/图生视频', descEn: 'Text-to-video / Image-to-video' },
    { id: 'sora2-landscape-15s', durationSec: 15, orientation: 'landscape', descZh: '文生视频/图生视频', descEn: 'Text-to-video / Image-to-video' },
    { id: 'sora2-landscape-25s', durationSec: 25, orientation: 'landscape', descZh: '文生视频/图生视频', descEn: 'Text-to-video / Image-to-video' },
    { id: 'sora2-portrait-10s', durationSec: 10, orientation: 'portrait', descZh: '文生视频/图生视频', descEn: 'Text-to-video / Image-to-video' },
    { id: 'sora2-portrait-15s', durationSec: 15, orientation: 'portrait', descZh: '文生视频/图生视频', descEn: 'Text-to-video / Image-to-video' },
    { id: 'sora2-portrait-25s', durationSec: 25, orientation: 'portrait', descZh: '文生视频/图生视频', descEn: 'Text-to-video / Image-to-video' },
  ] as const;

  const sora2apiVideoProModels = [
    { id: 'sora2pro-landscape-10s', durationSec: 10, orientation: 'landscape', descZh: 'Pro 质量文生视频/图生视频', descEn: 'Pro quality text-to-video / image-to-video' },
    { id: 'sora2pro-landscape-15s', durationSec: 15, orientation: 'landscape', descZh: 'Pro 质量文生视频/图生视频', descEn: 'Pro quality text-to-video / image-to-video' },
    { id: 'sora2pro-landscape-25s', durationSec: 25, orientation: 'landscape', descZh: 'Pro 质量文生视频/图生视频', descEn: 'Pro quality text-to-video / image-to-video' },
    { id: 'sora2pro-portrait-10s', durationSec: 10, orientation: 'portrait', descZh: 'Pro 质量文生视频/图生视频', descEn: 'Pro quality text-to-video / image-to-video' },
    { id: 'sora2pro-portrait-15s', durationSec: 15, orientation: 'portrait', descZh: 'Pro 质量文生视频/图生视频', descEn: 'Pro quality text-to-video / image-to-video' },
    { id: 'sora2pro-portrait-25s', durationSec: 25, orientation: 'portrait', descZh: 'Pro 质量文生视频/图生视频', descEn: 'Pro quality text-to-video / image-to-video' },
  ] as const;

  const sora2apiVideoProHdModels = [
    { id: 'sora2pro-hd-landscape-10s', durationSec: 10, orientation: 'landscape', descZh: 'Pro 高清文生视频/图生视频', descEn: 'Pro HD text-to-video / image-to-video' },
    { id: 'sora2pro-hd-landscape-15s', durationSec: 15, orientation: 'landscape', descZh: 'Pro 高清文生视频/图生视频', descEn: 'Pro HD text-to-video / image-to-video' },
    { id: 'sora2pro-hd-portrait-10s', durationSec: 10, orientation: 'portrait', descZh: 'Pro 高清文生视频/图生视频', descEn: 'Pro HD text-to-video / image-to-video' },
    { id: 'sora2pro-hd-portrait-15s', durationSec: 15, orientation: 'portrait', descZh: 'Pro 高清文生视频/图生视频', descEn: 'Pro HD text-to-video / image-to-video' },
  ] as const;

  const sora2apiStyles = [
    { id: 'festive', name: 'Festive', descZh: '节日风格', descEn: 'Festive style' },
    { id: 'kakalaka', name: 'Kakalaka', descZh: '混沌风格', descEn: 'Chaos style' },
    { id: 'news', name: 'News', descZh: '新闻风格', descEn: 'News style' },
    { id: 'selfie', name: 'Selfie', descZh: '自拍风格', descEn: 'Selfie style' },
    { id: 'handheld', name: 'Handheld', descZh: '手持风格', descEn: 'Handheld style' },
    { id: 'golden', name: 'Golden', descZh: '金色风格', descEn: 'Golden style' },
    { id: 'anime', name: 'Anime', descZh: '动漫风格', descEn: 'Anime style' },
    { id: 'retro', name: 'Retro', descZh: '复古风格', descEn: 'Retro style' },
    { id: 'nostalgic', name: 'Vintage', descZh: '怀旧风格', descEn: 'Vintage style' },
    { id: 'comic', name: 'Comic', descZh: '漫画风格', descEn: 'Comic style' },
  ];

  const tabs = [
    { id: 'interface', label: t('界面', 'Interface'), icon: <Monitor size={18} /> },
    { id: 'models', label: t('模型', 'Models'), icon: <Cpu size={18} /> },
    { id: 'apikey', label: 'API Key', icon: <KeyRound size={18} /> },
    { id: 'data', label: t('数据', 'Data'), icon: <Database size={18} /> },
    { id: 'assets', label: t('素材库', 'Assets'), icon: <Library size={18} /> },
    ...(sora2piEnabled ? [{ id: 'sora2api', label: t('Sora2api模型', 'Sora2api Models'), icon: <Sparkles size={18} /> }] : []),
    { id: 'roleCards', label: t('角色卡/提示词', 'Role Cards/Prompts'), icon: <AtSign size={18} /> },
    { id: 'about', label: t('关于', 'About'), icon: <Info size={18} /> },
    { id: 'dev', label: t('开发者选项', 'Developer'), icon: <Settings size={18} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      {laneLimitGateOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="text-lg font-bold text-red-600 dark:text-red-400">
                {t('危险选项警告', 'Dangerous option warning')}
              </div>
              <button
                type="button"
                onClick={() => {
                  setLaneLimitGateOpen(false);
                  setLaneLimitGateText('');
                  setLaneLimitGateError('');
                }}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label={t('关闭', 'Close')}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line">
                {t(
                  '极高量并发会严重导致网页卡顿，并且过大的并发将从创作变为无意义的资源浪费！\n如果使用第三方中转站100%会被拉黑！\n此选项仅给开发人员使用。如出现任何问题后果自负！',
                  'Extremely high levels of concurrency can severely cause website lag, and excessive concurrency will turn productive activity into meaningless waste of resources. If a third-party relay/proxy service is used, it will be 100% blacklisted. This option is for developers only. Any issues arising from its use are at your own risk.'
                )}
              </div>

              <div className="space-y-1">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('我是开发者，我自愿承担后果。', "I'm a developer and I accept the consequences.")}
                </div>
                <input
                  type="text"
                  value={laneLimitGateText}
                  onChange={(e) => setLaneLimitGateText(e.target.value)}
                  onCopy={preventCopyPaste}
                  onCut={preventCopyPaste}
                  onPaste={preventCopyPaste}
                  placeholder={t('请手动输入上述声明（禁止复制粘贴）', 'Type the phrase above (copy/paste disabled)')}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
                {laneLimitGateError && (
                  <div className="text-xs text-red-600 dark:text-red-400">{laneLimitGateError}</div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLaneLimitGateOpen(false);
                    setLaneLimitGateText('');
                    setLaneLimitGateError('');
                  }}
                  className="px-4 h-10 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {t('取消', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={confirmLaneLimitUnlock}
                  disabled={laneLimitGateText !== LANE_LIMIT_GATE_PHRASE}
                  className="px-4 h-10 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('确认启用', 'Enable')}
                </button>
              </div>

              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                {t(
                  '注意：此开关一旦启用，只能通过“数据 → 清空本地数据”来关闭。',
                  'Note: once enabled, it can only be disabled by clearing local data.'
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {modelEditOpen && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('编辑模型', 'Edit Model')}</div>
              <button
                type="button"
                onClick={closeModelEditor}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label={t('关闭', 'Close')}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t('模型名称', 'Model Name')}
                  </label>
                  <input
                    type="text"
                    value={modelDraftName}
                    onChange={(e) => setModelDraftName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('模型 ID', 'Model ID')}</label>
                  <input
                    type="text"
                    value={modelDraftId}
                    onChange={(e) => setModelDraftId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 py-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      modelDraftVision
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'bg-white dark:bg-gray-900 border-gray-400 dark:border-gray-600'
                    }`}
                  >
                    {modelDraftVision && <Check size={14} />}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={modelDraftVision}
                    onChange={(e) => setModelDraftVision(e.target.checked)}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center gap-1">
                    {t('支持视觉', 'Support Vision')} <Eye size={14} className="text-gray-400" />
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('提供方', 'Provider')}</span>
                  <div className="inline-flex rounded-full bg-gray-800 p-1">
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs rounded-full ${
                        modelDraftProvider === 'openai' ? 'bg-blue-500 text-white' : 'text-gray-300'
                      }`}
                      onClick={() => setModelDraftProvider('openai')}
                    >
                      OpenAI
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 text-xs rounded-full ${
                        modelDraftProvider === 'gemini' ? 'bg-yellow-400 text-black' : 'text-gray-300'
                      }`}
                      onClick={() => setModelDraftProvider('gemini')}
                    >
                      Gemini
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('标签', 'Tags')}</span>
                  <div className="inline-flex rounded-full bg-gray-800 p-1">
                    {[
                      { id: 'video', label: t('视频', 'Video') },
                      { id: 'image', label: t('图片', 'Image') },
                      { id: 'text', label: t('文字', 'Text') },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          modelDraftModality === item.id ? 'bg-white text-gray-900' : 'text-gray-300 hover:text-white'
                        }`}
                        onClick={() => setModelDraftModality(item.id as ModelModality)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {modelDraftError && <div className="text-xs text-red-600 dark:text-red-400">{modelDraftError}</div>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModelEditor}
                  className="h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  {t('取消', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={saveModelEditor}
                  className="h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                >
                  {t('保存', 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {roleCardAddOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {roleCardEditingId ? t('编辑角色/提示词', 'Edit Role/Prompt') : t('添加角色/提示词', 'Add Role/Prompt')}
              </div>
              <button
                type="button"
                onClick={() => {
                  setRoleCardAddOpen(false);
                  resetRoleCardDraft();
                }}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label={t('关闭', 'Close')}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRoleCardDraftKind('role')}
                  className={`h-11 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                    roleCardDraftKind === 'role'
                      ? 'bg-gray-100 dark:bg-white/10 border-gray-300 dark:border-white/30 text-gray-900 dark:text-white'
                      : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  {t('角色', 'Role')}
                </button>
                <button
                  type="button"
                  onClick={() => setRoleCardDraftKind('prompt')}
                  className={`h-11 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                    roleCardDraftKind === 'prompt'
                      ? 'bg-gray-100 dark:bg-white/10 border-gray-300 dark:border-white/30 text-gray-900 dark:text-white'
                      : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  {t('提示词', 'Prompt')}
                </button>
              </div>

              <input
                type="text"
                value={roleCardDraftAlias}
                onChange={(e) => setRoleCardDraftAlias(e.target.value)}
                placeholder={t('简称（必填）', 'Alias (required)')}
                className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 px-4 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />

              {roleCardDraftKind === 'role' ? (
                <input
                  type="text"
                  value={roleCardDraftAtId}
                  onChange={(e) => setRoleCardDraftAtId(e.target.value)}
                  placeholder={t('@ 的非中文ID（必填）', '@ non-Chinese ID (required)')}
                  className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 px-4 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                />
              ) : (
                <textarea
                  value={roleCardDraftInsertContent}
                  onChange={(e) => setRoleCardDraftInsertContent(e.target.value)}
                  placeholder={t('插入内容（必填）', 'Insert content (required)')}
                  className="w-full h-28 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              )}

              <div className="flex items-start gap-4">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => roleCardAvatarInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      roleCardAvatarInputRef.current?.click();
                    }
                  }}
                  className="h-24 w-24 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40 flex items-center justify-center overflow-hidden cursor-pointer"
                  title={t('点击上传头像（可选）', 'Upload avatar (optional)')}
                >
                  {roleCardDraftAvatar ? (
                    <img src={roleCardDraftAvatar} alt="avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-xs text-gray-400">{t('头像', 'Avatar')}</div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t('头像与备注为可选，用于展示与搜索。', 'Avatar and note are optional.')}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePasteRoleCardAvatar}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      {t('粘贴剪切板', 'Paste from clipboard')}
                    </button>
                    {roleCardDraftAvatar && (
                      <button
                        type="button"
                        onClick={() => setRoleCardDraftAvatar(null)}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        {t('清除头像', 'Clear avatar')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <input
                ref={roleCardAvatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleSelectRoleCardAvatar(e.target.files)}
              />

              <textarea
                value={roleCardDraftNote}
                onChange={(e) => setRoleCardDraftNote(e.target.value)}
                placeholder={t('人物备注（可选）', 'Note (optional)')}
                className="w-full h-20 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />

              {roleCardDraftError && (
                <div className="text-xs text-red-600 dark:text-red-400">{roleCardDraftError}</div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRoleCardAddOpen(false);
                    resetRoleCardDraft();
                  }}
                  className="h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  {t('取消', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoleCard}
                  className="h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                >
                  {t('保存', 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {avatarCropOpen && avatarCropSrc && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('裁剪头像', 'Crop Avatar')}</div>
              <button
                type="button"
                onClick={closeAvatarCropper}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label={t('关闭', 'Close')}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-center">
                <div
                  className="relative h-[320px] w-[320px] rounded-2xl bg-gray-100 dark:bg-gray-800 overflow-hidden touch-none select-none"
                  onPointerDown={(e) => {
                    const resolved = resolveAvatarCropScale();
                    if (!resolved) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    avatarCropDragRef.current = {
                      pointerId: e.pointerId,
                      startX: e.clientX,
                      startY: e.clientY,
                      startOffsetX: avatarCropOffset.x,
                      startOffsetY: avatarCropOffset.y,
                    };
                  }}
                  onPointerMove={(e) => {
                    const drag = avatarCropDragRef.current;
                    if (!drag || drag.pointerId !== e.pointerId) return;
                    const resolved = resolveAvatarCropScale();
                    if (!resolved) return;
                    const dx = e.clientX - drag.startX;
                    const dy = e.clientY - drag.startY;
                    const next = { x: drag.startOffsetX + dx, y: drag.startOffsetY + dy };
                    setAvatarCropOffset(clampAvatarCropOffset(next, resolved.scale));
                  }}
                  onPointerUp={(e) => {
                    const drag = avatarCropDragRef.current;
                    if (!drag || drag.pointerId !== e.pointerId) return;
                    avatarCropDragRef.current = null;
                  }}
                  onPointerCancel={() => {
                    avatarCropDragRef.current = null;
                  }}
                >
                  <img
                    ref={avatarCropImgRef}
                    src={avatarCropSrc}
                    alt="avatar crop"
                    className="absolute left-1/2 top-1/2 pointer-events-none max-w-none max-h-none"
                    draggable={false}
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      avatarCropImgRef.current = el;
                      const w = el.naturalWidth || el.width || 1;
                      const h = el.naturalHeight || el.height || 1;
                      setAvatarCropNaturalSize({ w, h });
                    }}
                    style={{
                      transform: `translate(calc(-50% + ${avatarCropOffset.x}px), calc(-50% + ${avatarCropOffset.y}px)) scale(${
                        resolveAvatarCropScale()?.scale || 1
                      })`,
                    }}
                  />
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    viewBox={`0 0 ${AVATAR_CROP_VIEW_SIZE} ${AVATAR_CROP_VIEW_SIZE}`}
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {(() => {
                      const r = (AVATAR_CROP_VIEW_SIZE - AVATAR_CROP_PADDING * 2) / 2;
                      const c = AVATAR_CROP_VIEW_SIZE / 2;
                      const d = `M0 0H${AVATAR_CROP_VIEW_SIZE}V${AVATAR_CROP_VIEW_SIZE}H0Z M${c} ${c}m-${r},0a${r},${r} 0 1,0 ${
                        r * 2
                      },0a${r},${r} 0 1,0 -${r * 2},0`;
                      return (
                        <>
                          <path d={d} fill="rgba(0,0,0,0.55)" fillRule="evenodd" />
                          <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2} />
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 w-10">{t('缩放', 'Zoom')}</div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={avatarCropZoom}
                  onChange={(e) => setAvatarCropZoom(Number(e.target.value))}
                  className="flex-1"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                  {Math.round(avatarCropZoom * 100)}%
                </div>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                {t('拖动图片调整位置。', 'Drag to reposition.')}
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAvatarCropper}
                  className="h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  {t('取消', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={commitAvatarCrop}
                  className="h-10 px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                >
                  {t('完成', 'Done')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {toastMessage && (
        <div className="fixed bottom-8 right-8 z-[70] pointer-events-none">
          <div className="px-3 py-2 rounded-xl bg-gray-900/90 text-white text-sm shadow-lg border border-white/10">
            {toastMessage}
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-gray-900 w-[90%] max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="w-64 bg-gray-50/80 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-6 pt-8">
            <button
              onClick={onClose}
              className="mb-6 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          <nav className="flex-1 px-4 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 p-10 text-gray-900 dark:text-gray-100">
          {activeTab === 'interface' && (
            <div className="space-y-10 max-w-3xl">
              <h2 className="text-3xl font-bold mb-6">{t('界面', 'Interface')}</h2>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('主题', 'Theme')}
                  </label>
                  <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    {[
                      { mode: 'system', label: t('系统', 'System'), icon: Monitor },
                      { mode: 'dark', label: t('暗色', 'Dark'), icon: Moon },
                      { mode: 'light', label: t('浅色', 'Light'), icon: Sun },
                    ].map((item) => (
                      <button
                        key={item.mode}
                        onClick={() => setTheme(item.mode as ThemeMode)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                          theme === item.mode
                            ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                      >
                        <item.icon size={14} /> {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t('语言', 'Language')}
                  </label>
                  <div className="relative">
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as Language)}
                      className="w-full appearance-none px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
                    >
                      <option value="system">{t('跟随系统', 'System Default')}</option>
                      <option value="en">English</option>
                      <option value="zh">中文</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <Globe size={14} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                    <span className="text-lg">T</span> {t('基础字号', 'Base font size')}
                  </label>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-600 dark:text-gray-300">
                    {fontSize}px
                  </span>
                </div>
                <div className="relative pt-1">
                  <input
                    type="range"
                    min="12"
                    max="24"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-600 dark:accent-gray-400"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                    <span>12px</span>
                    <span>18px</span>
                    <span>24px</span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                  {t('界面选项', 'Interface Options')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-200">{t('流式', 'Streaming')}</span>
                    </div>
                    <button
                      onClick={() => setIsStreamEnabled(!isStreamEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                        isStreamEnabled ? 'bg-gray-700 dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                          isStreamEnabled ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-200">{t('并发历史', 'History')}</span>
                    </div>
                    <button
                      onClick={() => setHistoryButtonEnabled(!historyButtonEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                        historyButtonEnabled ? 'bg-gray-700 dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                      title={t('在主页显示并发历史按钮', 'Shows the History button in the top bar')}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                          historyButtonEnabled ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-gray-700 dark:text-gray-200">
                        {t('视频音频拆分', 'Split video audio')}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-line">
                        {t('在快捷时间线中显示独立音频轨道，导出音频以音频轨道为准。', 'Shows an audio lane in Quick Timeline; export audio follows the audio lane.')}
                      </span>
                    </div>
                    <button
                      onClick={() => setTimelineAudioSplitEnabled(!timelineAudioSplitEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                        timelineAudioSplitEnabled ? 'bg-gray-700 dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                          timelineAudioSplitEnabled ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm text-gray-700 dark:text-gray-200">{t('更多图片', 'More images')}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-line">
                          {t(
                            '给需要多图上传模型的选项。\n(Sora2目前只支持一张图片，多张图片可能会报错)',
                            'Option for models that require multiple images.\n(Sora2 currently supports only one image; multiple images may error)'
                          )}
                        </span>
                    </div>
                    <button
                      onClick={() => setMoreImagesEnabled(!moreImagesEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                        moreImagesEnabled ? 'bg-gray-700 dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                      title={t('开启后最多可上传 5 张图片', 'Allows uploading up to 5 images')}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                          moreImagesEnabled ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-gray-700 dark:text-gray-200">Sora2pi</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('纪念我搭建此网站最初的的念想', 'In memory of the original idea.')}
                      </span>
                    </div>
                    <button
                      onClick={() => setSora2piEnabled(!sora2piEnabled)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                        sora2piEnabled ? 'bg-gray-700 dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                      title={t('开启后显示 Sora2api模型 选项', 'Shows the Sora2api Models tab')}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                          sora2piEnabled ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

          {activeTab === 'models' && (
            <div className="space-y-10 max-w-3xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-3xl font-bold">{t('模型', 'Models')}</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setModelsCollapsed((prev) => !prev)}
                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    {modelsCollapsed ? t('展开', 'Expand') : t('收起', 'Collapse')}
                  </button>
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={modelsSearch}
                      onChange={(e) => setModelsSearch(e.target.value)}
                      placeholder={t('搜索模型...', 'Search models...')}
                      className="pl-8 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 w-44"
                    />
                  </div>
                  <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {[
                      { id: 'all', label: t('全部', 'All'), active: '' },
                      { id: 'openai', label: 'OpenAI', active: 'bg-blue-500 text-white dark:text-white' },
                      { id: 'gemini', label: 'Gemini', active: 'bg-yellow-300 text-gray-900' },
                    ].map((item) => {
                      const isActive = modelFilter === item.id;
                      const activeClass =
                        item.id === 'all'
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                          : item.active;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setModelFilter(item.id as 'all' | 'openai' | 'gemini')}
                          className={`px-3 py-1 text-sm font-medium transition-colors ${
                            isActive
                              ? `${activeClass} shadow-sm`
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                    {availableModels.length} {t('已安装', 'Installed')}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {(() => {
                  const normalizedSearch = modelsSearch.trim().toLowerCase();
                  const filteredModels = availableModels
                    .filter((model) => {
                      if (modelFilter === 'all') return true;
                      return (model.provider || 'openai') === modelFilter;
                    })
                    .filter((model) => {
                      if (!normalizedSearch) return true;
                      return (
                        model.name.toLowerCase().includes(normalizedSearch) ||
                        model.id.toLowerCase().includes(normalizedSearch)
                      );
                    });

                  const isCollapsed = modelsCollapsed && filteredModels.length > 3;
                  const visibleModels = isCollapsed ? filteredModels.slice(0, 3) : filteredModels;
                  const hiddenCount = isCollapsed ? filteredModels.length - 3 : 0;

                  return (
                    <>
                      {hiddenCount > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                          {t(`已收起 ${hiddenCount} 个模型`, `${hiddenCount} models hidden`)}
                        </div>
                      )}
                      {visibleModels.map((model) => (
                  <div
                    key={`${model.provider === 'gemini' ? 'gemini' : 'openai'}:${model.id}`}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{model.name}</span>
                        {model.vision && (
                          <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded uppercase tracking-wide flex items-center gap-1">
                            <Eye size={10} /> {t('视觉', 'Vision')}
                          </span>
                        )}
                        {renderModalityBadge(resolveModelModality(model))}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            model.provider === 'gemini'
                              ? 'bg-yellow-200 text-yellow-800'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {model.provider === 'gemini' ? 'Gemini' : 'OpenAI'}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">{model.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openModelEditor(model)}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-white/5 rounded-lg transition-colors"
                        title={t('编辑模型', 'Edit Model')}
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteModel(model.id, model.provider)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title={t('删除模型', 'Remove Model')}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                      ))}
                    </>
                  );
                })()}
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                  {t('添加自定义模型', 'Add Custom Model')}
                </h3>
                <div className="grid grid-cols-1 gap-4 p-5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {t('模型名称', 'Model Name')}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Gemini 2.0"
                        value={newModelName}
                        onChange={(e) => setNewModelName(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {t('模型 ID', 'Model ID')}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. gemini-2.0-flash"
                        value={newModelId}
                        onChange={(e) => setNewModelId(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 py-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          newModelVision
                            ? 'bg-brand-500 border-brand-500 text-white'
                            : 'bg-white dark:bg-gray-900 border-gray-400 dark:border-gray-600'
                        }`}
                      >
                        {newModelVision && <Check size={14} />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={newModelVision}
                        onChange={(e) => setNewModelVision(e.target.checked)}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center gap-1">
                        {t('支持视觉', 'Support Vision')} <Eye size={14} className="text-gray-400" />
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {t('提供方', 'Provider')}
                      </span>
                      <div className="inline-flex rounded-full bg-gray-800 p-1">
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs rounded-full ${
                            newModelProvider === 'openai' ? 'bg-blue-500 text-white' : 'text-gray-300'
                          }`}
                          onClick={() => setNewModelProvider('openai')}
                        >
                          OpenAI
                        </button>
                        <button
                          type="button"
                          className={`px-3 py-1 text-xs rounded-full ${
                            newModelProvider === 'gemini' ? 'bg-yellow-400 text-black' : 'text-gray-300'
                          }`}
                          onClick={() => setNewModelProvider('gemini')}
                        >
                          Gemini
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {t('标签', 'Tags')}
                      </span>
                      <div className="inline-flex rounded-full bg-gray-800 p-1">
                        {[
                          { id: 'video', label: t('视频', 'Video') },
                          { id: 'image', label: t('图片', 'Image') },
                          { id: 'text', label: t('文字', 'Text') },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${
                              newModelModality === item.id ? 'bg-white text-gray-900' : 'text-gray-300 hover:text-white'
                            }`}
                            onClick={() => setNewModelModality(item.id as ModelModality)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {hasDuplicateModelName && (
                    <div className="text-xs text-red-500">
                      {t('已存在同名模型，可以使用搜索模型查看。', 'A model with the same name already exists. Use search to find it.')}
                    </div>
                  )}

                  <button
                    onClick={handleAddModel}
                    disabled={!newModelId || !newModelName}
                    className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    {t('添加模型', 'Add Model')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'apikey' && (
            <div className="space-y-10 max-w-3xl">
              <h2 className="text-3xl font-bold mb-6">{t('API 密钥', 'API Keys')}</h2>
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {t(
                    '填写你的 Google GenAI 或 OpenAI 兼容 API Key，仅保存在内存/本地存储。',
                    'Enter your Google GenAI or OpenAI-compatible API Key. Stored in memory/localStorage only.'
                  )}
                </p>

                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 p-1 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setApiMode('openai')}
                      className={`px-3 py-1 rounded-full transition-all ${
                        apiMode === 'openai'
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      OpenAI
                    </button>
                    <button
                      type="button"
                      onClick={() => setApiMode('gemini')}
                      className={`ml-1 px-3 py-1 rounded-full transition-all ${
                        apiMode === 'gemini'
                          ? 'bg-yellow-400 text-gray-900 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      Gemini
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOpenaiMode ? (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <span className="text-xs text-gray-600 dark:text-gray-300">{extraLabel}</span>
                        <button
                          onClick={() => setRelayEnabled(!relayEnabled)}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                            relayEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                          }`}
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                              relayEnabled ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <span className="text-xs text-gray-600 dark:text-gray-300">{t('密钥轮询', 'Key rotation')}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (isEnterpriseActive) return;
                            setGeminiKeyPoolEnabled(!geminiKeyPoolEnabled);
                          }}
                          disabled={isEnterpriseActive}
                          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                            geminiKeyPoolEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                          } ${isEnterpriseActive ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                          title={
                            isEnterpriseActive
                              ? t('企业API模式使用访问令牌，不支持密钥轮询', 'Enterprise API uses access token; key rotation is disabled')
                              : undefined
                          }
                        >
                          <div
                            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                              geminiKeyPoolEnabled ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {canManageExtras && showRelayMenu && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-[520px] max-w-[92vw] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-4 space-y-3 relative">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {extraButtonLabel}
                          </h4>
                          {!isOpenaiMode && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={handleTestGeminiKeys}
                                disabled={geminiKeyTestLoading || isEnterpriseActive}
                                className={`px-3 h-9 rounded-lg border text-sm transition-colors ${
                                  geminiKeyTestLoading
                                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-wait'
                                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                } ${isEnterpriseActive ? 'opacity-60 cursor-not-allowed' : ''}`}
                                title={
                                  isEnterpriseActive
                                    ? t('企业API模式使用访问令牌，不支持测试密钥', 'Enterprise API uses access token; key test is disabled')
                                    : undefined
                                }
                              >
                                {geminiKeyTestLoading ? t('测试中...', 'Testing...') : t('测试密钥', 'Test')}
                              </button>
                              <button
                                type="button"
                                onClick={handleDeleteInvalidGeminiKeys}
                                disabled={invalidGeminiKeyCount === 0}
                                className={`px-3 h-9 rounded-lg border text-sm transition-colors ${
                                  invalidGeminiKeyCount === 0
                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                }`}
                                title={t('一键删除失效密钥（401/403）', 'Delete invalid keys (401/403)')}
                              >
                                {t('删除失效', 'Delete invalid')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setGeminiKeyImportOpen((v) => !v)}
                                className={`px-3 h-9 rounded-lg border text-sm transition-colors ${
                                  geminiKeyImportOpen
                                    ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                title={t('一键导入：粘贴多行密钥', 'Import: paste multi-line keys')}
                              >
                                {t('一键导入', 'Import')}
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          onClick={() => setShowRelayMenu(false)}
                          aria-label={t('关闭', 'Close')}
                        >
                          <X size={18} />
                        </button>
                      </div>

                      {!isOpenaiMode && geminiKeyImportOpen && (
                        <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 space-y-2">
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {t('一键导入密钥', 'Import keys')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {t('一行一个密钥，自动去重，空行会被忽略。', 'One key per line. Duplicates are ignored.')}
                          </div>
                          <textarea
                            value={geminiKeyImportText}
                            onChange={(e) => setGeminiKeyImportText(e.target.value)}
                            placeholder={t('在这里粘贴多行密钥...', 'Paste multi-line keys here...')}
                            className="w-full min-h-[120px] px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setGeminiKeyImportOpen(false);
                                setGeminiKeyImportText('');
                              }}
                              className="px-3 h-9 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              {t('取消', 'Cancel')}
                            </button>
                            <button
                              type="button"
                              onClick={handleImportGeminiKeys}
                              disabled={!geminiKeyImportText.trim()}
                              className="px-3 h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {t('导入', 'Import')}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        {(isOpenaiMode ? relays : geminiKeys).map((site) => (
                          <div
                            key={site.id}
                            className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800 dark:text-gray-100">{site.name}</span>
                                {!isOpenaiMode && geminiKeyTestResults[site.id] && (
                                  <span
                                    className={`text-[11px] font-medium whitespace-nowrap ${
                                      geminiKeyTestResults[site.id].ok
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}
                                    title={geminiKeyTestResults[site.id].message}
                                  >
                                    {geminiKeyTestResults[site.id].ok
                                      ? t('可用', 'OK')
                                      : `[${geminiKeyTestResults[site.id].status ?? 'ERR'}]`}
                                  </span>
                                )}
                                <button
                                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                  onClick={() => {
                                    const newName = prompt(t('输入新的名称', 'Enter new name'), site.name);
                                    if (newName && newName.trim()) {
                                      const updater = (list: any[]) =>
                                        list.map((r) => (r.id === site.id ? { ...r, name: newName.trim() } : r));
                                      isOpenaiMode ? setRelays(updater(relays)) : setGeminiKeys(updater(geminiKeys));
                                    }
                                  }}
                                >
                                  <Edit2 size={14} />
                                </button>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                                  title={t('删除', 'Delete')}
                                  onClick={() => {
                                    if (isOpenaiMode) {
                                      const next = relays.filter((r) => r.id !== site.id);
                                      setRelays(next);
                                      if (activeRelayId === site.id) {
                                        setActiveRelayId('');
                                      }
                                    } else {
                                      const next = geminiKeys.filter((r) => r.id !== site.id);
                                      setGeminiKeys(next);
                                    }
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{t('启用', 'Use')}</span>
                                <button
                                  onClick={() => {
                                    const nowEnabled = !site.enabled;
                                    if (isOpenaiMode) {
                                      const next = relays.map((r) =>
                                        r.id === site.id ? { ...r, enabled: nowEnabled } : r
                                      );
                                      setRelays(next);
                                      if (activeRelayId === site.id && !nowEnabled) {
                                        setActiveRelayId('');
                                      }
                                      if (nowEnabled && !activeRelayId) {
                                        setActiveRelayId(site.id);
                                      }
                                    } else {
                                      const next = geminiKeys.map((r) =>
                                        r.id === site.id ? { ...r, enabled: nowEnabled } : r
                                      );
                                      setGeminiKeys(next);
                                    }
                                  }}
                                  className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                                    site.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                                  }`}
                                >
                                  <div
                                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                                      site.enabled ? 'translate-x-5' : ''
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <input
                                type="password"
                                placeholder={t('密钥', 'API Key')}
                                value={site.apiKey}
                                onChange={(e) => {
                                  if (isOpenaiMode) {
                                    const next = relays.map((r) => (r.id === site.id ? { ...r, apiKey: e.target.value } : r));
                                    setRelays(next);
                                  } else {
                                    const next = geminiKeys.map((r) => (r.id === site.id ? { ...r, apiKey: e.target.value } : r));
                                    setGeminiKeys(next);
                                  }
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                              />
                              {isOpenaiMode && (
                                <input
                                  type="text"
                                  placeholder={t('API 地址 (Base URL)', 'API Base URL')}
                                  value={(site as RelaySite).apiUrl}
                                  onChange={(e) => {
                                    const next = relays.map((r) =>
                                      r.id === site.id ? { ...r, apiUrl: e.target.value } : r
                                    );
                                    setRelays(next);
                                  }}
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowRelayMenu(false)}
                          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          {t('关闭', 'Close')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isOpenaiMode) {
                              const count = relays.length + 1;
                              setRelays([
                                ...relays,
                                { id: uuidv4(), name: `中转站${count}`, apiKey: '', apiUrl: '' },
                              ]);
                            } else {
                              const count = geminiKeys.length + 1;
                              setGeminiKeys([
                                ...geminiKeys,
                                { id: uuidv4(), name: `密钥${count}`, apiKey: '', enabled: false },
                              ]);
                            }
                          }}
                          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
                        >
                          {isOpenaiMode ? t('新增中转站', 'Add relay') : t('新增密钥', 'Add key')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative w-full max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={apiMode === 'openai' ? openaiApiKey : geminiApiKey}
                    onChange={(e) =>
                      apiMode === 'openai' ? setOpenaiApiKey(e.target.value) : setGeminiApiKey(e.target.value)
                    }
                    placeholder="sk-..."
                    className="block w-full pl-10 pr-10 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500 rounded-lg text-sm font-mono text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Lock
                      size={14}
                      className={(apiMode === 'openai' ? openaiApiKey : geminiApiKey) ? 'text-green-500' : 'text-gray-300'}
                    />
                  </div>
                </div>
                {(apiMode === 'openai' ? openaiApiKey : geminiApiKey) && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Lock size={12} /> {t('已启用自定义密钥', 'Custom key active')}
                  </p>
                )}

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {t('API 地址 (Base URL)', 'API Base URL')}
                      </h3>

                      {apiMode === 'gemini' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            {t('自定义地址', 'Custom base')}
                          </span>
                          <button
                            type="button"
                            onClick={() => setGeminiCustomBaseEnabled(!geminiCustomBaseEnabled)}
                            className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                              geminiCustomBaseEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                            }`}
                            title={t(
                              '开启后可修改 API 地址',
                              'Enable to edit the API base URL'
                            )}
                          >
                            <div
                              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                                geminiCustomBaseEnabled ? 'translate-x-5' : ''
                              }`}
                            />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {apiMode === 'gemini' && enterpriseFeatureEnabled && (
                        <button
                          type="button"
                          onClick={() => setGeminiEnterpriseEnabled(!geminiEnterpriseEnabled)}
                          className={`flex items-center gap-2 px-3 h-9 text-sm font-medium rounded-md border transition-colors ${
                            geminiEnterpriseEnabled
                              ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                          title={t(
                            '切换到 Google Cloud Vertex AI（需要访问令牌）',
                            'Use Google Cloud Vertex AI (requires access token)'
                          )}
                        >
                          <span>{t('企业API', 'Enterprise API')}</span>
                        </button>
                      )}

                      {canManageExtras && (
                        <button
                          type="button"
                          onClick={() => setShowRelayMenu((v) => !v)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          {extraButtonLabel}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative w-full max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LinkIcon size={16} className="text-gray-400" />
                    </div>
	                    <input
	                      type="text"
	                      value={
	                        apiMode === 'openai'
	                          ? openaiApiUrl
	                          : geminiCustomBaseEnabled
	                          ? geminiApiUrl
	                          : isEnterpriseActive
	                          ? enterpriseFixedBaseUrl
	                          : 'https://generativelanguage.googleapis.com'
	                      }
	                      onChange={(e) => {
	                        if (apiMode === 'openai') {
	                          setOpenaiApiUrl(e.target.value);
	                          return;
	                        }
	                        if (!geminiCustomBaseEnabled) return;
	                        setGeminiApiUrl(e.target.value);
	                      }}
	                      placeholder={
	                        apiMode === 'openai'
	                          ? t('可填你的兼容代理地址', 'https://your-openai-compatible-base')
	                          : isEnterpriseActive
	                          ? enterpriseFixedBaseUrl
	                          : 'https://generativelanguage.googleapis.com'
	                      }
	                      readOnly={apiMode === 'gemini' && !geminiCustomBaseEnabled}
	                      className={`block w-full pl-10 pr-10 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono text-gray-800 dark:text-gray-100 outline-none transition-all ${
	                        apiMode === 'gemini' && !geminiCustomBaseEnabled
	                          ? 'opacity-70 cursor-text select-text'
	                          : 'focus:bg-white dark:focus:bg-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
	                      }`}
	                    />
	                  </div>
                  {apiMode === 'gemini' ? (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {geminiCustomBaseEnabled
                        ? t(
                            isEnterpriseActive
                              ? `留空默认 ${enterpriseFixedBaseUrl}`
                              : '留空默认 https://generativelanguage.googleapis.com',
                            isEnterpriseActive
                              ? `Default is ${enterpriseFixedBaseUrl}`
                              : 'Default is https://generativelanguage.googleapis.com'
                          )
                        : t(
                            isEnterpriseActive
                              ? `企业API：固定使用 ${enterpriseFixedBaseUrl}`
                              : '未开启自定义地址：固定使用 https://generativelanguage.googleapis.com',
                            isEnterpriseActive
                              ? `Enterprise API: uses ${enterpriseFixedBaseUrl}`
                              : 'Custom base disabled: uses https://generativelanguage.googleapis.com'
                          )}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {t(
                        'OpenAI 兼容模式：填写你的代理 / OneAPI 等兼容地址，留空使用后端默认配置（如有）。',
                        'OpenAI-compatible mode: fill your proxy/OneAPI compatible base URL; leave blank to use backend default (if any).'
                      )}
                    </p>
                  )}

                  {apiMode === 'gemini' && isEnterpriseActive && (
                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {t('项目 ID', 'Project ID')}
                          </div>
                          <input
                            type="text"
                            value={geminiEnterpriseProjectId}
                            onChange={(e) => setGeminiEnterpriseProjectId(e.target.value)}
                            placeholder="my-gcp-project"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {t('区域 (Location)', 'Location')}
                          </div>
                          <input
                            type="text"
                            value={geminiEnterpriseLocation}
                            onChange={(e) => setGeminiEnterpriseLocation(e.target.value)}
                            placeholder="us-central1"
                            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-1 max-w-2xl">
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {t('访问令牌 (Access Token)', 'Access Token')}
                        </div>
                        <input
                          type="password"
                          value={geminiEnterpriseToken}
                          onChange={(e) => setGeminiEnterpriseToken(e.target.value)}
                          placeholder="ya29..."
                          className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {t(
                            '企业 API 使用 Vertex AI：需要 OAuth 访问令牌（例如 gcloud auth print-access-token）。',
                            'Enterprise API uses Vertex AI and requires an OAuth access token (e.g. gcloud auth print-access-token).'
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-10 max-w-3xl">
              <h2 className="text-3xl font-bold mb-6">{t('数据', 'Data')}</h2>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('并发统计', 'Concurrency stats')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 p-4">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('今日并发数', 'Today lanes')}
                    </div>
                    <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      {todayConcurrencyCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 p-4">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('总并发次数', 'Total lanes')}
                    </div>
                    <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      {totalConcurrencyCount.toLocaleString()}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('统计来源于本地历史记录。', 'Counts are based on local history records.')}
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('并发间隔', 'Concurrency interval')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t(
                    '控制每个并发通道的启动间隔（秒）。数值越大，通道启动越慢。',
                    'Controls the delay (seconds) between each lane start. Larger values mean slower staggered starts.'
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const next = clampConcurrencyInterval(Number((concurrencyIntervalSec - 0.1).toFixed(2)));
                      setConcurrencyIntervalSec(next);
                      setIntervalDraft(formatConcurrencyInterval(next));
                    }}
                    className="h-9 w-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    aria-label={t('减少', 'Decrease')}
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.]*"
                    value={intervalDraft}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                      if (!cleaned) {
                        setIntervalDraft('');
                        return;
                      }
                      const parts = cleaned.split('.');
                      const normalized = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : parts[0];
                      setIntervalDraft(normalized);
                    }}
                    onBlur={() => commitConcurrencyInterval(intervalDraft)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitConcurrencyInterval(intervalDraft);
                      }
                    }}
                    className="h-9 w-24 text-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 text-gray-800 dark:text-gray-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = clampConcurrencyInterval(Number((concurrencyIntervalSec + 0.1).toFixed(2)));
                      setConcurrencyIntervalSec(next);
                      setIntervalDraft(formatConcurrencyInterval(next));
                    }}
                    className="h-9 w-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    aria-label={t('增加', 'Increase')}
                  >
                    +
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('秒', 'sec')}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('范围：0.1 秒 - 60 秒', 'Range: 0.1s - 60s')}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('默认下载目录', 'Default download folder')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t(
                    '一键下载会在该目录下自动创建并发历史文件夹。',
                    'Bulk download will create a concurrency history folder inside this directory.'
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void onPickDownloadDirectory()}
                    disabled={!downloadDirectorySupported}
                    title={
                      downloadDirectorySupported
                        ? t('选择默认下载文件夹', 'Pick a default download folder')
                        : t('当前浏览器不支持文件夹选择', 'Folder picker is not supported')
                    }
                    className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors ${
                      downloadDirectorySupported
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {t('选择文件夹', 'Pick folder')}
                  </button>
                  {downloadDirectoryName && (
                    <button
                      type="button"
                      onClick={() => void onClearDownloadDirectory()}
                      className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                      {t('清除选择', 'Clear selection')}
                    </button>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {downloadDirectoryName
                      ? `${t('已选择：', 'Selected: ')}${downloadDirectoryName}`
                      : t('未选择', 'Not selected')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t(
                    '浏览器不会暴露完整路径，仅显示文件夹名称。',
                    'Browsers do not expose full paths; only folder names are shown.'
                  )}
                </p>
                {!downloadDirectorySupported && (
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    {t('请使用 Chrome/Edge 且通过 https/localhost 打开。', 'Use Chrome/Edge over https/localhost.')}
                  </p>
                )}
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('下载代理', 'Download proxy')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t(
                    '用于解决跨域图片无法下载的问题（可选）。支持使用 {url} 作为占位符。',
                    'Optional proxy for cross-origin image downloads. Supports {url} placeholder.'
                  )}
                </p>
                <input
                  type="text"
                  value={downloadProxyUrl}
                  onChange={(e) => setDownloadProxyUrl(e.target.value)}
                  placeholder="https://proxy.example.com/fetch?url="
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t(
                    '示例：https://corsproxy.io/? 或 https://proxy.example.com/fetch?url= 或 https://proxy.example.com/{url}',
                    'Example: https://corsproxy.io/? or https://proxy.example.com/fetch?url= or https://proxy.example.com/{url}'
                  )}
                </p>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('清空本地数据', 'Clear local data')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t(
                    '清除浏览器中保存的设置、模型列表和会话数据。这不会影响服务器内容。',
                    'Clear settings, model list, and conversations stored in this browser. Does not affect server data.'
                  )}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(t('确定要清空本地数据吗？这会删除本机上的所有配置与缓存。', 'Are you sure to clear local data? This removes all local config and cache.'))) {
                      try {
                        localStorage.clear();
                      } catch (e) {
                        console.error(e);
                      }
                      await onClearDownloadDirectory();
                      window.location.reload();
                    }
                  }}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow-sm transition-colors"
                >
                  {t('清空 LocalStorage', 'Clear LocalStorage')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="max-w-4xl">
              <AssetLibraryPanel language={language} onToast={showToast} />
            </div>
          )}

          {activeTab === 'sora2api' && (
            <div className="space-y-10 max-w-4xl">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">{t('Sora2api模型', 'Sora2api Models')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('点击模型/风格 ID 会自动复制，并弹出“已复制模型”的提示。', 'Click a model/style ID to copy.')}
                </p>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-semibold">{t('支持的模型', 'Supported models')}</h3>

                <div className="space-y-3">
                  <div className="text-base font-semibold">{t('图片模型', 'Image models')}</div>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800/60">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold">{t('模型', 'Model')}</th>
                          <th className="text-left px-4 py-3 font-semibold">{t('说明', 'Notes')}</th>
                          <th className="text-left px-4 py-3 font-semibold">{t('尺寸', 'Size')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sora2apiImageModels.map((m) => (
                          <tr key={m.id} className="border-t border-gray-200 dark:border-gray-700">
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => void copyText(m.id, t(`已复制模型：${m.id}`, `Copied model: ${m.id}`))}
                                className="px-3 py-1 rounded-lg bg-gray-900/10 dark:bg-white/10 hover:bg-gray-900/20 dark:hover:bg-white/20 font-mono text-xs font-semibold"
                                title={t('点击复制', 'Click to copy')}
                              >
                                {m.id}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                              {language === 'zh' ? m.descZh : m.descEn}
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{m.size}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <div className="text-base font-semibold">{t('视频模型', 'Video models')}</div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('标准版（Sora2）', 'Standard (Sora2)')}</div>
                      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-800/60">
                            <tr>
                              <th className="text-left px-4 py-3 font-semibold">{t('模型', 'Model')}</th>
                              <th className="text-left px-4 py-3 font-semibold">{t('时长', 'Duration')}</th>
                              <th className="text-left px-4 py-3 font-semibold">{t('方向', 'Orientation')}</th>
                              <th className="text-left px-4 py-3 font-semibold">{t('说明', 'Notes')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sora2apiVideoStandardModels.map((m) => (
                              <tr key={m.id} className="border-t border-gray-200 dark:border-gray-700">
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => void copyText(m.id, t(`已复制模型：${m.id}`, `Copied model: ${m.id}`))}
                                    className="px-3 py-1 rounded-lg bg-gray-900/10 dark:bg-white/10 hover:bg-gray-900/20 dark:hover:bg-white/20 font-mono text-xs font-semibold"
                                  >
                                    {m.id}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{m.durationSec}{t('秒', 's')}</td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                                  {m.orientation === 'landscape' ? t('横屏', 'Landscape') : t('竖屏', 'Portrait')}
                                </td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{language === 'zh' ? m.descZh : m.descEn}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {t('Pro 版（需要 ChatGPT Pro 订阅）', 'Pro (requires ChatGPT Pro)')}
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-800/60">
                            <tr>
                              <th className="text-left px-4 py-3 font-semibold">{t('模型', 'Model')}</th>
                              <th className="text-left px-4 py-3 font-semibold">{t('时长', 'Duration')}</th>
                              <th className="text-left px-4 py-3 font-semibold">{t('方向', 'Orientation')}</th>
                              <th className="text-left px-4 py-3 font-semibold">{t('说明', 'Notes')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sora2apiVideoProModels.map((m) => (
                              <tr key={m.id} className="border-t border-gray-200 dark:border-gray-700">
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => void copyText(m.id, t(`已复制模型：${m.id}`, `Copied model: ${m.id}`))}
                                    className="px-3 py-1 rounded-lg bg-gray-900/10 dark:bg-white/10 hover:bg-gray-900/20 dark:hover:bg-white/20 font-mono text-xs font-semibold"
                                  >
                                    {m.id}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{m.durationSec}{t('秒', 's')}</td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                                  {m.orientation === 'landscape' ? t('横屏', 'Landscape') : t('竖屏', 'Portrait')}
                                </td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{language === 'zh' ? m.descZh : m.descEn}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {t('Pro HD 版（需要 ChatGPT Pro 订阅，高清质量）', 'Pro HD (requires ChatGPT Pro, higher quality)')}
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-800/60">
                            <tr>
                              <th className="text-left px-4 py-3 font-semibold">{t('模型', 'Model')}</th>
                              <th className="text-left px-4 py-3 font-semibold">{t('时长', 'Duration')}</th>
                              <th className="text-left px-4 py-3 font-semibold">{t('方向', 'Orientation')}</th>
                              <th className="text-left px-4 py-3 font-semibold">{t('说明', 'Notes')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sora2apiVideoProHdModels.map((m) => (
                              <tr key={m.id} className="border-t border-gray-200 dark:border-gray-700">
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => void copyText(m.id, t(`已复制模型：${m.id}`, `Copied model: ${m.id}`))}
                                    className="px-3 py-1 rounded-lg bg-gray-900/10 dark:bg-white/10 hover:bg-gray-900/20 dark:hover:bg-white/20 font-mono text-xs font-semibold"
                                  >
                                    {m.id}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{m.durationSec}{t('秒', 's')}</td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                                  {m.orientation === 'landscape' ? t('横屏', 'Landscape') : t('竖屏', 'Portrait')}
                                </td>
                                <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{language === 'zh' ? m.descZh : m.descEn}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t('注意：Pro 系列模型需要 ChatGPT Pro 订阅（plan_type: "chatgpt_pro"）。如果没有 Pro 账号，调用会返回错误。', 'Note: Pro models require ChatGPT Pro (plan_type: "chatgpt_pro").')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('视频风格功能', 'Video style')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('在提示词中使用 {风格ID} 格式指定风格，系统会自动提取并应用该风格。', 'Use {styleId} in your prompt to apply a style.')}
                </p>

                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/60">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">{t('风格ID', 'Style ID')}</th>
                        <th className="text-left px-4 py-3 font-semibold">{t('显示名称', 'Name')}</th>
                        <th className="text-left px-4 py-3 font-semibold">{t('说明', 'Notes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sora2apiStyles.map((s) => (
                        <tr key={s.id} className="border-t border-gray-200 dark:border-gray-700">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                void copyText(`{${s.id}}`, t(`已复制模型：{${s.id}}`, `Copied: {${s.id}}`))
                              }
                              className="px-3 py-1 rounded-lg bg-gray-900/10 dark:bg-white/10 hover:bg-gray-900/20 dark:hover:bg-white/20 font-mono text-xs font-semibold"
                              title={t('点击复制', 'Click to copy')}
                            >
                              {s.id}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{s.name}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{language === 'zh' ? s.descZh : s.descEn}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'roleCards' && (
            <div className="space-y-8 max-w-4xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <h2 className="text-3xl font-bold">{t('角色卡/提示词', 'Role Cards/Prompts')}</h2>
                    <div className="inline-flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 px-4 py-2 w-fit">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('启动', 'Enable')}</div>
                      <button
                        type="button"
                        onClick={() => setRoleCardsEnabled(!roleCardsEnabled)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          roleCardsEnabled ? 'bg-gray-700 dark:bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                        title={t('控制输入辅助菜单开关', 'Toggle input menus')}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                            roleCardsEnabled ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t(
                      '启动后，在输入框输入 @ 或 / 会弹出可搜索列表：@ 仅用于“角色”，/ 可用于“角色”与“提示词”。',
                      'When enabled, typing @ or / in the input opens a searchable menu.'
                    )}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-3 w-full lg:w-auto">
                  <button
                    type="button"
                    onClick={handleExportRoleCards}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
                  >
                    {t('导出', 'Export')}
                  </button>
                  <button
                    type="button"
                    onClick={() => roleCardImportInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
                  >
                    {t('导入', 'Import')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openRoleCardEditor();
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors whitespace-nowrap"
                  >
                    <Plus size={16} />
                    {t('添加', 'Add')}
                  </button>
                  <input
                    ref={roleCardImportInputRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => void handleImportRoleCards(e.target.files)}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 p-4">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={roleCardsSearch}
                    onChange={(e) => setRoleCardsSearch(e.target.value)}
                    placeholder={t('搜索角色/提示词...', 'Search roles/prompts...')}
                    className="w-full pl-9 pr-3 h-11 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
                  />
                </div>
                <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                  {t('可搜：简称 / @ID / 备注 / 插入内容', 'Search: alias / @ID / note / insert')}
                </div>
              </div>

              {roleCards.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t('暂无条目，点击右上角“添加”创建。', 'No items yet. Click Add to create one.')}
                </div>
              ) : filteredRoleCards.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">{t('没有匹配结果。', 'No matches found.')}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRoleCards.map((item) => {
                    const badge =
                      item.kind === 'role' ? t('角色', 'Role') : t('提示词', 'Prompt');
                    const badgeClass =
                      item.kind === 'role'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/20'
                        : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 border-indigo-500/20';
                    const primaryText = item.kind === 'role' ? `@${item.atId || ''}` : (item.insertContent || '');
                    const secondaryText = item.note ? item.note : '';
                    const tintClass =
                      item.kind === 'role'
                        ? 'from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-500/15 dark:via-emerald-500/5'
                        : 'from-indigo-500/10 via-indigo-500/5 to-transparent dark:from-indigo-500/15 dark:via-indigo-500/5';
                    const avatarRingClass =
                      item.kind === 'role' ? 'ring-emerald-500/25' : 'ring-indigo-500/25';
                    return (
                      <div
                        key={item.id}
                        className="group relative overflow-hidden rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/80 dark:bg-[#0b1220]/55 p-4 flex gap-4 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-white/20 transition-all"
                      >
                        <div className={`pointer-events-none absolute inset-0 opacity-70 bg-gradient-to-br ${tintClass}`} />
                        <div
                          className={`relative h-12 w-12 rounded-2xl overflow-hidden bg-white/70 dark:bg-gray-900/40 flex items-center justify-center shrink-0 ring-1 ${avatarRingClass} shadow-sm`}
                        >
                          {item.avatarDataUrl ? (
                            <img src={item.avatarDataUrl} alt="avatar" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-lg font-extrabold text-gray-500 dark:text-gray-300">
                              {item.kind === 'role' ? '@' : '/'}
                            </span>
                          )}
                        </div>
                        <div className="relative min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                  {item.alias}
                                </div>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                {item.kind === 'role' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-900/10 dark:bg-white/10 text-gray-700 dark:text-gray-200 text-xs font-mono font-semibold">
                                    {primaryText || t('（无内容）', '(empty)')}
                                  </span>
                                ) : (
                                  <div className="text-xs text-gray-700 dark:text-gray-200 line-clamp-2">
                                    {primaryText || t('（无内容）', '(empty)')}
                                  </div>
                                )}
                              </div>
                              {secondaryText && (
                                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">
                                  {secondaryText}
                                </div>
                              )}
                            </div>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] border ${badgeClass}`}>
                              {badge}
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const textToCopy =
                                  item.kind === 'role' ? `@${item.atId || ''}` : (item.insertContent || '');
                                void copyText(textToCopy, t('已复制', 'Copied'));
                              }}
                              className="h-9 px-3 rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-gray-900/30 text-xs font-semibold text-gray-800 dark:text-gray-100 hover:bg-white dark:hover:bg-white/5 transition-colors"
                              disabled={item.kind === 'role' ? !(item.atId || '').trim() : !(item.insertContent || '').trim()}
                            >
                              {item.kind === 'role' ? t('复制 @ID', 'Copy @') : t('复制内容', 'Copy')}
                            </button>
                            <button
                              type="button"
                              onClick={() => openRoleCardEditor(item.id)}
                              className="h-9 px-3 rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-gray-900/30 text-xs font-semibold text-gray-800 dark:text-gray-100 hover:bg-white dark:hover:bg-white/5 transition-colors"
                            >
                              <Edit2 size={14} className="inline-block mr-1" />
                              {t('编辑', 'Edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRoleCard(item.id)}
                              className="h-9 px-3 rounded-xl border border-red-200/80 dark:border-red-900/40 bg-white/70 dark:bg-gray-900/30 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                            >
                              <Trash2 size={14} className="inline-block mr-1" />
                              {t('删除', 'Delete')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="flex flex-col items-center gap-8 max-w-4xl mx-auto py-6 text-center">
              <div className="w-40 h-24 rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-emerald-600 to-slate-800 flex items-center justify-center">
                <img
                  src="/wuniao.png"
                  alt="项目封面"
                  className="w-full h-full object-cover pointer-events-none select-none"
                  loading="eager"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.onerror = null;
                    img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
                  }}
                />
              </div>

              <div className="space-y-3">
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white">并发创作工作站</h2>
                <button
                  type="button"
                  onClick={handleAboutVersionTap}
                  onMouseEnter={() => void handleCopyVersionHover()}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200 text-sm font-semibold select-none"
                >
                  {APP_VERSION}
                </button>
                <p className="text-base text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
                  此项目是一款面向多模态的并发工作站，支持同时调度 OpenAI 与 Gemini 模型，覆盖文本、图像与视频生成。
                  内置并发历史追踪、可视化网格与分栏聊天，并提供开发者开关、快捷模型切换和本地持久化能力，帮助你高效迭代创意和脚本。
                </p>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <a
                    href="https://space.bilibili.com/1375316004?spm_id_from=333.40164.0.0"
                    target="_blank"
                    rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF6699] text-white hover:brightness-105 active:scale-[0.99] transition-all shadow-md hover:-translate-y-0.5"
                  >
                    哔哩哔哩
                  </a>
                  <a
                    href="https://github.com/Wuniao79/Concurrent-Picture-AND-Video"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 active:scale-[0.99] transition-all shadow-md hover:-translate-y-0.5"
                  >
                    <Github size={18} />
                    在 GitHub 上查看
                  </a>
                  <a
                    href="https://github.com/Wuniao79/Concurrent-Picture-AND-Video/stargazers"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:-translate-y-0.5 active:scale-[0.99] transition-all shadow-sm"
                  >
                    <Star
                      size={16}
                      className="text-yellow-500 fill-yellow-400"
                    />
                    <span>{starLoading ? '…' : starCount?.toLocaleString() ?? '--'}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Stars</span>
                  </a>
                </div>
                <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm text-center">
                  并发工作站 · 由 Gemini & OpenAI 驱动
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                {[
                  { title: '多模型并发', desc: '一键设定并发数，网格/分栏双布局实时查看' },
                  { title: '持久化历史', desc: '并发完成后自动写入历史，可搜索、重放、重命名' },
                  { title: '开发者选项', desc: '隐藏实验功能开关，方便后续扩展' },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-800/40 text-left shadow-sm"
                  >
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'dev' && (
            <div className="space-y-6 max-w-3xl">
              <h2 className="text-3xl font-bold mb-2">{t('开发者选项', 'Developer Options')}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                （{t('下列功能都还不稳定，可能会产生 bug，请谨慎开启', 'The features below are experimental and may be unstable.')}）
              </p>

              <div className="space-y-3">
                {laneLimitUnlocked && (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {t('并发数上限', 'Lane limit')}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t('限制并发输入与新对话的最大并发数（最高 999）', 'Caps lane input and new-chat lanes (max 999)')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLaneCountLimit(Math.max(1, Math.min(999, laneCountLimit - 1)))}
                        className="h-9 w-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        aria-label={t('减少', 'Decrease')}
                      >
                        -
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={String(laneCountLimit)}
                        onChange={(e) => {
                          const numeric = e.target.value.replace(/[^0-9]/g, '');
                          if (!numeric) {
                            setLaneCountLimit(1);
                            return;
                          }
                          const n = parseInt(numeric, 10);
                          if (isNaN(n)) return;
                          setLaneCountLimit(Math.max(1, Math.min(999, n)));
                        }}
                        className="h-9 w-20 text-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 text-gray-800 dark:text-gray-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        aria-label={t('并发数上限', 'Lane limit')}
                      />
                      <button
                        type="button"
                        onClick={() => setLaneCountLimit(Math.max(1, Math.min(999, laneCountLimit + 1)))}
                        className="h-9 w-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        aria-label={t('增加', 'Increase')}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('总开关', 'Master switch')}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t('开启后可使用实验功能开关', 'Enables experimental feature toggles')}
                    </div>
                  </div>
                  <button
                    onClick={() => setDevExperimentalEnabled(!devExperimentalEnabled)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                      devExperimentalEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                        devExperimentalEnabled ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-3 pt-2">
                  {[
                    {
                      id: 'tbd1',
                      value: devTbd1Enabled,
                      setValue: setDevTbd1Enabled,
                      title: t('Gemini企业级API', 'Gemini Enterprise API'),
                      desc: t('（未测试，等有缘人赞助GCP）', '(Untested; waiting for GCP sponsorship)'),
                    },
                    {
                      id: 'tbd2',
                      value: devTbd2Enabled,
                      setValue: setDevTbd2Enabled,
                      title: t('视频模型突破对话限制', 'Video model chat limit override'),
                      desc: t(
                        '大部分视频模型都是一次性对话，开启此功能可能会有引发bug',
                        'Most video models are one-shot; enabling this may cause bugs.'
                      ),
                    },
                    {
                      id: 'future1',
                      value: devFuture1Enabled,
                      setValue: setDevFuture1Enabled,
                      title: t('未来功能1', 'Future feature 1'),
                      desc: t('未想好，先占位给后续接入新功能', 'Placeholder for future features.'),
                    },
                    {
                      id: 'future2',
                      value: devFuture2Enabled,
                      setValue: setDevFuture2Enabled,
                      title: t('未来功能2', 'Future feature 2'),
                      desc: t('未想好，先占位给后续接入新功能', 'Placeholder for future features.'),
                    },
                    {
                      id: 'future3',
                      value: devFuture3Enabled,
                      setValue: setDevFuture3Enabled,
                      title: t('未来功能3', 'Future feature 3'),
                      desc: t('未想好，先占位给后续接入新功能', 'Placeholder for future features.'),
                    },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!devExperimentalEnabled) return;
                          item.setValue(!item.value);
                        }}
                        disabled={!devExperimentalEnabled}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          item.value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                        } ${devExperimentalEnabled ? '' : 'opacity-60 cursor-not-allowed'}`}
                        title={devExperimentalEnabled ? item.desc : t('请先开启总开关', 'Enable the master switch first')}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                            item.value ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
