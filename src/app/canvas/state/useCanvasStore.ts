// Canvas UI state — M3 rebuild milestone.
//
// A Zustand store dedicated to the CANVAS UI. Keeps zoom, pan, tool,
// selection, hover, active lens, dialog flags, etc. out of the project
// data store (src/app/store/projectStore.ts) so writes to those don't
// trigger re-renders of every store consumer, and writes to the data
// store don't churn the canvas UI.
//
// The canvas component currently holds all of this state in dozens of
// useState hooks at the top of EngineeringCanvas.tsx. As later rebuild
// milestones touch those sections, the corresponding useState gets
// replaced by `const x = useCanvasStore(s => s.x)` and the setter by
// `useCanvasStore.setState({ x: next })`. Once everything is migrated,
// the canvas component is a thin orchestrator and its sub-components
// subscribe directly to the slices they need.
//
// IMPORTANT — this store is NOT persisted. Canvas UI state resets on
// page reload. That's deliberate. The data store remains the only
// persisted state.

import { create } from 'zustand';
import type { ActiveLens, LensId, Tool } from '../types';

export type CoverageMode = 'soft' | 'hard';
export type ViewMode = 'default' | 'field' | 'canvas';

export interface CanvasUIState {
  // ─── View ───────────────────────────────────────────────────────────
  zoom: number;
  pan: { x: number; y: number };
  viewMode: ViewMode;

  // ─── Tool + draw state ──────────────────────────────────────────────
  tool: Tool;
  snap: boolean;
  units: 'ft' | 'm';
  coverageMode: CoverageMode;

  // ─── Selection ──────────────────────────────────────────────────────
  selId: string | null;
  selIds: string[];
  selRoomId: string | null;
  activeLens: ActiveLens;
  hoveredLens: LensId | null;

  // ─── Floor / dock ───────────────────────────────────────────────────
  floor: number;
  dockCollapsed: boolean;

  // ─── Edit drawer (legacy — will move to SelectionMenu in M7) ────────
  editOpen: boolean;
  editExpanded: boolean;

  // ─── Dialog open flags ──────────────────────────────────────────────
  cmdKOpen: boolean;
  overviewOpen: boolean;
  scanBuildOpen: boolean;
  canvasImportOpen: boolean;
  canvasBomOpen: boolean;
  reportOpen: boolean;
  intelOpen: boolean;
  isFullscreen: boolean;

  // ─── Actions (named setters so subscribers can be specific) ─────────
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  setViewMode: (m: ViewMode) => void;
  setTool: (t: Tool) => void;
  setSnap: (s: boolean) => void;
  setUnits: (u: 'ft' | 'm') => void;
  setCoverageMode: (m: CoverageMode) => void;
  setSelId: (id: string | null) => void;
  setSelIds: (ids: string[]) => void;
  setSelRoomId: (id: string | null) => void;
  setActiveLens: (l: ActiveLens) => void;
  setHoveredLens: (l: LensId | null) => void;
  setFloor: (n: number) => void;
  setDockCollapsed: (b: boolean) => void;
  setEditOpen: (b: boolean) => void;
  setEditExpanded: (b: boolean) => void;
  setCmdKOpen: (b: boolean) => void;
  setOverviewOpen: (b: boolean) => void;
  setScanBuildOpen: (b: boolean) => void;
  setCanvasImportOpen: (b: boolean) => void;
  setCanvasBomOpen: (b: boolean) => void;
  setReportOpen: (b: boolean) => void;
  setIntelOpen: (b: boolean) => void;
  setIsFullscreen: (b: boolean) => void;

  /** Reset everything to defaults. Used on canvas unmount / project switch. */
  reset: () => void;
}

const DEFAULT_STATE = {
  zoom: 1,
  pan: { x: 0, y: 0 },
  viewMode: 'default' as ViewMode,
  tool: 'select' as Tool,
  snap: true,
  units: 'ft' as 'ft' | 'm',
  coverageMode: 'soft' as CoverageMode,
  selId: null,
  selIds: [] as string[],
  selRoomId: null,
  activeLens: 'all' as ActiveLens,
  hoveredLens: null as LensId | null,
  floor: 0,
  dockCollapsed: false,
  editOpen: false,
  editExpanded: false,
  cmdKOpen: false,
  overviewOpen: false,
  scanBuildOpen: false,
  canvasImportOpen: false,
  canvasBomOpen: false,
  reportOpen: false,
  intelOpen: false,
  isFullscreen: false,
};

export const useCanvasStore = create<CanvasUIState>((set) => ({
  ...DEFAULT_STATE,
  setZoom: (z) => set({ zoom: z }),
  setPan: (p) => set({ pan: p }),
  setViewMode: (m) => set({ viewMode: m }),
  setTool: (t) => set({ tool: t }),
  setSnap: (s) => set({ snap: s }),
  setUnits: (u) => set({ units: u }),
  setCoverageMode: (m) => set({ coverageMode: m }),
  setSelId: (id) => set({ selId: id }),
  setSelIds: (ids) => set({ selIds: ids }),
  setSelRoomId: (id) => set({ selRoomId: id }),
  setActiveLens: (l) => set({ activeLens: l }),
  setHoveredLens: (l) => set({ hoveredLens: l }),
  setFloor: (n) => set({ floor: n }),
  setDockCollapsed: (b) => set({ dockCollapsed: b }),
  setEditOpen: (b) => set({ editOpen: b }),
  setEditExpanded: (b) => set({ editExpanded: b }),
  setCmdKOpen: (b) => set({ cmdKOpen: b }),
  setOverviewOpen: (b) => set({ overviewOpen: b }),
  setScanBuildOpen: (b) => set({ scanBuildOpen: b }),
  setCanvasImportOpen: (b) => set({ canvasImportOpen: b }),
  setCanvasBomOpen: (b) => set({ canvasBomOpen: b }),
  setReportOpen: (b) => set({ reportOpen: b }),
  setIntelOpen: (b) => set({ intelOpen: b }),
  setIsFullscreen: (b) => set({ isFullscreen: b }),
  reset: () => set(DEFAULT_STATE),
}));

// Selector hooks for the common subscriptions. Components use these
// instead of `useCanvasStore()` (whole-store sub) so each only re-renders
// when its specific slice changes.
export const useCanvasZoom    = () => useCanvasStore((s) => s.zoom);
export const useCanvasPan     = () => useCanvasStore((s) => s.pan);
export const useCanvasTool    = () => useCanvasStore((s) => s.tool);
export const useCanvasSelId   = () => useCanvasStore((s) => s.selId);
export const useCanvasFloor   = () => useCanvasStore((s) => s.floor);
export const useActiveLens    = () => useCanvasStore((s) => s.activeLens);
export const useHoveredLens   = () => useCanvasStore((s) => s.hoveredLens);
