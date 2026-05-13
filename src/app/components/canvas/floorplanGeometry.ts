// Canonical AI-extracted floorplan. Publishes a live store so that edits in
// VisionScan retune the snap geometry & rendered building in the EngineeringCanvas.

import { useEffect, useState } from 'react';

export interface Pt { id: string; x: number; y: number; }
export interface Room { id: string; corners: string[]; label: string; conf: number; }

export type Segment =
  | { kind: 'h'; y: number; x1: number; x2: number }
  | { kind: 'v'; x: number; y1: number; y2: number };

export interface FloorplanSnapshot {
  pts: Pt[];
  rooms: Room[];
  walls: Segment[];
  rev: number;
}

// Defaults — scaled to fit ~1100×700 canvas envelope. Source: VisionScan defaults.
const DEFAULT_PTS: Pt[] = [
  { id: 'p1', x: 50,   y: 50  }, { id: 'p2', x: 390,  y: 50  },
  { id: 'p3', x: 710,  y: 50  }, { id: 'p4', x: 1050, y: 50  },
  { id: 'p5', x: 50,   y: 350 }, { id: 'p6', x: 390,  y: 350 },
  { id: 'p7', x: 710,  y: 350 }, { id: 'p8', x: 1050, y: 350 },
  { id: 'p9', x: 50,   y: 650 }, { id: 'p10', x: 390, y: 650 },
  { id: 'p11', x: 710, y: 650 }, { id: 'p12', x: 1050, y: 650 },
];
const DEFAULT_ROOMS: Room[] = [
  { id: 'rA', corners: ['p1','p2','p6','p5'],   label: 'Room A',  conf: 96 },
  { id: 'rB', corners: ['p5','p6','p10','p9'],  label: 'Room B',  conf: 91 },
  { id: 'rH', corners: ['p2','p3','p7','p6'],   label: 'Hallway', conf: 88 },
  { id: 'rC', corners: ['p3','p4','p8','p7'],   label: 'Room C',  conf: 94 },
  { id: 'rD', corners: ['p7','p8','p12','p11'], label: 'Room D',  conf: 82 },
  { id: 'rE', corners: ['p6','p7','p11','p10'], label: 'Storage', conf: 76 },
];

function buildWalls(pts: Pt[], rooms: Room[]): Segment[] {
  const map = new Map(pts.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const out: Segment[] = [];
  for (const room of rooms) {
    const ids = room.corners;
    for (let i = 0; i < ids.length; i++) {
      const a = map.get(ids[i]); const b = map.get(ids[(i + 1) % ids.length]);
      if (!a || !b) continue;
      // Treat near-horizontal / near-vertical as axis-aligned (after VisionScan ortho-snap).
      if (Math.abs(a.y - b.y) <= 1) {
        const y = (a.y + b.y) / 2;
        const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
        const key = `h:${y}:${x1}:${x2}`;
        if (!seen.has(key)) { seen.add(key); out.push({ kind: 'h', y, x1, x2 }); }
      } else if (Math.abs(a.x - b.x) <= 1) {
        const x = (a.x + b.x) / 2;
        const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
        const key = `v:${x}:${y1}:${y2}`;
        if (!seen.has(key)) { seen.add(key); out.push({ kind: 'v', x, y1, y2 }); }
      }
    }
  }
  return out;
}

// ---------- Live store + per-project persistence ----------
let _projectId: string = 'default';
const storageKey = (id: string) => `dv:floorplan:${id}`;

let _snapshot: FloorplanSnapshot = {
  pts: DEFAULT_PTS,
  rooms: DEFAULT_ROOMS,
  walls: buildWalls(DEFAULT_PTS, DEFAULT_ROOMS),
  rev: 0,
};
const listeners = new Set<(s: FloorplanSnapshot) => void>();

export function getFloorplan(): FloorplanSnapshot { return _snapshot; }
export function getFloorplanWalls(): Segment[] { return _snapshot.walls; }

// Bind the active project; loads its persisted floorplan if one exists, otherwise resets to defaults.
export function setFloorplanProject(projectId: string) {
  if (_projectId === projectId) return;
  _projectId = projectId;
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw) as { pts: Pt[]; rooms: Room[] };
      if (parsed?.pts && parsed?.rooms) {
        _snapshot = { pts: parsed.pts, rooms: parsed.rooms, walls: buildWalls(parsed.pts, parsed.rooms), rev: _snapshot.rev + 1 };
        listeners.forEach((fn) => fn(_snapshot));
        return;
      }
    }
  } catch { /* fall through to defaults */ }
  _snapshot = { pts: DEFAULT_PTS, rooms: DEFAULT_ROOMS, walls: buildWalls(DEFAULT_PTS, DEFAULT_ROOMS), rev: _snapshot.rev + 1 };
  listeners.forEach((fn) => fn(_snapshot));
}

export function publishFloorplan(pts: Pt[], rooms: Room[]) {
  _snapshot = { pts, rooms, walls: buildWalls(pts, rooms), rev: _snapshot.rev + 1 };
  listeners.forEach((fn) => fn(_snapshot));
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(storageKey(_projectId), JSON.stringify({ pts, rooms })); } catch { /* quota / disabled */ }
  }
}

export function subscribeFloorplan(fn: (s: FloorplanSnapshot) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useFloorplan(): FloorplanSnapshot {
  const [snap, setSnap] = useState(_snapshot);
  useEffect(() => subscribeFloorplan(setSnap), []);
  return snap;
}

export function getRoomPolygon(room: Room, snapshot: FloorplanSnapshot = _snapshot): Pt[] {
  const map = new Map(snapshot.pts.map((p) => [p.id, p]));
  return room.corners.map((id) => map.get(id)!).filter(Boolean);
}

// Back-compat exports (read-only snapshot at module-load).
export const FLOORPLAN_PTS = _snapshot.pts;
export const FLOORPLAN_ROOMS = _snapshot.rooms;
export const FLOORPLAN_WALLS = _snapshot.walls;
