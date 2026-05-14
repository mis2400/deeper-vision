// Initial demo state. Transplants the SEED_DEVICES and SEED projects that
// previously lived inside individual screens into the shared store, so every
// screen draws from the same source.

import type {
  Customer, Project, Site, Building, Floor, Device, Door, Pathway, IDF, Estimate, LensCfg,
} from './types';

/** Cardinal default lens layout for new multisensors. */
export const DEFAULT_MULTISENSOR_LENSES: { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg } = {
  a: { rotation: 0,   fov: 90, range: 60, focal: 2.8, enabled: true },
  b: { rotation: 90,  fov: 90, range: 60, focal: 2.8, enabled: true },
  c: { rotation: 180, fov: 90, range: 60, focal: 2.8, enabled: true },
  d: { rotation: 270, fov: 90, range: 60, focal: 2.8, enabled: true },
};

const now = Date.now();

// ── Customers ─────────────────────────────────────────────────────
const CUSTOMERS: Customer[] = [
  { id: 'c1', companyName: 'Acme Industries',
    contacts: [{ id: 'c1-jd', name: 'John Doe', role: 'Director of Facilities', email: 'jd@acme.com' }],
    addresses: [{ street: '500 Congress Ave', city: 'Austin', state: 'TX' }] },
  { id: 'c2', companyName: 'Mercy Health',
    contacts: [{ id: 'c2-sm', name: 'Sarah Miller', role: 'Security Manager', email: 'smiller@mercy.health' }],
    addresses: [{ street: '1200 Medical Pkwy', city: 'Dallas', state: 'TX' }] },
  { id: 'c3', companyName: 'Unibail-Rodamco',
    contacts: [{ id: 'c3-mw', name: 'Mike Wong', role: 'Asset Manager' }],
    addresses: [{ street: '865 Market St', city: 'San Francisco', state: 'CA' }] },
  { id: 'c4', companyName: 'Equinix',
    contacts: [{ id: 'c4-jk', name: 'Jordan Kim', role: 'Data Center Operations' }],
    addresses: [{ street: '4150 Network Way', city: 'Ashburn', state: 'VA' }] },
  { id: 'c5', companyName: 'Portland Public Schools',
    contacts: [{ id: 'c5-rh', name: 'Rita Holmes', role: 'District Security Coordinator' }],
    addresses: [{ street: '1600 Education Way', city: 'Portland', state: 'OR' }] },
  { id: 'c6', companyName: 'BlackRock REIT',
    contacts: [{ id: 'c6-tp', name: 'Tom Park', role: 'Property Manager' }],
    addresses: [{ street: '88 Riverside', city: 'Brooklyn', state: 'NY' }] },
];

// ── Projects ──────────────────────────────────────────────────────
const PROJECTS: Project[] = [
  { id: 'p1', name: 'Acme HQ — Austin',          customerId: 'c1', siteId: 's1', status: 'design',  lifecyclePhase: 'engineering',   team: 4, progress: 28,  updated: '2h ago',  createdAt: now - 1000*60*60*24*40, updatedAt: now - 1000*60*60*2 },
  { id: 'p2', name: 'Mercy Hospital Tower B',    customerId: 'c2', siteId: 's2', status: 'review',  lifecyclePhase: 'proposal',      team: 6, progress: 62,  updated: '6h ago',  createdAt: now - 1000*60*60*24*80, updatedAt: now - 1000*60*60*6 },
  { id: 'p3', name: 'Westfield Mall Renovation', customerId: 'c3', siteId: 's3', status: 'install', lifecyclePhase: 'deployment',    team: 9, progress: 81,  updated: '1d ago',  createdAt: now - 1000*60*60*24*120,updatedAt: now - 1000*60*60*24 },
  { id: 'p4', name: 'Central Data Center',       customerId: 'c4', siteId: 's4', status: 'live',    lifecyclePhase: 'managed-service',team: 3, progress: 100, updated: '3d ago',  createdAt: now - 1000*60*60*24*220,updatedAt: now - 1000*60*60*24*3 },
  { id: 'p5', name: 'Lincoln High School',       customerId: 'c5', siteId: 's5', status: 'design',  lifecyclePhase: 'engineering',   team: 3, progress: 14,  updated: '1d ago',  createdAt: now - 1000*60*60*24*30, updatedAt: now - 1000*60*60*24 },
  { id: 'p6', name: 'Riverside Apartments',      customerId: 'c6', siteId: 's6', status: 'review',  lifecyclePhase: 'proposal',      team: 5, progress: 48,  updated: '4h ago',  createdAt: now - 1000*60*60*24*60, updatedAt: now - 1000*60*60*4 },
];

