import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Send, Download, Sparkles } from 'lucide-react';

interface Line { id: string; section: string; item: string; qty: number; unit: number; cost: number; }

const INITIAL: Line[] = [
  { id: 'l1', section: 'Video', item: 'Axis P1468-LE 4MP IR bullet', qty: 18, unit: 845, cost: 612 },
  { id: 'l2', section: 'Video', item: 'Axis P3827-PVE multisensor', qty: 6, unit: 4150, cost: 3220 },
  { id: 'l3', section: 'Video', item: 'Axis Q6315-LE PTZ', qty: 4, unit: 3895, cost: 3010 },
  { id: 'l4', section: 'Access', item: 'Mercury MR62e controller', qty: 6, unit: 695, cost: 510 },
  { id: 'l5', section: 'Access', item: 'HID Signo 20 mullion reader', qty: 18, unit: 385, cost: 268 },
  { id: 'l6', section: 'Access', item: 'Securitron M62 maglock', qty: 12, unit: 245, cost: 168 },
  { id: 'l7', section: 'Network', item: 'Cisco C9300-48P switch', qty: 1, unit: 7800, cost: 5950 },
  { id: 'l8', section: 'Network', item: 'Cisco C9300-24P switch', qty: 2, unit: 5400, cost: 4100 },
  { id: 'l9', section: 'Cabling', item: 'Cat6A plenum (1000ft box)', qty: 4, unit: 380, cost: 245 },
  { id: 'l10', section: 'Cabling', item: 'OM4 fiber (per ft, installed)', qty: 620, unit: 4.85, cost: 2.40 },
  { id: 'l11', section: 'Software', item: 'Genetec Security Center · 5yr', qty: 1, unit: 24500, cost: 18200 },
  { id: 'l12', section: 'Labor', item: 'Install labor (hours)', qty: 280, unit: 115, cost: 78 },
  { id: 'l13', section: 'Labor', item: 'Programming & commissioning', qty: 60, unit: 145, cost: 95 },
];

export function ProposalBuilder() {
  const { projectId = 'p1' } = useParams();
  const [lines, setLines] = useState(INITIAL);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(8.25);
  const [scope, setScope] = useState('Design, supply, install, program, and commission a comprehensive electronic security system covering video surveillance, access control, and intrusion detection.');
  const [terms, setTerms] = useState('Net 30 · 30% deposit at award · 50% mid-install · 20% at completion. 1-year warranty.');

  const subtotal = useMemo(() => lines.reduce((a, l) => a + l.qty * l.unit, 0), [lines]);
  const totalCost = useMemo(() => lines.reduce((a, l) => a + l.qty * l.cost, 0), [lines]);
  const discountAmt = subtotal * (discount / 100);
  const taxableBase = subtotal - discountAmt;
  const tax = taxableBase * (taxRate / 100);
  const total = taxableBase + tax;
  const profit = taxableBase - totalCost;
  const margin = taxableBase > 0 ? (profit / taxableBase) * 100 : 0;

  const sections = useMemo(() => {
    const m = new Map<string, Line[]>();
    lines.forEach((l) => { if (!m.has(l.section)) m.set(l.section, []); m.get(l.section)!.push(l); });
    return Array.from(m.entries());
  }, [lines]);
  const sectionTotal = (sec: Line[]) => sec.reduce((a, l) => a + l.qty * l.unit, 0);
  const update = (id: string, key: 'qty' | 'unit', v: number) => setLines((ls) => ls.map((l) => l.id === id ? { ...l, [key]: v } : l));

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Estimate', to: `/estimate/${projectId}` }, { label: 'Proposal' }]}
      title="Proposal builder"
      subtitle="Customer-facing quote derived from BOM"
      actions={
        <>
          <Button size="sm" variant="ghost"><Sparkles className="w-3.5 h-3.5 mr-1" />Cover letter</Button>
          <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" />PDF</Button>
          <Button size="sm"><Send className="w-3.5 h-3.5 mr-1" />Send</Button>
        </>
      }
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-[1fr_300px] gap-4">
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <label className="text-xs text-muted-foreground">Scope of work</label>
            <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={3} className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm resize-none" />
          </div>
          {sections.map(([sec, items]) => (
            <div key={sec} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">{sec}</h3>
                <span className="text-xs text-muted-foreground">{currency(sectionTotal(items))}</span>
              </div>
              <div className="overflow-hidden rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Item</th>
                      <th className="px-3 py-1.5 text-right font-medium w-20">Qty</th>
                      <th className="px-3 py-1.5 text-right font-medium w-24">Unit</th>
                      <th className="px-3 py-1.5 text-right font-medium w-24">Ext</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((l) => (
                      <tr key={l.id} className="border-t border-border">
                        <td className="px-3 py-1.5">{l.item}</td>
                        <td className="px-3 py-1.5 text-right"><input type="number" value={l.qty} onChange={(e) => update(l.id, 'qty', Number(e.target.value))} className="w-16 bg-input-background border border-input-border rounded px-1.5 py-0.5 text-right" /></td>
                        <td className="px-3 py-1.5 text-right"><input type="number" value={l.unit} onChange={(e) => update(l.id, 'unit', Number(e.target.value))} className="w-20 bg-input-background border border-input-border rounded px-1.5 py-0.5 text-right" /></td>
                        <td className="px-3 py-1.5 text-right font-medium">{currency(l.qty * l.unit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="bg-card border border-border rounded-lg p-4">
            <label className="text-xs text-muted-foreground">Payment terms & warranty</label>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm resize-none" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-lg p-4 space-y-2 text-sm">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pricing</div>
            <Row label="Subtotal" value={currency(subtotal)} />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Discount %</span>
              <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-16 bg-input-background border border-input-border rounded px-1.5 py-0.5 text-right text-xs" />
            </div>
            <Row label="Discount" value={`−${currency(discountAmt)}`} muted />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tax %</span>
              <input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-16 bg-input-background border border-input-border rounded px-1.5 py-0.5 text-right text-xs" />
            </div>
            <Row label="Tax" value={currency(tax)} muted />
            <div className="pt-2 border-t border-border"><Row label="Total" value={currency(total)} bold /></div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4 space-y-2 text-sm">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Internal margin</div>
            <Row label="Cost" value={currency(totalCost)} muted />
            <Row label="Profit" value={currency(profit)} />
            <Row label="Margin" value={`${margin.toFixed(1)}%`} tone={margin < 20 ? 'text-red-400' : margin < 32 ? 'text-amber-400' : 'text-emerald-400'} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ label, value, muted, bold, tone }: { label: string; value: string; muted?: boolean; bold?: boolean; tone?: string }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'text-sm' : 'text-xs'}`}>
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className={`${bold ? 'font-medium' : ''} ${tone ?? ''}`}>{value}</span>
    </div>
  );
}

function currency(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }
