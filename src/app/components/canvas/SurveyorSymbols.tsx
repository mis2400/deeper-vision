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
  | 'acc.biometric' | 'acc.turnstile' | 'acc.panic-bar'
  // Infrastructure
  | 'inf.door-single' | 'inf.door-double' | 'inf.door-storefront'
  | 'inf.door-sliding' | 'inf.gate-swing' | 'inf.gate-slide'
  | 'inf.elevator' | 'inf.window' | 'inf.wall' | 'inf.wall-brick' | 'inf.wall-fire'
  | 'inf.wall-concrete'
  // Network / IDF
  | 'net.idf' | 'net.mdf' | 'inf.rack' | 'inf.mdf'
  | 'net.switch' | 'net.patch' | 'net.ap' | 'net.firewall' | 'net.bridge'
  | 'sto.nvr' | 'sto.server' | 'sto.archive' | 'sto.cloud'
  // Cabling
  | 'cab.cable' | 'cab.bundle' | 'cab.conduit' | 'cab.pullbox' | 'cab.jbox'
  | 'cab.jhook' | 'cab.tray' | 'cab.coupler' | 'cab.jack'
  | 'cab.jack-shld' | 'cab.jack-outdoor' | 'cab.patchcord'
  | 'cab.firestop' | 'cab.sleeve' | 'cab.wallplate' | 'cab.terminal' | 'cab.splice' | 'cab.mgr'
  | 'cab.pp24' | 'cab.pp48' | 'cab.pp-fiber'
  // Power
  | 'pwr.psu' | 'pwr.transformer' | 'pwr.battery' | 'pwr.poe' | 'pwr.ups'
  | 'pwr.surge' | 'pwr.solar'
  // Sensors
  | 'sen.motion' | 'sen.glass' | 'sen.smoke'
  | 'sen.temp' | 'sen.water' | 'sen.occupancy' | 'sen.gas' | 'sen.gunshot'
  // Intrusion alarm panel sensors (aliases share JSX with their sen.*
  // / acc.* counterparts — same physical hardware, different domain id)
  | 'int.motion' | 'int.glassbreak' | 'int.contact'
  | 'int.panic' | 'int.vibration' | 'int.keypad'
  // Audio
  | 'aud.speaker' | 'aud.mic' | 'aud.amp' | 'aud.horn' | 'aud.intercom'
  // Display
  | 'dis.monitor' | 'dis.wall' | 'dis.kiosk' | 'dis.signage'
  // Fire / life safety
  | 'fire.pull' | 'fire.horn'
  | 'fls.pull-station' | 'fls.fire-panel' | 'fls.strobe' | 'fls.sprinkler'
  // Cyber (plan style appliances)
  | 'cyb.endpoint' | 'cyb.siem' | 'cyb.firewall-ng' | 'cyb.vpn'
  // Building systems
  | 'bld.hvac-controller' | 'bld.lighting-panel' | 'bld.bms-gateway';

const VB = 24;

/** Each entry returns the SVG body that lives inside a `<g>` already
 *  positioned in the consumer; we keep them small and let the wrapper
 *  scale + translate. Stroke is `currentColor`, no fills, no halos. */
