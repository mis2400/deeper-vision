// Central data model. Every screen reads from + writes to this shape.
// Keep this file decoupled from React — pure types only.

// ─────────────────────────── Lifecycle ────────────────────────────
export type LifecyclePhase =
  | 'lead'
  | 'discovery'
  | 'scheduled-walk'
  | 'survey'
  | 'engineering'
  | 'bom-review'
  | 'proposal'
  | 'customer-revision'
  | 'approved'
  | 'deployment'
  | 'commissioning'
  | 'completed'
  | 'managed-service';

// ─────────────────────────── CRM / Sales ──────────────────────────
export interface Contact {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface Address {
  street: string;
  city: string;
  state?: string;
  postal?: string;
}

export interface Customer {
  id: string;
  companyName: string;
  contacts: Contact[];
  addresses: Address[];
  notes?: string;
}

// ─────────────────────────── Project tree ─────────────────────────
export interface Project {
  id: string;
  name: string;
  customerId?: string;
  siteId?: string;
  status: 'design' | 'review' | 'install' | 'live' | 'archived';
  lifecyclePhase: LifecyclePhase;
  team?: number;
  progress?: number; // 0..100 — surface-level; real progress derives from phase
  updated?: string;  // human label, e.g. "2h ago"
  createdAt: number; // ms epoch
  updatedAt: number;
}

export interface Site {
  id: string;
  projectId: string;
  name: string;
  address: string;
}

export interface Building {
  id: string;
  siteId: string;
  name: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  name: string;
  level: number;     // 0 = ground, 1 = level 2, -1 = basement
  source: 'blueprint' | 'satellite' | 'sketch' | 'blank';
  /** Scale: 1 canvas pixel = scalePxToFt feet. Set by /calibrate. */
  scalePxToFt: number;
  /** User-drawn walls (in canvas px). */
  walls: Wall[];
  /** Floorplan polygon (corners) — survives reload via the floorplanGeometry
   *  store, but mirrored here so the canvas can render even before that store
   *  is initialized. Optional. */
  corners?: { x: number; y: number }[];
  rooms?: { id: string; name: string; corners: { x: number; y: number }[] }[];
}

export interface Wall {
  id: string;
  x1: number; y1: number; x2: number; y2: number;
}

// ─────────────────────────── Hardware (canvas devices) ────────────
// Keep DeviceType in sync with EngineeringCanvas — these strings drive the
// glyph + cone + toolbar branches.
export type DeviceType =
  | 'cam.bullet' | 'cam.dome' | 'cam.ptz' | 'cam.multisensor' | 'cam.fisheye' | 'cam.thermal' | 'cam.lpr' | 'cam.body'
  | 'acc.reader' | 'acc.strike' | 'acc.maglock' | 'acc.rex' | 'acc.exit' | 'acc.door' | 'acc.gate' | 'acc.biometric'
  | 'net.idf'   | 'net.mdf'    | 'net.switch'  | 'net.ap'    | 'net.firewall' | 'net.bridge' | 'net.fiber' | 'net.copper' | 'net.wireless'
  | 'pwr.ups'   | 'pwr.poe'    | 'pwr.surge'   | 'pwr.solar'
  | 'sen.motion' | 'sen.glass' | 'sen.contact' | 'sen.panic' | 'sen.smoke'
  | 'aud.speaker' | 'aud.intercom' | 'aud.horn' | 'aud.amp'
  | 'sto.nvr' | 'sto.cloud' | 'sto.server'
  | 'dis.monitor' | 'dis.video-wall' | 'dis.kiosk';

export type DeviceKind = 'camera' | 'access' | 'network' | 'power' | 'sensor' | 'audio' | 'storage' | 'display' | 'intrusion';

export type LensId = 'a' | 'b' | 'c' | 'd';
export type ActiveLens = LensId | 'all';
export type LensMode = 'linked' | 'independent';

export interface LensCfg {
  rotation: number; // °, relative to device body
  fov: number;      // horizontal °
  range: number;    // ft, DORI Detect bound
  focal: number;    // mm
  enabled: boolean;
}

export interface Device {
  id: string;
  projectId: string;
  floorId: string;
  type: DeviceType;
  /** Cosmetic label (room / location) — e.g. "Lobby NE". */
  label: string;
  /** Product catalog id — see lib/catalog if used. */
  product: string;
  x: number; y: number;
  rot: number;     // ° body rotation
  // Lens engineering (single-cam):
  focal?: number;
  fov?: number;
  range?: number;
  mountFt?: number;
  ir?: boolean;
  ndaa?: boolean;
  // Multisensor only:
  lenses?: { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg };
  lensMode?: LensMode;
  // Free-form:
  notes?: string;
  /** Other entity ids this device is linked to (pathway endpoint, parent IDF, etc.). */
  linkedIds?: string[];
  /** Commissioning state per phase — present once commissioning starts. */
  commissioning?: {
    install?: 'pending' | 'pass' | 'fail';
    firmware?: 'pending' | 'pass' | 'fail';
    network?: 'pending' | 'pass' | 'fail';
    signal?: 'pending' | 'pass' | 'fail';
    signedOff?: boolean;
    notes?: string;
  };
}

// ─────────────────────────── Doors & hardware ─────────────────────
export type DoorType = 'single' | 'double' | 'storefront' | 'roll-up' | 'gate' | 'elevator' | 'vestibule';
export type DoorMaterial = 'hollow-metal' | 'wood' | 'aluminum' | 'glass';
export type DoorHardware = 'reader' | 'strike' | 'maglock' | 'rex' | 'contact' | 'intercom' | 'panic' | 'autoop' | 'controller' | 'psu';

export interface Door {
  id: string;
  projectId: string;
  floorId: string;
  x: number; y: number;
  rot: number;
  width: number;            // inches
  doorType: DoorType;
  material: DoorMaterial;
  fireRated?: boolean;
  ada?: boolean;
  hardware: DoorHardware[];
  electrification?: 'fail-safe' | 'fail-secure';
  readerLocation?: 'mullion' | 'wall';
  notes?: string;
  media?: string[];         // urls to attached photos
}

// ─────────────────────────── Pathways ─────────────────────────────
export type PathwayType = 'conduit' | 'tray' | 'open' | 'fiber' | 'wireless' | 'underground' | 'flex';
export type CableType = 'cat6' | 'cat6a' | 'fiber-sm' | 'fiber-mm' | 'coax' | 'power' | 'composite';

export interface Pathway {
  id: string;
  projectId: string;
  floorId: string;
  type: PathwayType;
  /** Ordered waypoints (canvas px). */
  points: { x: number; y: number }[];
  sourceId?: string;       // device or IDF id
  destinationId?: string;
  cableType: CableType;
  cableCount: number;
  conduitFill?: number;    // 0..1 (NEC fill ratio)
  lengthFt?: number;       // optional — can be derived from points + scale
  notes?: string;
}

// ─────────────────────────── IDF / network rack ───────────────────
export interface IDF {
  id: string;
  projectId: string;
  floorId: string;
  x: number; y: number;
  name: string;            // e.g. "IDF-1"
  switches?: { model: string; portsPoe: number; portsTotal: number; poeBudgetW: number }[];
  power?: { upsModel?: string; upsRuntimeMin?: number; loadW?: number };
  notes?: string;
}

// ─────────────────────────── Estimate ─────────────────────────────
export interface EstimateLine {
  id: string;
  sourceKind: 'device' | 'door' | 'pathway' | 'idf' | 'labor' | 'manual';
  sourceId?: string;        // entity that generated this line
  sku?: string;
  description: string;
  qty: number;
  uom?: string;             // 'ea' | 'ft' | 'hr'
  unitPrice: number;
  laborHours?: number;
}

export interface Estimate {
  id: string;
  projectId: string;
  lines: EstimateLine[];
  laborRate: number;         // $/hr
  markup: number;            // 0..1, e.g. 0.18 = 18%
  notes?: string;
}
