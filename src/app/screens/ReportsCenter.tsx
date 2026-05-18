// ReportsCenter — print-ready proposal package generated from the live
// Deeper Vision canvas. Mounted at /project/:projectId/reports.
//
// The page IS the document. A "Print / Save PDF" button invokes
// `window.print()` after the print stylesheet kicks in: top chrome
// hides, the cards rearrange for paper, and the browser's PDF dialog
// produces the deliverable.
//
// Two visibility modes — Customer-safe (no internal cost detail) and
// Internal (full BOM, labor, pricebook assumptions). Each schedule has
// its own CSV export so the user can hand spreadsheet data to a
// procurement / installer / customer who wants the rows.

import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  useProjectStore, selectors as sel, deriveCanvasBomRows, deriveWorkOrders,
  DOOR_HARDWARE_PRICE, CABLE_UNIT_PRICE,
} from '../store/projectStore';
import { SAMPLE_PRODUCTS as CATALOG } from '../lib/productCatalog';
import { pathwayLengthFt } from '../lib/engineering';
import { SurveyorSymbolBody, SURVEYOR_SYMBOL_IDS } from '../components/canvas/SurveyorSymbols';
import type {
  Floor, Device, Pathway, DoorHardware, WorkOrderStatus,
} from '../store/types';
import { buildLabel, COMMIT_HASH } from '../../build-info';
import {
  FileText, Printer, ArrowLeft, FileDown, ChevronDown, Eye, Lock,
  Building2, Layers, Camera as CameraIcon, KeyRound, Cable, Server,
  ClipboardCheck, AlertTriangle, Paperclip, DollarSign, Hash, MapPin,
  Calendar, Users, PencilRuler, Activity,
} from 'lucide-react';
import { toast } from 'sonner';

const SURVEYOR_SET = new Set<string>(SURVEYOR_SYMBOL_IDS as unknown as string[]);
const PX_PER_FT = 3.83;

type Mode = 'customer' | 'internal';

// ─────────────────────────── Root ─────────────────────────────────

export function ReportsCenter() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();
  const state = useProjectStore();
  const project = state.projects[projectId];
  const customer = project?.customerId ? state.customers[project.customerId] : undefined;

  const floors    = useMemo(() => sel.floorsForProject(state, projectId), [state, projectId]);
  const devices   = useMemo(() => sel.devicesForProject(state, projectId), [state, projectId]);
  const pathways  = useMemo(() => sel.pathwaysForProject(state, projectId), [state, projectId]);
  const idfs      = useMemo(() => sel.idfsForProject(state, projectId), [state, projectId]);
  const bom       = useMemo(() => deriveCanvasBomRows(state, projectId), [state, projectId]);
  const wos       = useMemo(() => deriveWorkOrders(state, projectId), [state, projectId]);
  const pricebook = state.projectPricebooks[projectId];

  const [mode, setMode] = useState<Mode>('internal');
  const isCustomer = mode === 'customer';

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-8" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="max-w-md">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <div className="text-[16px] font-medium mb-1">Project not found</div>
          <div className="text-[12px] text-muted-foreground mb-4">No project matches <span className="font-mono text-foreground">{projectId}</span>.</div>
          <button onClick={() => nav('/projects')} className="text-[11px] px-3 h-8 rounded-md border border-border hover:bg-secondary/50">Back to projects</button>
        </div>
      </div>
    );
  }

  // Bucket devices for the schedules.
  const cameras = devices.filter((d) => String(d.type).startsWith('cam'));
  const accessDevices = devices.filter((d) => {
    const t = String(d.type);
    return t.startsWith('acc') || t.startsWith('aud.intercom');
  });
  const doorOpenings = devices.filter((d) => {
    const t = String(d.type);
    return t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor');
  });
  const legacyDoors = Object.values(state.doors).filter((d) => d.projectId === projectId);

  // Warnings: pricing gaps, door hardware sanity, calibration gaps.
  const warnings = computeWarnings({ bom, doorOpenings, legacyDoors, floors, devices });

  // Override count (drives pricing-assumptions section).
  const overrideCount =
    (Object.keys(pricebook?.doorHardware ?? {}).length) +
    (Object.keys(pricebook?.cablePerFt ?? {}).length) +
    (pricebook?.laborRate != null ? 1 : 0) +
    (pricebook?.markup != null ? 1 : 0);
  const hasOverrides = overrideCount > 0;

  // Deployment summary.
  const woTallies = useMemo(() => {
    const t = { total: wos.length, complete: 0, blocked: 0, open: 0, hours: 0 };
    for (const w of wos) {
      if (w.progress.status === 'complete') t.complete++;
      else if (w.progress.status === 'blocked') t.blocked++;
      else t.open++;
      if (w.progress.status !== 'complete') t.hours += w.estLaborHours;
    }
    return t;
  }, [wos]);

  const onPrint = () => {
    toast.message('Opening browser print dialog', { description: 'Pick "Save as PDF" for a file or send to a printer.', duration: 3000 });
    setTimeout(() => window.print(), 200);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }} data-screen="reports-center">
      <PrintStyles />

      {/* Sticky control bar — print-hidden */}
      <div className="reports-chrome shrink-0 border-b border-border bg-background/90 backdrop-blur-md flex items-center gap-3 px-4 py-2.5 sticky top-0 z-20">
        <button
          onClick={() => nav(`/project/${projectId}/canvas`)}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11.5px] border border-border hover:bg-secondary/40 text-foreground"
          data-track="reports-back-canvas"
        >
          <ArrowLeft className="w-3.5 h-3.5" />Engineering Canvas
        </button>
        <div className="flex flex-col leading-tight ml-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Deeper Vision · Reports</span>
          <span className="text-[13px] font-semibold tracking-tight text-foreground">{project.name}</span>
        </div>

        <div className="flex-1" />

        {/* Mode toggle */}
        <div className="flex items-center h-8 rounded-md border border-border bg-secondary/30 text-[11px] overflow-hidden">
          {(['internal', 'customer'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`inline-flex items-center gap-1.5 px-2.5 h-full transition-colors ${mode === m ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'}`}
              data-track={`reports-mode-${m}`}
              title={m === 'customer' ? 'Hides internal cost detail + pricing assumptions' : 'Shows BOM totals, labor hours, pricing assumptions'}
            >
              {m === 'customer' ? <Eye className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {m === 'customer' ? 'Customer view' : 'Internal view'}
            </button>
          ))}
        </div>

        <Link
          to={`/project/${projectId}/review`}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11.5px] border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-500 transition-colors"
        >
          <PencilRuler className="w-3.5 h-3.5" />Review mode
        </Link>
        <button
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11.5px] border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          data-track="reports-print"
        >
          <Printer className="w-3.5 h-3.5" />Print / Save PDF
        </button>
      </div>

      {/* Report body — printable */}
      <div className="reports-body mx-auto" style={{ maxWidth: 980, padding: '32px 28px 64px' }}>
        <CoverHeader project={project} customer={customer} mode={mode} />

        <ExecutiveSummary
          counts={{
            cameras: cameras.length,
            access:  accessDevices.length,
            doors:   doorOpenings.length + legacyDoors.length,
            pathways: pathways.length,
            idfs:    idfs.length,
            floors:  floors.length,
          }}
          bom={bom}
          wos={woTallies}
          mode={mode}
          hasOverrides={hasOverrides}
          overrideCount={overrideCount}
        />

        <FloorSummary floors={floors} devices={devices} pathways={pathways} />

        {floors.map((f) => (
          <PlanPreview key={f.id} floor={f} devices={devices.filter((d) => d.floorId === f.id)} pathways={pathways.filter((p) => p.floorId === f.id)} />
        ))}

        <CameraSchedule cameras={cameras} floors={floors} projectName={project.name} />

        <DoorSchedule doorOpenings={doorOpenings} legacyDoors={legacyDoors} floors={floors} projectName={project.name} />

        <PathwaySchedule pathways={pathways} floors={floors} projectName={project.name} />

        {!isCustomer && (
          <BomSummary bom={bom} hasOverrides={hasOverrides} overrideCount={overrideCount} pricebook={pricebook} projectName={project.name} />
        )}

        <DeploymentSummary wos={wos} tallies={woTallies} />

        {!isCustomer && hasOverrides && (
          <PricingAssumptions pricebook={pricebook} />
        )}

        <Warnings warnings={warnings} mode={mode} />

        <AssumptionsExclusions />

        <Attachments />

        <ReportFooter project={project} mode={mode} />
      </div>
    </div>
  );
}

