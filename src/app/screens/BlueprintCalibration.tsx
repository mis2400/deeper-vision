// Blueprint Calibration — V1 4E. Guided four step flow for taking a
// project from "intake created an empty floor" to "the canvas knows
// what one foot looks like and which way is north".
//
// Steps:
//   1. Upload   — pick a PNG / JPG / PDF; first page rendered via pdfjs.
//   2. Orient   — rotate to true north in 90° increments + fine slider.
//   3. Scale    — pick two reference points + enter the real distance.
//   4. Floors   — confirm name / level for this floor; add more floors.
//
// Persists onto Floor + Floor.background; no store schema change.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  Upload, Ruler, Check, RotateCcw, RotateCw, ArrowLeft, ArrowRight,
  Image as ImageIcon, FileText, Plus, Building2, Compass, Edit3,
} from 'lucide-react';

import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { useProjectStore, selectors } from '../store/projectStore';
import type { Floor, Site, Building } from '../store/types';
import { importFloorplanFile } from '../lib/floorplanImport';
import { bytesLabel, approxDataUrlBytes } from '../lib/mediaCapture';
import { usePlanBlobUrl } from '../canvas/plan/usePlanBlobUrl';

type Step = 'upload' | 'orient' | 'scale' | 'floors' | 'done';

interface Point { x: number; y: number; }

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'upload', label: 'Upload' },
  { id: 'orient', label: 'Orient' },
  { id: 'scale',  label: 'Scale' },
  { id: 'floors', label: 'Floors' },
];

