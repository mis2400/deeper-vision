import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Play, Pause, RotateCcw, Eye, EyeOff, Shield, Clock, TrendingUp, Footprints, AlertTriangle } from 'lucide-react';

type Scenario = 'after-hours' | 'tailgate' | 'loading-dock' | 'roof' | 'social';

const SCENARIOS: Array<{ id: Scenario; label: string; desc: string; entry: string }> = [
  { id: 'after-hours',  label: 'After-hours breach', desc: 'Single actor, 2:00am, no insider help', entry: 'Rear service door' },
  { id: 'tailgate',     label: 'Daytime tailgate',   desc: 'Follows employee through main entry',  entry: 'Main lobby turnstile' },
  { id: 'loading-dock', label: 'Loading dock',       desc: 'Disguised as delivery, no badge',       entry: 'Loading dock bay 2' },
  { id: 'roof',         label: 'Roof access',        desc: 'Adjacent building → HVAC penetration',  entry: 'Roof hatch' },
  { id: 'social',       label: 'Social engineering', desc: 'Phones reception, requests escort',     entry: 'Front reception' },
];

interface Hop { node: string; x: number; y: number; coverage: 'covered' | 'gap' | 'partial'; risk: number; }

const PATHS: Record<Scenario, Hop[]> = {
  'after-hours': [
    { node: 'Rear door',    x: 5,  y: 70, coverage: 'gap',     risk: 92 },
    { node: 'Service hall', x: 18, y: 70, coverage: 'partial', risk: 78 },
    { node: 'Kitchen',      x: 32, y: 60, coverage: 'gap',     risk: 88 },
    { node: 'Stairwell B',  x: 48, y: 45, coverage: 'partial', risk: 71 },
    { node: 'Exec floor',   x: 68, y: 28, coverage: 'covered', risk: 22 },
    { node: 'Safe room',    x: 88, y: 18, coverage: 'covered', risk: 8  },
  ],
  'tailgate': [
    { node: 'Lobby',         x: 8,  y: 80, coverage: 'covered', risk: 18 },
    { node: 'Turnstile',     x: 22, y: 70, coverage: 'partial', risk: 64 },
    { node: 'Elevator bank', x: 38, y: 55, coverage: 'covered', risk: 24 },
    { node: 'Floor 4',       x: 55, y: 40, coverage: 'gap',     risk: 81 },
    { node: 'Server room',   x: 78, y: 25, coverage: 'partial', risk: 58 },
  ],
  'loading-dock': [
    { node: 'Dock 2',      x: 6,  y: 60, coverage: 'partial', risk: 68 },
    { node: 'Receiving',   x: 22, y: 60, coverage: 'gap',     risk: 84 },
    { node: 'Warehouse',   x: 42, y: 50, coverage: 'partial', risk: 72 },
    { node: 'Office hall', x: 62, y: 35, coverage: 'covered', risk: 28 },
    { node: 'Records',     x: 85, y: 22, coverage: 'partial', risk: 55 },
  ],
  'roof': [
    { node: 'Roof hatch',  x: 50, y: 8,  coverage: 'gap',     risk: 96 },
    { node: 'Mech room',   x: 50, y: 22, coverage: 'gap',     risk: 90 },
    { node: 'Floor 5',     x: 50, y: 38, coverage: 'partial', risk: 70 },
    { node: 'Floor 3 IT',  x: 65, y: 55, coverage: 'partial', risk: 62 },
    { node: 'Core switch', x: 82, y: 70, coverage: 'covered', risk: 30 },
  ],
  'social': [
    { node: 'Reception',      x: 10, y: 78, coverage: 'covered', risk: 35 },
    { node: 'Guest badge',    x: 28, y: 70, coverage: 'partial', risk: 55 },
    { node: 'Conference',     x: 48, y: 55, coverage: 'partial', risk: 60 },
    { node: 'Open floor',     x: 68, y: 40, coverage: 'gap',     risk: 78 },
    { node: 'Exec assistant', x: 88, y: 25, coverage: 'partial', risk: 66 },
  ],
};

