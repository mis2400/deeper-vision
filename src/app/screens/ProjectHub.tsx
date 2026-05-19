import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Search, Plus, MapPin, Users, Calendar, ChevronRight, LayoutGrid, List as ListIcon, ArrowRight, Columns3, ArrowUpDown } from 'lucide-react';
import { useProjectStore, selectors as sel } from '../store/projectStore';
import { PHASES, quickActionFor, healthTone, progressPctFor } from '../lifecycle/phases';
import type { LifecyclePhase } from '../store/types';

interface Project {
  id: string;
  name: string;
  client: string;
  /** Customer id for routing — when present, the client name links to /account/:id. */
  customerId?: string;
  address: string;
  status: 'design' | 'review' | 'install' | 'live';
  devices: number;
  team: number;
  updated: string;
  progress: number;
  /** New lifecycle fields surfaced on the card. */
  phase: LifecyclePhase;
  nextAction?: string;
  health?: 'on_track' | 'at_risk' | 'blocked' | 'complete';
  ownerName?: string;
  /** Sorting + kanban metadata. */
  updatedAt: number;
  contractValue?: number;
  dueDate?: number;
}

const STATUS_META = {
  design:  { label: 'Design',     tone: 'text-primary bg-primary/10' },
  review:  { label: 'In review',  tone: 'text-amber-400 bg-amber-400/10' },
  install: { label: 'Installing', tone: 'text-emerald-400 bg-emerald-400/10' },
  live:    { label: 'Live',       tone: 'text-foreground bg-secondary' },
} as const;

