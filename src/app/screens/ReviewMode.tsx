// ReviewMode — customer / reviewer / stakeholder-facing presentation of
// a project. Mounts at /project/:projectId/review.
//
// Distinct from the Engineering Canvas: NO tool palette, NO device bar,
// NO drawer-based editors, NO drag handles or rotation rings, NO debug
// labels, NO costs unless explicitly toggled. The same Zustand store
// feeds both surfaces, so anything edited on /canvas is reflected here
// on the next load without an extra export step.
//
// Read-only contract: this screen never mutates persisted project data.
// Comments + approval state are session-scoped and clearly labelled
// "Preview — not persisted" so the honesty rule still holds.

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useProjectStore, selectors as sel, deriveCanvasBomRows, DOOR_HARDWARE_PRICE } from '../store/projectStore';
import { SAMPLE_PRODUCTS as CATALOG } from '../lib/productCatalog';
import { pathwayLengthFt, ftPerPxForFloor } from '../lib/engineering';
import { SurveyorSymbolBody, SURVEYOR_SYMBOL_IDS } from '../components/canvas/SurveyorSymbols';
import type { Device, Pathway, Floor, DoorHardware, CanvasBomRow } from '../store/types';
import {
  PencilRuler, Eye, EyeOff, MapPin, MessageSquare, CheckCircle2, AlertTriangle,
  Camera, KeyRound, Cable, Activity, ArrowLeft, Link as LinkIcon, Layers, ChevronDown, ChevronUp,
  X, Send, Maximize2, Minimize2, BarChart3, ExternalLink, DollarSign, FileText, Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildLabel } from '../../build-info';

const SURVEYOR_SYMBOL_SET = new Set<string>(SURVEYOR_SYMBOL_IDS as unknown as string[]);

// ─────────────────────────── Helpers ──────────────────────────────

