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
import { useProjectStore, selectors as sel } from '../store/projectStore';
import {
  PHASES, PHASE_TIMELINE, expandRoute, quickActionFor, progressPctFor,
  nextPhase, previousPhase, healthTone,
} from '../lifecycle/phases';
import type { LifecyclePhase } from '../store/types';

export function ProjectCenter() {
  const { projectId = 'p1' } = useParams();
  const navigate = useNavigate();

  // Everything we need from the store. Subscribing to the project object
  // directly so phase changes / nextAction edits re-render us live.
  const project = useProjectStore((s) => s.projects[projectId]);
  const customer = useProjectStore((s) => project?.customerId ? s.customers[project.customerId] : undefined);
  const counts = useProjectStore((s) => ({
    devices:  sel.devicesForProject(s, projectId).length,
    pathways: sel.pathwaysForProject(s, projectId).length,
    idfs:     sel.idfsForProject(s, projectId).length,
    doors:    Object.values(s.doors).filter((d) => d.projectId === projectId).length,
  }));
  const activity = useProjectStore((s) => sel.activityForProject(s, projectId, 20));
  const setNextAction = useProjectStore((s) => s.setNextAction);
  const advancePhase = useProjectStore((s) => s.advanceProjectPhase);
  const revertPhase = useProjectStore((s) => s.revertProjectPhase);
  const completePhaseItem = useProjectStore((s) => s.completePhaseItem);
  const uncompletePhaseItem = useProjectStore((s) => s.uncompletePhaseItem);
  const setHealth = useProjectStore((s) => s.setProjectHealth);

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
          <Button size="sm" variant="outline" onClick={() => navigate(`/project/${projectId}/canvas`)}>
            Open canvas
          </Button>
          <Button size="sm" onClick={() => navigate(qa.href)}>
            {qa.label} <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      }
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">

        {/* ── Phase ribbon + next action ───────────────────────────── */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${phaseCfg.tone.outline}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${phaseCfg.tone.dot}`} />
                  {phaseCfg.label}
                </span>
                <span className={`text-xs ${h.cls}`}>· {h.label}</span>
                {project.priority && project.priority !== 'normal' && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">· {project.priority}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">{phaseCfg.description}</p>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Next action</div>
              <input
                type="text"
                value={project.nextAction ?? ''}
                onChange={(e) => setNextAction(projectId, e.target.value)}
                placeholder={`Next concrete step for the ${phaseCfg.shortLabel.toLowerCase()} phase…`}
                className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="w-72 shrink-0 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Phase progress</div>
              <div className="flex items-center justify-between text-sm">
                <span>{completedCount} / {totalItems}</span>
                <span className="text-muted-foreground">{phasePct}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full ${phasePct === 100 ? 'bg-emerald-400' : 'bg-primary'}`} style={{ width: `${phasePct}%` }} />
              </div>
              <div className="flex gap-1.5 pt-2">
                {prev && (
                  <Button size="sm" variant="ghost" onClick={() => revertPhase(projectId, { userName: 'You' })}>
                    ← {PHASES[prev].shortLabel}
                  </Button>
                )}
                {next && (
                  <Button size="sm" variant="outline" onClick={() => advancePhase(projectId, { userName: 'You' })}>
                    Advance to {PHASES[next].shortLabel} <ChevronRight className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Phase timeline dots */}
          <div className="mt-5 pt-5 border-t border-border">
            <div className="flex items-center gap-1 overflow-x-auto">
              {PHASE_TIMELINE.map((p, i) => {
                const cfg = PHASES[p];
                const state = i < timelineIdx ? 'past' : i === timelineIdx ? 'current' : 'future';
                return (
                  <div key={p} className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => useProjectStore.getState().setProjectPhase(projectId, p, { userName: 'You' })}
                      className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider transition-colors border ${
                        state === 'current' ? cfg.tone.outline + ' bg-secondary/40'
                        : state === 'past' ? 'border-transparent text-muted-foreground hover:text-foreground'
                        : 'border-transparent text-muted-foreground/50 hover:text-foreground'
                      }`}
                      title={`Jump to ${cfg.label} — ${cfg.description}`}
                    >
                      {cfg.shortLabel}
                    </button>
                    {i < PHASE_TIMELINE.length - 1 && (
                      <div className={`w-3 h-px ${state === 'past' || state === 'current' ? 'bg-primary/40' : 'bg-border'}`} />
                    )}
                  </div>
                );
              })}
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
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Health</div>
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

              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-4 mb-2">Owners</div>
              <OwnerRow icon={<Sparkles className="w-3 h-3" />}     label="Sales"      value={project.assignedSalesUserId} />
              <OwnerRow icon={<Activity className="w-3 h-3" />}     label="Engineer"   value={project.assignedEngineerUserId} />
              <OwnerRow icon={<Activity className="w-3 h-3" />}     label="Estimator"  value={project.assignedEstimatorUserId} />
              <OwnerRow icon={<ShieldCheck className="w-3 h-3" />}  label="PM"         value={project.assignedPMUserId} />

              {project.dueDate && (
                <>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-4 mb-1">Due</div>
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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
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
