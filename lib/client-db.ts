// ponytail: tiny IndexedDB kv store. The browser is the source of truth
// because every Vercel Lambda gets an isolated /tmp DB (state dies per instance).
const DB_NAME = 'synapse-db';
const STORE = 'kv';

function idbAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.indexedDB;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function runTx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<any>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  if (!idbAvailable()) return;
  await runTx('readwrite', (s) => s.put(value, key));
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  if (!idbAvailable()) return undefined;
  return runTx<T | undefined>('readonly', (s) => s.get(key));
}

export async function idbDel(key: string): Promise<void> {
  if (!idbAvailable()) return;
  await runTx('readwrite', (s) => s.delete(key));
}

export async function idbKeys(): Promise<string[]> {
  if (!idbAvailable()) return [];
  const keys = await runTx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
  return keys.map(String);
}
