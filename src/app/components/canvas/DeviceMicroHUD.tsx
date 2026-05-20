import { useEffect, useState } from 'react';
import { Camera, Eye, Crosshair, Zap, Radio, Aperture, Link2 } from 'lucide-react';

interface CameraLike {
  id: string;
  kind: string;
  x: number;
  y: number;
  focalLength?: number;
  fov?: number;
  range?: number;
  mountHeight?: number;
  ir?: boolean;
  ndaa?: boolean;
}

interface Lens {
  id: string;
  rotation: number;
  fov: number;
  range: number;
  focalLength: number;
  color?: string;
}

interface MultisensorLike {
  id: string;
  kind: string;
  x: number;
  y: number;
  mountHeight?: number;
  linked?: boolean;
  lenses: Lens[];
}

interface Props {
  device: CameraLike | MultisensorLike | null;
  scaleFtPerPx: number;
  containerRef: React.RefObject<HTMLElement | null>;
}

const LENS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function DeviceMicroHUD({ device, scaleFtPerPx, containerRef }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!device || !containerRef.current) {
      setPos(null);
      return;
    }
    const el = containerRef.current;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    const onLeave = () => setPos(null);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [device, containerRef]);

  if (!device || !pos) return null;

  const isMulti = device.kind === 'multisensor';
  const cardW = isMulti ? 280 : 224;
  const cardH = isMulti ? 188 : 138;
  const PAD = 16;
  const showRight = (containerRef.current?.clientWidth ?? 9999) - pos.x > cardW + 40;
  const showBelow = (containerRef.current?.clientHeight ?? 9999) - pos.y > cardH + 40;
  const left = showRight ? pos.x + PAD : pos.x - cardW - PAD;
  const top  = showBelow ? pos.y + PAD : pos.y - cardH - PAD;

  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{ left, top, width: cardW }}
    >
      {/* V3.10 — inline hex #0B1220 is intentional design-intent dark
          for the HUD popover floating over the canvas. Stays dark in
          every theme (Light Drafting / Slate / Dark) so the HUD reads
          as a separate technical layer over the floorplan instead of
          inheriting the theme card color. Sub-9px chip text below is
          similarly intentional — these are dense engineering readouts
          where rounding to the nearest chrome token regresses
          legibility. */}
      <div className="bg-[#0B1220]/95 backdrop-blur-xl border border-primary/40 rounded-lg shadow-2xl overflow-hidden">
        <div className="px-3 py-1.5 bg-primary/15 border-b border-primary/30 flex items-center gap-1.5">
          {isMulti ? <Aperture className="w-3 h-3 text-primary" /> : <Camera className="w-3 h-3 text-primary" />}
          <span className="text-[10px] tracking-[0.18em] uppercase text-primary">
            {isMulti ? 'Multisensor Live' : 'Live Telemetry'}
          </span>
          <span className="ml-auto text-[9px] text-muted-foreground font-mono">#{device.id.slice(-4)}</span>
        </div>
        {isMulti ? (
          <MultisensorBody device={device as MultisensorLike} scaleFtPerPx={scaleFtPerPx} />
        ) : (
          <CameraBody device={device as CameraLike} scaleFtPerPx={scaleFtPerPx} />
        )}
      </div>
    </div>
  );
}

