// Canvas pure helper utilities — extracted from screens/EngineeringCanvas.tsx
// as part of the M1 module split. No React, no JSX. Just pure functions.

import { SURVEYOR_SYMBOL_IDS } from '../components/canvas/SurveyorSymbols';
import { canHost } from '../lib/compatibility';
import { useProjectStore } from '../store/projectStore';
import type { DoorHardware } from '../store/types';
import {
  KIND_TONE, LENS_TONE, TYPE_KIND, TYPE_PILL_LABEL,
  STACKABLE_HOST_TYPES, STACK_ACCESSORY_TYPES, CABLE_TYPES, TOP_LEVEL_GROUPS,
  DEFAULT_MULTISENSOR_LENSES,
} from './constants';
import type {
  CableTypeId, CableTypeSpec, Device, DeviceKind, DeviceType, LensCfg,
} from './types';

// ─── Surveyor symbol set membership ──────────────────────────────────

const SURVEYOR_SYMBOL_SET = new Set<string>(SURVEYOR_SYMBOL_IDS as unknown as string[]);
export function SURVEYOR_SYMBOL_HAS(t: string): boolean { return SURVEYOR_SYMBOL_SET.has(t); }

// ─── Coverage / theme ─────────────────────────────────────────────────

/** Audit Group B.2 — read the current theme's coverage-band multiplier from
 *  the CSS variable set in theme.css. Dark Command keeps the DORI_BASE_OPACITY
 *  values as authored (1.0); Light Drafting pushes them up so the bands punch
 *  through a white floor (1.55); Slate Engineering lands in between (1.18). */