// ─────────────────────────── Header / cover ───────────────────────

function CoverHeader({ project, customer, mode }: { project: any; customer?: any; mode: Mode }) {
  const now = new Date();
  const stamp = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <section className="report-section report-cover rounded-xl border border-border p-6 mb-6 bg-secondary/15">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #22D3EE, #A371F7)', color: '#0B0F17' }}>
          <PencilRuler className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Deeper Vision · Proposal package</div>
          <div className="text-[28px] font-semibold tracking-tight text-foreground mt-0.5 leading-tight">{project.name}</div>
          {customer && (
            <div className="text-[13px] text-muted-foreground mt-1">{customer.name}</div>
          )}
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          <ModeBadge mode={mode} />
          <div className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-1.5 justify-end">
            <Calendar className="w-3 h-3" />{stamp}
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums">
            Ref · {project.id}
          </div>
        </div>
      </div>
    </section>
  );
}

function ModeBadge({ mode }: { mode: Mode }) {
  const meta = mode === 'customer'
    ? { label: 'Customer view', tone: '#22D3EE', icon: Eye }
    : { label: 'Internal view', tone: '#F59E0B', icon: Lock };
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[10.5px] border"
      style={{ color: meta.tone, borderColor: `${meta.tone}55`, background: `${meta.tone}14` }}>
      <Icon className="w-3 h-3" />{meta.label}
    </span>
  );
}

// ─────────────────────────── Executive summary ────────────────────

function ExecutiveSummary({ counts, bom, wos, mode, hasOverrides, overrideCount }: {
  counts: { cameras: number; access: number; doors: number; pathways: number; idfs: number; floors: number };
  bom: ReturnType<typeof deriveCanvasBomRows>;
  wos: { total: number; complete: number; blocked: number; open: number; hours: number };
  mode: Mode;
  hasOverrides: boolean;
  overrideCount: number;
}) {
  const isCustomer = mode === 'customer';
  return (
    <Section title="Executive summary" icon={ClipboardCheck} subtitle="At-a-glance scope and project status, derived live from the canvas.">
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Cameras"  value={counts.cameras}  icon={CameraIcon} tone="#22D3EE" />
        <Tile label="Doors"    value={counts.doors}    icon={KeyRound}   tone="#A371F7" />
        <Tile label="Pathways" value={counts.pathways} icon={Cable}      tone="#7CC4FF" />
        <Tile label="Access devices" value={counts.access} icon={Activity} tone="#F472B6" />
        <Tile label="IDF racks" value={counts.idfs}      icon={Server}    tone="#10B981" />
        <Tile label="Floors"    value={counts.floors}    icon={Building2} tone="#94A3B8" />
      </div>

      {!isCustomer && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Tile
            label={`Sell total · ${(bom.totals.markup * 100).toFixed(0)}% markup`}
            value={'$' + Math.round(bom.totals.sellTotal).toLocaleString()}
            icon={DollarSign} tone="#10B981"
            subline={hasOverrides ? `${overrideCount} pricebook override${overrideCount === 1 ? '' : 's'} active` : 'Preview pricing'}
          />
          <Tile
            label="Field deployment"
            value={`${wos.complete}/${wos.total} complete`}
            icon={ClipboardCheck} tone="#22D3EE"
            subline={`${wos.open} open · ${wos.blocked} blocked · ${Math.round(wos.hours * 10) / 10} hr remaining`}
          />
        </div>
      )}

      {isCustomer && (
        <div className="rounded-lg p-3 mt-3 border border-dashed border-border bg-secondary/10 text-[11.5px] text-muted-foreground">
          Cost detail is hidden in customer view. Flip the view toggle to Internal to surface BOM totals + pricing assumptions.
        </div>
      )}
    </Section>
  );
}

function Tile({ label, value, icon: Icon, tone, subline }: {
  label: string; value: string | number; icon: any; tone: string; subline?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/10 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <span className="w-5 h-5 rounded inline-flex items-center justify-center" style={{ background: `${tone}1A`, color: tone }}>
          <Icon className="w-3 h-3" />
        </span>
      </div>
      <div className="text-[20px] font-medium tabular-nums leading-none">{value}</div>
      {subline && <div className="text-[10.5px] text-muted-foreground mt-1 leading-snug">{subline}</div>}
    </div>
  );
}

// ─────────────────────────── Floor summary ────────────────────────

function FloorSummary({ floors, devices, pathways }: { floors: Floor[]; devices: Device[]; pathways: Pathway[] }) {
  if (floors.length === 0) {
    return (
      <Section title="Site &amp; floors" icon={Building2}>
        <Empty text="No floor plans uploaded yet." />
      </Section>
    );
  }
  return (
    <Section title="Site &amp; floors" icon={Building2} subtitle="Floor list with calibration status and scope per floor.">
      <ScheduleTable
        headers={['Floor', 'Level', 'Source', 'Scale', 'Calibrated', 'Devices', 'Pathways']}
        rows={floors.map((f) => {
          const dCount = devices.filter((d) => d.floorId === f.id).length;
          const pCount = pathways.filter((p) => p.floorId === f.id).length;
          return [
            f.name,
            `L${f.level}`,
            f.source,
            `1 px = ${f.scalePxToFt.toFixed(3)} ft`,
            f.calibratedAt ? <Chip key="cal" tone="#10B981" text="Verified" /> : <Chip key="cal" tone="#F59E0B" text="Default" />,
            String(dCount),
            String(pCount),
          ];
        })}
      />
    </Section>
  );
}

// ─────────────────────────── Plan preview ─────────────────────────

