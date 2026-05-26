// ImpactPreviewSection — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Small material+labor preview pulled live from
// deriveBOM and the per-device labor catalog, rendered inside
// the device inspector's Overview tile so the engineer sees
// the cost ripple of the selected object before jumping to
// the full Estimator. Honest about its scope: it summarizes,
// it doesn't redo the BOM.
//
// For door-class devices the same DOOR_HARDWARE_PRICE helper
// that feeds deriveBOM also drives the per-component preview,
// so the numbers here always match the Estimator BOM lines
// for the same opening. Per-hardware Proposed / Existing
// state lives on the device record so each row carries its
// own tag and the subtotal splits into "Proposed (to
// install)" vs "Existing (already there)".

import { useMemo } from 'react';
import { SAMPLE_PRODUCTS as CATALOG } from '../../lib/productCatalog';
import { deriveBOM, deriveDoorAssemblyLines, useProjectStore } from '../../store/projectStore';
import type { DoorHardware } from '../../store/types';
import { DrawerSection } from '../components/DrawerPrimitives';
import { TYPE_KIND } from '../constants';
import type { Device } from '../types';

export function ImpactPreviewSection({ device }: { device: Device }) {
  const projectId = device.projectId;
  // Subscribe to only the slices that affect the BOM so deriveBOM stays
  // accurate without forcing a full-state re-render snapshot.
  const devices = useProjectStore((s) => s.devices);
  const doors = useProjectStore((s) => s.doors);
  const pathways = useProjectStore((s) => s.pathways);
  const idfs = useProjectStore((s) => s.idfs);
  const floors = useProjectStore((s) => s.floors);
  const estimates = useProjectStore((s) => s.estimates);
  const projects = useProjectStore((s) => s.projects);
  const bom = useMemo(
    () => deriveBOM({ devices, doors, pathways, idfs, floors, estimates, projects } as any, projectId),
    [devices, doors, pathways, idfs, floors, estimates, projects, projectId],
  );
  const isDoorish =
    device.type.startsWith('inf.door')
    || device.type.startsWith('inf.gate')
    || device.type.startsWith('inf.storefront')
    || device.type.startsWith('inf.doubledoor');
  const isCam = TYPE_KIND[device.type] === 'camera';
  // Match BOM lines to THIS specific device only — never aggregate by
  // SKU. The previous `l.sku === device.product` fallback pulled in
  // every other device sharing the same catalog product, so selecting
  // one camera showed the cost of N identical cameras. For cameras
  // whose BOM lines roll up by catalog SKU (no per-id source line),
  // we present the unit cost from the catalog instead — the matched
  // list stays one-line-per-device.
  const matched = bom.lines.filter((l) => l.sourceId === device.id);
  const poeW = isCam ? Math.round((device as any).poeW ?? 9.8) : null;
  // Cameras (and any device class where deriveBOM aggregates by SKU) do
  // not produce a per-id BOM line. Fall back to a single-unit catalog
  // lookup so the inspector still shows THIS object's own material +
  // labor — never multiplied by the project-wide count of the same SKU.
  const catalogFallback = matched.length === 0 && device.product
    ? (() => {
        const p = CATALOG.find((c) => c.id === device.product);
        if (!p) return null;
        // Audit Group A.4 — never emit the literal string "undefined" when
        // a catalog entry is missing manufacturer/model. Build the label
        // from whichever pieces are real and skip the rest.
        const parts = [p.mfr, p.model].filter((s): s is string => typeof s === 'string' && s.length > 0);
        const label = parts.length > 0 ? parts.join(' ') : (device.label || device.id);
        return {
          label,
          qty: '1 ea',
          ext: p.msrp ?? 0,
          hrs: p.laborUnits ?? 0,
        };
      })()
    : null;
  const labelLines = matched.length > 0
    ? matched.map((l) => ({
        label: l.description,
        qty: `${l.qty} ${l.uom ?? 'ea'}`,
        ext: l.qty * l.unitPrice,
        hrs: l.laborHours ?? 0,
      }))
    : (catalogFallback ? [catalogFallback] : []);
  const doorRollup = isDoorish ? deriveDoorAssemblyLines(device) : null;
  return (
    <>
      <DrawerSection title={`Impact preview · ${device.id}`}>
        <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1">
          This object only · not a project rollup
        </div>
        {labelLines.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic">
            {isDoorish
              ? 'No door hardware selected yet. Open the Assembly tab and toggle reader / strike / REX / etc. to populate this opening.'
              : "No catalog product assigned yet. Pick one on the Overview tile to see this object's material + labor."}
          </div>
        ) : (
          <div className="space-y-1 text-[11px]">
            {labelLines.map((l, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 py-1 border-b border-border/40 last:border-b-0">
                <div className="flex-1 min-w-0 truncate text-foreground">{l.label}</div>
                <div className="tabular-nums text-muted-foreground">{l.qty}</div>
                <div className="tabular-nums text-foreground">${Math.round(l.ext).toLocaleString()}</div>
              </div>
            ))}
            <div className="flex items-baseline justify-between text-[10px] text-muted-foreground pt-1">
              <span>Labor</span>
              <span className="tabular-nums">{labelLines.reduce((s, l) => s + (l.hrs || 0), 0).toFixed(1)} hr</span>
            </div>
            {poeW !== null && (
              <div className="flex items-baseline justify-between text-[10px] text-muted-foreground">
                <span>PoE draw</span>
                <span className="tabular-nums">~{poeW} W</span>
              </div>
            )}
          </div>
        )}
        <div className="mt-2 text-[10px] text-muted-foreground/85">
          Reflects default labor + materials plus any project pricebook overrides. Confirm against your pricebook before sending an estimate.
        </div>
      </DrawerSection>

      {doorRollup && doorRollup.lines.length > 0 && (() => {
        // Per-hardware Proposed/Existing state lives on the device record;
        // we re-read it here so each row can carry its own tag and we can
        // split the subtotal into "Proposed (to install)" vs "Existing
        // (already there)". Defaults to 'proposed' for any hw class that
        // doesn't have an explicit state — same contract as the drag and
        // inspector-toggle flows.
        const stateMap = ((device as any).doorAssemblyState ?? {}) as Partial<Record<DoorHardware, 'proposed' | 'existing'>>;
        const proposedLines = doorRollup.lines.filter((l) => (stateMap[l.hw] ?? 'proposed') === 'proposed');
        const existingLines = doorRollup.lines.filter((l) => (stateMap[l.hw] ?? 'proposed') === 'existing');
        const proposedHardware = proposedLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
        const existingHardware = existingLines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
        const proposedLabor = proposedLines.reduce((s, l) => s + l.laborHours, 0);
        return (
          <DrawerSection title={`Door assembly impact · ${doorRollup.lines.length}`}>
            <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1">
              This door only · {proposedLines.length} proposed · {existingLines.length} existing
            </div>
            <div className="text-[10px] text-muted-foreground/85 mb-2">
              Per-component preview from the active door assembly. Proposed rows roll into the Estimator;
              Existing rows are kept as documentation only (zeroed in totals).
            </div>
            <div className="space-y-1 text-[11px]">
              {doorRollup.lines.map((l) => {
                const state = stateMap[l.hw] ?? 'proposed';
                const isExisting = state === 'existing';
                return (
                  <div key={l.hw} className="flex items-baseline justify-between gap-2 py-1 border-b border-border/40 last:border-b-0" data-testid={`impact-door-${l.hw}`}>
                    <div className="flex-1 min-w-0 truncate">
                      <span className={isExisting ? 'text-muted-foreground' : 'text-foreground'}>{l.description}</span>
                      <span className="text-[9.5px] uppercase tracking-[0.10em] text-muted-foreground ml-2">{l.hw}</span>
                      <span
                        className="ml-1.5 text-[9px] uppercase tracking-[0.10em] px-1 py-px rounded border"
                        data-testid={`impact-door-${l.hw}-state`}
                        style={{
                          color: isExisting ? '#7CC2FF' : '#4FB87E',
                          borderColor: isExisting ? 'rgba(124,194,255,0.40)' : 'rgba(79,184,126,0.40)',
                          background: isExisting ? 'rgba(124,194,255,0.10)' : 'rgba(79,184,126,0.10)',
                        }}
                      >{state}</span>
                    </div>
                    <div className="tabular-nums text-muted-foreground">{l.laborHours.toFixed(2)} hr</div>
                    <div className={`tabular-nums ${isExisting ? 'text-muted-foreground line-through' : 'text-foreground'}`}>${l.unitPrice.toLocaleString()}</div>
                  </div>
                );
              })}
              <div className="flex items-baseline justify-between pt-1.5 text-[11px] font-medium" data-testid="impact-door-proposed-total">
                <span>Proposed hardware</span>
                <span className="tabular-nums">${proposedHardware.toLocaleString()}</span>
              </div>
              <div className="flex items-baseline justify-between text-[10px] text-muted-foreground" data-testid="impact-door-proposed-labor">
                <span>Proposed labor</span>
                <span className="tabular-nums">{proposedLabor.toFixed(2)} hr</span>
              </div>
              {existingLines.length > 0 && (
                <div className="flex items-baseline justify-between text-[10px] text-muted-foreground/80 pt-0.5" data-testid="impact-door-existing-total">
                  <span>Existing hardware (excluded from total)</span>
                  <span className="tabular-nums">${existingHardware.toLocaleString()}</span>
                </div>
              )}
            </div>
          </DrawerSection>
        );
      })()}
    </>
  );
}
