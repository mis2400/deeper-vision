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

import type { Device, Pathway, Room, Floor, IDF, DeviceType } from '../store/types';
import {
  productById,
  requiresLicense as productRequiresLicense,
  defaultLicenseFor,
  licensesFor,
  mountsForDeviceType,
  recommendedMountFor,
  poeDrawWatts,
  maxCableRunFor,
  cablesBySubcategory,
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
  /** IDF / MDF closets. IDFs carry inline switches (with portsPoe /
   *  portsTotal / poeBudgetW), so the network closet / PoE budget /
   *  port overload rules walk this list, not the Devices array. */
  idfs: IDF[];
}

// ────────────────────────────── Helpers ─────────────────────────────

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
    // Standard ray cast: the `(a.y > p.y) !== (b.y > p.y)` guard already
    // excludes horizontal edges (a.y === b.y), so no divide by zero
    // patch is needed and L shaped polygons return correct parity.
    if ((a.y > p.y) !== (b.y > p.y)) {
      const xIntersect = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
      if (p.x < xIntersect) inside = !inside;
    }
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

/** True when a device has at least one accessory the catalog tags as
 *  a mount for the device's type. Credit ANY catalog mount product
 *  (not only ones the host vendor whitelisted), because vendor
 *  `compatibleAccessories` lists are typically non exhaustive in real
 *  catalogs. The recommendation half of the rule still respects the
 *  host whitelist for fix suggestions; only this credit check is
 *  permissive. */
function hasMatchingMount(d: Device): boolean {
  if (!d.accessories?.length) return false;
  const validMountIds = new Set(mountsForDeviceType(d.type).map((m) => m.id));
  if (validMountIds.size === 0) return false;
  return d.accessories.some((id) => validMountIds.has(id));
}

/** Pathway endpoints — `sourceId`, `destinationId`, `targetId`. */
function pathwayEndpoints(p: Pathway): string[] {
  return [p.sourceId, p.destinationId, p.targetId].filter((x): x is string => !!x);
}

/** Is an id a network closet? IDFs live in their own slice (not as
 *  Devices), so we check the IDF list first. Devices with closet host
 *  types (acc.controller racks, etc.) are also accepted. */
function isClosetId(id: string, ctx: RuleContext): boolean {
  if (ctx.idfs.some((idf) => idf.id === id)) return true;
  const peer = ctx.devices.find((x) => x.id === id);
  return !!peer && isClosetHost(peer.type);
}

/** Devices wired to the given IDF via a pathway. */
function devicesOnIdf(idfId: string, ctx: RuleContext): Device[] {
  const linked = new Set<string>();
  for (const pw of ctx.pathways) {
    const ends = pathwayEndpoints(pw);
    if (!ends.includes(idfId)) continue;
    for (const eid of ends) {
      if (eid !== idfId) linked.add(eid);
    }
  }
  return ctx.devices.filter((d) => linked.has(d.id));
}

/** Does this device have any pathway endpoint at an IDF (or a direct
 *  linkedIds reference to one)? */
function hasClosetLink(d: Device, ctx: RuleContext): boolean {
  for (const pw of ctx.pathways) {
    const ends = pathwayEndpoints(pw);
    if (!ends.includes(d.id)) continue;
    for (const eid of ends) {
      if (eid === d.id) continue;
      if (isClosetId(eid, ctx)) return true;
    }
  }
  if (d.linkedIds?.length) {
    for (const eid of d.linkedIds) {
      if (isClosetId(eid, ctx)) return true;
    }
  }
  return false;
}

/** Total PoE budget watts across all switches inside an IDF. Undefined
 *  when the IDF has no switches recorded (rule stays silent). */
function idfPoeBudget(idf: IDF): number | undefined {
  if (!idf.switches?.length) return undefined;
  let sum = 0;
  let counted = 0;
  for (const sw of idf.switches) {
    if (typeof sw.poeBudgetW === 'number' && sw.poeBudgetW > 0) {
      sum += sw.poeBudgetW;
      counted++;
    }
  }
  return counted > 0 ? sum : undefined;
}

