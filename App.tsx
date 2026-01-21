import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChatColumn } from './components/ChatColumn';
import { ChatGridItem } from './components/ChatGridItem';
import { ChatInput } from './components/ChatInput';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { EmptyState } from './components/EmptyState';
import { TopBar } from './components/TopBar';
import { PromptLibraryModal } from './components/tools/PromptLibraryModal';
import { ImageSlicerModal } from './components/tools/ImageSlicerModal';
import { StoryboardDesignModal } from './components/tools/StoryboardDesignModal';
import { VideoFrameModal } from './components/tools/VideoFrameModal';
import { QuickTimelineModal } from './components/tools/QuickTimelineModal';
import { XhsLabModal } from './components/tools/XhsLabModal';
import { GeminiImagePanel } from './components/GeminiImagePanel';
import { useSettings } from './hooks/useSettings';
import { useLanes } from './hooks/useLanes';
import { LaneHistoryItem } from './utils/history';
import { loadHistory, saveHistory, loadCounter, saveCounter, loadActiveHistoryId, saveActiveHistoryId } from './utils/history';
import { LaneState, Message, ModelModality, Role, ToolView } from './types';
import { createDefaultLane } from './utils/lane';
import { safeStorageGet, safeStorageSet } from './utils/storage';
import { fetchBlobWithProxy } from './utils/download';
import { buildImageCacheId, clearImageCache, deleteImageCacheByHistoryId, getImageCacheRecord, putImageCacheRecord } from './utils/imageCache';
import { isVideoReadyFromText } from './utils/isVideoReady';
import { resolveModelModalities } from './utils/modelModality';
import {
  loadDownloadDirectoryHandle,
  saveDownloadDirectoryHandle,
  clearDownloadDirectoryHandle,
} from './utils/fileSystem';

const SESSION_HISTORY_KEY = 'sora_session_history_id';
const AUTO_HISTORY_NAME_RE = /^并发V(\d+)-(\d+)$/i;

