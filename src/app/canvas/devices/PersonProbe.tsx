// PersonProbe + RotationRing — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup.
//
// PersonProbe:    Draggable face marker tied to a selected camera. Reads
//                 the same density chain as the cone DORI bands (pxPerFtAt
//                 is the inverse of doriBandsFor's d_T). Honesty: outside
//                 the cone the marker drags but the canvas + drawer
//                 preview both flip to "No coverage here".
// RotationRing:   Drag ring around a multisensor device body. Drags
//                 angularly to spin the entire device (the four lenses
//                 keep their relative rotation). Singleton ring; per-lens
//                 rotation lives on ConeHandles for each lens.
//
// Pure module — no closures on EngineeringCanvas state. Both components
// own their own React drag state (useState/useRef).

import { useCallback, useEffect, useRef, useState } from 'react';
import { cameraResolution } from '../coverage/resolution';
import { pointInCone, pxPerFtAt } from '../coverage/dori';
import type { Device, DeviceKind } from '../types';
import { deviceTone } from '../utils';

export function PersonProbe({
  d, pos, onMove, pxToFt, svgRef, zoom, pan,
}: {
  d: Device;
  pos: { x: number; y: number };
  onMove: (p: { x: number; y: number }) => void;
  pxToFt: number;
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  pan: { x: number; y: number };
}) {
  const tone = deviceTone(d);
  const resolution = cameraResolution(d);
  // No resolution → no probe. The canvas already prints the "set
  // resolution" hint inside the cone via FOV()'s honesty gate; we
  // simply don't render the marker to avoid duplicate hints.
  if (!resolution) return null;
  const defaultRangeFt = d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30;
  const defaultFovDeg  = d.type === 'cam.ptz' ? 36 : 70;
  const fovDeg  = d.fov  ?? defaultFovDeg;
  const rangeFt = d.range ?? defaultRangeFt;
  const probe = pointInCone({
    cameraX: d.x, cameraY: d.y, cameraRotDeg: d.rot ?? 0,
    fovDeg, rangeFt, pxToFt,
    pointX: pos.x, pointY: pos.y,
  });
  const live = probe.inCone
    ? pxPerFtAt({ fovDeg, resolution, distanceFt: probe.distanceFt })
    : null;
  // Drag wiring — window-level pointer listeners attached while
  // dragging. The previous version relied on React's pointercapture
  // on an SVG `<g>`, which fired unreliably once the pointer left
  // the marker's bounds and was the root cause of the drawer preview
  // never updating: pointermove on the captured `<g>` never reached
  // here, so `onMove` was never called, so `personProbePos` in the
  // parent never changed, so the drawer's `PersonProbePreview` had
  // nothing new to render. Window listeners always fire regardless of
  // which element the pointer is over.
  const [dragging, setDragging] = useState(false);
  // Latch the latest scaling args so the move handler always reads
  // the current zoom/pan even if the effect was started under a
  // different snapshot. Refs sidestep effect re-subscriptions.
  const svgRefRef = useRef(svgRef);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const onMoveRef = useRef(onMove);
  svgRefRef.current = svgRef;
  panRef.current = pan;
  zoomRef.current = zoom;
  onMoveRef.current = onMove;
  useEffect(() => {
    if (!dragging) return;
    const onPointerMove = (e: PointerEvent) => {
      const svg = svgRefRef.current.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) - panRef.current.x) / zoomRef.current;
      const y = ((e.clientY - r.top)  - panRef.current.y) / zoomRef.current;
      onMoveRef.current({ x, y });
    };
    const onPointerUp = () => setDragging(false);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [dragging]);
  const onDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
  }, []);
  // Item 4 — high contrast marker. Distinct magenta + white treatment
  // so the probe stands out against blue/green camera tones, the warm
  // floorplan background, and the cone wash. Bigger than before, with
  // a white halo and a crosshair so it reads as an instrument, not a
  // device. When outside the cone, drops to a muted gray ring so the
  // "no coverage" state is also visually clear.
  const r = 8;
  const MARKER_ON  = '#FF3FA5';   // vivid magenta — pops against blue
                                  // cones, warm floorplans, and gray
                                  // chrome. Distinct from every device
                                  // tone in KIND_TONE.
  const MARKER_OFF = '#A0A8B8';   // muted gray for the out-of-cone state.
  const mTone = probe.inCone ? MARKER_ON : MARKER_OFF;
  const distLabel = `${probe.distanceFt.toFixed(1)} ft`;
  const densityLabel = live != null ? `${live.toFixed(1)} px/ft` : 'no coverage';
  return (
    <g
      pointerEvents="all"
      data-canvas-element="person-probe"
      data-probe-in-cone={probe.inCone ? 'true' : 'false'}
      data-probe-distance-ft={probe.distanceFt.toFixed(1)}
      aria-label={probe.inCone ? `Person probe ${distLabel}, ${densityLabel}` : 'Person probe, no coverage'}
    >
      {/* Tether — dotted line from camera to probe in the marker tone
          so the link reads at a glance. Only drawn when inside the
          cone. */}
      {probe.inCone && (
        <line
          x1={d.x} y1={d.y} x2={pos.x} y2={pos.y}
          stroke={mTone} strokeWidth="0.9" strokeDasharray="2 3" opacity="0.75"
          pointerEvents="none"
        />
      )}
      {/* Marker — white halo, magenta ring, crosshair, person glyph. */}
      <g transform={`translate(${pos.x} ${pos.y})`} style={{ cursor: 'grab', touchAction: 'none' }}
         onPointerDown={onDown}>
        {/* Outer white halo for separation from the cone wash. */}
        <circle r={r * 1.7} fill="#FFFFFF" fillOpacity="0.95" stroke="rgba(0,0,0,0.18)" strokeWidth="0.4" />
        {/* Magenta accent ring — the high-contrast signal. */}
        <circle r={r * 1.7} fill="none" stroke={mTone} strokeWidth="1.5" />
        {/* Crosshair lines extending past the ring so the marker reads
            as an instrument (a probe), not a device. */}
        <line x1={-r * 2.2} y1={0} x2={-r * 1.7} y2={0} stroke={mTone} strokeWidth="1.2" />
        <line x1={r * 1.7} y1={0} x2={r * 2.2} y2={0} stroke={mTone} strokeWidth="1.2" />
        <line x1={0} y1={-r * 2.2} x2={0} y2={-r * 1.7} stroke={mTone} strokeWidth="1.2" />
        <line x1={0} y1={r * 1.7} x2={0} y2={r * 2.2} stroke={mTone} strokeWidth="1.2" />
        {/* Audit Group D.8 (second pass) — was a cartoon silhouette
            (head circle + trapezoid torso). Replaced with an
            anatomical standing figure derived from the Lucide
            person-standing glyph: small head, shoulders, raised
            arms, torso line, and a V of legs. Reads as a real human
            figure at every zoom level, not a smiley-face avatar.
            The path is hand-authored from Lucide's open-source
            person-standing icon (ISC license, no celebrity / no
            identifiable real person), drawn at 1.6× scale so the
            figure sits cleanly inside the white halo ring. */}
        <g transform={`scale(${r / 7})`} fill="none" stroke={mTone} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx={0} cy={-5.2} r={1.4} fill={mTone} />
          {/* shoulders + raised arms */}
          <path d="M -3.6 -2.2 L 0 -1 L 3.6 -2.2" />
          {/* torso */}
          <line x1={0} y1={-1} x2={0} y2={2.6} />
          {/* legs */}
          <path d="M -2.4 6 L 0 2.6 L 2.4 6" />
        </g>
      </g>
      {/* Live callout — Item 9.
          Inside cone: two-line readout (distance + px/ft).
          Outside cone: single line "no coverage" — no density number,
          no distance number per the brief ("no coverage with no number").
          Both at scaled-up font sizes (was 6/6.5, now 9/7.5) so the
          callout is legible at 100% zoom. */}
      {probe.inCone ? (
        <g transform={`translate(${pos.x} ${pos.y + r * 2.8})`} pointerEvents="none">
          <rect x={-46} y={-3} width={92} height={22} rx={4}
            fill="var(--panel-background)" fillOpacity="0.96"
            stroke={mTone} strokeOpacity="0.85" strokeWidth="0.8"
          />
          <text x={0} y={6.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--foreground)" fontFamily="ui-monospace, monospace">{distLabel}</text>
          <text x={0} y={15.5} textAnchor="middle" fontSize="9" fontWeight="700" fill={mTone} fontFamily="ui-monospace, monospace">{densityLabel}</text>
        </g>
      ) : (
        <g transform={`translate(${pos.x} ${pos.y + r * 2.8})`} pointerEvents="none">
          <rect x={-46} y={-3} width={92} height={15} rx={4}
            fill="var(--panel-background)" fillOpacity="0.96"
            stroke={mTone} strokeOpacity="0.85" strokeWidth="0.8"
          />
          <text x={0} y={8} textAnchor="middle" fontSize="9" fontWeight="700" fill={mTone} fontFamily="ui-monospace, monospace">no coverage</text>
        </g>
      )}
    </g>
  );
}

