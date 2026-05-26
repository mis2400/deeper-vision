// SelectionMenu — M7 rebuild milestone.
//
// Compact horizontal icon strip that appears just above the bottom
// toolbar when a device is selected. Replaces the legacy bottom drawer
// (editOpen / editExpanded) and the dead SelectionPill overlay. The
// strip is intentionally narrow — it never covers the canvas. Clicking
// an icon opens a small section panel anchored above the strip; the
// strip stays visible while the panel is open so the operator can
// switch sections without closing.
//
// Position contract:
//   - Anchored to the bottom of the canvas viewport, 8 px above the
//     bottom toolbar.
//   - Width = fits its contents (left + right padding only).
//   - z-index uses the M2 --z-selection-menu token (45); the section
//     panel uses --z-inspector (50) so it stacks above the strip.
//   - Centered horizontally within the canvas viewport.
//
// Per-device-type sections render only real controls. No "coming soon"
// stubs. A device-type that has no meaningful field for a section
// simply omits that icon from the strip.

import { useState } from 'react';
import {
  Crosshair, Settings2, Zap, Link2, ScanEye, Crosshair as Probe,
  Copy, Palette, Trash2, X,
} from 'lucide-react';
import type { ActiveLens, Device, DeviceType, LensId, LensCfg } from '../types';
import {
  LENS_LABEL, LENS_TONE, DEVICE_COLOR_PALETTE,
} from '../constants';
import { getLenses, deviceTypeLabel } from '../utils';

// ─── Public Props ─────────────────────────────────────────────────────

