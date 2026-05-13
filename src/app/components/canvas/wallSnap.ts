// Magnetic wall-snap + rotation-snap helpers. Gives the canvas the "weighted dragging" feel:
// dragged devices catch onto the nearest floorplan wall edge within a 3px threshold,
// and free rotations land softly on 1° increments (with stronger pulls at 45°/90° anchors).

import { getFloorplanWalls } from './floorplanGeometry';

export interface Vec2 { x: number; y: number; }

const SNAP_PX = 3;
// Pre-snap proximity envelope — used to bias inertial drag toward a crisper catch.
const NEAR_PX = 8;

export function snapToWalls(pos: Vec2): { pos: Vec2; snappedX: boolean; snappedY: boolean } {
  const WALLS = getFloorplanWalls();
  let x = pos.x;
  let y = pos.y;
  let snappedX = false;
  let snappedY = false;

  let bestDx = SNAP_PX + 1;
  for (const w of WALLS) {
    if (w.kind !== 'v') continue;
    if (pos.y < w.y1 - SNAP_PX || pos.y > w.y2 + SNAP_PX) continue;
    const dx = Math.abs(pos.x - w.x);
    if (dx < bestDx) { bestDx = dx; x = w.x; snappedX = true; }
  }
  let bestDy = SNAP_PX + 1;
  for (const w of WALLS) {
    if (w.kind !== 'h') continue;
    if (pos.x < w.x1 - SNAP_PX || pos.x > w.x2 + SNAP_PX) continue;
    const dy = Math.abs(pos.y - w.y);
    if (dy < bestDy) { bestDy = dy; y = w.y; snappedY = true; }
  }

  return { pos: { x, y }, snappedX, snappedY };
}

// Walls within `radius` px of pos — used to paint a proximity glow during drag.
export function nearbyWalls(pos: Vec2, radius: number = NEAR_PX) {
  const WALLS = getFloorplanWalls();
  const out: Array<{ seg: typeof WALLS[number]; dist: number }> = [];
  for (const w of WALLS) {
    if (w.kind === 'v') {
      if (pos.y < w.y1 - radius || pos.y > w.y2 + radius) continue;
      const d = Math.abs(pos.x - w.x);
      if (d <= radius) out.push({ seg: w, dist: d });
    } else {
      if (pos.x < w.x1 - radius || pos.x > w.x2 + radius) continue;
      const d = Math.abs(pos.y - w.y);
      if (d <= radius) out.push({ seg: w, dist: d });
    }
  }
  return out;
}

// Perpendicular distance (px) to the closest wall whose span brackets pos.
// Returns Infinity if no wall is within scanning range.
export function distanceToNearestWall(pos: Vec2): number {
  const WALLS = getFloorplanWalls();
  let best = Infinity;
  for (const w of WALLS) {
    if (w.kind === 'v') {
      if (pos.y < w.y1 - NEAR_PX || pos.y > w.y2 + NEAR_PX) continue;
      const d = Math.abs(pos.x - w.x);
      if (d < best) best = d;
    } else {
      if (pos.x < w.x1 - NEAR_PX || pos.x > w.x2 + NEAR_PX) continue;
      const d = Math.abs(pos.y - w.y);
      if (d < best) best = d;
    }
  }
  return best;
}

// 1° rotation snap with stronger pull toward cardinal/45° anchors.
const ANCHORS = [0, 45, 90, 135, 180, 225, 270, 315];
export function snapRotation(deg: number): number {
  const mod = ((deg % 360) + 360) % 360;
  // Cardinal pull within 3°
  for (const a of ANCHORS) {
    if (Math.abs(mod - a) <= 3) return a;
  }
  // Otherwise quantize to whole degrees.
  return Math.round(mod);
}
