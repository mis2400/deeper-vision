// Threat Drill Simulator — Scenario Editor
//
// Single-page editor for a scenario. Layout:
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Topbar: scenario meta · readiness chip · save · export       │
//   ├──────────────┬──────────────────────┬─────────────────────────┤
//   │ Left rail    │  Canvas              │  Right rail             │
//   │ tools/zones  │  threat marker,      │  AI assistant +         │
//   │ + protocol   │  safe zones,         │  timeline + gaps        │
//   │ tree         │  device overlay      │                         │
//   └──────────────┴──────────────────────┴─────────────────────────┘
//
// Reads the project's existing devices, walls, and pathways so the
// canvas matches what's been engineered on /project/:id/canvas.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import {
  ShieldAlert, Save, Sparkles, FileDown, Plus, Trash2, Crosshair,
  Play, Pause, Square, SkipForward, AlertTriangle, CheckCircle2,
  MousePointer2, Upload, ChevronRight, X,
} from 'lucide-react';
import { useProjectStore, selectors as storeSelectors } from '../store/projectStore';
import type {
  Scenario, ScenarioZone, ScenarioZoneKind, ProtocolStep, ProtocolSection,
} from '../store/types';
import { toast } from 'sonner';
import { drawScenarioReport } from './ThreatDrillLibrary';

const ZONE_KIND_LABEL: Record<ScenarioZoneKind, string> = {
  'safe-room':              'Safe room',
  'lockdown-zone':          'Lockdown zone',
  'reunification':          'Reunification area',
  'staff-command':          'Staff command',
  'first-responder-staging':'First-responder staging',
  'medical-triage':         'Medical triage',
  'bus-staging':            'Bus staging',
  'classroom':              'Classroom',
  'cafeteria':              'Cafeteria',
  'gym':                    'Gym',
  'restroom':               'Restroom',
  'exterior':               'Exterior area',
};

const ZONE_KIND_TONE: Record<ScenarioZoneKind, string> = {
  'safe-room':               '#2EA66B',
  'lockdown-zone':           '#5292DC',
  'reunification':           '#A78BFA',
  'staff-command':           '#22D3EE',
  'first-responder-staging': '#E5A23A',
  'medical-triage':          '#E55B5B',
  'bus-staging':             '#E5B23A',
  'classroom':               '#7C8EAA',
  'cafeteria':               '#8B9CB8',
  'gym':                     '#9CA8BD',
  'restroom':                '#A6B0C2',
  'exterior':                '#B4BAC9',
};

const PROTOCOL_SECTION_LABEL: Record<ProtocolSection, string> = {
  'lockdown-triggers':      'Lockdown triggers',
  'communication-tree':     'Communication tree',
  'pa-announcements':       'PA announcements',
  'classroom-response':     'Classroom response',
  'common-area-response':   'Common-area response',
  'student-accountability': 'Student accountability',
  'reunification':          'Reunification',
  'all-clear':              'All-clear',
  'after-action':           'After-action review',
};

type Tool = 'select' | 'place-threat' | 'draw-zone' | 'draw-waypoint';

