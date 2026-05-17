/* ─────────────────────────────────────────────────────────────────────
   DEEPER VISION — Surveyor symbol library
   ─────────────────────────────────────────────────────────────────────
   Inline SVG primitives for everything plotted on the engineering
   canvas. Designed to read as a *plan*, not as a SaaS dashboard:

     • monochrome (currentColor) so the wrapping `<g>` controls tint
     • single 24×24 viewBox per symbol → readable at 16 / 24 / 32px
     • thin technical strokes (default 1.4) + no filled-tone halos
     • plan-symbol inspired geometry — the camera has a sightline
       triangle, the door has a swing arc, the IDF is a rack outline

   The HardwareGlyph component on the canvas consumes these so every
   plotted device finally looks like it belongs on a low-voltage /
   security construction drawing.
   ─────────────────────────────────────────────────────────────────── */

import * as React from 'react';

export type SymbolId =
  // Cameras
  | 'cam.dome' | 'cam.bullet' | 'cam.turret' | 'cam.ptz'
  | 'cam.multisensor' | 'cam.fisheye' | 'cam.lpr' | 'cam.thermal' | 'cam.body'
  // Access
  | 'acc.reader' | 'acc.keypad' | 'acc.strike' | 'acc.maglock'
  | 'acc.exit' | 'acc.dps' | 'acc.panic' | 'acc.controller' | 'acc.psu' | 'acc.intercom'
  | 'acc.biometric'
  // Infrastructure
  | 'inf.door-single' | 'inf.door-double' | 'inf.door-storefront'
  | 'inf.door-sliding' | 'inf.gate-swing' | 'inf.gate-slide'
  | 'inf.elevator' | 'inf.window' | 'inf.wall' | 'inf.wall-brick' | 'inf.wall-fire'
  // Network / IDF
  | 'net.idf' | 'net.mdf' | 'inf.rack' | 'inf.mdf'
  | 'net.switch' | 'net.patch' | 'net.ap' | 'net.firewall'
  | 'sto.nvr' | 'sto.server'
  // Cabling
  | 'cab.cable' | 'cab.bundle' | 'cab.conduit' | 'cab.pullbox' | 'cab.jbox'
  | 'cab.jhook' | 'cab.tray' | 'cab.coupler' | 'cab.jack'
  | 'cab.jack-shld' | 'cab.jack-outdoor' | 'cab.patchcord'
  | 'cab.firestop' | 'cab.sleeve' | 'cab.wallplate' | 'cab.terminal' | 'cab.splice' | 'cab.mgr'
  | 'cab.pp24' | 'cab.pp48' | 'cab.pp-fiber'
  // Power
  | 'pwr.psu' | 'pwr.transformer' | 'pwr.battery' | 'pwr.poe' | 'pwr.ups'
  // Sensors / fire (minimal coverage)
  | 'sen.motion' | 'sen.glass' | 'sen.smoke' | 'fire.pull' | 'fire.horn';

const VB = 24;

/** Each entry returns the SVG body that lives inside a `<g>` already
 *  positioned in the consumer; we keep them small and let the wrapper
 *  scale + translate. Stroke is `currentColor`, no fills, no halos. */