// ── Sites / Buildings / Floors ────────────────────────────────────
const SITES: Site[]      = PROJECTS.map((p) => ({ id: `s${p.id.slice(1)}`, projectId: p.id, name: p.name, address: CUSTOMERS.find(c => c.id === p.customerId)?.addresses[0] ? `${CUSTOMERS.find(c => c.id === p.customerId)!.addresses[0].street}` : '' }));
const BUILDINGS: Building[] = SITES.map((s) => ({ id: `b${s.id.slice(1)}`, siteId: s.id, name: 'Building A' }));
const FLOORS: Floor[] = BUILDINGS.flatMap((b) => [
  { id: `${b.id}-f1`, buildingId: b.id, name: 'Ground floor', level: 0, source: 'blueprint', scalePxToFt: 0.05, walls: [] },
  { id: `${b.id}-f2`, buildingId: b.id, name: 'Level 2',      level: 1, source: 'blueprint', scalePxToFt: 0.05, walls: [] },
]);

const F_P1_GROUND = `b1-f1`;
const F_P5_GROUND = `b5-f1`;
const F_P3_GROUND = `b3-f1`;

// ── Devices ───────────────────────────────────────────────────────
// Project p1 (Acme HQ) gets the original SEED_DEVICES from the canvas. Other
// projects get smaller sample sets so cross-project navigation also feels
// alive without bloating the seed.
const DEVICES: Device[] = [
  // p1 — Acme HQ ground floor
  { id: 'CAM-101', projectId: 'p1', floorId: F_P1_GROUND, type: 'cam.bullet',      label: 'Lobby NE',   product: 'p-axis-p1468',  x: 260, y: 220, rot:  35 },
  { id: 'CAM-102', projectId: 'p1', floorId: F_P1_GROUND, type: 'cam.bullet',      label: 'Lobby SW',   product: 'p-axis-p1468',  x: 260, y: 460, rot: -35 },
  { id: 'CAM-103', projectId: 'p1', floorId: F_P1_GROUND, type: 'cam.multisensor', label: 'Atrium',     product: 'p-axis-p3827',  x: 480, y: 340, rot:   0,
    lensMode: 'linked',
    lenses: { ...DEFAULT_MULTISENSOR_LENSES } },
  { id: 'CAM-104', projectId: 'p1', floorId: F_P1_GROUND, type: 'cam.ptz',         label: 'Exterior N', product: 'p-axis-q6315',  x: 620, y: 200, rot: 200 },
  { id: 'CAM-105', projectId: 'p1', floorId: F_P1_GROUND, type: 'cam.fisheye',     label: 'Conference', product: 'p-axis-m4327',  x: 700, y: 460, rot:   0 },
  { id: 'RD-1',    projectId: 'p1', floorId: F_P1_GROUND, type: 'acc.reader',      label: 'Lobby in',   product: 'p-hid-signo20', x: 400, y: 130, rot:   0 },
  { id: 'DR-1',    projectId: 'p1', floorId: F_P1_GROUND, type: 'acc.strike',      label: 'Main entry', product: 'p-vd-6210',     x: 420, y: 130, rot:   0 },
  { id: 'AP-1',    projectId: 'p1', floorId: F_P1_GROUND, type: 'net.ap',          label: 'Floor 1 AP', product: 'p-cisco-ap',    x: 360, y: 320, rot:   0 },

  // p5 — Lincoln High School ground floor (sample)
  { id: 'CAM-LH-1', projectId: 'p5', floorId: F_P5_GROUND, type: 'cam.dome',       label: 'Main entrance', product: 'p-axis-p3265', x: 320, y: 240, rot:  90 },
  { id: 'CAM-LH-2', projectId: 'p5', floorId: F_P5_GROUND, type: 'cam.bullet',     label: 'Parking lot',   product: 'p-axis-p1468', x: 200, y: 420, rot: 200 },
  { id: 'RD-LH-1',  projectId: 'p5', floorId: F_P5_GROUND, type: 'acc.reader',     label: 'Main door',     product: 'p-hid-signo20',x: 380, y: 180, rot:   0 },

  // p3 — Westfield Mall (sample)
  { id: 'CAM-WM-1', projectId: 'p3', floorId: F_P3_GROUND, type: 'cam.ptz',        label: 'Center court',  product: 'p-axis-q6315', x: 500, y: 320, rot:  45 },
  { id: 'CAM-WM-2', projectId: 'p3', floorId: F_P3_GROUND, type: 'cam.multisensor',label: 'Food court',    product: 'p-axis-p3827', x: 720, y: 380, rot:   0,
    lensMode: 'linked',
    lenses: { ...DEFAULT_MULTISENSOR_LENSES } },
];

