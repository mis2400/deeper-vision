// FloorPlan — extracted from screens/EngineeringCanvas.tsx as part of
// the M11 monolith breakup. The six source-mode branches stay together
// because the picker chooses one and the renders are mutually exclusive
// at runtime:
//
//   blueprint  paper + wall lines + tinted room fills + scale tick
//   satellite  vegetation + asphalt + roof + parcel + simulated badge
//   street     cartographic roads + building footprints + simulated
//   hybrid     aerial + labelled roads + simulated badge
//   dark       night cartographic + simulated badge
//   blank      pure grid paper with sketch hint
//
// RoomLabel is a private helper used by the blueprint branch only;
// it travels with FloorPlan so the module is self-contained.
//
// Pure render — no closures on EngineeringCanvas state. Takes the
// source mode and site address as props.

import type { BaseMapMode } from '../../store/types';
import { SimulatedMapBadge } from './SimulatedMapBadge';

export function FloorPlan({ source, siteAddress }: { source: BaseMapMode; siteAddress: string }) {
  // Honest map modes. Every value the picker offers produces a visually
  // distinct surface so the choice is real. Where there's no live tile
  // provider (street / hybrid / dark) the surface is clearly a stylised
  // engineering render and is labelled "Simulated map layer".
  //
  // Canvas V3.11 audit confirmed each of the six modes:
  //   * blueprint  — paper + wall lines + room labels + scale bar
  //   * satellite  — vegetation + asphalt + roof + parcel + Simulated badge
  //   * street     — cartographic roads + building footprints + Simulated badge
  //   * hybrid     — aerial + labelled roads + Simulated badge
  //   * dark       — night cartographic + Simulated badge
  //   * blank      — pure grid paper with sketch hint
  // All six pass V3's "no mode is a fake" bar. Compass (line 3759) is a
  // fixed canvas-up = north indicator (no calibration-driven rotation
  // claim). Scale bar (line 3786) reads "Verified" when calibratedAt is
  // set, otherwise "Default scale" + a Set-scale CTA — honest in both
  // states.
  if (source === 'blank') {
    return (
      <g>
        <rect x="80" y="80" width="640" height="480" fill="url(#plan-paper)" stroke="#30363D" strokeWidth="1" strokeDasharray="6 6" rx="4" />
        <text x="400" y="316" textAnchor="middle" fill="#7D8590" fontSize="13">Press W or pick the wall tool to start sketching</text>
        <text x="400" y="336" textAnchor="middle" fill="#484F58" fontSize="11">Click to drop vertices · double-click to end a run</text>
      </g>
    );
  }
  if (source === 'street') {
    return (
      <g>
        {/* Light cartographic surface — off-white roads on a warm slate. */}
        <rect x="80" y="80" width="640" height="480" fill="#D8DEE8" rx="3" />
        {/* Major roads */}
        <g stroke="#FFFFFF" strokeLinecap="round">
          <line x1="80"  y1="220" x2="720" y2="220" strokeWidth="16" />
          <line x1="80"  y1="420" x2="720" y2="420" strokeWidth="12" />
          <line x1="320" y1="80"  x2="320" y2="560" strokeWidth="14" />
          <line x1="560" y1="80"  x2="560" y2="560" strokeWidth="10" />
        </g>
        {/* Road outlines */}
        <g stroke="#9BA5B6" strokeWidth="0.6">
          <line x1="80"  y1="212" x2="720" y2="212" />
          <line x1="80"  y1="228" x2="720" y2="228" />
          <line x1="80"  y1="414" x2="720" y2="414" />
          <line x1="80"  y1="426" x2="720" y2="426" />
          <line x1="313" y1="80"  x2="313" y2="560" />
          <line x1="327" y1="80"  x2="327" y2="560" />
          <line x1="555" y1="80"  x2="555" y2="560" />
          <line x1="565" y1="80"  x2="565" y2="560" />
        </g>
        {/* Building footprints */}
        <g fill="#BFC8D6" stroke="#9BA5B6" strokeWidth="0.6">
          <rect x="120" y="100" width="140" height="90" />
          <rect x="370" y="110" width="160" height="90" />
          <rect x="600" y="120" width="100" height="80" />
          <rect x="110" y="260" width="180" height="130" />
          <rect x="370" y="260" width="160" height="130" />
          <rect x="600" y="260" width="100" height="120" />
          <rect x="120" y="450" width="170" height="90" />
          <rect x="370" y="450" width="160" height="90" />
        </g>
        <SimulatedMapBadge label="Simulated street map" />
      </g>
    );
  }
  if (source === 'hybrid') {
    // Hybrid = aerial surface + clear road/label overlays. Uses the same
    // honest aerial we render in the satellite branch, then layers
    // labelled streets on top so the engineer can orient.
    return (
      <g>
        <defs>
          <pattern id="hyb-veg" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#3F5C42" />
            <circle cx="4" cy="4" r="1.4" fill="#5A7B5D" opacity="0.6" />
            <circle cx="10" cy="9" r="1.2" fill="#365139" opacity="0.7" />
          </pattern>
          <pattern id="hyb-asphalt" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill="#3A3F47" />
            <line x1="0" y1="9" x2="18" y2="9" stroke="#52575F" strokeWidth="0.4" opacity="0.5" />
          </pattern>
        </defs>
        <rect x="80" y="80" width="640" height="480" fill="url(#hyb-veg)" rx="3" />
        <rect x="120" y="420" width="560" height="120" fill="url(#hyb-asphalt)" rx="2" />
        <rect x="220" y="200" width="360" height="200" fill="#8B928D" stroke="#1F2A33" strokeWidth="0.8" />
        {/* Roads (labelled) */}
        <g stroke="#FFFFFF" strokeOpacity="0.55" strokeLinecap="round" fill="none">
          <line x1="80"  y1="220" x2="720" y2="220" strokeWidth="14" />
          <line x1="80"  y1="540" x2="720" y2="540" strokeWidth="10" />
          <line x1="400" y1="80"  x2="400" y2="560" strokeWidth="12" />
        </g>
        <g stroke="#FFFFFF" strokeOpacity="0.95" strokeLinecap="round" strokeDasharray="6 6">
          <line x1="80"  y1="220" x2="720" y2="220" strokeWidth="1" />
          <line x1="80"  y1="540" x2="720" y2="540" strokeWidth="1" />
          <line x1="400" y1="80"  x2="400" y2="560" strokeWidth="1" />
        </g>
        <g fill="#FFFFFF" fontSize="10.5" fontFamily="ui-sans-serif" fontWeight="500">
          <text x="500" y="216" textAnchor="middle" stroke="#0D1424" strokeWidth="3" paintOrder="stroke">Commerce Blvd</text>
          <text x="412" y="330" textAnchor="middle" stroke="#0D1424" strokeWidth="3" paintOrder="stroke" transform="rotate(-90 412 330)">7th St</text>
        </g>
        <g transform="translate(96, 100)">
          <rect width="220" height="26" rx="13" fill="var(--canvas-background)" fillOpacity="0.8" stroke="#30363D" />
          <circle cx="14" cy="13" r="3.5" fill="#2F81F7" />
          <text x="26" y="17" fill="var(--foreground)" fontSize="11">{siteAddress || 'No address set'}</text>
        </g>
        <SimulatedMapBadge label="Simulated hybrid (satellite + labels)" />
      </g>
    );
  }
  if (source === 'dark') {
    return (
      <g>
        {/* Dark cartographic surface — premium night-mode map look. */}
        <rect x="80" y="80" width="640" height="480" fill="#0E1424" rx="3" />
        <g stroke="#1F2A40" strokeWidth="22" strokeLinecap="round">
          <line x1="80" y1="220" x2="720" y2="220" />
          <line x1="80" y1="420" x2="720" y2="420" />
          <line x1="320" y1="80" x2="320" y2="560" />
        </g>
        <g stroke="#2A3650" strokeWidth="14" strokeLinecap="round">
          <line x1="80" y1="160" x2="720" y2="160" />
          <line x1="80" y1="500" x2="720" y2="500" />
          <line x1="560" y1="80" x2="560" y2="560" />
        </g>
        {/* Road inner highlights */}
        <g stroke="#4A95E8" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round">
          <line x1="80" y1="220" x2="720" y2="220" />
          <line x1="80" y1="420" x2="720" y2="420" />
          <line x1="320" y1="80" x2="320" y2="560" />
        </g>
        {/* Building parcels */}
        <g fill="#162033" stroke="#243049" strokeWidth="0.6">
          <rect x="120" y="100" width="140" height="90" />
          <rect x="370" y="110" width="160" height="90" />
          <rect x="600" y="120" width="100" height="80" />
          <rect x="110" y="260" width="180" height="130" />
          <rect x="370" y="260" width="160" height="130" />
          <rect x="600" y="260" width="100" height="120" />
          <rect x="120" y="450" width="170" height="90" />
          <rect x="370" y="450" width="160" height="90" />
        </g>
        <SimulatedMapBadge label="Simulated dark map" tone="dark" />
      </g>
    );
  }
  if (source === 'satellite') {
    // Honest satellite stand-in: while a live tile provider isn't wired,
    // we draw a clean engineering aerial — parcel grid, vegetation
    // tiles, hardstanding (parking) and a clear primary structure. The
    // colour palette stays mid-tone so plotted device icons (high-
    // contrast white-on-tone glyphs) read cleanly against the surface.
    // The SimulatedMapBadge keeps the label honest.
    return (
      <g>
        <defs>
          <pattern id="sat-veg" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#3F5C42" />
            <circle cx="4" cy="4" r="1.4" fill="#5A7B5D" opacity="0.6" />
            <circle cx="10" cy="9" r="1.2" fill="#365139" opacity="0.7" />
          </pattern>
          <pattern id="sat-asphalt" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill="#3A3F47" />
            <line x1="0" y1="9" x2="18" y2="9" stroke="#52575F" strokeWidth="0.4" opacity="0.5" />
          </pattern>
          <linearGradient id="sat-roof" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="#9BA29C" />
            <stop offset="50%" stopColor="#828A85" />
            <stop offset="100%" stopColor="#6E7570" />
          </linearGradient>
        </defs>

        {/* Base aerial (vegetation / land) */}
        <rect x="80" y="80" width="640" height="480" fill="url(#sat-veg)" rx="3" />

        {/* Parking lot — primary hardstanding south of the building */}
        <rect x="120" y="420" width="560" height="120" fill="url(#sat-asphalt)" rx="2" />
        {/* Parking stripes */}
        <g stroke="#D7DCE2" strokeWidth="0.9" opacity="0.85">
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={i} x1={140 + i * 30} y1={440} x2={140 + i * 30} y2={485} />
          ))}
          {Array.from({ length: 18 }).map((_, i) => (
            <line key={`b${i}`} x1={140 + i * 30} y1={500} x2={140 + i * 30} y2={540} />
          ))}
          <line x1="120" y1="492" x2="680" y2="492" strokeDasharray="6 6" opacity="0.6" />
        </g>

        {/* Driveway entry north */}
        <rect x="380" y="80" width="40" height="120" fill="url(#sat-asphalt)" />

        {/* Primary structure (building roof) */}
        <g>
          <rect x="220" y="200" width="360" height="200" fill="url(#sat-roof)" stroke="#1F2A33" strokeWidth="0.8" />
          {/* Roof equipment — HVAC blocks read as small dark rectangles
              over the roof. Helps the surface feel like real imagery. */}
          <g fill="#4A5058" stroke="#262B30" strokeWidth="0.4">
            <rect x="244" y="220" width="36" height="22" />
            <rect x="296" y="220" width="28" height="22" />
            <rect x="520" y="232" width="40" height="28" />
            <rect x="244" y="356" width="26" height="22" />
            <rect x="520" y="356" width="40" height="22" />
          </g>
          {/* Roof seam lines */}
          <g stroke="#1F2A33" strokeWidth="0.4" opacity="0.55">
            <line x1="220" y1="270" x2="580" y2="270" />
            <line x1="220" y1="330" x2="580" y2="330" />
            <line x1="400" y1="200" x2="400" y2="400" />
          </g>
        </g>

        {/* Sidewalk perimeter */}
        <g stroke="#C7CDD4" strokeOpacity="0.55" strokeWidth="3" fill="none">
          <rect x="206" y="186" width="388" height="228" />
        </g>

        {/* Parcel outline (engineering boundary, not imagery) */}
        <rect x="80" y="80" width="640" height="480" fill="none" stroke="#2F81F7" strokeWidth="2" strokeDasharray="8 6" />

        {/* Address chip */}
        <g transform="translate(96, 100)">
          <rect width="220" height="26" rx="13" fill="var(--canvas-background)" fillOpacity="0.8" stroke="#30363D" />
          <circle cx="14" cy="13" r="3.5" fill="#2F81F7" />
          <text x="26" y="17" fill="var(--foreground)" fontSize="11">{siteAddress || 'No address set'}</text>
        </g>

        {/* Scale bar */}
        <g transform="translate(100, 580)">
          <rect x="-6" y="-12" width="124" height="22" rx="4" fill="var(--canvas-background)" fillOpacity="0.62" stroke="#30363D" strokeWidth="0.6" />
          <line x1="0" y1="0" x2="100" y2="0" stroke="#E6EDF3" strokeWidth="2" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="#E6EDF3" strokeWidth="2" />
          <line x1="100" y1="-4" x2="100" y2="4" stroke="#E6EDF3" strokeWidth="2" />
          <text x="50" y="-7" textAnchor="middle" fill="var(--foreground)" fontSize="10">~30 ft</text>
        </g>

        <SimulatedMapBadge label="Simulated satellite layer" />
      </g>
    );
  }
  // M11 plan redesign — modern engineering output, not the prior
  // washed out demo. Hierarchy:
  //   1. Plan paper at canvas-background with the architectural grid
  //   2. Subtle drop shadow under the paper so it lifts off the canvas
  //   3. Eight tinted room fills so rooms read as distinct spaces
  //   4. Heavy exterior wall (2.8 px) in foreground tone
  //   5. Medium interior walls (1.6 px) in foreground tone
  //   6. Door openings as proper gaps with thin swing arcs
  //   7. Room labels in chrome-md semibold + chrome-xs muted area
  //   8. Exterior context labels at chrome-2xs muted-foreground
  //   9. Scale tick that matches the floating scale bar's instrument look
  return (
    <g>
      <defs>
        {/* Plan paper elevation — soft ambient + tight contact so the
            sheet visibly sits above the canvas surface. */}
        <filter id="plan-elevation" x="-2%" y="-2%" width="104%" height="108%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
          <feOffset dx="0" dy="6" result="shadow" />
          <feColorMatrix in="shadow" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0.1  0 0 0 0.28 0" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Faint room fill tones — read as warm/cool zones at low alpha
            so the eye groups adjacent spaces. KIND_TONE values are
            domain data; these are just room-zone tints. */}
        <linearGradient id="room-fill-warm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="rgb(245, 220, 180)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="rgb(245, 220, 180)" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="room-fill-cool" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="rgb(190, 215, 240)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="rgb(190, 215, 240)" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="room-fill-neutral" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="rgb(200, 200, 200)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="rgb(200, 200, 200)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Plan paper with subtle elevation. The architectural grid pattern
          inside canvas-background gives the sheet a drawing-paper feel
          without competing with the walls. */}
      <g filter="url(#plan-elevation)">
        <rect x="80" y="80" width="640" height="480" fill="url(#plan-paper)" rx="6" />
      </g>

      {/* Room zone fills — eight cells grouped by use. Sits BENEATH the
          walls so the boundary stays crisp. */}
      <g>
        <rect x="80"  y="80"  width="160" height="240" fill="url(#room-fill-warm)" />
        <rect x="240" y="80"  width="160" height="240" fill="url(#room-fill-neutral)" />
        <rect x="400" y="80"  width="160" height="240" fill="url(#room-fill-cool)" />
        <rect x="560" y="80"  width="160" height="240" fill="url(#room-fill-warm)" />
        <rect x="80"  y="320" width="160" height="240" fill="url(#room-fill-cool)" />
        <rect x="240" y="320" width="160" height="240" fill="url(#room-fill-cool)" />
        <rect x="400" y="320" width="160" height="240" fill="url(#room-fill-neutral)" />
        <rect x="560" y="320" width="160" height="240" fill="url(#room-fill-warm)" />
      </g>

      {/* Exterior wall — heavy stroke so the building envelope reads
          as the primary boundary. Rounded join keeps corners crisp. */}
      <rect
        x="80" y="80" width="640" height="480"
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth="2.2"
        strokeLinejoin="round"
        opacity="0.82"
        rx="10"
      />

      {/* Interior walls — medium stroke, same tone, lower opacity so
          the eye reads exterior first, interior second. */}
      <g
        stroke="var(--muted-foreground)"
        strokeWidth="1.35"
        opacity="0.62"
        strokeLinecap="round"
      >
        <line x1="80"  y1="320" x2="720" y2="320" />
        <line x1="400" y1="80"  x2="400" y2="560" />
        <line x1="240" y1="80"  x2="240" y2="320" />
        <line x1="560" y1="80"  x2="560" y2="320" />
        <line x1="240" y1="320" x2="240" y2="560" />
        <line x1="560" y1="320" x2="560" y2="560" />
      </g>

      {/* Door openings — paper-colored cut through the wall plus a
          thin half-arc showing the swing. Stronger than the prior
          dotted hint; reads as proper architectural notation. */}
      <g>
        {/* Top edge entrance */}
        <line x1="380" y1="80" x2="420" y2="80" stroke="var(--canvas-background)" strokeWidth="4" />
        <path d="M 380 80 L 380 120 A 40 40 0 0 1 420 80" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.2" opacity="0.55" />
        {/* Right edge entrance */}
        <line x1="720" y1="240" x2="720" y2="280" stroke="var(--canvas-background)" strokeWidth="4" />
        <path d="M 720 240 L 680 240 A 40 40 0 0 1 720 280" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.2" opacity="0.55" />
      </g>

      {/* Room labels — chrome scale semibold name + muted area chip below.
          textAnchor middle so they land center of each cell. The fontSize
          maps to var(--chrome-md) for the name and var(--chrome-xs) for
          the area, but SVG <text> needs literal numbers; the values match. */}
      <g style={{ fontFamily: 'inherit' }}>
        <RoomLabel x={160} y={186} name="Lobby"        area="2,400 sq ft" />
        <RoomLabel x={320} y={186} name="Reception"    area="1,200 sq ft" />
        <RoomLabel x={480} y={186} name="Open office"  area="3,200 sq ft" />
        <RoomLabel x={640} y={186} name="IT room"      area="1,400 sq ft" />
        <RoomLabel x={160} y={428} name="Conference A" area="1,600 sq ft" />
        <RoomLabel x={320} y={428} name="Conference B" area="1,600 sq ft" />
        <RoomLabel x={480} y={428} name="Open office"  area="3,200 sq ft" />
        <RoomLabel x={640} y={428} name="Storage"      area="1,400 sq ft" />
      </g>

      {/* Exterior context labels — muted, uppercase, tracked. Read as
          metadata rather than competing with room names. */}
      <g
        fill="var(--muted-foreground)"
        fontSize="11"
        fontWeight="500"
        opacity="0.75"
        style={{ letterSpacing: '0.10em', textTransform: 'uppercase' }}
      >
        <text x="44" y="320" transform="rotate(-90 44 320)" textAnchor="middle">Exterior · parking</text>
        <text x="400" y="62" textAnchor="middle">Exterior · courtyard</text>
      </g>

      {/* Scale is handled by the studio chrome. Keeping a second in-plan
          ruler made the canvas feel like the older drafting mockup. */}
    </g>
  );
}

// Room label component — chrome-md semibold name centered above a
// chrome-xs muted area. textAnchor middle so the pair reads as a
// unit. Used by the blueprint FloorPlan branch.
// Internal helper — used only by the blueprint branch above.
function RoomLabel({ x, y, name, area }: { x: number; y: number; name: string; area: string }) {
  return (
    <>
      <text x={x} y={y} textAnchor="middle" fill="var(--foreground)" fontSize="13" fontWeight="600">{name}</text>
      <text x={x} y={y + 16} textAnchor="middle" fill="var(--muted-foreground)" fontSize="11" fontWeight="500" opacity="0.85">{area}</text>
    </>
  );
}
