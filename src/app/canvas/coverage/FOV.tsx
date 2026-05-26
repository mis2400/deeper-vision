// FOV + FovCone — extracted from screens/EngineeringCanvas.tsx as
// part of the M11 monolith breakup. The largest pure-render unit
// inside the canvas: a single device's coverage cone, with all the
// DORI band math, multisensor 4-lens branch, room-polygon clipping,
// plan-bounds clipping, lens marker badges, and edge/aim strokes.
//
// FOV is the public component; FovCone is the helper that renders
// one wedge (used by both the single-lens path and each of the four
// multisensor lens cones).
//
// Pure module — no closures on EngineeringCanvas state. Inputs:
//   d                 Device shape (incl. multisensor lens config)
//   pxToFt            per-floor calibration
//   mode              CoverageMode (minimal / soft / tactical / heatmap
//                     / wireframe / presentation / night)
//   dim               sibling-fade multiplier
//   selected          whether this device is the active selection
//   activeLens        lens slot (a/b/c/d/all) currently being edited
//   hoveredLens       lens currently hovered in the drawer chip row
//   emphasizedDoriLevel  band the inspector wants emphasised
//   roomPolygon       active room polygon for the cone-clip
//   planBounds        floorplan rect for the fallback clip

import {
  CoverageMode, DORI_BASE_OPACITY, DORI_LABEL, DoriLevel,
  doriBandsFor,
} from './dori';
import { cameraResolution } from './resolution';
import { LENS_LABEL, LENS_TONE } from '../constants';
import type { ActiveLens, Device, LensId } from '../types';
import { deviceTone, getCoverageBandMultiplier, getLenses } from '../utils';

/** Render one wedge-shaped FOV cone given absolute world rotation + fov + range
 *  in feet. Used by both the single-lens FOV branch and the multisensor 4-lens
 *  branch so the visuals stay identical. */
