import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Download, Image as ImageIcon, Sparkles, Upload, X } from 'lucide-react';
import { ApiMode, Language, Model, ModelProvider } from '../../types';
import { generateResponse } from '../../services/geminiService';
import { hasModelModality } from '../../utils/modelModality';

type OutlineEntry = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  topic: string;
  imageCount: number;
  provider?: ModelProvider;
  modelId?: string;
  shots?: ShotItem[];
};

type ShotItem = {
  id: string;
  title: string;
  desc: string;
  prompt: string;
  styleIndex: number;
};

const HISTORY_KEY = 'xhs_lab_history_v1';
const MAX_IMAGES = 9;

const SHOT_STYLES = [
  { from: '#8b5cf6', via: '#ec4899', to: '#f97316' },
  { from: '#60a5fa', via: '#38bdf8', to: '#6366f1' },
  { from: '#34d399', via: '#10b981', to: '#22c55e' },
  { from: '#f59e0b', via: '#f97316', to: '#ef4444' },
  { from: '#22d3ee', via: '#06b6d4', to: '#3b82f6' },
  { from: '#a78bfa', via: '#818cf8', to: '#38bdf8' },
];

const ratioOptions = [
  { value: 'auto', label: 'Auto' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: '21:9', label: '21:9' },
];

const qualityOptions = ['1K', '2K', '4K'];

const normalizeProvider = (provider?: ModelProvider): ModelProvider =>
  provider === 'gemini' ? 'gemini' : 'openai';

const clampImageCount = (count: number) => Math.max(1, Math.min(MAX_IMAGES, count));

const getModelLabel = (model: Model) => model.name || model.id;

const buildXhsPrompt = (params: {
  topic: string;
  imageCount: number;
  ratio: string;
  quality: string;
  hasImages: boolean;
}) => {
  const { topic, imageCount, ratio, quality, hasImages } = params;
  return [
    '你是一位资深的小红书内容策划专家，擅长爆款笔记创作与视觉设计。',
    '请根据主题与参考图，输出一份完整的小红书内容方案。',
    '',
    '输出要求：',
    '- 仅返回 JSON，不能包含 Markdown 或代码块。',
    '- JSON 字段包括：title、content、shots。',
    '- shots 为数组，长度必须等于图片数量。',
    '- shots 每项包含 title、desc、prompt 字段，prompt 要写详细的画面描述（中文）。',
    '',
    `主题：${topic || '未提供主题'}`,
    `图片数量：${imageCount}`,
    `画幅：${ratio === 'auto' ? 'Auto' : ratio}`,
    `分辨率：${quality}`,
    hasImages ? '已提供参考图，请在 prompt 中体现参考图的风格特征。' : '未提供参考图。',
  ].join('\n');
};

const extractJsonText = (raw: string) => {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('未找到有效 JSON');
  }
  return cleaned.slice(firstBrace, lastBrace + 1);
};

const parseOutlinePayload = (raw: string) => {
  const jsonText = extractJsonText(raw);
  const data = JSON.parse(jsonText);
  if (!data || typeof data !== 'object') {
    throw new Error('JSON 格式错误');
  }
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const content = typeof data.content === 'string' ? data.content.trim() : '';
  const shots = Array.isArray(data.shots) ? data.shots : [];
  return { title, content, shots };
};

const normalizeShots = (shots: any[], count: number, topic: string): ShotItem[] => {
  const base = (topic || '').trim() || '灵感方案';
  const shotCount = clampImageCount(count);
  const list = Array.isArray(shots) ? shots : [];
  return Array.from({ length: shotCount }).map((_, idx) => {
    const item = list[idx] || {};
    const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : `镜头 ${idx + 1}`;
    const desc =
      typeof item.desc === 'string' && item.desc.trim()
        ? item.desc.trim()
        : typeof item.title === 'string' && item.title.trim()
        ? item.title.trim()
        : `${base.slice(0, 14)} · 视觉重点 ${idx + 1}`;
    const prompt =
      typeof item.prompt === 'string' && item.prompt.trim()
        ? item.prompt.trim()
        : typeof item.desc === 'string' && item.desc.trim()
        ? item.desc.trim()
        : title;
    return {
      id: `${Date.now()}-${idx}`,
      title,
      desc,
      prompt,
      styleIndex: Math.floor(Math.random() * SHOT_STYLES.length),
    };
  });
};

