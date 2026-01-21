import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Copy, Download, Image as ImageIcon, LayoutGrid, Plus, Trash2, X } from 'lucide-react';
import { generateResponse } from '../../services/geminiService';
import { ApiMode, GeminiImageSettings, Language, Model, ModelProvider, RoleCardItem } from '../../types';
import type { RelaySite } from '../../hooks/useSettings';
import { hasModelModality } from '../../utils/modelModality';

type StoryboardRole = {
  id: string;
  name: string;
  atId?: string;
};

type DialogueLine = {
  id: string;
  roleId: string;
  text: string;
};

type ShotItem = {
  id: string;
  imageUrl: string | null;
  description: string;
  duration: string;
  dialogues: DialogueLine[];
};

const SHOT_COUNT = 9;
const ROLE_STORAGE_KEY = 'sora2_characters';
const VISION_PROMPT_STORAGE_KEY = 'storyboard_vision_prompt';
const IMAGE_PROMPT_STORAGE_KEY = 'storyboard_image_prompt';
const DEFAULT_VISION_PROMPT = '简短描述画面';
const DEFAULT_IMAGE_PROMPT = 'mappa anime style, {{desc}}';
const NUM_TO_ZH = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

const createId = () => Math.random().toString(36).slice(2, 10);

const ProviderDot: React.FC<{ provider: ModelProvider }> = ({ provider }) => (
  <span
    className={`inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/20 ${
      provider === 'gemini' ? 'bg-amber-400' : 'bg-blue-500'
    }`}
    aria-hidden="true"
  />
);

const buildDefaultShots = (): ShotItem[] =>
  Array.from({ length: SHOT_COUNT }, (_, idx) => ({
    id: `shot-${idx}`,
    imageUrl: null,
    description: '',
    duration: '',
    dialogues: [],
  }));

const readFileAsDataUrl = (file: File) =>
  new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Invalid image'));
    img.src = src;
  });

const safeDuration = (value: string) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

const loadRolesFromStorage = (): StoryboardRole[] => {
  if (typeof window === 'undefined') return [{ id: 'c1', name: '主角' }];
  try {
    const raw = localStorage.getItem(ROLE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any, idx: number) => ({
          id: String(item?.id || `c${idx + 1}`),
          name: String(item?.name || `角色${idx + 1}`),
          atId: item?.atId ? String(item.atId) : undefined,
        }));
      }
    }
  } catch {
    // ignore
  }
  return [{ id: 'c1', name: '主角' }];
};

interface StoryboardDesignModalProps {
  isOpen: boolean;
  language: Language;
  onClose: () => void;
  apiMode: ApiMode;
  availableModels: Model[];
  roleCardsEnabled?: boolean;
  roleCards?: RoleCardItem[];
  showRelaySelect?: boolean;
  relays?: RelaySite[];
  activeRelayId?: string;
  onSelectRelay?: (id: string) => void;
  openaiApiKey: string;
  openaiApiUrl: string;
  geminiApiKey: string;
  geminiApiUrl: string;
  geminiImageSettings?: GeminiImageSettings;
  geminiEnterpriseEnabled?: boolean;
  geminiEnterpriseProjectId?: string;
  geminiEnterpriseLocation?: string;
  geminiEnterpriseToken?: string;
}

