import { useEffect, useRef, useState } from 'react';
import { distanceToNearestWall } from './wallSnap';
import {
  CameraObj,
  CanvasObject,
  DoorObj,
  IdfObj,
  LENS_COLORS,
  MultisensorObj,
  PathwayObj,
  TargetObj,
  Vec2,
  clarityLabel,
  doriFor,
  pointInCone,
  pxPerFtAt,
} from '../../lib/engineering';

export type CoverageMode = 'minimal'|'wireframe'|'heatmap'|'conflict'|'presentation'|'tactical'|'lowlight'|'ir';

interface RenderProps {
  obj: CanvasObject;
  selected: boolean;
  zoom: number;
  scaleFtPerPx: number;
  targets: TargetObj[];
  onSelect: (id: string, additive?: boolean) => void;
  onDrag: (id: string, world: Vec2) => void;
  onUpdate: (id: string, patch: Partial<any>) => void;
  toWorld: (cx: number, cy: number) => Vec2;
  coverageMode?: CoverageMode;
  coverageOpacity?: number;
  coverageSelectedOnly?: boolean;
  anySelected?: boolean;
  onResolveBlind?: (info: { id: string; pair: string; delta: number; prevLenses: any[] }) => void;
}

// Per-mode visual tuning for DORI overlays.
function coverageStyle(mode: CoverageMode | undefined) {
  switch (mode) {
    case 'wireframe': return { fillScale: 0, strokeOpacity: 1, strokeWidth: 1.2, dim: 1 };
    case 'heatmap':   return { fillScale: 2.4, strokeOpacity: 0.2, strokeWidth: 0.5, dim: 1 };
    case 'conflict':  return { fillScale: 0, strokeOpacity: 0.4, strokeWidth: 1, dim: 1 };
    case 'presentation': return { fillScale: 0.6, strokeOpacity: 0.15, strokeWidth: 0.5, dim: 1 };
    case 'tactical':  return { fillScale: 1.1, strokeOpacity: 1, strokeWidth: 1.2, dim: 1, tint: '#F87171' };
    case 'lowlight':  return { fillScale: 1.3, strokeOpacity: 0.5, strokeWidth: 1, dim: 0.45, tint: '#3B82F6' };
    case 'ir':        return { fillScale: 1.4, strokeOpacity: 0.6, strokeWidth: 1, dim: 1, tint: '#10B981' };
    case 'minimal':
    default:          return { fillScale: 0.9, strokeOpacity: 0.6, strokeWidth: 1, dim: 1 };
  }
}

