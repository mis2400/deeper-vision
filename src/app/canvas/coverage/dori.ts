// DORI helpers — extracted from screens/EngineeringCanvas.tsx as part
// of the M11 monolith breakup. Single source of truth for the canvas
// density chain: the FOV cone bands AND the person probe BOTH derive
// their numbers from these constants and helpers so the readings
// always agree at any given ground distance.
//
// Standard: EN-50132-7 / IEC-62676. Identify 250 px/m, Recognize
// 125 px/m, Observe 62.5 px/m, Detect 25 px/m. FACE_WIDTH_FT 0.6
// (≈ 18.3 cm) is the standard face width used to convert pixels per
// foot into px-on-face for required pixel density preview tiles.
//
// Pure: no React imports, no store reads, no canvas-internal state.

export const DORI_PX_PER_FT = {
  identify:  250 / 3.28084,  // ≈ 76.20 px/ft (250 px/m)
  recognize: 125 / 3.28084,  // ≈ 38.10 px/ft (125 px/m)
  observe:   62.5 / 3.28084, // ≈ 19.05 px/ft (62.5 px/m — the EN-50132-7
                             //                  standard observe threshold;
                             //                  the earlier 62 round-down
                             //                  shaved 0.15 px/ft off the
                             //                  boundary)
  detect:     25 / 3.28084,  // ≈  7.62 px/ft (25 px/m)
} as const;
export type DoriLevel = 'identify' | 'recognize' | 'observe' | 'detect';

/** Coverage render mode — feeds FOV opacity, edge strokes, DORI band
 *  rendering, etc. Seven values cover the operator's intent spectrum
 *  from "barely visible" to "presentation-ready". The simpler 2-value
 *  CoverageMode in canvas/state/useCanvasStore.ts is a separate
 *  concept (UI toggle), not the renderer's mode. */
export type CoverageMode = 'minimal' | 'soft' | 'tactical' | 'heatmap' | 'wireframe' | 'presentation' | 'night';
/** Standard subject width used to convert px/ft into px-on-face for the
 *  required pixel density preview tiles. 0.6 ft ≈ 18.3 cm matches the
 *  EN-50132 / IEC-62676 face width assumption used everywhere else in
 *  the canvas. The number is a STANDARD, not a knob — engineers expect
 *  identify @ 250 px/m to translate to roughly 46 px across a face. */
export const FACE_WIDTH_FT = 0.6;
// Tile order: blurry → sharp, matching the Axis-style reference. The
// cone band rendering uses a different inner-to-outer order via the
// DORI_BASE_OPACITY map; the tile row is independent.
export const DORI_ORDER: DoriLevel[] = ['detect', 'observe', 'recognize', 'identify'];
export const DORI_TILE_LABEL: Record<DoriLevel, string> = {
  identify:  'Identify',
  recognize: 'Recognize',
  observe:   'Observe',
  detect:    'Detect',
};
/** Visual stepping: closest band (best grade) is most opaque, falling off
 *  toward the detect band. Multiplied by the cone's mode/selected opacity
 *  in the renderer so the bands fade with the rest of the cone wash.
 *  Item 7 — opacities ~2x the prior values; coverage previously read as
 *  faint dark teal, almost invisible on light floor plans. The doubled
 *  ramp keeps the relative grade ordering while making the coverage
 *  band visible at a glance. */
export const DORI_BASE_OPACITY: Record<DoriLevel, number> = {
  identify:  0.55,
  recognize: 0.42,
  observe:   0.28,
  detect:    0.18,
};
export const DORI_LABEL: Record<DoriLevel, string> = {
  identify: 'I', recognize: 'R', observe: 'O', detect: 'D',
};

export interface DoriBand {
  level: DoriLevel;
  /** Inner radius in feet (distance from camera). */
  fromFt: number;
  /** Outer radius in feet, clipped to rangeFt. */
  toFt: number;
  /** Midpoint distance — used to place the band's letter label. */
  midFt: number;
}

/** Pixels per foot at a given ground distance. The exact inverse of
 *  `d_T = horizPx / (2 · T · tan(FOV/2))` used by doriBandsFor — same
 *  horizontal pixel budget and tan(FOV/2), so the probe reading at
 *  distance d always agrees with whichever DORI band the marker is
 *  sitting in. Single source of truth for the canvas density chain. */
