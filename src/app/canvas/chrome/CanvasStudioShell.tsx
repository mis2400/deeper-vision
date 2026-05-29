import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  Activity,
  BarChart3,
  ChevronDown,
  Columns3,
  ExternalLink,
  FileBarChart,
  FileText,
  Hand,
  HardHat,
  Layers,
  Magnet,
  Maximize,
  Maximize2,
  MessageSquare,
  Minus as WallIcon,
  MoreHorizontal,
  MousePointer2,
  PencilRuler,
  Presentation,
  Radar,
  Ruler,
  ScanEye,
  Sparkles,
  Square,
  Upload,
  Video,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ProjectStateMenu } from '../../components/canvas/ProjectStateMenu';
import { useProjectStore } from '../../store/projectStore';
import type { DeviceKind } from '../../store/types';
import type { Tool } from '../types';
import { FloorSwitcher } from './FloorSwitcher';
import { UndoRedoButtons } from './UndoRedoButtons';

type ViewMode = 'default' | 'field' | 'canvas';

interface CanvasStudioShellProps {
  projectId: string;
  floorName: string;
  tool: Tool;
  setTool: (tool: Tool) => void;
  snap: boolean;
  setSnap: (enabled: boolean) => void;
  units: 'ft' | 'm';
  counts: Partial<Record<DeviceKind, number>>;
  layersOpen: boolean;
  onToggleLayers: () => void;
  mapOpen: boolean;
  onToggleMap: () => void;
  coverageMode: 'soft' | 'hard';
  setCoverageMode: (mode: 'soft' | 'hard') => void;
  intelOpen: boolean;
  setIntelOpen: (open: boolean) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  onFit: () => void;
  onActual: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isFullscreen: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
  onOpenScanBuild: () => void;
  onOpenBom: () => void;
  onOpenReview: () => void;
  onOpenDeployment: () => void;
  onOpenReports: () => void;
  onOpenReport: () => void;
  onSetup: () => void;
  onScan: () => void;
  onPopOut: () => void;
  onOpenDeviceLibrary: () => void;
  onSetScale: () => void;
  scaleVerified: boolean;
  scaleLabel: string;
}

const surface = {
  background: 'linear-gradient(180deg, color-mix(in oklab, var(--card) 94%, white 4%), var(--background))',
  borderColor: 'var(--border-strong)',
  color: 'var(--foreground)',
  boxShadow: '0 22px 58px -30px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.05)',
};

const elevated = {
  background: 'var(--background)',
  borderColor: 'var(--border)',
  color: 'var(--foreground)',
};

