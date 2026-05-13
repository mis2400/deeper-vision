import { useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Cable, Route } from 'lucide-react';

interface Tray { id: string; name: string; capacity: number; used: number; type: 'Ladder' | 'Basket' | 'Conduit'; }

const TRAYS: Tray[] = [
  { id: 't1', name: 'L1 Tray North',  capacity: 144, used: 92,  type: 'Basket' },
  { id: 't2', name: 'L1 Tray East',   capacity: 96,  used: 78,  type: 'Basket' },
  { id: 't3', name: 'Riser 1',        capacity: 48,  used: 36,  type: 'Ladder' },
  { id: 't4', name: 'EMT to roof',    capacity: 12,  used: 4,   type: 'Conduit' },
];

export function PathwayRouting() {
  const { projectId = 'p1' } = useParams();
  const [showTrays, setShowTrays] = useState(true);
  const [showRuns, setShowRuns] = useState(true);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Design', to: `/project/${projectId}/canvas` }, { label: 'Pathways' }]}
      title="Pathway routing"
      subtitle="Tray fills, conduit runs, and shared sleeves"
      actions={<Button size="sm" variant="outline">Export pathway schedule</Button>}
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-[1fr_320px] gap-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={showTrays} onChange={(e) => setShowTrays(e.target.checked)} className="accent-primary" /> Show trays
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked={showRuns} onChange={(e) => setShowRuns(e.target.checked)} className="accent-primary" /> Show cable runs
            </label>
          </div>
          <div className="aspect-[4/3] bg-canvas-background relative">
            <svg viewBox="0 0 800 600" className="absolute inset-0 w-full h-full">
              <defs>
                <pattern id="path-dot" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#E6EDF3" opacity="0.06" /></pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#path-dot)" />
              {/* Building outline */}
              <g stroke="#7D8590" strokeWidth="1.5" fill="none">
                <rect x="60" y="60" width="680" height="480" />
                <line x1="400" y1="60" x2="400" y2="540" />
                <line x1="60" y1="300" x2="740" y2="300" />
              </g>

              {showTrays && (
                <g>
                  {/* Trays as thick blue paths */}
                  <line x1="80" y1="80" x2="720" y2="80"   stroke="#2F81F7" strokeWidth="6" opacity="0.4" />
                  <line x1="80" y1="80" x2="80"  y2="520" stroke="#2F81F7" strokeWidth="6" opacity="0.4" />
                  <line x1="400" y1="80" x2="400" y2="520" stroke="#A371F7" strokeWidth="5" opacity="0.5" strokeDasharray="2 4" />
                  <text x="100" y="76" fill="#7D8590" fontSize="10">L1 Tray North</text>
                  <text x="90" y="500" fill="#7D8590" fontSize="10" transform="rotate(-90 90 500)">Riser 1</text>
                </g>
              )}

              {showRuns && (
                <g stroke="#D29922" strokeWidth="1" opacity="0.7">
                  <path d="M 180 200 L 180 80" />
                  <path d="M 260 180 L 260 80" />
                  <path d="M 320 240 L 320 80" />
                  <path d="M 500 220 L 500 80" />
                  <path d="M 600 260 L 600 80" />
                  {/* Devices */}
                  {[180, 260, 320, 500, 600].map((x, i) => (
                    <circle key={i} cx={x} cy={[200, 180, 240, 220, 260][i]} r="4" fill="#2F81F7" stroke="#0D1117" strokeWidth="2" />
                  ))}
                </g>
              )}
            </svg>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <Route className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="text-sm font-medium">Trays & conduits</div>
            </div>
            {TRAYS.map((t) => {
              const pct = (t.used / t.capacity) * 100;
              const warn = pct > 80;
              return (
                <div key={t.id} className="px-3 py-2.5 border-b border-border last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">{t.name}</div>
                    <span className="text-[10px] text-muted-foreground">{t.type}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-muted-foreground">{t.used} / {t.capacity} cables</span>
                    <span className={warn ? 'text-amber-400' : 'text-muted-foreground'}>{Math.round(pct)}%</span>
                  </div>
                  <div className="mt-1.5 h-1 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${warn ? 'bg-amber-400' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
            <Cable className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Tray fill is rule-of-thumb 50% Cat6A / 40% fiber. NEC 392 caps absolute.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
