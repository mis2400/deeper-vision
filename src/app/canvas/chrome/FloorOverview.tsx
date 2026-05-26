// FloorOverview — extracted from screens/EngineeringCanvas.tsx as
// part of the M11 monolith breakup. Full-canvas overlay that
// renders a grid of floor-thumbnail tiles for the active project,
// each showing the floor name, a level badge, device count, and a
// shrunk SVG preview of the plan + device positions. Clicking a
// tile picks that floor; Esc closes.

import { X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useProjectStore } from '../../store/projectStore';

export function FloorOverview({ projectId, onPickFloor, onClose }: {
  projectId: string;
  onPickFloor: (floorId: string) => void;
  onClose: () => void;
}) {
  const floorsMap = useProjectStore((s) => s.floors);
  const devicesMap = useProjectStore((s) => s.devices);
  const projectFloors = useMemo(() => Object.values(floorsMap)
    .filter((f) => f.projectId === projectId)
    .sort((a, b) => (b.level - a.level) || ((b.createdAt ?? 0) - (a.createdAt ?? 0))),
    [floorsMap, projectId],
  );
  const devicesByFloor = useMemo(() => {
    const out: Record<string, any[]> = {};
    for (const d of Object.values(devicesMap) as any[]) {
      if (!out[d.floorId]) out[d.floorId] = [];
      out[d.floorId].push(d);
    }
    return out;
  }, [devicesMap]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const levelBadge = (level: number) => {
    if (level < 0) return `B${Math.abs(level)}`;
    if (level === 0) return 'G';
    return `L${level + 1}`;
  };

  return (
    <div className="absolute inset-0 z-30 bg-background overflow-auto">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-md px-5 py-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">All floors</div>
          <div className="text-[11px] text-muted-foreground">{projectFloors.length} floors · click any tile to open</div>
        </div>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] border border-border hover:bg-secondary/40"
          data-track="canvas-overview-close"
        >
          <X className="w-3.5 h-3.5" />
          Exit overview
        </button>
      </div>
      <div className="p-5 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {projectFloors.map((f) => {
          const devices = devicesByFloor[f.id] ?? [];
          const tileBg = f.background;
          // Tile viewport: 320x224 (~4:3-ish). Compute scale so the
          // floor's content (background or implicit 800x600) fits.
          const tileW = 320;
          const tileH = 224;
          const contentW = tileBg?.naturalWidth ?? 800;
          const contentH = tileBg?.naturalHeight ?? 600;
          return (
            <button
              key={f.id}
              onClick={() => onPickFloor(f.id)}
              className="text-left border border-border rounded-xl overflow-hidden hover:border-primary/60 transition-colors bg-card group"
              data-track="canvas-overview-pick"
            >
              <div className="px-3 py-2 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] tabular-nums text-muted-foreground bg-secondary/60 rounded px-1.5 py-0.5 flex-none">{levelBadge(f.level)}</span>
                  <span className="text-sm truncate">{f.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums">{devices.length} {devices.length === 1 ? 'device' : 'devices'}</span>
              </div>
              <div className="relative bg-canvas-background" style={{ width: tileW, height: tileH, margin: '0 auto' }}>
                <svg
                  viewBox={`0 0 ${contentW} ${contentH}`}
                  preserveAspectRatio="xMidYMid meet"
                  className="absolute inset-0 w-full h-full"
                >
                  {tileBg && (
                    <image href={tileBg.dataUrl} x={0} y={0} width={contentW} height={contentH} opacity={tileBg.opacity ?? 1} preserveAspectRatio="xMidYMid meet" />
                  )}
                  {!tileBg && (
                    <g stroke="currentColor" opacity="0.08">
                      {[...Array(8)].map((_, i) => (
                        <line key={`v${i}`} x1={(i + 1) * (contentW / 9)} y1={0} x2={(i + 1) * (contentW / 9)} y2={contentH} strokeWidth="1" />
                      ))}
                      {[...Array(6)].map((_, i) => (
                        <line key={`h${i}`} x1={0} y1={(i + 1) * (contentH / 7)} x2={contentW} y2={(i + 1) * (contentH / 7)} strokeWidth="1" />
                      ))}
                    </g>
                  )}
                  {/* Device dots — small tinted markers; no glyphs at thumbnail scale. */}
                  {devices.map((d: any) => (
                    <circle key={d.id} cx={d.x} cy={d.y} r={Math.max(6, contentW / 60)} fill="var(--primary)" fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
                  ))}
                </svg>
              </div>
              <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border flex items-center justify-between">
                <span>
                  {f.background?.fileName ? `Plan · ${f.background.fileName}` : 'Blank'}
                  {f.calibratedAt && ' · verified scale'}
                </span>
                <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">Open →</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
