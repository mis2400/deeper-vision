// Project Command Center — /project/:id
//
// The hub for one project. Shows phase timeline, next action, owner,
// checklist, related modules, key metrics, and recent activity feed. This
// is the page that makes Deeper Vision feel like ONE end-to-end platform
// instead of a collection of screens.

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import {
  Activity, ArrowRight, Check, Circle, CheckCircle2, AlertTriangle, ChevronRight, MapPin,
  Calendar, Clock, ShieldCheck, ShieldAlert, Shield, Sparkles, RotateCcw,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import {
  PHASES, PHASE_TIMELINE, expandRoute, quickActionFor, progressPctFor,
  nextPhase, previousPhase, healthTone,
} from '../lifecycle/phases';
import type { LifecyclePhase } from '../store/types';

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
            Open canvas
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
              <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground mb-1.5">
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
            <div className="text-[11.5px] text-muted-foreground shrink-0 font-medium tracking-tight">Phase</div>

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
          </div>

          {/* ── Right: activity feed + health controls ─────────────── */}
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-[11.5px] font-medium text-slate-200 mb-2 tracking-tight">Health</div>
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

              <div className="text-[11.5px] font-medium text-slate-200 mt-5 mb-2 tracking-tight">Owners</div>
              <OwnerRow icon={<Sparkles className="w-3 h-3" />}     label="Sales"      value={project.assignedSalesUserId} />
              <OwnerRow icon={<Activity className="w-3 h-3" />}     label="Engineer"   value={project.assignedEngineerUserId} />
              <OwnerRow icon={<Activity className="w-3 h-3" />}     label="Estimator"  value={project.assignedEstimatorUserId} />
              <OwnerRow icon={<ShieldCheck className="w-3 h-3" />}  label="PM"         value={project.assignedPMUserId} />

              {project.dueDate && (
                <>
                  <div className="text-[11.5px] font-medium text-slate-200 mt-5 mb-1 tracking-tight">Due</div>
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
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
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
