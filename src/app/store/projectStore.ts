// Single shared project store. Persists to localStorage under a versioned key
// (deeperVisionStore:v1) and exposes both granular actions (per-entity CRUD)
// and computed selectors (devicesForProject, lineForDevice, etc.).
//
// Every screen consumes this. There is no more local SEED data anywhere that
// the user can interact with — only static product catalog / nav copy / etc.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Customer, Project, Site, Building, Floor, Device, Door, Pathway, IDF, Estimate,
  EstimateLine, LensCfg,
} from './types';
import { buildSeed } from './seed';

// ─────────────────────────── State shape ──────────────────────────
interface ProjectState {
  customers: Record<string, Customer>;
  projects:  Record<string, Project>;
  sites:     Record<string, Site>;
  buildings: Record<string, Building>;
  floors:    Record<string, Floor>;
  devices:   Record<string, Device>;
  doors:     Record<string, Door>;
  pathways:  Record<string, Pathway>;
  idfs:      Record<string, IDF>;
  estimates: Record<string, Estimate>;

  // ── Project actions ──
  updateProject: (id: string, patch: Partial<Project>) => void;

  // ── Device actions ──
  addDevice:    (d: Device) => void;
  updateDevice: (id: string, patch: Partial<Device>) => void;
  removeDevice: (id: string) => void;

  // ── Door actions ──
  addDoor:    (d: Door) => void;
  updateDoor: (id: string, patch: Partial<Door>) => void;
  removeDoor: (id: string) => void;

  // ── Pathway actions ──
  addPathway:    (p: Pathway) => void;
  updatePathway: (id: string, patch: Partial<Pathway>) => void;
  removePathway: (id: string) => void;

  // ── IDF actions ──
  addIDF:    (i: IDF) => void;
  updateIDF: (id: string, patch: Partial<IDF>) => void;
  removeIDF: (id: string) => void;

  // ── Floor / walls ──
  updateFloor: (id: string, patch: Partial<Floor>) => void;

  // ── Reset / utility ──
  resetDemoData: () => void;
}

// ─────────────────────────── Store ────────────────────────────────
// Expose the store on window in dev for browser-console inspection. Never
// reference this in app code — UI components must use the React hook so
// re-renders work. The escape hatch is strictly for ad-hoc debugging.
declare global {
  // eslint-disable-next-line no-var
  var __projectStore: any;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      ...buildSeed(),

      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects[id]
            ? { ...s.projects, [id]: { ...s.projects[id], ...patch, updatedAt: Date.now() } }
            : s.projects,
        })),

      addDevice: (d) =>
        set((s) => ({ devices: { ...s.devices, [d.id]: d } })),
      updateDevice: (id, patch) =>
        set((s) => (s.devices[id] ? { devices: { ...s.devices, [id]: { ...s.devices[id], ...patch } } } : s)),
      removeDevice: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.devices; return { devices: rest }; }),

      addDoor: (d) => set((s) => ({ doors: { ...s.doors, [d.id]: d } })),
      updateDoor: (id, patch) =>
        set((s) => (s.doors[id] ? { doors: { ...s.doors, [id]: { ...s.doors[id], ...patch } } } : s)),
      removeDoor: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.doors; return { doors: rest }; }),

      addPathway: (p) => set((s) => ({ pathways: { ...s.pathways, [p.id]: p } })),
      updatePathway: (id, patch) =>
        set((s) => (s.pathways[id] ? { pathways: { ...s.pathways, [id]: { ...s.pathways[id], ...patch } } } : s)),
      removePathway: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.pathways; return { pathways: rest }; }),

      addIDF: (i) => set((s) => ({ idfs: { ...s.idfs, [i.id]: i } })),
      updateIDF: (id, patch) =>
        set((s) => (s.idfs[id] ? { idfs: { ...s.idfs, [id]: { ...s.idfs[id], ...patch } } } : s)),
      removeIDF: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.idfs; return { idfs: rest }; }),

      updateFloor: (id, patch) =>
        set((s) => (s.floors[id] ? { floors: { ...s.floors, [id]: { ...s.floors[id], ...patch } } } : s)),

      resetDemoData: () => set(() => ({ ...buildSeed() })),
    }),
    {
      name: 'deeperVisionStore',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Migration hook — future schema bumps go here.
      migrate: (persisted: any, _version: number) => persisted,
      // Only persist data slices, not action references (those are on every
      // hydrate anyway).
      partialize: (s) => ({
        customers: s.customers,
        projects:  s.projects,
        sites:     s.sites,
        buildings: s.buildings,
        floors:    s.floors,
        devices:   s.devices,
        doors:     s.doors,
        pathways:  s.pathways,
        idfs:      s.idfs,
        estimates: s.estimates,
      }),
    },
  ),
);

