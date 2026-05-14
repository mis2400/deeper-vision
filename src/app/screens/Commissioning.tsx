import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Check, X, Minus, FileDown } from 'lucide-react';
import { useProjectStore, selectors as sel } from '../store/projectStore';
import type { DeviceType } from '../store/types';

type Result = 'pass' | 'fail' | 'na' | null;
interface Test { id: string; label: string; }
interface CommDevice { id: string; name: string; type: string; tests: Test[]; }

// Standard test suites by device kind. Generated from store devices live —
// no hardcoded device list, but the test catalog stays here so commissioning
// teams can adapt without touching every device.
const TESTS_FOR_KIND: Record<string, Test[]> = {
  'cam.bullet':      [{ id: 't1', label: 'Power on, link up' }, { id: 't2', label: 'Live image at NVR' }, { id: 't3', label: 'IR cut filter cycles' }, { id: 't4', label: 'Motion zone triggers event' }],
  'cam.dome':        [{ id: 't1', label: 'Power on, link up' }, { id: 't2', label: 'Live image at NVR' }, { id: 't3', label: 'Aim verified' }, { id: 't4', label: 'Recording to retention policy' }],
  'cam.ptz':         [{ id: 't1', label: 'Power on, link up' }, { id: 't2', label: 'Pan/tilt full range' }, { id: 't3', label: 'Zoom + AF' }, { id: 't4', label: 'Preset tour cycles' }],
  'cam.multisensor': [{ id: 't1', label: 'Power on, link up' }, { id: 't2', label: 'All 4 lenses stream' }, { id: 't3', label: 'Stitching alignment' }, { id: 't4', label: 'Motion zone triggers event' }],
  'cam.fisheye':     [{ id: 't1', label: 'Power on, link up' }, { id: 't2', label: 'Live image at NVR' }, { id: 't3', label: 'Dewarp at viewer' }],
  'cam.thermal':     [{ id: 't1', label: 'Power on, link up' }, { id: 't2', label: 'Thermal calibration' }, { id: 't3', label: 'Alarm threshold trip' }],
  'cam.lpr':         [{ id: 't1', label: 'Power on, link up' }, { id: 't2', label: 'Plate read test (3 trials)' }, { id: 't3', label: 'OCR confidence ≥ 95%' }],
  'acc.reader':      [{ id: 't1', label: 'Reader reads valid card' }, { id: 't2', label: 'Mobile credential' }, { id: 't3', label: 'Invalid card denied' }],
  'acc.strike':      [{ id: 't1', label: 'Strike releases on grant' }, { id: 't2', label: 'Fail-mode correct' }, { id: 't3', label: 'Forced-door alarm' }],
  'acc.maglock':     [{ id: 't1', label: 'Holding force' }, { id: 't2', label: 'Fire release on alarm' }, { id: 't3', label: 'REX bypass' }],
  'acc.exit':        [{ id: 't1', label: 'Push bar releases' }, { id: 't2', label: 'REX fires on egress' }, { id: 't3', label: 'Held-open alarm > 30s' }],
  'net.idf':         [{ id: 't1', label: 'Switch boot + uplink' }, { id: 't2', label: 'PoE budget within spec' }, { id: 't3', label: 'UPS runtime test' }],
  'net.switch':      [{ id: 't1', label: 'Boot + uplink' }, { id: 't2', label: 'PoE budget within spec' }],
  'net.ap':          [{ id: 't1', label: 'Power on, link up' }, { id: 't2', label: 'SSIDs broadcast' }, { id: 't3', label: 'Roaming verified' }],
};

const KIND_LABEL: Partial<Record<DeviceType, string>> = {
  'cam.bullet': 'Camera · bullet', 'cam.dome': 'Camera · dome', 'cam.ptz': 'Camera · PTZ',
  'cam.multisensor': 'Camera · multisensor', 'cam.fisheye': 'Camera · fisheye',
  'cam.thermal': 'Camera · thermal', 'cam.lpr': 'Camera · LPR',
  'acc.reader': 'Reader', 'acc.strike': 'Strike', 'acc.maglock': 'Maglock', 'acc.exit': 'Exit device',
  'net.idf': 'IDF', 'net.switch': 'Switch', 'net.ap': 'Wireless AP',
};

