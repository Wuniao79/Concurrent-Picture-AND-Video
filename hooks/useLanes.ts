import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generateResponse } from '../services/geminiService';
import { ApiMode, LaneState, Model, ModelProvider, Role } from '../types';
import { createDefaultLane, extractErrorCodeFromText, extractProgressFromText } from '../utils/lane';

const normalizeModelIdValue = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof (value as any).id !== 'undefined') {
    return String((value as any).id);
  }
  return String(value ?? '');
};

interface UseLanesOptions {
  selectedModelId: string;
  availableModels: Model[];
  apiMode: ApiMode;
  openaiApiKey: string;
  geminiApiKey: string;
  openaiApiUrl: string;
  geminiApiUrl: string;
  geminiKeyRotationEnabled?: boolean;
  geminiKeyPool?: { id: string; apiKey: string; enabled?: boolean }[];
  geminiEnterpriseEnabled?: boolean;
  geminiEnterpriseProjectId?: string;
  geminiEnterpriseLocation?: string;
  geminiEnterpriseToken?: string;
  isStreamEnabled: boolean;
  maxLaneCount?: number;
  onRequireSidebarOpen?: () => void;
  /** Returns the currently bound history/session id for associating background updates. */
  getCurrentSessionId?: () => string | null;
  /**
   * When a lane update arrives after the UI has switched to another session,
   * apply it to the background session (usually by writing back into history storage).
   */
  onBackgroundLaneUpdate?: (sessionId: string, laneId: string, updater: (prev: LaneState) => LaneState) => void;
  initialLanes?: LaneState[];
  initialActiveLaneId?: string | null;
  initialLaneCount?: number;
}

