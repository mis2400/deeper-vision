// LayersPanel cluster — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. The right-side panel that
// renders the engineer's three-way controls: display preferences
// (base map, icon size, label density, coverage opacity),
// engineering layer toggles (FOV / coverage / heat map / pathways
// / labels / etc), and the per-device select / hide / lock list
// grouped by Camera / Access / Network.
//
// Bundled together because:
//   - DisplaySection uses SegmentRow (private helper)
//   - LayersPanel composes DisplaySection + EngineeringLayersSection
//   - all three share the CanvasDisplayPrefs / CanvasLayerState /
//     EngineeringLayer / LabelDensity / IconSize / BaseMapMode types
//
// Pure presentational — every list mutation surfaces through the
// setter props the parent already owns (selId / selIds / hiddenIds
// / lockedIds / layers / display). No store calls inside.

import { Check, ChevronRight, Eye, EyeOff, Layers, Lock, Unlock, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type {
  BaseMapMode,
  CanvasDisplayPrefs,
  CanvasLayerState,
  EngineeringLayer,
  IconSize,
  LabelDensity,
} from '../../store/types';
import { KIND_TONE, TYPE_KIND } from '../constants';
import { DeviceGlyph } from '../devices/DeviceGlyph';
import type { Device, DeviceKind } from '../types';

export function LayersPanel({ devices, selId, setSelId, selIds, setSelIds, hiddenIds, setHiddenIds, lockedIds, setLockedIds, layers, onToggleLayer, display, onDisplayChange, onClose }: {
  devices: Device[];
  selId: string | null;
  setSelId: (id: string | null) => void;
  selIds: Set<string>;
  setSelIds: (s: Set<string>) => void;
  hiddenIds: Set<string>;
  setHiddenIds: (s: Set<string>) => void;
  lockedIds: Set<string>;
  setLockedIds: (s: Set<string>) => void;
  /** Engineering overlay visibility, gated per layer. */
  layers: CanvasLayerState;
  onToggleLayer: (layer: EngineeringLayer, on: boolean) => void;
  /** Display preferences (icon size, label density, coverage opacity, base map). */
  display: CanvasDisplayPrefs;
  onDisplayChange: (patch: Partial<CanvasDisplayPrefs>) => void;
  onClose: () => void;
}) {
  const lastIndexRef = useRef<number>(-1);
  const flat = devices;
  const handleRowClick = (e: React.MouseEvent, d: Device, idx: number) => {
    if (e.shiftKey && lastIndexRef.current >= 0) {
      const [a, b] = [lastIndexRef.current, idx].sort((x, y) => x - y);
      const range = flat.slice(a, b + 1).map((x) => x.id);
      const next = new Set(selIds);
      range.forEach((id) => next.add(id));
      setSelIds(next);
      setSelId(d.id);
    } else if (e.metaKey || e.ctrlKey) {
      const next = new Set(selIds);
      if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
      setSelIds(next);
      setSelId(d.id);
      lastIndexRef.current = idx;
    } else {
      setSelIds(new Set([d.id]));
      setSelId(d.id);
      lastIndexRef.current = idx;
    }
  };
  const groups: Array<{ kind: DeviceKind; label: string; tone: string; items: Device[] }> = [
    { kind: 'camera',  label: 'Cameras', tone: KIND_TONE.camera,  items: devices.filter((d) => TYPE_KIND[d.type] === 'camera') },
    { kind: 'access',  label: 'Access',  tone: KIND_TONE.access,  items: devices.filter((d) => TYPE_KIND[d.type] === 'access') },
    { kind: 'network', label: 'Network', tone: KIND_TONE.network, items: devices.filter((d) => TYPE_KIND[d.type] === 'network') },
  ];
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };
  return (
    <div className="w-[300px] border-r border-border bg-background flex flex-col">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-secondary border border-border flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-medium">Layers</div>
            <div className="text-[11px] text-muted-foreground">{devices.length} devices · {selIds.size > 0 ? `${selIds.size} selected` : `${hiddenIds.size} hidden`}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-3">
        {/* ── Display preferences ───────────────────────────────────
            Dial-style controls: base map, icon size, label density,
            coverage opacity. These are the levers that let the engineer
            adapt the canvas to a dense site or a quiet presentation. */}
        <DisplaySection display={display} onChange={onDisplayChange} />

        {/* ── Engineering layers (overlays) ──────────────────────────
            Calm-by-default toggles. Most are off until the engineer
            asks for them. Anything that paints on top of the blueprint
            should live here, not as a floating button on the canvas. */}
        <EngineeringLayersSection layers={layers} onToggle={onToggleLayer} />

        {groups.map((g) => (
          <div key={g.kind} className="mb-2">
            <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: g.tone }} />
              {g.label}
              <span className="text-muted-foreground/60">· {g.items.length}</span>
            </div>
            {g.items.length === 0 && (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground/60 italic">No devices</div>
            )}
            {g.items.map((d) => {
              const hidden = hiddenIds.has(d.id);
              const locked = lockedIds.has(d.id);
              const active = selId === d.id;
              const multi = selIds.has(d.id);
              const idx = flat.findIndex((x) => x.id === d.id);
              return (
                <div
                  key={d.id}
                  onClick={(e) => handleRowClick(e, d, idx)}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${active ? 'bg-primary/10 ring-1 ring-primary/30' : multi ? 'bg-primary/[0.06] ring-1 ring-primary/20' : 'hover:bg-secondary'}`}
                >
                  <div className="w-6 h-6 rounded bg-secondary border border-border flex items-center justify-center shrink-0">
                    <DeviceGlyph type={d.type} size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs truncate ${hidden ? 'text-muted-foreground/60 line-through' : ''}`}>{d.id}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{d.label}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(lockedIds, setLockedIds, d.id); }}
                    className={`p-1 rounded hover:bg-background/60 transition-opacity ${locked ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-100 text-muted-foreground'}`}
                    title={locked ? 'Unlock' : 'Lock'}
                  >
                    {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(hiddenIds, setHiddenIds, d.id); }}
                    className={`p-1 rounded hover:bg-background/60 transition-opacity ${hidden ? 'opacity-100 text-muted-foreground' : 'opacity-0 group-hover:opacity-100 text-muted-foreground'}`}
                    title={hidden ? 'Show' : 'Hide'}
                  >
                    {hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Display preferences — base map, icon size, label density, coverage
 *  opacity. Sits above the engineering layer toggles in the Layers panel.
 *  These are the dials the engineer reaches for first to make a dense
 *  map readable. Persistent per project. */
function DisplaySection({ display, onChange }: { display: CanvasDisplayPrefs; onChange: (patch: Partial<CanvasDisplayPrefs>) => void }) {
  const [open, setOpen] = useState(true);
  const baseMaps: { id: BaseMapMode; label: string }[] = [
    { id: 'blueprint', label: 'Blueprint' },
    { id: 'satellite', label: 'Satellite' },
    { id: 'street',    label: 'Street' },
    { id: 'hybrid',    label: 'Hybrid' },
    { id: 'dark',      label: 'Dark' },
    { id: 'blank',     label: 'Blank' },
  ];
  const sizes: { id: IconSize; label: string }[] = [
    { id: 'compact',  label: 'Compact' },
    { id: 'standard', label: 'Standard' },
    { id: 'large',    label: 'Large' },
  ];
  const densities: { id: LabelDensity; label: string }[] = [
    { id: 'hidden',    label: 'Hidden' },
    { id: 'selected',  label: 'Selected' },
    { id: 'important', label: 'Important' },
    { id: 'all',       label: 'All' },
  ];
  return (
    <div className="mb-3 border-b border-border/40 pb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Eye className="w-3 h-3" />
        Display
      </button>
      {open && (
        <div className="px-2 mt-1 space-y-3">
          {/* Map mode */}
          <div>
            <div className="text-[10px] text-muted-foreground mb-1.5">Map</div>
            <div className="grid grid-cols-3 gap-1">
              {baseMaps.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onChange({ baseMap: m.id })}
                  className={`text-[10px] py-1 px-1 rounded transition-colors ${display.baseMap === m.id ? 'bg-primary/15 text-primary border border-primary/40' : 'border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                  title={`Use ${m.label} as base map`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Icon size */}
          <SegmentRow
            label="Icon size"
            value={display.iconSize}
            options={sizes}
            onChange={(v) => onChange({ iconSize: v as IconSize })}
          />

          {/* Label density */}
          <SegmentRow
            label="Labels"
            value={display.labelDensity}
            options={densities}
            onChange={(v) => onChange({ labelDensity: v as LabelDensity })}
          />

          {/* Coverage opacity */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Coverage opacity</span>
              <span className="tabular-nums">{display.coverageOpacity}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={display.coverageOpacity}
              onChange={(e) => onChange({ coverageOpacity: Number(e.target.value) })}
              className="w-full accent-primary cursor-pointer"
              title="Dim FOV cones for a calmer canvas"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Small segmented-control row used by DisplaySection. */
function SegmentRow<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className="flex items-stretch border border-border/50 rounded p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`flex-1 text-[10px] py-0.5 rounded transition-colors ${value === o.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Engineering layer toggles — calm checklist of overlays. Off by
 *  default unless they're core engineering signals (fov, labels, pathways).
 *  Layers that don't yet have canvas rendering (NEC, thermal, bandwidth,
 *  rooms, conduit_ids) are still toggleable so the UI is future-proofed
 *  and future-painting can drop in without UX work. */
function EngineeringLayersSection({ layers, onToggle }: { layers: CanvasLayerState; onToggle: (l: EngineeringLayer, on: boolean) => void }) {
  const [open, setOpen] = useState(true);
  // Only layers that visibly affect the canvas are listed here. The
  // schema still holds rooms / NEC / thermal / bandwidth / conduit_ids
  // for when those renderers are built — but per the lockdown rule
  // (no controls that change nothing) they're hidden from this panel
  // until they paint something real.
  const rows: { id: EngineeringLayer; label: string; hint: string }[] = [
    { id: 'fov',         label: 'FOV cones',     hint: 'Camera coverage cones' },
    { id: 'coverage',    label: 'Coverage',      hint: 'Motion / reader / AP / speaker ranges' },
    { id: 'heatmap',     label: 'Gap heat map',  hint: 'Red = no device covers this spot' },
    { id: 'annotations', label: 'Annotations',   hint: 'Operator notes + callouts' },
    { id: 'labels',      label: 'Device labels', hint: 'IDs under each device' },
    { id: 'pathways',    label: 'Pathways',      hint: 'Cable runs and tray' },
    { id: 'dimensions',  label: 'Dimensions',    hint: 'Spacing between cameras' },
    { id: 'presence',    label: 'Presence',      hint: 'Live collaborator cursors' },
  ];
  const onCount = rows.filter((r) => layers[r.id]).length;
  return (
    <div className="mb-3 border-b border-border/40 pb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Layers className="w-3 h-3" />
        Engineering layers
        <span className="text-muted-foreground/60 ml-auto">{onCount} on</span>
      </button>
      {open && (
        <div className="px-1 grid grid-cols-2 gap-x-1 gap-y-0.5">
          {rows.map((r) => {
            const on = layers[r.id];
            return (
              <button
                key={r.id}
                onClick={() => onToggle(r.id, !on)}
                title={r.hint}
                className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] text-left transition-colors ${on ? 'text-foreground bg-secondary/60' : 'text-muted-foreground hover:bg-secondary/30'}`}
              >
                <span className={`w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center border ${on ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border/60'}`}>
                  {on && <Check className="w-2.5 h-2.5" />}
                </span>
                <span className="truncate">{r.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
