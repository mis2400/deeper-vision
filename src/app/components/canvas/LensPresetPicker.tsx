import { useEffect } from 'react';
import { Cable, Car, Warehouse, DoorOpen, Sparkles } from 'lucide-react';

export type LensPreset = 'corridor' | 'parking' | 'warehouse' | 'lobby';

interface LensConfig {
  id: string;
  rotation: number;
  fov: number;
  range: number;
  focalLength: number;
  color: string;
}

interface MultisensorLike {
  id: string;
  lenses: LensConfig[];
  linked?: boolean;
}

interface Props {
  multisensor: MultisensorLike | null;
  onApply: (id: string, lenses: LensConfig[]) => void;
}

const PALETTE = ['#22D3EE', '#F472B6', '#FBBF24', '#A78BFA'];

const PRESETS: Record<LensPreset, { rot: number; fov: number; range: number; focal: number }[]> = {
  // Tight forward fan — long, narrow, identifying down a hallway.
  corridor: [
    { rot: -22, fov: 36, range: 90, focal: 8 },
    { rot:  -7, fov: 36, range: 90, focal: 8 },
    { rot:   7, fov: 36, range: 90, focal: 8 },
    { rot:  22, fov: 36, range: 90, focal: 8 },
  ],
  // Wide spread — license plate / aisle coverage outdoors.
  parking: [
    { rot: -90, fov: 70, range: 80, focal: 4 },
    { rot: -30, fov: 70, range: 80, focal: 4 },
    { rot:  30, fov: 70, range: 80, focal: 4 },
    { rot:  90, fov: 70, range: 80, focal: 4 },
  ],
  // Four-cardinal omni — center-of-aisle warehouse coverage.
  warehouse: [
    { rot:   0, fov: 95, range: 65, focal: 3 },
    { rot:  90, fov: 95, range: 65, focal: 3 },
    { rot: 180, fov: 95, range: 65, focal: 3 },
    { rot: 270, fov: 95, range: 65, focal: 3 },
  ],
  // Forward-biased — entry, queue, faces inbound.
  lobby: [
    { rot: -55, fov: 60, range: 55, focal: 4 },
    { rot: -18, fov: 60, range: 55, focal: 4 },
    { rot:  18, fov: 60, range: 55, focal: 4 },
    { rot:  55, fov: 60, range: 55, focal: 4 },
  ],
};

const META: Record<LensPreset, { label: string; icon: any; hint: string }> = {
  corridor:  { label: 'Corridor',  icon: Cable,     hint: 'Long fan · ID-grade' },
  parking:   { label: 'Parking',   icon: Car,       hint: 'Wide spread · LPR' },
  warehouse: { label: 'Warehouse', icon: Warehouse, hint: 'Omni · 4-cardinal' },
  lobby:     { label: 'Lobby',     icon: DoorOpen,  hint: 'Forward-biased fan' },
};

export function LensPresetPicker({ multisensor, onApply }: Props) {
  // Keyboard: 1-4 quick-apply when a multisensor is selected.
  useEffect(() => {
    if (!multisensor) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const map: Record<string, LensPreset> = { '1': 'corridor', '2': 'parking', '3': 'warehouse', '4': 'lobby' };
      const key = map[e.key];
      if (key) {
        e.preventDefault();
        apply(key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [multisensor]);

  if (!multisensor) return null;

  const apply = (k: LensPreset) => {
    const cfg = PRESETS[k];
    const lenses = cfg.map((c, i): LensConfig => ({
      id: multisensor.lenses[i]?.id ?? `lens-${i}`,
      rotation: c.rot,
      fov: c.fov,
      range: c.range,
      focalLength: c.focal,
      color: PALETTE[i % PALETTE.length],
    }));
    onApply(multisensor.id, lenses);
  };

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <div className="bg-[var(--panel-background)]/95 backdrop-blur-2xl border border-primary/40 rounded-xl shadow-2xl px-3 py-2 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-[9px] uppercase tracking-[0.22em] text-primary">Lens Preset</span>
        </div>
        <div className="h-4 w-px bg-border/60" />
        <div className="flex items-center gap-1">
          {(Object.keys(PRESETS) as LensPreset[]).map((k, idx) => {
            const m = META[k];
            const Icon = m.icon;
            return (
              <button
                key={k}
                onClick={() => apply(k)}
                title={`${m.label} — ${m.hint} · ${idx + 1}`}
                className="group/btn flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
              >
                <Icon className="w-3 h-3" />
                <span>{m.label}</span>
                <kbd className="text-[8px] font-mono px-1 py-0 rounded bg-secondary/50 border border-border/40 text-muted-foreground">{idx + 1}</kbd>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