const SYMBOLS: Record<string, React.ReactNode> = {
  // ── Cameras — pictorial silhouettes of the actual hardware (V3.6
  //    recognizability pass). Each glyph shows the device's real form
  //    so a glance on the plan reads as "security camera" rather than
  //    abstract plan marker. Side elevation for directional cameras
  //    (bullet / turret / PTZ / LPR / thermal / body) — lens points
  //    right at rot=0, so `d.rot` rotates the camera the way it
  //    physically swings on its mount. Top-down for symmetric ones
  //    (multisensor / fisheye). Dome uses side elevation because
  //    top-down dome is indistinguishable from any other circular
  //    ceiling fixture. All glyphs centered at (12,12) of the 24-unit
  //    viewBox, monoline currentColor, designed legible at ~17 px
  //    plotted canvas size and at 14-32 px in the dock.
  'cam.dome': (
    // Hanging hemisphere on a mounting plate. Reads as ceiling dome.
    <g>
      <line x1={5} y1={8.5} x2={19} y2={8.5} />
      <path d="M 5 8.5 a 7 7 0 0 0 14 0" />
      <circle cx={12} cy={13.5} r={1.4} fill="currentColor" stroke="none" />
    </g>
  ),
  'cam.bullet': (
    // Cylindrical body + sunshade + lens on the right + L-shape arm
    // mount + wall base. Iconic bullet camera silhouette.
    <g>
      <rect x={5} y={10} width={11} height={6} rx={1.6} />
      <path d="M 4 8.5 L 17 8.5 L 17 11 L 15.5 11" />
      <circle cx={14.5} cy={13} r={1.3} />
      <path d="M 5 13 L 3 13 L 3 19" />
      <line x1={1.5} y1={19} x2={4.5} y2={19} />
    </g>
  ),
  'cam.turret': (
    // Eyeball turret: half-sphere "eyeball" body on a flat gimbal ring,
    // with a prominent center lens. Distinct from dome (gimballed ball
    // rather than hemisphere hanging from a plate).
    <g>
      <ellipse cx={12} cy={17} rx={7} ry={1.5} />
      <path d="M 5 17 a 7 5 0 0 1 14 0" />
      <circle cx={12} cy={13.5} r={2.2} />
      <circle cx={12} cy={13.5} r={0.7} fill="currentColor" stroke="none" />
    </g>
  ),
  'cam.ptz': (
    // Pendant PTZ: stem at top, larger pendant dome, motorized lens
    // inside. Distinct from dome (pendant on stem rather than flush
    // ceiling mount) and from turret (larger, mast-mounted).
    <g>
      <rect x={11} y={2.5} width={2} height={3.5} />
      <line x1={8.5} y1={6.5} x2={15.5} y2={6.5} />
      <path d="M 6.5 6.5 L 6.5 13 a 5.5 6 0 0 0 11 0 L 17.5 6.5" />
      <circle cx={12} cy={13.5} r={2.3} />
      <circle cx={12} cy={13.5} r={0.7} fill="currentColor" stroke="none" />
    </g>
  ),
  'cam.multisensor': (
    // Top-down: central dome housing with four lens apertures at the
    // compass points. Reads as multi-imager fish on a single mount.
    <g>
      <circle cx={12} cy={12} r={8} />
      <circle cx={12} cy={6.5} r={1.7} />
      <circle cx={17.5} cy={12} r={1.7} />
      <circle cx={12} cy={17.5} r={1.7} />
      <circle cx={6.5} cy={12} r={1.7} />
    </g>
  ),
  'cam.fisheye': (
    // Top-down: dome housing with a single large central lens that
    // dominates the housing. Distinct from multisensor (one big lens
    // versus four small).
    <g>
      <circle cx={12} cy={12} r={8} />
      <circle cx={12} cy={12} r={5.5} />
      <circle cx={12} cy={12} r={1.4} fill="currentColor" stroke="none" />
    </g>
  ),
  'cam.lpr': (
    // Long-barrel bullet for plate reading + a small license-plate
    // rectangle below the camera so the intent is unambiguous.
    <g>
      <rect x={3} y={10} width={13} height={6} rx={1.6} />
      <path d="M 2 8.5 L 17 8.5 L 17 11 L 15.5 11" />
      <circle cx={14.5} cy={13} r={1.3} />
      <path d="M 3 13 L 1 13 L 1 19" />
      <line x1={-0.5} y1={19} x2={2.5} y2={19} />
      <rect x={8} y={18.5} width={6} height={2.2} rx={0.3} strokeOpacity="0.6" />
    </g>
  ),
  'cam.thermal': (
    // Bullet form with a slightly larger lens (germanium glass) and
    // three short radiating dashes from the lens face indicating
    // thermal sensing.
    <g>
      <rect x={5} y={10} width={11} height={6} rx={1.6} />
      <path d="M 4 8.5 L 17 8.5 L 17 11 L 15.5 11" />
      <circle cx={14.5} cy={13} r={1.7} />
      <path d="M 5 13 L 3 13 L 3 19" />
      <line x1={1.5} y1={19} x2={4.5} y2={19} />
      <line x1={17.5} y1={11.5} x2={19.5} y2={10.5} strokeOpacity="0.6" />
      <line x1={17.5} y1={13} x2={20} y2={13} strokeOpacity="0.6" />
      <line x1={17.5} y1={14.5} x2={19.5} y2={15.5} strokeOpacity="0.6" />
    </g>
  ),
  'cam.body': (
    // Compact body-worn camera: small rectangular housing with a
    // belt/chest clip on top and a prominent front lens. The little
    // filled dot below the lens reads as the recording indicator
    // every body cam carries.
    <g>
      <rect x={7} y={7} width={10} height={11} rx={1.2} />
      <rect x={10} y={4} width={4} height={3.5} rx={0.4} />
      <circle cx={12} cy={11} r={1.8} />
      <circle cx={9} cy={15} r={0.6} fill="currentColor" stroke="none" />
    </g>
  ),

  // ── Access — pictorial silhouettes of the actual wall-mount device
  //    (V3.6 recognizability pass). Each is drawn as a tall wall plate
  //    with the distinguishing physical feature so a glance reads as
  //    "card reader" / "keypad" / "biometric" etc.
  'acc.reader': (
    // Vertical wall plate, top-edge LED indicator dot, and a small
    // credit-card-shaped slot. Matches the explicitly approved spec.
    <g>
      <rect x={8} y={3} width={8} height={18} rx={1} />
      <circle cx={12} cy={6} r={0.9} fill="currentColor" stroke="none" />
      <rect x={9.5} y={10} width={5} height={7} rx={0.5} />
      <rect x={10.5} y={11.5} width={3} height={2.4} rx={0.25} strokeOpacity={0.7} />
      <line x1={10.5} y1={15.5} x2={13.5} y2={15.5} strokeOpacity={0.55} />
    </g>
  ),
  'acc.keypad': (
    // Vertical wall plate with 4x3 push-button grid + indicator LED.
    <g>
      <rect x={7} y={3} width={10} height={18} rx={1} />
      <circle cx={12} cy={5.5} r={0.7} fill="currentColor" stroke="none" />
      {[0,1,2].map((c) => [0,1,2,3].map((r) => (
        <circle key={`${c}-${r}`} cx={9 + c * 3} cy={9 + r * 3.2} r={1} />
      )))}
    </g>
  ),
  'acc.biometric': (
    // Vertical wall plate with a fingerprint scan window + indicator.
    <g>
      <rect x={8} y={3} width={8} height={18} rx={1} />
      <circle cx={12} cy={6} r={0.9} fill="currentColor" stroke="none" />
      <ellipse cx={12} cy={13} rx={3} ry={3.5} />
      <path d="M 9.8 11.5 a 2.5 2.5 0 0 1 4.4 0" strokeOpacity={0.8} />
      <path d="M 9.5 14 a 3 3 0 0 0 5 0" strokeOpacity={0.7} />
      <path d="M 9.8 16 a 2.5 3 0 0 0 4.4 0" strokeOpacity={0.55} />
    </g>
  ),
  'acc.strike': (
    // Electric strike on the door frame: tall narrow body with a
    // keeper notch on the side. Side elevation.
    <g>
      <rect x={9.5} y={4} width={5} height={16} rx={0.4} />
      <rect x={9.5} y={10} width={5} height={4} fill="currentColor" stroke="none" opacity={0.55} />
      <path d="M 14.5 9 L 17 9 L 17 15 L 14.5 15" />
    </g>
  ),
  'acc.maglock': (
    // Maglock bar mounted on the door header (horizontal slab) with
    // bolt heads visible at each end.
    <g>
      <rect x={2} y={9} width={20} height={5} rx={0.5} />
      <circle cx={5.5} cy={11.5} r={0.9} fill="currentColor" stroke="none" />
      <circle cx={18.5} cy={11.5} r={0.9} fill="currentColor" stroke="none" />
      <line x1={2} y1={14} x2={22} y2={14} strokeOpacity={0.5} />
      <rect x={9} y={14.5} width={6} height={1.6} fill="currentColor" stroke="none" opacity={0.5} />
    </g>
  ),
  'acc.exit': (
    // Wall-mount push-to-exit button: round plate with a clear button
    // in the middle. Reads as "press here to leave."
    <g>
      <rect x={5} y={5} width={14} height={14} rx={1.4} />
      <circle cx={12} cy={12} r={3.5} />
      <circle cx={12} cy={12} r={1.8} fill="currentColor" stroke="none" opacity={0.65} />
    </g>
  ),
  'acc.dps': (
    // Door position sensor (recessed reed switch + magnet): two small
    // cylindrical pucks side-by-side, the conventional pair shape.
    <g>
      <rect x={3.5} y={9} width={7} height={6} rx={3} />
      <rect x={13.5} y={9} width={7} height={6} rx={3} />
      <circle cx={7} cy={12} r={0.8} fill="currentColor" stroke="none" />
      <circle cx={17} cy={12} r={0.8} fill="currentColor" stroke="none" />
      <line x1={10.5} y1={12} x2={13.5} y2={12} strokeOpacity={0.4} strokeDasharray="0.6 0.6" />
    </g>
  ),
  'acc.panic': (
    // Panic / duress button: round red-button style on a small plate.
    <g>
      <rect x={5} y={5} width={14} height={14} rx={2} />
      <circle cx={12} cy={12} r={4.5} />
      <circle cx={12} cy={12} r={2.5} fill="currentColor" stroke="none" opacity={0.85} />
    </g>
  ),
  'acc.controller': (
    // Access control panel enclosure (typically wall-mount in a closet).
    // Rectangle with terminal-strip rows and a status LED.
    <g>
      <rect x={3} y={5} width={18} height={14} rx={1} />
      <line x1={3} y1={8.5} x2={21} y2={8.5} strokeOpacity={0.55} />
      <circle cx={6} cy={7} r={0.7} fill="currentColor" stroke="none" />
      <circle cx={8.5} cy={7} r={0.7} fill="currentColor" stroke="none" />
      <line x1={5} y1={11.5} x2={19} y2={11.5} strokeOpacity={0.4} />
      <line x1={5} y1={14} x2={19} y2={14} strokeOpacity={0.4} />
      <line x1={5} y1={16.5} x2={19} y2={16.5} strokeOpacity={0.4} />
    </g>
  ),
  'acc.psu': (
    // Wall-mount power supply enclosure: rectangular box with a battery
    // bar inside (back-up battery) and a lightning bolt for power input.
    <g>
      <rect x={4} y={6} width={16} height={12} rx={0.8} />
      <rect x={6.5} y={12} width={11} height={3.5} rx={0.4} strokeOpacity={0.8} />
      <rect x={17.5} y={13} width={1.2} height={1.5} fill="currentColor" stroke="none" />
      <path d="M 11 8 L 9 11 L 12 11 L 10 14" strokeOpacity={0.7} />
    </g>
  ),
  'acc.intercom': (
    // Door / station intercom: vertical wall plate with speaker grille,
    // camera lens, and call button.
    <g>
      <rect x={7} y={3} width={10} height={18} rx={1} />
      <circle cx={12} cy={7} r={1.6} />
      <circle cx={12} cy={7} r={0.6} fill="currentColor" stroke="none" />
      <line x1={9} y1={11.5} x2={15} y2={11.5} strokeOpacity={0.55} />
      <line x1={9} y1={13} x2={15} y2={13} strokeOpacity={0.55} />
      <line x1={9} y1={14.5} x2={15} y2={14.5} strokeOpacity={0.55} />
      <rect x={9.5} y={17} width={5} height={2.5} rx={0.4} fill="currentColor" stroke="none" opacity={0.55} />
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

  // ── Network gear — pictorial silhouettes of the actual rack/wall
  //    hardware. Switches and patch panels show rack-mount ears + a
  //    clear port row; IDFs / MDFs / racks are cabinet silhouettes;
  //    APs are ceiling-mount discs.
  'net.idf': (
    // Wall-mount network cabinet (IDF closet): tall enclosure with a
    // hinged door, hinge marks, ventilation slots at the top.
    <g>
      <rect x={5} y={3} width={14} height={18} rx={0.6} />
      <line x1={11.5} y1={3} x2={11.5} y2={21} strokeOpacity={0.55} />
      <circle cx={9.5} cy={12} r={0.4} fill="currentColor" stroke="none" />
      <circle cx={9.5} cy={15} r={0.4} fill="currentColor" stroke="none" />
      <line x1={7} y1={5.5} x2={10} y2={5.5} strokeOpacity={0.55} />
      <line x1={13} y1={5.5} x2={17} y2={5.5} strokeOpacity={0.55} />
      <line x1={7} y1={7} x2={10} y2={7} strokeOpacity={0.45} />
      <line x1={13} y1={7} x2={17} y2={7} strokeOpacity={0.45} />
    </g>
  ),
  'net.mdf': (
    // Larger enclosure (MDF main distribution frame). Two-door cabinet.
    <g>
      <rect x={3.5} y={3} width={17} height={18} rx={0.6} />
      <line x1={12} y1={3} x2={12} y2={21} strokeOpacity={0.6} />
      <circle cx={10} cy={12} r={0.4} fill="currentColor" stroke="none" />
      <circle cx={14} cy={12} r={0.4} fill="currentColor" stroke="none" />
      <line x1={5.5} y1={5.5} x2={11} y2={5.5} strokeOpacity={0.55} />
      <line x1={13} y1={5.5} x2={18.5} y2={5.5} strokeOpacity={0.55} />
      <line x1={5.5} y1={7} x2={11} y2={7} strokeOpacity={0.45} />
      <line x1={13} y1={7} x2={18.5} y2={7} strokeOpacity={0.45} />
    </g>
  ),
  'inf.rack': (
    // Standalone 42U-ish floor rack: tall frame with rails + a stack
    // of 1U device bars visible.
    <g>
      <rect x={5} y={3} width={14} height={18} rx={0.4} />
      <line x1={7} y1={3} x2={7} y2={21} strokeOpacity={0.55} />
      <line x1={17} y1={3} x2={17} y2={21} strokeOpacity={0.55} />
      {[5,7,9,11,13,15,17,19].map((y) => (
        <line key={y} x1={7} y1={y} x2={17} y2={y} strokeOpacity={0.45} />
      ))}
    </g>
  ),
  'inf.mdf': (
    // MDF cabinet — same shell as net.mdf but slightly smaller, fewer
    // gear hints (used as the canvas-placeable "closet").
    <g>
      <rect x={4} y={3} width={16} height={18} rx={0.6} />
      <line x1={12} y1={3} x2={12} y2={21} strokeOpacity={0.55} />
      <circle cx={10} cy={12} r={0.4} fill="currentColor" stroke="none" />
      <circle cx={14} cy={12} r={0.4} fill="currentColor" stroke="none" />
    </g>
  ),
  'net.switch': (
    // 1U managed switch: rack-mount ears outside the chassis + a row
    // of RJ45 ports in pairs across the front.
    <g>
      <rect x={3.5} y={9.5} width={17} height={5} rx={0.4} />
      <rect x={2.5} y={10} width={1} height={4} fill="currentColor" stroke="none" />
      <rect x={20.5} y={10} width={1} height={4} fill="currentColor" stroke="none" />
      {[0,1,2,3,4,5,6,7].map((i) => (
        <rect key={i} x={4.4 + i * 1.9} y={11} width={1.1} height={2} rx={0.15} strokeOpacity={0.85} />
      ))}
      <circle cx={20} cy={11} r={0.45} fill="currentColor" stroke="none" />
    </g>
  ),
  'net.patch': (
    // 1U patch panel: rack-mount with a dense row of RJ45 jacks and
    // a label-strip notch above each port group.
    <g>
      <rect x={2.5} y={9.5} width={19} height={5} rx={0.4} />
      <rect x={1.5} y={10} width={1} height={4} fill="currentColor" stroke="none" />
      <rect x={21.5} y={10} width={1} height={4} fill="currentColor" stroke="none" />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x={3.2 + i * 1.5} y={11} width={1} height={2.5} rx={0.1} strokeOpacity={0.85} />
      ))}
    </g>
  ),
  'net.ap': (
    // Ceiling-mount wireless access point: round disc with concentric
    // ring suggesting omni-directional propagation.
    <g>
      <circle cx={12} cy={12} r={7.5} />
      <circle cx={12} cy={12} r={3.5} strokeOpacity={0.55} />
      <circle cx={12} cy={12} r={1} fill="currentColor" stroke="none" />
      <line x1={12} y1={20} x2={12} y2={21.5} strokeOpacity={0.45} />
    </g>
  ),
  'net.firewall': (
    // 1U firewall appliance: rack-mount with mounting ears, a shield
    // motif in the center to differentiate from net.switch.
    <g>
      <rect x={3.5} y={8.5} width={17} height={7} rx={0.5} />
      <rect x={2.5} y={9} width={1} height={6} fill="currentColor" stroke="none" />
      <rect x={20.5} y={9} width={1} height={6} fill="currentColor" stroke="none" />
      <path d="M 12 9.5 L 14.5 11 L 14.5 13 L 12 14.5 L 9.5 13 L 9.5 11 Z" />
      <line x1={4.5} y1={12} x2={9} y2={12} strokeOpacity={0.4} />
      <line x1={15} y1={12} x2={19.5} y2={12} strokeOpacity={0.4} />
    </g>
  ),
  'sto.nvr': (
    // Rack-mount NVR with visible drive bays. 4-6 bays, lock + status LED.
    <g>
      <rect x={3} y={7} width={18} height={10} rx={0.4} />
      <rect x={2} y={7.5} width={1} height={9} fill="currentColor" stroke="none" />
      <rect x={21} y={7.5} width={1} height={9} fill="currentColor" stroke="none" />
      {[0,1,2,3,4].map((i) => (
        <rect key={i} x={4.5 + i * 3} y={8.5} width={2.4} height={7} rx={0.2} strokeOpacity={0.75} />
      ))}
      <circle cx={20} cy={9} r={0.45} fill="currentColor" stroke="none" />
      <circle cx={20} cy={10.5} r={0.45} fill="currentColor" stroke="none" />
    </g>
  ),
  'sto.server': (
    // Rack-mount 2U server: chassis with bezel, power button, drive
    // bay grid. Reads as a server box, not a generic rack stack.
    <g>
      <rect x={3} y={7} width={18} height={10} rx={0.5} />
      <rect x={2} y={7.5} width={1} height={9} fill="currentColor" stroke="none" />
      <rect x={21} y={7.5} width={1} height={9} fill="currentColor" stroke="none" />
      <rect x={4.5} y={8.5} width={11} height={7} rx={0.25} strokeOpacity={0.55} />
      {[0,1,2].map((c) => [0,1].map((r) => (
        <rect key={`${c}-${r}`} x={5 + c * 3.6} y={9 + r * 3.2} width={3.2} height={2.6} rx={0.15} strokeOpacity={0.55} />
      )))}
      <circle cx={18.5} cy={10} r={0.6} fill="currentColor" stroke="none" />
      <circle cx={18.5} cy={12.5} r={0.6} />
      <circle cx={18.5} cy={15} r={0.4} fill="currentColor" stroke="none" />
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

  // ── Power — pictorial silhouettes of the actual hardware.
  'pwr.psu': (
    // Wall / rack power supply: rectangular box with a clear AC inlet
    // socket on one side and an output terminal block on the other.
    <g>
      <rect x={4} y={6.5} width={16} height={11} rx={0.6} />
      <rect x={5.5} y={9} width={3.2} height={3.2} rx={0.3} />
      <line x1={5.8} y1={10.5} x2={8.4} y2={10.5} strokeOpacity={0.55} />
      <path d="M 12 8.5 L 10.5 12 L 12.5 12 L 11 15.5" />
      <rect x={15} y={10} width={3.5} height={1} fill="currentColor" stroke="none" />
      <rect x={15} y={12} width={3.5} height={1} fill="currentColor" stroke="none" />
    </g>
  ),
  'pwr.transformer': (
    // Cylindrical transformer with primary + secondary coil windings.
    // Side elevation: two cylinders coupled magnetically.
    <g>
      <ellipse cx={8} cy={12} rx={3} ry={6} />
      <ellipse cx={16} cy={12} rx={3} ry={6} />
      <line x1={8} y1={6} x2={8} y2={6} strokeOpacity={0.55} />
      <line x1={11} y1={9} x2={13} y2={9} />
      <line x1={11} y1={12} x2={13} y2={12} />
      <line x1={11} y1={15} x2={13} y2={15} />
    </g>
  ),
  'pwr.battery': (
    // Standalone battery / backup unit: rectangular cell with a
    // positive-terminal nub on the right and 3 charge bars inside.
    <g>
      <rect x={3.5} y={8} width={16.5} height={8} rx={0.6} />
      <rect x={20} y={10} width={1.6} height={4} rx={0.2} fill="currentColor" stroke="none" />
      <rect x={5} y={9.5} width={3.5} height={5} fill="currentColor" stroke="none" opacity={0.85} />
      <rect x={9} y={9.5} width={3.5} height={5} fill="currentColor" stroke="none" opacity={0.65} />
      <rect x={13} y={9.5} width={3.5} height={5} fill="currentColor" stroke="none" opacity={0.4} />
    </g>
  ),
  'pwr.poe': (
    // Inline PoE injector: small mid-cable box with two RJ45 ports
    // (data-in / data-out + power) and a lightning bolt for power.
    <g>
      <rect x={4} y={9} width={16} height={6} rx={0.6} />
      <line x1={2} y1={12} x2={4} y2={12} strokeOpacity={0.55} />
      <line x1={20} y1={12} x2={22} y2={12} strokeOpacity={0.55} />
      <rect x={5} y={10.5} width={2.4} height={3} rx={0.2} strokeOpacity={0.75} />
      <rect x={16.6} y={10.5} width={2.4} height={3} rx={0.2} strokeOpacity={0.75} />
      <path d="M 11.5 10.2 L 9.5 13 L 12 13 L 10 15.5" />
    </g>
  ),
  'pwr.ups': (
    // Rack-mount UPS: chassis with a clear front LCD, lightning input
    // hint, and a battery cell row inside. Reads as "uninterruptible
    // power supply," not just a generic box.
    <g>
      <rect x={3.5} y={7} width={17} height={10} rx={0.5} />
      <rect x={2.5} y={7.5} width={1} height={9} fill="currentColor" stroke="none" />
      <rect x={20.5} y={7.5} width={1} height={9} fill="currentColor" stroke="none" />
      <rect x={5} y={9} width={7} height={6} rx={0.4} strokeOpacity={0.55} />
      <path d="M 8.5 10 L 7 12.4 L 9 12.4 L 7.5 14.5" strokeOpacity={0.8} />
      <rect x={13.5} y={9.5} width={2} height={5} fill="currentColor" stroke="none" opacity={0.75} />
      <rect x={16} y={9.5} width={2} height={5} fill="currentColor" stroke="none" opacity={0.55} />
      <rect x={18.5} y={11} width={1.5} height={2} fill="currentColor" stroke="none" />
    </g>
  ),

  // ── Sensors + fire — pictorial physical-device silhouettes.
  'sen.motion': (
    // Wall-corner PIR sensor: trapezoid body with a fresnel-lens
    // hemisphere window, mounting tab at the top.
    <g>
      <rect x={9} y={3.5} width={6} height={1.6} rx={0.3} />
      <path d="M 7 5 L 17 5 L 18.5 15 L 5.5 15 Z" />
      <path d="M 6.5 11 a 5.5 4 0 0 0 11 0" />
      <line x1={9} y1={11} x2={9} y2={15} strokeOpacity={0.4} />
      <line x1={12} y1={11} x2={12} y2={15} strokeOpacity={0.4} />
      <line x1={15} y1={11} x2={15} y2={15} strokeOpacity={0.4} />
    </g>
  ),
  'sen.glass': (
    // Glass break detector: small ceiling/wall puck with a
    // microphone aperture + a "shatter" indicator.
    <g>
      <rect x={6} y={6} width={12} height={12} rx={1.5} />
      <circle cx={12} cy={10.5} r={1.6} />
      <circle cx={12} cy={10.5} r={0.5} fill="currentColor" stroke="none" />
      <path d="M 8.5 16 L 12 13.5 L 15.5 16" strokeOpacity={0.7} />
      <line x1={12} y1={13.5} x2={12} y2={17} strokeOpacity={0.55} />
    </g>
  ),
  'sen.smoke': (
    // Ceiling-mount smoke detector: round disc with vent slots
    // around the perimeter, central LED, alarm sounder ring.
    <g>
      <circle cx={12} cy={12} r={8} />
      <circle cx={12} cy={12} r={5} strokeOpacity={0.6} />
      <circle cx={12} cy={12} r={1.1} fill="currentColor" stroke="none" />
      {[0,45,90,135,180,225,270,315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 12 + Math.cos(rad) * 6.5;
        const y1 = 12 + Math.sin(rad) * 6.5;
        const x2 = 12 + Math.cos(rad) * 7.6;
        const y2 = 12 + Math.sin(rad) * 7.6;
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} strokeOpacity={0.5} />;
      })}
    </g>
  ),
  'fire.pull': (
    // Manual pull station: tall housing with a clear pull-down lever
    // and "PULL" label area. The conventional red-rectangle silhouette.
    <g>
      <rect x={5.5} y={3.5} width={13} height={17} rx={0.8} />
      <rect x={7} y={6} width={10} height={3.5} rx={0.3} strokeOpacity={0.65} />
      <rect x={7.5} y={11} width={9} height={4.5} rx={0.5} fill="currentColor" stroke="none" opacity={0.75} />
      <path d="M 9 13 L 15 13" />
      <path d="M 9 13 L 8 14.5 M 15 13 L 16 14.5" strokeOpacity={0.6} />
    </g>
  ),
  'fire.horn': (
    // Wall-mount fire horn / sounder + strobe combo: rounded square
    // body with a circular sounder grille and a star-burst strobe.
    <g>
      <rect x={5} y={6} width={14} height={12} rx={1} />
      <circle cx={8.5} cy={12} r={3} />
      <circle cx={8.5} cy={12} r={1.3} strokeOpacity={0.6} />
      <line x1={15} y1={9} x2={15} y2={15} strokeOpacity={0.6} />
      <line x1={13} y1={10.5} x2={17} y2={10.5} strokeOpacity={0.55} />
      <line x1={13} y1={13.5} x2={17} y2={13.5} strokeOpacity={0.55} />
      <line x1={13.5} y1={11.5} x2={16.5} y2={12.5} strokeOpacity={0.4} />
      <line x1={13.5} y1={12.5} x2={16.5} y2={11.5} strokeOpacity={0.4} />
    </g>
  ),

  // ─────────────────────────────────────────────────────────────────
  // V3.6 unification — new plan-symbol glyphs for the previously
  // lucide-fallback types. Same monochrome currentColor language,
  // 24-unit viewBox, technical voice. Where two device-type ids
  // refer to the same physical object (e.g. int.motion vs sen.motion),
  // the entries share the same JSX so the look is identical.
  // ─────────────────────────────────────────────────────────────────

  // Sensors
  'sen.temp': (
    <g>
      <path d="M 10.5 5 v 9.2 a 2.4 2.4 0 1 0 3 0 v -9.2 a 1.5 1.5 0 1 0 -3 0 z" />
      <line x1={10.5} y1={9} x2={13.5} y2={9} />
      <line x1={10.5} y1={11.5} x2={13.5} y2={11.5} />
    </g>
  ),
  'sen.water': (
    <g>
      <path d="M 12 4 C 6.5 11 7 16.5 12 19.5 C 17 16.5 17.5 11 12 4 Z" />
      <path d="M 9 14.5 C 9.6 16 10.5 17 12 17.2" />
    </g>
  ),
  'sen.occupancy': (
    <g>
      <circle cx={12} cy={7.5} r={2.4} />
      <path d="M 7 19 L 7 13.5 C 7 12 8 11 9.5 11 L 14.5 11 C 16 11 17 12 17 13.5 L 17 19" />
    </g>
  ),
  'sen.gas': (
    <g>
      <path d="M 5 9 C 7 7.5 9 7.5 11 9 C 13 10.5 15 10.5 17 9" />
      <path d="M 5 13 C 7 11.5 9 11.5 11 13 C 13 14.5 15 14.5 17 13" />
      <path d="M 5 17 C 7 15.5 9 15.5 11 17 C 13 18.5 15 18.5 17 17" />
    </g>
  ),
  'sen.gunshot': (
    <g>
      <path d="M 12 4 L 13.4 10.6 L 20 12 L 13.4 13.4 L 12 20 L 10.6 13.4 L 4 12 L 10.6 10.6 Z" />
      <circle cx={12} cy={12} r={1.8} />
    </g>
  ),

  // Intrusion alarm panel sensors. Most are aliases of the corresponding
  // physical sensors already defined above / in the access set.
  'int.motion':     null as any, // set below via alias merge
  'int.glassbreak': null as any,
  'int.contact':    null as any,
  'int.panic':      null as any,
  'int.vibration': (
    <g>
      <rect x={5} y={8} width={14} height={8} rx={1} />
      <path d="M 9 19 q 0.8 -1.5 0 -3" />
      <path d="M 12 19 q 1.1 -1.5 0 -3" />
      <path d="M 15 19 q 0.8 -1.5 0 -3" />
    </g>
  ),
  'int.keypad': null as any,

  // Audio
  'aud.speaker': (
    <g>
      <rect x={6} y={5} width={12} height={14} rx={1} />
      <circle cx={12} cy={10} r={1.6} />
      <circle cx={12} cy={15.2} r={3.0} />
      <circle cx={12} cy={15.2} r={1.2} />
    </g>
  ),
  'aud.mic': (
    <g>
      <rect x={9.5} y={4.5} width={5} height={9} rx={2.5} />
      <path d="M 6.5 12 C 6.5 16 9.5 18 12 18 C 14.5 18 17.5 16 17.5 12" />
      <line x1={12} y1={18} x2={12} y2={20.5} />
      <line x1={9.5} y1={20.5} x2={14.5} y2={20.5} />
    </g>
  ),
  'aud.amp': (
    <g>
      <rect x={3.5} y={7} width={17} height={10} rx={1} />
      <circle cx={7} cy={12} r={1.4} />
      <circle cx={11.5} cy={12} r={1.4} />
      <circle cx={16} cy={12} r={1.4} />
      <line x1={5} y1={9.5} x2={19} y2={9.5} strokeOpacity="0.5" />
    </g>
  ),
  'aud.horn':     null as any, // alias of fire.horn (same hardware)
  'aud.intercom': null as any, // alias of acc.intercom

  // Display
  'dis.monitor': (
    <g>
      <rect x={3.5} y={5} width={17} height={11} rx={1} />
      <line x1={9.5} y1={19} x2={14.5} y2={19} />
      <line x1={12} y1={16} x2={12} y2={19} />
    </g>
  ),
  'dis.wall': (
    <g>
      <rect x={2.5} y={4} width={19} height={13} rx={0.8} />
      <line x1={9} y1={4} x2={9} y2={17} strokeOpacity="0.45" />
      <line x1={15} y1={4} x2={15} y2={17} strokeOpacity="0.45" />
      <line x1={2.5} y1={10.5} x2={21.5} y2={10.5} strokeOpacity="0.45" />
      <line x1={8} y1={20.5} x2={16} y2={20.5} />
    </g>
  ),
  'dis.kiosk': (
    <g>
      <rect x={6} y={3.5} width={12} height={14} rx={1} />
      <rect x={4} y={17.5} width={16} height={3} rx={0.6} />
      <circle cx={12} cy={14.8} r={0.9} fill="currentColor" stroke="none" />
    </g>
  ),
  'dis.signage': (
    <g>
      <rect x={3} y={6} width={18} height={10} rx={0.8} />
      <line x1={6} y1={9.5} x2={15} y2={9.5} strokeOpacity="0.6" />
      <line x1={6} y1={12.5} x2={18} y2={12.5} strokeOpacity="0.6" />
      <line x1={11} y1={16} x2={11} y2={20} />
      <line x1={9} y1={20} x2={13} y2={20} />
    </g>
  ),

  // Power / electrical
  'pwr.surge': (
    <g>
      <rect x={4} y={6} width={16} height={12} rx={1} />
      <path d="M 12 8.5 L 10 12.5 L 12 12.5 L 10 15.5" />
      <line x1={7} y1={11} x2={8.5} y2={11} />
      <line x1={15.5} y1={11} x2={17} y2={11} />
    </g>
  ),
  'pwr.solar': (
    <g>
      <rect x={4} y={11} width={16} height={9} rx={0.6} />
      <line x1={9.3} y1={11} x2={9.3} y2={20} strokeOpacity="0.55" />
      <line x1={14.7} y1={11} x2={14.7} y2={20} strokeOpacity="0.55" />
      <line x1={4} y1={15.5} x2={20} y2={15.5} strokeOpacity="0.55" />
      <circle cx={12} cy={6.5} r={2.6} />
      <line x1={12} y1={2.5} x2={12} y2={3.8} />
      <line x1={12} y1={9.2} x2={12} y2={10.5} />
      <line x1={8.5} y1={6.5} x2={9.6} y2={6.5} />
      <line x1={14.4} y1={6.5} x2={15.5} y2={6.5} />
    </g>
  ),

  // Cyber (abstract — represented as plan-style appliances)
  'cyb.endpoint': (
    <g>
      <rect x={4} y={5.5} width={16} height={10} rx={0.8} />
      <rect x={2.5} y={17} width={19} height={2.2} rx={0.6} />
    </g>
  ),
  'cyb.siem': (
    <g>
      <rect x={4} y={5} width={16} height={14} rx={1} />
      <polyline points="6.5,15 9.5,11.5 12,13.5 14.5,9.5 17.5,12" />
      <line x1={6.5} y1={15} x2={17.5} y2={15} strokeOpacity="0.55" />
    </g>
  ),
  'cyb.firewall-ng': null as any, // alias of net.firewall (same plan symbol)
  'cyb.vpn': (
    <g>
      <rect x={4} y={5} width={16} height={14} rx={1} />
      <rect x={9.5} y={11.5} width={5} height={4} rx={0.4} />
      <path d="M 10.5 11.5 v -1.5 a 1.5 1.5 0 0 1 3 0 v 1.5" fill="none" />
    </g>
  ),

  // Fire / life safety
  'fls.pull-station': null as any, // alias of fire.pull
  'fls.fire-panel': (
    <g>
      <rect x={3.5} y={4} width={17} height={16} rx={1} />
      <rect x={6} y={6.5} width={12} height={4} rx={0.5} />
      <circle cx={7.5} cy={14} r={0.9} fill="currentColor" stroke="none" />
      <circle cx={11} cy={14} r={0.9} />
      <circle cx={14.5} cy={14} r={0.9} />
      <circle cx={17} cy={14} r={0.9} />
      <line x1={5.5} y1={17.5} x2={18.5} y2={17.5} strokeOpacity="0.55" />
    </g>
  ),
  'fls.strobe': (
    <g>
      <rect x={6} y={7} width={12} height={9} rx={0.8} />
      <path d="M 9.5 11.5 L 12 11.5 L 10.5 14.5 L 13 14.5 L 11 17.5" />
      <line x1={4} y1={5} x2={6.5} y2={7.5} strokeOpacity="0.55" />
      <line x1={20} y1={5} x2={17.5} y2={7.5} strokeOpacity="0.55" />
      <line x1={4} y1={18} x2={6.5} y2={15.5} strokeOpacity="0.55" />
      <line x1={20} y1={18} x2={17.5} y2={15.5} strokeOpacity="0.55" />
    </g>
  ),
  'fls.sprinkler': (
    <g>
      <line x1={12} y1={3.5} x2={12} y2={9.5} />
      <circle cx={12} cy={11.5} r={2.2} />
      <line x1={12} y1={13.7} x2={12} y2={20} />
      <line x1={9.5} y1={20} x2={14.5} y2={20} />
      <line x1={6.5} y1={18.5} x2={9.5} y2={20} strokeOpacity="0.55" />
      <line x1={17.5} y1={18.5} x2={14.5} y2={20} strokeOpacity="0.55" />
    </g>
  ),

  // Building systems
  'bld.hvac-controller': (
    <g>
      <rect x={3.5} y={4} width={17} height={16} rx={1} />
      <circle cx={12} cy={12} r={4} />
      <line x1={12} y1={8} x2={12} y2={16} strokeOpacity="0.55" />
      <line x1={8} y1={12} x2={16} y2={12} strokeOpacity="0.55" />
      <circle cx={12} cy={12} r={1.1} fill="currentColor" stroke="none" />
    </g>
  ),
  'bld.lighting-panel': (
    <g>
      <rect x={3.5} y={4} width={17} height={16} rx={1} />
      <path d="M 10 9.5 q 2 -3 4 0 q 0 2 -1.5 3 v 1.5 h -1 v -1.5 q -1.5 -1 -1.5 -3 z" />
      <line x1={11.2} y1={15.5} x2={12.8} y2={15.5} />
      <line x1={6} y1={18} x2={18} y2={18} strokeOpacity="0.55" />
    </g>
  ),
  'bld.bms-gateway': (
    <g>
      <rect x={3.5} y={5} width={17} height={14} rx={1} />
      <line x1={3.5} y1={9} x2={20.5} y2={9} strokeOpacity="0.55" />
      <circle cx={6.5} cy={7} r={0.7} fill="currentColor" stroke="none" />
      <line x1={6} y1={12.5} x2={18} y2={12.5} strokeOpacity="0.55" />
      <line x1={6} y1={15.5} x2={18} y2={15.5} strokeOpacity="0.55" />
    </g>
  ),

  // Access — additions for the gap types
  'acc.turnstile': (
    <g>
      <circle cx={12} cy={12} r={1.8} />
      <line x1={12} y1={10.2} x2={12} y2={4.5} />
      <line x1={12} y1={13.8} x2={12} y2={19.5} />
      <line x1={10.2} y1={12} x2={4.5} y2={12} />
      <line x1={13.8} y1={12} x2={19.5} y2={12} />
    </g>
  ),
  'acc.panic-bar': (
    <g>
      <rect x={4} y={8} width={16} height={8} rx={1} />
      <rect x={5.5} y={10.8} width={13} height={2.4} rx={0.4} fill="currentColor" stroke="none" opacity={0.85} />
    </g>
  ),

  // Network bridge — a wireless link box. Distinct from net.ap (point
  // to point versus omnidirectional).
  'net.bridge': (
    <g>
      <rect x={5} y={9} width={14} height={7} rx={0.6} />
      <path d="M 3.5 8 q 1.5 -2 3 -2" />
      <path d="M 20.5 8 q -1.5 -2 -3 -2" />
      <circle cx={9} cy={12.5} r={0.7} fill="currentColor" stroke="none" />
      <circle cx={15} cy={12.5} r={0.7} fill="currentColor" stroke="none" />
    </g>
  ),

  // Infrastructure — alias for inf.wall-concrete (uses inf.wall body)
  'inf.wall-concrete': null as any,

  // Storage — additions
  'sto.archive': (
    <g>
      <rect x={3.5} y={5} width={17} height={14} rx={0.5} />
      <rect x={5.5} y={7} width={13} height={2.2} />
      <rect x={5.5} y={10.5} width={13} height={2.2} />
      <rect x={5.5} y={14} width={13} height={2.2} />
    </g>
  ),
  'sto.cloud': (
    <g>
      <path d="M 7 15 A 3.4 3.4 0 0 1 7.8 8.5 A 4.2 4.2 0 0 1 15.5 8.5 A 2.8 2.8 0 0 1 17 14 A 2.6 2.6 0 0 1 15.5 15 L 7 15 Z" />
    </g>
  ),
};

