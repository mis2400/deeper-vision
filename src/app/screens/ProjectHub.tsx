import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CircleDot,
  ClipboardList,
  DollarSign,
  FileSignature,
  HardHat,
  Layers3,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useProjectStore } from '../store/projectStore';
import { PHASES, quickActionFor, progressPctFor, healthTone } from '../lifecycle/phases';
import type { LifecyclePhase } from '../store/types';

type AnyRecord = Record<string, any>;
type Bucket = 'all' | 'sales' | 'survey' | 'engineering' | 'estimate' | 'proposal' | 'deployment' | 'service' | 'risk';

const BUCKETS: Array<{ id: Bucket; label: string; phases: LifecyclePhase[] }> = [
  { id: 'all', label: 'All', phases: [] },
  { id: 'sales', label: 'Sales', phases: ['lead', 'discovery', 'walk_scheduled'] },
  { id: 'survey', label: 'Survey', phases: ['survey'] },
  { id: 'engineering', label: 'Engineering', phases: ['engineering'] },
  { id: 'estimate', label: 'Estimate', phases: ['estimate'] },
  { id: 'proposal', label: 'Proposal', phases: ['proposal', 'customer_review', 'approved'] },
  { id: 'deployment', label: 'Deployment', phases: ['deployment', 'commissioning'] },
  { id: 'service', label: 'Service', phases: ['completed', 'managed_service', 'support'] },
  { id: 'risk', label: 'Risk', phases: [] },
];

