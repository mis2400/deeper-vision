// Unified product catalog — single source of truth for the surveyor
// (InsertDock) and the Product Catalog screen.
//
// Pricing is "sample MSRP" unless verified against a current distributor
// price list. The UI labels both screens that way to keep us honest.
// Field labels follow real industry conventions so a security engineer
// can read the catalog and recognize what's there.
//
// Every entry should be auditable to a real product. If a field can't be
// verified, leave it undefined rather than guess.

import type { DeviceType, ProjectTechModel } from '../store/types';

// ─────────────────────────── Top-level categories ────────────────────

export type ProductCategory =
  // Physical security
  | 'camera' | 'reader' | 'controller' | 'lock' | 'rex' | 'dps' | 'panic-bar'
  | 'intercom' | 'intrusion' | 'perimeter'
  // Cyber
  | 'endpoint' | 'siem' | 'ngfw' | 'vpn'
  // IT / network
  | 'switch' | 'router' | 'access-point' | 'bridge' | 'firewall' | 'patch-panel'
  // Storage / recording
  | 'nvr' | 'server' | 'archive' | 'cloud-bridge'
  // AV / PA / displays
  | 'speaker' | 'amplifier' | 'microphone' | 'paging' | 'display'
  // Fire / life safety
  | 'fire-panel' | 'pull-station' | 'strobe' | 'horn' | 'smoke-detector' | 'sprinkler'
  // Building systems
  | 'hvac' | 'lighting' | 'bms'
  // Power
  | 'ups' | 'poe-injector' | 'surge' | 'solar' | 'psu' | 'battery-backup'
  // Infrastructure
  | 'door' | 'gate' | 'elevator' | 'window' | 'wall' | 'rack' | 'idf' | 'mdf'
  | 'conduit' | 'cable'
  // Environmental
  | 'sensor' | 'temperature' | 'water-leak' | 'occupancy' | 'gas' | 'gunshot'
  // Mount / accessory
  | 'accessory'
  // Legacy compatibility for older callers
  | 'av' | 'network' | 'power' | 'recorder';

export type ProductSubcategory =
  | 'bullet' | 'dome' | 'turret' | 'ptz' | 'multisensor' | 'fisheye' | 'thermal' | 'lpr' | 'body'
  | 'mobile-cred' | 'card-reader' | 'biometric' | 'keypad'
  | 'strike' | 'maglock' | 'wireless-lock' | 'rex' | 'exit-device' | 'contact'
  | 'core-switch' | 'access-switch' | 'poe-switch' | 'firewall' | 'access-point' | 'bridge' | 'router'
  | 'ups' | 'psu' | 'surge' | 'solar'
  | 'wall-mount' | 'pole-mount' | 'pendant-mount' | 'corner-mount' | 'parapet-mount' | 'gang-box'
  | 'mullion-mount' | 'weather-hood' | 'spacer-plate' | 'transfer-hinge'
  | 'video-intercom' | 'audio-intercom' | 'sip-intercom' | 'cellular-intercom'
  | 'ceiling' | 'horn-speaker' | 'pendant-speaker' | 'wall-speaker'
  | 'wifi6' | 'wifi6e' | 'outdoor-ap'
  | 'rack-floor' | 'rack-wall' | 'open-frame'
  | 'cat6' | 'cat6a' | 'fiber-sm' | 'fiber-mm' | 'fiber-osp' | 'composite'
  | '18-2' | '18-4' | '22-6' | 'coax' | 'speaker-wire' | 'fire-alarm'
  | 'controller' | 'nvr' | 'server' | 'vms'
  | 'panel' | 'siren' | 'glass-break' | 'motion' | 'smoke' | 'thermal-sensor'
  | 'audio-amp' | 'paging' | 'horn' | 'mic';

export interface ProductMountType {
  surface: 'wall' | 'ceiling' | 'pendant' | 'corner' | 'pole' | 'parapet' | 'in-rack'
    | 'door-mullion' | 'door-frame' | 'in-conduit' | 'gang-box';
}

// ─────────────────────────── Product schema ──────────────────────────

export interface Product {
  id: string;
  manufacturer: string;
  productLine?: string;
  model: string;
  /** Marketing / colloquial name. */
  productName?: string;
  category: ProductCategory;
  subcategory?: ProductSubcategory;
  /** Canvas device type — drives the icon + cone + toolbar branch in the
   *  surveyor. Set for items that can be placed on the canvas. Accessories
   *  / cable / consumables omit this. */
  deviceType?: DeviceType;
  /** Cloud / on-prem / hybrid fit. Drives stack pill filtering. */
  techModels: ProjectTechModel[];
  /** Deployment context tag — sometimes more specific than category. */
  deploymentType?: 'indoor' | 'outdoor' | 'rated' | 'covert' | 'mobile';
  /** Manufacturer suggested retail price (USD). Marked "sample" in UI
   *  unless verified against a current distributor list. */
  msrp?: number;
  /** Sample dealer cost — used by the BOM rollup as a default cost basis. */
  dealerCost?: number;
  costEst?: number;     // legacy compat
  /** Estimator labor units — hours to install / commission. */
  laborUnits?: number;
  /** Section 889 / NDAA compliance flag. */
  ndaa?: boolean;
  /** ONVIF profile — used for cross-vendor VMS / VMS-side analytics. */
  onvifProfile?: 'S' | 'T' | 'G' | 'M' | 'A' | 'C' | 'Q';
  /** Native resolution. */
  resolution?: '720p' | '1080p' | '4MP' | '5MP' | '6MP' | '8MP' | '4K' | '8K' | '12MP' | 'multi-sensor';
  /** Lens / focal range summary (cameras). */
  lensType?: 'fixed' | 'varifocal' | 'motorized' | 'zoom';
  lensMm?: string;      // legacy compat
  focalRange?: string;
  /** Camera form factor. */
  cameraType?: 'bullet' | 'dome' | 'turret' | 'ptz' | 'multisensor' | 'fisheye' | 'thermal' | 'lpr' | 'body';
  indoorOutdoor?: 'indoor' | 'outdoor' | 'both';
  /** Vandal rating per IEC 62262. */
  vandalRating?: 'IK08' | 'IK09' | 'IK10';
  /** Ingress protection per IEC 60529. */
  ipRating?: 'IP54' | 'IP55' | 'IP66' | 'IP67' | 'IP68';
  /** PoE class (1=802.3af, 2=802.3at, 3/4=802.3bt). */
  poeClass?: 1 | 2 | 3 | 4;
  /** Typical max power draw in watts. */
  powerDrawWatts?: number;
  powerW?: number;      // legacy compat
  /** Bandwidth estimate per stream in Mbps (H.265, 30-day retention default). */
  bandwidthMbps?: number;
  /** Storage per day in GB. */
  storageGbPerDay?: number;
  /** Allowed mount surfaces. */
  mounts?: ProductMountType['surface'][];
  /** Compatible accessory product-ids — drives the Compatible accessories
   *  list in the inspector drawer. */
  compatibleAccessories?: string[];
  accessoryIds?: string[];  // legacy compat
  /** Compatible VMS platforms — drives the VMS compatibility chip. */
  compatibleVMS?: string[];
  /** Compatible access-control head-ends. */
  compatibleControllers?: string[];
  warrantyYears?: number;
  /** Datasheet URL placeholder — points to the real PDF when one exists. */
  datasheetUrl?: string;
  /** Free-form notes for the estimator / engineer. */
  notes?: string;
  /** Top-pick within its category for its tech model — drives the
   *  "Recommended" badge in the dock. */
  recommended?: boolean;
}

// ─────────────────────────── Helpers ─────────────────────────────────

/** Does a product match an active tech model? Hybrid sees everything. */
export function productsFor(model: ProjectTechModel) {
  return SAMPLE_PRODUCTS.filter((p) => p.techModels.includes(model));
}

export function productById(id: string): Product | undefined {
  return SAMPLE_PRODUCTS.find((p) => p.id === id);
}

export function productsByDeviceType(t: DeviceType): Product[] {
  return SAMPLE_PRODUCTS.filter((p) => p.deviceType === t);
}

export function accessoriesFor(p: Product): Product[] {
  const ids = p.compatibleAccessories ?? p.accessoryIds;
  if (!ids?.length) return [];
  return SAMPLE_PRODUCTS.filter((x) => ids.includes(x.id));
}

/** True when the product is a top pick for its tech model + category. */
export function isRecommended(p: Product): boolean { return !!p.recommended; }

// ─────────────────────────── The catalog ─────────────────────────────
// Sample only. Pricing is approximate retail; verify against distributor
// list before quoting. Coverage is intentionally broad across the major
// ecosystems so the InsertDock can show useful breadth at every stack
// setting. Expand as we sell more lines.

