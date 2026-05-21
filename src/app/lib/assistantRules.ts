// DV Assist Phase 1 — validation rules engine.
//
// Each rule is a pure function over store state that returns a list of
// real findings. Findings reference real object ids; suggested fixes
// map to real Action-mode mutations (DVA.6). When the data a rule
// would consume is unknown, the rule stays silent rather than guessing.
// That keeps the engine honest until the Data Hub lands.
//
// Read this with `docs/DV_ASSIST_PHASE1.md` in hand — that doc spells
// out the helper layer contract this file depends on.

import type { Device, Pathway, Room, Floor, DeviceType } from '../store/types';
import {
  productById,
  requiresLicense as productRequiresLicense,
  defaultLicenseFor,
  licensesFor,
  mountsForDeviceType,
  recommendedMountFor,
  switchPortCount,
  switchPoeBudget,
  poeDrawWatts,
  maxCableRunFor,
  accessoriesFor,
  type Product,
} from './productCatalog';
import { pathwayLengthFt } from './engineering';

// ────────────────────────────── Types ───────────────────────────────

export type FindingSeverity = 'info' | 'warn' | 'critical';

export type FindingCategory =
  | 'license'   | 'mount'    | 'environment' | 'power'
  | 'capacity'  | 'pathway'  | 'distance'    | 'coverage'
  | 'topology';

export type ObjectKind = 'device' | 'pathway' | 'floor' | 'room';

export interface ObjectRef {
  kind: ObjectKind;
  id: string;
}

export type SuggestedFix =
  | { kind: 'add-accessory'; deviceId: string; productId: string; label: string }
  | { kind: 'add-license';   deviceId: string; productId: string; label: string }
  | { kind: 'add-mount';     deviceId: string; productId: string; label: string }
  | { kind: 'select-and-edit'; objectId: string; objectKind: ObjectKind; label: string };

export interface Finding {
  /** Stable id so the panel can identify findings across runs. */
  id: string;
  /** Rule id — one per rule function below. Used for grouping in the
   *  Final Design Review (DVA.8). */
  ruleId: RuleId;
  severity: FindingSeverity;
  category: FindingCategory;
  objectRef: ObjectRef;
  /** Short headline, "subject + verb + object" voice. */
  title: string;
  /** One or two sentence plain language explanation. */
  description: string;
  /** When a real fix path exists, this drives the Action-mode picker.
   *  Undefined when the operator must resolve manually. */
  suggestedFix?: SuggestedFix;
}

export type RuleId =
  | 'missing-license'
  | 'missing-mount'
  | 'exterior-in-interior'
  | 'switch-poe-budget'
  | 'switch-port-overload'
  | 'pathway-missing-conduit'
  | 'cable-run-too-long'
  | 'floor-coverage-gap'
  | 'device-no-network-closet';

export interface RuleContext {
  devices: Device[];
  pathways: Pathway[];
  rooms: Room[];
  floors: Floor[];
}

// ────────────────────────────── Helpers ─────────────────────────────

function isCamera(t: DeviceType): boolean {
  return t.startsWith('cam.');
}
function isSwitch(t: DeviceType): boolean {
  return t === 'net.switch';
}
function isClosetHost(t: DeviceType): boolean {
  return t === 'net.idf' || t === 'net.mdf' || t === 'inf.mdf' || t === 'inf.rack';
}
function isPoeConsumer(t: DeviceType): boolean {
  // Cameras, APs, readers, IP intercoms — anything that draws PoE in
  // typical deployments.
  return isCamera(t)
      || t === 'net.ap'
      || t === 'acc.reader'
      || t === 'acc.intercom'
      || t === 'aud.intercom';
}

/** Floor a device belongs to. */
function floorOf(d: Device, floors: Floor[]): Floor | undefined {
  return floors.find((f) => f.id === d.floorId);
}

/** Room the device's center point sits inside, if any. */
function roomOf(d: Device, rooms: Room[]): Room | undefined {
  return rooms.find((r) => r.floorId === d.floorId && pointInPolygon({ x: d.x, y: d.y }, r.polygon));
}

