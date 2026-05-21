// DV Assist Phase 1 — bulk operations engine.
//
// Structured pattern: select scope, select action, preview affected
// devices, confirm, execute as one undoable transaction. Natural
// language triggering layers on top in DVA.9 by mapping a question
// to the same { scope, action } shape.
//
// Each bulk operation runs the per device executor from
// `assistantActions.ts` so the mutation path stays single sourced.
// Undo collects the individual undo payloads and reverts them in
// reverse order on a single toast click.

import type { Device, AiAction } from '../store/types';
import {
  productById, defaultLicenseFor, recommendedMountFor, requiresLicense,
  mountsForDeviceType,
} from './productCatalog';
import { executeAction, undoAction } from './assistantActions';
import { useProjectStore } from '../store/projectStore';

// ────────────────────────────── Types ───────────────────────────────

export type BulkScopeKind =
  | 'all-cameras'
  | 'all-doors'
  | 'all-readers'
  | 'by-manufacturer';

export interface BulkScope {
  kind: BulkScopeKind;
  /** Required for `by-manufacturer`. Ignored otherwise. */
  manufacturer?: string;
}

export type BulkActionKind =
  | 'apply-default-license'   // every device that requiresLicense + has no matching license
  | 'apply-recommended-mount'; // every device with a recommended mount + no mount attached

export interface BulkOperation {
  scope: BulkScope;
  action: BulkActionKind;
}

export interface AffectedDevice {
  device: Device;
  /** The product id the operation would attach. */
  productId: string;
  /** Human readable label for the preview row. */
  productLabel: string;
}

export interface BulkPreview {
  op: BulkOperation;
  affected: AffectedDevice[];
  /** Devices in scope that already have the fix (skipped). */
  alreadyDone: Device[];
  /** Devices in scope where the rule has no fix path (no default
   *  license / no recommended mount on the product). Listed so the
   *  preview is honest about what bulk can and cannot reach. */
  unreachable: Device[];
}

export interface BulkResult {
  result: string;
  /** Per device undo payloads, in execution order. The Undo runs
   *  them in REVERSE so the canvas state lands back exactly where
   *  it started. */
  undoPayloads: { actionId: string; undoPayload: any }[];
}

// ────────────────────────────── Scope ───────────────────────────────

/** Resolve a bulk scope into the list of devices it targets. Reads
 *  the live store; the caller passes a projectId for filtering. */
export function devicesInScope(scope: BulkScope, projectId: string): Device[] {
  const all = Object.values(useProjectStore.getState().devices)
    .filter((d) => d.projectId === projectId);
  switch (scope.kind) {
    case 'all-cameras':
      return all.filter((d) => d.type.startsWith('cam.'));
    case 'all-doors':
      return all.filter((d) => d.type.startsWith('inf.door') || d.type.startsWith('inf.gate') || d.type === 'inf.door-storefront');
    case 'all-readers':
      return all.filter((d) => d.type === 'acc.reader' || d.type === 'acc.biometric');
    case 'by-manufacturer': {
      const mfr = scope.manufacturer?.toLowerCase();
      if (!mfr) return [];
      return all.filter((d) => {
        const p = productById(d.product);
        return p && p.manufacturer.toLowerCase() === mfr;
      });
    }
  }
}

// ────────────────────────────── Preview ─────────────────────────────

/** Build a structured preview of what a bulk operation would do.
 *  Computes affected / alreadyDone / unreachable cohorts so the
 *  confirmation UI can show exact counts and the actual product
 *  ids that will land on the BOM. */