if (typeof window !== 'undefined') {
  (globalThis as any).__projectStore = useProjectStore;
}

// ─────────────────────────── Selectors ────────────────────────────
// These are plain functions over the snapshot so callers can compose them
// without forcing component re-renders on unrelated state. Use with
// useProjectStore(useShallow(s => ...)) or call selectors directly from
// store.getState() in non-React code paths.

export const selectors = {
  /** All projects, newest first. */
  projectList: (s: ProjectState): Project[] =>
    Object.values(s.projects).sort((a, b) => b.updatedAt - a.updatedAt),

  /** First floor of a project (used by the canvas when the user hasn't picked a floor). */
  firstFloorOfProject: (s: ProjectState, projectId: string): Floor | null => {
    const site = Object.values(s.sites).find((x) => x.projectId === projectId);
    if (!site) return null;
    const building = Object.values(s.buildings).find((b) => b.siteId === site.id);
    if (!building) return null;
    return Object.values(s.floors).find((f) => f.buildingId === building.id) ?? null;
  },

  floorsForProject: (s: ProjectState, projectId: string): Floor[] => {
    const site = Object.values(s.sites).find((x) => x.projectId === projectId);
    if (!site) return [];
    const buildings = Object.values(s.buildings).filter((b) => b.siteId === site.id);
    const ids = new Set(buildings.map((b) => b.id));
    return Object.values(s.floors).filter((f) => ids.has(f.buildingId));
  },

  /** All devices belonging to a project (any floor). */
  devicesForProject: (s: ProjectState, projectId: string): Device[] =>
    Object.values(s.devices).filter((d) => d.projectId === projectId),

  /** Devices on a specific floor (canvas drilldown). */
  devicesForFloor: (s: ProjectState, floorId: string): Device[] =>
    Object.values(s.devices).filter((d) => d.floorId === floorId),

  doorsForFloor: (s: ProjectState, floorId: string): Door[] =>
    Object.values(s.doors).filter((d) => d.floorId === floorId),

  pathwaysForFloor: (s: ProjectState, floorId: string): Pathway[] =>
    Object.values(s.pathways).filter((p) => p.floorId === floorId),

  idfsForFloor: (s: ProjectState, floorId: string): IDF[] =>
    Object.values(s.idfs).filter((i) => i.floorId === floorId),

  pathwaysForProject: (s: ProjectState, projectId: string): Pathway[] =>
    Object.values(s.pathways).filter((p) => p.projectId === projectId),

  idfsForProject: (s: ProjectState, projectId: string): IDF[] =>
    Object.values(s.idfs).filter((i) => i.projectId === projectId),

  estimateForProject: (s: ProjectState, projectId: string): Estimate | null =>
    Object.values(s.estimates).find((e) => e.projectId === projectId) ?? null,
};

