// LeftRail — unified left toolbar. M4 destination component.
//
// REBUILD STATUS: scaffold. The implementation that this component will
// replace today lives across two non-adjacent functions in
// screens/EngineeringCanvas.tsx:
//
//   DrawingToolRail  — line ~17641  (top-left rail: tools + layers + map)
//   IntelligenceRail — line ~16692  (bottom-left rail: zoom + chips + AI)
//
// The blueprint M4 calls for these to collapse into ONE rail with three
// stacked groups: Tools (top), View (middle), Zoom (bottom). The actual
// merge is a sizeable refactor — both source rails are ~200 LOC each
// with ~17 props between them — and is staged as a focused session.
//
// In the meantime this file provides:
//
//   1. A canonical RailGroup component pattern that the merge target
//      will use (icons-only collapsed, hover-expand to labels, single
//      visual container).
//
//   2. A type-checked Props contract that future callers can adopt
//      now, so the EngineeringCanvas rendering site can be migrated
//      independently of the internal merge.
//
//   3. The position contract from the blueprint: anchored top-left with
//      z-rail (from the M2 token scale), 12 px offset, clears the left
//      rail neighbours by sitting in ONE container.

import type { ReactNode } from 'react';
import type { Tool } from '../types';
import type { CoverageMode } from '../state/useCanvasStore';

// ─── Public Props ─────────────────────────────────────────────────────

export interface LeftRailProps {
  // Tools group
  tool: Tool;
  setTool: (t: Tool) => void;

  // View group (subset for now; fill in as M4 lands)
  snap: boolean;
  setSnap: (b: boolean) => void;
  layersOpen: boolean;
  onToggleLayers: () => void;
  coverageMode?: CoverageMode;
  setCoverageMode?: (m: CoverageMode) => void;

  // Zoom group
  zoom: number;
  setZoom: (z: number) => void;
  onFit: () => void;
  onActual: () => void;

  // Optional intelligence pieces (folded in during merge)
  intelOpen?: boolean;
  setIntelOpen?: (b: boolean) => void;
  highCount?: number;
  warnCount?: number;
  issuesEmpty?: boolean;
}

// ─── Building blocks (used by the eventual merge) ────────────────────

interface RailGroupProps {
  label?: string;
  children: ReactNode;
}

/** RailGroup — one vertical band in the unified rail. Visually separated
 *  from neighbours by a 1 px divider; labelled by a small header that
 *  appears only when the rail is in expanded (labels-visible) state. */
export function RailGroup({ label, children }: RailGroupProps) {
  return (
    <div className="rail-group flex flex-col gap-0.5">
      {label && (
        <div
          className="rail-group-label px-2 pt-1 pb-0.5"
          style={{ fontSize: 'var(--chrome-2xs)', color: 'var(--muted-foreground)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── The component itself ─────────────────────────────────────────────
//
// Today this is a scaffold; rendering still happens through the
// in-monolith DrawingToolRail + IntelligenceRail. When the merge lands,
// EngineeringCanvas swaps both render calls for a single <LeftRail .../>
// with the props above, the in-monolith functions are deleted, and the
// internal RailGroup composition lives here.

export function LeftRail(_props: LeftRailProps) {
  // Intentionally renders nothing. The actual rendering happens through
  // the in-monolith rails until the merge refactor lands. This stub
  // gives EngineeringCanvas a typed surface to wire against incrementally.
  return null;
}

export default LeftRail;