export const StoryboardDesignModal: React.FC<StoryboardDesignModalProps> = ({
  isOpen,
  language,
  onClose,
  apiMode,
  availableModels,
  roleCardsEnabled = false,
  roleCards = [],
  showRelaySelect,
  relays,
  activeRelayId,
  onSelectRelay,
  openaiApiKey,
  openaiApiUrl,
  geminiApiKey,
  geminiApiUrl,
  geminiImageSettings,
  geminiEnterpriseEnabled,
  geminiEnterpriseProjectId,
  geminiEnterpriseLocation,
  geminiEnterpriseToken,
}) => {
  const [shots, setShots] = useState<ShotItem[]>(() => buildDefaultShots());
  const [roles, setRoles] = useState<StoryboardRole[]>(() => loadRolesFromStorage());
  const [ratio, setRatio] = useState('1:1');
  const [scriptText, setScriptText] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [outputSize, setOutputSize] = useState<{ w: number; h: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [copyHint, setCopyHint] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const copyTimerRef = useRef<number | null>(null);
  const t = (zh: string, en: string) => (language === 'zh' ? zh : en);

  const [aiError, setAiError] = useState<string | null>(null);
  const [bulkVision, setBulkVision] = useState<{
    running: boolean;
    done: number;
    total: number;
    skipped: number;
    failed: number;
  }>({ running: false, done: 0, total: 0, skipped: 0, failed: 0 });
  const [bulkImage, setBulkImage] = useState<{
    running: boolean;
    done: number;
    total: number;
    skipped: number;
    failed: number;
  }>({ running: false, done: 0, total: 0, skipped: 0, failed: 0 });
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [visionPrompt, setVisionPrompt] = useState(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(VISION_PROMPT_STORAGE_KEY) : null;
    return stored !== null ? stored : DEFAULT_VISION_PROMPT;
  });
  const [imagePromptTemplate, setImagePromptTemplate] = useState(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(IMAGE_PROMPT_STORAGE_KEY) : null;
    return stored !== null ? stored : DEFAULT_IMAGE_PROMPT;
  });
  const [isVisionPickerOpen, setIsVisionPickerOpen] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const visionPickerRef = useRef<HTMLDivElement>(null);
  const imagePickerRef = useRef<HTMLDivElement>(null);
  const [isRoleCardPickerOpen, setIsRoleCardPickerOpen] = useState(false);
  const roleCardPickerRef = useRef<HTMLDivElement>(null);
  const [isRelayPickerOpen, setIsRelayPickerOpen] = useState(false);
  const relayPickerRef = useRef<HTMLDivElement>(null);

  const normalizeProvider = (provider?: ModelProvider): ModelProvider => (provider === 'gemini' ? 'gemini' : 'openai');
  const resolveModelProvider = (model?: Model | null, fallbackId?: string): ModelProvider => {
    if (model?.provider) return normalizeProvider(model.provider);
    const id = String(fallbackId || model?.id || '').toLowerCase();
    return id.includes('gemini') ? 'gemini' : 'openai';
  };

  const allModels = useMemo(() => (Array.isArray(availableModels) ? availableModels : []), [availableModels]);

  const visionModelOptions = useMemo(() => {
    const models = allModels.slice(0);
    const textModels = models.filter((m) => hasModelModality(m, 'text'));
    const base = textModels.length > 0 ? textModels : models;
    const candidates = base.filter((m) => Boolean(m.vision));
    return candidates.length > 0 ? candidates : base;
  }, [allModels]);

  const imageModelOptions = useMemo(() => {
    const models = allModels.slice(0);
    const candidates = models.filter((m) => hasModelModality(m, 'image'));
    return candidates.length > 0 ? candidates : models;
  }, [allModels]);

  const [visionModelId, setVisionModelId] = useState(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('storyboard_vision_model_id') : null;
    return (stored || '').trim();
  });

  const [imageModelId, setImageModelId] = useState(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('storyboard_image_model_id') : null;
    return (stored || '').trim();
  });

  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(roles));
    } catch {
      // ignore
    }
  }, [isOpen, roles]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem(VISION_PROMPT_STORAGE_KEY, visionPrompt);
    } catch {
      // ignore
    }
  }, [isOpen, visionPrompt]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem(IMAGE_PROMPT_STORAGE_KEY, imagePromptTemplate);
    } catch {
      // ignore
    }
  }, [imagePromptTemplate, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setAiError(null);
    setIsVisionPickerOpen(false);
    setIsImagePickerOpen(false);
    setIsPromptEditorOpen(false);
    setIsRelayPickerOpen(false);
    const fallbackVision = (visionModelOptions[0]?.id || '').trim();
    const fallbackImage = (imageModelOptions[0]?.id || '').trim();
    setVisionModelId((prev) => (prev && visionModelOptions.some((m) => m.id === prev) ? prev : fallbackVision));
    setImageModelId((prev) => (prev && imageModelOptions.some((m) => m.id === prev) ? prev : fallbackImage));
    setBulkVision((prev) => (prev.running ? { running: false, done: 0, total: 0, skipped: 0, failed: 0 } : prev));
    setBulkImage((prev) => (prev.running ? { running: false, done: 0, total: 0, skipped: 0, failed: 0 } : prev));
  }, [imageModelOptions, isOpen, visionModelOptions]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem('storyboard_vision_model_id', visionModelId);
    } catch {
      // ignore
    }
  }, [isOpen, visionModelId]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem('storyboard_image_model_id', imageModelId);
    } catch {
      // ignore
    }
  }, [isOpen, imageModelId]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisionPickerOpen && !isImagePickerOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const hitVision = visionPickerRef.current && visionPickerRef.current.contains(target);
      const hitImage = imagePickerRef.current && imagePickerRef.current.contains(target);
      if (hitVision || hitImage) return;
      setIsVisionPickerOpen(false);
      setIsImagePickerOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('mousedown', handleClick);
    };
  }, [isVisionPickerOpen, isImagePickerOpen]);

  useEffect(() => {
    if (!isRoleCardPickerOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (roleCardPickerRef.current && roleCardPickerRef.current.contains(target)) return;
      setIsRoleCardPickerOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('mousedown', handleClick);
    };
  }, [isRoleCardPickerOpen]);

  useEffect(() => {
    if (!isRelayPickerOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (relayPickerRef.current && relayPickerRef.current.contains(target)) return;
      setIsRelayPickerOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('mousedown', handleClick);
    };
  }, [isRelayPickerOpen]);

  const stripMarkdownImages = (text: string) => {
    if (!text) return '';
    return text.replace(/!\[[^\]]*]\((\S+?)(?:\s+["'][^"']*["'])?\)/g, '').trim();
  };

  const stripInlineImageData = (text: string) => {
    if (!text) return '';
    return text.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, '').trim();
  };

  const extractInlineImageData = (text: string) => {
    if (!text) return null as string | null;
    const match = text.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/);
    return match?.[0] || null;
  };

  const extractMarkdownImageUrl = (text: string) => {
    if (!text) return null as string | null;
    const match = text.match(/!\[[^\]]*]\((\S+?)(?:\s+["'][^"']*["'])?\)/);
    return match?.[1] || null;
  };

  const readBlobAsDataUrl = (blob: Blob) =>
    new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });

  const fetchUrlAsDataUrl = async (url: string) => {
    const trimmed = (url || '').trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:image/')) return trimmed;
    const response = await fetch(trimmed, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return readBlobAsDataUrl(blob);
  };

  const runModelOnce = async (model: string, prompt: string, imageDataUrls?: string[]) => {
    const picked = allModels.find((m) => m.id === model);
    const provider: ModelProvider = resolveModelProvider(picked, model);
    const apiKey = provider === 'gemini' ? geminiApiKey : openaiApiKey;
    const apiUrl = provider === 'gemini' ? geminiApiUrl : openaiApiUrl;
    let output = '';
    await generateResponse(
      model,
      [],
      prompt,
      (chunk) => {
        output = chunk;
      },
      apiKey,
      false,
      imageDataUrls,
      apiUrl,
      provider,
      undefined,
      provider === 'gemini'
        ? {
            geminiImageSettings,
            geminiEnterpriseEnabled,
            geminiEnterpriseProjectId,
            geminiEnterpriseLocation,
            geminiEnterpriseToken,
          }
        : undefined
    );
    return output || '';
  };

  const resolveVisionPromptText = useCallback(() => {
    const trimmed = String(visionPrompt || '').trim();
    return trimmed || DEFAULT_VISION_PROMPT;
  }, [visionPrompt]);

  const buildImagePromptText = useCallback(
    (desc: string) => {
      const normalizedDesc = String(desc || '').trim();
      const template = String(imagePromptTemplate || '').trim();
      if (!template) return normalizedDesc;
      if (!normalizedDesc) return template;

      const tokenRegex =
        /(\{\{\s*desc\s*\}\}|\{\s*desc\s*\}|\$\{\s*desc\s*\}|\{\{\s*description\s*\}\}|\{\s*description\s*\}|\$\{\s*description\s*\})/gi;
      if (tokenRegex.test(template)) {
        return template.replace(tokenRegex, normalizedDesc).trim();
      }

      const trimmed = template.trimEnd();
      if (!trimmed) return normalizedDesc;
      const joiner = /[，,;；:：]$/.test(trimmed) || trimmed.endsWith('\n') ? ' ' : ', ';
      return `${trimmed}${joiner}${normalizedDesc}`.trim();
    },
    [imagePromptTemplate]
  );

  const updateShot = useCallback((index: number, updater: (shot: ShotItem) => ShotItem) => {
    setShots((prev) => prev.map((shot, idx) => (idx === index ? updater(shot) : shot)));
  }, []);

  const handleSelectImage = useCallback(
    async (index: number, file?: File | null) => {
      if (!file || !file.type.startsWith('image/')) return;
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) return;
      updateShot(index, (shot) => ({ ...shot, imageUrl: dataUrl }));
    },
    [updateShot]
  );

  const handleRemoveImage = (index: number) => {
    updateShot(index, (shot) => ({ ...shot, imageUrl: null }));
  };

  const handleDownloadImage = (index: number) => {
    const shot = shots[index];
    if (!shot?.imageUrl) return;
    const link = document.createElement('a');
    link.href = shot.imageUrl;
    link.download = `shot_${index + 1}.png`;
    link.click();
  };

  const handleAddDialogue = (index: number) => {
    if (roles.length === 0) {
      window.alert(t('请先添加角色', 'Please add a role first.'));
      return;
    }
    const nextLine: DialogueLine = {
      id: createId(),
      roleId: roles[0].id,
      text: '',
    };
    updateShot(index, (shot) => ({ ...shot, dialogues: [...shot.dialogues, nextLine] }));
  };

  const handleUpdateDialogue = (shotIndex: number, lineId: string, updater: (line: DialogueLine) => DialogueLine) => {
    updateShot(shotIndex, (shot) => ({
      ...shot,
      dialogues: shot.dialogues.map((line) => (line.id === lineId ? updater(line) : line)),
    }));
  };

  const handleRemoveDialogue = (shotIndex: number, lineId: string) => {
    updateShot(shotIndex, (shot) => ({
      ...shot,
      dialogues: shot.dialogues.filter((line) => line.id !== lineId),
    }));
  };

  const handleAddRole = () => {
    setRoles((prev) => [
      ...prev,
      { id: `c${Date.now()}`, name: t('新角色', 'New role') },
    ]);
  };

  const normalizedRoleCards = useMemo(() => (Array.isArray(roleCards) ? roleCards : []), [roleCards]);
  const roleCardOptions = useMemo(() => {
    if (!roleCardsEnabled) return [] as RoleCardItem[];
    return normalizedRoleCards
      .filter((item) => item.kind === 'role')
      .filter((item) => Boolean((item.alias || '').trim()) && Boolean((item.atId || '').trim()));
  }, [normalizedRoleCards, roleCardsEnabled]);

  const handleAddRoleFromCard = (card: RoleCardItem) => {
    const alias = String(card.alias || '').trim();
    const atId = String(card.atId || '').trim().replace(/^@+/, '');
    if (!alias || !atId) return;
    setRoles((prev) => {
      const exists = prev.some((r) => String(r.atId || '').replace(/^@+/, '') === atId);
      if (exists) return prev;
      return [...prev, { id: `rc:${atId}`, name: alias, atId }];
    });
    setIsRoleCardPickerOpen(false);
  };

  const handleRemoveRole = (roleId: string) => {
    const confirmed = window.confirm(t('删除该角色？', 'Delete this role?'));
    if (!confirmed) return;
    setRoles((prev) => {
      const next = prev.filter((role) => role.id !== roleId);
      const fallbackRoleId = next[0]?.id || '';
      setShots((shotsPrev) =>
        shotsPrev.map((shot) => ({
          ...shot,
          dialogues: shot.dialogues.map((line) =>
            line.roleId === roleId ? { ...line, roleId: fallbackRoleId } : line
          ),
        }))
      );
      return next;
    });
  };

  const handleResetShots = () => {
    setShots(buildDefaultShots());
  };

  const handleClearShot = (index: number) => {
    updateShot(index, (shot) => ({
      ...shot,
      imageUrl: null,
      description: '',
      duration: '',
      dialogues: [],
    }));
  };

  const clearOutput = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }
    setScriptText('');
    setOutputSize(null);
  };

  const handleClearAll = () => {
    handleResetShots();
    clearOutput();
  };

  const generateStoryboard = useCallback(async () => {
    if (!canvasRef.current) return;
    setIsRendering(true);
    const [rw, rh] = ratio.split(':').map((value) => Number(value) || 1);
    const cellW = 600;
    const cellH = Math.round((cellW * rh) / rw);
    const canvas = canvasRef.current;
    canvas.width = cellW * 3;
    canvas.height = cellH * 3;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsRendering(false);
      return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawTasks = shots
      .map((shot, idx) => {
        if (!shot.imageUrl) return null;
        const row = Math.floor(idx / 3);
        const col = idx % 3;
        const x = col * cellW;
        const y = row * cellH;
        return loadImage(shot.imageUrl)
          .then((img) => {
            const srcW = img.naturalWidth || img.width || 1;
            const srcH = img.naturalHeight || img.height || 1;
            const scale = Math.max(cellW / srcW, cellH / srcH);
            const drawW = srcW * scale;
            const drawH = srcH * scale;
            const dx = x + (cellW - drawW) / 2;
            const dy = y + (cellH - drawH) / 2;
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, cellW, cellH);
            ctx.clip();
            ctx.drawImage(img, dx, dy, drawW, drawH);
            ctx.restore();
          })
          .catch(() => {
            // ignore failed image
          });
      })
      .filter(Boolean) as Promise<void>[];

    if (drawTasks.length > 0) {
      await Promise.all(drawTasks);
    }

    let time = 0;
    let script = '';
    shots.forEach((shot, idx) => {
      const desc = (shot.description || '').trim();
      const dur = safeDuration(shot.duration);
      if (desc || shot.imageUrl) {
        script += `[${time.toFixed(1)}-${(time + dur).toFixed(1)}s] 镜头${idx + 1}: ${desc || '画面'}\n`;
        shot.dialogues.forEach((line) => {
          const text = (line.text || '').trim();
          if (!text) return;
          const role = roles.find((item) => item.id === line.roleId);
          const atId = String(role?.atId || '').trim().replace(/^@+/, '');
          const outputRole = atId ? `@${atId}` : role?.name || '角色';
          script += `   -> ${outputRole}: "${text}"\n`;
        });
        time += dur;
      }
    });

    setScriptText(script);
    setOutputSize({ w: canvas.width, h: canvas.height });
    setIsRendering(false);
  }, [ratio, roles, shots]);

  const bulkVisionTargets = useMemo(
    () =>
      shots
        .map((shot, idx) => ({ shot, idx }))
        .filter(({ shot }) => Boolean(shot.imageUrl) && !String(shot.description || '').trim())
        .map(({ idx }) => idx),
    [shots]
  );

  const bulkImageTargets = useMemo(
    () =>
      shots
        .map((shot, idx) => ({ shot, idx }))
        .filter(({ shot }) => !shot.imageUrl && Boolean(String(shot.description || '').trim()))
        .map(({ idx }) => idx),
    [shots]
  );

  const canRunVision = Boolean(
    visionModelId && bulkVisionTargets.length > 0 && !bulkVision.running && !bulkImage.running
  );
  const canRunImage = Boolean(
    imageModelId && bulkImageTargets.length > 0 && !bulkImage.running && !bulkVision.running
  );

  const handleBulkVision = async () => {
    if (!canRunVision) return;
    setAiError(null);
    const targets = bulkVisionTargets.slice(0);
    const shotsSnapshot = shots.slice(0);
    setBulkVision({ running: true, done: 0, total: targets.length, skipped: 0, failed: 0 });
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < targets.length; i += 1) {
      const idx = targets[i];
      const img = shotsSnapshot[idx]?.imageUrl;
      if (!img) {
        skipped += 1;
        setBulkVision({ running: true, done: i + 1, total: targets.length, skipped, failed });
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const raw = await runModelOnce(visionModelId, resolveVisionPromptText(), [img]);
        const cleaned = stripInlineImageData(stripMarkdownImages(raw)).trim();
        if (cleaned) {
          updateShot(idx, (shot) => ({ ...shot, description: cleaned }));
        } else {
          failed += 1;
        }
      } catch (e: any) {
        failed += 1;
        setAiError(String(e?.message || e || ''));
      } finally {
        setBulkVision({ running: true, done: i + 1, total: targets.length, skipped, failed });
      }
    }

    setBulkVision((prev) => ({ ...prev, running: false }));
  };

  const handleBulkImage = async () => {
    if (!canRunImage) return;
    setAiError(null);
    const targets = bulkImageTargets.slice(0);
    const shotsSnapshot = shots.slice(0);
    setBulkImage({ running: true, done: 0, total: targets.length, skipped: 0, failed: 0 });
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < targets.length; i += 1) {
      const idx = targets[i];
      const desc = String(shotsSnapshot[idx]?.description || '').trim();
      if (!desc) {
        skipped += 1;
        setBulkImage({ running: true, done: i + 1, total: targets.length, skipped, failed });
        continue;
      }
      try {
        const prompt = buildImagePromptText(desc);
        // eslint-disable-next-line no-await-in-loop
        const raw = await runModelOnce(imageModelId, prompt);
        const inline = extractInlineImageData(raw);
        const md = inline ? null : extractMarkdownImageUrl(raw);
        const url = inline || md;
        if (!url) {
          failed += 1;
          setBulkImage({ running: true, done: i + 1, total: targets.length, skipped, failed });
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const dataUrl = await fetchUrlAsDataUrl(url);
        if (!dataUrl) {
          failed += 1;
          setBulkImage({ running: true, done: i + 1, total: targets.length, skipped, failed });
          continue;
        }
        updateShot(idx, (shot) => ({ ...shot, imageUrl: dataUrl }));
      } catch (e: any) {
        failed += 1;
        setAiError(String(e?.message || e || ''));
      } finally {
        setBulkImage({ running: true, done: i + 1, total: targets.length, skipped, failed });
      }
    }

    setBulkImage((prev) => ({ ...prev, running: false }));
  };

  const handleDownloadOutput = () => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width <= 0) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `storyboard_${Date.now()}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  const handleCopyScript = async () => {
    if (!scriptText.trim()) return;
    try {
      await navigator.clipboard.writeText(scriptText);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = scriptText;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopyHint(t('已复制', 'Copied'));
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopyHint('');
      copyTimerRef.current = null;
    }, 1500);
  };

  const ratioOptions = useMemo(
    () => ['1:1', '16:9', '9:16', '4:3', '21:9'],
    []
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="relative w-[96%] max-w-7xl h-[90vh] bg-white/90 dark:bg-gray-900/90 border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/70 dark:border-white/10">
          <div className="flex items-center gap-3 text-gray-900 dark:text-white">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <LayoutGrid size={18} />
            </div>
            <div>
              <div className="text-lg font-semibold">{t('分镜设计', 'Storyboard Design')}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('固定 9 镜头，生成拼贴与脚本', 'Fixed 9 shots, collage + script')}
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

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span>{t('图片比例', 'Aspect ratio')}:</span>
                    <select
                      value={ratio}
                      onChange={(e) => setRatio(e.target.value)}
                      className="h-9 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 px-3 text-sm text-gray-700 dark:text-gray-200 focus:outline-none"
                    >
                      {ratioOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPromptEditorOpen(true);
                      setIsVisionPickerOpen(false);
                      setIsImagePickerOpen(false);
                    }}
                    className="px-4 h-9 rounded-xl bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700"
                  >
                    {t('自定义提示词', 'Custom prompts')}
                  </button>
                  <button
                    type="button"
                    onClick={generateStoryboard}
                    disabled={isRendering}
                    className="px-4 h-9 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isRendering ? t('生成中...', 'Generating...') : t('生成分镜图与脚本', 'Generate')}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {showRelaySelect && Array.isArray(relays) && relays.length > 0 && onSelectRelay && (
                    <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 bg-white/60 dark:bg-gray-900/40 border border-gray-200/70 dark:border-white/10 shadow-sm">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-300 hidden sm:inline">
                        {t('中转站', 'Relay')}
                      </span>
                      <select
                        value={activeRelayId || ''}
                        onChange={(e) => onSelectRelay(e.target.value)}
                        className="h-8 bg-transparent text-sm font-semibold text-gray-800 dark:text-gray-100 focus:outline-none cursor-pointer min-w-[88px]"
                      >
                        <option value="" className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                          {t('默认', 'Default')}
                        </option>
                        {relays.map((site) => (
                          <option
                            key={site.id}
                            value={site.id}
                            className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                          >
                            {site.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="h-10 rounded-xl border border-gray-200/70 dark:border-white/10 text-base text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5 flex items-center gap-2 px-6 bg-white/60 dark:bg-gray-900/40 shadow-sm"
                  >
                    <Trash2 size={14} />
                    {t('清空', 'Clear')}
                  </button>
                </div>
              </div>

            <div className="ml-auto flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() => void handleBulkVision()}
                  disabled={!canRunVision}
                  className="px-4 h-9 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
                  title={t('批量识图，填充空的画面描述', 'Analyze images and fill empty descriptions')}
                >
                  {bulkVision.running
                    ? t(`识图中 ${bulkVision.done}/${bulkVision.total}`, `Analyzing ${bulkVision.done}/${bulkVision.total}`)
                    : t('一键AI识图', 'AI Vision')}
                </button>

                <button
                  type="button"
                  onClick={() => void handleBulkImage()}
                  disabled={!canRunImage}
                  className="px-4 h-9 rounded-xl bg-fuchsia-600 text-white text-sm font-semibold hover:bg-fuchsia-700 disabled:opacity-60"
                  title={t('批量生图，为空镜头生成图片', 'Generate images for empty shots')}
                >
                  {bulkImage.running
                    ? t(`生图中 ${bulkImage.done}/${bulkImage.total}`, `Generating ${bulkImage.done}/${bulkImage.total}`)
                    : t('一键AI生图', 'AI Image')}
                </button>
              </div>

              <div className="flex flex-col gap-2 min-w-[320px]">
                <div
                  className="relative h-9 px-3 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-200"
                  ref={visionPickerRef}
                >
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">{t('识图模型', 'Vision model')}:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsVisionPickerOpen((prev) => !prev);
                      setIsImagePickerOpen(false);
                    }}
                    className="flex-1 flex items-center justify-between gap-2 bg-transparent focus:outline-none cursor-pointer"
                    title={t('识图模型', 'Vision model')}
                    aria-haspopup="listbox"
                    aria-expanded={isVisionPickerOpen}
                  >
                    <span className="min-w-0 flex items-center justify-end gap-2">
                      <span className="truncate text-gray-700 dark:text-gray-200">
                        {(() => {
                          const picked = allModels.find((m) => m.id === visionModelId);
                          return picked?.name || picked?.id || visionModelId || t('未选择', 'Not selected');
                        })()}
                      </span>
                      {visionModelId ? (
                        <ProviderDot
                          provider={resolveModelProvider(allModels.find((m) => m.id === visionModelId), visionModelId)}
                        />
                      ) : null}
                    </span>
                    <ChevronDown size={14} className="text-gray-400 shrink-0" />
                  </button>

                  {isVisionPickerOpen && (
                    <div
                      className="absolute top-full left-0 mt-2 w-full rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-gray-900 shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto"
                      role="listbox"
                    >
                      {visionModelOptions.map((m) => {
                        const provider = resolveModelProvider(m, m.id);
                        const selected = m.id === visionModelId;
                        return (
                          <button
                            key={`${provider}:${m.id}`}
                            type="button"
                            onClick={() => {
                              setVisionModelId(m.id);
                              setIsVisionPickerOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                              selected
                                ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5'
                            }`}
                          >
                            <span className="truncate">{m.name || m.id}</span>
                            <ProviderDot provider={provider} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div
                  className="relative h-9 px-3 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-200"
                  ref={imagePickerRef}
                >
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">{t('生图模型', 'Image model')}:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsImagePickerOpen((prev) => !prev);
                      setIsVisionPickerOpen(false);
                    }}
                    className="flex-1 flex items-center justify-between gap-2 bg-transparent focus:outline-none cursor-pointer"
                    title={t('生图模型', 'Image model')}
                    aria-haspopup="listbox"
                    aria-expanded={isImagePickerOpen}
                  >
                    <span className="min-w-0 flex items-center justify-end gap-2">
                      <span className="truncate text-gray-700 dark:text-gray-200">
                        {(() => {
                          const picked = allModels.find((m) => m.id === imageModelId);
                          return picked?.name || picked?.id || imageModelId || t('未选择', 'Not selected');
                        })()}
                      </span>
                      {imageModelId ? (
                        <ProviderDot
                          provider={resolveModelProvider(allModels.find((m) => m.id === imageModelId), imageModelId)}
                        />
                      ) : null}
                    </span>
                    <ChevronDown size={14} className="text-gray-400 shrink-0" />
                  </button>

                  {isImagePickerOpen && (
                    <div
                      className="absolute top-full left-0 mt-2 w-full rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-gray-900 shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto"
                      role="listbox"
                    >
                      {imageModelOptions.map((m) => {
                        const provider = resolveModelProvider(m, m.id);
                        const selected = m.id === imageModelId;
                        return (
                          <button
                            key={`${provider}:${m.id}`}
                            type="button"
                            onClick={() => {
                              setImageModelId(m.id);
                              setIsImagePickerOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                              selected
                                ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5'
                            }`}
                          >
                            <span className="truncate">{m.name || m.id}</span>
                            <ProviderDot provider={provider} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {aiError && (
            <div className="rounded-xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-900/20 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
              {t('AI 请求失败：', 'AI error: ')}
              {aiError}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {shots.map((shot, idx) => (
                <div
                  key={shot.id}
                  className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-900/70 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <span>{language === 'zh' ? `镜头${NUM_TO_ZH[idx + 1]}` : `Shot ${idx + 1}`}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">#{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleClearShot(idx)}
                        className="h-7 w-7 rounded-lg border border-gray-200/70 dark:border-white/10 text-gray-500 hover:text-red-500 hover:bg-gray-100/70 dark:hover:bg-white/5"
                        title={t('清空该镜头', 'Clear this shot')}
                      >
                        <Trash2 size={12} className="mx-auto" />
                      </button>
                    </div>
                  </div>

                  <div
                    className={`relative h-28 rounded-xl border border-dashed flex items-center justify-center overflow-hidden cursor-pointer transition ${
                      dragIndex === idx
                        ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-500/10'
                        : 'border-gray-200/70 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/60'
                    }`}
                    onClick={() => fileInputRefs.current[idx]?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragIndex(idx);
                    }}
                    onDragLeave={() => setDragIndex((prev) => (prev === idx ? null : prev))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragIndex(null);
                      const file = e.dataTransfer.files?.[0];
                      void handleSelectImage(idx, file);
                    }}
                  >
                    {shot.imageUrl ? (
                      <>
                        <img src={shot.imageUrl} alt={`shot-${idx + 1}`} className="h-full w-full object-cover" />
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadImage(idx);
                            }}
                            className="h-7 w-7 rounded-full bg-white/90 text-gray-600 border border-gray-200 shadow hover:text-gray-900"
                            title={t('下载图片', 'Download image')}
                          >
                            <Download size={14} className="mx-auto" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage(idx);
                            }}
                            className="h-7 w-7 rounded-full bg-white/90 text-gray-600 border border-gray-200 shadow hover:text-red-500"
                            title={t('移除图片', 'Remove image')}
                          >
                            <Trash2 size={14} className="mx-auto" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 flex flex-col items-center gap-1">
                        <ImageIcon size={18} />
                        <span>{t('点击或拖拽上传', 'Click or drop image')}</span>
                      </div>
                    )}
                    <input
                      ref={(el) => {
                        fileInputRefs.current[idx] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        void handleSelectImage(idx, file);
                        e.currentTarget.value = '';
                      }}
                    />
                  </div>

                  <textarea
                    value={shot.description}
                    onChange={(e) => updateShot(idx, (prev) => ({ ...prev, description: e.target.value }))}
                    placeholder={t('画面描述...', 'Shot description...')}
                    className="w-full h-16 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 focus:outline-none resize-none"
                  />

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={shot.duration}
                      onChange={(e) => updateShot(idx, (prev) => ({ ...prev, duration: e.target.value }))}
                      placeholder={t('时长(秒)', 'Duration(s)')}
                      className="flex-1 h-9 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 px-3 text-xs text-gray-700 dark:text-gray-200 focus:outline-none"
                    />
                  </div>

                  <div className="border-t border-dashed border-gray-200/70 dark:border-gray-700/60 pt-2 space-y-2">
                    {shot.dialogues.length === 0 ? (
                      <div className="text-[11px] text-gray-400">{t('暂无台词', 'No dialogues')}</div>
                    ) : (
                      shot.dialogues.map((line) => (
                        <div key={line.id} className="flex items-center gap-2">
                          <select
                            value={line.roleId}
                            onChange={(e) =>
                              handleUpdateDialogue(idx, line.id, (prev) => ({
                                ...prev,
                                roleId: e.target.value,
                              }))
                            }
                            className="h-8 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 px-2 text-[11px] text-gray-600 dark:text-gray-200 focus:outline-none"
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                          <input
                            value={line.text}
                            onChange={(e) =>
                              handleUpdateDialogue(idx, line.id, (prev) => ({
                                ...prev,
                                text: e.target.value,
                              }))
                            }
                            className="flex-1 h-8 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 px-2 text-[11px] text-gray-700 dark:text-gray-200 focus:outline-none"
                            placeholder={t('台词内容', 'Dialogue')}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveDialogue(idx, line.id)}
                            className="h-8 w-8 rounded-lg border border-gray-200/70 dark:border-white/10 text-gray-500 hover:text-red-500"
                            title={t('删除', 'Delete')}
                          >
                            <X size={12} className="mx-auto" />
                          </button>
                        </div>
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() => handleAddDialogue(idx)}
                      className="w-full h-8 rounded-lg border border-gray-200/70 dark:border-white/10 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5"
                    >
                      {t('+ 台词', '+ Dialogue')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-900/70 p-4 flex flex-col gap-3 h-fit">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('角色列表', 'Roles')}</div>
                <div className="flex items-center gap-2">
                  <div className="relative" ref={roleCardPickerRef}>
                    <button
                      type="button"
                      onClick={() => setIsRoleCardPickerOpen((prev) => !prev)}
                      disabled={!roleCardsEnabled || roleCardOptions.length === 0}
                      className="h-8 px-3 rounded-lg bg-purple-500/10 text-purple-600 text-xs font-semibold hover:bg-purple-500/20 disabled:opacity-50 disabled:hover:bg-purple-500/10"
                      title={t('从角色卡导入角色', 'Import from role cards')}
                    >
                      {t('角色卡', 'Role cards')}
                    </button>
                    {isRoleCardPickerOpen && roleCardsEnabled && roleCardOptions.length > 0 && (
                      <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-gray-900 shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto">
                        {roleCardOptions.map((card) => {
                          const alias = String(card.alias || '').trim();
                          const atId = String(card.atId || '').trim().replace(/^@+/, '');
                          return (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() => handleAddRoleFromCard(card)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5 flex items-center justify-between gap-2"
                            >
                              <span className="truncate">{alias}</span>
                              <span className="text-[11px] text-gray-400 shrink-0">@{atId}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRole}
                    className="h-8 px-3 rounded-lg bg-emerald-500/10 text-emerald-600 text-xs font-semibold hover:bg-emerald-500/20 flex items-center gap-1"
                  >
                    <Plus size={12} />
                    {t('新增', 'Add')}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {roles.length === 0 && (
                  <div className="text-xs text-gray-400">{t('暂无角色，请添加', 'No roles yet')}</div>
                )}
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 px-2 py-1.5"
                  >
                    <input
                      value={role.name}
                      onChange={(e) =>
                        setRoles((prev) =>
                          prev.map((item) => (item.id === role.id ? { ...item, name: e.target.value } : item))
                        )
                      }
                      className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-200 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(role.id)}
                      className="h-7 w-7 rounded-lg border border-gray-200/70 dark:border-white/10 text-gray-500 hover:text-red-500"
                      title={t('删除', 'Delete')}
                    >
                      <Trash2 size={12} className="mx-auto" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-900/70 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('拼贴预览', 'Collage')}</div>
                <button
                  type="button"
                  onClick={handleDownloadOutput}
                  className="h-8 px-3 rounded-lg border border-gray-200/70 dark:border-white/10 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5 flex items-center gap-1"
                  disabled={!outputSize}
                >
                  <Download size={12} />
                  {t('下载拼贴', 'Download')}
                </button>
              </div>
              <div className="relative min-h-[240px] rounded-xl border border-dashed border-gray-200/70 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-center overflow-hidden">
                {!outputSize && (
                  <div className="text-xs text-gray-400">{t('尚未生成拼贴', 'No collage yet')}</div>
                )}
                <canvas
                  ref={canvasRef}
                  className={outputSize ? 'max-w-full h-auto' : 'hidden'}
                />
              </div>
              {outputSize && (
                <div className="text-[11px] text-gray-400">
                  {outputSize.w} × {outputSize.h}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-900/70 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('脚本文字', 'Script')}</div>
                <div className="flex items-center gap-2">
                  {copyHint && <span className="text-[11px] text-emerald-500">{copyHint}</span>}
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="h-8 px-3 rounded-lg border border-gray-200/70 dark:border-white/10 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5 flex items-center gap-1"
                  >
                    <Copy size={12} />
                    {t('复制', 'Copy')}
                  </button>
                </div>
              </div>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder={t('在此生成或编辑分镜脚本...', 'Write or edit script...')}
                className="flex-1 min-h-[240px] rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {isPromptEditorOpen && (
          <div className="absolute inset-0 z-[70] flex">
            <button
              type="button"
              className="flex-1 bg-black/20 hover:bg-black/30 transition-colors"
              onClick={() => setIsPromptEditorOpen(false)}
              aria-label={t('关闭', 'Close')}
            />
            <div
              role="dialog"
              aria-modal="true"
              className="w-[640px] max-w-[92vw] h-full bg-white/95 dark:bg-gray-900/95 border-l border-gray-200/70 dark:border-white/10 shadow-2xl backdrop-blur-xl flex flex-col"
            >
              <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('自定义提示词', 'Custom prompts')}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVisionPrompt(DEFAULT_VISION_PROMPT);
                      setImagePromptTemplate(DEFAULT_IMAGE_PROMPT);
                    }}
                    className="h-8 px-3 rounded-lg border border-gray-200/70 dark:border-white/10 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5"
                  >
                    {t('恢复默认', 'Reset')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPromptEditorOpen(false)}
                    className="h-8 w-8 rounded-lg border border-gray-200/70 dark:border-white/10 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5"
                    aria-label={t('关闭', 'Close')}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      {t('AI识图提示词', 'Vision prompt')}
                    </div>
                    <textarea
                      value={visionPrompt}
                      onChange={(e) => setVisionPrompt(e.target.value)}
                      placeholder={DEFAULT_VISION_PROMPT}
                      className="w-full min-h-[220px] rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      {t('AI生图提示词', 'Image prompt')}
                    </div>
                    <textarea
                      value={imagePromptTemplate}
                      onChange={(e) => setImagePromptTemplate(e.target.value)}
                      placeholder={DEFAULT_IMAGE_PROMPT}
                      className="w-full min-h-[220px] rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 focus:outline-none resize-none"
                    />
                    <div className="text-[11px] text-gray-400">
                      {t('支持 {{desc}} 替换镜头描述', 'Supports {{desc}} placeholder')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
