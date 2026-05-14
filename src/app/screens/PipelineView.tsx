// Sales pipeline — /crm
//
// The CRM entry point. Opportunities arrayed by stage (kanban), with a
// pipeline-summary header (open $, weighted forecast, wins this quarter) and
// a "my open tasks" rail. Each opportunity card surfaces customer, value,
// owner, expected close, and a stage selector that mutates the store live.
//
// This is the first screen in the lifecycle that lives BEFORE a project
// exists. Closed-won opportunities can be one-click converted into a project
// shell via the "Convert to project" action — the moment the lifecycle
// crosses from sales into delivery.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import {
  Plus, Building2, Calendar, DollarSign, AlertCircle, CheckCircle2, Clock,
  ArrowRight, ChevronRight, Filter,
} from 'lucide-react';
import { useProjectStore, STAGE_PROBABILITY } from '../store/projectStore';
import type { OpportunityStage, Opportunity, Task } from '../store/types';

/** Display order + label for every opportunity stage. */
const STAGE_META: Record<OpportunityStage, { label: string; tone: string; dot: string }> = {
  inquiry:     { label: 'Inquiry',     tone: 'text-slate-300 border-slate-600/60',   dot: 'bg-slate-400' },
  qualified:   { label: 'Qualified',   tone: 'text-blue-300 border-blue-500/40',     dot: 'bg-blue-400' },
  discovery:   { label: 'Discovery',   tone: 'text-cyan-300 border-cyan-500/40',     dot: 'bg-cyan-400' },
  proposing:   { label: 'Proposing',   tone: 'text-violet-300 border-violet-500/40', dot: 'bg-violet-400' },
  negotiating: { label: 'Negotiating', tone: 'text-amber-300 border-amber-500/40',   dot: 'bg-amber-400' },
  won:         { label: 'Won',         tone: 'text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400' },
  lost:        { label: 'Lost',        tone: 'text-rose-300 border-rose-500/40',     dot: 'bg-rose-400' },
  on_hold:     { label: 'On hold',     tone: 'text-zinc-300 border-zinc-500/40',     dot: 'bg-zinc-400' },
};

/** Stages shown in the Kanban grid. Won/Lost/On-hold get their own row. */
const KANBAN_STAGES: OpportunityStage[] = ['inquiry', 'qualified', 'discovery', 'proposing', 'negotiating'];
const CLOSED_STAGES: OpportunityStage[] = ['won', 'lost', 'on_hold'];

