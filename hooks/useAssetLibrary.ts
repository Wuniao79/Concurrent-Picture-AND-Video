import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssetKind, AssetLibraryItem } from '../types';
import {
  ASSET_LIBRARY_EVENT,
  ASSET_LIBRARY_KEY,
  addAssetLibraryItem,
  clearAssetLibrary,
  deleteAssetLibraryItem,
  loadAssetLibrary,
  parseAssetBlobId,
  updateAssetLibraryItem,
} from '../utils/assetLibrary';
import { loadAssetBlob } from '../utils/blobStore';

export const useAssetLibrary = () => {
  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());
  const resolveJobRef = useRef(0);
  const [items, setItems] = useState<AssetLibraryItem[]>(() => loadAssetLibrary());

  const resolveBlobItems = useCallback(async (raw: AssetLibraryItem[]) => {
    const base = Array.isArray(raw) ? raw : [];
    const neededBlobIds = new Set<string>();
    const cache = blobUrlCacheRef.current;

    for (const item of base) {
      const blobId = parseAssetBlobId(item.src);
      if (blobId) neededBlobIds.add(blobId);
    }

    for (const [blobId, url] of cache) {
      if (neededBlobIds.has(blobId)) continue;
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
      cache.delete(blobId);
    }

    const missing = Array.from(neededBlobIds).filter((id) => !cache.has(id));
    for (const blobId of missing) {
      const blob = await loadAssetBlob(blobId);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      cache.set(blobId, url);
    }

    return base.map((item) => {
      const blobId = parseAssetBlobId(item.src);
      if (!blobId) return item;
      const url = cache.get(blobId);
      return url ? { ...item, src: url } : item;
    });
  }, []);

  const refresh = useCallback(() => {
    const jobId = (resolveJobRef.current += 1);
    const raw = loadAssetLibrary();
    void (async () => {
      try {
        const resolved = await resolveBlobItems(raw);
        if (resolveJobRef.current !== jobId) return;
        setItems(resolved);
      } catch {
        if (resolveJobRef.current !== jobId) return;
        setItems(raw);
      }
    })();
  }, [resolveBlobItems]);

  useEffect(() => {
    const handleChange = () => refresh();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === ASSET_LIBRARY_KEY) refresh();
    };
    window.addEventListener(ASSET_LIBRARY_EVENT as any, handleChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(ASSET_LIBRARY_EVENT as any, handleChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refresh]);

  useEffect(() => {
    refresh();
    return () => {
      resolveJobRef.current += 1;
      const cache = blobUrlCacheRef.current;
      for (const url of cache.values()) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      cache.clear();
    };
  }, [refresh]);

  const add = useCallback(
    (input: { kind: AssetKind; name: string; src: string }) => {
      const created = addAssetLibraryItem(input);
      refresh();
      return created;
    },
    [refresh]
  );

  const update = useCallback(
    (id: string, patch: Partial<Pick<AssetLibraryItem, 'name' | 'src'>>) => {
      const updated = updateAssetLibraryItem(id, patch);
      refresh();
      return updated;
    },
    [refresh]
  );

  const remove = useCallback(
    (id: string) => {
      const ok = deleteAssetLibraryItem(id);
      refresh();
      return ok;
    },
    [refresh]
  );

  const clear = useCallback(() => {
    clearAssetLibrary();
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const byKind = items.reduce(
      (acc, item) => {
        acc[item.kind] += 1;
        return acc;
      },
      { image: 0, video: 0 } as Record<AssetKind, number>
    );
    return {
      total: items.length,
      ...byKind,
    };
  }, [items]);

  return {
    items,
    stats,
    add,
    update,
    remove,
    clear,
    refresh,
  };
};