export function ThreatSimulator() {
  const navigate = useNavigate();
  const { projectId = 'p1' } = useParams();
  const [scen, setScen] = useState<Scenario>('after-hours');
  const [playing, setPlaying] = useState(false);
  const [hop, setHop] = useState(0);
  const [adv, setAdv] = useState(false);

  const path = PATHS[scen];
  const cur = path[hop];

  const exposure = useMemo(() => {
    const covered = path.filter((h) => h.coverage === 'covered').length;
    return Math.round(((path.length - covered) / path.length) * 100);
  }, [path]);

  const togglePlay = () => {
    if (playing) { setPlaying(false); return; }
    setPlaying(true); setHop(0);
    let i = 0;
    const tick = () => { i++; if (i >= path.length) { setPlaying(false); return; } setHop(i); setTimeout(tick, 900); };
    setTimeout(tick, 900);
  };

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Canvas', to: `/project/${projectId}/canvas` }, { label: 'Threat simulator' }]}
      title="Threat simulator"
      subtitle="Replay adversarial paths against the current coverage"
      actions={
        <Button size="sm" variant="ghost" onClick={() => setAdv((v) => !v)}>
          {adv ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
          {adv ? 'Defender view' : 'Adversary view'}
        </Button>
      }
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-[240px_1fr_260px] gap-4">
        <div className="bg-card border border-border rounded-lg p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">Scenarios</div>
          {SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => { setScen(s.id); setHop(0); setPlaying(false); }} className={`w-full text-left px-2.5 py-2 rounded transition-colors ${scen === s.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}>
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Entry · {s.entry}</div>
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{SCENARIOS.find((s) => s.id === scen)?.label}</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setHop(0); setPlaying(false); }}><RotateCcw className="w-3.5 h-3.5" /></Button>
              <Button size="sm" onClick={togglePlay}>
                {playing ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                {playing ? 'Pause' : 'Replay'}
              </Button>
            </div>
          </div>
          <div className="relative bg-background rounded-md border border-border overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
              <defs>
                <pattern id="g-th" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="0.4" cy="0.4" r="0.3" fill="rgba(125,133,144,0.3)" /></pattern>
              </defs>
              <rect width="100" height="100" fill="url(#g-th)" />
              {path.map((h, i) => {
                if (i === 0) return null;
                const a = path[i - 1];
                const visible = i <= hop;
                const tone = h.coverage === 'covered' ? '#3FB950' : h.coverage === 'partial' ? '#D29922' : '#F85149';
                return <line key={i} x1={a.x} y1={a.y} x2={h.x} y2={h.y} stroke={tone} strokeWidth="0.5" strokeDasharray="1.5 1" opacity={visible ? 0.9 : 0.2} />;
              })}
              {path.map((h, i) => {
                const tone = h.coverage === 'covered' ? '#3FB950' : h.coverage === 'partial' ? '#D29922' : '#F85149';
                const active = i === hop;
                const visible = i <= hop;
                return (
                  <g key={i} opacity={visible ? 1 : 0.25}>
                    <circle cx={h.x} cy={h.y} r={active ? 2 : 1.3} fill={tone} stroke="#0D1117" strokeWidth="0.3" />
                    {active && <circle cx={h.x} cy={h.y} r={4} fill="none" stroke={tone} strokeWidth="0.3" opacity="0.5"><animate attributeName="r" from="2" to="6" dur="1.2s" repeatCount="indefinite" /><animate attributeName="opacity" from="0.6" to="0" dur="1.2s" repeatCount="indefinite" /></circle>}
                    <text x={h.x + 2.5} y={h.y + 1} fill="rgba(230,237,243,0.7)" fontSize="1.6">{i + 1}. {h.node}</text>
                  </g>
                );
              })}
              {adv && (
                <>
                  <defs>
                    <radialGradient id="advFade" cx={`${cur.x}%`} cy={`${cur.y}%`} r="20%">
                      <stop offset="0%" stopColor="rgba(0,0,0,0)" />
                      <stop offset="100%" stopColor="rgba(13,17,23,1)" />
                    </radialGradient>
                  </defs>
                  <rect width="100" height="100" fill="url(#advFade)" opacity="0.5" />
                </>
              )}
            </svg>
            <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-background/80 border border-border rounded px-2 py-0.5">Hop {hop + 1} / {path.length} · {cur.node}</div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Covered</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Partial</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Gap</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Exposure</div>
            <div className="text-3xl font-medium mt-1">{exposure}<span className="text-base text-muted-foreground">%</span></div>
            <div className="text-[10px] text-muted-foreground">of path uncovered or partial</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 space-y-2 text-xs">
            <Row icon={Clock} label="Dwell time" value={`${(path.length * 1.8).toFixed(1)} min`} />
            <Row icon={TrendingUp} label="Peak risk" value={`${Math.max(...path.map((h) => h.risk))}`} />
            <Row icon={Footprints} label="Hops" value={`${path.length}`} />
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" />Gaps to close</div>
            <div className="mt-2 space-y-1">
              {path.filter((h) => h.coverage !== 'covered').map((h) => (
                <div key={h.node} className="text-xs flex justify-between">
                  <span className={h.coverage === 'gap' ? 'text-red-400' : 'text-amber-400'}>{h.node}</span>
                  <span className="text-muted-foreground">{h.risk}</span>
                </div>
              ))}
            </div>
          </div>
          <Button className="w-full" size="sm" variant="outline" onClick={() => navigate(`/project/${projectId}/canvas`)}>
            <Shield className="w-3.5 h-3.5 mr-1" />Harden on canvas
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="w-3 h-3" />{label}</span>
      <span>{value}</span>
    </div>
  );
}
