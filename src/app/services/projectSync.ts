// projectSync — single, dependency-light surface for moving project state
// between local browser storage and (eventually) a backend. Everything in
// this module is local-only today; the brief is to lay the foundation so
// the next pass can wire a real cloud without rewriting callers.
//
// Honest contract:
//   - `getSyncMode()` always returns `{ mode: 'local', cloudConnected: false }`.
//     No background polling, no "syncing" indicator, no faked progress.
//   - Snapshots are stored under their own localStorage key (separate from
//     the main Zustand store), so saving a snapshot doesn't bloat the live
//     project state and restoring one doesn't lose the snapshot history.
//   - Export / import are thin pass-throughs to the existing helpers in
//     the project store so the JSON envelope shape is consistent across
//     paths (BOM, Project state menu, Reports CSV).

import {
  useProjectStore, exportProjectState, selectors, deriveWorkOrders,
} from '../store/projectStore';
import type { ProjectStateEnvelope, ImportSummary } from '../store/types';
import { buildLabel } from '../../build-info';

// ─── Persistence ──────────────────────────────────────────────────

/** Key for the per-snapshot store. Stays distinct from
 *  `deeperVisionStore` (the live Zustand persist key) so a "Clear local
 *  project state" action doesn't accidentally wipe snapshot history. */
const SNAPSHOT_KEY = 'deeperVisionSnapshots';

export interface LocalSnapshot {
  id: string;
  projectId: string;
  /** User-visible name for the snapshot. Free-form, trimmed; defaults to
   *  `Snapshot · <timestamp>` when the user leaves the field blank. */
  name: string;
  /** When the snapshot was saved (epoch ms). */
  createdAt: number;
  /** Stamped build label at save time so a future restore can warn on
   *  schema drift the way the JSON-import flow already does. */
  buildLabel?: string;
  /** The full envelope. The same shape `exportProjectState` produces. */
  envelope: ProjectStateEnvelope;
}

function readAllSnapshots(): Record<string, LocalSnapshot> {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LocalSnapshot>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeAllSnapshots(map: Record<string, LocalSnapshot>): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(map));
  } catch (e) {
    throw new Error(`Could not persist snapshots: ${(e as Error).message}`);
  }
}

// ─── Sync mode + status ───────────────────────────────────────────

export type SyncMode = 'local';

export interface SyncStatus {
  /** Today: always `'local'`. Reserved so a future cloud sync can return
   *  `'cloud'` / `'hybrid'` without changing the consumer signature. */
  mode: SyncMode;
  /** Today: always `false`. */
  cloudConnected: false;
  /** Where the live state actually lives. Drives the menu copy. */
  storeKey: string;
  /** Approximate size of the persisted store blob in bytes. Returns 0
   *  when storage isn't available (SSR, private mode, etc.). */
  localStorageBytes: number;
  /** Bytes of the per-project envelope as it would serialize to JSON. */
  projectStateBytes: number;
  /** Project's last `updatedAt` (from the Project record), if any. */
  lastLocalSave?: number;
  counts: {
    devices: number;
    doors: number;
    pathways: number;
    idfs: number;
    floors: number;
    workOrders: number;
    pricebookOverrides: number;
    snapshots: number;
  };
}

function approxBytes(s: string | null): number {
  if (!s) return 0;
  // Each JS char is 2 bytes UTF-16 in memory; localStorage actually
  // stores UTF-16 too, so doubling is the honest figure. We just report
  // string-length as the user-facing approximation because that's the
  // number that maps directly to "how much JSON is in there".
  return s.length;
}

/** Read the current sync mode + counts. Cheap; safe to call inside a
 *  React render. */
