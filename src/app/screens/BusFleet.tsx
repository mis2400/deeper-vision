// Bus Security Designer — Fleet Dashboard
//
// Lists every bus on the project. Each card is the bus tag + type +
// camera count + DVR + readiness flags + per-card actions. Add-bus
// opens a 3-step wizard before navigating into the per-bus designer.

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Plus, ChevronRight, Trash2, Copy, AlertTriangle, CheckCircle2, Bus as BusIcon } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type { Bus, BusType } from '../store/types';
import { toast } from 'sonner';

const BUS_TYPE_LABEL: Record<BusType, string> = {
  'type-a': 'Type A',
  'type-c': 'Type C',
  'type-d': 'Type D',
  'transit': 'Transit',
  'activity': 'Activity',
  'special-needs': 'Special-needs',
  'van': 'Van',
};

export function BusFleet() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();
  const projectName = useProjectStore((s) => s.projects[projectId]?.name ?? 'Project');
  const busesMap = useProjectStore((s) => s.buses);
  const cams = useProjectStore((s) => s.busCameras);
  const dvrs = useProjectStore((s) => s.busDVRs);
  const addBus = useProjectStore((s) => s.addBus);
  const removeBus = useProjectStore((s) => s.removeBus);
  const seedBusCommissioning = useProjectStore((s) => s.seedBusCommissioning);

  const buses = useMemo(() => Object.values(busesMap).filter((b) => b.projectId === projectId), [busesMap, projectId]);
  // No-op reference to keep the dep arrays stable across renders for the
  // map-derived counts inside each card.
  void cams; void dvrs;
  const [wizardOpen, setWizardOpen] = useState(false);

  const seedSample = () => {
    const ids = ['37', '41', '78', '102'];
    const types: BusType[] = ['type-c', 'type-d', 'type-c', 'special-needs'];
    ids.forEach((tag, i) => {
      const id = `bus-${Date.now().toString(36).slice(-4)}-${tag}`;
      const bus: Bus = {
        id, projectId, busTag: tag,
        year: 2022 - i, make: ['Blue Bird', 'IC Bus', 'Thomas', 'Collins'][i],
        model: ['Vision', 'CE', 'C2', 'Bantam'][i],
        busType: types[i],
        capacity: [72, 78, 65, 24][i],
        hasWheelchairLift: i === 3,
        hasStopArm: i < 3,
        voltage: '12V',
        retentionTargetDays: 30,
        cellularRequired: true,
        wifiOffload: true,
        status: 'draft',
      };
      addBus(bus);
      seedBusCommissioning(id);
    });
    toast.success('Loaded 4 sample buses');
  };

  return (
    <AppShell
      crumbs={[
        { label: 'Projects', to: '/projects' },
        { label: projectName, to: `/project/${projectId}` },
        { label: 'Bus Security Designer' },
      ]}
      title="Bus Security Designer"
      subtitle="Fleet camera, DVR, GPS, and event-button engineering — per bus"
      actions={
        <div className="flex items-center gap-2">
          {buses.length === 0 && (
            <Button size="sm" variant="outline" onClick={seedSample}>Load sample fleet</Button>
          )}
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />Add bus
          </Button>
        </div>
      }
    >
      <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-4">

        {/* Banner */}
        <div className="bg-primary/5 border border-primary/30 rounded-lg px-4 py-3 text-[11px] text-foreground/90 flex items-start gap-2.5">
          <BusIcon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <strong className="text-foreground">Fleet security infrastructure planning.</strong> Design
            mobile DVR coverage, exterior + interior cameras, power, cellular / Wi-Fi offload, and
            commissioning checks per bus. Generates per-bus + fleet-wide BOM.
          </div>
        </div>

        {buses.length === 0 ? (
          <EmptyState onCreate={() => setWizardOpen(true)} onSeed={seedSample} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {buses.map((b) => {
              const busCams = Object.values(cams).filter((c) => c.busId === b.id);
              const busDvrs = Object.values(dvrs).filter((d) => d.busId === b.id);
              const dvr = busDvrs[0];
              const channelGap = dvr ? busCams.length - dvr.channels : 0;
              const hasStopArmCam = busCams.some((c) => c.location === 'stop-arm');
              const hasGpsRequired = b.cellularRequired && !(dvr?.gps);
              const flags: { text: string; tone: string }[] = [];
              if (channelGap > 0) flags.push({ text: `${channelGap} cameras over DVR capacity`, tone: '#E5484D' });
              if (b.hasStopArm && !hasStopArmCam) flags.push({ text: 'No stop-arm camera', tone: '#E5A23A' });
              if (hasGpsRequired) flags.push({ text: 'GPS required but missing', tone: '#E5A23A' });
              if (b.hasWheelchairLift && !busCams.some((c) => c.location === 'wheelchair-lift')) flags.push({ text: 'No wheelchair-lift coverage', tone: '#E5A23A' });
              return (
                <div key={b.id} className="bg-card border border-border rounded-lg overflow-hidden hover:border-border-strong transition-colors flex flex-col">
                  <button onClick={() => nav(`/project/${projectId}/bus/${b.id}`)} className="text-left px-4 pt-4 pb-3 flex items-start gap-3 hover:bg-secondary/30 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <BusIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium text-foreground tracking-tight">Bus {b.busTag}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {BUS_TYPE_LABEL[b.busType]}{b.year ? ` · ${b.year}` : ''}{b.make ? ` · ${b.make}` : ''}{b.model ? ` ${b.model}` : ''}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>

                  <div className="px-4 pt-1 pb-3 grid grid-cols-3 gap-3 text-[11px] border-t border-border/60">
                    <div>
                      <div className="uppercase tracking-wider text-muted-foreground/80 text-[9.5px]">Cameras</div>
                      <div className="font-medium tabular-nums text-foreground">{busCams.length}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider text-muted-foreground/80 text-[9.5px]">DVR</div>
                      <div className="font-medium tabular-nums text-foreground">{dvr ? `${dvr.model.slice(0, 8)}…` : '—'}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider text-muted-foreground/80 text-[9.5px]">Status</div>
                      <div className="font-medium tabular-nums capitalize text-foreground">{b.status}</div>
                    </div>
                  </div>

                  {flags.slice(0, 2).map((f) => (
                    <div key={f.text} className="px-4 pb-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: f.tone }} />
                      <span className="truncate">{f.text}</span>
                    </div>
                  ))}
                  {flags.length === 0 && (
                    <div className="px-4 pb-2 text-[11px] text-success flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 shrink-0" /> Design clears basic checks
                    </div>
                  )}

                  <div className="px-3 py-2 border-t border-border/60 flex items-center gap-1 mt-auto">
                    <button onClick={() => nav(`/project/${projectId}/bus/${b.id}`)} className="text-[11px] px-2 h-7 rounded hover:bg-secondary/50 text-foreground">Open</button>
                    <button
                      onClick={() => {
                        const id = `bus-${Date.now().toString(36).slice(-5)}`;
                        addBus({ ...b, id, busTag: `${b.busTag}-copy` });
                        seedBusCommissioning(id);
                        toast.success(`Duplicated · Bus ${b.busTag}`);
                      }}
                      className="text-[11px] px-2 h-7 rounded hover:bg-secondary/50 text-muted-foreground"
                    >
                      <Copy className="w-3.5 h-3.5 inline -mt-0.5" /> Duplicate
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete bus ${b.busTag}? Cascade removes cameras + DVR + checks.`)) { removeBus(b.id); toast.message(`Removed · Bus ${b.busTag}`); } }}
                      className="ml-auto text-[11px] px-2 h-7 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {wizardOpen && (
        <AddBusWizard
          projectId={projectId}
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => { setWizardOpen(false); nav(`/project/${projectId}/bus/${id}`); }}
        />
      )}
    </AppShell>
  );
}

function EmptyState({ onCreate, onSeed }: { onCreate: () => void; onSeed: () => void }) {
  return (
    <div className="border-2 border-dashed border-border rounded-lg p-10 text-center bg-card/40">
      <BusIcon className="w-8 h-8 text-primary mx-auto mb-3" />
      <div className="text-[15px] font-medium tracking-tight text-foreground">No buses in this fleet yet</div>
      <div className="text-[12px] text-muted-foreground mt-1.5 max-w-md mx-auto leading-snug">
        Add a bus to start designing its camera coverage, DVR channel binding, power,
        and event-button wiring. Each bus rolls up into the fleet BOM.
      </div>
      <div className="mt-5 flex items-center justify-center gap-2">
        <Button size="sm" onClick={onCreate}><Plus className="w-3.5 h-3.5 mr-1" />Add bus</Button>
        <Button size="sm" variant="outline" onClick={onSeed}>Load sample fleet</Button>
      </div>
    </div>
  );
}

function AddBusWizard({ projectId, onClose, onCreated }: {
  projectId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const addBus = useProjectStore((s) => s.addBus);
  const seedBusCommissioning = useProjectStore((s) => s.seedBusCommissioning);

  const [step, setStep] = useState(1);
  const [busTag, setBusTag] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [busType, setBusType] = useState<BusType>('type-c');
  const [capacity, setCapacity] = useState<number | ''>('');
  const [hasWheelchairLift, setHasWheelchairLift] = useState(false);
  const [hasStopArm, setHasStopArm] = useState(true);
  const [voltage, setVoltage] = useState<'12V' | '24V'>('12V');
  const [retentionTargetDays, setRetentionTargetDays] = useState(30);
  const [cellularRequired, setCellularRequired] = useState(true);
  const [wifiOffload, setWifiOffload] = useState(true);

  const submit = () => {
    if (!busTag.trim()) { toast.warning('Bus tag is required'); return; }
    const id = `bus-${Date.now().toString(36).slice(-6)}`;
    const bus: Bus = {
      id, projectId,
      busTag: busTag.trim(),
      year: typeof year === 'number' ? year : undefined,
      make: make.trim() || undefined, model: model.trim() || undefined,
      busType,
      capacity: typeof capacity === 'number' ? capacity : undefined,
      hasWheelchairLift, hasStopArm,
      voltage, retentionTargetDays,
      cellularRequired, wifiOffload,
      status: 'draft',
    };
    addBus(bus);
    seedBusCommissioning(id);
    toast.success(`Added · Bus ${bus.busTag}`);
    onCreated(id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[560px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-center gap-2">
          <BusIcon className="w-4 h-4 text-primary" />
          <div className="flex-1">
            <div className="text-[14.5px] font-medium tracking-tight text-foreground">Add bus</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Step {step} of 3 · {['Vehicle', 'Features', 'Operations'][step - 1]}</div>
          </div>
        </div>

        <div className="px-5 py-5 space-y-3 min-h-[260px] text-foreground">
          {step === 1 && (
            <>
              <Field label="Bus tag (district id)">
                <input value={busTag} onChange={(e) => setBusTag(e.target.value)} placeholder="78" className="dv-input" />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Year">
                  <input type="number" value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')} placeholder="2022" className="dv-input" />
                </Field>
                <Field label="Make">
                  <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Blue Bird" className="dv-input" />
                </Field>
                <Field label="Model">
                  <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Vision" className="dv-input" />
                </Field>
              </div>
              <Field label="Bus type">
                <select value={busType} onChange={(e) => setBusType(e.target.value as BusType)} className="dv-input">
                  {(Object.keys(BUS_TYPE_LABEL) as BusType[]).map((t) => (
                    <option key={t} value={t}>{BUS_TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Seating capacity">
                <input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value ? Number(e.target.value) : '')} placeholder="72" className="dv-input" />
              </Field>
            </>
          )}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Toggle label="Wheelchair lift" checked={hasWheelchairLift} onChange={setHasWheelchairLift} />
                <Toggle label="Stop arm" checked={hasStopArm} onChange={setHasStopArm} />
              </div>
              <Field label="Electrical voltage">
                <select value={voltage} onChange={(e) => setVoltage(e.target.value as '12V' | '24V')} className="dv-input">
                  <option value="12V">12 V</option>
                  <option value="24V">24 V</option>
                </select>
              </Field>
            </>
          )}
          {step === 3 && (
            <>
              <Field label="Retention target (days)">
                <input type="number" min={1} max={365} value={retentionTargetDays} onChange={(e) => setRetentionTargetDays(Number(e.target.value || 30))} className="dv-input" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Toggle label="Cellular required" checked={cellularRequired} onChange={setCellularRequired} />
                <Toggle label="Wi-Fi offload (depot)" checked={wifiOffload} onChange={setWifiOffload} />
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <button onClick={onClose} className="text-[12px] px-3 h-8 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50">Cancel</button>
          <div className="flex items-center gap-2">
            {step > 1 && <button onClick={() => setStep((n) => n - 1)} className="text-[12px] px-3 h-8 rounded border border-border hover:bg-secondary/50">Back</button>}
            {step < 3
              ? <Button size="sm" onClick={() => setStep((n) => n + 1)}>Next</Button>
              : <Button size="sm" onClick={submit}>Add bus</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`text-left px-3 py-2 rounded border transition-colors flex items-center gap-2 ${checked ? 'border-primary/60 bg-primary/10' : 'border-border hover:border-border-strong'}`}
    >
      <span className={`w-3 h-3 rounded-sm border ${checked ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
        {checked && <span className="block w-1.5 h-1.5 bg-primary-foreground rounded-sm m-0.5" />}
      </span>
      <span className="text-[12px] text-foreground">{label}</span>
    </button>
  );
}