function pointInPolygon(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const intersect = ((a.y > p.y) !== (b.y > p.y))
      && (p.x < ((b.x - a.x) * (p.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** True when a device has a license SKU in its accessories list whose
 *  product matches one of the licenses that covers this device. */
function hasMatchingLicense(d: Device, host: Product): boolean {
  if (!d.accessories?.length) return false;
  const valid = new Set(licensesFor(host).map((lic) => lic.id));
  return d.accessories.some((id) => valid.has(id));
}

/** True when a device has at least one accessory tagged as a mount
 *  product targeting its device type. */
function hasMatchingMount(d: Device, host: Product): boolean {
  if (!d.accessories?.length) return false;
  const validMountIds = new Set(
    mountsForDeviceType(d.type)
      .filter((m) => host.compatibleAccessories?.includes(m.id))
      .map((m) => m.id),
  );
  if (validMountIds.size === 0) return false;
  return d.accessories.some((id) => validMountIds.has(id));
}

/** Pathway endpoints — `sourceId`, `destinationId`, `targetId`. */
function pathwayEndpoints(p: Pathway): string[] {
  return [p.sourceId, p.destinationId, p.targetId].filter((x): x is string => !!x);
}

/** Devices physically connected to the given network closet host (IDF
 *  / MDF / rack) via a pathway with that closet as one endpoint. */
function devicesOnCloset(closet: Device, ctx: RuleContext): Device[] {
  const linked = new Set<string>();
  for (const pw of ctx.pathways) {
    const ends = pathwayEndpoints(pw);
    if (!ends.includes(closet.id)) continue;
    for (const eid of ends) {
      if (eid !== closet.id) linked.add(eid);
    }
  }
  return ctx.devices.filter((d) => linked.has(d.id));
}

/** Devices physically connected to the given switch via a pathway. */
function devicesOnSwitch(sw: Device, ctx: RuleContext): Device[] {
  return devicesOnCloset(sw, ctx); // identical graph walk
}

/** Does this device have any pathway to a network closet host? */
function hasClosetLink(d: Device, ctx: RuleContext): boolean {
  for (const pw of ctx.pathways) {
    const ends = pathwayEndpoints(pw);
    if (!ends.includes(d.id)) continue;
    for (const eid of ends) {
      if (eid === d.id) continue;
      const peer = ctx.devices.find((x) => x.id === eid);
      if (peer && isClosetHost(peer.type)) return true;
    }
  }
  // Also accept a direct linkedIds reference to a closet host.
  if (d.linkedIds?.length) {
    for (const eid of d.linkedIds) {
      const peer = ctx.devices.find((x) => x.id === eid);
      if (peer && isClosetHost(peer.type)) return true;
    }
  }
  return false;
}

// ────────────────────────────── Rules ───────────────────────────────

/** Rule 1 — Camera or device placed without a required license. */
export function ruleMissingLicense(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const d of ctx.devices) {
    const host = productById(d.product);
    if (!host || !productRequiresLicense(host)) continue;
    if (hasMatchingLicense(d, host)) continue;
    const def = defaultLicenseFor(host);
    out.push({
      id: `missing-license:${d.id}`,
      ruleId: 'missing-license',
      severity: 'warn',
      category: 'license',
      objectRef: { kind: 'device', id: d.id },
      title: `${d.label || host.model} needs a VMS license`,
      description: `${host.manufacturer} ${host.model} requires a separate license SKU to record. ${def ? `Recommended: ${def.manufacturer} ${def.model}.` : 'No default license tagged for this product.'}`,
      suggestedFix: def
        ? { kind: 'add-license', deviceId: d.id, productId: def.id, label: `Add ${def.manufacturer} ${def.model}` }
        : undefined,
    });
  }
  return out;
}

/** Rule 2 — Device placed without a recommended mount. */
export function ruleMissingMount(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const d of ctx.devices) {
    const host = productById(d.product);
    if (!host) continue;
    // Only cameras + readers + APs reasonably need a mount accessory.
    // Skip infrastructure / sensors / cable accessories.
    if (!isPoeConsumer(d.type)) continue;
    // Skip if the host vendor declared no mount accessories — the
    // catalog can't suggest a fix we don't have a product for.
    if (!host.compatibleAccessories?.length) continue;
    // Skip if no mount accessory in the catalog targets this device type.
    const mountsForType = mountsForDeviceType(d.type);
    const validMountIds = new Set(mountsForType.map((m) => m.id));
    const hostValidMounts = (host.compatibleAccessories ?? []).filter((id) => validMountIds.has(id));
    if (hostValidMounts.length === 0) continue;
    if (hasMatchingMount(d, host)) continue;
    const rec = recommendedMountFor(host);
    out.push({
      id: `missing-mount:${d.id}`,
      ruleId: 'missing-mount',
      severity: 'info',
      category: 'mount',
      objectRef: { kind: 'device', id: d.id },
      title: `${d.label || host.model} has no mount accessory`,
      description: `No mount product from ${host.manufacturer}'s compatible list is attached. ${rec ? `Recommended: ${rec.manufacturer} ${rec.model}.` : ''}`,
      suggestedFix: rec
        ? { kind: 'add-mount', deviceId: d.id, productId: rec.id, label: `Add ${rec.manufacturer} ${rec.model}` }
        : undefined,
    });
  }
  return out;
}

/** Rule 3 — Exterior-rated product in an interior area. Fires only
 *  when both the product environment and the room environment are
 *  known. Unknown room environment = silent. */
export function ruleExteriorInInterior(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const d of ctx.devices) {
    const host = productById(d.product);
    if (!host) continue;
    if (host.indoorOutdoor !== 'outdoor') continue; // 'both' / 'indoor' / undefined: silent
    const room = roomOf(d, ctx.rooms);
    if (!room) continue;
    const env = room.environment;
    if (env !== 'indoor') continue; // 'outdoor' / 'unknown' / undefined: silent
    out.push({
      id: `exterior-in-interior:${d.id}`,
      ruleId: 'exterior-in-interior',
      severity: 'warn',
      category: 'environment',
      objectRef: { kind: 'device', id: d.id },
      title: `${host.model} is exterior rated but sits in an indoor room`,
      description: `${host.manufacturer} ${host.model} is sold for outdoor deployment (${host.ipRating ?? 'IP rated'}). Room "${room.name}" is tagged indoor. Either move the device outside, swap to an indoor SKU, or retag the room.`,
      suggestedFix: { kind: 'select-and-edit', objectId: d.id, objectKind: 'device', label: 'Open device drawer' },
    });
  }
  return out;
}

/** Rule 4 — PoE device on a switch without enough power budget. */
export function ruleSwitchPoeBudget(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const sw of ctx.devices) {
    if (!isSwitch(sw.type)) continue;
    const swProd = productById(sw.product);
    if (!swProd) continue;
    const budget = switchPoeBudget(swProd);
    if (typeof budget !== 'number') continue; // unknown budget = silent
    const linked = devicesOnSwitch(sw, ctx);
    let sum = 0;
    let countedAny = false;
    for (const d of linked) {
      if (!isPoeConsumer(d.type)) continue;
      const prod = productById(d.product);
      if (!prod) continue;
      const draw = poeDrawWatts(prod);
      if (typeof draw !== 'number') continue; // unknown draw = skip (NOT zero)
      sum += draw;
      countedAny = true;
    }
    if (!countedAny) continue;
    if (sum <= budget) continue;
    out.push({
      id: `switch-poe-budget:${sw.id}`,
      ruleId: 'switch-poe-budget',
      severity: 'critical',
      category: 'power',
      objectRef: { kind: 'device', id: sw.id },
      title: `${sw.label || swProd.model} is over PoE budget`,
      description: `${swProd.manufacturer} ${swProd.model} carries a ${budget}W PoE budget. Connected devices draw ${Math.round(sum)}W. Move ${Math.ceil((sum - budget) / 15)} or more devices to another switch, or add a PoE injector.`,
      suggestedFix: { kind: 'select-and-edit', objectId: sw.id, objectKind: 'device', label: 'Open switch drawer' },
    });
  }
  return out;
}

