// Sample product catalog — schema + a representative cross-section of
// manufacturer / model entries. This is INTENTIONALLY incomplete. The
// real database is a follow-on; this file establishes the schema and
// gives the canvas / drawer enough to filter against per project tech
// model (cloud / on-prem / hybrid). Treat it as a seed, not a fact sheet.
//
// Every entry should be auditable to a real product. If you can't verify
// a field, leave it undefined rather than fake a value.

import type { DeviceType, ProjectTechModel } from '../store/types';

export type ProductCategory =
  | 'camera' | 'reader' | 'lock' | 'intercom' | 'intrusion'
  | 'speaker' | 'av' | 'network' | 'power' | 'cable' | 'conduit'
  | 'gate' | 'elevator' | 'sensor' | 'rack' | 'controller' | 'recorder';

export type ProductSubcategory =
  | 'bullet' | 'dome' | 'ptz' | 'multisensor' | 'fisheye' | 'thermal' | 'lpr' | 'body'
  | 'mobile-cred' | 'card-reader' | 'biometric' | 'keypad'
  | 'strike' | 'maglock' | 'rex' | 'exit-device' | 'contact'
  | 'switch' | 'poe-switch' | 'firewall' | 'access-point' | 'bridge' | 'router'
  | 'ups' | 'psu' | 'surge' | 'solar'
  | 'cat6' | 'cat6a' | 'fiber-sm' | 'fiber-mm' | 'composite' | '18-2' | '18-4' | '22-6'
  | 'speaker-wire' | 'fire-alarm' | 'coax' | 'osp' | 'conduit-emt'
  | 'controller' | 'nvr' | 'server' | 'vms'
  | 'panel' | 'siren' | 'glass-break' | 'motion' | 'smoke' | 'thermal-sensor'
  | 'audio-amp' | 'paging' | 'horn' | 'mic';

export interface ProductMountType {
  /** Mounting surface for this product. */
  surface: 'wall' | 'ceiling' | 'pendant' | 'corner' | 'pole' | 'in-rack' | 'door-mullion' | 'door-frame' | 'in-conduit';
}

export interface Product {
  id: string;
  manufacturer: string;
  productLine?: string;
  model: string;
  category: ProductCategory;
  subcategory?: ProductSubcategory;
  /** Maps to the canvas device type so the InsertDock can offer it. */
  deviceType?: DeviceType;
  /** Tech-model fit. A cloud-first product like Verkada belongs in cloud
   *  + hybrid projects. An on-prem-only Avigilon goes on-prem + hybrid. */
  techModels: ProjectTechModel[];
  /** Source country / hardware compliance flags. */
  onvifProfile?: 'S' | 'T' | 'G' | 'M' | 'A' | 'C' | 'Q';
  ndaa?: boolean;
  /** PoE class (802.3af = 1, at = 2, bt = 3/4). Undefined = not PoE-powered. */
  poeClass?: 1 | 2 | 3 | 4;
  /** Typical max power draw in watts. */
  powerW?: number;
  /** Camera-only specs. */
  resolution?: '720p' | '1080p' | '4MP' | '5MP' | '8MP' | '4K' | '8K' | '12MP' | 'multi-sensor';
  lensMm?: string;
  /** Allowed mount surfaces. */
  mounts?: ProductMountType['surface'][];
  /** Sibling products that work together (e.g. a reader's compatible
   *  controller). */
  accessoryIds?: string[];
  /** Indicative pricing. Real BOM should override per-customer. */
  msrp?: number;
  costEst?: number;
  laborUnits?: number;
  warrantyYears?: number;
  datasheetUrl?: string;
  /** Notes for the estimator / engineer. */
  notes?: string;
}

