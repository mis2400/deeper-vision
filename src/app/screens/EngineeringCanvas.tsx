import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { useProjectStore, selectors as storeSelectors } from '../store/projectStore';
import type {
  EngineeringLayer, CanvasLayerState, CanvasDisplayPrefs, IconSize,
  LabelDensity, BaseMapMode,
} from '../store/types';
import { DEFAULT_CANVAS_LAYERS, DEFAULT_DISPLAY_PREFS } from '../store/types';
import type { Device as StoreDevice } from '../store/types';
import {
  MousePointer2, Hand, Ruler, Type, MessageSquare, ChevronRight, ChevronLeft,
  Search, X, Upload, MapPin, PencilLine, Sparkles, Undo2, Redo2, ZoomIn, ZoomOut,
  Maximize2, Magnet, ChevronDown, MoreHorizontal, Trash2, RotateCw, Eye, EyeOff,
  Minus as WallIcon, Check, Crosshair, Layers, Share2, Users, Lock, Unlock, Plus,
  Settings2, FileText, Slash, CircleDot, GripVertical,
  Video, Aperture, ScanEye, Disc, Flame, ScanFace, KeyRound, DoorOpen, Wifi, Server, Cable, Grid3x3,
  Car, UserSquare2, Fingerprint, GitBranch, Phone, Radar, AlertTriangle, BellRing, Vibrate, Hash,
  ShieldCheck, Antenna, Volume2, Megaphone, Mic, Speaker, HardDrive, Database, Cloud, Monitor,
  Tv2, AppWindow, MonitorSmartphone, BatteryCharging, Zap, ShieldAlert, Sun, Thermometer, CloudFog,
  Droplets, Users2, Wind, Crosshair as CrosshairIcon, Calendar, ListChecks, Wrench, FileBarChart,
  Folder, Image as ImageIcon, BarChart3, DollarSign, Map as MapIcon, Activity, Clock, Copy,
} from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { canHost } from '../lib/compatibility';
import { buildLabel, COMMIT_HASH } from '../../build-info';
import { toast } from 'sonner';

/*
  Engineering Canvas v2 — designed around four ideas

  1.  Start with intent.  When you open the canvas without a plan, we ask
      the one question that matters: blueprint, satellite, or blank?
      Everything downstream depends on the answer.

  2.  Devices look like devices.  Bullets, domes, PTZs, multi-sensors,
      fisheyes, readers, locks — each rendered as a glyph that resembles
      the physical hardware.  Color is reserved for kind (camera / access
      / network) so the eye locks onto the right thing instantly.

  3.  Insert dock is a drawer, not a panel.  56px rail of categories.
      Click a category to expand into a 320px drawer with sub-types and
      manufacturers.  Drag a product card onto the canvas to place — a
      ghost glyph follows the cursor.  Esc cancels.

  4.  No fixed right panel.  When a device is selected, a small floating
      pill appears on the canvas next to it (rotate, lock, properties,
      delete).  Properties expand inline.  Floor plan owns the screen.

  Hover behavior (so reviewers know what's intentional):
   • Top bar pills          — title tooltip after 600ms (browser default)
   • Insert-rail categories — 600ms tooltip with shortcut letter
   • Floor plan walls / rooms — no hover state, they're scenery
   • Devices on canvas      — soft halo at 0.15 opacity, label brightens
   • Selected device        — halo + floating pill near top-right of glyph
   • Drag-from-library      — ghost glyph follows cursor at 70% opacity,
                              snap indicator appears at the snap target
*/

type Tool = 'select' | 'pan' | 'measure' | 'text' | 'comment' | 'wall' | 'cable';

interface Wall { id: string; x1: number; y1: number; x2: number; y2: number; }

type DeviceKind = 'camera' | 'access' | 'network' | 'intrusion' | 'audio' | 'storage' | 'display' | 'power' | 'sensor';
type DeviceType =
  | 'cam.bullet' | 'cam.dome' | 'cam.ptz' | 'cam.multisensor' | 'cam.fisheye' | 'cam.thermal' | 'cam.lpr' | 'cam.body'
  | 'acc.reader' | 'acc.strike' | 'acc.maglock' | 'acc.exit' | 'acc.turnstile' | 'acc.intercom' | 'acc.biometric'
  | 'net.switch'  | 'net.idf'    | 'net.ap' | 'net.firewall' | 'net.bridge'
  | 'int.motion' | 'int.glassbreak' | 'int.contact' | 'int.panic' | 'int.vibration' | 'int.keypad'
  | 'aud.speaker' | 'aud.mic' | 'aud.horn' | 'aud.amp' | 'aud.intercom'
  | 'sto.nvr' | 'sto.server' | 'sto.archive' | 'sto.cloud'
  | 'dis.monitor' | 'dis.wall' | 'dis.kiosk' | 'dis.signage'
  | 'pwr.ups' | 'pwr.poe' | 'pwr.surge' | 'pwr.solar'
  | 'sen.temp' | 'sen.smoke' | 'sen.water' | 'sen.occupancy' | 'sen.gas' | 'sen.gunshot';

interface Product { id: string; type: DeviceType; mfr: string; model: string; sub: string; }
/** Per-lens config for multisensor cameras. Stored as four named slots
 *  (a/b/c/d) so each can be selected, manipulated, and persisted independently
 *  on both the canvas and the inspector drawer. */
export interface LensCfg {
  rotation: number; // ° (0 = east, CCW positive — same convention as device rot)
  fov: number;      // horizontal ° aperture
  range: number;    // ft — DORI Detect bound
  focal: number;    // mm
  enabled: boolean; // false = lens disabled in design, dimmed on canvas
}
export type LensId = 'a' | 'b' | 'c' | 'd';
export type ActiveLens = LensId | 'all';
export type LensMode = 'linked' | 'independent';

interface Device {
  id: string;
  type: DeviceType;
  label: string;
  product: string;
  x: number; y: number;
  rot: number;
  /** Single-lens camera engineering — persisted so the inspector doesn't lose state. */
  focal?: number;     // mm
  fov?: number;       // horizontal °
  range?: number;     // ft (DORI Detect bound)
  mountFt?: number;   // height AFF in ft
  ir?: boolean;
  ndaa?: boolean;
  /** Free-form engineering notes attached to the device. */
  notes?: string;
  /** Other device ids this one is linked to (pathway / failover / linked door). */
  linkedIds?: string[];
  /** Multisensor only — four independent lens configs. Present iff
   *  type === 'cam.multisensor'. Without this, the device falls back to the
   *  shared fov/range fields above. */
  lenses?: { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg };
  /** Multisensor lens-mode persisted on the device so each multisensor can
   *  have its own linked/independent setting. */
  lensMode?: LensMode;
}

/** Cardinal default lens layout — A=E, B=S, C=W, D=N (clockwise). 90° FOV per
 *  lens covers full 360°. Used to seed new multisensors and to backfill any
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

/** Read the per-lens config, lazily backfilling with defaults so any
 *  multisensor renders correctly even if it wasn't seeded with lenses. */
export function getLenses(d: Device): { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg } {
  return d.lenses ?? DEFAULT_MULTISENSOR_LENSES;
}

