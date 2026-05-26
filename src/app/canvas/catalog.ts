// Canvas product catalog — extracted from screens/EngineeringCanvas.tsx as
// part of the M1 module split. Derives the canvas-side Product view from
// the unified catalog in src/app/lib/productCatalog.ts (the same catalog
// the /catalog screen reads).
//
// Single source of truth for: which products show in the InsertDock, what
// tech-model tags each carries, the O(1) lookup by id, and accessory
// pairings per camera type.

import {
  SAMPLE_PRODUCTS as CATALOG, accessoriesFor as catalogAccessoriesFor, type Product as CatalogProduct,
} from '../lib/productCatalog';
import type { Accessory, DeviceType, Product, TechModelTag } from './types';

// ─── Mount / accessory catalog ───────────────────────────────────────

export const ACCESSORIES: Accessory[] = [
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
 *  by camera type so we don't have to enumerate every SKU; engineers see
 *  the same accessory family for bullets across all bullet products. */
export function accessoriesForCameraType(t: DeviceType): Accessory[] {
  if (!t.startsWith('cam.')) return [];
  if (t === 'cam.fisheye') {
    return ACCESSORIES.filter((a) => a.kind === 'pendant-mount' || a.kind === 'mounting-plate');
  }
  if (t === 'cam.ptz') {
    return ACCESSORIES.filter((a) => a.kind === 'wall-mount' || a.kind === 'pole-mount' || a.kind === 'parapet-mount');
  }
  return ACCESSORIES.filter((a) => a.kind === 'wall-mount' || a.kind === 'corner-mount' || a.kind === 'junction-box');
}

// ─── Manufacturer → tech-model ecosystem map ─────────────────────────

/** Manufacturer → tech-model ecosystem map. Used to auto-tag every PRODUCTS
 *  entry without writing techModels on each one. Manufacturers we sell only
 *  in cloud or only on-prem are tagged accordingly; infrastructure (locks,
 *  cables, racks) is 'all'. */
export const MANUFACTURER_TECH_MODEL: Record<string, TechModelTag[]> = {
  Verkada: ['cloud'], Rhombus: ['cloud'], Meraki: ['cloud'], 'Cisco Meraki': ['cloud'],
  Brivo: ['cloud'], Openpath: ['cloud'], Alta: ['cloud'], 'Eagle Eye': ['cloud'],
  Arcules: ['cloud'], Spot: ['cloud'], Ambient: ['cloud'],
  Axis: ['on_prem', 'hybrid'], Hanwha: ['on_prem', 'hybrid'], Avigilon: ['on_prem', 'hybrid'],
  Bosch: ['on_prem', 'hybrid'], Genetec: ['on_prem', 'hybrid'], Milestone: ['on_prem', 'hybrid'],
  FLIR: ['on_prem', 'hybrid'], Pelco: ['on_prem'], Honeywell: ['on_prem', 'hybrid'],
  Vivotek: ['on_prem'], Dahua: ['on_prem'], Hikvision: ['on_prem'],
  Lenel: ['on_prem'], 'S2 Security': ['on_prem'], AMAG: ['on_prem'], Software_House: ['on_prem'],
  Cisco: ['cloud', 'on_prem', 'hybrid'], HID: ['all'], 'Mercury Security': ['on_prem', 'hybrid'],
  'Von Duprin': ['all'], Securitron: ['all'], Suprema: ['on_prem', 'hybrid'],
  'Boon Edam': ['all'], '2N': ['all'], APC: ['all'], Fortinet: ['all'],
  Ubiquiti: ['hybrid', 'on_prem'], Shure: ['all'], Dell: ['all'], LG: ['all'],
  Elo: ['all'], BrightSign: ['all'], Ditek: ['all'], 'Goal Zero': ['all'],
  Monnit: ['all'], 'System Sensor': ['all'], Aercus: ['all'], Density: ['all'],
  MSA: ['all'], ShotSpotter: ['all'], STI: ['all'], DMP: ['all'], Optex: ['on_prem', 'hybrid'],
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
export function productTechModels(p: Product): TechModelTag[] {
  if (p.techModels && p.techModels.length) return p.techModels;
  return MANUFACTURER_TECH_MODEL[p.mfr] ?? ['all'];
}

/** Does this product belong to the active project tech model? */
export function productMatchesTechModel(p: Product, model: 'cloud' | 'on_prem' | 'hybrid'): boolean {
  const tags = productTechModels(p);
  if (tags.includes('all')) return true;
  if (tags.includes(model)) return true;
  if (model === 'hybrid' && (tags.includes('cloud') || tags.includes('on_prem') || tags.includes('hybrid'))) return true;
  return false;
}

// ─── PRODUCTS — derived from the unified catalog ─────────────────────

/** PRODUCTS is a derived adapter view of the unified catalog in
 *  src/app/lib/productCatalog.ts — the SAME data the /catalog screen reads.
 *  Changing the catalog updates both the InsertDock and the Product
 *  Catalog screen automatically. Single source of truth. */
export const PRODUCTS: Product[] = CATALOG
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
 *  rendering loop (per-camera label caption resolves catalog product on
 *  every render — at 50+ cameras × pan/zoom/drag frames, a linear
 *  PRODUCTS.find becomes a measurable cost). Built once at module load. */
export const PRODUCTS_BY_ID: Map<string, Product> = new Map(PRODUCTS.map((p) => [p.id, p]));

// Re-export the underlying catalog + adapter so the old imports don't churn.
export { CATALOG, catalogAccessoriesFor };
export type { CatalogProduct };
