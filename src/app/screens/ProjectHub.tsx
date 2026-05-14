import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Search, Plus, MapPin, Users, Calendar, ChevronRight, LayoutGrid, List as ListIcon, RotateCcw, ArrowRight } from 'lucide-react';
import { useProjectStore, selectors as sel } from '../store/projectStore';
import { PHASES, quickActionFor, healthTone, progressPctFor } from '../lifecycle/phases';
import type { LifecyclePhase } from '../store/types';

interface Project {
  id: string;
  name: string;
  client: string;
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
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Live project list from the store. Counts (devices/team/etc.) are derived
  // from store entities so they tick up as the user adds objects on each
  // project's canvas.
  const storeProjects = useProjectStore((s) => sel.projectList(s));
  const storeCustomers = useProjectStore((s) => s.customers);
  const storeDevices = useProjectStore((s) => s.devices);
  const resetDemoData = useProjectStore((s) => s.resetDemoData);

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
    };
  }), [storeProjects, storeCustomers, storeDevices]);

  const filtered = projects.filter((p) => {
    if (filter === 'blocked') {
      if (p.health !== 'blocked' && p.health !== 'at_risk') return false;
    } else if (filter !== 'all') {
      if (!BUCKET_PHASES[filter].includes(p.phase)) return false;
    }
    if (q && !`${p.name} ${p.client} ${p.address}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <AppShell
      crumbs={[{ label: 'Projects' }]}
      actions={
        <div className="flex items-center gap-2">
          {/* Dev-only escape hatch: restore every project, device, lens, pathway
              and note back to the seed. Intentionally unobtrusive (ghost
              button, no glow) so it doesn't compete with primary actions. */}
          <button
            onClick={() => {
              if (confirm('Reset all demo data? Every change you’ve made — moved cameras, edited lens configs, drawn pathways, etc. — will be replaced with the original seed.')) {
                resetDemoData();
              }
            }}
            className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 px-2 py-1 rounded"
            title="Reset demo data"
          >
            <RotateCcw className="w-3 h-3" />
            Reset demo
          </button>
          <Button size="sm" onClick={() => navigate('/intake/new')}>
            <Plus className="w-3.5 h-3.5 mr-1" />New project
          </Button>
        </div>
      }
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">{filtered.length} of {projects.length} · live from project store</p>
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

          <div className="flex items-center border border-border rounded-md p-0.5 bg-background ml-auto">
            <button onClick={() => setView('grid')} className={`p-1 rounded ${view === 'grid' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
            <button onClick={() => setView('list')} className={`p-1 rounded ${view === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}><ListIcon className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {view === 'grid' ? (
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
                      <span className={`text-[10px] uppercase tracking-wider ${h.cls}`}>{h.label}</span>
                    </div>
                    <h3 className="text-base font-medium leading-tight">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.client}</p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{p.address}</span>
                    </p>

                    {p.nextAction && (
                      <div className="mt-3 px-2.5 py-2 rounded bg-secondary/30 border border-border/50">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Next action</div>
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

        {filtered.length === 0 && (
          <div className="text-center py-20 text-sm text-muted-foreground">
            No projects match. <button onClick={() => { setQ(''); setFilter('all'); }} className="text-primary hover:underline">Clear filters</button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
