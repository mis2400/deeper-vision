import { useEffect, useState, useRef } from 'react';
import { Sparkles, Camera, Cable, DoorOpen, Lightbulb } from 'lucide-react';

interface Suggestion {
  icon: any;
  label: string;
  value: string;
  tone?: string;
}

interface ContextLike {
  /** Nearest device kind, if any, within 80 world-px. */
  nearKind: 'camera' | 'multisensor' | 'door' | 'idf' | 'pathway' | null;
  /** Distance to nearest device in world-px. */
  nearDist: number;
  /** Inferred space type from local density. */
  space: 'corridor' | 'lobby' | 'open' | 'congested';
}

interface Props {
  /** Convert client (px) to world (px). */
  screenToWorld: (cx: number, cy: number) => { x: number; y: number };
  /** Canvas objects with at least { kind, x, y }. */
  objects: Array<{ kind: string; x: number; y: number }>;
  /** Suppress when a tool other than 'select' is active. */
  active: boolean;
}

export function AIContextLayer({ screenToWorld, objects, active }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [ctx, setCtx] = useState<ContextLike | null>(null);
  const tHide = useRef<number | null>(null);
  const tShow = useRef<number | null>(null);
  const lastShownAt = useRef(0);

  useEffect(() => {
    if (!active) { setPos(null); setCtx(null); return; }
    const onMove = (e: MouseEvent) => {
      // Ignore when over interactive UI surfaces (buttons, kbd panels, etc.)
      const t = e.target as HTMLElement | null;
      if (t && t.closest('button, input, kbd, [data-pdf-exporter], .pointer-events-auto')) {
        if (tShow.current) { clearTimeout(tShow.current); tShow.current = null; }
        return;
      }
      const world = screenToWorld(e.clientX, e.clientY);
      // Find nearest object
      let near: ContextLike['nearKind'] = null;
      let nearDist = Infinity;
      let within120 = 0;
      for (const o of objects) {
        const d = Math.hypot(o.x - world.x, o.y - world.y);
        if (d < nearDist) {
          nearDist = d;
          near = (['camera', 'multisensor', 'door', 'idf', 'pathway'].includes(o.kind) ? o.kind : null) as any;
        }
        if (d < 120) within120 += 1;
      }
      const space: ContextLike['space'] =
        within120 >= 4 ? 'congested' :
        within120 >= 2 ? 'lobby' :
        within120 === 1 ? 'corridor' :
        'open';
      setCtx({ nearKind: near, nearDist, space });
      // Delayed show after pointer settles for 350ms
      if (tShow.current) clearTimeout(tShow.current);
      tShow.current = window.setTimeout(() => {
        setPos({ x: e.clientX, y: e.clientY });
        lastShownAt.current = Date.now();
      }, 350);
      if (tHide.current) clearTimeout(tHide.current);
      tHide.current = window.setTimeout(() => setPos(null), 2200);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (tHide.current) clearTimeout(tHide.current);
      if (tShow.current) clearTimeout(tShow.current);
    };
  }, [active, screenToWorld, objects]);

  if (!active || !pos || !ctx) return null;

  // Suppress when too close to an existing device (the device has its own HUD)
  if (ctx.nearDist < 30) return null;

  const suggestions: Suggestion[] = buildSuggestions(ctx);
  const title =
    ctx.space === 'corridor' ? 'Corridor' :
    ctx.space === 'lobby' ? 'Lobby zone' :
    ctx.space === 'congested' ? 'Congested area' :
    'Open space';

  return (
    <div
      className="fixed z-[55] pointer-events-none"
      style={{
        left: pos.x + 18,
        top: pos.y + 18,
        transform: 'translate3d(0,0,0)',
      }}
    >
      <div className="bg-[var(--panel-background)]/95 backdrop-blur-2xl border border-primary/40 rounded-lg shadow-2xl px-3 py-2 min-w-[230px] max-w-[280px] animate-in fade-in slide-in-from-bottom-1 duration-150">
        <div className="flex items-center gap-1.5 mb-1.5 border-b border-border/40 pb-1.5">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-[9px] uppercase tracking-[0.22em] text-primary">AI · {title}</span>
        </div>
        <ul className="space-y-1">
          {suggestions.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                  <Icon className={`w-3 h-3 ${s.tone ?? 'text-primary/80'}`} />
                  {s.label}
                </span>
                <span className="text-[10.5px] tabular-nums text-foreground">{s.value}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-1.5 pt-1.5 border-t border-border/40 text-[9px] text-muted-foreground/70 tracking-wide">
          Hover · drop a device to apply
        </div>
      </div>
    </div>
  );
}

function buildSuggestions(c: ContextLike): Suggestion[] {
  if (c.nearKind === 'door' && c.nearDist < 80) {
    return [
      { icon: Camera,   label: 'Camera',  value: '4MP dome · 2.8mm' },
      { icon: Lightbulb,label: 'IR',      value: 'On · 30 ft' },
      { icon: Cable,    label: 'Conduit', value: 'EMT 3/4" ceiling' },
      { icon: DoorOpen, label: 'Pairing', value: 'Tie to ACS reader' },
    ];
  }
  if (c.nearKind === 'idf' && c.nearDist < 100) {
    return [
      { icon: Cable,    label: 'Run',     value: 'Plenum Cat6 · <90m' },
      { icon: Camera,   label: 'Devices', value: 'Group nearest 8' },
      { icon: Lightbulb,label: 'PoE',     value: 'Budget 240W avail.' },
    ];
  }
  if (c.space === 'corridor') {
    return [
      { icon: Camera,   label: 'Camera',  value: '4MP bullet · 4mm' },
      { icon: Lightbulb,label: 'Mount',   value: 'Wall · 9–10 ft' },
      { icon: Lightbulb,label: 'IR',      value: 'On · 50 ft' },
      { icon: Cable,    label: 'Conduit', value: 'Surface raceway' },
    ];
  }
  if (c.space === 'lobby') {
    return [
      { icon: Camera,   label: 'Camera',  value: 'Multisensor · 4×4MP' },
      { icon: Lightbulb,label: 'Mount',   value: 'Ceiling · 12 ft' },
      { icon: Lightbulb,label: 'Light',   value: 'Day mode primary' },
      { icon: Cable,    label: 'Conduit', value: 'Above-ceiling tray' },
    ];
  }
  if (c.space === 'congested') {
    return [
      { icon: Camera,    label: 'Overlap', value: 'Reduce — coverage tight' },
      { icon: Lightbulb, label: 'Strategy', value: 'Optimize for prosecution' },
      { icon: Cable,     label: 'Routing',  value: 'Share trunk to nearest IDF' },
    ];
  }
  return [
    { icon: Camera,    label: 'Camera',  value: '4MP dome · 2.8mm', tone: 'text-primary' },
    { icon: Lightbulb, label: 'Mount',   value: 'Ceiling · 10 ft' },
    { icon: Lightbulb, label: 'IR',      value: 'On · 40 ft' },
    { icon: Cable,     label: 'Conduit', value: 'EMT 3/4"' },
  ];
}
