// MobileActionsMenu — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. The narrow-viewport
// fallback for the top-bar action cluster: a single "more" icon
// that opens a sheet with the same project actions + view-mode
// + fullscreen toggles that desktop renders as separate chips.
// Pure presentational — all behaviour comes in via props.

import { BarChart3, Check, Columns3, HardHat, Maximize, Maximize2, MoreHorizontal, Presentation, Square, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function MobileActionsMenu(props: {
  projectId: string;
  onOpenScanBuild: () => void;
  onOpenBom: () => void;
  onOpenReview: () => void;
  onOpenDeployment: () => void;
  viewMode: 'default' | 'field' | 'canvas';
  setViewMode: (m: 'default' | 'field' | 'canvas') => void;
  isFullscreen: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);
  const item = (icon: any, label: string, onClick: () => void, tone?: 'primary' | 'success' | 'warning') => {
    const Icon = icon;
    const toneClass = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-amber-500' : tone === 'primary' ? 'text-primary' : 'text-foreground';
    return (
      <button
        onClick={() => { onClick(); setOpen(false); }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-secondary/40"
      >
        <Icon className={`w-4 h-4 flex-none ${toneClass}`} />
        <span>{label}</span>
      </button>
    );
  };
  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Actions"
        aria-label="Open actions menu"
        data-track="topbar-mobile-actions"
        className={`inline-flex items-center justify-center h-9 w-9 rounded-lg border ${open ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:bg-secondary text-foreground'}`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-10 z-[60] w-[240px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          role="menu"
        >
          <div className="border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Project</div>
          {item(Upload, 'Add plan', props.onOpenScanBuild, 'primary')}
          {item(BarChart3, 'BOM & Estimate', props.onOpenBom)}
          {item(Presentation, 'Present (customer view)', props.onOpenReview, 'success')}
          {item(HardHat, 'Deploy (work orders)', props.onOpenDeployment, 'warning')}
          <div className="border-t border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">View mode</div>
          {(['default', 'field', 'canvas'] as const).map((m) => {
            const active = props.viewMode === m;
            const Icon = m === 'default' ? Columns3 : m === 'field' ? Square : Maximize;
            return (
              <button
                key={m}
                onClick={() => { props.setViewMode(m); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-secondary/40 ${active ? 'text-primary bg-primary/5' : 'text-foreground'}`}
              >
                <Icon className="w-4 h-4 flex-none" />
                <span className="capitalize">{m}</span>
                {active && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
              </button>
            );
          })}
          <div className="border-t border-border">
            {item(Maximize2, props.isFullscreen ? 'Exit fullscreen' : 'Fullscreen monitor', props.isFullscreen ? props.onExitFullscreen : props.onEnterFullscreen)}
          </div>
        </div>
      )}
    </div>
  );
}
