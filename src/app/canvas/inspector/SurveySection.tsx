// SurveySection — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. Tiny inspector adapter
// that detects whether the selected device is a door (any
// inf.door / inf.gate / inf.storefront / inf.doubledoor type)
// or a regular device, then hands the surveyStatus state to
// the shared SurveyPanel via the objectType field. Pure
// presentational — device + onUpdate via props.
//
// SurveyPanel + the underlying surveyItems store slice are
// shared with the PathwayDrawer's Notes block, so this
// surface and that one keep the same persistence behaviour.

import { SurveyPanel } from '../components/SurveyPanel';
import type { Device } from '../types';

export function SurveySection({
  device, onUpdate,
}: { device: Device; onUpdate: (p: Partial<Device>) => void }) {
  const objectType: 'device' | 'door' =
    ((device.type as string).startsWith('inf.door')
      || (device.type as string).startsWith('inf.gate')
      || (device.type as string).startsWith('inf.storefront')
      || (device.type as string).startsWith('inf.doubledoor'))
      ? 'door' : 'device';
  return (
    <SurveyPanel
      projectId={(device as any).projectId}
      floorId={(device as any).floorId}
      objectType={objectType}
      objectId={device.id}
      deviceStatus={device.surveyStatus}
      onDeviceStatusChange={(s) => onUpdate({ surveyStatus: s })}
    />
  );
}
