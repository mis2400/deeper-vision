import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { FileDown, ChevronRight } from 'lucide-react';

interface Line { id: string; item: string; qty: number; unit: string; cost: number; }
interface Section { id: string; title: string; lines: Line[]; }

const SECTIONS: Section[] = [
  { id: 's1', title: 'Video', lines: [
    { id: 'l1', item: 'Axis P1468-LE bullet camera', qty: 22, unit: 'ea', cost: 850 },
    { id: 'l2', item: 'Axis Q6315-LE PTZ',          qty: 4,  unit: 'ea', cost: 3895 },
    { id: 'l3', item: 'Axis M3215-LVE dome',         qty: 2,  unit: 'ea', cost: 620 },
  ]},
  { id: 's2', title: 'Access control', lines: [
    { id: 'l4', item: 'HID Signo 20 reader',       qty: 16, unit: 'ea', cost: 385 },
    { id: 'l5', item: 'Mercury MR62e controller',  qty: 4,  unit: 'ea', cost: 695 },
    { id: 'l6', item: 'Securitron M62 maglock',    qty: 12, unit: 'ea', cost: 245 },
    { id: 'l7', item: 'Von Duprin 6210 strike',    qty: 4,  unit: 'ea', cost: 385 },
  ]},
  { id: 's3', title: 'Network', lines: [
    { id: 'l8', item: 'Cisco C9300-48P switch',    qty: 1,  unit: 'ea', cost: 6850 },
    { id: 'l9', item: 'Cisco C9300-24P switch',    qty: 2,  unit: 'ea', cost: 4200 },
    { id: 'l10',item: 'Cisco C9500-32C core',      qty: 1,  unit: 'ea', cost: 18400 },
  ]},
  { id: 's4', title: 'Cabling & misc', lines: [
    { id: 'l11', item: 'Cat6A plenum cable',       qty: 4200, unit: 'ft', cost: 0.85 },
    { id: 'l12', item: 'OM4 fiber pre-term',       qty: 3,    unit: 'ea', cost: 480 },
    { id: 'l13', item: 'Cable tray',                qty: 320,  unit: 'ft', cost: 14 },
  ]},
  { id: 's5', title: 'Labor', lines: [
    { id: 'l14', item: 'Install — technician',      qty: 320, unit: 'hr', cost: 115 },
    { id: 'l15', item: 'Programming — engineer',    qty: 80,  unit: 'hr', cost: 165 },
    { id: 'l16', item: 'Project management',        qty: 60,  unit: 'hr', cost: 145 },
  ]},
];

export function EstimatorView() {
  const { projectId = 'p1' } = useParams();
  const [open, setOpen] = useState<Record<string, boolean>>({ s1: true, s2: true, s3: true, s4: true, s5: true });

  const totals = useMemo(() => {
    const subtotals = SECTIONS.map((s) => ({ id: s.id, title: s.title, sum: s.lines.reduce((a, l) => a + l.qty * l.cost, 0) }));
    const subtotal = subtotals.reduce((a, s) => a + s.sum, 0);
    const overhead = subtotal * 0.12;
    const margin = subtotal * 0.18;
    return { subtotals, subtotal, overhead, margin, total: subtotal + overhead + margin };
  }, []);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Estimator' }]}
      title="Estimator"
      subtitle="Bottom-up cost roll-up across the BOM"
      actions={<Button size="sm" variant="outline"><FileDown className="w-3.5 h-3.5 mr-1" />Export CSV</Button>}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-6 grid grid-cols-[1fr_300px] gap-4">
        <div className="space-y-3">
          {SECTIONS.map((s) => {
            const sum = s.lines.reduce((a, l) => a + l.qty * l.cost, 0);
            const isOpen = open[s.id];
            return (
              <div key={s.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <button onClick={() => setOpen((p) => ({ ...p, [s.id]: !isOpen }))} className="w-full px-4 py-2.5 border-b border-border flex items-center justify-between hover:bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    <h3 className="text-sm font-medium">{s.title}</h3>
                    <span className="text-xs text-muted-foreground">· {s.lines.length} items</span>
                  </div>
                  <div className="text-sm font-medium">{currency(sum)}</div>
                </button>
                {isOpen && (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-1.5 font-medium">Item</th>
                        <th className="text-right px-4 py-1.5 font-medium">Qty</th>
                        <th className="text-right px-4 py-1.5 font-medium">Unit cost</th>
                        <th className="text-right px-4 py-1.5 font-medium">Extended</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.lines.map((l) => (
                        <tr key={l.id} className="border-t border-border">
                          <td className="px-4 py-2">{l.item}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{l.qty} {l.unit}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{currency(l.cost)}</td>
                          <td className="px-4 py-2 text-right font-medium">{currency(l.qty * l.cost)}</td>
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
              {totals.subtotals.map((s) => (
                <div key={s.id} className="flex justify-between text-muted-foreground"><span>{s.title}</span><span>{currency(s.sum)}</span></div>
              ))}
              <div className="border-t border-border pt-2 mt-2 flex justify-between"><span>Subtotal</span><span>{currency(totals.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Overhead (12%)</span><span>{currency(totals.overhead)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Margin (18%)</span><span>{currency(totals.margin)}</span></div>
              <div className="border-t border-border pt-2 mt-2 flex justify-between text-base">
                <span className="font-medium">Total</span>
                <span className="font-medium text-primary">{currency(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function currency(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }
