// DeploymentMode — field-deployment / work-orders surface for the
// canvas. Mounted at /project/:projectId/deployment.
//
// Reads the same Zustand store the engineering canvas writes to and
// derives one work order per camera, door opening, pathway, and IDF
// rack via `deriveWorkOrders`. Status + checklist completion + photo
// placeholders + serial/MAC + blocker text persist on the new
// `workOrderProgress` slice so a tech / project manager can come back
// to a job in progress.
//
// Honest contract: install state IS persisted across reloads (Zustand
// + localStorage). Photo uploads are NOT — we capture filename + size +
// tag as a placeholder. Each photo row carries a "PREVIEW" badge so
// the user knows real upload is pending.

import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  useProjectStore, selectors as sel, deriveWorkOrders, DOOR_HARDWARE_PRICE,
} from '../store/projectStore';
import { SurveyorSymbolBody, SURVEYOR_SYMBOL_IDS } from '../components/canvas/SurveyorSymbols';
import { AttachmentPanel } from '../components/canvas/AttachmentPanel';
import { SAMPLE_PRODUCTS as CATALOG } from '../lib/productCatalog';
import { pathwayLengthFt } from '../lib/engineering';
import { buildLabel } from '../../build-info';
import type {
  WorkOrder, WorkOrderKind, WorkOrderStatus, Floor, Device, Pathway,
} from '../store/types';
import {
  HardHat, Camera, KeyRound, Cable, Server, Search, ArrowLeft, Filter,
  Circle, CircleDot, CheckCircle2, AlertTriangle, X, Plus, Image as ImageIcon,
  ChevronDown, ChevronUp, Send, MapPin, ClipboardList, Activity, Wrench,
  Hash, Mic, Layers,
} from 'lucide-react';
import { toast } from 'sonner';

const SURVEYOR_SET = new Set<string>(SURVEYOR_SYMBOL_IDS as unknown as string[]);

// ─────────────────────────── Status meta ──────────────────────────

const STATUS_ORDER: WorkOrderStatus[] = ['ready', 'assigned', 'on-site', 'installing', 'testing', 'complete'];