// ─────────────────────────── BOM derivation ───────────────────────
// Live-compute estimate lines from the devices/doors/pathways/idfs on a
// project. Called by /estimate/:id (and any other screen that needs a BOM).
// This is intentionally NOT persisted — it derives every time so the canvas
// is always the source of truth.
const UNIT_PRICE: Record<string, { price: number; labor: number; desc: string }> = {
  'cam.bullet':      { price:  849, labor: 1.5,  desc: 'Bullet camera' },
  'cam.dome':        { price:  625, labor: 1.25, desc: 'Dome camera' },
  'cam.ptz':         { price: 3299, labor: 2.5,  desc: 'PTZ camera' },
  'cam.multisensor': { price: 2895, labor: 2.5,  desc: 'Multisensor camera' },
  'cam.fisheye':     { price: 1480, labor: 1.5,  desc: 'Fisheye camera' },
  'cam.thermal':     { price: 4250, labor: 2.0,  desc: 'Thermal camera' },
  'cam.lpr':         { price: 2199, labor: 2.0,  desc: 'LPR camera' },
  'cam.body':        { price:  950, labor: 1.25, desc: 'Body / dome camera' },
  'acc.reader':      { price:  285, labor: 0.75, desc: 'Card / mobile reader' },
  'acc.strike':      { price:  540, labor: 1.5,  desc: 'Electric strike' },
  'acc.maglock':     { price:  245, labor: 1.0,  desc: 'Magnetic lock' },
  'acc.rex':         { price:  215, labor: 0.5,  desc: 'REX motion' },
  'acc.exit':        { price:  845, labor: 1.5,  desc: 'Exit device' },
  'acc.door':        { price:    0, labor: 0,    desc: 'Door (no hardware)' },
  'acc.gate':        { price: 2400, labor: 4.0,  desc: 'Gate operator' },
  'acc.biometric':   { price: 1395, labor: 1.5,  desc: 'Biometric reader' },
  'net.idf':         { price:    0, labor: 0,    desc: 'IDF (cabinet billed separately)' },
  'net.mdf':         { price:    0, labor: 0,    desc: 'MDF (cabinet billed separately)' },
  'net.switch':      { price: 4400, labor: 3.0,  desc: 'PoE switch (48 port)' },
  'net.ap':          { price:  280, labor: 1.0,  desc: 'Wireless AP' },
  'net.firewall':    { price: 2200, labor: 2.0,  desc: 'Firewall' },
  'net.bridge':      { price:  650, labor: 1.5,  desc: 'Wireless bridge' },
  'net.fiber':       { price:    0, labor: 0,    desc: 'Fiber link' },
  'net.copper':      { price:    0, labor: 0,    desc: 'Copper link' },
  'net.wireless':    { price:    0, labor: 0,    desc: 'Wireless link' },
  'pwr.ups':         { price: 1620, labor: 1.5,  desc: 'UPS battery backup' },
  'pwr.poe':         { price:  425, labor: 0.5,  desc: 'PoE injector / power supply' },
  'pwr.surge':       { price:  185, labor: 0.5,  desc: 'Surge suppressor' },
  'pwr.solar':       { price: 2900, labor: 3.0,  desc: 'Solar power kit' },
  'sen.motion':      { price:  165, labor: 0.75, desc: 'Motion sensor' },
  'sen.glass':       { price:   88, labor: 0.5,  desc: 'Glass-break sensor' },
  'sen.contact':     { price:   22, labor: 0.25, desc: 'Door/window contact' },
  'sen.panic':       { price:  120, labor: 0.5,  desc: 'Panic button' },
  'sen.smoke':       { price:   95, labor: 0.5,  desc: 'Smoke detector' },
  'aud.speaker':     { price:  145, labor: 1.0,  desc: 'Ceiling speaker' },
  'aud.intercom':    { price:  720, labor: 1.5,  desc: 'Intercom' },
  'aud.horn':        { price:  615, labor: 1.0,  desc: 'IP horn / talk-down' },
  'aud.amp':         { price:  985, labor: 1.5,  desc: 'Audio amplifier' },
  'sto.nvr':         { price: 6890, labor: 3.0,  desc: 'NVR' },
  'sto.cloud':       { price: 1200, labor: 0.5,  desc: 'Cloud recorder' },
  'sto.server':      { price:12500, labor: 4.0,  desc: 'AI / VMS server' },
  'dis.monitor':     { price:  450, labor: 0.5,  desc: 'Monitor' },
  'dis.video-wall':  { price: 8400, labor: 4.0,  desc: 'Video wall' },
  'dis.kiosk':       { price: 2200, labor: 2.0,  desc: 'Kiosk' },
};

const CABLE_UNIT_PRICE: Record<string, number> = {
  'cat6':       0.42,
  'cat6a':      0.78,
  'fiber-sm':   1.85,
  'fiber-mm':   1.65,
  'coax':       0.55,
  'power':      0.30,
  'composite':  1.40,
};

/** Compute estimate line items live from a project's current devices, doors,
 *  pathways, and IDFs. Returns lines + headline totals. Pure function — safe
 *  to call inside React render. */
