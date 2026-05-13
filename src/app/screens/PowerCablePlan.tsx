import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Zap, Cable, AlertTriangle, FileDown } from 'lucide-react';

interface IDF { id: string; name: string; location: string; switch: string; portsTotal: number; portsUsed: number; poeBudgetW: number; poeUsedW: number; runs: number; }
interface Run { id: string; from: string; to: string; type: 'Cat6A' | 'OM4' | 'Coax'; len: number; tray: string; }

const IDFS: IDF[] = [
  { id: 'idf-a', name: 'IDF-A',  location: 'L1 Closet 110',  switch: 'Cisco C9300-48P', portsTotal: 48, portsUsed: 32, poeBudgetW: 740, poeUsedW: 510, runs: 28 },
  { id: 'idf-b', name: 'IDF-B',  location: 'L2 Closet 220',  switch: 'Cisco C9300-24P', portsTotal: 24, portsUsed: 18, poeBudgetW: 445, poeUsedW: 280, runs: 16 },
  { id: 'idf-c', name: 'IDF-C',  location: 'L3 Closet 310',  switch: 'Cisco C9300-24P', portsTotal: 24, portsUsed: 22, poeBudgetW: 445, poeUsedW: 420, runs: 22 },
  { id: 'mdf',   name: 'MDF',    location: 'Data center B1', switch: 'Cisco C9500-32C', portsTotal: 32, portsUsed: 6,  poeBudgetW: 0,   poeUsedW: 0,   runs: 6  },
];

const RUNS: Run[] = [
  { id: 'r1', from: 'CAM-101', to: 'IDF-A', type: 'Cat6A', len: 85,  tray: 'L1-Tray-N' },
  { id: 'r2', from: 'CAM-102', to: 'IDF-A', type: 'Cat6A', len: 62,  tray: 'L1-Tray-N' },
  { id: 'r3', from: 'CAM-103', to: 'IDF-A', type: 'Cat6A', len: 140, tray: 'L1-Tray-E' },
  { id: 'r4', from: 'IDF-A',   to: 'MDF',    type: 'OM4',   len: 220, tray: 'Riser-1' },
  { id: 'r5', from: 'IDF-B',   to: 'MDF',    type: 'OM4',   len: 180, tray: 'Riser-1' },
  { id: 'r6', from: 'IDF-C',   to: 'MDF',    type: 'OM4',   len: 240, tray: 'Riser-1' },
];

export function PowerCablePlan() {
  const { projectId = 'p1' } = useParams();
  const totals = useMemo(() => ({
    ports: IDFS.reduce((a, i) => a + i.portsUsed, 0),
    portsCap: IDFS.reduce((a, i) => a + i.portsTotal, 0),
    poe: IDFS.reduce((a, i) => a + i.poeUsedW, 0),
    poeCap: IDFS.reduce((a, i) => a + i.poeBudgetW, 0),
    runs: IDFS.reduce((a, i) => a + i.runs, 0),
  }), []);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Canvas', to: `/project/${projectId}/canvas` }, { label: 'Power & cable' }]}
      title="Power & cable plan"
      subtitle="IDF budgets, switch utilization, cable runs"
      actions={<Button size="sm" variant="outline"><FileDown className="w-3.5 h-3.5 mr-1" />Export schedule</Button>}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Switch ports used" value={`${totals.ports} / ${totals.portsCap}`} pct={(totals.ports / totals.portsCap) * 100} />
          <Stat label="PoE budget used"   value={`${totals.poe}W / ${totals.poeCap}W`} pct={(totals.poe / totals.poeCap) * 100} />
          <Stat label="Cable runs"        value={`${totals.runs}`} />
          <Stat label="IDFs"              value={`${IDFS.length}`} />
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium">IDFs / MDFs</h3>
            <span className="text-xs text-muted-foreground">{IDFS.length} closets</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Closet</th>
                <th className="text-left px-4 py-2 font-medium">Switch</th>
                <th className="text-left px-4 py-2 font-medium w-40">Port utilization</th>
                <th className="text-left px-4 py-2 font-medium w-40">PoE budget</th>
                <th className="text-right px-4 py-2 font-medium">Runs</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {IDFS.map((i) => {
                const pPct = (i.portsUsed / i.portsTotal) * 100;
                const ePct = i.poeBudgetW > 0 ? (i.poeUsedW / i.poeBudgetW) * 100 : 0;
                const warn = pPct > 85 || ePct > 90;
                return (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-muted-foreground">{i.location}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{i.switch}</td>
                    <td className="px-4 py-3"><BarRow used={i.portsUsed} cap={i.portsTotal} unit="" /></td>
                    <td className="px-4 py-3"><BarRow used={i.poeUsedW} cap={i.poeBudgetW} unit="W" /></td>
                    <td className="px-4 py-3 text-right">{i.runs}</td>
                    <td className="px-4 py-3">{warn && <AlertTriangle className="w-4 h-4 text-amber-400" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
            <Cable className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Cable runs</h3>
            <span className="text-xs text-muted-foreground ml-auto">{RUNS.length} runs</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">From</th>
                <th className="text-left px-4 py-2 font-medium">To</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-right px-4 py-2 font-medium">Length</th>
                <th className="text-left px-4 py-2 font-medium">Tray / pathway</th>
              </tr>
            </thead>
            <tbody>
              {RUNS.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2.5">{r.from}</td>
                  <td className="px-4 py-2.5">{r.to}</td>
                  <td className="px-4 py-2.5"><span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-foreground">{r.type}</span></td>
                  <td className="px-4 py-2.5 text-right">{r.len} ft</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.tray}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, pct }: { label: string; value: string; pct?: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-medium mt-1">{value}</div>
      {pct !== undefined && (
        <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
          <div className={`h-full ${pct > 85 ? 'bg-amber-400' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function BarRow({ used, cap, unit }: { used: number; cap: number; unit: string }) {
  if (cap === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = (used / cap) * 100;
  const warn = pct > 85;
  return (
    <div>
      <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{used}{unit} / {cap}{unit}</span><span className={warn ? 'text-amber-400' : 'text-muted-foreground'}>{Math.round(pct)}%</span></div>
      <div className="mt-1 h-1 bg-secondary rounded-full overflow-hidden"><div className={`h-full ${warn ? 'bg-amber-400' : 'bg-primary'}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
