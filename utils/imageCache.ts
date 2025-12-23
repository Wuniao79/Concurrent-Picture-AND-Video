export type ImageCacheRecord = {
  id: string;
  historyId: string;
  laneId: string;
  messageId: string;
  imageIndex: number;
  source: string;
  createdAt: number;
  mimeType: string;
  blob: Blob;
};

const DB_NAME = 'sora_image_cache';
const STORE_NAME = 'images';
const DB_VERSION = 2;
const MAX_IMAGE_CACHE_RECORDS = 400;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = () => {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not supported'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE_NAME)
          ? request.transaction?.objectStore(STORE_NAME)
          : db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        if (!store) return;
        if (!store.indexNames.contains('historyId')) {
          store.createIndex('historyId', 'historyId', { unique: false });
        }
        if (!store.indexNames.contains('source')) {
          store.createIndex('source', 'source', { unique: false });
        }
        if (!store.indexNames.contains('createdAt')) {
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    });
  }
  return dbPromise;
};

export const buildImageCacheId = (historyId: string, laneId: string, messageId: string, imageIndex: number) =>
  `${historyId}::${laneId}::${messageId}::${imageIndex}`;

export const getImageCacheRecord = async (id: string): Promise<ImageCacheRecord | null> => {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as ImageCacheRecord) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const putImageCacheRecord = async (record: ImageCacheRecord): Promise<void> => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
    await pruneImageCache(MAX_IMAGE_CACHE_RECORDS);
  } catch {
    // ignore
  }
};

const getImageCacheCount = async (db: IDBDatabase): Promise<number> =>
  new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => resolve(0);
  });

const pruneImageCache = async (maxRecords: number): Promise<void> => {
  if (!maxRecords || maxRecords <= 0) return;
  try {
    const db = await openDb();
    const total = await getImageCacheCount(db);
    if (total <= maxRecords) return;
    const toDelete = total - maxRecords;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      let deleted = 0;
      const cursor = index.openCursor();
      cursor.onsuccess = () => {
        const cur = cursor.result;
        if (!cur) {
          resolve();
          return;
        }
        cur.delete();
        deleted += 1;
        if (deleted >= toDelete) {
          resolve();
          return;
        }
        cur.continue();
      };
      cursor.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
};

export const deleteImageCacheByHistoryId = async (historyId: string): Promise<void> => {
  if (!historyId) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('historyId');
      const range = IDBKeyRange.only(historyId);
      const cursor = index.openCursor(range);
      cursor.onsuccess = () => {
        const cur = cursor.result;
        if (!cur) {
          resolve();
          return;
        }
        cur.delete();
        cur.continue();
      };
      cursor.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
};

export const clearImageCache = async (): Promise<void> => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
};
