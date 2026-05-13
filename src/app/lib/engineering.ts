// Deeper Vision — engineering domain types & calculations.
// Single source of truth for canvas objects, DORI math, compatibility rules,
// and live BOM aggregation. Pure functions, no React.

export type Vec2 = { x: number; y: number };

export type ObjectKind =
  | 'camera'
  | 'multisensor'
  | 'door'
  | 'idf'
  | 'pathway'
  | 'target'
  | 'annotation';

export interface BaseObject {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  locked?: boolean;
  label?: string;
  idfId?: string;
}

export interface CameraObj extends BaseObject {
  kind: 'camera';
  manufacturer: string;
  model: string;
  mount: 'wall' | 'ceiling' | 'pole' | 'corner';
  mountHeight: number; // ft
  focalLength: number; // mm
  fov: number; // degrees
  range: number; // ft (max detect)
  rotation: number; // deg
  ndaa: boolean;
  poeW: number;
  bandwidthMbps: number;
  ir: boolean;
}

export interface MultisensorObj extends BaseObject {
  kind: 'multisensor';
  manufacturer: string;
  model: string;
  mountHeight: number;
  poeW: number;
  bandwidthMbps: number;
  lenses: LensConfig[]; // typically 4
  linked: boolean;
}

export interface LensConfig {
  id: string;
  rotation: number;
  fov: number;
  range: number;
  focalLength: number;
  color: string;
}

export type HardwareKind =
  | 'reader'
  | 'strike'
  | 'maglock'
  | 'rex'
  | 'contact'
  | 'intercom'
  | 'panic'
  | 'autoop'
  | 'controller'
  | 'psu';

export interface DoorObj extends BaseObject {
  kind: 'door';
  doorType: 'single' | 'double' | 'storefront' | 'gate' | 'rollup' | 'elevator' | 'stairwell';
  material: 'wood' | 'hollow-metal' | 'aluminum' | 'glass';
  rotation: number;
  fireRated: boolean;
  ada: boolean;
  hardware: HardwareKind[];
}

export interface IdfObj extends BaseObject {
  kind: 'idf';
  name: string;
  poeBudget: number;
  ports: number;
  usedPorts: number;
  upsMinutes: number;
}

export interface PathwayObj extends BaseObject {
  kind: 'pathway';
  points: Vec2[];
  pathType: 'conduit' | 'tray' | 'jhook' | 'underground' | 'freeair';
  diameterIn: number;
}

export interface TargetObj extends BaseObject {
  kind: 'target';
  variant: 'person' | 'vehicle';
  mode: 'day' | 'lowlux' | 'ir';
}

export type CanvasObject =
  | CameraObj
  | MultisensorObj
  | DoorObj
  | IdfObj
  | PathwayObj
  | TargetObj;

// ---------- DORI math ----------
// pxPerFt approximated from focal length × sensor model. For visualization we
// derive zone radii as fractions of total range using industry rule-of-thumb.
export interface DoriZones {
  detect: number;
  observe: number;
  recognize: number;
  identify: number;
}

export function doriFor(range: number): DoriZones {
  return {
    detect: range,
    observe: range * 0.5,
    recognize: range * 0.25,
    identify: range * 0.125,
  };
}

export function pxPerFtAt(distanceFt: number, focalMm: number): number {
  // Toy formula: pxPerFt ∝ focal / distance. Good enough for live preview.
  if (distanceFt <= 0) return 9999;
  return (focalMm * 80) / distanceFt;
}