/** The catalog. Sample only — labeled accordingly in the UI. */
export const SAMPLE_PRODUCTS: Product[] = [
  // ── Cameras ─────────────────────────────────────────────────────
  // Cloud-first ecosystems
  { id: 'verkada-cb52-te',  manufacturer: 'Verkada',   productLine: 'CB Series',  model: 'CB52-TE',
    category: 'camera', subcategory: 'bullet', deviceType: 'cam.bullet',
    techModels: ['cloud', 'hybrid'], ndaa: true, poeClass: 2, powerW: 13,
    resolution: '5MP', lensMm: '2.4mm', mounts: ['wall', 'pole'], warrantyYears: 10,
    notes: 'Cloud-managed, 30-day retention onboard.' },
  { id: 'verkada-cd42',     manufacturer: 'Verkada',   productLine: 'CD Series',  model: 'CD42',
    category: 'camera', subcategory: 'dome', deviceType: 'cam.dome',
    techModels: ['cloud', 'hybrid'], ndaa: true, poeClass: 2, powerW: 12,
    resolution: '5MP', lensMm: '3.5–10mm', mounts: ['ceiling', 'wall'], warrantyYears: 10 },
  { id: 'rhombus-r170',     manufacturer: 'Rhombus',                              model: 'R170',
    category: 'camera', subcategory: 'dome', deviceType: 'cam.dome',
    techModels: ['cloud', 'hybrid'], ndaa: true, poeClass: 2, powerW: 12,
    resolution: '5MP', mounts: ['ceiling', 'wall'] },
  { id: 'meraki-mv63',      manufacturer: 'Cisco',     productLine: 'Meraki MV',  model: 'MV63',
    category: 'camera', subcategory: 'dome', deviceType: 'cam.dome',
    techModels: ['cloud', 'hybrid'], ndaa: true, poeClass: 2, powerW: 13,
    resolution: '4K', mounts: ['ceiling', 'wall'] },

  // On-prem / VMS-driven ecosystems
  { id: 'axis-p1468-le',    manufacturer: 'Axis',      productLine: 'P14',        model: 'P1468-LE',
    category: 'camera', subcategory: 'bullet', deviceType: 'cam.bullet',
    techModels: ['on_prem', 'hybrid'], onvifProfile: 'S', ndaa: true,
    poeClass: 2, powerW: 12, resolution: '8MP', lensMm: '3.4–8.9mm',
    mounts: ['wall', 'pole'], warrantyYears: 5 },
  { id: 'axis-p3265-lv',    manufacturer: 'Axis',      productLine: 'P32',        model: 'P3265-LV',
    category: 'camera', subcategory: 'dome', deviceType: 'cam.dome',
    techModels: ['on_prem', 'hybrid'], onvifProfile: 'S', ndaa: true,
    poeClass: 2, powerW: 9, resolution: '4MP', mounts: ['ceiling'] },
  { id: 'axis-p3827-pve',   manufacturer: 'Axis',      productLine: 'P38',        model: 'P3827-PVE',
    category: 'camera', subcategory: 'multisensor', deviceType: 'cam.multisensor',
    techModels: ['on_prem', 'hybrid'], onvifProfile: 'S', ndaa: true,
    poeClass: 3, powerW: 25, resolution: 'multi-sensor', mounts: ['ceiling', 'pendant'],
    notes: '4× 5MP sensors, 360° panoramic.' },
  { id: 'axis-q6315-le',    manufacturer: 'Axis',      productLine: 'Q63',        model: 'Q6315-LE',
    category: 'camera', subcategory: 'ptz', deviceType: 'cam.ptz',
    techModels: ['on_prem', 'hybrid'], onvifProfile: 'S', ndaa: true,
    poeClass: 4, powerW: 60, resolution: '1080p', mounts: ['wall', 'pole'] },
  { id: 'axis-m4327-p',     manufacturer: 'Axis',      productLine: 'M43',        model: 'M4327-P',
    category: 'camera', subcategory: 'fisheye', deviceType: 'cam.fisheye',
    techModels: ['on_prem', 'hybrid'], onvifProfile: 'S', ndaa: true,
    poeClass: 2, powerW: 9, resolution: '6MP', mounts: ['ceiling'] },
  { id: 'hanwha-pno-a9081r',manufacturer: 'Hanwha',    productLine: 'Wisenet A',  model: 'PNO-A9081R',
    category: 'camera', subcategory: 'bullet', deviceType: 'cam.bullet',
    techModels: ['on_prem', 'hybrid'], onvifProfile: 'S', ndaa: true,
    poeClass: 2, powerW: 13, resolution: '8MP', mounts: ['wall', 'pole'] },
  { id: 'avigilon-h6a-b1',  manufacturer: 'Avigilon',  productLine: 'H6A',        model: 'H6A-B1',
    category: 'camera', subcategory: 'bullet', deviceType: 'cam.bullet',
    techModels: ['on_prem', 'hybrid'], onvifProfile: 'S', ndaa: true,
    poeClass: 2, powerW: 12, resolution: '8MP', mounts: ['wall'] },
  { id: 'bosch-nbe-7702-al',manufacturer: 'Bosch',     productLine: 'Flexidome',  model: 'NBE-7702-AL',
    category: 'camera', subcategory: 'dome', deviceType: 'cam.dome',
    techModels: ['on_prem', 'hybrid'], onvifProfile: 'S', poeClass: 3, powerW: 12.95,
    resolution: '4MP', mounts: ['ceiling', 'wall'] },

  // ── Access control ──────────────────────────────────────────────
  { id: 'hid-signo-20',     manufacturer: 'HID',       productLine: 'Signo',      model: '20',
    category: 'reader', subcategory: 'card-reader', deviceType: 'acc.reader',
    techModels: ['cloud', 'on_prem', 'hybrid'], poeClass: 1, powerW: 3,
    mounts: ['door-mullion'], notes: 'OSDP v2 + Bluetooth/NFC mobile credentials.' },
  { id: 'hid-signo-40',     manufacturer: 'HID',       productLine: 'Signo',      model: '40',
    category: 'reader', subcategory: 'card-reader', deviceType: 'acc.reader',
    techModels: ['cloud', 'on_prem', 'hybrid'], powerW: 3, mounts: ['wall', 'door-frame'] },
  { id: 'openpath-r6',      manufacturer: 'Avigilon Alta', productLine: 'Openpath', model: 'R6',
    category: 'reader', subcategory: 'mobile-cred', deviceType: 'acc.reader',
    techModels: ['cloud', 'hybrid'], poeClass: 1, powerW: 3,
    mounts: ['wall', 'door-mullion'], notes: 'Cloud-managed; multi-credential.' },
  { id: 'brivo-rd-300',     manufacturer: 'Brivo',                                model: 'RD-300',
    category: 'reader', subcategory: 'card-reader', deviceType: 'acc.reader',
    techModels: ['cloud', 'hybrid'], powerW: 3, mounts: ['door-mullion'] },
  { id: 'mercury-mp4502',   manufacturer: 'Mercury',                              model: 'MP-4502',
    category: 'controller', subcategory: 'controller',
    techModels: ['on_prem', 'hybrid'], powerW: 8,
    notes: 'Intelligent door controller. Pairs with LenelS2 / Genetec / Brivo head-ends.' },
  { id: 'lenel-1320',       manufacturer: 'LenelS2',   productLine: 'NetBox',     model: 'LNL-1320',
    category: 'controller', subcategory: 'controller',
    techModels: ['on_prem'], notes: 'Two-door controller; OEM Mercury hardware.' },

  // Locks & door hardware
  { id: 'vd-6210',          manufacturer: 'Adams Rite',                           model: '6210',
    category: 'lock', subcategory: 'strike', deviceType: 'acc.strike',
    techModels: ['cloud', 'on_prem', 'hybrid'], powerW: 5, mounts: ['door-frame'],
    notes: 'Electric strike for cylindrical locksets.' },
  { id: 'hes-9600',         manufacturer: 'HES',                                  model: '9600',
    category: 'lock', subcategory: 'strike', deviceType: 'acc.strike',
    techModels: ['cloud', 'on_prem', 'hybrid'], powerW: 4, mounts: ['door-frame'],
    notes: 'ANSI-format strike. Universal mounting.' },
  { id: 'securitron-m32',   manufacturer: 'Securitron',                           model: 'M32',
    category: 'lock', subcategory: 'maglock', deviceType: 'acc.maglock',
    techModels: ['cloud', 'on_prem', 'hybrid'], powerW: 8, mounts: ['door-frame'],
    notes: '1,200 lb holding force. Fire-egress: REX required.' },
  { id: 'von-duprin-99',    manufacturer: 'Von Duprin',                           model: '99',
    category: 'lock', subcategory: 'exit-device', deviceType: 'acc.exit',
    techModels: ['cloud', 'on_prem', 'hybrid'], mounts: ['door-frame'],
    notes: 'Crash bar. Pair with EL/QEL for electric latch retraction.' },
  { id: 'schlage-l9080',    manufacturer: 'Schlage',                              model: 'L9080',
    category: 'lock', subcategory: 'exit-device',
    techModels: ['cloud', 'on_prem', 'hybrid'], mounts: ['door-frame'] },

  // Intercoms
  { id: 'aiphone-ix-mv7',   manufacturer: 'Aiphone',   productLine: 'IX Series',  model: 'IX-MV7',
    category: 'intercom', deviceType: 'aud.intercom',
    techModels: ['on_prem', 'hybrid'], poeClass: 2, powerW: 10, mounts: ['wall'] },
  { id: '2n-axis-i6020',    manufacturer: '2N',                                   model: 'IP Verso Door',
    category: 'intercom', deviceType: 'aud.intercom',
    techModels: ['cloud', 'on_prem', 'hybrid'], poeClass: 2, powerW: 12 },

  // ── Networking ──────────────────────────────────────────────────
  { id: 'cisco-c9300-48p',  manufacturer: 'Cisco',     productLine: 'Catalyst 9300', model: 'C9300-48P',
    category: 'network', subcategory: 'poe-switch', deviceType: 'net.switch',
    techModels: ['on_prem', 'hybrid'], powerW: 740, mounts: ['in-rack'],
    notes: '48× PoE+, 740W PoE budget.' },
  { id: 'aruba-2930f-24p',  manufacturer: 'Aruba',     productLine: '2930F',      model: '2930F-24G-PoE+',
    category: 'network', subcategory: 'poe-switch', deviceType: 'net.switch',
    techModels: ['on_prem', 'hybrid'], powerW: 370, mounts: ['in-rack'] },
  { id: 'meraki-ms250-24p', manufacturer: 'Cisco',     productLine: 'Meraki MS',  model: 'MS250-24P',
    category: 'network', subcategory: 'poe-switch', deviceType: 'net.switch',
    techModels: ['cloud', 'hybrid'], powerW: 370, mounts: ['in-rack'] },
  { id: 'ubiquiti-usw-pro-48-poe', manufacturer: 'Ubiquiti', productLine: 'UniFi', model: 'USW Pro 48 PoE',
    category: 'network', subcategory: 'poe-switch', deviceType: 'net.switch',
    techModels: ['cloud', 'on_prem', 'hybrid'], powerW: 600, mounts: ['in-rack'] },
  { id: 'cisco-meraki-mr46',manufacturer: 'Cisco',     productLine: 'Meraki MR',  model: 'MR46',
    category: 'network', subcategory: 'access-point', deviceType: 'net.ap',
    techModels: ['cloud', 'hybrid'], poeClass: 3, powerW: 25, mounts: ['ceiling'] },

  // ── Power ───────────────────────────────────────────────────────
  { id: 'apc-srt-2200',     manufacturer: 'APC',       productLine: 'Smart-UPS',  model: 'SRT2200',
    category: 'power', subcategory: 'ups', deviceType: 'pwr.ups',
    techModels: ['cloud', 'on_prem', 'hybrid'], powerW: 2200, mounts: ['in-rack'] },
  { id: 'altronix-eflow6n', manufacturer: 'Altronix',                             model: 'eFlow6N',
    category: 'power', subcategory: 'psu',
    techModels: ['cloud', 'on_prem', 'hybrid'], powerW: 144, mounts: ['wall'],
    notes: '6A access-control power supply.' },
  { id: 'lifesafety-fpo250',manufacturer: 'LifeSafety Power', productLine: 'FlexPower', model: 'FPO250',
    category: 'power', subcategory: 'psu',
    techModels: ['on_prem', 'hybrid'], powerW: 250, mounts: ['wall'] },

  // ── Cable / wire ────────────────────────────────────────────────
  { id: 'cable-cat6a-belden', manufacturer: 'Belden', model: '10GX',
    category: 'cable', subcategory: 'cat6a',
    techModels: ['cloud', 'on_prem', 'hybrid'],
    notes: 'Cat6A UTP for IP cameras + APs.' },
  { id: 'cable-cat6-panduit', manufacturer: 'Panduit', model: 'TX6',
    category: 'cable', subcategory: 'cat6',
    techModels: ['cloud', 'on_prem', 'hybrid'] },
  { id: 'cable-fiber-corning-sm', manufacturer: 'Corning', model: 'SMF-28e+',
    category: 'cable', subcategory: 'fiber-sm',
    techModels: ['on_prem', 'hybrid'], notes: 'Single-mode fiber for inter-IDF runs.' },
  { id: 'cable-composite-acc', manufacturer: 'Belden', model: 'Composite Access',
    category: 'cable', subcategory: 'composite',
    techModels: ['cloud', 'on_prem', 'hybrid'], notes: '22/4 + 18/2 + 22/6 composite.' },
];

/** Filter the catalog by a project's tech model. Hybrid returns everything. */
export function productsFor(model: ProjectTechModel): Product[] {
  if (model === 'hybrid') return SAMPLE_PRODUCTS;
  return SAMPLE_PRODUCTS.filter((p) => p.techModels.includes(model));
}

/** Pick products that map to a particular canvas device type. */
export function productsForDeviceType(type: DeviceType, model?: ProjectTechModel): Product[] {
  const base = SAMPLE_PRODUCTS.filter((p) => p.deviceType === type);
  if (!model || model === 'hybrid') return base;
  return base.filter((p) => p.techModels.includes(model));
}

/** True if this product is recommended for the project's tech model. */
export function isRecommended(product: Product, model: ProjectTechModel): boolean {
  if (model === 'hybrid') return true;
  return product.techModels.includes(model);
}