const readImageAsDataUrl = (file: File, maxSize = 1024, quality = 0.82) =>
  new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > width && height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
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

const copyText = async (text: string) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
};

const renderShotBlob = (shot: ShotItem) =>
  new Promise<Blob | null>((resolve) => {
    const canvas = document.createElement('canvas');
    const size = 1024;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }

    const style = SHOT_STYLES[shot.styleIndex % SHOT_STYLES.length];
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, style.from);
    gradient.addColorStop(0.5, style.via);
    gradient.addColorStop(1, style.to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, size - 220, size, 220);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(shot.title, 48, size - 150);
    ctx.font = '24px sans-serif';
    ctx.fillText(shot.desc, 48, size - 100);
    ctx.font = '18px sans-serif';
    ctx.fillText('XHS 灵感实验室', 48, size - 60);

    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });

interface XhsLabModalProps {
  isOpen: boolean;
  language: Language;
  apiMode: ApiMode;
  availableModels: Model[];
  openaiApiKey: string;
  openaiApiUrl: string;
  geminiApiKey: string;
  geminiApiUrl: string;
  geminiEnterpriseEnabled: boolean;
  geminiEnterpriseProjectId?: string;
  geminiEnterpriseLocation?: string;
  geminiEnterpriseToken?: string;
  geminiKeyPoolEnabled?: boolean;
  geminiKeyRotationEnabled?: boolean;
  geminiKeys?: { id: string; apiKey: string; enabled?: boolean }[];
  onClose: () => void;
}

