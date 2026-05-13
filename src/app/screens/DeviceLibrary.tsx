import { useState, useMemo } from 'react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Search, Plus, Camera, DoorClosed, KeyRound, Cpu, Router, Activity } from 'lucide-react';

type Category = 'cameras' | 'readers' | 'controllers' | 'locks' | 'switches' | 'sensors';

interface Device {
  id: string;
  name: string;
  mfr: string;
  model: string;
  category: Category;
  price: number;
  inStock: number;
  specs: Record<string, string>;
  blurb: string;
}

const DEVICES: Device[] = [
  { id: '1',  name: 'P1468-LE',  mfr: 'Axis',         model: '02340-001', category: 'cameras',     price: 845,  inStock: 24, blurb: '4 MP outdoor bullet · IR · Lightfinder 2.0',         specs: { Resolution: '4 MP', Lens: '3-9mm varifocal', IR: '40m', Power: 'PoE 802.3af', IP: 'IP66/IK10' } },
  { id: '2',  name: 'P3827-PVE', mfr: 'Axis',         model: '02100-001', category: 'cameras',     price: 4150, inStock: 6,  blurb: '180° multi-sensor · 4×4K · panoramic',                specs: { Resolution: '4×4K', Lens: 'Multi-sensor', Coverage: '180°', Power: 'PoE+ 802.3at', IP: 'IP66' } },
  { id: '3',  name: 'Q6315-LE',  mfr: 'Axis',         model: '01924-001', category: 'cameras',     price: 3895, inStock: 4,  blurb: 'PTZ · 31× zoom · 300m IR',                            specs: { Resolution: '2 MP', Zoom: '31× optical', IR: '300m', Power: 'High PoE', IP: 'IP66' } },
  { id: '4',  name: 'Signo 20',  mfr: 'HID',          model: '20NKS-00', category: 'readers',     price: 385,  inStock: 48, blurb: 'Mullion reader · multi-tech · Apple Wallet',          specs: { Form: 'Mullion', Tech: 'Multi-tech', Mobile: 'Apple/Google Wallet', Range: '6cm', Power: '12V DC' } },
  { id: '5',  name: 'Signo 40',  mfr: 'HID',          model: '40NKS-00', category: 'readers',     price: 425,  inStock: 36, blurb: 'Wall reader · multi-tech · backlit',                  specs: { Form: 'Wall', Tech: 'Multi-tech', Mobile: 'Apple/Google Wallet', Range: '7cm', Power: '12V DC' } },
  { id: '6',  name: 'MR62e',     mfr: 'Mercury',      model: 'MR62E-256',category: 'controllers', price: 695,  inStock: 16, blurb: '2-door IP controller · OSDPv2 · UL294',               specs: { Doors: '2', Inputs: '8', Outputs: '4', Protocol: 'OSDPv2', Listings: 'UL294' } },
  { id: '7',  name: 'MP4502',    mfr: 'Mercury',      model: 'MP4502',   category: 'controllers', price: 1495, inStock: 8,  blurb: '8-door master controller · scalable',                 specs: { Doors: '8', RS485: '8 ports', Power: '12-24V', Memory: '256k cardholders' } },
  { id: '8',  name: 'M62',       mfr: 'Securitron',   model: 'M62',      category: 'locks',       price: 245,  inStock: 32, blurb: 'Surface maglock · 1200lb holding force',              specs: { Force: '1200 lbf', Voltage: '12/24 VDC', Sensor: 'DPS standard', Listings: 'UL10C' } },
  { id: '9',  name: '6210',      mfr: 'Von Duprin',   model: '6210',     category: 'locks',       price: 385,  inStock: 24, blurb: 'Electric strike · fail-secure · ANSI',                specs: { Type: 'Electric strike', Mode: 'Fail-secure', Voltage: '12/24 VDC', Force: '1500 lbf' } },
  { id: '10', name: 'C9300-48P', mfr: 'Cisco',        model: 'C9300-48P',category: 'switches',    price: 7800, inStock: 4,  blurb: '48-port PoE+ · 1G · stackable',                       specs: { Ports: '48', PoE: '802.3at, 740W', Uplinks: '4×10G', Stack: 'StackWise-480' } },
  { id: '11', name: 'C9300-24P', mfr: 'Cisco',        model: 'C9300-24P',category: 'switches',    price: 5400, inStock: 6,  blurb: '24-port PoE+ · 1G · stackable',                       specs: { Ports: '24', PoE: '802.3at, 445W', Uplinks: '4×10G', Stack: 'StackWise-480' } },
  { id: '12', name: 'GS-DOOR',   mfr: 'Genetec',      model: 'GS-DOOR',  category: 'sensors',     price: 165,  inStock: 60, blurb: 'Magnetic door position switch',                       specs: { Type: 'Reed switch', Gap: '13mm', Wire: '2-conductor' } },
  { id: '13', name: 'BRP-REX',   mfr: 'Bosch',        model: 'BRP-REX',  category: 'sensors',     price: 95,   inStock: 84, blurb: 'PIR request-to-exit motion',                          specs: { Type: 'PIR', Range: '6m', Output: 'Form C relay' } },
];

