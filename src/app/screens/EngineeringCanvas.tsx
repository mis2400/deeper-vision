import { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect, Component, type ErrorInfo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { useProjectStore, selectors as storeSelectors, deriveBOM, deriveDoorAssemblyLines, deriveCanvasBomRows } from '../store/projectStore';
import { SAMPLE_PRODUCTS as CATALOG, accessoriesFor as catalogAccessoriesFor, type Product as CatalogProduct } from '../lib/productCatalog';
import type {
  EngineeringLayer, CanvasLayerState, CanvasDisplayPrefs, IconSize,
  LabelDensity, BaseMapMode, DoorHardware, SurveyItemStatus,
  CanvasBomRow, CanvasBomCategory,
} from '../store/types';
import { DEFAULT_CANVAS_LAYERS, DEFAULT_DISPLAY_PREFS, coverageForDevice } from '../store/types';
import type { Device as StoreDevice, DeviceType as StoreDeviceType, DeviceKind as StoreDeviceKind } from '../store/types';
import {
  MousePointer2, Hand, Ruler, Type, MessageSquare, ChevronRight, ChevronLeft,
  Search, X, Upload, MapPin, PencilLine, Sparkles, Undo2, Redo2, ZoomIn, ZoomOut,
  Maximize2, Magnet, ChevronDown, MoreHorizontal, MoreVertical, Trash2, RotateCw, RotateCcw, Eye, EyeOff,
  Minus as WallIcon, Check, Crosshair, Layers, Share2, Users, Lock, Unlock, Plus,
  Settings2, FileText, Slash, CircleDot, GripVertical,
  Video, Aperture, ScanEye, Disc, Flame, ScanFace, KeyRound, DoorOpen, Wifi, Server, Cable, Grid3x3,
  Car, UserSquare2, Fingerprint, GitBranch, Phone, Radar, AlertTriangle, BellRing, Vibrate, Hash,
  ShieldCheck, Antenna, Volume2, Megaphone, Mic, Speaker, HardDrive, Database, Cloud, Monitor,
  Tv2, AppWindow, MonitorSmartphone, BatteryCharging, Zap, ShieldAlert, Sun, Thermometer, CloudFog,
  Droplets, Users2, Wind, Crosshair as CrosshairIcon, Calendar, ListChecks, Wrench, FileBarChart,
  Folder, Image as ImageIcon, BarChart3, DollarSign, Map as MapIcon, Activity, Clock, Copy, ExternalLink, FileDown, Presentation, HardHat, FileText as FileTextIcon,
  PaintBucket, Minimize2, PencilRuler, ScanLine, FolderUp, Network as NetworkIcon,
  PanelLeftClose, PanelLeftOpen, Compass, Maximize, Square, Columns3, Compass as CompassIcon, Satellite as SatelliteIcon, Camera as CameraIcon,
  ClipboardList, Paperclip,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalSpaceAround, AlignVerticalSpaceAround,
} from 'lucide-react';
import { SurveyorSymbol, SurveyorSymbolBody, SURVEYOR_SYMBOL_IDS } from '../components/canvas/SurveyorSymbols';
import { ProjectStateMenu } from '../components/canvas/ProjectStateMenu';
import { PricebookEditor } from '../components/canvas/PricebookEditor';
import { AttachmentPanel } from '../components/canvas/AttachmentPanel';
import { AssistantPanel } from '../components/canvas/AssistantPanel';
const SURVEYOR_SYMBOL_SET = new Set<string>(SURVEYOR_SYMBOL_IDS as unknown as string[]);
function SURVEYOR_SYMBOL_HAS(t: string): boolean { return SURVEYOR_SYMBOL_SET.has(t); }
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { canHost } from '../lib/compatibility';
import { pathwayLengthFt, ftPerPxForFloor } from '../lib/engineering';
import { buildLabel, COMMIT_HASH } from '../../build-info';
import { toast } from 'sonner';

// ─── Canvas module split (M1) ─────────────────────────────────────────
// Canonical types, constants, catalog adapter, and pure helpers now live
// under src/app/canvas/. This file still carries local copies of many of
// them while the migration is in flight; each subsequent rebuild milestone
// (state cleanup, unified left rail, plan upload Worker, etc.) replaces
// the local copy in the section it touches, until EngineeringCanvas.tsx
// is reduced to an orchestrator. The new modules are wired up here so
// build-time validation catches drift between local and canonical shapes
// even before the local copies are deleted.
//
// Source of truth ahead of EngineeringCanvas.tsx:
//   src/app/canvas/types.ts      — Tool, Wall, Device, LensCfg, Product, ...
//   src/app/canvas/constants.ts  — KIND_TONE, TYPE_KIND, CATEGORIES, ...
//   src/app/canvas/catalog.ts    — PRODUCTS, PRODUCTS_BY_ID, ...
//   src/app/canvas/utils.ts      — deviceTone, findHostUnderPointer, ...
//   src/app/canvas/interaction/dragDrop.ts — HTML5 tray-to-canvas drop (M6)

import {
  beginProductDrag, allowProductDrop, readProductIdFromDrop, clientToCanvas,
} from '../canvas/interaction/dragDrop';
import { SelectionMenu as CanvasSelectionMenu } from '../canvas/chrome/SelectionMenu';
import { LeftRail as CanvasLeftRail } from '../canvas/chrome/LeftRail';
import { StatusBar } from '../canvas/chrome/StatusBar';
import { SimulatedMapBadge } from '../canvas/plan/SimulatedMapBadge';
import { FloorPlan } from '../canvas/plan/FloorPlan';
import { CanvasErrorBoundary } from '../canvas/components/CanvasErrorBoundary';
import { IsoDeviceBadge, DEVICE_ICON } from '../canvas/devices/IsoDeviceBadge';
import { DeviceGlyph } from '../canvas/devices/DeviceGlyph';
import { HardwareGlyph } from '../canvas/devices/HardwareGlyph';
import { ConeHandles } from '../canvas/devices/ConeHandles';
import { PersonProbe, RotationRing } from '../canvas/devices/PersonProbe';
import { CategoryGlyph, KIND_ICON } from '../canvas/devices/CategoryGlyph';
import { MiniMapFloorStrip } from '../canvas/chrome/MiniMapFloorStrip';
import { MiniMap } from '../canvas/chrome/MiniMap';
import { CmdKOverlay, type CmdKCommand } from '../canvas/chrome/CmdKOverlay';
import { Onboarding } from '../canvas/chrome/Onboarding';
import { CoverageStatsPanel } from '../canvas/chrome/CoverageStatsPanel';
import { RoomInspector } from '../canvas/chrome/RoomInspector';
import { FloorOverview } from '../canvas/chrome/FloorOverview';
import { FloorSwitcher } from '../canvas/chrome/FloorSwitcher';
import { UndoRedoButtons } from '../canvas/chrome/UndoRedoButtons';
import { MobileActionsMenu } from '../canvas/chrome/MobileActionsMenu';
import { TopBar } from '../canvas/chrome/TopBar';
import { BundleInspectorDialog } from '../canvas/dialogs/BundleInspectorDialog';
import { RunToIdfDialog } from '../canvas/dialogs/RunToIdfDialog';
import { EMT_SIZES } from '../canvas/cabling';
import { FOV, FovCone } from '../canvas/coverage/FOV';
import {
  CoverageMode, DORI_BASE_OPACITY, DORI_LABEL, DORI_ORDER, DORI_PX_PER_FT,
  DORI_TILE_LABEL, FACE_WIDTH_FT, DoriLevel, DoriBand,
  doriBandsFor, pointInCone, pxPerFtAt,
} from '../canvas/coverage/dori';
import { RESOLUTION_LABEL_TO_PX, RESOLUTION_PRESETS, cameraResolution } from '../canvas/coverage/resolution';

/*
  Engineering Canvas v2 — designed around four ideas

  1.  Start with intent.  When you open the canvas without a plan, we ask
      the one question that matters: blueprint, satellite, or blank?
      Everything downstream depends on the answer.

  2.  Devices look like devices.  Bullets, domes, PTZs, multi-sensors,
      fisheyes, readers, locks — each rendered as a glyph that resembles
      the physical hardware.  Color is reserved for kind (camera / access
      / network) so the eye locks onto the right thing instantly.

  3.  Insert dock is a drawer, not a panel.  56px rail of categories.
      Click a category to expand into a 320px drawer with sub-types and
      manufacturers.  Drag a product card onto the canvas to place — a
      ghost glyph follows the cursor.  Esc cancels.

  4.  No fixed right panel.  When a device is selected, a small floating
      pill appears on the canvas next to it (rotate, lock, properties,
      delete).  Properties expand inline.  Floor plan owns the screen.

  Hover behavior (so reviewers know what's intentional):
   • Top bar pills          — title tooltip after 600ms (browser default)
   • Insert-rail categories — 600ms tooltip with shortcut letter
   • Floor plan walls / rooms — no hover state, they're scenery
   • Devices on canvas      — soft halo at 0.15 opacity, label brightens
   • Selected device        — halo + floating pill near top-right of glyph
   • Drag-from-library      — ghost glyph follows cursor at 70% opacity,
                              snap indicator appears at the snap target
*/

// Text + comment tools were never wired to real handlers; removed from the
// Tool union in the surveyor gap-closure pass per the rule "no dead controls."
// If we add inline annotation later, re-introduce them with real handlers.
type Tool = 'select' | 'pan' | 'measure' | 'wall' | 'cable' | 'conduit' | 'pathway' | 'calibrate' | 'room' | 'annotate';

interface Wall { id: string; x1: number; y1: number; x2: number; y2: number; }

// SC.7.5: canvas-local DeviceType / DeviceKind now alias the store
// unions. Previously the canvas had its own duplicate copies that
// drifted — dock category arrays used `as any` to bypass the gap.
// Single source of truth now lives in store/types.ts.
type DeviceKind = StoreDeviceKind;
type DeviceType = StoreDeviceType;

// CanvasErrorBoundary moved to canvas/components/CanvasErrorBoundary.tsx
// (M11 monolith breakup). Import at top of file.

/** Tech-model tag for a product. A product can fit multiple ecosystems; in
 *  that case all matching tags are present. `'all'` is shorthand for a product
 *  that is ecosystem-agnostic infrastructure (locks, cables, racks) and is
 *  ALWAYS shown regardless of the active project tech model. */
type TechModelTag = 'cloud' | 'on_prem' | 'hybrid' | 'all';

interface Product {
  id: string;
  type: DeviceType;
  mfr: string;
  model: string;
  sub: string;
  /** Which tech-model ecosystems this SKU belongs to. Drives the
   *  Cloud / On-prem / Hybrid filter pill at the top of the canvas. If
   *  omitted, defaults are inferred from the manufacturer in productTechModels()
   *  below; declare here when the manufacturer alone isn't sufficient (e.g.
   *  a single mfr sells both cloud-native and on-prem lines). */
  techModels?: TechModelTag[];
  /** True if this product is a top-pick / preferred SKU within its tech
   *  model. Drives the "Recommended" badge in the InsertDock. */
  recommended?: boolean;
  /** Manufacturer suggested retail price (USD). Used by the BOM rollup as
   *  the unit-price default when no project-specific override exists. */
  msrp?: number;
  /** NDAA Section 889 compliance. */
  ndaa?: boolean;
  /** ONVIF profile (S, T, etc.). Used for cross-vendor VMS compatibility. */
  onvif?: string;
  /** Native resolution / megapixel summary for cameras. */
  resolution?: string;
  /** Compatible mount accessory product ids — referenced into ACCESSORIES.
   *  When this product is selected, the inspector lists these as the
   *  recommended pairings (wall mount, pole mount, corner adapter, etc.). */
  mounts?: string[];
  /** PoE class (e.g. "Class 3", "PoE++"). Drives PoE budget calculations
   *  on switches and IDFs. */
  poe?: string;
  /** Power consumption in watts under normal load. Used by the PoE budget
   *  and UPS sizing flags. */
  powerW?: number;
  /** Estimated bitrate per stream in Mbps at H.265 / 1080p / 15fps. Used
   *  by the bandwidth/storage planner. */
  bitrateMbps?: number;
  /** Marketing product line (e.g. "P14", "M30"). Surfaced in the product
   *  search haystack so a partial model number still matches. */
  productLine?: string;
  /** Marketing product name (e.g. "P1468-LE Bullet 4MP"). Search haystack. */
  productName?: string;
  /** Camera form factor — 'ptz' | 'fisheye' | 'dome' | 'bullet' | 'multisensor'
   *  | 'turret' | 'thermal' | 'lpr' | 'body'. Drives the dock's camera
   *  sub type tabs + the search haystack. Mirrors the catalog's
   *  Product.cameraType so we don't have to round trip to the catalog on
   *  every render. */
  cameraType?: string;
  /** Catalog sub category (e.g. 'core-switch', 'turret'). Search haystack. */
  subcategory?: string;
}

/** Mount / accessory catalog — populated for the camera SKUs that have a
 *  defined accessory family. Drives the "Recommended accessories" section
 *  in the inspector. Keep this list small; expand as we sell more lines. */
interface Accessory {
  id: string;
  mfr: string;
  model: string;
  kind: 'wall-mount' | 'pole-mount' | 'pendant-mount' | 'corner-mount' | 'parapet-mount' | 'junction-box' | 'mounting-plate' | 'sun-shield';
  notes?: string;
  msrp?: number;
}
const ACCESSORIES: Accessory[] = [
  { id: 'acc-axis-t91',  mfr: 'Axis',   model: 'T91 wall arm',       kind: 'wall-mount',  msrp: 65 },
  { id: 'acc-axis-t94',  mfr: 'Axis',   model: 'T94 pole adapter',   kind: 'pole-mount',  msrp: 95 },
  { id: 'acc-axis-tg6',  mfr: 'Axis',   model: 'TG6 corner adapter', kind: 'corner-mount', msrp: 85 },
  { id: 'acc-axis-tp01', mfr: 'Axis',   model: 'TP01 parapet mount', kind: 'parapet-mount', msrp: 110 },
  { id: 'acc-han-mwd',   mfr: 'Hanwha', model: 'MWD wall mount',     kind: 'wall-mount',  msrp: 55 },
  { id: 'acc-han-mpl',   mfr: 'Hanwha', model: 'MPL pole adapter',   kind: 'pole-mount',  msrp: 90 },
  { id: 'acc-avi-pwa',   mfr: 'Avigilon', model: 'PWA wall mount',   kind: 'wall-mount',  msrp: 70 },
  { id: 'acc-verkada-cb-wall', mfr: 'Verkada', model: 'CB wall mount', kind: 'wall-mount', msrp: 75 },
  { id: 'acc-verkada-cb-pole', mfr: 'Verkada', model: 'CB pole mount', kind: 'pole-mount', msrp: 120 },
  { id: 'acc-jb-4x4',    mfr: 'Universal', model: '4×4 weatherproof J-box', kind: 'junction-box', msrp: 25 },
  { id: 'acc-pendant',   mfr: 'Universal', model: 'Pendant drop ceiling', kind: 'pendant-mount', msrp: 45 },
];

/** Accessory IDs that pair with the camera product types. The pairing is
 *  by camera type so we don't have to enumerate every SKU; engineers see the
 *  same accessory family for bullets across all bullet products. */
function accessoriesForCameraType(t: DeviceType): Accessory[] {
  if (!t.startsWith('cam.')) return [];
  if (t === 'cam.fisheye') {
    return ACCESSORIES.filter((a) => a.kind === 'pendant-mount' || a.kind === 'mounting-plate');
  }
  if (t === 'cam.ptz') {
    return ACCESSORIES.filter((a) => a.kind === 'wall-mount' || a.kind === 'pole-mount' || a.kind === 'parapet-mount');
  }
  return ACCESSORIES.filter((a) => a.kind === 'wall-mount' || a.kind === 'corner-mount' || a.kind === 'junction-box');
}

/** Manufacturer → tech-model ecosystem map. Used to auto-tag every PRODUCTS
 *  entry without writing techModels on each one. Manufacturers we sell only
 *  in cloud or only on-prem are tagged accordingly; infrastructure (locks,
 *  cables, racks) is 'all'. */
const MANUFACTURER_TECH_MODEL: Record<string, TechModelTag[]> = {
  // Cloud-native ecosystems
  Verkada: ['cloud'], Rhombus: ['cloud'], Meraki: ['cloud'], 'Cisco Meraki': ['cloud'],
  Brivo: ['cloud'], Openpath: ['cloud'], Alta: ['cloud'], 'Eagle Eye': ['cloud'],
  Arcules: ['cloud'], Spot: ['cloud'], Ambient: ['cloud'],
  // On-prem ecosystems
  Axis: ['on_prem', 'hybrid'], Hanwha: ['on_prem', 'hybrid'], Avigilon: ['on_prem', 'hybrid'],
  Bosch: ['on_prem', 'hybrid'], Genetec: ['on_prem', 'hybrid'], Milestone: ['on_prem', 'hybrid'],
  FLIR: ['on_prem', 'hybrid'], Pelco: ['on_prem'], Honeywell: ['on_prem', 'hybrid'],
  Vivotek: ['on_prem'], Dahua: ['on_prem'], Hikvision: ['on_prem'],
  Lenel: ['on_prem'], 'S2 Security': ['on_prem'], AMAG: ['on_prem'], Software_House: ['on_prem'],
  // Hybrid / dual ecosystems
  Cisco: ['cloud', 'on_prem', 'hybrid'], HID: ['all'], 'Mercury Security': ['on_prem', 'hybrid'],
  // Infrastructure — show regardless of stack
  'Von Duprin': ['all'], Securitron: ['all'], Suprema: ['on_prem', 'hybrid'],
  'Boon Edam': ['all'], '2N': ['all'], APC: ['all'], Fortinet: ['all'],
  Ubiquiti: ['hybrid', 'on_prem'], Shure: ['all'], Dell: ['all'], LG: ['all'],
  Elo: ['all'], BrightSign: ['all'], Ditek: ['all'], 'Goal Zero': ['all'],
  Monnit: ['all'], 'System Sensor': ['all'], Aercus: ['all'], Density: ['all'],
  MSA: ['all'], ShotSpotter: ['all'], STI: ['all'], DMP: ['all'], Optex: ['on_prem', 'hybrid'],
  // Added in the surveyor gap-closure pass
  'i-Pro': ['on_prem', 'hybrid'], Uniview: ['on_prem'], Avycon: ['on_prem'],
  Vicon: ['on_prem'], 'Mobotix': ['on_prem'], 'Speco': ['on_prem'],
  'Belden': ['all'], 'CommScope': ['all'], 'Middle Atlantic': ['all'],
  'HPE Aruba': ['hybrid', 'on_prem'], 'Palo Alto': ['hybrid', 'on_prem'],
  CrowdStrike: ['cloud'], Splunk: ['cloud', 'on_prem'], Cloudflare: ['cloud'],
  Honeywell_Fire: ['all'], Simplex: ['all'], 'Notifier': ['all'],
  Tridium: ['all'], Niagara: ['all'], Lutron: ['all'],
  Aiphone: ['all'], HES: ['all'], 'Iris ID': ['all'],
};

/** Returns the effective tech-model tags for a product. Falls back to the
 *  manufacturer map, and finally to ['all'] if neither is set. */
function productTechModels(p: Product): TechModelTag[] {
  if (p.techModels && p.techModels.length) return p.techModels;
  return MANUFACTURER_TECH_MODEL[p.mfr] ?? ['all'];
}

/** Does this product belong to the active project tech model? */
function productMatchesTechModel(p: Product, model: 'cloud' | 'on_prem' | 'hybrid'): boolean {
  const tags = productTechModels(p);
  if (tags.includes('all')) return true;
  if (tags.includes(model)) return true;
  // Hybrid sees both cloud and on-prem catalogs.
  if (model === 'hybrid' && (tags.includes('cloud') || tags.includes('on_prem') || tags.includes('hybrid'))) return true;
  return false;
}
/** Per-lens config for multisensor cameras. Stored as four named slots
 *  (a/b/c/d) so each can be selected, manipulated, and persisted independently
 *  on both the canvas and the inspector drawer. */
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

interface Device {
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
   *  this host (door, gate, etc.). The host glyph shows a tiny stack-count
   *  chip; clicking it opens a stack menu. */
  stack?: string[];
  /** Accessory product-ids attached to this device. */
  accessories?: string[];
  /** Multisensor only — four independent lens configs. Present iff
   *  type === 'cam.multisensor'. Without this, the device falls back to the
   *  shared fov/range fields above. */
  lenses?: { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg };
  /** Multisensor lens-mode persisted on the device so each multisensor can
   *  have its own linked/independent setting. */
  lensMode?: LensMode;
}

/** Constrained per-object color palette. Eight options — enough for
 *  meaningful grouping, few enough that the canvas stays coherent. Reset
 *  removes the override and the device returns to its category tone. */
export const DEVICE_COLOR_PALETTE: { id: string; name: string; hex: string }[] = [
  { id: 'reset',   name: 'Default',   hex: '' },
  { id: 'blue',    name: 'Blueprint', hex: '#5292DC' },
  { id: 'orange',  name: 'Loading',   hex: '#F08F3C' },
  { id: 'amber',   name: 'Warning',   hex: '#E5A23A' },
  { id: 'green',   name: 'Access',    hex: '#3FB950' },
  { id: 'red',     name: 'Critical',  hex: '#E5484D' },
  { id: 'violet',  name: 'Site A',    hex: '#A371F7' },
  { id: 'cyan',    name: 'Pathway',   hex: '#22D3EE' },
  { id: 'magenta', name: 'Custom',    hex: '#D946EF' },
];

/** V3.6 Part B — three level precedence:
 *    1. per-object override (`device.color`)
 *    2. per-category override (`store.categoryColors[kind]`)
 *    3. hardcoded `KIND_TONE` default
 *  Reads `categoryColors` via getState(); the canvas top level
 *  subscribes to the slice so renderers re-run when the user picks
 *  a new category color, and getState() then reflects it.
 *  Used everywhere the canvas needs a single color for a single
 *  device (glyph, cone, label, badge). */
function deviceTone(d: Device): string {
  if (d.color) return d.color;
  const kind = TYPE_KIND[d.type];
  const override = useProjectStore.getState().categoryColors?.[kind];
  return override ?? KIND_TONE[kind];
}

/** Cardinal default lens layout — A=E, B=S, C=W, D=N (clockwise). 90° FOV per
 *  lens covers full 360°. Used to seed new multisensors and to backfill any
 *  existing multisensor that doesn't yet carry per-lens state. */
export const DEFAULT_MULTISENSOR_LENSES: { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg } = {
  a: { rotation: 0,   fov: 90, range: 60, focal: 2.8, enabled: true },
  b: { rotation: 90,  fov: 90, range: 60, focal: 2.8, enabled: true },
  c: { rotation: 180, fov: 90, range: 60, focal: 2.8, enabled: true },
  d: { rotation: 270, fov: 90, range: 60, focal: 2.8, enabled: true },
};

/** Lens visual tones — subtle, distinguishable, NOT loud neon. Used both on
 *  the canvas cones and in the drawer A/B/C/D selector chips. */
export const LENS_TONE: Record<LensId, string> = {
  a: '#22D3EE', // cyan-400
  b: '#A78BFA', // violet-400
  c: '#FACC15', // amber-400
  d: '#34D399', // emerald-400
};
export const LENS_LABEL: Record<LensId, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };

/** Read the per-lens config, lazily backfilling with defaults so any
 *  multisensor renders correctly even if it wasn't seeded with lenses. */
export function getLenses(d: Device): { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg } {
  return d.lenses ?? DEFAULT_MULTISENSOR_LENSES;
}

const CATEGORIES: Array<{
  id: DeviceKind; label: string; tone: string;
  types: Array<{ id: DeviceType; label: string }>;
}> = [
  // V3 prep: camera category tone pulled from '#F08F3C' (orange) to
  // neutral gray to match the KIND_TONE.camera change above. Replacement
  // confirmed with Mohammad later.
  { id: 'camera',  label: 'Cameras',  tone: '#9CA3AF', types: [
    { id: 'cam.bullet',      label: 'Bullet' },
    { id: 'cam.dome',        label: 'Dome' },
    { id: 'cam.ptz',         label: 'PTZ' },
    { id: 'cam.multisensor', label: 'Multi-sensor' },
    { id: 'cam.fisheye',     label: 'Fisheye 360°' },
    { id: 'cam.thermal',     label: 'Thermal' },
    { id: 'cam.lpr',         label: 'License plate (LPR)' },
    { id: 'cam.body',        label: 'Body / wearable' },
  ]},
  { id: 'access', label: 'Access control', tone: '#3FB950', types: [
    { id: 'acc.reader',     label: 'Card reader' },
    { id: 'acc.biometric',  label: 'Biometric reader' },
    { id: 'acc.strike',     label: 'Electric strike' },
    { id: 'acc.maglock',    label: 'Maglock' },
    { id: 'acc.exit',       label: 'Request-to-exit' },
    { id: 'acc.panic-bar',  label: 'Panic bar / exit device' },
    { id: 'acc.dps',        label: 'Door position sensor (DPS)' },
    { id: 'acc.turnstile',  label: 'Turnstile / gate' },
    { id: 'acc.intercom',   label: 'Door intercom' },
  ]},
  { id: 'intrusion', label: 'Intrusion detection', tone: '#E5484D', types: [
    { id: 'int.motion',     label: 'Motion (PIR)' },
    { id: 'int.glassbreak', label: 'Glass-break' },
    { id: 'int.contact',    label: 'Door / window contact' },
    { id: 'int.panic',      label: 'Panic / duress' },
    { id: 'int.vibration',  label: 'Vibration / seismic' },
    { id: 'int.keypad',     label: 'Alarm keypad' },
  ]},
  { id: 'network', label: 'Network infrastructure', tone: '#E5B23A', types: [
    { id: 'net.switch',   label: 'PoE switch' },
    { id: 'net.idf',      label: 'IDF / closet' },
    { id: 'net.ap',       label: 'Access point' },
    { id: 'net.firewall', label: 'Firewall / gateway' },
    { id: 'net.bridge',   label: 'Wireless bridge' },
  ]},
  { id: 'audio', label: 'Audio', tone: '#A371F7', types: [
    { id: 'aud.speaker', label: 'IP speaker' },
    { id: 'aud.horn',    label: 'Horn / strobe' },
    { id: 'aud.amp',     label: 'Paging amplifier' },
    { id: 'aud.mic',     label: 'Microphone' },
    { id: 'aud.intercom',label: 'Intercom station' },
  ]},
  { id: 'storage', label: 'Recording & storage', tone: '#1F6FEB', types: [
    { id: 'sto.nvr',     label: 'Network video recorder' },
    { id: 'sto.server',  label: 'VMS server' },
    { id: 'sto.archive', label: 'Long-term archive' },
    { id: 'sto.cloud',   label: 'Cloud gateway' },
  ]},
  { id: 'display', label: 'Displays & viewing', tone: '#00B5D8', types: [
    { id: 'dis.monitor', label: 'Operator monitor' },
    { id: 'dis.wall',    label: 'Video wall' },
    { id: 'dis.kiosk',   label: 'Visitor kiosk' },
    { id: 'dis.signage', label: 'Digital signage' },
  ]},
  { id: 'power', label: 'Power & UPS', tone: '#8B5CF6', types: [
    { id: 'pwr.ups',   label: 'UPS / battery backup' },
    { id: 'pwr.poe',   label: 'PoE injector / midspan' },
    { id: 'pwr.surge', label: 'Surge protection' },
    { id: 'pwr.solar', label: 'Solar / off-grid kit' },
  ]},
  { id: 'sensor', label: 'Environmental sensors', tone: '#14B8A6', types: [
    { id: 'sen.temp',      label: 'Temperature / humidity' },
    { id: 'sen.smoke',     label: 'Smoke / fire' },
    { id: 'sen.water',     label: 'Water leak' },
    { id: 'sen.occupancy', label: 'Occupancy counter' },
    { id: 'sen.gas',       label: 'Gas / CO' },
    { id: 'sen.gunshot',   label: 'Gunshot detection' },
  ]},
  { id: 'infrastructure', label: 'Infrastructure', tone: '#9CA3AF', types: [
    { id: 'inf.door-single',     label: 'Single door' },
    { id: 'inf.door-double',     label: 'Double door' },
    { id: 'inf.door-storefront', label: 'Storefront / glass' },
    { id: 'inf.door-sliding',    label: 'Sliding door' },
    { id: 'inf.gate-swing',      label: 'Swing gate' },
    { id: 'inf.gate-slide',      label: 'Slide gate' },
    { id: 'inf.elevator',        label: 'Elevator' },
    { id: 'inf.window',          label: 'Window' },
    { id: 'inf.wall-brick',      label: 'Brick wall' },
    { id: 'inf.wall-fire',       label: 'Fire-rated wall' },
    { id: 'inf.wall-concrete',   label: 'Concrete wall' },
    { id: 'inf.rack',            label: 'Rack' },
    { id: 'inf.mdf',             label: 'MDF / main closet' },
  ]},
  { id: 'cyber', label: 'Cyber security', tone: '#22D3EE', types: [
    { id: 'cyb.endpoint',     label: 'Endpoint protection' },
    { id: 'cyb.siem',         label: 'SIEM / log aggregation' },
    { id: 'cyb.firewall-ng',  label: 'Next-gen firewall' },
    { id: 'cyb.vpn',          label: 'Remote access / VPN' },
  ]},
  { id: 'fire', label: 'Fire / life safety', tone: '#F87171', types: [
    { id: 'fls.pull-station', label: 'Manual pull station' },
    { id: 'fls.fire-panel',   label: 'Fire alarm panel' },
    { id: 'fls.strobe',       label: 'Notification strobe' },
    { id: 'fls.sprinkler',    label: 'Sprinkler head' },
  ]},
  { id: 'building', label: 'Building systems', tone: '#94A3B8', types: [
    { id: 'bld.hvac-controller',  label: 'HVAC controller' },
    { id: 'bld.lighting-panel',   label: 'Lighting control panel' },
    { id: 'bld.bms-gateway',      label: 'BMS gateway' },
  ]},
];

/** Top-level domain groups. The InsertDock first shows these groups; clicking
 *  one drills into the categories within. Lets us match real-world engineering
 *  language: Physical Security / Infrastructure / IT / AV / etc. */
const TOP_LEVEL_GROUPS: Array<{
  id: string;
  label: string;
  tone: string;
  categories: DeviceKind[];
  hint: string;
}> = [
  { id: 'physical', label: 'Physical security', tone: '#5292DC', hint: 'Cameras, access, intrusion',
    categories: ['camera', 'access', 'intrusion'] },
  { id: 'cyber', label: 'Cyber security', tone: '#22D3EE', hint: 'Endpoint, SIEM, NGFW, VPN',
    categories: ['cyber'] },
  { id: 'infrastructure', label: 'Infrastructure', tone: '#9CA3AF', hint: 'Doors, walls, gates, elevators, racks, MDF',
    categories: ['infrastructure'] },
  { id: 'it', label: 'IT / Network', tone: '#E5B23A', hint: 'Switches, IDFs, APs, firewalls',
    categories: ['network', 'storage'] },
  { id: 'av', label: 'Audio visual', tone: '#A371F7', hint: 'Speakers, mics, displays, signage',
    categories: ['audio', 'display'] },
  { id: 'fire', label: 'Fire / life safety', tone: '#F87171', hint: 'Pull stations, fire panels, strobes',
    categories: ['fire'] },
  { id: 'building', label: 'Building systems', tone: '#94A3B8', hint: 'HVAC, lighting, BMS',
    categories: ['building'] },
  { id: 'env', label: 'Environmental', tone: '#14B8A6', hint: 'Smoke, leak, gas, occupancy',
    categories: ['sensor'] },
  { id: 'power', label: 'Power', tone: '#8B5CF6', hint: 'UPS, PoE injectors, surge, solar',
    categories: ['power'] },
];

function groupForKind(k: DeviceKind): string {
  return TOP_LEVEL_GROUPS.find((g) => g.categories.includes(k))?.id ?? 'physical';
}

/** Cable / wire types supported by the cable tool. Each carries a per-foot
 *  unit price so the BOM can roll up cable cost automatically. Drawn onto
 *  the canvas in the cable tool. */
export type CableTypeId =
  | 'cat6' | 'cat6a' | 'fiber-mm' | 'fiber-sm' | 'fiber-osp' | 'composite'
  | '18-2' | '18-4' | '22-6' | 'speaker' | 'fire-alarm' | 'coax' | 'conduit';

interface CableTypeSpec { id: CableTypeId; label: string; pricePerFt: number; tone: string; note: string; }
const CABLE_TYPES: CableTypeSpec[] = [
  { id: 'cat6',       label: 'Cat6',       pricePerFt: 0.42, tone: '#5292DC', note: 'Standard IP camera / access' },
  { id: 'cat6a',      label: 'Cat6A',      pricePerFt: 0.78, tone: '#5292DC', note: 'Higher bandwidth · PoE++' },
  { id: 'fiber-mm',   label: 'Fiber MM',   pricePerFt: 1.65, tone: '#A371F7', note: 'Multimode · indoor distance' },
  { id: 'fiber-sm',   label: 'Fiber SM',   pricePerFt: 1.85, tone: '#A371F7', note: 'Single-mode · outdoor / long-haul' },
  { id: 'fiber-osp',  label: 'OSP fiber',  pricePerFt: 2.35, tone: '#A371F7', note: 'Outside-plant rated' },
  { id: 'composite',  label: 'Composite',  pricePerFt: 1.40, tone: '#F08F3C', note: 'Power + data composite' },
  { id: '18-2',       label: '18/2',       pricePerFt: 0.22, tone: '#E5B23A', note: 'Strike / lock low-voltage' },
  { id: '18-4',       label: '18/4',       pricePerFt: 0.28, tone: '#E5B23A', note: 'Reader power + data' },
  { id: '22-6',       label: '22/6',       pricePerFt: 0.32, tone: '#E5B23A', note: 'Access controller home run' },
  { id: 'speaker',    label: 'Speaker',    pricePerFt: 0.30, tone: '#22D3EE', note: '70V or low-impedance speaker' },
  { id: 'fire-alarm', label: 'Fire alarm', pricePerFt: 0.65, tone: '#F87171', note: 'FPL/FPLR/FPLP rated' },
  { id: 'coax',       label: 'Coax',       pricePerFt: 0.55, tone: '#94A3B8', note: 'RG-59 / RG-6 legacy CCTV' },
  { id: 'conduit',    label: 'Conduit only', pricePerFt: 4.80, tone: '#9CA3AF', note: 'Empty path · EMT or PVC' },
];
function cableSpec(id: CableTypeId): CableTypeSpec { return CABLE_TYPES.find((c) => c.id === id) ?? CABLE_TYPES[0]; }
// PRODUCTS is now a derived adapter view of the unified catalog in
// src/app/lib/productCatalog.ts — the SAME data the /catalog screen
// reads. Changing the catalog updates both the InsertDock and the
// Product Catalog screen automatically. Single source of truth.
const PRODUCTS: Product[] = CATALOG
  .filter((p) => !!p.deviceType)
  .map((p): Product => {
    const subBits: string[] = [];
    if (p.resolution)    subBits.push(p.resolution);
    if (p.cameraType)    subBits.push(p.cameraType);
    if (p.indoorOutdoor) subBits.push(p.indoorOutdoor);
    if (p.ipRating)      subBits.push(p.ipRating);
    const sub = p.notes ? p.notes.slice(0, 80) : subBits.join(' · ') || p.productName || '';
    // CatalogProduct.techModels is the union ['cloud','on_prem','hybrid'].
    // The dock historically uses TechModelTag (which adds 'all' for
    // ecosystem-agnostic SKUs). Map: 3-way membership === present in all
    // stacks → 'all'; otherwise pass through as-is.
    const tech: TechModelTag[] = p.techModels.length === 3
      ? ['all']
      : (p.techModels as unknown as TechModelTag[]);
    return {
      id: p.id,
      type: p.deviceType as DeviceType,
      mfr: p.manufacturer,
      model: p.model,
      sub,
      techModels: tech,
      recommended: !!p.recommended,
      msrp: p.msrp,
      ndaa: p.ndaa,
      onvif: p.onvifProfile,
      resolution: p.resolution,
      poe: p.poeClass ? `Class ${p.poeClass}` : undefined,
      powerW: p.powerDrawWatts,
      bitrateMbps: p.bandwidthMbps,
      productLine: p.productLine,
      productName: p.productName,
      cameraType: p.cameraType,
      subcategory: p.subcategory,
    };
  });
/** Index of PRODUCTS by id for O(1) lookup. Used in the hot canvas
 *  rendering loop (the per-camera label caption resolves catalog
 *  product on every render — at 50+ cameras × pan/zoom/drag frames,
 *  a linear `PRODUCTS.find` becomes a measurable cost). Built once at
 *  module load alongside PRODUCTS so the canvas never pays for the
 *  scan. */
const PRODUCTS_BY_ID: Map<string, Product> = new Map(PRODUCTS.map((p) => [p.id, p]));

/** Audit Group A.4 — render a manufacturer + model pair from a catalog
 *  Product or CATALOG row without ever emitting the JS literal "undefined".
 *  If both pieces are missing we fall back to whatever caller-side label
 *  the device or product carries. Used by toasts, on-canvas captions,
 *  drawer rows, and the Impact-preview fallback so a single helper owns
 *  the rule "never render 'undefined'/'null'/'NaN' as visible text". */
function productLabel(
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

/** Audit Group A.5 — granular device-type label, single source of truth for
 *  the SelectionPill kind chip. Granular enough to be honest (a `net.ap` is
 *  an "access point", not a "pathway"; a door is a "door", not an "opening"),
 *  while still short enough to sit next to the device id in the pill.
 *  Falls back to a humanised type slug for any future device type that
 *  forgets to register here. */
const TYPE_PILL_LABEL: Partial<Record<DeviceType, string>> = {
  // cameras
  'cam.bullet': 'camera', 'cam.dome': 'camera', 'cam.ptz': 'camera',
  'cam.multisensor': 'multisensor camera', 'cam.fisheye': 'fisheye camera',
  'cam.thermal': 'thermal camera', 'cam.lpr': 'LPR camera', 'cam.body': 'body camera',
  // access control
  'acc.reader': 'reader', 'acc.strike': 'strike', 'acc.maglock': 'maglock',
  'acc.exit': 'exit device', 'acc.turnstile': 'turnstile', 'acc.intercom': 'intercom',
  'acc.biometric': 'biometric reader', 'acc.panic-bar': 'panic bar', 'acc.dps': 'door sensor',
  // network
  'net.switch': 'switch', 'net.idf': 'IDF', 'net.ap': 'access point',
  'net.firewall': 'firewall', 'net.bridge': 'bridge',
  // intrusion
  'int.motion': 'motion sensor', 'int.glassbreak': 'glass-break',
  'int.contact': 'contact', 'int.panic': 'panic button',
  'int.vibration': 'vibration sensor', 'int.keypad': 'keypad',
  // audio
  'aud.speaker': 'speaker', 'aud.mic': 'microphone', 'aud.horn': 'horn',
  'aud.amp': 'amplifier', 'aud.intercom': 'intercom',
  // storage
  'sto.nvr': 'NVR', 'sto.server': 'server', 'sto.archive': 'archive', 'sto.cloud': 'cloud',
  // display
  'dis.monitor': 'monitor', 'dis.wall': 'video wall', 'dis.kiosk': 'kiosk', 'dis.signage': 'signage',
  // power
  'pwr.ups': 'UPS', 'pwr.poe': 'PoE injector', 'pwr.surge': 'surge protector', 'pwr.solar': 'solar',
  // environmental sensors
  'sen.temp': 'temp sensor', 'sen.smoke': 'smoke detector',
  'sen.water': 'water sensor', 'sen.occupancy': 'occupancy sensor',
  'sen.gas': 'gas sensor', 'sen.gunshot': 'gunshot sensor',
  // infrastructure
  'inf.door-single': 'door', 'inf.door-double': 'door',
  'inf.door-storefront': 'door', 'inf.door-sliding': 'door',
  'inf.window': 'window', 'inf.wall-brick': 'wall',
  'inf.wall-fire': 'fire wall', 'inf.wall-concrete': 'wall',
  'inf.gate-swing': 'gate', 'inf.gate-slide': 'gate', 'inf.elevator': 'elevator',
  'inf.mdf': 'MDF', 'inf.rack': 'rack',
  // cyber
  'cyb.endpoint': 'endpoint', 'cyb.siem': 'SIEM',
  'cyb.firewall-ng': 'firewall', 'cyb.vpn': 'VPN',
  // fire / life-safety
  'fls.pull-station': 'pull station', 'fls.fire-panel': 'fire panel',
  'fls.strobe': 'strobe', 'fls.sprinkler': 'sprinkler',
  // building
  'bld.hvac-controller': 'HVAC controller',
  'bld.lighting-panel': 'lighting panel',
  'bld.bms-gateway': 'BMS gateway',
};

function deviceTypeLabel(type: DeviceType): string {
  const explicit = TYPE_PILL_LABEL[type];
  if (explicit) return explicit;
  // Fallback: humanise the raw type slug so a new device type still
  // reads honestly until it earns its own pill label.
  const tail = type.split('.').pop() ?? type;
  return tail.replace(/-/g, ' ');
}

/** Audit Group B.2 — read the current theme's coverage-band multiplier
 *  from the CSS variable set in theme.css. Dark Command keeps the
 *  DORI_BASE_OPACITY values as authored (1.0); Light Drafting pushes
 *  them up so the bands punch through a white floor (1.55); Slate
 *  Engineering lands in between (1.18). The function is intentionally
 *  callable from a JSX render path; the underlying CSS var resolves
 *  in O(1) and only changes when the operator switches theme in
 *  Settings, so over-reads are cheap. */
function getCoverageBandMultiplier(): number {
  if (typeof window === 'undefined' || !document?.documentElement) return 1;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--coverage-band-multiplier').trim();
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

const TYPE_KIND: Record<DeviceType, DeviceKind> = {
  'cam.bullet': 'camera', 'cam.dome': 'camera', 'cam.ptz': 'camera', 'cam.multisensor': 'camera', 'cam.fisheye': 'camera', 'cam.thermal': 'camera', 'cam.lpr': 'camera', 'cam.body': 'camera',
  'acc.reader': 'access', 'acc.strike': 'access', 'acc.maglock': 'access', 'acc.exit': 'access', 'acc.turnstile': 'access', 'acc.intercom': 'access', 'acc.biometric': 'access', 'acc.panic-bar': 'access', 'acc.dps': 'access',
  'net.switch': 'network', 'net.idf': 'network', 'net.ap': 'network', 'net.firewall': 'network', 'net.bridge': 'network',
  'int.motion': 'intrusion', 'int.glassbreak': 'intrusion', 'int.contact': 'intrusion', 'int.panic': 'intrusion', 'int.vibration': 'intrusion', 'int.keypad': 'intrusion',
  'aud.speaker': 'audio', 'aud.mic': 'audio', 'aud.horn': 'audio', 'aud.amp': 'audio', 'aud.intercom': 'audio',
  'sto.nvr': 'storage', 'sto.server': 'storage', 'sto.archive': 'storage', 'sto.cloud': 'storage',
  'dis.monitor': 'display', 'dis.wall': 'display', 'dis.kiosk': 'display', 'dis.signage': 'display',
  'pwr.ups': 'power', 'pwr.poe': 'power', 'pwr.surge': 'power', 'pwr.solar': 'power',
  'sen.temp': 'sensor', 'sen.smoke': 'sensor', 'sen.water': 'sensor', 'sen.occupancy': 'sensor', 'sen.gas': 'sensor', 'sen.gunshot': 'sensor',
  'inf.door-single': 'infrastructure', 'inf.door-double': 'infrastructure', 'inf.door-storefront': 'infrastructure', 'inf.door-sliding': 'infrastructure',
  'inf.window': 'infrastructure', 'inf.wall-brick': 'infrastructure', 'inf.wall-fire': 'infrastructure', 'inf.wall-concrete': 'infrastructure',
  'inf.gate-swing': 'infrastructure', 'inf.gate-slide': 'infrastructure', 'inf.elevator': 'infrastructure',
  'inf.mdf': 'infrastructure', 'inf.rack': 'infrastructure',
  'cyb.endpoint': 'cyber', 'cyb.siem': 'cyber', 'cyb.firewall-ng': 'cyber', 'cyb.vpn': 'cyber',
  'fls.pull-station': 'fire', 'fls.fire-panel': 'fire', 'fls.strobe': 'fire', 'fls.sprinkler': 'fire',
  'bld.hvac-controller': 'building', 'bld.lighting-panel': 'building', 'bld.bms-gateway': 'building',
};

// V3.6 Part B — restrained professional palette of CATEGORY DEFAULTS.
// Distinct enough that a plan reads by system at a glance; muted
// enough that nothing reads loud or clashing against the floorplan.
// These are the hardcoded BASE; a user-changeable per-category
// override layers on top (see `setCategoryColor` in the store), and a
// per-object override (`device.color`) layers above that.
// Precedence resolved by `deviceTone(d)`: item > category > default.
const KIND_TONE: Record<DeviceKind, string> = {
  camera:         '#4A8FCC', // steel blue — see / observe
  access:         '#C89464', // warm bronze — control / locks
  network:        '#5A9AA8', // teal — data
  intrusion:      '#C26464', // muted alarm red
  audio:          '#9B7AB8', // signal purple
  storage:        '#6E7CB8', // data indigo
  display:        '#4FA8B8', // visual cyan
  power:          '#B8784A', // electrical rust
  sensor:         '#8FA864', // environmental sage
  infrastructure: '#7E8590', // structural cool gray
  cyber:          '#3FA48F', // digital teal
  fire:           '#C25A4A', // life safety red
  building:       '#889078', // mechanical sage gray
};

/** Hosts that can host a hardware stack (reader/strike/REX/DPS/panic-bar).
 *  Doors and gates are the canonical hosts. Used by canHost and by the stack
 *  count chip rendering. */
const STACKABLE_HOST_TYPES = new Set<DeviceType>([
  'inf.door-single', 'inf.door-double', 'inf.door-storefront', 'inf.door-sliding',
  'inf.gate-swing', 'inf.gate-slide', 'inf.elevator',
]);
/** Accessory types that mount on a stackable host. Order is rendering
 *  preference inside the stack popover. */
const STACK_ACCESSORY_TYPES = new Set<DeviceType>([
  'acc.reader', 'acc.biometric', 'acc.strike', 'acc.maglock',
  'acc.exit', 'acc.panic-bar', 'acc.dps', 'acc.intercom',
  'int.contact',
]);
function isStackableHost(t: DeviceType) { return STACKABLE_HOST_TYPES.has(t); }
function isStackAccessory(t: DeviceType) { return STACK_ACCESSORY_TYPES.has(t); }

/** Map a device/product type onto a door-assembly hardware slot. Doors
 *  store their hardware as one persisted record (`doorAssembly[]`) on
 *  the door device itself — NOT as a list of ghost accessory devices.
 *  When the user drags a reader (or strike / REX / etc.) onto a door,
 *  this mapping decides which `DoorHardware` value to add. Returns null
 *  for types that aren't door-assembly hardware. */
/** Pure synchronous host lookup for drop-time decisions. Replaces the
 *  hoverHost React state for the actual mutation choice on pointerup —
 *  hoverHost is set by pointermove and can be stale at pointerup
 *  (the move handler might not have flushed for the final cursor
 *  position, or the user could lift the pointer just outside the
 *  hover-feedback range). Reads the live cursor coords + the live
 *  devices array, so the decision matches what the user actually let
 *  go of the cursor on.
 *
 *  Returns null when no host sits within HOST_RANGE of the pointer.
 *  Otherwise returns the nearest host device + the result of canHost
 *  for the dragged product against that host. */
function findHostUnderPointer(
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
      || dev.type === 'net.idf' || dev.type === 'net.mdf'
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

function productTypeToDoorHardware(t: DeviceType | string): DoorHardware | null {
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

const SEED_DEVICES: Device[] = [
  { id: 'CAM-101', type: 'cam.bullet',      label: 'Lobby NE',   product: 'p-axis-p1468',   x: 260, y: 220, rot:  35 },
  { id: 'CAM-102', type: 'cam.bullet',      label: 'Lobby SW',   product: 'p-axis-p1468',   x: 260, y: 460, rot: -35 },
  { id: 'CAM-103', type: 'cam.multisensor', label: 'Atrium',     product: 'p-axis-p3827',   x: 480, y: 340, rot:   0,
    lensMode: 'linked',
    lenses: { ...DEFAULT_MULTISENSOR_LENSES } },
  { id: 'CAM-104', type: 'cam.ptz',         label: 'Exterior N', product: 'p-axis-q6315',   x: 620, y: 200, rot: 200 },
  { id: 'CAM-105', type: 'cam.fisheye',     label: 'Conference', product: 'p-axis-m4327',   x: 700, y: 460, rot:   0 },
  { id: 'RD-1',    type: 'acc.reader',      label: 'Lobby in',   product: 'p-hid-signo20',  x: 400, y: 130, rot:   0 },
  { id: 'DR-1',    type: 'acc.strike',      label: 'Main entry', product: 'p-vd-6210',      x: 420, y: 130, rot:   0 },
  { id: 'AP-1',    type: 'net.ap',          label: 'Floor 1 AP', product: 'p-cisco-ap',     x: 360, y: 320, rot:   0 },
];

// M11 — FLOORS / SiteFloor / SiteBuilding / SITE_BUILDINGS removed
// here: they were the seed for the dead MapsPanel below. The
// canvas/types.ts + canvas/constants.ts already host the live
// versions of those types and the seed.

export function EngineeringCanvas() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();

  const [onboarded, setOnboarded] = useState(true);
  const [siteAddress, setSiteAddress] = useState<string>('');

  const [tool, setTool] = useState<Tool>('select');

  // ── Project store integration ──────────────────────────────────────
  // Devices are no longer local state. They're read from the shared project
  // store (filtered to this project) and written back via granular actions.
  // The component still calls `setDevices(updater)` internally — we provide
  // that as a facade so every existing caller continues to work, but each
  // call now diffs against the persisted store snapshot and dispatches
  // add/update/remove actions.
  const storeDevices = useProjectStore((s) => s.devices);
  const storeAddDevice    = useProjectStore((s) => s.addDevice);
  const storeUpdateDevice = useProjectStore((s) => s.updateDevice);
  const storeRemoveDevice = useProjectStore((s) => s.removeDevice);

  // V3.6 Part B — subscribe to per-category color overrides at the
  // canvas top level so every descendant render path (HardwareGlyph,
  // cones, badges) picks up new colors when the user changes them
  // via the dock category picker. `deviceTone(d)` reads the same
  // slice via getState() inside helper functions; this subscription
  // is what triggers the re-render that makes getState() see the
  // new value.
  const categoryColors = useProjectStore((s) => s.categoryColors);
  const setCategoryColor = useProjectStore((s) => s.setCategoryColor);
  void categoryColors;

  // Which floor are we editing? Canvas V2 Pass 2A.2 — read from the
  // currentFloorIdByProject sticky state. Falls back to the project's
  // default floor (level 0 if present, else lowest level) when no
  // sticky exists yet — covers fresh projects and migrated v19 stores
  // that didn't have the sticky map initialised.
  const stickyFloorId = useProjectStore((s) => s.currentFloorIdByProject[projectId ?? 'p1']);
  const fallbackFloorId = useProjectStore((s) => {
    const pid = projectId ?? 'p1';
    const list = Object.values(s.floors).filter((f) => f.projectId === pid);
    const ground = list.find((f) => f.level === 0);
    if (ground) return ground.id;
    list.sort((a, b) => (a.level - b.level) || ((a.createdAt ?? 0) - (b.createdAt ?? 0)));
    return list[0]?.id ?? '';
  });
  const currentFloorId = stickyFloorId || fallbackFloorId;
  const setCurrentFloorIdForProject = useProjectStore((s) => s.setCurrentFloorIdForProject);
  // Pass 2A.3 — ref so the floor-change effect (declared after selId
  // useState further down) can see the prior currentFloorId.
  const prevFloorIdRef = useRef<string>('');
  // All floors on this project, sorted by level descending (top of
  // the building first) — matches the natural building elevation
  // mental model so the dropdown reads top to bottom: roof → ground → basement.
  const floorsMapForProject = useProjectStore((s) => s.floors);
  const projectFloors = useMemo(() => {
    const pid = projectId ?? 'p1';
    return Object.values(floorsMapForProject)
      .filter((f) => f.projectId === pid)
      .sort((a, b) => (b.level - a.level) || ((b.createdAt ?? 0) - (a.createdAt ?? 0)));
  }, [floorsMapForProject, projectId]);
  // Imported floorplan background — when set, it renders beneath devices
  // on the active floor. Driven by the Import Floorplan dialog and by
  // VisionScan's "Import to canvas" handoff.
  const floorBackground = useProjectStore((s) =>
    currentFloorId ? s.floors[currentFloorId]?.background : undefined,
  );
  // Calibrated ft-per-px for every displayed-foot readout on this canvas.
  // Falls back to the canvas default (1/20) when the floor is missing or
  // has not been calibrated yet. Use this single value at every site
  // that converts canvas pixels to feet — never hardcode `/ 20`.
  const currentFloorPxToFt = useProjectStore((s) =>
    ftPerPxForFloor(currentFloorId ? s.floors[currentFloorId] : undefined),
  );
  // Subscribe to the floor's explicit calibration marker so the scale bar
  // re-renders when the user calibrates / un-calibrates. Reading via
  // `useProjectStore.getState()` from an inline IIFE would not subscribe.
  const currentFloorCalibratedAt = useProjectStore((s) =>
    currentFloorId ? s.floors[currentFloorId]?.calibratedAt : undefined,
  );

  // Devices in scope for this canvas: project + current floor. Memoized so
  // we don't re-allocate on every parent render.
  const devices = useMemo(() => {
    const pid = projectId ?? 'p1';
    return Object.values(storeDevices).filter(
      (d) => d.projectId === pid && (currentFloorId === '' || d.floorId === currentFloorId),
    ) as unknown as Device[];
  }, [storeDevices, projectId, currentFloorId]);

  // Canvas V2 Pass 1.1 — undo / redo. Snapshot devices BEFORE each
  // mutation so canvasUndo can swap back. Coalesce key collapses
  // rapid drag-moves of a single device into one undoable step; an
  // add or delete starts a fresh step regardless.
  const pushCanvasHistory = useProjectStore((s) => s.pushCanvasHistory);

  // Canvas V2 Pass 1.2 — lockedIds ref so the setDevices facade
  // (declared next, before the useState that backs lockedIds) can
  // read the live lock set at mutation time without re-creating the
  // facade on every lock toggle. The sync effect lives next to the
  // useState declaration further down.
  const lockedIdsRef = useRef<Set<string>>(new Set());

  // Canvas V2 Pass 2D — annotations subscription, filtered to active floor.
  const annotationsMap = useProjectStore((s) => s.annotations);
  const addAnnotation = useProjectStore((s) => s.addAnnotation);
  const updateAnnotation = useProjectStore((s) => s.updateAnnotation);
  const removeAnnotation = useProjectStore((s) => s.removeAnnotation);
  const currentFloorAnnotations = useMemo(
    () => Object.values(annotationsMap).filter((a) => a.floorId === currentFloorId),
    [annotationsMap, currentFloorId],
  );
  // Annotation kind selector — operator clicks "Annotate" tool, then
  // picks note / highlight / callout; the canvas click handler reads
  // this to decide what to drop.
  const [annotateKind, setAnnotateKind] = useState<'note' | 'callout'>('note');
  const operatorName = useProjectStore((s) => s.userPrefs?.fullName || s.userPrefs?.jobTitle || 'Operator');
  const placeAnnotation = useCallback((x: number, y: number) => {
    if (!currentFloorId) return;
    const id = `an-${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;
    // Callouts auto number: count existing callouts on this floor and add 1.
    const existingCallouts = currentFloorAnnotations.filter((a) => a.kind === 'callout').length;
    pushCanvasHistory('Added annotation', ['annotations']);
    addAnnotation({
      id,
      projectId: projectId ?? 'p1',
      floorId: currentFloorId,
      kind: annotateKind,
      x, y,
      text: annotateKind === 'callout' ? '' : 'New note',
      color: 'yellow',
      number: annotateKind === 'callout' ? existingCallouts + 1 : undefined,
      author: operatorName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }, [currentFloorId, projectId, annotateKind, currentFloorAnnotations, addAnnotation, operatorName, pushCanvasHistory]);

  // Canvas V2 Pass 2C.1 — rooms subscription, filtered to active floor.
  const roomsMap = useProjectStore((s) => s.rooms);
  const updateRoom = useProjectStore((s) => s.updateRoom);
  const currentFloorRooms = useMemo(
    () => Object.values(roomsMap).filter((r) => r.floorId === currentFloorId),
    [roomsMap, currentFloorId],
  );
  const [selRoomId, setSelRoomId] = useState<string | null>(null);

  // Canvas V2 Pass 2C.2 — auto detect rooms from walls. Scans the
  // active floor's walls for orthogonal closed rectangles formed by
  // four walls whose endpoints meet within a small tolerance.
  // Non rectangular faces fall through; operators draw those by hand
  // with the room tool (2C.1). The brief asks for closed polygon
  // detection — rectangles are a useful subset and the most common
  // case in commercial / multifamily floor plans.
  // detectRoomsFromWalls is defined later (after allWalls is declared)
  // to avoid the TDZ error that bites when the useCallback dep array
  // dereferences allWalls during initial render.
  const detectRoomsFromWallsRef = useRef<() => void>(() => {});

  // Canvas V2 Pass 1.8 — persisted tape-measure subscription + visibility toggle.
  const measurementsMap = useProjectStore((s) => s.measurements);
  const removeMeasurement = useProjectStore((s) => s.removeMeasurement);
  const clearMeasurementsForFloor = useProjectStore((s) => s.clearMeasurementsForFloor);
  const persistedMeasurements = useMemo(
    () => Object.values(measurementsMap).filter((m) => m.floorId === currentFloorId),
    [measurementsMap, currentFloorId],
  );
  const [measurementsVisible, setMeasurementsVisible] = useState(true);

  // Canvas V2 Pass 1.9 — Cmd K search + command bar state.
  const [cmdKOpen, setCmdKOpen] = useState(false);

  // Canvas V2 Pass 2A.7 — multi floor overview. When true, the canvas
  // surface is replaced with a tile grid showing every floor at once.
  // Click any tile to dive in to that floor.
  const [overviewOpen, setOverviewOpen] = useState(false);

  // Canvas V2 Pass 2B.3 + 2B.4 — coverage grid + stats. Computed once
  // per render of EngineeringCanvas, consumed both by the heatmap SVG
  // overlay (inside CanvasSurface) and the chrome-side
  // CoverageStatsPanel. Heavy-ish so memoised over devices +
  // background bounds + floor scale.
  const coverageGrid = useMemo(() => {
    if (currentFloorPxToFt <= 0) return null;
    const w = (floorBackground?.naturalWidth ?? 800);
    const h = (floorBackground?.naturalHeight ?? 600);
    const COLS = 36;
    const cellW = w / COLS;
    const cellH = cellW;
    const ROWS = Math.max(8, Math.round(h / cellH));
    type ShapeRec =
      | { kind: 'circle'; cx: number; cy: number; r: number; kindGroup: 'camera' | 'access' | 'sensor' | 'audio' | 'network' | 'other' }
      | { kind: 'cone'; cx: number; cy: number; r: number; halfRad: number; rotRad: number; kindGroup: 'camera' | 'access' | 'sensor' | 'audio' | 'network' | 'other' };
    const shapes: ShapeRec[] = [];
    const groupForType = (t: string): ShapeRec['kindGroup'] => {
      if (t.startsWith('cam.')) return 'camera';
      if (t.startsWith('acc.')) return 'access';
      if (t.startsWith('sen.')) return 'sensor';
      if (t.startsWith('aud.')) return 'audio';
      if (t.startsWith('net.')) return 'network';
      return 'other';
    };
    for (const d of devices) {
      const grp = groupForType(d.type);
      if (grp === 'camera') {
        const lens = (d.lenses as any)?.a ?? null;
        const fov = lens?.fov ?? 90;
        const range = lens?.range ?? 30;
        const rPx = range / currentFloorPxToFt;
        if (rPx < 1) continue;
        shapes.push({ kind: 'cone', cx: d.x, cy: d.y, r: rPx, halfRad: (fov / 2) * Math.PI / 180, rotRad: ((d.rot ?? 0) - 90) * Math.PI / 180, kindGroup: 'camera' });
        continue;
      }
      const profile = coverageForDevice(d as any);
      if (profile.shape === 'radius' && profile.rangeFt) {
        shapes.push({ kind: 'circle', cx: d.x, cy: d.y, r: profile.rangeFt / currentFloorPxToFt, kindGroup: grp });
      } else if (profile.shape === 'cone' && profile.rangeFt && profile.fovDeg) {
        shapes.push({ kind: 'cone', cx: d.x, cy: d.y, r: profile.rangeFt / currentFloorPxToFt, halfRad: (profile.fovDeg / 2) * Math.PI / 180, rotRad: ((d.rot ?? 0) - 90) * Math.PI / 180, kindGroup: grp });
      }
    }
    type CellRec = { x: number; y: number; covered: boolean; groups: Set<ShapeRec['kindGroup']> };
    const cellList: CellRec[] = [];
    const coveredByGroup: Record<string, number> = { camera: 0, access: 0, sensor: 0, audio: 0, network: 0, other: 0 };
    let coveredCount = 0;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const cx = col * cellW + cellW / 2;
        const cy = row * cellH + cellH / 2;
        const groups = new Set<ShapeRec['kindGroup']>();
        for (const s of shapes) {
          const dx = cx - s.cx; const dy = cy - s.cy;
          const d2 = dx * dx + dy * dy;
          const r2 = s.r * s.r;
          if (d2 > r2) continue;
          if (s.kind === 'cone') {
            const ang = Math.atan2(dy, dx) - s.rotRad;
            const norm = Math.atan2(Math.sin(ang), Math.cos(ang));
            if (Math.abs(norm) > s.halfRad) continue;
          }
          groups.add(s.kindGroup);
        }
        const covered = groups.size > 0;
        if (covered) coveredCount += 1;
        for (const g of groups) coveredByGroup[g] += 1;
        cellList.push({ x: col * cellW, y: row * cellH, covered, groups });
      }
    }
    const cellAreaFt = (cellW * currentFloorPxToFt) * (cellH * currentFloorPxToFt);
    const totalArea = cellList.length * cellAreaFt;
    return {
      cells: cellList,
      cellW,
      cellH,
      coveredCount,
      totalCount: cellList.length,
      coveragePct: cellList.length ? coveredCount / cellList.length : 0,
      totalAreaFt: totalArea,
      coveredAreaFt: coveredCount * cellAreaFt,
      gapAreaFt: (cellList.length - coveredCount) * cellAreaFt,
      areaByGroupFt: Object.fromEntries(Object.entries(coveredByGroup).map(([k, v]) => [k, v * cellAreaFt])) as Record<string, number>,
    };
  }, [devices, floorBackground, currentFloorPxToFt]);

  // setDevices facade: accepts either a new array OR an updater fn. Diffs
  // against the current store snapshot and dispatches add/update/remove for
  // each changed device. Keeps all in-component callers (move/rotate/dup/
  // delete/drag-drop) working with zero changes elsewhere.
  //
  // Canvas V2 Pass 1.2 — lock enforcement. Updates and deletes against
  // an id in `lockedIds` are filtered out before they reach the store;
  // a toast tells the operator how many items were skipped so the
  // refusal is never silent. Adds are always allowed (a freshly placed
  // device is not in lockedIds yet).
  const setDevices = useCallback((next: Device[] | ((prev: Device[]) => Device[])) => {
    const pid = projectId ?? 'p1';
    const fid = currentFloorId;
    const before = (Object.values(useProjectStore.getState().devices) as unknown as Device[])
      .filter((d: any) => d.projectId === pid && (fid === '' || d.floorId === fid));
    const after = typeof next === 'function' ? next(before) : next;
    const beforeIds = new Set(before.map((d) => d.id));
    const afterIds  = new Set(after.map((d) => d.id));
    let added    = after.filter((d) => !beforeIds.has(d.id));
    let removed  = before.filter((d) => !afterIds.has(d.id));
    let updated  = after.filter((d) => beforeIds.has(d.id) && before.find((p) => p.id === d.id) !== d);

    // ── Lock enforcement ──
    const lockedRef = lockedIdsRef.current;
    const removedLocked = removed.filter((d) => lockedRef.has(d.id));
    const updatedLocked = updated.filter((d) => lockedRef.has(d.id));
    if (removedLocked.length || updatedLocked.length) {
      removed = removed.filter((d) => !lockedRef.has(d.id));
      updated = updated.filter((d) => !lockedRef.has(d.id));
      const total = removedLocked.length + updatedLocked.length;
      toast.message(`${total} locked item${total === 1 ? '' : 's'} skipped`, {
        description: 'Unlock from the selection pill or the Layers panel to edit.',
        duration: 3500,
      });
    }
    if (!added.length && !removed.length && !updated.length) return;

    // Push history BEFORE mutating so the snapshot reflects "previous".
    // (The earlier early return already covered the no-op case.)
    {
      const nameOf = (d: Device) => (d as any).name || (d as any).label || (d as any).id;
      let label = 'Edited devices';
      let coalesceKey: string | undefined;
      if (removed.length === 1 && added.length === 0 && updated.length === 0) {
        label = `Deleted ${nameOf(removed[0])}`;
      } else if (removed.length > 1 && added.length === 0 && updated.length === 0) {
        label = `Deleted ${removed.length} devices`;
      } else if (added.length === 1 && removed.length === 0 && updated.length === 0) {
        label = `Added ${nameOf(added[0])}`;
      } else if (added.length > 1 && removed.length === 0 && updated.length === 0) {
        label = `Added ${added.length} devices`;
      } else if (updated.length === 1 && added.length === 0 && removed.length === 0) {
        const u = updated[0];
        const prev = before.find((p) => p.id === u.id)!;
        const movedXY = (u.x !== prev.x) || (u.y !== prev.y);
        const rotated = u.rot !== prev.rot;
        if (movedXY && !rotated) { label = `Moved ${nameOf(u)}`; coalesceKey = `move-${u.id}`; }
        else if (rotated && !movedXY) { label = `Rotated ${nameOf(u)}`; coalesceKey = `rotate-${u.id}`; }
        else { label = `Updated ${nameOf(u)}`; coalesceKey = `update-${u.id}`; }
      } else if (updated.length > 1 && added.length === 0 && removed.length === 0) {
        label = `Moved ${updated.length} devices`;
        coalesceKey = 'move-multi';
      }
      pushCanvasHistory(label, ['devices'], coalesceKey);
    }

    // Removals
    for (const d of removed) storeRemoveDevice(d.id);
    // Adds
    for (const d of added) {
      // Compatibility check on add: anything dropped onto the floorplan
      // that should be attached to a host (strike / maglock / rex) gets a
      // soft warning toast pointing the user to drag it onto a door. The
      // add still goes through — the user is the engineer and can
      // override — but the platform tells them so misconfigurations
      // don't sneak in.
      const compat = canHost('floor', d.type);
      if (!compat.allowed) {
        toast.warning(compat.reason ?? 'Compatibility issue', {
          description: compat.hint,
          duration: 6000,
        });
      } else if (compat.requires) {
        toast.message('Heads up', {
          description: compat.requires,
          duration: 5000,
        });
      }
      storeAddDevice({ ...(d as any), projectId: pid, floorId: fid } as StoreDevice);
    }
    // Updates
    for (const d of updated) {
      const prev = before.find((p) => p.id === d.id)!;
      const patch: any = {};
      for (const k of Object.keys(d)) {
        if ((d as any)[k] !== (prev as any)[k]) patch[k] = (d as any)[k];
      }
      if (Object.keys(patch).length) storeUpdateDevice(d.id, patch);
    }
  }, [projectId, currentFloorId, storeAddDevice, storeUpdateDevice, storeRemoveDevice, pushCanvasHistory]);
  // Canvas V2 Pass 1.1 — walls now live entirely in the store under
  // floors[id].walls. Local `walls` state used to hold session-only
  // segments; that meant they could not be undone and did not persist
  // across reloads. Routing everything through setFloorWalls gives us
  // both undo (via the floors slice snapshot) and persistence.
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [wallCursor, setWallCursor] = useState<{ x: number; y: number } | null>(null);

  // Canvas V2 Pass 2C.1 — room polygon draw state. Click vertices,
  // double click or Enter to close. Esc cancels.
  const [roomDraw, setRoomDraw] = useState<{ points: { x: number; y: number }[]; cursor: { x: number; y: number } | null }>({ points: [], cursor: null });
  const addRoom = useProjectStore((s) => s.addRoom);
  const removeRoom = useProjectStore((s) => s.removeRoom);
  const finishRoomDraw = useCallback(() => {
    setRoomDraw((prev) => {
      if (prev.points.length < 3) return { points: [], cursor: null };
      const pts = prev.points;
      if (!currentFloorId) { toast.error('Place a floor before drawing rooms.'); return { points: [], cursor: null }; }
      pushCanvasHistory('Drew room', ['rooms']);
      const id = `r-${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;
      addRoom({
        id,
        projectId: projectId ?? 'p1',
        floorId: currentFloorId,
        name: `Room ${Math.floor(Math.random() * 900) + 100}`,
        polygon: pts.slice(),
        sensitivity: 'low',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      toast.success('Room drawn');
      return { points: [], cursor: null };
    });
    setTool('select');
  }, [addRoom, projectId, currentFloorId, pushCanvasHistory]);
  const storeFloorWalls = useProjectStore((s) => (currentFloorId ? s.floors[currentFloorId]?.walls : undefined));
  const setFloorWalls = useProjectStore((s) => s.setFloorWalls);
  const allWalls = useMemo<Wall[]>(
    () => ((storeFloorWalls ?? []) as unknown as Wall[]),
    [storeFloorWalls],
  );

  // Canvas V2 Pass 2C.2 — auto detect rooms from walls. Defined here
  // (after allWalls) to avoid the TDZ error from the earlier ref
  // declaration. The ref is what callers grab so the keyboard handler
  // and Cmd K command can fire the latest closure without re binding.
  const detectRoomsFromWalls = useCallback(() => {
    if (!currentFloorId) return;
    const wallList = (allWalls ?? []) as Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>;
    if (wallList.length < 4) {
      toast.error('Need at least four walls on this floor to look for closed rooms.');
      return;
    }
    const SNAP = 4;
    const key = (x: number, y: number) => `${Math.round(x / SNAP) * SNAP},${Math.round(y / SNAP) * SNAP}`;
    type Edge = { a: string; b: string; horizontal: boolean; vertical: boolean; minX: number; maxX: number; minY: number; maxY: number };
    const edges: Edge[] = wallList.map((w) => ({
      a: key(w.x1, w.y1), b: key(w.x2, w.y2),
      horizontal: Math.abs(w.y1 - w.y2) < 2,
      vertical: Math.abs(w.x1 - w.x2) < 2,
      minX: Math.min(w.x1, w.x2), maxX: Math.max(w.x1, w.x2),
      minY: Math.min(w.y1, w.y2), maxY: Math.max(w.y1, w.y2),
    }));
    const hWalls = edges.filter((e) => e.horizontal);
    const vWalls = edges.filter((e) => e.vertical);
    type Candidate = { id: string; polygon: { x: number; y: number }[] };
    const candidates: Candidate[] = [];
    const seenKeys = new Set<string>();
    for (let i = 0; i < hWalls.length; i += 1) {
      for (let j = i + 1; j < hWalls.length; j += 1) {
        const h1 = hWalls[i]; const h2 = hWalls[j];
        const y1 = (h1.minY + h1.maxY) / 2;
        const y2 = (h2.minY + h2.maxY) / 2;
        if (Math.abs(y1 - y2) < 20) continue;
        const top = y1 < y2 ? h1 : h2;
        const bot = y1 < y2 ? h2 : h1;
        const overlapL = Math.max(top.minX, bot.minX);
        const overlapR = Math.min(top.maxX, bot.maxX);
        if (overlapR - overlapL < 20) continue;
        const left = vWalls.find((v) => Math.abs(((v.minX + v.maxX) / 2) - overlapL) < 8 && v.minY <= Math.min(top.minY, top.maxY) + 4 && v.maxY >= Math.max(bot.minY, bot.maxY) - 4);
        const right = vWalls.find((v) => Math.abs(((v.minX + v.maxX) / 2) - overlapR) < 8 && v.minY <= Math.min(top.minY, top.maxY) + 4 && v.maxY >= Math.max(bot.minY, bot.maxY) - 4);
        if (!left || !right) continue;
        const polygon = [
          { x: overlapL, y: y1 < y2 ? y1 : y2 },
          { x: overlapR, y: y1 < y2 ? y1 : y2 },
          { x: overlapR, y: y1 < y2 ? y2 : y1 },
          { x: overlapL, y: y1 < y2 ? y2 : y1 },
        ];
        const sig = `${Math.round(overlapL)}-${Math.round(overlapR)}-${Math.round(Math.min(y1, y2))}-${Math.round(Math.max(y1, y2))}`;
        if (seenKeys.has(sig)) continue;
        seenKeys.add(sig);
        candidates.push({ id: sig, polygon });
      }
    }
    if (candidates.length === 0) {
      toast.error('No closed rectangles detected. Try drawing rooms by hand with the Room tool.');
      return;
    }
    pushCanvasHistory(`Detected ${candidates.length} rooms`, ['rooms']);
    let nextNum = currentFloorRooms.length + 1;
    for (const c of candidates) {
      const id = `r-${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;
      addRoom({
        id,
        projectId: projectId ?? 'p1',
        floorId: currentFloorId,
        name: `Room ${100 + nextNum}`,
        polygon: c.polygon,
        sensitivity: 'low',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      nextNum += 1;
    }
    toast.success(`Detected ${candidates.length} room${candidates.length === 1 ? '' : 's'}. Edit names + sensitivity from the inspector.`);
  }, [allWalls, currentFloorId, projectId, addRoom, pushCanvasHistory, currentFloorRooms.length]);
  useEffect(() => { detectRoomsFromWallsRef.current = detectRoomsFromWalls; }, [detectRoomsFromWalls]);

  // Measure tool — two-click distance measurement. First click sets a
  // start point; second click freezes the measurement. ESC clears.
  const [measure, setMeasure] = useState<{
    start: { x: number; y: number } | null;
    end:   { x: number; y: number } | null;
    cursor:{ x: number; y: number } | null;
  }>({ start: null, end: null, cursor: null });

  // Scale-calibration tool state. The user picks two points (A → B); the
  // distance in pixels between them becomes the reference for converting
  // a known real-world feet input into the floor's `scalePxToFt`. When
  // `tool === 'calibrate'` and both points are set, the
  // CalibrationApplyPanel surfaces an input + Apply CTA.
  const [calibrate, setCalibrate] = useState<{
    a: { x: number; y: number } | null;
    b: { x: number; y: number } | null;
    cursor: { x: number; y: number } | null;
  }>({ a: null, b: null, cursor: null });
  // Text the user typed into the Apply panel — kept here so reset paths
  // (Esc, right-click, Cancel button) can clear it in one place.
  const [calibrateFt, setCalibrateFt] = useState<string>('');
  // Reset everything that the in-canvas calibration flow touches. Used by
  // Esc/right-click/Cancel/Apply paths so a future tool selection starts
  // clean — including dropping back to the Select tool.
  const resetCalibrate = useCallback(() => {
    setCalibrate({ a: null, b: null, cursor: null });
    setCalibrateFt('');
  }, []);
  /** Commit the in-canvas calibration to the active floor:
   *  `scalePxToFt = realFt / pxMeasured`, plus `calibratedAt`,
   *  `calibrationReferenceFt`, `calibrationMeasuredPx` so the
   *  scale-bar's "Verified" state and the /calibrate route's recalibrate
   *  flow can both read the same metadata. Triggers a toast and flips
   *  the active tool back to Select. The tiny modal calls into this. */
  const applyCalibration = useCallback((realFt: number) => {
    if (!calibrate.a || !calibrate.b || !currentFloorId) return;
    const dx = calibrate.b.x - calibrate.a.x;
    const dy = calibrate.b.y - calibrate.a.y;
    const pxMeasured = Math.hypot(dx, dy);
    if (pxMeasured < 1 || !(realFt > 0)) return;
    const ftPerPx = realFt / pxMeasured;
    // Snapshot floors for undo. Calibration updates Floor.scalePxToFt
    // plus the verification metadata; restoring the floors slice
    // reverses all four fields in one step.
    pushCanvasHistory('Recalibrated scale', ['floors']);
    useProjectStore.getState().updateFloor(currentFloorId, {
      scalePxToFt: ftPerPx,
      calibratedAt: Date.now(),
      calibrationReferenceFt: realFt,
      calibrationMeasuredPx: pxMeasured,
    } as any);
    toast.success('Scale verified', {
      description: `${realFt.toFixed(realFt < 10 ? 2 : 1)} ft across ${Math.round(pxMeasured)} px → 1 ft = ${(1 / ftPerPx).toFixed(1)} px`,
      duration: 4500,
    });
    resetCalibrate();
    setTool('select');
  }, [calibrate.a, calibrate.b, currentFloorId, resetCalibrate, pushCanvasHistory]);

  // Cable / pathway draw — click vertices, double-click or Enter to
  // finish, Esc to cancel. On finish, a Pathway record is added to the
  // store with computed length (in feet, via the same 20px/ft scale the
  // estimator uses). The pathway then appears in /pathways/:id and is
  // counted in the BOM.
  const [cableDraw, setCableDraw] = useState<{
    points: { x: number; y: number }[];
    cursor: { x: number; y: number } | null;
    cableType: CableTypeId;
  }>({ points: [], cursor: null, cableType: 'cat6a' });
  const addPathway = useProjectStore((s) => s.addPathway);
  const removePathway = useProjectStore((s) => s.removePathway);
  /** Commit the current cable draw to the store as a Pathway record. */
  /** Dedicated draw-mode metadata for the current tool. When the user
   *  picks "1-1/4 EMT" in the Conduit tray, drawModeRef holds
   *  `{ kind: 'conduit', conduitType: 'EMT', conduitSize: '1-1/4"' }` so
   *  the cable-tool commit handler can write the right fields onto the
   *  new pathway. Picks from the Cable section reset this to `{ kind:
   *  'cable' }` and the chosen cable type lives in cableDraw.cableType. */
  const drawModeRef = useRef<{
    kind: 'cable' | 'conduit' | 'pathway';
    pathwayKind?: 'conduit' | 'tray' | 'jhook' | 'sleeve' | 'raceway' | 'duct';
    conduitType?: 'EMT' | 'PVC' | 'FMC' | 'LFMC' | 'raceway' | 'tray';
    conduitSize?: string;
  }>({ kind: 'cable' });
  // Mirror cableDraw into a ref so finishCableDraw can read the latest
  // value WITHOUT having to live inside `setCableDraw((prev) => ...)`.
  // The ref-based read lets us run the side-effecting work (addPathway,
  // setTool, toast) *outside* React's setState updater. React executes
  // updaters synchronously during render-scheduling, and Zustand's
  // `addPathway` synchronously notifies every subscriber — including
  // `PathwaysOverlay` — which is what triggered the
  // "Cannot update a component (PathwaysOverlay) while rendering
  // EngineeringCanvas" warning every time the cable / conduit draw
  // finished. The setState in `setCableDraw` below is then a pure
  // reset; no side effects inside its updater.
  const cableDrawRef = useRef(cableDraw);
  useEffect(() => { cableDrawRef.current = cableDraw; }, [cableDraw]);
  const finishCableDraw = useCallback(() => {
    const prev = cableDrawRef.current;
    if (prev.points.length < 2) {
      setCableDraw({ points: [], cursor: null, cableType: prev.cableType });
      return;
    }
    const mode = drawModeRef.current;
    const prefix = mode.kind === 'conduit' ? 'CD' : mode.kind === 'pathway' ? 'PT' : 'PW';
    const id = `${prefix}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    // Length: derive from points + the floor's calibrated scale via the
    // shared pathwayLengthFt helper so the BOM, canvas labels, and inspector
    // drawer all agree.
    // Canvas V2 Pass 2A.4 — anchor the new pathway to the ACTIVE
    // floor (the operator's current view), not the project's first
    // floor. Falls back to first floor when the sticky is missing.
    const _state = useProjectStore.getState();
    const _activeId = _state.currentFloorIdByProject[projectId];
    const _floor = (_activeId ? (_state.floors as any)[_activeId] : null)
      ?? storeSelectors.firstFloorOfProject(_state, projectId);
    const lengthFt = pathwayLengthFt({ points: prev.points }, _floor);
    const fid = _floor?.id ?? '';
    const isConduit = mode.kind === 'conduit';
    const isPathway = mode.kind === 'pathway';
    // Reset local draw state FIRST — pure state update, no side effects.
    setCableDraw({ points: [], cursor: null, cableType: prev.cableType });
    // Side effects (store write + toast + tool switch) run AFTER the
    // setState call, fully outside React's render path.
    // Snapshot the pathways slice for undo before the add lands.
    pushCanvasHistory(`Drew ${isConduit ? 'conduit' : isPathway ? 'pathway' : 'cable run'}`, ['pathways']);
    addPathway({
      id,
      projectId,
      floorId: fid || (_floor?.id ?? ''),
      type: isConduit ? 'conduit' : isPathway ? 'open' : 'conduit',
      cableType: prev.cableType,
      cableCount: 1,
      points: prev.points,
      lengthFt,
      // Dedicated-mode metadata so PathwaysOverlay + PathwayDrawer can
      // tell standalone conduits / J-hooks / trays from cable runs.
      ...(isConduit ? { pathwayKind: 'conduit', conduitType: mode.conduitType, conduitSize: mode.conduitSize } : {}),
      ...(isPathway ? { pathwayKind: mode.pathwayKind ?? 'tray' } : {}),
    } as any);
    // Reset the draw-mode back to cable so the next click on the
    // cable tool draws cable, not another conduit.
    drawModeRef.current = { kind: 'cable' };
    // Drop the user back to Select after a draw commits so they're not
    // stuck in a draw mode they didn't realise was still active.
    setTool('select');
    toast.success(`${isConduit ? 'Conduit' : isPathway ? 'Pathway' : 'Cable'} ${id} drawn`, {
      description: `${lengthFt} ft · saved. Click the route to edit.`,
      duration: 3500,
    });
  }, [addPathway, projectId]);
  const [selId, setSelId] = useState<string | null>(null);
  // Pass C — required pixel density row in the camera drawer drives a
  // shared emphasis state. When the user picks a DORI level tile, the
  // cone on the canvas dims the other bands so the active grade reads
  // clearly. Reset every time the selected camera changes so emphasis
  // never bleeds across cameras.
  const [selectedDoriLevel, setSelectedDoriLevel] = useState<DoriLevel | null>(null);
  useEffect(() => { setSelectedDoriLevel(null); }, [selId]);
  // M9 — when the selected device is a multisensor, default activeLens
  // to 'a' so the per-lens handles attach immediately (rather than
  // requiring the operator to click a chip first). On a non-multisensor
  // selection we reset to 'all' so coverage rendering doesn't carry
  // over a stale per-lens dim state from the previous selection. The
  // chip row in the drawer keeps full control after this default.
  useEffect(() => {
    if (!selId) return;
    const sel = useProjectStore.getState().devices[selId];
    if (!sel) return;
    if (sel.type === 'cam.multisensor') {
      // Only seed if the user hasn't picked a specific lens already.
      if (activeLens === 'all') setActiveLens('a');
    } else {
      // Coming from a multisensor onto a non-multisensor — clear the
      // per-lens highlight so single-lens coverage reads normally.
      if (activeLens !== 'all') setActiveLens('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);
  // Person probe — canvas-world position of the draggable face marker
  // tied to the selected camera. Drives both the on-canvas marker and
  // the drawer's live density preview. Cleared when the selected
  // camera changes; the seed effect below re-anchors it at ~60% along
  // the new camera's aim ray (sensible spot inside the cone).
  const [personProbePos, setPersonProbePos] = useState<{ x: number; y: number } | null>(null);
  // Seed the probe at ~60% along the new selection's aim ray when a
  // single-lens camera becomes selected. Honesty gates (resolution
  // missing / pxToFt 0 / multi sensor / fisheye) are handled in the
  // probe components themselves; here we always seed a position so
  // the marker has a sensible home when the operator opens Coverage.
  useEffect(() => {
    if (!selId) { setPersonProbePos(null); return; }
    const dev = (Object.values(useProjectStore.getState().devices) as Device[]).find((x) => x.id === selId);
    if (!dev) { setPersonProbePos(null); return; }
    const kind = TYPE_KIND[dev.type];
    const isProbeCam = kind === 'camera' && dev.type !== 'cam.multisensor' && dev.type !== 'cam.fisheye';
    if (!isProbeCam) { setPersonProbePos(null); return; }
    const devFloor = useProjectStore.getState().floors[dev.floorId];
    const ftPerPx = ftPerPxForFloor(devFloor);
    if (!ftPerPx || ftPerPx <= 0) { setPersonProbePos(null); return; }
    const rangeFt = dev.range ?? (dev.type === 'cam.ptz' ? 44 : dev.type === 'cam.bullet' ? 50 : 30);
    // Audit Group A.3 — seed at 60% along the aim ray. The earlier
    // 35% seed (Item 4) tried to keep the marker on-screen when the
    // drawer opens, but it parked the avatar inside the device's own
    // label pill — the magenta avatar pill (1.7r halo + crosshair)
    // visually overlapped the device id and mfr / model caption. 60%
    // pushes the default position clearly into the middle of the
    // cone so the operator sees the probe is at a real, measurable
    // distance from the device — and the drawer auto-clamps the
    // canvas viewport on open, so off-screen risk is handled there
    // instead of by parking the marker close.
    const reachPx = Math.round((rangeFt / ftPerPx) * 0.60);
    const rotRad = ((dev.rot ?? 0) * Math.PI) / 180;
    setPersonProbePos({
      x: dev.x + Math.cos(rotRad) * reachPx,
      y: dev.y + Math.sin(rotRad) * reachPx,
    });
  }, [selId]);
  // V1 2A.3 — honor ?focus=<deviceId> from the URL so an assistant
  // citation chip that links here actually selects the device. Only
  // applies on first arrival; clearing the param prevents re-firing.
  // V1 2B.5 — also honor ?hint=<kind>&at=<x,y>&label=<text> from the
  // Threat Simulator's "Harden on canvas" buttons. Drives the
  // hardenHint overlay rendered alongside the canvas surface.
  const [hardenHint, setHardenHint] = useState<{ kind: string; at: { x: number; y: number }; label: string } | null>(null);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const focus = sp.get('focus');
      if (focus) {
        setSelId(focus);
        sp.delete('focus');
      }
      const hintKind = sp.get('hint');
      const at = sp.get('at');
      const label = sp.get('label');
      if (hintKind && at) {
        const [xs, ys] = at.split(',').map((n) => Number(n));
        if (!Number.isNaN(xs) && !Number.isNaN(ys)) {
          setHardenHint({ kind: hintKind, at: { x: xs, y: ys }, label: label ?? `Drop a ${hintKind} here.` });
        }
        sp.delete('hint');
        sp.delete('at');
        sp.delete('label');
        sp.delete('fromScenario');
      }
      const newSearch = sp.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`);
    } catch { /* no-op */ }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // V1 2B.5 — auto-clear the hint when the operator drops a device.
  // We snapshot the count at hint set; any increase clears.
  const devicesAtHintRef = useRef<number | null>(null);
  useEffect(() => {
    if (hardenHint) {
      devicesAtHintRef.current = Object.keys(storeDevices).length;
    } else {
      devicesAtHintRef.current = null;
    }
  }, [hardenHint, storeDevices]);
  useEffect(() => {
    if (hardenHint && devicesAtHintRef.current != null && Object.keys(storeDevices).length > devicesAtHintRef.current) {
      setHardenHint(null);
    }
  }, [storeDevices, hardenHint]);
  // V1 2A.2 — broadcast canvas context to the AI Assistant. Fires
  // when project / site / floor / selection changes; the Assistant
  // picks this up implicitly so a question asked from a selected
  // camera narrows automatically.
  const setAssistantContext = useProjectStore((s) => s.setAssistantContext);
  const currentFloorName = useProjectStore((s) => currentFloorId ? s.floors[currentFloorId]?.name : undefined);
  // Derive site for this project (canvas always shows one site today).
  const projectSite = useProjectStore((s) => Object.values(s.sites).find((x) => x.projectId === projectId));
  useEffect(() => {
    const selDevice = selId
      ? (Object.values(useProjectStore.getState().devices) as any[]).find((d) => d.id === selId) as Device | undefined
      : undefined;
    setAssistantContext({
      surface: 'canvas',
      projectId,
      siteId: projectSite?.id,
      siteName: projectSite?.name,
      floorId: currentFloorId || undefined,
      floorName: currentFloorName,
      selectionKind: selDevice ? 'device' : undefined,
      selectionId: selDevice?.id,
      selectionLabel: selDevice ? `${selDevice.label || selDevice.id}` : undefined,
    });
  }, [setAssistantContext, projectId, projectSite?.id, projectSite?.name, currentFloorId, currentFloorName, selId]);
  const [zoom, setZoom] = useState(1);
  /** Pan offset applied to the entire canvas content group, in pixels.
   *  The Fit / Center / Actual-scale buttons compute zoom + pan together
   *  so the floorplan visually dominates the workspace instead of sitting
   *  pinned at (80,80). Updated by the auto-fit effect on mount + on
   *  background change + on viewport resize, and by user drag-to-pan. */
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [floor, setFloor] = useState(0);
  const [snap, setSnap] = useState(true);
  const [units, setUnits] = useState<'ft' | 'm'>('ft');
  const [coverageMode, setCoverageMode] = useState<CoverageMode>('soft');
  // Intelligence chips and immersion overlays default OFF — the canvas
  // is calm until the engineer asks for more. Click the top-right
  // "Intelligence" pill to surface flagged issues.
  const [intelOpen, setIntelOpen] = useState(false);
  // View mode — three serious survey modes:
  //   default → full chrome (TopBar + LeftNavRail + InsertDock)
  //   field   → hides rails so the canvas is the hero; slim TopBar stays
  //   canvas  → maximises the plotting surface; only floating tools + an
  //             Exit chip remain. Escape exits.
  // The user spec demands canvas occupies ~75–85% of available screen on
  // default and approaches full viewport in Field / Canvas modes.
  const [viewMode, setViewMode] = useState<'default' | 'field' | 'canvas'>('default');
  const focusMode = viewMode === 'canvas';
  // Insert dock can be collapsed to a 48px icon rail at any time so the
  // device library never blocks the plan. Collapsed by default so the
  // canvas owns the screen on first load — engineers click the floating
  // Add FAB (or any dock icon) to pull the library back in. Their last
  // choice persists across sessions.
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('canvas:dock:collapsed');
      // null = first visit → collapsed default; explicit '0' = user has
      // pinned the dock open and wants it that way next time.
      return raw === null ? true : raw === '1';
    } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('canvas:dock:collapsed', dockCollapsed ? '1' : '0'); } catch {}
  }, [dockCollapsed]);
  // Scan / Build Floorplan modal — the obvious entry point to capture or
  // generate a floor surface (scan with camera, upload, satellite trace,
  // or sketch from scratch).
  const [scanBuildOpen, setScanBuildOpen] = useState(false);
  // Upload modal — "Add plan → Upload" flow triggered directly from
  // the TopBar without forcing the user through the section nav.
  const [canvasImportOpen, setCanvasImportOpen] = useState(false);
  // Project BOM drawer — right-side, opened from the TopBar BOM &
  // Estimate button. Renders per-source rows derived live from the
  // canvas so the user can audit and CSV-export their proposed
  // material + existing-documented split without leaving the floor
  // plan.
  const [canvasBomOpen, setCanvasBomOpen] = useState(false);
  // Report Builder modal — the new "real builder" entry; replaces the
  // scattered list of export rows as the primary report flow.
  const [reportOpen, setReportOpen] = useState(false);
  // Fullscreen mode — uses the Fullscreen API to expand the canvas to fill
  // the entire monitor. Distinct from viewMode (which is an in-app immersion
  // toggle that hides chrome but stays inside the window). The two compose:
  // hitting Fullscreen also flips on Canvas mode so the user gets a true
  // floorplan-only experience. Escape exits cleanly.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const enterFullscreen = useCallback(async () => {
    const el = rootRef.current as any;
    if (!el) return;
    try {
      if (el.requestFullscreen)            await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen)     await el.msRequestFullscreen();
      setViewMode('canvas');
    } catch {
      // Some browsers throw if a previous request hasn't finished. Treat
      // the failure as a no-op; Canvas view still gives an immersive view.
      setViewMode('canvas');
    }
  }, []);
  const exitFullscreen = useCallback(async () => {
    try {
      const doc = document as any;
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (doc.webkitFullscreenElement) await doc.webkitExitFullscreen();
      else if (doc.msFullscreenElement)     await doc.msExitFullscreen();
    } catch { /* noop */ }
    setViewMode('default');
  }, []);
  useEffect(() => {
    const handler = () => {
      const fs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).msFullscreenElement);
      setIsFullscreen(fs);
      if (!fs && viewMode === 'canvas') setViewMode('default');
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler as any);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Canvas engineering layers — toggleable overlays. Pulled from the
  // store so they persist per project. Replaces the previous ad-hoc
  // densityMode boolean with a coherent layer system.
  const canvasLayersMap = useProjectStore((s) => s.canvasLayers);
  const setCanvasLayer  = useProjectStore((s) => s.setCanvasLayer);
  const layers: CanvasLayerState = useMemo(
    () => ({ ...DEFAULT_CANVAS_LAYERS, ...canvasLayersMap[projectId] }),
    [canvasLayersMap, projectId],
  );

  // Canvas display preferences — icon size, label density, coverage
  // opacity, base map. Persistent per project. Replaces the previous
  // local `planSource` state with a fuller, store-driven model.
  const canvasDisplayMap = useProjectStore((s) => s.canvasDisplay);
  const setCanvasDisplay = useProjectStore((s) => s.setCanvasDisplay);
  const display: CanvasDisplayPrefs = useMemo(
    () => ({ ...DEFAULT_DISPLAY_PREFS, ...canvasDisplayMap[projectId] }),
    [canvasDisplayMap, projectId],
  );
  // The full base-map mode flows through to FloorPlan unchanged now —
  // every value renders a distinct surface so the picker is honest.
  const planSource: BaseMapMode = display.baseMap;
  const setPlanSource = (m: BaseMapMode) => setCanvasDisplay(projectId, { baseMap: m });

  // Project tech model — filters which manufacturers the library / drawer
  // suggests. Surfaced in the TopBar as a 3-way segmented control.
  const projectTechModelsMap = useProjectStore((s) => s.projectTechModels);
  const setProjectTechModel  = useProjectStore((s) => s.setProjectTechModel);
  const techModel = projectTechModelsMap[projectId] ?? 'hybrid';

  // Cross-component lens hover. When the user hovers a lens chip in the
  // SelectionPill, that lens id flows here and out to the canvas so the
  // corresponding cone subtly highlights. Reads as "this chip controls
  // that cone" without any explicit instruction.
  const [hoveredLens, setHoveredLens] = useState<LensId | null>(null);

  // ── Drag physics ────────────────────────────────────────────────
  // Real spring-mass-damper, not CSS easing. The store position (d.x /
  // d.y) tracks the *cursor target* — updated synchronously by the
  // pointer move handler (with magnetic snap applied). The display
  // position `dragLag` lerps toward the target via a spring loop. The
  // device, its cones, and its selection pill ALL render from the
  // lagged position so the experience reads as one piece of physical
  // matter responding to a magnet, not a sprite teleporting to the
  // cursor.
  //
  // dragLag is null when nothing is being dragged. When non-null,
  // either the user is still holding the pointer down (isDraggingRef
  // = true) or we're in the post-release settle phase (RAF continues
  // until velocity and distance both fall below threshold).
  const [dragLag, setDragLag] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragLagRef    = useRef<{ id: string; x: number; y: number } | null>(null);
  const dragVelRef    = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const rafRef        = useRef<number | null>(null);
  // devicesRef so the physics loop can read the latest cursor target
  // without re-creating the loop callback on every device update.
  const devicesRef    = useRef<Device[]>([]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  const stepPhysics = useCallback(() => {
    const lag = dragLagRef.current;
    if (!lag) { rafRef.current = null; return; }
    const dev = devicesRef.current.find((d) => d.id === lag.id);
    if (!dev) {
      dragLagRef.current = null;
      setDragLag(null);
      rafRef.current = null;
      return;
    }
    // Spring toward the cursor target. Tuned for "carrying a small
    // brick" — heavy enough to feel weight, light enough that it
    // never feels sluggish. Damping bumped from 0.74 → 0.79 in this
    // pass for a cleaner release feel; the device settles instead of
    // ringing briefly around the target.
    const k = 0.30;
    const damping = 0.79;
    const dx = dev.x - lag.x;
    const dy = dev.y - lag.y;
    const vel = dragVelRef.current;
    vel.x = (vel.x + dx * k) * damping;
    vel.y = (vel.y + dy * k) * damping;
    lag.x += vel.x;
    lag.y += vel.y;
    // Mirror the new position to React state so subscribers re-render.
    setDragLag({ id: lag.id, x: lag.x, y: lag.y });
    // Settle: pointer released AND essentially still AND essentially
    // on-target. Slight tolerance avoids endless infinitesimal motion.
    if (!isDraggingRef.current) {
      const speed2 = vel.x * vel.x + vel.y * vel.y;
      const dist2  = dx * dx + dy * dy;
      if (speed2 < 0.04 && dist2 < 0.20) {
        dragLagRef.current = null;
        dragVelRef.current = { x: 0, y: 0 };
        setDragLag(null);
        rafRef.current = null;
        return;
      }
    }
    rafRef.current = requestAnimationFrame(stepPhysics);
  }, []);

  /** Called from CanvasSurface when a device drag begins.
   *  The spring-lag pass was removed — surveyors found the bounce
   *  imprecise for plotting. The device now renders directly from
   *  its store position (updated synchronously by pointermove), so
   *  the glyph tracks the cursor 1:1 with no settle. dragLag stays
   *  null forever; the existing render code falls through to the
   *  un-lagged path. We still track isDraggingRef for any consumer
   *  that wants to know "is something being dragged right now". */
  const onDragStart = useCallback((_id: string, _x: number, _y: number) => {
    isDraggingRef.current = true;
  }, []);
  const onDragEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);
  // The physics loop is dead code now; keep stepPhysics declared so the
  // identifier is satisfied but never schedule it.
  void stepPhysics;

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const [editOpen, setEditOpen] = useState(false);
  /* Audit Group C.6 — drawer compact vs expanded state. Compact (false,
     default) shows just the identity strip + tab icons in a thin bar
     above the tray; expanded (true) grows the drawer upward into a
     56 vh panel revealing the full inspector body. Toggled by the
     chevron in the docked drawer header. */
  const [editExpanded, setEditExpanded] = useState(false);
  const [editTab, setEditTab] = useState<EditTab>('overview');
  // DEFECT FIX (2026-05-24): the stick-figure / TargetSimOverlay was a
  // dead control — it auto-placed itself when the Coverage tab opened
  // but didn't drive anything the user could action, and the honest
  // DORI bands shipped in V3 Pass 2 Part 2 cover the same coverage
  // intent properly. Removed the state, the auto-placement effect, and
  // the render. TargetSimOverlay's component definition stays in the
  // file for the next iteration (a real subject preview) but no code
  // path invokes it.
  /** Which lens (or 'all') the user is currently editing on the selected
   *  multisensor. Persisted as UI state per session — not on the device, so
   *  switching cameras keeps the user's last-used lens focus. */
  const [activeLens, setActiveLens] = useState<ActiveLens>('all');
  /** Per-multisensor linked/independent rotation mode. Read from the selected
   *  device (defaults to 'linked'); writes through to the device so each
   *  multisensor can have its own setting. */
  const setLensModeForSel = (m: LensMode) => sel && setDevices((ds) => ds.map((d) => d.id === sel.id ? { ...d, lensMode: m } : d));

  // Left navigation rail
  const [navSection, setNavSection] = useState<'overview' | 'devices' | 'recording' | 'accessories' | 'other' | 'maps' | 'reports' | 'docs'>('devices');

  // Insert dock — start at the category grid so user sees all 9 categories first
  const [openCat, setOpenCat] = useState<DeviceKind | null>(null);
  const [openType, setOpenType] = useState<DeviceType | null>(null);
  const [mfrFilter, setMfrFilter] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');
  // Top-level group filter — Physical security / Infrastructure / IT / AV /
  // Environmental / Power. Null = show all. Drives the category list in the
  // InsertDock so engineers can move at the right level of abstraction.
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // Drag from library
  const [drag, setDrag] = useState<{ product: Product; x: number; y: number } | null>(null);
  // Immutable starting client coordinates for the drag-vs-click distance
  // check. `drag.x / drag.y` are mutated on every pointermove (so the
  // floating ghost icon tracks the cursor), which means the pointerup
  // handler can't use them to detect "didn't move." This ref records
  // where the pointer landed at pointerdown and is never written
  // anywhere else.
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  // M6 — while an HTML5 drag is in flight the browser is rendering its
  // own native ghost. The legacy React ghost div suppresses itself
  // while this is true so two ghosts don't race. Set on dragstart from
  // any tray callsite, cleared by the document-level dragend listener
  // below.
  const [htmlDragInFlight, setHtmlDragInFlight] = useState(false);
  useEffect(() => {
    // dragstart on any element bubbles up to document. Filter to OUR
    // drags (anything carrying our MIME). The ghost-suppression flag
    // flips on at the start of a tray drag and clears at dragend.
    const onStart = (e: DragEvent) => {
      const types = e.dataTransfer?.types;
      if (types && Array.from(types).includes('application/dv-product')) {
        setHtmlDragInFlight(true);
      }
    };
    const onEnd = () => setHtmlDragInFlight(false);
    document.addEventListener('dragstart', onStart);
    document.addEventListener('dragend', onEnd);
    return () => {
      document.removeEventListener('dragstart', onStart);
      document.removeEventListener('dragend', onEnd);
    };
  }, []);
  // Click-to-arm placement: if the user releases a product card without
  // actually dragging onto the canvas, we treat the action as "arm
  // placement" — the next surface click on the canvas places the device
  // at that point. Avoids the old bug where pointerup-without-move
  // placed the device wherever the cursor was (often inside the tray).
  const [armedProduct, setArmedProduct] = useState<Product | null>(null);

  // Layers panel
  const [layersOpen, setLayersOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    try { const raw = localStorage.getItem(`canvas:${projectId}:hidden`); return new Set(raw ? JSON.parse(raw) : []); } catch { return new Set(); }
  });
  const [lockedIds, setLockedIds] = useState<Set<string>>(() => {
    try { const raw = localStorage.getItem(`canvas:${projectId}:locked`); return new Set(raw ? JSON.parse(raw) : []); } catch { return new Set(); }
  });
  const [selIds, setSelIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try { localStorage.setItem(`canvas:${projectId}:hidden`, JSON.stringify([...hiddenIds])); } catch {}
  }, [hiddenIds, projectId]);
  // Ref mirror so the keyboard handler (bound once) sees live values
  // without re-binding on every state change. Pairs with lockedIdsRef.
  const hiddenIdsRef = useRef<Set<string>>(hiddenIds);
  useEffect(() => { hiddenIdsRef.current = hiddenIds; }, [hiddenIds]);
  useEffect(() => {
    try { localStorage.setItem(`canvas:${projectId}:locked`, JSON.stringify([...lockedIds])); } catch {}
  }, [lockedIds, projectId]);
  // Sync the ref declared earlier (next to the setDevices facade) so
  // lock enforcement reads the live set at mutation time.
  useEffect(() => { lockedIdsRef.current = lockedIds; }, [lockedIds]);

  const surfaceRef = useRef<SVGSVGElement>(null);
  /** Compute zoom + pan that fits the active floorplan into the visible
   *  surface with comfortable padding. Used by the Fit button, the
   *  auto-fit effect on first mount + viewport resize + background swap.
   *  Plan extents default to the seed building (80,80 → 720,560 → 640×480)
   *  unless an imported floor background overrides the bounds. V1 P0.7
   *  also unions in any devices + walls that sit outside the background
   *  rectangle so a device dragged into the gutter is still in view, and
   *  pads more aggressively for breathing room. */
  const computeFit = useCallback((): { zoom: number; pan: { x: number; y: number } } | null => {
    const surf = surfaceRef.current;
    if (!surf) return null;
    const r = surf.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return null;
    // Floor extents in plan coordinates.
    let minX = 80, minY = 80, maxX = 720, maxY = 560;
    if (floorBackground) {
      minX = floorBackground.x;
      minY = floorBackground.y;
      maxX = floorBackground.x + floorBackground.naturalWidth * floorBackground.scale;
      maxY = floorBackground.y + floorBackground.naturalHeight * floorBackground.scale;
    }
    // Union devices + walls so the fit always includes anything the user
    // actually placed. Margin per device so glyphs don't kiss the edge.
    const DEV_MARGIN = 36;
    for (const d of devices) {
      if (typeof d.x !== 'number' || typeof d.y !== 'number') continue;
      if (d.x - DEV_MARGIN < minX) minX = d.x - DEV_MARGIN;
      if (d.y - DEV_MARGIN < minY) minY = d.y - DEV_MARGIN;
      if (d.x + DEV_MARGIN > maxX) maxX = d.x + DEV_MARGIN;
      if (d.y + DEV_MARGIN > maxY) maxY = d.y + DEV_MARGIN;
    }
    for (const w of allWalls) {
      const wxL = Math.min(w.x1, w.x2), wxR = Math.max(w.x1, w.x2);
      const wyT = Math.min(w.y1, w.y2), wyB = Math.max(w.y1, w.y2);
      if (wxL < minX) minX = wxL;
      if (wyT < minY) minY = wyT;
      if (wxR > maxX) maxX = wxR;
      if (wyB > maxY) maxY = wyB;
    }
    const planW = maxX - minX;
    const planH = maxY - minY;
    if (planW <= 0 || planH <= 0) return null;
    // P0.7: padding bumped 64 → 96 so the plan breathes inside the
    // viewport instead of crashing into the chrome.
    const padding = 96;
    const zx = (r.width  - padding * 2) / planW;
    const zy = (r.height - padding * 2) / planH;
    const z  = Math.max(0.25, Math.min(4, Math.min(zx, zy)));
    // Pan so the plan center lands at the viewport center, accounting for
    // the SVG group's `translate(pan) scale(zoom)` order.
    const px = (r.width  / 2) - (minX + planW / 2) * z;
    const py = (r.height / 2) - (minY + planH / 2) * z;
    return { zoom: z, pan: { x: px, y: py } };
  }, [floorBackground, devices, allWalls]);
  const applyFit = useCallback(() => {
    const fit = computeFit();
    if (!fit) return;
    setZoom(fit.zoom);
    setPan(fit.pan);
  }, [computeFit]);
  const applyActualScale = useCallback(() => {
    // 1 in = 10 ft is the canvas default; "actual scale" = 1:1 plan pixels.
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);
  // Canvas V2 Pass 1.9 — pan the canvas so a specific point sits at
  // viewport centre. Used by Cmd-K search result clicks. Does not
  // change zoom so the user keeps their working magnification.
  const centerOnPoint = useCallback((x: number, y: number) => {
    const surf = surfaceRef.current;
    if (!surf) return;
    const r = surf.getBoundingClientRect();
    setPan({
      x: (r.width / 2) - x * zoom,
      y: (r.height / 2) - y * zoom,
    });
    userTouchedViewRef.current = true;
  }, [zoom]);

  const applyCenter = useCallback(() => {
    const surf = surfaceRef.current;
    if (!surf) return;
    const r = surf.getBoundingClientRect();
    // P0.7: match computeFit by unioning devices + walls so Center
    // recenters on the same bounds the Fit button uses.
    let minX = 80, minY = 80, maxX = 720, maxY = 560;
    if (floorBackground) {
      minX = floorBackground.x;
      minY = floorBackground.y;
      maxX = floorBackground.x + floorBackground.naturalWidth * floorBackground.scale;
      maxY = floorBackground.y + floorBackground.naturalHeight * floorBackground.scale;
    }
    const DEV_MARGIN = 36;
    for (const d of devices) {
      if (typeof d.x !== 'number' || typeof d.y !== 'number') continue;
      if (d.x - DEV_MARGIN < minX) minX = d.x - DEV_MARGIN;
      if (d.y - DEV_MARGIN < minY) minY = d.y - DEV_MARGIN;
      if (d.x + DEV_MARGIN > maxX) maxX = d.x + DEV_MARGIN;
      if (d.y + DEV_MARGIN > maxY) maxY = d.y + DEV_MARGIN;
    }
    for (const w of allWalls) {
      const wxL = Math.min(w.x1, w.x2), wxR = Math.max(w.x1, w.x2);
      const wyT = Math.min(w.y1, w.y2), wyB = Math.max(w.y1, w.y2);
      if (wxL < minX) minX = wxL;
      if (wyT < minY) minY = wyT;
      if (wxR > maxX) maxX = wxR;
      if (wyB > maxY) maxY = wyB;
    }
    const planW = maxX - minX, planH = maxY - minY;
    setPan({
      x: (r.width  / 2) - (minX + planW / 2) * zoom,
      y: (r.height / 2) - (minY + planH / 2) * zoom,
    });
  }, [floorBackground, zoom, devices, allWalls]);
  // Auto-fit on mount + on viewport resize. Only auto-fits before the
  // user has manually adjusted (we set a sentinel ref after first user
  // pan / zoom so we don't keep snapping their view back). V1 P0.7:
  // capture the latest applyFit through a ref so we don't re-run the
  // auto-fit every time a device is added or moved — the dep used to
  // include `applyFit`, which changed reference every time devices /
  // walls changed, causing the camera to snap mid-drag.
  const userTouchedViewRef = useRef(false);
  const applyFitRef = useRef(applyFit);
  applyFitRef.current = applyFit;
  useEffect(() => {
    let raf = 0;
    const run = () => { raf = requestAnimationFrame(() => { if (!userTouchedViewRef.current) applyFitRef.current(); }); };
    run();
    const ro = new ResizeObserver(run);
    if (surfaceRef.current) ro.observe(surfaceRef.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [floorBackground?.dataUrl]);
  // Wheel-zoom + canvas-to-canvas stack-attach are dispatched by the
  // CanvasSurface as CustomEvents on the SVG element. We listen here so
  // they touch the parent state (zoom + setDevices + toasts).
  useEffect(() => {
    const svg = surfaceRef.current;
    if (!svg) return;
    const onWheelZoom = (e: Event) => {
      const next = (e as CustomEvent<number>).detail;
      if (typeof next === 'number') {
        setZoom(next);
        userTouchedViewRef.current = true;
      }
    };
    const onStackAttach = (e: Event) => {
      const { childId, hostId } = (e as CustomEvent<{ childId: string; hostId: string }>).detail;
      const child = devices.find((d) => d.id === childId);
      const host  = devices.find((d) => d.id === hostId);
      if (!child || !host) return;
      const hostKind: 'door' | 'idf' = isStackableHost(host.type) ? 'door' : 'idf';
      const compat = canHost(hostKind, child.type);
      if (!compat.allowed) {
        toast.warning(compat.reason ?? 'Cannot stack here', {
          description: compat.hint ?? `${child.type} doesn't belong on a ${host.type}.`,
          duration: 6000,
        });
        return;
      }
      // Door host: write the child onto host.doorAssembly[] (the canonical
      // persisted hardware schedule). Remove the child device — door
      // hardware lives as one record on the door, not as ghost accessory
      // devices on the canvas. ALSO clear any legacy stack/linkedIds on
      // the door so old data doesn't surface as the "Legacy stack" panel
      // ever again. If the dropped product doesn't map onto a known
      // DoorHardware slot we REJECT the drop (no fallthrough to legacy
      // stack[] for doors — that's the user-visible confusion the prior
      // pass left in place).
      if (hostKind === 'door') {
        const hw = productTypeToDoorHardware(child.type);
        if (!hw) {
          toast.warning(`${child.type.split('.').pop()} isn't door hardware`, {
            description: 'Drop it on the canvas instead, or attach to an IDF / rack.',
            duration: 5000,
          });
          return;
        }
        const cur = (host.doorAssembly ?? []) as DoorHardware[];
        const next = cur.includes(hw) ? cur : [...cur, hw];
        const curState = ((host as any).doorAssemblyState ?? {}) as Partial<Record<DoorHardware, 'proposed' | 'existing'>>;
        const nextState = cur.includes(hw) ? curState : { ...curState, [hw]: 'proposed' as const };
        setDevices((ds) => ds
          .map((d) => d.id === host.id ? { ...d, doorAssembly: next, doorAssemblyState: nextState, stack: undefined, linkedIds: undefined } : d)
          .filter((d) => d.id !== child.id)
        );
        setSelId(host.id);
        setSelPathwayId(null);
        toast.success(`Added ${hw} to ${host.id}`, {
          description: hw === 'maglock' ? 'Maglocks require a REX for code-compliant egress.' : 'Door assembly updated.',
          duration: 4500,
        });
        return;
      }
      // Non-door host (IDF / rack): keep the legacy stack[] flow.
      const nextStack = [...((host as any).stack ?? []), child.id];
      setDevices((ds) => ds
        .map((d) => d.id === host.id ? { ...d, stack: nextStack } as any : d)
        .filter((d) => d.id !== child.id)
      );
      setSelId(host.id);
      toast.success(`Stacked · ${child.type.split('.').pop()} → ${host.id}`, {
        description: compat.requires ?? 'Hardware attached.',
        duration: 5000,
      });
    };
    const onShiftPick = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail.id;
      setSelIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };
    const onBundleOpen = (e: Event) => {
      const id = (e as CustomEvent<{ bundleId: string }>).detail.bundleId;
      setBundleInspectorId(id);
    };
    const onMarqueePick = (e: Event) => {
      const ids = (e as CustomEvent<{ ids: string[] }>).detail.ids;
      setSelIds(new Set(ids));
      if (ids[0]) setSelId(ids[0]);
    };
    const onPathwayPick = (e: Event) => {
      const id = (e as CustomEvent<{ pathwayId: string }>).detail.pathwayId;
      setSelPathwayId(id);
      setSelId(null);
    };
    svg.addEventListener('dv-wheel-zoom', onWheelZoom as any);
    svg.addEventListener('dv-stack-attach', onStackAttach as any);
    svg.addEventListener('dv-shift-pick', onShiftPick as any);
    svg.addEventListener('dv-bundle-open', onBundleOpen as any);
    svg.addEventListener('dv-marquee-pick', onMarqueePick as any);
    svg.addEventListener('dv-pathway-pick', onPathwayPick as any);
    return () => {
      svg.removeEventListener('dv-wheel-zoom', onWheelZoom as any);
      svg.removeEventListener('dv-stack-attach', onStackAttach as any);
      svg.removeEventListener('dv-shift-pick', onShiftPick as any);
      svg.removeEventListener('dv-bundle-open', onBundleOpen as any);
      svg.removeEventListener('dv-marquee-pick', onMarqueePick as any);
      svg.removeEventListener('dv-pathway-pick', onPathwayPick as any);
    };
  }, [devices, setDevices]);

  // Run-to-IDF state — opens when the group toolbar's button is clicked.
  const [runToIdfOpen, setRunToIdfOpen] = useState(false);
  // Bundle inspector — opens with the bundleId when the user clicks a
  // bundled pathway label on the canvas.
  const [bundleInspectorId, setBundleInspectorId] = useState<string | null>(null);
  // Drag-selection-box state — pointerDown on an empty surface starts
  // a marquee selection; pointerUp commits every device whose centre
  // falls inside the rect into `selIds`.
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  // Selected pathway (cable run / conduit / J-hook / tray etc.) drives
  // the right-side PathwayDrawer. Set when the user clicks a pathway
  // line on canvas. Null when nothing pathway-related is selected.
  const [selPathwayId, setSelPathwayId] = useState<string | null>(null);

  // Pass 2A.3 — clear selection when the active floor changes. Stale
  // selIds pointing at off-floor devices would confuse the multi
  // select toolbar (counts mismatch) and the lock enforcement path.
  useEffect(() => {
    if (prevFloorIdRef.current && prevFloorIdRef.current !== currentFloorId) {
      setSelId(null);
      setSelIds(new Set());
      setSelPathwayId(null);
    }
    prevFloorIdRef.current = currentFloorId;
  }, [currentFloorId]);

  // Click-to-arm placement helper. Creates a new device of the given
  // product at canvas-space (x, y), selects it, and clears any open
  // pathway drawer. Mirrors the "normal floor drop" shape from the
  // drag-and-drop path (no host-attach or cable-accessory auto-link —
  // those remain drag-only). Returns the new device's id.
  const placeProductAt = useCallback((product: Product, x: number, y: number): string => {
    const kind = TYPE_KIND[product.type];
    const typeStr = product.type as string;
    const isDoor = typeStr.startsWith('inf.door')
      || typeStr.startsWith('inf.gate')
      || typeStr.startsWith('inf.storefront')
      || typeStr.startsWith('inf.doubledoor');
    const prefix = isDoor
      ? 'DR'
      : kind === 'camera'
        ? 'CAM'
        : kind === 'access'
          ? (product.type === 'acc.reader' ? 'RD' : 'DR')
          : 'NW';
    const cohort = isDoor
      ? Object.values(useProjectStore.getState().devices).filter((d) => {
          const t = d.type as string;
          return t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor');
        })
      : Object.values(useProjectStore.getState().devices).filter((d) => TYPE_KIND[d.type] === kind);
    const id = `${prefix}-${100 + cohort.length + 1}`;
    const newDevice: Device = {
      id,
      type: product.type,
      label: product.model,
      product: product.id,
      x, y, rot: 0,
    } as Device;
    setDevices((ds) => [...ds, newDevice]);
    setSelId(id);
    setSelPathwayId(null);
    toast.success(`Placed ${productLabel(product, product.id)}`, { description: `New device ${id}`, duration: 3500 });
    return id;
  }, [setDevices]);

  // M6 audit seam — exposes window.__dvSimulateDrop so the runtime
  // audit can exercise the HTML5 drop placement path end-to-end. Real
  // HTML5 drag-and-drop cannot be driven from puppeteer (headless
  // Chromium doesn't fire dragstart from synthesised mouse events, and
  // dispatchEvent of synthetic DragEvents bypasses React's synthetic
  // event delegation). The seam invokes the same callback the SVG
  // onDrop handler would.
  //
  // Hostname-gated identically to AuthGate's audit bypass. The seam
  // only attaches when the page is served from localhost (vite preview
  // at :4173 during the audit, vite dev at :5173 during local work).
  // On deeper-vision-ashy.vercel.app or any custom domain the effect
  // returns early and window.__dvSimulateDrop is never assigned —
  // production users cannot script the test seam from devtools.
  const productDropRef = useRef<(productId: string, clientX: number, clientY: number) => void>(() => { /* no-op until first render */ });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
    if (!isLocalHost) return;
    (window as unknown as Record<string, unknown>).__dvSimulateDrop = (productId: string, clientX: number, clientY: number) => {
      productDropRef.current(productId, clientX, clientY);
    };
    return () => {
      try { delete (window as unknown as Record<string, unknown>).__dvSimulateDrop; } catch { /* shutdown noise */ }
    };
  }, []);

  // Standalone conduit / pathway draw state — armed by the Cabling tray.
  // Carries the chosen kind + (for conduit) trade size so the cable
  // tool's commit handler writes the right fields onto the new pathway.
  const [drawPathwayKind, setDrawPathwayKind] = useState<{ kind: 'conduit' | 'tray' | 'jhook' | 'sleeve' | 'raceway' | 'duct'; conduitType?: 'EMT' | 'PVC' | 'FMC' | 'LFMC' | 'raceway' | 'tray'; conduitSize?: string } | null>(null);

  // `sel` is what the SelectionPill anchors to. During a drag, swap in
  // the lagged position so the pill rides with the device's visual mass
  // (and its tether stays connected) instead of teleporting to the
  // cursor target.
  const sel = useMemo(() => {
    const found = devices.find((d) => d.id === selId) ?? null;
    if (!found) return null;
    if (dragLag && dragLag.id === found.id) {
      return { ...found, x: dragLag.x, y: dragLag.y };
    }
    return found;
  }, [devices, selId, dragLag]);

  // Presence cursors — three teammates drifting around the canvas
  const [presence, setPresence] = useState<Array<{ id: string; name: string; tone: string; x: number; y: number; tx: number; ty: number; hoverId: string | null }>>([
    { id: 'JS', name: 'Jordan',  tone: '#2F81F7', x: 320, y: 240, tx: 320, ty: 240, hoverId: null },
    { id: 'MK', name: 'Mira',    tone: '#A371F7', x: 560, y: 360, tx: 560, ty: 360, hoverId: null },
    { id: 'RT', name: 'Rafael',  tone: '#3FB950', x: 220, y: 420, tx: 220, ty: 420, hoverId: null },
  ]);
  // devicesRef is already declared above for the drag physics loop;
  // no second declaration here.
  // Presence cursors are static — no autonomous movement. Real session would
  // drive these from a CRDT/socket. Mock teammates stay put to avoid distraction.

  const hoverByPresence = useMemo(() => {
    const m: Record<string, { name: string; tone: string }> = {};
    presence.forEach((p) => { if (p.hoverId) m[p.hoverId] = { name: p.name, tone: p.tone }; });
    return m;
  }, [presence]);

  /* Keyboard ------------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return;
      if (e.key === 'v' || e.key === 'V') setTool('select');
      if (e.key === 'h' || e.key === 'H') setTool('pan');
      if (e.key === 'm' || e.key === 'M') setTool('measure');
      if (e.key === 'c' || e.key === 'C') setTool('cable');
      if (e.key === 'w' || e.key === 'W') setTool('wall');
      if (e.key === 'r' || e.key === 'R') {
        // Only when no modifier is active (Cmd R = browser reload).
        if (!e.metaKey && !e.ctrlKey) setTool('room');
      }
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey) setTool('annotate');
      if (e.key === 'Escape') {
        // Escape unwinds from the most-immersive layer first so a single
        // press always feels predictable — first leave Canvas / Field
        // view, then close transient pickers, then close the right
        // drawer (V3.3 — selection persists so the pill stays put),
        // then drop selection.
        if (viewMode === 'canvas') { setViewMode('default'); return; }
        if (viewMode === 'field')  { setViewMode('default'); return; }
        if (reportOpen)            { setReportOpen(false); return; }
        if (scanBuildOpen)         { setScanBuildOpen(false); return; }
        // Cancel a pending click-to-arm placement before generic deselect.
        if (armedProduct)          { setArmedProduct(null); toast.message('Placement cancelled', { duration: 2000 }); return; }
        // Audit Group C.6 — Esc now drops the selection entirely
        // (which auto-closes the bottom-docked drawer); there is no
        // intermediate "drawer closed, device still selected" state
        // since the drawer mirrors selection 1:1.
        setSelId(null); setSelIds(new Set()); setDrag(null); setOpenCat(null); setOpenType(null);
        setWallStart(null);
        setMeasure({ start: null, end: null, cursor: null });
        setCableDraw((c) => ({ points: [], cursor: null, cableType: c.cableType }));
        setRoomDraw({ points: [], cursor: null });
        resetCalibrate();
        // Mirror the wall + Done button finish flow: if Esc cancels a
        // drawing tool, also flip back to Select so the tool isn't left
        // armed. Without this, Esc cleared the in-flight points but the
        // banner re-appeared as "Click the first vertex" and the next
        // canvas click started a fresh chain.
        if (tool === 'wall' || tool === 'measure' || tool === 'cable' || tool === 'conduit' || tool === 'pathway' || tool === 'calibrate' || tool === 'room') {
          setTool('select');
        }
      }
      if (e.key === 'Enter' && (tool === 'cable' || tool === 'conduit' || tool === 'pathway') && cableDraw.points.length >= 2) {
        finishCableDraw();
      }
      if (e.key === 'Enter' && tool === 'room' && roomDraw.points.length >= 3) {
        finishRoomDraw();
      }
      // Enter while drawing walls: commit the in-flight chain, clear all
      // wall draw state, and drop the user back to Select. Without the
      // setTool('select') the app stays in Wall mode and the next blank
      // canvas click starts a fresh chain — which is the user's complaint.
      // Mirrors finishCableDraw (line 876) which already returns to Select.
      if (e.key === 'Enter' && tool === 'wall') {
        setWallStart(null);
        setWallCursor(null);
        setTool('select');
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selId) {
        setDevices((ds) => ds.filter((d) => d.id !== selId));
        setSelId(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); setZoom(1); }
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom((z) => Math.min(4, z * 1.2)); }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); setZoom((z) => Math.max(0.25, z / 1.2)); }
      // Pass 1.3 — Cmd / Ctrl + A selects every visible device on the
      // current canvas surface. Locked items are skipped unless Shift
      // is held (Cmd-Shift-A = include locked). Read devices straight
      // from the store and the locked / hidden sets from refs so the
      // bound handler does not need to re-register on every change.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const includeLocked = e.shiftKey;
        const pid = projectId ?? 'p1';
        const fid = currentFloorId;
        const liveDevices = (Object.values(useProjectStore.getState().devices) as unknown as Device[])
          .filter((d: any) => d.projectId === pid && (fid === '' || d.floorId === fid));
        const hidden = hiddenIdsRef.current;
        const locked = lockedIdsRef.current;
        const visible = liveDevices.filter((d) => !hidden.has(d.id) && (includeLocked || !locked.has(d.id)));
        setSelIds(new Set(visible.map((d) => d.id)));
        if (visible[0]) setSelId(visible[0].id);
        toast.message(`Selected ${visible.length} ${visible.length === 1 ? 'device' : 'devices'}`, { duration: 1800 });
      }
      // Pass 1.4 — Cmd / Ctrl + C copy, V paste, D duplicate in place.
      // Refs let the handler (bound once) call the latest helper
      // closures without re-binding on every devices update.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) {
        // Don't fight the browser's native copy when there's a real
        // text selection in the page (input fields already early
        // returned above; this is for the canvas context).
        if (window.getSelection?.()?.toString()) return;
        e.preventDefault();
        copySelectionRef.current();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        pasteClipboardRef.current();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        duplicateSelectionRef.current();
      }
      // Pass 1.9 — Cmd / Ctrl + K opens the search + command bar.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCmdKOpen((v) => !v);
      }
      // Pass 2A.7 — Cmd / Ctrl + Shift + O toggles multi floor overview.
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'o' || e.key === 'O' || e.key === 'O')) {
        e.preventDefault();
        setOverviewOpen((v) => !v);
      }
      // Pass 2A.2 — Cmd / Ctrl + Up / Down moves the active floor up
      // or down by one in the elevation order (higher level = up).
      // Reads from the live store so the handler stays bound once.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const pid = projectId ?? 'p1';
        const st = useProjectStore.getState();
        const list = Object.values(st.floors)
          .filter((f) => f.projectId === pid)
          .sort((a, b) => (b.level - a.level) || ((b.createdAt ?? 0) - (a.createdAt ?? 0)));
        if (list.length < 2) return;
        const curId = st.currentFloorIdByProject[pid] ?? list[list.length - 1]?.id;
        const idx = list.findIndex((f) => f.id === curId);
        if (idx < 0) return;
        // ArrowUp means "go to the floor above" (higher level) which
        // is earlier in our descending-sorted list (smaller index).
        const next = e.key === 'ArrowUp' ? list[Math.max(0, idx - 1)] : list[Math.min(list.length - 1, idx + 1)];
        if (next && next.id !== curId) {
          st.setCurrentFloorIdForProject(pid, next.id);
          toast.message(`Floor: ${next.name}`, { duration: 1500 });
        }
      }
      // Pass 1.6 — arrow nudge. 1 canvas unit per press, 10 with Shift.
      // Works on either the multi selection or the primary sel. Single
      // grouped undo step because each press is one setDevices call.
      // Cmd / Ctrl arrow keys are reserved for browser history nav so
      // we ignore them here.
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.metaKey && !e.ctrlKey) {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
        if (dx === 0 && dy === 0) return;
        nudgeSelectionRef.current(dx, dy);
        e.preventDefault();
      }
      // Canvas V2 Pass 1.1 — undo / redo. Cmd-Z undo, Cmd-Shift-Z redo.
      // Ctrl-Y also redos (Windows convention). Esc earlier in this
      // handler cancels in-flight edits and pushes nothing to history.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        const wantsRedo = e.shiftKey;
        const popped = wantsRedo
          ? useProjectStore.getState().canvasRedo()
          : useProjectStore.getState().canvasUndo();
        if (popped) {
          toast.message(`${wantsRedo ? 'Redo' : 'Undo'}: ${popped.label}`, { duration: 2000 });
        } else {
          toast.message(wantsRedo ? 'Nothing to redo' : 'Nothing to undo', { duration: 1500 });
        }
      }
      if ((e.ctrlKey && !e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        const popped = useProjectStore.getState().canvasRedo();
        if (popped) toast.message(`Redo: ${popped.label}`, { duration: 2000 });
        else toast.message('Nothing to redo', { duration: 1500 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // viewMode + scanBuildOpen captured so Escape unwinds the most-immersive
    // layer first (Canvas → Field → modal → selection). tool included so
    // Enter knows whether the cable tool is active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, viewMode, scanBuildOpen, reportOpen, tool, cableDraw.points.length, armedProduct, wallStart]);

  /* Drag-to-place from the library --------------------------------------- */
  // hoverHost is the door / IDF currently under the cursor while a drag is
  // active. Drives the on-canvas attach ring + the attach-vs-reject
  // decision on drop. The compatibility module (lib/compatibility) is the
  // single source of truth for what can host what.
  const [hoverHost, setHoverHost] = useState<{
    id: string;
    cx: number; cy: number;
    allowed: boolean;
    reason?: string;
    hint?: string;
  } | null>(null);
  useEffect(() => {
    if (!drag) { setHoverHost(null); return; }
    const HOST_RANGE = 26; // canvas units — how close the cursor needs to be
    const onMove = (e: PointerEvent) => {
      const r = surfaceRef.current?.getBoundingClientRect();
      if (!r) return;
      setDrag((d) => d ? { ...d, x: e.clientX - r.left, y: e.clientY - r.top } : null);
      // Detect the nearest door / IDF host under the cursor and ask
      // canHost whether the dragged product is compatible. Plan-space
      // cursor accounts for both pan and zoom so the range is consistent.
      const cx = (e.clientX - r.left - pan.x) / zoom;
      const cy = (e.clientY - r.top  - pan.y) / zoom;
      let best: { id: string; type: DeviceType; cx: number; cy: number; d: number } | null = null;
      for (const dev of devices) {
        const isHost = isStackableHost(dev.type)
          || dev.type === 'net.idf' || dev.type === 'net.mdf'
          || dev.type === 'inf.rack' || dev.type === 'inf.mdf';
        if (!isHost) continue;
        const d = Math.hypot(dev.x - cx, dev.y - cy);
        if (d < HOST_RANGE && (!best || d < best.d)) best = { id: dev.id, type: dev.type, cx: dev.x, cy: dev.y, d };
      }
      if (!best) { setHoverHost(null); return; }
      const hostKind: 'door' | 'idf' = isStackableHost(best.type) ? 'door' : 'idf';
      const compat = canHost(hostKind, drag.product.type);
      setHoverHost({
        id: best.id, cx: best.cx, cy: best.cy,
        allowed: compat.allowed,
        reason: compat.reason,
        hint: compat.hint,
      });
    };
    const onUp = (e: PointerEvent) => {
      const r = surfaceRef.current?.getBoundingClientRect();
      if (!r || !drag) { setDrag(null); setHoverHost(null); dragStartRef.current = null; return; }
      // Short release without meaningful drag → arm placement instead of
      // dropping the device wherever the cursor happened to be (which used
      // to land devices inside the tray overlay). Distance is measured
      // against the IMMUTABLE start coords recorded at pointerdown, NOT
      // drag.x/drag.y — those are overwritten on every pointermove to
      // keep the ghost icon under the cursor.
      const start = dragStartRef.current ?? { x: drag.x, y: drag.y };
      const movedPx = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (movedPx < 8 || !inside) {
        setArmedProduct(drag.product);
        setDrag(null); setHoverHost(null); dragStartRef.current = null;
        toast.message(`Click canvas to place ${productLabel(drag.product, drag.product.id)}`, {
          description: 'Esc to cancel.',
          duration: 4500,
        });
        return;
      }
      // M6 cleanup — the legacy pointer-event PLACEMENT path is gone.
      // HTML5 drag and drop (canvas/interaction/dragDrop.ts) is the only
      // path that creates devices on the canvas, including host
      // attachment. This onUp now ONLY handles the arm-to-click case
      // above; a "real" pointer drag (>= 8 px movement) just clears
      // the legacy drag state so the React ghost goes away. The drop
      // itself was already consumed by the SVG-level onDrop.
      setDrag(null); setHoverHost(null); dragStartRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  // NB: hoverHost intentionally OUT of the dep list — it's only used for
  // visual hover feedback in CanvasSurface. The drop-mutation decision
  // is now made by findHostUnderPointer at pointerup time, so the move
  // and up handlers do not depend on it.
  }, [drag, zoom, snap, devices, pan]);

  const updateSel = (patch: Partial<Device>) => sel && setDevices((ds) => ds.map((d) => d.id === sel.id ? { ...d, ...patch } : d));
  // Canvas V3.12 — pill-menu Delete now warns the operator when the
  // selected device has linked records (stacked accessories, attached
  // pathway, linked devices, doors that reference it). Undo is wired
  // through the canvas history system regardless, so the warning is a
  // pre-delete review, not the only safety net.
  const deleteSel = () => {
    if (!sel) return;
    // Compute dependents from the live store so we count the latest
    // state, not a stale closure.
    const live = useProjectStore.getState();
    const liveDevices = Object.values(live.devices) as unknown as Device[];
    const stackedOnSel = (sel.stack ?? []).length;
    const linkedFromSel = (sel.linkedIds ?? []).length;
    const attachedPath = sel.attachedPathwayId ? 1 : 0;
    // Other devices that name this one in their stack or linkedIds.
    const reverseRefs = liveDevices.filter((d) =>
      d.id !== sel.id && (
        (d.stack ?? []).includes(sel.id)
        || (d.linkedIds ?? []).includes(sel.id)
        || d.attachedPathwayId === sel.id
      ),
    ).length;
    const depCount = stackedOnSel + linkedFromSel + attachedPath + reverseRefs;
    const proceed = depCount === 0
      || window.confirm(
        `Delete ${sel.id}?\n\nIt has ${depCount} linked record${depCount === 1 ? '' : 's'} `
        + `(${stackedOnSel} stacked, ${linkedFromSel} linked, ${attachedPath} attached pathway${attachedPath === 1 ? '' : 's'}, `
        + `${reverseRefs} reverse reference${reverseRefs === 1 ? '' : 's'}).\n\n`
        + `Delete anyway? You can undo immediately after with Cmd+Z.`,
      );
    if (!proceed) return;
    setDevices((ds) => ds.filter((d) => d.id !== sel.id));
    setSelId(null);
  };
  /** Clone the selected device with a new id and a small offset so the user
   *  can visually see the new copy. Selection follows the clone. Deep-clones
   *  the lenses object on multisensors so adjusting one camera doesn't bleed
   *  into its copy. */
  const duplicateSel = () => {
    if (!sel) return;
    const newId = `${sel.id}-c${Date.now().toString(36).slice(-4)}`;
    const clone: Device = {
      ...sel,
      id: newId,
      x: sel.x + 24 / zoom,
      y: sel.y + 24 / zoom,
      label: `${sel.label} copy`,
      lenses: sel.lenses ? {
        a: { ...sel.lenses.a },
        b: { ...sel.lenses.b },
        c: { ...sel.lenses.c },
        d: { ...sel.lenses.d },
      } : undefined,
      linkedIds: sel.linkedIds ? [...sel.linkedIds] : undefined,
    };
    setDevices((ds) => [...ds, clone]);
    setSelId(newId);
  };

  // Canvas V2 Pass 1.4 — copy / paste / multi duplicate.
  // The clipboard is in-memory only; clearing it on reload keeps the
  // user from pasting stale state into a different project.
  const [clipboard, setClipboard] = useState<Device[]>([]);
  const cloneDevice = useCallback((src: Device, offsetX: number, offsetY: number): Device => {
    const tail = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 6)
      : `${Date.now().toString(36).slice(-3)}${Math.random().toString(36).slice(2, 5)}`;
    return {
      ...src,
      id: `${src.id}-c${tail}`,
      x: src.x + offsetX,
      y: src.y + offsetY,
      label: src.label ? `${src.label} copy` : src.label,
      lenses: src.lenses ? {
        a: { ...src.lenses.a },
        b: { ...src.lenses.b },
        c: { ...src.lenses.c },
        d: { ...src.lenses.d },
      } : undefined,
      // Drop linkedIds + stack on clones — they point at the originals
      // which would create cross wired references. Operators rewire by
      // dragging accessories onto the new host.
      linkedIds: undefined,
      stack: undefined,
    };
  }, []);
  // Selection helper — multi if selIds is non-empty, otherwise just sel.
  const currentSelectionDevices = useCallback((): Device[] => {
    if (selIds.size > 0) return devices.filter((d) => selIds.has(d.id));
    return sel ? [sel] : [];
  }, [devices, selIds, sel]);
  const copySelection = useCallback(() => {
    const src = currentSelectionDevices();
    if (!src.length) return;
    setClipboard(src.map((d) => ({ ...d })));
    toast.message(`Copied ${src.length} ${src.length === 1 ? 'device' : 'devices'}`, { duration: 1500 });
  }, [currentSelectionDevices]);
  const pasteClipboard = useCallback(() => {
    if (!clipboard.length) {
      toast.message('Clipboard is empty', { duration: 1500 });
      return;
    }
    // Paste at a small offset from the original. The first item anchors
    // the offset; subsequent items keep their relative spacing.
    const offsetX = 36 / zoom;
    const offsetY = 36 / zoom;
    const clones = clipboard.map((d) => cloneDevice(d, offsetX, offsetY));
    setDevices((ds) => [...ds, ...clones]);
    setSelIds(new Set(clones.map((c) => c.id)));
    setSelId(clones[0]?.id ?? null);
    toast.success(`Pasted ${clones.length} ${clones.length === 1 ? 'device' : 'devices'}`, { duration: 1800 });
  }, [clipboard, zoom, cloneDevice, setDevices]);
  // Canvas V2 Pass 1.5 — alignment + distribute. All ops route through
  // setDevices so the existing facade derives one history label per
  // call ("Edited devices" or "Moved N devices") and one undo step.
  type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v';
  type DistMode = 'h' | 'v';
  const alignSelection = useCallback((mode: AlignMode) => {
    const src = selIds.size > 0 ? devices.filter((d) => selIds.has(d.id)) : (sel ? [sel] : []);
    if (src.length < 2) return;
    const xs = src.map((d) => d.x); const ys = src.map((d) => d.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
    setDevices((ds) => ds.map((d) => {
      if (!selIds.has(d.id) && d.id !== sel?.id) return d;
      switch (mode) {
        case 'left':     return { ...d, x: minX };
        case 'right':    return { ...d, x: maxX };
        case 'top':      return { ...d, y: minY };
        case 'bottom':   return { ...d, y: maxY };
        case 'center-h': return { ...d, x: cx };
        case 'center-v': return { ...d, y: cy };
      }
    }));
  }, [devices, selIds, sel, setDevices]);
  const distributeSelection = useCallback((axis: DistMode) => {
    const src = (selIds.size > 0 ? devices.filter((d) => selIds.has(d.id)) : []);
    if (src.length < 3) return; // need at least 3 for distribute to make sense
    const sorted = [...src].sort((a, b) => axis === 'h' ? a.x - b.x : a.y - b.y);
    const first = sorted[0]; const last = sorted[sorted.length - 1];
    const total = axis === 'h' ? (last.x - first.x) : (last.y - first.y);
    const step = total / (sorted.length - 1);
    // Build the new position for each id and apply in one setDevices call.
    const updates: Record<string, number> = {};
    sorted.forEach((d, i) => { updates[d.id] = (axis === 'h' ? first.x : first.y) + step * i; });
    setDevices((ds) => ds.map((d) => {
      if (!(d.id in updates)) return d;
      return axis === 'h' ? { ...d, x: updates[d.id] } : { ...d, y: updates[d.id] };
    }));
  }, [devices, selIds, setDevices]);

  const duplicateSelection = useCallback(() => {
    const src = currentSelectionDevices();
    if (!src.length) return;
    const offsetX = 24 / zoom;
    const offsetY = 24 / zoom;
    const clones = src.map((d) => cloneDevice(d, offsetX, offsetY));
    setDevices((ds) => [...ds, ...clones]);
    if (clones.length > 1) {
      setSelIds(new Set(clones.map((c) => c.id)));
      setSelId(clones[0].id);
    } else {
      setSelId(clones[0].id);
      setSelIds(new Set());
    }
    toast.success(`Duplicated ${clones.length} ${clones.length === 1 ? 'device' : 'devices'}`, { duration: 1800 });
  }, [currentSelectionDevices, zoom, cloneDevice, setDevices]);
  // Refs so the keyboard handler (bound once via the existing useEffect)
  // can call the latest version of each helper without re-binding the
  // listener on every devices update.
  const copySelectionRef = useRef(copySelection);
  const pasteClipboardRef = useRef(pasteClipboard);
  const duplicateSelectionRef = useRef(duplicateSelection);
  useEffect(() => { copySelectionRef.current = copySelection; }, [copySelection]);
  useEffect(() => { pasteClipboardRef.current = pasteClipboard; }, [pasteClipboard]);
  useEffect(() => { duplicateSelectionRef.current = duplicateSelection; }, [duplicateSelection]);

  // Canvas V2 Pass 1.6 — arrow nudge. Moves every selected device by
  // (dx, dy) canvas units in a single setDevices call so the history
  // facade groups it as one undo step.
  const nudgeSelection = useCallback((dx: number, dy: number) => {
    const targets = selIds.size > 0
      ? new Set(selIds)
      : (sel ? new Set([sel.id]) : new Set<string>());
    if (targets.size === 0) return;
    setDevices((ds) => ds.map((d) => (targets.has(d.id) ? { ...d, x: d.x + dx, y: d.y + dy } : d)));
  }, [selIds, sel, setDevices]);
  const nudgeSelectionRef = useRef(nudgeSelection);
  useEffect(() => { nudgeSelectionRef.current = nudgeSelection; }, [nudgeSelection]);
  /** Open the engineering inspector to a specific tab. Used by toolbar
   *  buttons (Note, Link, FOV, AI Optimize, etc.) so they all jump straight
   *  to the relevant panel instead of silently doing nothing. */
  const openTab = (t: EditTab) => { setEditOpen(true); setEditTab(t); };

  const counts = useMemo(() => {
    const c: Record<DeviceKind, number> = { camera: 0, access: 0, network: 0, intrusion: 0, audio: 0, storage: 0, display: 0, power: 0, sensor: 0 };
    devices.forEach((d) => c[TYPE_KIND[d.type]]++);
    return c;
  }, [devices]);

  /* ------------------------------------------------------------------- */
  // SC.7.2: breadcrumb shows the actual project name (was hardcoded
  // 'Riverbend HQ' — pre-existing tech debt that leaked into every
  // project's canvas). Fallback covers the rare case where the route
  // points at a project id that's missing from the store.
  const breadcrumbProjectName = useProjectStore((s) => s.projects[projectId]?.name) ?? 'Untitled project';
  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: breadcrumbProjectName, to: `/project/${projectId}` }, { label: 'Canvas' }]}
      fullBleed
    >
      {/* Item 2 — top-level error boundary. The prior CanvasErrorBoundary
          only wrapped CanvasSurface and EditDrawer, so a throw in a
          sibling (SelectionPill, drawing rail, dialogs, the docked
          drawers, anything outside those two) blanked the whole page.
          This boundary spans every child of AppShell so any single
          component throw shows a contained message and the app stays
          alive. */}
      <CanvasErrorBoundary label="EngineeringCanvas">
      <div ref={rootRef} className="h-full flex flex-col bg-background text-foreground relative">
        {/* Motion keyframes — used by the selection pill, spotlight ring,
            and lens chips. The easing is the same throughout (cubic-bezier
            0.22, 1, 0.36, 1 — a calm decelerate) so motion feels like one
            product, not many. Reduced-motion preferences are respected. */}
        <style>{`
          @keyframes pill-in {
            from { opacity: 0; transform: translateX(-50%) translateY(4px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
          @keyframes soft-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          /* V3.9 -- lens-chip-in keyframe removed. Its only consumer
             was the pill-side MultisensorLensChips strip, which V3.2
             deleted as a duplicate of the drawer's lens chips. */
          /* Subtle hover lift on every canvas device. Affects the entire
             device group: glyph, halo, and lens dot rise together. Selected
             devices don't double-up the transform (they already have the
             spotlight) — handled via the .dv-device:not(.dv-selected) rule. */
          .dv-device { transform: translate(0,0); transform-origin: center; }
          .dv-device:hover:not(.dv-selected) { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.18)); }
          /* Cone tip / FOV edge handles — hover affordance. The background
             glow ring brightens on hover so the user clearly sees "this
             is grabbable" before clicking. No size jump (the handle stays
             precise for placement). */
          .dv-cone-handle > circle:first-child { transition: opacity 120ms ease-out; }
          .dv-cone-handle:hover > circle:first-child { opacity: 0.42; }
          @media (prefers-reduced-motion: reduce) {
            @keyframes pill-in { from { opacity: 1; transform: translateX(-50%); } to { opacity: 1; transform: translateX(-50%); } }
            @keyframes soft-fade-in { from { opacity: 1; } to { opacity: 1; } }
            .dv-device:hover:not(.dv-selected) { transform: none; filter: none; }
          }
        `}</style>
        {/* viewMode === 'canvas' = full-canvas mode. Hide the top toolbar
            entirely so the floorplan dominates. A small floating chip in the
            corner lets the user exit. The intent is "canvas is the product"
            — no SaaS chrome.

            viewMode === 'field' = field-survey mode. Slim TopBar still
            visible (so the engineer keeps snap / units / theme / scan /
            view-mode controls one click away) but BOTH side rails are
            hidden so the canvas takes the full width of the viewport. */}
        {viewMode !== 'canvas' && (
          <TopBar
            floor={floor} setFloor={setFloor}
            projectId={projectId}
            floorName={currentFloorName ?? 'Floor'}
            snap={snap} setSnap={setSnap}
            units={units} setUnits={setUnits}
            onScan={() => nav('/visionscan')}
            onSetup={() => setOnboarded(false)}
            techModel={techModel}
            setTechModel={(m) => setProjectTechModel(projectId, m)}
            isFullscreen={isFullscreen}
            onEnterFullscreen={enterFullscreen}
            onExitFullscreen={exitFullscreen}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onOpenScanBuild={() => setScanBuildOpen(true)}
            onOpenReport={() => setReportOpen(true)}
            onOpenBom={() => {
              // Free the right-side slot so the BOM drawer is the only
              // inspector visible. Without this, an EditDrawer / PathwayDrawer
              // that the user "closed" via its X button is still mounted
              // (just slid off-screen with selId/selPathwayId preserved) and
              // would block the BOM mount under the previous gating.
              setSelId(null);
              setSelPathwayId(null);
              setEditOpen(false);
              setCanvasBomOpen(true);
            }}
            onOpenReview={() => nav(`/project/${projectId}/review`)}
            onOpenDeployment={() => nav(`/project/${projectId}/deployment`)}
            onOpenReports={() => nav(`/project/${projectId}/reports`)}
            compact={viewMode === 'field'}
            intelOpen={intelOpen}
            setIntelOpen={setIntelOpen}
            onPopOut={() => {
              // Opens the canvas in a new window. The persist middleware
              // shares zustand state across windows via localStorage, so
              // the popped-out canvas reflects the same project / floor.
              // The user can drag the new window to a second monitor.
              const url = `/project/${projectId}/canvas?popout=1`;
              const w = window.open(url, `dv-canvas-${projectId}`, 'width=1400,height=900');
              if (!w) {
                toast.error('Pop-out blocked', { description: 'Allow pop-ups for this site to use a separate canvas window.', duration: 6000 });
              }
            }}
          />
        )}
        {viewMode === 'canvas' && (
          <button
            onClick={() => {
              setViewMode('default');
              // If we're in browser fullscreen as well, drop both at once
              // so a single click returns the user to the normal canvas.
              if (isFullscreen) exitFullscreen();
            }}
            className="absolute top-3 left-3 z-50 px-2.5 py-1.5 rounded-md bg-card/85 border border-border text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground hover:border-border-strong backdrop-blur-xl flex items-center gap-1.5"
            title="Exit full-canvas mode · Esc"
          >
            <ChevronLeft className="w-3 h-3" />
            {isFullscreen ? 'Exit fullscreen' : 'Exit canvas'}
          </button>
        )}

        <div className="flex-1 min-h-0 flex">
          {/* Project section nav + device library used to live here on the
              left, but the user's hard rule is "tools on left, devices on
              bottom." Section nav (Overview / Maps / Reports / Docs) is
              now reachable through the TopBar overflow menu; device adds
              are exclusively through the BottomDeviceBar. The InsertDock
              still exists as a structured catalog drawer the user can
              open from the "+ Full catalog" action in the bottom bar
              when they specifically want browsing UI; it never mounts on
              its own in default canvas view. */}

          {layersOpen && (
            <LayersPanel
              devices={devices}
              selId={selId}
              setSelId={setSelId}
              selIds={selIds}
              setSelIds={setSelIds}
              hiddenIds={hiddenIds} setHiddenIds={setHiddenIds}
              lockedIds={lockedIds} setLockedIds={setLockedIds}
              layers={layers}
              onToggleLayer={(layer, on) => setCanvasLayer(projectId, layer, on)}
              display={display}
              onDisplayChange={(patch) => setCanvasDisplay(projectId, patch)}
              onClose={() => setLayersOpen(false)}
            />
          )}

          <div className="flex-1 min-w-0 flex flex-col">
            {/* ITEM 1 — inner viewport. The CanvasSurface + all its
                absolute overlays live here. The viewport is flex-1
                inside a flex-col outer; the docked BottomDeviceBar
                below is a shrink-0 sibling. Net effect: the bar takes
                its own bottom slot and the canvas viewport ends right
                above it — no overlay, no floating, no cover. */}
            <div className="flex-1 min-h-0 relative">
            {/* Canvas V2 Pass 2A.7 — multi floor overview. When open,
                replaces the canvas surface entirely with a tile grid
                of every floor on this project. Click any tile to
                drill in. */}
            {overviewOpen && (
              <FloorOverview
                projectId={projectId}
                onPickFloor={(fid) => {
                  setCurrentFloorIdForProject(projectId, fid);
                  setOverviewOpen(false);
                }}
                onClose={() => setOverviewOpen(false)}
              />
            )}
            <CanvasErrorBoundary label="CanvasSurface">
            <CanvasSurface
              ref={surfaceRef}
              tool={tool}
              zoom={zoom}
              pan={pan}
              setPan={setPan}
              onUserTouchView={() => { userTouchedViewRef.current = true; }}
              onProductDrop={(() => {
                // Inline IIFE that returns the drop callback. Same body
                // as before, with productDropRef.current ALSO pointing
                // at it so the audit seam (window.__dvSimulateDrop) runs
                // the exact same code path the real drop handler does.
                const cb = (productId: string, x: number, y: number, clientX: number, clientY: number) => {
                  const product = PRODUCTS_BY_ID.get(productId);
                  if (!product) return;
                  // Legacy pointer-event drag state may still be set if
                  // the user pointer-downed on a tray button before the
                  // browser switched to HTML5 drag. Clear it so the
                  // React ghost doesn't linger after drop.
                  setDrag(null);
                  setHoverHost(null);
                  dragStartRef.current = null;
                  const surfRect = surfaceRef.current?.getBoundingClientRect();
                  const dropHost = surfRect ? findHostUnderPointer(clientX, clientY, surfRect, pan, zoom, devices, product.type) : null;
                  if (dropHost) {
                    const { host, hostKind, compat } = dropHost;
                    if (!compat.allowed) {
                      toast.warning(compat.reason ?? 'Not compatible with that host', {
                        description: compat.hint, duration: 6500,
                      });
                      return;
                    }
                    if (hostKind === 'door') {
                      const hw = productTypeToDoorHardware(product.type);
                      if (!hw) {
                        toast.warning(`${product.model} isn't door hardware`, {
                          description: 'Drop it on the canvas instead, or attach to an IDF / rack.',
                          duration: 5000,
                        });
                        return;
                      }
                      const cur = (host.doorAssembly ?? []) as DoorHardware[];
                      const next = cur.includes(hw) ? cur : [...cur, hw];
                      const curState = ((host as any).doorAssemblyState ?? {}) as Partial<Record<DoorHardware, 'proposed' | 'existing'>>;
                      const nextState = cur.includes(hw) ? curState : { ...curState, [hw]: 'proposed' as const };
                      setDevices((ds) => ds.map((d) => d.id === host.id ? { ...d, doorAssembly: next, doorAssemblyState: nextState, stack: undefined, linkedIds: undefined } : d));
                      setSelId(host.id);
                      setSelPathwayId(null);
                      toast.success(`Added ${hw} to ${host.id}`, {
                        description: hw === 'maglock'
                          ? 'Maglocks require a REX for code-compliant egress.'
                          : 'Door assembly updated.',
                        duration: 4500,
                      });
                      return;
                    }
                  }
                  placeProductAt(product, x, y);
                };
                // Keep the audit seam ref pointing at the latest closure.
                // World→client mapping happens inside this callback so
                // the seam can pass client coords directly.
                productDropRef.current = (productId, clientX, clientY) => {
                  const svgEl = surfaceRef.current;
                  if (!svgEl) return;
                  const r = svgEl.getBoundingClientRect();
                  const wx = (clientX - r.left - pan.x) / zoom;
                  const wy = (clientY - r.top  - pan.y) / zoom;
                  cb(productId, wx, wy, clientX, clientY);
                };
                return cb;
              })()}
              devices={devices.filter((d) => !hiddenIds.has(d.id))}
              selId={selId}
              selPathwayId={selPathwayId}
              selIds={selIds}
              presence={presence}
              hoverByPresence={hoverByPresence}
              planSource={planSource}
              siteAddress={siteAddress}
              walls={allWalls}
              wallStart={wallStart}
              wallCursor={wallCursor}
              onPick={(id) => { setSelId(id); setSelPathwayId(null); }}
              onMoveDevice={(id, x, y) => setDevices((ds) => ds.map((d) => d.id === id ? { ...d, x, y } : d))}
              onRotateDevice={(id, rot) => setDevices((ds) => ds.map((d) => d.id === id ? { ...d, rot } : d))}
              onUpdateDevice={(id, patch) => setDevices((ds) => ds.map((d) => d.id === id ? { ...d, ...patch } : d))}
              activeLens={activeLens}
              setActiveLens={setActiveLens}
              coverageMode={coverageMode}
              layers={layers}
              display={display}
              dragLag={dragLag}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              hoveredLens={hoveredLens}
              hoverHost={hoverHost}
              persistedMeasurements={persistedMeasurements}
              measurementsVisible={measurementsVisible}
              onRemoveMeasurement={removeMeasurement}
              floorBackground={floorBackground}
              onUpdateBackground={(patch) => {
                if (!currentFloorId || !floorBackground) return;
                // Coalesce so dragging the background's position slider
                // produces one undoable step, not one per frame.
                pushCanvasHistory('Adjusted floor background', ['floors'], 'bg-edit');
                useProjectStore.getState().setFloorBackground(currentFloorId, { ...floorBackground, ...patch });
              }}
              onBlank={() => { setSelId(null); setSelPathwayId(null); }}
              onArmedClick={(x, y) => {
                if (!armedProduct) return false;
                placeProductAt(armedProduct, x, y);
                setArmedProduct(null);
                return true;
              }}
              currentFloorPxToFt={currentFloorPxToFt}
              currentFloorId={currentFloorId}
              coverageGrid={coverageGrid}
              rooms={currentFloorRooms}
              roomDraw={tool === 'room' ? roomDraw : undefined}
              onPickRoom={(rid) => setSelRoomId(rid)}
              annotations={currentFloorAnnotations}
              onPatchAnnotation={updateAnnotation}
              onRemoveAnnotation={(aid) => { pushCanvasHistory('Removed annotation', ['annotations']); removeAnnotation(aid); }}
              snap={snap}
              dragging={!!drag}
              selectedDoriLevel={selectedDoriLevel}
              personProbePos={personProbePos}
              setPersonProbePos={setPersonProbePos}
              onSurfaceClick={(x, y) => {
                if (tool === 'wall') {
                  const sx = snap ? Math.round(x / 20) * 20 : x;
                  const sy = snap ? Math.round(y / 20) * 20 : y;
                  if (!wallStart) { setWallStart({ x: sx, y: sy }); }
                  else {
                    if (currentFloorId) {
                      // Stable wall id so undo / redo round trips do
                      // not collide. Snapshot floors before mutating
                      // so canvasUndo restores the prior wall set.
                      const wid = `w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
                      const next = [...(storeFloorWalls ?? []), { id: wid, x1: wallStart.x, y1: wallStart.y, x2: sx, y2: sy }];
                      pushCanvasHistory('Drew wall', ['floors']);
                      setFloorWalls(currentFloorId, next);
                    }
                    setWallStart({ x: sx, y: sy });
                  }
                  return;
                }
                if (tool === 'measure') {
                  if (!measure.start) {
                    setMeasure({ start: { x, y }, end: null, cursor: { x, y } });
                  } else {
                    // Pass 1.8 — second click persists the segment so it
                    // survives tool switches + reloads. Local state
                    // resets immediately so the next click starts a
                    // fresh measurement.
                    if (currentFloorId) {
                      const mid = `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
                      useProjectStore.getState().addMeasurement({
                        id: mid,
                        floorId: currentFloorId,
                        a: { x: measure.start.x, y: measure.start.y },
                        b: { x, y },
                        createdAt: Date.now(),
                      });
                    }
                    setMeasure({ start: null, end: null, cursor: null });
                  }
                  return;
                }
                if (tool === 'cable' || tool === 'conduit' || tool === 'pathway') {
                  // All three draw modes share the same vertex-clicking
                  // primitive; finishCableDraw branches on drawModeRef
                  // to write the right pathway type.
                  const sx = snap ? Math.round(x / 20) * 20 : x;
                  const sy = snap ? Math.round(y / 20) * 20 : y;
                  setCableDraw((c) => ({ ...c, points: [...c.points, { x: sx, y: sy }] }));
                  return;
                }
                if (tool === 'room') {
                  // Pass 2C.1 — vertex click. Snap optional. Double
                  // click closes; Enter also closes (handled in the
                  // keyboard handler).
                  const sx = snap ? Math.round(x / 20) * 20 : x;
                  const sy = snap ? Math.round(y / 20) * 20 : y;
                  setRoomDraw((r) => ({ points: [...r.points, { x: sx, y: sy }], cursor: { x: sx, y: sy } }));
                  return;
                }
                if (tool === 'annotate') {
                  // Pass 2D.1 / 2D.2 — drop a note or callout at the click.
                  placeAnnotation(x, y);
                  setTool('select');
                  return;
                }
                if (tool === 'calibrate') {
                  // First click sets point A, second sets point B. After
                  // B is set, CalibrationApplyPanel surfaces so the user
                  // enters the real-world distance and applies. A third
                  // click while B exists resets to a fresh A — feels
                  // right when the user realises they mis-clicked.
                  setCalibrate((c) => {
                    if (!c.a)   return { a: { x, y }, b: null, cursor: { x, y } };
                    if (!c.b)   return { a: c.a, b: { x, y }, cursor: { x, y } };
                    return { a: { x, y }, b: null, cursor: { x, y } };
                  });
                  return;
                }
              }}
              onSurfaceMove={(x, y) => {
                if (tool === 'wall') {
                  const sx = snap ? Math.round(x / 20) * 20 : x;
                  const sy = snap ? Math.round(y / 20) * 20 : y;
                  setWallCursor({ x: sx, y: sy });
                  return;
                }
                if (tool === 'measure' && measure.start && !measure.end) {
                  setMeasure((m) => ({ ...m, cursor: { x, y } }));
                  return;
                }
                if ((tool === 'cable' || tool === 'conduit' || tool === 'pathway') && cableDraw.points.length > 0) {
                  setCableDraw((c) => ({ ...c, cursor: { x, y } }));
                  return;
                }
                if (tool === 'room' && roomDraw.points.length > 0) {
                  const sx = snap ? Math.round(x / 20) * 20 : x;
                  const sy = snap ? Math.round(y / 20) * 20 : y;
                  setRoomDraw((r) => ({ ...r, cursor: { x: sx, y: sy } }));
                  return;
                }
                if (tool === 'calibrate' && calibrate.a && !calibrate.b) {
                  // Live rubber-band line from A to the cursor before the
                  // user nails point B.
                  setCalibrate((c) => ({ ...c, cursor: { x, y } }));
                  return;
                }
              }}
              onSurfaceDblClick={() => {
                // Finish the in-flight drawing AND drop back to Select so
                // the next blank-canvas click doesn't accidentally start a
                // fresh chain. finishCableDraw already calls setTool('select')
                // internally; wall + measure handle the transition here.
                if (tool === 'wall') {
                  setWallStart(null);
                  setWallCursor(null);
                  setTool('select');
                }
                if (tool === 'measure') {
                  setMeasure({ start: null, end: null, cursor: null });
                  setTool('select');
                }
                if (tool === 'cable' || tool === 'conduit' || tool === 'pathway') finishCableDraw();
                if (tool === 'room') finishRoomDraw();
              }}
              onSurfaceContextMenu={(e) => {
                // Right-click cancels any in-flight drawing tool — same
                // contract as Esc + the banner's Cancel button. Scope the
                // preventDefault to drawing tools so right-click stays
                // free for normal browser behavior when the user is just
                // selecting / panning (the previous pass consumed it
                // unconditionally, which broke "Inspect element" and any
                // future custom right-click affordance).
                const isDrawing =
                  tool === 'wall' || tool === 'measure'
                  || tool === 'cable' || tool === 'conduit' || tool === 'pathway'
                  || tool === 'calibrate';
                if (!isDrawing) return;
                e.preventDefault();
                if (tool === 'wall') {
                  setWallStart(null);
                  setWallCursor(null);
                  setTool('select');
                } else if (tool === 'measure') {
                  setMeasure({ start: null, end: null, cursor: null });
                  setTool('select');
                } else if (tool === 'cable' || tool === 'conduit' || tool === 'pathway') {
                  setCableDraw((c) => ({ points: [], cursor: null, cableType: c.cableType }));
                  setTool('select');
                } else if (tool === 'calibrate') {
                  resetCalibrate();
                  setTool('select');
                }
              }}
              measure={measure}
              calibrate={calibrate}
              cableDraw={cableDraw}
            />
            </CanvasErrorBoundary>

            {/* V1 2B.5 — harden hint overlay. Surfaces when the
                operator clicked "Harden on canvas" on a Threat
                Simulator breakdown row. Clears on first placed
                device or on X. */}
            {hardenHint && (
              <div className="absolute left-1/2 top-3 -translate-x-1/2 z-20 max-w-[420px] inline-flex items-start gap-2 px-3 py-2 rounded-lg border border-primary/40 bg-card shadow-[var(--shadow-floating)]" data-testid="canvas-harden-hint">
                <span className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary">
                  <Sparkles className="w-3 h-3" />
                </span>
                <div className="flex-1 min-w-0 text-[12px] text-foreground leading-snug">
                  <div className="font-medium text-[11px]">Threat Simulator suggested fix</div>
                  <div className="text-muted-foreground">{hardenHint.label}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5 tabular-nums">
                    Anchor: ({Math.round(hardenHint.at.x)}, {Math.round(hardenHint.at.y)})
                  </div>
                </div>
                <button
                  onClick={() => setHardenHint(null)}
                  className="text-muted-foreground hover:text-foreground"
                  title="Dismiss the hint"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Empty canvas state: surfaces a prominent dropzone when
                the current floor has no plan AND no devices/walls yet.
                Hides as soon as the user starts placing things. */}
            {!floorBackground && devices.length === 0 && allWalls.length === 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <div className="rounded-2xl border border-dashed border-border bg-card/85 backdrop-blur-sm px-8 py-7 max-w-md text-center pointer-events-auto shadow-[var(--shadow-low)]">
                  <div className="w-12 h-12 rounded-xl bg-secondary/60 inline-flex items-center justify-center mb-4">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <h2 className="text-[16px] font-medium mb-1">Drop or upload a floor plan to begin</h2>
                  <p className="text-[12px] text-muted-foreground leading-snug mb-4">
                    Upload a PDF, image, or sketch. We'll calibrate the scale and you can start placing devices in minutes.
                  </p>
                  <div className="flex items-center gap-2 justify-center">
                    <button
                      onClick={() => setScanBuildOpen(true)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Upload className="w-3.5 h-3.5" />Upload plan
                    </button>
                    <button
                      onClick={() => useProjectStore.getState().resetDemoData()}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] border border-border hover:bg-secondary/40 text-foreground"
                    >
                      Use sample plan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* The canvas is intentionally calm by default. The previous
                CoverageModeSwitch (top-left) and ImmersionControls (top-
                right) floats were removed — coverage style and focus mode
                now live inside the Layers panel where they belong, so the
                blueprint can dominate the eye. Intelligence chips remain
                as the single contextual overlay (top-right) and default
                to off. */}
            <IntelligenceLayer
              devices={devices.filter((d) => !hiddenIds.has(d.id))}
              pxToFt={currentFloorPxToFt}
              zoom={zoom}
              open={intelOpen}
              setOpen={setIntelOpen}
              setZoom={(z) => { setZoom(z); userTouchedViewRef.current = true; }}
              onFit={() => { applyFit(); userTouchedViewRef.current = false; }}
              onActual={() => { applyActualScale(); userTouchedViewRef.current = true; }}
            />

            {/* Floating selection toolbar */}
            {/* Audit Group C.6 — SelectionPill removed from the canvas
                because the docked drawer (rendered below) now carries
                the same identity strip + edit actions, AND the pill
                was previously docking at canvas-bottom where the new
                drawer lives. The selection ring drawn on the device
                glyph itself remains the at-device selection signal. */}
            {/* SelectionPill removed in M7. The compact icon strip
                (CanvasSelectionMenu, mounted below) replaces it. The
                dead `{false && ...}` block that was previously here
                guarded an overlay that has not been part of the
                interaction model since Audit Group C.6. */}

            {/* Tool status banner — wall / measure / cable draw modes get
                a visible top-center indicator with explicit Done and Cancel
                buttons so the user always knows the canvas is in a
                drawing mode and has a one-click exit. Hidden when no
                drawing tool is engaged. */}
            {(() => {
              const isWall      = tool === 'wall';
              const isMeasure   = tool === 'measure';
              const isCable     = tool === 'cable' || tool === 'conduit' || tool === 'pathway';
              const isCalibrate = tool === 'calibrate';
              // The Calibrate apply panel renders its own UI once both
              // points exist; suppress the banner there to avoid stacking
              // two surfaces on top of each other.
              const suppressForCalibrateApply = isCalibrate && calibrate.a && calibrate.b;
              if ((!isWall && !isMeasure && !isCable && !isCalibrate) || suppressForCalibrateApply) return null;
              const wallSegments = allWalls.length;
              const measurePhase: 'idle' | 'awaiting-end' | 'locked' =
                !measure.start ? 'idle' : !measure.end ? 'awaiting-end' : 'locked';
              let title = '';
              let subtitle = '';
              let canFinish = false;
              if (isWall) {
                title = wallStart ? 'Drawing walls' : 'Wall tool';
                subtitle = wallStart
                  ? `${wallSegments} segment${wallSegments === 1 ? '' : 's'} so far · click next vertex · Enter or double-click to finish`
                  : `Click on the plan to start a wall chain · ${wallSegments} placed`;
                canFinish = !!wallStart;
              } else if (isMeasure) {
                title = 'Measure';
                if (measurePhase === 'idle')          subtitle = 'Click the first point on the plan';
                if (measurePhase === 'awaiting-end')  subtitle = 'Click the second point to lock the distance · Esc cancels';
                if (measurePhase === 'locked')        subtitle = 'Distance locked · click again to remeasure · Clear to reset';
                canFinish = measurePhase === 'locked';
              } else if (isCable) {
                title = tool === 'cable' ? 'Drawing cable' : tool === 'conduit' ? 'Drawing conduit' : 'Drawing pathway';
                const n = cableDraw.points.length;
                subtitle = n === 0
                  ? 'Click the first vertex'
                  : `${n} vertex${n === 1 ? '' : 'es'} · click to add · Enter or double-click to finish · Esc cancels`;
                canFinish = n >= 2;
              } else if (isCalibrate) {
                title = 'Set scale';
                subtitle = !calibrate.a
                  ? 'Click point A on a known feature (door width, parking stall, etc.)'
                  : 'Click point B at the other end of that feature · Esc cancels';
                canFinish = false;
              }
              const onFinish = () => {
                // Finish drops out of the drawing tool back to Select for
                // EVERY tool, so the banner disappears and the next canvas
                // click doesn't accidentally extend the chain. Cable
                // already returns to Select inside finishCableDraw.
                if (isWall) {
                  setWallStart(null);
                  setWallCursor(null);
                  setTool('select');
                }
                if (isMeasure) {
                  setMeasure({ start: null, end: null, cursor: null });
                  setTool('select');
                }
                if (isCable) finishCableDraw();
              };
              const onCancel = () => {
                if (isWall) { setWallStart(null); setWallCursor(null); }
                if (isMeasure) setMeasure({ start: null, end: null, cursor: null });
                if (isCable) setCableDraw({ points: [], cursor: null, cableType: cableDraw.cableType });
                if (isCalibrate) resetCalibrate();
                setTool('select');
              };
              return (
                <div
                  className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3"
                  data-testid="tool-status-banner"
                  data-tool={tool}
                  style={{
                    background: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '6px 10px 6px 12px',
                    boxShadow: '0 4px 12px -6px rgba(0,0,0,0.25)',
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-foreground leading-tight">{title}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{subtitle}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={onFinish}
                      disabled={!canFinish}
                      data-testid="tool-status-done"
                      className="text-[10px] uppercase tracking-[0.10em] rounded px-2 py-0.5 border border-border bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={isWall ? 'Finish wall chain (Enter)' : isMeasure ? 'Clear measurement' : 'Finish run (Enter)'}
                    >
                      Done
                    </button>
                    <button
                      onClick={onCancel}
                      data-testid="tool-status-cancel"
                      className="text-[10px] uppercase tracking-[0.10em] rounded px-2 py-0.5 border border-border text-muted-foreground hover:text-foreground"
                      title="Cancel and return to Select (Esc)"
                    >
                      Cancel (Esc)
                    </button>
                    {/* Pass 1.8 — measurements show/hide + clear all.
                        Only render when the measure tool is active AND
                        there are persisted measurements to act on. */}
                    {isMeasure && persistedMeasurements.length > 0 && (
                      <>
                        <button
                          onClick={() => setMeasurementsVisible((v) => !v)}
                          className="text-[10px] uppercase tracking-[0.10em] rounded px-2 py-0.5 border border-border text-muted-foreground hover:text-foreground"
                          title={measurementsVisible ? 'Hide all persisted measurements' : 'Show persisted measurements'}
                        >
                          {measurementsVisible ? 'Hide all' : 'Show all'}
                        </button>
                        <button
                          onClick={() => {
                            if (currentFloorId) clearMeasurementsForFloor(currentFloorId);
                            toast.message(`Cleared ${persistedMeasurements.length} measurement${persistedMeasurements.length === 1 ? '' : 's'}`, { duration: 1800 });
                          }}
                          className="text-[10px] uppercase tracking-[0.10em] rounded px-2 py-0.5 border border-border text-muted-foreground hover:text-foreground"
                          title="Remove every measurement on this floor"
                        >
                          Clear all
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Scale-calibration apply panel. Appears once the user has
                marked both A and B with the Calibrate tool — asks for
                the real-world distance and applies it to the active
                floor. Closes by Apply, Cancel, or Esc. Lives in the
                same overlay layer as armed-placement and tool-status
                banners so all three feel consistent. */}
            {tool === 'calibrate' && calibrate.a && calibrate.b && (
              <div
                className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-[320px]"
                data-testid="calibrate-apply-panel"
                style={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  boxShadow: '0 12px 28px -12px rgba(0,0,0,0.55)',
                }}
              >
                <div className="px-3 pt-3 pb-2 border-b border-border/60 flex items-center gap-2">
                  <Ruler className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[12px] font-medium tracking-tight text-foreground">Set scale</span>
                  <span className="ml-auto text-[10px] uppercase tracking-[0.10em] text-muted-foreground">
                    {Math.round(Math.hypot(calibrate.b.x - calibrate.a.x, calibrate.b.y - calibrate.a.y))} px
                  </span>
                </div>
                <div className="px-3 py-3 space-y-2">
                  <div className="text-[11px] text-muted-foreground leading-snug">
                    How long is the line you just drew, in real-world feet?
                    Example: a single door is usually 3 ft.
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      autoFocus
                      value={calibrateFt}
                      onChange={(e) => setCalibrateFt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = parseFloat(calibrateFt);
                          if (v > 0) applyCalibration(v);
                        }
                        if (e.key === 'Escape') {
                          resetCalibrate();
                          setTool('select');
                        }
                      }}
                      placeholder="e.g. 3"
                      data-testid="calibrate-feet-input"
                      className="flex-1 h-8 px-2 rounded border border-border bg-background text-[12px] tabular-nums text-foreground focus:outline-none focus:border-primary/60"
                    />
                    <span className="text-[11px] text-muted-foreground">ft</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      onClick={() => { resetCalibrate(); setTool('select'); }}
                      data-testid="calibrate-cancel"
                      className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
                    >
                      Cancel (Esc)
                    </button>
                    <button
                      onClick={() => {
                        const v = parseFloat(calibrateFt);
                        if (v > 0) applyCalibration(v);
                      }}
                      disabled={!(parseFloat(calibrateFt) > 0)}
                      data-testid="calibrate-apply"
                      className="text-[10px] uppercase tracking-[0.10em] text-primary-foreground bg-primary rounded px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Apply scale
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Click-to-arm placement banner — visible state for the user
                so they always know what the next canvas click will do. */}
            {armedProduct && (
              <div
                className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2"
                data-testid="armed-placement-banner"
                style={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '6px 10px 6px 12px',
                  boxShadow: '0 6px 20px -6px rgba(0,0,0,0.4)',
                }}
              >
                <span className="text-[11px] text-foreground">
                  Click canvas to place <span className="font-medium">{armedProduct.mfr} {armedProduct.model}</span>.
                </span>
                <button
                  onClick={() => { setArmedProduct(null); toast.message('Placement cancelled', { duration: 2000 }); }}
                  className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5"
                  data-testid="armed-placement-cancel"
                >
                  Cancel (Esc)
                </button>
              </div>
            )}

            {/* DV Assist Phase 1 panel — always present on the canvas
                surface as the bottom right pill. Three operating modes
                (Passive / Suggestion / Action). Default Passive — quiet
                until the operator switches. */}
            <AssistantPanel projectId={projectId} />

            {/* Audit Group C.6 — docked edit panel. The drawer mounts
                here as an absolute panel above the bottom tray. Auto-
                opens on selection so the user sees the controls without
                a second Edit click; the right side of the canvas stays
                clear. The PathwayDrawer follows the same anchor. The
                panel caps at 56 vh to keep the canvas visible behind
                it. */}
            {/* Audit follow-up — panel position. Left edge was at left-3
                (12 px from canvas left) which sat UNDER the left tool
                rail at left-3 with width ~44 px, clipping the panel
                title. Right edge at right-3 ran into the floor-badge
                strip also at right-3 (width ~44 px). Anchored now to
                left-[72px] (clears the left rail), right-[60px] (clears
                the floor-badge), and bottom-[68px] (still sits above
                the bottom toolbar). */}
            {/* M7 — compact icon strip above the bottom toolbar. Replaces
                the legacy EditDrawer (editOpen / editExpanded) that
                covered the canvas. The strip never covers the canvas;
                its section panel is capped at 320 x 360 px / 40 vh
                and only opens on icon click. */}
            {sel && (
              <CanvasErrorBoundary label="SelectionMenu">
                <CanvasSelectionMenu
                  device={sel}
                  bottomBarOffsetPx={72}
                  onUpdate={updateSel}
                  onDuplicate={duplicateSel}
                  onDelete={deleteSel}
                  onClose={() => setSelId(null)}
                  activeLens={activeLens}
                  setActiveLens={setActiveLens}
                />
              </CanvasErrorBoundary>
            )}
            {selPathwayId && (
              <div
                className="absolute left-[72px] right-[60px] z-30 pointer-events-auto"
                style={{ bottom: '68px' }}
              >
                <PathwayDrawer
                  pathwayId={selPathwayId}
                  onClose={() => setSelPathwayId(null)}
                  onOpenBundle={(bid) => { setSelPathwayId(null); setBundleInspectorId(bid); }}
                />
              </div>
            )}

            {/* ITEM 1 — right inspector drawer moved out of the canvas
                region. It now mounts as a flex-row sibling next to the
                canvas (see the dedicated drawer column after the canvas
                region closes below), so opening the inspector SHRINKS
                the canvas to the remaining width instead of covering
                content. The hover icon rails (left + right) still
                float over the canvas — Pass A behavior unchanged. */}
            {canvasBomOpen && (
              <ProjectBomDrawer
                projectId={projectId}
                onClose={() => setCanvasBomOpen(false)}
                onSelectDevice={(id) => {
                  setSelId(id);
                  setSelPathwayId(null);
                  setCanvasBomOpen(false);
                  setEditOpen(true);
                }}
                onSelectPathway={(id) => {
                  setSelPathwayId(id);
                  setSelId(null);
                  setCanvasBomOpen(false);
                }}
              />
            )}
            {/* PathwayDrawer also moved to the docked drawer column
                below — same shrink-the-canvas behavior. */}

            {/* Target simulation overlay removed per DEFECT FIX
                (2026-05-24). The DORI bands shipped in V3 Pass 2 Part 2
                already render honest coverage grades on the cone; the
                draggable stick figure was a vestigial control that
                couldn't drive anything actionable. A real subject preview
                ships as a separate honest feature in a later pass. */}

            {/* Floating status indicator (top-center) */}
            <StatusBar tool={tool} zoom={zoom} counts={counts} units={units} />

            {/* Black drawing-tool rail — left side of the canvas pane.
                Tools only (no devices). Always visible in Default + Field;
                in Canvas mode a small reopener takes its place. */}
            {viewMode !== 'canvas' && (
              /* M4 — UNIFIED LEFT RAIL. Tools / View / Zoom in one
                 container. Replaces DrawingToolRail (top-left) +
                 IntelligenceRail (bottom-left). No more hardcoded
                 top-[480px] offset; the three groups flex naturally
                 inside one rail with subtle separators between them.
                 zoom-in is now physically present in the same column
                 as the other zoom controls — the earlier missing-
                 zoom-in regression cannot recur. */
              <CanvasLeftRail
                tool={tool} setTool={setTool}
                snap={snap} setSnap={setSnap}
                layersOpen={layersOpen} onToggleLayers={() => setLayersOpen((v) => !v)}
                mapOpen={scanBuildOpen} onToggleMap={() => setScanBuildOpen((v) => !v)}
                coverageMode={coverageMode} setCoverageMode={setCoverageMode}
                chipsOpen={intelOpen} setChipsOpen={setIntelOpen}
                zoom={zoom}
                setZoom={(z) => { setZoom(z); userTouchedViewRef.current = true; }}
                onFit={() => { applyFit();   userTouchedViewRef.current = false; }}
                onActual={() => { applyActualScale(); userTouchedViewRef.current = true; }}
              />
            )}
            {viewMode === 'canvas' && (
              <button
                onClick={() => setViewMode('default')}
                data-track="canvas-reopen-tools"
                title="Reopen tools"
                className="absolute left-3 top-12 z-30 w-9 h-9 rounded-lg bg-black/85 text-white border border-white/15 backdrop-blur-md flex items-center justify-center hover:bg-black/95"
              >
                <PencilRuler className="w-4 h-4" />
              </button>
            )}

            {/* BottomDeviceBar moved out of the absolute overlay set;
                it now sits as a docked flex sibling beneath the inner
                viewport (see end of this column). */}
            {viewMode === 'canvas' && (
              <button
                onClick={() => setViewMode('default')}
                data-track="canvas-reopen-devices"
                title="Reopen devices"
                className="absolute left-1/2 -translate-x-1/2 bottom-3 z-30 inline-flex items-center gap-2 h-9 px-3 rounded-full bg-black/85 text-white border border-white/15 backdrop-blur-md hover:bg-black/95"
              >
                <Plus className="w-3.5 h-3.5" /> Devices
              </button>
            )}

            {/* Select-by menu — always available compact picker that lets
                the user multi-select by floor or by type without
                shift-clicking each device. Sits at the top-left of the
                canvas where the user can reach it before they have a
                bundle to act on. */}
            {viewMode !== 'canvas' && (
              <SelectByMenu
                devices={devices.filter((d) => !hiddenIds.has(d.id))}
                onPick={(ids) => { setSelIds(new Set(ids)); setSelId(ids[0] ?? null); setSelPathwayId(null); }}
              />
            )}

            {/* Canvas V2 Pass 1.9 — Cmd K search + command bar */}
            {cmdKOpen && (
              <CmdKOverlay
                devices={devices}
                pathways={Object.values(useProjectStore.getState().pathways) as any[]}
                idfs={[]}
                onClose={() => setCmdKOpen(false)}
                onSelectDevice={(id, x, y) => {
                  setSelId(id);
                  setSelPathwayId(null);
                  centerOnPoint(x, y);
                }}
                commands={[
                  { id: 'sel-cam', label: 'Select all cameras',  hint: 'Replaces selection', run: () => { const list = devices.filter((d) => TYPE_KIND[d.type] === 'camera'); setSelIds(new Set(list.map((d) => d.id))); if (list[0]) setSelId(list[0].id); toast.message(`Selected ${list.length} cameras`, { duration: 1800 }); } },
                  { id: 'sel-door', label: 'Select all doors',   hint: 'Replaces selection', run: () => { const list = devices.filter((d) => isStackableHost(d.type)); setSelIds(new Set(list.map((d) => d.id))); if (list[0]) setSelId(list[0].id); toast.message(`Selected ${list.length} doors`, { duration: 1800 }); } },
                  { id: 'sel-readers', label: 'Select all readers', hint: 'Replaces selection', run: () => { const list = devices.filter((d) => d.type === 'acc.reader' || d.type === 'acc.biometric' || d.type === 'acc.keypad'); setSelIds(new Set(list.map((d) => d.id))); if (list[0]) setSelId(list[0].id); toast.message(`Selected ${list.length} readers`, { duration: 1800 }); } },
                  { id: 'fit',     label: 'Fit to view',         hint: 'F',  run: () => { applyFit(); userTouchedViewRef.current = false; } },
                  { id: 'center',  label: 'Centre on devices',   hint: 'C',  run: () => { applyCenter(); userTouchedViewRef.current = true; } },
                  { id: 'toggle-measurements', label: measurementsVisible ? 'Hide measurements' : 'Show measurements', run: () => setMeasurementsVisible((v) => !v) },
                  { id: 'toggle-layers', label: 'Toggle layers panel', run: () => setLayersOpen((v) => !v) },
                  { id: 'undo', label: 'Undo', hint: '⌘Z', run: () => { const popped = useProjectStore.getState().canvasUndo(); if (popped) toast.message(`Undo: ${popped.label}`, { duration: 1800 }); } },
                  { id: 'redo', label: 'Redo', hint: '⇧⌘Z', run: () => { const popped = useProjectStore.getState().canvasRedo(); if (popped) toast.message(`Redo: ${popped.label}`, { duration: 1800 }); } },
                  { id: 'detect-rooms', label: 'Detect rooms from walls', hint: 'Adds closed rectangles', run: () => detectRoomsFromWallsRef.current() },
                ]}
              />
            )}

            {/* Group toolbar — appears when 2+ devices are selected via
                shift-click. Right side at the top of the canvas. Carries
                the multi-device commands (Run to IDF, clear selection). */}
            {/* Canvas V2 Pass 2B.4 — coverage stats. Auto shows when
                the heatmap layer is on; chrome stays calm otherwise. */}
            {layers.heatmap && coverageGrid && (
              <CoverageStatsPanel grid={coverageGrid as any} />
            )}

            {/* Canvas V2 Pass 2C.3 — room inspector. Opens when a room
                polygon is clicked; lets the operator name it, set
                description, occupancy, sensitivity, and delete. */}
            {selRoomId && roomsMap[selRoomId] && (
              <RoomInspector
                room={roomsMap[selRoomId]}
                pxToFt={currentFloorPxToFt}
                onPatch={(patch) => updateRoom(selRoomId, patch)}
                onDelete={() => {
                  pushCanvasHistory(`Removed ${roomsMap[selRoomId]?.name ?? 'room'}`, ['rooms']);
                  useProjectStore.getState().removeRoom(selRoomId);
                  setSelRoomId(null);
                }}
                onClose={() => setSelRoomId(null)}
              />
            )}

            {/* Canvas V2 Pass 2A.7 — multi floor overview toggle.
                Floating chip top right. Hidden in canvas mode (already
                immersive). Shown only when there are 2+ floors on the
                project so single floor projects do not get noise. */}
            {viewMode !== 'canvas' && !overviewOpen && projectFloors.length >= 2 && (
              <button
                onClick={() => setOverviewOpen(true)}
                title="Multi floor overview (⌘⇧O)"
                data-track="canvas-overview-open"
                className="absolute right-3 top-3 z-30 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border border-border bg-card/95 backdrop-blur-md text-foreground hover:bg-secondary/40"
              >
                <Columns3 className="w-3.5 h-3.5 text-muted-foreground" />
                Overview
              </button>
            )}

            {selIds.size >= 2 && viewMode !== 'canvas' && (
              <div
                className="absolute z-30 left-1/2 -translate-x-1/2 top-3 inline-flex items-stretch h-9 rounded-xl border bg-card/95 backdrop-blur-xl shadow-[var(--shadow-medium)] overflow-hidden"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="px-3 inline-flex items-center text-[11px] tabular-nums text-foreground border-r border-border/60">
                  <span className="font-medium">{selIds.size}</span><span className="text-muted-foreground ml-1">selected</span>
                </div>
                {/* Canvas V2 Pass 1.5 — alignment + distribute. One click
                    per axis. Distribute needs ≥3 selected so we hide
                    those two buttons below the threshold. Single grouped
                    undo because each helper calls setDevices once. */}
                <button onClick={() => alignSelection('left')}     title="Align left edges"           className="px-1.5 inline-flex items-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-r border-border/60"><AlignStartVertical className="w-3.5 h-3.5" /></button>
                <button onClick={() => alignSelection('center-h')} title="Align horizontal centres"   className="px-1.5 inline-flex items-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-r border-border/60"><AlignCenterVertical className="w-3.5 h-3.5" /></button>
                <button onClick={() => alignSelection('right')}    title="Align right edges"          className="px-1.5 inline-flex items-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-r border-border/60"><AlignEndVertical className="w-3.5 h-3.5" /></button>
                <button onClick={() => alignSelection('top')}      title="Align top edges"            className="px-1.5 inline-flex items-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-r border-border/60"><AlignStartHorizontal className="w-3.5 h-3.5" /></button>
                <button onClick={() => alignSelection('center-v')} title="Align vertical centres"     className="px-1.5 inline-flex items-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-r border-border/60"><AlignCenterHorizontal className="w-3.5 h-3.5" /></button>
                <button onClick={() => alignSelection('bottom')}   title="Align bottom edges"         className="px-1.5 inline-flex items-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-r border-border/60"><AlignEndHorizontal className="w-3.5 h-3.5" /></button>
                {selIds.size >= 3 && (
                  <>
                    <button onClick={() => distributeSelection('h')} title="Distribute horizontally" className="px-1.5 inline-flex items-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-r border-border/60"><AlignHorizontalSpaceAround className="w-3.5 h-3.5" /></button>
                    <button onClick={() => distributeSelection('v')} title="Distribute vertically"   className="px-1.5 inline-flex items-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-r border-border/60"><AlignVerticalSpaceAround className="w-3.5 h-3.5" /></button>
                  </>
                )}
                <button
                  onClick={() => setRunToIdfOpen(true)}
                  data-track="multi-run-to-idf"
                  title="Create cable runs from each selected device to a chosen IDF"
                  className="px-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:bg-primary/10 transition-colors border-r border-border/60"
                >
                  <Cable className="w-3.5 h-3.5" />Run to IDF
                </button>
                <button
                  onClick={() => { setSelIds(new Set()); setSelId(null); }}
                  data-track="multi-clear"
                  title="Clear selection"
                  className="px-3 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />Clear
                </button>
              </div>
            )}

            {/* Floating Add FAB — the canvas-side entry into the device
                library. Audit follow-up: was at `bottom-20 right-5` which
                overlapped the floor badge (right-3 / w=44) and the new
                docked edit panel. Moved to `top-[120px] right-3` so it
                sits cleanly in the cleared right-side space (intel rail
                moved away in Group C.5), under the Overview button, and
                clear of the floor badge, DV Assist trigger, and the
                docked edit panel — at every panel height. */}
            {viewMode !== 'canvas' && (dockCollapsed || viewMode === 'field') && (
              <button
                onClick={() => {
                  if (viewMode === 'field') setViewMode('default');
                  setDockCollapsed(false);
                  setNavSection('devices');
                }}
                data-track="canvas-add-fab"
                title="Add device · open library"
                className="absolute z-30 top-[120px] right-3 h-12 w-12 rounded-full hidden md:flex items-center justify-center text-white bg-primary hover:bg-primary/90 transition-colors shadow-[0_2px_4px_-1px_rgba(0,0,0,0.18),0_12px_28px_-12px_rgba(0,0,0,0.45)] focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <Plus className="w-5 h-5" strokeWidth={2.2} />
              </button>
            )}

            {/* Cable type picker — appears next to the QuickTools strip when
                the cable tool is active. Lets the engineer pick the cable
                type BEFORE drawing the route. The selected type lands on the
                Pathway record so BOM and pathway routing both pick it up. */}
            {tool === 'cable' && (
              <CableTypePicker
                value={cableDraw.cableType}
                onChange={(t) => setCableDraw((c) => ({ ...c, cableType: t }))}
              />
            )}

            {/* Imported floorplan controls — opacity, scale, rotation, lock,
                remove. Appears top-left whenever the active floor has an
                imported background image. Persists everything through the
                store. */}
            {floorBackground && currentFloorId && (
              <FloorplanBackgroundControls
                bg={floorBackground}
                onPatch={(patch) => {
                  pushCanvasHistory('Adjusted floor background', ['floors'], 'bg-edit');
                  useProjectStore.getState().setFloorBackground(currentFloorId, { ...floorBackground, ...patch });
                }}
                onRemove={() => {
                  pushCanvasHistory('Removed floor background', ['floors']);
                  useProjectStore.getState().setFloorBackground(currentFloorId, null);
                }}
              />
            )}

            {/* Item 3 — bottom-left ZoomDock removed; zoom controls
                now live in the right rail with the current % stamped on
                the center tile. ZoomDock component definition kept in
                this file in case a future surface (e.g. PresentMode)
                wants the floating capsule back. */}

            {/* Minimap (bottom-right) — V1 1A.4 now shows real plan
                extents (background + walls + devices) instead of the
                seed 800x600 rectangle, and uses theme tokens.
                Pass 2A.8 — when the project has multiple floors, a
                small floor strip renders to the LEFT of the minimap
                for one click floor switching. */}
            {projectFloors.length > 1 && (
              <MiniMapFloorStrip
                projectId={projectId}
                activeFloorId={currentFloorId}
                onPickFloor={(fid) => setCurrentFloorIdForProject(projectId, fid)}
              />
            )}
            <MiniMap devices={devices} walls={allWalls} background={floorBackground ?? null} />

            {/* Audit Group D.7 (second pass) — the static North compass
                used to live here. It was decorative: canvas-up was
                always "north" by convention, the dial never rotated
                with plan orientation, and the underlying floor record
                does not yet carry an orientation field. Per Mohammad's
                honesty rule "do not keep a dead control," it's removed.
                When orientation lands on the floor schema we will
                re-introduce a real compass that rotates with the plan. */}

            {/* Scale bar — honest about calibration. The default
                "20 px = 1 ft" canvas constant is a starter scale, not a
                measurement. Calibrated state is now driven by explicit
                metadata (`floor.calibratedAt`) instead of comparing to
                the seed default — a user who measured and got exactly
                0.05 ft/px is still calibrated. */}
            {(() => {
              // Both values are subscribed at the component level so the
              // scale bar re-renders whenever the floor's scale or its
              // calibration marker changes.
              const isCalibrated = !!currentFloorCalibratedAt;
              const ftPerPx = currentFloorPxToFt;
              const ft = Math.round(zoom * 100 * ftPerPx * 10) / 10;
              return (
                <div
                  className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 select-none hidden md:flex items-center gap-2"
                  data-testid="scale-bar"
                  data-canvas-chrome="scalebar"
                  style={{
                    background: 'var(--canvas-rail)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid var(--canvas-rail-border)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    boxShadow: 'var(--shadow-rail), inset 0 1px 0 rgba(255,255,255,0.05)',
                    color: 'var(--canvas-rail-foreground)',
                  }}
                  title={isCalibrated
                    ? 'Calibrated scale — derived from the floor record'
                    : 'Default scale only — click Set scale to calibrate against a known feature.'}
                >
                  <span className="tabular-nums pointer-events-none" style={{ fontSize: 'var(--chrome-xs)', color: 'var(--canvas-rail-foreground-muted)' }}>0</span>
                  <svg width={zoom * 100} height={12} className="inline-block pointer-events-none">
                    <line x1={0} y1={6} x2={zoom * 100} y2={6} stroke="var(--canvas-rail-foreground)" strokeWidth="1.4" strokeLinecap="round" />
                    <line x1={0.7} y1={1} x2={0.7} y2={11} stroke="var(--canvas-rail-foreground)" strokeWidth="1.4" strokeLinecap="round" />
                    <line x1={zoom * 100 - 0.7} y1={1} x2={zoom * 100 - 0.7} y2={11} stroke="var(--canvas-rail-foreground)" strokeWidth="1.4" strokeLinecap="round" />
                    <line x1={zoom * 25} y1={3} x2={zoom * 25} y2={9} stroke="var(--canvas-rail-foreground-muted)" strokeWidth="0.9" strokeLinecap="round" />
                    <line x1={zoom * 50} y1={2} x2={zoom * 50} y2={10} stroke="var(--canvas-rail-foreground-muted)" strokeWidth="0.9" strokeLinecap="round" />
                    <line x1={zoom * 75} y1={3} x2={zoom * 75} y2={9} stroke="var(--canvas-rail-foreground-muted)" strokeWidth="0.9" strokeLinecap="round" />
                  </svg>
                  <span className="tabular-nums pointer-events-none font-medium" style={{ fontSize: 'var(--chrome-xs)', color: 'var(--canvas-rail-foreground)' }}>{ft} ft</span>
                  {isCalibrated ? (
                    // V1 1A.5 — Verified badge is now a button that
                    // reopens the calibration tool. Same tool path as
                    // the initial Set scale, so the engineer can drop
                    // two new points to re-derive ft/px against a
                    // freshly measured feature.
                    <button
                      onClick={() => { resetCalibrate(); setTool('calibrate'); }}
                      title="Recalibrate against a new known feature"
                      data-testid="scale-verified-badge"
                      className="uppercase ml-1 px-2 py-0.5 rounded-md border border-emerald-400/35 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/22 transition-colors font-medium"
                      style={{ fontSize: 'var(--chrome-2xs)', letterSpacing: '0.10em' }}
                    >
                      Verified
                    </button>
                  ) : (
                    <>
                      <span className="uppercase ml-1 pointer-events-none font-medium" style={{ fontSize: 'var(--chrome-2xs)', letterSpacing: '0.10em', color: '#FBBF24' }}>Default scale</span>
                      <button
                        onClick={() => { resetCalibrate(); setTool('calibrate'); }}
                        title="Click two points on a known feature, then enter its real length"
                        data-testid="scale-set-btn"
                        className="uppercase ml-1 px-2 py-0.5 rounded-md border border-primary/45 bg-primary/15 text-primary hover:bg-primary/22 font-medium"
                        style={{ fontSize: 'var(--chrome-2xs)', letterSpacing: '0.10em' }}
                      >
                        Set scale
                      </button>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Build stamp (bottom-left, just above ZoomDock). Discreet so it
                never competes with controls but verifiable so the user can
                confirm the live deployment matches the latest commit. */}
            <div
              className="absolute bottom-1 left-1 z-20 pointer-events-none select-none text-[9px] tabular-nums text-muted-foreground/40 font-mono tracking-tight"
              title={`Build ${buildLabel()}`}
            >
              {COMMIT_HASH} · {buildLabel().split('·').slice(-1)[0].trim()}
            </div>

            {/* Drag ghost. M6 — display:none while an HTML5 drag is in
                flight so the browser's native ghost doesn't race with
                this legacy React ghost. The legacy path remains for
                arm-to-click placement (a short release with no drag),
                which still uses this ghost preview. */}
            {drag && (
              <div className="pointer-events-none absolute z-50" style={{ left: drag.x - 16, top: drag.y - 16, display: htmlDragInFlight ? 'none' : undefined }}>
                <div className="w-8 h-8 rounded-full bg-card border border-primary flex items-center justify-center shadow-lg">
                  <DeviceGlyph type={drag.product.type} size={20} />
                </div>
                <div className="mt-1.5 text-[11px] text-center bg-card border border-border rounded px-1.5 py-0.5 text-foreground whitespace-nowrap">
                  Drop to place
                </div>
              </div>
            )}
            {/* Item 1 — floating bottom toolbar. Lives back inside the
                inner viewport as an absolutely-positioned overlay over
                the canvas (the left rail's twin), so the plan extends
                beneath it instead of ending at a white docked band. */}
            {viewMode !== 'canvas' && (
              <BottomDeviceBar
                onStartDrag={(p, e) => {
                  setArmedProduct(null);
                  dragStartRef.current = { x: e.clientX, y: e.clientY };
                  setDrag({ product: p, x: e.clientX, y: e.clientY });
                }}
                onPickTool={(t) => setTool(t)}
                onPickCableType={(id) => { drawModeRef.current = { kind: 'cable' }; setCableDraw((c) => ({ ...c, cableType: id })); setTool('cable'); toast.message('Cable tool armed', { description: `Click vertices on the plan. Double-click or Enter to finish.`, duration: 4000 }); }}
                onPickConduit={(type, size) => { drawModeRef.current = { kind: 'conduit', pathwayKind: 'conduit', conduitType: type, conduitSize: size }; setTool('conduit'); toast.message('Conduit tool armed', { description: `${type} ${size ?? ''} · click vertices on the plan. Double-click or Enter to finish.`, duration: 4500 }); }}
                onPickPathway={(kind, label) => { drawModeRef.current = { kind: 'pathway', pathwayKind: kind }; setTool('pathway'); toast.message('Pathway tool armed', { description: `${label} · click vertices on the plan. Double-click or Enter to finish.`, duration: 4500 }); }}
                tool={tool}
              />
            )}
            </div>
          </div>

          {/* Audit Group C.6 — drawer no longer lives in the canvas
              flex row. It now docks ABOVE the bottom tray as an
              absolute-positioned panel, full canvas width minus
              insets, capped at 56 vh so the canvas stays visible.
              The PathwayDrawer follows the same bottom-dock pattern
              for the same reasons. */}
        </div>

        {!onboarded && (
          <Onboarding
            onPick={(s) => { setPlanSource(s); setOnboarded(true); }}
            onClose={() => setOnboarded(true)}
          />
        )}
        {reportOpen && (
          <ReportBuilderDialog
            onClose={() => setReportOpen(false)}
            devices={devices}
            projectId={projectId}
            pxToFt={currentFloorPxToFt}
          />
        )}
        {bundleInspectorId && (
          <BundleInspectorDialog
            bundleId={bundleInspectorId}
            onClose={() => setBundleInspectorId(null)}
          />
        )}
        {runToIdfOpen && (
          <RunToIdfDialog
            onClose={() => setRunToIdfOpen(false)}
            selected={devices.filter((d) => selIds.has(d.id))}
            idfs={devices.filter((d) => d.type === 'net.idf' || d.type === 'net.mdf' || d.type === 'inf.rack' || d.type === 'inf.mdf')}
            projectId={projectId}
            onCreated={(bundleId, count, cableType, idfId) => {
              setRunToIdfOpen(false);
              setSelIds(new Set());
              toast.success(`Bundle created · ${count}× ${cableType} → ${idfId}`, {
                description: `Bundle ${bundleId} added to BOM. Assign conduit from the pathway inspector.`,
                duration: 5500,
              });
            }}
          />
        )}
        {scanBuildOpen && (
          <ScanBuildFloorplanDialog
            onClose={() => setScanBuildOpen(false)}
            onScanCamera={() => { setScanBuildOpen(false); nav('/visionscan'); }}
            onUpload={() => {
              // Skip the old Maps-panel detour and open the upload modal
              // directly. The modal previews the file, lets the user name
              // it, then hands control to the in-canvas Calibrate tool
              // via the "Save & set scale" CTA.
              setScanBuildOpen(false);
              setCanvasImportOpen(true);
            }}
            onSatellite={() => {
              setScanBuildOpen(false);
              setPlanSource('satellite');
              toast.message('Satellite base map active', { description: 'Trace walls over the imagery. Calibrate scale before plotting devices.', duration: 5000 });
            }}
            onDrawScratch={() => {
              setScanBuildOpen(false);
              setPlanSource('blank');
              setTool('wall');
              toast.message('Sketch mode', { description: 'Click to drop wall vertices · double-click to end a run · W toggles the wall tool.', duration: 6000 });
            }}
          />
        )}
        {canvasImportOpen && (
          <ImportFloorplanDialog
            onClose={() => setCanvasImportOpen(false)}
            onImported={() => setCanvasImportOpen(false)}
            onStartCalibrate={() => {
              // Save → hand the user to the in-canvas Calibrate tool so
              // the next click on the plan starts the two-point flow.
              setCanvasImportOpen(false);
              resetCalibrate();
              setTool('calibrate');
            }}
          />
        )}
      </div>
      </CanvasErrorBoundary>
    </AppShell>
  );
}

// Onboarding + StartCard moved to canvas/chrome/Onboarding.tsx
// (M11 monolith breakup). Import at top of file.

/* ═══════════════════════════════════════════════════════════════════════
   CMD-K SEARCH + COMMAND BAR — Canvas V2 Pass 1.9
   ═══════════════════════════════════════════════════════════════════════ */

// CoverageStatsPanel moved to canvas/chrome/CoverageStatsPanel.tsx
// (M11 monolith breakup). Import at top of file.

// RoomInspector moved to canvas/chrome/RoomInspector.tsx
// (M11 monolith breakup). Import at top of file.

// FloorOverview moved to canvas/chrome/FloorOverview.tsx
// (M11 monolith breakup). Import at top of file.

// FloorSwitcher + ManageFloorsDialog + defaultNameForLevel moved
// to canvas/chrome/FloorSwitcher.tsx (M11 monolith breakup).
// Import at top of file.

// UndoRedoButtons moved to canvas/chrome/UndoRedoButtons.tsx
// (M11 monolith breakup). Import at top of file.

// MobileActionsMenu moved to canvas/chrome/MobileActionsMenu.tsx
// (M11 monolith breakup). Import at top of file.

// TopBar moved to canvas/chrome/TopBar.tsx (M11 monolith
// breakup). Import at top of file.

// MapsPanel deleted in M11 — it was an experimental sidebar that
// shipped only its own state and was never mounted on any route.
// AddBuildingDialog / AddFloorDialog (extracted earlier to
// canvas/dialogs/) stay available for a future site manager pass.

/** Scan / Build Floorplan — the obvious four-way entry into capturing or
 *  generating a floor surface. The four options map to:
 *    1. Scan with camera   → VisionScan workflow (AR/LiDAR is honest about
 *                            being a simulated capture today).
 *    2. Upload floorplan   → ImportFloorplanDialog (PNG/JPG/PDF).
 *    3. Use satellite map  → sets baseMap to 'satellite' so the engineer
 *                            traces walls over real imagery.
 *    4. Draw from scratch  → blank surface + wall tool armed; orthogonal
 *                            snap & scale calibration available via Tools.
 *
 *  This dialog is intentionally large and editorial — Scan/Build is the
 *  most important workflow on the surveyor and the UI says so. */
/** Report Builder — the brief asks for a real builder (not a list of
 *  random export buttons). 8 report types × audience selector × content
 *  toggles → live page-count estimate → export PDF (uses the same
 *  drawReport helpers the existing rows do). */
function ReportBuilderDialog({
  onClose, devices, projectId, pxToFt,
}: { onClose: () => void; devices: Device[]; projectId: string; pxToFt: number }) {
  type ReportType = ReportKind | 'estimate';
  const TYPES: Array<{ id: ReportType; label: string; sub: string; icon: any; tone: string }> = [
    { id: 'customer',         label: 'Customer presentation', sub: 'Cover · overview · investment · timeline', icon: Sparkles,    tone: '#A371F7' },
    { id: 'engineering',      label: 'Engineering packet',    sub: 'Device schedule · BOM · cable schedule · findings', icon: FileBarChart, tone: '#5DA0E8' },
    { id: 'camera-schedule',  label: 'Camera schedule',       sub: 'Location · model · IR · mount · power',   icon: Video,       tone: '#F08F3C' },
    { id: 'door-schedule',    label: 'Door schedule',         sub: 'Openings · reader / strike / REX / DPS',  icon: DoorOpen,    tone: '#4FB87E' },
    { id: 'cable-schedule',   label: 'Cable schedule',        sub: 'Runs · cable type · length · termination', icon: Cable,      tone: '#22D3EE' },
    { id: 'conduit-schedule', label: 'Conduit schedule',      sub: 'Conduit · size · cables · fill %',         icon: PencilRuler, tone: '#A371F7' },
    { id: 'bom',              label: 'Bill of materials',     sub: 'Line items · live unit pricing',          icon: DollarSign,  tone: '#E5A23A' },
    { id: 'estimate',         label: 'Estimate',              sub: 'Customer-safe pricing summary',           icon: DollarSign,  tone: '#E5A23A' },
    { id: 'commissioning',    label: 'Commissioning report',  sub: 'Per-device install / firmware / sign-off', icon: ShieldCheck, tone: '#E55B5B' },
  ];
  const [reportType, setReportType] = useState<ReportType>('engineering');
  const [audience, setAudience] = useState<'customer' | 'internal'>('internal');
  const [include, setInclude] = useState({
    mapSnapshot:    true,
    selectedLayers: true,
    deviceTable:    true,
    bom:            true,
    notesMedia:     false,
    aiRecs:         false,
    cutSheets:      false,
  });
  const [busy, setBusy] = useState(false);

  const sections: string[] = [];
  if (include.mapSnapshot)    sections.push('Map snapshot');
  if (include.selectedLayers) sections.push('Engineering layers');
  if (include.deviceTable)    sections.push('Device table');
  if (include.bom)            sections.push('Bill of materials');
  if (include.notesMedia)     sections.push('Notes & media');
  if (include.aiRecs)         sections.push('AI recommendations');
  if (include.cutSheets)      sections.push('Product cut sheets');
  const pageEstimate = 1
    + (include.mapSnapshot ? 1 : 0)
    + (include.deviceTable ? Math.max(1, Math.ceil(devices.length / 24)) : 0)
    + (include.bom         ? Math.max(1, Math.ceil(devices.length / 30)) : 0)
    + (include.notesMedia  ? 2 : 0)
    + (include.aiRecs      ? 1 : 0)
    + (include.cutSheets   ? Math.min(8, devices.length) : 0);

  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      // Estimate reuses BOM under the hood for now; the audience selector
      // gates the customer/internal label baked into the cover.
      const kind: ReportKind = (reportType === 'estimate' ? 'bom' : reportType) as ReportKind;
      drawReport(doc, kind, devices, projectId, pxToFt);
      const label = `${projectId}-${reportType}-${audience}-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(label);
      toast.success(`Exported · ${TYPES.find((t) => t.id === reportType)?.label}`, {
        description: `${pageEstimate} page${pageEstimate === 1 ? '' : 's'} · ${audience === 'customer' ? 'Customer-safe' : 'Internal'}`,
        duration: 4000,
      });
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Export failed', { description: 'See console for details.', duration: 5000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[820px] max-w-full max-h-[88vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <FileBarChart className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight">Report Builder</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Pick a report type, choose what to include, then export.</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-12 gap-5 p-5">
          {/* Left — report type chooser */}
          <div className="col-span-5 space-y-1.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5 px-1">Report type</div>
            {TYPES.map((t) => {
              const Icon = t.icon;
              const active = reportType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setReportType(t.id)}
                  data-track={`report-type-${t.id}`}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${active ? 'border-primary/40 bg-primary/8' : 'border-border hover:border-border-strong hover:bg-secondary/30'}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: `${t.tone}1F`, color: t.tone, boxShadow: `inset 0 0 0 1px ${t.tone}55` }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12px] font-medium ${active ? 'text-foreground' : 'text-foreground'}`}>{t.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{t.sub}</div>
                    </div>
                    {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right — options + preview */}
          <div className="col-span-7 space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Audience</div>
              <div className="flex items-stretch h-9 border border-border rounded-lg overflow-hidden">
                {([
                  { id: 'internal' as const, label: 'Internal engineering', hint: 'Full detail · prices · findings · warnings' },
                  { id: 'customer' as const, label: 'Customer-safe',        hint: 'Removes dealer cost · internal-only sections' },
                ]).map((a) => {
                  const active = audience === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAudience(a.id)}
                      title={a.hint}
                      data-track={`report-audience-${a.id}`}
                      className={`flex-1 text-[12px] transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Include</div>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { k: 'mapSnapshot',    label: 'Map snapshot',      hint: 'Current floorplan view' },
                  { k: 'selectedLayers', label: 'Engineering layers', hint: 'FOV / power / pathways / annotations' },
                  { k: 'deviceTable',    label: 'Device table',      hint: `${devices.length} devices · ID · model · location` },
                  { k: 'bom',            label: 'Bill of materials', hint: 'Quantities · MSRP · totals' },
                  { k: 'notesMedia',     label: 'Notes & media',     hint: 'Field photos and site notes' },
                  { k: 'aiRecs',         label: 'AI recommendations', hint: 'Engineering Assistant findings' },
                  { k: 'cutSheets',      label: 'Product cut sheets', hint: 'Per-device datasheet pages' },
                ] as const).map((opt) => {
                  const checked = !!include[opt.k];
                  return (
                    <label
                      key={opt.k}
                      className={`flex items-start gap-2.5 px-3 py-2 rounded-md border cursor-pointer transition-colors ${checked ? 'border-primary/35 bg-primary/8' : 'border-border hover:border-border-strong hover:bg-secondary/30'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setInclude((v) => ({ ...v, [opt.k]: e.target.checked }))}
                        className="mt-0.5 accent-primary"
                        data-track={`report-opt-${opt.k}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium">{opt.label}</div>
                        <div className="text-[10px] text-muted-foreground">{opt.hint}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.10em] text-muted-foreground">Preview summary</div>
                <div className="text-[10px] text-muted-foreground">
                  ~{pageEstimate} page{pageEstimate === 1 ? '' : 's'}
                </div>
              </div>
              <div className="text-[12px] font-medium mt-1">
                {TYPES.find((t) => t.id === reportType)?.label} · {audience === 'customer' ? 'Customer-safe' : 'Internal'}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1.5">
                {sections.length === 0 ? 'No sections selected — cover page only.' : `Includes: ${sections.join(' · ')}.`}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground">
            Output: PDF · letter · landscape. Generated from your live canvas.
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40">Cancel</button>
            <button
              onClick={handleExport}
              disabled={busy || sections.length === 0}
              data-track="report-export"
              className="text-[12px] font-medium px-3.5 h-8 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// BundleInspectorDialog + computeBundleFill moved to
// canvas/dialogs/BundleInspectorDialog.tsx (M11 monolith breakup).
// EMT_SIZES + CABLE_OD_IN moved to canvas/cabling.ts and imported
// here so the inspector / BOM rows below can keep using them.

// RunToIdfDialog moved to canvas/dialogs/RunToIdfDialog.tsx (M11
// monolith breakup). Import at top of file.

function ScanBuildFloorplanDialog({
  onClose, onScanCamera, onUpload, onSatellite, onDrawScratch,
}: {
  onClose: () => void;
  onScanCamera: () => void;
  onUpload: () => void;
  onSatellite: () => void;
  onDrawScratch: () => void;
}) {
  type Opt = { id: string; icon: any; tone: string; title: string; sub: string; honest?: string; onClick: () => void; recommended?: boolean; track: string };
  // Canvas V2 Pass 1.0 — removed the "satellite / address base" card
  // (live tiles not connected; the card carried a "preview only"
  // disclaimer that violated CLAUDE.md's honesty rule) and the "demo
  // site scan" card (mocked AR/LiDAR with a "Demo workflow" disclaimer
  // on the primary surface). Upload and Blank both ship real backing.
  const opts: Opt[] = [
    {
      id: 'upload', icon: FolderUp, tone: '#A371F7', track: 'scan-build-upload',
      title: 'Upload a plan',
      sub: 'PNG, JPG, or PDF. Most users start here. Drop in a floor plan, set the scale, and plot devices.',
      onClick: onUpload, recommended: true,
    },
    {
      id: 'draw', icon: PencilLine, tone: '#F08F3C', track: 'scan-build-draw',
      title: 'Start with a blank canvas',
      sub: 'Sketch walls, rooms, and openings from scratch. Snap to grid is on.',
      onClick: onDrawScratch,
    },
  ];
  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[760px] max-w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <ScanLine className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight">Add a floor plan</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Pick how you want to bring this site in. You'll set the scale right after.</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {opts.map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.id}
                onClick={o.onClick}
                data-track={o.track}
                className="text-left group rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-secondary/20 p-4 transition-colors flex flex-col gap-2.5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${o.tone}1F`, color: o.tone, boxShadow: `inset 0 0 0 1px ${o.tone}55` }}
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.7} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium tracking-tight">{o.title}</span>
                      {o.recommended && (
                        <span className="text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-300">Start here</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{o.sub}</p>
                {o.honest && (
                  <div className="mt-1 text-[10px] text-amber-300/85 bg-amber-300/10 border border-amber-300/25 rounded px-2 py-1 flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
                    <span className="leading-snug">{o.honest}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="px-6 py-3 border-t border-border text-[11px] text-muted-foreground flex items-center gap-2">
          <Compass className="w-3 h-3" />
          Next step is always Set scale — click two points on a known feature and enter its real distance. Esc to cancel.
        </div>
      </div>
    </div>
  );
}

/** Modal for collecting building name + address. Lives inside MapsPanel; not
 *  exported because no one else uses it. Light validation: name required. */
function ImportFloorplanDialog({ onClose, onImported, onStartCalibrate }: { onClose: () => void; onImported: () => void; onStartCalibrate?: () => void }) {
  const { projectId = 'p1' } = useParams();
  const setFloorBackground = useProjectStore((s) => s.setFloorBackground);
  const updateFloor = useProjectStore((s) => s.updateFloor);
  // Canvas V2 Pass 2A.4 — target the ACTIVE floor (from the sticky
  // currentFloorIdByProject), not the project's first floor. Without
  // this, uploading a plan while on Level 2 would silently land on
  // Ground floor.
  const stickyFloorId = useProjectStore((s) => s.currentFloorIdByProject[projectId]);
  const fallbackFloorId = useProjectStore((s) => storeSelectors.firstFloorOfProject(s, projectId)?.id ?? '');
  const targetFloorId = stickyFloorId || fallbackFloorId;
  const floor = useProjectStore((s) => (targetFloorId ? (s.floors as any)[targetFloorId] : null) as any);
  const floorId = floor?.id ?? '';
  const floorName = floor?.name ?? 'Floor';
  const buildings = useProjectStore((s) => s.buildings);
  const buildingName = floor?.buildingId ? (buildings as any)[floor.buildingId]?.name ?? '' : '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Last successful import result, used for the preview + name editor.
  const [preview, setPreview] = useState<{ dataUrl: string; fileName: string; w: number; h: number } | null>(null);
  const [planName, setPlanName] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (!floorId) {
      setError('No floor selected. Add a building first.');
      return;
    }
    setBusy(true); setError(null); setNote(null);
    try {
      const { importFloorplanFile } = await import('../lib/floorplanImport');
      const { background, note: n } = await importFloorplanFile(file);
      setFloorBackground(floorId, background);
      setPreview({
        dataUrl: background.dataUrl,
        fileName: background.fileName,
        w: background.naturalWidth,
        h: background.naturalHeight,
      });
      setPlanName(background.fileName.replace(/\.[a-z0-9]+$/i, ''));
      setNote(n ?? null);
      // Don't close yet — the user reviews the preview and clicks the
      // explicit "Save & set scale" CTA below. That makes the workflow
      // step-by-step instead of bouncing them straight back to the canvas.
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  // Persist the edited plan name onto the floor's background record.
  const commitPlanName = () => {
    if (!floorId || !preview) return;
    const cleaned = (planName || '').trim() || preview.fileName;
    setFloorBackground(floorId, { ...(floor.background ?? {}), fileName: cleaned } as any);
  };

  // "Save & set scale →" — closes the modal, fires the optional
  // calibrate-now hook so the parent can arm the in-canvas Calibrate
  // tool, and lets the parent know an import happened.
  const onSaveAndCalibrate = () => {
    if (preview) {
      commitPlanName();
      onImported();
      if (onStartCalibrate) onStartCalibrate();
      onClose();
    }
  };
  // "Save without scale" — same as above but skips arming the
  // calibrate tool. Useful when the user wants to take a look first.
  const onSaveOnly = () => {
    if (preview) {
      commitPlanName();
      onImported();
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[480px] bg-card border border-border rounded-xl shadow-2xl">
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <div className="text-[14px] font-medium tracking-tight">Upload a floor plan</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, or PDF (first page). After upload you'll preview, name, and set the scale.</div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            data-testid="import-file-input"
          />

          {!preview && (
            <button
              onClick={handlePick}
              disabled={busy}
              className="w-full px-3 py-5 rounded-lg border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/4 transition-colors text-left"
              data-testid="import-pick-btn"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-[12px] font-medium">{busy ? 'Processing…' : 'Pick a file'}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG, or PDF (first page) · up to ~2k px on the longest edge</div>
                </div>
              </div>
            </button>
          )}

          {preview && (
            <div className="space-y-3" data-testid="import-preview-panel">
              {/* Preview thumbnail — fixed height so any image / orientation
                  reads at a glance. The "Scale not verified" status sits
                  on top to make the next step obvious. */}
              <div className="relative rounded-lg overflow-hidden border border-border bg-secondary/30" style={{ aspectRatio: '4 / 3' }}>
                <img
                  src={preview.dataUrl}
                  alt={preview.fileName}
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.10em] border border-amber-400/40 bg-amber-400/15 text-amber-300">
                  Scale not verified
                </div>
                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[9.5px] uppercase tracking-[0.10em] bg-black/55 text-white/85">
                  {preview.w}×{preview.h}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-[0.10em] mb-1">Plan name</div>
                  <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    onBlur={commitPlanName}
                    placeholder="Ground floor — east wing"
                    data-testid="import-name-input"
                    className="w-full h-8 px-2 rounded border border-border bg-background text-[12px] text-foreground focus:outline-none focus:border-primary/60"
                  />
                </label>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="text-[10px] uppercase tracking-[0.10em]">Floor</span>
                  <span className="text-foreground">{buildingName ? `${buildingName} · ` : ''}{floorName}</span>
                  <span className="ml-auto text-[10px] italic">Multi-floor switching is one project view away — this pass writes to the active floor.</span>
                </div>
              </div>
            </div>
          )}

          {note && (
            <div className="px-3 py-2 rounded border border-amber-500/30 bg-amber-500/5 text-[11px] text-amber-200/90">
              {note}
            </div>
          )}
          {error && (
            <div className="px-3 py-2 rounded border border-red-500/40 bg-red-500/5 text-[11px] text-red-300">
              {error}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          {!preview ? (
            <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
              Close
            </button>
          ) : (
            <>
              <button onClick={() => { setPreview(null); setPlanName(''); }} className="text-[12px] px-3 h-8 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" data-testid="import-replace-btn">
                Replace file
              </button>
              <button onClick={onSaveOnly} className="text-[12px] px-3 h-8 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" data-testid="import-save-only">
                Save without scale
              </button>
              <button onClick={onSaveAndCalibrate} className="text-[12px] px-3 h-8 rounded-md bg-primary text-primary-foreground hover:opacity-90 font-medium inline-flex items-center gap-1.5" data-testid="import-save-and-scale">
                <Ruler className="w-3 h-3" />Save & set scale →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


function InsertDock(props: {
  openCat: DeviceKind | null;
  setOpenCat: (c: DeviceKind | null) => void;
  openType: DeviceType | null;
  setOpenType: (t: DeviceType | null) => void;
  mfrFilter: string | null;
  setMfrFilter: (m: string | null) => void;
  query: string;
  setQuery: (q: string) => void;
  onStartDrag: (p: Product, e: React.PointerEvent) => void;
  layersOpen: boolean;
  onToggleLayers: () => void;
  /** Active project tech model. Filters the library to the matching ecosystem;
   *  off-ecosystem SKUs are still discoverable via search but greyed out and
   *  flagged with a "Outside stack" badge. */
  techModel: 'cloud' | 'on_prem' | 'hybrid';
  setTechModel?: (m: 'cloud' | 'on_prem' | 'hybrid') => void;
  openGroup: string | null;
  setOpenGroup: (g: string | null) => void;
  /** When true, collapse the 320px dock to a 48px icon rail. The user can
   *  still launch Scan/Build, jump into a category, or expand the dock —
   *  but the canvas regains ~272px of horizontal real estate. Persisted
   *  in localStorage so the engineer's choice survives reloads. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onOpenScanBuild?: () => void;
  /** V3.6 Part B — current per-category color overrides + setter.
   *  The dock category list shows a swatch picker per row that
   *  invokes setCategoryColor; the row icon + chip reflect the
   *  resolved override-or-default value. */
  categoryColors?: Partial<Record<DeviceKind, string>>;
  setCategoryColor: (kind: DeviceKind, color: string | null) => void;
}) {
  const cat = CATEGORIES.find((c) => c.id === props.openCat);
  /** Two-pass filter:
   *   1. In-stack products (productMatchesTechModel === true) for the active
   *      project. These show first.
   *   2. Out-of-stack products only if the user searches for them by name —
   *      they appear at the bottom with a quiet "Outside stack" badge. This
   *      makes the tech-model selection visibly affect the library without
   *      hiding parts of the catalog that a search would expect to find. */
  const POOL = useMemo(() => PRODUCTS.filter((p) => p.type === props.openType), [props.openType]);
  const matched = useMemo(() => POOL.filter((p) => productMatchesTechModel(p, props.techModel)), [POOL, props.techModel]);
  const offstack = useMemo(() => POOL.filter((p) => !productMatchesTechModel(p, props.techModel)), [POOL, props.techModel]);

  const products = useMemo(() => {
    if (!props.openType) return [];
    const q = props.query.toLowerCase().trim();
    const matchesQuery = (p: Product) => !q || `${p.mfr} ${p.model} ${p.sub}`.toLowerCase().includes(q);
    const matchesMfr   = (p: Product) => !props.mfrFilter || p.mfr === props.mfrFilter;
    const list = matched.filter(matchesQuery).filter(matchesMfr);
    // Offstack products only appear when the user is actively searching;
    // otherwise the library reads as cleanly filtered.
    if (q) return [...list, ...offstack.filter(matchesQuery).filter(matchesMfr)];
    return list;
  }, [props.openType, matched, offstack, props.mfrFilter, props.query]);

  const manufacturers = useMemo(() => {
    if (!props.openType) return [];
    // Only show manufacturer chips for in-stack SKUs.
    return Array.from(new Set(matched.map((p) => p.mfr)));
  }, [props.openType, matched]);

  /** Drives the row badge: "Recommended" / "In stack" / "Outside stack". */
  function badgeFor(p: Product): { label: string; tone: string; bg: string } | null {
    if (!productMatchesTechModel(p, props.techModel)) {
      return { label: 'Outside stack', tone: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
    }
    if (p.recommended) {
      return { label: 'Recommended', tone: '#34D399', bg: 'rgba(52,211,153,0.14)' };
    }
    return null;
  }

  const activeCat = CATEGORIES.find((c) => c.id === props.openCat) ?? null;

  // Collapsed = thin 48px icon rail. Engineers in the field rarely need the
  // full library expanded; collapsed keeps Scan/Build, Layers, and category
  // entry points one click away while handing 272px back to the canvas.
  if (props.collapsed) {
    return (
      <div className="shrink-0 flex bg-background relative">
        <div className="w-[48px] border-r border-border flex flex-col bg-card items-center py-2 gap-1.5">
          <button
            onClick={props.onToggleCollapsed}
            title="Expand device library"
            data-track="dock-expand"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
          <div className="w-7 h-px bg-border my-0.5" />
          {props.onOpenScanBuild && (
            <button
              onClick={props.onOpenScanBuild}
              title="Scan / Build Floorplan"
              data-track="dock-scan-build"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-primary bg-primary/12 hover:bg-primary/20 transition-colors"
            >
              <ScanLine className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={props.onToggleLayers}
            title="Layers"
            data-track="dock-layers"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${props.layersOpen ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
          >
            <Layers className="w-4 h-4" />
          </button>
          <div className="w-7 h-px bg-border my-0.5" />
          {CATEGORIES.slice(0, 8).map((c) => (
            <button
              key={c.id}
              onClick={() => { props.setOpenCat(c.id); props.onToggleCollapsed && props.onToggleCollapsed(); }}
              title={c.label}
              data-track={`dock-cat-${c.id}`}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              style={{ color: c.tone }}
            >
              <CategoryGlyph kind={c.id} active />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 flex bg-background relative">
      {/* InsertDock narrowed from 360px → 320px in the chrome-reduction
          pass. Header padding tightened to give the canvas back another
          ~52px of horizontal space. Collapse arrow at top-left collapses
          the dock to a 48px icon rail for max canvas space. */}
      <div className="w-[320px] border-r border-border flex flex-col bg-card">
        {/* Header — editorial. The device-library title sits as a calm
            headline; the count below is supporting metadata. When drilled
            into a category, the category becomes the headline. */}
        <div className="px-4 pt-4 pb-3 border-b border-border/70 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {activeCat ? (
              <>
                <button
                  onClick={() => { props.setOpenCat(null); props.setOpenType(null); }}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-2 -ml-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> All categories
                </button>
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${activeCat.tone}14`, color: activeCat.tone }}
                  >
                    <CategoryGlyph kind={activeCat.id} active />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium tracking-tight truncate leading-tight">{activeCat.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {PRODUCTS.filter((p) => TYPE_KIND[p.type] === activeCat.id && productMatchesTechModel(p, props.techModel)).length} in stack
                      <span className="mx-1.5 opacity-40">·</span>
                      {PRODUCTS.filter((p) => TYPE_KIND[p.type] === activeCat.id).length} total
                      <span className="mx-1.5 opacity-40">·</span>
                      {activeCat.types.length} types
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-[15px] font-medium tracking-tight leading-tight">Device library</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {PRODUCTS.filter((p) => productMatchesTechModel(p, props.techModel)).length} in {props.techModel === 'on_prem' ? 'on-prem' : props.techModel} stack
                  <span className="mx-1.5 opacity-40">·</span>
                  {PRODUCTS.length} total · {CATEGORIES.length} categories
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={props.onToggleLayers}
              title="Layers"
              className={`p-1.5 rounded-md transition-colors duration-150 ${props.layersOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}
            >
              <Layers className="w-4 h-4" />
            </button>
            {props.onToggleCollapsed && (
              <button
                onClick={props.onToggleCollapsed}
                title="Collapse library to an icon rail"
                data-track="dock-collapse"
                className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search — calmer materials. Same affordance, gentler chrome. */}
        <div className="px-4 py-2.5 border-b border-border/70 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70" />
            <input
              value={props.query}
              onChange={(e) => props.setQuery(e.target.value)}
              placeholder={activeCat ? `Search ${activeCat.label.toLowerCase()}…` : 'Search products'}
              className="w-full bg-input-background border border-input-border rounded-md pl-8 pr-3 h-9 text-[12px] focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/15 placeholder:text-muted-foreground/50"
            />
          </div>
          {/* Top-level group nav — Physical security / Infrastructure / IT /
              AV / Environmental / Power. Wraps the category list so engineers
              can scope by domain first. Only shown when no category is open
              (drilling into a category already implies the group). */}
          {!activeCat && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => props.setOpenGroup(null)}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  props.openGroup === null
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                All
              </button>
              {TOP_LEVEL_GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => props.setOpenGroup(g.id)}
                  title={g.hint}
                  className={`text-[10px] px-2 py-1 rounded transition-colors ${
                    props.openGroup === g.id
                      ? 'border'
                      : 'border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                  }`}
                  style={props.openGroup === g.id ? { background: `${g.tone}1f`, color: g.tone, borderColor: `${g.tone}55` } : undefined}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stack picker — Cloud / On-prem / Hybrid lives here (not the
            TopBar) because it directly filters the product list below.
            Live counts in the helper line prove the filter is doing
            something — picking Cloud should visibly shrink the library. */}
        {props.setTechModel && (() => {
          const total = PRODUCTS.length;
          const inStack = PRODUCTS.filter((p) => productMatchesTechModel(p, props.techModel)).length;
          const hidden = total - inStack;
          const recommended = PRODUCTS.filter((p) => productMatchesTechModel(p, props.techModel) && (p as any).recommended).length;
          return (
            <div className="px-4 py-2.5 border-b border-border/70">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground">Tech stack</span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  <span className="text-foreground">{inStack}</span> in · <span className="text-amber-400">{hidden}</span> hidden
                </span>
              </div>
              <div className="flex items-stretch border border-border/70 rounded-md overflow-hidden">
                {([
                  { id: 'cloud' as const,  label: 'Cloud',   hint: 'Verkada · Rhombus · Meraki · Eagle Eye · Brivo · Alta' },
                  { id: 'on_prem' as const, label: 'On-prem', hint: 'Axis · Hanwha · Avigilon · Bosch · Genetec · Milestone' },
                  { id: 'hybrid' as const,  label: 'Hybrid',  hint: 'Show both ecosystems; compatibility flagged' },
                ]).map((m) => {
                  const active = props.techModel === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => props.setTechModel && props.setTechModel(m.id)}
                      title={m.hint}
                      data-track={`dock-stack-${m.id}`}
                      className={`flex-1 text-[10px] py-1 transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5">
                {recommended} recommended in this stack. Off-stack SKUs surface only when you search for them.
              </div>
            </div>
          );
        })()}

        {/* LEVEL 1 — Categories as a vertical list, not a 2-col grid. Each
            row is generous (py-3), single-column, sentence-case, with a
            quiet count instead of a colored badge. Reads as a calm menu,
            not a tile dashboard. */}
        {!activeCat && (
          <div className="flex-1 overflow-auto py-1.5">
            {CATEGORIES.filter((c) => {
              if (!props.openGroup) return true;
              const group = TOP_LEVEL_GROUPS.find((g) => g.id === props.openGroup);
              return group ? group.categories.includes(c.id) : true;
            }).map((c) => {
              const inStack = PRODUCTS.filter((p) => TYPE_KIND[p.type] === c.id && productMatchesTechModel(p, props.techModel)).length;
              const productCount = PRODUCTS.filter((p) => TYPE_KIND[p.type] === c.id).length;
              // V3.6 Part B — resolve the live category color from the
              // store (override > static CATEGORIES tone). The dock
              // row icon + chip + the color-picker swatch all reflect
              // the same resolved value so changes are immediate.
              const resolvedTone = props.categoryColors?.[c.id] ?? KIND_TONE[c.id];
              return (
                <div key={c.id} className="w-full flex items-stretch hover:bg-secondary/30 transition-colors duration-150 group">
                  <button
                    onClick={() => { props.setOpenCat(c.id); props.setOpenType(null); }}
                    className="flex-1 text-left px-4 py-2.5 flex items-center gap-3"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150 group-hover:scale-[1.03]"
                      style={{
                        background: `${resolvedTone}12`,
                        color: resolvedTone,
                        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    >
                      <CategoryGlyph kind={c.id} active />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium tracking-tight leading-tight text-foreground">{c.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {c.types.length} types · <span className={inStack === 0 ? 'text-amber-400/80' : ''}>{inStack} in stack</span>
                        {inStack !== productCount && <span className="opacity-50"> · {productCount} total</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                  </button>
                  <div className="flex items-center pr-3 pl-1">
                    <ColorPicker
                      currentColor={resolvedTone}
                      onPick={(hex) => props.setCategoryColor(c.id, hex || null)}
                      title={`${c.label} color`}
                      size={18}
                      align="right"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LEVEL 2 — Types within the chosen category. Each type is its
            own section: heading + a small grid of product rows. Sentence
            case throughout; the colored accent is reserved for the
            single hairline strip beside the heading. Stack filter applied:
            in-stack SKUs first, then out-of-stack only if user is searching. */}
        {activeCat && (
          <div className="flex-1 overflow-auto py-1.5">
            {activeCat.types.map((t) => {
              const q = props.query.toLowerCase().trim();
              const matchesQuery = (p: Product) => !q || `${p.mfr} ${p.model} ${p.sub}`.toLowerCase().includes(q);
              const inStackItems  = PRODUCTS.filter((p) => p.type === t.id && productMatchesTechModel(p, props.techModel) && matchesQuery(p));
              const offStackItems = q ? PRODUCTS.filter((p) => p.type === t.id && !productMatchesTechModel(p, props.techModel) && matchesQuery(p)) : [];
              const items = [...inStackItems, ...offStackItems];
              if (items.length === 0) return null;
              return (
                <div key={t.id} className="mb-2">
                  <div className="px-4 pt-2.5 pb-1.5 flex items-center gap-2.5">
                    <span className="w-[2px] h-3.5 rounded-full" style={{ background: activeCat.tone }} />
                    <span className="text-[12px] font-medium text-foreground tracking-tight">{t.label}</span>
                    <span className="text-[10px] text-muted-foreground/70 ml-auto">{items.length}</span>
                  </div>
                  {items.map((p) => {
                    const badge = badgeFor(p);
                    const outOfStack = badge?.label === 'Outside stack';
                    return (
                      <button
                        key={p.id}
                        draggable
                        onDragStart={(e) => beginProductDrag(p.id, e)}
                        onPointerDown={(e) => { props.onStartDrag(p, e); }}
                        className={`w-full text-left px-4 py-2 hover:bg-secondary/40 cursor-grab active:cursor-grabbing flex items-center gap-2.5 transition-colors duration-150 group ${outOfStack ? 'opacity-55 hover:opacity-100' : ''}`}
                      >
                        <div
                          className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.03]"
                          style={{
                            background: `${activeCat.tone}10`,
                            color: activeCat.tone,
                            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                          }}
                        >
                          <DeviceGlyph type={p.type} size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] leading-tight flex items-center gap-2">
                            <span className="font-medium text-foreground shrink-0">{p.mfr}</span>
                            <span className="text-muted-foreground truncate min-w-0 flex-1">{p.model}</span>
                            {badge && (
                              <span
                                className="ml-auto text-[9.5px] uppercase tracking-[0.06em] px-1.5 py-[1px] rounded font-medium"
                                style={{ background: badge.bg, color: badge.tone }}
                                title={
                                  badge.label === 'Recommended'
                                    ? 'Recommended SKU for this stack — most projects ship this'
                                    : badge.label === 'Outside stack'
                                    ? `This SKU lives outside the active ${props.techModel === 'on_prem' ? 'on-prem' : props.techModel} stack. Drop it on the canvas and it will be flagged.`
                                    : undefined
                                }
                              >
                                {badge.label}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.sub}</div>
                        </div>
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Hint footer — quieter, single line, restrained icon. */}
        <div className="px-4 py-2 border-t border-border/70 text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
          {activeCat ? <><GripVertical className="w-3 h-3" />Drag a product onto the canvas</> : <><MousePointer2 className="w-3 h-3" />Pick a category to browse</>}
        </div>
      </div>

      {/* Legacy drilled-in drawer kept for compatibility but never rendered now */}
      {false && cat && (
        <div className="w-[340px] border-r border-border flex flex-col bg-background">
          {/* Header */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${cat.tone}1f`, color: cat.tone }}>
                  <CategoryGlyph kind={cat.id} active />
                </div>
                <div>
                  <div className="text-sm font-medium">{cat.label}</div>
                  <div className="text-[11px] text-muted-foreground">{PRODUCTS.filter((p) => TYPE_KIND[p.type] === cat.id).length} products · {cat.types.length} types</div>
                </div>
              </div>
              <button onClick={() => props.setOpenCat(null)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!props.openType && (
            <div className="flex-1 overflow-auto px-2 pb-3">
              <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground px-2 pt-1 pb-1.5">Types</div>
              <div className="space-y-0.5">
                {cat.types.map((t) => {
                  const count = PRODUCTS.filter((p) => p.type === t.id).length;
                  return (
                    <button
                      key={t.id}
                      onClick={() => props.setOpenType(t.id)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary text-left group transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-secondary group-hover:bg-background border border-border flex items-center justify-center shrink-0">
                        <DeviceGlyph type={t.id} size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{t.label}</div>
                        <div className="text-[11px] text-muted-foreground">{count} product{count !== 1 ? 's' : ''}</div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {props.openType && (
            <>
              <div className="px-4 pb-3 flex items-center gap-1.5 text-xs">
                <button onClick={() => { props.setOpenType(null); props.setMfrFilter(null); }} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-3.5 h-3.5" />{cat.label}
                </button>
                <Slash className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-foreground">{cat.types.find((t) => t.id === props.openType)!.label}</span>
              </div>

              <div className="px-3 pb-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={props.query} onChange={(e) => props.setQuery(e.target.value)}
                    placeholder="Search products…"
                    className="w-full bg-input-background border border-input-border rounded-lg pl-8 pr-3 h-8 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
                {manufacturers.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    <Chip active={props.mfrFilter === null} onClick={() => props.setMfrFilter(null)}>All</Chip>
                    {manufacturers.map((m) => (
                      <Chip key={m} active={props.mfrFilter === m} onClick={() => props.setMfrFilter(m)}>{m}</Chip>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto px-3 pb-3 space-y-1.5">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onPointerDown={(e) => { props.onStartDrag(p, e); }}
                    className="w-full text-left p-2.5 rounded-xl border border-border hover:border-primary/60 hover:bg-primary/[0.04] cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors group"
                  >
                    <div className="w-11 h-11 rounded-lg bg-secondary group-hover:bg-background border border-border flex items-center justify-center shrink-0">
                      <DeviceGlyph type={p.type} size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.mfr} <span className="text-muted-foreground">{p.model}</span></div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">{p.sub}</div>
                    </div>
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
                {products.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-10">No products match.</div>
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground flex items-center gap-1.5 bg-secondary/20">
                <GripVertical className="w-3 h-3" />Drag a card onto the canvas
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LayersPanel({ devices, selId, setSelId, selIds, setSelIds, hiddenIds, setHiddenIds, lockedIds, setLockedIds, layers, onToggleLayer, display, onDisplayChange, onClose }: {
  devices: Device[];
  selId: string | null;
  setSelId: (id: string | null) => void;
  selIds: Set<string>;
  setSelIds: (s: Set<string>) => void;
  hiddenIds: Set<string>;
  setHiddenIds: (s: Set<string>) => void;
  lockedIds: Set<string>;
  setLockedIds: (s: Set<string>) => void;
  /** Engineering overlay visibility, gated per layer. */
  layers: CanvasLayerState;
  onToggleLayer: (layer: EngineeringLayer, on: boolean) => void;
  /** Display preferences (icon size, label density, coverage opacity, base map). */
  display: CanvasDisplayPrefs;
  onDisplayChange: (patch: Partial<CanvasDisplayPrefs>) => void;
  onClose: () => void;
}) {
  const lastIndexRef = useRef<number>(-1);
  const flat = devices;
  const handleRowClick = (e: React.MouseEvent, d: Device, idx: number) => {
    if (e.shiftKey && lastIndexRef.current >= 0) {
      const [a, b] = [lastIndexRef.current, idx].sort((x, y) => x - y);
      const range = flat.slice(a, b + 1).map((x) => x.id);
      const next = new Set(selIds);
      range.forEach((id) => next.add(id));
      setSelIds(next);
      setSelId(d.id);
    } else if (e.metaKey || e.ctrlKey) {
      const next = new Set(selIds);
      if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
      setSelIds(next);
      setSelId(d.id);
      lastIndexRef.current = idx;
    } else {
      setSelIds(new Set([d.id]));
      setSelId(d.id);
      lastIndexRef.current = idx;
    }
  };
  const groups: Array<{ kind: DeviceKind; label: string; tone: string; items: Device[] }> = [
    { kind: 'camera',  label: 'Cameras', tone: KIND_TONE.camera,  items: devices.filter((d) => TYPE_KIND[d.type] === 'camera') },
    { kind: 'access',  label: 'Access',  tone: KIND_TONE.access,  items: devices.filter((d) => TYPE_KIND[d.type] === 'access') },
    { kind: 'network', label: 'Network', tone: KIND_TONE.network, items: devices.filter((d) => TYPE_KIND[d.type] === 'network') },
  ];
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };
  return (
    <div className="w-[300px] border-r border-border bg-background flex flex-col">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-medium">Layers</div>
            <div className="text-[11px] text-muted-foreground">{devices.length} devices · {selIds.size > 0 ? `${selIds.size} selected` : `${hiddenIds.size} hidden`}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-3">
        {/* ── Display preferences ───────────────────────────────────
            Dial-style controls: base map, icon size, label density,
            coverage opacity. These are the levers that let the engineer
            adapt the canvas to a dense site or a quiet presentation. */}
        <DisplaySection display={display} onChange={onDisplayChange} />

        {/* ── Engineering layers (overlays) ──────────────────────────
            Calm-by-default toggles. Most are off until the engineer
            asks for them. Anything that paints on top of the blueprint
            should live here, not as a floating button on the canvas. */}
        <EngineeringLayersSection layers={layers} onToggle={onToggleLayer} />

        {groups.map((g) => (
          <div key={g.kind} className="mb-2">
            <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: g.tone }} />
              {g.label}
              <span className="text-muted-foreground/60">· {g.items.length}</span>
            </div>
            {g.items.length === 0 && (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground/60 italic">No devices</div>
            )}
            {g.items.map((d) => {
              const hidden = hiddenIds.has(d.id);
              const locked = lockedIds.has(d.id);
              const active = selId === d.id;
              const multi = selIds.has(d.id);
              const idx = flat.findIndex((x) => x.id === d.id);
              return (
                <div
                  key={d.id}
                  onClick={(e) => handleRowClick(e, d, idx)}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${active ? 'bg-primary/10 ring-1 ring-primary/30' : multi ? 'bg-primary/[0.06] ring-1 ring-primary/20' : 'hover:bg-secondary'}`}
                >
                  <div className="w-6 h-6 rounded bg-secondary border border-border flex items-center justify-center shrink-0">
                    <DeviceGlyph type={d.type} size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs truncate ${hidden ? 'text-muted-foreground/60 line-through' : ''}`}>{d.id}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{d.label}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(lockedIds, setLockedIds, d.id); }}
                    className={`p-1 rounded hover:bg-background/60 transition-opacity ${locked ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-100 text-muted-foreground'}`}
                    title={locked ? 'Unlock' : 'Lock'}
                  >
                    {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(hiddenIds, setHiddenIds, d.id); }}
                    className={`p-1 rounded hover:bg-background/60 transition-opacity ${hidden ? 'opacity-100 text-muted-foreground' : 'opacity-0 group-hover:opacity-100 text-muted-foreground'}`}
                    title={hidden ? 'Show' : 'Hide'}
                  >
                    {hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`text-[11px] h-6 px-2.5 rounded-md border transition-colors ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>{children}</button>
  );
}

/** Display preferences — base map, icon size, label density, coverage
 *  opacity. Sits above the engineering layer toggles in the Layers panel.
 *  These are the dials the engineer reaches for first to make a dense
 *  map readable. Persistent per project. */
function DisplaySection({ display, onChange }: { display: CanvasDisplayPrefs; onChange: (patch: Partial<CanvasDisplayPrefs>) => void }) {
  const [open, setOpen] = useState(true);
  const baseMaps: { id: BaseMapMode; label: string }[] = [
    { id: 'blueprint', label: 'Blueprint' },
    { id: 'satellite', label: 'Satellite' },
    { id: 'street',    label: 'Street' },
    { id: 'hybrid',    label: 'Hybrid' },
    { id: 'dark',      label: 'Dark' },
    { id: 'blank',     label: 'Blank' },
  ];
  const sizes: { id: IconSize; label: string }[] = [
    { id: 'compact',  label: 'Compact' },
    { id: 'standard', label: 'Standard' },
    { id: 'large',    label: 'Large' },
  ];
  const densities: { id: LabelDensity; label: string }[] = [
    { id: 'hidden',    label: 'Hidden' },
    { id: 'selected',  label: 'Selected' },
    { id: 'important', label: 'Important' },
    { id: 'all',       label: 'All' },
  ];
  return (
    <div className="mb-3 border-b border-border/40 pb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Eye className="w-3 h-3" />
        Display
      </button>
      {open && (
        <div className="px-2 mt-1 space-y-3">
          {/* Map mode */}
          <div>
            <div className="text-[10px] text-muted-foreground mb-1.5">Map</div>
            <div className="grid grid-cols-3 gap-1">
              {baseMaps.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onChange({ baseMap: m.id })}
                  className={`text-[10px] py-1 px-1 rounded transition-colors ${display.baseMap === m.id ? 'bg-primary/15 text-primary border border-primary/40' : 'border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                  title={`Use ${m.label} as base map`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Icon size */}
          <SegmentRow
            label="Icon size"
            value={display.iconSize}
            options={sizes}
            onChange={(v) => onChange({ iconSize: v as IconSize })}
          />

          {/* Label density */}
          <SegmentRow
            label="Labels"
            value={display.labelDensity}
            options={densities}
            onChange={(v) => onChange({ labelDensity: v as LabelDensity })}
          />

          {/* Coverage opacity */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Coverage opacity</span>
              <span className="tabular-nums">{display.coverageOpacity}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={display.coverageOpacity}
              onChange={(e) => onChange({ coverageOpacity: Number(e.target.value) })}
              className="w-full accent-primary cursor-pointer"
              title="Dim FOV cones for a calmer canvas"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Small segmented-control row used by DisplaySection. */
function SegmentRow<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className="flex items-stretch border border-border/50 rounded p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`flex-1 text-[10px] py-0.5 rounded transition-colors ${value === o.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Engineering layer toggles — calm checklist of overlays. Off by
 *  default unless they're core engineering signals (fov, labels, pathways).
 *  Layers that don't yet have canvas rendering (NEC, thermal, bandwidth,
 *  rooms, conduit_ids) are still toggleable so the UI is future-proofed
 *  and future-painting can drop in without UX work. */
function EngineeringLayersSection({ layers, onToggle }: { layers: CanvasLayerState; onToggle: (l: EngineeringLayer, on: boolean) => void }) {
  const [open, setOpen] = useState(true);
  // Only layers that visibly affect the canvas are listed here. The
  // schema still holds rooms / NEC / thermal / bandwidth / conduit_ids
  // for when those renderers are built — but per the lockdown rule
  // (no controls that change nothing) they're hidden from this panel
  // until they paint something real.
  const rows: { id: EngineeringLayer; label: string; hint: string }[] = [
    { id: 'fov',         label: 'FOV cones',     hint: 'Camera coverage cones' },
    { id: 'coverage',    label: 'Coverage',      hint: 'Motion / reader / AP / speaker ranges' },
    { id: 'heatmap',     label: 'Gap heat map',  hint: 'Red = no device covers this spot' },
    { id: 'annotations', label: 'Annotations',   hint: 'Operator notes + callouts' },
    { id: 'labels',      label: 'Device labels', hint: 'IDs under each device' },
    { id: 'pathways',    label: 'Pathways',      hint: 'Cable runs and tray' },
    { id: 'dimensions',  label: 'Dimensions',    hint: 'Spacing between cameras' },
    { id: 'presence',    label: 'Presence',      hint: 'Live collaborator cursors' },
  ];
  const onCount = rows.filter((r) => layers[r.id]).length;
  return (
    <div className="mb-3 border-b border-border/40 pb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Layers className="w-3 h-3" />
        Engineering layers
        <span className="text-muted-foreground/60 ml-auto">{onCount} on</span>
      </button>
      {open && (
        <div className="px-1 grid grid-cols-2 gap-x-1 gap-y-0.5">
          {rows.map((r) => {
            const on = layers[r.id];
            return (
              <button
                key={r.id}
                onClick={() => onToggle(r.id, !on)}
                title={r.hint}
                className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] text-left transition-colors ${on ? 'text-foreground bg-secondary/60' : 'text-muted-foreground hover:bg-secondary/30'}`}
              >
                <span className={`w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center border ${on ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border/60'}`}>
                  {on && <Check className="w-2.5 h-2.5" />}
                </span>
                <span className="truncate">{r.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CANVAS SURFACE
   ═══════════════════════════════════════════════════════════════════════ */

interface PresenceCursor { id: string; name: string; tone: string; x: number; y: number; hoverId: string | null; }

interface SurfaceProps {
  tool: Tool;
  zoom: number;
  pan: { x: number; y: number };
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  onUserTouchView: () => void;
  devices: Device[];
  selId: string | null;
  /** Currently-selected pathway id, if any. Drives the per-vertex
   *  editor overlay (PathwayVertexEditor) so vertex handles render
   *  ONLY for the selected pathway — never for all pathways. */
  selPathwayId: string | null;
  selIds: Set<string>;
  presence: PresenceCursor[];
  hoverByPresence: Record<string, { name: string; tone: string }>;
  planSource: BaseMapMode;
  siteAddress: string;
  walls: Wall[];
  wallStart: { x: number; y: number } | null;
  wallCursor: { x: number; y: number } | null;
  /** Persisted tape-measure overlays for the active floor. Pass 1.8.
   *  Hidden when `measurementsVisible` is false. */
  persistedMeasurements?: import('../store/types').Measurement[];
  measurementsVisible?: boolean;
  onRemoveMeasurement?: (id: string) => void;
  onPick: (id: string) => void;
  onBlank: () => void;
  /** Click-to-arm placement consumer. Receives the canvas-space coords
   *  of a blank-surface click; returns true if the click was consumed
   *  (a device was placed). Bypasses the deselect path. */
  onArmedClick?: (x: number, y: number) => boolean;
  /** Calibrated feet-per-pixel for the active floor. Used by every
   *  on-canvas displayed-foot readout (drag HUD, nearest-distance label,
   *  dimension chains, measure tool, live cable-draw running length).
   *  Lives in the parent EngineeringCanvas; passed through here because
   *  CanvasSurface has no store access of its own. */
  currentFloorPxToFt: number;
  /** Canvas V2 Pass 2A.3 — id of the floor currently being rendered.
   *  Pathways + downstream overlays filter on this. */
  currentFloorId: string;
  /** Canvas V2 Pass 2B.3 + 2B.4 — pre computed coverage grid + stats.
   *  Heat map render reads from this; CoverageStatsPanel reads the
   *  same object. Null when the floor has no calibrated scale. */
  coverageGrid?: {
    cells: { x: number; y: number; covered: boolean }[];
    cellW: number;
    cellH: number;
  } | null;
  /** Canvas V2 Pass 2C.1 — rooms on the active floor + in flight
   *  draw state when the room tool is active. */
  rooms?: import('../store/types').Room[];
  roomDraw?: { points: { x: number; y: number }[]; cursor: { x: number; y: number } | null };
  /** Click handler for an existing room polygon (Pass 2C.3). */
  onPickRoom?: (id: string) => void;
  /** Canvas V2 Pass 2D — operator annotations on the active floor. */
  annotations?: import('../store/types').Annotation[];
  onPatchAnnotation?: (id: string, patch: Partial<import('../store/types').Annotation>) => void;
  onRemoveAnnotation?: (id: string) => void;
  snap: boolean;
  dragging: boolean;
  onSurfaceClick: (x: number, y: number) => void;
  onSurfaceMove: (x: number, y: number) => void;
  onSurfaceDblClick: () => void;
  /** Fired on a right-click anywhere on the canvas surface. Used to
   *  cancel an in-flight drawing tool (wall / measure / cable / conduit
   *  / pathway) — parent clears the in-progress state and flips the
   *  active tool back to Select. The handler is also responsible for
   *  preventing the browser's native context menu so the canvas feels
   *  like a CAD tool, not a web page. */
  onSurfaceContextMenu: (e: React.MouseEvent) => void;
  onMoveDevice: (id: string, x: number, y: number) => void;
  onRotateDevice: (id: string, rot: number) => void;
  onUpdateDevice: (id: string, patch: Partial<Device>) => void;
  activeLens: ActiveLens;
  setActiveLens: (l: ActiveLens) => void;
  coverageMode: CoverageMode;
  /** Toggleable engineering overlay state. Each layer gates a class
   *  of visual noise so the canvas is calm by default. */
  layers: CanvasLayerState;
  /** Display preferences — icon scale, label density, coverage opacity.
   *  Drives the visual density of the canvas. */
  display: CanvasDisplayPrefs;
  /** Active measurement state for the Measure tool. start = first click,
   *  end = second click (committed), cursor = live rubber-band point. */
  measure: {
    start: { x: number; y: number } | null;
    end:   { x: number; y: number } | null;
    cursor:{ x: number; y: number } | null;
  };
  /** Active scale-calibration state for the Calibrate tool. a = first
   *  click (point A), b = second click (point B), cursor = live
   *  rubber-band point before B is set. Used to render the A → B line +
   *  endpoint dots inside the canvas SVG. */
  calibrate: {
    a: { x: number; y: number } | null;
    b: { x: number; y: number } | null;
    cursor: { x: number; y: number } | null;
  };
  /** Active cable / pathway draw state. */
  cableDraw: {
    points: { x: number; y: number }[];
    cursor: { x: number; y: number } | null;
    cableType: string;
  };
  /** Lagged display position of the device currently being dragged.
   *  When set, the device, its cones, and the selection pill all
   *  render from this position instead of the store position — giving
   *  the drag its weighted, spring-physics feel. Null when nothing is
   *  being dragged or settling. */
  dragLag: { id: string; x: number; y: number } | null;
  /** Called by the pointerDown handler on a device. Parent kicks off
   *  the physics loop. */
  onDragStart: (id: string, x: number, y: number) => void;
  /** Called by the pointerUp handler on a device. Parent marks the
   *  drag as no longer active; physics continues until settled. */
  onDragEnd: () => void;
  /** When the user hovers a lens chip in the SelectionPill, this
   *  carries that lens id so the corresponding cone can subtly
   *  highlight. Null when nothing is being hovered. */
  hoveredLens: LensId | null;
  /** Currently-hovered host while a drag is in flight. When set, the
   *  canvas paints an attach ring around the host with allowed/rejected
   *  feedback. Null when no host is under the cursor or no drag is
   *  in progress. */
  hoverHost: {
    id: string;
    cx: number; cy: number;
    allowed: boolean;
    reason?: string;
    hint?: string;
  } | null;
  /** Imported floorplan background for the active floor. When set, drawn
   *  beneath all canvas content so devices appear on top of the plan. */
  floorBackground?: import('../store/types').FloorBackground;
  /** Patch the background's positional fields (drag / scale / rotate /
   *  opacity / locked). */
  onUpdateBackground?: (patch: Partial<import('../store/types').FloorBackground>) => void;
  /** Pass C — DORI band emphasis level driven by the camera drawer's
   *  Required Pixel Density tiles. When set, the selected camera's
   *  cone dims the other DORI bands and pops the picked grade. Null
   *  means no emphasis. Lives in the parent because the drawer (also
   *  in the parent) writes it. */
  selectedDoriLevel: DoriLevel | null;
  /** Person probe — canvas-world position of the draggable face
   *  marker tied to the selected camera. Null when no probe should
   *  render (no selection, multisensor / fisheye, calibration
   *  missing). Mutated by both the canvas marker drag and the
   *  drawer's preview controls so the two stay in sync. */
  personProbePos: { x: number; y: number } | null;
  setPersonProbePos: (pos: { x: number; y: number }) => void;
  /** M6 — HTML5 drag and drop receiver. Fires when a tray product is
   *  dropped onto the canvas. The handler is given the product id
   *  carried via dataTransfer plus the world-space coordinates of the
   *  drop (already inverse-transformed through the live pan + zoom).
   *  Parent dispatches the placement, including any door / IDF host
   *  attachment, from this single entry point. */
  onProductDrop?: (productId: string, worldX: number, worldY: number, clientX: number, clientY: number) => void;
}

const ICON_SCALE: Record<IconSize, number> = { compact: 0.75, standard: 1, large: 1.35 };

/** Should this device's label render given the global density setting? */
function labelVisibleFor(d: Device, density: LabelDensity, isSel: boolean): boolean {
  if (density === 'hidden') return isSel;       // selected device label always wins
  if (density === 'selected') return isSel;
  if (density === 'important') {
    if (isSel) return true;
    const k = TYPE_KIND[d.type];
    return k === 'camera' || k === 'network';   // cameras + IDFs / switches
  }
  return true;                                  // 'all'
}

import { forwardRef } from 'react';
const CanvasSurface = forwardRef<SVGSVGElement, SurfaceProps>(function CanvasSurface(
  { tool, zoom, pan, setPan, onUserTouchView, devices, selId, selPathwayId, selIds, presence, hoverByPresence, planSource, siteAddress, walls, wallStart, wallCursor, onPick, onBlank, onArmedClick, currentFloorPxToFt, currentFloorId, dragging, snap, onSurfaceClick, onSurfaceMove, onSurfaceDblClick, onSurfaceContextMenu, onMoveDevice, onRotateDevice, onUpdateDevice, activeLens, setActiveLens, coverageMode, layers, display, measure, calibrate, cableDraw, dragLag, onDragStart, onDragEnd, hoveredLens, hoverHost, floorBackground, onUpdateBackground, persistedMeasurements, measurementsVisible, onRemoveMeasurement, coverageGrid, rooms, roomDraw, onPickRoom, annotations, onPatchAnnotation, onRemoveAnnotation, selectedDoriLevel, personProbePos, setPersonProbePos, onProductDrop }, ref
) {
  const iconScale = ICON_SCALE[display.iconSize];
  const coverageAlpha = Math.max(0, Math.min(1, display.coverageOpacity / 100));
  const moveRef = useRef<{ id: string; offX: number; offY: number } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  // While a device is being dragged, every render — cones, glyphs,
  // labels, snap calculations — pulls position from `renderedDevices`
  // (which substitutes the lagged display position for the dragged
  // device). This is what makes the visual mass lag behind the cursor.
  // When nothing is dragging, renderedDevices === devices.
  const renderedDevices = useMemo(() => {
    if (!dragLag) return devices;
    return devices.map((d) => d.id === dragLag.id ? { ...d, x: dragLag.x, y: dragLag.y } : d);
  }, [devices, dragLag]);
  const movingDev = movingId ? renderedDevices.find((d) => d.id === movingId) ?? null : null;
  // snap candidates — other devices aligned within 4px of the moving device
  const snapTargets = useMemo(() => {
    if (!movingDev) return [] as { axis: 'v' | 'h'; coord: number; otherX: number; otherY: number }[];
    const out: { axis: 'v' | 'h'; coord: number; otherX: number; otherY: number }[] = [];
    renderedDevices.forEach((o) => {
      if (o.id === movingDev.id) return;
      if (Math.abs(o.x - movingDev.x) < 5) out.push({ axis: 'v', coord: o.x, otherX: o.x, otherY: o.y });
      if (Math.abs(o.y - movingDev.y) < 5) out.push({ axis: 'h', coord: o.y, otherX: o.x, otherY: o.y });
    });
    return out;
  }, [movingDev, renderedDevices]);
  // nearest neighbor (for distance telemetry while dragging)
  const nearest = useMemo(() => {
    if (!movingDev) return null;
    let best: { id: string; d: number; x: number; y: number } | null = null;
    renderedDevices.forEach((o) => {
      if (o.id === movingDev.id) return;
      const dd = Math.hypot(o.x - movingDev.x, o.y - movingDev.y);
      if (!best || dd < best.d) best = { id: o.id, d: dd, x: o.x, y: o.y };
    });
    return best;
  }, [movingDev, renderedDevices]);
  const coords = (e: React.MouseEvent) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    // Inverse of `translate(pan) scale(zoom)` so the click lands at the
    // same plan-coordinates regardless of how the user has framed it.
    return {
      x: ((e.clientX - r.left) - pan.x) / zoom,
      y: ((e.clientY - r.top)  - pan.y) / zoom,
    };
  };
  // Pan-by-drag — engaged with the Hand tool. Cumulative drag delta
  // updates `pan` so the whole content group translates with the cursor.
  // Drag-selection-box — when the Select tool is active and the
  // pointer goes down on an empty surface, the user can drag a
  // rectangle to multi-select every device whose centre falls inside.
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const [marqueeLocal, setMarqueeLocal] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const onPanStart = (e: React.PointerEvent) => {
    if (tool === 'pan') {
      panRef.current = { x: e.clientX, y: e.clientY };
      try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* capture optional */ }
      return;
    }
    if (tool === 'select') {
      // Start a marquee only when the pointer lands on the SVG itself
      // (or a non-interactive rect/g background); a device's own
      // pointerdown handler stops propagation via its own logic.
      const targetTag = (e.target as Element).tagName;
      if (targetTag === 'svg' || targetTag === 'rect') {
        const svg = (ref as React.RefObject<SVGSVGElement>).current;
        if (!svg) return;
        const r = svg.getBoundingClientRect();
        const px = (e.clientX - r.left - pan.x) / zoom;
        const py = (e.clientY - r.top  - pan.y) / zoom;
        marqueeStartRef.current = { x: px, y: py };
        setMarqueeLocal({ x0: px, y0: py, x1: px, y1: py });
        try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* capture optional */ }
      }
    }
  };
  const onPanMove = (e: React.PointerEvent) => {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.x;
      const dy = e.clientY - panRef.current.y;
      panRef.current = { x: e.clientX, y: e.clientY };
      onUserTouchView();
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      return;
    }
    if (marqueeStartRef.current) {
      const svg = (ref as React.RefObject<SVGSVGElement>).current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left - pan.x) / zoom;
      const py = (e.clientY - r.top  - pan.y) / zoom;
      setMarqueeLocal((m) => m ? { ...m, x1: px, y1: py } : null);
    }
  };
  const onPanEnd = (e: React.PointerEvent) => {
    if (panRef.current) {
      panRef.current = null;
      try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch {}
      return;
    }
    if (marqueeStartRef.current && marqueeLocal) {
      // Compute the rectangle in plan coords and collect devices.
      const x0 = Math.min(marqueeLocal.x0, marqueeLocal.x1);
      const x1 = Math.max(marqueeLocal.x0, marqueeLocal.x1);
      const y0 = Math.min(marqueeLocal.y0, marqueeLocal.y1);
      const y1 = Math.max(marqueeLocal.y0, marqueeLocal.y1);
      const ids: string[] = [];
      for (const d of devices) {
        if (d.x >= x0 && d.x <= x1 && d.y >= y0 && d.y <= y1) ids.push(d.id);
      }
      // Only commit if the marquee actually moved (avoid clicks setting
      // a 0-area selection).
      if ((x1 - x0) > 4 && (y1 - y0) > 4 && ids.length > 0) {
        (ref as React.RefObject<SVGSVGElement>).current?.dispatchEvent(
          new CustomEvent('dv-marquee-pick', { detail: { ids }, bubbles: true }),
        );
      }
      marqueeStartRef.current = null;
      setMarqueeLocal(null);
      try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch {}
    }
  };
  // M6 — HTML5 drop receiver. Bound on the SVG root so any drop within
  // the canvas viewport is captured. preventDefault on dragover is
  // required by the spec for drop events to fire. The product id comes
  // out of dataTransfer; coordinates inverse-transform through the
  // live pan + zoom so the device lands exactly where the cursor was.
  const onCanvasDragOver = (e: React.DragEvent<SVGSVGElement>) => {
    allowProductDrop(e);
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__dvDragOverFired = true;
    }
  };
  const onCanvasDrop = (e: React.DragEvent<SVGSVGElement>) => {
    if (typeof window !== 'undefined') {
      const w = window as unknown as Record<string, unknown>;
      w.__dvDropFired = true;
      // Capture what the handler sees so the audit can pinpoint where
      // the synthetic drag path breaks. Removed once the audit passes.
      w.__dvDropProductId = e.dataTransfer ? e.dataTransfer.getData('application/dv-product') : '<no-dataTransfer>';
    }
    if (!onProductDrop) return;
    e.preventDefault();
    const productId = readProductIdFromDrop(e);
    if (!productId) return;
    const svgEl = (ref as React.RefObject<SVGSVGElement>).current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const { x, y } = clientToCanvas(e.clientX, e.clientY, rect, pan, zoom);
    onProductDrop(productId, x, y, e.clientX, e.clientY);
  };
  return (
    <svg
      ref={ref}
      onPointerDown={onPanStart}
      onPointerMove={onPanMove}
      onPointerUp={onPanEnd}
      onPointerCancel={onPanEnd}
      onDragOver={onCanvasDragOver}
      onDrop={onCanvasDrop}
      onWheel={(e) => {
        // Wheel-zoom centred on the cursor for smooth, GIS-like zooming.
        if (!ref) return;
        const target = e.currentTarget;
        const r = target.getBoundingClientRect();
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        const factor = e.deltaY > 0 ? 1 / 1.12 : 1.12;
        const nextZoom = Math.max(0.25, Math.min(4, zoom * factor));
        // Pan correction so the point under the cursor stays put.
        const k = nextZoom / zoom;
        setPan((p) => ({ x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }));
        onUserTouchView();
        // The parent owns zoom; we still need to update it. Use the same
        // facade as the cursor click — the parent listens via setZoom
        // exposed through ZoomDock + keyboard. For pointer wheel we cheat
        // via a custom event the parent listens for.
        target.dispatchEvent(new CustomEvent('dv-wheel-zoom', { detail: nextZoom, bubbles: true }));
        e.preventDefault();
      }}
      onClick={(e) => {
        // Drawing tools (wall, measure, cable/conduit/pathway) forward
        // every click to the parent's onSurfaceClick so the chain / vertex
        // / point accumulation flows the way each tool expects. Without
        // this branch, measure and cable clicks fall through and the tool
        // appears unresponsive.
        if (tool === 'wall' || tool === 'measure' || tool === 'cable' || tool === 'conduit' || tool === 'pathway' || tool === 'calibrate') {
          const { x, y } = coords(e);
          onSurfaceClick(x, y);
          return;
        }
        // Armed click-to-place from the product tray. Runs BEFORE the
        // blank-only check because real floorplans contain path / line /
        // polygon / image geometry beneath the cursor — a user clicking
        // inside a room must still be able to place. Device + pathway
        // handlers already e.stopPropagation(), so this only fires on
        // truly inert geometry (svg / rect / path / line / polygon /
        // image / use).
        if (onArmedClick) {
          const { x, y } = coords(e);
          if (onArmedClick(x, y)) return;
        }
        // Deselect path — still gated on inert background geometry so
        // missed clicks on rotation rings / cone handles don't deselect.
        const isBlank = e.target === e.currentTarget || (e.target as Element).tagName === 'rect';
        if (!isBlank) return;
        onBlank();
      }}
      onMouseMove={(e) => {
        // Live rubber-band cursor for all drawing tools. Required so the
        // measure tool's mid-draw distance preview and the cable preview
        // line track the pointer in real time.
        if (tool !== 'wall' && tool !== 'measure' && tool !== 'cable' && tool !== 'conduit' && tool !== 'pathway' && tool !== 'calibrate') return;
        const { x, y } = coords(e);
        onSurfaceMove(x, y);
      }}
      onDoubleClick={onSurfaceDblClick}
      onContextMenu={onSurfaceContextMenu}
      style={{ background: 'var(--canvas-background)', touchAction: 'none' }}
      className={`absolute inset-0 w-full h-full ${tool === 'wall' || tool === 'measure' || tool === 'cable' ? 'cursor-crosshair' : tool === 'pan' ? (panRef.current ? 'cursor-grabbing' : 'cursor-grab') : dragging ? 'cursor-copy' : 'cursor-default'}`}
    >
      <defs>
        <style>{`
          @keyframes presence-pulse { 0% { opacity: 0.9; } 50% { opacity: 0.4; } 100% { opacity: 0.9; } }
          /* V3.9 -- scan-sweep keyframe removed. Was declared but had
             zero consumers in the rendered code. */
          /* V3.9 -- glow-breathe keyframe removed alongside its only
             consumer (the selected-multisensor breathing ring). */
        `}</style>
        {/* Canvas atmosphere — refined for spatial depth. Two grid scales
            (fine + coarse) plus a single soft vignette. The grid dots
            were intentionally quieted (opacity 0.35 → 0.18) so the
            blueprint reads as the foreground; the grid is texture, not
            a competing signal. */}
        <pattern id="canvas-grid-fine" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#4A95E8" strokeWidth="0.3" opacity="0.04" />
        </pattern>
        <pattern id="canvas-grid-coarse" width="96" height="96" patternUnits="userSpaceOnUse">
          <path d="M 96 0 L 0 0 0 96" fill="none" stroke="#4A95E8" strokeWidth="0.55" opacity="0.07" />
          <circle cx="0" cy="0" r="0.8" fill="#4A95E8" opacity="0.18" />
        </pattern>
        {/* Vignette — softer falloff at the edges. Bottom 100% stop is
            no longer pure black; uses the canvas-background navy at high
            alpha so corners feel like material drop-off, not void. */}
        <radialGradient id="canvas-vignette" cx="50%" cy="45%" r="80%">
          <stop offset="0%"  stopColor="#0D1424" stopOpacity="0" />
          <stop offset="75%" stopColor="#070C18" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#070C18" stopOpacity="0.72" />
        </radialGradient>
        {/* Plan paper — a touch warmer than the canvas around it. The
            faint stroke is dialed down so the paper reads as a surface,
            not a print. */}
        {/* Drafting paper — light-theme default is off-white drafting
            paper with a soft architectural grid; dark themes still get a
            slate paper. Both pull from theme tokens so the same SVG
            renders correctly in any theme without branching. */}
        <pattern id="plan-paper" width="32" height="32" patternUnits="userSpaceOnUse">
          <rect width="32" height="32" fill="var(--canvas-background)" />
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="var(--canvas-grid)" strokeWidth="0.6" />
        </pattern>
        {/* Soft grain — drafting paper tooth. A barely-there speckle at
            high frequency so the canvas no longer reads as a flat web
            surface but as a physical drawing sheet. */}
        <filter id="canvas-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0" />
        </filter>
        {/* Selected-device drop shadow — quiet elevation, not a glow. */}
        <filter id="device-elevation" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Coverage gradients — drafting-paper wash. Lower alpha across
            every stop, less saturated near the lens. The cone should
            read as a quiet engineering callout, not an atmospheric
            spotlight beam. */}
        <radialGradient id="fov-grad" cx="0%" cy="50%" r="100%">
          <stop offset="0%"   stopColor="#F2C744" stopOpacity="0.32" />
          <stop offset="45%"  stopColor="#F2C744" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#F2C744" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fov-grad-ptz" cx="0%" cy="50%" r="100%">
          <stop offset="0%"   stopColor="#5BA0F2" stopOpacity="0.30" />
          <stop offset="50%"  stopColor="#5BA0F2" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#5BA0F2" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fov-grad-360" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#E5484D" stopOpacity="0.22" />
          <stop offset="60%"  stopColor="#E5484D" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#E5484D" stopOpacity="0" />
        </radialGradient>
        {/* fov-bloom filter retained for backward compatibility, but is
            no longer applied to cone renders — the bloom pass was the main
            source of the "spotlight" cyber feel. */}
        <filter id="fov-bloom" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        {/* Item 5 — clip cone rendering to the canvas viewport. SVG's
            default overflow already clips at the root, but we declare
            an explicit clip in user-space (the SVG's screen coord
            system) and apply it to the coverage-cones group below as
            a visible guarantee. The density math is unchanged — this
            is a paint-only clip. */}
        <clipPath id="canvas-bounds-clip" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="0" width="100%" height="100%" />
        </clipPath>
        {/* Audit follow-up — master plan clip. Every camera-coverage
            element — fill, outline stroke, decorative arcs, DORI band
            rings, edge strokes, labels — must clip to the floorplan
            rectangle. The per-camera clipPaths already do this for the
            cone fill polygons. This master clip is a defensive second
            layer wrapping the WHOLE coverage group, so any new
            decoration added later (or any future per-camera clipPath
            quirk) still cannot paint into the exterior. The path
            below is the same M 80 80 L 720 80 ... rect every per-
            camera clip uses, anchored to user space. */}
        <clipPath id="master-plan-coverage-clip" clipPathUnits="userSpaceOnUse">
          {(() => {
            const planBounds = (floorBackground && floorBackground.naturalWidth && floorBackground.naturalHeight)
              ? {
                  x: floorBackground.x,
                  y: floorBackground.y,
                  w: floorBackground.naturalWidth * (floorBackground.scale ?? 1),
                  h: floorBackground.naturalHeight * (floorBackground.scale ?? 1),
                }
              : { x: 80, y: 80, w: 640, h: 480 };
            return (
              <rect
                x={planBounds.x}
                y={planBounds.y}
                width={planBounds.w}
                height={planBounds.h}
              />
            );
          })()}
        </clipPath>
      </defs>

      {/* Canvas backdrop — grid lattice, soft vignette, and a high-
          frequency grain layer that gives the surface physical tooth
          (the kind you feel under a pencil on drafting paper) without
          competing with anything painted on top. */}
      <rect width="100%" height="100%" fill="url(#canvas-grid-fine)" />
      <rect width="100%" height="100%" fill="url(#canvas-grid-coarse)" />
      <rect width="100%" height="100%" fill="url(#canvas-vignette)" />
      <rect width="100%" height="100%" filter="url(#canvas-grain)" opacity="0.55" pointerEvents="none" />

      {/* Item 5 — every transformed canvas element (cones, walls, floor
          image, devices) lives inside this clip wrapper. The clipPath
          is referenced OUTSIDE the pan/zoom transform so the clip is
          anchored to the SVG screen viewport, not the world coord
          system. Cones can never paint past the visible canvas edge. */}
      <g clipPath="url(#canvas-bounds-clip)">
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
        {/* The plan — clearly delineated as the building */}
        <FloorPlan source={planSource} siteAddress={siteAddress} />

        {/* Imported floorplan background — rendered beneath devices/walls so
            the user can trace over it. Transforms apply scale + rotation
            around the image center; opacity is per-floor. */}
        {floorBackground && (
          <g
            transform={`translate(${floorBackground.x}, ${floorBackground.y}) rotate(${floorBackground.rotation}, ${floorBackground.naturalWidth * floorBackground.scale / 2}, ${floorBackground.naturalHeight * floorBackground.scale / 2}) scale(${floorBackground.scale})`}
            opacity={floorBackground.opacity}
            pointerEvents="none"
          >
            <image
              href={floorBackground.dataUrl}
              x={0}
              y={0}
              width={floorBackground.naturalWidth}
              height={floorBackground.naturalHeight}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        )}

        {/* User-drawn walls */}
        {walls.map((w) => (
          <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
        ))}

        {/* Canvas V2 Pass 2C.1 — committed rooms (filled polygons) +
            in-flight room draw polyline. Rooms paint before walls so
            wall lines stay readable on top.
            Pass 2C.3 — name labels render at the polygon centroid
            when the rooms layer is on. Sensitivity tints the fill so
            critical rooms read at a glance. */}
        {rooms && rooms.map((r) => {
          const sensTint =
            r.sensitivity === 'critical' ? 'rgba(239, 68, 68, 0.16)'
            : r.sensitivity === 'high'     ? 'rgba(245, 158, 11, 0.14)'
            : r.sensitivity === 'medium'   ? 'rgba(47, 129, 247, 0.12)'
            : 'rgba(47, 129, 247, 0.08)';
          const sensStroke =
            r.sensitivity === 'critical' ? 'rgba(239, 68, 68, 0.70)'
            : r.sensitivity === 'high'     ? 'rgba(245, 158, 11, 0.60)'
            : 'rgba(47, 129, 247, 0.55)';
          // Centroid for the label.
          let cx = 0; let cy = 0;
          for (const p of r.polygon) { cx += p.x; cy += p.y; }
          if (r.polygon.length) { cx /= r.polygon.length; cy /= r.polygon.length; }
          return (
            <g key={`room-${r.id}`}>
              <polygon
                points={r.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                fill={sensTint}
                stroke={sensStroke}
                strokeWidth={1.5}
                style={{ cursor: onPickRoom ? 'pointer' : 'default' }}
                onClick={(e) => { e.stopPropagation(); onPickRoom?.(r.id); }}
              />
              {layers.rooms && r.name && (
                <text x={cx} y={cy} textAnchor="middle" fontSize={11} fontWeight={500} fill="var(--foreground)" pointerEvents="none">
                  {r.name}
                </text>
              )}
            </g>
          );
        })}
        {roomDraw && roomDraw.points.length > 0 && (
          <g pointerEvents="none">
            <polyline
              points={[...roomDraw.points, roomDraw.cursor ?? roomDraw.points[roomDraw.points.length - 1]].map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#2F81F7"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            {roomDraw.points.map((p, i) => (
              <circle key={`rd-${i}`} cx={p.x} cy={p.y} r={3} fill="#2F81F7" />
            ))}
          </g>
        )}

        {/* Canvas V2 Pass 2D — operator annotations. Gated by the
            annotations layer (toggle in Layers panel). Notes render
            as small yellow chips with text; callouts as numbered
            circles. Click to edit text inline; right click (or click
            the × glyph) to remove. */}
        {layers.annotations && annotations && annotations.map((a) => {
          const tone =
            a.color === 'red'    ? '#ef4444'
            : a.color === 'green'  ? '#22c55e'
            : a.color === 'blue'   ? '#2F81F7'
            : a.color === 'purple' ? '#A371F7'
            : '#FACC15';
          if (a.kind === 'callout') {
            return (
              <g key={`an-${a.id}`} style={{ cursor: 'pointer' }}
                 onClick={(e) => { e.stopPropagation(); const next = window.prompt('Callout note', a.text ?? ''); if (next !== null) onPatchAnnotation?.(a.id, { text: next }); }}
                 onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (window.confirm('Remove callout?')) onRemoveAnnotation?.(a.id); }}
              >
                <circle cx={a.x} cy={a.y} r={11} fill={tone} stroke="white" strokeWidth={2} />
                <text x={a.x} y={a.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="white" pointerEvents="none">
                  {a.number ?? '?'}
                </text>
                {a.text && (
                  <text x={a.x + 14} y={a.y + 4} fontSize={10} fill="var(--foreground)" pointerEvents="none">
                    {a.text.slice(0, 24)}
                  </text>
                )}
              </g>
            );
          }
          // 'note' (and default for any future kind we don't render).
          return (
            <g key={`an-${a.id}`} style={{ cursor: 'pointer' }}
               onClick={(e) => { e.stopPropagation(); const next = window.prompt('Note', a.text ?? ''); if (next !== null) onPatchAnnotation?.(a.id, { text: next }); }}
               onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (window.confirm('Remove note?')) onRemoveAnnotation?.(a.id); }}
            >
              <rect x={a.x - 4} y={a.y - 4} width={Math.max(56, (a.text?.length ?? 4) * 6)} height={18} rx={3} fill={tone} fillOpacity={0.95} stroke={tone} />
              <text x={a.x} y={a.y + 9} fontSize={11} fill="#111" pointerEvents="none">
                {a.text ?? 'Note'}
              </text>
            </g>
          );
        })}
        {wallStart && wallCursor && (
          <g>
            <line x1={wallStart.x} y1={wallStart.y} x2={wallCursor.x} y2={wallCursor.y} stroke="#2F81F7" strokeWidth="2" strokeDasharray="4 4" />
            <circle cx={wallStart.x} cy={wallStart.y} r="3" fill="#2F81F7" />
            <circle cx={wallCursor.x} cy={wallCursor.y} r="3" fill="#2F81F7" />
          </g>
        )}

        {/* Audit Group B.1 — planBounds is shared by the camera-cone
            block (existing) AND the non-camera coverage block below
            (AP RF circles, sector wedges). Both blocks read the same
            constant so a single edit to the bounding-rect computation
            covers every coverage surface on the canvas. */}
        {(() => {
          const planBounds: { x: number; y: number; w: number; h: number } | null =
            (floorBackground && floorBackground.naturalWidth && floorBackground.naturalHeight)
              ? {
                  x: floorBackground.x,
                  y: floorBackground.y,
                  w: floorBackground.naturalWidth * (floorBackground.scale ?? 1),
                  h: floorBackground.naturalHeight * (floorBackground.scale ?? 1),
                }
              : { x: 80, y: 80, w: 640, h: 480 };
          return (
        <g style={{ mixBlendMode: coverageMode === 'heatmap' ? 'screen' : 'normal' }} clipPath="url(#master-plan-coverage-clip)">
          {renderedDevices.filter((d) => TYPE_KIND[d.type] === 'camera').map((d) => {
            const isSel = d.id === selId;
            if (!layers.fov && !isSel) return null;
            // Item 7 — unselected dim raised from 0.28 to 0.55. The
            // prior value plus the per-mode opacity multiplier stacked
            // to ~0.08 final, which read as "barely visible" against
            // the floor plan. 0.55 keeps unselected cameras quieter
            // than the selected one (1.2) without erasing their
            // coverage entirely.
            const dim = (selId ? (isSel ? 1 : 0.55) : 1) * coverageAlpha;
            // Item 6 — find the room polygon that contains this
            // camera (if any). Item 8 — when there's no enclosing
            // room, fall back to the floor's plan bounds + margin so
            // the cone doesn't sprawl across empty canvas. Both are
            // computed at the call site and passed to FOV.
            let roomPolygon: { x: number; y: number }[] | null = null;
            if (rooms && rooms.length > 0) {
              for (const r of rooms) {
                if (r.floorId !== currentFloorId) continue;
                if (!r.polygon || r.polygon.length < 3) continue;
                if (pointInPolygon({ x: d.x, y: d.y }, r.polygon)) {
                  roomPolygon = r.polygon;
                  break;
                }
              }
            }
            return <FOV key={`fov-${d.id}`} d={d} pxToFt={currentFloorPxToFt} mode={coverageMode} dim={dim} selected={isSel} activeLens={isSel ? activeLens : 'all'} hoveredLens={isSel ? hoveredLens : null} emphasizedDoriLevel={isSel ? selectedDoriLevel : null} roomPolygon={roomPolygon} planBounds={planBounds} />;
          })}
        </g>
          );
        })()}

        {/* Canvas V2 Pass 2B.3 — coverage gap detection heat map.
            Pulls the pre computed grid from the parent so the same
            rasterisation drives the chrome-side stats panel. */}
        {layers.heatmap && coverageGrid && (
          <g pointerEvents="none" style={{ mixBlendMode: 'multiply' }}>
            {coverageGrid.cells.map((c, i) => (
              <rect
                key={`hm-${i}`}
                x={c.x} y={c.y}
                width={coverageGrid.cellW} height={coverageGrid.cellH}
                fill={c.covered ? '#22c55e' : '#ef4444'}
                fillOpacity={0.18}
              />
            ))}
          </g>
        )}

        {/* Canvas V2 Pass 2B.2 — non camera coverage. Audit Group B.1
            extends Item 8 containment to these shapes: AP RF radius
            circles and sector wedges now clip to the floor's plan
            bounds + 20 ft margin (or the device's enclosing room
            polygon when available) instead of sprawling across empty
            canvas. Mathematics for the coverage profile are unchanged
            — only the visible footprint is constrained. */}
        {(layers.coverage || selId) && (() => {
          const planBounds = (floorBackground && floorBackground.naturalWidth && floorBackground.naturalHeight)
            ? {
                x: floorBackground.x,
                y: floorBackground.y,
                w: floorBackground.naturalWidth * (floorBackground.scale ?? 1),
                h: floorBackground.naturalHeight * (floorBackground.scale ?? 1),
              }
            : { x: 80, y: 80, w: 640, h: 480 };
          // Group A.3 (second pass) — non-camera coverage clip with 0
          // margin so AP RF discs, sector wedges, etc. also stop at
          // the plan rectangle.
          const planMarginPx = 0;
          return (
          <g pointerEvents="none" clipPath="url(#master-plan-coverage-clip)">
            {renderedDevices.map((d) => {
              if (TYPE_KIND[d.type] === 'camera') return null;
              const isSel = d.id === selId;
              if (!layers.coverage && !isSel) return null;
              const profile = coverageForDevice(d as any);
              if (profile.shape === 'none') return null;
              if (currentFloorPxToFt <= 0) return null;
              const alpha = ((selId ? (isSel ? 1 : 0.28) : 1) * coverageAlpha) * 0.32;
              const tone = profile.tint ?? deviceTone(d);
              // Per-device clip path. Prefer the room polygon the
              // device sits inside; fall back to plan bounds + 20 ft
              // margin so the shape always stops at the floor edge.
              let roomPolygon: { x: number; y: number }[] | null = null;
              if (rooms && rooms.length > 0) {
                for (const r of rooms) {
                  if (r.floorId !== currentFloorId) continue;
                  if (!r.polygon || r.polygon.length < 3) continue;
                  if (pointInPolygon({ x: d.x, y: d.y }, r.polygon)) {
                    roomPolygon = r.polygon;
                    break;
                  }
                }
              }
              const useRoomClip = !!(roomPolygon && roomPolygon.length >= 3);
              const clipId = useRoomClip ? `cov-room-${d.id}` : `cov-plan-${d.id}`;
              const clipDefs = (
                <defs>
                  <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
                    {useRoomClip
                      ? <path d={`M ${roomPolygon!.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`} />
                      : <rect
                          x={planBounds.x - planMarginPx}
                          y={planBounds.y - planMarginPx}
                          width={planBounds.w + planMarginPx * 2}
                          height={planBounds.h + planMarginPx * 2}
                        />
                    }
                  </clipPath>
                </defs>
              );
              if (profile.shape === 'radius' && profile.rangeFt) {
                const rPx = profile.rangeFt / currentFloorPxToFt;
                if (rPx < 1) return null;
                return (
                  <g key={`cov-${d.id}`}>
                    {clipDefs}
                    <circle
                      cx={d.x} cy={d.y} r={rPx}
                      fill={tone} fillOpacity={alpha * 0.55}
                      stroke={tone} strokeOpacity={alpha} strokeWidth={1}
                      clipPath={`url(#${clipId})`}
                    />
                  </g>
                );
              }
              if (profile.shape === 'cone' && profile.rangeFt && profile.fovDeg) {
                const rPx = profile.rangeFt / currentFloorPxToFt;
                if (rPx < 1) return null;
                const half = (profile.fovDeg / 2) * Math.PI / 180;
                const rotRad = ((d.rot ?? 0) - 90) * Math.PI / 180; // device 0° points right; cone centres on body
                // Sector path: device origin, sweep across the FOV.
                const ax = d.x + rPx * Math.cos(rotRad - half);
                const ay = d.y + rPx * Math.sin(rotRad - half);
                const bx = d.x + rPx * Math.cos(rotRad + half);
                const by = d.y + rPx * Math.sin(rotRad + half);
                const path = `M ${d.x} ${d.y} L ${ax} ${ay} A ${rPx} ${rPx} 0 ${profile.fovDeg > 180 ? 1 : 0} 1 ${bx} ${by} Z`;
                return (
                  <g key={`cov-${d.id}`}>
                    {clipDefs}
                    <path
                      d={path}
                      fill={tone} fillOpacity={alpha * 0.55}
                      stroke={tone} strokeOpacity={alpha} strokeWidth={1}
                      clipPath={`url(#${clipId})`}
                    />
                  </g>
                );
              }
              return null;
            })}
          </g>
          );
        })()}

        {/* PathwaysOverlay paints BEFORE devices so device hit-targets sit on
            top in SVG paint order. A pathway's 12-px-wide transparent
            hit-stroke used to cover devices that lived at the pathway's
            endpoints (e.g. PW-1 starts at CAM-101's exact coords), which
            stole every real click. Devices render next. */}
        <PathwaysOverlay
          floorId={currentFloorId}
          onPickBundle={(bid) => {
            (ref as React.RefObject<SVGSVGElement>).current?.dispatchEvent(
              new CustomEvent('dv-bundle-open', { detail: { bundleId: bid }, bubbles: true }),
            );
          }}
          onPickPathway={(pid) => {
            (ref as React.RefObject<SVGSVGElement>).current?.dispatchEvent(
              new CustomEvent('dv-pathway-pick', { detail: { pathwayId: pid }, bubbles: true }),
            );
          }}
        />

        {/* Devices — real top-down hardware silhouettes with drag-to-move */}
        {renderedDevices.map((d) => {
          const multi = selIds.has(d.id);
          // Per-object color override — when set, drives glyph, label, and
          // cone tone for this device only. Falls back to category color.
          const tone = deviceTone(d);
          const isSel = selId === d.id;
          // Selected-device spotlight: when SOMETHING is selected, every other
          // device fades back so the focused one reads clearly. The glyph dims
          // less aggressively than the cone (cones fade hard to 0.28 in FOV's
          // own opacity calc) so the user can still locate inactive devices
          // and click to switch focus.
          const spotlightDim = selId && !isSel ? 0.42 : 1;
          // Stable test-id namespace per the MVP spec: door-* for doors,
          // device-* for everything else (cameras, readers, IDFs, sensors).
          const isDoorish = (d.type as string).startsWith('inf.door')
            || (d.type as string).startsWith('inf.gate')
            || (d.type as string).startsWith('inf.storefront')
            || (d.type as string).startsWith('inf.doubledoor');
          const testId = isDoorish ? `door-${d.id}` : `device-${d.id}`;
          // V1 1A.3 — native browser tooltip on hover with the three
          // pieces of identity an engineer most often wants: location
          // label, manufacturer + model, and the device id. Uses an
          // SVG <title> element so it costs nothing, works in every
          // theme, and doesn't pull in a custom positioning layer.
          const hoverProduct = d.product ? PRODUCTS_BY_ID.get(d.product) : undefined;
          const hoverProductLabel = hoverProduct ? productLabel(hoverProduct, d.type) : d.type;
          const hoverTitle = [d.label, hoverProductLabel, d.id].filter(Boolean).join(' · ');
          return (
            <g
              key={d.id}
              data-testid={testId}
              data-track={testId}
              data-object-kind={isDoorish ? 'door' : 'device'}
              data-device-id={d.id}
              data-device-type={d.type}
              className={`cursor-move dv-device ${isSel ? 'dv-selected' : ''}`}
              style={{ opacity: spotlightDim, transition: 'opacity 160ms ease, transform 200ms cubic-bezier(0.22,1,0.36,1)' }}
              // Click handler in parallel with onPointerDown so a plain
              // native click() (mobile tap, screen reader, automated test)
              // still selects the device. Drag is governed by pointer events
              // below; this stays a one-line "if it ended as a click, pick it"
              // path that doesn't fight the drag flow.
              onClick={(e) => {
                e.stopPropagation();
                if (e.shiftKey || e.metaKey || e.ctrlKey) {
                  // Pass 1.3 — Cmd / Ctrl click toggles like Shift click.
                  (ref as React.RefObject<SVGSVGElement>).current?.dispatchEvent(new CustomEvent('dv-shift-pick', { detail: { id: d.id }, bubbles: true }));
                } else {
                  onPick(d.id);
                }
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                // Pointer capture is best-effort — synthetic events without a
                // real pointerId throw InvalidPointerId, which used to swallow
                // the whole handler and silently lose the click. Wrap so the
                // selection path still runs.
                try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* synthetic event */ }
                const svg = (ref as React.RefObject<SVGSVGElement>).current;
                if (!svg) return;
                const r = svg.getBoundingClientRect();
                const cx = ((e.clientX - r.left) - pan.x) / zoom;
                const cy = ((e.clientY - r.top)  - pan.y) / zoom;
                moveRef.current = { id: d.id, offX: cx - d.x, offY: cy - d.y };
                setMovingId(d.id);
                // Shift-click adds/removes from the multi-selection set
                // without changing the primary selection. Plain click sets
                // the primary selection AND replaces the multi-selection
                // so the user can re-start a group action by clicking once.
                if (e.shiftKey || e.metaKey || e.ctrlKey) {
                  e.stopPropagation();
                  // Dispatch up to the parent — the parent owns selIds.
                  // Pass 1.3 — Cmd / Ctrl click toggles like Shift click.
                  (ref as React.RefObject<SVGSVGElement>).current?.dispatchEvent(new CustomEvent('dv-shift-pick', { detail: { id: d.id }, bubbles: true }));
                } else {
                  onPick(d.id);
                }
                // Kick off the parent's physics loop with this device's
                // current position as the starting lag.
                onDragStart(d.id, d.x, d.y);
              }}
              onPointerMove={(e) => {
                const m = moveRef.current;
                if (!m || m.id !== d.id) return;
                const svg = (ref as React.RefObject<SVGSVGElement>).current;
                if (!svg) return;
                const r = svg.getBoundingClientRect();
                const cx = ((e.clientX - r.left) - pan.x) / zoom;
                const cy = ((e.clientY - r.top)  - pan.y) / zoom;
                let nx = cx - m.offX;
                let ny = cy - m.offY;
                // Magnetic snap on the *cursor target*. The visual still
                // springs toward this target via the parent's physics, so
                // the snap reads as the device being pulled in — not a
                // teleport. Snap tolerance is the same as the existing
                // guide-line tolerance (5px) so the visible guides line
                // up with the actual pull moment.
                if (snap) {
                  const SNAP = 5;
                  for (const o of devices) {
                    if (o.id === d.id) continue;
                    if (Math.abs(nx - o.x) < SNAP) nx = o.x;
                    if (Math.abs(ny - o.y) < SNAP) ny = o.y;
                  }
                  // Grid snap — every 20px (matches the canvas grid).
                  const gx = Math.round(nx / 20) * 20;
                  const gy = Math.round(ny / 20) * 20;
                  if (Math.abs(nx - gx) < 3) nx = gx;
                  if (Math.abs(ny - gy) < 3) ny = gy;
                }
                onMoveDevice(d.id, nx, ny);
              }}
              onPointerUp={(e) => {
                if (moveRef.current?.id === d.id) moveRef.current = null;
                setMovingId(null);
                // releasePointerCapture throws InvalidPointerId if the
                // element never captured this pointer (which is the case
                // when setPointerCapture failed silently — synthetic
                // events, browsers that lost the capture during a re-render,
                // or click without a held drag). The throw unmounts the
                // React root if it bubbles out of the synthetic event handler.
                // Guard with hasPointerCapture + try/catch.
                try {
                  const el = e.currentTarget as Element;
                  if ('hasPointerCapture' in el && el.hasPointerCapture(e.pointerId)) {
                    el.releasePointerCapture(e.pointerId);
                  }
                } catch { /* pointer was never captured / already released */ }
                // Canvas-to-canvas stacking: if the released device lands
                // on top of a host (door / IDF / rack), fire an attach
                // event regardless of whether the dragged thing is a
                // stack accessory — the parent's handler runs `canHost`
                // and either attaches (compatible) or shows a rejection
                // toast (incompatible, e.g. camera onto door).
                const here = renderedDevices.find((x) => x.id === d.id);
                if (here) {
                  let best: { host: Device; d: number } | null = null;
                  for (const o of devices) {
                    if (o.id === here.id) continue;
                    if (!isStackableHost(o.type) && o.type !== 'net.idf' && o.type !== 'net.mdf' && o.type !== 'inf.rack' && o.type !== 'inf.mdf') continue;
                    const dd = Math.hypot(o.x - here.x, o.y - here.y);
                    if (dd < 28 && (!best || dd < best.d)) best = { host: o, d: dd };
                  }
                  if (best) {
                    const svgEl = (ref as React.RefObject<SVGSVGElement>).current;
                    if (svgEl) svgEl.dispatchEvent(new CustomEvent('dv-stack-attach', {
                      detail: { childId: here.id, hostId: best.host.id },
                      bubbles: true,
                    }));
                  }
                }
                // Tell the parent the pointer is released. Physics
                // continues running until the device's visual position
                // settles onto the (snapped) store position.
                onDragEnd();
              }}
            >
              {/* Native browser tooltip on hover — label · mfr model · id. */}
              <title>{hoverTitle}</title>
              {/* Item 2 — selection ring is the on-canvas counterpart
                  to the bottom-docked SelectionPill. With the popup
                  anchored at the canvas bottom, the device itself
                  needs a stronger visual mark so the operator's eye
                  links the menu to the glyph. Inner ring is solid,
                  outer ring is dashed and slightly larger for the
                  "you are here" emphasis Bluebeam / Verkada use. */}
              {isSel && (
                <>
                  <circle
                    cx={d.x} cy={d.y} r={13 * iconScale} fill="none"
                    stroke={tone} strokeWidth="1.4"
                    opacity="0.95"
                    style={{ animation: 'soft-fade-in 200ms ease-out both' }}
                  />
                  <circle
                    cx={d.x} cy={d.y} r={18 * iconScale} fill="none"
                    stroke={tone} strokeWidth="0.8"
                    strokeDasharray="3 3"
                    opacity="0.55"
                    style={{ animation: 'soft-fade-in 220ms ease-out both' }}
                  />
                </>
              )}
              {/* Canvas V3.9 — multisensor "breathing ring" removed. Was
                  a 3.2s ease-in-out infinite opacity loop on the selected
                  camera body. Per the V3 motion brief: "no decorative
                  motion, no playful springs" and "Selection: precise ring
                  or stroke, no halo or glow." The selection halo + lens
                  cones already telegraph which camera is active; the
                  breathing ring was consumer-SaaS warmth, not Bluebeam
                  restraint. */}
              {multi && !isSel && <circle cx={d.x} cy={d.y} r={12 * iconScale} fill="none" stroke={tone} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.45" />}
              {/* Transparent hit-circle — guarantees the device is clickable
                  even when the underlying glyph is a thin line or a small
                  shape. Sized roughly at touch-target radius so the user
                  doesn't pixel-hunt the icon. */}
              <circle
                cx={d.x}
                cy={d.y}
                r={Math.max(16, 18 * iconScale)}
                fill="transparent"
                pointerEvents="all"
                data-hit="device"
              />
              {/* Extended hit target for door-host assembly chips.
                  The chip renders at (d.x + ~12 to d.x + ~26, d.y - 20
                  to d.y - 7) — fully outside the 18-px hit circle above.
                  Without this rect, clicks on the chip area fall through
                  to floorplan geometry and the door isn't selectable
                  from its own badge. The rect lives inside the same
                  device `<g>`, so the existing onPointerDown / onClick
                  selection handlers fire when it's clicked. Stays
                  transparent so it doesn't paint anything visible. */}
              {isDoorish && (d.doorAssembly?.length ?? 0) > 0 && (
                <rect
                  x={d.x + (12 * iconScale) - 16}
                  y={d.y - (14 * iconScale) - 8}
                  width={32}
                  height={17}
                  rx={3}
                  fill="transparent"
                  pointerEvents="all"
                  data-hit="device-chip"
                />
              )}
              {/* When the device is selected, wrap the glyph in a filter
                  group that paints a soft drop shadow underneath. Reads
                  as gentle elevation rather than HUD selection glow. */}
              <g filter={isSel ? 'url(#device-elevation)' : undefined} pointerEvents="none">
                <HardwareGlyph d={d} tone={tone} selected={isSel} scale={iconScale} />
              </g>
              {/* Opening-rectangle selected hint — drawn only for
                  door / gate / opening hosts when they're the selected
                  device. A subtle dashed rounded-rect indicates "this
                  is the active opening" without overpowering the plan.
                  Sits behind the device glyph + RLXMCP badge so the
                  surveyor still reads the door clearly. */}
              {isSel && isStackableHost(d.type) && (
                <rect
                  x={d.x - 13 * iconScale}
                  y={d.y - 9 * iconScale}
                  width={26 * iconScale}
                  height={18 * iconScale}
                  rx={2}
                  fill="none"
                  stroke={tone}
                  strokeWidth="0.7"
                  strokeDasharray="3 2"
                  opacity="0.75"
                  pointerEvents="none"
                  data-testid={`door-selected-hint-${d.id}`}
                />
              )}
              {/* Host badge.
                  For door / gate / opening hosts we render a compact
                  "assembly summary" chip: the component count + five
                  small dots representing the major access-control
                  classes (Reader, Lock, eXit/REX, Monitor, Power). Each
                  dot is filled when the door's doorAssembly carries any
                  component in that class, hollow otherwise. Gives an
                  at-a-glance "what's on this opening" without opening
                  the inspector. Chip sits at the top-right of the
                  device hit-circle with pointerEvents="none" so it
                  never blocks selection.
                  For IDF / rack hosts we keep the legacy stack[] count. */}
              {(() => {
                const isOpeningHost = isStackableHost(d.type);
                if (isOpeningHost) {
                  const asm = d.doorAssembly ?? [];
                  if (asm.length === 0) return null;
                  // Class buckets — surveyor shorthand R L X M C P.
                  // Controller and PSU are tracked separately so the badge
                  // can show "everything except the controller" at a glance.
                  const has = {
                    R: asm.includes('reader'),
                    L: asm.includes('strike') || asm.includes('maglock'),
                    X: asm.includes('rex') || asm.includes('panic') || asm.includes('autoop'),
                    M: asm.includes('dps') || asm.includes('contact'),
                    C: asm.includes('controller'),
                    P: asm.includes('psu'),
                  };
                  const classes: Array<keyof typeof has> = ['R','L','X','M','C','P'];
                  const chipX = d.x + 12 * iconScale;
                  const chipY = d.y - 14 * iconScale;
                  return (
                    <g pointerEvents="none">
                      <rect
                        x={chipX - 15} y={chipY - 6}
                        width={31} height={13} rx={3}
                        fill="var(--card)" stroke={tone} strokeWidth="0.7" fillOpacity="0.96"
                      />
                      <text x={chipX - 10} y={chipY + 3.2} textAnchor="middle" fontSize="9" fontWeight="700" fill={tone}>
                        {asm.length}
                      </text>
                      {/* dots — one per class, filled when present */}
                      {classes.map((cls, i) => (
                        <circle
                          key={cls}
                          cx={chipX - 4 + i * 3}
                          cy={chipY + 0.5}
                          r={1.05}
                          fill={has[cls] ? tone : 'transparent'}
                          stroke={tone}
                          strokeWidth="0.5"
                        />
                      ))}
                    </g>
                  );
                }
                const count = d.stack?.length ?? 0;
                if (count === 0) return null;
                return (
                  <g pointerEvents="none">
                    <circle cx={d.x + 10 * iconScale} cy={d.y - 10 * iconScale} r={6} fill={tone} stroke="var(--canvas-background)" strokeWidth="1.2" />
                    <text x={d.x + 10 * iconScale} y={d.y - 7.5 * iconScale} textAnchor="middle" fill="var(--canvas-background)" fontSize="9" fontWeight="700">
                      {count}
                    </text>
                  </g>
                );
              })()}
              {/* Label pill — primary line + a small make/model caption.
                  Gated by BOTH the `labels` engineering layer AND the
                  user's label density preference (hidden / selected /
                  important / all). Selected device's label always wins
                  so identity is never ambiguous.

                  Primary text: V3 catalog browsing pass made the
                  user's room name (d.label) win over the technical tag
                  (d.id) when present, matching the drawer headline.
                  Falls back to d.id when no label has been set yet.

                  Secondary caption: for plotted cameras with a
                  resolved catalog product, show `${mfr} ${model}`
                  beneath the room name (e.g. "Axis P3267"). Always
                  shown — not just on selection — so the engineering
                  identity reads at a glance. Never invented: a device
                  without a catalog product gets no caption. */}
              {layers.labels && labelVisibleFor(d, display.labelDensity, isSel) && (() => {
                // Cap the primary text to keep the pill width bounded
                // when the operator types a long room name. The map
                // already truncates the visible text via the <text>
                // measurement when it overflows; we just don't want the
                // background rect to grow past ~140 px regardless of
                // how many code points are in d.label.
                const rawPrimary = d.label || d.id;
                const primary = rawPrimary.length > 22 ? rawPrimary.slice(0, 21) + '…' : rawPrimary;
                const pillW = Math.min(160, primary.length * 6.8 + 12);
                const pillX = -pillW / 2;
                const isCameraKind = TYPE_KIND[d.type] === 'camera';
                // PRODUCTS_BY_ID lookup is O(1); the old PRODUCTS.find
                // ran the full catalog scan per camera per render which
                // showed up in pan/zoom/drag profiles.
                const product = isCameraKind && d.product ? PRODUCTS_BY_ID.get(d.product) : undefined;
                const rawCaption = product ? productLabel(product) : '';
                const captionText = rawCaption.length > 26 ? rawCaption.slice(0, 25) + '…' : rawCaption;
                const captionW = captionText ? Math.min(170, captionText.length * 5.5 + 12) : 0;
                return (
                  <g transform={`translate(${d.x}, ${d.y + 7 + 15 * iconScale})`} pointerEvents="none">
                    {/* Architectural callout: hairline frame, no tone stroke.
                        The device's color identity is already carried by the
                        glyph; the label's job is just to name it quietly. */}
                    <rect
                      x={pillX} y={-7}
                      width={pillW} height={14} rx={3}
                      fill="var(--panel-background)" stroke="var(--border)" strokeWidth="0.5"
                      fillOpacity="0.92"
                    />
                    <text x={0} y={3} textAnchor="middle" fill="var(--foreground)" fontSize="10" fontWeight="500" letterSpacing="0.02em">{primary}</text>
                    {captionText && (
                      <g transform="translate(0, 16)">
                        <rect x={-captionW / 2} y={-6} width={captionW} height={11} rx={2} fill="var(--panel-background)" fillOpacity="0.88" stroke="var(--border)" strokeWidth="0.4" />
                        <text x={0} y={2} textAnchor="middle" fill={tone} fontSize="9" fontWeight="500" fontFamily="ui-monospace, monospace">{captionText}</text>
                      </g>
                    )}
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Rotation ring + DORI handle on the selected camera (direct manipulation).
            For multisensors: when a specific lens is active AND the device is
            in independent mode, rotating the ring rotates ONLY that lens (lens
            local rotation, relative to device). In linked mode — or with 'all'
            active — it rotates the device body (which carries all lenses). */}
        {(() => {
          // Use renderedDevices so the rotation ring and cone handles
          // stick to the selected device's *lagged* position during
          // drag — otherwise the manipulation rig would teleport ahead
          // of the device visual.
          const s = renderedDevices.find((d) => d.id === selId);
          if (!s || TYPE_KIND[s.type] !== 'camera') return null;
          // Audit Group B.4 (second pass) — planBounds for clamping
          // ConeHandles to stay inside the floor plan, computed the
          // same way as the FOV IIFE up above. Camera cones already
          // clip to this rect; handles now clamp to it too.
          const planBoundsLocal = (floorBackground && floorBackground.naturalWidth && floorBackground.naturalHeight)
            ? {
                x: floorBackground.x,
                y: floorBackground.y,
                w: floorBackground.naturalWidth * (floorBackground.scale ?? 1),
                h: floorBackground.naturalHeight * (floorBackground.scale ?? 1),
              }
            : { x: 80, y: 80, w: 640, h: 480 };
          const isMs = s.type === 'cam.multisensor';
          const lensMode = s.lensMode ?? 'linked';
          const rotateLens = isMs && activeLens !== 'all' && lensMode === 'independent';
          const ringColor = rotateLens ? LENS_TONE[activeLens as LensId] : undefined;
          const handleRotate = (r: number) => {
            if (rotateLens) {
              const ls = getLenses(s);
              const k = activeLens as LensId;
              // Lens rotation is stored RELATIVE to the device body, so we
              // subtract d.rot to keep behavior intuitive when the user later
              // rotates the body.
              const relative = ((r - s.rot) % 360 + 360) % 360;
              onUpdateDevice(s.id, { lenses: { ...ls, [k]: { ...ls[k], rotation: relative } } });
            } else {
              onRotateDevice(s.id, r);
            }
          };
          return (
            <>
              {/* RotationRing renders for multisensors only — single-lens cameras
                  now drive rotation entirely through the mid-cone puck on
                  ConeHandles (Axis-style). DEFECT FIX (2026-05-24): the near-
                  marker ring + the cone puck both wrote to `d.rot`, which the
                  operator read as a duplicate control. For multisensors we
                  keep the ring because the cone-puck path is intentionally
                  disabled there (no single cone to grab when activeLens
                  === 'all', and per-lens rotation only happens via the ring
                  in independent mode). */}
              {/* Audit follow-up — RotationRing is a coverage drawing
                  per Mohammad's brief; wrapping in the master plan
                  clip keeps the visible ring + ticks + heading badge
                  from extending past the plan border. The interactive
                  drag puck inside the ring is at d.rot * R=34 from
                  the device — well within the plan for any non-
                  pathological device position, so functional reach
                  is unaffected. */}
              {isMs && (
                <g clipPath="url(#master-plan-coverage-clip)">
                  <RotationRing d={s} onRotate={handleRotate} svgRef={ref as React.RefObject<SVGSVGElement>} zoom={zoom} pan={pan} overrideColor={ringColor} />
                </g>
              )}
              {/* Direct manipulation cone handles (rotate puck, FOV edges,
                  range tip). For single lens cameras one set attaches to
                  the camera's cone. For multisensor cameras (PASS D) a
                  set is mounted PER LENS — every enabled lens is
                  adjustable on the plan, regardless of which lens chip
                  is active in the drawer. */}
              {(() => {
                if (s.type === 'cam.fisheye') return null;
                if (isMs) {
                  // M9 (2026-05-26) — gate the per-lens handle mount on
                  // activeLens. Previously every enabled lens mounted
                  // its own rotation puck + FOV edges + range tip at
                  // the SAME origin (the device body), so all four
                  // handle sets piled up on one point and the operator
                  // could not reliably grab a specific lens.
                  //
                  // Spec: only the active lens's handles render. The
                  // other three cones still draw (FOV component already
                  // dims them via its activeLens prop) but they have no
                  // handles. When activeLens === 'all' (the default
                  // shared / linked-view state from the chip row),
                  // handles attach to lens 'a' so the user always has
                  // SOMETHING to grab; the chip row in the drawer is
                  // the way to switch which lens is being edited.
                  //
                  // Linked mode: FOV / range edits propagate to all
                  // four lenses (preserves each lens's per-quadrant
                  // rotation while equalising aperture + reach).
                  // Independent mode: writes only to the active lens.
                  // Rotation is ALWAYS per-lens because rotations are
                  // what aim each lens at its quadrant; even in linked
                  // mode the rotation goes to the active lens alone.
                  const ls = getLenses(s);
                  const effectiveLens: LensId = activeLens === 'all' ? 'a' : (activeLens as LensId);
                  return (
                    <>
                      {(['a', 'b', 'c', 'd'] as const).map((k) => {
                        const L = ls[k];
                        if (!L.enabled) return null;
                        // Only the active lens gets handles. Other
                        // enabled lenses still show their cones (drawn
                        // by FOV at reduced opacity via its own
                        // activeLens prop) but no interactive handles.
                        if (k !== effectiveLens) return null;
                        return (
                          <ConeHandles
                            key={`ms-${s.id}-${k}`}
                            cx={s.x} cy={s.y}
                            rotDeg={((L.rotation + s.rot) % 360 + 360) % 360}
                            fovDeg={L.fov}
                            rangeFt={L.range}
                            pxToFt={currentFloorPxToFt}
                            svgRef={ref as React.RefObject<SVGSVGElement>}
                            zoom={zoom}
                            pan={pan}
                            color={LENS_TONE[k]}
                            onUpdate={(p) => {
                              const latest = useProjectStore.getState().devices[s.id];
                              const baseLenses = latest ? getLenses(latest) : ls;
                              if (lensMode === 'linked') {
                                const next: typeof baseLenses = {
                                  a: { ...baseLenses.a, ...p },
                                  b: { ...baseLenses.b, ...p },
                                  c: { ...baseLenses.c, ...p },
                                  d: { ...baseLenses.d, ...p },
                                };
                                onUpdateDevice(s.id, { lenses: next });
                              } else {
                                onUpdateDevice(s.id, { lenses: { ...baseLenses, [k]: { ...baseLenses[k], ...p } } });
                              }
                            }}
                            onRotate={(rotDeg) => {
                              const relative = ((rotDeg - s.rot) % 360 + 360) % 360;
                              const latest = useProjectStore.getState().devices[s.id];
                              const baseLenses = latest ? getLenses(latest) : ls;
                              onUpdateDevice(s.id, { lenses: { ...baseLenses, [k]: { ...baseLenses[k], rotation: relative } } });
                            }}
                            planBounds={planBoundsLocal}
                          />
                        );
                      })}
                    </>
                  );
                }
                // Single-lens camera
                const defaultRangeFt = s.type === 'cam.ptz' ? 44 : s.type === 'cam.bullet' ? 50 : 30;
                const defaultFovDeg  = s.type === 'cam.ptz' ? 36 : 70;
                return (
                  <ConeHandles
                    cx={s.x} cy={s.y}
                    rotDeg={s.rot}
                    fovDeg={s.fov ?? defaultFovDeg}
                    rangeFt={s.range ?? defaultRangeFt}
                    pxToFt={currentFloorPxToFt}
                    svgRef={ref as React.RefObject<SVGSVGElement>}
                    zoom={zoom}
                    pan={pan}
                    color={KIND_TONE.camera}
                    planBounds={planBoundsLocal}
                    onUpdate={(p) => onUpdateDevice(s.id, p)}
                    onRotate={(rotDeg) => onRotateDevice(s.id, rotDeg)}
                  />
                );
              })()}
              {/* Person probe — draggable marker tied to this camera.
                  Reads the SAME density chain as the cone DORI bands
                  (pxPerFtAt is the inverse of doriBandsFor's d_T).
                  Renders only for single-lens cameras with a known
                  resolution; the marker drops out of mount for
                  multisensor / fisheye / unresolved cameras. */}
              {!isMs && s.type !== 'cam.fisheye' && personProbePos && currentFloorPxToFt > 0 && (
                <PersonProbe
                  d={s}
                  pos={personProbePos}
                  onMove={setPersonProbePos}
                  pxToFt={currentFloorPxToFt}
                  svgRef={ref as React.RefObject<SVGSVGElement>}
                  zoom={zoom}
                  pan={pan}
                />
              )}
            </>
          );
        })()}

        {/* Per-vertex editor for the currently-selected pathway. Renders
            small drag handles at every vertex + a hover "+" affordance
            on each segment for inserting a new vertex. Visible ONLY when
            a pathway is selected — never for unselected pathways, never
            when only a device is selected. Mounted AFTER the device loop
            so handles paint above both pathways and devices. */}
        {selPathwayId && (
          <PathwayVertexEditor
            pathwayId={selPathwayId}
            svgRef={ref as React.RefObject<SVGSVGElement>}
            zoom={zoom}
            pan={pan}
            snap={snap}
            pxToFt={currentFloorPxToFt}
          />
        )}

        {/* Live snap guides while dragging — vertical & horizontal alignment lines */}
        {movingDev && snapTargets.map((g, i) => (
          <g key={`snap-${i}`} pointerEvents="none">
            {g.axis === 'v' ? (
              <line x1={g.coord} y1={0} x2={g.coord} y2={10000} stroke="#7CC2FF" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.7" />
            ) : (
              <line x1={0} y1={g.coord} x2={10000} y2={g.coord} stroke="#7CC2FF" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.7" />
            )}
            <circle cx={g.otherX} cy={g.otherY} r={3} fill="#7CC2FF" opacity="0.8" />
          </g>
        ))}

        {/* Distance line to nearest neighbor while dragging */}
        {movingDev && nearest && (
          <g pointerEvents="none">
            <line x1={movingDev.x} y1={movingDev.y} x2={nearest.x} y2={nearest.y} stroke="#FACC15" strokeWidth="0.7" strokeDasharray="2 2" opacity="0.85" />
            <g transform={`translate(${(movingDev.x + nearest.x) / 2}, ${(movingDev.y + nearest.y) / 2})`}>
              <rect x={-20} y={-7} width={40} height={14} rx={3} fill="var(--panel-background)" fillOpacity="0.9" stroke="#FACC15" strokeWidth="0.5" />
              <text textAnchor="middle" y={3} fontSize="9" fontFamily="ui-monospace, monospace" fill="#FACC15" fontWeight="700">
                {(nearest.d * currentFloorPxToFt).toFixed(1)} ft
              </text>
            </g>
          </g>
        )}

        {/* Live telemetry HUD attached to the moving device */}
        {movingDev && (
          <g pointerEvents="none" transform={`translate(${movingDev.x + 18}, ${movingDev.y - 32})`}>
            <rect x={0} y={-12} width={108} height={36} rx={4} fill="var(--panel-background)" fillOpacity="0.92" stroke="rgba(124,194,255,0.45)" strokeWidth="0.7" />
            <text x={6} y={0} fontSize="9" fontFamily="ui-monospace, monospace" fill="#94A3B8" letterSpacing="0.6">X · Y · NEAR</text>
            <text x={6} y={11} fontSize="10" fontFamily="ui-monospace, monospace" fill="var(--foreground)" fontWeight="700">
              {(movingDev.x * currentFloorPxToFt).toFixed(1)} · {(movingDev.y * currentFloorPxToFt).toFixed(1)} ft
            </text>
            <text x={6} y={21} fontSize="9" fontFamily="ui-monospace, monospace" fill="#7CC2FF">
              {nearest ? `${nearest.id} · ${(nearest.d * currentFloorPxToFt).toFixed(1)} ft` : 'isolated'}
            </text>
          </g>
        )}

        {/* Engineering density: dimension chains between adjacent cameras.
            Gated by the `dimensions` engineering layer (default off — only
            on when the user wants to see camera-to-camera spacing). */}
        {layers.dimensions && (() => {
          const cams = renderedDevices.filter((d) => TYPE_KIND[d.type] === 'camera').sort((a, b) => a.x - b.x);
          const pairs: { a: Device; b: Device }[] = [];
          for (let i = 0; i < cams.length - 1; i++) pairs.push({ a: cams[i], b: cams[i + 1] });
          return pairs.map((p, i) => {
            const dist = Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y);
            const mx = (p.a.x + p.b.x) / 2;
            const my = (p.a.y + p.b.y) / 2;
            return (
              <g key={`dim-${i}`} pointerEvents="none" opacity="0.65">
                <line x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} stroke="#94A3B8" strokeWidth="0.4" strokeDasharray="1 3" />
                <rect x={mx - 18} y={my - 7} width={36} height={12} rx={2} fill="var(--panel-background)" fillOpacity="0.85" stroke="rgba(148,163,184,0.45)" strokeWidth="0.4" />
                <text x={mx} y={my + 3} textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill="#CBD5E1">
                  {(dist * currentFloorPxToFt).toFixed(1)}′
                </text>
              </g>
            );
          });
        })()}

        {/* Measure tool — live distance line between two clicks, with a
            distance chip at the midpoint. Renders in real engineering
            yellow so it never gets confused with FOV cones or pathways. */}
        {tool === 'calibrate' && calibrate.a && (() => {
          const end = calibrate.b ?? calibrate.cursor ?? calibrate.a;
          const dx = end.x - calibrate.a.x;
          const dy = end.y - calibrate.a.y;
          const distPx = Math.hypot(dx, dy);
          const mx = (calibrate.a.x + end.x) / 2;
          const my = (calibrate.a.y + end.y) / 2;
          const committed = !!calibrate.b;
          return (
            <g pointerEvents="none" data-testid="calibrate-line">
              <line
                x1={calibrate.a.x} y1={calibrate.a.y}
                x2={end.x} y2={end.y}
                stroke="#22D3EE" strokeWidth="1.4"
                strokeDasharray={committed ? undefined : "4 3"}
                opacity={committed ? 1 : 0.85}
              />
              <circle cx={calibrate.a.x} cy={calibrate.a.y} r={3.5} fill="#22D3EE" stroke="var(--canvas-background)" strokeWidth="1" />
              <circle cx={end.x} cy={end.y} r={3.5} fill="#22D3EE" stroke="var(--canvas-background)" strokeWidth="1" />
              <g transform={`translate(${mx}, ${my - 12})`}>
                <rect x={-34} y={-9} width={68} height={18} rx={3} fill="var(--panel-background)" fillOpacity="0.94" stroke="#22D3EE" strokeWidth="0.6" />
                <text textAnchor="middle" y={4} fontSize="10" fontFamily="ui-monospace, monospace" fill="#22D3EE" fontWeight="700">
                  {Math.round(distPx)} px
                </text>
              </g>
            </g>
          );
        })()}

        {/* Canvas V2 Pass 1.8 — persisted tape-measure overlays.
            Always rendered (across tool switches), gated only by the
            show / hide toggle. Click the label to remove a single
            measurement; the in-progress measure render below covers
            the active draw. */}
        {measurementsVisible !== false && persistedMeasurements?.map((m) => {
          const dx = m.b.x - m.a.x;
          const dy = m.b.y - m.a.y;
          const distPx = Math.hypot(dx, dy);
          const ft = distPx * currentFloorPxToFt;
          const mx = (m.a.x + m.b.x) / 2;
          const my = (m.a.y + m.b.y) / 2;
          return (
            <g key={m.id}>
              <line
                x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y}
                stroke="#FACC15" strokeWidth="1.1" opacity="0.85"
                pointerEvents="none"
              />
              <circle cx={m.a.x} cy={m.a.y} r={2.5} fill="#FACC15" pointerEvents="none" />
              <circle cx={m.b.x} cy={m.b.y} r={2.5} fill="#FACC15" pointerEvents="none" />
              <g
                transform={`translate(${mx}, ${my})`}
                style={{ cursor: onRemoveMeasurement ? 'pointer' : 'default' }}
                onClick={(e) => { e.stopPropagation(); onRemoveMeasurement?.(m.id); }}
              >
                <rect x={-32} y={-9} width={64} height={18} rx={4} fill="var(--panel-background)" fillOpacity="0.92" stroke="#FACC15" strokeWidth="0.6" />
                <text textAnchor="middle" y={4} fontSize="11" fontFamily="ui-monospace, monospace" fill="#FACC15" fontWeight="700">
                  {ft.toFixed(1)} ft
                </text>
              </g>
            </g>
          );
        })}

        {tool === 'measure' && measure.start && (() => {
          const end = measure.end ?? measure.cursor ?? measure.start;
          const dx = end.x - measure.start.x;
          const dy = end.y - measure.start.y;
          const distPx = Math.hypot(dx, dy);
          const ft = distPx * currentFloorPxToFt;
          const mx = (measure.start.x + end.x) / 2;
          const my = (measure.start.y + end.y) / 2;
          const committed = !!measure.end;
          return (
            <g pointerEvents="none">
              <line
                x1={measure.start.x} y1={measure.start.y}
                x2={end.x} y2={end.y}
                stroke="#FACC15" strokeWidth="1.2"
                strokeDasharray={committed ? undefined : "3 3"}
                opacity={committed ? 1 : 0.85}
              />
              {/* End-tick marks */}
              <circle cx={measure.start.x} cy={measure.start.y} r={3} fill="#FACC15" />
              <circle cx={end.x} cy={end.y} r={3} fill="#FACC15" />
              <g transform={`translate(${mx}, ${my})`}>
                <rect x={-32} y={-9} width={64} height={18} rx={4} fill="var(--panel-background)" fillOpacity="0.92" stroke="#FACC15" strokeWidth="0.6" />
                <text textAnchor="middle" y={4} fontSize="11" fontFamily="ui-monospace, monospace" fill="#FACC15" fontWeight="700">
                  {ft.toFixed(1)} ft
                </text>
              </g>
            </g>
          );
        })()}

        {/* Committed pathways (cable bundles + manual cable draws). Each
            render as a thin cyan polyline; bundle paths get a count badge
            at their midpoint so the user sees "10x Cat6A → IDF-01"
            without opening any inspector. */}
        {marqueeLocal && (
          <rect
            x={Math.min(marqueeLocal.x0, marqueeLocal.x1)}
            y={Math.min(marqueeLocal.y0, marqueeLocal.y1)}
            width={Math.abs(marqueeLocal.x1 - marqueeLocal.x0)}
            height={Math.abs(marqueeLocal.y1 - marqueeLocal.y0)}
            fill="#5DA0E8"
            fillOpacity="0.08"
            stroke="#5DA0E8"
            strokeWidth="1"
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}

        {/* PathwaysOverlay used to be rendered here, AFTER devices. Moved
            above the devices map (see comment there) so device clicks are
            no longer stolen by pathway hit-strokes. */}

        {/* Cable draw — vertices already committed render as a solid
            polyline; the active rubber-band segment to the cursor is
            dashed so the user always knows where the next click will go.
            Each committed vertex gets a small handle so the path reads
            as a real edited route, not a transient hover effect. Esc to
            cancel, Enter or double-click to finish. */}
        {tool === 'cable' && cableDraw.points.length > 0 && (() => {
          const pts = cableDraw.points;
          const cursor = cableDraw.cursor ?? pts[pts.length - 1];
          let lengthPx = 0;
          for (let i = 1; i < pts.length; i++) {
            lengthPx += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          }
          if (cableDraw.cursor && pts.length > 0) {
            lengthPx += Math.hypot(cursor.x - pts[pts.length - 1].x, cursor.y - pts[pts.length - 1].y);
          }
          const ft = lengthPx * currentFloorPxToFt;
          const tipX = cursor.x;
          const tipY = cursor.y;
          return (
            <g pointerEvents="none">
              {/* Committed segments — solid */}
              {pts.length >= 2 && (
                <polyline
                  points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none" stroke="#F2C744" strokeWidth="1.4" opacity="0.88"
                />
              )}
              {/* Live rubber-band to cursor — dashed */}
              {cableDraw.cursor && (
                <line
                  x1={pts[pts.length - 1].x} y1={pts[pts.length - 1].y}
                  x2={cursor.x} y2={cursor.y}
                  stroke="#F2C744" strokeWidth="1.4" strokeDasharray="4 3" opacity="0.75"
                />
              )}
              {/* Vertex handles */}
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#0E1424" stroke="#F2C744" strokeWidth="1.2" />
              ))}
              {/* Length chip at the head */}
              <g transform={`translate(${tipX + 12}, ${tipY - 18})`}>
                <rect x={0} y={-10} width={88} height={20} rx={4} fill="var(--panel-background)" fillOpacity="0.92" stroke="#F2C744" strokeWidth="0.6" />
                <text x={6} y={3} fontSize="10" fontFamily="ui-monospace, monospace" fill="#F2C744" fontWeight="600">
                  {cableDraw.cableType.toUpperCase()} · {ft.toFixed(1)} ft
                </text>
              </g>
              {/* Hint */}
              <g transform={`translate(${tipX + 12}, ${tipY + 8})`}>
                <text fontSize="9" fontFamily="ui-sans-serif" fill="rgba(226,232,240,0.55)">
                  Enter / dbl-click to finish · Esc cancels
                </text>
              </g>
            </g>
          );
        })()}

        {/* Drag-onto-host attach ring. Visible only while a drag from
            the library is in flight AND the cursor is over a candidate
            host (door / gate / exit / IDF / MDF). Green ring + "Attach"
            label when compatible; rose ring + reason when not. Soft
            breathe via the existing glow-breathe keyframe so the host
            communicates magnetism without flashing. */}
        {hoverHost && (() => {
          const ringTone = hoverHost.allowed ? '#34D399' : '#F87171';
          return (
            <g pointerEvents="none">
              <circle
                cx={hoverHost.cx} cy={hoverHost.cy} r={26}
                fill="none" stroke={ringTone} strokeWidth="1.6"
                strokeDasharray="3 3" opacity="0.85"
                style={{ animation: 'glow-breathe 1.6s ease-in-out infinite' }}
              />
              <circle
                cx={hoverHost.cx} cy={hoverHost.cy} r={32}
                fill="none" stroke={ringTone} strokeWidth="0.8" opacity="0.25"
              />
              <g transform={`translate(${hoverHost.cx}, ${hoverHost.cy + 44})`}>
                <rect
                  x={-58} y={-9} width={116} height={18} rx={3}
                  fill="rgba(13,20,36,0.92)" stroke={ringTone} strokeWidth="0.7"
                />
                <text
                  x={0} y={3.5} textAnchor="middle"
                  fontSize="10" fontWeight="600" fontFamily="ui-sans-serif"
                  fill={ringTone}
                >
                  {hoverHost.allowed ? `Attach to ${hoverHost.id}` : 'Not compatible'}
                </text>
              </g>
            </g>
          );
        })()}

        {/* Presence cursors — live collaborators. Off by default; the
            engineer turns it on when they want to see who's also in the
            session. */}
        {layers.presence && presence.map((p) => (
          <g key={p.id} style={{ transition: 'transform 80ms linear' }} transform={`translate(${p.x}, ${p.y})`} pointerEvents="none">
            <path d="M 0 0 L 14 5 L 6 7 L 4 14 Z" fill={p.tone} stroke="var(--canvas-background)" strokeWidth="1" />
            <g transform="translate(14, 14)">
              <rect rx="3" ry="3" x="0" y="0" width={p.name.length * 6.2 + 12} height="16" fill={p.tone} />
              <text x="6" y="12" fill="var(--canvas-background)" fontSize="10" fontWeight="600">{p.name}</text>
            </g>
          </g>
        ))}
      </g>
      </g>
    </svg>
  );
});

/** Small honest badge on simulated map modes. The brief is explicit:
 *  if there's no live provider, label it. */
// SimulatedMapBadge moved to canvas/plan/SimulatedMapBadge.tsx
// (M11 monolith breakup). Import at top of file.


// ─────────────────────────── DORI detection bands ──────────────────────
// V3 Pass 2 Part 2 — DORI (Detect / Observe / Recognize / Identify) is the
// IEC EN 50132-7 family of detection-grade thresholds expressed in pixels
// on target. The bands here show, for a given camera at a given calibrated
// scale and FOV / range, how far away the lens still resolves enough pixels
// to satisfy each grade — straight engineering math, no theatrical lies.
//
// Math:
//   At distance d (ft) from the camera the horizontal field width is
//     w(d) = 2 · d · tan(FOV / 2)        [feet]
//   The camera's horizontal sensor pixels are then spread evenly across
//   that width, so pixels per foot at distance d is
//     px_per_ft(d) = horizontalPx / w(d)
//   For a target grade with threshold T (px/ft), the maximum distance
//   that still hits that threshold is
//     d_T = horizontalPx / (2 · T · tan(FOV / 2))
//
// The bands are concentric annular sectors inside the cone:
//   identify  : 0     → d_I  (closest, brightest band)
//   recognize : d_I   → d_R
//   observe   : d_R   → d_O
//   detect    : d_O   → d_D  (or rangeFt, whichever is smaller)
// Anything past d_D — the camera produces an image but it's below detect
// grade. We deliberately do NOT colour that region.
//
// Honesty gate: a camera without a known resolution renders NO bands and
// surfaces a small "set camera resolution" hint inside its cone instead of
// silently faking a band. Multi sensor and fisheye cones don't get bands
// either (the simple single-cone geometry doesn't apply) — they keep the
// legacy decorative arcs.

/** Map of catalog `Product.resolution` labels → horizontal × vertical
 *  pixels. Numbers reflect the typical sensor for each label as quoted in
 *  the Axis / Hikvision / Hanwha / Bosch spec sheets we've sampled; close
 *  enough to do honest range math even when a SKU spec varies by ±10%.
 *
 *  Includes every label the catalog actually writes today (720p, 1080p,
 *  2MP, 4MP, 5MP, 6MP, 8MP, 4K, 12MP, 8K). 2MP is the marketing alias for
 *  1080p; 4K and 8MP both resolve to 3840×2160 (the dual labelling is a
 *  vendor habit). The drawer's PRESETS list is derived from this map so
 *  adding a new label here automatically surfaces a chip in the UI.
 *  `multi-sensor` is intentionally absent — each lens of a multi sensor
 *  carries its own resolution and is rendered per-lens, not via the
 *  single-cone DORI path. */

/** Direct-manipulation handles attached to the cone (V3 Pass 2 Part 1
 *  — Axis-style three-handle adjustment).
 *
 *  Three handles, all on the fan:
 *    1. ROTATE — small puck midway along the aim line. Drag angularly
 *       around the camera center to spin the whole fan. Writes to
 *       `rot`. Only shown when `onRotate` is passed (single-lens
 *       cameras); multisensors keep their drawer-based per-lens
 *       rotation editing for now.
 *    2. FOV — two edge handles at the cone's outside arc. Drag either
 *       to widen/narrow the aperture.
 *    3. RANGE — tip handle at the apex. Drag radially to extend or
 *       shorten reach.
 *
 *  A single consolidated readout chip below the marker shows
 *  rot° · fov° · range ft · px/ft. The currently-dragged value is
 *  rendered at full opacity; the others stay quieter so the eye lands
 *  on the value the operator is changing.
 *
 *  Geometry honors the calibrated per-floor scale (`pxToFt`, units of
 *  feet-per-pixel) end to end: handle positions, drag math, readout
 *  numbers all derive from the real calibration. Each handle writes
 *  through onUpdate which the caller wires to onUpdateDevice — values
 *  persist via the Zustand store. */

/** Draggable person probe — V4 person probe pass.
 *
 *  Reads the SAME density chain as the cone DORI bands and the drawer
 *  density tiles. The marker has no density model of its own; it asks
 *  `pxPerFtAt` for the live density at its current ground distance,
 *  which is the inverse of the function that determines where each
 *  DORI band starts and ends. By construction the readout agrees with
 *  the band the marker sits in.
 *
 *  Scope: 2D ground distance only. No height / tilt slant model in
 *  this pass per the brief. A 3D refinement (mount height + tilt
 *  giving an effective slant distance to the subject's face) is a
 *  worthwhile follow up but kept separate.
 *
 *  Honesty: outside the cone, no faked number — the marker still
 *  drags but the canvas callout and the drawer preview both flip to
 *  "No coverage here". When resolution or per floor calibration is
 *  missing, the probe doesn't mount at all (caller gates). */

/* ═══════════════════════════════════════════════════════════════════════
   SELECTION PILL — floats near the selected device
   ═══════════════════════════════════════════════════════════════════════ */

type EditTab =
  | 'overview' | 'lens' | 'ai' | 'network' | 'power' | 'mounting'
  | 'compliance' | 'telemetry' | 'linked' | 'notes'
  // V18 surveyor redesign — accessory editor in the 3-icon grid. Media
  // and History were removed in Canvas V2 Pass 1.0; the union will be
  // re-extended when those features have real backing.
  | 'accessories'
  // MVP foundation pass — object-linked survey capture
  | 'survey'
  // Attachments / Files foundation pass — real shared file system
  | 'attachments';

interface ToolbarAction {
  id: string;
  icon: any;
  label: string;
  tone?: string;
  onClick: () => void;
  primary?: boolean;
  /** When true, this action is hidden by default and appears in the
   *  "More" overflow popover instead of the main toolbar row. Keeps
   *  the toolbar at ≤5 primary actions so it never feels like a wall
   *  of icons. */
  overflow?: boolean;
  /** Destructive action — rendered in rose in the overflow popover
   *  to telegraph "this removes something." */
  danger?: boolean;
}


/** V3.6 Part B — shared color picker popover used by both the
 *  category-level picker in the dock and the item-level picker in
 *  the SelectionPill toolbar. Renders the swatch button + a popover
 *  containing the preset palette (DEVICE_COLOR_PALETTE) plus a
 *  custom hex input for full freedom.
 *
 *  Popover positioning: rendered through ReactDOM.createPortal at
 *  document.body with `position: fixed`. Avoids container clipping
 *  bugs the kebab/ExpandMenu popover used to hit when the selected
 *  device sat near a canvas edge. On open we measure the trigger's
 *  viewport rect and pick a side (below preferred, above on
 *  underflow) and a horizontal alignment (left of trigger preferred,
 *  right-edge clamp on overflow), then clamp to a 6 px viewport
 *  inset.
 *
 *  `currentColor` is the resolved color this swatch represents.
 *  `onPick(hex)` is called with either a valid hex string or an
 *  empty string ("reset to default"). */
function ColorPicker({
  currentColor,
  onPick,
  title = 'Pick a color',
  size = 18,
  // `align` is retained for backwards compatibility with existing
  // call sites but is no longer the primary positioning input.
  // Positioning is computed from the trigger's viewport rect; the
  // align hint biases the horizontal preference when there's room
  // on either side.
  align: _align = 'left',
}: {
  currentColor: string;
  onPick: (hex: string) => void;
  title?: string;
  size?: number;
  align?: 'left' | 'right';
}) {
  void _align;
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(currentColor || '#5292DC');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Popover dimensions (rough; measured against actual content after
  // first paint). Used to compute flip/clamp before the menu has a
  // rendered rect of its own. 200 px wide, ~180 px tall covers the
  // 5-col preset grid + the custom-hex row.
  const POPOVER_W = 200;
  const POPOVER_H = 184;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const computePosition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const INSET = 6;
    const GAP = 4;
    // Use the menu's actual height once it's rendered; fall back to
    // the rough constant during first paint.
    const menuH = menuRef.current?.offsetHeight ?? POPOVER_H;
    const menuW = menuRef.current?.offsetWidth ?? POPOVER_W;
    // Vertical: prefer below; flip above on overflow; clamp to inset.
    let top = r.bottom + GAP;
    if (top + menuH > vh - INSET) {
      const aboveTop = r.top - menuH - GAP;
      if (aboveTop >= INSET) top = aboveTop;
      else top = Math.max(INSET, vh - menuH - INSET);
    }
    // Horizontal: prefer aligning the menu's LEFT edge with the
    // trigger's LEFT edge (so the picker reads as a dropdown under
    // the button). Flip to right-align on overflow; clamp to inset
    // on either side.
    let left = r.left;
    if (left + menuW > vw - INSET) {
      left = Math.max(INSET, r.right - menuW);
    }
    if (left < INSET) left = INSET;
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePosition();
    const onResize = () => computePosition();
    const onScroll = () => computePosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true); // capture so we get scroll events from any ancestor
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, computePosition]);

  // Recompute once the menu DOM has a real height (the rough constant
  // can be off by 10-20 px depending on font metrics; we measure and
  // adjust on the next animation frame so the flip/clamp uses true
  // dimensions).
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const rafId = requestAnimationFrame(() => computePosition());
    return () => cancelAnimationFrame(rafId);
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => { if (open) setCustom(currentColor || '#5292DC'); }, [open, currentColor]);

  const popover = open && pos ? (
    <div
      ref={menuRef}
      role="menu"
      data-testid="color-picker-menu"
      className="fixed z-[60] w-[200px] rounded-md p-2 space-y-2"
      style={{
        top: pos.top,
        left: pos.left,
        background: 'var(--popover)',
        border: '1px solid var(--border)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
      }}
    >
      <div className="grid grid-cols-5 gap-1.5">
        {DEVICE_COLOR_PALETTE.map((c) => {
          const isReset = c.id === 'reset';
          const isCurrent = (currentColor || '') === c.hex;
          if (isReset) {
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { onPick(''); setOpen(false); }}
                title="Use default color"
                data-testid="color-picker-reset"
                className={`h-7 rounded border text-[9px] tracking-tight transition-colors ${
                  !currentColor
                    ? 'border-primary/60 text-primary bg-primary/10'
                    : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                Default
              </button>
            );
          }
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => { onPick(c.hex); setOpen(false); }}
              title={c.name}
              data-testid={`color-picker-preset-${c.id}`}
              className="h-7 rounded border transition-colors flex items-center justify-center"
              style={{
                background: c.hex,
                borderColor: isCurrent ? 'var(--foreground)' : 'var(--border)',
              }}
            >
              {isCurrent && <Check className="w-3 h-3 text-white drop-shadow" />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
        <input
          type="color"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          data-testid="color-picker-custom"
          className="w-7 h-7 rounded cursor-pointer bg-transparent"
          aria-label="Custom color"
        />
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="#RRGGBB"
          className="flex-1 text-[10.5px] font-mono bg-transparent border border-border/60 rounded px-1.5 py-1 text-foreground focus:outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => {
            const hex = custom.trim();
            if (/^#([0-9a-fA-F]{6})$/.test(hex)) {
              onPick(hex);
              setOpen(false);
            }
          }}
          data-testid="color-picker-custom-apply"
          className="px-1.5 py-1 rounded text-[10px] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          OK
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={title}
        aria-label={title}
        data-testid="color-picker-swatch"
        className="rounded border border-border/60 hover:border-foreground transition-colors"
        style={{ width: size, height: size, background: currentColor }}
      />
      {popover && createPortal(popover, document.body)}
    </>
  );
}

/** Overflow popover anchored at the end of the SelectionPill toolbar.
 *  Holds destructive / secondary actions so the primary row stays at
 *  ≤5 buttons. Click outside or press Escape to close. */

/* ═══════════════════════════════════════════════════════════════════════
   EDIT DRAWER — right-side engineering inspector with 10 tabs
   ═══════════════════════════════════════════════════════════════════════ */

// Drawer sections rendered as a 3-icon-per-row grid in the redesigned
// right sidebar. One section = one tile = one bodyShows branch.
// Media and History were removed in Canvas V2 Pass 1.0 — the Media tab
// rendered a disabled "Add media" stub with a "Preview only · file
// persistence not wired" disclaimer, and History claimed a per-object
// change log that never shipped. Both violated the honesty contract.
// Files (AttachmentPanel) covers media; History returns when the audit
// store ships.
const EDIT_TABS: { id: EditTab; label: string; icon: any; covers: EditTab[] }[] = [
  { id: 'overview',   label: 'General',       icon: ListChecks,      covers: ['overview'] },
  { id: 'mounting',   label: 'Placement',     icon: Wrench,          covers: ['mounting'] },
  { id: 'lens',       label: 'Coverage',      icon: Aperture,        covers: ['lens', 'telemetry'] },
  { id: 'power',      label: 'Power',         icon: BatteryCharging, covers: ['power'] },
  { id: 'network',    label: 'Network',       icon: NetworkIcon,     covers: ['network'] },
  { id: 'accessories',label: 'Accessories',   icon: PencilRuler,     covers: ['accessories'] },
  { id: 'compliance', label: 'Compatibility', icon: ShieldCheck,     covers: ['compliance'] },
  { id: 'notes',      label: 'Notes',         icon: FileText,        covers: ['notes'] },
  { id: 'linked',     label: 'Stack',         icon: Layers,          covers: ['linked'] },
  { id: 'ai',         label: 'AI',            icon: Sparkles,        covers: ['ai'] },
  { id: 'survey',     label: 'Survey',        icon: ClipboardList,    covers: ['survey'] },
  { id: 'attachments', label: 'Files',        icon: Paperclip,       covers: ['attachments'] },
];

/** Return the tile set the drawer should expose for a given device.
 *  Cameras get Coverage / Lens; doors swap Coverage for a dedicated
 *  Hardware Stack tile; IDFs surface a Port-schedule view via the
 *  Network tile; cables don't get Coverage at all. The brief calls for
 *  category-specific menus, not a one-size-fits-all grid. */
function tilesForDevice(d: Device): { id: EditTab; label: string; icon: any; covers: EditTab[] }[] {
  const kind = TYPE_KIND[d.type];
  const isCamera   = kind === 'camera';
  const isDoor     = d.type === 'inf.door' || (d.type as string).startsWith('inf.door') || (d.type as string).startsWith('inf.gate') || (d.type as string).startsWith('inf.storefront') || (d.type as string).startsWith('inf.doubledoor');
  const isReader   = d.type === 'acc.reader' || d.type === 'acc.keypad';
  const isIdf      = d.type === 'net.idf' || d.type === 'net.mdf' || d.type === 'inf.rack' || d.type === 'inf.mdf';
  const isCable    = (d.type as string).startsWith('cab.') || (d.type as string).startsWith('cable');
  const includes = (ids: EditTab[]) => EDIT_TABS.filter((t) => ids.includes(t.id));
  // Survey + Notes are now part of every kind — surveyors capture
  // object-linked field evidence regardless of category.
  if (isDoor) {
    // Relabel the 'linked' tile to "Assembly" for doors — the section
    // body is the DoorAssemblySection (one persisted hardware schedule),
    // not the legacy device-stack picker. Keeps the icon + click target;
    // only the visible label changes.
    return includes(['overview','linked','mounting','accessories','network','power','compliance','survey','notes','attachments','ai'])
      .map((t) => t.id === 'linked' ? { ...t, label: 'Assembly' } : t);
  }
  if (isReader) {
    return includes(['overview','mounting','network','power','accessories','compliance','survey','notes','attachments','ai']);
  }
  if (isIdf) {
    return includes(['overview','network','power','accessories','compliance','linked','survey','notes','attachments','ai']);
  }
  if (isCable) {
    return includes(['overview','network','accessories','survey','notes','attachments','ai']);
  }
  if (isCamera) {
    // Camera-class drawer: General → Placement → Coverage → Network →
    // Power → Accessories → Compatibility → Files → AI → Notes → Survey.
    // The Stack ('linked') tab was removed because cameras have no
    // accessory-stack workflow — only doors host hardware schedules.
    // Files (attachments) is real persisted storage; the old preview-
    // only Media + History tabs stay dropped from the default set
    // because their bodies haven't landed.
    return includes(['overview','mounting','lens','network','power','accessories','compliance','attachments','ai','notes','survey']);
  }
  // Default: hide Coverage for non-cameras.
  return EDIT_TABS.filter((t) => t.id !== 'lens');
}

/** Which visible tile does this internal section belong to? Lets callers
 *  jump to a section (e.g. "show AI optimize") and have the tile highlight
 *  match. */
function tabGroupOf(t: EditTab): EditTab {
  for (const g of EDIT_TABS) if (g.covers.includes(t)) return g.id;
  return 'overview';
}
/** Render this section's body if the currently-active tab maps to it. */
function bodyShows(tab: EditTab, section: EditTab): boolean {
  return tabGroupOf(tab) === tabGroupOf(section);
}

/** Human-readable kind for the drawer header. */
function labelForKind(k: DeviceKind): string {
  return ({
    camera: 'Camera', access: 'Access', network: 'Network',
    power: 'Power', sensor: 'Sensor', audio: 'Audio',
    storage: 'Storage', display: 'Display', intrusion: 'Intrusion',
  } as Record<string, string>)[k] ?? k;
}

// Drawer building blocks — refined for editorial readability over HUD
// density. Sentence-case labels, no tracking, calmer weights, more
// breathing room. The drawer body should read like a configuration page,
// not a debug panel.
function Row({ label, value, tone }: { label: string; value: any; tone?: string }) {
  // Theme-aware contrast — the old code hardcoded value to #E7EDF6
  // and the divider to white/[0.04], which read as near-invisible on
  // the light drafting theme's white drawer surface. Both now route
  // through theme tokens so Mount values, PoE numbers, etc. stay
  // readable across all three themes.
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-b-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[12px] tabular-nums font-medium text-foreground" style={tone ? { color: tone } : undefined}>{value}</span>
    </div>
  );
}

/** Audit follow-up — inline number chip for the docked drawer's
 *  collapsed strip. Renders as a small label + numeric input pair.
 *  Click into the input to type a value; arrow keys step. The
 *  parent's onChange clamps to a valid range. Used for camera
 *  rotation / FOV / range so the operator can adjust the primary
 *  coverage levers without expanding the inspector. */
function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-[13px] font-medium text-foreground mb-3 tracking-tight">{title}</div>
      {children}
    </div>
  );
}

/** Accessories section in the camera inspector. Lists compatible mounts /
 *  junction boxes for the camera type, allows toggling them on/off — each
 *  selection persists on the device's `accessories[]` and rolls up into
 *  the BOM. */
/** Product overview section in the inspector. Renders the device's
 *  catalog metadata so the user can confirm what's specified without
 *  going to the Product Catalog. Read-only; falls back gracefully when
 *  the device was seeded without a catalog product. */
function ProductOverviewSection({ d }: { d: Device }) {
  const cat = CATALOG.find((p) => p.id === d.product);
  const updateDevice = useProjectStore((s) => s.updateDevice);
  // Calibrated px → ft for the device's own floor. Falls back to the
  // canvas default when the floor has no calibration recorded.
  const pxToFt = useProjectStore((s) => ftPerPxForFloor(d.floorId ? s.floors[d.floorId] : undefined));
  const isCam = TYPE_KIND[d.type] === 'camera';
  // Catalog products that match this device's type (e.g. only dome
  // models for a `cam.dome`). The picker won't offer a strike for a
  // camera; sub-types only.
  const compatibleModels = isCam
    ? CATALOG.filter((p) => p.deviceType === d.type || p.deviceType === (d.type as string).replace(/^cam\./, 'cam.'))
    : [];
  // When the user picks a different model, write the new product id +
  // copy over the resolution-default fields the camera-render code
  // already keys off of (range / fov derived from product if the
  // device's own values are still undefined). We never overwrite
  // user-set per-device values to avoid surprising them mid-design.
  const onChangeModel = (newId: string) => {
    const nextCat = CATALOG.find((p) => p.id === newId);
    if (!nextCat) return;
    const patch: any = { product: newId };
    updateDevice(d.id, patch);
    toast.message('Camera model changed', {
      description: `${productLabel(nextCat, nextCat.id)} — BOM, resolution, IR, NDAA flags now read from this catalog entry.`,
      duration: 4500,
    });
  };
  const Row2 = ({ label, value, tone }: { label: string; value: any; tone?: string }) =>
    value == null || value === '' ? null : (
      <div className="flex items-center justify-between text-[12px] py-1 border-b border-white/5 last:border-b-0">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground" style={{ color: tone }}>{value}</span>
      </div>
    );
  return (
    <>
      <DrawerSection title="Identity">
        <Row2 label="Tag" value={d.id} />
        <Row2 label="Type" value={d.type} />
        {cat && <Row2 label="Manufacturer" value={cat.manufacturer} />}
        {cat && <Row2 label="Model" value={cat.model} />}
        {cat?.productName && <Row2 label="Product" value={cat.productName} />}
        {cat?.productLine && <Row2 label="Line" value={cat.productLine} />}
        <Row2 label="Status" value={<span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34D399', boxShadow: '0 0 6px #34D399' }} />Online</span>} />
      </DrawerSection>

      {/* CameraModelPicker — only renders for camera-class devices. Lets
          the surveyor swap to a different catalog entry of the same
          sub-type (a dome stays a dome, a PTZ stays a PTZ) and see the
          resolution / IR / NDAA / MSRP read out from that catalog row
          immediately. Quick-chip row at the bottom shows the key specs
          from the currently-selected product so the surveyor doesn't
          have to scroll the full Product Details list. */}
      {isCam && (
        <DrawerSection title="Model selection">
          {compatibleModels.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">
              No catalog matches for this sub-type yet. Drop a different camera category from the bottom bar to seed a model.
            </div>
          ) : (
            <>
              <select
                value={d.product ?? ''}
                onChange={(e) => onChangeModel(e.target.value)}
                data-testid="camera-model-picker"
                className="w-full h-9 px-2 rounded-md border border-border bg-background text-[12px] text-foreground focus:outline-none focus:border-primary/60"
              >
                <option value="" disabled>Choose a model…</option>
                {compatibleModels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {productLabel(p, p.id)}{p.resolution ? ` · ${p.resolution}` : ''}
                  </option>
                ))}
              </select>
              {/* Spec chips — read straight from the selected catalog
                  entry. Each chip is honest about its source: only renders
                  if the catalog row carries the value. */}
              {cat && (
                <div className="mt-2 flex flex-wrap gap-1" data-testid="camera-spec-chips">
                  {cat.resolution && <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-foreground">{cat.resolution}</span>}
                  {cat.cameraType && <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-foreground">{cat.cameraType}</span>}
                  {cat.focalRange && <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-foreground">{cat.focalRange}</span>}
                  {d.ir && <span className="text-[10px] px-2 py-0.5 rounded border border-amber-400/30 bg-amber-400/10 text-amber-200">IR on</span>}
                  {cat.ndaa && <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">NDAA</span>}
                  {cat.ipRating && <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-muted-foreground">{cat.ipRating}</span>}
                </div>
              )}
              <div className="mt-2 text-[10px] text-muted-foreground">
                Catalog is a curated sample — vendor APIs are not connected. Switching model updates the BOM line and the spec chips above.
              </div>
            </>
          )}
        </DrawerSection>
      )}

      {isCam && d.type !== 'cam.multisensor' && d.type !== 'cam.fisheye' && (
        <CameraResolutionSection d={d} cat={cat ?? null} updateDevice={updateDevice} />
      )}

      {cat && (
        <DrawerSection title="Product details">
          <Row2 label="Category" value={cat.category} />
          {cat.subcategory && <Row2 label="Subcategory" value={cat.subcategory} />}
          {/* Audit Group C per-device-type rules — the Tech model row
              ("Cloud / On-prem / Hybrid") describes a software-stack
              concept that doesn't apply to passive infrastructure
              hardware (doors, gates, walls, fire devices). Suppress
              the row for those kinds instead of stamping "Cloud /
              On-prem / Hybrid" on every door. */}
          {(() => {
            const k = TYPE_KIND[d.type];
            const techApplies = k === 'camera' || k === 'network' || k === 'access' || k === 'audio' || k === 'storage' || k === 'display' || k === 'cyber';
            if (!techApplies) return null;
            return <Row2 label="Tech model" value={cat.techModels.length === 3 ? 'Cloud / On-prem / Hybrid' : cat.techModels.join(' · ')} />;
          })()}
          {cat.resolution && <Row2 label="Resolution" value={cat.resolution} />}
          {cat.cameraType && <Row2 label="Form factor" value={cat.cameraType} />}
          {cat.lensType && <Row2 label="Lens" value={cat.lensType + (cat.focalRange ? ` · ${cat.focalRange}` : '')} />}
          {cat.indoorOutdoor && <Row2 label="Indoor / outdoor" value={cat.indoorOutdoor} />}
          {cat.ipRating && <Row2 label="IP rating" value={cat.ipRating} />}
          {cat.vandalRating && <Row2 label="Vandal rating" value={cat.vandalRating} />}
          <Row2 label="NDAA" value={cat.ndaa ? 'Compliant' : '—'} tone={cat.ndaa ? '#34D399' : undefined} />
          {cat.onvifProfile && <Row2 label="ONVIF profile" value={cat.onvifProfile} />}
          {cat.poeClass && <Row2 label="PoE" value={`Class ${cat.poeClass}`} />}
          {cat.powerDrawWatts && <Row2 label="Power draw" value={`${cat.powerDrawWatts} W`} />}
          {cat.bandwidthMbps && <Row2 label="Bandwidth" value={`${cat.bandwidthMbps} Mbps`} />}
          {cat.storageGbPerDay && <Row2 label="Storage / day" value={`${cat.storageGbPerDay} GB`} />}
          {cat.warrantyYears && <Row2 label="Warranty" value={`${cat.warrantyYears} yrs`} />}
          {cat.notes && (
            <div className="mt-2 pt-2 border-t border-white/8 text-[11px] text-muted-foreground leading-snug">
              {cat.notes}
            </div>
          )}
        </DrawerSection>
      )}

      {cat && (
        <DrawerSection title="Investment">
          {/* Audit Group C numeric formatting — show "Not priced" for
              a zero MSRP instead of "$0", which read like a real price
              point. Null catalog price still uses the em-dash. */}
          <Row2 label="MSRP" value={cat.msrp == null ? '—' : cat.msrp === 0 ? 'Not priced' : `$${cat.msrp.toLocaleString()}`} />
          {cat.dealerCost && <Row2 label="Dealer cost" value={`$${cat.dealerCost.toLocaleString()}`} />}
          {cat.laborUnits && <Row2 label="Labor units" value={`${cat.laborUnits} hr`} />}
          <div className="text-[10px] text-muted-foreground mt-1">Sample MSRP — verify with distributor.</div>
        </DrawerSection>
      )}

      {cat?.compatibleVMS?.length && (
        <DrawerSection title="Compatible VMS">
          <div className="flex flex-wrap gap-1">
            {cat.compatibleVMS.map((v) => (
              <span key={v} className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-foreground">{v}</span>
            ))}
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Location">
        {/* Audit Group C numeric formatting — round position to the
            nearest 0.5 ft. Surveyors think in whole-or-half feet on a
            plan, never in tenth-of-a-foot precision. */}
        <Row2 label="Position" value={`${(Math.round(d.x * pxToFt * 2) / 2).toFixed(1)}, ${(Math.round(d.y * pxToFt * 2) / 2).toFixed(1)} ft`} />
        {d.mountFt != null && <Row2 label="Mount AFF" value={`${d.mountFt} ft`} />}
      </DrawerSection>
    </>
  );
}

/** Per camera sensor resolution control — drives the V3 Pass 2 Part 2
 *  DORI bands on the canvas. Reads the catalog's resolution label as the
 *  default and lets the operator override per camera (e.g. when a SKU's
 *  spec sheet quotes different pixel counts than the canonical label).
 *  Writes `d.resolution = { widthPx, heightPx }` directly; clearing the
 *  override falls back to the catalog mapping at render time.
 *
 *  Honest data only: when the catalog label is unmapped (multi sensor,
 *  legacy SKU with no resolution at all) we say so plainly and offer a
 *  preset picker so the user can give the cone the data it needs. */
function CameraResolutionSection({
  d, cat, updateDevice,
}: {
  d: Device;
  cat: CatalogProduct | null;
  updateDevice: (id: string, patch: Partial<Device>) => void;
}) {
  // Same resolution lookup chain the cone uses, so the drawer agrees with
  // what's on screen pixel for pixel.
  const effective = cameraResolution(d);
  const catalogLabel = cat?.resolution ?? null;
  const catalogMapped = catalogLabel ? RESOLUTION_LABEL_TO_PX[catalogLabel] ?? null : null;
  const isOverride = !!d.resolution;
  // Preset chips derived from the single source of truth
  // (RESOLUTION_LABEL_TO_PX). Aliases (8MP/4K, 1080p/2MP) collapse into
  // one chip so picking a duplicate can't visually highlight the wrong
  // row, and so the cone math and the drawer stay synced by construction.
  const presets = RESOLUTION_PRESETS;
  // Match the current effective resolution against a preset so the picker
  // can highlight it. Exact pixel match — duplicates are already collapsed
  // upstream so findIndex always returns the right chip.
  const matchedIdx = effective
    ? presets.findIndex((p) => p.widthPx === effective.widthPx && p.heightPx === effective.heightPx)
    : -1;
  const applyPreset = (p: { widthPx: number; heightPx: number }) => {
    updateDevice(d.id, { resolution: { widthPx: p.widthPx, heightPx: p.heightPx } });
  };
  const clearOverride = () => {
    updateDevice(d.id, { resolution: undefined });
  };
  return (
    <DrawerSection title="Sensor resolution">
      {/* Effective summary — what the cone is actually using right now. */}
      <div className="flex items-center justify-between text-[12px] py-1 border-b border-white/5">
        <span className="text-muted-foreground">Effective</span>
        {effective ? (
          <span className="tabular-nums text-foreground">
            {effective.widthPx.toLocaleString()} × {effective.heightPx.toLocaleString()}
            <span className="text-muted-foreground ml-2 text-[10px]">
              {isOverride ? '(override)' : catalogLabel ? `(from catalog · ${catalogLabel})` : '(default)'}
            </span>
          </span>
        ) : (
          <span className="text-amber-300 text-[11px]">not set — DORI bands hidden</span>
        )}
      </div>
      {/* Catalog default, when present, so the user can see what they'll
          fall back to if they clear an override. */}
      {catalogMapped && (
        <div className="flex items-center justify-between text-[11px] py-1 border-b border-white/5">
          <span className="text-muted-foreground">Catalog default</span>
          <span className="tabular-nums text-muted-foreground">
            {catalogMapped.widthPx.toLocaleString()} × {catalogMapped.heightPx.toLocaleString()}
            <span className="ml-2 text-[10px]">{catalogLabel}</span>
          </span>
        </div>
      )}
      {/* Preset grid — pick once, applied immediately. */}
      <div className="mt-2 grid grid-cols-3 gap-1">
        {presets.map((p, i) => {
          const active = i === matchedIdx;
          return (
            <button
              key={`${p.label}-${i}`}
              onClick={() => applyPreset(p)}
              className={
                'text-[10px] px-2 py-1.5 rounded border transition-colors ' +
                (active
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-white/10 bg-white/5 text-foreground hover:bg-white/10')
              }
              title={`${p.widthPx.toLocaleString()} × ${p.heightPx.toLocaleString()}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {isOverride && (
          <button
            onClick={clearOverride}
            className="text-[10px] px-2 py-1 rounded border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
          >
            Reset to catalog
          </button>
        )}
        <span className="text-[10px] text-muted-foreground leading-snug">
          Drives the on canvas DORI bands. Bands recompute live as FOV, range, and floor scale change.
        </span>
      </div>
    </DrawerSection>
  );
}

/** Stack section for hosts (doors / IDFs / racks). Lists every attached
 *  accessory + an Add-hardware menu seeded with the host's compatible
 *  hardware set. Reads from the host's `stack: DeviceId[]` array, which
 *  is written by canvas-to-canvas drag-stack and by drag-from-library. */
/** PASS C — required pixel density preview tile.
 *
 *  Renders a generic face we own (built from a few SVG / canvas
 *  primitives — no external image, no licensed photo) at the REAL
 *  pixel density a camera produces on a 0.6 ft wide face at the
 *  band's outer edge for a given DORI grade. The pixelation is
 *  honest: we rasterize the face at `pxAcross` pixels wide on an
 *  offscreen canvas, then upscale with `image-smoothing: false` so
 *  the displayed tile shows the camera's actual sensor budget for
 *  that grade. Not a decorative blur. */
function FacePixelTile({
  pxAcross,
  displaySize = 64,
}: { pxAcross: number; displaySize?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Source: render the face at pxAcross × pxAcross on an offscreen
    // canvas. This is the camera's actual budget for a face at the
    // DORI band's outer edge. Clamp pxAcross to >= 3 so the canvas
    // can still exist for very low-density "detect" cases (5 px
    // typical, but a tiny FOV camera might compute even smaller).
    const N = Math.max(3, Math.round(pxAcross));
    const off = document.createElement('canvas');
    off.width = N;
    off.height = N;
    const oc = off.getContext('2d');
    if (!oc) return;
    drawPersonWithPlate(oc, N);
    // Upscale to displaySize × dpr with nearest-neighbor so each
    // source pixel renders as a sharp square — readable pixelation,
    // not a decorative bokeh.
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
  }, [pxAcross, displaySize]);
  return <canvas ref={canvasRef} aria-hidden className="block rounded-md bg-[#16202e]" />;
}

/** Generic face primitive — a few overlapping ellipses for the head,
 *  eyes, and mouth. Vector-style but rendered at the target pixel
 *  count so the lower DORI grades genuinely lose detail (the eyes
 *  vanish at observe, the head outline blurs at detect). The face is
 *  ours: no Axis sample, no celebrity, no third-party image. */
/** Item 3 — high quality generic person holding a license plate.
 *
 *  Drawn entirely from canvas primitives (no image files, no AI photo,
 *  no Axis sample). Two procedural assets in one frame:
 *
 *    1. Stylized person — head, torso, shoulders, neck, arms holding
 *       the plate. Skin gradient at higher resolutions, simplified
 *       silhouette at low. Synthetic. NOT a real identifiable person.
 *    2. License plate — generic shape with our own glyph block. The
 *       plate text is a 7 character marker "DV-2026" rendered as
 *       block characters that degrade with density: the letters read
 *       clearly at identify, soften at recognize, blur at observe,
 *       and become an unreadable bar at detect. The plate is OURS,
 *       not a real registration, not a copyrighted state design.
 *
 *  Honest pixelation: this function paints at the offscreen N x N
 *  canvas, the caller upscales nearest neighbor. No internal smoothing,
 *  no "fix at low density" overrides. Low density genuinely loses
 *  detail. */
function drawPersonWithPlate(ctx: CanvasRenderingContext2D, size: number) {
  // Generic person holding a generic license plate. Both painted from
  // canvas primitives — no image files, no real person, no licensed
  // plate design.

  // ── Palette
  const SKIN_BASE   = '#D8B08C';
  const SKIN_SHADE  = '#B58764';
  const SKIN_HIGHLT = '#E7C7A2';
  const HAIR_DARK   = '#2B1F1A';
  const HAIR_MID    = '#3D2A22';
  const BROW        = '#26201D';
  const IRIS        = '#3E5C7E';
  const PUPIL       = '#0E1117';
  const LIP         = '#9C4A3F';
  const NECK        = '#C39A78';
  const NECK_SHADE  = '#9C7754';
  const SHIRT       = '#27374D';
  const SHIRT_SHADE = '#1A2536';
  // License plate — generic creamy white with a thin dark frame; the
  // text uses a dark navy block letter. Resembles a North American
  // plate generically, copies NO state's design.
  const PLATE_BG    = '#F0E7CE';
  const PLATE_FRAME = '#1F2630';
  const PLATE_TEXT  = '#1B2C56';
  // The plate marker text. Six glyphs is the sweet spot for the
  // honest pixelation: at Identify (~46 px) each glyph is ~5 px tall
  // and the string reads clearly; at Detect (~5 px) the text merges
  // into a single bar.
  const PLATE_TEXT_STR = 'DV-2026';

  const s = size;

  // Background plate — slight vignette so the figure has weight on
  // the tile.
  const bg = ctx.createRadialGradient(s * 0.5, s * 0.45, s * 0.1, s * 0.5, s * 0.5, s * 0.7);
  bg.addColorStop(0, '#1B2638');
  bg.addColorStop(1, '#0E1626');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, s, s);

  // ── Composition (top to bottom):
  //   hair + head           0.00 → 0.30
  //   neck                  0.30 → 0.40
  //   shoulders / shirt     0.40 → 1.00 (extends below canvas)
  //   arms gripping plate   0.55 → 0.85 (over the shirt)
  //   license plate         0.55 → 0.84 (centered horizontally)
  //   plate text            inside plate

  // ── Shoulders + shirt
  ctx.fillStyle = SHIRT_SHADE;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 1.05, s * 0.70, s * 0.55, 0, Math.PI, 0, true);
  ctx.fill();
  ctx.fillStyle = SHIRT;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 1.02, s * 0.62, s * 0.48, 0, Math.PI, 0, true);
  ctx.fill();

  // ── Neck
  ctx.fillStyle = NECK_SHADE;
  ctx.fillRect(s * 0.43, s * 0.30, s * 0.14, s * 0.14);
  ctx.fillStyle = NECK;
  ctx.fillRect(s * 0.44, s * 0.30, s * 0.12, s * 0.14);

  // ── Hair (back) — under the head so the jaw cuts clean.
  ctx.fillStyle = HAIR_DARK;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.12, s * 0.30, s * 0.20, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Head
  if (s >= 24) {
    const skin = ctx.createLinearGradient(s * 0.35, s * 0.05, s * 0.65, s * 0.34);
    skin.addColorStop(0, SKIN_HIGHLT);
    skin.addColorStop(0.6, SKIN_BASE);
    skin.addColorStop(1, SKIN_SHADE);
    ctx.fillStyle = skin;
  } else {
    ctx.fillStyle = SKIN_BASE;
  }
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.18, s * 0.22, s * 0.20, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Hair (front bangs)
  if (s >= 14) {
    ctx.fillStyle = HAIR_MID;
    ctx.beginPath();
    ctx.moveTo(s * 0.30, s * 0.20);
    ctx.bezierCurveTo(s * 0.32, s * 0.02, s * 0.62, s * 0.00, s * 0.74, s * 0.16);
    ctx.bezierCurveTo(s * 0.68, s * 0.10, s * 0.54, s * 0.10, s * 0.50, s * 0.18);
    ctx.bezierCurveTo(s * 0.44, s * 0.10, s * 0.36, s * 0.12, s * 0.30, s * 0.20);
    ctx.closePath();
    ctx.fill();
  }

  // ── Eyebrows
  if (s >= 18) {
    ctx.fillStyle = BROW;
    const browH = Math.max(1, s * 0.015);
    ctx.beginPath();
    ctx.ellipse(s * 0.42, s * 0.16, s * 0.05, browH, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.58, s * 0.16, s * 0.05, browH, 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Eyes — pupil dot at any size that can hold one; iris + sclera
  // layer at higher resolutions only.
  if (s >= 12) {
    const eyeY = s * 0.19;
    if (s >= 20) {
      ctx.fillStyle = '#F2EAD8';
      ctx.beginPath(); ctx.ellipse(s * 0.42, eyeY, s * 0.038, s * 0.024, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.58, eyeY, s * 0.038, s * 0.024, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (s >= 16) {
      ctx.fillStyle = IRIS;
      const irisR = Math.max(1, s * 0.022);
      ctx.beginPath(); ctx.ellipse(s * 0.42, eyeY, irisR, irisR, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.58, eyeY, irisR, irisR, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = PUPIL;
    const pupilR = Math.max(1, s * (s >= 16 ? 0.011 : 0.018));
    ctx.beginPath(); ctx.ellipse(s * 0.42, eyeY, pupilR, pupilR, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.58, eyeY, pupilR, pupilR, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ── Mouth
  if (s >= 14) {
    ctx.fillStyle = LIP;
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.26, s * 0.06, s * 0.018, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Arms — two trapezoids running from the shoulders down to the
  // plate top corners. Painted in shirt color so they read as part of
  // the body, with skin-toned hands gripping the plate edges.
  ctx.fillStyle = SHIRT;
  // Left arm (viewer's left)
  ctx.beginPath();
  ctx.moveTo(s * 0.15, s * 0.50);
  ctx.lineTo(s * 0.25, s * 0.85);
  ctx.lineTo(s * 0.32, s * 0.85);
  ctx.lineTo(s * 0.30, s * 0.50);
  ctx.closePath();
  ctx.fill();
  // Right arm
  ctx.beginPath();
  ctx.moveTo(s * 0.85, s * 0.50);
  ctx.lineTo(s * 0.75, s * 0.85);
  ctx.lineTo(s * 0.68, s * 0.85);
  ctx.lineTo(s * 0.70, s * 0.50);
  ctx.closePath();
  ctx.fill();

  // ── License plate — drawn from back (frame) to front (text) so
  // each glyph reads cleanly when there's enough resolution to render.
  const plateX = s * 0.19;
  const plateY = s * 0.58;
  const plateW = s * 0.62;
  const plateH = s * 0.26;
  // Frame
  ctx.fillStyle = PLATE_FRAME;
  ctx.fillRect(plateX - s * 0.012, plateY - s * 0.012, plateW + s * 0.024, plateH + s * 0.024);
  // Plate face
  ctx.fillStyle = PLATE_BG;
  ctx.fillRect(plateX, plateY, plateW, plateH);
  // Hands gripping the plate
  ctx.fillStyle = SKIN_BASE;
  ctx.beginPath();
  ctx.ellipse(plateX, plateY + plateH * 0.5, s * 0.06, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(plateX + plateW, plateY + plateH * 0.5, s * 0.06, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  // Plate text — block letters drawn as filled rects per glyph. Each
  // glyph is a small bitmap (5 px wide, 7 px tall at the design size),
  // scaled to the plate dimensions. Below ~22 px overall canvas size
  // the glyphs collapse into a single bar (honest pixelation).
  if (s >= 12) {
    const charCount = PLATE_TEXT_STR.length;
    const innerX = plateX + plateW * 0.06;
    const innerY = plateY + plateH * 0.22;
    const innerW = plateW * 0.88;
    const innerH = plateH * 0.60;
    const gapPx = innerW / charCount * 0.18;
    const cellW = (innerW + gapPx) / charCount - gapPx;
    if (s >= 22) {
      // High res: paint each glyph as a 5x7 pixel font
      ctx.fillStyle = PLATE_TEXT;
      for (let i = 0; i < charCount; i++) {
        const ch = PLATE_TEXT_STR.charAt(i);
        const bitmap = PLATE_GLYPHS[ch] ?? PLATE_GLYPHS['?'];
        const gx = innerX + i * (cellW + gapPx);
        const cellH = innerH;
        const pxW = cellW / 5;
        const pxH = cellH / 7;
        for (let row = 0; row < 7; row++) {
          const bits = bitmap[row];
          for (let col = 0; col < 5; col++) {
            if (bits & (1 << (4 - col))) {
              ctx.fillRect(gx + col * pxW, innerY + row * pxH, Math.max(1, pxW), Math.max(1, pxH));
            }
          }
        }
      }
    } else {
      // Low res: text degrades into a single horizontal bar so the
      // operator sees "plate present, text unreadable" — honest at
      // detect grade.
      ctx.fillStyle = PLATE_TEXT;
      ctx.fillRect(innerX, innerY + innerH * 0.35, innerW, Math.max(1, innerH * 0.30));
    }
  }
}

// 5x7 bitmap font for the procedural license plate. Each row is 5 bits
// MSB-first. Covers digits 0-9, the letters D and V, and the hyphen
// used by the PLATE_TEXT_STR marker. Anything else falls back to '?'.
const PLATE_GLYPHS: Record<string, number[]> = {
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  'D': [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  'V': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  '-': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
  '?': [0b01110, 0b10001, 0b00010, 0b00100, 0b00000, 0b00100, 0b00000],
};

/** Required pixel density row — four tiles (Identify / Recognize /
 *  Observe / Detect) with the face pixelated at the actual density
 *  the camera produces at each band's outer edge, plus the px/ft
 *  threshold and the band's reach distance in feet. Clicking a tile
 *  emphasizes that band on the canvas via setSelectedDoriLevel.
 *
 *  Honesty gates:
 *   - Missing resolution: no tiles, render the same "set resolution"
 *     hint the DORI band code uses on the cone.
 *   - FOV / range / scale degenerate: skip the row entirely (no
 *     theatrical tiles).
 *   - A grade the camera can't reach inside its range surfaces a
 *     "Beyond range" annotation; the tile still shows the face at the
 *     correct density (because the DENSITY at the threshold is by
 *     definition the threshold itself — knowing the camera could
 *     never reach there is the honest add-on). */
function RequiredDensityRow({
  d, pxToFt, selectedLevel, setSelectedLevel,
}: {
  d: Device;
  pxToFt: number;
  selectedLevel: DoriLevel | null;
  setSelectedLevel: (l: DoriLevel | null) => void;
}) {
  // Honesty gate: the row mirrors the cone's DORI requirements. Skip
  // for multisensor / fisheye and for missing resolution.
  if (d.type === 'cam.multisensor' || d.type === 'cam.fisheye') return null;
  const resolution = cameraResolution(d);
  const defaultRangeFt = d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30;
  const defaultFovDeg  = d.type === 'cam.ptz' ? 36 : 70;
  const rangeFt = d.range ?? defaultRangeFt;
  const fovDeg  = d.fov  ?? defaultFovDeg;
  if (!resolution) {
    return (
      <DrawerSection title="Required pixel density">
        <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
          Set the camera's resolution above to preview pixel density at each DORI grade.
        </div>
      </DrawerSection>
    );
  }
  // Compute distance-to-grade for the actual camera; this is the
  // honest "reach" annotation. d_T = horizontalPx / (2 · T · tan(fov/2))
  const half = (Math.max(1, Math.min(179, fovDeg)) / 2) * (Math.PI / 180);
  const tanHalf = Math.tan(half);
  const horiz = resolution.widthPx;
  const reachFor = (T: number) => (tanHalf > 0 ? horiz / (2 * T * tanHalf) : 0);
  // pxToFt sanity — if zero (degenerate floor calibration) we still
  // render the density tiles (their face math doesn't depend on
  // scale) but we hide the reach annotation.
  const scaleOk = pxToFt > 0;
  // Item 5 — every grade gets its REAL math-reach displayed (no
  // "beyond range" suppression). The within / past-camera-range mark
  // is a SEPARATE annotation so the looser grades (Detect ~388 ft on
  // a 4K @ 70° camera) are no longer misread as unattainable when in
  // reality they cover the entire cone. The fix:
  //   - reach <  rangeFt → the grade's math boundary sits inside the
  //     camera's cone. The grade is met 0 → reach, then drops below
  //     grade for reach → rangeFt. Status: "ends {reachFt} ft from
  //     lens" (sky, neutral honest read).
  //   - reach >= rangeFt → the grade is met across the WHOLE cone.
  //     The camera could theoretically reach `reach` ft if its range
  //     were longer; in practice the cone caps at rangeFt and the
  //     grade fills it. Status: "across full {rangeFt} ft range"
  //     (emerald, positive read — never implies unattainable).
  const rows: { level: DoriLevel; T: number; pxAcross: number; reachFt: number; coversFullRange: boolean }[] = DORI_ORDER.map((level) => {
    const T = DORI_PX_PER_FT[level];
    const reachFt = reachFor(T);
    return {
      level,
      T,
      pxAcross: Math.max(3, Math.round(T * FACE_WIDTH_FT)),
      reachFt,
      // The grade covers the camera's full configured range when its
      // math reach equals or exceeds rangeFt (the band fills the
      // whole cone). The +1 fudge keeps grade reaches that round to
      // rangeFt from flipping to "ends inside" by 0.4 ft of float.
      coversFullRange: reachFt > 0 && reachFt >= rangeFt - 0.5,
    };
  });
  return (
    <DrawerSection title="Required pixel density">
      <div className="grid grid-cols-4 gap-2">
        {rows.map((r) => {
          const active = selectedLevel === r.level;
          return (
            <button
              key={r.level}
              onClick={() => setSelectedLevel(active ? null : r.level)}
              data-testid={`dori-density-tile-${r.level}`}
              className={`group flex flex-col items-stretch gap-1 p-2 rounded-lg border text-left transition-colors ${
                active
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border bg-card hover:border-primary/30 hover:bg-secondary/30'
              }`}
              title={`${DORI_TILE_LABEL[r.level]} — ${r.pxAcross} px across a 0.6 ft face at ${r.T.toFixed(1)} px/ft`}
            >
              <FacePixelTile pxAcross={r.pxAcross} displaySize={56} />
              <div className="text-[10px] font-medium tracking-tight text-foreground leading-tight">
                {DORI_TILE_LABEL[r.level]}
              </div>
              <div className="text-[9.5px] text-muted-foreground tabular-nums leading-tight">
                {r.T.toFixed(1)} px/ft
              </div>
              {scaleOk && (
                <>
                  {/* Honest math reach — always shown, regardless of
                      whether it falls inside or past the camera's
                      configured range. Lower grades reach farther; that
                      number was hidden by the old "beyond range" label. */}
                  <div className="text-[9.5px] text-muted-foreground tabular-nums leading-tight">
                    Reach {r.reachFt.toFixed(1)} ft
                  </div>
                  {/* Separate within / past mark. "Covers full range" is
                      positive and explicit when the grade fills the cone;
                      "Ends inside cone" is the honest framing when the
                      grade's edge sits at reachFt < rangeFt. */}
                  <div className={`text-[9.5px] tabular-nums leading-tight ${r.coversFullRange ? 'text-emerald-400/90' : 'text-sky-300/90'}`}>
                    {r.coversFullRange
                      ? `Covers full ${Math.round(rangeFt)} ft range`
                      : `Ends ${r.reachFt.toFixed(1)} ft inside cone`}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground leading-snug">
        Tiles show a generic face pixelated to the real density at each grade,
        computed from resolution {resolution.widthPx}×{resolution.heightPx},
        FOV {Math.round(fovDeg)}°, and the active floor calibration. Selecting
        a tile dims the other DORI bands on the cone so the picked grade
        reads clearly.
      </div>
    </DrawerSection>
  );
}

/** Person probe live preview — reads the same density at the marker's
 *  current ground distance and renders the generic face (FacePixelTile)
 *  pixelated to that density. The on-canvas marker IS the input, the
 *  preview IS the output: drag the marker, the face updates here.
 *
 *  Honesty:
 *   - Hidden for multisensor / fisheye (cone math doesn't apply).
 *   - Missing resolution OR missing per-floor calibration → no preview,
 *     prints the same hint used by the DORI band code.
 *   - Marker outside the cone → no face preview, plain "no coverage
 *     here" copy.
 *   - Math reach uses the SAME `pxPerFtAt` helper the cone bands use,
 *     so the readout agrees with whichever band the marker sits in
 *     pixel for pixel. */
function PersonProbePreview({
  d, pos, pxToFt,
}: {
  d: Device;
  pos: { x: number; y: number } | null;
  pxToFt: number;
}) {
  if (d.type === 'cam.multisensor' || d.type === 'cam.fisheye') return null;
  const resolution = cameraResolution(d);
  if (!resolution) {
    return (
      <DrawerSection title="Person probe">
        <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
          Set the camera's resolution above to drop the draggable probe and preview image quality.
        </div>
      </DrawerSection>
    );
  }
  if (!pxToFt || pxToFt <= 0) {
    return (
      <DrawerSection title="Person probe">
        <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
          Calibrate the floor scale to enable the probe — its distance reading needs feet-per-pixel.
        </div>
      </DrawerSection>
    );
  }
  if (!pos) return null;
  const defaultRangeFt = d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30;
  const defaultFovDeg  = d.type === 'cam.ptz' ? 36 : 70;
  const fovDeg  = d.fov  ?? defaultFovDeg;
  const rangeFt = d.range ?? defaultRangeFt;
  const probe = pointInCone({
    cameraX: d.x, cameraY: d.y, cameraRotDeg: d.rot ?? 0,
    fovDeg, rangeFt, pxToFt,
    pointX: pos.x, pointY: pos.y,
  });
  if (!probe.inCone) {
    // Audit Group A.2 — header used to read "Person probe · 99.8 ft" while
    // the body said "no coverage", which implied a distance number was
    // meaningful. Out-of-cone, the title now matches the body.
    return (
      <DrawerSection title="Person probe · no coverage">
        <div className="rounded-md border border-border bg-card px-3 py-3 text-[11px] text-muted-foreground">
          The probe is outside the camera's cone (off axis by {probe.deltaDeg.toFixed(0)}° or past its {Math.round(rangeFt)} ft range). Drag the marker back into the cone for a live density readout.
        </div>
      </DrawerSection>
    );
  }
  const pxPerFt = pxPerFtAt({ fovDeg, resolution, distanceFt: probe.distanceFt });
  const pxAcross = Math.max(3, Math.round(pxPerFt * FACE_WIDTH_FT));
  // Grade the marker is sitting in — matches the cone band the marker
  // is visually inside. Same px/ft thresholds the DORI tiles use.
  const grade: DoriLevel | null = (() => {
    if (pxPerFt >= DORI_PX_PER_FT.identify) return 'identify';
    if (pxPerFt >= DORI_PX_PER_FT.recognize) return 'recognize';
    if (pxPerFt >= DORI_PX_PER_FT.observe) return 'observe';
    if (pxPerFt >= DORI_PX_PER_FT.detect) return 'detect';
    return null;
  })();
  return (
    <DrawerSection title={`Person probe · ${probe.distanceFt.toFixed(1)} ft`}>
      <div className="flex items-start gap-3">
        <FacePixelTile pxAcross={pxAcross} displaySize={84} />
        <div className="flex-1 min-w-0 text-[11px] space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">Distance</span>
            <span className="tabular-nums text-foreground">{probe.distanceFt.toFixed(1)} ft</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">Density</span>
            <span className="tabular-nums text-foreground">{pxPerFt.toFixed(1)} px/ft</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">px across face</span>
            <span className="tabular-nums text-foreground">{pxAcross}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-border/40">
            <span className="text-muted-foreground">Grade</span>
            <span className={`tabular-nums ${grade ? 'text-emerald-400/90' : 'text-amber-300/90'}`}>
              {grade ? DORI_TILE_LABEL[grade] : 'Below detect'}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-muted-foreground leading-snug">
        Drag the marker on the plan to move the probe. Density at the marker reads from the same resolution + FOV + calibration chain the DORI bands use, so the number always agrees with the band the marker sits in.
      </div>
    </DrawerSection>
  );
}

/** DoorAssemblySection — checklist editor for the door hardware "assembly"
 *  persisted on the Device record itself (one model, not a stack of ghost
 *  accessory devices). Renders only for opening-type devices; otherwise
 *  emits nothing so the Stack tile retains its current StackSectionForHost
 *  body for non-doors. Persists `doorAssembly`, `doorElectrification`, and
 *  `doorReaderLocation` directly on the Device via onUpdate. */
function DoorAssemblySection({
  d, onUpdate,
}: { d: Device; onUpdate: (p: Partial<Device>) => void }) {
  const isDoorish =
    (d.type as string).startsWith('inf.door')
    || (d.type as string).startsWith('inf.gate')
    || (d.type as string).startsWith('inf.storefront')
    || (d.type as string).startsWith('inf.doubledoor');
  if (!isDoorish) return null;
  const assembly: DoorHardware[] = d.doorAssembly ?? [];
  const stateMap = ((d as any).doorAssemblyState ?? {}) as Partial<Record<DoorHardware, 'proposed' | 'existing'>>;
  const electrification = d.doorElectrification;
  const readerLocation = d.doorReaderLocation;
  // Flip a single hardware row between Proposed and Existing without
  // removing it from the assembly. Used by the segmented pill on each
  // active tile.
  const setHwState = (h: DoorHardware, state: 'proposed' | 'existing') => {
    const dev = useProjectStore.getState().devices[d.id];
    const cur = ((dev as any)?.doorAssemblyState ?? {}) as Partial<Record<DoorHardware, 'proposed' | 'existing'>>;
    onUpdate({ doorAssemblyState: { ...cur, [h]: state } } as any);
  };
  // Door-type prettifier for the Opening summary card.
  const openingType = (() => {
    const t = d.type as string;
    if (t.includes('door-double'))       return 'Double door';
    if (t.includes('door-storefront'))   return 'Storefront opening';
    if (t.includes('door-sliding'))      return 'Sliding door';
    if (t.includes('gate-swing'))        return 'Swing gate';
    if (t.includes('gate-slide'))        return 'Slide gate';
    if (t.includes('elevator'))          return 'Elevator';
    return 'Single door';
  })();
  // Engineering rule checks — labelled as heuristics, NOT code
  // certification. Same honesty contract as Compatibility tab.
  const has = (h: DoorHardware) => assembly.includes(h);
  type RuleWarning = { id: string; severity: 'high' | 'med' | 'info'; title: string; detail: string };
  const warnings: RuleWarning[] = [];
  if (has('maglock') && !has('rex')) {
    warnings.push({ id: 'mag-no-rex', severity: 'high', title: 'Maglock without REX', detail: 'Maglocks require a REX (request-to-exit) or panic device for code-compliant egress.' });
  }
  if (has('maglock') && !has('panic')) {
    warnings.push({ id: 'mag-no-fire', severity: 'med', title: 'Maglock fire release', detail: 'Add a fire-alarm release wiring note in the Notes tab — maglocks must drop on fire signal in most jurisdictions.' });
  }
  if (has('strike') && !has('psu')) {
    warnings.push({ id: 'strike-no-psu', severity: 'high', title: 'Strike without power supply', detail: 'Electric strike needs a 12 / 24 VDC PSU. Drop a PSU onto the door or note one nearby.' });
  }
  if (has('reader') && !has('controller')) {
    warnings.push({ id: 'reader-no-ctrl', severity: 'high', title: 'Reader without controller', detail: 'A reader needs a controller (Mercury / Verkada / S2 / similar) to make access decisions.' });
  }
  if ((has('dps') || has('contact')) && !has('controller')) {
    warnings.push({ id: 'monitor-no-ctrl', severity: 'med', title: 'Door monitor without controller', detail: 'DPS / door contact reports to a controller input — add one or wire to an existing panel.' });
  }
  if ((has('strike') || has('maglock')) && !has('controller')) {
    warnings.push({ id: 'lock-no-ctrl', severity: 'med', title: 'Electrified lock without controller', detail: 'Strikes and maglocks energize from a controller relay. Add a controller or note an existing panel.' });
  }
  if (has('intercom') && has('reader')) {
    warnings.push({ id: 'intercom-plus-reader', severity: 'info', title: 'Intercom + separate reader', detail: 'Many video-intercom stations include a card reader. Confirm you actually need both — otherwise drop one to save labor + BOM.' });
  }
  const ITEMS: { id: DoorHardware; label: string; hint: string }[] = [
    { id: 'reader',     label: 'Reader',       hint: 'Card / mobile credential.' },
    { id: 'strike',     label: 'Electric strike', hint: 'Fail-secure release at the latch.' },
    { id: 'maglock',    label: 'Maglock',      hint: 'Magnetic hold. Requires REX + fire release.' },
    { id: 'rex',        label: 'REX',          hint: 'Request-to-exit motion / button.' },
    { id: 'dps',        label: 'DPS',          hint: 'Door position switch (contact).' },
    { id: 'contact',    label: 'Door contact', hint: 'Monitors open / closed state.' },
    { id: 'intercom',   label: 'Intercom',     hint: 'Audio / video call station.' },
    { id: 'panic',      label: 'Panic bar',    hint: 'Crash bar / panic device.' },
    { id: 'autoop',     label: 'Auto-operator',hint: 'ADA push-plate / automatic open.' },
    { id: 'controller', label: 'Controller',   hint: 'Access-control panel input.' },
    { id: 'psu',        label: 'Power supply', hint: '12 / 24 VDC PSU + transformer.' },
  ];
  // Read the freshest assembly from the store each tick so rapid clicks /
  // automated toggles compose instead of clobbering one another. The
  // closure's `assembly` variable is from the last render and lags behind.
  const toggle = (h: DoorHardware) => {
    const dev = useProjectStore.getState().devices[d.id];
    const current = dev?.doorAssembly ?? [];
    const set = new Set<DoorHardware>(current);
    const stateMap = { ...((dev as any)?.doorAssemblyState ?? {}) } as Partial<Record<DoorHardware, 'proposed' | 'existing'>>;
    if (set.has(h)) {
      set.delete(h);
      delete stateMap[h];
    } else {
      set.add(h);
      // Inspector toggles default to 'proposed' too — same contract as
      // the drag-attach flow so the BOM is consistent regardless of how
      // the hardware got onto the opening.
      stateMap[h] = 'proposed';
    }
    onUpdate({ doorAssembly: Array.from(set), doorAssemblyState: stateMap } as any);
  };
  const hasMag = assembly.includes('maglock');
  const hasRex = assembly.includes('rex');
  return (
    <>
      {/* Opening summary — compact one-line read of the opening's type +
          electrification + reader location + total hardware count. Lets
          the surveyor confirm at a glance "what is this opening?" before
          digging into the assembly checklist. */}
      <DrawerSection title="Opening summary">
        <div className="rounded-md border border-border bg-secondary/15 p-2.5 text-[11px] space-y-1" data-testid="opening-summary">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Type</span>
            <span className="text-foreground">{openingType}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Hardware</span>
            <span className="text-foreground tabular-nums">{assembly.length} / {ITEMS.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Electrification</span>
            <span className="text-foreground">{electrification === 'fail-safe' ? 'Fail-safe' : electrification === 'fail-secure' ? 'Fail-secure' : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Reader location</span>
            <span className="text-foreground">{readerLocation === 'mullion' ? 'Mullion' : readerLocation === 'wall' ? 'Wall' : '—'}</span>
          </div>
        </div>
      </DrawerSection>

      <DrawerSection title={`Hardware assembly · ${assembly.length}/${ITEMS.length}`}>
        <div className="text-[11px] text-muted-foreground/85 mb-2">
          One persisted schedule per opening. Each item carries a Proposed
          / Existing flag so the BOM can split "to install" from
          "already there".
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {ITEMS.map((it) => {
            const on = assembly.includes(it.id);
            const state = stateMap[it.id] ?? 'proposed';
            return (
              <div
                key={it.id}
                title={it.hint}
                data-testid={`door-assembly-${it.id}`}
                data-track={`door-assembly-${it.id}`}
                className={`rounded-md border text-[11px] transition-colors ${
                  on
                    ? 'border-primary/60 bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground'
                }`}
              >
                <button
                  onClick={() => toggle(it.id)}
                  className="w-full text-left px-2.5 py-2"
                  data-testid={`door-assembly-${it.id}-toggle`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${on ? 'border-primary bg-primary/30' : 'border-border'}`}>
                      {on && <Check className="w-2.5 h-2.5" />}
                    </span>
                    {it.label}
                  </div>
                </button>
                {on && (
                  <div className="px-2 pb-2 -mt-1 flex items-center gap-1 text-[9.5px] uppercase tracking-[0.10em]" data-testid={`door-assembly-${it.id}-state`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setHwState(it.id, 'proposed'); }}
                      className={`flex-1 py-0.5 rounded border transition-colors ${
                        state === 'proposed'
                          ? 'border-emerald-400/40 bg-emerald-400/12 text-emerald-300'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                      data-testid={`door-assembly-${it.id}-proposed`}
                    >Proposed</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setHwState(it.id, 'existing'); }}
                      className={`flex-1 py-0.5 rounded border transition-colors ${
                        state === 'existing'
                          ? 'border-sky-400/40 bg-sky-400/12 text-sky-300'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                      data-testid={`door-assembly-${it.id}-existing`}
                    >Existing</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DrawerSection>

      {warnings.length > 0 && (
        <DrawerSection title={`Engineering rule check · ${warnings.length}`}>
          <div className="text-[10px] uppercase tracking-[0.10em] text-amber-300 mb-1">
            Heuristic rules · not certified code compliance
          </div>
          <div className="space-y-1.5" data-testid="door-warnings">
            {warnings.map((w) => {
              const tone =
                w.severity === 'high' ? '#F87171' :
                w.severity === 'med'  ? '#FACC15' :
                                        '#94A3B8';
              return (
                <div
                  key={w.id}
                  data-testid={`door-warning-${w.id}`}
                  className="rounded-md border p-2 text-[11px] leading-snug"
                  style={{
                    borderColor: `${tone}55`,
                    background: `${tone}10`,
                  }}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.10em] tabular-nums" style={{ color: tone }}>{w.severity}</span>
                    <span className="font-medium text-foreground">{w.title}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">{w.detail}</div>
                </div>
              );
            })}
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Electrification & reader location">
        <div className="grid grid-cols-2 gap-1.5">
          {(['fail-safe', 'fail-secure'] as const).map((opt) => {
            const on = electrification === opt;
            return (
              <button
                key={opt}
                onClick={() => onUpdate({ doorElectrification: opt })}
                data-testid={`door-elec-${opt}`}
                className={`text-left px-2.5 py-2 rounded-md border text-[11px] transition-colors ${
                  on ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt === 'fail-safe' ? 'Fail-safe' : 'Fail-secure'}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {(['mullion', 'wall'] as const).map((opt) => {
            const on = readerLocation === opt;
            return (
              <button
                key={opt}
                onClick={() => onUpdate({ doorReaderLocation: opt })}
                data-testid={`door-readerloc-${opt}`}
                className={`text-left px-2.5 py-2 rounded-md border text-[11px] transition-colors ${
                  on ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Reader · {opt === 'mullion' ? 'Mullion' : 'Wall'}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground leading-snug">
          Fail-safe drops on power loss (egress doors); Fail-secure stays locked (perimeter / sensitive). Pair maglocks with a fire-alarm release per local code.
        </div>
      </DrawerSection>
    </>
  );
}

function StackSectionForHost({
  d, onUpdate,
}: { d: Device; onUpdate: (p: Partial<Device>) => void }) {
  const stackIds: string[] = (d.stack ?? []);
  // Resolve attached devices from the store so labels / models / IDs are honest.
  const allDevices = useProjectStore((s) => s.devices);
  const attached: Device[] = stackIds
    .map((id) => allDevices[id])
    .filter((x): x is Device => !!x);
  const isDoor =
    (d.type as string).startsWith('inf.door')
    || (d.type as string).startsWith('inf.gate')
    || (d.type as string).startsWith('inf.storefront')
    || (d.type as string).startsWith('inf.doubledoor');
  // Door / opening devices: the DoorAssemblySection above is the
  // single source of truth. Render nothing in the stack panel — the
  // drag/drop paths no longer write to stack[] for doors, so there
  // shouldn't be any leftover data to surface. (Both attach paths
  // clear `stack` / `linkedIds` on every door write.)
  if (isDoor) return null;
  // Non-door hosts (IDF / rack / MDF) keep the stack workflow — they
  // really do carry separate switch / patch / UPS device records.
  const hardwareMenu: { type: DeviceType; label: string }[] = [
    { type: 'net.switch' as DeviceType, label: 'Switch' },
    { type: 'net.patch' as DeviceType, label: 'Patch panel' },
    { type: 'inf.ups' as DeviceType, label: 'UPS' },
  ];
  const addHardware = (t: DeviceType, label: string) => {
    const newId = `${label.replace(/\s+/g, '-').slice(0, 4).toUpperCase()}-${Date.now().toString(36).slice(-4)}`;
    const store = useProjectStore.getState();
    store.addDevice({
      id: newId,
      type: t,
      x: d.x,
      y: d.y,
      rot: 0,
      projectId: d.projectId,
      floorId: d.floorId ?? '',
    } as Device);
    onUpdate({ stack: [...stackIds, newId] });
    toast.success(`Added · ${label} → ${d.id}`, { duration: 3500 });
  };
  const removeAttached = (childId: string) => {
    const store = useProjectStore.getState();
    onUpdate({ stack: stackIds.filter((id) => id !== childId) });
    store.removeDevice(childId);
    toast.message('Detached', { description: `${childId} removed from ${d.id}.`, duration: 3000 });
  };
  return (
    <>
      <DrawerSection title={`Hardware stack · ${attached.length}`}>
        {attached.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic px-1">
            No hardware attached. Use Add below.
          </div>
        ) : (
          <div className="space-y-1">
            {attached.map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md border border-border/40 bg-secondary/20">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: KIND_TONE[TYPE_KIND[a.type]] }} />
                <span className="text-[11px] text-foreground tracking-tight">{a.id}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-[0.10em]">{a.type.split('.').slice(-1)[0]}</span>
                <button
                  onClick={() => removeAttached(a.id)}
                  title="Detach"
                  data-track={`stack-detach-${a.id}`}
                  className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DrawerSection>
      <DrawerSection title="Add hardware">
        <div className="grid grid-cols-2 gap-1.5">
          {hardwareMenu.map((m) => (
            <button
              key={m.type}
              onClick={() => addHardware(m.type, m.label)}
              data-track={`stack-add-${m.type}`}
              className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/30 text-[11px] transition-colors"
            >
              + {m.label}
            </button>
          ))}
        </div>
      </DrawerSection>
    </>
  );
}

/** SurveySection — object-linked survey notes / checklist items.
 *  Reads/writes via the projectStore `surveyItems` slice; every entry
 *  persists across refresh and remains tied to its (objectType, objectId).
 *  Used inside the device EditDrawer and (via SurveyPanel) the
 *  PathwayDrawer. Photos are intentionally pending — we capture metadata
 *  honestly and label the upload itself as not yet wired. */
function SurveySection({
  device, onUpdate,
}: { device: Device; onUpdate: (p: Partial<Device>) => void }) {
  const objectType: 'device' | 'door' =
    ((device.type as string).startsWith('inf.door')
      || (device.type as string).startsWith('inf.gate')
      || (device.type as string).startsWith('inf.storefront')
      || (device.type as string).startsWith('inf.doubledoor'))
      ? 'door' : 'device';
  return (
    <SurveyPanel
      projectId={(device as any).projectId}
      floorId={(device as any).floorId}
      objectType={objectType}
      objectId={device.id}
      deviceStatus={device.surveyStatus}
      onDeviceStatusChange={(s) => onUpdate({ surveyStatus: s })}
    />
  );
}

/** Reusable survey panel — used inside both the device EditDrawer and the
 *  PathwayDrawer's Notes/Survey block. */
function SurveyPanel({
  projectId, floorId, objectType, objectId,
  deviceStatus, onDeviceStatusChange,
}: {
  projectId: string;
  floorId?: string;
  objectType: 'device' | 'door' | 'pathway' | 'idf' | 'floor';
  objectId: string;
  /** Optional — only devices/doors carry the headline surveyStatus chip. */
  deviceStatus?: SurveyItemStatus;
  onDeviceStatusChange?: (s: SurveyItemStatus) => void;
}) {
  // Pull the raw map (stable ref) and filter+sort inside useMemo. Returning
  // a fresh array from the selector each render triggers React's
  // "getSnapshot should be cached" infinite-loop warning under
  // useSyncExternalStore — Zustand's underlying machinery.
  const allItems = useProjectStore((s) => s.surveyItems);
  const items = useMemo(
    () => Object.values(allItems)
      .filter((i) => i.objectType === objectType && i.objectId === objectId)
      .sort((a, b) => b.createdAt - a.createdAt),
    [allItems, objectType, objectId],
  );
  const addSurveyItem = useProjectStore((s) => s.addSurveyItem);
  const updateSurveyItem = useProjectStore((s) => s.updateSurveyItem);
  const removeSurveyItem = useProjectStore((s) => s.removeSurveyItem);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'note' | 'check'>('note');
  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addSurveyItem({
      projectId,
      floorId,
      objectType,
      objectId,
      kind,
      text: trimmed,
      status: kind === 'check' ? 'todo' : 'verified',
      author: 'Field demo',
    });
    setText('');
    toast.success(kind === 'check' ? 'Checklist item added' : 'Survey note added', { duration: 2500 });
  };
  return (
    <>
      {onDeviceStatusChange && (
        <DrawerSection title="Survey status">
          <div className="grid grid-cols-4 gap-1.5">
            {(['todo', 'verified', 'issue', 'skip'] as const).map((opt) => {
              const on = (deviceStatus ?? 'todo') === opt;
              return (
                <button
                  key={opt}
                  onClick={() => onDeviceStatusChange(opt)}
                  data-testid={`survey-status-${opt}`}
                  className={`text-center px-2 py-1.5 rounded-md border text-[11px] capitalize transition-colors ${
                    on ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </DrawerSection>
      )}
      <DrawerSection title={`Survey notes · ${items.length}`}>
        {items.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic mb-2">
            No survey notes yet. Add one below — they save against this object and persist on refresh.
          </div>
        ) : (
          <div className="space-y-1.5 mb-3">
            {items.map((it) => (
              <div key={it.id} className="rounded-md border border-border bg-secondary/15 px-2.5 py-2" data-testid={`survey-item-${it.id}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9.5px] uppercase tracking-[0.10em] px-1.5 py-0.5 rounded-sm ${
                    it.status === 'verified' ? 'bg-emerald-400/15 text-emerald-300'
                    : it.status === 'issue'   ? 'bg-rose-400/15 text-rose-300'
                    : it.status === 'skip'    ? 'bg-amber-300/15 text-amber-200'
                    : 'bg-muted text-muted-foreground'
                  }`}>{it.kind === 'check' ? 'Check' : 'Note'} · {it.status}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(it.createdAt).toLocaleString()}</span>
                  <button
                    onClick={() => removeSurveyItem(it.id)}
                    title="Remove"
                    data-testid={`survey-remove-${it.id}`}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-[12px] text-foreground whitespace-pre-wrap">{it.text}</div>
                {it.author && <div className="text-[10px] text-muted-foreground mt-1">— {it.author}</div>}
                {it.kind === 'check' && (
                  <div className="mt-1.5 flex gap-1.5">
                    {(['todo', 'verified', 'issue', 'skip'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateSurveyItem(it.id, { status: s })}
                        className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${
                          it.status === s ? 'border-primary/60 text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >{s}</button>
                    ))}
                  </div>
                )}
                {it.photo && (
                  <div className="mt-1.5 text-[10px] text-amber-200/85">
                    Photo · {it.photo.fileName} {it.photo.sizeBytes ? `(${Math.round(it.photo.sizeBytes / 1024)} KB)` : ''} — upload pending
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 mb-2">
          {(['note', 'check'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setKind(opt)}
              data-testid={`survey-kind-${opt}`}
              className={`text-[11px] px-2 py-1 rounded border capitalize ${kind === opt ? 'border-primary/60 text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >{opt}</button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(); }}
          placeholder={kind === 'check' ? 'Verify exterior PoE injector is in stock…' : 'On-site observation, blocking, GC handoff…'}
          data-testid="survey-input"
          className="dv-input text-[12px] resize-none min-h-[64px] w-full"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground">⌘/Ctrl+Enter to save</span>
          <button
            onClick={submit}
            disabled={!text.trim()}
            data-testid="survey-add-btn"
            className="text-[11px] px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >Add</button>
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground/85">
          Photos can be added — only the filename + size persists today; image upload is pending.
        </div>
      </DrawerSection>
    </>
  );
}

/** ImpactPreviewSection — small material/labor preview pulled live from
 *  deriveBOM and the per-device labor catalog. Used inside the Overview
 *  tile so the engineer sees the cost ripple of the selected object before
 *  jumping to the full Estimator. Honest about its scope: it summarizes,
 *  it doesn't redo the BOM. */
function ImpactPreviewSection({ device }: { device: Device }) {
  const projectId = device.projectId;
  // Subscribe to only the slices that affect the BOM so deriveBOM stays
  // accurate without forcing a full-state re-render snapshot.
  const devices = useProjectStore((s) => s.devices);
  const doors = useProjectStore((s) => s.doors);
  const pathways = useProjectStore((s) => s.pathways);
  const idfs = useProjectStore((s) => s.idfs);
  const floors = useProjectStore((s) => s.floors);
  const estimates = useProjectStore((s) => s.estimates);
  const projects = useProjectStore((s) => s.projects);
  const bom = useMemo(
    () => deriveBOM({ devices, doors, pathways, idfs, floors, estimates, projects } as any, projectId),
    [devices, doors, pathways, idfs, floors, estimates, projects, projectId],
  );
  const isDoorish =
    device.type.startsWith('inf.door')
    || device.type.startsWith('inf.gate')
    || device.type.startsWith('inf.storefront')
    || device.type.startsWith('inf.doubledoor');
  const isCam = TYPE_KIND[device.type] === 'camera';
  // Match BOM lines to THIS specific device only — never aggregate by
  // SKU. The previous `l.sku === device.product` fallback pulled in
  // every other device sharing the same catalog product, so selecting
  // one camera showed the cost of N identical cameras. For cameras
  // whose BOM lines roll up by catalog SKU (no per-id source line),
  // we present the unit cost from the catalog instead — the matched
  // list stays one-line-per-device.
  const matched = bom.lines.filter((l) => l.sourceId === device.id);
  const poeW = isCam ? Math.round((device as any).poeW ?? 9.8) : null;
  // Cameras (and any device class where deriveBOM aggregates by SKU) do
  // not produce a per-id BOM line. Fall back to a single-unit catalog
  // lookup so the inspector still shows THIS object's own material +
  // labor — never multiplied by the project-wide count of the same SKU.
  const catalogFallback = matched.length === 0 && device.product
    ? (() => {
        const p = CATALOG.find((c) => c.id === device.product);
        if (!p) return null;
        // Audit Group A.4 — never emit the literal string "undefined" when
        // a catalog entry is missing manufacturer/model. Build the label
        // from whichever pieces are real and skip the rest.
        const parts = [p.mfr, p.model].filter((s): s is string => typeof s === 'string' && s.length > 0);
        const label = parts.length > 0 ? parts.join(' ') : (device.label || device.id);
        return {
          label,
          qty: '1 ea',
          ext: p.msrp ?? 0,
          hrs: p.laborUnits ?? 0,
        };
      })()
    : null;
  const labelLines = matched.length > 0
    ? matched.map((l) => ({
        label: l.description,
        qty: `${l.qty} ${l.uom ?? 'ea'}`,
        ext: l.qty * l.unitPrice,
        hrs: l.laborHours ?? 0,
      }))
    : (catalogFallback ? [catalogFallback] : []);
  // For door-class devices the same DOOR_HARDWARE_PRICE helper that feeds
  // deriveBOM also drives this preview, so the numbers here always match
  // the Estimator BOM lines for the same opening.
  const doorRollup = isDoorish ? deriveDoorAssemblyLines(device) : null;
  return (
    <>
      <DrawerSection title={`Impact preview · ${device.id}`}>
        <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1">
          This object only · not a project rollup
        </div>
        {labelLines.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic">
            {isDoorish
              ? 'No door hardware selected yet. Open the Assembly tab and toggle reader / strike / REX / etc. to populate this opening.'
              : "No catalog product assigned yet. Pick one on the Overview tile to see this object's material + labor."}
          </div>
        ) : (
          <div className="space-y-1 text-[11px]">
            {labelLines.map((l, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 py-1 border-b border-border/40 last:border-b-0">
                <div className="flex-1 min-w-0 truncate text-foreground">{l.label}</div>
                <div className="tabular-nums text-muted-foreground">{l.qty}</div>
                <div className="tabular-nums text-foreground">${Math.round(l.ext).toLocaleString()}</div>
              </div>
            ))}
            <div className="flex items-baseline justify-between text-[10px] text-muted-foreground pt-1">
              <span>Labor</span>
              <span className="tabular-nums">{labelLines.reduce((s, l) => s + (l.hrs || 0), 0).toFixed(1)} hr</span>
            </div>
            {poeW !== null && (
              <div className="flex items-baseline justify-between text-[10px] text-muted-foreground">
                <span>PoE draw</span>
                <span className="tabular-nums">~{poeW} W</span>
              </div>
            )}
          </div>
        )}
        <div className="mt-2 text-[10px] text-muted-foreground/85">
          Reflects default labor + materials plus any project pricebook overrides. Confirm against your pricebook before sending an estimate.
        </div>
      </DrawerSection>

      {doorRollup && doorRollup.lines.length > 0 && (() => {
        // Per-hardware Proposed/Existing state lives on the device record;
        // we re-read it here so each row can carry its own tag and we can
        // split the subtotal into "Proposed (to install)" vs "Existing
        // (already there)". Defaults to 'proposed' for any hw class that
        // doesn't have an explicit state — same contract as the drag and
        // inspector-toggle flows.
        const stateMap = ((device as any).doorAssemblyState ?? {}) as Partial<Record<import('../store/types').DoorHardware, 'proposed' | 'existing'>>;
        const proposedLines = doorRollup.lines.filter((l) => (stateMap[l.hw] ?? 'proposed') === 'proposed');
        const existingLines = doorRollup.lines.filter((l) => (stateMap[l.hw] ?? 'proposed') === 'existing');
        const proposedHardware = proposedLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
        const existingHardware = existingLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
        const proposedLabor = proposedLines.reduce((s, l) => s + l.laborHours, 0);
        return (
          <DrawerSection title={`Door assembly impact · ${doorRollup.lines.length}`}>
            <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1">
              This door only · {proposedLines.length} proposed · {existingLines.length} existing
            </div>
            <div className="text-[10px] text-muted-foreground/85 mb-2">
              Per-component preview from the active door assembly. Proposed rows roll into the Estimator;
              Existing rows are kept as documentation only (zeroed in totals).
            </div>
            <div className="space-y-1 text-[11px]">
              {doorRollup.lines.map((l) => {
                const state = stateMap[l.hw] ?? 'proposed';
                const isExisting = state === 'existing';
                return (
                  <div key={l.hw} className="flex items-baseline justify-between gap-2 py-1 border-b border-border/40 last:border-b-0" data-testid={`impact-door-${l.hw}`}>
                    <div className="flex-1 min-w-0 truncate">
                      <span className={isExisting ? 'text-muted-foreground' : 'text-foreground'}>{l.description}</span>
                      <span className="text-[9.5px] uppercase tracking-[0.10em] text-muted-foreground ml-2">{l.hw}</span>
                      <span
                        className="ml-1.5 text-[9px] uppercase tracking-[0.10em] px-1 py-px rounded border"
                        data-testid={`impact-door-${l.hw}-state`}
                        style={{
                          color: isExisting ? '#7CC2FF' : '#4FB87E',
                          borderColor: isExisting ? 'rgba(124,194,255,0.40)' : 'rgba(79,184,126,0.40)',
                          background: isExisting ? 'rgba(124,194,255,0.10)' : 'rgba(79,184,126,0.10)',
                        }}
                      >{state}</span>
                    </div>
                    <div className="tabular-nums text-muted-foreground">{l.laborHours.toFixed(2)} hr</div>
                    <div className={`tabular-nums ${isExisting ? 'text-muted-foreground line-through' : 'text-foreground'}`}>${l.unitPrice.toLocaleString()}</div>
                  </div>
                );
              })}
              <div className="flex items-baseline justify-between pt-1.5 text-[11px] font-medium" data-testid="impact-door-proposed-total">
                <span>Proposed hardware</span>
                <span className="tabular-nums">${proposedHardware.toLocaleString()}</span>
              </div>
              <div className="flex items-baseline justify-between text-[10px] text-muted-foreground" data-testid="impact-door-proposed-labor">
                <span>Proposed labor</span>
                <span className="tabular-nums">{proposedLabor.toFixed(2)} hr</span>
              </div>
              {existingLines.length > 0 && (
                <div className="flex items-baseline justify-between text-[10px] text-muted-foreground/80 pt-0.5" data-testid="impact-door-existing-total">
                  <span>Existing hardware (excluded from total)</span>
                  <span className="tabular-nums">${existingHardware.toLocaleString()}</span>
                </div>
              )}
            </div>
          </DrawerSection>
        );
      })()}
    </>
  );
}

function AccessoriesSection({ cameraType, selected, onToggle }: {
  cameraType: DeviceType;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const options = accessoriesForCameraType(cameraType);
  if (options.length === 0) return null;
  const totalAdded = selected.reduce((sum, id) => sum + (ACCESSORIES.find((a) => a.id === id)?.msrp ?? 0), 0);
  return (
    <DrawerSection title="Compatible accessories">
      <div className="space-y-1">
        {options.map((a) => {
          const isOn = selected.includes(a.id);
          return (
            <button
              key={a.id}
              onClick={() => onToggle(a.id)}
              className={`w-full text-left px-2.5 py-2 rounded-md border transition-colors flex items-center gap-2.5 ${
                isOn ? 'border-primary/40 bg-primary/8' : 'border-white/10 hover:border-white/25 hover:bg-white/5'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-sm shrink-0 flex items-center justify-center ${isOn ? 'bg-primary' : 'border border-white/30'}`}
              >
                {isOn && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-foreground truncate">
                  {a.mfr} · {a.model}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{a.kind.replace('-', ' ')}</div>
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground">${a.msrp ?? '—'}</span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">{selected.length} added · rolls up into BOM</span>
          <span className="tabular-nums text-foreground font-medium">+${totalAdded}</span>
        </div>
      )}
    </DrawerSection>
  );
}

/** AI Optimize section in the camera inspector drawer. The Overview /
 *  Prosecution tabs are real now — each renders a different set of metrics
 *  and recommendations targeted at that goal. */
/** Conduit fill calculator + assist recommendation. Reads bundle
 *  pathways for the project, computes total cable area vs. conduit
 *  internal area for the four most common EMT sizes, and surfaces a
 *  recommended size based on NEC fill rules (53/31/40 %). */
function ConduitAssistSection({ projectId }: { projectId: string }) {
  const pathways = useProjectStore((s) => s.pathways);
  const bundles = useMemo(() => {
    const byBundle: Record<string, any[]> = {};
    for (const p of Object.values(pathways) as any[]) {
      if (!p || p.projectId !== projectId) continue;
      const key = p.bundleId ?? `__single-${p.id}`;
      (byBundle[key] ??= []).push(p);
    }
    return byBundle;
  }, [pathways, projectId]);
  // Cable OD in inches per type. Honest defaults from common datasheets.
  const cableOdIn: Record<string, number> = {
    cat5e: 0.21, cat6: 0.24, cat6a: 0.31, fiber: 0.20,
    '18/2': 0.21, '18/4': 0.27, '22/6': 0.32, speaker: 0.24,
    fire: 0.27, coax: 0.27,
  };
  // EMT internal area in sq in (trade size).
  const emt: { size: string; areaIn2: number }[] = [
    { size: '1/2"',   areaIn2: 0.304 },
    { size: '3/4"',   areaIn2: 0.533 },
    { size: '1"',     areaIn2: 0.864 },
    { size: '1-1/4"', areaIn2: 1.496 },
    { size: '1-1/2"', areaIn2: 2.036 },
    { size: '2"',     areaIn2: 3.356 },
  ];
  const items = Object.entries(bundles);
  if (items.length === 0) {
    return (
      <DrawerSection title="Conduit assist">
        <div className="text-[11px] text-muted-foreground italic px-1">
          No cable bundles yet. Multi-select devices and choose "Run to IDF" to create one — Assist will compute conduit fill and recommend a size here.
        </div>
      </DrawerSection>
    );
  }
  return (
    <DrawerSection title="Conduit assist">
      <div className="space-y-2.5">
        {items.map(([bundleId, group]) => {
          const cableType = String(group[0]?.cableType ?? 'cat6a').toLowerCase();
          const od = cableOdIn[cableType] ?? 0.31;
          const count = group.length;
          const cableAreaTotal = count * Math.PI * (od / 2) ** 2;
          const rule = count === 1 ? 0.53 : count === 2 ? 0.31 : 0.40;
          // Recommended = smallest EMT that satisfies the fill rule.
          const recommended = emt.find((e) => cableAreaTotal / e.areaIn2 <= rule);
          const target = group[0]?.targetId ?? '—';
          return (
            <div key={bundleId} className="rounded-md border border-border bg-background p-2.5">
              <div className="flex items-baseline justify-between">
                <div className="text-[12px] font-medium tracking-tight">{count}× {cableType.toUpperCase()} → {target}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{(rule * 100).toFixed(0)}% rule</div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Cable OD {od}″ · total area <span className="tabular-nums text-foreground">{cableAreaTotal.toFixed(3)} in²</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {emt.map((e) => {
                  const fillPct = (cableAreaTotal / e.areaIn2) * 100;
                  const ok = fillPct / 100 <= rule;
                  return (
                    <div
                      key={e.size}
                      className="rounded border px-2 py-1 text-[10px] flex items-center justify-between"
                      style={{
                        borderColor: ok ? 'rgba(79,184,126,0.30)' : 'rgba(229,162,58,0.30)',
                        background: ok ? 'rgba(79,184,126,0.06)' : 'rgba(229,162,58,0.06)',
                        color: ok ? '#4FB87E' : '#E5A23A',
                      }}
                    >
                      <span className="font-medium">EMT {e.size}</span>
                      <span className="tabular-nums">{fillPct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] text-foreground">
                {recommended
                  ? <>Recommended conduit: <span className="font-medium">EMT {recommended.size}</span>. Reason: {count} × {cableType.toUpperCase()} fits under the {(rule * 100).toFixed(0) }% rule.</>
                  : <span className="text-amber-200">No standard EMT in stock satisfies the {(rule * 100).toFixed(0)}% rule for this bundle. Recommend splitting into two pathways.</span>}
              </div>
            </div>
          );
        })}
      </div>
    </DrawerSection>
  );
}

/** Real IDF / MDF / Rack port schedule, populated live from the bundle
 *  pathways that target this IDF. Lists incoming runs, assigned PP +
 *  SW ports, PoE load, spare capacity, and over-capacity warnings.
 *  Honest by design — assumes one 24-port PP-01 and one 24-port SW-01
 *  unless the IDF carries `switches[]` from the store. */
function IdfPortScheduleSection({ idfId }: { idfId: string }) {
  const pathways = useProjectStore((s) => s.pathways);
  const devices = useProjectStore((s) => s.devices);
  const floors = useProjectStore((s) => s.floors);
  const incoming = useMemo(
    () => (Object.values(pathways) as any[])
      .filter((p) => (p?.targetId ?? p?.destinationId) === idfId)
      .sort((a, b) => (a.patchPort ?? 999) - (b.patchPort ?? 999)),
    [pathways, idfId],
  );
  const PP_PORTS = 24;
  const SW_PORTS = 24;
  const SW_POE_BUDGET_W = 370; // Aruba 2930F-24G PoE+ class budget
  const poeLoad = incoming.length * 9.8; // assume ~10 W per camera
  const ppOver = incoming.filter((p) => p.patchPort && p.patchPort > PP_PORTS).length;
  const swOver = incoming.filter((p) => p.switchPort && p.switchPort > SW_PORTS).length;
  return (
    <>
      <DrawerSection title={`Incoming runs · ${incoming.length}`}>
        {incoming.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic px-1">
            No cable runs target this IDF yet. Use Run to IDF from the canvas to assign devices here.
          </div>
        ) : (
          <div className="space-y-1">
            {incoming.map((p) => {
              const src = devices[p.sourceId ?? ''] as any;
              return (
                <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md border border-border/40 bg-secondary/20 text-[11px]">
                  <span className="text-muted-foreground tabular-nums w-12">{String(p.cableType ?? 'cat6a').toUpperCase()}</span>
                  <span className="flex-1 truncate font-medium text-foreground">{src?.id ?? p.sourceId ?? p.id}</span>
                  <span className="text-muted-foreground tabular-nums">{pathwayLengthFt(p, floors[p.floorId ?? ''])} ft</span>
                  {p.patchPort && <span className="text-[10px] text-muted-foreground">PP·{String(p.patchPort).padStart(2, '0')}</span>}
                  {p.switchPort && <span className="text-[10px] text-muted-foreground">SW·{String(p.switchPort).padStart(2, '0')}</span>}
                </div>
              );
            })}
          </div>
        )}
      </DrawerSection>
      <DrawerSection title="Patch panel · PP-01">
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: PP_PORTS }).map((_, i) => {
            const port = i + 1;
            const run = incoming.find((p) => p.patchPort === port);
            const src = run && (devices[run.sourceId ?? ''] as any);
            return (
              <div
                key={port}
                title={run ? `Port ${String(port).padStart(2, '0')} → ${src?.id ?? run.sourceId}` : `Port ${String(port).padStart(2, '0')} · spare`}
                className="aspect-square rounded text-[9px] flex items-center justify-center"
                style={{
                  background: run ? 'rgba(93,160,232,0.18)' : 'rgba(255,255,255,0.04)',
                  color: run ? '#5DA0E8' : 'var(--muted-foreground)',
                  border: '1px solid ' + (run ? 'rgba(93,160,232,0.32)' : 'rgba(255,255,255,0.06)'),
                }}
              >
                {String(port).padStart(2, '0')}
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1.5">
          {incoming.filter((p) => p.patchPort).length} / {PP_PORTS} used · {PP_PORTS - incoming.filter((p) => p.patchPort).length} spare
          {ppOver > 0 && <span className="text-amber-300 ml-2">· {ppOver} over capacity</span>}
        </div>
      </DrawerSection>
      <DrawerSection title="Switch · SW-01 (Aruba 2930F-24P)">
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: SW_PORTS }).map((_, i) => {
            const port = i + 1;
            const run = incoming.find((p) => p.switchPort === port);
            const src = run && (devices[run.sourceId ?? ''] as any);
            return (
              <div
                key={port}
                title={run ? `Port ${String(port).padStart(2, '0')} → ${src?.id ?? run.sourceId}` : `Port ${String(port).padStart(2, '0')} · spare`}
                className="aspect-square rounded text-[9px] flex items-center justify-center"
                style={{
                  background: run ? 'rgba(79,184,126,0.18)' : 'rgba(255,255,255,0.04)',
                  color: run ? '#4FB87E' : 'var(--muted-foreground)',
                  border: '1px solid ' + (run ? 'rgba(79,184,126,0.32)' : 'rgba(255,255,255,0.06)'),
                }}
              >
                {String(port).padStart(2, '0')}
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1.5">
          {incoming.filter((p) => p.switchPort).length} / {SW_PORTS} used · PoE load {poeLoad.toFixed(1)} W / budget {SW_POE_BUDGET_W} W
          {swOver > 0 && <span className="text-amber-300 ml-2">· {swOver} over capacity</span>}
          {poeLoad > SW_POE_BUDGET_W && <span className="text-amber-300 ml-2">· PoE over budget</span>}
        </div>
      </DrawerSection>
      <DrawerSection title="Assist">
        <div className="space-y-1.5">
          {ppOver > 0 && <FindingRow severity="warn" text={`${ppOver} runs exceed the patch panel's 24-port capacity. Add a second 24-port PP or move to a 48-port unit.`} />}
          {swOver > 0 && <FindingRow severity="warn" text={`${swOver} runs exceed the switch's 24-port capacity. Add an uplink and a second 24-port switch.`} />}
          {poeLoad > SW_POE_BUDGET_W && <FindingRow severity="high" text={`PoE load ${poeLoad.toFixed(0)} W exceeds the 370 W budget. Add a PoE midspan or move to a larger PoE++ switch.`} />}
          {ppOver === 0 && swOver === 0 && poeLoad <= SW_POE_BUDGET_W && (
            <FindingRow severity="ok" text="Capacity nominal — patch panel, switch, and PoE budget all within design limits." />
          )}
        </div>
      </DrawerSection>
    </>
  );
}

function FindingRow({ severity, text }: { severity: 'high' | 'warn' | 'ok'; text: string }) {
  const tone = severity === 'high' ? '#E55B5B' : severity === 'warn' ? '#E5A23A' : '#4FB87E';
  return (
    <div className="flex items-start gap-2 rounded-md border p-2" style={{ borderColor: `${tone}40`, background: `${tone}10` }}>
      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: tone }} />
      <span className="text-[11px] leading-snug" style={{ color: tone }}>{text}</span>
    </div>
  );
}

function AiOptimizeSection({ d, tone }: { d: Device; tone: string }) {
  const [mode, setMode] = useState<'overview' | 'prosecution'>('overview');
  const rangeFt = d.range ?? (d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30);
  const fovDeg  = d.fov ?? (d.type === 'cam.ptz' ? 36 : d.type === 'cam.fisheye' ? 360 : 70);
  // Item 8 + Audit Group A.1 — same density chain as the cone bands +
  // probe + Target preview. Replaces the hardcoded `sensorPx = 1920`
  // so this section's "general usefulness" density at half range now
  // agrees with every other density readout in the drawer. Display
  // unit is px/ft (single canvas-wide unit per the audit) and the
  // pass/fail thresholds come from DORI_PX_PER_FT so a future tweak
  // to the IEC table can't drift this surface out of sync.
  const aiResolution = cameraResolution(d);
  const sensorPx = aiResolution?.widthPx ?? 1920;
  const halfFovRad = (fovDeg * Math.PI / 180) / 2;
  const tanHalfFov = Math.tan(halfFovRad);
  const midDistFt = rangeFt * 0.5;
  const pxPerFt = tanHalfFov > 0 ? sensorPx / (2 * midDistFt * tanHalfFov) : Infinity;
  // Threshold for license plate at ~4 m / 13 ft (320 px/m ≈ 97.54 px/ft);
  // not in DORI_PX_PER_FT because LPR isn't a DORI grade — kept local.
  const LPR_PX_PER_FT = 320 / 3.28084;

  return (
    <>
      <DrawerSection title="Optimize">
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setMode('overview')}
            className="flex-1 py-1.5 rounded text-[11px]"
            style={mode === 'overview'
              ? { background: `${tone}1A`, color: '#F8FAFC', boxShadow: `inset 0 0 0 1px ${tone}55` }
              : { color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Overview
          </button>
          <button
            onClick={() => setMode('prosecution')}
            className="flex-1 py-1.5 rounded text-[11px]"
            style={mode === 'prosecution'
              ? { background: `${tone}1A`, color: '#F8FAFC', boxShadow: `inset 0 0 0 1px ${tone}55` }
              : { color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Prosecution
          </button>
        </div>
        {mode === 'overview' ? (
          <>
            <Row label="Range"      value={`${rangeFt} ft`} />
            <Row label="HFOV"       value={`${fovDeg}°`} />
            <Row label="Coverage"   value={`${Math.round((Math.PI * Math.pow(rangeFt, 2) * (fovDeg / 360)))} sq ft`} />
            <Row label="Mount AFF"  value={`${d.mountFt ?? 10} ft`} />
            <Row label="IR"         value={d.ir ? 'Enabled' : 'No IR'} tone={d.ir ? '#34D399' : undefined} />
            <Row label="NDAA"       value={d.ndaa ? 'Compliant' : '—'} tone={d.ndaa ? '#34D399' : undefined} />
          </>
        ) : (
          <>
            <Row label="px/ft @ midrange" value={pxPerFt.toFixed(1)} />
            <Row label="Identification"  value={pxPerFt >= DORI_PX_PER_FT.identify ? 'Yes' : pxPerFt >= DORI_PX_PER_FT.recognize ? 'Marginal' : 'No'} tone={pxPerFt >= DORI_PX_PER_FT.identify ? '#34D399' : pxPerFt >= DORI_PX_PER_FT.recognize ? '#FACC15' : '#F87171'} />
            <Row label="Recognition"     value={pxPerFt >= DORI_PX_PER_FT.recognize ? 'Yes' : 'No'} tone={pxPerFt >= DORI_PX_PER_FT.recognize ? '#34D399' : '#F87171'} />
            <Row label="License plate"   value={d.type === 'cam.lpr' ? 'LPR sensor · yes' : (pxPerFt >= LPR_PX_PER_FT ? 'Yes (≤13 ft)' : 'Marginal')} tone={d.type === 'cam.lpr' ? '#34D399' : (pxPerFt >= LPR_PX_PER_FT ? '#34D399' : '#FACC15')} />
            <Row label="Forensic export" value={pxPerFt >= DORI_PX_PER_FT.identify ? 'Court-ready' : 'Best-effort'} tone={pxPerFt >= DORI_PX_PER_FT.identify ? '#34D399' : '#FACC15'} />
            <Row label="Distance @ ID grade" value={tanHalfFov > 0 ? `${Math.round(sensorPx / (2 * DORI_PX_PER_FT.identify * tanHalfFov))} ft` : '—'} />
          </>
        )}
      </DrawerSection>
      <DrawerSection title={mode === 'overview' ? 'Heuristic suggestions' : 'Heuristic forensic notes'}>
        <div className="text-[10px] uppercase tracking-[0.10em] text-amber-300 mb-1">
          Static checklist · not generated by AI
        </div>
        {(mode === 'overview'
          ? [
            'Rotate ±12° to remove blind spot at corner',
            'Drop mount height to 8 ft for tighter face area',
            'Move 4 ft toward entry to widen coverage of approach',
            'Enable IR for 24/7 starlight performance',
          ]
          : [
            'Step focal to 6.0 mm to push ID-grade pixels at door',
            'Add a second camera at 30° offset for face cross-shot',
            'Switch to 4K sensor (currently 1080p) for plate at 30 ft',
            'Lower mount to 7 ft for prosecution-grade face capture',
          ]
        ).map((s, i) => (
          // Static checklist row. Was a disabled button which violated
          // the "no disabled controls with disclaimer text" rule from
          // CLAUDE.md; rendered as a plain list instead.
          <div key={i} className="w-full text-left text-[11px] text-foreground px-2 py-1.5 mb-1 rounded border border-white/10">
            <Sparkles className="w-3 h-3 inline mr-1.5" style={{ color: tone }} />{s}
          </div>
        ))}
      </DrawerSection>
      {/* The previous "Analytics" block claimed live telemetry — face
          recognition, LPR, object detection, edge-GPU load — that the
          canvas does not have. Removed entirely; analytics belong on a
          live connector, not in a static drawer card. */}
    </>
  );
}

function PathwayDrawer({ pathwayId, onClose, onOpenBundle }: {
  pathwayId: string;
  onClose: () => void;
  onOpenBundle: (bundleId: string) => void;
}) {
  const pathways = useProjectStore((s) => s.pathways);
  const devices  = useProjectStore((s) => s.devices);
  const floors   = useProjectStore((s) => s.floors);
  const updatePathway = useProjectStore((s) => s.updatePathway);
  const removePathway = useProjectStore((s) => s.removePathway);
  const p = (pathways as any)[pathwayId];
  // Sub-tab state: General / Route / Conduit / Terminations / Accessories / Suggestions / BOM / Notes
  type Sub = 'general' | 'route' | 'conduit' | 'terms' | 'acc' | 'sugg' | 'bom' | 'notes' | 'files';
  const [sub, setSub] = useState<Sub>('general');
  if (!p) {
    return (
      <div className="shrink-0 w-[420px] h-full bg-card border-l border-border p-4">
        <div className="text-[12px] text-muted-foreground">Pathway not found.</div>
        <button onClick={onClose} className="mt-3 text-[11px] px-3 h-7 rounded-md border border-border">Close</button>
      </div>
    );
  }
  const isCable = !p.pathwayKind || p.pathwayKind === 'cable';
  const isConduit = p.pathwayKind === 'conduit' || p.pathwayKind === 'tray' || p.pathwayKind === 'jhook' || p.pathwayKind === 'sleeve' || p.pathwayKind === 'raceway' || p.pathwayKind === 'duct';
  const cableType = String(p.cableType ?? 'cat6a');
  const src = p.sourceId ? (devices as any)[p.sourceId] : undefined;
  const tgt = p.targetId ? (devices as any)[p.targetId] : (p.destinationId ? (devices as any)[p.destinationId] : undefined);
  // Cable accessories that have auto-attached to this pathway.
  const attached = useMemo(() =>
    Object.values(devices as any).filter((d: any) => d?.attachedPathwayId === pathwayId),
  [devices, pathwayId]);
  // Cable runs inside a conduit pathway. Today we report runs that
  // declare this id as their assigned conduit (extended type) OR
  // share spatial proximity. Honest minimum: same `attachedPathwayId`.
  const cablesInside = useMemo(() => {
    if (!isConduit) return [] as any[];
    return Object.values(pathways as any).filter((x: any) => x.id !== pathwayId && x.attachedPathwayId === pathwayId);
  }, [pathways, pathwayId, isConduit]);
  const fill = isConduit ? computeBundleFill(cablesInside.length || 0, String(cablesInside[0]?.cableType ?? 'cat6a'), p.conduitSize) : null;
  // Cable distance assist: > 295 ft on copper Ethernet is over spec
  const lenFt = pathwayLengthFt(p, floors[p.floorId ?? '']);
  const overDistance = isCable && !cableType.includes('fiber') && lenFt > 295;

  const SUB_TABS: { id: Sub; label: string; icon: any }[] = isCable
    ? [
        { id: 'general',   label: 'General',      icon: ListChecks },
        { id: 'route',     label: 'Route',        icon: PencilLine },
        { id: 'conduit',   label: 'Conduit',      icon: PencilRuler },
        { id: 'terms',     label: 'Ports',        icon: NetworkIcon },
        { id: 'acc',       label: 'Accessories',  icon: PencilRuler },
        { id: 'sugg',      label: 'Suggestions',  icon: Sparkles },
        { id: 'bom',       label: 'BOM',          icon: DollarSign },
        { id: 'notes',     label: 'Notes',        icon: FileText },
        { id: 'files',     label: 'Files',        icon: Paperclip },
      ]
    : [
        { id: 'general',   label: 'General',      icon: ListChecks },
        { id: 'conduit',   label: 'Type / Size',  icon: PencilRuler },
        { id: 'terms',     label: 'Cables',       icon: Cable },
        { id: 'route',     label: 'Pull boxes',   icon: PencilLine },
        { id: 'sugg',      label: 'Suggestions',  icon: Sparkles },
        { id: 'bom',       label: 'BOM',          icon: DollarSign },
        { id: 'notes',     label: 'Notes',        icon: FileText },
        { id: 'files',     label: 'Files',        icon: Paperclip },
      ];

  return (
    <div
      className="shrink-0 h-full flex flex-col"
      style={{
        width: 420,
        background: 'var(--drawer-background)',
        color: 'var(--drawer-foreground)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      <div className="px-5 pt-5 pb-3 border-b border-white/[0.05] flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: isConduit ? '#A371F71F' : '#22D3EE1F', color: isConduit ? '#A371F7' : '#22D3EE', boxShadow: 'inset 0 0 0 1px ' + (isConduit ? '#A371F755' : '#22D3EE55') }}>
          {isConduit ? <PencilRuler className="w-5 h-5" /> : <Cable className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold tracking-tight">{p.id}</div>
          <div className="text-[11px] text-muted-foreground">
            {isConduit
              ? `${p.conduitType ?? p.pathwayKind?.toUpperCase()}${p.conduitSize ? ' ' + p.conduitSize : ''} · ${lenFt} ft`
              : `${cableType.toUpperCase()} · ${lenFt} ft${src ? ` · ${src.id ?? p.sourceId} →` : ''} ${tgt?.id ?? p.targetId ?? p.destinationId ?? '—'}`}
          </div>
          {p.bundleId && (
            <button onClick={() => onOpenBundle(p.bundleId)} data-track="pathway-open-bundle" className="mt-1 text-[10px] text-primary hover:underline">
              In bundle {p.bundleId} → open bundle inspector
            </button>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
      </div>

      <div className="px-3 py-2 border-b border-white/[0.05] grid grid-cols-4 gap-1">
        {SUB_TABS.map((t) => {
          const active = sub === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              data-track={`pathway-tab-${t.id}`}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-md text-[10px] tracking-tight transition-colors ${active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
            >
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-auto p-3 space-y-3" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {sub === 'general' && (
          <DrawerSection title={isConduit ? 'Conduit summary' : 'Cable summary'}>
            <Row label="ID"           value={p.id} />
            <Row label={isConduit ? 'Type' : 'Cable type'} value={isConduit ? (p.conduitType ?? p.pathwayKind?.toUpperCase() ?? 'EMT') : cableType.toUpperCase()} />
            {isConduit && p.conduitSize && <Row label="Trade size" value={p.conduitSize} />}
            <Row label="Length"       value={`${lenFt} ft`} />
            {src && <Row label="Source"      value={src.id ?? p.sourceId} />}
            {(tgt || p.targetId) && <Row label="Destination" value={tgt?.id ?? p.targetId} />}
            {p.bundleId && <Row label="Bundle"      value={p.bundleId} />}
            {p.patchPort && <Row label="Patch port"  value={`PP-01 · ${String(p.patchPort).padStart(2, '0')}`} />}
            {p.switchPort && <Row label="Switch port" value={`SW-01 · ${String(p.switchPort).padStart(2, '0')}`} />}
          </DrawerSection>
        )}

        {isCable && sub === 'route' && (
          <DrawerSection title="Route">
            <Row label="Vertices" value={String((p.points ?? []).length)} />
            <Row label="Route length" value={`${lenFt} ft (incl. 10% slack + service loop)`} />
            <Row label="Source"     value={src?.id ?? p.sourceId ?? '—'} />
            <Row label="Destination" value={tgt?.id ?? p.targetId ?? '—'} />
            {overDistance && <FindingRow severity="warn" text={`Run is ${lenFt} ft — exceeds 295 ft copper Ethernet limit. Switch to fiber or add an intermediate switch.`} />}
          </DrawerSection>
        )}

        {sub === 'conduit' && (
          isCable ? (
            <DrawerSection title="Conduit assignment">
              <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1.5">Conduit type</div>
              <div className="flex flex-wrap gap-1 mb-3">
                {(['none','EMT','PVC','FMC','LFMC','tray'] as const).map((t) => {
                  const active = (p.conduitType ?? 'none') === t;
                  return (
                    <button
                      key={t}
                      onClick={() => updatePathway(pathwayId, { conduitType: t === 'none' ? undefined : t, conduitSize: t === 'none' ? undefined : p.conduitSize } as any)}
                      data-track={`pathwaydrawer-conduit-${t}`}
                      className={`text-[11px] px-2 py-1 rounded border transition-colors ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                    >{t === 'none' ? 'None' : t}</button>
                  );
                })}
              </div>
              {p.conduitType && (
                <>
                  <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1.5">Trade size</div>
                  <div className="grid grid-cols-3 gap-1">
                    {EMT_SIZES.map((e) => {
                      const active = p.conduitSize === e.size;
                      return (
                        <button
                          key={e.size}
                          onClick={() => updatePathway(pathwayId, { conduitSize: e.size } as any)}
                          data-track={`pathwaydrawer-size-${e.size.replace(/\W/g,'')}`}
                          className={`text-[11px] py-1 rounded border transition-colors ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                        >{e.size}</button>
                      );
                    })}
                  </div>
                </>
              )}
            </DrawerSection>
          ) : (
            <DrawerSection title="Conduit type & size">
              <Row label="Type" value={p.conduitType ?? p.pathwayKind?.toUpperCase() ?? '—'} />
              <Row label="Trade size" value={p.conduitSize ?? '—'} />
              <Row label="Internal area" value={p.conduitSize ? `${EMT_SIZES.find((e) => e.size === p.conduitSize)?.areaIn2.toFixed(3) ?? '—'} in²` : '—'} />
              <Row label="Length" value={`${lenFt} ft`} />
            </DrawerSection>
          )
        )}

        {sub === 'terms' && (
          isCable ? (
            <>
              <DrawerSection title="Terminations">
                {attached.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground italic">No terminations placed. Drop a jack, coupler, or patch panel from the bottom Cabling tray near this run to attach it.</div>
                ) : (
                  <div className="space-y-1">
                    {attached.map((a: any) => (
                      <Row key={a.id} label={`${a.accessoryKind ?? 'Accessory'} · ${a.id}`} value="attached" tone="#4FB87E" />
                    ))}
                  </div>
                )}
              </DrawerSection>
              <DrawerSection title="Ports">
                <Row label="Patch panel port" value={p.patchPort ? `PP-01 · ${String(p.patchPort).padStart(2, '0')}` : '—'} />
                <Row label="Switch port"      value={p.switchPort ? `SW-01 · ${String(p.switchPort).padStart(2, '0')}` : '—'} />
              </DrawerSection>
            </>
          ) : (
            <DrawerSection title={`Cables inside · ${cablesInside.length}`}>
              {cablesInside.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic">No cables routed through this conduit yet. Drop a cable run near it or use Run-to-IDF with "Existing conduit".</div>
              ) : (
                <div className="space-y-1">
                  {cablesInside.map((c: any) => (
                    <Row key={c.id} label={c.id} value={String(c.cableType ?? 'cat6').toUpperCase()} />
                  ))}
                </div>
              )}
              {fill && p.conduitSize && (
                <div className="mt-2">
                  <Row label="Fill" value={`${fill.fillPct.toFixed(1)}% (${(fill.rule * 100).toFixed(0)}% rule)`} tone={fill.passes ? '#4FB87E' : '#E5A23A'} />
                  {fill.recommended && !fill.passes && (
                    <button
                      onClick={() => updatePathway(pathwayId, { conduitSize: fill.recommended } as any)}
                      data-track="pathwaydrawer-apply-recommendation"
                      className="mt-2 text-[11px] font-medium px-3 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    >
                      Apply recommended {fill.recommended}
                    </button>
                  )}
                </div>
              )}
            </DrawerSection>
          )
        )}

        {sub === 'acc' && (
          <DrawerSection title="Accessories">
            <div className="text-[11px] text-muted-foreground italic mb-2">
              {isCable ? 'Cable accessories for this run. Tally rolls up into BOM.' : 'Conduit accessories for this run.'}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(isCable
                ? ['jack','coupler','patchcord','label','firestop','sleeve','pullbox'] as const
                : ['pullbox','jbox','coupler','firestop','sleeve','tray'] as const
              ).map((kind) => {
                const count = (p.accessories?.[kind as any] ?? 0);
                return (
                  <div key={kind} className="rounded-md border border-border bg-background px-2.5 py-2 flex items-center justify-between text-[11px]">
                    <span className="font-medium tracking-tight capitalize">{kind}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updatePathway(pathwayId, { accessories: { ...(p.accessories ?? {}), [kind]: Math.max(0, count - 1) } } as any)}
                        className="w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        data-track={`pathwaydrawer-acc-dec-${kind}`}
                      >−</button>
                      <span className="tabular-nums w-5 text-center">{count}</span>
                      <button
                        onClick={() => updatePathway(pathwayId, { accessories: { ...(p.accessories ?? {}), [kind]: count + 1 } } as any)}
                        className="w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        data-track={`pathwaydrawer-acc-inc-${kind}`}
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </DrawerSection>
        )}

        {sub === 'sugg' && (
          <DrawerSection title="Suggestions">
            {(() => {
              const findings: { sev: 'high' | 'warn' | 'ok'; text: string }[] = [];
              if (isCable) {
                if (overDistance) findings.push({ sev: 'warn', text: `Run is ${lenFt} ft — exceeds 295 ft copper Ethernet limit. Switch to fiber or add an intermediate switch closer to the source.` });
                if (cableType === 'cat6' && p.notes?.toLowerCase().includes('outdoor')) findings.push({ sev: 'warn', text: 'Indoor Cat6 routed outdoors. Use outdoor or direct-burial cable.' });
                if (!p.patchPort)  findings.push({ sev: 'warn', text: 'No patch panel port assigned. Use IDF drawer or BundleInspector "Assign ports sequentially".' });
                if (!p.switchPort) findings.push({ sev: 'warn', text: 'No switch port assigned. Same path.' });
                if ((p.accessories?.firestop ?? 0) === 0 && (p.notes?.toLowerCase().includes('wall') || p.notes?.toLowerCase().includes('plenum'))) findings.push({ sev: 'warn', text: 'Wall/plenum penetration noted — add firestop sleeve + sealant.' });
                if (findings.length === 0) findings.push({ sev: 'ok', text: 'Run looks healthy. Distance, terminations, and rating all within spec.' });
              } else {
                if (cablesInside.length === 0) findings.push({ sev: 'warn', text: 'No cables assigned. Drop cable runs onto this pathway or use Run-to-IDF with "Existing conduit".' });
                if (fill && !fill.passes) findings.push({ sev: 'warn', text: `Conduit overfilled (${fill.fillPct.toFixed(0)}%). ${fill.recommended ? `Recommend ${fill.recommended} or split.` : 'Split conduit — no standard size satisfies the rule.'}` });
                if ((p.accessories?.pullbox ?? 0) === 0 && (p.points ?? []).length > 3) findings.push({ sev: 'warn', text: 'Long route with multiple bends — add at least one pull box to reduce pulling tension.' });
                if (findings.length === 0) findings.push({ sev: 'ok', text: 'Conduit looks healthy. Fill, capacity, and bends all within spec.' });
              }
              return (
                <div className="space-y-1.5">
                  {findings.map((f, i) => <FindingRow key={i} severity={f.sev} text={f.text} />)}
                </div>
              );
            })()}
          </DrawerSection>
        )}

        {sub === 'bom' && (
          <DrawerSection title="BOM impact">
            <Row label={isConduit ? 'Conduit footage' : 'Cable footage'} value={`${lenFt} ft`} />
            {isCable && cableType && <Row label="Cable type" value={cableType.toUpperCase()} />}
            {p.accessories && Object.entries(p.accessories).map(([k, v]: any) => (
              v ? <Row key={k} label={k} value={String(v)} /> : null
            ))}
            {p.conduitType && p.conduitSize && <Row label="Conduit" value={`${p.conduitType} ${p.conduitSize}`} />}
            <div className="mt-2 text-[10px] text-muted-foreground italic">Counts flow into project BOM via the Pathways selector.</div>
          </DrawerSection>
        )}

        {sub === 'notes' && (
          <>
            <DrawerSection title="Notes">
              <textarea
                key={pathwayId}
                value={p.notes ?? ''}
                onChange={(e) => updatePathway(pathwayId, { notes: e.target.value } as any)}
                placeholder="Pathway notes — pulling strategy, firestop ratings, route deviations, etc."
                className="dv-input text-[12px] resize-none min-h-[120px]"
              />
              <button
                onClick={() => { removePathway(pathwayId); onClose(); toast.message('Pathway removed', { duration: 2500 }); }}
                data-track="pathwaydrawer-remove"
                className="mt-3 text-[11px] px-3 h-8 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                Delete pathway
              </button>
            </DrawerSection>
            <SurveyPanel
              projectId={p.projectId}
              floorId={p.floorId}
              objectType="pathway"
              objectId={pathwayId}
            />
          </>
        )}

        {sub === 'files' && (
          <DrawerSection title="Files & attachments">
            <AttachmentPanel
              projectId={p.projectId}
              linkedObjectType="pathway"
              linkedObjectId={pathwayId}
              defaultCategory="photo"
              title="Pathway files"
              compact
            />
          </DrawerSection>
        )}
      </div>
    </div>
  );
}

// V3.3 — small ray-casting point-in-polygon used by the drawer
// header to resolve which room (if any) contains the selected
// device. Stays local because no other surface needs it yet.
function pointInPolygon(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    const intersect = ((a.y > p.y) !== (b.y > p.y))
      && (p.x < (b.x - a.x) * (p.y - a.y) / ((b.y - a.y) || 1e-9) + a.x);
    if (intersect) inside = !inside;
  }
  return inside;
}

// IntelIssue restored from the M11 EditDrawer / TargetSimOverlay /
// CoverageModeSwitch deletion. The interface was sandwiched in the
// dead range and is still consumed by computeIntelIssues (and the
// IntelligenceLayer component that renders the chips and the AI
// pill). Keeping it here at the same scope it had before the delete.
interface IntelIssue {
  id: string;
  kind: 'overlap' | 'blindspot' | 'poe' | 'low-light' | 'nec' | 'storage' | 'ada' | 'permit' | 'compliance' | 'cabling';
  severity: 'info' | 'warn' | 'high';
  x: number;
  y: number;
  label: string;
  detail: string;
  /** Optional suggestion the AI assistant prints below the headline. */
  suggestion?: string;
}

/** Real-time engineering intelligence — pulls signals from the canvas state
 *  and surfaces actionable findings. This is the substrate that drives both
 *  the on-canvas chips AND the embedded AI Assistant panel.
 *
 *  SC.7.1: takes the per-floor pixel-to-foot scale so the physical-distance
 *  checks (cable run > 90m, etc.) use real feet on calibrated floors. Falls
 *  back to the canvas default (0.05 ft/px) when the floor is uncalibrated. */
function computeIntelIssues(devices: Device[], pxToFt: number): IntelIssue[] {
  const cams = devices.filter((d) => TYPE_KIND[d.type] === 'camera');
  const access = devices.filter((d) => TYPE_KIND[d.type] === 'access');
  const idfs = devices.filter((d) => d.type === 'net.idf' || d.type === 'net.switch');
  const maglocks = devices.filter((d) => d.type === 'acc.maglock');
  const out: IntelIssue[] = [];

  // ── 1. Coverage overlap (two cameras within 80px) ──
  for (let i = 0; i < cams.length; i++) {
    for (let j = i + 1; j < cams.length; j++) {
      const a = cams[i], b = cams[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 80) {
        out.push({
          id: `ov-${a.id}-${b.id}`,
          kind: 'overlap',
          severity: dist < 50 ? 'high' : 'warn',
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          label: 'Coverage overlap',
          detail: `${a.id} ↔ ${b.id} · ${Math.round((1 - dist / 110) * 100)}% redundant`,
          suggestion: 'Re-aim one camera or drop the second — overlap rarely buys redundancy worth the PoE budget.',
        });
      }
    }
  }

  // ── 2. PoE budget pressure ──
  // Average PoE-class draw 12W per camera. If we exceed 360W (most 48-port
  // PoE+ switches' budget), warn. If we exceed 720W (PoE++), error.
  if (cams.length > 0 && idfs.length === 0) {
    out.push({
      id: 'poe-no-idf',
      kind: 'poe',
      severity: 'warn',
      x: cams[0].x, y: cams[0].y - 24,
      label: 'No IDF placed',
      detail: `${cams.length} camera${cams.length === 1 ? '' : 's'} on canvas with no IDF/MDF — switch needed.`,
      suggestion: 'Drop an IDF / network rack from the Network category, then re-home each camera to its closest IDF.',
    });
  } else if (cams.length >= 6) {
    const cx = cams.reduce((s, c) => s + c.x, 0) / cams.length;
    const cy = cams.reduce((s, c) => s + c.y, 0) / cams.length;
    const estW = cams.length * 12;
    out.push({
      id: 'poe-load',
      kind: 'poe',
      severity: estW > 720 ? 'high' : estW > 360 ? 'warn' : 'info',
      x: cx, y: cy,
      label: 'PoE budget',
      detail: `${cams.length} cameras · est. ${estW}W (${estW > 720 ? 'requires PoE++' : estW > 360 ? 'within PoE+ budget' : 'comfortable'}).`,
      suggestion: estW > 720
        ? 'Spread across two PoE++ switches, or move PTZ/multisensor loads to PoE injectors.'
        : 'Stay within ~80% of the switch budget. Reserve headroom for IR LEDs and heater elements outdoors.',
    });
  }

  // ── 3. NVR storage estimate ──
  // 6 Mbps avg bitrate * 24h * 30 days * cameras / 8000 = TB needed
  if (cams.length >= 4) {
    const tb = Math.round((cams.length * 6 * 86400 * 30) / 8e9 * 10) / 10;
    const nvrs = devices.filter((d) => d.type === 'sto.nvr' || d.type === 'sto.server' || d.type === 'sto.cloud').length;
    if (nvrs === 0) {
      out.push({
        id: 'storage-missing',
        kind: 'storage',
        severity: 'warn',
        x: cams[0].x + 60, y: cams[0].y + 60,
        label: 'No NVR placed',
        detail: `${cams.length} cameras · ~${tb} TB for 30-day retention.`,
        suggestion: 'Drop a Recording & Storage device. NVRs ship in 16-, 32-, 64-channel SKUs.',
      });
    }
  }

  // ── 4. Maglock → REX compliance ──
  for (const m of maglocks) {
    const hasRex = access.some((a) =>
      (a.type === 'acc.exit' || a.type === 'acc.dps' || a.type === 'acc.panic-bar')
      && Math.hypot(a.x - m.x, a.y - m.y) < 70,
    );
    if (!hasRex) {
      out.push({
        id: `code-rex-${m.id}`,
        kind: 'compliance',
        severity: 'high',
        x: m.x, y: m.y + 22,
        label: 'Maglock without REX',
        detail: `${m.id} requires a REX (request-to-exit) for fire-egress compliance.`,
        suggestion: 'Drop a REX or panic bar adjacent to this maglock — required by IBC 1010.1.9.7.',
      });
    }
  }

  // ── 5. Blind spot heuristic on bullet cameras aimed away from cluster ──
  cams.forEach((c) => {
    if (c.type === 'cam.bullet' && Math.abs(c.rot) > 150) {
      out.push({
        id: `bs-${c.id}`,
        kind: 'blindspot',
        severity: 'info',
        x: c.x - 22, y: c.y - 18,
        label: 'Possible blind spot',
        detail: `${c.id} aimed away from entry path.`,
        suggestion: 'Confirm this camera covers an actual approach. Re-aim toward the door / sidewalk if not.',
      });
    }
  });

  // ── 6. Cable distance over Cat6 spec (~90m / 295ft) ──
  // SC.7.1: convert each candidate distance to feet via the calibrated
  // scale, then compare against the actual 295 ft threshold. The prior
  // version compared raw pixels (600 px) and divided by 3.83 px/ft for
  // the detail string, which mis-fired on every calibrated background.
  if (idfs.length > 0) {
    for (const c of cams) {
      let minPx = Infinity;
      for (const i of idfs) minPx = Math.min(minPx, Math.hypot(c.x - i.x, c.y - i.y));
      const minFt = minPx * pxToFt;
      if (minFt > 295) {
        out.push({
          id: `cab-${c.id}`,
          kind: 'cabling',
          severity: 'warn',
          x: c.x + 18, y: c.y - 18,
          label: 'Cable run exceeds 90m',
          detail: `${c.id} is ~${Math.round(minFt)} ft from nearest IDF.`,
          suggestion: 'Add a midspan PoE injector at 70m, switch to fiber, or place a closer IDF.',
        });
      }
    }
  }

  // ── 7. ADA reach on readers ──
  // Readers labeled with z-axis height above 48" don't get one yet (no schema
  // for height). Instead flag readers with no linked door — a different ADA
  // signal (path-of-travel) but useful: "where does this go?"
  for (const r of access.filter((d) => d.type === 'acc.reader')) {
    if (!r.linkedIds?.length) {
      out.push({
        id: `ada-${r.id}`,
        kind: 'ada',
        severity: 'info',
        x: r.x, y: r.y + 22,
        label: 'Reader unlinked',
        detail: `${r.id} is not linked to a door — confirm mount height ≤ 48\".`,
        suggestion: 'Drag this reader onto a door, or open Inspector → Link to specify the host.',
      });
    }
  }

  // ── 8. Pole-mount permit hint (when an LPR or PTZ has been placed near
  //     the canvas edge — proxy for "perimeter" / "outdoors") ──
  for (const c of cams) {
    if ((c.type === 'cam.ptz' || c.type === 'cam.lpr') && (c.x < 80 || c.x > 720 || c.y < 80 || c.y > 520)) {
      out.push({
        id: `permit-${c.id}`,
        kind: 'permit',
        severity: 'info',
        x: c.x, y: c.y + 28,
        label: 'Pole mount likely',
        detail: `${c.id} placed at perimeter — pole / parapet mount may require a building permit.`,
        suggestion: 'Confirm with local AHJ before bidding. Pasadena / LA County typically require it for >10ft poles.',
      });
    }
  }

  return out;
}

/** Right floating rail — mirrors the left DrawingToolRail's
 *  collapse-on-hover behavior, with labels reading INWARD (to the
 *  left of each icon) so they never spill off the right edge of the
 *  canvas. Icons-only by default; on desktop hover or touch tap the
 *  rail widens and labels appear next to the icons. Floats over the
 *  canvas; no layout reflow.
 *
 *  Items today: Chips toggle (on-canvas intel chips visibility), AI
 *  Assistant open/close. No fabricated nav, no decorative dots —
 *  the assistant tile shows real `high` / `warn` counts only when
 *  the assistant rule run produces them; "clear" replaces them when
 *  the canvas has no findings at all. */

function IntelligenceLayer({ devices, pxToFt, zoom, open, setOpen, setZoom, onFit, onActual }: { devices: Device[]; pxToFt: number; zoom: number; open: boolean; setOpen: (b: boolean) => void; setZoom: (z: number) => void; onFit: () => void; onActual: () => void }) {
  const issues = useMemo(() => computeIntelIssues(devices, pxToFt), [devices, pxToFt]);
  const summary = useMemo(() => {
    const by: Record<string, number> = {};
    issues.forEach((i) => { by[i.severity] = (by[i.severity] ?? 0) + 1; });
    return by;
  }, [issues]);
  /** Active "AI Assistant" side-panel state. The pill in the top-right both
   *  toggles inline canvas chips (compact mode, default) and opens the
   *  full assistant panel for an expanded engineering review. */
  const [panelOpen, setPanelOpen] = useState(false);
  // Item 3 — the right rail is now always visible because it carries
  // the zoom controls (previously bottom-left ZoomDock). The
  // on-canvas intelligence chips + the assistant panel still gate
  // on `open`; only the rail itself renders unconditionally.
  const toneFor = (k: IntelIssue['kind']) =>
    k === 'overlap' ? '#F59E0B'
    : k === 'blindspot' ? '#FB7185'
    : k === 'poe' ? '#7CC2FF'
    : k === 'low-light' ? '#A78BFA'
    : k === 'storage' ? '#3FB950'
    : k === 'ada' ? '#A78BFA'
    : k === 'permit' ? '#E5B23A'
    : k === 'compliance' ? '#E5484D'
    : k === 'cabling' ? '#22D3EE'
    : '#34D399';
  const sevDot = (s: IntelIssue['severity']) => s === 'high' ? '#F87171' : s === 'warn' ? '#FACC15' : '#7CC2FF';
  return (
    <>
      {/* canvas chips */}
      {open && issues.map((iss) => (
        <div
          key={iss.id}
          className="absolute z-20 pointer-events-auto select-none"
          style={{ left: iss.x * zoom, top: iss.y * zoom, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[10px] whitespace-nowrap"
            style={{
              background: 'rgba(8,12,20,0.82)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${toneFor(iss.kind)}55`,
              boxShadow: `0 6px 14px -6px rgba(0,0,0,0.6), 0 0 0 1px ${toneFor(iss.kind)}22`,
              color: '#E2E8F0',
            }}
            title={iss.detail}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sevDot(iss.severity), animation: 'glow-breathe 2.4s ease-in-out infinite' }} />
            <span className="font-medium tracking-wide">{iss.label}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{iss.detail}</span>
          </div>
        </div>
      ))}

      {/* M4 — IntelligenceRail render removed. The zoom controls,
          chips toggle, and view layers it carried are merged into the
          unified LeftRail (canvas/chrome/LeftRail.tsx). The intel
          chips overlay above this comment still renders unconditionally
          when `open` is true. */}

      {/* AI Assistant side panel — embedded on the right of the canvas.
          Lists every issue with severity, location, and suggestion.
          Clicking a row scrolls the canvas viewport to that issue's
          coordinates. Not a chatbot — this is an engineering review
          that updates the moment the canvas changes. */}
      {panelOpen && (
        <div
          /* Group C.5 — assistant panel now opens from the BOTTOM-LEFT
             where the new intel rail lives, instead of the cleared
             right side. Bottom anchor keeps the panel docked to the
             button that opened it; max-height keeps it from
             overlapping the top chrome on short viewports. */
          className="absolute bottom-3 left-[64px] z-30 w-[320px] max-h-[calc(100vh-180px)] overflow-hidden flex flex-col rounded-xl"
          style={{
            background: 'var(--popover)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(82,146,220,0.30)',
            boxShadow: '0 22px 48px -16px rgba(0,0,0,0.75), 0 0 0 1px rgba(82,146,220,0.08)',
          }}
        >
          <div className="px-3.5 py-2.5 border-b border-white/8 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-300" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-foreground tracking-tight">Engineering assistant</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Live findings from your canvas · {issues.length || 'none'}
              </div>
            </div>
            <button onClick={() => setPanelOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-auto flex-1">
            {issues.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11px] text-emerald-300/80">
                <Check className="w-4 h-4 mx-auto mb-2 text-emerald-300" />
                No issues detected. The design passes basic engineering checks.
              </div>
            ) : (
              issues
                .slice()
                .sort((a, b) => {
                  const order = { high: 0, warn: 1, info: 2 } as const;
                  return order[a.severity] - order[b.severity];
                })
                .map((iss) => (
                  <div
                    key={iss.id}
                    className="px-3.5 py-2.5 border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: sevDot(iss.severity), boxShadow: `0 0 6px ${sevDot(iss.severity)}80` }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium text-foreground tracking-tight">{iss.label}</span>
                          <span
                            className="text-[9px] uppercase tracking-[0.10em] px-1 rounded"
                            style={{ background: `${toneFor(iss.kind)}1f`, color: toneFor(iss.kind) }}
                          >
                            {iss.kind}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground/90 mt-0.5 leading-snug">{iss.detail}</div>
                        {iss.suggestion && (
                          <div className="text-[10px] text-muted-foreground mt-1.5 leading-snug border-l-2 border-sky-400/30 pl-2 italic">
                            {iss.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
          <div className="px-3.5 py-2 border-t border-white/8 text-[9.5px] text-muted-foreground leading-relaxed flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Updates as you edit the canvas. Heuristics, not legal advice.
          </div>
        </div>
      )}
    </>
  );
}

function CableTypePicker({ value, onChange }: { value: CableTypeId; onChange: (t: CableTypeId) => void }) {
  return (
    // Item 4 — bottom bar is now at bottom-3; picker stacks above it
    // at bottom-[80px] so the cable type chips don't overlap the
    // category icons.
    <div className="absolute left-1/2 -translate-x-1/2 bottom-[80px] z-20 select-none hidden md:block">
      <div className="bg-card/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)] px-1.5 py-1.5 flex items-center gap-1 max-w-[680px] overflow-x-auto">
        <span className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground px-1.5 shrink-0">Cable</span>
        {CABLE_TYPES.map((c) => {
          const active = c.id === value;
          return (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              title={`${c.label} — ${c.note} · $${c.pricePerFt.toFixed(2)}/ft`}
              className={`shrink-0 px-2 h-7 rounded-md text-[11px] transition-colors flex items-center gap-1.5 ${
                active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
              }`}
              style={active ? { boxShadow: `inset 0 0 0 1px ${c.tone}55` } : undefined}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: c.tone }} />
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PATHWAYS OVERLAY — renders every committed pathway record (cable
   bundles from Run-to-IDF and manual cable draws) so the route is
   visible on the plan. Bundles also get a label showing the count and
   destination so the user sees "10x Cat6A → IDF-01" at a glance.
   ═══════════════════════════════════════════════════════════════════════ */

function PathwaysOverlay({ onPickBundle, onPickPathway, floorId }: {
  onPickBundle?: (bundleId: string) => void;
  onPickPathway?: (pathwayId: string) => void;
  /** Canvas V2 Pass 2A.3 — only render pathways that live on the
   *  active floor. When omitted, defaults to rendering all (legacy). */
  floorId?: string;
}) {
  const pathways = useProjectStore((s) => s.pathways);
  // Group bundle paths so we collapse a 10-camera bundle into ONE label
  // even though there are 10 pathway records under the hood. Defensive
  // — pathway records can be missing `points` after migrations or
  // during partial drag-in-progress, so we filter them out cleanly.
  const items = useMemo(() => {
    const arr = (pathways ? Object.values(pathways) : []) as any[];
    const bundles: Record<string, any[]> = {};
    const standalone: any[] = [];
    for (const p of arr) {
      if (!p || !Array.isArray(p.points) || p.points.length < 2) continue;
      if (floorId && p.floorId !== floorId) continue;
      if (p.bundleId) (bundles[p.bundleId] ??= []).push(p);
      else standalone.push(p);
    }
    return { bundles, standalone };
  }, [pathways, floorId]);
  return (
    <g>
      {/* Standalone routes — cables AND standalone conduit / J-hook /
          tray placements rendered here. Each is clickable so the user
          can open the right-side PathwayDrawer. */}
      {items.standalone.map((p) => {
        const pts: { x: number; y: number }[] = p.points ?? [];
        if (pts.length < 2) return null;
        const isConduitPath = p.pathwayKind && p.pathwayKind !== 'cable';
        const stroke = isConduitPath ? '#A371F7' : '#22D3EE';
        const dash = p.pathwayKind === 'conduit' ? '6 4' : p.pathwayKind === 'tray' ? '10 3 2 3' : p.pathwayKind === 'jhook' ? '2 4' : undefined;
        const mid = pts.length >= 2 ? { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2 } : null;
        const label = isConduitPath
          ? `${p.conduitType ?? p.pathwayKind?.toUpperCase()}${p.conduitSize ? ' ' + p.conduitSize : ''}`
          : `${String(p.cableType ?? 'cat6').toUpperCase()}`;
        return (
          <g
            key={p.id}
            style={{ cursor: onPickPathway ? 'pointer' : 'default' }}
            onClick={(e) => { e.stopPropagation(); onPickPathway && onPickPathway(p.id); }}
            data-track={`pathway-${p.id}`}
            data-testid={`pathway-${p.id}`}
            data-object-kind="pathway"
          >
            {/* Hit-area: invisible thick stroke so clicks register on a
                line that's otherwise 1.6 px wide. */}
            <polyline
              points={pts.map((pt) => `${pt.x},${pt.y}`).join(' ')}
              fill="none"
              stroke="transparent"
              strokeWidth="12"
              pointerEvents="stroke"
            />
            <polyline
              points={pts.map((pt) => `${pt.x},${pt.y}`).join(' ')}
              fill="none"
              stroke={stroke}
              strokeWidth={isConduitPath ? 2.2 : 1.6}
              opacity="0.78"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={dash}
              pointerEvents="none"
            />
            {mid && isConduitPath && (
              <g transform={`translate(${mid.x}, ${mid.y - 8})`} pointerEvents="none">
                <rect x={-44} y={-9} width={88} height={18} rx={9} fill="#1A1230" fillOpacity="0.92" stroke="#A371F7" strokeWidth="0.6" />
                <text x={0} y={3} textAnchor="middle" fill="#E6E1FB" fontSize="10" fontWeight="600">{label}</text>
              </g>
            )}
          </g>
        );
      })}
      {/* Bundled cable routes — one composite line per bundle + label */}
      {Object.entries(items.bundles).map(([bundleId, group]) => {
        if (group.length === 0) return null;
        const first = group[0];
        const lastPath = group[group.length - 1];
        const cableType = String(first.cableType ?? 'cat6a').toUpperCase();
        const target = first.targetId ?? 'IDF';
        const mid = first.points && first.points.length >= 2
          ? { x: (first.points[0].x + first.points[1].x) / 2, y: (first.points[0].y + first.points[1].y) / 2 }
          : null;
        return (
          <g key={bundleId}>
            {/* Draw each underlying path with reduced opacity so the
                bundle reads as one route while still showing fan-in.
                Each individual run is clickable too, opening the
                right-side PathwayDrawer on its specific pathway. */}
            {group.map((p) => (
              p.points && p.points.length >= 2 && (
                <g
                  key={p.id}
                  style={{ cursor: onPickPathway ? 'pointer' : 'default' }}
                  onClick={(e) => { e.stopPropagation(); onPickPathway && onPickPathway(p.id); }}
                  data-testid={`pathway-${p.id}`}
                  data-track={`pathway-${p.id}`}
                  data-object-kind="pathway"
                >
                  <polyline
                    points={p.points.map((pt: any) => `${pt.x},${pt.y}`).join(' ')}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="10"
                    pointerEvents="stroke"
                  />
                  <polyline
                    points={p.points.map((pt: any) => `${pt.x},${pt.y}`).join(' ')}
                    fill="none"
                    stroke="#22D3EE"
                    strokeWidth="1.4"
                    opacity="0.55"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                </g>
              )
            ))}
            {/* Bundle label at the midpoint of the first run. Includes the
                count and destination so the route reads as engineering, not
                just a colored line. Clickable → opens the bundle inspector. */}
            {mid && (
              <g
                transform={`translate(${mid.x}, ${mid.y})`}
                style={{ cursor: onPickBundle ? 'pointer' : 'default', pointerEvents: 'auto' }}
                onClick={(e) => { e.stopPropagation(); onPickBundle && onPickBundle(bundleId); }}
                data-track={`bundle-label-${bundleId}`}
              >
                <rect x={-58} y={-9} width={116} height={18} rx={9} fill="#0B1424" fillOpacity="0.92" stroke="#22D3EE" strokeWidth="0.6" />
                <text x={0} y={3} textAnchor="middle" fill="#E6F1FB" fontSize="10" fontWeight="600">{group.length}× {cableType} → {target}</text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PATHWAY VERTEX EDITOR — per-vertex drag handles + segment-insert "+"
   affordance + Delete/Backspace removal for the SELECTED pathway only.
   Mounted inside the canvas SVG content group (so it inherits the
   `translate(pan) scale(zoom)` transform and works in canvas coords),
   AFTER the device loop (so handles paint above both pathways and
   devices). Renders nothing when no pathway is selected.
   ═══════════════════════════════════════════════════════════════════════ */

function PathwayVertexEditor({
  pathwayId, svgRef, zoom, pan, snap, pxToFt,
}: {
  pathwayId: string;
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  pan: { x: number; y: number };
  /** Honors the TopBar Snap toggle. When true, drag and insert snap to
   *  the project's canvas-wide 20 px (= 1 ft) grid — matches the wall
   *  + cable draw + click-to-arm snap behaviour used elsewhere. */
  snap: boolean;
  /** Calibrated feet-per-pixel for the active floor. Drives the live
   *  X / Y readout shown next to the dragging vertex. */
  pxToFt: number;
}) {
  const pathway = useProjectStore((s) => (s.pathways as any)[pathwayId]);
  const floors = useProjectStore((s) => s.floors);
  const updatePathway = useProjectStore((s) => s.updatePathway);
  // Hovered vertex (for the delete-key affordance + active-vertex
  // emphasis). Drag state lives in a ref because we don't need to
  // re-render the world on every pointermove — store updates already
  // cause the polyline to re-paint.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverSeg, setHoverSeg] = useState<number | null>(null);
  // Live cursor position projected onto the hovered segment. Drives the
  // "+" insert glyph so it tracks the cursor and lands exactly where
  // the user is pointing instead of snapping to the segment midpoint.
  // Coordinates are in canvas-space (pan-stripped).
  const [insertPt, setInsertPt] = useState<{ x: number; y: number } | null>(null);
  // Set during an active drag so we can paint the active vertex with
  // stronger visual weight and surface a small X / Y readout.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragRef = useRef<{ idx: number } | null>(null);

  // Always read the latest pathway from the store via the ref pattern so
  // the drag handler doesn't close over stale points. (The component
  // already re-renders on every store change, but the ref keeps the
  // pointermove math correct between renders.)
  const pathwayRef = useRef(pathway);
  useEffect(() => { pathwayRef.current = pathway; }, [pathway]);
  // Snap also lives in a ref so the pointermove handler always reads the
  // current value even if the user toggles Snap mid-drag.
  const snapRef = useRef(snap);
  useEffect(() => { snapRef.current = snap; }, [snap]);

  // Convert screen-space (client) → canvas coords. Matches the same
  // pan-aware formula `ConeHandles` and `RotationRing` use after the
  // direct-manipulation pass.
  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return null;
    return {
      x: ((clientX - r.left) - pan.x) / zoom,
      y: ((clientY - r.top)  - pan.y) / zoom,
    };
  }, [svgRef, pan.x, pan.y, zoom]);

  // 20 px = 1 ft is the project-wide canvas grid (same constant the wall
  // tool, cable draw, and click-to-arm placement use). Centralising it
  // here keeps the snap step consistent and easy to retune.
  const SNAP_PX = 20;
  const applySnap = useCallback((p: { x: number; y: number }) => (
    snapRef.current ? { x: Math.round(p.x / SNAP_PX) * SNAP_PX, y: Math.round(p.y / SNAP_PX) * SNAP_PX } : p
  ), []);

  // Project a point onto the segment a→b, clamped to the endpoints. We
  // use this for cursor-tracked insert ("+" appears at the nearest point
  // on the segment under the cursor instead of the midpoint). The clamp
  // keeps the insert glyph from ever leaving the segment if the cursor
  // strays into the hit-zone padding.
  const projectOnSegment = useCallback((p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) return { x: a.x, y: a.y };
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + dx * t, y: a.y + dy * t };
  }, []);

  // Compute the new length (ft) for a candidate points array. Used to
  // refresh `lengthFt` after a drag/insert/delete so the drawer + BOM
  // pick up the new total immediately — `pathwayLengthFt` short-circuits
  // on a stored `lengthFt > 0`, so we must overwrite it.
  const recomputeLengthFt = useCallback((pts: { x: number; y: number }[]) => {
    if (!pathway) return 0;
    const floor = floors[pathway.floorId ?? ''];
    return pathwayLengthFt({ points: pts }, floor);
  }, [floors, pathway]);

  // Vertex drag: pointerdown captures, pointermove writes new points to
  // the store, pointerup commits final lengthFt. The pointer-capture is
  // installed on the dragged handle's <g> so subsequent move/up events
  // continue to fire even if the cursor leaves the handle. When Snap is
  // active the moved point lands on the project grid.
  const onVertexDown = (idx: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch {}
    dragRef.current = { idx };
    setDragIdx(idx);
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const p = screenToCanvas(ev.clientX, ev.clientY);
      if (!p) return;
      const cur = pathwayRef.current;
      if (!cur || !Array.isArray(cur.points)) return;
      const snapped = applySnap(p);
      const next = cur.points.map((pt: any, i: number) => i === dragRef.current!.idx ? { x: snapped.x, y: snapped.y } : pt);
      updatePathway(pathwayId, { points: next, lengthFt: recomputeLengthFt(next) } as any);
    };
    const onUp = () => {
      dragRef.current = null;
      setDragIdx(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Segment-insert: the "+" follows the cursor's projection onto the
  // hovered segment; click splices a new vertex at that exact point.
  // Honors Snap so the new vertex lands on the grid when the toggle is
  // on. Falls back to the segment midpoint if the cursor hasn't
  // produced a fresh projection yet (e.g. headless test that only
  // dispatches pointerover without a follow-up move).
  const onInsertSegment = (segIdx: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const cur = pathwayRef.current;
    if (!cur || !Array.isArray(cur.points) || segIdx < 0 || segIdx >= cur.points.length - 1) return;
    const a = cur.points[segIdx];
    const b = cur.points[segIdx + 1];
    const fallbackMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // If the cursor delivered coordinates via pointermove, use the
    // projected point; otherwise fall back to the midpoint. Both paths
    // go through applySnap so the insert respects the toggle.
    const cursorCanvas = screenToCanvas(e.clientX, e.clientY);
    const raw = cursorCanvas ? projectOnSegment(cursorCanvas, a, b) : (insertPt ?? fallbackMid);
    const snapped = applySnap(raw);
    const next = [...cur.points.slice(0, segIdx + 1), snapped, ...cur.points.slice(segIdx + 1)];
    updatePathway(pathwayId, { points: next, lengthFt: recomputeLengthFt(next) } as any);
    setHoverIdx(segIdx + 1);
    setInsertPt(null);
  };

  // Track cursor → segment projection while hovering. We attach a
  // pointermove on each segment hit-zone so the "+" follows the cursor
  // smoothly. Clearing on pointerleave avoids stale projections.
  const onSegmentMove = (segIdx: number) => (e: React.PointerEvent) => {
    const cur = pathwayRef.current;
    if (!cur || !Array.isArray(cur.points) || segIdx < 0 || segIdx >= cur.points.length - 1) return;
    const p = screenToCanvas(e.clientX, e.clientY);
    if (!p) return;
    setInsertPt(projectOnSegment(p, cur.points[segIdx], cur.points[segIdx + 1]));
  };

  // Delete the currently-hovered vertex on Backspace/Delete, gated to
  // keep the pathway at ≥2 points (anything less is no longer a
  // pathway). No-op if no vertex is hovered.
  useEffect(() => {
    if (hoverIdx == null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const cur = pathwayRef.current;
      if (!cur || !Array.isArray(cur.points) || cur.points.length <= 2) return;
      e.preventDefault();
      const next = cur.points.filter((_: any, i: number) => i !== hoverIdx);
      updatePathway(pathwayId, { points: next, lengthFt: recomputeLengthFt(next) } as any);
      setHoverIdx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hoverIdx, pathwayId, updatePathway, recomputeLengthFt]);

  if (!pathway || !Array.isArray(pathway.points) || pathway.points.length < 2) return null;
  const isConduitPath = pathway.pathwayKind && pathway.pathwayKind !== 'cable';
  const handleTone = isConduitPath ? '#A371F7' : '#22D3EE';

  return (
    <g data-testid={`pathway-vertices-${pathwayId}`}>
      {/* Segment-insert "+" affordances. One per segment, only visible
          when the user hovers that segment's invisible hit-zone. The
          hit-zone is a transparent thick stroke aligned to each segment;
          the visible "+" tracks the cursor's nearest projection onto
          the segment so it lands where you click — not at a fixed
          midpoint. Falls back to the segment midpoint until the first
          pointermove delivers a projected point. */}
      {pathway.points.slice(0, -1).map((a: any, i: number) => {
        const b = pathway.points[i + 1];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const visible = hoverSeg === i;
        const liveInsert = visible && insertPt
          ? applySnap(insertPt)
          : applySnap(mid);
        return (
          <g key={`seg-${i}`}>
            {/* Hit-zone catches the hover even when the cursor isn't
                exactly on the polyline. We DON'T set cursor:copy here
                unless the segment is active so unrelated pan/select
                interactions stay clean. */}
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="transparent" strokeWidth={14}
              pointerEvents="stroke"
              onPointerEnter={() => setHoverSeg(i)}
              onPointerMove={onSegmentMove(i)}
              onPointerLeave={() => { setHoverSeg((s) => s === i ? null : s); setInsertPt(null); }}
              style={{ cursor: visible ? 'copy' : 'default' }}
            />
            {visible && (
              <g
                transform={`translate(${liveInsert.x}, ${liveInsert.y})`}
                onPointerDown={onInsertSegment(i)}
                onPointerEnter={() => setHoverSeg(i)}
                onPointerMove={onSegmentMove(i)}
                style={{ cursor: 'copy' }}
                data-testid={`pathway-segment-insert-${pathwayId}-${i}`}
              >
                <circle r={6} fill={handleTone} opacity="0.22" />
                <circle r={4} fill={handleTone} stroke="var(--canvas-background)" strokeWidth={0.9} />
                <line x1={-2.2} y1={0} x2={2.2} y2={0} stroke="var(--canvas-background)" strokeWidth="0.9" />
                <line x1={0} y1={-2.2} x2={0} y2={2.2} stroke="var(--canvas-background)" strokeWidth="0.9" />
              </g>
            )}
          </g>
        );
      })}

      {/* Vertex drag handles. Render after segment hits so a hover on
          the vertex wins over the segment hover. Small + precise, with
          a hover-bumped glow ring (the .dv-cone-handle CSS rule already
          adds this transition). The active/dragging vertex paints with
          a stronger outline and surfaces a small X / Y HUD above it. */}
      {pathway.points.map((p: any, i: number) => {
        const isHover = hoverIdx === i;
        const isActive = dragIdx === i || hoverIdx === i;
        const isDragging = dragIdx === i;
        return (
          <g
            key={`vert-${i}`}
            className="dv-cone-handle"
            onPointerDown={onVertexDown(i)}
            onPointerEnter={() => setHoverIdx(i)}
            onPointerLeave={() => setHoverIdx((c) => c === i ? null : c)}
            style={{ cursor: 'grab' }}
            data-testid={`pathway-vertex-${pathwayId}-${i}`}
          >
            <circle cx={p.x} cy={p.y} r={isActive ? 8.5 : 6} fill={handleTone} opacity={isActive ? 0.32 : 0.22} />
            <circle
              cx={p.x} cy={p.y}
              r={isActive ? 4.2 : 3.2}
              fill={handleTone}
              stroke="var(--canvas-background)"
              strokeWidth={isActive ? 1.3 : 0.9}
            />
            {isDragging && (
              <g transform={`translate(${p.x}, ${p.y - 16})`} pointerEvents="none" data-testid={`pathway-vertex-hud-${pathwayId}-${i}`}>
                <rect x={-26} y={-7} width={52} height={13} rx={2} fill="var(--panel-background)" fillOpacity="0.94" stroke={handleTone} strokeWidth="0.6" />
                <text textAnchor="middle" y={2.5} fontSize="9" fontWeight="600" fill={handleTone} fontFamily="ui-monospace, monospace">
                  {(p.x * pxToFt).toFixed(1)} · {(p.y * pxToFt).toFixed(1)} ft
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DRAWING TOOL RAIL — black vertical strip on the left of the canvas
   pane. Tools only (no devices). Always visible in Default + Field
   modes; replaced by a small "Tools" reopener in Canvas mode.
   ═══════════════════════════════════════════════════════════════════════ */

/** SelectByMenu — quick-pick chip that lets the user multi-select
 *  every camera / door / reader / IDF / device on the current floor
 *  in one click. Sits top-left of the canvas. Closes on outside-click. */
function SelectByMenu({ devices, onPick }: { devices: Device[]; onPick: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [open]);
  const cams    = devices.filter((d) => TYPE_KIND[d.type] === 'camera');
  const doors   = devices.filter((d) => (d.type as string).startsWith('inf.door') || (d.type as string).startsWith('inf.gate') || (d.type as string).startsWith('inf.storefront') || (d.type as string).startsWith('inf.doubledoor'));
  const readers = devices.filter((d) => d.type === 'acc.reader' || d.type === 'acc.keypad');
  const idfs    = devices.filter((d) => d.type === 'net.idf' || d.type === 'net.mdf' || d.type === 'inf.rack' || d.type === 'inf.mdf');
  const sel = (list: Device[], label: string) => { onPick(list.map((d) => d.id)); setOpen(false); toast.message(`Selected ${list.length} · ${label}`, { duration: 2500 }); };
  return (
    <div className="absolute z-30 top-3 left-[88px]" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        data-track="select-by-menu"
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border bg-card/90 backdrop-blur-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors ${open ? 'border-primary/40 text-primary' : 'border-border'}`}
      >
        Select
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (() => {
        const onFloor: { label: string; list: Device[]; track: string }[] = ([
          { label: 'All cameras on floor', list: cams,    track: 'select-all-cameras' },
          { label: 'All doors on floor',   list: doors,   track: 'select-all-doors' },
          { label: 'All readers on floor', list: readers, track: 'select-all-readers' },
          { label: 'All IDFs / racks',     list: idfs,    track: 'select-all-idfs' },
        ]).filter((r) => r.list.length > 0);
        const byType = Object.entries(devices.reduce<Record<string, number>>((m, d) => { m[d.type] = (m[d.type] ?? 0) + 1; return m; }, {}))
          .filter(([, n]) => n > 0)
          .slice(0, 8);
        return (
          <div className="absolute left-0 top-9 w-[260px] rounded-xl border bg-card/95 backdrop-blur-xl shadow-[var(--shadow-medium)] overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {onFloor.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.10em] text-muted-foreground">On floor</div>
                {onFloor.map((r) => (
                  <button key={r.track} onClick={() => sel(r.list, r.label.toLowerCase())} data-track={r.track} className="w-full text-left px-3 py-2 text-[12px] hover:bg-secondary/40 flex items-center justify-between">
                    <span>{r.label}</span><span className="text-muted-foreground tabular-nums">{r.list.length}</span>
                  </button>
                ))}
              </>
            )}
            {byType.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.10em] text-muted-foreground border-t border-border/60">By type</div>
                {byType.map(([t, n]) => (
                  <button
                    key={t}
                    onClick={() => sel(devices.filter((d) => d.type === t), `of type ${t}`)}
                    data-track={`select-type-${t}`}
                    className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-secondary/40 flex items-center justify-between"
                  >
                    <span className="text-foreground">{t}</span>
                    <span className="text-muted-foreground tabular-nums">{n}</span>
                  </button>
                ))}
              </>
            )}
            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.10em] text-muted-foreground border-t border-border/60">By room</div>
            <div className="px-3 py-2 text-[11px] text-muted-foreground italic">
              Room-scoped selection unavailable — no room geometry on this floor yet. Use shift-click or drag a selection box for now.
            </div>
            {onFloor.length > 0 && (
              <div className="px-3 py-2 border-t border-border/60">
                <button onClick={() => { onPick([]); setOpen(false); }} data-track="select-clear" className="text-[11px] text-muted-foreground hover:text-foreground">Clear selection</button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/** Reference-style slim black tool rail + expand-on-click side panel.
 *  Strict rule: TOOLS ONLY. No device categories. The panel shows tool
 *  name, shortcut, description, and tool-specific options. */
/** Pure label lookup used by DrawingToolRail's panel header. */
function panelLabel(panelId: string): string {
  return ({
    select:  'Select',
    pan:     'Pan',
    measure: 'Measure',
    wall:    'Draw wall',
    snap:    'Snap',
    layers:  'Layers',
    map:     'Map / Floorplan',
  } as Record<string, string>)[panelId] ?? panelId;
}

function ToolPanelHeader({ panelId, onClose }: { panelId: string; onClose: () => void }) {
  const shortcut = ({
    select: 'V', pan: 'H', measure: 'M', wall: 'W', snap: 'S',
  } as Record<string, string>)[panelId];
  const sub = ({
    select:  'Click an object to edit it. Shift-click adds to a multi-selection.',
    pan:     'Click + drag to pan. Scroll to zoom.',
    measure: 'Two clicks → distance. Esc cancels.',
    wall:    'Click vertices to draw a wall. Double-click or Enter to finish.',
    snap:    'Magnetic alignment while drawing or moving objects.',
    layers:  'Toggle engineering overlays on the canvas.',
    map:     'Bring a floorplan in: scan, upload, satellite, or sketch.',
  } as Record<string, string>)[panelId];
  return (
    <div className="flex items-start gap-2 mb-3">
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold tracking-tight">{panelLabel(panelId)}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sub}</div>}
      </div>
      {shortcut && (
        <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">{shortcut}</span>
      )}
      <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ToolPanelBody({
  panelId, snap, setSnap, layersOpen, onToggleLayers, onOpenScanBuild,
  onFit, onCenter, onActual, onSelectAll,
}: {
  panelId: string;
  snap: boolean; setSnap: (v: boolean) => void;
  layersOpen: boolean; onToggleLayers: () => void;
  onOpenScanBuild: () => void;
  onFit: () => void;
  onCenter: () => void;
  onActual: () => void;
  onSelectAll: (kind: 'cameras' | 'doors' | 'readers' | 'idfs') => void;
}) {
  const Btn = ({ children, onClick, track, primary }: { children: React.ReactNode; onClick: () => void; track: string; primary?: boolean }) => (
    <button
      onClick={onClick}
      data-track={track}
      className={`w-full text-left px-3 py-2 rounded-md text-[12px] transition-colors ${primary ? 'bg-primary text-primary-foreground hover:opacity-90 font-medium' : 'bg-secondary/30 hover:bg-secondary/60 text-foreground'}`}
    >
      {children}
    </button>
  );
  const Hint = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[10px] text-muted-foreground leading-snug px-1">{children}</div>
  );
  if (panelId === 'select') {
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground px-1">Select by</div>
        <Btn track="toolpanel-select-cams"    onClick={() => onSelectAll('cameras')}>All cameras on floor</Btn>
        <Btn track="toolpanel-select-doors"   onClick={() => onSelectAll('doors')}>All doors on floor</Btn>
        <Btn track="toolpanel-select-readers" onClick={() => onSelectAll('readers')}>All readers on floor</Btn>
        <Btn track="toolpanel-select-idfs"    onClick={() => onSelectAll('idfs')}>All IDFs / racks on floor</Btn>
        <Hint>Single-click selects · Shift-click adds · drag the empty surface for a marquee.</Hint>
      </div>
    );
  }
  if (panelId === 'pan') {
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground px-1">Viewport</div>
        <Btn track="toolpanel-pan-fit"    onClick={onFit}    primary>Fit plan to viewport</Btn>
        <Btn track="toolpanel-pan-center" onClick={onCenter}>Center plan</Btn>
        <Btn track="toolpanel-pan-actual" onClick={onActual}>Actual scale (1:1)</Btn>
        <Hint>Drag to pan · scroll to zoom · hold Space with any tool to pan.</Hint>
      </div>
    );
  }
  if (panelId === 'measure') {
    return (
      <div className="space-y-1">
        <Hint>Click two points on the plan to measure distance. Esc cancels.</Hint>
        <div className="rounded-md border border-border bg-secondary/20 p-2.5 mt-2 text-[11px]">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Scale</span><span className="text-foreground">20 px / 1 ft</span></div>
          <div className="flex items-center justify-between mt-0.5"><span className="text-muted-foreground">Units</span><span className="text-foreground">Toggle ft / m on TopBar</span></div>
        </div>
      </div>
    );
  }
  if (panelId === 'wall') {
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground px-1">Wall settings</div>
        <label className="flex items-center justify-between py-2 px-2.5 rounded-md bg-secondary/20 cursor-pointer">
          <span className="text-[12px]">Snap to grid + walls</span>
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} className="accent-primary" />
        </label>
        <Hint>Click vertices on the plan. Double-click or Enter finishes the wall. Esc cancels.</Hint>
        {/* Honesty contract per V3.1 / V3.7: wall-type / fire-rating /
            orthogonal-lock require a schema bump on Wall (currently
            { id, x1, y1, x2, y2 }). Surfacing them as toggles without
            wiring would be exactly the dead-control class we just
            killed. Sized as a DOCUMENTED chip so the operator sees
            they exist on the roadmap without an interactive affordance. */}
        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-secondary/10 text-[10px] text-muted-foreground">
          <span className="w-1 h-1 rounded-full bg-muted-foreground/60" />
          Wall type, fire-rating, and orthogonal-lock land with the wall schema bump.
        </div>
      </div>
    );
  }
  // Snap panel branch removed: the rail no longer carries a Snap tile
  // (it was dropped as a duplicate of the wall-panel snap toggle and the
  // top-bar overflow snap toggle). With no entry point, the body was
  // unreachable dead code. The single snap state is owned by the parent
  // and persists via the wall-panel checkbox + top-bar More menu.
  if (panelId === 'layers') {
    return (
      <div className="space-y-1.5">
        <Btn track="toolpanel-layers-toggle" onClick={onToggleLayers} primary>
          {layersOpen ? 'Close layers panel' : 'Open layers panel'}
        </Btn>
        <Hint>Layers panel controls FOV / coverage / labels / cables / conduit / pathways / warnings / floorplan / satellite overlays.</Hint>
      </div>
    );
  }
  if (panelId === 'map') {
    return (
      <div className="space-y-1.5">
        <Btn track="toolpanel-map-scanbuild" onClick={onOpenScanBuild} primary>Scan / Build Floorplan…</Btn>
        <Hint>One workflow with four options: scan with camera, upload a PDF/PNG, trace satellite imagery, or sketch from scratch. Calibrate scale at the end.</Hint>
      </div>
    );
  }
  return <div className="text-[11px] text-muted-foreground italic">No panel for this tool.</div>;
}

/* ═══════════════════════════════════════════════════════════════════════
   BOTTOM DEVICE BAR — horizontal category strip. Click a category to
   open a tray of placeable items. Each item starts a drag the same way
   the InsertDock products do, so the existing drag-to-place pipeline is
   reused without changes.
   ═══════════════════════════════════════════════════════════════════════ */

function TraySection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5 px-1">
        <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground">{title}</div>
        {hint && <div className="text-[10px] text-muted-foreground/80 italic ml-3 truncate">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

const TRAY_DESCRIPTION: Record<string, string> = {
  cam:      'Place CCTV and video devices on the floorplan.',
  acc:      'Place access-control hardware. Readers, strikes, and maglocks can stack onto door assemblies.',
  door:     'Place door openings — single, double, storefront, sliding, gates, and elevators.',
  cable:    'Cable, terminations, couplers, patch panels, conduit, pathways, pull boxes, and firestop.',
  conduit:  'Conduit, raceway, pathways, pull boxes, sleeves, and firestop. Pick a type to draw a route.',
  net:      'Network infrastructure — IDF, MDF, racks, switches, patch panels, NVRs.',
  power:    'Power supplies, UPS, transformers, PoE injectors, batteries.',
  intercom: 'Door and station intercoms. Link to a door from the drawer.',
  audio:    'Speakers, amplifiers, microphones for PA + BGM systems.',
  intrusion:'Intrusion sensors — glassbreak, contacts, panic buttons, vibration.',
  sensor:   'Environmental + safety sensors — motion, glass-break, smoke, temp.',
  fire:     'Fire-alarm devices — pull stations, smoke detectors, horns, strobes.',
  inf:      'Infrastructure — racks, MDFs, windows, walls.',
};

function BottomDeviceBar({
  onStartDrag, onPickTool, onPickCableType, onPickConduit, onPickPathway, tool,
}: {
  onStartDrag: (p: Product, e: React.PointerEvent) => void;
  onPickTool: (t: Tool) => void;
  onPickCableType: (id: CableTypeId) => void;
  onPickConduit: (type: 'EMT' | 'PVC' | 'FMC' | 'LFMC' | 'raceway' | 'tray', size?: string) => void;
  onPickPathway: (kind: 'tray' | 'jhook' | 'sleeve' | 'raceway' | 'duct', label: string) => void;
  tool: Tool;
}) {
  // V3.6 Part B — direct store access for the category color picker in
  // the open tray header. The picker resolves the dock cat to its
  // representative DeviceKind via TYPE_KIND on the first DEVICE-typed
  // entry in `cat.types` (skipping dock-only category placeholders).
  const categoryColors = useProjectStore((s) => s.categoryColors);
  const setCategoryColor = useProjectStore((s) => s.setCategoryColor);
  // V1 P0.6 — dock is grouped by domain. A small uppercase label sits
  // above each group inside the bar, and the order follows a real
  // survey workflow: surveillance first, then access, then detect &
  // alarm, then AV, then the cable/power/network backbone, then site
  // infrastructure (racks, MDFs, walls). A thin divider sits between
  // groups so the visual rhythm reinforces the grouping.
  type GroupId = 'surveillance' | 'access' | 'detect' | 'av' | 'backbone' | 'site';
  type Cat = {
    id: string;
    label: string;
    icon: any;
    group: GroupId;
    /** Types that the tray exposes as placeable products. Selected from
     *  PRODUCTS so we always show real, in-catalog items. */
    types?: DeviceType[];
    /** Optional canvas tool to engage instead of opening a product tray
     *  (Cabling → cable tool). */
    tool?: Tool;
  };
  const GROUPS: { id: GroupId; label: string }[] = [
    { id: 'surveillance', label: 'Surveillance' },
    { id: 'access',       label: 'Access' },
    { id: 'detect',       label: 'Detect & alarm' },
    { id: 'av',           label: 'AV' },
    { id: 'backbone',     label: 'Cable, power, network' },
    { id: 'site',         label: 'Site' },
  ];
  // SC.7.5 — dock categories. Type strings normalised against the
  // unified DeviceType union from store/types. Where the dock had a
  // shorthand identifier ('inf.door', 'av.speaker', 'fire.pull') the
  // canonical store name replaces it. Entries that reference device
  // kinds the schema does not yet model carry an `as DeviceType` cast
  // with a `// dock-only` comment so a future schema extension can
  // grep them out.
  const cats: Cat[] = [
    // Cameras — `cam.turret` is dock-only; canvas renders it as a generic camera glyph.
    { id: 'cam',       group: 'surveillance', label: 'Cameras',    icon: Video,           types: ['cam.dome','cam.bullet','cam.turret' as DeviceType /* dock-only */,'cam.ptz','cam.multisensor','cam.fisheye','cam.lpr','cam.thermal'] },

    // Doors — canvas dock uses bare 'inf.door' / 'inf.gate' as
    // category-level pickers that fall through to the specific
    // variant on click. Marked dock-only so the schema doesn't grow
    // a member that nothing else renders.
    { id: 'door',      group: 'access', label: 'Doors',      icon: DoorOpen,        types: ['inf.door' as DeviceType /* dock-only category */, 'inf.door-double' as DeviceType /* dock-only */, 'inf.door-storefront', 'inf.gate-swing'] },
    { id: 'acc',       group: 'access', label: 'Access',     icon: ScanFace,        types: ['acc.reader','acc.keypad' as DeviceType /* dock-only */, 'acc.strike','acc.maglock','acc.exit','acc.dps','acc.panic-bar','acc.controller','acc.psu'] },
    { id: 'intercom',  group: 'access', label: 'Intercom',   icon: Phone,           types: ['acc.intercom','aud.intercom'] },

    { id: 'intrusion', group: 'detect', label: 'Intrusion',  icon: ShieldAlert,     types: ['sen.glass','sen.contact','sen.panic','int.contact'] },
    // Fire / life-safety — schema uses `fls.*`; dock keeps the
    // `fire.*` ids it was created with until each one is wired to a
    // renderer. Cast through as dock-only so the audit grep is clean.
    { id: 'fire',      group: 'detect', label: 'Fire',       icon: Flame,           types: ['fls.pull-station','fls.fire-panel','fls.strobe','fire.horn' as DeviceType /* dock-only, no renderer yet */] },
    { id: 'sensor',    group: 'detect', label: 'Sensors',    icon: Thermometer,     types: ['sen.motion','sen.glass','sen.smoke','sen.temp'] },

    { id: 'audio',     group: 'av',     label: 'Audio / PA', icon: Volume2,         types: ['aud.speaker','aud.amp','aud.mic'] },

    { id: 'net',       group: 'backbone', label: 'Network',  icon: NetworkIcon,     types: ['net.switch','net.idf','net.mdf','net.ap','net.firewall'] },
    { id: 'cable',     group: 'backbone', label: 'Cabling',  icon: Cable },
    { id: 'conduit',   group: 'backbone', label: 'Conduit',  icon: PencilRuler },
    // Power — dock kept the legacy `inf.*` ids. Canonical store
    // names: `pwr.ups`, `acc.psu`. `inf.transformer` has no
    // renderer; dock-only until the schema grows a transformer.
    { id: 'power',     group: 'backbone', label: 'Power',    icon: BatteryCharging, types: ['pwr.ups','acc.psu','inf.transformer' as DeviceType /* dock-only, no renderer yet */] },

    { id: 'inf',       group: 'site',   label: 'Site infra', icon: Server,          types: ['inf.rack','inf.mdf','inf.window','inf.wall-brick'] },
  ];
  // Open a tray on mount if the URL carries `?openTray=<id>` — used by
  // the headless screenshot capture script to reach sub-states cleanly.
  const initialOpen = (() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const id = sp.get('openTray');
      if (id && cats.some((c) => c.id === id)) return id;
    } catch {}
    return null;
  })();
  const [open, setOpen] = useState<string | null>(initialOpen);
  // Sub-tab state for the Cabling + Conduit trays. The trays used to
  // render every section's grid simultaneously (~76 buttons for Cabling,
  // ~39 for Conduit). Now each tray shows ONE section at a time, picked
  // by these sub-tabs, so the user sees a focused subset (≤12 buttons).
  const [cableSub, setCableSub] = useState<'cable'|'term'|'coupler'|'rack'|'conduit'|'pathway'|'box'|'firestop'>('cable');
  const [conduitSub, setConduitSub] = useState<'conduit'|'pathway'|'box'|'firestop'>('conduit');
  // Camera tray filters. Sub type tabs (PTZ / Fisheye / Dome / Bullet /
  // Multisensor) gate the visible cameras to one form factor; the
  // remaining types (turret, thermal, lpr, body) stay reachable via
  // 'all' + the product search box on the bar.
  type CamSub = 'all' | 'ptz' | 'fisheye' | 'dome' | 'bullet' | 'multisensor';
  const [camSub, setCamSub] = useState<CamSub>('all');
  const [camMfr, setCamMfr] = useState<string | null>(null);
  type CamTech = 'all' | 'cloud' | 'on_prem' | 'hybrid';
  const [camTech, setCamTech] = useState<CamTech>('all');
  // Global product search — driven by the search input docked on the
  // bottom toolbar (right of the category browser). Matches across
  // manufacturer, model, productLine, productName, cameraType,
  // subcategory, resolution — the haystack from the catalog audit. When
  // a query is active, the tray flips into a search-results mode
  // regardless of which category is open.
  const [searchQuery, setSearchQuery] = useState('');
  // Pass B: search input collapses to a single icon by default. Click
  // expands into the textbox; outside-click / Escape collapse back and
  // clear the query so the results panel dismisses with the same
  // gesture. The actual input + floating results panel are reused
  // verbatim from the V3 catalog browsing pass — only the chrome
  // shifted from "always-on input" to "icon trigger + on-demand input".
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  // Item 3 — bottom bar adopts the left-rail visual language. Icons
  // only by default; on hover (desktop) or tap (touch) the bar
  // reveals labels + group headers + count badges. Per-category
  // counts stay derived from real placement data — never fabricated.
  const [barHover, setBarHover] = useState(false);
  const [barTapExpand, setBarTapExpand] = useState(false);
  const barCoarsePointer = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches,
    [],
  );
  const barExpanded = barCoarsePointer ? barTapExpand : barHover;
  // The Conduit sub-tab defaults to a 6-button "common sizes" set
  // (EMT 1/2 · EMT 3/4 · EMT 1 · PVC 3/4 · PVC 1 · raceway). Flip this
  // toggle to expose the full 30-cell type × size matrix.
  const [conduitShowAll, setConduitShowAll] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);
  // Dismiss the tray OR the search panel on outside-click / Escape. Both
  // panels live inside trayRef so a click outside their bounds clears
  // whichever one is currently rendering. Without this branch the
  // search panel anchored a 760×420 zone above the bar and refused to
  // leave until the user hit the X button — out of step with every
  // other floating affordance.
  const searchPanelLive = searchQuery.trim().length >= 2;
  useEffect(() => {
    if (!open && !searchPanelLive && !searchOpen && !barTapExpand) return;
    const dismiss = () => { setOpen(null); setSearchQuery(''); setSearchOpen(false); setBarTapExpand(false); };
    const onDown = (e: MouseEvent) => {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) dismiss();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [open, searchPanelLive, searchOpen, barTapExpand]);
  // Focus the input when the user clicks the search icon so they can
  // start typing immediately. Runs after the conditional render flips
  // the textbox into the DOM.
  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => { searchInputRef.current?.focus(); });
    }
  }, [searchOpen]);

  // Resolve products per category. We only show items whose DeviceType is
  // present in the PRODUCTS catalog AND has at least one product — that
  // way no tray ever exposes a dead option (per the "no waste menus" rule).
  const productsByCat = useMemo(() => {
    const m: Record<string, Product[]> = {};
    for (const c of cats) {
      if (!c.types) { m[c.id] = []; continue; }
      // Prefix match (not exact) so a category like Doors (`inf.door`) catches
      // the real product types (`inf.door-single`, `inf.door-double`, etc.)
      // that the catalog actually ships. Exact `includes` left the Doors,
      // Gates, and Storefront trays empty.
      const pool = PRODUCTS.filter((p) =>
        c.types!.some((t) => p.type === t || (p.type as string).startsWith(t + '-')),
      );
      // Deduplicate by type so each device type shows once in the tray
      // unless multiple manufacturers exist; show first 12 to keep the
      // tray scannable.
      m[c.id] = pool.slice(0, 24);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const trayCat = cats.find((c) => c.id === open) ?? null;
  const trayProducts = open ? (productsByCat[open] ?? []) : [];

  // ── Camera tray — full pool + sub-type + manufacturer + tech filters ──
  // productsByCat['cam'] is sliced to 24 for the legacy unfiltered grid;
  // the sub-tab work needs the full 60 camera SKUs so a filter never
  // shows fewer than it should. Compute it once.
  const camFullPool = useMemo(
    () => PRODUCTS.filter((p) => TYPE_KIND[p.type] === 'camera'),
    [],
  );
  // Manufacturer dropdown options — only mfrs that actually have at
  // least one camera in the catalog.
  const camMfrOptions = useMemo(
    () => Array.from(new Set(camFullPool.map((p) => p.mfr))).sort(),
    [camFullPool],
  );
  // Pool narrowed by manufacturer + tech, sub-type independent. Drives
  // both the visible grid (further filtered by the active sub tab) and
  // the live tab counts so neither has to redo the same scan twice.
  const camMfrTechPool = useMemo(() => camFullPool.filter((p) => {
    if (camMfr && p.mfr !== camMfr) return false;
    if (camTech !== 'all' && !productMatchesTechModel(p, camTech)) return false;
    return true;
  }), [camFullPool, camMfr, camTech]);
  // Sub-tab counts keyed by CamSub. Memoized once per
  // (mfr, tech) change instead of recomputed inline inside the map of
  // tab buttons (which used to scan camFullPool six times per render).
  const camSubCounts = useMemo(() => ({
    all:         camMfrTechPool.length,
    ptz:         camMfrTechPool.filter((p) => p.type === 'cam.ptz').length,
    fisheye:     camMfrTechPool.filter((p) => p.type === 'cam.fisheye').length,
    dome:        camMfrTechPool.filter((p) => p.type === 'cam.dome').length,
    bullet:      camMfrTechPool.filter((p) => p.type === 'cam.bullet').length,
    multisensor: camMfrTechPool.filter((p) => p.type === 'cam.multisensor').length,
  }), [camMfrTechPool]);
  // Filtered cameras driving the cam tray grid.
  const camFiltered = useMemo(() => {
    const subType = (() => {
      switch (camSub) {
        case 'all':         return null;
        case 'ptz':         return 'cam.ptz';
        case 'fisheye':     return 'cam.fisheye';
        case 'dome':        return 'cam.dome';
        case 'bullet':      return 'cam.bullet';
        case 'multisensor': return 'cam.multisensor';
      }
    })();
    return subType ? camMfrTechPool.filter((p) => p.type === subType) : camMfrTechPool;
  }, [camMfrTechPool, camSub]);

  // ── Product search — global, matches across the audit haystack:
  //   manufacturer, model, productLine, productName, cameraType,
  //   subcategory, resolution. Hooked to the search box on the bar.
  const trimmedQuery = searchQuery.trim();
  const searchActive = trimmedQuery.length >= 2;
  const searchResults = useMemo(() => {
    if (!searchActive) return [];
    const q = trimmedQuery.toLowerCase();
    return PRODUCTS.filter((p) => {
      // Haystack: every field a surveyor might type. `p.sub` is the
      // pre-built subtitle the catalog adapter derives from notes +
      // resolution + cameraType, so feature keywords like "outdoor",
      // "NDAA", "varifocal" still match even when they're not in the
      // strict tagged fields.
      const hay = [
        p.mfr, p.model, p.productLine ?? '', p.productName ?? '',
        p.cameraType ?? '', p.subcategory ?? '', p.resolution ?? '',
        p.sub ?? '',
      ].join(' ').toLowerCase();
      return hay.includes(q);
    }).slice(0, 60);
  }, [searchActive, trimmedQuery]);

  // V1 P0.5 — count badges. The dock subscribes directly to devices +
  // pathways for the active floor so the parent's prop surface stays
  // clean and every store change flows in without extra plumbing.
  // Canvas V2 Pass 2A.4 — now reads the sticky currentFloorIdByProject
  // so the count badges match the floor the operator is actually
  // looking at, not the project's first floor.
  const { projectId: routeProjectId = 'p1' } = useParams();
  const projectIdForCounts = routeProjectId;
  const stickyForCounts = useProjectStore((s) => s.currentFloorIdByProject[projectIdForCounts]);
  const fallbackForCounts = useProjectStore((s) => storeSelectors.firstFloorOfProject(s, projectIdForCounts)?.id ?? '');
  const currentFloorIdForCounts = stickyForCounts || fallbackForCounts;
  const storeDevicesForCounts = useProjectStore((s) => s.devices);
  const storePathwaysForCounts = useProjectStore((s) => s.pathways);
  const floorDevices = useMemo(
    () => Object.values(storeDevicesForCounts).filter(
      (d) => d.projectId === projectIdForCounts && (currentFloorIdForCounts === '' || d.floorId === currentFloorIdForCounts),
    ),
    [storeDevicesForCounts, projectIdForCounts, currentFloorIdForCounts],
  );
  const floorPathways = useMemo(
    () => Object.values(storePathwaysForCounts).filter(
      (p) => p.projectId === projectIdForCounts && (currentFloorIdForCounts === '' || p.floorId === currentFloorIdForCounts),
    ),
    [storePathwaysForCounts, projectIdForCounts, currentFloorIdForCounts],
  );
  const countByCat = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of cats) {
      if (c.id === 'cable') {
        // Cable runs = pathways that aren't conduit infrastructure.
        out[c.id] = floorPathways.filter((p) => p.type !== 'conduit').length;
        continue;
      }
      if (c.id === 'conduit') {
        out[c.id] = floorPathways.filter((p) => p.type === 'conduit').length;
        continue;
      }
      if (!c.types) { out[c.id] = 0; continue; }
      out[c.id] = floorDevices.filter((d) =>
        c.types!.some((t) => d.type === t || (d.type as string).startsWith(t + '-')),
      ).length;
    }
    return out;
    // cats is a stable literal; depending on it would force re-eval every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorDevices, floorPathways]);

  return (
    <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 bottom-3 z-30 justify-center" ref={trayRef} data-canvas-chrome="tray">
      {/* Global product search results panel — wins over the category
          tray when a query is active so the operator always sees ONE
          source of truth above the bar. Same chrome as the tray for
          visual continuity. */}
      {searchActive && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[760px] max-w-[92vw] rounded-2xl border bg-card/95 backdrop-blur-xl shadow-[0_22px_48px_-16px_rgba(0,0,0,0.55)] overflow-hidden z-30"
          style={{ borderColor: 'var(--border)' }}
          data-testid="bottombar-search-panel"
        >
          <div className="px-4 pt-3 pb-2.5 border-b border-border flex items-center gap-3">
            <Search className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold tracking-tight text-foreground truncate">
                Search results for "{trimmedQuery}"
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {searchResults.length === 0
                  ? 'No catalog matches. Try a manufacturer, model number, or form factor.'
                  : `${searchResults.length} product${searchResults.length === 1 ? '' : 's'} matched across manufacturer, model, line, name, form factor, subcategory, resolution.`}
              </div>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              title="Clear search"
              data-testid="bottombar-search-clear"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="p-3 max-h-[420px] overflow-auto">
              <div className="grid grid-cols-4 gap-2">
                {searchResults.map((p) => {
                  const tone = KIND_TONE[TYPE_KIND[p.type]] ?? 'var(--primary)';
                  return (
                    <button
                      key={p.id}
                      draggable
                      onDragStart={(e) => { beginProductDrag(p.id, e); setSearchQuery(''); setOpen(null); }}
                      onPointerDown={(e) => { onStartDrag(p, e); setSearchQuery(''); setOpen(null); }}
                      data-track={`bottombar-search-${p.id}`}
                      className="group text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-[var(--shadow-low)] hover:-translate-y-[1px] transition-all p-3 flex flex-col gap-2"
                      style={{ transitionDuration: 'var(--motion-fast)' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: `${tone}14`, color: tone, boxShadow: `inset 0 0 0 1px ${tone}55` }}>
                          <DeviceGlyph type={p.type} size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium tracking-tight truncate text-foreground">{p.model}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{p.mfr}</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{p.sub ?? '—'}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Tray (renders above the bar when a category is open AND the
          search panel isn't already active) */}
      {!searchActive && open && trayCat && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[760px] max-w-[92vw] rounded-2xl border bg-card/95 backdrop-blur-xl shadow-[0_22px_48px_-16px_rgba(0,0,0,0.55)] overflow-hidden z-30"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="px-4 pt-3 pb-2.5 border-b border-border flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/12 text-primary shrink-0">
              <trayCat.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold tracking-tight text-foreground">{trayCat.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{TRAY_DESCRIPTION[trayCat.id] ?? `Place ${trayCat.label.toLowerCase()} on the floorplan.`}</div>
            </div>
            {/* V3.6 Part B category picker — resolve this tray's
                representative DeviceKind from its first real device
                type, then bind the swatch to setCategoryColor. Tool
                categories (cable / conduit / pathway) have no kind
                so they get no picker. */}
            {(() => {
              const firstType = (trayCat.types ?? []).find((t) => !!TYPE_KIND[t as DeviceType]) as DeviceType | undefined;
              if (!firstType) return null;
              const kind = TYPE_KIND[firstType];
              const resolved = categoryColors?.[kind] ?? KIND_TONE[kind];
              return (
                <div className="shrink-0 flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground">Color</span>
                  <ColorPicker
                    currentColor={resolved}
                    onPick={(hex) => setCategoryColor(kind, hex || null)}
                    title={`${trayCat.label} color`}
                    size={18}
                    align="right"
                  />
                </div>
              );
            })()}
            <button onClick={() => setOpen(null)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40">
              <X className="w-4 h-4" />
            </button>
          </div>
          {trayCat.id === 'cable' ? (
            <div className="p-3 max-h-[360px] overflow-auto space-y-3">
              {/* Sub-tabbed layout. The tray used to render all 8 sections
                  expanded at once (~76 buttons visible). It now shows ONE
                  sub-tab's grid at a time so the user faces ≤12 buttons. */}
              {(() => {
                const fake = (id: string, label: string, note: string): Product => ({
                  id, type: 'net.switch' as DeviceType, mfr: 'Cable', model: label, sub: note, recommended: false,
                } as any);
                const CABLE_SUBS: { id: typeof cableSub; label: string }[] = [
                  { id: 'cable',    label: 'Cable' },
                  { id: 'term',     label: 'Terminations' },
                  { id: 'coupler',  label: 'Couplers' },
                  { id: 'rack',     label: 'Patch / Rack' },
                  { id: 'conduit',  label: 'Conduit' },
                  { id: 'pathway',  label: 'Pathways' },
                  { id: 'box',      label: 'Pull / J-box' },
                  { id: 'firestop', label: 'Firestop' },
                ];
                return (
                  <>
                    <div
                      className="flex flex-wrap items-center gap-1 border-b border-border pb-2"
                      data-testid="cable-sub-tabs"
                    >
                      {CABLE_SUBS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setCableSub(s.id)}
                          data-track={`bottombar-cable-sub-${s.id}`}
                          className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                            cableSub === s.id
                              ? 'border-primary/40 bg-primary/12 text-primary'
                              : 'border-border text-muted-foreground hover:text-foreground hover:border-border-strong'
                          }`}
                        >{s.label}</button>
                      ))}
                    </div>
                    {cableSub === 'cable' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {(CABLE_TYPES as any[]).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { onPickCableType(c.id); setOpen(null); }}
                            data-track={`bottombar-cable-${c.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{c.label}</div>
                            <div className="text-[10px] text-muted-foreground">Data cable · per foot</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cableSub === 'term' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'jack',         label: 'RJ45 keystone',  pid: 'cabacc-jack-rj45' },
                          { id: 'jack-shld',    label: 'Shielded jack',  pid: 'cabacc-jack-shielded' },
                          { id: 'jack-outdoor', label: 'Outdoor jack',   pid: 'cabacc-jack-outdoor' },
                          { id: 'wallplate',    label: 'Wall plate',     pid: 'cabacc-wallplate' },
                          { id: 'surfmount',    label: 'Surface mount',  pid: 'cabacc-surfmount' },
                          { id: 'terminal',     label: 'Terminal block', pid: 'cabacc-terminal' },
                          { id: 'biscuit',      label: 'Biscuit jack',   pid: 'cabacc-biscuit' },
                          { id: 'patchcord',    label: 'Patch cord',     pid: 'cabacc-patchcord-7' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Termination · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Termination · each</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cableSub === 'coupler' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'coupler-rj45', label: 'RJ45 coupler',  pid: 'cabacc-coupler-rj45' },
                          { id: 'coupler-wp',   label: 'Weatherproof',  pid: 'cabacc-coupler-wp' },
                          { id: 'coupler-lc',   label: 'LC coupler',    pid: 'cabacc-coupler-lc' },
                          { id: 'coupler-sc',   label: 'SC coupler',    pid: 'cabacc-coupler-sc' },
                          { id: 'coupler-coax', label: 'Coax coupler',  pid: 'cabacc-coupler-coax' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Coupler · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Coupler · each</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cableSub === 'rack' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'pp24',        label: '24-port PP',         pid: 'cabacc-pp-24' },
                          { id: 'pp48',        label: '48-port PP',         pid: 'cabacc-pp-48' },
                          { id: 'pp-fiber',    label: 'Fiber patch panel',  pid: 'cabacc-pp-fiber' },
                          { id: 'splice',      label: 'Splice tray',        pid: 'cabacc-splice' },
                          { id: 'mgr',         label: 'Cable manager',      pid: 'cabacc-mgr' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Rack / IDF · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Rack / IDF · each</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cableSub === 'conduit' && (
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1.5 px-1">Pick a conduit type + trade size to arm the Conduit draw tool.</div>
                        <div className="grid grid-cols-6 gap-1">
                          {(['EMT','PVC','FMC','LFMC','raceway'] as const).map((t) => (
                            ['1/2"','3/4"','1"','1-1/4"','1-1/2"','2"'].map((sz) => (
                              <button
                                key={`${t}-${sz}`}
                                onClick={() => onPickConduit(t, sz)}
                                data-track={`bottombar-conduit-${t}-${sz.replace(/\W/g,'')}`}
                                className="text-left px-2 py-1.5 rounded border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors text-[10px]"
                              >
                                <div className="font-medium">{t} {sz}</div>
                                <div className="text-[9.5px] text-muted-foreground">Conduit · per ft</div>
                              </button>
                            ))
                          ))}
                        </div>
                      </div>
                    )}
                    {cableSub === 'pathway' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { kind: 'tray' as const,    label: 'Cable tray' },
                          { kind: 'jhook' as const,   label: 'J-hooks' },
                          { kind: 'raceway' as const, label: 'Surface raceway' },
                          { kind: 'duct' as const,    label: 'Underground duct' },
                          { kind: 'sleeve' as const,  label: 'Wall sleeve' },
                        ]).map((p) => (
                          <button
                            key={p.kind}
                            onClick={() => onPickPathway(p.kind, p.label)}
                            data-track={`bottombar-pathway-${p.kind}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{p.label}</div>
                            <div className="text-[10px] text-muted-foreground">Pathway · per ft</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cableSub === 'box' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'pullbox', label: 'Pull box',     pid: 'cabacc-pullbox' },
                          { id: 'jbox',    label: 'Junction box', pid: 'cabacc-jbox' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Conduit accessory · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Conduit accessory · each</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cableSub === 'firestop' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'firestop', label: 'Firestop',    pid: 'cabacc-firestop' },
                          { id: 'sleeve',   label: 'Wall sleeve', pid: 'cabacc-sleeve' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Penetration · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Penetration · each</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : trayCat.id === 'conduit' ? (
            <div className="p-3 max-h-[360px] overflow-auto space-y-3">
              {(() => {
                const fake = (id: string, label: string, note: string): Product => ({
                  id, type: 'net.switch' as DeviceType, mfr: 'Conduit', model: label, sub: note, recommended: false,
                } as any);
                const CONDUIT_SUBS: { id: typeof conduitSub; label: string }[] = [
                  { id: 'conduit',  label: 'Conduit' },
                  { id: 'pathway',  label: 'Pathways' },
                  { id: 'box',      label: 'Pull / J-box' },
                  { id: 'firestop', label: 'Sleeves / firestop' },
                ];
                return (
                  <>
                    <div
                      className="flex flex-wrap items-center gap-1 border-b border-border pb-2"
                      data-testid="conduit-sub-tabs"
                    >
                      {CONDUIT_SUBS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setConduitSub(s.id)}
                          data-track={`bottombar-conduit-sub-${s.id}`}
                          className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                            conduitSub === s.id
                              ? 'border-primary/40 bg-primary/12 text-primary'
                              : 'border-border text-muted-foreground hover:text-foreground hover:border-border-strong'
                          }`}
                        >{s.label}</button>
                      ))}
                    </div>
                    {conduitSub === 'conduit' && (() => {
                      // Curated short list — the six options that cover ~90%
                      // of low-voltage runs. Surveyors reach for these first.
                      const COMMON: Array<{ type: 'EMT' | 'PVC' | 'FMC' | 'LFMC' | 'raceway'; size: string; label: string }> = [
                        { type: 'EMT', size: '1/2"', label: 'EMT 1/2"' },
                        { type: 'EMT', size: '3/4"', label: 'EMT 3/4"' },
                        { type: 'EMT', size: '1"',   label: 'EMT 1"' },
                        { type: 'PVC', size: '3/4"', label: 'PVC 3/4"' },
                        { type: 'PVC', size: '1"',   label: 'PVC 1"' },
                        { type: 'raceway', size: '',  label: 'Raceway' },
                      ];
                      return (
                        <>
                          {!conduitShowAll && (
                            <div className="grid grid-cols-3 gap-1.5" data-testid="conduit-common-grid">
                              {COMMON.map((c) => (
                                <button
                                  key={`${c.type}-${c.size}`}
                                  onClick={() => { onPickConduit(c.type, c.size || undefined); setOpen(null); }}
                                  data-track={`bottombar-conduit-${c.type}-${c.size.replace(/\W/g, '') || 'default'}`}
                                  className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                                >
                                  <div className="text-[11px] font-medium tracking-tight">{c.label}</div>
                                  <div className="text-[10px] text-muted-foreground">Per ft</div>
                                </button>
                              ))}
                            </div>
                          )}
                          {conduitShowAll && (
                            <div className="grid grid-cols-6 gap-1" data-testid="conduit-full-grid">
                              {(['EMT','PVC','FMC','LFMC','raceway'] as const).flatMap((t) =>
                                ['1/2"','3/4"','1"','1-1/4"','1-1/2"','2"'].map((sz) => (
                                  <button
                                    key={`${t}-${sz}`}
                                    onClick={() => { onPickConduit(t, sz); setOpen(null); }}
                                    data-track={`bottombar-conduit-${t}-${sz.replace(/\W/g, '')}`}
                                    className="text-left px-2 py-1.5 rounded border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors text-[10px]"
                                  >
                                    <div className="font-medium tracking-tight text-foreground">{t} {sz}</div>
                                    <div className="text-[9.5px] text-muted-foreground">Per ft</div>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => setConduitShowAll((v) => !v)}
                            data-testid="conduit-show-all-toggle"
                            data-track="bottombar-conduit-show-all"
                            className="mt-2 text-[10px] uppercase tracking-[0.10em] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
                          >
                            {conduitShowAll ? 'Show common sizes' : 'Show all sizes (EMT · PVC · FMC · LFMC · raceway × 6)'}
                          </button>
                        </>
                      );
                    })()}
                    {conduitSub === 'pathway' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { kind: 'tray' as const,    label: 'Cable tray' },
                          { kind: 'jhook' as const,   label: 'J-hooks' },
                          { kind: 'raceway' as const, label: 'Surface raceway' },
                          { kind: 'duct' as const,    label: 'Underground duct' },
                          { kind: 'sleeve' as const,  label: 'Wall sleeve' },
                        ]).map((p) => (
                          <button
                            key={p.kind}
                            onClick={() => { onPickPathway(p.kind, p.label); setOpen(null); }}
                            data-track={`bottombar-pathway-${p.kind}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{p.label}</div>
                            <div className="text-[10px] text-muted-foreground">Pathway · per ft</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {conduitSub === 'box' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'pullbox', label: 'Pull box',     pid: 'cabacc-pullbox' },
                          { id: 'jbox',    label: 'Junction box', pid: 'cabacc-jbox' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Conduit accessory · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Each</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {conduitSub === 'firestop' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'firestop', label: 'Firestop',    pid: 'cabacc-firestop' },
                          { id: 'sleeve',   label: 'Wall sleeve', pid: 'cabacc-sleeve' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Penetration · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Each</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : trayCat.id === 'cam' ? (
            // ── Camera tray (V3 catalog browsing pass) ──────────────────
            // Sub-type tabs filter to a single form factor (PTZ, Fisheye,
            // Dome, Bullet, Multisensor). Above the tabs sit two
            // dropdowns: manufacturer (any catalog mfr that ships a
            // camera) and tech stack (Cloud / On-prem / Hybrid via
            // techModels.includes — array semantics). Tabs and filters
            // compose; the grid below shows the intersection. The other
            // camera types (turret, thermal, lpr, body) stay reachable
            // through the 'All' tab and the global product search on the
            // bar — they intentionally don't get their own tab.
            <div className="p-3 max-h-[420px] overflow-auto space-y-3">
              {/* Filters row */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="uppercase tracking-[0.10em]">Manufacturer</span>
                </div>
                <select
                  value={camMfr ?? ''}
                  onChange={(e) => setCamMfr(e.target.value || null)}
                  data-testid="cam-tray-mfr"
                  className="text-[11px] px-2 h-7 rounded-md border border-border bg-card focus:outline-none focus:border-primary/40"
                >
                  <option value="">All</option>
                  {camMfrOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div className="ml-3 flex items-stretch border border-border rounded-md overflow-hidden">
                  {([
                    { id: 'all'     as const, label: 'All stacks' },
                    { id: 'cloud'   as const, label: 'Cloud' },
                    { id: 'on_prem' as const, label: 'On-prem' },
                    { id: 'hybrid'  as const, label: 'Hybrid' },
                  ]).map((m) => {
                    const active = camTech === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setCamTech(m.id)}
                        data-testid={`cam-tray-tech-${m.id}`}
                        className={`text-[10px] px-2 h-7 transition-colors ${active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                {(camMfr || camTech !== 'all' || camSub !== 'all') && (
                  <button
                    onClick={() => { setCamMfr(null); setCamTech('all'); setCamSub('all'); }}
                    data-testid="cam-tray-reset"
                    className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2"
                  >
                    Clear
                  </button>
                )}
              </div>
              {/* Sub type tabs — now icon buttons that REUSE the existing
                  DeviceGlyph art (no new icons drawn). Each tile shows
                  the device glyph + the live per-type count. The 'All'
                  tile uses the bottom-bar Cameras icon (Video lucide
                  glyph) since there's no DeviceType for "all cameras".
                  Note on the Dome tab: the catalog tags some turret
                  cameras with subcategory + cameraType 'turret' but
                  routes them through deviceType 'cam.dome' (one
                  renderer). Selecting Dome therefore shows both true
                  domes and turrets — search "turret" to pinpoint them. */}
              <div
                className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2"
                data-testid="cam-sub-tabs"
              >
                {([
                  { id: 'all'         as CamSub, label: 'All',          glyphType: null as DeviceType | null, lucide: Video },
                  { id: 'ptz'         as CamSub, label: 'PTZ',          glyphType: 'cam.ptz'         as DeviceType, lucide: null },
                  { id: 'fisheye'     as CamSub, label: 'Fisheye',      glyphType: 'cam.fisheye'     as DeviceType, lucide: null },
                  { id: 'dome'        as CamSub, label: 'Dome · Turret', glyphType: 'cam.dome'        as DeviceType, lucide: null },
                  { id: 'bullet'      as CamSub, label: 'Bullet',       glyphType: 'cam.bullet'      as DeviceType, lucide: null },
                  { id: 'multisensor' as CamSub, label: 'Multisensor',  glyphType: 'cam.multisensor' as DeviceType, lucide: null },
                ]).map((s) => {
                  const active = camSub === s.id;
                  const count = camSubCounts[s.id];
                  const LucideIcon = s.lucide;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setCamSub(s.id)}
                      data-testid={`cam-sub-${s.id}`}
                      title={`${s.label} · ${count}`}
                      className={`relative inline-flex flex-col items-center justify-center gap-0.5 w-[58px] h-[58px] rounded-lg border transition-colors ${
                        active
                          ? 'border-primary/40 bg-primary/12 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground hover:border-border-strong hover:bg-secondary/30'
                      }`}
                    >
                      {s.glyphType ? (
                        <DeviceGlyph type={s.glyphType} size={20} />
                      ) : LucideIcon ? (
                        <LucideIcon className="w-[20px] h-[20px]" strokeWidth={1.7} />
                      ) : null}
                      <span className="text-[9px] tracking-tight leading-none">{s.label.split(' · ')[0]}</span>
                      <span
                        className={`absolute top-0.5 right-1 text-[9px] tabular-nums leading-none ${
                          active ? 'text-primary/70' : 'text-muted-foreground/60'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              {camFiltered.length === 0 ? (
                <div className="px-5 py-8 text-center text-[12px] text-muted-foreground">
                  No cameras match those filters. Clear them, or search the full catalog from the bar below.
                </div>
              ) : (
                <>
                  <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground px-1">
                    {camFiltered.length} camera{camFiltered.length === 1 ? '' : 's'}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {camFiltered.map((p) => {
                      const tone = KIND_TONE[TYPE_KIND[p.type]] ?? 'var(--primary)';
                      return (
                        <button
                          key={p.id}
                          draggable
                          onDragStart={(e) => { beginProductDrag(p.id, e); setOpen(null); }}
                          onPointerDown={(e) => { onStartDrag(p, e); setOpen(null); }}
                          data-track={`bottombar-cam-${p.id}`}
                          className="group text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-[var(--shadow-low)] hover:-translate-y-[1px] transition-all p-3 flex flex-col gap-2"
                          style={{ transitionDuration: 'var(--motion-fast)' }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: `${tone}14`, color: tone, boxShadow: `inset 0 0 0 1px ${tone}55` }}>
                              <DeviceGlyph type={p.type} size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-medium tracking-tight truncate text-foreground">{p.model}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{p.mfr}</div>
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground line-clamp-2">{p.sub ?? '—'}</div>
                          <div className="flex items-center justify-between text-[10px]">
                            {(p as any).recommended ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-500">Recommended</span>
                            ) : <span />}
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <GripVertical className="w-3 h-3 opacity-60" />
                              Drag or click to place
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : trayProducts.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12px] text-muted-foreground">
              No catalog items in this category yet.
            </div>
          ) : (
            // Default product-grid tray for acc / door / net / power / intercom / etc.
            // (Cameras get their own branch above with sub type tabs + filters.)
            // Cards carry an icon, manufacturer + model, and a per-card hint line.
            <div className="p-3 max-h-[360px] overflow-auto">
              <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1.5 px-1">{trayProducts.length} item{trayProducts.length === 1 ? '' : 's'}</div>
              <div className="grid grid-cols-4 gap-2">
                {trayProducts.map((p) => {
                  const tone = KIND_TONE[TYPE_KIND[p.type]] ?? 'var(--primary)';
                  return (
                    <button
                      key={p.id}
                      draggable
                      onDragStart={(e) => { beginProductDrag(p.id, e); setOpen(null); }}
                      onPointerDown={(e) => { onStartDrag(p, e); setOpen(null); }}
                      data-track={`bottombar-${trayCat.id}-${p.id}`}
                      className="group text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-[var(--shadow-low)] hover:-translate-y-[1px] transition-all p-3 flex flex-col gap-2"
                      style={{ transitionDuration: 'var(--motion-fast)' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: `${tone}14`, color: tone, boxShadow: `inset 0 0 0 1px ${tone}55` }}>
                          <DeviceGlyph type={p.type} size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium tracking-tight truncate text-foreground">{p.model}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{p.mfr}</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{p.sub ?? p.notes ?? '—'}</div>
                      <div className="flex items-center justify-between text-[10px]">
                        {(p as any).recommended ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-500">Recommended</span>
                        ) : <span />}
                        {/* V3.8 — explicit drag affordance. The cursor-grab
                            on the button already signals it; the icon makes
                            the affordance read at a glance without growing
                            the card height. */}
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <GripVertical className="w-3 h-3 opacity-60" />
                          Drag or click to place
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* The bar itself — Item 3 adopts the left-rail visual language.
          Icons-only by default with a compact ~44 px tile per category.
          On hover (desktop) or tap (touch) the bar reveals the per-
          category label, the per-group header, and the count badge
          on any category that has placed devices. Counts always read
          from countByCat (real placements) — no fabricated dots. */}
      <div
        onMouseEnter={() => !barCoarsePointer && setBarHover(true)}
        onMouseLeave={() => !barCoarsePointer && setBarHover(false)}
        onTouchStart={() => barCoarsePointer && setBarTapExpand(true)}
        data-bar-expanded={barExpanded ? 'true' : undefined}
        className="flex items-center rounded-2xl border backdrop-blur-md shadow-[0_18px_36px_-18px_rgba(0,0,0,0.65)]"
        style={{
          background: 'var(--canvas-rail)',
          borderColor: 'var(--canvas-rail-border)',
          // Item 1 — chrome matches the left tool rail exactly:
          // rounded-2xl, canvas-rail background, canvas-rail-border,
          // backdrop blur, same shadow strength. The bar floats over
          // the canvas, the plan extends beneath, no docked white
          // band behind it. Hover transition keeps the single
          // motion-standard / ease-out token from the prior pass.
          transitionProperty: 'background-color, border-color',
          transitionDuration: 'var(--motion-standard)',
          transitionTimingFunction: 'var(--ease-out)',
        }}
      >
        {GROUPS.map((g, gi) => {
          const groupCats = cats.filter((c) => c.group === g.id);
          if (groupCats.length === 0) return null;
          return (
            <div key={g.id} className="flex items-stretch">
              {gi > 0 && <span aria-hidden className="self-stretch w-px bg-white/10 my-1.5" />}
              <div className="flex flex-col justify-center">
                {/* Group header — always rendered to keep the bar's
                    geometry settled. Visible only when expanded via
                    opacity + max-height transitions tied to the single
                    --motion-standard / --ease-out pair. */}
                <div
                  className="px-2 text-[9px] uppercase tracking-[0.10em] font-medium text-white/45 whitespace-nowrap overflow-hidden"
                  style={{
                    maxHeight: barExpanded ? 14 : 0,
                    paddingTop: barExpanded ? 4 : 0,
                    opacity: barExpanded ? 1 : 0,
                    transitionProperty: 'max-height, padding-top, opacity',
                    transitionDuration: 'var(--motion-standard)',
                    transitionTimingFunction: 'var(--ease-out)',
                  }}
                >
                  {g.label}
                </div>
                <div className="flex items-center">
                  {groupCats.map((c) => {
                    const Icon = c.icon;
                    const isToolCat = !!c.tool;
                    const active = isToolCat ? tool === c.tool : open === c.id;
                    const count = productsByCat[c.id]?.length ?? 0;
                    const isConduitCat = c.id === 'conduit';
                    const isCableCat   = c.id === 'cable';
                    const dead = !isToolCat && !isConduitCat && !isCableCat && count === 0;
                    if (dead) return null;
                    const placedCount = countByCat[c.id] ?? 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          if (searchQuery) setSearchQuery('');
                          if (isToolCat && c.tool) { onPickTool(c.tool); setOpen(null); return; }
                          setOpen(open === c.id ? null : c.id);
                        }}
                        title={`${c.label}${placedCount > 0 ? ` · ${placedCount} placed` : ''}`}
                        data-track={`bottombar-cat-${c.id}`}
                        className={`group relative flex flex-col items-center justify-center w-[56px] pt-1.5 pb-2 ${active ? 'text-white' : 'text-white/65 hover:text-white'}`}
                        style={{
                          transitionProperty: 'color',
                          transitionDuration: 'var(--motion-standard)',
                          transitionTimingFunction: 'var(--ease-out)',
                        }}
                      >
                        <span className="absolute inset-x-1.5 top-1 bottom-1.5 rounded-md -z-10"
                          style={{
                            background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                            transitionProperty: 'background-color',
                            transitionDuration: 'var(--motion-standard)',
                            transitionTimingFunction: 'var(--ease-out)',
                          }}
                        />
                        <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
                        {/* Label — always in DOM at fixed width; opacity +
                            max-height drive visibility so the bar grows
                            and shrinks smoothly with no layout fights. */}
                        <span
                          className="text-[10px] tracking-tight font-medium whitespace-nowrap overflow-hidden"
                          style={{
                            maxHeight: barExpanded ? 14 : 0,
                            opacity: barExpanded ? 1 : 0,
                            marginTop: barExpanded ? 2 : 0,
                            transitionProperty: 'max-height, opacity, margin-top',
                            transitionDuration: 'var(--motion-standard)',
                            transitionTimingFunction: 'var(--ease-out)',
                          }}
                        >{c.label}</span>
                        {placedCount > 0 && (
                          <span
                            className={`absolute top-0.5 right-1 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] leading-[15px] text-center font-medium tabular-nums ${
                              active
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-white/15 text-white border border-white/15'
                            }`}
                          >
                            {placedCount > 99 ? '99+' : placedCount}
                          </span>
                        )}
                        <span
                          className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full transition-opacity"
                          style={{ background: 'var(--primary)', opacity: active ? 1 : 0 }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
        {/* Product search — Pass B collapses the input behind a single
            icon by default to keep the bar calm. Clicking the icon
            expands to the textbox; outside-click and Escape collapse
            back and clear the query. Haystack stays the same
            (manufacturer, model, productLine, productName, cameraType,
            subcategory, resolution, sub). The floating results panel
            above the bar is unchanged. */}
        <span aria-hidden className="self-stretch w-px bg-white/10 my-1.5" />
        <div className="flex flex-col justify-center">
          <div
            className="px-2 text-[9px] uppercase tracking-[0.10em] font-medium text-white/45 whitespace-nowrap overflow-hidden"
            style={{
              maxHeight: barExpanded ? 14 : 0,
              paddingTop: barExpanded ? 4 : 0,
              opacity: barExpanded ? 1 : 0,
              transitionProperty: 'max-height, padding-top, opacity',
              transitionDuration: 'var(--motion-standard)',
              transitionTimingFunction: 'var(--ease-out)',
            }}
          >
            Search
          </div>
          <div className="flex items-center px-2 py-1.5">
            {!searchOpen ? (
              <button
                onClick={() => setSearchOpen(true)}
                title="Search products"
                aria-label="Search products"
                data-testid="bottombar-search-icon"
                className={`w-[34px] h-[34px] flex items-center justify-center rounded-md border transition-colors ${
                  searchQuery
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-white/10 text-white/65 hover:text-white hover:bg-white/8'
                }`}
              >
                <Search className="w-4 h-4" />
              </button>
            ) : (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/55" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products"
                  data-testid="bottombar-search-input"
                  aria-label="Search products"
                  className="w-[200px] h-[34px] pl-7 pr-7 text-[12px] rounded-md border border-white/10 bg-white/5 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-white/40"
                />
                <button
                  onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-white/65 hover:text-white"
                  title="Collapse search"
                  aria-label="Collapse search"
                  data-testid="bottombar-search-collapse"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ReportKind union — consumed by ReportExportRow + drawReport + the
// BOM page renderer. Sits inline because those callers live in this
// file. Will move when the report-renderer slice extracts together.
type ReportKind =
  | 'engineering' | 'customer' | 'camera-schedule' | 'door-schedule'
  | 'cable-schedule' | 'conduit-schedule' | 'bom' | 'compliance' | 'commissioning';

function ReportExportRow({
  icon: Icon, label, sub, tone, kind, devices, projectId, pxToFt,
}: { icon: any; label: string; sub: string; tone: string; kind: ReportKind; devices: Device[]; projectId: string; pxToFt: number }) {
  const [busy, setBusy] = useState(false);
  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      drawReport(doc, kind, devices, projectId, pxToFt);
      doc.save(`${projectId}-${kind}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`Exported · ${label}`, { duration: 3000 });
    } catch (e) {
      console.error(e);
      toast.error('Export failed', { description: 'See console for details.', duration: 5000 });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={handleExport}
      disabled={busy}
      className="w-full text-left px-3 py-2.5 hover:bg-secondary/40 border-b border-border/50 flex items-center gap-3 disabled:opacity-60"
    >
      <div
        className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0"
        style={{ boxShadow: `inset 0 0 0 1.5px ${tone}`, color: tone }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] truncate">{label}</div>
        <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
      </div>
      <span className="text-[10px] font-medium text-primary">{busy ? 'Exporting…' : 'PDF'}</span>
    </button>
  );
}

/** Top-level report router. Each branch composes its own pages using
 *  shared helpers (drawCover, drawTable, drawHeader). */
function drawReport(doc: any, kind: ReportKind, devices: Device[], projectId: string, pxToFt: number) {
  drawCover(doc, kind, projectId);
  doc.addPage();
  switch (kind) {
    case 'engineering':       return drawEngineeringPacket(doc, devices, projectId);
    case 'customer':          return drawCustomerPresentation(doc, devices, projectId);
    case 'camera-schedule':   return drawCameraSchedule(doc, devices);
    case 'door-schedule':     return drawDoorSchedule(doc, devices);
    case 'cable-schedule':    return drawCableSchedule(doc, projectId);
    case 'conduit-schedule':  return drawConduitSchedule(doc, projectId);
    case 'bom':               return drawBOMReport(doc, projectId);
    case 'compliance':        return drawComplianceReport(doc, devices, pxToFt);
    case 'commissioning':     return drawCommissioningReport(doc, devices);
  }
}

/** Conduit schedule — one row per assigned conduit run, aggregated by
 *  bundle. Mirrors the cable schedule's drawing helpers so the look is
 *  consistent with the rest of the report system. */
function drawConduitSchedule(doc: any, projectId: string) {
  const _state = useProjectStore.getState();
  const pathways = (Object.values(_state.pathways) as any[]).filter((p) => p.projectId === projectId);
  const floors = _state.floors;
  // Group bundles by bundleId; standalone runs become single-row entries.
  const byBundle: Record<string, any[]> = {};
  pathways.forEach((p) => {
    const k = p.bundleId ?? p.id;
    (byBundle[k] ??= []).push(p);
  });
  const rows: string[][] = [];
  Object.entries(byBundle).forEach(([id, group]) => {
    const first = group[0];
    const count = group.length;
    const ct = String(first.cableType ?? 'cat6a').toLowerCase();
    const od = CABLE_OD_IN[ct] ?? 0.31;
    const totalArea = count * Math.PI * (od / 2) ** 2;
    const size = first.conduitSize ?? '—';
    const conduitArea = EMT_SIZES.find((e) => e.size === size)?.areaIn2;
    const fillPct = conduitArea ? `${((totalArea / conduitArea) * 100).toFixed(0)}%` : '—';
    const rec = ((): string => {
      const rule = count <= 1 ? 0.53 : count === 2 ? 0.31 : 0.40;
      const r = EMT_SIZES.find((e) => totalArea / e.areaIn2 <= rule);
      return r?.size ?? '—';
    })();
    rows.push([
      id,
      first.conduitType ?? 'none',
      size,
      String(group.reduce((s, x) => s + pathwayLengthFt(x, floors[x.floorId ?? '']), 0)) + ' ft',
      `${count} × ${ct.toUpperCase()}`,
      fillPct,
      rec,
      first.conduitType && first.conduitSize ? 'assigned' : 'open',
    ]);
  });
  drawHeader(doc, 'Conduit schedule');
  drawTable(doc, ['Conduit ID', 'Type', 'Size', 'Length', 'Cables', 'Fill %', 'Recommended', 'Status'], rows);
}

const REPORT_TITLE: Record<ReportKind, string> = {
  'engineering': 'Engineering packet',
  'customer': 'Customer presentation',
  'camera-schedule': 'Camera schedule',
  'door-schedule': 'Door schedule',
  'cable-schedule': 'Cable & pathway schedule',
  'conduit-schedule': 'Conduit schedule',
  'bom': 'Bill of materials',
  'compliance': 'Compliance checklist',
  'commissioning': 'Commissioning report',
};

function drawCover(doc: any, kind: ReportKind, projectId: string) {
  // Premium cover page: brand bar + project meta + date + revision.
  doc.setFillColor(22, 30, 46); doc.rect(0, 0, 612, 792, 'F');
  doc.setFillColor(82, 146, 220); doc.rect(0, 0, 612, 6, 'F');
  doc.setTextColor(232, 237, 244);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(34);
  doc.text(REPORT_TITLE[kind], 56, 240);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13);
  doc.setTextColor(168, 178, 200);
  doc.text(`Project · ${projectId}`, 56, 268);
  doc.setFontSize(11);
  doc.text(`Generated · ${new Date().toLocaleString()}`, 56, 286);
  doc.text('Deeper Vision · Engineering OS for physical security', 56, 304);
  // Footer brand
  doc.setFontSize(9); doc.setTextColor(120, 134, 162);
  doc.text('DEEPER VISION · CONFIDENTIAL', 56, 760);
  doc.text('Page 1', 540, 760);
}

function drawHeader(doc: any, title: string, page: number) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.setTextColor(120, 134, 162);
  doc.text('Deeper Vision · ' + title, 56, 40);
  doc.text(`Page ${page}`, 540, 40);
  doc.setDrawColor(82, 146, 220); doc.setLineWidth(0.5);
  doc.line(56, 48, 556, 48);
}

function drawTable(doc: any, startY: number, headers: string[], rows: (string | number)[][], colW: number[]): number {
  // Header row
  doc.setFillColor(240, 244, 250); doc.rect(56, startY, 500, 18, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(50, 64, 90);
  let x = 60;
  headers.forEach((h, i) => { doc.text(h, x, startY + 12); x += colW[i]; });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.setTextColor(36, 46, 66);
  let y = startY + 32;
  for (const row of rows) {
    if (y > 740) { doc.addPage(); drawHeader(doc, 'continued', (doc.internal.getNumberOfPages())); y = 80; }
    x = 60;
    row.forEach((cell, i) => {
      const str = String(cell ?? '');
      doc.text(str.length > 32 ? str.slice(0, 30) + '…' : str, x, y);
      x += colW[i];
    });
    y += 16;
  }
  doc.setDrawColor(220, 226, 236); doc.line(56, y - 8, 556, y - 8);
  return y;
}

function drawEngineeringPacket(doc: any, devices: Device[], projectId: string) {
  drawHeader(doc, 'Engineering packet', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(22, 30, 46);
  doc.text('Project summary', 56, 76);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 74, 102);
  const cams = devices.filter((d) => TYPE_KIND[d.type] === 'camera').length;
  const access = devices.filter((d) => TYPE_KIND[d.type] === 'access').length;
  const idfs = devices.filter((d) => d.type === 'net.idf' || d.type === 'net.switch').length;
  doc.text(`Project ID: ${projectId}`, 56, 96);
  doc.text(`Cameras: ${cams}  ·  Access devices: ${access}  ·  Network: ${idfs}`, 56, 112);
  doc.text(`Total devices: ${devices.length}`, 56, 128);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Device schedule', 56, 160);
  drawTable(doc, 168,
    ['ID', 'Type', 'Label', 'Product'],
    devices.slice(0, 60).map((d) => [d.id, d.type, d.label ?? '—', d.product ?? '—']),
    [80, 110, 150, 160],
  );
}

function drawCustomerPresentation(doc: any, devices: Device[], projectId: string) {
  drawHeader(doc, 'Customer presentation', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(22, 30, 46);
  doc.text('System overview', 56, 86);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(60, 74, 102);
  doc.text(`This proposal covers the design and installation of ${devices.length} security devices`, 56, 110);
  doc.text(`across the ${projectId} site. The system is engineered for 24/7 operation,`, 56, 126);
  doc.text(`30-day video retention, and code-compliant access control on every opening.`, 56, 142);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('What you get', 56, 180);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  [
    `${devices.filter((d) => TYPE_KIND[d.type] === 'camera').length} cameras across exterior and interior coverage`,
    `${devices.filter((d) => TYPE_KIND[d.type] === 'access').length} access points with credential, REX, and DPS hardware`,
    `Network infrastructure rated for the device count plus 30 % growth headroom`,
    `Full commissioning, training, and a 1-year warranty on installation labor`,
  ].forEach((line, i) => doc.text('•  ' + line, 64, 200 + i * 18));

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Investment summary', 56, 304);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  const estTotal = Math.round(devices.length * 1480 * 1.18);
  doc.text(`Indicative total: $${estTotal.toLocaleString()}`, 56, 326);
  doc.setFontSize(9); doc.setTextColor(120, 134, 162);
  doc.text('Final pricing depends on cable run lengths, mounting hardware, and labor schedule. See BOM for detail.', 56, 346);
}

function drawCameraSchedule(doc: any, devices: Device[]) {
  drawHeader(doc, 'Camera schedule', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Camera schedule', 56, 76);
  const cams = devices.filter((d) => TYPE_KIND[d.type] === 'camera');
  drawTable(doc, 100,
    ['ID', 'Type', 'Location', 'Product', 'IR'],
    cams.map((c) => [c.id, c.type.replace('cam.', ''), c.label ?? '—', c.product ?? '—', c.ir ? 'Yes' : 'No']),
    [70, 80, 130, 160, 60],
  );
}

function drawDoorSchedule(doc: any, devices: Device[]) {
  drawHeader(doc, 'Door schedule', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Door / opening schedule', 56, 76);
  const doors = devices.filter((d) => isStackableHost(d.type));
  drawTable(doc, 100,
    ['ID', 'Type', 'Label', 'Stack count', 'Hardware'],
    doors.map((d) => [d.id, d.type.replace('inf.', ''), d.label ?? '—', String(d.stack?.length ?? 0),
      (d.stack ?? []).map((id) => devices.find((x) => x.id === id)?.type ?? id).join(', ').slice(0, 36) || '—']),
    [70, 100, 110, 80, 140],
  );
}

function drawCableSchedule(doc: any, projectId: string) {
  drawHeader(doc, 'Cable & pathway schedule', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Cable & pathway schedule', 56, 76);
  // Read pathways live from the store; use the calibrated per-floor scale.
  const _state = useProjectStore.getState();
  const pathways = (Object.values(_state.pathways) as any[]).filter((p) => p.projectId === projectId);
  drawTable(doc, 100,
    ['ID', 'Type', 'Cable', 'Count', 'Length ft'],
    pathways.map((p) => [p.id, p.type ?? '—', p.cableType ?? '—', String(p.cableCount ?? 1), String(pathwayLengthFt(p, _state.floors[p.floorId ?? '']))]),
    [80, 80, 100, 60, 80],
  );
}

function drawBOMReport(doc: any, projectId: string) {
  drawHeader(doc, 'Bill of materials', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Bill of materials', 56, 76);
  const state = useProjectStore.getState();
  const bom = deriveBOM(state, projectId);
  drawTable(doc, 100,
    ['SKU', 'Description', 'Qty', 'Unit', 'Unit $', 'Ext $'],
    bom.lines.map((l: any) => [l.sku ?? '—', l.description, l.qty, l.uom ?? 'ea', l.unitPrice, Math.round(l.qty * l.unitPrice)]),
    [80, 220, 40, 50, 60, 70],
  );
}

function drawComplianceReport(doc: any, devices: Device[], pxToFt: number) {
  drawHeader(doc, 'Compliance checklist', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Compliance checklist', 56, 76);
  const cams = devices.filter((d) => TYPE_KIND[d.type] === 'camera');
  const ndaaPct = cams.length ? Math.round((cams.filter((c) => c.ndaa).length / cams.length) * 100) : 100;
  const issues = computeIntelIssues(devices, pxToFt).filter((i) => i.severity === 'high' || i.kind === 'compliance' || i.kind === 'ada');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(60, 74, 102);
  doc.text(`NDAA · ${ndaaPct}% of cameras compliant`, 56, 110);
  doc.text(`Fire egress · ${issues.filter((i) => i.kind === 'compliance').length} open issue${issues.filter((i) => i.kind === 'compliance').length === 1 ? '' : 's'}`, 56, 130);
  doc.text(`ADA reach · ${issues.filter((i) => i.kind === 'ada').length} open issue${issues.filter((i) => i.kind === 'ada').length === 1 ? '' : 's'}`, 56, 150);
  drawTable(doc, 180,
    ['Severity', 'Kind', 'Label', 'Detail'],
    issues.map((i) => [i.severity, i.kind, i.label, i.detail]),
    [70, 90, 130, 220],
  );
}

function drawCommissioningReport(doc: any, devices: Device[]) {
  drawHeader(doc, 'Commissioning report', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Commissioning report', 56, 76);
  drawTable(doc, 100,
    ['ID', 'Type', 'Install', 'Firmware', 'Network', 'Signal', 'Signed off'],
    devices.map((d: any) => {
      const c = d.commissioning ?? {};
      return [d.id, d.type, c.install ?? '—', c.firmware ?? '—', c.network ?? '—', c.signal ?? '—', c.signedOff ? 'Yes' : 'No'];
    }),
    [70, 100, 60, 70, 60, 60, 80],
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FLOORPLAN BACKGROUND CONTROLS  ·  imported PNG / JPG / PDF tools
   ═══════════════════════════════════════════════════════════════════════ */

function FloorplanBackgroundControls({
  bg, onPatch, onRemove,
}: {
  bg: NonNullable<import('../store/types').FloorBackground>;
  onPatch: (patch: Partial<import('../store/types').FloorBackground>) => void;
  onRemove: () => void;
}) {
  // Floats top-left of the canvas. Stays compact so it doesn't block the
  // imported plan beneath it. Each slider writes through to the store so
  // changes survive refresh and propagate to the popped-out window.
  return (
    <div
      className="absolute top-16 left-3 z-20 select-none w-[240px]"
      style={{
        background: 'rgba(13,20,36,0.86)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '8px',
        boxShadow: '0 12px 28px -12px rgba(0,0,0,0.55)',
      }}
    >
      <div className="px-3 py-2 border-b border-white/8 flex items-center gap-2">
        <ImageIcon className="w-3.5 h-3.5 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium tracking-tight text-foreground truncate" title={bg.fileName}>
            {bg.fileName}
          </div>
          <div className="text-[9.5px] text-muted-foreground uppercase tracking-wider mt-0.5">
            {bg.origin === 'visionscan' ? 'VisionScan' : bg.origin.toUpperCase()} · {bg.naturalWidth}×{bg.naturalHeight}
          </div>
        </div>
        <button
          onClick={() => onPatch({ locked: !bg.locked })}
          title={bg.locked ? 'Locked' : 'Unlocked'}
          className="text-muted-foreground hover:text-foreground"
        >
          {bg.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onRemove}
          title="Remove background"
          className="text-muted-foreground hover:text-rose-300"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-3 py-2.5 space-y-2.5">
        {/* Quick actions row — the four most common operations as one-tap
            buttons, so users don't have to scrub a slider for 90° rotations
            or to re-centre after a misclick. */}
        <div className="flex items-center gap-1" data-testid="floorplan-quick-actions">
          <button
            onClick={() => onPatch({ rotation: ((bg.rotation - 90) % 360 + 360) % 360 - (bg.rotation - 90 > 180 ? 360 : 0) })}
            title="Rotate 90° left"
            data-testid="floorplan-rotate-left"
            className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5 text-muted-foreground hover:text-foreground text-[10px]"
          >
            <RotateCcw className="w-3 h-3" /> 90°
          </button>
          <button
            onClick={() => onPatch({ rotation: ((bg.rotation + 90) % 360 + 360) % 360 - ((bg.rotation + 90) % 360 > 180 ? 360 : 0) })}
            title="Rotate 90° right"
            data-testid="floorplan-rotate-right"
            className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5 text-muted-foreground hover:text-foreground text-[10px]"
          >
            <RotateCw className="w-3 h-3" /> 90°
          </button>
          <button
            onClick={() => onPatch({ x: 0, y: 0, scale: 1 })}
            title="Re-centre and fit at 100% scale"
            data-testid="floorplan-fit"
            className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5 text-muted-foreground hover:text-foreground text-[10px]"
          >
            <Maximize2 className="w-3 h-3" /> Fit
          </button>
        </div>
        <SliderInline
          label="Opacity"
          value={Math.round(bg.opacity * 100)}
          min={5} max={100} step={1} unit="%"
          onChange={(v) => onPatch({ opacity: v / 100 })}
        />
        <SliderInline
          label="Scale"
          value={Math.round(bg.scale * 100)}
          min={10} max={400} step={1} unit="%"
          onChange={(v) => onPatch({ scale: v / 100 })}
        />
        <SliderInline
          label="Rotation"
          value={bg.rotation}
          min={-180} max={180} step={1} unit="°"
          onChange={(v) => onPatch({ rotation: v })}
        />
        <div className="flex items-center gap-1.5 pt-1">
          <button
            onClick={() => onPatch({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.85 })}
            data-testid="floorplan-reset"
            className="flex-1 text-[10px] py-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5 text-muted-foreground"
          >
            Reset transform
          </button>
        </div>
        <div className="text-[9.5px] text-muted-foreground leading-snug pt-1 border-t border-white/8">
          Click <span className="text-foreground">Set scale</span> on the scale bar to convert pixels into real-world feet.
        </div>
      </div>
    </div>
  );
}

function SliderInline({ label, value, min, max, step = 1, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-[11px] tabular-nums font-medium text-foreground">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: '#5292DC' }}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ProjectBomDrawer — right-side drawer that surfaces the BOM rolled
// up live from the canvas (devices, door hardware, pathways, IDFs).
// Row click focuses the source object on the canvas. Honors the
// Proposed / Existing flag set on each door-hardware item so existing
// hardware is documented but excluded from proposed totals.
// ══════════════════════════════════════════════════════════════════
function ProjectBomDrawer({
  projectId, onClose, onSelectDevice, onSelectPathway,
}: {
  projectId: string;
  onClose: () => void;
  onSelectDevice: (id: string) => void;
  onSelectPathway: (id: string) => void;
}) {
  const state = useProjectStore();
  const projectName = state.projects[projectId]?.name ?? 'Project';
  const { rows, totals } = useMemo(() => deriveCanvasBomRows(state, projectId), [state, projectId]);
  // Pricebook editor is a modal mounted on top of this drawer so the
  // user can watch totals update underneath while editing.
  const [pricebookOpen, setPricebookOpen] = useState(false);
  const pricebook = state.projectPricebooks[projectId];
  const overrideCount =
    (Object.keys(pricebook?.doorHardware ?? {}).length) +
    (Object.keys(pricebook?.cablePerFt ?? {}).length) +
    (pricebook?.laborRate != null ? 1 : 0) +
    (pricebook?.markup != null ? 1 : 0);
  const hasOverrides = overrideCount > 0;
  const overriddenRowCount = rows.filter((r) => r.overridden).length;

  type FilterKey = 'all' | CanvasBomCategory | 'existing';
  const [filter, setFilter] = useState<FilterKey>('all');
  // Canvas V2 Pass 2A.8 — floor scope filter. 'all' keeps the BOM
  // project wide (default behaviour as called for in the brief);
  // any specific floor id narrows to rows whose source device lives
  // on that floor. Pathway / cable rows also honour the filter via
  // their stored floorId.
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const projectFloors = useMemo(() => Object.values(state.floors)
    .filter((f) => f.projectId === projectId)
    .sort((a, b) => (b.level - a.level) || ((b.createdAt ?? 0) - (a.createdAt ?? 0))),
    [state.floors, projectId],
  );

  const FILTERS: { id: FilterKey; label: string }[] = [
    { id: 'all',      label: 'All' },
    { id: 'cameras',  label: 'Cameras' },
    { id: 'access',   label: 'Access' },
    { id: 'network',  label: 'Network' },
    { id: 'cabling',  label: 'Cabling' },
    { id: 'existing', label: 'Existing' },
  ];

  // Per row floor lookup so each BOM line can annotate which floor
  // its source lives on. Pathways carry their own floorId; devices
  // need a lookup against the store.
  const floorIdForRow = useCallback((r: CanvasBomRow): string | null => {
    const sid = (r as any).sourceId as string | undefined;
    if (!sid) return null;
    const dev = (state.devices as any)[sid];
    if (dev?.floorId) return dev.floorId;
    const path = (state.pathways as any)[sid];
    if (path?.floorId) return path.floorId;
    return null;
  }, [state]);
  const floorNameForRow = useCallback((r: CanvasBomRow): string => {
    const fid = floorIdForRow(r);
    if (!fid) return '—';
    return (state.floors as any)[fid]?.name ?? '—';
  }, [floorIdForRow, state]);

  // Canvas V2 Pass 2C.4 — per row room lookup. A device row's "room"
  // is the polygon whose bounds contain the device origin. Pathways
  // don't currently report rooms (their geometry is a polyline; the
  // first-vertex room is a sensible fallback but added complexity).
  const roomNameForRow = useCallback((r: CanvasBomRow): string | null => {
    const sid = (r as any).sourceId as string | undefined;
    if (!sid) return null;
    const dev = (state.devices as any)[sid];
    if (!dev) return null;
    const projectRooms = Object.values(state.rooms).filter((rm: any) => rm.projectId === projectId && rm.floorId === dev.floorId);
    for (const rm of projectRooms as any[]) {
      // Ray-casting point in polygon.
      let inside = false;
      const poly = rm.polygon as { x: number; y: number }[];
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > dev.y) !== (yj > dev.y)) &&
          (dev.x < (xj - xi) * (dev.y - yi) / ((yj - yi) || 1) + xi);
        if (intersect) inside = !inside;
      }
      if (inside) return rm.name;
    }
    return null;
  }, [state, projectId]);

  const filtered = useMemo(() => {
    let out = rows;
    if (filter === 'existing') out = out.filter((r) => r.isExisting);
    else if (filter !== 'all') out = out.filter((r) => r.category === filter);
    if (floorFilter !== 'all') out = out.filter((r) => floorIdForRow(r) === floorFilter);
    return out;
  }, [rows, filter, floorFilter, floorIdForRow]);

  const grouped = useMemo(() => {
    const groups = new Map<CanvasBomCategory, CanvasBomRow[]>();
    for (const r of filtered) {
      const arr = groups.get(r.category) ?? [];
      arr.push(r);
      groups.set(r.category, arr);
    }
    return groups;
  }, [filtered]);

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString();
  const exportCsv = () => {
    const head = ['Category', 'Source', 'Description', 'Product', 'Status', 'Qty', 'UOM', 'Unit price', 'Line total', 'Labor hrs'];
    const lines: (string | number)[][] = [head];
    for (const r of rows) {
      lines.push([
        r.category,
        r.meta ?? r.sourceId ?? '',
        r.description,
        r.product ?? '',
        r.isExisting ? 'Existing' : 'Proposed',
        r.qty,
        r.uom,
        r.unitPrice.toFixed(2),
        (r.unitPrice * r.qty).toFixed(2),
        r.laborHours.toFixed(2),
      ]);
    }
    // Totals block
    lines.push([]);
    lines.push(['TOTALS']);
    lines.push(['Devices on plan', totals.deviceCount]);
    lines.push(['Proposed material', totals.proposedMaterial.toFixed(2)]);
    lines.push(['Existing documented', totals.existingDocumented.toFixed(2)]);
    lines.push(['Cable', totals.cable.toFixed(2)]);
    lines.push(['Labor hours', totals.laborHours.toFixed(2)]);
    lines.push(['Labor cost', totals.laborTotal.toFixed(2)]);
    lines.push(['Markup', (totals.markup * 100).toFixed(1) + '%']);
    lines.push(['Sell total', totals.sellTotal.toFixed(2)]);

    const csvField = (v: unknown): string => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const body = lines.map((row) => row.map(csvField).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeProject = projectName.replace(/[^a-z0-9-_]+/gi, '_');
    a.download = `${safeProject}-bom.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('BOM exported', { description: `${rows.length} lines · ${a.download}`, duration: 3000 });
  };

  const CATEGORY_LABEL: Record<CanvasBomCategory, string> = {
    cameras: 'Cameras',
    access:  'Access control',
    network: 'Network & power',
    cabling: 'Cable & pathways',
    labor:   'Labor',
    other:   'Other',
  };
  const CATEGORY_ORDER: CanvasBomCategory[] = ['cameras', 'access', 'network', 'cabling', 'labor', 'other'];

  return (
    <div
      data-canvas-chrome="drawer"
      className="absolute top-0 right-0 bottom-0 z-40 transition-transform duration-300 translate-x-0 pointer-events-auto flex flex-col"
      style={{
        width: 460,
        background: 'var(--drawer-background)',
        color: 'var(--drawer-foreground)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-16px 0 40px -16px rgba(0,0,0,0.35)',
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-white/[0.05] shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#22D3EE', boxShadow: '0 0 6px #22D3EE66' }} />
              <span className="text-[11px] text-muted-foreground tracking-tight">Project BOM · derived live from canvas</span>
            </div>
            <div className="text-[18px] font-medium text-foreground tracking-tight truncate leading-tight">{projectName}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{rows.length} line{rows.length === 1 ? '' : 's'} · {totals.deviceCount} device{totals.deviceCount === 1 ? '' : 's'} on plan</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setPricebookOpen(true)}
              title="Edit pricebook · override prices + labor + markup for this project"
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] border transition-colors ${hasOverrides ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15' : 'border-border bg-secondary/40 hover:bg-secondary text-foreground'}`}
              data-track="bom-open-pricebook"
            >
              <DollarSign className="w-3.5 h-3.5" />Pricebook{hasOverrides && <span className="text-[9.5px] tabular-nums opacity-80">· {overrideCount}</span>}
            </button>
            <button
              onClick={exportCsv}
              title={`Export ${rows.length} BOM lines as CSV`}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] border border-border bg-secondary/40 hover:bg-secondary text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              data-track="bom-export-csv"
            >
              <FileDown className="w-3.5 h-3.5" />CSV
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/[0.05] text-muted-foreground hover:text-foreground transition-colors"
              title="Close BOM drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Totals card */}
      <div className="px-5 pt-3 pb-3 border-b border-white/[0.05] shrink-0">
        <div className="rounded-lg p-3 bg-secondary/30 border border-border/60">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Proposed material</span>
              <span className="text-[14px] font-medium tabular-nums">{fmt(totals.proposedMaterial)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Cable</span>
              <span className="text-[14px] font-medium tabular-nums">{fmt(totals.cable)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Labor</span>
              <span className="text-[14px] font-medium tabular-nums">{totals.laborHours.toFixed(1)} hr · {fmt(totals.laborTotal)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Existing documented</span>
              <span className="text-[13px] tabular-nums text-muted-foreground line-through decoration-1">{fmt(totals.existingDocumented)}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/40 flex items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Sell total · {(totals.markup * 100).toFixed(0)}% markup</span>
              <span className="text-[18px] font-medium tabular-nums text-foreground">{fmt(totals.sellTotal)}</span>
            </div>
            <div className="text-[10px] text-right" style={{ color: hasOverrides ? '#22D3EE' : undefined }}>
              {hasOverrides
                ? <><span className="font-medium">Project pricebook overrides active</span><br /><span className="text-muted-foreground">{overrideCount} override{overrideCount === 1 ? '' : 's'} · not connected to ERP yet.</span></>
                : <span className="text-muted-foreground"><span className="font-medium text-foreground">Preview pricing.</span><br />Open pricebook to calibrate.</span>
              }
            </div>
          </div>
          {totals.missingPriceCount > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40 flex items-start gap-2 text-[10px] text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {totals.missingPriceCount} line{totals.missingPriceCount === 1 ? '' : 's'} missing price.
                Catalog or UNIT_PRICE has no entry for the source product — totals undercount until set.
              </span>
            </div>
          )}
          {overriddenRowCount > 0 && (
            <div className="mt-2 text-[10px] text-muted-foreground">
              <span className="text-primary font-medium">{overriddenRowCount} row{overriddenRowCount === 1 ? '' : 's'}</span> using pricebook override{overriddenRowCount === 1 ? '' : 's'}.
            </div>
          )}
        </div>
      </div>

      {pricebookOpen && (
        <PricebookEditor projectId={projectId} onClose={() => setPricebookOpen(false)} />
      )}

      {/* Filter pills */}
      <div className="px-5 pt-3 pb-3 border-b border-white/[0.05] shrink-0 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            // Quick count per filter so the pill feels alive.
            const count = f.id === 'all' ? rows.length
              : f.id === 'existing' ? rows.filter((r) => r.isExisting).length
              : rows.filter((r) => r.category === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                disabled={count === 0 && f.id !== 'all'}
                className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] tracking-tight transition-colors ${
                  active ? 'bg-primary/15 text-primary border border-primary/40'
                         : 'bg-secondary/30 text-muted-foreground border border-border hover:bg-secondary/60'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
                data-track={`bom-filter-${f.id}`}
              >
                {f.label}<span className="text-[10px] opacity-70 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
        {/* Canvas V2 Pass 2A.8 — floor scope. Only shows when the
            project actually has more than one floor; single floor
            projects hide this row entirely so the chrome stays calm. */}
        {projectFloors.length > 1 && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Floor</span>
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="bg-secondary/30 text-foreground border border-border rounded-full h-7 px-2.5 text-[11px] focus:outline-none focus:border-primary/40"
              data-track="bom-floor-filter"
            >
              <option value="all">All floors ({rows.length})</option>
              {projectFloors.map((f) => {
                const c = rows.filter((r) => floorIdForRow(r) === f.id).length;
                return <option key={f.id} value={f.id}>{f.name} ({c})</option>;
              })}
            </select>
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-6 space-y-4">
        {filtered.length === 0 && (
          <div className="text-center text-[11px] text-muted-foreground py-8 px-4">
            {rows.length === 0
              ? 'No devices, doors, or pathways on the canvas yet. Drop hardware from the bottom bar or draw a cable run to populate the BOM.'
              : 'No rows match this filter.'}
          </div>
        )}
        {CATEGORY_ORDER.map((cat) => {
          const group = grouped.get(cat);
          if (!group || group.length === 0) return null;
          const groupTotal = group.reduce((s, r) => s + (r.isExisting ? 0 : r.unitPrice * r.qty), 0);
          const groupExisting = group.reduce((s, r) => s + (r.isExisting ? r.unitPrice * r.qty : 0), 0);
          return (
            <div key={cat}>
              <div className="px-2 pb-1.5 flex items-end justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{CATEGORY_LABEL[cat]}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">· {group.length}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] tabular-nums">
                  {groupExisting > 0 && (
                    <span className="text-muted-foreground line-through decoration-1">{fmt(groupExisting)}</span>
                  )}
                  <span className="text-foreground">{fmt(groupTotal)}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {group.map((r) => (
                  <BomRow
                    key={r.id}
                    row={r}
                    fmt={fmt}
                    floorName={projectFloors.length > 1 ? floorNameForRow(r) : undefined}
                    roomName={roomNameForRow(r) ?? undefined}
                    onSelect={() => {
                      if (r.sourceKind === 'pathway' && r.sourceId)            onSelectPathway(r.sourceId);
                      else if ((r.sourceKind === 'device' || r.sourceKind === 'door') && r.sourceId) onSelectDevice(r.sourceId);
                      else toast.message(`Source: ${r.meta ?? r.sourceId ?? '(none)'}`, { duration: 2200 });
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BomRow({ row, fmt, onSelect, floorName, roomName }: { row: CanvasBomRow; fmt: (n: number) => string; onSelect: () => void; floorName?: string; roomName?: string }) {
  const lineTotal = row.unitPrice * row.qty;
  const canSelect = !!row.sourceId && (row.sourceKind === 'device' || row.sourceKind === 'door' || row.sourceKind === 'pathway');
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!canSelect}
      className={`w-full text-left rounded-md p-2.5 border transition-colors ${
        row.isExisting ? 'border-border/40 bg-secondary/10 opacity-75 hover:opacity-100' : 'border-border/60 bg-secondary/20 hover:bg-secondary/40'
      } ${canSelect ? 'cursor-pointer' : 'cursor-default'}`}
      title={canSelect ? 'Highlight this source on the canvas' : undefined}
      data-track={`bom-row-${row.sourceKind}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {row.meta && <span className="text-[10px] text-muted-foreground tracking-tight truncate">{row.meta}</span>}
            {row.isExisting && (
              <span className="text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 border border-amber-400/30">Existing</span>
            )}
            {!row.isExisting && row.sourceKind === 'door' && (
              <span className="text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-400 border border-emerald-400/30">Proposed</span>
            )}
            {row.missingPrice && (
              <span className="text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20" title="No catalog price on file">No price</span>
            )}
            {row.overridden && !row.missingPrice && (
              <span className="text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/40" title="Project pricebook override applied">Overridden</span>
            )}
            {floorName && floorName !== '—' && (
              <span
                className="text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-secondary/40 text-muted-foreground border border-border"
                title="Floor this line lives on"
              >
                {floorName}
              </span>
            )}
            {roomName && (
              <span
                className="text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30"
                title="Room this line lives in"
              >
                {roomName}
              </span>
            )}
          </div>
          <div className="text-[12px] font-medium text-foreground truncate">{row.description}</div>
          {row.product && (
            <div className="text-[10px] text-muted-foreground truncate">{row.product}</div>
          )}
          {row.laborHours > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{row.laborHours.toFixed(2)} hr labor</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-[12px] tabular-nums ${row.isExisting ? 'text-muted-foreground line-through decoration-1' : 'text-foreground'}`}>
            {row.qty.toLocaleString(undefined, { maximumFractionDigits: row.uom === 'ft' ? 0 : 0 })} {row.uom}
          </div>
          <div className={`text-[10px] tabular-nums ${row.isExisting ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
            @ {fmt(row.unitPrice)}
          </div>
          <div className={`text-[12px] font-medium tabular-nums mt-0.5 ${row.isExisting ? 'text-muted-foreground line-through decoration-1' : 'text-foreground'}`}>
            {fmt(lineTotal)}
          </div>
        </div>
      </div>
    </button>
  );
}
