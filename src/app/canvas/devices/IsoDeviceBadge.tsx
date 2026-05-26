// IsoDeviceBadge — extracted from screens/EngineeringCanvas.tsx as
// part of the M11 monolith breakup. Isometric-style device chip with
// a colored ring around a lucide icon and a small label badge below.
// Used in InsertDock cards, layer rows, drag ghosts, etc. Pure
// presentational with no internal state.
//
// DEVICE_ICON moves with IsoDeviceBadge because that was the only
// consumer in the monolith.

import {
  Video, Aperture, ScanEye, Disc, Flame, ScanFace, KeyRound, DoorOpen,
  Wifi, Server, Cable, Grid3x3, Car, UserSquare2, Fingerprint, GitBranch,
  Phone, Radar, AlertTriangle, BellRing, Vibrate, Hash, ShieldCheck,
  Antenna, Volume2, Megaphone, Mic, Speaker, HardDrive, Database, Cloud,
  Monitor, Tv2, AppWindow, MonitorSmartphone, BatteryCharging, Zap,
  ShieldAlert, Sun, Thermometer, CloudFog, Droplets, Users2, Wind,
  Crosshair as CrosshairIcon, BarChart3, Lock, Minus as WallIcon,
} from 'lucide-react';
import type { Device, DeviceType } from '../types';
import { deviceTone } from '../utils';

// Lucide icon used to render the device at small chip / chrome sizes.
// The canvas itself uses SurveyorSymbol via HardwareGlyph for richer
// schematic-plan symbols; this table is for the chrome / palette /
// drag-ghost / inspector row contexts that don't need plan-level
// fidelity.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DEVICE_ICON: Record<DeviceType, any> = {
  'cam.bullet': Video, 'cam.dome': Aperture, 'cam.ptz': ScanEye, 'cam.multisensor': Grid3x3,
  'cam.fisheye': Disc, 'cam.thermal': Flame, 'cam.lpr': Car, 'cam.body': UserSquare2,
  'acc.reader': ScanFace, 'acc.biometric': Fingerprint, 'acc.strike': KeyRound, 'acc.maglock': Lock,
  'acc.exit': DoorOpen, 'acc.turnstile': GitBranch, 'acc.intercom': Phone, 'acc.panic-bar': KeyRound, 'acc.dps': DoorOpen,
  'int.motion': Radar, 'int.glassbreak': AlertTriangle, 'int.contact': DoorOpen, 'int.panic': BellRing,
  'int.vibration': Vibrate, 'int.keypad': Hash,
  'net.switch': Cable, 'net.idf': Server, 'net.ap': Wifi, 'net.firewall': ShieldCheck, 'net.bridge': Antenna,
  'aud.speaker': Volume2, 'aud.horn': Megaphone, 'aud.amp': Speaker, 'aud.mic': Mic, 'aud.intercom': Phone,
  'sto.nvr': HardDrive, 'sto.server': Server, 'sto.archive': Database, 'sto.cloud': Cloud,
  'dis.monitor': Monitor, 'dis.wall': Tv2, 'dis.kiosk': AppWindow, 'dis.signage': MonitorSmartphone,
  'pwr.ups': BatteryCharging, 'pwr.poe': Zap, 'pwr.surge': ShieldAlert, 'pwr.solar': Sun,
  'sen.temp': Thermometer, 'sen.smoke': CloudFog, 'sen.water': Droplets, 'sen.occupancy': Users2,
  'sen.gas': Wind, 'sen.gunshot': CrosshairIcon,
  'inf.door-single': DoorOpen, 'inf.door-double': DoorOpen,
  'inf.door-storefront': DoorOpen, 'inf.door-sliding': DoorOpen,
  'inf.window': AppWindow, 'inf.wall-brick': WallIcon, 'inf.wall-fire': Flame, 'inf.wall-concrete': WallIcon,
  'inf.gate-swing': GitBranch, 'inf.gate-slide': GitBranch, 'inf.elevator': Server,
  'inf.mdf': Server, 'inf.rack': Server,
  'cyb.endpoint': ShieldCheck, 'cyb.siem': BarChart3, 'cyb.firewall-ng': ShieldCheck, 'cyb.vpn': Lock,
  'fls.pull-station': BellRing, 'fls.fire-panel': AlertTriangle, 'fls.strobe': Sun, 'fls.sprinkler': Droplets,
  'bld.hvac-controller': Wind, 'bld.lighting-panel': Sun, 'bld.bms-gateway': Server,
};

export function IsoDeviceBadge({ d }: { d: Device }) {
  const tone = deviceTone(d);
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

export default IsoDeviceBadge;
