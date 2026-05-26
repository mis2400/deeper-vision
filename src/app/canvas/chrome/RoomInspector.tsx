// RoomInspector — extracted from screens/EngineeringCanvas.tsx as
// part of the M11 monolith breakup. Small chrome panel pinned
// top-right that lets the operator name a room, describe it,
// estimate occupancy, set a sensitivity tier, and read the
// computed area. Pure presentational — the parent owns the
// active Room and feeds it through onPatch + onDelete + onClose.

import { Trash2, X } from 'lucide-react';
import { useMemo } from 'react';
import type { Room } from '../../store/types';

export function RoomInspector({ room, pxToFt, onPatch, onDelete, onClose }: {
  room: Room;
  pxToFt: number;
  onPatch: (patch: Partial<Room>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  // Shoelace area in square feet, using the active floor's scale.
  const areaFt2 = useMemo(() => {
    if (!room.polygon || room.polygon.length < 3 || pxToFt <= 0) return 0;
    let sum = 0;
    for (let i = 0; i < room.polygon.length; i += 1) {
      const a = room.polygon[i];
      const b = room.polygon[(i + 1) % room.polygon.length];
      sum += a.x * b.y - b.x * a.y;
    }
    const px2 = Math.abs(sum) / 2;
    return px2 * pxToFt * pxToFt;
  }, [room.polygon, pxToFt]);
  return (
    <div className="absolute top-16 right-3 z-30 w-[280px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-md p-3 text-[12px]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Room</div>
        <button onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground"><X className="w-3 h-3" /></button>
      </div>
      <input
        value={room.name}
        onChange={(e) => onPatch({ name: e.target.value })}
        className="w-full bg-input-background border border-input-border rounded px-2 py-1.5 text-sm mb-2 focus:outline-none focus:border-primary"
        placeholder="Room name"
      />
      <textarea
        value={room.description ?? ''}
        onChange={(e) => onPatch({ description: e.target.value })}
        rows={2}
        className="w-full bg-input-background border border-input-border rounded px-2 py-1.5 text-[12px] mb-2 resize-none focus:outline-none focus:border-primary"
        placeholder="Description (optional)"
      />
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[11px] text-muted-foreground flex-none w-20">Occupancy</label>
        <input
          type="number"
          min={0}
          value={room.occupancyEstimate ?? ''}
          onChange={(e) => onPatch({ occupancyEstimate: e.target.value ? Number(e.target.value) : undefined })}
          className="flex-1 bg-input-background border border-input-border rounded px-2 py-1 text-[12px] focus:outline-none focus:border-primary"
          placeholder="—"
        />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-[11px] text-muted-foreground flex-none w-20">Sensitivity</label>
        <select
          value={room.sensitivity ?? 'low'}
          onChange={(e) => onPatch({ sensitivity: e.target.value as any })}
          className="flex-1 bg-input-background border border-input-border rounded px-2 py-1 text-[12px] focus:outline-none focus:border-primary"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-2 mb-2 text-[11px]">
        <span className="text-muted-foreground">Area</span>
        <span className="tabular-nums">{areaFt2 > 0 ? `${Math.round(areaFt2).toLocaleString()} ft²` : '—'}</span>
      </div>
      <button
        onClick={onDelete}
        className="w-full inline-flex items-center justify-center gap-1.5 h-7 rounded text-[11px] text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="w-3 h-3" />Remove room
      </button>
    </div>
  );
}
