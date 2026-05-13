import { useState, useMemo } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Check, X, Minus, FileDown } from 'lucide-react';

type Result = 'pass' | 'fail' | 'na' | null;
interface Test { id: string; label: string; }
interface Device { id: string; name: string; type: string; tests: Test[]; }

const DEVICES: Device[] = [
  { id: 'CAM-101', name: 'CAM-101 — Lobby NE', type: 'Camera', tests: [
    { id: 't1', label: 'Power on, link up' },
    { id: 't2', label: 'Live image at NVR' },
    { id: 't3', label: 'IR cut filter cycles' },
    { id: 't4', label: 'Motion zone triggers event' },
  ]},
  { id: 'CAM-102', name: 'CAM-102 — Lobby SW', type: 'Camera', tests: [
    { id: 't1', label: 'Power on, link up' },
    { id: 't2', label: 'Live image at NVR' },
    { id: 't3', label: 'Recording to retention policy' },
  ]},
  { id: 'DR-1',   name: 'DR-1 — Main Entry', type: 'Door', tests: [
    { id: 't1', label: 'Reader reads valid card' },
    { id: 't2', label: 'Strike releases on grant' },
    { id: 't3', label: 'REX fires on egress' },
    { id: 't4', label: 'Forced-door alarm at head end' },
    { id: 't5', label: 'Fire release on alarm' },
  ]},
  { id: 'DR-2',   name: 'DR-2 — IT Room', type: 'Door', tests: [
    { id: 't1', label: 'Reader reads valid card' },
    { id: 't2', label: 'Strike releases on grant' },
    { id: 't3', label: 'Held-open alarm > 30s' },
  ]},
];

export function Commissioning() {
  const { projectId = 'p1' } = useParams();
  const [results, setResults] = useState<Record<string, Result>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selId, setSelId] = useState(DEVICES[0].id);
  const sel = DEVICES.find((d) => d.id === selId)!;

  const setResult = (k: string, r: Result) => setResults((p) => ({ ...p, [k]: p[k] === r ? null : r }));

  const counts = useMemo(() => {
    let pass = 0, fail = 0, total = 0;
    DEVICES.forEach((d) => d.tests.forEach((t) => {
      total++;
      const r = results[`${d.id}.${t.id}`];
      if (r === 'pass') pass++;
      if (r === 'fail') fail++;
    }));
    return { pass, fail, total, pct: total ? Math.round((pass / total) * 100) : 0 };
  }, [results]);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Operate' }, { label: 'Commissioning' }]}
      title="Commissioning"
      subtitle="Run acceptance tests device by device"
      actions={<Button size="sm" variant="outline"><FileDown className="w-3.5 h-3.5 mr-1" />Export report</Button>}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-6 grid grid-cols-[280px_1fr] gap-4">
        <div>
          <div className="bg-card border border-border rounded-lg p-3 mb-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Progress</div>
            <div className="text-2xl font-medium mt-1">{counts.pass} <span className="text-sm text-muted-foreground">/ {counts.total} pass</span></div>
            <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400" style={{ width: `${counts.pct}%` }} />
            </div>
            {counts.fail > 0 && <div className="text-xs text-red-400 mt-2">{counts.fail} failed test{counts.fail > 1 ? 's' : ''}</div>}
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {DEVICES.map((d) => {
              const done = d.tests.filter((t) => results[`${d.id}.${t.id}`] === 'pass').length;
              return (
                <button key={d.id} onClick={() => setSelId(d.id)} className={`w-full text-left px-3 py-2.5 border-b border-border last:border-b-0 ${selId === d.id ? 'bg-secondary' : 'hover:bg-secondary/40'}`}>
                  <div className="text-sm">{d.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{d.type} · {done}/{d.tests.length}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs text-muted-foreground">{sel.type}</div>
            <h2 className="text-lg font-medium">{sel.name}</h2>
          </div>
          <div>
            {sel.tests.map((t) => {
              const key = `${sel.id}.${t.id}`;
              const r = results[key];
              return (
                <div key={t.id} className="px-4 py-3 border-b border-border last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">{t.label}</div>
                    <div className="flex gap-1">
                      <ResultBtn active={r === 'pass'} tone="emerald" onClick={() => setResult(key, 'pass')}><Check className="w-3.5 h-3.5" />Pass</ResultBtn>
                      <ResultBtn active={r === 'fail'} tone="red"     onClick={() => setResult(key, 'fail')}><X className="w-3.5 h-3.5" />Fail</ResultBtn>
                      <ResultBtn active={r === 'na'}   tone="muted"   onClick={() => setResult(key, 'na')}  ><Minus className="w-3.5 h-3.5" />N/A</ResultBtn>
                    </div>
                  </div>
                  {r === 'fail' && (
                    <textarea value={notes[key] ?? ''} onChange={(e) => setNotes((p) => ({ ...p, [key]: e.target.value }))} placeholder="What failed? Punch-list note…" className="mt-2 w-full bg-input-background border border-input-border rounded p-2 text-xs focus:outline-none focus:border-primary" rows={2} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ResultBtn({ children, active, tone, onClick }: { children: React.ReactNode; active: boolean; tone: 'emerald' | 'red' | 'muted'; onClick: () => void }) {
  const toneCls = active
    ? tone === 'emerald' ? 'bg-emerald-400/15 text-emerald-400 border-emerald-400/40'
    : tone === 'red'     ? 'bg-red-400/15 text-red-400 border-red-400/40'
    : 'bg-secondary text-foreground border-border-strong'
    : 'border-border text-muted-foreground hover:bg-secondary/50';
  return <button onClick={onClick} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${toneCls}`}>{children}</button>;
}
