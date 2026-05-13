import { Eye, EyeOff } from 'lucide-react';

export type CoverageMode =
  | 'minimal'
  | 'wireframe'
  | 'soft'
  | 'tactical'
  | 'heatmap'
  | 'conflict'
  | 'lowlight'
  | 'ir'
  | 'presentation'
  | 'compliance';

interface Props {
  mode: CoverageMode;
  onMode: (m: CoverageMode) => void;
  opacity: number;
  onOpacity: (n: number) => void;
  selectedOnly: boolean;
  onSelectedOnly: (b: boolean) => void;
}

const MODES: { k: CoverageMode; label: string; hint: string }[] = [
  { k: 'minimal',      label: 'Minimal',      hint: 'Edges only' },
  { k: 'wireframe',    label: 'Wireframe',    hint: 'Vector outline' },
  { k: 'soft',         label: 'Soft',         hint: 'Diffuse gradient' },
  { k: 'tactical',     label: 'Tactical',     hint: 'Mission overlay' },
  { k: 'heatmap',      label: 'Heatmap',      hint: 'Density map' },
  { k: 'conflict',     label: 'Conflict',     hint: 'Overlap & blind' },
  { k: 'lowlight',     label: 'Low-light',    hint: 'Lux simulation' },
  { k: 'ir',           label: 'IR',           hint: 'Infrared range' },
  { k: 'presentation', label: 'Present',      hint: 'Cinematic spotlight' },
  { k: 'compliance',   label: 'Compliance',   hint: 'NEC / NDAA / ADA' },
];

export function CoverageHUD({
  mode, onMode, opacity, onOpacity, selectedOnly, onSelectedOnly,
}: Props) {
  return (
    <div className="absolute top-4 right-4 z-50 w-[280px]">
      <div className="bg-[var(--panel-background)]/95 backdrop-blur-2xl border border-primary/30 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-3 py-2 flex items-center justify-between border-b border-border/40">
          <span className="text-[9px] uppercase tracking-[0.22em] text-primary">Coverage HUD</span>
          <button
            onClick={() => onSelectedOnly(!selectedOnly)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.14em] transition-colors ${
              selectedOnly
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
            title="Show coverage for selected device only"
          >
            {selectedOnly ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Selected
          </button>
        </div>
        <div className="px-2 py-2 grid grid-cols-2 gap-1">
          {MODES.map((m) => (
            <button
              key={m.k}
              onClick={() => onMode(m.k)}
              title={m.hint}
              className={`px-2 py-1.5 rounded-md text-[10px] font-medium text-left transition-all ${
                mode === m.k
                  ? 'bg-primary text-primary-foreground shadow-[inset_0_-1px_0_rgba(0,0,0,0.3)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <div>{m.label}</div>
              <div className={`text-[8.5px] mt-0.5 tracking-[0.06em] ${mode === m.k ? 'opacity-80' : 'opacity-50'}`}>
                {m.hint}
              </div>
            </button>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-border/40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Opacity</span>
            <span className="text-[10px] tabular-nums text-foreground">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(e) => onOpacity(Number(e.target.value) / 100)}
            className="w-full h-1 accent-primary"
          />
        </div>
      </div>
    </div>
  );
}
