// Plan import Web Worker — M5. Runs decode + downscale + encode OFF the
// main thread so the upload no longer freezes the UI. Vite picks this
// file up via `?worker` URL syntax in the caller.
//
// Input  (postMessage): { type: 'import', file: File }
// Output (postMessage): { type: 'imported', blob, naturalWidth, naturalHeight, origin, note? }
//                     | { type: 'error', message }
//
// Image path: createImageBitmap → OffscreenCanvas → drawImage → toBlob.
// PDF path: pdfjs-dist worker imported inside this worker (a nested
// worker is fine; pdfjs-dist supports it). Render first page to an
// OffscreenCanvas, downscale, encode.
//
// MAX_EDGE caps the long edge at 2048 px. Same constant as the old sync
// path so the output is byte-comparable for image sources.

const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.85;

type InMsg =
  | { type: 'import'; file: File };

type OutMsg =
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

function post(msg: OutMsg, transfer: Transferable[] = []) {
  // Transfer the blob's underlying buffer if possible (Blobs themselves
  // are transferable across worker boundaries in modern browsers).
  (self as unknown as Worker).postMessage(msg, transfer);
}

self.addEventListener('message', async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (!msg || msg.type !== 'import') return;
  const file = msg.file;
  try {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const out = await importPdf(file);
      post(out);
      return;
    }
    if (file.type.startsWith('image/')) {
      const out = await importImage(file);
      post(out);
      return;
    }
    post({ type: 'error', message: `Unsupported file type: ${file.type || file.name}` });
  } catch (err: any) {
    post({ type: 'error', message: err?.message ?? String(err) });
  }
});

async function importImage(file: File): Promise<OutMsg> {
  // createImageBitmap reads from the File directly and decodes off the
  // main thread. No FileReader, no base64 round trip.
  const bitmap = await createImageBitmap(file);
  const { canvas, scaledW, scaledH } = downscale(bitmap, MAX_EDGE);
  bitmap.close();

  const isPng = file.type === 'image/png';
  const mimeType = isPng ? 'image/png' : 'image/jpeg';
  const blob = await canvas.convertToBlob({ type: mimeType, quality: JPEG_QUALITY });

  return {
    type: 'imported',
    blob,
    naturalWidth: scaledW,
    naturalHeight: scaledH,
    origin: isPng ? 'png' : 'jpg',
    fileName: file.name,
  };
}

async function importPdf(file: File): Promise<OutMsg> {
  // Lazy-import pdfjs only when a PDF is actually uploaded so the worker
  // bundle stays small for the common image case.
  const pdfjs = await import('pdfjs-dist');
  // pdfjs-dist needs its own worker for parsing. We supply the same one
  // the rest of the app uses, via a URL handle imported with Vite's
  // ?url syntax — works inside a Web Worker too.
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const totalPages = pdf.numPages;
  const page = await pdf.getPage(1);

  // Render at scale 2.0 (~150 DPI). pdfjs writes into an OffscreenCanvas
  // we provide; same downscale path runs afterwards to cap at MAX_EDGE.
  const viewport = page.getViewport({ scale: 2.0 });
  const pdfCanvas = new OffscreenCanvas(viewport.width, viewport.height);
  const ctx = pdfCanvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable.');
  ctx.fillStyle = '#FFFFFF'; // PDFs may be transparent; white sheet under
  ctx.fillRect(0, 0, pdfCanvas.width, pdfCanvas.height);
  // pdfjs accepts an OffscreenCanvasRenderingContext2D as canvasContext.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx as any, viewport, canvas: pdfCanvas as any }).promise;

  const { canvas, scaledW, scaledH } = downscaleCanvas(pdfCanvas, MAX_EDGE);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });

  return {
    type: 'imported',
    blob,
    naturalWidth: scaledW,
    naturalHeight: scaledH,
    origin: 'pdf',
    fileName: file.name,
    note: totalPages > 1 ? `Using first page of ${totalPages}.` : undefined,
  };
}

function downscale(bitmap: ImageBitmap, maxEdge: number) {
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const scaledW = Math.round(bitmap.width * scale);
  const scaledH = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(scaledW, scaledH);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, scaledW, scaledH);
  return { canvas, scaledW, scaledH };
}

function downscaleCanvas(src: OffscreenCanvas, maxEdge: number) {
  const longest = Math.max(src.width, src.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  if (scale === 1) return { canvas: src, scaledW: src.width, scaledH: src.height };
  const scaledW = Math.round(src.width * scale);
  const scaledH = Math.round(src.height * scale);
  const out = new OffscreenCanvas(scaledW, scaledH);
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, scaledW, scaledH);
  return { canvas: out, scaledW, scaledH };
}

// Make TS happy about the bare module
export {};
