// FloorplanBackgroundControls + SliderInline — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Compact top-left floater over an imported floor plan
// background that lets the engineer dial in the import's
// position, scale, rotation, opacity, and quick fit / 90° turns,
// or remove it outright. SliderInline is a private helper for
// the three numeric rows; only this component composes them.
// Pure presentational — every change rides through onPatch /
// onRemove props to the store-aware parent.

import { ImageIcon, Lock, Maximize2, RotateCcw, RotateCw, Unlock, X } from 'lucide-react';
import type { FloorBackground } from '../../store/types';

export function FloorplanBackgroundControls({
  bg, onPatch, onRemove,
}: {
  bg: NonNullable<FloorBackground>;
  onPatch: (patch: Partial<FloorBackground>) => void;
  onRemove: () => void;
}) {
  // Floats top-left of the canvas. Stays compact so it doesn't block the
  // imported plan beneath it. Each slider writes through to the store so
  // changes survive refresh and propagate to the popped-out window.
  return (
    <div
      className="absolute top-16 left-3 z-20 select-none w-[240px]"
      style={{
        background: 'rgba(13,20,36,0.86)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '8px',
        boxShadow: '0 12px 28px -12px rgba(0,0,0,0.55)',
      }}
    >
      <div className="px-3 py-2 border-b border-white/8 flex items-center gap-2">
        <ImageIcon className="w-3.5 h-3.5 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium tracking-tight text-foreground truncate" title={bg.fileName}>
            {bg.fileName}
          </div>
          <div className="text-[9.5px] text-muted-foreground uppercase tracking-wider mt-0.5">
            {bg.origin === 'visionscan' ? 'VisionScan' : bg.origin.toUpperCase()} · {bg.naturalWidth}×{bg.naturalHeight}
          </div>
        </div>
        <button
          onClick={() => onPatch({ locked: !bg.locked })}
          title={bg.locked ? 'Locked' : 'Unlocked'}
          className="text-muted-foreground hover:text-foreground"
        >
          {bg.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onRemove}
          title="Remove background"
          className="text-muted-foreground hover:text-rose-300"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-3 py-2.5 space-y-2.5">
        {/* Quick actions row — the four most common operations as one-tap
            buttons, so users don't have to scrub a slider for 90° rotations
            or to re-centre after a misclick. */}
        <div className="flex items-center gap-1" data-testid="floorplan-quick-actions">
          <button
            onClick={() => onPatch({ rotation: ((bg.rotation - 90) % 360 + 360) % 360 - (bg.rotation - 90 > 180 ? 360 : 0) })}
            title="Rotate 90° left"
            data-testid="floorplan-rotate-left"
            className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5 text-muted-foreground hover:text-foreground text-[10px]"
          >
            <RotateCcw className="w-3 h-3" /> 90°
          </button>
          <button
            onClick={() => onPatch({ rotation: ((bg.rotation + 90) % 360 + 360) % 360 - ((bg.rotation + 90) % 360 > 180 ? 360 : 0) })}
            title="Rotate 90° right"
            data-testid="floorplan-rotate-right"
            className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5 text-muted-foreground hover:text-foreground text-[10px]"
          >
            <RotateCw className="w-3 h-3" /> 90°
          </button>
          <button
            onClick={() => onPatch({ x: 0, y: 0, scale: 1 })}
            title="Re-centre and fit at 100% scale"
            data-testid="floorplan-fit"
            className="flex-1 h-7 inline-flex items-center justify-center gap-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5 text-muted-foreground hover:text-foreground text-[10px]"
          >
            <Maximize2 className="w-3 h-3" /> Fit
          </button>
        </div>
        <SliderInline
          label="Opacity"
          value={Math.round(bg.opacity * 100)}
          min={5} max={100} step={1} unit="%"
          onChange={(v) => onPatch({ opacity: v / 100 })}
        />
        <SliderInline
          label="Scale"
          value={Math.round(bg.scale * 100)}
          min={10} max={400} step={1} unit="%"
          onChange={(v) => onPatch({ scale: v / 100 })}
        />
        <SliderInline
          label="Rotation"
          value={bg.rotation}
          min={-180} max={180} step={1} unit="°"
          onChange={(v) => onPatch({ rotation: v })}
        />
        <div className="flex items-center gap-1.5 pt-1">
          <button
            onClick={() => onPatch({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.85 })}
            data-testid="floorplan-reset"
            className="flex-1 text-[10px] py-1 rounded border border-white/10 hover:border-white/25 hover:bg-white/5 text-muted-foreground"
          >
            Reset transform
          </button>
        </div>
        <div className="text-[9.5px] text-muted-foreground leading-snug pt-1 border-t border-white/8">
          Click <span className="text-foreground">Set scale</span> on the scale bar to convert pixels into real-world feet.
        </div>
      </div>
    </div>
  );
}

function SliderInline({ label, value, min, max, step = 1, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-[11px] tabular-nums font-medium text-foreground">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: '#5292DC' }}
      />
    </div>
  );
}