const STATUS_META: Record<WorkOrderStatus, { label: string; tone: string; bg: string; border: string }> = {
  ready:      { label: 'Ready',      tone: '#94A3B8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.35)' },
  assigned:   { label: 'Assigned',   tone: '#7CC4FF', bg: 'rgba(124,196,255,0.12)', border: 'rgba(124,196,255,0.35)' },
  'on-site':  { label: 'On site',    tone: '#22D3EE', bg: 'rgba(34,211,238,0.12)',  border: 'rgba(34,211,238,0.35)' },
  installing: { label: 'Installing', tone: '#A371F7', bg: 'rgba(163,113,247,0.12)', border: 'rgba(163,113,247,0.35)' },
  testing:    { label: 'Testing',    tone: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
  complete:   { label: 'Complete',   tone: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)' },
  blocked:    { label: 'Blocked',    tone: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)' },
};

const KIND_META: Record<WorkOrderKind, { label: string; icon: any; tone: string }> = {
  camera:  { label: 'Camera',   icon: Camera,   tone: '#22D3EE' },
  door:    { label: 'Door',     icon: KeyRound, tone: '#A371F7' },
  pathway: { label: 'Pathway',  icon: Cable,    tone: '#7CC4FF' },
  idf:     { label: 'IDF',      icon: Server,   tone: '#10B981' },
};

const PRIO_META: Record<'low' | 'med' | 'high', { label: string; tone: string }> = {
  low:  { label: 'Low',    tone: '#94A3B8' },
  med:  { label: 'Medium', tone: '#F59E0B' },
  high: { label: 'High',   tone: '#EF4444' },
};

const MOCK_TECHS = ['Unassigned', 'Sam Ortiz · Cam crew', 'Priya Banerjee · Access', 'Marcus Lee · Cable', 'Devon Park · Network'];

// ─────────────────────────── Root ─────────────────────────────────

export function DeploymentMode() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();
  const state = useProjectStore();
  const project = state.projects[projectId];

  const workOrders = useMemo(() => deriveWorkOrders(state, projectId), [state, projectId]);
  const floors = useMemo(() => sel.floorsForProject(state, projectId), [state, projectId]);

  const [filterKind, setFilterKind]     = useState<WorkOrderKind | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<WorkOrderStatus | 'all' | 'open' | 'blocked'>('open');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default selection — first WO that isn't complete.
  useEffect(() => {
    if (selectedId && workOrders.some((w) => w.id === selectedId)) return;
    const first = workOrders.find((w) => w.progress.status !== 'complete') ?? workOrders[0];
    setSelectedId(first?.id ?? null);
  }, [workOrders, selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workOrders.filter((w) => {
      if (filterKind !== 'all' && w.kind !== filterKind) return false;
      const st = w.progress.status;
      if (filterStatus === 'open')    { if (st === 'complete') return false; }
      else if (filterStatus === 'blocked') { if (st !== 'blocked') return false; }
      else if (filterStatus !== 'all')     { if (st !== filterStatus) return false; }
      if (!q) return true;
      return w.id.toLowerCase().includes(q)
          || w.sourceId.toLowerCase().includes(q)
          || w.title.toLowerCase().includes(q)
          || (w.subtitle ?? '').toLowerCase().includes(q)
          || (w.location ?? '').toLowerCase().includes(q);
    });
  }, [workOrders, filterKind, filterStatus, search]);

  const selected = useMemo(() => workOrders.find((w) => w.id === selectedId) ?? null, [workOrders, selectedId]);

  // Summary tallies for the header strip.
  const tallies = useMemo(() => {
    const t = { total: workOrders.length, open: 0, complete: 0, blocked: 0, hours: 0 };
    for (const w of workOrders) {
      if (w.progress.status === 'complete') t.complete++;
      else if (w.progress.status === 'blocked') t.blocked++;
      else                                    t.open++;
      if (w.progress.status !== 'complete') t.hours += w.estLaborHours;
    }
    return t;
  }, [workOrders]);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-8" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="max-w-md">
          <HardHat className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <div className="text-[16px] font-medium mb-1">Project not found</div>
          <div className="text-[12px] text-muted-foreground mb-4">No project matches <span className="font-mono text-foreground">{projectId}</span>.</div>
          <button onClick={() => nav('/projects')} className="text-[11px] px-3 h-8 rounded-md border border-border hover:bg-secondary/50">Back to projects</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
      data-screen="deployment-mode"
    >
      <DeploymentTopBar
        projectName={project.name}
        tallies={tallies}
        onOpenEngineering={() => nav(`/project/${projectId}/canvas`)}
        onOpenMobile={() => nav(`/project/${projectId}/deployment/m`)}
      />

      <div className="flex-1 grid grid-cols-[400px_minmax(0,1fr)] min-h-0">
        {/* Left rail: filters + WO list */}
        <div className="border-r border-border bg-background/60 backdrop-blur-md flex flex-col min-h-0" data-canvas-chrome="deployment-list">
          <div className="px-4 pt-3 pb-2 border-b border-border space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search WO id, source, location…"
                className="w-full text-[12px] h-8 pl-8 pr-2 rounded-md border border-border bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                data-testid="deploy-search"
              />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <FilterPill label="All"        active={filterStatus === 'all'}     onClick={() => setFilterStatus('all')}     count={tallies.total}  track="all" />
              <FilterPill label="Open"       active={filterStatus === 'open'}    onClick={() => setFilterStatus('open')}    count={tallies.open}   track="open" />
              <FilterPill label="Blocked"    active={filterStatus === 'blocked'} onClick={() => setFilterStatus('blocked')} count={tallies.blocked} tone="#EF4444" track="blocked" />
              <FilterPill label="Complete"   active={filterStatus === 'complete'} onClick={() => setFilterStatus('complete')} count={tallies.complete} tone="#10B981" track="complete" />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <FilterChip kind="all" label="All types" active={filterKind === 'all'} onClick={() => setFilterKind('all')} />
              {(['camera', 'door', 'pathway', 'idf'] as WorkOrderKind[]).map((k) => (
                <FilterChip key={k} kind={k} label={KIND_META[k].label}
                  active={filterKind === k} onClick={() => setFilterKind(k)} />
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
            {filtered.length === 0 && workOrders.length === 0 && (
              <div className="text-center p-6 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/60 inline-flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="text-[12px] text-foreground font-medium">No work orders yet</div>
                <div className="text-[11px] text-muted-foreground leading-snug max-w-[260px] mx-auto">Devices, doors, pathways, and racks placed on the canvas appear here as install tasks.</div>
                <button
                  onClick={() => nav(`/project/${projectId}/canvas`)}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                >
                  Open Engineering Canvas
                </button>
              </div>
            )}
            {filtered.length === 0 && workOrders.length > 0 && (
              <div className="text-center text-[11.5px] text-muted-foreground p-6">
                No work orders match this filter.
              </div>
            )}
            {filtered.map((wo) => (
              <WorkOrderRow
                key={wo.id}
                wo={wo}
                selected={wo.id === selectedId}
                onSelect={() => setSelectedId(wo.id)}
              />
            ))}
          </div>
        </div>

        {/* Detail — two-column inside */}
        <div className="grid grid-cols-[minmax(0,1fr)_400px] min-h-0">
          <div className="overflow-y-auto p-5 min-h-0">
            {selected
              ? <WorkOrderDetail wo={selected} floors={floors} state={state} projectId={projectId} />
              : <div className="text-[12px] text-muted-foreground">Select a work order on the left to see its details.</div>
            }
          </div>
          <div className="border-l border-border bg-background/40 overflow-y-auto p-5 min-h-0">
            {selected
              ? <WorkOrderChecklistPanel wo={selected} />
              : null
            }
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-background/70 backdrop-blur px-4 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {tallies.complete}/{tallies.total} complete · {tallies.open} open · {tallies.blocked} blocked · {Math.round(tallies.hours * 10) / 10} hr of work remaining
          <span className="ml-3 text-foreground/40">·</span>
        </span>
        <span>{buildLabel()}</span>
      </div>
    </div>
  );
}

// ─────────────────────────── Top bar ──────────────────────────────

function DeploymentTopBar({ projectName, tallies, onOpenEngineering, onOpenMobile }: {
  projectName: string;
  tallies: { total: number; open: number; complete: number; blocked: number; hours: number };
  onOpenEngineering: () => void;
  onOpenMobile?: () => void;
}) {
  const pct = tallies.total === 0 ? 0 : Math.round((tallies.complete / tallies.total) * 100);
  return (
    <div className="shrink-0 border-b border-border bg-background/90 backdrop-blur-md flex items-center gap-3 px-4 py-2.5">
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', color: '#0B0F17' }}>
          <HardHat className="w-4 h-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Deeper Vision · Field Deployment</span>
          <span className="text-[14px] font-semibold tracking-tight text-foreground">{projectName}</span>
        </div>
        {onOpenMobile && (
          <button
            onClick={onOpenMobile}
            title="Open the mobile field view in this tab"
            className="ml-2 inline-flex items-center gap-1 h-6 px-1.5 rounded text-[10px] uppercase tracking-[0.10em] border border-border text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors"
            data-track="deployment-open-mobile"
          >
            Mobile view
          </button>
        )}
      </div>

      {/* Project progress bar */}
      <div className="hidden md:flex items-center gap-3 ml-2">
        <div className="flex flex-col gap-0.5 min-w-[180px]">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="uppercase tracking-[0.14em]">Project install</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10B981, #22D3EE)' }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px]">
          <Pill tone="#10B981" label={`${tallies.complete} complete`} />
          <Pill tone="#94A3B8" label={`${tallies.open} open`} />
          {tallies.blocked > 0 && <Pill tone="#EF4444" label={`${tallies.blocked} blocked`} />}
        </div>
      </div>

      <div className="flex-1" />

      <button
        onClick={onOpenEngineering}
        title="Open the Engineering Canvas — back to the design surface"
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11.5px] border border-primary/30 bg-primary/10 hover:bg-primary/15 text-primary transition-colors"
        data-track="deploy-open-engineering"
      >
        <ArrowLeft className="w-3.5 h-3.5" />Open in Engineering
      </button>
    </div>
  );
}

function Pill({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[10.5px]"
      style={{ color: tone, borderColor: `${tone}55`, background: `${tone}14` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone }} />{label}
    </span>
  );
}

function FilterPill({ label, active, onClick, count, tone, track }: {
  label: string; active: boolean; onClick: () => void; count: number; tone?: string; track: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={count === 0 && label !== 'All'}
      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] tracking-tight transition-colors border ${
        active ? 'border-primary/40 bg-primary/15 text-primary'
               : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
      style={active && tone ? { color: tone, borderColor: `${tone}55`, background: `${tone}1A` } : undefined}
      data-track={`deploy-filter-status-${track}`}
    >
      {label}<span className="text-[10px] opacity-70 tabular-nums">{count}</span>
    </button>
  );
}

function FilterChip({ kind, label, active, onClick }: {
  kind: WorkOrderKind | 'all'; label: string; active: boolean; onClick: () => void;
}) {
  const meta = kind === 'all' ? null : KIND_META[kind];
  const Icon = meta?.icon ?? Layers;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10.5px] tracking-tight transition-colors border ${
        active ? 'border-foreground/30 bg-secondary/60 text-foreground'
               : 'border-border text-muted-foreground hover:bg-secondary/40'
      }`}
      data-track={`deploy-filter-kind-${kind}`}
    >
      <Icon className="w-3 h-3" style={meta ? { color: meta.tone } : undefined} />{label}
    </button>
  );
}

// ─────────────────────────── WO list row ──────────────────────────

function WorkOrderRow({ wo, selected, onSelect }: { wo: WorkOrder; selected: boolean; onSelect: () => void }) {
  const kindMeta = KIND_META[wo.kind];
  const statusMeta = STATUS_META[wo.progress.status];
  const KindIcon = kindMeta.icon;
  const done = wo.progress.completed.length;
  const total = wo.checklist.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-md border transition-colors ${
        selected ? 'bg-secondary/60 border-foreground/20'
                 : 'bg-secondary/15 border-border hover:bg-secondary/30 hover:border-border'
      } p-2.5`}
      data-track="deploy-wo-row"
      data-wo-id={wo.id}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ background: `${kindMeta.tone}14`, border: `1px solid ${kindMeta.tone}33`, color: kindMeta.tone }}>
          <KindIcon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <span className="text-[11px] text-muted-foreground font-mono tracking-tight truncate">{wo.id}</span>
            <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[9.5px] border"
              style={{ color: statusMeta.tone, background: statusMeta.bg, borderColor: statusMeta.border }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.tone }} />
              {statusMeta.label}
            </span>
          </div>
          <div className="text-[12.5px] font-medium text-foreground truncate">{wo.title}</div>
          {wo.subtitle && (
            <div className="text-[10.5px] text-muted-foreground truncate">{wo.subtitle}</div>
          )}
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <div className="flex-1 h-1 rounded-full bg-secondary/60 overflow-hidden">
              <div className="h-full" style={{ width: `${pct}%`, background: wo.progress.status === 'complete' ? '#10B981' : wo.progress.status === 'blocked' ? '#EF4444' : '#22D3EE' }} />
            </div>
            <span className="text-[9.5px] tabular-nums text-muted-foreground">{done}/{total}</span>
            <span className="text-[9.5px] tabular-nums text-muted-foreground">{wo.estLaborHours.toFixed(1)}h</span>
            <span className="text-[9.5px] uppercase tracking-[0.1em]" style={{ color: PRIO_META[wo.priority].tone }}>{PRIO_META[wo.priority].label}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────── WO detail ────────────────────────────