export function FovCone({
  cx, cy, rotDeg, fovDeg, rangeFt, pxToFt, color, opacity, wireframe, label, telemetry, planBounds,
}: { cx: number; cy: number; rotDeg: number; fovDeg: number; rangeFt: number; pxToFt: number; color: string; opacity: number; wireframe: boolean; label?: string; telemetry?: string; planBounds?: { x: number; y: number; w: number; h: number } | null }) {
  // SC.7.1: convert range from feet to pixels using the per-floor
  // calibrated scale (ftPerPxForFloor falls back to 0.05 ft/px when
  // the floor has no calibratedAt). Was a hardcoded 3.83 px/ft.
  const r = rangeFt / pxToFt;
  const half = fovDeg / 2;
  const a1 = ((rotDeg - half) * Math.PI) / 180;
  const a2 = ((rotDeg + half) * Math.PI) / 180;
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const x2 = cx + Math.cos(a2) * r;
  const y2 = cy + Math.sin(a2) * r;
  const large = half > 90 ? 1 : 0;
  const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  // tip of the cone (used to anchor the small telemetry chip).
  // Audit Group B.1 — when a planBounds rect is supplied AND the
  // natural tip falls outside (plan + 20 ft margin), project the tip
  // back along the aim ray to the boundary. Without this clamp,
  // multisensor lens-letter chips (A/B/C/D) drifted onto the bare
  // canvas outside the floorplan for any lens whose range exceeded
  // the room. Math and density chain stay identical.
  const rawTipX = cx + Math.cos((rotDeg * Math.PI) / 180) * r;
  const rawTipY = cy + Math.sin((rotDeg * Math.PI) / 180) * r;
  const tipClamped = (() => {
    if (!planBounds) return { x: rawTipX, y: rawTipY, clamped: false };
    // Audit Group B.1 — marker labels clamp to the plan rect with a
    // small 4 ft inset so the label badge sits visibly INSIDE the
    // floorplan polygon, not on its edge. The cone's own clipPath
    // still uses the 20 ft margin for breathing room on exterior
    // coverage, but lens letter chips are decorative and shouldn't
    // float into the bare canvas.
    const insetFt = 4;
    const insetPx = pxToFt > 0 ? insetFt / pxToFt : 40;
    const minX = planBounds.x + insetPx;
    const minY = planBounds.y + insetPx;
    const maxX = planBounds.x + planBounds.w - insetPx;
    const maxY = planBounds.y + planBounds.h - insetPx;
    if (rawTipX >= minX && rawTipX <= maxX && rawTipY >= minY && rawTipY <= maxY) {
      return { x: rawTipX, y: rawTipY, clamped: false };
    }
    // Walk back from rawTip along the aim ray (toward cx, cy) until
    // we're inside the bounds. Step by 1% of r each iteration; small
    // enough to land precisely on the boundary, fast enough to never
    // hit a perf wall (max 100 iterations).
    let t = 0.99;
    while (t > 0) {
      const px = cx + Math.cos((rotDeg * Math.PI) / 180) * r * t;
      const py = cy + Math.sin((rotDeg * Math.PI) / 180) * r * t;
      if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
        return { x: px, y: py, clamped: true };
      }
      t -= 0.01;
    }
    return { x: cx, y: cy, clamped: true };
  })();
  const tipX = tipClamped.x;
  const tipY = tipClamped.y;
  // Per-cone radial gradient — saturated at the lens (cx, cy) and fading to
  // zero at the cone's outer arc. Gives the cinematic "vapor at the edge"
  // depth instead of the flat SVG-ish fill that read as decorative. The id
  // encodes color+position+range so two cones never share a gradient.
  const gid = `cone-${color.replace('#', '')}-${Math.round(cx)}-${Math.round(cy)}-${Math.round(r)}-${Math.round(rotDeg)}-${Math.round(fovDeg)}`;
  return (
    <g opacity={opacity}>
      <defs>
        {/* M11 cone redesign — three-stop wash with a brighter lens core
            and a soft outer falloff. Reads as a deliberate engineering
            coverage zone rather than a flat spotlight or a washed-out
            tint. Multi-cone overlap composites cleanly because the
            falloff is exponential, not linear. */}
        <radialGradient id={gid} cx={cx} cy={cy} r={r} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={color} stopOpacity="0.34" />
          <stop offset="35%"  stopColor={color} stopOpacity="0.18" />
          <stop offset="70%"  stopColor={color} stopOpacity="0.08" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      {!wireframe && <path d={path} fill={`url(#${gid})`} />}
      {/* Edge stroke — defined draftsman line. Bumped opacity 0.30 → 0.55
          so the cone boundary reads at a glance instead of fading into
          the plan background. */}
      <path d={path} fill="none" stroke={color} strokeWidth={wireframe ? 0.9 : 0.7} opacity={wireframe ? 0.85 : 0.55} strokeLinejoin="round" />
      {/* DORI band rings — solid hairlines at 0.28 opacity. Dashed lines
          read as in-progress geometry; solid reads as the engineering
          callout this actually is. */}
      {!wireframe && [0.35, 0.6, 0.8].map((f) => {
        const rr = r * f;
        const xa = cx + Math.cos(a1) * rr;
        const ya = cy + Math.sin(a1) * rr;
        const xb = cx + Math.cos(a2) * rr;
        const yb = cy + Math.sin(a2) * rr;
        return (
          <path key={f} d={`M ${xa} ${ya} A ${rr} ${rr} 0 ${half > 90 ? 1 : 0} 1 ${xb} ${yb}`}
            fill="none" stroke={color} strokeWidth="0.5" opacity="0.28" />
        );
      })}
      {/* Lens core — small bright dot at the camera origin. Anchors the
          cone visually so the operator's eye finds the camera origin
          first, the coverage zone second. */}
      {!wireframe && (
        <>
          <circle cx={cx} cy={cy} r={3.2} fill={color} opacity="0.85" />
          <circle cx={cx} cy={cy} r={1.4} fill="#FFFFFF" opacity="0.85" />
        </>
      )}
      {label && (
        <g
          transform={`translate(${tipX}, ${tipY})`}
          pointerEvents="none"
          data-canvas-element="lens-marker"
          data-lens-label={label}
          data-lens-clamped={tipClamped.clamped ? 'true' : 'false'}
        >
          {/* M11 cone redesign — lens marker badge rebuilt with the
              canvas-rail token system so the chip reads as part of
              the same chrome language the rails use. White-on-dark in
              every theme, tighter typography, refined ring. */}
          <circle r={10} fill="var(--canvas-rail)" fillOpacity="0.96" stroke={color} strokeWidth="1.2" />
          <text textAnchor="middle" y={3.5} fontSize="11" fontWeight="700" fill="var(--canvas-rail-foreground)" fontFamily="ui-monospace, monospace">{label}</text>
          {telemetry && (
            <g transform="translate(0, 18)">
              <rect x={-30} y={-7} width={60} height={14} rx={4} fill="var(--canvas-rail)" fillOpacity="0.96" stroke="var(--canvas-rail-border)" strokeWidth="0.8" />
              <text textAnchor="middle" y={3} fontSize="10" fill="var(--canvas-rail-foreground-muted)" fontFamily="ui-monospace, monospace">{telemetry}</text>
            </g>
          )}
        </g>
      )}
    </g>
  );
}