export function ProjectHub() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<Bucket>('all');
  const projectsMap = useProjectStore((s) => s.projects);
  const customersMap = useProjectStore((s) => s.customers);
  const devicesMap = useProjectStore((s) => s.devices);
  const opportunitiesMap = useProjectStore((s) => s.opportunities);

  const devices = useMemo(() => Object.values((devicesMap || {}) as AnyRecord), [devicesMap]);
  const opportunities = useMemo(() => Object.values((opportunitiesMap || {}) as AnyRecord), [opportunitiesMap]);
  const projects = useMemo(() => {
    return Object.values((projectsMap || {}) as AnyRecord)
      .map((p) => {
        const customer = p.customerId ? (customersMap as AnyRecord)?.[p.customerId] : undefined;
        const address = customer?.addresses?.[0];
        const phase = (p.lifecyclePhase ?? 'engineering') as LifecyclePhase;
        const phaseCfg = PHASES[phase] ?? PHASES.engineering;
        const health = p.healthStatus ?? 'on_track';
        const projectDevices = devices.filter((d) => d.projectId === p.id);
        const openOpportunity = opportunities.find((o) => o.projectId === p.id || o.customerId === p.customerId);
        return {
          id: p.id,
          name: p.name ?? 'Untitled project',
          customer: customer?.companyName ?? 'No customer',
          address: address ? [address.street, address.city, address.state].filter(Boolean).join(' · ') : 'No address',
          phase,
          phaseLabel: phaseCfg.label,
          phaseShort: phaseCfg.shortLabel ?? phaseCfg.label,
          phaseTone: phaseCfg.tone,
          health,
          healthMeta: healthTone(health),
          progress: progressPctFor(phase),
          devices: projectDevices.length,
          nextAction: p.nextAction ?? '',
          updatedAt: p.updatedAt ?? 0,
          owner: p.assignedPMUserId ?? p.assignedEngineerUserId ?? p.assignedSalesUserId ?? p.assignedEstimatorUserId ?? '',
          value: p.contractValue ?? openOpportunity?.estValue ?? 0,
          dueDate: p.dueDate,
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projectsMap, customersMap, devices, opportunities]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const def = BUCKETS.find((b) => b.id === bucket) ?? BUCKETS[0];
    return projects.filter((p) => {
      if (bucket === 'risk' && !['blocked', 'at_risk'].includes(p.health)) return false;
      if (bucket !== 'all' && bucket !== 'risk' && !def.phases.includes(p.phase)) return false;
      if (!term) return true;
      return `${p.name} ${p.customer} ${p.address} ${p.phaseLabel} ${p.nextAction}`.toLowerCase().includes(term);
    });
  }, [projects, query, bucket]);

  const focusProject = filtered[0] ?? projects[0];
  const metrics = {
    total: projects.length,
    risk: projects.filter((p) => ['blocked', 'at_risk'].includes(p.health)).length,
    design: projects.filter((p) => ['survey', 'engineering', 'estimate'].includes(p.phase)).length,
    delivery: projects.filter((p) => ['proposal', 'customer_review', 'approved', 'deployment', 'commissioning'].includes(p.phase)).length,
  };

  return (
    <AppShell crumbs={[{ label: 'Projects' }]} fullBleed commandChrome>
      <div className="min-h-full overflow-auto" style={{ background: 'var(--command-bg)', color: 'var(--command-fg)' }}>
        <div className="mx-auto max-w-[1500px] px-6 py-5 space-y-5">
          <header className="rounded-2xl border overflow-hidden" style={{ background: 'var(--command-panel)', borderColor: 'var(--command-border-strong)', boxShadow: 'var(--command-shadow)' }}>
            <div className="p-5 border-b" style={{ borderColor: 'var(--command-border)' }}>
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--command-accent)' }}>
                    <Layers3 className="w-4 h-4" />
                    Project portfolio
                  </div>
                  <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight" style={{ color: 'var(--command-fg)' }}>
                    See every security job by where it is in the work.
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm" style={{ color: 'var(--command-muted)' }}>
                    Intake, survey, engineering, estimate, proposal, deployment, commissioning, and managed service are one pipeline.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--command-faint)' }} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search customer, project, address"
                      className="w-full h-10 rounded-xl border pl-9 pr-3 text-sm outline-none"
                      style={{ background: 'var(--command-panel-elevated)', borderColor: 'var(--command-border)', color: 'var(--command-fg)' }}
                    />
                  </div>
                  <button
                    onClick={() => navigate('/intake/new')}
                    className="h-10 inline-flex items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                    style={{ background: 'var(--command-accent)', color: 'var(--command-accent-foreground)' }}
                  >
                    <Plus className="w-4 h-4" />
                    New
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              <Metric icon={Building2} label="Projects" value={metrics.total} />
              <Metric icon={ShieldAlert} label="Risk" value={metrics.risk} alert={metrics.risk > 0} />
              <Metric icon={Video} label="Design queue" value={metrics.design} />
              <Metric icon={HardHat} label="Delivery queue" value={metrics.delivery} />
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr_390px] gap-5">
            <aside className="rounded-2xl border p-3 h-fit" style={{ background: 'var(--command-panel)', borderColor: 'var(--command-border)' }}>
              <div className="px-2 py-2 text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--command-faint)' }}>Workflow filters</div>
              <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
                {BUCKETS.map((b) => {
                  const active = bucket === b.id;
                  const count = b.id === 'all'
                    ? projects.length
                    : b.id === 'risk'
                      ? metrics.risk
                      : projects.filter((p) => b.phases.includes(p.phase)).length;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setBucket(b.id)}
                      className="rounded-xl border px-3 py-3 text-left transition-colors"
                      style={{
                        background: active ? 'color-mix(in oklab, var(--command-accent) 14%, transparent)' : 'var(--command-panel-elevated)',
                        borderColor: active ? 'color-mix(in oklab, var(--command-accent) 42%, var(--command-border))' : 'var(--command-border)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold" style={{ color: active ? 'var(--command-accent)' : 'var(--command-fg)' }}>{b.label}</span>
                        <span className="text-xs tabular-nums" style={{ color: 'var(--command-muted)' }}>{count}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <main className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--command-faint)' }}>Priority queue</div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--command-fg)' }}>{filtered.length} visible projects</div>
                </div>
              </div>
              {filtered.length === 0 ? (
                <div className="rounded-2xl border p-8 text-center" style={{ background: 'var(--command-panel)', borderColor: 'var(--command-border)', color: 'var(--command-muted)' }}>
                  No projects match this view.
                </div>
              ) : filtered.map((p) => {
                const action = quickActionFor(p.phase, p.id);
                return (
                  <article key={p.id} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--command-panel)', borderColor: 'var(--command-border)' }}>
                    <button onClick={() => navigate(`/project/${p.id}`)} className="w-full p-4 text-left">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: 'var(--command-border)', color: 'var(--command-accent)' }}>
                              <CircleDot className="w-3 h-3" />
                              {p.phaseLabel}
                            </span>
                            <span className={`text-xs ${p.healthMeta.cls}`}>{p.healthMeta.label}</span>
                          </div>
                          <h2 className="mt-3 text-xl font-semibold tracking-tight" style={{ color: 'var(--command-fg)' }}>{p.name}</h2>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: 'var(--command-muted)' }}>
                            <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{p.customer}</span>
                            <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{p.address}</span>
                          </div>
                          {p.nextAction && (
                            <div className="mt-3 rounded-xl border px-3 py-2 text-sm" style={{ background: 'var(--command-panel-elevated)', borderColor: 'var(--command-border)', color: 'var(--command-fg)' }}>
                              <span style={{ color: 'var(--command-faint)' }}>Next: </span>{p.nextAction}
                            </div>
                          )}
                        </div>
                        <div className="md:w-52 shrink-0">
                          <div className="grid grid-cols-2 gap-2">
                            <MiniStat label="Devices" value={p.devices} />
                            <MiniStat label="Value" value={money(p.value)} />
                          </div>
                          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--command-panel-elevated)' }}>
                            <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: 'var(--command-accent)' }} />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(action.href); }}
                            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
                            style={{ background: 'color-mix(in oklab, var(--command-cyan) 14%, transparent)', color: 'var(--command-cyan)' }}
                          >
                            {action.label} <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </button>
                  </article>
                );
              })}
            </main>

            <PortfolioRadar project={focusProject} onOpen={() => focusProject && navigate(`/project/${focusProject.id}`)} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function PortfolioRadar({ project, onOpen }: { project: any; onOpen: () => void }) {
  return (
    <aside className="rounded-2xl border overflow-hidden h-fit" style={{ background: 'var(--command-panel)', borderColor: 'var(--command-border)', boxShadow: 'var(--command-shadow)' }}>
      <div className="p-4 border-b" style={{ borderColor: 'var(--command-border)' }}>
        <div className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--command-faint)' }}>Portfolio radar</div>
        <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--command-fg)' }}>{project?.name ?? 'No project selected'}</div>
        <div className="mt-1 text-sm" style={{ color: 'var(--command-muted)' }}>{project?.customer ?? 'Select a project'}</div>
      </div>
      <button onClick={onOpen} className="relative block w-full h-[320px] text-left overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--command-panel), var(--command-bg))' }}>
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at center, color-mix(in oklab, var(--command-cyan) 24%, transparent) 0 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute left-8 right-8 top-10 bottom-16 rounded-2xl border" style={{ borderColor: 'var(--command-border)', background: 'var(--command-panel-elevated)' }}>
          <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: 'var(--command-border)' }} />
          <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: 'var(--command-border)' }} />
          <div className="absolute left-[15%] top-[18%] w-28 h-24 rounded-full" style={{ background: 'color-mix(in oklab, var(--command-cyan) 25%, transparent)' }} />
          <div className="absolute right-[12%] top-[25%] w-32 h-32 rounded-full" style={{ background: 'color-mix(in oklab, var(--command-accent) 19%, transparent)' }} />
          <div className="absolute left-[30%] bottom-[14%] w-40 h-24 rounded-full" style={{ background: 'color-mix(in oklab, var(--primary) 20%, transparent)' }} />
          <Video className="absolute left-[24%] top-[30%] w-5 h-5" style={{ color: 'var(--command-cyan)' }} />
          <FileSignature className="absolute right-[28%] top-[42%] w-5 h-5" style={{ color: 'var(--command-warning)' }} />
          <ClipboardList className="absolute left-[46%] bottom-[30%] w-5 h-5" style={{ color: 'var(--command-accent)' }} />
        </div>
        <div className="absolute left-5 right-5 bottom-5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--command-faint)' }}>{project?.phaseLabel ?? 'No phase'}</div>
            <div className="text-sm font-semibold" style={{ color: 'var(--command-fg)' }}>Open project command center</div>
          </div>
          <ArrowRight className="w-4 h-4" style={{ color: 'var(--command-accent)' }} />
        </div>
      </button>
    </aside>
  );
}

function Metric({ icon: Icon, label, value, alert = false }: { icon: any; label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--command-panel-elevated)', borderColor: alert ? 'color-mix(in oklab, var(--command-warning) 38%, var(--command-border))' : 'var(--command-border)' }}>
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4" style={{ color: alert ? 'var(--command-warning)' : 'var(--command-cyan)' }} />
        <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--command-fg)' }}>{value}</span>
      </div>
      <div className="mt-2 text-xs" style={{ color: 'var(--command-muted)' }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ background: 'var(--command-panel-elevated)', borderColor: 'var(--command-border)' }}>
      <div className="text-sm font-semibold tabular-nums" style={{ color: 'var(--command-fg)' }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--command-muted)' }}>{label}</div>
    </div>
  );
}

function money(value: number) {
  if (!value) return '—';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${value}`;
}
