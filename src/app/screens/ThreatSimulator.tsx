// ThreatSimulator — Phase 2B surface. Mounted at /threat/:projectId.
// V1 2B.1 swaps the prior hardcoded PATHS table for a real engine
// run over the live project state. Every gap is grounded in actual
// placed cameras; every score is computed, not invented.
//
// 2B.2–2B.5 layer animation, scrubber, harden wireup on top of this
// foundation. This pass keeps the layout calm and the data honest.

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Play, Pause, RotateCcw, Shield, Clock, TrendingUp, Footprints, AlertTriangle, Sparkles } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { SCENARIOS, runScenario } from '../lib/threatEngine';

export function ThreatSimulator() {
  const navigate = useNavigate();
  const { projectId = 'p1' } = useParams();

  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0].id);
  const [playing, setPlaying] = useState(false);
  const [hopCursor, setHopCursor] = useState(0);

  // Subscribe to the slices the engine needs. Live re-render when the
  // operator hardens on the canvas in a side tab.
  const state = useProjectStore();
  const result = useMemo(() => runScenario(state, projectId, scenarioId), [state, projectId, scenarioId]);

  const scenarioDef = SCENARIOS.find((s) => s.id === scenarioId);

  // Reset cursor when scenario changes so the visible hop stays in
  // bounds for the new path length.
  useMemo(() => { setHopCursor(0); }, [scenarioId]);

  const onTogglePlay = () => {
    if (!result) return;
    if (playing) { setPlaying(false); return; }
    setPlaying(true); setHopCursor(0);
    let i = 0;
    const tick = () => {
      i++;
      if (i >= result.hops.length) { setPlaying(false); return; }
      setHopCursor(i);
      setTimeout(tick, 900);
    };
    setTimeout(tick, 900);
  };

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Canvas', to: `/project/${projectId}/canvas` }, { label: 'Threat simulator' }]}
      title="Threat simulator"
      subtitle="Run scenarios against your current camera coverage. Every gap is grounded in placed devices."
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-[260px_1fr_300px] gap-4">
        {/* Scenario library */}
        <div className="bg-card border border-border rounded-lg p-2 h-fit">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">Scenarios</div>
          {SCENARIOS.map((s) => {
            const active = scenarioId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => { setScenarioId(s.id); setHopCursor(0); setPlaying(false); }}
                className={`w-full text-left px-2.5 py-2 rounded transition-colors ${active ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
                data-testid={`threat-scenario-${s.id}`}
              >
                <div className="text-[13px] font-medium">{s.name}</div>
                <div className="text-[10.5px] text-muted-foreground mt-0.5 line-clamp-2">{s.description}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Entry · {s.entry.label}</div>
              </button>
            );
          })}
        </div>

        {/* Canvas-style scenario view */}
        <div className="bg-card border border-border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{scenarioDef?.name}</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setHopCursor(0); setPlaying(false); }}><RotateCcw className="w-3.5 h-3.5" /></Button>
              <Button size="sm" onClick={onTogglePlay} disabled={!result}>
                {playing ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                {playing ? 'Pause' : 'Replay'}
              </Button>
            </div>
          </div>
          <div className="relative bg-background rounded-md border border-border overflow-hidden" style={{ aspectRatio: '16/9' }}>
            {result ? (
              <ScenarioCanvas result={result} hopCursor={hopCursor} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[12px] text-muted-foreground">
                No floor available. Add a floor to this project to run scenarios.
              </div>
            )}
            {result && (
              <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-background/85 border border-border rounded px-2 py-0.5">
                Hop {Math.min(hopCursor + 1, result.hops.length)} / {result.hops.length} · {result.hops[hopCursor]?.label}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Camera coverage</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" />Gap</span>
            <span className="ml-auto inline-flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-primary" />
              Grounded in {result?.hops.flatMap((h) => h.seenBy).length ?? 0} camera-hop matches.
            </span>
          </div>
        </div>

        {/* Right rail — exposure score + breakdown */}
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-lg p-3" data-testid="threat-score">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Exposure</div>
            {result ? (
              <>
                <div className={`text-3xl font-medium mt-1 ${severityClass(result.severity)}`}>
                  {result.score}<span className="text-base text-muted-foreground">%</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  <span className="capitalize">{result.severity}</span> exposure for this scenario.
                </div>
              </>
            ) : (
              <div className="text-[12px] text-muted-foreground mt-1">No floor in scope.</div>
            )}
          </div>
          {result && (
            <div className="bg-card border border-border rounded-lg p-3 space-y-2 text-xs">
              <Row icon={Clock} label="Estimated dwell" value={`${(result.totalDwellSec / 60).toFixed(1)} min`} />
              <Row icon={TrendingUp} label="Hops covered" value={`${result.hops.filter((h) => h.coverage === 'covered').length} / ${result.hops.length}`} />
              <Row icon={Footprints} label="Path hops" value={`${result.hops.length}`} />
            </div>
          )}
          {result && (
            <div className="bg-card border border-border rounded-lg p-3" data-testid="threat-breakdown">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />Contributing factors
              </div>
              <div className="mt-2 space-y-1.5">
                {result.breakdown.length === 0 ? (
                  <div className="text-[11.5px] text-muted-foreground">No factors flagged.</div>
                ) : (
                  result.breakdown.map((b) => (
                    <div key={b.id} className="text-[11.5px]">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground">{b.label}</span>
                        <span className="text-rose-500 tabular-nums">+{b.contribution}</span>
                      </div>
                      {b.hint && <div className="text-[10.5px] text-muted-foreground mt-0.5">{b.hint}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          <Button className="w-full" size="sm" variant="outline" onClick={() => navigate(`/project/${projectId}/canvas`)}>
            <Shield className="w-3.5 h-3.5 mr-1" />Harden on canvas
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function ScenarioCanvas({ result, hopCursor }: { result: ReturnType<typeof runScenario>; hopCursor: number }) {
  if (!result) return null;
  const { hops, floorExtents } = result;
  // viewBox = floor extents. The whole scenario draws in floor
  // coordinates so it lines up with the canvas if we ever embed it.
  return (
    <svg viewBox={`${floorExtents.x} ${floorExtents.y} ${floorExtents.w} ${floorExtents.h}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full">
      {/* Floor backdrop. */}
      <rect x={floorExtents.x} y={floorExtents.y} width={floorExtents.w} height={floorExtents.h} fill="var(--secondary)" opacity="0.4" />
      {/* Path lines between consecutive hops. Color by destination. */}
      {hops.map((h, i) => {
        if (i === 0) return null;
        const a = hops[i - 1];
        const tone = h.coverage === 'covered' ? '#3FB950' : '#F85149';
        return (
          <line
            key={`L${i}`}
            x1={a.x} y1={a.y} x2={h.x} y2={h.y}
            stroke={tone}
            strokeWidth={Math.max(2, floorExtents.w / 400)}
            strokeDasharray="6 4"
            opacity={i <= hopCursor ? 0.9 : 0.25}
          />
        );
      })}
      {/* Hop markers. */}
      {hops.map((h, i) => {
        const tone = h.coverage === 'covered' ? '#3FB950' : '#F85149';
        const active = i === hopCursor;
        const visible = i <= hopCursor;
        const r = Math.max(6, floorExtents.w / 90);
        return (
          <g key={`H${i}`} opacity={visible ? 1 : 0.3}>
            <circle cx={h.x} cy={h.y} r={active ? r * 1.4 : r} fill={tone} stroke="var(--background)" strokeWidth={Math.max(1.5, floorExtents.w / 540)} />
            <text x={h.x + r + 4} y={h.y + r / 3} fill="var(--foreground)" fontSize={Math.max(10, floorExtents.w / 70)}>
              {i + 1}. {h.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function severityClass(s: 'low' | 'moderate' | 'high' | 'critical'): string {
  switch (s) {
    case 'low':      return 'text-emerald-500';
    case 'moderate': return 'text-amber-500';
    case 'high':     return 'text-orange-500';
    case 'critical': return 'text-rose-500';
  }
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="w-3 h-3" />{label}</span>
      <span>{value}</span>
    </div>
  );
}