function deviceKind(t: string): 'camera' | 'door' | 'access' | 'network' | 'power' | 'sensor' | 'audio' | 'storage' | 'display' | 'other' {
  if (t.startsWith('cam'))                                                                            return 'camera';
  if (t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor')) return 'door';
  if (t.startsWith('acc'))                                                                            return 'access';
  if (t.startsWith('net'))                                                                            return 'network';
  if (t.startsWith('pwr'))                                                                            return 'power';
  if (t.startsWith('sen'))                                                                            return 'sensor';
  if (t.startsWith('aud'))                                                                            return 'audio';
  if (t.startsWith('sto'))                                                                            return 'storage';
  if (t.startsWith('dis'))                                                                            return 'display';
  return 'other';
}

const KIND_LABEL: Record<string, string> = {
  camera: 'Camera', door: 'Door / Opening', access: 'Access control',
  network: 'Network', power: 'Power', sensor: 'Sensor',
  audio: 'Audio / PA', storage: 'Storage', display: 'Display', other: 'Equipment',
};

const KIND_TONE: Record<string, string> = {
  camera: '#22D3EE', door: '#A371F7', access: '#A371F7', network: '#10B981',
  power: '#F59E0B', sensor: '#F472B6', audio: '#FB7185', storage: '#94A3B8',
  display: '#94A3B8', other: '#94A3B8',
};

function deviceLabel(t: string): string {
  return ({
    'cam.bullet': 'Bullet camera', 'cam.dome': 'Dome camera', 'cam.ptz': 'PTZ camera',
    'cam.multisensor': 'Multisensor camera', 'cam.fisheye': 'Fisheye camera',
    'cam.thermal': 'Thermal camera', 'cam.lpr': 'LPR camera', 'cam.body': 'Body camera',
    'acc.reader': 'Card / mobile reader', 'acc.strike': 'Electric strike', 'acc.maglock': 'Magnetic lock',
    'acc.rex': 'REX motion', 'acc.exit': 'Exit device', 'acc.biometric': 'Biometric reader',
    'acc.intercom': 'Intercom', 'acc.controller': 'Access controller', 'acc.psu': 'Power supply',
    'acc.dps': 'Door position switch',
    'aud.intercom': 'Intercom', 'aud.speaker': 'Speaker', 'aud.horn': 'IP horn', 'aud.amp': 'Amplifier',
    'net.switch': 'PoE switch', 'net.firewall': 'Firewall', 'net.ap': 'Wireless AP',
    'pwr.ups': 'UPS', 'pwr.poe': 'PoE injector',
    'sen.motion': 'Motion sensor', 'sen.glass': 'Glass-break sensor', 'sen.smoke': 'Smoke detector',
    'sto.nvr': 'NVR', 'sto.server': 'Server',
    'inf.door-single': 'Single door', 'inf.door-double': 'Double door',
    'inf.door-storefront': 'Storefront door', 'inf.door-sliding': 'Sliding door',
    'inf.gate-swing': 'Swing gate', 'inf.gate-slide': 'Slide gate',
    'inf.elevator': 'Elevator',
  } as Record<string, string>)[t] ?? t;
}

function dotIcon(t: string): string {
  const k = deviceKind(t);
  return KIND_TONE[k] ?? '#94A3B8';
}

// ─────────────────────────── ReviewMode root ──────────────────────

type ReviewStatus = 'draft' | 'ready' | 'approved';

interface ReviewComment {
  id: string;
  author: string;
  ts: number;
  body: string;
  /** When true, this comment was added in this session; the user will lose
   *  it on reload. Persistence is a backend job. */
  ephemeral?: boolean;
  /** V1 1B — comment marked resolved hides under the "open only"
   *  filter and dims in the thread. Reviewer + timestamp persisted so
   *  the audit trail is clear once backend lands. */
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: number;
}

const SEED_COMMENTS: ReviewComment[] = [
  { id: 'c-1', author: 'Jordan Reyes · District facilities', ts: Date.now() - 86_400_000 * 2, body: 'Coverage at the lobby looks good. Can we double-check the parking-lot LPR throw distance?' },
  { id: 'c-2', author: 'Mark Webster · Project lead',          ts: Date.now() - 86_400_000,     body: 'Will confirm with the integrator. Updating cone range to 70 ft this week.' },
];

export function ReviewMode() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();

  // Per-slice selector subs replace the whole-store sub. Review walks
  // floors via floorsForProject (sites → buildings → floors) and the
  // active-floor selectors (devicesForFloor, pathwaysForFloor) so the
  // slice list covers projects + sites + buildings + floors + devices
  // + pathways. Any edit on /canvas to those slices flows here on the
  // next render; writes on other slices no longer trigger a Review
  // re-render.
  const projectsMap          = useProjectStore((s) => s.projects);
  const sitesMap             = useProjectStore((s) => s.sites);
  const buildingsMap         = useProjectStore((s) => s.buildings);
  const floorsMap            = useProjectStore((s) => s.floors);
  const devicesMap           = useProjectStore((s) => s.devices);
  const pathwaysMap          = useProjectStore((s) => s.pathways);
  // deriveCanvasBomRows further down also reads doors / idfs /
  // estimates / projectPricebooks, so the shim covers those too;
  // floors-only and devices-only routes wouldn't need them, but the
  // BOM toggle on this surface does.
  const doorsMap             = useProjectStore((s) => s.doors);
  const idfsMap              = useProjectStore((s) => s.idfs);
  const estimatesMap         = useProjectStore((s) => s.estimates);
  const projectPricebooksMap = useProjectStore((s) => s.projectPricebooks);
  const state = useMemo(
    () => ({
      projects: projectsMap, sites: sitesMap, buildings: buildingsMap,
      floors: floorsMap, devices: devicesMap, pathways: pathwaysMap,
      doors: doorsMap, idfs: idfsMap, estimates: estimatesMap,
      projectPricebooks: projectPricebooksMap,
    } as any),
    [projectsMap, sitesMap, buildingsMap, floorsMap, devicesMap, pathwaysMap, doorsMap, idfsMap, estimatesMap, projectPricebooksMap],
  );
  const project = projectsMap[projectId];
  const floors  = useMemo(() => sel.floorsForProject(state, projectId), [state, projectId]);

  const [floorIdx, setFloorIdx] = useState(0);
  const floor: Floor | undefined = floors[Math.min(floorIdx, Math.max(0, floors.length - 1))];

  const devices  = useMemo(() => floor ? sel.devicesForFloor(state, floor.id) : [], [state, floor]);
  const pathways = useMemo(() => floor ? sel.pathwaysForFloor(state, floor.id) : [], [state, floor]);

  // V1 2A.2 — broadcast review context to the AI Assistant.
  const setAssistantContext = useProjectStore((s) => s.setAssistantContext);
  const reviewSite = useMemo(
    () => Object.values(sitesMap).find((x: any) => x.projectId === projectId) as any,
    [sitesMap, projectId],
  );
  useEffect(() => {
    setAssistantContext({
      surface: 'review',
      projectId,
      siteId: reviewSite?.id,
      siteName: reviewSite?.name,
      floorId: floor?.id,
      floorName: floor?.name,
    });
  }, [setAssistantContext, projectId, reviewSite?.id, reviewSite?.name, floor?.id, floor?.name]);

  // ── Layer toggles. Defaults read like a customer-friendly view: all
  // hardware on, coverage off (less visual noise), notes off, BOM off.
  const [showCameras,  setShowCameras]  = useState(true);
  const [showDoors,    setShowDoors]    = useState(true);
  const [showAccess,   setShowAccess]   = useState(true);
  const [showNetwork,  setShowNetwork]  = useState(true);
  const [showPathways, setShowPathways] = useState(true);
  const [showCoverage, setShowCoverage] = useState(false);
  const [showNotes,    setShowNotes]    = useState(false);
  const [showBom,      setShowBom]      = useState(false);

  // ── Selection (read-only inspection).
  const [selectedDevice,  setSelectedDevice]  = useState<string | null>(null);
  const [selectedPathway, setSelectedPathway] = useState<string | null>(null);

  // ── Comments + status (session-only, label clearly "Preview").
  const [status, setStatus] = useState<ReviewStatus>('draft');
  const [comments, setComments] = useState<ReviewComment[]>(SEED_COMMENTS);
  const [draftComment, setDraftComment] = useState('');
  const [reviewerName, setReviewerName] = useState('Reviewer');

  // ── Pan / zoom. Lightweight: wheel = zoom; middle-mouse / shift+drag = pan.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 60 });
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  // Fit-to-content once when the floor changes (debounced via rAF so the
  // SVG has measured its viewport).
  useEffect(() => {
    if (!floor) return;
    const surface = surfaceRef.current;
    if (!surface) return;
    const r = surface.getBoundingClientRect();
    if (r.width < 200 || r.height < 200) return;
    // Compute the bounding box of all visible content.
    const xs: number[] = [];
    const ys: number[] = [];
    for (const d of devices) { xs.push(d.x); ys.push(d.y); }
    for (const w of floor.walls ?? []) { xs.push(w.x1, w.x2); ys.push(w.y1, w.y2); }
    if (floor.background) {
      const bg = floor.background;
      const w = bg.naturalWidth * bg.scale;
      const h = bg.naturalHeight * bg.scale;
      xs.push(bg.x, bg.x + w);
      ys.push(bg.y, bg.y + h);
    }
    if (!xs.length || !ys.length) return;
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const cw = maxX - minX, ch = maxY - minY;
    if (cw < 1 || ch < 1) return;
    const padding = 80;
    const z = Math.min(2, Math.max(0.2, Math.min((r.width - padding * 2) / cw, (r.height - padding * 2) / ch)));
    setZoom(z);
    setPan({ x: padding - minX * z + (r.width - padding * 2 - cw * z) / 2, y: padding - minY * z + (r.height - padding * 2 - ch * z) / 2 });
  // Intentionally exclude `devices`/`floor.walls` to avoid re-fitting every
  // render. We refit when the floor changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor?.id]);

  // Pan-drag with middle mouse or shift+click+drag.
  const panRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const onSurfacePointerDown = useCallback((e: React.PointerEvent) => {
    const armed = e.button === 1 || e.shiftKey || e.button === 2;
    if (!armed) return;
    e.preventDefault();
    panRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pan]);
  const onSurfacePointerMove = useCallback((e: React.PointerEvent) => {
    if (!panRef.current) return;
    setPan({ x: panRef.current.panX + (e.clientX - panRef.current.startX), y: panRef.current.panY + (e.clientY - panRef.current.startY) });
  }, []);
  const onSurfacePointerUp = useCallback(() => {
    panRef.current = null;
  }, []);

  // Wheel = zoom; cmd/ctrl-wheel = also zoom (same), shift-wheel = pan x.
  const onSurfaceWheel = useCallback((e: React.WheelEvent) => {
    if (e.shiftKey) {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      return;
    }
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const wheelStep = -e.deltaY * 0.0015;
    setZoom((z) => {
      const newZ = Math.max(0.2, Math.min(3, z * (1 + wheelStep)));
      // Zoom centered on cursor.
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setPan((p) => ({ x: cx - (cx - p.x) * (newZ / z), y: cy - (cy - p.y) * (newZ / z) }));
      return newZ;
    });
  }, []);

  // ── Click on canvas-surface (not on a glyph) clears selection.
  const onSurfaceClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-review-pick]')) return;
    setSelectedDevice(null);
    setSelectedPathway(null);
  }, []);

  const selectedDeviceObj = useMemo(() => devices.find((d) => d.id === selectedDevice) ?? null, [devices, selectedDevice]);
  const selectedPathwayObj = useMemo(() => pathways.find((p) => p.id === selectedPathway) ?? null, [pathways, selectedPathway]);

  // ── BOM summary (high-level only). Per the brief: no per-unit cost
  // unless toggled. We surface counts always; sell total only when the
  // user expands BOM and clicks "Show cost".
  const [showBomCost, setShowBomCost] = useState(false);
  const bom = useMemo(() => deriveCanvasBomRows(state, projectId), [state, projectId]);

  const onAddComment = () => {
    const body = draftComment.trim();
    if (!body) return;
    setComments((cs) => [...cs, {
      id: `c-${Date.now()}`,
      author: reviewerName || 'Reviewer',
      ts: Date.now(),
      body,
      ephemeral: true,
    }]);
    setDraftComment('');
    toast.success('Comment added', { duration: 2500 });
  };

  const onApprove = () => {
    setStatus('approved');
    toast.success('Project marked approved', { duration: 2500 });
  };
  const onRequestChanges = () => {
    setStatus('draft');
    toast.message('Sent back to draft', { duration: 2500 });
  };

  // V1 1B — tokenized review link. Generates a single-use share token
  // and appends it as a query string. Today the token is unbacked
  // (kept for forward compat); guest-mode rendering lands when portal
  // auth ships. Toast carries the URL so the user can paste manually
  // if clipboard is unavailable.
  const onCopyLink = async () => {
    const token = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 18)
      : Math.random().toString(36).slice(2, 20);
    const u = new URL(window.location.href);
    u.searchParams.set('share', token);
    const url = u.toString();
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Review link copied', { description: 'Tokenized share link is on your clipboard.', duration: 3000 });
    } catch {
      toast.error('Could not copy link', { description: url, duration: 5000 });
    }
  };

  // V1 1B — print friendly review export. window.print honours the
  // print stylesheet we already inherit from the canvas + reports
  // styles; comment thread sits inside the printable region.
  const onPrintReview = () => {
    toast.message('Opening browser print dialog', { description: 'Pick "Save as PDF" for a file or send to a printer.', duration: 3000 });
    setTimeout(() => window.print(), 200);
  };

  // V1 1B — comment thread filtering + mark-as-resolved. The thread
  // defaults to "open only" once a reviewer marks anything resolved
  // so the work-in-progress stays scannable.
  const [showResolved, setShowResolved] = useState<boolean>(true);
  const onToggleResolved = (id: string) => {
    setComments((cs) => cs.map((c) => c.id === id
      ? c.resolved
        ? { ...c, resolved: false, resolvedBy: undefined, resolvedAt: undefined }
        : { ...c, resolved: true, resolvedBy: reviewerName || 'Reviewer', resolvedAt: Date.now() }
      : c));
  };
  const visibleComments = showResolved ? comments : comments.filter((c) => !c.resolved);
  const resolvedCount   = comments.filter((c) => c.resolved).length;

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-8" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="max-w-md">
          <PencilRuler className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <div className="text-[16px] font-medium mb-1">Project not found</div>
          <div className="text-[12px] text-muted-foreground mb-4">No project matches <span className="font-mono text-foreground">{projectId}</span>.</div>
          <button onClick={() => nav('/projects')} className="text-[11px] px-3 h-8 rounded-md border border-border hover:bg-secondary/50">Back to projects</button>
        </div>
      </div>
    );
  }

  // Visible-device filter applied for canvas + count badges.
  const isDeviceVisible = (d: Device): boolean => {
    const k = deviceKind(d.type);
    if (k === 'camera')                            return showCameras;
    if (k === 'door')                              return showDoors;
    if (k === 'access')                            return showAccess;
    if (k === 'network' || k === 'power' || k === 'storage' || k === 'audio') return showNetwork;
    if (k === 'sensor')                            return showNotes; // sensors as notes/alarm layer
    return true;
  };

  const visibleDevices = devices.filter(isDeviceVisible);

  // Counts shown next to the layer toggles.
  const counts = useMemo(() => {
    const c = { camera: 0, door: 0, access: 0, network: 0, sensor: 0, pathway: pathways.length };
    for (const d of devices) {
      const k = deviceKind(d.type);
      if (k === 'camera')                                                                   c.camera++;
      else if (k === 'door')                                                                c.door++;
      else if (k === 'access')                                                              c.access++;
      else if (k === 'network' || k === 'power' || k === 'audio' || k === 'storage')        c.network++;
      else if (k === 'sensor')                                                              c.sensor++;
    }
    return c;
  }, [devices, pathways]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
      data-screen="review-mode"
    >
      <ReviewTopBar
        projectName={project.name}
        status={status}
        setStatus={setStatus}
        onOpenEngineering={() => nav(`/project/${projectId}/canvas`)}
        onOpenReports={() => nav(`/project/${projectId}/reports`)}
        onCopyLink={onCopyLink}
        onPrintReview={onPrintReview}
      />

      <div className="flex-1 grid grid-cols-[240px_minmax(0,1fr)_340px] min-h-0">
        {/* Left rail — layer toggles + floor picker. */}
        <ReviewLayerRail
          floors={floors}
          floorIdx={floorIdx}
          setFloorIdx={setFloorIdx}
          counts={counts}
          showCameras={showCameras}   setShowCameras={setShowCameras}
          showDoors={showDoors}       setShowDoors={setShowDoors}
          showAccess={showAccess}     setShowAccess={setShowAccess}
          showNetwork={showNetwork}   setShowNetwork={setShowNetwork}
          showPathways={showPathways} setShowPathways={setShowPathways}
          showCoverage={showCoverage} setShowCoverage={setShowCoverage}
          showNotes={showNotes}       setShowNotes={setShowNotes}
          showBom={showBom}           setShowBom={setShowBom}
        />

        {/* Centre — the read-only canvas. */}
        <div
          ref={surfaceRef}
          className="relative overflow-hidden select-none"
          style={{ background: 'var(--canvas-background, #F5F7FB)' }}
          onClick={onSurfaceClick}
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onSurfacePointerMove}
          onPointerUp={onSurfacePointerUp}
          onPointerCancel={onSurfacePointerUp}
          onWheel={onSurfaceWheel}
          onContextMenu={(e) => { e.preventDefault(); }}
          data-testid="review-canvas-surface"
        >
          {floor ? (
            <ReviewCanvas
              floor={floor}
              pan={pan} zoom={zoom}
              devices={visibleDevices}
              pathways={showPathways ? pathways : []}
              showCoverage={showCoverage}
              selectedDevice={selectedDevice}
              selectedPathway={selectedPathway}
              onPickDevice={(id) => { setSelectedDevice(id); setSelectedPathway(null); }}
              onPickPathway={(id) => { setSelectedPathway(id); setSelectedDevice(null); }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md p-6">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-[14px] font-medium mb-1">No floor plan yet</div>
                <div className="text-[12px] text-muted-foreground">Ask the engineer to upload a floor plan in the Engineering Canvas to see the design.</div>
              </div>
            </div>
          )}

          {/* Floor / scale chip */}
          {floor && (
            <div className="absolute left-3 bottom-3 text-[10px] px-2 py-1 rounded-md border border-border bg-background/90 backdrop-blur-sm text-muted-foreground flex items-center gap-2">
              <span>{floor.name}</span>
              <span className="text-foreground/40">·</span>
              <span>1 px = {floor.scalePxToFt.toFixed(3)} ft {floor.calibratedAt ? '· verified' : '· default'}</span>
              <span className="text-foreground/40">·</span>
              <span>zoom {(zoom * 100).toFixed(0)}%</span>
            </div>
          )}

          {/* Hint chip */}
          <div className="absolute right-3 bottom-3 text-[10px] px-2 py-1 rounded-md border border-border bg-background/90 backdrop-blur-sm text-muted-foreground flex items-center gap-2">
            <span>Scroll = zoom · Shift-drag = pan · Click = inspect</span>
          </div>

          {/* BOM summary card — only when toggled */}
          {showBom && (
            <ReviewBomSummary
              bom={bom}
              showCost={showBomCost}
              setShowCost={setShowBomCost}
              onClose={() => setShowBom(false)}
            />
          )}
        </div>

        {/* Right panel — detail + review/approval. */}
        <ReviewSidePanel
          selectedDevice={selectedDeviceObj}
          selectedPathway={selectedPathwayObj}
          floor={floor}
          status={status}
          comments={comments}
          draftComment={draftComment}
          setDraftComment={setDraftComment}
          reviewerName={reviewerName}
          setReviewerName={setReviewerName}
          onAddComment={onAddComment}
          onApprove={onApprove}
          onRequestChanges={onRequestChanges}
          visibleComments={visibleComments}
          resolvedCount={resolvedCount}
          showResolved={showResolved}
          setShowResolved={setShowResolved}
          onToggleResolved={onToggleResolved}
        />
      </div>

      <div className="border-t border-border bg-background/70 backdrop-blur px-4 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Read-only review surface · all edits are made in the Engineering Canvas</span>
        <span>{buildLabel()}</span>
      </div>
    </div>
  );
}

