import { ScanFace, ScanLine } from 'lucide-react';

export type OptimizeBias = 'prosecution' | 'overview' | null;

interface CameraLike {
  id: string;
  focalLength: number;
  mountHeight: number;
  fov: number;
  range: number;
  ir: boolean;
}

interface Props {
  camera: CameraLike | null;
  bias: OptimizeBias;
  onChange: (id: string, bias: OptimizeBias, patch: Partial<CameraLike>) => void;
}

// Prosecution: ID-grade — long focal, lower mount, narrow FOV, longer range, IR.
// Overview:    Wide situational — short focal, high mount, wide FOV, shorter range.
const PRESETS: Record<Exclude<OptimizeBias, null>, Partial<CameraLike>> = {
  prosecution: { focalLength: 8,   mountHeight: 8.5, fov: 42,  range: 95, ir: true  },
  overview:    { focalLength: 2.8, mountHeight: 13,  fov: 100, range: 55, ir: false },
};

export function OptimizeToggle({ camera, bias, onChange }: Props) {
  if (!camera) return null;
  const apply = (b: Exclude<OptimizeBias, null>) => {
    const next = bias === b ? null : b;
    if (next === null) {
      onChange(camera.id, null, {});
    } else {
      onChange(camera.id, next, PRESETS[next]);
    }
  };
  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <div className="bg-[var(--panel-background)]/95 backdrop-blur-2xl border border-primary/40 rounded-xl shadow-2xl px-3 py-2 flex items-center gap-3">
        <span className="text-[9px] uppercase tracking-[0.22em] text-primary">Optimize</span>
        <div className="h-4 w-px bg-border/60" />
        <button
          onClick={() => apply('prosecution')}
          title="ID-grade: long focal, lower mount, IR on"
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10.5px] transition-colors ${
            bias === 'prosecution'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
          }`}
        >
          <ScanFace className="w-3 h-3" />
          Prosecution
        </button>
        <button
          onClick={() => apply('overview')}
          title="Situational: wide FOV, high mount, short focal"
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10.5px] transition-colors ${
            bias === 'overview'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
          }`}
        >
          <ScanLine className="w-3 h-3" />
          Overview
        </button>
        {bias && (
          <span className="text-[9px] text-muted-foreground tracking-wide ml-1">
            f={PRESETS[bias].focalLength}mm · h={PRESETS[bias].mountHeight}ft
          </span>
        )}
      </div>
    </div>
  );
}
