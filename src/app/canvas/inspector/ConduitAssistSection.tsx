// ConduitAssistSection — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Conduit fill calculator + assist recommendation
// rendered inside the device inspector for IDF / network
// devices. Reads bundle pathways for the project, computes
// total cable area vs. EMT internal area for the six common
// trade sizes, and surfaces a recommended size based on NEC
// fill rules (53/31/40 %).
//
// CABLE_OD_IN + EMT_SIZES now live in canvas/cabling.ts — the
// monolith's old local copies are gone, this module reads from
// the shared source so the values stay in lock-step with the
// rest of the conduit fill math.

import { useMemo } from 'react';
import { CABLE_OD_IN, EMT_SIZES } from '../cabling';
import { DrawerSection } from '../components/DrawerPrimitives';
import { useProjectStore } from '../../store/projectStore';

export function ConduitAssistSection({ projectId }: { projectId: string }) {
  const pathways = useProjectStore((s) => s.pathways);
  const bundles = useMemo(() => {
    const byBundle: Record<string, any[]> = {};
    for (const p of Object.values(pathways) as any[]) {
      if (!p || p.projectId !== projectId) continue;
      const key = p.bundleId ?? `__single-${p.id}`;
      (byBundle[key] ??= []).push(p);
    }
    return byBundle;
  }, [pathways, projectId]);
  const items = Object.entries(bundles);
  if (items.length === 0) {
    return (
      <DrawerSection title="Conduit assist">
        <div className="text-[11px] text-muted-foreground italic px-1">
          No cable bundles yet. Multi-select devices and choose "Run to IDF" to create one — Assist will compute conduit fill and recommend a size here.
        </div>
      </DrawerSection>
    );
  }
  return (
    <DrawerSection title="Conduit assist">
      <div className="space-y-2.5">
        {items.map(([bundleId, group]) => {
          const cableType = String(group[0]?.cableType ?? 'cat6a').toLowerCase();
          const od = CABLE_OD_IN[cableType] ?? 0.31;
          const count = group.length;
          const cableAreaTotal = count * Math.PI * (od / 2) ** 2;
          const rule = count === 1 ? 0.53 : count === 2 ? 0.31 : 0.40;
          // Recommended = smallest EMT that satisfies the fill rule.
          const recommended = EMT_SIZES.find((e) => cableAreaTotal / e.areaIn2 <= rule);
          const target = group[0]?.targetId ?? '—';
          return (
            <div key={bundleId} className="rounded-md border border-border bg-background p-2.5">
              <div className="flex items-baseline justify-between">
                <div className="text-[12px] font-medium tracking-tight">{count}× {cableType.toUpperCase()} → {target}</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{(rule * 100).toFixed(0)}% rule</div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Cable OD {od}″ · total area <span className="tabular-nums text-foreground">{cableAreaTotal.toFixed(3)} in²</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {EMT_SIZES.map((e) => {
                  const fillPct = (cableAreaTotal / e.areaIn2) * 100;
                  const ok = fillPct / 100 <= rule;
                  return (
                    <div
                      key={e.size}
                      className="rounded border px-2 py-1 text-[10px] flex items-center justify-between"
                      style={{
                        borderColor: ok ? 'rgba(79,184,126,0.30)' : 'rgba(229,162,58,0.30)',
                        background: ok ? 'rgba(79,184,126,0.06)' : 'rgba(229,162,58,0.06)',
                        color: ok ? '#4FB87E' : '#E5A23A',
                      }}
                    >
                      <span className="font-medium">EMT {e.size}</span>
                      <span className="tabular-nums">{fillPct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] text-foreground">
                {recommended
                  ? <>Recommended conduit: <span className="font-medium">EMT {recommended.size}</span>. Reason: {count} × {cableType.toUpperCase()} fits under the {(rule * 100).toFixed(0) }% rule.</>
                  : <span className="text-amber-200">No standard EMT in stock satisfies the {(rule * 100).toFixed(0)}% rule for this bundle. Recommend splitting into two pathways.</span>}
              </div>
            </div>
          );
        })}
      </div>
    </DrawerSection>
  );
}
