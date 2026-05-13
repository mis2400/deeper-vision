import { useMemo, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Search, Book, Download, ExternalLink } from 'lucide-react';

type Cat = 'standards' | 'specs' | 'install' | 'compliance';
interface Doc { id: string; title: string; cat: Cat; org: string; ref: string; tags: string[]; }

const DOCS: Doc[] = [
  { id: '1', title: 'NFPA 731 — Standard for the installation of premises security systems', cat: 'standards', org: 'NFPA',    ref: 'NFPA 731-2023',    tags: ['intrusion', 'electronic security', 'installation'] },
  { id: '2', title: 'NFPA 72 — National Fire Alarm Code',                                     cat: 'standards', org: 'NFPA',    ref: 'NFPA 72-2025',     tags: ['fire alarm', 'interface', 'release'] },
  { id: '3', title: 'UL 294 — Access Control System Units',                                   cat: 'standards', org: 'UL',      ref: 'UL 294, 6th ed.',  tags: ['access control', 'listing'] },
  { id: '4', title: 'UL 2050 — National Industrial Security Systems',                         cat: 'standards', org: 'UL',      ref: 'UL 2050',          tags: ['monitoring', 'central station'] },
  { id: '5', title: 'IBC 1010 — Doors, gates, and turnstiles',                                 cat: 'compliance', org: 'ICC',    ref: 'IBC 1010',         tags: ['egress', 'maglock'] },
  { id: '6', title: 'ADA Section 404 — Doors, doorways, and gates',                            cat: 'compliance', org: 'DOJ',    ref: 'ADA 2010 §404',    tags: ['accessibility', 'mounting'] },
  { id: '7', title: 'NEC 725 — Class 1, 2, and 3 remote-control circuits',                     cat: 'compliance', org: 'NFPA',    ref: 'NEC Art. 725',    tags: ['power-limited', 'cable separation'] },
  { id: '8', title: 'Axis P-Series installation guide',                                        cat: 'install',    org: 'Axis',   ref: 'AX-P-INST-v6',     tags: ['camera', 'mount', 'PoE'] },
  { id: '9', title: 'Mercury MR-Series controller wiring',                                     cat: 'install',    org: 'Mercury',ref: 'MR-WIRE-2024',     tags: ['controller', 'wiring', 'OSDPv2'] },
  { id: '10', title: 'HID Signo reader mounting heights & ADA',                                 cat: 'install',    org: 'HID',    ref: 'HID-SIGNO-MNT',    tags: ['reader', 'mounting', 'ADA'] },
  { id: '11', title: 'Axis P1468-LE datasheet',                                                 cat: 'specs',      org: 'Axis',   ref: 'AX-P1468-LE',      tags: ['camera', 'bullet', '4MP'] },
  { id: '12', title: 'Cisco C9300 PoE budget reference',                                        cat: 'specs',      org: 'Cisco',  ref: 'CSCO-C9300-PoE',   tags: ['switch', 'PoE', 'budget'] },
  { id: '13', title: 'Securitron M62 spec sheet',                                               cat: 'specs',      org: 'Securitron',ref: 'M62-SPEC',     tags: ['maglock', '1200lb'] },
];

const CATEGORIES: Array<{ id: Cat | 'all'; label: string }> = [
  { id: 'all',        label: 'All articles' },
  { id: 'standards',  label: 'Standards' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'install',    label: 'Install guides' },
  { id: 'specs',      label: 'Spec sheets' },
];

export function KnowledgeBase() {
  const [cat, setCat] = useState<Cat | 'all'>('all');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(DOCS[0].id);
  const filtered = useMemo(() => DOCS.filter((d) => (cat === 'all' || d.cat === cat) && (!q || `${d.title} ${d.ref} ${d.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [cat, q]);
  const sel = DOCS.find((d) => d.id === selId) ?? filtered[0];

  return (
    <AppShell crumbs={[{ label: 'Knowledge base' }]} fullBleed>
      <div className="h-full flex">
        <div className="w-56 shrink-0 border-r border-border bg-background p-3 overflow-auto">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-1.5">Categories</div>
          <div className="space-y-0.5">
            {CATEGORIES.map((c) => {
              const count = c.id === 'all' ? DOCS.length : DOCS.filter((d) => d.cat === c.id).length;
              const active = cat === c.id;
              return (
                <button key={c.id} onClick={() => setCat(c.id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${active ? 'bg-secondary' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
                  <Book className="w-3.5 h-3.5" />
                  <span className="flex-1 text-left">{c.label}</span>
                  <span className="text-[10px]">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-0 border-r border-border flex flex-col overflow-hidden">
          <div className="h-12 shrink-0 border-b border-border px-3 flex items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search standards, specs, tags…" className="w-full bg-input-background border border-input-border rounded-md pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {filtered.map((d) => (
              <button key={d.id} onClick={() => setSelId(d.id)} className={`w-full text-left p-3 rounded transition-colors border ${sel?.id === d.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-secondary/40'}`}>
                <div className="text-xs text-muted-foreground">{d.org} · {d.ref}</div>
                <div className="text-sm mt-0.5">{d.title}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {d.tags.map((t) => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{t}</span>)}
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No matches.</div>}
          </div>
        </div>

        {sel && (
          <div className="w-80 shrink-0 bg-background overflow-auto p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{sel.org} · {sel.ref}</div>
            <h2 className="text-lg font-medium mt-1 leading-tight">{sel.title}</h2>
            <p className="mt-4 text-sm text-muted-foreground">Reference excerpts, scope, and citations for this document. Open the full text to browse sections and pin clauses to projects.</p>
            <div className="mt-5 space-y-2">
              <Button className="w-full" size="sm"><ExternalLink className="w-3.5 h-3.5 mr-1" />Open full text</Button>
              <Button className="w-full" size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" />Download PDF</Button>
            </div>
            <div className="mt-6">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {sel.tags.map((t) => <span key={t} className="text-xs px-2 py-0.5 rounded bg-secondary">{t}</span>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
