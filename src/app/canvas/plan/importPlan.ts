// Plan import — M5 main thread entry. Spawns the Web Worker, hands it
// the file, awaits a decoded Blob, hashes the bytes, stores them in
// IndexedDB, and returns a FloorBackground shape ready for the store.
//
// The returned background carries:
//   - `blobHash` — SHA-256 of the encoded bytes. The store persists this.
//   - `dataUrl: ''` — sentinel left empty so the legacy field still
//     satisfies the required interface but doesn't carry megabytes of
//     base64 into localStorage.
//
// Render layer (usePlanBlobUrl) reads `blobHash`, looks up the blob in
// IDB, creates an object URL with managed lifetime, and feeds it to the
// SVG <image> href.
//
// Backwards compat: a Floor whose background has only `dataUrl` set
// (older saved data) still renders — the hook falls through to that.

import type { FloorBackground } from '../../store/types';
import { putPlanBlob, sha256Hex } from './planStorage';

export interface ImportResult {
  background: FloorBackground;
  note?: string;
}

export type WorkerOutMsg =
  | {
      type: 'imported';
      blob: Blob;
      naturalWidth: number;
      naturalHeight: number;
      origin: 'pdf' | 'png' | 'jpg';
      fileName: string;
      note?: string;
    }
  | { type: 'error'; message: string };

// Vite-friendly worker import. The `?worker` suffix turns the imported
// module into a Worker constructor that we can `new`.
import PlanImportWorker from './planImport.worker?worker';

/** Cached Worker instance. One worker survives the session — spinning a
 *  fresh worker per import wastes ~50 ms on the cold start. */
let workerInstance: Worker | null = null;
function getWorker(): Worker {
  if (workerInstance) return workerInstance;
  workerInstance = new PlanImportWorker();
  return workerInstance;
}

/** Run the import. Resolves once the worker finishes decoding and the
 *  blob has been written to IndexedDB. */
export async function importPlan(file: File): Promise<ImportResult> {
  const worker = getWorker();

  const out: WorkerOutMsg = await new Promise((resolve, reject) => {
    const onMessage = (ev: MessageEvent<WorkerOutMsg>) => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      resolve(ev.data);
    };
    const onError = (ev: ErrorEvent) => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      reject(new Error(ev.message ?? 'Worker error'));
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage({ type: 'import', file });
  });

  if (out.type === 'error') {
    throw new Error(out.message);
  }

  // Hash the bytes so the binary is content-addressed in IDB.
  const buf = await out.blob.arrayBuffer();
  const hash = await sha256Hex(buf);
  await putPlanBlob(hash, out.blob);

  return {
    background: {
      // Legacy field kept empty so older render paths that test
      // dataUrl truthiness still degrade gracefully (the hash drives
      // rendering when present).
      dataUrl: '',
      blobHash: hash,
      fileName: out.fileName,
      origin: out.origin,
      x: 0, y: 0,
      scale: 1,
      rotation: 0,
      opacity: 0.85,
      naturalWidth: out.naturalWidth,
      naturalHeight: out.naturalHeight,
    },
    note: out.note,
  };
}