// ── Doors ─────────────────────────────────────────────────────────
const DOORS: Door[] = [
  { id: 'DOOR-101', projectId: 'p1', floorId: F_P1_GROUND, x: 420, y: 130, rot: 0,  width: 36, doorType: 'single', material: 'hollow-metal', fireRated: true, ada: true, hardware: ['reader', 'strike', 'rex', 'contact'], electrification: 'fail-secure', readerLocation: 'wall' },
];

// ── Pathways ──────────────────────────────────────────────────────
const PATHWAYS: Pathway[] = [
  { id: 'PW-1', projectId: 'p1', floorId: F_P1_GROUND, type: 'conduit', cableType: 'cat6a', cableCount: 2,
    points: [{ x: 260, y: 220 }, { x: 360, y: 220 }, { x: 360, y: 320 }],
    sourceId: 'CAM-101', destinationId: 'IDF-1', conduitFill: 0.18 },
];

// ── IDFs ──────────────────────────────────────────────────────────
const IDFS: IDF[] = [
  { id: 'IDF-1', projectId: 'p1', floorId: F_P1_GROUND, x: 360, y: 320, name: 'IDF-1',
    switches: [{ model: 'Cisco C9300-48P', portsPoe: 48, portsTotal: 48, poeBudgetW: 740 }],
    power: { upsModel: 'APC SRT 2200VA', upsRuntimeMin: 32, loadW: 380 } },
];

// ── Estimates ─────────────────────────────────────────────────────
// Estimates start empty per project — derived live from devices/doors/pathways
// the first time the user visits /estimate/:projectId. See selectors in store.
const ESTIMATES: Estimate[] = PROJECTS.map((p) => ({
  id: `est-${p.id}`, projectId: p.id, lines: [], laborRate: 95, markup: 0.18,
}));

// ── Public seed function ──────────────────────────────────────────
/** Returns the canonical initial state for the store. Called on first load
 *  and by the user-facing "Reset demo data" button. */
export function buildSeed() {
  const byId = <T extends { id: string }>(arr: T[]) =>
    Object.fromEntries(arr.map((x) => [x.id, x])) as Record<string, T>;

  return {
    customers: byId(CUSTOMERS),
    projects:  byId(PROJECTS),
    sites:     byId(SITES),
    buildings: byId(BUILDINGS),
    floors:    byId(FLOORS),
    devices:   byId(DEVICES),
    doors:     byId(DOORS),
    pathways:  byId(PATHWAYS),
    idfs:      byId(IDFS),
    estimates: byId(ESTIMATES),
  };
}
