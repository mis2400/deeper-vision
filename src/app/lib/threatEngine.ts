// Threat Simulator engine — Phase 2B.1.
//
// Deterministic runtime over the project's live device placements.
// Given a scenario (entry, goal, path geometry, time-of-day) and the
// live state, the engine resolves each hop on the path, asks "which
// placed cameras can see this point", and produces an exposure score
// + per-hop breakdown the operator can act on.
//
// The honesty contract is the architectural anchor: every gap is
// grounded in actual placed devices. No hardcoded risk numbers. If
// the canvas is empty, the score honestly reads as 100 (everything
// uncovered) and the engine refuses to invent a "typical" baseline.

import type { ProjectState } from '../store/projectStore';
import { selectors } from '../store/projectStore';
import type { Device } from '../store/types';

// ─────────────────────────── Scenario model ──────────────────────────

/** Coarse industry bucket. Drives which scenarios surface as
 *  "recommended" for a given project later. Phase 2B.1 keeps the
 *  full library available regardless. */
export type ThreatVertical = 'corporate' | 'k12' | 'healthcare' | 'retail' | 'industrial' | 'multi';

export type ThreatTime = 'business' | 'after-hours' | 'overnight' | 'transition';

/** Static scenario definition — fractional coordinates relative to
 *  the active floor's extents. Engine resolves these to absolute
 *  canvas coordinates at run time using whatever floor the operator
 *  scoped the simulation to. */
export interface ScenarioDef {
  id: string;
  name: string;
  vertical: ThreatVertical;
  /** One-line operator-readable description. Tactical, not dramatic. */
  description: string;
  /** Actor type for the breakdown. Plain English. */
  actor: string;
  /** Time-of-day the scenario assumes. */
  time: ThreatTime;
  /** Fractional entry point (0..1 of floor extents). */
  entry: { x: number; y: number; label: string };
  /** Fractional goal point. */
  goal: { x: number; y: number; label: string };
  /** Optional intermediate waypoints (fractional). The engine adds
   *  the entry as the first hop and the goal as the last. */
  waypoints?: { x: number; y: number; label: string }[];
  /** Per-hop seconds the actor lingers at each point. Drives the
   *  later time scrubber pass. */
  dwellSec?: number;
}

/** A single hop on the resolved attack path. */
export interface ResolvedHop {
  index: number;
  label: string;
  /** Absolute floor coordinates. */
  x: number;
  y: number;
  /** Cameras whose declared range covers this point. */
  seenBy: string[];
  /** 'covered' = >=1 camera; 'gap' = none; 'partial' is reserved for
   *  future FOV-aware analysis. */
  coverage: 'covered' | 'gap';
  /** Engine's exposure contribution from this hop, 0..N. */
  exposurePoints: number;
}

export type HardenHintKind = 'camera' | 'access' | 'motion' | 'lighting';

export interface HardenHint {
  /** Which device family the engine recommends. Maps to the canvas
   *  dock category on the hint overlay. */
  kind: HardenHintKind;
  /** Operator-readable instruction ("Drop a camera here to close
   *  the rear service door gap"). */
  label: string;
  /** Where on the floor (absolute px) the hint anchors. */
  at: { x: number; y: number };
}

/** One contributing-factor row for the breakdown panel. */
export interface BreakdownItem {
  id: string;
  label: string;
  /** Positive integers the operator reads as "+18 points". */
  contribution: number;
  hint?: string;
  hopIndex?: number;
  /** When present, the breakdown row renders a "Harden on canvas"
   *  button that navigates to /canvas?hint=... with these params. */
  harden?: HardenHint;
}