export function RotationRing({ d, onRotate, svgRef, zoom, pan, overrideColor }: { d: Device; onRotate: (r: number) => void; svgRef: React.RefObject<SVGSVGElement>; zoom: number; pan: { x: number; y: number }; overrideColor?: string }) {
  // overrideColor lets a multisensor's active-lens color drive the ring's
  // visuals when the ring is editing a single lens (e.g. cyan for Lens A).
  // Otherwise we use the per-object color (if assigned) before the category.
  const tone = overrideColor ?? deviceTone(d);
  const R = 34;
  const rad = (d.rot * Math.PI) / 180;
  const handleX = d.x + Math.cos(rad) * R;
  const handleY = d.y + Math.sin(rad) * R;
  const dragging = useRef(false);

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* capture optional */ }
    dragging.current = true;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    // Same fix that landed for ConeHandles: convert client (CSS px) →
    // SVG canvas coords by subtracting pan BEFORE dividing by zoom. Without
    // this, rotating a camera while the canvas is panned snaps the heading
    // to a wrong angle proportional to the pan offset.
    const cx = ((e.clientX - r.left) - pan.x) / zoom;
    const cy = ((e.clientY - r.top)  - pan.y) / zoom;
    const ang = Math.round((Math.atan2(cy - d.y, cx - d.x) * 180) / Math.PI);
    onRotate(((ang % 360) + 360) % 360);
  };
  const onUp = (e: React.PointerEvent) => {
    dragging.current = false;
    try {
      const el = e.currentTarget as Element;
      if ('hasPointerCapture' in el && el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    } catch { /* never captured */ }
  };

  return (
    <g pointerEvents="none">
      {/* outer ring — drag anywhere on the ring to rotate */}
      <circle cx={d.x} cy={d.y} r={R} fill="none" stroke={tone} strokeWidth="1" opacity="0.35" />
      <circle cx={d.x} cy={d.y} r={R} fill="none" stroke={tone} strokeWidth="6" opacity="0.001" pointerEvents="stroke"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ cursor: 'grab' }}
      />
      {/* tick marks every 30° */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = d.x + Math.cos(a) * (R - 2);
        const y1 = d.y + Math.sin(a) * (R - 2);
        const x2 = d.x + Math.cos(a) * (R + 2);
        const y2 = d.y + Math.sin(a) * (R + 2);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={tone} strokeWidth="0.6" opacity="0.5" />;
      })}
      {/* heading badge above the device */}
      <g transform={`translate(${d.x}, ${d.y - R - 10})`}>
        <rect x={-16} y={-7} width={32} height={14} rx={3} fill="var(--panel-background)" fillOpacity="0.85" stroke={tone} strokeWidth="0.6" />
        <text x={0} y={3} textAnchor="middle" fill="var(--foreground)" fontSize="10" fontWeight="700" fontFamily="ui-monospace, monospace">{d.rot}°</text>
      </g>
      {/* drag handle on the ring — slightly larger glow ring + the same
          .dv-cone-handle hover affordance so all draggable handles
          read consistently. */}
      <g pointerEvents="auto" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} className="dv-cone-handle" style={{ cursor: 'grab' }}>
        <circle cx={handleX} cy={handleY} r={7} fill={tone} opacity="0.22" />
        <circle cx={handleX} cy={handleY} r={3.6} fill={tone} stroke="var(--canvas-background)" strokeWidth="1.1" />
      </g>
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DEVICE GLYPHS — each looks like the physical hardware (top-down)
   ═══════════════════════════════════════════════════════════════════════ */