/** Total PoE port count across all switches inside an IDF. */
function idfPoePorts(idf: IDF): number | undefined {
  if (!idf.switches?.length) return undefined;
  let sum = 0;
  let counted = 0;
  for (const sw of idf.switches) {
    if (typeof sw.portsPoe === 'number' && sw.portsPoe >= 0) {
      sum += sw.portsPoe;
      counted++;
    }
  }
  return counted > 0 ? sum : undefined;
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
    if (!isPoeConsumer(d.type)) continue;
    // Skip if the host vendor declared no mount accessories — the
    // catalog can't suggest a fix we don't have a product for.
    if (!host.compatibleAccessories?.length) continue;
    // Skip when no catalog mount accessory exists for this device type;
    // we'd have nothing to recommend even if the host has whitelisted
    // accessories of other kinds.
    const mountsForType = mountsForDeviceType(d.type);
    if (mountsForType.length === 0) continue;
    // Permissive credit: if the device already carries ANY catalog
    // mount tagged for its type, consider it covered (vendor compat
    // lists are non exhaustive in real catalogs).
    if (hasMatchingMount(d)) continue;
    // Recommendation half: prefer the explicit recommended mount, but
    // only when it sits in the host's whitelist (so the fix path
    // respects vendor declared compatibility).
    const rec = recommendedMountFor(host);
    const recIsWhitelisted = !!rec && (host.compatibleAccessories ?? []).includes(rec.id);
    out.push({
      id: `missing-mount:${d.id}`,
      ruleId: 'missing-mount',
      severity: 'info',
      category: 'mount',
      objectRef: { kind: 'device', id: d.id },
      title: `${d.label || host.model} has no mount accessory`,
      description: `No mount product is attached. ${rec && recIsWhitelisted ? `Recommended: ${rec.manufacturer} ${rec.model}.` : 'Open the device drawer to pick one from the accessories list.'}`,
      suggestedFix: rec && recIsWhitelisted
        ? { kind: 'add-mount', deviceId: d.id, productId: rec.id, label: `Add ${rec.manufacturer} ${rec.model}` }
        : { kind: 'select-and-edit', objectId: d.id, objectKind: 'device', label: 'Open device drawer' },
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

/** Rule 4 — IDF over PoE budget. Switches in this codebase live
 *  INLINE on the IDF (`IDF.switches[]`), not as standalone Device
 *  rows, so the rule walks IDFs. Aggregates `poeBudgetW` across all
 *  switches in the IDF; sums PoE draws across devices wired to that
 *  IDF via pathway. Honest partial data behavior: when ANY consumer's
 *  draw is unknown, the rule does NOT fire a critical "over budget"
 *  finding (which would be based on a partial sum) — instead it
 *  optionally surfaces an info severity "data incomplete" finding so
 *  the operator knows the budget calc can't be trusted yet. */
export function ruleSwitchPoeBudget(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const idf of ctx.idfs) {
    const budget = idfPoeBudget(idf);
    if (typeof budget !== 'number') continue; // unknown = silent
    const consumers = devicesOnIdf(idf.id, ctx).filter((d) => isPoeConsumer(d.type));
    if (consumers.length === 0) continue;
    let sum = 0;
    let unknown = 0;
    for (const d of consumers) {
      const prod = productById(d.product);
      const draw = prod ? poeDrawWatts(prod) : undefined;
      if (typeof draw !== 'number') { unknown++; continue; }
      sum += draw;
    }
    if (unknown > 0 && sum <= budget) {
      // Partial data, no hard violation yet — keep quiet rather than
      // raising a critical finding on a half count.
      continue;
    }
    if (sum <= budget) continue;
    const knownCount = consumers.length - unknown;
    out.push({
      id: `switch-poe-budget:${idf.id}`,
      ruleId: 'switch-poe-budget',
      severity: 'critical',
      category: 'power',
      objectRef: { kind: 'device', id: idf.id },
      title: `${idf.name} is over PoE budget`,
      description: `IDF carries a ${budget}W PoE budget across its switches. ${knownCount} connected device${knownCount === 1 ? '' : 's'} draw${knownCount === 1 ? 's' : ''} ${Math.round(sum)}W${unknown > 0 ? ` (${unknown} device${unknown === 1 ? '' : 's'} of unknown draw skipped)` : ''}. Move devices to another IDF or add a PoE injector.`,
      suggestedFix: { kind: 'select-and-edit', objectId: idf.id, objectKind: 'device', label: 'Open IDF drawer' },
    });
  }
  return out;
}

/** Rule 5 — IDF over port count. PoE consumer count routed to an IDF
 *  exceeds the IDF's total PoE port capacity. */
export function ruleSwitchPortOverload(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const idf of ctx.idfs) {
    const ports = idfPoePorts(idf);
    if (typeof ports !== 'number') continue;
    const consumers = devicesOnIdf(idf.id, ctx).filter((d) => isPoeConsumer(d.type));
    if (consumers.length <= ports) continue;
    out.push({
      id: `switch-port-overload:${idf.id}`,
      ruleId: 'switch-port-overload',
      severity: 'critical',
      category: 'capacity',
      objectRef: { kind: 'device', id: idf.id },
      title: `${idf.name} has more devices than ports`,
      description: `IDF has ${ports} PoE ports across its switches. ${consumers.length} PoE devices are routed here. Add an access switch or move devices to a different IDF.`,
      suggestedFix: { kind: 'select-and-edit', objectId: idf.id, objectKind: 'device', label: 'Open IDF drawer' },
    });
  }
  return out;
}

/** Rule 6 — Pathway missing conduit information. Only fires on
 *  cable bundles. The store carries two parallel kind fields: the
 *  legacy `type` (which the seed uses with values like 'conduit',
 *  'tray', 'jhook') and the newer `pathwayKind`. A pathway counts
 *  as a "cable bundle" only when BOTH fields say so (or are
 *  undefined). Standalone conduit / tray / J-hook runs are silent. */
export function rulePathwayMissingConduit(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const pw of ctx.pathways) {
    // Exclude explicit non cable kinds via either field.
    if (pw.pathwayKind && pw.pathwayKind !== 'cable') continue;
    const legacyType = String(pw.type ?? '').toLowerCase();
    if (legacyType === 'conduit' || legacyType === 'tray' || legacyType === 'jhook'
        || legacyType === 'sleeve'  || legacyType === 'raceway' || legacyType === 'duct') {
      continue;
    }
    // Explicit "no conduit" decision is a real call, not a gap.
    if (pw.conduitType && pw.conduitType !== 'none' && pw.conduitSize) continue;
    if (pw.conduitType === 'none') continue;
    // Skip short patch runs inside a closet.
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

/** Rule 7 — Cable run exceeds the product's maximum distance.
 *  `cableType` on a pathway is either a product id or a category
 *  label ("cat6", "cat6a", "fiber-mm", etc.); both shapes resolve
 *  through the helper layer. */
export function ruleCableRunTooLong(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  for (const pw of ctx.pathways) {
    if (pw.pathwayKind && pw.pathwayKind !== 'cable') continue;
    // First, try product id lookup. Then fall back to subcategory
    // search across every cable in the catalog (the helper iterates
    // SAMPLE_PRODUCTS, so any future cable SKU added to the seed
    // becomes resolvable automatically).
    let cableProd = productById(pw.cableType as string);
    if (!cableProd) {
      const matches = cablesBySubcategory(pw.cableType as string);
      // Pick the cable with the SHORTEST max run as the binding
      // constraint when multiple SKUs share a subcategory (e.g. two
      // Cat6 vendors). That keeps the rule honest and conservative.
      cableProd = matches.reduce<Product | undefined>((best, p) => {
        if (typeof p.maxCableRunFt !== 'number') return best;
        if (!best || (best.maxCableRunFt ?? Infinity) > p.maxCableRunFt) return p;
        return best;
      }, undefined);
    }
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
      description: `Pathway ${pw.id} measures ${lenFt} ft. ${cableProd.subcategory ?? 'Cable'} is rated for ${max} ft max. Insert a midpoint switch or convert this segment to fiber.`,
      suggestedFix: { kind: 'select-and-edit', objectId: pw.id, objectKind: 'pathway', label: 'Open pathway drawer' },
    });
  }
  return out;
}