export function CanvasStudioShell(props: CanvasStudioShellProps) {
  const canvasTheme = useProjectStore((s) => s.canvasTheme);
  const setCanvasTheme = useProjectStore((s) => s.setCanvasTheme);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [moreOpen]);

  const cameraCount = props.counts.camera ?? 0;
  const accessCount = props.counts.access ?? 0;
  const networkCount = props.counts.network ?? 0;
  const zoomPct = Math.round(props.zoom * 100);

  const tools = [
    { id: 'select', label: 'Select', icon: MousePointer2, hint: 'Select and edit objects' },
    { id: 'pan', label: 'Pan', icon: Hand, hint: 'Move around the plan' },
    { id: 'measure', label: 'Measure', icon: Ruler, hint: 'Measure a distance' },
    { id: 'wall', label: 'Wall', icon: WallIcon, hint: 'Draw wall segments' },
    { id: 'room', label: 'Room', icon: Square, hint: 'Outline a room' },
    { id: 'annotate', label: 'Note', icon: MessageSquare, hint: 'Drop a note' },
  ] as const;

  const viewModes = [
    { id: 'default' as const, label: 'Studio', icon: Columns3 },
    { id: 'field' as const, label: 'Field', icon: Square },
    { id: 'canvas' as const, label: 'Focus', icon: Maximize },
  ];

  return (
    <div className="absolute inset-0 z-overlay pointer-events-none">
      <section
        className="pointer-events-auto absolute left-2 right-2 top-2 md:left-4 md:right-auto md:top-4 md:w-[430px] rounded-lg border overflow-hidden"
        style={surface}
      >
        <div className="p-2 sm:p-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-start gap-3">
            <div
              className="hidden sm:flex h-10 w-10 rounded-lg border items-center justify-center shrink-0"
              style={{
                background: 'color-mix(in oklab, var(--primary) 14%, transparent)',
                borderColor: 'color-mix(in oklab, var(--primary) 34%, var(--border))',
                color: 'var(--primary)',
              }}
            >
              <Radar className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="hidden sm:flex items-center gap-2 text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                Engineering studio
                <span className="h-1 w-1 rounded-full" style={{ background: 'var(--primary)' }} />
                <span>{props.scaleVerified ? 'Scale verified' : 'Scale pending'}</span>
              </div>
              <div className="sm:mt-1 flex items-center gap-2">
                <h2 className="hidden sm:block truncate text-base font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
                  {props.floorName}
                </h2>
                <span
                  className="hidden sm:inline-flex shrink-0 rounded border px-1.5 py-0.5 text-xs uppercase tracking-widest"
                  style={{
                    borderColor: 'var(--border)',
                    color: props.viewMode === 'field' ? 'var(--primary)' : 'var(--primary)',
                    background: 'var(--background)',
                  }}
                >
                  {props.viewMode === 'field' ? 'Survey' : 'Design'}
                </span>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1">
              <FloorSwitcher projectId={props.projectId} />
              <span className="hidden sm:inline-flex"><UndoRedoButtons /></span>
            </div>
          </div>
        </div>

        <div className="p-2 sm:p-3 grid grid-cols-5 sm:grid-cols-4 gap-1.5 sm:gap-2">
          <PrimaryAction
            dataTrack="topbar-add-plan"
            label="Add plan"
            icon={Upload}
            onClick={props.onOpenScanBuild}
            strong
          />
          <PrimaryAction
            dataTrack="canvas-add-fab"
            label="Devices"
            icon={Video}
            onClick={props.onOpenDeviceLibrary}
          />
          <PrimaryAction
            dataTrack="topbar-bom"
            label="BOM"
            icon={BarChart3}
            onClick={props.onOpenBom}
          />
          <PrimaryAction
            dataTrack="topbar-review"
            label="Present"
            icon={Presentation}
            onClick={props.onOpenReview}
            cyan
          />
          <PrimaryAction
            dataTrack="topbar-deploy"
            label="Deploy"
            icon={HardHat}
            onClick={props.onOpenDeployment}
            warning
          />
          <button
            onClick={props.onSetScale}
            data-testid="scale-set-btn"
            className="hidden sm:block rounded-lg border px-2.5 py-2 text-left transition-colors"
            style={elevated}
            title={props.scaleVerified ? 'Recalibrate this floor' : 'Set scale from a known feature'}
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <PencilRuler className="w-3.5 h-3.5" style={{ color: props.scaleVerified ? 'var(--primary)' : 'var(--primary)' }} />
              Scale
            </div>
            <div className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>{props.scaleLabel}</div>
          </button>
          <div className="hidden sm:block col-span-2">
            <ProjectStateMenu projectId={props.projectId} />
          </div>
        </div>
      </section>

      <section
        className="pointer-events-auto absolute left-1/2 -translate-x-1/2 bottom-4 w-auto rounded-lg border p-2 hidden sm:block"
        style={surface}
      >
        <div className="hidden">
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>Tools</div>
            <div className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{toolLabel(props.tool)}</div>
          </div>
          <div
            className="rounded border px-2 py-1 text-xs tabular-nums"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            {zoomPct}%
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {tools.map((tool) => {
            const active = props.tool === tool.id;
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => props.setTool(tool.id)}
                title={tool.hint}
                data-track={`left-rail-tools-${tool.id}`}
                className="h-10 min-w-[92px] rounded-md border px-2.5 flex items-center justify-center gap-2 transition-colors"
                style={{
                  background: active ? 'color-mix(in oklab, var(--primary) 15%, transparent)' : 'var(--background)',
                  borderColor: active ? 'color-mix(in oklab, var(--primary) 42%, var(--border))' : 'var(--border)',
                  color: active ? 'var(--primary)' : 'var(--foreground)',
                }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{tool.label}</span>
              </button>
            );
          })}
          <span aria-hidden className="h-8 w-px" style={{ background: 'var(--border)' }} />
          <IconButton dataTrack="intel-rail-zoom-out" title="Zoom out" icon={ZoomOut} onClick={() => props.setZoom(Math.max(0.25, props.zoom / 1.2))} />
          <button
            onClick={props.onFit}
            title="Fit plan"
            data-track="intel-rail-zoom-percent"
            className="h-10 w-[62px] rounded-md border text-xs font-semibold tabular-nums transition-colors"
            style={elevated}
          >
            {zoomPct}%
          </button>
          <IconButton dataTrack="intel-rail-zoom-in" title="Zoom in" icon={ZoomIn} onClick={() => props.setZoom(Math.min(4, props.zoom * 1.2))} />
          <IconButton dataTrack="intel-rail-zoom-actual" title="Actual size" icon={Maximize2} onClick={props.onActual} />
        </div>
      </section>

      <section
        className="pointer-events-auto absolute right-4 top-4 w-[300px] rounded-lg border overflow-hidden hidden xl:block"
        style={surface}
      >
        <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>Design signal</div>
              <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Coverage, doors, network</div>
            </div>
            <button
              onClick={() => props.setIntelOpen(!props.intelOpen)}
              data-track="studio-signal-intel"
              className="h-8 w-8 rounded-lg border flex items-center justify-center"
              style={{
                background: props.intelOpen ? 'color-mix(in oklab, var(--primary) 15%, transparent)' : 'var(--background)',
                borderColor: props.intelOpen ? 'color-mix(in oklab, var(--primary) 35%, var(--border))' : 'var(--border)',
                color: props.intelOpen ? 'var(--primary)' : 'var(--muted-foreground)',
              }}
              title="Toggle AI intelligence"
            >
              <Activity className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-3 grid grid-cols-3 gap-2">
          <SignalMetric label="Cameras" value={cameraCount} color="var(--primary)" />
          <SignalMetric label="Access" value={accessCount} color="var(--primary)" />
          <SignalMetric label="Network" value={networkCount} color="var(--primary)" />
        </div>
        <div className="px-3 pb-3 grid grid-cols-2 gap-2">
          <ToggleButton
            active={props.layersOpen}
            icon={Layers}
            label="Layers"
            onClick={props.onToggleLayers}
          />
          <ToggleButton
            active={props.mapOpen}
            icon={ScanEye}
            label="Plan source"
            onClick={props.onToggleMap}
          />
          <ToggleButton
            active={props.snap}
            icon={Magnet}
            label="Snap"
            dataTrack="studio-snap"
            onClick={() => props.setSnap(!props.snap)}
          />
          <ToggleButton
            active={props.coverageMode === 'hard'}
            icon={Radar}
            label={props.coverageMode === 'hard' ? 'Hard cones' : 'Soft cones'}
            onClick={() => props.setCoverageMode(props.coverageMode === 'hard' ? 'soft' : 'hard')}
          />
        </div>
      </section>

      <section
        className="pointer-events-auto absolute right-4 bottom-[112px] hidden lg:flex items-stretch rounded-lg border overflow-visible"
        style={surface}
      >
        {viewModes.map((mode) => {
          const active = props.viewMode === mode.id;
          const Icon = mode.icon;
          return (
            <button
              key={mode.id}
              onClick={() => props.setViewMode(mode.id)}
              data-track={`topbar-view-${mode.id}`}
              className="h-10 px-3 border-r last:border-r-0 flex items-center gap-2 text-xs font-medium"
              style={{
                borderColor: 'var(--border)',
                color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                background: active ? 'color-mix(in oklab, var(--primary) 14%, transparent)' : 'transparent',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {mode.label}
            </button>
          );
        })}
        <button
          onClick={props.isFullscreen ? props.onExitFullscreen : props.onEnterFullscreen}
          title={props.isFullscreen ? 'Exit fullscreen' : 'Fullscreen monitor'}
          className="h-10 w-10 flex items-center justify-center"
          style={{ color: props.isFullscreen ? 'var(--primary)' : 'var(--muted-foreground)' }}
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setMoreOpen((open) => !open)}
            data-track="topbar-more"
            title="More canvas actions"
            className="h-10 w-10 flex items-center justify-center border-l"
            style={{
              borderColor: 'var(--border)',
              color: moreOpen ? 'var(--primary)' : 'var(--muted-foreground)',
              background: moreOpen ? 'color-mix(in oklab, var(--primary) 14%, transparent)' : 'transparent',
            }}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {moreOpen && (
            <div
              className="absolute right-0 bottom-12 z-popover w-[292px] rounded-lg border overflow-hidden"
              style={surface}
            >
              <div className="px-3 pt-3 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--muted-foreground)' }}>Theme</div>
                <div className="grid grid-cols-3 gap-1">
                  {(['light', 'slate', 'dark'] as const).map((theme) => {
                    const active = canvasTheme === theme;
                    return (
                      <button
                        key={theme}
                        onClick={() => setCanvasTheme(theme)}
                        data-track={`topbar-more-theme-${theme}`}
                        className="rounded-lg border py-1.5 text-xs capitalize"
                        style={{
                          background: active ? 'color-mix(in oklab, var(--primary) 14%, transparent)' : 'var(--background)',
                          borderColor: active ? 'color-mix(in oklab, var(--primary) 36%, var(--border))' : 'var(--border)',
                          color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                        }}
                      >
                        {theme === 'light' ? 'Drafting' : theme}
                      </button>
                    );
                  })}
                </div>
              </div>
              <MenuAction dataTrack="topbar-more-reports" icon={FileText} label="Proposal package" note="Customer PDFs and CSVs" onClick={() => { setMoreOpen(false); props.onOpenReports(); }} />
              <MenuAction dataTrack="topbar-more-snap" icon={Magnet} label="Snap to grid" note={props.snap ? 'Vertices round to grid' : 'Free placement'} onClick={() => props.setSnap(!props.snap)} keepOpen />
              <MenuAction dataTrack="topbar-more-intel" icon={Activity} label="AI intelligence" note={props.intelOpen ? 'Visible on canvas' : 'Hidden'} onClick={() => props.setIntelOpen(!props.intelOpen)} keepOpen />
              <MenuAction dataTrack="topbar-more-report" icon={FileBarChart} label="Report builder" onClick={() => { setMoreOpen(false); props.onOpenReport(); }} />
              <MenuAction dataTrack="topbar-more-plan" icon={FileText} label="Plan source" onClick={() => { setMoreOpen(false); props.onSetup(); }} />
              <MenuAction dataTrack="topbar-more-popout" icon={ExternalLink} label="Open in new window" onClick={() => { setMoreOpen(false); props.onPopOut(); }} />
              <MenuAction dataTrack="topbar-more-scan" icon={Sparkles} label="Demo scan" note="Demo only" onClick={() => { setMoreOpen(false); props.onScan(); }} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PrimaryAction({
  dataTrack,
  label,
  icon: Icon,
  onClick,
  strong,
  cyan,
  warning,
}: {
  dataTrack: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  strong?: boolean;
  cyan?: boolean;
  warning?: boolean;
}) {
  const color = strong ? 'var(--primary)' : cyan ? 'var(--primary)' : warning ? 'var(--primary)' : 'var(--foreground)';
  return (
    <button
      onClick={onClick}
      data-track={dataTrack}
      className="rounded-lg border px-2 py-2 sm:px-2.5 text-left transition-colors min-w-0"
      style={{
        background: strong ? 'var(--primary)' : 'var(--background)',
        borderColor: strong ? 'var(--primary)' : 'var(--border)',
        color: strong ? 'var(--primary-foreground)' : color,
      }}
    >
      <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-2 text-xs sm:text-xs font-semibold leading-tight">
        <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
        <span className="truncate max-w-full">{label}</span>
      </div>
    </button>
  );
}

function IconButton({
  dataTrack,
  title,
  icon: Icon,
  onClick,
}: {
  dataTrack: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-track={dataTrack}
      title={title}
      className="h-9 rounded-lg border flex items-center justify-center transition-colors"
      style={elevated}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function ToggleButton({
  active,
  icon: Icon,
  label,
  onClick,
  dataTrack,
}: {
  active: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  dataTrack?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-track={dataTrack}
      className="h-10 rounded-lg border px-2.5 flex items-center gap-2 text-xs font-medium"
      style={{
        background: active ? 'color-mix(in oklab, var(--primary) 14%, transparent)' : 'var(--background)',
        borderColor: active ? 'color-mix(in oklab, var(--primary) 34%, var(--border))' : 'var(--border)',
        color: active ? 'var(--primary)' : 'var(--muted-foreground)',
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function SignalMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border p-2.5" style={elevated}>
      <div className="text-lg font-semibold tabular-nums" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
    </div>
  );
}

function MenuAction({
  dataTrack,
  icon: Icon,
  label,
  note,
  onClick,
  keepOpen,
}: {
  dataTrack: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  note?: string;
  onClick: () => void;
  keepOpen?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      data-track={dataTrack}
      className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b last:border-b-0"
      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: keepOpen ? 'var(--primary)' : 'var(--muted-foreground)' }} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium">{label}</span>
        {note && <span className="block text-xs" style={{ color: 'var(--muted-foreground)' }}>{note}</span>}
      </span>
      {keepOpen && <ChevronDown className="w-3 h-3" style={{ color: 'var(--muted-foreground)' }} />}
    </button>
  );
}

function toolLabel(tool: Tool) {
  if (tool === 'select') return 'Select objects';
  if (tool === 'pan') return 'Pan plan';
  if (tool === 'measure') return 'Measure distance';
  if (tool === 'wall') return 'Draw walls';
  if (tool === 'room') return 'Draw room';
  if (tool === 'annotate') return 'Annotate';
  if (tool === 'calibrate') return 'Set scale';
  if (tool === 'cable') return 'Cable route';
  if (tool === 'conduit') return 'Conduit route';
  if (tool === 'pathway') return 'Pathway route';
  return 'Design tool';
}