export function PipelineView() {
  const navigate = useNavigate();

  // Subscribe to raw maps — derive in useMemo. Same pattern as ProjectHub.
  const opportunitiesMap = useProjectStore((s) => s.opportunities);
  const customersMap     = useProjectStore((s) => s.customers);
  const tasksMap         = useProjectStore((s) => s.tasks);
  const setOppStage      = useProjectStore((s) => s.setOpportunityStage);
  const convertOpp       = useProjectStore((s) => s.convertOpportunityToProject);
  const completeTask     = useProjectStore((s) => s.completeTask);

  // Pipeline summary derived in component — pipelineSummary selector is pure.
  const summary = useMemo(() => {
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

  // Filter: all vs by-owner. Keep simple — only "My deals" toggles to u-mei
  // for the demo. Real impl would resolve current user.
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine'>('all');
  const DEMO_USER = 'u-mei';

  const opportunitiesByStage = useMemo(() => {
    const buckets: Record<OpportunityStage, Opportunity[]> = {
      inquiry: [], qualified: [], discovery: [], proposing: [], negotiating: [],
      won: [], lost: [], on_hold: [],
    };
    for (const o of Object.values(opportunitiesMap)) {
      if (ownerFilter === 'mine' && o.ownerUserId !== DEMO_USER) continue;
      buckets[o.stage].push(o);
    }
    for (const stage of Object.keys(buckets) as OpportunityStage[]) {
      buckets[stage].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return buckets;
  }, [opportunitiesMap, ownerFilter]);

  // My open tasks — overdue + due soon. Same demo user.
  const myTasks = useMemo(() => {
    return Object.values(tasksMap)
      .filter((t) => t.status === 'open' && t.assignedUserId === DEMO_USER)
      .sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity))
      .slice(0, 8);
  }, [tasksMap]);

  return (
    <AppShell
      crumbs={[{ label: 'CRM' }, { label: 'Pipeline' }]}
      title="Sales pipeline"
      subtitle={`${money(summary.open)} open · ${money(summary.weighted)} weighted · ${summary.openCount} active deals`}
      actions={
        <Button size="sm">
          <Plus className="w-3.5 h-3.5 mr-1" />New opportunity
        </Button>
      }
    >
      <div className="max-w-[1500px] mx-auto px-6 py-6 space-y-5">

        {/* ── Headline cards ─────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          <SummaryCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Open pipeline"     value={money(summary.open)}     hint={`${summary.openCount} deals`} />
          <SummaryCard icon={<Filter   className="w-3.5 h-3.5" />} label="Weighted forecast" value={money(summary.weighted)} hint="Probability × value" />
          <SummaryCard icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Won this quarter" value={money(summary.wonThisQuarter)} hint="Closed-won contract value" />
          <SummaryCard icon={<AlertCircle className="w-3.5 h-3.5" />} label="My open tasks" value={String(myTasks.length)} hint={myTasks.filter(isOverdue).length ? `${myTasks.filter(isOverdue).length} overdue` : 'All on track'} />
        </div>

        {/* ── Filter row ─────────────────────────────── */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-md p-0.5 bg-background">
            {(['all', 'mine'] as const).map((f) => (
              <button key={f}
                onClick={() => setOwnerFilter(f)}
                className={`px-3 py-1 rounded text-xs capitalize transition-colors whitespace-nowrap ${ownerFilter === f ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f === 'all' ? 'All owners' : 'My deals'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-4">

          {/* ── Kanban ──────────────────────────────── */}
          <div>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {KANBAN_STAGES.map((stage) => {
                const stageMeta = STAGE_META[stage];
                const list = opportunitiesByStage[stage];
                const total = list.reduce((s, o) => s + (o.estValue ?? 0), 0);
                return (
                  <div key={stage} className="bg-card border border-border rounded-lg overflow-hidden flex flex-col min-h-[300px]">
                    <div className="px-3 py-2 border-b border-border">
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${stageMeta.tone}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${stageMeta.dot}`} />
                          {stageMeta.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{list.length}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1.5 tabular-nums">{money(total)}</div>
                    </div>
                    <div className="p-2 space-y-2 flex-1">
                      {list.length === 0 ? (
                        <div className="text-[10px] text-muted-foreground px-1 py-2 text-center">— none —</div>
                      ) : list.map((o) => (
                        <OpportunityCard
                          key={o.id}
                          opp={o}
                          customerName={customersMap[o.customerId]?.companyName ?? '—'}
                          onOpen={() => navigate(`/account/${o.customerId}`)}
                          onStageChange={(next) => setOppStage(o.id, next, { userName: 'You' })}
                          onConvert={() => {
                            const projectId = convertOpp(o.id, { userName: 'You' });
                            if (projectId) navigate(`/project/${projectId}`);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Closed lanes ────────────────────────── */}
            <div className="grid grid-cols-3 gap-2">
              {CLOSED_STAGES.map((stage) => {
                const stageMeta = STAGE_META[stage];
                const list = opportunitiesByStage[stage];
                const total = list.reduce((s, o) => s + (o.estValue ?? 0), 0);
                return (
                  <div key={stage} className="bg-card/70 border border-border/60 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${stageMeta.tone}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stageMeta.dot}`} />
                        {stageMeta.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{money(total)} · {list.length}</span>
                    </div>
                    <div className="divide-y divide-border/60">
                      {list.length === 0 ? (
                        <div className="text-[10px] text-muted-foreground px-3 py-2">— none —</div>
                      ) : list.map((o) => (
                        <button key={o.id} onClick={() => o.wonProjectId ? navigate(`/project/${o.wonProjectId}`) : navigate(`/account/${o.customerId}`)} className="w-full text-left px-3 py-2 hover:bg-secondary/30 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs truncate">{o.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{customersMap[o.customerId]?.companyName ?? '—'}</div>
                          </div>
                          <div className="text-[10px] text-muted-foreground tabular-nums shrink-0">{money(o.estValue ?? 0)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── My open tasks ───────────────────────────── */}
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-lg overflow-hidden sticky top-4">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-medium">My open tasks</h3>
                <span className="text-xs text-muted-foreground">{myTasks.length}</span>
              </div>
              {myTasks.length === 0 ? (
                <div className="px-4 py-6 text-xs text-muted-foreground text-center">All caught up.</div>
              ) : myTasks.map((t) => (
                <TaskRow key={t.id} task={t} customerName={t.customerId ? customersMap[t.customerId]?.companyName : undefined}
                  onOpen={() => t.customerId && navigate(`/account/${t.customerId}`)}
                  onComplete={() => completeTask(t.id, { userName: 'You' })}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─────────────────────────── Cards ──────────────────────────────

function OpportunityCard({
  opp, customerName, onOpen, onStageChange, onConvert,
}: {
  opp: Opportunity;
  customerName: string;
  onOpen: () => void;
  onStageChange: (s: OpportunityStage) => void;
  onConvert: () => void;
}) {
  const due = opp.expectedCloseDate;
  const overdueClose = due && due < Date.now() && (opp.stage !== 'won' && opp.stage !== 'lost');
  return (
    <div className="bg-secondary/30 border border-border/60 rounded-md p-2.5 hover:border-border-strong transition-colors group">
      <button onClick={onOpen} className="w-full text-left block">
        <div className="text-xs font-medium leading-snug line-clamp-2">{opp.name}</div>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Building2 className="w-3 h-3 shrink-0" />
          <span className="truncate">{customerName}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px]">
          <span className="text-foreground tabular-nums">{money(opp.estValue ?? 0)}</span>
          {opp.ownerUserId && <span className="text-muted-foreground">{opp.ownerUserId.replace(/^u-/, '')}</span>}
        </div>
        {due && (
          <div className={`mt-1 flex items-center gap-1 text-[10px] ${overdueClose ? 'text-amber-400' : 'text-muted-foreground'}`}>
            <Calendar className="w-3 h-3 shrink-0" />
            <span>{overdueClose ? 'Past expected close' : `Close ~${shortDate(due)}`}</span>
          </div>
        )}
      </button>

      <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1">
        <select
          value={opp.stage}
          onChange={(e) => onStageChange(e.target.value as OpportunityStage)}
          className="flex-1 bg-input-background border border-input-border rounded text-[10px] px-1.5 py-0.5 focus:outline-none focus:border-primary"
          title="Change stage"
        >
          {(['inquiry','qualified','discovery','proposing','negotiating','won','lost','on_hold'] as OpportunityStage[]).map((s) => (
            <option key={s} value={s}>{STAGE_META[s].label}</option>
          ))}
        </select>
        {opp.stage === 'won' && !opp.wonProjectId && (
          <button
            onClick={onConvert}
            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-primary/40 text-primary hover:bg-primary/10"
            title="Convert this won opportunity into a project"
          >
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-xl font-medium mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function TaskRow({ task, customerName, onOpen, onComplete }: { task: Task; customerName?: string; onOpen: () => void; onComplete: () => void }) {
  const overdue = isOverdue(task);
  return (
    <div className="px-3 py-2 border-b border-border last:border-b-0 hover:bg-secondary/20 flex items-start gap-2.5">
      <button onClick={onComplete} className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-400" title="Mark done">
        <CheckCircle2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={onOpen} className="flex-1 text-left min-w-0">
        <div className="text-xs leading-snug truncate">{task.title}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
          {customerName && <span className="truncate max-w-[100px]">{customerName}</span>}
          {task.dueDate && (
            <span className={overdue ? 'text-amber-400' : ''}>
              <Clock className="w-2.5 h-2.5 inline mr-0.5" />
              {overdue ? `Overdue · ${shortDate(task.dueDate)}` : shortDate(task.dueDate)}
            </span>
          )}
        </div>
      </button>
      <ChevronRight className="w-3 h-3 text-muted-foreground/40 mt-1 shrink-0" />
    </div>
  );
}

// ─────────────────────────── helpers ─────────────────────────────
function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n.toLocaleString('en-US')}`;
}
function shortDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function isOverdue(t: Task): boolean {
  return t.status === 'open' && t.dueDate != null && t.dueDate < Date.now();
}
function quarterStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime();
}
