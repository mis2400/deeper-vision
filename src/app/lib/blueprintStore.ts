// SC.7.3 — IndexedDB-backed blueprint blob store. Decouples the
// proposal canvas snapshot's image data from localStorage so a
// multi-floor project with rich backgrounds doesn't push the persist
// blob over the 5–10 MB origin ceiling. Without this, three 2 MB
// blueprints across one project chew through half the per-origin
// localStorage budget per sent proposal version.
//
// Shape contract:
//   * Each blueprint is keyed by a content-derived hash. Identical
//     dataUrls collide on the same key — two proposals that share a
//     blueprint pay storage cost only once.
//   * The dataUrl is stored verbatim (base64 image/png|jpeg). No
//     compression here; we trust the canvas upload path to have
//     downscaled large originals already.
//   * Reads return null when the blueprint hasn't been seeded yet —
//     the portal renderer treats null as "no background" rather than
//     blocking the SVG render on the lookup.
//
// What does NOT live here:
//   * The snapshot type / capture flow (canvasSnapshot.ts owns those).
//   * Legacy inline dataUrl handling — the renderer reads inline
//     dataUrl first when present, falls through to this store via
//     dataUrlRef otherwise.

const DB_NAME       = 'deeper-vision-blueprints';
const DB_VERSION    = 1;
const STORE_NAME    = 'blueprints';

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available (likely SSR or a sandboxed iframe).'));
  }
  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

// Hash via SubtleCrypto (SHA-1 is fine — collision resistance isn't
// adversarial here, we just need a stable content key). Truncate to
// 16 hex chars (64 bits) for compact keys; the prefix collision
// probability is negligible for a per-project blueprint corpus.
export async function hashBlueprint(dataUrl: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder().encode(dataUrl);
    const buf = await crypto.subtle.digest('SHA-1', enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  }
  // Fallback for the rare environment without SubtleCrypto.
  let h = 0;
  for (let i = 0; i < dataUrl.length; i++) {
    h = ((h << 5) - h + dataUrl.charCodeAt(i)) | 0;
  }
  return `fb${(h >>> 0).toString(16)}`;
}

// Store a blueprint and return its hash. Idempotent — calling twice
// with the same dataUrl returns the same hash and the second write
// is a no-op (the object store treats `put` as upsert).
export async function putBlueprint(dataUrl: string): Promise<string> {
  const hash = await hashBlueprint(dataUrl);
  const db = await openDb();
  return new Promise<string>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(dataUrl, hash);
    tx.oncomplete = () => resolve(hash);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Fetch a blueprint by hash. Returns null when the hash isn't in
// the store — the renderer treats this as "background not yet
// available" rather than an error.
export async function getBlueprint(hash: string): Promise<string | null> {
  const db = await openDb();
  return new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(hash);
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}
