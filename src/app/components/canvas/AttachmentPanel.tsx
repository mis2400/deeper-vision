// AttachmentPanel — reusable surface for attaching files to any canvas
// object (device, door, pathway), a work order, the project root, or
// a report. Persists via the shared `attachments` slice so the same
// data feeds the Reports Center attachments summary and the
// Project State export envelope.
//
// Honesty contract:
//   - Cloud file storage is NOT connected.
//   - Small images get a real local thumbnail (canvas-downsampled to
//     max 800px on long edge as JPEG q0.8). Everything else stores
//     metadata only (filename / size / MIME / category / notes) and
//     renders a file-card without a preview.
//   - Storage caps: dataUrl preview ≤ 256 KB raw before downsample
//     (typical downsample lands under 120 KB). Larger files fall back
//     to metadata-only.
//   - The footer line spells the contract out so users aren't
//     surprised the file "isn't really uploaded anywhere".

import { useState, useRef, useCallback, useMemo } from 'react';
import {
  useProjectStore, attachmentsFor,
} from '../../store/projectStore';
import {
  MAX_RAW_IMAGE_BYTES, MAX_DATAURL_BYTES, canFitInLocalStorage,
} from '../../lib/attachmentValidation';
import type { Attachment, AttachmentCategory, AttachmentLinkType } from '../../store/types';
import {
  Paperclip, Upload, X, Image as ImageIcon, FileText, Film, FileSpreadsheet,
  PencilRuler, ClipboardCheck, StickyNote, FileQuestion, Lock, EyeOff,
  Trash2, Plus,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  projectId: string;
  linkedObjectType: AttachmentLinkType;
  linkedObjectId: string;
  /** Default category preselected in the picker. Useful for surfaces
   *  that lean toward one type (e.g. WO photos → 'photo'). */
  defaultCategory?: AttachmentCategory;
  /** Whether the "internal-only" checkbox is exposed. Off for the
   *  customer-facing review surfaces; on for engineering inspectors
   *  and work orders. */
  showInternalToggle?: boolean;
  /** Tighter padding + smaller fonts for embed in drawers. */
  compact?: boolean;
  /** Render hint above the picker (e.g. "Install photos"). */
  title?: string;
  /** When set, drives the `uploadedBy` field on new attachments. */
  uploadedBy?: string;
}

const CATEGORY_META: Record<AttachmentCategory, { label: string; icon: any; tone: string }> = {
  photo:    { label: 'Photo',    icon: ImageIcon,    tone: '#22D3EE' },
  video:    { label: 'Video',    icon: Film,         tone: '#A371F7' },
  pdf:      { label: 'PDF',      icon: FileText,     tone: '#EF4444' },
  spec:     { label: 'Spec',     icon: FileSpreadsheet, tone: '#10B981' },
  drawing:  { label: 'Drawing',  icon: PencilRuler,  tone: '#7CC4FF' },
  closeout: { label: 'Closeout', icon: ClipboardCheck, tone: '#F59E0B' },
  note:     { label: 'Note',     icon: StickyNote,   tone: '#F472B6' },
  other:    { label: 'Other',    icon: FileQuestion, tone: '#94A3B8' },
};

/** Long-edge max after downsample (px). */
const DOWNSAMPLE_MAX_EDGE = 800;
/** JPEG quality used when downsampling. */
const DOWNSAMPLE_QUALITY = 0.8;
// Raw image cap + post-downsample cap come from the shared validation
// module so the panel and the import path can never drift. Source
// images up to MAX_RAW_IMAGE_BYTES (10 MB) get a downsample attempt;
// the resulting dataURL is then capped at MAX_DATAURL_BYTES (256 KB)
// before it lands in localStorage.

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

async function downsampleImageToDataUrl(file: File): Promise<string | undefined> {
  // Read as ObjectURL, draw to canvas at downsampled size, export as JPEG.
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      const long = Math.max(w, h);
      const scale = long > DOWNSAMPLE_MAX_EDGE ? DOWNSAMPLE_MAX_EDGE / long : 1;
      const tw = Math.max(1, Math.round(w * scale));
      const th = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(undefined); return; }
      ctx.drawImage(img, 0, 0, tw, th);
      try {
        // JPEG keeps the dataURL bounded.
        resolve(canvas.toDataURL('image/jpeg', DOWNSAMPLE_QUALITY));
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(undefined); };
    img.src = url;
  });
}