/** Rule 5 — Switch overloaded (more PoE devices than PoE ports). */
export function ruleSwitchPortOverload(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const sw of ctx.devices) {
    if (!isSwitch(sw.type)) continue;
    const swProd = productById(sw.product);
    if (!swProd) continue;
    const total = switchPortCount(swProd);
    if (typeof total !== 'number') continue; // unknown = silent
    const linked = devicesOnSwitch(sw, ctx);
    const consumers = linked.filter((d) => isPoeConsumer(d.type));
    if (consumers.length <= total) continue;
    out.push({
      id: `switch-port-overload:${sw.id}`,
      ruleId: 'switch-port-overload',
      severity: 'critical',
      category: 'capacity',
      objectRef: { kind: 'device', id: sw.id },
      title: `${sw.label || swProd.model} has more devices than ports`,
      description: `${swProd.manufacturer} ${swProd.model} has ${total} ports. ${consumers.length} PoE devices are routed here. Add an access switch or move devices to a different IDF.`,
      suggestedFix: { kind: 'select-and-edit', objectId: sw.id, objectKind: 'device', label: 'Open switch drawer' },
    });
  }
  return out;
}

/** Rule 6 — Pathway missing conduit information. */
export function rulePathwayMissingConduit(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const pw of ctx.pathways) {
    // Only audit cable bundles, not standalone conduit / tray / J-hook runs.
    if (pw.pathwayKind && pw.pathwayKind !== 'cable') continue;
    // If conduit type is explicitly 'none', the operator decided no
    // conduit is required — that's a real call, not a missing field.
    if (pw.conduitType && pw.conduitType !== 'none' && pw.conduitSize) continue;
    // Skip pathways shorter than 10 ft — those are usually patch cords
    // inside a closet where conduit is not specified.
    const floor = ctx.floors.find((f) => f.id === pw.floorId);
    const lenFt = pathwayLengthFt(pw, floor);
    if (lenFt < 10) continue;
    out.push({
      id: `pathway-missing-conduit:${pw.id}`,
      ruleId: 'pathway-missing-conduit',
      severity: 'info',
      category: 'pathway',
      objectRef: { kind: 'pathway', id: pw.id },
      title: `Pathway has no conduit assigned`,
      description: `Pathway ${pw.id} carries ${pw.cableCount}× ${pw.cableType} over ${lenFt} ft with no conduit type set. Assign EMT / PVC / FMC or mark "no conduit" if surface mounted.`,
      suggestedFix: { kind: 'select-and-edit', objectId: pw.id, objectKind: 'pathway', label: 'Open pathway drawer' },
    });
  }
  return out;
}

