import { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { useProjectStore, selectors as storeSelectors, deriveBOM, deriveDoorAssemblyLines, deriveCanvasBomRows } from '../store/projectStore';
import { SAMPLE_PRODUCTS as CATALOG, accessoriesFor as catalogAccessoriesFor, type Product as CatalogProduct } from '../lib/productCatalog';
import type {
  EngineeringLayer, CanvasLayerState, CanvasDisplayPrefs, IconSize,
  LabelDensity, BaseMapMode, DoorHardware, SurveyItemStatus,
  CanvasBomRow, CanvasBomCategory,
} from '../store/types';
import { DEFAULT_CANVAS_LAYERS, DEFAULT_DISPLAY_PREFS } from '../store/types';
import type { Device as StoreDevice } from '../store/types';
import {
  MousePointer2, Hand, Ruler, Type, MessageSquare, ChevronRight, ChevronLeft,
  Search, X, Upload, MapPin, PencilLine, Sparkles, Undo2, Redo2, ZoomIn, ZoomOut,
  Maximize2, Magnet, ChevronDown, MoreHorizontal, Trash2, RotateCw, RotateCcw, Eye, EyeOff,
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
} from 'lucide-react';
import { SurveyorSymbolBody, SURVEYOR_SYMBOL_IDS } from '../components/canvas/SurveyorSymbols';
import { ProjectStateMenu } from '../components/canvas/ProjectStateMenu';
import { PricebookEditor } from '../components/canvas/PricebookEditor';
import { AttachmentPanel } from '../components/canvas/AttachmentPanel';
const SURVEYOR_SYMBOL_SET = new Set<string>(SURVEYOR_SYMBOL_IDS as unknown as string[]);
function SURVEYOR_SYMBOL_HAS(t: string): boolean { return SURVEYOR_SYMBOL_SET.has(t); }
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { canHost } from '../lib/compatibility';
import { pathwayLengthFt, ftPerPxForFloor } from '../lib/engineering';
import { buildLabel, COMMIT_HASH } from '../../build-info';
import { toast } from 'sonner';

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
type Tool = 'select' | 'pan' | 'measure' | 'wall' | 'cable' | 'conduit' | 'pathway' | 'calibrate';

interface Wall { id: string; x1: number; y1: number; x2: number; y2: number; }

type DeviceKind =
  | 'camera' | 'access' | 'network' | 'intrusion' | 'audio' | 'storage' | 'display' | 'power' | 'sensor'
  | 'infrastructure' | 'cyber' | 'fire' | 'building';
type DeviceType =
  | 'cam.bullet' | 'cam.dome' | 'cam.ptz' | 'cam.multisensor' | 'cam.fisheye' | 'cam.thermal' | 'cam.lpr' | 'cam.body'
  | 'acc.reader' | 'acc.strike' | 'acc.maglock' | 'acc.exit' | 'acc.turnstile' | 'acc.intercom' | 'acc.biometric' | 'acc.panic-bar' | 'acc.dps'
  | 'net.switch'  | 'net.idf'    | 'net.ap' | 'net.firewall' | 'net.bridge'
  | 'int.motion' | 'int.glassbreak' | 'int.contact' | 'int.panic' | 'int.vibration' | 'int.keypad'
  | 'aud.speaker' | 'aud.mic' | 'aud.horn' | 'aud.amp' | 'aud.intercom'
  | 'sto.nvr' | 'sto.server' | 'sto.archive' | 'sto.cloud'
  | 'dis.monitor' | 'dis.wall' | 'dis.kiosk' | 'dis.signage'
  | 'pwr.ups' | 'pwr.poe' | 'pwr.surge' | 'pwr.solar'
  | 'sen.temp' | 'sen.smoke' | 'sen.water' | 'sen.occupancy' | 'sen.gas' | 'sen.gunshot'
  // ── Infrastructure host objects ─────────────────────────────────────
  // Doors are the canonical stacking target: a single door can host a
  // reader, strike, panic bar, REX, DPS, intercom. The stack chip on the
  // glyph reveals which accessories live on the door.
  | 'inf.door-single' | 'inf.door-double' | 'inf.door-storefront' | 'inf.door-sliding'
  | 'inf.window' | 'inf.wall-brick' | 'inf.wall-fire' | 'inf.wall-concrete'
  | 'inf.gate-swing' | 'inf.gate-slide' | 'inf.elevator' | 'inf.mdf' | 'inf.rack'
  // ── Cyber security ──────────────────────────────────────────────────
  | 'cyb.endpoint' | 'cyb.siem' | 'cyb.firewall-ng' | 'cyb.vpn'
  // ── Fire / life safety ──────────────────────────────────────────────
  | 'fls.pull-station' | 'fls.fire-panel' | 'fls.strobe' | 'fls.sprinkler'
  // ── Building systems ────────────────────────────────────────────────
  | 'bld.hvac-controller' | 'bld.lighting-panel' | 'bld.bms-gateway';

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

/** Returns the effective tone for a device: per-object color override if
 *  set, otherwise the category default. Used everywhere the canvas needs
 *  a single color for a single device (glyph, cone, label, badge). */
function deviceTone(d: Device): string {
  return d.color || KIND_TONE[TYPE_KIND[d.type]];
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
  { id: 'camera',  label: 'Cameras',  tone: '#F08F3C', types: [
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
    };
  });

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

const KIND_TONE: Record<DeviceKind, string> = {
  camera: '#F08F3C', access: '#3FB950', network: '#E5B23A',
  intrusion: '#E5484D', audio: '#A371F7', storage: '#1F6FEB',
  display: '#00B5D8', power: '#8B5CF6', sensor: '#14B8A6',
  infrastructure: '#9CA3AF',
  cyber: '#22D3EE', fire: '#F87171', building: '#94A3B8',
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

const FLOORS = ['Ground floor', 'Level 2', 'Level 3', 'Roof'];

interface SiteFloor { id: string; name: string; deviceCount: number; updated: string; source: 'blueprint' | 'satellite' | 'sketch'; }
interface SiteBuilding { id: string; name: string; address: string; floors: SiteFloor[]; }

const SITE_BUILDINGS: SiteBuilding[] = [
  { id: 'bld-a', name: 'Building A — Headquarters', address: '500 Terry A. Francois Blvd', floors: [
    { id: 'a-g', name: 'Ground floor', deviceCount: 14, updated: '2d ago',  source: 'blueprint' },
    { id: 'a-2', name: 'Level 2',      deviceCount: 18, updated: '5h ago',  source: 'blueprint' },
    { id: 'a-3', name: 'Level 3',      deviceCount: 11, updated: '1w ago',  source: 'blueprint' },
    { id: 'a-r', name: 'Rooftop',      deviceCount: 4,  updated: '3d ago',  source: 'satellite' },
  ]},
  { id: 'bld-b', name: 'Building B — Warehouse', address: '510 Industrial Way', floors: [
    { id: 'b-g', name: 'Ground floor', deviceCount: 22, updated: '1d ago',  source: 'blueprint' },
    { id: 'b-m', name: 'Mezzanine',    deviceCount: 8,  updated: '4d ago',  source: 'sketch' },
  ]},
  { id: 'bld-c', name: 'Building C — Operations', address: '525 Riverbend Pkwy', floors: [
    { id: 'c-1', name: '1st floor',    deviceCount: 9,  updated: '6h ago',  source: 'blueprint' },
    { id: 'c-2', name: '2nd floor',    deviceCount: 12, updated: '6h ago',  source: 'blueprint' },
  ]},
  { id: 'site',  name: 'Site & exteriors', address: 'Parcel + parking + perimeter', floors: [
    { id: 's-aerial', name: 'Aerial / satellite', deviceCount: 6, updated: '1w ago', source: 'satellite' },
    { id: 's-perim',  name: 'Perimeter walk',     deviceCount: 3, updated: '2d ago', source: 'sketch' },
  ]},
];

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

  // Which floor are we editing? For now: first floor of this project. (When
  // multi-floor switching lands, this becomes state-driven from the floor
  // selector in TopBar.)
  const currentFloorId = useProjectStore((s) =>
    storeSelectors.firstFloorOfProject(s, projectId ?? 'p1')?.id ?? '',
  );
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
  const storeFloorWalls = useProjectStore((s) => (currentFloorId ? s.floors[currentFloorId]?.walls : undefined));
  const setFloorWalls = useProjectStore((s) => s.setFloorWalls);
  const allWalls = useMemo<Wall[]>(
    () => ((storeFloorWalls ?? []) as unknown as Wall[]),
    [storeFloorWalls],
  );

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
    const _state = useProjectStore.getState();
    const _floor = storeSelectors.firstFloorOfProject(_state, projectId);
    const lengthFt = pathwayLengthFt({ points: prev.points }, _floor);
    const fid = _state.sites[projectId.replace(/^p/, 's') + ''] ? '' : (_floor?.id ?? '');
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
  // Upload modal — independent of the MapsPanel's own importOpen so the
  // "Add plan → Upload" flow can be triggered directly from the TopBar
  // without forcing the user through the section nav.
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
  const [editTab, setEditTab] = useState<EditTab>('overview');
  const [targetSim, setTargetSim] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  // Stick-figure target placement. v3 (Surveyor UX hard reset): the target
  // and FOV overlay no longer auto-pop on plain selection — the user spec
  // calls clicking-an-object a "compact pill only" moment. The target only
  // appears once the engineer opens the drawer's Coverage tab (or hits the
  // Coverage chip in the SelectionPill's Expand menu), so the canvas stays
  // calm by default. Selection alone never paints the stick figure.
  const lastAutoSelRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selId) {
      setTargetSim((t) => t.open ? { open: false, x: 0, y: 0 } : t);
      lastAutoSelRef.current = null;
      return;
    }
    const coverageActive = editOpen && tabGroupOf(editTab) === 'lens';
    if (!coverageActive) {
      // Switched selection or left Coverage — drop the figure so the canvas
      // is clean again.
      setTargetSim((t) => t.open ? { open: false, x: 0, y: 0 } : t);
      if (!coverageActive) lastAutoSelRef.current = null;
      return;
    }
    if (lastAutoSelRef.current === selId) return;
    lastAutoSelRef.current = selId;
    const dev = (Object.values(useProjectStore.getState().devices) as any[]).find((x) => x.id === selId) as Device | undefined;
    if (!dev) return;
    const isSingleLensCamera = TYPE_KIND[dev.type] === 'camera' && dev.type !== 'cam.multisensor' && dev.type !== 'cam.fisheye';
    if (!isSingleLensCamera) {
      // Multisensor / fisheye / non-cameras don't auto-place a stick figure.
      setTargetSim((t) => t.open ? { open: false, x: 0, y: 0 } : t);
      return;
    }
    // Place the figure at the *useful* cone distance — by default the cone
    // extends to the device's DORI range; we drop the subject at the
    // observe-band sweet spot (~60% out) so the readout starts in a
    // meaningful regime instead of right at the camera.
    const rotRad = (dev.rot * Math.PI) / 180;
    const rangeFt = dev.range ?? (dev.type === 'cam.ptz' ? 44 : dev.type === 'cam.bullet' ? 50 : 30);
    const reachPx = Math.round(rangeFt * 3.83 * 0.65);
    const tx = dev.x + Math.cos(rotRad) * reachPx;
    const ty = dev.y + Math.sin(rotRad) * reachPx;
    setTargetSim({ open: true, x: tx, y: ty });
  }, [selId, editOpen, editTab]);
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
    toast.success(`Placed ${product.mfr} ${product.model}`, { description: `New device ${id}`, duration: 3500 });
    return id;
  }, [setDevices]);

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
      if (e.key === 'Escape') {
        // Escape unwinds from the most-immersive layer first so a single
        // press always feels predictable — first leave Canvas / Field
        // view, then close transient pickers, then drop selection.
        if (viewMode === 'canvas') { setViewMode('default'); return; }
        if (viewMode === 'field')  { setViewMode('default'); return; }
        if (reportOpen)            { setReportOpen(false); return; }
        if (scanBuildOpen)         { setScanBuildOpen(false); return; }
        // Cancel a pending click-to-arm placement before generic deselect.
        if (armedProduct)          { setArmedProduct(null); toast.message('Placement cancelled', { duration: 2000 }); return; }
        setSelId(null); setDrag(null); setOpenCat(null); setOpenType(null);
        setWallStart(null);
        setMeasure({ start: null, end: null, cursor: null });
        setCableDraw((c) => ({ points: [], cursor: null, cableType: c.cableType }));
        resetCalibrate();
        // Mirror the wall + Done button finish flow: if Esc cancels a
        // drawing tool, also flip back to Select so the tool isn't left
        // armed. Without this, Esc cleared the in-flight points but the
        // banner re-appeared as "Click the first vertex" and the next
        // canvas click started a fresh chain.
        if (tool === 'wall' || tool === 'measure' || tool === 'cable' || tool === 'conduit' || tool === 'pathway' || tool === 'calibrate') {
          setTool('select');
        }
      }
      if (e.key === 'Enter' && (tool === 'cable' || tool === 'conduit' || tool === 'pathway') && cableDraw.points.length >= 2) {
        finishCableDraw();
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
        toast.message(`Click canvas to place ${drag.product.mfr} ${drag.product.model}`, {
          description: 'Esc to cancel.',
          duration: 4500,
        });
        return;
      }
      dragStartRef.current = null;
      // ── Drop on a host? ──
      // Compute the host SYNCHRONOUSLY from the pointerup coords + the
      // live devices array. hoverHost (React state set by pointermove)
      // can lag: the move handler may not have flushed for the final
      // cursor position, leading to the prior bug where a tray drop
      // directly over a door created a loose accessory device. The
      // pure helper bypasses that race entirely.
      const dropHost = findHostUnderPointer(e.clientX, e.clientY, r, pan, zoom, devices, drag.product.type);
      if (dropHost) {
        const { host, hostKind, compat } = dropHost;
        if (!compat.allowed) {
          toast.warning(compat.reason ?? 'Not compatible with that host', {
            description: compat.hint,
            duration: 6500,
          });
          setDrag(null); setHoverHost(null);
          return;
        }
        // Door host: drop the dropped product directly into the door's
        // persisted doorAssembly[] instead of spawning a ghost accessory
        // device. The door becomes one system element; the dropped
        // product is consumed (no separate device created). ALSO clear
        // any legacy stack/linkedIds on the door so old data doesn't
        // surface as the "Legacy stack" panel ever again. If the dropped
        // product doesn't map onto a known DoorHardware slot we REJECT
        // the drop — no fallthrough to legacy stack[] for doors.
        if (hostKind === 'door') {
          const hw = productTypeToDoorHardware(drag.product.type);
          if (!hw) {
            toast.warning(`${drag.product.model} isn't door hardware`, {
              description: 'Drop it on the canvas instead, or attach to an IDF / rack.',
              duration: 5000,
            });
            setDrag(null); setHoverHost(null);
            return;
          }
          const cur = (host.doorAssembly ?? []) as DoorHardware[];
          const next = cur.includes(hw) ? cur : [...cur, hw];
          // New hardware defaults to 'proposed' (it's a designer dropping
          // a fresh piece into the schedule). The user can flip it to
          // 'existing' from the Hardware assembly section if it's
          // already-installed gear we're documenting.
          const curState = ((host as any).doorAssemblyState ?? {}) as Partial<Record<DoorHardware, 'proposed' | 'existing'>>;
          const nextState = cur.includes(hw) ? curState : { ...curState, [hw]: 'proposed' as const };
          setDevices((ds) => ds.map((d) => d.id === host.id ? { ...d, doorAssembly: next, doorAssemblyState: nextState, stack: undefined, linkedIds: undefined } : d));
          setSelId(host.id);
          setSelPathwayId(null);
          toast.success(`Added ${hw} to ${host.id}`, {
            description: hw === 'maglock' ? 'Maglocks require a REX for code-compliant egress.' : 'Door assembly updated. Marked as Proposed by default — flip to Existing in the inspector if it\'s already there.',
            duration: 4500,
          });
          setDrag(null); setHoverHost(null);
          return;
        }
        const kind = TYPE_KIND[drag.product.type];
        // Door / opening types get the DR prefix regardless of TYPE_KIND
        // (which maps them under infrastructure → NW). Mirrors the
        // placeProductAt (click-to-arm) path so both placement flows
        // produce the same id shape.
        const dropType = drag.product.type as string;
        const isOpening = dropType.startsWith('inf.door')
          || dropType.startsWith('inf.gate')
          || dropType.startsWith('inf.storefront')
          || dropType.startsWith('inf.doubledoor');
        const prefix = isOpening
          ? 'DR'
          : kind === 'camera'
            ? 'CAM'
            : kind === 'access'
              ? (drag.product.type === 'acc.reader' ? 'RD' : 'DR')
              : 'NW';
        const cohortCount = isOpening
          ? devices.filter((d) => {
              const t = d.type as string;
              return t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor');
            }).length
          : devices.filter((d) => TYPE_KIND[d.type] === kind).length;
        const id = `${prefix}-${100 + cohortCount + 1}`;
        // Offset the new device just outside the host so both glyphs are
        // visible. 22px adjacent to the host center reads as "attached".
        // When attaching to a stackable host (door / gate / elevator), the
        // child device becomes part of the host's `stack[]` — drawn as a tiny
        // count chip on the host glyph and listed in the inspector. The
        // older `linkedIds` channel is still populated so any existing
        // consumer (BOM, AI) keeps working.
        const isStackDrop = isStackableHost(host.type) && isStackAccessory(drag.product.type);
        const newDevice: Device = {
          id, type: drag.product.type, label: drag.product.model, product: drag.product.id,
          x: host.x + 22, y: host.y, rot: 0,
          linkedIds: [host.id],
        };
        setDevices((ds) => ds.map((d) => d.id === host.id
          ? {
              ...d,
              linkedIds: [...(d.linkedIds ?? []), id],
              stack: isStackDrop ? [...(d.stack ?? []), id] : d.stack,
            }
          : d).concat(newDevice));
        setSelId(id);
        toast.success(`Attached ${drag.product.model} to ${host.id}`, {
          description: compat.reason ? undefined : 'Linked and added to BOM',
          duration: 3500,
        });
        if (drag.product.type === 'acc.maglock') {
          // canHost flagged the maglock → REX dependency. Surface it.
          toast.message('Heads up', {
            description: 'A REX (request-to-exit) is required when using a maglock for fire-egress compliance.',
            duration: 6000,
          });
        }
        setDrag(null); setHoverHost(null);
        return;
      }
      // ── Normal floor drop ──
      const rawX = (e.clientX - r.left - pan.x) / zoom;
      const rawY = (e.clientY - r.top  - pan.y) / zoom;
      const x = snap ? Math.round(rawX / 20) * 20 : rawX;
      const y = snap ? Math.round(rawY / 20) * 20 : rawY;
      const kind = TYPE_KIND[drag.product.type];
      // Door / opening types get the DR prefix regardless of TYPE_KIND
      // (which buckets them as infrastructure → NW). Mirrors the
      // placeProductAt (click-to-arm) path so both placement flows
      // produce the same id shape.
      const dropType = drag.product.type as string;
      const isOpening = dropType.startsWith('inf.door')
        || dropType.startsWith('inf.gate')
        || dropType.startsWith('inf.storefront')
        || dropType.startsWith('inf.doubledoor');
      const prefix = isOpening
        ? 'DR'
        : kind === 'camera'
          ? 'CAM'
          : kind === 'access'
            ? (drag.product.type === 'acc.reader' ? 'RD' : 'DR')
            : 'NW';
      // Cable accessory? The product id of a cable-tray accessory
      // starts with `cabacc-`; we surface a friendlier prefix and
      // try to auto-attach to the nearest pathway within 60 plan
      // units so the user gets immediate context.
      const isCableAcc = String(drag.product.id ?? '').startsWith('cabacc-');
      const accKind = isCableAcc ? (String(drag.product.id).split('-')[1] as any) : undefined;
      const cohortCount = isOpening
        ? devices.filter((d) => {
            const t = d.type as string;
            return t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor');
          }).length
        : devices.filter((d) => TYPE_KIND[d.type] === kind).length;
      const id = isCableAcc
        ? `${(accKind ?? 'ACC').toString().toUpperCase()}-${100 + devices.filter((d) => (d as any).accessoryKind).length + 1}`
        : `${prefix}-${100 + cohortCount + 1}`;
      // Find nearest pathway midpoint within 60 units for cable accessories.
      // Patch panels are explicitly skipped here — they belong on an IDF
      // host, not on a pathway. The user can drag them onto the IDF/rack
      // for the existing stack-attach flow.
      let attachedPathwayId: string | undefined;
      const isPatchPanel = accKind === 'pp24' || accKind === 'pp48' || accKind === 'pp-fiber';
      if (isCableAcc && !isPatchPanel) {
        const allP = (Object.values(useProjectStore.getState().pathways) as any[]).filter((p) => p.projectId === (projectId ?? 'p1'));
        let best: { id: string; d: number } | null = null;
        for (const p of allP) {
          const pts = p.points ?? [];
          if (pts.length < 2) continue;
          // Distance from the drop point to the polyline midpoint.
          const mid = { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2 };
          const d = Math.hypot(mid.x - x, mid.y - y);
          if (d < 60 && (!best || d < best.d)) best = { id: p.id, d };
        }
        if (best) {
          attachedPathwayId = best.id;
          // Increment the pathway's accessory tally so BOM rolls it up.
          const ap = (useProjectStore.getState().pathways as any)[best.id];
          if (ap) {
            const next = { ...(ap.accessories ?? {}), [accKind ?? 'jack']: (ap.accessories?.[accKind ?? 'jack'] ?? 0) + 1 };
            useProjectStore.getState().updatePathway(best.id, { accessories: next } as any);
          }
          toast.success(`Attached · ${drag.product.model} → ${best.id}`, { duration: 3500 });
        }
      }
      const newDevice: Device = {
        id, type: drag.product.type,
        label: drag.product.model, product: drag.product.id,
        x, y, rot: 0,
        ...(isCableAcc ? { accessoryKind: accKind, attachedPathwayId } : {}),
      } as Device;
      setDevices((ds) => [...ds, newDevice]);
      setSelId(id);
      setDrag(null); setHoverHost(null);
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
  const deleteSel = () => { if (sel) { setDevices((ds) => ds.filter((d) => d.id !== sel.id)); setSelId(null); } };
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
  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Riverbend HQ', to: `/project/${projectId}` }, { label: 'Canvas' }]}
      fullBleed
    >
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
          @keyframes lens-chip-in {
            from { opacity: 0; transform: translateY(2px); }
            to   { opacity: 1; transform: translateY(0); }
          }
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
            @keyframes lens-chip-in { from { opacity: 1; } to { opacity: 1; } }
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
            projectId={projectId}
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

          <div className="flex-1 min-w-0 relative">
            <CanvasSurface
              ref={surfaceRef}
              tool={tool}
              zoom={zoom}
              pan={pan}
              setPan={setPan}
              onUserTouchView={() => { userTouchedViewRef.current = true; }}
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
              snap={snap}
              dragging={!!drag}
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
                  } else if (!measure.end) {
                    setMeasure({ start: measure.start, end: { x, y }, cursor: { x, y } });
                  } else {
                    setMeasure({ start: { x, y }, end: null, cursor: { x, y } });
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
                  <div className="font-medium text-[11.5px]">Threat Simulator suggested fix</div>
                  <div className="text-muted-foreground">{hardenHint.label}</div>
                  <div className="text-[10.5px] text-muted-foreground/70 mt-0.5 tabular-nums">
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
            <IntelligenceLayer devices={devices.filter((d) => !hiddenIds.has(d.id))} zoom={zoom} open={intelOpen} setOpen={setIntelOpen} />

            {/* Floating selection toolbar */}
            {sel && surfaceRef.current && (
              <SelectionPill
                d={sel}
                zoom={zoom}
                pan={pan}
                onRotate={(r) => updateSel({ rot: r })}
                onDelete={deleteSel}
                onUpdate={updateSel}
                onEdit={() => openTab('overview')}
                onTargetSim={() => setTargetSim({ open: true, x: sel.x + 120, y: sel.y })}
                onDuplicate={duplicateSel}
                onOpenTab={openTab}
                activeLens={activeLens}
                setActiveLens={setActiveLens}
                lensMode={(sel.lensMode ?? 'linked') as LensMode}
                setLensMode={setLensModeForSel}
                onLensHover={setHoveredLens}
                isLocked={lockedIds.has(sel.id)}
                onToggleLock={() => {
                  const next = new Set(lockedIds);
                  if (next.has(sel.id)) next.delete(sel.id);
                  else next.add(sel.id);
                  setLockedIds(next);
                }}
              />
            )}

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
                    <span className="text-[11.5px] font-medium text-foreground leading-tight">{title}</span>
                    <span className="text-[10.5px] text-muted-foreground leading-tight">{subtitle}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={onFinish}
                      disabled={!canFinish}
                      data-testid="tool-status-done"
                      className="text-[10.5px] uppercase tracking-[0.10em] rounded px-2 py-0.5 border border-border bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={isWall ? 'Finish wall chain (Enter)' : isMeasure ? 'Clear measurement' : 'Finish run (Enter)'}
                    >
                      Done
                    </button>
                    <button
                      onClick={onCancel}
                      data-testid="tool-status-cancel"
                      className="text-[10.5px] uppercase tracking-[0.10em] rounded px-2 py-0.5 border border-border text-muted-foreground hover:text-foreground"
                      title="Cancel and return to Select (Esc)"
                    >
                      Cancel (Esc)
                    </button>
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
                  <span className="ml-auto text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground">
                    {Math.round(Math.hypot(calibrate.b.x - calibrate.a.x, calibrate.b.y - calibrate.a.y))} px
                  </span>
                </div>
                <div className="px-3 py-3 space-y-2">
                  <div className="text-[11.5px] text-muted-foreground leading-snug">
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
                      className="flex-1 h-8 px-2 rounded border border-border bg-background text-[12.5px] tabular-nums text-foreground focus:outline-none focus:border-primary/60"
                    />
                    <span className="text-[11px] text-muted-foreground">ft</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      onClick={() => { resetCalibrate(); setTool('select'); }}
                      data-testid="calibrate-cancel"
                      className="text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
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
                      className="text-[10.5px] uppercase tracking-[0.10em] text-primary-foreground bg-primary rounded px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
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
                <span className="text-[11.5px] text-foreground">
                  Click canvas to place <span className="font-medium">{armedProduct.mfr} {armedProduct.model}</span>.
                </span>
                <button
                  onClick={() => { setArmedProduct(null); toast.message('Placement cancelled', { duration: 2000 }); }}
                  className="text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5"
                  data-testid="armed-placement-cancel"
                >
                  Cancel (Esc)
                </button>
              </div>
            )}

            {/* Right-side engineering inspector drawer */}
            {sel && (
              <EditDrawer
                d={sel}
                open={editOpen}
                tab={editTab}
                setTab={setEditTab}
                onClose={() => setEditOpen(false)}
                onUpdate={updateSel}
                activeLens={activeLens}
                setActiveLens={setActiveLens}
                lensMode={(sel.lensMode ?? 'linked') as LensMode}
                setLensMode={setLensModeForSel}
              />
            )}
            {/* PathwayDrawer — opens when a pathway (cable bundle run /
                standalone conduit / J-hook / tray) is clicked on canvas.
                Side panel, not a modal, so the user can edit cable type,
                conduit assignment, terminations, ports, and accessories
                in the standard right-side editing flow. */}
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
            {selPathwayId && (
              <PathwayDrawer
                pathwayId={selPathwayId}
                onClose={() => setSelPathwayId(null)}
                onOpenBundle={(bid) => { setSelPathwayId(null); setBundleInspectorId(bid); }}
              />
            )}

            {/* Target simulation overlay */}
            {/* When a camera is selected, the stick-figure target is the
                signature affordance. We auto-position it at the end of the
                cone the first time a camera is focused (handled via the
                useEffect below). The DORI overlay updates live as the user
                drags the figure. */}
            {sel && targetSim.open && (
              <TargetSimOverlay
                d={sel}
                zoom={zoom}
                pos={targetSim}
                setPos={(p) => setTargetSim({ open: true, ...p })}
                onClose={() => setTargetSim({ open: false, x: 0, y: 0 })}
              />
            )}

            {/* Floating status indicator (top-center) */}
            <StatusBar tool={tool} zoom={zoom} counts={counts} units={units} />

            {/* Black drawing-tool rail — left side of the canvas pane.
                Tools only (no devices). Always visible in Default + Field;
                in Canvas mode a small reopener takes its place. */}
            {viewMode !== 'canvas' && (
              <DrawingToolRail
                tool={tool} setTool={setTool}
                snap={snap} setSnap={setSnap}
                layersOpen={layersOpen} onToggleLayers={() => setLayersOpen((v) => !v)}
                onOpenScanBuild={() => setScanBuildOpen(true)}
                onFit={() => { applyFit();   userTouchedViewRef.current = false; }}
                onCenter={() => { applyCenter(); userTouchedViewRef.current = true; }}
                onActual={() => { applyActualScale(); userTouchedViewRef.current = true; }}
                onSelectAll={(kind) => {
                  const visible = devices.filter((d) => !hiddenIds.has(d.id));
                  let list: Device[] = [];
                  if (kind === 'cameras') list = visible.filter((d) => TYPE_KIND[d.type] === 'camera');
                  if (kind === 'doors')   list = visible.filter((d) => (d.type as string).startsWith('inf.door') || (d.type as string).startsWith('inf.gate') || (d.type as string).startsWith('inf.storefront') || (d.type as string).startsWith('inf.doubledoor'));
                  if (kind === 'readers') list = visible.filter((d) => d.type === 'acc.reader' || d.type === 'acc.keypad');
                  if (kind === 'idfs')    list = visible.filter((d) => d.type === 'net.idf' || d.type === 'net.mdf' || d.type === 'inf.rack' || d.type === 'inf.mdf');
                  setSelIds(new Set(list.map((d) => d.id)));
                  if (list[0]) setSelId(list[0].id);
                  toast.message(`Selected ${list.length} · ${kind} on floor`, { duration: 2500 });
                }}
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

            {/* Bottom Device Bar — horizontal strip with category icons
                that open a tray of placeable items above. Replaces the
                old bottom QuickTools capsule (cursor/hand/ruler/cable). */}
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

            {/* Group toolbar — appears when 2+ devices are selected via
                shift-click. Right side at the top of the canvas. Carries
                the multi-device commands (Run to IDF, clear selection). */}
            {selIds.size >= 2 && viewMode !== 'canvas' && (
              <div
                className="absolute z-30 left-1/2 -translate-x-1/2 top-3 inline-flex items-stretch h-9 rounded-xl border bg-card/95 backdrop-blur-xl shadow-[var(--shadow-medium)] overflow-hidden"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="px-3 inline-flex items-center text-[11.5px] tabular-nums text-foreground border-r border-border/60">
                  <span className="font-medium">{selIds.size}</span><span className="text-muted-foreground ml-1">selected</span>
                </div>
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
                library. When the dock is collapsed (the new default) this
                is the obvious place to click to plot a device. When the
                dock is already open it stays out of the way. */}
            {viewMode !== 'canvas' && (dockCollapsed || viewMode === 'field') && (
              <button
                onClick={() => {
                  if (viewMode === 'field') setViewMode('default');
                  setDockCollapsed(false);
                  setNavSection('devices');
                }}
                data-track="canvas-add-fab"
                title="Add device · open library"
                className="absolute z-30 bottom-20 right-5 h-12 w-12 rounded-full flex items-center justify-center text-white bg-primary hover:bg-primary/90 transition-colors shadow-[0_2px_4px_-1px_rgba(0,0,0,0.18),0_12px_28px_-12px_rgba(0,0,0,0.45)] focus:outline-none focus:ring-2 focus:ring-primary/40"
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

            {/* Zoom dock (bottom-left) */}
            <ZoomDock
              zoom={zoom}
              setZoom={(z) => { setZoom(z); userTouchedViewRef.current = true; }}
              onFit={() => { applyFit(); userTouchedViewRef.current = false; }}
              onCenter={() => { applyCenter(); userTouchedViewRef.current = true; }}
              onActual={() => { applyActualScale(); userTouchedViewRef.current = true; }}
            />

            {/* Minimap (bottom-right) — V1 1A.4 now shows real plan
                extents (background + walls + devices) instead of the
                seed 800x600 rectangle, and uses theme tokens. */}
            <MiniMap devices={devices} walls={allWalls} background={floorBackground ?? null} />

            {/* Static North indicator — drafting-style: a needle inside a
                thin circle with a single "N" tick. It is not interactive;
                site orientation is not editable yet. We keep it small and
                quiet so it reads as a plan annotation, not a HUD widget. */}
            <div className="absolute top-16 right-3 z-20 pointer-events-none select-none">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--panel-background)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--border)',
                }}
                title="North indicator · canvas-up = North"
              >
                <svg viewBox="-12 -16 24 28" width="20" height="22" aria-hidden>
                  {/* Tick at the top of the dial */}
                  <line x1="0" y1="-11" x2="0" y2="-9" stroke="var(--muted-foreground)" strokeWidth="0.8" />
                  {/* North label sits above the tick */}
                  <text y="-13" textAnchor="middle" fill="var(--muted-foreground)" fontSize="5.5" fontWeight="600" fontFamily="ui-sans-serif" letterSpacing="0.3">N</text>
                  {/* Two-tone arrow head: dark north half, hairline south half */}
                  <path d="M 0 -8 L 3 6 L 0 3 Z" fill="var(--foreground)" />
                  <path d="M 0 -8 L -3 6 L 0 3 Z" fill="none" stroke="var(--foreground)" strokeWidth="0.6" />
                </svg>
              </div>
            </div>

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
                  className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 select-none flex items-center gap-1.5"
                  data-testid="scale-bar"
                  style={{
                    background: 'var(--panel-background)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    boxShadow: '0 6px 16px -8px rgba(0,0,0,0.5)',
                  }}
                  title={isCalibrated
                    ? 'Calibrated scale — derived from the floor record'
                    : 'Default scale only — click Set scale to calibrate against a known feature.'}
                >
                  <span className="text-[10px] text-muted-foreground tabular-nums pointer-events-none">0</span>
                  <svg width={zoom * 100} height={10} className="inline-block pointer-events-none">
                    <line x1={0} y1={5} x2={zoom * 100} y2={5} stroke="#E2E8F0" strokeWidth="1.2" />
                    <line x1={0} y1={1} x2={0} y2={9} stroke="#E2E8F0" strokeWidth="1.2" />
                    <line x1={zoom * 100} y1={1} x2={zoom * 100} y2={9} stroke="#E2E8F0" strokeWidth="1.2" />
                    <line x1={zoom * 50} y1={3} x2={zoom * 50} y2={7} stroke="#E2E8F0" strokeWidth="0.8" opacity="0.6" />
                  </svg>
                  <span className="text-[10px] text-muted-foreground tabular-nums pointer-events-none">{ft} ft</span>
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
                      className="text-[9px] uppercase tracking-[0.10em] ml-1 px-1.5 py-px rounded border border-emerald-400/30 bg-emerald-400/12 text-emerald-300 hover:bg-emerald-400/20 transition-colors"
                    >
                      Verified
                    </button>
                  ) : (
                    <>
                      <span className="text-[9px] uppercase tracking-[0.10em] text-amber-300/80 ml-1 pointer-events-none">Default scale</span>
                      <button
                        onClick={() => { resetCalibrate(); setTool('calibrate'); }}
                        title="Click two points on a known feature, then enter its real length"
                        data-testid="scale-set-btn"
                        className="text-[9.5px] uppercase tracking-[0.10em] ml-1 px-1.5 py-0.5 rounded border border-primary/40 bg-primary/12 text-primary hover:bg-primary/20"
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
              className="absolute bottom-1 left-1 z-20 pointer-events-none select-none text-[8.5px] tabular-nums text-muted-foreground/40 font-mono tracking-tight"
              title={`Build ${buildLabel()}`}
            >
              {COMMIT_HASH} · {buildLabel().split('·').slice(-1)[0].trim()}
            </div>

            {/* Drag ghost */}
            {drag && (
              <div className="pointer-events-none absolute z-50" style={{ left: drag.x - 16, top: drag.y - 16 }}>
                <div className="w-8 h-8 rounded-full bg-card border border-primary flex items-center justify-center shadow-lg">
                  <DeviceGlyph type={drag.product.type} size={20} tone={KIND_TONE[TYPE_KIND[drag.product.type]]} />
                </div>
                <div className="mt-1.5 text-[11px] text-center bg-card border border-border rounded px-1.5 py-0.5 text-foreground whitespace-nowrap">
                  Drop to place
                </div>
              </div>
            )}
          </div>
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
    </AppShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ONBOARDING — "How do you want to start?"
   ═══════════════════════════════════════════════════════════════════════ */

function Onboarding({ onPick, onClose }: { onPick: (s: 'blueprint' | 'blank') => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 bg-background/85 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-7 py-5 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">New canvas</div>
            <h2 className="text-xl mt-1">How would you like to start?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pick the source. We'll ask you to set scale once a plan is loaded.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Canvas V2 Pass 1.0 — "Use an address" was removed. It opened
            a mocked geocoding step that resolved any address to a
            sample aerial image. The blueprint and blank paths both
            ship real backing. */}
        <div className="p-5 grid grid-cols-2 gap-3">
          <StartCard
            icon={Upload} title="Upload a blueprint"
            sub="PDF, PNG, or JPG. We'll ask for two reference points to set scale."
            onClick={() => onPick('blueprint')}
          />
          <StartCard
            icon={PencilLine} title="Start blank"
            sub="Sketch walls and rooms with the wall tool. Best for renovations and tenant fit outs."
            onClick={() => onPick('blank')}
          />
        </div>
        <div className="px-5 pb-5 text-xs text-muted-foreground">
          You can change the source later. Site walks, vision scans, and import all attach to whichever you start with.
        </div>
      </div>
    </div>
  );
}

