import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Upload, Ruler, Check, RotateCcw } from 'lucide-react';

interface Point { x: number; y: number; }

export function BlueprintCalibration() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();
  const [step, setStep] = useState<'upload' | 'pick' | 'measure' | 'done'>('upload');
  const [pts, setPts] = useState<Point[]>([]);
  const [realFeet, setRealFeet] = useState('25');
  const svgRef = useRef<SVGSVGElement>(null);

  const handlePick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (step !== 'pick' || pts.length >= 2) return;
    const r = svgRef.current!.getBoundingClientRect();
    const next = [...pts, { x: e.clientX - r.left, y: e.clientY - r.top }];
    setPts(next);
    if (next.length === 2) setStep('measure');
  };

  const reset = () => { setPts([]); setStep('pick'); };
  const pxDist = pts.length === 2 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 0;
  const pxPerFt = pxDist && Number(realFeet) ? pxDist / Number(realFeet) : 0;

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Blueprint calibration' }]}
      title="Calibrate blueprint"
      subtitle="Pick two points of known distance to set the scale"
    >
      <div className="max-w-[1200px] mx-auto px-6 py-6 grid grid-cols-[1fr_320px] gap-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <div className="text-sm font-medium">Floor plan</div>
            {pts.length > 0 && (
              <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><RotateCcw className="w-3 h-3" />Reset points</button>
            )}
          </div>
          <div className="relative aspect-[4/3] bg-canvas-background">
            <svg ref={svgRef} className="absolute inset-0 w-full h-full cursor-crosshair" onClick={handlePick}>
              <defs>
                <pattern id="cal-dot" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="currentColor" opacity="0.08" /></pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cal-dot)" className="text-foreground" />
              {step !== 'upload' && (
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
            <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => setStep('pick')}>
              <Upload className="w-3.5 h-3.5 mr-1" />Choose PDF or image
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Demo plan loaded. Click to continue.</p>
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
              <div className="mt-3 text-xs text-muted-foreground">
                Scale: <span className="text-foreground">{pxPerFt.toFixed(2)} px / ft</span>
              </div>
            )}
            <Button size="sm" className="w-full mt-3" disabled={pts.length !== 2 || !Number(realFeet)} onClick={() => setStep('done')}>
              <Check className="w-3.5 h-3.5 mr-1" />Confirm scale
            </Button>
          </Card>

          {step === 'done' && (
            <Button className="w-full" onClick={() => nav(`/project/${projectId}/canvas`)}>Open canvas</Button>
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
