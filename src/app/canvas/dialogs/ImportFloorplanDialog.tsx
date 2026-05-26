// ImportFloorplanDialog — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Takes a PNG / JPG / PDF (first page) and turns it
// into the active floor's background. PNG / JPG are read
// directly via FileReader + downscaled inside
// lib/floorplanImport; PDF first page is rendered with
// pdfjs-dist (also inside that lib). DWG / DXF would need a
// backend parser and aren't supported here — the picker
// only accepts the three real formats.

import { Ruler, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import { selectors as storeSelectors, useProjectStore } from '../../store/projectStore';

export function ImportFloorplanDialog({ onClose, onImported, onStartCalibrate }: { onClose: () => void; onImported: () => void; onStartCalibrate?: () => void }) {
  const { projectId = 'p1' } = useParams();
  const setFloorBackground = useProjectStore((s) => s.setFloorBackground);
  // Canvas V2 Pass 2A.4 — target the ACTIVE floor (from the sticky
  // currentFloorIdByProject), not the project's first floor. Without
  // this, uploading a plan while on Level 2 would silently land on
  // Ground floor.
  const stickyFloorId = useProjectStore((s) => s.currentFloorIdByProject[projectId]);
  const fallbackFloorId = useProjectStore((s) => storeSelectors.firstFloorOfProject(s, projectId)?.id ?? '');
  const targetFloorId = stickyFloorId || fallbackFloorId;
  const floor = useProjectStore((s) => (targetFloorId ? (s.floors as any)[targetFloorId] : null) as any);
  const floorId = floor?.id ?? '';
  const floorName = floor?.name ?? 'Floor';
  const buildings = useProjectStore((s) => s.buildings);
  const buildingName = floor?.buildingId ? (buildings as any)[floor.buildingId]?.name ?? '' : '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Last successful import result, used for the preview + name editor.
  const [preview, setPreview] = useState<{ dataUrl: string; fileName: string; w: number; h: number } | null>(null);
  const [planName, setPlanName] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (!floorId) {
      setError('No floor selected. Add a building first.');
      return;
    }
    setBusy(true); setError(null); setNote(null);
    try {
      const { importFloorplanFile } = await import('../../lib/floorplanImport');
      const { background, note: n } = await importFloorplanFile(file);
      setFloorBackground(floorId, background);
      setPreview({
        dataUrl: background.dataUrl,
        fileName: background.fileName,
        w: background.naturalWidth,
        h: background.naturalHeight,
      });
      setPlanName(background.fileName.replace(/\.[a-z0-9]+$/i, ''));
      setNote(n ?? null);
      // Don't close yet — the user reviews the preview and clicks the
      // explicit "Save & set scale" CTA below. That makes the workflow
      // step-by-step instead of bouncing them straight back to the canvas.
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  // Persist the edited plan name onto the floor's background record.
  const commitPlanName = () => {
    if (!floorId || !preview) return;
    const cleaned = (planName || '').trim() || preview.fileName;
    setFloorBackground(floorId, { ...(floor.background ?? {}), fileName: cleaned } as any);
  };

  // "Save & set scale →" — closes the modal, fires the optional
  // calibrate-now hook so the parent can arm the in-canvas Calibrate
  // tool, and lets the parent know an import happened.
  const onSaveAndCalibrate = () => {
    if (preview) {
      commitPlanName();
      onImported();
      if (onStartCalibrate) onStartCalibrate();
      onClose();
    }
  };
  // "Save without scale" — same as above but skips arming the
  // calibrate tool. Useful when the user wants to take a look first.
  const onSaveOnly = () => {
    if (preview) {
      commitPlanName();
      onImported();
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[480px] bg-card border border-border rounded-xl shadow-2xl">
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <div className="text-[14px] font-medium tracking-tight">Upload a floor plan</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, or PDF (first page). After upload you'll preview, name, and set the scale.</div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            data-testid="import-file-input"
          />

          {!preview && (
            <button
              onClick={handlePick}
              disabled={busy}
              className="w-full px-3 py-5 rounded-lg border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/4 transition-colors text-left"
              data-testid="import-pick-btn"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-[12px] font-medium">{busy ? 'Processing…' : 'Pick a file'}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, or PDF (first page) · up to ~2k px on the longest edge</div>
                </div>
              </div>
            </button>
          )}

          {preview && (
            <div className="space-y-3" data-testid="import-preview-panel">
              {/* Preview thumbnail — fixed height so any image / orientation
                  reads at a glance. The "Scale not verified" status sits
                  on top to make the next step obvious. */}
              <div className="relative rounded-lg overflow-hidden border border-border bg-secondary/30" style={{ aspectRatio: '4 / 3' }}>
                <img
                  src={preview.dataUrl}
                  alt={preview.fileName}
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.10em] border border-amber-400/40 bg-amber-400/15 text-amber-300">
                  Scale not verified
                </div>
                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[9.5px] uppercase tracking-[0.10em] bg-black/55 text-white/85">
                  {preview.w}×{preview.h}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-[0.10em] mb-1">Plan name</div>
                  <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    onBlur={commitPlanName}
                    placeholder="Ground floor — east wing"
                    data-testid="import-name-input"
                    className="w-full h-8 px-2 rounded border border-border bg-background text-[12px] text-foreground focus:outline-none focus:border-primary/60"
                  />
                </label>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="text-[10px] uppercase tracking-[0.10em]">Floor</span>
                  <span className="text-foreground">{buildingName ? `${buildingName} · ` : ''}{floorName}</span>
                  <span className="ml-auto text-[10px] italic">Multi-floor switching is one project view away — this pass writes to the active floor.</span>
                </div>
              </div>
            </div>
          )}

          {note && (
            <div className="px-3 py-2 rounded border border-amber-500/30 bg-amber-500/5 text-[11px] text-amber-200/90">
              {note}
            </div>
          )}
          {error && (
            <div className="px-3 py-2 rounded border border-red-500/40 bg-red-500/5 text-[11px] text-red-300">
              {error}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          {!preview ? (
            <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
              Close
            </button>
          ) : (
            <>
              <button onClick={() => { setPreview(null); setPlanName(''); }} className="text-[12px] px-3 h-8 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" data-testid="import-replace-btn">
                Replace file
              </button>
              <button onClick={onSaveOnly} className="text-[12px] px-3 h-8 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" data-testid="import-save-only">
                Save without scale
              </button>
              <button onClick={onSaveAndCalibrate} className="text-[12px] px-3 h-8 rounded-md bg-primary text-primary-foreground hover:opacity-90 font-medium inline-flex items-center gap-1.5" data-testid="import-save-and-scale">
                <Ruler className="w-3 h-3" />Save & set scale →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