function StartCard({ icon: Icon, title, sub, onClick, accent }: { icon: any; title: string; sub: string; onClick: () => void; accent?: boolean }) {
  return (
    <button onClick={onClick} className={`text-left p-4 rounded-xl border transition-all ${accent ? 'border-primary bg-primary/5 hover:bg-primary/10' : 'border-border hover:border-border-strong bg-background hover:bg-secondary/30'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-3 text-sm">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{sub}</div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   UNDO / REDO BUTTONS — Canvas V2 Pass 1.1
   ═══════════════════════════════════════════════════════════════════════ */

function UndoRedoButtons() {
  const past = useProjectStore((s) => s.canvasHistory.past);
  const future = useProjectStore((s) => s.canvasHistory.future);
  const nextUndo = past[past.length - 1];
  const nextRedo = future[future.length - 1];
  const canUndo = !!nextUndo;
  const canRedo = !!nextRedo;
  const handleUndo = () => {
    const popped = useProjectStore.getState().canvasUndo();
    if (popped) toast.message(`Undo: ${popped.label}`, { duration: 2000 });
  };
  const handleRedo = () => {
    const popped = useProjectStore.getState().canvasRedo();
    if (popped) toast.message(`Redo: ${popped.label}`, { duration: 2000 });
  };
  return (
    <div className="inline-flex items-center gap-0.5 h-8 px-0.5 rounded-lg border border-border bg-background">
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        title={canUndo ? `Undo: ${nextUndo.label}  (⌘Z)` : 'Nothing to undo'}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${canUndo ? 'text-foreground hover:bg-secondary' : 'text-muted-foreground/40 cursor-default'}`}
        data-track="topbar-undo"
        aria-label="Undo"
      >
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleRedo}
        disabled={!canRedo}
        title={canRedo ? `Redo: ${nextRedo.label}  (⇧⌘Z)` : 'Nothing to redo'}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${canRedo ? 'text-foreground hover:bg-secondary' : 'text-muted-foreground/40 cursor-default'}`}
        data-track="topbar-redo"
        aria-label="Redo"
      >
        <Redo2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TOP BAR — floor, scale, scan, setup
   ═══════════════════════════════════════════════════════════════════════ */

function TopBar(props: {
  floor: number; setFloor: (n: number) => void;
  /** Display name of the active floor, read from the store so the badge
   *  is honest. Multi-floor switching is Pass 2 work; until then this
   *  badge is a label, not a picker. */
  floorName: string;
  snap: boolean; setSnap: (b: boolean) => void;
  units: 'ft' | 'm'; setUnits: (u: 'ft' | 'm') => void;
  onScan: () => void; onSetup: () => void;
  techModel: 'cloud' | 'on_prem' | 'hybrid';
  setTechModel: (m: 'cloud' | 'on_prem' | 'hybrid') => void;
  isFullscreen: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
  viewMode: 'default' | 'field' | 'canvas';
  setViewMode: (m: 'default' | 'field' | 'canvas') => void;
  onOpenScanBuild: () => void;
  onOpenReport: () => void;
  onOpenBom: () => void;
  /** Opens the customer / reviewer presentation route. */
  onOpenReview: () => void;
  /** Opens the field deployment / work orders route. */
  onOpenDeployment: () => void;
  /** Opens the reports / proposal package route. */
  onOpenReports: () => void;
  /** Active project id, threaded through so the ProjectStateMenu can
   *  export/import the right project. */
  projectId: string;
  /** Compact = render only the essentials. Used in Field view so the bar
   *  is a thin operations strip rather than a full chrome row. */
  compact?: boolean;
  intelOpen: boolean;
  setIntelOpen: (b: boolean) => void;
  onPopOut: () => void;
}) {
  const canvasTheme = useProjectStore((s) => s.canvasTheme);
  const setCanvasTheme = useProjectStore((s) => s.setCanvasTheme);
  const compact = !!props.compact;
  // Overflow menu — collects secondary controls (theme, presence, intel,
  // pop-out, plan source) so the bar reads as a quiet operations strip.
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [moreOpen]);
  return (
    <div
      className={`shrink-0 border-b border-border bg-background/80 backdrop-blur-md flex items-center pl-3 pr-2 gap-2 text-sm relative z-30 ${compact ? 'h-11' : 'h-12'}`}
    >
      {/* Left — floor + scan/build. Tighter than the previous bar; the project
          title is in the breadcrumb above, so we don't duplicate it here. */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Active floor badge. Static for now — multi floor switching
            lands in Canvas V2 Pass 2 when the floor model gains a real
            selector. Operators see the actual floor name from the
            store, not a hardcoded sample list. */}
        <span
          title="Single floor for now. Multi floor coming."
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border border-border bg-background text-foreground select-none"
          data-track="topbar-floor-label"
        >
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          {props.floorName || 'Floor'}
        </span>
        <UndoRedoButtons />
        <button
          onClick={props.onOpenScanBuild}
          title="Add a floor plan — upload PDF/image, trace satellite, scan demo, or start blank"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
          data-track="topbar-add-plan"
        >
          <Upload className="w-3.5 h-3.5" />Add plan
        </button>
        <button
          onClick={props.onOpenBom}
          title="BOM & Estimate — derived live from the canvas"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border border-border hover:bg-secondary/50 text-foreground transition-colors"
          data-track="topbar-bom"
        >
          <BarChart3 className="w-3.5 h-3.5" />BOM & Estimate
        </button>
        <button
          onClick={props.onOpenReview}
          title="Open the customer / reviewer presentation view of this project"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-500 transition-colors"
          data-track="topbar-review"
        >
          <Presentation className="w-3.5 h-3.5" />Present
        </button>
        <button
          onClick={props.onOpenDeployment}
          title="Open Field Deployment — work orders generated live from the canvas"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 transition-colors"
          data-track="topbar-deploy"
        >
          <HardHat className="w-3.5 h-3.5" />Deploy
        </button>
        <ProjectStateMenu projectId={props.projectId} />
      </div>

      <div className="flex-1" />

      {/* Right — view picker, fullscreen, more menu, AI. */}
      <div className="flex items-stretch h-8 border border-border rounded-lg overflow-hidden">
        {([
          { id: 'default' as const, label: 'Default', icon: Columns3, hint: 'Default — full chrome (rails + dock)' },
          { id: 'field' as const,   label: 'Field',   icon: Square,   hint: 'Field — slim TopBar, no side rails, canvas is the hero' },
          { id: 'canvas' as const,  label: 'Canvas',  icon: Maximize, hint: 'Full Canvas — only floating controls (Esc exits)' },
        ]).map((m) => {
          const active = props.viewMode === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => props.setViewMode(m.id)}
              title={m.hint}
              data-track={`topbar-view-${m.id}`}
              className={`inline-flex items-center gap-1 px-2 text-[11px] border-r border-border last:border-r-0 transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
            >
              <Icon className="w-3.5 h-3.5" />{!compact && m.label}
            </button>
          );
        })}
      </div>
      <button
        onClick={props.isFullscreen ? props.onExitFullscreen : props.onEnterFullscreen}
        title={props.isFullscreen ? 'Exit fullscreen' : 'Fullscreen monitor'}
        className={`inline-flex items-center justify-center h-8 w-8 rounded-lg border transition-colors ${props.isFullscreen ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:bg-secondary text-muted-foreground hover:text-foreground'}`}
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>

      {/* Overflow menu — secondary controls (theme picker, intelligence,
          pop-out, plan source, presence). Keeps the visible bar quiet
          while the engineer still has one click away from anything they
          might need. */}
      <div className="relative" ref={moreRef}>
        <button
          onClick={() => setMoreOpen((v) => !v)}
          title="More options"
          data-track="topbar-more"
          className={`inline-flex items-center justify-center h-8 w-8 rounded-lg border transition-colors ${moreOpen ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {moreOpen && (
          <div
            className="absolute right-0 top-9 z-40 w-[260px] rounded-xl overflow-hidden"
            style={{
              background: 'var(--panel-background)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border)',
              boxShadow: '0 22px 48px -16px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.04)',
            }}
          >
            {/* Theme picker */}
            <div className="px-3 pt-3 pb-2 border-b border-border/60">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Theme</div>
              <div className="flex items-stretch border border-border/60 rounded-md overflow-hidden">
                {(['light', 'slate', 'dark'] as const).map((t) => {
                  const active = canvasTheme === t;
                  const label = t === 'light' ? 'Drafting' : t === 'slate' ? 'Slate' : 'Dark';
                  return (
                    <button
                      key={t}
                      onClick={() => setCanvasTheme(t)}
                      className={`flex-1 text-[11px] py-1.5 transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                      data-track={`topbar-more-theme-${t}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reports — moved here from the visible top bar in V1 P0.4. */}
            <button
              onClick={() => { setMoreOpen(false); props.onOpenReports(); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors"
              data-track="topbar-more-reports"
            >
              <FileTextIcon className="w-3.5 h-3.5 text-sky-500" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px]">Reports</div>
                <div className="text-[10.5px] text-muted-foreground">Proposal package generated from the canvas</div>
              </div>
            </button>

            {/* Snap toggle — moved here from the visible top bar + the
                drawing rail (both duplicates removed in V1 P0.4). */}
            <button
              onClick={() => { props.setSnap(!props.snap); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors border-t border-border/40"
              data-track="topbar-more-snap"
            >
              <Magnet className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px]">Snap to grid</div>
                <div className="text-[10.5px] text-muted-foreground">{props.snap ? 'Vertices round to the 20 px grid.' : 'Free placement at sub grid precision.'}</div>
              </div>
              <span className={`text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded ${props.snap ? 'bg-primary/15 text-primary' : 'bg-secondary/40 text-muted-foreground'}`}>
                {props.snap ? 'On' : 'Off'}
              </span>
            </button>

            {/* Intelligence toggle */}
            <button
              onClick={() => { props.setIntelOpen(!props.intelOpen); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors border-t border-border/40"
              data-track="topbar-more-intel"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px]">AI Intelligence</div>
                <div className="text-[10.5px] text-muted-foreground">{props.intelOpen ? 'Chips + assistant visible' : 'Off — canvas stays calm'}</div>
              </div>
              <span className={`text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded ${props.intelOpen ? 'bg-primary/15 text-primary' : 'bg-secondary/40 text-muted-foreground'}`}>
                {props.intelOpen ? 'On' : 'Off'}
              </span>
            </button>

            {/* Report Builder — the new first-class export entry */}
            <button
              onClick={() => { setMoreOpen(false); props.onOpenReport(); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors"
              data-track="topbar-more-report"
            >
              <FileBarChart className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[12px]">Report Builder</span>
            </button>

            {/* Plan source */}
            <button
              onClick={() => { setMoreOpen(false); props.onSetup(); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors"
              data-track="topbar-more-plan"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[12px]">Plan source</span>
            </button>

            {/* Pop-out */}
            <button
              onClick={() => { setMoreOpen(false); props.onPopOut(); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors"
              data-track="topbar-more-popout"
            >
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[12px]">Open in new window</span>
            </button>

            {/* Demo scan — relabelled + always under More so it cannot be
                mistaken for the real Surveyor entrypoint. The /visionscan
                route is a simulated walkthrough, not a live capture. */}
            <button
              onClick={() => { setMoreOpen(false); props.onScan(); }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-secondary/40 transition-colors border-t border-border/60"
              data-track="topbar-more-scan"
            >
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[12px]">Demo scan</span>
              <span className="ml-auto text-[8.5px] uppercase tracking-[0.14em] px-1 py-px rounded bg-amber-400/15 text-amber-300 border border-amber-400/25">
                Demo only
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Inline Demo scan button removed from the primary TopBar row.
          The simulated AR/LiDAR walkthrough lives under TopBar → More →
          "Demo scan" (Demo only). Keeping it inline made it read as the
          real Surveyor entrypoint. */}
    </div>
  );
}

function SegButton({ active, onClick, icon: Icon, label, hint }: { active?: boolean; onClick: () => void; icon: any; label: string; hint?: string }) {
  return (
    <button
      onClick={onClick}
      title={hint ? `${label} · ${hint}` : label}
      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs transition-colors ${active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
    >
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );
}

function Avatar({ initials, tone }: { initials: string; tone: string }) {
  return (
    <div
      title={initials}
      className="w-7 h-7 rounded-full border-2 border-background text-[10px] font-medium text-white flex items-center justify-center"
      style={{ background: tone }}
    >{initials}</div>
  );
}

function PillBtn({ children, active, onClick, icon: Icon }: { children: React.ReactNode; active?: boolean; onClick: () => void; icon?: any }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}{children}
    </button>
  );
}
function IconBtn({ children, title, onClick }: { children: React.ReactNode; title?: string; onClick?: () => void }) {
  return <button title={title} onClick={onClick} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">{children}</button>;
}

function Dropdown({ label, options, onPick }: { label: string; options: string[]; onPick: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-secondary text-sm">
        {label}<ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 min-w-[200px] bg-popover border border-border rounded-xl shadow-xl py-1.5">
            {options.map((o, i) => (
              <button key={o} onClick={() => { onPick(i); setOpen(false); }} className="w-full text-left text-sm px-3 py-2 hover:bg-secondary">{o}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   INSERT DOCK — 56px rail, click a category to drawer it open
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   LEFT NAV RAIL — Project / Devices / Recording / Accessories / Maps / Reports / Docs
   ═══════════════════════════════════════════════════════════════════════ */

const NAV_ITEMS: Array<{ id: 'overview' | 'devices' | 'recording' | 'accessories' | 'other' | 'maps' | 'reports' | 'docs'; label: string; icon: any }> = [
  { id: 'overview',    label: 'Project overview', icon: Grid3x3 },
  { id: 'devices',     label: 'Devices',          icon: Video },
  { id: 'recording',   label: 'Recording',        icon: Server },
  { id: 'accessories', label: 'Accessories',      icon: Cable },
  { id: 'other',       label: 'Other',            icon: MoreHorizontal },
  { id: 'maps',        label: 'Maps',             icon: MapPin },
  { id: 'reports',     label: 'Reports',          icon: FileText },
  { id: 'docs',        label: 'Documentation',    icon: FileText },
];

function LeftNavRail({ section, setSection }: { section: string; setSection: (s: any) => void }) {
  // Narrowed from 88px → 56px in the chrome-reduction pass. Icon-only with a
  // tooltip on hover; labels still appear when the user pauses. Saves 32px
  // of horizontal canvas real estate without losing nav clarity.
  return (
    <div className="w-[56px] shrink-0 border-r border-border bg-card flex flex-col py-2.5">
      {NAV_ITEMS.map((it) => {
        const active = section === it.id;
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            onClick={() => setSection(it.id)}
            title={it.label}
            className={`relative mx-1.5 mb-1 py-2.5 rounded-lg flex items-center justify-center transition-colors ${active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
          >
            <Icon className="w-[18px] h-[18px]" strokeWidth={1.7} />
            {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SECTION PANEL — content for non-Devices nav sections
   ═══════════════════════════════════════════════════════════════════════ */

function MapsPanel({ onOpenScanBuild }: { onOpenScanBuild?: () => void }) {
  // SITE_BUILDINGS is the seed. The user can add new buildings and floors
  // through this panel; both flows mutate local state so the additions show
  // up immediately. (When the full site/building/floor store is wired up,
  // this state moves there. For now the panel is self-contained but real.)
  const [buildings, setBuildings] = useState<SiteBuilding[]>(SITE_BUILDINGS);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['bld-a', 'bld-c']));
  const [activeFloor, setActiveFloor] = useState<string>('a-g');
  const [addBuildingOpen, setAddBuildingOpen] = useState(false);
  const [addFloorTo, setAddFloorTo] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const totalFloors = buildings.reduce((n, b) => n + b.floors.length, 0);
  const sourceIcon = (s: SiteFloor['source']) => s === 'blueprint' ? FileText : s === 'satellite' ? MapIcon : PencilLine;
  const sourceLabel = (s: SiteFloor['source']) => s === 'blueprint' ? 'Blueprint' : s === 'satellite' ? 'Satellite' : 'Sketch';

  const handleAddBuilding = (name: string, address: string) => {
    const id = `bld-${Date.now().toString(36).slice(-5)}`;
    const groundId = `${id}-g`;
    const newBuilding: SiteBuilding = {
      id, name, address,
      floors: [{ id: groundId, name: 'Ground floor', deviceCount: 0, updated: 'just now', source: 'blank' as any }],
    };
    setBuildings((bs) => [...bs, newBuilding]);
    setExpanded((s) => { const n = new Set(s); n.add(id); return n; });
    setActiveFloor(groundId);
    toast.success(`Added building · ${name}`, { description: 'Default ground floor created. Open the floor to start placing devices.', duration: 4500 });
  };

  const handleAddFloor = (buildingId: string, name: string, source: SiteFloor['source']) => {
    const fid = `${buildingId}-f${Date.now().toString(36).slice(-4)}`;
    setBuildings((bs) => bs.map((b) =>
      b.id === buildingId
        ? { ...b, floors: [...b.floors, { id: fid, name, deviceCount: 0, updated: 'just now', source }] }
        : b
    ));
    setActiveFloor(fid);
    toast.success(`Added floor · ${name}`, { duration: 3500 });
  };

  return (
    <div className="w-[360px] shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="text-[13px] font-semibold tracking-tight">Maps</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{buildings.length} buildings · {totalFloors} floor maps</div>
      </div>

      {/* Primary entry — Scan / Build Floorplan. The four-way workflow
          (scan / upload / satellite / sketch) is the obvious first step
          on any project, so it lives at the top of the Maps panel. */}
      {onOpenScanBuild && (
        <div className="px-3 pt-2 pb-1.5 border-b border-border">
          <button
            onClick={onOpenScanBuild}
            data-track="maps-scan-build"
            className="w-full inline-flex items-center justify-center gap-2 text-[12px] h-9 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_1px_2px_rgba(0,0,0,0.4)]"
          >
            <ScanLine className="w-3.5 h-3.5" /> Scan / Build Floorplan
          </button>
          <div className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Camera scan · upload · satellite trace · sketch
          </div>
        </div>
      )}

      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <button
          onClick={() => setAddBuildingOpen(true)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] h-7 rounded-lg border border-border hover:bg-secondary/30 transition-colors"
        >
          <Plus className="w-3 h-3" /> Add building
        </button>
        <button
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 text-[11px] h-7 px-2.5 rounded-lg border border-border hover:bg-secondary/30 transition-colors"
          title="Import a PNG, JPG, or PDF floorplan onto the active floor"
        >
          <Upload className="w-3 h-3" /> Import
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {buildings.map((b) => {
          const open = expanded.has(b.id);
          const buildingDevices = b.floors.reduce((n, f) => n + f.deviceCount, 0);
          return (
            <div key={b.id} className="border-b border-border/50">
              <button onClick={() => toggle(b.id)} className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-secondary/40 text-left">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{b.name}</div>
                  <div className="text-[10.5px] text-muted-foreground truncate">{b.address}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10.5px] text-muted-foreground">{b.floors.length} floors</div>
                  <div className="text-[10px] text-muted-foreground/70">{buildingDevices} devices</div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground ml-1 transition-transform ${open ? '' : '-rotate-90'}`} />
              </button>

              {open && (
                <div className="pb-2">
                  {b.floors.map((f, i) => {
                    const active = activeFloor === f.id;
                    const SrcIcon = sourceIcon(f.source);
                    const isLast = i === b.floors.length - 1;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setActiveFloor(f.id)}
                        className={`w-full text-left pl-4 pr-3 py-2 flex items-center gap-2 transition-colors ${active ? 'bg-primary/8' : 'hover:bg-secondary/40'}`}
                      >
                        {/* Tree connector */}
                        <div className="relative w-5 h-5 shrink-0">
                          <div className={`absolute left-2 top-0 ${isLast ? 'h-1/2' : 'h-full'} w-px bg-border`} />
                          <div className="absolute left-2 top-1/2 w-3 h-px bg-border" />
                        </div>
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${active ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground'}`}>
                          <SrcIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] flex items-center gap-1.5">
                            <span className="truncate">{f.name}</span>
                            {active && <span className="text-[9px] uppercase tracking-wide text-primary">on canvas</span>}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">{sourceLabel(f.source)} · {f.deviceCount} devices · {f.updated}</div>
                        </div>
                      </button>
                    );
                  })}
                  <div className="pl-9 pr-3 pt-1">
                    <button
                      onClick={() => setAddFloorTo(b.id)}
                      className="text-[10.5px] text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add floor map to {b.name.split(' — ')[0]}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground flex items-center gap-1.5 bg-secondary/20">
        <MapIcon className="w-3 h-3" /> Click a floor to load it onto the canvas
      </div>

      {addBuildingOpen && (
        <AddBuildingDialog
          onClose={() => setAddBuildingOpen(false)}
          onSubmit={(name, address) => { handleAddBuilding(name, address); setAddBuildingOpen(false); }}
        />
      )}
      {addFloorTo && (
        <AddFloorDialog
          buildingName={buildings.find((b) => b.id === addFloorTo)?.name ?? 'Building'}
          onClose={() => setAddFloorTo(null)}
          onSubmit={(name, source) => { handleAddFloor(addFloorTo, name, source); setAddFloorTo(null); }}
        />
      )}
      {importOpen && (
        <ImportFloorplanDialog
          onClose={() => setImportOpen(false)}
          onImported={() => setImportOpen(false)}
          onStartCalibrate={() => {
            // Hand the user straight into the in-canvas Calibrate tool
            // right after they save the upload. Closing the modal first
            // lets the tool-status banner read cleanly under TopBar.
            setImportOpen(false);
            resetCalibrate();
            setTool('calibrate');
          }}
        />
      )}
    </div>
  );
}

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
  onClose, devices, projectId,
}: { onClose: () => void; devices: Device[]; projectId: string }) {
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
      drawReport(doc, kind, devices, projectId);
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
                      <div className={`text-[12.5px] font-medium ${active ? 'text-foreground' : 'text-foreground'}`}>{t.label}</div>
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
                        <div className="text-[10.5px] text-muted-foreground">{opt.hint}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.10em] text-muted-foreground">Preview summary</div>
                <div className="text-[10.5px] text-muted-foreground">
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

/* ═══════════════════════════════════════════════════════════════════════
   BUNDLE INSPECTOR DIALOG — opens when the user clicks a bundle label
   on the canvas. Shows the individual runs, conduit assignment, fill
   calc + recommendation, and per-run terminations (patch panel + switch
   port). All edits write back to the store so refresh persists.
   ═══════════════════════════════════════════════════════════════════════ */

const EMT_SIZES: { size: string; areaIn2: number }[] = [
  { size: '1/2"',   areaIn2: 0.304 },
  { size: '3/4"',   areaIn2: 0.533 },
  { size: '1"',     areaIn2: 0.864 },
  { size: '1-1/4"', areaIn2: 1.496 },
  { size: '1-1/2"', areaIn2: 2.036 },
  { size: '2"',     areaIn2: 3.356 },
];
const CABLE_OD_IN: Record<string, number> = {
  cat5e: 0.21, cat6: 0.24, cat6a: 0.31, fiber: 0.20,
  '18/2': 0.21, '18/4': 0.27, '22/6': 0.32, speaker: 0.24,
  fire: 0.27, coax: 0.27,
};
function computeBundleFill(count: number, cableType: string, conduitSize?: string): { fillPct: number; rule: number; recommended?: string; passes: boolean; totalAreaIn2: number; conduitAreaIn2?: number } {
  const ct = String(cableType ?? 'cat6a').toLowerCase();
  const od = CABLE_OD_IN[ct] ?? 0.31;
  const totalArea = count * Math.PI * (od / 2) ** 2;
  const rule = count <= 1 ? 0.53 : count === 2 ? 0.31 : 0.40;
  const recommendedRow = EMT_SIZES.find((e) => totalArea / e.areaIn2 <= rule);
  const recommended = recommendedRow?.size;
  if (!conduitSize) {
    return { fillPct: 0, rule, recommended, passes: true, totalAreaIn2: totalArea };
  }
  const row = EMT_SIZES.find((e) => e.size === conduitSize);
  if (!row) return { fillPct: 0, rule, recommended, passes: true, totalAreaIn2: totalArea };
  const fillPct = (totalArea / row.areaIn2) * 100;
  return { fillPct, rule, recommended, passes: fillPct / 100 <= rule, totalAreaIn2: totalArea, conduitAreaIn2: row.areaIn2 };
}