/** Rule 7 — Cable run exceeds the product's maximum distance. */
export function ruleCableRunTooLong(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const pw of ctx.pathways) {
    if (pw.pathwayKind && pw.pathwayKind !== 'cable') continue;
    // Resolve the cable product. `pw.cableType` is a string that
    // could be a product id or a category label (e.g. "cat6a"). Try
    // product-id lookup first; fall back to scanning catalog rows
    // whose subcategory matches the label.
    const cableProd = productById(pw.cableType as string)
      ?? scanCableByCategory(pw.cableType);
    if (!cableProd) continue;
    const max = maxCableRunFor(cableProd);
    if (typeof max !== 'number') continue;
    const floor = ctx.floors.find((f) => f.id === pw.floorId);
    const lenFt = pathwayLengthFt(pw, floor);
    if (lenFt <= max) continue;
    out.push({
      id: `cable-run-too-long:${pw.id}`,
      ruleId: 'cable-run-too-long',
      severity: 'critical',
      category: 'distance',
      objectRef: { kind: 'pathway', id: pw.id },
      title: `${cableProd.subcategory ?? 'Cable'} run exceeds ${max} ft`,
      description: `Pathway ${pw.id} measures ${lenFt} ft. ${cableProd.manufacturer} ${cableProd.model} is rated for ${max} ft max. Insert a midpoint switch or convert this segment to fiber.`,
      suggestedFix: { kind: 'select-and-edit', objectId: pw.id, objectKind: 'pathway', label: 'Open pathway drawer' },
    });
  }
  return out;
}

/** Rule 8 — Floor area with incomplete coverage. Heuristic: a floor
 *  with rooms defined but no cameras whose center sits on it gets a
 *  critical finding; a floor with rooms but fewer than one camera
 *  per three rooms gets a warning. Floors with no rooms are silent
 *  (no model of expected coverage). */
export function ruleFloorCoverageGap(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const fl of ctx.floors) {
    const floorRooms = ctx.rooms.filter((r) => r.floorId === fl.id);
    if (floorRooms.length === 0) continue;
    const cams = ctx.devices.filter((d) => d.floorId === fl.id && isCamera(d.type));
    if (cams.length === 0) {
      out.push({
        id: `floor-coverage-gap:${fl.id}`,
        ruleId: 'floor-coverage-gap',
        severity: 'critical',
        category: 'coverage',
        objectRef: { kind: 'floor', id: fl.id },
        title: `${fl.name} has rooms defined but no cameras`,
        description: `${floorRooms.length} room(s) on this floor with zero cameras placed. Coverage cannot be assessed until cameras are added.`,
      });
      continue;
    }
    if (cams.length * 3 < floorRooms.length) {
      out.push({
        id: `floor-coverage-gap:${fl.id}`,
        ruleId: 'floor-coverage-gap',
        severity: 'warn',
        category: 'coverage',
        objectRef: { kind: 'floor', id: fl.id },
        title: `${fl.name} may be under covered`,
        description: `${cams.length} camera(s) for ${floorRooms.length} room(s). Heuristic flags floors with fewer than one camera per three rooms. Walk the plan to confirm.`,
      });
    }
  }
  return out;
}