function CameraBody({ device, scaleFtPerPx }: { device: CameraLike; scaleFtPerPx: number }) {
  const focal = device.focalLength ?? 4;
  const fov = device.fov ?? 90;
  const range = device.range ?? 60;
  const mh = device.mountHeight ?? 9;
  const idR = Math.min(range, focal * 12);
  const rcR = Math.min(range, focal * 24);
  const obR = Math.min(range, focal * 38);
  const dtR = range;
  return (
    <div className="p-3 space-y-2">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
        <Cell icon={<Crosshair className="w-2.5 h-2.5"/>} label="Focal" value={`${focal}mm`} />
        <Cell icon={<Eye className="w-2.5 h-2.5"/>} label="FOV" value={`${fov.toFixed(0)}°`} />
        <Cell icon={<Radio className="w-2.5 h-2.5"/>} label="Range" value={`${range.toFixed(0)} ft`} />
        <Cell icon={<Zap className="w-2.5 h-2.5"/>} label="Mount" value={`${mh.toFixed(1)} ft`} />
      </div>
      <div className="pt-1.5 border-t border-border/40">
        <p className="text-[8.5px] uppercase tracking-[0.18em] text-muted-foreground mb-1">DORI bands</p>
        <div className="flex h-1.5 rounded-sm overflow-hidden bg-secondary/30">
          <div className="bg-red-500"     style={{ width: `${(idR / dtR) * 100}%` }} />
          <div className="bg-amber-500"   style={{ width: `${((rcR - idR) / dtR) * 100}%` }} />
          <div className="bg-cyan-500"    style={{ width: `${((obR - rcR) / dtR) * 100}%` }} />
          <div className="bg-emerald-500" style={{ width: `${((dtR - obR) / dtR) * 100}%` }} />
        </div>
        <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5 font-mono">
          <span>ID {idR.toFixed(0)}</span>
          <span>RC {rcR.toFixed(0)}</span>
          <span>OB {obR.toFixed(0)}</span>
          <span>DT {dtR.toFixed(0)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[9px]">
        <span className={`px-1.5 py-0.5 rounded ${device.ir ? 'bg-emerald-500/20 text-emerald-300' : 'bg-secondary/30 text-muted-foreground'}`}>
          {device.ir ? '● IR on' : '○ IR off'}
        </span>
        <span className={`px-1.5 py-0.5 rounded ${device.ndaa ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
          {device.ndaa ? 'NDAA ✓' : 'NDAA ⚑'}
        </span>
        <span className="ml-auto font-mono text-muted-foreground">{(1 / scaleFtPerPx).toFixed(1)} px/ft</span>
      </div>
    </div>
  );
}

function MultisensorBody({ device, scaleFtPerPx }: { device: MultisensorLike; scaleFtPerPx: number }) {
  const lenses = device.lenses;
  // Compute pairwise overlap (degrees) between each adjacent lens in rotation order.
  const sorted = [...lenses].map((l, i) => ({ l, i })).sort((a, b) => a.l.rotation - b.l.rotation);
  const overlaps: Record<string, number> = {};
  for (let k = 0; k < sorted.length; k++) {
    const a = sorted[k].l;
    const b = sorted[(k + 1) % sorted.length].l;
    let gap = b.rotation - a.rotation;
    if (gap < 0) gap += 360;
    if (k === sorted.length - 1) gap = 360 - (a.rotation - sorted[0].l.rotation);
    const halfA = a.fov / 2;
    const halfB = b.fov / 2;
    const overlap = halfA + halfB - gap;
    overlaps[`${a.id}-${b.id}`] = overlap;
  }
  const total = lenses.reduce((s, l) => s + l.fov, 0);
  const coverage = Math.min(360, total - Object.values(overlaps).filter((v) => v > 0).reduce((s, v) => s + v, 0));
  const hasBlind = coverage < 358;
  const hasOverlap = Object.values(overlaps).some((v) => v > 12);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2 text-[9px]">
        <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${device.linked ? 'bg-primary/20 text-primary' : 'bg-secondary/30 text-muted-foreground'}`}>
          <Link2 className="w-2.5 h-2.5" />
          {device.linked ? 'LINKED' : 'Independent'}
        </span>
        <span className={`px-1.5 py-0.5 rounded ${hasBlind ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
          Coverage {coverage.toFixed(0)}°
        </span>
        <span className="ml-auto font-mono text-muted-foreground">{(device.mountHeight ?? 14).toFixed(1)} ft mount</span>
      </div>

      {/* Per-lens A/B/C/D strip */}
      <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-border/40">
        {lenses.map((l, i) => (
          <div key={l.id} className="rounded-sm border border-border/40 bg-secondary/15 p-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <span
                className="text-[10px] font-bold w-3 h-3 rounded-sm flex items-center justify-center"
                style={{ background: l.color ?? '#64748B', color: '#0B1220' }}
              >{LENS_LETTERS[i]}</span>
              <span className="text-[8px] font-mono text-muted-foreground">{l.rotation.toFixed(0)}°</span>
            </div>
            <div className="text-[8.5px] font-mono text-foreground/90 leading-tight">
              <div>{l.focalLength}mm</div>
              <div className="text-muted-foreground">{l.fov.toFixed(0)}° · {l.range.toFixed(0)}ft</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pairwise overlap deltas */}
      <div className="pt-1.5 border-t border-border/40">
        <p className="text-[8.5px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Adjacent overlap Δ</p>
        <div className="grid grid-cols-4 gap-1">
          {sorted.map((s, k) => {
            const next = sorted[(k + 1) % sorted.length];
            const ov = overlaps[`${s.l.id}-${next.l.id}`];
            const a = LENS_LETTERS[lenses.findIndex((x) => x.id === s.l.id)];
            const b = LENS_LETTERS[lenses.findIndex((x) => x.id === next.l.id)];
            const tone = ov < -2 ? 'text-red-400'
              : ov > 12 ? 'text-amber-300'
              : 'text-emerald-300';
            const sym = ov < -2 ? '✕' : ov > 12 ? '⚠' : '✓';
            return (
              <div key={k} className="flex items-center justify-between text-[9px] font-mono bg-secondary/10 rounded px-1 py-0.5">
                <span className="text-muted-foreground">{a}↔{b}</span>
                <span className={tone}>{ov > 0 ? '+' : ''}{ov.toFixed(0)}° {sym}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[9px]">
        {hasOverlap && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">⚠ Overlap waste</span>}
        {hasBlind && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">✕ Blind sector</span>}
        {!hasOverlap && !hasBlind && <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">● Balanced</span>}
        <span className="ml-auto font-mono text-muted-foreground">{(1 / scaleFtPerPx).toFixed(1)} px/ft</span>
      </div>
    </div>
  );
}

function Cell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-primary/70">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-mono text-foreground">{value}</span>
    </div>
  );
}