export function ThreatDrillEditor() {
  const { projectId = 'p1', scenarioId = '' } = useParams();
  const nav = useNavigate();
  const sc = useProjectStore((s) => s.scenarios[scenarioId]);
  const projectName = useProjectStore((s) => s.projects[projectId]?.name ?? 'Project');
  const updateScenario = useProjectStore((s) => s.updateScenario);
  const recomputeScenario = useProjectStore((s) => s.recomputeScenario);

  // Read project canvas state for the device overlay + gap analysis.
  // Subscribe to raw maps; derive arrays via useMemo so we don't return
  // fresh array references from the selector (which triggers infinite loops).
  const devicesMap = useProjectStore((s) => s.devices);
  const floorsMap = useProjectStore((s) => s.floors);
  const devices = useMemo(
    () => Object.values(devicesMap).filter((d: any) => d.projectId === projectId) as any[],
    [devicesMap, projectId],
  );
  const firstFloorId = useMemo(() => {
    const list = Object.values(floorsMap).filter((f: any) => f.buildingId?.includes(projectId) || f.projectId === projectId);
    return (list[0] as any)?.id ?? Object.keys(floorsMap)[0] ?? '';
  }, [floorsMap, projectId]);
  const floorWalls = useMemo(() => firstFloorId ? floorsMap[firstFloorId]?.walls ?? [] : [], [floorsMap, firstFloorId]);
  const floorBg = useMemo(() => firstFloorId ? floorsMap[firstFloorId]?.background : undefined, [floorsMap, firstFloorId]);

  const [tool, setTool] = useState<Tool>('select');
  const [zoneKind, setZoneKind] = useState<ScenarioZoneKind>('lockdown-zone');
  const [zoneOccupancy, setZoneOccupancy] = useState(25);
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const surfaceRef = useRef<SVGSVGElement>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(true);
  const [tlPlaying, setTlPlaying] = useState(false);
  const [tlT, setTlT] = useState(0);  // 0..1 timeline scrubber
  const [tlSpeed, setTlSpeed] = useState(1);

  // Live recompute when zones / runs change. Debounced so heavy editing
  // doesn't thrash the store; ok to be slightly stale here.
  useEffect(() => {
    if (!sc) return;
    const t = window.setTimeout(() => recomputeScenario(sc.id), 350);
    return () => window.clearTimeout(t);
  }, [sc?.id, sc?.zones, sc?.runs, sc?.protocol.steps.length]);

  // Timeline playback. Steps t from 0 → 1 over runs.totalDuration seconds.
  useEffect(() => {
    if (!tlPlaying) return;
    const t = window.setInterval(() => {
      setTlT((v) => {
        const next = v + 0.01 * tlSpeed;
        if (next >= 1) { setTlPlaying(false); return 1; }
        return next;
      });
    }, 80);
    return () => window.clearInterval(t);
  }, [tlPlaying, tlSpeed]);

  if (!sc) {
    return (
      <AppShell crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Drill scenario not found' }]} title="Scenario not found">
        <div className="p-10 text-muted-foreground">
          Scenario id <code>{scenarioId}</code> not found.
          <button className="ml-2 text-primary underline" onClick={() => nav(`/project/${projectId}/drill`)}>Back to library</button>
        </div>
      </AppShell>
    );
  }

  // ── Pointer handlers on the canvas SVG
  const coords = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = surfaceRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onSurfacePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = coords(e);
    if (tool === 'place-threat') {
      const startRun = { id: `run-${Date.now().toString(36).slice(-5)}`, label: 'Run 1', start: p, waypoints: [], speedX: 1 };
      updateScenario(sc.id, { runs: [startRun] });
      setTool('select');
      toast.message('Threat marker placed', { description: 'Use Draw waypoint to add path nodes.' });
    } else if (tool === 'draw-waypoint') {
      const run = sc.runs[0];
      if (!run) {
        toast.warning('Place a threat marker first.');
        return;
      }
      const next = { ...run, waypoints: [...run.waypoints, { x: p.x, y: p.y, tSec: (run.waypoints.length + 1) * 6 }] };
      updateScenario(sc.id, { runs: [next] });
    } else if (tool === 'draw-zone') {
      dragStart.current = p;
      setDragRect({ x: p.x, y: p.y, w: 0, h: 0 });
    } else {
      setSelectedZoneId(null);
    }
  };

  const onSurfacePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === 'draw-zone' && dragStart.current) {
      const p = coords(e);
      const start = dragStart.current;
      setDragRect({
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x),
        h: Math.abs(p.y - start.y),
      });
    }
  };

  const onSurfacePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === 'draw-zone' && dragRect) {
      if (dragRect.w >= 24 && dragRect.h >= 24) {
        const z: ScenarioZone = {
          id: `zone-${Date.now().toString(36).slice(-5)}`,
          kind: zoneKind,
          label: `${ZONE_KIND_LABEL[zoneKind]} ${sc.zones.filter((x) => x.kind === zoneKind).length + 1}`,
          rect: dragRect,
          occupancy: ['classroom', 'cafeteria', 'gym'].includes(zoneKind) ? zoneOccupancy : undefined,
        };
        updateScenario(sc.id, { zones: [...sc.zones, z] });
        setSelectedZoneId(z.id);
      }
      dragStart.current = null;
      setDragRect(null);
      setTool('select');
    }
  };

  const handleAddStep = (section: ProtocolSection) => {
    const step: ProtocolStep = {
      id: `step-${Date.now().toString(36).slice(-5)}`,
      section, text: 'New protocol step — edit me.', mappedDeviceIds: [],
    };
    updateScenario(sc.id, { protocol: { ...sc.protocol, steps: [...sc.protocol.steps, step] } });
  };
  const handleUpdateStep = (id: string, patch: Partial<ProtocolStep>) => {
    updateScenario(sc.id, {
      protocol: { ...sc.protocol, steps: sc.protocol.steps.map((s) => s.id === id ? { ...s, ...patch } : s) },
    });
  };
  const handleRemoveStep = (id: string) => {
    updateScenario(sc.id, {
      protocol: { ...sc.protocol, steps: sc.protocol.steps.filter((s) => s.id !== id) },
    });
  };

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? '');
      // Best-effort: split paragraphs, classify each into a section by heuristic.
      const lines = raw.split(/\r?\n+/).map((s) => s.trim()).filter((s) => s.length > 4 && s.length < 600);
      const steps: ProtocolStep[] = lines.slice(0, 40).map((text, i) => {
        const lower = text.toLowerCase();
        let section: ProtocolSection = 'classroom-response';
        if (lower.includes('lockdown') || lower.includes('trigger')) section = 'lockdown-triggers';
        else if (lower.includes('pa') || lower.includes('announc')) section = 'pa-announcements';
        else if (lower.includes('account') || lower.includes('attendance')) section = 'student-accountability';
        else if (lower.includes('reunif')) section = 'reunification';
        else if (lower.includes('all clear') || lower.includes('all-clear')) section = 'all-clear';
        else if (lower.includes('communic') || lower.includes('notify')) section = 'communication-tree';
        else if (lower.includes('after') || lower.includes('debrief')) section = 'after-action';
        return { id: `step-imp-${i}`, section, text, mappedDeviceIds: [] };
      });
      updateScenario(sc.id, {
        protocol: { ...sc.protocol, source: 'uploaded', uploadedFile: { name: file.name, bytes: file.size }, steps },
      });
      toast.success(`Imported ${file.name}`, { description: `${steps.length} steps parsed (heuristic).` });
    };
    reader.onerror = () => toast.error('Could not read file');
    reader.readAsText(file);
  };

  const handleExport = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      drawScenarioReport(doc, sc);
      doc.save(`${projectId}-drill-${sc.id}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Exported drill simulation report');
    } catch (e) { console.error(e); toast.error('Export failed'); }
  };

  // Compute "active threat point" for timeline playback
  const threatPos = useMemo(() => {
    const run = sc.runs[0];
    if (!run) return null;
    if (run.waypoints.length === 0) return run.start;
    const total = run.waypoints.length;
    const idx = Math.min(total, Math.floor(tlT * (total + 1)));
    if (idx === 0) return run.start;
    if (idx > total) return run.waypoints[total - 1];
    return run.waypoints[idx - 1];
  }, [sc.runs, tlT]);

  const score = sc.readinessScore ?? null;
  const scoreTone = score == null ? '#94A3B8' : score >= 80 ? '#2EA66B' : score >= 55 ? '#E5A23A' : '#E5484D';

  return (
    <AppShell
      crumbs={[
        { label: 'Projects', to: '/projects' },
        { label: projectName, to: `/project/${projectId}` },
        { label: 'Drill Simulator', to: `/project/${projectId}/drill` },
        { label: sc.name },
      ]}
      title={sc.name}
      subtitle={`${sc.campus ?? 'No location'} · protocol ${sc.protocol.version} · ${sc.protocol.steps.length} steps`}
      actions={
        <div className="flex items-center gap-2">
          <div className="px-2 h-8 rounded-md border border-border flex items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground uppercase tracking-wider text-[9px]">Readiness</span>
            <span className="tabular-nums font-medium" style={{ color: scoreTone }}>{score == null ? '—' : `${score}/100`}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => { recomputeScenario(sc.id); toast.message('Recomputed gaps + readiness'); }}>
            <Sparkles className="w-3.5 h-3.5 mr-1" />Recompute
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <FileDown className="w-3.5 h-3.5 mr-1" />Export PDF
          </Button>
        </div>
      }
      fullBleed
    >
      <div className="h-full flex flex-col bg-background text-foreground">
        <div className="flex-1 min-h-0 grid grid-cols-[300px_1fr_320px]">
          {/* ── Left rail: tools + zones + protocol ─────────────── */}
          <div className="border-r border-border bg-card overflow-auto">
            <Section title="Canvas tools">
              <ToolRow active={tool === 'select'} onClick={() => setTool('select')} icon={MousePointer2} label="Select" />
              <ToolRow active={tool === 'place-threat'} onClick={() => setTool('place-threat')} icon={Crosshair} label="Place threat marker" />
              <ToolRow active={tool === 'draw-waypoint'} onClick={() => setTool('draw-waypoint')} icon={Plus} label="Draw waypoint" />
              <ToolRow active={tool === 'draw-zone'} onClick={() => setTool('draw-zone')} icon={Plus} label="Draw zone (rectangle)" />
            </Section>

            <Section title="New zone kind">
              <select value={zoneKind} onChange={(e) => setZoneKind(e.target.value as ScenarioZoneKind)} className="dv-input">
                {(Object.keys(ZONE_KIND_LABEL) as ScenarioZoneKind[]).map((k) => (
                  <option key={k} value={k}>{ZONE_KIND_LABEL[k]}</option>
                ))}
              </select>
              {['classroom', 'cafeteria', 'gym'].includes(zoneKind) && (
                <label className="block mt-2 text-[11px] text-muted-foreground">
                  Default occupancy
                  <input type="number" min={0} value={zoneOccupancy} onChange={(e) => setZoneOccupancy(Number(e.target.value))} className="dv-input mt-1" />
                </label>
              )}
              <div className="text-[10px] text-muted-foreground/80 mt-2 leading-snug">
                Click + drag on the canvas to draw the rectangle.
              </div>
            </Section>

            <Section title={`Zones (${sc.zones.length})`}>
              {sc.zones.length === 0
                ? <div className="text-[11px] text-muted-foreground italic px-1">No zones drawn yet.</div>
                : sc.zones.map((z) => (
                  <button
                    key={z.id}
                    onClick={() => setSelectedZoneId(z.id)}
                    className={`w-full text-left text-[11px] px-2 py-1.5 rounded mb-0.5 flex items-center gap-2 ${selectedZoneId === z.id ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}
                  >
                    <span className="w-2 h-2 rounded" style={{ background: ZONE_KIND_TONE[z.kind] }} />
                    <span className="truncate flex-1">{z.label}</span>
                    <Trash2 className="w-3 h-3 opacity-50 hover:opacity-100 hover:text-destructive" onClick={(e) => { e.stopPropagation(); updateScenario(sc.id, { zones: sc.zones.filter((x) => x.id !== z.id) }); }} />
                  </button>
                ))}
            </Section>

            <Section title="Protocol">
              <div className="flex items-center gap-1.5 mb-2">
                <label className="text-[10px] px-2 h-7 rounded border border-border hover:bg-secondary/50 cursor-pointer flex items-center gap-1 text-muted-foreground">
                  <Upload className="w-3 h-3" /> Import (.txt)
                  <input type="file" accept=".txt,.md,.docx,application/pdf,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                </label>
                <span className="text-[10px] text-muted-foreground">{sc.protocol.source}</span>
              </div>
              {(Object.keys(PROTOCOL_SECTION_LABEL) as ProtocolSection[]).map((section) => {
                const steps = sc.protocol.steps.filter((s) => s.section === section);
                return (
                  <div key={section} className="mb-2 border border-border/60 rounded">
                    <div className="px-2 py-1.5 flex items-center bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span className="flex-1 truncate">{PROTOCOL_SECTION_LABEL[section]}</span>
                      <button title="Add step" onClick={() => handleAddStep(section)} className="text-muted-foreground hover:text-foreground">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {steps.map((step) => (
                      <ProtocolStepRow key={step.id} step={step} devices={devices} onChange={(p) => handleUpdateStep(step.id, p)} onRemove={() => handleRemoveStep(step.id)} />
                    ))}
                  </div>
                );
              })}
            </Section>
          </div>

          {/* ── Middle: canvas ─────────────────────────────────────── */}
          <div className="relative bg-canvas-background overflow-hidden">
            <svg
              ref={surfaceRef}
              className="absolute inset-0 w-full h-full select-none"
              style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
              onPointerDown={onSurfacePointerDown}
              onPointerMove={onSurfacePointerMove}
              onPointerUp={onSurfacePointerUp}
            >
              {/* Imported floorplan background, if any */}
              {floorBg && (
                <g
                  transform={`translate(${floorBg.x}, ${floorBg.y}) rotate(${floorBg.rotation}, ${floorBg.naturalWidth * floorBg.scale / 2}, ${floorBg.naturalHeight * floorBg.scale / 2}) scale(${floorBg.scale})`}
                  opacity={floorBg.opacity}
                  pointerEvents="none"
                >
                  <image href={floorBg.dataUrl} x={0} y={0} width={floorBg.naturalWidth} height={floorBg.naturalHeight} />
                </g>
              )}

              {/* Floor walls */}
              {floorWalls.map((w: any) => (
                <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="var(--foreground)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
              ))}

              {/* Zones */}
              {sc.zones.map((z) => {
                const tone = ZONE_KIND_TONE[z.kind];
                const selected = selectedZoneId === z.id;
                return (
                  <g key={z.id}>
                    <rect
                      x={z.rect.x} y={z.rect.y} width={z.rect.w} height={z.rect.h}
                      fill={tone} fillOpacity={selected ? 0.18 : 0.10}
                      stroke={tone} strokeWidth={selected ? 2 : 1.2}
                      strokeDasharray={selected ? '0' : '4 3'}
                      onPointerDown={(e) => { e.stopPropagation(); setSelectedZoneId(z.id); }}
                      style={{ cursor: 'pointer' }}
                    />
                    <g pointerEvents="none">
                      <rect x={z.rect.x + 4} y={z.rect.y + 4} width={Math.max(40, z.label.length * 6.5 + 12)} height={16} rx={2} fill="var(--panel-background)" fillOpacity="0.92" />
                      <text x={z.rect.x + 10} y={z.rect.y + 15} fontSize="10" fontWeight="500" fill="var(--foreground)">
                        {z.label}{z.occupancy ? ` · ${z.occupancy}` : ''}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Drag preview */}
              {dragRect && tool === 'draw-zone' && (
                <rect x={dragRect.x} y={dragRect.y} width={dragRect.w} height={dragRect.h} fill={ZONE_KIND_TONE[zoneKind]} fillOpacity="0.12" stroke={ZONE_KIND_TONE[zoneKind]} strokeDasharray="4 3" />
              )}

              {/* Device overlay — read from project canvas */}
              {devices.map((d: any) => {
                const isCam = d.type?.startsWith('cam.');
                const isDoor = d.type?.startsWith('inf.door') || d.type === 'acc.exit';
                const isSpeaker = d.type === 'aud.speaker' || d.type === 'aud.horn';
                const isIntercom = d.type === 'acc.intercom' || d.type === 'aud.intercom';
                const isIDF = d.type === 'net.idf' || d.type === 'net.switch';
                let tone = '#94A3B8';
                let label = d.type;
                if (isCam) { tone = '#F08F3C'; label = 'cam'; }
                else if (isDoor) { tone = '#9CA3AF'; label = 'door'; }
                else if (isSpeaker) { tone = '#A78BFA'; label = 'PA'; }
                else if (isIntercom) { tone = '#22D3EE'; label = 'icom'; }
                else if (isIDF) { tone = '#E5B23A'; label = 'IDF'; }
                else if (d.type?.startsWith('acc.')) { tone = '#3FB950'; label = 'rdr'; }
                return (
                  <g key={d.id} pointerEvents="none">
                    <circle cx={d.x} cy={d.y} r="7" fill={tone} opacity="0.18" />
                    <circle cx={d.x} cy={d.y} r="4" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.1" />
                  </g>
                );
              })}

              {/* Threat marker + waypoints */}
              {sc.runs[0] && (
                <g pointerEvents="none">
                  <path
                    d={`M ${sc.runs[0].start.x} ${sc.runs[0].start.y} ${sc.runs[0].waypoints.map((w) => `L ${w.x} ${w.y}`).join(' ')}`}
                    fill="none" stroke="#E5484D" strokeWidth="1.6" strokeDasharray="6 4" opacity="0.75"
                  />
                  <g transform={`translate(${sc.runs[0].start.x}, ${sc.runs[0].start.y})`}>
                    <circle r="9" fill="#E5484D" opacity="0.22" />
                    <circle r="4.5" fill="#E5484D" stroke="var(--canvas-background)" strokeWidth="1.2" />
                  </g>
                  {sc.runs[0].waypoints.map((w, i) => (
                    <g key={i} transform={`translate(${w.x}, ${w.y})`}>
                      <circle r="3.5" fill="#E5484D" stroke="var(--canvas-background)" strokeWidth="1" />
                    </g>
                  ))}
                  {threatPos && (
                    <g transform={`translate(${threatPos.x}, ${threatPos.y})`}>
                      <circle r="14" fill="#E5484D" opacity="0.15" />
                      <circle r="7" fill="#E5484D" opacity="0.6" />
                    </g>
                  )}
                </g>
              )}
            </svg>

            {/* Timeline */}
            {sc.runs[0] && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg bg-card/95 border border-border flex items-center gap-2 text-[11px]"
                style={{ backdropFilter: 'blur(8px)' }}
              >
                <button onClick={() => setTlPlaying((p) => !p)} className="p-1 rounded hover:bg-secondary/50 text-foreground" title={tlPlaying ? 'Pause' : 'Play'}>
                  {tlPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setTlT(0)} className="p-1 rounded hover:bg-secondary/50 text-muted-foreground" title="Rewind">
                  <Square className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setTlT((v) => Math.min(1, v + 0.05))} className="p-1 rounded hover:bg-secondary/50 text-muted-foreground" title="Step">
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <input type="range" min={0} max={1} step={0.01} value={tlT} onChange={(e) => setTlT(Number(e.target.value))} className="w-44 accent-primary" />
                <span className="tabular-nums text-muted-foreground">{Math.round(tlT * 100)}%</span>
                <select value={tlSpeed} onChange={(e) => setTlSpeed(Number(e.target.value))} className="dv-input !h-6 !px-1.5 !text-[10px]">
                  <option value={0.5}>0.5×</option>
                  <option value={1}>1×</option>
                  <option value={2}>2×</option>
                  <option value={4}>4×</option>
                </select>
              </div>
            )}
          </div>

          {/* ── Right rail: AI assistant + gaps ───────────────────── */}
          <div className="border-l border-border bg-card overflow-auto">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <div className="text-[12px] font-medium text-foreground tracking-tight">AI assistant</div>
              <span className="ml-auto text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: `${scoreTone}1f`, color: scoreTone }}>{score ?? '—'}/100</span>
            </div>
            <div className="px-3 py-2 text-[11px] text-muted-foreground border-b border-border/60">
              Gap analysis runs against the engineered devices on the project canvas. Add zones + a threat marker, then click <strong className="text-foreground">Recompute</strong>.
            </div>

            {sc.gaps.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-success">
                <CheckCircle2 className="w-5 h-5 text-success mx-auto mb-1.5" />
                No unresolved gaps for this scenario.
              </div>
            ) : (
              sc.gaps.map((g) => (
                <div key={g.id} className="px-3.5 py-2.5 border-b border-border/60">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: g.severity === 'high' ? '#E5484D' : g.severity === 'med' ? '#E5A23A' : '#7CC2FF' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-foreground leading-tight">{g.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{g.detail}</div>
                      {g.suggestion && (
                        <div className="mt-1.5 text-[10px] text-foreground/80 border-l-2 border-primary/40 pl-2 italic leading-snug">
                          {g.suggestion}
                        </div>
                      )}
                      {g.estimatedFixCost && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          Approx. fix · ${g.estimatedFixCost.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="px-4 py-3 border-b border-border/60">
      <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground/80 mb-2">{title}</div>
      {children}
    </div>
  );
}

function ToolRow({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded mb-0.5 flex items-center gap-2 text-[12px] ${active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function ProtocolStepRow({ step, devices, onChange, onRemove }: {
  step: ProtocolStep;
  devices: any[];
  onChange: (p: Partial<ProtocolStep>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(step.text);
  useEffect(() => setText(step.text), [step.text]);
  return (
    <div className="px-2 py-1.5 border-t border-border/60 text-[11px] group">
      {editing ? (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="dv-input text-[11px]" />
          <div className="flex items-center gap-1.5 mt-1">
            <button onClick={() => { onChange({ text }); setEditing(false); }} className="text-[10px] px-2 h-6 rounded bg-primary text-primary-foreground">Save</button>
            <button onClick={() => { setText(step.text); setEditing(false); }} className="text-[10px] px-2 h-6 rounded border border-border text-muted-foreground">Cancel</button>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-1.5">
          <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${step.verified ? 'bg-success' : 'bg-muted-foreground/40'}`} />
          <button onClick={() => setEditing(true)} className="text-left flex-1 text-foreground hover:text-primary">
            {step.text}
            {step.owner && <span className="block text-[10px] text-muted-foreground mt-0.5">Owner · {step.owner}</span>}
          </button>
          <button title={step.verified ? 'Mark unverified' : 'Mark verified'} onClick={() => onChange({ verified: !step.verified })} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
          <button title="Remove" onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