// DEVICE_ICON moved to canvas/devices/IsoDeviceBadge.tsx where its
// only consumer (IsoDeviceBadge) also lives. Re-imported at top of file
// for any in-monolith reference that still touches it.

// Modern device chip — used in InsertDock cards, layer rows, drag ghost, etc.
// Axis Site Designer-style minimal marker — white circle with thin colored ring and line glyph
// HardwareGlyph — Axis Site Designer style. Single-tone line glyphs drawn
// directly on the plan: no card backgrounds, no fills beyond the tone, no shading.
// Each device type reads as a tiny technical drawing of the actual hardware.

// KIND_INITIAL retained — referenced by other in-monolith components.
const KIND_INITIAL: Record<DeviceKind, string> = {
  camera: 'C', access: 'A', network: 'N', intrusion: '!',
  audio: '♪', storage: 'R', display: '▢', power: '⚡', sensor: '°', infrastructure: '◰',
  cyber: '⌬', fire: '!', building: '◧',
};

// IsoDeviceBadge moved to canvas/devices/IsoDeviceBadge.tsx (M11
// monolith breakup). Import at top of file.

// DeviceGlyph moved to canvas/devices/DeviceGlyph.tsx (M11 monolith
// breakup). Import at top of file.

// SVG path version kept for use inside the canvas SVG layer (presence cursors etc.)
// Kept as a no-op fallback in case anything still references it.
