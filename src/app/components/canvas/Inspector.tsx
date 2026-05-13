import { Button } from '../Button';
import { Badge } from '../Badge';
import { FloatingPanel } from '../FloatingPanel';
import {
  CanvasObject,
  CameraObj,
  MultisensorObj,
  DoorObj,
  IdfObj,
  HardwareKind,
  LENS_COLORS,
} from '../../lib/engineering';
import { Lock, Unlock, Trash2, Copy, Sparkles, Target } from 'lucide-react';

interface Props {
  obj: CanvasObject | null;
  onUpdate: (id: string, patch: any) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleLock: (id: string) => void;
  onSpawnTarget: () => void;
}

const HARDWARE_OPTIONS: HardwareKind[] = ['reader', 'strike', 'maglock', 'rex', 'contact', 'intercom', 'panic', 'autoop', 'controller', 'psu'];

export function Inspector({ obj, onUpdate, onDelete, onDuplicate, onToggleLock, onSpawnTarget }: Props) {
  if (!obj) {
    return (
      <FloatingPanel title="Inspector">
        <p className="text-sm text-muted-foreground">Select an object to inspect its engineering properties.</p>
        <p className="text-xs text-muted-foreground mt-2">Tips: Alt+drag pans · Scroll zooms · Shift+click multi-select.</p>
      </FloatingPanel>
    );
  }

  return (
    <FloatingPanel
      title={`${obj.kind.charAt(0).toUpperCase() + obj.kind.slice(1)} Inspector`}
      headerRight={
        <div className="flex items-center gap-1">
          <button onClick={() => onToggleLock(obj.id)} className="p-1 hover:bg-secondary/40 rounded">
            {obj.locked ? <Lock className="w-3.5 h-3.5 text-warning" /> : <Unlock className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          <button onClick={() => onDuplicate(obj.id)} className="p-1 hover:bg-secondary/40 rounded">
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => onDelete(obj.id)} className="p-1 hover:bg-destructive/30 rounded">
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Label">
          <input
            value={obj.label ?? ''}
            onChange={(e) => onUpdate(obj.id, { label: e.target.value })}
            className="w-full px-2 py-1 text-xs bg-input-background border border-input-border rounded"
          />
        </Field>

        {obj.kind === 'camera' && <CameraFields obj={obj} onUpdate={onUpdate} />}
        {obj.kind === 'multisensor' && <MultisensorFields obj={obj} onUpdate={onUpdate} />}
        {obj.kind === 'door' && <DoorFields obj={obj} onUpdate={onUpdate} />}
        {obj.kind === 'idf' && <IdfFields obj={obj} onUpdate={onUpdate} />}

        <div className="pt-3 border-t border-border/50 space-y-2">
          {(obj.kind === 'camera' || obj.kind === 'multisensor') && (
            <Button size="sm" variant="secondary" className="w-full" onClick={onSpawnTarget}>
              <Target className="w-3 h-3" /> Drop Target on Map
            </Button>
          )}
          <Button size="sm" variant="primary" className="w-full">
            <Sparkles className="w-3 h-3" /> AI Optimize
          </Button>
        </div>
      </div>
    </FloatingPanel>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Slider({ value, min, max, step = 1, onChange }: { value: number; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-primary"
    />
  );
}

function CameraFields({ obj, onUpdate }: { obj: CameraObj; onUpdate: (id: string, patch: any) => void }) {
  return (
    <>
      <Field label="Model">
        <p className="text-xs">{obj.manufacturer} {obj.model}</p>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Mount">
          <select
            value={obj.mount}
            onChange={(e) => onUpdate(obj.id, { mount: e.target.value })}
            className="w-full px-2 py-1 text-xs bg-input-background border border-input-border rounded"
          >
            <option value="wall">Wall</option>
            <option value="ceiling">Ceiling</option>
            <option value="pole">Pole</option>
            <option value="corner">Corner</option>
          </select>
        </Field>
        <Field label={`Height ${obj.mountHeight}ft`}>
          <Slider value={obj.mountHeight} min={6} max={40} onChange={(v) => onUpdate(obj.id, { mountHeight: v })} />
        </Field>
      </div>
      <Field label={`Focal ${obj.focalLength}mm`} hint="Drives px/ft DORI math">
        <Slider value={obj.focalLength} min={2.8} max={32} step={0.1} onChange={(v) => onUpdate(obj.id, { focalLength: v })} />
      </Field>
      <Field label={`FOV ${Math.round(obj.fov)}°`}>
        <Slider value={obj.fov} min={20} max={170} onChange={(v) => onUpdate(obj.id, { fov: v })} />
      </Field>
      <Field label={`Range ${Math.round(obj.range)} ft`}>
        <Slider value={obj.range} min={10} max={250} onChange={(v) => onUpdate(obj.id, { range: v })} />
      </Field>
      <Field label={`Rotation ${Math.round(obj.rotation)}°`}>
        <Slider value={obj.rotation} min={-180} max={180} onChange={(v) => onUpdate(obj.id, { rotation: v })} />
      </Field>
      <div className="flex gap-1 flex-wrap">
        <Badge variant={obj.ndaa ? 'success' : 'default'}>NDAA {obj.ndaa ? '✓' : '✗'}</Badge>
        <Badge variant={obj.ir ? 'primary' : 'default'}>IR {obj.ir ? '✓' : '✗'}</Badge>
        <Badge variant="default">{obj.poeW}W</Badge>
        <Badge variant="default">{obj.bandwidthMbps}Mbps</Badge>
      </div>
    </>
  );
}

function MultisensorFields({ obj, onUpdate }: { obj: MultisensorObj; onUpdate: (id: string, patch: any) => void }) {
  return (
    <>
      <Field label="Model">
        <p className="text-xs">{obj.manufacturer} {obj.model}</p>
      </Field>
      <div className="flex items-center gap-2">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Mode</label>
        <button
          onClick={() => onUpdate(obj.id, { linked: !obj.linked })}
          className={`px-2 py-1 text-[10px] rounded border ${obj.linked ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}
        >
          {obj.linked ? 'Linked' : 'Independent'}
        </button>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-engineering mb-1.5">AI Optimization Presets</p>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { id: 'corridor',   label: 'Corridor',    detail: '2 long · 2 wide',   fovs: [35, 35, 90, 90],   rots: [0, 180, 90, 270],  ranges: [120, 120, 45, 45] },
            { id: 'parking',    label: 'Parking lot', detail: '360° wide quads',   fovs: [110, 110, 110, 110], rots: [45, 135, 225, 315], ranges: [80, 80, 80, 80] },
            { id: 'intersect',  label: 'Intersection',detail: '4× cardinal',       fovs: [70, 70, 70, 70],   rots: [0, 90, 180, 270],   ranges: [65, 65, 65, 65] },
            { id: 'perimeter',  label: 'Perimeter',   detail: 'Long-throw fan',    fovs: [50, 50, 50, 50],   rots: [-30, -10, 10, 30],  ranges: [140, 140, 140, 140] },
          ] as const).map(p => (
            <button
              key={p.id}
              onClick={() => {
                const lenses = obj.lenses.map((l, i) => ({ ...l, fov: p.fovs[i], rotation: p.rots[i], range: p.ranges[i] }));
                onUpdate(obj.id, { lenses, linked: false });
              }}
              className="p-2 rounded border border-border/50 hover:border-primary/50 text-left transition-colors"
            >
              <p className="text-[11px] font-medium">{p.label}</p>
              <p className="text-[9px] text-muted-foreground">{p.detail}</p>
            </button>
          ))}
        </div>
      </div>
      {obj.lenses.map((lens, i) => (
        <div key={lens.id} className="p-2 rounded border border-border/40" style={{ borderLeftWidth: 3, borderLeftColor: lens.color || LENS_COLORS[i] }}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Lens {String.fromCharCode(65 + i)}</p>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <span>Rot {Math.round(lens.rotation)}°</span>
            <span>FOV {lens.fov}°</span>
            <span>Range {lens.range}ft</span>
            <span>{lens.focalLength}mm</span>
          </div>
          <Slider
            value={lens.fov}
            min={20}
            max={150}
            onChange={(v) => {
              const lenses = obj.lenses.map((l, j) => (j === i ? { ...l, fov: v } : obj.linked ? { ...l, fov: v } : l));
              onUpdate(obj.id, { lenses });
            }}
          />
          <Slider
            value={lens.range}
            min={15}
            max={200}
            onChange={(v) => {
              const lenses = obj.lenses.map((l, j) => (j === i ? { ...l, range: v } : obj.linked ? { ...l, range: v } : l));
              onUpdate(obj.id, { lenses });
            }}
          />
        </div>
      ))}
    </>
  );
}

function DoorFields({ obj, onUpdate }: { obj: DoorObj; onUpdate: (id: string, patch: any) => void }) {
  const toggle = (h: HardwareKind) => {
    const has = obj.hardware.includes(h);
    onUpdate(obj.id, { hardware: has ? obj.hardware.filter((x) => x !== h) : [...obj.hardware, h] });
  };
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Type">
          <select
            value={obj.doorType}
            onChange={(e) => onUpdate(obj.id, { doorType: e.target.value })}
            className="w-full px-2 py-1 text-xs bg-input-background border border-input-border rounded"
          >
            {['single', 'double', 'storefront', 'gate', 'rollup', 'elevator', 'stairwell'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Material">
          <select
            value={obj.material}
            onChange={(e) => onUpdate(obj.id, { material: e.target.value })}
            className="w-full px-2 py-1 text-xs bg-input-background border border-input-border rounded"
          >
            {['wood', 'hollow-metal', 'aluminum', 'glass'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex gap-2">
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={obj.fireRated} onChange={(e) => onUpdate(obj.id, { fireRated: e.target.checked })} />
          Fire-rated
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={obj.ada} onChange={(e) => onUpdate(obj.id, { ada: e.target.checked })} />
          ADA
        </label>
      </div>
      <Field label="Hardware Stack" hint="Click to add/remove. Compatibility engine validates live.">
        <div className="flex flex-wrap gap-1">
          {HARDWARE_OPTIONS.map((h) => {
            const active = obj.hardware.includes(h);
            return (
              <button
                key={h}
                onClick={() => toggle(h)}
                className={`px-2 py-0.5 text-[10px] rounded-full border transition ${
                  active ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                {h}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label={`Rotation ${Math.round(obj.rotation)}°`}>
        <Slider value={obj.rotation} min={-180} max={180} onChange={(v) => onUpdate(obj.id, { rotation: v })} />
      </Field>
    </>
  );
}

function IdfFields({ obj, onUpdate }: { obj: IdfObj; onUpdate: (id: string, patch: any) => void }) {
  return (
    <>
      <Field label="Name">
        <input
          value={obj.name}
          onChange={(e) => onUpdate(obj.id, { name: e.target.value })}
          className="w-full px-2 py-1 text-xs bg-input-background border border-input-border rounded"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={`PoE Budget ${obj.poeBudget}W`}>
          <Slider value={obj.poeBudget} min={120} max={1500} step={10} onChange={(v) => onUpdate(obj.id, { poeBudget: v })} />
        </Field>
        <Field label={`Ports ${obj.usedPorts}/${obj.ports}`}>
          <Slider value={obj.ports} min={8} max={96} step={4} onChange={(v) => onUpdate(obj.id, { ports: v })} />
        </Field>
      </div>
      <Field label={`UPS runtime ${obj.upsMinutes}m`}>
        <Slider value={obj.upsMinutes} min={5} max={120} step={5} onChange={(v) => onUpdate(obj.id, { upsMinutes: v })} />
      </Field>
    </>
  );
}
