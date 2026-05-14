// Estimator — derived live from the shared project store. Every line on this
// page comes from the canvas (devices, doors, pathways, IDFs) via deriveBOM.
// There is no longer a hardcoded SECTIONS array; if you add a camera on the
// canvas, this BOM grows by one line on next view.

import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { FileDown, ChevronRight } from 'lucide-react';
import { useProjectStore, deriveBOM, selectors as sel } from '../store/projectStore';
import type { EstimateLine } from '../store/types';
import { PhaseGateBanner } from '../lifecycle/PhaseGate';

/** Group every BOM line under a presentable section heading. */
const SECTION_FOR: Record<EstimateLine['sourceKind'], string> = {
  device:  'Hardware',
  door:    'Access control · doors',
  pathway: 'Cable & pathways',
  idf:     'Network · racks',
  labor:   'Labor',
  manual:  'Other',
};

export function EstimatorView() {
  const { projectId = 'p1' } = useParams();

  // Subscribe to the slices that affect BOM so the page re-renders when the
  // canvas changes a device. (We can't memoize on the raw maps; their object
  // identity changes per action.)
  const state = useProjectStore();

  const bom = useMemo(() => deriveBOM(state, projectId), [state, projectId]);
  const projectName = state.projects[projectId]?.name ?? 'Project';

  // Bucket lines by section for the existing layout.
  const sections = useMemo(() => {
    const groups = new Map<string, EstimateLine[]>();
    for (const l of bom.lines) {
      const key = SECTION_FOR[l.sourceKind] ?? 'Other';
      const arr = groups.get(key) ?? [];
      arr.push(l);
      groups.set(key, arr);
    }
    // Synthetic labor section — one line per source kind that contributed hours.
    const laborLines: EstimateLine[] = [];
    if (bom.laborHours > 0) {
      laborLines.push({
        id: 'labor-aggregate',
        sourceKind: 'labor',
        description: 'Field install + commissioning labor',
        qty: Math.round(bom.laborHours * 10) / 10,
        uom: 'hr',
        unitPrice: state.estimates[`est-${projectId}`]?.laborRate ?? 95,
      });
    }
    if (laborLines.length) groups.set('Labor', laborLines);
    return Array.from(groups, ([title, lines]) => ({ id: title, title, lines }));
  }, [bom, state.estimates, projectId]);

  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Headline totals
  const markup = state.estimates[`est-${projectId}`]?.markup ?? 0.18;
  const subtotal = bom.hardwareTotal + bom.cableTotal + bom.laborTotal;
  const margin = subtotal * markup;
  const total = subtotal + margin;

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: projectName, to: `/project/${projectId}/canvas` }, { label: 'Estimator' }]}
      title="Estimator"
      subtitle={`Live BOM derived from the engineering canvas · ${bom.lines.length} line items`}
      actions={<Button size="sm" variant="outline"><FileDown className="w-3.5 h-3.5 mr-1" />Export CSV</Button>}
    >
      {/* Soft gate — surfaces when the user lands here before engineering
          has anything to roll up. Doesn't block; just orients them. */}
      {bom.lines.length === 0 && (
        <PhaseGateBanner
          reason="Estimate is available, but no devices have been engineered yet. The BOM will populate as you place hardware on the canvas."
          action={{ label: 'Open canvas', href: `/project/${projectId}/canvas` }}
        />
      )}
      <div className="max-w-[1200px] mx-auto px-6 py-6 grid grid-cols-[1fr_300px] gap-4">
        <div className="space-y-3">
          {sections.length === 0 && (
            <div className="text-center py-16 text-sm text-muted-foreground bg-card border border-border rounded-lg">
              No devices placed on this project's canvas yet. <br />
              <span className="text-xs">Go to the canvas, place some cameras, doors, or pathways — they'll roll up here automatically.</span>
            </div>
          )}
          {sections.map((s) => {
            const sum = s.lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);
            const isOpen = open[s.id] ?? true; // default expanded
            return (
              <div key={s.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <button onClick={() => setOpen((p) => ({ ...p, [s.id]: !isOpen }))} className="w-full px-4 py-2.5 border-b border-border flex items-center justify-between hover:bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    <h3 className="text-sm font-medium">{s.title}</h3>
                    <span className="text-xs text-muted-foreground">· {s.lines.length} item{s.lines.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="text-sm font-medium">{currency(sum)}</div>
                </button>
                {isOpen && (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-1.5 font-medium">Item</th>
                        <th className="text-right px-4 py-1.5 font-medium">Qty</th>
                        <th className="text-right px-4 py-1.5 font-medium">Unit</th>
                        <th className="text-right px-4 py-1.5 font-medium">Extended</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.lines.map((l) => (
                        <tr key={l.id} className="border-t border-border">
                          <td className="px-4 py-2">
                            {l.description}
                            {l.sku && <span className="ml-2 text-[10px] text-muted-foreground font-mono">{l.sku}</span>}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">{l.qty} {l.uom ?? 'ea'}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">{currency(l.unitPrice)}</td>
                          <td className="px-4 py-2 text-right font-medium tabular-nums">{currency(l.qty * l.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-lg p-4 sticky top-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Totals</div>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Hardware</span><span className="tabular-nums">{currency(bom.hardwareTotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Cable & pathway</span><span className="tabular-nums">{currency(bom.cableTotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Labor ({bom.laborHours.toFixed(1)} hr)</span><span className="tabular-nums">{currency(bom.laborTotal)}</span></div>
              <div className="border-t border-border pt-2 mt-2 flex justify-between"><span>Subtotal</span><span className="tabular-nums">{currency(subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Margin ({(markup * 100).toFixed(0)}%)</span><span className="tabular-nums">{currency(margin)}</span></div>
              <div className="border-t border-border pt-2 mt-2 flex justify-between text-base">
                <span className="font-medium">Total</span>
                <span className="font-medium text-primary tabular-nums">{currency(total)}</span>
              </div>
            </div>
            <p className="mt-4 text-[10px] text-muted-foreground leading-snug">
              All lines are computed live from the project's canvas. Move or add
              a device and this estimate updates the moment you return.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function currency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
