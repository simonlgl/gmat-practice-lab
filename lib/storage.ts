import type { AppPersistedState } from "./types";

const DB_NAME = "gmat-practice-lab";
const STORE_NAME = "state";
const STATE_KEY = "app";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function loadPersistedState(): Promise<AppPersistedState | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(STATE_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as AppPersistedState) ?? null);
  });
}

export async function savePersistedState(state: AppPersistedState): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }

  const db = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(state, STATE_KEY);

    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}
