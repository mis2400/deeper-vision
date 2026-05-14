// Compatibility rule engine for the engineering canvas.
//
// Models which device types can be hosted by which assemblies. Doors host
// readers / strikes / maglocks / REX / contacts / intercoms / biometric
// readers / crash bars. IDFs / MDFs host switches / UPS / PoE injectors /
// firewalls. Pathways carry cables. Cameras live on the floorplan, mounted
// to walls or ceilings — they can't be attached to a door assembly.
//
// This is intentionally a small, pure module so it can drive both static
// validation (the drawer's hardware picker) and interactive validation
// (drop-onto-host on the canvas). The latter is wired in a later pass;
// this module is the substrate.

import type { DeviceType, DoorHardware } from '../store/types';

/** What a particular host (door / idf / pathway / floor) can accept. */
export interface HostKind {
  /** A host this candidate device type can mount onto. */
  kind: 'door' | 'idf' | 'pathway' | 'floor' | 'wall' | 'ceiling' | 'exterior' | 'pole';
}

export interface CompatResult {
  allowed: boolean;
  /** Short, user-facing reason. Empty when allowed. */
  reason?: string;
  /** Where the user should put this device instead. */
  hint?: string;
  /** Optional follow-up requirement (e.g. maglock requires REX). */
  requires?: string;
}

const ok: CompatResult = { allowed: true };

// ─── Host-specific predicates ─────────────────────────────────────

/** Hardware types a door assembly can host. */
const DOOR_HARDWARE: ReadonlySet<DoorHardware> = new Set<DoorHardware>([
  'reader', 'strike', 'maglock', 'rex', 'contact',
  'intercom', 'panic', 'autoop', 'controller', 'psu',
]);

/** Device types that map to a piece of door hardware. */
const DEVICE_TO_DOOR_HW: Record<string, DoorHardware> = {
  'acc.reader':    'reader',
  'acc.strike':    'strike',
  'acc.maglock':   'maglock',
  'acc.rex':       'rex',
  'acc.exit':      'panic',      // crash bar / exit device
  'acc.biometric': 'reader',
  'aud.intercom':  'intercom',
  'sen.contact':   'contact',
  'sen.panic':     'panic',
};

/** Devices that belong inside an IDF / MDF / network cabinet. */
const IDF_HOSTED: ReadonlySet<DeviceType> = new Set<DeviceType>([
  'net.switch', 'net.firewall', 'net.bridge', 'pwr.ups',
  'pwr.poe', 'pwr.surge', 'sto.nvr', 'sto.server',
]);

/** Cameras and sensors live on the floorplan, not on doors. */
const FLOORPLAN_DEVICES: ReadonlySet<string> = new Set<string>([
  'cam.bullet', 'cam.dome', 'cam.ptz', 'cam.multisensor', 'cam.fisheye',
  'cam.thermal', 'cam.lpr', 'cam.body',
  'sen.motion', 'sen.glass', 'sen.smoke',
  'aud.speaker', 'aud.horn', 'aud.amp',
  'dis.monitor', 'dis.video-wall', 'dis.kiosk',
]);

/** Given a host device's type and a candidate device's type, return whether
 *  the candidate can be attached. Host can be a door assembly type, an IDF,
 *  or 'floor' / 'wall' / 'ceiling' for "place on the map". */