export function ProjectHub() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  /** Filter by lifecycle bucket — coarse groupings that match the operating
   *  team rather than 1-of-15 phase enums. 'blocked' filters by health. */
  type Bucket = 'all' | 'sales' | 'survey' | 'engineering' | 'estimate' | 'proposal' | 'deployment' | 'service' | 'blocked';
  const [filter, setFilter] = useState<Bucket>('all');
  const BUCKET_PHASES: Record<Bucket, LifecyclePhase[]> = {
    all: [],
    sales:        ['lead', 'discovery', 'walk_scheduled'],
    survey:       ['survey'],
    engineering:  ['engineering'],
    estimate:     ['estimate'],
    proposal:     ['proposal', 'customer_review', 'approved'],
    deployment:   ['deployment', 'commissioning'],
    service:      ['completed', 'managed_service', 'support'],
    blocked:      [],
  };
  const [view, setView] = useState<'grid' | 'list' | 'kanban'>('grid');
  // V1 1E.1 — sort options. Default still "most recent" to preserve
  // the prior implicit behavior; the others (alphabetical, highest
  // value, next-action soonest) are the dropdown choices.
  type SortKey = 'recent' | 'name' | 'value' | 'nextAction';
  const [sortKey, setSortKey] = useState<SortKey>('recent');

  // Subscribe to raw maps (stable identity until mutated). Sorting / mapping
  // is done in useMemo below — selectors that returned new arrays per call
  // tripped Zustand's infinite-loop guard via getSnapshot.
  const projectsMap   = useProjectStore((s) => s.projects);
  const storeCustomers = useProjectStore((s) => s.customers);
  const storeDevices   = useProjectStore((s) => s.devices);

  const storeProjects = useMemo(
    () => Object.values(projectsMap).sort((a, b) => b.updatedAt - a.updatedAt),
    [projectsMap],
  );

  const projects: Project[] = useMemo(() => storeProjects.map((p) => {
    const customer = p.customerId ? storeCustomers[p.customerId] : undefined;
    const addr = customer?.addresses?.[0];
    const deviceCount = Object.values(storeDevices).filter((d) => d.projectId === p.id).length;
    // Derive surface-level progress from the canonical phase ordering rather
    // than the stored `progress` field — keeps the bar honest as users
    // advance/revert phases without an explicit update.
    const phaseProgress = progressPctFor(p.lifecyclePhase);
    // Pick a single owner to display on the card. Priority: PM > Engineer >
    // Sales > Estimator. The command center surfaces all four.
    const owner = p.assignedPMUserId ?? p.assignedEngineerUserId ?? p.assignedSalesUserId ?? p.assignedEstimatorUserId;
    return {
      id: p.id,
      name: p.name,
      client: customer?.companyName ?? '—',
      customerId: p.customerId,
      address: addr ? `${addr.street}${addr.city ? ` · ${addr.city}, ${addr.state ?? ''}` : ''}` : '—',
      status: p.status === 'archived' ? 'live' : p.status,
      devices: deviceCount,
      team: p.team ?? 0,
      updated: p.updated ?? '—',
      progress: phaseProgress,
      phase: p.lifecyclePhase,
      nextAction: p.nextAction,
      health: p.healthStatus,
      ownerName: owner?.replace(/^u-/, ''),
      updatedAt: p.updatedAt,
      contractValue: p.contractValue,
      dueDate: p.dueDate,
    };
  }), [storeProjects, storeCustomers, storeDevices]);

  const filtered = useMemo(() => {
    const matched = projects.filter((p) => {
      if (filter === 'blocked') {
        if (p.health !== 'blocked' && p.health !== 'at_risk') return false;
      } else if (filter !== 'all') {
        if (!BUCKET_PHASES[filter].includes(p.phase)) return false;
      }
      if (q && !`${p.name} ${p.client} ${p.address}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    // V1 1E.1 — apply sort. Nullish values land at the tail so the
    // sort never hides a project, just orders the ones with data.
    const TAIL = Number.POSITIVE_INFINITY;
    const NEG_TAIL = Number.NEGATIVE_INFINITY;
    const arr = [...matched];
    switch (sortKey) {
      case 'name':
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'value':
        arr.sort((a, b) => (b.contractValue ?? NEG_TAIL) - (a.contractValue ?? NEG_TAIL));
        break;
      case 'nextAction':
        arr.sort((a, b) => (a.dueDate ?? TAIL) - (b.dueDate ?? TAIL));
        break;
      case 'recent':
      default:
        arr.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
    }
    return arr;
  }, [projects, filter, q, sortKey]);
  // Last updated stamp across all projects — replaces the dev-flavored
  // "live from project store" line with a real timestamp.
  const lastTouched = useMemo(() => {
    if (projects.length === 0) return null;
    const t = Math.max(...projects.map((p) => p.updatedAt));
    return new Date(t);
  }, [projects]);
  // SC.7.6: memoize on the underlying timestamp so the IIFE doesn't
  // re-run on every render (Phase 1 reviewer MINOR). Re-evaluates only
  // when the latest project edit moves.
  const relativeUpdated = useMemo(() => {
    if (!lastTouched) return null;
    const diff = Date.now() - lastTouched.getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    const days = Math.round(hr / 24);
    if (days < 30) return `${days}d ago`;
    return lastTouched.toLocaleDateString();
  }, [lastTouched]);

  return (
    <AppShell
      crumbs={[{ label: 'Projects' }]}
      actions={
        // V1 Phase 3G — Reset demo relocated to Settings → Advanced.
        // ProjectHub's primary action row stays focused on New project.
        <Button size="sm" onClick={() => navigate('/intake/new')}>
          <Plus className="w-3.5 h-3.5 mr-1" />New project
        </Button>
      }
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length === projects.length
                ? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`
                : `${filtered.length} of ${projects.length} projects`}
              {relativeUpdated && <> · last updated {relativeUpdated}</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects, clients, addresses"
              className="w-full bg-input-background border border-input-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center border border-border rounded-md p-0.5 bg-background overflow-x-auto">
            {(['all', 'sales', 'survey', 'engineering', 'estimate', 'proposal', 'deployment', 'service', 'blocked'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded text-xs capitalize transition-colors whitespace-nowrap ${filter === f ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'} ${f === 'blocked' && filter === f ? 'text-rose-400' : ''}`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* V1 1E.1 — sort dropdown. Native select keeps the chrome
              calm and a11y-clean; the brief lists 4 sort options so we
              ship those four. */}
          <div className="ml-auto flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="bg-background border border-border rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="recent">Most recent</option>
                <option value="value">Highest value</option>
                <option value="name">Alphabetical</option>
                <option value="nextAction">By next action date</option>
              </select>
            </label>

            <div className="flex items-center border border-border rounded-md p-0.5 bg-background">
              <button onClick={() => setView('grid')} title="Grid" className={`p-1 rounded ${view === 'grid' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
              <button onClick={() => setView('list')} title="List" className={`p-1 rounded ${view === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}><ListIcon className="w-3.5 h-3.5" /></button>
              <button onClick={() => setView('kanban')} title="Kanban" className={`p-1 rounded ${view === 'kanban' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}><Columns3 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg bg-card/50 py-16 px-6 text-center max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-xl bg-secondary/60 inline-flex items-center justify-center mb-4">
              <Plus className="w-5 h-5 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium">No projects yet</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Click New project to start a quote, intake, or site walk.</p>
            <Button size="sm" onClick={() => navigate('/intake/new')}>
              <Plus className="w-3.5 h-3.5 mr-1" />New project
            </Button>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((p) => {
              const phaseCfg = PHASES[p.phase];
              const qa = quickActionFor(p.phase, p.id);
              const h = healthTone(p.health);
              return (
                <div key={p.id} className="bg-card border border-border rounded-lg p-4 hover:border-border-strong transition-colors group">
                  {/* Card body — clicking anywhere except the action button
                      opens the project command center. The action button
                      jumps straight to the relevant phase tool. */}
                  <div className="cursor-pointer" onClick={() => navigate(`/project/${p.id}`)}>
                    <div className="flex items-start justify-between mb-3">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${phaseCfg.tone.outline}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${phaseCfg.tone.dot}`} />
                        {phaseCfg.label}
                      </span>
                      <span className={`text-[11px] ${h.cls}`}>{h.label}</span>
                    </div>
                    <h3 className="text-base font-medium leading-tight">{p.name}</h3>
                    {p.customerId ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/account/${p.customerId}`); }}
                        className="text-xs text-muted-foreground mt-0.5 hover:text-primary hover:underline text-left"
                      >
                        {p.client}
                      </button>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.client}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{p.address}</span>
                    </p>

                    {p.nextAction && (
                      <div className="mt-3 px-2.5 py-2 rounded bg-secondary/30 border border-border/50">
                        <div className="text-[11px] text-muted-foreground mb-0.5">Next action</div>
                        <div className="text-xs text-foreground leading-snug">{p.nextAction}</div>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{p.devices} devices</span>
                      {p.ownerName && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.ownerName}</span>}
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{p.updated}</span>
                    </div>
                    <div className="mt-2.5 h-1 bg-secondary/60 rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>

                  {/* Phase-aware primary action — opens the page that matches
                      the current lifecycle step (canvas for engineering,
                      estimate for estimate phase, portal for review, etc.) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(qa.href); }}
                    className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                  >
                    {qa.label}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : view === 'kanban' ? (
          // V1 1E.1 — kanban view. Columns by lifecycle phase (Lead →
          // Live), one card per project in the column. Drag-to-reorder
          // / drag-between-columns is a follow-up; for V1 the kanban
          // makes the pipeline glanceable at a project level.
          <KanbanBoard projects={filtered} onOpen={(id) => navigate(`/project/${id}`)} />
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Project</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Devices</th>
                  <th className="text-left px-4 py-2 font-medium">Team</th>
                  <th className="text-left px-4 py-2 font-medium">Progress</th>
                  <th className="text-left px-4 py-2 font-medium">Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="border-t border-border cursor-pointer hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.client}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${PHASES[p.phase].tone.outline}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${PHASES[p.phase].tone.dot}`} />
                        {PHASES[p.phase].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.devices}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.team}</td>
                    <td className="px-4 py-3 w-40">
                      <div className="h-1 bg-secondary/60 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.updated}</td>
                    <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {projects.length > 0 && filtered.length === 0 && (
          <div className="text-center py-20 text-sm text-muted-foreground">
            No projects match. <button onClick={() => { setQ(''); setFilter('all'); }} className="text-primary hover:underline">Clear filters</button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────
// KanbanBoard — phase-grouped columns of project cards. V1 1E.1
// ships read-only (no drag); phase changes happen from the project
// detail screen for now. Columns mirror the canonical PHASES order.
// ─────────────────────────────────────────────────────────────────
function KanbanBoard({ projects, onOpen }: { projects: Project[]; onOpen: (id: string) => void }) {
  // Bucket the lifecycle phases into the same six the filter row uses,
  // so the kanban columns match the filters the user already knows.
  const COLUMNS: { id: string; label: string; phases: LifecyclePhase[] }[] = [
    { id: 'sales',       label: 'Sales',        phases: ['lead', 'discovery', 'walk_scheduled'] },
    { id: 'survey',      label: 'Survey',       phases: ['survey'] },
    { id: 'engineering', label: 'Engineering',  phases: ['engineering'] },
    { id: 'estimate',    label: 'Estimate',     phases: ['estimate'] },
    { id: 'proposal',    label: 'Proposal',     phases: ['proposal', 'customer_review', 'approved'] },
    { id: 'deployment',  label: 'Deployment',   phases: ['deployment', 'commissioning'] },
    { id: 'service',     label: 'Service',      phases: ['completed', 'managed_service', 'support'] },
  ];
  const columnFor = (phase: LifecyclePhase) =>
    COLUMNS.find((c) => c.phases.includes(phase))?.id ?? 'sales';
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2">
      {COLUMNS.map((col) => {
        const items = projects.filter((p) => columnFor(p.phase) === col.id);
        return (
          <div key={col.id} className="shrink-0 w-[260px] bg-secondary/30 border border-border/60 rounded-lg flex flex-col">
            <div className="px-3 py-2 flex items-center justify-between text-[11px] uppercase tracking-[0.10em] text-muted-foreground border-b border-border/60">
              <span className="font-medium">{col.label}</span>
              <span className="tabular-nums">{items.length}</span>
            </div>
            <div className="flex-1 p-2 space-y-2 min-h-[120px]">
              {items.length === 0 ? (
                <div className="text-[11px] text-muted-foreground/70 text-center py-6">Empty</div>
              ) : (
                items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onOpen(p.id)}
                    className="w-full text-left bg-card hover:bg-card/90 border border-border rounded-md p-2.5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium leading-tight truncate">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate mt-0.5">{p.client}</div>
                      </div>
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${PHASES[p.phase].tone.dot}`} />
                    </div>
                    {p.nextAction && (
                      <div className="text-[10px] text-muted-foreground line-clamp-1 mt-1">{p.nextAction}</div>
                    )}
                    <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                      <span>{p.devices} device{p.devices === 1 ? '' : 's'}</span>
                      {p.contractValue ? (
                        <span className="tabular-nums">${(p.contractValue / 1000).toFixed(0)}k</span>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
