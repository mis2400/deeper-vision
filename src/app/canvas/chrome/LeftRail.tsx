// LeftRail — M4 (real merge). Tools, View, Zoom in ONE container with
// ONE z token. Replaces the previous DrawingToolRail (top-left) +
// IntelligenceRail (bottom-left) split, which Mohammad called out as
// two separate floating chrome surfaces on the same edge. The earlier
// M4 ship moved IntelligenceRail to a hardcoded top-[480px] offset;
// that was brittle and only papered over the split. This component
// is the real merge: one column, three groups, subtle separators, no
// pixel offsets.
//
// Position contract:
//   - absolute top-3 left-3 (z token --z-rail from M2)
//   - icon-only at 44 px width by default, expands to ~170 px on
//     hover (desktop) or touch (coarse pointer) to show labels
//   - separators between Tools / View / Zoom groups
//   - pointer-events-auto over the canvas, no layout reflow
//
// All colors resolve via the canvas-rail tokens so the rail reads
// white-on-dark in every theme. Same tokens the SelectionMenu uses
// after the M7 readability fix.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MousePointer2, Hand, Ruler, Minus as WallIcon, Square, MessageSquare,
  Layers, Map as MapIcon, Magnet, ScanEye,
  ZoomIn, ZoomOut, Maximize2, Eye, EyeOff,
} from 'lucide-react';
import type { Tool } from '../types';

export interface LeftRailProps {
  // Tools group
  tool: Tool;
  setTool: (t: Tool) => void;

  // View group
  snap: boolean;
  setSnap: (b: boolean) => void;
  layersOpen: boolean;
  onToggleLayers: () => void;
  mapOpen?: boolean;
  onToggleMap?: () => void;
  // Coverage mode toggle is optional — controls the cone fill style.
  coverageMode?: 'soft' | 'hard';
  setCoverageMode?: (m: 'soft' | 'hard') => void;
  // Intelligence chip visibility — was in IntelligenceRail; merged in.
  chipsOpen?: boolean;
  setChipsOpen?: (b: boolean) => void;

  // Zoom group
  zoom: number;
  setZoom: (z: number) => void;
  onFit: () => void;
  onActual: () => void;
}

interface RailItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active?: boolean;
  onClick: () => void;
  // Optional custom glyph in place of the icon (used by the zoom-
  // percent tile to show "75%" instead of an icon).
  customGlyph?: React.ReactNode;
}