// ─── Alias merge — same hardware, different ids ────────────────────
// Plan symbols are shared between alias keys so the look is identical.
SYMBOLS['int.motion']        = SYMBOLS['sen.motion'];
SYMBOLS['int.glassbreak']    = SYMBOLS['sen.glass'];
SYMBOLS['int.contact']       = SYMBOLS['acc.dps'];
SYMBOLS['int.panic']         = SYMBOLS['acc.panic'];
SYMBOLS['int.keypad']        = SYMBOLS['acc.keypad'];
SYMBOLS['aud.horn']          = SYMBOLS['fire.horn'];
SYMBOLS['aud.intercom']      = SYMBOLS['acc.intercom'];
SYMBOLS['cyb.firewall-ng']   = SYMBOLS['net.firewall'];
SYMBOLS['fls.pull-station']  = SYMBOLS['fire.pull'];
SYMBOLS['inf.wall-concrete'] = SYMBOLS['inf.wall'];

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
  //
  // V3.6 stroke math fix: the SVG transform scales BOTH geometry and
  // strokeWidth, so a `stroke=1.1` rendered through `transform="scale(0.72)"`
  // produced a sub-pixel 0.79 px stroke that anti-aliased to a soft
  // smudge on every display. Counter-scale the stroke here so the
  // `stroke` prop reflects the rendered pixel width in the OUTER
  // coordinate space. Canvas zoom still scales the stroke naturally
  // with the rest of the drawing — CAD-style behavior preserved.
  const half = VB / 2;
  const effectiveStroke = scale > 0 ? stroke / scale : stroke;
  return (
    <g
      transform={`scale(${scale}) translate(${-half}, ${-half})`}
      fill="none"
      stroke="currentColor"
      strokeWidth={effectiveStroke}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {body}
    </g>
  );
}

export const SURVEYOR_SYMBOL_IDS = Object.keys(SYMBOLS) as SymbolId[];
