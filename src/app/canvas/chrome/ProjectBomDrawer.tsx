// ProjectBomDrawer + BomRow — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. The right-side BOM drawer the operator opens from the
// TopBar's "BOM & Estimate" button: live deriveCanvasBomRows
// result with per-category filter pills, floor-scope select,
// inline pricebook editor launch, CSV export, and totals block.
// BomRow is the per-row card; private to the drawer because
// only this drawer composes the precise row affordance shape
// (status badges, override marker, floor / room chips, qty +
// unit + line total).
//
// Reads each store slice with its own primitive selector
// subscription (projects, projectPricebooks, devices, doors,
// pathways, idfs, floors, rooms, estimates) — never the whole
// store. The earlier whole-store pattern that this module was
// extracted with caused the original /deployment React infinite
// re-render crash (whole sub → new identity → useEffect dep →
// loop), so every slice the BOM derive needs lands as its own
// selector.

import { AlertTriangle, DollarSign, FileDown, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PricebookEditor } from '../../components/canvas/PricebookEditor';
import { deriveCanvasBomRows, useProjectStore } from '../../store/projectStore';
import type { CanvasBomCategory, CanvasBomRow } from '../../store/types';

export function ProjectBomDrawer({
  projectId, onClose, onSelectDevice, onSelectPathway,
}: {
  projectId: string;
  onClose: () => void;
  onSelectDevice: (id: string) => void;
  onSelectPathway: (id: string) => void;
}) {
  // Primitive selector subs — one per slice the drawer actually reads.
  // Replaces the whole-store sub that originally lived here; React now
  // only re-renders this drawer when one of these specific slices
  // changes, not on every unrelated store write.
  const projects           = useProjectStore((s) => s.projects);
  const projectPricebooks  = useProjectStore((s) => s.projectPricebooks);
  const devices            = useProjectStore((s) => s.devices);
  const doors              = useProjectStore((s) => s.doors);
  const pathways           = useProjectStore((s) => s.pathways);
  const idfs               = useProjectStore((s) => s.idfs);
  const floors             = useProjectStore((s) => s.floors);
  const rooms              = useProjectStore((s) => s.rooms);
  const estimates          = useProjectStore((s) => s.estimates);

  const projectName = projects[projectId]?.name ?? 'Project';
  // deriveCanvasBomRows wants a state-shaped object; assemble a minimal
  // shim from the selector subs above so the derive helper keeps its
  // existing signature.
  const { rows, totals } = useMemo(
    () => deriveCanvasBomRows(
      { projects, projectPricebooks, devices, doors, pathways, idfs, floors, rooms, estimates } as any,
      projectId,
    ),
    [projects, projectPricebooks, devices, doors, pathways, idfs, floors, rooms, estimates, projectId],
  );
  // Pricebook editor is a modal mounted on top of this drawer so the
  // user can watch totals update underneath while editing.
  const [pricebookOpen, setPricebookOpen] = useState(false);
  const pricebook = projectPricebooks[projectId];
  const overrideCount =
    (Object.keys(pricebook?.doorHardware ?? {}).length) +
    (Object.keys(pricebook?.cablePerFt ?? {}).length) +
    (pricebook?.laborRate != null ? 1 : 0) +
    (pricebook?.markup != null ? 1 : 0);
  const hasOverrides = overrideCount > 0;
  const overriddenRowCount = rows.filter((r) => r.overridden).length;

  type FilterKey = 'all' | CanvasBomCategory | 'existing';
  const [filter, setFilter] = useState<FilterKey>('all');
  // Canvas V2 Pass 2A.8 — floor scope filter. 'all' keeps the BOM
  // project wide (default behaviour as called for in the brief);
  // any specific floor id narrows to rows whose source device lives
  // on that floor. Pathway / cable rows also honour the filter via
  // their stored floorId.
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const projectFloors = useMemo(() => Object.values(floors)
    .filter((f) => f.projectId === projectId)
    .sort((a, b) => (b.level - a.level) || ((b.createdAt ?? 0) - (a.createdAt ?? 0))),
    [floors, projectId],
  );

  const FILTERS: { id: FilterKey; label: string }[] = [
    { id: 'all',      label: 'All' },
    { id: 'cameras',  label: 'Cameras' },
    { id: 'access',   label: 'Access' },
    { id: 'network',  label: 'Network' },
    { id: 'cabling',  label: 'Cabling' },
    { id: 'existing', label: 'Existing' },
  ];

  // Per row floor lookup so each BOM line can annotate which floor
  // its source lives on. Pathways carry their own floorId; devices
  // need a lookup against the store.
  const floorIdForRow = useCallback((r: CanvasBomRow): string | null => {
    const sid = (r as any).sourceId as string | undefined;
    if (!sid) return null;
    const dev = (devices as any)[sid];
    if (dev?.floorId) return dev.floorId;
    const path = (pathways as any)[sid];
    if (path?.floorId) return path.floorId;
    return null;
  }, [devices, pathways]);
  const floorNameForRow = useCallback((r: CanvasBomRow): string => {
    const fid = floorIdForRow(r);
    if (!fid) return '—';
    return (floors as any)[fid]?.name ?? '—';
  }, [floorIdForRow, floors]);

  // Canvas V2 Pass 2C.4 — per row room lookup. A device row's "room"
  // is the polygon whose bounds contain the device origin. Pathways
  // don't currently report rooms (their geometry is a polyline; the
  // first-vertex room is a sensible fallback but added complexity).
  const roomNameForRow = useCallback((r: CanvasBomRow): string | null => {
    const sid = (r as any).sourceId as string | undefined;
    if (!sid) return null;
    const dev = (devices as any)[sid];
    if (!dev) return null;
    const projectRooms = Object.values(rooms).filter((rm: any) => rm.projectId === projectId && rm.floorId === dev.floorId);
    for (const rm of projectRooms as any[]) {
      // Ray-casting point in polygon.
      let inside = false;
      const poly = rm.polygon as { x: number; y: number }[];
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > dev.y) !== (yj > dev.y)) &&
          (dev.x < (xj - xi) * (dev.y - yi) / ((yj - yi) || 1) + xi);
        if (intersect) inside = !inside;
      }
      if (inside) return rm.name;
    }
    return null;
  }, [devices, rooms, projectId]);

  const filtered = useMemo(() => {
    let out = rows;
    if (filter === 'existing') out = out.filter((r) => r.isExisting);
    else if (filter !== 'all') out = out.filter((r) => r.category === filter);
    if (floorFilter !== 'all') out = out.filter((r) => floorIdForRow(r) === floorFilter);
    return out;
  }, [rows, filter, floorFilter, floorIdForRow]);

  const grouped = useMemo(() => {
    const groups = new Map<CanvasBomCategory, CanvasBomRow[]>();
    for (const r of filtered) {
      const arr = groups.get(r.category) ?? [];
      arr.push(r);
      groups.set(r.category, arr);
    }
    return groups;
  }, [filtered]);

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString();
  const exportCsv = () => {
    const head = ['Category', 'Source', 'Description', 'Product', 'Status', 'Qty', 'UOM', 'Unit price', 'Line total', 'Labor hrs'];
    const lines: (string | number)[][] = [head];
    for (const r of rows) {
      lines.push([
        r.category,
        r.meta ?? r.sourceId ?? '',
        r.description,
        r.product ?? '',
        r.isExisting ? 'Existing' : 'Proposed',
        r.qty,
        r.uom,
        r.unitPrice.toFixed(2),
        (r.unitPrice * r.qty).toFixed(2),
        r.laborHours.toFixed(2),
      ]);
    }
    // Totals block
    lines.push([]);
    lines.push(['TOTALS']);
    lines.push(['Devices on plan', totals.deviceCount]);
    lines.push(['Proposed material', totals.proposedMaterial.toFixed(2)]);
    lines.push(['Existing documented', totals.existingDocumented.toFixed(2)]);
    lines.push(['Cable', totals.cable.toFixed(2)]);
    lines.push(['Labor hours', totals.laborHours.toFixed(2)]);
    lines.push(['Labor cost', totals.laborTotal.toFixed(2)]);
    lines.push(['Markup', (totals.markup * 100).toFixed(1) + '%']);
    lines.push(['Sell total', totals.sellTotal.toFixed(2)]);

    const csvField = (v: unknown): string => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const body = lines.map((row) => row.map(csvField).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeProject = projectName.replace(/[^a-z0-9-_]+/gi, '_');
    a.download = `${safeProject}-bom.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('BOM exported', { description: `${rows.length} lines · ${a.download}`, duration: 3000 });
  };

  const CATEGORY_LABEL: Record<CanvasBomCategory, string> = {
    cameras: 'Cameras',
    access:  'Access control',
    network: 'Network & power',
    cabling: 'Cable & pathways',
    conduit: 'Conduit & raceway',
    walls:   'Walls & openings',
    labor:   'Labor',
    other:   'Other',
  };
  const CATEGORY_ORDER: CanvasBomCategory[] = ['cameras', 'access', 'network', 'cabling', 'labor', 'other'];

  return (
    <div
      data-canvas-chrome="drawer"
      className="absolute top-0 right-0 bottom-0 z-40 transition-transform duration-300 translate-x-0 pointer-events-auto flex flex-col"
      style={{
        width: 460,
        background: 'var(--drawer-background)',
        color: 'var(--drawer-foreground)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-16px 0 40px -16px rgba(0,0,0,0.35)',
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-white/[0.05] shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#22D3EE', boxShadow: '0 0 6px #22D3EE66' }} />
              <span className="text-[11px] text-muted-foreground tracking-tight">Project BOM · derived live from canvas</span>
            </div>
            <div className="text-[18px] font-medium text-foreground tracking-tight truncate leading-tight">{projectName}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{rows.length} line{rows.length === 1 ? '' : 's'} · {totals.deviceCount} device{totals.deviceCount === 1 ? '' : 's'} on plan</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setPricebookOpen(true)}
              title="Edit pricebook · override prices + labor + markup for this project"
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] border transition-colors ${hasOverrides ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15' : 'border-border bg-secondary/40 hover:bg-secondary text-foreground'}`}
              data-track="bom-open-pricebook"
            >
              <DollarSign className="w-3.5 h-3.5" />Pricebook{hasOverrides && <span className="text-[9.5px] tabular-nums opacity-80">· {overrideCount}</span>}
            </button>
            <button
              onClick={exportCsv}
              title={`Export ${rows.length} BOM lines as CSV`}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] border border-border bg-secondary/40 hover:bg-secondary text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              data-track="bom-export-csv"
            >
              <FileDown className="w-3.5 h-3.5" />CSV
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/[0.05] text-muted-foreground hover:text-foreground transition-colors"
              title="Close BOM drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Totals card */}
      <div className="px-5 pt-3 pb-3 border-b border-white/[0.05] shrink-0">
        <div className="rounded-lg p-3 bg-secondary/30 border border-border/60">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Proposed material</span>
              <span className="text-[14px] font-medium tabular-nums">{fmt(totals.proposedMaterial)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Cable</span>
              <span className="text-[14px] font-medium tabular-nums">{fmt(totals.cable)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Labor</span>
              <span className="text-[14px] font-medium tabular-nums">{totals.laborHours.toFixed(1)} hr · {fmt(totals.laborTotal)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Existing documented</span>
              <span className="text-[13px] tabular-nums text-muted-foreground line-through decoration-1">{fmt(totals.existingDocumented)}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/40 flex items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Sell total · {(totals.markup * 100).toFixed(0)}% markup</span>
              <span className="text-[18px] font-medium tabular-nums text-foreground">{fmt(totals.sellTotal)}</span>
            </div>
            <div className="text-[10px] text-right" style={{ color: hasOverrides ? '#22D3EE' : undefined }}>
              {hasOverrides
                ? <><span className="font-medium">Project pricebook overrides active</span><br /><span className="text-muted-foreground">{overrideCount} override{overrideCount === 1 ? '' : 's'} · not connected to ERP yet.</span></>
                : <span className="text-muted-foreground"><span className="font-medium text-foreground">Preview pricing.</span><br />Open pricebook to calibrate.</span>
              }
            </div>
          </div>
          {totals.missingPriceCount > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40 flex items-start gap-2 text-[10px] text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                {totals.missingPriceCount} line{totals.missingPriceCount === 1 ? '' : 's'} missing price.
                Catalog or UNIT_PRICE has no entry for the source product — totals undercount until set.
              </span>
            </div>
          )}
          {overriddenRowCount > 0 && (
            <div className="mt-2 text-[10px] text-muted-foreground">
              <span className="text-primary font-medium">{overriddenRowCount} row{overriddenRowCount === 1 ? '' : 's'}</span> using pricebook override{overriddenRowCount === 1 ? '' : 's'}.
            </div>
          )}
        </div>
      </div>

      {pricebookOpen && (
        <PricebookEditor projectId={projectId} onClose={() => setPricebookOpen(false)} />
      )}

      {/* Filter pills */}
      <div className="px-5 pt-3 pb-3 border-b border-white/[0.05] shrink-0 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            // Quick count per filter so the pill feels alive.
            const count = f.id === 'all' ? rows.length
              : f.id === 'existing' ? rows.filter((r) => r.isExisting).length
              : rows.filter((r) => r.category === f.id).length;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                disabled={count === 0 && f.id !== 'all'}
                className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] tracking-tight transition-colors ${
                  active ? 'bg-primary/15 text-primary border border-primary/40'
                         : 'bg-secondary/30 text-muted-foreground border border-border hover:bg-secondary/60'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
                data-track={`bom-filter-${f.id}`}
              >
                {f.label}<span className="text-[10px] opacity-70 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
        {/* Canvas V2 Pass 2A.8 — floor scope. Only shows when the
            project actually has more than one floor; single floor
            projects hide this row entirely so the chrome stays calm. */}
        {projectFloors.length > 1 && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Floor</span>
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="bg-secondary/30 text-foreground border border-border rounded-full h-7 px-2.5 text-[11px] focus:outline-none focus:border-primary/40"
              data-track="bom-floor-filter"
            >
              <option value="all">All floors ({rows.length})</option>
              {projectFloors.map((f) => {
                const c = rows.filter((r) => floorIdForRow(r) === f.id).length;
                return <option key={f.id} value={f.id}>{f.name} ({c})</option>;
              })}
            </select>
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-6 space-y-4">
        {filtered.length === 0 && (
          <div className="text-center text-[11px] text-muted-foreground py-8 px-4">
            {rows.length === 0
              ? 'No devices, doors, or pathways on the canvas yet. Drop hardware from the bottom bar or draw a cable run to populate the BOM.'
              : 'No rows match this filter.'}
          </div>
        )}
        {CATEGORY_ORDER.map((cat) => {
          const group = grouped.get(cat);
          if (!group || group.length === 0) return null;
          const groupTotal = group.reduce((s, r) => s + (r.isExisting ? 0 : r.unitPrice * r.qty), 0);
          const groupExisting = group.reduce((s, r) => s + (r.isExisting ? r.unitPrice * r.qty : 0), 0);
          return (
            <div key={cat}>
              <div className="px-2 pb-1.5 flex items-end justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{CATEGORY_LABEL[cat]}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">· {group.length}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] tabular-nums">
                  {groupExisting > 0 && (
                    <span className="text-muted-foreground line-through decoration-1">{fmt(groupExisting)}</span>
                  )}
                  <span className="text-foreground">{fmt(groupTotal)}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                {group.map((r) => (
                  <BomRow
                    key={r.id}
                    row={r}
                    fmt={fmt}
                    floorName={projectFloors.length > 1 ? floorNameForRow(r) : undefined}
                    roomName={roomNameForRow(r) ?? undefined}
                    onSelect={() => {
                      if (r.sourceKind === 'pathway' && r.sourceId)            onSelectPathway(r.sourceId);
                      else if ((r.sourceKind === 'device' || r.sourceKind === 'door') && r.sourceId) onSelectDevice(r.sourceId);
                      else toast.message(`Source: ${r.meta ?? r.sourceId ?? '(none)'}`, { duration: 2200 });
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BomRow({ row, fmt, onSelect, floorName, roomName }: { row: CanvasBomRow; fmt: (n: number) => string; onSelect: () => void; floorName?: string; roomName?: string }) {
  const lineTotal = row.unitPrice * row.qty;
  const canSelect = !!row.sourceId && (row.sourceKind === 'device' || row.sourceKind === 'door' || row.sourceKind === 'pathway');
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!canSelect}
      className={`w-full text-left rounded-md p-2.5 border transition-colors ${
        row.isExisting ? 'border-border/40 bg-secondary/10 opacity-75 hover:opacity-100' : 'border-border/60 bg-secondary/20 hover:bg-secondary/40'
      } ${canSelect ? 'cursor-pointer' : 'cursor-default'}`}
      title={canSelect ? 'Highlight this source on the canvas' : undefined}
      data-track={`bom-row-${row.sourceKind}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {row.meta && <span className="text-[10px] text-muted-foreground tracking-tight truncate">{row.meta}</span>}
            {row.isExisting && (
              <span className="text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 border border-amber-400/30">Existing</span>
            )}
            {!row.isExisting && row.sourceKind === 'door' && (
              <span className="text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-400 border border-emerald-400/30">Proposed</span>
            )}
            {row.missingPrice && (
              <span className="text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20" title="No catalog price on file">No price</span>
            )}
            {row.overridden && !row.missingPrice && (
              <span className="text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/40" title="Project pricebook override applied">Overridden</span>
            )}
            {floorName && floorName !== '—' && (
              <span
                className="text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-secondary/40 text-muted-foreground border border-border"
                title="Floor this line lives on"
              >
                {floorName}
              </span>
            )}
            {roomName && (
              <span
                className="text-[9.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30"
                title="Room this line lives in"
              >
                {roomName}
              </span>
            )}
          </div>
          <div className="text-[12px] font-medium text-foreground truncate">{row.description}</div>
          {row.product && (
            <div className="text-[10px] text-muted-foreground truncate">{row.product}</div>
          )}
          {row.laborHours > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{row.laborHours.toFixed(2)} hr labor</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-[12px] tabular-nums ${row.isExisting ? 'text-muted-foreground line-through decoration-1' : 'text-foreground'}`}>
            {row.qty.toLocaleString(undefined, { maximumFractionDigits: row.uom === 'ft' ? 0 : 0 })} {row.uom}
          </div>
          <div className={`text-[10px] tabular-nums ${row.isExisting ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
            @ {fmt(row.unitPrice)}
          </div>
          <div className={`text-[12px] font-medium tabular-nums mt-0.5 ${row.isExisting ? 'text-muted-foreground line-through decoration-1' : 'text-foreground'}`}>
            {fmt(lineTotal)}
          </div>
        </div>
      </div>
    </button>
  );
}
