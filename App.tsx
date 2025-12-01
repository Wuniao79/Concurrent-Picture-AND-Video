import React, { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  Plus, Settings, Search, 
  PanelLeftClose, PanelLeft, Menu, KeyRound, Lock, ArrowUp,
  Mic, X, Monitor, Moon, Sun, Globe,
  Database, Info, Cpu, Trash2,
  Eye, Check, Link as LinkIcon
} from 'lucide-react';
import { LaneState, Role, AVAILABLE_MODELS, Model, ApiMode, ModelProvider } from './types';
import { ChatColumn } from './components/ChatColumn';
import { ChatGridItem } from './components/ChatGridItem';
import { ChatInput } from './components/ChatInput';
import { generateResponse } from './services/geminiService';

// --- Types ---
type ThemeMode = 'system' | 'light' | 'dark';
type Language = 'system' | 'en' | 'zh';

// --- Settings Modal Component ---
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
  availableModels: Model[];
  setAvailableModels: (models: Model[]) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, onClose, 
  theme, setTheme,
  language, setLanguage,
  fontSize, setFontSize,
  isStreamEnabled, setIsStreamEnabled,
  apiMode, setApiMode,
  openaiApiKey, setOpenaiApiKey,
  geminiApiKey, setGeminiApiKey,
  openaiApiUrl, setOpenaiApiUrl,
  geminiApiUrl, setGeminiApiUrl,
  availableModels, setAvailableModels
}) => {
  const [activeTab, setActiveTab] = useState('interface');
  
  // New Model Form State
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelVision, setNewModelVision] = useState(true);
  const [newModelProvider, setNewModelProvider] = useState<ModelProvider>('openai');

  const handleAddModel = () => {
    if (!newModelId || !newModelName) return;
    const newModel: Model = {
      id: newModelId,
      name: newModelName,
      vision: newModelVision,
      provider: newModelProvider,
    };
    setAvailableModels([...availableModels, newModel]);
    setNewModelId('');
    setNewModelName('');
    setNewModelVision(true);
    setNewModelProvider('openai');
  };

  const handleDeleteModel = (id: string) => {
    if (availableModels.length <= 1) return;
    setAvailableModels(availableModels.filter(m => m.id !== id));
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'interface', label: '界面', icon: <Monitor size={18} /> },
    { id: 'models', label: '模型', icon: <Cpu size={18} /> },
    { id: 'apikey', label: 'API 密钥', icon: <KeyRound size={18} /> },
    { id: 'data', label: '数据', icon: <Database size={18} /> },
    { id: 'about', label: '关于', icon: <Info size={18} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 w-[90%] max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Sidebar */}
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
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 p-10 text-gray-900 dark:text-gray-100">
          {activeTab === 'interface' && (
            <div className="space-y-10 max-w-3xl">
              <h2 className="text-3xl font-bold mb-6">界面</h2>
              
              {/* Theme & Language Group */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">主题</label>
                  <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    {[
                      { mode: 'system', label: '系统', icon: Monitor },
                      { mode: 'dark', label: '暗色', icon: Moon },
                      { mode: 'light', label: '浅色', icon: Sun }
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
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">语言</label>
                  <div className="relative">
                    <select 
                      value={language} 
                      onChange={(e) => setLanguage(e.target.value as Language)}
                      className="w-full appearance-none px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700"
                    >
                      <option value="system" className="bg-white dark:bg-gray-800">System Default</option>
                      <option value="en" className="bg-white dark:bg-gray-800">English</option>
                      <option value="zh" className="bg-white dark:bg-gray-800">中文 (Chinese)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <Globe size={14} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />

              {/* Font Size */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                    <span className="text-lg">T</span> 基础字号
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

              {/* Divider */}
              <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />

              {/* Toggles */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Interface Options
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-200">
                        流式 (Streaming)
                      </span>
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
                </div>
              </div>

            </div>
          )}

          {activeTab === 'models' && (
            <div className="space-y-10 max-w-3xl">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">模型</h2>
                <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                  {availableModels.length} Installed
                </span>
              </div>

              {/* Model List */}
              <div className="space-y-3">
                {availableModels.map(model => (
                  <div
                    key={model.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {model.name}
                        </span>
                        {model.vision && (
                          <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded uppercase tracking-wide flex items-center gap-1">
                            <Eye size={10} /> Vision
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">
                        {model.id}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleDeleteModel(model.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove Model"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Add Model Form */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                  Add Custom Model
                </h3>
                <div className="grid grid-cols-1 gap-4 p-5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Model Name
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
                        Model ID
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
                        Support Vision (Visual) <Eye size={14} className="text-gray-400" />
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3 py-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Provider</span>
                    <div className="inline-flex rounded-full bg-gray-800 p-1">
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs rounded-full ${newModelProvider === 'openai' ? 'bg-blue-500 text-white' : 'text-gray-300'}`}
                        onClick={() => setNewModelProvider('openai')}
                      >
                        OpenAI
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1 text-xs rounded-full ${newModelProvider === 'gemini' ? 'bg-yellow-400 text-black' : 'text-gray-300'}`}
                        onClick={() => setNewModelProvider('gemini')}
                      >
                        Gemini
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={handleAddModel}
                    disabled={!newModelId || !newModelName}
                    className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Add Model
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'apikey' && (
            <div className="space-y-10 max-w-3xl">
              <h2 className="text-3xl font-bold mb-6">API 密钥</h2>
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Enter your Google GenAI API Key here. It will override the default environment key.
                  This key is stored in memory and is not persisted for security.
                </p>
                
                {/* API Key Input */}
                <div className="relative w-full max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound size={16} className="text-gray-400" />
                  </div>
                  <input 
                    type="password" 
                    value={apiMode === 'openai' ? openaiApiKey : geminiApiKey}
                    onChange={(e) => apiMode === 'openai' ? setOpenaiApiKey(e.target.value) : setGeminiApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="block w-full pl-10 pr-10 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-800 focus:border-blue-500 rounded-lg text-sm font-mono text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Lock size={14} className={(apiMode === 'openai' ? openaiApiKey : geminiApiKey) ? "text-green-500" : "text-gray-300"} />
                  </div>
                </div>
                {(apiMode === 'openai' ? openaiApiKey : geminiApiKey) && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Lock size={12} /> Custom key active
                  </p>
                )}

                {/* API Base URL Input */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      API 地址 (Base URL)
                    </h3>
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
                        onClick={() => {
                          setApiMode('gemini');
                          // 切换到 Gemini 时不强制清空，保留用户可能输入的自定义 URL
                        }}
                        className={`ml-1 px-3 py-1 rounded-full transition-all ${
                          apiMode === 'gemini'
                            ? 'bg-yellow-400 text-gray-900 shadow-sm'
                            : 'text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        Gemini
                      </button>
                    </div>
                  </div>
                  <div className="relative w-full max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LinkIcon size={16} className="text-gray-400" />
                    </div>
                    <input 
                      type="text" 
                      value={apiMode === 'openai' ? openaiApiUrl : geminiApiUrl}
                      onChange={(e) => apiMode === 'openai' ? setOpenaiApiUrl(e.target.value) : setGeminiApiUrl(e.target.value)}
                      placeholder={apiMode === 'openai' ? '' : ''}
                      className="block w-full pl-10 pr-10 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-900 focus:border-blue-500 rounded-lg text-sm font-mono text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  {apiMode === 'gemini' ? (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      不输入链接默认为 https://generativelanguage.googleapis.com
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      OpenAI 兼容模式：请填写你的代理 / OneAPI 等兼容接口地址，留空则使用后端默认配置（如有）。
                    </p>
                  )}
                </div>
              </div>

          {activeTab === 'data' && (
            <div className="space-y-10 max-w-3xl">
              <h2 className="text-3xl font-bold mb-6">数据</h2>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">清空本地数据</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  清除本浏览器中保存的所有设置、模型列表和会话数据。这不会影响服务器上的任何内容。
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('确定要清空本地数据吗？这会删除本机上的所有配置与缓存。')) {
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
                  清空 LocalStorage
                </button>
              </div>
            </div>
          )}

            </div>
          )}

          {activeTab !== 'interface' && activeTab !== 'apikey' && activeTab !== 'models' && activeTab !== 'data' && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Settings size={48} className="mx-auto mb-4 opacity-20" />
                <p>Settings for {activeTab} are coming soon.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // 默认从环境变量里读取 Base URL 和 API Key，用作初始值（可以在设置里覆盖）
  const defaultApiKey = '';
  const defaultApiUrl = '';

  // --- State ---

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
const safeStorageGet = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

// Settings State
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = safeStorageGet('sora_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored as ThemeMode;
    return 'system';
  });
  const [language, setLanguage] = useState<Language>(() => {
    const stored = safeStorageGet('sora_language');
    if (stored === 'zh' || stored === 'en') return stored as Language;
    return 'zh';
  });
  const [fontSize, setFontSize] = useState(() => {
    const stored = safeStorageGet('sora_fontSize');
    const n = stored ? parseInt(stored, 10) : NaN;
    return !isNaN(n) && n >= 10 && n <= 24 ? n : 15;
  });
  const [isStreamEnabled, setIsStreamEnabled] = useState(() => {
    const stored = safeStorageGet('sora_stream');
    if (stored === '0') return false;
    if (stored === '1') return true;
    return true;
  });

  const [apiMode, setApiMode] = useState<ApiMode>(() => {
    const stored = safeStorageGet('sora_apiMode');
    return stored === 'gemini' ? 'gemini' : 'openai';
  });

  const [openaiApiKey, setOpenaiApiKey] = useState(() => {
    const stored = safeStorageGet('sora_openai_apiKey');
    return stored ?? defaultApiKey;
  });
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    const stored = safeStorageGet('sora_gemini_apiKey');
    return stored ?? '';
  });

  const [openaiApiUrl, setOpenaiApiUrl] = useState(() => {
    const stored = safeStorageGet('sora_openai_apiUrl');
    return stored ?? '';
  });
  const [geminiApiUrl, setGeminiApiUrl] = useState(() => {
    const stored = safeStorageGet('sora_gemini_apiUrl');
    return stored ?? '';
  });
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Model State
  const [availableModels, setAvailableModels] = useState<Model[]>(() => {
    const stored = safeStorageGet('sora_models');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed as Model[];
        }
      } catch {
        // ignore
      }
    }
    return AVAILABLE_MODELS;
  });
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    const stored = safeStorageGet('sora_selectedModelId');
    return stored || 'sora-video-10s';
  });

  // Active Lane State for Grid Mode
  const [activeLaneId, setActiveLaneId] = useState<string | null>(null);

  const [lanes, setLanes] = useState<LaneState[]>([
    {
      id: uuidv4(),
      model: selectedModelId,
      temperature: 0.7,
      name: 'Model 1',
      messages: [],
      isThinking: false,
      progress: 0
    },
    {
      id: uuidv4(),
      model: selectedModelId,
      temperature: 0.7,
      name: 'Model 2',
      messages: [],
      isThinking: false,
      progress: 0
    }
  ]);

  const [laneCountInput, setLaneCountInput] = useState<string>('2');

  useEffect(() => {
    setLaneCountInput(String(lanes.length));
  }, [lanes.length]);

  // --- Effects ---
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    } else {
      root.classList.add(theme);
    }

}, [theme]);

// Persist settings to localStorage
useEffect(() => {
  safeStorageSet('sora_theme', theme);
}, [theme]);

useEffect(() => {
  safeStorageSet('sora_language', language);
}, [language]);

useEffect(() => {
  safeStorageSet('sora_fontSize', String(fontSize));
}, [fontSize]);

useEffect(() => {
  safeStorageSet('sora_stream', isStreamEnabled ? '1' : '0');
}, [isStreamEnabled]);

useEffect(() => {
  safeStorageSet('sora_apiMode', apiMode);
}, [apiMode]);

useEffect(() => {
  safeStorageSet('sora_openai_apiKey', openaiApiKey ?? '');
}, [openaiApiKey]);

useEffect(() => {
  safeStorageSet('sora_gemini_apiKey', geminiApiKey ?? '');
}, [geminiApiKey]);

useEffect(() => {
  safeStorageSet('sora_openai_apiUrl', openaiApiUrl ?? '');
}, [openaiApiUrl]);

useEffect(() => {
  safeStorageSet('sora_gemini_apiUrl', geminiApiUrl ?? '');
}, [geminiApiUrl]);

useEffect(() => {
  if (selectedModelId) {
    safeStorageSet('sora_selectedModelId', selectedModelId);
  }
}, [selectedModelId]);

useEffect(() => {
  try {
    safeStorageSet('sora_models', JSON.stringify(availableModels));
  } catch {
    // ignore
  }
}, [availableModels]);

  // Automatically set active lane when entering grid mode
  useEffect(() => {
    if (lanes.length > 3 && !activeLaneId) {
      setActiveLaneId(lanes[0].id);
      setIsSidebarOpen(true);
    }
  }, [lanes.length, activeLaneId, lanes]);

  // --- Actions ---

  const updateLaneCount = (value: string) => {
    const numeric = value.replace(/[^0-9]/g, '');
    // 允许用户暂时清空输入框
    if (numeric === '') {
      setLaneCountInput('');
      return;
    }

    let count = parseInt(numeric, 10);
    if (isNaN(count)) {
      return;
    }

    if (count < 1) count = 1;
    if (count > 20) count = 20;

    setLaneCountInput(String(count));

    setLanes(prev => {
      if (count > prev.length) {
        const toAdd = count - prev.length;
        const newLanes: LaneState[] = [];
        for (let i = 0; i < toAdd; i++) {
          newLanes.push({
            id: uuidv4(),
            model: selectedModelId,
            temperature: 0.7,
            name: `Model ${prev.length + i + 1}`,
            messages: hasStartedChat && prev[0] ? [...prev[0].messages] : [],
            isThinking: false,
            progress: 0
          });
        }
        return [...prev, ...newLanes];
      } else if (count < prev.length) {
        const newLanes = prev.slice(0, count);
        if (activeLaneId && !newLanes.find(l => l.id === activeLaneId)) {
          setActiveLaneId(newLanes.length > 0 ? newLanes[0].id : null);
        }
        return newLanes;
      }
      return prev;
    });
  };

  const setAllModels = (modelId: string) => {
    setSelectedModelId(modelId);
    setLanes(prev =>
      prev.map((lane) => {
        if (lane.isThinking || lane.messages.length > 0) {
          return lane;
        }
        return { ...lane, model: modelId };
      })
    );
  };

  const removeLane = (id: string) => {
    if (lanes.length <= 1) return;
    const newLanes = lanes.filter(l => l.id !== id);
    setLanes(newLanes);
    if (activeLaneId === id) {
      setActiveLaneId(newLanes.length > 0 ? newLanes[0].id : null);
    }
  };

  const updateModel = (id: string, model: string) => {
    setLanes(prev =>
      prev.map(l => (l.id === id ? { ...l, model } : l))
    );
  };

  const startNewChat = () => {
    setHasStartedChat(false);
    setActiveLaneId(null);
    setLanes([
      {
        id: uuidv4(),
        model: selectedModelId,
        temperature: 0.7,
        name: 'Model 1',
        messages: [],
        isThinking: false,
        progress: 0
      },
      {
        id: uuidv4(),
        model: selectedModelId,
        temperature: 0.7,
        name: 'Model 2',
        messages: [],
        isThinking: false,
        progress: 0
      }
    ]);
  };

  const clearAllChats = () => {
    setHasStartedChat(false);
    setLanes(prev => prev.map(lane => ({
      ...lane,
      messages: [],
      isThinking: false,
      error: undefined
    })));
  };

  const confirmAndClearChats = () => {
    setShowClearConfirm(true);
  };

  // --- Messaging Logic ---


  // 从 Sora 推理日志中提取进度百分比（取最后一次出现的 0-100%）
  const extractProgressFromText = (text: string): number | null => {
    if (!text) return null;

    let maxPercent: number | null = null;
    const percentRegex = /(\d{1,3})\s*%/g;
    let match: RegExpExecArray | null;

    while ((match = percentRegex.exec(text)) !== null) {
      const value = parseInt(match[1], 10);
      if (isNaN(value)) continue;
      if (value < 0 || value > 100) continue;
      if (maxPercent === null || value > maxPercent) {
        maxPercent = value;
      }
    }

    if (maxPercent !== null) {
      return Math.min(100, Math.max(0, maxPercent));
    }

    // 没有明确的百分比，但出现了“Completed”之类的字样，则认为是 100%
    if (/Video Generation Completed|Generation Completed/i.test(text)) {
      return 100;
    }

    return null;
  };

  const handleSend = useCallback(async (text: string, image: string | null) => {
    if (!text.trim() && !image) return;
    
    setHasStartedChat(true);
    const userMessageId = uuidv4();
    const timestamp = Date.now();
    
    setLanes(prev => prev.map(lane => ({
      ...lane,
      messages: [
        ...lane.messages,
        { 
          id: userMessageId, 
          role: Role.USER, 
          text: text, 
          timestamp,
          image: image || undefined
        }
      ],
      isThinking: true,
      progress: 0,
      error: undefined
    })));

    const promises = lanes.map(async (lane) => {
      const laneId = lane.id;
      let botMessageText = '';
      const botMessageId = uuidv4();
      const laneStartTime = Date.now();
      let isFirstChunk = true;

      setLanes(prev => prev.map(l => {
        if (l.id !== laneId) return l;
        return {
          ...l,
          messages: [
            ...l.messages,
            { id: botMessageId, role: Role.MODEL, text: '', timestamp: Date.now() }
          ]
        };
      }));

      try {
        const activeModel = availableModels.find(m => m.id === lane.model);
        const modelProvider: ModelProvider = activeModel?.provider || apiMode || 'openai';
        const activeApiKey = modelProvider === 'gemini' ? geminiApiKey : openaiApiKey;
        const activeApiBaseUrl = modelProvider === 'gemini'
          ? ((geminiApiUrl && geminiApiUrl.trim()) || 'https://generativelanguage.googleapis.com')
          : openaiApiUrl;

        await generateResponse(
          lane.model,
          lane.messages,
          text,
          (chunk) => {
            if (isStreamEnabled) {
              botMessageText += chunk;
            } else {
              botMessageText = chunk;
            }

            setLanes(prev => prev.map(l => {
              if (l.id !== laneId) return l;

              let updatedIsThinking = l.isThinking;
              if (isFirstChunk && isStreamEnabled) {
                updatedIsThinking = false;
                isFirstChunk = false;
              }

              const msgs = [...l.messages];
              const lastMsgIndex = msgs.findIndex(m => m.id === botMessageId);
              if (lastMsgIndex !== -1) {
                msgs[lastMsgIndex] = { ...msgs[lastMsgIndex], text: botMessageText };
              }

              const progress = extractProgressFromText(botMessageText);

              return { 
                ...l, 
                messages: msgs, 
                isThinking: updatedIsThinking,
                progress: progress !== null ? progress : l.progress
              };
            }));
          },
          activeApiKey,
          isStreamEnabled,
          image || undefined,
          activeApiBaseUrl
        );
      } catch (err: any) {
        setLanes(prev => prev.map(l => l.id === laneId ? { ...l, error: err.message } : l));
      } finally {
        const finishedAt = Date.now();
        const duration = finishedAt - laneStartTime;

        setLanes(prev => prev.map(l => {
          if (l.id !== laneId) return l;

          const msgs = [...l.messages];
          const idx = msgs.findIndex(m => m.id === botMessageId);
          if (idx !== -1) {
            msgs[idx] = { ...msgs[idx], generationDurationMs: duration };
          }

          return { ...l, isThinking: false, progress: 100, messages: msgs };
        }));
      }
    });

    await Promise.all(promises);

  }, [lanes, openaiApiKey, geminiApiKey, isStreamEnabled, openaiApiUrl, geminiApiUrl]);

  // --- Components ---

  const Sidebar = () => {
    const isGridMode = lanes.length > 3;
    const activeLane = lanes.find(l => l.id === activeLaneId);

    return (
      <div
        className={`
          fixed inset-y-0 left-0 z-30 
          ${isGridMode ? 'w-[340px]' : 'w-[260px]'} 
          bg-[#f9fafb] dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 
          transform transition-all duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col
        `}
      >
        {/* Sidebar Header */}
        <div className="p-3 flex items-center justify-between shrink-0 h-16">
          {!isGridMode ? (
            <>
              <button 
                onClick={startNewChat}
                className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 transition-all text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm group"
              >
                <Plus
                  size={16}
                  className="text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
                />
                <span>{language === 'zh' ? '发起新对话' : 'New Chat'}</span>
              </button>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <PanelLeftClose size={20} />
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full px-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <div
                  className={`w-2 h-2 rounded-full ${
                    activeLane?.isThinking ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'
                  }`}
                />
                <div className="font-medium text-sm truncate text-gray-700 dark:text-gray-200 max-w-[200px]">
                  {activeLane ? activeLane.name : 'Select a Model'}
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <PanelLeftClose size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Content */}
        {isGridMode && activeLane ? (
          <div className="flex-1 overflow-hidden relative flex flex-col">
            <ChatColumn 
              lane={activeLane} 
              onRemove={removeLane} 
              onModelChange={updateModel}
              isMultiLane={false} 
              fontSize={fontSize - 1}
              availableModels={availableModels}
            />
          </div>
        ) : !isGridMode ? (
          <>
            <div className="px-3 mb-2">
              <div className="relative group">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-gray-600 transition-colors"
                />
                <input 
                  type="text" 
                  placeholder={language === 'zh' ? '搜索' : 'Search'}
                  className="w-full pl-9 pr-3 py-2 bg-transparent hover:bg-gray-200/50 dark:hover:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-800 text-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-200 dark:focus:ring-gray-700 text-gray-600 dark:text-gray-300 placeholder-gray-400 transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-6">
              <div>
                <div className="text-xs font-medium text-gray-400 mb-2 px-3">
                  {language === 'zh' ? '最近 7 天' : 'Last 7 Days'}
                </div>
                {['New Chat', 'React Hooks Help', 'Python Script'].map((item, i) => (
                  <div
                    key={i}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm ${
                      i === 0
                        ? 'bg-gray-200/60 dark:bg-gray-800 text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/40 dark:hover:bg-gray-800/40'
                    }`}
                  >
                    <span className="truncate flex-1">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4 text-center">
            <p>Select a model from the grid to view the chat here.</p>
          </div>
        )}

        {/* Sidebar Footer with Settings */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-gray-200/50 dark:hover:bg-gray-800 cursor-pointer w-full text-left transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <Settings size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {language === 'zh' ? '工具' : 'Tools'}
              </span>
            </div>
          </button>
        </div>
      </div>
    );
  };

  const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
      <div className="mb-12 text-center">
        <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
          {language === 'zh' ? '有什么可以帮忙的?' : 'How can I help you today?'}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {[
          { 
            title: language === 'zh' ? "总结文章" : "Summarize Text", 
            desc: language === 'zh' ? "总结下面文章" : "Summarize the article below", 
            prompt: "请帮我总结这篇文章的要点..." 
          },
          { 
            title: language === 'zh' ? "解释概念" : "Explain Concept", 
            desc: language === 'zh' ? "向初学者解释这个概念" : "Explain this to a beginner", 
            prompt: "请像对待初学者一样解释量子纠缠..." 
          },
          { 
            title: language === 'zh' ? "写代码" : "Code Expert", 
            desc: language === 'zh' ? "编写一个Python脚本" : "Write a Python script", 
            prompt: "请帮我写一个Python脚本来实现..." 
          },
          { 
            title: language === 'zh' ? "从图片提取" : "OCR", 
            desc: language === 'zh' ? "从附加的图片中提取文字" : "Extract text from image", 
            prompt: "请分析这张图片并提取其中的文字..." 
          }
        ].map((card, i) => (
          <button 
            key={i}
            onClick={() => handleSend(card.prompt, null)}
            className="p-5 bg-gray-100/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl text-left transition-colors h-40 flex flex-col justify-between group border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
          >
            <div>
              <div className="font-medium text-gray-900 dark:text-white mb-1">{card.title}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{card.desc}</div>
            </div>
            <div className="flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded text-gray-500 dark:text-gray-300 shadow-sm">
                {language === 'zh' ? '提示' : 'Prompt'}
              </span>
              <div className="p-1.5 bg-white dark:bg-gray-700 rounded-md shadow-sm text-gray-400 dark:text-gray-300">
                <ArrowUp size={12} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const isGridMode = lanes.length > 3;

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {showClearConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 w-80 border border-red-500/60">
            <h2 className="text-lg font-semibold mb-3 text-red-600">
              {language === 'zh' ? '确认清空所有对话？' : 'Clear all chats?'}
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-5">
              {language === 'zh'
                ? '此操作不可撤销，将删除当前页面的所有对话记录。'
                : 'This cannot be undone and will delete all conversations on this page.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  clearAllChats();
                  setShowClearConfirm(false);
                }}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                {language === 'zh' ? '确认清空' : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}
      
            <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        theme={theme} setTheme={setTheme}
        language={language} setLanguage={setLanguage}
        fontSize={fontSize} setFontSize={setFontSize}
        isStreamEnabled={isStreamEnabled} setIsStreamEnabled={setIsStreamEnabled}
        apiMode={apiMode} setApiMode={setApiMode}
        openaiApiKey={openaiApiKey} setOpenaiApiKey={setOpenaiApiKey}
        geminiApiKey={geminiApiKey} setGeminiApiKey={setGeminiApiKey}
        openaiApiUrl={openaiApiUrl} setOpenaiApiUrl={setOpenaiApiUrl}
        geminiApiUrl={geminiApiUrl} setGeminiApiUrl={setGeminiApiUrl}
        availableModels={availableModels} setAvailableModels={setAvailableModels}
      />

      <Sidebar />

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col h-full transition-all duration-300 ${
          isSidebarOpen ? (isGridMode ? 'md:ml-[340px]' : 'md:ml-[260px]') : ''
        } relative bg-white dark:bg-gray-900`}
      >
        {/* Top Navigation Bar */}
        <header className="h-16 flex items-center justify-between px-4 sticky top-0 bg-white dark:bg-gray-900 z-20 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 w-1/4">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <PanelLeft size={20} />
              </button>
            )}
            <div className="md:hidden">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 text-gray-500"
              >
                <Menu size={20} />
              </button>
            </div>
            <h1 className="font-medium text-gray-700 dark:text-gray-200 hidden md:block truncate flex items-center gap-2">
              <span>枭化物</span>
              <span className="text-xs text-gray-400">1.7-v1</span>
            </h1>
          </div>

          <div className="flex-1" />

          {/* Center model selector */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1 border border-gray-200 dark:border-gray-700 h-9">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2">
              {language === 'zh' ? '选择模型' : 'Model'}:
            </span>
            <select 
              onChange={(e) => setAllModels(e.target.value)}
              className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer py-1 px-1 min-w-[220px]"
              value={selectedModelId}
            >
              {availableModels.map(m => (
                <option
                  key={m.id}
                  value={m.id}
                  className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                >
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Right controls */}
          <div className="flex items-center justify-end gap-2 w-auto">
            <button 
              onClick={confirmAndClearChats}
              className="flex items-center gap-1 px-3 h-9 text-sm font-medium text-red-500 border border-gray-200 dark:border-gray-700 transition-colors mr-2"
              title={language === 'zh' ? '清空所有对话' : 'Clear All Chats'}
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">
                {language === 'zh' ? '清空' : 'Clear'}
              </span>
            </button>
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700 h-9">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 hidden sm:inline">
                {language === 'zh' ? '并发数' : 'Lanes'}:
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={laneCountInput}
                onChange={(e) => updateLaneCount(e.target.value)}
                className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none w-12 pl-1 text-center"
              />            </div>


            <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1 border border-gray-200 dark:border-gray-700 h-9 ml-2">
              <button
                type="button"
                onClick={() => setApiMode('openai')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
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
                className={`ml-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  apiMode === 'gemini'
                    ? 'bg-yellow-400 text-gray-900 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Gemini
              </button>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center justify-center w-9 h-9 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-hidden relative flex flex-col bg-white dark:bg-gray-900">
          {!hasStartedChat ? (
            <>
              <EmptyState />
              <div className="p-4 pb-6 bg-white dark:bg-gray-900 z-20">
                <ChatInput 
                  onSend={handleSend} 
                  language={language} 
                  isGenerating={lanes.some(l => l.isThinking)}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-hidden relative">
                {isGridMode ? (
                  <div className="h-full p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                      {lanes.map(lane => (
                        <ChatGridItem 
                          key={lane.id} 
                          lane={lane} 
                          isActive={activeLaneId === lane.id}
                          onClick={() => {
                            setActiveLaneId(lane.id);
                            if (!isSidebarOpen) setIsSidebarOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full overflow-x-auto snap-x snap-mandatory divide-x divide-gray-100 dark:divide-gray-800 scrollbar-hide">
                    {lanes.map(lane => (
                      <div
                        key={lane.id}
                        className={`flex-none h-full snap-center ${
                          lanes.length === 1
                            ? 'w-full'
                            : lanes.length === 2
                            ? 'w-full md:w-1/2'
                            : 'w-full md:w-1/2 lg:w-1/3'
                        }`}
                      >
                        <ChatColumn 
                          lane={lane} 
                          onRemove={removeLane} 
                          onModelChange={updateModel}
                          isMultiLane={lanes.length > 1}
                          fontSize={fontSize}
                          availableModels={availableModels}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 pb-6 bg-white dark:bg-gray-900 z-20 border-t border-gray-100 dark:border-gray-800">
                <ChatInput 
                  onSend={handleSend} 
                  language={language} 
                  isGenerating={lanes.some(l => l.isThinking)}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;