// Project Command Center — /project/:id
//
// The hub for one project. Shows phase timeline, next action, owner,
// checklist, related modules, key metrics, and recent activity feed. This
// is the page that makes Deeper Vision feel like ONE end-to-end platform
// instead of a collection of screens.

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import {
  Activity, ArrowRight, Check, Circle, CheckCircle2, AlertTriangle, ChevronRight, MapPin,
  Calendar, Clock, ShieldCheck, ShieldAlert, Shield, Sparkles, RotateCcw,
  FileSignature, ChevronDown, Package, Hash,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import {
  PHASES, PHASE_TIMELINE, expandRoute, quickActionFor, progressPctFor,
  nextPhase, previousPhase, healthTone,
} from '../lifecycle/phases';
import type { LifecyclePhase, Approval, ApprovalType, Asset, AssetStatus, Warranty, Device } from '../store/types';

export function ProjectCenter() {
  const { projectId = 'p1' } = useParams();
  const navigate = useNavigate();

  // Subscribe to raw maps (stable object identity until something mutates).
  // Derive arrays/objects via useMemo below — subscribing to a selector that
  // returned `Object.values(...).filter(...)` directly caused infinite
  // re-renders by tripping Zustand's getSnapshot identity check.
  const project = useProjectStore((s) => s.projects[projectId]);
  const customersMap = useProjectStore((s) => s.customers);
  const devicesMap   = useProjectStore((s) => s.devices);
  const pathwaysMap  = useProjectStore((s) => s.pathways);
  const idfsMap      = useProjectStore((s) => s.idfs);
  const doorsMap     = useProjectStore((s) => s.doors);
  const activityMap  = useProjectStore((s) => s.activity);
  // SC.2.2 — subscribe to raw approvals map; derive the project's
  // list via useMemo so we don't trip Zustand's getSnapshot
  // identity check (same reason every other slice is wired this
  // way in this file).
  const approvalsMap = useProjectStore((s) => s.approvals);
  // SC.3.4 — assets + warranties for the project. Same pattern as
  // approvalsMap: raw subscription + useMemo filter.
  const assetsMap     = useProjectStore((s) => s.assets);
  const warrantiesMap = useProjectStore((s) => s.warranties);
  const setNextAction = useProjectStore((s) => s.setNextAction);
  const advancePhase = useProjectStore((s) => s.advanceProjectPhase);
  const revertPhase = useProjectStore((s) => s.revertProjectPhase);
  const completePhaseItem = useProjectStore((s) => s.completePhaseItem);
  const uncompletePhaseItem = useProjectStore((s) => s.uncompletePhaseItem);
  const setHealth = useProjectStore((s) => s.setProjectHealth);

  const customer = project?.customerId ? customersMap[project.customerId] : undefined;
  const counts = useMemo(
    () => ({
      devices:  Object.values(devicesMap).filter((d) => d.projectId === projectId).length,
      pathways: Object.values(pathwaysMap).filter((p) => p.projectId === projectId).length,
      idfs:     Object.values(idfsMap).filter((i) => i.projectId === projectId).length,
      doors:    Object.values(doorsMap).filter((d) => d.projectId === projectId).length,
    }),
    [devicesMap, pathwaysMap, idfsMap, doorsMap, projectId],
  );
  const activity = useMemo(
    () => Object.values(activityMap)
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20),
    [activityMap, projectId],
  );
  const approvals = useMemo(
    () => Object.values(approvalsMap)
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime()),
    [approvalsMap, projectId],
  );
  // SC.3.4 — project assets newest first. Warranties looked up
  // per asset inside the row component so a per asset re render
  // doesn't broadcast across the whole list.
  const projectAssets = useMemo(
    () => Object.values(assetsMap)
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt),
    [assetsMap, projectId],
  );

  if (!project) {
    return (
      <AppShell crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Unknown' }]}>
        <div className="max-w-xl mx-auto px-6 py-12 text-center">
          <h2 className="text-lg font-medium mb-2">Project not found</h2>
          <p className="text-sm text-muted-foreground mb-4">No project with id <code>{projectId}</code> exists.</p>
          <Button variant="outline" onClick={() => navigate('/projects')}>Back to projects</Button>
        </div>
      </AppShell>
    );
  }

  const phase = project.lifecyclePhase;
  const phaseCfg = PHASES[phase];
  const phaseItems = project.phaseItems?.[phase] ?? {};
  const completedCount = phaseCfg.requiredCompletionItems.filter((i) => phaseItems[i.id]).length;
  const totalItems = phaseCfg.requiredCompletionItems.length;
  const phasePct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 100;
  const qa = quickActionFor(phase, projectId);
  const next = nextPhase(phase);
  const prev = previousPhase(phase);
  const h = healthTone(project.healthStatus);

  // Phase timeline data
  const timelineIdx = PHASE_TIMELINE.indexOf(phase);

  return (
    <AppShell
      crumbs={[
        { label: 'Projects', to: '/projects' },
        { label: project.name },
      ]}
      title={project.name}
      subtitle={`${customer?.companyName ?? '—'} · ${customer?.addresses?.[0]?.city ?? ''}${customer?.addresses?.[0]?.state ? `, ${customer.addresses[0].state}` : ''}`}
      actions={
        <div className="flex items-center gap-2">
          {project.customerId && (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/account/${project.customerId}`)}>
              Account →
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => navigate(`/project/${projectId}/canvas`)}>
            Canvas
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/project/${projectId}/drill`)}>
            Drill Simulator
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/project/${projectId}/bus`)}>
            Bus Security
          </Button>
          <Button size="sm" onClick={() => navigate(qa.href)}>
            {qa.label} <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      }
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">

        {/* ── Next action banner ─────────────────────────────────────
            The single most important thing on this page: what should
            happen next? Big, prominent, editable. Everything else on
            this screen is supporting context for this one question. */}
        <div
          className="relative bg-card border border-border-strong rounded-lg p-5 overflow-hidden"
          style={{
            boxShadow: '0 0 0 1px rgba(124,194,255,0.10), 0 10px 40px -20px rgba(124,194,255,0.18)',
          }}
        >
          {/* soft glow accent */}
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary/60 to-primary/10" aria-hidden />
          <div className="grid grid-cols-[1fr_auto] gap-5 items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1.5">
                <span className="text-primary font-medium tracking-tight">Next action</span>
                <span className="text-muted-foreground/40">·</span>
                <span className={`inline-flex items-center gap-1.5 ${h.cls}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${phaseCfg.tone.dot}`} />
                  {phaseCfg.label}
                </span>
              </div>
              <input
                type="text"
                value={project.nextAction ?? ''}
                onChange={(e) => setNextAction(projectId, e.target.value)}
                placeholder={`What's the next concrete step for the ${phaseCfg.shortLabel.toLowerCase()} phase?`}
                className="w-full bg-transparent text-xl font-medium tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
              <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-1">{phaseCfg.description}</p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <Button size="sm" onClick={() => navigate(qa.href)}>
                {qa.label} <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Phase ribbon (demoted: timeline + advance/revert) ─────
            Below the next-action banner because phase context matters
            but isn't the question the user came here to answer. */}
        <div className="bg-card border border-border rounded-lg px-4 py-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-[11px] text-muted-foreground shrink-0 font-medium tracking-tight">Phase</div>

            <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
              {PHASE_TIMELINE.map((p, i) => {
                const cfg = PHASES[p];
                const state = i < timelineIdx ? 'past' : i === timelineIdx ? 'current' : 'future';
                return (
                  <div key={p} className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => useProjectStore.getState().setProjectPhase(projectId, p, { userName: 'You' })}
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider transition-colors ${
                        state === 'current' ? `${cfg.tone.outline} border bg-secondary/40 px-2`
                        : state === 'past' ? 'text-muted-foreground hover:text-foreground'
                        : 'text-muted-foreground/40 hover:text-foreground'
                      }`}
                      title={`Jump to ${cfg.label} — ${cfg.description}`}
                    >
                      {cfg.shortLabel}
                    </button>
                    {i < PHASE_TIMELINE.length - 1 && (
                      <div className={`w-2 h-px ${state === 'past' || state === 'current' ? 'bg-primary/40' : 'bg-border'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="tabular-nums">{completedCount}/{totalItems}</span>
                <div className="w-24 h-1 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${phasePct === 100 ? 'bg-emerald-400' : 'bg-primary'}`} style={{ width: `${phasePct}%` }} />
                </div>
              </div>
              {prev && (
                <Button size="sm" variant="ghost" onClick={() => revertPhase(projectId, { userName: 'You' })}>
                  ←
                </Button>
              )}
              {next && (
                <Button size="sm" variant="outline" onClick={() => advancePhase(projectId, { userName: 'You' })}>
                  Advance <ChevronRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-5">
          {/* ── Left: checklist + related modules ─────────────────── */}
          <div className="space-y-5">
            {/* Phase checklist */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-medium">{phaseCfg.label} checklist</h3>
                <span className="text-xs text-muted-foreground">Owner: {labelForRole(phaseCfg.ownerRole)}</span>
              </div>
              {totalItems === 0 ? (
                <div className="px-4 py-4 text-xs text-muted-foreground">No checklist items for this phase.</div>
              ) : phaseCfg.requiredCompletionItems.map((item) => {
                const done = !!phaseItems[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => done ? uncompletePhaseItem(projectId, phase, item.id, { userName: 'You' }) : completePhaseItem(projectId, phase, item.id, { userName: 'You' })}
                    className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors flex items-center gap-3 ${done ? 'text-muted-foreground' : ''}`}
                  >
                    {done
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className={`flex-1 text-sm ${done ? 'line-through' : ''}`}>{item.label}</span>
                    {item.href && (
                      <span
                        onClick={(e) => { e.stopPropagation(); navigate(expandRoute(item.href!, projectId)); }}
                        className="text-[10px] uppercase tracking-wider text-primary hover:underline shrink-0"
                      >
                        Open →
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Related modules */}
            {phaseCfg.visibleModules.length > 0 && (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border">
                  <h3 className="text-sm font-medium">Recommended for this phase</h3>
                </div>
                <div className="grid grid-cols-2 gap-px bg-border">
                  {phaseCfg.visibleModules.map((m) => (
                    <button
                      key={m.href}
                      onClick={() => navigate(expandRoute(m.href, projectId))}
                      className="text-left px-4 py-3 bg-card hover:bg-secondary/30 flex items-center justify-between"
                    >
                      <span className="text-sm">{m.label}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Key metrics */}
            <div className="grid grid-cols-4 gap-3">
              <Metric label="Devices"  value={counts.devices} />
              <Metric label="Doors"    value={counts.doors} />
              <Metric label="Pathways" value={counts.pathways} />
              <Metric label="IDFs"     value={counts.idfs} />
            </div>

            {/* SC.2.2 — Approvals audit trail. Surfaces every
                Approval record on this project newest first. Each
                row expands inline to show comments. Empty state is
                honest — points the operator to the Customer
                Portal where approvals get created. */}
            <ApprovalsList projectId={projectId} approvals={approvals} />

            {/* SC.3.4 — Assets inventory. Every device commissioned
                on this project shows up here with its linked
                warranties. Click a row to expand into a detail
                drawer. Empty state points the operator to the
                deployment surface where commissioning happens. */}
            <AssetsList
              projectId={projectId}
              assets={projectAssets}
              warrantiesMap={warrantiesMap}
              devicesMap={devicesMap}
            />
          </div>

          {/* ── Right: activity feed + health controls ─────────────── */}
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-[11px] font-medium text-foreground mb-2 tracking-tight">Health</div>
              <div className="flex gap-1 mb-3">
                {(['on_track', 'at_risk', 'blocked', 'complete'] as const).map((opt) => {
                  const active = (project.healthStatus ?? 'on_track') === opt;
                  const t = healthTone(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => setHealth(projectId, opt, { userName: 'You' })}
                      className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 rounded border transition-colors ${
                        active ? `border-current ${t.cls} bg-secondary/40` : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >{t.label}</button>
                  );
                })}
              </div>

              <div className="text-[11px] font-medium text-foreground mt-5 mb-2 tracking-tight">Owners</div>
              <OwnerRow icon={<Sparkles className="w-3 h-3" />}     label="Sales"      value={project.assignedSalesUserId} />
              <OwnerRow icon={<Activity className="w-3 h-3" />}     label="Engineer"   value={project.assignedEngineerUserId} />
              <OwnerRow icon={<Activity className="w-3 h-3" />}     label="Estimator"  value={project.assignedEstimatorUserId} />
              <OwnerRow icon={<ShieldCheck className="w-3 h-3" />}  label="PM"         value={project.assignedPMUserId} />

              {project.dueDate && (
                <>
                  <div className="text-[11px] font-medium text-foreground mt-5 mb-1 tracking-tight">Due</div>
                  <div className="text-sm">{new Date(project.dueDate).toLocaleDateString()}</div>
                </>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-medium">Recent activity</h3>
                <span className="text-xs text-muted-foreground">{activity.length}</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {activity.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-muted-foreground">No activity yet. Make a change on the canvas and it'll show up here.</div>
                ) : activity.map((a) => (
                  <div key={a.id} className="px-4 py-2.5 border-b border-border last:border-b-0 text-sm">
                    <div className="flex items-start gap-2">
                      <ActivityDot type={a.type} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{a.message}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {a.userName ? `${a.userName} · ` : ''}{timeAgo(a.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Small components ──────────────────────────────────────────────
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-2xl font-medium mt-0.5">{value}</div>
    </div>
  );
}

function OwnerRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
      <span className="text-foreground">{value ? value.replace(/^u-/, '') : 'Unassigned'}</span>
    </div>
  );
}

function ActivityDot({ type }: { type: string }) {
  // Color-coded category dot — visual scanning aid in the feed.
  const cls = (() => {
    if (type.startsWith('phase')) return 'bg-blue-400';
    if (type.startsWith('device')) return 'bg-violet-400';
    if (type.startsWith('commission')) return 'bg-emerald-400';
    if (type.includes('proposal') || type.includes('customer')) return 'bg-amber-400';
    if (type.includes('health'))   return 'bg-rose-400';
    return 'bg-slate-400';
  })();
  return <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${cls}`} />;
}

function timeAgo(ms: number) {
  const d = Date.now() - ms;
  const sec = Math.floor(d / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function labelForRole(role: string): string {
  return ({
    'sales': 'Sales',
    'field': 'Field',
    'engineering': 'Engineering',
    'estimating': 'Estimating',
    'sales-or-estimating': 'Sales / Estimating',
    'customer': 'Customer',
    'pm': 'Project manager',
    'service': 'Service',
  } as Record<string, string>)[role] ?? role;
}

// ─────────────────────── Approvals audit trail (SC.2.2) ──────────
const APPROVAL_TYPE_LABEL: Record<ApprovalType, string> = {
  design: 'Design',
  scope: 'Scope',
  final: 'Final',
  'change-order': 'Change order',
};

const APPROVAL_TYPE_TONE: Record<ApprovalType, string> = {
  design:        'bg-sky-500/10 text-sky-300 border-sky-500/30',
  scope:         'bg-violet-500/10 text-violet-300 border-violet-500/30',
  final:         'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  'change-order': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
};

function ApprovalsList({ projectId, approvals }: { projectId: string; approvals: Approval[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <FileSignature className="w-3.5 h-3.5 text-muted-foreground" />
          Approvals
        </h3>
        <span className="text-xs text-muted-foreground">{approvals.length}</span>
      </div>
      {approvals.length === 0 ? (
        <div className="px-4 py-5 text-xs text-muted-foreground">
          No approvals yet. The customer records approvals from the{' '}
          <a className="text-primary hover:underline" href={`/portal/${projectId}`}>Customer Portal</a>.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {approvals.map((a) => {
            const expanded = expandedId === a.id;
            return (
              <li key={a.id} className="hover:bg-secondary/30">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : a.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3"
                  data-testid={`approval-row-${a.id}`}
                >
                  <span
                    className={`shrink-0 inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${APPROVAL_TYPE_TONE[a.approvalType]}`}
                  >
                    {APPROVAL_TYPE_LABEL[a.approvalType]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      {a.approverName}
                      <span className="text-muted-foreground"> · {a.approverEmail}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {a.proposalVersion} · {new Date(a.approvedAt).toLocaleString()}
                    </div>
                    {a.comments && !expanded && (
                      <div className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-1">
                        {a.comments}
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <div className="px-4 pb-4 pl-[68px] text-xs text-muted-foreground space-y-2 border-t border-border/40">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                      <div><span className="text-foreground/70">Type:</span> {APPROVAL_TYPE_LABEL[a.approvalType]}</div>
                      <div><span className="text-foreground/70">Version:</span> {a.proposalVersion}</div>
                      <div><span className="text-foreground/70">Approver:</span> {a.approverName}</div>
                      <div><span className="text-foreground/70">Email:</span> {a.approverEmail}</div>
                      <div><span className="text-foreground/70">Approved at:</span> {new Date(a.approvedAt).toLocaleString()}</div>
                      <div className="font-mono text-[10px] truncate"><span className="text-foreground/70">ID:</span> {a.id}</div>
                    </div>
                    {a.comments ? (
                      <div className="mt-2 rounded border border-border/60 bg-secondary/30 px-3 py-2 text-foreground/90 whitespace-pre-wrap">
                        {a.comments}
                      </div>
                    ) : (
                      <div className="text-muted-foreground/60 italic">No comments left by the approver.</div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────── Assets list (SC.3.4) ────────────────────
const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  active:               'Active',
  decommissioned:       'Decommissioned',
  'service-required':   'Service required',
  orphaned:             'Orphaned',
};

const ASSET_STATUS_TONE: Record<AssetStatus, string> = {
  active:             'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  decommissioned:     'bg-slate-500/10 text-slate-300 border-slate-500/30',
  'service-required': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  orphaned:           'bg-rose-500/10 text-rose-300 border-rose-500/30',
};

function warrantyStatus(w: Warranty, now: number = Date.now()): 'active' | 'expiring' | 'expired' {
  const end = new Date(w.endDate).getTime();
  if (!Number.isFinite(end) || end < now) return 'expired';
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  if (end - now <= ninetyDays) return 'expiring';
  return 'active';
}

function AssetsList({ projectId, assets, warrantiesMap, devicesMap }: {
  projectId: string;
  assets: Asset[];
  warrantiesMap: Record<string, Warranty>;
  devicesMap: Record<string, Device>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-muted-foreground" />
          Assets
        </h3>
        <span className="text-xs text-muted-foreground">{assets.length}</span>
      </div>
      {assets.length === 0 ? (
        <div className="px-4 py-5 text-xs text-muted-foreground">
          No commissioned assets yet. Commission work orders on the{' '}
          <a className="text-primary hover:underline" href={`/project/${projectId}/deployment`}>deployment surface</a>.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {assets.map((a) => {
            const expanded = expandedId === a.id;
            const linkedWarranties = Object.values(warrantiesMap).filter((w) => w.assetId === a.id);
            const device = devicesMap[a.deviceId];
            const deviceLabel = device?.label || device?.id || a.deviceId;
            return (
              <li key={a.id} className="hover:bg-secondary/30">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : a.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3"
                  data-testid={`asset-row-${a.id}`}
                >
                  <span className={`shrink-0 inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${ASSET_STATUS_TONE[a.status]}`}>
                    {ASSET_STATUS_LABEL[a.status]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      <span className="text-foreground">{deviceLabel}</span>
                      <span className="text-muted-foreground"> · {a.manufacturer} {a.model}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>Commissioned {new Date(a.commissionedAt).toLocaleDateString()}</span>
                      {a.commissionedBy && <span>by {a.commissionedBy}</span>}
                      {a.serialNumber && <span className="font-mono">SN {a.serialNumber}</span>}
                      <span>· {linkedWarranties.length} warrant{linkedWarranties.length === 1 ? 'y' : 'ies'}</span>
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <AssetExpansion asset={a} warranties={linkedWarranties} device={device} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AssetExpansion({ asset, warranties, device }: { asset: Asset; warranties: Warranty[]; device?: Device }) {
  const updateAsset = useProjectStore((s) => s.updateAsset);
  const updateWarranty = useProjectStore((s) => s.updateWarranty);

  // SC.3.5 — inline edit + decommission flow. Toggling edit flips
  // the asset detail to inputs + each warranty to its own edit
  // form. Decommission goes through a two click confirm because
  // the brief calls out "confirms first" and it cascades to
  // warranty endDates.
  const [editing, setEditing] = useState(false);
  const [confirmingDecom, setConfirmingDecom] = useState(false);

  const [serial, setSerial] = useState(asset.serialNumber ?? '');
  const [status, setStatus] = useState<AssetStatus>(asset.status);
  const [notes, setNotes]   = useState(asset.notes ?? '');

  const cancelEdit = () => {
    setEditing(false);
    setSerial(asset.serialNumber ?? '');
    setStatus(asset.status);
    setNotes(asset.notes ?? '');
  };

  const saveAsset = () => {
    updateAsset(asset.id, {
      serialNumber: serial.trim() || undefined,
      status,
      notes: notes.trim() || '',
    });
    setEditing(false);
  };

  const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const decommission = () => {
    updateAsset(asset.id, { status: 'decommissioned' });
    // SC.3.5 — cascade: linked warranties get an endDate of today
    // (or kept earlier if they were already expired). History is
    // preserved (we never delete the record).
    const today = todayIso();
    for (const w of warranties) {
      if (w.endDate > today) updateWarranty(w.id, { endDate: today });
    }
    setStatus('decommissioned');
    setConfirmingDecom(false);
    setEditing(false);
  };

  return (
    <div className="px-4 pb-4 pl-[68px] text-xs text-muted-foreground space-y-3 border-t border-border/40">
      {/* Edit toolbar */}
      <div className="mt-2 flex items-center justify-end gap-2">
        {!editing && asset.status !== 'decommissioned' && !confirmingDecom && (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
              data-testid={`asset-edit-${asset.id}`}
            >Edit asset</button>
            <button
              type="button"
              onClick={() => setConfirmingDecom(true)}
              className="text-[11px] text-rose-400 hover:underline inline-flex items-center gap-1"
              data-testid={`asset-decommission-${asset.id}`}
            >Decommission</button>
          </>
        )}
        {confirmingDecom && (
          <>
            <span className="text-[11px] text-foreground">Decommission this asset?</span>
            <button
              type="button"
              onClick={decommission}
              className="text-[11px] px-2 py-0.5 rounded border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15"
              data-testid={`asset-decommission-confirm-${asset.id}`}
            >Yes, decommission</button>
            <button
              type="button"
              onClick={() => setConfirmingDecom(false)}
              className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground"
            >Cancel</button>
          </>
        )}
        {editing && (
          <>
            <button
              type="button"
              onClick={saveAsset}
              className="text-[11px] px-2 py-0.5 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
              data-testid={`asset-save-${asset.id}`}
            >Save</button>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground"
            >Cancel</button>
          </>
        )}
      </div>

      {/* Read mode detail grid */}
      {!editing && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div><span className="text-foreground/70">Manufacturer:</span> {asset.manufacturer}</div>
          <div><span className="text-foreground/70">Model:</span> {asset.model}</div>
          <div><span className="text-foreground/70">Serial:</span> {asset.serialNumber || '—'}</div>
          <div><span className="text-foreground/70">Status:</span> {ASSET_STATUS_LABEL[asset.status]}</div>
          <div><span className="text-foreground/70">Commissioned:</span> {new Date(asset.commissionedAt).toLocaleString()}</div>
          <div><span className="text-foreground/70">By:</span> {asset.commissionedBy || '—'}</div>
          <div className="font-mono text-[10px] truncate col-span-2"><span className="text-foreground/70">Asset ID:</span> {asset.id}</div>
          {device && <div className="font-mono text-[10px] truncate col-span-2"><span className="text-foreground/70">Device ID:</span> {device.id}</div>}
        </div>
      )}

      {/* Edit mode form (serial + status + notes; manufacturer /
          model stay read only because they come from the catalog
          and changing them on the Asset would drift from the
          underlying Device). */}
      {editing && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Serial number</span>
            <input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="Optional"
              className="bg-input-background border border-input-border rounded-md px-2 py-1 text-[12px]"
              data-testid={`asset-serial-input-${asset.id}`}
            />
          </label>
          <label className="col-span-1 flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AssetStatus)}
              className="bg-input-background border border-input-border rounded-md px-2 py-1 text-[12px]"
              data-testid={`asset-status-input-${asset.id}`}
            >
              <option value="active">Active</option>
              <option value="service-required">Service required</option>
              {/* Decommission lives behind its own confirm flow;
                  Orphaned is set by the SC.1.5 integrity sweep,
                  not the operator. */}
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="bg-input-background border border-input-border rounded-md px-2 py-1 text-[12px]"
            />
          </label>
        </div>
      )}

      {/* Read only notes when not editing */}
      {!editing && asset.notes && (
        <div className="rounded border border-border/60 bg-secondary/30 px-3 py-2 text-foreground/90 whitespace-pre-wrap">
          {asset.notes}
        </div>
      )}

      {/* Warranties */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Warranties</div>
        {warranties.length === 0 ? (
          <div className="text-[11px] text-muted-foreground/70 italic">No warranty records.</div>
        ) : (
          <ul className="space-y-1.5">
            {warranties.map((w) => (
              <WarrantyRow key={w.id} warranty={w} />
            ))}
          </ul>
        )}
      </div>

      {/* SC.6 placeholder. Honesty contract: rendered as plain
          text, not a control. */}
      <div className="text-[11px] text-muted-foreground/70 italic flex items-center gap-1">
        <Hash className="w-3 h-3" />
        Service tickets land in SC.6.
      </div>
    </div>
  );
}

function WarrantyRow({ warranty }: { warranty: Warranty }) {
  const updateWarranty = useProjectStore((s) => s.updateWarranty);
  const [editing, setEditing] = useState(false);
  const [provider, setProvider] = useState<Warranty['provider']>(warranty.provider);
  const [type, setType]           = useState(warranty.type);
  const [startDate, setStartDate] = useState(warranty.startDate);
  const [endDate, setEndDate]     = useState(warranty.endDate);
  const [terms, setTerms]         = useState(warranty.terms);
  const [coverage, setCoverage]   = useState(warranty.coverage);

  const ws = warrantyStatus(warranty);
  const tone =
    ws === 'active'    ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
    : ws === 'expiring' ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
    : 'text-rose-300 border-rose-500/30 bg-rose-500/10';

  const cancel = () => {
    setEditing(false);
    setProvider(warranty.provider);
    setType(warranty.type);
    setStartDate(warranty.startDate);
    setEndDate(warranty.endDate);
    setTerms(warranty.terms);
    setCoverage(warranty.coverage);
  };

  const save = () => {
    updateWarranty(warranty.id, {
      provider,
      type: type.trim() || warranty.type,
      startDate,
      endDate,
      terms,
      coverage,
    });
    setEditing(false);
  };

  if (!editing) {
    return (
      <li className="flex items-center gap-2 text-[11px]">
        <span className={`shrink-0 inline-flex items-center text-[9px] uppercase tracking-wider px-1 rounded border ${tone}`}>
          {ws}
        </span>
        <span className="text-foreground">{warranty.provider}</span>
        <span className="text-muted-foreground">· {warranty.type}</span>
        <span className="text-muted-foreground tabular-nums ml-auto">
          {warranty.startDate} → {warranty.endDate}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-primary hover:underline"
          data-testid={`warranty-edit-${warranty.id}`}
        >Edit</button>
      </li>
    );
  }

  return (
    <li className="rounded border border-border/60 bg-secondary/20 p-2 space-y-2" data-testid={`warranty-edit-form-${warranty.id}`}>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Provider</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Warranty['provider'])}
            className="bg-input-background border border-input-border rounded-md px-2 py-1 text-[12px]"
          >
            <option value="manufacturer">Manufacturer</option>
            <option value="integrator">Integrator</option>
            <option value="extended">Extended</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</span>
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="bg-input-background border border-input-border rounded-md px-2 py-1 text-[12px]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-input-background border border-input-border rounded-md px-2 py-1 text-[12px]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-input-background border border-input-border rounded-md px-2 py-1 text-[12px]"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Terms</span>
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={2}
          className="bg-input-background border border-input-border rounded-md px-2 py-1 text-[12px]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Coverage</span>
        <textarea
          value={coverage}
          onChange={(e) => setCoverage(e.target.value)}
          rows={2}
          className="bg-input-background border border-input-border rounded-md px-2 py-1 text-[12px]"
        />
      </label>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={save}
          className="text-[11px] px-2 py-0.5 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
          data-testid={`warranty-save-${warranty.id}`}
        >Save</button>
        <button
          type="button"
          onClick={cancel}
          className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground"
        >Cancel</button>
      </div>
    </li>
  );
}