const SYMBOLS: Record<string, React.ReactNode> = {
  // ── Cameras — plan-symbol style: rectangle / circle body + sightline
  'cam.dome': (
    <g>
      <circle cx={12} cy={12} r={6.5} />
      <circle cx={12} cy={12} r={2.2} />
      <path d="M 12 5.5 L 12 2" />
    </g>
  ),
  'cam.bullet': (
    <g>
      <rect x={5} y={9} width={11} height={6} rx={1.2} />
      <line x1={5} y1={12} x2={5} y2={12} />
      <line x1={16} y1={9}  x2={20} y2={6} />
      <line x1={16} y1={15} x2={20} y2={18} />
      <line x1={20} y1={6}  x2={20} y2={18} />
      <circle cx={5.5} cy={12} r={1.2} />
    </g>
  ),
  'cam.turret': (
    <g>
      <circle cx={12} cy={13} r={5.5} />
      <circle cx={12} cy={13} r={1.6} />
      <path d="M 7 9 L 12 4 L 17 9 Z" />
    </g>
  ),
  'cam.ptz': (
    <g>
      <circle cx={12} cy={13} r={6.5} />
      <path d="M 6 13 A 6 6 0 0 1 18 13" />
      <circle cx={12} cy={13} r={2} />
      <path d="M 12 4 L 12 7" />
    </g>
  ),
  'cam.multisensor': (
    <g>
      <circle cx={12} cy={12} r={7} />
      <line x1={12} y1={2}  x2={12} y2={22} />
      <line x1={2}  y1={12} x2={22} y2={12} />
      <circle cx={7.5} cy={7.5} r={1.4} />
      <circle cx={16.5} cy={7.5} r={1.4} />
      <circle cx={7.5} cy={16.5} r={1.4} />
      <circle cx={16.5} cy={16.5} r={1.4} />
    </g>
  ),
  'cam.fisheye': (
    <g>
      <circle cx={12} cy={12} r={7.5} />
      <circle cx={12} cy={12} r={4.5} />
      <circle cx={12} cy={12} r={1.8} />
    </g>
  ),
  'cam.lpr': (
    // Bullet camera body + small plate-readout tick lines (vertical
    // bars indicating the plate being read). Reads as "license-plate
    // camera" in plan view without the LPR text label.
    <g>
      <rect x={4} y={9} width={12} height={6} rx={1} />
      <line x1={16} y1={9}  x2={21} y2={5} />
      <line x1={16} y1={15} x2={21} y2={19} />
      <line x1={21} y1={5}  x2={21} y2={19} />
      <line x1={6.5} y1={11} x2={6.5} y2={13} />
      <line x1={8.5} y1={11} x2={8.5} y2={13} />
      <line x1={10.5} y1={11} x2={10.5} y2={13} />
      <line x1={12.5} y1={11} x2={12.5} y2={13} />
    </g>
  ),
  'cam.thermal': (
    // Bullet body with a small lens + radiating dashes — classic
    // thermal-camera plan glyph (the dashes evoke heat sensing).
    <g>
      <rect x={5} y={9} width={12} height={6} rx={1.2} />
      <line x1={16} y1={9}  x2={20} y2={6} />
      <line x1={16} y1={15} x2={20} y2={18} />
      <line x1={20} y1={6}  x2={20} y2={18} />
      <circle cx={8.5} cy={12} r={1.5} />
      <line x1={11} y1={11} x2={12.5} y2={11} />
      <line x1={11} y1={12} x2={13.5} y2={12} />
      <line x1={11} y1={13} x2={12.5} y2={13} />
    </g>
  ),
  'cam.body': (
    // Worn / body-camera plan symbol: small rectangular body with a
    // chest-mount clip + lens. Reads compactly without a mascot-style
    // person silhouette.
    <g>
      <rect x={8} y={6} width={8} height={12} rx={1.2} />
      <circle cx={12} cy={10} r={1.8} />
      <rect x={10} y={4} width={4} height={3} rx={0.6} />
    </g>
  ),

  // ── Access — keypad / reader / strike etc. — rectangular plan glyphs
  'acc.reader': (
    <g>
      <rect x={8.5} y={4} width={7} height={16} rx={1} />
      <circle cx={12} cy={8} r={1.3} />
      <rect x={9.5} y={11} width={5} height={7} rx={0.6} />
    </g>
  ),
  'acc.keypad': (
    <g>
      <rect x={7} y={4} width={10} height={16} rx={1} />
      {[0,1,2].map((c) => [0,1,2,3].map((r) => (
        <circle key={`${c}-${r}`} cx={8.5 + c * 3.5} cy={7 + r * 3.2} r={0.7} fill="currentColor" stroke="none" />
      )))}
    </g>
  ),
  'acc.biometric': (
    <g>
      <rect x={8.5} y={4} width={7} height={16} rx={1} />
      <path d="M 10 11 A 2.5 2.5 0 0 1 14 11" />
      <path d="M 10 13.5 A 4 4 0 0 1 14 13.5" />
      <path d="M 10 16 A 5.5 5.5 0 0 1 14 16" />
    </g>
  ),
  'acc.strike': (
    <g>
      <rect x={3} y={9} width={18} height={6} rx={1} />
      <rect x={10} y={11} width={4} height={2} />
    </g>
  ),
  'acc.maglock': (
    <g>
      <rect x={2} y={10} width={20} height={4} rx={0.6} />
      <rect x={3} y={11} width={3} height={2} />
      <rect x={18} y={11} width={3} height={2} />
    </g>
  ),
  'acc.exit': (
    // REX (request-to-exit) device: rounded oblong with an outward-
    // pointing arrow, the conventional plan symbol for an egress
    // device. Replaces the "EX" text label.
    <g>
      <rect x={3} y={9} width={18} height={6} rx={2.5} />
      <line x1={8} y1={12} x2={16} y2={12} />
      <path d="M 13 9.5 L 16 12 L 13 14.5" />
    </g>
  ),
  'acc.dps': (
    <g>
      <rect x={6} y={6} width={5} height={12} rx={0.6} />
      <rect x={13} y={6} width={5} height={12} rx={0.6} />
      <line x1={11} y1={12} x2={13} y2={12} />
    </g>
  ),
  'acc.panic': (
    <g>
      <rect x={3} y={11} width={18} height={3} rx={1.5} />
      <line x1={5} y1={12.5} x2={19} y2={12.5} />
    </g>
  ),
  'acc.controller': (
    <g>
      <rect x={4} y={5} width={16} height={14} rx={1.2} />
      <line x1={6} y1={9}  x2={18} y2={9} />
      <line x1={6} y1={12} x2={18} y2={12} />
      <line x1={6} y1={15} x2={18} y2={15} />
      <circle cx={18.5} cy={6.5} r={0.8} fill="currentColor" stroke="none" />
    </g>
  ),
  'acc.psu': (
    // Power supply unit: enclosure with a battery cell motif inside.
    // Two short bars (positive/negative terminals) replace the "+−"
    // text — reads as a power-source plan symbol.
    <g>
      <rect x={5} y={7} width={14} height={10} rx={1} />
      <rect x={8} y={10} width={8} height={4} rx={0.4} />
      <line x1={17} y1={11} x2={17} y2={13} />
    </g>
  ),
  'acc.intercom': (
    <g>
      <rect x={6} y={4} width={12} height={16} rx={1.5} />
      <rect x={8} y={6}  width={8} height={5} rx={0.8} />
      <circle cx={12} cy={15} r={1.3} />
      <line x1={9} y1={18} x2={15} y2={18} strokeWidth="0.9" />
    </g>
  ),

  // ── Doors / openings — plan-symbol swing arcs
  'inf.door-single': (
    <g>
      <line x1={4} y1={20} x2={4} y2={8} strokeWidth="1.9" />
      <line x1={4} y1={8} x2={16} y2={8} />
      <path d="M 4 20 A 12 12 0 0 1 16 8" strokeDasharray="2 2" />
    </g>
  ),
  'inf.door-double': (
    <g>
      <line x1={3} y1={18} x2={3} y2={10} strokeWidth="1.6" />
      <line x1={21} y1={18} x2={21} y2={10} strokeWidth="1.6" />
      <line x1={3} y1={10} x2={11} y2={10} />
      <line x1={21} y1={10} x2={13} y2={10} />
      <path d="M 3 18 A 8 8 0 0 1 11 10" strokeDasharray="2 2" />
      <path d="M 21 18 A 8 8 0 0 0 13 10" strokeDasharray="2 2" />
    </g>
  ),
  'inf.door-storefront': (
    <g>
      <rect x={3} y={6} width={18} height={12} />
      <line x1={12} y1={6} x2={12} y2={18} />
      <line x1={6} y1={10} x2={6} y2={14} />
      <line x1={18} y1={10} x2={18} y2={14} />
    </g>
  ),
  'inf.door-sliding': (
    <g>
      <line x1={3} y1={11} x2={21} y2={11} strokeWidth="1.6" />
      <line x1={3} y1={13} x2={21} y2={13} strokeWidth="1.6" />
      <path d="M 4 8 L 12 8" />
      <path d="M 20 16 L 12 16" />
      <path d="M 10 7.5 L 12 8 L 10 8.5" />
      <path d="M 14 15.5 L 12 16 L 14 16.5" />
    </g>
  ),
  'inf.gate-swing': (
    <g>
      <line x1={4} y1={20} x2={4} y2={6} strokeWidth="1.9" />
      <line x1={4} y1={6} x2={18} y2={6} />
      <line x1={6} y1={6} x2={6} y2={20} strokeDasharray="1 2" />
      <line x1={10} y1={6} x2={10} y2={20} strokeDasharray="1 2" />
      <line x1={14} y1={6} x2={14} y2={20} strokeDasharray="1 2" />
      <path d="M 4 20 A 14 14 0 0 1 18 6" strokeDasharray="2 2" />
    </g>
  ),
  'inf.gate-slide': (
    <g>
      <line x1={3} y1={12} x2={21} y2={12} strokeWidth="1.6" />
      <line x1={5} y1={9}  x2={5} y2={15} />
      <line x1={9} y1={9}  x2={9} y2={15} />
      <line x1={13} y1={9} x2={13} y2={15} />
      <line x1={17} y1={9} x2={17} y2={15} />
      <path d="M 19 10 L 21 12 L 19 14" />
    </g>
  ),
  'inf.elevator': (
    <g>
      <rect x={5} y={4} width={14} height={16} rx={1} />
      <line x1={12} y1={4} x2={12} y2={20} />
      <path d="M 9 10 L 9 14 M 7.5 11.5 L 9 10 L 10.5 11.5" />
      <path d="M 15 10 L 15 14 M 13.5 12.5 L 15 14 L 16.5 12.5" />
    </g>
  ),
  'inf.window': (
    <g>
      <rect x={3} y={9} width={18} height={6} />
      <line x1={12} y1={9} x2={12} y2={15} />
    </g>
  ),
  'inf.wall': (
    <g>
      <rect x={3} y={11} width={18} height={2} />
    </g>
  ),
  'inf.wall-brick': (
    <g>
      <rect x={3} y={9} width={18} height={6} />
      <line x1={3} y1={12} x2={21} y2={12} />
      <line x1={7} y1={9} x2={7} y2={12} />
      <line x1={11} y1={12} x2={11} y2={15} />
      <line x1={15} y1={9} x2={15} y2={12} />
      <line x1={19} y1={12} x2={19} y2={15} />
    </g>
  ),
  'inf.wall-fire': (
    <g>
      <rect x={3} y={10} width={18} height={4} />
      <path d="M 6 14 L 6 17 M 10 14 L 10 17 M 14 14 L 14 17 M 18 14 L 18 17" />
    </g>
  ),

  // ── Network — rack outline + switch / patch panel rows
  'net.idf': (
    <g>
      <rect x={5} y={3} width={14} height={18} rx={0.8} />
      {[6,9,12,15].map((y) => <rect key={y} x={7} y={y} width={10} height={2} />)}
      <line x1={5} y1={5} x2={5} y2={5.6} strokeWidth="1.6" />
      <line x1={19} y1={5} x2={19} y2={5.6} strokeWidth="1.6" />
    </g>
  ),
  'net.mdf': (
    <g>
      <rect x={4} y={3} width={16} height={18} rx={0.8} />
      {[6,9,12,15,18].map((y) => <rect key={y} x={6} y={y} width={12} height={1.5} />)}
      <text x={12} y={4.5} textAnchor="middle" fontSize="2.6" fontWeight="700" fill="currentColor" stroke="none">MDF</text>
    </g>
  ),
  'inf.rack': (
    <g>
      <rect x={5} y={3} width={14} height={18} rx={0.6} />
      {[5.5,7,8.5,10,11.5,13,14.5,16,17.5,19].map((y) => <line key={y} x1={6.5} y1={y} x2={17.5} y2={y} strokeWidth="0.6" />)}
    </g>
  ),
  'inf.mdf': (
    <g>
      <rect x={4} y={3} width={16} height={18} rx={0.8} />
      {[6,9,12,15,18].map((y) => <rect key={y} x={6} y={y} width={12} height={1.5} />)}
    </g>
  ),
  'net.switch': (
    <g>
      <rect x={3} y={9} width={18} height={6} rx={0.6} />
      {[5,7,9,11,13,15,17,19].map((x) => <line key={x} x1={x} y1={11} x2={x} y2={13} strokeWidth="0.9" />)}
      <circle cx={20} cy={10.5} r={0.6} fill="currentColor" stroke="none" />
    </g>
  ),
  'net.patch': (
    <g>
      <rect x={2} y={9} width={20} height={6} rx={0.6} />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x={3 + i * 1.6} y={10.5} width={1.1} height={3} />
      ))}
    </g>
  ),
  'net.ap': (
    <g>
      <circle cx={12} cy={14} r={2} />
      <path d="M 7 14 A 5 5 0 0 1 17 14" />
      <path d="M 4 14 A 8 8 0 0 1 20 14" />
    </g>
  ),
  'net.firewall': (
    <g>
      <rect x={3} y={7} width={18} height={10} rx={0.6} />
      <line x1={9} y1={7}  x2={9} y2={17} />
      <line x1={15} y1={7} x2={15} y2={17} />
      <line x1={3} y1={12} x2={21} y2={12} />
    </g>
  ),
  'sto.nvr': (
    <g>
      <rect x={3} y={7} width={18} height={10} rx={0.6} />
      <rect x={5} y={9} width={3} height={2} />
      <rect x={10} y={9} width={3} height={2} />
      <line x1={5} y1={14} x2={19} y2={14} />
      <circle cx={18.5} cy={9.5} r={0.5} fill="currentColor" stroke="none" />
    </g>
  ),
  'sto.server': (
    <g>
      <rect x={3} y={5} width={18} height={5} rx={0.4} />
      <rect x={3} y={11} width={18} height={5} rx={0.4} />
      <rect x={3} y={17} width={18} height={3} rx={0.4} />
      <circle cx={18} cy={7.5} r={0.5} fill="currentColor" stroke="none" />
      <circle cx={18} cy={13.5} r={0.5} fill="currentColor" stroke="none" />
    </g>
  ),

  // ── Cabling
  'cab.cable': (
    <g>
      <path d="M 3 18 C 8 18 8 6 12 6 S 16 18 21 18" />
    </g>
  ),
  'cab.bundle': (
    <g>
      <path d="M 3 16 C 8 16 8 4 12 4 S 16 16 21 16" />
      <path d="M 3 19 C 8 19 8 7 12 7 S 16 19 21 19" />
    </g>
  ),
  'cab.conduit': (
    <g>
      <line x1={3} y1={11} x2={21} y2={11} />
      <line x1={3} y1={13} x2={21} y2={13} />
      <line x1={3} y1={11} x2={3}  y2={13} />
      <line x1={21} y1={11} x2={21} y2={13} />
    </g>
  ),
  'cab.tray': (
    <g>
      <rect x={3} y={9} width={18} height={6} />
      {[6,9,12,15,18].map((x) => <line key={x} x1={x} y1={9} x2={x} y2={15} strokeWidth="0.7" />)}
    </g>
  ),
  'cab.jhook': (
    <g>
      <path d="M 5 5 L 5 13 A 4 4 0 0 0 9 17" />
      <path d="M 15 17 A 4 4 0 0 0 19 13 L 19 5" />
    </g>
  ),
  'cab.pullbox': (
    <g>
      <rect x={6} y={6} width={12} height={12} rx={0.8} />
      <line x1={6}  y1={12} x2={3}  y2={12} />
      <line x1={18} y1={12} x2={21} y2={12} />
      <circle cx={9}  cy={9}  r={0.6} fill="currentColor" stroke="none" />
      <circle cx={15} cy={9}  r={0.6} fill="currentColor" stroke="none" />
      <circle cx={9}  cy={15} r={0.6} fill="currentColor" stroke="none" />
      <circle cx={15} cy={15} r={0.6} fill="currentColor" stroke="none" />
    </g>
  ),
  'cab.jbox': (
    <g>
      <rect x={7} y={7} width={10} height={10} rx={0.8} />
      <line x1={7}  y1={12} x2={4}  y2={12} />
      <line x1={17} y1={12} x2={20} y2={12} />
    </g>
  ),
  'cab.coupler': (
    <g>
      <line x1={2}  y1={12} x2={8}  y2={12} />
      <rect x={8}  y={9}  width={8} height={6} rx={0.6} />
      <line x1={16} y1={12} x2={22} y2={12} />
    </g>
  ),
  'cab.jack': (
    <g>
      <rect x={7} y={5} width={10} height={14} rx={1} />
      <line x1={9}  y1={9}  x2={15} y2={9} />
      <line x1={9}  y1={12} x2={15} y2={12} />
      <line x1={9}  y1={15} x2={15} y2={15} />
    </g>
  ),
  'cab.jack-shld': (
    <g>
      <rect x={5} y={4} width={14} height={16} rx={1.2} />
      <rect x={7} y={6}  width={10} height={12} rx={0.8} />
      <line x1={9}  y1={9}  x2={15} y2={9} />
      <line x1={9}  y1={12} x2={15} y2={12} />
      <line x1={9}  y1={15} x2={15} y2={15} />
    </g>
  ),
  'cab.jack-outdoor': (
    <g>
      <rect x={5} y={5} width={14} height={14} rx={2} />
      <rect x={7} y={7}  width={10} height={10} rx={0.8} />
      <line x1={9}  y1={10} x2={15} y2={10} />
      <line x1={9}  y1={12} x2={15} y2={12} />
      <line x1={9}  y1={14} x2={15} y2={14} />
    </g>
  ),
  'cab.patchcord': (
    <g>
      <path d="M 3 8 C 8 8 8 16 12 16 S 16 8 21 8" />
      <rect x={2} y={6}  width={3} height={4} rx={0.4} />
      <rect x={19} y={6} width={3} height={4} rx={0.4} />
    </g>
  ),
  'cab.firestop': (
    <g>
      <rect x={5} y={9} width={14} height={6} rx={0.8} />
      <line x1={5}  y1={12} x2={2}  y2={12} />
      <line x1={19} y1={12} x2={22} y2={12} />
      <path d="M 9 9 L 11 15 M 13 9 L 15 15" />
    </g>
  ),
  'cab.sleeve': (
    <g>
      <ellipse cx={12} cy={12} rx={9} ry={3} />
      <line x1={3}  y1={12} x2={1}  y2={12} />
      <line x1={21} y1={12} x2={23} y2={12} />
    </g>
  ),
  'cab.wallplate': (
    <g>
      <rect x={5} y={5} width={14} height={14} rx={0.6} />
      <rect x={8} y={9} width={8}  height={6}  rx={0.4} />
    </g>
  ),
  'cab.terminal': (
    <g>
      <rect x={3} y={9} width={18} height={6} />
      {[5,8,11,14,17,20].map((x) => <line key={x} x1={x} y1={9} x2={x} y2={15} strokeWidth="0.7" />)}
    </g>
  ),
  'cab.splice': (
    <g>
      <rect x={3} y={8} width={18} height={8} rx={0.6} />
      <line x1={6}  y1={10.5} x2={18} y2={10.5} strokeWidth="0.7" />
      <line x1={6}  y1={13.5} x2={18} y2={13.5} strokeWidth="0.7" />
    </g>
  ),
  'cab.mgr': (
    <g>
      <rect x={3} y={10} width={18} height={4} rx={0.4} />
      <line x1={3} y1={12} x2={21} y2={12} strokeDasharray="2 2" strokeWidth="0.7" />
    </g>
  ),
  'cab.pp24': (
    <g>
      <rect x={2} y={9} width={20} height={6} rx={0.6} />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x={3 + i * 1.6} y={10.5} width={1.1} height={3} />
      ))}
      <text x={12} y={20.5} textAnchor="middle" fontSize="3.2" fontWeight="700" fill="currentColor" stroke="none">24</text>
    </g>
  ),
  'cab.pp48': (
    <g>
      <rect x={1} y={9} width={22} height={6} rx={0.6} />
      {Array.from({ length: 16 }).map((_, i) => (
        <rect key={i} x={2 + i * 1.3} y={10.5} width={0.9} height={3} />
      ))}
      <text x={12} y={20.5} textAnchor="middle" fontSize="3.2" fontWeight="700" fill="currentColor" stroke="none">48</text>
    </g>
  ),
  'cab.pp-fiber': (
    <g>
      <rect x={2} y={9} width={20} height={6} rx={0.6} />
      {Array.from({ length: 8 }).map((_, i) => (
        <circle key={i} cx={3.5 + i * 2.3} cy={12} r={0.7} />
      ))}
      <text x={12} y={20.5} textAnchor="middle" fontSize="3.2" fontWeight="700" fill="currentColor" stroke="none">FO</text>
    </g>
  ),

  // ── Power
  'pwr.psu': (
    <g>
      <rect x={5} y={7} width={14} height={10} rx={0.8} />
      <text x={12} y={14} textAnchor="middle" fontSize="6" fontWeight="700" fill="currentColor" stroke="none">⏻</text>
    </g>
  ),
  'pwr.transformer': (
    <g>
      <circle cx={9} cy={12} r={4.5} />
      <circle cx={15} cy={12} r={4.5} />
    </g>
  ),
  'pwr.battery': (
    <g>
      <rect x={4} y={8} width={16} height={8} rx={1} />
      <rect x={20} y={10} width={1.5} height={4} />
      <line x1={8}  y1={11} x2={8}  y2={13} />
      <line x1={12} y1={11} x2={12} y2={13} />
      <line x1={16} y1={11} x2={16} y2={13} />
    </g>
  ),
  'pwr.poe': (
    <g>
      <rect x={3} y={9} width={18} height={6} rx={0.6} />
      <text x={12} y={13.5} textAnchor="middle" fontSize="4.5" fontWeight="700" fill="currentColor" stroke="none">PoE</text>
    </g>
  ),
  'pwr.ups': (
    <g>
      <rect x={5} y={5} width={14} height={14} rx={1} />
      <path d="M 11 8 L 9 13 L 13 13 L 11 18" />
    </g>
  ),

  // ── Sensors / fire — minimal coverage
  'sen.motion': (
    <g>
      <path d="M 5 18 L 12 5 L 19 18 Z" />
      <line x1={9} y1={14} x2={15} y2={14} />
    </g>
  ),
  'sen.glass': (
    <g>
      <rect x={5} y={5} width={14} height={14} />
      <line x1={5} y1={5} x2={19} y2={19} />
      <line x1={19} y1={5} x2={5} y2={19} />
    </g>
  ),
  'sen.smoke': (
    <g>
      <circle cx={12} cy={12} r={7.5} />
      <circle cx={12} cy={12} r={3.5} />
      <circle cx={12} cy={12} r={1.2} fill="currentColor" stroke="none" />
    </g>
  ),
  'fire.pull': (
    <g>
      <rect x={6} y={4} width={12} height={16} rx={1} />
      <rect x={9} y={10} width={6} height={4} />
      <line x1={9}  y1={7} x2={15} y2={7} strokeWidth="0.7" />
    </g>
  ),
  'fire.horn': (
    <g>
      <rect x={5} y={9} width={10} height={6} rx={0.8} />
      <path d="M 15 9 L 20 5 L 20 19 L 15 15 Z" />
    </g>
  ),
};

/** Render a single symbol scaled into a parent transform. The symbol's
 *  natural viewBox is 24×24; pass `size` to scale up/down (16/24/32). */
export function SurveyorSymbol({
  id, size = 24, stroke = 1.4, className, style,
}: {
  id: SymbolId | string;
  size?: number;
  stroke?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const body = SYMBOLS[id];
  if (!body) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VB} ${VB}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
      style={style}
    >
      {body}
    </svg>
  );
}

/** Render the symbol body as <g> children for use INSIDE an existing
 *  parent <svg>. Used by HardwareGlyph which positions + scales devices
 *  in plan coordinates and wants raw SVG children, not a nested <svg>. */
export function SurveyorSymbolBody({
  id, scale = 1, stroke = 1.4,
}: { id: SymbolId | string; scale?: number; stroke?: number }) {
  const body = SYMBOLS[id];
  if (!body) return null;
  // Translate so the symbol's centre (12,12 in its 24-unit viewBox)
  // sits at the origin, then scale to the requested size.
  const half = VB / 2;
  return (
    <g
      transform={`scale(${scale}) translate(${-half}, ${-half})`}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {body}
    </g>
  );
}

export const SURVEYOR_SYMBOL_IDS = Object.keys(SYMBOLS) as SymbolId[];
