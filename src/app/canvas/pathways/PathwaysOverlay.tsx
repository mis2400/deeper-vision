// PathwaysOverlay — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. SVG <g> that renders every committed pathway record
// on the active floor: standalone routes (cable, conduit,
// J-hook, tray) drawn as polylines with kind-specific stroke
// and dash, plus bundled cable routes that collapse N runs to
// one composite line with a "10× CAT6A → IDF-01" midpoint
// label. Each path + bundle label is independently clickable
// so the parent opens either the PathwayDrawer for a single
// run or the BundleInspectorDialog for the whole bundle.

import { useMemo } from 'react';
import { useProjectStore } from '../../store/projectStore';

export function PathwaysOverlay({ onPickBundle, onPickPathway, floorId }: {
  onPickBundle?: (bundleId: string) => void;
  onPickPathway?: (pathwayId: string) => void;
  /** Canvas V2 Pass 2A.3 — only render pathways that live on the
   *  active floor. When omitted, defaults to rendering all (legacy). */
  floorId?: string;
}) {
  const pathways = useProjectStore((s) => s.pathways);
  // Group bundle paths so we collapse a 10-camera bundle into ONE label
  // even though there are 10 pathway records under the hood. Defensive
  // — pathway records can be missing `points` after migrations or
  // during partial drag-in-progress, so we filter them out cleanly.
  const items = useMemo(() => {
    const arr = (pathways ? Object.values(pathways) : []) as any[];
    const bundles: Record<string, any[]> = {};
    const standalone: any[] = [];
    for (const p of arr) {
      if (!p || !Array.isArray(p.points) || p.points.length < 2) continue;
      if (floorId && p.floorId !== floorId) continue;
      if (p.bundleId) (bundles[p.bundleId] ??= []).push(p);
      else standalone.push(p);
    }
    return { bundles, standalone };
  }, [pathways, floorId]);
  return (
    <g>
      {/* Standalone routes — cables AND standalone conduit / J-hook /
          tray placements rendered here. Each is clickable so the user
          can open the right-side PathwayDrawer. */}
      {items.standalone.map((p) => {
        const pts: { x: number; y: number }[] = p.points ?? [];
        if (pts.length < 2) return null;
        const isConduitPath = p.pathwayKind && p.pathwayKind !== 'cable';
        const stroke = isConduitPath ? '#A371F7' : '#22D3EE';
        const dash = p.pathwayKind === 'conduit' ? '6 4' : p.pathwayKind === 'tray' ? '10 3 2 3' : p.pathwayKind === 'jhook' ? '2 4' : undefined;
        const mid = pts.length >= 2 ? { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2 } : null;
        const label = isConduitPath
          ? `${p.conduitType ?? p.pathwayKind?.toUpperCase()}${p.conduitSize ? ' ' + p.conduitSize : ''}`
          : `${String(p.cableType ?? 'cat6').toUpperCase()}`;
        return (
          <g
            key={p.id}
            style={{ cursor: onPickPathway ? 'pointer' : 'default' }}
            onClick={(e) => { e.stopPropagation(); onPickPathway && onPickPathway(p.id); }}
            data-track={`pathway-${p.id}`}
            data-testid={`pathway-${p.id}`}
            data-object-kind="pathway"
          >
            {/* Hit-area: invisible thick stroke so clicks register on a
                line that's otherwise 1.6 px wide. */}
            <polyline
              points={pts.map((pt) => `${pt.x},${pt.y}`).join(' ')}
              fill="none"
              stroke="transparent"
              strokeWidth="12"
              pointerEvents="stroke"
            />
            <polyline
              points={pts.map((pt) => `${pt.x},${pt.y}`).join(' ')}
              fill="none"
              stroke={stroke}
              strokeWidth={isConduitPath ? 2.2 : 1.6}
              opacity="0.78"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={dash}
              pointerEvents="none"
            />
            {mid && isConduitPath && (
              <g transform={`translate(${mid.x}, ${mid.y - 8})`} pointerEvents="none">
                <rect x={-44} y={-9} width={88} height={18} rx={9} fill="#1A1230" fillOpacity="0.92" stroke="#A371F7" strokeWidth="0.6" />
                <text x={0} y={3} textAnchor="middle" fill="#E6E1FB" fontSize="10" fontWeight="600">{label}</text>
              </g>
            )}
          </g>
        );
      })}
      {/* Bundled cable routes — one composite line per bundle + label */}
      {Object.entries(items.bundles).map(([bundleId, group]) => {
        if (group.length === 0) return null;
        const first = group[0];
        const _lastPath = group[group.length - 1];
        void _lastPath;
        const cableType = String(first.cableType ?? 'cat6a').toUpperCase();
        const target = first.targetId ?? 'IDF';
        const mid = first.points && first.points.length >= 2
          ? { x: (first.points[0].x + first.points[1].x) / 2, y: (first.points[0].y + first.points[1].y) / 2 }
          : null;
        return (
          <g key={bundleId}>
            {/* Draw each underlying path with reduced opacity so the
                bundle reads as one route while still showing fan-in.
                Each individual run is clickable too, opening the
                right-side PathwayDrawer on its specific pathway. */}
            {group.map((p) => (
              p.points && p.points.length >= 2 && (
                <g
                  key={p.id}
                  style={{ cursor: onPickPathway ? 'pointer' : 'default' }}
                  onClick={(e) => { e.stopPropagation(); onPickPathway && onPickPathway(p.id); }}
                  data-testid={`pathway-${p.id}`}
                  data-track={`pathway-${p.id}`}
                  data-object-kind="pathway"
                >
                  <polyline
                    points={p.points.map((pt: any) => `${pt.x},${pt.y}`).join(' ')}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="10"
                    pointerEvents="stroke"
                  />
                  <polyline
                    points={p.points.map((pt: any) => `${pt.x},${pt.y}`).join(' ')}
                    fill="none"
                    stroke="#22D3EE"
                    strokeWidth="1.4"
                    opacity="0.55"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                </g>
              )
            ))}
            {/* Bundle label at the midpoint of the first run. Includes the
                count and destination so the route reads as engineering, not
                just a colored line. Clickable → opens the bundle inspector. */}
            {mid && (
              <g
                transform={`translate(${mid.x}, ${mid.y})`}
                style={{ cursor: onPickBundle ? 'pointer' : 'default', pointerEvents: 'auto' }}
                onClick={(e) => { e.stopPropagation(); onPickBundle && onPickBundle(bundleId); }}
                data-track={`bundle-label-${bundleId}`}
              >
                <rect x={-58} y={-9} width={116} height={18} rx={9} fill="#0B1424" fillOpacity="0.92" stroke="#22D3EE" strokeWidth="0.6" />
                <text x={0} y={3} textAnchor="middle" fill="#E6F1FB" fontSize="10" fontWeight="600">{group.length}× {cableType} → {target}</text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