export const useLanes = (options: UseLanesOptions) => {
  const {
    selectedModelId,
    availableModels,
    apiMode,
    openaiApiKey,
    geminiApiKey,
    openaiApiUrl,
    geminiApiUrl,
    geminiKeyRotationEnabled,
    geminiKeyPool,
    geminiEnterpriseEnabled,
    geminiEnterpriseProjectId,
    geminiEnterpriseLocation,
    geminiEnterpriseToken,
    isStreamEnabled,
    maxLaneCount,
    onRequireSidebarOpen,
    getCurrentSessionId,
    onBackgroundLaneUpdate,
    initialLanes,
    initialActiveLaneId,
    initialLaneCount,
  } = options;

  const resolvedMaxLaneCount = (() => {
    const n = typeof maxLaneCount === 'number' && Number.isFinite(maxLaneCount) ? Math.floor(maxLaneCount) : 20;
    return Math.max(1, Math.min(999, n));
  })();

  const [lanes, setLanes] = useState<LaneState[]>(
    initialLanes && initialLanes.length > 0
      ? initialLanes
      : [
          createDefaultLane(uuidv4(), selectedModelId, 1),
          createDefaultLane(uuidv4(), selectedModelId, 2),
        ]
  );

  const [laneCountInput, setLaneCountInput] = useState<string>(
    initialLaneCount ? String(initialLaneCount) : '2'
  );
  const [activeLaneId, setActiveLaneId] = useState<string | null>(
    initialActiveLaneId ?? null
  );
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [showClearConfirm] = useState(false);
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const stopRunning = (laneIds?: string[]) => {
    const ids = Array.isArray(laneIds) && laneIds.length > 0 ? laneIds : Object.keys(abortControllersRef.current);
    if (ids.length === 0) return;

    ids.forEach((id) => {
      try {
        abortControllersRef.current[id]?.abort();
      } catch {
        // ignore
      }
      delete abortControllersRef.current[id];
    });

    const idSet = new Set(ids);
    setLanes((prev) =>
      prev.map((lane) => (idSet.has(lane.id) ? { ...lane, isThinking: false } : lane))
    );
  };

  const normalizeProvider = (provider?: ModelProvider): ModelProvider => (provider === 'gemini' ? 'gemini' : 'openai');

  const findModelById = (modelId: string, preferredProvider?: ModelProvider) => {
    const matches = availableModels.filter((m) => m.id === modelId);
    if (matches.length === 0) return undefined;
    if (preferredProvider) {
      const preferred = matches.find((m) => normalizeProvider(m.provider) === preferredProvider);
      if (preferred) return preferred;
    }
    return matches[0];
  };

  const hasModelForProvider = (modelId: string, provider: ModelProvider) =>
    availableModels.some((m) => m.id === modelId && normalizeProvider(m.provider) === provider);

  const resolveModelProvider = (modelId: string, preferredProvider?: ModelProvider): ModelProvider => {
    const m = findModelById(modelId, preferredProvider);
    return normalizeProvider(m?.provider);
  };

  const resolveFallbackModelId = (targetProvider: ModelProvider): string | null => {
    if (selectedModelId && hasModelForProvider(selectedModelId, targetProvider)) {
      return selectedModelId;
    }
    const candidate = availableModels.find((m) => normalizeProvider(m.provider) === targetProvider);
    return candidate?.id || availableModels[0]?.id || null;
  };

  useEffect(() => {
    setLaneCountInput(String(lanes.length));
  }, [lanes.length]);

  const stopAllRunning = () => {
    stopRunning();
  };

  const normalizePresetLanes = (preset?: LaneState[]) =>
    preset?.map((lane) => ({
      ...lane,
      isThinking: false,
      model: normalizeModelIdValue((lane as any).model),
    }));

  // Keep lane models aligned with the currently selected API provider.
  useEffect(() => {
    const targetProvider: ModelProvider = apiMode === 'gemini' ? 'gemini' : 'openai';
    const fallbackId = resolveFallbackModelId(targetProvider);
    if (!fallbackId) return;

    setLanes((prev) => {
      let changed = false;
      const next = prev.map((lane) => {
        // Never interrupt active generations or existing conversations when switching providers.
        // Only update idle/empty lanes so the current run can finish unaffected.
        if (lane.isThinking || lane.messages.length > 0) {
          return lane;
        }
        const laneProvider = resolveModelProvider(lane.model, targetProvider);
        if (laneProvider !== targetProvider) {
          changed = true;
          return { ...lane, model: fallbackId, error: undefined };
        }
        return lane;
      });
      return changed ? next : prev;
    });
  }, [apiMode, availableModels, selectedModelId]);

  const updateLaneCount = (value: string) => {
    const numeric = value.replace(/[^0-9]/g, '');
    if (numeric === '') {
      setLaneCountInput('');
      return;
    }

    let count = parseInt(numeric, 10);
    if (isNaN(count)) return;
    if (count < 1) count = 1;
    if (count > resolvedMaxLaneCount) count = resolvedMaxLaneCount;

    setLaneCountInput(String(count));

    setLanes((prev) => {
      if (count > prev.length) {
        const toAdd = count - prev.length;
        const newLanes: LaneState[] = [];
        for (let i = 0; i < toAdd; i++) {
          newLanes.push(
            createDefaultLane(
              uuidv4(),
              selectedModelId,
              prev.length + i + 1,
              hasStartedChat && prev[0] ? [...prev[0].messages] : []
            )
          );
        }
        return [...prev, ...newLanes];
      } else if (count < prev.length) {
        const newLanes = prev.slice(0, count);
        if (activeLaneId && !newLanes.find((l) => l.id === activeLaneId)) {
          setActiveLaneId(newLanes.length > 0 ? newLanes[0].id : null);
        }
        return newLanes;
      }
      return prev;
    });
  };

  const setAllModels = (modelId: string) => {
    // Only update idle lanes; leave generating or non-empty lanes unchanged.
    setLanes((prev) =>
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
    const newLanes = lanes.filter((l) => l.id !== id);
    setLanes(newLanes);
    if (activeLaneId === id) {
      setActiveLaneId(newLanes.length > 0 ? newLanes[0].id : null);
    }
  };

  const updateModel = (id: string, model: string) => {
    setLanes((prev) => prev.map((l) => (l.id === id ? { ...l, model } : l)));
  };

  const startNewChat = (presetLanes?: LaneState[], abortRunning: boolean = false) => {
    if (abortRunning) {
      stopRunning(lanes.map((l) => l.id));
    }
    setHasStartedChat(false);
    setActiveLaneId(null);
    const normalized = normalizePresetLanes(presetLanes);
    if (normalized && normalized.length > 0) {
      setLanes(normalized);
      return;
    }
    setLanes([
      createDefaultLane(uuidv4(), selectedModelId, 1),
      createDefaultLane(uuidv4(), selectedModelId, 2),
    ]);
  };

  const clearAllChats = () => {
    setHasStartedChat(false);
    stopAllRunning();
    setLanes((prev) =>
      prev.map((l, idx) => ({
        ...l,
        messages: [],
        isThinking: false,
        progress: 0,
        error: undefined,
        errorCode: undefined,
        // 当用户点击“清空”时，将 lane 的模型同步到当前选中的模型，避免后续切换模型仍残留旧模型。
        model: selectedModelId || l.model,
        id: l.id || uuidv4(),
        name: l.name || `Model ${idx + 1}`,
      }))
    );
    setActiveLaneId((prev) => {
      const next = lanes[0]?.id || prev || null;
      return next;
    });
  };

  // Backward-compatible placeholder; main app may override clearing behavior.
  const confirmAndClearChats = () => {
    clearAllChats();
  };

  const handleSend = useCallback(
    async (text: string, images: string[] = []) => {
      const normalizedImages = (images || []).filter(Boolean);
      if (!text.trim() && normalizedImages.length === 0) return;

      const sessionId = getCurrentSessionId?.() || null;
      const targetProvider: ModelProvider = apiMode === 'gemini' ? 'gemini' : 'openai';
      const fallbackModelId = resolveFallbackModelId(targetProvider);
      if (!fallbackModelId) return;

      // Normalize lane models to match the active provider before sending.
      let normalizedLanes = lanes;
      let changed = false;
      normalizedLanes = lanes.map((lane) => {
        const laneProvider = resolveModelProvider(lane.model, targetProvider);
        if (laneProvider !== targetProvider) {
          changed = true;
          return { ...lane, model: fallbackModelId, error: undefined };
        }
        return lane;
      });
      if (changed) {
        setLanes(normalizedLanes);
      }

      setHasStartedChat(true);
      const userMessageId = uuidv4();
      const timestamp = Date.now();

      setLanes((prev) =>
        prev.map((lane) => ({
          ...lane,
          messages: [
            ...lane.messages,
            {
              id: userMessageId,
              role: Role.USER,
              text,
              timestamp,
              images: normalizedImages.length > 1 ? normalizedImages : undefined,
              image: normalizedImages.length === 1 ? normalizedImages[0] : undefined,
            },
          ],
          isThinking: true,
          progress: 0,
          error: undefined,
          errorCode: undefined,
        }))
      );

      const poolKeys = Array.isArray(geminiKeyPool)
        ? geminiKeyPool
            .map((k) => (k.apiKey || '').trim())
            .filter(Boolean)
        : [];
      const rotationSeed =
        geminiKeyRotationEnabled && poolKeys.length > 1 ? Math.floor(Math.random() * poolKeys.length) : 0;
      const resolveGeminiApiKey = (laneIndex: number) => {
        if (geminiEnterpriseEnabled) {
          return (geminiApiKey || '').trim();
        }

        if (poolKeys.length === 0) {
          return (geminiApiKey || '').trim();
        }

        if (!geminiKeyRotationEnabled || poolKeys.length === 1) {
          return poolKeys[0];
        }

        const idx = (laneIndex + rotationSeed) % poolKeys.length;
        return poolKeys[idx] || poolKeys[0];
      };

      const promises = normalizedLanes.map(async (lane, laneIndex) => {
        const laneId = lane.id;
        let botMessageText = '';
        const botMessageId = uuidv4();
        const laneStartTime = Date.now();
        const normalizedModelId = normalizeModelIdValue((lane as any).model);
        const isSoraVideoModel = normalizedModelId.toLowerCase().includes('sora-video');
        const requestStream = Boolean(isStreamEnabled || isSoraVideoModel);
        let isFirstChunk = true;
        const controller = new AbortController();
        abortControllersRef.current[laneId] = controller;

        const applyLaneUpdate = (updater: (prev: LaneState) => LaneState) => {
          setLanes((prev) => {
            let found = false;
            const next = prev.map((l) => {
              if (l.id !== laneId) return l;
              found = true;
              return updater(l);
            });
            if (found) return next;
            if (sessionId && onBackgroundLaneUpdate) {
              onBackgroundLaneUpdate(sessionId, laneId, updater);
            }
            return prev;
          });
        };

        applyLaneUpdate((l) => ({
          ...l,
          messages: [...l.messages, { id: botMessageId, role: Role.MODEL, text: '', timestamp: Date.now() }],
        }));

        try {
          const modelProvider: ModelProvider = targetProvider;
          const activeApiKey = modelProvider === 'gemini' ? resolveGeminiApiKey(laneIndex) : openaiApiKey;
          const activeApiBaseUrl =
            modelProvider === 'gemini'
              ? (geminiApiUrl && geminiApiUrl.trim()) || ''
              : (openaiApiUrl && openaiApiUrl.trim()) || '';

          await generateResponse(
            normalizedModelId,
            lane.messages,
            text,
            (chunk) => {
              if (requestStream) {
                botMessageText += chunk;
              } else {
                botMessageText = chunk;
              }

              applyLaneUpdate((l) => {
                let updatedIsThinking = l.isThinking;
                if (isFirstChunk && requestStream) {
                  updatedIsThinking = false;
                  isFirstChunk = false;
                }

                const msgs = [...l.messages];
                const lastMsgIndex = msgs.findIndex((m) => m.id === botMessageId);
                if (lastMsgIndex !== -1) {
                  msgs[lastMsgIndex] = { ...msgs[lastMsgIndex], text: botMessageText };
                } else {
                  msgs.push({ id: botMessageId, role: Role.MODEL, text: botMessageText, timestamp: Date.now() });
                }

                const progress = extractProgressFromText(botMessageText);
                const errorCode = extractErrorCodeFromText(botMessageText);

                return {
                  ...l,
                  messages: msgs,
                  isThinking: updatedIsThinking,
                  progress: progress !== null ? progress : l.progress,
                  errorCode: errorCode !== null ? errorCode : l.errorCode,
                };
              });
            },
            activeApiKey,
            requestStream,
            normalizedImages.length ? normalizedImages : undefined,
            activeApiBaseUrl,
            modelProvider,
            controller.signal,
            {
              geminiEnterpriseEnabled,
              geminiEnterpriseProjectId,
              geminiEnterpriseLocation,
              geminiEnterpriseToken,
            }
          );
        } catch (err: any) {
          const message = err?.message ? String(err.message) : String(err);
          const status =
            typeof err?.status === 'number'
              ? err.status
              : typeof err?.statusCode === 'number'
              ? err.statusCode
              : extractErrorCodeFromText(message);
          applyLaneUpdate((l) => ({
            ...l,
            error: message,
            errorCode: typeof status === 'number' ? status : l.errorCode,
          }));
        } finally {
          const finishedAt = Date.now();
          const duration = finishedAt - laneStartTime;

          applyLaneUpdate((l) => {
            const msgs = [...l.messages];
            const idx = msgs.findIndex((m) => m.id === botMessageId);
            if (idx !== -1) {
              msgs[idx] = { ...msgs[idx], generationDurationMs: duration };
            } else {
              msgs.push({
                id: botMessageId,
                role: Role.MODEL,
                text: botMessageText,
                timestamp: Date.now(),
                generationDurationMs: duration,
              });
            }

            return { ...l, isThinking: false, progress: 100, messages: msgs };
          });
          delete abortControllersRef.current[laneId];
        }
      });

      await Promise.all(promises);
    },
    [
      lanes,
      availableModels,
      apiMode,
      selectedModelId,
      geminiApiKey,
      geminiApiUrl,
      geminiEnterpriseEnabled,
      geminiEnterpriseProjectId,
      geminiEnterpriseLocation,
      geminiEnterpriseToken,
      isStreamEnabled,
      geminiKeyRotationEnabled,
      geminiKeyPool,
      getCurrentSessionId,
      onBackgroundLaneUpdate,
      openaiApiKey,
      openaiApiUrl,
    ]
  );

  return {
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
  };
};