export function canHost(hostType: DeviceType | 'door' | 'idf' | 'floor', candidateType: DeviceType): CompatResult {
  // Door assemblies
  if (hostType === 'door' || hostType === 'acc.door' || hostType === 'acc.gate' || hostType === 'acc.exit') {
    const isCamera = FLOORPLAN_DEVICES.has(candidateType) && candidateType.startsWith('cam');
    if (isCamera) {
      return {
        allowed: false,
        reason: 'Cameras cannot be added to a door assembly.',
        hint: 'Place this camera on the floorplan, then mount it to a wall or ceiling near the door.',
      };
    }
    if (FLOORPLAN_DEVICES.has(candidateType)) {
      return {
        allowed: false,
        reason: `${labelFor(candidateType)} is a floorplan device.`,
        hint: 'Drop it on the floorplan instead.',
      };
    }
    if (IDF_HOSTED.has(candidateType)) {
      return {
        allowed: false,
        reason: `${labelFor(candidateType)} belongs in an IDF / rack.`,
        hint: 'Drop it into an IDF or MDF assembly.',
      };
    }
    const hw = DEVICE_TO_DOOR_HW[candidateType as keyof typeof DEVICE_TO_DOOR_HW];
    if (!hw) {
      return {
        allowed: false,
        reason: `${labelFor(candidateType)} is not door hardware.`,
        hint: 'Cards and intercoms attach to a door; PA and AV go on walls / ceilings.',
      };
    }
    // Maglock requires a REX for code-compliant fire egress.
    if (candidateType === 'acc.maglock') {
      return { ...ok, requires: 'A REX (request-to-exit) is required when using a maglock for fire-egress compliance.' };
    }
    return ok;
  }

  // IDF / MDF / network cabinet
  if (hostType === 'idf' || hostType === 'net.idf' || hostType === 'net.mdf') {
    if (IDF_HOSTED.has(candidateType)) return ok;
    if (FLOORPLAN_DEVICES.has(candidateType)) {
      return {
        allowed: false,
        reason: `${labelFor(candidateType)} doesn't live in a network rack.`,
        hint: 'Place this on the floorplan.',
      };
    }
    if (DEVICE_TO_DOOR_HW[candidateType as keyof typeof DEVICE_TO_DOOR_HW]) {
      return {
        allowed: false,
        reason: `${labelFor(candidateType)} is door hardware.`,
        hint: 'Drop it onto a door assembly.',
      };
    }
    return {
      allowed: false,
      reason: `${labelFor(candidateType)} doesn't belong inside an IDF.`,
    };
  }

  // Floorplan (the canvas surface itself) — almost anything is fine except
  // pure-hardware bits that need a host (strike, rex, maglock, contact).
  if (hostType === 'floor') {
    if (candidateType === 'acc.strike' || candidateType === 'acc.maglock' || candidateType === 'acc.rex') {
      return {
        allowed: false,
        reason: `${labelFor(candidateType)} attaches to a door, not the floor.`,
        hint: 'Drop it onto a door assembly.',
      };
    }
    if (IDF_HOSTED.has(candidateType) && (candidateType === 'net.switch' || candidateType === 'pwr.ups')) {
      return {
        allowed: true,
        requires: `${labelFor(candidateType)} typically lives inside an IDF — consider creating one and attaching.`,
      };
    }
    return ok;
  }

  return ok;
}

/** Is this device type a piece of door hardware? Used by the drawer's
 *  hardware picker to filter the catalog. */
export function isDoorHardware(t: DeviceType): boolean {
  return DEVICE_TO_DOOR_HW[t as keyof typeof DEVICE_TO_DOOR_HW] != null;
}

/** Mounting locations a candidate can reasonably take. Used by the
 *  Placement tab in the edit drawer (deferred to next pass) and by the
 *  AI assistant when suggesting placement. */
export function validMounts(t: DeviceType): HostKind['kind'][] {
  if (t.startsWith('cam')) {
    if (t === 'cam.ptz' || t === 'cam.bullet' || t === 'cam.thermal' || t === 'cam.lpr') {
      return ['wall', 'pole', 'exterior'];
    }
    if (t === 'cam.fisheye' || t === 'cam.multisensor' || t === 'cam.dome') {
      return ['ceiling', 'wall'];
    }
    return ['wall', 'ceiling'];
  }
  if (t === 'acc.reader' || t === 'acc.biometric' || t === 'aud.intercom') return ['door', 'wall'];
  if (t === 'acc.strike' || t === 'acc.maglock' || t === 'acc.rex' || t === 'acc.exit' || t === 'sen.contact') return ['door'];
  if (t === 'net.switch' || t === 'net.firewall' || t === 'pwr.ups') return ['idf'];
  if (t === 'aud.speaker' || t === 'aud.horn' || t === 'sen.motion' || t === 'sen.smoke') return ['ceiling', 'wall'];
  return ['wall', 'ceiling', 'floor'];
}

function labelFor(t: string): string {
  return ({
    'cam.bullet':      'Bullet camera',
    'cam.dome':        'Dome camera',
    'cam.ptz':         'PTZ camera',
    'cam.multisensor': 'Multisensor camera',
    'cam.fisheye':     'Fisheye camera',
    'cam.thermal':     'Thermal camera',
    'cam.lpr':         'LPR camera',
    'acc.reader':      'Reader',
    'acc.strike':      'Electric strike',
    'acc.maglock':     'Maglock',
    'acc.rex':         'REX sensor',
    'acc.exit':        'Exit device',
    'acc.biometric':   'Biometric reader',
    'aud.intercom':    'Intercom',
    'aud.speaker':     'Speaker',
    'aud.horn':        'IP horn',
    'sen.contact':     'Door contact',
    'sen.motion':      'Motion sensor',
    'sen.glass':       'Glass-break sensor',
    'sen.smoke':       'Smoke detector',
    'net.switch':      'PoE switch',
    'net.firewall':    'Firewall',
    'pwr.ups':         'UPS',
  } as Record<string, string>)[t] ?? t;
}