export function deriveBOM(state: ProjectState, projectId: string): {
  lines: EstimateLine[];
  hardwareTotal: number;
  laborHours: number;
  laborTotal: number;
  cableTotal: number;
  total: number;
} {
  const project = state.projects[projectId];
  const laborRate = state.estimates[`est-${projectId}`]?.laborRate ?? 95;
  const markup = state.estimates[`est-${projectId}`]?.markup ?? 0.18;

  const devices = selectors.devicesForProject(state, projectId);
  const doors = Object.values(state.doors).filter((d) => d.projectId === projectId);
  const pathways = selectors.pathwaysForProject(state, projectId);
  const idfs = selectors.idfsForProject(state, projectId);

  // Group devices by type → one line per type with summed qty.
  const byType = new Map<string, { qty: number; price: number; labor: number; desc: string }>();
  for (const d of devices) {
    const meta = UNIT_PRICE[d.type] ?? { price: 0, labor: 0, desc: d.type };
    const prev = byType.get(d.type) ?? { qty: 0, price: meta.price, labor: meta.labor, desc: meta.desc };
    prev.qty += 1;
    byType.set(d.type, prev);
  }

  const lines: EstimateLine[] = [];

  byType.forEach((agg, type) => {
    lines.push({
      id: `dev-${projectId}-${type}`,
      sourceKind: 'device',
      sku: type,
      description: agg.desc,
      qty: agg.qty,
      uom: 'ea',
      unitPrice: agg.price,
      laborHours: agg.labor * agg.qty,
    });
  });

  // Doors → one line each (so hardware can vary). Sum hardware unit prices.
  for (const door of doors) {
    const hwSum = door.hardware.reduce((acc, h) => {
      const meta = UNIT_PRICE[(`acc.${h}`) as keyof typeof UNIT_PRICE] ?? { price: 0, labor: 0 };
      return { price: acc.price + meta.price, labor: acc.labor + meta.labor };
    }, { price: 0, labor: 0 });
    lines.push({
      id: `door-${door.id}`,
      sourceKind: 'door',
      sourceId: door.id,
      sku: `door:${door.doorType}`,
      description: `Door · ${door.doorType} · hardware: ${door.hardware.join(', ') || 'none'}`,
      qty: 1, uom: 'ea',
      unitPrice: hwSum.price,
      laborHours: hwSum.labor,
    });
  }

  // Pathways → cable feet + small conduit allocation.
  const pxPerFt = 20; // matches canvas scale; will be replaced when /calibrate is wired.
  for (const p of pathways) {
    let lengthPx = 0;
    for (let i = 1; i < p.points.length; i++) {
      lengthPx += Math.hypot(p.points[i].x - p.points[i - 1].x, p.points[i].y - p.points[i - 1].y);
    }
    const ft = p.lengthFt ?? Math.round(lengthPx / pxPerFt);
    const unitFt = CABLE_UNIT_PRICE[p.cableType] ?? 0.5;
    lines.push({
      id: `pw-${p.id}-cable`,
      sourceKind: 'pathway',
      sourceId: p.id,
      sku: `cable:${p.cableType}`,
      description: `${p.cableType.toUpperCase()} · ${p.cableCount}× · ${ft} ft`,
      qty: ft * p.cableCount,
      uom: 'ft',
      unitPrice: unitFt,
      laborHours: ft * 0.02 * p.cableCount, // ~1.2 min per ft per pull
    });
  }

  // IDFs → switch + UPS allocations.
  for (const idf of idfs) {
    for (const sw of idf.switches ?? []) {
      lines.push({
        id: `idf-${idf.id}-sw-${sw.model}`,
        sourceKind: 'idf',
        sourceId: idf.id,
        sku: sw.model,
        description: `${sw.model} · ${sw.portsTotal} ports`,
        qty: 1, uom: 'ea',
        unitPrice: UNIT_PRICE['net.switch'].price,
        laborHours: UNIT_PRICE['net.switch'].labor,
      });
    }
    if (idf.power?.upsModel) {
      lines.push({
        id: `idf-${idf.id}-ups`,
        sourceKind: 'idf',
        sourceId: idf.id,
        sku: idf.power.upsModel,
        description: `${idf.power.upsModel} · ~${idf.power.upsRuntimeMin ?? 30} min runtime`,
        qty: 1, uom: 'ea',
        unitPrice: UNIT_PRICE['pwr.ups'].price,
        laborHours: UNIT_PRICE['pwr.ups'].labor,
      });
    }
  }

  // Totals
  const hardwareTotal = lines.filter((l) => l.sourceKind !== 'pathway').reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const cableTotal = lines.filter((l) => l.sourceKind === 'pathway').reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const laborHours = lines.reduce((s, l) => s + (l.laborHours ?? 0), 0);
  const laborTotal = laborHours * laborRate;
  const total = (hardwareTotal + cableTotal + laborTotal) * (1 + markup);

  void project; // silence unused if we don't surface project name here
  return { lines, hardwareTotal, cableTotal, laborHours, laborTotal, total };
}
