// Canvas types — extracted from screens/EngineeringCanvas.tsx as part of
// the M1 module split. Single source of truth for the structural types the
// canvas, its handles, its dock, its inspector, and its overlays all share.
//
// Imports stay narrow on purpose: this file should NOT depend on anything
// inside src/app/canvas/* (would create cycles) or on the store mutations
// (constants for derivations live in canvas/constants.ts). It depends only
// on store/types for the underlying DeviceType / DeviceKind / DoorHardware
// unions that the canvas aliases.

import type { DeviceType as StoreDeviceType, DeviceKind as StoreDeviceKind } from '../store/types';

// Canvas-local aliases for the store unions. The canvas used to carry its
// own duplicate copies of these that drifted; alias keeps single source of
// truth in store/types.ts.
export type DeviceKind = StoreDeviceKind;
export type DeviceType = StoreDeviceType;

// Text + comment tools were never wired to real handlers; removed from the
// Tool union in the surveyor gap-closure pass per "no dead controls."
export type Tool = 'select' | 'pan' | 'measure' | 'wall' | 'cable' | 'conduit' | 'pathway' | 'calibrate' | 'room' | 'annotate';

export interface Wall { id: string; x1: number; y1: number; x2: number; y2: number; }

// ─── Multisensor lens model ───────────────────────────────────────────
//
// Per-lens config for multisensor cameras. Stored as four named slots
// (a/b/c/d) so each can be selected, manipulated, and persisted
// independently on both the canvas and the inspector drawer.
export interface LensCfg {
  rotation: number; // ° (0 = east, CCW positive — same convention as device rot)
  fov: number;      // horizontal ° aperture
  range: number;    // ft — DORI Detect bound
  focal: number;    // mm
  enabled: boolean; // false = lens disabled in design, dimmed on canvas
}
export type LensId = 'a' | 'b' | 'c' | 'd';
export type ActiveLens = LensId | 'all';
export type LensMode = 'linked' | 'independent';

// ─── Canvas Device ─────────────────────────────────────────────────────
//
// Canvas-local device shape. This is what the canvas reads and writes at
// the UI layer. Mirrors the persisted store/types Device but layers on the
// canvas-only fields (lens config, color override, accessory list, etc).

export interface Device {
  id: string;
  type: DeviceType;
  label: string;
  product: string;
  x: number; y: number;
  rot: number;
  /** Single-lens camera engineering — persisted so the inspector doesn't lose state. */
  focal?: number;     // mm
  fov?: number;       // horizontal °
  range?: number;     // ft (DORI Detect bound)
  mountFt?: number;   // height AFF in ft
  ir?: boolean;
  ndaa?: boolean;
  /** Free-form engineering notes attached to the device. */
  notes?: string;
  /** Other device ids this one is linked to (pathway / failover / linked door). */
  linkedIds?: string[];
  /** Per-object color override (hex). When set, replaces the category tone
   *  for this device's glyph, cone, label, and badges. Selected from
   *  DEVICE_COLOR_PALETTE so the canvas can't drift into visual chaos. */
  color?: string;
  /** Hardware stack — ordered list of child device ids physically mounted on
   *  this host (door, gate, etc.). */
  stack?: string[];
  /** Accessory product-ids attached to this device. */
  accessories?: string[];
  /** Multisensor only — four independent lens configs. Present iff
   *  type === 'cam.multisensor'. Without this, the device falls back to the
   *  shared fov/range fields above. */
  lenses?: { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg };
  /** Multisensor lens-mode persisted on the device. */
  lensMode?: LensMode;
}

// ─── Product catalog (canvas view) ─────────────────────────────────────

/** Tech-model tag for a product. A product can fit multiple ecosystems; in
 *  that case all matching tags are present. `'all'` is shorthand for
 *  ecosystem-agnostic infrastructure (locks, cables, racks) and is ALWAYS
 *  shown regardless of the active project tech model. */
export type TechModelTag = 'cloud' | 'on_prem' | 'hybrid' | 'all';

export interface Product {
  id: string;
  type: DeviceType;
  mfr: string;
  model: string;
  sub: string;
  techModels?: TechModelTag[];
  /** Top-pick within its tech model. Drives the "Recommended" badge. */
  recommended?: boolean;
  /** Manufacturer suggested retail price (USD). BOM rollup unit-price default. */
  msrp?: number;
  ndaa?: boolean;
  onvif?: string;
  resolution?: string;
  mounts?: string[];
  poe?: string;
  powerW?: number;
  bitrateMbps?: number;
  productLine?: string;
  productName?: string;
  cameraType?: string;
  subcategory?: string;
}

/** Mount / accessory catalog — populated for the camera SKUs that have a
 *  defined accessory family. Drives the "Recommended accessories" section
 *  in the inspector. */
export interface Accessory {
  id: string;
  mfr: string;
  model: string;
  kind: 'wall-mount' | 'pole-mount' | 'pendant-mount' | 'corner-mount' | 'parapet-mount' | 'junction-box' | 'mounting-plate' | 'sun-shield';
  notes?: string;
  msrp?: number;
}

// ─── Cable types ──────────────────────────────────────────────────────

export type CableTypeId =
  | 'cat6' | 'cat6a' | 'fiber-mm' | 'fiber-sm' | 'fiber-osp' | 'composite'
  | '18-2' | '18-4' | '22-6' | 'speaker' | 'fire-alarm' | 'coax' | 'conduit';

export interface CableTypeSpec { id: CableTypeId; label: string; pricePerFt: number; tone: string; note: string; }

// ─── Site model (mock data used by the picker overview) ──────────────

export interface SiteFloor { id: string; name: string; deviceCount: number; updated: string; source: 'blueprint' | 'satellite' | 'sketch'; }
export interface SiteBuilding { id: string; name: string; address: string; floors: SiteFloor[]; }