function WorkOrderDetail({ wo, floors, state, projectId }: { wo: WorkOrder; floors: Floor[]; state: any; projectId: string }) {
  const kindMeta = KIND_META[wo.kind];
  const statusMeta = STATUS_META[wo.progress.status];
  const KindIcon = kindMeta.icon;
  const patch = useProjectStore((s) => s.patchWorkOrderProgress);
  const setStatus = useProjectStore((s) => s.setWorkOrderStatus);

  // Locate source object + parent floor (for the mini map and detail copy).
  const sourceDevice: Device | undefined =
    wo.kind === 'camera' || wo.kind === 'door'
      ? state.devices?.[wo.sourceId]
      : undefined;
  const sourcePathway: Pathway | undefined = wo.kind === 'pathway' ? state.pathways?.[wo.sourceId] : undefined;
  const sourceIdf = wo.kind === 'idf' ? state.idfs?.[wo.sourceId] : undefined;
  const sourceDoor = wo.kind === 'door' && !sourceDevice ? state.doors?.[wo.sourceId] : undefined;
  const floorId: string | undefined =
    sourceDevice?.floorId ?? sourcePathway?.floorId ?? sourceIdf?.floorId ?? sourceDoor?.floorId ?? floors[0]?.id;
  const floor: Floor | undefined = floors.find((f) => f.id === floorId);

  const [blockerOpen, setBlockerOpen] = useState(false);
  const [blockerText, setBlockerText] = useState(wo.progress.blocker ?? '');
  useEffect(() => { setBlockerText(wo.progress.blocker ?? ''); }, [wo.id]);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${kindMeta.tone}14`, border: `1px solid ${kindMeta.tone}33`, color: kindMeta.tone }}>
          <KindIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-mono tracking-tight">{wo.id}</span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{kindMeta.label}</span>
            <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: PRIO_META[wo.priority].tone }}>{PRIO_META[wo.priority].label} priority</span>
          </div>
          <div className="text-[18px] font-medium text-foreground tracking-tight">{wo.title}</div>
          {wo.subtitle && <div className="text-[12px] text-muted-foreground mt-0.5">{wo.subtitle}</div>}
          {wo.location && (
            <div className="flex items-center gap-1.5 mt-1 text-[11.5px] text-muted-foreground">
              <MapPin className="w-3 h-3" />{wo.location}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Est. labor</div>
          <div className="text-[16px] font-medium tabular-nums">{wo.estLaborHours.toFixed(1)}<span className="text-[11px] text-muted-foreground"> hr</span></div>
        </div>
      </div>

      {/* Status timeline */}
      <div className="rounded-lg border border-border p-3 bg-secondary/15">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Status</div>
          <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[10.5px] border"
            style={{ color: statusMeta.tone, background: statusMeta.bg, borderColor: statusMeta.border }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.tone }} />{statusMeta.label}
          </span>
        </div>
        <StatusTimeline wo={wo} onSet={(s) => setStatus(wo.id, s)} />
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <button
            onClick={() => { setStatus(wo.id, 'blocked'); setBlockerOpen(true); }}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] border transition-colors ${wo.progress.status === 'blocked' ? 'border-red-500/40 bg-red-500/15 text-red-400' : 'border-border hover:bg-secondary/40 text-foreground'}`}
            data-track="deploy-blocker-flag"
          >
            <AlertTriangle className="w-3.5 h-3.5" />{wo.progress.status === 'blocked' ? 'Blocked' : 'Flag blocker'}
          </button>
          {wo.progress.status === 'blocked' && (
            <button
              onClick={() => setStatus(wo.id, wo.progress.prevStatus ?? 'on-site')}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] border border-border hover:bg-secondary/40 text-foreground"
              data-track="deploy-blocker-clear"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />Clear blocker
            </button>
          )}
          {wo.progress.status !== 'complete' && (
            <button
              onClick={() => setStatus(wo.id, 'complete')}
              className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/15"
              data-track="deploy-mark-complete"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />Mark complete
            </button>
          )}
        </div>
        {(wo.progress.status === 'blocked' || blockerOpen) && (
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Blocker description</div>
            <textarea
              value={blockerText}
              onChange={(e) => setBlockerText(e.target.value)}
              onBlur={() => patch(wo.id, { blocker: blockerText.trim() || undefined })}
              placeholder="What's stopping this install? (e.g. 'Conduit not stubbed at the door', 'Missing reader MAC list')"
              rows={2}
              className="w-full text-[12px] p-2 rounded-md border border-border bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:border-red-500/50 resize-none"
              data-testid="deploy-blocker-textarea"
            />
          </div>
        )}
      </div>

      {/* Assign + serial/MAC */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3 bg-secondary/15">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">Assigned tech</div>
          <select
            value={wo.progress.assignedTo ?? 'Unassigned'}
            onChange={(e) => patch(wo.id, { assignedTo: e.target.value === 'Unassigned' ? undefined : e.target.value })}
            className="w-full text-[12px] h-8 px-2 rounded-md border border-border bg-background focus:outline-none focus:border-primary/50"
            data-testid="deploy-assign-select"
          >
            {MOCK_TECHS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="rounded-lg border border-border p-3 bg-secondary/15">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">Hardware identity</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Hash className="w-3 h-3 text-muted-foreground" />
              <input type="text" placeholder="Serial #" value={wo.progress.serial ?? ''} onChange={(e) => patch(wo.id, { serial: e.target.value || undefined })}
                className="flex-1 text-[12px] h-7 px-2 rounded border border-border bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                data-testid="deploy-serial-input" />
            </div>
            <div className="flex items-center gap-2">
              <Mic className="w-3 h-3 text-muted-foreground" />
              <input type="text" placeholder="MAC address" value={wo.progress.mac ?? ''} onChange={(e) => patch(wo.id, { mac: e.target.value || undefined })}
                className="flex-1 text-[12px] h-7 px-2 rounded border border-border bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                data-testid="deploy-mac-input" />
            </div>
          </div>
        </div>
      </div>

      {/* Source summary */}
      <SourceSummary wo={wo} state={state} />

      {/* Mini floor preview */}
      <div className="rounded-lg border border-border bg-secondary/10 overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-border">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <MapPin className="w-3 h-3" />Location on plan
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{floor?.name ?? '—'}</div>
        </div>
        {floor ? (
          <MiniFloorPreview floor={floor} highlightDevice={sourceDevice} highlightPathway={sourcePathway} />
        ) : (
          <div className="text-[11px] text-muted-foreground p-3">No floor plan available.</div>
        )}
      </div>

      {/* Field notes */}
      <div className="rounded-lg border border-border p-3 bg-secondary/15">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">Field notes</div>
        <textarea
          value={wo.progress.fieldNotes ?? ''}
          onChange={(e) => patch(wo.id, { fieldNotes: e.target.value || undefined })}
          placeholder="Anything the engineer should know on the next pass? (e.g. 'Wall finish is brick, T-bar 9 ft', 'Lock body needs RIM strike from Allegion')"
          rows={3}
          className="w-full text-[12px] p-2 rounded border border-border bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none"
          data-testid="deploy-field-notes"
        />
      </div>

      {/* Photo placeholders */}
      <PhotoSection wo={wo} projectId={projectId} />
    </div>
  );
}

