import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Sparkles, ScanLine, AlertTriangle, Check, ArrowRight } from 'lucide-react';

interface Finding { id: string; severity: 'high' | 'med' | 'low'; title: string; detail: string; recommend: string; x: number; y: number; }

const FINDINGS: Finding[] = [
  { id: 'f1', severity: 'high', title: 'Blind spot at NE corner',     detail: 'No camera covers the NE loading bay; FOV gap ~28ft.', recommend: 'Add Axis P1468-LE bullet on column G-7.', x: 78, y: 22 },
  { id: 'f2', severity: 'high', title: 'Egress door fail-secure',     detail: 'DR-2 currently fail-secure but on egress path.',       recommend: 'Switch to Von Duprin 6210 fail-safe strike.',  x: 36, y: 64 },
  { id: 'f3', severity: 'med',  title: 'PoE budget on IDF-C 94%',     detail: 'One additional PoE+ device will exceed budget.',       recommend: 'Re-home CAM-308 to IDF-B (63% used).',         x: 56, y: 40 },
  { id: 'f4', severity: 'med',  title: 'Reader at non-ADA height',    detail: 'RD-12 mounted at 52" — exceeds ADA 48" reach.',         recommend: 'Lower to 46" centerline.',                     x: 22, y: 50 },
  { id: 'f5', severity: 'low',  title: 'Cable run exceeds 90m',       detail: 'Run from CAM-103 to IDF-A is 92m.',                     recommend: 'Re-route via Riser-2 (78m) or add midspan.',   x: 64, y: 18 },
];

export function VisionScan() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(true);
  const [selId, setSelId] = useState(FINDINGS[0].id);
  const [filter, setFilter] = useState<'all' | Finding['severity']>('all');

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
      subtitle="Automated review of coverage, code, power, and pathing"
      actions={<Button size="sm" onClick={run} disabled={running}><Sparkles className="w-3.5 h-3.5 mr-1" />{running ? 'Scanning…' : 'Re-run scan'}</Button>}
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-[1fr_360px] gap-4">
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
    </AppShell>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: dot }} />{label}</span>;
}