export const SAMPLE_PRODUCTS: Product[] = [
  // ════════════════════════════════════════════════════════════════════
  // CAMERAS — 15 manufacturers, multiple form factors each
  // ════════════════════════════════════════════════════════════════════

  // ── Axis ────────────────────────────────────────────────────────────
  { id: 'p-axis-p1468', manufacturer: 'Axis', productLine: 'P14',
    model: 'P1468-LE', productName: 'P1468-LE Bullet 4MP',
    category: 'camera', subcategory: 'bullet', cameraType: 'bullet',
    deviceType: 'cam.bullet', techModels: ['on_prem', 'hybrid'],
    deploymentType: 'outdoor', msrp: 1095, dealerCost: 712, laborUnits: 2.0,
    ndaa: true, onvifProfile: 'S', resolution: '4MP',
    lensType: 'varifocal', focalRange: '2.8–8 mm', indoorOutdoor: 'outdoor',
    vandalRating: 'IK10', ipRating: 'IP66', poeClass: 3, powerDrawWatts: 12,
    bandwidthMbps: 5, storageGbPerDay: 54,
    mounts: ['wall', 'pole', 'corner', 'parapet'],
    compatibleAccessories: ['acc-axis-t91', 'acc-axis-t94', 'acc-axis-tg6', 'acc-axis-tp01', 'acc-jb-4x4'],
    compatibleVMS: ['Genetec', 'Milestone', 'Axis Camera Station', 'Eagle Eye'],
    warrantyYears: 5, recommended: true,
    notes: 'Top-pick fixed bullet for general outdoor coverage.' },
  { id: 'p-axis-p1465', manufacturer: 'Axis', model: 'P1465-LE',
    category: 'camera', subcategory: 'bullet', cameraType: 'bullet',
    deviceType: 'cam.bullet', techModels: ['on_prem', 'hybrid'],
    msrp: 749, dealerCost: 487, laborUnits: 2.0, ndaa: true, onvifProfile: 'S',
    resolution: '1080p', lensType: 'varifocal', focalRange: '2.8–8 mm',
    indoorOutdoor: 'outdoor', vandalRating: 'IK10', ipRating: 'IP66',
    poeClass: 3, powerDrawWatts: 10, bandwidthMbps: 3, storageGbPerDay: 33,
    mounts: ['wall', 'pole'], warrantyYears: 5 },
  { id: 'p-axis-p3265', manufacturer: 'Axis', model: 'P3265-LV',
    category: 'camera', subcategory: 'dome', cameraType: 'dome',
    deviceType: 'cam.dome', techModels: ['on_prem', 'hybrid'],
    msrp: 925, dealerCost: 601, laborUnits: 1.75, ndaa: true, onvifProfile: 'S',
    resolution: '4MP', lensType: 'varifocal', focalRange: '3.4–8.9 mm',
    indoorOutdoor: 'indoor', vandalRating: 'IK10',
    poeClass: 3, powerDrawWatts: 9, bandwidthMbps: 4,
    mounts: ['ceiling', 'wall'], compatibleAccessories: ['acc-axis-tp1', 'acc-pendant-drop'],
    warrantyYears: 5, recommended: true },
  { id: 'p-axis-p3267-lve', manufacturer: 'Axis', model: 'P3267-LVE',
    category: 'camera', subcategory: 'dome', cameraType: 'dome',
    deviceType: 'cam.dome', techModels: ['on_prem', 'hybrid'],
    msrp: 1199, dealerCost: 779, laborUnits: 2.0, ndaa: true, onvifProfile: 'S',
    resolution: '5MP', indoorOutdoor: 'outdoor', vandalRating: 'IK10', ipRating: 'IP66',
    poeClass: 3, powerDrawWatts: 11, mounts: ['ceiling', 'wall', 'pendant'], warrantyYears: 5 },
  { id: 'p-axis-q6315', manufacturer: 'Axis', model: 'Q6315-LE',
    category: 'camera', subcategory: 'ptz', cameraType: 'ptz',
    deviceType: 'cam.ptz', techModels: ['on_prem', 'hybrid'],
    msrp: 3895, dealerCost: 2532, laborUnits: 3.5, ndaa: true, onvifProfile: 'S',
    resolution: '1080p', lensType: 'zoom', focalRange: '6.91–214 mm (31×)',
    indoorOutdoor: 'outdoor', ipRating: 'IP66',
    poeClass: 4, powerDrawWatts: 28, mounts: ['wall', 'pole', 'parapet', 'pendant'],
    warrantyYears: 5, recommended: true },
  { id: 'p-axis-p3827', manufacturer: 'Axis', model: 'P3827-PVE',
    category: 'camera', subcategory: 'multisensor', cameraType: 'multisensor',
    deviceType: 'cam.multisensor', techModels: ['on_prem', 'hybrid'],
    msrp: 4895, dealerCost: 3182, laborUnits: 3.0, ndaa: true, onvifProfile: 'S',
    resolution: 'multi-sensor', indoorOutdoor: 'outdoor', vandalRating: 'IK10',
    poeClass: 4, powerDrawWatts: 26, mounts: ['ceiling', 'wall', 'parapet'],
    warrantyYears: 5 },
  { id: 'p-axis-m4327', manufacturer: 'Axis', model: 'M4327-P',
    category: 'camera', subcategory: 'fisheye', cameraType: 'fisheye',
    deviceType: 'cam.fisheye', techModels: ['on_prem', 'hybrid'],
    msrp: 749, dealerCost: 487, laborUnits: 1.5, ndaa: true, onvifProfile: 'S',
    resolution: '6MP', indoorOutdoor: 'indoor',
    poeClass: 3, powerDrawWatts: 8, mounts: ['ceiling'], warrantyYears: 5 },
  { id: 'p-axis-p1468-lpr', manufacturer: 'Axis', model: 'P1468-LE-LPR',
    category: 'camera', subcategory: 'lpr', cameraType: 'lpr',
    deviceType: 'cam.lpr', techModels: ['on_prem', 'hybrid'],
    msrp: 1995, dealerCost: 1297, laborUnits: 3.0, ndaa: true, onvifProfile: 'S',
    resolution: '4MP', indoorOutdoor: 'outdoor', ipRating: 'IP66',
    poeClass: 3, powerDrawWatts: 12, mounts: ['pole', 'wall'], recommended: true,
    warrantyYears: 5 },

  // ── Hanwha ──────────────────────────────────────────────────────────
  { id: 'p-hanwha-xno-9083', manufacturer: 'Hanwha', productLine: 'WiseNet X',
    model: 'XNO-9083R', category: 'camera', subcategory: 'bullet', cameraType: 'bullet',
    deviceType: 'cam.bullet', techModels: ['on_prem', 'hybrid'],
    msrp: 1499, dealerCost: 974, laborUnits: 2.0, ndaa: true, onvifProfile: 'T',
    resolution: '4K', indoorOutdoor: 'outdoor', vandalRating: 'IK10', ipRating: 'IP66',
    poeClass: 4, powerDrawWatts: 14, mounts: ['wall', 'pole'],
    compatibleAccessories: ['acc-hanwha-mwd', 'acc-hanwha-mpl'],
    warrantyYears: 5 },
  { id: 'p-hanwha-xnd-9082', manufacturer: 'Hanwha', model: 'XND-9082RF',
    category: 'camera', subcategory: 'dome', cameraType: 'dome', deviceType: 'cam.dome',
    techModels: ['on_prem', 'hybrid'], msrp: 1399, dealerCost: 909, laborUnits: 1.75,
    ndaa: true, onvifProfile: 'T', resolution: '4K', indoorOutdoor: 'indoor',
    vandalRating: 'IK10', poeClass: 4, powerDrawWatts: 12, mounts: ['ceiling', 'wall'] },
  { id: 'p-hanwha-xnp-9250', manufacturer: 'Hanwha', model: 'XNP-9250R',
    category: 'camera', subcategory: 'ptz', cameraType: 'ptz', deviceType: 'cam.ptz',
    techModels: ['on_prem', 'hybrid'], msrp: 3495, dealerCost: 2272, laborUnits: 3.5,
    ndaa: true, onvifProfile: 'T', resolution: '4K', indoorOutdoor: 'outdoor', ipRating: 'IP66',
    poeClass: 4, powerDrawWatts: 30, mounts: ['wall', 'pole'] },
  { id: 'p-hanwha-pnm-9320', manufacturer: 'Hanwha', model: 'PNM-9320VQP',
    category: 'camera', subcategory: 'multisensor', cameraType: 'multisensor',
    deviceType: 'cam.multisensor', techModels: ['on_prem', 'hybrid'],
    msrp: 4795, dealerCost: 3117, laborUnits: 3.0, ndaa: true, onvifProfile: 'T',
    resolution: 'multi-sensor', indoorOutdoor: 'outdoor', poeClass: 4, powerDrawWatts: 26 },
  { id: 'p-hanwha-pnf-9010', manufacturer: 'Hanwha', model: 'PNF-9010RV',
    category: 'camera', subcategory: 'fisheye', cameraType: 'fisheye',
    deviceType: 'cam.fisheye', techModels: ['on_prem', 'hybrid'],
    msrp: 1095, dealerCost: 712, laborUnits: 1.5, ndaa: true, onvifProfile: 'T',
    resolution: '12MP', indoorOutdoor: 'indoor', poeClass: 3, powerDrawWatts: 9 },

  // ── Avigilon ────────────────────────────────────────────────────────
  { id: 'p-avi-h5a-bullet', manufacturer: 'Avigilon', productLine: 'H5A',
    model: 'H5A Bullet 6MP', category: 'camera', subcategory: 'bullet', cameraType: 'bullet',
    deviceType: 'cam.bullet', techModels: ['on_prem', 'hybrid'],
    msrp: 1850, dealerCost: 1202, laborUnits: 2.0, ndaa: true, onvifProfile: 'T',
    resolution: '6MP', indoorOutdoor: 'outdoor', vandalRating: 'IK10', ipRating: 'IP66',
    poeClass: 4, powerDrawWatts: 15, mounts: ['wall', 'pole'],
    compatibleVMS: ['Avigilon Control Center', 'Genetec'], warrantyYears: 3 },
  { id: 'p-avi-h5a-dome', manufacturer: 'Avigilon', model: 'H5A Dome 5MP',
    category: 'camera', subcategory: 'dome', cameraType: 'dome', deviceType: 'cam.dome',
    techModels: ['on_prem', 'hybrid'], msrp: 1450, dealerCost: 942, laborUnits: 1.75,
    ndaa: true, onvifProfile: 'T', resolution: '5MP', indoorOutdoor: 'indoor',
    vandalRating: 'IK10', poeClass: 3, powerDrawWatts: 12 },
  { id: 'p-avi-h5a-ptz', manufacturer: 'Avigilon', model: 'H5A PTZ',
    category: 'camera', subcategory: 'ptz', cameraType: 'ptz', deviceType: 'cam.ptz',
    techModels: ['on_prem', 'hybrid'], msrp: 4995, dealerCost: 3247, laborUnits: 3.5,
    ndaa: true, onvifProfile: 'T', resolution: '4K', indoorOutdoor: 'outdoor', ipRating: 'IP66',
    poeClass: 4, powerDrawWatts: 32 },
  { id: 'p-avi-h5a-multi', manufacturer: 'Avigilon', model: 'H5A Multi 4×8MP',
    category: 'camera', subcategory: 'multisensor', cameraType: 'multisensor',
    deviceType: 'cam.multisensor', techModels: ['on_prem', 'hybrid'],
    msrp: 5995, dealerCost: 3897, laborUnits: 3.0, ndaa: true, onvifProfile: 'T',
    resolution: 'multi-sensor', indoorOutdoor: 'outdoor', poeClass: 4, powerDrawWatts: 28 },

  // ── Verkada ─────────────────────────────────────────────────────────
  { id: 'p-verkada-cb52', manufacturer: 'Verkada', productLine: 'CB Series',
    model: 'CB52-TE', category: 'camera', subcategory: 'bullet', cameraType: 'bullet',
    deviceType: 'cam.bullet', techModels: ['cloud', 'hybrid'], recommended: true,
    msrp: 1599, dealerCost: 1119, laborUnits: 1.5, ndaa: true, onvifProfile: 'S',
    resolution: '5MP', indoorOutdoor: 'outdoor', vandalRating: 'IK10', ipRating: 'IP66',
    poeClass: 2, powerDrawWatts: 13, mounts: ['wall', 'pole'],
    compatibleAccessories: ['acc-verkada-cb-wall', 'acc-verkada-cb-pole'],
    compatibleVMS: ['Verkada Command'], warrantyYears: 10,
    notes: 'Cloud-managed, 30-day retention onboard. License required.' },
  { id: 'p-verkada-cd42', manufacturer: 'Verkada', productLine: 'CD Series',
    model: 'CD42-E', category: 'camera', subcategory: 'dome', cameraType: 'dome',
    deviceType: 'cam.dome', techModels: ['cloud', 'hybrid'], recommended: true,
    msrp: 1299, dealerCost: 909, laborUnits: 1.5, ndaa: true, onvifProfile: 'S',
    resolution: '5MP', indoorOutdoor: 'indoor', vandalRating: 'IK10',
    poeClass: 2, powerDrawWatts: 12, mounts: ['ceiling', 'wall'],
    compatibleVMS: ['Verkada Command'], warrantyYears: 10 },
  { id: 'p-verkada-cd62', manufacturer: 'Verkada', model: 'CD62-E',
    category: 'camera', subcategory: 'dome', cameraType: 'dome', deviceType: 'cam.dome',
    techModels: ['cloud', 'hybrid'], msrp: 2199, dealerCost: 1539, laborUnits: 1.5,
    ndaa: true, onvifProfile: 'S', resolution: '4K', indoorOutdoor: 'outdoor',
    vandalRating: 'IK10', ipRating: 'IP66', poeClass: 3, powerDrawWatts: 14 },
  { id: 'p-verkada-cf81', manufacturer: 'Verkada', model: 'CF81-E',
    category: 'camera', subcategory: 'fisheye', cameraType: 'fisheye',
    deviceType: 'cam.fisheye', techModels: ['cloud', 'hybrid'],
    msrp: 1799, dealerCost: 1259, laborUnits: 1.5, ndaa: true, resolution: '5MP',
    indoorOutdoor: 'both', poeClass: 3, powerDrawWatts: 10 },
  { id: 'p-verkada-cd72-ptz', manufacturer: 'Verkada', model: 'CD72-E PTZ',
    category: 'camera', subcategory: 'ptz', cameraType: 'ptz', deviceType: 'cam.ptz',
    techModels: ['cloud', 'hybrid'], msrp: 4495, dealerCost: 3147, laborUnits: 3.0,
    ndaa: true, onvifProfile: 'S', resolution: '4K', indoorOutdoor: 'outdoor', ipRating: 'IP66',
    poeClass: 4, powerDrawWatts: 28 },

  // ── Bosch ───────────────────────────────────────────────────────────
  { id: 'p-bosch-dinion-8000i', manufacturer: 'Bosch', productLine: 'DINION',
    model: 'DINION IP starlight 8000i', category: 'camera', subcategory: 'bullet',
    cameraType: 'bullet', deviceType: 'cam.bullet', techModels: ['on_prem', 'hybrid'],
    msrp: 1995, dealerCost: 1297, laborUnits: 2.0, ndaa: true, onvifProfile: 'S',
    resolution: '4K', indoorOutdoor: 'outdoor', ipRating: 'IP66', poeClass: 4, powerDrawWatts: 16 },
  { id: 'p-bosch-flexidome-8000i', manufacturer: 'Bosch', model: 'FLEXIDOME IP 8000i',
    category: 'camera', subcategory: 'dome', cameraType: 'dome', deviceType: 'cam.dome',
    techModels: ['on_prem', 'hybrid'], msrp: 1895, dealerCost: 1232, laborUnits: 1.75,
    ndaa: true, onvifProfile: 'S', resolution: '4K', indoorOutdoor: 'outdoor',
    vandalRating: 'IK10', poeClass: 4, powerDrawWatts: 14 },
  { id: 'p-bosch-mic9000', manufacturer: 'Bosch', model: 'MIC IP fusion 9000i',
    category: 'camera', subcategory: 'ptz', cameraType: 'ptz', deviceType: 'cam.ptz',
    techModels: ['on_prem', 'hybrid'], msrp: 6995, dealerCost: 4547, laborUnits: 4.0,
    ndaa: true, resolution: '1080p', indoorOutdoor: 'outdoor', ipRating: 'IP68', poeClass: 4 },
  { id: 'p-bosch-autodome-multi', manufacturer: 'Bosch', model: 'AUTODOME IP multi 7000i',
    category: 'camera', subcategory: 'multisensor', cameraType: 'multisensor',
    deviceType: 'cam.multisensor', techModels: ['on_prem', 'hybrid'],
    msrp: 4495, dealerCost: 2922, laborUnits: 3.0, ndaa: true, resolution: 'multi-sensor',
    indoorOutdoor: 'outdoor', poeClass: 4, powerDrawWatts: 28 },

  // ── Cisco Meraki ────────────────────────────────────────────────────
  { id: 'p-meraki-mv13', manufacturer: 'Meraki', productLine: 'MV',
    model: 'MV13', category: 'camera', subcategory: 'dome', cameraType: 'dome',
    deviceType: 'cam.dome', techModels: ['cloud', 'hybrid'],
    msrp: 1399, dealerCost: 979, laborUnits: 1.5, ndaa: true, onvifProfile: 'S',
    resolution: '4K', indoorOutdoor: 'indoor', poeClass: 3, powerDrawWatts: 13,
    compatibleVMS: ['Meraki Dashboard'], warrantyYears: 10 },
  { id: 'p-meraki-mv53', manufacturer: 'Meraki', model: 'MV53',
    category: 'camera', subcategory: 'turret', cameraType: 'turret',
    deviceType: 'cam.dome', techModels: ['cloud', 'hybrid'],
    msrp: 1599, dealerCost: 1119, laborUnits: 1.75, ndaa: true, onvifProfile: 'S',
    resolution: '8MP', indoorOutdoor: 'outdoor', poeClass: 3, powerDrawWatts: 13 },
  { id: 'p-meraki-mv63', manufacturer: 'Meraki', model: 'MV63',
    category: 'camera', subcategory: 'bullet', cameraType: 'bullet',
    deviceType: 'cam.bullet', techModels: ['cloud', 'hybrid'],
    msrp: 1495, dealerCost: 1047, laborUnits: 2.0, ndaa: true, onvifProfile: 'S',
    resolution: '8MP', indoorOutdoor: 'outdoor', ipRating: 'IP66', poeClass: 3 },
  { id: 'p-meraki-mv93', manufacturer: 'Meraki', model: 'MV93',
    category: 'camera', subcategory: 'fisheye', cameraType: 'fisheye',
    deviceType: 'cam.fisheye', techModels: ['cloud', 'hybrid'],
    msrp: 1899, dealerCost: 1329, laborUnits: 1.5, ndaa: true,
    resolution: '8MP', indoorOutdoor: 'indoor', poeClass: 3 },

  // ── Rhombus ─────────────────────────────────────────────────────────
  { id: 'p-rhombus-r170', manufacturer: 'Rhombus', model: 'R170',
    category: 'camera', subcategory: 'dome', cameraType: 'dome', deviceType: 'cam.dome',
    techModels: ['cloud', 'hybrid'], msrp: 1299, dealerCost: 909, laborUnits: 1.5,
    ndaa: true, onvifProfile: 'S', resolution: '5MP', indoorOutdoor: 'indoor', poeClass: 2 },
  { id: 'p-rhombus-r230', manufacturer: 'Rhombus', model: 'R230',
    category: 'camera', subcategory: 'bullet', cameraType: 'bullet', deviceType: 'cam.bullet',
    techModels: ['cloud', 'hybrid'], msrp: 1499, dealerCost: 1049, laborUnits: 2.0,
    ndaa: true, onvifProfile: 'S', resolution: '4K', indoorOutdoor: 'outdoor', ipRating: 'IP66' },
  { id: 'p-rhombus-r400', manufacturer: 'Rhombus', model: 'R400',
    category: 'camera', subcategory: 'turret', cameraType: 'turret', deviceType: 'cam.dome',
    techModels: ['cloud', 'hybrid'], msrp: 1599, dealerCost: 1119, laborUnits: 1.75,
    ndaa: true, resolution: '4K', indoorOutdoor: 'outdoor' },
  { id: 'p-rhombus-r600', manufacturer: 'Rhombus', model: 'R600',
    category: 'camera', subcategory: 'bullet', cameraType: 'bullet', deviceType: 'cam.bullet',
    techModels: ['cloud', 'hybrid'], msrp: 1799, dealerCost: 1259, laborUnits: 2.25,
    ndaa: true, resolution: '8MP', indoorOutdoor: 'outdoor', ipRating: 'IP67' },

  // ── Ubiquiti UniFi ──────────────────────────────────────────────────
  { id: 'p-ubnt-g5-pro', manufacturer: 'Ubiquiti', productLine: 'UniFi Protect',
    model: 'AI Pro', category: 'camera', subcategory: 'bullet', cameraType: 'bullet',
    deviceType: 'cam.bullet', techModels: ['hybrid', 'cloud'],
    msrp: 549, dealerCost: 384, laborUnits: 1.5, ndaa: true, onvifProfile: 'S',
    resolution: '8MP', indoorOutdoor: 'outdoor', ipRating: 'IP66', poeClass: 3, powerDrawWatts: 11,
    compatibleVMS: ['UniFi Protect'], warrantyYears: 1 },
  { id: 'p-ubnt-g5-bullet', manufacturer: 'Ubiquiti', model: 'AI Bullet',
    category: 'camera', subcategory: 'bullet', cameraType: 'bullet', deviceType: 'cam.bullet',
    techModels: ['hybrid', 'cloud'], msrp: 449, dealerCost: 314, laborUnits: 1.5,
    ndaa: true, resolution: '5MP', indoorOutdoor: 'outdoor' },
  { id: 'p-ubnt-g5-dome', manufacturer: 'Ubiquiti', model: 'G5 Dome',
    category: 'camera', subcategory: 'dome', cameraType: 'dome', deviceType: 'cam.dome',
    techModels: ['hybrid', 'cloud'], msrp: 349, dealerCost: 244, laborUnits: 1.5,
    ndaa: true, resolution: '5MP', indoorOutdoor: 'indoor' },
  { id: 'p-ubnt-ai-ptz', manufacturer: 'Ubiquiti', model: 'AI PTZ',
    category: 'camera', subcategory: 'ptz', cameraType: 'ptz', deviceType: 'cam.ptz',
    techModels: ['hybrid', 'cloud'], msrp: 1499, dealerCost: 1049, laborUnits: 3.0,
    ndaa: true, resolution: '8MP', indoorOutdoor: 'outdoor', poeClass: 4, powerDrawWatts: 20 },

  // ── i-PRO ───────────────────────────────────────────────────────────
  { id: 'p-ipro-wv-x86600', manufacturer: 'i-PRO', model: 'WV-X86600-NV2L',
    category: 'camera', subcategory: 'bullet', cameraType: 'bullet', deviceType: 'cam.bullet',
    techModels: ['on_prem', 'hybrid'], msrp: 1875, dealerCost: 1219, laborUnits: 2.0,
    ndaa: true, onvifProfile: 'S', resolution: '5MP', indoorOutdoor: 'outdoor',
    vandalRating: 'IK10', ipRating: 'IP66', poeClass: 4, powerDrawWatts: 14 },
  { id: 'p-ipro-wv-s2536', manufacturer: 'i-PRO', model: 'WV-S2536LN',
    category: 'camera', subcategory: 'dome', cameraType: 'dome', deviceType: 'cam.dome',
    techModels: ['on_prem', 'hybrid'], msrp: 945, dealerCost: 614, laborUnits: 1.75,
    ndaa: true, onvifProfile: 'S', resolution: '1080p', indoorOutdoor: 'indoor' },
  { id: 'p-ipro-wv-x35402', manufacturer: 'i-PRO', model: 'WV-X35402-F2L',
    category: 'camera', subcategory: 'turret', cameraType: 'turret', deviceType: 'cam.dome',
    techModels: ['on_prem', 'hybrid'], msrp: 1199, dealerCost: 779, laborUnits: 1.75,
    ndaa: true, resolution: '4K' },
  { id: 'p-ipro-wv-s85702', manufacturer: 'i-PRO', model: 'WV-S85702-F3L',
    category: 'camera', subcategory: 'multisensor', cameraType: 'multisensor', deviceType: 'cam.multisensor',
    techModels: ['on_prem', 'hybrid'], msrp: 4995, dealerCost: 3247, laborUnits: 3.0,
    ndaa: true, resolution: 'multi-sensor', indoorOutdoor: 'outdoor', poeClass: 4 },

  // ── Pelco ───────────────────────────────────────────────────────────
  { id: 'p-pelco-sarix-bullet', manufacturer: 'Pelco', productLine: 'Sarix Pro',
    model: 'IBP331-1ER', category: 'camera', subcategory: 'bullet', cameraType: 'bullet',
    deviceType: 'cam.bullet', techModels: ['on_prem', 'hybrid'],
    msrp: 1199, dealerCost: 779, laborUnits: 2.0, ndaa: true, onvifProfile: 'S',
    resolution: '4MP', indoorOutdoor: 'outdoor', ipRating: 'IP66', poeClass: 3 },
  { id: 'p-pelco-sarix-dome', manufacturer: 'Pelco', model: 'IMM12036-1ES',
    category: 'camera', subcategory: 'dome', cameraType: 'dome', deviceType: 'cam.dome',
    techModels: ['on_prem', 'hybrid'], msrp: 1349, dealerCost: 877, laborUnits: 1.75,
    ndaa: true, resolution: '4K', vandalRating: 'IK10' },
  { id: 'p-pelco-spectra-pro', manufacturer: 'Pelco', model: 'Spectra Professional 4K',
    category: 'camera', subcategory: 'ptz', cameraType: 'ptz', deviceType: 'cam.ptz',
    techModels: ['on_prem', 'hybrid'], msrp: 3495, dealerCost: 2272, laborUnits: 3.0,
    ndaa: true, resolution: '4K', indoorOutdoor: 'outdoor', ipRating: 'IP66' },

  // ── Vivotek ─────────────────────────────────────────────────────────
  { id: 'p-vivotek-fd9387', manufacturer: 'Vivotek', model: 'FD9387-HTV',
    category: 'camera', subcategory: 'dome', cameraType: 'dome', deviceType: 'cam.dome',
    techModels: ['on_prem', 'hybrid'], msrp: 599, dealerCost: 389, laborUnits: 1.75,
    ndaa: true, onvifProfile: 'S', resolution: '5MP', indoorOutdoor: 'outdoor' },
  { id: 'p-vivotek-fe9382', manufacturer: 'Vivotek', model: 'FE9382-EHV',
    category: 'camera', subcategory: 'fisheye', cameraType: 'fisheye', deviceType: 'cam.fisheye',
    techModels: ['on_prem', 'hybrid'], msrp: 849, dealerCost: 552, laborUnits: 1.5,
    ndaa: true, resolution: '5MP', indoorOutdoor: 'outdoor' },
  { id: 'p-vivotek-ib9388', manufacturer: 'Vivotek', model: 'IB9388-HT',
    category: 'camera', subcategory: 'bullet', cameraType: 'bullet', deviceType: 'cam.bullet',
    techModels: ['on_prem', 'hybrid'], msrp: 599, dealerCost: 389, laborUnits: 2.0,
    ndaa: true, resolution: '5MP', indoorOutdoor: 'outdoor', ipRating: 'IP66' },

  // ── Uniview ─────────────────────────────────────────────────────────
  { id: 'p-uniview-ipc2128', manufacturer: 'Uniview', model: 'IPC2128SR3-DPF40-F',
    category: 'camera', subcategory: 'bullet', cameraType: 'bullet', deviceType: 'cam.bullet',
    techModels: ['on_prem'], msrp: 449, dealerCost: 292, laborUnits: 2.0,
    ndaa: false, onvifProfile: 'S', resolution: '8MP', indoorOutdoor: 'outdoor', ipRating: 'IP67',
    notes: 'Not NDAA compliant — confirm jurisdiction before specifying.' },
  { id: 'p-uniview-ipc3535', manufacturer: 'Uniview', model: 'IPC3535ER3-DPF28M',
    category: 'camera', subcategory: 'dome', cameraType: 'dome', deviceType: 'cam.dome',
    techModels: ['on_prem'], msrp: 389, dealerCost: 253, laborUnits: 1.75,
    ndaa: false, resolution: '5MP', indoorOutdoor: 'indoor' },
  { id: 'p-uniview-ipc6624', manufacturer: 'Uniview', model: 'IPC6624SR-X33-VG',
    category: 'camera', subcategory: 'ptz', cameraType: 'ptz', deviceType: 'cam.ptz',
    techModels: ['on_prem'], msrp: 1799, dealerCost: 1169, laborUnits: 3.0,
    ndaa: false, resolution: '2MP', indoorOutdoor: 'outdoor' },

  // ── Hikvision ───────────────────────────────────────────────────────
  { id: 'p-hik-2cd2685', manufacturer: 'Hikvision', model: 'DS-2CD2685G2-IZS',
    category: 'camera', subcategory: 'bullet', cameraType: 'bullet', deviceType: 'cam.bullet',
    techModels: ['on_prem'], msrp: 549, dealerCost: 357, laborUnits: 2.0,
    ndaa: false, onvifProfile: 'S', resolution: '8MP', indoorOutdoor: 'outdoor', ipRating: 'IP67',
    notes: 'Federally restricted — confirm jurisdiction.' },
  { id: 'p-hik-2cd2785', manufacturer: 'Hikvision', model: 'DS-2CD2785G2-IZS',
    category: 'camera', subcategory: 'turret', cameraType: 'turret', deviceType: 'cam.dome',
    techModels: ['on_prem'], msrp: 599, dealerCost: 389, laborUnits: 1.75,
    ndaa: false, resolution: '8MP', indoorOutdoor: 'outdoor' },

  // ── Dahua ───────────────────────────────────────────────────────────
  { id: 'p-dahua-hfw5849', manufacturer: 'Dahua', model: 'IPC-HFW5849T1-ASE',
    category: 'camera', subcategory: 'bullet', cameraType: 'bullet', deviceType: 'cam.bullet',
    techModels: ['on_prem'], msrp: 595, dealerCost: 387, laborUnits: 2.0,
    ndaa: false, resolution: '8MP', indoorOutdoor: 'outdoor', ipRating: 'IP67',
    notes: 'Federally restricted — confirm jurisdiction.' },
  { id: 'p-dahua-hdbw5849', manufacturer: 'Dahua', model: 'IPC-HDBW5849R-ASE',
    category: 'camera', subcategory: 'turret', cameraType: 'turret', deviceType: 'cam.dome',
    techModels: ['on_prem'], msrp: 625, dealerCost: 406, laborUnits: 1.75,
    ndaa: false, resolution: '8MP' },

  // ── Avycon ──────────────────────────────────────────────────────────
  { id: 'p-avycon-avc-nsb81', manufacturer: 'Avycon', model: 'AVC-NSB81F36',
    category: 'camera', subcategory: 'bullet', cameraType: 'bullet', deviceType: 'cam.bullet',
    techModels: ['on_prem'], msrp: 525, dealerCost: 341, laborUnits: 2.0,
    ndaa: true, onvifProfile: 'S', resolution: '8MP', indoorOutdoor: 'outdoor', ipRating: 'IP67' },
  { id: 'p-avycon-avc-nsd81', manufacturer: 'Avycon', model: 'AVC-NSD81F28',
    category: 'camera', subcategory: 'dome', cameraType: 'dome', deviceType: 'cam.dome',
    techModels: ['on_prem'], msrp: 540, dealerCost: 351, laborUnits: 1.75,
    ndaa: true, resolution: '8MP', indoorOutdoor: 'indoor' },
  { id: 'p-avycon-avc-tp91', manufacturer: 'Avycon', model: 'AVC-TP91M28-WT',
    category: 'camera', subcategory: 'turret', cameraType: 'turret', deviceType: 'cam.dome',
    techModels: ['on_prem'], msrp: 560, dealerCost: 364, laborUnits: 1.75,
    ndaa: true, resolution: '8MP' },

  // ── Thermal / specialty cameras ─────────────────────────────────────
  { id: 'p-flir-fc-series', manufacturer: 'FLIR', model: 'FC-Series ID',
    category: 'camera', subcategory: 'thermal', cameraType: 'thermal', deviceType: 'cam.thermal',
    techModels: ['on_prem', 'hybrid'], msrp: 3495, dealerCost: 2272, laborUnits: 2.5,
    ndaa: true, resolution: 'multi-sensor', indoorOutdoor: 'outdoor', recommended: true },
  { id: 'p-axis-q1961-te', manufacturer: 'Axis', model: 'Q1961-TE',
    category: 'camera', subcategory: 'thermal', cameraType: 'thermal', deviceType: 'cam.thermal',
    techModels: ['on_prem', 'hybrid'], msrp: 4995, dealerCost: 3247, laborUnits: 2.5,
    ndaa: true, indoorOutdoor: 'outdoor' },

  // ════════════════════════════════════════════════════════════════════
  // ACCESS CONTROL
  // ════════════════════════════════════════════════════════════════════
  { id: 'p-hid-signo-20', manufacturer: 'HID', productLine: 'Signo',
    model: 'Signo 20', category: 'reader', subcategory: 'card-reader',
    deviceType: 'acc.reader', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 285, dealerCost: 185, laborUnits: 0.75, ndaa: true,
    mounts: ['door-mullion', 'wall'],
    compatibleAccessories: ['acc-hid-mullion', 'acc-hid-gangbox', 'acc-hid-weatherhood'],
    compatibleControllers: ['Mercury', 'LenelS2', 'Brivo', 'Avigilon Alta'],
    warrantyYears: 5, recommended: true },
  { id: 'p-hid-signo-40', manufacturer: 'HID', model: 'Signo 40',
    category: 'reader', subcategory: 'card-reader', deviceType: 'acc.reader',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 345, dealerCost: 224, laborUnits: 0.75,
    ndaa: true, notes: 'Wall-mount form factor with keypad option.' },
  { id: 'p-hid-signo-20k', manufacturer: 'HID', model: 'Signo 20K',
    category: 'reader', subcategory: 'keypad', deviceType: 'acc.reader',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 365, dealerCost: 237, laborUnits: 0.75, ndaa: true },
  { id: 'p-mercury-lp1502', manufacturer: 'Mercury Security', model: 'LP1502',
    category: 'controller', deviceType: 'acc.reader',
    techModels: ['on_prem', 'hybrid'], msrp: 695, dealerCost: 452, laborUnits: 2.0,
    ndaa: true, compatibleVMS: ['LenelS2', 'Genetec', 'Software House', 'AMAG'],
    notes: 'Industry-standard 2-door controller; pairs with most VMS head-ends.' },
  { id: 'p-mercury-lp4502', manufacturer: 'Mercury Security', model: 'LP4502',
    category: 'controller', techModels: ['on_prem', 'hybrid'],
    msrp: 1495, dealerCost: 972, laborUnits: 3.0, ndaa: true,
    notes: '4-door controller, scalable.' },
  { id: 'p-lenels2-mercury', manufacturer: 'LenelS2', model: 'NetBox 4',
    category: 'controller', techModels: ['on_prem', 'hybrid'],
    msrp: 4995, dealerCost: 3247, laborUnits: 6.0, ndaa: true },
  { id: 'p-brivo-acs6000', manufacturer: 'Brivo', model: 'ACS6000',
    category: 'controller', techModels: ['cloud', 'hybrid'],
    msrp: 1295, dealerCost: 906, laborUnits: 2.5, ndaa: true,
    notes: '4-door cloud-managed controller; pairs with Brivo readers.' },
  { id: 'p-brivo-acr1255', manufacturer: 'Brivo', model: 'ACR1255 Reader',
    category: 'reader', subcategory: 'card-reader', deviceType: 'acc.reader',
    techModels: ['cloud', 'hybrid'], msrp: 295, dealerCost: 206, laborUnits: 0.75,
    ndaa: true, recommended: true },
  { id: 'p-alta-r3', manufacturer: 'Avigilon Alta', productLine: 'Openpath',
    model: 'R3 Smart Reader', category: 'reader', subcategory: 'mobile-cred', deviceType: 'acc.reader',
    techModels: ['cloud', 'hybrid'], msrp: 395, dealerCost: 276, laborUnits: 0.75,
    ndaa: true, recommended: true, notes: 'Mobile + card; supports BLE / NFC / wave.' },
  { id: 'p-alta-acu', manufacturer: 'Avigilon Alta', model: 'ACU 12-port',
    category: 'controller', techModels: ['cloud', 'hybrid'],
    msrp: 1495, dealerCost: 1046, laborUnits: 3.0, ndaa: true },
  { id: 'p-verkada-ac41', manufacturer: 'Verkada', productLine: 'Access',
    model: 'AC41 Controller', category: 'controller', techModels: ['cloud', 'hybrid'],
    msrp: 1295, dealerCost: 906, laborUnits: 2.5, ndaa: true, recommended: true },
  { id: 'p-verkada-ad34', manufacturer: 'Verkada', model: 'AD34',
    category: 'reader', subcategory: 'card-reader', deviceType: 'acc.reader',
    techModels: ['cloud', 'hybrid'], msrp: 345, dealerCost: 241, laborUnits: 0.75, ndaa: true },
  { id: 'p-schlage-nde', manufacturer: 'Schlage', productLine: 'NDE',
    model: 'NDE80', category: 'lock', subcategory: 'wireless-lock',
    techModels: ['on_prem', 'hybrid'], msrp: 1095, dealerCost: 712, laborUnits: 1.5,
    notes: 'Wireless networked lock; pairs with most VMS head-ends.' },
  { id: 'p-allegion-le-l', manufacturer: 'Allegion', model: 'LE L Series',
    category: 'lock', subcategory: 'wireless-lock', techModels: ['on_prem', 'hybrid'],
    msrp: 1095, dealerCost: 712, laborUnits: 1.5 },
  { id: 'p-vd-6210', manufacturer: 'Von Duprin', model: '6210',
    category: 'lock', subcategory: 'strike', deviceType: 'acc.strike',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 285, dealerCost: 185, laborUnits: 1.0,
    notes: 'Fail-safe strike; pairs with most door hardware.', recommended: true },
  { id: 'p-hes-9600', manufacturer: 'HES', model: '9600',
    category: 'lock', subcategory: 'strike', deviceType: 'acc.strike',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 225, dealerCost: 146, laborUnits: 1.0 },
  { id: 'p-adams-rite-7170', manufacturer: 'Adams Rite', model: '7170',
    category: 'lock', subcategory: 'strike', deviceType: 'acc.strike',
    techModels: ['on_prem', 'hybrid'], msrp: 295, dealerCost: 192, laborUnits: 1.0,
    notes: 'Aluminum-frame strike for storefront doors.' },
  { id: 'p-securitron-m62', manufacturer: 'Securitron', model: 'M62',
    category: 'lock', subcategory: 'maglock', deviceType: 'acc.maglock',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 295, dealerCost: 192, laborUnits: 1.25,
    notes: '1200 lb single-door maglock; requires REX.', recommended: true },
  { id: 'p-securitron-m38', manufacturer: 'Securitron', model: 'M38',
    category: 'lock', subcategory: 'maglock', deviceType: 'acc.maglock',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 225, dealerCost: 146, laborUnits: 1.25 },
  { id: 'p-bosch-rex-pir', manufacturer: 'Bosch', model: 'REX-PIR',
    category: 'rex', deviceType: 'acc.exit', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 185, dealerCost: 120, laborUnits: 0.75, recommended: true },
  { id: 'p-camden-cm-330', manufacturer: 'Camden', model: 'CM-330',
    category: 'rex', deviceType: 'acc.exit', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 145, dealerCost: 94, laborUnits: 0.5, notes: 'Touchless wave-to-exit button.' },
  { id: 'p-sti-ss-2000', manufacturer: 'STI', model: 'SS-2000',
    category: 'rex', deviceType: 'acc.exit', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 89, dealerCost: 58, laborUnits: 0.5, notes: 'Push-button REX.' },
  { id: 'p-vd-99eo', manufacturer: 'Von Duprin', model: '99 EO',
    category: 'panic-bar', deviceType: 'acc.panic-bar', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 895, dealerCost: 582, laborUnits: 1.5, notes: 'Surface exit device; pairs with electrified strike.' },
  { id: 'p-honeywell-dps', manufacturer: 'Honeywell', model: '5816 Wireless',
    category: 'dps', deviceType: 'acc.dps', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 35, dealerCost: 23, laborUnits: 0.4 },
  { id: 'p-altronix-al600', manufacturer: 'Altronix', model: 'AL600ULPD8CB',
    category: 'psu', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 425, dealerCost: 276, laborUnits: 1.5,
    notes: '8-output access-control power supply with fire trip.' },
  { id: 'p-lifesafety-ftl', manufacturer: 'LifeSafety Power', model: 'FlexPower FTL-150',
    category: 'psu', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 595, dealerCost: 387, laborUnits: 2.0 },

  // ── Reader / camera accessories ─────────────────────────────────────
  { id: 'acc-hid-mullion', manufacturer: 'HID', model: 'Mullion mount kit',
    category: 'accessory', subcategory: 'mullion-mount', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 45, dealerCost: 29, laborUnits: 0.25 },
  { id: 'acc-hid-gangbox', manufacturer: 'HID', model: 'Single-gang box',
    category: 'accessory', subcategory: 'gang-box', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 35, dealerCost: 23 },
  { id: 'acc-hid-weatherhood', manufacturer: 'HID', model: 'Weather hood',
    category: 'accessory', subcategory: 'weather-hood', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 65, dealerCost: 42 },
  { id: 'acc-spacer-plate', manufacturer: 'Universal', model: 'Reader spacer plate',
    category: 'accessory', subcategory: 'spacer-plate', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 22, dealerCost: 14 },
  { id: 'acc-axis-t91', manufacturer: 'Axis', model: 'T91 wall arm',
    category: 'accessory', subcategory: 'wall-mount', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 65, dealerCost: 42 },
  { id: 'acc-axis-t94', manufacturer: 'Axis', model: 'T94 pole adapter',
    category: 'accessory', subcategory: 'pole-mount', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 95, dealerCost: 62 },
  { id: 'acc-axis-tg6', manufacturer: 'Axis', model: 'TG6 corner adapter',
    category: 'accessory', subcategory: 'corner-mount', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 85, dealerCost: 55 },
  { id: 'acc-axis-tp01', manufacturer: 'Axis', model: 'TP01 parapet mount',
    category: 'accessory', subcategory: 'parapet-mount', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 110, dealerCost: 72 },
  { id: 'acc-axis-tp1', manufacturer: 'Axis', model: 'TP1 ceiling plate',
    category: 'accessory', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 35, dealerCost: 23 },
  { id: 'acc-pendant-drop', manufacturer: 'Universal', model: 'Pendant drop',
    category: 'accessory', subcategory: 'pendant-mount', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 45, dealerCost: 29 },
  { id: 'acc-hanwha-mwd', manufacturer: 'Hanwha', model: 'MWD wall mount',
    category: 'accessory', subcategory: 'wall-mount', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 55, dealerCost: 36 },
  { id: 'acc-hanwha-mpl', manufacturer: 'Hanwha', model: 'MPL pole adapter',
    category: 'accessory', subcategory: 'pole-mount', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 90, dealerCost: 58 },
  { id: 'acc-verkada-cb-wall', manufacturer: 'Verkada', model: 'CB wall mount',
    category: 'accessory', subcategory: 'wall-mount', techModels: ['cloud', 'hybrid'],
    msrp: 75, dealerCost: 53 },
  { id: 'acc-verkada-cb-pole', manufacturer: 'Verkada', model: 'CB pole mount',
    category: 'accessory', subcategory: 'pole-mount', techModels: ['cloud', 'hybrid'],
    msrp: 120, dealerCost: 84 },
  { id: 'acc-jb-4x4', manufacturer: 'Universal', model: '4×4 weatherproof J-box',
    category: 'accessory', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 25, dealerCost: 16 },

  // ════════════════════════════════════════════════════════════════════
  // IT / NETWORK
  // ════════════════════════════════════════════════════════════════════
  { id: 'p-cisco-c9300-48p', manufacturer: 'Cisco', productLine: 'Catalyst 9300',
    model: 'C9300-48P', category: 'switch', subcategory: 'poe-switch',
    deviceType: 'net.switch', techModels: ['on_prem', 'hybrid'],
    msrp: 7295, dealerCost: 4742, laborUnits: 3.0, ndaa: true, recommended: true,
    notes: '48-port PoE+ access switch. 740W PoE budget.' },
  { id: 'p-cisco-c9300-24p', manufacturer: 'Cisco', model: 'C9300-24P',
    category: 'switch', subcategory: 'poe-switch', deviceType: 'net.switch',
    techModels: ['on_prem', 'hybrid'], msrp: 4995, dealerCost: 3247, laborUnits: 2.5, ndaa: true },
  { id: 'p-meraki-ms355-48x', manufacturer: 'Meraki', model: 'MS355-48X2',
    category: 'switch', subcategory: 'poe-switch', deviceType: 'net.switch',
    techModels: ['cloud', 'hybrid'], msrp: 8995, dealerCost: 5847, laborUnits: 3.0, ndaa: true,
    notes: '48-port multigig PoE++. Cloud-managed.' },
  { id: 'p-cisco-c9166', manufacturer: 'Cisco', model: 'C9166',
    category: 'access-point', subcategory: 'wifi6e', deviceType: 'net.ap',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 1245, dealerCost: 809, laborUnits: 1.5, ndaa: true },
  { id: 'p-meraki-mr57', manufacturer: 'Meraki', model: 'MR57',
    category: 'access-point', subcategory: 'wifi6e', deviceType: 'net.ap',
    techModels: ['cloud', 'hybrid'], msrp: 1395, dealerCost: 907, laborUnits: 1.5, ndaa: true,
    notes: 'Wi-Fi 6E · cloud-managed.' },
  { id: 'p-aruba-cx-6300', manufacturer: 'HPE Aruba', model: 'CX 6300 48-port',
    category: 'switch', subcategory: 'poe-switch', deviceType: 'net.switch',
    techModels: ['on_prem', 'hybrid'], msrp: 6295, dealerCost: 4092, laborUnits: 3.0, ndaa: true },
  { id: 'p-aruba-2930f', manufacturer: 'HPE Aruba', model: '2930F 48-port',
    category: 'switch', subcategory: 'access-switch', deviceType: 'net.switch',
    techModels: ['on_prem', 'hybrid'], msrp: 3495, dealerCost: 2272, laborUnits: 2.5, ndaa: true },
  { id: 'p-aruba-ap-635', manufacturer: 'HPE Aruba', model: 'AP-635',
    category: 'access-point', subcategory: 'wifi6e', deviceType: 'net.ap',
    techModels: ['on_prem', 'hybrid'], msrp: 1295, dealerCost: 842, laborUnits: 1.5, ndaa: true },
  { id: 'p-ruckus-icx-7150', manufacturer: 'Ruckus', model: 'ICX 7150-48P',
    category: 'switch', subcategory: 'poe-switch', deviceType: 'net.switch',
    techModels: ['on_prem', 'hybrid'], msrp: 4495, dealerCost: 2922, laborUnits: 2.5, ndaa: true },
  { id: 'p-ubnt-usw-pro-48', manufacturer: 'Ubiquiti', model: 'USW-Pro-48-PoE',
    category: 'switch', subcategory: 'poe-switch', deviceType: 'net.switch',
    techModels: ['hybrid', 'cloud'], msrp: 999, dealerCost: 699, laborUnits: 2.0, ndaa: true,
    recommended: true, notes: '48-port Gen2 PoE+ · UniFi managed.' },
  { id: 'p-ubnt-airfiber60', manufacturer: 'Ubiquiti', model: 'airFiber 60',
    category: 'bridge', deviceType: 'net.bridge', techModels: ['hybrid', 'on_prem'],
    msrp: 549, dealerCost: 384, laborUnits: 2.5, ndaa: true,
    notes: 'PtP 60 GHz bridge with 5 GHz fallback.' },
  { id: 'p-ubnt-u6-enterprise', manufacturer: 'Ubiquiti', model: 'U6 Enterprise',
    category: 'access-point', subcategory: 'wifi6e', deviceType: 'net.ap',
    techModels: ['hybrid', 'cloud'], msrp: 379, dealerCost: 265, laborUnits: 1.0, ndaa: true },
  { id: 'p-netgear-gsm4248px', manufacturer: 'Netgear', model: 'GSM4248PX-100NES',
    category: 'switch', subcategory: 'poe-switch', deviceType: 'net.switch',
    techModels: ['on_prem', 'hybrid'], msrp: 2495, dealerCost: 1622, laborUnits: 2.5, ndaa: true,
    notes: '48-port 2.5G multigig PoE+.' },
  { id: 'p-juniper-ex4300', manufacturer: 'Juniper', model: 'EX4300-48P',
    category: 'switch', subcategory: 'core-switch', deviceType: 'net.switch',
    techModels: ['on_prem', 'hybrid'], msrp: 8495, dealerCost: 5522, laborUnits: 4.0, ndaa: true },
  { id: 'p-fortinet-100f', manufacturer: 'Fortinet', model: 'FortiGate 100F',
    category: 'firewall', deviceType: 'net.firewall', techModels: ['on_prem', 'hybrid'],
    msrp: 4895, dealerCost: 3182, laborUnits: 3.5, ndaa: true,
    notes: '20 Gbps NGFW with NSS-labs verified IPS.' },
  { id: 'p-pa-1410', manufacturer: 'Palo Alto', model: 'PA-1410',
    category: 'firewall', deviceType: 'net.firewall', techModels: ['on_prem', 'hybrid'],
    msrp: 8995, dealerCost: 5847, laborUnits: 4.0, ndaa: true },
  { id: 'p-apc-netshelter-sx-42u', manufacturer: 'APC', model: 'NetShelter SX 42U',
    category: 'rack', subcategory: 'rack-floor', deviceType: 'inf.rack',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 1495, dealerCost: 972, laborUnits: 2.0, ndaa: true,
    recommended: true },
  { id: 'p-mid-atl-wmrk-12', manufacturer: 'Middle Atlantic', model: 'WMRK-12',
    category: 'rack', subcategory: 'rack-wall', deviceType: 'inf.rack',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 545, dealerCost: 354, laborUnits: 1.5 },
  { id: 'p-panduit-mini-com-48', manufacturer: 'Panduit', model: 'Mini-Com 48-port patch panel',
    category: 'patch-panel', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 295, dealerCost: 192, laborUnits: 1.5 },
  { id: 'p-belden-cat6a', manufacturer: 'Belden', model: 'Cat6A · 10X8P (1000 ft)',
    category: 'cable', subcategory: 'cat6a', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 780, dealerCost: 507 },
  { id: 'p-commscope-fiber-mm', manufacturer: 'CommScope', model: 'Multimode OM4 fiber',
    category: 'cable', subcategory: 'fiber-mm', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 1650, dealerCost: 1072 },
  { id: 'p-apc-smt-3000', manufacturer: 'APC', model: 'Smart-UPS 3000',
    category: 'ups', deviceType: 'pwr.ups', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 1620, dealerCost: 1053, laborUnits: 1.5, ndaa: true, recommended: true,
    notes: '3 kVA · LCD · 18 min runtime at 50% load.' },
  { id: 'p-apc-smt-1500', manufacturer: 'APC', model: 'Smart-UPS 1500',
    category: 'ups', deviceType: 'pwr.ups', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 795, dealerCost: 517, laborUnits: 1.0, ndaa: true },
  { id: 'p-axis-t8154', manufacturer: 'Axis', model: 'T8154 60W PoE midspan',
    category: 'poe-injector', deviceType: 'pwr.poe', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 195, dealerCost: 127, laborUnits: 0.5, ndaa: true },
  { id: 'p-ditek-mrj45c6', manufacturer: 'Ditek', model: 'MRJ45C6',
    category: 'surge', deviceType: 'pwr.surge', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 65, dealerCost: 42, laborUnits: 0.25, ndaa: true,
    notes: 'Cat6 RJ-45 surge protection (data + PoE).' },

  // ════════════════════════════════════════════════════════════════════
  // STORAGE / RECORDING
  // ════════════════════════════════════════════════════════════════════
  { id: 'p-axis-s1216', manufacturer: 'Axis', model: 'S1216 16-channel NVR',
    category: 'nvr', deviceType: 'sto.nvr', techModels: ['on_prem', 'hybrid'],
    msrp: 6890, dealerCost: 4479, laborUnits: 3.0, ndaa: true,
    notes: '16 ch · 36 TB onboard. Pairs with Axis Camera Station.' },
  { id: 'p-genetec-sv-4000', manufacturer: 'Genetec', model: 'Streamvault SV-4000',
    category: 'server', deviceType: 'sto.server', techModels: ['on_prem', 'hybrid'],
    msrp: 12500, dealerCost: 8125, laborUnits: 4.0, ndaa: true, recommended: true,
    notes: 'VMS appliance preloaded with Security Center.' },
  { id: 'p-milestone-xp-srv', manufacturer: 'Milestone', model: 'XProtect SRV',
    category: 'server', deviceType: 'sto.server', techModels: ['on_prem', 'hybrid'],
    msrp: 11500, dealerCost: 7475, laborUnits: 4.0, ndaa: true },
  { id: 'p-dell-r760', manufacturer: 'Dell', model: 'PowerEdge R760 Archive',
    category: 'archive', deviceType: 'sto.archive', techModels: ['on_prem', 'hybrid'],
    msrp: 18500, dealerCost: 12025, laborUnits: 6.0, ndaa: true,
    notes: '256 TB archive bay.' },
  { id: 'p-eagleeye-cmvr-308', manufacturer: 'Eagle Eye', model: 'CMVR-308',
    category: 'cloud-bridge', deviceType: 'sto.cloud', techModels: ['cloud'],
    msrp: 2495, dealerCost: 1747, laborUnits: 1.0, ndaa: true,
    notes: '8-channel cloud bridge.' },

  // ════════════════════════════════════════════════════════════════════
  // INTERCOMS
  // ════════════════════════════════════════════════════════════════════
  { id: 'p-2n-ip-verso', manufacturer: '2N', model: 'IP Verso',
    category: 'intercom', subcategory: 'video-intercom', deviceType: 'acc.intercom',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 1495, dealerCost: 1046, laborUnits: 2.0, ndaa: true,
    recommended: true },
  { id: 'p-2n-indoor-talk', manufacturer: '2N', model: 'Indoor Talk',
    category: 'intercom', subcategory: 'audio-intercom', deviceType: 'aud.intercom',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 495, dealerCost: 346, laborUnits: 1.0, ndaa: true },
  { id: 'p-aiphone-ix-dv', manufacturer: 'Aiphone', model: 'IX-DV',
    category: 'intercom', subcategory: 'video-intercom', deviceType: 'acc.intercom',
    techModels: ['on_prem', 'hybrid'], msrp: 1095, dealerCost: 712, laborUnits: 2.0, ndaa: true },
  { id: 'p-zenitel-turbine', manufacturer: 'Zenitel', model: 'TCIS-3 Turbine',
    category: 'intercom', subcategory: 'sip-intercom', techModels: ['on_prem', 'hybrid'],
    msrp: 2195, dealerCost: 1427, laborUnits: 2.5, ndaa: true,
    notes: 'High-noise environment SIP intercom.' },
  { id: 'p-verkada-tdoor', manufacturer: 'Verkada', model: 'TD52 Intercom',
    category: 'intercom', subcategory: 'video-intercom', techModels: ['cloud', 'hybrid'],
    msrp: 1899, dealerCost: 1329, laborUnits: 2.0, ndaa: true },
  { id: 'p-doorbird-d2101v', manufacturer: 'DoorBird', model: 'D2101V',
    category: 'intercom', subcategory: 'video-intercom', techModels: ['cloud', 'hybrid'],
    msrp: 995, dealerCost: 696, laborUnits: 2.0, ndaa: true },

  // ════════════════════════════════════════════════════════════════════
  // INTRUSION
  // ════════════════════════════════════════════════════════════════════
  { id: 'p-bosch-tritech-isc', manufacturer: 'Bosch', model: 'TriTech ISC-PDL1',
    category: 'intrusion', deviceType: 'int.motion', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 245, dealerCost: 159, laborUnits: 0.75, ndaa: true,
    notes: 'Dual-tech (PIR + microwave) motion sensor.', recommended: true },
  { id: 'p-bosch-ds1108i', manufacturer: 'Bosch', model: 'DS1108i',
    category: 'intrusion', deviceType: 'int.glassbreak', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 165, dealerCost: 107, laborUnits: 0.5, ndaa: true },
  { id: 'p-honeywell-5816', manufacturer: 'Honeywell', model: '5816',
    category: 'intrusion', deviceType: 'int.contact', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 35, dealerCost: 23, laborUnits: 0.25, ndaa: true },
  { id: 'p-dsc-pg9914', manufacturer: 'DSC', model: 'PG9914 PowerG PIR',
    category: 'intrusion', deviceType: 'int.motion', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 145, dealerCost: 94, laborUnits: 0.5, ndaa: true },
  { id: 'p-dmp-7800', manufacturer: 'DMP', model: '7800 Touchscreen Keypad',
    category: 'intrusion', deviceType: 'int.keypad', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 425, dealerCost: 276, laborUnits: 1.0, ndaa: true },
  { id: 'p-qolsys-iq4', manufacturer: 'Qolsys', model: 'IQ Panel 4',
    category: 'intrusion', deviceType: 'int.keypad', techModels: ['cloud', 'hybrid'],
    msrp: 595, dealerCost: 387, laborUnits: 1.5, ndaa: true,
    notes: 'Wireless cellular intrusion panel · 802.11 + LTE.' },

  // ════════════════════════════════════════════════════════════════════
  // FIRE / LIFE SAFETY
  // ════════════════════════════════════════════════════════════════════
  { id: 'p-notifier-nfs2-3030', manufacturer: 'Notifier', model: 'NFS2-3030',
    category: 'fire-panel', deviceType: 'fls.fire-panel', techModels: ['on_prem', 'hybrid'],
    msrp: 3850, dealerCost: 2502, laborUnits: 8.0, recommended: true,
    notes: 'Addressable fire alarm control panel · 90 point.' },
  { id: 'p-simplex-4906', manufacturer: 'Simplex', model: '4906-9151 strobe',
    category: 'strobe', deviceType: 'fls.strobe', techModels: ['on_prem', 'hybrid'],
    msrp: 89, dealerCost: 58, laborUnits: 0.75 },
  { id: 'p-firelite-bg-12', manufacturer: 'Fire-Lite', model: 'BG-12LX pull station',
    category: 'pull-station', deviceType: 'fls.pull-station', techModels: ['on_prem', 'hybrid'],
    msrp: 95, dealerCost: 62, laborUnits: 0.75 },
  { id: 'p-edwards-eg1f', manufacturer: 'Edwards', model: 'EG1F-VMD horn/strobe',
    category: 'horn', deviceType: 'fls.strobe', techModels: ['on_prem', 'hybrid'],
    msrp: 175, dealerCost: 114, laborUnits: 0.75 },
  { id: 'p-systemsensor-i4', manufacturer: 'System Sensor', model: 'i4 Photoelectric',
    category: 'smoke-detector', deviceType: 'sen.smoke', techModels: ['on_prem', 'hybrid'],
    msrp: 95, dealerCost: 62, laborUnits: 0.5 },
  { id: 'p-victaulic-v3801', manufacturer: 'Victaulic', model: 'V3801 concealed sprinkler',
    category: 'sprinkler', deviceType: 'fls.sprinkler', techModels: ['on_prem', 'hybrid'],
    msrp: 28, dealerCost: 18, laborUnits: 0.5 },

  // ════════════════════════════════════════════════════════════════════
  // AUDIO / PA / DISPLAYS
  // ════════════════════════════════════════════════════════════════════
  { id: 'p-axis-c1410', manufacturer: 'Axis', model: 'C1410 ceiling speaker',
    category: 'speaker', subcategory: 'ceiling', deviceType: 'aud.speaker',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 595, dealerCost: 387, laborUnits: 1.0, ndaa: true,
    recommended: true },
  { id: 'p-axis-c1310-e', manufacturer: 'Axis', model: 'C1310-E horn',
    category: 'speaker', subcategory: 'horn-speaker', deviceType: 'aud.horn',
    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 895, dealerCost: 582, laborUnits: 1.0, ndaa: true,
    notes: '116 dB · IP66 outdoor talk-down horn.' },
  { id: 'p-axis-c8033', manufacturer: 'Axis', model: 'C8033 audio amplifier',
    category: 'amplifier', deviceType: 'aud.amp', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 1295, dealerCost: 842, laborUnits: 1.5, ndaa: true },
  { id: 'p-shure-mxa920', manufacturer: 'Shure', model: 'MXA920',
    category: 'microphone', deviceType: 'aud.mic', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 4895, dealerCost: 3182, laborUnits: 2.0, ndaa: true,
    notes: 'Ceiling array microphone · automixer + AEC.' },
  { id: 'p-atlas-ie-50t', manufacturer: 'Atlas IED', model: 'IE-50T amplifier',
    category: 'amplifier', techModels: ['on_prem', 'hybrid'],
    msrp: 1495, dealerCost: 972, laborUnits: 1.5,
    notes: '50W 70V paging amp.' },
  { id: 'p-dell-u2723', manufacturer: 'Dell', model: 'U2723QE 27" 4K',
    category: 'display', deviceType: 'dis.monitor', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 695, dealerCost: 452, laborUnits: 0.5, ndaa: true },
  { id: 'p-lg-lsab', manufacturer: 'LG', model: 'LSAB direct-view LED wall',
    category: 'display', deviceType: 'dis.wall', techModels: ['on_prem', 'hybrid'],
    msrp: 28500, dealerCost: 18525, laborUnits: 8.0, ndaa: true },

  // ════════════════════════════════════════════════════════════════════
  // CYBER / BUILDING / SENSORS
  // ════════════════════════════════════════════════════════════════════
  { id: 'p-crowdstrike-falcon', manufacturer: 'CrowdStrike', model: 'Falcon Insight',
    category: 'endpoint', techModels: ['cloud'],
    msrp: 185, laborUnits: 0.5, notes: 'Per-endpoint annual.' },
  { id: 'p-splunk-cloud', manufacturer: 'Splunk', model: 'Cloud SIEM',
    category: 'siem', techModels: ['cloud', 'on_prem'],
    msrp: 6500, laborUnits: 6.0, notes: 'Per-GB ingest, base year.' },
  { id: 'p-cloudflare-warp', manufacturer: 'Cloudflare', model: 'WARP for Teams',
    category: 'vpn', techModels: ['cloud'],
    msrp: 84, notes: 'Per seat / year.' },
  { id: 'p-tridium-jace-8000', manufacturer: 'Tridium', model: 'JACE 8000',
    category: 'bms', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 2495, dealerCost: 1622, laborUnits: 4.0 },
  { id: 'p-lutron-qsm-3pce', manufacturer: 'Lutron', model: 'QSM-3PCE lighting hub',
    category: 'lighting', techModels: ['on_prem', 'hybrid'],
    msrp: 1295, dealerCost: 842, laborUnits: 2.0 },
  { id: 'p-monnit-alta-temp', manufacturer: 'Monnit', model: 'ALTA Temp/Humidity',
    category: 'temperature', deviceType: 'sen.temp', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 145, dealerCost: 94, laborUnits: 0.5 },
  { id: 'p-aercus-ws2', manufacturer: 'Aercus', model: 'WS-2 water leak puck',
    category: 'water-leak', deviceType: 'sen.water', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 75, dealerCost: 49 },
  { id: 'p-density-open-area', manufacturer: 'Density', model: 'Open Area',
    category: 'occupancy', deviceType: 'sen.occupancy', techModels: ['cloud', 'hybrid'],
    msrp: 695, dealerCost: 487 },
  { id: 'p-shotspotter-iq', manufacturer: 'ShotSpotter', model: 'Indoor IQ',
    category: 'gunshot', deviceType: 'sen.gunshot', techModels: ['cloud', 'hybrid'],
    msrp: 1895, dealerCost: 1327 },
  { id: 'p-msa-altair', manufacturer: 'MSA', model: 'Altair 4XR multi-gas',
    category: 'gas', deviceType: 'sen.gas', techModels: ['cloud', 'on_prem', 'hybrid'],
    msrp: 595, dealerCost: 387 },

  // ════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE PLACEABLES — generic doors/walls/gates/etc.
  // ════════════════════════════════════════════════════════════════════
  { id: 'p-door-single',     manufacturer: 'Generic', model: 'Single door',     category: 'door',     deviceType: 'inf.door-single',     techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 0, laborUnits: 2.0 },
  { id: 'p-door-double',     manufacturer: 'Generic', model: 'Double door',     category: 'door',     deviceType: 'inf.door-double',     techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 0, laborUnits: 3.0 },
  { id: 'p-door-storefront', manufacturer: 'Generic', model: 'Storefront door', category: 'door',     deviceType: 'inf.door-storefront', techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 0, laborUnits: 2.5 },
  { id: 'p-door-sliding',    manufacturer: 'Generic', model: 'Sliding door',    category: 'door',     deviceType: 'inf.door-sliding',    techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 0, laborUnits: 3.0 },
  { id: 'p-window',          manufacturer: 'Generic', model: 'Window',          category: 'window',   deviceType: 'inf.window',          techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 0 },
  { id: 'p-wall-brick',      manufacturer: 'Generic', model: 'Brick wall',      category: 'wall',     deviceType: 'inf.wall-brick',      techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 0 },
  { id: 'p-wall-fire',       manufacturer: 'Generic', model: 'Fire-rated wall', category: 'wall',     deviceType: 'inf.wall-fire',       techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 0 },
  { id: 'p-wall-concrete',   manufacturer: 'Generic', model: 'Concrete wall',   category: 'wall',     deviceType: 'inf.wall-concrete',   techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 0 },
  { id: 'p-gate-swing',      manufacturer: 'Generic', model: 'Swing gate',      category: 'gate',     deviceType: 'inf.gate-swing',      techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 0, laborUnits: 4.0 },
  { id: 'p-gate-slide',      manufacturer: 'Generic', model: 'Slide gate',      category: 'gate',     deviceType: 'inf.gate-slide',      techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 0, laborUnits: 4.0 },
  { id: 'p-elevator',        manufacturer: 'Generic', model: 'Elevator',        category: 'elevator', deviceType: 'inf.elevator',        techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 0 },
  { id: 'p-mdf-room',        manufacturer: 'Universal', model: 'MDF closet',    category: 'mdf',      deviceType: 'inf.mdf',             techModels: ['cloud', 'on_prem', 'hybrid'], msrp: 0 },
];


// Window-side mirror so deriveBOM (in projectStore) can resolve catalog
// entries by id without creating an import cycle. Set once at module
// load; harmless in SSR / Node where globalThis lacks a window.
if (typeof globalThis !== "undefined") {
  (globalThis as any).__catalogProducts = SAMPLE_PRODUCTS;
}

