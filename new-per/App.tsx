import React, { useState, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChatColumn } from './components/ChatColumn';
import { ChatGridItem } from './components/ChatGridItem';
import { ChatInput } from './components/ChatInput';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { EmptyState } from './components/EmptyState';
import { TopBar } from './components/TopBar';
import { useSettings } from './hooks/useSettings';
import { useLanes } from './hooks/useLanes';
import { LaneHistoryItem } from './utils/history';
import { loadHistory, saveHistory, loadCounter, saveCounter, loadActiveHistoryId, saveActiveHistoryId } from './utils/history';
import { LaneState, ModelModality, Role } from './types';
import { createDefaultLane } from './utils/lane';
import { safeStorageGet, safeStorageSet } from './utils/storage';

const App: React.FC = () => {
  const defaultApiKey = '';
  const defaultApiUrl = '';

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [historyList, setHistoryList] = useState<LaneHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [historyCounter, setHistoryCounter] = useState<number>(0);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [pendingHistoryId, setPendingHistoryId] = useState<string | null>(null);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [viewingLanes, setViewingLanes] = useState<LaneState[] | null>(null);
  const [viewingActiveLaneId, setViewingActiveLaneId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [laneLocked, setLaneLocked] = useState(() => safeStorageGet('sora_lane_locked') === '1');
  const [isFullView, setIsFullView] = useState(false);
  const [modelModalityFilter, setModelModalityFilter] = useState<ModelModality | null>(null);

  const {
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
    selectedModelId,
    setSelectedModelId,
    devExperimentalEnabled,
    setDevExperimentalEnabled,
    devTbd1Enabled,
    setDevTbd1Enabled,
    devTbd2Enabled,
    setDevTbd2Enabled,
    historyButtonEnabled,
    setHistoryButtonEnabled,
    moreImagesEnabled,
    setMoreImagesEnabled,
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
  } = useSettings({ defaultApiKey, defaultApiUrl });

  const enabledRelays = relayEnabled ? relays.filter((r) => r.enabled) : [];
  const activeRelay = relayEnabled ? enabledRelays.find((r) => r.id === activeRelayId) : undefined;
  const effectiveOpenaiKey = activeRelay?.apiKey || openaiApiKey;
  const effectiveOpenaiUrl = activeRelay?.apiUrl || openaiApiUrl;
  const showRelaySelect = apiMode === 'openai' && relayEnabled && enabledRelays.length > 0;

  const enabledGeminiKeys = geminiKeysEnabled ? geminiKeys.filter((k) => k.enabled) : [];
  const activeGeminiKey = geminiKeysEnabled ? enabledGeminiKeys.find((k) => k.id === activeGeminiKeyId) : undefined;
  const effectiveGeminiKey = activeGeminiKey?.apiKey || geminiApiKey;
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

  const savedSession = (() => {
    const raw = safeStorageGet('sora_active_session');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { lanes: LaneState[]; activeLaneId: string | null; laneCount: number };
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
  } = useLanes({
    selectedModelId,
    availableModels,
    apiMode,
    openaiApiKey: effectiveOpenaiKey,
    geminiApiKey: effectiveGeminiKey,
    openaiApiUrl: effectiveOpenaiUrl,
    geminiApiUrl: effectiveGeminiUrl,
    geminiEnterpriseEnabled: effectiveGeminiEnterpriseEnabled,
    geminiEnterpriseProjectId,
    geminiEnterpriseLocation,
    geminiEnterpriseToken,
    isStreamEnabled,
    onRequireSidebarOpen: () => setIsSidebarOpen(true),
    initialLanes: savedSession?.lanes,
    initialActiveLaneId: savedSession?.activeLaneId ?? null,
    initialLaneCount: savedSession?.laneCount,
  });

  const displayLanes = isViewingHistory && viewingLanes ? viewingLanes : lanes;
  const displayActiveLaneId = isViewingHistory ? viewingActiveLaneId : activeLaneId;
  const displayHasStartedChat = isViewingHistory
    ? displayLanes.some((l) => l.messages.length > 0)
    : hasStartedChat;
  const isGridMode = !isFullView && displayLanes.length > 3;
  const activeLane = displayLanes.find((l) => l.id === displayActiveLaneId);
  const fullViewLane = activeLane || displayLanes[0];
  const canEditDisplay = !isViewingHistory;
  const setDisplayActiveLaneId = (id: string | null) => {
    if (isViewingHistory) {
      setViewingActiveLaneId(id);
    } else {
      setActiveLaneId(id);
    }
  };
  const todayConcurrencyCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return historyList
      .filter((h) => h.createdAt >= start.getTime())
      .reduce((sum, item) => sum + (item.lanes?.length || 0), 0);
  }, [historyList]);
  const visibleModels =
    apiMode === 'gemini'
      ? availableModels.filter((m) => m.provider === 'gemini')
      : availableModels.filter((m) => !m.provider || m.provider === 'openai');

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
    let migrated = list;
    let changed = false;
    migrated = list.map((item) => {
      const match = item.name?.match(/^并发v(\d+)-(\d+)$/);
      let next = item;

      // After refresh, nothing is actually running anymore; clear stale flags.
      if (item.isRunning || item.isDraft) {
        next = { ...next, isRunning: false, isDraft: false };
        changed = true;
      }

      if (!match) return next;
      const x = match[1];
      const laneCount = item.lanes?.length ?? 0;
      const nextName = `并发V${x}-${laneCount}`;
      if (nextName === item.name) return next;
      changed = true;
      return { ...next, name: nextName };
    });
    if (changed) {
      saveHistory(migrated);
    }
    setHistoryList(migrated);
    const counter = loadCounter();
    setHistoryCounter(counter);
    const activeId = loadActiveHistoryId();
    if (activeId) {
      setActiveHistoryId(activeId);
    }
  }, []);

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

  useEffect(() => {
    if (!geminiKeysEnabled) return;
    const enabled = geminiKeys.filter((k) => k.enabled);
    if (enabled.length === 0 && activeGeminiKeyId) {
      setActiveGeminiKeyId('');
    } else if (activeGeminiKeyId && !enabled.find((k) => k.id === activeGeminiKeyId)) {
      setActiveGeminiKeyId('');
    }
  }, [geminiKeys, geminiKeysEnabled, activeGeminiKeyId, setActiveGeminiKeyId]);

  const summarizeLaneMessagesCount = (ls: LaneState[]) => {
    return ls.reduce((acc, lane) => acc + lane.messages.length, 0);
  };

  const cloneLanes = (ls: LaneState[]) =>
    ls.map((lane) => ({
      ...lane,
      messages: lane.messages.map((m) => ({ ...m })),
    }));

  // Reduce localStorage usage: dedupe images across lanes by user message id,
  // and keep at most 1 image per user message.
  const cloneLanesForStorage = (ls: LaneState[]) => {
    const seenImageMessageIds = new Set<string>();
    return ls.map((lane) => ({
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
  };

  const createHistoryFromCurrent = (): LaneHistoryItem | null => {
    const counter = historyCounter + 1;
    const msgCount = summarizeLaneMessagesCount(lanes);
    const laneCount = lanes.length;
    if (msgCount === 0) return null;
    return {
      id: uuidv4(),
      name: `并发V${counter}-${laneCount}`,
      model: selectedModelId,
      lanes: cloneLanesForStorage(lanes),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isRunning: lanes.some((l) => l.isThinking),
    };
  };

  // 当有消息且正在生成时，插入/同步 pending 记录（支持草稿占位）
  useEffect(() => {
    const hasMessages = summarizeLaneMessagesCount(lanes) > 0;
    const isGenerating = lanes.some((l) => l.isThinking);

    if (pendingHistoryId) {
      const item = historyList.find((h) => h.id === pendingHistoryId);
      if (!item) return;

      const currentMsgCount = summarizeLaneMessagesCount(lanes);
      const storedMsgCount = summarizeLaneMessagesCount(item.lanes || []);
      const shouldUpdateDraft =
        item.isDraft &&
        !hasMessages &&
        (item.model !== selectedModelId || (item.lanes?.length || 0) !== lanes.length);

      if (shouldUpdateDraft) {
        const updatedList = historyList.map((h) =>
          h.id === pendingHistoryId
            ? { ...h, model: selectedModelId, lanes: cloneLanesForStorage(lanes), updatedAt: Date.now() }
            : h
        );
        persistHistory(updatedList);
        return;
      }

      const shouldUpdate =
        item.model !== selectedModelId ||
        storedMsgCount !== currentMsgCount ||
        (isGenerating && !item.isRunning) ||
        (item.isDraft && hasMessages);

      if (shouldUpdate) {
        const updatedItem: LaneHistoryItem = {
          ...item,
          model: selectedModelId,
          lanes: cloneLanesForStorage(lanes),
          updatedAt: Date.now(),
          isRunning: isGenerating ? true : false,
          isDraft: item.isDraft && hasMessages ? false : item.isDraft,
        };
        const updatedList = historyList.map((h) =>
          h.id === pendingHistoryId ? updatedItem : h
        );
        persistHistory(updatedList);
      }
      return;
    }

    if (hasMessages && isGenerating) {
      const temp: LaneHistoryItem = {
        id: uuidv4(),
        name: '等待并发中...',
        model: selectedModelId,
        lanes: cloneLanesForStorage(lanes),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isRunning: true,
      };
      persistHistory([temp, ...historyList], historyCounter, temp.id);
      setPendingHistoryId(temp.id);
      setActiveHistoryId(temp.id);
    }
  }, [lanes, pendingHistoryId, historyList, historyCounter, selectedModelId]);

  // 当 pending 任务完成时，更新为正式历史；草稿占位在无消息时不移除
  useEffect(() => {
    if (!pendingHistoryId) return;
    const item = historyList.find((h) => h.id === pendingHistoryId);
    if (!item) return;

    const hasMessages = summarizeLaneMessagesCount(lanes) > 0;
    const isGenerating = lanes.some((l) => l.isThinking);

    if (!hasMessages) {
      if (item.isDraft) return;
      const newList = historyList.filter((h) => h.id !== pendingHistoryId);
      persistHistory(newList, undefined, activeHistoryId === pendingHistoryId ? null : activeHistoryId);
      setPendingHistoryId(null);
      return;
    }

    if (!isGenerating) {
      const counter = historyCounter + 1;
      const updated = historyList.map((h) => {
        if (h.id !== pendingHistoryId) return h;
        return {
          ...h,
          name: `并发V${counter}-${lanes.length}`,
          model: selectedModelId,
          lanes: cloneLanesForStorage(lanes),
          updatedAt: Date.now(),
          isRunning: false,
          isDraft: false,
        };
      });
      persistHistory(updated, counter, pendingHistoryId);
      setPendingHistoryId(null);
    }
  }, [lanes, pendingHistoryId, historyList, historyCounter, activeHistoryId, selectedModelId]);

  const loadHistoryItem = (id: string) => {
    const item = historyList.find((h) => h.id === id);
    if (!item) return;

    // Update active selection in history list.
    persistHistory(historyList, undefined, id);

    // Selecting current live draft/pending returns to live session without interrupting generation.
    if (pendingHistoryId && id === pendingHistoryId) {
      setIsViewingHistory(false);
      setViewingLanes(null);
      setViewingActiveLaneId(null);
      return;
    }

    setIsViewingHistory(true);
    const lanesClone = cloneLanes(item.lanes);
    setViewingLanes(lanesClone);
    setViewingActiveLaneId(lanesClone[0]?.id ?? null);
  };

  const handleToggleHistory = () => {
    if (isHistoryPanelOpen) {
      setIsHistoryPanelOpen(false);
      if (isViewingHistory) {
        setIsViewingHistory(false);
        setViewingLanes(null);
        setViewingActiveLaneId(null);
        if (pendingHistoryId) {
          persistHistory(historyList, undefined, pendingHistoryId);
        }
      }
      return;
    }
    setIsHistoryPanelOpen(true);
    setIsSidebarOpen(true);
  };

  const handleStartNewChat = () => {
    if (isViewingHistory) {
      setIsViewingHistory(false);
      setViewingLanes(null);
      setViewingActiveLaneId(null);
    }

    const hasMessages = summarizeLaneMessagesCount(lanes) > 0;
    const latestItem = historyList[0];
    const currentAlreadySaved =
      latestItem &&
      activeHistoryId &&
      latestItem.id === activeHistoryId &&
      !latestItem.isDraft;

    let baseList = historyList;
    let baseCounter = historyCounter;

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
    const count = Math.max(1, Math.min(20, parseInt(laneCountInput, 10) || lanes.length || 2));
    const newLanes: LaneState[] = [];
    for (let i = 0; i < count; i++) {
      newLanes.push(createDefaultLane(uuidv4(), selectedModelId, i + 1));
    }
    startNewChat(newLanes, true);
    if (newLanes[0]) setActiveLaneId(newLanes[0].id);

    const draft: LaneHistoryItem = {
      id: uuidv4(),
      name: '等待并发中...',
      model: selectedModelId,
      lanes: cloneLanesForStorage(newLanes),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isRunning: false,
      isDraft: true,
    };
    const nextList = [draft, ...baseList];
    persistHistory(nextList, baseCounter, draft.id);
    setPendingHistoryId(draft.id);
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
    }
  };

  const clearHistory = () => {
    persistHistory([], 0, null);
    setPendingHistoryId(null);
  };

  return (
    <>
    <div className="flex h-screen bg-white dark:bg-gray-900 overflow-hidden font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        language={language}
        setLanguage={setLanguage}
        fontSize={fontSize}
        setFontSize={setFontSize}
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
        historyButtonEnabled={historyButtonEnabled}
        setHistoryButtonEnabled={setHistoryButtonEnabled}
        moreImagesEnabled={moreImagesEnabled}
        setMoreImagesEnabled={setMoreImagesEnabled}
        devTbd1Enabled={devTbd1Enabled}
        setDevTbd1Enabled={setDevTbd1Enabled}
        devTbd2Enabled={devTbd2Enabled}
        setDevTbd2Enabled={setDevTbd2Enabled}
        relays={relays}
        setRelays={setRelays}
        activeRelayId={activeRelayId}
        setActiveRelayId={setActiveRelayId}
        relayEnabled={relayEnabled}
        setRelayEnabled={setRelayEnabled}
        geminiKeys={geminiKeys}
        setGeminiKeys={setGeminiKeys}
        activeGeminiKeyId={activeGeminiKeyId}
        setActiveGeminiKeyId={setActiveGeminiKeyId}
        geminiKeysEnabled={geminiKeysEnabled}
        setGeminiKeysEnabled={setGeminiKeysEnabled}
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
        onStartNewChat={handleStartNewChat}
        onRemoveLane={removeLane}
        onModelChange={updateModel}
        onOpenSettings={() => setIsSettingsOpen(true)}
        showHistory={isHistoryPanelOpen}
        historyList={historyList}
        activeHistoryId={activeHistoryId}
        onSelectHistory={loadHistoryItem}
        onRenameHistory={renameHistory}
        onDeleteHistory={deleteHistory}
      />

      <div
        className={`flex-1 flex flex-col h-full transition-all duration-300 ${
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
            setSelectedModelId(id);
            setAllModels(id);
          }}
          confirmAndClearChats={() => setShowClearConfirm(true)}
          showHistoryButton={historyButtonEnabled}
          isHistoryOpen={isHistoryPanelOpen}
          onToggleHistory={handleToggleHistory}
          modelModalityFilter={modelModalityFilter}
          onToggleModelModalityFilter={setModelModalityFilter}
	          geminiKeysEnabled={geminiKeysEnabled}
	          geminiKeys={enabledGeminiKeys}
	          activeGeminiKeyId={activeGeminiKeyId}
	          onSelectGeminiKey={(id) => setActiveGeminiKeyId(id)}
	          geminiKeySelectDisabled={
              apiMode === 'gemini' && enterpriseFeatureEnabled && geminiEnterpriseEnabled && geminiEnterpriseReady
            }
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
            }
            setIsFullView((v) => !v);
          }}
          dailyConcurrencyCount={todayConcurrencyCount}
        />

        <main className="flex-1 overflow-hidden relative flex flex-col bg-white dark:bg-gray-900">
          {!displayHasStartedChat ? (
            <>
              <EmptyState language={language} onSendQuickPrompt={(text) => handleSend(text, [])} />
	              <div className="p-4 pb-6 bg-white dark:bg-gray-900 z-20">
	                <ChatInput
	                  onSend={handleSend}
	                  language={language}
	                  isGenerating={lanes.some((l) => l.isThinking)}
	                  onOpenSettings={() => setIsSettingsOpen(true)}
	                  laneCountInput={laneCountInput}
	                  updateLaneCount={handleLaneCountChange}
	                  laneLocked={laneLocked}
	                  onToggleLaneLock={() => setLaneLocked((v) => !v)}
	                  showRelaySelect={showRelaySelect}
	                  relays={enabledRelays}
	                  activeRelayId={activeRelayId}
	                  onSelectRelay={(id) => setActiveRelayId(id)}
	                  moreImagesEnabled={moreImagesEnabled}
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
                      fontSize={fontSize}
                      availableModels={visibleModels}
                    />
                  </div>
                ) : isGridMode ? (
                  <div className="h-full p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                      {displayLanes.map((lane) => (
                        <ChatGridItem
                          key={lane.id}
                          lane={lane}
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
                      >
                        <ChatColumn
                          lane={lane}
                          onRemove={canEditDisplay ? removeLane : () => {}}
                          onModelChange={canEditDisplay ? updateModel : () => {}}
                          isMultiLane={displayLanes.length > 1}
                          fontSize={fontSize}
                          availableModels={visibleModels}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                className={`p-4 pb-6 bg-white dark:bg-gray-900 z-20 ${
                  isFullView ? '' : 'border-t border-gray-100 dark:border-gray-800'
                }`}
	              >
	                <ChatInput
	                  onSend={handleSend}
	                  language={language}
	                  isGenerating={lanes.some((l) => l.isThinking)}
	                  onOpenSettings={() => setIsSettingsOpen(true)}
	                  laneCountInput={laneCountInput}
	                  updateLaneCount={handleLaneCountChange}
	                  laneLocked={laneLocked}
	                  onToggleLaneLock={() => setLaneLocked((v) => !v)}
	                  showRelaySelect={showRelaySelect}
	                  relays={enabledRelays}
	                  activeRelayId={activeRelayId}
	                  onSelectRelay={(id) => setActiveRelayId(id)}
	                  moreImagesEnabled={moreImagesEnabled}
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
