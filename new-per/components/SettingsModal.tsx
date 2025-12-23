import React, { useEffect, useState } from 'react';
import {
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
  Sun,
  Star,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { ApiMode, Language, Model, ModelModality, ModelProvider, ThemeMode } from '../types';
import { RelaySite, GeminiKeySite } from '../hooks/useSettings';
import { v4 as uuidv4 } from 'uuid';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
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
  historyButtonEnabled: boolean;
  setHistoryButtonEnabled: (v: boolean) => void;
  moreImagesEnabled: boolean;
  setMoreImagesEnabled: (v: boolean) => void;
  devTbd1Enabled: boolean;
  setDevTbd1Enabled: (v: boolean) => void;
  devTbd2Enabled: boolean;
  setDevTbd2Enabled: (v: boolean) => void;
  relays: RelaySite[];
  setRelays: (sites: RelaySite[]) => void;
  activeRelayId: string;
  setActiveRelayId: (id: string) => void;
  relayEnabled: boolean;
  setRelayEnabled: (v: boolean) => void;
  geminiKeys: GeminiKeySite[];
  setGeminiKeys: (sites: GeminiKeySite[]) => void;
  activeGeminiKeyId: string;
  setActiveGeminiKeyId: (id: string) => void;
  geminiKeysEnabled: boolean;
  setGeminiKeysEnabled: (v: boolean) => void;
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
  historyButtonEnabled,
  setHistoryButtonEnabled,
  moreImagesEnabled,
  setMoreImagesEnabled,
  devTbd1Enabled,
  setDevTbd1Enabled,
  devTbd2Enabled,
  setDevTbd2Enabled,
  relays,
  setRelays,
  activeRelayId,
  setActiveRelayId,
  relayEnabled,
  setRelayEnabled,
  geminiKeys,
  setGeminiKeys,
  activeGeminiKeyId,
  setActiveGeminiKeyId,
  geminiKeysEnabled,
  setGeminiKeysEnabled,
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

  const [activeTab, setActiveTab] = useState<'interface' | 'models' | 'apikey' | 'data' | 'about' | 'dev'>(
    'interface'
  );
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelVision, setNewModelVision] = useState(true);
  const [newModelProvider, setNewModelProvider] = useState<ModelProvider>('openai');
  const [newModelModality, setNewModelModality] = useState<ModelModality>('text');
  const [modelFilter, setModelFilter] = useState<'all' | 'openai' | 'gemini'>('all');
  const [starCount, setStarCount] = useState<number | null>(null);
  const [starLoading, setStarLoading] = useState(false);
  const [showRelayMenu, setShowRelayMenu] = useState(false);
  const [modelsCollapsed, setModelsCollapsed] = useState(false);
  const [modelsSearch, setModelsSearch] = useState('');
  const isOpenaiMode = apiMode === 'openai';
  const extraToggleOn = isOpenaiMode ? relayEnabled : geminiKeysEnabled;
  const extraLabel = isOpenaiMode ? t('更多中转站', 'More relays') : t('更多密钥', 'More keys');
  const extraButtonLabel = isOpenaiMode ? t('更多站点', 'More sites') : t('更多密钥', 'More keys');

  const enterpriseFeatureEnabled = Boolean(devExperimentalEnabled && devTbd1Enabled);
  const enterpriseLocationValue = (geminiEnterpriseLocation || 'us-central1').trim() || 'us-central1';
  const enterpriseFixedBaseUrl = `https://${enterpriseLocationValue}-aiplatform.googleapis.com`;
  const isEnterpriseActive = apiMode === 'gemini' && enterpriseFeatureEnabled && geminiEnterpriseEnabled;

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

  if (!isOpen) return null;

  const tabs = [
    { id: 'interface', label: t('界面', 'Interface'), icon: <Monitor size={18} /> },
    { id: 'models', label: t('模型', 'Models'), icon: <Cpu size={18} /> },
    { id: 'apikey', label: 'API Key', icon: <KeyRound size={18} /> },
    { id: 'data', label: t('数据', 'Data'), icon: <Database size={18} /> },
    { id: 'about', label: t('关于', 'About'), icon: <Info size={18} /> },
    { id: 'dev', label: t('开发者选项', 'Developer'), icon: <Settings size={18} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
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

                  <div className="flex items-center justify-between py-2 md:col-span-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-gray-700 dark:text-gray-200">{t('更多图片', 'More images')}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('（Sora2目前只支持一张图片，多张图片可能会报错）', '(Sora2 currently supports only one image; multiple images may error)')}
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
                    <button
                      onClick={() => handleDeleteModel(model.id, model.provider)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title={t('删除模型', 'Remove Model')}
                    >
                      <Trash2 size={18} />
                    </button>
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
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <span className="text-xs text-gray-600 dark:text-gray-300">{extraLabel}</span>
                      <button
                        onClick={() =>
                          isOpenaiMode ? setRelayEnabled(!relayEnabled) : setGeminiKeysEnabled(!geminiKeysEnabled)
                        }
                        className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                          extraToggleOn ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                            extraToggleOn ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {extraToggleOn && showRelayMenu && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-[520px] max-w-[92vw] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-4 space-y-3 relative">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{extraButtonLabel}</h4>
                        <button
                          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          onClick={() => setShowRelayMenu(false)}
                          aria-label={t('关闭', 'Close')}
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        {(isOpenaiMode ? relays : geminiKeys).map((site) => (
                          <div
                            key={site.id}
                            className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800 dark:text-gray-100">{site.name}</span>
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
                                      if (activeGeminiKeyId === site.id) {
                                        setActiveGeminiKeyId('');
                                      }
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
                                      if (activeGeminiKeyId === site.id && !nowEnabled) {
                                        setActiveGeminiKeyId('');
                                      }
                                      if (nowEnabled && !activeGeminiKeyId) {
                                        setActiveGeminiKeyId(site.id);
                                      }
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

                      {extraToggleOn && (
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
                <h3 className="text-lg font-semibold">{t('清空本地数据', 'Clear local data')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t(
                    '清除浏览器中保存的设置、模型列表和会话数据。这不会影响服务器内容。',
                    'Clear settings, model list, and conversations stored in this browser. Does not affect server data.'
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t('确定要清空本地数据吗？这会删除本机上的所有配置与缓存。', 'Are you sure to clear local data? This removes all local config and cache.'))) {
                      try {
                        localStorage.clear();
                      } catch (e) {
                        console.error(e);
                      }
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
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200 text-sm font-semibold">
                  v3.4-v1
                </div>
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
                      desc: t('企业级API，（未测试，等有缘人赞助GCP）', 'Enterprise API (untested; waiting for GCP sponsorship)'),
                    },
                    {
                      id: 'tbd2',
                      value: devTbd2Enabled,
                      setValue: setDevTbd2Enabled,
                      desc: t('占位开关 2（后续接入新功能）', 'Placeholder toggle 2 (for future features)'),
                    },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('还没想好', 'TBD')}</div>
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
