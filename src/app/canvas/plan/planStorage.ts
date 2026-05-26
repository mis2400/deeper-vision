// Plan binary storage — M5. IndexedDB-backed blob store for floor plan
// binaries. Keeps the multi-megabyte image bytes OUT of the Zustand
// localStorage persist payload (where they previously froze the main
// thread for seconds during JSON.stringify + localStorage.setItem).
//
// The Zustand store now persists a SHA-256 hash; the actual binary lives
// here. The render layer reads the hash, looks up the blob, and creates
// a fresh object URL each session via usePlanBlobUrl.
//
// Same-origin only. No CORS, no quotas worth fighting. Browsers offer a
// few hundred MB before prompting the user — comfortable headroom for
// the floor plans this app handles.

const DB_NAME = 'dv-plan-binaries';
const STORE_NAME = 'plans';
const DB_VERSION = 1;

/** Open the IDB connection. Lazy + cached per session. */
let dbPromise: Promise<IDBDatabase> | null = null;
function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME); // keyed by hash (string)
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
  });
  return dbPromise;
}

async function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await getDb();
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

/** Write a blob keyed by its hash. Returns void on success. */
export async function putPlanBlob(hash: string, blob: Blob): Promise<void> {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(blob, hash);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('IDB put failed'));
  });
}

/** Read a blob by hash. Returns null if not present. */
export async function getPlanBlob(hash: string): Promise<Blob | null> {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(hash);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('IDB get failed'));
  });
}

/** Delete a blob by hash. Safe if the key is absent. */
export async function deletePlanBlob(hash: string): Promise<void> {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(hash);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('IDB delete failed'));
  });
}

/** List all stored hashes. Useful for cleanup audits. */
export async function listPlanHashes(): Promise<string[]> {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAllKeys();
    req.onsuccess = () => resolve((req.result as string[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error('IDB list failed'));
  });
}

/** Compute SHA-256 hash of an ArrayBuffer as hex. */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(hash);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}