export function getSyncMode(projectId: string): SyncStatus {
  const state = useProjectStore.getState();
  const project = state.projects[projectId];

  // Per-project counts. Use the same selectors / derivers the BOM +
  // Reports surfaces use so the numbers line up.
  const devices = selectors.devicesForProject(state, projectId);
  const doors   = Object.values(state.doors).filter((d) => d.projectId === projectId);
  const pathways = selectors.pathwaysForProject(state, projectId);
  const idfs    = selectors.idfsForProject(state, projectId);
  const floors  = selectors.floorsForProject(state, projectId);
  // Door-as-Device records count as doors for the user-facing tally so
  // the Reports / Deployment numbers match.
  const doorDevices = devices.filter((d: any) => {
    const t = String(d.type);
    return t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor');
  });
  const workOrders = deriveWorkOrders(state, projectId);
  const pricebook = state.projectPricebooks[projectId];
  const pricebookOverrides =
    Object.keys(pricebook?.doorHardware ?? {}).length +
    Object.keys(pricebook?.cablePerFt ?? {}).length +
    (pricebook?.laborRate != null ? 1 : 0) +
    (pricebook?.markup    != null ? 1 : 0);
  const snapshots = listLocalSnapshots(projectId).length;

  // Byte sizes (approximations).
  let storeBytes = 0;
  try { storeBytes = approxBytes(localStorage.getItem('deeperVisionStore')); } catch { /* noop */ }
  let projectBytes = 0;
  try {
    const env = exportProjectState(state, projectId, { buildLabel: buildLabel() });
    projectBytes = JSON.stringify(env).length;
  } catch { /* project missing — leave at 0 */ }

  return {
    mode: 'local',
    cloudConnected: false,
    storeKey: 'deeperVisionStore (browser localStorage)',
    localStorageBytes: storeBytes,
    projectStateBytes: projectBytes,
    lastLocalSave: project?.updatedAt,
    counts: {
      devices: devices.length,
      doors: doors.length + doorDevices.length,
      pathways: pathways.length,
      idfs: idfs.length,
      floors: floors.length,
      workOrders: workOrders.length,
      pricebookOverrides,
      snapshots,
    },
  };
}

// ─── Snapshots ────────────────────────────────────────────────────

/** Save the current state of `projectId` as a named local snapshot.
 *  Throws if the project is missing or if storage is full. */
export function saveLocalSnapshot(projectId: string, name?: string): LocalSnapshot {
  const state = useProjectStore.getState();
  if (!state.projects[projectId]) {
    throw new Error(`Project ${projectId} not in store; nothing to snapshot.`);
  }
  const envelope = exportProjectState(state, projectId, { buildLabel: buildLabel() });
  const now = Date.now();
  const id = `snap-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const safeName = (name ?? '').trim() || `Snapshot · ${new Date(now).toLocaleString()}`;
  const snap: LocalSnapshot = {
    id, projectId, name: safeName, createdAt: now,
    buildLabel: buildLabel(),
    envelope,
  };
  const all = readAllSnapshots();
  all[id] = snap;
  writeAllSnapshots(all);
  return snap;
}

/** Return all snapshots for `projectId`, newest first. */
export function listLocalSnapshots(projectId: string): LocalSnapshot[] {
  const all = readAllSnapshots();
  return Object.values(all)
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Restore a snapshot. Replaces local state for the snapshot's project
 *  (other projects in the browser are preserved, just like
 *  `importProjectState`). Throws if the snapshot doesn't exist.
 *  Returns the snapshot AND the ImportSummary from the underlying
 *  import so the caller can surface attachment validation / rename
 *  counts in its toast. */
export function restoreLocalSnapshot(snapshotId: string): { snapshot: LocalSnapshot; summary: ImportSummary } {
  const all = readAllSnapshots();
  const snap = all[snapshotId];
  if (!snap) throw new Error(`Snapshot ${snapshotId} not found.`);
  const summary = useProjectStore.getState().importProjectState(snap.envelope);
  return { snapshot: snap, summary };
}

/** Drop a snapshot from local storage. No-op if it doesn't exist. */
export function deleteLocalSnapshot(snapshotId: string): void {
  const all = readAllSnapshots();
  if (!all[snapshotId]) return;
  delete all[snapshotId];
  writeAllSnapshots(all);
}

// ─── Envelope export / import (thin pass-throughs) ────────────────

/** Build the JSON envelope for `projectId` from the live store. Pure;
 *  safe to call inside React render. */
export function exportProjectEnvelope(projectId: string): ProjectStateEnvelope {
  const state = useProjectStore.getState();
  return exportProjectState(state, projectId, { buildLabel: buildLabel() });
}

/** Apply an envelope to the live store. Throws on shape mismatch.
 *  Returns the ImportSummary so the caller can surface attachment
 *  validation / rename counts in its UI. */
export function importProjectEnvelope(envelope: ProjectStateEnvelope): ImportSummary {
  return useProjectStore.getState().importProjectState(envelope);
}
