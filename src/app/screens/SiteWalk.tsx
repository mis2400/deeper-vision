// Site Walk — V1 4D. Mobile-first capture surface the operator uses on
// site, before there's a calibrated floor plan or any placed devices.
// Each capture carries a room label, optional photo (downscaled JPEG
// stored inline), optional voice memo (MediaRecorder → base64), and an
// optional GPS fix. Persists through the SiteCapture slice. Exports a
// PDF report so captures don't have to live in localStorage forever.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  Camera, Mic, MicOff, MapPin, Plus, ArrowRight, Trash2, FileDown,
  Image as ImageIcon, Square, Play, Pause, X, Crosshair, AlertTriangle,
} from 'lucide-react';

import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { useProjectStore } from '../store/projectStore';
import type { SiteCapture, Project } from '../store/types';
import {
  downscalePhoto, useVoiceRecorder, bytesLabel, formatDuration, DownscaleError,
} from '../lib/mediaCapture';
import type { RecorderResult, RecorderState } from '../lib/mediaCapture';

// Soft cap on per-project storage so the operator gets warned BEFORE
// localStorage actually throws. 4 MB leaves headroom for the rest of
// the persisted store (typical V1 project ~200 KB without captures).
const STORAGE_CAP_BYTES = 4 * 1024 * 1024;

// ──────────────────────────── Screen ─────────────────────────────
export function SiteWalk() {
  const { projectId: rawProjectId } = useParams();
  const nav = useNavigate();
  const projects = useProjectStore((s) => s.projects);

  // Fall back to the first project when the URL has no id (legacy /sitewalk).
  const projectId = useMemo(() => {
    if (rawProjectId && projects[rawProjectId]) return rawProjectId;
    const first = Object.values(projects)[0] as Project | undefined;
    return first?.id ?? 'p1';
  }, [rawProjectId, projects]);

  const project = projects[projectId];

  // Pull the raw map and derive the list with useMemo so the snapshot
  // returned to React stays referentially stable across renders that
  // don't actually change the slice. Selecting the filtered+sorted
  // result inside useProjectStore would emit a new array each render
  // and infinite-loop React's external-store subscription.
  const siteCapturesMap = useProjectStore((s) => s.siteCaptures);
  const captures = useMemo(
    () => Object.values(siteCapturesMap)
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt),
    [siteCapturesMap, projectId],
  );
  const removeSiteCapture = useProjectStore((s) => s.removeSiteCapture);
  const updateSiteCapture = useProjectStore((s) => s.updateSiteCapture);

  // Let the effect own selection; saves us from reading captures
  // during initial render only to immediately override on commit.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Keep selection valid as captures get added / removed.
  useEffect(() => {
    if (!captures.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !captures.some((c) => c.id === selectedId)) {
      setSelectedId(captures[0].id);
    }
  }, [captures, selectedId]);

  const selected = captures.find((c) => c.id === selectedId) ?? null;

  // ── Per-project storage meter ─────────────────────────────────
  const usedBytes = useMemo(() => captures.reduce(
    (sum, c) => sum + (c.photoBytes ?? 0) + (c.audioBytes ?? 0),
    0,
  ), [captures]);
  const usedPct = Math.min(100, Math.round((usedBytes / STORAGE_CAP_BYTES) * 100));
  const storageWarn = usedBytes > STORAGE_CAP_BYTES * 0.8;
  const hasGps = captures.some((c) => c.lat != null && c.lng != null);

  // ── Header subtitle ────────────────────────────────────────────
  const newestTs = captures[0]?.createdAt;
  const subtitle = captures.length
    ? `${captures.length} ${captures.length === 1 ? 'capture' : 'captures'} · last ${formatRelative(newestTs!)}`
    : 'No captures yet';

  const handleDelete = (id: string) => {
    removeSiteCapture(id);
    toast.success('Capture removed.');
  };

  const handleExportPdf = async () => {
    if (!captures.length) {
      toast.error('Nothing to export yet. Add a capture first.');
      return;
    }
    try {
      await exportSiteWalkPdf(project?.name ?? 'Site walk', captures);
      toast.success(hasGps
        ? 'Site walk report downloaded. Note: it contains GPS coordinates.'
        : 'Site walk report downloaded.');
    } catch (err) {
      console.error('Site walk PDF export', err);
      toast.error('Could not generate the PDF.');
    }
  };

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Site walk' }]}
      title="Site walk"
      subtitle={subtitle}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />New capture
          </Button>
          {captures.length > 0 && (
            <>
              <Button size="sm" variant="secondary" onClick={handleExportPdf}>
                <FileDown className="w-3.5 h-3.5 mr-1" />Export PDF
              </Button>
              <Button size="sm" variant="secondary" onClick={() => nav(`/calibrate/${projectId}`)}>
                Calibrate floor <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {captures.length === 0 ? (
          <EmptyState onCreate={() => setSheetOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
            <CaptureGrid
              captures={captures}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <aside className="space-y-3">
              {storageWarn && (
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Storage almost full
                  </div>
                  <div className="mt-1 leading-relaxed">
                    Captures live in the browser until you export them. Export to PDF, then remove the oldest to keep recording.
                  </div>
                </div>
              )}
              <StorageMeter usedBytes={usedBytes} usedPct={usedPct} captureCount={captures.length} />
              {selected && (
                <CaptureDetail
                  capture={selected}
                  onUpdate={(patch) => updateSiteCapture(selected.id, patch)}
                  onDelete={() => handleDelete(selected.id)}
                />
              )}
            </aside>
          </div>
        )}
      </div>

      {sheetOpen && (
        <CaptureSheet
          projectId={projectId}
          usedBytes={usedBytes}
          onClose={() => setSheetOpen(false)}
          onSaved={(id) => setSelectedId(id)}
        />
      )}
    </AppShell>
  );
}

// ──────────────────────────── Empty state ─────────────────────────
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-card border border-border rounded-lg py-16 px-6 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
        <Camera className="w-6 h-6 text-primary" />
      </div>
      <h3 className="mt-4 text-base">Start your site walk</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        Capture rooms, doors, IDF closets, and existing infrastructure as you walk. Each capture saves a label, an optional photo, an optional voice note, and a GPS fix you can review later or export as a PDF.
      </p>
      <Button onClick={onCreate} className="mt-5">
        <Plus className="w-4 h-4 mr-1.5" />Add first capture
      </Button>
    </div>
  );
}

