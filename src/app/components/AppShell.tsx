import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { BrandLogo } from './BrandLogo';
import { Button } from './Button';
import {
  Command, Search, Settings, HelpCircle, ChevronRight, X,
} from 'lucide-react';

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

function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const items = [
    { label: 'Projects', path: '/projects', group: 'Navigate' },
    { label: 'Engineering canvas', path: '/project/p1/canvas', group: 'Navigate' },
    { label: 'Device library', path: '/devices', group: 'Navigate' },
    { label: 'VisionScan', path: '/visionscan', group: 'Navigate' },
    { label: 'Estimator', path: '/estimate/p1', group: 'Navigate' },
    { label: 'Proposal builder', path: '/proposal/p1', group: 'Navigate' },
    { label: 'Permit & compliance', path: '/permit/p1', group: 'Navigate' },
    { label: 'Threat simulator', path: '/threat/p1', group: 'Analyze' },
    { label: 'Power & cable plan', path: '/power/p1', group: 'Analyze' },
    { label: 'Pathway routing', path: '/pathways/p1', group: 'Analyze' },
    { label: 'AI assistant', path: '/ai/p1', group: 'Tools' },
    { label: 'Commissioning', path: '/commission/p1', group: 'Build' },
    { label: 'Work orders', path: '/workorders/p1', group: 'Build' },
    { label: 'Maintenance', path: '/maintenance/p1', group: 'Operate' },
    { label: 'Customer portal', path: '/portal/p1', group: 'Operate' },
    { label: 'Knowledge base', path: '/kb', group: 'Reference' },
    { label: 'Help center', path: '/help', group: 'Reference' },
    { label: 'Settings', path: '/settings', group: 'Account' },
  ];
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
