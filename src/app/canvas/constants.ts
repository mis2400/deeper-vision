// Canvas constants — extracted from screens/EngineeringCanvas.tsx as part
// of the M1 module split. Pure data only: tables, color palettes, default
// shapes. No store reads, no React imports.

import type {
  CableTypeId, CableTypeSpec, Device, DeviceKind, DeviceType, LensCfg, LensId, SiteBuilding,
} from './types';

// ─── Multisensor defaults ─────────────────────────────────────────────

/** Cardinal default lens layout — A=E, B=S, C=W, D=N (clockwise). 90° FOV
 *  per lens covers full 360°. Seeds new multisensors and backfills any
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

// ─── Color palette ────────────────────────────────────────────────────

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

// V3.6 Part B — restrained professional palette of CATEGORY DEFAULTS.
// Distinct enough that a plan reads by system at a glance; muted enough
// that nothing reads loud or clashing against the floorplan.
export const KIND_TONE: Record<DeviceKind, string> = {
  camera:         '#4A8FCC',
  access:         '#C89464',
  network:        '#5A9AA8',
  intrusion:      '#C26464',
  audio:          '#9B7AB8',
  storage:        '#6E7CB8',
  display:        '#4FA8B8',
  power:          '#B8784A',
  sensor:         '#8FA864',
  infrastructure: '#7E8590',
  cyber:          '#3FA48F',
  fire:           '#C25A4A',
  building:       '#889078',
};

export const TYPE_KIND: Record<DeviceType, DeviceKind> = {
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

// ─── Device categories shown in the InsertDock ────────────────────────

export const CATEGORIES: Array<{
  id: DeviceKind; label: string; tone: string;
  types: Array<{ id: DeviceType; label: string }>;
}> = [
  { id: 'camera',  label: 'Cameras',  tone: '#9CA3AF', types: [
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
 *  one drills into the categories within. */
export const TOP_LEVEL_GROUPS: Array<{
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

// ─── Cable types catalog ──────────────────────────────────────────────

export const CABLE_TYPES: CableTypeSpec[] = [
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

// ─── Device pill labels ───────────────────────────────────────────────

/** Granular device-type label, single source of truth for the SelectionPill
 *  kind chip. Granular enough to be honest (a `net.ap` is an "access point",
 *  not a "pathway"; a door is a "door", not an "opening"), while still short
 *  enough to sit next to the device id in the pill. */
export const TYPE_PILL_LABEL: Partial<Record<DeviceType, string>> = {
  'cam.bullet': 'camera', 'cam.dome': 'camera', 'cam.ptz': 'camera',
  'cam.multisensor': 'multisensor camera', 'cam.fisheye': 'fisheye camera',
  'cam.thermal': 'thermal camera', 'cam.lpr': 'LPR camera', 'cam.body': 'body camera',
  'acc.reader': 'reader', 'acc.strike': 'strike', 'acc.maglock': 'maglock',
  'acc.exit': 'exit device', 'acc.turnstile': 'turnstile', 'acc.intercom': 'intercom',
  'acc.biometric': 'biometric reader', 'acc.panic-bar': 'panic bar', 'acc.dps': 'door sensor',
  'net.switch': 'switch', 'net.idf': 'IDF', 'net.ap': 'access point',
  'net.firewall': 'firewall', 'net.bridge': 'bridge',
  'int.motion': 'motion sensor', 'int.glassbreak': 'glass-break',
  'int.contact': 'contact', 'int.panic': 'panic button',
  'int.vibration': 'vibration sensor', 'int.keypad': 'keypad',
  'aud.speaker': 'speaker', 'aud.mic': 'microphone', 'aud.horn': 'horn',
  'aud.amp': 'amplifier', 'aud.intercom': 'intercom',
  'sto.nvr': 'NVR', 'sto.server': 'server', 'sto.archive': 'archive', 'sto.cloud': 'cloud',
  'dis.monitor': 'monitor', 'dis.wall': 'video wall', 'dis.kiosk': 'kiosk', 'dis.signage': 'signage',
  'pwr.ups': 'UPS', 'pwr.poe': 'PoE injector', 'pwr.surge': 'surge protector', 'pwr.solar': 'solar',
  'sen.temp': 'temp sensor', 'sen.smoke': 'smoke detector',
  'sen.water': 'water sensor', 'sen.occupancy': 'occupancy sensor',
  'sen.gas': 'gas sensor', 'sen.gunshot': 'gunshot sensor',
  'inf.door-single': 'door', 'inf.door-double': 'door',
  'inf.door-storefront': 'door', 'inf.door-sliding': 'door',
  'inf.window': 'window', 'inf.wall-brick': 'wall',
  'inf.wall-fire': 'fire wall', 'inf.wall-concrete': 'wall',
  'inf.gate-swing': 'gate', 'inf.gate-slide': 'gate', 'inf.elevator': 'elevator',
  'inf.mdf': 'MDF', 'inf.rack': 'rack',
  'cyb.endpoint': 'endpoint', 'cyb.siem': 'SIEM',
  'cyb.firewall-ng': 'firewall', 'cyb.vpn': 'VPN',
  'fls.pull-station': 'pull station', 'fls.fire-panel': 'fire panel',
  'fls.strobe': 'strobe', 'fls.sprinkler': 'sprinkler',
  'bld.hvac-controller': 'HVAC controller',
  'bld.lighting-panel': 'lighting panel',
  'bld.bms-gateway': 'BMS gateway',
};

// ─── Hosting (stack) rules ────────────────────────────────────────────

/** Hosts that can host a hardware stack (reader/strike/REX/DPS/panic-bar).
 *  Doors and gates are the canonical hosts. */
export const STACKABLE_HOST_TYPES = new Set<DeviceType>([
  'inf.door-single', 'inf.door-double', 'inf.door-storefront', 'inf.door-sliding',
  'inf.gate-swing', 'inf.gate-slide', 'inf.elevator',
]);

/** Accessory types that mount on a stackable host. Order is rendering
 *  preference inside the stack popover. */
export const STACK_ACCESSORY_TYPES = new Set<DeviceType>([
  'acc.reader', 'acc.biometric', 'acc.strike', 'acc.maglock',
  'acc.exit', 'acc.panic-bar', 'acc.dps', 'acc.intercom',
  'int.contact',
]);

// ─── Mock site data (picker overview) ─────────────────────────────────

export const FLOORS = ['Ground floor', 'Level 2', 'Level 3', 'Roof'];

export const SEED_DEVICES: Device[] = [
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

export const SITE_BUILDINGS: SiteBuilding[] = [
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

// Re-export type used by tooltips so consumers can import cable type unions
// alongside the cable-type catalog from one place if they prefer.
export type { CableTypeId, CableTypeSpec };