export function FOV({ d, pxToFt, mode = 'soft', dim = 1, selected = false, activeLens = 'all', hoveredLens = null, emphasizedDoriLevel = null, roomPolygon = null, planBounds = null }: { d: Device; pxToFt: number; mode?: CoverageMode; dim?: number; selected?: boolean; activeLens?: ActiveLens; hoveredLens?: LensId | null; emphasizedDoriLevel?: DoriLevel | null; roomPolygon?: { x: number; y: number }[] | null; planBounds?: { x: number; y: number; w: number; h: number } | null }) {
  // Mode-driven render parameters. Tuned down for the ergonomics pass so
  // unselected coverage doesn't dominate the plan. Selected coverage
  // keeps a small 1.2× boost so it reads as clear without being loud —
  // pairs with the rotation ring + cone handles + selection halo to make
  // the active object unambiguous. Siblings additionally dim 0.28 via
  // the parent's `dim` factor (line ~5606), so contrast stays high.
  const opacity = (mode === 'minimal' ? 0.22 : mode === 'presentation' ? 0.5 : mode === 'tactical' ? 0.7 : mode === 'heatmap' ? 0.7 : mode === 'night' ? 0.42 : 0.55) * dim * (selected ? 1.2 : 1);
  const wireframe = mode === 'wireframe';
  const showArcs = mode !== 'minimal' && mode !== 'presentation';
  const showAim = mode === 'tactical' || mode === 'wireframe' || selected;

  // ── Multisensor branch — render four independent cones, one per lens. ──
  // Each cone carries its own rotation/fov/range and its own color. When the
  // device is selected and a specific lens is active, that lens cone gets
  // brighter stroke + a telemetry chip; the other three dim slightly so the
  // active one reads clearly.
  if (d.type === 'cam.multisensor') {
    const lenses = getLenses(d);
    // When the user is viewing all four lenses together (multisensor
    // selected, 'all' active), apply a soft screen blend so where two
    // cones overlap their colors add — visualizing the stitching and
    // overlap regions without any extra UI. This is the multisensor's
    // signature visual moment.
    const useScreenBlend = selected && activeLens === 'all' && !wireframe;
    // Item 6 + 8 — multisensor cones inherit the same clip priority as
    // the single-lens branch: room polygon when inside one, plan bounds
    // + 20 ft margin otherwise, unclipped if neither is available.
    const msUseRoom = !!(roomPolygon && roomPolygon.length >= 3);
    const msUsePlan = !msUseRoom && !!planBounds;
    const msClipId = msUseRoom
      ? `cone-room-ms-${d.id}`
      : msUsePlan
        ? `cone-plan-ms-${d.id}`
        : null;
    // Group A.3 (second pass) — multisensor cones clip with 0 margin
    // so coverage stops at the plan rectangle, same rule as single-lens.
    const msPlanMarginPx = 0;
    const msClipPathD = msUseRoom
      ? roomPolygon!.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
      : msUsePlan && planBounds
        ? (() => {
            const x0 = planBounds.x - msPlanMarginPx;
            const y0 = planBounds.y - msPlanMarginPx;
            const x1 = planBounds.x + planBounds.w + msPlanMarginPx;
            const y1 = planBounds.y + planBounds.h + msPlanMarginPx;
            return `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
          })()
        : null;
    return (
      <g style={useScreenBlend ? { mixBlendMode: 'screen' } : undefined}>
        {msClipId && msClipPathD && (
          <defs>
            <clipPath id={msClipId} clipPathUnits="userSpaceOnUse">
              <path d={msClipPathD} />
            </clipPath>
          </defs>
        )}
        <g clipPath={msClipId ? `url(#${msClipId})` : undefined}>
        {(['a', 'b', 'c', 'd'] as const).map((k) => {
          const L = lenses[k];
          if (!L.enabled) return null;
          const isActive = selected && (activeLens === k || activeLens === 'all');
          const isHovered = selected && hoveredLens === k;
          // Lens rotation is relative to the multisensor body — adding d.rot
          // lets the user rotate the whole device while preserving the
          // cardinal spread between lenses.
          const absRot = ((L.rotation + d.rot) % 360 + 360) % 360;
          // When a lens chip is being hovered, lift its corresponding
          // cone slightly and dim the others — so the user can visually
          // pair "this chip" → "that cone" without any explanation.
          // Non-active multisensor lens cones drop further so the active
          // lens reads as the "selected" one. Hovered chip pops a touch.
          let coneOpacity = opacity * (selected && activeLens !== 'all' && activeLens !== k ? 0.22 : 1);
          if (selected && hoveredLens) {
            coneOpacity = opacity * (isHovered ? 1.1 : 0.18);
          }
          return (
            <FovCone
              key={`lens-${d.id}-${k}`}
              cx={d.x} cy={d.y}
              rotDeg={absRot}
              fovDeg={L.fov}
              rangeFt={L.range}
              pxToFt={pxToFt}
              color={LENS_TONE[k]}
              opacity={coneOpacity}
              wireframe={wireframe}
              label={isActive && selected ? LENS_LABEL[k] : undefined}
              telemetry={isActive && selected && activeLens === k ? `${Math.round(L.fov)}° · ${Math.round(L.range)}ft` : undefined}
              planBounds={planBounds}
            />
          );
        })}
        </g>
      </g>
    );
  }

  // ── Single-lens cameras (dome / bullet / ptz / fisheye / thermal / lpr) ──
  // SC.7.1: range → pixels via the calibrated per-floor scale instead of
  // the legacy 3.83 px/ft hardcode that made cones lie about coverage on
  // every calibrated background.
  const defaultRangeFt = d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30;
  const defaultFovDeg  = d.type === 'cam.ptz' ? 36 : d.type === 'cam.fisheye' ? 360 : 70;
  const rangeFt = d.range ?? defaultRangeFt;
  const fovDeg  = d.fov ?? defaultFovDeg;
  if (d.type === 'cam.fisheye' || fovDeg >= 350) {
    const rFish = (rangeFt / pxToFt) * 0.6; // fisheye effective radius is smaller (omni)
    return (
      <g opacity={opacity}>
        {!wireframe && <circle cx={d.x} cy={d.y} r={rFish} fill="url(#fov-grad-360)" />}
        <circle cx={d.x} cy={d.y} r={rFish} fill="none" stroke="#FF7B6B" strokeWidth={wireframe ? 0.8 : 0.6} opacity={wireframe ? 0.9 : 0.5} strokeDasharray="2 4" />
      </g>
    );
  }
  const r = rangeFt / pxToFt;
  const half = fovDeg / 2;
  const rot = d.rot;
  const a1 = ((rot - half) * Math.PI) / 180;
  const a2 = ((rot + half) * Math.PI) / 180;
  const x1 = d.x + Math.cos(a1) * r;
  const y1 = d.y + Math.sin(a1) * r;
  const x2 = d.x + Math.cos(a2) * r;
  const y2 = d.y + Math.sin(a2) * r;
  const large = half > 90 ? 1 : 0;
  const gradId = d.type === 'cam.ptz' ? 'fov-grad-ptz' : 'fov-grad';
  // Cone edge follows the per-object color if set, otherwise the theme's
  // cone-fixed / cone-ptz token so cones stay readable in every theme.
  const themeCone = d.type === 'cam.ptz' ? 'var(--cone-ptz)' : 'var(--cone-fixed)';
  const edge = d.color || themeCone;
  // Rotate gradient so its origin aligns with the lens and decays outward
  const path = `M ${d.x} ${d.y} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  // ── DORI band geometry (V3 Pass 2 Part 2). Honest engineering bands
  //    computed from the camera's resolution + the current fov/range/scale.
  //    If `resolution` is null (e.g. multi sensor or a camera without a
  //    catalog product) we render the legacy decorative arcs instead and
  //    surface a "set resolution" hint when the camera is selected, so the
  //    user knows the bands are skipped on purpose, not silently faked. */
  const resolution = cameraResolution(d);
  const bands = resolution && fovDeg < 180
    ? doriBandsFor({ fovDeg, rangeFt, resolution })
    : [];
  const tone = deviceTone(d);
  const showBands = bands.length > 0 && mode !== 'minimal';
  // Annular sector path — same angular span as the cone, between rIn and
  // rOut. When rIn collapses to 0 it degenerates to a plain wedge (the
  // identify band always starts at the lens). Geometry honors `large` so
  // wide-FOV cones still close correctly.
  const sectorPath = (rIn: number, rOut: number): string => {
    const xa1 = d.x + Math.cos(a1) * rOut;
    const ya1 = d.y + Math.sin(a1) * rOut;
    const xa2 = d.x + Math.cos(a2) * rOut;
    const ya2 = d.y + Math.sin(a2) * rOut;
    if (rIn <= 0.05) {
      return `M ${d.x} ${d.y} L ${xa1} ${ya1} A ${rOut} ${rOut} 0 ${large} 1 ${xa2} ${ya2} Z`;
    }
    const xb1 = d.x + Math.cos(a1) * rIn;
    const yb1 = d.y + Math.sin(a1) * rIn;
    const xb2 = d.x + Math.cos(a2) * rIn;
    const yb2 = d.y + Math.sin(a2) * rIn;
    return `M ${xb1} ${yb1} L ${xa1} ${ya1} A ${rOut} ${rOut} 0 ${large} 1 ${xa2} ${ya2} L ${xb2} ${yb2} A ${rIn} ${rIn} 0 ${large} 0 ${xb1} ${yb1} Z`;
  };
  // Item 6 / Item 8 — cone clip. Priority order:
  //   1. roomPolygon (camera sits inside a drawn Room) → clip to that
  //      polygon. The room's own walls bound the coverage.
  //   2. planBounds (no room, but the floor has known plan bounds) →
  //      clip to plan rect + ~20 ft margin so cones don't sprawl
  //      across empty canvas. Exterior cameras still get visible
  //      "edge" coverage — the explicit exterior zone polygon is the
  //      long-term fix; this is the honest stopgap.
  //   3. Neither → render unclipped (legacy behavior).
  // Visual clip only. doriBandsFor + pxPerFtAt are untouched.
  const useRoomClip = !!(roomPolygon && roomPolygon.length >= 3);
  const usePlanClip = !useRoomClip && !!planBounds;
  const clipId = useRoomClip
    ? `cone-room-${d.id}`
    : usePlanClip
      ? `cone-plan-${d.id}`
      : null;
  // 20 ft margin around the plan rect for exterior coverage breathing
  // room. With the canvas's ~12 px/ft default this is ~240 px; on a
  // calibrated floor it scales with `pxToFt` so the margin stays a
  // real 20 feet.
  // Group A.3 (second pass) — cone clip uses ZERO margin so coverage
  // never extends past the plan rectangle. Mohammad: "no coverage
  // beyond the canvas, period." The prior 20 ft breathing room let
  // exterior cameras spill their cones across the canvas gutter; with
  // 0 margin the cone is cut exactly at the plan edge.
  const planMarginPx = 0;
  const clipPathD = useRoomClip
    ? roomPolygon!.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
    : usePlanClip && planBounds
      ? (() => {
          const x0 = planBounds.x - planMarginPx;
          const y0 = planBounds.y - planMarginPx;
          const x1 = planBounds.x + planBounds.w + planMarginPx;
          const y1 = planBounds.y + planBounds.h + planMarginPx;
          return `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
        })()
      : null;
  return (
    <g opacity={opacity}>
      {clipId && clipPathD && (
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={clipPathD} />
          </clipPath>
        </defs>
      )}
      {/* Cone payload — wrapped in a group with the room clipPath when
          present so the cone, bands, arcs, and labels all clip to the
          camera's enclosing room. */}
      <g clipPath={clipId ? `url(#${clipId})` : undefined}>
      {/* Single-pass fill — no more bloom doubling. Hairline edge stroke. */}
      {!wireframe && <path d={path} fill={`url(#${gradId})`} />}
      <path d={path} fill="none" stroke={edge} strokeWidth={wireframe ? 0.9 : 0.5} opacity={wireframe ? 0.85 : 0.32} />
      {/* DORI bands — render only when the camera has an honest resolution.
          Each band paints an annular sector in the device's tone at a
          graduated opacity (identify brightest, detect faintest). Decorative
          only; pointer events stay on the device marker. */}
      {showBands && bands.map((b) => {
        const rIn = b.fromFt / pxToFt;
        const rOut = b.toFt / pxToFt;
        // Pass C: when the operator picks a DORI level from the
        // drawer's required-pixel-density row, emphasize that band
        // (1.5× opacity) and dim the others (0.25×). When no level
        // is picked the base opacities stand as-is.
        // Audit Group B.2 — the per-theme multiplier scales every
        // band's effective alpha so coverage punches through the
        // active canvas background (white in light / slate, near-
        // black in dark). Cap at 0.95 so even the brightest band
        // never goes fully opaque.
        const themeBoost = getCoverageBandMultiplier();
        const baseOp = Math.min(0.95, DORI_BASE_OPACITY[b.level] * themeBoost);
        const fillOp = emphasizedDoriLevel == null
          ? baseOp
          : (emphasizedDoriLevel === b.level ? Math.min(0.95, baseOp * 1.7) : baseOp * 0.25);
        if (wireframe) {
          return (
            <path key={b.level} d={sectorPath(rIn, rOut)}
              fill="none" stroke={tone} strokeWidth="0.5"
              opacity={Math.min(1, fillOp * 2.5)} strokeDasharray="1.5 2"
              pointerEvents="none"
            />
          );
        }
        return (
          <path key={b.level} d={sectorPath(rIn, rOut)}
            fill={tone} fillOpacity={fillOp} stroke="none"
            pointerEvents="none"
          />
        );
      })}
      {/* DORI band letter chips — selected cones only, placed along the aim
          ray at each band's midpoint so the operator can read which band is
          which at a glance. Skipped for tiny bands and for the identify
          band when it sits inside the lens-chip footprint (< 5 ft). */}
      {showBands && selected && bands.map((b) => {
        if (b.midFt < 5) return null;
        const midPx = b.midFt / pxToFt;
        const lx = d.x + Math.cos((rot * Math.PI) / 180) * midPx;
        const ly = d.y + Math.sin((rot * Math.PI) / 180) * midPx;
        return (
          <g key={`${b.level}-lbl`} transform={`translate(${lx} ${ly})`} pointerEvents="none">
            <circle r={5.5} fill="var(--panel-background)" fillOpacity="0.9" stroke={tone} strokeWidth="0.55" opacity="0.92" />
            <text textAnchor="middle" y={2.2} fontSize="6.5" fontWeight="700" fill={tone} fontFamily="ui-monospace, monospace" /* audit:icon-glyph dori-band-letter */>
              {DORI_LABEL[b.level]}
            </text>
          </g>
        );
      })}
      {/* Legacy decorative arcs — render only when no DORI bands (the camera
          has no resolution to drive honest bands). Keeps unresolved cones
          visually anchored without faking precision they don't have. */}
      {!showBands && showArcs && [0.35, 0.6, 0.8].map((f, i) => {
        const rr = r * f;
        const xa = d.x + Math.cos(a1) * rr;
        const ya = d.y + Math.sin(a1) * rr;
        const xb = d.x + Math.cos(a2) * rr;
        const yb = d.y + Math.sin(a2) * rr;
        return (
          <path key={i}
            d={`M ${xa} ${ya} A ${rr} ${rr} 0 0 1 ${xb} ${yb}`}
            fill="none" stroke={edge} strokeWidth="0.35" opacity={0.22 - i * 0.05} strokeDasharray="1 3"
          />
        );
      })}
      {/* "Set camera resolution" hint — selected single-lens camera that
          can't render bands because the resolution is unknown. Placed at
          r * 0.7 down the aim ray so it sits past the Pass 2 Part 1
          rotation puck (which lives at ~r * 0.45) instead of stacking on
          top of it. */}
      {selected && !resolution && d.type !== 'cam.multisensor' && d.type !== 'cam.fisheye' && fovDeg < 180 && (
        <g transform={`translate(${d.x + Math.cos((rot * Math.PI) / 180) * (r * 0.7)} ${d.y + Math.sin((rot * Math.PI) / 180) * (r * 0.7)})`} pointerEvents="none">
          <rect x={-42} y={-7} width={84} height={14} rx={3} fill="var(--panel-background)" fillOpacity="0.92" stroke={edge} strokeOpacity="0.7" strokeWidth="0.5" />
          <text textAnchor="middle" y={3} fontSize="9" fill="var(--muted-foreground)" fontFamily="ui-monospace, monospace">
            set resolution for bands
          </text>
        </g>
      )}
      {showAim && (
        <line
          x1={d.x} y1={d.y}
          x2={d.x + Math.cos((rot * Math.PI) / 180) * r}
          y2={d.y + Math.sin((rot * Math.PI) / 180) * r}
          stroke={edge} strokeWidth="0.4" opacity="0.4" strokeDasharray="2 3"
        />
      )}
      </g>
    </g>
  );
}
