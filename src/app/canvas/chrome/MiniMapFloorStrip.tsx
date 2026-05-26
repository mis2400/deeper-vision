// MiniMapFloorStrip — extracted from screens/EngineeringCanvas.tsx.
// Vertical strip of floor pills next to the minimap. One small tile
// per floor, top to bottom ordered by level descending so the strip
// reads like a building elevation. Click any to make it active.

import { useMemo } from 'react';
import { useProjectStore } from '../../store/projectStore';

export interface MiniMapFloorStripProps {
  projectId: string;
  activeFloorId: string;
  onPickFloor: (floorId: string) => void;
}

export function MiniMapFloorStrip({ projectId, activeFloorId, onPickFloor }: MiniMapFloorStripProps) {
  const floorsMap = useProjectStore((s) => s.floors);
  const projectFloors = useMemo(() => Object.values(floorsMap)
    .filter((f) => f.projectId === projectId)
    .sort((a, b) => (b.level - a.level) || ((b.createdAt ?? 0) - (a.createdAt ?? 0))),
    [floorsMap, projectId],
  );
  const levelBadge = (level: number) => {
    if (level < 0) return `B${Math.abs(level)}`;
    if (level === 0) return 'G';
    return `L${level + 1}`;
  };
  return (
    <div
      className="absolute right-3 bottom-[68px] z-20 hidden md:flex flex-col gap-1 p-1.5 rounded-lg bg-card border border-border shadow-md"
      data-testid="minimap-floor-strip"
      data-canvas-chrome="floor-strip"
    >
      {projectFloors.map((f) => {
        const isActive = f.id === activeFloorId;
        return (
          <button
            key={f.id}
            onClick={() => onPickFloor(f.id)}
            title={f.name}
            aria-label={`Switch to ${f.name}`}
            className={`inline-flex items-center justify-center w-9 h-7 rounded text-[11px] font-medium tabular-nums transition-colors ${
              isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary/40'
            }`}
            data-track="minimap-floor-pick"
          >
            {levelBadge(f.level)}
          </button>
        );
      })}
    </div>
  );
}

export default MiniMapFloorStrip;