export function previewBulkOperation(op: BulkOperation, projectId: string): BulkPreview {
  const scope = devicesInScope(op.scope, projectId);
  const affected: AffectedDevice[] = [];
  const alreadyDone: Device[] = [];
  const unreachable: Device[] = [];

  for (const d of scope) {
    const host = productById(d.product);
    if (!host) { unreachable.push(d); continue; }

    if (op.action === 'apply-default-license') {
      if (!requiresLicense(host)) { unreachable.push(d); continue; }
      const lic = defaultLicenseFor(host);
      if (!lic) { unreachable.push(d); continue; }
      if (d.accessories?.includes(lic.id)) { alreadyDone.push(d); continue; }
      affected.push({
        device: d,
        productId: lic.id,
        productLabel: `${lic.manufacturer} ${lic.model}`,
      });
      continue;
    }

    if (op.action === 'apply-recommended-mount') {
      const rec = recommendedMountFor(host);
      const hostWhitelists = rec && (host.compatibleAccessories ?? []).includes(rec.id);
      if (!rec || !hostWhitelists) { unreachable.push(d); continue; }
      // Already credited if ANY catalog mount tagged for this device
      // type is attached (matches the rule engine's permissive credit).
      const validIds = new Set(mountsForDeviceType(d.type).map((m) => m.id));
      if ((d.accessories ?? []).some((id) => validIds.has(id))) {
        alreadyDone.push(d);
        continue;
      }
      affected.push({
        device: d,
        productId: rec.id,
        productLabel: `${rec.manufacturer} ${rec.model}`,
      });
      continue;
    }
  }

  return { op, affected, alreadyDone, unreachable };
}

// ────────────────────────────── Execute ─────────────────────────────

/** Run a bulk operation as one transaction. Returns the aggregated
 *  result string + the list of per device undoPayloads so the caller
 *  can revert with a single click. */
export function executeBulkOperation(op: BulkOperation, projectId: string): BulkResult {
  const preview = previewBulkOperation(op, projectId);
  if (preview.affected.length === 0) {
    return { result: 'Nothing to apply. Every device in scope already has the fix or has no fix path.', undoPayloads: [] };
  }
  const undos: { actionId: string; undoPayload: any }[] = [];
  for (const a of preview.affected) {
    const action: AiAction = op.action === 'apply-default-license'
      ? { id: `bulk-${a.device.id}`, kind: 'add-license', label: a.productLabel, deviceId: a.device.id, productId: a.productId }
      : { id: `bulk-${a.device.id}`, kind: 'add-mount',   label: a.productLabel, deviceId: a.device.id, productId: a.productId };
    const res = executeAction(action, projectId);
    if (res.refused) continue;
    if (res.undoPayload) {
      undos.push({ actionId: action.id, undoPayload: res.undoPayload });
    }
  }
  const verb = op.action === 'apply-default-license' ? 'licenses' : 'mounts';
  return {
    result: `Applied ${undos.length} ${verb} across ${preview.affected.length} device${preview.affected.length === 1 ? '' : 's'}.`,
    undoPayloads: undos,
  };
}

/** Reverse a previously executed bulk operation. Runs undoAction
 *  per recorded payload in reverse order so the canvas state lands
 *  back at the pre bulk snapshot exactly. */
export function undoBulkOperation(undos: BulkResult['undoPayloads']): string {
  let count = 0;
  for (let i = undos.length - 1; i >= 0; i--) {
    const u = undos[i];
    const reverted = undoAction({
      actionId: u.actionId,
      appliedAt: Date.now(),
      result: '',
      undoPayload: u.undoPayload,
    });
    if (reverted) count++;
  }
  return `Reverted ${count} bulk change${count === 1 ? '' : 's'}.`;
}

// ────────────────────────────── Catalog of available bulk ops ───────
// Stable shapes the panel surfaces as quick action buttons. Each row
// describes one preset combo of (scope, action). Future bulk ops add
// to this list; the executor stays single sourced.

export interface BulkPreset {
  id: string;
  label: string;
  scope: BulkScope;
  action: BulkActionKind;
}

export const BULK_PRESETS: BulkPreset[] = [
  {
    id: 'bulk-cam-license',
    label: 'Apply default license to all cameras',
    scope: { kind: 'all-cameras' },
    action: 'apply-default-license',
  },
  {
    id: 'bulk-cam-mount',
    label: 'Apply recommended mount to all cameras',
    scope: { kind: 'all-cameras' },
    action: 'apply-recommended-mount',
  },
];