function StatusTimeline({ wo, onSet }: { wo: WorkOrder; onSet: (s: WorkOrderStatus) => void }) {
  const currentIdx = STATUS_ORDER.indexOf(wo.progress.status === 'blocked' ? (wo.progress.prevStatus ?? 'ready') : wo.progress.status);
  return (
    <div className="flex items-center" data-testid="deploy-status-timeline">
      {STATUS_ORDER.map((s, i) => {
        const reached = i <= currentIdx && wo.progress.status !== 'blocked';
        const isCurrent = i === currentIdx && wo.progress.status !== 'blocked';
        const meta = STATUS_META[s];
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => onSet(s)}
              className="group flex flex-col items-center gap-1 px-1"
              data-track={`deploy-status-set-${s}`}
              title={`Set status to ${meta.label}`}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center transition-all border-2"
                style={{
                  borderColor: reached ? meta.tone : 'var(--border)',
                  background: reached ? meta.tone : 'transparent',
                }}>
                {reached
                  ? (isCurrent ? <CircleDot className="w-3 h-3 text-background" /> : <CheckCircle2 className="w-3 h-3 text-background" />)
                  : <Circle className="w-3 h-3 text-muted-foreground/40" />
                }
              </div>
              <span className={`text-[9px] uppercase tracking-[0.1em] ${reached ? 'text-foreground' : 'text-muted-foreground/60'}`}>{meta.label}</span>
            </button>
            {i < STATUS_ORDER.length - 1 && (
              <div className="flex-1 h-px mx-1" style={{ background: i < currentIdx ? STATUS_META[STATUS_ORDER[i + 1]].tone : 'var(--border)', opacity: i < currentIdx ? 0.6 : 1 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SourceSummary({ wo, state }: { wo: WorkOrder; state: any }) {
  if (wo.kind === 'camera') {
    const d: Device | undefined = state.devices?.[wo.sourceId];
    if (!d) return null;
    const product = CATALOG.find((p) => p.id === d.product);
    const range = d.range ?? (d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30);
    const fov = d.fov ?? (d.type === 'cam.ptz' ? 36 : d.type === 'cam.fisheye' ? 360 : 70);
    return (
      <div className="rounded-lg border border-border p-3 bg-secondary/15">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">Source · camera</div>
        <div className="grid grid-cols-2 gap-y-1 text-[11.5px]">
          <Kv k="Model"     v={product ? `${product.manufacturer} · ${product.model}` : d.type} />
          <Kv k="Coverage"  v={d.type === 'cam.fisheye' ? `${range} ft omni` : `${fov}° × ${range} ft`} />
          {d.mountFt != null && <Kv k="Mount" v={`${d.mountFt} ft`} />}
          {d.ir   && <Kv k="IR"   v="Yes" />}
          {d.ndaa && <Kv k="NDAA" v="Yes" />}
        </div>
      </div>
    );
  }
  if (wo.kind === 'door') {
    const d: Device | undefined = state.devices?.[wo.sourceId];
    const door = !d ? state.doors?.[wo.sourceId] : undefined;
    const assembly = (d?.doorAssembly ?? door?.hardware ?? []) as any[];
    const stateMap = (d?.doorAssemblyState ?? {}) as Record<string, 'proposed' | 'existing'>;
    return (
      <div className="rounded-lg border border-border p-3 bg-secondary/15">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">Source · opening</div>
        {assembly.length === 0
          ? <div className="text-[11.5px] text-muted-foreground">No hardware specified yet.</div>
          : <ul className="space-y-1">
              {assembly.map((hw) => {
                const meta = DOOR_HARDWARE_PRICE[hw as keyof typeof DOOR_HARDWARE_PRICE];
                const isExisting = stateMap[hw] === 'existing';
                return (
                  <li key={String(hw)} className="flex items-center justify-between text-[11.5px]">
                    <span className={isExisting ? 'text-muted-foreground line-through decoration-1' : 'text-foreground'}>{meta?.desc ?? hw}</span>
                    <span className={`text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border ${isExisting ? 'border-amber-400/40 text-amber-400 bg-amber-400/10' : 'border-emerald-400/40 text-emerald-400 bg-emerald-400/10'}`}>{isExisting ? 'Existing' : 'Proposed'}</span>
                  </li>
                );
              })}
            </ul>
        }
      </div>
    );
  }
  if (wo.kind === 'pathway') {
    const p: Pathway | undefined = state.pathways?.[wo.sourceId];
    if (!p) return null;
    const ft = pathwayLengthFt(p, state.floors?.[p.floorId ?? '']);
    return (
      <div className="rounded-lg border border-border p-3 bg-secondary/15">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">Source · pathway</div>
        <div className="grid grid-cols-2 gap-y-1 text-[11.5px]">
          <Kv k="Cable"   v={(p.cableType ?? 'cat6a').toUpperCase()} />
          <Kv k="Length"  v={`${ft} ft`} />
          <Kv k="Count"   v={`${p.cableCount}×`} />
          {p.conduitSize && <Kv k="Conduit" v={p.conduitSize} />}
          {p.bundleId    && <Kv k="Bundle"  v={p.bundleId} />}
        </div>
      </div>
    );
  }
  if (wo.kind === 'idf') {
    const idf = state.idfs?.[wo.sourceId];
    if (!idf) return null;
    return (
      <div className="rounded-lg border border-border p-3 bg-secondary/15">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">Source · IDF / rack</div>
        <div className="space-y-1 text-[11.5px]">
          {(idf.switches ?? []).map((sw: any) => (
            <div key={sw.model} className="flex items-center justify-between">
              <span>{sw.model}</span>
              <span className="text-muted-foreground">{sw.portsTotal} ports</span>
            </div>
          ))}
          {idf.power?.upsModel && (
            <div className="flex items-center justify-between">
              <span>{idf.power.upsModel}</span>
              <span className="text-muted-foreground">~{idf.power.upsRuntimeMin ?? 30} min runtime</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">{k}</span>
      <span className="text-[11.5px] text-foreground text-right">{v}</span>
    </>
  );
}

// ─────────────────────────── Mini map ─────────────────────────────

function MiniFloorPreview({ floor, highlightDevice, highlightPathway }: {
  floor: Floor;
  highlightDevice?: Device;
  highlightPathway?: Pathway;
}) {
  // Compute the bbox so we can frame the highlighted source nicely.
  const W = 380, H = 220;
  const padding = 24;
  const xs: number[] = [], ys: number[] = [];
  if (highlightDevice) { xs.push(highlightDevice.x); ys.push(highlightDevice.y); }
  if (highlightPathway?.points) {
    for (const pt of highlightPathway.points as any[]) { xs.push(pt.x); ys.push(pt.y); }
  }
  for (const w of floor.walls ?? []) { xs.push(w.x1, w.x2); ys.push(w.y1, w.y2); }
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
  const hasSymbol = highlightDevice && SURVEYOR_SET.has(highlightDevice.type);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
      <defs>
        <pattern id="dep-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dep-grid)" />
      <g transform={`translate(${tx}, ${ty}) scale(${z})`}>
        {floor.background && (
          <g transform={`translate(${floor.background.x}, ${floor.background.y}) rotate(${floor.background.rotation}) scale(${floor.background.scale})`} opacity={floor.background.opacity * 0.7}>
            <image href={floor.background.dataUrl} width={floor.background.naturalWidth} height={floor.background.naturalHeight} preserveAspectRatio="none" />
          </g>
        )}
        {(floor.walls ?? []).map((w) => (
          <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#94A3B8" strokeWidth={2 / Math.max(z, 0.5)} strokeLinecap="round" opacity={0.7} />
        ))}
        {highlightPathway?.points && (highlightPathway.points as any[]).length >= 2 && (
          <>
            <path d={(highlightPathway.points as any[]).map((pt: any, i: number) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')}
              fill="none" stroke="#7CC4FF" strokeWidth={3 / Math.max(z, 0.5)} strokeLinecap="round" strokeDasharray="8 6" opacity={0.9} />
            <path d={(highlightPathway.points as any[]).map((pt: any, i: number) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')}
              fill="none" stroke="#F59E0B" strokeWidth={1 / Math.max(z, 0.5)} strokeLinecap="round" opacity={0.9} />
          </>
        )}
        {highlightDevice && (
          <g transform={`translate(${highlightDevice.x}, ${highlightDevice.y})`}>
            {/* pulsing halo */}
            <circle r={22} fill="#F59E0B" fillOpacity={0.18} stroke="#F59E0B" strokeOpacity={0.6} strokeWidth={1.5}>
              <animate attributeName="r" values="22;28;22" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.55;0.25;0.55" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle r={14} fill="var(--card, #ffffff)" stroke="#F59E0B" strokeWidth={1.6} />
            <g transform={`rotate(${highlightDevice.rot})`}>
              {hasSymbol
                ? <g style={{ color: '#F59E0B' }}><SurveyorSymbolBody id={highlightDevice.type} scale={0.85} stroke={1.3} /></g>
                : <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={600} fill="#F59E0B">
                    {(highlightDevice.type.split('.')[1] || '?').slice(0, 3).toUpperCase()}
                  </text>
              }
            </g>
            <text y={26} textAnchor="middle" fontSize={9} fill="var(--foreground, #0F172A)" style={{ pointerEvents: 'none' }}>{highlightDevice.id}</text>
          </g>
        )}
      </g>
    </svg>
  );
}

// ─────────────────────────── Checklist + photos panel ─────────────

function WorkOrderChecklistPanel({ wo }: { wo: WorkOrder }) {
  const toggle = useProjectStore((s) => s.toggleWorkOrderChecklist);
  const done = wo.progress.completed.length;
  const total = wo.checklist.length;
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Field checklist</div>
          </div>
          <span className="text-[10.5px] tabular-nums text-muted-foreground">{done}/{total} done</span>
        </div>
        <div className="space-y-1.5" data-testid="deploy-checklist">
          {wo.checklist.map((item) => {
            const checked = wo.progress.completed.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggle(wo.id, item.id)}
                className={`w-full text-left flex items-start gap-2 p-2 rounded-md border transition-colors ${checked ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-border bg-secondary/15 hover:bg-secondary/40'}`}
                data-track="deploy-checklist-item"
                data-item-id={item.id}
              >
                <div className={`w-4 h-4 rounded shrink-0 mt-0.5 flex items-center justify-center border ${checked ? 'border-emerald-500 bg-emerald-500/30' : 'border-border bg-background'}`}>
                  {checked && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                </div>
                <div className={`text-[12px] flex-1 leading-snug ${checked ? 'text-muted-foreground line-through decoration-1' : 'text-foreground'}`}>{item.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PhotoSection({ wo, projectId }: { wo: WorkOrder; projectId: string }) {
  // The Attachments / Files foundation pass replaced the per-WO
  // `photoPlaceholders` array with the shared `attachments` slice.
  // The WO photo section now mounts AttachmentPanel with
  // linkedObjectType 'workOrder' so the same record drives Reports
  // + the WO detail. Real image preview (canvas-downsampled to
  // 800px JPEG q0.8) replaces the prior metadata-only placeholder.
  return (
    <div className="rounded-lg border border-border p-3 bg-secondary/15">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Install photos</div>
        </div>
      </div>
      <AttachmentPanel
        projectId={projectId}
        linkedObjectType="workOrder"
        linkedObjectId={wo.id}
        defaultCategory="photo"
        uploadedBy={wo.progress.assignedTo}
        compact
      />
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)        return 'just now';
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
