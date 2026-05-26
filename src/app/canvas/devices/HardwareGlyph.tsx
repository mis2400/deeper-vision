// HardwareGlyph — extracted from screens/EngineeringCanvas.tsx as
// part of the M11 monolith breakup. Renders the schematic plan glyph
// for a single placed device, including the selection ring + halo.
//
// Pure module-level component — no closures on EngineeringCanvas
// state. All inputs come in via props (Device, tone string,
// selected flag, optional scale).
//
// Uses:
//   - SurveyorSymbolBody from components/canvas/SurveyorSymbols for
//     the symbol set (cameras, doors, gates, IDFs, sensors, etc).
//   - TYPE_KIND / KIND_TONE from canvas/constants for category routing.
//   - deviceTone from canvas/utils for the resolved per-device color.

import { SurveyorSymbol, SurveyorSymbolBody } from '../../components/canvas/SurveyorSymbols';
import { KIND_TONE, TYPE_KIND } from '../constants';
import type { Device } from '../types';
import { SURVEYOR_SYMBOL_HAS, deviceTone, isStackableHost } from '../utils';

export function HardwareGlyph({ d, tone, selected, scale = 1 }: { d: Device; tone: string; selected: boolean; scale?: number }) {
  const kind = TYPE_KIND[d.type];
  const rot = d.rot;
  // V3.6 Part B color rule: plotted marker uses the resolved
  // device tone (item override > category override > KIND_TONE
  // default). The selection ring stays its own cool var(--primary)
  // signal so a selected device is always distinguishable from its
  // assigned color regardless of where on the palette that color sits.
  const ink = deviceTone(d);
  // M11 visual redesign — stroke 1.4 → 1.5 so canvas device symbols
  // match the consistent 1.5 px stroke used across the rails, the
  // selection menu, and the inspector. Subtle but it pulls every
  // device on the plan into one visual language.
  const sw = 1.5;
  const accKind = (d as any).accessoryKind as string | undefined;

  // Distinct technical glyphs for cable accessories. Drawn before the
  // generic kind-based branches so a patch panel / jack / pull box
  // reads correctly even though the underlying DeviceType is `net.switch`.
  if (accKind) {
    return (
      <g transform={`translate(${d.x}, ${d.y}) scale(${scale})`}>
        {/* Quiet knock-out behind the glyph so the symbol stays legible
            against the floorplan, no decorative tone halo. */}
        <circle r={12} fill="var(--canvas-background)" opacity="0.96" stroke={ink} strokeOpacity="0.55" strokeWidth="0.7" />
        <g fill="none" stroke={ink} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
          {(accKind === 'jack' || accKind === 'jack-shld' || accKind === 'jack-outdoor' || accKind === 'biscuit') && (
            <g>
              <rect x={-4} y={-6} width={8} height={12} rx={1.5} />
              <line x1={-2.5} y1={-3} x2={2.5} y2={-3} />
              <line x1={-2.5} y1={0}  x2={2.5} y2={0}  />
              <line x1={-2.5} y1={3}  x2={2.5} y2={3}  />
            </g>
          )}
          {(accKind === 'coupler' || accKind === 'coupler-rj45' || accKind === 'coupler-wp' || accKind === 'coupler-lc' || accKind === 'coupler-sc' || accKind === 'coupler-coax') && (
            <g>
              <line x1={-9} y1={0} x2={-3} y2={0} />
              <rect x={-3} y={-3} width={6} height={6} rx={1} />
              <line x1={3} y1={0} x2={9} y2={0} />
            </g>
          )}
          {(accKind === 'patchcord') && (
            <g>
              <path d="M -8 -4 C -2 -4 2 4 8 4" />
              <circle cx={-8} cy={-4} r={1.2} fill={ink} />
              <circle cx={8}  cy={4}  r={1.2} fill={ink} />
            </g>
          )}
          {(accKind === 'pp24' || accKind === 'pp48' || accKind === 'pp-fiber') && (
            <g>
              <rect x={-11} y={-4} width={22} height={8} rx={1.2} />
              {[-8.5,-6,-3.5,-1,1.5,4,6.5,9].map((x) => <line key={x} x1={x} y1={-2.5} x2={x} y2={2.5} strokeWidth={0.9} />)}
              <text x={0} y={6.5} textAnchor="middle" fontSize="3.4" fill={ink} stroke="none" /* audit:icon-glyph patch-panel-port-count */>{accKind === 'pp48' ? '48' : accKind === 'pp-fiber' ? 'FO' : '24'}</text>
            </g>
          )}
          {accKind === 'pullbox' && (
            <g>
              <rect x={-6} y={-6} width={12} height={12} rx={1} />
              <line x1={-6} y1={0} x2={-10} y2={0} />
              <line x1={6}  y1={0} x2={10}  y2={0} />
              <circle cx={-3.5} cy={-3.5} r={0.8} fill={ink} />
              <circle cx={ 3.5} cy={-3.5} r={0.8} fill={ink} />
              <circle cx={-3.5} cy={ 3.5} r={0.8} fill={ink} />
              <circle cx={ 3.5} cy={ 3.5} r={0.8} fill={ink} />
            </g>
          )}
          {accKind === 'jbox' && (
            <g>
              <rect x={-5.5} y={-5.5} width={11} height={11} rx={1.2} />
              <line x1={-5.5} y1={0} x2={-9} y2={0} />
              <line x1={5.5}  y1={0} x2={9} y2={0} />
            </g>
          )}
          {accKind === 'jhook' && (
            <g>
              <path d="M -7 -5 L -7 3 A 5 5 0 0 0 -2 8" />
              <path d="M  2 8 A 5 5 0 0 0  7 3 L 7 -5" />
            </g>
          )}
          {accKind === 'tray' && (
            <g>
              <rect x={-10} y={-3} width={20} height={6} />
              <line x1={-10} y1={-3} x2={-10} y2={6} />
              <line x1={10}  y1={-3} x2={10}  y2={6} />
              <line x1={-10} y1={6}  x2={10}  y2={6} />
            </g>
          )}
          {accKind === 'firestop' && (
            <g>
              <rect x={-7} y={-3} width={14} height={6} rx={1} />
              <path d="M -7 0 L -10 0 M 7 0 L 10 0" />
              <path d="M -3 -3 L 3 3 M 3 -3 L -3 3" strokeWidth={0.9} />
            </g>
          )}
          {accKind === 'sleeve' && (
            <g>
              <ellipse cx={0} cy={0} rx={9} ry={3} />
              <line x1={-9} y1={0} x2={-12} y2={0} />
              <line x1={9}  y1={0} x2={12} y2={0} />
            </g>
          )}
          {(accKind === 'wallplate' || accKind === 'surfmount') && (
            <g>
              <rect x={-7} y={-5} width={14} height={10} rx={0.8} />
              <rect x={-3} y={-2.5} width={6} height={5} />
            </g>
          )}
          {accKind === 'terminal' && (
            <g>
              <rect x={-9} y={-3} width={18} height={6} />
              {[-7,-4,-1,2,5,8].map((x) => <line key={x} x1={x} y1={-3} x2={x} y2={3} strokeWidth={0.7} />)}
            </g>
          )}
          {accKind === 'splice' && (
            <g>
              <rect x={-9} y={-4} width={18} height={8} rx={1.2} />
              <line x1={-5} y1={-1} x2={5} y2={-1} strokeWidth={0.7} />
              <line x1={-5} y1={1}  x2={5} y2={1}  strokeWidth={0.7} />
            </g>
          )}
          {accKind === 'mgr' && (
            <g>
              <rect x={-10} y={-2} width={20} height={4} />
              <line x1={-10} y1={0} x2={10} y2={0} strokeDasharray="2 2" strokeWidth={0.7} />
            </g>
          )}
        </g>
      </g>
    );
  }

  // Visual-redesign pass: when a SurveyorSymbol exists for this device
  // type, render the technical plan symbol. Otherwise fall back to the
  // legacy per-type SVG below so devices without a symbol stay visible.
  // No filled tone halo — the symbol IS the plan glyph.
  if (SURVEYOR_SYMBOL_HAS(d.type)) {
    // Drafting-restraint pass: the plan-symbol bodies render at 0.72x of
    // their natural 24-unit viewBox (≈ 17 px instead of 24 px) with a
    // 1.1-px hairline stroke. This matches the user-supplied benchmark
    // ("looks like a low-voltage construction drawing, not a SaaS HUD").
    // The hit-circle stays at its full 16-px touch radius — only the
    // visual glyph shrinks. Selected state replaces the dashed circle
    // with a thin solid outline at r=10.
    return (
      <g transform={`translate(${d.x}, ${d.y}) scale(${scale})`} style={{ color: ink }}>
        <g transform={`rotate(${rot})`}>
          <SurveyorSymbolBody id={d.type} scale={0.72} stroke={1.1} />
        </g>
        {isStackableHost(d.type) && (d.stack?.length ?? 0) > 0 && (
          <g transform="translate(8, -8)" pointerEvents="none">
            <circle r={4.4} fill="var(--card)" stroke={ink} strokeWidth={0.7} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={5.8} fill={ink} fontWeight={600}>
              {d.stack!.length}
            </text>
          </g>
        )}
        {/* Selection state — solid primary ring + soft halo. Matches
            the regular-device selection treatment so accessories and
            point devices read consistently. */}
        {selected && (
          <>
            <circle r={18} fill="var(--primary)" opacity="0.16" />
            <circle r={13} fill="none" stroke="var(--primary)" strokeWidth="1.4" />
          </>
        )}
      </g>
    );
  }

  return (
    <g transform={`translate(${d.x}, ${d.y}) scale(${scale})`}>
      {/* Quiet knock-out behind the glyph. The cartoon `tone halo`
          (opacity 0.10 colored blob) was removed — it read as a
          decorative blob on the plan. The remaining knock-out keeps
          the symbol legible against the floorplan rendering. */}
      <circle r={12} fill="var(--canvas-background)" opacity="0.96" stroke={ink} strokeOpacity="0.55" strokeWidth="0.7" />

      <g transform={`rotate(${rot})`} fill="none" stroke={ink} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
        {kind === 'camera' && d.type === 'cam.bullet' && (
          <g>
            {/* mounting arm */}
            <path d="M -11 5 L -8 -1 L -5 -1" />
            {/* barrel */}
            <rect x={-8} y={-5} width={15} height={10} rx={4} />
            {/* sunshade lip */}
            <line x1={-8} y1={-2.5} x2={7} y2={-2.5} />
            {/* lens face */}
            <circle cx={7} cy={0} r={3.2} />
            <circle cx={7} cy={0} r={1} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.dome' && (
          <g>
            {/* base plate */}
            <line x1={-10} y1={4} x2={10} y2={4} />
            {/* dome */}
            <path d="M -10 4 A 10 10 0 0 1 10 4" />
            {/* internal lens */}
            <circle cx={3} cy={0} r={2.4} />
            <circle cx={3} cy={0} r={0.9} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.ptz' && (
          <g>
            {/* ceiling line */}
            <line x1={-7} y1={-8} x2={7} y2={-8} />
            {/* pendant arm */}
            <line x1={0} y1={-8} x2={0} y2={-4} />
            {/* sphere */}
            <circle cx={0} cy={2} r={6} />
            {/* equator line */}
            <path d="M -6 2 A 6 6 0 0 1 6 2" />
            {/* forward lens */}
            <circle cx={3.5} cy={3} r={2} />
            <circle cx={3.5} cy={3} r={0.8} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.multisensor' && (
          <g>
            <line x1={-11} y1={4} x2={11} y2={4} />
            <path d="M -11 4 A 11 6 0 0 1 11 4" />
            {[-7, -2.4, 2.4, 7].map((x, i) => (
              <g key={i}>
                <circle cx={x} cy={1.6} r={1.5} />
                <circle cx={x} cy={1.6} r={0.5} fill={ink} stroke="none" />
              </g>
            ))}
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.fisheye' && (
          <g>
            <circle r={10} />
            <circle r={6.5} />
            <circle r={2.5} />
            <line x1={-10} y1={0} x2={10} y2={0} strokeWidth={0.7} />
            <line x1={0} y1={-10} x2={0} y2={10} strokeWidth={0.7} />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.thermal' && (
          <g>
            <path d="M -12 6 L -9 0 L -6 0" />
            <rect x={-9} y={-5} width={18} height={10} rx={1.5} />
            <rect x={-6} y={-3} width={8} height={6} />
            {[-4, -2, 0, 1.8].map((x) => <line key={x} x1={x} y1={-2.5} x2={x} y2={2.5} strokeWidth={0.6} />)}
            <circle cx={6} cy={0} r={2} />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.lpr' && (
          <g>
            <path d="M -13 6 L -10 0 L -7 0" />
            <rect x={-10} y={-4.5} width={20} height={9} rx={1.5} />
            <rect x={-7} y={-2.6} width={8} height={2.6} />
            <circle cx={6.5} cy={1} r={2.4} />
            <circle cx={6.5} cy={1} r={0.8} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'camera' && d.type === 'cam.body' && (
          <g>
            <rect x={-4.5} y={-9} width={9} height={17} rx={1.6} />
            <line x1={-3} y1={-9} x2={3} y2={-9} strokeWidth={2.2} />
            <circle cx={0} cy={-3} r={2.2} />
            <circle cx={0} cy={-3} r={0.8} fill={ink} stroke="none" />
            <circle cx={0} cy={4} r={1.2} />
          </g>
        )}

        {kind === 'access' && (
          <g>
            <rect x={-4} y={-10} width={8} height={20} rx={1.4} />
            <circle cx={0} cy={-6} r={1} />
            <rect x={-2.6} y={-2.6} width={5.2} height={8} rx={1} />
            <line x1={-1.6} y1={-0.8} x2={1.6} y2={-0.8} strokeWidth={0.7} />
            <line x1={-1.6} y1={1} x2={1.6} y2={1} strokeWidth={0.7} />
            <line x1={-1.6} y1={2.8} x2={1.6} y2={2.8} strokeWidth={0.7} />
          </g>
        )}
        {kind === 'network' && (
          <g>
            <rect x={-12} y={-4} width={24} height={8} rx={1.2} />
            <line x1={-12} y1={-1.4} x2={12} y2={-1.4} />
            {[-8, -4.5, -1, 2.5, 6, 9.5].map((x) => <rect key={x} x={x - 0.8} y={0.4} width={1.6} height={2.8} rx={0.2} />)}
          </g>
        )}
        {kind === 'intrusion' && (
          <g>
            <path d="M -10 7 L 0 -10 L 10 7 Z" />
            <line x1={0} y1={-3} x2={0} y2={3} strokeWidth={2} />
            <circle cx={0} cy={5.2} r={0.8} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'audio' && (
          <g>
            <circle r={10} />
            <circle r={7} />
            <circle r={4} />
            <circle r={1.4} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'storage' && (
          <g>
            <rect x={-11} y={-7} width={22} height={14} rx={1.2} />
            {[-3.5, -0.5, 2.5].map((y) => <line key={y} x1={-9} y1={y} x2={9} y2={y} strokeWidth={0.8} />)}
            <circle cx={8} cy={-5} r={0.6} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'display' && (
          <g>
            <rect x={-12} y={-8} width={24} height={14} rx={1} />
            <line x1={-3} y1={6} x2={3} y2={6} />
            <line x1={-6} y1={8.5} x2={6} y2={8.5} strokeWidth={1.6} />
          </g>
        )}
        {kind === 'power' && (
          <g>
            <rect x={-8} y={-11} width={16} height={22} rx={1.4} />
            <line x1={-6} y1={-7} x2={6} y2={-7} />
            <path d="M -2 -3 L 2 -3 L 0 1 L 3 1 L -2 7 L 0 2 L -3 2 Z" />
          </g>
        )}
        {kind === 'sensor' && (
          <g>
            <line x1={-10} y1={4} x2={10} y2={4} />
            <path d="M -10 4 A 10 7 0 0 1 10 4" />
            {[-6, -2, 2, 6].map((x) => <line key={x} x1={x} y1={4} x2={x} y2={-3} strokeWidth={0.7} />)}
            <circle cx={0} cy={1} r={1} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'infrastructure' && d.type === 'inf.door-single' && (
          <g>
            {/* jamb */}
            <line x1={-11} y1={-9} x2={-11} y2={9} strokeWidth={2} />
            {/* swing arc */}
            <path d="M -11 9 A 18 18 0 0 1 7 -9" strokeDasharray="2 1.5" strokeWidth={0.8} />
            {/* door panel */}
            <line x1={-11} y1={9} x2={7} y2={-9} strokeWidth={1.6} />
            <circle cx={5} cy={-6} r={0.9} fill={ink} stroke="none" />
          </g>
        )}
        {kind === 'infrastructure' && d.type === 'inf.door-double' && (
          <g>
            <line x1={-12} y1={-9} x2={-12} y2={9} strokeWidth={2} />
            <line x1={12} y1={-9} x2={12} y2={9} strokeWidth={2} />
            <path d="M -12 9 A 14 14 0 0 1 0 -3" strokeDasharray="2 1.5" strokeWidth={0.8} />
            <path d="M 12 9 A 14 14 0 0 0 0 -3" strokeDasharray="2 1.5" strokeWidth={0.8} />
            <line x1={-12} y1={9} x2={0} y2={-3} strokeWidth={1.4} />
            <line x1={12} y1={9} x2={0} y2={-3} strokeWidth={1.4} />
          </g>
        )}
        {kind === 'infrastructure' && d.type === 'inf.door-storefront' && (
          <g>
            <rect x={-13} y={-8} width={26} height={16} strokeWidth={1.4} />
            <line x1={0} y1={-8} x2={0} y2={8} strokeWidth={2.2} />
            {[-9, 5].map((x) => <rect key={x} x={x} y={-5} width={4} height={10} strokeWidth={0.6} />)}
          </g>
        )}
        {kind === 'infrastructure' && d.type === 'inf.door-sliding' && (
          <g>
            <line x1={-12} y1={-2} x2={12} y2={-2} strokeWidth={2} />
            <line x1={-12} y1={2} x2={0} y2={2} strokeWidth={2} />
            <line x1={0} y1={6} x2={12} y2={6} strokeWidth={2} />
            <path d="M 0 0 L 3 2 L 0 4" strokeWidth={1} />
          </g>
        )}
        {kind === 'infrastructure' && (d.type === 'inf.gate-swing' || d.type === 'inf.gate-slide') && (
          <g>
            <line x1={-12} y1={0} x2={12} y2={0} strokeWidth={2.2} />
            {[-9, -5, -1, 3, 7].map((x) => <line key={x} x1={x} y1={-6} x2={x} y2={6} strokeWidth={0.7} />)}
            {d.type === 'inf.gate-swing' && <path d="M -12 0 A 14 14 0 0 1 0 -10" strokeDasharray="2 1.5" strokeWidth={0.8} />}
          </g>
        )}
        {kind === 'infrastructure' && d.type === 'inf.elevator' && (
          <g>
            <rect x={-9} y={-10} width={18} height={20} rx={1} />
            <line x1={0} y1={-10} x2={0} y2={10} strokeWidth={2} />
            <path d="M -3 -4 L 0 -7 L 3 -4 M -3 4 L 0 7 L 3 4" strokeWidth={0.8} />
          </g>
        )}
        {kind === 'infrastructure' && d.type === 'inf.window' && (
          <g>
            <rect x={-12} y={-5} width={24} height={10} strokeWidth={1.4} />
            <line x1={-12} y1={0} x2={12} y2={0} strokeWidth={0.6} />
            <line x1={0} y1={-5} x2={0} y2={5} strokeWidth={0.6} />
          </g>
        )}
        {kind === 'infrastructure' && (d.type === 'inf.rack' || d.type === 'inf.mdf') && (
          <g>
            <rect x={-8} y={-11} width={16} height={22} rx={1} strokeWidth={1.4} />
            {[-7, -3, 1, 5, 9].map((y) => <line key={y} x1={-7} y1={y} x2={7} y2={y} strokeWidth={0.6} />)}
            {d.type === 'inf.mdf' && (
              <text x={0} y={3} textAnchor="middle" fontSize={6} fill={ink} stroke="none">MDF</text>
            )}
          </g>
        )}
        {kind === 'cyber' && (
          <g>
            <path d="M -9 -6 L 0 -10 L 9 -6 L 9 4 L 0 10 L -9 4 Z" strokeWidth={1.4} />
            <path d="M -3 0 L -1 2 L 4 -3" strokeWidth={1.6} />
          </g>
        )}
        {kind === 'fire' && (
          <g>
            <path d="M 0 -10 L 6 -2 L 4 -2 L 8 6 L -8 6 L -4 -2 L -6 -2 Z" strokeWidth={1.4} />
          </g>
        )}
        {kind === 'building' && (
          <g>
            <rect x={-8} y={-9} width={16} height={18} strokeWidth={1.4} />
            {[-6, -2, 2, 6].map((x) => [-6, -2, 2].map((y) => (
              <rect key={`${x}-${y}`} x={x - 0.6} y={y - 0.6} width={1.2} height={1.2} fill={ink} stroke="none" />
            )))}
          </g>
        )}
        {kind === 'infrastructure' && (d.type === 'inf.wall-brick' || d.type === 'inf.wall-fire' || d.type === 'inf.wall-concrete') && (
          <g>
            <rect x={-12} y={-3.5} width={24} height={7} strokeWidth={1.2} />
            {d.type === 'inf.wall-brick' && (
              <>
                <line x1={-6} y1={-3.5} x2={-6} y2={3.5} strokeWidth={0.5} />
                <line x1={0} y1={-3.5} x2={0} y2={3.5} strokeWidth={0.5} />
                <line x1={6} y1={-3.5} x2={6} y2={3.5} strokeWidth={0.5} />
                <line x1={-9} y1={0} x2={9} y2={0} strokeWidth={0.5} />
              </>
            )}
            {d.type === 'inf.wall-fire' && (
              <g>
                <path d="M -3 -1 L 0 -4 L 3 -1 L 1 1 L 3 3 L 0 5 L -3 3 L -1 1 Z" strokeWidth={0.9} />
              </g>
            )}
            {d.type === 'inf.wall-concrete' && (
              <>
                <circle cx={-7} cy={0} r={1} strokeWidth={0.5} />
                <circle cx={0} cy={0} r={1} strokeWidth={0.5} />
                <circle cx={7} cy={0} r={1} strokeWidth={0.5} />
              </>
            )}
          </g>
        )}
      </g>

      {/* Stack-count chip — visible only on stackable hosts that have at
          least one accessory in their stack. Drawn at top-right of the
          glyph so it never collides with the lens (cameras) or jamb (doors).
          Click handling is owned by the surface picker; the chip itself is
          render-only. */}
      {isStackableHost(d.type) && (d.stack?.length ?? 0) > 0 && (
        <g transform="translate(12, -12)" pointerEvents="none">
          <circle r={6.5} fill="#1F2738" stroke={tone} strokeWidth={0.9} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={7.5} fill={tone} fontWeight={600}>
            {d.stack!.length}
          </text>
        </g>
      )}

      {/* Selection ring — M11 redesign. Was a dashed tone-colored
          circle that read as in-progress geometry, not a deliberate
          selection state. New treatment:
            - solid ring at 1.5 px in --primary (theme blue) so the
              ring stands out from the device's own tone
            - 17 px radius gives a touch of breathing room between
              ring and glyph (was 15 px)
            - soft halo at 24 px in primary at 0.18 alpha so the
              eye lands on the selected device first
          The halo reads as ambient focus light, the ring as the
          actual selection state. Both theme-paired via --primary. */}
      {selected && (
        <>
          <circle r={24} fill="var(--primary)" opacity="0.16" />
          <circle r={17} fill="none" stroke="var(--primary)" strokeWidth="1.6" />
        </>
      )}
    </g>
  );
}

export default HardwareGlyph;
