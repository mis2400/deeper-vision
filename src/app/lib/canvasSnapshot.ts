// SC.6.6 — Canvas snapshot capture. Pure function over store state
// that emits a frozen ProposalCanvasSnapshot for a project. Called
// from the sendProposal store action so the snapshot is taken
// atomically with the status flip — never from the UI, never from a
// passive selector.
//
// What lives here:
//   - The denormalization rules (Device → snapshot device, etc).
//   - The size guard that logs a warning when a single snapshot
//     crosses the SC.7 follow-up threshold so we don't ship a 5 MB
//     persisted blob silently.
//
// What does NOT live here:
//   - The persist version bump (projectStore.ts owns migrations).
//   - The send-flow side effects (sendProposal in the store
//     orchestrates).
//   - The portal renderer (CustomerPortal owns presentation).

import type {
  ProposalCanvasSnapshot,
  ProposalCanvasSnapshotFloor,
  ProposalCanvasSnapshotWall,
  ProposalCanvasSnapshotDevice,
  ProposalCanvasSnapshotRoom,
} from '../store/types';
import type { ProjectState } from '../store/projectStore';

// SC.7 watch threshold. If a single snapshot crosses this size,
// the retrospective should consider moving blueprint dataUrls to a
// separate IndexedDB slice. Today the persist layer is localStorage
// only and has a 5–10 MB ceiling depending on browser; one fat
// snapshot per proposal version per project chews that fast.
const SNAPSHOT_SIZE_WARN_BYTES = 2 * 1024 * 1024;

export function captureCanvasSnapshot(
  state: ProjectState,
  projectId: string,
  now: number = Date.now(),
): ProposalCanvasSnapshot {
  // Floors first — every other entity dereferences via floorId.
  const floors: ProposalCanvasSnapshotFloor[] = Object.values(state.floors)
    .filter((f) => f.projectId === projectId)
    .map((f) => ({
      id: f.id,
      name: f.name,
      level: f.level,
      scalePxToFt: f.scalePxToFt,
      background: f.background,
    }));
  const floorIdSet = new Set(floors.map((f) => f.id));

  // Walls — Floor.walls is the source of truth (the store doesn't
  // have a top-level walls map). Normalise to a points array so the
  // snapshot's wall shape can evolve without breaking renderers.
  // Gate on floorIdSet so any future divergence in floor scoping
  // doesn't quietly leak walls from out-of-scope floors.
  const walls: ProposalCanvasSnapshotWall[] = [];
  for (const f of Object.values(state.floors)) {
    if (!floorIdSet.has(f.id)) continue;
    for (const w of (f.walls ?? [])) {
      walls.push({
        id: w.id,
        floorId: f.id,
        points: [
          { x: w.x1, y: w.y1 },
          { x: w.x2, y: w.y2 },
        ],
      });
    }
  }

  // Devices — keep only the rendering-essential subset. Accessories
  // collapse to a count (the BOM line is the pricing source of
  // truth). Skip devices whose floor isn't in scope so the snapshot
  // never carries orphans from another project.
  const devices: ProposalCanvasSnapshotDevice[] = Object.values(state.devices)
    .filter((d) => d.projectId === projectId && floorIdSet.has(d.floorId))
    .map((d) => ({
      id: d.id,
      kind: d.type,
      label: d.label,
      floorId: d.floorId,
      position: { x: d.x, y: d.y },
      rotation: d.rot,
      coverage: d.coverage,
      accessoryCount: (d.accessories?.length ?? 0) + (d.stack?.length ?? 0),
    }));

  // Rooms — prefer the standalone rooms slice for richer data
  // (polygon, sensitivity); fall back to Floor.rooms inline subset
  // for floors that never used the standalone slice. Deduplicate on
  // id so a floor that has both inline + standalone doesn't
  // double-render.
  const seenRoomIds = new Set<string>();
  const rooms: ProposalCanvasSnapshotRoom[] = [];
  for (const r of Object.values(state.rooms)) {
    if (r.projectId !== projectId) continue;
    if (!floorIdSet.has(r.floorId)) continue;
    seenRoomIds.add(r.id);
    rooms.push({
      id: r.id,
      floorId: r.floorId,
      name: r.name,
      polygon: r.polygon ?? [],
      sensitivity: r.sensitivity,
    });
  }
  for (const f of Object.values(state.floors)) {
    if (!floorIdSet.has(f.id)) continue;
    for (const inline of (f.rooms ?? [])) {
      if (seenRoomIds.has(inline.id)) continue;
      rooms.push({
        id: inline.id,
        floorId: f.id,
        name: inline.name,
        polygon: (inline.corners ?? []).slice(),
      });
    }
  }

  const live: ProposalCanvasSnapshot = {
    capturedAt: new Date(now).toISOString(),
    floors,
    walls,
    devices,
    rooms,
  };

  // Deep-clone via JSON round-trip. Two reasons this is mandatory:
  //   1. The capture above passes Device.coverage and Floor.background
  //      by reference. Without a clone, a later updateDevice that
  //      mutates coverage in place would silently rewrite the
  //      historical document.
  //   2. JSON.stringify is the same path the persist layer takes; if
  //      anything in the snapshot is non-serializable (a class
  //      instance, a function, a circular ref) it throws here with a
  //      readable stack instead of failing silently downstream.
  // Console-warn on size after the clone so the bytes we measure are
  // the bytes that actually persist.
  const serialized = JSON.stringify(live);
  const snapshot = JSON.parse(serialized) as ProposalCanvasSnapshot;
  if (serialized.length > SNAPSHOT_SIZE_WARN_BYTES) {
    console.warn(
      `[canvasSnapshot] project ${projectId} snapshot is ${(serialized.length / 1024 / 1024).toFixed(2)} MB — `
        + `consider factoring blueprint backgrounds out of the snapshot (SC.7 follow up).`,
    );
  }
  return snapshot;
}
