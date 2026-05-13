import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Search, BookOpen, Compass, Wrench, Shield, Sparkles, MessageSquare } from 'lucide-react';

interface Article { id: string; title: string; group: string; }

const GROUPS = [
  { id: 'start',    label: 'Getting started', icon: Compass },
  { id: 'canvas',   label: 'Canvas & design', icon: Sparkles },
  { id: 'install',  label: 'Install & ops',   icon: Wrench },
  { id: 'security', label: 'Security & code', icon: Shield },
  { id: 'ref',      label: 'Reference',       icon: BookOpen },
];

const ARTICLES: Article[] = [
  { id: 'a1',  title: 'Welcome to Deeper Vision',                 group: 'start' },
  { id: 'a2',  title: 'Create your first project',                group: 'start' },
  { id: 'a3',  title: 'Invite teammates & set roles',             group: 'start' },
  { id: 'a4',  title: 'Calibrate a blueprint',                    group: 'canvas' },
  { id: 'a5',  title: 'Place cameras and draw FOV',               group: 'canvas' },
  { id: 'a6',  title: 'Layers, presets, and view modes',          group: 'canvas' },
  { id: 'a7',  title: 'Keyboard shortcuts',                       group: 'canvas' },
  { id: 'a8',  title: 'Generate a BOM and proposal',              group: 'install' },
  { id: 'a9',  title: 'Schedule work orders',                     group: 'install' },
  { id: 'a10', title: 'Run a commissioning checklist',            group: 'install' },
  { id: 'a11', title: 'Egress, ADA, and fail-safe lock rules',    group: 'security' },
  { id: 'a12', title: 'PoE budgeting and IDF planning',           group: 'security' },
  { id: 'a13', title: 'How threat simulations work',              group: 'security' },
  { id: 'a14', title: 'Standards library (NFPA, UL, IBC, NEC)',   group: 'ref' },
  { id: 'a15', title: 'Component catalog & versioning',           group: 'ref' },
];

export function HelpCenter() {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => ARTICLES.filter((a) => !q || a.title.toLowerCase().includes(q.toLowerCase())), [q]);

  return (
    <AppShell crumbs={[{ label: 'Help' }]} title="Help center" subtitle="Guides, references, and answers">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help articles…" className="w-full bg-input-background border border-input-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary" />
        </div>

        {GROUPS.map((g) => {
          const items = filtered.filter((a) => a.group === g.id);
          if (items.length === 0) return null;
          const Icon = g.icon;
          return (
            <div key={g.id} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">{g.label}</h3>
              </div>
              <ul>
                {items.map((a) => (
                  <li key={a.id}>
                    <Link to={`/help/${a.id}`} className="block px-4 py-2.5 text-sm border-b border-border last:border-b-0 hover:bg-secondary/40">
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="text-sm">Still stuck?</div>
            <div className="text-xs text-muted-foreground">Reach our team — typical response under 4 hours.</div>
          </div>
          <Link to="/help/contact" className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary">Contact support</Link>
        </div>
      </div>
    </AppShell>
  );
}