const App: React.FC = () => {
  const defaultApiKey = '';
  const defaultApiUrl = '';

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [historyList, setHistoryList] = useState<LaneHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [historyCounter, setHistoryCounter] = useState<number>(0);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [downloadRootHandle, setDownloadRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [bulkDownloadLoading, setBulkDownloadLoading] = useState(false);
  const [bulkDownloadMessage, setBulkDownloadMessage] = useState('');
  const [bulkDownloadMessageTone, setBulkDownloadMessageTone] = useState<'neutral' | 'success' | 'error'>('neutral');
  // Bound history id for the current live session (used for updating history without creating new entries).
  const [pendingHistoryId, setPendingHistoryId] = useState<string | null>(() => {
    const stored = safeStorageGet(SESSION_HISTORY_KEY);
    return stored ? stored : null;
  });
  // UI-only flag: allow entering an empty live session (no messages yet) from history list.
  const [hasEnteredSession, setHasEnteredSession] = useState(false);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [viewingLanes, setViewingLanes] = useState<LaneState[] | null>(null);
  const [viewingActiveLaneId, setViewingActiveLaneId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [laneLocked, setLaneLocked] = useState(() => safeStorageGet('sora_lane_locked') === '1');
  const [isFullView, setIsFullView] = useState(false);
  const [queueStartAt, setQueueStartAt] = useState<number | null>(null);
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  const [modelModalityFilter, setModelModalityFilter] = useState<ModelModality | null>(null);
  const [activeTool, setActiveTool] = useState<ToolView | null>(null);
  const [isGeminiPanelOpen, setIsGeminiPanelOpen] = useState(false);
  const lastHistorySyncAtRef = useRef<number>(0);
  const backgroundHistorySyncAtRef = useRef<Record<string, number>>({});
  const historySyncKeyRef = useRef<Record<string, string>>({});
  const bulkDownloadMessageTimerRef = useRef<number | null>(null);

  const pendingHistoryIdRef = useRef<string | null>(pendingHistoryId);
  const historyCounterRef = useRef<number>(historyCounter);

  useEffect(() => {
    pendingHistoryIdRef.current = pendingHistoryId;
  }, [pendingHistoryId]);

  useEffect(() => {
    historyCounterRef.current = historyCounter;
  }, [historyCounter]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      const handle = await loadDownloadDirectoryHandle();
      if (isMounted) {
        setDownloadRootHandle(handle);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (bulkDownloadMessageTimerRef.current !== null) {
        window.clearTimeout(bulkDownloadMessageTimerRef.current);
      }
    };
  }, []);


  const showBulkDownloadMessage = useCallback(
    (text: string, tone: 'neutral' | 'success' | 'error' = 'neutral', durationMs = 3200) => {
      if (bulkDownloadMessageTimerRef.current !== null) {
        window.clearTimeout(bulkDownloadMessageTimerRef.current);
        bulkDownloadMessageTimerRef.current = null;
      }
      setBulkDownloadMessage(text);
      setBulkDownloadMessageTone(tone);
      if (durationMs > 0) {
        bulkDownloadMessageTimerRef.current = window.setTimeout(() => {
          setBulkDownloadMessage('');
          setBulkDownloadMessageTone('neutral');
          bulkDownloadMessageTimerRef.current = null;
        }, durationMs);
      }
    },
    []
  );

  const getCurrentSessionId = useCallback(() => pendingHistoryIdRef.current, []);

  const {
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
    laneCountLimit,
    setLaneCountLimit,
    laneLimitUnlocked,
    setLaneLimitUnlocked,
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
  } = useSettings({ defaultApiKey, defaultApiUrl });

  const enabledRelays = relayEnabled ? relays.filter((r) => r.enabled) : [];
  const activeRelay = relayEnabled ? enabledRelays.find((r) => r.id === activeRelayId) : undefined;
  const effectiveOpenaiKey = activeRelay?.apiKey || openaiApiKey;
  const effectiveOpenaiUrl = activeRelay?.apiUrl || openaiApiUrl;
  const showRelaySelect = apiMode === 'openai' && relayEnabled && enabledRelays.length > 0;

  const enabledGeminiKeys = geminiKeys.filter((k) => k.enabled);
  const effectiveGeminiUrl = geminiCustomBaseEnabled ? geminiApiUrl : '';
  const geminiEnterpriseReady = useMemo(() => {
    const projectId = (geminiEnterpriseProjectId || '').trim();
    const token = (geminiEnterpriseToken || '').trim();
    const location = (geminiEnterpriseLocation || '').trim() || 'us-central1';
    return Boolean(projectId && token && location);
  }, [geminiEnterpriseProjectId, geminiEnterpriseLocation, geminiEnterpriseToken]);

  const enterpriseFeatureEnabled = useMemo(
    () => Boolean(devExperimentalEnabled && devTbd1Enabled),
    [devExperimentalEnabled, devTbd1Enabled]
  );
  const effectiveGeminiEnterpriseEnabled = enterpriseFeatureEnabled && geminiEnterpriseEnabled;

  const resolveModelModalitiesById = useCallback(
    (modelId: any): ModelModality[] => {
      const normalizedModelId =
        typeof modelId === 'string'
          ? modelId
          : modelId && typeof modelId === 'object' && typeof modelId.id !== 'undefined'
          ? String(modelId.id)
          : String(modelId ?? '');

      const matches = availableModels.filter((m) => m.id === normalizedModelId);
      const preferred =
        apiMode === 'gemini'
          ? matches.find((m) => m.provider === 'gemini')
          : matches.find((m) => !m.provider || m.provider === 'openai');
      const picked = preferred || matches[0];
      if (picked) return resolveModelModalities(picked);
      const id = normalizedModelId.toLowerCase();
      if (id.includes('sora-video') || id.includes('video')) return ['video'];
      if (id.includes('image')) return ['image'];
      return ['text'];
    },
    [availableModels, apiMode]
  );
  const hasModelModalityById = useCallback(
    (modelId: any, modality: ModelModality) => resolveModelModalitiesById(modelId).includes(modality),
    [resolveModelModalitiesById]
  );

  const computeIsGeneratingFromLanes = useCallback(
    (ls: LaneState[]) => {
      const laneHasUserPrompt = (lane: LaneState) =>
        (lane.messages || []).some(
          (m) =>
            m.role === Role.USER &&
            (Boolean((m.text || '').trim()) ||
              Boolean(m.image) ||
              Boolean(Array.isArray(m.images) && m.images.length > 0))
        );

      const laneHasModelMessage = (lane: LaneState) => (lane.messages || []).some((m) => m.role === Role.MODEL);
      const laneHasVideoResult = (lane: LaneState) =>
        (lane.messages || []).some((m) => {
          if (m.role !== Role.MODEL || typeof m.text !== 'string') return false;
          return isVideoReadyFromText(m.text);
        });

      const isVideoInFlight = (lane: LaneState) => {
        if (!hasModelModalityById(lane.model, 'video')) return false;
        if (lane.error) return false;
        if (typeof lane.errorCode === 'number' && lane.errorCode >= 400) return false;
        if (!laneHasUserPrompt(lane)) return false;
        if (!laneHasModelMessage(lane)) return false;
        if (laneHasVideoResult(lane)) return false;
        if (typeof lane.progress !== 'number') return true;
        return lane.progress >= 0 && lane.progress < 100;
      };

      return ls.some((l) => l.isThinking || isVideoInFlight(l));
    },
    [hasModelModalityById]
  );
  const onBackgroundLaneUpdate = useCallback(
    (sessionId: string, laneId: string, updater: (prev: LaneState) => LaneState) => {
      const now = Date.now();
      setHistoryList((prev) => {
        let changed = false;
        let nextCounter: number | null = null;
        let shouldPersist = false;

        const nextList = prev.map((item) => {
          if (item.id !== sessionId) return item;
          const lanes = Array.isArray(item.lanes) ? item.lanes : [];
          const idx = lanes.findIndex((l) => l.id === laneId);
          if (idx === -1) return item;

          const updatedLanes = lanes.slice();
          updatedLanes[idx] = updater(updatedLanes[idx]);

          const isGenerating = computeIsGeneratingFromLanes(updatedLanes);

          let sequenceNumber = item.sequenceNumber;
          if (
            !sequenceNumber &&
            !isGenerating &&
            updatedLanes.reduce((acc, l) => acc + (l.messages?.length || 0), 0) > 0
          ) {
            sequenceNumber = historyCounterRef.current + 1;
            nextCounter = sequenceNumber;
          }

          let name = item.name;
          if (sequenceNumber && ((name || '').startsWith('等待并发中') || AUTO_HISTORY_NAME_RE.test(name || ''))) {
            name = `并发V${sequenceNumber}-${updatedLanes.length}`;
          }

          const lastPersistAt = backgroundHistorySyncAtRef.current[sessionId] || 0;
          const minIntervalMs = isGenerating ? 900 : 0;
          shouldPersist =
            shouldPersist ||
            !isGenerating ||
            Boolean(item.isRunning) !== isGenerating ||
            now - lastPersistAt >= minIntervalMs;

          changed = true;
          return {
            ...item,
            name,
            sequenceNumber: sequenceNumber || item.sequenceNumber,
            lanes: updatedLanes,
            updatedAt: now,
            isRunning: isGenerating,
            isDraft: false,
          };
        });

        if (!changed) return prev;
        if (shouldPersist) {
          backgroundHistorySyncAtRef.current[sessionId] = now;
          try {
            saveHistory(nextList);
          } catch {
            // ignore
          }
        }

        if (nextCounter !== null) {
          historyCounterRef.current = nextCounter;
          setHistoryCounter(nextCounter);
          saveCounter(nextCounter);
        }

        return nextList;
      });
    },
    [computeIsGeneratingFromLanes]
  );

  const normalizeModelIdValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'id' in value && typeof (value as any).id !== 'undefined') {
      return String((value as any).id);
    }
    return String(value ?? '');
  };

  const isInvalidModelId = (modelId: string): boolean => {
    const trimmed = (modelId || '').trim();
    if (!trimmed) return true;
    const lower = trimmed.toLowerCase();
    return lower === '[object object]' || lower === 'undefined' || lower === 'null';
  };

  const sanitizeLoadedSession = (
    input: any
  ): { lanes: LaneState[]; activeLaneId: string | null; laneCount: number } | null => {
    if (!input || !Array.isArray(input.lanes)) return null;

    const lanes: LaneState[] = input.lanes.map((lane: any) => {
      const modelId = normalizeModelIdValue(lane?.model);
      const resolvedModelId = isInvalidModelId(modelId) ? selectedModelId : modelId;
      const lower = resolvedModelId.toLowerCase();
      const isVideo = lower.includes('sora-video') || lower.includes('video');
      const hasModelMsg =
        Array.isArray(lane?.messages) && lane.messages.some((m: any) => m?.role === Role.MODEL && String(m?.text || ''));
      const progress =
        isVideo && hasModelMsg
          ? 100
          : typeof lane?.progress === 'number'
          ? lane.progress
          : 0;

      return {
        ...lane,
        model: resolvedModelId,
        isThinking: false,
        progress,
      };
    });

    const activeLaneId = typeof input.activeLaneId === 'string' ? input.activeLaneId : null;
    const laneCount = typeof input.laneCount === 'number' && Number.isFinite(input.laneCount) ? input.laneCount : lanes.length;
    return { lanes, activeLaneId, laneCount };
  };

  const savedSession = (() => {
    const raw = safeStorageGet('sora_active_session');
    if (!raw) return null;
    try {
      return sanitizeLoadedSession(JSON.parse(raw));
    } catch {
      return null;
    }
  })();

  const {
    lanes,
    activeLaneId,
    setActiveLaneId,
    laneCountInput,
    updateLaneCount,
    setAllModels,
    removeLane,
    updateModel,
    handleSend,
    startNewChat,
    clearAllChats,
    confirmAndClearChats,
    hasStartedChat,
    setHasStartedChat,
    cancelQueuedLanes,
    stopCurrentRun,
  } = useLanes({
    selectedModelId,
    availableModels,
    apiMode,
    openaiApiKey: effectiveOpenaiKey,
    geminiApiKey,
    openaiApiUrl: effectiveOpenaiUrl,
    geminiApiUrl: effectiveGeminiUrl,
    geminiKeyRotationEnabled,
    geminiKeyPool: geminiKeyPoolEnabled ? enabledGeminiKeys : [],
    geminiImageSettings,
    geminiEnterpriseEnabled: effectiveGeminiEnterpriseEnabled,
    geminiEnterpriseProjectId,
    geminiEnterpriseLocation,
    geminiEnterpriseToken,
    isStreamEnabled,
    concurrencyIntervalSec,
    maxLaneCount: laneCountLimit,
    onRequireSidebarOpen: () => setIsSidebarOpen(true),
    getCurrentSessionId,
    onBackgroundLaneUpdate,
    initialLanes: savedSession?.lanes,
    initialActiveLaneId: savedSession?.activeLaneId ?? null,
    initialLaneCount: savedSession?.laneCount,
  });

  const isGenerating = useMemo(() => computeIsGeneratingFromLanes(lanes), [computeIsGeneratingFromLanes, lanes]);
  useEffect(() => {
    if (!isGenerating && queueStartAt) {
      setQueueStartAt(null);
    }
  }, [isGenerating, queueStartAt]);

  const displayLanes = isViewingHistory && viewingLanes ? viewingLanes : lanes;
  const displayActiveLaneId = isViewingHistory ? viewingActiveLaneId : activeLaneId;
  const cacheHistoryId = isViewingHistory ? activeHistoryId : pendingHistoryId;
  const displayHasStartedChat = isViewingHistory
    ? displayLanes.length > 0
    : hasStartedChat || hasEnteredSession;
  const isGridMode = !isFullView && displayLanes.length > 3;
  const showLanePreviewToggle = displayLanes.length > 1 && displayLanes.length <= 3;
  const activeLane = displayLanes.find((l) => l.id === displayActiveLaneId);
  const fullViewLane = activeLane || displayLanes[0];
  const fullViewLaneIndex = useMemo(() => {
    if (!fullViewLane?.id) return -1;
    return displayLanes.findIndex((l) => l.id === fullViewLane.id);
  }, [displayLanes, fullViewLane?.id]);
  const canEditDisplay = !isViewingHistory;
  const laneNavItems = useMemo(
    () =>
      displayLanes.slice(0, 20).map((lane, idx) => {
        const hasError =
          (typeof lane.errorCode === 'number' && lane.errorCode >= 400) || Boolean(lane.error);
        const isRunning =
          lane.isThinking ||
          (typeof lane.progress === 'number' && lane.progress >= 0 && lane.progress < 100);
        const hasModelOutput = (lane.messages || []).some(
          (m) => m.role === Role.MODEL && Boolean((m.text || '').trim())
        );
        const status: 'error' | 'running' | 'done' | 'idle' =
          hasError ? 'error' : isRunning ? 'running' : hasModelOutput ? 'done' : 'idle';
        return {
          id: lane.id,
          label: String(idx + 1),
          isActive: lane.id === displayActiveLaneId,
          status,
        };
      }),
    [displayLanes, displayActiveLaneId]
  );
  const wasGeneratingRef = useRef(false);
  const setDisplayActiveLaneId = (id: string | null) => {
    if (isViewingHistory) {
      setViewingActiveLaneId(id);
    } else {
      setActiveLaneId(id);
    }
  };
  const handleLanePreviewToggle = useCallback(
    (laneId: string) => {
      if (!laneId) return;
      if (isFullView) {
        if (fullViewLane && fullViewLane.id === laneId) {
          setIsFullView(false);
          return;
        }
        setDisplayActiveLaneId(laneId);
        return;
      }
      setDisplayActiveLaneId(laneId);
      setIsSidebarOpen(false);
      setIsHistoryPanelOpen(false);
      setIsFullView(true);
    },
    [fullViewLane, isFullView, setDisplayActiveLaneId, setIsHistoryPanelOpen, setIsSidebarOpen]
  );
  const todayConcurrencyCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return historyList
      .filter((h) => h.createdAt >= start.getTime())
      .reduce((sum, item) => sum + (item.lanes?.length || 0), 0);
  }, [historyList]);
  const totalConcurrencyCount = useMemo(
    () => historyList.reduce((sum, item) => sum + (item.lanes?.length || 0), 0),
    [historyList]
  );
  const downloadDirectoryName = downloadRootHandle?.name || null;
  const visibleModels =
    apiMode === 'gemini'
      ? availableModels.filter((m) => m.provider === 'gemini')
      : availableModels.filter((m) => !m.provider || m.provider === 'openai');

  const videoChatLimitOverrideEnabled = Boolean(devExperimentalEnabled && devTbd2Enabled);
  const isVideoSession = lanes.some((l) => hasModelModalityById(l.model, 'video'));
  const hasAnyUserPrompt = lanes.some((l) =>
    (l.messages || []).some(
      (m) =>
        m.role === Role.USER &&
        (Boolean((m.text || '').trim()) || Boolean(m.image) || Boolean(Array.isArray(m.images) && m.images.length > 0))
    )
  );
  const videoConversationLocked = isVideoSession && hasAnyUserPrompt && !videoChatLimitOverrideEnabled;
  const chatInputDisabled = Boolean(isViewingHistory || videoConversationLocked);
  const chatInputDisabledHint = isViewingHistory
    ? language === 'zh'
      ? '正在查看历史记录，返回当前会话后才能继续输入。'
      : 'You are viewing history. Return to the current session to send messages.'
    : videoConversationLocked
    ? language === 'zh'
      ? '视频模型默认仅支持一次性对话；如有特殊需要可前往“开发者选项 → 视频模型突破对话限制”（可能会引发 bug）'
      : 'Video models are one-shot by default. Enable “Developer options → Video model chat limit override” to continue (may be unstable).'
    : undefined;

  useEffect(() => {
    if (!isVideoSession) {
      wasGeneratingRef.current = false;
      return;
    }
    if (isGenerating) {
      wasGeneratingRef.current = true;
      return;
    }
    if (wasGeneratingRef.current && hasStartedChat) {
      setIsInputCollapsed(true);
    }
    wasGeneratingRef.current = false;
  }, [isGenerating, isVideoSession, hasStartedChat]);

  // If history UI entry is unavailable, force-close history panel and exit viewing mode.
  useEffect(() => {
    if (historyButtonEnabled) return;

    if (isHistoryPanelOpen) {
      setIsHistoryPanelOpen(false);
    }

    if (isViewingHistory) {
      setIsViewingHistory(false);
      setViewingLanes(null);
      setViewingActiveLaneId(null);
      if (pendingHistoryId) {
        setActiveHistoryId(pendingHistoryId);
        saveActiveHistoryId(pendingHistoryId);
      }
    }
  }, [historyButtonEnabled, isHistoryPanelOpen, isViewingHistory, pendingHistoryId]);

  // load history on mount
  useEffect(() => {
    const list = loadHistory();
    const fallbackModelId = safeStorageGet('sora_selectedModelId') || selectedModelId;
    const resolveModelId = (value: unknown): string => {
      const normalized = normalizeModelIdValue(value);
      if (isInvalidModelId(normalized)) return fallbackModelId;
      return normalized.trim();
    };
    let migrated = list;
    let changed = false;
    migrated = list.map((item) => {
      const match = item.name?.match(AUTO_HISTORY_NAME_RE);
      let next = item;

      // After refresh, nothing is actually running anymore; clear stale flags.
      if (item.isRunning || item.isDraft) {
        next = { ...next, isRunning: false, isDraft: false };
        changed = true;
      }

      const resolvedModelId = resolveModelId((next as any).model);
      if ((next as any).model !== resolvedModelId) {
        next = { ...next, model: resolvedModelId };
        changed = true;
      }

      if (Array.isArray(next.lanes) && next.lanes.some((lane) => lane.isThinking || (lane as any).model !== resolveModelId((lane as any).model))) {
        next = {
          ...next,
          lanes: next.lanes.map((lane) => ({
            ...lane,
            isThinking: false,
            model: resolveModelId((lane as any).model),
          })),
        };
        changed = true;
      }

      if (!match) return next;
      const sequenceNumber = parseInt(match[1], 10);
      const laneCount = next.lanes?.length ?? 0;
      const nextName = `并发V${sequenceNumber}-${laneCount}`;
      const needsNameFix = nextName !== next.name;
      const needsSequenceFix = next.sequenceNumber !== sequenceNumber;
      if (!needsNameFix && !needsSequenceFix) return next;
      changed = true;
      return { ...next, name: needsNameFix ? nextName : next.name, sequenceNumber };
    });
    if (changed) {
      saveHistory(migrated);
    }
    setHistoryList(migrated);
    const storedCounter = loadCounter();
    const maxSequence = migrated.reduce((max, item) => Math.max(max, item.sequenceNumber || 0), 0);
    const counter = Math.max(storedCounter, maxSequence);
    setHistoryCounter(counter);
    if (counter !== storedCounter) {
      saveCounter(counter);
    }
    const activeId = loadActiveHistoryId();
    if (activeId) {
      setActiveHistoryId(activeId);
    }

    // If the stored session history id no longer exists, clear it.
    const sessionId = safeStorageGet(SESSION_HISTORY_KEY);
    if (sessionId && !migrated.find((h) => h.id === sessionId)) {
      safeStorageSet(SESSION_HISTORY_KEY, '');
      setPendingHistoryId(null);
      pendingHistoryIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    safeStorageSet(SESSION_HISTORY_KEY, pendingHistoryId || '');
  }, [pendingHistoryId]);

  useEffect(() => {
    safeStorageSet('sora_lane_locked', laneLocked ? '1' : '0');
  }, [laneLocked]);

  // persist current session
  useEffect(() => {
    const seenImageMessageIds = new Set<string>();
    const compactLanes = lanes.map((lane) => ({
      ...lane,
      messages: lane.messages.map((m) => {
        const cloned = { ...m };
        const isUser = cloned.role === Role.USER;
        const imagesFromMessage =
          Array.isArray(cloned.images) && cloned.images.length > 0
            ? cloned.images.filter(Boolean)
            : cloned.image
            ? [cloned.image]
            : [];

        if (isUser && imagesFromMessage.length > 0) {
          if (seenImageMessageIds.has(cloned.id)) {
            cloned.images = undefined;
            cloned.image = undefined;
          } else {
            seenImageMessageIds.add(cloned.id);
            const keep = imagesFromMessage.slice(0, 1);
            cloned.images = undefined;
            cloned.image = keep[0];
          }
        } else if (isUser) {
          cloned.images = undefined;
        }

        return cloned;
      }),
    }));

    const snapshot = { lanes: compactLanes, activeLaneId, laneCount: lanes.length };
    try {
      safeStorageSet('sora_active_session', JSON.stringify(snapshot));
    } catch {
      // ignore
    }
  }, [lanes, activeLaneId]);

  const persistHistory = (list: LaneHistoryItem[], counterValue?: number, activeId?: string | null) => {
    setHistoryList(list);
    saveHistory(list);
    if (typeof counterValue === 'number') {
      setHistoryCounter(counterValue);
      saveCounter(counterValue);
    }
    if (activeId !== undefined) {
      setActiveHistoryId(activeId);
      saveActiveHistoryId(activeId);
    }
  };

  const handleLaneCountChange = (value: string) => {
    if (laneLocked) return;
    updateLaneCount(value);
  };

  useEffect(() => {
    if (isFullView && !activeLaneId && lanes[0]) {
      setActiveLaneId(lanes[0].id);
    }
  }, [isFullView, activeLaneId, lanes, setActiveLaneId]);

  useEffect(() => {
    if (!relayEnabled) return;
    const enabled = relays.filter((r) => r.enabled);
    if (enabled.length === 0 && activeRelayId) {
      setActiveRelayId('');
    } else if (activeRelayId && !enabled.find((r) => r.id === activeRelayId)) {
      setActiveRelayId('');
    }
  }, [relays, relayEnabled, activeRelayId, setActiveRelayId]);

  // Gemini key rotation: key pool is validated on send; no active key selection needed.

  const summarizeLaneMessagesCount = (ls: LaneState[]) => {
    return ls.reduce((acc, lane) => acc + lane.messages.length, 0);
  };

  const cloneLanes = (ls: LaneState[]) =>
    ls.map((lane) => ({
      ...lane,
      isThinking: false,
      messages: lane.messages.map((m) => ({ ...m })),
    }));

  // Reduce localStorage usage: dedupe images across lanes by user message id,
  // and keep at most 1 image per user message.
  const cloneLanesForStorage = (ls: LaneState[]) => {
    const seenImageMessageIds = new Set<string>();
    return ls.map((lane) => ({
      ...lane,
      isThinking: false,
      messages: lane.messages.map((m) => {
        const cloned = { ...m };
        const isUser = cloned.role === Role.USER;
        const imagesFromMessage =
          Array.isArray(cloned.images) && cloned.images.length > 0
            ? cloned.images.filter(Boolean)
            : cloned.image
            ? [cloned.image]
            : [];

        if (isUser && imagesFromMessage.length > 0) {
          if (seenImageMessageIds.has(cloned.id)) {
            cloned.images = undefined;
            cloned.image = undefined;
          } else {
            seenImageMessageIds.add(cloned.id);
            const keep = imagesFromMessage.slice(0, 1);
            cloned.images = undefined;
            cloned.image = keep[0];
          }
        } else if (isUser) {
          cloned.images = undefined;
        }

        return cloned;
      }),
    }));
  };

  const extractImageDataUrlsFromText = (text: string) => {
    if (!text) return [];
    const results = new Set<string>();
    const markdownRegex = /!\[[^\]]*]\((\S+?)(?:\s+["'][^"']*["'])?\)/g;
    const dataUrlRegex = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;
    const httpRegex = /https?:\/\/[^\s)]+/g;
    const imageExtRegex = /\.(png|jpe?g|webp|gif|bmp|svg|avif)(?:$|[?#])/i;
    let match: RegExpExecArray | null;

    while ((match = markdownRegex.exec(text)) !== null) {
      if (match[1]) results.add(match[1]);
    }
    while ((match = dataUrlRegex.exec(text)) !== null) {
      if (match[0]) results.add(match[0]);
    }
    while ((match = httpRegex.exec(text)) !== null) {
      if (match[0] && imageExtRegex.test(match[0])) results.add(match[0]);
    }

    return Array.from(results);
  };

  const extractImageDataUrlsFromMessage = (msg: Message) => {
    if (!msg) return [];
    const results: string[] = [];
    const pushUnique = (url?: string) => {
      if (!url) return;
      if (!results.includes(url)) results.push(url);
    };
    if (Array.isArray(msg.images)) {
      msg.images.filter(Boolean).forEach((url) => pushUnique(url));
    }
    if (msg.image) pushUnique(msg.image);
    extractImageDataUrlsFromText(msg.text || '').forEach((url) => pushUnique(url));
    return results;
  };

  const collectGeneratedLaneImages = (ls: LaneState[]) =>
    ls
      .map((lane, laneIndex) => {
        const results = new Map<
          string,
          { url: string; cacheId?: string; messageId?: string; imageIndex?: number }
        >();
        for (const msg of lane.messages || []) {
          if (msg.role !== Role.MODEL) continue;
          const urls = extractImageDataUrlsFromMessage(msg);
          urls.forEach((url, idx) => {
            if (results.has(url)) return;
            const cacheId =
              cacheHistoryId && msg.id ? buildImageCacheId(cacheHistoryId, lane.id, msg.id, idx) : undefined;
            results.set(url, { url, cacheId, messageId: msg.id, imageIndex: idx });
          });
        }
        return { laneIndex, laneId: lane.id, items: Array.from(results.values()) };
      })
      .filter((item) => item.items.length > 0);

  const laneImageDownloads = useMemo(
    () => collectGeneratedLaneImages(displayLanes),
    [displayLanes, cacheHistoryId]
  );
  const totalDownloadImages = useMemo(
    () => laneImageDownloads.reduce((acc, item) => acc + item.items.length, 0),
    [laneImageDownloads]
  );
  const showBulkDownload = useMemo(
    () => displayLanes.some((lane) => hasModelModalityById(lane.model, 'image')),
    [displayLanes, hasModelModalityById]
  );
  const bulkDownloadDisabled = totalDownloadImages === 0 || bulkDownloadLoading;
  const showStopQueue = Boolean(isGenerating && concurrencyIntervalSec >= 10 && lanes.length > 1);

  const sanitizeDownloadName = (value: string, fallback: string) => {
    const cleaned = String(value || '')
      .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/g, '');
    return cleaned || fallback;
  };

  const resolveBulkDownloadFolderName = useCallback(() => {
    const targetId = isViewingHistory ? activeHistoryId : pendingHistoryId;
    const item = targetId ? historyList.find((h) => h.id === targetId) : undefined;
    const rawName = item?.name || '';
    const fallbackName = rawName || `concurrent-${displayLanes.length || 1}`;
    return sanitizeDownloadName(rawName || fallbackName, 'concurrent-download');
  }, [activeHistoryId, pendingHistoryId, historyList, isViewingHistory, displayLanes.length]);

  const resolveImageExtension = (src: string, mimeType?: string) => {
    if (mimeType) {
      const cleaned = mimeType.toLowerCase().split(';')[0];
      if (cleaned.startsWith('image/')) {
        const ext = cleaned.replace('image/', '');
        if (ext === 'jpeg') return 'jpg';
        if (ext.includes('+xml')) return 'svg';
        if (ext) return ext;
      }
    }
    if (!src) return 'png';
    if (src.startsWith('data:image/')) {
      const match = /^data:image\/([^;]+);/i.exec(src);
      const ext = match ? match[1].toLowerCase() : 'png';
      if (ext === 'jpeg') return 'jpg';
      if (ext.includes('+xml')) return 'svg';
      return ext || 'png';
    }
    const cleaned = src.split('?')[0].split('#')[0];
    const lastDot = cleaned.lastIndexOf('.');
    if (lastDot !== -1) {
      const ext = cleaned.slice(lastDot + 1).toLowerCase();
      if (ext === 'jpeg') return 'jpg';
      if (ext.includes('+xml')) return 'svg';
      if (ext) return ext;
    }
    return 'png';
  };

  const dataUrlToBlob = async (url: string) => fetchBlobWithProxy(url, downloadProxyUrl);

  const downloadDirectorySupported =
    typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';

  const ensureDirectoryPermission = useCallback(async (handle: FileSystemDirectoryHandle) => {
    try {
      const permissionApi = handle as any;
      if (typeof permissionApi.queryPermission === 'function') {
        const status = await permissionApi.queryPermission({ mode: 'readwrite' });
        if (status === 'granted') return true;
        if (typeof permissionApi.requestPermission === 'function') {
          const request = await permissionApi.requestPermission({ mode: 'readwrite' });
          return request === 'granted';
        }
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const handlePickDownloadRoot = useCallback(async () => {
    if (!downloadDirectorySupported) {
      alert(
        language === 'zh'
          ? '当前浏览器不支持选择下载文件夹。'
          : 'This browser does not support picking a download folder.'
      );
      return null;
    }
    try {
      const picker = (window as any).showDirectoryPicker;
      const handle = await picker({ startIn: 'downloads' });
      const granted = await ensureDirectoryPermission(handle);
      if (!granted) {
        alert(
          language === 'zh'
            ? '未授予文件夹写入权限，无法保存图片。'
            : 'Folder write permission was not granted.'
        );
        return null;
      }
      setDownloadRootHandle(handle);
      await saveDownloadDirectoryHandle(handle);
      return handle;
    } catch (err) {
      const errorName = (err as { name?: string })?.name;
      if (errorName === 'AbortError') return null;
      alert(
        language === 'zh'
          ? '选择下载文件夹失败。'
          : 'Failed to pick a download folder.'
      );
      return null;
    }
  }, [downloadDirectorySupported, ensureDirectoryPermission, language]);

  const handleClearDownloadRoot = useCallback(async () => {
    setDownloadRootHandle(null);
    await clearDownloadDirectoryHandle();
  }, []);

  const ensureDownloadRootHandle = useCallback(async () => {
    if (downloadRootHandle) {
      const granted = await ensureDirectoryPermission(downloadRootHandle);
      if (granted) return downloadRootHandle;
    }
    return handlePickDownloadRoot();
  }, [downloadRootHandle, ensureDirectoryPermission, handlePickDownloadRoot]);

  const handleBulkDownloadImages = useCallback(async () => {
    if (totalDownloadImages === 0 || bulkDownloadLoading) return;
    setBulkDownloadLoading(true);
    showBulkDownloadMessage(language === 'zh' ? '下载中...' : 'Downloading...', 'neutral', 0);
    const rootHandle = await ensureDownloadRootHandle();
    if (!rootHandle) {
      setBulkDownloadLoading(false);
      showBulkDownloadMessage(language === 'zh' ? '已取消下载' : 'Download canceled', 'neutral');
      return;
    }
    const folderName = resolveBulkDownloadFolderName();

    let failedCount = 0;
    try {
      const folderHandle = await rootHandle.getDirectoryHandle(folderName, { create: true });
      for (const bundle of laneImageDownloads) {
        const baseName = `Model-${bundle.laneIndex + 1}`;
        for (let idx = 0; idx < bundle.items.length; idx += 1) {
          const item = bundle.items[idx];
          const dataUrl = item.url;
          const cacheId = item.cacheId;
          const messageId = item.messageId || '';
          const imageIndex = typeof item.imageIndex === 'number' ? item.imageIndex : idx;
          try {
            let blob: Blob | null = null;
            if (cacheId) {
              const cached = await getImageCacheRecord(cacheId);
              if (cached?.blob) {
                blob = cached.blob;
              }
            }
            if (!blob) {
              blob = await dataUrlToBlob(dataUrl);
              if (cacheId && cacheHistoryId) {
                await putImageCacheRecord({
                  id: cacheId,
                  historyId: cacheHistoryId,
                  laneId: bundle.laneId || '',
                  messageId,
                  imageIndex,
                  source: dataUrl,
                  createdAt: Date.now(),
                  mimeType: blob.type || '',
                  blob,
                });
              }
            }
            const ext = resolveImageExtension(dataUrl, blob.type);
            const suffix = bundle.items.length > 1 ? `-${String(idx + 1).padStart(2, '0')}` : '';
            const fileName = `${baseName}${suffix}.${ext}`;
            const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
          } catch {
            failedCount += 1;
          }
        }
      }
      setBulkDownloadLoading(false);
      const rootName = rootHandle.name || (language === 'zh' ? '下载目录' : 'downloads');
      const savedPath = `${rootName}/${folderName}`;
      if (failedCount > 0) {
        showBulkDownloadMessage(
          language === 'zh'
            ? `已保存到：${savedPath}（失败 ${failedCount} 张，可能跨域限制）`
            : `Saved to: ${savedPath} (${failedCount} failed, likely CORS)`,
          'error'
        );
      } else {
        showBulkDownloadMessage(
          language === 'zh' ? `已保存到：${savedPath}` : `Saved to: ${savedPath}`,
          'success'
        );
      }
    } catch (err) {
      setBulkDownloadLoading(false);
      const errorName = (err as { name?: string })?.name;
      if (errorName === 'AbortError') {
        showBulkDownloadMessage(language === 'zh' ? '已取消下载' : 'Download canceled', 'neutral');
        return;
      }
      showBulkDownloadMessage(
        language === 'zh' ? '下载失败，请重试。' : 'Download failed. Please try again.',
        'error'
      );
    }
  }, [
    totalDownloadImages,
    bulkDownloadLoading,
    ensureDownloadRootHandle,
    resolveBulkDownloadFolderName,
    laneImageDownloads,
    language,
    showBulkDownloadMessage,
    downloadProxyUrl,
    cacheHistoryId,
  ]);

  const ensurePendingHistoryId = useCallback(() => {
    const existing = pendingHistoryIdRef.current;
    if (existing) return existing;

    const now = Date.now();
    const draft: LaneHistoryItem = {
      id: uuidv4(),
      name: '等待并发中...',
      model: selectedModelId,
      lanes: cloneLanesForStorage(lanes),
      createdAt: now,
      updatedAt: now,
      isRunning: false,
      isDraft: true,
    };
    const nextList = [draft, ...historyList];
    persistHistory(nextList, historyCounter, draft.id);
    setPendingHistoryId(draft.id);
    pendingHistoryIdRef.current = draft.id;
    return draft.id;
  }, [historyCounter, historyList, lanes, selectedModelId]);

  const handleSendFromUI = useCallback(
    (text: string, images: string[] = []) => {
      ensurePendingHistoryId();
      setQueueStartAt(Date.now());
      return handleSend(text, images);
    },
    [ensurePendingHistoryId, handleSend]
  );

  const handleOpenTool = useCallback((tool: ToolView) => {
    setActiveTool(tool);
    setIsSidebarOpen(false);
    setIsHistoryPanelOpen(false);
  }, []);

  const resolveAutoHistoryName = (currentName: string, sequenceNumber: number, laneCount: number) => {
    if ((currentName || '').startsWith('等待并发中')) {
      return `并发V${sequenceNumber}-${laneCount}`;
    }
    const match = (currentName || '').match(AUTO_HISTORY_NAME_RE);
    if (match) {
      return `并发V${sequenceNumber}-${laneCount}`;
    }
    return currentName;
  };

  const hydrateImagesAcrossLanes = (ls: LaneState[]) => {
    const getImagesFromMessage = (m: any): string[] => {
      if (Array.isArray(m.images) && m.images.length > 0) return m.images.filter(Boolean);
      if (m.image) return [m.image];
      return [];
    };

    const imagesByMessageId = new Map<string, string[]>();
    for (const lane of ls) {
      for (const msg of lane.messages || []) {
        if (msg.role !== Role.USER) continue;
        const imgs = getImagesFromMessage(msg);
        if (imgs.length > 0 && !imagesByMessageId.has(msg.id)) {
          imagesByMessageId.set(msg.id, imgs);
        }
      }
    }

    return ls.map((lane) => ({
      ...lane,
      isThinking: false,
      messages: (lane.messages || []).map((m) => {
        const cloned = { ...m } as any;
        if (cloned.role !== Role.USER) return cloned;
        const currentImgs = getImagesFromMessage(cloned);
        const hydrated = currentImgs.length > 0 ? currentImgs : imagesByMessageId.get(cloned.id) || [];
        if (hydrated.length > 1) {
          cloned.images = hydrated;
          cloned.image = undefined;
        } else if (hydrated.length === 1) {
          cloned.image = hydrated[0];
          cloned.images = undefined;
        } else {
          cloned.images = undefined;
        }
        return cloned;
      }),
    }));
  };

  const cloneHydratedLanes = (ls: LaneState[]) => hydrateImagesAcrossLanes(cloneLanes(ls));

  const createHistoryFromCurrent = (): LaneHistoryItem | null => {
    const counter = historyCounter + 1;
    const msgCount = summarizeLaneMessagesCount(lanes);
    const laneCount = lanes.length;
    if (msgCount === 0) return null;
    const sessionModel = lanes[0]?.model || selectedModelId;
    return {
      id: uuidv4(),
      name: `并发V${counter}-${laneCount}`,
      sequenceNumber: counter,
      model: sessionModel,
      lanes: cloneLanesForStorage(lanes),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isRunning: computeIsGeneratingFromLanes(lanes),
    };
  };

  const makeHistorySyncKey = (ls: LaneState[], modelId: string, isGenerating: boolean) => {
    const laneKey = ls
      .map((lane) => {
        const last = lane.messages?.[lane.messages.length - 1];
        const lastId = last?.id || '';
        const lastLen = typeof last?.text === 'string' ? last.text.length : 0;
        const prog = typeof lane.progress === 'number' ? lane.progress : '';
        const err = lane.errorCode || '';
        const hasErr = lane.error ? '1' : '0';
        const laneModel =
          typeof (lane as any).model === 'string'
            ? (lane as any).model
            : (lane as any).model && typeof (lane as any).model === 'object' && typeof (lane as any).model.id !== 'undefined'
            ? String((lane as any).model.id)
            : String((lane as any).model ?? '');
        return `${lane.id}|${laneModel}|${lane.messages.length}|${lastId}|${lastLen}|${prog}|${err}|${hasErr}`;
      })
      .join(';;');

    return `${modelId}|${isGenerating ? '1' : '0'}|${ls.length}|${laneKey}`;
  };

  // 当有消息且正在生成时，插入/同步 pending 记录（支持草稿占位）
  // Sync the live session into its bound history item.
  // - Keeps the same history id across multiple messages (no new history created).
  // - Throttles writes while generating to avoid excessive localStorage churn.
  useEffect(() => {
    const now = Date.now();
    const hasMessages = summarizeLaneMessagesCount(lanes) > 0;
    const isGenerating = computeIsGeneratingFromLanes(lanes);

    if (pendingHistoryId) {
      const item = historyList.find((h) => h.id === pendingHistoryId);
      if (!item) return;

      // Draft placeholder (no messages yet): keep it, but reflect lane/model changes.
      if (item.isDraft && !hasMessages) {
        const shouldUpdateDraft =
          item.model !== selectedModelId || (item.lanes?.length || 0) !== lanes.length;
        if (shouldUpdateDraft) {
          const draftSyncKey = makeHistorySyncKey(lanes, selectedModelId, isGenerating);
          if (historySyncKeyRef.current[pendingHistoryId] === draftSyncKey) {
            return;
          }
          historySyncKeyRef.current[pendingHistoryId] = draftSyncKey;

          const updatedList = historyList.map((h) =>
            h.id === pendingHistoryId
              ? { ...h, model: selectedModelId, lanes: cloneLanesForStorage(lanes), updatedAt: now }
              : h
          );
          persistHistory(updatedList);
        }
        return;
      }

      if (!hasMessages) {
        // Remove empty non-draft records and clear the session binding.
        const newList = historyList.filter((h) => h.id !== pendingHistoryId);
        persistHistory(newList, undefined, activeHistoryId === pendingHistoryId ? null : activeHistoryId);
        setPendingHistoryId(null);
        pendingHistoryIdRef.current = null;
        return;
      }

      // Assign sequence number once, when the first run finishes.
      let nextCounter: number | undefined;
      let sequenceNumber = item.sequenceNumber;
      if (!sequenceNumber && !isGenerating) {
        sequenceNumber = historyCounter + 1;
        nextCounter = sequenceNumber;
      }

      const minIntervalMs = isGenerating ? 900 : 0;
      const shouldWriteNow =
        !isGenerating ||
        item.isDraft ||
        Boolean(item.isRunning) !== isGenerating ||
        now - lastHistorySyncAtRef.current >= minIntervalMs;

      if (!shouldWriteNow) return;
      lastHistorySyncAtRef.current = now;

      const effectiveSequence = sequenceNumber || item.sequenceNumber || 0;
      const nextName =
        effectiveSequence > 0
          ? resolveAutoHistoryName(item.name, effectiveSequence, lanes.length)
          : item.name;

      const updatedItem: LaneHistoryItem = {
        ...item,
        name: nextName,
        sequenceNumber: effectiveSequence || item.sequenceNumber,
        model: selectedModelId,
        lanes: cloneLanesForStorage(lanes),
        updatedAt: now,
        isRunning: isGenerating,
        isDraft: false,
      };

      const syncKey = makeHistorySyncKey(lanes, selectedModelId, isGenerating);
      if (historySyncKeyRef.current[pendingHistoryId] === syncKey) {
        return;
      }
      historySyncKeyRef.current[pendingHistoryId] = syncKey;

      const updatedList = historyList.map((h) => (h.id === pendingHistoryId ? updatedItem : h));
      persistHistory(updatedList, nextCounter);
      return;
    }

    // No bound history id yet: if we're generating with messages, create a placeholder entry.
    if (hasMessages && isGenerating) {
      const temp: LaneHistoryItem = {
        id: uuidv4(),
        name: '等待并发中...',
        model: selectedModelId,
        lanes: cloneLanesForStorage(lanes),
        createdAt: now,
        updatedAt: now,
        isRunning: true,
      };
      persistHistory([temp, ...historyList], historyCounter, temp.id);
      setPendingHistoryId(temp.id);
      pendingHistoryIdRef.current = temp.id;
    }
  }, [lanes, pendingHistoryId, historyList, historyCounter, selectedModelId, activeHistoryId]);

  // 当 pending 任务完成时，更新为正式历史；草稿占位在无消息时不移除
  const loadHistoryItem = (id: string) => {
    setHasEnteredSession(false);
    const item = historyList.find((h) => h.id === id);
    if (!item) return;

    // Update active selection in history list.
    persistHistory(historyList, undefined, id);

    // Selecting current live session returns to live without interrupting generation.
    if (pendingHistoryId && id === pendingHistoryId) {
      if (summarizeLaneMessagesCount(lanes) === 0) {
        setHasEnteredSession(true);
      }
      setIsViewingHistory(false);
      setViewingLanes(null);
      setViewingActiveLaneId(null);
      return;
    }

    if (item.isRunning) {
      setIsViewingHistory(true);
      const lanesClone = cloneHydratedLanes(item.lanes).map((lane) => ({ ...lane, isThinking: true }));
      setViewingLanes(lanesClone);
      setViewingActiveLaneId(lanesClone[0]?.id ?? null);
      return;
    }

    const isGenerating = computeIsGeneratingFromLanes(lanes);
    if (isGenerating) {
      // While generating, allow viewing other history without cutting off the live session.
      setIsViewingHistory(true);
      const lanesClone = cloneHydratedLanes(item.lanes);
      setViewingLanes(lanesClone);
      setViewingActiveLaneId(lanesClone[0]?.id ?? null);
      return;
    }

    const isVideoHistory = (item.lanes || []).some((l) => hasModelModalityById(l.model, 'video'));
    if (isVideoHistory) {
      // Video histories are view-only; they don't support multi-turn chat by default.
      setIsViewingHistory(true);
      const lanesClone = cloneHydratedLanes(item.lanes);
      setViewingLanes(lanesClone);
      setViewingActiveLaneId(lanesClone[0]?.id ?? null);
      return;
    }

    // Not generating: resume the selected history into the live session (continue chat with context).
    setIsViewingHistory(false);
    setViewingLanes(null);
    setViewingActiveLaneId(null);

    const hydrated = cloneHydratedLanes(item.lanes);
    startNewChat(hydrated, true);
    setHasStartedChat(hydrated.some((l) => (l.messages || []).length > 0));
    if (hydrated[0]) {
      setActiveLaneId(hydrated[0].id);
    }
    setPendingHistoryId(id);
    pendingHistoryIdRef.current = id;
  };

  useEffect(() => {
    if (!isViewingHistory) return;
    if (!activeHistoryId) return;
    if (pendingHistoryId && activeHistoryId === pendingHistoryId) return;

    const item = historyList.find((h) => h.id === activeHistoryId);
    if (!item) return;
    const lanesClone = cloneHydratedLanes(item.lanes).map((lane) =>
      item.isRunning ? { ...lane, isThinking: true } : lane
    );
    setViewingLanes(lanesClone);
    setViewingActiveLaneId((prev) =>
      prev && lanesClone.some((l) => l.id === prev) ? prev : lanesClone[0]?.id ?? null
    );
  }, [activeHistoryId, historyList, isViewingHistory, pendingHistoryId]);

  const handleToggleHistory = () => {
    if (isHistoryPanelOpen) {
      setIsHistoryPanelOpen(false);
      return;
    }
    setIsHistoryPanelOpen(true);
    setIsSidebarOpen(true);
  };

  const handleStartNewChat = (overrideModelId?: string) => {
    setHasEnteredSession(false);
    if (isViewingHistory) {
      setIsViewingHistory(false);
      setViewingLanes(null);
      setViewingActiveLaneId(null);
    }

    const hasMessages = summarizeLaneMessagesCount(lanes) > 0;
    const nextModelId =
      typeof overrideModelId === 'string' && overrideModelId.trim().length > 0
        ? overrideModelId
        : selectedModelId;
    const latestItem = historyList[0];
    const currentAlreadySaved =
      latestItem &&
      activeHistoryId &&
      latestItem.id === activeHistoryId &&
      !latestItem.isDraft;

    let baseList = historyList;
    let baseCounter = historyCounter;

    const now = Date.now();

    // Before switching to a new chat, snapshot the current live session into its bound history item
    // so finished videos/images won't be lost and "running" flags won't become stale.
    if (pendingHistoryId) {
      const currentItem = baseList.find((h) => h.id === pendingHistoryId);
      if (currentItem) {
        const snapshotLanes = cloneLanesForStorage(lanes);
        const isGeneratingNow = computeIsGeneratingFromLanes(lanes);

        const seq = currentItem.sequenceNumber || 0;
        const nextName = seq > 0 ? resolveAutoHistoryName(currentItem.name, seq, snapshotLanes.length) : currentItem.name;

        baseList = baseList.map((h) =>
          h.id === pendingHistoryId
            ? {
                ...h,
                name: nextName,
                lanes: snapshotLanes,
                updatedAt: now,
                isRunning: isGeneratingNow,
                isDraft: summarizeLaneMessagesCount(lanes) > 0 ? false : h.isDraft,
              }
            : h
        );
      }
    }

    if (hasMessages && !pendingHistoryId && !currentAlreadySaved) {
      const newHistory = createHistoryFromCurrent();
      if (newHistory) {
        baseCounter = historyCounter + 1;
        baseList = [newHistory, ...baseList];
      }
    }

    if (pendingHistoryId) {
      const pendingItem = baseList.find((h) => h.id === pendingHistoryId);
      const pendingMsgCount = pendingItem ? summarizeLaneMessagesCount(pendingItem.lanes || []) : 0;
      if (pendingItem?.isDraft && pendingMsgCount === 0) {
        baseList = baseList.filter((h) => h.id !== pendingHistoryId);
      }
    }

    setIsSidebarOpen(true);
    const count = Math.max(1, Math.min(laneCountLimit, parseInt(laneCountInput, 10) || lanes.length || 2));
    const newLanes: LaneState[] = [];
    for (let i = 0; i < count; i++) {
      newLanes.push(createDefaultLane(uuidv4(), nextModelId, i + 1));
    }
    startNewChat(newLanes, false);
    if (newLanes[0]) setActiveLaneId(newLanes[0].id);

    const draft: LaneHistoryItem = {
      id: uuidv4(),
      name: '等待并发中...',
      model: nextModelId,
      lanes: cloneLanesForStorage(newLanes),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isRunning: false,
      isDraft: true,
    };
    const nextList = [draft, ...baseList];
    persistHistory(nextList, baseCounter, draft.id);
    setPendingHistoryId(draft.id);
    pendingHistoryIdRef.current = draft.id;
  };

  const renameHistory = (id: string, name: string) => {
    const newList = historyList.map((h) => (h.id === id ? { ...h, name, updatedAt: Date.now() } : h));
    persistHistory(newList, undefined, activeHistoryId);
  };

  const deleteHistory = (id: string) => {
    const newList = historyList.filter((h) => h.id !== id);
    const newActive = activeHistoryId === id ? null : activeHistoryId;
    persistHistory(newList, undefined, newActive);
    if (pendingHistoryId === id) {
      setPendingHistoryId(null);
      pendingHistoryIdRef.current = null;
    }
    void deleteImageCacheByHistoryId(id);
  };

  const clearHistory = () => {
    persistHistory([], 0, null);
    setPendingHistoryId(null);
    pendingHistoryIdRef.current = null;
    void clearImageCache();
  };

  return (
    <>
    <div className="app-shell flex h-screen bg-white dark:bg-gray-900 overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        language={language}
        setLanguage={setLanguage}
        fontSize={fontSize}
        setFontSize={setFontSize}
        downloadProxyUrl={downloadProxyUrl}
        setDownloadProxyUrl={setDownloadProxyUrl}
        timelineAudioSplitEnabled={timelineAudioSplitEnabled}
        setTimelineAudioSplitEnabled={setTimelineAudioSplitEnabled}
        concurrencyIntervalSec={concurrencyIntervalSec}
        setConcurrencyIntervalSec={setConcurrencyIntervalSec}
        isStreamEnabled={isStreamEnabled}
        setIsStreamEnabled={setIsStreamEnabled}
        apiMode={apiMode}
        setApiMode={setApiMode}
        openaiApiKey={openaiApiKey}
        setOpenaiApiKey={setOpenaiApiKey}
        geminiApiKey={geminiApiKey}
        setGeminiApiKey={setGeminiApiKey}
        openaiApiUrl={openaiApiUrl}
        setOpenaiApiUrl={setOpenaiApiUrl}
        geminiApiUrl={geminiApiUrl}
        setGeminiApiUrl={setGeminiApiUrl}
        geminiCustomBaseEnabled={geminiCustomBaseEnabled}
        setGeminiCustomBaseEnabled={setGeminiCustomBaseEnabled}
        geminiEnterpriseEnabled={geminiEnterpriseEnabled}
        setGeminiEnterpriseEnabled={setGeminiEnterpriseEnabled}
        geminiEnterpriseProjectId={geminiEnterpriseProjectId}
        setGeminiEnterpriseProjectId={setGeminiEnterpriseProjectId}
        geminiEnterpriseLocation={geminiEnterpriseLocation}
        setGeminiEnterpriseLocation={setGeminiEnterpriseLocation}
        geminiEnterpriseToken={geminiEnterpriseToken}
        setGeminiEnterpriseToken={setGeminiEnterpriseToken}
        availableModels={availableModels}
        setAvailableModels={setAvailableModels}
        devExperimentalEnabled={devExperimentalEnabled}
        setDevExperimentalEnabled={setDevExperimentalEnabled}
        laneCountLimit={laneCountLimit}
        setLaneCountLimit={setLaneCountLimit}
        historyButtonEnabled={historyButtonEnabled}
        setHistoryButtonEnabled={setHistoryButtonEnabled}
        moreImagesEnabled={moreImagesEnabled}
        setMoreImagesEnabled={setMoreImagesEnabled}
        sora2piEnabled={sora2piEnabled}
        setSora2piEnabled={setSora2piEnabled}
        roleCardsEnabled={roleCardsEnabled}
        setRoleCardsEnabled={setRoleCardsEnabled}
        roleCards={roleCards}
        setRoleCards={setRoleCards}
        devTbd1Enabled={devTbd1Enabled}
        setDevTbd1Enabled={setDevTbd1Enabled}
        devTbd2Enabled={devTbd2Enabled}
        setDevTbd2Enabled={setDevTbd2Enabled}
        devFuture1Enabled={devFuture1Enabled}
        setDevFuture1Enabled={setDevFuture1Enabled}
        devFuture2Enabled={devFuture2Enabled}
        setDevFuture2Enabled={setDevFuture2Enabled}
        devFuture3Enabled={devFuture3Enabled}
        setDevFuture3Enabled={setDevFuture3Enabled}
        laneLimitUnlocked={laneLimitUnlocked}
        setLaneLimitUnlocked={setLaneLimitUnlocked}
        relays={relays}
        setRelays={setRelays}
        activeRelayId={activeRelayId}
        setActiveRelayId={setActiveRelayId}
        relayEnabled={relayEnabled}
        setRelayEnabled={setRelayEnabled}
        geminiKeys={geminiKeys}
        setGeminiKeys={setGeminiKeys}
        geminiKeyPoolEnabled={geminiKeyPoolEnabled}
        setGeminiKeyPoolEnabled={setGeminiKeyPoolEnabled}
        todayConcurrencyCount={todayConcurrencyCount}
        totalConcurrencyCount={totalConcurrencyCount}
        downloadDirectorySupported={downloadDirectorySupported}
        downloadDirectoryName={downloadDirectoryName}
        onPickDownloadDirectory={handlePickDownloadRoot}
        onClearDownloadDirectory={handleClearDownloadRoot}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isGridMode={isGridMode}
        activeLane={activeLane}
        lanes={lanes}
        language={language}
        fontSize={fontSize}
        availableModels={visibleModels}
        downloadProxyUrl={downloadProxyUrl}
        cacheHistoryId={cacheHistoryId}
        concurrencyIntervalSec={concurrencyIntervalSec}
        queueStartAt={queueStartAt}
        onStartNewChat={handleStartNewChat}
        onRemoveLane={removeLane}
        onModelChange={updateModel}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTool={handleOpenTool}
        showHistory={isHistoryPanelOpen}
        historyList={historyList}
        activeHistoryId={activeHistoryId}
        onSelectHistory={loadHistoryItem}
        onRenameHistory={renameHistory}
        onDeleteHistory={deleteHistory}
      />

      <div
        className={`app-shell flex-1 flex flex-col h-full transition-all duration-300 ${
          isSidebarOpen ? (isGridMode ? 'md:ml-[340px]' : 'md:ml-[260px]') : ''
        } relative bg-white dark:bg-gray-900`}
      >
        <TopBar
          language={language}
          isSidebarOpen={isSidebarOpen}
          isGridMode={isGridMode}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
          availableModels={visibleModels}
          selectedModelId={selectedModelId}
          onSelectModel={(id) => {
            if (!id || id === selectedModelId) return;
            const hasMessages = summarizeLaneMessagesCount(lanes) > 0;
            setSelectedModelId(id);
            if (!isViewingHistory && hasMessages) {
              handleStartNewChat(id);
              return;
            }
            setAllModels(id);
          }}
          confirmAndClearChats={() => setShowClearConfirm(true)}
          showHistoryButton={historyButtonEnabled}
          isHistoryOpen={isHistoryPanelOpen}
          onToggleHistory={handleToggleHistory}
          modelModalityFilter={modelModalityFilter}
          onToggleModelModalityFilter={setModelModalityFilter}
          apiMode={apiMode}
          setApiMode={setApiMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isFullView={isFullView}
          onToggleFullView={() => {
            if (!displayActiveLaneId && displayLanes[0]) {
              setDisplayActiveLaneId(displayLanes[0].id);
            }
            if (!isFullView) {
              setIsSidebarOpen(false);
              setIsHistoryPanelOpen(false);
              setIsInputCollapsed(true);
            }
            setIsFullView((v) => !v);
          }}
        />

        <main className="app-shell flex-1 overflow-hidden relative flex flex-col bg-white dark:bg-gray-900">
          {apiMode === 'gemini' && (
            <GeminiImagePanel
              language={language}
              isOpen={isGeminiPanelOpen}
              onToggle={() => setIsGeminiPanelOpen((v) => !v)}
              settings={geminiImageSettings}
              onChange={setGeminiImageSettings}
            />
          )}
          {!displayHasStartedChat ? (
            <>
            <EmptyState language={language} onOpenTool={handleOpenTool} />
	              <div
                  className={`app-input-panel z-20 ${
                    isInputCollapsed
                      ? 'px-4 py-2 bg-transparent border-t border-gray-500/70 dark:border-gray-600/70'
                      : 'p-4 pb-6 bg-white dark:bg-gray-900'
                  }`}
                >
                  <ChatInput
	                  onSend={handleSendFromUI}
	                  language={language}
	                  isGenerating={isGenerating}
	                  inputDisabled={chatInputDisabled}
	                  inputDisabledHint={chatInputDisabledHint}
                    onOpenTool={handleOpenTool}
	                  laneCountInput={laneCountInput}
	                  updateLaneCount={handleLaneCountChange}
	                  laneLocked={laneLocked}
	                  onToggleLaneLock={() => setLaneLocked((v) => !v)}
                    isCollapsed={isInputCollapsed}
                    onCollapseChange={setIsInputCollapsed}
                    isFullView={isFullView}
                    laneNavItems={laneNavItems}
                    onSelectLane={(id) => setDisplayActiveLaneId(id)}
                    isMultiLaneLayout={lanes.length > 1}
                    showBulkDownload={showBulkDownload}
                    bulkDownloadDisabled={bulkDownloadDisabled}
                    bulkDownloadLoading={bulkDownloadLoading}
                    bulkDownloadMessage={bulkDownloadMessage || undefined}
                    bulkDownloadMessageTone={bulkDownloadMessageTone}
                    onBulkDownload={handleBulkDownloadImages}
                    showStopQueue={showStopQueue}
                    onStopQueue={() => cancelQueuedLanes()}
                    onStopGenerating={() => stopCurrentRun()}
  	                  showRelaySelect={showRelaySelect}
	                  relays={enabledRelays}
	                  activeRelayId={activeRelayId}
	                  onSelectRelay={(id) => {
                      if (id === activeRelayId) return;
                      const hasMessages = summarizeLaneMessagesCount(lanes) > 0;
                      setActiveRelayId(id);
                      if (!isViewingHistory && hasMessages) {
                        handleStartNewChat();
                      }
                    }}
                    showKeyRotationButton={
                      apiMode === 'gemini' && geminiKeyPoolEnabled && !effectiveGeminiEnterpriseEnabled
                    }
                    keyRotationEnabled={geminiKeyRotationEnabled}
                    onToggleKeyRotation={() => setGeminiKeyRotationEnabled((v) => !v)}
  	                  moreImagesEnabled={moreImagesEnabled}
                    roleCardsEnabled={roleCardsEnabled}
                    roleCards={roleCards}
  	                  showEnterpriseButton={apiMode === 'gemini' && enterpriseFeatureEnabled && geminiEnterpriseReady}
  	                  enterpriseEnabled={effectiveGeminiEnterpriseEnabled}
  	                  onToggleEnterpriseEnabled={() => setGeminiEnterpriseEnabled((v) => !v)}
  	                />
	              </div>
            </>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-hidden relative">
                {isFullView && fullViewLane ? (
                  <div className="h-full overflow-y-auto p-4 md:p-6">
	                  <ChatColumn
	                    lane={fullViewLane}
	                    onRemove={canEditDisplay ? removeLane : () => {}}
	                    onModelChange={canEditDisplay ? updateModel : () => {}}
	                    isMultiLane={false}
	                    fullWidth
	                    isFullView
	                    showPreviewToggle={showLanePreviewToggle}
	                    isPreviewActive={isFullView}
	                    onTogglePreview={() => handleLanePreviewToggle(fullViewLane.id)}
	                    downloadProxyUrl={downloadProxyUrl}
	                    cacheHistoryId={cacheHistoryId}
	                    cacheLaneId={fullViewLane.id}
	                    fontSize={fontSize}
	                    language={language}
	                    laneIndex={fullViewLaneIndex}
	                    concurrencyIntervalSec={concurrencyIntervalSec}
	                    queueStartAt={queueStartAt}
	                    availableModels={visibleModels}
	                  />
                  </div>
                ) : isGridMode ? (
                  <div className="h-full p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                      {displayLanes.map((lane, laneIndex) => (
                        <ChatGridItem
                          key={lane.id}
                          lane={lane}
                          laneIndex={laneIndex}
                          concurrencyIntervalSec={concurrencyIntervalSec}
                          queueStartAt={queueStartAt}
                          language={language}
                          isActive={displayActiveLaneId === lane.id}
                          onClick={() => {
                            setDisplayActiveLaneId(lane.id);
                            if (!isSidebarOpen) setIsSidebarOpen(true);
                          }}
                          onDoubleClick={() => {
                            setDisplayActiveLaneId(lane.id);
                            setIsHistoryPanelOpen(false);
                            setIsSidebarOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full overflow-x-auto snap-x snap-mandatory divide-x divide-gray-100 dark:divide-gray-800 scrollbar-hide">
                    {displayLanes.map((lane, idx) => (
                      <div
                        key={lane.id}
                        className={`flex-none h-full snap-center ${
                          displayLanes.length === 1
                            ? 'w-full'
                            : displayLanes.length === 2
                            ? 'w-full md:w-1/2'
                            : 'w-full md:w-1/2 lg:w-1/3'
                        }`}
                        onClick={() => setDisplayActiveLaneId(lane.id)}
                      >
	                        <ChatColumn
	                          lane={lane}
	                          onRemove={canEditDisplay ? removeLane : () => {}}
	                          onModelChange={canEditDisplay ? updateModel : () => {}}
	                          isMultiLane={displayLanes.length > 1}
	                          fontSize={fontSize}
	                          language={language}
	                          laneIndex={idx}
	                          concurrencyIntervalSec={concurrencyIntervalSec}
	                          queueStartAt={queueStartAt}
	                          showPreviewToggle={showLanePreviewToggle}
	                          isPreviewActive={isFullView && fullViewLane?.id === lane.id}
	                          onTogglePreview={() => handleLanePreviewToggle(lane.id)}
	                          downloadProxyUrl={downloadProxyUrl}
	                          cacheHistoryId={cacheHistoryId}
	                          cacheLaneId={lane.id}
                          availableModels={visibleModels}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                className={`app-input-panel z-20 ${
                  isInputCollapsed
                    ? 'px-4 py-2 bg-transparent border-t border-gray-500/70 dark:border-gray-600/70'
                    : 'p-4 pb-6 bg-white dark:bg-gray-900'
                } ${isFullView ? '' : 'border-t border-gray-100 dark:border-gray-800'}`}
              >
                <ChatInput
	                onSend={handleSendFromUI}
	                language={language}
	                isGenerating={isGenerating}
	                inputDisabled={chatInputDisabled}
	                inputDisabledHint={chatInputDisabledHint}
                  onOpenTool={handleOpenTool}
	                laneCountInput={laneCountInput}
	                updateLaneCount={handleLaneCountChange}
	                laneLocked={laneLocked}
	                onToggleLaneLock={() => setLaneLocked((v) => !v)}
                  isCollapsed={isInputCollapsed}
                  onCollapseChange={setIsInputCollapsed}
                  isFullView={isFullView}
                  laneNavItems={laneNavItems}
                  onSelectLane={(id) => setDisplayActiveLaneId(id)}
                  isMultiLaneLayout={displayLanes.length > 1}
                  showBulkDownload={showBulkDownload}
                  bulkDownloadDisabled={bulkDownloadDisabled}
                  bulkDownloadLoading={bulkDownloadLoading}
                  bulkDownloadMessage={bulkDownloadMessage || undefined}
                  bulkDownloadMessageTone={bulkDownloadMessageTone}
                  onBulkDownload={handleBulkDownloadImages}
                  showStopQueue={showStopQueue}
                  onStopQueue={() => cancelQueuedLanes()}
                  onStopGenerating={() => stopCurrentRun()}
                  showRelaySelect={showRelaySelect}
	                  relays={enabledRelays}
	                  activeRelayId={activeRelayId}
	                  onSelectRelay={(id) => {
                      if (id === activeRelayId) return;
                      const hasMessages = summarizeLaneMessagesCount(lanes) > 0;
                      setActiveRelayId(id);
                      if (!isViewingHistory && hasMessages) {
                        handleStartNewChat();
                      }
                    }}
                    showKeyRotationButton={
                      apiMode === 'gemini' && geminiKeyPoolEnabled && !effectiveGeminiEnterpriseEnabled
                    }
                    keyRotationEnabled={geminiKeyRotationEnabled}
                    onToggleKeyRotation={() => setGeminiKeyRotationEnabled((v) => !v)}
	                  moreImagesEnabled={moreImagesEnabled}
                    roleCardsEnabled={roleCardsEnabled}
                    roleCards={roleCards}
	                  showEnterpriseButton={apiMode === 'gemini' && enterpriseFeatureEnabled && geminiEnterpriseReady}
	                  enterpriseEnabled={effectiveGeminiEnterpriseEnabled}
	                  onToggleEnterpriseEnabled={() => setGeminiEnterpriseEnabled((v) => !v)}
	                />
	              </div>
            </div>
          )}
        </main>
      </div>
    </div>
    <PromptLibraryModal
      isOpen={activeTool === 'promptLibrary'}
      language={language}
      onClose={() => setActiveTool(null)}
    />
    <ImageSlicerModal
      isOpen={activeTool === 'slicer'}
      language={language}
      onClose={() => setActiveTool(null)}
    />
    <StoryboardDesignModal
      isOpen={activeTool === 'storyboard'}
      language={language}
      apiMode={apiMode}
      availableModels={availableModels}
      roleCardsEnabled={roleCardsEnabled}
      roleCards={roleCards}
      showRelaySelect={showRelaySelect}
      relays={enabledRelays}
      activeRelayId={activeRelayId}
      onSelectRelay={(id) => {
        if (id === activeRelayId) return;
        setActiveRelayId(id);
      }}
      openaiApiKey={effectiveOpenaiKey}
      openaiApiUrl={effectiveOpenaiUrl}
      geminiApiKey={geminiApiKey}
      geminiApiUrl={effectiveGeminiUrl}
      geminiImageSettings={geminiImageSettings}
      geminiEnterpriseEnabled={effectiveGeminiEnterpriseEnabled}
      geminiEnterpriseProjectId={geminiEnterpriseProjectId}
      geminiEnterpriseLocation={geminiEnterpriseLocation}
      geminiEnterpriseToken={geminiEnterpriseToken}
      onClose={() => setActiveTool(null)}
    />
    <VideoFrameModal
      isOpen={activeTool === 'videoFrames'}
      language={language}
      onClose={() => setActiveTool(null)}
    />
    <QuickTimelineModal
      isOpen={activeTool === 'timeline'}
      language={language}
      downloadProxyUrl={downloadProxyUrl}
      timelineAudioSplitEnabled={timelineAudioSplitEnabled}
      onClose={() => setActiveTool(null)}
    />
    <XhsLabModal
      isOpen={activeTool === 'xhs'}
      language={language}
      apiMode={apiMode}
      availableModels={availableModels}
      openaiApiKey={effectiveOpenaiKey}
      openaiApiUrl={effectiveOpenaiUrl}
      geminiApiKey={geminiApiKey}
      geminiApiUrl={effectiveGeminiUrl}
      geminiEnterpriseEnabled={effectiveGeminiEnterpriseEnabled}
      geminiEnterpriseProjectId={geminiEnterpriseProjectId}
      geminiEnterpriseLocation={geminiEnterpriseLocation}
      geminiEnterpriseToken={geminiEnterpriseToken}
      geminiKeyPoolEnabled={geminiKeyPoolEnabled}
      geminiKeyRotationEnabled={geminiKeyRotationEnabled}
      geminiKeys={geminiKeys}
      onClose={() => setActiveTool(null)}
    />
    {showClearConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-[90%] max-w-md p-6 space-y-4 border border-gray-200 dark:border-gray-800">
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {language === 'zh' ? '确认清空所有对话和历史记录？' : 'Clear all chats and history?'}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {language === 'zh'
              ? '此操作会删除本页的所有会话与历史记录，且不可撤销。'
              : 'This will delete all conversations and history on this page. This cannot be undone.'}
          </div>
          <div className="flex justify-end gap-3">
            <button
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setShowClearConfirm(false)}
            >
              {language === 'zh' ? '取消' : 'Cancel'}
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                clearAllChats();
                clearHistory();
                setShowClearConfirm(false);
              }}
            >
              {language === 'zh' ? '确定' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default App;
