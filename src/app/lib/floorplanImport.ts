// Floorplan import — turns a user-uploaded PNG / JPG / PDF (first page)
// into a downscaled data URL the canvas can render as a background. PDF
// parsing uses pdfjs-dist (already installed). Output is capped at 2048 px
// on the long edge to keep localStorage manageable.
//
// Returned shape mirrors the Floor.background schema in store/types.ts so
// callers can drop it straight into `setFloorBackground(floorId, …)`.

import type { FloorBackground } from '../store/types';

const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.85;

export type ImportableType = 'image/png' | 'image/jpeg' | 'application/pdf';

export interface ImportResult {
  background: FloorBackground;
  /** Notes the renderer should surface (e.g. "Used first page of 3"). */
  note?: string;
}

export async function importFloorplanFile(file: File): Promise<ImportResult> {
  if (file.type.startsWith('image/')) {
    return importImage(file);
  }
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return importPdfFirstPage(file);
  }
  throw new Error(`Unsupported file type: ${file.type || file.name}`);
}

/** Image-side path: read into HTMLImageElement, downscale into a canvas,
 *  return JPEG (PNG retains alpha but inflates the payload — JPEG is the
 *  better default for blueprints). */
async function importImage(file: File): Promise<ImportResult> {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);
  const { canvas, scaledW, scaledH } = downscale(img, MAX_EDGE);
  const isPng = file.type === 'image/png';
  const out = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', JPEG_QUALITY);
  return {
    background: {
      dataUrl: out,
      fileName: file.name,
      origin: isPng ? 'png' : 'jpg',
      x: 0, y: 0,
      scale: 1,
      rotation: 0,
      opacity: 0.85,
      naturalWidth: scaledW,
      naturalHeight: scaledH,
    },
  };
}

/** PDF-side path: render the first page at a sensible DPI, then downscale
 *  with the same path images use. Falls back to a clear error if pdfjs
 *  fails to parse. */
async function importPdfFirstPage(file: File): Promise<ImportResult> {
  const pdfjs = await import('pdfjs-dist');
  // Use a same-origin worker shipped with pdfjs-dist so the import works
  // on Vercel without bundling. The version is pinned in package.json.
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerSrc;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const totalPages = pdf.numPages;
  const page = await pdf.getPage(1);
  // Render at ~150 DPI equivalent — readable for a blueprint
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF'; // PDFs are usually transparent; lay a white sheet under
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  // Downscale to MAX_EDGE
  const ds = downscaleCanvas(canvas, MAX_EDGE);
  const dataUrl = ds.canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return {
    background: {
      dataUrl,
      fileName: file.name,
      origin: 'pdf',
      x: 0, y: 0,
      scale: 1,
      rotation: 0,
      opacity: 0.85,
      naturalWidth: ds.scaledW,
      naturalHeight: ds.scaledH,
    },
    note: totalPages > 1 ? `Using first page of ${totalPages}.` : undefined,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = src;
  });
}

function downscale(img: HTMLImageElement, maxEdge: number) {
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const scaledW = Math.round(img.naturalWidth * scale);
  const scaledH = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = scaledW;
  canvas.height = scaledH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, scaledW, scaledH);
  return { canvas, scaledW, scaledH };
}

function downscaleCanvas(src: HTMLCanvasElement, maxEdge: number) {
  const longest = Math.max(src.width, src.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  if (scale === 1) return { canvas: src, scaledW: src.width, scaledH: src.height };
  const scaledW = Math.round(src.width * scale);
  const scaledH = Math.round(src.height * scale);
  const out = document.createElement('canvas');
  out.width = scaledW; out.height = scaledH;
  out.getContext('2d')!.drawImage(src, 0, 0, scaledW, scaledH);
  return { canvas: out, scaledW, scaledH };
}
