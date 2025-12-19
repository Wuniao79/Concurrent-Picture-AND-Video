import { LaneState, Model } from '../types';
import { safeStorageGet, safeStorageSet } from './storage';

export interface LaneHistoryItem {
  id: string;
  name: string;
  /** Auto-incremented sequence number used in default name: 并发Vx-y */
  sequenceNumber?: number;
  model: string;
  lanes: LaneState[];
  createdAt: number;
  updatedAt: number;
  isRunning?: boolean;
  /** Draft placeholder for the current live session. */
  isDraft?: boolean;
}

const STORAGE_KEY = 'sora_lane_history';
const COUNTER_KEY = 'sora_lane_history_counter';
const ACTIVE_KEY = 'sora_active_history_id';

export const loadHistory = (): LaneHistoryItem[] => {
  const raw = safeStorageGet(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as LaneHistoryItem[];
  } catch {
    return [];
  }
  return [];
};

export const saveHistory = (list: LaneHistoryItem[]) => {
  try {
    safeStorageSet(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
};

export const loadCounter = (): number => {
  const raw = safeStorageGet(COUNTER_KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
};

export const saveCounter = (v: number) => {
  safeStorageSet(COUNTER_KEY, String(v));
};

export const loadActiveHistoryId = (): string | null => safeStorageGet(ACTIVE_KEY);
export const saveActiveHistoryId = (id: string | null) => {
  if (id === null) {
    safeStorageSet(ACTIVE_KEY, '');
    return;
  }
  safeStorageSet(ACTIVE_KEY, id);
};
