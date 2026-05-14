import { ReactNode, useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { BrandLogo } from './BrandLogo';
import { Button } from './Button';
import {
  Command, Search, Settings, HelpCircle, ChevronRight, X, Check,
  User as UserIcon, Layers as LayersIcon,
} from 'lucide-react';
import { useProjectStore, defaultModeForPhase } from '../store/projectStore';
import type { ProjectMode, UserRole } from '../store/types';

interface Crumb { label: string; to?: string; }

interface AppShellProps {
  crumbs?: Crumb[];
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  rightPanel?: ReactNode;
  rightPanelTitle?: string;
  rightPanelDefaultOpen?: boolean;
  children: ReactNode;
  fullBleed?: boolean;
}

export function AppShell({
  crumbs = [],
  title,
  subtitle,
  actions,
  rightPanel,
  rightPanelTitle = 'Inspector',
  rightPanelDefaultOpen = false,
  children,
  fullBleed = false,
}: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [panelOpen, setPanelOpen] = useState(rightPanelDefaultOpen);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header — 52px, single line */}
      <header className="h-[52px] shrink-0 border-b border-border bg-background flex items-center px-4 gap-3">
        <button onClick={() => navigate('/projects')} className="flex items-center gap-2 shrink-0">
          <BrandLogo variant="compact" theme="dark" height={22} />
        </button>

        <div className="h-5 w-px bg-border mx-1" />

        <nav className="flex items-center gap-1.5 min-w-0 flex-1">
          {crumbs.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              {c.to ? (
                <button onClick={() => navigate(c.to!)} className="text-muted-foreground hover:text-foreground truncate">
                  {c.label}
                </button>
              ) : (
                <span className="truncate text-foreground">{c.label}</span>
              )}
            </div>
          ))}
        </nav>

        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors w-56"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-xs flex-1 text-left">Jump to…</span>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">⌘K</kbd>
        </button>

        {actions}

        <ModeRolePill />

        <button onClick={() => navigate('/help')} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Help">
          <HelpCircle className="w-4 h-4" />
        </button>
        <button onClick={() => navigate('/settings')} className={`p-1.5 rounded-md hover:bg-secondary transition-colors ${location.pathname.startsWith('/settings') ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`} title="Settings">
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* Title bar — optional, 44px */}
      {(title || subtitle) && (
        <div className="shrink-0 border-b border-border bg-background px-4 py-2.5 flex items-baseline gap-3">
          {title && <h1 className="text-lg font-medium tracking-tight">{title}</h1>}
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 flex">
        <main className={`flex-1 min-w-0 ${fullBleed ? '' : 'overflow-auto'}`}>
          {children}
        </main>

        {rightPanel && (
          <aside className={`shrink-0 border-l border-border bg-background transition-all duration-200 ease-out overflow-hidden ${panelOpen ? 'w-80' : 'w-9'}`}>
            <div className="h-9 border-b border-border flex items-center px-2.5 gap-2">
              <button onClick={() => setPanelOpen((v) => !v)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                {panelOpen ? <X className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5 rotate-180" />}
              </button>
              {panelOpen && <span className="text-xs font-medium">{rightPanelTitle}</span>}
            </div>
            {panelOpen && <div className="overflow-auto h-[calc(100%-2.25rem)]">{rightPanel}</div>}
          </aside>
        )}
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Mode & role switcher — small pill in the header that surfaces the
// user's current operating mode for the active project and their role.
// Click to open a calm two-column popover. Designed to feel
// intentional, not enterprise-cluttered.
// ─────────────────────────────────────────────────────────────────

const ROLE_META: { id: UserRole; label: string; hint: string }[] = [
  { id: 'sales',     label: 'Sales',     hint: 'Pipeline, accounts, proposals' },
  { id: 'estimator', label: 'Estimator', hint: 'BOM, pricing, margin' },
  { id: 'engineer',  label: 'Engineer',  hint: 'Canvas, devices, pathways' },
  { id: 'pm',        label: 'PM',        hint: 'Deployment, schedule, owners' },
  { id: 'field',     label: 'Field tech', hint: 'Install, commissioning, punch' },
  { id: 'service',   label: 'Service',   hint: 'Maintenance, change orders' },
  { id: 'customer',  label: 'Customer',  hint: 'Portal view (read-only)' },
];

const MODE_META: { id: ProjectMode; label: string; hint: string }[] = [
  { id: 'survey',       label: 'Survey',       hint: 'Site walk, photos, threat profile' },
  { id: 'engineering',  label: 'Engineering',  hint: 'Place devices, draw FOV, route cable' },
  { id: 'estimate',     label: 'Estimate',     hint: 'Roll up BOM and pricing' },
  { id: 'proposal',     label: 'Proposal',     hint: 'Customer review surface' },
  { id: 'deployment',   label: 'Deployment',   hint: 'Work orders, install, change orders' },
  { id: 'service',      label: 'Service',      hint: 'Operate, maintenance, support' },
  { id: 'presentation', label: 'Presentation', hint: 'Clean canvas for demo and walkthroughs' },
];

function ModeRolePill() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Detect current project context — same regex used by CommandPalette.
  const projectId = useMemo(() => {
    const m = location.pathname.match(
      /^\/(?:project|estimate|portal|live|sitewalk|commission|pathways|flow|threat|layers|power|proposal|permit|workorders|maintenance|changeorders|intake|calibrate|ai)\/([^/]+)/,
    );
    return m?.[1] ?? null;
  }, [location.pathname]);

  const currentRole = useProjectStore((s) => s.currentRole);
  const projectModes = useProjectStore((s) => s.projectModes);
  const projectsMap = useProjectStore((s) => s.projects);
  const setUserRole = useProjectStore((s) => s.setUserRole);
  const setProjectMode = useProjectStore((s) => s.setProjectMode);

  // Effective mode: user override beats phase-derived default. Computed
  // locally so we don't subscribe to the selector (which would force
  // re-renders on unrelated store changes).
  const mode: ProjectMode | null = useMemo(() => {
    if (!projectId) return null;
    if (projectModes[projectId]) return projectModes[projectId];
    const phase = projectsMap[projectId]?.lifecyclePhase;
    return phase ? defaultModeForPhase(phase) : 'engineering';
  }, [projectId, projectModes, projectsMap]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const roleLabel = ROLE_META.find((r) => r.id === currentRole)?.label ?? 'Engineer';
  const modeLabel = mode ? MODE_META.find((m) => m.id === mode)?.label : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${open ? 'border-border-strong bg-secondary' : 'border-border text-muted-foreground hover:text-foreground hover:border-border-strong'}`}
        title="Current role and mode"
      >
        <UserIcon className="w-3 h-3" />
        <span className="text-foreground">{roleLabel}</span>
        {modeLabel && (
          <>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground">{modeLabel}</span>
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 w-[460px] bg-card border border-border-strong rounded-lg shadow-2xl overflow-hidden"
          style={{ backdropFilter: 'blur(14px)' }}
        >
          <div className="grid grid-cols-2 divide-x divide-border">
            {/* ── Role column ── */}
            <div>
              <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <UserIcon className="w-3 h-3" /> Role
              </div>
              <div className="px-1 pb-1.5">
                {ROLE_META.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setUserRole(r.id); }}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-start gap-2 transition-colors ${currentRole === r.id ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}
                  >
                    <span className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${currentRole === r.id ? 'text-primary' : 'text-transparent'}`}>
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block leading-tight">{r.label}</span>
                      <span className="block text-[10px] text-muted-foreground leading-tight mt-0.5">{r.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Mode column ── */}
            <div>
              <div className="px-3 pt-2.5 pb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <LayersIcon className="w-3 h-3" /> Mode
                {projectId && projectModes[projectId] && (
                  <button
                    onClick={() => setProjectMode(projectId, null)}
                    className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
                    title="Reset to phase default"
                  >
                    auto
                  </button>
                )}
              </div>
              {!projectId ? (
                <div className="px-3 py-3 text-xs text-muted-foreground leading-relaxed">
                  Open a project to switch modes. Mode is what tools and overlays appear on screen.
                </div>
              ) : (
                <div className="px-1 pb-1.5">
                  {MODE_META.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setProjectMode(projectId, m.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-start gap-2 transition-colors ${mode === m.id ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}
                    >
                      <span className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${mode === m.id ? 'text-primary' : 'text-transparent'}`}>
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block leading-tight">{m.label}</span>
                        <span className="block text-[10px] text-muted-foreground leading-tight mt-0.5">{m.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');

  // Detect current project context from the URL. When the user is on any
  // /project/:id/... (or any project-scoped page like /estimate/:id), we
  // substitute that real id into the command palette's project routes so
  // we never navigate to a hardcoded 'p1' demo path that doesn't match the
  // active project. When NOT in a project context we hide project-scoped
  // entries entirely.
  const contextProjectId = useMemo(() => {
    const m = location.pathname.match(
      /^\/(?:project|estimate|portal|live|sitewalk|commission|pathways|flow|threat|layers|power|proposal|permit|workorders|maintenance|changeorders|intake|calibrate|ai)\/([^/]+)/,
    );
    return m?.[1] ?? null;
  }, [location.pathname]);

  // Project-scoped items: only shown when a project is active. Each uses
  // the literal `:id` placeholder which we substitute below.
  const projectScoped: { label: string; path: string; group: string }[] = [
    { label: 'Project overview',     path: '/project/:id',           group: 'This project' },
    { label: 'Engineering canvas',   path: '/project/:id/canvas',    group: 'This project' },
    { label: 'Site walk',            path: '/sitewalk/:id',          group: 'This project' },
    { label: 'VisionScan',           path: '/visionscan',            group: 'This project' },
    { label: 'Calibration',          path: '/calibrate/:id',         group: 'This project' },
    { label: 'Estimator',            path: '/estimate/:id',          group: 'This project' },
    { label: 'Proposal builder',     path: '/proposal/:id',          group: 'This project' },
    { label: 'Customer portal',      path: '/portal/:id',            group: 'This project' },
    { label: 'Permit & compliance',  path: '/permit/:id',            group: 'This project' },
    { label: 'Threat simulator',     path: '/threat/:id',            group: 'Analyze' },
    { label: 'Power & cable plan',   path: '/power/:id',             group: 'Analyze' },
    { label: 'Pathway routing',      path: '/pathways/:id',          group: 'Analyze' },
    { label: 'Flow view',            path: '/flow/:id',              group: 'Analyze' },
    { label: 'AI assistant',         path: '/ai/:id',                group: 'Tools' },
    { label: 'Commissioning',        path: '/commission/:id',        group: 'Deploy' },
    { label: 'Work orders',          path: '/workorders/:id',        group: 'Deploy' },
    { label: 'Change orders',        path: '/changeorders/:id',      group: 'Deploy' },
    { label: 'Maintenance',          path: '/maintenance/:id',       group: 'Operate' },
  ];

  // Global items always present.
  const global: { label: string; path: string; group: string }[] = [
    { label: 'Projects',         path: '/projects', group: 'Navigate' },
    { label: 'Sales pipeline',   path: '/crm',      group: 'CRM' },
    { label: 'Device library',   path: '/devices',  group: 'Navigate' },
    { label: 'Knowledge base',   path: '/kb',       group: 'Reference' },
    { label: 'Help center',      path: '/help',     group: 'Reference' },
    { label: 'Settings',         path: '/settings', group: 'Account' },
  ];

  const items = contextProjectId
    ? [
        ...projectScoped.map((i) => ({ ...i, path: i.path.replaceAll(':id', contextProjectId) })),
        ...global,
      ]
    : global;

  const filtered = q ? items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())) : items;
  const groups = Array.from(new Set(filtered.map((i) => i.group)));

  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-start justify-center pt-[12vh]" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-border-strong rounded-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Command className="w-4 h-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to a screen…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">esc</kbd>
        </div>
        <div className="max-h-96 overflow-auto p-1.5">
          {groups.map((g) => (
            <div key={g} className="mb-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">{g}</div>
              {filtered.filter((i) => i.group === g).map((i) => (
                <button
                  key={i.path}
                  onClick={() => { navigate(i.path); onClose(); }}
                  className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-secondary flex items-center justify-between"
                >
                  <span>{i.label}</span>
                  <span className="text-[10px] text-muted-foreground">{i.path}</span>
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-xs text-muted-foreground p-4 text-center">No matches</div>}
        </div>
      </div>
    </div>
  );
}
