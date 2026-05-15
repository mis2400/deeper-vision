import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Sparkles, ScanLine, AlertTriangle, Check, ArrowRight, Camera, Play, Pause, Footprints, Layers as LayersIcon, FileText } from 'lucide-react';

interface Finding { id: string; severity: 'high' | 'med' | 'low'; title: string; detail: string; recommend: string; x: number; y: number; }

const FINDINGS: Finding[] = [
  { id: 'f1', severity: 'high', title: 'Blind spot at NE corner',     detail: 'No camera covers the NE loading bay; FOV gap ~28ft.', recommend: 'Add Axis P1468-LE bullet on column G-7.', x: 78, y: 22 },
  { id: 'f2', severity: 'high', title: 'Egress door fail-secure',     detail: 'DR-2 currently fail-secure but on egress path.',       recommend: 'Switch to Von Duprin 6210 fail-safe strike.',  x: 36, y: 64 },
  { id: 'f3', severity: 'med',  title: 'PoE budget on IDF-C 94%',     detail: 'One additional PoE+ device will exceed budget.',       recommend: 'Re-home CAM-308 to IDF-B (63% used).',         x: 56, y: 40 },
  { id: 'f4', severity: 'med',  title: 'Reader at non-ADA height',    detail: 'RD-12 mounted at 52" — exceeds ADA 48" reach.',         recommend: 'Lower to 46" centerline.',                     x: 22, y: 50 },
  { id: 'f5', severity: 'low',  title: 'Cable run exceeds 90m',       detail: 'Run from CAM-103 to IDF-A is 92m.',                     recommend: 'Re-route via Riser-2 (78m) or add midspan.',   x: 64, y: 18 },
];

type ScanStep = 'walk' | 'review' | 'findings';