export function clarityLabel(pxFt: number): 'identify' | 'recognize' | 'observe' | 'detect' | 'none' {
  if (pxFt >= 250) return 'identify';
  if (pxFt >= 125) return 'recognize';
  if (pxFt >= 63) return 'observe';
  if (pxFt >= 25) return 'detect';
  return 'none';
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Returns whether point p is inside an FOV cone originating at origin with
// rotation (deg, 0 = +x) and fov (deg), within range (px).
export function pointInCone(p: Vec2, origin: Vec2, rotationDeg: number, fovDeg: number, rangePx: number): boolean {
  const d = distance(p, origin);
  if (d > rangePx || d < 1) return false;
  const ang = (Math.atan2(p.y - origin.y, p.x - origin.x) * 180) / Math.PI;
  let delta = ang - rotationDeg;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return Math.abs(delta) <= fovDeg / 2;
}

// ---------- Compatibility engine ----------
export interface EngineeringWarning {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  fix?: string;
  objectIds: string[];
}

export function analyzeWarnings(objects: CanvasObject[]): EngineeringWarning[] {
  const out: EngineeringWarning[] = [];
  for (const o of objects) {
    if (o.kind === 'door') {
      const hw = o.hardware;
      const hasMag = hw.includes('maglock');
      const hasRex = hw.includes('rex');
      const hasReader = hw.includes('reader');
      const hasIntercom = hw.includes('intercom');
      const hasController = hw.includes('controller');
      const hasPsu = hw.includes('psu');
      if (hasMag && !hasRex) {
        out.push({ id: `${o.id}-rex`, severity: 'critical', message: `${o.label || 'Door'}: maglock requires REX`, fix: 'Add REX', objectIds: [o.id] });
      }
      if (hasMag && !o.fireRated) {
        out.push({ id: `${o.id}-fire`, severity: 'warning', message: `${o.label || 'Door'}: maglock should tie to fire release`, fix: 'Link fire alarm', objectIds: [o.id] });
      }
      if (hasIntercom && hasReader) {
        out.push({ id: `${o.id}-dup`, severity: 'warning', message: `${o.label || 'Door'}: intercom already provides reader`, fix: 'Remove dedicated reader', objectIds: [o.id] });
      }
      if ((hasMag || hw.includes('strike')) && !hasController) {
        out.push({ id: `${o.id}-ctrl`, severity: 'critical', message: `${o.label || 'Door'}: missing access controller`, fix: 'Assign controller', objectIds: [o.id] });
      }
      if ((hasMag || hw.includes('strike')) && !hasPsu) {
        out.push({ id: `${o.id}-psu`, severity: 'warning', message: `${o.label || 'Door'}: no power supply assigned`, fix: 'Add PSU', objectIds: [o.id] });
      }
    }
    if ((o.kind === 'camera' || o.kind === 'multisensor') && !o.idfId) {
      out.push({ id: `${o.id}-idf`, severity: 'warning', message: `${o.label || o.kind}: no IDF assigned`, fix: 'Assign IDF', objectIds: [o.id] });
    }
  }
  return out;
}

// ---------- BOM ----------
export interface BomLine {
  sku: string;
  description: string;
  qty: number;
  unit: number;
  category: 'camera' | 'access' | 'network' | 'cable' | 'labor' | 'other';
  objectId?: string;
}

const HW_SKU: Record<HardwareKind, { sku: string; desc: string; price: number }> = {
  reader: { sku: 'HID-SIG20', desc: 'HID Signo 20 reader', price: 340 },
  strike: { sku: 'HES-9600', desc: 'HES 9600 electric strike', price: 410 },
  maglock: { sku: 'SCH-M62', desc: 'Schlage M62 maglock 1200lb', price: 290 },
  rex: { sku: 'BEA-IXU', desc: 'BEA IXU REX sensor', price: 180 },
  contact: { sku: 'GRI-180', desc: 'GRI 180 door contact', price: 25 },
  intercom: { sku: '2N-IPV-3', desc: '2N IP Verso intercom', price: 1450 },
  panic: { sku: 'VON-99', desc: 'Von Duprin 99 panic device', price: 1100 },
  autoop: { sku: 'LCN-4642', desc: 'LCN 4642 auto operator', price: 2400 },
  controller: { sku: 'MER-MP1502', desc: 'Mercury MP1502 controller', price: 1850 },
  psu: { sku: 'LFR-FPO75', desc: 'LifeSafety FPO75 power supply', price: 520 },
};

export function buildBom(objects: CanvasObject[], scaleFtPerPx: number): BomLine[] {
  const lines: BomLine[] = [];
  for (const o of objects) {
    if (o.kind === 'camera') {
      lines.push({ sku: o.model, description: `${o.manufacturer} ${o.model}`, qty: 1, unit: 720, category: 'camera', objectId: o.id });
    }
    if (o.kind === 'multisensor') {
      lines.push({ sku: o.model, description: `${o.manufacturer} ${o.model} (multisensor)`, qty: 1, unit: 1850, category: 'camera', objectId: o.id });
    }
    if (o.kind === 'door') {
      for (const h of o.hardware) {
        const s = HW_SKU[h];
        lines.push({ sku: s.sku, description: s.desc, qty: 1, unit: s.price, category: 'access', objectId: o.id });
      }
    }
    if (o.kind === 'idf') {
      lines.push({ sku: 'RACK-42U', desc: '42U enclosed rack', qty: 1, unit: 1200, category: 'network', objectId: o.id } as any);
    }
    if (o.kind === 'pathway') {
      const len = pathwayLengthFt(o, scaleFtPerPx);
      const per = o.pathType === 'conduit' ? 4.2 : o.pathType === 'tray' ? 6.5 : 1.1;
      lines.push({
        sku: o.pathType.toUpperCase(),
        description: `${o.pathType} pathway`,
        qty: Math.round(len),
        unit: per,
        category: 'cable',
        objectId: o.id,
      });
    }
  }
  // simple labor roll-up
  const cameras = objects.filter((o) => o.kind === 'camera' || o.kind === 'multisensor').length;
  const doors = objects.filter((o) => o.kind === 'door').length;
  if (cameras + doors > 0) {
    lines.push({
      sku: 'LBR-INSTALL',
      description: 'Installation labor',
      qty: cameras * 4 + doors * 8,
      unit: 95,
      category: 'labor',
    });
  }
  return lines;
}

export function pathwayLengthFt(p: PathwayObj, scaleFtPerPx: number): number {
  let px = 0;
  for (let i = 1; i < p.points.length; i++) {
    px += distance(p.points[i - 1], p.points[i]);
  }
  return px * scaleFtPerPx;
}

export function poeUsage(objects: CanvasObject[]): { used: number; budget: number } {
  let used = 0;
  let budget = 0;
  for (const o of objects) {
    if (o.kind === 'camera') used += o.poeW;
    if (o.kind === 'multisensor') used += o.poeW;
    if (o.kind === 'idf') budget += o.poeBudget;
  }
  return { used, budget: budget || 370 };
}

export const LENS_COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B'];

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