export interface ScenarioResult {
  scenarioId: string;
  /** Resolved hops in order. */
  hops: ResolvedHop[];
  /** 0..100. Higher = more exposed. */
  score: number;
  /** Plain-English severity. */
  severity: 'low' | 'moderate' | 'high' | 'critical';
  /** Sorted, highest-impact first. */
  breakdown: BreakdownItem[];
  /** Total seconds of dwell on the path (drives later scrubber). */
  totalDwellSec: number;
  /** Floor used for the simulation. */
  floorId: string;
  /** Floor extents the engine resolved fractional coords against. */
  floorExtents: { x: number; y: number; w: number; h: number };
}

// ─────────────────────────── Library ────────────────────────────────

/** Phase 2B.1 ships 5 scenarios. 2B.6 expands to 10+. */
export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'perimeter-after-hours',
    name: 'Perimeter intrusion, after hours',
    vertical: 'multi',
    actor: 'Single intruder, no insider help',
    time: 'after-hours',
    description: 'After business hours. Single actor approaches the rear perimeter, looks for a soft entry, moves toward an interior target.',
    entry: { x: 0.04, y: 0.80, label: 'Rear service door' },
    goal:  { x: 0.78, y: 0.20, label: 'Executive suite' },
    waypoints: [
      { x: 0.20, y: 0.78, label: 'Service hallway' },
      { x: 0.38, y: 0.62, label: 'Kitchen pass-through' },
      { x: 0.55, y: 0.42, label: 'Stairwell B' },
    ],
    dwellSec: 6,
  },
  {
    id: 'tailgate-lobby',
    name: 'Daytime tailgate at the lobby',
    vertical: 'corporate',
    actor: 'Unbadged visitor following a real employee',
    time: 'business',
    description: 'Visitor times their arrival to slip through the main entry behind a badged employee, then proceeds to a sensitive interior.',
    entry: { x: 0.06, y: 0.92, label: 'Main lobby door' },
    goal:  { x: 0.80, y: 0.30, label: 'Server room' },
    waypoints: [
      { x: 0.22, y: 0.82, label: 'Lobby turnstile' },
      { x: 0.42, y: 0.66, label: 'Elevator bank' },
      { x: 0.62, y: 0.46, label: 'Open floor' },
    ],
    dwellSec: 5,
  },
  {
    id: 'loading-dock-delivery',
    name: 'Loading dock disguise',
    vertical: 'industrial',
    actor: 'Person posing as a courier, no badge',
    time: 'business',
    description: 'Actor enters via the loading dock claiming a delivery, navigates through receiving to an interior records area.',
    entry: { x: 0.05, y: 0.65, label: 'Loading dock' },
    goal:  { x: 0.85, y: 0.26, label: 'Records storage' },
    waypoints: [
      { x: 0.22, y: 0.65, label: 'Receiving floor' },
      { x: 0.42, y: 0.55, label: 'Warehouse aisle' },
      { x: 0.62, y: 0.38, label: 'Office corridor' },
    ],
    dwellSec: 7,
  },
  {
    id: 'reception-social-engineer',
    name: 'Reception social engineering',
    vertical: 'corporate',
    actor: 'Confident actor with a plausible cover story',
    time: 'business',
    description: 'Actor approaches reception with a fabricated reason to be escorted past the badge boundary into the open work area.',
    entry: { x: 0.10, y: 0.82, label: 'Reception' },
    goal:  { x: 0.86, y: 0.22, label: 'Executive assistant' },
    waypoints: [
      { x: 0.28, y: 0.74, label: 'Guest badge desk' },
      { x: 0.48, y: 0.58, label: 'Conference area' },
      { x: 0.68, y: 0.42, label: 'Open floor pod' },
    ],
    dwellSec: 8,
  },
  {
    id: 'after-action-walk',
    name: 'After-action coverage walk',
    vertical: 'multi',
    actor: 'Internal auditor, not an adversary',
    time: 'business',
    description: 'Walk the floor edge-to-edge to verify camera coverage. Use as a sanity check after a hardening pass.',
    entry: { x: 0.02, y: 0.50, label: 'Floor west edge' },
    goal:  { x: 0.98, y: 0.50, label: 'Floor east edge' },
    waypoints: [
      { x: 0.20, y: 0.25, label: 'Northwest corner' },
      { x: 0.40, y: 0.75, label: 'South corridor' },
      { x: 0.60, y: 0.30, label: 'North corridor' },
      { x: 0.80, y: 0.65, label: 'Southeast corner' },
    ],
    dwellSec: 4,
  },
];