function mixRgba(hex: string, alpha: number) {
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Generic drag helper with weighted inertial smoothing.
// Cursor target is lerped at α=0.42/frame so devices "catch up" over ~1-2 frames,
// giving a mass-aware drag feel without sacrificing responsiveness.
function useDragHandler(
  toWorld: (cx: number, cy: number) => Vec2,
  onMove: (world: Vec2, start: Vec2) => void,
) {
  const start = useRef<Vec2 | null>(null);
  const target = useRef<Vec2 | null>(null);
  const current = useRef<Vec2 | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      raf.current = null;
      if (!start.current || !target.current || !current.current) return;
      const t = target.current;
      const c = current.current;
      // Adaptive α: open space = weighted catch-up (0.42); near a wall = crisper, near-instant
      // lock so the magnetic snap doesn't feel rubbery. Linear ramp from 0.42 → 0.92 over 8→2px.
      const wallDist = distanceToNearestWall(t);
      const alpha = wallDist <= 2 ? 0.95
        : wallDist >= 8 ? 0.42
        : 0.42 + ((8 - wallDist) / 6) * 0.5;
      const nx = c.x + (t.x - c.x) * alpha;
      const ny = c.y + (t.y - c.y) * alpha;
      current.current = { x: nx, y: ny };
      onMove({ x: nx, y: ny }, start.current);
      // Keep ticking until we're within sub-pixel of cursor.
      if (Math.hypot(t.x - nx, t.y - ny) > 0.3) {
        raf.current = requestAnimationFrame(tick);
      }
    };
    const up = () => {
      // Final snap to true cursor position to avoid drift on release.
      if (start.current && target.current) onMove(target.current, start.current);
      start.current = null;
      target.current = null;
      current.current = null;
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
    const move = (e: MouseEvent) => {
      if (!start.current) return;
      target.current = toWorld(e.clientX, e.clientY);
      if (!current.current) current.current = { ...target.current };
      if (raf.current == null) raf.current = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [toWorld, onMove]);

  return (e: React.MouseEvent) => {
    e.stopPropagation();
    const w = toWorld(e.clientX, e.clientY);
    start.current = w;
    target.current = w;
    current.current = w;
  };
}

// ---------- Camera ----------
export function CameraNode({ obj, selected, scaleFtPerPx, targets, onSelect, onDrag, onUpdate, toWorld, coverageMode, coverageOpacity, coverageSelectedOnly, anySelected }: RenderProps & { obj: CameraObj }) {
  let cs = coverageStyle(coverageMode);
  const coverageHidden = !!(coverageSelectedOnly && !selected && anySelected);
  if (coverageHidden) {
    cs = { ...cs, fillScale: 0, strokeOpacity: 0 };
  } else {
    const op = coverageOpacity ?? 1;
    cs = { ...cs, fillScale: cs.fillScale * op, strokeOpacity: cs.strokeOpacity * op };
  }
  const focusDim = anySelected && !selected ? (coverageMode === 'presentation' ? 0.08 : 0.35) : 1;
  const groupOpacity = cs.dim * focusDim;
  const fillFor = (base: string) => {
    if (cs.fillScale === 0) return 'transparent';
    const m = base.match(/rgba\(([^,]+),([^,]+),([^,]+),([^)]+)\)/);
    if (!m) return base;
    const a = Math.min(0.85, parseFloat(m[4]) * cs.fillScale);
    return `rgba(${m[1]},${m[2]},${m[3]},${a})`;
  };
  const strokeFor = (base: string) => {
    const m = base.match(/rgba\(([^,]+),([^,]+),([^,]+),([^)]+)\)/);
    if (!m) return base;
    return `rgba(${m[1]},${m[2]},${m[3]},${cs.strokeOpacity})`;
  };
  const tintFill = (def: string) => coverageMode === 'tactical' || coverageMode === 'lowlight' || coverageMode === 'ir'
    ? mixRgba(cs.tint!, 0.18 * cs.fillScale)
    : fillFor(def);
  const tintStroke = (def: string) => coverageMode === 'tactical' || coverageMode === 'lowlight' || coverageMode === 'ir'
    ? mixRgba(cs.tint!, cs.strokeOpacity)
    : strokeFor(def);
  const rangePx = obj.range / scaleFtPerPx;
  const zones = doriFor(rangePx);
  const fov = obj.fov;
  const rot = obj.rotation;
  const startDrag = useDragHandler(toWorld, (w) => onDrag(obj.id, w));
  const [rotateLive, setRotateLive] = useState<{ ang: number; snapped: boolean } | null>(null);
  const rotateDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    const move = (ev: MouseEvent) => {
      const w = toWorld(ev.clientX, ev.clientY);
      const raw = (Math.atan2(w.y - obj.y, w.x - obj.x) * 180) / Math.PI;
      const shift = ev.shiftKey;
      const ang = shift ? Math.round(raw / 15) * 15 : raw;
      setRotateLive({ ang, snapped: shift });
      onUpdate(obj.id, { rotation: ang });
    };
    const up = () => {
      setRotateLive(null);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const SNAP_HIGHLIGHTS = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, -15, -30, -45, -60, -75, -90, -105, -120, -135, -150, -165];
  const rangeDrag = useDragHandler(toWorld, (w) => {
    const d = Math.hypot(w.x - obj.x, w.y - obj.y);
    onUpdate(obj.id, { range: Math.max(5, d * scaleFtPerPx) });
  });
  const fovDrag = useDragHandler(toWorld, (w) => {
    const ang = (Math.atan2(w.y - obj.y, w.x - obj.x) * 180) / Math.PI;
    const delta = Math.min(170, Math.max(20, Math.abs(((ang - obj.rotation + 540) % 360) - 180) * 2 * 0));
    // simpler: derived from offset perpendicular
    const local = Math.atan2(w.y - obj.y, w.x - obj.x) * 180 / Math.PI - obj.rotation;
    const a = Math.abs(((local + 540) % 360) - 180);
    onUpdate(obj.id, { fov: Math.min(170, Math.max(15, a * 2)) });
    void delta;
  });

  return (
    <g
      transform={`translate(${obj.x},${obj.y}) rotate(${rot})`}
      onMouseDown={(e) => {
        onSelect(obj.id, e.shiftKey);
        if (!obj.locked) startDrag(e);
      }}
      style={{ cursor: obj.locked ? 'not-allowed' : 'grab', opacity: groupOpacity }}
    >
      {/* Coverage fade-with-distance mask — fades cone toward outer edge */}
      <defs>
        <radialGradient id={`cam-fade-${obj.id}`} cx="0" cy="0" r={zones.detect} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#fff" stopOpacity={1} />
          <stop offset="55%"  stopColor="#fff" stopOpacity={0.9} />
          <stop offset="85%"  stopColor="#fff" stopOpacity={0.45} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0.1} />
        </radialGradient>
        <mask id={`cam-mask-${obj.id}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x={-zones.detect} y={-zones.detect} width={zones.detect * 2} height={zones.detect * 2}>
          <rect x={-zones.detect} y={-zones.detect} width={zones.detect * 2} height={zones.detect * 2} fill={`url(#cam-fade-${obj.id})`} />
        </mask>
      </defs>
      {/* DORI rings (drawn as truncated cones via filled pie slices) */}
      <g mask={`url(#cam-mask-${obj.id})`}>
        <Pie radius={zones.detect} fov={fov} fill={tintFill('rgba(59,130,246,0.10)')} stroke={tintStroke('rgba(59,130,246,0.25)')} />
        <Pie radius={zones.observe} fov={fov} fill={tintFill('rgba(6,182,212,0.10)')} stroke={tintStroke('rgba(6,182,212,0.3)')} />
        <Pie radius={zones.recognize} fov={fov} fill={tintFill('rgba(16,185,129,0.12)')} stroke={tintStroke('rgba(16,185,129,0.35)')} />
        <Pie radius={zones.identify} fov={fov} fill={tintFill('rgba(245,158,11,0.16)')} stroke={tintStroke('rgba(245,158,11,0.45)')} />
      </g>

      {/* center marker */}
      <circle r={9} fill="#0F172A" stroke={selected ? '#3B82F6' : '#94A3B8'} strokeWidth={selected ? 2 : 1} />
      <circle r={3} fill="#3B82F6" />

      {selected && !obj.locked && (
        <>
          {/* Drag-to-rotate ring — grab anywhere on perimeter (Shift = 15° snap) */}
          <g style={{ pointerEvents: 'auto' }}>
            <circle r={28} fill="none" stroke="#F59E0B" strokeWidth={1} strokeDasharray="2 3" opacity={rotateLive ? 0.85 : 0.55} />
            <circle r={28} fill="none" stroke="transparent" strokeWidth={14} onMouseDown={rotateDrag} style={{ cursor: 'grab' }} />
            {Array.from({ length: 24 }).map((_, k) => {
              const deg = k * 15 - 180;
              const a = (k * 15) * Math.PI / 180;
              const major = k % 6 === 0;
              const cardinal = SNAP_HIGHLIGHTS.includes(deg);
              const isCurrentSnap = rotateLive?.snapped && Math.abs(((rotateLive.ang - (k * 15) + 540) % 360) - 180) < 0.5;
              const inner = major ? 24 : 26;
              const outer = isCurrentSnap ? 34 : 30;
              return (
                <line key={k}
                  x1={Math.cos(a) * inner} y1={Math.sin(a) * inner}
                  x2={Math.cos(a) * outer} y2={Math.sin(a) * outer}
                  stroke={isCurrentSnap ? '#FBBF24' : '#F59E0B'}
                  strokeWidth={isCurrentSnap ? 2 : major ? 1.2 : 0.6}
                  opacity={isCurrentSnap ? 1 : cardinal ? 0.9 : 0.45} />
              );
            })}
            {/* facing indicator */}
            <polygon points="34,0 28,-4 28,4" fill="#F59E0B" />
            {/* live angle telemetry while dragging */}
            {rotateLive && (
              <g transform={`translate(50, 0)`}>
                <rect x={-22} y={-9} width={44} height={18} rx={4} fill="#0F172A" stroke={rotateLive.snapped ? '#FBBF24' : '#F59E0B'} strokeWidth={1.2} />
                <text textAnchor="middle" y={4} fontSize={10} fontWeight={600} fill={rotateLive.snapped ? '#FBBF24' : '#F59E0B'}>
                  {Math.round(rotateLive.ang)}°{rotateLive.snapped ? ' ◉' : ''}
                </text>
              </g>
            )}
          </g>
          {/* range handle */}
          <g onMouseDown={rangeDrag} style={{ cursor: 'ew-resize' }}>
            <line x1={0} y1={0} x2={zones.detect} y2={0} stroke="#3B82F6" strokeWidth={1} strokeDasharray="3 3" />
            <rect x={zones.detect - 5} y={-5} width={10} height={10} fill="#3B82F6" stroke="#fff" strokeWidth={1} />
          </g>
          {/* fov handles (top/bottom edges of cone) */}
          <g
            onMouseDown={fovDrag}
            transform={`rotate(${-fov / 2}) translate(${zones.detect * 0.85},0)`}
            style={{ cursor: 'ns-resize' }}
          >
            <rect x={-4} y={-4} width={8} height={8} fill="#06B6D4" stroke="#fff" strokeWidth={1} />
          </g>
          <g
            onMouseDown={fovDrag}
            transform={`rotate(${fov / 2}) translate(${zones.detect * 0.85},0)`}
            style={{ cursor: 'ns-resize' }}
          >
            <rect x={-4} y={-4} width={8} height={8} fill="#06B6D4" stroke="#fff" strokeWidth={1} />
          </g>
          {/* rotation handle */}
          <g transform={`translate(${zones.detect + 18},0)`} onMouseDown={rotateDrag} style={{ cursor: 'grab' }}>
            <circle r={6} fill="#0F172A" stroke="#F59E0B" strokeWidth={1.5} />
            <circle r={2} fill="#F59E0B" />
          </g>
        </>
      )}

      {/* live target px/ft readout */}
      {targets.map((t) => {
        const inCone = pointInCone(t, obj, obj.rotation, obj.fov, rangePx);
        if (!inCone) return null;
        const distFt = Math.hypot(t.x - obj.x, t.y - obj.y) * scaleFtPerPx;
        const px = pxPerFtAt(distFt, obj.focalLength);
        const lbl = clarityLabel(px);
        const color = lbl === 'identify' ? '#F59E0B' : lbl === 'recognize' ? '#10B981' : lbl === 'observe' ? '#06B6D4' : '#3B82F6';
        // local coords from camera origin (already rotated group)
        const lx = (t.x - obj.x) * Math.cos((-obj.rotation * Math.PI) / 180) - (t.y - obj.y) * Math.sin((-obj.rotation * Math.PI) / 180);
        const ly = (t.x - obj.x) * Math.sin((-obj.rotation * Math.PI) / 180) + (t.y - obj.y) * Math.cos((-obj.rotation * Math.PI) / 180);
        return (
          <g key={t.id} transform={`rotate(${-obj.rotation}) translate(${(t.x - obj.x)},${(t.y - obj.y)})`}>
            <line x1={-(t.x - obj.x)} y1={-(t.y - obj.y)} x2={0} y2={0} stroke={color} strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />
            <rect x={10} y={-22} width={86} height={18} rx={4} fill="#0F172A" stroke={color} />
            <text x={14} y={-9} fontSize={10} fill="#E2E8F0">{Math.round(px)} px/ft · {lbl}</text>
            {/* silence unused */}
            <g transform={`translate(${lx*0},${ly*0})`} />
          </g>
        );
      })}
    </g>
  );
}