export function BlueprintCalibration() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();

  // ── Project + floors ─────────────────────────────────────────
  // Floors join to a project through building → site → project. Some
  // floors carry a denormalised projectId (intake-created), some don't
  // (seeded demo data). Walk the chain so both cases land.
  const floorsMap    = useProjectStore((s) => s.floors);
  const sitesMap     = useProjectStore((s) => s.sites);
  const buildingsMap = useProjectStore((s) => s.buildings);
  const projectBuildingIds = useMemo(() => {
    const projectSiteIds = new Set(
      Object.values(sitesMap).filter((s) => s.projectId === projectId).map((s) => s.id),
    );
    return new Set(
      Object.values(buildingsMap).filter((b) => projectSiteIds.has(b.siteId)).map((b) => b.id),
    );
  }, [sitesMap, buildingsMap, projectId]);
  const projectFloors = useMemo(
    () => Object.values(floorsMap)
      .filter((f) => f.projectId === projectId || projectBuildingIds.has(f.buildingId))
      .sort((a, b) => a.level - b.level),
    [floorsMap, projectBuildingIds, projectId],
  );
  const buildingId = useMemo(
    () => projectFloors[0]?.buildingId ?? Array.from(projectBuildingIds)[0] ?? null,
    [projectFloors, projectBuildingIds],
  );

  // ── Active floor (the one being calibrated right now) ────────
  const firstFloor = useProjectStore((s) => selectors.firstFloorOfProject(s, projectId));
  const [activeFloorId, setActiveFloorId] = useState<string | null>(firstFloor?.id ?? null);
  useEffect(() => {
    if (!activeFloorId && firstFloor?.id) setActiveFloorId(firstFloor.id);
  }, [activeFloorId, firstFloor?.id]);
  const activeFloor = activeFloorId ? floorsMap[activeFloorId] : null;

  const updateFloor       = useProjectStore((s) => s.updateFloor);
  const addFloor          = useProjectStore((s) => s.addFloor);
  const addSite           = useProjectStore((s) => s.addSite);
  const addBuilding       = useProjectStore((s) => s.addBuilding);
  const setFloorBackground = useProjectStore((s) => s.setFloorBackground);

  // ── Step state ───────────────────────────────────────────────
  const initialStep: Step = activeFloor?.background?.dataUrl ? 'orient' : 'upload';
  const [step, setStep] = useState<Step>(initialStep);
  const stepIdx = STEPS.findIndex((s) => s.id === step);
  // Reset the wizard when the operator switches floors.
  useEffect(() => {
    if (!activeFloor) return;
    setStep(activeFloor.background?.dataUrl
      ? (activeFloor.calibratedAt ? 'floors' : 'orient')
      : 'upload');
    setPts([]);
    setRealFeet(activeFloor.calibrationReferenceFt ? String(activeFloor.calibrationReferenceFt) : '25');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFloorId]);

  // ── Upload + drag and drop ────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const handleUpload = async (file: File | null) => {
    if (!file || !activeFloor) {
      if (!activeFloor) toast.error('No floor selected.');
      return;
    }
    setUploading(true);
    try {
      const result = await importFloorplanFile(file);
      if (!aliveRef.current) return;
      setFloorBackground(activeFloor.id, result.background);
      // Mark the source as 'blueprint' so the canvas knows this floor
      // has a real plan vs the seeded blank.
      updateFloor(activeFloor.id, { source: 'blueprint' });
      toast.success(result.note ? `Floor plan loaded. ${result.note}` : `Floor plan loaded. ${bytesLabel(approxDataUrlBytes(result.background.dataUrl))}`);
      setPts([]);
      setStep('orient');
    } catch (err: any) {
      console.error('floorplan import failed', err?.name, err?.message);
      const message = (err?.message ?? '').toLowerCase().includes('unsupported')
        ? 'That file type is not supported. Use PNG, JPG, or PDF.'
        : 'Could not load that file. Try a PNG, JPG, or PDF.';
      toast.error(message);
    } finally {
      if (aliveRef.current) setUploading(false);
    }
  };

  const onDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUpload(file);
  };

  // ── Orientation ──────────────────────────────────────────────
  const rotation = activeFloor?.background?.rotation ?? 0;
  const setRotation = (deg: number) => {
    if (!activeFloor?.background) return;
    // Normalise to [0, 360).
    const norm = ((deg % 360) + 360) % 360;
    setFloorBackground(activeFloor.id, { ...activeFloor.background, rotation: norm });
  };

  // ── Scale calibration ────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);
  const [pts, setPts] = useState<Point[]>([]);
  const [realFeet, setRealFeet] = useState('25');

  const handlePick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (step !== 'scale' || pts.length >= 2) return;
    const svg = svgRef.current;
    if (!svg) return;
    // Convert viewport coords into viewBox coords using the SVG's own
    // screen CTM. This is the only correct way to account for
    // preserveAspectRatio letterboxing (a naive width-ratio mapping
    // sends clicks in the letterbox bars to nonsense coords) and for
    // any chained transforms like the orient step's rotation.
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    setPts([...pts, { x: local.x, y: local.y }]);
  };

  const resetPoints = () => setPts([]);
  const pxDist = pts.length === 2 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 0;
  const scalePxToFt = pxDist && Number(realFeet) ? Number(realFeet) / pxDist : 0;
  const pxPerFt = scalePxToFt > 0 ? 1 / scalePxToFt : 0;

  const confirmScale = () => {
    if (!activeFloor) return;
    if (pts.length !== 2 || !Number(realFeet) || scalePxToFt <= 0) {
      toast.error('Pick two points and enter a real distance.');
      return;
    }
    updateFloor(activeFloor.id, {
      scalePxToFt,
      calibratedAt: Date.now(),
      calibrationReferenceFt: Number(realFeet),
      calibrationMeasuredPx: pxDist,
    });
    toast.success(`Scale saved: ${pxPerFt.toFixed(2)} px per ft.`);
    setStep('floors');
  };

  // ── Floor naming + multi-floor add ───────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [floorName, setFloorName] = useState(activeFloor?.name ?? '');
  const [floorLevel, setFloorLevel] = useState<number>(activeFloor?.level ?? 0);
  useEffect(() => {
    setFloorName(activeFloor?.name ?? '');
    setFloorLevel(activeFloor?.level ?? 0);
    setEditingName(false);
  }, [activeFloor?.id, activeFloor?.name, activeFloor?.level]);

  const saveFloorMeta = () => {
    if (!activeFloor) return;
    const trimmed = floorName.trim();
    if (!trimmed) {
      toast.error('Floor name cannot be empty.');
      return;
    }
    updateFloor(activeFloor.id, { name: trimmed, level: floorLevel });
    setEditingName(false);
    toast.success('Floor details saved.');
  };

  const addAnotherFloor = () => {
    // Pin the new floor to the active floor's building when one exists
    // so floors stay grouped under the same building as the operator
    // clicks add. Set ordering is fragile.
    let targetBuildingId: string | null = activeFloor?.buildingId ?? buildingId;

    // Project never finished intake — auto provision a site + building so
    // the operator is not stuck in a dead end.
    if (!targetBuildingId) {
      const newSiteId = newId('s');
      const newBuildingId = newId('b');
      const newSite: Site = {
        id: newSiteId,
        projectId,
        name: 'Main Site',
        address: '',
      };
      const newBuilding: Building = {
        id: newBuildingId,
        siteId: newSiteId,
        name: 'Main Building',
      };
      addSite(newSite);
      addBuilding(newBuilding);
      targetBuildingId = newBuildingId;
    }

    const usedLevels = new Set(projectFloors.map((f) => f.level));
    let nextLevel = projectFloors.length;
    while (usedLevels.has(nextLevel)) nextLevel += 1;
    const id = newId('f');
    const newFloor: Floor = {
      id,
      projectId,
      buildingId: targetBuildingId,
      name: `Floor ${nextLevel + 1}`,
      level: nextLevel,
      source: 'blank',
      scalePxToFt: 0,
      walls: [],
    };
    addFloor(newFloor);
    setActiveFloorId(id);
    setStep('upload');
    setPts([]);
    setRealFeet('25');
    toast.success(`Added ${newFloor.name}. Upload its plan next.`);
  };

  // Stable id helper. crypto.randomUUID is broadly supported; fall back
  // to a random base36 when it isn't (older Safari before 15.4).
  const newId = (prefix: string) => {
    const tail = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    return `${prefix}-${tail}`;
  };

  // ── Render ───────────────────────────────────────────────────
  if (!activeFloor) {
    return (
      <AppShell
        crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Blueprint calibration' }]}
        title="Calibrate blueprint"
      >
        <div className="max-w-2xl mx-auto px-6 py-12 text-center bg-card border border-border rounded-lg">
          <Building2 className="w-10 h-10 mx-auto text-muted-foreground opacity-40" />
          <h3 className="mt-4 text-base">No floor found for this project</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {projectBuildingIds.size > 0
              ? 'This project has a building but no floors yet. Add one to start calibrating.'
              : 'Run the intake flow to create the project, or add a floor here to start from scratch.'}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={addAnotherFloor}>
              <Plus className="w-4 h-4 mr-1.5" />Add a floor
            </Button>
            <Button variant="secondary" onClick={() => nav(`/intake/${projectId}`)}>Open intake</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // M5 — prefer the IndexedDB-backed blob URL when the floor was uploaded
  // through the Web Worker path. Falls back to the legacy dataUrl for any
  // floor persisted before M5. Either way the SVG <image> renders the
  // same way.
  const bgUrl = usePlanBlobUrl(activeFloor.background) ?? activeFloor.background?.dataUrl ?? null;
  const bgW = activeFloor.background?.naturalWidth ?? 0;
  const bgH = activeFloor.background?.naturalHeight ?? 0;

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Blueprint calibration' }]}
      title="Calibrate blueprint"
      subtitle={step === 'done'
        ? `${activeFloor.name} · calibration saved`
        : `${activeFloor.name} · step ${stepIdx + 1} of ${STEPS.length}`}
      actions={
        <Button size="sm" variant="ghost" onClick={() => nav(`/project/${projectId}/canvas`)}>
          Skip to canvas <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      }
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        {/* Stepper */}
        <div className="flex items-center gap-1 flex-wrap">
          {STEPS.map((s, i) => {
            const isActive = s.id === step;
            const isDone = i < stepIdx;
            return (
              <button
                key={s.id}
                onClick={() => {
                  // Upload is always reachable so the operator can come
                  // back to swap a plan after landing on Done. Other
                  // forward jumps gated by required state.
                  if (s.id === 'upload') setStep('upload');
                  else if (i <= stepIdx) setStep(s.id);
                  else if (s.id === 'orient' && bgUrl) setStep('orient');
                  else if (s.id === 'scale'  && bgUrl) setStep('scale');
                  else if (s.id === 'floors' && activeFloor.calibratedAt) setStep('floors');
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : isDone
                      ? 'text-foreground hover:bg-secondary'
                      : 'text-muted-foreground hover:bg-secondary'
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${isDone ? 'bg-success text-success-foreground' : isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                  {isDone ? <Check className="w-2.5 h-2.5" /> : i + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          {/* Plan viewer */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between text-sm">
              <span className="truncate">
                {activeFloor.background?.fileName
                  ? `Floor plan · ${activeFloor.background.fileName}`
                  : 'No floor plan yet'}
              </span>
              {pts.length > 0 && step === 'scale' && (
                <button onClick={resetPoints} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" />Reset points
                </button>
              )}
            </div>

            {step === 'upload' && !bgUrl ? (
              <DropZone
                dragOver={dragOver}
                uploading={uploading}
                onDragEnter={() => setDragOver(true)}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDropZone}
                onChoose={() => fileRef.current?.click()}
              />
            ) : (
              <div className="relative aspect-[4/3] bg-canvas-background">
                <svg
                  ref={svgRef}
                  className={`absolute inset-0 w-full h-full ${step === 'scale' ? 'cursor-crosshair' : ''}`}
                  viewBox={bgW && bgH ? `0 0 ${bgW} ${bgH}` : '0 0 800 600'}
                  preserveAspectRatio="xMidYMid meet"
                  onClick={handlePick}
                >
                  <defs>
                    <pattern id="cal-dot" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="1" cy="1" r="1" fill="currentColor" opacity="0.08" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#cal-dot)" className="text-foreground" />
                  {bgUrl && bgW > 0 && (
                    <g transform={`rotate(${rotation} ${bgW / 2} ${bgH / 2})`}>
                      <image
                        href={bgUrl}
                        x={0} y={0}
                        width={bgW} height={bgH}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </g>
                  )}
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={Math.max(4, bgW / 200)} fill="var(--primary)" />
                      <text x={p.x + 12} y={p.y - 8} fill="var(--foreground)" fontSize={Math.max(11, bgW / 90)}>P{i + 1}</text>
                    </g>
                  ))}
                  {pts.length === 2 && (
                    <line
                      x1={pts[0].x} y1={pts[0].y}
                      x2={pts[1].x} y2={pts[1].y}
                      stroke="var(--primary)"
                      strokeWidth={Math.max(1.5, bgW / 800)}
                      strokeDasharray="6 6"
                    />
                  )}
                </svg>

                {/* Compass overlay during orient step */}
                {step === 'orient' && bgUrl && (
                  <div className="absolute top-3 right-3 bg-card border border-border rounded-full w-14 h-14 flex items-center justify-center shadow-md">
                    <Compass
                      className="w-8 h-8 text-primary"
                      style={{
                        transform: `rotate(${-rotation}deg)`,
                        transitionDuration: 'var(--motion-standard)',
                      }}
                    />
                  </div>
                )}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              className="hidden"
              data-testid="floorplan-file"
              onChange={(e) => { void handleUpload(e.target.files?.[0] ?? null); e.target.value = ''; }}
            />
          </div>

          {/* Side panel — step controller */}
          <div className="space-y-3">
            {step === 'upload' && (
              <UploadPanel
                hasBackground={!!bgUrl}
                onChoose={() => fileRef.current?.click()}
                onContinue={bgUrl ? () => setStep('orient') : undefined}
                uploading={uploading}
              />
            )}
            {step === 'orient' && (
              <OrientPanel
                rotation={rotation}
                onSet={setRotation}
                onBack={() => setStep('upload')}
                onContinue={() => setStep('scale')}
              />
            )}
            {step === 'scale' && (
              <ScalePanel
                pickCount={pts.length}
                realFeet={realFeet}
                onChangeFeet={setRealFeet}
                pxPerFt={pxPerFt}
                scalePxToFt={scalePxToFt}
                onConfirm={confirmScale}
                onBack={() => setStep('orient')}
                onResetPoints={resetPoints}
              />
            )}
            {step === 'floors' && (
              <FloorsPanel
                projectFloors={projectFloors}
                activeFloor={activeFloor}
                editingName={editingName}
                onEdit={() => setEditingName(true)}
                onCancelEdit={() => { setEditingName(false); setFloorName(activeFloor.name); setFloorLevel(activeFloor.level); }}
                floorName={floorName}
                setFloorName={setFloorName}
                floorLevel={floorLevel}
                setFloorLevel={setFloorLevel}
                onSaveMeta={saveFloorMeta}
                onAddFloor={addAnotherFloor}
                onSelectFloor={(id) => { if (id !== activeFloor.id) setActiveFloorId(id); }}
                onFinish={() => setStep('done')}
              />
            )}
            {step === 'done' && (
              <DonePanel
                projectFloors={projectFloors}
                activeFloor={activeFloor}
                onAddFloor={addAnotherFloor}
                onOpenCanvas={() => nav(`/project/${projectId}/canvas`)}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ──────────────────────────── Step panels ─────────────────────────
function UploadPanel({
  hasBackground, onChoose, onContinue, uploading,
}: {
  hasBackground: boolean;
  onChoose: () => void;
  onContinue?: () => void;
  uploading: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium">Upload a floor plan</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        PNG, JPG, or PDF. PDFs render the first page. Files are downscaled to keep the project under your local storage budget.
      </p>
      <Button variant="secondary" className="w-full" onClick={onChoose} disabled={uploading}>
        <Upload className="w-4 h-4 mr-1.5" />
        {uploading ? 'Loading…' : hasBackground ? 'Replace floor plan' : 'Choose file'}
      </Button>
      {onContinue && (
        <Button className="w-full" onClick={onContinue}>
          Continue <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      )}
    </div>
  );
}

function OrientPanel({
  rotation, onSet, onBack, onContinue,
}: {
  rotation: number;
  onSet: (deg: number) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const quickRot = (delta: number) => onSet(rotation + delta);
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-medium">Point the plan north</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Rotate until the top of the plan faces true north. The compass in the canvas updates in real time.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" onClick={() => quickRot(-90)}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" />90° left
        </Button>
        <Button size="sm" variant="secondary" onClick={() => quickRot(90)}>
          <RotateCw className="w-3.5 h-3.5 mr-1" />90° right
        </Button>
      </div>
      <div>
        <label className="text-xs text-muted-foreground flex justify-between">
          <span>Fine rotation</span>
          <span className="tabular-nums">{rotation.toFixed(0)}°</span>
        </label>
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={rotation}
          onChange={(e) => onSet(Number(e.target.value))}
          className="w-full mt-1 accent-primary"
        />
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="ghost" className="flex-1" onClick={() => onSet(0)}>Reset</Button>
          {[0, 90, 180, 270].map((d) => (
            <Button key={d} size="sm" variant="ghost" className="flex-1" onClick={() => onSet(d)}>{d}°</Button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-3.5 h-3.5 mr-1" />Back</Button>
        <Button className="flex-1" onClick={onContinue}>Continue <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
      </div>
    </div>
  );
}

function ScalePanel({
  pickCount, realFeet, onChangeFeet, pxPerFt, scalePxToFt, onConfirm, onBack, onResetPoints,
}: {
  pickCount: number;
  realFeet: string;
  onChangeFeet: (v: string) => void;
  pxPerFt: number;
  scalePxToFt: number;
  onConfirm: () => void;
  onBack: () => void;
  onResetPoints: () => void;
}) {
  // M5 — explicit blocker copy. The button used to disable silently with
  // no hint at why. Each missing condition appears as a chip below the
  // controls so the user knows exactly what's left.
  const missing: string[] = [];
  if (pickCount < 2) missing.push(pickCount === 0 ? 'Click 2 points on the plan' : 'Click 1 more point');
  if (!Number(realFeet)) missing.push('Enter the real distance in feet');
  else if (Number(realFeet) <= 0) missing.push('Distance must be greater than 0');
  if (pickCount === 2 && Number(realFeet) > 0 && scalePxToFt <= 0) missing.push('Points are at the same location, pick two distinct points');
  const ready = missing.length === 0;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium">Set the scale</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Click two points on the plan with a known real distance (a wall, a column grid, a door). Then enter how many feet that distance is.
      </p>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">Points: <span className="text-foreground tabular-nums">{pickCount} / 2</span></div>
        {pickCount > 0 && (
          <button onClick={onResetPoints} className="text-[11px] text-muted-foreground hover:text-foreground">
            Reset points
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Ruler className="w-4 h-4 text-muted-foreground" />
        <input
          value={realFeet}
          onChange={(e) => onChangeFeet(e.target.value)}
          type="number"
          min={0.1}
          step={0.1}
          className="flex-1 bg-input-background border border-input-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-primary"
          aria-label="Real distance in feet"
        />
        <span className="text-xs text-muted-foreground">feet</span>
      </div>
      {pxPerFt > 0 && (
        <div className="text-xs text-muted-foreground space-y-0.5 bg-secondary/50 rounded-md px-2.5 py-2">
          <div>Display scale: <span className="text-foreground tabular-nums">{pxPerFt.toFixed(2)} px per ft</span></div>
          <div className="text-[11px]">Stored as <span className="tabular-nums">{scalePxToFt.toFixed(4)}</span> ft per px.</div>
        </div>
      )}
      {/* Inline blocker chips. Appear only when the Apply button can't
          fire yet; vanish once every condition is satisfied. */}
      {!ready && (
        <ul className="space-y-1 rounded-md border border-border bg-secondary/30 px-2.5 py-2">
          {missing.map((m) => (
            <li key={m} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-500/80 shrink-0" />
              <span>{m}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-3.5 h-3.5 mr-1" />Back</Button>
        <Button
          className="flex-1"
          onClick={onConfirm}
          disabled={!ready}
          data-testid="confirm-scale"
          title={ready ? 'Save the scale and continue' : missing.join('. ')}
        >
          <Check className="w-3.5 h-3.5 mr-1" />Confirm scale
        </Button>
      </div>
    </div>
  );
}

function FloorsPanel({
  projectFloors, activeFloor, editingName, onEdit, onCancelEdit,
  floorName, setFloorName, floorLevel, setFloorLevel, onSaveMeta,
  onAddFloor, onSelectFloor, onFinish,
}: {
  projectFloors: Floor[];
  activeFloor: Floor;
  editingName: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  floorName: string;
  setFloorName: (v: string) => void;
  floorLevel: number;
  setFloorLevel: (n: number) => void;
  onSaveMeta: () => void;
  onAddFloor: () => void;
  onSelectFloor: (id: string) => void;
  onFinish: () => void;
}) {
  const calibratedCount = projectFloors.filter((f) => f.calibratedAt).length;
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium">Name this floor</h3>
        {editingName ? (
          <div className="mt-2 space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <input
                value={floorName}
                onChange={(e) => setFloorName(e.target.value)}
                className="mt-1 w-full bg-input-background border border-input-border rounded px-2 py-1.5 text-sm"
                placeholder="Ground floor, Floor 2, Basement"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex justify-between">
                <span>Level</span>
                <span className="text-foreground tabular-nums">{floorLevel >= 0 ? `Level ${floorLevel + 1}` : `Basement ${Math.abs(floorLevel)}`}</span>
              </label>
              <input
                type="number"
                value={floorLevel}
                onChange={(e) => setFloorLevel(Number(e.target.value))}
                className="mt-1 w-full bg-input-background border border-input-border rounded px-2 py-1.5 text-sm"
              />
              <div className="text-[11px] text-muted-foreground mt-1">0 is ground, 1 is the floor above, -1 is the first basement.</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={onSaveMeta}>Save</Button>
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between bg-secondary/40 rounded-md px-2.5 py-2">
            <div>
              <div className="text-sm">{activeFloor.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {activeFloor.level >= 0 ? `Level ${activeFloor.level + 1}` : `Basement ${Math.abs(activeFloor.level)}`}
                {activeFloor.calibratedAt && activeFloor.scalePxToFt > 0 && (
                  <> · {(1 / activeFloor.scalePxToFt).toFixed(2)} px / ft</>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={onEdit}><Edit3 className="w-3.5 h-3.5 mr-1" />Edit</Button>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">All floors</h3>
          <span className="text-[11px] text-muted-foreground">{calibratedCount} of {projectFloors.length} calibrated</span>
        </div>
        <div className="space-y-1">
          {projectFloors.map((f) => {
            const isActive = f.id === activeFloor.id;
            const calibrated = !!f.calibratedAt;
            return (
              <button
                key={f.id}
                onClick={() => onSelectFloor(f.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-sm transition-colors ${
                  isActive ? 'bg-primary/15 text-primary' : 'hover:bg-secondary'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 opacity-60" />
                  <span>{f.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {f.level >= 0 ? `L${f.level + 1}` : `B${Math.abs(f.level)}`}
                  </span>
                </span>
                <span className={`text-[11px] ${calibrated ? 'text-success' : 'text-muted-foreground'}`}>
                  {calibrated ? 'Calibrated' : 'Pending'}
                </span>
              </button>
            );
          })}
        </div>
        <Button variant="secondary" className="w-full" onClick={onAddFloor}>
          <Plus className="w-3.5 h-3.5 mr-1" />Add another floor
        </Button>
      </div>

      <div className="pt-2 border-t border-border">
        <Button className="w-full" onClick={onFinish}>
          <Check className="w-3.5 h-3.5 mr-1" />I am done calibrating
        </Button>
      </div>
    </div>
  );
}

function DonePanel({
  projectFloors, activeFloor, onAddFloor, onOpenCanvas,
}: {
  projectFloors: Floor[];
  activeFloor: Floor;
  onAddFloor: () => void;
  onOpenCanvas: () => void;
}) {
  const ready = projectFloors.filter((f) => f.calibratedAt).length;
  return (
    <div className="bg-card border border-success/40 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-success/15 text-success flex items-center justify-center">
          <Check className="w-4 h-4" />
        </span>
        <div>
          <div className="text-sm font-medium">Calibration saved</div>
          <div className="text-xs text-muted-foreground">{activeFloor.name} · {(1 / activeFloor.scalePxToFt).toFixed(2)} px per ft</div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {ready} of {projectFloors.length} floors are ready for design work.
      </div>
      <Button className="w-full" onClick={onOpenCanvas}>
        Open canvas <ArrowRight className="w-3.5 h-3.5 ml-1" />
      </Button>
      <Button variant="secondary" className="w-full" onClick={onAddFloor}>
        <Plus className="w-3.5 h-3.5 mr-1" />Calibrate another floor
      </Button>
    </div>
  );
}

// ──────────────────────────── Drop zone ───────────────────────────
function DropZone({
  dragOver, uploading, onDragEnter, onDragLeave, onDrop, onChoose,
}: {
  dragOver: boolean;
  uploading: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onChoose: () => void;
}) {
  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); onDragEnter(); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`aspect-[4/3] flex flex-col items-center justify-center text-center px-6 transition-colors ${
        dragOver ? 'bg-primary/10 border-2 border-dashed border-primary' : 'bg-canvas-background border-2 border-dashed border-transparent'
      }`}
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
        <Upload className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-base">Drop a floor plan here</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
        PNG, JPG, or PDF. We render the first page of a PDF, downscale large images, and keep the file with this project.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={onChoose} disabled={uploading}>
          <Upload className="w-4 h-4 mr-1.5" />
          {uploading ? 'Loading…' : 'Choose file'}
        </Button>
      </div>
      <div className="mt-5 flex gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" />PNG</span>
        <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" />JPG</span>
        <span className="flex items-center gap-1"><FileText className="w-3 h-3" />PDF</span>
      </div>
    </div>
  );
}

