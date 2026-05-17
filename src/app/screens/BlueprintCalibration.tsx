import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Upload, Ruler, Check, RotateCcw } from 'lucide-react';
import { useProjectStore, selectors } from '../store/projectStore';

interface Point { x: number; y: number; }

// Cap stored data URLs to keep localStorage manageable.
const MAX_BG_LONG_EDGE = 2048;

async function fileToFloorBackground(file: File): Promise<{
  dataUrl: string;
  fileName: string;
  origin: 'png' | 'jpg' | 'pdf';
  naturalWidth: number;
  naturalHeight: number;
}> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isJpg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
  const origin: 'png' | 'jpg' | 'pdf' = isPdf ? 'pdf' : isJpg ? 'jpg' : 'png';
  // Read the raw bytes first so we have a fallback if image decode fails.
  const rawDataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  if (isPdf) {
    return { dataUrl: rawDataUrl, fileName: file.name, origin, naturalWidth: 1024, naturalHeight: 768 };
  }
  // Decode once to pull natural dimensions and optionally downscale for storage.
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('image decode failed'));
    i.src = rawDataUrl;
  });
  const w0 = img.naturalWidth;
  const h0 = img.naturalHeight;
  const long = Math.max(w0, h0);
  if (long <= MAX_BG_LONG_EDGE) {
    return { dataUrl: rawDataUrl, fileName: file.name, origin, naturalWidth: w0, naturalHeight: h0 };
  }
  const scale = MAX_BG_LONG_EDGE / long;
  const w1 = Math.round(w0 * scale);
  const h1 = Math.round(h0 * scale);
  const c = document.createElement('canvas');
  c.width = w1; c.height = h1;
  const ctx = c.getContext('2d');
  if (!ctx) return { dataUrl: rawDataUrl, fileName: file.name, origin, naturalWidth: w0, naturalHeight: h0 };
  ctx.drawImage(img, 0, 0, w1, h1);
  const mime = isJpg ? 'image/jpeg' : 'image/png';
  const dataUrl = c.toDataURL(mime, isJpg ? 0.9 : undefined);
  return { dataUrl, fileName: file.name, origin, naturalWidth: w1, naturalHeight: h1 };
}