export function VisionScan() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();
  const [step, setStep] = useState<ScanStep>('findings');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(true);
  const [selId, setSelId] = useState(FINDINGS[0].id);
  const [filter, setFilter] = useState<'all' | Finding['severity']>('all');
  // Walk-and-scan progress (simulated). The UI is the design intent —
  // when the AR/LiDAR backend ships, this same flow drives the actual capture.
  const [walkPct, setWalkPct] = useState(0);
  const [walkRunning, setWalkRunning] = useState(false);
  useEffect(() => {
    if (!walkRunning) return;
    const t = window.setInterval(() => {
      setWalkPct((p) => {
        const next = p + 4;
        if (next >= 100) { setWalkRunning(false); return 100; }
        return next;
      });
    }, 220);
    return () => window.clearInterval(t);
  }, [walkRunning]);

  const filtered = useMemo(() => filter === 'all' ? FINDINGS : FINDINGS.filter((f) => f.severity === filter), [filter]);
  const sel = FINDINGS.find((f) => f.id === selId)!;

  const run = () => {
    setRunning(true); setDone(false);
    setTimeout(() => { setRunning(false); setDone(true); }, 1800);
  };

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Vision scan' }]}
      title="Vision scan"
      subtitle="Walk a site, generate a floorplan, surface findings — all in one flow · simulated"
      actions={<Button size="sm" onClick={run} disabled={running}><Sparkles className="w-3.5 h-3.5 mr-1" />{running ? 'Scanning…' : 'Re-run scan'}</Button>}
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">
        {/* Honesty banner — vision scan is currently a simulated workflow.
            The walk-and-scan UI captures the design intent of the workflow:
            when AR/LiDAR shipping arrives the same flow drives a real capture. */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2.5 text-[11.5px] text-amber-200/90 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-300/80 mt-0.5 shrink-0" />
          <div>
            Simulated vision scan. Walk-and-scan capture and AR overlays are demonstrative —
            findings below come from a representative project, not your live canvas.
            When AR / LiDAR capture ships, this same UI drives the real session.
          </div>
        </div>

        {/* Step navigation — Walk · Review · Findings. The flow is meant to
            be linear, but the user can jump between steps; each step is a
            real, functional UI. */}
        <div className="bg-card border border-border rounded-lg p-1.5 inline-flex gap-1">
          {([
            { id: 'walk',     label: '1 · Walk',     icon: Footprints },
            { id: 'review',   label: '2 · Review',   icon: LayersIcon },
            { id: 'findings', label: '3 · Findings', icon: FileText },
          ] as const).map((s) => {
            const active = step === s.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`px-3 h-8 rounded text-[12px] inline-flex items-center gap-1.5 transition-colors ${
                  active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />{s.label}
              </button>
            );
          })}
        </div>

        {step === 'walk' && (
          <div className="grid grid-cols-[1fr_320px] gap-4">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Walk the site</span>
                </div>
                <div className="text-[11px] text-muted-foreground">Hold the phone / tablet steady. Walk a continuous loop.</div>
              </div>
              <div className="relative aspect-[4/3] bg-canvas-background overflow-hidden">
                {/* Simulated AR overlay over a generic floor */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 600">
                  <defs>
                    <pattern id="walk-dot" width="16" height="16" patternUnits="userSpaceOnUse">
                      <circle cx="1" cy="1" r="1" fill="#E6EDF3" opacity="0.05" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#walk-dot)" />
                  {/* Walk path traced so far */}
                  <path
                    d="M 120 480 L 200 480 L 200 360 L 380 360 L 380 240 L 580 240 L 580 380 L 680 380"
                    fill="none"
                    stroke="#5292DC"
                    strokeWidth="3"
                    strokeDasharray="4 6"
                    strokeLinecap="round"
                    strokeDashoffset={1000 - walkPct * 10}
                  />
                  {/* Capture dots */}
                  {[120, 200, 380, 580, 680].slice(0, Math.max(1, Math.round(walkPct / 22))).map((x, i) => (
                    <circle key={i} cx={x} cy={i < 2 ? 480 : i === 2 ? 360 : i === 3 ? 240 : 380} r="6" fill="#5292DC" opacity="0.85" />
                  ))}
                </svg>
                {/* Phone / camera indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-card border border-border text-[11px] text-slate-200 inline-flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5" />
                  Capturing… {walkPct}%
                </div>
              </div>
              <div className="px-4 py-3 border-t border-border flex items-center gap-2">
                <Button size="sm" onClick={() => { setWalkPct(0); setWalkRunning(true); }} disabled={walkRunning}>
                  <Play className="w-3.5 h-3.5 mr-1" />{walkRunning ? 'Recording…' : 'Start walk'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setWalkRunning(false); }} disabled={!walkRunning}>
                  <Pause className="w-3.5 h-3.5 mr-1" />Pause
                </Button>
                <span className="text-[11px] text-muted-foreground ml-auto">{walkPct}% complete</span>
                <Button size="sm" variant={walkPct >= 100 ? 'default' : 'outline'} onClick={() => setStep('review')} disabled={walkPct < 100}>
                  Continue <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="text-[13px] font-medium">Walk-and-scan</div>
              <div className="text-[11.5px] text-muted-foreground leading-relaxed">
                Hold the phone or tablet so the rear camera faces the floor and walls.
                Walk a continuous loop around the area — corners are captured automatically.
                The system generates a floorplan from the path + visual depth.
              </div>
              <div className="space-y-1.5 text-[11.5px]">
                <Tip label="Capture rate"     value="30 fps" />
                <Tip label="Walls detected"   value={Math.max(0, Math.round(walkPct / 12))} />
                <Tip label="Floor coverage"   value={`${walkPct}%`} />
                <Tip label="Estimated area"   value={`${Math.round(walkPct * 18)} sq ft`} />
              </div>
              <div className="text-[10.5px] text-muted-foreground/80 pt-2 border-t border-border/60">
                When the AR/LiDAR backend ships, "Start walk" hands off to the phone camera and AR scene reconstruction.
              </div>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="grid grid-cols-[1fr_320px] gap-4">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <LayersIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Generated floorplan</span>
                </div>
                <div className="text-[11px] text-muted-foreground">Generated from {walkPct >= 100 ? 'completed walk' : 'walk in progress'}</div>
              </div>
              <div className="relative aspect-[4/3] bg-canvas-background">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 600">
                  <defs>
                    <pattern id="rev-dot" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="1" cy="1" r="1" fill="#E6EDF3" opacity="0.06" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#rev-dot)" />
                  {/* Generated walls */}
                  <g stroke="#5292DC" strokeWidth="2.5" fill="none" opacity={walkPct >= 100 ? 0.95 : 0.45}>
                    <rect x="120" y="120" width="560" height="360" />
                    <line x1="380" y1="120" x2="380" y2="480" />
                    <line x1="120" y1="280" x2="380" y2="280" />
                    <line x1="380" y1="320" x2="680" y2="320" />
                  </g>
                  <g fill="#E8EDF4" fontSize="11">
                    <text x="240" y="200">Lobby</text>
                    <text x="500" y="200">Open office</text>
                    <text x="240" y="400">Conf A</text>
                    <text x="500" y="420">Storage</text>
                  </g>
                </svg>
              </div>
              <div className="px-4 py-3 border-t border-border flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setStep('walk')}>
                  Back to walk
                </Button>
                <span className="text-[11px] text-muted-foreground ml-auto">4 rooms · 8 walls · 1 entry detected</span>
                <Button size="sm" onClick={() => { nav(`/project/${projectId}/canvas`); }}>
                  Import to canvas <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 space-y-3 text-[11.5px]">
              <div className="text-[13px] font-medium">What we generated</div>
              <Tip label="Walls"    value="8 segments · 162 ft total" />
              <Tip label="Rooms"    value="4 polygons" />
              <Tip label="Doors"    value="3 detected" />
              <Tip label="Windows"  value="6 detected" />
              <Tip label="Ceiling height" value="9.2 ft (avg)" />
              <Tip label="Scale"    value="1 px = 0.12 ft" />
              <div className="text-[10.5px] text-muted-foreground/80 pt-2 border-t border-border/60">
                Importing snaps the generated plan onto the project canvas. Existing devices are preserved; you can re-anchor them after.
              </div>
            </div>
          </div>
        )}

        {step === 'findings' && (
      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <ScanLine className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Coverage map</span>
            </div>
            <div className="flex gap-1">
              {(['all', 'high', 'med', 'low'] as const).map((s) => (
                <button key={s} onClick={() => setFilter(s)} className={`text-xs px-2 py-1 rounded border ${filter === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="relative aspect-[4/3] bg-canvas-background">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 600">
              <defs>
                <pattern id="vs-dot" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#E6EDF3" opacity="0.06" /></pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#vs-dot)" />
              <g stroke="#7D8590" strokeWidth="1.5" fill="none">
                <rect x="60" y="60" width="680" height="480" />
                <line x1="400" y1="60" x2="400" y2="540" />
                <line x1="60" y1="300" x2="740" y2="300" />
              </g>
              {/* Existing cameras with coverage */}
              {[
                { x: 200, y: 200 }, { x: 560, y: 220 }, { x: 240, y: 420 }, { x: 580, y: 440 },
              ].map((c, i) => (
                <g key={i}>
                  <circle cx={c.x} cy={c.y} r="50" fill="#2F81F7" opacity="0.07" />
                  <circle cx={c.x} cy={c.y} r="4" fill="#2F81F7" />
                </g>
              ))}
              {/* Findings */}
              {filtered.map((f) => {
                const x = (f.x / 100) * 800;
                const y = (f.y / 100) * 600;
                const tone = f.severity === 'high' ? '#F85149' : f.severity === 'med' ? '#D29922' : '#79C0FF';
                const active = sel.id === f.id;
                return (
                  <g key={f.id} className="cursor-pointer" onClick={() => setSelId(f.id)}>
                    <circle cx={x} cy={y} r={active ? 14 : 10} fill={tone} opacity="0.2" />
                    <circle cx={x} cy={y} r="5" fill={tone} stroke="#0D1117" strokeWidth="2" />
                  </g>
                );
              })}
            </svg>
            {running && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4 mr-2 text-primary" />Analyzing canvas…
              </div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div>{FINDINGS.length} findings · scan completed {done ? 'just now' : '—'}</div>
            <div className="flex items-center gap-3">
              <Legend dot="#F85149" label="High" />
              <Legend dot="#D29922" label="Med" />
              <Legend dot="#79C0FF" label="Low" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-sm font-medium">Findings</div>
            {filtered.map((f) => {
              const tone = f.severity === 'high' ? 'text-red-400' : f.severity === 'med' ? 'text-amber-400' : 'text-primary';
              return (
                <button key={f.id} onClick={() => setSelId(f.id)} className={`w-full text-left px-3 py-2.5 border-b border-border last:border-b-0 ${selId === f.id ? 'bg-secondary' : 'hover:bg-secondary/40'}`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-3.5 h-3.5 ${tone}`} />
                    <div className="text-sm flex-1">{f.title}</div>
                    <span className={`text-[10px] uppercase tracking-wider ${tone}`}>{f.severity}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Selected</div>
            <h3 className="text-sm font-medium mt-1">{sel.title}</h3>
            <p className="text-xs text-muted-foreground mt-2">{sel.detail}</p>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Recommendation</div>
              <p className="text-sm">{sel.recommend}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1"><Check className="w-3.5 h-3.5 mr-1" />Apply</Button>
              <Button size="sm" variant="outline" onClick={() => nav(`/project/${projectId}/canvas`)}>Canvas <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
            </div>
          </div>
        </div>
      </div>
        )}
      </div>
    </AppShell>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: dot }} />{label}</span>;
}

function Tip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-slate-200">{value}</span>
    </div>
  );
}