export function LeftRail(props: LeftRailProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [hoverExpand, setHoverExpand] = useState(false);
  const [touchExpand, setTouchExpand] = useState(false);
  const isCoarsePointer = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches,
    [],
  );
  const expanded = isCoarsePointer ? touchExpand : hoverExpand;

  // Outside-tap / Escape closes touch-expanded state. Desktop hover
  // self-clears on mouseleave, no handler needed.
  useEffect(() => {
    if (!touchExpand) return;
    const onDown = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setTouchExpand(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setTouchExpand(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [touchExpand]);

  // M11 audit fix (FL3 / UI1 follow up E68): publish the rail's real
  // right edge (measured from the viewport origin) to the
  // --canvas-rail-clearance CSS variable. Any overlay that needs to
  // clear the rail (FloorOverview today) reads the variable instead
  // of guessing a magic number. ResizeObserver fires on rail mount
  // and on hover expand / coarse pointer expand, so the value tracks
  // the actual rendered footprint. An extra 8 px is added as a
  // breathing buffer between rail and overlay content. The static
  // fallback in theme.css covers the SSR / pre mount frame.
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const publish = () => {
      const r = el.getBoundingClientRect();
      // r.right is viewport relative; for an absolute child of the
      // canvas viewport that means "distance from the left of the
      // overlay's coordinate space" — exactly what FloorOverview's
      // paddingLeft needs.
      document.documentElement.style.setProperty(
        '--canvas-rail-clearance',
        `${Math.ceil(r.right) + 8}px`,
      );
    };
    publish();
    const obs = new ResizeObserver(publish);
    obs.observe(el);
    window.addEventListener('resize', publish);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', publish);
    };
  }, []);

  // ─── Group items ────────────────────────────────────────────────
  const tools: RailItem[] = [
    { id: 'select',   icon: MousePointer2, label: 'Select',   hint: 'Select and edit objects',
      active: props.tool === 'select',   onClick: () => props.setTool('select') },
    { id: 'pan',      icon: Hand,          label: 'Pan',      hint: 'Drag to pan the floorplan',
      active: props.tool === 'pan',      onClick: () => props.setTool('pan') },
    { id: 'measure',  icon: Ruler,         label: 'Measure',  hint: 'Two clicks to measure distance',
      active: props.tool === 'measure',  onClick: () => props.setTool('measure') },
    { id: 'wall',     icon: WallIcon,      label: 'Wall',     hint: 'Draw wall segments',
      active: props.tool === 'wall',     onClick: () => props.setTool('wall') },
    { id: 'room',     icon: Square,        label: 'Room',     hint: 'Outline a room',
      active: props.tool === 'room',     onClick: () => props.setTool('room') },
    { id: 'annotate', icon: MessageSquare, label: 'Annotate', hint: 'Drop a note or callout',
      active: props.tool === 'annotate', onClick: () => props.setTool('annotate') },
  ];

  const view: RailItem[] = [
    { id: 'layers', icon: Layers, label: 'Layers', hint: 'Toggle engineering overlays',
      active: props.layersOpen, onClick: props.onToggleLayers },
    { id: 'map',    icon: MapIcon, label: 'Map',   hint: 'Scan / upload / satellite / sketch',
      active: !!props.mapOpen, onClick: () => props.onToggleMap?.() },
    { id: 'snap',   icon: Magnet, label: 'Snap',   hint: 'Magnetic alignment guides',
      active: props.snap, onClick: () => props.setSnap(!props.snap) },
  ];
  if (props.setCoverageMode) {
    view.push({
      id: 'coverage', icon: ScanEye,
      label: props.coverageMode === 'hard' ? 'Coverage · hard' : 'Coverage · soft',
      hint: 'Toggle cone fill style',
      active: props.coverageMode === 'hard',
      onClick: () => props.setCoverageMode?.(props.coverageMode === 'hard' ? 'soft' : 'hard'),
    });
  }
  if (props.setChipsOpen) {
    view.push({
      id: 'chips', icon: props.chipsOpen ? Eye : EyeOff,
      label: 'Intel chips', hint: 'Show on-canvas issue chips',
      active: !!props.chipsOpen,
      onClick: () => props.setChipsOpen?.(!props.chipsOpen),
    });
  }

  const zoomPct = Math.round(props.zoom * 100);
  const zoom: RailItem[] = [
    { id: 'zoom-out',    icon: ZoomOut, label: 'Zoom out',  hint: 'One step out',
      onClick: () => props.setZoom(Math.max(0.25, props.zoom / 1.2)) },
    {
      id: 'zoom-percent', icon: ZoomIn /* fallback */,
      label: `Zoom · ${zoomPct}%`, hint: 'Click to fit',
      onClick: () => props.onFit(),
      customGlyph: (
        <span
          className="inline-flex items-center justify-center min-w-[28px] h-[20px] px-1 rounded border whitespace-nowrap font-semibold tabular-nums"
          style={{
            fontSize: 'var(--chrome-sm)',
            background: 'var(--canvas-rail-active-bg)',
            borderColor: 'var(--canvas-rail-divider)',
            color: 'var(--canvas-rail-foreground)',
          }}
        >
          {zoomPct}%
        </span>
      ),
    },
    { id: 'zoom-in',     icon: ZoomIn, label: 'Zoom in', hint: 'One step in',
      onClick: () => props.setZoom(Math.min(4, props.zoom * 1.2)) },
    { id: 'zoom-actual', icon: Maximize2, label: 'Actual (1:1)', hint: 'Reset to actual scale',
      onClick: () => props.onActual() },
  ];

  // ─── Render ────────────────────────────────────────────────────
  // M11 visual redesign — larger tiles for modern touch feel, group
  // headers visible on hover-expand, two-shadow elevation with subtle
  // 1 px inset highlight on the top edge. The bar feels like raised
  // metal sitting above the plan rather than a flat dark slab.
  return (
    <div
      ref={railRef}
      data-canvas-chrome="left-rail"
      className="absolute top-4 left-3 md:left-4 z-rail pointer-events-auto select-none"
    >
      <div
        onMouseEnter={() => !isCoarsePointer && setHoverExpand(true)}
        onMouseLeave={() => !isCoarsePointer && setHoverExpand(false)}
        onTouchStart={() => isCoarsePointer && setTouchExpand(true)}
        data-rail-expanded={expanded ? 'true' : undefined}
        className="flex flex-col items-stretch rounded-2xl border backdrop-blur-xl overflow-hidden"
        style={{
          background: 'var(--canvas-rail)',
          borderColor: 'var(--canvas-rail-border)',
          color: 'var(--canvas-rail-foreground)',
          boxShadow: 'var(--shadow-rail), inset 0 1px 0 rgba(255,255,255,0.05)',
          padding: '8px',
          transitionProperty: 'width',
          transitionDuration: 'var(--motion-standard)',
          transitionTimingFunction: 'var(--ease-out)',
        }}
      >
        <RailGroupBlock label="Tools" expanded={expanded}>
          <RailItemRow items={tools} expanded={expanded} keyPrefix="tools" />
        </RailGroupBlock>
        <RailDivider />
        <RailGroupBlock label="View" expanded={expanded}>
          <RailItemRow items={view} expanded={expanded} keyPrefix="view" />
        </RailGroupBlock>
        <RailDivider />
        <RailGroupBlock label="Zoom" expanded={expanded}>
          <RailItemRow items={zoom} expanded={expanded} keyPrefix="zoom" />
        </RailGroupBlock>
      </div>
    </div>
  );
}

