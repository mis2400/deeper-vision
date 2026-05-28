// TopBar — extracted from screens/EngineeringCanvas.tsx as part
// of the M11 monolith breakup. The thin canvas chrome strip
// across the top: floor switcher, undo/redo, primary project
// actions (Add plan / BOM / Present / Deploy / Project state),
// view-mode segmented control, fullscreen, and the More overflow
// menu (theme picker, reports, snap, intelligence, plan source,
// pop-out, demo scan). Reads/writes canvasTheme on the store;
// every other piece comes in via props.

import {
  Activity,
  BarChart3,
  Columns3,
  ExternalLink,
  FileBarChart,
  FileText,
  HardHat,
  Magnet,
  Maximize,
  Maximize2,
  MoreHorizontal,
  Presentation,
  Sparkles,
  Square,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ProjectStateMenu } from '../../components/canvas/ProjectStateMenu';
import { useProjectStore } from '../../store/projectStore';
import { FloorSwitcher } from './FloorSwitcher';
import { MobileActionsMenu } from './MobileActionsMenu';
import { UndoRedoButtons } from './UndoRedoButtons';

export function TopBar(props: {
  floor: number; setFloor: (n: number) => void;
  /** Active project id for the floor switcher lookup. */
  projectId: string;
  /** Display name fallback when the floor list query is empty. */
  floorName: string;
  snap: boolean; setSnap: (b: boolean) => void;
  units: 'ft' | 'm'; setUnits: (u: 'ft' | 'm') => void;
  onScan: () => void; onSetup: () => void;
  techModel: 'cloud' | 'on_prem' | 'hybrid';
  setTechModel: (m: 'cloud' | 'on_prem' | 'hybrid') => void;
  isFullscreen: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
  viewMode: 'default' | 'field' | 'canvas';
  setViewMode: (m: 'default' | 'field' | 'canvas') => void;
  onOpenScanBuild: () => void;
  onOpenReport: () => void;
  onOpenBom: () => void;
  /** Opens the customer / reviewer presentation route. */
  onOpenReview: () => void;
  /** Opens the field deployment / work orders route. */
  onOpenDeployment: () => void;
  /** Opens the reports / proposal package route. */
  onOpenReports: () => void;
  /** Compact = render only the essentials. Used in Field view so the bar
   *  is a thin operations strip rather than a full chrome row. */
  compact?: boolean;
  intelOpen: boolean;
  setIntelOpen: (b: boolean) => void;
  onPopOut: () => void;
}) {
  const canvasTheme = useProjectStore((s) => s.canvasTheme);
  const setCanvasTheme = useProjectStore((s) => s.setCanvasTheme);
  const compact = !!props.compact;
  // Overflow menu — collects secondary controls (theme, presence, intel,
  // pop-out, plan source) so the bar reads as a quiet operations strip.
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [moreOpen]);
  return (
    <div
      className={`shrink-0 border-b border-border bg-background/80 backdrop-blur-md flex items-center pl-2 sm:pl-3 pr-1.5 sm:pr-2 gap-1.5 sm:gap-2 text-sm relative z-[45] ${compact ? 'h-11' : 'h-12'}`}
      style={{
        background: 'linear-gradient(180deg, color-mix(in oklab, var(--command-panel) 96%, white 4%), var(--command-bg))',
        borderColor: 'var(--command-border)',
        color: 'var(--command-fg)',
        boxShadow: 'var(--command-shadow)',
      }}
    >
      {/* Canvas V2 Pass 1.5.1 — top toolbar overflow strategy. Mobile
          (under md = 768 px) collapses the desktop chrome buttons into
          a single MobileActionsMenu so nothing wraps or gets cut off.
          Floor switcher + Undo/Redo stay visible because they are the
          most-used canvas primitives. */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        {/* Floor picker stays visible on mobile — it's the primary
            multi floor affordance. */}
        <FloorSwitcher projectId={props.projectId} />
        <UndoRedoButtons />
        {/* Desktop only: Add plan / BOM / Present / Deploy / Project state.
            Each hides under md. The MobileActionsMenu below reopens
            them via the overflow sheet. */}
        <button
          onClick={props.onOpenScanBuild}
          title="Add a floor plan — upload PDF/image, trace satellite, scan demo, or start blank"
          className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 transition-colors whitespace-nowrap"
          style={{
            background: 'var(--command-accent)',
            borderColor: 'var(--command-accent)',
            color: 'var(--command-accent-foreground)',
            boxShadow: '0 8px 22px -14px var(--command-accent)',
          }}
          data-track="topbar-add-plan"
        >
          <Upload className="w-3.5 h-3.5" />Add plan
        </button>
        <button
          onClick={props.onOpenBom}
          title="BOM & Estimate — derived live from the canvas"
          className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border border-border hover:bg-secondary/50 text-foreground transition-colors whitespace-nowrap"
          style={{
            background: 'var(--command-panel-elevated)',
            borderColor: 'var(--command-border)',
            color: 'var(--command-fg)',
          }}
          data-track="topbar-bom"
        >
          <BarChart3 className="w-3.5 h-3.5" />BOM & Estimate
        </button>
        <button
          onClick={props.onOpenReview}
          title="Open the customer / reviewer presentation view of this project"
          className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-500 transition-colors whitespace-nowrap"
          style={{
            background: 'color-mix(in oklab, var(--command-cyan) 12%, transparent)',
            borderColor: 'color-mix(in oklab, var(--command-cyan) 34%, transparent)',
            color: 'var(--command-cyan)',
          }}
          data-track="topbar-review"
        >
          <Presentation className="w-3.5 h-3.5" />Present
        </button>
        <button
          onClick={props.onOpenDeployment}
          title="Open Field Deployment — work orders generated live from the canvas"
          className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 transition-colors whitespace-nowrap"
          style={{
            background: 'color-mix(in oklab, var(--command-warning) 11%, transparent)',
            borderColor: 'color-mix(in oklab, var(--command-warning) 30%, transparent)',
            color: 'var(--command-warning)',
          }}
          data-track="topbar-deploy"
        >
          <HardHat className="w-3.5 h-3.5" />Deploy
        </button>
        <div className="hidden md:flex"><ProjectStateMenu projectId={props.projectId} commandChrome /></div>
      </div>

      <div className="flex-1" />

      {/* Mobile actions overflow — only renders under md. Bundles
          every desktop only action into a sheet so the top bar stays
          a thin two-row hierarchy at 375 px. */}
      <div className="flex md:hidden">
        <MobileActionsMenu
          projectId={props.projectId}
          onOpenScanBuild={props.onOpenScanBuild}
          onOpenBom={props.onOpenBom}
          onOpenReview={props.onOpenReview}
          onOpenDeployment={props.onOpenDeployment}
          viewMode={props.viewMode}
          setViewMode={props.setViewMode}
          isFullscreen={props.isFullscreen}
          onEnterFullscreen={props.onEnterFullscreen}
          onExitFullscreen={props.onExitFullscreen}
        />
      </div>

      {/* Right — view picker, fullscreen, more menu, AI. Desktop only;
          mobile reaches the same actions through MobileActionsMenu. */}
      <div
        className="hidden md:flex items-stretch h-8 border border-border rounded-lg overflow-hidden"
        style={{
          background: 'var(--command-panel)',
          borderColor: 'var(--command-border)',
        }}
      >
        {([
          { id: 'default' as const, label: 'Default', icon: Columns3, hint: 'Default — full chrome (rails + dock)' },
          { id: 'field' as const,   label: 'Field',   icon: Square,   hint: 'Field — slim TopBar, no side rails, canvas is the hero' },
          { id: 'canvas' as const,  label: 'Canvas',  icon: Maximize, hint: 'Full Canvas — only floating controls (Esc exits)' },
        ]).map((m) => {
          const active = props.viewMode === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => props.setViewMode(m.id)}
              title={m.hint}
              data-track={`topbar-view-${m.id}`}
              className={`inline-flex items-center gap-1 px-2 text-[11px] border-r border-border last:border-r-0 transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
              style={{
                background: active ? 'color-mix(in oklab, var(--command-cyan) 16%, transparent)' : 'transparent',
                borderColor: 'var(--command-border)',
                color: active ? 'var(--command-cyan)' : 'var(--command-muted)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />{!compact && m.label}
            </button>
          );
        })}
      </div>
      <button
        onClick={props.isFullscreen ? props.onExitFullscreen : props.onEnterFullscreen}
        title={props.isFullscreen ? 'Exit fullscreen' : 'Fullscreen monitor'}
        className={`hidden md:inline-flex items-center justify-center h-8 w-8 rounded-lg border transition-colors ${props.isFullscreen ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:bg-secondary text-muted-foreground hover:text-foreground'}`}
        style={{
          background: props.isFullscreen ? 'color-mix(in oklab, var(--command-cyan) 16%, transparent)' : 'var(--command-panel)',
          borderColor: props.isFullscreen ? 'color-mix(in oklab, var(--command-cyan) 36%, transparent)' : 'var(--command-border)',
          color: props.isFullscreen ? 'var(--command-cyan)' : 'var(--command-muted)',
        }}
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>

      {/* Overflow menu — secondary controls (theme picker, intelligence,
          pop-out, plan source, presence). Keeps the visible bar quiet
          while the engineer still has one click away from anything they
          might need. */}
      <div className="hidden md:block relative" ref={moreRef}>
        <button
          onClick={() => setMoreOpen((v) => !v)}
          title="More options"
          data-track="topbar-more"
          className={`inline-flex items-center justify-center h-8 w-8 rounded-lg border transition-colors ${moreOpen ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:bg-secondary text-muted-foreground hover:text-foreground'}`}
          style={{
            background: moreOpen ? 'color-mix(in oklab, var(--command-cyan) 16%, transparent)' : 'var(--command-panel)',
            borderColor: moreOpen ? 'color-mix(in oklab, var(--command-cyan) 36%, transparent)' : 'var(--command-border)',
            color: moreOpen ? 'var(--command-cyan)' : 'var(--command-muted)',
          }}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {moreOpen && (
          <div
            className="absolute right-0 top-9 z-40 w-[260px] rounded-xl overflow-hidden"
            style={{
              background: 'var(--command-panel-elevated)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--command-border-strong)',
              color: 'var(--command-fg)',
              boxShadow: '0 22px 48px -16px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          >
            {/* Theme picker */}
            <div className="px-3 pt-3 pb-2 border-b border-border/60">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Theme</div>
              <div className="flex items-stretch border border-border/60 rounded-md overflow-hidden">
                {(['light', 'slate', 'dark'] as const).map((t) => {
                  const active = canvasTheme === t;
                  const label = t === 'light' ? 'Drafting' : t === 'slate' ? 'Slate' : 'Dark';
                  return (
                    <button
                      key={t}
                      onClick={() => setCanvasTheme(t)}
                      className={`flex-1 text-[11px] py-1.5 transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                      data-track={`topbar-more-theme-${t}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Proposal Package — moved here from the visible top bar in
                V1 P0.4. M11 audit fix (U4): the label used to read
                "Reports", which clashed with the sibling "Report
                Builder" entry below. Renamed to "Proposal Package"
                so the two items are distinguishable at a glance —
                this one ships the full customer set, the other
                composes ad hoc one off PDFs. Route + data-track id
                unchanged. */}
            <button
              onClick={() => { setMoreOpen(false); props.onOpenReports(); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors"
              data-track="topbar-more-reports"
            >
              <FileText className="w-3.5 h-3.5 text-sky-500" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px]">Proposal Package</div>
                <div className="text-[10px] text-muted-foreground">Customer ready PDFs and CSVs from this project</div>
              </div>
            </button>

            {/* Snap toggle — moved here from the visible top bar + the
                drawing rail (both duplicates removed in V1 P0.4). */}
            <button
              onClick={() => { props.setSnap(!props.snap); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors border-t border-border/40"
              data-track="topbar-more-snap"
            >
              <Magnet className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px]">Snap to grid</div>
                <div className="text-[10px] text-muted-foreground">{props.snap ? 'Vertices round to the 20 px grid.' : 'Free placement at sub grid precision.'}</div>
              </div>
              <span className={`text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded ${props.snap ? 'bg-primary/15 text-primary' : 'bg-secondary/40 text-muted-foreground'}`}>
                {props.snap ? 'On' : 'Off'}
              </span>
            </button>

            {/* Intelligence toggle */}
            <button
              onClick={() => { props.setIntelOpen(!props.intelOpen); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors border-t border-border/40"
              data-track="topbar-more-intel"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px]">AI Intelligence</div>
                <div className="text-[10px] text-muted-foreground">{props.intelOpen ? 'Chips + assistant visible' : 'Off — canvas stays calm'}</div>
              </div>
              <span className={`text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded ${props.intelOpen ? 'bg-primary/15 text-primary' : 'bg-secondary/40 text-muted-foreground'}`}>
                {props.intelOpen ? 'On' : 'Off'}
              </span>
            </button>

            {/* Report Builder — the new first-class export entry */}
            <button
              onClick={() => { setMoreOpen(false); props.onOpenReport(); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors"
              data-track="topbar-more-report"
            >
              <FileBarChart className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[12px]">Report Builder</span>
            </button>

            {/* Plan source */}
            <button
              onClick={() => { setMoreOpen(false); props.onSetup(); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors"
              data-track="topbar-more-plan"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[12px]">Plan source</span>
            </button>

            {/* Pop-out */}
            <button
              onClick={() => { setMoreOpen(false); props.onPopOut(); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors"
              data-track="topbar-more-popout"
            >
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[12px]">Open in new window</span>
            </button>

            {/* Demo scan — relabelled + always under More so it cannot be
                mistaken for the real Surveyor entrypoint. The /visionscan
                route is a simulated walkthrough, not a live capture. */}
            <button
              onClick={() => { setMoreOpen(false); props.onScan(); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors border-t border-border/60"
              data-track="topbar-more-scan"
            >
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[12px]">Demo scan</span>
              <span className="ml-auto text-[9px] uppercase tracking-[0.14em] px-1 py-px rounded bg-amber-400/15 text-amber-300 border border-amber-400/25">
                Demo only
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Inline Demo scan button removed from the primary TopBar row.
          The simulated AR/LiDAR walkthrough lives under TopBar → More →
          "Demo scan" (Demo only). Keeping it inline made it read as the
          real Surveyor entrypoint. */}
    </div>
  );
}