function PlanPreview({ floor, devices, pathways }: { floor: Floor; devices: Device[]; pathways: Pathway[] }) {
  // Bounding box around content so the preview frames nicely.
  const W = 924, H = 520;
  const padding = 24;
  const xs: number[] = [], ys: number[] = [];
  for (const d of devices) { xs.push(d.x); ys.push(d.y); }
  for (const w of floor.walls ?? []) { xs.push(w.x1, w.x2); ys.push(w.y1, w.y2); }
  for (const p of pathways) for (const pt of (p.points as any[] ?? [])) { xs.push(pt.x); ys.push(pt.y); }
  if (floor.background) {
    const bg = floor.background;
    xs.push(bg.x, bg.x + bg.naturalWidth * bg.scale);
    ys.push(bg.y, bg.y + bg.naturalHeight * bg.scale);
  }
  if (xs.length === 0) { xs.push(0, 800); ys.push(0, 500); }
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cw = Math.max(1, maxX - minX);
  const ch = Math.max(1, maxY - minY);
  const z = Math.min(2.5, (W - padding * 2) / cw, (H - padding * 2) / ch);
  const tx = padding - minX * z + (W - padding * 2 - cw * z) / 2;
  const ty = padding - minY * z + (H - padding * 2 - ch * z) / 2;

  return (
    <Section title={`Plan preview · ${floor.name}`} icon={MapPin}
      subtitle="Schematic generated from canvas data. Cone overlays + grid omitted; see Engineering Canvas for full coverage analysis.">
      <div className="rounded-lg border border-border overflow-hidden bg-white">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
          <defs>
            <pattern id={`rep-grid-${floor.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#rep-grid-${floor.id})`} />
          <g transform={`translate(${tx}, ${ty}) scale(${z})`}>
            {floor.background && (
              <g transform={`translate(${floor.background.x}, ${floor.background.y}) rotate(${floor.background.rotation}) scale(${floor.background.scale})`} opacity={floor.background.opacity * 0.85}>
                <image href={floor.background.dataUrl} width={floor.background.naturalWidth} height={floor.background.naturalHeight} preserveAspectRatio="none" />
              </g>
            )}
            {(floor.walls ?? []).map((w) => (
              <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#475569" strokeWidth={2 / Math.max(z, 0.5)} strokeLinecap="round" opacity={0.95} />
            ))}
            {pathways.map((p) => {
              const pts = (p.points ?? []) as { x: number; y: number }[];
              if (pts.length < 2) return null;
              const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
              return <path key={p.id} d={d} fill="none" stroke="#7CC4FF" strokeWidth={1.5 / Math.max(z, 0.5)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 6" opacity={0.85} />;
            })}
            {devices.map((d) => {
              const tone = deviceTone(d.type);
              const hasSymbol = SURVEYOR_SET.has(d.type);
              return (
                <g key={d.id} transform={`translate(${d.x}, ${d.y})`}>
                  <circle r={12} fill="#ffffff" stroke={tone} strokeWidth={1.4} />
                  <g transform={`rotate(${d.rot})`} style={{ color: tone }}>
                    {hasSymbol
                      ? <SurveyorSymbolBody id={d.type} scale={0.78} stroke={1.3} />
                      : <text textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={600} fill={tone}>{(d.type.split('.')[1] || '?').slice(0, 3).toUpperCase()}</text>
                    }
                  </g>
                  <text y={22} textAnchor="middle" fontSize={8} fill="#0F172A">{d.id}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="text-[10px] text-muted-foreground mt-1.5 px-1">
        {devices.length} device{devices.length === 1 ? '' : 's'} · {pathways.length} pathway run{pathways.length === 1 ? '' : 's'} · scale {floor.calibratedAt ? 'verified' : 'default'}.
      </div>
    </Section>
  );
}

function deviceTone(t: string): string {
  if (t.startsWith('cam')) return '#22D3EE';
  if (t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor') || t.startsWith('acc')) return '#A371F7';
  if (t.startsWith('net') || t.startsWith('pwr') || t.startsWith('sto')) return '#10B981';
  if (t.startsWith('sen')) return '#F472B6';
  if (t.startsWith('aud')) return '#FB7185';
  return '#94A3B8';
}

// ─────────────────────────── Camera schedule ──────────────────────

function CameraSchedule({ cameras, floors, projectName }: { cameras: Device[]; floors: Floor[]; projectName: string }) {
  const rows: (string | number | React.ReactNode)[][] = cameras.map((d) => {
    const product = CATALOG.find((p) => p.id === d.product);
    const defaultRangeFt = d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30;
    const defaultFovDeg  = d.type === 'cam.ptz' ? 36 : d.type === 'cam.fisheye' ? 360 : 70;
    const rangeFt = d.range ?? defaultRangeFt;
    const fovDeg  = d.fov ?? defaultFovDeg;
    const floor = floors.find((f) => f.id === d.floorId);
    const coverage = d.type === 'cam.fisheye' ? `${rangeFt} ft omni` : `${fovDeg}° × ${rangeFt} ft`;
    return [
      d.id,
      shortKind(d.type),
      product ? `${product.manufacturer} · ${product.model}` : '—',
      floor?.name ?? '—',
      coverage,
      d.mountFt != null ? `${d.mountFt} ft` : '—',
      d.ir ? 'Yes' : '—',
    ];
  });
  return (
    <Section title="Camera schedule" icon={CameraIcon}
      subtitle="One row per camera placed on the canvas. Coverage cells derive from per-camera FOV + range."
      action={cameras.length > 0 ? <CsvButton filename={`${slug(projectName)}-cameras.csv`} headers={['ID', 'Type', 'Model', 'Floor', 'Coverage', 'Mount', 'IR']} rows={rows} /> : undefined}
    >
      {cameras.length === 0
        ? <Empty text="No cameras placed yet." />
        : <ScheduleTable
            headers={['ID', 'Type', 'Model', 'Floor', 'Coverage', 'Mount', 'IR']}
            rows={rows}
          />
      }
    </Section>
  );
}

// ─────────────────────────── Door schedule ────────────────────────

function DoorSchedule({ doorOpenings, legacyDoors, floors, projectName }: {
  doorOpenings: Device[]; legacyDoors: any[]; floors: Floor[]; projectName: string;
}) {
  const records = useMemo(() => {
    const out: { id: string; type: string; floorName: string; assembly: DoorHardware[]; states: Partial<Record<DoorHardware, 'proposed' | 'existing'>>; electrification?: string; readerLoc?: string }[] = [];
    for (const d of doorOpenings) {
      const floor = floors.find((f) => f.id === d.floorId);
      out.push({
        id: d.id,
        type: shortKind(d.type),
        floorName: floor?.name ?? '—',
        assembly: (d.doorAssembly ?? []) as DoorHardware[],
        states: (d.doorAssemblyState ?? {}) as any,
        electrification: d.doorElectrification,
        readerLoc: d.doorReaderLocation,
      });
    }
    for (const door of legacyDoors) {
      const floor = floors.find((f) => f.id === door.floorId);
      out.push({
        id: door.id,
        type: 'Legacy door',
        floorName: floor?.name ?? '—',
        assembly: (door.hardware ?? []) as DoorHardware[],
        states: {} as any,
      });
    }
    return out;
  }, [doorOpenings, legacyDoors, floors]);

  const csvRows: (string | number)[][] = [];
  for (const r of records) {
    if (r.assembly.length === 0) {
      csvRows.push([r.id, r.type, r.floorName, '—', '—', '—', '—']);
    } else {
      for (const hw of r.assembly) {
        const isExisting = r.states[hw] === 'existing';
        csvRows.push([r.id, r.type, r.floorName, hw, DOOR_HARDWARE_PRICE[hw]?.desc ?? hw, isExisting ? 'Existing' : 'Proposed', r.electrification ?? '—']);
      }
    }
  }

  return (
    <Section title="Door hardware schedule" icon={KeyRound}
      subtitle="One row per opening. Each hardware item carries Proposed / Existing state from the canvas."
      action={records.length > 0 ? <CsvButton filename={`${slug(projectName)}-doors.csv`} headers={['Opening', 'Type', 'Floor', 'HW class', 'Description', 'Status', 'Electrification']} rows={csvRows} /> : undefined}
    >
      {records.length === 0
        ? <Empty text="No doors / openings configured yet." />
        : <div className="space-y-3">
            {records.map((r) => <DoorCard key={r.id} record={r} />)}
          </div>
      }
    </Section>
  );
}

function DoorCard({ record }: { record: { id: string; type: string; floorName: string; assembly: DoorHardware[]; states: Partial<Record<DoorHardware, 'proposed' | 'existing'>>; electrification?: string; readerLoc?: string } }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-secondary/10">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded inline-flex items-center justify-center" style={{ background: '#A371F71F', color: '#A371F7' }}><KeyRound className="w-3 h-3" /></span>
          <div className="text-[12.5px] font-medium text-foreground">{record.id}</div>
          <div className="text-[10.5px] text-muted-foreground">{record.type} · {record.floorName}</div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {record.electrification && <Chip tone="#94A3B8" text={record.electrification} />}
          {record.readerLoc && <Chip tone="#94A3B8" text={`Reader · ${record.readerLoc}`} />}
        </div>
      </div>
      {record.assembly.length === 0
        ? <div className="text-[11px] text-muted-foreground px-3 py-3">No hardware specified for this opening.</div>
        : <table className="w-full text-[12px]">
            <thead className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground bg-secondary/20">
              <tr>
                <th className="text-left px-3 py-1.5">Class</th>
                <th className="text-left px-3 py-1.5">Description</th>
                <th className="text-right px-3 py-1.5 w-[120px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {record.assembly.map((hw, i) => {
                const isExisting = record.states[hw] === 'existing';
                return (
                  <tr key={hw} className={i % 2 === 0 ? '' : 'bg-secondary/8'}>
                    <td className="px-3 py-1.5 text-foreground/90 font-mono text-[11px]">{hw}</td>
                    <td className="px-3 py-1.5 text-foreground/90">{DOOR_HARDWARE_PRICE[hw]?.desc ?? hw}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Chip tone={isExisting ? '#F59E0B' : '#10B981'} text={isExisting ? 'Existing' : 'Proposed'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      }
    </div>
  );
}

// ─────────────────────────── Pathway schedule ─────────────────────

function PathwaySchedule({ pathways, floors, projectName }: { pathways: Pathway[]; floors: Floor[]; projectName: string }) {
  const rows: (string | number)[][] = pathways.map((p) => {
    const floor = floors.find((f) => f.id === p.floorId);
    const ft = pathwayLengthFt(p, floor);
    return [
      p.id,
      (p.cableType ?? 'cat6a').toUpperCase(),
      String(p.cableCount),
      `${ft} ft`,
      p.pathwayKind ?? 'cable',
      p.conduitSize ?? '—',
      p.bundleId ?? '—',
    ];
  });
  return (
    <Section title="Cabling &amp; pathway schedule" icon={Cable}
      subtitle="One row per cable run. Lengths use the per-floor calibrated scale."
      action={pathways.length > 0 ? <CsvButton filename={`${slug(projectName)}-pathways.csv`} headers={['Run', 'Cable', 'Conductors', 'Length', 'Kind', 'Conduit', 'Bundle']} rows={rows} /> : undefined}
    >
      {pathways.length === 0
        ? <Empty text="No pathways drawn yet." />
        : <ScheduleTable
            headers={['Run', 'Cable', 'Conductors', 'Length', 'Kind', 'Conduit', 'Bundle']}
            rows={rows}
          />
      }
    </Section>
  );
}

// ─────────────────────────── BOM summary (internal) ──────────────

function BomSummary({ bom, hasOverrides, overrideCount, pricebook, projectName }: {
  bom: ReturnType<typeof deriveCanvasBomRows>;
  hasOverrides: boolean;
  overrideCount: number;
  pricebook: any;
  projectName: string;
}) {
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString();
  // Build a category-grouped summary.
  const byCat: Record<string, { qty: number; proposed: number; existing: number; cable: number }> = {};
  for (const r of bom.rows) {
    const c = byCat[r.category] ?? { qty: 0, proposed: 0, existing: 0, cable: 0 };
    const lt = r.unitPrice * r.qty;
    if (r.sourceKind === 'pathway')      c.cable    += lt;
    else if (r.isExisting)                c.existing += lt;
    else                                  c.proposed += lt;
    c.qty += r.qty;
    byCat[r.category] = c;
  }
  const LABEL: Record<string, string> = { cameras: 'Cameras', access: 'Access control', network: 'Network & power', cabling: 'Cable & pathways', labor: 'Labor', other: 'Equipment' };

  const csvRows: (string | number)[][] = bom.rows.map((r) => [
    r.category,
    r.meta ?? r.sourceId ?? '',
    r.description,
    r.product ?? '',
    r.isExisting ? 'Existing' : 'Proposed',
    r.overridden ? 'Yes' : '',
    r.qty,
    r.uom,
    r.unitPrice.toFixed(2),
    (r.unitPrice * r.qty).toFixed(2),
    r.laborHours.toFixed(2),
  ]);

  return (
    <Section title="BOM &amp; estimate summary" icon={DollarSign}
      subtitle="Internal-only view. Totals reflect pricebook overrides if any are set."
      action={<CsvButton filename={`${slug(projectName)}-bom.csv`} headers={['Category', 'Source', 'Description', 'Product', 'Status', 'Overridden', 'Qty', 'UOM', 'Unit price', 'Line total', 'Labor hrs']} rows={csvRows} />}
    >
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Proposed material" value={fmt(bom.totals.proposedMaterial)} icon={DollarSign} tone="#10B981" />
        <Tile label="Cable" value={fmt(bom.totals.cable)} icon={Cable} tone="#7CC4FF" />
        <Tile label="Labor" value={`${bom.totals.laborHours.toFixed(1)} hr · ${fmt(bom.totals.laborTotal)}`} icon={ClipboardCheck} tone="#22D3EE" />
        <Tile label="Existing documented" value={fmt(bom.totals.existingDocumented)} icon={KeyRound} tone="#94A3B8" subline="Excluded from proposed total" />
      </div>
      <div className="rounded-lg border border-border bg-secondary/15 p-3 mt-3 flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Sell total · {(bom.totals.markup * 100).toFixed(0)}% markup</div>
          <div className="text-[22px] font-medium tabular-nums leading-tight">{fmt(bom.totals.sellTotal)}</div>
        </div>
        <div className="text-[10.5px] text-right" style={{ color: hasOverrides ? '#22D3EE' : undefined }}>
          {hasOverrides
            ? <><span className="font-medium">Project pricebook overrides active</span><br /><span className="text-muted-foreground">{overrideCount} override{overrideCount === 1 ? '' : 's'} · not connected to ERP yet.</span></>
            : <span className="text-muted-foreground">Preview pricing. No pricebook overrides on file.</span>
          }
        </div>
      </div>
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">By category</div>
        <ScheduleTable
          headers={['Category', 'Lines', 'Proposed', 'Existing', 'Cable']}
          rows={Object.entries(byCat).map(([cat, v]) => [
            LABEL[cat] ?? cat,
            String(bom.rows.filter((r) => r.category === cat).length),
            fmt(v.proposed),
            v.existing > 0 ? fmt(v.existing) : '—',
            v.cable > 0 ? fmt(v.cable) : '—',
          ])}
        />
      </div>
      {bom.totals.missingPriceCount > 0 && (
        <div className="rounded-md border border-amber-400/40 bg-amber-400/10 text-[11px] text-amber-500 p-2.5 mt-3 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span><strong>{bom.totals.missingPriceCount}</strong> BOM line{bom.totals.missingPriceCount === 1 ? '' : 's'} missing a price. Add a pricebook override or seed catalog data before quoting.</span>
        </div>
      )}
    </Section>
  );
}

// ─────────────────────────── Deployment summary ───────────────────

function DeploymentSummary({ wos, tallies }: { wos: ReturnType<typeof deriveWorkOrders>; tallies: any }) {
  const grouped: Record<string, { total: number; complete: number; blocked: number; hours: number }> = {};
  for (const w of wos) {
    const g = grouped[w.kind] ?? { total: 0, complete: 0, blocked: 0, hours: 0 };
    g.total += 1;
    if (w.progress.status === 'complete') g.complete += 1;
    else if (w.progress.status === 'blocked') g.blocked += 1;
    if (w.progress.status !== 'complete') g.hours += w.estLaborHours;
    grouped[w.kind] = g;
  }
  const pct = tallies.total === 0 ? 0 : Math.round((tallies.complete / tallies.total) * 100);
  const KIND_LABEL: Record<string, string> = { camera: 'Cameras', door: 'Doors', pathway: 'Pathways', idf: 'IDF / racks' };
  return (
    <Section title="Field deployment summary" icon={ClipboardCheck}
      subtitle="Live work-order progress. Pulled from the deployment view; status / checklist persists across reloads.">
      <div className="rounded-lg border border-border bg-secondary/10 p-3 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Project install</div>
          <div className="text-[12px] tabular-nums">{pct}%</div>
        </div>
        <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10B981, #22D3EE)' }} />
        </div>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
          <Chip tone="#10B981" text={`${tallies.complete} complete`} />
          <Chip tone="#94A3B8" text={`${tallies.open} open`} />
          {tallies.blocked > 0 && <Chip tone="#EF4444" text={`${tallies.blocked} blocked`} />}
          <span className="ml-auto">{Math.round(tallies.hours * 10) / 10} hr remaining</span>
        </div>
      </div>
      <ScheduleTable
        headers={['Kind', 'Total', 'Complete', 'Blocked', 'Open', 'Hours remaining']}
        rows={Object.entries(grouped).map(([k, v]) => [
          KIND_LABEL[k] ?? k,
          String(v.total),
          String(v.complete),
          v.blocked > 0 ? <Chip key="b" tone="#EF4444" text={String(v.blocked)} /> : '0',
          String(v.total - v.complete - v.blocked),
          `${Math.round(v.hours * 10) / 10} hr`,
        ])}
      />
    </Section>
  );
}

// ─────────────────────────── Pricing assumptions ──────────────────

function PricingAssumptions({ pricebook }: { pricebook: any }) {
  const doorEntries = Object.entries(pricebook?.doorHardware ?? {}) as [DoorHardware, any][];
  const cableEntries = Object.entries(pricebook?.cablePerFt ?? {}) as [string, number][];
  return (
    <Section title="Pricing assumptions" icon={DollarSign}
      subtitle="Per-project pricebook overrides applied to BOM + work-order labor. Defaults shown for context.">
      <div className="grid grid-cols-2 gap-3 mb-3">
        {pricebook?.laborRate != null && (
          <Tile label="Labor rate override" value={`$${pricebook.laborRate}/hr`} icon={ClipboardCheck} tone="#22D3EE" subline={`Default: $95/hr`} />
        )}
        {pricebook?.markup != null && (
          <Tile label="Markup override" value={`${(pricebook.markup * 100).toFixed(0)}%`} icon={DollarSign} tone="#10B981" subline="Default: 18%" />
        )}
      </div>
      {doorEntries.length > 0 && (
        <>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Door hardware overrides</div>
          <ScheduleTable
            headers={['Class', 'Default price', 'Override price', 'Default labor', 'Override labor']}
            rows={doorEntries.map(([hw, e]) => [
              hw,
              `$${DOOR_HARDWARE_PRICE[hw]?.price ?? 0}`,
              e.price != null ? `$${e.price}` : '—',
              `${DOOR_HARDWARE_PRICE[hw]?.labor.toFixed(2) ?? 0} hr`,
              e.labor != null ? `${e.labor.toFixed(2)} hr` : '—',
            ])}
          />
        </>
      )}
      {cableEntries.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Cable per-ft overrides</div>
          <ScheduleTable
            headers={['Cable', 'Default $/ft', 'Override $/ft']}
            rows={cableEntries.map(([type, override]) => [
              type.toUpperCase(),
              `$${(CABLE_UNIT_PRICE[type] ?? 0.5).toFixed(2)}`,
              `$${Number(override).toFixed(2)}`,
            ])}
          />
        </div>
      )}
      <div className="text-[10.5px] text-muted-foreground mt-3 leading-snug">
        Pricebook is stored per-project in browser storage. Not connected to ERP / accounting / vendor pricebook sync yet.
      </div>
    </Section>
  );
}

// ─────────────────────────── Warnings ─────────────────────────────

interface Warning { id: string; severity: 'low' | 'med' | 'high'; text: string; }

function computeWarnings({ bom, doorOpenings, legacyDoors, floors, devices }: { bom: ReturnType<typeof deriveCanvasBomRows>; doorOpenings: Device[]; legacyDoors: any[]; floors: Floor[]; devices: Device[] }): Warning[] {
  const out: Warning[] = [];
  if (bom.totals.missingPriceCount > 0) {
    out.push({ id: 'missing-price', severity: 'med', text: `${bom.totals.missingPriceCount} BOM line${bom.totals.missingPriceCount === 1 ? '' : 's'} missing a price.` });
  }
  // Calibration warnings.
  const uncalibrated = floors.filter((f) => !f.calibratedAt);
  if (uncalibrated.length > 0) {
    out.push({ id: 'cal', severity: 'med', text: `${uncalibrated.length} floor${uncalibrated.length === 1 ? '' : 's'} not yet calibrated — pathway lengths use the default scale.` });
  }
  // Door rule checks — maglock without REX, strike without controller/PSU, etc.
  for (const d of doorOpenings) {
    const a = new Set(d.doorAssembly ?? []);
    if (a.has('maglock') && !a.has('rex')) out.push({ id: `door-${d.id}-maglock-rex`, severity: 'high', text: `Door ${d.id}: maglock without REX.` });
    if (a.has('strike') && !a.has('controller')) out.push({ id: `door-${d.id}-strike-ctrl`, severity: 'med', text: `Door ${d.id}: electric strike without an access controller.` });
    if (a.has('strike') && !a.has('psu'))        out.push({ id: `door-${d.id}-strike-psu`, severity: 'med', text: `Door ${d.id}: electric strike without a power supply.` });
  }
  for (const d of legacyDoors) {
    const a = new Set(d.hardware ?? []);
    if (a.has('maglock') && !a.has('rex')) out.push({ id: `door-${d.id}-maglock-rex`, severity: 'high', text: `Door ${d.id}: maglock without REX.` });
  }
  // No camera coverage.
  if (devices.filter((d) => String(d.type).startsWith('cam')).length === 0) {
    out.push({ id: 'no-cams', severity: 'low', text: 'No cameras placed yet.' });
  }
  return out;
}

function Warnings({ warnings, mode }: { warnings: Warning[]; mode: Mode }) {
  const visible = mode === 'customer'
    ? warnings.filter((w) => w.severity === 'high')
    : warnings;
  return (
    <Section title="Open warnings &amp; issues" icon={AlertTriangle}
      subtitle={mode === 'customer' ? 'Customer view shows only blocking items.' : 'Heuristic checks — not certified code compliance.'}>
      {visible.length === 0
        ? <Empty text="No open warnings. The design passes the current heuristic checks." />
        : <ul className="space-y-1.5">
            {visible.map((w) => (
              <li key={w.id} className="flex items-start gap-2 p-2.5 rounded-md border bg-secondary/10"
                style={{ borderColor: w.severity === 'high' ? 'rgba(239,68,68,0.3)' : w.severity === 'med' ? 'rgba(245,158,11,0.3)' : 'rgba(148,163,184,0.3)' }}>
                <Chip tone={w.severity === 'high' ? '#EF4444' : w.severity === 'med' ? '#F59E0B' : '#94A3B8'} text={w.severity.toUpperCase()} />
                <span className="text-[12px] text-foreground/90 flex-1">{w.text}</span>
              </li>
            ))}
          </ul>
      }
    </Section>
  );
}

// ─────────────────────────── Assumptions & exclusions ─────────────

function AssumptionsExclusions() {
  return (
    <Section title="Assumptions &amp; exclusions" icon={FileText}
      subtitle="Standard scope language. Edit before final issuance.">
      <div className="grid grid-cols-2 gap-3 text-[11.5px] text-foreground/90 leading-relaxed">
        <div className="rounded-lg border border-border bg-secondary/10 p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Included</div>
          <ul className="space-y-1 list-disc pl-4">
            <li>Furnish + install of devices and pathways shown on the canvas.</li>
            <li>Standard low-voltage cable + terminations per type.</li>
            <li>Commissioning + acceptance per work-order checklists.</li>
            <li>Engineering coordination via the Deeper Vision canvas.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-secondary/10 p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Excluded</div>
          <ul className="space-y-1 list-disc pl-4">
            <li>Line-voltage power runs, panel work, and conduit between buildings.</li>
            <li>Permits, inspections, and code-compliance certifications.</li>
            <li>Network configuration beyond switch port assignment.</li>
            <li>Existing-hardware re-use unless explicitly marked "Existing" on the door schedule.</li>
            <li>Hardware substitutions after BOM is approved.</li>
          </ul>
        </div>
      </div>
    </Section>
  );
}

// ─────────────────────────── Attachments ──────────────────────────

function Attachments() {
  return (
    <Section title="Attachments" icon={Paperclip}
      subtitle="Drawing sets, photos, and supporting docs land here. Upload pending.">
      <div className="rounded-lg border border-dashed border-border bg-secondary/5 p-4 text-center text-[11.5px] text-muted-foreground">
        <Paperclip className="w-4 h-4 mx-auto mb-1.5 text-muted-foreground/50" />
        Attachment slots — preview only. File upload + storage lands with the cloud sync pass.
      </div>
    </Section>
  );
}

// ─────────────────────────── Footer ───────────────────────────────

function ReportFooter({ project, mode }: { project: any; mode: Mode }) {
  return (
    <footer className="report-footer mt-8 pt-4 border-t border-border text-[10.5px] text-muted-foreground">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div>Generated from the Deeper Vision canvas · Project {project.id}</div>
          <div className="mt-0.5">{buildLabel()} · {COMMIT_HASH}</div>
        </div>
        <div className="text-right">
          {mode === 'internal' && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[10px] uppercase tracking-[0.1em]">
              <div>
                <div>Prepared by</div>
                <div className="mt-6 border-t border-border pt-1 text-foreground tracking-normal text-[11px]">________________</div>
              </div>
              <div>
                <div>Approved by</div>
                <div className="mt-6 border-t border-border pt-1 text-foreground tracking-normal text-[11px]">________________</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────── Section + table primitives ───────────

function Section({ title, icon: Icon, subtitle, action, children }: {
  title: string; icon: any; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="report-section mb-6">
      <div className="flex items-end justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight text-foreground leading-tight" dangerouslySetInnerHTML={{ __html: title }} />
            {subtitle && <div className="text-[10.5px] text-muted-foreground leading-snug mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

function ScheduleTable({ headers, rows }: { headers: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-background">
      <table className="w-full text-[12px]">
        <thead className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground bg-secondary/20">
          <tr>{headers.map((h, i) => <th key={i} className={`text-left px-3 py-2 ${i >= headers.length - 2 && /^[\d$\s]+$/.test(String(rows[0]?.[i] ?? '')) ? '' : ''}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td className="px-3 py-3 text-[11px] text-muted-foreground text-center" colSpan={headers.length}>—</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 === 0 ? '' : 'bg-secondary/8'}>
              {r.map((cell, j) => <td key={j} className="px-3 py-1.5 text-foreground/90 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chip({ tone, text }: { tone: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[9.5px] tracking-tight border tabular-nums"
      style={{ color: tone, borderColor: `${tone}55`, background: `${tone}14` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone }} />{text}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border bg-secondary/5 p-4 text-center text-[11.5px] text-muted-foreground">{text}</div>;
}

function CsvButton({ filename, headers, rows }: { filename: string; headers: string[]; rows: (string | number)[][] }) {
  const onDownload = () => {
    const csvField = (v: unknown): string => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const body = [headers, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('CSV exported', { description: filename, duration: 2500 });
  };
  return (
    <button onClick={onDownload}
      className="reports-chrome inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] border border-border hover:bg-secondary/40 text-foreground transition-colors"
      data-track={`reports-csv-${filename}`}
    >
      <FileDown className="w-3.5 h-3.5" />CSV
    </button>
  );
}

function shortKind(t: string): string {
  if (t === 'cam.bullet')      return 'Bullet';
  if (t === 'cam.dome')        return 'Dome';
  if (t === 'cam.ptz')         return 'PTZ';
  if (t === 'cam.multisensor') return 'Multisensor';
  if (t === 'cam.fisheye')     return 'Fisheye';
  if (t === 'cam.thermal')     return 'Thermal';
  if (t === 'cam.lpr')         return 'LPR';
  if (t === 'cam.body')        return 'Body cam';
  if (t === 'inf.door-single')      return 'Single door';
  if (t === 'inf.door-double')      return 'Double door';
  if (t === 'inf.door-storefront')  return 'Storefront';
  if (t === 'inf.door-sliding')     return 'Sliding';
  if (t === 'inf.gate-swing')       return 'Swing gate';
  if (t === 'inf.gate-slide')       return 'Slide gate';
  if (t === 'inf.elevator')         return 'Elevator';
  return t;
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 64);
}

// ─────────────────────────── Print styles ─────────────────────────

function PrintStyles() {
  // Inline so the screen carries its own print contract; no global
  // stylesheet edits required.
  return (
    <style>{`
      @media print {
        @page { size: letter; margin: 18mm 14mm; }
        body, html { background: #ffffff !important; color: #0F172A !important; }
        .reports-chrome { display: none !important; }
        .reports-body { max-width: 100% !important; padding: 0 !important; }
        .report-section { page-break-inside: avoid; margin-bottom: 14pt !important; }
        .report-cover { page-break-after: avoid; }
        .report-section svg { max-width: 100%; height: auto; }
        a { color: inherit; text-decoration: none; }
        button { display: none !important; }
        .report-footer { page-break-inside: avoid; }
      }
    `}</style>
  );
}
