// Pathway routing — now reads live from the project store. The list of
// pathway runs, devices, and IDFs shown here is the same set the canvas
// renders. Tray fill is computed from cable counts on each pathway.

import { useState, useMemo } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Cable, Route } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';

export function PathwayRouting() {
  const { projectId = 'p1' } = useParams();
  const [showRuns, setShowRuns] = useState(true);
  const [showDevices, setShowDevices] = useState(true);

  // Subscribe to raw maps — sorting/filtering happens in useMemo. Selectors
  // that returned `Object.values(...).filter(...)` directly caused infinite
  // re-renders because the array identity changed every call.
  const pathwaysMap = useProjectStore((s) => s.pathways);
  const devicesMap  = useProjectStore((s) => s.devices);
  const idfsMap     = useProjectStore((s) => s.idfs);
  const projectName = useProjectStore((s) => s.projects[projectId]?.name ?? 'Project');

  const pathways = useMemo(
    () => Object.values(pathwaysMap).filter((p) => p.projectId === projectId),
    [pathwaysMap, projectId],
  );
  const devices = useMemo(
    () => Object.values(devicesMap).filter((d) => d.projectId === projectId),
    [devicesMap, projectId],
  );
  const idfs = useMemo(
    () => Object.values(idfsMap).filter((i) => i.projectId === projectId),
    [idfsMap, projectId],
  );

  // Pathway fill telemetry — each pathway carries cableCount + conduitFill.
  // We surface a unique row per pathway, derived from the live store.
  const trayRows = useMemo(() => pathways.map((p) => ({
    id: p.id,
    name: p.sourceId && p.destinationId ? `${p.sourceId} → ${p.destinationId}` : p.id,
    type: p.type,
    cableType: p.cableType,
    count: p.cableCount,
    fillPct: (p.conduitFill ?? 0) * 100,
  })), [pathways]);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: projectName, to: `/project/${projectId}/canvas` }, { label: 'Pathways' }]}
      title="Pathway routing"
      subtitle={`Live from canvas · ${pathways.length} pathway${pathways.length === 1 ? '' : 's'} · ${devices.length} device${devices.length === 1 ? '' : 's'} · ${idfs.length} IDF${idfs.length === 1 ? '' : 's'}`}
      actions={<Button size="sm" variant="outline">Export pathway schedule</Button>}
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-[1fr_320px] gap-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={showRuns} onChange={(e) => setShowRuns(e.target.checked)} className="accent-primary" /> Cable runs
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={showDevices} onChange={(e) => setShowDevices(e.target.checked)} className="accent-primary" /> Devices
            </label>
          </div>
          <div className="aspect-[4/3] bg-canvas-background relative">
            <svg viewBox="0 0 800 600" className="absolute inset-0 w-full h-full">
              <defs>
                <pattern id="path-dot" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#E6EDF3" opacity="0.06" /></pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#path-dot)" />

              {/* Pathways rendered from store points. The canvas paints in
                  larger coords (x ~ 0..1000); pathway SVG uses the same units
                  here so visuals match. */}
              {showRuns && pathways.map((p) => {
                const d = p.points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
                return <path key={p.id} d={d} stroke="#D29922" strokeWidth="1.4" fill="none" opacity="0.8" />;
              })}

              {/* Devices + IDFs as dots */}
              {showDevices && devices.map((dv) => (
                <g key={dv.id}>
                  <circle cx={dv.x} cy={dv.y} r="4" fill="#2F81F7" stroke="#0D1117" strokeWidth="1.5" />
                  <text x={dv.x + 7} y={dv.y + 3} fontSize="9" fill="#9CA3AF">{dv.id}</text>
                </g>
              ))}
              {idfs.map((i) => (
                <g key={i.id}>
                  <rect x={i.x - 6} y={i.y - 6} width="12" height="12" fill="#A371F7" stroke="#0D1117" strokeWidth="1.5" />
                  <text x={i.x + 9} y={i.y + 3} fontSize="9" fill="#A371F7">{i.name}</text>
                </g>
              ))}

              {pathways.length === 0 && devices.length === 0 && (
                <text x="400" y="300" textAnchor="middle" fill="#6B7280" fontSize="11">
                  No pathways on this project yet · draw one from the canvas
                </text>
              )}
            </svg>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <Route className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="text-sm font-medium">Pathway runs</div>
            </div>
            {trayRows.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">No runs defined yet.</div>
            ) : trayRows.map((t) => {
              const warn = t.fillPct > 40; // NEC 40% conduit fill ceiling for 3+ conductors
              return (
                <div key={t.id} className="px-3 py-2.5 border-b border-border last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{t.name}</div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.type}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-muted-foreground">{t.count} × {t.cableType.toUpperCase()}</span>
                    <span className={warn ? 'text-amber-400' : 'text-muted-foreground'}>
                      {t.fillPct > 0 ? `${Math.round(t.fillPct)}% fill` : 'unsized'}
                    </span>
                  </div>
                  {t.fillPct > 0 && (
                    <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full ${warn ? 'bg-amber-400' : 'bg-primary'}`} style={{ width: `${Math.min(100, t.fillPct)}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Cable className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Pathway runs are owned by the canvas. Draw, edit, or delete them there — fills and counts update here on next view.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