function BundleInspectorDialog({ bundleId, onClose }: { bundleId: string; onClose: () => void }) {
  const pathways = useProjectStore((s) => s.pathways);
  const devices = useProjectStore((s) => s.devices);
  const floors = useProjectStore((s) => s.floors);
  const updatePathway = useProjectStore((s) => s.updatePathway);
  const removePathway = useProjectStore((s) => s.removePathway);
  const runs = useMemo(
    () => (Object.values(pathways) as any[]).filter((p) => p?.bundleId === bundleId),
    [pathways, bundleId],
  );
  const first = runs[0];
  const cableType = String(first?.cableType ?? 'cat6a');
  const targetId = first?.targetId ?? first?.destinationId ?? '—';
  const totalLen = runs.reduce((s, p) => s + pathwayLengthFt(p, floors[p.floorId ?? '']), 0);
  const conduitType = first?.conduitType ?? 'none';
  const conduitSize = first?.conduitSize;
  const fill = computeBundleFill(runs.length, cableType, conduitSize);
  // Assign patch / switch ports sequentially per-bundle so the schedule
  // is honest and stable. The dialog writes the assignments to the
  // store so the IDF drawer sees them.
  const assignPorts = () => {
    runs.forEach((p, i) => {
      updatePathway(p.id, { patchPort: i + 1, switchPort: i + 1 });
    });
    toast.success('Ports assigned', { description: `${runs.length} runs assigned to ports 01–${String(runs.length).padStart(2, '0')}.`, duration: 3500 });
  };
  const setConduit = (type: any, size?: string) => {
    const next = type === 'none' ? { conduitType: undefined, conduitSize: undefined } : { conduitType: type, conduitSize: size };
    runs.forEach((p) => updatePathway(p.id, next as any));
  };
  const applyRecommendation = () => {
    if (!fill.recommended) return;
    setConduit('EMT', fill.recommended);
    toast.success(`Conduit set · EMT ${fill.recommended}`, { description: 'Fill recalculated for the recommended trade size.', duration: 3500 });
  };
  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[860px] max-w-full max-h-[88vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 pt-4 pb-3 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <Cable className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight">Cable bundle · {bundleId}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {runs.length}× {cableType.toUpperCase()} → {targetId} · total <span className="tabular-nums">{Math.round(totalLen)} ft</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-5 gap-0 divide-x divide-border">
          {/* Left — individual runs */}
          <div className="col-span-3 p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Individual runs · {runs.length}</div>
              <button
                onClick={assignPorts}
                data-track="bundle-assign-ports"
                className="text-[11px] px-2.5 h-7 rounded-md border border-border hover:bg-secondary/40 text-foreground"
              >
                Assign ports sequentially
              </button>
            </div>
            <div className="space-y-1.5">
              {runs.map((p, i) => {
                const src = devices[p.sourceId ?? ''] as any;
                return (
                  <div key={p.id} className="rounded-md border border-border bg-background px-3 py-2 flex items-center gap-3 text-[11.5px]">
                    <span className="text-muted-foreground tabular-nums w-6">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{src?.id ?? p.sourceId ?? p.id} → {targetId}</div>
                      <div className="text-[10.5px] text-muted-foreground">
                        {pathwayLengthFt(p, floors[p.floorId ?? ''])} ft · {String(p.cableType ?? cableType).toUpperCase()}
                        {p.patchPort && <> · PP-01 Port {String(p.patchPort).padStart(2, '0')}</>}
                        {p.switchPort && <> · SW-01 Port {String(p.switchPort).padStart(2, '0')}</>}
                      </div>
                    </div>
                    <button
                      onClick={() => { removePathway(p.id); toast.message('Run removed', { description: `${src?.id ?? p.sourceId} detached from bundle.`, duration: 3000 }); }}
                      title="Remove run"
                      data-track={`bundle-run-remove-${p.id}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right — conduit + fill + assist */}
          <div className="col-span-2 p-4 space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Conduit type</div>
              <div className="flex flex-wrap gap-1">
                {(['none','EMT','PVC','FMC','LFMC','tray'] as const).map((t) => {
                  const active = conduitType === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setConduit(t, conduitSize)}
                      data-track={`bundle-conduit-type-${t}`}
                      className={`text-[11px] px-2 py-1 rounded border transition-colors ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                    >
                      {t === 'none' ? 'None' : t}
                    </button>
                  );
                })}
              </div>
            </div>

            {conduitType !== 'none' && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Trade size</div>
                <div className="grid grid-cols-3 gap-1">
                  {EMT_SIZES.map((e) => {
                    const active = conduitSize === e.size;
                    return (
                      <button
                        key={e.size}
                        onClick={() => setConduit(conduitType, e.size)}
                        data-track={`bundle-conduit-size-${e.size.replace(/\W/g, '')}`}
                        className={`text-[11px] py-1 rounded border transition-colors ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                      >
                        {e.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-md border border-border bg-background p-3">
              <div className="flex items-baseline justify-between">
                <div className="text-[11px] uppercase tracking-[0.10em] text-muted-foreground">Conduit fill</div>
                <div className="text-[10.5px] text-muted-foreground">{(fill.rule * 100).toFixed(0)}% rule</div>
              </div>
              <div className="mt-1.5">
                {conduitSize ? (
                  <>
                    <div className="text-[20px] font-medium tabular-nums" style={{ color: fill.passes ? '#4FB87E' : '#E5A23A' }}>{fill.fillPct.toFixed(1)}%</div>
                    <div className="text-[10.5px] text-muted-foreground mt-0.5">
                      {runs.length}× OD {CABLE_OD_IN[cableType.toLowerCase()] ?? 0.31}″ · area {fill.totalAreaIn2.toFixed(3)} in² / conduit {fill.conduitAreaIn2?.toFixed(3)} in²
                    </div>
                    {!fill.passes && (
                      <div className="mt-2 text-[11px] text-amber-200 bg-amber-300/8 border border-amber-300/25 rounded-md p-2">
                        Overfilled. {fill.recommended ? <>Recommend <span className="font-medium">EMT {fill.recommended}</span> or split the bundle.</> : 'Split the bundle — no standard EMT in stock satisfies the rule.'}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-[11.5px] text-muted-foreground">Pick a conduit size above to compute fill.</div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-primary/30 bg-primary/8 p-3">
              <div className="flex items-baseline justify-between">
                <div className="text-[11px] uppercase tracking-[0.10em] text-primary">Deeper Vision Assist</div>
              </div>
              <div className="text-[11.5px] text-foreground mt-1.5">
                {fill.recommended
                  ? <>{runs.length} × {cableType.toUpperCase()} fits cleanly in <span className="font-medium">EMT {fill.recommended}</span> under the {(fill.rule * 100).toFixed(0)}% NEC rule. Apply to write this conduit on every run in the bundle.</>
                  : <>No standard EMT in stock satisfies the {(fill.rule * 100).toFixed(0)}% rule. Split this bundle into two pathways or step up to PVC / cable tray.</>}
              </div>
              {fill.recommended && (
                <button
                  onClick={applyRecommendation}
                  data-track="bundle-apply-recommendation"
                  className="mt-2 text-[11.5px] font-medium px-3 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                >
                  Apply EMT {fill.recommended}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end">
          <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   RUN-TO-IDF DIALOG — pick target IDF + cable type + route method.
   Creates one pathway record per selected device, all routed to the
   chosen IDF. Marks each path with a shared bundleId so the canvas
   can render the bundle line + label.
   ═══════════════════════════════════════════════════════════════════════ */

function RunToIdfDialog({
  onClose, selected, idfs, projectId, onCreated,
}: {
  onClose: () => void;
  selected: Device[];
  idfs: Device[];
  projectId: string;
  onCreated: (bundleId: string, count: number, cableType: string, idfId: string) => void;
}) {
  const [targetIdfId, setTargetIdfId] = useState<string>(idfs[0]?.id ?? '');
  const [cableType, setCableType] = useState<CableTypeId>('cat6a');
  const [method, setMethod] = useState<'home' | 'bundle' | 'existing' | 'new'>('bundle');
  const addPathway = useProjectStore((s) => s.addPathway);
  const target = idfs.find((i) => i.id === targetIdfId);
  // Length estimator — sum of straight-line distances from each device to
  // the IDF, plus 10% slack + a 3 ft service loop per termination.
  const totalLengthFt = useMemo(() => {
    if (!target) return 0;
    const _state = useProjectStore.getState();
    const _floor = storeSelectors.firstFloorOfProject(_state, projectId);
    const pxToFt = ftPerPxForFloor(_floor);
    let sum = 0;
    selected.forEach((d) => {
      sum += Math.hypot(target.x - d.x, target.y - d.y) * pxToFt * 1.1 + 3;
    });
    return Math.round(sum);
  }, [selected, target, projectId]);
  const handleRun = () => {
    if (!target) return;
    const _state = useProjectStore.getState();
    const _floor = storeSelectors.firstFloorOfProject(_state, projectId);
    const pxToFt = ftPerPxForFloor(_floor);
    const bundleId = `BUN-${Date.now().toString(36).slice(-5)}`.toUpperCase();
    selected.forEach((d) => {
      addPathway({
        projectId,
        floorId: (d as any).floorId ?? '',
        cableType,
        points: [{ x: d.x, y: d.y }, { x: target.x, y: target.y }],
        lengthFt: Math.round(Math.hypot(target.x - d.x, target.y - d.y) * pxToFt * 1.1 + 3),
        bundleId,
        sourceId: d.id,
        targetId: target.id,
      } as any);
    });
    onCreated(bundleId, selected.length, cableType.toUpperCase(), target.id);
  };
  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[560px] max-w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <Cable className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight">Run to IDF</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              Create cable runs from {selected.length} selected device{selected.length === 1 ? '' : 's'} to a target IDF.
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Target IDF */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Target IDF / Rack</div>
            {idfs.length === 0 ? (
              <div className="text-[11.5px] text-amber-300/90 bg-amber-300/8 border border-amber-300/25 rounded px-2.5 py-2">
                No IDF on this floor. Place one from the bottom Network tray first.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {idfs.map((i) => {
                  const active = targetIdfId === i.id;
                  return (
                    <button
                      key={i.id}
                      onClick={() => setTargetIdfId(i.id)}
                      data-track={`run-target-${i.id}`}
                      className={`text-left px-3 py-2 rounded-md border text-[12px] transition-colors ${active ? 'border-primary/40 bg-primary/8 text-foreground' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                    >
                      <div className="font-medium">{i.id}</div>
                      <div className="text-[10.5px] text-muted-foreground">{i.type.split('.').pop()}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cable type */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Cable type</div>
            <div className="flex items-stretch flex-wrap gap-1">
              {(CABLE_TYPES as any[]).slice(0, 8).map((c) => {
                const active = cableType === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCableType(c.id)}
                    data-track={`run-cable-${c.id}`}
                    className={`text-[11px] px-2.5 py-1.5 rounded border transition-colors ${active ? 'border-primary/40 bg-primary/8 text-foreground' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Route method */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Route method</div>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { id: 'home',     label: 'Direct home run',   hint: 'Each device gets its own pathway.' },
                { id: 'bundle',   label: 'Bundled pathway',   hint: 'One labelled bundle, individual runs inside.' },
                { id: 'existing', label: 'Existing conduit',  hint: 'Drop into an already-routed conduit.' },
                { id: 'new',      label: 'New conduit',       hint: 'Create a conduit to match the bundle.' },
              ] as const).map((r) => {
                const active = method === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setMethod(r.id)}
                    title={r.hint}
                    data-track={`run-method-${r.id}`}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition-colors ${active ? 'border-primary/40 bg-primary/8 text-foreground' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                  >
                    <div className="font-medium">{r.label}</div>
                    <div className="text-[10.5px] text-muted-foreground">{r.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-md border border-border bg-background p-3 text-[11.5px] text-muted-foreground">
            <div className="font-medium text-foreground">{selected.length}× {cableType.toUpperCase()} → {target?.id ?? '—'}</div>
            <div className="mt-1">Estimated total cable: <span className="tabular-nums text-foreground">{totalLengthFt} ft</span> · includes 10 % slack + 3 ft service loop per termination.</div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40">Cancel</button>
          <button
            onClick={handleRun}
            disabled={!target || selected.length === 0}
            data-track="run-confirm"
            className="text-[12px] font-medium px-3.5 h-8 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Cable className="w-3.5 h-3.5" />Create bundle
          </button>
        </div>
      </div>
    </div>
  );
}

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
                  <div className="mt-1 text-[10.5px] text-amber-300/85 bg-amber-300/10 border border-amber-300/25 rounded px-2 py-1 flex items-start gap-1.5">
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
function AddBuildingDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (name: string, address: string) => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const valid = name.trim().length > 1;
  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[400px] bg-card border border-border rounded-xl shadow-2xl">
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <div className="text-[14px] font-medium tracking-tight">Add building</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">A building hosts one or more floor maps. You can add floors after.</div>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Building name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Building D — Annex"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 h-9 text-[13px] focus:outline-none focus:border-primary/60"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Address (optional)</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="600 Industrial Way"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 h-9 text-[13px] focus:outline-none focus:border-primary/60"
            />
          </label>
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={() => valid && onSubmit(name.trim(), address.trim())}
            disabled={!valid}
            className={`text-[12px] px-3 h-8 rounded-md transition-opacity ${valid ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-secondary text-muted-foreground cursor-not-allowed'}`}
          >
            Add building
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal for adding a floor to an existing building. Captures the floor name
 *  and the source (blueprint upload, satellite trace, hand sketch, or blank).
 *  Source picker is symbolic for now; the floor lands with that label and a
 *  zero device-count, ready to be opened on the canvas. */
function AddFloorDialog({ buildingName, onClose, onSubmit }: {
  buildingName: string;
  onClose: () => void;
  onSubmit: (name: string, source: SiteFloor['source']) => void;
}) {
  const [name, setName] = useState('');
  const [source, setSource] = useState<SiteFloor['source']>('blueprint');
  const valid = name.trim().length > 0;
  // Canvas V2 Pass 1.0 — satellite source removed. The render branch
  // (line ~7056) ships a simulated aerial with a "Simulated" badge;
  // a real tile provider lands in a later pass. Until then, only the
  // honest sources (real upload or sketch) are pickable.
  const SOURCES: { id: SiteFloor['source']; label: string; hint: string }[] = [
    { id: 'blueprint',  label: 'Blueprint',  hint: 'Upload a PDF or image' },
    { id: 'sketch',     label: 'Sketch',     hint: 'Hand draw a layout on canvas' },
  ];
  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[420px] bg-card border border-border rounded-xl shadow-2xl">
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <div className="text-[14px] font-medium tracking-tight">Add floor map</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Adds a floor to <span className="text-foreground">{buildingName}</span>.</div>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Floor name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Level 4"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 h-9 text-[13px] focus:outline-none focus:border-primary/60"
            />
          </label>
          <div>
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Source</span>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSource(s.id)}
                  className={`text-left p-2 rounded-md border transition-colors ${source === s.id ? 'border-primary/60 bg-primary/8' : 'border-border hover:bg-secondary/30'}`}
                >
                  <div className="text-[12px] font-medium">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{s.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={() => valid && onSubmit(name.trim(), source)}
            disabled={!valid}
            className={`text-[12px] px-3 h-8 rounded-md transition-opacity ${valid ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-secondary text-muted-foreground cursor-not-allowed'}`}
          >
            Add floor
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal that takes a PNG / JPG / PDF and turns it into a Floor.background.
 *  PNG / JPG are read directly via FileReader + downscaled. PDF first page
 *  is rendered with pdfjs-dist. DWG / DXF are surfaced as disabled options
 *  with the honest message that a backend parser is required. */
function ImportFloorplanDialog({ onClose, onImported, onStartCalibrate }: { onClose: () => void; onImported: () => void; onStartCalibrate?: () => void }) {
  const { projectId = 'p1' } = useParams();
  const setFloorBackground = useProjectStore((s) => s.setFloorBackground);
  const updateFloor = useProjectStore((s) => s.updateFloor);
  const floor = useProjectStore((s) => storeSelectors.firstFloorOfProject(s, projectId) as any);
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
                  <div className="text-[12.5px] font-medium">{busy ? 'Processing…' : 'Pick a file'}</div>
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
                  <div className="text-[10.5px] text-muted-foreground uppercase tracking-[0.10em] mb-1">Plan name</div>
                  <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    onBlur={commitPlanName}
                    placeholder="Ground floor — east wing"
                    data-testid="import-name-input"
                    className="w-full h-8 px-2 rounded border border-border bg-background text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
                  />
                </label>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="text-[10.5px] uppercase tracking-[0.10em]">Floor</span>
                  <span className="text-foreground">{buildingName ? `${buildingName} · ` : ''}{floorName}</span>
                  <span className="ml-auto text-[10px] italic">Multi-floor switching is one project view away — this pass writes to the active floor.</span>
                </div>
              </div>
            </div>
          )}

          {note && (
            <div className="px-3 py-2 rounded border border-amber-500/30 bg-amber-500/5 text-[11.5px] text-amber-200/90">
              {note}
            </div>
          )}
          {error && (
            <div className="px-3 py-2 rounded border border-red-500/40 bg-red-500/5 text-[11.5px] text-red-300">
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

function SectionPanel({ section, devices, projectId, onOpenScanBuild, onOpenReport }: { section: string; devices: Device[]; projectId: string; onOpenScanBuild?: () => void; onOpenReport?: () => void }) {
  const counts = useMemo(() => {
    const c: Record<DeviceKind, number> = { camera: 0, access: 0, network: 0, intrusion: 0, audio: 0, storage: 0, display: 0, power: 0, sensor: 0 };
    devices.forEach((d) => { c[TYPE_KIND[d.type]]++; });
    return c;
  }, [devices]);

  const Wrapper = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
    <div className="w-[340px] shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="text-sm font-medium">{title}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );

  const RowLink = ({ icon: Icon, label, sub, tone, accent }: { icon: any; label: string; sub?: string; tone?: string; accent?: string }) => (
    <button className="w-full text-left px-3 py-2.5 hover:bg-secondary/40 border-b border-border/50 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0" style={tone ? { boxShadow: `inset 0 0 0 1.5px ${tone}`, color: tone } : {}}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] truncate">{label}</div>
        {sub && <div className="text-[10.5px] text-muted-foreground truncate">{sub}</div>}
      </div>
      {accent && <span className="text-[10.5px] font-medium text-muted-foreground">{accent}</span>}
    </button>
  );

  if (section === 'overview') {
    const total = devices.length;
    return (
      <Wrapper title="Project overview" sub="Riverbend HQ · 4 floors · 22,400 ft²">
        <div className="p-3 grid grid-cols-2 gap-2">
          {([
            { label: 'Devices placed', value: total, tone: '#2F81F7' },
            { label: 'Coverage area', value: '88%', tone: '#3FB950' },
            { label: 'Open issues', value: 3, tone: '#E5484D' },
            { label: 'Budget used', value: '64%', tone: '#E5B23A' },
          ] as const).map((s, i) => (
            <div key={i} className="rounded-xl border border-border bg-background p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="text-xl mt-1" style={{ color: s.tone }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="px-3 pt-1 pb-2 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">By category</div>
        {CATEGORIES.map((c) => (
          <RowLink key={c.id} icon={KIND_ICON[c.id]} label={c.label} sub={`${c.types.length} types`} tone={c.tone} accent={String(counts[c.id])} />
        ))}
      </Wrapper>
    );
  }

  if (section === 'recording') {
    const cams = devices.filter((d) => TYPE_KIND[d.type] === 'camera').length;
    return (
      <Wrapper title="Recording & storage" sub={`${cams} cameras · est. 36 TB @ 30 days`}>
        <div className="p-3 space-y-2">
          {['Continuous (24/7)', 'Motion-triggered', 'Schedule (business hours)', 'Forensic on-demand'].map((p, i) => (
            <label key={p} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-background border border-border cursor-pointer hover:border-primary/50">
              <input type="radio" name="rec" defaultChecked={i === 1} className="accent-primary" />
              <div className="flex-1">
                <div className="text-[12.5px]">{p}</div>
                <div className="text-[10.5px] text-muted-foreground">{['1080p H.265 · 8 fps','1080p H.265 · 15 fps · 30 day buffer','Office hours only · 4K','Pulled on incident triggers'][i]}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Storage tier</div>
        <RowLink icon={HardDrive} label="On-site NVR" sub="Axis S1216 · 36 TB · RAID 5" tone="#1F6FEB" accent="active" />
        <RowLink icon={Cloud} label="Cloud archive" sub="Eagle Eye · 90 day retention" tone="#1F6FEB" accent="standby" />
        <RowLink icon={Database} label="Long-term archive" sub="Dell R760 · 256 TB · LTO-9 weekly" tone="#1F6FEB" />
      </Wrapper>
    );
  }

  if (section === 'accessories') {
    return (
      <Wrapper title="Accessories" sub="Mounts · enclosures · cabling · power kits">
        {[
          { icon: Wrench, label: 'Pendant mount', sub: 'Axis T94N01D · indoor', tone: '#7D8590' },
          { icon: Wrench, label: 'Corner mount', sub: 'Axis T94B01M · IK10', tone: '#7D8590' },
          { icon: Wrench, label: 'Pole adapter', sub: 'Hanwha SBP-300PMW1', tone: '#7D8590' },
          { icon: Cable,  label: 'Cat6A · 1000ft spool', sub: 'Belden 10GXS · plenum', tone: '#E5B23A' },
          { icon: Cable,  label: 'Cat6A · 500ft spool', sub: 'CommScope · riser', tone: '#E5B23A' },
          { icon: Cable,  label: 'Fiber OM4 · 12-strand', sub: 'Corning · LSZH', tone: '#E5B23A' },
          { icon: Zap,    label: '60W PoE++ injector', sub: 'Axis T8154 · single port', tone: '#8B5CF6' },
          { icon: Zap,    label: '4-port PoE midspan', sub: 'Cisco · 802.3bt', tone: '#8B5CF6' },
          { icon: BatteryCharging, label: 'Rack UPS 3kVA', sub: 'APC Smart-UPS', tone: '#8B5CF6' },
          { icon: ShieldAlert, label: 'Cat6 surge protector', sub: 'Ditek MRJ45C6', tone: '#8B5CF6' },
          { icon: Folder, label: 'Conduit · 3/4" EMT', sub: 'For exterior camera runs', tone: '#7D8590' },
        ].map((it) => <RowLink key={it.label} {...it} />)}
      </Wrapper>
    );
  }

  if (section === 'other') {
    return (
      <Wrapper title="Other elements" sub="Annotations, regions, and notes">
        {[
          { icon: Type,        label: 'Text annotation', sub: 'Drop a label or callout' },
          { icon: MessageSquare, label: 'Comment pin', sub: 'Thread on the canvas' },
          { icon: Ruler,       label: 'Dimension line', sub: 'Measured with snap' },
          { icon: WallIcon,    label: 'Wall segment', sub: 'Click-click-double-click' },
          { icon: Grid3x3,     label: 'Coverage region', sub: 'Polygon for risk zones' },
          { icon: AlertTriangle, label: 'Hazard area', sub: 'No-camera / privacy zone' },
          { icon: MapPin,      label: 'Custom marker', sub: 'Generic pin' },
          { icon: Sparkles,    label: 'AI suggestion zone', sub: 'Ask Vision to recommend' },
        ].map((it) => <RowLink key={it.label} {...it as any} />)}
      </Wrapper>
    );
  }

  if (section === 'maps') {
    return <MapsPanel onOpenScanBuild={onOpenScanBuild} />;
  }

  if (section === 'reports') {
    return (
      <Wrapper title="Reports" sub="Auto-generated from the canvas">
        {onOpenReport && (
          <div className="px-3 pt-2 pb-1.5 border-b border-border">
            <button
              onClick={onOpenReport}
              data-track="reports-open-builder"
              className="w-full inline-flex items-center justify-center gap-2 text-[12px] h-9 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-[var(--shadow-low)]"
            >
              <FileBarChart className="w-3.5 h-3.5" /> Open Report Builder
            </button>
            <div className="text-[10px] text-muted-foreground mt-1.5 text-center">
              Pick a report type, choose what to include, then export.
            </div>
          </div>
        )}
        <ReportExportRow icon={FileBarChart} label="Engineering packet" sub="Cover · device schedule · BOM · cable schedule · findings" tone="#1F6FEB" kind="engineering" devices={devices} projectId={projectId} />
        <ReportExportRow icon={Sparkles}     label="Customer presentation" sub="Cover · system overview · investment · timeline" tone="#A371F7" kind="customer" devices={devices} projectId={projectId} />
        <ReportExportRow icon={FileText}     label="Camera schedule" sub={`${devices.filter((d) => TYPE_KIND[d.type] === 'camera').length} cameras · location · model · IR`} tone="#F08F3C" kind="camera-schedule" devices={devices} projectId={projectId} />
        <ReportExportRow icon={DoorOpen}     label="Door schedule" sub={`${devices.filter((d) => isStackableHost(d.type)).length} openings · hardware stack`} tone="#3FB950" kind="door-schedule" devices={devices} projectId={projectId} />
        <ReportExportRow icon={Cable}        label="Cable / pathway schedule" sub="Runs · cable type · length · termination" tone="#22D3EE" kind="cable-schedule" devices={devices} projectId={projectId} />
        <ReportExportRow icon={PencilRuler}  label="Conduit schedule" sub="Conduit · size · cables · fill %" tone="#A371F7" kind="conduit-schedule" devices={devices} projectId={projectId} />
        <ReportExportRow icon={DollarSign}   label="Bill of materials" sub={`${devices.length} line items · live unit prices`} tone="#E5B23A" kind="bom" devices={devices} projectId={projectId} />
        <ReportExportRow icon={ListChecks}   label="Compliance checklist" sub="NDAA · ONVIF · ADA · fire egress" tone="#A371F7" kind="compliance" devices={devices} projectId={projectId} />
        <ReportExportRow icon={ShieldCheck}  label="Commissioning report" sub="Per-device install / firmware / signal / sign-off" tone="#E5484D" kind="commissioning" devices={devices} projectId={projectId} />
      </Wrapper>
    );
  }

  // docs
  return (
    <Wrapper title="Documentation" sub="Attached files and references">
      {[
        { icon: FileText, label: 'Scope of work — Riverbend HQ', sub: 'PDF · 14 pages · Jordan S.' },
        { icon: FileText, label: 'Statement of work (signed)', sub: 'PDF · countersigned 04-12' },
        { icon: ImageIcon, label: 'Site walk photos (32)', sub: 'Captured during vision scan' },
        { icon: FileText, label: 'Riser diagram — Level 1', sub: 'Drawing · Visio export' },
        { icon: FileText, label: 'Cable schedule v3', sub: 'Spreadsheet · 412 runs' },
        { icon: FileText, label: 'Permit application', sub: 'Submitted 04-18 · pending' },
        { icon: FileText, label: 'Client decision log', sub: '8 decisions · 2 open' },
      ].map((it) => <RowLink key={it.label} {...it as any} />)}
      <div className="p-3">
        <button className="w-full inline-flex items-center justify-center gap-1.5 text-xs h-9 rounded-lg border border-border hover:bg-secondary">
          <Upload className="w-3.5 h-3.5" /> Upload document
        </button>
      </div>
    </Wrapper>
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
                <div className="text-[11.5px] text-muted-foreground mt-1">
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
                className={`text-[10.5px] px-2 py-1 rounded transition-colors ${
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
                  className={`text-[10.5px] px-2 py-1 rounded transition-colors ${
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
                <span className="text-[10.5px] tabular-nums text-muted-foreground">
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
                      className={`flex-1 text-[10.5px] py-1 transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
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
              return (
                <button
                  key={c.id}
                  onClick={() => { props.setOpenCat(c.id); props.setOpenType(null); }}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors duration-150 group"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150 group-hover:scale-[1.03]"
                    style={{
                      background: `${c.tone}12`,
                      color: c.tone,
                      transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    <CategoryGlyph kind={c.id} active />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium tracking-tight leading-tight text-foreground">{c.label}</div>
                    <div className="text-[11.5px] text-muted-foreground mt-0.5">
                      {c.types.length} types · <span className={inStack === 0 ? 'text-amber-400/80' : ''}>{inStack} in stack</span>
                      {inStack !== productCount && <span className="opacity-50"> · {productCount} total</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                </button>
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
                    <span className="text-[10.5px] text-muted-foreground/70 ml-auto">{items.length}</span>
                  </div>
                  {items.map((p) => {
                    const badge = badgeFor(p);
                    const outOfStack = badge?.label === 'Outside stack';
                    return (
                      <button
                        key={p.id}
                        onPointerDown={(e) => { e.preventDefault(); props.onStartDrag(p, e); }}
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
                          <DeviceGlyph type={p.type} size={22} tone={activeCat.tone} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] truncate leading-tight flex items-center gap-2">
                            <span className="font-medium text-foreground">{p.mfr}</span>
                            <span className="text-muted-foreground">{p.model}</span>
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
                        <DeviceGlyph type={t.id} size={20} tone={cat.tone} />
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
                    onPointerDown={(e) => { e.preventDefault(); props.onStartDrag(p, e); }}
                    className="w-full text-left p-2.5 rounded-xl border border-border hover:border-primary/60 hover:bg-primary/[0.04] cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors group"
                  >
                    <div className="w-11 h-11 rounded-lg bg-secondary group-hover:bg-background border border-border flex items-center justify-center shrink-0">
                      <DeviceGlyph type={p.type} size={24} tone={cat.tone} />
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
                    <DeviceGlyph type={d.type} size={14} tone={g.tone} />
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
                  className={`text-[10.5px] py-1 px-1 rounded transition-colors ${display.baseMap === m.id ? 'bg-primary/15 text-primary border border-primary/40' : 'border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
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
            className={`flex-1 text-[10.5px] py-0.5 rounded transition-colors ${value === o.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
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
type CoverageMode = 'minimal' | 'soft' | 'tactical' | 'heatmap' | 'wireframe' | 'presentation' | 'night';

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
  { tool, zoom, pan, setPan, onUserTouchView, devices, selId, selPathwayId, selIds, presence, hoverByPresence, planSource, siteAddress, walls, wallStart, wallCursor, onPick, onBlank, onArmedClick, currentFloorPxToFt, dragging, snap, onSurfaceClick, onSurfaceMove, onSurfaceDblClick, onSurfaceContextMenu, onMoveDevice, onRotateDevice, onUpdateDevice, activeLens, setActiveLens, coverageMode, layers, display, measure, calibrate, cableDraw, dragLag, onDragStart, onDragEnd, hoveredLens, hoverHost, floorBackground, onUpdateBackground }, ref
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
  return (
    <svg
      ref={ref}
      onPointerDown={onPanStart}
      onPointerMove={onPanMove}
      onPointerUp={onPanEnd}
      onPointerCancel={onPanEnd}
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
          @keyframes scan-sweep { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -200; } }
          @keyframes glow-breathe { 0%,100% { opacity: 0.5; } 50% { opacity: 0.9; } }
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
      </defs>

      {/* Canvas backdrop — grid lattice, soft vignette, and a high-
          frequency grain layer that gives the surface physical tooth
          (the kind you feel under a pencil on drafting paper) without
          competing with anything painted on top. */}
      <rect width="100%" height="100%" fill="url(#canvas-grid-fine)" />
      <rect width="100%" height="100%" fill="url(#canvas-grid-coarse)" />
      <rect width="100%" height="100%" fill="url(#canvas-vignette)" />
      <rect width="100%" height="100%" filter="url(#canvas-grain)" opacity="0.55" pointerEvents="none" />

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
        {wallStart && wallCursor && (
          <g>
            <line x1={wallStart.x} y1={wallStart.y} x2={wallCursor.x} y2={wallCursor.y} stroke="#2F81F7" strokeWidth="2" strokeDasharray="4 4" />
            <circle cx={wallStart.x} cy={wallStart.y} r="3" fill="#2F81F7" />
            <circle cx={wallCursor.x} cy={wallCursor.y} r="3" fill="#2F81F7" />
          </g>
        )}

        {/* FOV cones — gated by the `fov` engineering layer. The selected
            camera still shows its cone regardless, so direct manipulation
            never goes blind. Opacity is further multiplied by the user's
            coverage opacity setting so dense maps can be quieted. */}
        <g style={{ mixBlendMode: coverageMode === 'heatmap' ? 'screen' : 'normal' }}>
          {renderedDevices.filter((d) => TYPE_KIND[d.type] === 'camera').map((d) => {
            const isSel = d.id === selId;
            if (!layers.fov && !isSel) return null;
            const dim = (selId ? (isSel ? 1 : 0.28) : 1) * coverageAlpha;
            return <FOV key={`fov-${d.id}`} d={d} mode={coverageMode} dim={dim} selected={isSel} activeLens={isSel ? activeLens : 'all'} hoveredLens={isSel ? hoveredLens : null} />;
          })}
        </g>

        {/* PathwaysOverlay paints BEFORE devices so device hit-targets sit on
            top in SVG paint order. A pathway's 12-px-wide transparent
            hit-stroke used to cover devices that lived at the pathway's
            endpoints (e.g. PW-1 starts at CAM-101's exact coords), which
            stole every real click. Devices render next. */}
        <PathwaysOverlay
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
          const hoverProduct = d.product ? PRODUCTS.find((p) => p.id === d.product) : undefined;
          const hoverProductLabel = hoverProduct ? `${hoverProduct.mfr} ${hoverProduct.model}` : d.type;
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
                if (e.shiftKey) {
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
                if (e.shiftKey) {
                  e.stopPropagation();
                  // Dispatch up to the parent — the parent owns selIds.
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
              {isSel && (
                <circle
                  cx={d.x} cy={d.y} r={13 * iconScale} fill="none"
                  stroke={tone} strokeWidth="0.75"
                  opacity="0.85"
                  style={{ animation: 'soft-fade-in 200ms ease-out both' }}
                />
              )}
              {/* Multisensor signature — when the camera is the selected
                  multisensor, a subtle inner ring breathes at the body's
                  edge. Slow, quiet, only visible on the active device. */}
              {isSel && d.type === 'cam.multisensor' && (
                <circle
                  cx={d.x} cy={d.y} r={10.5 * iconScale}
                  fill="none" stroke={tone} strokeWidth="0.45"
                  opacity="0.4"
                  style={{ animation: 'glow-breathe 3.2s ease-in-out infinite' }}
                />
              )}
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
                      <text x={chipX - 10} y={chipY + 3.2} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={tone}>
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
                    <text x={d.x + 10 * iconScale} y={d.y - 7.5 * iconScale} textAnchor="middle" fill="var(--canvas-background)" fontSize="8.5" fontWeight="700">
                      {count}
                    </text>
                  </g>
                );
              })()}
              {/* Label pill — id + manufacturer model below. Gated by BOTH
                  the `labels` engineering layer AND the user's label
                  density preference (hidden / selected / important / all).
                  Selected device's label always wins so identity is never
                  ambiguous. */}
              {layers.labels && labelVisibleFor(d, display.labelDensity, isSel) && (
                <g transform={`translate(${d.x}, ${d.y + 7 + 15 * iconScale})`} pointerEvents="none">
                  {/* Architectural callout: hairline frame, no tone stroke.
                      The device's color identity is already carried by the
                      glyph; the label's job is just to name it quietly. */}
                  <rect
                    x={-(d.id.length * 3.4 + 6)} y={-7}
                    width={d.id.length * 6.8 + 12} height={14} rx={3}
                    fill="var(--panel-background)" stroke="var(--border)" strokeWidth="0.5"
                    fillOpacity="0.92"
                  />
                  <text x={0} y={3} textAnchor="middle" fill="var(--foreground)" fontSize="10" fontWeight="500" letterSpacing="0.02em">{d.id}</text>
                  {isSel && (() => {
                    const product = PRODUCTS.find((p) => p.id === d.product);
                    if (!product) return null;
                    const label = `${product.mfr} · ${product.model}`;
                    const w = label.length * 5.5 + 12;
                    return (
                      <g transform="translate(0, 16)">
                        <rect x={-w / 2} y={-6} width={w} height={11} rx={2} fill="var(--panel-background)" fillOpacity="0.88" stroke="var(--border)" strokeWidth="0.4" />
                        <text x={0} y={2} textAnchor="middle" fill={tone} fontSize="8" fontWeight="500" fontFamily="ui-monospace, monospace">{label}</text>
                      </g>
                    );
                  })()}
                </g>
              )}
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
              <RotationRing d={s} onRotate={handleRotate} svgRef={ref as React.RefObject<SVGSVGElement>} zoom={zoom} pan={pan} overrideColor={ringColor} />
              {/* Direct manipulation cone handles (FOV edges + range tip). For
                  multisensors the handles attach to the active lens's cone; in
                  'all' mode handles are hidden because there's no single cone
                  to drag — the user edits per-lens via the chips. */}
              {(() => {
                if (s.type === 'cam.fisheye') return null;
                if (isMs) {
                  if (activeLens === 'all') return null;
                  const ls = getLenses(s);
                  const k = activeLens as LensId;
                  const L = ls[k];
                  return (
                    <ConeHandles
                      cx={s.x} cy={s.y}
                      rotDeg={((L.rotation + s.rot) % 360 + 360) % 360}
                      fovDeg={L.fov}
                      rangeFt={L.range}
                      svgRef={ref as React.RefObject<SVGSVGElement>}
                      zoom={zoom}
                      pan={pan}
                      color={LENS_TONE[k]}
                      onUpdate={(p) => {
                        // Linked mode: FOV / range edits on the active lens
                        // propagate to all four lenses. Each lens keeps its
                        // own rotation (because rotation is stored relative
                        // to the body and serves to point each lens at its
                        // quadrant). Without this branch, the "Linked"
                        // toggle was decorative — only the active lens
                        // actually moved.
                        // Independent mode keeps the previous per-lens
                        // write so each lens can be tuned alone.
                        if (lensMode === 'linked') {
                          const next: typeof ls = {
                            a: { ...ls.a, ...p },
                            b: { ...ls.b, ...p },
                            c: { ...ls.c, ...p },
                            d: { ...ls.d, ...p },
                          };
                          onUpdateDevice(s.id, { lenses: next });
                        } else {
                          onUpdateDevice(s.id, { lenses: { ...ls, [k]: { ...L, ...p } } });
                        }
                      }}
                    />
                  );
                }
                // Single-lens camera
                const PX_PER_FT = 3.83;
                const defaultRangeFt = s.type === 'cam.ptz' ? 44 : s.type === 'cam.bullet' ? 50 : 30;
                const defaultFovDeg  = s.type === 'cam.ptz' ? 36 : 70;
                return (
                  <ConeHandles
                    cx={s.x} cy={s.y}
                    rotDeg={s.rot}
                    fovDeg={s.fov ?? defaultFovDeg}
                    rangeFt={s.range ?? defaultRangeFt}
                    svgRef={ref as React.RefObject<SVGSVGElement>}
                    zoom={zoom}
                    pan={pan}
                    color={KIND_TONE.camera}
                    onUpdate={(p) => onUpdateDevice(s.id, p)}
                  />
                );
              })()}
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
            <text x={6} y={0} fontSize="8" fontFamily="ui-monospace, monospace" fill="#94A3B8" letterSpacing="0.6">X · Y · NEAR</text>
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
                <text x={mx} y={my + 3} textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill="#CBD5E1">
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
    </svg>
  );
});

/** Small honest badge on simulated map modes. The brief is explicit:
 *  if there's no live provider, label it. */
function SimulatedMapBadge({ label, tone = 'light' }: { label: string; tone?: 'light' | 'dark' }) {
  const bg = tone === 'dark' ? 'rgba(13,20,36,0.85)' : 'rgba(13,20,36,0.78)';
  const fg = '#F4E07A';
  return (
    <g transform="translate(540, 580)">
      <rect width="170" height="20" rx="10" fill={bg} stroke={fg + '55'} strokeWidth="0.6" />
      <circle cx="11" cy="10" r="3" fill={fg} opacity="0.85" />
      <text x="20" y="14" fill={fg} fontSize="10.5" fontFamily="ui-sans-serif">{label}</text>
    </g>
  );
}

function FloorPlan({ source, siteAddress }: { source: BaseMapMode; siteAddress: string }) {
  // Honest map modes. Every value the picker offers produces a visually
  // distinct surface so the choice is real. Where there's no live tile
  // provider (street / hybrid / dark) the surface is clearly a stylised
  // engineering render and is labelled "Simulated map layer".
  if (source === 'blank') {
    return (
      <g>
        <rect x="80" y="80" width="640" height="480" fill="url(#plan-paper)" stroke="#30363D" strokeWidth="1" strokeDasharray="6 6" rx="4" />
        <text x="400" y="316" textAnchor="middle" fill="#7D8590" fontSize="13">Press W or pick the wall tool to start sketching</text>
        <text x="400" y="336" textAnchor="middle" fill="#484F58" fontSize="11">Click to drop vertices · double-click to end a run</text>
      </g>
    );
  }
  if (source === 'street') {
    return (
      <g>
        {/* Light cartographic surface — off-white roads on a warm slate. */}
        <rect x="80" y="80" width="640" height="480" fill="#D8DEE8" rx="3" />
        {/* Major roads */}
        <g stroke="#FFFFFF" strokeLinecap="round">
          <line x1="80"  y1="220" x2="720" y2="220" strokeWidth="16" />
          <line x1="80"  y1="420" x2="720" y2="420" strokeWidth="12" />
          <line x1="320" y1="80"  x2="320" y2="560" strokeWidth="14" />
          <line x1="560" y1="80"  x2="560" y2="560" strokeWidth="10" />
        </g>
        {/* Road outlines */}
        <g stroke="#9BA5B6" strokeWidth="0.6">
          <line x1="80"  y1="212" x2="720" y2="212" />
          <line x1="80"  y1="228" x2="720" y2="228" />
          <line x1="80"  y1="414" x2="720" y2="414" />
          <line x1="80"  y1="426" x2="720" y2="426" />
          <line x1="313" y1="80"  x2="313" y2="560" />
          <line x1="327" y1="80"  x2="327" y2="560" />
          <line x1="555" y1="80"  x2="555" y2="560" />
          <line x1="565" y1="80"  x2="565" y2="560" />
        </g>
        {/* Building footprints */}
        <g fill="#BFC8D6" stroke="#9BA5B6" strokeWidth="0.6">
          <rect x="120" y="100" width="140" height="90" />
          <rect x="370" y="110" width="160" height="90" />
          <rect x="600" y="120" width="100" height="80" />
          <rect x="110" y="260" width="180" height="130" />
          <rect x="370" y="260" width="160" height="130" />
          <rect x="600" y="260" width="100" height="120" />
          <rect x="120" y="450" width="170" height="90" />
          <rect x="370" y="450" width="160" height="90" />
        </g>
        <SimulatedMapBadge label="Simulated street map" />
      </g>
    );
  }
  if (source === 'hybrid') {
    // Hybrid = aerial surface + clear road/label overlays. Uses the same
    // honest aerial we render in the satellite branch, then layers
    // labelled streets on top so the engineer can orient.
    return (
      <g>
        <defs>
          <pattern id="hyb-veg" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#3F5C42" />
            <circle cx="4" cy="4" r="1.4" fill="#5A7B5D" opacity="0.6" />
            <circle cx="10" cy="9" r="1.2" fill="#365139" opacity="0.7" />
          </pattern>
          <pattern id="hyb-asphalt" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill="#3A3F47" />
            <line x1="0" y1="9" x2="18" y2="9" stroke="#52575F" strokeWidth="0.4" opacity="0.5" />
          </pattern>
        </defs>
        <rect x="80" y="80" width="640" height="480" fill="url(#hyb-veg)" rx="3" />
        <rect x="120" y="420" width="560" height="120" fill="url(#hyb-asphalt)" rx="2" />
        <rect x="220" y="200" width="360" height="200" fill="#8B928D" stroke="#1F2A33" strokeWidth="0.8" />
        {/* Roads (labelled) */}
        <g stroke="#FFFFFF" strokeOpacity="0.55" strokeLinecap="round" fill="none">
          <line x1="80"  y1="220" x2="720" y2="220" strokeWidth="14" />
          <line x1="80"  y1="540" x2="720" y2="540" strokeWidth="10" />
          <line x1="400" y1="80"  x2="400" y2="560" strokeWidth="12" />
        </g>
        <g stroke="#FFFFFF" strokeOpacity="0.95" strokeLinecap="round" strokeDasharray="6 6">
          <line x1="80"  y1="220" x2="720" y2="220" strokeWidth="1" />
          <line x1="80"  y1="540" x2="720" y2="540" strokeWidth="1" />
          <line x1="400" y1="80"  x2="400" y2="560" strokeWidth="1" />
        </g>
        <g fill="#FFFFFF" fontSize="10.5" fontFamily="ui-sans-serif" fontWeight="500">
          <text x="500" y="216" textAnchor="middle" stroke="#0D1424" strokeWidth="3" paintOrder="stroke">Commerce Blvd</text>
          <text x="412" y="330" textAnchor="middle" stroke="#0D1424" strokeWidth="3" paintOrder="stroke" transform="rotate(-90 412 330)">7th St</text>
        </g>
        <g transform="translate(96, 100)">
          <rect width="220" height="26" rx="13" fill="var(--canvas-background)" fillOpacity="0.8" stroke="#30363D" />
          <circle cx="14" cy="13" r="3.5" fill="#2F81F7" />
          <text x="26" y="17" fill="var(--foreground)" fontSize="11">{siteAddress || 'No address set'}</text>
        </g>
        <SimulatedMapBadge label="Simulated hybrid (satellite + labels)" />
      </g>
    );
  }
  if (source === 'dark') {
    return (
      <g>
        {/* Dark cartographic surface — premium night-mode map look. */}
        <rect x="80" y="80" width="640" height="480" fill="#0E1424" rx="3" />
        <g stroke="#1F2A40" strokeWidth="22" strokeLinecap="round">
          <line x1="80" y1="220" x2="720" y2="220" />
          <line x1="80" y1="420" x2="720" y2="420" />
          <line x1="320" y1="80" x2="320" y2="560" />
        </g>
        <g stroke="#2A3650" strokeWidth="14" strokeLinecap="round">
          <line x1="80" y1="160" x2="720" y2="160" />
          <line x1="80" y1="500" x2="720" y2="500" />
          <line x1="560" y1="80" x2="560" y2="560" />
        </g>
        {/* Road inner highlights */}
        <g stroke="#4A95E8" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round">
          <line x1="80" y1="220" x2="720" y2="220" />
          <line x1="80" y1="420" x2="720" y2="420" />
          <line x1="320" y1="80" x2="320" y2="560" />
        </g>
        {/* Building parcels */}
        <g fill="#162033" stroke="#243049" strokeWidth="0.6">
          <rect x="120" y="100" width="140" height="90" />
          <rect x="370" y="110" width="160" height="90" />
          <rect x="600" y="120" width="100" height="80" />
          <rect x="110" y="260" width="180" height="130" />
          <rect x="370" y="260" width="160" height="130" />
          <rect x="600" y="260" width="100" height="120" />
          <rect x="120" y="450" width="170" height="90" />
          <rect x="370" y="450" width="160" height="90" />
        </g>
        <SimulatedMapBadge label="Simulated dark map" tone="dark" />
      </g>
    );
  }
  if (source === 'satellite') {
    // Honest satellite stand-in: while a live tile provider isn't wired,
    // we draw a clean engineering aerial — parcel grid, vegetation
    // tiles, hardstanding (parking) and a clear primary structure. The
    // colour palette stays mid-tone so plotted device icons (high-
    // contrast white-on-tone glyphs) read cleanly against the surface.
    // The SimulatedMapBadge keeps the label honest.
    return (
      <g>
        <defs>
          <pattern id="sat-veg" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#3F5C42" />
            <circle cx="4" cy="4" r="1.4" fill="#5A7B5D" opacity="0.6" />
            <circle cx="10" cy="9" r="1.2" fill="#365139" opacity="0.7" />
          </pattern>
          <pattern id="sat-asphalt" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill="#3A3F47" />
            <line x1="0" y1="9" x2="18" y2="9" stroke="#52575F" strokeWidth="0.4" opacity="0.5" />
          </pattern>
          <linearGradient id="sat-roof" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="#9BA29C" />
            <stop offset="50%" stopColor="#828A85" />
            <stop offset="100%" stopColor="#6E7570" />
          </linearGradient>
        </defs>

        {/* Base aerial (vegetation / land) */}
        <rect x="80" y="80" width="640" height="480" fill="url(#sat-veg)" rx="3" />

        {/* Parking lot — primary hardstanding south of the building */}
        <rect x="120" y="420" width="560" height="120" fill="url(#sat-asphalt)" rx="2" />
        {/* Parking stripes */}
        <g stroke="#D7DCE2" strokeWidth="0.9" opacity="0.85">
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={i} x1={140 + i * 30} y1={440} x2={140 + i * 30} y2={485} />
          ))}
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={`b${i}`} x1={140 + i * 30} y1={500} x2={140 + i * 30} y2={540} />
          ))}
          <line x1="120" y1="492" x2="680" y2="492" strokeDasharray="6 6" opacity="0.6" />
        </g>

        {/* Driveway entry north */}
        <rect x="380" y="80" width="40" height="120" fill="url(#sat-asphalt)" />

        {/* Primary structure (building roof) */}
        <g>
          <rect x="220" y="200" width="360" height="200" fill="url(#sat-roof)" stroke="#1F2A33" strokeWidth="0.8" />
          {/* Roof equipment — HVAC blocks read as small dark rectangles
              over the roof. Helps the surface feel like real imagery. */}
          <g fill="#4A5058" stroke="#262B30" strokeWidth="0.4">
            <rect x="244" y="220" width="36" height="22" />
            <rect x="296" y="220" width="28" height="22" />
            <rect x="520" y="232" width="40" height="28" />
            <rect x="244" y="356" width="26" height="22" />
            <rect x="520" y="356" width="40" height="22" />
          </g>
          {/* Roof seam lines */}
          <g stroke="#1F2A33" strokeWidth="0.4" opacity="0.55">
            <line x1="220" y1="270" x2="580" y2="270" />
            <line x1="220" y1="330" x2="580" y2="330" />
            <line x1="400" y1="200" x2="400" y2="400" />
          </g>
        </g>

        {/* Sidewalk perimeter */}
        <g stroke="#C7CDD4" strokeOpacity="0.55" strokeWidth="3" fill="none">
          <rect x="206" y="186" width="388" height="228" />
        </g>

        {/* Parcel outline (engineering boundary, not imagery) */}
        <rect x="80" y="80" width="640" height="480" fill="none" stroke="#2F81F7" strokeWidth="2" strokeDasharray="8 6" />

        {/* Address chip */}
        <g transform="translate(96, 100)">
          <rect width="220" height="26" rx="13" fill="var(--canvas-background)" fillOpacity="0.8" stroke="#30363D" />
          <circle cx="14" cy="13" r="3.5" fill="#2F81F7" />
          <text x="26" y="17" fill="var(--foreground)" fontSize="11">{siteAddress || 'No address set'}</text>
        </g>

        {/* Scale bar */}
        <g transform="translate(100, 580)">
          <rect x="-6" y="-12" width="124" height="22" rx="4" fill="var(--canvas-background)" fillOpacity="0.62" stroke="#30363D" strokeWidth="0.6" />
          <line x1="0" y1="0" x2="100" y2="0" stroke="#E6EDF3" strokeWidth="2" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="#E6EDF3" strokeWidth="2" />
          <line x1="100" y1="-4" x2="100" y2="4" stroke="#E6EDF3" strokeWidth="2" />
          <text x="50" y="-7" textAnchor="middle" fill="var(--foreground)" fontSize="10">~30 ft</text>
        </g>

        <SimulatedMapBadge label="Simulated satellite layer" />
      </g>
    );
  }
  // Crisp, obvious building outline with paper-fill interior so you SEE the floor plan
  return (
    <g>
      {/* Floor plan — theme-aware paper + charcoal wall lines.
          The in-plan North arrow was removed: the HTML compass at the
          top-right of the canvas is the single source of orientation. */}
      <g>
        <rect x="80" y="80" width="640" height="480" fill="url(#plan-paper)" rx="3" />
        <rect x="80" y="80" width="640" height="480" fill="none" stroke="var(--foreground)" strokeWidth="2" opacity="0.7" rx="3" />
      </g>

      <g stroke="var(--foreground)" strokeWidth="1.6" opacity="0.55" strokeLinecap="square">
        <line x1="80"  y1="320" x2="720" y2="320" />
        <line x1="400" y1="80"  x2="400" y2="560" />
        <line x1="240" y1="80"  x2="240" y2="320" />
        <line x1="560" y1="320" x2="560" y2="560" />
      </g>

      {/* Door openings — gap + swing arc that read on any theme */}
      <g>
        <line x1="380" y1="80" x2="420" y2="80" stroke="var(--canvas-background)" strokeWidth="3" />
        <path d="M 380 80 A 40 40 0 0 1 420 120" fill="none" stroke="var(--foreground)" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
        <line x1="680" y1="320" x2="720" y2="320" stroke="var(--canvas-background)" strokeWidth="3" />
        <path d="M 680 320 A 40 40 0 0 1 720 360" fill="none" stroke="var(--foreground)" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
      </g>

      <g fill="var(--foreground)" fontSize="11" fontWeight="500">
        <text x="160" y="200">Lobby</text>
        <text x="320" y="200">Reception</text>
        <text x="480" y="200">Open office</text>
        <text x="640" y="200">IT room</text>
        <text x="160" y="440">Conference A</text>
        <text x="320" y="440">Conference B</text>
        <text x="480" y="440">Open office</text>
        <text x="640" y="440">Storage</text>
      </g>

      <g fill="var(--muted-foreground)" fontSize="10">
        <text x="40" y="320" transform="rotate(-90 40 320)">Exterior — parking</text>
        <text x="400" y="50" textAnchor="middle">Exterior — courtyard</text>
      </g>

      <g transform="translate(100, 580)">
        <line x1="0" y1="0" x2="100" y2="0" stroke="#1F2937" strokeWidth="1.5" />
        <line x1="0" y1="-4" x2="0" y2="4" stroke="#1F2937" strokeWidth="1.5" />
        <line x1="100" y1="-4" x2="100" y2="4" stroke="#1F2937" strokeWidth="1.5" />
        <text x="50" y="-7" textAnchor="middle" fill="var(--foreground)" fontSize="10">10 ft</text>
      </g>
    </g>
  );
}

/** Render one wedge-shaped FOV cone given absolute world rotation + fov + range
 *  in feet. Used by both the single-lens FOV branch and the multisensor 4-lens
 *  branch so the visuals stay identical. */
function FovCone({
  cx, cy, rotDeg, fovDeg, rangeFt, color, opacity, wireframe, label, telemetry,
}: { cx: number; cy: number; rotDeg: number; fovDeg: number; rangeFt: number; color: string; opacity: number; wireframe: boolean; label?: string; telemetry?: string }) {
  const PX_PER_FT = 3.83;
  const r = rangeFt * PX_PER_FT;
  const half = fovDeg / 2;
  const a1 = ((rotDeg - half) * Math.PI) / 180;
  const a2 = ((rotDeg + half) * Math.PI) / 180;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const x2 = cx + Math.cos(a2) * r;
  const y2 = cy + Math.sin(a2) * r;
  const large = half > 90 ? 1 : 0;
  const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  // tip of the cone (used to anchor the small telemetry chip)
  const tipX = cx + Math.cos((rotDeg * Math.PI) / 180) * r;
  const tipY = cy + Math.sin((rotDeg * Math.PI) / 180) * r;
  // Per-cone radial gradient — saturated at the lens (cx, cy) and fading to
  // zero at the cone's outer arc. Gives the cinematic "vapor at the edge"
  // depth instead of the flat SVG-ish fill that read as decorative. The id
  // encodes color+position+range so two cones never share a gradient.
  const gid = `cone-${color.replace('#', '')}-${Math.round(cx)}-${Math.round(cy)}-${Math.round(r)}-${Math.round(rotDeg)}-${Math.round(fovDeg)}`;
  return (
    <g opacity={opacity}>
      <defs>
        {/* Lens-cone wash — drafting paper alpha, not spotlight beam. */}
        <radialGradient id={gid} cx={cx} cy={cy} r={r} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
          <stop offset="50%"  stopColor={color} stopOpacity="0.10" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Single-pass fill. The bloom pass that used to live here was the
          main source of the lens's "spotlight" cyber feel; without it the
          cone reads as a clean engineering callout. */}
      {!wireframe && <path d={path} fill={`url(#${gid})`} />}
      {/* Edge stroke — hairline draftsman line, low opacity. */}
      <path d={path} fill="none" stroke={color} strokeWidth={wireframe ? 0.9 : 0.5} opacity={wireframe ? 0.85 : 0.3} />
      {/* DORI band rings — quieter still in clean modes; they used to
          overprint walls and labels in dense plans. */}
      {!wireframe && [0.35, 0.6, 0.8].map((f) => {
        const rr = r * f;
        const xa = cx + Math.cos(a1) * rr;
        const ya = cy + Math.sin(a1) * rr;
        const xb = cx + Math.cos(a2) * rr;
        const yb = cy + Math.sin(a2) * rr;
        return (
          <path key={f} d={`M ${xa} ${ya} A ${rr} ${rr} 0 ${half > 90 ? 1 : 0} 1 ${xb} ${yb}`}
            fill="none" stroke={color} strokeWidth="0.35" opacity="0.18" strokeDasharray="2 4" />
        );
      })}
      {label && (
        <g transform={`translate(${tipX}, ${tipY})`} pointerEvents="none">
          <circle r={9} fill="var(--panel-background)" fillOpacity="0.88" stroke={color} strokeWidth="0.8" />
          <text textAnchor="middle" y={3} fontSize="9" fontWeight="700" fill={color} fontFamily="ui-monospace, monospace">{label}</text>
          {telemetry && (
            <g transform="translate(0, 16)">
              <rect x={-26} y={-6} width={52} height={12} rx={2} fill="var(--panel-background)" fillOpacity="0.85" stroke={color} strokeWidth="0.5" opacity="0.85" />
              <text textAnchor="middle" y={2.5} fontSize="8" fill="var(--foreground)" fontFamily="ui-monospace, monospace">{telemetry}</text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}

function FOV({ d, mode = 'soft', dim = 1, selected = false, activeLens = 'all', hoveredLens = null }: { d: Device; mode?: CoverageMode; dim?: number; selected?: boolean; activeLens?: ActiveLens; hoveredLens?: LensId | null }) {
  // Mode-driven render parameters. Tuned down for the ergonomics pass so
  // unselected coverage doesn't dominate the plan. Selected coverage
  // keeps a small 1.2× boost so it reads as clear without being loud —
  // pairs with the rotation ring + cone handles + selection halo to make
  // the active object unambiguous. Siblings additionally dim 0.28 via
  // the parent's `dim` factor (line ~5606), so contrast stays high.
  const opacity = (mode === 'minimal' ? 0.22 : mode === 'presentation' ? 0.5 : mode === 'tactical' ? 0.7 : mode === 'heatmap' ? 0.7 : mode === 'night' ? 0.42 : 0.55) * dim * (selected ? 1.2 : 1);
  const wireframe = mode === 'wireframe';
  const showArcs = mode !== 'minimal' && mode !== 'presentation';
  const showAim = mode === 'tactical' || mode === 'wireframe' || selected;

  // ── Multisensor branch — render four independent cones, one per lens. ──
  // Each cone carries its own rotation/fov/range and its own color. When the
  // device is selected and a specific lens is active, that lens cone gets
  // brighter stroke + a telemetry chip; the other three dim slightly so the
  // active one reads clearly.
  if (d.type === 'cam.multisensor') {
    const lenses = getLenses(d);
    // When the user is viewing all four lenses together (multisensor
    // selected, 'all' active), apply a soft screen blend so where two
    // cones overlap their colors add — visualizing the stitching and
    // overlap regions without any extra UI. This is the multisensor's
    // signature visual moment.
    const useScreenBlend = selected && activeLens === 'all' && !wireframe;
    return (
      <g style={useScreenBlend ? { mixBlendMode: 'screen' } : undefined}>
        {(['a', 'b', 'c', 'd'] as const).map((k) => {
          const L = lenses[k];
          if (!L.enabled) return null;
          const isActive = selected && (activeLens === k || activeLens === 'all');
          const isHovered = selected && hoveredLens === k;
          // Lens rotation is relative to the multisensor body — adding d.rot
          // lets the user rotate the whole device while preserving the
          // cardinal spread between lenses.
          const absRot = ((L.rotation + d.rot) % 360 + 360) % 360;
          // When a lens chip is being hovered, lift its corresponding
          // cone slightly and dim the others — so the user can visually
          // pair "this chip" → "that cone" without any explanation.
          // Non-active multisensor lens cones drop further so the active
          // lens reads as the "selected" one. Hovered chip pops a touch.
          let coneOpacity = opacity * (selected && activeLens !== 'all' && activeLens !== k ? 0.22 : 1);
          if (selected && hoveredLens) {
            coneOpacity = opacity * (isHovered ? 1.1 : 0.18);
          }
          return (
            <FovCone
              key={`lens-${d.id}-${k}`}
              cx={d.x} cy={d.y}
              rotDeg={absRot}
              fovDeg={L.fov}
              rangeFt={L.range}
              color={LENS_TONE[k]}
              opacity={coneOpacity}
              wireframe={wireframe}
              label={isActive && selected ? LENS_LABEL[k] : undefined}
              telemetry={isActive && selected && activeLens === k ? `${Math.round(L.fov)}° · ${Math.round(L.range)}ft` : undefined}
            />
          );
        })}
      </g>
    );
  }

  // ── Single-lens cameras (dome / bullet / ptz / fisheye / thermal / lpr) ──
  const PX_PER_FT = 3.83;
  const defaultRangeFt = d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30;
  const defaultFovDeg  = d.type === 'cam.ptz' ? 36 : d.type === 'cam.fisheye' ? 360 : 70;
  const rangeFt = d.range ?? defaultRangeFt;
  const fovDeg  = d.fov ?? defaultFovDeg;
  if (d.type === 'cam.fisheye' || fovDeg >= 350) {
    const rFish = rangeFt * PX_PER_FT * 0.6; // fisheye effective radius is smaller (omni)
    return (
      <g opacity={opacity}>
        {!wireframe && <circle cx={d.x} cy={d.y} r={rFish} fill="url(#fov-grad-360)" />}
        <circle cx={d.x} cy={d.y} r={rFish} fill="none" stroke="#FF7B6B" strokeWidth={wireframe ? 0.8 : 0.6} opacity={wireframe ? 0.9 : 0.5} strokeDasharray="2 4" />
      </g>
    );
  }
  const r = rangeFt * PX_PER_FT;
  const half = fovDeg / 2;
  const rot = d.rot;
  const a1 = ((rot - half) * Math.PI) / 180;
  const a2 = ((rot + half) * Math.PI) / 180;
  const x1 = d.x + Math.cos(a1) * r;
  const y1 = d.y + Math.sin(a1) * r;
  const x2 = d.x + Math.cos(a2) * r;
  const y2 = d.y + Math.sin(a2) * r;
  const large = half > 90 ? 1 : 0;
  const gradId = d.type === 'cam.ptz' ? 'fov-grad-ptz' : 'fov-grad';
  // Cone edge follows the per-object color if set, otherwise the theme's
  // cone-fixed / cone-ptz token so cones stay readable in every theme.
  const themeCone = d.type === 'cam.ptz' ? 'var(--cone-ptz)' : 'var(--cone-fixed)';
  const edge = d.color || themeCone;
  // Rotate gradient so its origin aligns with the lens and decays outward
  const path = `M ${d.x} ${d.y} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  return (
    <g opacity={opacity}>
      {/* Single-pass fill — no more bloom doubling. Hairline edge stroke. */}
      {!wireframe && <path d={path} fill={`url(#${gradId})`} />}
      <path d={path} fill="none" stroke={edge} strokeWidth={wireframe ? 0.9 : 0.5} opacity={wireframe ? 0.85 : 0.32} />
      {showArcs && [0.35, 0.6, 0.8].map((f, i) => {
        const rr = r * f;
        const xa = d.x + Math.cos(a1) * rr;
        const ya = d.y + Math.sin(a1) * rr;
        const xb = d.x + Math.cos(a2) * rr;
        const yb = d.y + Math.sin(a2) * rr;
        return (
          <path key={i}
            d={`M ${xa} ${ya} A ${rr} ${rr} 0 0 1 ${xb} ${yb}`}
            fill="none" stroke={edge} strokeWidth="0.35" opacity={0.22 - i * 0.05} strokeDasharray="1 3"
          />
        );
      })}
      {showAim && (
        <line
          x1={d.x} y1={d.y}
          x2={d.x + Math.cos((rot * Math.PI) / 180) * r}
          y2={d.y + Math.sin((rot * Math.PI) / 180) * r}
          stroke={edge} strokeWidth="0.4" opacity="0.4" strokeDasharray="2 3"
        />
      )}
    </g>
  );
}

/** Direct-manipulation handles attached to the tip + edges of a cone. Tip
 *  handle mutates RANGE (in ft). Two edge handles mutate FOV (the half-angle).
 *  Used by both single-lens cameras and the active lens of a multisensor —
 *  the caller wires `onUpdate` to write to either d.fov/d.range OR
 *  d.lenses[activeLens].fov/.range. */
function ConeHandles({ cx, cy, rotDeg, fovDeg, rangeFt, svgRef, zoom, pan, color, onUpdate }: {
  cx: number; cy: number;
  rotDeg: number; fovDeg: number; rangeFt: number;
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  pan: { x: number; y: number };
  color: string;
  onUpdate: (patch: { fov?: number; range?: number }) => void;
}) {
  const PX_PER_FT = 3.83;
  const r = rangeFt * PX_PER_FT;
  const half = fovDeg / 2;
  const aMid = (rotDeg * Math.PI) / 180;
  const a1 = ((rotDeg - half) * Math.PI) / 180;
  const a2 = ((rotDeg + half) * Math.PI) / 180;
  const tipX = cx + Math.cos(aMid) * r;
  const tipY = cy + Math.sin(aMid) * r;
  const e1X = cx + Math.cos(a1) * r * 0.92;
  const e1Y = cy + Math.sin(a1) * r * 0.92;
  const e2X = cx + Math.cos(a2) * r * 0.92;
  const e2Y = cy + Math.sin(a2) * r * 0.92;

  const startDrag = (apply: (cx: number, cy: number) => void) => (e: React.PointerEvent) => {
    e.stopPropagation();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* capture optional */ }
    const onMove = (ev: PointerEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      // Convert client (viewport-CSS-px) → SVG canvas coords. Must subtract
      // the active pan offset before dividing by zoom, otherwise dragging a
      // FOV/range handle while the canvas is panned makes the handle "shoot
      // forward" by exactly the pan distance.
      apply(((ev.clientX - rect.left) - pan.x) / zoom, ((ev.clientY - rect.top) - pan.y) / zoom);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onTipDown = startDrag((mx, my) => {
    const dist = Math.hypot(mx - cx, my - cy);
    onUpdate({ range: Math.max(5, Math.min(150, Math.round(dist / PX_PER_FT))) });
  });
  const onEdgeDown = startDrag((mx, my) => {
    // FOV = 2 × shortest absolute angle between cursor heading and cone center
    const ang = (Math.atan2(my - cy, mx - cx) * 180) / Math.PI;
    let delta = Math.abs(((ang - rotDeg + 180) % 360) - 180);
    if (delta < 0) delta = -delta;
    onUpdate({ fov: Math.max(10, Math.min(360, Math.round(delta * 2))) });
  });

  return (
    <g pointerEvents="auto">
      {/* Range (tip) handle — drag along cone axis to extend/shorten reach.
          Slightly larger background "glow" for hit affordance; the solid
          centre stays small for placement precision. */}
      <g onPointerDown={onTipDown} className="dv-cone-handle" style={{ cursor: 'ew-resize' }}>
        <circle cx={tipX} cy={tipY} r={8} fill={color} opacity="0.22" />
        <circle cx={tipX} cy={tipY} r={3.6} fill={color} stroke="var(--canvas-background)" strokeWidth="1.1" />
        <g transform={`translate(${tipX}, ${tipY - 14})`} pointerEvents="none">
          <rect x={-20} y={-7} width={40} height={13} rx={2} fill="var(--panel-background)" fillOpacity="0.92" stroke={color} strokeWidth="0.6" />
          <text textAnchor="middle" y={2.5} fontSize="9" fontWeight="600" fill={color} fontFamily="ui-monospace, monospace">{Math.round(rangeFt)} ft</text>
        </g>
      </g>
      {/* Edge (FOV) handles — drag to widen/narrow the lens aperture.
          Both handles share a single live "° fov" badge centred between
          them so the surveyor always sees the current aperture while
          adjusting — no need to peek at the inspector mid-drag. */}
      <g onPointerDown={onEdgeDown} className="dv-cone-handle" style={{ cursor: 'crosshair' }}>
        <circle cx={e1X} cy={e1Y} r={7} fill={color} opacity="0.22" />
        <circle cx={e1X} cy={e1Y} r={3.1} fill={color} stroke="var(--canvas-background)" strokeWidth="0.85" />
      </g>
      <g onPointerDown={onEdgeDown} className="dv-cone-handle" style={{ cursor: 'crosshair' }}>
        <circle cx={e2X} cy={e2Y} r={7} fill={color} opacity="0.22" />
        <circle cx={e2X} cy={e2Y} r={3.1} fill={color} stroke="var(--canvas-background)" strokeWidth="0.85" />
      </g>
      {/* Live FOV chip — midpoint between the two edge handles, offset
          slightly outward along the cone axis so it never overlaps the
          range badge at the tip. */}
      {(() => {
        const midX = (e1X + e2X) / 2;
        const midY = (e1Y + e2Y) / 2;
        return (
          <g transform={`translate(${midX}, ${midY})`} pointerEvents="none">
            <rect x={-20} y={-7} width={40} height={13} rx={2} fill="var(--panel-background)" fillOpacity="0.92" stroke={color} strokeWidth="0.6" />
            <text textAnchor="middle" y={2.5} fontSize="9" fontWeight="600" fill={color} fontFamily="ui-monospace, monospace">{Math.round(fovDeg)}° fov</text>
          </g>
        );
      })()}
    </g>
  );
}

function RotationRing({ d, onRotate, svgRef, zoom, pan, overrideColor }: { d: Device; onRotate: (r: number) => void; svgRef: React.RefObject<SVGSVGElement>; zoom: number; pan: { x: number; y: number }; overrideColor?: string }) {
  // overrideColor lets a multisensor's active-lens color drive the ring's
  // visuals when the ring is editing a single lens (e.g. cyan for Lens A).
  // Otherwise we use the per-object color (if assigned) before the category.
  const tone = overrideColor ?? deviceTone(d);
  const R = 34;
  const rad = (d.rot * Math.PI) / 180;
  const handleX = d.x + Math.cos(rad) * R;
  const handleY = d.y + Math.sin(rad) * R;
  const dragging = useRef(false);

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* capture optional */ }
    dragging.current = true;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    // Same fix that landed for ConeHandles: convert client (CSS px) →
    // SVG canvas coords by subtracting pan BEFORE dividing by zoom. Without
    // this, rotating a camera while the canvas is panned snaps the heading
    // to a wrong angle proportional to the pan offset.
    const cx = ((e.clientX - r.left) - pan.x) / zoom;
    const cy = ((e.clientY - r.top)  - pan.y) / zoom;
    const ang = Math.round((Math.atan2(cy - d.y, cx - d.x) * 180) / Math.PI);
    onRotate(((ang % 360) + 360) % 360);
  };
  const onUp = (e: React.PointerEvent) => {
    dragging.current = false;
    try {
      const el = e.currentTarget as Element;
      if ('hasPointerCapture' in el && el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    } catch { /* never captured */ }
  };

  return (
    <g pointerEvents="none">
      {/* outer ring — drag anywhere on the ring to rotate */}
      <circle cx={d.x} cy={d.y} r={R} fill="none" stroke={tone} strokeWidth="1" opacity="0.35" />
      <circle cx={d.x} cy={d.y} r={R} fill="none" stroke={tone} strokeWidth="6" opacity="0.001" pointerEvents="stroke"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ cursor: 'grab' }}
      />
      {/* tick marks every 30° */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = d.x + Math.cos(a) * (R - 2);
        const y1 = d.y + Math.sin(a) * (R - 2);
        const x2 = d.x + Math.cos(a) * (R + 2);
        const y2 = d.y + Math.sin(a) * (R + 2);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={tone} strokeWidth="0.6" opacity="0.5" />;
      })}
      {/* heading badge above the device */}
      <g transform={`translate(${d.x}, ${d.y - R - 10})`}>
        <rect x={-16} y={-7} width={32} height={14} rx={3} fill="var(--panel-background)" fillOpacity="0.85" stroke={tone} strokeWidth="0.6" />
        <text x={0} y={3} textAnchor="middle" fill="var(--foreground)" fontSize="10" fontWeight="700" fontFamily="ui-monospace, monospace">{d.rot}°</text>
      </g>
      {/* drag handle on the ring — slightly larger glow ring + the same
          .dv-cone-handle hover affordance so all draggable handles
          read consistently. */}
      <g pointerEvents="auto" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} className="dv-cone-handle" style={{ cursor: 'grab' }}>
        <circle cx={handleX} cy={handleY} r={7} fill={tone} opacity="0.22" />
        <circle cx={handleX} cy={handleY} r={3.6} fill={tone} stroke="var(--canvas-background)" strokeWidth="1.1" />
      </g>
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DEVICE GLYPHS — each looks like the physical hardware (top-down)
   ═══════════════════════════════════════════════════════════════════════ */

const DEVICE_ICON: Record<DeviceType, any> = {
  'cam.bullet': Video, 'cam.dome': Aperture, 'cam.ptz': ScanEye, 'cam.multisensor': Grid3x3,
  'cam.fisheye': Disc, 'cam.thermal': Flame, 'cam.lpr': Car, 'cam.body': UserSquare2,
  'acc.reader': ScanFace, 'acc.biometric': Fingerprint, 'acc.strike': KeyRound, 'acc.maglock': Lock,
  'acc.exit': DoorOpen, 'acc.turnstile': GitBranch, 'acc.intercom': Phone, 'acc.panic-bar': KeyRound, 'acc.dps': DoorOpen,
  'int.motion': Radar, 'int.glassbreak': AlertTriangle, 'int.contact': DoorOpen, 'int.panic': BellRing,
  'int.vibration': Vibrate, 'int.keypad': Hash,
  'net.switch': Cable, 'net.idf': Server, 'net.ap': Wifi, 'net.firewall': ShieldCheck, 'net.bridge': Antenna,
  'aud.speaker': Volume2, 'aud.horn': Megaphone, 'aud.amp': Speaker, 'aud.mic': Mic, 'aud.intercom': Phone,
  'sto.nvr': HardDrive, 'sto.server': Server, 'sto.archive': Database, 'sto.cloud': Cloud,
  'dis.monitor': Monitor, 'dis.wall': Tv2, 'dis.kiosk': AppWindow, 'dis.signage': MonitorSmartphone,
  'pwr.ups': BatteryCharging, 'pwr.poe': Zap, 'pwr.surge': ShieldAlert, 'pwr.solar': Sun,
  'sen.temp': Thermometer, 'sen.smoke': CloudFog, 'sen.water': Droplets, 'sen.occupancy': Users2,
  'sen.gas': Wind, 'sen.gunshot': CrosshairIcon,
  // Infrastructure — reused glyphs at small sizes; custom SVG renders for canvas in HardwareGlyph.
  'inf.door-single': DoorOpen, 'inf.door-double': DoorOpen,
  'inf.door-storefront': DoorOpen, 'inf.door-sliding': DoorOpen,
  'inf.window': AppWindow, 'inf.wall-brick': WallIcon, 'inf.wall-fire': Flame, 'inf.wall-concrete': WallIcon,
  'inf.gate-swing': GitBranch, 'inf.gate-slide': GitBranch, 'inf.elevator': Server,
  'inf.mdf': Server, 'inf.rack': Server,
  'cyb.endpoint': ShieldCheck, 'cyb.siem': BarChart3, 'cyb.firewall-ng': ShieldCheck, 'cyb.vpn': Lock,
  'fls.pull-station': BellRing, 'fls.fire-panel': AlertTriangle, 'fls.strobe': Sun, 'fls.sprinkler': Droplets,
  'bld.hvac-controller': Wind, 'bld.lighting-panel': Sun, 'bld.bms-gateway': Server,
};

// Modern device chip — used in InsertDock cards, layer rows, drag ghost, etc.
// Axis Site Designer-style minimal marker — white circle with thin colored ring and line glyph
// HardwareGlyph — Axis Site Designer style. Single-tone line glyphs drawn
// directly on the plan: no card backgrounds, no fills beyond the tone, no shading.
// Each device type reads as a tiny technical drawing of the actual hardware.
function HardwareGlyph({ d, tone, selected, scale = 1 }: { d: Device; tone: string; selected: boolean; scale?: number }) {
  const kind = TYPE_KIND[d.type];
  const rot = d.rot;
  const ink = tone;
  const sw = 1.4;
  const accKind = (d as any).accessoryKind as string | undefined;

  // Distinct technical glyphs for cable accessories. Drawn before the
  // generic kind-based branches so a patch panel / jack / pull box
  // reads correctly even though the underlying DeviceType is `net.switch`.
  if (accKind) {
    return (
      <g transform={`translate(${d.x}, ${d.y}) scale(${scale})`}>
        {/* Quiet knock-out behind the glyph so the symbol stays legible
            against the floorplan, no decorative tone halo. */}
        <circle r={12} fill="var(--canvas-background)" opacity="0.96" stroke={ink} strokeOpacity="0.55" strokeWidth="0.7" />
        <g fill="none" stroke={ink} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
          {(accKind === 'jack' || accKind === 'jack-shld' || accKind === 'jack-outdoor' || accKind === 'biscuit') && (
            <g>
              <rect x={-4} y={-6} width={8} height={12} rx={1.5} />
              <line x1={-2.5} y1={-3} x2={2.5} y2={-3} />
              <line x1={-2.5} y1={0}  x2={2.5} y2={0}  />
              <line x1={-2.5} y1={3}  x2={2.5} y2={3}  />
            </g>
          )}
          {(accKind === 'coupler' || accKind === 'coupler-rj45' || accKind === 'coupler-wp' || accKind === 'coupler-lc' || accKind === 'coupler-sc' || accKind === 'coupler-coax') && (
            <g>
              <line x1={-9} y1={0} x2={-3} y2={0} />
              <rect x={-3} y={-3} width={6} height={6} rx={1} />
              <line x1={3} y1={0} x2={9} y2={0} />
            </g>
          )}
          {(accKind === 'patchcord') && (
            <g>
              <path d="M -8 -4 C -2 -4 2 4 8 4" />
              <circle cx={-8} cy={-4} r={1.2} fill={ink} />
              <circle cx={8}  cy={4}  r={1.2} fill={ink} />
            </g>
          )}
          {(accKind === 'pp24' || accKind === 'pp48' || accKind === 'pp-fiber') && (
            <g>
              <rect x={-11} y={-4} width={22} height={8} rx={1.2} />
              {[-8.5,-6,-3.5,-1,1.5,4,6.5,9].map((x) => <line key={x} x1={x} y1={-2.5} x2={x} y2={2.5} strokeWidth={0.9} />)}
              <text x={0} y={6.5} textAnchor="middle" fontSize="3.4" fill={ink} stroke="none">{accKind === 'pp48' ? '48' : accKind === 'pp-fiber' ? 'FO' : '24'}</text>
            </g>
          )}
          {accKind === 'pullbox' && (
            <g>
              <rect x={-6} y={-6} width={12} height={12} rx={1} />
              <line x1={-6} y1={0} x2={-10} y2={0} />
              <line x1={6}  y1={0} x2={10}  y2={0} />
              <circle cx={-3.5} cy={-3.5} r={0.8} fill={ink} />
              <circle cx={ 3.5} cy={-3.5} r={0.8} fill={ink} />
              <circle cx={-3.5} cy={ 3.5} r={0.8} fill={ink} />
              <circle cx={ 3.5} cy={ 3.5} r={0.8} fill={ink} />
            </g>
          )}
          {accKind === 'jbox' && (
            <g>
              <rect x={-5.5} y={-5.5} width={11} height={11} rx={1.2} />
              <line x1={-5.5} y1={0} x2={-9} y2={0} />
              <line x1={5.5}  y1={0} x2={9} y2={0} />
            </g>
          )}
          {accKind === 'jhook' && (
            <g>
              <path d="M -7 -5 L -7 3 A 5 5 0 0 0 -2 8" />
              <path d="M  2 8 A 5 5 0 0 0  7 3 L 7 -5" />
            </g>
          )}
          {accKind === 'tray' && (
            <g>
              <rect x={-10} y={-3} width={20} height={6} />
              <line x1={-10} y1={-3} x2={-10} y2={6} />
              <line x1={10}  y1={-3} x2={10}  y2={6} />
              <line x1={-10} y1={6}  x2={10}  y2={6} />
            </g>
          )}
          {accKind === 'firestop' && (
            <g>
              <rect x={-7} y={-3} width={14} height={6} rx={1} />
              <path d="M -7 0 L -10 0 M 7 0 L 10 0" />
              <path d="M -3 -3 L 3 3 M 3 -3 L -3 3" strokeWidth={0.9} />
            </g>
          )}
          {accKind === 'sleeve' && (
            <g>
              <ellipse cx={0} cy={0} rx={9} ry={3} />
              <line x1={-9} y1={0} x2={-12} y2={0} />
              <line x1={9}  y1={0} x2={12} y2={0} />
            </g>
          )}
          {(accKind === 'wallplate' || accKind === 'surfmount') && (
            <g>
              <rect x={-7} y={-5} width={14} height={10} rx={0.8} />
              <rect x={-3} y={-2.5} width={6} height={5} />
            </g>
          )}
          {accKind === 'terminal' && (
            <g>
              <rect x={-9} y={-3} width={18} height={6} />
              {[-7,-4,-1,2,5,8].map((x) => <line key={x} x1={x} y1={-3} x2={x} y2={3} strokeWidth={0.7} />)}
            </g>
          )}
          {accKind === 'splice' && (
            <g>
              <rect x={-9} y={-4} width={18} height={8} rx={1.2} />
              <line x1={-5} y1={-1} x2={5} y2={-1} strokeWidth={0.7} />
              <line x1={-5} y1={1}  x2={5} y2={1}  strokeWidth={0.7} />
            </g>
          )}
          {accKind === 'mgr' && (
            <g>
              <rect x={-10} y={-2} width={20} height={4} />
              <line x1={-10} y1={0} x2={10} y2={0} strokeDasharray="2 2" strokeWidth={0.7} />
            </g>
          )}
        </g>
      </g>
    );
  }

  // Visual-redesign pass: when a SurveyorSymbol exists for this device
  // type, render the technical plan symbol. Otherwise fall back to the
  // legacy per-type SVG below so devices without a symbol stay visible.
  // No filled tone halo — the symbol IS the plan glyph.
  if (SURVEYOR_SYMBOL_HAS(d.type)) {
    // Drafting-restraint pass: the plan-symbol bodies render at 0.72x of
    // their natural 24-unit viewBox (≈ 17 px instead of 24 px) with a
    // 1.1-px hairline stroke. This matches the user-supplied benchmark
    // ("looks like a low-voltage construction drawing, not a SaaS HUD").
    // The hit-circle stays at its full 16-px touch radius — only the
    // visual glyph shrinks. Selected state replaces the dashed circle
    // with a thin solid outline at r=10.
    return (
      <g transform={`translate(${d.x}, ${d.y}) scale(${scale})`} style={{ color: ink }}>
        <g transform={`rotate(${rot})`}>
          <SurveyorSymbolBody id={d.type} scale={0.72} stroke={1.1} />
        </g>
        {isStackableHost(d.type) && (d.stack?.length ?? 0) > 0 && (
          <g transform="translate(8, -8)" pointerEvents="none">
            <circle r={4.4} fill="var(--card)" stroke={ink} strokeWidth={0.7} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={5.8} fill={ink} fontWeight={600}>
              {d.stack!.length}
            </text>
          </g>
        )}
        {selected && <circle r={10} fill="none" stroke={tone} strokeWidth="0.7" opacity="0.85" />}
      </g>
    );
  }

  return (
    <g transform={`translate(${d.x}, ${d.y}) scale(${scale})`}>
      {/* Quiet knock-out behind the glyph. The cartoon `tone halo`
          (opacity 0.10 colored blob) was removed — it read as a
          decorative blob on the plan. The remaining knock-out keeps
          the symbol legible against the floorplan rendering. */}
      <circle r={12} fill="var(--canvas-background)" opacity="0.96" stroke={ink} strokeOpacity="0.55" strokeWidth="0.7" />

      <g transform={`rotate(${rot})`} fill="none" stroke={ink} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
        {kind === 'camera' && d.type === 'cam.bullet' && (
          <g>
            {/* mounting arm */}
            <path d="M -11 5 L -8 -1 L -5 -1" />
            {/* barrel */}
            <rect x={-8} y={-5} width={15} height={10} rx={4} />
            {/* sunshade lip */}
            <line x1={-8} y1={-2.5} x2={7} y2={-2.5} />
            {/* lens face */}
            <circle cx={7} cy={0} r={3.2} />
            <circle cx={7} cy={0} r={1} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.dome' && (
          <g>
            {/* base plate */}
            <line x1={-10} y1={4} x2={10} y2={4} />
            {/* dome */}
            <path d="M -10 4 A 10 10 0 0 1 10 4" />
            {/* internal lens */}
            <circle cx={3} cy={0} r={2.4} />
            <circle cx={3} cy={0} r={0.9} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.ptz' && (
          <g>
            {/* ceiling line */}
            <line x1={-7} y1={-8} x2={7} y2={-8} />
            {/* pendant arm */}
            <line x1={0} y1={-8} x2={0} y2={-4} />
            {/* sphere */}
            <circle cx={0} cy={2} r={6} />
            {/* equator line */}
            <path d="M -6 2 A 6 6 0 0 1 6 2" />
            {/* forward lens */}
            <circle cx={3.5} cy={3} r={2} />
            <circle cx={3.5} cy={3} r={0.8} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.multisensor' && (
          <g>
            <line x1={-11} y1={4} x2={11} y2={4} />
            <path d="M -11 4 A 11 6 0 0 1 11 4" />
            {[-7, -2.4, 2.4, 7].map((x, i) => (
              <g key={i}>
                <circle cx={x} cy={1.6} r={1.5} />
                <circle cx={x} cy={1.6} r={0.5} fill={ink} stroke="none" />
              </g>
            ))}
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.fisheye' && (
          <g>
            <circle r={10} />
            <circle r={6.5} />
            <circle r={2.5} />
            <line x1={-10} y1={0} x2={10} y2={0} strokeWidth={0.7} />
            <line x1={0} y1={-10} x2={0} y2={10} strokeWidth={0.7} />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.thermal' && (
          <g>
            <path d="M -12 6 L -9 0 L -6 0" />
            <rect x={-9} y={-5} width={18} height={10} rx={1.5} />
            <rect x={-6} y={-3} width={8} height={6} />
            {[-4, -2, 0, 1.8].map((x) => <line key={x} x1={x} y1={-2.5} x2={x} y2={2.5} strokeWidth={0.6} />)}
            <circle cx={6} cy={0} r={2} />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.lpr' && (
          <g>
            <path d="M -13 6 L -10 0 L -7 0" />
            <rect x={-10} y={-4.5} width={20} height={9} rx={1.5} />
            <rect x={-7} y={-2.6} width={8} height={2.6} />
            <circle cx={6.5} cy={1} r={2.4} />
            <circle cx={6.5} cy={1} r={0.8} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.body' && (
          <g>
            <rect x={-4.5} y={-9} width={9} height={17} rx={1.6} />
            <line x1={-3} y1={-9} x2={3} y2={-9} strokeWidth={2.2} />
            <circle cx={0} cy={-3} r={2.2} />
            <circle cx={0} cy={-3} r={0.8} fill={ink} stroke="none" />
            <circle cx={0} cy={4} r={1.2} />
          </g>
        )}

        {kind === 'access' && (
          <g>
            <rect x={-4} y={-10} width={8} height={20} rx={1.4} />
            <circle cx={0} cy={-6} r={1} />
            <rect x={-2.6} y={-2.6} width={5.2} height={8} rx={1} />
            <line x1={-1.6} y1={-0.8} x2={1.6} y2={-0.8} strokeWidth={0.7} />
            <line x1={-1.6} y1={1} x2={1.6} y2={1} strokeWidth={0.7} />
            <line x1={-1.6} y1={2.8} x2={1.6} y2={2.8} strokeWidth={0.7} />
          </g>
        )}
        {kind === 'network' && (
          <g>
            <rect x={-12} y={-4} width={24} height={8} rx={1.2} />
            <line x1={-12} y1={-1.4} x2={12} y2={-1.4} />
            {[-8, -4.5, -1, 2.5, 6, 9.5].map((x) => <rect key={x} x={x - 0.8} y={0.4} width={1.6} height={2.8} rx={0.2} />)}
          </g>
        )}
        {kind === 'intrusion' && (
          <g>
            <path d="M -10 7 L 0 -10 L 10 7 Z" />
            <line x1={0} y1={-3} x2={0} y2={3} strokeWidth={2} />
            <circle cx={0} cy={5.2} r={0.8} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'audio' && (
          <g>
            <circle r={10} />
            <circle r={7} />
            <circle r={4} />
            <circle r={1.4} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'storage' && (
          <g>
            <rect x={-11} y={-7} width={22} height={14} rx={1.2} />
            {[-3.5, -0.5, 2.5].map((y) => <line key={y} x1={-9} y1={y} x2={9} y2={y} strokeWidth={0.8} />)}
            <circle cx={8} cy={-5} r={0.6} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'display' && (
          <g>
            <rect x={-12} y={-8} width={24} height={14} rx={1} />
            <line x1={-3} y1={6} x2={3} y2={6} />
            <line x1={-6} y1={8.5} x2={6} y2={8.5} strokeWidth={1.6} />
          </g>
        )}
        {kind === 'power' && (
          <g>
            <rect x={-8} y={-11} width={16} height={22} rx={1.4} />
            <line x1={-6} y1={-7} x2={6} y2={-7} />
            <path d="M -2 -3 L 2 -3 L 0 1 L 3 1 L -2 7 L 0 2 L -3 2 Z" />
          </g>
        )}
        {kind === 'sensor' && (
          <g>
            <line x1={-10} y1={4} x2={10} y2={4} />
            <path d="M -10 4 A 10 7 0 0 1 10 4" />
            {[-6, -2, 2, 6].map((x) => <line key={x} x1={x} y1={4} x2={x} y2={-3} strokeWidth={0.7} />)}
            <circle cx={0} cy={1} r={1} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'infrastructure' && d.type === 'inf.door-single' && (
          <g>
            {/* jamb */}
            <line x1={-11} y1={-9} x2={-11} y2={9} strokeWidth={2} />
            {/* swing arc */}
            <path d="M -11 9 A 18 18 0 0 1 7 -9" strokeDasharray="2 1.5" strokeWidth={0.8} />
            {/* door panel */}
            <line x1={-11} y1={9} x2={7} y2={-9} strokeWidth={1.6} />
            <circle cx={5} cy={-6} r={0.9} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'infrastructure' && d.type === 'inf.door-double' && (
          <g>
            <line x1={-12} y1={-9} x2={-12} y2={9} strokeWidth={2} />
            <line x1={12} y1={-9} x2={12} y2={9} strokeWidth={2} />
            <path d="M -12 9 A 14 14 0 0 1 0 -3" strokeDasharray="2 1.5" strokeWidth={0.8} />
            <path d="M 12 9 A 14 14 0 0 0 0 -3" strokeDasharray="2 1.5" strokeWidth={0.8} />
            <line x1={-12} y1={9} x2={0} y2={-3} strokeWidth={1.4} />
            <line x1={12} y1={9} x2={0} y2={-3} strokeWidth={1.4} />
          </g>
        )}
        {kind === 'infrastructure' && d.type === 'inf.door-storefront' && (
          <g>
            <rect x={-13} y={-8} width={26} height={16} strokeWidth={1.4} />
            <line x1={0} y1={-8} x2={0} y2={8} strokeWidth={2.2} />
            {[-9, 5].map((x) => <rect key={x} x={x} y={-5} width={4} height={10} strokeWidth={0.6} />)}
          </g>
        )}
        {kind === 'infrastructure' && d.type === 'inf.door-sliding' && (
          <g>
            <line x1={-12} y1={-2} x2={12} y2={-2} strokeWidth={2} />
            <line x1={-12} y1={2} x2={0} y2={2} strokeWidth={2} />
            <line x1={0} y1={6} x2={12} y2={6} strokeWidth={2} />
            <path d="M 0 0 L 3 2 L 0 4" strokeWidth={1} />
          </g>
        )}
        {kind === 'infrastructure' && (d.type === 'inf.gate-swing' || d.type === 'inf.gate-slide') && (
          <g>
            <line x1={-12} y1={0} x2={12} y2={0} strokeWidth={2.2} />
            {[-9, -5, -1, 3, 7].map((x) => <line key={x} x1={x} y1={-6} x2={x} y2={6} strokeWidth={0.7} />)}
            {d.type === 'inf.gate-swing' && <path d="M -12 0 A 14 14 0 0 1 0 -10" strokeDasharray="2 1.5" strokeWidth={0.8} />}
          </g>
        )}
        {kind === 'infrastructure' && d.type === 'inf.elevator' && (
          <g>
            <rect x={-9} y={-10} width={18} height={20} rx={1} />
            <line x1={0} y1={-10} x2={0} y2={10} strokeWidth={2} />
            <path d="M -3 -4 L 0 -7 L 3 -4 M -3 4 L 0 7 L 3 4" strokeWidth={0.8} />
          </g>
        )}
        {kind === 'infrastructure' && d.type === 'inf.window' && (
          <g>
            <rect x={-12} y={-5} width={24} height={10} strokeWidth={1.4} />
            <line x1={-12} y1={0} x2={12} y2={0} strokeWidth={0.6} />
            <line x1={0} y1={-5} x2={0} y2={5} strokeWidth={0.6} />
          </g>
        )}
        {kind === 'infrastructure' && (d.type === 'inf.rack' || d.type === 'inf.mdf') && (
          <g>
            <rect x={-8} y={-11} width={16} height={22} rx={1} strokeWidth={1.4} />
            {[-7, -3, 1, 5, 9].map((y) => <line key={y} x1={-7} y1={y} x2={7} y2={y} strokeWidth={0.6} />)}
            {d.type === 'inf.mdf' && (
              <text x={0} y={3} textAnchor="middle" fontSize={6} fill={ink} stroke="none">MDF</text>
            )}
          </g>
        )}
        {kind === 'cyber' && (
          <g>
            <path d="M -9 -6 L 0 -10 L 9 -6 L 9 4 L 0 10 L -9 4 Z" strokeWidth={1.4} />
            <path d="M -3 0 L -1 2 L 4 -3" strokeWidth={1.6} />
          </g>
        )}
        {kind === 'fire' && (
          <g>
            <path d="M 0 -10 L 6 -2 L 4 -2 L 8 6 L -8 6 L -4 -2 L -6 -2 Z" strokeWidth={1.4} />
          </g>
        )}
        {kind === 'building' && (
          <g>
            <rect x={-8} y={-9} width={16} height={18} strokeWidth={1.4} />
            {[-6, -2, 2, 6].map((x) => [-6, -2, 2].map((y) => (
              <rect key={`${x}-${y}`} x={x - 0.6} y={y - 0.6} width={1.2} height={1.2} fill={ink} stroke="none" />
            )))}
          </g>
        )}
        {kind === 'infrastructure' && (d.type === 'inf.wall-brick' || d.type === 'inf.wall-fire' || d.type === 'inf.wall-concrete') && (
          <g>
            <rect x={-12} y={-3.5} width={24} height={7} strokeWidth={1.2} />
            {d.type === 'inf.wall-brick' && (
              <>
                <line x1={-6} y1={-3.5} x2={-6} y2={3.5} strokeWidth={0.5} />
                <line x1={0} y1={-3.5} x2={0} y2={3.5} strokeWidth={0.5} />
                <line x1={6} y1={-3.5} x2={6} y2={3.5} strokeWidth={0.5} />
                <line x1={-9} y1={0} x2={9} y2={0} strokeWidth={0.5} />
              </>
            )}
            {d.type === 'inf.wall-fire' && (
              <g>
                <path d="M -3 -1 L 0 -4 L 3 -1 L 1 1 L 3 3 L 0 5 L -3 3 L -1 1 Z" strokeWidth={0.9} />
              </g>
            )}
            {d.type === 'inf.wall-concrete' && (
              <>
                <circle cx={-7} cy={0} r={1} strokeWidth={0.5} />
                <circle cx={0} cy={0} r={1} strokeWidth={0.5} />
                <circle cx={7} cy={0} r={1} strokeWidth={0.5} />
              </>
            )}
          </g>
        )}
      </g>

      {/* Stack-count chip — visible only on stackable hosts that have at
          least one accessory in their stack. Drawn at top-right of the
          glyph so it never collides with the lens (cameras) or jamb (doors).
          Click handling is owned by the surface picker; the chip itself is
          render-only. */}
      {isStackableHost(d.type) && (d.stack?.length ?? 0) > 0 && (
        <g transform="translate(12, -12)" pointerEvents="none">
          <circle r={6.5} fill="#1F2738" stroke={tone} strokeWidth={0.9} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={7.5} fill={tone} fontWeight={600}>
            {d.stack!.length}
          </text>
        </g>
      )}

      {/* Selection ring */}
      {selected && <circle r={15} fill="none" stroke={tone} strokeWidth="1.5" strokeDasharray="3 2" />}
    </g>
  );
}

const KIND_INITIAL: Record<DeviceKind, string> = {
  camera: 'C', access: 'A', network: 'N', intrusion: '!',
  audio: '♪', storage: 'R', display: '▢', power: '⚡', sensor: '°', infrastructure: '◰',
  cyber: '⌬', fire: '!', building: '◧',
};

function IsoDeviceBadge({ d }: { d: Device }) {
  const tone = deviceTone(d);
  const Icon = DEVICE_ICON[d.type];
  return (
    <div style={{ width: 56, position: 'relative', textAlign: 'center', userSelect: 'none', fontFamily: 'inherit' }}>
      <div style={{ position: 'relative', width: 32, height: 32, margin: '0 auto' }}>
        <div style={{ width: 32, height: 32, borderRadius: 999, background: '#FFFFFF', boxShadow: `inset 0 0 0 2px ${tone}, 0 2px 6px rgba(15,23,42,0.18)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 16, height: 16, color: tone }} strokeWidth={2.2} />
        </div>
      </div>
      <div style={{ marginTop: 4, display: 'inline-block', padding: '1px 7px', background: 'rgba(255,255,255,0.95)', color: '#1F2937', borderRadius: 3, fontSize: 10, fontWeight: 600, border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 3px rgba(15,23,42,0.12)', whiteSpace: 'nowrap' }}>
        {d.id}
      </div>
    </div>
  );
}

function DeviceGlyph({ type, size, tone }: { type: DeviceType; size: number; tone: string }) {
  const Icon = DEVICE_ICON[type] ?? Video;
  return (
    <span className="inline-flex items-center justify-center" style={{ width: size, height: size, color: tone }}>
      <Icon style={{ width: size, height: size }} strokeWidth={1.9} />
    </span>
  );
}

// SVG path version kept for use inside the canvas SVG layer (presence cursors etc.)
// Kept as a no-op fallback in case anything still references it.
function DeviceGlyphPaths({ type, tone }: { type: DeviceType; tone: string }) {
  const s = 1;
  switch (type) {
    case 'cam.bullet':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-10" y="-5" width="20" height="10" rx="2" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          <circle cx="8" cy="0" r="3.5" fill="var(--canvas-background)" />
          <circle cx="8" cy="0" r="1.6" fill={tone} />
          <rect x="-11" y="-2" width="3" height="4" fill="var(--canvas-background)" />
        </g>
      );
    case 'cam.dome':
      return (
        <g transform={`scale(${s})`}>
          <circle r="10" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          <circle r="6" fill="var(--canvas-background)" />
          <circle r="3" fill={tone} />
        </g>
      );
    case 'cam.ptz':
      return (
        <g transform={`scale(${s})`}>
          <circle r="11" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          <path d="M -7 -2 A 7 7 0 0 1 7 -2" fill="none" stroke="var(--canvas-background)" strokeWidth="1.5" />
          <circle r="3.5" fill="var(--canvas-background)" />
          <polygon points="7,-4 11,-2 7,0" fill="var(--canvas-background)" />
        </g>
      );
    case 'cam.multisensor':
      return (
        <g transform={`scale(${s})`}>
          <circle r="12" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          {[[-5,-5],[5,-5],[-5,5],[5,5]].map(([x,y],i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill="var(--canvas-background)" />
              <circle cx={x} cy={y} r="1.4" fill={tone} />
            </g>
          ))}
        </g>
      );
    case 'cam.fisheye':
      return (
        <g transform={`scale(${s})`}>
          <circle r="11" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          <circle r="7" fill="var(--canvas-background)" />
          <circle r="3" fill={tone} />
          <line x1="-11" y1="0" x2="11" y2="0" stroke="var(--canvas-background)" strokeWidth="0.8" />
          <line x1="0" y1="-11" x2="0" y2="11" stroke="var(--canvas-background)" strokeWidth="0.8" />
        </g>
      );
    case 'cam.thermal':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-10" y="-6" width="20" height="12" rx="2" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          <rect x="-7" y="-3" width="14" height="6" fill="var(--canvas-background)" />
          <text x="0" y="2" textAnchor="middle" fill={tone} fontSize="6" fontWeight="700">TH</text>
        </g>
      );
    case 'acc.reader':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-4" y="-11" width="8" height="22" rx="1.5" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          <circle cx="0" cy="-7" r="1.6" fill="var(--canvas-background)" />
          <rect x="-2.5" y="-3" width="5" height="9" rx="0.5" fill="var(--canvas-background)" />
        </g>
      );
    case 'acc.strike':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-10" y="-4" width="20" height="8" rx="1.5" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          <rect x="-3" y="-2" width="6" height="4" fill="var(--canvas-background)" />
          <rect x="-3" y="-1" width="6" height="2" fill={tone} />
        </g>
      );
    case 'acc.maglock':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-12" y="-3" width="24" height="6" rx="1" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          <rect x="-10" y="-1.5" width="3" height="3" fill="var(--canvas-background)" />
          <rect x="7" y="-1.5" width="3" height="3" fill="var(--canvas-background)" />
        </g>
      );
    case 'acc.exit':
      return (
        <g transform={`scale(${s})`}>
          <circle r="9" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          <circle r="5" fill="var(--canvas-background)" />
          <path d="M -2 0 L 0 -2 L 2 0 L 0 2 Z" fill={tone} />
        </g>
      );
    case 'net.switch':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-12" y="-5" width="24" height="10" rx="1.5" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          {[-8,-4,0,4,8].map((x,i) => <rect key={i} x={x-1} y={-1.5} width="2" height="3" fill="var(--canvas-background)" />)}
        </g>
      );
    case 'net.idf':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-9" y="-12" width="18" height="24" rx="1.5" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          {[-8,-4,0,4,8].map((y,i) => <rect key={i} x={-6} y={y-1} width="12" height="2" fill="var(--canvas-background)" />)}
        </g>
      );
    case 'net.ap':
      return (
        <g transform={`scale(${s})`}>
          <circle r="11" fill={tone} stroke="var(--canvas-background)" strokeWidth="1.5" />
          <circle r="7" fill="none" stroke="var(--canvas-background)" strokeWidth="1.2" />
          <circle r="3.5" fill="none" stroke="var(--canvas-background)" strokeWidth="1.2" />
          <circle r="1.5" fill="var(--canvas-background)" />
        </g>
      );
  }
}

const KIND_ICON: Record<DeviceKind, any> = {
  camera: Video, access: ScanFace, network: Cable, intrusion: Radar,
  audio: Volume2, storage: HardDrive, display: Monitor, power: BatteryCharging, sensor: Thermometer,
  infrastructure: DoorOpen, cyber: ShieldCheck, fire: Flame, building: Server,
};

function CategoryGlyph({ kind, active }: { kind: DeviceKind; active?: boolean }) {
  const Icon = KIND_ICON[kind];
  return <Icon style={{ width: 14, height: 14 }} strokeWidth={2} />;
}

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

function ToolbarButton({ a, tone }: { a: ToolbarAction; tone: string }) {
  const Icon = a.icon;
  // a.tone overrides the device-level tone (lens chips use their own color).
  const buttonTone = a.tone ?? tone;
  const accent = a.primary ? buttonTone : 'rgba(226,232,240,0.85)';
  // The primary action gets a soft tinted background instead of a neon
  // underline — a quieter signal that reads as "this is the main thing"
  // without shouting. Sentence-case label, tighter tracking, all-of-a-piece
  // with the rest of the contextual strip.
  return (
    <button
      onClick={a.onClick}
      title={a.label}
      className="group relative px-3 inline-flex items-center gap-1.5 border-r border-white/8 transition-colors duration-150 hover:bg-white/[0.05]"
      style={{
        color: accent,
        background: a.primary ? `${buttonTone}14` : 'transparent',
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[11px] font-medium tracking-tight">{a.label}</span>
    </button>
  );
}

function MultisensorLensChips({
  activeLens, setActiveLens, lensMode, setLensMode, tone, onLensHover,
}: { activeLens: ActiveLens; setActiveLens: (l: ActiveLens) => void; lensMode: LensMode; setLensMode: (m: LensMode) => void; tone: string; onLensHover?: (lens: LensId | null) => void }) {
  // Refined lens selector. Each chip carries its lens color as a small dot
  // that scales up subtly when active — the only motion needed for a feel
  // of premium tactility. No uppercase tracking; no neon underlines; the
  // chip background tints in the lens's own color when selected, which
  // pairs visually with the cone-color screen-blend on the canvas.
  return (
    <div
      className="mb-1.5 flex items-stretch h-8 rounded-lg overflow-hidden text-[11px]"
      style={{
        background: 'var(--panel-background)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 10px 28px -14px rgba(0,0,0,0.5)',
        animation: 'lens-chip-in 240ms cubic-bezier(0.22, 1, 0.36, 1) 60ms both',
      }}
    >
      <button
        onClick={() => setActiveLens('all')}
        className="px-3 inline-flex items-center gap-1.5 border-r border-white/8 transition-colors duration-150 hover:bg-white/[0.04]"
        style={{
          background: activeLens === 'all' ? `${tone}28` : 'transparent',
          color: activeLens === 'all' ? '#F8FAFC' : 'rgba(148,163,184,0.85)',
          boxShadow: activeLens === 'all' ? `inset 0 -1.5px 0 ${tone}` : 'none',
        }}
        title="Control all four lenses together"
      >
        <span className="font-medium tracking-tight">All</span>
      </button>
      {(['a', 'b', 'c', 'd'] as const).map((l) => {
        const active = activeLens === l;
        const lensColor = LENS_TONE[l];
        return (
          <button
            key={l}
            onClick={() => setActiveLens(l)}
            onPointerEnter={() => onLensHover?.(l)}
            onPointerLeave={() => onLensHover?.(null)}
            className="px-3 inline-flex items-center gap-1.5 border-r border-white/8 transition-colors duration-150 hover:bg-white/[0.04]"
            style={{
              // Active chip is more clearly distinguished: a stronger
              // lens-tinted background plus a bottom indicator line in
              // the same lens color. Easier to pair "this chip" → "that
              // cone" at a glance.
              background: active ? `${lensColor}2A` : 'transparent',
              color: active ? '#F8FAFC' : 'rgba(148,163,184,0.85)',
              boxShadow: active ? `inset 0 -1.5px 0 ${lensColor}` : 'none',
            }}
            title={`Edit lens ${LENS_LABEL[l]} only — hover to highlight on canvas`}
          >
            <span
              className="rounded-full transition-all duration-200 ease-out"
              style={{
                width: active ? 8 : 5,
                height: active ? 8 : 5,
                background: active ? lensColor : 'rgba(100,116,139,0.7)',
                boxShadow: active ? `0 0 8px ${lensColor}AA` : 'none',
              }}
            />
            <span className="font-medium tracking-tight">{LENS_LABEL[l]}</span>
          </button>
        );
      })}
      <button
        onClick={() => setLensMode(lensMode === 'linked' ? 'independent' : 'linked')}
        className="px-3 inline-flex items-center gap-1.5 transition-colors duration-150 hover:bg-white/[0.04]"
        style={{ color: lensMode === 'linked' ? tone : 'rgba(148,163,184,0.85)' }}
        title={lensMode === 'linked' ? 'Linked — moving one lens moves all four' : 'Independent — each lens moves alone'}
      >
        {lensMode === 'linked' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
        <span className="font-medium tracking-tight">{lensMode === 'linked' ? 'Linked' : 'Indep.'}</span>
      </button>
    </div>
  );
}

function SelectionPill({ d, zoom, pan, onRotate, onDelete, onUpdate, onEdit, onTargetSim, onDuplicate, onOpenTab, activeLens, setActiveLens, lensMode, setLensMode, onLensHover, isLocked, onToggleLock }: {
  d: Device; zoom: number; pan: { x: number; y: number };
  onRotate: (r: number) => void;
  onDelete: () => void;
  onUpdate: (p: Partial<Device>) => void;
  onEdit: () => void;
  onTargetSim: () => void;
  onDuplicate: () => void;
  onOpenTab: (t: EditTab) => void;
  activeLens: ActiveLens;
  setActiveLens: (l: ActiveLens) => void;
  lensMode: LensMode;
  setLensMode: (m: LensMode) => void;
  /** Carries lens-chip hover state up to the parent so the matching
   *  cone on the canvas can subtly emphasize. Optional — single-lens
   *  cameras don't use it. */
  onLensHover?: (lens: LensId | null) => void;
  /** Pass 1.2 — whether this device's id is in lockedIds, and a
   *  toggle callback that flips it. The pill shows a Lock / Unlock
   *  button and decorates the rest of its controls (delete, rotate,
   *  duplicate) as disabled-looking when isLocked is true. */
  isLocked?: boolean;
  onToggleLock?: () => void;
}) {
  const product = PRODUCTS.find((p) => p.id === d.product);
  const kind = TYPE_KIND[d.type];
  // Per-object color override beats the category tone. SelectionPill dot
  // and primary-action backgrounds use this so the chosen color shows up
  // immediately when the user picks one.
  const tone = deviceTone(d);
  const isCam = kind === 'camera';
  const isMultisensor = d.type === 'cam.multisensor';
  const isDoor = isStackableHost(d.type);
  const isReader = d.type === 'acc.reader' || d.type === 'acc.biometric';
  const isIDF = d.type === 'net.idf' || d.type === 'net.mdf' || d.type === 'net.switch';
  const isPathway = kind === 'network' && !isIDF && !isReader;
  const [colorOpen, setColorOpen] = useState(false);

  // Edge-clamping against a *safe rect*, not the raw canvas container.
  // The canvas surface div sits behind the left tool rail and the bottom
  // device tray (and, when open, the right edit drawer). Clamping to the
  // raw container would let the pill hide under those overlays — exactly
  // what the surveyor was complaining about. So we measure the chrome
  // elements (`[data-canvas-chrome]`) and subtract their footprint from
  // the container rect to get the area where the pill is actually
  // visible. Anchor includes `pan` because the canvas SVG's group is
  // translated by pan — the HTML pill is not, so we compose by hand.
  const pillRef = useRef<HTMLDivElement | null>(null);
  const [pillBox, setPillBox] = useState<{ w: number; h: number }>({ w: 220, h: 32 });
  // Safe rect in container-local coordinates (origin = parent's top-left).
  const [safeRect, setSafeRect] = useState<{ left: number; right: number; top: number; bottom: number }>({ left: 0, right: 1200, top: 0, bottom: 800 });
  useLayoutEffect(() => {
    if (!pillRef.current) return;
    const el = pillRef.current;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setPillBox({ w: r.width, h: r.height });
      const parent = el.parentElement;
      if (!parent) return;
      const cRect = parent.getBoundingClientRect();
      // Start with the whole container in container-local coords.
      let safeLeft = 0;
      let safeRight = cRect.width;
      let safeTop = 0;
      let safeBottom = cRect.height;
      // Subtract every chrome overlay that overlaps the container.
      const chrome = document.querySelectorAll('[data-canvas-chrome]');
      chrome.forEach((node) => {
        const r2 = (node as HTMLElement).getBoundingClientRect();
        if (r2.width === 0 || r2.height === 0) return;
        // Translate chrome rect into container-local coords.
        const cl = r2.left - cRect.left;
        const cr = r2.right - cRect.left;
        const ct = r2.top - cRect.top;
        const cb = r2.bottom - cRect.top;
        // Only consider overlays that overlap the container rect.
        if (cr <= 0 || cl >= cRect.width || cb <= 0 || ct >= cRect.height) return;
        const kind = (node as HTMLElement).getAttribute('data-canvas-chrome');
        if (kind === 'rail') {
          // Left rail occupies the left edge — push safeLeft to its right edge.
          safeLeft = Math.max(safeLeft, cr);
        } else if (kind === 'tray') {
          // Bottom tray (and any tray panel above the bar) — push safeBottom up.
          safeBottom = Math.min(safeBottom, ct);
        } else if (kind === 'drawer') {
          // Right edit drawer — push safeRight to its left edge.
          safeRight = Math.min(safeRight, cl);
        } else if (kind === 'topbar') {
          safeTop = Math.max(safeTop, cb);
        }
      });
      setSafeRect({ left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    // Re-measure when canvas chrome appears / resizes (tray opens, drawer slides in).
    const chromeNodes = document.querySelectorAll('[data-canvas-chrome]');
    chromeNodes.forEach((n) => ro.observe(n as Element));
    window.addEventListener('resize', measure);
    // Re-measure on every animation frame for a short window after mount so
    // we catch the bottom tray's mount-time layout shifts.
    let raf = 0;
    let ticks = 0;
    const tick = () => { measure(); if (++ticks < 6) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); cancelAnimationFrame(raf); };
  }, [d.id, d.type]);
  // Screen-space anchor of the device (top-center of the pill points at the device).
  const anchorX = d.x * zoom + pan.x;
  const anchorY = d.y * zoom + pan.y;
  const PAD = 10;
  const GAP = 22; // distance from device glyph to pill body
  // Try placing pill ABOVE the device first; flip below if it would crash
  // into the top of the safe rect (top bar / above-canvas chrome).
  const wantsBelow = anchorY - pillBox.h - GAP < safeRect.top + PAD;
  let topPx = wantsBelow ? anchorY + GAP : anchorY - pillBox.h - GAP;
  // If the below placement also crashes into the bottom tray, push the
  // pill up just inside the safe-bottom and accept overlap with the glyph.
  if (topPx + pillBox.h > safeRect.bottom - PAD) {
    topPx = Math.max(safeRect.top + PAD, safeRect.bottom - PAD - pillBox.h);
  }
  // Clamp left so the pill body stays fully inside the safe rect, never
  // behind the left rail.
  const halfW = pillBox.w / 2;
  const minLeft = safeRect.left + PAD + halfW;
  const maxLeft = Math.max(minLeft, safeRect.right - PAD - halfW);
  const leftPx = Math.min(Math.max(anchorX, minLeft), maxLeft);
  // Tether offset (signed) — where the device sits horizontally relative to
  // the pill's center. We move the tether to follow the device so it still
  // points at the glyph after a clamp.
  const tetherDx = anchorX - leftPx;

  // Build toolbar actions per device kind. Each kind exposes at most 5
  // primary actions; the rest fall into the "More" overflow popover. The
  // primary set is chosen for the most frequent operations during that
  // device's lifecycle (e.g. cameras: rotate + FOV; doors: electrify +
  // reader + egress). Less-used controls (link, note, schedule, target
  // sim, delete) move behind More so the toolbar stays calm.
  const actions: ToolbarAction[] = (() => {
    // SelectionPill primary row is intentionally minimal — Edit / Duplicate /
    // Delete + a "More" overflow. All kind-specialized actions (Rotate, FOV,
    // Lens mode, Hardware, Electrify, Egress, Switches, PoE, Cable, etc.)
    // are accessible from the overflow popover and from the EditDrawer
    // tiles. This keeps the floating toolbar uncluttered and Edit-first so
    // the surveyor reaches the deep settings via the right-side drawer
    // instead of fighting a wide button row near the cursor.
    const primary: ToolbarAction[] = [
      { id: 'edit', icon: Settings2, label: 'Edit',      onClick: () => onOpenTab('overview'), primary: true },
      { id: 'dup',  icon: Copy,      label: 'Duplicate', onClick: onDuplicate },
      { id: 'del',  icon: Trash2,    label: 'Delete',    onClick: onDelete, danger: true },
    ];
    // Per-kind overflow — what was previously in the visible row now lands
    // here behind the "More" popover. Same handlers / labels; just one
    // click further from the cursor.
    const overflow: ToolbarAction[] = [];
    if (isMultisensor) {
      overflow.push(
        { id: 'lens',   icon: Aperture,      label: 'Lens',         onClick: () => onOpenTab('lens'), overflow: true },
        { id: 'mode',   icon: lensMode === 'linked' ? Lock : Unlock,
          label: lensMode === 'linked' ? 'Linked' : 'Indep',
          onClick: () => setLensMode(lensMode === 'linked' ? 'independent' : 'linked'), overflow: true },
        { id: 'target', icon: ScanFace,      label: 'Target sim',   onClick: onTargetSim, overflow: true },
        { id: 'auto',   icon: Sparkles,      label: 'AI optimize',  onClick: () => onOpenTab('ai'), overflow: true },
        { id: 'note',   icon: MessageSquare, label: 'Note',         onClick: () => onOpenTab('notes'), overflow: true },
      );
    } else if (isCam) {
      overflow.push(
        { id: 'rotate', icon: RotateCw,      label: 'Rotate 15°',   onClick: () => onRotate((d.rot + 15) % 360), overflow: true },
        { id: 'fov',    icon: Aperture,      label: 'FOV',          onClick: () => onOpenTab('lens'), overflow: true },
        { id: 'ai',     icon: Sparkles,      label: 'AI optimize',  onClick: () => onOpenTab('ai'), overflow: true },
        { id: 'target', icon: ScanFace,      label: 'Target sim',   onClick: onTargetSim, overflow: true },
        { id: 'link',   icon: GitBranch,     label: 'Link path',    onClick: () => onOpenTab('linked'), overflow: true },
        { id: 'note',   icon: MessageSquare, label: 'Note',         onClick: () => onOpenTab('notes'), overflow: true },
      );
    } else if (isReader) {
      overflow.push(
        { id: 'linkdoor', icon: KeyRound,    label: 'Link door',    onClick: () => onOpenTab('linked'), overflow: true },
        { id: 'mount',    icon: Crosshair,   label: 'Mount',        onClick: () => onOpenTab('mounting'), overflow: true },
        { id: 'validate', icon: ShieldCheck, label: 'Validate',     onClick: () => onOpenTab('compliance'), overflow: true },
        { id: 'ai',       icon: Sparkles,    label: 'AI hint',      onClick: () => onOpenTab('ai'), overflow: true },
        { id: 'note',     icon: MessageSquare, label: 'Note',       onClick: () => onOpenTab('notes'), overflow: true },
      );
    } else if (isDoor) {
      overflow.push(
        { id: 'hardware', icon: KeyRound,    label: 'Hardware',     onClick: () => onOpenTab('linked'), overflow: true },
        { id: 'elec',     icon: Zap,         label: 'Electrify',    onClick: () => onOpenTab('power'), overflow: true },
        { id: 'egress',   icon: DoorOpen,    label: 'Egress',       onClick: () => onOpenTab('compliance'), overflow: true },
        { id: 'validate', icon: ShieldCheck, label: 'Validate',     onClick: () => onOpenTab('ai'), overflow: true },
        { id: 'link',     icon: GitBranch,   label: 'Pathway',      onClick: () => onOpenTab('linked'), overflow: true },
      );
    } else if (isIDF) {
      overflow.push(
        { id: 'switches', icon: Server,          label: 'Switches', onClick: () => onOpenTab('network'), overflow: true },
        { id: 'poe',      icon: BatteryCharging, label: 'PoE',      onClick: () => onOpenTab('power'), overflow: true },
        { id: 'links',    icon: GitBranch,       label: 'Links',    onClick: () => onOpenTab('linked'), overflow: true },
        { id: 'ups',      icon: Zap,             label: 'UPS',      onClick: () => onOpenTab('power'), overflow: true },
        { id: 'failure',  icon: AlertTriangle,   label: 'Failure analysis', onClick: () => onOpenTab('ai'), overflow: true },
      );
    } else if (isPathway) {
      overflow.push(
        { id: 'bend',    icon: CircleDot, label: 'Add bend',      onClick: () => onOpenTab('linked'), overflow: true },
        { id: 'pull',    icon: Hash,      label: 'Add pull box',  onClick: () => onOpenTab('mounting'), overflow: true },
        { id: 'cable',   icon: Cable,     label: 'Cable',         onClick: () => onOpenTab('network'), overflow: true },
        { id: 'ai-path', icon: Sparkles,  label: 'AI optimize',   onClick: () => onOpenTab('ai'), overflow: true },
        { id: 'fill',    icon: BarChart3, label: 'Fill %',        onClick: () => onOpenTab('telemetry'), overflow: true },
      );
    } else {
      overflow.push(
        { id: 'note', icon: MessageSquare, label: 'Note', onClick: () => onOpenTab('notes'), overflow: true },
      );
    }
    return [...primary, ...overflow];
  })();
  const primaryActions = actions.filter((a) => !a.overflow);
  const overflowActions = actions.filter((a) => a.overflow);
  const focal = (d.type === 'cam.ptz' ? 4.3 + ((d.rot % 30) / 30) * 25 : d.type === 'cam.fisheye' ? 1.4 : 2.8 + ((Math.abs(d.rot) % 60) / 60) * 6).toFixed(1);
  const doriRange = d.type === 'cam.ptz' ? 64 : d.type === 'cam.fisheye' ? 14 : 28;
  const kindLabel = isCam ? 'Camera' : isDoor ? 'Opening' : isIDF ? 'Network Node' : isPathway ? 'Pathway' : 'Device';

  return (
    <div
      ref={pillRef}
      className="absolute z-30 pointer-events-auto select-none"
      style={{
        left: leftPx,
        top: topPx,
        transform: 'translateX(-50%)',
        animation: 'pill-in 180ms ease-out both',
      }}
    >
      {/* Subtle tether — single hairline pencil from pill to device. Tether
          follows the device horizontally so that clamping the pill at a
          viewport edge still points back at the glyph. Hidden when the pill
          flipped below the device (visual would be inverted). */}
      {!wantsBelow && (
        <div
          className="absolute top-full w-px"
          style={{
            left: `calc(50% + ${tetherDx}px)`,
            transform: 'translateX(-0.5px)',
            height: GAP - 2,
            background: 'var(--border)',
            opacity: 0.55,
          }}
        />
      )}

      {/* Multisensor lens chips sit above the strip when applicable. */}
      {isMultisensor && (
        <MultisensorLensChips
          activeLens={activeLens} setActiveLens={setActiveLens}
          lensMode={lensMode} setLensMode={setLensMode}
          tone={tone}
          onLensHover={onLensHover}
        />
      )}

      {/* Minimal selection pill — field-ready redesign.
          Identity strip with status dot · ID · type · Expand · Edit.
          Nothing else. The previous 5-button toolbar moved into the
          Expand menu so the canvas reads as a calm engineering drawing
          rather than a HUD. */}
      <div
        className="flex items-stretch h-8 rounded-md overflow-hidden"
        style={{
          background: 'var(--panel-background)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid var(--border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
        }}
      >
        {/* Identity */}
        <div className="flex items-center gap-2 pl-2.5 pr-3 border-r border-border/60">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: tone }}
            title="Online"
          />
          <CommitInput
            value={d.id}
            onCommit={(v) => onUpdate({ id: v })}
            className="bg-transparent w-[64px] focus:outline-none text-[11.5px] font-medium tracking-tight text-foreground"
          />
          <span className="text-[10.5px] text-muted-foreground tracking-tight whitespace-nowrap">
            {kindLabel.toLowerCase()}
          </span>
        </div>

        {/* Expand — opens a small popover with secondary actions */}
        <ExpandMenu
          d={d}
          tone={tone}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onOpenTab={onOpenTab}
          currentColor={d.color}
          onPickColor={(hex) => onUpdate({ color: hex || undefined })}
        />

        {/* Edit — single explicit affordance that opens the right drawer */}
        <button
          onClick={() => onOpenTab('overview')}
          title="Edit details"
          data-track="pill-edit"
          className="px-3 inline-flex items-center gap-1.5 text-[12px] font-medium border-l border-border/60 text-foreground hover:bg-secondary/30 transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" style={{ color: tone }} />
          Edit
        </button>
        {/* Duplicate — promoted to a visible pill button (was inside the
            More popover). Matches the "minimal Edit-first toolbar" spec:
            identity · Edit · Lock · Duplicate · Delete · More. */}
        <button
          onClick={onDuplicate}
          title="Duplicate"
          data-track="pill-duplicate"
          className={`px-2.5 inline-flex items-center justify-center border-l border-border/60 transition-colors ${isLocked ? 'text-muted-foreground/40 cursor-not-allowed' : 'text-muted-foreground hover:bg-secondary/30 hover:text-foreground'}`}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        {/* Lock toggle — Canvas V2 Pass 1.2. Visible state so the
            operator can pin a device once they've placed it, and the
            mutators (setDevices facade) actually refuse to apply
            changes while it's locked. */}
        {onToggleLock && (
          <button
            onClick={onToggleLock}
            title={isLocked ? 'Unlock this device' : 'Lock this device'}
            data-track={isLocked ? 'pill-unlock' : 'pill-lock'}
            className={`px-2.5 inline-flex items-center justify-center border-l border-border/60 transition-colors ${isLocked ? 'text-primary bg-primary/10 hover:bg-primary/15' : 'text-muted-foreground hover:bg-secondary/30 hover:text-foreground'}`}
          >
            {isLocked
              ? <Lock className="w-3.5 h-3.5" />
              : <Unlock className="w-3.5 h-3.5" />}
          </button>
        )}
        {/* Delete — promoted to a visible pill button (was inside the
            More popover). Destructive-tone hover. */}
        <button
          onClick={onDelete}
          title={isLocked ? 'Locked — unlock to delete' : 'Delete'}
          data-track="pill-delete"
          className={`px-2.5 inline-flex items-center justify-center border-l border-border/60 transition-colors ${isLocked ? 'text-muted-foreground/40 cursor-not-allowed' : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stack popover — opens when the user clicks the stack chip on a
          stackable host (door, gate, elevator). Lists the accessories
          currently mounted. Currently a read-only summary; full inline
          add-from-popover wires through Insert dock drag. */}
      {isStackableHost(d.type) && (d.stack?.length ?? 0) > 0 && (
        <div
          className="mt-1.5 text-[10.5px] rounded-md overflow-hidden"
          style={{
            background: 'var(--panel-background)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(18px)',
          }}
        >
          <div className="px-2.5 py-1.5 border-b border-white/8 text-muted-foreground uppercase tracking-[0.10em] text-[9px] font-medium">
            Stack · {d.stack!.length}
          </div>
          {/* Names rendered by the parent via stackResolver — fall back to
              raw ids when not provided. */}
          {d.stack!.map((id) => (
            <div key={id} className="px-2.5 py-1 text-foreground font-mono border-b border-white/5 last:border-b-0">
              {id}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact Expand menu that lives inside the minimal selection pill.
 *  Holds the secondary actions that used to crowd the toolbar — duplicate,
 *  color, lock, stack peek, delete, and "more details" (opens drawer to
 *  general). Click outside or press Escape to close. */
function ExpandMenu({
  d, tone, onDuplicate, onDelete, onOpenTab, currentColor, onPickColor,
}: {
  d: Device;
  tone: string;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenTab: (t: EditTab) => void;
  currentColor?: string;
  onPickColor: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setColorOpen(false); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setColorOpen(false); } };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  // Duplicate + Delete + Lock removed from this overflow popover:
  //  - Duplicate is promoted to a visible pill button (matches the
  //    "minimal Edit-first toolbar" spec).
  //  - Delete is promoted to a visible pill button (destructive tone).
  //  - Lock is intentionally absent — not wired through the store yet,
  //    and the durable rule is "if it doesn't work, don't show it."
  // What remains in More: color / stack / more-details. Specialized
  // kind actions (Rotate / FOV / Lens / Hardware / Electrify / Egress)
  // belong in the Edit drawer; surfacing them here would re-clutter the
  // pill the user explicitly asked to keep minimal.
  const items: Array<{ id: string; label: string; icon: any; onClick: () => void; danger?: boolean }> = [
    { id: 'color',   label: 'Color',        icon: PaintBucket, onClick: () => { setColorOpen((v) => !v); } },
    { id: 'stack',   label: 'Stack',        icon: Layers,     onClick: () => { onOpenTab('compliance'); setOpen(false); } },
    { id: 'details', label: 'More details', icon: FileText,   onClick: () => { onOpenTab('overview'); setOpen(false); } },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="More actions — color, stack, details"
        aria-haspopup="menu"
        aria-expanded={open}
        data-track="pill-expand"
        data-testid="pill-expand"
        className={`px-2.5 h-full inline-flex items-center gap-1 text-[12px] border-r border-border/60 transition-colors ${open ? 'bg-secondary/40 text-foreground' : 'text-muted-foreground hover:bg-secondary/30 hover:text-foreground'}`}
      >
        <span className="text-[11px] font-medium tracking-tight">More</span>
        <ChevronDown
          className="w-3 h-3 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open && (
        <div
          role="menu"
          data-testid="pill-expand-menu"
          className="absolute left-0 top-full mt-1 z-40 w-[180px] rounded-md overflow-hidden"
          style={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          }}
        >
          {items.map((it) => (
            <button
              key={it.id}
              onClick={it.onClick}
              className={`w-full px-3 py-2 text-left text-[12px] flex items-center gap-2 transition-colors ${
                it.danger
                  ? 'text-destructive hover:bg-destructive/10'
                  : 'text-foreground hover:bg-secondary/40'
              }`}
            >
              <it.icon className="w-3.5 h-3.5" />
              {it.label}
            </button>
          ))}
          {colorOpen && (
            <div className="px-2 py-2 border-t border-border/60 grid grid-cols-5 gap-1">
              {DEVICE_COLOR_PALETTE.map((c) => {
                const isCur = (currentColor || '') === c.hex;
                if (c.id === 'reset') {
                  return (
                    <button
                      key={c.id}
                      onClick={() => { onPickColor(''); setOpen(false); }}
                      title="Use category color"
                      className={`h-7 rounded border text-[9.5px] tracking-tight transition-colors ${
                        isCur || !currentColor ? 'border-primary/60 text-primary bg-primary/10' : 'border-border text-muted-foreground'
                      }`}
                    >Auto</button>
                  );
                }
                return (
                  <button
                    key={c.id}
                    onClick={() => { onPickColor(c.hex); setOpen(false); }}
                    title={c.name}
                    className="h-7 rounded border"
                    style={{ background: c.hex, borderColor: isCur ? '#FFFFFF' : 'var(--border)' }}
                  >
                    {isCur && <Check className="w-3 h-3 text-white mx-auto" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact swatch button used inside the SelectionPill. Click reveals a
 *  9-swatch palette; clicking "Default" clears the override and returns
 *  the device to its category color. */
function ColorPickerButton({ currentHex, onPick, tone }: { currentHex?: string; onPick: (hex: string) => void; tone: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const swatchTone = currentHex || tone;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Object color"
        className="px-2.5 inline-flex items-center gap-1.5 text-muted-foreground hover:text-white hover:bg-white/[0.05] transition-colors duration-150 h-full border-r border-white/8"
      >
        <span
          className="w-3.5 h-3.5 rounded-sm border border-white/15"
          style={{ background: swatchTone }}
        />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-40 w-[176px] rounded-md overflow-hidden p-2"
          style={{
            background: 'var(--popover)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 16px 32px -16px rgba(0,0,0,0.6)',
          }}
        >
          <div className="text-[9.5px] uppercase tracking-[0.10em] text-muted-foreground px-1 pb-1.5">Object color</div>
          <div className="grid grid-cols-5 gap-1">
            {DEVICE_COLOR_PALETTE.map((c) => {
              const isCurrent = (currentHex || '') === c.hex;
              if (c.id === 'reset') {
                return (
                  <button
                    key={c.id}
                    onClick={() => { onPick(''); setOpen(false); }}
                    title="Use category color"
                    className={`w-7 h-7 rounded border flex items-center justify-center text-[9px] tracking-tight transition-colors ${
                      isCurrent || !currentHex
                        ? 'border-primary/60 text-primary bg-primary/10'
                        : 'border-white/15 text-muted-foreground hover:text-foreground hover:border-white/30'
                    }`}
                  >
                    Auto
                  </button>
                );
              }
              return (
                <button
                  key={c.id}
                  onClick={() => { onPick(c.hex); setOpen(false); }}
                  title={c.name}
                  className="w-7 h-7 rounded border transition-colors flex items-center justify-center"
                  style={{
                    background: c.hex,
                    borderColor: isCurrent ? '#FFFFFF' : 'rgba(255,255,255,0.18)',
                  }}
                >
                  {isCurrent && <Check className="w-3 h-3 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Overflow popover anchored at the end of the SelectionPill toolbar.
 *  Holds destructive / secondary actions so the primary row stays at
 *  ≤5 buttons. Click outside or press Escape to close. */
function MoreButton({ items, tone }: { items: ToolbarAction[]; tone: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="More"
        className="px-3 inline-flex items-center gap-1.5 text-muted-foreground hover:text-white hover:bg-white/[0.05] transition-colors duration-150"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
        <span className="text-[11px] font-medium tracking-tight">More</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-40 w-44 rounded-md overflow-hidden"
          style={{
            background: 'rgba(8,12,20,0.94)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: `0 14px 32px -10px rgba(0,0,0,0.85), 0 0 0 1px ${tone}22`,
          }}
        >
          {items.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={() => { a.onClick(); setOpen(false); }}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-xs hover:bg-white/5 transition-colors ${a.danger ? 'text-rose-300 hover:text-rose-200' : 'text-foreground'}`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-b-0">
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      <span className="text-[12.5px] tabular-nums font-medium" style={{ color: tone || '#E7EDF6' }}>{value}</span>
    </div>
  );
}

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
      description: `${nextCat.manufacturer} ${nextCat.model} — BOM, resolution, IR, NDAA flags now read from this catalog entry.`,
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
            <div className="text-[11.5px] text-muted-foreground">
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
                    {p.manufacturer} {p.model}{p.resolution ? ` · ${p.resolution}` : ''}
                  </option>
                ))}
              </select>
              {/* Spec chips — read straight from the selected catalog
                  entry. Each chip is honest about its source: only renders
                  if the catalog row carries the value. */}
              {cat && (
                <div className="mt-2 flex flex-wrap gap-1" data-testid="camera-spec-chips">
                  {cat.resolution && <span className="text-[10.5px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-foreground">{cat.resolution}</span>}
                  {cat.cameraType && <span className="text-[10.5px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-foreground">{cat.cameraType}</span>}
                  {cat.focalRange && <span className="text-[10.5px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-foreground">{cat.focalRange}</span>}
                  {d.ir && <span className="text-[10.5px] px-2 py-0.5 rounded border border-amber-400/30 bg-amber-400/10 text-amber-200">IR on</span>}
                  {cat.ndaa && <span className="text-[10.5px] px-2 py-0.5 rounded border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">NDAA</span>}
                  {cat.ipRating && <span className="text-[10.5px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-muted-foreground">{cat.ipRating}</span>}
                </div>
              )}
              <div className="mt-2 text-[10.5px] text-muted-foreground">
                Catalog is a curated sample — vendor APIs are not connected. Switching model updates the BOM line and the spec chips above.
              </div>
            </>
          )}
        </DrawerSection>
      )}

      {cat && (
        <DrawerSection title="Product details">
          <Row2 label="Category" value={cat.category} />
          {cat.subcategory && <Row2 label="Subcategory" value={cat.subcategory} />}
          <Row2 label="Tech model" value={cat.techModels.length === 3 ? 'Cloud / On-prem / Hybrid' : cat.techModels.join(' · ')} />
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
          <Row2 label="MSRP" value={cat.msrp != null ? `$${cat.msrp.toLocaleString()}` : '—'} />
          {cat.dealerCost && <Row2 label="Dealer cost" value={`$${cat.dealerCost.toLocaleString()}`} />}
          {cat.laborUnits && <Row2 label="Labor units" value={`${cat.laborUnits} hr`} />}
          <div className="text-[10px] text-muted-foreground mt-1">Sample MSRP — verify with distributor.</div>
        </DrawerSection>
      )}

      {cat?.compatibleVMS?.length && (
        <DrawerSection title="Compatible VMS">
          <div className="flex flex-wrap gap-1">
            {cat.compatibleVMS.map((v) => (
              <span key={v} className="text-[10.5px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-foreground">{v}</span>
            ))}
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Location">
        <Row2 label="Position" value={`${(d.x * pxToFt).toFixed(1)}, ${(d.y * pxToFt).toFixed(1)} ft`} />
        {d.mountFt != null && <Row2 label="Mount AFF" value={`${d.mountFt} ft`} />}
      </DrawerSection>
    </>
  );
}

/** Stack section for hosts (doors / IDFs / racks). Lists every attached
 *  accessory + an Add-hardware menu seeded with the host's compatible
 *  hardware set. Reads from the host's `stack: DeviceId[]` array, which
 *  is written by canvas-to-canvas drag-stack and by drag-from-library. */
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
        <div className="rounded-md border border-border bg-secondary/15 p-2.5 text-[11.5px] space-y-1" data-testid="opening-summary">
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
                className={`rounded-md border text-[11.5px] transition-colors ${
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
          <div className="text-[10.5px] uppercase tracking-[0.10em] text-amber-300 mb-1">
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
                  className="rounded-md border p-2 text-[11.5px] leading-snug"
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
                className={`text-left px-2.5 py-2 rounded-md border text-[11.5px] transition-colors ${
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
                className={`text-left px-2.5 py-2 rounded-md border text-[11.5px] transition-colors ${
                  on ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Reader · {opt === 'mullion' ? 'Mullion' : 'Wall'}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-[10.5px] text-muted-foreground leading-snug">
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
          <div className="text-[11.5px] text-muted-foreground italic px-1">
            No hardware attached. Use Add below.
          </div>
        ) : (
          <div className="space-y-1">
            {attached.map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md border border-border/40 bg-secondary/20">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: KIND_TONE[TYPE_KIND[a.type]] }} />
                <span className="text-[11.5px] text-foreground tracking-tight">{a.id}</span>
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
              className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/30 text-[11.5px] transition-colors"
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
          <div className="text-[11.5px] text-muted-foreground italic mb-2">
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
                  <div className="mt-1.5 text-[10.5px] text-amber-200/85">
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
          <span className="text-[10.5px] text-muted-foreground">⌘/Ctrl+Enter to save</span>
          <button
            onClick={submit}
            disabled={!text.trim()}
            data-testid="survey-add-btn"
            className="text-[11.5px] px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >Add</button>
        </div>
        <div className="mt-2 text-[10.5px] text-muted-foreground/85">
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
        return {
          label: `${p.mfr} ${p.model}`,
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
        <div className="text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground mb-1">
          This object only · not a project rollup
        </div>
        {labelLines.length === 0 ? (
          <div className="text-[11.5px] text-muted-foreground italic">
            {isDoorish
              ? 'No door hardware selected yet. Open the Assembly tab and toggle reader / strike / REX / etc. to populate this opening.'
              : "No catalog product assigned yet. Pick one on the Overview tile to see this object's material + labor."}
          </div>
        ) : (
          <div className="space-y-1 text-[11.5px]">
            {labelLines.map((l, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 py-1 border-b border-border/40 last:border-b-0">
                <div className="flex-1 min-w-0 truncate text-foreground">{l.label}</div>
                <div className="tabular-nums text-muted-foreground">{l.qty}</div>
                <div className="tabular-nums text-foreground">${Math.round(l.ext).toLocaleString()}</div>
              </div>
            ))}
            <div className="flex items-baseline justify-between text-[10.5px] text-muted-foreground pt-1">
              <span>Labor</span>
              <span className="tabular-nums">{labelLines.reduce((s, l) => s + (l.hrs || 0), 0).toFixed(1)} hr</span>
            </div>
            {poeW !== null && (
              <div className="flex items-baseline justify-between text-[10.5px] text-muted-foreground">
                <span>PoE draw</span>
                <span className="tabular-nums">~{poeW} W</span>
              </div>
            )}
          </div>
        )}
        <div className="mt-2 text-[10.5px] text-muted-foreground/85">
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
            <div className="text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground mb-1">
              This door only · {proposedLines.length} proposed · {existingLines.length} existing
            </div>
            <div className="text-[10.5px] text-muted-foreground/85 mb-2">
              Per-component preview from the active door assembly. Proposed rows roll into the Estimator;
              Existing rows are kept as documentation only (zeroed in totals).
            </div>
            <div className="space-y-1 text-[11.5px]">
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
              <div className="flex items-baseline justify-between text-[10.5px] text-muted-foreground" data-testid="impact-door-proposed-labor">
                <span>Proposed labor</span>
                <span className="tabular-nums">{proposedLabor.toFixed(2)} hr</span>
              </div>
              {existingLines.length > 0 && (
                <div className="flex items-baseline justify-between text-[10.5px] text-muted-foreground/80 pt-0.5" data-testid="impact-door-existing-total">
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
                <div className="text-[10.5px] text-muted-foreground truncate">{a.kind.replace('-', ' ')}</div>
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
        <div className="text-[11.5px] text-muted-foreground italic px-1">
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
              <div className="text-[10.5px] text-muted-foreground mt-0.5">
                Cable OD {od}″ · total area <span className="tabular-nums text-foreground">{cableAreaTotal.toFixed(3)} in²</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {emt.map((e) => {
                  const fillPct = (cableAreaTotal / e.areaIn2) * 100;
                  const ok = fillPct / 100 <= rule;
                  return (
                    <div
                      key={e.size}
                      className="rounded border px-2 py-1 text-[10.5px] flex items-center justify-between"
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
          <div className="text-[11.5px] text-muted-foreground italic px-1">
            No cable runs target this IDF yet. Use Run to IDF from the canvas to assign devices here.
          </div>
        ) : (
          <div className="space-y-1">
            {incoming.map((p) => {
              const src = devices[p.sourceId ?? ''] as any;
              return (
                <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md border border-border/40 bg-secondary/20 text-[11.5px]">
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
        <div className="text-[10.5px] text-muted-foreground mt-1.5">
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
        <div className="text-[10.5px] text-muted-foreground mt-1.5">
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
      <span className="text-[11.5px] leading-snug" style={{ color: tone }}>{text}</span>
    </div>
  );
}

function AiOptimizeSection({ d, tone }: { d: Device; tone: string }) {
  const [mode, setMode] = useState<'overview' | 'prosecution'>('overview');
  const PX_PER_FT = 3.83;
  const rangeFt = d.range ?? (d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30);
  const fovDeg  = d.fov ?? (d.type === 'cam.ptz' ? 36 : d.type === 'cam.fisheye' ? 360 : 70);
  // px/m at half range — a fair "general usefulness" metric.
  const sensorPx = 1920;
  const halfFovRad = (fovDeg * Math.PI / 180) / 2;
  const midDistM = (rangeFt * 0.5) * 0.3048;
  const fovWidthM = Math.max(0.01, 2 * midDistM * Math.tan(halfFovRad));
  const pxPerM = sensorPx / fovWidthM;

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
            <Row label="px/m @ midrange" value={pxPerM.toFixed(0)} />
            <Row label="Identification"  value={pxPerM >= 250 ? 'Yes' : pxPerM >= 125 ? 'Marginal' : 'No'} tone={pxPerM >= 250 ? '#34D399' : pxPerM >= 125 ? '#FACC15' : '#F87171'} />
            <Row label="Recognition"     value={pxPerM >= 125 ? 'Yes' : 'No'} tone={pxPerM >= 125 ? '#34D399' : '#F87171'} />
            <Row label="License plate"   value={d.type === 'cam.lpr' ? 'LPR sensor · yes' : (pxPerM >= 320 ? 'Yes (≤4m)' : 'Marginal')} tone={d.type === 'cam.lpr' ? '#34D399' : (pxPerM >= 320 ? '#34D399' : '#FACC15')} />
            <Row label="Forensic export" value={pxPerM >= 250 ? 'Court-ready' : 'Best-effort'} tone={pxPerM >= 250 ? '#34D399' : '#FACC15'} />
            <Row label="Distance @ ID grade" value={`${Math.round((sensorPx / (250 / 0.3048 * 2 * Math.tan(halfFovRad))) * 3.28)} ft`} />
          </>
        )}
      </DrawerSection>
      <DrawerSection title={mode === 'overview' ? 'Heuristic suggestions' : 'Heuristic forensic notes'}>
        <div className="text-[10.5px] uppercase tracking-[0.10em] text-amber-300 mb-1">
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
          <div key={i} className="w-full text-left text-[11.5px] text-foreground px-2 py-1.5 mb-1 rounded border border-white/10">
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

function Slider({ label, value, min, max, step = 1, unit, onChange, tone }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; tone: string }) {
  return (
    <div className="mb-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11.5px] text-muted-foreground">{label}</span>
        <span className="text-[12.5px] tabular-nums font-medium text-foreground">{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: tone }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PATHWAY DRAWER — opens when a cable / conduit / J-hook / tray
   pathway is clicked on the canvas. Mirrors the EditDrawer style so
   the surveyor reads as one product. Body branches by `pathwayKind`:
   cable variant exposes route / type / source / dest / lengths /
   conduit assignment / terminations / ports / accessories / suggestions /
   BOM; conduit variant exposes type / size / cables inside / fill /
   pull boxes / bends / firestop / suggestions / BOM.
   ═══════════════════════════════════════════════════════════════════════ */

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
      <div className="absolute top-0 right-0 bottom-0 z-40 w-[420px] bg-card border-l border-border p-4">
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
      className="absolute top-0 right-0 bottom-0 z-40 transition-transform duration-300 translate-x-0"
      style={{
        width: 420,
        background: 'var(--drawer-background)',
        color: 'var(--drawer-foreground)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-16px 0 40px -16px rgba(0,0,0,0.35)',
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
            <button onClick={() => onOpenBundle(p.bundleId)} data-track="pathway-open-bundle" className="mt-1 text-[10.5px] text-primary hover:underline">
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
              className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-md text-[10.5px] tracking-tight transition-colors ${active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
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
                  <div className="text-[11.5px] text-muted-foreground italic">No terminations placed. Drop a jack, coupler, or patch panel from the bottom Cabling tray near this run to attach it.</div>
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
                <div className="text-[11.5px] text-muted-foreground italic">No cables routed through this conduit yet. Drop a cable run near it or use Run-to-IDF with "Existing conduit".</div>
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
                      className="mt-2 text-[11.5px] font-medium px-3 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-90"
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
            <div className="text-[11.5px] text-muted-foreground italic mb-2">
              {isCable ? 'Cable accessories for this run. Tally rolls up into BOM.' : 'Conduit accessories for this run.'}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(isCable
                ? ['jack','coupler','patchcord','label','firestop','sleeve','pullbox'] as const
                : ['pullbox','jbox','coupler','firestop','sleeve','tray'] as const
              ).map((kind) => {
                const count = (p.accessories?.[kind as any] ?? 0);
                return (
                  <div key={kind} className="rounded-md border border-border bg-background px-2.5 py-2 flex items-center justify-between text-[11.5px]">
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
            <div className="mt-2 text-[10.5px] text-muted-foreground italic">Counts flow into project BOM via the Pathways selector.</div>
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

function EditDrawer({ d, open, tab, setTab, onClose, onUpdate, activeLens, setActiveLens, lensMode, setLensMode }: {
  d: Device; open: boolean; tab: EditTab; setTab: (t: EditTab) => void; onClose: () => void;
  onUpdate: (p: Partial<Device>) => void;
  activeLens: ActiveLens; setActiveLens: (l: ActiveLens) => void;
  lensMode: LensMode; setLensMode: (m: LensMode) => void;
}) {
  const product = PRODUCTS.find((p) => p.id === d.product);
  const kind = TYPE_KIND[d.type];
  const tone = KIND_TONE[kind];
  const isCam = kind === 'camera';
  const isMultisensor = d.type === 'cam.multisensor';
  // Lens engineering — read from the device, fall back to type-appropriate
  // defaults the first time the inspector opens. EVERY slider writes back
  // through onUpdate so changes persist if the user closes & reopens the
  // drawer (or drags the camera). No more "fake" sliders.
  const defaultFocal = d.type === 'cam.ptz' ? 12 : d.type === 'cam.fisheye' ? 1.4 : 4.0;
  const defaultFov   = d.type === 'cam.fisheye' ? 360 : d.type === 'cam.ptz' ? 60 : 88;
  const defaultRange = d.type === 'cam.ptz' ? 70 : d.type === 'cam.bullet' ? 50 : 30;

  // Lens slider bindings. For multisensors the active lens chip drives which
  // lens (or all four) the sliders are reading and writing. For single
  // cameras the sliders bind directly to d.focal/fov/range.
  const lenses = isMultisensor ? getLenses(d) : undefined;
  /** Apply a partial lens patch. activeLens === 'all' fans the change to every
   *  enabled lens (preserves their differences proportionally for rotation
   *  but uniformly sets fov/range/focal). */
  const patchLens = (patch: Partial<LensCfg>, deltaRot?: number) => {
    if (!lenses) return;
    if (activeLens === 'all') {
      const next: { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg } = {
        a: { ...lenses.a }, b: { ...lenses.b }, c: { ...lenses.c }, d: { ...lenses.d },
      };
      (['a', 'b', 'c', 'd'] as const).forEach((k) => {
        if (deltaRot !== undefined) next[k].rotation = ((lenses[k].rotation + deltaRot) % 360 + 360) % 360;
        Object.assign(next[k], patch);
      });
      onUpdate({ lenses: next });
    } else {
      const k = activeLens;
      onUpdate({ lenses: { ...lenses, [k]: { ...lenses[k], ...patch } } });
    }
  };

  const lensReadout: LensCfg | null = (() => {
    if (!lenses) return null;
    if (activeLens === 'all') {
      // Average reading for the "All" tab so the sliders show a sensible
      // group value. Writes still fan out via patchLens.
      const avg = (key: keyof LensCfg) => Math.round(((lenses.a as any)[key] + (lenses.b as any)[key] + (lenses.c as any)[key] + (lenses.d as any)[key]) / 4);
      return { rotation: avg('rotation'), fov: avg('fov'), range: avg('range'), focal: avg('focal'), enabled: true };
    }
    return lenses[activeLens];
  })();

  const localFocal = lensReadout?.focal ?? d.focal ?? defaultFocal;
  const hfov       = lensReadout?.fov   ?? d.fov   ?? defaultFov;
  const distance   = lensReadout?.range ?? d.range ?? defaultRange;
  const lensRot    = lensReadout?.rotation ?? d.rot;

  const setLocalFocal = (v: number) => lenses ? patchLens({ focal: v }) : onUpdate({ focal: v });
  const setHfov       = (v: number) => lenses ? patchLens({ fov: v })   : onUpdate({ fov: v });
  const setDistance   = (v: number) => lenses ? patchLens({ range: v }) : onUpdate({ range: v });
  const setLensRot    = (v: number) => lenses ? patchLens({ rotation: v }) : onUpdate({ rot: v });

  const doriRange = distance;
  // Live engineering telemetry derived from current lens state — recomputes
  // on every slider tick so the numbers in the Telemetry section are real,
  // not static placeholders.
  const overlapPct = 18 + (Math.abs(d.rot) % 30);
  const blindPct = 6 + (Math.abs(d.rot) % 12);
  const pxPerFt = Math.round(180 - distance * 1.4);

  // Coverage sub-tab — Overview (engineering numbers) vs Prosecution
  // (evidence-quality readouts). Per the brief, both must change content.
  const [coverageSub, setCoverageSub] = useState<'overview' | 'prosecution'>('overview');

  // Prosecution math — derived from the live lens config so the user
  // sees a real change when they pan / zoom / refocus the camera.
  // Standard subject assumptions per EN-50132-7: 1.7 m tall, 0.18 m
  // face width, license plates 0.52 m × 0.11 m at 25 m read range.
  const distM = distance * 0.3048;
  const sensorPx = 1920; // assumed 1080p horizontal
  const halfFovRad = (Math.min(hfov, 179) * Math.PI / 180) / 2;
  const fovWidthM = Math.max(0.01, 2 * distM * Math.tan(halfFovRad));
  const pxPerM = sensorPx / fovWidthM;
  const facePx = Math.round(pxPerM * 0.18);
  const platePx = Math.round(pxPerM * 0.52);
  const bodyPx = Math.round(pxPerM * 0.5);
  const heightPx = Math.round(pxPerM * 1.7);
  const plateReadable = platePx >= 80;
  const faceIdentifiable = facePx >= 80;
  // IR effectiveness — simple linear falloff from declared range.
  const irRangeFt = d.range ?? 50;
  const irEff = Math.max(0, Math.min(1, 1 - distance / Math.max(irRangeFt * 1.4, 1)));
  // Prosecution readiness — composite of pixel density + framing.
  const prosecutionScore = Math.min(100, Math.round(
    (facePx >= 100 ? 35 : facePx >= 80 ? 25 : facePx >= 40 ? 12 : 5)
    + (plateReadable ? 30 : platePx >= 40 ? 15 : 5)
    + (irEff * 20)
    + (heightPx >= 250 ? 15 : 8)
  ));

  return (
    <div
      data-canvas-chrome={open ? 'drawer' : undefined}
      className={`absolute top-0 right-0 bottom-0 z-40 transition-transform duration-300 pointer-events-auto ${open ? 'translate-x-0' : 'translate-x-full'}`}
      style={{
        width: 400,
        background: 'var(--drawer-background)',
        color: 'var(--drawer-foreground)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-16px 0 40px -16px rgba(0,0,0,0.35)',
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Drawer header — editorial. The device id is the headline; the
          kind sits above it as a soft caption; manufacturer + model
          supports below. No HUD tracking; calmer hierarchy. */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone, boxShadow: `0 0 6px ${tone}66` }} />
              <span className="text-[11px] text-muted-foreground tracking-tight">{labelForKind(kind)}</span>
            </div>
            <div className="text-[18px] font-medium text-slate-50 tracking-tight truncate leading-tight">{d.id}</div>
            {product && (
              <div className="text-[11.5px] text-muted-foreground mt-1 truncate">{product.mfr} · {product.model}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/[0.05] text-muted-foreground hover:text-foreground transition-colors duration-150"
            title="Close inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Section grid — 3 icons per row, 4 rows. No horizontal scroll,
          no hidden tabs. Every section is one click away. The active tile
          uses a tone-tinted border + soft background so the user can see
          where they are at a glance. */}
      <div className="px-3 py-3 border-b border-border/60 grid grid-cols-3 gap-1.5">
        {tilesForDevice(d).map((t) => {
          const active = tabGroupOf(tab) === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-track={`drawer-tab-${t.id}`}
              className={`flex flex-col items-center justify-center gap-1 py-2 rounded-md text-[10.5px] tracking-tight transition-colors ${
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
              }`}
              style={active ? {
                background: `${tone}14`,
                boxShadow: `inset 0 0 0 1px ${tone}55`,
              } : undefined}
            >
              <Icon className="w-4 h-4" style={{ color: active ? tone : undefined }} />
              <span className="font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab body. Each section renders when its tab group is active —
          so Coverage shows Lens + AI + Telemetry together, Power & Network
          shows Power + Network together, Compatibility shows Compliance +
          Linked together. More generous padding so the editorial typography
          gets the breathing room it needs. */}
      <div className="px-5 py-5 overflow-y-auto" style={{ maxHeight: 'calc(100% - 150px)' }}>
        {bodyShows(tab, 'overview') && (
          <>
            <ProductOverviewSection d={d} />
            <ImpactPreviewSection device={d} />
          </>
        )}

        {bodyShows(tab, 'lens') && (
          <>
            {/* Overview / Prosecution sub-tab switch — both modes change
                the body content (Overview = direct manipulation + DORI;
                Prosecution = face / plate / IR / evidence quality). */}
            <div className="mb-3 flex items-stretch h-8 border border-border/60 rounded-lg overflow-hidden">
              {([
                { id: 'overview' as const,    label: 'Overview',    hint: 'FOV / DORI / direct manipulation' },
                { id: 'prosecution' as const, label: 'Prosecution', hint: 'Evidence quality at the current target distance' },
              ]).map((s) => {
                const active = coverageSub === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setCoverageSub(s.id)}
                    title={s.hint}
                    data-track={`drawer-coverage-${s.id}`}
                    className={`flex-1 text-[11.5px] transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            {coverageSub === 'prosecution' && (
              <>
                <DrawerSection title="Evidence quality">
                  <div className="grid grid-cols-2 gap-2.5">
                    {([
                      { k: 'Face pixels',     v: facePx,  ok: facePx >= 80,            sub: '≥ 80 px to identify' },
                      { k: 'Plate pixels',    v: platePx, ok: plateReadable,           sub: '≥ 80 px to read' },
                      { k: 'Body pixels',     v: bodyPx,  ok: bodyPx >= 60,            sub: 'Profile / gait' },
                      { k: 'Subject height',  v: heightPx,ok: heightPx >= 250,         sub: '1.7 m tall' },
                    ]).map((row) => (
                      <div
                        key={row.k}
                        className="rounded-lg border p-2.5"
                        style={{
                          background: row.ok ? 'rgba(79,184,126,0.08)' : 'rgba(229,162,58,0.08)',
                          borderColor: row.ok ? 'rgba(79,184,126,0.32)' : 'rgba(229,162,58,0.32)',
                        }}
                      >
                        <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground">{row.k}</div>
                        <div className="text-[15px] font-medium tabular-nums mt-0.5" style={{ color: row.ok ? '#4FB87E' : '#E5A23A' }}>
                          {row.v} <span className="text-[10px] text-muted-foreground">px</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{row.sub}</div>
                      </div>
                    ))}
                  </div>
                </DrawerSection>
                <DrawerSection title="Readability">
                  <Row label="Face identifiable"     value={faceIdentifiable ? 'Yes' : 'Marginal'} tone={faceIdentifiable ? '#4FB87E' : '#E5A23A'} />
                  <Row label="License plate"         value={plateReadable    ? 'Readable' : 'Insufficient'} tone={plateReadable ? '#4FB87E' : '#E5A23A'} />
                  <Row label="Low-light confidence"  value={`${Math.round(irEff * 100)}%`}        tone={irEff > 0.6 ? '#4FB87E' : irEff > 0.3 ? '#E5A23A' : '#E55B5B'} />
                  <Row label="IR effectiveness"      value={`${Math.round(irEff * 100)}% @ ${distance.toFixed(0)} ft`} tone={irEff > 0.6 ? '#4FB87E' : '#E5A23A'} />
                </DrawerSection>
                <DrawerSection title="Prosecution readiness">
                  <div className="px-1">
                    <div className="flex items-end justify-between mb-1.5">
                      <span className="text-[11px] text-muted-foreground">Composite score</span>
                      <span className="text-[18px] font-medium tabular-nums" style={{ color: prosecutionScore >= 70 ? '#4FB87E' : prosecutionScore >= 45 ? '#E5A23A' : '#E55B5B' }}>
                        {prosecutionScore}<span className="text-[10px] text-muted-foreground"> / 100</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${prosecutionScore}%`,
                          background: prosecutionScore >= 70 ? '#4FB87E' : prosecutionScore >= 45 ? '#E5A23A' : '#E55B5B',
                          transitionDuration: 'var(--motion-standard)',
                        }}
                      />
                    </div>
                    <div className="text-[10.5px] text-muted-foreground mt-1.5">
                      Composite of pixel density, IR effectiveness, and subject framing at the simulated target distance.
                    </div>
                  </div>
                </DrawerSection>
              </>
            )}
            {coverageSub === 'overview' && isMultisensor && (
              <div className="mb-3 flex items-center gap-1 p-1 rounded-md" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {/* All + per-lens chips. Each lens chip uses its own color
                    (cyan/violet/amber/emerald) so the user sees at-a-glance
                    which cone they're about to control. */}
                <button
                  onClick={() => setActiveLens('all')}
                  className="flex-1 py-1 rounded text-[11px] tabular-nums transition-colors"
                  style={{
                    background: activeLens === 'all' ? `${tone}22` : 'transparent',
                    color: activeLens === 'all' ? '#F8FAFC' : '#94A3B8',
                    boxShadow: activeLens === 'all' ? `inset 0 0 0 1px ${tone}66` : 'none',
                  }}
                >All</button>
                {(['a', 'b', 'c', 'd'] as const).map((l) => {
                  const active = activeLens === l;
                  const c = LENS_TONE[l];
                  return (
                    <button
                      key={l}
                      onClick={() => setActiveLens(l)}
                      className="flex-1 py-1 rounded text-[11px] tabular-nums transition-colors inline-flex items-center justify-center gap-1.5"
                      style={{
                        background: active ? `${c}22` : 'transparent',
                        color: active ? '#F8FAFC' : '#94A3B8',
                        boxShadow: active ? `inset 0 0 0 1px ${c}66` : 'none',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? c : '#475569' }} />
                      Lens {LENS_LABEL[l]}
                    </button>
                  );
                })}
                <button
                  onClick={() => setLensMode(lensMode === 'linked' ? 'independent' : 'linked')}
                  className="px-2 py-1 rounded text-[10px] inline-flex items-center gap-1"
                  style={{ color: lensMode === 'linked' ? tone : '#94A3B8' }}
                  title={lensMode === 'linked' ? 'Linked rotation — switch to independent' : 'Independent rotation — switch to linked'}
                >{lensMode === 'linked' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}{lensMode}</button>
              </div>
            )}
            {coverageSub === 'overview' && (
              <>
                <DrawerSection title={isMultisensor
                  ? (activeLens === 'all' ? 'Direct manipulation — all lenses' : `Direct manipulation — Lens ${LENS_LABEL[activeLens]}`)
                  : 'Direct manipulation'}>
                  <Slider label="Rotation" value={lensRot} min={0} max={359} unit="°" tone={isMultisensor && activeLens !== 'all' ? LENS_TONE[activeLens as LensId] : tone} onChange={setLensRot} />
                  <Slider label="Focal length" value={localFocal} min={1.4} max={30} step={0.1} unit="mm" tone={tone} onChange={setLocalFocal} />
                  <Slider label="Horizontal FOV" value={hfov} min={20} max={360} unit="°" tone={tone} onChange={setHfov} />
                  <Slider label="Distance" value={distance} min={5} max={150} unit="ft" tone={tone} onChange={setDistance} />
                </DrawerSection>
                {/* DORI / Target preview — plain-language verdict at the
                    current subject distance + a per-grade pass/fail bar.
                    Uses IEC 62676-4 / EN 50132-7 px/m thresholds against
                    the existing live `pxPerM` derivation:
                      Identify  ≥ 250 px/m   (1.7 m subject ≥ 425 px tall)
                      Recognize ≥ 125 px/m
                      Observe   ≥  62 px/m
                      Detect    ≥  25 px/m
                    The verdict line picks the strongest grade still met
                    and explains it without jargon. */}
                {(() => {
                  const grades = [
                    { id: 'Identify',  thresh: 250, color: '#4FB87E', plain: 'Face is clear enough for an ID-grade match.' },
                    { id: 'Recognize', thresh: 125, color: '#7CC2FF', plain: 'You can tell a known face apart from strangers, but not enough for a court ID.' },
                    { id: 'Observe',   thresh: 62,  color: '#FACC15', plain: 'You can read activity (gait, clothing, gesture) but faces are limited.' },
                    { id: 'Detect',    thresh: 25,  color: '#FB923C', plain: 'You can see something is there, not who or what.' },
                  ];
                  const met = grades.find((g) => pxPerM >= g.thresh);
                  const verdict = met
                    ? { id: met.id, color: met.color, plain: met.plain }
                    : { id: 'Below detect', color: '#E55B5B', plain: 'Subject is too small to register reliably. Move the camera closer or step up the focal length.' };
                  return (
                    <DrawerSection title={`Target preview · ${distance.toFixed(0)} ft`}>
                      <div
                        className="rounded-lg border px-3 py-2.5 mb-2"
                        style={{
                          borderColor: `${verdict.color}55`,
                          background: `${verdict.color}10`,
                        }}
                        data-testid="dori-verdict"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <div>
                            <div className="text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground">At {distance.toFixed(0)} ft</div>
                            <div className="text-[14px] font-medium tracking-tight" style={{ color: verdict.color }}>{verdict.id} quality</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground">Subject</div>
                            <div className="text-[12px] tabular-nums text-foreground">{Math.round(pxPerM)} px / m</div>
                          </div>
                        </div>
                        <div className="text-[11.5px] text-muted-foreground leading-snug mt-1.5">{verdict.plain}</div>
                      </div>
                      {/* Per-grade pass/fail strip */}
                      <div className="space-y-1" data-testid="dori-grade-list">
                        {grades.map((g) => {
                          const ok = pxPerM >= g.thresh;
                          return (
                            <div key={g.id} className="flex items-center gap-2 text-[11.5px]">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                  background: ok ? g.color : 'transparent',
                                  boxShadow: ok ? `0 0 6px ${g.color}88` : 'none',
                                  outline: ok ? 'none' : `1px solid ${g.color}55`,
                                  outlineOffset: '-1px',
                                }}
                              />
                              <span className="flex-1 text-foreground">{g.id}</span>
                              <span className="text-muted-foreground tabular-nums">≥ {g.thresh} px/m</span>
                              <span className="w-12 text-right uppercase tracking-[0.10em] text-[10px]" style={{ color: ok ? g.color : '#94A3B8' }}>
                                {ok ? 'Pass' : 'Fail'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground mt-2 leading-snug">
                        Thresholds: IEC 62676-4 / EN 50132-7. Subject is the 1.7 m EN-spec figure standing at the full camera range.
                        Sensor assumed 1080p horizontal; updates live as you drag Distance / HFOV.
                      </div>
                    </DrawerSection>
                  );
                })()}
                <DrawerSection title="DORI ranges (legacy estimate)">
                  {[
                    { k: 'Identify',  d: Math.round(doriRange * 0.35), c: '#34D399' },
                    { k: 'Recognize', d: Math.round(doriRange * 0.55), c: '#FACC15' },
                    { k: 'Observe',   d: Math.round(doriRange * 0.75), c: '#FB923C' },
                    { k: 'Detect',    d: doriRange, c: '#F87171' },
                  ].map((row) => (
                    <div key={row.k} className="flex items-center gap-2 py-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: row.c, boxShadow: `0 0 6px ${row.c}` }} />
                      <span className="flex-1 text-[11.5px] text-muted-foreground">{row.k}</span>
                      <span className="text-[12px] tabular-nums text-foreground">{row.d} ft</span>
                    </div>
                  ))}
                  <div className="text-[10.5px] text-muted-foreground mt-2 leading-snug">
                    Rule-of-thumb distance breakpoints (Identify ≈ 35 % of range, etc.). The Target preview card above is the
                    authoritative pass/fail signal.
                  </div>
                </DrawerSection>
                {/* Compact per-lens summary for multisensor cameras —
                    shows the four lenses + their rotation / FOV / range
                    side-by-side so the surveyor can compare all four at
                    a glance. Active lens row is highlighted in the lens
                    colour. Click a row to set that lens active. */}
                {isMultisensor && lenses && (
                  <DrawerSection title="Lenses">
                    <div className="space-y-1" data-testid="multisensor-lens-summary">
                      {(['a','b','c','d'] as const).map((k) => {
                        const L = lenses[k];
                        const active = activeLens === k;
                        const c = LENS_TONE[k];
                        return (
                          <button
                            key={k}
                            onClick={() => setActiveLens(k)}
                            data-testid={`lens-summary-${k}`}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11.5px] tabular-nums"
                            style={{
                              background: active ? `${c}1F` : 'transparent',
                              border: active ? `1px solid ${c}55` : '1px solid transparent',
                              color: active ? '#F8FAFC' : 'rgba(148,163,184,0.95)',
                            }}
                            title={`Edit Lens ${LENS_LABEL[k]} only`}
                          >
                            <span className="inline-flex items-center gap-1.5 w-10">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c, boxShadow: active ? `0 0 6px ${c}AA` : 'none' }} />
                              <span className="font-medium">{LENS_LABEL[k]}</span>
                            </span>
                            <span className="flex-1 text-left text-muted-foreground">rot</span>
                            <span className="w-10 text-right text-foreground">{L.rotation}°</span>
                            <span className="text-left text-muted-foreground">fov</span>
                            <span className="w-9 text-right text-foreground">{L.fov}°</span>
                            <span className="text-left text-muted-foreground">range</span>
                            <span className="w-12 text-right text-foreground">{L.range} ft</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground mt-2 leading-snug">
                      Mode: <span className="text-foreground">{lensMode === 'linked' ? 'Linked' : 'Independent'}</span> ·
                      {lensMode === 'linked'
                        ? ' Range / FOV changes propagate to all four lenses.'
                        : ' Each lens edits alone.'}
                    </div>
                  </DrawerSection>
                )}
                <DrawerSection title="Telemetry">
                  <Row label="px / ft @ 30ft" value={pxPerFt} />
                  <Row label="Overlap %" value={`${overlapPct}%`} tone={overlapPct > 35 ? '#FACC15' : undefined} />
                  <Row label="Blind spot %" value={`${blindPct}%`} tone={blindPct > 12 ? '#F87171' : undefined} />
                  <Row label="Confidence" value="0.92" tone="#34D399" />
                </DrawerSection>
              </>
            )}
            {/* Multisensor scene presets — one-click orientations for
                common deployments. Each writes a new lens config to the
                device; the user can then fine-tune from there. Hidden
                for non-multisensor cameras and on the Prosecution tab. */}
            {isMultisensor && coverageSub === 'overview' && (
              <DrawerSection title="Scene presets">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'corridor',  label: 'Corridor',  hint: 'Two long cones, two narrow sides' },
                    { id: 'parking',   label: 'Parking',   hint: 'Four 90° quadrants, full coverage' },
                    { id: 'warehouse', label: 'Warehouse', hint: 'Narrow long cones for aisles' },
                    { id: 'lobby',     label: 'Lobby',     hint: 'Forward fan for face recognition' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        const cur = getLenses(d);
                        let next = cur;
                        if (p.id === 'corridor') {
                          next = {
                            a: { ...cur.a, rotation: 0,   fov: 60, range: 80, enabled: true },
                            b: { ...cur.b, rotation: 180, fov: 60, range: 80, enabled: true },
                            c: { ...cur.c, rotation: 90,  fov: 45, range: 30, enabled: true },
                            d: { ...cur.d, rotation: 270, fov: 45, range: 30, enabled: true },
                          };
                        } else if (p.id === 'parking') {
                          next = {
                            a: { ...cur.a, rotation: 0,   fov: 90, range: 100, enabled: true },
                            b: { ...cur.b, rotation: 90,  fov: 90, range: 100, enabled: true },
                            c: { ...cur.c, rotation: 180, fov: 90, range: 100, enabled: true },
                            d: { ...cur.d, rotation: 270, fov: 90, range: 100, enabled: true },
                          };
                        } else if (p.id === 'warehouse') {
                          next = {
                            a: { ...cur.a, rotation: 0,   fov: 50, range: 120, enabled: true },
                            b: { ...cur.b, rotation: 90,  fov: 50, range: 80,  enabled: true },
                            c: { ...cur.c, rotation: 180, fov: 50, range: 120, enabled: true },
                            d: { ...cur.d, rotation: 270, fov: 50, range: 80,  enabled: true },
                          };
                        } else if (p.id === 'lobby') {
                          next = {
                            a: { ...cur.a, rotation: 350, fov: 50, range: 40, enabled: true },
                            b: { ...cur.b, rotation: 30,  fov: 50, range: 40, enabled: true },
                            c: { ...cur.c, rotation: 70,  fov: 50, range: 40, enabled: true },
                            d: { ...cur.d, rotation: 110, fov: 50, range: 40, enabled: true },
                          };
                        }
                        onUpdate({ lenses: next });
                      }}
                      className="text-left px-3 py-2 rounded-md border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.04] transition-colors duration-150"
                      style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
                    >
                      <div className="text-[12px] font-medium text-foreground tracking-tight">{p.label}</div>
                      <div className="text-[10.5px] text-muted-foreground/80 mt-0.5">{p.hint}</div>
                    </button>
                  ))}
                </div>
              </DrawerSection>
            )}
          </>
        )}

        {bodyShows(tab, 'ai') && (
          <>
            <ConduitAssistSection projectId={(d as any).projectId ?? 'p1'} />
            <AiOptimizeSection d={d} tone={tone} />
          </>
        )}

        {bodyShows(tab, 'network') && (() => {
          const isIdfDevice = d.type === 'net.idf' || d.type === 'net.mdf' || d.type === 'inf.rack' || d.type === 'inf.mdf';
          if (isIdfDevice) {
            return <IdfPortScheduleSection idfId={d.id} />;
          }
          return (
            <>
              <DrawerSection title="Network">
                <Row label="IDF" value="IDF-02 / Port 14" />
                <Row label="VLAN" value="240 / cctv" />
                <Row label="IPv4" value="10.40.12.84" />
                <Row label="MAC" value="B8:A4:4F:91:0C:2A" />
                <Row label="Switch" value="Aruba 2930F-24P" />
                <Row label="Link" value="1 Gbps full duplex" tone="#34D399" />
              </DrawerSection>
              <DrawerSection title="Bandwidth">
                <Row label="Avg bitrate" value="6.4 Mbps" />
                <Row label="Peak" value="12.1 Mbps" />
                <Row label="Storage / day" value="68 GB" />
              </DrawerSection>
            </>
          );
        })()}

        {bodyShows(tab, 'power') && (
          <>
            <DrawerSection title="PoE">
              <Row label="Standard" value="802.3at (Type 2)" />
              <Row label="Draw" value="9.8 W" />
              <Row label="Budget" value="25.5 W" />
              <Row label="UPS" value="APC SRT-3000 · 18 min" tone="#34D399" />
            </DrawerSection>
            <DrawerSection title="Thermal">
              <Row label="Operating temp" value="32 °C" />
              <Row label="Headroom" value="28 °C" tone="#34D399" />
            </DrawerSection>
          </>
        )}

        {bodyShows(tab, 'mounting') && (
          <>
            <DrawerSection title="Mount">
              <Row label="Type" value="Ceiling pendant" />
              <Row label="Height" value={`${d.mountFt ?? 9}' AFF`} />
              <Row label="Tilt" value="−14°" />
              <Row label="Pan" value={`${d.rot}°`} />
              <Row label="Surface" value="ACT — needs T-bar adapter" tone="#FACC15" />
            </DrawerSection>
            {/* Compatible accessories — wall / pole / corner / parapet mount
                + junction box, picked from ACCESSORIES by camera type. The
                user toggles each row on/off; selections persist on the
                device as `accessories[]` and are summed into the BOM. */}
            <AccessoriesSection
              cameraType={d.type}
              selected={d.accessories ?? []}
              onToggle={(id) => {
                const cur = d.accessories ?? [];
                const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
                onUpdate({ accessories: next });
              }}
            />
          </>
        )}

        {bodyShows(tab, 'compliance') && (
          isCam ? (
            // Cameras: do NOT claim NEC / ADA / UL / privacy / retention
            // as verified. Those rows were hardcoded constants, not a
            // rules-engine result — they would falsely imply compliance
            // certification. This body is a disabled checklist preview.
            <DrawerSection title="Compliance checklist">
              <div className="text-[11.5px] text-muted-foreground mb-2">
                Scope of checks for this camera. Run the project audit from Reports to validate.
              </div>
              <div className="space-y-1 text-[11.5px] opacity-60 pointer-events-none select-none">
                <div className="flex items-baseline justify-between py-1 border-b border-border/40">
                  <span>NEC 725 cable class</span><span className="text-muted-foreground">pending</span>
                </div>
                <div className="flex items-baseline justify-between py-1 border-b border-border/40">
                  <span>ADA mount height arc</span><span className="text-muted-foreground">pending</span>
                </div>
                <div className="flex items-baseline justify-between py-1 border-b border-border/40">
                  <span>Fire rating · plenum cable</span><span className="text-muted-foreground">pending</span>
                </div>
                <div className="flex items-baseline justify-between py-1 border-b border-border/40">
                  <span>UL 2802 surveillance compliance</span><span className="text-muted-foreground">pending</span>
                </div>
                <div className="flex items-baseline justify-between py-1 border-b border-border/40">
                  <span>Privacy mask zones</span><span className="text-muted-foreground">pending</span>
                </div>
                <div className="flex items-baseline justify-between py-1">
                  <span>Retention policy</span><span className="text-muted-foreground">pending</span>
                </div>
              </div>
            </DrawerSection>
          ) : (
            // Non-camera devices (doors / readers / IDFs / etc.). The
            // previous body shipped Verified / Class 2 / Clear / 30-day
            // rows that were hardcoded constants, not rules-engine
            // output. Until those checks exist as real rules, every row
            // renders as `pending` against a "Rules engine not wired"
            // banner. Section labels are kind-aware so the surveyor
            // sees what scope WILL eventually be validated, without
            // implying any of it is validated today.
            <DrawerSection title="Compliance checklist">
              <div className="text-[11.5px] text-muted-foreground mb-2">
                Scope of checks for this object. Run the project audit from Reports to validate.
              </div>
              <div className="space-y-1 text-[11.5px] opacity-60 pointer-events-none select-none">
                {(() => {
                  const isDoor =
                    d.type.startsWith('inf.door') || d.type.startsWith('inf.gate')
                    || d.type.startsWith('inf.storefront') || d.type.startsWith('inf.doubledoor')
                    || d.type === 'inf.elevator';
                  const isReader = d.type === 'acc.reader' || d.type === 'acc.keypad' || d.type === 'acc.biometric';
                  const isIdf = d.type === 'net.idf' || d.type === 'net.mdf' || d.type === 'inf.rack' || d.type === 'inf.mdf';
                  const rows = isDoor
                    ? ['NFPA 80 / 101 egress path', 'NFPA 72 fire alarm interconnect', 'ADA accessible opening', 'Maglock + REX pairing', 'Strike voltage match', 'Battery backup runtime']
                    : isReader
                      ? ['ADA reach (15–48 in)', 'Mullion-strike clearance', 'Mounting-height code', 'Cable type (plenum vs riser)', 'Door coordination']
                      : isIdf
                        ? ['Rack U budget', 'PoE budget per switch', 'UPS runtime', 'Thermal load', 'Patch-port density']
                        : ['NEC 725 cable class', 'ADA / accessibility', 'Fire rating', 'UL listing', 'Retention policy'];
                  return rows.map((label, i) => (
                    <div key={i} className="flex items-baseline justify-between py-1 border-b border-border/40 last:border-b-0">
                      <span>{label}</span>
                      <span className="text-muted-foreground">pending</span>
                    </div>
                  ));
                })()}
              </div>
            </DrawerSection>
          )
        )}

        {bodyShows(tab, 'telemetry') && (
          isCam ? (
            // Telemetry rows below were hardcoded ("Uptime 99.94%", etc.).
            // We have no live data feed — replaced with a disabled preview.
            <DrawerSection title="Live telemetry · preview">
              <div className="text-[10.5px] uppercase tracking-[0.10em] text-amber-300 mb-1">
                No live telemetry feed connected
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                Uptime, packet loss, frame drops, signal, and last reboot
                will appear here when the camera connector ships. They are
                not measured today.
              </div>
            </DrawerSection>
          ) : (
            // Non-camera telemetry was also hardcoded ("Uptime 99.94%",
            // "Packet loss 0.02%", etc.). No live data feed is connected
            // for ANY device kind today — replace with an honest preview
            // banner for doors / readers / IDFs as well.
            <DrawerSection title="Live telemetry · preview">
              <div className="text-[10.5px] uppercase tracking-[0.10em] text-amber-300 mb-1">
                No live telemetry feed connected
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                When the device's connector ships, uptime / packet loss /
                last-reboot / online status will appear here. None of those
                values are measured for this object today.
              </div>
            </DrawerSection>
          )
        )}

        {bodyShows(tab, 'linked') && (
          <>
            <DoorAssemblySection d={d} onUpdate={onUpdate} />
            <StackSectionForHost d={d} onUpdate={onUpdate} />
          </>
        )}

        {bodyShows(tab, 'notes') && (
          <DrawerSection title="Field notes">
            <textarea
              key={d.id}
              value={d.notes ?? ''}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Engineering notes — mount blocking, aim direction, GC coordination, etc."
              className="dv-input text-[12px] resize-none min-h-[140px]"
            />
          </DrawerSection>
        )}

        {bodyShows(tab, 'survey') && (
          <SurveySection device={d} onUpdate={onUpdate} />
        )}

        {bodyShows(tab, 'attachments') && (() => {
          // Door-class devices store attachments under linkType 'door';
          // everything else under 'device'. Keeps the project-wide
          // attachments slice navigable by kind without forcing every
          // consumer to remember "is this device id actually a door?".
          const t = String(d.type);
          const isOpening = t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor');
          return (
            <DrawerSection title="Files & attachments">
              <AttachmentPanel
                projectId={d.projectId}
                linkedObjectType={isOpening ? 'door' : 'device'}
                linkedObjectId={d.id}
                defaultCategory={isOpening ? 'photo' : 'photo'}
                title={isOpening ? 'Door files' : 'Device files'}
              />
            </DrawerSection>
          );
        })()}

        {bodyShows(tab, 'accessories') && (
          <AccessoriesSection
            cameraType={d.type}
            selected={d.accessories ?? []}
            onToggle={(id) => {
              const cur = d.accessories ?? [];
              const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
              onUpdate({ accessories: next });
            }}
          />
        )}

        {/* Media + History sections removed in Canvas V2 Pass 1.0 —
            both were dead controls with "preview only" disclaimers.
            Files (AttachmentPanel) replaces Media; History returns
            with the per-object audit log. */}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TARGET SIMULATION — drag a human into coverage, live portrait card
   ═══════════════════════════════════════════════════════════════════════ */

function TargetSimOverlay({ d, zoom, pos, setPos, onClose }: {
  d: Device; zoom: number;
  pos: { x: number; y: number };
  setPos: (p: { x: number; y: number }) => void;
  onClose: () => void;
}) {
  // Real DORI math instead of decorative scoring. Each camera carries its
  // own horizontal FOV in degrees + sensor width in pixels. Pixels-on-target
  // at the simulated subject = sensorPx / (2 * distance * tan(fov / 2)).
  // DORI thresholds (px per m on subject) are the EN-50132-7 / IEC 62676
  // standard. We render those next to the live px/m calculation so the user
  // sees, at distance X, which threshold the camera achieves.
  const tone = deviceTone(d);
  // Convert pixel distance to feet via the camera's own floor calibration.
  const pxToFt = useProjectStore((s) => ftPerPxForFloor(d.floorId ? s.floors[d.floorId] : undefined));
  const dx = pos.x - d.x;
  const dy = pos.y - d.y;
  const dist = Math.hypot(dx, dy);
  const distFt = dist * pxToFt;
  const distM  = distFt * 0.3048;
  const angleToCam = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const camAim = ((d.rot + 360) % 360);
  const aimDelta = Math.min(Math.abs(angleToCam - camAim), 360 - Math.abs(angleToCam - camAim));
  // Camera spec defaults if not yet edited
  const sensorPx = 1920; // 1080p horizontal
  const fovDeg   = (d.fov ?? (d.type === 'cam.ptz' ? 60 : d.type === 'cam.fisheye' ? 180 : 90));
  const halfFovRad = (fovDeg * Math.PI / 180) / 2;
  const fovWidthM  = Math.max(0.01, 2 * distM * Math.tan(halfFovRad));
  const pxPerM = sensorPx / fovWidthM;
  const pxPerFt = pxPerM * 0.3048;
  const inHalfFov = aimDelta < (fovDeg / 2) + 4;
  const inRange = distFt < (d.range ?? 80);
  const inFOV = inHalfFov && inRange;
  // DORI bands (px / m). EN-50132-7 / IEC 62676.
  const DORI = [
    { id: 'identify',  label: 'Identify',  min: 250, tone: '#34D399' },
    { id: 'recognize', label: 'Recognize', min: 125, tone: '#7CC2FF' },
    { id: 'observe',   label: 'Observe',   min:  63, tone: '#FACC15' },
    { id: 'detect',    label: 'Detect',    min:  25, tone: '#FB923C' },
  ];
  const achieved = DORI.find((b) => pxPerM >= b.min);
  // Person assumed 1.7m tall, face 0.18m wide → expected pixels on subject.
  const facePx = Math.round(pxPerM * 0.18);
  const bodyPx = Math.round(pxPerM * 0.5);   // shoulder width
  const heightPx = Math.round(pxPerM * 1.7);

  const onPointerDown = (e: React.PointerEvent) => {
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* capture optional */ }
    e.stopPropagation();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    setPos({ x: pos.x + e.movementX / zoom, y: pos.y + e.movementY / zoom });
  };

  return (
    <>
      {/* Subject indicator on canvas — minimal stick figure, no cartoon face.
          Color reflects whether the subject is in FOV + range. The label
          underneath shows distance in feet. */}
      <div
        className="absolute z-30 pointer-events-auto select-none cursor-grab active:cursor-grabbing"
        style={{ left: pos.x * zoom, top: pos.y * zoom, transform: 'translate(-50%, -100%)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <svg width="22" height="44" viewBox="0 0 22 44" style={{ filter: `drop-shadow(0 2px 6px rgba(0,0,0,0.6))` }}>
          <circle cx="11" cy="6" r="4" fill="none" stroke={inFOV ? tone : '#64748B'} strokeWidth="1.6" />
          <path d="M11 10 L11 28 M11 14 L4 22 M11 14 L18 22 M11 28 L6 42 M11 28 L16 42" stroke={inFOV ? tone : '#64748B'} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
        <div className="text-center mt-0.5 text-[9px] uppercase tracking-[0.18em] tabular-nums" style={{ color: inFOV ? tone : '#64748B' }}>
          {distFt.toFixed(1)} ft
        </div>
      </div>

      {/* DORI panel. Engineering numbers, not a cartoon portrait.
          UX hard-reset: this side card is suppressed by default — the
          drawer Coverage tab now carries the full Overview / Prosecution
          readouts. The card lives behind a localStorage flag for any
          power-user who wants the canvas-side card back. */}
      {(() => {
        try { return localStorage.getItem('canvas:coverage:card') === '1'; } catch { return false; }
      })() && (
      <div
        className="absolute z-40 pointer-events-auto select-none"
        style={{ left: pos.x * zoom + 36, top: pos.y * zoom - 140, width: 280 }}
      >
        <div
          className="rounded-lg overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(14,19,30,0.97), rgba(10,14,22,0.97))',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${tone}44`,
            boxShadow: `0 16px 36px -12px rgba(0,0,0,0.75), 0 0 0 1px ${tone}1A`,
          }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
            <ScanFace className="w-3.5 h-3.5" style={{ color: tone }} />
            <span className="text-[10px] uppercase tracking-[0.18em] text-foreground">Coverage check</span>
            <span className="text-[9px] uppercase tracking-[0.16em] text-amber-300/70 px-1.5 py-0.5 rounded border border-amber-300/30 ml-auto">Simulated</span>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>

          {/* In-FOV chip + distance */}
          <div className="px-3 py-2.5 border-b border-white/5 grid grid-cols-3 gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Distance</div>
              <div className="text-base font-medium tabular-nums text-foreground">{distFt.toFixed(1)} <span className="text-[10px] text-muted-foreground">ft</span></div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Off-axis</div>
              <div className="text-base font-medium tabular-nums text-foreground">{aimDelta.toFixed(0)}<span className="text-[10px] text-muted-foreground">°</span></div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">In FOV</div>
              <div className="text-[12px] font-medium uppercase tracking-wider tabular-nums" style={{ color: inFOV ? '#34D399' : '#F87171' }}>
                {inFOV ? 'YES' : (!inHalfFov ? 'Off-axis' : 'Past range')}
              </div>
            </div>
          </div>

          {/* DORI ladder — which band is achieved at the current distance */}
          <div className="px-3 py-2.5 border-b border-white/5">
            <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground mb-2 flex items-center gap-2">
              <span>DORI band</span>
              <span className="flex-1 h-px bg-white/5" />
              <span className="tabular-nums text-muted-foreground">{pxPerM.toFixed(0)} px/m</span>
            </div>
            {DORI.map((b) => {
              const hit = pxPerM >= b.min;
              const isTop = achieved?.id === b.id;
              return (
                <div key={b.id} className={`flex items-center gap-2 py-1 ${hit ? '' : 'opacity-40'}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.tone, boxShadow: hit ? `0 0 6px ${b.tone}` : 'none' }} />
                  <span className={`flex-1 text-[11.5px] ${isTop ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{b.label}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">≥{b.min} px/m</span>
                  {hit && <Check className="w-3 h-3 ml-1" style={{ color: b.tone }} />}
                </div>
              );
            })}
            {!achieved && (
              <div className="text-[10px] text-rose-300 mt-1">Below Detect threshold — too far for usable coverage.</div>
            )}
          </div>

          {/* Pixels on subject */}
          <div className="px-3 py-2.5 border-b border-white/5">
            <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Pixels on subject</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[14px] font-medium tabular-nums text-foreground">{facePx}</div>
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Face px</div>
              </div>
              <div>
                <div className="text-[14px] font-medium tabular-nums text-foreground">{bodyPx}</div>
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Body px</div>
              </div>
              <div>
                <div className="text-[14px] font-medium tabular-nums text-foreground">{heightPx}</div>
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Height px</div>
              </div>
            </div>
          </div>

          {/* Forensic / prosecution-grade readouts — license plate, IR, and
              low-light confidence. These are heuristics from the camera spec
              and the standing distance, not an actual video feed: but they
              telegraph the right design intent ("would this hold up in
              court") that the user asked for. */}
          <div className="px-3 py-2.5 border-b border-white/5">
            <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Forensic quality</div>
            {(() => {
              // Plate detection wants ~80 px on a 520mm plate (US standard).
              const platePx = Math.round(pxPerM * 0.52);
              const plateReady = platePx >= 80;
              const isLPR = d.type === 'cam.lpr';
              // Identification grade (per IEC) needs ~250 px/m on the face.
              const idGrade = pxPerM >= 250 ? 'Excellent' : pxPerM >= 125 ? 'Adequate' : pxPerM >= 63 ? 'Marginal' : 'Insufficient';
              // IR / low-light usefulness scaled by distance vs IR range
              // (assume 30m typical IR LED). Drops linearly past that.
              const irRange = d.ir ? 30 : 0;
              const irPct = irRange > 0
                ? Math.max(0, Math.min(100, Math.round((1 - distM / irRange) * 100)))
                : 0;
              const lowLightTone = idGrade === 'Excellent' ? '#34D399' : idGrade === 'Adequate' ? '#7CC2FF' : idGrade === 'Marginal' ? '#FACC15' : '#F87171';
              return (
                <div className="space-y-1.5 text-[10.5px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Identification</span>
                    <span className="tabular-nums" style={{ color: lowLightTone }}>{idGrade}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">License plate</span>
                    <span className="tabular-nums" style={{ color: plateReady ? '#34D399' : '#F87171' }}>
                      {platePx} px {plateReady ? '✓' : (isLPR ? '· LPR sensor' : '· need ≥80')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">IR effective</span>
                    <span className="tabular-nums" style={{ color: irRange === 0 ? '#64748B' : irPct > 60 ? '#34D399' : irPct > 25 ? '#FACC15' : '#F87171' }}>
                      {irRange === 0 ? 'No IR' : `${irPct}% @ ${distFt.toFixed(0)}ft`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Prosecution-ready</span>
                    <span className="tabular-nums" style={{ color: pxPerM >= 250 && plateReady ? '#34D399' : pxPerM >= 125 ? '#FACC15' : '#F87171' }}>
                      {pxPerM >= 250 && plateReady ? 'Yes' : pxPerM >= 125 ? 'Partial' : 'No'}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Operating conditions */}
          <div className="px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Operating conditions</div>
            <div className="grid grid-cols-2 gap-1 text-[10.5px]">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Sensor</span><span className="tabular-nums text-muted-foreground">1920px</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">HFOV</span><span className="tabular-nums text-muted-foreground">{fovDeg}°</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Width@dist</span><span className="tabular-nums text-muted-foreground">{fovWidthM.toFixed(1)} m</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">px/ft</span><span className="tabular-nums text-muted-foreground">{pxPerFt.toFixed(1)}</span></div>
            </div>
          </div>

          <div className="px-3 py-1.5 border-t border-white/5 text-[9px] text-muted-foreground leading-relaxed">
            Computed from camera FOV + range. Drag the stick figure to test other distances.
          </div>
        </div>
      </div>
      )}
    </>
  );
}

function ImmersionControls({ focusMode, setFocusMode }: { focusMode: boolean; setFocusMode: (b: boolean) => void }) {
  // Single-button "Focus" control. Density and other engineering overlays
  // moved into the Layers panel so the canvas surface stays calm.
  return (
    <div className="absolute top-3 right-[180px] z-20 pointer-events-auto select-none">
      <button
        onClick={() => setFocusMode(!focusMode)}
        className="px-2 py-1 rounded-lg flex items-center gap-1.5 text-[10px] transition-colors"
        style={{
          background: focusMode ? 'rgba(124,194,255,0.10)' : 'rgba(8,12,20,0.78)',
          backdropFilter: 'blur(14px)',
          color: focusMode ? '#F8FAFC' : '#94A3B8',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: focusMode
            ? 'inset 0 0 0 1px rgba(124,194,255,0.55), 0 10px 24px -10px rgba(0,0,0,0.7)'
            : '0 10px 24px -10px rgba(0,0,0,0.7)',
        }}
      >
        <Maximize2 className="w-3 h-3" style={{ color: focusMode ? '#7CC2FF' : undefined }} />
        <span className="uppercase tracking-[0.16em]">Focus</span>
      </button>
    </div>
  );
}

function CoverageModeSwitch({ mode, setMode }: { mode: CoverageMode; setMode: (m: CoverageMode) => void }) {
  const modes: { id: CoverageMode; label: string; tone: string }[] = [
    { id: 'minimal',      label: 'Minimal',      tone: '#94A3B8' },
    { id: 'soft',         label: 'Soft',         tone: '#7CC2FF' },
    { id: 'tactical',     label: 'Tactical',     tone: '#FACC15' },
    { id: 'heatmap',      label: 'Heatmap',      tone: '#FB7185' },
    { id: 'wireframe',    label: 'Wireframe',    tone: '#34D399' },
    { id: 'presentation', label: 'Presentation', tone: '#A78BFA' },
    { id: 'night',        label: 'Night',        tone: '#60A5FA' },
  ];
  return (
    <div className="absolute top-3 left-3 z-20 pointer-events-auto select-none">
      <div
        className="flex items-center gap-0.5 p-1 rounded-lg text-[10px]"
        style={{
          background: 'rgba(8,12,20,0.78)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 10px 24px -10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div className="px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-muted-foreground border-r border-white/8 mr-1">Coverage</div>
        {modes.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className="px-2 py-1 rounded-md transition-colors flex items-center gap-1.5"
              style={{
                background: active ? `${m.tone}1A` : 'transparent',
                color: active ? '#F8FAFC' : '#94A3B8',
                boxShadow: active ? `inset 0 0 0 1px ${m.tone}55` : 'none',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.tone, boxShadow: active ? `0 0 6px ${m.tone}` : 'none' }} />
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
 *  the on-canvas chips AND the embedded AI Assistant panel. */
function computeIntelIssues(devices: Device[]): IntelIssue[] {
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
  // Rough heuristic: any camera further than 600px from the nearest IDF.
  if (idfs.length > 0) {
    for (const c of cams) {
      let minPx = Infinity;
      for (const i of idfs) minPx = Math.min(minPx, Math.hypot(c.x - i.x, c.y - i.y));
      if (minPx > 600) {
        out.push({
          id: `cab-${c.id}`,
          kind: 'cabling',
          severity: 'warn',
          x: c.x + 18, y: c.y - 18,
          label: 'Cable run exceeds 90m',
          detail: `${c.id} is ~${Math.round(minPx / 3.83)} ft from nearest IDF.`,
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

function IntelligenceLayer({ devices, zoom, open, setOpen }: { devices: Device[]; zoom: number; open: boolean; setOpen: (b: boolean) => void }) {
  const issues = useMemo(() => computeIntelIssues(devices), [devices]);
  const summary = useMemo(() => {
    const by: Record<string, number> = {};
    issues.forEach((i) => { by[i.severity] = (by[i.severity] ?? 0) + 1; });
    return by;
  }, [issues]);
  /** Active "AI Assistant" side-panel state. The pill in the top-right both
   *  toggles inline canvas chips (compact mode, default) and opens the
   *  full assistant panel for an expanded engineering review. */
  const [panelOpen, setPanelOpen] = useState(false);
  // Surveyor UX hard reset: the Chips + Assistant pills are no longer
  // permanently visible — the default canvas state must be calm. The
  // top-bar overflow exposes an "Intelligence" toggle which flips `open`
  // to true; only then do the pills (and on-canvas chips) appear.
  if (!open) return null;
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

      {/* top-right intelligence summary — two stacked pills: a compact
          chip toggle (left of label), and the AI Assistant open/close. */}
      <div className="absolute top-3 right-3 z-20 pointer-events-auto select-none flex items-center gap-1.5">
        <button
          onClick={() => setOpen(!open)}
          title="Toggle on-canvas intelligence chips"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px]"
          style={{
            background: 'rgba(8,12,20,0.78)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#E2E8F0',
            boxShadow: '0 10px 24px -10px rgba(0,0,0,0.7)',
          }}
        >
          <Activity className="w-3.5 h-3.5 text-sky-300" />
          <span className="uppercase tracking-[0.18em] text-[9px] text-muted-foreground">Chips</span>
          {open ? <Eye className="w-3 h-3 text-muted-foreground" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
        </button>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          title="Open AI engineering assistant"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px]"
          style={{
            background: panelOpen ? 'rgba(82,146,220,0.18)' : 'rgba(8,12,20,0.78)',
            backdropFilter: 'blur(14px)',
            border: panelOpen ? '1px solid rgba(82,146,220,0.5)' : '1px solid rgba(255,255,255,0.08)',
            color: '#E2E8F0',
            boxShadow: '0 10px 24px -10px rgba(0,0,0,0.7)',
          }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: panelOpen ? '#A6C8F0' : '#A6C8F0' }} />
          <span className="uppercase tracking-[0.18em] text-[9px] text-muted-foreground">Assistant</span>
          {summary.high ? <span className="tabular-nums text-rose-300">{summary.high}</span> : null}
          {summary.warn ? <span className="tabular-nums text-amber-300">{summary.warn}</span> : null}
          {!summary.high && !summary.warn && !issues.length && <span className="tabular-nums text-emerald-300">clear</span>}
        </button>
      </div>

      {/* AI Assistant side panel — embedded on the right of the canvas.
          Lists every issue with severity, location, and suggestion.
          Clicking a row scrolls the canvas viewport to that issue's
          coordinates. Not a chatbot — this is an engineering review
          that updates the moment the canvas changes. */}
      {panelOpen && (
        <div
          className="absolute top-3 right-3 mt-12 z-30 w-[320px] max-h-[calc(100vh-180px)] overflow-hidden flex flex-col rounded-xl"
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
              <div className="text-[12.5px] font-medium text-foreground tracking-tight">Engineering assistant</div>
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
              <div className="px-4 py-8 text-center text-[11.5px] text-emerald-300/80">
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
                          <div className="text-[10.5px] text-muted-foreground mt-1.5 leading-snug border-l-2 border-sky-400/30 pl-2 italic">
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

function HudChip({ children, onClick, active, title }: { children: any; onClick: () => void; active?: boolean; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 inline-flex items-center gap-1 border-r border-white/8 transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}

function CommitInput({ value, onCommit, className }: { value: string; onCommit: (v: string) => void; className?: string }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onCommit(local); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { setLocal(value); (e.target as HTMLInputElement).blur(); }
      }}
      className={className}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   QUICK TOOLS CAPSULE  ·  ZOOM DOCK  ·  MINIMAP  ·  STATUS BAR
   ═══════════════════════════════════════════════════════════════════════ */

/** Picker that floats above the canvas QuickTools strip while the cable
 *  tool is active. Click a cable type to set it for the in-progress run.
 *  The selected type drives the line stroke + appears in the pathway record. */
function CableTypePicker({ value, onChange }: { value: CableTypeId; onChange: (t: CableTypeId) => void }) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-[68px] z-20 select-none">
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

function PathwaysOverlay({ onPickBundle, onPickPathway }: {
  onPickBundle?: (bundleId: string) => void;
  onPickPathway?: (pathwayId: string) => void;
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
      if (p.bundleId) (bundles[p.bundleId] ??= []).push(p);
      else standalone.push(p);
    }
    return { bundles, standalone };
  }, [pathways]);
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
                <text textAnchor="middle" y={2.5} fontSize="8.5" fontWeight="600" fill={handleTone} fontFamily="ui-monospace, monospace">
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
                    className="w-full text-left px-3 py-1.5 text-[11.5px] hover:bg-secondary/40 flex items-center justify-between"
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
function DrawingToolRail({
  tool, setTool, snap, setSnap, layersOpen, onToggleLayers, onOpenScanBuild,
  onFit, onCenter, onActual,
  onSelectAll,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  snap: boolean;
  setSnap: (v: boolean) => void;
  layersOpen: boolean;
  onToggleLayers: () => void;
  onOpenScanBuild: () => void;
  onFit: () => void;
  onCenter: () => void;
  onActual: () => void;
  onSelectAll: (kind: 'cameras' | 'doors' | 'readers' | 'idfs') => void;
}) {
  type ItemId = Tool | 'snap' | 'layers' | 'map';
  type Item = { id: ItemId; icon: any; label: string; key?: string; hint: string; coming?: boolean };
  // VISIBLE left-rail tools. Cable is NOT here — cabling is an
  // equipment category, not a left-side tool. The internal `tool ===
  // 'cable'` state is still used by the engine, but it gets armed
  // from the bottom Cabling tray, not from this rail.
  const items: Item[] = [
    { id: 'select',  icon: MousePointer2, label: 'Select',     key: 'V', hint: 'Select and edit objects on the plan.' },
    { id: 'pan',     icon: Hand,          label: 'Pan',        key: 'H', hint: 'Drag to pan the floorplan; cursor changes to a grab hand.' },
    { id: 'measure', icon: Ruler,         label: 'Measure',    key: 'M', hint: 'Two clicks to measure distance. Esc to cancel.' },
    { id: 'wall',    icon: WallIcon,      label: 'Wall',       key: 'W', hint: 'Draw wall segments. Click vertices, double-click to finish.' },
  ];
  // Coming-soon tools — removed per "If a control doesn't work, hide it".
  // Text / Room / Door-opening / Window / Scale / Photo will reappear when
  // their wiring lands. Until then they don't get a visible slot.
  const coming: Item[] = [];

  // Expand-on-click: clicking a tool also opens the side panel; the
  // panel persists with the chosen tool's id. Clicking the same icon
  // again toggles the panel closed.
  const [panelId, setPanelId] = useState<ItemId | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!panelId) return;
    const onDown = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setPanelId(null);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanelId(null); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [panelId]);

  const onPick = (it: Item) => {
    if (it.coming) return;
    if (it.id === 'select' || it.id === 'pan' || it.id === 'measure' || it.id === 'wall') setTool(it.id as Tool);
    setPanelId(panelId === it.id ? null : it.id);
  };

  const Tile = ({ it, badge }: { it: Item; badge?: React.ReactNode }) => {
    const Icon = it.icon;
    const isActiveTool = !it.coming && (it.id === 'select' || it.id === 'pan' || it.id === 'measure' || it.id === 'wall') && tool === it.id;
    const isActivePanel = panelId === it.id;
    const isDimmed = !!it.coming;
    return (
      <button
        onClick={() => onPick(it)}
        title={it.coming ? `${it.label} — Coming soon` : `${it.label}${it.key ? ` (${it.key})` : ''} — ${it.hint}`}
        data-track={`tool-${it.label.toLowerCase().replace(/\W+/g,'-')}`}
        className={`group relative flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-xl transition-colors ${
          isDimmed
            ? 'text-white/30 cursor-not-allowed'
            : isActiveTool || isActivePanel
              ? 'bg-white/15 text-white'
              : 'text-white/65 hover:text-white hover:bg-white/8'
        }`}
        disabled={isDimmed}
      >
        <Icon className="w-4 h-4" strokeWidth={1.7} />
        <span className="text-[8.5px] tracking-tight">{it.label}</span>
        {(isActiveTool || isActivePanel) && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-[var(--primary)]" />}
        {badge}
      </button>
    );
  };

  return (
    <div className="absolute z-40 top-3 left-3 flex items-start" ref={railRef} data-canvas-chrome="rail">
      {/* Slim black rail — working tools only. Coming-soon tools live
          inside the "More" panel so they don't clutter the default view. */}
      <div
        className="flex flex-col items-center gap-0.5 rounded-2xl border bg-[#0B0F19]/95 backdrop-blur-md p-1.5 shadow-[0_18px_36px_-18px_rgba(0,0,0,0.65)] select-none"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        {items.map((it) => <Tile key={it.label} it={it} />)}
        <div className="w-7 h-px bg-white/10 my-1.5" />
        {/* Snap toggle was removed from the rail to drop the duplicate
            (it now lives only in the top bar overflow menu). Layers
            and Map remain because they each open distinct side panels. */}
        <Tile it={{ id: 'layers', icon: Layers,    label: 'Layers', hint: 'Toggle engineering overlays on the canvas.' }} />
        <Tile it={{ id: 'map',    icon: MapIcon,   label: 'Map',    hint: 'Bring a floorplan in: scan / upload / satellite / sketch.' }} />
      </div>

      {/* Expanded side panel — z-50 so it always paints above the canvas
          surface chrome (selection pill z-30, intelligence layer z-30,
          armed-placement banner z-30). Without this the panel was
          occluded by floating canvas overlays. */}
      {panelId && (
        <div
          className="relative z-50 ml-2 w-[260px] rounded-2xl border bg-[var(--card)] backdrop-blur-md p-3 shadow-[var(--shadow-floating)] text-[var(--card-foreground)]"
          style={{ borderColor: 'var(--border)' }}
        >
          {(() => {
            const meta = ([...items, ...coming, ...[
              { id: 'snap',   icon: Magnet,  label: 'Snap',   hint: 'Magnetic alignment guides while you draw or move objects.' },
              { id: 'layers', icon: Layers,  label: 'Layers', hint: 'Toggle engineering overlays on the canvas.' },
              { id: 'map',    icon: MapIcon, label: 'Map',    hint: 'Bring in a floorplan: scan, upload, satellite, or draw from scratch.' },
            ] as Item[]] as Item[]).find((x) => x.id === panelId && (x.label === panelLabel(panelId) || x.coming === undefined));
            // Find by id+label since multiple items share `id:'select'` (coming-soon).
            // The panel content branches by panelId + label.
            return null;
          })()}
          <ToolPanelHeader panelId={panelId} onClose={() => setPanelId(null)} />
          <ToolPanelBody
            panelId={panelId}
            snap={snap} setSnap={setSnap}
            layersOpen={layersOpen} onToggleLayers={onToggleLayers}
            onOpenScanBuild={onOpenScanBuild}
            onFit={onFit} onCenter={onCenter} onActual={onActual}
            onSelectAll={onSelectAll}
          />
        </div>
      )}
    </div>
  );
}

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
        <div className="text-[12.5px] font-semibold tracking-tight">{panelLabel(panelId)}</div>
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
    <div className="text-[10.5px] text-muted-foreground leading-snug px-1">{children}</div>
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
        <div className="rounded-md border border-border bg-secondary/20 p-2.5 mt-2 text-[11.5px]">
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
        <div className="text-[10.5px] text-muted-foreground italic px-1 mt-2">Wall type, fire-rating, and orthogonal-lock controls ship next pass.</div>
      </div>
    );
  }
  if (panelId === 'snap') {
    return (
      <div className="space-y-1.5">
        <label className="flex items-center justify-between py-2 px-2.5 rounded-md bg-secondary/20 cursor-pointer">
          <span className="text-[12px] font-medium">Magnetic snap</span>
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} className="accent-primary" />
        </label>
        <div className="rounded-md border border-border bg-secondary/20 p-2.5 text-[11.5px] space-y-1">
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Grid</span><span className="text-foreground">20 px / 1 ft</span></div>
          <div className="flex items-center justify-between"><span className="text-muted-foreground">Tolerance</span><span className="text-foreground">5 px</span></div>
        </div>
        <Hint>Snap pulls drag + draw points to the grid and to other devices within tolerance.</Hint>
      </div>
    );
  }
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
  return <div className="text-[11.5px] text-muted-foreground italic">No panel for this tool.</div>;
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
  const cats: Cat[] = [
    { id: 'cam',       group: 'surveillance', label: 'Cameras',    icon: Video,           types: ['cam.dome','cam.bullet','cam.turret','cam.ptz','cam.multisensor','cam.fisheye','cam.lpr','cam.thermal'] },

    { id: 'door',      group: 'access', label: 'Doors',      icon: DoorOpen,        types: ['inf.door' as any,'inf.doubledoor' as any,'inf.storefront' as any,'inf.gate' as any] },
    { id: 'acc',       group: 'access', label: 'Access',     icon: ScanFace,        types: ['acc.reader','acc.keypad','acc.strike','acc.maglock','acc.exit','acc.dps','acc.panic','acc.controller','acc.psu'] as any },
    { id: 'intercom',  group: 'access', label: 'Intercom',   icon: Phone,           types: ['acc.intercom' as any,'av.intercom' as any] as any },

    { id: 'intrusion', group: 'detect', label: 'Intrusion',  icon: ShieldAlert,     types: ['sen.glassbreak' as any,'sen.contact' as any,'sen.panic' as any,'int.contact' as any] as any },
    { id: 'fire',      group: 'detect', label: 'Fire',       icon: Flame,           types: ['fire.pull' as any,'fire.detector' as any,'fire.horn' as any,'fire.strobe' as any] as any },
    { id: 'sensor',    group: 'detect', label: 'Sensors',    icon: Thermometer,     types: ['sen.motion' as any,'sen.glassbreak' as any,'sen.smoke' as any,'sen.temp' as any] as any },

    { id: 'audio',     group: 'av',     label: 'Audio / PA', icon: Volume2,         types: ['av.speaker' as any,'av.amp' as any,'av.mic' as any] as any },

    { id: 'net',       group: 'backbone', label: 'Network',  icon: NetworkIcon,     types: ['net.switch','net.idf','net.mdf','net.ap','net.firewall' as any] },
    { id: 'cable',     group: 'backbone', label: 'Cabling',  icon: Cable },
    { id: 'conduit',   group: 'backbone', label: 'Conduit',  icon: PencilRuler },
    { id: 'power',     group: 'backbone', label: 'Power',    icon: BatteryCharging, types: ['inf.ups' as any,'inf.psu' as any,'inf.transformer' as any] as any },

    { id: 'inf',       group: 'site',   label: 'Site infra', icon: Server,          types: ['inf.rack','inf.mdf','inf.window' as any,'inf.wall' as any] as any },
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
  // The Conduit sub-tab defaults to a 6-button "common sizes" set
  // (EMT 1/2 · EMT 3/4 · EMT 1 · PVC 3/4 · PVC 1 · raceway). Flip this
  // toggle to expose the full 30-cell type × size matrix.
  const [conduitShowAll, setConduitShowAll] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [open]);

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

  // V1 P0.5 — count badges. The dock subscribes directly to devices +
  // pathways for the active floor so the parent's prop surface stays
  // clean and every store change flows in without extra plumbing.
  // TODO(multi-floor): mirrors the parent's "first floor of project"
  // shortcut (EngineeringCanvas line ~720). Once the floor selector
  // becomes state-driven, swap this for the selected floor id —
  // otherwise these badges will silently count the wrong floor.
  const { projectId: routeProjectId = 'p1' } = useParams();
  const projectIdForCounts = routeProjectId;
  const currentFloorIdForCounts = useProjectStore((s) =>
    storeSelectors.firstFloorOfProject(s, projectIdForCounts)?.id ?? '',
  );
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
    <div className="absolute left-1/2 -translate-x-1/2 bottom-5 z-30" ref={trayRef} data-canvas-chrome="tray">
      {/* Tray (renders above the bar when a category is open) */}
      {open && trayCat && (
        <div
          className="mb-3 w-[760px] max-w-[92vw] rounded-2xl border bg-card/95 backdrop-blur-xl shadow-[0_22px_48px_-16px_rgba(0,0,0,0.55)] overflow-hidden"
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
                            <div className="text-[11.5px] font-medium tracking-tight">{c.label}</div>
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
                            <div className="text-[11.5px] font-medium tracking-tight">{a.label}</div>
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
                            <div className="text-[11.5px] font-medium tracking-tight">{a.label}</div>
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
                            <div className="text-[11.5px] font-medium tracking-tight">{a.label}</div>
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
                                className="text-left px-2 py-1.5 rounded border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors text-[10.5px]"
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
                            <div className="text-[11.5px] font-medium tracking-tight">{p.label}</div>
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
                            <div className="text-[11.5px] font-medium tracking-tight">{a.label}</div>
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
                            <div className="text-[11.5px] font-medium tracking-tight">{a.label}</div>
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
                                  <div className="text-[11.5px] font-medium tracking-tight">{c.label}</div>
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
                                    className="text-left px-2 py-1.5 rounded border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors text-[10.5px]"
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
                            className="mt-2 text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
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
                            <div className="text-[11.5px] font-medium tracking-tight">{p.label}</div>
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
                            <div className="text-[11.5px] font-medium tracking-tight">{a.label}</div>
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
                            <div className="text-[11.5px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Each</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : trayProducts.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12px] text-muted-foreground">
              No catalog items in this category yet.
            </div>
          ) : (
            // Default product-grid tray for cam / acc / door / net / power / intercom / etc.
            // Cards carry an icon, manufacturer + model, and a per-card hint line.
            <div className="p-3 max-h-[360px] overflow-auto">
              <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1.5 px-1">{trayProducts.length} item{trayProducts.length === 1 ? '' : 's'}</div>
              <div className="grid grid-cols-4 gap-2">
                {trayProducts.map((p) => {
                  const tone = KIND_TONE[TYPE_KIND[p.type]] ?? 'var(--primary)';
                  return (
                    <button
                      key={p.id}
                      onPointerDown={(e) => { onStartDrag(p, e); setOpen(null); }}
                      data-track={`bottombar-${trayCat.id}-${p.id}`}
                      className="group text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-[var(--shadow-low)] hover:-translate-y-[1px] transition-all p-3 flex flex-col gap-2"
                      style={{ transitionDuration: 'var(--motion-fast)' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: `${tone}14`, color: tone, boxShadow: `inset 0 0 0 1px ${tone}55` }}>
                          <DeviceGlyph type={p.type} size={20} tone={tone} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11.5px] font-medium tracking-tight truncate text-foreground">{p.model}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{p.mfr}</div>
                        </div>
                      </div>
                      <div className="text-[10.5px] text-muted-foreground line-clamp-2">{p.sub ?? p.notes ?? '—'}</div>
                      <div className="flex items-center justify-between text-[10px]">
                        {(p as any).recommended ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-500">Recommended</span>
                        ) : <span />}
                        <span className="text-muted-foreground">Drag or click to place</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* The bar itself — premium light surface, fixed item width, active
          underline + tint so the click target reads as a real selection
          rather than a generic toolbar button. V1 P0.6: tiles are
          grouped by domain with a small label header and a thin
          divider between groups so the dock reads as a hierarchy
          rather than 13 flat icons. */}
      <div
        className="rounded-2xl border bg-[var(--card)] backdrop-blur-xl shadow-[var(--shadow-floating)] flex items-stretch overflow-hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        {GROUPS.map((g, gi) => {
          const groupCats = cats.filter((c) => c.group === g.id);
          if (groupCats.length === 0) return null;
          return (
            <div key={g.id} className="flex items-stretch">
              {gi > 0 && <span aria-hidden className="self-stretch w-px bg-border/70 my-1.5" />}
              <div className="flex flex-col">
                <div className="px-2 pt-1 text-[9px] uppercase tracking-[0.10em] font-medium text-muted-foreground/70 whitespace-nowrap">
                  {g.label}
                </div>
                <div className="flex items-stretch">
                  {groupCats.map((c) => {
                    const Icon = c.icon;
                    const isToolCat = !!c.tool;
                    const active = isToolCat ? tool === c.tool : open === c.id;
                    const count = productsByCat[c.id]?.length ?? 0;
                    const isConduitCat = c.id === 'conduit';
                    const isCableCat   = c.id === 'cable';
                    // Cable + Conduit have their own tray bodies (no PRODUCTS
                    // catalog gating); never mark them disabled.
                    // Canvas V2 Pass 1.0 — dead categories (no products,
                    // no tool, no tray) used to render as disabled
                    // buttons with "coming soon" tooltips. Hide them.
                    const dead = !isToolCat && !isConduitCat && !isCableCat && count === 0;
                    if (dead) return null;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          if (isToolCat && c.tool) { onPickTool(c.tool); setOpen(null); return; }
                          setOpen(open === c.id ? null : c.id);
                        }}
                        title={c.label}
                        data-track={`bottombar-cat-${c.id}`}
                        className={`group relative flex flex-col items-center justify-center gap-1 w-[72px] pt-1.5 pb-2 transition-colors ${
                          active
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span className="absolute inset-x-1.5 top-1 bottom-1.5 rounded-md -z-10 transition-colors"
                          style={{ background: active ? 'rgba(45,111,184,0.10)' : 'transparent' }}
                        />
                        <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
                        <span className="text-[10px] tracking-tight font-medium">{c.label}</span>
                        {/* V1 P0.5 count badge — placed devices on the current floor.
                            Hidden at zero so the dock stays calm on a fresh canvas. */}
                        {(countByCat[c.id] ?? 0) > 0 && (
                          <span
                            className={`absolute top-0.5 right-2 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] leading-[15px] text-center font-medium tabular-nums ${
                              active
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-foreground/80 border border-border'
                            }`}
                          >
                            {countByCat[c.id]! > 99 ? '99+' : countByCat[c.id]}
                          </span>
                        )}
                        {/* Active underline */}
                        <span
                          className="absolute left-2.5 right-2.5 bottom-0 h-[2px] rounded-full transition-opacity"
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
      </div>
    </div>
  );
}

function QuickTools({ tool, setTool, showWall }: { tool: Tool; setTool: (t: Tool) => void; showWall: boolean }) {
  // Every tool here MUST have a working canvas behavior. Text and comment
  // tools were previously listed but never handled a click — they've been
  // removed until they're implemented. The brief's rule: no dead controls.
  const items: Array<{ id: Tool; icon: any; label: string; key: string; hint: string }> = [
    { id: 'select',  icon: MousePointer2, label: 'Select',  key: 'V', hint: 'Select and edit objects' },
    { id: 'pan',     icon: Hand,          label: 'Pan',     key: 'H', hint: 'Pan the map · does not select' },
    { id: 'measure', icon: Ruler,         label: 'Measure', key: 'M', hint: 'Click two points to measure distance · ESC to cancel' },
    { id: 'cable',   icon: Cable,         label: 'Cable',   key: 'C', hint: 'Draw cable / pathway · click vertices · Enter or dbl-click to finish · Esc to cancel' },
    ...(showWall ? [{ id: 'wall' as Tool, icon: WallIcon, label: 'Wall', key: 'W', hint: 'Draw a wall · double-click to finish' }] : []),
  ];
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-5 z-20">
      <style>{`@keyframes tool-hint-in { from { opacity: 0; transform: translate(-50%, -4px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
      <div className="bg-card/85 backdrop-blur-xl border border-border/80 rounded-2xl shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)] px-1.5 py-1.5 flex items-center gap-0.5">
        {items.map((it) => {
          const Icon = it.icon;
          const active = tool === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setTool(it.id)}
              title={`${it.label} (${it.key}) — ${it.hint}`}
              className={`relative w-10 h-10 rounded-xl inline-flex items-center justify-center transition-all duration-200 ease-out will-change-transform ${active ? 'bg-primary text-primary-foreground shadow-[0_4px_12px_-4px_rgba(74,149,232,0.5)] scale-[1.08]' : 'text-muted-foreground hover:bg-secondary hover:text-foreground hover:scale-[1.04] active:scale-[0.98] scale-100'}`}
              style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
            >
              <Icon className={`w-[18px] h-[18px] transition-transform duration-200 ${active ? 'scale-110' : ''}`} />
              {active && (
                <span
                  key={it.id + '-hint'}
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-foreground/60 font-mono tracking-wide"
                  style={{ animation: 'tool-hint-in 220ms ease-out both' }}
                >{it.key}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ZoomDock({
  zoom, setZoom, onFit, onCenter, onActual,
}: {
  zoom: number;
  setZoom: (z: number) => void;
  onFit: () => void;
  onCenter: () => void;
  onActual: () => void;
}) {
  return (
    <div className="absolute bottom-5 left-5 z-20 inline-flex items-center bg-card/85 backdrop-blur-xl border border-border/80 rounded-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] overflow-hidden text-xs">
      <button onClick={() => setZoom(Math.max(0.25, zoom / 1.2))} data-track="zoom-out" title="Zoom out (⌘-)"
        className="w-9 h-9 inline-flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
      <button onClick={onFit} data-track="zoom-fit" title="Fit plan to viewport"
        className="px-2.5 h-9 border-x border-border/60 hover:bg-secondary min-w-[58px] text-center tabular-nums font-medium">
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={() => setZoom(Math.min(4, zoom * 1.2))} data-track="zoom-in" title="Zoom in (⌘+)"
        className="w-9 h-9 inline-flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
      <button onClick={onFit} data-track="zoom-fit-icon" title="Fit plan"
        className="w-9 h-9 inline-flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground border-l border-border/60 transition-colors">
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={onCenter} data-track="zoom-center" title="Center plan"
        className="w-9 h-9 inline-flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground border-l border-border/60 transition-colors">
        <Crosshair className="w-3.5 h-3.5" />
      </button>
      <button onClick={onActual} data-track="zoom-actual" title="Actual scale (1:1)"
        className="px-2 h-9 inline-flex items-center justify-center hover:bg-secondary text-[10px] uppercase tracking-[0.10em] text-muted-foreground hover:text-foreground border-l border-border/60 transition-colors">
        1:1
      </button>
    </div>
  );
}

function MiniMap({ devices, walls, background }: {
  devices: Device[];
  walls?: Wall[];
  background?: { x: number; y: number; naturalWidth: number; naturalHeight: number; scale: number } | null;
}) {
  // UX hard-reset: minimap defaults to OFF on the calm canvas. A single
  // eye icon in the bottom-right toggles it back when the engineer wants
  // a viewport overview. (Was visible-by-default, was "OVERVIEW" labelled.)
  const [visible, setVisible] = useState<boolean>(() => {
    try { return localStorage.getItem('canvas:minimap:visible') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('canvas:minimap:visible', visible ? '1' : '0'); } catch {}
  }, [visible]);
  // V1 1A.4 — bounds compute matches the P0.7 canvas auto-fit: union
  // floor background, walls, and devices so the minimap shows the
  // actual plan, not the seed 800x600 default. Theme-safe colors so
  // it reads in light / slate / dark.
  const bounds = useMemo(() => {
    let minX = 80, minY = 80, maxX = 720, maxY = 560;
    if (background) {
      minX = background.x;
      minY = background.y;
      maxX = background.x + background.naturalWidth * background.scale;
      maxY = background.y + background.naturalHeight * background.scale;
    }
    for (const d of devices) {
      if (typeof d.x !== 'number' || typeof d.y !== 'number') continue;
      if (d.x < minX) minX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.x > maxX) maxX = d.x;
      if (d.y > maxY) maxY = d.y;
    }
    for (const w of walls ?? []) {
      const wxL = Math.min(w.x1, w.x2), wxR = Math.max(w.x1, w.x2);
      const wyT = Math.min(w.y1, w.y2), wyB = Math.max(w.y1, w.y2);
      if (wxL < minX) minX = wxL;
      if (wyT < minY) minY = wyT;
      if (wxR > maxX) maxX = wxR;
      if (wyB > maxY) maxY = wyB;
    }
    const pad = 24;
    return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 };
  }, [devices, walls, background]);
  if (!visible) return (
    <button onClick={() => setVisible(true)} title="Show minimap" data-track="canvas-minimap-show" className="absolute bottom-5 right-5 z-20 w-9 h-9 rounded-xl bg-card/85 backdrop-blur-xl border border-border/80 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] flex items-center justify-center text-muted-foreground hover:text-foreground">
      <MapIcon className="w-4 h-4" />
    </button>
  );
  return (
    <div className="absolute bottom-5 right-5 z-20 w-[200px] bg-card/90 backdrop-blur-xl border border-border/80 rounded-xl shadow-[var(--shadow-floating)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><CircleDot className="w-3 h-3" />Overview</span>
        <button onClick={() => setVisible(false)} title="Hide minimap" className="hover:text-foreground"><EyeOff className="w-3 h-3" /></button>
      </div>
      <div className="p-2">
        <svg
          viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full rounded-md"
          style={{ height: '150px', background: 'var(--secondary)' }}
        >
          {background && (
            <rect
              x={background.x} y={background.y}
              width={background.naturalWidth * background.scale}
              height={background.naturalHeight * background.scale}
              fill="var(--card)" stroke="var(--border-strong)" strokeWidth={Math.max(2, bounds.w / 240)}
            />
          )}
          {(walls ?? []).map((w) => (
            <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="var(--foreground)" strokeWidth={Math.max(2, bounds.w / 320)} strokeLinecap="round" />
          ))}
          {devices.map((d) => (
            <circle
              key={d.id}
              cx={d.x} cy={d.y}
              r={Math.max(5, bounds.w / 90)}
              fill={KIND_TONE[TYPE_KIND[d.type]]}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

function StatusBar({ tool, zoom, counts, units }: { tool: Tool; zoom: number; counts: Record<DeviceKind, number>; units: 'ft' | 'm' }) {
  const toolLabel = tool === 'select' ? 'Select' : tool === 'pan' ? 'Pan' : tool === 'measure' ? 'Measure' : tool === 'wall' ? 'Wall' : tool === 'cable' ? 'Cable' : 'Tool';
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-4 z-20 inline-flex items-center gap-2 px-3 h-7 rounded-full bg-card/80 backdrop-blur-md border border-border/70 text-[11px] text-muted-foreground shadow-[0_6px_18px_-10px_rgba(0,0,0,0.5)]">
      <span className="inline-flex items-center gap-1.5 text-primary"><span className="w-1.5 h-1.5 rounded-full bg-primary" />{toolLabel}</span>
      <span className="w-px h-3 bg-border/70" />
      <span>1 in = 10 {units}</span>
      <span className="w-px h-3 bg-border/70" />
      <span className="tabular-nums">{counts.camera} <span style={{ color: '#2F81F7' }}>●</span> &nbsp;{counts.access} <span style={{ color: '#3FB950' }}>●</span> &nbsp;{counts.network} <span style={{ color: '#D29922' }}>●</span></span>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════
   REPORT EXPORT — premium PDFs generated live from canvas state
   ═══════════════════════════════════════════════════════════════════════
   Each report type is a discrete generator that pulls the right slice of
   project data and writes it to a jsPDF document with consistent branding,
   typography, and section structure. The user clicks once; the file
   downloads. */

type ReportKind =
  | 'engineering' | 'customer' | 'camera-schedule' | 'door-schedule'
  | 'cable-schedule' | 'conduit-schedule' | 'bom' | 'compliance' | 'commissioning';

function ReportExportRow({
  icon: Icon, label, sub, tone, kind, devices, projectId,
}: { icon: any; label: string; sub: string; tone: string; kind: ReportKind; devices: Device[]; projectId: string }) {
  const [busy, setBusy] = useState(false);
  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      drawReport(doc, kind, devices, projectId);
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
        <div className="text-[12.5px] truncate">{label}</div>
        <div className="text-[10.5px] text-muted-foreground truncate">{sub}</div>
      </div>
      <span className="text-[10.5px] font-medium text-primary">{busy ? 'Exporting…' : 'PDF'}</span>
    </button>
  );
}

/** Top-level report router. Each branch composes its own pages using
 *  shared helpers (drawCover, drawTable, drawHeader). */
function drawReport(doc: any, kind: ReportKind, devices: Device[], projectId: string) {
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
    case 'compliance':        return drawComplianceReport(doc, devices);
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

function drawComplianceReport(doc: any, devices: Device[]) {
  drawHeader(doc, 'Compliance checklist', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Compliance checklist', 56, 76);
  const cams = devices.filter((d) => TYPE_KIND[d.type] === 'camera');
  const ndaaPct = cams.length ? Math.round((cams.filter((c) => c.ndaa).length / cams.length) * 100) : 100;
  const issues = computeIntelIssues(devices).filter((i) => i.severity === 'high' || i.kind === 'compliance' || i.kind === 'ada');
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
            className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5 text-muted-foreground hover:text-foreground text-[10.5px]"
          >
            <RotateCcw className="w-3 h-3" /> 90°
          </button>
          <button
            onClick={() => onPatch({ rotation: ((bg.rotation + 90) % 360 + 360) % 360 - ((bg.rotation + 90) % 360 > 180 ? 360 : 0) })}
            title="Rotate 90° right"
            data-testid="floorplan-rotate-right"
            className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5 text-muted-foreground hover:text-foreground text-[10.5px]"
          >
            <RotateCw className="w-3 h-3" /> 90°
          </button>
          <button
            onClick={() => onPatch({ x: 0, y: 0, scale: 1 })}
            title="Re-centre and fit at 100% scale"
            data-testid="floorplan-fit"
            className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5 text-muted-foreground hover:text-foreground text-[10.5px]"
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
            className="flex-1 text-[10.5px] py-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5 text-muted-foreground"
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

  const FILTERS: { id: FilterKey; label: string }[] = [
    { id: 'all',      label: 'All' },
    { id: 'cameras',  label: 'Cameras' },
    { id: 'access',   label: 'Access' },
    { id: 'network',  label: 'Network' },
    { id: 'cabling',  label: 'Cabling' },
    { id: 'existing', label: 'Existing' },
  ];

  const filtered = useMemo(() => {
    if (filter === 'all')      return rows;
    if (filter === 'existing') return rows.filter((r) => r.isExisting);
    return rows.filter((r) => r.category === filter);
  }, [rows, filter]);

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
            <div className="mt-3 pt-3 border-t border-border/40 flex items-start gap-2 text-[10.5px] text-amber-400">
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
      <div className="px-5 pt-3 pb-3 border-b border-white/[0.05] shrink-0">
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
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-6 space-y-4">
        {filtered.length === 0 && (
          <div className="text-center text-[11.5px] text-muted-foreground py-8 px-4">
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

function BomRow({ row, fmt, onSelect }: { row: CanvasBomRow; fmt: (n: number) => string; onSelect: () => void }) {
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
          </div>
          <div className="text-[12px] font-medium text-foreground truncate">{row.description}</div>
          {row.product && (
            <div className="text-[10.5px] text-muted-foreground truncate">{row.product}</div>
          )}
          {row.laborHours > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{row.laborHours.toFixed(2)} hr labor</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-[12px] tabular-nums ${row.isExisting ? 'text-muted-foreground line-through decoration-1' : 'text-foreground'}`}>
            {row.qty.toLocaleString(undefined, { maximumFractionDigits: row.uom === 'ft' ? 0 : 0 })} {row.uom}
          </div>
          <div className={`text-[10.5px] tabular-nums ${row.isExisting ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
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
