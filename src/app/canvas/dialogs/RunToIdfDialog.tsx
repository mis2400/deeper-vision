// RunToIdfDialog — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. Modal that turns a
// selection of cameras / readers / etc into a labelled cable
// bundle running to a chosen IDF. Picks the target IDF + cable
// type + route method, estimates the total cable footage
// (straight-line ft × 10 % slack + 3 ft service loop per
// termination), then writes one pathway record per selected
// device tagged with a shared bundleId. Reads + writes via
// useProjectStore.

import { Cable, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ftPerPxForFloor } from '../../lib/engineering';
import { selectors as storeSelectors, useProjectStore } from '../../store/projectStore';
import { CABLE_TYPES } from '../constants';
import type { CableTypeId, Device } from '../types';

export function RunToIdfDialog({
  onClose, selected, idfs, projectId, onCreated,
}: {
  onClose: () => void;
  selected: Device[];
  idfs: Device[];
  projectId: string;
  onCreated: (bundleId: string, count: number, cableType: string, idfId: string) => void;
}) {
  const [targetIdfId, setTargetIdfId] = useState<string>(idfs[0]?.id ?? '');
  const [cableType, setCableType] = useState<CableTypeId>('cat6a');
  const [method, setMethod] = useState<'home' | 'bundle' | 'existing' | 'new'>('bundle');
  const addPathway = useProjectStore((s) => s.addPathway);
  const target = idfs.find((i) => i.id === targetIdfId);
  // Length estimator — sum of straight-line distances from each device to
  // the IDF, plus 10% slack + a 3 ft service loop per termination.
  const totalLengthFt = useMemo(() => {
    if (!target) return 0;
    // Canvas V2 Pass 2A.4 — use the active floor's scale, not the
    // project's first floor scale. Selection is already filtered to
    // the active floor so the distances match the visible plan.
    const _state = useProjectStore.getState();
    const _activeId = _state.currentFloorIdByProject[projectId];
    const _floor = (_activeId ? (_state.floors as any)[_activeId] : null)
      ?? storeSelectors.firstFloorOfProject(_state, projectId);
    const pxToFt = ftPerPxForFloor(_floor);
    let sum = 0;
    selected.forEach((d) => {
      sum += Math.hypot(target.x - d.x, target.y - d.y) * pxToFt * 1.1 + 3;
    });
    return Math.round(sum);
  }, [selected, target, projectId]);
  const handleRun = () => {
    if (!target) return;
    // Canvas V2 Pass 2A.4 — use the active floor's scale, not the
    // project's first floor scale. Selection is already filtered to
    // the active floor so the distances match the visible plan.
    const _state = useProjectStore.getState();
    const _activeId = _state.currentFloorIdByProject[projectId];
    const _floor = (_activeId ? (_state.floors as any)[_activeId] : null)
      ?? storeSelectors.firstFloorOfProject(_state, projectId);
    const pxToFt = ftPerPxForFloor(_floor);
    const bundleId = `BUN-${Date.now().toString(36).slice(-5)}`.toUpperCase();
    selected.forEach((d) => {
      addPathway({
        projectId,
        floorId: (d as any).floorId ?? '',
        cableType,
        points: [{ x: d.x, y: d.y }, { x: target.x, y: target.y }],
        lengthFt: Math.round(Math.hypot(target.x - d.x, target.y - d.y) * pxToFt * 1.1 + 3),
        bundleId,
        sourceId: d.id,
        targetId: target.id,
      } as any);
    });
    onCreated(bundleId, selected.length, cableType.toUpperCase(), target.id);
  };
  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[560px] max-w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <Cable className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight">Run to IDF</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              Create cable runs from {selected.length} selected device{selected.length === 1 ? '' : 's'} to a target IDF.
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Target IDF */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Target IDF / Rack</div>
            {idfs.length === 0 ? (
              <div className="text-[11px] text-amber-300/90 bg-amber-300/8 border border-amber-300/25 rounded px-2.5 py-2">
                No IDF on this floor. Place one from the bottom Network tray first.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {idfs.map((i) => {
                  const active = targetIdfId === i.id;
                  return (
                    <button
                      key={i.id}
                      onClick={() => setTargetIdfId(i.id)}
                      data-track={`run-target-${i.id}`}
                      className={`text-left px-3 py-2 rounded-md border text-[12px] transition-colors ${active ? 'border-primary/40 bg-primary/8 text-foreground' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                    >
                      <div className="font-medium">{i.id}</div>
                      <div className="text-[10px] text-muted-foreground">{i.type.split('.').pop()}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cable type */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Cable type</div>
            <div className="flex items-stretch flex-wrap gap-1">
              {(CABLE_TYPES as any[]).slice(0, 8).map((c) => {
                const active = cableType === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCableType(c.id)}
                    data-track={`run-cable-${c.id}`}
                    className={`text-[11px] px-2.5 py-1.5 rounded border transition-colors ${active ? 'border-primary/40 bg-primary/8 text-foreground' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Route method */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Route method</div>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { id: 'home',     label: 'Direct home run',   hint: 'Each device gets its own pathway.' },
                { id: 'bundle',   label: 'Bundled pathway',   hint: 'One labelled bundle, individual runs inside.' },
                { id: 'existing', label: 'Existing conduit',  hint: 'Drop into an already-routed conduit.' },
                { id: 'new',      label: 'New conduit',       hint: 'Create a conduit to match the bundle.' },
              ] as const).map((r) => {
                const active = method === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setMethod(r.id)}
                    title={r.hint}
                    data-track={`run-method-${r.id}`}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition-colors ${active ? 'border-primary/40 bg-primary/8 text-foreground' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                  >
                    <div className="font-medium">{r.label}</div>
                    <div className="text-[10px] text-muted-foreground">{r.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-md border border-border bg-background p-3 text-[11px] text-muted-foreground">
            <div className="font-medium text-foreground">{selected.length}× {cableType.toUpperCase()} → {target?.id ?? '—'}</div>
            <div className="mt-1">Estimated total cable: <span className="tabular-nums text-foreground">{totalLengthFt} ft</span> · includes 10 % slack + 3 ft service loop per termination.</div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40">Cancel</button>
          <button
            onClick={handleRun}
            disabled={!target || selected.length === 0}
            data-track="run-confirm"
            className="text-[12px] font-medium px-3.5 h-8 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Cable className="w-3.5 h-3.5" />Create bundle
          </button>
        </div>
      </div>
    </div>
  );
}
