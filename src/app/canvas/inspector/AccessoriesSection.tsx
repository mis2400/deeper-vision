// AccessoriesSection — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Lists compatible mounts / junction boxes for a
// camera type, lets the engineer toggle each on/off. Selection
// persists on the device's `accessories[]` and rolls up into
// the BOM. Pure presentational — selected ids + onToggle via
// props. Pulls ACCESSORIES + accessoriesForCameraType from
// canvas/catalog.

import { Check } from 'lucide-react';
import { ACCESSORIES, accessoriesForCameraType } from '../catalog';
import { DrawerSection } from '../components/DrawerPrimitives';
import type { DeviceType } from '../types';

export function AccessoriesSection({ cameraType, selected, onToggle }: {
  cameraType: DeviceType;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const options = accessoriesForCameraType(cameraType);
  if (options.length === 0) return null;
  const totalAdded = selected.reduce((sum, id) => sum + (ACCESSORIES.find((a) => a.id === id)?.msrp ?? 0), 0);
  return (
    <DrawerSection title="Compatible accessories">
      <div className="space-y-1">
        {options.map((a) => {
          const isOn = selected.includes(a.id);
          return (
            <button
              key={a.id}
              onClick={() => onToggle(a.id)}
              className={`w-full text-left px-2.5 py-2 rounded-md border transition-colors flex items-center gap-2.5 ${
                isOn ? 'border-primary/40 bg-primary/8' : 'border-white/10 hover:border-white/25 hover:bg-white/5'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-sm shrink-0 flex items-center justify-center ${isOn ? 'bg-primary' : 'border border-white/30'}`}
              >
                {isOn && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-foreground truncate">
                  {a.mfr} · {a.model}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{a.kind.replace('-', ' ')}</div>
              </div>
              <span className="text-[11px] tabular-nums text-muted-foreground">${a.msrp ?? '—'}</span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">{selected.length} added · rolls up into BOM</span>
          <span className="tabular-nums text-foreground font-medium">+${totalAdded}</span>
        </div>
      )}
    </DrawerSection>
  );
}