export function pxPerFtAt(opts: {
  fovDeg: number;
  resolution: { widthPx: number; heightPx: number };
  distanceFt: number;
}): number {
  const { fovDeg, resolution, distanceFt } = opts;
  if (distanceFt <= 0) return Infinity;
  const half = (Math.max(1, fovDeg) / 2) * (Math.PI / 180);
  const tanHalf = Math.tan(half);
  if (tanHalf <= 0) return Infinity;
  return resolution.widthPx / (2 * distanceFt * tanHalf);
}

/** Is a point inside the camera's single-lens cone? Used by the
 *  person probe to gate the live density readout — outside the cone,
 *  the camera produces no image at that ground location and the probe
 *  honestly reports "no coverage here". Angle math wraps so an aim of
 *  350° + a target at 10° correctly registers as inside a 30° cone. */
export function pointInCone(opts: {
  cameraX: number; cameraY: number;
  cameraRotDeg: number;
  fovDeg: number;
  rangeFt: number;
  pxToFt: number;
  pointX: number; pointY: number;
}): { inCone: boolean; distanceFt: number; bearingDeg: number; deltaDeg: number } {
  const { cameraX, cameraY, cameraRotDeg, fovDeg, rangeFt, pxToFt, pointX, pointY } = opts;
  const dxPx = pointX - cameraX;
  const dyPx = pointY - cameraY;
  const distFt = Math.hypot(dxPx, dyPx) * pxToFt;
  if (distFt <= 0) {
    return { inCone: true, distanceFt: 0, bearingDeg: cameraRotDeg, deltaDeg: 0 };
  }
  const bearingDeg = ((Math.atan2(dyPx, dxPx) * 180 / Math.PI) + 360) % 360;
  const aim = ((cameraRotDeg % 360) + 360) % 360;
  const raw = Math.abs(bearingDeg - aim);
  const deltaDeg = Math.min(raw, 360 - raw);
  const inCone = deltaDeg <= fovDeg / 2 && distFt <= rangeFt;
  return { inCone, distanceFt: distFt, bearingDeg, deltaDeg };
}

/** Compute the four DORI bands for a single-lens camera at the given fov +
 *  resolution + range. Returns only bands with non-empty extent (band is
 *  skipped when its outer threshold sits inside its inner threshold or
 *  beyond rangeFt). When rangeFt cuts a band in half the outer radius is
 *  clamped — the band still renders, just shorter. */
export function doriBandsFor(opts: {
  fovDeg: number;
  rangeFt: number;
  resolution: { widthPx: number; heightPx: number };
}): DoriBand[] {
  const { fovDeg, rangeFt, resolution } = opts;
  // Tan blows up near 0° — guard against degenerate input. The call site
  // already gates on fovDeg < 180 so we don't redo the upper clamp here;
  // the lower bound is the only one that actually protects this math.
  const half = (Math.max(1, fovDeg) / 2) * (Math.PI / 180);
  const tanHalf = Math.tan(half);
  if (tanHalf <= 0) return [];
  const horiz = resolution.widthPx;
  // d_T = horizontalPx / (2 · T · tan(FOV/2))
  const dFor = (T: number) => horiz / (2 * T * tanHalf);
  const dI = dFor(DORI_PX_PER_FT.identify);
  const dR = dFor(DORI_PX_PER_FT.recognize);
  const dO = dFor(DORI_PX_PER_FT.observe);
  const dD = dFor(DORI_PX_PER_FT.detect);
  // Bands as [inner, outer] pairs.
  const raw: [DoriLevel, number, number][] = [
    ['identify',  0,  dI],
    ['recognize', dI, dR],
    ['observe',   dR, dO],
    ['detect',    dO, dD],
  ];
  const out: DoriBand[] = [];
  for (const [level, fromFt, outerFt] of raw) {
    if (fromFt >= rangeFt) continue;       // band starts past the lens reach
    const toFt = Math.min(outerFt, rangeFt);
    if (toFt - fromFt < 0.5) continue;     // sliver too thin to matter
    out.push({ level, fromFt, toFt, midFt: (fromFt + toFt) / 2 });
  }
  return out;
}