function fmtBytes(n: number): string {
  if (n === 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)        return 'just now';
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function inferCategoryFromMime(mime: string, name: string, override?: AttachmentCategory): AttachmentCategory {
  if (override) return override;
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (/\.(xlsx?|csv)$/i.test(name)) return 'spec';
  if (/\.(dwg|dxf)$/i.test(name)) return 'drawing';
  return 'other';
}

export function AttachmentPanel({
  projectId, linkedObjectType, linkedObjectId,
  defaultCategory, showInternalToggle = true, compact, title, uploadedBy,
}: Props) {
  const addAttachment = useProjectStore((s) => s.addAttachment);
  const removeAttachment = useProjectStore((s) => s.removeAttachment);
  const updateAttachment = useProjectStore((s) => s.updateAttachment);
  // Subscribe to the slice so the list re-renders on add/remove.
  const allAttachments = useProjectStore((s) => s.attachments);
  const items = useMemo(
    () => attachmentsFor({ attachments: allAttachments } as any, linkedObjectType, linkedObjectId)
      .sort((a, b) => b.createdAt - a.createdAt),
    [allAttachments, linkedObjectType, linkedObjectId],
  );

  const [draftCategory, setDraftCategory] = useState<AttachmentCategory>(defaultCategory ?? 'photo');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftInternal, setDraftInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    // Track per-file outcome so the closing toast tells the truth.
    // The prior version fired toast.success unconditionally even when
    // addAttachment's persist write was silently dropped by quota.
    const accepted: string[] = [];
    const skipped: { fileName: string; reason: string }[] = [];
    // Cumulative bytes already committed in THIS batch. Each probe
    // adds it to the candidate's bytes because Zustand's persist
    // middleware flushes once asynchronously per microtask, so the
    // probe on file N has to account for files 1..N-1 not having
    // landed in localStorage yet. Without this, a batch of 5 files
    // that each pass the individual probe could collectively
    // overflow and silently fail at flush time.
    let pendingBytes = 0;
    try {
      for (const file of list) {
        const category = inferCategoryFromMime(file.type, file.name, draftCategory);
        let dataUrl: string | undefined;
        let storageMode: 'local-preview' | 'local-meta' = 'local-meta';
        // Try a downsample preview only for images within the raw cap.
        // Larger raw files fall through to metadata-only without
        // attempting to decode them into memory.
        if (isImageMime(file.type) && file.size <= MAX_RAW_IMAGE_BYTES) {
          try {
            const candidate = await downsampleImageToDataUrl(file);
            // Post-encode size check: if the downsampled JPEG still
            // exceeds the preview cap, drop the preview and fall back
            // to metadata-only rather than persisting a huge string.
            if (candidate && candidate.length <= MAX_DATAURL_BYTES) {
              dataUrl = candidate;
              storageMode = 'local-preview';
            }
          } catch {
            dataUrl = undefined;
          }
        }
        const att: Attachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          projectId,
          linkedObjectType,
          linkedObjectId,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
          category,
          uploadedBy,
          createdAt: Date.now(),
          notes: draftNotes.trim() || undefined,
          internalOnly: draftInternal || undefined,
          dataUrl,
          storageMode,
        };
        // Probe localStorage BEFORE the addAttachment call. Zustand's
        // persist middleware writes asynchronously after `set()`
        // returns, so a try/catch around addAttachment cannot see a
        // QuotaExceededError — the panel would have lied and toasted
        // success on a write that never landed. The probe is
        // conservative; false negatives are acceptable, false
        // positives are not. The cumulative `pendingBytes` accounts
        // for files committed earlier in this same batch that
        // haven't flushed yet.
        let attBytes = 0;
        try { attBytes = JSON.stringify(att).length; } catch { attBytes = (att.dataUrl?.length ?? 0) + 2048; }
        if (!canFitInLocalStorage(pendingBytes + attBytes)) {
          skipped.push({ fileName: file.name, reason: 'browser storage is full' });
          continue;
        }
        try {
          addAttachment(att);
          accepted.push(file.name);
          pendingBytes += attBytes;
        } catch (e: any) {
          skipped.push({ fileName: file.name, reason: String(e?.message ?? e) });
        }
      }
      // Only clear the draft fields if at least one file landed; if
      // every file was skipped, the user's notes / internal-only
      // choice stay so they can retry without retyping.
      if (accepted.length > 0) {
        setDraftNotes('');
        setDraftInternal(false);
        toast.success(`${accepted.length} attachment${accepted.length === 1 ? '' : 's'} added`, {
          duration: 2500,
        });
      }
      if (skipped.length > 0) {
        // Group identical reasons so the toast stays scannable when
        // a batch hits the same quota wall multiple times.
        const byReason = new Map<string, number>();
        for (const s of skipped) byReason.set(s.reason, (byReason.get(s.reason) ?? 0) + 1);
        const summary = Array.from(byReason.entries())
          .map(([reason, count]) => `${count} · ${reason}`).join(' · ');
        toast.error(`${skipped.length} attachment${skipped.length === 1 ? '' : 's'} could not be stored`, {
          description: summary + ' · try smaller files, remove old attachments, or export + clear local state.',
          duration: 7000,
        });
      }
    } finally {
      setBusy(false);
    }
  }, [projectId, linkedObjectType, linkedObjectId, draftCategory, draftNotes, draftInternal, uploadedBy, addAttachment]);

  const onFilePicked = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const padding = compact ? 'p-2.5' : 'p-3';

  return (
    <div className={`rounded-lg border border-border bg-secondary/10 ${padding} space-y-2.5`} data-testid="attachment-panel" data-link-type={linkedObjectType} data-link-id={linkedObjectId}>
      {title && (
        <div className="flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
        </div>
      )}

      {/* Drop zone + file picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.dwg,.dxf,.xlsx,.xls,.csv,.txt"
        className="hidden"
        onChange={onFilePicked}
        data-testid="attachment-file-input"
      />
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-md border-2 border-dashed text-center cursor-pointer transition-colors ${dragOver ? 'border-primary/60 bg-primary/10' : 'border-border bg-background/40 hover:bg-secondary/30'} ${compact ? 'p-2.5' : 'p-3'}`}
        data-testid="attachment-dropzone"
      >
        <Upload className={`mx-auto mb-1 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-muted-foreground`} />
        <div className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-foreground/80`}>
          {busy ? 'Saving…' : 'Drop files or click to attach'}
        </div>
        <div className="text-[9.5px] text-muted-foreground mt-0.5">
          Images, PDFs, specs, drawings. Image previews are downsampled locally.
        </div>
      </div>

      {/* Category + notes + internal toggle */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <select
          value={draftCategory}
          onChange={(e) => setDraftCategory(e.target.value as AttachmentCategory)}
          className="text-[11px] h-7 px-2 rounded border border-border bg-background focus:outline-none focus:border-primary/50"
          data-testid="attachment-category-select"
        >
          {(Object.keys(CATEGORY_META) as AttachmentCategory[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_META[c].label}</option>
          ))}
        </select>
        <input
          type="text"
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          placeholder="Optional notes (e.g. 'rough-in, before drywall')"
          className="flex-1 min-w-[140px] text-[11px] h-7 px-2 rounded border border-border bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
          data-testid="attachment-notes-input"
        />
        {showInternalToggle && (
          <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draftInternal}
              onChange={(e) => setDraftInternal(e.target.checked)}
              className="w-3 h-3"
              data-testid="attachment-internal-toggle"
            />
            <Lock className="w-3 h-3" />Internal
          </label>
        )}
      </div>

      {/* Attachment list */}
      {items.length === 0 ? (
        <div className="text-[10px] text-muted-foreground italic text-center py-1.5">
          No attachments yet.
        </div>
      ) : (
        <ul className="space-y-1.5" data-testid="attachment-list">
          {items.map((att) => {
            const meta = CATEGORY_META[att.category];
            const Icon = meta.icon;
            return (
              <li key={att.id} className="flex items-start gap-2 p-1.5 rounded-md border border-border bg-background/40" data-testid="attachment-row" data-attachment-id={att.id}>
                {att.dataUrl ? (
                  <img src={att.dataUrl} alt={att.fileName} className="w-12 h-12 rounded object-cover shrink-0 border border-border" />
                ) : (
                  <div className="w-12 h-12 rounded shrink-0 border border-border flex items-center justify-center" style={{ background: `${meta.tone}10`, color: meta.tone }}>
                    <Icon className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-medium text-foreground truncate" title={att.fileName}>{att.fileName}</span>
                    {att.internalOnly && (
                      <span className="text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border border-amber-400/40 bg-amber-400/10 text-amber-400 inline-flex items-center gap-0.5" title="Hidden from customer view in Reports">
                        <EyeOff className="w-2.5 h-2.5" />Internal
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <span className="uppercase tracking-[0.1em]" style={{ color: meta.tone }}>{meta.label}</span>
                    <span>·</span>
                    <span>{fmtBytes(att.fileSize)}</span>
                    <span>·</span>
                    <span>{relativeTime(att.createdAt)}</span>
                  </div>
                  {att.notes && (
                    <div className="text-[10px] text-foreground/75 mt-1 italic line-clamp-2">{att.notes}</div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (!window.confirm(`Delete attachment "${att.fileName}"?`)) return;
                    removeAttachment(att.id);
                    toast.message('Attachment removed', { description: att.fileName, duration: 2500 });
                  }}
                  className="h-6 w-6 rounded inline-flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0"
                  title="Delete attachment"
                  data-track="attachment-delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

    </div>
  );
}
