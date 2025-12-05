import React, { useState, useEffect } from "react";
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
import { LaneState } from './types';
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [laneLocked, setLaneLocked] = useState(() => safeStorageGet('sora_lane_locked') === '1');

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
    availableModels,
    setAvailableModels,
    selectedModelId,
    setSelectedModelId,
    devExperimentalEnabled,
    setDevExperimentalEnabled,
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

  const enabledGeminiKeys = geminiKeysEnabled ? geminiKeys.filter((k) => k.enabled) : [];
  const activeGeminiKey = geminiKeysEnabled ? enabledGeminiKeys.find((k) => k.id === activeGeminiKeyId) : undefined;
  const effectiveGeminiKey = activeGeminiKey?.apiKey || geminiApiKey;
  const effectiveGeminiUrl = geminiApiUrl;

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
    isStreamEnabled,
    onRequireSidebarOpen: () => setIsSidebarOpen(true),
    initialLanes: savedSession?.lanes,
    initialActiveLaneId: savedSession?.activeLaneId ?? null,
    initialLaneCount: savedSession?.laneCount,
  });

  const isGridMode = lanes.length > 3;
  const activeLane = lanes.find((l) => l.id === activeLaneId);
  const visibleModels =
    apiMode === 'gemini'
      ? availableModels.filter((m) => m.provider === 'gemini')
      : availableModels.filter((m) => !m.provider || m.provider === 'openai');

  // load history on mount
  useEffect(() => {
    const list = loadHistory();
    setHistoryList(list);
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
    try {
      safeStorageSet(
        'sora_active_session',
        JSON.stringify({ lanes, activeLaneId, laneCount: lanes.length })
      );
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

  const createHistoryFromCurrent = () => {
    const counter = historyCounter + 1;
    const msgCount = summarizeLaneMessagesCount(lanes);
    if (msgCount === 0) return null;
    const newHistory: LaneHistoryItem = {
      id: uuidv4(),
      name: `并发v${counter}-${msgCount}`,
      model: selectedModelId,
      lanes: cloneLanes(lanes),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isRunning: lanes.some((l) => l.isThinking),
    };
    const newList = [newHistory, ...historyList];
    persistHistory(newList, counter, newHistory.id);
    setPendingHistoryId(null);
    return newHistory;
  };

  // 当有消息且正在生成时，如未创建 pending 记录，则插入一条“等待并发中...”记录
  useEffect(() => {
    const hasMessages = summarizeLaneMessagesCount(lanes) > 0;
    const isGenerating = lanes.some((l) => l.isThinking);
    if (hasMessages && isGenerating && !pendingHistoryId) {
      const temp: LaneHistoryItem = {
        id: uuidv4(),
        name: '等待并发中...',
        model: selectedModelId,
        lanes: cloneLanes(lanes),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isRunning: true,
      };
      persistHistory([temp, ...historyList], historyCounter, temp.id);
      setPendingHistoryId(temp.id);
    }
  }, [lanes, pendingHistoryId, historyList, historyCounter, selectedModelId]);

  // 当 pending 任务完成时，更新为正式历史；若没有消息则移除
  useEffect(() => {
    if (!pendingHistoryId) return;
    const item = historyList.find((h) => h.id === pendingHistoryId);
    if (!item) return;

    const hasMessages = summarizeLaneMessagesCount(lanes) > 0;
    const isGenerating = lanes.some((l) => l.isThinking);

    if (!hasMessages) {
      // 没有消息，移除 pending
      const newList = historyList.filter((h) => h.id !== pendingHistoryId);
      persistHistory(newList, undefined, activeHistoryId === pendingHistoryId ? null : activeHistoryId);
      setPendingHistoryId(null);
      return;
    }

    if (!isGenerating) {
      // 完成，转为正式历史
      const updated = historyList.map((h, idx) => {
        if (h.id !== pendingHistoryId) return h;
        const counter = historyCounter + 1;
        return {
          ...h,
          name: `并发v${counter}-${summarizeLaneMessagesCount(lanes)}`,
          lanes: cloneLanes(lanes),
          updatedAt: Date.now(),
          isRunning: false,
        };
      });
      persistHistory(updated, historyCounter + 1, pendingHistoryId);
      setHistoryCounter((c) => c + 1);
      setPendingHistoryId(null);
    }
  }, [lanes, pendingHistoryId, historyList, historyCounter, activeHistoryId]);

  const loadHistoryItem = (id: string) => {
    const item = historyList.find((h) => h.id === id);
    if (!item) return;
    persistHistory(historyList, undefined, id);
    const lanesClone = cloneLanes(item.lanes);
    startNewChat(lanesClone, false);
    setHasStartedChat(lanesClone.some((l) => l.messages.length > 0));
  };

  const handleToggleHistory = () => {
    if (isHistoryPanelOpen) {
      setIsHistoryPanelOpen(false);
      setIsSidebarOpen(false);
      return;
    }
    setIsHistoryPanelOpen(true);
    setIsSidebarOpen(true);
  };

  const handleStartNewChat = () => {
    const hasMessages = summarizeLaneMessagesCount(lanes) > 0;
    if (hasMessages) {
      const newHistory = createHistoryFromCurrent();
      if (newHistory) setActiveHistoryId(newHistory.id);
    }
    setIsSidebarOpen(true);
    const count = Math.max(1, Math.min(20, parseInt(laneCountInput, 10) || lanes.length || 2));
    const newLanes: LaneState[] = [];
    for (let i = 0; i < count; i++) {
      newLanes.push(createDefaultLane(uuidv4(), selectedModelId, i + 1));
    }
    startNewChat(newLanes, true);
    if (newLanes[0]) setActiveLaneId(newLanes[0].id);
    setLaneCountInput(String(count));
  };

  const renameHistory = (id: string, name: string) => {
    const newList = historyList.map((h) => (h.id === id ? { ...h, name, updatedAt: Date.now() } : h));
    persistHistory(newList, undefined, activeHistoryId);
  };

  const deleteHistory = (id: string) => {
    const newList = historyList.filter((h) => h.id !== id);
    const newActive = activeHistoryId === id ? null : activeHistoryId;
    persistHistory(newList, undefined, newActive);
  };

  const clearHistory = () => {
    persistHistory([], 0, null);
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
        availableModels={availableModels}
        setAvailableModels={setAvailableModels}
        devExperimentalEnabled={devExperimentalEnabled}
        setDevExperimentalEnabled={setDevExperimentalEnabled}
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
          laneCountInput={laneCountInput}
          updateLaneCount={handleLaneCountChange}
          laneLocked={laneLocked}
          onToggleLaneLock={() => setLaneLocked((v) => !v)}
          relayEnabled={relayEnabled}
          relays={enabledRelays}
          activeRelayId={activeRelayId}
          onSelectRelay={(id) => setActiveRelayId(id)}
          geminiKeysEnabled={geminiKeysEnabled}
          geminiKeys={enabledGeminiKeys}
          activeGeminiKeyId={activeGeminiKeyId}
          onSelectGeminiKey={(id) => setActiveGeminiKeyId(id)}
          apiMode={apiMode}
          setApiMode={setApiMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleHistory={devExperimentalEnabled ? handleToggleHistory : () => {}}
          isHistoryOpen={isHistoryPanelOpen}
          showHistoryButton={devExperimentalEnabled}
        />

        <main className="flex-1 overflow-hidden relative flex flex-col bg-white dark:bg-gray-900">
          {!hasStartedChat ? (
            <>
              <EmptyState language={language} onSendQuickPrompt={(text) => handleSend(text, null)} />
              <div className="p-4 pb-6 bg-white dark:bg-gray-900 z-20">
                <ChatInput
                  onSend={handleSend}
                  language={language}
                  isGenerating={lanes.some((l) => l.isThinking)}
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
                      {lanes.map((lane) => (
                        <ChatGridItem
                          key={lane.id}
                          lane={lane}
                          isActive={activeLaneId === lane.id}
                          onClick={() => {
                            setActiveLaneId(lane.id);
                            if (!isSidebarOpen) setIsSidebarOpen(true);
                          }}
                          onDoubleClick={() => {
                            setActiveLaneId(lane.id);
                            setIsHistoryPanelOpen(false);
                            setIsSidebarOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full overflow-x-auto snap-x snap-mandatory divide-x divide-gray-100 dark:divide-gray-800 scrollbar-hide">
                    {lanes.map((lane, idx) => (
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
                          availableModels={visibleModels}
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
                  isGenerating={lanes.some((l) => l.isThinking)}
                  onOpenSettings={() => setIsSettingsOpen(true)}
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
