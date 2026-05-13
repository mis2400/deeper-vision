import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { RefreshCw, AlertTriangle, CheckCircle2, WifiOff } from 'lucide-react';

interface Dev { id: string; type: 'Camera' | 'Door' | 'Reader' | 'Switch'; name: string; ip: string; status: 'online' | 'degraded' | 'offline'; uptime: string; }

const DEVICES: Dev[] = [
  { id: 'CAM-101', type: 'Camera', name: 'Lobby NE',     ip: '10.20.4.11', status: 'online',   uptime: '42d' },
  { id: 'CAM-102', type: 'Camera', name: 'Lobby SW',     ip: '10.20.4.12', status: 'online',   uptime: '42d' },
  { id: 'CAM-103', type: 'Camera', name: 'Exterior N',   ip: '10.20.4.13', status: 'degraded', uptime: '12h' },
  { id: 'CAM-204', type: 'Camera', name: 'Corridor L2',  ip: '10.20.4.24', status: 'offline',  uptime: '—'   },
  { id: 'DR-1',    type: 'Door',   name: 'Main Entry',   ip: '10.20.6.11', status: 'online',   uptime: '42d' },
  { id: 'DR-2',    type: 'Door',   name: 'IT Room',      ip: '10.20.6.12', status: 'online',   uptime: '42d' },
  { id: 'RD-1',    type: 'Reader', name: 'Lobby in',     ip: '10.20.6.21', status: 'online',   uptime: '42d' },
  { id: 'SW-A',    type: 'Switch', name: 'IDF-A C9300',  ip: '10.20.0.11', status: 'online',   uptime: '88d' },
  { id: 'SW-B',    type: 'Switch', name: 'IDF-B C9300',  ip: '10.20.0.12', status: 'degraded', uptime: '3d'  },
];

export function LiveIntegration() {
  const { projectId = 'p1' } = useParams();
  const [filter, setFilter] = useState<'all' | Dev['status']>('all');

  const counts = useMemo(() => ({
    online:   DEVICES.filter((d) => d.status === 'online').length,
    degraded: DEVICES.filter((d) => d.status === 'degraded').length,
    offline:  DEVICES.filter((d) => d.status === 'offline').length,
  }), []);

  const filtered = useMemo(() => filter === 'all' ? DEVICES : DEVICES.filter((d) => d.status === filter), [filter]);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Operate' }, { label: 'Live integration' }]}
      title="Live integration"
      subtitle="Real-time status across all deployed devices"
      actions={<Button size="sm" variant="outline"><RefreshCw className="w-3.5 h-3.5 mr-1" />Refresh</Button>}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Online"   value={counts.online}   tone="text-emerald-400" total={DEVICES.length} active={filter === 'online'}   onClick={() => setFilter(filter === 'online'   ? 'all' : 'online')}   />
          <Stat label="Degraded" value={counts.degraded} tone="text-amber-400"   total={DEVICES.length} active={filter === 'degraded'} onClick={() => setFilter(filter === 'degraded' ? 'all' : 'degraded')} />
          <Stat label="Offline"  value={counts.offline}  tone="text-red-400"     total={DEVICES.length} active={filter === 'offline'}  onClick={() => setFilter(filter === 'offline'  ? 'all' : 'offline')}  />
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium">{filter === 'all' ? 'All devices' : `${filter[0].toUpperCase()}${filter.slice(1)} devices`}</h3>
            {filter !== 'all' && <button onClick={() => setFilter('all')} className="text-xs text-muted-foreground hover:text-foreground">Show all</button>}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">ID</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">IP</th>
                <th className="text-left px-4 py-2 font-medium">Uptime</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-t border-border hover:bg-secondary/20">
                  <td className="px-4 py-2.5 font-medium">{d.id}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.type}</td>
                  <td className="px-4 py-2.5">{d.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{d.ip}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{d.uptime}</td>
                  <td className="px-4 py-2.5"><StatusPill s={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone, total, active, onClick }: { label: string; value: number; tone: string; total: number; active: boolean; onClick: () => void }) {
  const pct = Math.round((value / total) * 100);
  return (
    <button onClick={onClick} className={`text-left bg-card border rounded-lg p-3 ${active ? 'border-primary' : 'border-border'}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-end gap-2 mt-1">
        <div className={`text-2xl font-medium ${tone}`}>{value}</div>
        <div className="text-xs text-muted-foreground mb-1">/ {total} · {pct}%</div>
      </div>
      <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${tone.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

function StatusPill({ s }: { s: Dev['status'] }) {
  const map = {
    online:   { tone: 'text-emerald-400 bg-emerald-400/10', icon: CheckCircle2 },
    degraded: { tone: 'text-amber-400 bg-amber-400/10',     icon: AlertTriangle },
    offline:  { tone: 'text-red-400 bg-red-400/10',         icon: WifiOff },
  }[s];
  const Icon = map.icon;
  return <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${map.tone}`}><Icon className="w-3 h-3" />{s}</span>;
}
