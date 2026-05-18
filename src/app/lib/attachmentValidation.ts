// attachmentValidation — single module for the size caps, dataURL
// format check, schema check, and localStorage quota probe used by
// both the upload path (AttachmentPanel) and the import path
// (importProjectState in projectStore). Keeping the rules in one
// place means the panel and the import action can never disagree on
// what counts as "too big" or "malformed".

import type { Attachment, AttachmentLinkType, AttachmentCategory, AttachmentStorageMode } from '../store/types';

// ─── Caps ──────────────────────────────────────────────────────────

/** Largest raw image file we'll attempt to downsample. Anything
 *  bigger falls through to metadata-only storage so we don't try to
 *  decode a 50 MB photo into memory. */
export const MAX_RAW_IMAGE_BYTES = 10 * 1024 * 1024;

/** Largest dataURL string we'll persist. Bigger than this and the
 *  downsampler dropped the preview to keep localStorage budgets sane.
 *  Matches the prior `PREVIEW_MAX_RAW_BYTES = 256 KB` intent, applied
 *  to the post-encode dataURL where it actually matters. */
export const MAX_DATAURL_BYTES = 256 * 1024;

/** Largest fileSize value we'll accept on the metadata record itself.
 *  Doesn't constrain the dataURL preview (which has its own cap), but
 *  rejects obviously bogus file-size values on import. 50 MB is well
 *  beyond any sensible install photo or spec PDF. */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const VALID_LINK_TYPES: readonly AttachmentLinkType[] = [
  'project', 'floor', 'device', 'door', 'pathway', 'workOrder', 'report',
];
const VALID_CATEGORIES: readonly AttachmentCategory[] = [
  'photo', 'video', 'pdf', 'spec', 'drawing', 'closeout', 'note', 'other',
];
const VALID_STORAGE_MODES: readonly AttachmentStorageMode[] = [
  'local-preview', 'local-meta', 'cloud',
];

// ─── Shape + size validation ───────────────────────────────────────

export type AttachmentValidationResult =
  | { ok: true; value: Attachment }
  | { ok: false; reason: AttachmentValidationReason };

export type AttachmentValidationReason =
  | 'not-object'
  | 'missing-id'
  | 'missing-projectId'
  | 'bad-linkType'
  | 'missing-linkedObjectId'
  | 'missing-fileName'
  | 'missing-fileType'
  | 'bad-fileSize'
  | 'oversize-fileSize'
  | 'bad-category'
  | 'missing-createdAt'
  | 'bad-storageMode'
  | 'bad-dataUrl'
  | 'oversize-dataUrl'
  | 'reserved-key';

/** Allowlist of dataURL MIMEs we'll accept on persistence. Matches
 *  what the downsampler emits (`image/jpeg`) plus the lossless raster
 *  formats. SVG is deliberately excluded — it's XML and supports
 *  `<script>` / `<foreignObject>`, so an envelope carrying
 *  `data:image/svg+xml,<svg onload=...>` would be a future XSS sink
 *  the moment any code path renders it in `<object>`, `<iframe>`, or
 *  CSS `url()`. Tight enough to bound the threat without affecting
 *  the legitimate upload path. */
const SAFE_DATAURL_MIME_RE = /^data:image\/(jpeg|png|gif|webp|avif);base64,/i;

/** Base64 alphabet check applied to the payload AFTER the MIME prefix.
 *  Prevents non-base64 garbage (URL-encoded text, truncated payloads)
 *  from passing the regex check above. */
const BASE64_PAYLOAD_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Reject any value whose shape doesn't satisfy the Attachment
 *  contract or whose dataURL/fileSize fields exceed the caps. Pure;
 *  safe to call on arbitrary parsed JSON. Returns the value
 *  unchanged on success (no normalization or coercion). */
