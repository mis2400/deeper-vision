// ConeHandles — extracted from screens/EngineeringCanvas.tsx as part
// of the M11 monolith breakup. Direct-manipulation handles attached
// to a coverage cone (V3 Pass 2 Part 1, Axis-style three-handle
// adjustment).
//
// Three handles, all on the cone fan:
//   1. ROTATE  small puck midway along the aim line. Drag angularly
//              around the camera center to spin the whole fan.
//              Writes to rot. Shown only when onRotate is passed
//              (single-lens cameras); multisensors keep their drawer
//              chip per-lens rotation editing.
//   2. FOV     two edge handles at the cone's outside arc. Drag to
//              widen/narrow the aperture.
//   3. RANGE   tip handle at the apex. Drag radially to extend or
//              shorten reach.
//
// All math goes through pxToFt (the per-floor calibration) end to
// end: handle positions, drag math, the consolidated readout chip
// below the marker all derive from the real calibration. Handles
// write through onUpdate / onRotate, which the caller wires to
// onUpdateDevice so values persist via the Zustand store.
//
// Pure module — no closures on EngineeringCanvas state. Takes the
// svgRef, zoom, pan, color, callbacks, and planBounds as props.

import { useEffect, useRef, useState } from 'react';

export function ConeHandles({ cx, cy, rotDeg, fovDeg, rangeFt, pxToFt, svgRef, zoom, pan, color, onUpdate, onRotate, planBounds }: {
  cx: number; cy: number;
  rotDeg: number; fovDeg: number; rangeFt: number;
  pxToFt: number;
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  pan: { x: number; y: number };
  color: string;
  onUpdate: (patch: { fov?: number; range?: number }) => void;
  /** When provided, the rotation puck renders and drives rot writes.
   *  Single-lens cameras pass this; multisensors leave it undefined so
   *  the cone keeps its per-lens rotation editing in the drawer. */
  onRotate?: (rotDeg: number) => void;
  /** Audit Group B.4 (second pass) — plan bounds for clamping the
   *  handle VISUAL positions to stay inside the plan. The drag math
   *  still reads cursor position and computes range/FOV from the
   *  underlying geometry, so the handle remains fully functional;
   *  only where it RENDERS is clamped. Without this, multisensor
   *  lens handles drifted outside the plan rectangle (the cones
   *  themselves were clipped, but the handle dots stayed at the
   *  geometric cone tip and edges). */
  planBounds?: { x: number; y: number; w: number; h: number } | null;
}) {
  // SC.7.1: handle positions follow the calibrated cone — without the
  // fix, dragging the tip on a calibrated floor moved the handle to the
  // wrong distance because the visual cone and the handle math used
  // different scales.
  const r = rangeFt / pxToFt;
  const half = fovDeg / 2;
  const aMid = (rotDeg * Math.PI) / 180;
  const a1 = ((rotDeg - half) * Math.PI) / 180;
  const a2 = ((rotDeg + half) * Math.PI) / 180;
  // Audit Group B.4 (second pass) — clamp a (x, y) point to the plan
  // rect inset by 6 ft so the handle dot is visibly inside the plan
  // edge. Walks back along the camera-to-point ray until inside; if
  // the camera itself is outside, returns the camera position.
  const clampToPlan = (px: number, py: number): { x: number; y: number } => {
    if (!planBounds) return { x: px, y: py };
    const insetFt = 6;
    const insetPx = pxToFt > 0 ? insetFt / pxToFt : 60;
    const minX = planBounds.x + insetPx;
    const minY = planBounds.y + insetPx;
    const maxX = planBounds.x + planBounds.w - insetPx;
    const maxY = planBounds.y + planBounds.h - insetPx;
    if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
      return { x: px, y: py };
    }
    const dx = px - cx;
    const dy = py - cy;
    let t = 0.99;
    while (t > 0) {
      const x = cx + dx * t;
      const y = cy + dy * t;
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) return { x, y };
      t -= 0.01;
    }
    return { x: cx, y: cy };
  };
  const tipRaw = { x: cx + Math.cos(aMid) * r, y: cy + Math.sin(aMid) * r };
  const tipC = clampToPlan(tipRaw.x, tipRaw.y);
  const tipX = tipC.x;
  const tipY = tipC.y;
  const e1Raw = { x: cx + Math.cos(a1) * r * 0.92, y: cy + Math.sin(a1) * r * 0.92 };
  const e1C = clampToPlan(e1Raw.x, e1Raw.y);
  const e1X = e1C.x;
  const e1Y = e1C.y;
  const e2Raw = { x: cx + Math.cos(a2) * r * 0.92, y: cy + Math.sin(a2) * r * 0.92 };
  const e2C = clampToPlan(e2Raw.x, e2Raw.y);
  const e2X = e2C.x;
  const e2Y = e2C.y;
  // Rotation puck — midway along the aim line. Far enough from the
  // marker not to occlude it, close enough to the marker that the
  // operator's intuition reads "rotate around the camera" rather than
  // "extend the range."
  const rotPuckR = Math.max(14, Math.min(r * 0.45, r - 10));
  const rotPRaw = { x: cx + Math.cos(aMid) * rotPuckR, y: cy + Math.sin(aMid) * rotPuckR };
  const rotPC = clampToPlan(rotPRaw.x, rotPRaw.y);
  const rotPX = rotPC.x;
  const rotPY = rotPC.y;

  // Track which handle is being dragged so the live readout can
  // emphasize the active value. Cleared on pointer-up.
  const [dragMode, setDragMode] = useState<null | 'rot' | 'fov' | 'range'>(null);

  const startDrag = (mode: 'rot' | 'fov' | 'range', apply: (cx: number, cy: number) => void) => (e: React.PointerEvent) => {
    e.stopPropagation();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* capture optional */ }
    setDragMode(mode);
    const onMove = (ev: PointerEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      // Convert client (viewport-CSS-px) → SVG canvas coords. Must subtract
      // the active pan offset before dividing by zoom, otherwise dragging a
      // FOV/range handle while the canvas is panned makes the handle "shoot
      // forward" by exactly the pan distance.
      apply(((ev.clientX - rect.left) - pan.x) / zoom, ((ev.clientY - rect.top) - pan.y) / zoom);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragMode(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onTipDown = startDrag('range', (mx, my) => {
    const dist = Math.hypot(mx - cx, my - cy);
    // SC.7.1: pixels → feet via the calibrated per-floor scale so the
    // tip drag yields the correct range. Was dividing by 3.83 px/ft.
    onUpdate({ range: Math.max(5, Math.min(150, Math.round(dist * pxToFt))) });
  });
  const onEdgeDown = startDrag('fov', (mx, my) => {
    // FOV = 2 × shortest absolute angle between cursor heading and cone center
    const ang = (Math.atan2(my - cy, mx - cx) * 180) / Math.PI;
    let delta = Math.abs(((ang - rotDeg + 180) % 360) - 180);
    if (delta < 0) delta = -delta;
    onUpdate({ fov: Math.max(10, Math.min(360, Math.round(delta * 2))) });
  });
  const onRotDown = startDrag('rot', (mx, my) => {
    if (!onRotate) return;
    // Convert cursor angle to degrees in the canvas convention (atan2
    // returns radians from +X). Normalize to 0..360 so persisted rot
    // stays in the expected range; rounding to whole degrees keeps the
    // store from accumulating sub-degree noise on every move event.
    const angDeg = (Math.atan2(my - cy, mx - cx) * 180) / Math.PI;
    const norm = ((Math.round(angDeg) % 360) + 360) % 360;
    onRotate(norm);
  });

  // Pixels-per-foot for the readout chip (more readable than ft/px
  // for surveyors thinking in plan terms). pxToFt is ft/px upstream.
  const ppf = pxToFt > 0 ? 1 / pxToFt : 0;
  const showReadout = dragMode !== null;
  // Vertical offset for the readout chip below the marker. Stays
  // outside the cone bounding box even when rangeFt is small.
  const chipY = cy + 26;

  return (
    <g pointerEvents="auto">
      {/* Range (tip) handle — drag along cone axis to extend / shorten. */}
      <g onPointerDown={onTipDown} className="dv-cone-handle" style={{ cursor: 'ew-resize' }}>
        <circle cx={tipX} cy={tipY} r={8} fill={color} opacity="0.22" />
        <circle cx={tipX} cy={tipY} r={3.6} fill={color} stroke="var(--canvas-background)" strokeWidth="1.1" />
      </g>
      {/* Edge (FOV) handles — drag to widen / narrow the aperture. */}
      <g onPointerDown={onEdgeDown} className="dv-cone-handle" style={{ cursor: 'crosshair' }}>
        <circle cx={e1X} cy={e1Y} r={7} fill={color} opacity="0.22" />
        <circle cx={e1X} cy={e1Y} r={3.1} fill={color} stroke="var(--canvas-background)" strokeWidth="0.85" />
      </g>
      <g onPointerDown={onEdgeDown} className="dv-cone-handle" style={{ cursor: 'crosshair' }}>
        <circle cx={e2X} cy={e2Y} r={7} fill={color} opacity="0.22" />
        <circle cx={e2X} cy={e2Y} r={3.1} fill={color} stroke="var(--canvas-background)" strokeWidth="0.85" />
      </g>
      {/* Rotation puck — only mounted when the caller has wired
          onRotate. Item 5: the handle now carries an explicit rotate
          icon (circular arrow with a small aim chevron pointing
          along the cone direction) so its purpose is obvious. Inner
          card is filled in the cone's `color` for a vivid affordance
          against the canvas. */}
      {onRotate && (
        <g onPointerDown={onRotDown} className="dv-cone-handle" style={{ cursor: 'grab' }}>
          {/* Touch target — generous radius so the puck is easy to
              grab; transparent fill so it doesn't compete visually. */}
          <circle cx={rotPX} cy={rotPY} r={10} fill={color} fillOpacity="0.20" />
          {/* Filled card — gives the icon a high contrast plate. */}
          <circle cx={rotPX} cy={rotPY} r={6.5} fill="var(--canvas-background)" stroke={color} strokeWidth="1.4" />
          {/* Rotate icon — circular arrow with an arrowhead. Drawn at
              fixed canvas size (6.5 px card radius), so it stays a
              clear glyph at every zoom. The chevron at the end of
              the arc reads as "rotate". */}
          <g pointerEvents="none">
            <path
              d={`M ${rotPX - 3.2} ${rotPY + 0.4}
                  A 3.2 3.2 0 1 1 ${rotPX + 0.6} ${rotPY + 3.1}`}
              fill="none"
              stroke={color}
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <path
              d={`M ${rotPX + 0.6} ${rotPY + 3.1}
                  L ${rotPX - 0.9} ${rotPY + 3.3}
                  M ${rotPX + 0.6} ${rotPY + 3.1}
                  L ${rotPX + 1.6} ${rotPY + 1.6}`}
              fill="none"
              stroke={color}
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Aim chevron — small triangle pointing along the cone's
                center direction. Reinforces the "this rotates the
                cone direction" mental model. */}
            <polygon
              points={`
                ${rotPX + Math.cos(aMid) * 4.0},${rotPY + Math.sin(aMid) * 4.0}
                ${rotPX + Math.cos(aMid + 2.5) * 2.0},${rotPY + Math.sin(aMid + 2.5) * 2.0}
                ${rotPX + Math.cos(aMid - 2.5) * 2.0},${rotPY + Math.sin(aMid - 2.5) * 2.0}
              `}
              fill={color}
              opacity="0.65"
            />
          </g>
        </g>
      )}
      {/* Consolidated live readout — single chip below the marker
          showing rot · fov · range · px/ft. The currently-dragged
          value is bright; the others stay quiet. Only visible during
          a drag to avoid permanent chrome on a calm canvas. */}
      {showReadout && (
        <g transform={`translate(${cx}, ${chipY})`} pointerEvents="none">
          <rect
            x={-72} y={-9} width={144} height={16} rx={3}
            fill="var(--panel-background)" fillOpacity="0.95"
            stroke={color} strokeWidth="0.7"
          />
          <text
            textAnchor="middle" y={2.5} fontSize="9" fontWeight="600"
            fill={color} fontFamily="ui-monospace, monospace"
          >
            <tspan opacity={dragMode === 'rot' ? 1 : 0.5}>{Math.round(rotDeg)}°</tspan>
            <tspan opacity={0.35}>{'  ·  '}</tspan>
            <tspan opacity={dragMode === 'fov' ? 1 : 0.5}>{Math.round(fovDeg)}° fov</tspan>
            <tspan opacity={0.35}>{'  ·  '}</tspan>
            <tspan opacity={dragMode === 'range' ? 1 : 0.5}>{Math.round(rangeFt)} ft</tspan>
            <tspan opacity={0.35}>{'  ·  '}</tspan>
            <tspan opacity={0.5}>{ppf.toFixed(1)} px/ft</tspan>
          </text>
        </g>
      )}
    </g>
  );
}
