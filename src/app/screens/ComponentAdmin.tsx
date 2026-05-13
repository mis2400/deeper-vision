import { useState, useMemo } from 'react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Plus, Search, CheckCircle2, Circle } from 'lucide-react';

interface Comp { id: string; mfr: string; model: string; category: string; version: string; updated: string; status: 'published' | 'draft' | 'deprecated'; }

const COMPS: Comp[] = [
  { id: 'c1',  mfr: 'Axis',       model: 'P1468-LE',  category: 'Camera',     version: '1.4.0', updated: '2026-04-22', status: 'published' },
  { id: 'c2',  mfr: 'Axis',       model: 'Q6315-LE',  category: 'Camera',     version: '1.2.0', updated: '2026-04-10', status: 'published' },
  { id: 'c3',  mfr: 'Axis',       model: 'M3215-LVE', category: 'Camera',     version: '0.9.1', updated: '2026-05-02', status: 'draft' },
  { id: 'c4',  mfr: 'HID',        model: 'Signo 20',  category: 'Reader',     version: '2.1.0', updated: '2026-03-18', status: 'published' },
  { id: 'c5',  mfr: 'HID',        model: 'iCLASS R10',category: 'Reader',     version: '1.0.0', updated: '2024-11-04', status: 'deprecated' },
  { id: 'c6',  mfr: 'Mercury',    model: 'MR62e',     category: 'Controller', version: '3.0.0', updated: '2026-04-30', status: 'published' },
  { id: 'c7',  mfr: 'Mercury',    model: 'MR52',      category: 'Controller', version: '2.5.0', updated: '2026-01-12', status: 'published' },
  { id: 'c8',  mfr: 'Securitron', model: 'M62',       category: 'Lock',       version: '1.1.0', updated: '2026-02-08', status: 'published' },
  { id: 'c9',  mfr: 'Von Duprin', model: '6210',      category: 'Lock',       version: '1.0.0', updated: '2026-04-18', status: 'published' },
  { id: 'c10', mfr: 'Cisco',      model: 'C9300-48P', category: 'Switch',     version: '1.3.0', updated: '2026-03-04', status: 'published' },
];

export function ComponentAdmin() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const cats = useMemo(() => ['all', ...Array.from(new Set(COMPS.map((c) => c.category)))], []);
  const filtered = useMemo(() => COMPS.filter((c) => (cat === 'all' || c.category === cat) && (!q || `${c.mfr} ${c.model}`.toLowerCase().includes(q.toLowerCase()))), [q, cat]);

  return (
    <AppShell
      crumbs={[{ label: 'Admin', to: '/admin' }, { label: 'Components' }]}
      title="Component library"
      subtitle="Manage the catalog of devices available across all projects"
      actions={<Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" />New component</Button>}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search manufacturer or model…" className="w-full bg-input-background border border-input-border rounded-md pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-1">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`text-xs px-2.5 py-1.5 rounded border ${cat === c ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}>{c}</button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Manufacturer</th>
                <th className="text-left px-4 py-2 font-medium">Model</th>
                <th className="text-left px-4 py-2 font-medium">Category</th>
                <th className="text-left px-4 py-2 font-medium">Version</th>
                <th className="text-left px-4 py-2 font-medium">Updated</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-secondary/20">
                  <td className="px-4 py-2.5">{c.mfr}</td>
                  <td className="px-4 py-2.5 font-medium">{c.model}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.category}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">v{c.version}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.updated}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill s={c.status} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No components match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function StatusPill({ s }: { s: Comp['status'] }) {
  const map = {
    published:  { tone: 'text-emerald-400 bg-emerald-400/10', icon: CheckCircle2 },
    draft:      { tone: 'text-amber-400 bg-amber-400/10',     icon: Circle },
    deprecated: { tone: 'text-muted-foreground bg-secondary', icon: Circle },
  }[s];
  const Icon = map.icon;
  return <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${map.tone}`}><Icon className="w-3 h-3" />{s}</span>;
}