/** Rule 9 — Devices with no assigned network closet. */
export function ruleDeviceNoNetworkCloset(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const d of ctx.devices) {
    // Only network-dependent devices: cameras, APs, readers, network
    // gear that itself isn't an IDF/closet.
    if (!isPoeConsumer(d.type) && d.type !== 'net.switch') continue;
    if (isClosetHost(d.type)) continue;
    if (hasClosetLink(d, ctx)) continue;
    const host = productById(d.product);
    out.push({
      id: `device-no-network-closet:${d.id}`,
      ruleId: 'device-no-network-closet',
      severity: 'warn',
      category: 'topology',
      objectRef: { kind: 'device', id: d.id },
      title: `${d.label || host?.model || d.id} has no assigned IDF`,
      description: `No pathway routes this device back to a network closet (IDF / MDF / rack). Add a pathway or set the parent IDF in the device drawer.`,
      suggestedFix: { kind: 'select-and-edit', objectId: d.id, objectKind: 'device', label: 'Open device drawer' },
    });
  }
  return out;
}

// ────────────────────────────── Aggregator ──────────────────────────

const ALL_RULES: ReadonlyArray<(ctx: RuleContext) => Finding[]> = [
  ruleMissingLicense,
  ruleMissingMount,
  ruleExteriorInInterior,
  ruleSwitchPoeBudget,
  ruleSwitchPortOverload,
  rulePathwayMissingConduit,
  ruleCableRunTooLong,
  ruleFloorCoverageGap,
  ruleDeviceNoNetworkCloset,
];

/** Run every rule and return findings sorted by (severity desc,
 *  ruleId, objectId) for deterministic UI ordering. */
export function runAllRules(ctx: RuleContext): Finding[] {
  const all = ALL_RULES.flatMap((r) => r(ctx));
  const severityRank: Record<FindingSeverity, number> = { critical: 0, warn: 1, info: 2 };
  return all.sort((a, b) => {
    const sd = severityRank[a.severity] - severityRank[b.severity];
    if (sd !== 0) return sd;
    if (a.ruleId !== b.ruleId) return a.ruleId.localeCompare(b.ruleId);
    return a.objectRef.id.localeCompare(b.objectRef.id);
  });
}

/** Convenience: group findings by category for the Final Design
 *  Review report (DVA.8). */
export function groupByCategory(findings: Finding[]): Record<FindingCategory, Finding[]> {
  const empty: Record<FindingCategory, Finding[]> = {
    license: [], mount: [], environment: [], power: [],
    capacity: [], pathway: [], distance: [], coverage: [], topology: [],
  };
  for (const f of findings) empty[f.category].push(f);
  return empty;
}

// ────────────────────────────── Internals ───────────────────────────

/** Catalog scan for a cable product whose `subcategory` matches the
 *  pathway's `cableType` string. Used when `cableType` is a label
 *  ("cat6a") rather than a product id. */
function scanCableByCategory(label: string | undefined): Product | undefined {
  if (!label) return undefined;
  const norm = label.toLowerCase().replace(/\s+/g, '');
  // SAMPLE_PRODUCTS isn't exported as a list-iter helper, so we go
  // through accessoriesFor's data path: the helper layer already has
  // every cable in scope. The cheap approach: linear scan via the
  // existing catalog helper. We avoid a re-import of SAMPLE_PRODUCTS
  // to keep this file's surface minimal.
  // (The future Data Hub swap will replace this with a real query.)
  // Inline scan via productById ids that follow a known prefix.
  const candidates = [
    'p-belden-cat6a', 'p-commscope-fiber-mm',
  ];
  for (const id of candidates) {
    const p = productById(id);
    if (!p) continue;
    if ((p.subcategory ?? '').toLowerCase() === norm) return p;
  }
  return undefined;
}

// Touch the `accessoriesFor` import so tree-shaking doesn't drop it —
// future rules will use it. Documented elsewhere; this is a noop at
// runtime.
void accessoriesFor;
