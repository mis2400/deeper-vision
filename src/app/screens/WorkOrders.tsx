import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Check, Clock, User, MapPin, Wrench } from 'lucide-react';

interface Task { id: string; label: string; device?: string; location: string; est: number; done: boolean; notes?: string; }
interface WorkOrder { id: string; number: string; title: string; tech: string; date: string; status: 'queued' | 'in-progress' | 'done'; tasks: Task[]; }

const ORDERS: WorkOrder[] = [
  {
    id: 'wo-001', number: 'WO-001', title: 'Floor 1 Camera Rough-In', tech: 'Diego R.', date: '2026-05-20', status: 'in-progress',
    tasks: [
      { id: 't1', label: 'Mount CAM-101 backbox', device: 'CAM-101', location: 'Lobby north corner', est: 35, done: true },
      { id: 't2', label: 'Pull Cat6A to CAM-101', device: 'CAM-101', location: 'Lobby → IDF-A', est: 50, done: true },
      { id: 't3', label: 'Mount CAM-102 backbox', device: 'CAM-102', location: 'Lobby center ceiling', est: 45, done: false, notes: 'Coordinate with HVAC' },
      { id: 't4', label: 'Pull Cat6A to CAM-102', device: 'CAM-102', location: 'Lobby → IDF-A', est: 55, done: false },
      { id: 't5', label: 'Mount CAM-103 PTZ', device: 'CAM-103', location: 'Atrium SE', est: 90, done: false },
      { id: 't6', label: 'Terminate & test', device: 'all', location: 'IDF-A', est: 60, done: false },
    ],
  },
  {
    id: 'wo-002', number: 'WO-002', title: 'Door Hardware — Suite 200', tech: 'Mei L.', date: '2026-05-21', status: 'queued',
    tasks: [
      { id: 't1', label: 'Install Mercury MR62e in IDF-B', location: 'IDF-B closet', est: 40, done: false },
      { id: 't2', label: 'Mount HID Signo readers (qty 4)', location: 'Suite 200 doors', est: 80, done: false },
      { id: 't3', label: 'Install maglocks on glass doors', location: 'Suite 200 main', est: 120, done: false, notes: 'Confirm fire alarm release wired' },
      { id: 't4', label: 'Install REX + DPS', location: 'all 4 doors', est: 60, done: false },
      { id: 't5', label: 'Pull cables to IDF-B', location: 'Suite 200 → IDF-B', est: 90, done: false },
      { id: 't6', label: 'Program & test sequences', location: 'IDF-B', est: 75, done: false },
    ],
  },
  {
    id: 'wo-003', number: 'WO-003', title: 'IDF-A Switch Cutover', tech: 'Jordan K.', date: '2026-05-19', status: 'done',
    tasks: [
      { id: 't1', label: 'Mount Cisco C9300-48P', location: 'IDF-A rack', est: 30, done: true },
      { id: 't2', label: 'Connect fiber uplink', location: 'IDF-A → MDF', est: 25, done: true },
      { id: 't3', label: 'Apply base config', location: 'console', est: 45, done: true },
      { id: 't4', label: 'Verify uplink + PoE', location: 'console', est: 20, done: true },
    ],
  },
];

export function WorkOrders() {
  const { projectId = 'p1' } = useParams();
  const [orders, setOrders] = useState(ORDERS);
  const [selId, setSelId] = useState(orders[0].id);
  const sel = orders.find((o) => o.id === selId)!;

  const toggle = (taskId: string) => setOrders((os) => os.map((o) => o.id !== selId ? o : { ...o, tasks: o.tasks.map((t) => t.id === taskId ? { ...t, done: !t.done } : t) }));
  const done = useMemo(() => sel.tasks.filter((t) => t.done).length, [sel.tasks]);
  const pct = (done / sel.tasks.length) * 100;
  const totalMin = sel.tasks.reduce((a, t) => a + t.est, 0);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Canvas', to: `/project/${projectId}/canvas` }, { label: 'Work orders' }]}
      title="Install work orders"
      actions={<Button size="sm" variant="outline"><Wrench className="w-3.5 h-3.5 mr-1" />Generate from BOM</Button>}
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-[300px_1fr] gap-4">
        <div className="bg-card border border-border rounded-lg p-2 space-y-1">
          {orders.map((o) => {
            const d = o.tasks.filter((t) => t.done).length;
            const p = (d / o.tasks.length) * 100;
            return (
              <button key={o.id} onClick={() => setSelId(o.id)} className={`w-full text-left p-3 rounded transition-colors ${selId === o.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium">{o.number}</div>
                  <StatusPill status={o.status} />
                </div>
                <div className="text-sm mt-1">{o.title}</div>
                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                  <User className="w-3 h-3" />{o.tech} · <Clock className="w-3 h-3" />{o.date}
                </div>
                <div className="mt-2 h-1 bg-secondary/40 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${p}%` }} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{sel.number}</div>
                <h2 className="text-lg font-medium">{sel.title}</h2>
                <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                  <User className="w-3 h-3" />{sel.tech} · <Clock className="w-3 h-3" />{sel.date} · ~{Math.round(totalMin / 60)}h
                </div>
              </div>
              <StatusPill status={sel.status} />
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Progress</span><span>{done}/{sel.tasks.length} · {Math.round(pct)}%</span></div>
              <div className="mt-1 h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} /></div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-3 space-y-1.5">
            {sel.tasks.map((t) => (
              <div key={t.id} className={`p-3 rounded border transition-colors ${t.done ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-border bg-background'}`}>
                <div className="flex items-start gap-3">
                  <button onClick={() => toggle(t.id)} className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center ${t.done ? 'bg-emerald-400/20 border-emerald-400/60' : 'border-border hover:border-primary'}`}>
                    {t.done && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${t.done ? 'line-through text-muted-foreground' : ''}`}>{t.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      {t.device && <span className="text-primary">{t.device}</span>}
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{t.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t.est}m</span>
                    </div>
                    {t.notes && <div className="text-[10px] text-amber-400 mt-1">Note: {t.notes}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatusPill({ status }: { status: WorkOrder['status'] }) {
  const tone = status === 'done' ? 'text-emerald-400 bg-emerald-400/10' : status === 'in-progress' ? 'text-amber-400 bg-amber-400/10' : 'text-muted-foreground bg-secondary';
  return <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${tone}`}>{status}</span>;
}
