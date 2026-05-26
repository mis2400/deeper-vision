// IdfPortScheduleSection — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Real IDF / MDF / Rack port schedule, populated live
// from bundle pathways that target the given IDF. Lists
// incoming runs, assigned PP + SW ports, PoE load, spare
// capacity, and over-capacity warnings. Honest by design —
// assumes one 24-port PP-01 and one 24-port SW-01 (Aruba
// 2930F-24P) unless future schema carries `switches[]` on the
// IDF device.

import { useMemo } from 'react';
import { pathwayLengthFt } from '../../lib/engineering';
import { useProjectStore } from '../../store/projectStore';
import { DrawerSection, FindingRow } from '../components/DrawerPrimitives';

export function IdfPortScheduleSection({ idfId }: { idfId: string }) {
  const pathways = useProjectStore((s) => s.pathways);
  const devices = useProjectStore((s) => s.devices);
  const floors = useProjectStore((s) => s.floors);
  const incoming = useMemo(
    () => (Object.values(pathways) as any[])
      .filter((p) => (p?.targetId ?? p?.destinationId) === idfId)
      .sort((a, b) => (a.patchPort ?? 999) - (b.patchPort ?? 999)),
    [pathways, idfId],
  );
  const PP_PORTS = 24;
  const SW_PORTS = 24;
  const SW_POE_BUDGET_W = 370; // Aruba 2930F-24G PoE+ class budget
  const poeLoad = incoming.length * 9.8; // assume ~10 W per camera
  const ppOver = incoming.filter((p) => p.patchPort && p.patchPort > PP_PORTS).length;
  const swOver = incoming.filter((p) => p.switchPort && p.switchPort > SW_PORTS).length;
  return (
    <>
      <DrawerSection title={`Incoming runs · ${incoming.length}`}>
        {incoming.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic px-1">
            No cable runs target this IDF yet. Use Run to IDF from the canvas to assign devices here.
          </div>
        ) : (
          <div className="space-y-1">
            {incoming.map((p) => {
              const src = devices[p.sourceId ?? ''] as any;
              return (
                <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md border border-border/40 bg-secondary/20 text-[11px]">
                  <span className="text-muted-foreground tabular-nums w-12">{String(p.cableType ?? 'cat6a').toUpperCase()}</span>
                  <span className="flex-1 truncate font-medium text-foreground">{src?.id ?? p.sourceId ?? p.id}</span>
                  <span className="text-muted-foreground tabular-nums">{pathwayLengthFt(p, floors[p.floorId ?? ''])} ft</span>
                  {p.patchPort && <span className="text-[10px] text-muted-foreground">PP·{String(p.patchPort).padStart(2, '0')}</span>}
                  {p.switchPort && <span className="text-[10px] text-muted-foreground">SW·{String(p.switchPort).padStart(2, '0')}</span>}
                </div>
              );
            })}
          </div>
        )}
      </DrawerSection>
      <DrawerSection title="Patch panel · PP-01">
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: PP_PORTS }).map((_, i) => {
            const port = i + 1;
            const run = incoming.find((p) => p.patchPort === port);
            const src = run && (devices[run.sourceId ?? ''] as any);
            return (
              <div
                key={port}
                title={run ? `Port ${String(port).padStart(2, '0')} → ${src?.id ?? run.sourceId}` : `Port ${String(port).padStart(2, '0')} · spare`}
                className="aspect-square rounded text-[9px] flex items-center justify-center"
                style={{
                  background: run ? 'rgba(93,160,232,0.18)' : 'rgba(255,255,255,0.04)',
                  color: run ? '#5DA0E8' : 'var(--muted-foreground)',
                  border: '1px solid ' + (run ? 'rgba(93,160,232,0.32)' : 'rgba(255,255,255,0.06)'),
                }}
              >
                {String(port).padStart(2, '0')}
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1.5">
          {incoming.filter((p) => p.patchPort).length} / {PP_PORTS} used · {PP_PORTS - incoming.filter((p) => p.patchPort).length} spare
          {ppOver > 0 && <span className="text-amber-300 ml-2">· {ppOver} over capacity</span>}
        </div>
      </DrawerSection>
      <DrawerSection title="Switch · SW-01 (Aruba 2930F-24P)">
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: SW_PORTS }).map((_, i) => {
            const port = i + 1;
            const run = incoming.find((p) => p.switchPort === port);
            const src = run && (devices[run.sourceId ?? ''] as any);
            return (
              <div
                key={port}
                title={run ? `Port ${String(port).padStart(2, '0')} → ${src?.id ?? run.sourceId}` : `Port ${String(port).padStart(2, '0')} · spare`}
                className="aspect-square rounded text-[9px] flex items-center justify-center"
                style={{
                  background: run ? 'rgba(79,184,126,0.18)' : 'rgba(255,255,255,0.04)',
                  color: run ? '#4FB87E' : 'var(--muted-foreground)',
                  border: '1px solid ' + (run ? 'rgba(79,184,126,0.32)' : 'rgba(255,255,255,0.06)'),
                }}
              >
                {String(port).padStart(2, '0')}
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1.5">
          {incoming.filter((p) => p.switchPort).length} / {SW_PORTS} used · PoE load {poeLoad.toFixed(1)} W / budget {SW_POE_BUDGET_W} W
          {swOver > 0 && <span className="text-amber-300 ml-2">· {swOver} over capacity</span>}
          {poeLoad > SW_POE_BUDGET_W && <span className="text-amber-300 ml-2">· PoE over budget</span>}
        </div>
      </DrawerSection>
      <DrawerSection title="Assist">
        <div className="space-y-1.5">
          {ppOver > 0 && <FindingRow severity="warn" text={`${ppOver} runs exceed the patch panel's 24-port capacity. Add a second 24-port PP or move to a 48-port unit.`} />}
          {swOver > 0 && <FindingRow severity="warn" text={`${swOver} runs exceed the switch's 24-port capacity. Add an uplink and a second 24-port switch.`} />}
          {poeLoad > SW_POE_BUDGET_W && <FindingRow severity="high" text={`PoE load ${poeLoad.toFixed(0)} W exceeds the 370 W budget. Add a PoE midspan or move to a larger PoE++ switch.`} />}
          {ppOver === 0 && swOver === 0 && poeLoad <= SW_POE_BUDGET_W && (
            <FindingRow severity="ok" text="Capacity nominal — patch panel, switch, and PoE budget all within design limits." />
          )}
        </div>
      </DrawerSection>
    </>
  );
}