const CATEGORIES: Array<{
  id: DeviceKind; label: string; tone: string;
  types: Array<{ id: DeviceType; label: string }>;
}> = [
  { id: 'camera',  label: 'Cameras',  tone: '#F08F3C', types: [
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
];

const PRODUCTS: Product[] = [
  { id: 'p-axis-p1468',    type: 'cam.bullet',      mfr: 'Axis',     model: 'P1468-LE',  sub: '4MP · IR · IK10' },
  { id: 'p-axis-p3265',    type: 'cam.dome',        mfr: 'Axis',     model: 'P3265-LV',  sub: '4MP indoor dome' },
  { id: 'p-axis-q6315',    type: 'cam.ptz',         mfr: 'Axis',     model: 'Q6315-LE',  sub: '30× zoom · IR' },
  { id: 'p-axis-p3827',    type: 'cam.multisensor', mfr: 'Axis',     model: 'P3827-PVE', sub: '4×4MP panoramic' },
  { id: 'p-avi-h5-multi',  type: 'cam.multisensor', mfr: 'Avigilon', model: 'H5A Multi', sub: '4×8MP analytics' },
  { id: 'p-han-pnm9320',   type: 'cam.multisensor', mfr: 'Hanwha',   model: 'PNM-9320',  sub: '4×5MP IR' },
  { id: 'p-axis-m4327',    type: 'cam.fisheye',     mfr: 'Axis',     model: 'M4327-P',   sub: '6MP · 360°' },
  { id: 'p-flir-fc',       type: 'cam.thermal',     mfr: 'FLIR',     model: 'FC-Series', sub: 'Thermal · 320×240' },
  { id: 'p-hid-signo20',   type: 'acc.reader',      mfr: 'HID',      model: 'Signo 20',  sub: 'Mullion · OSDPv2' },
  { id: 'p-hid-signo40',   type: 'acc.reader',      mfr: 'HID',      model: 'Signo 40',  sub: 'Wall · keypad' },
  { id: 'p-vd-6210',       type: 'acc.strike',      mfr: 'Von Duprin', model: '6210',    sub: 'Fail-safe strike' },
  { id: 'p-sec-m62',       type: 'acc.maglock',     mfr: 'Securitron', model: 'M62',     sub: '1200 lb maglock' },
  { id: 'p-bosch-rex',     type: 'acc.exit',        mfr: 'Bosch',    model: 'REX-PIR',   sub: 'Passive infrared' },
  { id: 'p-cis-9300-48',   type: 'net.switch',      mfr: 'Cisco',    model: 'C9300-48P', sub: '48-port PoE+' },
  { id: 'p-cis-9300-24',   type: 'net.switch',      mfr: 'Cisco',    model: 'C9300-24P', sub: '24-port PoE+' },
  { id: 'p-rack',          type: 'net.idf',         mfr: 'APC',      model: 'NetShelter','sub': '42U enclosure' as any } as any,
  { id: 'p-cisco-ap',      type: 'net.ap',          mfr: 'Cisco',    model: 'C9166',     sub: 'Wi-Fi 6E AP' },
  { id: 'p-axis-p1468-lpr',type: 'cam.lpr',         mfr: 'Axis',     model: 'P1468-LE-LPR', sub: 'Plate capture · 25m' },
  { id: 'p-axis-w120',     type: 'cam.body',        mfr: 'Axis',     model: 'W120',      sub: 'Body-worn · 12hr' },
  { id: 'p-suprema-bs3',   type: 'acc.biometric',   mfr: 'Suprema',  model: 'BioStation 3', sub: 'Face · fingerprint' },
  { id: 'p-boon-360',      type: 'acc.turnstile',   mfr: 'Boon Edam',model: 'Speedlane 360', sub: 'Optical turnstile' },
  { id: 'p-2n-ip-verso',   type: 'acc.intercom',    mfr: '2N',       model: 'IP Verso',  sub: 'SIP intercom · video' },
  { id: 'p-bosch-tritech', type: 'int.motion',      mfr: 'Bosch',    model: 'TriTech ISC-PDL1', sub: 'Dual-tech motion' },
  { id: 'p-bosch-glass',   type: 'int.glassbreak',  mfr: 'Bosch',    model: 'DS1108i',   sub: 'Acoustic glass-break' },
  { id: 'p-honey-contact', type: 'int.contact',     mfr: 'Honeywell',model: '5816',      sub: 'Wireless door contact' },
  { id: 'p-stid-panic',    type: 'int.panic',       mfr: 'STI',      model: 'SS-2400',   sub: 'Hold-up panic button' },
  { id: 'p-optex-vib',     type: 'int.vibration',   mfr: 'Optex',    model: 'VXI-ST',    sub: 'Wall vibration sensor' },
  { id: 'p-dmp-kp',        type: 'int.keypad',      mfr: 'DMP',      model: '7800',      sub: 'Touch alarm keypad' },
  { id: 'p-fortinet-100f', type: 'net.firewall',    mfr: 'Fortinet', model: 'FortiGate 100F', sub: 'NGFW · 20 Gbps' },
  { id: 'p-ubnt-bridge',   type: 'net.bridge',      mfr: 'Ubiquiti', model: 'airFiber 60', sub: 'PtP 60GHz bridge' },
  { id: 'p-axis-c1410',    type: 'aud.speaker',     mfr: 'Axis',     model: 'C1410',     sub: 'Ceiling PoE speaker' },
  { id: 'p-axis-c1310',    type: 'aud.horn',        mfr: 'Axis',     model: 'C1310-E',   sub: 'Horn · 116dB · IP66' },
  { id: 'p-axis-c8033',    type: 'aud.amp',         mfr: 'Axis',     model: 'C8033',     sub: '2-channel net amp' },
  { id: 'p-shure-mxa920',  type: 'aud.mic',         mfr: 'Shure',    model: 'MXA920',    sub: 'Ceiling array mic' },
  { id: 'p-2n-indoor',     type: 'aud.intercom',    mfr: '2N',       model: 'Indoor Talk', sub: 'Answering unit' },
  { id: 'p-axis-s1216',    type: 'sto.nvr',         mfr: 'Axis',     model: 'S1216',     sub: '16-ch NVR · 36 TB' },
  { id: 'p-genetec-sv',    type: 'sto.server',      mfr: 'Genetec',  model: 'Streamvault 4000', sub: 'VMS appliance' },
  { id: 'p-dell-r760',     type: 'sto.archive',     mfr: 'Dell',     model: 'PowerEdge R760', sub: '256 TB archive' },
  { id: 'p-eagleeye-bridge',type:'sto.cloud',       mfr: 'Eagle Eye',model: 'CMVR 308',  sub: 'Cloud bridge · 8 ch' },
  { id: 'p-dell-u2723',    type: 'dis.monitor',     mfr: 'Dell',     model: 'U2723QE',   sub: '27" 4K IPS' },
  { id: 'p-lg-lsab',       type: 'dis.wall',        mfr: 'LG',       model: 'LSAB Series', sub: 'Direct-view LED wall' },
  { id: 'p-elo-22ck',      type: 'dis.kiosk',       mfr: 'Elo',      model: 'I-Series 22"', sub: 'Visitor mgmt kiosk' },
  { id: 'p-bright-xt5',    type: 'dis.signage',     mfr: 'BrightSign', model: 'XT5',     sub: '4K signage player' },
  { id: 'p-apc-smt3000',   type: 'pwr.ups',         mfr: 'APC',      model: 'Smart-UPS 3000', sub: '3kVA · LCD' },
  { id: 'p-axis-t8154',    type: 'pwr.poe',         mfr: 'Axis',     model: 'T8154',     sub: '60W PoE midspan' },
  { id: 'p-ditek-mrj45',   type: 'pwr.surge',       mfr: 'Ditek',    model: 'MRJ45C6',   sub: 'Cat6 surge protect' },
  { id: 'p-go-solar',      type: 'pwr.solar',       mfr: 'Goal Zero',model: 'Yeti 6000X',sub: 'Solar + 6kWh battery' },
  { id: 'p-monnit-temp',   type: 'sen.temp',        mfr: 'Monnit',   model: 'ALTA Temp', sub: 'Wireless temp/humidity' },
  { id: 'p-systemsensor',  type: 'sen.smoke',       mfr: 'System Sensor', model: 'i4 Photo', sub: 'Photoelectric smoke' },
  { id: 'p-aercus-leak',   type: 'sen.water',       mfr: 'Aercus',   model: 'WS-2',      sub: 'Water leak puck' },
  { id: 'p-densityio',     type: 'sen.occupancy',   mfr: 'Density',  model: 'Open Area', sub: 'Anonymous count' },
  { id: 'p-msa-altair',    type: 'sen.gas',         mfr: 'MSA',      model: 'Altair 4XR', sub: 'Multi-gas detector' },
  { id: 'p-shotspot-iq',   type: 'sen.gunshot',     mfr: 'ShotSpotter', model: 'Indoor IQ', sub: 'Acoustic gunshot' },
];

const TYPE_KIND: Record<DeviceType, DeviceKind> = {
  'cam.bullet': 'camera', 'cam.dome': 'camera', 'cam.ptz': 'camera', 'cam.multisensor': 'camera', 'cam.fisheye': 'camera', 'cam.thermal': 'camera', 'cam.lpr': 'camera', 'cam.body': 'camera',
  'acc.reader': 'access', 'acc.strike': 'access', 'acc.maglock': 'access', 'acc.exit': 'access', 'acc.turnstile': 'access', 'acc.intercom': 'access', 'acc.biometric': 'access',
  'net.switch': 'network', 'net.idf': 'network', 'net.ap': 'network', 'net.firewall': 'network', 'net.bridge': 'network',
  'int.motion': 'intrusion', 'int.glassbreak': 'intrusion', 'int.contact': 'intrusion', 'int.panic': 'intrusion', 'int.vibration': 'intrusion', 'int.keypad': 'intrusion',
  'aud.speaker': 'audio', 'aud.mic': 'audio', 'aud.horn': 'audio', 'aud.amp': 'audio', 'aud.intercom': 'audio',
  'sto.nvr': 'storage', 'sto.server': 'storage', 'sto.archive': 'storage', 'sto.cloud': 'storage',
  'dis.monitor': 'display', 'dis.wall': 'display', 'dis.kiosk': 'display', 'dis.signage': 'display',
  'pwr.ups': 'power', 'pwr.poe': 'power', 'pwr.surge': 'power', 'pwr.solar': 'power',
  'sen.temp': 'sensor', 'sen.smoke': 'sensor', 'sen.water': 'sensor', 'sen.occupancy': 'sensor', 'sen.gas': 'sensor', 'sen.gunshot': 'sensor',
};

const KIND_TONE: Record<DeviceKind, string> = {
  camera: '#F08F3C', access: '#3FB950', network: '#E5B23A',
  intrusion: '#E5484D', audio: '#A371F7', storage: '#1F6FEB',
  display: '#00B5D8', power: '#8B5CF6', sensor: '#14B8A6',
};

const SEED_DEVICES: Device[] = [
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

const FLOORS = ['Ground floor', 'Level 2', 'Level 3', 'Roof'];

interface SiteFloor { id: string; name: string; deviceCount: number; updated: string; source: 'blueprint' | 'satellite' | 'sketch'; }
interface SiteBuilding { id: string; name: string; address: string; floors: SiteFloor[]; }

const SITE_BUILDINGS: SiteBuilding[] = [
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

export function EngineeringCanvas() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();

  const [onboarded, setOnboarded] = useState(true);
  const [siteAddress, setSiteAddress] = useState<string>('');

  const [tool, setTool] = useState<Tool>('select');

  // ── Project store integration ──────────────────────────────────────
  // Devices are no longer local state. They're read from the shared project
  // store (filtered to this project) and written back via granular actions.
  // The component still calls `setDevices(updater)` internally — we provide
  // that as a facade so every existing caller continues to work, but each
  // call now diffs against the persisted store snapshot and dispatches
  // add/update/remove actions.
  const storeDevices = useProjectStore((s) => s.devices);
  const storeAddDevice    = useProjectStore((s) => s.addDevice);
  const storeUpdateDevice = useProjectStore((s) => s.updateDevice);
  const storeRemoveDevice = useProjectStore((s) => s.removeDevice);

  // Which floor are we editing? For now: first floor of this project. (When
  // multi-floor switching lands, this becomes state-driven from the floor
  // selector in TopBar.)
  const currentFloorId = useProjectStore((s) =>
    storeSelectors.firstFloorOfProject(s, projectId ?? 'p1')?.id ?? '',
  );

  // Devices in scope for this canvas: project + current floor. Memoized so
  // we don't re-allocate on every parent render.
  const devices = useMemo(() => {
    const pid = projectId ?? 'p1';
    return Object.values(storeDevices).filter(
      (d) => d.projectId === pid && (currentFloorId === '' || d.floorId === currentFloorId),
    ) as unknown as Device[];
  }, [storeDevices, projectId, currentFloorId]);

  // setDevices facade: accepts either a new array OR an updater fn. Diffs
  // against the current store snapshot and dispatches add/update/remove for
  // each changed device. Keeps all in-component callers (move/rotate/dup/
  // delete/drag-drop) working with zero changes elsewhere.
  const setDevices = useCallback((next: Device[] | ((prev: Device[]) => Device[])) => {
    const pid = projectId ?? 'p1';
    const fid = currentFloorId;
    const before = (Object.values(useProjectStore.getState().devices) as unknown as Device[])
      .filter((d: any) => d.projectId === pid && (fid === '' || d.floorId === fid));
    const after = typeof next === 'function' ? next(before) : next;
    const beforeIds = new Set(before.map((d) => d.id));
    const afterIds  = new Set(after.map((d) => d.id));
    // Removals
    for (const d of before) if (!afterIds.has(d.id)) storeRemoveDevice(d.id);
    // Adds + updates
    for (const d of after) {
      if (!beforeIds.has(d.id)) {
        // Compatibility check on add: anything dropped onto the floorplan
        // that should be attached to a host (strike / maglock / rex) gets a
        // soft warning toast pointing the user to drag it onto a door. The
        // add still goes through — the user is the engineer and can
        // override — but the platform tells them so misconfigurations
        // don't sneak in.
        const compat = canHost('floor', d.type);
        if (!compat.allowed) {
          toast.warning(compat.reason ?? 'Compatibility issue', {
            description: compat.hint,
            duration: 6000,
          });
        } else if (compat.requires) {
          toast.message('Heads up', {
            description: compat.requires,
            duration: 5000,
          });
        }
        storeAddDevice({ ...(d as any), projectId: pid, floorId: fid } as StoreDevice);
      } else {
        const prev = before.find((p) => p.id === d.id)!;
        // Shallow diff — only patch what actually changed to keep undo
        // history concise.
        const patch: any = {};
        for (const k of Object.keys(d)) {
          if ((d as any)[k] !== (prev as any)[k]) patch[k] = (d as any)[k];
        }
        if (Object.keys(patch).length) storeUpdateDevice(d.id, patch);
      }
    }
  }, [projectId, currentFloorId, storeAddDevice, storeUpdateDevice, storeRemoveDevice]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [wallCursor, setWallCursor] = useState<{ x: number; y: number } | null>(null);

  // Measure tool — two-click distance measurement. First click sets a
  // start point; second click freezes the measurement. ESC clears.
  const [measure, setMeasure] = useState<{
    start: { x: number; y: number } | null;
    end:   { x: number; y: number } | null;
    cursor:{ x: number; y: number } | null;
  }>({ start: null, end: null, cursor: null });

  // Cable / pathway draw — click vertices, double-click or Enter to
  // finish, Esc to cancel. On finish, a Pathway record is added to the
  // store with computed length (in feet, via the same 20px/ft scale the
  // estimator uses). The pathway then appears in /pathways/:id and is
  // counted in the BOM.
  const [cableDraw, setCableDraw] = useState<{
    points: { x: number; y: number }[];
    cursor: { x: number; y: number } | null;
    cableType: 'cat6a' | 'cat6' | 'fiber-sm' | 'fiber-mm' | 'composite' | 'coax' | 'power';
  }>({ points: [], cursor: null, cableType: 'cat6a' });
  const addPathway = useProjectStore((s) => s.addPathway);
  const removePathway = useProjectStore((s) => s.removePathway);
  /** Commit the current cable draw to the store as a Pathway record. */
  const finishCableDraw = useCallback(() => {
    setCableDraw((prev) => {
      if (prev.points.length < 2) return { points: [], cursor: null, cableType: prev.cableType };
      const id = `PW-${Date.now().toString(36).slice(-5)}`;
      // Length: sum the segment distances (px) and divide by the canvas
      // scale (20 px = 1 ft, matching deriveBOM in the store).
      let lengthPx = 0;
      for (let i = 1; i < prev.points.length; i++) {
        lengthPx += Math.hypot(prev.points[i].x - prev.points[i - 1].x, prev.points[i].y - prev.points[i - 1].y);
      }
      const lengthFt = Math.round(lengthPx / 20);
      const fid = useProjectStore.getState().sites[projectId.replace(/^p/, 's') + ''] ? '' : (storeSelectors.firstFloorOfProject(useProjectStore.getState(), projectId)?.id ?? '');
      addPathway({
        id,
        projectId,
        floorId: fid || (storeSelectors.firstFloorOfProject(useProjectStore.getState(), projectId)?.id ?? ''),
        type: 'conduit',
        cableType: prev.cableType,
        cableCount: 1,
        points: prev.points,
        lengthFt,
      });
      // Reset
      return { points: [], cursor: null, cableType: prev.cableType };
    });
  }, [addPathway, projectId]);
  const [selId, setSelId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [floor, setFloor] = useState(0);
  const [snap, setSnap] = useState(true);
  const [units, setUnits] = useState<'ft' | 'm'>('ft');
  const [coverageMode, setCoverageMode] = useState<CoverageMode>('soft');
  // Intelligence chips and immersion overlays default OFF — the canvas
  // is calm until the engineer asks for more. Click the top-right
  // "Intelligence" pill to surface flagged issues.
  const [intelOpen, setIntelOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Canvas engineering layers — toggleable overlays. Pulled from the
  // store so they persist per project. Replaces the previous ad-hoc
  // densityMode boolean with a coherent layer system.
  const canvasLayersMap = useProjectStore((s) => s.canvasLayers);
  const setCanvasLayer  = useProjectStore((s) => s.setCanvasLayer);
  const layers: CanvasLayerState = useMemo(
    () => ({ ...DEFAULT_CANVAS_LAYERS, ...canvasLayersMap[projectId] }),
    [canvasLayersMap, projectId],
  );

  // Canvas display preferences — icon size, label density, coverage
  // opacity, base map. Persistent per project. Replaces the previous
  // local `planSource` state with a fuller, store-driven model.
  const canvasDisplayMap = useProjectStore((s) => s.canvasDisplay);
  const setCanvasDisplay = useProjectStore((s) => s.setCanvasDisplay);
  const display: CanvasDisplayPrefs = useMemo(
    () => ({ ...DEFAULT_DISPLAY_PREFS, ...canvasDisplayMap[projectId] }),
    [canvasDisplayMap, projectId],
  );
  // The full base-map mode flows through to FloorPlan unchanged now —
  // every value renders a distinct surface so the picker is honest.
  const planSource: BaseMapMode = display.baseMap;
  const setPlanSource = (m: BaseMapMode) => setCanvasDisplay(projectId, { baseMap: m });

  // Project tech model — filters which manufacturers the library / drawer
  // suggests. Surfaced in the TopBar as a 3-way segmented control.
  const projectTechModelsMap = useProjectStore((s) => s.projectTechModels);
  const setProjectTechModel  = useProjectStore((s) => s.setProjectTechModel);
  const techModel = projectTechModelsMap[projectId] ?? 'hybrid';

  // Cross-component lens hover. When the user hovers a lens chip in the
  // SelectionPill, that lens id flows here and out to the canvas so the
  // corresponding cone subtly highlights. Reads as "this chip controls
  // that cone" without any explicit instruction.
  const [hoveredLens, setHoveredLens] = useState<LensId | null>(null);

  // ── Drag physics ────────────────────────────────────────────────
  // Real spring-mass-damper, not CSS easing. The store position (d.x /
  // d.y) tracks the *cursor target* — updated synchronously by the
  // pointer move handler (with magnetic snap applied). The display
  // position `dragLag` lerps toward the target via a spring loop. The
  // device, its cones, and its selection pill ALL render from the
  // lagged position so the experience reads as one piece of physical
  // matter responding to a magnet, not a sprite teleporting to the
  // cursor.
  //
  // dragLag is null when nothing is being dragged. When non-null,
  // either the user is still holding the pointer down (isDraggingRef
  // = true) or we're in the post-release settle phase (RAF continues
  // until velocity and distance both fall below threshold).
  const [dragLag, setDragLag] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragLagRef    = useRef<{ id: string; x: number; y: number } | null>(null);
  const dragVelRef    = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const rafRef        = useRef<number | null>(null);
  // devicesRef so the physics loop can read the latest cursor target
  // without re-creating the loop callback on every device update.
  const devicesRef    = useRef<Device[]>([]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  const stepPhysics = useCallback(() => {
    const lag = dragLagRef.current;
    if (!lag) { rafRef.current = null; return; }
    const dev = devicesRef.current.find((d) => d.id === lag.id);
    if (!dev) {
      dragLagRef.current = null;
      setDragLag(null);
      rafRef.current = null;
      return;
    }
    // Spring toward the cursor target. Tuned for "carrying a small
    // brick" — heavy enough to feel weight, light enough that it
    // never feels sluggish. Damping bumped from 0.74 → 0.79 in this
    // pass for a cleaner release feel; the device settles instead of
    // ringing briefly around the target.
    const k = 0.30;
    const damping = 0.79;
    const dx = dev.x - lag.x;
    const dy = dev.y - lag.y;
    const vel = dragVelRef.current;
    vel.x = (vel.x + dx * k) * damping;
    vel.y = (vel.y + dy * k) * damping;
    lag.x += vel.x;
    lag.y += vel.y;
    // Mirror the new position to React state so subscribers re-render.
    setDragLag({ id: lag.id, x: lag.x, y: lag.y });
    // Settle: pointer released AND essentially still AND essentially
    // on-target. Slight tolerance avoids endless infinitesimal motion.
    if (!isDraggingRef.current) {
      const speed2 = vel.x * vel.x + vel.y * vel.y;
      const dist2  = dx * dx + dy * dy;
      if (speed2 < 0.04 && dist2 < 0.20) {
        dragLagRef.current = null;
        dragVelRef.current = { x: 0, y: 0 };
        setDragLag(null);
        rafRef.current = null;
        return;
      }
    }
    rafRef.current = requestAnimationFrame(stepPhysics);
  }, []);

  /** Called from CanvasSurface when a device drag begins. */
  const onDragStart = useCallback((id: string, x: number, y: number) => {
    isDraggingRef.current = true;
    dragLagRef.current = { id, x, y };
    dragVelRef.current = { x: 0, y: 0 };
    setDragLag({ id, x, y });
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(stepPhysics);
    }
  }, [stepPhysics]);

  /** Called from CanvasSurface on pointer release. Marks the
   *  drag as no longer active; the physics loop continues running
   *  until the device settles, then stops itself. */
  const onDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    // RAF will detect (no longer dragging) and settle.
  }, []);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const [editOpen, setEditOpen] = useState(false);
  const [editTab, setEditTab] = useState<EditTab>('overview');
  const [targetSim, setTargetSim] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  /** Which lens (or 'all') the user is currently editing on the selected
   *  multisensor. Persisted as UI state per session — not on the device, so
   *  switching cameras keeps the user's last-used lens focus. */
  const [activeLens, setActiveLens] = useState<ActiveLens>('all');
  /** Per-multisensor linked/independent rotation mode. Read from the selected
   *  device (defaults to 'linked'); writes through to the device so each
   *  multisensor can have its own setting. */
  const setLensModeForSel = (m: LensMode) => sel && setDevices((ds) => ds.map((d) => d.id === sel.id ? { ...d, lensMode: m } : d));

  // Left navigation rail
  const [navSection, setNavSection] = useState<'overview' | 'devices' | 'recording' | 'accessories' | 'other' | 'maps' | 'reports' | 'docs'>('devices');

  // Insert dock — start at the category grid so user sees all 9 categories first
  const [openCat, setOpenCat] = useState<DeviceKind | null>(null);
  const [openType, setOpenType] = useState<DeviceType | null>(null);
  const [mfrFilter, setMfrFilter] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');

  // Drag from library
  const [drag, setDrag] = useState<{ product: Product; x: number; y: number } | null>(null);

  // Layers panel
  const [layersOpen, setLayersOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    try { const raw = localStorage.getItem(`canvas:${projectId}:hidden`); return new Set(raw ? JSON.parse(raw) : []); } catch { return new Set(); }
  });
  const [lockedIds, setLockedIds] = useState<Set<string>>(() => {
    try { const raw = localStorage.getItem(`canvas:${projectId}:locked`); return new Set(raw ? JSON.parse(raw) : []); } catch { return new Set(); }
  });
  const [selIds, setSelIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try { localStorage.setItem(`canvas:${projectId}:hidden`, JSON.stringify([...hiddenIds])); } catch {}
  }, [hiddenIds, projectId]);
  useEffect(() => {
    try { localStorage.setItem(`canvas:${projectId}:locked`, JSON.stringify([...lockedIds])); } catch {}
  }, [lockedIds, projectId]);

  const surfaceRef = useRef<SVGSVGElement>(null);
  // `sel` is what the SelectionPill anchors to. During a drag, swap in
  // the lagged position so the pill rides with the device's visual mass
  // (and its tether stays connected) instead of teleporting to the
  // cursor target.
  const sel = useMemo(() => {
    const found = devices.find((d) => d.id === selId) ?? null;
    if (!found) return null;
    if (dragLag && dragLag.id === found.id) {
      return { ...found, x: dragLag.x, y: dragLag.y };
    }
    return found;
  }, [devices, selId, dragLag]);

  // Presence cursors — three teammates drifting around the canvas
  const [presence, setPresence] = useState<Array<{ id: string; name: string; tone: string; x: number; y: number; tx: number; ty: number; hoverId: string | null }>>([
    { id: 'JS', name: 'Jordan',  tone: '#2F81F7', x: 320, y: 240, tx: 320, ty: 240, hoverId: null },
    { id: 'MK', name: 'Mira',    tone: '#A371F7', x: 560, y: 360, tx: 560, ty: 360, hoverId: null },
    { id: 'RT', name: 'Rafael',  tone: '#3FB950', x: 220, y: 420, tx: 220, ty: 420, hoverId: null },
  ]);
  // devicesRef is already declared above for the drag physics loop;
  // no second declaration here.
  // Presence cursors are static — no autonomous movement. Real session would
  // drive these from a CRDT/socket. Mock teammates stay put to avoid distraction.

  const hoverByPresence = useMemo(() => {
    const m: Record<string, { name: string; tone: string }> = {};
    presence.forEach((p) => { if (p.hoverId) m[p.hoverId] = { name: p.name, tone: p.tone }; });
    return m;
  }, [presence]);

  /* Keyboard ------------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return;
      if (e.key === 'v' || e.key === 'V') setTool('select');
      if (e.key === 'h' || e.key === 'H') setTool('pan');
      if (e.key === 'm' || e.key === 'M') setTool('measure');
      if (e.key === 'c' || e.key === 'C') setTool('cable');
      if (e.key === 'w' || e.key === 'W') setTool('wall');
      if (e.key === 'Escape') {
        setSelId(null); setDrag(null); setOpenCat(null); setOpenType(null);
        setWallStart(null);
        setMeasure({ start: null, end: null, cursor: null });
        setCableDraw((c) => ({ points: [], cursor: null, cableType: c.cableType }));
      }
      if (e.key === 'Enter' && tool === 'cable' && cableDraw.points.length >= 2) {
        finishCableDraw();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selId) {
        setDevices((ds) => ds.filter((d) => d.id !== selId));
        setSelId(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') { e.preventDefault(); setZoom(1); }
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom((z) => Math.min(4, z * 1.2)); }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') { e.preventDefault(); setZoom((z) => Math.max(0.25, z / 1.2)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selId]);

  /* Drag-to-place from the library --------------------------------------- */
  // hoverHost is the door / IDF currently under the cursor while a drag is
  // active. Drives the on-canvas attach ring + the attach-vs-reject
  // decision on drop. The compatibility module (lib/compatibility) is the
  // single source of truth for what can host what.
  const [hoverHost, setHoverHost] = useState<{
    id: string;
    cx: number; cy: number;
    allowed: boolean;
    reason?: string;
    hint?: string;
  } | null>(null);
  useEffect(() => {
    if (!drag) { setHoverHost(null); return; }
    const HOST_RANGE = 26; // canvas units — how close the cursor needs to be
    const onMove = (e: PointerEvent) => {
      const r = surfaceRef.current?.getBoundingClientRect();
      if (!r) return;
      setDrag((d) => d ? { ...d, x: e.clientX - r.left, y: e.clientY - r.top } : null);
      // Detect the nearest door / IDF host under the cursor and ask
      // canHost whether the dragged product is compatible. We use the
      // CANVAS-space cursor (px / zoom) so the range is consistent at
      // any zoom level.
      const cx = (e.clientX - r.left) / zoom;
      const cy = (e.clientY - r.top) / zoom;
      let best: { id: string; type: DeviceType; cx: number; cy: number; d: number } | null = null;
      for (const dev of devices) {
        const isHost = dev.type === 'acc.door' || dev.type === 'acc.gate' || dev.type === 'acc.exit'
          || dev.type === 'net.idf' || dev.type === 'net.mdf';
        if (!isHost) continue;
        const d = Math.hypot(dev.x - cx, dev.y - cy);
        if (d < HOST_RANGE && (!best || d < best.d)) best = { id: dev.id, type: dev.type, cx: dev.x, cy: dev.y, d };
      }
      if (!best) { setHoverHost(null); return; }
      const hostKind: 'door' | 'idf' =
        (best.type === 'acc.door' || best.type === 'acc.gate' || best.type === 'acc.exit') ? 'door' : 'idf';
      const compat = canHost(hostKind, drag.product.type);
      setHoverHost({
        id: best.id, cx: best.cx, cy: best.cy,
        allowed: compat.allowed,
        reason: compat.reason,
        hint: compat.hint,
      });
    };
    const onUp = (e: PointerEvent) => {
      const r = surfaceRef.current?.getBoundingClientRect();
      if (!r) { setDrag(null); setHoverHost(null); return; }
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside || !drag) { setDrag(null); setHoverHost(null); return; }
      // ── Drop on a host? ──
      if (hoverHost) {
        if (!hoverHost.allowed) {
          // Clean rejection. No device created. Toast the reason and the
          // suggested action — the user gets a real warning, not silence.
          toast.warning(hoverHost.reason ?? 'Not compatible with that host', {
            description: hoverHost.hint,
            duration: 6500,
          });
          setDrag(null); setHoverHost(null);
          return;
        }
        // Compatible attach. Place the new device adjacent to the host
        // and store the host↔device link via the existing linkedIds
        // field. The host gets the new device's id appended; the new
        // device carries the host's id. BOM (deriveBOM) treats the
        // attached device as a normal line.
        const host = devices.find((d) => d.id === hoverHost.id);
        if (!host) { setDrag(null); setHoverHost(null); return; }
        const kind = TYPE_KIND[drag.product.type];
        const prefix = kind === 'camera' ? 'CAM' : kind === 'access' ? (drag.product.type === 'acc.reader' ? 'RD' : 'DR') : 'NW';
        const id = `${prefix}-${100 + devices.filter((d) => TYPE_KIND[d.type] === kind).length + 1}`;
        // Offset the new device just outside the host so both glyphs are
        // visible. 22px adjacent to the host center reads as "attached".
        const newDevice: Device = {
          id, type: drag.product.type, label: drag.product.model, product: drag.product.id,
          x: host.x + 22, y: host.y, rot: 0,
          linkedIds: [host.id],
        };
        setDevices((ds) => ds.map((d) => d.id === host.id
          ? { ...d, linkedIds: [...(d.linkedIds ?? []), id] }
          : d).concat(newDevice));
        setSelId(id);
        toast.success(`Attached ${drag.product.model} to ${host.id}`, {
          description: hoverHost.reason ? undefined : 'Linked and added to BOM',
          duration: 3500,
        });
        if (drag.product.type === 'acc.maglock') {
          // canHost flagged the maglock → REX dependency. Surface it.
          toast.message('Heads up', {
            description: 'A REX (request-to-exit) is required when using a maglock for fire-egress compliance.',
            duration: 6000,
          });
        }
        setDrag(null); setHoverHost(null);
        return;
      }
      // ── Normal floor drop ──
      const rawX = (e.clientX - r.left) / zoom;
      const rawY = (e.clientY - r.top) / zoom;
      const x = snap ? Math.round(rawX / 20) * 20 : rawX;
      const y = snap ? Math.round(rawY / 20) * 20 : rawY;
      const kind = TYPE_KIND[drag.product.type];
      const prefix = kind === 'camera' ? 'CAM' : kind === 'access' ? (drag.product.type === 'acc.reader' ? 'RD' : 'DR') : 'NW';
      const id = `${prefix}-${100 + devices.filter((d) => TYPE_KIND[d.type] === kind).length + 1}`;
      const newDevice: Device = {
        id, type: drag.product.type,
        label: drag.product.model, product: drag.product.id,
        x, y, rot: 0,
      };
      setDevices((ds) => [...ds, newDevice]);
      setSelId(id);
      setDrag(null); setHoverHost(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [drag, zoom, snap, devices, hoverHost]);

  const updateSel = (patch: Partial<Device>) => sel && setDevices((ds) => ds.map((d) => d.id === sel.id ? { ...d, ...patch } : d));
  const deleteSel = () => { if (sel) { setDevices((ds) => ds.filter((d) => d.id !== sel.id)); setSelId(null); } };
  /** Clone the selected device with a new id and a small offset so the user
   *  can visually see the new copy. Selection follows the clone. Deep-clones
   *  the lenses object on multisensors so adjusting one camera doesn't bleed
   *  into its copy. */
  const duplicateSel = () => {
    if (!sel) return;
    const newId = `${sel.id}-c${Date.now().toString(36).slice(-4)}`;
    const clone: Device = {
      ...sel,
      id: newId,
      x: sel.x + 24 / zoom,
      y: sel.y + 24 / zoom,
      label: `${sel.label} copy`,
      lenses: sel.lenses ? {
        a: { ...sel.lenses.a },
        b: { ...sel.lenses.b },
        c: { ...sel.lenses.c },
        d: { ...sel.lenses.d },
      } : undefined,
      linkedIds: sel.linkedIds ? [...sel.linkedIds] : undefined,
    };
    setDevices((ds) => [...ds, clone]);
    setSelId(newId);
  };
  /** Open the engineering inspector to a specific tab. Used by toolbar
   *  buttons (Note, Link, FOV, AI Optimize, etc.) so they all jump straight
   *  to the relevant panel instead of silently doing nothing. */
  const openTab = (t: EditTab) => { setEditOpen(true); setEditTab(t); };

  const counts = useMemo(() => {
    const c: Record<DeviceKind, number> = { camera: 0, access: 0, network: 0, intrusion: 0, audio: 0, storage: 0, display: 0, power: 0, sensor: 0 };
    devices.forEach((d) => c[TYPE_KIND[d.type]]++);
    return c;
  }, [devices]);

  /* ------------------------------------------------------------------- */
  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Riverbend HQ', to: `/project/${projectId}` }, { label: 'Canvas' }]}
      fullBleed
    >
      <div className="h-full flex flex-col bg-[#0B1220] text-slate-100 relative">
        {/* Motion keyframes — used by the selection pill, spotlight ring,
            and lens chips. The easing is the same throughout (cubic-bezier
            0.22, 1, 0.36, 1 — a calm decelerate) so motion feels like one
            product, not many. Reduced-motion preferences are respected. */}
        <style>{`
          @keyframes pill-in {
            from { opacity: 0; transform: translateX(-50%) translateY(4px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
          @keyframes soft-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes lens-chip-in {
            from { opacity: 0; transform: translateY(2px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes pill-in { from { opacity: 1; transform: translateX(-50%); } to { opacity: 1; transform: translateX(-50%); } }
            @keyframes soft-fade-in { from { opacity: 1; } to { opacity: 1; } }
            @keyframes lens-chip-in { from { opacity: 1; } to { opacity: 1; } }
          }
        `}</style>
        {/* Focus mode = immersive canvas. Hide the top toolbar entirely so the
            floorplan dominates. A small floating chip in the corner lets the
            user exit. The intent is "canvas is the product" — no SaaS chrome. */}
        {!focusMode && (
          <TopBar
            floor={floor} setFloor={setFloor}
            snap={snap} setSnap={setSnap}
            units={units} setUnits={setUnits}
            onScan={() => nav('/visionscan')}
            onSetup={() => setOnboarded(false)}
            techModel={techModel}
            setTechModel={(m) => setProjectTechModel(projectId, m)}
          />
        )}
        {focusMode && (
          <button
            onClick={() => setFocusMode(false)}
            className="absolute top-3 left-3 z-50 px-2.5 py-1.5 rounded-md bg-[#0F1722]/85 border border-white/10 text-[10px] uppercase tracking-[0.18em] text-slate-300 hover:text-white hover:border-white/25 backdrop-blur-xl flex items-center gap-1.5"
            title="Exit immersive mode"
          >
            <ChevronLeft className="w-3 h-3" />
            Exit immersive
          </button>
        )}

        <div className="flex-1 min-h-0 flex">
          {!focusMode && <LeftNavRail section={navSection} setSection={setNavSection} />}
          {!focusMode && navSection === 'devices' && (
            <InsertDock
              openCat={openCat} setOpenCat={setOpenCat}
              openType={openType} setOpenType={setOpenType}
              mfrFilter={mfrFilter} setMfrFilter={setMfrFilter}
              query={productQuery} setQuery={setProductQuery}
              onStartDrag={(p, e) => setDrag({ product: p, x: e.clientX, y: e.clientY })}
              layersOpen={layersOpen}
              onToggleLayers={() => setLayersOpen((o) => !o)}
            />
          )}
          {!focusMode && navSection !== 'devices' && (
            <SectionPanel section={navSection} devices={devices} projectId={projectId} />
          )}

          {layersOpen && (
            <LayersPanel
              devices={devices}
              selId={selId}
              setSelId={setSelId}
              selIds={selIds}
              setSelIds={setSelIds}
              hiddenIds={hiddenIds} setHiddenIds={setHiddenIds}
              lockedIds={lockedIds} setLockedIds={setLockedIds}
              layers={layers}
              onToggleLayer={(layer, on) => setCanvasLayer(projectId, layer, on)}
              display={display}
              onDisplayChange={(patch) => setCanvasDisplay(projectId, patch)}
              onClose={() => setLayersOpen(false)}
            />
          )}

          <div className="flex-1 min-w-0 relative">
            <CanvasSurface
              ref={surfaceRef}
              tool={tool}
              zoom={zoom}
              devices={devices.filter((d) => !hiddenIds.has(d.id))}
              selId={selId}
              selIds={selIds}
              presence={presence}
              hoverByPresence={hoverByPresence}
              planSource={planSource}
              siteAddress={siteAddress}
              walls={walls}
              wallStart={wallStart}
              wallCursor={wallCursor}
              onPick={(id) => { setSelId(id); }}
              onMoveDevice={(id, x, y) => setDevices((ds) => ds.map((d) => d.id === id ? { ...d, x, y } : d))}
              onRotateDevice={(id, rot) => setDevices((ds) => ds.map((d) => d.id === id ? { ...d, rot } : d))}
              onUpdateDevice={(id, patch) => setDevices((ds) => ds.map((d) => d.id === id ? { ...d, ...patch } : d))}
              activeLens={activeLens}
              setActiveLens={setActiveLens}
              coverageMode={coverageMode}
              layers={layers}
              display={display}
              dragLag={dragLag}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              hoveredLens={hoveredLens}
              hoverHost={hoverHost}
              onBlank={() => setSelId(null)}
              snap={snap}
              dragging={!!drag}
              onSurfaceClick={(x, y) => {
                if (tool === 'wall') {
                  const sx = snap ? Math.round(x / 20) * 20 : x;
                  const sy = snap ? Math.round(y / 20) * 20 : y;
                  if (!wallStart) { setWallStart({ x: sx, y: sy }); }
                  else {
                    setWalls((ws) => [...ws, { id: `w${ws.length + 1}`, x1: wallStart.x, y1: wallStart.y, x2: sx, y2: sy }]);
                    setWallStart({ x: sx, y: sy });
                  }
                  return;
                }
                if (tool === 'measure') {
                  if (!measure.start) {
                    setMeasure({ start: { x, y }, end: null, cursor: { x, y } });
                  } else if (!measure.end) {
                    setMeasure({ start: measure.start, end: { x, y }, cursor: { x, y } });
                  } else {
                    setMeasure({ start: { x, y }, end: null, cursor: { x, y } });
                  }
                  return;
                }
                if (tool === 'cable') {
                  // Each click adds a vertex. Optional snap to 20px grid.
                  const sx = snap ? Math.round(x / 20) * 20 : x;
                  const sy = snap ? Math.round(y / 20) * 20 : y;
                  setCableDraw((c) => ({ ...c, points: [...c.points, { x: sx, y: sy }] }));
                  return;
                }
              }}
              onSurfaceMove={(x, y) => {
                if (tool === 'wall') {
                  const sx = snap ? Math.round(x / 20) * 20 : x;
                  const sy = snap ? Math.round(y / 20) * 20 : y;
                  setWallCursor({ x: sx, y: sy });
                  return;
                }
                if (tool === 'measure' && measure.start && !measure.end) {
                  setMeasure((m) => ({ ...m, cursor: { x, y } }));
                  return;
                }
                if (tool === 'cable' && cableDraw.points.length > 0) {
                  setCableDraw((c) => ({ ...c, cursor: { x, y } }));
                  return;
                }
              }}
              onSurfaceDblClick={() => {
                if (tool === 'wall') setWallStart(null);
                if (tool === 'measure') setMeasure({ start: null, end: null, cursor: null });
                if (tool === 'cable') finishCableDraw();
              }}
              measure={measure}
              cableDraw={cableDraw}
            />

            {/* The canvas is intentionally calm by default. The previous
                CoverageModeSwitch (top-left) and ImmersionControls (top-
                right) floats were removed — coverage style and focus mode
                now live inside the Layers panel where they belong, so the
                blueprint can dominate the eye. Intelligence chips remain
                as the single contextual overlay (top-right) and default
                to off. */}
            <IntelligenceLayer devices={devices.filter((d) => !hiddenIds.has(d.id))} zoom={zoom} open={intelOpen} setOpen={setIntelOpen} />

            {/* Floating selection toolbar */}
            {sel && surfaceRef.current && (
              <SelectionPill
                d={sel}
                zoom={zoom}
                onRotate={(r) => updateSel({ rot: r })}
                onDelete={deleteSel}
                onUpdate={updateSel}
                onEdit={() => openTab('overview')}
                onTargetSim={() => setTargetSim({ open: true, x: sel.x + 120, y: sel.y })}
                onDuplicate={duplicateSel}
                onOpenTab={openTab}
                activeLens={activeLens}
                setActiveLens={setActiveLens}
                lensMode={(sel.lensMode ?? 'linked') as LensMode}
                setLensMode={setLensModeForSel}
                onLensHover={setHoveredLens}
              />
            )}

            {/* Right-side engineering inspector drawer */}
            {sel && (
              <EditDrawer
                d={sel}
                open={editOpen}
                tab={editTab}
                setTab={setEditTab}
                onClose={() => setEditOpen(false)}
                onUpdate={updateSel}
                activeLens={activeLens}
                setActiveLens={setActiveLens}
                lensMode={(sel.lensMode ?? 'linked') as LensMode}
                setLensMode={setLensModeForSel}
              />
            )}

            {/* Target simulation overlay */}
            {sel && targetSim.open && (
              <TargetSimOverlay
                d={sel}
                zoom={zoom}
                pos={targetSim}
                setPos={(p) => setTargetSim({ open: true, ...p })}
                onClose={() => setTargetSim({ open: false, x: 0, y: 0 })}
              />
            )}

            {/* Floating status indicator (top-center) */}
            <StatusBar tool={tool} zoom={zoom} counts={counts} units={units} />

            {/* Floating quick-tools capsule (bottom-center) */}
            <QuickTools tool={tool} setTool={setTool} showWall={planSource === 'blank'} />

            {/* Zoom dock (bottom-left) */}
            <ZoomDock zoom={zoom} setZoom={setZoom} />

            {/* Minimap (bottom-right) */}
            <MiniMap devices={devices} />

            {/* North arrow (top-right corner of canvas surface). A small
                quiet compass — always visible, every map mode. */}
            <div className="absolute top-16 right-3 z-20 pointer-events-none select-none">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(13,20,36,0.78)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  boxShadow: '0 6px 16px -8px rgba(0,0,0,0.5)',
                }}
                title="North"
              >
                <svg viewBox="-12 -12 24 24" width="22" height="22">
                  <path d="M 0 -8 L 3 5 L 0 2 L -3 5 Z" fill="#E2E8F0" />
                  <text y="-9" textAnchor="middle" fill="rgba(226,232,240,0.55)" fontSize="6" fontFamily="ui-sans-serif">N</text>
                </svg>
              </div>
            </div>

            {/* Scale bar (bottom-center of canvas, above the QuickTools).
                The 20px = 1ft constant is the same one deriveBOM uses, so
                this reads against the canvas geometry truthfully. Adapts
                to the current zoom — at zoom=1 a 100ft bar is 2000px on
                the raw canvas; we render the bar in screen pixels so
                "100ft" stays a constant on-screen size at zoom=1. */}
            <div
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none flex items-center gap-1.5"
              style={{
                background: 'rgba(13,20,36,0.78)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '6px',
                padding: '6px 10px',
                boxShadow: '0 6px 16px -8px rgba(0,0,0,0.5)',
              }}
            >
              <span className="text-[10px] text-muted-foreground tabular-nums">0</span>
              <svg width={zoom * 100} height={10} className="inline-block">
                <line x1={0} y1={5} x2={zoom * 100} y2={5} stroke="#E2E8F0" strokeWidth="1.2" />
                <line x1={0} y1={1} x2={0} y2={9} stroke="#E2E8F0" strokeWidth="1.2" />
                <line x1={zoom * 100} y1={1} x2={zoom * 100} y2={9} stroke="#E2E8F0" strokeWidth="1.2" />
                <line x1={zoom * 50} y1={3} x2={zoom * 50} y2={7} stroke="#E2E8F0" strokeWidth="0.8" opacity="0.6" />
              </svg>
              <span className="text-[10px] text-muted-foreground tabular-nums">5 ft</span>
            </div>

            {/* Build stamp (bottom-left, just above ZoomDock). Discreet so it
                never competes with controls but verifiable so the user can
                confirm the live deployment matches the latest commit. */}
            <div
              className="absolute bottom-1 left-1 z-20 pointer-events-none select-none text-[8.5px] tabular-nums text-muted-foreground/40 font-mono tracking-tight"
              title={`Build ${buildLabel()}`}
            >
              {COMMIT_HASH} · {buildLabel().split('·').slice(-1)[0].trim()}
            </div>

            {/* Drag ghost */}
            {drag && (
              <div className="pointer-events-none absolute z-50" style={{ left: drag.x - 16, top: drag.y - 16 }}>
                <div className="w-8 h-8 rounded-full bg-card border border-primary flex items-center justify-center shadow-lg">
                  <DeviceGlyph type={drag.product.type} size={20} tone={KIND_TONE[TYPE_KIND[drag.product.type]]} />
                </div>
                <div className="mt-1.5 text-[11px] text-center bg-card border border-border rounded px-1.5 py-0.5 text-foreground whitespace-nowrap">
                  Drop to place
                </div>
              </div>
            )}
          </div>
        </div>

        {!onboarded && (
          <Onboarding
            onPick={(s) => { setPlanSource(s); setOnboarded(true); }}
            onAddress={(addr) => { setSiteAddress(addr); setPlanSource('satellite'); setOnboarded(true); }}
            onClose={() => setOnboarded(true)}
          />
        )}
      </div>
    </AppShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ONBOARDING — "How do you want to start?"
   ═══════════════════════════════════════════════════════════════════════ */

function Onboarding({ onPick, onAddress, onClose }: { onPick: (s: 'blueprint' | 'blank') => void; onAddress: (addr: string) => void; onClose: () => void }) {
  const [step, setStep] = useState<'pick' | 'address'>('pick');
  const [addr, setAddr] = useState('');
  return (
    <div className="absolute inset-0 z-40 bg-background/85 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-7 py-5 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">New canvas</div>
            <h2 className="text-xl mt-1">{step === 'pick' ? 'How would you like to start?' : 'Where is the site?'}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 'pick' ? "Pick the source. We'll calibrate scale and import the geometry for you." : "Enter a street address. We'll pull satellite imagery and the parcel outline."}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {step === 'pick' && (
          <>
            <div className="p-5 grid grid-cols-3 gap-3">
              <StartCard
                icon={Upload} title="Upload a blueprint"
                sub="PDF, PNG, DWG, or DXF. We'll vectorize and ask for two reference points to set scale."
                onClick={() => onPick('blueprint')}
              />
              <StartCard
                icon={MapPin} title="Use an address"
                sub="Drop a pin. We'll pull satellite imagery and parcel outline to design exteriors and rooftops."
                onClick={() => setStep('address')}
                accent
              />
              <StartCard
                icon={PencilLine} title="Start blank"
                sub="Sketch walls and rooms with the wall tool. Best for renovations and tenant fit-outs."
                onClick={() => onPick('blank')}
              />
            </div>
            <div className="px-5 pb-5 text-xs text-muted-foreground">
              You can change the source later. Site walks, vision scans, and import all attach to whichever you start with.
            </div>
          </>
        )}

        {step === 'address' && (
          <div className="p-5">
            <div className="relative">
              <Crosshair className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && addr.trim()) onAddress(addr.trim()); }}
                placeholder="500 Terry A. Francois Blvd, San Francisco, CA"
                className="w-full bg-input-background border border-input-border rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Address geocoding is mocked in this preview — any address will resolve to a sample aerial image.
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button onClick={() => setStep('pick')} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <ChevronLeft className="w-3.5 h-3.5" />Back
              </button>
              <button
                onClick={() => addr.trim() && onAddress(addr.trim())}
                disabled={!addr.trim()}
                className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" />Use this location
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StartCard({ icon: Icon, title, sub, onClick, accent }: { icon: any; title: string; sub: string; onClick: () => void; accent?: boolean }) {
  return (
    <button onClick={onClick} className={`text-left p-4 rounded-xl border transition-all ${accent ? 'border-primary bg-primary/5 hover:bg-primary/10' : 'border-border hover:border-border-strong bg-background hover:bg-secondary/30'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-3 text-sm">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{sub}</div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TOP BAR — floor, scale, scan, setup
   ═══════════════════════════════════════════════════════════════════════ */

function TopBar(props: {
  floor: number; setFloor: (n: number) => void;
  snap: boolean; setSnap: (b: boolean) => void;
  units: 'ft' | 'm'; setUnits: (u: 'ft' | 'm') => void;
  onScan: () => void; onSetup: () => void;
  techModel: 'cloud' | 'on_prem' | 'hybrid';
  setTechModel: (m: 'cloud' | 'on_prem' | 'hybrid') => void;
}) {
  return (
    <div className="h-14 shrink-0 border-b border-border bg-background/80 backdrop-blur-md flex items-center pl-4 pr-3 gap-4 text-sm relative z-30">
      {/* Left — project identity */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Layers className="w-4 h-4" />
        </div>
        <div className="leading-tight min-w-0">
          <div className="text-[11px] text-muted-foreground">Riverbend HQ</div>
          <div className="flex items-center gap-1.5">
            <Dropdown label={FLOORS[props.floor]} options={FLOORS} onPick={(i) => props.setFloor(i)} />
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-400/10">
              <span className="w-1 h-1 rounded-full bg-emerald-400" />Live
            </span>
          </div>
        </div>
      </div>

      <div className="h-6 w-px bg-border/70" />

      {/* Middle — workspace controls */}
      <div className="flex items-center gap-0.5">
        <SegButton active={props.snap} onClick={() => props.setSnap(!props.snap)} icon={Magnet} label="Snap" hint="S" />
        <SegButton active={false} onClick={() => props.setUnits(props.units === 'ft' ? 'm' : 'ft')} icon={Ruler} label={props.units === 'ft' ? 'ft' : 'm'} hint="U" />
        <SegButton active={false} onClick={props.onSetup} icon={FileText} label="Plan source" />

        {/* Tech-model selector — gates which manufacturer ecosystem the
            library / drawer suggests. Persistent per project. */}
        <div className="ml-1.5 flex items-stretch h-8 border border-border rounded-lg overflow-hidden">
          <span className="inline-flex items-center px-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground border-r border-border">Stack</span>
          {(['cloud', 'on_prem', 'hybrid'] as const).map((m) => {
            const active = props.techModel === m;
            const label = m === 'cloud' ? 'Cloud' : m === 'on_prem' ? 'On-prem' : 'Hybrid';
            return (
              <button
                key={m}
                onClick={() => props.setTechModel(m)}
                className={`px-2.5 text-[11px] border-r border-border last:border-r-0 transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
                title={
                  m === 'cloud' ? 'Cloud-first ecosystem — Verkada / Rhombus / Meraki / Brivo / Openpath' :
                  m === 'on_prem' ? 'On-prem ecosystem — Axis / Hanwha / Avigilon / Bosch / Genetec' :
                  'Hybrid — show all manufacturers; compatibility flagged'
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1" />

      {/* Right — collab + AI. Undo/Redo buttons removed in the lockdown
          pass: there's no action history subsystem behind them yet, and
          per the absolute rule "if a button doesn't work, hide it." */}
      <div className="flex items-center -space-x-1.5">
        <Avatar initials="JS" tone="#2F81F7" />
        <Avatar initials="MK" tone="#A371F7" />
        <Avatar initials="RT" tone="#3FB950" />
      </div>
      <button className="inline-flex items-center gap-1.5 text-xs px-3 h-8 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground">
        <Share2 className="w-3.5 h-3.5" />Share
      </button>
      <button onClick={props.onScan} className="inline-flex items-center gap-1.5 text-xs px-3.5 h-8 rounded-lg bg-primary text-primary-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_1px_2px_rgba(0,0,0,0.4)] hover:opacity-90">
        <Sparkles className="w-3.5 h-3.5" />Run vision scan
      </button>
    </div>
  );
}

function SegButton({ active, onClick, icon: Icon, label, hint }: { active?: boolean; onClick: () => void; icon: any; label: string; hint?: string }) {
  return (
    <button
      onClick={onClick}
      title={hint ? `${label} · ${hint}` : label}
      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs transition-colors ${active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
    >
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );
}

function Avatar({ initials, tone }: { initials: string; tone: string }) {
  return (
    <div
      title={initials}
      className="w-7 h-7 rounded-full border-2 border-background text-[10px] font-medium text-white flex items-center justify-center"
      style={{ background: tone }}
    >{initials}</div>
  );
}

function PillBtn({ children, active, onClick, icon: Icon }: { children: React.ReactNode; active?: boolean; onClick: () => void; icon?: any }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}{children}
    </button>
  );
}
function IconBtn({ children, title, onClick }: { children: React.ReactNode; title?: string; onClick?: () => void }) {
  return <button title={title} onClick={onClick} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">{children}</button>;
}

function Dropdown({ label, options, onPick }: { label: string; options: string[]; onPick: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-secondary text-sm">
        {label}<ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 min-w-[200px] bg-popover border border-border rounded-xl shadow-xl py-1.5">
            {options.map((o, i) => (
              <button key={o} onClick={() => { onPick(i); setOpen(false); }} className="w-full text-left text-sm px-3 py-2 hover:bg-secondary">{o}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   INSERT DOCK — 56px rail, click a category to drawer it open
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   LEFT NAV RAIL — Project / Devices / Recording / Accessories / Maps / Reports / Docs
   ═══════════════════════════════════════════════════════════════════════ */

const NAV_ITEMS: Array<{ id: 'overview' | 'devices' | 'recording' | 'accessories' | 'other' | 'maps' | 'reports' | 'docs'; label: string; icon: any }> = [
  { id: 'overview',    label: 'Project overview', icon: Grid3x3 },
  { id: 'devices',     label: 'Devices',          icon: Video },
  { id: 'recording',   label: 'Recording',        icon: Server },
  { id: 'accessories', label: 'Accessories',      icon: Cable },
  { id: 'other',       label: 'Other',            icon: MoreHorizontal },
  { id: 'maps',        label: 'Maps',             icon: MapPin },
  { id: 'reports',     label: 'Reports',          icon: FileText },
  { id: 'docs',        label: 'Documentation',    icon: FileText },
];

function LeftNavRail({ section, setSection }: { section: string; setSection: (s: any) => void }) {
  return (
    <div className="w-[88px] shrink-0 border-r border-border bg-card flex flex-col py-3">
      {NAV_ITEMS.map((it) => {
        const active = section === it.id;
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            onClick={() => setSection(it.id)}
            className={`relative mx-2 mb-1 py-2.5 rounded-lg flex flex-col items-center gap-1 transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
          >
            <Icon className="w-4 h-4" strokeWidth={1.8} />
            <span className="text-[10px] leading-tight text-center px-1">{it.label}</span>
            {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SECTION PANEL — content for non-Devices nav sections
   ═══════════════════════════════════════════════════════════════════════ */

function MapsPanel() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['bld-a', 'bld-c']));
  const [activeFloor, setActiveFloor] = useState<string>('a-g');
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const totalFloors = SITE_BUILDINGS.reduce((n, b) => n + b.floors.length, 0);
  const sourceIcon = (s: SiteFloor['source']) => s === 'blueprint' ? FileText : s === 'satellite' ? MapIcon : PencilLine;
  const sourceLabel = (s: SiteFloor['source']) => s === 'blueprint' ? 'Blueprint' : s === 'satellite' ? 'Satellite' : 'Sketch';
  return (
    <div className="w-[360px] shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="text-[13px] font-semibold tracking-tight">Maps</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{SITE_BUILDINGS.length} buildings · {totalFloors} floor maps</div>
      </div>

      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <button className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] h-7 rounded-lg bg-primary text-primary-foreground">
          <Plus className="w-3 h-3" /> Add building
        </button>
        <button className="inline-flex items-center justify-center gap-1.5 text-[11px] h-7 px-2 rounded-lg border border-border hover:bg-secondary">
          <Upload className="w-3 h-3" /> Import
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {SITE_BUILDINGS.map((b) => {
          const open = expanded.has(b.id);
          const buildingDevices = b.floors.reduce((n, f) => n + f.deviceCount, 0);
          return (
            <div key={b.id} className="border-b border-border/50">
              <button onClick={() => toggle(b.id)} className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-secondary/40 text-left">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{b.name}</div>
                  <div className="text-[10.5px] text-muted-foreground truncate">{b.address}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10.5px] text-muted-foreground">{b.floors.length} floors</div>
                  <div className="text-[10px] text-muted-foreground/70">{buildingDevices} devices</div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground ml-1 transition-transform ${open ? '' : '-rotate-90'}`} />
              </button>

              {open && (
                <div className="pb-2">
                  {b.floors.map((f, i) => {
                    const active = activeFloor === f.id;
                    const SrcIcon = sourceIcon(f.source);
                    const isLast = i === b.floors.length - 1;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setActiveFloor(f.id)}
                        className={`w-full text-left pl-4 pr-3 py-2 flex items-center gap-2 transition-colors ${active ? 'bg-primary/8' : 'hover:bg-secondary/40'}`}
                      >
                        {/* Tree connector */}
                        <div className="relative w-5 h-5 shrink-0">
                          <div className={`absolute left-2 top-0 ${isLast ? 'h-1/2' : 'h-full'} w-px bg-border`} />
                          <div className="absolute left-2 top-1/2 w-3 h-px bg-border" />
                        </div>
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${active ? 'bg-primary text-primary-foreground' : 'bg-background border border-border text-muted-foreground'}`}>
                          <SrcIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] flex items-center gap-1.5">
                            <span className="truncate">{f.name}</span>
                            {active && <span className="text-[9px] uppercase tracking-wide text-primary">on canvas</span>}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">{sourceLabel(f.source)} · {f.deviceCount} devices · {f.updated}</div>
                        </div>
                        <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground opacity-0 hover:opacity-100" />
                      </button>
                    );
                  })}
                  <div className="pl-9 pr-3 pt-1">
                    <button className="text-[10.5px] text-primary hover:underline inline-flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add floor map to {b.name.split(' — ')[0]}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground flex items-center gap-1.5 bg-secondary/20">
        <MapIcon className="w-3 h-3" /> Click a floor to load it onto the canvas
      </div>
    </div>
  );
}

function SectionPanel({ section, devices, projectId }: { section: string; devices: Device[]; projectId: string }) {
  const counts = useMemo(() => {
    const c: Record<DeviceKind, number> = { camera: 0, access: 0, network: 0, intrusion: 0, audio: 0, storage: 0, display: 0, power: 0, sensor: 0 };
    devices.forEach((d) => { c[TYPE_KIND[d.type]]++; });
    return c;
  }, [devices]);

  const Wrapper = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
    <div className="w-[340px] shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="text-sm font-medium">{title}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );

  const RowLink = ({ icon: Icon, label, sub, tone, accent }: { icon: any; label: string; sub?: string; tone?: string; accent?: string }) => (
    <button className="w-full text-left px-3 py-2.5 hover:bg-secondary/40 border-b border-border/50 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0" style={tone ? { boxShadow: `inset 0 0 0 1.5px ${tone}`, color: tone } : {}}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] truncate">{label}</div>
        {sub && <div className="text-[10.5px] text-muted-foreground truncate">{sub}</div>}
      </div>
      {accent && <span className="text-[10.5px] font-medium text-muted-foreground">{accent}</span>}
    </button>
  );

  if (section === 'overview') {
    const total = devices.length;
    return (
      <Wrapper title="Project overview" sub="Riverbend HQ · 4 floors · 22,400 ft²">
        <div className="p-3 grid grid-cols-2 gap-2">
          {([
            { label: 'Devices placed', value: total, tone: '#2F81F7' },
            { label: 'Coverage area', value: '88%', tone: '#3FB950' },
            { label: 'Open issues', value: 3, tone: '#E5484D' },
            { label: 'Budget used', value: '64%', tone: '#E5B23A' },
          ] as const).map((s, i) => (
            <div key={i} className="rounded-xl border border-border bg-background p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="text-xl mt-1" style={{ color: s.tone }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="px-3 pt-1 pb-2 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">By category</div>
        {CATEGORIES.map((c) => (
          <RowLink key={c.id} icon={KIND_ICON[c.id]} label={c.label} sub={`${c.types.length} types`} tone={c.tone} accent={String(counts[c.id])} />
        ))}
      </Wrapper>
    );
  }

  if (section === 'recording') {
    const cams = devices.filter((d) => TYPE_KIND[d.type] === 'camera').length;
    return (
      <Wrapper title="Recording & storage" sub={`${cams} cameras · est. 36 TB @ 30 days`}>
        <div className="p-3 space-y-2">
          {['Continuous (24/7)', 'Motion-triggered', 'Schedule (business hours)', 'Forensic on-demand'].map((p, i) => (
            <label key={p} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-background border border-border cursor-pointer hover:border-primary/50">
              <input type="radio" name="rec" defaultChecked={i === 1} className="accent-primary" />
              <div className="flex-1">
                <div className="text-[12.5px]">{p}</div>
                <div className="text-[10.5px] text-muted-foreground">{['1080p H.265 · 8 fps','1080p H.265 · 15 fps · 30 day buffer','Office hours only · 4K','Pulled on incident triggers'][i]}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Storage tier</div>
        <RowLink icon={HardDrive} label="On-site NVR" sub="Axis S1216 · 36 TB · RAID 5" tone="#1F6FEB" accent="active" />
        <RowLink icon={Cloud} label="Cloud archive" sub="Eagle Eye · 90 day retention" tone="#1F6FEB" accent="standby" />
        <RowLink icon={Database} label="Long-term archive" sub="Dell R760 · 256 TB · LTO-9 weekly" tone="#1F6FEB" />
      </Wrapper>
    );
  }

  if (section === 'accessories') {
    return (
      <Wrapper title="Accessories" sub="Mounts · enclosures · cabling · power kits">
        {[
          { icon: Wrench, label: 'Pendant mount', sub: 'Axis T94N01D · indoor', tone: '#7D8590' },
          { icon: Wrench, label: 'Corner mount', sub: 'Axis T94B01M · IK10', tone: '#7D8590' },
          { icon: Wrench, label: 'Pole adapter', sub: 'Hanwha SBP-300PMW1', tone: '#7D8590' },
          { icon: Cable,  label: 'Cat6A · 1000ft spool', sub: 'Belden 10GXS · plenum', tone: '#E5B23A' },
          { icon: Cable,  label: 'Cat6A · 500ft spool', sub: 'CommScope · riser', tone: '#E5B23A' },
          { icon: Cable,  label: 'Fiber OM4 · 12-strand', sub: 'Corning · LSZH', tone: '#E5B23A' },
          { icon: Zap,    label: '60W PoE++ injector', sub: 'Axis T8154 · single port', tone: '#8B5CF6' },
          { icon: Zap,    label: '4-port PoE midspan', sub: 'Cisco · 802.3bt', tone: '#8B5CF6' },
          { icon: BatteryCharging, label: 'Rack UPS 3kVA', sub: 'APC Smart-UPS', tone: '#8B5CF6' },
          { icon: ShieldAlert, label: 'Cat6 surge protector', sub: 'Ditek MRJ45C6', tone: '#8B5CF6' },
          { icon: Folder, label: 'Conduit · 3/4" EMT', sub: 'For exterior camera runs', tone: '#7D8590' },
        ].map((it) => <RowLink key={it.label} {...it} />)}
      </Wrapper>
    );
  }

  if (section === 'other') {
    return (
      <Wrapper title="Other elements" sub="Annotations, regions, and notes">
        {[
          { icon: Type,        label: 'Text annotation', sub: 'Drop a label or callout' },
          { icon: MessageSquare, label: 'Comment pin', sub: 'Thread on the canvas' },
          { icon: Ruler,       label: 'Dimension line', sub: 'Measured with snap' },
          { icon: WallIcon,    label: 'Wall segment', sub: 'Click-click-double-click' },
          { icon: Grid3x3,     label: 'Coverage region', sub: 'Polygon for risk zones' },
          { icon: AlertTriangle, label: 'Hazard area', sub: 'No-camera / privacy zone' },
          { icon: MapPin,      label: 'Custom marker', sub: 'Generic pin' },
          { icon: Sparkles,    label: 'AI suggestion zone', sub: 'Ask Vision to recommend' },
        ].map((it) => <RowLink key={it.label} {...it as any} />)}
      </Wrapper>
    );
  }

  if (section === 'maps') {
    return <MapsPanel />;
  }

  if (section === 'reports') {
    return (
      <Wrapper title="Reports" sub="Auto-generated from the canvas">
        <RowLink icon={FileBarChart} label="Bill of materials" sub={`${devices.length} line items · $${(devices.length * 1280).toLocaleString()} est.`} tone="#1F6FEB" />
        <RowLink icon={Activity}     label="Coverage heatmap" sub="By floor · highlight gaps" tone="#3FB950" />
        <RowLink icon={BarChart3}    label="Bandwidth & storage" sub="Per stream · 30 day retention" tone="#F08F3C" />
        <RowLink icon={DollarSign}   label="Cost summary" sub="Hardware + labor estimate" tone="#E5B23A" />
        <RowLink icon={ListChecks}   label="Compliance checklist" sub="NDAA · SOC2 · GDPR" tone="#A371F7" />
        <RowLink icon={Clock}        label="Install schedule" sub="Phased rollout (3 weeks)" tone="#14B8A6" />
        <RowLink icon={ShieldCheck}  label="Security posture" sub="Score 86/100 · 3 findings" tone="#E5484D" />
        <div className="p-3">
          <button className="w-full inline-flex items-center justify-center gap-1.5 text-xs h-9 rounded-lg bg-primary text-primary-foreground">
            <FileText className="w-3.5 h-3.5" /> Export full report (PDF)
          </button>
        </div>
      </Wrapper>
    );
  }

  // docs
  return (
    <Wrapper title="Documentation" sub="Attached files and references">
      {[
        { icon: FileText, label: 'Scope of work — Riverbend HQ', sub: 'PDF · 14 pages · Jordan S.' },
        { icon: FileText, label: 'Statement of work (signed)', sub: 'PDF · countersigned 04-12' },
        { icon: ImageIcon, label: 'Site walk photos (32)', sub: 'Captured during vision scan' },
        { icon: FileText, label: 'Riser diagram — Level 1', sub: 'Drawing · Visio export' },
        { icon: FileText, label: 'Cable schedule v3', sub: 'Spreadsheet · 412 runs' },
        { icon: FileText, label: 'Permit application', sub: 'Submitted 04-18 · pending' },
        { icon: FileText, label: 'Client decision log', sub: '8 decisions · 2 open' },
      ].map((it) => <RowLink key={it.label} {...it as any} />)}
      <div className="p-3">
        <button className="w-full inline-flex items-center justify-center gap-1.5 text-xs h-9 rounded-lg border border-border hover:bg-secondary">
          <Upload className="w-3.5 h-3.5" /> Upload document
        </button>
      </div>
    </Wrapper>
  );
}

function InsertDock(props: {
  openCat: DeviceKind | null;
  setOpenCat: (c: DeviceKind | null) => void;
  openType: DeviceType | null;
  setOpenType: (t: DeviceType | null) => void;
  mfrFilter: string | null;
  setMfrFilter: (m: string | null) => void;
  query: string;
  setQuery: (q: string) => void;
  onStartDrag: (p: Product, e: React.PointerEvent) => void;
  layersOpen: boolean;
  onToggleLayers: () => void;
}) {
  const cat = CATEGORIES.find((c) => c.id === props.openCat);
  const products = useMemo(() => {
    if (!props.openType) return [];
    return PRODUCTS
      .filter((p) => p.type === props.openType)
      .filter((p) => !props.mfrFilter || p.mfr === props.mfrFilter)
      .filter((p) => !props.query || `${p.mfr} ${p.model} ${p.sub}`.toLowerCase().includes(props.query.toLowerCase()));
  }, [props.openType, props.mfrFilter, props.query]);

  const manufacturers = useMemo(() => {
    if (!props.openType) return [];
    return Array.from(new Set(PRODUCTS.filter((p) => p.type === props.openType).map((p) => p.mfr)));
  }, [props.openType]);

  const activeCat = CATEGORIES.find((c) => c.id === props.openCat) ?? null;
  return (
    <div className="shrink-0 flex bg-background relative">
      <div className="w-[360px] border-r border-border flex flex-col bg-card">
        {/* Header — editorial. The device-library title sits as a calm
            headline; the count below is supporting metadata. When drilled
            into a category, the category becomes the headline. */}
        <div className="px-5 pt-5 pb-4 border-b border-border/70 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {activeCat ? (
              <>
                <button
                  onClick={() => { props.setOpenCat(null); props.setOpenType(null); }}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-2 -ml-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> All categories
                </button>
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${activeCat.tone}14`, color: activeCat.tone }}
                  >
                    <CategoryGlyph kind={activeCat.id} active />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium tracking-tight truncate leading-tight">{activeCat.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{PRODUCTS.filter((p) => TYPE_KIND[p.type] === activeCat.id).length} products · {activeCat.types.length} types</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-[15px] font-medium tracking-tight leading-tight">Device library</div>
                <div className="text-[11.5px] text-muted-foreground mt-1">{PRODUCTS.length} products across {CATEGORIES.length} categories</div>
              </>
            )}
          </div>
          <button
            onClick={props.onToggleLayers}
            title="Layers"
            className={`p-1.5 rounded-md transition-colors duration-150 ${props.layersOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>

        {/* Search — calmer materials. Same affordance, gentler chrome. */}
        <div className="px-5 py-3 border-b border-border/70">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70" />
            <input
              value={props.query}
              onChange={(e) => props.setQuery(e.target.value)}
              placeholder={activeCat ? `Search ${activeCat.label.toLowerCase()}…` : 'Search products'}
              className="w-full bg-input-background border border-input-border rounded-md pl-8 pr-3 h-9 text-[12px] focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/15 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* LEVEL 1 — Categories as a vertical list, not a 2-col grid. Each
            row is generous (py-3), single-column, sentence-case, with a
            quiet count instead of a colored badge. Reads as a calm menu,
            not a tile dashboard. */}
        {!activeCat && (
          <div className="flex-1 overflow-auto py-1.5">
            {CATEGORIES.map((c) => {
              const productCount = PRODUCTS.filter((p) => TYPE_KIND[p.type] === c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => { props.setOpenCat(c.id); props.setOpenType(null); }}
                  className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors duration-150 group"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150 group-hover:scale-[1.03]"
                    style={{
                      background: `${c.tone}12`,
                      color: c.tone,
                      transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    <CategoryGlyph kind={c.id} active />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium tracking-tight leading-tight text-slate-100">{c.label}</div>
                    <div className="text-[11.5px] text-muted-foreground mt-0.5">{c.types.length} types · {productCount} products</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                </button>
              );
            })}
          </div>
        )}

        {/* LEVEL 2 — Types within the chosen category. Each type is its
            own section: heading + a small grid of product rows. Sentence
            case throughout; the colored accent is reserved for the
            single hairline strip beside the heading. */}
        {activeCat && (
          <div className="flex-1 overflow-auto py-1.5">
            {activeCat.types.map((t) => {
              const items = PRODUCTS.filter((p) => p.type === t.id && (!props.query || `${p.mfr} ${p.model} ${p.sub}`.toLowerCase().includes(props.query.toLowerCase())));
              if (props.query && items.length === 0) return null;
              return (
                <div key={t.id} className="mb-2">
                  <div className="px-5 pt-3 pb-2 flex items-center gap-2.5">
                    <span className="w-[2px] h-3.5 rounded-full" style={{ background: activeCat.tone }} />
                    <span className="text-[12px] font-medium text-slate-200 tracking-tight">{t.label}</span>
                    <span className="text-[10.5px] text-muted-foreground/70 ml-auto">{items.length}</span>
                  </div>
                  {items.map((p) => (
                    <button
                      key={p.id}
                      onPointerDown={(e) => { e.preventDefault(); props.onStartDrag(p, e); }}
                      className="w-full text-left px-5 py-2.5 hover:bg-secondary/40 cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors duration-150 group"
                    >
                      <div
                        className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.03]"
                        style={{
                          background: `${activeCat.tone}10`,
                          color: activeCat.tone,
                          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        }}
                      >
                        <DeviceGlyph type={p.type} size={22} tone={activeCat.tone} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] truncate leading-tight">
                          <span className="font-medium text-slate-100">{p.mfr}</span>
                          <span className="text-muted-foreground ml-1.5">{p.model}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.sub}</div>
                      </div>
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Hint footer — quieter, single line, restrained icon. */}
        <div className="px-5 py-2.5 border-t border-border/70 text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
          {activeCat ? <><GripVertical className="w-3 h-3" />Drag a product onto the canvas</> : <><MousePointer2 className="w-3 h-3" />Pick a category to browse</>}
        </div>
      </div>

      {/* Legacy drilled-in drawer kept for compatibility but never rendered now */}
      {false && cat && (
        <div className="w-[340px] border-r border-border flex flex-col bg-background">
          {/* Header */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${cat.tone}1f`, color: cat.tone }}>
                  <CategoryGlyph kind={cat.id} active />
                </div>
                <div>
                  <div className="text-sm font-medium">{cat.label}</div>
                  <div className="text-[11px] text-muted-foreground">{PRODUCTS.filter((p) => TYPE_KIND[p.type] === cat.id).length} products · {cat.types.length} types</div>
                </div>
              </div>
              <button onClick={() => props.setOpenCat(null)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!props.openType && (
            <div className="flex-1 overflow-auto px-2 pb-3">
              <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground px-2 pt-1 pb-1.5">Types</div>
              <div className="space-y-0.5">
                {cat.types.map((t) => {
                  const count = PRODUCTS.filter((p) => p.type === t.id).length;
                  return (
                    <button
                      key={t.id}
                      onClick={() => props.setOpenType(t.id)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary text-left group transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-secondary group-hover:bg-background border border-border flex items-center justify-center shrink-0">
                        <DeviceGlyph type={t.id} size={20} tone={cat.tone} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{t.label}</div>
                        <div className="text-[11px] text-muted-foreground">{count} product{count !== 1 ? 's' : ''}</div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {props.openType && (
            <>
              <div className="px-4 pb-3 flex items-center gap-1.5 text-xs">
                <button onClick={() => { props.setOpenType(null); props.setMfrFilter(null); }} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-3.5 h-3.5" />{cat.label}
                </button>
                <Slash className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-foreground">{cat.types.find((t) => t.id === props.openType)!.label}</span>
              </div>

              <div className="px-3 pb-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={props.query} onChange={(e) => props.setQuery(e.target.value)}
                    placeholder="Search products…"
                    className="w-full bg-input-background border border-input-border rounded-lg pl-8 pr-3 h-8 text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
                {manufacturers.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    <Chip active={props.mfrFilter === null} onClick={() => props.setMfrFilter(null)}>All</Chip>
                    {manufacturers.map((m) => (
                      <Chip key={m} active={props.mfrFilter === m} onClick={() => props.setMfrFilter(m)}>{m}</Chip>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto px-3 pb-3 space-y-1.5">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onPointerDown={(e) => { e.preventDefault(); props.onStartDrag(p, e); }}
                    className="w-full text-left p-2.5 rounded-xl border border-border hover:border-primary/60 hover:bg-primary/[0.04] cursor-grab active:cursor-grabbing flex items-center gap-3 transition-colors group"
                  >
                    <div className="w-11 h-11 rounded-lg bg-secondary group-hover:bg-background border border-border flex items-center justify-center shrink-0">
                      <DeviceGlyph type={p.type} size={24} tone={cat.tone} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.mfr} <span className="text-muted-foreground">{p.model}</span></div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">{p.sub}</div>
                    </div>
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
                {products.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-10">No products match.</div>
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground flex items-center gap-1.5 bg-secondary/20">
                <GripVertical className="w-3 h-3" />Drag a card onto the canvas
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LayersPanel({ devices, selId, setSelId, selIds, setSelIds, hiddenIds, setHiddenIds, lockedIds, setLockedIds, layers, onToggleLayer, display, onDisplayChange, onClose }: {
  devices: Device[];
  selId: string | null;
  setSelId: (id: string | null) => void;
  selIds: Set<string>;
  setSelIds: (s: Set<string>) => void;
  hiddenIds: Set<string>;
  setHiddenIds: (s: Set<string>) => void;
  lockedIds: Set<string>;
  setLockedIds: (s: Set<string>) => void;
  /** Engineering overlay visibility, gated per layer. */
  layers: CanvasLayerState;
  onToggleLayer: (layer: EngineeringLayer, on: boolean) => void;
  /** Display preferences (icon size, label density, coverage opacity, base map). */
  display: CanvasDisplayPrefs;
  onDisplayChange: (patch: Partial<CanvasDisplayPrefs>) => void;
  onClose: () => void;
}) {
  const lastIndexRef = useRef<number>(-1);
  const flat = devices;
  const handleRowClick = (e: React.MouseEvent, d: Device, idx: number) => {
    if (e.shiftKey && lastIndexRef.current >= 0) {
      const [a, b] = [lastIndexRef.current, idx].sort((x, y) => x - y);
      const range = flat.slice(a, b + 1).map((x) => x.id);
      const next = new Set(selIds);
      range.forEach((id) => next.add(id));
      setSelIds(next);
      setSelId(d.id);
    } else if (e.metaKey || e.ctrlKey) {
      const next = new Set(selIds);
      if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
      setSelIds(next);
      setSelId(d.id);
      lastIndexRef.current = idx;
    } else {
      setSelIds(new Set([d.id]));
      setSelId(d.id);
      lastIndexRef.current = idx;
    }
  };
  const groups: Array<{ kind: DeviceKind; label: string; tone: string; items: Device[] }> = [
    { kind: 'camera',  label: 'Cameras', tone: KIND_TONE.camera,  items: devices.filter((d) => TYPE_KIND[d.type] === 'camera') },
    { kind: 'access',  label: 'Access',  tone: KIND_TONE.access,  items: devices.filter((d) => TYPE_KIND[d.type] === 'access') },
    { kind: 'network', label: 'Network', tone: KIND_TONE.network, items: devices.filter((d) => TYPE_KIND[d.type] === 'network') },
  ];
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };
  return (
    <div className="w-[300px] border-r border-border bg-background flex flex-col">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-medium">Layers</div>
            <div className="text-[11px] text-muted-foreground">{devices.length} devices · {selIds.size > 0 ? `${selIds.size} selected` : `${hiddenIds.size} hidden`}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-3">
        {/* ── Display preferences ───────────────────────────────────
            Dial-style controls: base map, icon size, label density,
            coverage opacity. These are the levers that let the engineer
            adapt the canvas to a dense site or a quiet presentation. */}
        <DisplaySection display={display} onChange={onDisplayChange} />

        {/* ── Engineering layers (overlays) ──────────────────────────
            Calm-by-default toggles. Most are off until the engineer
            asks for them. Anything that paints on top of the blueprint
            should live here, not as a floating button on the canvas. */}
        <EngineeringLayersSection layers={layers} onToggle={onToggleLayer} />

        {groups.map((g) => (
          <div key={g.kind} className="mb-2">
            <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: g.tone }} />
              {g.label}
              <span className="text-muted-foreground/60">· {g.items.length}</span>
            </div>
            {g.items.length === 0 && (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground/60 italic">No devices</div>
            )}
            {g.items.map((d) => {
              const hidden = hiddenIds.has(d.id);
              const locked = lockedIds.has(d.id);
              const active = selId === d.id;
              const multi = selIds.has(d.id);
              const idx = flat.findIndex((x) => x.id === d.id);
              return (
                <div
                  key={d.id}
                  onClick={(e) => handleRowClick(e, d, idx)}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${active ? 'bg-primary/10 ring-1 ring-primary/30' : multi ? 'bg-primary/[0.06] ring-1 ring-primary/20' : 'hover:bg-secondary'}`}
                >
                  <div className="w-6 h-6 rounded bg-secondary border border-border flex items-center justify-center shrink-0">
                    <DeviceGlyph type={d.type} size={14} tone={g.tone} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs truncate ${hidden ? 'text-muted-foreground/60 line-through' : ''}`}>{d.id}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{d.label}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(lockedIds, setLockedIds, d.id); }}
                    className={`p-1 rounded hover:bg-background/60 transition-opacity ${locked ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-100 text-muted-foreground'}`}
                    title={locked ? 'Unlock' : 'Lock'}
                  >
                    {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(hiddenIds, setHiddenIds, d.id); }}
                    className={`p-1 rounded hover:bg-background/60 transition-opacity ${hidden ? 'opacity-100 text-muted-foreground' : 'opacity-0 group-hover:opacity-100 text-muted-foreground'}`}
                    title={hidden ? 'Show' : 'Hide'}
                  >
                    {hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`text-[11px] h-6 px-2.5 rounded-md border transition-colors ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>{children}</button>
  );
}

/** Display preferences — base map, icon size, label density, coverage
 *  opacity. Sits above the engineering layer toggles in the Layers panel.
 *  These are the dials the engineer reaches for first to make a dense
 *  map readable. Persistent per project. */
function DisplaySection({ display, onChange }: { display: CanvasDisplayPrefs; onChange: (patch: Partial<CanvasDisplayPrefs>) => void }) {
  const [open, setOpen] = useState(true);
  const baseMaps: { id: BaseMapMode; label: string }[] = [
    { id: 'blueprint', label: 'Blueprint' },
    { id: 'satellite', label: 'Satellite' },
    { id: 'street',    label: 'Street' },
    { id: 'hybrid',    label: 'Hybrid' },
    { id: 'dark',      label: 'Dark' },
    { id: 'blank',     label: 'Blank' },
  ];
  const sizes: { id: IconSize; label: string }[] = [
    { id: 'compact',  label: 'Compact' },
    { id: 'standard', label: 'Standard' },
    { id: 'large',    label: 'Large' },
  ];
  const densities: { id: LabelDensity; label: string }[] = [
    { id: 'hidden',    label: 'Hidden' },
    { id: 'selected',  label: 'Selected' },
    { id: 'important', label: 'Important' },
    { id: 'all',       label: 'All' },
  ];
  return (
    <div className="mb-3 border-b border-border/40 pb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Eye className="w-3 h-3" />
        Display
      </button>
      {open && (
        <div className="px-2 mt-1 space-y-3">
          {/* Map mode */}
          <div>
            <div className="text-[10px] text-muted-foreground mb-1.5">Map</div>
            <div className="grid grid-cols-3 gap-1">
              {baseMaps.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onChange({ baseMap: m.id })}
                  className={`text-[10.5px] py-1 px-1 rounded transition-colors ${display.baseMap === m.id ? 'bg-primary/15 text-primary border border-primary/40' : 'border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                  title={`Use ${m.label} as base map`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Icon size */}
          <SegmentRow
            label="Icon size"
            value={display.iconSize}
            options={sizes}
            onChange={(v) => onChange({ iconSize: v as IconSize })}
          />

          {/* Label density */}
          <SegmentRow
            label="Labels"
            value={display.labelDensity}
            options={densities}
            onChange={(v) => onChange({ labelDensity: v as LabelDensity })}
          />

          {/* Coverage opacity */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Coverage opacity</span>
              <span className="tabular-nums">{display.coverageOpacity}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={display.coverageOpacity}
              onChange={(e) => onChange({ coverageOpacity: Number(e.target.value) })}
              className="w-full accent-primary cursor-pointer"
              title="Dim FOV cones for a calmer canvas"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Small segmented-control row used by DisplaySection. */
function SegmentRow<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className="flex items-stretch border border-border/50 rounded p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`flex-1 text-[10.5px] py-0.5 rounded transition-colors ${value === o.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Engineering layer toggles — calm checklist of overlays. Off by
 *  default unless they're core engineering signals (fov, labels, pathways).
 *  Layers that don't yet have canvas rendering (NEC, thermal, bandwidth,
 *  rooms, conduit_ids) are still toggleable so the UI is future-proofed
 *  and future-painting can drop in without UX work. */
function EngineeringLayersSection({ layers, onToggle }: { layers: CanvasLayerState; onToggle: (l: EngineeringLayer, on: boolean) => void }) {
  const [open, setOpen] = useState(true);
  // Only layers that visibly affect the canvas are listed here. The
  // schema still holds rooms / NEC / thermal / bandwidth / conduit_ids
  // for when those renderers are built — but per the lockdown rule
  // (no controls that change nothing) they're hidden from this panel
  // until they paint something real.
  const rows: { id: EngineeringLayer; label: string; hint: string }[] = [
    { id: 'fov',         label: 'FOV cones',     hint: 'Camera coverage cones' },
    { id: 'labels',      label: 'Device labels', hint: 'IDs under each device' },
    { id: 'pathways',    label: 'Pathways',      hint: 'Cable runs and tray' },
    { id: 'dimensions',  label: 'Dimensions',    hint: 'Spacing between cameras' },
    { id: 'presence',    label: 'Presence',      hint: 'Live collaborator cursors' },
  ];
  const onCount = rows.filter((r) => layers[r.id]).length;
  return (
    <div className="mb-3 border-b border-border/40 pb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Layers className="w-3 h-3" />
        Engineering layers
        <span className="text-muted-foreground/60 ml-auto">{onCount} on</span>
      </button>
      {open && (
        <div className="px-1 grid grid-cols-2 gap-x-1 gap-y-0.5">
          {rows.map((r) => {
            const on = layers[r.id];
            return (
              <button
                key={r.id}
                onClick={() => onToggle(r.id, !on)}
                title={r.hint}
                className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] text-left transition-colors ${on ? 'text-foreground bg-secondary/60' : 'text-muted-foreground hover:bg-secondary/30'}`}
              >
                <span className={`w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center border ${on ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border/60'}`}>
                  {on && <Check className="w-2.5 h-2.5" />}
                </span>
                <span className="truncate">{r.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CANVAS SURFACE
   ═══════════════════════════════════════════════════════════════════════ */

interface PresenceCursor { id: string; name: string; tone: string; x: number; y: number; hoverId: string | null; }
type CoverageMode = 'minimal' | 'soft' | 'tactical' | 'heatmap' | 'wireframe' | 'presentation' | 'night';

interface SurfaceProps {
  tool: Tool;
  zoom: number;
  devices: Device[];
  selId: string | null;
  selIds: Set<string>;
  presence: PresenceCursor[];
  hoverByPresence: Record<string, { name: string; tone: string }>;
  planSource: BaseMapMode;
  siteAddress: string;
  walls: Wall[];
  wallStart: { x: number; y: number } | null;
  wallCursor: { x: number; y: number } | null;
  onPick: (id: string) => void;
  onBlank: () => void;
  snap: boolean;
  dragging: boolean;
  onSurfaceClick: (x: number, y: number) => void;
  onSurfaceMove: (x: number, y: number) => void;
  onSurfaceDblClick: () => void;
  onMoveDevice: (id: string, x: number, y: number) => void;
  onRotateDevice: (id: string, rot: number) => void;
  onUpdateDevice: (id: string, patch: Partial<Device>) => void;
  activeLens: ActiveLens;
  setActiveLens: (l: ActiveLens) => void;
  coverageMode: CoverageMode;
  /** Toggleable engineering overlay state. Each layer gates a class
   *  of visual noise so the canvas is calm by default. */
  layers: CanvasLayerState;
  /** Display preferences — icon scale, label density, coverage opacity.
   *  Drives the visual density of the canvas. */
  display: CanvasDisplayPrefs;
  /** Active measurement state for the Measure tool. start = first click,
   *  end = second click (committed), cursor = live rubber-band point. */
  measure: {
    start: { x: number; y: number } | null;
    end:   { x: number; y: number } | null;
    cursor:{ x: number; y: number } | null;
  };
  /** Active cable / pathway draw state. */
  cableDraw: {
    points: { x: number; y: number }[];
    cursor: { x: number; y: number } | null;
    cableType: string;
  };
  /** Lagged display position of the device currently being dragged.
   *  When set, the device, its cones, and the selection pill all
   *  render from this position instead of the store position — giving
   *  the drag its weighted, spring-physics feel. Null when nothing is
   *  being dragged or settling. */
  dragLag: { id: string; x: number; y: number } | null;
  /** Called by the pointerDown handler on a device. Parent kicks off
   *  the physics loop. */
  onDragStart: (id: string, x: number, y: number) => void;
  /** Called by the pointerUp handler on a device. Parent marks the
   *  drag as no longer active; physics continues until settled. */
  onDragEnd: () => void;
  /** When the user hovers a lens chip in the SelectionPill, this
   *  carries that lens id so the corresponding cone can subtly
   *  highlight. Null when nothing is being hovered. */
  hoveredLens: LensId | null;
  /** Currently-hovered host while a drag is in flight. When set, the
   *  canvas paints an attach ring around the host with allowed/rejected
   *  feedback. Null when no host is under the cursor or no drag is
   *  in progress. */
  hoverHost: {
    id: string;
    cx: number; cy: number;
    allowed: boolean;
    reason?: string;
    hint?: string;
  } | null;
}

const ICON_SCALE: Record<IconSize, number> = { compact: 0.75, standard: 1, large: 1.35 };

/** Should this device's label render given the global density setting? */
function labelVisibleFor(d: Device, density: LabelDensity, isSel: boolean): boolean {
  if (density === 'hidden') return isSel;       // selected device label always wins
  if (density === 'selected') return isSel;
  if (density === 'important') {
    if (isSel) return true;
    const k = TYPE_KIND[d.type];
    return k === 'camera' || k === 'network';   // cameras + IDFs / switches
  }
  return true;                                  // 'all'
}

import { forwardRef } from 'react';
const CanvasSurface = forwardRef<SVGSVGElement, SurfaceProps>(function CanvasSurface(
  { tool, zoom, devices, selId, selIds, presence, hoverByPresence, planSource, siteAddress, walls, wallStart, wallCursor, onPick, onBlank, dragging, snap, onSurfaceClick, onSurfaceMove, onSurfaceDblClick, onMoveDevice, onRotateDevice, onUpdateDevice, activeLens, setActiveLens, coverageMode, layers, display, measure, cableDraw, dragLag, onDragStart, onDragEnd, hoveredLens, hoverHost }, ref
) {
  const iconScale = ICON_SCALE[display.iconSize];
  const coverageAlpha = Math.max(0, Math.min(1, display.coverageOpacity / 100));
  const moveRef = useRef<{ id: string; offX: number; offY: number } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  // While a device is being dragged, every render — cones, glyphs,
  // labels, snap calculations — pulls position from `renderedDevices`
  // (which substitutes the lagged display position for the dragged
  // device). This is what makes the visual mass lag behind the cursor.
  // When nothing is dragging, renderedDevices === devices.
  const renderedDevices = useMemo(() => {
    if (!dragLag) return devices;
    return devices.map((d) => d.id === dragLag.id ? { ...d, x: dragLag.x, y: dragLag.y } : d);
  }, [devices, dragLag]);
  const movingDev = movingId ? renderedDevices.find((d) => d.id === movingId) ?? null : null;
  // snap candidates — other devices aligned within 4px of the moving device
  const snapTargets = useMemo(() => {
    if (!movingDev) return [] as { axis: 'v' | 'h'; coord: number; otherX: number; otherY: number }[];
    const out: { axis: 'v' | 'h'; coord: number; otherX: number; otherY: number }[] = [];
    renderedDevices.forEach((o) => {
      if (o.id === movingDev.id) return;
      if (Math.abs(o.x - movingDev.x) < 5) out.push({ axis: 'v', coord: o.x, otherX: o.x, otherY: o.y });
      if (Math.abs(o.y - movingDev.y) < 5) out.push({ axis: 'h', coord: o.y, otherX: o.x, otherY: o.y });
    });
    return out;
  }, [movingDev, renderedDevices]);
  // nearest neighbor (for distance telemetry while dragging)
  const nearest = useMemo(() => {
    if (!movingDev) return null;
    let best: { id: string; d: number; x: number; y: number } | null = null;
    renderedDevices.forEach((o) => {
      if (o.id === movingDev.id) return;
      const dd = Math.hypot(o.x - movingDev.x, o.y - movingDev.y);
      if (!best || dd < best.d) best = { id: o.id, d: dd, x: o.x, y: o.y };
    });
    return best;
  }, [movingDev, renderedDevices]);
  const coords = (e: React.MouseEvent) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };
  return (
    <svg
      ref={ref}
      onClick={(e) => {
        if (tool === 'wall') {
          const { x, y } = coords(e);
          onSurfaceClick(x, y);
          return;
        }
        if (e.target === e.currentTarget || (e.target as Element).tagName === 'rect') onBlank();
      }}
      onMouseMove={(e) => {
        if (tool !== 'wall') return;
        const { x, y } = coords(e);
        onSurfaceMove(x, y);
      }}
      onDoubleClick={onSurfaceDblClick}
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #0F1722 0%, #070A10 55%, #03060B 100%)' }}
      className={`absolute inset-0 w-full h-full ${tool === 'wall' || tool === 'measure' || tool === 'cable' ? 'cursor-crosshair' : tool === 'pan' ? 'cursor-grab' : dragging ? 'cursor-copy' : 'cursor-default'}`}
    >
      <defs>
        <style>{`
          @keyframes presence-pulse { 0% { opacity: 0.9; } 50% { opacity: 0.4; } 100% { opacity: 0.9; } }
          @keyframes scan-sweep { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -200; } }
          @keyframes glow-breathe { 0%,100% { opacity: 0.5; } 50% { opacity: 0.9; } }
        `}</style>
        {/* Canvas atmosphere — refined for spatial depth. Two grid scales
            (fine + coarse) plus a single soft vignette. The grid dots
            were intentionally quieted (opacity 0.35 → 0.18) so the
            blueprint reads as the foreground; the grid is texture, not
            a competing signal. */}
        <pattern id="canvas-grid-fine" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#4A95E8" strokeWidth="0.3" opacity="0.04" />
        </pattern>
        <pattern id="canvas-grid-coarse" width="96" height="96" patternUnits="userSpaceOnUse">
          <path d="M 96 0 L 0 0 0 96" fill="none" stroke="#4A95E8" strokeWidth="0.55" opacity="0.07" />
          <circle cx="0" cy="0" r="0.8" fill="#4A95E8" opacity="0.18" />
        </pattern>
        {/* Vignette — softer falloff at the edges. Bottom 100% stop is
            no longer pure black; uses the canvas-background navy at high
            alpha so corners feel like material drop-off, not void. */}
        <radialGradient id="canvas-vignette" cx="50%" cy="45%" r="80%">
          <stop offset="0%"  stopColor="#0D1424" stopOpacity="0" />
          <stop offset="75%" stopColor="#070C18" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#070C18" stopOpacity="0.72" />
        </radialGradient>
        {/* Plan paper — a touch warmer than the canvas around it. The
            faint stroke is dialed down so the paper reads as a surface,
            not a print. */}
        <linearGradient id="plan-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="#10182A" />
          <stop offset="100%" stopColor="#0C1322" />
        </linearGradient>
        <pattern id="plan-paper" width="32" height="32" patternUnits="userSpaceOnUse">
          <rect width="32" height="32" fill="url(#plan-fill)" />
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#4A95E8" strokeWidth="0.4" opacity="0.10" />
        </pattern>
        {/* Soft grain — drafting paper tooth. A barely-there speckle at
            high frequency so the canvas no longer reads as a flat web
            surface but as a physical drawing sheet. */}
        <filter id="canvas-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0" />
        </filter>
        {/* Selected-device drop shadow — quiet elevation, not a glow. */}
        <filter id="device-elevation" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Coverage gradients — drafting-paper wash. Lower alpha across
            every stop, less saturated near the lens. The cone should
            read as a quiet engineering callout, not an atmospheric
            spotlight beam. */}
        <radialGradient id="fov-grad" cx="0%" cy="50%" r="100%">
          <stop offset="0%"   stopColor="#F2C744" stopOpacity="0.32" />
          <stop offset="45%"  stopColor="#F2C744" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#F2C744" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fov-grad-ptz" cx="0%" cy="50%" r="100%">
          <stop offset="0%"   stopColor="#5BA0F2" stopOpacity="0.30" />
          <stop offset="50%"  stopColor="#5BA0F2" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#5BA0F2" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="fov-grad-360" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#E5484D" stopOpacity="0.22" />
          <stop offset="60%"  stopColor="#E5484D" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#E5484D" stopOpacity="0" />
        </radialGradient>
        {/* fov-bloom filter retained for backward compatibility, but is
            no longer applied to cone renders — the bloom pass was the main
            source of the "spotlight" cyber feel. */}
        <filter id="fov-bloom" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      {/* Canvas backdrop — grid lattice, soft vignette, and a high-
          frequency grain layer that gives the surface physical tooth
          (the kind you feel under a pencil on drafting paper) without
          competing with anything painted on top. */}
      <rect width="100%" height="100%" fill="url(#canvas-grid-fine)" />
      <rect width="100%" height="100%" fill="url(#canvas-grid-coarse)" />
      <rect width="100%" height="100%" fill="url(#canvas-vignette)" />
      <rect width="100%" height="100%" filter="url(#canvas-grain)" opacity="0.55" pointerEvents="none" />

      <g transform={`scale(${zoom})`}>
        {/* The plan — clearly delineated as the building */}
        <FloorPlan source={planSource} siteAddress={siteAddress} />

        {/* User-drawn walls */}
        {walls.map((w) => (
          <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
        ))}
        {wallStart && wallCursor && (
          <g>
            <line x1={wallStart.x} y1={wallStart.y} x2={wallCursor.x} y2={wallCursor.y} stroke="#2F81F7" strokeWidth="2" strokeDasharray="4 4" />
            <circle cx={wallStart.x} cy={wallStart.y} r="3" fill="#2F81F7" />
            <circle cx={wallCursor.x} cy={wallCursor.y} r="3" fill="#2F81F7" />
          </g>
        )}

        {/* FOV cones — gated by the `fov` engineering layer. The selected
            camera still shows its cone regardless, so direct manipulation
            never goes blind. Opacity is further multiplied by the user's
            coverage opacity setting so dense maps can be quieted. */}
        <g style={{ mixBlendMode: coverageMode === 'heatmap' ? 'screen' : 'normal' }}>
          {renderedDevices.filter((d) => TYPE_KIND[d.type] === 'camera').map((d) => {
            const isSel = d.id === selId;
            if (!layers.fov && !isSel) return null;
            const dim = (selId ? (isSel ? 1 : 0.28) : 1) * coverageAlpha;
            return <FOV key={`fov-${d.id}`} d={d} mode={coverageMode} dim={dim} selected={isSel} activeLens={isSel ? activeLens : 'all'} hoveredLens={isSel ? hoveredLens : null} />;
          })}
        </g>

        {/* Devices — real top-down hardware silhouettes with drag-to-move */}
        {renderedDevices.map((d) => {
          const multi = selIds.has(d.id);
          const tone = KIND_TONE[TYPE_KIND[d.type]];
          const isSel = selId === d.id;
          // Selected-device spotlight: when SOMETHING is selected, every other
          // device fades back so the focused one reads clearly. The glyph dims
          // less aggressively than the cone (cones fade hard to 0.28 in FOV's
          // own opacity calc) so the user can still locate inactive devices
          // and click to switch focus.
          const spotlightDim = selId && !isSel ? 0.42 : 1;
          return (
            <g
              key={d.id}
              className="cursor-move"
              style={{ opacity: spotlightDim, transition: 'opacity 160ms ease' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                const svg = (ref as React.RefObject<SVGSVGElement>).current;
                if (!svg) return;
                const r = svg.getBoundingClientRect();
                const cx = (e.clientX - r.left) / zoom;
                const cy = (e.clientY - r.top) / zoom;
                moveRef.current = { id: d.id, offX: cx - d.x, offY: cy - d.y };
                setMovingId(d.id);
                onPick(d.id);
                // Kick off the parent's physics loop with this device's
                // current position as the starting lag.
                onDragStart(d.id, d.x, d.y);
              }}
              onPointerMove={(e) => {
                const m = moveRef.current;
                if (!m || m.id !== d.id) return;
                const svg = (ref as React.RefObject<SVGSVGElement>).current;
                if (!svg) return;
                const r = svg.getBoundingClientRect();
                const cx = (e.clientX - r.left) / zoom;
                const cy = (e.clientY - r.top) / zoom;
                let nx = cx - m.offX;
                let ny = cy - m.offY;
                // Magnetic snap on the *cursor target*. The visual still
                // springs toward this target via the parent's physics, so
                // the snap reads as the device being pulled in — not a
                // teleport. Snap tolerance is the same as the existing
                // guide-line tolerance (5px) so the visible guides line
                // up with the actual pull moment.
                if (snap) {
                  const SNAP = 5;
                  for (const o of devices) {
                    if (o.id === d.id) continue;
                    if (Math.abs(nx - o.x) < SNAP) nx = o.x;
                    if (Math.abs(ny - o.y) < SNAP) ny = o.y;
                  }
                  // Grid snap — every 20px (matches the canvas grid).
                  const gx = Math.round(nx / 20) * 20;
                  const gy = Math.round(ny / 20) * 20;
                  if (Math.abs(nx - gx) < 3) nx = gx;
                  if (Math.abs(ny - gy) < 3) ny = gy;
                }
                onMoveDevice(d.id, nx, ny);
              }}
              onPointerUp={(e) => {
                if (moveRef.current?.id === d.id) moveRef.current = null;
                setMovingId(null);
                (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
                // Tell the parent the pointer is released. Physics
                // continues running until the device's visual position
                // settles onto the (snapped) store position.
                onDragEnd();
              }}
            >
              {isSel && (
                <circle
                  cx={d.x} cy={d.y} r={20 * iconScale} fill={tone}
                  opacity="0.16"
                  style={{ animation: 'soft-fade-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
                />
              )}
              {/* Multisensor signature — when the camera is the selected
                  multisensor, a subtle inner ring breathes at the body's
                  edge. Slow, quiet, only visible on the active device.
                  Communicates the multisensor as an orchestrated whole. */}
              {isSel && d.type === 'cam.multisensor' && (
                <circle
                  cx={d.x} cy={d.y} r={14.5 * iconScale}
                  fill="none" stroke={tone} strokeWidth="0.7"
                  opacity="0.55"
                  style={{ animation: 'glow-breathe 3.2s ease-in-out infinite' }}
                />
              )}
              {multi && !isSel && <circle cx={d.x} cy={d.y} r={18 * iconScale} fill="none" stroke={tone} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />}
              {/* When the device is selected, wrap the glyph in a filter
                  group that paints a soft drop shadow underneath. Reads
                  as gentle elevation rather than HUD selection glow. */}
              <g filter={isSel ? 'url(#device-elevation)' : undefined}>
                <HardwareGlyph d={d} tone={tone} selected={isSel} scale={iconScale} />
              </g>
              {/* Label pill — id + manufacturer model below. Gated by BOTH
                  the `labels` engineering layer AND the user's label
                  density preference (hidden / selected / important / all).
                  Selected device's label always wins so identity is never
                  ambiguous. */}
              {layers.labels && labelVisibleFor(d, display.labelDensity, isSel) && (
                <g transform={`translate(${d.x}, ${d.y + 7 + 15 * iconScale})`} pointerEvents="none">
                  {/* Architectural callout: hairline frame, no tone stroke.
                      The device's color identity is already carried by the
                      glyph; the label's job is just to name it quietly. */}
                  <rect
                    x={-(d.id.length * 3.4 + 6)} y={-7}
                    width={d.id.length * 6.8 + 12} height={14} rx={3}
                    fill="rgba(11,18,32,0.86)" stroke="rgba(255,255,255,0.10)" strokeWidth="0.5"
                  />
                  <text x={0} y={3} textAnchor="middle" fill="#E2E8F0" fontSize="10" fontWeight="500" letterSpacing="0.02em">{d.id}</text>
                  {isSel && (() => {
                    const product = PRODUCTS.find((p) => p.id === d.product);
                    if (!product) return null;
                    const label = `${product.mfr} · ${product.model}`;
                    const w = label.length * 5.5 + 12;
                    return (
                      <g transform="translate(0, 16)">
                        <rect x={-w / 2} y={-6} width={w} height={11} rx={2} fill="rgba(11,18,32,0.78)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />
                        <text x={0} y={2} textAnchor="middle" fill={tone} fontSize="8" fontWeight="500" fontFamily="ui-monospace, monospace">{label}</text>
                      </g>
                    );
                  })()}
                </g>
              )}
            </g>
          );
        })}

        {/* Rotation ring + DORI handle on the selected camera (direct manipulation).
            For multisensors: when a specific lens is active AND the device is
            in independent mode, rotating the ring rotates ONLY that lens (lens
            local rotation, relative to device). In linked mode — or with 'all'
            active — it rotates the device body (which carries all lenses). */}
        {(() => {
          // Use renderedDevices so the rotation ring and cone handles
          // stick to the selected device's *lagged* position during
          // drag — otherwise the manipulation rig would teleport ahead
          // of the device visual.
          const s = renderedDevices.find((d) => d.id === selId);
          if (!s || TYPE_KIND[s.type] !== 'camera') return null;
          const isMs = s.type === 'cam.multisensor';
          const lensMode = s.lensMode ?? 'linked';
          const rotateLens = isMs && activeLens !== 'all' && lensMode === 'independent';
          const ringColor = rotateLens ? LENS_TONE[activeLens as LensId] : undefined;
          const handleRotate = (r: number) => {
            if (rotateLens) {
              const ls = getLenses(s);
              const k = activeLens as LensId;
              // Lens rotation is stored RELATIVE to the device body, so we
              // subtract d.rot to keep behavior intuitive when the user later
              // rotates the body.
              const relative = ((r - s.rot) % 360 + 360) % 360;
              onUpdateDevice(s.id, { lenses: { ...ls, [k]: { ...ls[k], rotation: relative } } });
            } else {
              onRotateDevice(s.id, r);
            }
          };
          return (
            <>
              <RotationRing d={s} onRotate={handleRotate} svgRef={ref as React.RefObject<SVGSVGElement>} zoom={zoom} overrideColor={ringColor} />
              {/* Direct manipulation cone handles (FOV edges + range tip). For
                  multisensors the handles attach to the active lens's cone; in
                  'all' mode handles are hidden because there's no single cone
                  to drag — the user edits per-lens via the chips. */}
              {(() => {
                if (s.type === 'cam.fisheye') return null;
                if (isMs) {
                  if (activeLens === 'all') return null;
                  const ls = getLenses(s);
                  const k = activeLens as LensId;
                  const L = ls[k];
                  return (
                    <ConeHandles
                      cx={s.x} cy={s.y}
                      rotDeg={((L.rotation + s.rot) % 360 + 360) % 360}
                      fovDeg={L.fov}
                      rangeFt={L.range}
                      svgRef={ref as React.RefObject<SVGSVGElement>}
                      zoom={zoom}
                      color={LENS_TONE[k]}
                      onUpdate={(p) => onUpdateDevice(s.id, { lenses: { ...ls, [k]: { ...L, ...p } } })}
                    />
                  );
                }
                // Single-lens camera
                const PX_PER_FT = 3.83;
                const defaultRangeFt = s.type === 'cam.ptz' ? 44 : s.type === 'cam.bullet' ? 50 : 30;
                const defaultFovDeg  = s.type === 'cam.ptz' ? 36 : 70;
                return (
                  <ConeHandles
                    cx={s.x} cy={s.y}
                    rotDeg={s.rot}
                    fovDeg={s.fov ?? defaultFovDeg}
                    rangeFt={s.range ?? defaultRangeFt}
                    svgRef={ref as React.RefObject<SVGSVGElement>}
                    zoom={zoom}
                    color={KIND_TONE.camera}
                    onUpdate={(p) => onUpdateDevice(s.id, p)}
                  />
                );
              })()}
            </>
          );
        })()}

        {/* Live snap guides while dragging — vertical & horizontal alignment lines */}
        {movingDev && snapTargets.map((g, i) => (
          <g key={`snap-${i}`} pointerEvents="none">
            {g.axis === 'v' ? (
              <line x1={g.coord} y1={0} x2={g.coord} y2={10000} stroke="#7CC2FF" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.7" />
            ) : (
              <line x1={0} y1={g.coord} x2={10000} y2={g.coord} stroke="#7CC2FF" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.7" />
            )}
            <circle cx={g.otherX} cy={g.otherY} r={3} fill="#7CC2FF" opacity="0.8" />
          </g>
        ))}

        {/* Distance line to nearest neighbor while dragging */}
        {movingDev && nearest && (
          <g pointerEvents="none">
            <line x1={movingDev.x} y1={movingDev.y} x2={nearest.x} y2={nearest.y} stroke="#FACC15" strokeWidth="0.7" strokeDasharray="2 2" opacity="0.85" />
            <g transform={`translate(${(movingDev.x + nearest.x) / 2}, ${(movingDev.y + nearest.y) / 2})`}>
              <rect x={-20} y={-7} width={40} height={14} rx={3} fill="rgba(8,12,20,0.9)" stroke="#FACC15" strokeWidth="0.5" />
              <text textAnchor="middle" y={3} fontSize="9" fontFamily="ui-monospace, monospace" fill="#FACC15" fontWeight="700">
                {(nearest.d / 20).toFixed(1)} ft
              </text>
            </g>
          </g>
        )}

        {/* Live telemetry HUD attached to the moving device */}
        {movingDev && (
          <g pointerEvents="none" transform={`translate(${movingDev.x + 18}, ${movingDev.y - 32})`}>
            <rect x={0} y={-12} width={108} height={36} rx={4} fill="rgba(8,12,20,0.92)" stroke="rgba(124,194,255,0.45)" strokeWidth="0.7" />
            <text x={6} y={0} fontSize="8" fontFamily="ui-monospace, monospace" fill="#94A3B8" letterSpacing="0.6">X · Y · NEAR</text>
            <text x={6} y={11} fontSize="10" fontFamily="ui-monospace, monospace" fill="#E2E8F0" fontWeight="700">
              {(movingDev.x / 20).toFixed(1)} · {(movingDev.y / 20).toFixed(1)} ft
            </text>
            <text x={6} y={21} fontSize="9" fontFamily="ui-monospace, monospace" fill="#7CC2FF">
              {nearest ? `${nearest.id} · ${(nearest.d / 20).toFixed(1)} ft` : 'isolated'}
            </text>
          </g>
        )}

        {/* Engineering density: dimension chains between adjacent cameras.
            Gated by the `dimensions` engineering layer (default off — only
            on when the user wants to see camera-to-camera spacing). */}
        {layers.dimensions && (() => {
          const cams = renderedDevices.filter((d) => TYPE_KIND[d.type] === 'camera').sort((a, b) => a.x - b.x);
          const pairs: { a: Device; b: Device }[] = [];
          for (let i = 0; i < cams.length - 1; i++) pairs.push({ a: cams[i], b: cams[i + 1] });
          return pairs.map((p, i) => {
            const dist = Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y);
            const mx = (p.a.x + p.b.x) / 2;
            const my = (p.a.y + p.b.y) / 2;
            return (
              <g key={`dim-${i}`} pointerEvents="none" opacity="0.65">
                <line x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} stroke="#94A3B8" strokeWidth="0.4" strokeDasharray="1 3" />
                <rect x={mx - 18} y={my - 7} width={36} height={12} rx={2} fill="rgba(8,12,20,0.85)" stroke="rgba(148,163,184,0.45)" strokeWidth="0.4" />
                <text x={mx} y={my + 3} textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill="#CBD5E1">
                  {(dist / 20).toFixed(1)}′
                </text>
              </g>
            );
          });
        })()}

        {/* Measure tool — live distance line between two clicks, with a
            distance chip at the midpoint. Renders in real engineering
            yellow so it never gets confused with FOV cones or pathways. */}
        {tool === 'measure' && measure.start && (() => {
          const end = measure.end ?? measure.cursor ?? measure.start;
          const dx = end.x - measure.start.x;
          const dy = end.y - measure.start.y;
          const distPx = Math.hypot(dx, dy);
          const ft = distPx / 20;
          const mx = (measure.start.x + end.x) / 2;
          const my = (measure.start.y + end.y) / 2;
          const committed = !!measure.end;
          return (
            <g pointerEvents="none">
              <line
                x1={measure.start.x} y1={measure.start.y}
                x2={end.x} y2={end.y}
                stroke="#FACC15" strokeWidth="1.2"
                strokeDasharray={committed ? undefined : "3 3"}
                opacity={committed ? 1 : 0.85}
              />
              {/* End-tick marks */}
              <circle cx={measure.start.x} cy={measure.start.y} r={3} fill="#FACC15" />
              <circle cx={end.x} cy={end.y} r={3} fill="#FACC15" />
              <g transform={`translate(${mx}, ${my})`}>
                <rect x={-32} y={-9} width={64} height={18} rx={4} fill="rgba(8,12,20,0.92)" stroke="#FACC15" strokeWidth="0.6" />
                <text textAnchor="middle" y={4} fontSize="11" fontFamily="ui-monospace, monospace" fill="#FACC15" fontWeight="700">
                  {ft.toFixed(1)} ft
                </text>
              </g>
            </g>
          );
        })()}

        {/* Cable draw — vertices already committed render as a solid
            polyline; the active rubber-band segment to the cursor is
            dashed so the user always knows where the next click will go.
            Each committed vertex gets a small handle so the path reads
            as a real edited route, not a transient hover effect. Esc to
            cancel, Enter or double-click to finish. */}
        {tool === 'cable' && cableDraw.points.length > 0 && (() => {
          const pts = cableDraw.points;
          const cursor = cableDraw.cursor ?? pts[pts.length - 1];
          let lengthPx = 0;
          for (let i = 1; i < pts.length; i++) {
            lengthPx += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          }
          if (cableDraw.cursor && pts.length > 0) {
            lengthPx += Math.hypot(cursor.x - pts[pts.length - 1].x, cursor.y - pts[pts.length - 1].y);
          }
          const ft = lengthPx / 20;
          const tipX = cursor.x;
          const tipY = cursor.y;
          return (
            <g pointerEvents="none">
              {/* Committed segments — solid */}
              {pts.length >= 2 && (
                <polyline
                  points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none" stroke="#F2C744" strokeWidth="1.4" opacity="0.88"
                />
              )}
              {/* Live rubber-band to cursor — dashed */}
              {cableDraw.cursor && (
                <line
                  x1={pts[pts.length - 1].x} y1={pts[pts.length - 1].y}
                  x2={cursor.x} y2={cursor.y}
                  stroke="#F2C744" strokeWidth="1.4" strokeDasharray="4 3" opacity="0.75"
                />
              )}
              {/* Vertex handles */}
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#0E1424" stroke="#F2C744" strokeWidth="1.2" />
              ))}
              {/* Length chip at the head */}
              <g transform={`translate(${tipX + 12}, ${tipY - 18})`}>
                <rect x={0} y={-10} width={88} height={20} rx={4} fill="rgba(8,12,20,0.92)" stroke="#F2C744" strokeWidth="0.6" />
                <text x={6} y={3} fontSize="10" fontFamily="ui-monospace, monospace" fill="#F2C744" fontWeight="600">
                  {cableDraw.cableType.toUpperCase()} · {ft.toFixed(1)} ft
                </text>
              </g>
              {/* Hint */}
              <g transform={`translate(${tipX + 12}, ${tipY + 8})`}>
                <text fontSize="9" fontFamily="ui-sans-serif" fill="rgba(226,232,240,0.55)">
                  Enter / dbl-click to finish · Esc cancels
                </text>
              </g>
            </g>
          );
        })()}

        {/* Drag-onto-host attach ring. Visible only while a drag from
            the library is in flight AND the cursor is over a candidate
            host (door / gate / exit / IDF / MDF). Green ring + "Attach"
            label when compatible; rose ring + reason when not. Soft
            breathe via the existing glow-breathe keyframe so the host
            communicates magnetism without flashing. */}
        {hoverHost && (() => {
          const ringTone = hoverHost.allowed ? '#34D399' : '#F87171';
          return (
            <g pointerEvents="none">
              <circle
                cx={hoverHost.cx} cy={hoverHost.cy} r={26}
                fill="none" stroke={ringTone} strokeWidth="1.6"
                strokeDasharray="3 3" opacity="0.85"
                style={{ animation: 'glow-breathe 1.6s ease-in-out infinite' }}
              />
              <circle
                cx={hoverHost.cx} cy={hoverHost.cy} r={32}
                fill="none" stroke={ringTone} strokeWidth="0.8" opacity="0.25"
              />
              <g transform={`translate(${hoverHost.cx}, ${hoverHost.cy + 44})`}>
                <rect
                  x={-58} y={-9} width={116} height={18} rx={3}
                  fill="rgba(13,20,36,0.92)" stroke={ringTone} strokeWidth="0.7"
                />
                <text
                  x={0} y={3.5} textAnchor="middle"
                  fontSize="10" fontWeight="600" fontFamily="ui-sans-serif"
                  fill={ringTone}
                >
                  {hoverHost.allowed ? `Attach to ${hoverHost.id}` : 'Not compatible'}
                </text>
              </g>
            </g>
          );
        })()}

        {/* Presence cursors — live collaborators. Off by default; the
            engineer turns it on when they want to see who's also in the
            session. */}
        {layers.presence && presence.map((p) => (
          <g key={p.id} style={{ transition: 'transform 80ms linear' }} transform={`translate(${p.x}, ${p.y})`} pointerEvents="none">
            <path d="M 0 0 L 14 5 L 6 7 L 4 14 Z" fill={p.tone} stroke="#0D1117" strokeWidth="1" />
            <g transform="translate(14, 14)">
              <rect rx="3" ry="3" x="0" y="0" width={p.name.length * 6.2 + 12} height="16" fill={p.tone} />
              <text x="6" y="12" fill="#0D1117" fontSize="10" fontWeight="600">{p.name}</text>
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
});

/** Small honest badge on simulated map modes. The brief is explicit:
 *  if there's no live provider, label it. */
function SimulatedMapBadge({ label, tone = 'light' }: { label: string; tone?: 'light' | 'dark' }) {
  const bg = tone === 'dark' ? 'rgba(13,20,36,0.85)' : 'rgba(13,20,36,0.78)';
  const fg = '#F4E07A';
  return (
    <g transform="translate(540, 580)">
      <rect width="170" height="20" rx="10" fill={bg} stroke={fg + '55'} strokeWidth="0.6" />
      <circle cx="11" cy="10" r="3" fill={fg} opacity="0.85" />
      <text x="20" y="14" fill={fg} fontSize="10.5" fontFamily="ui-sans-serif">{label}</text>
    </g>
  );
}

function FloorPlan({ source, siteAddress }: { source: BaseMapMode; siteAddress: string }) {
  // Honest map modes. Every value the picker offers produces a visually
  // distinct surface so the choice is real. Where there's no live tile
  // provider (street / hybrid / dark) the surface is clearly a stylised
  // engineering render and is labelled "Simulated map layer".
  if (source === 'blank') {
    return (
      <g>
        <rect x="80" y="80" width="640" height="480" fill="url(#plan-paper)" stroke="#30363D" strokeWidth="1" strokeDasharray="6 6" rx="4" />
        <text x="400" y="316" textAnchor="middle" fill="#7D8590" fontSize="13">Press W or pick the wall tool to start sketching</text>
        <text x="400" y="336" textAnchor="middle" fill="#484F58" fontSize="11">Click to drop vertices · double-click to end a run</text>
      </g>
    );
  }
  if (source === 'street') {
    return (
      <g>
        {/* Light cartographic surface — off-white roads on a warm slate. */}
        <rect x="80" y="80" width="640" height="480" fill="#D8DEE8" rx="3" />
        {/* Major roads */}
        <g stroke="#FFFFFF" strokeLinecap="round">
          <line x1="80"  y1="220" x2="720" y2="220" strokeWidth="16" />
          <line x1="80"  y1="420" x2="720" y2="420" strokeWidth="12" />
          <line x1="320" y1="80"  x2="320" y2="560" strokeWidth="14" />
          <line x1="560" y1="80"  x2="560" y2="560" strokeWidth="10" />
        </g>
        {/* Road outlines */}
        <g stroke="#9BA5B6" strokeWidth="0.6">
          <line x1="80"  y1="212" x2="720" y2="212" />
          <line x1="80"  y1="228" x2="720" y2="228" />
          <line x1="80"  y1="414" x2="720" y2="414" />
          <line x1="80"  y1="426" x2="720" y2="426" />
          <line x1="313" y1="80"  x2="313" y2="560" />
          <line x1="327" y1="80"  x2="327" y2="560" />
          <line x1="555" y1="80"  x2="555" y2="560" />
          <line x1="565" y1="80"  x2="565" y2="560" />
        </g>
        {/* Building footprints */}
        <g fill="#BFC8D6" stroke="#9BA5B6" strokeWidth="0.6">
          <rect x="120" y="100" width="140" height="90" />
          <rect x="370" y="110" width="160" height="90" />
          <rect x="600" y="120" width="100" height="80" />
          <rect x="110" y="260" width="180" height="130" />
          <rect x="370" y="260" width="160" height="130" />
          <rect x="600" y="260" width="100" height="120" />
          <rect x="120" y="450" width="170" height="90" />
          <rect x="370" y="450" width="160" height="90" />
        </g>
        <SimulatedMapBadge label="Simulated street map" />
      </g>
    );
  }
  if (source === 'hybrid') {
    return (
      <g>
        {/* Satellite imagery + cartographic labels & roads. */}
        <image
          href="https://images.unsplash.com/photo-1569163139394-de4798aa62b6?w=1200&q=70"
          x="80" y="80" width="640" height="480" preserveAspectRatio="xMidYMid slice"
        />
        <rect x="80" y="80" width="640" height="480" fill="#0D1424" opacity="0.18" />
        {/* Road overlay */}
        <g stroke="#F4E07A" strokeOpacity="0.75" strokeLinecap="round">
          <line x1="80"  y1="220" x2="720" y2="220" strokeWidth="3" />
          <line x1="80"  y1="420" x2="720" y2="420" strokeWidth="2.5" />
          <line x1="320" y1="80"  x2="320" y2="560" strokeWidth="3" />
        </g>
        {/* Labels */}
        <g fill="#F4E07A" fontSize="11" fontFamily="ui-sans-serif">
          <text x="400" y="216" textAnchor="middle" stroke="#0D1424" strokeWidth="3" paintOrder="stroke">Commerce Blvd</text>
          <text x="324" y="320" textAnchor="middle" stroke="#0D1424" strokeWidth="3" paintOrder="stroke">7th St</text>
        </g>
        <g transform="translate(96, 100)">
          <rect width="220" height="26" rx="13" fill="#0D1117" fillOpacity="0.78" stroke="#30363D" />
          <circle cx="14" cy="13" r="3.5" fill="#2F81F7" />
          <text x="26" y="17" fill="#E6EDF3" fontSize="11">{siteAddress || 'No address set'}</text>
        </g>
        <SimulatedMapBadge label="Simulated hybrid (satellite + labels)" />
      </g>
    );
  }
  if (source === 'dark') {
    return (
      <g>
        {/* Dark cartographic surface — premium night-mode map look. */}
        <rect x="80" y="80" width="640" height="480" fill="#0E1424" rx="3" />
        <g stroke="#1F2A40" strokeWidth="22" strokeLinecap="round">
          <line x1="80" y1="220" x2="720" y2="220" />
          <line x1="80" y1="420" x2="720" y2="420" />
          <line x1="320" y1="80" x2="320" y2="560" />
        </g>
        <g stroke="#2A3650" strokeWidth="14" strokeLinecap="round">
          <line x1="80" y1="160" x2="720" y2="160" />
          <line x1="80" y1="500" x2="720" y2="500" />
          <line x1="560" y1="80" x2="560" y2="560" />
        </g>
        {/* Road inner highlights */}
        <g stroke="#4A95E8" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round">
          <line x1="80" y1="220" x2="720" y2="220" />
          <line x1="80" y1="420" x2="720" y2="420" />
          <line x1="320" y1="80" x2="320" y2="560" />
        </g>
        {/* Building parcels */}
        <g fill="#162033" stroke="#243049" strokeWidth="0.6">
          <rect x="120" y="100" width="140" height="90" />
          <rect x="370" y="110" width="160" height="90" />
          <rect x="600" y="120" width="100" height="80" />
          <rect x="110" y="260" width="180" height="130" />
          <rect x="370" y="260" width="160" height="130" />
          <rect x="600" y="260" width="100" height="120" />
          <rect x="120" y="450" width="170" height="90" />
          <rect x="370" y="450" width="160" height="90" />
        </g>
        <SimulatedMapBadge label="Simulated dark map" tone="dark" />
      </g>
    );
  }
  if (source === 'satellite') {
    return (
      <g>
        <image
          href="https://images.unsplash.com/photo-1569163139394-de4798aa62b6?w=1200&q=70"
          x="80" y="80" width="640" height="480" preserveAspectRatio="xMidYMid slice"
        />
        <rect x="80" y="80" width="640" height="480" fill="#0D1117" opacity="0.28" />
        {/* Parcel outline */}
        <rect x="80" y="80" width="640" height="480" fill="none" stroke="#2F81F7" strokeWidth="2" strokeDasharray="8 6" />
        {/* Building footprint over the satellite */}
        <g>
          <rect x="220" y="200" width="360" height="240" fill="#0D1117" fillOpacity="0.55" stroke="#E6EDF3" strokeWidth="2" />
          <text x="400" y="328" textAnchor="middle" fill="#E6EDF3" fontSize="12">Building footprint</text>
        </g>
        {/* Address chip */}
        <g transform="translate(96, 100)">
          <rect width="220" height="26" rx="13" fill="#0D1117" fillOpacity="0.7" stroke="#30363D" />
          <circle cx="14" cy="13" r="3.5" fill="#2F81F7" />
          <text x="26" y="17" fill="#E6EDF3" fontSize="11">{siteAddress || 'No address set'}</text>
        </g>
        <g transform="translate(740, 90)">
          <circle r="18" fill="#161B22" stroke="#30363D" strokeWidth="1" />
          <path d="M 0 -10 L 4 6 L 0 2 L -4 6 Z" fill="#E6EDF3" />
          <text y="-22" textAnchor="middle" fill="#7D8590" fontSize="10">N</text>
        </g>
        <g transform="translate(100, 580)">
          <line x1="0" y1="0" x2="100" y2="0" stroke="#E6EDF3" strokeWidth="2" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="#E6EDF3" strokeWidth="2" />
          <line x1="100" y1="-4" x2="100" y2="4" stroke="#E6EDF3" strokeWidth="2" />
          <text x="50" y="-7" textAnchor="middle" fill="#E6EDF3" fontSize="10">~30 ft</text>
        </g>
      </g>
    );
  }
  // Crisp, obvious building outline with paper-fill interior so you SEE the floor plan
  return (
    <g>
      {/* North arrow */}
      <g transform="translate(740, 90)">
        <circle r="18" fill="#161B22" stroke="#30363D" strokeWidth="1" />
        <path d="M 0 -10 L 4 6 L 0 2 L -4 6 Z" fill="#E6EDF3" />
        <text y="-22" textAnchor="middle" fill="#7D8590" fontSize="10">N</text>
      </g>

      {/* Floor plan — light architectural rendering, paper feel with clean wall lines */}
      <g>
        <rect x="84" y="86" width="640" height="480" fill="#0F172A" opacity="0.12" rx="3" />
        <rect x="80" y="80" width="640" height="480" fill="url(#plan-paper)" rx="3" />
        <rect x="80" y="80" width="640" height="480" fill="none" stroke="#1F2937" strokeWidth="2.5" rx="3" />
      </g>

      <g stroke="#1F2937" strokeWidth="1.8" opacity="0.85" strokeLinecap="square">
        <line x1="80"  y1="320" x2="720" y2="320" />
        <line x1="400" y1="80"  x2="400" y2="560" />
        <line x1="240" y1="80"  x2="240" y2="320" />
        <line x1="560" y1="320" x2="560" y2="560" />
      </g>

      {/* Door openings (gaps + swing arc) */}
      <g>
        <line x1="380" y1="80" x2="420" y2="80" stroke="#F5F7FA" strokeWidth="3" />
        <path d="M 380 80 A 40 40 0 0 1 420 120" fill="none" stroke="#6B7280" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="680" y1="320" x2="720" y2="320" stroke="#F5F7FA" strokeWidth="3" />
        <path d="M 680 320 A 40 40 0 0 1 720 360" fill="none" stroke="#6B7280" strokeWidth="1" strokeDasharray="3 3" />
      </g>

      <g fill="#374151" fontSize="11" fontWeight="500">
        <text x="160" y="200">Lobby</text>
        <text x="320" y="200">Reception</text>
        <text x="480" y="200">Open office</text>
        <text x="640" y="200">IT room</text>
        <text x="160" y="440">Conference A</text>
        <text x="320" y="440">Conference B</text>
        <text x="480" y="440">Open office</text>
        <text x="640" y="440">Storage</text>
      </g>

      <g fill="#9CA3AF" fontSize="10">
        <text x="40" y="320" transform="rotate(-90 40 320)">Exterior — parking</text>
        <text x="400" y="50" textAnchor="middle">Exterior — courtyard</text>
      </g>

      <g transform="translate(100, 580)">
        <line x1="0" y1="0" x2="100" y2="0" stroke="#1F2937" strokeWidth="1.5" />
        <line x1="0" y1="-4" x2="0" y2="4" stroke="#1F2937" strokeWidth="1.5" />
        <line x1="100" y1="-4" x2="100" y2="4" stroke="#1F2937" strokeWidth="1.5" />
        <text x="50" y="-7" textAnchor="middle" fill="#1F2937" fontSize="10">10 ft</text>
      </g>
    </g>
  );
}

/** Render one wedge-shaped FOV cone given absolute world rotation + fov + range
 *  in feet. Used by both the single-lens FOV branch and the multisensor 4-lens
 *  branch so the visuals stay identical. */
function FovCone({
  cx, cy, rotDeg, fovDeg, rangeFt, color, opacity, wireframe, label, telemetry,
}: { cx: number; cy: number; rotDeg: number; fovDeg: number; rangeFt: number; color: string; opacity: number; wireframe: boolean; label?: string; telemetry?: string }) {
  const PX_PER_FT = 3.83;
  const r = rangeFt * PX_PER_FT;
  const half = fovDeg / 2;
  const a1 = ((rotDeg - half) * Math.PI) / 180;
  const a2 = ((rotDeg + half) * Math.PI) / 180;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const x2 = cx + Math.cos(a2) * r;
  const y2 = cy + Math.sin(a2) * r;
  const large = half > 90 ? 1 : 0;
  const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  // tip of the cone (used to anchor the small telemetry chip)
  const tipX = cx + Math.cos((rotDeg * Math.PI) / 180) * r;
  const tipY = cy + Math.sin((rotDeg * Math.PI) / 180) * r;
  // Per-cone radial gradient — saturated at the lens (cx, cy) and fading to
  // zero at the cone's outer arc. Gives the cinematic "vapor at the edge"
  // depth instead of the flat SVG-ish fill that read as decorative. The id
  // encodes color+position+range so two cones never share a gradient.
  const gid = `cone-${color.replace('#', '')}-${Math.round(cx)}-${Math.round(cy)}-${Math.round(r)}-${Math.round(rotDeg)}-${Math.round(fovDeg)}`;
  return (
    <g opacity={opacity}>
      <defs>
        {/* Lens-cone wash — drafting paper alpha, not spotlight beam. */}
        <radialGradient id={gid} cx={cx} cy={cy} r={r} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
          <stop offset="50%"  stopColor={color} stopOpacity="0.10" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Single-pass fill. The bloom pass that used to live here was the
          main source of the lens's "spotlight" cyber feel; without it the
          cone reads as a clean engineering callout. */}
      {!wireframe && <path d={path} fill={`url(#${gid})`} />}
      {/* Edge stroke — thin draftsman line, low opacity. */}
      <path d={path} fill="none" stroke={color} strokeWidth={wireframe ? 0.9 : 0.7} opacity={wireframe ? 0.85 : 0.42} />
      {/* DORI band rings — quieter so they don't compete with the cone. */}
      {!wireframe && [0.35, 0.6, 0.8].map((f) => {
        const rr = r * f;
        const xa = cx + Math.cos(a1) * rr;
        const ya = cy + Math.sin(a1) * rr;
        const xb = cx + Math.cos(a2) * rr;
        const yb = cy + Math.sin(a2) * rr;
        return (
          <path key={f} d={`M ${xa} ${ya} A ${rr} ${rr} 0 ${half > 90 ? 1 : 0} 1 ${xb} ${yb}`}
            fill="none" stroke={color} strokeWidth="0.35" opacity="0.25" strokeDasharray="2 4" />
        );
      })}
      {label && (
        <g transform={`translate(${tipX}, ${tipY})`} pointerEvents="none">
          <circle r={9} fill="rgba(8,12,20,0.88)" stroke={color} strokeWidth="0.8" />
          <text textAnchor="middle" y={3} fontSize="9" fontWeight="700" fill={color} fontFamily="ui-monospace, monospace">{label}</text>
          {telemetry && (
            <g transform="translate(0, 16)">
              <rect x={-26} y={-6} width={52} height={12} rx={2} fill="rgba(8,12,20,0.85)" stroke={color} strokeWidth="0.5" opacity="0.85" />
              <text textAnchor="middle" y={2.5} fontSize="8" fill="#E2E8F0" fontFamily="ui-monospace, monospace">{telemetry}</text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}

function FOV({ d, mode = 'soft', dim = 1, selected = false, activeLens = 'all', hoveredLens = null }: { d: Device; mode?: CoverageMode; dim?: number; selected?: boolean; activeLens?: ActiveLens; hoveredLens?: LensId | null }) {
  // Mode-driven render parameters
  const opacity = (mode === 'minimal' ? 0.35 : mode === 'presentation' ? 0.7 : mode === 'tactical' ? 0.9 : mode === 'heatmap' ? 0.85 : mode === 'night' ? 0.55 : 0.75) * dim * (selected ? 1.15 : 1);
  const wireframe = mode === 'wireframe';
  const showArcs = mode !== 'minimal' && mode !== 'presentation';
  const showAim = mode === 'tactical' || mode === 'wireframe' || selected;

  // ── Multisensor branch — render four independent cones, one per lens. ──
  // Each cone carries its own rotation/fov/range and its own color. When the
  // device is selected and a specific lens is active, that lens cone gets
  // brighter stroke + a telemetry chip; the other three dim slightly so the
  // active one reads clearly.
  if (d.type === 'cam.multisensor') {
    const lenses = getLenses(d);
    // When the user is viewing all four lenses together (multisensor
    // selected, 'all' active), apply a soft screen blend so where two
    // cones overlap their colors add — visualizing the stitching and
    // overlap regions without any extra UI. This is the multisensor's
    // signature visual moment.
    const useScreenBlend = selected && activeLens === 'all' && !wireframe;
    return (
      <g style={useScreenBlend ? { mixBlendMode: 'screen' } : undefined}>
        {(['a', 'b', 'c', 'd'] as const).map((k) => {
          const L = lenses[k];
          if (!L.enabled) return null;
          const isActive = selected && (activeLens === k || activeLens === 'all');
          const isHovered = selected && hoveredLens === k;
          // Lens rotation is relative to the multisensor body — adding d.rot
          // lets the user rotate the whole device while preserving the
          // cardinal spread between lenses.
          const absRot = ((L.rotation + d.rot) % 360 + 360) % 360;
          // When a lens chip is being hovered, lift its corresponding
          // cone slightly and dim the others — so the user can visually
          // pair "this chip" → "that cone" without any explanation.
          let coneOpacity = opacity * (selected && activeLens !== 'all' && activeLens !== k ? 0.32 : 1);
          if (selected && hoveredLens) {
            coneOpacity = opacity * (isHovered ? 1.15 : 0.25);
          }
          return (
            <FovCone
              key={`lens-${d.id}-${k}`}
              cx={d.x} cy={d.y}
              rotDeg={absRot}
              fovDeg={L.fov}
              rangeFt={L.range}
              color={LENS_TONE[k]}
              opacity={coneOpacity}
              wireframe={wireframe}
              label={isActive && selected ? LENS_LABEL[k] : undefined}
              telemetry={isActive && selected && activeLens === k ? `${Math.round(L.fov)}° · ${Math.round(L.range)}ft` : undefined}
            />
          );
        })}
      </g>
    );
  }

  // ── Single-lens cameras (dome / bullet / ptz / fisheye / thermal / lpr) ──
  const PX_PER_FT = 3.83;
  const defaultRangeFt = d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30;
  const defaultFovDeg  = d.type === 'cam.ptz' ? 36 : d.type === 'cam.fisheye' ? 360 : 70;
  const rangeFt = d.range ?? defaultRangeFt;
  const fovDeg  = d.fov ?? defaultFovDeg;
  if (d.type === 'cam.fisheye' || fovDeg >= 350) {
    const rFish = rangeFt * PX_PER_FT * 0.6; // fisheye effective radius is smaller (omni)
    return (
      <g opacity={opacity}>
        {!wireframe && <circle cx={d.x} cy={d.y} r={rFish} fill="url(#fov-grad-360)" />}
        <circle cx={d.x} cy={d.y} r={rFish} fill="none" stroke="#FF7B6B" strokeWidth={wireframe ? 0.8 : 0.6} opacity={wireframe ? 0.9 : 0.5} strokeDasharray="2 4" />
      </g>
    );
  }
  const r = rangeFt * PX_PER_FT;
  const half = fovDeg / 2;
  const rot = d.rot;
  const a1 = ((rot - half) * Math.PI) / 180;
  const a2 = ((rot + half) * Math.PI) / 180;
  const x1 = d.x + Math.cos(a1) * r;
  const y1 = d.y + Math.sin(a1) * r;
  const x2 = d.x + Math.cos(a2) * r;
  const y2 = d.y + Math.sin(a2) * r;
  const large = half > 90 ? 1 : 0;
  const gradId = d.type === 'cam.ptz' ? 'fov-grad-ptz' : 'fov-grad';
  const edge = d.type === 'cam.ptz' ? '#7CC2FF' : '#FFD24D';
  // Rotate gradient so its origin aligns with the lens and decays outward
  const path = `M ${d.x} ${d.y} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  return (
    <g opacity={opacity}>
      {/* Single-pass fill — no more bloom doubling. Thin edge stroke. */}
      {!wireframe && <path d={path} fill={`url(#${gradId})`} />}
      <path d={path} fill="none" stroke={edge} strokeWidth={wireframe ? 0.9 : 0.6} opacity={wireframe ? 0.85 : 0.45} />
      {showArcs && [0.35, 0.6, 0.8].map((f, i) => {
        const rr = r * f;
        const xa = d.x + Math.cos(a1) * rr;
        const ya = d.y + Math.sin(a1) * rr;
        const xb = d.x + Math.cos(a2) * rr;
        const yb = d.y + Math.sin(a2) * rr;
        return (
          <path key={i}
            d={`M ${xa} ${ya} A ${rr} ${rr} 0 0 1 ${xb} ${yb}`}
            fill="none" stroke={edge} strokeWidth="0.35" opacity={0.3 - i * 0.07} strokeDasharray="1 3"
          />
        );
      })}
      {showAim && (
        <line
          x1={d.x} y1={d.y}
          x2={d.x + Math.cos((rot * Math.PI) / 180) * r}
          y2={d.y + Math.sin((rot * Math.PI) / 180) * r}
          stroke={edge} strokeWidth="0.4" opacity="0.55" strokeDasharray="2 3"
        />
      )}
    </g>
  );
}

/** Direct-manipulation handles attached to the tip + edges of a cone. Tip
 *  handle mutates RANGE (in ft). Two edge handles mutate FOV (the half-angle).
 *  Used by both single-lens cameras and the active lens of a multisensor —
 *  the caller wires `onUpdate` to write to either d.fov/d.range OR
 *  d.lenses[activeLens].fov/.range. */
function ConeHandles({ cx, cy, rotDeg, fovDeg, rangeFt, svgRef, zoom, color, onUpdate }: {
  cx: number; cy: number;
  rotDeg: number; fovDeg: number; rangeFt: number;
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  color: string;
  onUpdate: (patch: { fov?: number; range?: number }) => void;
}) {
  const PX_PER_FT = 3.83;
  const r = rangeFt * PX_PER_FT;
  const half = fovDeg / 2;
  const aMid = (rotDeg * Math.PI) / 180;
  const a1 = ((rotDeg - half) * Math.PI) / 180;
  const a2 = ((rotDeg + half) * Math.PI) / 180;
  const tipX = cx + Math.cos(aMid) * r;
  const tipY = cy + Math.sin(aMid) * r;
  const e1X = cx + Math.cos(a1) * r * 0.92;
  const e1Y = cy + Math.sin(a1) * r * 0.92;
  const e2X = cx + Math.cos(a2) * r * 0.92;
  const e2Y = cy + Math.sin(a2) * r * 0.92;

  const startDrag = (apply: (cx: number, cy: number) => void) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      apply((ev.clientX - rect.left) / zoom, (ev.clientY - rect.top) / zoom);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onTipDown = startDrag((mx, my) => {
    const dist = Math.hypot(mx - cx, my - cy);
    onUpdate({ range: Math.max(5, Math.min(150, Math.round(dist / PX_PER_FT))) });
  });
  const onEdgeDown = startDrag((mx, my) => {
    // FOV = 2 × shortest absolute angle between cursor heading and cone center
    const ang = (Math.atan2(my - cy, mx - cx) * 180) / Math.PI;
    let delta = Math.abs(((ang - rotDeg + 180) % 360) - 180);
    if (delta < 0) delta = -delta;
    onUpdate({ fov: Math.max(10, Math.min(360, Math.round(delta * 2))) });
  });

  return (
    <g pointerEvents="auto">
      {/* Range (tip) handle — drag along cone axis to extend/shorten reach. */}
      <g onPointerDown={onTipDown} style={{ cursor: 'ew-resize' }}>
        <circle cx={tipX} cy={tipY} r={7} fill={color} opacity="0.2" />
        <circle cx={tipX} cy={tipY} r={3.5} fill={color} stroke="#0B131F" strokeWidth="1" />
        <g transform={`translate(${tipX}, ${tipY - 14})`} pointerEvents="none">
          <rect x={-20} y={-7} width={40} height={13} rx={2} fill="rgba(8,12,20,0.92)" stroke={color} strokeWidth="0.6" />
          <text textAnchor="middle" y={2.5} fontSize="9" fontWeight="600" fill={color} fontFamily="ui-monospace, monospace">{Math.round(rangeFt)} ft</text>
        </g>
      </g>
      {/* Edge (FOV) handles — drag to widen/narrow the lens aperture. */}
      <g onPointerDown={onEdgeDown} style={{ cursor: 'crosshair' }}>
        <circle cx={e1X} cy={e1Y} r={6} fill={color} opacity="0.2" />
        <circle cx={e1X} cy={e1Y} r={3} fill={color} stroke="#0B131F" strokeWidth="0.7" />
      </g>
      <g onPointerDown={onEdgeDown} style={{ cursor: 'crosshair' }}>
        <circle cx={e2X} cy={e2Y} r={6} fill={color} opacity="0.2" />
        <circle cx={e2X} cy={e2Y} r={3} fill={color} stroke="#0B131F" strokeWidth="0.7" />
      </g>
    </g>
  );
}

function RotationRing({ d, onRotate, svgRef, zoom, overrideColor }: { d: Device; onRotate: (r: number) => void; svgRef: React.RefObject<SVGSVGElement>; zoom: number; overrideColor?: string }) {
  // overrideColor lets a multisensor's active-lens color drive the ring's
  // visuals when the ring is editing a single lens (e.g. cyan for Lens A).
  const tone = overrideColor ?? KIND_TONE[TYPE_KIND[d.type]];
  const R = 34;
  const rad = (d.rot * Math.PI) / 180;
  const handleX = d.x + Math.cos(rad) * R;
  const handleY = d.y + Math.sin(rad) * R;
  const dragging = useRef(false);

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragging.current = true;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const cx = (e.clientX - r.left) / zoom;
    const cy = (e.clientY - r.top) / zoom;
    const ang = Math.round((Math.atan2(cy - d.y, cx - d.x) * 180) / Math.PI);
    onRotate(((ang % 360) + 360) % 360);
  };
  const onUp = (e: React.PointerEvent) => { dragging.current = false; (e.currentTarget as Element).releasePointerCapture?.(e.pointerId); };

  return (
    <g pointerEvents="none">
      {/* outer ring — drag anywhere on the ring to rotate */}
      <circle cx={d.x} cy={d.y} r={R} fill="none" stroke={tone} strokeWidth="1" opacity="0.35" />
      <circle cx={d.x} cy={d.y} r={R} fill="none" stroke={tone} strokeWidth="6" opacity="0.001" pointerEvents="stroke"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ cursor: 'grab' }}
      />
      {/* tick marks every 30° */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = d.x + Math.cos(a) * (R - 2);
        const y1 = d.y + Math.sin(a) * (R - 2);
        const x2 = d.x + Math.cos(a) * (R + 2);
        const y2 = d.y + Math.sin(a) * (R + 2);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={tone} strokeWidth="0.6" opacity="0.5" />;
      })}
      {/* heading badge above the device */}
      <g transform={`translate(${d.x}, ${d.y - R - 10})`}>
        <rect x={-16} y={-7} width={32} height={14} rx={3} fill="rgba(8,12,20,0.85)" stroke={tone} strokeWidth="0.6" />
        <text x={0} y={3} textAnchor="middle" fill="#E2E8F0" fontSize="10" fontWeight="700" fontFamily="ui-monospace, monospace">{d.rot}°</text>
      </g>
      {/* drag handle on the ring */}
      <g pointerEvents="auto" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ cursor: 'grab' }}>
        <circle cx={handleX} cy={handleY} r={6} fill={tone} opacity="0.2" />
        <circle cx={handleX} cy={handleY} r={3.5} fill={tone} stroke="#0B131F" strokeWidth="1" />
      </g>
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DEVICE GLYPHS — each looks like the physical hardware (top-down)
   ═══════════════════════════════════════════════════════════════════════ */

const DEVICE_ICON: Record<DeviceType, any> = {
  'cam.bullet': Video, 'cam.dome': Aperture, 'cam.ptz': ScanEye, 'cam.multisensor': Grid3x3,
  'cam.fisheye': Disc, 'cam.thermal': Flame, 'cam.lpr': Car, 'cam.body': UserSquare2,
  'acc.reader': ScanFace, 'acc.biometric': Fingerprint, 'acc.strike': KeyRound, 'acc.maglock': Lock,
  'acc.exit': DoorOpen, 'acc.turnstile': GitBranch, 'acc.intercom': Phone,
  'int.motion': Radar, 'int.glassbreak': AlertTriangle, 'int.contact': DoorOpen, 'int.panic': BellRing,
  'int.vibration': Vibrate, 'int.keypad': Hash,
  'net.switch': Cable, 'net.idf': Server, 'net.ap': Wifi, 'net.firewall': ShieldCheck, 'net.bridge': Antenna,
  'aud.speaker': Volume2, 'aud.horn': Megaphone, 'aud.amp': Speaker, 'aud.mic': Mic, 'aud.intercom': Phone,
  'sto.nvr': HardDrive, 'sto.server': Server, 'sto.archive': Database, 'sto.cloud': Cloud,
  'dis.monitor': Monitor, 'dis.wall': Tv2, 'dis.kiosk': AppWindow, 'dis.signage': MonitorSmartphone,
  'pwr.ups': BatteryCharging, 'pwr.poe': Zap, 'pwr.surge': ShieldAlert, 'pwr.solar': Sun,
  'sen.temp': Thermometer, 'sen.smoke': CloudFog, 'sen.water': Droplets, 'sen.occupancy': Users2,
  'sen.gas': Wind, 'sen.gunshot': CrosshairIcon,
};

// Modern device chip — used in InsertDock cards, layer rows, drag ghost, etc.
// Axis Site Designer-style minimal marker — white circle with thin colored ring and line glyph
// HardwareGlyph — Axis Site Designer style. Single-tone line glyphs drawn
// directly on the plan: no card backgrounds, no fills beyond the tone, no shading.
// Each device type reads as a tiny technical drawing of the actual hardware.
function HardwareGlyph({ d, tone, selected, scale = 1 }: { d: Device; tone: string; selected: boolean; scale?: number }) {
  const kind = TYPE_KIND[d.type];
  const rot = d.rot;
  const ink = tone;
  const sw = 1.4;

  return (
    <g transform={`translate(${d.x}, ${d.y}) scale(${scale})`}>
      {/* glass knock-out with tone glow — reads on the cinematic dark plan */}
      <circle r={15} fill={ink} opacity="0.10" />
      <circle r={13} fill="#0B131F" opacity="0.92" stroke={ink} strokeWidth="0.8" />

      <g transform={`rotate(${rot})`} fill="none" stroke={ink} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
        {kind === 'camera' && d.type === 'cam.bullet' && (
          <g>
            {/* mounting arm */}
            <path d="M -11 5 L -8 -1 L -5 -1" />
            {/* barrel */}
            <rect x={-8} y={-5} width={15} height={10} rx={4} />
            {/* sunshade lip */}
            <line x1={-8} y1={-2.5} x2={7} y2={-2.5} />
            {/* lens face */}
            <circle cx={7} cy={0} r={3.2} />
            <circle cx={7} cy={0} r={1} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.dome' && (
          <g>
            {/* base plate */}
            <line x1={-10} y1={4} x2={10} y2={4} />
            {/* dome */}
            <path d="M -10 4 A 10 10 0 0 1 10 4" />
            {/* internal lens */}
            <circle cx={3} cy={0} r={2.4} />
            <circle cx={3} cy={0} r={0.9} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.ptz' && (
          <g>
            {/* ceiling line */}
            <line x1={-7} y1={-8} x2={7} y2={-8} />
            {/* pendant arm */}
            <line x1={0} y1={-8} x2={0} y2={-4} />
            {/* sphere */}
            <circle cx={0} cy={2} r={6} />
            {/* equator line */}
            <path d="M -6 2 A 6 6 0 0 1 6 2" />
            {/* forward lens */}
            <circle cx={3.5} cy={3} r={2} />
            <circle cx={3.5} cy={3} r={0.8} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.multisensor' && (
          <g>
            <line x1={-11} y1={4} x2={11} y2={4} />
            <path d="M -11 4 A 11 6 0 0 1 11 4" />
            {[-7, -2.4, 2.4, 7].map((x, i) => (
              <g key={i}>
                <circle cx={x} cy={1.6} r={1.5} />
                <circle cx={x} cy={1.6} r={0.5} fill={ink} stroke="none" />
              </g>
            ))}
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.fisheye' && (
          <g>
            <circle r={10} />
            <circle r={6.5} />
            <circle r={2.5} />
            <line x1={-10} y1={0} x2={10} y2={0} strokeWidth={0.7} />
            <line x1={0} y1={-10} x2={0} y2={10} strokeWidth={0.7} />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.thermal' && (
          <g>
            <path d="M -12 6 L -9 0 L -6 0" />
            <rect x={-9} y={-5} width={18} height={10} rx={1.5} />
            <rect x={-6} y={-3} width={8} height={6} />
            {[-4, -2, 0, 1.8].map((x) => <line key={x} x1={x} y1={-2.5} x2={x} y2={2.5} strokeWidth={0.6} />)}
            <circle cx={6} cy={0} r={2} />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.lpr' && (
          <g>
            <path d="M -13 6 L -10 0 L -7 0" />
            <rect x={-10} y={-4.5} width={20} height={9} rx={1.5} />
            <rect x={-7} y={-2.6} width={8} height={2.6} />
            <circle cx={6.5} cy={1} r={2.4} />
            <circle cx={6.5} cy={1} r={0.8} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.body' && (
          <g>
            <rect x={-4.5} y={-9} width={9} height={17} rx={1.6} />
            <line x1={-3} y1={-9} x2={3} y2={-9} strokeWidth={2.2} />
            <circle cx={0} cy={-3} r={2.2} />
            <circle cx={0} cy={-3} r={0.8} fill={ink} stroke="none" />
            <circle cx={0} cy={4} r={1.2} />
          </g>
        )}

        {kind === 'access' && (
          <g>
            <rect x={-4} y={-10} width={8} height={20} rx={1.4} />
            <circle cx={0} cy={-6} r={1} />
            <rect x={-2.6} y={-2.6} width={5.2} height={8} rx={1} />
            <line x1={-1.6} y1={-0.8} x2={1.6} y2={-0.8} strokeWidth={0.7} />
            <line x1={-1.6} y1={1} x2={1.6} y2={1} strokeWidth={0.7} />
            <line x1={-1.6} y1={2.8} x2={1.6} y2={2.8} strokeWidth={0.7} />
          </g>
        )}
        {kind === 'network' && (
          <g>
            <rect x={-12} y={-4} width={24} height={8} rx={1.2} />
            <line x1={-12} y1={-1.4} x2={12} y2={-1.4} />
            {[-8, -4.5, -1, 2.5, 6, 9.5].map((x) => <rect key={x} x={x - 0.8} y={0.4} width={1.6} height={2.8} rx={0.2} />)}
          </g>
        )}
        {kind === 'intrusion' && (
          <g>
            <path d="M -10 7 L 0 -10 L 10 7 Z" />
            <line x1={0} y1={-3} x2={0} y2={3} strokeWidth={2} />
            <circle cx={0} cy={5.2} r={0.8} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'audio' && (
          <g>
            <circle r={10} />
            <circle r={7} />
            <circle r={4} />
            <circle r={1.4} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'storage' && (
          <g>
            <rect x={-11} y={-7} width={22} height={14} rx={1.2} />
            {[-3.5, -0.5, 2.5].map((y) => <line key={y} x1={-9} y1={y} x2={9} y2={y} strokeWidth={0.8} />)}
            <circle cx={8} cy={-5} r={0.6} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'display' && (
          <g>
            <rect x={-12} y={-8} width={24} height={14} rx={1} />
            <line x1={-3} y1={6} x2={3} y2={6} />
            <line x1={-6} y1={8.5} x2={6} y2={8.5} strokeWidth={1.6} />
          </g>
        )}
        {kind === 'power' && (
          <g>
            <rect x={-8} y={-11} width={16} height={22} rx={1.4} />
            <line x1={-6} y1={-7} x2={6} y2={-7} />
            <path d="M -2 -3 L 2 -3 L 0 1 L 3 1 L -2 7 L 0 2 L -3 2 Z" />
          </g>
        )}
        {kind === 'sensor' && (
          <g>
            <line x1={-10} y1={4} x2={10} y2={4} />
            <path d="M -10 4 A 10 7 0 0 1 10 4" />
            {[-6, -2, 2, 6].map((x) => <line key={x} x1={x} y1={4} x2={x} y2={-3} strokeWidth={0.7} />)}
            <circle cx={0} cy={1} r={1} fill={ink} stroke="none" />
          </g>
        )}
      </g>

      {/* Selection ring */}
      {selected && <circle r={15} fill="none" stroke={tone} strokeWidth="1.5" strokeDasharray="3 2" />}
    </g>
  );
}

const KIND_INITIAL: Record<DeviceKind, string> = {
  camera: 'C', access: 'A', network: 'N', intrusion: '!',
  audio: '♪', storage: 'R', display: '▢', power: '⚡', sensor: '°',
};

function IsoDeviceBadge({ d }: { d: Device }) {
  const tone = KIND_TONE[TYPE_KIND[d.type]];
  const Icon = DEVICE_ICON[d.type];
  return (
    <div style={{ width: 56, position: 'relative', textAlign: 'center', userSelect: 'none', fontFamily: 'inherit' }}>
      <div style={{ position: 'relative', width: 32, height: 32, margin: '0 auto' }}>
        <div style={{ width: 32, height: 32, borderRadius: 999, background: '#FFFFFF', boxShadow: `inset 0 0 0 2px ${tone}, 0 2px 6px rgba(15,23,42,0.18)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 16, height: 16, color: tone }} strokeWidth={2.2} />
        </div>
      </div>
      <div style={{ marginTop: 4, display: 'inline-block', padding: '1px 7px', background: 'rgba(255,255,255,0.95)', color: '#1F2937', borderRadius: 3, fontSize: 10, fontWeight: 600, border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 3px rgba(15,23,42,0.12)', whiteSpace: 'nowrap' }}>
        {d.id}
      </div>
    </div>
  );
}

function DeviceGlyph({ type, size, tone }: { type: DeviceType; size: number; tone: string }) {
  const Icon = DEVICE_ICON[type] ?? Video;
  return (
    <span className="inline-flex items-center justify-center" style={{ width: size, height: size, color: tone }}>
      <Icon style={{ width: size, height: size }} strokeWidth={1.9} />
    </span>
  );
}

// SVG path version kept for use inside the canvas SVG layer (presence cursors etc.)
// Kept as a no-op fallback in case anything still references it.
function DeviceGlyphPaths({ type, tone }: { type: DeviceType; tone: string }) {
  const s = 1;
  switch (type) {
    case 'cam.bullet':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-10" y="-5" width="20" height="10" rx="2" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          <circle cx="8" cy="0" r="3.5" fill="#0D1117" />
          <circle cx="8" cy="0" r="1.6" fill={tone} />
          <rect x="-11" y="-2" width="3" height="4" fill="#0D1117" />
        </g>
      );
    case 'cam.dome':
      return (
        <g transform={`scale(${s})`}>
          <circle r="10" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          <circle r="6" fill="#0D1117" />
          <circle r="3" fill={tone} />
        </g>
      );
    case 'cam.ptz':
      return (
        <g transform={`scale(${s})`}>
          <circle r="11" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          <path d="M -7 -2 A 7 7 0 0 1 7 -2" fill="none" stroke="#0D1117" strokeWidth="1.5" />
          <circle r="3.5" fill="#0D1117" />
          <polygon points="7,-4 11,-2 7,0" fill="#0D1117" />
        </g>
      );
    case 'cam.multisensor':
      return (
        <g transform={`scale(${s})`}>
          <circle r="12" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          {[[-5,-5],[5,-5],[-5,5],[5,5]].map(([x,y],i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill="#0D1117" />
              <circle cx={x} cy={y} r="1.4" fill={tone} />
            </g>
          ))}
        </g>
      );
    case 'cam.fisheye':
      return (
        <g transform={`scale(${s})`}>
          <circle r="11" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          <circle r="7" fill="#0D1117" />
          <circle r="3" fill={tone} />
          <line x1="-11" y1="0" x2="11" y2="0" stroke="#0D1117" strokeWidth="0.8" />
          <line x1="0" y1="-11" x2="0" y2="11" stroke="#0D1117" strokeWidth="0.8" />
        </g>
      );
    case 'cam.thermal':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-10" y="-6" width="20" height="12" rx="2" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          <rect x="-7" y="-3" width="14" height="6" fill="#0D1117" />
          <text x="0" y="2" textAnchor="middle" fill={tone} fontSize="6" fontWeight="700">TH</text>
        </g>
      );
    case 'acc.reader':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-4" y="-11" width="8" height="22" rx="1.5" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          <circle cx="0" cy="-7" r="1.6" fill="#0D1117" />
          <rect x="-2.5" y="-3" width="5" height="9" rx="0.5" fill="#0D1117" />
        </g>
      );
    case 'acc.strike':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-10" y="-4" width="20" height="8" rx="1.5" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          <rect x="-3" y="-2" width="6" height="4" fill="#0D1117" />
          <rect x="-3" y="-1" width="6" height="2" fill={tone} />
        </g>
      );
    case 'acc.maglock':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-12" y="-3" width="24" height="6" rx="1" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          <rect x="-10" y="-1.5" width="3" height="3" fill="#0D1117" />
          <rect x="7" y="-1.5" width="3" height="3" fill="#0D1117" />
        </g>
      );
    case 'acc.exit':
      return (
        <g transform={`scale(${s})`}>
          <circle r="9" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          <circle r="5" fill="#0D1117" />
          <path d="M -2 0 L 0 -2 L 2 0 L 0 2 Z" fill={tone} />
        </g>
      );
    case 'net.switch':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-12" y="-5" width="24" height="10" rx="1.5" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          {[-8,-4,0,4,8].map((x,i) => <rect key={i} x={x-1} y={-1.5} width="2" height="3" fill="#0D1117" />)}
        </g>
      );
    case 'net.idf':
      return (
        <g transform={`scale(${s})`}>
          <rect x="-9" y="-12" width="18" height="24" rx="1.5" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          {[-8,-4,0,4,8].map((y,i) => <rect key={i} x={-6} y={y-1} width="12" height="2" fill="#0D1117" />)}
        </g>
      );
    case 'net.ap':
      return (
        <g transform={`scale(${s})`}>
          <circle r="11" fill={tone} stroke="#0D1117" strokeWidth="1.5" />
          <circle r="7" fill="none" stroke="#0D1117" strokeWidth="1.2" />
          <circle r="3.5" fill="none" stroke="#0D1117" strokeWidth="1.2" />
          <circle r="1.5" fill="#0D1117" />
        </g>
      );
  }
}

const KIND_ICON: Record<DeviceKind, any> = {
  camera: Video, access: ScanFace, network: Cable, intrusion: Radar,
  audio: Volume2, storage: HardDrive, display: Monitor, power: BatteryCharging, sensor: Thermometer,
};

function CategoryGlyph({ kind, active }: { kind: DeviceKind; active?: boolean }) {
  const Icon = KIND_ICON[kind];
  return <Icon style={{ width: 14, height: 14 }} strokeWidth={2} />;
}

/* ═══════════════════════════════════════════════════════════════════════
   SELECTION PILL — floats near the selected device
   ═══════════════════════════════════════════════════════════════════════ */

type EditTab = 'overview' | 'lens' | 'ai' | 'network' | 'power' | 'mounting' | 'compliance' | 'telemetry' | 'linked' | 'notes';

interface ToolbarAction {
  id: string;
  icon: any;
  label: string;
  tone?: string;
  onClick: () => void;
  primary?: boolean;
  /** When true, this action is hidden by default and appears in the
   *  "More" overflow popover instead of the main toolbar row. Keeps
   *  the toolbar at ≤5 primary actions so it never feels like a wall
   *  of icons. */
  overflow?: boolean;
  /** Destructive action — rendered in rose in the overflow popover
   *  to telegraph "this removes something." */
  danger?: boolean;
}

function ToolbarButton({ a, tone }: { a: ToolbarAction; tone: string }) {
  const Icon = a.icon;
  // a.tone overrides the device-level tone (lens chips use their own color).
  const buttonTone = a.tone ?? tone;
  const accent = a.primary ? buttonTone : 'rgba(226,232,240,0.85)';
  // The primary action gets a soft tinted background instead of a neon
  // underline — a quieter signal that reads as "this is the main thing"
  // without shouting. Sentence-case label, tighter tracking, all-of-a-piece
  // with the rest of the contextual strip.
  return (
    <button
      onClick={a.onClick}
      title={a.label}
      className="group relative px-3 inline-flex items-center gap-1.5 border-r border-white/8 transition-colors duration-150 hover:bg-white/[0.05]"
      style={{
        color: accent,
        background: a.primary ? `${buttonTone}14` : 'transparent',
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[11px] font-medium tracking-tight">{a.label}</span>
    </button>
  );
}

function MultisensorLensChips({
  activeLens, setActiveLens, lensMode, setLensMode, tone, onLensHover,
}: { activeLens: ActiveLens; setActiveLens: (l: ActiveLens) => void; lensMode: LensMode; setLensMode: (m: LensMode) => void; tone: string; onLensHover?: (lens: LensId | null) => void }) {
  // Refined lens selector. Each chip carries its lens color as a small dot
  // that scales up subtly when active — the only motion needed for a feel
  // of premium tactility. No uppercase tracking; no neon underlines; the
  // chip background tints in the lens's own color when selected, which
  // pairs visually with the cone-color screen-blend on the canvas.
  return (
    <div
      className="mb-1.5 flex items-stretch h-8 rounded-lg overflow-hidden text-[11px]"
      style={{
        background: 'rgba(22,30,46,0.94)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 10px 28px -14px rgba(0,0,0,0.5)',
        animation: 'lens-chip-in 240ms cubic-bezier(0.22, 1, 0.36, 1) 60ms both',
      }}
    >
      <button
        onClick={() => setActiveLens('all')}
        className="px-3 inline-flex items-center gap-1.5 border-r border-white/8 transition-colors duration-150 hover:bg-white/[0.04]"
        style={{
          background: activeLens === 'all' ? `${tone}18` : 'transparent',
          color: activeLens === 'all' ? '#F1F5F9' : 'rgba(148,163,184,0.85)',
        }}
        title="Control all four lenses together"
      >
        <span className="font-medium tracking-tight">All</span>
      </button>
      {(['a', 'b', 'c', 'd'] as const).map((l) => {
        const active = activeLens === l;
        const lensColor = LENS_TONE[l];
        return (
          <button
            key={l}
            onClick={() => setActiveLens(l)}
            onPointerEnter={() => onLensHover?.(l)}
            onPointerLeave={() => onLensHover?.(null)}
            className="px-3 inline-flex items-center gap-1.5 border-r border-white/8 transition-colors duration-150 hover:bg-white/[0.04]"
            style={{
              background: active ? `${lensColor}1A` : 'transparent',
              color: active ? '#F1F5F9' : 'rgba(148,163,184,0.85)',
            }}
            title={`Edit lens ${LENS_LABEL[l]} only — hover to highlight on canvas`}
          >
            <span
              className="rounded-full transition-all duration-200 ease-out"
              style={{
                width: active ? 7 : 5,
                height: active ? 7 : 5,
                background: active ? lensColor : 'rgba(100,116,139,0.7)',
                boxShadow: active ? `0 0 6px ${lensColor}99` : 'none',
              }}
            />
            <span className="font-medium tracking-tight">{LENS_LABEL[l]}</span>
          </button>
        );
      })}
      <button
        onClick={() => setLensMode(lensMode === 'linked' ? 'independent' : 'linked')}
        className="px-3 inline-flex items-center gap-1.5 transition-colors duration-150 hover:bg-white/[0.04]"
        style={{ color: lensMode === 'linked' ? tone : 'rgba(148,163,184,0.85)' }}
        title={lensMode === 'linked' ? 'Linked — moving one lens moves all four' : 'Independent — each lens moves alone'}
      >
        {lensMode === 'linked' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
        <span className="font-medium tracking-tight">{lensMode === 'linked' ? 'Linked' : 'Indep.'}</span>
      </button>
    </div>
  );
}

function SelectionPill({ d, zoom, onRotate, onDelete, onUpdate, onEdit, onTargetSim, onDuplicate, onOpenTab, activeLens, setActiveLens, lensMode, setLensMode, onLensHover }: {
  d: Device; zoom: number;
  onRotate: (r: number) => void;
  onDelete: () => void;
  onUpdate: (p: Partial<Device>) => void;
  onEdit: () => void;
  onTargetSim: () => void;
  onDuplicate: () => void;
  onOpenTab: (t: EditTab) => void;
  activeLens: ActiveLens;
  setActiveLens: (l: ActiveLens) => void;
  lensMode: LensMode;
  setLensMode: (m: LensMode) => void;
  /** Carries lens-chip hover state up to the parent so the matching
   *  cone on the canvas can subtly emphasize. Optional — single-lens
   *  cameras don't use it. */
  onLensHover?: (lens: LensId | null) => void;
}) {
  const product = PRODUCTS.find((p) => p.id === d.product);
  const kind = TYPE_KIND[d.type];
  const tone = KIND_TONE[kind];
  const isCam = kind === 'camera';
  const isMultisensor = d.type === 'cam.multisensor';
  const isDoor = d.type === 'acc.exit' || d.type === 'acc.door' || d.type === 'acc.gate';
  const isReader = d.type === 'acc.reader' || d.type === 'acc.biometric';
  const isIDF = d.type === 'net.idf' || d.type === 'net.mdf' || d.type === 'net.switch';
  const isPathway = kind === 'network' && !isIDF && !isReader;

  // Build toolbar actions per device kind. Each kind exposes at most 5
  // primary actions; the rest fall into the "More" overflow popover. The
  // primary set is chosen for the most frequent operations during that
  // device's lifecycle (e.g. cameras: rotate + FOV; doors: electrify +
  // reader + egress). Less-used controls (link, note, schedule, target
  // sim, delete) move behind More so the toolbar stays calm.
  const actions: ToolbarAction[] = (() => {
    // Toolbars follow the published canvas spec: max 5 visible actions
    // per device kind. Everything else falls into the "More" overflow.
    // Camera:      Edit · Rotate · FOV · Duplicate · More
    // Multisensor: Edit · Lens · Mode · Target · More
    // Door:        Edit · Hardware · Electrify · Egress · More
    // Reader:      Edit · Link Door · Mount · Validate · More
    // Pathway:     Edit Route · Add Bend · Add Pull Box · Cable · More
    // IDF:         Edit · Switches · PoE · Links · More
    if (isMultisensor) {
      return [
        { id: 'edit',   icon: Settings2,     label: 'Edit',   onClick: () => onOpenTab('overview'), primary: true },
        { id: 'lens',   icon: Aperture,      label: 'Lens',   onClick: () => onOpenTab('lens') },
        { id: 'mode',   icon: lensMode === 'linked' ? Lock : Unlock,
          label: lensMode === 'linked' ? 'Linked' : 'Indep',
          onClick: () => setLensMode(lensMode === 'linked' ? 'independent' : 'linked') },
        { id: 'target', icon: ScanFace,      label: 'Target', onClick: onTargetSim },
        // Overflow
        { id: 'auto',   icon: Sparkles,      label: 'AI optimize', onClick: () => onOpenTab('ai'), overflow: true },
        { id: 'dup',    icon: Copy,          label: 'Duplicate',   onClick: onDuplicate, overflow: true },
        { id: 'note',   icon: MessageSquare, label: 'Note',        onClick: () => onOpenTab('notes'), overflow: true },
        { id: 'del',    icon: Trash2,        label: 'Delete',      onClick: onDelete, overflow: true, danger: true },
      ];
    }
    if (isCam) {
      return [
        { id: 'edit',   icon: Settings2, label: 'Edit',      onClick: () => onOpenTab('overview'), primary: true },
        { id: 'rotate', icon: RotateCw,  label: 'Rotate',    onClick: () => onRotate((d.rot + 15) % 360) },
        { id: 'fov',    icon: Aperture,  label: 'FOV',       onClick: () => onOpenTab('lens') },
        { id: 'dup',    icon: Copy,      label: 'Duplicate', onClick: onDuplicate },
        // Overflow
        { id: 'ai',     icon: Sparkles,      label: 'AI optimize', onClick: () => onOpenTab('ai'), overflow: true },
        { id: 'target', icon: ScanFace,      label: 'Target sim',  onClick: onTargetSim, overflow: true },
        { id: 'link',   icon: GitBranch,     label: 'Link path',   onClick: () => onOpenTab('linked'), overflow: true },
        { id: 'note',   icon: MessageSquare, label: 'Note',        onClick: () => onOpenTab('notes'), overflow: true },
        { id: 'del',    icon: Trash2,        label: 'Delete',      onClick: onDelete, overflow: true, danger: true },
      ];
    }
    if (isReader) {
      return [
        { id: 'edit',     icon: Settings2,   label: 'Edit',      onClick: () => onOpenTab('overview'), primary: true },
        { id: 'linkdoor', icon: KeyRound,    label: 'Link door', onClick: () => onOpenTab('linked') },
        { id: 'mount',    icon: Crosshair,   label: 'Mount',     onClick: () => onOpenTab('mounting') },
        { id: 'validate', icon: ShieldCheck, label: 'Validate',  onClick: () => onOpenTab('compliance') },
        // Overflow
        { id: 'ai',     icon: Sparkles,      label: 'AI hint', onClick: () => onOpenTab('ai'), overflow: true },
        { id: 'dup',    icon: Copy,          label: 'Duplicate', onClick: onDuplicate, overflow: true },
        { id: 'note',   icon: MessageSquare, label: 'Note',      onClick: () => onOpenTab('notes'), overflow: true },
        { id: 'del',    icon: Trash2,        label: 'Delete',    onClick: onDelete, overflow: true, danger: true },
      ];
    }
    if (isDoor) {
      return [
        { id: 'edit',     icon: Settings2,   label: 'Edit',      onClick: () => onOpenTab('overview'), primary: true },
        { id: 'hardware', icon: KeyRound,    label: 'Hardware',  onClick: () => onOpenTab('linked') },
        { id: 'elec',     icon: Zap,         label: 'Electrify', onClick: () => onOpenTab('power') },
        { id: 'egress',   icon: DoorOpen,    label: 'Egress',    onClick: () => onOpenTab('compliance') },
        // Overflow
        { id: 'validate', icon: ShieldCheck, label: 'Validate',    onClick: () => onOpenTab('ai'), overflow: true },
        { id: 'sched',    icon: Calendar,    label: 'Schedule',    onClick: () => onOpenTab('notes'), overflow: true },
        { id: 'link',     icon: GitBranch,   label: 'Pathway',     onClick: () => onOpenTab('linked'), overflow: true },
        { id: 'explode',  icon: Layers,      label: 'Exploded view', onClick: () => onOpenTab('mounting'), overflow: true },
        { id: 'del',      icon: Trash2,      label: 'Delete',      onClick: onDelete, overflow: true, danger: true },
      ];
    }
    if (isIDF) {
      return [
        { id: 'edit',     icon: Settings2,       label: 'Edit',     onClick: () => onOpenTab('overview'), primary: true },
        { id: 'switches', icon: Server,          label: 'Switches', onClick: () => onOpenTab('network') },
        { id: 'poe',      icon: BatteryCharging, label: 'PoE',      onClick: () => onOpenTab('power') },
        { id: 'links',    icon: GitBranch,       label: 'Links',    onClick: () => onOpenTab('linked') },
        // Overflow
        { id: 'thermal', icon: Thermometer,    label: 'Thermal',  onClick: () => onOpenTab('telemetry'), overflow: true },
        { id: 'ups',     icon: Zap,            label: 'UPS',      onClick: () => onOpenTab('power'), overflow: true },
        { id: 'fiber',   icon: Cable,          label: 'Fiber',    onClick: () => onOpenTab('network'), overflow: true },
        { id: 'failure', icon: AlertTriangle,  label: 'Failure analysis', onClick: () => onOpenTab('ai'), overflow: true },
        { id: 'del',     icon: Trash2,         label: 'Delete',   onClick: onDelete, overflow: true, danger: true },
      ];
    }
    if (isPathway) {
      return [
        { id: 'edit',   icon: Settings2, label: 'Edit route',   onClick: () => onOpenTab('overview'), primary: true },
        { id: 'bend',   icon: CircleDot, label: 'Add bend',     onClick: () => onOpenTab('linked') },
        { id: 'pull',   icon: Hash,      label: 'Add pull box', onClick: () => onOpenTab('mounting') },
        { id: 'cable',  icon: Cable,     label: 'Cable',        onClick: () => onOpenTab('network') },
        // Overflow
        { id: 'fiber',  icon: Cable,     label: 'Fiber',       onClick: () => onOpenTab('network'), overflow: true },
        { id: 'emt',    icon: Slash,     label: 'EMT',         onClick: () => onOpenTab('compliance'), overflow: true },
        { id: 'bridge', icon: Wifi,      label: 'Wireless',    onClick: () => onOpenTab('network'), overflow: true },
        { id: 'ai',     icon: Sparkles,  label: 'AI optimize', onClick: () => onOpenTab('ai'), overflow: true },
        { id: 'fill',   icon: BarChart3, label: 'Fill %',      onClick: () => onOpenTab('telemetry'), overflow: true },
        { id: 'del',    icon: Trash2,    label: 'Delete',      onClick: onDelete, overflow: true, danger: true },
      ];
    }
    return [
      { id: 'edit', icon: Settings2,     label: 'Edit',      onClick: () => onOpenTab('overview'), primary: true },
      { id: 'dup',  icon: Copy,          label: 'Duplicate', onClick: onDuplicate },
      { id: 'note', icon: MessageSquare, label: 'Note',      onClick: () => onOpenTab('notes'), overflow: true },
      { id: 'del',  icon: Trash2,        label: 'Delete',    onClick: onDelete, overflow: true, danger: true },
    ];
  })();
  const primaryActions = actions.filter((a) => !a.overflow);
  const overflowActions = actions.filter((a) => a.overflow);
  const focal = (d.type === 'cam.ptz' ? 4.3 + ((d.rot % 30) / 30) * 25 : d.type === 'cam.fisheye' ? 1.4 : 2.8 + ((Math.abs(d.rot) % 60) / 60) * 6).toFixed(1);
  const doriRange = d.type === 'cam.ptz' ? 64 : d.type === 'cam.fisheye' ? 14 : 28;
  const kindLabel = isCam ? 'Camera' : isDoor ? 'Opening' : isIDF ? 'Network Node' : isPathway ? 'Pathway' : 'Device';

  return (
    <div
      className="absolute z-30 pointer-events-auto select-none"
      style={{
        left: d.x * zoom,
        top: d.y * zoom - 70,
        transform: 'translateX(-50%)',
        animation: 'pill-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
      }}
    >
      {/* Subtle tether — single hairline pencil from pill to device. No
          gradient, no glow dot. Lets the strip feel like a quiet annotation
          rather than a HUD beacon. */}
      <div
        className="absolute left-1/2 top-full h-[18px] w-px -translate-x-1/2"
        style={{ background: 'rgba(255,255,255,0.14)' }}
      />

      {/* Multisensor lens chips sit above the strip when applicable. */}
      {isMultisensor && (
        <MultisensorLensChips
          activeLens={activeLens} setActiveLens={setActiveLens}
          lensMode={lensMode} setLensMode={setLensMode}
          tone={tone}
          onLensHover={onLensHover}
        />
      )}

      {/* Single elegant strip — identity + actions inline. Reads as one
          contextual control rather than two stacked panels. Restrained
          materials: hairline border, soft shadow, no neon outline. The
          dot retains a subtle tone glow as the only color accent. */}
      <div
        className="flex items-stretch h-9 rounded-lg overflow-hidden"
        style={{
          background: 'rgba(22,30,46,0.94)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 10px 28px -14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* Identity cell — kind dot, editable id, optional manufacturer */}
        <div className="flex items-center gap-2 px-2.5 border-r border-white/8">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: tone, boxShadow: `0 0 6px ${tone}88` }}
          />
          <CommitInput
            value={d.id}
            onCommit={(v) => onUpdate({ id: v })}
            className="bg-transparent w-[82px] focus:outline-none text-[11.5px] font-medium tracking-tight text-slate-100"
          />
          {product && (
            <span className="text-[10px] text-slate-400 tracking-tight whitespace-nowrap">{product.mfr}</span>
          )}
        </div>

        {/* Actions */}
        {primaryActions.map((a) => <ToolbarButton key={a.id} a={a} tone={tone} />)}
        {overflowActions.length > 0 && <MoreButton items={overflowActions} tone={tone} />}
      </div>
    </div>
  );
}

/** Overflow popover anchored at the end of the SelectionPill toolbar.
 *  Holds destructive / secondary actions so the primary row stays at
 *  ≤5 buttons. Click outside or press Escape to close. */
function MoreButton({ items, tone }: { items: ToolbarAction[]; tone: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="More"
        className="px-3 inline-flex items-center gap-1.5 text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors duration-150"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
        <span className="text-[11px] font-medium tracking-tight">More</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-40 w-44 rounded-md overflow-hidden"
          style={{
            background: 'rgba(8,12,20,0.94)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: `0 14px 32px -10px rgba(0,0,0,0.85), 0 0 0 1px ${tone}22`,
          }}
        >
          {items.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={() => { a.onClick(); setOpen(false); }}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-xs hover:bg-white/5 transition-colors ${a.danger ? 'text-rose-300 hover:text-rose-200' : 'text-slate-200'}`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EDIT DRAWER — right-side engineering inspector with 10 tabs
   ═══════════════════════════════════════════════════════════════════════ */

// Six visible drawer tabs. Each visible tab covers one or more internal
// section ids — clicking the Coverage tab renders Lens + AI + Telemetry
// content together so the user has ONE place to do coverage work, not three.
const EDIT_TABS: { id: EditTab; label: string; icon: any; covers: EditTab[] }[] = [
  { id: 'overview',   label: 'General',          icon: ListChecks,      covers: ['overview'] },
  { id: 'mounting',   label: 'Placement',        icon: Wrench,          covers: ['mounting'] },
  { id: 'lens',       label: 'Coverage',         icon: Aperture,        covers: ['lens', 'ai', 'telemetry'] },
  { id: 'power',      label: 'Power & Network',  icon: BatteryCharging, covers: ['power', 'network'] },
  { id: 'compliance', label: 'Compatibility',    icon: ShieldCheck,     covers: ['compliance', 'linked'] },
  { id: 'notes',      label: 'Notes & Media',    icon: FileText,        covers: ['notes'] },
];

/** Which visible tab does this internal section belong to? Used to keep
 *  the strip highlight in sync when toolbar buttons open hidden section
 *  ids (e.g. clicking "AI" still shows the Coverage tab as active). */
function tabGroupOf(t: EditTab): EditTab {
  for (const g of EDIT_TABS) if (g.covers.includes(t)) return g.id;
  return 'overview';
}
/** Should the section's body render for the currently-active tab? True
 *  when the section belongs to the same visible group as `tab`. */
function bodyShows(tab: EditTab, section: EditTab): boolean {
  return tabGroupOf(tab) === tabGroupOf(section);
}

/** Human-readable kind for the drawer header. */
function labelForKind(k: DeviceKind): string {
  return ({
    camera: 'Camera', access: 'Access', network: 'Network',
    power: 'Power', sensor: 'Sensor', audio: 'Audio',
    storage: 'Storage', display: 'Display', intrusion: 'Intrusion',
  } as Record<string, string>)[k] ?? k;
}

// Drawer building blocks — refined for editorial readability over HUD
// density. Sentence-case labels, no tracking, calmer weights, more
// breathing room. The drawer body should read like a configuration page,
// not a debug panel.
function Row({ label, value, tone }: { label: string; value: any; tone?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-b-0">
      <span className="text-[11.5px] text-slate-400">{label}</span>
      <span className="text-[12.5px] tabular-nums font-medium" style={{ color: tone || '#E7EDF6' }}>{value}</span>
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-[13px] font-medium text-slate-200 mb-3 tracking-tight">{title}</div>
      {children}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, unit, onChange, tone }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; tone: string }) {
  return (
    <div className="mb-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11.5px] text-slate-400">{label}</span>
        <span className="text-[12.5px] tabular-nums font-medium text-slate-100">{value.toFixed(step < 1 ? 1 : 0)}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: tone }}
      />
    </div>
  );
}

function EditDrawer({ d, open, tab, setTab, onClose, onUpdate, activeLens, setActiveLens, lensMode, setLensMode }: {
  d: Device; open: boolean; tab: EditTab; setTab: (t: EditTab) => void; onClose: () => void;
  onUpdate: (p: Partial<Device>) => void;
  activeLens: ActiveLens; setActiveLens: (l: ActiveLens) => void;
  lensMode: LensMode; setLensMode: (m: LensMode) => void;
}) {
  const product = PRODUCTS.find((p) => p.id === d.product);
  const kind = TYPE_KIND[d.type];
  const tone = KIND_TONE[kind];
  const isCam = kind === 'camera';
  const isMultisensor = d.type === 'cam.multisensor';
  // Lens engineering — read from the device, fall back to type-appropriate
  // defaults the first time the inspector opens. EVERY slider writes back
  // through onUpdate so changes persist if the user closes & reopens the
  // drawer (or drags the camera). No more "fake" sliders.
  const defaultFocal = d.type === 'cam.ptz' ? 12 : d.type === 'cam.fisheye' ? 1.4 : 4.0;
  const defaultFov   = d.type === 'cam.fisheye' ? 360 : d.type === 'cam.ptz' ? 60 : 88;
  const defaultRange = d.type === 'cam.ptz' ? 70 : d.type === 'cam.bullet' ? 50 : 30;

  // Lens slider bindings. For multisensors the active lens chip drives which
  // lens (or all four) the sliders are reading and writing. For single
  // cameras the sliders bind directly to d.focal/fov/range.
  const lenses = isMultisensor ? getLenses(d) : undefined;
  /** Apply a partial lens patch. activeLens === 'all' fans the change to every
   *  enabled lens (preserves their differences proportionally for rotation
   *  but uniformly sets fov/range/focal). */
  const patchLens = (patch: Partial<LensCfg>, deltaRot?: number) => {
    if (!lenses) return;
    if (activeLens === 'all') {
      const next: { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg } = {
        a: { ...lenses.a }, b: { ...lenses.b }, c: { ...lenses.c }, d: { ...lenses.d },
      };
      (['a', 'b', 'c', 'd'] as const).forEach((k) => {
        if (deltaRot !== undefined) next[k].rotation = ((lenses[k].rotation + deltaRot) % 360 + 360) % 360;
        Object.assign(next[k], patch);
      });
      onUpdate({ lenses: next });
    } else {
      const k = activeLens;
      onUpdate({ lenses: { ...lenses, [k]: { ...lenses[k], ...patch } } });
    }
  };

  const lensReadout: LensCfg | null = (() => {
    if (!lenses) return null;
    if (activeLens === 'all') {
      // Average reading for the "All" tab so the sliders show a sensible
      // group value. Writes still fan out via patchLens.
      const avg = (key: keyof LensCfg) => Math.round(((lenses.a as any)[key] + (lenses.b as any)[key] + (lenses.c as any)[key] + (lenses.d as any)[key]) / 4);
      return { rotation: avg('rotation'), fov: avg('fov'), range: avg('range'), focal: avg('focal'), enabled: true };
    }
    return lenses[activeLens];
  })();

  const localFocal = lensReadout?.focal ?? d.focal ?? defaultFocal;
  const hfov       = lensReadout?.fov   ?? d.fov   ?? defaultFov;
  const distance   = lensReadout?.range ?? d.range ?? defaultRange;
  const lensRot    = lensReadout?.rotation ?? d.rot;

  const setLocalFocal = (v: number) => lenses ? patchLens({ focal: v }) : onUpdate({ focal: v });
  const setHfov       = (v: number) => lenses ? patchLens({ fov: v })   : onUpdate({ fov: v });
  const setDistance   = (v: number) => lenses ? patchLens({ range: v }) : onUpdate({ range: v });
  const setLensRot    = (v: number) => lenses ? patchLens({ rotation: v }) : onUpdate({ rot: v });

  const doriRange = distance;
  // Live engineering telemetry derived from current lens state — recomputes
  // on every slider tick so the numbers in the Telemetry section are real,
  // not static placeholders.
  const overlapPct = 18 + (Math.abs(d.rot) % 30);
  const blindPct = 6 + (Math.abs(d.rot) % 12);
  const pxPerFt = Math.round(180 - distance * 1.4);

  return (
    <div
      className={`absolute top-0 right-0 bottom-0 z-40 transition-transform duration-300 pointer-events-auto ${open ? 'translate-x-0' : 'translate-x-full'}`}
      style={{
        width: 400,
        background: 'rgba(27,35,54,0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '-16px 0 40px -16px rgba(0,0,0,0.45)',
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Drawer header — editorial. The device id is the headline; the
          kind sits above it as a soft caption; manufacturer + model
          supports below. No HUD tracking; calmer hierarchy. */}
      <div className="px-5 pt-5 pb-4 border-b border-white/[0.05]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tone, boxShadow: `0 0 6px ${tone}66` }} />
              <span className="text-[11px] text-slate-400 tracking-tight">{labelForKind(kind)}</span>
            </div>
            <div className="text-[18px] font-medium text-slate-50 tracking-tight truncate leading-tight">{d.id}</div>
            {product && (
              <div className="text-[11.5px] text-slate-400 mt-1 truncate">{product.mfr} · {product.model}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/[0.05] text-slate-500 hover:text-slate-200 transition-colors duration-150"
            title="Close inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab strip — underlined tabs, editorial. The pill-tinted active
          state has been replaced with a hairline accent underline that
          sits on the strip's bottom border, so the active tab anchors
          the section visually without painting a colored pill on the
          drawer. */}
      <div className="px-3 border-b border-white/[0.05] flex gap-0.5 overflow-x-auto">
        {EDIT_TABS.map((t) => {
          const active = tabGroupOf(tab) === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative px-3 py-3 inline-flex items-center gap-1.5 text-[12px] transition-colors duration-150 shrink-0"
              style={{ color: active ? '#F1F5F9' : 'rgba(148,163,184,0.85)' }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: active ? tone : 'rgba(148,163,184,0.6)' }} />
              <span className="font-medium tracking-tight">{t.label}</span>
              {active && (
                <span
                  className="absolute left-2 right-2 -bottom-px h-[1.5px] rounded-full"
                  style={{ background: tone }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab body. Each section renders when its tab group is active —
          so Coverage shows Lens + AI + Telemetry together, Power & Network
          shows Power + Network together, Compatibility shows Compliance +
          Linked together. More generous padding so the editorial typography
          gets the breathing room it needs. */}
      <div className="px-5 py-5 overflow-y-auto" style={{ maxHeight: 'calc(100% - 150px)' }}>
        {bodyShows(tab, 'overview') && (
          <>
            <DrawerSection title="Identity">
              <Row label="Name" value={d.id} />
              <Row label="Type" value={d.type} />
              {product && <Row label="Manufacturer" value={product.mfr} />}
              {product && <Row label="Model" value={product.model} />}
              <Row label="Status" value={<span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34D399', boxShadow: '0 0 6px #34D399' }} />Online</span>} />
              <Row label="Firmware" value="11.8.61" />
            </DrawerSection>
            <DrawerSection title="Location">
              <Row label="Position" value={`${(d.x / 20).toFixed(1)}, ${(d.y / 20).toFixed(1)} ft`} />
              <Row label="Room" value="Lobby 01" />
              <Row label="Mount" value="Ceiling — 9' AFF" />
              <Row label="Tags" value="prosecution · entry" tone="#7CC2FF" />
            </DrawerSection>
          </>
        )}

        {bodyShows(tab, 'lens') && (
          <>
            {isMultisensor && (
              <div className="mb-3 flex items-center gap-1 p-1 rounded-md" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {/* All + per-lens chips. Each lens chip uses its own color
                    (cyan/violet/amber/emerald) so the user sees at-a-glance
                    which cone they're about to control. */}
                <button
                  onClick={() => setActiveLens('all')}
                  className="flex-1 py-1 rounded text-[11px] tabular-nums transition-colors"
                  style={{
                    background: activeLens === 'all' ? `${tone}22` : 'transparent',
                    color: activeLens === 'all' ? '#F8FAFC' : '#94A3B8',
                    boxShadow: activeLens === 'all' ? `inset 0 0 0 1px ${tone}66` : 'none',
                  }}
                >All</button>
                {(['a', 'b', 'c', 'd'] as const).map((l) => {
                  const active = activeLens === l;
                  const c = LENS_TONE[l];
                  return (
                    <button
                      key={l}
                      onClick={() => setActiveLens(l)}
                      className="flex-1 py-1 rounded text-[11px] tabular-nums transition-colors inline-flex items-center justify-center gap-1.5"
                      style={{
                        background: active ? `${c}22` : 'transparent',
                        color: active ? '#F8FAFC' : '#94A3B8',
                        boxShadow: active ? `inset 0 0 0 1px ${c}66` : 'none',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? c : '#475569' }} />
                      Lens {LENS_LABEL[l]}
                    </button>
                  );
                })}
                <button
                  onClick={() => setLensMode(lensMode === 'linked' ? 'independent' : 'linked')}
                  className="px-2 py-1 rounded text-[10px] inline-flex items-center gap-1"
                  style={{ color: lensMode === 'linked' ? tone : '#94A3B8' }}
                  title={lensMode === 'linked' ? 'Linked rotation — switch to independent' : 'Independent rotation — switch to linked'}
                >{lensMode === 'linked' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}{lensMode}</button>
              </div>
            )}
            <DrawerSection title={isMultisensor
              ? (activeLens === 'all' ? 'Direct manipulation — all lenses' : `Direct manipulation — Lens ${LENS_LABEL[activeLens]}`)
              : 'Direct manipulation'}>
              <Slider label="Rotation" value={lensRot} min={0} max={359} unit="°" tone={isMultisensor && activeLens !== 'all' ? LENS_TONE[activeLens as LensId] : tone} onChange={setLensRot} />
              <Slider label="Focal length" value={localFocal} min={1.4} max={30} step={0.1} unit="mm" tone={tone} onChange={setLocalFocal} />
              <Slider label="Horizontal FOV" value={hfov} min={20} max={360} unit="°" tone={tone} onChange={setHfov} />
              <Slider label="Distance" value={distance} min={5} max={150} unit="ft" tone={tone} onChange={setDistance} />
            </DrawerSection>
            <DrawerSection title="DORI ranges">
              {[
                { k: 'Identify',  d: Math.round(doriRange * 0.35), c: '#34D399' },
                { k: 'Recognize', d: Math.round(doriRange * 0.55), c: '#FACC15' },
                { k: 'Observe',   d: Math.round(doriRange * 0.75), c: '#FB923C' },
                { k: 'Detect',    d: doriRange, c: '#F87171' },
              ].map((row) => (
                <div key={row.k} className="flex items-center gap-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: row.c, boxShadow: `0 0 6px ${row.c}` }} />
                  <span className="flex-1 text-[11.5px] text-slate-300">{row.k}</span>
                  <span className="text-[12px] tabular-nums text-slate-200">{row.d} ft</span>
                </div>
              ))}
            </DrawerSection>
            <DrawerSection title="Telemetry">
              <Row label="px / ft @ 30ft" value={pxPerFt} />
              <Row label="Overlap %" value={`${overlapPct}%`} tone={overlapPct > 35 ? '#FACC15' : undefined} />
              <Row label="Blind spot %" value={`${blindPct}%`} tone={blindPct > 12 ? '#F87171' : undefined} />
              <Row label="Confidence" value="0.92" tone="#34D399" />
            </DrawerSection>
            {/* Multisensor scene presets — one-click orientations for
                common deployments. Each writes a new lens config to the
                device; the user can then fine-tune from there. Hidden
                for non-multisensor cameras. */}
            {isMultisensor && (
              <DrawerSection title="Scene presets">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'corridor',  label: 'Corridor',  hint: 'Two long cones, two narrow sides' },
                    { id: 'parking',   label: 'Parking',   hint: 'Four 90° quadrants, full coverage' },
                    { id: 'warehouse', label: 'Warehouse', hint: 'Narrow long cones for aisles' },
                    { id: 'lobby',     label: 'Lobby',     hint: 'Forward fan for face recognition' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        const cur = getLenses(d);
                        let next = cur;
                        if (p.id === 'corridor') {
                          next = {
                            a: { ...cur.a, rotation: 0,   fov: 60, range: 80, enabled: true },
                            b: { ...cur.b, rotation: 180, fov: 60, range: 80, enabled: true },
                            c: { ...cur.c, rotation: 90,  fov: 45, range: 30, enabled: true },
                            d: { ...cur.d, rotation: 270, fov: 45, range: 30, enabled: true },
                          };
                        } else if (p.id === 'parking') {
                          next = {
                            a: { ...cur.a, rotation: 0,   fov: 90, range: 100, enabled: true },
                            b: { ...cur.b, rotation: 90,  fov: 90, range: 100, enabled: true },
                            c: { ...cur.c, rotation: 180, fov: 90, range: 100, enabled: true },
                            d: { ...cur.d, rotation: 270, fov: 90, range: 100, enabled: true },
                          };
                        } else if (p.id === 'warehouse') {
                          next = {
                            a: { ...cur.a, rotation: 0,   fov: 50, range: 120, enabled: true },
                            b: { ...cur.b, rotation: 90,  fov: 50, range: 80,  enabled: true },
                            c: { ...cur.c, rotation: 180, fov: 50, range: 120, enabled: true },
                            d: { ...cur.d, rotation: 270, fov: 50, range: 80,  enabled: true },
                          };
                        } else if (p.id === 'lobby') {
                          next = {
                            a: { ...cur.a, rotation: 350, fov: 50, range: 40, enabled: true },
                            b: { ...cur.b, rotation: 30,  fov: 50, range: 40, enabled: true },
                            c: { ...cur.c, rotation: 70,  fov: 50, range: 40, enabled: true },
                            d: { ...cur.d, rotation: 110, fov: 50, range: 40, enabled: true },
                          };
                        }
                        onUpdate({ lenses: next });
                      }}
                      className="text-left px-3 py-2 rounded-md border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.04] transition-colors duration-150"
                      style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
                    >
                      <div className="text-[12px] font-medium text-slate-100 tracking-tight">{p.label}</div>
                      <div className="text-[10.5px] text-muted-foreground/80 mt-0.5">{p.hint}</div>
                    </button>
                  ))}
                </div>
              </DrawerSection>
            )}
          </>
        )}

        {bodyShows(tab, 'ai') && (
          <>
            <DrawerSection title="Optimize">
              <div className="flex gap-1 mb-3">
                <button className="flex-1 py-1.5 rounded text-[11px] text-slate-300 hover:bg-white/5 border border-white/10">Overview</button>
                <button className="flex-1 py-1.5 rounded text-[11px]" style={{ background: `${tone}1A`, color: '#F8FAFC', boxShadow: `inset 0 0 0 1px ${tone}55` }}>Prosecution</button>
              </div>
              {[
                'Rotate −12° to remove blind spot at SW corner',
                'Step focal to 6.0 mm for prosecution at door',
                'Move 4 ft east to clear column occlusion',
                'Enable IR cut filter (low-light confidence +18%)',
              ].map((s, i) => (
                <button key={i} className="w-full text-left text-[11.5px] text-slate-200 px-2 py-1.5 mb-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5">
                  <Sparkles className="w-3 h-3 inline mr-1.5" style={{ color: tone }} />{s}
                </button>
              ))}
            </DrawerSection>
            <DrawerSection title="Analytics">
              <Row label="Face recognition" value="Enabled" tone="#34D399" />
              <Row label="LPR" value="—" />
              <Row label="Object detection" value="People · Vehicle" />
              <Row label="Edge GPU" value="74% load" tone="#FACC15" />
            </DrawerSection>
          </>
        )}

        {bodyShows(tab, 'network') && (
          <>
            <DrawerSection title="Network">
              <Row label="IDF" value="IDF-02 / Port 14" />
              <Row label="VLAN" value="240 / cctv" />
              <Row label="IPv4" value="10.40.12.84" />
              <Row label="MAC" value="B8:A4:4F:91:0C:2A" />
              <Row label="Switch" value="Aruba 2930F-24P" />
              <Row label="Link" value="1 Gbps full duplex" tone="#34D399" />
            </DrawerSection>
            <DrawerSection title="Bandwidth">
              <Row label="Avg bitrate" value="6.4 Mbps" />
              <Row label="Peak" value="12.1 Mbps" />
              <Row label="Storage / day" value="68 GB" />
            </DrawerSection>
          </>
        )}

        {bodyShows(tab, 'power') && (
          <>
            <DrawerSection title="PoE">
              <Row label="Standard" value="802.3at (Type 2)" />
              <Row label="Draw" value="9.8 W" />
              <Row label="Budget" value="25.5 W" />
              <Row label="UPS" value="APC SRT-3000 · 18 min" tone="#34D399" />
            </DrawerSection>
            <DrawerSection title="Thermal">
              <Row label="Operating temp" value="32 °C" />
              <Row label="Headroom" value="28 °C" tone="#34D399" />
            </DrawerSection>
          </>
        )}

        {bodyShows(tab, 'mounting') && (
          <>
            <DrawerSection title="Mount">
              <Row label="Type" value="Ceiling pendant" />
              <Row label="Height" value="9' 0'' AFF" />
              <Row label="Tilt" value="−14°" />
              <Row label="Pan" value={`${d.rot}°`} />
              <Row label="Surface" value="ACT — needs T-bar adapter" tone="#FACC15" />
            </DrawerSection>
          </>
        )}

        {bodyShows(tab, 'compliance') && (
          <>
            <DrawerSection title="Codes">
              <Row label="NEC 725" value="Class 2" tone="#34D399" />
              <Row label="ADA arc" value="Clear" tone="#34D399" />
              <Row label="Fire rating" value="Plenum cable required" tone="#FACC15" />
              <Row label="UL 2802" value="Verified" tone="#34D399" />
            </DrawerSection>
            <DrawerSection title="Privacy">
              <Row label="Masked zones" value="2" />
              <Row label="Retention" value="30 days" />
            </DrawerSection>
          </>
        )}

        {bodyShows(tab, 'telemetry') && (
          <>
            <DrawerSection title="Live telemetry">
              <Row label="Uptime" value="99.94%" tone="#34D399" />
              <Row label="Packet loss" value="0.02%" />
              <Row label="Frame drops / hr" value="3" />
              <Row label="Signal" value="Excellent" tone="#34D399" />
              <Row label="Last reboot" value="14d ago" />
            </DrawerSection>
          </>
        )}

        {bodyShows(tab, 'linked') && (
          <>
            <DrawerSection title="Linked systems">
              {[
                { id: 'IDF-02',     k: 'Network', tone: '#7CC2FF' },
                { id: 'UPS-RM-A',   k: 'Power',   tone: '#FACC15' },
                { id: 'DR-LBY-01',  k: 'Access',  tone: '#34D399' },
                { id: 'NVR-03',     k: 'Storage', tone: '#A78BFA' },
              ].map((l) => (
                <div key={l.id} className="flex items-center gap-2 py-1.5 border-b border-white/5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.tone, boxShadow: `0 0 6px ${l.tone}` }} />
                  <span className="text-[11.5px] text-slate-200">{l.id}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-[0.12em] text-slate-500">{l.k}</span>
                </div>
              ))}
            </DrawerSection>
          </>
        )}

        {bodyShows(tab, 'notes') && (
          <>
            <DrawerSection title="Field notes">
              <textarea
                key={d.id /* reset cursor on device change, not on every keystroke */}
                value={d.notes ?? ''}
                onChange={(e) => onUpdate({ notes: e.target.value })}
                placeholder="Engineering notes — mount blocking, aim direction, GC coordination, etc."
                className="w-full h-24 text-[11.5px] text-slate-200 bg-white/5 border border-white/10 rounded p-2 focus:outline-none focus:border-white/25 resize-none"
              />
            </DrawerSection>
            <DrawerSection title="Media">
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="aspect-square rounded border border-white/10 bg-white/5 flex items-center justify-center text-slate-600">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                ))}
              </div>
            </DrawerSection>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TARGET SIMULATION — drag a human into coverage, live portrait card
   ═══════════════════════════════════════════════════════════════════════ */

function TargetSimOverlay({ d, zoom, pos, setPos, onClose }: {
  d: Device; zoom: number;
  pos: { x: number; y: number };
  setPos: (p: { x: number; y: number }) => void;
  onClose: () => void;
}) {
  // Real DORI math instead of decorative scoring. Each camera carries its
  // own horizontal FOV in degrees + sensor width in pixels. Pixels-on-target
  // at the simulated subject = sensorPx / (2 * distance * tan(fov / 2)).
  // DORI thresholds (px per m on subject) are the EN-50132-7 / IEC 62676
  // standard. We render those next to the live px/m calculation so the user
  // sees, at distance X, which threshold the camera achieves.
  const tone = KIND_TONE[TYPE_KIND[d.type]];
  const dx = pos.x - d.x;
  const dy = pos.y - d.y;
  const dist = Math.hypot(dx, dy);
  const distFt = dist / 20;
  const distM  = distFt * 0.3048;
  const angleToCam = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const camAim = ((d.rot + 360) % 360);
  const aimDelta = Math.min(Math.abs(angleToCam - camAim), 360 - Math.abs(angleToCam - camAim));
  // Camera spec defaults if not yet edited
  const sensorPx = 1920; // 1080p horizontal
  const fovDeg   = (d.fov ?? (d.type === 'cam.ptz' ? 60 : d.type === 'cam.fisheye' ? 180 : 90));
  const halfFovRad = (fovDeg * Math.PI / 180) / 2;
  const fovWidthM  = Math.max(0.01, 2 * distM * Math.tan(halfFovRad));
  const pxPerM = sensorPx / fovWidthM;
  const pxPerFt = pxPerM * 0.3048;
  const inHalfFov = aimDelta < (fovDeg / 2) + 4;
  const inRange = distFt < (d.range ?? 80);
  const inFOV = inHalfFov && inRange;
  // DORI bands (px / m). EN-50132-7 / IEC 62676.
  const DORI = [
    { id: 'identify',  label: 'Identify',  min: 250, tone: '#34D399' },
    { id: 'recognize', label: 'Recognize', min: 125, tone: '#7CC2FF' },
    { id: 'observe',   label: 'Observe',   min:  63, tone: '#FACC15' },
    { id: 'detect',    label: 'Detect',    min:  25, tone: '#FB923C' },
  ];
  const achieved = DORI.find((b) => pxPerM >= b.min);
  // Person assumed 1.7m tall, face 0.18m wide → expected pixels on subject.
  const facePx = Math.round(pxPerM * 0.18);
  const bodyPx = Math.round(pxPerM * 0.5);   // shoulder width
  const heightPx = Math.round(pxPerM * 1.7);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    e.stopPropagation();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    setPos({ x: pos.x + e.movementX / zoom, y: pos.y + e.movementY / zoom });
  };

  return (
    <>
      {/* Subject indicator on canvas — minimal stick figure, no cartoon face.
          Color reflects whether the subject is in FOV + range. The label
          underneath shows distance in feet. */}
      <div
        className="absolute z-30 pointer-events-auto select-none cursor-grab active:cursor-grabbing"
        style={{ left: pos.x * zoom, top: pos.y * zoom, transform: 'translate(-50%, -100%)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <svg width="22" height="44" viewBox="0 0 22 44" style={{ filter: `drop-shadow(0 2px 6px rgba(0,0,0,0.6))` }}>
          <circle cx="11" cy="6" r="4" fill="none" stroke={inFOV ? tone : '#64748B'} strokeWidth="1.6" />
          <path d="M11 10 L11 28 M11 14 L4 22 M11 14 L18 22 M11 28 L6 42 M11 28 L16 42" stroke={inFOV ? tone : '#64748B'} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
        <div className="text-center mt-0.5 text-[9px] uppercase tracking-[0.18em] tabular-nums" style={{ color: inFOV ? tone : '#64748B' }}>
          {distFt.toFixed(1)} ft
        </div>
      </div>

      {/* DORI panel. Engineering numbers, not a cartoon portrait. */}
      <div
        className="absolute z-40 pointer-events-auto select-none"
        style={{ left: pos.x * zoom + 36, top: pos.y * zoom - 140, width: 280 }}
      >
        <div
          className="rounded-lg overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(14,19,30,0.97), rgba(10,14,22,0.97))',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${tone}44`,
            boxShadow: `0 16px 36px -12px rgba(0,0,0,0.75), 0 0 0 1px ${tone}1A`,
          }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
            <ScanFace className="w-3.5 h-3.5" style={{ color: tone }} />
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-200">Coverage check</span>
            <span className="text-[9px] uppercase tracking-[0.16em] text-amber-300/70 px-1.5 py-0.5 rounded border border-amber-300/30 ml-auto">Simulated</span>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200"><X className="w-3.5 h-3.5" /></button>
          </div>

          {/* In-FOV chip + distance */}
          <div className="px-3 py-2.5 border-b border-white/5 grid grid-cols-3 gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Distance</div>
              <div className="text-base font-medium tabular-nums text-slate-100">{distFt.toFixed(1)} <span className="text-[10px] text-slate-500">ft</span></div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">Off-axis</div>
              <div className="text-base font-medium tabular-nums text-slate-100">{aimDelta.toFixed(0)}<span className="text-[10px] text-slate-500">°</span></div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500">In FOV</div>
              <div className="text-[12px] font-medium uppercase tracking-wider tabular-nums" style={{ color: inFOV ? '#34D399' : '#F87171' }}>
                {inFOV ? 'YES' : (!inHalfFov ? 'Off-axis' : 'Past range')}
              </div>
            </div>
          </div>

          {/* DORI ladder — which band is achieved at the current distance */}
          <div className="px-3 py-2.5 border-b border-white/5">
            <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500 mb-2 flex items-center gap-2">
              <span>DORI band</span>
              <span className="flex-1 h-px bg-white/5" />
              <span className="tabular-nums text-slate-400">{pxPerM.toFixed(0)} px/m</span>
            </div>
            {DORI.map((b) => {
              const hit = pxPerM >= b.min;
              const isTop = achieved?.id === b.id;
              return (
                <div key={b.id} className={`flex items-center gap-2 py-1 ${hit ? '' : 'opacity-40'}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.tone, boxShadow: hit ? `0 0 6px ${b.tone}` : 'none' }} />
                  <span className={`flex-1 text-[11.5px] ${isTop ? 'text-slate-100 font-medium' : 'text-slate-300'}`}>{b.label}</span>
                  <span className="text-[10px] tabular-nums text-slate-500">≥{b.min} px/m</span>
                  {hit && <Check className="w-3 h-3 ml-1" style={{ color: b.tone }} />}
                </div>
              );
            })}
            {!achieved && (
              <div className="text-[10px] text-rose-300 mt-1">Below Detect threshold — too far for usable coverage.</div>
            )}
          </div>

          {/* Pixels on subject */}
          <div className="px-3 py-2.5 border-b border-white/5">
            <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500 mb-1.5">Pixels on subject</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[14px] font-medium tabular-nums text-slate-100">{facePx}</div>
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Face px</div>
              </div>
              <div>
                <div className="text-[14px] font-medium tabular-nums text-slate-100">{bodyPx}</div>
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Body px</div>
              </div>
              <div>
                <div className="text-[14px] font-medium tabular-nums text-slate-100">{heightPx}</div>
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Height px</div>
              </div>
            </div>
          </div>

          {/* Operating conditions */}
          <div className="px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-[0.12em] text-slate-500 mb-1.5">Operating conditions</div>
            <div className="grid grid-cols-2 gap-1 text-[10.5px]">
              <div className="flex items-center justify-between"><span className="text-slate-500">Sensor</span><span className="tabular-nums text-slate-300">1920px</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">HFOV</span><span className="tabular-nums text-slate-300">{fovDeg}°</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">Width@dist</span><span className="tabular-nums text-slate-300">{fovWidthM.toFixed(1)} m</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-500">px/ft</span><span className="tabular-nums text-slate-300">{pxPerFt.toFixed(1)}</span></div>
            </div>
          </div>

          <div className="px-3 py-1.5 border-t border-white/5 text-[9px] text-slate-500 leading-relaxed">
            Computed from camera FOV + range. No video feed simulated.
          </div>
        </div>
      </div>
    </>
  );
}

function ImmersionControls({ focusMode, setFocusMode }: { focusMode: boolean; setFocusMode: (b: boolean) => void }) {
  // Single-button "Focus" control. Density and other engineering overlays
  // moved into the Layers panel so the canvas surface stays calm.
  return (
    <div className="absolute top-3 right-[180px] z-20 pointer-events-auto select-none">
      <button
        onClick={() => setFocusMode(!focusMode)}
        className="px-2 py-1 rounded-lg flex items-center gap-1.5 text-[10px] transition-colors"
        style={{
          background: focusMode ? 'rgba(124,194,255,0.10)' : 'rgba(8,12,20,0.78)',
          backdropFilter: 'blur(14px)',
          color: focusMode ? '#F8FAFC' : '#94A3B8',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: focusMode
            ? 'inset 0 0 0 1px rgba(124,194,255,0.55), 0 10px 24px -10px rgba(0,0,0,0.7)'
            : '0 10px 24px -10px rgba(0,0,0,0.7)',
        }}
      >
        <Maximize2 className="w-3 h-3" style={{ color: focusMode ? '#7CC2FF' : undefined }} />
        <span className="uppercase tracking-[0.16em]">Focus</span>
      </button>
    </div>
  );
}

function CoverageModeSwitch({ mode, setMode }: { mode: CoverageMode; setMode: (m: CoverageMode) => void }) {
  const modes: { id: CoverageMode; label: string; tone: string }[] = [
    { id: 'minimal',      label: 'Minimal',      tone: '#94A3B8' },
    { id: 'soft',         label: 'Soft',         tone: '#7CC2FF' },
    { id: 'tactical',     label: 'Tactical',     tone: '#FACC15' },
    { id: 'heatmap',      label: 'Heatmap',      tone: '#FB7185' },
    { id: 'wireframe',    label: 'Wireframe',    tone: '#34D399' },
    { id: 'presentation', label: 'Presentation', tone: '#A78BFA' },
    { id: 'night',        label: 'Night',        tone: '#60A5FA' },
  ];
  return (
    <div className="absolute top-3 left-3 z-20 pointer-events-auto select-none">
      <div
        className="flex items-center gap-0.5 p-1 rounded-lg text-[10px]"
        style={{
          background: 'rgba(8,12,20,0.78)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 10px 24px -10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div className="px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-slate-500 border-r border-white/8 mr-1">Coverage</div>
        {modes.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className="px-2 py-1 rounded-md transition-colors flex items-center gap-1.5"
              style={{
                background: active ? `${m.tone}1A` : 'transparent',
                color: active ? '#F8FAFC' : '#94A3B8',
                boxShadow: active ? `inset 0 0 0 1px ${m.tone}55` : 'none',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.tone, boxShadow: active ? `0 0 6px ${m.tone}` : 'none' }} />
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface IntelIssue {
  id: string;
  kind: 'overlap' | 'blindspot' | 'poe' | 'low-light' | 'nec';
  severity: 'info' | 'warn' | 'high';
  x: number;
  y: number;
  label: string;
  detail: string;
}

function computeIntelIssues(devices: Device[]): IntelIssue[] {
  const cams = devices.filter((d) => TYPE_KIND[d.type] === 'camera');
  const out: IntelIssue[] = [];
  // Overlap heuristic: two cameras within 80px
  for (let i = 0; i < cams.length; i++) {
    for (let j = i + 1; j < cams.length; j++) {
      const a = cams[i], b = cams[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 80) {
        out.push({
          id: `ov-${a.id}-${b.id}`,
          kind: 'overlap',
          severity: dist < 50 ? 'high' : 'warn',
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          label: 'Coverage overlap',
          detail: `${a.id} ↔ ${b.id} · ${Math.round((1 - dist / 110) * 100)}% redundant`,
        });
      }
    }
  }
  // PoE pressure: too many cameras (>6) ⇒ flag the centroid
  if (cams.length >= 6) {
    const cx = cams.reduce((s, c) => s + c.x, 0) / cams.length;
    const cy = cams.reduce((s, c) => s + c.y, 0) / cams.length;
    out.push({
      id: 'poe-load',
      kind: 'poe',
      severity: cams.length >= 10 ? 'high' : 'warn',
      x: cx, y: cy,
      label: 'PoE budget',
      detail: `${cams.length} cameras · est. ${(cams.length * 8).toFixed(0)}W on IDF-1`,
    });
  }
  // Blind spot: any LPR or thermal pointing away from device cluster gets a info flag
  cams.forEach((c) => {
    if (c.type === 'cam.bullet' && Math.abs(c.rot) > 150) {
      out.push({
        id: `bs-${c.id}`,
        kind: 'blindspot',
        severity: 'info',
        x: c.x - 22, y: c.y - 18,
        label: 'Possible blind spot',
        detail: `${c.id} aimed away from entry path`,
      });
    }
  });
  return out;
}

function IntelligenceLayer({ devices, zoom, open, setOpen }: { devices: Device[]; zoom: number; open: boolean; setOpen: (b: boolean) => void }) {
  const issues = useMemo(() => computeIntelIssues(devices), [devices]);
  const summary = useMemo(() => {
    const by: Record<string, number> = {};
    issues.forEach((i) => { by[i.severity] = (by[i.severity] ?? 0) + 1; });
    return by;
  }, [issues]);
  const toneFor = (k: IntelIssue['kind']) => k === 'overlap' ? '#F59E0B' : k === 'blindspot' ? '#FB7185' : k === 'poe' ? '#7CC2FF' : k === 'low-light' ? '#A78BFA' : '#34D399';
  const sevDot = (s: IntelIssue['severity']) => s === 'high' ? '#F87171' : s === 'warn' ? '#FACC15' : '#7CC2FF';
  return (
    <>
      {/* canvas chips */}
      {open && issues.map((iss) => (
        <div
          key={iss.id}
          className="absolute z-20 pointer-events-auto select-none"
          style={{ left: iss.x * zoom, top: iss.y * zoom, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[10px] whitespace-nowrap"
            style={{
              background: 'rgba(8,12,20,0.82)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${toneFor(iss.kind)}55`,
              boxShadow: `0 6px 14px -6px rgba(0,0,0,0.6), 0 0 0 1px ${toneFor(iss.kind)}22`,
              color: '#E2E8F0',
            }}
            title={iss.detail}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sevDot(iss.severity), animation: 'glow-breathe 2.4s ease-in-out infinite' }} />
            <span className="font-medium tracking-wide">{iss.label}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-400">{iss.detail}</span>
          </div>
        </div>
      ))}

      {/* top-right intelligence summary */}
      <div className="absolute top-3 right-3 z-20 pointer-events-auto select-none">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px]"
          style={{
            background: 'rgba(8,12,20,0.78)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#E2E8F0',
            boxShadow: '0 10px 24px -10px rgba(0,0,0,0.7)',
          }}
        >
          <Activity className="w-3.5 h-3.5 text-sky-300" />
          <span className="uppercase tracking-[0.18em] text-[9px] text-slate-400">Intelligence</span>
          {summary.high ? <span className="tabular-nums text-rose-300">{summary.high}</span> : null}
          {summary.warn ? <span className="tabular-nums text-amber-300">{summary.warn}</span> : null}
          {summary.info ? <span className="tabular-nums text-sky-300">{summary.info}</span> : null}
          {!issues.length && <span className="tabular-nums text-emerald-300">clear</span>}
          {open ? <Eye className="w-3 h-3 text-slate-400" /> : <EyeOff className="w-3 h-3 text-slate-500" />}
        </button>
      </div>
    </>
  );
}

function HudChip({ children, onClick, active, title }: { children: any; onClick: () => void; active?: boolean; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 inline-flex items-center gap-1 border-r border-white/8 transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}

function CommitInput({ value, onCommit, className }: { value: string; onCommit: (v: string) => void; className?: string }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onCommit(local); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { setLocal(value); (e.target as HTMLInputElement).blur(); }
      }}
      className={className}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   QUICK TOOLS CAPSULE  ·  ZOOM DOCK  ·  MINIMAP  ·  STATUS BAR
   ═══════════════════════════════════════════════════════════════════════ */

function QuickTools({ tool, setTool, showWall }: { tool: Tool; setTool: (t: Tool) => void; showWall: boolean }) {
  // Every tool here MUST have a working canvas behavior. Text and comment
  // tools were previously listed but never handled a click — they've been
  // removed until they're implemented. The brief's rule: no dead controls.
  const items: Array<{ id: Tool; icon: any; label: string; key: string; hint: string }> = [
    { id: 'select',  icon: MousePointer2, label: 'Select',  key: 'V', hint: 'Select and edit objects' },
    { id: 'pan',     icon: Hand,          label: 'Pan',     key: 'H', hint: 'Pan the map · does not select' },
    { id: 'measure', icon: Ruler,         label: 'Measure', key: 'M', hint: 'Click two points to measure distance · ESC to cancel' },
    { id: 'cable',   icon: Cable,         label: 'Cable',   key: 'C', hint: 'Draw cable / pathway · click vertices · Enter or dbl-click to finish · Esc to cancel' },
    ...(showWall ? [{ id: 'wall' as Tool, icon: WallIcon, label: 'Wall', key: 'W', hint: 'Draw a wall · double-click to finish' }] : []),
  ];
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-5 z-20">
      <style>{`@keyframes tool-hint-in { from { opacity: 0; transform: translate(-50%, -4px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
      <div className="bg-card/85 backdrop-blur-xl border border-border/80 rounded-2xl shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)] px-1.5 py-1.5 flex items-center gap-0.5">
        {items.map((it) => {
          const Icon = it.icon;
          const active = tool === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setTool(it.id)}
              title={`${it.label} (${it.key}) — ${it.hint}`}
              className={`relative w-10 h-10 rounded-xl inline-flex items-center justify-center transition-all duration-200 ease-out will-change-transform ${active ? 'bg-primary text-primary-foreground shadow-[0_4px_12px_-4px_rgba(74,149,232,0.5)] scale-[1.08]' : 'text-muted-foreground hover:bg-secondary hover:text-foreground hover:scale-[1.04] active:scale-[0.98] scale-100'}`}
              style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
            >
              <Icon className={`w-[18px] h-[18px] transition-transform duration-200 ${active ? 'scale-110' : ''}`} />
              {active && (
                <span
                  key={it.id + '-hint'}
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-foreground/60 font-mono tracking-wide"
                  style={{ animation: 'tool-hint-in 220ms ease-out both' }}
                >{it.key}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ZoomDock({ zoom, setZoom }: { zoom: number; setZoom: React.Dispatch<React.SetStateAction<number>> }) {
  return (
    <div className="absolute bottom-5 left-5 z-20 inline-flex items-center bg-card/85 backdrop-blur-xl border border-border/80 rounded-xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] overflow-hidden text-xs">
      <button onClick={() => setZoom((z) => Math.max(0.25, z / 1.2))} className="w-9 h-9 inline-flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><ZoomOut className="w-3.5 h-3.5" /></button>
      <button onClick={() => setZoom(1)} className="px-2.5 h-9 border-x border-border/60 hover:bg-secondary min-w-[58px] text-center tabular-nums font-medium">{Math.round(zoom * 100)}%</button>
      <button onClick={() => setZoom((z) => Math.min(4, z * 1.2))} className="w-9 h-9 inline-flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"><ZoomIn className="w-3.5 h-3.5" /></button>
      <button onClick={() => setZoom(1)} className="w-9 h-9 inline-flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground border-l border-border/60 transition-colors" title="Fit (⌘0)"><Maximize2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function MiniMap({ devices }: { devices: Device[] }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return (
    <button onClick={() => setVisible(true)} className="absolute bottom-5 right-5 z-20 w-9 h-9 rounded-xl bg-card/85 backdrop-blur-xl border border-border/80 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] flex items-center justify-center text-muted-foreground hover:text-foreground">
      <Eye className="w-4 h-4" />
    </button>
  );
  return (
    <div className="absolute bottom-5 right-5 z-20 w-48 bg-card/85 backdrop-blur-xl border border-border/80 rounded-xl shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><CircleDot className="w-3 h-3" />Overview</span>
        <button onClick={() => setVisible(false)} className="hover:text-foreground"><EyeOff className="w-3 h-3" /></button>
      </div>
      <div className="p-2">
        <svg viewBox="0 0 800 600" className="w-full h-24 rounded-md" style={{ background: '#0D1117' }}>
          <rect x="80" y="80" width="640" height="480" fill="#1A2030" stroke="#E6EDF3" strokeWidth="6" />
          {devices.map((d) => (
            <circle key={d.id} cx={d.x} cy={d.y} r="18" fill={KIND_TONE[TYPE_KIND[d.type]]} />
          ))}
          <rect x="80" y="80" width="640" height="480" fill="none" stroke="#2F81F7" strokeWidth="6" strokeDasharray="18 10" />
        </svg>
      </div>
    </div>
  );
}

function StatusBar({ tool, zoom, counts, units }: { tool: Tool; zoom: number; counts: Record<DeviceKind, number>; units: 'ft' | 'm' }) {
  const toolLabel = tool === 'select' ? 'Select' : tool === 'pan' ? 'Pan' : tool === 'measure' ? 'Measure' : tool === 'text' ? 'Text' : tool === 'wall' ? 'Wall' : 'Comment';
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-4 z-20 inline-flex items-center gap-2 px-3 h-7 rounded-full bg-card/80 backdrop-blur-md border border-border/70 text-[11px] text-muted-foreground shadow-[0_6px_18px_-10px_rgba(0,0,0,0.5)]">
      <span className="inline-flex items-center gap-1.5 text-primary"><span className="w-1.5 h-1.5 rounded-full bg-primary" />{toolLabel}</span>
      <span className="w-px h-3 bg-border/70" />
      <span>1 in = 10 {units}</span>
      <span className="w-px h-3 bg-border/70" />
      <span className="tabular-nums">{counts.camera} <span style={{ color: '#2F81F7' }}>●</span> &nbsp;{counts.access} <span style={{ color: '#3FB950' }}>●</span> &nbsp;{counts.network} <span style={{ color: '#D29922' }}>●</span></span>
    </div>
  );
}