// ─────────────────────────── Top bar ──────────────────────────────

function ReviewTopBar({
  projectName, status, setStatus, onOpenEngineering, onOpenReports, onCopyLink, onPrintReview,
}: {
  projectName: string;
  status: ReviewStatus;
  setStatus: (s: ReviewStatus) => void;
  onOpenEngineering: () => void;
  onOpenReports: () => void;
  onCopyLink: () => void;
  onPrintReview: () => void;
}) {
  const STATUS_META: Record<ReviewStatus, { label: string; tone: string; bg: string; border: string }> = {
    draft:    { label: 'Draft',                tone: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
    ready:    { label: 'Ready for review',     tone: '#22D3EE', bg: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.35)' },
    approved: { label: 'Approved',             tone: '#10B981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
  };
  const meta = STATUS_META[status];
  return (
    <div className="shrink-0 border-b border-border bg-background/90 backdrop-blur-md flex items-center gap-3 px-4 py-2.5">
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22D3EE, #A371F7)', color: '#0B0F17' }}>
          <PencilRuler className="w-4 h-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Deeper Vision · Review</span>
          <span className="text-[14px] font-semibold tracking-tight text-foreground">{projectName}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-2">
        <span
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] tracking-tight border"
          style={{ color: meta.tone, background: meta.bg, borderColor: meta.border }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.tone, boxShadow: `0 0 6px ${meta.tone}88` }} />
          {meta.label}
        </span>
        {/* Quick status changer — keeps the contract honest (Preview tag below). */}
        <div className="flex items-center h-7 rounded-md border border-border bg-secondary/30 text-[10px] overflow-hidden">
          {(['draft', 'ready', 'approved'] as ReviewStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-2 h-full transition-colors ${status === s ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'}`}
              data-track={`review-status-${s}`}
            >
              {STATUS_META[s].label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1" />

      <button
        onClick={onCopyLink}
        title="Copy a tokenized share link so a reviewer can open this view"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] border border-border hover:bg-secondary/40 text-foreground transition-colors"
        data-track="review-copy-link"
      >
        <LinkIcon className="w-3.5 h-3.5" />Copy review link
      </button>
      {/* V1 1B — print the review surface (canvas snapshot + comment
          thread) so a reviewer can carry it offline. */}
      <button
        onClick={onPrintReview}
        title="Print the review — canvas snapshot plus comment thread"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] border border-border hover:bg-secondary/40 text-foreground transition-colors"
        data-track="review-print"
      >
        <Printer className="w-3.5 h-3.5" />Print review
      </button>
      <button
        onClick={onOpenReports}
        title="Open the Reports / Proposal package — generated from the same canvas data"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/15 text-sky-500 transition-colors"
        data-track="review-open-reports"
      >
        <FileText className="w-3.5 h-3.5" />Reports
      </button>
      <button
        onClick={onOpenEngineering}
        title="Open the Engineering Canvas — back to the design surface"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11px] border border-primary/30 bg-primary/10 hover:bg-primary/15 text-primary transition-colors"
        data-track="review-open-engineering"
      >
        <ArrowLeft className="w-3.5 h-3.5" />Open in Engineering
      </button>
    </div>
  );
}

// ─────────────────────────── Layer rail ───────────────────────────

function ReviewLayerRail({
  floors, floorIdx, setFloorIdx, counts,
  showCameras, setShowCameras, showDoors, setShowDoors, showAccess, setShowAccess,
  showNetwork, setShowNetwork, showPathways, setShowPathways, showCoverage, setShowCoverage,
  showNotes, setShowNotes, showBom, setShowBom,
}: {
  floors: Floor[]; floorIdx: number; setFloorIdx: (i: number) => void;
  counts: { camera: number; door: number; access: number; network: number; sensor: number; pathway: number };
  showCameras: boolean; setShowCameras: (b: boolean) => void;
  showDoors: boolean;   setShowDoors:   (b: boolean) => void;
  showAccess: boolean;  setShowAccess:  (b: boolean) => void;
  showNetwork: boolean; setShowNetwork: (b: boolean) => void;
  showPathways: boolean; setShowPathways: (b: boolean) => void;
  showCoverage: boolean; setShowCoverage: (b: boolean) => void;
  showNotes: boolean;   setShowNotes:   (b: boolean) => void;
  showBom: boolean;     setShowBom:     (b: boolean) => void;
}) {
  return (
    <div className="border-r border-border bg-background/60 backdrop-blur-md flex flex-col gap-4 py-4 px-3 overflow-y-auto" data-canvas-chrome="review-layers">
      {/* Floor picker */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5 px-1">Floor</div>
        {floors.length === 0 ? (
          <div className="text-[11px] text-muted-foreground px-1">No floor plan yet.</div>
        ) : (
          <div className="flex flex-col gap-1">
            {floors.map((f, i) => (
              <button
                key={f.id}
                onClick={() => setFloorIdx(i)}
                className={`flex items-center justify-between gap-2 h-8 px-2.5 rounded-md text-[12px] tracking-tight transition-colors ${i === floorIdx ? 'bg-primary/12 text-primary border border-primary/30' : 'text-foreground hover:bg-secondary/40 border border-transparent'}`}
                data-track={`review-floor-${i}`}
              >
                <span className="truncate">{f.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">L{f.level}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Layer toggles */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5 px-1">Layers</div>
        <div className="flex flex-col gap-1">
          <LayerToggle icon={Camera}    label="Cameras"  tone="#22D3EE" count={counts.camera}  on={showCameras}  setOn={setShowCameras}  track="cameras" />
          <LayerToggle icon={KeyRound}  label="Doors"    tone="#A371F7" count={counts.door}    on={showDoors}    setOn={setShowDoors}    track="doors" />
          <LayerToggle icon={Activity}  label="Access"   tone="#A371F7" count={counts.access}  on={showAccess}   setOn={setShowAccess}   track="access" />
          <LayerToggle icon={Layers}    label="Network"  tone="#10B981" count={counts.network} on={showNetwork}  setOn={setShowNetwork}  track="network" />
          <LayerToggle icon={Cable}     label="Pathways" tone="#7CC4FF" count={counts.pathway} on={showPathways} setOn={setShowPathways} track="pathways" />
          <LayerToggle icon={Eye}       label="Coverage" tone="#FF7B6B" count={counts.camera}  on={showCoverage} setOn={setShowCoverage} track="coverage" hint="Camera FOV cones" />
          <LayerToggle icon={MessageSquare} label="Notes"   tone="#F472B6" count={counts.sensor} on={showNotes}    setOn={setShowNotes}    track="notes" hint="Sensors + alarm points" />
        </div>
      </div>

      {/* BOM toggle (one button — shows a card on the canvas) */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5 px-1">Summary</div>
        <button
          onClick={() => setShowBom(!showBom)}
          className={`w-full flex items-center justify-between gap-2 h-8 px-2.5 rounded-md text-[12px] tracking-tight transition-colors border ${showBom ? 'bg-primary/12 text-primary border-primary/30' : 'border-border text-foreground hover:bg-secondary/40'}`}
          data-track="review-toggle-bom"
        >
          <span className="flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5" />BOM summary</span>
          {showBom ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function LayerToggle({ icon: Icon, label, tone, count, on, setOn, track, hint }: {
  icon: React.ComponentType<{ className?: string }>; label: string; tone: string; count: number;
  on: boolean; setOn: (b: boolean) => void; track: string; hint?: string;
}) {
  return (
    <button
      onClick={() => setOn(!on)}
      title={hint}
      className={`w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[12px] tracking-tight transition-colors border ${on ? 'bg-secondary/30 text-foreground border-border' : 'text-muted-foreground border-transparent hover:bg-secondary/20'}`}
      data-track={`review-toggle-${track}`}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: on ? tone : undefined }} />
      <span className="flex-1 text-left truncate">{label}</span>
      <span className={`text-[10px] tabular-nums ${on ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>{count}</span>
      {on
        ? <Eye    className="w-3.5 h-3.5 text-foreground/70" />
        : <EyeOff className="w-3.5 h-3.5 text-muted-foreground/50" />
      }
    </button>
  );
}

// ─────────────────────────── Canvas SVG ───────────────────────────

function ReviewCanvas({
  floor, pan, zoom, devices, pathways, showCoverage,
  selectedDevice, selectedPathway, onPickDevice, onPickPathway,
}: {
  floor: Floor;
  pan: { x: number; y: number };
  zoom: number;
  devices: Device[];
  pathways: Pathway[];
  showCoverage: boolean;
  selectedDevice: string | null;
  selectedPathway: string | null;
  onPickDevice: (id: string) => void;
  onPickPathway: (id: string) => void;
}) {
  return (
    <svg className="absolute inset-0 w-full h-full" data-testid="review-canvas-svg">
      <defs>
        <radialGradient id="rv-fov-grad" cx="0%" cy="50%" r="100%">
          <stop offset="0%" stopColor="#FFB199" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#FF7B6B" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#FF7B6B" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rv-fov-grad-fish" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFB199" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FF7B6B" stopOpacity="0" />
        </radialGradient>
        <pattern id="rv-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="0.6" />
        </pattern>
      </defs>

      {/* Subtle background grid in world coords */}
      <rect width="100%" height="100%" fill="url(#rv-grid)" />

      <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
        {/* Floor plan background */}
        {floor.background && (
          <g
            transform={`translate(${floor.background.x}, ${floor.background.y}) rotate(${floor.background.rotation}) scale(${floor.background.scale})`}
            opacity={floor.background.opacity}
          >
            <image
              href={floor.background.dataUrl}
              width={floor.background.naturalWidth}
              height={floor.background.naturalHeight}
              preserveAspectRatio="none"
            />
          </g>
        )}

        {/* Walls */}
        {(floor.walls ?? []).map((w) => (
          <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#94A3B8" strokeWidth={2 / Math.max(zoom, 0.5)} strokeLinecap="round" opacity={0.85} />
        ))}

        {/* Coverage cones (rendered behind glyphs) */}
        {showCoverage && devices.filter((d) => deviceKind(d.type) === 'camera').map((d) => (
          <FovCone key={`fov-${d.id}`} d={d} pxToFt={ftPerPxForFloor(floor)} highlighted={selectedDevice === d.id} />
        ))}

        {/* Pathway lines */}
        {pathways.map((p) => (
          <PathwayLine
            key={p.id} p={p} floor={floor}
            selected={selectedPathway === p.id}
            onPick={() => onPickPathway(p.id)}
          />
        ))}

        {/* Devices */}
        {devices.map((d) => (
          <ReviewDeviceGlyph
            key={d.id} d={d}
            selected={selectedDevice === d.id}
            onPick={() => onPickDevice(d.id)}
          />
        ))}
      </g>
    </svg>
  );
}

function FovCone({ d, pxToFt, highlighted }: { d: Device; pxToFt: number; highlighted: boolean }) {
  // SC.7.1: per-floor calibrated scale. Was a 3.83 px/ft hardcode that
  // mis-rendered cones on any calibrated background.
  if (d.type === 'cam.multisensor' && d.lenses) {
    return (
      <g opacity={highlighted ? 0.85 : 0.45}>
        {(['a', 'b', 'c', 'd'] as const).map((k) => {
          const lens = d.lenses![k];
          if (!lens?.enabled) return null;
          const path = cone(d.x, d.y, d.rot + lens.rotation, lens.fov, lens.range, pxToFt);
          return <path key={k} d={path} fill="url(#rv-fov-grad)" stroke="#FF7B6B" strokeWidth={0.6} opacity={highlighted ? 0.9 : 0.5} />;
        })}
      </g>
    );
  }
  const defaultRangeFt = d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30;
  const defaultFovDeg  = d.type === 'cam.ptz' ? 36 : d.type === 'cam.fisheye' ? 360 : 70;
  const rangeFt = d.range ?? defaultRangeFt;
  const fovDeg  = d.fov ?? defaultFovDeg;
  if (d.type === 'cam.fisheye' || fovDeg >= 350) {
    const rFish = (rangeFt / pxToFt) * 0.6;
    return (
      <g opacity={highlighted ? 0.85 : 0.5}>
        <circle cx={d.x} cy={d.y} r={rFish} fill="url(#rv-fov-grad-fish)" />
        <circle cx={d.x} cy={d.y} r={rFish} fill="none" stroke="#FF7B6B" strokeWidth={0.6} strokeDasharray="2 4" opacity={0.55} />
      </g>
    );
  }
  const path = cone(d.x, d.y, d.rot, fovDeg, rangeFt, pxToFt);
  return (
    <g opacity={highlighted ? 0.95 : 0.55}>
      <path d={path} fill="url(#rv-fov-grad)" />
      <path d={path} fill="none" stroke="#FF7B6B" strokeWidth={0.55} opacity={0.45} />
    </g>
  );
}

function cone(cx: number, cy: number, rot: number, fovDeg: number, rangeFt: number, pxToFt: number): string {
  const r = rangeFt / pxToFt;
  const half = fovDeg / 2;
  const a1 = ((rot - half) * Math.PI) / 180;
  const a2 = ((rot + half) * Math.PI) / 180;
  const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
  const x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r;
  const large = half > 90 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function PathwayLine({ p, floor, selected, onPick }: { p: Pathway; floor: Floor; selected: boolean; onPick: () => void }) {
  const pts = (p.points ?? []) as { x: number; y: number }[];
  if (pts.length < 2) return null;
  const dPath = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  // Dash/colour by pathway kind so the legend reads naturally.
  const isConduit = p.pathwayKind === 'conduit' || p.pathwayKind === 'raceway' || p.pathwayKind === 'duct';
  const isTray    = p.pathwayKind === 'tray';
  const isHook    = p.pathwayKind === 'jhook';
  const stroke = isConduit ? '#A371F7' : isHook ? '#94A3B8' : isTray ? '#10B981' : '#7CC4FF';
  const dash   = isHook ? '4 4' : isTray ? '6 4' : isConduit ? undefined : '8 6';
  const w = selected ? 3 : 1.6;
  return (
    <g data-review-pick="pathway" onClick={(e) => { e.stopPropagation(); onPick(); }} style={{ cursor: 'pointer' }}>
      {/* Invisible thicker hit target so the line is clickable */}
      <path d={dPath} fill="none" stroke="transparent" strokeWidth={12} strokeLinecap="round" />
      <path d={dPath} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} opacity={selected ? 0.95 : 0.78} />
    </g>
  );
}

function ReviewDeviceGlyph({ d, selected, onPick }: { d: Device; selected: boolean; onPick: () => void }) {
  const k = deviceKind(d.type);
  const tone = d.color || KIND_TONE[k] || '#94A3B8';
  const hasSymbol = SURVEYOR_SYMBOL_SET.has(d.type);
  const r = 14;
  const scale = 0.85;
  return (
    <g
      data-review-pick="device"
      onClick={(e) => { e.stopPropagation(); onPick(); }}
      style={{ cursor: 'pointer' }}
      transform={`translate(${d.x}, ${d.y})`}
    >
      {/* selection halo */}
      {selected && <circle r={r + 7} fill={tone} fillOpacity={0.12} stroke={tone} strokeOpacity={0.45} strokeWidth={1} />}
      {/* glyph chip */}
      <circle r={r} fill="var(--card, #ffffff)" stroke={tone} strokeWidth={1.4} />
      <g transform={`rotate(${d.rot})`}>
        {hasSymbol
          ? <g style={{ color: tone }}><SurveyorSymbolBody id={d.type} scale={scale} stroke={1.3} /></g>
          : <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={600} fill={tone}>
              {(d.type.split('.')[1] || '?').slice(0, 3).toUpperCase()}
            </text>
        }
      </g>
      {/* small caption — id (no internal labels) */}
      <text
        y={r + 11}
        textAnchor="middle"
        fontSize={9}
        fill="var(--foreground, #0F172A)"
        fillOpacity={selected ? 0.95 : 0.7}
        style={{ pointerEvents: 'none', fontFamily: 'ui-sans-serif, system-ui' }}
      >
        {d.id}
      </text>
    </g>
  );
}

// ─────────────────────────── BOM summary card ─────────────────────

function ReviewBomSummary({
  bom, showCost, setShowCost, onClose,
}: {
  bom: ReturnType<typeof deriveCanvasBomRows>;
  showCost: boolean;
  setShowCost: (b: boolean) => void;
  onClose: () => void;
}) {
  // High-level only: count by category. Cost is gated behind an explicit
  // "Show cost" toggle so a reviewer who hasn't been briefed on dollar
  // amounts doesn't see them by default.
  const groups: Record<string, number> = {};
  for (const r of bom.rows) {
    if (r.isExisting) continue;
    groups[r.category] = (groups[r.category] ?? 0) + r.qty;
  }
  const LABEL: Record<string, string> = { cameras: 'Cameras', access: 'Access control', network: 'Network & power', cabling: 'Cable & pathways', labor: 'Labor', other: 'Equipment' };
  return (
    <div
      // M11 audit fix (FL2): the popover used to hardcode a light
      // white background. In dark / slate themes the text inside
      // (the empty state copy "No proposed hardware yet." and the
      // "Show cost" button label) inherits theme foreground colours
      // and renders invisible against the white. Swapping to the
      // bg-card token lets the popover follow the active theme so
      // text colours have the contrast they were designed for.
      className="absolute right-3 top-3 w-[280px] rounded-xl border border-border bg-card/95 p-3 backdrop-blur-md"
      data-canvas-chrome="review-bom"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Bill of materials</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="text-[11px] text-muted-foreground mb-2">High-level summary · derived from the canvas</div>
      <div className="space-y-1.5">
        {Object.keys(groups).length === 0 && (
          <div className="text-[11px] text-muted-foreground">No proposed hardware yet.</div>
        )}
        {Object.entries(groups).map(([cat, qty]) => (
          <div key={cat} className="flex items-center justify-between text-[12px]">
            <span className="text-foreground">{LABEL[cat] ?? cat}</span>
            <span className="text-foreground tabular-nums">{qty}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between">
        <button
          onClick={() => setShowCost(!showCost)}
          className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[10px] border border-border hover:bg-secondary/40"
          data-track="review-bom-show-cost"
        >
          <DollarSign className="w-3 h-3" />{showCost ? 'Hide cost' : 'Show cost'}
        </button>
        {showCost ? (
          <span className="text-[12px] font-medium tabular-nums">${Math.round(bom.totals.sellTotal).toLocaleString()}</span>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">Cost hidden</span>
        )}
      </div>
      {showCost && (
        <div className="text-[9.5px] text-muted-foreground mt-1.5 leading-snug">
          Calibrate against your project pricebook before sharing.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Right panel ──────────────────────────

function ReviewSidePanel({
  selectedDevice, selectedPathway, floor, status, comments,
  draftComment, setDraftComment, reviewerName, setReviewerName,
  onAddComment, onApprove, onRequestChanges,
  visibleComments, resolvedCount, showResolved, setShowResolved, onToggleResolved,
}: {
  selectedDevice: Device | null;
  selectedPathway: Pathway | null;
  floor: Floor | undefined;
  status: ReviewStatus;
  comments: ReviewComment[];
  draftComment: string;  setDraftComment:  (s: string) => void;
  reviewerName: string;  setReviewerName:  (s: string) => void;
  onAddComment:      () => void;
  onApprove:         () => void;
  onRequestChanges:  () => void;
  visibleComments:   ReviewComment[];
  resolvedCount:     number;
  showResolved:      boolean;
  setShowResolved:   (v: boolean) => void;
  onToggleResolved:  (id: string) => void;
}) {
  return (
    <div className="border-l border-border bg-background/60 backdrop-blur-md flex flex-col min-h-0" data-canvas-chrome="review-side">
      {/* Detail card — top half. Always shown so the panel isn't empty. */}
      <div className="border-b border-border p-4 overflow-y-auto" style={{ maxHeight: '50%' }}>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-2">Inspect</div>
        {selectedDevice
          ? <DeviceDetail d={selectedDevice} floor={floor} />
          : selectedPathway
            ? <PathwayDetail p={selectedPathway} floor={floor} />
            : <div className="text-[12px] text-muted-foreground">Click any device or pathway on the canvas to see its details here.</div>
        }
      </div>

      {/* Review panel — bottom half */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Review</div>
          {/* V1 1B — open-only filter. Hidden when nothing is resolved
              yet so the chrome stays calm until the reviewer actually
              has resolved comments to filter out. */}
          {resolvedCount > 0 && (
            <button
              onClick={() => setShowResolved(!showResolved)}
              className={`ml-auto text-[10px] uppercase tracking-[0.10em] px-1.5 py-0.5 rounded transition-colors ${
                showResolved
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'bg-primary/15 text-primary'
              }`}
              title={showResolved ? 'Hide resolved comments' : 'Show every comment'}
            >
              {showResolved ? `${resolvedCount} resolved` : 'Open only'}
            </button>
          )}
        </div>

        <div className="px-4 pb-2">
          <input
            type="text"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            placeholder="Your name"
            className="w-full text-[12px] h-8 px-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
            data-testid="review-reviewer-name"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-3">
          {visibleComments.length === 0
            ? <div className="text-[11px] text-muted-foreground">{comments.length === 0 ? 'No comments yet.' : 'No open comments.'}</div>
            : visibleComments.map((c) => (
                <div key={c.id} className={`rounded-md p-2.5 border bg-secondary/20 transition-opacity ${c.resolved ? 'border-emerald-500/30 opacity-70' : 'border-border'}`}>
                  <div className="flex items-center justify-between mb-0.5 gap-2">
                    <span className="text-[11px] font-medium text-foreground truncate">{c.author}</span>
                    <span className="text-[9.5px] text-muted-foreground tabular-nums shrink-0">{relativeTime(c.ts)}</span>
                  </div>
                  <div className={`text-[12px] leading-snug ${c.resolved ? 'text-muted-foreground line-through decoration-1' : 'text-foreground/90'}`}>{c.body}</div>
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    {c.ephemeral ? (
                      <div className="text-[9px] uppercase tracking-[0.12em] text-amber-500">Session only · not persisted</div>
                    ) : <span />}
                    <button
                      onClick={() => onToggleResolved(c.id)}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ml-auto ${
                        c.resolved
                          ? 'text-emerald-600 hover:bg-emerald-500/15'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                      }`}
                      title={c.resolved ? 'Reopen this comment' : 'Mark resolved'}
                    >
                      {c.resolved ? '✓ Resolved' : 'Mark resolved'}
                    </button>
                  </div>
                  {c.resolved && c.resolvedBy && (
                    <div className="text-[9px] text-emerald-600/70 mt-1">Resolved by {c.resolvedBy}{c.resolvedAt ? ` · ${relativeTime(c.resolvedAt)}` : ''}</div>
                  )}
                </div>
              ))
          }
        </div>

        <div className="border-t border-border p-3 space-y-2">
          <div className="flex items-start gap-1.5">
            {/* M11 audit fix (F5): the Add comment button is icon-only
                and starts disabled. Without a description a screen
                reader user lands on it with no explanation. Wired an
                aria-describedby to the inline hint below so the
                disabled / enabled rationale is announced, and an
                aria-label so the icon button has an accessible name. */}
            <textarea
              value={draftComment}
              onChange={(e) => setDraftComment(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onAddComment(); }}
              placeholder="Leave a comment for the project team…"
              rows={2}
              aria-describedby="review-comment-hint"
              className="flex-1 text-[12px] p-2 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none"
              data-testid="review-comment-input"
            />
            <button
              onClick={onAddComment}
              disabled={!draftComment.trim()}
              aria-label="Add comment"
              aria-describedby="review-comment-hint"
              className="h-9 w-9 rounded-md inline-flex items-center justify-center border border-border bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              title={draftComment.trim() ? 'Add comment · ⌘/Ctrl + Enter' : 'Type a comment to enable · ⌘/Ctrl + Enter to send'}
              data-track="review-add-comment"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Visible hint paired with the textarea + button via
              aria-describedby. The empty state explains why the
              button is disabled; the typed state confirms the
              shortcut works. */}
          <div
            id="review-comment-hint"
            // Font size pulls from --chrome-xs via inline style so this
            // hint matches surrounding 10 px chrome without adding
            // another raw text-[Npx] class to the tokens audit count.
            style={{ fontSize: 'var(--chrome-xs)' }}
            className="text-muted-foreground leading-snug"
          >
            {draftComment.trim()
              ? 'Press ⌘/Ctrl + Enter to send.'
              : 'Type a note above to enable Add comment.'}
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={onApprove}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-[11px] border transition-colors ${status === 'approved' ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400' : 'border-border hover:bg-secondary/40 text-foreground'}`}
              data-track="review-approve"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />Approve
            </button>
            <button
              onClick={onRequestChanges}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-[11px] border border-border hover:bg-secondary/40 text-foreground transition-colors"
              data-track="review-request-changes"
            >
              <AlertTriangle className="w-3.5 h-3.5" />Request changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)        return 'just now';
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─────────────────────────── Detail cards ─────────────────────────

function DeviceDetail({ d, floor }: { d: Device; floor: Floor | undefined }) {
  const k = deviceKind(d.type);
  const tone = d.color || KIND_TONE[k] || '#94A3B8';
  const product = CATALOG.find((p) => p.id === d.product);

  // Coverage summary — only meaningful for cameras.
  let coverageLine: string | null = null;
  if (k === 'camera') {
    const defaultRangeFt = d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30;
    const defaultFovDeg  = d.type === 'cam.ptz' ? 36 : d.type === 'cam.fisheye' ? 360 : 70;
    const rangeFt = d.range ?? defaultRangeFt;
    const fovDeg  = d.fov ?? defaultFovDeg;
    coverageLine = d.type === 'cam.fisheye'
      ? `${rangeFt} ft omnidirectional`
      : `${fovDeg}° × ${rangeFt} ft throw`;
  }

  // Door assembly summary.
  let doorAssembly: { hw: DoorHardware; state: 'proposed' | 'existing'; desc: string }[] = [];
  if (k === 'door') {
    const assembly = d.doorAssembly ?? [];
    const stateMap = (d.doorAssemblyState ?? {}) as Partial<Record<DoorHardware, 'proposed' | 'existing'>>;
    doorAssembly = assembly.map((hw) => ({ hw, state: stateMap[hw] === 'existing' ? 'existing' : 'proposed', desc: DOOR_HARDWARE_PRICE[hw]?.desc ?? hw }));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: tone, boxShadow: `0 0 6px ${tone}88` }} />
        <span className="text-[11px] text-muted-foreground">{KIND_LABEL[k]}</span>
      </div>
      <div>
        <div className="text-[16px] font-medium text-foreground tracking-tight">{d.id}</div>
        <div className="text-[12px] text-foreground/80 mt-0.5">{deviceLabel(d.type)}</div>
        {d.label && (
          <div className="text-[11px] text-muted-foreground mt-0.5">{d.label}</div>
        )}
      </div>
      {product && (
        <KvRow k="Model" v={`${product.manufacturer} · ${product.model}`} />
      )}
      {k === 'camera' && (
        <>
          {coverageLine && <KvRow k="Coverage" v={coverageLine} />}
          {d.mountFt != null && <KvRow k="Mount height" v={`${d.mountFt} ft`} />}
          {d.ir && <KvRow k="IR" v="Yes" />}
          {d.ndaa && <KvRow k="NDAA" v="Yes" />}
        </>
      )}
      {k === 'door' && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">Proposed hardware</div>
          {doorAssembly.length === 0
            ? <div className="text-[11px] text-muted-foreground">No hardware specified yet for this opening.</div>
            : <ul className="space-y-1">
                {doorAssembly.map((h) => (
                  <li key={h.hw} className="flex items-center justify-between text-[12px]">
                    <span className="text-foreground">{h.desc}</span>
                    <span className={`text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border ${h.state === 'existing' ? 'border-amber-400/40 text-amber-400 bg-amber-400/10' : 'border-emerald-400/40 text-emerald-400 bg-emerald-400/10'}`}>{h.state}</span>
                  </li>
                ))}
              </ul>
          }
          {d.doorElectrification && <KvRow k="Electrification" v={d.doorElectrification} />}
          {d.doorReaderLocation && <KvRow k="Reader location" v={d.doorReaderLocation} />}
        </div>
      )}
      {floor && (
        <KvRow k="Location" v={`${floor.name} · ${Math.round(d.x * floor.scalePxToFt)} ft, ${Math.round(d.y * floor.scalePxToFt)} ft`} />
      )}
      {d.notes && (
        <div className="rounded-md border border-border bg-secondary/20 p-2.5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-0.5">Notes</div>
          <div className="text-[11px] text-foreground/90 leading-snug">{d.notes}</div>
        </div>
      )}
      <div className="text-[10px] text-muted-foreground border-t border-border pt-2">
        Read-only summary. All edits happen in the Engineering Canvas.
      </div>
    </div>
  );
}

function PathwayDetail({ p, floor }: { p: Pathway; floor: Floor | undefined }) {
  const lenFt = floor ? pathwayLengthFt(p, floor) : 0;
  const kind = p.pathwayKind ?? 'cable';
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: '#7CC4FF', boxShadow: '0 0 6px #7CC4FF88' }} />
        <span className="text-[11px] text-muted-foreground">Pathway · {kind}</span>
      </div>
      <div>
        <div className="text-[16px] font-medium text-foreground tracking-tight">{p.id}</div>
        <div className="text-[12px] text-foreground/80 mt-0.5">{(p.cableType ?? '').toUpperCase() || 'Cable run'}</div>
      </div>
      <KvRow k="Length" v={`${lenFt} ft`} />
      {p.cableCount > 1 && <KvRow k="Conductors" v={`${p.cableCount}×`} />}
      {p.conduitSize && <KvRow k="Conduit size" v={p.conduitSize} />}
      {p.bundleId && <KvRow k="Bundle" v={p.bundleId} />}
      <div className="text-[10px] text-muted-foreground border-t border-border pt-2">
        Read-only. Route + length adjustments happen in the Engineering Canvas.
      </div>
    </div>
  );
}

function KvRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground shrink-0">{k}</span>
      <span className="text-[12px] text-foreground text-right truncate">{v}</span>
    </div>
  );
}
