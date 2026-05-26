// CmdKOverlay + CmdKSection — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. Cmd-K search bar and command
// palette. Renders a centered modal with a search input + grouped
// result rows (devices, pathways, IDFs, commands). Pure presentational
// — all data comes in via props.

import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Device } from '../types';

export type CmdKCommand = { id: string; label: string; hint?: string; run: () => void };

export function CmdKOverlay({
  devices, pathways, idfs, onClose, onSelectDevice, commands,
}: {
  devices: Device[];
  pathways: Array<{ id: string; cableType?: string; type?: string; lengthFt?: number; points: { x: number; y: number }[] }>;
  idfs: Array<{ id: string; name?: string; x?: number; y?: number }>;
  onClose: () => void;
  onSelectDevice: (id: string, x: number, y: number) => void;
  commands: CmdKCommand[];
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const lower = q.trim().toLowerCase();
  const matchedDevices = useMemo(() => {
    if (!lower) return devices.slice(0, 8);
    return devices.filter((d) => {
      const hay = `${d.id} ${(d as any).name ?? ''} ${(d as any).label ?? ''} ${d.type}`.toLowerCase();
      return hay.includes(lower);
    }).slice(0, 25);
  }, [devices, lower]);
  const matchedCommands = useMemo(() => {
    if (!lower) return commands;
    return commands.filter((c) => `${c.label} ${c.hint ?? ''}`.toLowerCase().includes(lower));
  }, [commands, lower]);
  const matchedPathways = useMemo(() => {
    if (!lower) return [] as typeof pathways;
    return pathways.filter((p) => `${p.id} ${p.cableType ?? ''} ${p.type ?? ''}`.toLowerCase().includes(lower)).slice(0, 10);
  }, [pathways, lower]);
  const matchedIdfs = useMemo(() => {
    if (!lower) return [] as typeof idfs;
    return idfs.filter((i) => `${i.id} ${i.name ?? ''}`.toLowerCase().includes(lower)).slice(0, 10);
  }, [idfs, lower]);

  return (
    <div className="fixed inset-0 z-[60] bg-foreground/30 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search devices, pathways, IDFs, or run a command"
            className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground"
          />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Esc</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {matchedCommands.length > 0 && (
            <CmdKSection title="Commands">
              {matchedCommands.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { c.run(); onClose(); }}
                  className="w-full text-left px-3 py-2 hover:bg-secondary/40 flex items-center justify-between"
                >
                  <span className="text-sm">{c.label}</span>
                  {c.hint && <span className="text-[11px] text-muted-foreground">{c.hint}</span>}
                </button>
              ))}
            </CmdKSection>
          )}
          {matchedDevices.length > 0 && (
            <CmdKSection title={`Devices${lower ? '' : ' (recent)'}`}>
              {matchedDevices.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { onSelectDevice(d.id, d.x, d.y); onClose(); }}
                  className="w-full text-left px-3 py-2 hover:bg-secondary/40 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{(d as any).name || (d as any).label || d.id}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{d.id} · {d.type}</div>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">({d.x.toFixed(0)}, {d.y.toFixed(0)})</span>
                </button>
              ))}
            </CmdKSection>
          )}
          {matchedPathways.length > 0 && (
            <CmdKSection title="Pathways">
              {matchedPathways.map((p) => (
                <div key={p.id} className="px-3 py-2 text-sm">
                  <div>{p.id}</div>
                  <div className="text-[11px] text-muted-foreground">{p.cableType ?? p.type} · {p.lengthFt ?? '–'} ft</div>
                </div>
              ))}
            </CmdKSection>
          )}
          {matchedIdfs.length > 0 && (
            <CmdKSection title="IDFs">
              {matchedIdfs.map((i) => (
                <div key={i.id} className="px-3 py-2 text-sm">
                  <div>{i.name || i.id}</div>
                  <div className="text-[11px] text-muted-foreground">{i.id}</div>
                </div>
              ))}
            </CmdKSection>
          )}
          {lower && matchedCommands.length === 0 && matchedDevices.length === 0 && matchedPathways.length === 0 && matchedIdfs.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matches for "{q}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CmdKSection({ title, children }: { title: string; children: React.ReactNode }) {
  // Private helper — used only by CmdKOverlay above. Not exported.
  return (
    <div>
      <div className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