/** Rule 8 — Floor area with incomplete coverage. Conservative
 *  heuristic targeting the placement signal, not the technical
 *  coverage map: floors with rooms defined but zero general purpose
 *  cameras (bullet / dome / turret / multisensor) fire a critical
 *  finding. The under coverage warn variant is intentionally NOT
 *  fired in Phase 1 — cameras per room is too noisy a metric to be
 *  worth surfacing without real cone vs room intersection (which
 *  belongs in V3.5 coverage work). Specialty cameras (LPR, thermal,
 *  fisheye, body) do not count toward room coverage. */
export function ruleFloorCoverageGap(ctx: RuleContext): Finding[] {
  const out: Finding[] = [];
  const generalCameraTypes: ReadonlyArray<DeviceType> = [
    'cam.bullet', 'cam.dome', 'cam.turret', 'cam.multisensor',
  ];
  for (const fl of ctx.floors) {
    const floorRooms = ctx.rooms.filter((r) => r.floorId === fl.id);
    if (floorRooms.length === 0) continue;
    const cams = ctx.devices.filter((d) =>
      d.floorId === fl.id && generalCameraTypes.includes(d.type));
    if (cams.length > 0) continue;
    out.push({
      id: `floor-coverage-gap:${fl.id}`,
      ruleId: 'floor-coverage-gap',
      severity: 'critical',
      category: 'coverage',
      objectRef: { kind: 'floor', id: fl.id },
      title: `${fl.name} has rooms defined but no cameras`,
      description: `${floorRooms.length} room(s) on this floor with zero general purpose cameras placed. Coverage cannot be assessed until cameras are added.`,
    });
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