export function getCoverageBandMultiplier(): number {
  if (typeof window === 'undefined' || !document?.documentElement) return 1;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--coverage-band-multiplier').trim();
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

// ─── Device tone (per-object > per-category > default) ───────────────

/** V3.6 Part B — three level precedence:
 *    1. per-object override (`device.color`)
 *    2. per-category override (`store.categoryColors[kind]`)
 *    3. hardcoded `KIND_TONE` default
 *  Reads `categoryColors` via getState(); the canvas top level subscribes
 *  to the slice so renderers re-run when the user picks a new category
 *  color, and getState() then reflects it.
 *  Used everywhere the canvas needs a single color for a single device
 *  (glyph, cone, label, badge). */
export function deviceTone(d: Device): string {
  if (d.color) return d.color;
  const kind = TYPE_KIND[d.type];
  const override = useProjectStore.getState().categoryColors?.[kind];
  return override ?? KIND_TONE[kind];
}

// ─── Multisensor lens helpers ────────────────────────────────────────

/** Read the per-lens config, lazily backfilling with defaults so any
 *  multisensor renders correctly even if it wasn't seeded with lenses. */
export function getLenses(d: Device): { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg } {
  return d.lenses ?? DEFAULT_MULTISENSOR_LENSES;
}

// ─── Cable spec lookup ───────────────────────────────────────────────

export function cableSpec(id: CableTypeId): CableTypeSpec { return CABLE_TYPES.find((c) => c.id === id) ?? CABLE_TYPES[0]; }

// ─── Group / category helpers ────────────────────────────────────────

export function groupForKind(k: DeviceKind): string {
  return TOP_LEVEL_GROUPS.find((g) => g.categories.includes(k))?.id ?? 'physical';
}

// ─── Hosting tests ───────────────────────────────────────────────────

export function isStackableHost(t: DeviceType) { return STACKABLE_HOST_TYPES.has(t); }
export function isStackAccessory(t: DeviceType) { return STACK_ACCESSORY_TYPES.has(t); }

// ─── Label rendering helpers ─────────────────────────────────────────

/** Audit Group A.4 — render a manufacturer + model pair from a catalog
 *  Product or CATALOG row without ever emitting the JS literal "undefined".
 *  If both pieces are missing we fall back to whatever caller-side label the
 *  device or product carries. Used by toasts, on-canvas captions, drawer
 *  rows, and the Impact-preview fallback so a single helper owns the rule
 *  "never render 'undefined'/'null'/'NaN' as visible text". */
export function productLabel(
  source: { mfr?: string | null; manufacturer?: string | null; model?: string | null; name?: string | null; id?: string | null } | null | undefined,
  fallback?: string,
): string {
  if (!source) return fallback ?? '';
  const mfr = source.mfr ?? source.manufacturer ?? null;
  const parts = [mfr, source.model].filter((s): s is string => typeof s === 'string' && s.length > 0);
  if (parts.length > 0) return parts.join(' ');
  if (typeof source.name === 'string' && source.name.length > 0) return source.name;
  return fallback ?? (typeof source.id === 'string' ? source.id : '');
}

export function deviceTypeLabel(type: DeviceType): string {
  const explicit = TYPE_PILL_LABEL[type];
  if (explicit) return explicit;
  // Fallback: humanise the raw type slug so a new device type still reads
  // honestly until it earns its own pill label.
  const tail = type.split('.').pop() ?? type;
  return tail.replace(/-/g, ' ');
}

// ─── Host lookup at pointerup ────────────────────────────────────────

/** Pure synchronous host lookup for drop-time decisions. Replaces the
 *  hoverHost React state for the actual mutation choice on pointerup —
 *  hoverHost is set by pointermove and can be stale at pointerup. Reads
 *  the live cursor coords + the live devices array, so the decision
 *  matches what the user actually let go of the cursor on.
 *
 *  Returns null when no host sits within HOST_RANGE of the pointer.
 *  Otherwise returns the nearest host device + the result of canHost for
 *  the dragged product against that host. */
export function findHostUnderPointer(
  clientX: number,
  clientY: number,
  surfaceRect: DOMRect,
  pan: { x: number; y: number },
  zoom: number,
  devices: Device[],
  draggedType: DeviceType | string,
): { host: Device; hostKind: 'door' | 'idf'; compat: ReturnType<typeof canHost> } | null {
  const HOST_RANGE = 26;
  const cx = (clientX - surfaceRect.left - pan.x) / zoom;
  const cy = (clientY - surfaceRect.top  - pan.y) / zoom;
  let best: { dev: Device; d: number } | null = null;
  for (const dev of devices) {
    const isHost = isStackableHost(dev.type)
      || dev.type === 'net.idf' || (dev.type as string) === 'net.mdf'
      || dev.type === 'inf.rack' || dev.type === 'inf.mdf';
    if (!isHost) continue;
    const d = Math.hypot(dev.x - cx, dev.y - cy);
    if (d < HOST_RANGE && (!best || d < best.d)) best = { dev, d };
  }
  if (!best) return null;
  const hostKind: 'door' | 'idf' = isStackableHost(best.dev.type) ? 'door' : 'idf';
  const compat = canHost(hostKind, draggedType as DeviceType);
  return { host: best.dev, hostKind, compat };
}

// ─── Drag drop → door hardware mapping ───────────────────────────────

export function productTypeToDoorHardware(t: DeviceType | string): DoorHardware | null {
  switch (t) {
    case 'acc.reader':
    case 'acc.keypad':
    case 'acc.biometric':
      return 'reader';
    case 'acc.strike':       return 'strike';
    case 'acc.maglock':      return 'maglock';
    case 'acc.exit':         return 'rex';
    case 'acc.dps':          return 'dps';
    case 'int.contact':
    case 'sen.contact':      return 'contact';
    case 'aud.intercom':
    case 'acc.intercom':     return 'intercom';
    case 'acc.panic':
    case 'acc.panic-bar':
    case 'sen.panic':        return 'panic';
    case 'acc.autoop':       return 'autoop';
    case 'acc.controller':   return 'controller';
    case 'acc.psu':
    case 'pwr.poe':          return 'psu';
    default:                 return null;
  }
}

// LENS_TONE re-exported here so older imports of the helper file pick it up
// alongside the helper-related lens constants. constants.ts is the source.
export { LENS_TONE };
