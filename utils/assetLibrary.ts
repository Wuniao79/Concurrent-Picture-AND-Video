import type { AssetKind, AssetLibraryItem } from '../types';
import { safeStorageGet, safeStorageSet } from './storage';
import { clearAssetBlobs, deleteAssetBlob, saveAssetBlob } from './blobStore';

export const ASSET_LIBRARY_KEY = 'sora_asset_library_v1';
export const ASSET_LIBRARY_EVENT = 'sora-asset-library-changed';
export const ASSET_BLOB_SRC_PREFIX = 'sora-blob:';
const MAX_ITEMS = 500;

const isAssetKind = (value: unknown): value is AssetKind => value === 'image' || value === 'video';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const dispatchChange = () => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(ASSET_LIBRARY_EVENT));
  } catch {
    // ignore
  }
};

export const loadAssetLibrary = (): AssetLibraryItem[] => {
  const raw = safeStorageGet(ASSET_LIBRARY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const sanitized: AssetLibraryItem[] = [];
    for (const item of parsed) {
      if (!isRecord(item)) continue;
      const id = String(item.id || '').trim();
      const kind = item.kind;
      const name = String(item.name || '').trim();
      const src = String(item.src || '').trim();
      const createdAt = Number(item.createdAt || 0);
      const updatedAt = Number(item.updatedAt || 0);
      if (!id || !isAssetKind(kind) || !name || !src) continue;
      sanitized.push({
        id,
        kind,
        name,
        src,
        createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
        updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
      });
    }
    sanitized.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return sanitized.slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
};

export const saveAssetLibrary = (items: AssetLibraryItem[]) => {
  const safe = (Array.isArray(items) ? items : []).slice(0, MAX_ITEMS);
  safeStorageSet(ASSET_LIBRARY_KEY, JSON.stringify(safe));
  dispatchChange();
};

export const toAssetBlobSrc = (blobId: string) => `${ASSET_BLOB_SRC_PREFIX}${(blobId || '').trim()}`;

export const parseAssetBlobId = (src: string): string | null => {
  const s = String(src || '').trim();
  if (!s.startsWith(ASSET_BLOB_SRC_PREFIX)) return null;
  const id = s.slice(ASSET_BLOB_SRC_PREFIX.length).trim();
  return id || null;
};

export const addAssetLibraryItem = (input: { kind: AssetKind; name: string; src: string }): AssetLibraryItem | null => {
  const kind = input.kind;
  const name = (input.name || '').trim();
  const src = (input.src || '').trim();
  if (!isAssetKind(kind) || !name || !src) return null;

  const now = Date.now();
  const item: AssetLibraryItem = {
    id: generateId(),
    kind,
    name,
    src,
    createdAt: now,
    updatedAt: now,
  };
  const next = [item, ...loadAssetLibrary()].slice(0, MAX_ITEMS);
  saveAssetLibrary(next);
  return item;
};

export const addAssetLibraryBlobItem = async (input: {
  kind: AssetKind;
  name: string;
  blob: Blob;
}): Promise<AssetLibraryItem | null> => {
  const kind = input.kind;
  const name = (input.name || '').trim();
  const blob = input.blob;
  if (!isAssetKind(kind) || !name || !(blob instanceof Blob) || blob.size <= 0) return null;

  const now = Date.now();
  const id = generateId();
  const src = toAssetBlobSrc(id);

  const stored = await saveAssetBlob(id, blob);
  if (!stored) return null;

  const item: AssetLibraryItem = {
    id,
    kind,
    name,
    src,
    createdAt: now,
    updatedAt: now,
  };
  const next = [item, ...loadAssetLibrary()].slice(0, MAX_ITEMS);
  saveAssetLibrary(next);
  return item;
};

export const updateAssetLibraryItem = (
  id: string,
  patch: Partial<Pick<AssetLibraryItem, 'name' | 'src'>>
): AssetLibraryItem | null => {
  const targetId = (id || '').trim();
  if (!targetId) return null;
  const nextName = typeof patch.name === 'string' ? patch.name.trim() : undefined;
  const nextSrc = typeof patch.src === 'string' ? patch.src.trim() : undefined;
  if (nextName !== undefined && !nextName) return null;
  if (nextSrc !== undefined && !nextSrc) return null;

  const items = loadAssetLibrary();
  let updated: AssetLibraryItem | null = null;
  const next = items.map((item) => {
    if (item.id !== targetId) return item;
    updated = {
      ...item,
      name: nextName ?? item.name,
      src: nextSrc ?? item.src,
      updatedAt: Date.now(),
    };
    return updated;
  });
  if (!updated) return null;
  saveAssetLibrary(next);
  return updated;
};

export const deleteAssetLibraryItem = (id: string): boolean => {
  const targetId = (id || '').trim();
  if (!targetId) return false;
  const items = loadAssetLibrary();
  const removed = items.find((it) => it.id === targetId) || null;
  const next = items.filter((item) => item.id !== targetId);
  if (next.length === items.length) return false;
  saveAssetLibrary(next);
  const blobId = removed ? parseAssetBlobId(removed.src) : null;
  if (blobId) void deleteAssetBlob(blobId);
  return true;
};

export const clearAssetLibrary = () => {
  saveAssetLibrary([]);
  void clearAssetBlobs();
};