export function BlueprintCalibration() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();
  const [step, setStep] = useState<'upload' | 'pick' | 'measure' | 'done'>('upload');
  const [pts, setPts] = useState<Point[]>([]);
  const [realFeet, setRealFeet] = useState('25');
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const floor = useProjectStore((s) => selectors.firstFloorOfProject(s, projectId));
  const updateFloor = useProjectStore((s) => s.updateFloor);
  const setFloorBackground = useProjectStore((s) => s.setFloorBackground);

  // If the floor already carries a persisted background (e.g. user re-enters
  // /calibrate after a previous session), skip directly to the pick step.
  useEffect(() => {
    if (floor?.background?.dataUrl && step === 'upload') {
      setImgSize({ w: floor.background.naturalWidth, h: floor.background.naturalHeight });
      setStep('pick');
    }
  }, [floor, step]);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    if (!floor) {
      toast.error('No floor found for this project. Complete intake first.');
      return;
    }
    try {
      const bg = await fileToFloorBackground(file);
      setFloorBackground(floor.id, {
        dataUrl: bg.dataUrl,
        fileName: bg.fileName,
        origin: bg.origin,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        naturalWidth: bg.naturalWidth,
        naturalHeight: bg.naturalHeight,
        locked: false,
      });
      setImgSize({ w: bg.naturalWidth, h: bg.naturalHeight });
      setStep('pick');
      toast.success(`Floorplan loaded · ${bg.fileName}`);
    } catch (err) {
      console.error('floorplan upload failed', err);
      toast.error('Could not load that file. Try a PNG or JPG.');
    }
  };

  const handlePick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (step !== 'pick' || pts.length >= 2) return;
    const r = svgRef.current!.getBoundingClientRect();
    const next = [...pts, { x: e.clientX - r.left, y: e.clientY - r.top }];
    setPts(next);
    if (next.length === 2) setStep('measure');
  };

  const reset = () => { setPts([]); setStep('pick'); };
  const pxDist = pts.length === 2 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 0;
  // scalePxToFt is "1 canvas px = X feet". Calibration stores realFeet / pxDist.
  const scalePxToFt = pxDist && Number(realFeet) ? Number(realFeet) / pxDist : 0;
  // Display the inverse for humans — engineers expect px / ft.
  const pxPerFt = scalePxToFt > 0 ? 1 / scalePxToFt : 0;

  const bgUrl = floor?.background?.dataUrl ?? null;

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Blueprint calibration' }]}
      title="Calibrate blueprint"
      subtitle="Pick two points of known distance to set the scale"
    >
      <div className="max-w-[1200px] mx-auto px-6 py-6 grid grid-cols-[1fr_320px] gap-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">Floor plan {floor?.background?.fileName ? `· ${floor.background.fileName}` : ''}</div>
            {pts.length > 0 && (
              <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><RotateCcw className="w-3 h-3" />Reset points</button>
            )}
          </div>
          <div className="relative aspect-[4/3] bg-canvas-background">
            <svg
              ref={svgRef}
              className="absolute inset-0 w-full h-full cursor-crosshair"
              viewBox={imgSize ? `0 0 ${imgSize.w} ${imgSize.h}` : undefined}
              preserveAspectRatio="xMidYMid meet"
              onClick={handlePick}
            >
              <defs>
                <pattern id="cal-dot" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="currentColor" opacity="0.08" /></pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cal-dot)" className="text-foreground" />
              {bgUrl && imgSize && (
                <image href={bgUrl} x={0} y={0} width={imgSize.w} height={imgSize.h} preserveAspectRatio="xMidYMid meet" />
              )}
              {!bgUrl && step !== 'upload' && (
                <g stroke="#7D8590" strokeWidth="1.5" fill="none">
                  <rect x="60" y="60" width="600" height="400" />
                  <line x1="360" y1="60" x2="360" y2="460" />
                  <line x1="60" y1="260" x2="660" y2="260" />
                </g>
              )}
              {pts.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="6" fill="#2F81F7" />
                  <text x={p.x + 10} y={p.y - 8} fill="#E6EDF3" fontSize="11">P{i + 1}</text>
                </g>
              ))}
              {pts.length === 2 && (
                <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke="#2F81F7" strokeWidth="1.5" strokeDasharray="4 4" />
              )}
            </svg>
          </div>
        </div>

        <div className="space-y-3">
          <Card active={step === 'upload'} done={step !== 'upload'} n={1} title="Upload blueprint">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              className="hidden"
              data-testid="floorplan-file"
              onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
            />
            <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1" />Choose PDF or image
            </Button>
            <p className="text-xs text-muted-foreground mt-2">PNG / JPG / PDF. Stored locally with the project.</p>
            {!floor && (
              <p className="text-[11px] text-amber-500 mt-2">No floor found — complete <span className="underline">/intake</span> first.</p>
            )}
            <button
              type="button"
              onClick={() => setStep('pick')}
              className="mt-2 text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Skip — calibrate on a blank grid
            </button>
          </Card>

          <Card active={step === 'pick'} done={pts.length === 2} n={2} title="Pick two reference points">
            <p className="text-xs text-muted-foreground">Click two points on the plan with a known real-world distance (a wall, a door, a column grid).</p>
            <div className="text-xs mt-2 text-muted-foreground">Points: {pts.length} / 2</div>
          </Card>

          <Card active={step === 'measure'} done={step === 'done'} n={3} title="Enter the real distance">
            <div className="mt-2 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-muted-foreground" />
              <input value={realFeet} onChange={(e) => setRealFeet(e.target.value)} type="number" className="flex-1 bg-input-background border border-input-border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary" />
              <span className="text-xs text-muted-foreground">feet</span>
            </div>
            {pxPerFt > 0 && (
              <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
                <div>Scale: <span className="text-foreground tabular-nums">{pxPerFt.toFixed(2)} px / ft</span></div>
                <div className="text-[10.5px]">Stored as <span className="tabular-nums">{scalePxToFt.toFixed(4)}</span> ft / px on the active floor.</div>
              </div>
            )}
            <Button
              size="sm"
              className="w-full mt-3"
              disabled={pts.length !== 2 || !Number(realFeet) || scalePxToFt <= 0}
              onClick={() => {
                if (!floor) {
                  toast.error('No floor found for this project. Complete intake first.');
                  return;
                }
                updateFloor(floor.id, {
                  scalePxToFt,
                  calibratedAt: Date.now(),
                  calibrationReferenceFt: Number(realFeet),
                  calibrationMeasuredPx: pxDist,
                });
                toast.success(`Scale saved: ${pxPerFt.toFixed(2)} px / ft`);
                setStep('done');
              }}
            >
              <Check className="w-3.5 h-3.5 mr-1" />Confirm scale
            </Button>
          </Card>

          {step === 'done' && floor && (
            <div className="bg-card border border-emerald-400/40 rounded-lg p-3 space-y-2">
              <div className="text-xs text-muted-foreground">
                Saved to <span className="text-foreground">{floor.name}</span> — {(1 / floor.scalePxToFt).toFixed(2)} px / ft.
              </div>
              <Button className="w-full" onClick={() => nav(`/project/${projectId}/canvas`)}>Open canvas</Button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Card({ n, title, children, active, done }: { n: number; title: string; children: React.ReactNode; active: boolean; done: boolean }) {
  return (
    <div className={`bg-card border rounded-lg p-3 ${active ? 'border-primary' : 'border-border'}`}>
      <div className="flex items-center gap-2">
        <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center ${done ? 'bg-emerald-400/15 text-emerald-400' : active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
          {done ? <Check className="w-3 h-3" /> : n}
        </span>
        <div className="text-sm font-medium">{title}</div>
      </div>
      <div className="pl-7">{children}</div>
    </div>
  );
}
