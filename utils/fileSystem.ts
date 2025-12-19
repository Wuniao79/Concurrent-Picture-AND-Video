const HANDLE_DB_NAME = 'sora_fs_handles';
const HANDLE_STORE_NAME = 'handles';
const DOWNLOAD_ROOT_KEY = 'download_root';

const openHandleDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = window.indexedDB.open(HANDLE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        db.createObjectStore(HANDLE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withHandleStore = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
) => {
  const db = await openHandleDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE_NAME, mode);
    const store = tx.objectStore(HANDLE_STORE_NAME);
    const request = action(store);
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => {
      const err = tx.error || request.error;
      db.close();
      reject(err);
    };
    tx.onabort = () => {
      const err = tx.error || request.error;
      db.close();
      reject(err);
    };
  });
};

export const loadDownloadDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null;
  try {
    const handle = await withHandleStore<FileSystemDirectoryHandle | undefined>('readonly', (store) =>
      store.get(DOWNLOAD_ROOT_KEY)
    );
    return handle || null;
  } catch {
    return null;
  }
};

export const saveDownloadDirectoryHandle = async (handle: FileSystemDirectoryHandle) => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    await withHandleStore('readwrite', (store) => store.put(handle, DOWNLOAD_ROOT_KEY));
  } catch {
    // ignore storage failures
  }
};

export const clearDownloadDirectoryHandle = async () => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    await withHandleStore('readwrite', (store) => store.delete(DOWNLOAD_ROOT_KEY));
  } catch {
    // ignore storage failures
  }
};
