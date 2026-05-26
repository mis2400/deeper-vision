// SelectByMenu — extracted from screens/EngineeringCanvas.tsx as
// part of the M11 monolith breakup. Quick-pick chip pinned top-left
// of the canvas. Multi-selects every camera / door / reader / IDF
// on the current floor in one click, plus a "By type" breakdown
// derived live from the device list. Pure presentational — the
// parent owns the device list and the selection setter.

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { TYPE_KIND } from '../constants';
import type { Device } from '../types';

export function SelectByMenu({ devices, onPick }: { devices: Device[]; onPick: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [open]);
  const cams    = devices.filter((d) => TYPE_KIND[d.type] === 'camera');
  const doors   = devices.filter((d) => (d.type as string).startsWith('inf.door') || (d.type as string).startsWith('inf.gate') || (d.type as string).startsWith('inf.storefront') || (d.type as string).startsWith('inf.doubledoor'));
  const readers = devices.filter((d) => d.type === 'acc.reader' || d.type === 'acc.keypad');
  const idfs    = devices.filter((d) => d.type === 'net.idf' || d.type === 'net.mdf' || d.type === 'inf.rack' || d.type === 'inf.mdf');
  const sel = (list: Device[], label: string) => { onPick(list.map((d) => d.id)); setOpen(false); toast.message(`Selected ${list.length} · ${label}`, { duration: 2500 }); };
  return (
    <div className="absolute z-30 top-3 left-[88px]" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        data-track="select-by-menu"
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border bg-card/90 backdrop-blur-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors ${open ? 'border-primary/40 text-primary' : 'border-border'}`}
      >
        Select
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (() => {
        const onFloor: { label: string; list: Device[]; track: string }[] = ([
          { label: 'All cameras on floor', list: cams,    track: 'select-all-cameras' },
          { label: 'All doors on floor',   list: doors,   track: 'select-all-doors' },
          { label: 'All readers on floor', list: readers, track: 'select-all-readers' },
          { label: 'All IDFs / racks',     list: idfs,    track: 'select-all-idfs' },
        ]).filter((r) => r.list.length > 0);
        const byType = Object.entries(devices.reduce<Record<string, number>>((m, d) => { m[d.type] = (m[d.type] ?? 0) + 1; return m; }, {}))
          .filter(([, n]) => n > 0)
          .slice(0, 8);
        return (
          <div className="absolute left-0 top-9 w-[260px] rounded-xl border bg-card/95 backdrop-blur-xl shadow-[var(--shadow-medium)] overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {onFloor.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.10em] text-muted-foreground">On floor</div>
                {onFloor.map((r) => (
                  <button key={r.track} onClick={() => sel(r.list, r.label.toLowerCase())} data-track={r.track} className="w-full text-left px-3 py-2 text-[12px] hover:bg-secondary/40 flex items-center justify-between">
                    <span>{r.label}</span><span className="text-muted-foreground tabular-nums">{r.list.length}</span>
                  </button>
                ))}
              </>
            )}
            {byType.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.10em] text-muted-foreground border-t border-border/60">By type</div>
                {byType.map(([t, n]) => (
                  <button
                    key={t}
                    onClick={() => sel(devices.filter((d) => d.type === t), `of type ${t}`)}
                    data-track={`select-type-${t}`}
                    className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-secondary/40 flex items-center justify-between"
                  >
                    <span className="text-foreground">{t}</span>
                    <span className="text-muted-foreground tabular-nums">{n}</span>
                  </button>
                ))}
              </>
            )}
            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.10em] text-muted-foreground border-t border-border/60">By room</div>
            <div className="px-3 py-2 text-[11px] text-muted-foreground italic">
              Room-scoped selection unavailable — no room geometry on this floor yet. Use shift-click or drag a selection box for now.
            </div>
            {onFloor.length > 0 && (
              <div className="px-3 py-2 border-t border-border/60">
                <button onClick={() => { onPick([]); setOpen(false); }} data-track="select-clear" className="text-[11px] text-muted-foreground hover:text-foreground">Clear selection</button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
