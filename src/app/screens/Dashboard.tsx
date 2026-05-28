import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  ClipboardCheck,
  DoorOpen,
  FileSignature,
  HardHat,
  LayoutDashboard,
  LifeBuoy,
  Map,
  Package,
  Radar,
  Route,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Users,
  Video,
  WalletCards,
  Workflow,
  Wrench,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useProjectStore } from '../store/projectStore';

type AnyRecord = Record<string, any>;

export function Dashboard() {
  const navigate = useNavigate();
  const projectsMap = useProjectStore((s) => s.projects);
  const customersMap = useProjectStore((s) => s.customers);
  const opportunitiesMap = useProjectStore((s) => s.opportunities);
  const tasksMap = useProjectStore((s) => s.tasks);
  const devicesMap = useProjectStore((s) => s.devices);
  const doorsMap = useProjectStore((s) => s.doors);
  const pathwaysMap = useProjectStore((s) => s.pathways);
  const assetsMap = useProjectStore((s) => s.assets);
  const warrantiesMap = useProjectStore((s) => s.warranties);
  const serviceTicketsMap = useProjectStore((s) => s.serviceTickets);
  const activityMap = useProjectStore((s) => s.activity);
  const setAssistantContext = useProjectStore((s) => s.setAssistantContext);

  useEffect(() => {
    setAssistantContext(null);
    setAssistantContext({ surface: 'dashboard' });
  }, [setAssistantContext]);

  const projects = useMemo(
    () => Object.values((projectsMap || {}) as AnyRecord).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [projectsMap],
  );
  const opportunities = useMemo(() => Object.values((opportunitiesMap || {}) as AnyRecord), [opportunitiesMap]);
  const tasks = useMemo(() => Object.values((tasksMap || {}) as AnyRecord), [tasksMap]);
  const devices = useMemo(() => Object.values((devicesMap || {}) as AnyRecord), [devicesMap]);
  const doors = useMemo(() => Object.values((doorsMap || {}) as AnyRecord), [doorsMap]);
  const pathways = useMemo(() => Object.values((pathwaysMap || {}) as AnyRecord), [pathwaysMap]);
  const assets = useMemo(() => Object.values((assetsMap || {}) as AnyRecord), [assetsMap]);
  const warranties = useMemo(() => Object.values((warrantiesMap || {}) as AnyRecord), [warrantiesMap]);
  const tickets = useMemo(() => Object.values((serviceTicketsMap || {}) as AnyRecord), [serviceTicketsMap]);
  const activity = useMemo(
    () => Object.values((activityMap || {}) as AnyRecord).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, 8),
    [activityMap],
  );

  const activeProject = projects.find((p) => !['closed', 'lost', 'archived'].includes(String(p.status ?? '').toLowerCase())) ?? projects[0];
  const activeProjectId = activeProject?.id ?? 'p1';
  const activeCustomer = activeProject?.customerId ? (customersMap as AnyRecord)?.[activeProject.customerId] : undefined;
  const openOpps = opportunities.filter((o) => !['won', 'lost'].includes(o.stage)).length;
  const proposalsOut = opportunities.filter((o) => ['proposing', 'negotiating'].includes(o.stage)).length;
  const openTasks = tasks.filter((t) => t.status === 'open').length;
  const activeTickets = tickets.filter((t) => !['closed', 'resolved'].includes(String(t.status ?? '').toLowerCase())).length;
  const expiringWarranties = warranties.filter((w) => {
    const end = typeof w.expiresAt === 'number' ? w.expiresAt : Date.parse(w.expiresAt ?? '');
    return Number.isFinite(end) && end < Date.now() + 90 * 86_400_000;
  }).length;
  const projectDevices = devices.filter((d) => d.projectId === activeProjectId);
  const projectDoors = doors.filter((d) => d.projectId === activeProjectId);
  const projectPathways = pathways.filter((p) => p.projectId === activeProjectId);
  const projectAssets = assets.filter((a) => a.projectId === activeProjectId);

  const moduleHref = (path: string) => path.replace(':projectId', activeProjectId);
  const modules = [
    { label: 'CRM', eyebrow: 'Intake', href: '/crm', icon: Users, count: openOpps, note: 'Accounts, contacts, opportunities' },
    { label: 'Site Walk', eyebrow: 'Survey', href: '/sitewalk/:projectId', icon: Map, count: openTasks, note: 'Schedule, checklist, field notes' },
    { label: 'Canvas', eyebrow: 'Design', href: '/project/:projectId/canvas', icon: LayoutDashboard, count: projectDevices.length, note: 'Plans, devices, DORI, pathways' },
    { label: 'Estimate', eyebrow: 'Pricing', href: '/estimate/:projectId', icon: WalletCards, count: projectDevices.length + projectPathways.length, note: 'BOM, labor, markup, alternates' },
    { label: 'Proposal', eyebrow: 'Customer', href: '/proposal/:projectId', icon: FileSignature, count: proposalsOut, note: 'Package, review, approval' },
    { label: 'Deployment', eyebrow: 'Install', href: '/project/:projectId/deployment', icon: HardHat, count: projectDoors.length, note: 'Work orders, tasks, commissioning' },
    { label: 'Service', eyebrow: 'Operate', href: '/tickets', icon: LifeBuoy, count: activeTickets, note: 'Tickets, warranty, lifecycle' },
  ];

  return (
    <AppShell crumbs={[{ label: 'Command Center' }]} fullBleed commandChrome>
      <div className="min-h-full overflow-auto" style={{ background: 'var(--command-bg)', color: 'var(--command-fg)' }}>
        <div className="mx-auto max-w-[1500px] px-6 py-5 space-y-5">
          <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--command-panel)', borderColor: 'var(--command-border-strong)', boxShadow: 'var(--command-shadow)' }}>
              <div className="p-5 border-b" style={{ borderColor: 'var(--command-border)' }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--command-accent)' }}>
                      <Radar className="w-4 h-4" />
                      Deeper Vision operating system
                    </div>
                    <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight" style={{ color: 'var(--command-fg)' }}>
                      Security work from first call to lifecycle service.
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--command-muted)' }}>
                      One command surface for intake, site walk, engineering canvas, pricing, proposal, deployment, closeout, warranty, and service.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/project/${activeProjectId}/canvas`)}
                    className="shrink-0 hidden sm:inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
                    style={{ background: 'var(--command-accent)', color: 'var(--command-accent-foreground)' }}
                  >
                    Open canvas <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
                {modules.map((m, i) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.label}
                      onClick={() => navigate(moduleHref(m.href))}
                      className="group relative min-h-[132px] rounded-xl border p-3 text-left transition-colors"
                      style={{ background: 'var(--command-panel-elevated)', borderColor: 'var(--command-border)' }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: i === 0 ? 'color-mix(in oklab, var(--command-accent) 16%, transparent)' : 'color-mix(in oklab, var(--command-cyan) 12%, transparent)', color: i === 0 ? 'var(--command-accent)' : 'var(--command-cyan)' }}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs tabular-nums" style={{ color: 'var(--command-muted)' }}>{m.count}</span>
                      </div>
                      <div className="mt-3 text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--command-faint)' }}>{m.eyebrow}</div>
                      <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--command-fg)' }}>{m.label}</div>
                      <div className="mt-1 text-xs leading-snug" style={{ color: 'var(--command-muted)' }}>{m.note}</div>
                      <span className="absolute left-3 right-3 bottom-2 h-px opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'var(--command-accent)' }} />
                    </button>
                  );
                })}
              </div>
            </div>

            <ActiveProjectPanel
              project={activeProject}
              customer={activeCustomer}
              deviceCount={projectDevices.length}
              doorCount={projectDoors.length}
              pathwayCount={projectPathways.length}
              assetCount={projectAssets.length}
              onOpen={() => navigate(`/project/${activeProjectId}`)}
              onCanvas={() => navigate(`/project/${activeProjectId}/canvas`)}
            />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-[0.72fr_1.28fr] gap-5">
            <div className="space-y-5">
              <SignalDeck
                openOpps={openOpps}
                projects={projects.length}
                openTasks={openTasks}
                tickets={activeTickets}
                warranties={expiringWarranties}
              />
              <AIWatchPanel activeProjectId={activeProjectId} devices={projectDevices.length} doors={projectDoors.length} pathways={projectPathways.length} onOpen={() => navigate(`/ai/${activeProjectId}`)} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
              <WorkflowBoard modules={modules} navigate={(href) => navigate(moduleHref(href))} />
              <ActivityFeed activity={activity} />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function ActiveProjectPanel({
  project,
  customer,
  deviceCount,
  doorCount,
  pathwayCount,
  assetCount,
  onOpen,
  onCanvas,
}: {
  project: any;
  customer: any;
  deviceCount: number;
  doorCount: number;
  pathwayCount: number;
  assetCount: number;
  onOpen: () => void;
  onCanvas: () => void;
}) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--command-panel)', borderColor: 'var(--command-border-strong)', boxShadow: 'var(--command-shadow)' }}>
      <div className="p-5 border-b" style={{ borderColor: 'var(--command-border)' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--command-faint)' }}>Active project</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: 'var(--command-fg)' }}>{project?.name ?? 'No project selected'}</h2>
            <div className="mt-1 text-sm" style={{ color: 'var(--command-muted)' }}>{customer?.companyName ?? 'No customer linked'}</div>
          </div>
          <button onClick={onOpen} className="rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: 'var(--command-border)', color: 'var(--command-muted)' }}>Project hub</button>
        </div>
      </div>
      <div className="p-5">
        <button onClick={onCanvas} className="group relative w-full h-[255px] rounded-2xl border overflow-hidden text-left" style={{ background: 'linear-gradient(135deg, color-mix(in oklab, var(--command-panel-elevated) 92%, white 6%), var(--command-bg))', borderColor: 'var(--command-border)' }}>
          <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(var(--command-border) 1px, transparent 1px), linear-gradient(90deg, var(--command-border) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="absolute left-8 top-8 right-8 bottom-8 rounded-xl border" style={{ background: 'rgba(247,250,252,0.88)', borderColor: 'rgba(247,250,252,0.38)' }}>
            <div className="absolute left-0 top-1/2 right-0 h-px bg-slate-500/50" />
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-slate-500/50" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-slate-500/50" />
            <div className="absolute left-[12%] top-[18%] w-28 h-24 rounded-full bg-sky-400/25" />
            <div className="absolute right-[13%] top-[15%] w-36 h-36 rounded-full bg-cyan-400/25" />
            <div className="absolute left-[46%] bottom-[14%] w-44 h-32 rounded-full bg-indigo-400/20" />
            <Video className="absolute left-[16%] top-[25%] w-5 h-5 text-sky-600" />
            <DoorOpen className="absolute right-[27%] top-[39%] w-5 h-5 text-amber-600" />
            <Route className="absolute left-[43%] bottom-[32%] w-5 h-5 text-cyan-600" />
          </div>
          <div className="absolute left-4 bottom-4 right-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--command-faint)' }}>Engineering surface</div>
              <div className="text-sm font-semibold" style={{ color: 'var(--command-fg)' }}>Open design canvas</div>
            </div>
            <ArrowRight className="w-4 h-4" style={{ color: 'var(--command-accent)' }} />
          </div>
        </button>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SmallMetric label="Devices" value={deviceCount} />
          <SmallMetric label="Doors" value={doorCount} />
          <SmallMetric label="Routes" value={pathwayCount} />
          <SmallMetric label="Assets" value={assetCount} />
        </div>
      </div>
    </div>
  );
}

function SignalDeck({ openOpps, projects, openTasks, tickets, warranties }: { openOpps: number; projects: number; openTasks: number; tickets: number; warranties: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      <Signal icon={WalletCards} label="Open opps" value={openOpps} />
      <Signal icon={Building2} label="Projects" value={projects} />
      <Signal icon={ClipboardCheck} label="Tasks" value={openTasks} />
      <Signal icon={TicketCheck} label="Tickets" value={tickets} />
      <Signal icon={ShieldCheck} label="Warranty" value={warranties} alert={warranties > 0} />
    </div>
  );
}

function Signal({ icon: Icon, label, value, alert = false }: { icon: any; label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--command-panel)', borderColor: alert ? 'color-mix(in oklab, var(--command-warning) 36%, var(--command-border))' : 'var(--command-border)' }}>
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4" style={{ color: alert ? 'var(--command-warning)' : 'var(--command-cyan)' }} />
        <span className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--command-fg)' }}>{value}</span>
      </div>
      <div className="mt-2 text-xs" style={{ color: 'var(--command-muted)' }}>{label}</div>
    </div>
  );
}

function AIWatchPanel({ activeProjectId, devices, doors, pathways, onOpen }: { activeProjectId: string; devices: number; doors: number; pathways: number; onOpen: () => void }) {
  const readiness = [
    { label: 'Coverage data', ok: devices > 0 },
    { label: 'Door inventory', ok: doors > 0 },
    { label: 'Pathway routing', ok: pathways > 0 },
  ];
  return (
    <div className="rounded-2xl border p-4" style={{ background: 'var(--command-panel)', borderColor: 'var(--command-border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--command-cyan)' }}>
            <Sparkles className="w-4 h-4" />
            Deeper Vision AI
          </div>
          <div className="mt-2 text-lg font-semibold" style={{ color: 'var(--command-fg)' }}>Project intelligence is grounded by records.</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--command-muted)' }}>AI should warn, explain, and draft. It should not silently change designs or certify compliance.</div>
        </div>
        <button onClick={onOpen} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: 'color-mix(in oklab, var(--command-cyan) 14%, transparent)', color: 'var(--command-cyan)' }}>Open AI</button>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {readiness.map((r) => (
          <div key={r.label} className="rounded-lg border p-3" style={{ borderColor: 'var(--command-border)', background: 'var(--command-panel-elevated)' }}>
            <BadgeCheck className="w-4 h-4" style={{ color: r.ok ? 'var(--command-accent)' : 'var(--command-faint)' }} />
            <div className="mt-2 text-xs" style={{ color: 'var(--command-muted)' }}>{r.label}</div>
            <div className="text-xs font-medium" style={{ color: r.ok ? 'var(--command-accent)' : 'var(--command-faint)' }}>{r.ok ? 'Available' : 'Needs data'}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs" style={{ color: 'var(--command-faint)' }}>Current scope: {activeProjectId}</div>
    </div>
  );
}

function WorkflowBoard({ modules, navigate }: { modules: Array<{ label: string; eyebrow: string; href: string; icon: any; count: number; note: string }>; navigate: (href: string) => void }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--command-panel)', borderColor: 'var(--command-border)' }}>
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--command-border)' }}>
        <div>
          <div className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--command-faint)' }}>Workflow spine</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--command-fg)' }}>Every module should move the same record forward.</div>
        </div>
        <Workflow className="w-5 h-5" style={{ color: 'var(--command-accent)' }} />
      </div>
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <button key={m.label} onClick={() => navigate(m.href)} className="rounded-xl border p-4 text-left" style={{ background: 'var(--command-panel-elevated)', borderColor: 'var(--command-border)' }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in oklab, var(--command-accent) 13%, transparent)', color: 'var(--command-accent)' }}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--command-faint)' }}>{m.eyebrow}</div>
                  <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--command-fg)' }}>{m.label}</div>
                  <div className="mt-1 text-xs leading-snug" style={{ color: 'var(--command-muted)' }}>{m.note}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActivityFeed({ activity }: { activity: any[] }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--command-panel)', borderColor: 'var(--command-border)' }}>
      <div className="p-4 border-b" style={{ borderColor: 'var(--command-border)' }}>
        <div className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--command-faint)' }}>Activity</div>
        <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--command-fg)' }}>Latest movement</div>
      </div>
      <div>
        {activity.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: 'var(--command-muted)' }}>No activity yet.</div>
        ) : activity.map((item) => (
          <div key={item.id} className="px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'var(--command-border)' }}>
            <div className="text-sm leading-snug" style={{ color: 'var(--command-fg)' }}>{item.message ?? item.title ?? 'Project activity'}</div>
            <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: 'var(--command-faint)' }}>
              <CalendarClock className="w-3 h-3" />
              {formatAge(item.createdAt)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-2" style={{ background: 'var(--command-panel-elevated)', borderColor: 'var(--command-border)' }}>
      <div className="text-lg font-semibold tabular-nums" style={{ color: 'var(--command-fg)' }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--command-muted)' }}>{label}</div>
    </div>
  );
}

function formatAge(value: any) {
  const time = typeof value === 'number' ? value : Date.parse(value ?? '');
  if (!Number.isFinite(time)) return 'No timestamp';
  const diff = Date.now() - time;
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
