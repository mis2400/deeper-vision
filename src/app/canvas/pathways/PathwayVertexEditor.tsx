// PathwayVertexEditor — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Per-vertex drag handles + segment-insert "+"
// affordance + Delete/Backspace removal for the SELECTED
// pathway only. Mounted inside the canvas SVG content group
// (so it inherits the `translate(pan) scale(zoom)` transform
// and works in canvas coords), AFTER the device loop (so
// handles paint above both pathways and devices). Renders
// nothing when no pathway is selected.

import { useCallback, useEffect, useRef, useState } from 'react';
import { pathwayLengthFt } from '../../lib/engineering';
import { useProjectStore } from '../../store/projectStore';

export function PathwayVertexEditor({
  pathwayId, svgRef, zoom, pan, snap, pxToFt,
}: {
  pathwayId: string;
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  pan: { x: number; y: number };
  /** Honors the TopBar Snap toggle. When true, drag and insert snap to
   *  the project's canvas-wide 20 px (= 1 ft) grid — matches the wall
   *  + cable draw + click-to-arm snap behaviour used elsewhere. */
  snap: boolean;
  /** Calibrated feet-per-pixel for the active floor. Drives the live
   *  X / Y readout shown next to the dragging vertex. */
  pxToFt: number;
}) {
  const pathway = useProjectStore((s) => (s.pathways as any)[pathwayId]);
  const floors = useProjectStore((s) => s.floors);
  const updatePathway = useProjectStore((s) => s.updatePathway);
  // Hovered vertex (for the delete-key affordance + active-vertex
  // emphasis). Drag state lives in a ref because we don't need to
  // re-render the world on every pointermove — store updates already
  // cause the polyline to re-paint.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverSeg, setHoverSeg] = useState<number | null>(null);
  // Live cursor position projected onto the hovered segment. Drives the
  // "+" insert glyph so it tracks the cursor and lands exactly where
  // the user is pointing instead of snapping to the segment midpoint.
  // Coordinates are in canvas-space (pan-stripped).
  const [insertPt, setInsertPt] = useState<{ x: number; y: number } | null>(null);
  // Set during an active drag so we can paint the active vertex with
  // stronger visual weight and surface a small X / Y readout.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragRef = useRef<{ idx: number } | null>(null);

  // Always read the latest pathway from the store via the ref pattern so
  // the drag handler doesn't close over stale points. (The component
  // already re-renders on every store change, but the ref keeps the
  // pointermove math correct between renders.)
  const pathwayRef = useRef(pathway);
  useEffect(() => { pathwayRef.current = pathway; }, [pathway]);
  // Snap also lives in a ref so the pointermove handler always reads the
  // current value even if the user toggles Snap mid-drag.
  const snapRef = useRef(snap);
  useEffect(() => { snapRef.current = snap; }, [snap]);

  // Convert screen-space (client) → canvas coords. Matches the same
  // pan-aware formula `ConeHandles` and `RotationRing` use after the
  // direct-manipulation pass.
  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return null;
    return {
      x: ((clientX - r.left) - pan.x) / zoom,
      y: ((clientY - r.top)  - pan.y) / zoom,
    };
  }, [svgRef, pan.x, pan.y, zoom]);

  // 20 px = 1 ft is the project-wide canvas grid (same constant the wall
  // tool, cable draw, and click-to-arm placement use). Centralising it
  // here keeps the snap step consistent and easy to retune.
  const SNAP_PX = 20;
  const applySnap = useCallback((p: { x: number; y: number }) => (
    snapRef.current ? { x: Math.round(p.x / SNAP_PX) * SNAP_PX, y: Math.round(p.y / SNAP_PX) * SNAP_PX } : p
  ), []);

  // Project a point onto the segment a→b, clamped to the endpoints. We
  // use this for cursor-tracked insert ("+" appears at the nearest point
  // on the segment under the cursor instead of the midpoint). The clamp
  // keeps the insert glyph from ever leaving the segment if the cursor
  // strays into the hit-zone padding.
  const projectOnSegment = useCallback((p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) return { x: a.x, y: a.y };
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + dx * t, y: a.y + dy * t };
  }, []);

  // Compute the new length (ft) for a candidate points array. Used to
  // refresh `lengthFt` after a drag/insert/delete so the drawer + BOM
  // pick up the new total immediately — `pathwayLengthFt` short-circuits
  // on a stored `lengthFt > 0`, so we must overwrite it.
  const recomputeLengthFt = useCallback((pts: { x: number; y: number }[]) => {
    if (!pathway) return 0;
    const floor = floors[pathway.floorId ?? ''];
    return pathwayLengthFt({ points: pts }, floor);
  }, [floors, pathway]);

  // Vertex drag: pointerdown captures, pointermove writes new points to
  // the store, pointerup commits final lengthFt. The pointer-capture is
  // installed on the dragged handle's <g> so subsequent move/up events
  // continue to fire even if the cursor leaves the handle. When Snap is
  // active the moved point lands on the project grid.
  const onVertexDown = (idx: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch {}
    dragRef.current = { idx };
    setDragIdx(idx);
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const p = screenToCanvas(ev.clientX, ev.clientY);
      if (!p) return;
      const cur = pathwayRef.current;
      if (!cur || !Array.isArray(cur.points)) return;
      const snapped = applySnap(p);
      const next = cur.points.map((pt: any, i: number) => i === dragRef.current!.idx ? { x: snapped.x, y: snapped.y } : pt);
      updatePathway(pathwayId, { points: next, lengthFt: recomputeLengthFt(next) } as any);
    };
    const onUp = () => {
      dragRef.current = null;
      setDragIdx(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Segment-insert: the "+" follows the cursor's projection onto the
  // hovered segment; click splices a new vertex at that exact point.
  // Honors Snap so the new vertex lands on the grid when the toggle is
  // on. Falls back to the segment midpoint if the cursor hasn't
  // produced a fresh projection yet (e.g. headless test that only
  // dispatches pointerover without a follow-up move).
  const onInsertSegment = (segIdx: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const cur = pathwayRef.current;
    if (!cur || !Array.isArray(cur.points) || segIdx < 0 || segIdx >= cur.points.length - 1) return;
    const a = cur.points[segIdx];
    const b = cur.points[segIdx + 1];
    const fallbackMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // If the cursor delivered coordinates via pointermove, use the
    // projected point; otherwise fall back to the midpoint. Both paths
    // go through applySnap so the insert respects the toggle.
    const cursorCanvas = screenToCanvas(e.clientX, e.clientY);
    const raw = cursorCanvas ? projectOnSegment(cursorCanvas, a, b) : (insertPt ?? fallbackMid);
    const snapped = applySnap(raw);
    const next = [...cur.points.slice(0, segIdx + 1), snapped, ...cur.points.slice(segIdx + 1)];
    updatePathway(pathwayId, { points: next, lengthFt: recomputeLengthFt(next) } as any);
    setHoverIdx(segIdx + 1);
    setInsertPt(null);
  };

  // Track cursor → segment projection while hovering. We attach a
  // pointermove on each segment hit-zone so the "+" follows the cursor
  // smoothly. Clearing on pointerleave avoids stale projections.
  const onSegmentMove = (segIdx: number) => (e: React.PointerEvent) => {
    const cur = pathwayRef.current;
    if (!cur || !Array.isArray(cur.points) || segIdx < 0 || segIdx >= cur.points.length - 1) return;
    const p = screenToCanvas(e.clientX, e.clientY);
    if (!p) return;
    setInsertPt(projectOnSegment(p, cur.points[segIdx], cur.points[segIdx + 1]));
  };

  // Delete the currently-hovered vertex on Backspace/Delete, gated to
  // keep the pathway at ≥2 points (anything less is no longer a
  // pathway). No-op if no vertex is hovered.
  useEffect(() => {
    if (hoverIdx == null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const cur = pathwayRef.current;
      if (!cur || !Array.isArray(cur.points) || cur.points.length <= 2) return;
      e.preventDefault();
      const next = cur.points.filter((_: any, i: number) => i !== hoverIdx);
      updatePathway(pathwayId, { points: next, lengthFt: recomputeLengthFt(next) } as any);
      setHoverIdx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hoverIdx, pathwayId, updatePathway, recomputeLengthFt]);

  if (!pathway || !Array.isArray(pathway.points) || pathway.points.length < 2) return null;
  const isConduitPath = pathway.pathwayKind && pathway.pathwayKind !== 'cable';
  const handleTone = isConduitPath ? '#A371F7' : '#22D3EE';

  return (
    <g data-testid={`pathway-vertices-${pathwayId}`}>
      {/* Segment-insert "+" affordances. One per segment, only visible
          when the user hovers that segment's invisible hit-zone. The
          hit-zone is a transparent thick stroke aligned to each segment;
          the visible "+" tracks the cursor's nearest projection onto
          the segment so it lands where you click — not at a fixed
          midpoint. Falls back to the segment midpoint until the first
          pointermove delivers a projected point. */}
      {pathway.points.slice(0, -1).map((a: any, i: number) => {
        const b = pathway.points[i + 1];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const visible = hoverSeg === i;
        const liveInsert = visible && insertPt
          ? applySnap(insertPt)
          : applySnap(mid);
        return (
          <g key={`seg-${i}`}>
            {/* Hit-zone catches the hover even when the cursor isn't
                exactly on the polyline. We DON'T set cursor:copy here
                unless the segment is active so unrelated pan/select
                interactions stay clean. */}
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="transparent" strokeWidth={14}
              pointerEvents="stroke"
              onPointerEnter={() => setHoverSeg(i)}
              onPointerMove={onSegmentMove(i)}
              onPointerLeave={() => { setHoverSeg((s) => s === i ? null : s); setInsertPt(null); }}
              style={{ cursor: visible ? 'copy' : 'default' }}
            />
            {visible && (
              <g
                transform={`translate(${liveInsert.x}, ${liveInsert.y})`}
                onPointerDown={onInsertSegment(i)}
                onPointerEnter={() => setHoverSeg(i)}
                onPointerMove={onSegmentMove(i)}
                style={{ cursor: 'copy' }}
                data-testid={`pathway-segment-insert-${pathwayId}-${i}`}
              >
                <circle r={6} fill={handleTone} opacity="0.22" />
                <circle r={4} fill={handleTone} stroke="var(--canvas-background)" strokeWidth={0.9} />
                <line x1={-2.2} y1={0} x2={2.2} y2={0} stroke="var(--canvas-background)" strokeWidth="0.9" />
                <line x1={0} y1={-2.2} x2={0} y2={2.2} stroke="var(--canvas-background)" strokeWidth="0.9" />
              </g>
            )}
          </g>
        );
      })}

      {/* Vertex drag handles. Render after segment hits so a hover on
          the vertex wins over the segment hover. Small + precise, with
          a hover-bumped glow ring (the .dv-cone-handle CSS rule already
          adds this transition). The active/dragging vertex paints with
          a stronger outline and surfaces a small X / Y HUD above it. */}
      {pathway.points.map((p: any, i: number) => {
        const isHover = hoverIdx === i;
        void isHover;
        const isActive = dragIdx === i || hoverIdx === i;
        const isDragging = dragIdx === i;
        return (
          <g
            key={`vert-${i}`}
            className="dv-cone-handle"
            onPointerDown={onVertexDown(i)}
            onPointerEnter={() => setHoverIdx(i)}
            onPointerLeave={() => setHoverIdx((c) => c === i ? null : c)}
            style={{ cursor: 'grab' }}
            data-testid={`pathway-vertex-${pathwayId}-${i}`}
          >
            <circle cx={p.x} cy={p.y} r={isActive ? 8.5 : 6} fill={handleTone} opacity={isActive ? 0.32 : 0.22} />
            <circle
              cx={p.x} cy={p.y}
              r={isActive ? 4.2 : 3.2}
              fill={handleTone}
              stroke="var(--canvas-background)"
              strokeWidth={isActive ? 1.3 : 0.9}
            />
            {isDragging && (
              <g transform={`translate(${p.x}, ${p.y - 16})`} pointerEvents="none" data-testid={`pathway-vertex-hud-${pathwayId}-${i}`}>
                <rect x={-26} y={-7} width={52} height={13} rx={2} fill="var(--panel-background)" fillOpacity="0.94" stroke={handleTone} strokeWidth="0.6" />
                <text textAnchor="middle" y={2.5} fontSize="9" fontWeight="600" fill={handleTone} fontFamily="ui-monospace, monospace">
                  {(p.x * pxToFt).toFixed(1)} · {(p.y * pxToFt).toFixed(1)} ft
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