export function getScenario(id: string): ScenarioDef | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

// ─────────────────────────── Runtime ────────────────────────────────

/** Float pad (px) around the floor's logical extent. Falls back to
 *  the seed building rectangle when no floor background or device
 *  placements give us bounds. */
const SEED_EXTENTS = { x: 80, y: 80, w: 640, h: 480 };

/** Resolve the floor's effective extents from its background + any
 *  placed devices on it. Mirrors the canvas auto-fit math so the
 *  scenario hops land where the canvas would. */
function resolveFloorExtents(state: ProjectState, projectId: string, floorId: string) {
  const floor = state.floors[floorId];
  let minX = SEED_EXTENTS.x, minY = SEED_EXTENTS.y;
  let maxX = SEED_EXTENTS.x + SEED_EXTENTS.w, maxY = SEED_EXTENTS.y + SEED_EXTENTS.h;
  if (floor?.background) {
    const bg = floor.background as any;
    minX = bg.x;
    minY = bg.y;
    maxX = bg.x + bg.naturalWidth * bg.scale;
    maxY = bg.y + bg.naturalHeight * bg.scale;
  }
  const devices = selectors.devicesForProject(state, projectId).filter((d) => d.floorId === floorId);
  for (const d of devices) {
    if (typeof d.x !== 'number' || typeof d.y !== 'number') continue;
    if (d.x < minX) minX = d.x;
    if (d.y < minY) minY = d.y;
    if (d.x > maxX) maxX = d.x;
    if (d.y > maxY) maxY = d.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Default coverage radius (px) for a camera that hasn't declared a
 *  range. Mirrors the canvas's own 30 ft fallback at the default
 *  scale (0.05 ft/px → 600 px) but clamped for the threat engine to
 *  120 px so a single camera doesn't claim the whole floor. */
const DEFAULT_CAM_RANGE_PX = 120;

/** Map a camera's declared range (ft) into screen px using the
 *  floor's ftPerPx, falling back to DEFAULT_CAM_RANGE_PX when the
 *  floor has no calibration. */
function cameraRangePx(state: ProjectState, cam: Device): number {
  if (!cam.range) return DEFAULT_CAM_RANGE_PX;
  const floor = state.floors[cam.floorId];
  const ftPerPx = (floor as any)?.scalePxToFt ? 1 / (floor as any).scalePxToFt : 0.05;
  // px = ft / ftPerPx
  return Math.max(40, cam.range / ftPerPx);
}

/** Run a scenario against the current project state. Returns the
 *  fully resolved result including hops, score, and a breakdown the
 *  panel renders. */
export function runScenario(
  state: ProjectState,
  projectId: string,
  scenarioId: string,
  floorId?: string,
): ScenarioResult | null {
  const def = getScenario(scenarioId);
  if (!def) return null;
  const useFloorId = floorId || selectors.firstFloorOfProject(state, projectId)?.id || '';
  if (!useFloorId) return null;
  const extents = resolveFloorExtents(state, projectId, useFloorId);
  // Resolve the path: entry → waypoints → goal, fractional → absolute.
  const fracPath = [def.entry, ...(def.waypoints ?? []), def.goal];
  const cameras = selectors.devicesForProject(state, projectId)
    .filter((d) => d.floorId === useFloorId && (d.type as string).startsWith('cam.'));

  const hops: ResolvedHop[] = fracPath.map((p, i) => {
    const x = extents.x + p.x * extents.w;
    const y = extents.y + p.y * extents.h;
    const seenBy: string[] = [];
    for (const cam of cameras) {
      const dx = cam.x - x;
      const dy = cam.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= cameraRangePx(state, cam)) seenBy.push(cam.id);
    }
    const coverage: 'covered' | 'gap' = seenBy.length > 0 ? 'covered' : 'gap';
    // Later hops weigh more (actor has penetrated deeper). Linear
    // weight from 1 (entry) to 2.5 (goal).
    const weight = 1 + 1.5 * (i / Math.max(1, fracPath.length - 1));
    const exposurePoints = coverage === 'gap' ? Math.round(weight * 10) : 0;
    return {
      index: i,
      label: p.label,
      x, y,
      seenBy,
      coverage,
      exposurePoints,
    };
  });

  const totalPossible = hops.reduce((acc, h, i) => acc + Math.round((1 + 1.5 * (i / Math.max(1, fracPath.length - 1))) * 10), 0);
  const gainedExposure = hops.reduce((acc, h) => acc + h.exposurePoints, 0);
  const score = Math.round((gainedExposure / Math.max(1, totalPossible)) * 100);
  const severity: ScenarioResult['severity'] =
    score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low';

  // Breakdown: one row per gap hop, plus an aggregate line if every
  // hop is covered (good outcome) or no cameras placed at all.
  const breakdown: BreakdownItem[] = [];
  if (cameras.length === 0) {
    breakdown.push({
      id: 'b-no-cams',
      label: 'No cameras placed on this floor',
      contribution: score,
      hint: 'Every hop is a gap by definition. Place cameras on the canvas to lower this score.',
    });
  } else {
    for (const h of hops) {
      if (h.coverage === 'gap') {
        // V1 2B.5 — assign a harden hint by hop position.
        // Perimeter / entry hops → lighting (deterrence first).
        // Early interior hops → camera (catch + record).
        // Mid-path hops → motion sensor (movement detection).
        // Final goal-adjacent hop → access control (lockdown the
        // last door). Four distinct hint kinds across the engine's
        // existing scenarios.
        const ratio = h.index / Math.max(1, hops.length - 1);
        const harden: HardenHint = (() => {
          if (h.index === 0)                  return { kind: 'lighting', at: { x: h.x, y: h.y }, label: `Add a perimeter light at ${h.label} for deterrence.` };
          if (h.index === hops.length - 1)    return { kind: 'access',   at: { x: h.x, y: h.y }, label: `Lock down ${h.label} with an access control reader.` };
          if (ratio > 0.66)                   return { kind: 'motion',   at: { x: h.x, y: h.y }, label: `Add a motion sensor near ${h.label} to catch movement.` };
          return                                       { kind: 'camera',   at: { x: h.x, y: h.y }, label: `Drop a camera covering ${h.label} to close the gap.` };
        })();
        breakdown.push({
          id: `b-gap-${h.index}`,
          label: `Gap at ${h.label}`,
          contribution: h.exposurePoints,
          hint: `Hop ${h.index + 1} of ${hops.length}. No placed camera reaches this point.`,
          hopIndex: h.index,
          harden,
        });
      }
    }
    // If literally every hop is covered, surface the good news as
    // the only breakdown row rather than an empty panel.
    if (breakdown.length === 0) {
      breakdown.push({
        id: 'b-all-clear',
        label: 'Every hop on this path has camera coverage',
        contribution: 0,
        hint: 'The score is the residual. Re-run after edits to confirm hardening held.',
      });
    }
  }
  // Sort by contribution desc, ties by hop order.
  breakdown.sort((a, b) => b.contribution - a.contribution || (a.hopIndex ?? 0) - (b.hopIndex ?? 0));

  const totalDwellSec = hops.length * (def.dwellSec ?? 5);

  return {
    scenarioId,
    hops,
    score,
    severity,
    breakdown,
    totalDwellSec,
    floorId: useFloorId,
    floorExtents: extents,
  };
}
