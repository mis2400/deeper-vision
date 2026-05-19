// SC.6.6 — Customer Portal design snapshot renderer. Pure read-only
// SVG view over Proposal.canvasSnapshot. The snapshot is frozen at
// proposal send time so this renderer NEVER touches the live canvas
// or the live device store — every coordinate, label, and coverage
// shape is from the historical document.
//
// Customer-safe rules:
//   * No internal device ids rendered (we key by them, never display).
//   * No costs / quantities — the BOM card already covers that.
//   * No engineering-style overlays (calibration dots, edit handles).
//   * Labels are device.label captured at send time, never live state.
//
// Multi-floor projects render a small tab strip; single-floor renders
// the SVG directly.

import { useEffect, useMemo, useState } from 'react';
import { Layers as LayersIcon } from 'lucide-react';
import type {
  ProposalCanvasSnapshot,
  ProposalCanvasSnapshotDevice,
  ProposalCanvasSnapshotBackground,
} from '../store/types';
import { getBlueprint } from '../lib/blueprintStore';

const VIEWBOX_PADDING_PX = 60;
const MIN_VIEWBOX_DIMENSION = 200;
const DEVICE_DOT_R = 6;
const COVERAGE_OPACITY = 0.16;

// Customer-friendly device kind labels. The underlying DeviceType
// union is technical (cam.bullet / acc.reader / etc); the portal
// shouldn't show that vocabulary. Falls through to a generic label
// based on the namespace if a specific entry is missing so the
// renderer never breaks on a new device kind landing post-snapshot.
const KIND_LABEL: Record<string, string> = {
  'cam.bullet':      'Camera',
  'cam.dome':        'Camera',
  'cam.ptz':         'PTZ camera',
  'cam.multisensor': 'Multisensor camera',
  'cam.fisheye':     'Fisheye camera',
  'cam.thermal':     'Thermal camera',
  'cam.lpr':         'LPR camera',
  'cam.body':        'Body camera',
  'acc.reader':      'Card reader',
  'acc.strike':      'Door strike',
  'acc.maglock':     'Mag lock',
  'acc.rex':         'Request to exit',
  'acc.exit':        'Exit device',
  'acc.door':        'Door',
  'acc.gate':        'Gate',
  'acc.biometric':   'Biometric reader',
  'net.idf':         'Network closet',
  'net.mdf':         'Main distribution',
  'net.switch':      'Network switch',
  'net.ap':          'Wi-Fi access point',
  'net.firewall':    'Firewall',
  'sen.motion':      'Motion sensor',
  'sen.glass':       'Glass break sensor',
  'sen.contact':     'Door contact',
  'sen.panic':       'Panic button',
  'sen.smoke':       'Smoke sensor',
  'aud.speaker':     'Speaker',
  'aud.intercom':    'Intercom',
  'aud.horn':        'Horn',
  'sto.nvr':         'Recorder',
  'sto.cloud':       'Cloud recording',
  'sto.server':      'Server',
  'dis.monitor':     'Monitor',
  'dis.video-wall':  'Video wall',
  'dis.kiosk':       'Kiosk',
  'pwr.ups':         'Battery backup',
  'pwr.poe':         'Power over Ethernet',
};

const KIND_TONE: Record<string, string> = {
  cam: '#60a5fa', // blue
  acc: '#22d3ee', // cyan
  net: '#a78bfa', // violet
  pwr: '#f59e0b', // amber
  sen: '#34d399', // emerald
  aud: '#f472b6', // pink
  sto: '#94a3b8', // slate
  dis: '#fbbf24', // amber-light
};

function kindLabel(k: string): string {
  if (KIND_LABEL[k]) return KIND_LABEL[k];
  const ns = k.split('.')[0];
  return ns === 'cam' ? 'Camera'
       : ns === 'acc' ? 'Access device'
       : ns === 'net' ? 'Network'
       : ns === 'pwr' ? 'Power'
       : ns === 'sen' ? 'Sensor'
       : ns === 'aud' ? 'Audio'
       : ns === 'sto' ? 'Storage'
       : ns === 'dis' ? 'Display'
       : 'Device';
}