const CATEGORIES: Array<{ id: Category | 'all'; label: string; icon: any; }> = [
  { id: 'all',         label: 'All devices', icon: Activity },
  { id: 'cameras',     label: 'Cameras',     icon: Camera },
  { id: 'readers',     label: 'Readers',     icon: KeyRound },
  { id: 'controllers', label: 'Controllers', icon: Cpu },
  { id: 'locks',       label: 'Locks & strikes', icon: DoorClosed },
  { id: 'switches',    label: 'Switches',    icon: Router },
  { id: 'sensors',     label: 'Sensors',     icon: Activity },
];

export function DeviceLibrary() {
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string>('1');

  const filtered = useMemo(() => DEVICES.filter((d) =>
    (cat === 'all' || d.category === cat) &&
    (!q || `${d.name} ${d.mfr} ${d.model} ${d.blurb}`.toLowerCase().includes(q.toLowerCase()))
  ), [cat, q]);

  const selected = DEVICES.find((d) => d.id === selectedId) ?? filtered[0];

  return (
    <AppShell
      crumbs={[{ label: 'Device library' }]}
      actions={<Button size="sm" variant="outline"><Plus className="w-3.5 h-3.5 mr-1" />Add device</Button>}
      fullBleed
    >
      <div className="h-full flex">
        {/* Category rail */}
        <div className="w-56 shrink-0 border-r border-border bg-background overflow-auto">
          <div className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-1.5">Categories</div>
            <div className="space-y-0.5">
              {CATEGORIES.map((c) => {
                const count = c.id === 'all' ? DEVICES.length : DEVICES.filter((d) => d.category === c.id).length;
                const active = cat === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCat(c.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}
                  >
                    <c.icon className="w-3.5 h-3.5" />
                    <span className="flex-1 text-left">{c.label}</span>
                    <span className="text-[10px]">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-w-0 border-r border-border flex flex-col overflow-hidden">
          <div className="h-12 shrink-0 border-b border-border px-3 flex items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by manufacturer, model, feature"
                className="w-full bg-input-background border border-input-border rounded-md pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-xs text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Device</th>
                  <th className="text-left px-4 py-2 font-medium">Mfr</th>
                  <th className="text-right px-4 py-2 font-medium">Price</th>
                  <th className="text-right px-4 py-2 font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={`border-t border-border cursor-pointer ${selected?.id === d.id ? 'bg-primary/10' : 'hover:bg-secondary/30'}`}
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.blurb}</div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{d.mfr}</td>
                    <td className="px-4 py-2 text-right">${d.price.toLocaleString()}</td>
                    <td className={`px-4 py-2 text-right ${d.inStock < 8 ? 'text-amber-400' : 'text-muted-foreground'}`}>{d.inStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No devices match.</div>}
          </div>
        </div>

        {/* Detail */}
        {selected && (
          <div className="w-80 shrink-0 bg-background overflow-auto">
            <div className="p-5">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{selected.category}</div>
              <h2 className="text-xl font-medium mt-1 leading-tight">{selected.mfr} {selected.name}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{selected.model}</p>
              <p className="text-sm text-muted-foreground mt-4">{selected.blurb}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unit price</div>
                  <div className="text-lg font-medium mt-0.5">${selected.price.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">In stock</div>
                  <div className="text-lg font-medium mt-0.5">{selected.inStock}</div>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Specifications</div>
                <dl className="space-y-1.5">
                  {Object.entries(selected.specs).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-xs border-b border-border/50 pb-1.5">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="mt-6 space-y-2">
                <Button className="w-full" size="sm">Add to project</Button>
                <Button className="w-full" size="sm" variant="ghost">Download cut sheet</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