function Pie({ radius, fov, fill, stroke }: { radius: number; fov: number; fill: string; stroke: string }) {
  const a = (fov / 2) * (Math.PI / 180);
  const x1 = Math.cos(a) * radius;
  const y1 = -Math.sin(a) * radius;
  const x2 = Math.cos(a) * radius;
  const y2 = Math.sin(a) * radius;
  const largeArc = fov > 180 ? 1 : 0;
  const d = `M0,0 L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} Z`;
  return <path d={d} fill={fill} stroke={stroke} strokeWidth={1} />;
}

// ---------- Multisensor ----------
export function MultisensorNode({ obj, selected, scaleFtPerPx, onSelect, onDrag, onUpdate, toWorld, coverageMode, coverageOpacity, coverageSelectedOnly, anySelected, onResolveBlind }: RenderProps & { obj: MultisensorObj }) {
  const startDrag = useDragHandler(toWorld, (w) => onDrag(obj.id, w));
  let cs = coverageStyle(coverageMode);
  const coverageHidden = !!(coverageSelectedOnly && !selected && anySelected);
  if (coverageHidden) {
    cs = { ...cs, fillScale: 0, strokeOpacity: 0 };
  } else {
    const op = coverageOpacity ?? 1;
    cs = { ...cs, fillScale: cs.fillScale * op, strokeOpacity: cs.strokeOpacity * op };
  }
  const focusDim = anySelected && !selected ? (coverageMode === 'presentation' ? 0.08 : 0.35) : 1;
  // Linked-mode group rotation handler — drag perimeter to rotate ALL lenses by delta.
  // Live rotation-anchor proximity — fires when any lens edge is within 5° of a 15° tick.
  // Drives the cyan glow overlay on that tick so engineers see the snap approach.
  const [rotAnchor, setRotAnchor] = useState<{ deg: number; intensity: number } | null>(null);
  useEffect(() => {
    const clear = () => setRotAnchor(null);
    window.addEventListener('mouseup', clear);
    return () => window.removeEventListener('mouseup', clear);
  }, []);
  const probeAnchor = (deg: number) => {
    const mod = ((deg % 360) + 360) % 360;
    const tick = Math.round(mod / 15) * 15 % 360;
    const dist = Math.min(Math.abs(mod - tick), 360 - Math.abs(mod - tick));
    if (dist <= 5) setRotAnchor({ deg: tick, intensity: 1 - dist / 5 });
    else setRotAnchor(null);
  };
  const linkedRingDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startW = toWorld(e.clientX, e.clientY);
    const startAng = (Math.atan2(startW.y - obj.y, startW.x - obj.x) * 180) / Math.PI;
    const startLenses = obj.lenses.map(l => ({ ...l }));
    const move = (ev: MouseEvent) => {
      const w = toWorld(ev.clientX, ev.clientY);
      const raw = (Math.atan2(w.y - obj.y, w.x - obj.x) * 180) / Math.PI;
      const rawDelta = raw - startAng;
      const delta = ev.shiftKey ? Math.round(rawDelta / 15) * 15 : rawDelta;
      // Probe the first lens's rotation after delta as the anchor probe target.
      probeAnchor(startLenses[0].rotation + rawDelta);
      onUpdate(obj.id, { lenses: startLenses.map(l => ({ ...l, rotation: l.rotation + delta })) });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setRotAnchor(null);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const [resolveFlash, setResolveFlash] = useState<{ delta: number; pair: string } | null>(null);
  useEffect(() => {
    if (!resolveFlash) return;
    const t = setTimeout(() => setResolveFlash(null), 1500);
    return () => clearTimeout(t);
  }, [resolveFlash]);
  return (
    <g
      transform={`translate(${obj.x},${obj.y})`}
      onMouseDown={(e) => {
        onSelect(obj.id, e.shiftKey);
        if (!obj.locked) startDrag(e);
      }}
      style={{ cursor: 'grab', opacity: cs.dim * focusDim }}
    >
      {/* Drag-to-rotate ring — central hub (linked mode rotates all, otherwise pulses as anchor) */}
      {selected && !obj.locked && (
        <g>
          <circle r={34} fill="none" stroke={obj.linked ? '#22D3EE' : '#64748B'} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.7} />
          {obj.linked && (
            <circle r={34} fill="none" stroke="transparent" strokeWidth={16} onMouseDown={linkedRingDrag} style={{ cursor: 'grab' }} />
          )}
          {Array.from({ length: 24 }).map((_, k) => {
            const a = (k * 15) * Math.PI / 180;
            const inner = k % 6 === 0 ? 30 : 32;
            return (
              <line key={k}
                x1={Math.cos(a) * inner} y1={Math.sin(a) * inner}
                x2={Math.cos(a) * 36} y2={Math.sin(a) * 36}
                stroke={obj.linked ? '#22D3EE' : '#64748B'} strokeWidth={k % 6 === 0 ? 1 : 0.5}
                opacity={k % 6 === 0 ? 0.85 : 0.4} />
            );
          })}
          <text y={-40} textAnchor="middle" fontSize={8} fill={obj.linked ? '#22D3EE' : '#94A3B8'} fontWeight={600}>
            {obj.linked ? '◉ LINKED · drag to rotate all · ⇧ snap 15°' : '◌ INDEPENDENT · per-lens handles'}
          </text>
          {/* Live rotation-anchor proximity glow — anticipates the 15° snap during drag */}
          {rotAnchor && (() => {
            const a = (rotAnchor.deg * Math.PI) / 180;
            const op = 0.35 + rotAnchor.intensity * 0.6;
            const r1 = 28, r2 = 40;
            return (
              <g pointerEvents="none">
                <line
                  x1={Math.cos(a) * r1} y1={Math.sin(a) * r1}
                  x2={Math.cos(a) * r2} y2={Math.sin(a) * r2}
                  stroke="#7DD3FC" strokeWidth={2 + rotAnchor.intensity * 2} strokeLinecap="round" opacity={op}
                />
                <circle cx={Math.cos(a) * 34} cy={Math.sin(a) * 34} r={3 + rotAnchor.intensity * 3}
                  fill="none" stroke="#7DD3FC" strokeWidth={1.2} opacity={op}>
                  <animate attributeName="r" values={`${3 + rotAnchor.intensity * 3};${6 + rotAnchor.intensity * 4};${3 + rotAnchor.intensity * 3}`}
                    dur="0.9s" repeatCount="indefinite" />
                </circle>
                <text x={Math.cos(a) * 48} y={Math.sin(a) * 48 + 3} textAnchor="middle"
                  fontSize={8} fill="#7DD3FC" fontFamily="ui-monospace, monospace">{rotAnchor.deg}°</text>
              </g>
            );
          })()}
          {/* Per-lens color dots on perimeter */}
          {obj.lenses.map((lens, i) => {
            const color = lens.color || LENS_COLORS[i % 4];
            const a = (lens.rotation * Math.PI) / 180;
            return (
              <g key={`dot-${i}`} transform={`translate(${Math.cos(a) * 34},${Math.sin(a) * 34})`}>
                <circle r={4} fill={color} stroke="#0F172A" strokeWidth={1.2} />
                <text y={2} textAnchor="middle" fontSize={6} fill="#0F172A" fontWeight={700}>{String.fromCharCode(65 + i)}</text>
              </g>
            );
          })}
        </g>
      )}
      {obj.lenses.map((lens, i) => {
        const rangePx = lens.range / scaleFtPerPx;
        const color = lens.color || LENS_COLORS[i % 4];
        // Overlap % vs next clockwise lens — angular overlap of half-FOVs.
        const next = obj.lenses[(i + 1) % obj.lenses.length];
        const dAng = Math.abs(((next.rotation - lens.rotation + 540) % 360) - 180);
        const halfSum = (lens.fov + next.fov) / 2;
        const overlapDeg = Math.max(0, halfSum - dAng);
        const overlapPct = Math.round((overlapDeg / Math.max(1, lens.fov)) * 100);
        const overlapColor = overlapPct > 35 ? '#EF4444' : overlapPct > 18 ? '#F59E0B' : '#10B981';
        const rotateDrag = (e: React.MouseEvent) => {
          e.stopPropagation();
          const start = toWorld(e.clientX, e.clientY);
          const move = (ev: MouseEvent) => {
            const w = toWorld(ev.clientX, ev.clientY);
            const raw = (Math.atan2(w.y - obj.y, w.x - obj.x) * 180) / Math.PI;
            const ang = ev.shiftKey ? Math.round(raw / 15) * 15 : raw;
            probeAnchor(raw);
            const delta = ang - lens.rotation;
            const nextLenses = obj.lenses.map((l, idx) =>
              obj.linked
                ? { ...l, rotation: l.rotation + delta }
                : idx === i
                  ? { ...l, rotation: ang }
                  : l,
            );
            onUpdate(obj.id, { lenses: nextLenses });
            void start;
          };
          const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        };
        const letter = String.fromCharCode(65 + i);
        return (
          <g key={lens.id}>
          <g transform={`rotate(${lens.rotation})`} style={{ mixBlendMode: coverageMode === 'wireframe' || coverageMode === 'conflict' ? 'normal' : 'screen' as any }}>
            <defs>
              <radialGradient id={`lens-fade-${obj.id}-${lens.id}`} cx="0" cy="0" r={rangePx} gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#fff" stopOpacity={1} />
                <stop offset="55%"  stopColor="#fff" stopOpacity={0.9} />
                <stop offset="85%"  stopColor="#fff" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#fff" stopOpacity={0.1} />
              </radialGradient>
              <mask id={`lens-mask-${obj.id}-${lens.id}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x={-rangePx} y={-rangePx} width={rangePx * 2} height={rangePx * 2}>
                <rect x={-rangePx} y={-rangePx} width={rangePx * 2} height={rangePx * 2} fill={`url(#lens-fade-${obj.id}-${lens.id})`} />
              </mask>
            </defs>
            <g mask={`url(#lens-mask-${obj.id}-${lens.id})`}>
              <Pie
                radius={rangePx}
                fov={lens.fov}
                fill={cs.fillScale === 0 ? 'transparent' : `${color}${Math.round(0x1f * cs.fillScale).toString(16).padStart(2,'0')}`}
                stroke={`${color}${Math.round(0x99 * cs.strokeOpacity).toString(16).padStart(2,'0')}`}
              />
            </g>
            <g transform={`translate(${rangePx * 0.55},0)`}>
              <circle r={8} fill="#0F172A" stroke={color} strokeWidth={1} opacity={0.85} />
              <text y={3} textAnchor="middle" fontSize={9} fill={color} fontWeight={600}>{letter}</text>
            </g>
            {selected && (
              <g transform={`translate(${rangePx + 14},0)`} onMouseDown={rotateDrag} style={{ cursor: 'grab' }}>
                <circle r={5} fill="#0F172A" stroke={color} strokeWidth={1.5} />
              </g>
            )}
          </g>
          {/* Stitching line (overlap > 0) OR blind-zone wedge (gap > 0) */}
          {coverageMode !== 'presentation' && (() => {
            const signed = ((next.rotation - lens.rotation + 540) % 360) - 180;
            const bisector = lens.rotation + signed / 2;
            const lensEdge = lens.rotation + (signed >= 0 ? lens.fov / 2 : -lens.fov / 2);
            const nextEdge = next.rotation + (signed >= 0 ? -next.fov / 2 : next.fov / 2);
            const gapHalf = (Math.abs(signed) - (lens.fov + next.fov) / 2) / 2;
            const nextRangePx = next.range / scaleFtPerPx;
            if (gapHalf > 0) {
              // BLIND ZONE — wedge between the two edges
              const r = Math.min(rangePx, nextRangePx) * 0.95;
              const a1 = (lensEdge * Math.PI) / 180;
              const a2 = (nextEdge * Math.PI) / 180;
              const x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r;
              const x2 = Math.cos(a2) * r, y2 = Math.sin(a2) * r;
              const sweep = signed >= 0 ? 1 : 0;
              const closeBlind = (e: React.MouseEvent) => {
                e.stopPropagation();
                const shift = gapHalf + 1;
                const dirA = signed >= 0 ? 1 : -1;
                const dirB = -dirA;
                const lensesNext = obj.lenses.map((l, idx) => {
                  if (idx === i) return { ...l, rotation: l.rotation + dirA * shift };
                  if (idx === (i + 1) % obj.lenses.length) return { ...l, rotation: l.rotation + dirB * shift };
                  return l;
                });
                const prevLenses = obj.lenses.map(l => ({ ...l }));
                onUpdate(obj.id, { lenses: lensesNext });
                const pair = `${String.fromCharCode(65+i)}↔${String.fromCharCode(65+((i+1)%obj.lenses.length))}`;
                setResolveFlash({ delta: shift, pair });
                onResolveBlind?.({ id: obj.id, pair, delta: shift, prevLenses });
              };
              return (
                <g key={`${lens.id}-blind`} onClick={closeBlind} style={{ cursor: 'pointer' }}>
                  <path d={`M0,0 L${x1},${y1} A${r},${r} 0 0 ${sweep} ${x2},${y2} Z`}
                    fill="rgba(239,68,68,0.10)" stroke="rgba(239,68,68,0.55)" strokeWidth={1} strokeDasharray="3 3" />
                  <text x={Math.cos((bisector*Math.PI)/180) * r * 0.6} y={Math.sin((bisector*Math.PI)/180) * r * 0.6 - 6}
                    textAnchor="middle" fontSize={9} fill="#FCA5A5" fontWeight={600}>BLIND {Math.round(gapHalf * 2)}°</text>
                  <text x={Math.cos((bisector*Math.PI)/180) * r * 0.6} y={Math.sin((bisector*Math.PI)/180) * r * 0.6 + 5}
                    textAnchor="middle" fontSize={8} fill="#FCA5A5" opacity={0.8}>click to resolve</text>
                </g>
              );
            } else if (overlapPct > 0) {
              // STITCHING ray along bisector, from origin to inner overlap radius
              const r = Math.min(rangePx, nextRangePx);
              const inner = r * 0.35, outer = r * 0.92;
              const bx0 = Math.cos((bisector*Math.PI)/180) * inner;
              const by0 = Math.sin((bisector*Math.PI)/180) * inner;
              const bx1 = Math.cos((bisector*Math.PI)/180) * outer;
              const by1 = Math.sin((bisector*Math.PI)/180) * outer;
              return (
                <g key={`${lens.id}-stitch`}>
                  <line x1={bx0} y1={by0} x2={bx1} y2={by1} stroke={overlapColor} strokeWidth={1.2} strokeDasharray="4 2" opacity={0.75} />
                  <circle cx={bx1} cy={by1} r={2} fill={overlapColor} />
                </g>
              );
            }
            return null;
          })()}

          {/* Overlap telemetry pill */}
          {selected && coverageMode !== 'presentation' && (
            (() => {
              const signed = ((next.rotation - lens.rotation + 540) % 360) - 180;
              const bisector = lens.rotation + signed / 2;
              const br = rangePx * 0.72;
              const bx = Math.cos((bisector * Math.PI) / 180) * br;
              const by = Math.sin((bisector * Math.PI) / 180) * br;
              return (
                <g key={`${lens.id}-ov`} transform={`translate(${bx},${by})`}>
                  <rect x={-22} y={-9} width={44} height={16} rx={3} fill="#0F172A" stroke={overlapColor} />
                  <text x={0} y={2} textAnchor="middle" fontSize={9} fill={overlapColor} fontWeight={600}>{overlapPct}% ov</text>
                </g>
              );
            })()
          )}
          </g>
        );
      })}
      <circle r={10} fill="#0F172A" stroke={selected ? '#3B82F6' : '#94A3B8'} strokeWidth={selected ? 2 : 1} />
      <text y={4} textAnchor="middle" fontSize={9} fill="#E2E8F0">4×</text>
      {resolveFlash && (
        <g transform="translate(0,-22)">
          <rect x={-58} y={-9} width={116} height={16} rx={4} fill="rgba(16,185,129,0.18)" stroke="#10B981" />
          <text x={0} y={3} textAnchor="middle" fontSize={9} fill="#34D399" fontWeight={700}>
            ✓ blind resolved · {resolveFlash.pair} · ±{resolveFlash.delta.toFixed(1)}°
          </text>
        </g>
      )}
      {selected && (
        <g transform="translate(0,18)">
          <rect x={-32} y={0} width={64} height={14} rx={3} fill="#0F172A" stroke={obj.linked ? '#3B82F6' : '#94A3B8'}
            style={{ cursor: 'pointer' }}
            onMouseDown={(e) => { e.stopPropagation(); onUpdate(obj.id, { linked: !obj.linked }); }} />
          <text x={0} y={10} textAnchor="middle" fontSize={9} fill={obj.linked ? '#3B82F6' : '#94A3B8'} fontWeight={600}
            style={{ pointerEvents: 'none' }}>{obj.linked ? '◉ LINKED' : '◌ INDEPENDENT'}</text>
        </g>
      )}
    </g>
  );
}

// ---------- Door ----------
export function DoorNode({ obj, selected, onSelect, onDrag, toWorld, coverageMode, anySelected }: RenderProps & { obj: DoorObj }) {
  const startDrag = useDragHandler(toWorld, (w) => onDrag(obj.id, w));
  const w = obj.doorType === 'double' ? 60 : obj.doorType === 'storefront' ? 80 : obj.doorType === 'gate' ? 100 : 40;
  const focusDim = anySelected && !selected ? (coverageMode === 'presentation' ? 0.08 : 0.6) : 1;
  return (
    <g
      transform={`translate(${obj.x},${obj.y}) rotate(${obj.rotation})`}
      onMouseDown={(e) => {
        onSelect(obj.id, e.shiftKey);
        if (!obj.locked) startDrag(e);
      }}
      style={{ cursor: 'grab', opacity: focusDim }}
    >
      <rect x={-w / 2} y={-3} width={w} height={6} fill="#475569" stroke={selected ? '#3B82F6' : '#64748B'} strokeWidth={selected ? 2 : 1} rx={1} />
      {/* swing arc */}
      <path d={`M ${-w / 2} 0 A ${w} ${w} 0 0 1 ${-w / 2} ${-w}`} fill="none" stroke="rgba(148,163,184,0.4)" strokeDasharray="2 3" />
      {/* hardware chips */}
      {obj.hardware.map((h, i) => {
        const angle = (i / Math.max(1, obj.hardware.length)) * Math.PI - Math.PI / 2;
        const cx = Math.cos(angle) * 18;
        const cy = Math.sin(angle) * 18 + 14;
        const color = h === 'maglock' ? '#EF4444' : h === 'reader' ? '#3B82F6' : h === 'controller' ? '#F59E0B' : '#10B981';
        return (
          <g key={`${h}-${i}`} transform={`translate(${cx},${cy})`}>
            <circle r={5} fill="#0F172A" stroke={color} strokeWidth={1.5} />
            <text y={2} textAnchor="middle" fontSize={6} fill={color}>{h[0].toUpperCase()}</text>
          </g>
        );
      })}
      {selected && (
        <text x={0} y={-12} textAnchor="middle" fontSize={9} fill="#E2E8F0">{obj.label || obj.doorType}</text>
      )}
    </g>
  );
}

// ---------- IDF ----------
export function IdfNode({ obj, selected, onSelect, onDrag, toWorld, coverageMode, anySelected }: RenderProps & { obj: IdfObj }) {
  const startDrag = useDragHandler(toWorld, (w) => onDrag(obj.id, w));
  const utilization = obj.usedPorts / Math.max(1, obj.ports);
  const focusDim = anySelected && !selected ? (coverageMode === 'presentation' ? 0.08 : 0.6) : 1;
  return (
    <g
      transform={`translate(${obj.x},${obj.y})`}
      onMouseDown={(e) => {
        onSelect(obj.id, e.shiftKey);
        if (!obj.locked) startDrag(e);
      }}
      style={{ cursor: 'grab', opacity: focusDim }}
    >
      <rect x={-22} y={-22} width={44} height={44} rx={6} fill="#0F172A" stroke={selected ? '#3B82F6' : '#F59E0B'} strokeWidth={selected ? 2 : 1.5} />
      <text y={-4} textAnchor="middle" fontSize={10} fill="#F59E0B">IDF</text>
      <text y={10} textAnchor="middle" fontSize={8} fill="#E2E8F0">{obj.name}</text>
      <rect x={-18} y={14} width={36} height={3} fill="#1E293B" />
      <rect x={-18} y={14} width={36 * Math.min(1, utilization)} height={3} fill={utilization > 0.85 ? '#EF4444' : '#10B981'} />
    </g>
  );
}

// ---------- Pathway ----------
export function PathwayNode({ obj, selected, onSelect, scaleFtPerPx, coverageMode, anySelected }: RenderProps & { obj: PathwayObj }) {
  if (obj.points.length < 1) return null;
  const d = obj.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const color = obj.pathType === 'conduit' ? '#F59E0B' : obj.pathType === 'tray' ? '#06B6D4' : '#94A3B8';
  const focusDim = anySelected && !selected ? (coverageMode === 'presentation' ? 0.06 : 0.55) : 1;

  // Live infrastructure telemetry — cable length, conduit fill, PoE load.
  let lengthPx = 0;
  for (let i = 1; i < obj.points.length; i++) {
    lengthPx += Math.hypot(obj.points[i].x - obj.points[i - 1].x, obj.points[i].y - obj.points[i - 1].y);
  }
  const lengthFt = lengthPx * scaleFtPerPx;
  // Approx cable count via points count (each kink ~1 run); cap at sane values.
  const cables = Math.max(1, Math.min(48, Math.round(2 + obj.points.length * 1.5)));
  const cableOd = 0.27; // Cat6 ~0.27"
  const conduitArea = Math.PI * Math.pow((obj.diameterIn ?? 0.75) / 2, 2);
  const fillPct = Math.min(120, Math.round((cables * Math.PI * Math.pow(cableOd / 2, 2)) / conduitArea * 100));
  const poeW = cables * 12;
  const overFill = fillPct > 40;
  const overPoe = poeW > 240;

  // Anchor telemetry chip near the midpoint of the longest segment.
  let midIdx = 1, midBest = 0;
  for (let i = 1; i < obj.points.length; i++) {
    const seg = Math.hypot(obj.points[i].x - obj.points[i - 1].x, obj.points[i].y - obj.points[i - 1].y);
    if (seg > midBest) { midBest = seg; midIdx = i; }
  }
  const mp = midIdx > 0
    ? { x: (obj.points[midIdx - 1].x + obj.points[midIdx].x) / 2, y: (obj.points[midIdx - 1].y + obj.points[midIdx].y) / 2 }
    : obj.points[0];

  const tone = overFill || overPoe ? '#EF4444' : fillPct > 30 ? '#F59E0B' : '#10B981';

  return (
    <g onMouseDown={(e) => { e.stopPropagation(); onSelect(obj.id, e.shiftKey); }} style={{ cursor: 'pointer', opacity: focusDim }}>
      <path d={d} fill="none" stroke={color} strokeWidth={selected ? 4 : 3} strokeOpacity={0.8} strokeLinecap="round" strokeLinejoin="round" />
      {/* Marching ants — directional flow on the cable run */}
      <path d={d} fill="none" stroke={color} strokeWidth={selected ? 2 : 1.2} strokeDasharray="6 6" strokeOpacity={0.95} strokeLinecap="round" pointerEvents="none">
        <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="2.4s" repeatCount="indefinite" />
      </path>
      {obj.points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={selected ? 4 : 2.5} fill={color} stroke="#0F172A" strokeWidth={1} />
      ))}
      {/* Telemetry chip — fill / length / PoE */}
      <g transform={`translate(${mp.x},${mp.y - 18})`} pointerEvents="none">
        <rect x={-78} y={-12} width={156} height={24} rx={5} fill="#0B1220" stroke={tone} strokeOpacity={0.85} />
        <line x1={-26} y1={-10} x2={-26} y2={10} stroke="rgba(148,163,184,0.3)" />
        <line x1={26}  y1={-10} x2={26}  y2={10} stroke="rgba(148,163,184,0.3)" />
        <text x={-52} y={-1.5} textAnchor="middle" fontSize={7} fill="#94A3B8" letterSpacing="0.5">FILL</text>
        <text x={-52} y={9}   textAnchor="middle" fontSize={9} fill={overFill ? '#EF4444' : '#E2E8F0'} fontWeight={600}>{fillPct}%</text>
        <text x={0}   y={-1.5} textAnchor="middle" fontSize={7} fill="#94A3B8" letterSpacing="0.5">LEN</text>
        <text x={0}   y={9}   textAnchor="middle" fontSize={9} fill="#E2E8F0" fontWeight={600}>{Math.round(lengthFt)} ft</text>
        <text x={52}  y={-1.5} textAnchor="middle" fontSize={7} fill="#94A3B8" letterSpacing="0.5">PoE</text>
        <text x={52}  y={9}   textAnchor="middle" fontSize={9} fill={overPoe ? '#EF4444' : '#E2E8F0'} fontWeight={600}>{poeW}W</text>
        {(overFill || overPoe) && (
          <circle cx={71} cy={-9} r={3} fill="#EF4444">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
          </circle>
        )}
      </g>
    </g>
  );
}

// ---------- Target ----------
export function TargetNode({ obj, selected, onSelect, onDrag, toWorld }: RenderProps & { obj: TargetObj }) {
  const startDrag = useDragHandler(toWorld, (w) => onDrag(obj.id, w));
  return (
    <g
      transform={`translate(${obj.x},${obj.y})`}
      onMouseDown={(e) => {
        onSelect(obj.id, e.shiftKey);
        startDrag(e);
      }}
      style={{ cursor: 'move' }}
    >
      <circle r={12} fill="rgba(239,68,68,0.15)" stroke="#EF4444" strokeWidth={selected ? 2 : 1} strokeDasharray="3 3" />
      <circle r={4} fill="#EF4444" />
      <text y={-16} textAnchor="middle" fontSize={9} fill="#EF4444">
        {obj.variant === 'person' ? '👤 person' : obj.variant === 'face' ? '🙂 face' : obj.variant === 'vehicle' ? '🚗 vehicle' : '🔢 plate'}
      </text>
    </g>
  );
}
