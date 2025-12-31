const BLOB_DB_NAME = 'sora_asset_blobs_v1';
const BLOB_STORE_NAME = 'blobs';

const openBlobDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = window.indexedDB.open(BLOB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOB_STORE_NAME)) {
        db.createObjectStore(BLOB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withBlobStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
) => {
  const db = await openBlobDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE_NAME, mode);
    const store = tx.objectStore(BLOB_STORE_NAME);
    const request = action(store);
    const finish = (err?: unknown) => {
      try {
        db.close();
      } catch {
        // ignore
      }
      if (err) reject(err);
      else resolve(request.result);
    };
    tx.oncomplete = () => finish();
    tx.onerror = () => finish(tx.error || request.error);
    tx.onabort = () => finish(tx.error || request.error);
  });
};

export const saveAssetBlob = async (id: string, blob: Blob): Promise<boolean> => {
  const key = (id || '').trim();
  if (!key) return false;
  if (typeof window === 'undefined' || !('indexedDB' in window)) return false;
  try {
    await withBlobStore('readwrite', (store) => store.put(blob, key));
    return true;
  } catch {
    return false;
  }
};

export const loadAssetBlob = async (id: string): Promise<Blob | null> => {
  const key = (id || '').trim();
  if (!key) return null;
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null;
  try {
    const blob = await withBlobStore<Blob | undefined>('readonly', (store) => store.get(key));
    return blob || null;
  } catch {
    return null;
  }
};

export const deleteAssetBlob = async (id: string) => {
  const key = (id || '').trim();
  if (!key) return;
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    await withBlobStore('readwrite', (store) => store.delete(key));
  } catch {
    // ignore storage failures
  }
};

export const clearAssetBlobs = async () => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    await withBlobStore('readwrite', (store) => store.clear());
  } catch {
    // ignore storage failures
  }
};