export const XhsLabModal: React.FC<XhsLabModalProps> = ({
  isOpen,
  language,
  apiMode,
  availableModels,
  openaiApiKey,
  openaiApiUrl,
  geminiApiKey,
  geminiApiUrl,
  geminiEnterpriseEnabled,
  geminiEnterpriseProjectId,
  geminiEnterpriseLocation,
  geminiEnterpriseToken,
  geminiKeyPoolEnabled,
  geminiKeyRotationEnabled,
  geminiKeys,
  onClose,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [topic, setTopic] = useState('');
  const [imageCount, setImageCount] = useState(4);
  const [outline, setOutline] = useState<OutlineEntry | null>(null);
  const [shots, setShots] = useState<ShotItem[]>([]);
  const [history, setHistory] = useState<OutlineEntry[]>([]);
  const [ratio, setRatio] = useState('auto');
  const [quality, setQuality] = useState('2K');
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<ModelProvider>(normalizeProvider(apiMode === 'gemini' ? 'gemini' : 'openai'));
  const [selectedModelId, setSelectedModelId] = useState('');
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [refImages, setRefImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  const providerModels = useMemo(() => {
    const normalizedProvider = normalizeProvider(provider);
    const all = availableModels.filter((model) => normalizeProvider(model.provider) === normalizedProvider);
    const textPreferred = all.filter((model) => hasModelModality(model, 'text'));
    if (textPreferred.length > 0) return textPreferred;
    const nonVideo = all.filter((model) => !hasModelModality(model, 'video'));
    return nonVideo.length > 0 ? nonVideo : all;
  }, [availableModels, provider]);

  const selectedModel = useMemo(
    () => providerModels.find((model) => model.id === selectedModelId),
    [providerModels, selectedModelId]
  );

  const resolveGeminiApiKey = useMemo(() => {
    const enabledKeys = Array.isArray(geminiKeys)
      ? geminiKeys.filter((k) => k.enabled && (k.apiKey || '').trim()).map((k) => (k.apiKey || '').trim())
      : [];
    const pool = geminiKeyPoolEnabled ? enabledKeys : [];
    return () => {
      if (pool.length === 0) return (geminiApiKey || '').trim();
      if (!geminiKeyRotationEnabled || pool.length === 1) return pool[0];
      return pool[Math.floor(Math.random() * pool.length)];
    };
  }, [geminiApiKey, geminiKeyPoolEnabled, geminiKeyRotationEnabled, geminiKeys]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const defaultProvider = normalizeProvider(apiMode === 'gemini' ? 'gemini' : 'openai');
      setProvider(defaultProvider);
    }
    wasOpenRef.current = isOpen;
  }, [apiMode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (providerModels.length === 0) {
      setSelectedModelId('');
      return;
    }
    if (!selectedModelId || !providerModels.some((model) => model.id === selectedModelId)) {
      setSelectedModelId(providerModels[0].id);
    }
  }, [providerModels, selectedModelId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch {
        // ignore
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
    } catch {
      // ignore
    }
  }, [history, isOpen]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const candidates = Array.from(files).filter((file) => file.type.startsWith('image/')).slice(0, MAX_IMAGES);
    const encoded = await Promise.all(candidates.map((file) => readImageAsDataUrl(file)));
    const next = encoded.filter((item): item is string => Boolean(item));
    setRefImages(next);
  };

  const handleGenerateOutline = async () => {
    const trimmed = topic.trim();
    const count = clampImageCount(imageCount);
    if (count !== imageCount) {
      setImageCount(count);
    }
    if (!trimmed && refImages.length === 0) {
      setError(language === 'zh' ? '请输入灵感描述或上传参考图。' : 'Enter a topic or upload images.');
      return;
    }
    if (!selectedModelId) {
      setError(language === 'zh' ? '请先选择模型。' : 'Please select a model.');
      return;
    }
    if (selectedModel && !hasModelModality(selectedModel, 'text')) {
      setError(language === 'zh' ? '请选择文本模型。' : 'Please choose a text model.');
      return;
    }
    setError('');
    setIsGeneratingOutline(true);

    const prompt = buildXhsPrompt({
      topic: trimmed,
      imageCount: count,
      ratio,
      quality,
      hasImages: refImages.length > 0,
    });

    const supportsVision = Boolean(selectedModel?.vision);
    const inputImages = supportsVision ? refImages : [];
    const activeProvider = normalizeProvider(provider);
    const apiKey = activeProvider === 'gemini' ? resolveGeminiApiKey() : (openaiApiKey || '').trim();
    const apiUrl = activeProvider === 'gemini' ? geminiApiUrl : openaiApiUrl;
    let responseText = '';

    try {
      await generateResponse(
        selectedModelId,
        [],
        prompt,
        (chunk) => {
          responseText += chunk;
        },
        apiKey,
        false,
        inputImages,
        apiUrl,
        activeProvider,
        undefined,
        activeProvider === 'gemini'
          ? {
              geminiEnterpriseEnabled,
              geminiEnterpriseProjectId,
              geminiEnterpriseLocation,
              geminiEnterpriseToken,
            }
          : undefined
      );

      const parsed = parseOutlinePayload(responseText);
      const title =
        parsed.title || (trimmed ? `XHS 灵感方案 · ${trimmed.slice(0, 18)}` : 'XHS 灵感方案');
      const content = parsed.content || '';
      const normalizedShots = normalizeShots(parsed.shots, count, trimmed);
      const entry: OutlineEntry = {
        id: String(Date.now()),
        title,
        content,
        createdAt: new Date().toLocaleString(),
        topic: trimmed,
        imageCount: count,
        provider: activeProvider,
        modelId: selectedModelId,
        shots: normalizedShots,
      };
      setOutline(entry);
      setShots(normalizedShots);
      setHistory((prev) => [entry, ...prev.filter((item) => item.id !== entry.id)]);
    } catch (err: any) {
      const message = err?.message ? String(err.message) : String(err);
      setError(language === 'zh' ? `生成失败：${message}` : `Generation failed: ${message}`);
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleBatchGenerate = () => {
    if (!outline?.shots || outline.shots.length === 0) {
      setError(language === 'zh' ? '请先生成方案。' : 'Generate the outline first.');
      return;
    }
    setError('');
    setShots(
      outline.shots.map((shot) => ({
        ...shot,
        styleIndex: Math.floor(Math.random() * SHOT_STYLES.length),
      }))
    );
  };

  const handleSelectHistory = (entry: OutlineEntry) => {
    setTopic(entry.topic);
    setImageCount(entry.imageCount);
    if (entry.provider) setProvider(entry.provider);
    if (entry.modelId) setSelectedModelId(entry.modelId);
    setOutline(entry);
    setShots(entry.shots || []);
    setError('');
  };

  const handleDownloadShot = async (shot: ShotItem) => {
    const blob = await renderShotBlob(shot);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `xhs_${shot.id}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const shotCards = useMemo(
    () =>
      shots.map((shot, idx) => {
        const styleIndex = Number.isFinite(shot.styleIndex) ? shot.styleIndex : idx;
        const style = SHOT_STYLES[Math.abs(styleIndex) % SHOT_STYLES.length];
        return {
          ...shot,
          prompt: shot.prompt || shot.desc || shot.title,
          style: {
            background: `linear-gradient(135deg, ${style.from}, ${style.via}, ${style.to})`,
          },
        };
      }),
    [shots]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="w-[96%] max-w-6xl h-[88vh] bg-white/90 dark:bg-gray-900/90 border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 h-14 border-b border-gray-200/70 dark:border-white/10">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="h-9 w-9 rounded-xl border border-gray-200/70 dark:border-white/10 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/5"
            aria-label={language === 'zh' ? '切换侧栏' : 'Toggle sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <div className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold">
            <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <span>{language === 'zh' ? 'XHS 灵感实验室' : 'XHS Lab'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl border border-gray-200/70 dark:border-white/10 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/5"
            aria-label={language === 'zh' ? '关闭' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <aside
            className={`md:w-72 border-r border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-900/70 transition-all duration-300 ${
              sidebarCollapsed ? 'md:-ml-72' : ''
            }`}
          >
            <div className="h-full overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <span>{language === 'zh' ? '历史记录' : 'History'}</span>
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="text-red-500 hover:text-red-600"
                >
                  {language === 'zh' ? '清空' : 'Clear'}
                </button>
              </div>

              <div className="space-y-2">
                {history.length === 0 && (
                  <div className="text-xs text-gray-400 text-center py-6">
                    {language === 'zh' ? '暂无记录' : 'No history yet'}
                  </div>
                )}
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectHistory(item)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs ${
                      outline?.id === item.id
                        ? 'border-rose-500 text-rose-500 bg-rose-50/60 dark:bg-rose-500/10'
                        : 'border-transparent hover:border-gray-200 dark:hover:border-white/10 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <div className="font-semibold truncate">{item.title}</div>
                    <div className="text-[10px] text-gray-400 mt-1">{item.createdAt}</div>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="flex-1 min-w-0 border-r border-gray-200/70 dark:border-white/10 flex flex-col">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-900/70 p-4 space-y-4">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {language === 'zh' ? '灵感输入' : 'Idea Input'}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setProvider('openai')}
                      className={`px-3 h-8 text-xs font-semibold ${
                        provider === 'openai'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5'
                      }`}
                    >
                      OpenAI
                    </button>
                    <button
                      type="button"
                      onClick={() => setProvider('gemini')}
                      className={`px-3 h-8 text-xs font-semibold ${
                        provider === 'gemini'
                          ? 'bg-amber-500 text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5'
                      }`}
                    >
                      Gemini
                    </button>
                  </div>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="min-w-[180px] h-8 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 px-3 text-xs text-gray-700 dark:text-gray-200"
                    disabled={providerModels.length === 0}
                  >
                    {providerModels.length === 0 && (
                      <option value="">{language === 'zh' ? '暂无可用模型' : 'No models'}</option>
                    )}
                    {providerModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {getModelLabel(model)}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={language === 'zh' ? '输入你的想法，例如：复古风格城市漫游文案' : 'Describe your idea'}
                  className="w-full min-h-[120px] resize-none rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-800/60 p-3 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 h-9 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/5 inline-flex items-center gap-2"
                    >
                      <Upload size={14} />
                      {language === 'zh' ? '上传参考图' : 'Upload'}
                    </button>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {language === 'zh' ? '图片数量' : 'Images'}:{' '}
                      <input
                        type="number"
                        min={1}
                        max={MAX_IMAGES}
                        value={imageCount}
                        onChange={(e) => {
                          const value = Number.parseInt(e.target.value, 10);
                          if (Number.isNaN(value)) return;
                          setImageCount(clampImageCount(value));
                        }}
                        className="ml-2 w-12 rounded-lg border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 text-center text-xs text-gray-700 dark:text-gray-200"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateOutline}
                    disabled={isGeneratingOutline}
                    className={`px-4 h-9 rounded-xl text-sm font-semibold ${
                      isGeneratingOutline
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-white/10 dark:text-gray-500'
                        : 'bg-rose-500 text-white hover:bg-rose-600'
                    }`}
                  >
                    {isGeneratingOutline ? (language === 'zh' ? '生成中...' : 'Generating...') : language === 'zh' ? '生成方案' : 'Generate'}
                  </button>
                </div>

                {error && <div className="text-xs text-red-500">{error}</div>}
                {refImages.length > 0 && selectedModel && !selectedModel.vision && (
                  <div className="text-xs text-amber-500">
                    {language === 'zh'
                      ? '当前模型不支持图片输入，参考图将被忽略。'
                      : 'Selected model does not support images; references will be ignored.'}
                  </div>
                )}

                {refImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {refImages.map((url, idx) => (
                      <div key={url} className="relative h-16 w-16 rounded-lg overflow-hidden">
                        <img src={url} alt={`preview-${idx}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setRefImages(refImages.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-900/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {language === 'zh' ? '文案预览' : 'Outline Preview'}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(outline?.title || '')}
                      className="h-8 px-3 rounded-lg border border-gray-200/70 dark:border-white/10 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5 inline-flex items-center gap-1"
                    >
                      <Copy size={12} />
                      {language === 'zh' ? '复制标题' : 'Title'}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText(outline?.content || '')}
                      className="h-8 px-3 rounded-lg border border-gray-200/70 dark:border-white/10 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5 inline-flex items-center gap-1"
                    >
                      <Copy size={12} />
                      {language === 'zh' ? '复制正文' : 'Content'}
                    </button>
                  </div>
                </div>
                {outline ? (
                  <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    <div className="font-semibold text-gray-900 dark:text-white mb-2">{outline.title}</div>
                    {outline.content}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    {language === 'zh' ? '输入灵感后生成方案。' : 'Generate an outline from your idea.'}
                  </div>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.currentTarget.value = '';
              }}
            />
          </section>

          <section className="w-full md:w-[38%] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-900/70">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                  className="h-9 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 text-xs text-gray-700 dark:text-gray-200 px-3"
                >
                  {ratioOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="h-9 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-gray-800/60 text-xs text-gray-700 dark:text-gray-200 px-3"
                >
                  {qualityOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleBatchGenerate}
                  disabled={!outline?.shots || outline.shots.length === 0}
                  className={`h-9 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-2 ${
                    !outline?.shots || outline.shots.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-white/10 dark:text-gray-500'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <ImageIcon size={14} />
                  {language === 'zh' ? '批量生成' : 'Generate'}
                </button>
              </div>
              <div className="mt-2 text-[11px] text-gray-400">
                {language === 'zh'
                  ? `画幅 ${ratio.toUpperCase()} · 分辨率 ${quality}`
                  : `Ratio ${ratio.toUpperCase()} · ${quality}`}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {shotCards.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  {language === 'zh' ? '等待生成图像卡片' : 'No shots yet'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {shotCards.map((shot) => (
                    <div
                      key={shot.id}
                      className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-gray-900/70 overflow-hidden"
                    >
                      <div className="h-28" style={shot.style} />
                      <div className="p-3 space-y-2">
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{shot.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{shot.desc}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-3 whitespace-pre-wrap">
                          {shot.prompt}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyText(shot.prompt)}
                            className="flex-1 h-8 rounded-lg border border-gray-200/70 dark:border-white/10 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5 inline-flex items-center justify-center gap-1"
                          >
                            <Copy size={12} />
                            {language === 'zh' ? '复制' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadShot(shot)}
                            className="flex-1 h-8 rounded-lg border border-gray-200/70 dark:border-white/10 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5 inline-flex items-center justify-center gap-1"
                          >
                            <Download size={12} />
                            {language === 'zh' ? '下载' : 'Download'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setShots((prev) =>
                                prev.map((item) =>
                                  item.id === shot.id
                                    ? { ...item, styleIndex: Math.floor(Math.random() * SHOT_STYLES.length) }
                                    : item
                                )
                              )
                            }
                            className="flex-1 h-8 rounded-lg border border-gray-200/70 dark:border-white/10 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-100/70 dark:hover:bg-white/5 inline-flex items-center justify-center"
                          >
                            {language === 'zh' ? '重绘' : 'Refresh'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
