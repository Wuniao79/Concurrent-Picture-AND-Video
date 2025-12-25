import { useEffect, useState } from 'react';
import {
  ApiMode,
  Language,
  Model,
  ThemeMode,
  AVAILABLE_MODELS,
  GeminiAspectRatio,
  GeminiImageSettings,
  GeminiResolution,
  RoleCardItem,
} from '../types';
import { safeStorageGet, safeStorageSet } from '../utils/storage';
import { v4 as uuidv4 } from 'uuid';

export interface RelaySite {
  id: string;
  name: string;
  apiKey: string;
  apiUrl: string;
  enabled?: boolean;
}

export interface GeminiKeySite {
  id: string;
  name: string;
  apiKey: string;
  enabled?: boolean;
}

interface UseSettingsOptions {
  defaultApiKey?: string;
  defaultApiUrl?: string;
}

export const useSettings = (options: UseSettingsOptions = {}) => {
  const { defaultApiKey = '', defaultApiUrl = '' } = options;

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

  const [downloadProxyUrl, setDownloadProxyUrl] = useState<string>(() => {
    return safeStorageGet('sora_download_proxy_url') ?? '';
  });

  const [concurrencyIntervalSec, setConcurrencyIntervalSec] = useState(() => {
    const stored = safeStorageGet('sora_concurrency_interval_sec');
    const n = stored ? parseFloat(stored) : NaN;
    if (!isNaN(n)) return Math.max(0.1, Math.min(60, n));
    return 0.5;
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
    if (stored && stored.trim()) return stored;
    if (defaultApiUrl && defaultApiUrl.trim()) return defaultApiUrl.trim();
    return '';
  });
  const [geminiApiUrl, setGeminiApiUrl] = useState(() => {
    const stored = safeStorageGet('sora_gemini_apiUrl');
    if (stored && stored.trim()) return stored;
    return '';
  });

  const [geminiCustomBaseEnabled, setGeminiCustomBaseEnabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_gemini_custom_base_enabled');
    if (stored === '1') return true;
    if (stored === '0') return false;
    return false;
  });

  const [geminiEnterpriseEnabled, setGeminiEnterpriseEnabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_gemini_enterprise_enabled');
    return stored === '1';
  });

  const [geminiEnterpriseProjectId, setGeminiEnterpriseProjectId] = useState<string>(() => {
    return safeStorageGet('sora_gemini_enterprise_project_id') ?? '';
  });

  const [geminiEnterpriseLocation, setGeminiEnterpriseLocation] = useState<string>(() => {
    return safeStorageGet('sora_gemini_enterprise_location') ?? 'us-central1';
  });

  const [geminiEnterpriseToken, setGeminiEnterpriseToken] = useState<string>(() => {
    return safeStorageGet('sora_gemini_enterprise_token') ?? '';
  });

  const [geminiImageSettings, setGeminiImageSettings] = useState<GeminiImageSettings>(() => {
    const enabled = safeStorageGet('sora_gemini_image_enabled') === '1';
    const storedResolution = safeStorageGet('sora_gemini_image_resolution') as GeminiResolution | null;
    const storedAspect = safeStorageGet('sora_gemini_image_ratio') as GeminiAspectRatio | null;
    const resolution: GeminiResolution = storedResolution === '1K' || storedResolution === '2K' || storedResolution === '4K'
      ? storedResolution
      : '4K';
    const validAspect: GeminiAspectRatio[] = [
      'auto',
      '21:9',
      '16:9',
      '3:2',
      '4:3',
      '5:4',
      '1:1',
      '4:5',
      '3:4',
      '2:3',
      '9:16',
    ];
    const aspectRatio: GeminiAspectRatio = storedAspect && validAspect.includes(storedAspect) ? storedAspect : 'auto';
    return {
      enabled,
      resolution,
      aspectRatio,
    };
  });

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
    return stored || AVAILABLE_MODELS[0].id;
  });

  const [devExperimentalEnabled, setDevExperimentalEnabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_dev_experimental');
    return stored === '1';
  });

  const [devTbd1Enabled, setDevTbd1Enabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_dev_tbd_1');
    return stored === '1';
  });

  const [devTbd2Enabled, setDevTbd2Enabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_dev_tbd_2');
    return stored === '1';
  });

  const [devFuture1Enabled, setDevFuture1Enabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_dev_future_1');
    return stored === '1';
  });

  const [devFuture2Enabled, setDevFuture2Enabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_dev_future_2');
    return stored === '1';
  });

  const [devFuture3Enabled, setDevFuture3Enabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_dev_future_3');
    return stored === '1';
  });

  // Danger gate: unlock high concurrency lane limit UI (one-way; only cleared by clearing localStorage).
  const [laneLimitUnlocked, setLaneLimitUnlocked] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_dev_lane_limit_unlocked');
    return stored === '1';
  });

  const [laneCountLimit, setLaneCountLimit] = useState<number>(() => {
    const stored = safeStorageGet('sora_dev_lane_limit');
    const n = stored ? parseInt(stored, 10) : NaN;
    return !isNaN(n) && n >= 1 && n <= 999 ? n : 20;
  });

  const [historyButtonEnabled, setHistoryButtonEnabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_history_button');
    return stored === '1' || stored === 'true';
  });

  const [moreImagesEnabled, setMoreImagesEnabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_more_images');
    return stored === '1';
  });

  const [sora2piEnabled, setSora2piEnabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_sora2pi_enabled');
    return stored === '1';
  });

  const [roleCardsEnabled, setRoleCardsEnabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_role_cards_enabled');
    return stored === '1';
  });

  const [roleCards, setRoleCards] = useState<RoleCardItem[]>(() => {
    const stored = safeStorageGet('sora_role_cards_v1');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed as RoleCardItem[];
      } catch {
        // ignore
      }
    }
    return [];
  });

  const [relays, setRelays] = useState<RelaySite[]>(() => {
    const stored = safeStorageGet('sora_relays');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed as RelaySite[];
      } catch {
        // ignore
      }
    }
    return [{ id: uuidv4(), name: '中转站1', apiKey: '', apiUrl: '', enabled: false }];
  });

  const [activeRelayId, setActiveRelayId] = useState<string>(() => {
    const stored = safeStorageGet('sora_active_relay');
    return stored || '';
  });

  const [relayEnabled, setRelayEnabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_relay_enabled');
    return stored === '1';
  });

  const [geminiKeys, setGeminiKeys] = useState<GeminiKeySite[]>(() => {
    const stored = safeStorageGet('sora_gemini_keys');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed as GeminiKeySite[];
      } catch {
        // ignore
      }
    }
    return [{ id: uuidv4(), name: '密钥1', apiKey: '', enabled: false }];
  });

  // Gate for showing "more keys" UI and the home key-rotation button.
  const [geminiKeyPoolEnabled, setGeminiKeyPoolEnabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_gemini_keys_enabled');
    if (stored === '1') return true;
    if (stored === '0') return false;

    // Backward compatibility: if rotation was enabled before, keep the pool enabled.
    const rotation = safeStorageGet('sora_gemini_key_rotation');
    return rotation === '1';
  });

  const [geminiKeyRotationEnabled, setGeminiKeyRotationEnabled] = useState<boolean>(() => {
    const stored = safeStorageGet('sora_gemini_key_rotation');
    if (stored === '1') return true;
    if (stored === '0') return false;
    return false;
  });

  // Persist settings to localStorage
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
    safeStorageSet('sora_download_proxy_url', downloadProxyUrl ?? '');
  }, [downloadProxyUrl]);

  useEffect(() => {
    safeStorageSet('sora_concurrency_interval_sec', String(concurrencyIntervalSec));
  }, [concurrencyIntervalSec]);

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
    safeStorageSet('sora_gemini_custom_base_enabled', geminiCustomBaseEnabled ? '1' : '0');
  }, [geminiCustomBaseEnabled]);

  useEffect(() => {
    safeStorageSet('sora_gemini_enterprise_enabled', geminiEnterpriseEnabled ? '1' : '0');
  }, [geminiEnterpriseEnabled]);

  useEffect(() => {
    safeStorageSet('sora_gemini_enterprise_project_id', geminiEnterpriseProjectId ?? '');
  }, [geminiEnterpriseProjectId]);

  useEffect(() => {
    safeStorageSet('sora_gemini_enterprise_location', geminiEnterpriseLocation ?? '');
  }, [geminiEnterpriseLocation]);

  useEffect(() => {
    safeStorageSet('sora_gemini_enterprise_token', geminiEnterpriseToken ?? '');
  }, [geminiEnterpriseToken]);

  useEffect(() => {
    safeStorageSet('sora_gemini_image_enabled', geminiImageSettings.enabled ? '1' : '0');
    safeStorageSet('sora_gemini_image_resolution', geminiImageSettings.resolution);
    safeStorageSet('sora_gemini_image_ratio', geminiImageSettings.aspectRatio);
  }, [geminiImageSettings]);

  useEffect(() => {
    if (selectedModelId) {
      safeStorageSet('sora_selectedModelId', selectedModelId);
    }
  }, [selectedModelId]);

  useEffect(() => {
    safeStorageSet('sora_dev_experimental', devExperimentalEnabled ? '1' : '0');
  }, [devExperimentalEnabled]);

  useEffect(() => {
    safeStorageSet('sora_dev_tbd_1', devTbd1Enabled ? '1' : '0');
  }, [devTbd1Enabled]);

  useEffect(() => {
    safeStorageSet('sora_dev_tbd_2', devTbd2Enabled ? '1' : '0');
  }, [devTbd2Enabled]);

  useEffect(() => {
    safeStorageSet('sora_dev_future_1', devFuture1Enabled ? '1' : '0');
  }, [devFuture1Enabled]);

  useEffect(() => {
    safeStorageSet('sora_dev_future_2', devFuture2Enabled ? '1' : '0');
  }, [devFuture2Enabled]);

  useEffect(() => {
    safeStorageSet('sora_dev_future_3', devFuture3Enabled ? '1' : '0');
  }, [devFuture3Enabled]);

  useEffect(() => {
    if (!laneLimitUnlocked) return;
    safeStorageSet('sora_dev_lane_limit', String(laneCountLimit));
  }, [laneCountLimit, laneLimitUnlocked]);

  useEffect(() => {
    if (!laneLimitUnlocked) return;
    safeStorageSet('sora_dev_lane_limit_unlocked', '1');
  }, [laneLimitUnlocked]);

  useEffect(() => {
    safeStorageSet('sora_history_button', historyButtonEnabled ? '1' : '0');
  }, [historyButtonEnabled]);

  useEffect(() => {
    safeStorageSet('sora_more_images', moreImagesEnabled ? '1' : '0');
  }, [moreImagesEnabled]);

  useEffect(() => {
    safeStorageSet('sora_sora2pi_enabled', sora2piEnabled ? '1' : '0');
  }, [sora2piEnabled]);

  useEffect(() => {
    safeStorageSet('sora_role_cards_enabled', roleCardsEnabled ? '1' : '0');
  }, [roleCardsEnabled]);

  useEffect(() => {
    try {
      safeStorageSet('sora_role_cards_v1', JSON.stringify(roleCards.slice(0, 200)));
    } catch {
      // ignore
    }
  }, [roleCards]);

  useEffect(() => {
    try {
      safeStorageSet('sora_relays', JSON.stringify(relays));
    } catch {
      // ignore
    }
  }, [relays]);

  useEffect(() => {
    safeStorageSet('sora_active_relay', activeRelayId ?? '');
  }, [activeRelayId]);

  useEffect(() => {
    safeStorageSet('sora_relay_enabled', relayEnabled ? '1' : '0');
  }, [relayEnabled]);

  useEffect(() => {
    try {
      safeStorageSet('sora_models', JSON.stringify(availableModels));
    } catch {
      // ignore
    }
  }, [availableModels]);

  useEffect(() => {
    try {
      safeStorageSet('sora_gemini_keys', JSON.stringify(geminiKeys));
    } catch {
      // ignore
    }
  }, [geminiKeys]);

  useEffect(() => {
    safeStorageSet('sora_gemini_key_rotation', geminiKeyRotationEnabled ? '1' : '0');
  }, [geminiKeyRotationEnabled]);

  useEffect(() => {
    safeStorageSet('sora_gemini_keys_enabled', geminiKeyPoolEnabled ? '1' : '0');
  }, [geminiKeyPoolEnabled]);

  useEffect(() => {
    if (!geminiKeyPoolEnabled && geminiKeyRotationEnabled) {
      setGeminiKeyRotationEnabled(false);
    }
  }, [geminiKeyPoolEnabled, geminiKeyRotationEnabled]);

  return {
    theme,
    setTheme,
    language,
    setLanguage,
    fontSize,
    setFontSize,
    downloadProxyUrl,
    setDownloadProxyUrl,
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
    selectedModelId,
    setSelectedModelId,
    devExperimentalEnabled,
    setDevExperimentalEnabled,
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
    setLaneLimitUnlocked: (v: boolean) => {
      // One-way toggle: can only be enabled; disabling requires clearing localStorage.
      if (!v) return;
      setLaneLimitUnlocked(true);
    },
    laneCountLimit: laneLimitUnlocked ? laneCountLimit : 20,
    setLaneCountLimit: (v: number) => {
      if (!laneLimitUnlocked) return;
      setLaneCountLimit(v);
    },
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
    geminiKeyRotationEnabled,
    setGeminiKeyRotationEnabled,
    geminiImageSettings,
    setGeminiImageSettings,
  };
};
