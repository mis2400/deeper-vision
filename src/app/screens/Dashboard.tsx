// Dashboard — /dashboard
//
// Default landing surface after login. Six sections: Today, Pipeline,
// Projects, Team, Integrations, Customer Operations. Each section is
// store-backed where data exists; any section that would otherwise sit
// empty is clearly labeled as a placeholder rather than faked into
// looking active.

import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import {
  Calendar, Briefcase, Users, Link as LinkIcon, MessageCircle,
  ArrowRight, ChevronRight, CheckCircle2, Clock, AlertTriangle,
  Activity as ActivityIcon, DollarSign, Building2, Sparkles,
} from 'lucide-react';
import { useProjectStore, STAGE_PROBABILITY } from '../store/projectStore';
import { PHASES, healthTone } from '../lifecycle/phases';
import type { LifecyclePhase, Task, Opportunity, Project } from '../store/types';

export function Dashboard() {
  const navigate = useNavigate();

  // ── Store subscriptions ──
  const projectsMap      = useProjectStore((s) => s.projects);
  const opportunitiesMap = useProjectStore((s) => s.opportunities);
  const tasksMap         = useProjectStore((s) => s.tasks);
  const touchesMap       = useProjectStore((s) => s.touches);
  const customersMap     = useProjectStore((s) => s.customers);
  const activityMap      = useProjectStore((s) => s.activity);
  const currentRole      = useProjectStore((s) => s.currentRole);

  // Demo user identity — until real auth lands, "Mei L." is the
  // assigned user for tasks/touches. Keeps the dashboard meaningfully
  // populated rather than empty.
  const DEMO_USER_ID = 'u-mei';

  // ── Derived data ──
  const projects = useMemo(() =>
    Object.values(projectsMap).sort((a, b) => b.updatedAt - a.updatedAt),
    [projectsMap]);

  const projectsByPhase = useMemo(() => {
    const buckets: Partial<Record<LifecyclePhase, Project[]>> = {};
    for (const p of projects) {
      (buckets[p.lifecyclePhase] ??= []).push(p);
    }
    return buckets;
  }, [projects]);

  const myOpenTasks = useMemo(() =>
    Object.values(tasksMap)
      .filter((t) => t.status === 'open' && t.assignedUserId === DEMO_USER_ID)
      .sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity)),
    [tasksMap]);

  const overdueCount = myOpenTasks.filter((t) => t.dueDate != null && t.dueDate < Date.now()).length;

  const pipelineSummary = useMemo(() => {
    const all = Object.values(opportunitiesMap);
    let open = 0, weighted = 0, openCount = 0, wonThisQuarter = 0;
    const qStart = quarterStart(Date.now());
    for (const o of all) {
      if (o.stage === 'won' && o.closedAt && o.closedAt >= qStart) wonThisQuarter += o.estValue ?? 0;
      if (o.stage === 'won' || o.stage === 'lost') continue;
      open += o.estValue ?? 0;
      weighted += (o.estValue ?? 0) * (o.probability ?? STAGE_PROBABILITY[o.stage]);
      openCount += 1;
    }
    return { open, weighted, openCount, wonThisQuarter };
  }, [opportunitiesMap]);

  const proposalsOut = useMemo(() =>
    Object.values(opportunitiesMap).filter((o) => o.stage === 'proposing' || o.stage === 'negotiating'),
    [opportunitiesMap]);

  const recentActivity = useMemo(() =>
    Object.values(activityMap).sort((a, b) => b.createdAt - a.createdAt).slice(0, 6),
    [activityMap]);

  const recentTouches = useMemo(() =>
    Object.values(touchesMap).sort((a, b) => b.occurredAt - a.occurredAt).slice(0, 5),
    [touchesMap]);

  return (
    <AppShell
      crumbs={[{ label: 'Dashboard' }]}
      title="Dashboard"
      subtitle={`${greeting()} · You have ${myOpenTasks.length} open task${myOpenTasks.length === 1 ? '' : 's'}${overdueCount ? `, ${overdueCount} overdue` : ''}`}
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/crm')}>
            Sales pipeline
          </Button>
          <Button size="sm" onClick={() => navigate('/projects')}>
            All projects <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      }
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">

        {/* ── Today ──────────────────────────────────────────────── */}
        <Section
          icon={<Calendar className="w-3.5 h-3.5" />}
          title="Today"
          hint="What needs your attention now"
        >
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Open tasks"
              value={String(myOpenTasks.length)}
              hint={overdueCount ? `${overdueCount} overdue` : 'All on track'}
              tone={overdueCount ? 'amber' : 'neutral'}
              onClick={() => navigate('/crm')}
            />
            <StatCard
              label="Active deployments"
              value={String((projectsByPhase.deployment?.length ?? 0) + (projectsByPhase.commissioning?.length ?? 0))}
              hint="Deployment + commissioning"
              tone="neutral"
              onClick={() => navigate('/projects')}
            />
            <StatCard
              label="Proposals out"
              value={String(proposalsOut.length)}
              hint="Awaiting customer review"
              tone="neutral"
              onClick={() => navigate('/crm')}
            />
            <StatCard
              label="Site walks"
              value="0"
              hint="Calendar integration · placeholder"
              tone="muted"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <Card title="My open tasks" cta={{ label: 'Pipeline', onClick: () => navigate('/crm') }}>
              {myOpenTasks.length === 0 ? (
                <Empty>All caught up.</Empty>
              ) : myOpenTasks.slice(0, 5).map((t) => (
                <TaskRow key={t.id} task={t} customerName={t.customerId ? customersMap[t.customerId]?.companyName : undefined}
                  onOpen={() => t.customerId && navigate(`/account/${t.customerId}`)}
                />
              ))}
            </Card>
            <Card title="Recent activity" cta={{ label: 'All projects', onClick: () => navigate('/projects') }}>
              {recentActivity.length === 0 ? (
                <Empty>No recent activity.</Empty>
              ) : recentActivity.map((a) => (
                <div key={a.id} className="px-3 py-2 border-b border-border/40 last:border-b-0 flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 bg-primary/70 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-slate-100">{a.message}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {a.userName ?? 'System'} · {timeAgo(a.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </Section>

        {/* ── Pipeline ───────────────────────────────────────────── */}
        <Section
          icon={<DollarSign className="w-3.5 h-3.5" />}
          title="Pipeline"
          hint="Sales motion"
        >
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Open pipeline" value={money(pipelineSummary.open)} hint={`${pipelineSummary.openCount} deals`} tone="neutral" onClick={() => navigate('/crm')} />
            <StatCard label="Weighted forecast" value={money(pipelineSummary.weighted)} hint="Probability × value" tone="neutral" />
            <StatCard label="Won this quarter" value={money(pipelineSummary.wonThisQuarter)} hint="Closed-won contract value" tone="green" />
            <StatCard label="Proposals out" value={String(proposalsOut.length)} hint="Proposing + negotiating" tone="neutral" />
          </div>

          <div className="mt-4">
            <Card title="Recent customer touches" cta={{ label: 'Pipeline', onClick: () => navigate('/crm') }}>
              {recentTouches.length === 0 ? (
                <Empty>No touches logged yet.</Empty>
              ) : recentTouches.map((t) => (
                <div key={t.id} className="px-3 py-2 border-b border-border/40 last:border-b-0 flex items-start gap-2.5">
                  <span className="text-[10px] uppercase tracking-tight text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded mt-0.5 shrink-0">{t.type}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-100 truncate">{t.summary}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {customersMap[t.customerId]?.companyName ?? '—'} · {t.userName ?? 'You'} · {timeAgo(t.occurredAt)}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </Section>

        {/* ── Projects ───────────────────────────────────────────── */}
        <Section
          icon={<Briefcase className="w-3.5 h-3.5" />}
          title="Projects"
          hint="By lifecycle phase"
        >
          <div className="grid grid-cols-3 gap-3">
            {(['engineering', 'estimate', 'proposal', 'deployment', 'commissioning', 'managed_service'] as LifecyclePhase[]).map((phase) => {
              const list = projectsByPhase[phase] ?? [];
              const cfg = PHASES[phase];
              return (
                <Card key={phase} title={cfg.label} cta={list.length > 0 ? { label: `${list.length} project${list.length === 1 ? '' : 's'}`, onClick: () => navigate('/projects') } : undefined}>
                  {list.length === 0 ? (
                    <Empty>—</Empty>
                  ) : list.slice(0, 3).map((p) => {
                    const customer = p.customerId ? customersMap[p.customerId] : undefined;
                    const h = healthTone(p.healthStatus);
                    return (
                      <button
                        key={p.id}
                        onClick={() => navigate(`/project/${p.id}`)}
                        className="w-full text-left px-3 py-2 border-b border-border/40 last:border-b-0 hover:bg-secondary/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.tone.dot}`} />
                          <span className="text-sm text-slate-100 truncate flex-1">{p.name}</span>
                          <span className={`text-[10px] ${h.cls}`}>{h.label}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {customer?.companyName ?? '—'}{p.nextAction ? ` · ${p.nextAction}` : ''}
                        </div>
                      </button>
                    );
                  })}
                </Card>
              );
            })}
          </div>
        </Section>

        {/* ── Team ───────────────────────────────────────────────── */}
        <Section
          icon={<Users className="w-3.5 h-3.5" />}
          title="Team"
          hint="Workload across the integrator"
        >
          <Card title="Assignments by user" cta={undefined}>
            {(() => {
              const byUser: Record<string, { tasks: number; projects: number }> = {};
              for (const t of Object.values(tasksMap)) {
                if (t.status !== 'open' || !t.assignedUserId) continue;
                (byUser[t.assignedUserId] ??= { tasks: 0, projects: 0 }).tasks += 1;
              }
              for (const p of projects) {
                const owners = [p.assignedSalesUserId, p.assignedEngineerUserId, p.assignedEstimatorUserId, p.assignedPMUserId].filter(Boolean) as string[];
                for (const u of owners) {
                  (byUser[u] ??= { tasks: 0, projects: 0 }).projects += 1;
                }
              }
              const entries = Object.entries(byUser).sort((a, b) => (b[1].tasks + b[1].projects) - (a[1].tasks + a[1].projects));
              if (entries.length === 0) return <Empty>No assignments yet.</Empty>;
              return entries.map(([userId, w]) => (
                <div key={userId} className="px-3 py-2 border-b border-border/40 last:border-b-0 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-[11px] text-slate-100 font-medium shrink-0">
                    {userId.replace(/^u-/, '').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-100 capitalize">{userId.replace(/^u-/, '')}</div>
                    <div className="text-[11px] text-muted-foreground">{w.projects} project{w.projects === 1 ? '' : 's'} · {w.tasks} open task{w.tasks === 1 ? '' : 's'}</div>
                  </div>
                </div>
              ));
            })()}
          </Card>
        </Section>

        {/* ── Integrations ───────────────────────────────────────── */}
        <Section
          icon={<LinkIcon className="w-3.5 h-3.5" />}
          title="Integrations"
          hint="External systems · none connected yet"
        >
          <div className="grid grid-cols-4 gap-3">
            {[
              { vendor: 'HubSpot', category: 'CRM' },
              { vendor: 'Salesforce', category: 'CRM' },
              { vendor: 'Q360', category: 'ERP' },
              { vendor: 'QuickBooks', category: 'Accounting' },
              { vendor: 'Microsoft 365', category: 'Calendar / Storage' },
              { vendor: 'Google Workspace', category: 'Calendar / Storage' },
              { vendor: 'Verkada Command', category: 'Manufacturer · cloud' },
              { vendor: 'Axis Communications', category: 'Manufacturer · on-prem' },
              { vendor: 'Avigilon Alta', category: 'Manufacturer · cloud' },
              { vendor: 'Genetec Security Center', category: 'Manufacturer · on-prem' },
              { vendor: 'Milestone XProtect', category: 'Manufacturer · on-prem' },
              { vendor: 'Brivo', category: 'Access · cloud' },
            ].map((i) => (
              <div key={i.vendor} className="bg-card border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[12.5px] font-medium text-slate-100">{i.vendor}</div>
                  <span className="text-[10px] text-muted-foreground/70 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                    Not connected
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">{i.category}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground italic">
            Integration substrate is in the data layer (external IDs, sync state, mapping). No vendor is live yet — connection flows are a labeled placeholder.
          </div>
        </Section>

        {/* ── Customer Operations ───────────────────────────────── */}
        <Section
          icon={<MessageCircle className="w-3.5 h-3.5" />}
          title="Customer operations"
          hint="Service · warranties · lifecycle"
        >
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Open tickets" value="0" hint="Tickets module is a labeled future" tone="muted" />
            <StatCard label="Warranty expirations" value="0" hint="90-day lookahead · future" tone="muted" />
            <StatCard label="Managed accounts" value={String(projectsByPhase.managed_service?.length ?? 0)} hint="Projects in managed service" tone="neutral" />
            <StatCard label="Maintenance visits" value="0" hint="Recurring schedule · future" tone="muted" />
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground italic">
            Service and ticketing are a future module. The asset registry and warranty fields exist on closed-out devices; ticket intake UI is not built yet.
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2.5">
        <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-100 tracking-tight">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </div>
        {hint && <div className="text-[11px] text-muted-foreground">· {hint}</div>}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, hint, tone, onClick }: { label: string; value: string; hint?: string; tone?: 'neutral' | 'amber' | 'green' | 'muted'; onClick?: () => void }) {
  const toneCls = tone === 'amber' ? 'text-amber-400' : tone === 'green' ? 'text-emerald-400' : tone === 'muted' ? 'text-muted-foreground/70' : 'text-slate-100';
  const interactive = !!onClick;
  return (
    <button
      onClick={onClick}
      disabled={!interactive}
      className={`bg-card border border-border rounded-lg p-3 text-left ${interactive ? 'hover:border-border-strong transition-colors cursor-pointer' : 'cursor-default'}`}
    >
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className={`text-xl font-medium mt-1 tabular-nums ${toneCls}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </button>
  );
}

function Card({ title, cta, children }: { title: string; cta?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/70 flex items-center justify-between">
        <div className="text-[12.5px] font-medium text-slate-100 tracking-tight">{title}</div>
        {cta && (
          <button onClick={cta.onClick} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            {cta.label}<ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function TaskRow({ task, customerName, onOpen }: { task: Task; customerName?: string; onOpen: () => void }) {
  const overdue = task.dueDate != null && task.dueDate < Date.now();
  return (
    <button onClick={onOpen} className="w-full text-left px-3 py-2 border-b border-border/40 last:border-b-0 hover:bg-secondary/30 transition-colors flex items-start gap-2">
      <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-slate-100 truncate">{task.title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1.5">
          {customerName && <span className="truncate max-w-[140px]">{customerName}</span>}
          {task.dueDate && (
            <span className={overdue ? 'text-amber-400' : ''}>
              <Clock className="w-2.5 h-2.5 inline mr-0.5" />
              {overdue ? 'Overdue · ' : ''}{shortDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3 text-[11.5px] text-muted-foreground/70">{children}</div>;
}

// ─── helpers ──────────────────────────────────────────────────────

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n.toLocaleString('en-US')}`;
}
function quarterStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime();
}
function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function timeAgo(ms: number): string {
  const d = Date.now() - ms;
  const sec = Math.floor(d / 1000); if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60); if (min < 60) return `${min}m ago`;
  const hr  = Math.floor(min / 60); if (hr < 24)  return `${hr}h ago`;
  const days = Math.floor(hr / 24); return `${days}d ago`;
}
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