function kindTone(k: string): string {
  const ns = k.split('.')[0];
  return KIND_TONE[ns] ?? '#94a3b8';
}

export function PortalDesignSnapshotCard({ snapshot, versionLabel }: {
  snapshot: ProposalCanvasSnapshot;
  versionLabel: string;
}) {
  const floors = snapshot.floors;
  // Pick a stable default — lowest level first so a customer who
  // bookmarks the portal lands on the same floor every visit.
  const sortedFloors = useMemo(
    () => floors.slice().sort((a, b) => a.level - b.level),
    [floors],
  );
  const [activeFloorId, setActiveFloorId] = useState<string>(sortedFloors[0]?.id ?? '');
  const activeFloor = sortedFloors.find((f) => f.id === activeFloorId) ?? sortedFloors[0];

  if (!activeFloor) {
    return (
      <div className="text-sm text-muted-foreground italic">
        This snapshot has no floors. Reach out if you expected a layout here.
      </div>
    );
  }

  // Memoise the per-floor slices so the bbox memo below has a stable
  // dependency. Without these the `.filter` calls produced fresh
  // arrays on every render and the bbox useMemo was effectively dead
  // (re-running on every parent re-render).
  const wallsForFloor = useMemo(
    () => snapshot.walls.filter((w) => w.floorId === activeFloor.id),
    [snapshot.walls, activeFloor.id],
  );
  const devicesForFloor = useMemo(
    () => snapshot.devices.filter((d) => d.floorId === activeFloor.id),
    [snapshot.devices, activeFloor.id],
  );
  const roomsForFloor = useMemo(
    () => snapshot.rooms.filter((r) => r.floorId === activeFloor.id),
    [snapshot.rooms, activeFloor.id],
  );

  // Compute viewBox from the union of every visible coordinate. If
  // there's nothing to render we fall back to a generic 800x600 so
  // the card still has structure (and the "empty" hint shows clearly).
  const bbox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const eat = (x: number, y: number) => {
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    };
    for (const w of wallsForFloor) {
      for (const p of w.points) eat(p.x, p.y);
    }
    for (const r of roomsForFloor) {
      for (const p of r.polygon) eat(p.x, p.y);
    }
    for (const d of devicesForFloor) {
      eat(d.position.x, d.position.y);
      const cov = d.coverage;
      if (cov?.shape === 'cone' && cov.rangeFt && activeFloor.scalePxToFt > 0) {
        const rangePx = cov.rangeFt / activeFloor.scalePxToFt;
        eat(d.position.x - rangePx, d.position.y - rangePx);
        eat(d.position.x + rangePx, d.position.y + rangePx);
      } else if (cov?.shape === 'radius' && cov.rangeFt && activeFloor.scalePxToFt > 0) {
        const rangePx = cov.rangeFt / activeFloor.scalePxToFt;
        eat(d.position.x - rangePx, d.position.y - rangePx);
        eat(d.position.x + rangePx, d.position.y + rangePx);
      } else if (cov?.shape === 'polygon' && cov.polygon) {
        for (const p of cov.polygon) eat(p.x, p.y);
      }
    }
    if (activeFloor.background) {
      const bg = activeFloor.background;
      const w = bg.naturalWidth * (bg.scale ?? 1);
      const h = bg.naturalHeight * (bg.scale ?? 1);
      eat(bg.x, bg.y);
      eat(bg.x + w, bg.y + h);
    }
    if (!Number.isFinite(minX)) {
      return { x: 0, y: 0, width: 800, height: 600 };
    }
    const widthRaw  = Math.max(MIN_VIEWBOX_DIMENSION, maxX - minX);
    const heightRaw = Math.max(MIN_VIEWBOX_DIMENSION, maxY - minY);
    return {
      x:      minX - VIEWBOX_PADDING_PX,
      y:      minY - VIEWBOX_PADDING_PX,
      width:  widthRaw  + 2 * VIEWBOX_PADDING_PX,
      height: heightRaw + 2 * VIEWBOX_PADDING_PX,
    };
  }, [wallsForFloor, devicesForFloor, roomsForFloor, activeFloor]);

  const empty = wallsForFloor.length === 0 && devicesForFloor.length === 0 && roomsForFloor.length === 0 && !activeFloor.background;

  return (
    <div data-testid="portal-design-snapshot">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-[11px] text-muted-foreground">
          Captured {new Date(snapshot.capturedAt).toLocaleDateString()} · {versionLabel}
        </div>
        {sortedFloors.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap">
            {sortedFloors.map((f) => {
              const on = f.id === activeFloor.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFloorId(f.id)}
                  data-testid={`portal-snapshot-floor-${f.id}`}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors ${on ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:border-border-strong'}`}
                >
                  <LayersIcon className="w-3 h-3" />
                  {f.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-secondary/30 overflow-hidden">
        {empty ? (
          <div className="text-center py-12 px-4 text-sm text-muted-foreground">
            Nothing was placed on this floor at the time of the proposal.
          </div>
        ) : (
          <svg
            data-testid="portal-design-snapshot-svg"
            viewBox={`${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`}
            className="w-full h-auto block max-h-[480px]"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Floor plan: ${activeFloor.name}`}
          >
            {/* Blueprint background, if captured. SC.7.3 split into a
                sub-component because the dataUrl may need an async
                IndexedDB lookup. Rotation pivots on the image center
                to match the engineering canvas convention. */}
            {activeFloor.background && <SnapshotBackground bg={activeFloor.background} />}

            {/* Rooms — soft polygon fill so devices read clearly on top. */}
            {roomsForFloor.map((r) => r.polygon.length >= 3 && (
              <g key={r.id}>
                <polygon
                  points={r.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(99, 102, 241, 0.06)"
                  stroke="rgba(99, 102, 241, 0.30)"
                  strokeWidth={1.5}
                />
                <text
                  x={r.polygon.reduce((s, p) => s + p.x, 0) / r.polygon.length}
                  y={r.polygon.reduce((s, p) => s + p.y, 0) / r.polygon.length}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={12}
                  fill="rgba(148, 163, 184, 0.95)"
                >
                  {r.name}
                </text>
              </g>
            ))}

            {/* Walls — thin strokes. */}
            {wallsForFloor.map((w) => {
              const [a, b] = w.points;
              if (!a || !b) return null;
              return (
                <line
                  key={w.id}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="rgba(203, 213, 225, 0.85)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Coverage envelopes (cone / radius / polygon). */}
            {devicesForFloor.map((d) => renderCoverage(d, activeFloor.scalePxToFt))}

            {/* Devices — colored dot + small label. */}
            {devicesForFloor.map((d) => {
              const tone = kindTone(d.kind);
              return (
                <g key={d.id} data-device-kind={d.kind}>
                  <circle
                    cx={d.position.x}
                    cy={d.position.y}
                    r={DEVICE_DOT_R}
                    fill={tone}
                    stroke="rgba(15, 23, 42, 0.9)"
                    strokeWidth={1.5}
                  />
                  <text
                    x={d.position.x + DEVICE_DOT_R + 4}
                    y={d.position.y + 4}
                    fontSize={11}
                    fill="rgba(226, 232, 240, 0.95)"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Legend — derived from what's actually on this floor. */}
      {!empty && devicesForFloor.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {kindCountsForFloor(devicesForFloor).map(({ kind, count }) => (
            <span key={kind} className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: kindTone(kind) }} />
              {kindLabel(kind)} <span className="tabular-nums">× {count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// SC.7.3 — blueprint background renderer. Handles both legacy inline
// dataUrl (SC.6.6 v29 snapshots) and the new dataUrlRef (v30+) that
// resolves via IndexedDB. When the lookup fails or returns null the
// SVG renders without the background; the floor's walls, devices, and
// rooms still draw normally so the customer still sees the layout.
function SnapshotBackground({ bg }: { bg: ProposalCanvasSnapshotBackground }) {
  const [resolved, setResolved] = useState<string | null>(bg.dataUrl ?? null);
  useEffect(() => {
    let cancelled = false;
    if (bg.dataUrl) {
      setResolved(bg.dataUrl);
      return;
    }
    if (bg.dataUrlRef) {
      getBlueprint(bg.dataUrlRef)
        .then((src) => { if (!cancelled) setResolved(src); })
        .catch((err) => {
          if (!cancelled) {
            console.warn(`[portalDesignSnapshot] blueprint ${bg.dataUrlRef} lookup failed`, err);
            setResolved(null);
          }
        });
    }
    return () => { cancelled = true; };
  }, [bg.dataUrl, bg.dataUrlRef]);

  if (!resolved) return null;
  const w = bg.naturalWidth * (bg.scale ?? 1);
  const h = bg.naturalHeight * (bg.scale ?? 1);
  const cx = bg.x + w / 2;
  const cy = bg.y + h / 2;
  return (
    <image
      href={resolved}
      x={bg.x}
      y={bg.y}
      width={w}
      height={h}
      opacity={bg.opacity ?? 1}
      transform={bg.rotation ? `rotate(${bg.rotation} ${cx} ${cy})` : undefined}
      preserveAspectRatio="none"
    />
  );
}

function kindCountsForFloor(devs: ProposalCanvasSnapshotDevice[]): { kind: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of devs) counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);
}

function renderCoverage(d: ProposalCanvasSnapshotDevice, scalePxToFt: number) {
  const cov = d.coverage;
  if (!cov || cov.shape === 'none') return null;
  const tone = cov.tint ?? kindTone(d.kind);
  if (cov.shape === 'polygon' && cov.polygon && cov.polygon.length >= 3) {
    return (
      <polygon
        key={`cov-${d.id}`}
        points={cov.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
        fill={tone}
        fillOpacity={COVERAGE_OPACITY}
        stroke="none"
      />
    );
  }
  if (!cov.rangeFt || scalePxToFt <= 0) return null;
  const rangePx = cov.rangeFt / scalePxToFt;
  if (cov.shape === 'radius') {
    return (
      <circle
        key={`cov-${d.id}`}
        cx={d.position.x} cy={d.position.y}
        r={rangePx}
        fill={tone}
        fillOpacity={COVERAGE_OPACITY}
        stroke="none"
      />
    );
  }
  if (cov.shape === 'cone') {
    // CoverageProfile.fovDeg is the HALF angle per the schema
    // ("full FOV = 2 * halfAngleDeg"), so it's used directly here.
    // largeArc flips when the total sweep crosses 180° — that's
    // halfFov > 90.
    const halfFov = cov.fovDeg ?? 30;
    const rotDeg  = d.rotation ?? 0;
    // Build a wedge via two arc endpoints + the device origin.
    const toRad = (deg: number) => (deg - 90) * Math.PI / 180;
    const startAngle = rotDeg - halfFov;
    const endAngle   = rotDeg + halfFov;
    const x1 = d.position.x + rangePx * Math.cos(toRad(startAngle));
    const y1 = d.position.y + rangePx * Math.sin(toRad(startAngle));
    const x2 = d.position.x + rangePx * Math.cos(toRad(endAngle));
    const y2 = d.position.y + rangePx * Math.sin(toRad(endAngle));
    const largeArc = halfFov > 90 ? 1 : 0;
    const path = `M ${d.position.x} ${d.position.y} L ${x1} ${y1} A ${rangePx} ${rangePx} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return (
      <path
        key={`cov-${d.id}`}
        d={path}
        fill={tone}
        fillOpacity={COVERAGE_OPACITY}
        stroke="none"
      />
    );
  }
  return null;
}
