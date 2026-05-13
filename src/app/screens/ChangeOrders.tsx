import { useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Plus, Minus, Check, X, ArrowRight, Edit2 } from 'lucide-react';

interface Delta { kind: 'added' | 'removed' | 'changed'; item: string; detail?: string; deltaUSD: number; }
interface CO { id: string; number: string; title: string; reason: string; status: 'pending' | 'approved' | 'rejected'; submittedBy: string; submitted: string; deltas: Delta[]; }

const CHANGE_ORDERS: CO[] = [
  {
    id: 'co-001', number: 'CO-001', title: 'Add PTZ cameras at exterior',
    reason: 'Owner requested perimeter PTZ coverage after Q1 security review',
    status: 'pending', submittedBy: 'Casey P.', submitted: '2026-05-10',
    deltas: [
      { kind: 'added', item: 'Axis Q6315-LE PTZ × 2', detail: 'NE & NW corners', deltaUSD: 7790 },
      { kind: 'added', item: 'Cat6A run × 2', detail: '180 ft each', deltaUSD: 1240 },
      { kind: 'added', item: 'Install labor (12h)', deltaUSD: 1380 },
    ],
  },
  {
    id: 'co-002', number: 'CO-002', title: 'Swap to fail-safe locks on egress',
    reason: 'Fire marshal review — egress doors must release on alarm',
    status: 'approved', submittedBy: 'Mei L.', submitted: '2026-05-08',
    deltas: [
      { kind: 'removed', item: 'Securitron M62 maglock × 4', deltaUSD: -980 },
      { kind: 'added',   item: 'Von Duprin 6210 electric strike × 4', deltaUSD: 1540 },
      { kind: 'changed', item: 'Door hardware program', detail: 'Fail-safe mode', deltaUSD: 0 },
    ],
  },
  {
    id: 'co-003', number: 'CO-003', title: 'Reduce reader count in Suite 300',
    reason: 'Owner reduced scope — Suite 300 will be unbuilt shell',
    status: 'rejected', submittedBy: 'Diego R.', submitted: '2026-05-05',
    deltas: [
      { kind: 'removed', item: 'HID Signo 20 × 4', deltaUSD: -1540 },
      { kind: 'removed', item: 'Mercury MR62e × 1', deltaUSD: -695 },
      { kind: 'removed', item: 'Programming hours (-8h)', deltaUSD: -1160 },
    ],
  },
];

export function ChangeOrders() {
  const { projectId = 'p1' } = useParams();
  const [orders, setOrders] = useState(CHANGE_ORDERS);
  const [selId, setSelId] = useState(orders[0].id);
  const sel = orders.find((o) => o.id === selId)!;

  const decide = (s: CO['status']) => setOrders((os) => os.map((o) => o.id === selId ? { ...o, status: s } : o));

  const totalDelta = sel.deltas.reduce((a, d) => a + d.deltaUSD, 0);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Change orders' }]}
      title="Change orders"
      subtitle="Scope deltas against the baseline design"
      actions={<Button size="sm" variant="outline"><Plus className="w-3.5 h-3.5 mr-1" />New CO</Button>}
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-[300px_1fr] gap-4">
        <div className="bg-card border border-border rounded-lg p-2 space-y-1">
          {orders.map((o) => {
            const delta = o.deltas.reduce((a, d) => a + d.deltaUSD, 0);
            return (
              <button key={o.id} onClick={() => setSelId(o.id)} className={`w-full text-left p-3 rounded transition-colors ${selId === o.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium">{o.number}</div>
                  <StatusPill s={o.status} />
                </div>
                <div className="text-sm mt-1">{o.title}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{o.submittedBy} · {o.submitted}</div>
                <div className={`text-xs mt-1 ${delta > 0 ? 'text-amber-400' : delta < 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>{delta > 0 ? '+' : ''}{currency(delta)}</div>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{sel.number}</div>
                <h2 className="text-lg font-medium">{sel.title}</h2>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">{sel.reason}</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Net change</div>
                <div className={`text-xl font-medium ${totalDelta > 0 ? 'text-amber-400' : totalDelta < 0 ? 'text-emerald-400' : ''}`}>
                  {totalDelta > 0 ? '+' : ''}{currency(totalDelta)}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
              <StatusPill s={sel.status} />
              {sel.status === 'pending' && (
                <>
                  <Button size="sm" onClick={() => decide('approved')}><Check className="w-3.5 h-3.5 mr-1" />Approve</Button>
                  <Button size="sm" variant="ghost" onClick={() => decide('rejected')}><X className="w-3.5 h-3.5 mr-1" />Reject</Button>
                </>
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-sm font-medium">Deltas</div>
            <table className="w-full text-sm">
              <tbody>
                {sel.deltas.map((d, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="w-8 px-3 py-2.5">
                      {d.kind === 'added'   && <Plus className="w-4 h-4 text-emerald-400" />}
                      {d.kind === 'removed' && <Minus className="w-4 h-4 text-red-400" />}
                      {d.kind === 'changed' && <Edit2 className="w-4 h-4 text-amber-400" />}
                    </td>
                    <td className="px-3 py-2.5">
                      <div>{d.item}</div>
                      {d.detail && <div className="text-xs text-muted-foreground">{d.detail}</div>}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-medium ${d.deltaUSD > 0 ? 'text-amber-400' : d.deltaUSD < 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {d.deltaUSD > 0 ? '+' : ''}{currency(d.deltaUSD)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatusPill({ s }: { s: CO['status'] }) {
  const tone = s === 'approved' ? 'text-emerald-400 bg-emerald-400/10' : s === 'rejected' ? 'text-red-400 bg-red-400/10' : 'text-amber-400 bg-amber-400/10';
  return <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${tone}`}>{s}</span>;
}

function currency(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); }
