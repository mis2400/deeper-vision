import { useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { DoorClosed, Save, AlertTriangle } from 'lucide-react';

interface Door { id: string; name: string; mode: 'fail-safe' | 'fail-secure'; reader: 'in' | 'in-out'; lock: string; rex: boolean; dps: boolean; egress: boolean; }

const DOORS: Door[] = [
  { id: 'DR-1', name: 'Main Entry — Lobby',  mode: 'fail-safe',  reader: 'in-out', lock: 'Von Duprin 6210 strike',   rex: true,  dps: true,  egress: true },
  { id: 'DR-2', name: 'IT Room',             mode: 'fail-secure',reader: 'in',     lock: 'Securitron M62 maglock',   rex: true,  dps: true,  egress: false },
  { id: 'DR-3', name: 'Roof Access',         mode: 'fail-secure',reader: 'in',     lock: 'Securitron M62 maglock',   rex: false, dps: true,  egress: false },
  { id: 'DR-4', name: 'Loading Dock',        mode: 'fail-safe',  reader: 'in-out', lock: 'Von Duprin 6210 strike',   rex: true,  dps: true,  egress: true  },
];

export function DoorEngineering() {
  const { projectId = 'p1' } = useParams();
  const [doors, setDoors] = useState(DOORS);
  const [selId, setSelId] = useState(doors[0].id);
  const sel = doors.find((d) => d.id === selId)!;

  const update = (patch: Partial<Door>) => setDoors((ds) => ds.map((d) => d.id === selId ? { ...d, ...patch } : d));

  const warn = sel.egress && sel.mode === 'fail-secure';

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Design', to: `/project/${projectId}/canvas` }, { label: 'Doors' }]}
      title="Door engineering"
      subtitle="Hardware schedule and lock programming"
      actions={<Button size="sm"><Save className="w-3.5 h-3.5 mr-1" />Save schedule</Button>}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-6 grid grid-cols-[260px_1fr_280px] gap-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {doors.map((d) => (
            <button key={d.id} onClick={() => setSelId(d.id)} className={`w-full text-left px-3 py-2.5 border-b border-border last:border-b-0 ${selId === d.id ? 'bg-secondary' : 'hover:bg-secondary/40'}`}>
              <div className="flex items-center gap-2">
                <DoorClosed className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="text-sm font-medium">{d.id}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{d.name}</div>
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-lg p-5 flex items-center justify-center">
          <DoorSchematic door={sel} />
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Lock mode</div>
            <div className="grid grid-cols-2 gap-1">
              {(['fail-safe', 'fail-secure'] as const).map((m) => (
                <button key={m} onClick={() => update({ mode: m })} className={`text-xs px-2 py-1.5 rounded border ${sel.mode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}>{m}</button>
              ))}
            </div>
            {warn && (
              <div className="mt-2 text-xs text-amber-400 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Egress door should be fail-safe per IBC 1010.
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Reader</div>
            <div className="grid grid-cols-2 gap-1">
              <button onClick={() => update({ reader: 'in' })}    className={`text-xs px-2 py-1.5 rounded border ${sel.reader === 'in'    ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}>In only</button>
              <button onClick={() => update({ reader: 'in-out' })} className={`text-xs px-2 py-1.5 rounded border ${sel.reader === 'in-out' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}>In + Out</button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-3 space-y-2">
            <Toggle label="REX (request to exit)" on={sel.rex}    onChange={(v) => update({ rex: v })} />
            <Toggle label="Door position switch"  on={sel.dps}    onChange={(v) => update({ dps: v })} />
            <Toggle label="Egress path"           on={sel.egress} onChange={(v) => update({ egress: v })} />
          </div>

          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Hardware</div>
            <div className="text-sm">{sel.lock}</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className="w-full flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className={`w-8 h-4 rounded-full p-0.5 ${on ? 'bg-primary' : 'bg-secondary'}`}>
        <span className={`block w-3 h-3 rounded-full bg-background transition-transform ${on ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

function DoorSchematic({ door }: { door: Door }) {
  return (
    <svg viewBox="0 0 320 240" className="w-full max-w-md">
      {/* Wall */}
      <line x1="20" y1="120" x2="120" y2="120" stroke="#7D8590" strokeWidth="3" />
      <line x1="200" y1="120" x2="300" y2="120" stroke="#7D8590" strokeWidth="3" />
      {/* Door leaf */}
      <line x1="120" y1="120" x2="200" y2="60" stroke="#E6EDF3" strokeWidth="2" />
      <path d="M 120 120 A 80 80 0 0 1 200 120" fill="none" stroke="#7D8590" strokeWidth="1" strokeDasharray="3 3" />
      {/* Lock */}
      <circle cx="195" cy="65" r="6" fill="#3FB950" />
      <text x="205" y="58" fill="#7D8590" fontSize="10">{door.mode === 'fail-safe' ? 'FS strike' : 'Maglock'}</text>
      {/* Readers */}
      <circle cx="115" cy="100" r="5" fill="#D29922" />
      <text x="80" y="95" fill="#7D8590" fontSize="10" textAnchor="end">Reader</text>
      {door.reader === 'in-out' && (
        <>
          <circle cx="115" cy="140" r="5" fill="#D29922" />
          <text x="80" y="146" fill="#7D8590" fontSize="10" textAnchor="end">Reader (out)</text>
        </>
      )}
      {/* DPS */}
      {door.dps && <>
        <rect x="118" y="115" width="6" height="10" fill="#2F81F7" />
        <text x="100" y="175" fill="#7D8590" fontSize="10">DPS</text>
      </>}
      {/* REX */}
      {door.rex && <>
        <rect x="196" y="115" width="6" height="10" fill="#A371F7" />
        <text x="210" y="175" fill="#7D8590" fontSize="10">REX</text>
      </>}
      {/* Egress label */}
      {door.egress && (
        <text x="160" y="220" fill="#3FB950" fontSize="10" textAnchor="middle">Egress path</text>
      )}
    </svg>
  );
}
