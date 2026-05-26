// BundleInspectorDialog — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Modal opened by clicking a bundle line on the canvas:
// lists the runs in the bundle, lets the operator assign patch /
// switch ports sequentially, pick a conduit type + trade size,
// and read live NEC fill % with an Assist recommendation when
// the picked size overruns the rule. All edits persist via
// useProjectStore.

import { Cable, X } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { pathwayLengthFt } from '../../lib/engineering';
import { useProjectStore } from '../../store/projectStore';
import { CABLE_OD_IN, EMT_SIZES, computeBundleFill } from '../cabling';

export function BundleInspectorDialog({ bundleId, onClose }: { bundleId: string; onClose: () => void }) {
  const pathways = useProjectStore((s) => s.pathways);
  const devices = useProjectStore((s) => s.devices);
  const floors = useProjectStore((s) => s.floors);
  const updatePathway = useProjectStore((s) => s.updatePathway);
  const removePathway = useProjectStore((s) => s.removePathway);
  const runs = useMemo(
    () => (Object.values(pathways) as any[]).filter((p) => p?.bundleId === bundleId),
    [pathways, bundleId],
  );
  const first = runs[0];
  const cableType = String(first?.cableType ?? 'cat6a');
  const targetId = first?.targetId ?? first?.destinationId ?? '—';
  const totalLen = runs.reduce((s, p) => s + pathwayLengthFt(p, floors[p.floorId ?? '']), 0);
  const conduitType = first?.conduitType ?? 'none';
  const conduitSize = first?.conduitSize;
  const fill = computeBundleFill(runs.length, cableType, conduitSize);
  // Assign patch / switch ports sequentially per-bundle so the schedule
  // is honest and stable. The dialog writes the assignments to the
  // store so the IDF drawer sees them.
  const assignPorts = () => {
    runs.forEach((p, i) => {
      updatePathway(p.id, { patchPort: i + 1, switchPort: i + 1 });
    });
    toast.success('Ports assigned', { description: `${runs.length} runs assigned to ports 01–${String(runs.length).padStart(2, '0')}.`, duration: 3500 });
  };
  const setConduit = (type: any, size?: string) => {
    const next = type === 'none' ? { conduitType: undefined, conduitSize: undefined } : { conduitType: type, conduitSize: size };
    runs.forEach((p) => updatePathway(p.id, next as any));
  };
  const applyRecommendation = () => {
    if (!fill.recommended) return;
    setConduit('EMT', fill.recommended);
    toast.success(`Conduit set · EMT ${fill.recommended}`, { description: 'Fill recalculated for the recommended trade size.', duration: 3500 });
  };
  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[860px] max-w-full max-h-[88vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 pt-4 pb-3 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <Cable className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight">Cable bundle · {bundleId}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {runs.length}× {cableType.toUpperCase()} → {targetId} · total <span className="tabular-nums">{Math.round(totalLen)} ft</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-5 gap-0 divide-x divide-border">
          {/* Left — individual runs */}
          <div className="col-span-3 p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Individual runs · {runs.length}</div>
              <button
                onClick={assignPorts}
                data-track="bundle-assign-ports"
                className="text-[11px] px-2.5 h-7 rounded-md border border-border hover:bg-secondary/40 text-foreground"
              >
                Assign ports sequentially
              </button>
            </div>
            <div className="space-y-1.5">
              {runs.map((p, i) => {
                const src = devices[p.sourceId ?? ''] as any;
                return (
                  <div key={p.id} className="rounded-md border border-border bg-background px-3 py-2 flex items-center gap-3 text-[11px]">
                    <span className="text-muted-foreground tabular-nums w-6">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{src?.id ?? p.sourceId ?? p.id} → {targetId}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {pathwayLengthFt(p, floors[p.floorId ?? ''])} ft · {String(p.cableType ?? cableType).toUpperCase()}
                        {p.patchPort && <> · PP-01 Port {String(p.patchPort).padStart(2, '0')}</>}
                        {p.switchPort && <> · SW-01 Port {String(p.switchPort).padStart(2, '0')}</>}
                      </div>
                    </div>
                    <button
                      onClick={() => { removePathway(p.id); toast.message('Run removed', { description: `${src?.id ?? p.sourceId} detached from bundle.`, duration: 3000 }); }}
                      title="Remove run"
                      data-track={`bundle-run-remove-${p.id}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right — conduit + fill + assist */}
          <div className="col-span-2 p-4 space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Conduit type</div>
              <div className="flex flex-wrap gap-1">
                {(['none','EMT','PVC','FMC','LFMC','tray'] as const).map((t) => {
                  const active = conduitType === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setConduit(t, conduitSize)}
                      data-track={`bundle-conduit-type-${t}`}
                      className={`text-[11px] px-2 py-1 rounded border transition-colors ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                    >
                      {t === 'none' ? 'None' : t}
                    </button>
                  );
                })}
              </div>
            </div>

            {conduitType !== 'none' && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Trade size</div>
                <div className="grid grid-cols-3 gap-1">
                  {EMT_SIZES.map((e) => {
                    const active = conduitSize === e.size;
                    return (
                      <button
                        key={e.size}
                        onClick={() => setConduit(conduitType, e.size)}
                        data-track={`bundle-conduit-size-${e.size.replace(/\W/g, '')}`}
                        className={`text-[11px] py-1 rounded border transition-colors ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                      >
                        {e.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-md border border-border bg-background p-3">
              <div className="flex items-baseline justify-between">
                <div className="text-[11px] uppercase tracking-[0.10em] text-muted-foreground">Conduit fill</div>
                <div className="text-[10px] text-muted-foreground">{(fill.rule * 100).toFixed(0)}% rule</div>
              </div>
              <div className="mt-1.5">
                {conduitSize ? (
                  <>
                    <div className="text-[20px] font-medium tabular-nums" style={{ color: fill.passes ? '#4FB87E' : '#E5A23A' }}>{fill.fillPct.toFixed(1)}%</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {runs.length}× OD {CABLE_OD_IN[cableType.toLowerCase()] ?? 0.31}″ · area {fill.totalAreaIn2.toFixed(3)} in² / conduit {fill.conduitAreaIn2?.toFixed(3)} in²
                    </div>
                    {!fill.passes && (
                      <div className="mt-2 text-[11px] text-amber-200 bg-amber-300/8 border border-amber-300/25 rounded-md p-2">
                        Overfilled. {fill.recommended ? <>Recommend <span className="font-medium">EMT {fill.recommended}</span> or split the bundle.</> : 'Split the bundle — no standard EMT in stock satisfies the rule.'}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-[11px] text-muted-foreground">Pick a conduit size above to compute fill.</div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-primary/30 bg-primary/8 p-3">
              <div className="flex items-baseline justify-between">
                <div className="text-[11px] uppercase tracking-[0.10em] text-primary">Deeper Vision Assist</div>
              </div>
              <div className="text-[11px] text-foreground mt-1.5">
                {fill.recommended
                  ? <>{runs.length} × {cableType.toUpperCase()} fits cleanly in <span className="font-medium">EMT {fill.recommended}</span> under the {(fill.rule * 100).toFixed(0)}% NEC rule. Apply to write this conduit on every run in the bundle.</>
                  : <>No standard EMT in stock satisfies the {(fill.rule * 100).toFixed(0)}% rule. Split this bundle into two pathways or step up to PVC / cable tray.</>}
              </div>
              {fill.recommended && (
                <button
                  onClick={applyRecommendation}
                  data-track="bundle-apply-recommendation"
                  className="mt-2 text-[11px] font-medium px-3 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                >
                  Apply EMT {fill.recommended}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end">
          <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40">Close</button>
        </div>
      </div>
    </div>
  );
}