// ──────────────────────────── Capture grid ────────────────────────
function CaptureGrid({
  captures, selectedId, onSelect,
}: {
  captures: SiteCapture[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
      {captures.map((c) => {
        const active = c.id === selectedId;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`group text-left bg-card border rounded-lg overflow-hidden transition-colors ${active ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-border-strong'}`}
          >
            <div className="aspect-[4/3] bg-secondary overflow-hidden relative">
              {c.photoDataUrl ? (
                <img src={c.photoDataUrl} alt={c.label} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-8 h-8 opacity-40" />
                </div>
              )}
              {c.audioDataUrl && (
                <div className="absolute bottom-1.5 right-1.5 bg-foreground/80 text-background text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <Mic className="w-2.5 h-2.5" />
                  {formatDuration(c.audioDurationMs ?? 0)}
                </div>
              )}
            </div>
            <div className="p-2.5">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 flex-none" />
                <span className="truncate">{c.label}</span>
              </div>
              {c.note && <div className="text-sm mt-1 line-clamp-2">{c.note}</div>}
              <div className="text-[11px] text-muted-foreground mt-1">{formatRelative(c.createdAt)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────── Capture detail panel ────────────────
function CaptureDetail({
  capture, onUpdate, onDelete,
}: {
  capture: SiteCapture;
  onUpdate: (patch: Partial<SiteCapture>) => void;
  onDelete: () => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(capture.note ?? '');

  // Reset note draft when selection changes.
  useEffect(() => {
    setNoteDraft(capture.note ?? '');
    setEditingNote(false);
  }, [capture.id, capture.note]);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {capture.photoDataUrl ? (
        <div className="aspect-[4/3] bg-secondary overflow-hidden">
          <img src={capture.photoDataUrl} alt={capture.label} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-[4/3] bg-secondary flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <ImageIcon className="w-8 h-8 mx-auto opacity-40" />
            <div className="text-xs mt-2">No photo on this capture</div>
          </div>
        </div>
      )}
      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />{capture.label}
          </div>
          <div className="text-xs text-muted-foreground">{new Date(capture.createdAt).toLocaleString()}</div>
        </div>

        {capture.audioDataUrl && (
          <AudioPlayer src={capture.audioDataUrl} durationMs={capture.audioDurationMs ?? 0} />
        )}

        <div>
          {editingNote ? (
            <div className="space-y-2">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={4}
                className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm resize-none"
                placeholder="Add a note for engineering"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { onUpdate({ note: noteDraft.trim() || undefined }); setEditingNote(false); toast.success('Note saved.'); }}>Save note</Button>
                <Button size="sm" variant="ghost" onClick={() => { setNoteDraft(capture.note ?? ''); setEditingNote(false); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingNote(true)}
              className="w-full text-left text-sm leading-relaxed border border-dashed border-border rounded-md p-2.5 hover:border-border-strong transition-colors"
            >
              {capture.note || <span className="text-muted-foreground">Add a note</span>}
            </button>
          )}
        </div>

        {(capture.lat != null && capture.lng != null) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Crosshair className="w-3 h-3" />
            {capture.lat.toFixed(5)}, {capture.lng.toFixed(5)}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground border-t border-border pt-2.5 flex flex-wrap gap-x-3 gap-y-1">
          {capture.photoBytes != null && <span>Photo {bytesLabel(capture.photoBytes)}</span>}
          {capture.audioBytes != null && <span>Audio {bytesLabel(capture.audioBytes)}</span>}
          {capture.author && <span>By {capture.author}</span>}
        </div>

        <div>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5 mr-1" />Remove capture
          </Button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── Audio player ────────────────────────
// Lightweight playback element. The underlying audio tag handles
// codec support across browsers; we just front-end the play / pause
// button so the chrome matches the rest of the surface.
function AudioPlayer({ src, durationMs }: { src: string; durationMs: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(false);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, [src]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      try {
        await el.play();
        setPlaying(true);
      } catch {
        toast.error('Could not play the recording.');
      }
    }
  };

  return (
    <div className="flex items-center gap-2 bg-secondary rounded-md px-2.5 py-2">
      <button
        onClick={toggle}
        className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 text-xs text-muted-foreground">Voice note · {formatDuration(durationMs)}</div>
      <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} preload="metadata" />
    </div>
  );
}

// ──────────────────────────── Storage meter ───────────────────────
function StorageMeter({ usedBytes, usedPct, captureCount }: { usedBytes: number; usedPct: number; captureCount: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Local storage</span>
        <span>{bytesLabel(usedBytes)} of {bytesLabel(STORAGE_CAP_BYTES)}</span>
      </div>
      <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${usedPct}%`,
            background: usedPct > 80 ? 'var(--destructive)' : 'var(--primary)',
            transitionDuration: 'var(--motion-standard)',
          }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">{captureCount} {captureCount === 1 ? 'capture' : 'captures'} on this project</div>
    </div>
  );
}

// ──────────────────────────── Capture sheet ───────────────────────
// Sliding bottom sheet on mobile, centered modal on larger screens.
// Single screen flow: label + note + photo + voice + GPS + Save.
function CaptureSheet({
  projectId, usedBytes, onClose, onSaved,
}: {
  projectId: string;
  usedBytes: number;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const addSiteCapture = useProjectStore((s) => s.addSiteCapture);
  const author = useProjectStore((s) => s.userPrefs?.fullName || s.userPrefs?.jobTitle || undefined);

  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<{ dataUrl: string; bytes: number } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recorder = useVoiceRecorder();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Sheet liveness so async paths (photo encode, geolocation, save)
  // can skip setState after unmount.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // ── Lock body scroll while open. iOS Safari needs the position-fixed
  // pattern; plain overflow:hidden lets rubber-band scroll the page
  // behind the modal. We capture scrollY, fix the body, then restore
  // on unmount. The cleanup runs even if we crash the sheet mid-flow.
  useEffect(() => {
    const body = document.body;
    const scrollY = window.scrollY;
    const prevPos = body.style.position;
    const prevTop = body.style.top;
    const prevW = body.style.width;
    const prevOverflow = body.style.overflow;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    return () => {
      body.style.position = prevPos;
      body.style.top = prevTop;
      body.style.width = prevW;
      body.style.overflow = prevOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // ── ESC closes ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhotoFile = async (file: File) => {
    if (!aliveRef.current) return;
    setPhotoBusy(true);
    try {
      const result = await downscalePhoto(file);
      if (!aliveRef.current) return;
      setPhoto({ dataUrl: result.dataUrl, bytes: result.bytes });
    } catch (err: any) {
      if (!aliveRef.current) return;
      // Show fixed operator copy per error kind; never leak raw err.message.
      if (err instanceof DownscaleError) {
        toast.error(err.message);
      } else {
        toast.error('Could not process that photo.');
      }
    } finally {
      if (aliveRef.current) setPhotoBusy(false);
    }
  };

  const handleGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('This browser does not expose location.');
      return;
    }
    setGpsBusy(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!aliveRef.current) return;
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsBusy(false);
      },
      (err) => {
        if (!aliveRef.current) return;
        setGpsBusy(false);
        if (err.code === err.PERMISSION_DENIED) setGpsError('Location was denied.');
        else if (err.code === err.POSITION_UNAVAILABLE) setGpsError('No GPS fix available right now.');
        else if (err.code === err.TIMEOUT) setGpsError('Location lookup timed out.');
        else setGpsError('Could not read location.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  };

  // Cancel / close. If a recording is in flight, stop it cleanly so the
  // mic indicator clears, then discard the blob (operator dismissed the
  // sheet — they don't want this capture).
  const handleClose = async () => {
    if (recorder.state === 'recording' || recorder.state === 'finalising') {
      await recorder.stop();
    }
    onClose();
  };

  const canSave = label.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // If still recording, stop and capture the result so we don't lose
      // it. The hook drains MediaRecorder, returns the finalised blob.
      let voice: RecorderResult | null = recorder.result;
      if (recorder.state === 'recording' || recorder.state === 'finalising') {
        voice = await recorder.stop();
      }

      // Preflight storage check. Zustand persist writes to localStorage
      // inside set(), but if setItem throws QuotaExceededError the
      // middleware swallows it via console.error rather than rethrowing
      // — so our try/catch here will not see the failure. Pre-validate
      // against the soft cap and refuse before mutating the store.
      const projected = usedBytes + (photo?.bytes ?? 0) + (voice?.bytes ?? 0);
      if (projected > STORAGE_CAP_BYTES) {
        toast.error('Local storage cap reached. Export to PDF and remove older captures, then try again.');
        if (aliveRef.current) setSaving(false);
        return;
      }

      const id = addSiteCapture({
        projectId,
        label: label.trim(),
        note: note.trim() || undefined,
        photoDataUrl: photo?.dataUrl,
        photoBytes: photo?.bytes,
        audioDataUrl: voice?.dataUrl,
        audioBytes: voice?.bytes,
        audioDurationMs: voice?.durationMs,
        lat: gps?.lat,
        lng: gps?.lng,
        author: author || undefined,
      });
      toast.success('Capture saved.');
      onSaved(id);
      onClose();
    } catch (err: any) {
      // Defensive: any other unexpected throw still surfaces honestly.
      // Do NOT log the capture content (photoDataUrl / audioDataUrl /
      // GPS) — log only the message + name.
      console.error('addSiteCapture failed', err?.name, err?.message);
      toast.error('Could not save. Local storage may be full. Export to PDF and remove older captures.');
      if (aliveRef.current) setSaving(false);
    }
  };

  // Toggle recording. The recorder hook handles the underlying lifecycle.
  const toggleRecord = async () => {
    if (recorder.state === 'recording') {
      await recorder.stop();
    } else {
      await recorder.start();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40">
      <div
        // Use vh by default for legacy iOS; progressively enhance to dvh
        // on browsers that support it so the sheet doesn't get cropped by
        // the URL bar.
        className="bg-card w-full sm:max-w-lg sm:rounded-xl shadow-2xl border-t sm:border border-border max-h-[92vh] [@supports(height:100dvh)]:max-h-[92dvh] overflow-y-auto"
        role="dialog"
        aria-label="New site walk capture"
      >
        <div className="sticky top-0 bg-card border-b border-border flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm">New capture</div>
            <div className="text-xs text-muted-foreground">Saved locally to this project</div>
          </div>
          <button
            onClick={() => void handleClose()}
            className="p-3 -mr-2 rounded hover:bg-secondary"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Label */}
          <div>
            <label className="text-xs text-muted-foreground">Room or area label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Lobby NE, IDF closet, Loading dock"
              autoFocus
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="text-xs text-muted-foreground">Photo</label>
            <div className="mt-1.5">
              {photo ? (
                <div className="relative rounded-md overflow-hidden border border-border">
                  <img src={photo.dataUrl} alt="Capture preview" className="w-full max-h-64 object-cover" />
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>Retake</Button>
                    <Button size="sm" variant="secondary" onClick={() => setPhoto(null)}>Remove</Button>
                  </div>
                  <div className="absolute bottom-2 left-2 text-[11px] bg-foreground/70 text-background px-2 py-0.5 rounded">
                    {bytesLabel(photo.bytes)}
                  </div>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoBusy}
                  className="w-full"
                >
                  <Camera className="w-4 h-4 mr-1.5" />
                  {photoBusy ? 'Processing photo…' : 'Take or choose a photo'}
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoFile(file);
                  // Reset value so re-selecting the same file re-fires onChange.
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {/* Voice memo */}
          <div>
            <label className="text-xs text-muted-foreground">Voice note</label>
            <div className="mt-1.5">
              {!recorder.supported ? (
                <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md px-3 py-2">
                  Voice recording is not available in this browser.
                </div>
              ) : recorder.result ? (
                <div className="flex items-center gap-2 bg-secondary rounded-md px-2.5 py-2">
                  <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div>Voice note ready</div>
                    <div className="text-muted-foreground">{formatDuration(recorder.result.durationMs)} · {bytesLabel(recorder.result.bytes)}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={recorder.reset}>Redo</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    variant={recorder.state === 'recording' ? 'danger' : 'secondary'}
                    onClick={toggleRecord}
                    className="w-full"
                  >
                    <RecordButtonLabel state={recorder.state} elapsedMs={recorder.elapsedMs} />
                  </Button>
                  {recorder.errorMessage && (
                    <div className="text-xs text-destructive flex items-start gap-1.5">
                      <MicOff className="w-3.5 h-3.5 mt-0.5 flex-none" />
                      <span>{recorder.errorMessage}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs text-muted-foreground">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What does engineering need to know about this spot?"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* GPS */}
          <div>
            <label className="text-xs text-muted-foreground">Location (optional)</label>
            <div className="mt-1.5">
              {gps ? (
                <div className="flex items-center gap-2 bg-secondary rounded-md px-2.5 py-2 text-xs">
                  <Crosshair className="w-3.5 h-3.5 text-primary" />
                  <span className="flex-1">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</span>
                  <Button size="sm" variant="ghost" onClick={() => setGps(null)}>Clear</Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  onClick={handleGps}
                  disabled={gpsBusy}
                  className="w-full"
                >
                  <Crosshair className="w-4 h-4 mr-1.5" />
                  {gpsBusy ? 'Reading location…' : 'Tag with current location'}
                </Button>
              )}
              {gpsError && (
                <div className="mt-1.5 text-xs text-destructive">{gpsError}</div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => void handleClose()}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save capture'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RecordButtonLabel({ state, elapsedMs }: { state: RecorderState; elapsedMs: number }) {
  if (state === 'recording') {
    return <><Square className="w-4 h-4 mr-1.5" />Stop ({formatDuration(elapsedMs)})</>;
  }
  if (state === 'finalising') return <>Saving recording…</>;
  if (state === 'requesting') return <>Requesting mic…</>;
  return <><Mic className="w-4 h-4 mr-1.5" />Record voice note</>;
}

// ──────────────────────────── Helpers ─────────────────────────────
function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ─────────────────────── PDF export ───────────────────────────────
// Dynamic import keeps jsPDF out of the initial bundle. Layout: cover
// page with project name + total + date, then one or more pages per
// capture. Long notes paginate; oversized photos clamp to page bounds.
// Audio can't render in PDF — we surface its presence + duration.
async function exportSiteWalkPdf(projectName: string, captures: SiteCapture[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const printedAt = new Date();
  const hasGps = captures.some((c) => c.lat != null && c.lng != null);

  // ── Cover ──
  doc.setFontSize(22);
  doc.text('Site walk report', margin, margin + 8);
  doc.setFontSize(13);
  doc.setTextColor(80);
  doc.text(projectName, margin, margin + 32);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    `${captures.length} ${captures.length === 1 ? 'capture' : 'captures'} · printed ${printedAt.toLocaleString()}`,
    margin, margin + 50,
  );
  if (hasGps) {
    doc.setTextColor(160, 60, 60);
    doc.text('Contains GPS coordinates. Review before sharing.', margin, margin + 64);
    doc.setTextColor(120);
  }
  doc.setDrawColor(220);
  const dividerY = margin + (hasGps ? 76 : 64);
  doc.line(margin, dividerY, pageW - margin, dividerY);
  doc.setTextColor(50);
  doc.setFontSize(11);
  doc.text('Contents', margin, dividerY + 24);
  doc.setFontSize(10);
  doc.setTextColor(80);
  let cursor = dividerY + 44;
  let listed = 0;
  for (const c of captures) {
    if (cursor + 14 > pageH - margin) break;
    const t = `${(listed + 1).toString().padStart(2, ' ')}.  ${c.label}`;
    doc.text(t.slice(0, 90), margin, cursor);
    cursor += 16;
    listed += 1;
  }
  if (listed < captures.length) {
    doc.setTextColor(140);
    doc.text(`+ ${captures.length - listed} more captures in this report`, margin, cursor);
  }

  // ── One or more pages per capture ──
  for (const cap of captures) {
    doc.addPage();
    let y = margin + 8;
    doc.setFontSize(16);
    doc.setTextColor(20);
    doc.text(cap.label, margin, y);
    y += 16;
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(new Date(cap.createdAt).toLocaleString(), margin, y);
    y += 24;

    if (cap.photoDataUrl) {
      try {
        const maxW = pageW - margin * 2;
        const maxH = 340;
        const dims = await measureImage(cap.photoDataUrl);
        if (dims.width > 0 && dims.height > 0) {
          const ratio = Math.min(maxW / dims.width, maxH / dims.height);
          const w = dims.width * ratio;
          const h = dims.height * ratio;
          doc.addImage(cap.photoDataUrl, 'JPEG', margin, y, w, h);
          y += h + 16;
        }
      } catch (err) {
        // Do not log capture content (photoDataUrl) — only the kind.
        console.warn('Skipping photo in PDF export', (err as any)?.name ?? 'unknown');
      }
    }

    if (cap.note) {
      doc.setFontSize(11);
      doc.setTextColor(40);
      const lines: string[] = doc.splitTextToSize(cap.note, pageW - margin * 2);
      for (const line of lines) {
        if (y + 14 > pageH - margin) {
          doc.addPage();
          y = margin + 8;
        }
        doc.text(line, margin, y);
        y += 14;
      }
      y += 8;
    }

    if (cap.audioDataUrl) {
      if (y + 14 > pageH - margin) { doc.addPage(); y = margin + 8; }
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Voice note attached (${formatDuration(cap.audioDurationMs ?? 0)}). Listen in the app.`, margin, y);
      y += 16;
    }

    if (cap.lat != null && cap.lng != null) {
      if (y + 14 > pageH - margin) { doc.addPage(); y = margin + 8; }
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`GPS  ${cap.lat.toFixed(5)}, ${cap.lng.toFixed(5)}`, margin, y);
      y += 16;
    }

    doc.setFontSize(8);
    doc.setTextColor(140);
    const footer: string[] = [];
    if (cap.photoBytes) footer.push(`photo ${bytesLabel(cap.photoBytes)}`);
    if (cap.audioBytes) footer.push(`audio ${bytesLabel(cap.audioBytes)}`);
    if (cap.author) footer.push(`by ${cap.author}`);
    if (footer.length) doc.text(footer.join('  ·  '), margin, pageH - margin);
  }

  const safe = projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`sitewalk-${safe}-${printedAt.toISOString().slice(0, 10)}.pdf`);
}

function measureImage(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}
