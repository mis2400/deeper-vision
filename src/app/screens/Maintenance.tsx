import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Calendar, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

interface Job { id: string; device: string; task: string; due: string; tech: string; status: 'overdue' | 'soon' | 'scheduled' | 'done'; }

const JOBS: Job[] = [
  { id: 'm1', device: 'CAM-101', task: 'Clean lens & inspect housing',  due: '2026-05-15', tech: 'Diego R.', status: 'overdue' },
  { id: 'm2', device: 'CAM-103', task: 'PTZ greasing & calibration',    due: '2026-05-17', tech: 'Diego R.', status: 'soon' },
  { id: 'm3', device: 'DR-1',    task: 'Lock cycle test (1000 cycles)', due: '2026-05-20', tech: 'Mei L.',   status: 'soon' },
  { id: 'm4', device: 'IDF-A',   task: 'UPS battery health check',       due: '2026-05-28', tech: 'Jordan K.',status: 'scheduled' },
  { id: 'm5', device: 'RD-1',    task: 'Firmware update to v4.2.1',     due: '2026-06-02', tech: 'Mei L.',   status: 'scheduled' },
  { id: 'm6', device: 'CAM-102', task: 'Annual recertification',         due: '2026-06-10', tech: 'Diego R.', status: 'scheduled' },
  { id: 'm7', device: 'IDF-B',   task: 'Switch port audit',              due: '2026-04-30', tech: 'Jordan K.',status: 'done' },
  { id: 'm8', device: 'CAM-101', task: 'Q1 lens clean',                  due: '2026-04-15', tech: 'Diego R.', status: 'done' },
];

export function Maintenance() {
  const { projectId = 'p1' } = useParams();
  const [filter, setFilter] = useState<'all' | Job['status']>('all');
  const filtered = useMemo(() => filter === 'all' ? JOBS : JOBS.filter((j) => j.status === filter), [filter]);

  const counts = useMemo(() => ({
    overdue: JOBS.filter((j) => j.status === 'overdue').length,
    soon: JOBS.filter((j) => j.status === 'soon').length,
    scheduled: JOBS.filter((j) => j.status === 'scheduled').length,
    done: JOBS.filter((j) => j.status === 'done').length,
  }), []);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Operate' }, { label: 'Maintenance' }]}
      title="Maintenance schedule"
      subtitle="Preventive jobs, firmware, and inspections"
      actions={<Button size="sm" variant="outline">Sync to calendar</Button>}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Overdue"   value={counts.overdue}   tone="text-red-400"     onClick={() => setFilter('overdue')} active={filter === 'overdue'} />
          <Stat label="Due soon"  value={counts.soon}      tone="text-amber-400"   onClick={() => setFilter('soon')}    active={filter === 'soon'} />
          <Stat label="Scheduled" value={counts.scheduled} tone="text-primary"      onClick={() => setFilter('scheduled')} active={filter === 'scheduled'} />
          <Stat label="Completed" value={counts.done}      tone="text-emerald-400" onClick={() => setFilter('done')}    active={filter === 'done'} />
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium">{filter === 'all' ? 'All jobs' : `${filter[0].toUpperCase()}${filter.slice(1)} jobs`}</h3>
            <button onClick={() => setFilter('all')} className="text-xs text-muted-foreground hover:text-foreground">Show all</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Device</th>
                <th className="text-left px-4 py-2 font-medium">Task</th>
                <th className="text-left px-4 py-2 font-medium">Due</th>
                <th className="text-left px-4 py-2 font-medium">Tech</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((j) => (
                <tr key={j.id} className="border-t border-border hover:bg-secondary/20">
                  <td className="px-4 py-2.5 font-medium">{j.device}</td>
                  <td className="px-4 py-2.5">{j.task}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{j.due}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{j.tech}</td>
                  <td className="px-4 py-2.5"><StatusPill s={j.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone, onClick, active }: { label: string; value: number; tone: string; onClick: () => void; active: boolean }) {
  return (
    <button onClick={onClick} className={`text-left bg-card border rounded-lg p-3 transition-colors ${active ? 'border-primary' : 'border-border hover:border-border-strong'}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-medium mt-1 ${tone}`}>{value}</div>
    </button>
  );
}

function StatusPill({ s }: { s: Job['status'] }) {
  const map = {
    overdue:   { tone: 'text-red-400 bg-red-400/10',     icon: AlertTriangle },
    soon:      { tone: 'text-amber-400 bg-amber-400/10', icon: Clock },
    scheduled: { tone: 'text-primary bg-primary/10',     icon: Calendar },
    done:      { tone: 'text-emerald-400 bg-emerald-400/10', icon: CheckCircle2 },
  }[s];
  const Icon = map.icon;
  return <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${map.tone}`}><Icon className="w-3 h-3" />{s}</span>;
}