function RailDivider() {
  return (
    <div
      aria-hidden
      className="my-2 mx-2"
      style={{ height: '1px', background: 'var(--canvas-rail-divider)' }}
    />
  );
}

function RailGroupBlock({ label, expanded, children }: { label: string; expanded: boolean; children: React.ReactNode }) {
  // Group header — visible only when the rail is expanded. Always
  // mounted so the bar's height doesn't jitter on hover; opacity +
  // max-height animate the reveal so the eye reads the section
  // grouping without seeing layout shift.
  return (
    <div className="flex flex-col gap-1">
      <div
        aria-hidden
        className="px-2 uppercase font-medium whitespace-nowrap overflow-hidden"
        style={{
          fontSize: 'var(--chrome-2xs)',
          letterSpacing: '0.12em',
          color: 'var(--canvas-rail-foreground-faint)',
          maxHeight: expanded ? 16 : 0,
          // Collapse width too — not just height. Otherwise the
          // whitespace-nowrap label keeps its horizontal footprint while
          // hidden, forcing the whole rail wider than the icons and
          // leaving dead space to the right of every collapsed button.
          maxWidth: expanded ? undefined : 0,
          paddingTop: expanded ? 2 : 0,
          paddingBottom: expanded ? 4 : 0,
          opacity: expanded ? 1 : 0,
          transitionProperty: 'max-height, max-width, padding-top, padding-bottom, opacity',
          transitionDuration: 'var(--motion-standard)',
          transitionTimingFunction: 'var(--ease-out)',
        }}
      >
        {label}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function RailItemRow({ items, expanded, keyPrefix }: { items: RailItem[]; expanded: boolean; keyPrefix: string }) {
  return (
    <>
      {items.map((it) => {
        const Icon = it.icon;
        const isActive = !!it.active;
        const baseClass = `group relative flex items-center rounded-lg overflow-hidden ${
          expanded
            ? 'h-11 w-[200px] flex-row justify-start gap-3 px-3'
            : 'h-11 w-11 justify-center'
        }`;
        return (
          <button
            key={`${keyPrefix}-${it.id}`}
            onClick={it.onClick}
            title={it.hint ?? it.label}
            // Stable data-track per group so the runtime audit can
            // assert specific buttons render. The zoom controls keep
            // their legacy `intel-rail-*` track so the rail-has-zoom
            // assertion that previously caught the missing-zoom-in
            // regression keeps matching.
            data-track={keyPrefix === 'zoom' ? `intel-rail-${it.id}` : `left-rail-${keyPrefix}-${it.id}`}
            className={baseClass}
            style={{
              transitionProperty: 'background-color, color, transform, width',
              transitionDuration: 'var(--motion-fast)',
              transitionTimingFunction: 'var(--ease-out)',
              background: isActive ? 'var(--canvas-rail-active-bg)' : 'transparent',
              color: isActive ? 'var(--canvas-rail-foreground)' : 'var(--canvas-rail-foreground-muted)',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = 'var(--canvas-rail-hover-bg)';
              e.currentTarget.style.color = 'var(--canvas-rail-foreground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isActive ? 'var(--canvas-rail-active-bg)' : 'transparent';
              e.currentTarget.style.color = isActive ? 'var(--canvas-rail-foreground)' : 'var(--canvas-rail-foreground-muted)';
            }}
          >
            {it.customGlyph
              ? <span className="shrink-0 inline-flex items-center justify-center">{it.customGlyph}</span>
              : <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} />}
            {expanded && (
              <span
                className="flex-1 text-left whitespace-nowrap"
                style={{ fontSize: 'var(--chrome-sm)', letterSpacing: '-0.01em', fontWeight: 500 }}
              >
                {it.label}
              </span>
            )}
            {isActive && (
              <span
                aria-hidden
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                style={{ background: 'var(--primary)' }}
              />
            )}
          </button>
        );
      })}
    </>
  );
}

export default LeftRail;