export function Commissioning() {
  const { projectId = 'p1' } = useParams();
  const projectName = useProjectStore((s) => s.projects[projectId]?.name ?? 'Project');
  const storeDevices = useProjectStore((s) => sel.devicesForProject(s, projectId));
  const storeDoors   = useProjectStore((s) => Object.values(s.doors).filter((d) => d.projectId === projectId));
  const storeIDFs    = useProjectStore((s) => sel.idfsForProject(s, projectId));

  // Build a single commissioning list from canvas devices + doors + IDFs.
  // Every entry on this page now corresponds to a real canvas object.
  const devices: CommDevice[] = useMemo(() => {
    const out: CommDevice[] = [];
    for (const d of storeDevices) {
      const tests = TESTS_FOR_KIND[d.type] ?? [{ id: 't1', label: 'Power on, link up' }, { id: 't2', label: 'Online at head end' }];
      const label = KIND_LABEL[d.type] ?? d.type;
      out.push({ id: d.id, name: `${d.id} — ${d.label}`, type: label, tests });
    }
    for (const door of storeDoors) {
      out.push({
        id: door.id,
        name: `${door.id} — ${door.doorType} door`,
        type: 'Door assembly',
        tests: [
          { id: 't1', label: 'All hardware powered' },
          { id: 't2', label: 'Reader → controller test' },
          { id: 't3', label: 'Strike/maglock cycle' },
          { id: 't4', label: 'REX fires on egress' },
          { id: 't5', label: 'Forced-door alarm at head end' },
          ...(door.fireRated ? [{ id: 't6', label: 'Fire release on alarm' }] : []),
        ],
      });
    }
    for (const idf of storeIDFs) {
      out.push({
        id: idf.id,
        name: `${idf.id} — ${idf.name}`,
        type: 'IDF cabinet',
        tests: TESTS_FOR_KIND['net.idf'] ?? [{ id: 't1', label: 'Boot + uplink' }],
      });
    }
    return out;
  }, [storeDevices, storeDoors, storeIDFs]);

  const [results, setResults] = useState<Record<string, Result>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selId, setSelId] = useState<string | null>(null);
  useEffect(() => {
    // Auto-select the first device if nothing is selected yet (or selection was removed).
    if (devices.length && (!selId || !devices.find((d) => d.id === selId))) setSelId(devices[0].id);
  }, [devices, selId]);

  const selected = devices.find((d) => d.id === selId) ?? null;

  const setResult = (k: string, r: Result) => setResults((p) => ({ ...p, [k]: p[k] === r ? null : r }));

  const counts = useMemo(() => {
    let pass = 0, fail = 0, total = 0;
    devices.forEach((d) => d.tests.forEach((t) => {
      total++;
      const r = results[`${d.id}.${t.id}`];
      if (r === 'pass') pass++;
      if (r === 'fail') fail++;
    }));
    return { pass, fail, total, pct: total ? Math.round((pass / total) * 100) : 0 };
  }, [results, devices]);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: projectName, to: `/project/${projectId}/canvas` }, { label: 'Commissioning' }]}
      title="Commissioning"
      subtitle={`${devices.length} canvas objects to verify`}
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
            {devices.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">
                No canvas objects to commission yet. Place devices on the canvas first.
              </div>
            ) : devices.map((d) => {
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
          {!selected ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Select a device from the list to run its commissioning tests.
            </div>
          ) : (<>
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs text-muted-foreground">{selected.type}</div>
            <h2 className="text-lg font-medium">{selected.name}</h2>
          </div>
          <div>
            {selected.tests.map((t) => {
              const key = `${selected.id}.${t.id}`;
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
          </>)}
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
