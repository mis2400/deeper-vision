// AddBuildingDialog + AddFloorDialog — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith breakup.
// Two tiny modal dialogs the building/floor picker mounts when the
// operator clicks "Add building" or "Add floor". Pure presentational
// — useState for the form fields, props for close + submit callbacks.

import { useState } from 'react';
import type { SiteFloor } from '../types';

export function AddBuildingDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (name: string, address: string) => void }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const valid = name.trim().length > 1;
  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[400px] bg-card border border-border rounded-xl shadow-2xl">
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <div className="text-[14px] font-medium tracking-tight">Add building</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">A building hosts one or more floor maps. You can add floors after.</div>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Building name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Building D — Annex"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 h-9 text-[13px] focus:outline-none focus:border-primary/60"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Address (optional)</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="600 Industrial Way"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 h-9 text-[13px] focus:outline-none focus:border-primary/60"
            />
          </label>
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={() => valid && onSubmit(name.trim(), address.trim())}
            disabled={!valid}
            className={`text-[12px] px-3 h-8 rounded-md transition-opacity ${valid ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-secondary text-muted-foreground cursor-not-allowed'}`}
          >
            Add building
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal for adding a floor to an existing building. Captures the floor name
 *  and the source (blueprint upload, satellite trace, hand sketch, or blank).
 *  Source picker is symbolic for now; the floor lands with that label and a
 *  zero device-count, ready to be opened on the canvas. */
export function AddFloorDialog({ buildingName, onClose, onSubmit }: {
  buildingName: string;
  onClose: () => void;
  onSubmit: (name: string, source: SiteFloor['source']) => void;
}) {
  const [name, setName] = useState('');
  const [source, setSource] = useState<SiteFloor['source']>('blueprint');
  const valid = name.trim().length > 0;
  // Canvas V2 Pass 1.0 — satellite source removed. The render branch
  // (line ~7056) ships a simulated aerial with a "Simulated" badge;
  // a real tile provider lands in a later pass. Until then, only the
  // honest sources (real upload or sketch) are pickable.
  const SOURCES: { id: SiteFloor['source']; label: string; hint: string }[] = [
    { id: 'blueprint',  label: 'Blueprint',  hint: 'Upload a PDF or image' },
    { id: 'sketch',     label: 'Sketch',     hint: 'Hand draw a layout on canvas' },
  ];
  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[420px] bg-card border border-border rounded-xl shadow-2xl">
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <div className="text-[14px] font-medium tracking-tight">Add floor map</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Adds a floor to <span className="text-foreground">{buildingName}</span>.</div>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Floor name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Level 4"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 h-9 text-[13px] focus:outline-none focus:border-primary/60"
            />
          </label>
          <div>
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Source</span>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSource(s.id)}
                  className={`text-left p-2 rounded-md border transition-colors ${source === s.id ? 'border-primary/60 bg-primary/8' : 'border-border hover:bg-secondary/30'}`}
                >
                  <div className="text-[12px] font-medium">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{s.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={() => valid && onSubmit(name.trim(), source)}
            disabled={!valid}
            className={`text-[12px] px-3 h-8 rounded-md transition-opacity ${valid ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-secondary text-muted-foreground cursor-not-allowed'}`}
          >
            Add floor
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal that takes a PNG / JPG / PDF and turns it into a Floor.background.
 *  PNG / JPG are read directly via FileReader + downscaled. PDF first page
 *  is rendered with pdfjs-dist. DWG / DXF are surfaced as disabled options
 *  with the honest message that a backend parser is required. */
