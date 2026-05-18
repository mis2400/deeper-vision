// Dashboard — /dashboard
//
// Default landing surface after login. Six sections: Today, Pipeline,
// Projects, Team, Integrations, Customer Operations. Each section is
// store-backed where data exists; any section that would otherwise sit
// empty is clearly labeled as a placeholder rather than faked into
// looking active.

import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { IntegrationCard } from '../components/ui/dv';
import {
  Calendar, Briefcase, Users, Link as LinkIcon, MessageCircle,
  ArrowRight, ChevronRight, CheckCircle2, Clock, AlertTriangle,
  Activity as ActivityIcon, DollarSign, Building2, Sparkles, HardHat,
} from 'lucide-react';
import { useProjectStore, STAGE_PROBABILITY, deriveWorkOrders } from '../store/projectStore';
import { PHASES, healthTone } from '../lifecycle/phases';
import type { LifecyclePhase, Task, Opportunity, Project, WorkOrder } from '../store/types';

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

  // V1 2A.2 — broadcast dashboard context to the AI Assistant.
  // Dashboard is cross-project by definition, so we clear first to
  // shed any stale project/floor scope from a prior surface, then
  // stamp the surface name.
  const setAssistantContext = useProjectStore((s) => s.setAssistantContext);
  useEffect(() => {
    setAssistantContext(null);
    setAssistantContext({ surface: 'dashboard' });
  }, [setAssistantContext]);

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

  // V1 4B — My open work orders across every project. Filters to the
  // operator's assignedTo when present; otherwise treats unassigned
  // open WOs as available pickups.
  const state = useProjectStore((s) => s);
  const myOpenWOs = useMemo(() => {
    const out: Array<{ wo: WorkOrder; projectId: string; projectName: string }> = [];
    for (const p of projects) {
      const wos = deriveWorkOrders(state, p.id);
      for (const wo of wos) {
        if (wo.progress.status === 'complete') continue;
        const mine = wo.progress.assignedTo === DEMO_USER_ID
          || wo.progress.assignedTo === 'mei'
          || (wo.progress.assignedTo == null && wo.progress.status !== 'blocked');
        if (mine) out.push({ wo, projectId: p.id, projectName: p.name });
      }
    }
    return out.sort((a, b) => {
      // Blocked first, then by status ordering, then by project name.
      const order: Record<string, number> = { blocked: 0, 'on-site': 1, installing: 2, testing: 3, assigned: 4, ready: 5 };
      return (order[a.wo.progress.status] ?? 9) - (order[b.wo.progress.status] ?? 9);
    }).slice(0, 8);
  }, [projects, state]);

  // V1 4B — Next 7 days: tasks + work-order dueDates due in the
  // forward window, grouped by day. Honest derivation — only
  // surfaces items the store actually has dates on.
  const weekItems = useMemo(() => {
    const now = Date.now();
    const horizon = now + 7 * 86_400_000;
    type Item = { kind: 'task' | 'project'; id: string; label: string; subtitle?: string; due: number; href?: string };
    const items: Item[] = [];
    for (const t of Object.values(tasksMap)) {
      if (t.status !== 'open' || t.assignedUserId !== DEMO_USER_ID) continue;
      if (!t.dueDate || t.dueDate > horizon) continue;
      items.push({
        kind: 'task',
        id: t.id,
        label: t.title,
        subtitle: t.customerId ? customersMap[t.customerId]?.companyName : undefined,
        due: t.dueDate,
        href: t.customerId ? `/account/${t.customerId}` : '/crm',
      });
    }
    for (const p of projects) {
      if (!p.dueDate || p.dueDate > horizon) continue;
      items.push({
        kind: 'project',
        id: p.id,
        label: `${p.name} · ${p.nextAction ?? 'next action'}`,
        subtitle: p.customerId ? customersMap[p.customerId]?.companyName : undefined,
        due: p.dueDate,
        href: `/project/${p.id}`,
      });
    }
    return items.sort((a, b) => a.due - b.due);
  }, [tasksMap, projects, customersMap]);

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
              label="Open work orders"
              value={String(myOpenWOs.length)}
              hint={myOpenWOs.filter((w) => w.wo.progress.status === 'blocked').length > 0 ? `${myOpenWOs.filter((w) => w.wo.progress.status === 'blocked').length} blocked` : 'Across every project'}
              tone={myOpenWOs.filter((w) => w.wo.progress.status === 'blocked').length > 0 ? 'amber' : 'neutral'}
              onClick={() => navigate('/projects')}
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
                    <div className="truncate text-foreground">{a.message}</div>
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
                    <div className="text-sm text-foreground truncate">{t.summary}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {customersMap[t.customerId]?.companyName ?? '—'} · {t.userName ?? 'You'} · {timeAgo(t.occurredAt)}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </Section>

        {/* ── My day (Phase 4B) ──────────────────────────────────── */}
        <Section
          icon={<HardHat className="w-3.5 h-3.5" />}
          title="My day"
          hint="What you own across every project"
        >
          <div className="grid grid-cols-3 gap-3">
            {/* AI Assistant entry point */}
            <button
              onClick={() => navigate('/ai/p1')}
              className="rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors p-3 text-left"
              data-testid="dashboard-ai-entry"
            >
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-[12px] uppercase tracking-[0.10em]">AI Assistant</span>
              </div>
              <div className="text-[14px] font-medium mt-1.5">Ask grounded questions</div>
              <div className="text-[11.5px] text-muted-foreground mt-0.5">
                Coverage gaps, BOM totals, PoE budgets, blocked work orders. Cites the records it draws from.
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-primary">
                Open Assistant <ArrowRight className="w-3 h-3" />
              </div>
            </button>

            {/* This week */}
            <Card title="This week" cta={weekItems.length > 0 ? { label: `${weekItems.length} item${weekItems.length === 1 ? '' : 's'}`, onClick: () => navigate('/projects') } : undefined}>
              {weekItems.length === 0 ? (
                <Empty>Nothing scheduled in the next 7 days.</Empty>
              ) : weekItems.slice(0, 5).map((it) => (
                <button
                  key={`${it.kind}-${it.id}`}
                  onClick={() => it.href && navigate(it.href)}
                  className="w-full text-left px-3 py-2 border-b border-border/40 last:border-b-0 hover:bg-secondary/30 transition-colors flex items-start gap-2.5"
                >
                  <div className="flex flex-col items-center shrink-0 w-9">
                    <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground">
                      {new Date(it.due).toLocaleDateString(undefined, { weekday: 'short' })}
                    </div>
                    <div className="text-[14px] font-medium tabular-nums leading-none">
                      {new Date(it.due).getDate()}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-foreground truncate">{it.label}</div>
                    {it.subtitle && <div className="text-[10.5px] text-muted-foreground truncate">{it.subtitle}</div>}
                  </div>
                </button>
              ))}
            </Card>

            {/* My work orders */}
            <Card title="My open work orders" cta={myOpenWOs.length > 0 ? { label: 'Deployment', onClick: () => navigate(`/project/${myOpenWOs[0].projectId}/deployment`) } : undefined}>
              {myOpenWOs.length === 0 ? (
                <Empty>No open work orders assigned to you.</Empty>
              ) : myOpenWOs.slice(0, 5).map(({ wo, projectId, projectName }) => {
                const blocked = wo.progress.status === 'blocked';
                return (
                  <button
                    key={wo.id}
                    onClick={() => navigate(`/project/${projectId}/deployment`)}
                    className="w-full text-left px-3 py-2 border-b border-border/40 last:border-b-0 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${blocked ? 'bg-rose-500' : 'bg-primary/70'} shrink-0`} />
                      <span className="text-[12.5px] text-foreground truncate flex-1">{wo.title}</span>
                      <span className={`text-[10px] uppercase tracking-[0.10em] ${blocked ? 'text-rose-600' : 'text-muted-foreground'}`}>{wo.progress.status}</span>
                    </div>
                    <div className="text-[10.5px] text-muted-foreground truncate mt-0.5">{projectName}{wo.location ? ` · ${wo.location}` : ''}</div>
                  </button>
                );
              })}
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
                          <span className="text-sm text-foreground truncate flex-1">{p.name}</span>
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
                  <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-[11px] text-foreground font-medium shrink-0">
                    {userId.replace(/^u-/, '').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground capitalize">{userId.replace(/^u-/, '')}</div>
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
          hint="CRM · ERP · accounting · calendar · manufacturer ecosystems"
        >
          {(() => {
            // Text-mark logo cards. Real trademarked logos aren't shipped
            // with the repo; we use the manufacturer's recognisable initials
            // in their own brand color so the cards still read like a known
            // vendor at a glance instead of a generic gray box. Status is
            // honest — nothing is wired to a live API yet.
            const integrations: Array<{
              mark: string; color: string; name: string; category: string;
              status: 'connected' | 'available' | 'attention' | 'syncing';
              lastSync?: string; objectCount?: string;
            }> = [
              { mark: 'HS', color: '#FF7A59', name: 'HubSpot',           category: 'CRM',                        status: 'available' },
              { mark: 'SF', color: '#00A1E0', name: 'Salesforce',        category: 'CRM',                        status: 'available' },
              { mark: 'Q3', color: '#7C3AED', name: 'Q360',              category: 'ERP · Integrator suite',     status: 'available' },
              { mark: 'QB', color: '#2CA01C', name: 'QuickBooks',        category: 'Accounting',                 status: 'available' },
              { mark: 'NS', color: '#1A6BBA', name: 'NetSuite',          category: 'Accounting / ERP',           status: 'available' },
              { mark: 'O',  color: '#0078D4', name: 'Microsoft Outlook', category: 'Calendar / mail',            status: 'available' },
              { mark: 'GC', color: '#4285F4', name: 'Google Calendar',   category: 'Calendar',                   status: 'available' },
              { mark: 'VK', color: '#3B82F6', name: 'Verkada',           category: 'Cloud video / access',       status: 'available' },
              { mark: 'AX', color: '#E60028', name: 'Axis',              category: 'Cameras · on-prem',          status: 'available' },
              { mark: 'AL', color: '#F08F3C', name: 'Avigilon Alta',     category: 'Cloud video',                status: 'available' },
              { mark: 'GE', color: '#0EA5E9', name: 'Genetec',           category: 'Security Center · on-prem',  status: 'available' },
              { mark: 'MS', color: '#5B6CFF', name: 'Milestone',         category: 'XProtect · on-prem VMS',     status: 'available' },
            ];
            return (
              <div className="grid grid-cols-4 gap-3">
                {integrations.map((i) => (
                  <IntegrationCard
                    key={i.name}
                    mark={i.mark}
                    markColor={i.color}
                    name={i.name}
                    category={i.category}
                    status={i.status}
                    lastSync={i.lastSync}
                    objectCount={i.objectCount}
                  />
                ))}
              </div>
            );
          })()}
          <div className="mt-3 text-[11px] text-muted-foreground">
            Connect or manage integrations from <button onClick={() => navigate('/settings')} className="text-primary hover:underline">Settings → Integrations</button>.
          </div>
        </Section>

        {/* ── Customer operations ─────────────────────────────────
            Only the managed_service count is grounded in real data
            right now; tickets / warranties / maintenance visits
            ship as their own surfaces in later phases (4O / 4P).
            Per the honesty contract we don't render labeled-future
            placeholders here. */}
        {(projectsByPhase.managed_service?.length ?? 0) > 0 && (
          <Section
            icon={<MessageCircle className="w-3.5 h-3.5" />}
            title="Customer operations"
            hint="Managed service"
          >
            <div className="grid grid-cols-4 gap-3">
              <StatCard
                label="Managed accounts"
                value={String(projectsByPhase.managed_service?.length ?? 0)}
                hint="Projects in managed service"
                tone="neutral"
                onClick={() => navigate('/projects')}
              />
            </div>
          </Section>
        )}
      </div>
    </AppShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2.5">
        <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground tracking-tight">
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
  const toneCls = tone === 'amber' ? 'text-amber-400' : tone === 'green' ? 'text-emerald-400' : tone === 'muted' ? 'text-muted-foreground/70' : 'text-foreground';
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
        <div className="text-[12.5px] font-medium text-foreground tracking-tight">{title}</div>
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
        <div className="text-sm text-foreground truncate">{task.title}</div>
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
