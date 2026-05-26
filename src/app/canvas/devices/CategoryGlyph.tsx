// CategoryGlyph + KIND_ICON — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup.
//
// Tiny chip used in dock category headers, layer rows, and a few panel
// breadcrumbs. Picks one lucide icon per DeviceKind and renders it at
// 14 px with a heavier stroke so the icon reads at chrome scale.
//
// Pure module — no closures on EngineeringCanvas state.

import {
  Video, ScanFace, Cable, Radar, Volume2, HardDrive, Monitor,
  BatteryCharging, Thermometer, DoorOpen, ShieldCheck, Flame, Server,
} from 'lucide-react';
import type { DeviceKind } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const KIND_ICON: Record<DeviceKind, any> = {
  camera: Video, access: ScanFace, network: Cable, intrusion: Radar,
  audio: Volume2, storage: HardDrive, display: Monitor, power: BatteryCharging, sensor: Thermometer,
  infrastructure: DoorOpen, cyber: ShieldCheck, fire: Flame, building: Server,
};

export function CategoryGlyph({ kind, active: _active }: { kind: DeviceKind; active?: boolean }) {
  const Icon = KIND_ICON[kind];
  return <Icon style={{ width: 14, height: 14 }} strokeWidth={2} />;
}

export default CategoryGlyph;
