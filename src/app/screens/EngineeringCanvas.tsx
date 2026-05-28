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
import { ScanBuildFloorplanDialog } from '../canvas/dialogs/ScanBuildFloorplanDialog';
import { ImportFloorplanDialog } from '../canvas/dialogs/ImportFloorplanDialog';
import { LayersPanel } from '../canvas/chrome/LayersPanel';
import { ReportBuilderDialog } from '../canvas/reports/ReportBuilderDialog';
import { ReportExportRow } from '../canvas/reports/ReportExportRow';
import type { ReportKind } from '../canvas/reports/draw';
import { computeIntelIssues, type IntelIssue } from '../canvas/intelligence';
import { ColorPicker } from '../canvas/components/ColorPicker';
import { SelectByMenu } from '../canvas/chrome/SelectByMenu';
import { IntelligenceLayer } from '../canvas/chrome/IntelligenceLayer';
import { ProjectBomDrawer } from '../canvas/chrome/ProjectBomDrawer';
import { FloorplanBackgroundControls } from '../canvas/chrome/FloorplanBackgroundControls';
import { CableTypePicker } from '../canvas/chrome/CableTypePicker';
import { PathwaysOverlay } from '../canvas/pathways/PathwaysOverlay';
import { PathwayVertexEditor } from '../canvas/pathways/PathwayVertexEditor';
import { PathwayDrawer } from '../canvas/pathways/PathwayDrawer';
import { Row, DrawerSection, FindingRow } from '../canvas/components/DrawerPrimitives';
import { SurveyPanel } from '../canvas/components/SurveyPanel';
import { AccessoriesSection } from '../canvas/inspector/AccessoriesSection';
import { ConduitAssistSection } from '../canvas/inspector/ConduitAssistSection';
import { IdfPortScheduleSection } from '../canvas/inspector/IdfPortScheduleSection';
import { SurveySection } from '../canvas/inspector/SurveySection';
import { ImpactPreviewSection } from '../canvas/inspector/ImpactPreviewSection';
import { AiOptimizeSection } from '../canvas/inspector/AiOptimizeSection';
import { DoorAssemblySection } from '../canvas/inspector/DoorAssemblySection';
import { BottomDeviceBar } from '../canvas/chrome/BottomDeviceBar';
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
  // M11 audit fix (F1): the legacy dockCollapsed state + its persist
  // effect drove the InsertDock side rail's collapse/expand. The
  // InsertDock was deleted as dead code in E37b; nothing reads
  // dockCollapsed anymore. Removed here. The FAB visibility gate that
  // used to consume it now just keys on viewMode.
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

  // M11 hardening — legacy EditDrawer state (editOpen, editExpanded,
  // editTab + EditTab union + the openTab callback) was removed here.
  // The drawer it gated rendered nothing for several passes already
  // (replaced by CanvasSelectionMenu + the PathwayDrawer / ProjectBomDrawer
  // surfaces). Nothing in the tree read any of these values, so the
  // setters were no-op calls and the state was harmless dead wiring.
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

  // M11 audit fix (F1): the legacy navSection state used to drive the
  // InsertDock side rail's section nav. The InsertDock was deleted as
  // dead code in E37b; navSection had no readers anywhere in the tree
  // after that, and the FAB writing to it was the F1 bug. Removed.

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
              // inspector visible. Without this, a PathwayDrawer the user
              // "closed" via its X button is still mounted (just slid
              // off-screen with selPathwayId preserved) and would block
              // the BOM mount under the previous gating.
              setSelId(null);
              setSelPathwayId(null);
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
              are exclusively through the BottomDeviceBar. The old
              InsertDock side-rail was deleted in M11 — no JSX usage. */}

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
                library. M11 audit fix (F1): the old onClick wrote to
                dead state (dockCollapsed gated the FAB itself, so the
                click hid the control the user just pressed; navSection
                had no readers post-InsertDock-deletion). Now the FAB
                opens the canonical device entry — the bottom device
                bar's Cameras tray — by dispatching a click on the
                already-wired bottombar-cat-cam button. The user gets a
                grid of draggable camera cards exactly as if they'd
                clicked the Cameras icon themselves. */}
            {viewMode !== 'canvas' && (
              <button
                onClick={() => {
                  if (viewMode === 'field') setViewMode('default');
                  // Dispatch on the bottom-bar Cameras category button.
                  // That button is the canonical entry into the device
                  // library after the InsertDock deletion. Using a DOM
                  // click instead of lifting the BottomDeviceBar's
                  // internal `open` state keeps the FAB stateless and
                  // matches what a user would do manually.
                  const camCatBtn = document.querySelector('[data-track="bottombar-cat-cam"]') as HTMLButtonElement | null;
                  if (camCatBtn) camCatBtn.click();
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

// ReportBuilderDialog moved to canvas/reports/ReportBuilderDialog.tsx
// (M11 monolith breakup). The whole report cluster — ReportKind,
// drawReport router, REPORT_TITLE, drawCover, drawHeader, drawTable,
// the 9 per-kind drawers, ReportExportRow — moves together to
// canvas/reports/ so there is no circular import.

// BundleInspectorDialog + computeBundleFill moved to
// canvas/dialogs/BundleInspectorDialog.tsx (M11 monolith breakup).
// EMT_SIZES + CABLE_OD_IN moved to canvas/cabling.ts and imported
// here so the inspector / BOM rows below can keep using them.

// RunToIdfDialog moved to canvas/dialogs/RunToIdfDialog.tsx (M11
// monolith breakup). Import at top of file.

// ScanBuildFloorplanDialog moved to
// canvas/dialogs/ScanBuildFloorplanDialog.tsx (M11 monolith breakup).
// Import at top of file.

// ImportFloorplanDialog moved to
// canvas/dialogs/ImportFloorplanDialog.tsx (M11 monolith breakup).
// Import at top of file.

// InsertDock + its private Chip helper deleted in M11. The side
// device library was orphaned years ago — no JSX usage anywhere
// in the tree. Device adds run exclusively through BottomDeviceBar
// (defined further down in this file). The stale "+ Full catalog"
// trigger the comment used to point at was never wired.

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
      style={{ background: 'var(--canvas-workspace)', touchAction: 'none' }}
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

// EditTab union deleted — see the M11 hardening comment further down.
// It was the type for the dead editTab useState; nothing else
// referenced it.


// ColorPicker moved to canvas/components/ColorPicker.tsx (M11
// monolith breakup). Import at top of file.

// Camera-spec cluster deleted in M11 — the whole block was dead.
// EDIT_TABS / tilesForDevice / tabGroupOf / bodyShows / labelForKind
// / ToolbarAction / ProductOverviewSection / CameraResolutionSection
// / FacePixelTile / drawPersonWithPlate / RequiredDensityRow /
// PersonProbePreview were all defined but never JSX-mounted: the
// 3-icon-per-row inspector tile grid they powered was retired in an
// earlier pass without a follow-up cleanup. The `editTab` /
// `editOpen` / `editExpanded` state + `openTab` setter that fed into
// that tile grid were also dead and got removed in the hardening
// pass — see the cleanup near `useState(false)` for ProjectBomDrawer
// gating.

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

// SurveySection moved to canvas/inspector/SurveySection.tsx
// ImpactPreviewSection moved to canvas/inspector/ImpactPreviewSection.tsx
// AiOptimizeSection moved to canvas/inspector/AiOptimizeSection.tsx
// (M11 monolith breakup). Each imports at top of file.

// PathwayDrawer moved to canvas/pathways/PathwayDrawer.tsx
// (M11 monolith breakup). Import at top of file.

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

// IntelIssue interface + computeIntelIssues function moved to
// canvas/intelligence.ts (M11 monolith breakup). Imported at top so
// the right floating rail below and the report compliance drawer
// share one source of truth.

// IntelligenceLayer moved to canvas/chrome/IntelligenceLayer.tsx
// (M11 monolith breakup). Import at top of file.

// CableTypePicker moved to canvas/chrome/CableTypePicker.tsx
// (M11 monolith breakup). Import at top of file.

// PathwaysOverlay moved to canvas/pathways/PathwaysOverlay.tsx
// (M11 monolith breakup). Import at top of file.

// PathwayVertexEditor moved to
// canvas/pathways/PathwayVertexEditor.tsx (M11 monolith breakup).
// Import at top of file.

// SelectByMenu moved to canvas/chrome/SelectByMenu.tsx (M11 monolith
// breakup). Import at top of file.

/* ═══════════════════════════════════════════════════════════════════════
   DRAWING TOOL RAIL — black vertical strip on the left of the canvas
   pane. Tools only (no devices). Always visible in Default + Field
   modes; replaced by a small "Tools" reopener in Canvas mode.
   ═══════════════════════════════════════════════════════════════════════ */

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

// BottomDeviceBar moved to canvas/chrome/BottomDeviceBar.tsx
// (M11 monolith breakup). TraySection (a dead helper inside the
// old monolith — never JSX-mounted) was deleted with the move.
// TRAY_DESCRIPTION + the cats config rode along to the new
// module. Import at top of file.

// FloorplanBackgroundControls + SliderInline moved to
// canvas/chrome/FloorplanBackgroundControls.tsx (M11 monolith
// breakup). Import at top of file.

// ProjectBomDrawer + BomRow moved to
// canvas/chrome/ProjectBomDrawer.tsx (M11 monolith breakup).
// Import at top of file.
