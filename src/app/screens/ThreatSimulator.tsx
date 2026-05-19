// ThreatSimulator — Phase 2B surface. Mounted at /threat/:projectId.
// V1 2B.1 swaps the prior hardcoded PATHS table for a real engine
// run over the live project state. Every gap is grounded in actual
// placed cameras; every score is computed, not invented.
//
// 2B.2–2B.5 layer animation, scrubber, harden wireup on top of this
// foundation. This pass keeps the layout calm and the data honest.

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Play, Pause, RotateCcw, Shield, Clock, TrendingUp, Footprints, AlertTriangle, Sparkles, SkipBack, SkipForward, FileDown } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { SCENARIOS, runScenario, type ScenarioResult } from '../lib/threatEngine';

export function ThreatSimulator() {
  const navigate = useNavigate();
  const { projectId = 'p1' } = useParams();

  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0].id);
  const [playing, setPlaying] = useState(false);
  // V1 2B.2 + 2B.4 — continuous timeline, 0..1, drives:
  //   - the actor's interpolated position along the path
  //   - the camera FOV lighting (a camera "lights up" when the
  //     actor enters its range)
  //   - the live exposure score count-up
  //   - the scrubber thumb
  const [progress, setProgress] = useState(0);

  // Subscribe to the slices the engine needs. Live re-render when the
  // operator hardens on the canvas in a side tab.
  const state = useProjectStore();
  const result = useMemo(() => runScenario(state, projectId, scenarioId), [state, projectId, scenarioId]);

  const scenarioDef = SCENARIOS.find((s) => s.id === scenarioId);

  // Reset cursor + progress when scenario changes so the visible
  // state stays sane for the new path length.
  useEffect(() => {
    setProgress(0);
    setPlaying(false);
  }, [scenarioId]);

  // V1 2B.2 — requestAnimationFrame loop. Smooth at 60fps; the
  // total scenario plays out across the scenario's totalDwellSec so
  // longer scenarios feel longer without ad-hoc timing per step.
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing || !result) {
      lastTsRef.current = null;
      return;
    }
    // Cap the playback duration so even a 10-hop scenario completes
    // in a reasonable window. Use the scenario's totalDwellSec as
    // the "real" time the path would take, but scale into a playback
    // window of 12s max for the demo loop.
    const realSec = Math.max(4, Math.min(12, result.totalDwellSec / 4));
    const step = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setProgress((p) => {
        const next = p + dt / realSec;
        if (next >= 1) { setPlaying(false); return 1; }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, result]);

  const onTogglePlay = useCallback(() => {
    if (!result) return;
    if (playing) { setPlaying(false); return; }
    if (progress >= 1) setProgress(0);
    setPlaying(true);
  }, [playing, progress, result]);

  // V1 2B.4 — scrubber step controls. Skip forward / back snap to
  // the previous / next hop boundary in normalized time.
  const onStepBack = useCallback(() => {
    if (!result) return;
    setPlaying(false);
    const n = result.hops.length;
    if (n < 2) return;
    const cur = Math.floor(progress * (n - 1) + 0.0001);
    const prev = Math.max(0, cur - 1);
    setProgress(prev / (n - 1));
  }, [progress, result]);
  const onStepFwd = useCallback(() => {
    if (!result) return;
    setPlaying(false);
    const n = result.hops.length;
    if (n < 2) return;
    const cur = Math.floor(progress * (n - 1) + 0.0001);
    const next = Math.min(n - 1, cur + 1);
    setProgress(next / (n - 1));
  }, [progress, result]);

  // V1 2B.8 — captured baseline result for before/after comparison.
  // The operator clicks "Capture baseline" before they harden; the
  // simulator freezes the current ScenarioResult and renders it
  // beside the live one with a delta panel.
  const [baseline, setBaseline] = useState<{ scenarioId: string; result: ScenarioResult; capturedAt: number } | null>(null);
  // Drop the baseline when scenario changes (comparing different
  // scenarios is meaningless; force a re-capture).
  useEffect(() => { setBaseline(null); }, [scenarioId]);

  const onCaptureBaseline = useCallback(() => {
    if (!result) return;
    setBaseline({ scenarioId, result, capturedAt: Date.now() });
  }, [result, scenarioId]);
  const onClearBaseline = useCallback(() => setBaseline(null), []);

  // Live count-up of exposure as the path plays.
  const liveScore = useMemo(() => {
    if (!result) return 0;
    if (progress >= 1) return result.score;
    const n = result.hops.length;
    if (n === 0) return 0;
    const visibleHopCount = Math.min(n, Math.floor(progress * (n - 1) + 1));
    // Sum the exposure of hops we've reached so far against the
    // total possible — same math as runScenario, scoped to elapsed.
    const visible = result.hops.slice(0, visibleHopCount);
    const gained = visible.reduce((acc, h) => acc + h.exposurePoints, 0);
    const totalPossible = result.hops.reduce((acc, _h, i) =>
      acc + Math.round((1 + 1.5 * (i / Math.max(1, n - 1))) * 10), 0);
    return Math.round((gained / Math.max(1, totalPossible)) * 100);
  }, [progress, result]);

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
                <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{s.description}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Entry · {s.entry.label}</div>
              </button>
            );
          })}
        </div>

        {/* Canvas-style scenario view */}
        <div className="bg-card border border-border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{scenarioDef?.name}</div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setProgress(0); setPlaying(false); }} title="Reset to start"><RotateCcw className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={onStepBack} disabled={!result} title="Step back one hop"><SkipBack className="w-3.5 h-3.5" /></Button>
              <Button size="sm" onClick={onTogglePlay} disabled={!result}>
                {playing ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                {playing ? 'Pause' : progress >= 1 ? 'Replay' : 'Play'}
              </Button>
              <Button size="sm" variant="ghost" onClick={onStepFwd} disabled={!result} title="Step forward one hop"><SkipForward className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
          <div className="relative bg-background rounded-md border border-border overflow-hidden" style={{ aspectRatio: '16/9' }}>
            {result ? (
              <ScenarioCanvas result={result} progress={progress} cameras={result.hops.flatMap((h) => h.seenBy)} state={state} projectId={projectId} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[12px] text-muted-foreground">
                No floor available. Add a floor to this project to run scenarios.
              </div>
            )}
            {result && (() => {
              const n = result.hops.length;
              const activeHopIndex = Math.min(n - 1, Math.floor(progress * (n - 1) + 0.0001));
              const activeHop = result.hops[activeHopIndex];
              return (
                <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-background/85 border border-border rounded px-2 py-0.5">
                  Hop {activeHopIndex + 1} / {n} · {activeHop?.label}
                </div>
              );
            })()}
          </div>
          {/* V1 2B.4 — time scrubber. Drags through the scenario at
              the same resolution as the playback engine. Tracks
              cleanly during playback (no fight between user input
              and raf). */}
          {result && (
            <div data-testid="threat-scrubber">
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(progress * 1000)}
                onChange={(e) => {
                  setPlaying(false);
                  setProgress(Number(e.target.value) / 1000);
                }}
                className="w-full accent-primary"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>0:00</span>
                <span>{formatScrubTime(progress, result.totalDwellSec)}</span>
                <span>{formatScrubTime(1, result.totalDwellSec)}</span>
              </div>
            </div>
          )}
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
                <div className={`text-3xl font-medium mt-1 tabular-nums ${severityClass(result.severity)}`}>
                  {liveScore}<span className="text-base text-muted-foreground">%</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {progress < 1 ? (
                    <>Live exposure as the path plays. Final: <span className="font-medium tabular-nums">{result.score}%</span>.</>
                  ) : (
                    <><span className="capitalize">{result.severity}</span> exposure for this scenario.</>
                  )}
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
                  <div className="text-[11px] text-muted-foreground">No factors flagged.</div>
                ) : (
                  result.breakdown.map((b) => (
                    <div key={b.id} className="text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground">{b.label}</span>
                        <span className="text-rose-500 tabular-nums">+{b.contribution}</span>
                      </div>
                      {b.hint && <div className="text-[10px] text-muted-foreground mt-0.5">{b.hint}</div>}
                      {b.harden && (
                        <button
                          onClick={() => {
                            const sp = new URLSearchParams({
                              hint: b.harden!.kind,
                              at: `${Math.round(b.harden!.at.x)},${Math.round(b.harden!.at.y)}`,
                              label: b.harden!.label,
                              fromScenario: scenarioId,
                            });
                            navigate(`/project/${projectId}/canvas?${sp.toString()}`);
                          }}
                          className="mt-1 inline-flex items-center gap-1 h-6 px-1.5 rounded text-[10px] border border-primary/40 bg-primary/10 hover:bg-primary/15 text-primary"
                          data-testid={`threat-harden-${b.harden.kind}`}
                          title={b.harden.label}
                        >
                          <Shield className="w-3 h-3" />Harden on canvas · {b.harden.kind}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          <Button className="w-full" size="sm" variant="outline" onClick={() => navigate(`/project/${projectId}/canvas`)}>
            <Shield className="w-3.5 h-3.5 mr-1" />Harden on canvas
          </Button>
          {/* V1 2B.8 — capture / compare baseline. */}
          {result && !baseline && (
            <Button
              className="w-full"
              size="sm"
              variant="outline"
              onClick={onCaptureBaseline}
              data-testid="threat-capture-baseline"
            >
              <Clock className="w-3.5 h-3.5 mr-1" />Capture baseline
            </Button>
          )}
          {result && baseline && baseline.scenarioId === scenarioId && (
            <BeforeAfter baseline={baseline.result} live={result} onClear={onClearBaseline} />
          )}
          {result && (
            <Button
              className="w-full"
              size="sm"
              variant="outline"
              onClick={() => exportThreatReport(result, scenarioDef!, state, projectId, baseline?.result)}
              data-testid="threat-export-pdf"
            >
              <FileDown className="w-3.5 h-3.5 mr-1" />Print threat report
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// V1 2B.7 — Print threat report PDF. Mirrors the ReportsCenter
// jsPDF pattern: dynamic import, draw cover + sections, save. The
// report is integrator-deliverable — clean copy, project name in
// the footer (white-label slot when portal config ships), no
// fearmongering.
async function exportThreatReport(
  result: ReturnType<typeof runScenario>,
  scenario: ReturnType<typeof SCENARIOS[number]> | undefined,
  state: ReturnType<typeof useProjectStore.getState>,
  projectId: string,
  baseline?: ScenarioResult,
) {
  if (!result || !scenario) return;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, H = 792;
  const project = state.projects[projectId];
  const customer = project?.customerId ? state.customers[project.customerId] : undefined;
  const operatorName = state.currentRole === 'engineer' ? 'Engineer' : state.currentRole;
  const now = new Date();

  // ── Cover ──
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 120, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Threat Simulator Report', 40, 64);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${project?.name ?? 'Project'}${customer ? ` · ${customer.name}` : ''}`, 40, 90);
  doc.text(`${now.toLocaleDateString()} · Prepared by ${operatorName}`, 40, 106);

  let y = 160;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(scenario.name, 40, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  y = writeWrapped(doc, scenario.description, 40, y, W - 80, 13);

  y += 8;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(`Actor: ${scenario.actor}`, 40, y);
  doc.text(`Time of day: ${scenario.time}`, 320, y);
  y += 14;

  // ── Score panel ──
  y += 12;
  doc.setFillColor(248, 250, 252);
  doc.rect(40, y - 4, W - 80, 60, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(...severityRGB(result.severity));
  doc.text(`${result.score}%`, 60, y + 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(75, 85, 99);
  doc.text(`${result.severity.toUpperCase()} exposure`, 160, y + 20);
  doc.text(`${result.hops.filter((h) => h.coverage === 'covered').length} of ${result.hops.length} hops covered`, 160, y + 36);
  doc.text(`Estimated dwell ${(result.totalDwellSec / 60).toFixed(1)} min`, 160, y + 52);
  y += 76;

  // ── Path snapshot ──
  y += 10;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Resolved path', 40, y);
  y += 12;
  drawPathSnapshot(doc, result, 40, y, W - 80, 180);
  y += 200;

  // ── Contributing factors ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Contributing factors', 40, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (result.breakdown.length === 0) {
    doc.setTextColor(75, 85, 99);
    doc.text('No contributing factors flagged.', 40, y);
    y += 14;
  } else {
    for (const b of result.breakdown) {
      if (y > H - 80) { doc.addPage(); y = 60; }
      doc.setTextColor(15, 23, 42);
      doc.text(b.label, 40, y);
      doc.setTextColor(220, 38, 38);
      doc.text(`+${b.contribution}`, W - 80, y, { align: 'right' });
      if (b.hint) {
        y += 12;
        doc.setTextColor(107, 114, 128);
        y = writeWrapped(doc, b.hint, 40, y, W - 80, 12);
      }
      if (b.harden) {
        y += 10;
        doc.setTextColor(37, 99, 235);
        doc.text(`Recommended: ${b.harden.label}`, 40, y);
      }
      y += 18;
    }
  }

  // ── Before / after baseline (optional) ──
  if (baseline) {
    if (y > H - 130) { doc.addPage(); y = 60; }
    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Before / after', 40, y);
    y += 14;
    const delta = result.score - baseline.score;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(75, 85, 99);
    doc.text(`Baseline ${baseline.score}% (${baseline.severity}) → Live ${result.score}% (${result.severity})`, 40, y);
    y += 14;
    const deltaColor: [number, number, number] = delta < 0 ? [16, 185, 129] : delta > 0 ? [239, 68, 68] : [107, 114, 128];
    doc.setTextColor(...deltaColor);
    doc.text(`${delta > 0 ? '+' : ''}${delta} points ${delta < 0 ? '(better)' : delta > 0 ? '(worse)' : '(no change)'}`, 40, y);
    y += 18;
    // List closed gaps.
    const liveHopGaps = new Set(result.breakdown.filter((b) => b.hopIndex !== undefined).map((b) => b.hopIndex));
    const closed = baseline.breakdown.filter((b) => b.hopIndex !== undefined && !liveHopGaps.has(b.hopIndex));
    if (closed.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('Closed by hardening', 40, y); y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      for (const c of closed) {
        if (y > H - 60) { doc.addPage(); y = 60; }
        doc.text(`- ${c.label} (${c.contribution} pts cleared)`, 46, y);
        y += 12;
      }
    }
  }

  // ── Footer ──
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`${project?.name ?? 'DeeperVision'} · Threat Simulator · ${now.toISOString().slice(0, 10)}`, 40, H - 30);

  doc.save(`${projectId}-threat-${scenario.id}-${now.toISOString().slice(0, 10)}.pdf`);
}

function severityRGB(s: 'low' | 'moderate' | 'high' | 'critical'): [number, number, number] {
  switch (s) {
    case 'low':      return [16, 185, 129];
    case 'moderate': return [245, 158, 11];
    case 'high':     return [249, 115, 22];
    case 'critical': return [239, 68, 68];
  }
}

function writeWrapped(doc: any, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const words = text.split(/\s+/);
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (doc.getTextWidth(test) > maxW) {
      doc.text(line, x, y);
      y += lineH;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) { doc.text(line, x, y); y += lineH; }
  return y;
}

function drawPathSnapshot(doc: any, result: ReturnType<typeof runScenario>, x: number, y: number, w: number, h: number) {
  if (!result) return;
  const { hops, floorExtents } = result;
  // Background panel.
  doc.setFillColor(249, 250, 251);
  doc.rect(x, y, w, h, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.rect(x, y, w, h);
  // Map floor extents into the panel rect, preserving aspect.
  const sx = w / floorExtents.w;
  const sy = h / floorExtents.h;
  const s = Math.min(sx, sy);
  const offsetX = x + (w - floorExtents.w * s) / 2;
  const offsetY = y + (h - floorExtents.h * s) / 2;
  const toX = (fx: number) => offsetX + (fx - floorExtents.x) * s;
  const toY = (fy: number) => offsetY + (fy - floorExtents.y) * s;
  // Lines.
  for (let i = 1; i < hops.length; i++) {
    const a = hops[i - 1];
    const b = hops[i];
    const covered = b.coverage === 'covered';
    if (covered) doc.setDrawColor(63, 185, 80);
    else         doc.setDrawColor(248, 81, 73);
    doc.setLineWidth(1.5);
    doc.setLineDashPattern([4, 3], 0);
    doc.line(toX(a.x), toY(a.y), toX(b.x), toY(b.y));
  }
  doc.setLineDashPattern([], 0);
  // Hop markers.
  for (let i = 0; i < hops.length; i++) {
    const hop = hops[i];
    if (hop.coverage === 'covered') doc.setFillColor(63, 185, 80);
    else                            doc.setFillColor(248, 81, 73);
    doc.circle(toX(hop.x), toY(hop.y), 5, 'F');
    doc.setFontSize(8);
    doc.setTextColor(31, 41, 55);
    doc.text(`${i + 1}. ${hop.label}`, toX(hop.x) + 8, toY(hop.y) + 3);
  }
}

// V1 2B.8 — Before / after panel. Shows the captured baseline
// alongside the live result, computes the score delta, and lists
// every gap that was in the baseline but is no longer in the live
// breakdown (those are the gaps the hardening closed).
function BeforeAfter({ baseline, live, onClear }: { baseline: ScenarioResult; live: ScenarioResult; onClear: () => void }) {
  const delta = live.score - baseline.score;
  const baselineGaps = new Set(baseline.breakdown.filter((b) => b.hopIndex !== undefined).map((b) => b.hopIndex));
  const liveGaps     = new Set(live.breakdown.filter((b) => b.hopIndex !== undefined).map((b) => b.hopIndex));
  const closed: typeof baseline.breakdown = baseline.breakdown.filter((b) => b.hopIndex !== undefined && !liveGaps.has(b.hopIndex));
  const newlyOpened: typeof live.breakdown = live.breakdown.filter((b) => b.hopIndex !== undefined && !baselineGaps.has(b.hopIndex));
  const deltaTone = delta < 0 ? 'text-emerald-600' : delta > 0 ? 'text-rose-600' : 'text-muted-foreground';
  return (
    <div className="bg-card border border-border rounded-lg p-3" data-testid="threat-before-after">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Before / After</div>
        <button onClick={onClear} className="text-[10px] text-muted-foreground hover:text-foreground" title="Drop the baseline">Clear</button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Panel label="Baseline" score={baseline.score} severity={baseline.severity} />
        <Panel label="Live" score={live.score} severity={live.severity} />
      </div>
      <div className={`text-[12px] font-medium tabular-nums ${deltaTone}`}>
        {delta === 0 ? 'No change.' : `${delta > 0 ? '+' : ''}${delta} pts ${delta < 0 ? '(better)' : '(worse)'}`}
      </div>
      {closed.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-[0.10em] text-emerald-600/80 mb-1">Closed by hardening</div>
          <ul className="space-y-0.5">
            {closed.map((c) => (
              <li key={c.id} className="text-[11px] text-emerald-700">- {c.label} ({c.contribution} pts cleared)</li>
            ))}
          </ul>
        </div>
      )}
      {newlyOpened.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-[0.10em] text-rose-600/80 mb-1">Newly opened</div>
          <ul className="space-y-0.5">
            {newlyOpened.map((g) => (
              <li key={g.id} className="text-[11px] text-rose-700">- {g.label} (+{g.contribution} pts)</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Panel({ label, score, severity }: { label: string; score: number; severity: ScenarioResult['severity'] }) {
  return (
    <div className="rounded-md border border-border bg-secondary/20 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-[18px] font-medium tabular-nums ${severityClass(severity)}`}>{score}<span className="text-[11px] text-muted-foreground ml-0.5">%</span></div>
    </div>
  );
}

function ScenarioCanvas({ result, progress, state, projectId }: {
  result: ReturnType<typeof runScenario>;
  progress: number;
  cameras: string[];
  state: ReturnType<typeof useProjectStore.getState>;
  projectId: string;
}) {
  if (!result) return null;
  const { hops, floorExtents } = result;
  // V1 2B.2 — continuous actor position. Interpolate between hops
  // based on normalized progress (0..1) so the dot moves smoothly
  // instead of teleporting per hop.
  const n = hops.length;
  const seg = Math.max(0.0001, 1 / Math.max(1, n - 1));
  const idxFloat = progress * (n - 1);
  const fromIdx = Math.floor(idxFloat);
  const toIdx = Math.min(n - 1, fromIdx + 1);
  const t = idxFloat - fromIdx;
  const from = hops[fromIdx] ?? hops[0];
  const to = hops[toIdx] ?? from;
  const actorX = from.x + (to.x - from.x) * t;
  const actorY = from.y + (to.y - from.y) * t;
  // Active hop index for path-tail rendering.
  const activeHopIndex = Math.min(n - 1, Math.floor(progress * (n - 1) + 0.0001));

  // Pull cameras on this floor + compute which are "lighting up" —
  // ie. their range circle contains the live actor position. This
  // is the brief's "cameras and sensors light up as they see the
  // threat" requirement, grounded in real device positions.
  const floorCameras = useMemo(() => {
    return Object.values(state.devices)
      .filter((d) => d.projectId === projectId && d.floorId === result.floorId && (d.type as string).startsWith('cam.'));
  }, [state.devices, projectId, result.floorId]);
  const cameraIsActive = (cam: any): boolean => {
    const dx = cam.x - actorX;
    const dy = cam.y - actorY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Match the engine's range computation. Inline for simplicity.
    const floor = state.floors[cam.floorId];
    const ftPerPx = (floor as any)?.scalePxToFt ? 1 / (floor as any).scalePxToFt : 0.05;
    const rangePx = cam.range ? Math.max(40, cam.range / ftPerPx) : 120;
    return dist <= rangePx;
  };

  return (
    <svg viewBox={`${floorExtents.x} ${floorExtents.y} ${floorExtents.w} ${floorExtents.h}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full">
      {/* Floor backdrop. */}
      <rect x={floorExtents.x} y={floorExtents.y} width={floorExtents.w} height={floorExtents.h} fill="var(--secondary)" opacity="0.4" />
      {/* V1 2B.2 — camera coverage halos. Active cameras pulse + tint
          emerald; inactive ones render as soft dim circles. Real
          positions, real ranges. */}
      {floorCameras.map((cam) => {
        const floor = state.floors[cam.floorId];
        const ftPerPx = (floor as any)?.scalePxToFt ? 1 / (floor as any).scalePxToFt : 0.05;
        const rangePx = cam.range ? Math.max(40, cam.range / ftPerPx) : 120;
        const active = cameraIsActive(cam);
        return (
          <g key={`C${cam.id}`}>
            <circle
              cx={cam.x} cy={cam.y} r={rangePx}
              fill={active ? '#3FB950' : '#6B7280'}
              opacity={active ? 0.16 : 0.06}
              style={{ transition: 'opacity 200ms ease' }}
            />
            <circle
              cx={cam.x} cy={cam.y} r={Math.max(3, floorExtents.w / 200)}
              fill={active ? '#3FB950' : '#94A3B8'}
              stroke="var(--background)" strokeWidth={Math.max(0.5, floorExtents.w / 800)}
            />
          </g>
        );
      })}
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
            opacity={i <= activeHopIndex ? 0.9 : 0.25}
            style={{ transition: 'opacity 200ms ease' }}
          />
        );
      })}
      {/* Hop markers. */}
      {hops.map((h, i) => {
        const tone = h.coverage === 'covered' ? '#3FB950' : '#F85149';
        const visible = i <= activeHopIndex;
        const r = Math.max(6, floorExtents.w / 90);
        return (
          <g key={`H${i}`} opacity={visible ? 1 : 0.3} style={{ transition: 'opacity 200ms ease' }}>
            <circle cx={h.x} cy={h.y} r={r} fill={tone} stroke="var(--background)" strokeWidth={Math.max(1.5, floorExtents.w / 540)} />
            <text x={h.x + r + 4} y={h.y + r / 3} fill="var(--foreground)" fontSize={Math.max(10, floorExtents.w / 70)}>
              {i + 1}. {h.label}
            </text>
          </g>
        );
      })}
      {/* V1 2B.2 — moving actor dot. Interpolated between hops.
          Rose tint signals threat. Pulsing ring telegraphs movement. */}
      {progress < 1 && progress > 0 && (
        <g>
          <circle cx={actorX} cy={actorY} r={Math.max(8, floorExtents.w / 70)} fill="#F85149" opacity="0.18">
            <animate attributeName="r" from={Math.max(8, floorExtents.w / 70)} to={Math.max(16, floorExtents.w / 50)} dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.4" to="0" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx={actorX} cy={actorY} r={Math.max(4, floorExtents.w / 130)} fill="#F85149" stroke="var(--background)" strokeWidth={Math.max(1, floorExtents.w / 720)} />
        </g>
      )}
    </svg>
  );
}

function formatScrubTime(progress: number, totalSec: number): string {
  const sec = Math.max(0, Math.round(progress * totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