export function validateAttachment(input: unknown): AttachmentValidationResult {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'not-object' };
  const o = input as Record<string, unknown>;
  // Prototype-pollution defence on parsed JSON. We only reject
  // OWN-property `__proto__` here. `'constructor' in o` is true for
  // every plain object (inherited from Object.prototype), and
  // `'prototype' in o` is irrelevant for plain objects. Checking
  // those with `in` would reject every attachment.
  if (Object.prototype.hasOwnProperty.call(o, '__proto__')) {
    return { ok: false, reason: 'reserved-key' };
  }
  if (typeof o.id !== 'string' || o.id.length === 0)             return { ok: false, reason: 'missing-id' };
  if (typeof o.projectId !== 'string' || o.projectId.length === 0) return { ok: false, reason: 'missing-projectId' };
  if (typeof o.linkedObjectType !== 'string' || !VALID_LINK_TYPES.includes(o.linkedObjectType as AttachmentLinkType)) {
    return { ok: false, reason: 'bad-linkType' };
  }
  if (typeof o.linkedObjectId !== 'string' || o.linkedObjectId.length === 0) return { ok: false, reason: 'missing-linkedObjectId' };
  if (typeof o.fileName !== 'string' || o.fileName.length === 0) return { ok: false, reason: 'missing-fileName' };
  if (typeof o.fileType !== 'string')                            return { ok: false, reason: 'missing-fileType' };
  if (typeof o.fileSize !== 'number' || !Number.isFinite(o.fileSize) || o.fileSize < 0) {
    return { ok: false, reason: 'bad-fileSize' };
  }
  if (o.fileSize > MAX_FILE_SIZE_BYTES) return { ok: false, reason: 'oversize-fileSize' };
  if (!VALID_CATEGORIES.includes(o.category as AttachmentCategory)) return { ok: false, reason: 'bad-category' };
  if (typeof o.createdAt !== 'number' || !Number.isFinite(o.createdAt)) return { ok: false, reason: 'missing-createdAt' };
  if (!VALID_STORAGE_MODES.includes(o.storageMode as AttachmentStorageMode)) return { ok: false, reason: 'bad-storageMode' };
  if (o.dataUrl !== undefined) {
    if (typeof o.dataUrl !== 'string') return { ok: false, reason: 'bad-dataUrl' };
    // Strict safe-MIME allowlist + base64 payload check. Any envelope
    // carrying `data:text/html`, `data:application/javascript`, or
    // `data:image/svg+xml` is rejected here, regardless of fileType.
    if (!SAFE_DATAURL_MIME_RE.test(o.dataUrl)) return { ok: false, reason: 'bad-dataUrl' };
    const comma = o.dataUrl.indexOf(',');
    const payload = comma >= 0 ? o.dataUrl.slice(comma + 1) : '';
    if (!BASE64_PAYLOAD_RE.test(payload)) return { ok: false, reason: 'bad-dataUrl' };
    if (o.dataUrl.length > MAX_DATAURL_BYTES) return { ok: false, reason: 'oversize-dataUrl' };
  }
  return { ok: true, value: o as unknown as Attachment };
}

// ─── localStorage quota probe ──────────────────────────────────────

/** Hard ceiling on `addBytes` to guard against
 *  `String.prototype.repeat(huge)` blowing up. No legitimate single
 *  attachment is larger than ~1 MB after the dataURL cap. */
const MAX_PROBE_ADD_BYTES = 4 * 1024 * 1024;

/** Probe whether localStorage has room for `addBytes` MORE chars
 *  beyond what's already stored. Writes ONLY the delta (plus a 16 KB
 *  safety margin), NOT the full projected total — browsers throw
 *  QuotaExceededError on the new setItem attempt when the delta
 *  would overflow, so we don't need to materialize the existing
 *  blob's bytes again. This avoids transiently doubling localStorage
 *  usage, which was triggering false-negative storage-full errors on
 *  stores larger than ~50% of quota.
 *
 *  The probe key is per call to avoid cross-tab races leaking probe
 *  state between sibling Zustand persist writers. Cleaned up on
 *  every exit path. */
export function canFitInLocalStorage(addBytes: number, _storeKey = 'deeperVisionStore'): boolean {
  // Per-call unique key so two tabs racing the probe don't trample
  // each other's reservation. _storeKey kept for signature stability
  // even though the probe no longer reads it (the delta-only probe
  // doesn't need the existing blob size).
  const probeKey = `__dv_attachment_quota_probe__${Math.random().toString(36).slice(2)}`;
  try {
    if (typeof localStorage === 'undefined') return true;
    const clamped = Math.max(0, Math.min(addBytes, MAX_PROBE_ADD_BYTES));
    // Delta + 16 KB safety margin for Zustand's envelope overhead
    // (the persist middleware rewrites the entire blob under
    // `deeperVisionStore`, so the actual write delta is roughly the
    // serialized attachment plus map-entry punctuation).
    const probeSize = clamped + 16 * 1024;
    localStorage.setItem(probeKey, 'x'.repeat(probeSize));
    localStorage.removeItem(probeKey);
    return true;
  } catch {
    try { localStorage.removeItem(probeKey); } catch { /* noop */ }
    return false;
  }
}

/** Convenience: serialise the attachment record and ask
 *  `canFitInLocalStorage` whether the delta fits. */
export function canStoreAttachment(att: Attachment, storeKey = 'deeperVisionStore'): boolean {
  let bytes = 0;
  try { bytes = JSON.stringify(att).length; } catch { return false; }
  return canFitInLocalStorage(bytes, storeKey);
}
