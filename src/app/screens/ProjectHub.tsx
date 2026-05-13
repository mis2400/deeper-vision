import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Search, Plus, MapPin, Users, Calendar, ChevronRight, LayoutGrid, List as ListIcon } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  client: string;
  address: string;
  status: 'design' | 'review' | 'install' | 'live';
  devices: number;
  team: number;
  updated: string;
  progress: number;
}

const PROJECTS: Project[] = [
  { id: 'p1', name: 'Acme HQ — Austin',          client: 'Acme Industries',     address: '500 Congress Ave · Austin, TX', status: 'design',  devices: 84,  team: 4, updated: '2h ago',   progress: 28 },
  { id: 'p2', name: 'Mercy Hospital Tower B',    client: 'Mercy Health',         address: '1200 Medical Pkwy · Dallas, TX', status: 'review',  devices: 142, team: 6, updated: '6h ago',   progress: 62 },
  { id: 'p3', name: 'Westfield Mall Renovation', client: 'Unibail-Rodamco',     address: '865 Market St · San Francisco', status: 'install', devices: 218, team: 9, updated: '1d ago',   progress: 81 },
  { id: 'p4', name: 'Central Data Center',       client: 'Equinix',              address: '4150 Network Way · Ashburn, VA', status: 'live',    devices: 64,  team: 3, updated: '3d ago',   progress: 100 },
  { id: 'p5', name: 'Lincoln High School',       client: 'Portland Public Schools', address: '1600 Education Way · Portland', status: 'design',  devices: 38,  team: 3, updated: '1d ago',   progress: 14 },
  { id: 'p6', name: 'Riverside Apartments',      client: 'BlackRock REIT',       address: '88 Riverside · Brooklyn, NY',    status: 'review',  devices: 96,  team: 5, updated: '4h ago',   progress: 48 },
];

const STATUS_META = {
  design:  { label: 'Design',     tone: 'text-primary bg-primary/10' },
  review:  { label: 'In review',  tone: 'text-amber-400 bg-amber-400/10' },
  install: { label: 'Installing', tone: 'text-emerald-400 bg-emerald-400/10' },
  live:    { label: 'Live',       tone: 'text-foreground bg-secondary' },
} as const;

export function ProjectHub() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | Project['status']>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filtered = PROJECTS.filter((p) =>
    (filter === 'all' || p.status === filter) &&
    (!q || `${p.name} ${p.client} ${p.address}`.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <AppShell
      crumbs={[{ label: 'Projects' }]}
      actions={
        <Button size="sm" onClick={() => navigate('/intake/new')}>
          <Plus className="w-3.5 h-3.5 mr-1" />New project
        </Button>
      }
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">{filtered.length} of {PROJECTS.length} · last sync 12s ago</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects, clients, addresses"
              className="w-full bg-input-background border border-input-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center border border-border rounded-md p-0.5 bg-background">
            {(['all', 'design', 'review', 'install', 'live'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${filter === f ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {f === 'all' ? 'All' : STATUS_META[f].label}
              </button>
            ))}
          </div>

          <div className="flex items-center border border-border rounded-md p-0.5 bg-background ml-auto">
            <button onClick={() => setView('grid')} className={`p-1 rounded ${view === 'grid' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}><LayoutGrid className="w-3.5 h-3.5" /></button>
            <button onClick={() => setView('list')} className={`p-1 rounded ${view === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground'}`}><ListIcon className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/project/${p.id}/canvas`)}
                className="text-left bg-card border border-border rounded-lg p-4 hover:border-border-strong transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_META[p.status].tone}`}>{STATUS_META[p.status].label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <h3 className="text-base font-medium leading-tight">{p.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{p.client}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{p.address}
                </p>
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{p.devices} devices</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.team}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{p.updated}</span>
                </div>
                <div className="mt-3 h-1 bg-secondary/60 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${p.progress}%` }} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Project</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Devices</th>
                  <th className="text-left px-4 py-2 font-medium">Team</th>
                  <th className="text-left px-4 py-2 font-medium">Progress</th>
                  <th className="text-left px-4 py-2 font-medium">Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} onClick={() => navigate(`/project/${p.id}/canvas`)} className="border-t border-border cursor-pointer hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.client}</div>
                    </td>
                    <td className="px-4 py-3"><span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_META[p.status].tone}`}>{STATUS_META[p.status].label}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{p.devices}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.team}</td>
                    <td className="px-4 py-3 w-40">
                      <div className="h-1 bg-secondary/60 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.updated}</td>
                    <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-20 text-sm text-muted-foreground">
            No projects match. <button onClick={() => { setQ(''); setFilter('all'); }} className="text-primary hover:underline">Clear filters</button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