export interface SelectionMenuProps {
  device: Device;
  /** Distance in px from the canvas viewport bottom edge to the top of
   *  the bottom toolbar. The strip anchors above that. Defaults to 64
   *  (matches the current bottom toolbar height) but the parent passes
   *  the live value so the strip stays clear of any toolbar resize. */
  bottomBarOffsetPx?: number;
  /** Patch the selected device. Same signature the canvas already
   *  uses to mutate any Device field. */
  onUpdate: (patch: Partial<Device>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  // Multisensor lens binding — drives both the chip row in this menu
  // and the per-lens canvas handles from M9.
  activeLens?: ActiveLens;
  setActiveLens?: (l: ActiveLens) => void;
}

// ─── Icon set + section keys ─────────────────────────────────────────

type SectionId =
  | 'aim' | 'specs' | 'power' | 'pairing' | 'coverage' | 'probe'
  | 'color';

interface IconDef {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  // When true, the icon shows in the strip for the given device. The
  // honesty rule from CLAUDE.md applies: dead controls don't render.
  showFor: (d: Device) => boolean;
}

const ICONS: IconDef[] = [
  { id: 'aim',     label: 'Aim',      icon: Crosshair, showFor: (d) => isCamera(d.type) },
  { id: 'specs',   label: 'Specs',    icon: Settings2, showFor: () => true },
  { id: 'power',   label: 'Power',    icon: Zap,        showFor: (d) => hasPower(d.type) },
  { id: 'pairing', label: 'Pairing',  icon: Link2,      showFor: (d) => hasPairing(d.type) },
  { id: 'coverage',label: 'Coverage', icon: ScanEye,    showFor: (d) => isCamera(d.type) },
  { id: 'probe',   label: 'Probe',    icon: Probe,      showFor: (d) => isProbeable(d.type) },
  { id: 'color',   label: 'Color',    icon: Palette,    showFor: () => true },
];

function isCamera(t: DeviceType): boolean { return String(t).startsWith('cam.'); }
function hasPower(t: DeviceType): boolean {
  // Anything that takes PoE / line voltage / DC supply gets a Power
  // panel. The catalog tracks this per product; for the strip we use a
  // type prefix proxy. Cabling-only types don't get a Power panel.
  const s = String(t);
  return s.startsWith('cam.') || s.startsWith('acc.') || s.startsWith('net.')
    || s.startsWith('aud.') || s.startsWith('sto.') || s.startsWith('dis.')
    || s.startsWith('pwr.') || s.startsWith('int.') || s.startsWith('fls.');
}
function hasPairing(t: DeviceType): boolean {
  // Door hardware, intercom, reader — devices that meaningfully attach
  // to another device.
  const s = String(t);
  return s.startsWith('acc.') || s.startsWith('inf.door') || s.startsWith('inf.gate')
    || s === 'aud.intercom' || s === 'acc.intercom';
}
function isProbeable(t: DeviceType): boolean {
  // Person-probe makes sense for cameras except fisheye and multisensor
  // (those have their own coverage models).
  return isCamera(t) && t !== 'cam.fisheye' && t !== 'cam.multisensor';
}

// ─── Component ────────────────────────────────────────────────────────

export function SelectionMenu({
  device, bottomBarOffsetPx = 72, onUpdate, onDuplicate, onDelete, onClose,
  activeLens, setActiveLens,
}: SelectionMenuProps) {
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const items = ICONS.filter((i) => i.showFor(device));
  const isMultisensor = device.type === 'cam.multisensor';

  const stripStyle: React.CSSProperties = {
    bottom: `${bottomBarOffsetPx + 8}px`,
  };

  return (
    <div
      data-canvas-chrome="selection-menu"
      className="absolute left-1/2 -translate-x-1/2 z-selection-menu pointer-events-none select-none"
      style={stripStyle}
    >
      {openSection && (
        <SectionPanel
          section={openSection}
          device={device}
          onUpdate={onUpdate}
          onClose={() => setOpenSection(null)}
          activeLens={activeLens}
        />
      )}
      <div
        className="pointer-events-auto inline-flex items-center gap-1 px-2 py-1.5 rounded-full border backdrop-blur-md"
        style={{
          background: 'var(--canvas-rail, rgba(20, 24, 35, 0.92))',
          borderColor: 'var(--canvas-rail-border, rgba(255,255,255,0.10))',
          boxShadow: '0 18px 36px -18px rgba(0,0,0,0.65)',
        }}
      >
        {/* Device label chip — non-interactive identity */}
        <span
          className="px-2 py-1 text-foreground"
          style={{ fontSize: 'var(--chrome-sm)' }}
          title={`${device.label} · ${deviceTypeLabel(device.type)}`}
        >
          <span className="font-medium text-foreground/90">{device.label}</span>
          <span className="ml-1.5 text-muted-foreground">{deviceTypeLabel(device.type)}</span>
        </span>

        {/* Multisensor lens chips (M9 binding). The active chip drives
            both the canvas handles and any open section panel content. */}
        {isMultisensor && setActiveLens && (
          <div className="flex items-center gap-0.5 px-1 border-l border-white/10 ml-1">
            {(['a', 'b', 'c', 'd'] as const).map((k) => {
              const lens = getLenses(device)[k];
              const isActive = activeLens === k;
              return (
                <button
                  key={k}
                  onClick={() => setActiveLens(k)}
                  className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                  style={{
                    fontSize: 'var(--chrome-xs)',
                    background: isActive ? `${LENS_TONE[k]}22` : 'transparent',
                    color: isActive ? '#F8FAFC' : '#94A3B8',
                    boxShadow: isActive ? `inset 0 0 0 1px ${LENS_TONE[k]}66` : 'none',
                    opacity: lens.enabled ? 1 : 0.45,
                  }}
                  title={`Lens ${LENS_LABEL[k]} ${lens.enabled ? '' : '(disabled)'}`}
                  data-track={`selmenu-lens-${k}`}
                >
                  {LENS_LABEL[k]}
                </button>
              );
            })}
          </div>
        )}

        {/* Section icons. Each opens a small panel above. */}
        <div className="flex items-center gap-0.5 px-1 border-l border-white/10 ml-1">
          {items.map((it) => {
            const Icon = it.icon;
            const isOpen = openSection === it.id;
            return (
              <button
                key={it.id}
                onClick={() => setOpenSection((cur) => cur === it.id ? null : it.id)}
                title={it.label}
                aria-label={it.label}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                style={{
                  background: isOpen ? 'rgba(255,255,255,0.18)' : 'transparent',
                  color: isOpen ? '#F8FAFC' : '#CBD5E1',
                }}
                data-track={`selmenu-${it.id}`}
              >
                <Icon className="w-4 h-4" strokeWidth={1.6} />
              </button>
            );
          })}
        </div>

        {/* Duplicate + delete + close — always rendered */}
        <div className="flex items-center gap-0.5 px-1 border-l border-white/10 ml-1">
          <button
            onClick={onDuplicate}
            title="Duplicate"
            aria-label="Duplicate"
            className="w-7 h-7 rounded-md flex items-center justify-center text-foreground/80 hover:bg-white/10 hover:text-white"
            data-track="selmenu-duplicate"
          >
            <Copy className="w-4 h-4" strokeWidth={1.6} />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            aria-label="Delete"
            className="w-7 h-7 rounded-md flex items-center justify-center text-rose-400 hover:bg-rose-500/15"
            data-track="selmenu-delete"
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.6} />
          </button>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="w-7 h-7 rounded-md flex items-center justify-center text-foreground/60 hover:bg-white/10 hover:text-white"
            data-track="selmenu-close"
          >
            <X className="w-4 h-4" strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section panel ────────────────────────────────────────────────────

function SectionPanel({
  section, device, onUpdate, onClose, activeLens,
}: {
  section: SectionId;
  device: Device;
  onUpdate: (patch: Partial<Device>) => void;
  onClose: () => void;
  activeLens?: ActiveLens;
}) {
  // Capped per the spec: ~320 px wide, never more than 40% of viewport.
  return (
    <div
      className="pointer-events-auto absolute left-1/2 -translate-x-1/2 z-inspector rounded-xl border backdrop-blur-md overflow-hidden"
      style={{
        bottom: '52px', // sits above the 44 px strip + 8 px gap
        width: '320px',
        maxHeight: '40vh',
        background: 'var(--canvas-rail, rgba(20, 24, 35, 0.96))',
        borderColor: 'var(--canvas-rail-border, rgba(255,255,255,0.10))',
        boxShadow: '0 22px 44px -18px rgba(0,0,0,0.65)',
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/8">
        <div
          className="font-medium text-foreground/90 uppercase"
          style={{ fontSize: 'var(--chrome-xs)', letterSpacing: '0.08em' }}
        >
          {SECTION_TITLE[section]}
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded flex items-center justify-center text-foreground/60 hover:bg-white/10 hover:text-white"
          aria-label="Close section"
        >
          <X className="w-3 h-3" strokeWidth={1.8} />
        </button>
      </div>
      <div className="px-3 py-3 overflow-auto" style={{ maxHeight: 'calc(40vh - 40px)' }}>
        <SectionBody section={section} device={device} onUpdate={onUpdate} activeLens={activeLens} />
      </div>
    </div>
  );
}

const SECTION_TITLE: Record<SectionId, string> = {
  aim:      'Aim · geometry',
  specs:    'Specs',
  power:    'Power',
  pairing:  'Pairing',
  coverage: 'Coverage',
  probe:    'Probe',
  color:    'Color',
};

function SectionBody({
  section, device, onUpdate, activeLens,
}: {
  section: SectionId;
  device: Device;
  onUpdate: (patch: Partial<Device>) => void;
  activeLens?: ActiveLens;
}) {
  if (section === 'aim') return <AimSection device={device} onUpdate={onUpdate} activeLens={activeLens} />;
  if (section === 'color') return <ColorSection device={device} onUpdate={onUpdate} />;
  if (section === 'coverage') return <CoverageSection device={device} onUpdate={onUpdate} />;
  if (section === 'probe') return <ProbeSection device={device} />;
  if (section === 'power') return <PowerSection device={device} />;
  if (section === 'pairing') return <PairingSection device={device} />;
  return <SpecsSection device={device} />;
}

// ─── Section bodies ───────────────────────────────────────────────────

function AimSection({ device, onUpdate, activeLens }: {
  device: Device; onUpdate: (p: Partial<Device>) => void; activeLens?: ActiveLens;
}) {
  const isMs = device.type === 'cam.multisensor';
  // Pull effective values: a multisensor surfaces the ACTIVE lens's
  // rotation/FOV/range. A single-lens camera reads them from the
  // device root.
  const ls = isMs ? getLenses(device) : null;
  const effectiveLensKey: LensId = (activeLens === 'a' || activeLens === 'b' || activeLens === 'c' || activeLens === 'd') ? activeLens : 'a';
  const lens: LensCfg | null = ls ? ls[effectiveLensKey] : null;
  const rotation = isMs && lens ? ((lens.rotation + device.rot) % 360 + 360) % 360 : device.rot;
  const fov = isMs && lens ? lens.fov : (device.fov ?? 70);
  const range = isMs && lens ? lens.range : (device.range ?? 30);
  const mount = device.mountFt ?? 9;

  function patchAim(field: 'rotation' | 'fov' | 'range', value: number) {
    if (isMs && ls) {
      // Mutate only the active lens. Rotation is stored RELATIVE to
      // the device body — the canvas handles use the same convention.
      const k = effectiveLensKey;
      if (field === 'rotation') {
        const rel = ((value - device.rot) % 360 + 360) % 360;
        onUpdate({ lenses: { ...ls, [k]: { ...ls[k], rotation: rel } } });
      } else {
        onUpdate({ lenses: { ...ls, [k]: { ...ls[k], [field]: value } } });
      }
    } else {
      if (field === 'rotation') onUpdate({ rot: value });
      else onUpdate({ [field]: value } as Partial<Device>);
    }
  }

  return (
    <div className="space-y-3">
      <NumericRow
        label="Rotation"
        suffix="°"
        min={0} max={359} step={1}
        value={Math.round(rotation)}
        onChange={(v) => patchAim('rotation', v)}
      />
      <NumericRow
        label="FOV"
        suffix="°"
        min={10} max={180} step={1}
        value={Math.round(fov)}
        onChange={(v) => patchAim('fov', v)}
      />
      <NumericRow
        label="Range"
        suffix=" ft"
        min={5} max={300} step={1}
        value={Math.round(range)}
        onChange={(v) => patchAim('range', v)}
      />
      <NumericRow
        label="Mount height"
        suffix=" ft"
        min={3} max={50} step={0.5}
        value={mount}
        onChange={(v) => onUpdate({ mountFt: v })}
      />
      {isMs && (
        <p className="text-muted-foreground" style={{ fontSize: 'var(--chrome-xs)' }}>
          Editing lens <span className="text-foreground">{LENS_LABEL[effectiveLensKey]}</span>. Pick another in the strip to switch.
        </p>
      )}
    </div>
  );
}

function CoverageSection({ device, onUpdate }: { device: Device; onUpdate: (p: Partial<Device>) => void }) {
  return (
    <div className="space-y-3">
      <ToggleRow
        label="IR illumination"
        hint="Cone reads night range when on"
        value={!!device.ir}
        onChange={(b) => onUpdate({ ir: b })}
      />
      <ToggleRow
        label="NDAA compliant"
        hint="Section 889 declared by the vendor"
        value={!!device.ndaa}
        onChange={(b) => onUpdate({ ndaa: b })}
      />
    </div>
  );
}

function ColorSection({ device, onUpdate }: { device: Device; onUpdate: (p: Partial<Device>) => void }) {
  return (
    <div>
      <p className="text-muted-foreground mb-2" style={{ fontSize: 'var(--chrome-xs)' }}>
        Override the category tone for this device only.
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {DEVICE_COLOR_PALETTE.map((c) => {
          const isActive = (device.color ?? '') === c.hex;
          const isReset = c.id === 'reset';
          return (
            <button
              key={c.id}
              onClick={() => onUpdate({ color: isReset ? undefined : c.hex })}
              title={c.name}
              className="aspect-square rounded-md flex items-center justify-center"
              style={{
                background: isReset ? 'transparent' : c.hex,
                border: isActive ? '2px solid #F8FAFC' : '1px solid rgba(255,255,255,0.10)',
              }}
            >
              {isReset && <X className="w-3 h-3 text-foreground/70" strokeWidth={1.8} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProbeSection({ device }: { device: Device }) {
  return (
    <p className="text-muted-foreground" style={{ fontSize: 'var(--chrome-xs)' }}>
      Person probe drops on the canvas when {device.label} is selected. Drag the marker to test pixel density at any point in the cone.
    </p>
  );
}

function PowerSection({ device }: { device: Device }) {
  return (
    <p className="text-muted-foreground" style={{ fontSize: 'var(--chrome-xs)' }}>
      Power source for {device.label} is set by the catalog product. Switch the product to change the source.
    </p>
  );
}

function PairingSection({ device }: { device: Device }) {
  const linked = device.linkedIds ?? [];
  if (linked.length === 0) {
    return (
      <p className="text-muted-foreground" style={{ fontSize: 'var(--chrome-xs)' }}>
        No paired devices. Drop a reader / strike onto a door to pair it.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {linked.map((id) => (
        <li
          key={id}
          className="text-foreground/90 px-2 py-1 rounded bg-white/5"
          style={{ fontSize: 'var(--chrome-sm)' }}
        >
          {id}
        </li>
      ))}
    </ul>
  );
}

function SpecsSection({ device }: { device: Device }) {
  const rows: Array<[string, string]> = [
    ['ID',      device.id],
    ['Label',   device.label],
    ['Product', device.product],
    ['Type',    deviceTypeLabel(device.type)],
  ];
  if (typeof device.mountFt === 'number') rows.push(['Mount', `${device.mountFt} ft AFF`]);
  if (typeof device.fov === 'number') rows.push(['FOV', `${device.fov}°`]);
  if (typeof device.range === 'number') rows.push(['Range', `${device.range} ft`]);
  return (
    <div className="space-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between">
          <span className="text-muted-foreground" style={{ fontSize: 'var(--chrome-xs)' }}>{k}</span>
          <span className="text-foreground/90" style={{ fontSize: 'var(--chrome-sm)' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Small controls ───────────────────────────────────────────────────

function NumericRow({
  label, suffix, value, min, max, step, onChange,
}: {
  label: string; suffix?: string; value: number;
  min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground" style={{ fontSize: 'var(--chrome-xs)' }}>{label}</span>
        <span className="text-foreground/90 tabular-nums" style={{ fontSize: 'var(--chrome-sm)' }}>
          {value}{suffix ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: 'var(--primary)' }}
      />
    </div>
  );
}

function ToggleRow({
  label, hint, value, onChange,
}: {
  label: string; hint?: string; value: boolean; onChange: (b: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-white/5"
    >
      <span className="text-left">
        <span className="block text-foreground/90" style={{ fontSize: 'var(--chrome-sm)' }}>{label}</span>
        {hint && <span className="block text-muted-foreground" style={{ fontSize: 'var(--chrome-xs)' }}>{hint}</span>}
      </span>
      <span
        className="inline-flex w-8 h-4 rounded-full transition-colors"
        style={{ background: value ? 'var(--primary)' : 'rgba(255,255,255,0.15)' }}
      >
        <span
          className="block w-3 h-3 rounded-full bg-white transition-transform self-center"
          style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </span>
    </button>
  );
}
