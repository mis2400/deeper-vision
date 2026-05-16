// Threat Drill Simulator — Scenario Library
//
// Lists every scenario for the active project. Each card carries the
// readiness score, unresolved gap count, last-simulated timestamp, and
// per-card actions (Open / Duplicate / Export / Delete). Create-new
// flows through a 5-step wizard before navigating into the editor.

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import {
  ShieldAlert, Plus, ChevronRight, Copy, FileDown, Trash2, AlertTriangle,
  CheckCircle2, Clock, Layers,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type { Scenario, ScenarioType, ProtocolStep, ScenarioProtocol, ScenarioZone, ScenarioRun } from '../store/types';
import { toast } from 'sonner';

const SCENARIO_TYPE_LABEL: Record<ScenarioType, string> = {
  'lockdown-drill':       'Lockdown drill',
  'shelter-in-place':     'Shelter-in-place',
  'secure-perimeter':     'Secure perimeter',
  'unauthorized-entry':   'Unauthorized entry',
  'forced-door-event':    'Forced-door event',
  'panic-button-event':   'Panic button event',
  'bus-loop-emergency':   'Bus-loop emergency',
  'after-hours-intrusion':'After-hours intrusion',
};

function defaultProtocol(): ScenarioProtocol {
  return { version: 'draft-1', source: 'manual', steps: [] };
}

export function ThreatDrillLibrary() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();
  const projectName = useProjectStore((s) => s.projects[projectId]?.name ?? 'Project');
  const scenariosMap = useProjectStore((s) => s.scenarios);
  const addScenario = useProjectStore((s) => s.addScenario);
  const removeScenario = useProjectStore((s) => s.removeScenario);
  const recomputeScenario = useProjectStore((s) => s.recomputeScenario);
  const seedDemoScenarios = useSeedDemoScenarios(projectId);

  const scenarios = useMemo(
    () => Object.values(scenariosMap).filter((s) => s.projectId === projectId),
    [scenariosMap, projectId],
  );

  const [wizardOpen, setWizardOpen] = useState(false);

  const handleDuplicate = (sc: Scenario) => {
    const id = `scn-${Date.now().toString(36).slice(-6)}`;
    addScenario({ ...sc, id, name: `${sc.name} copy`, lastSimulatedAt: undefined });
    toast.success(`Duplicated · ${sc.name}`);
  };

  const handleDelete = (sc: Scenario) => {
    if (!confirm(`Delete scenario "${sc.name}"? This cannot be undone.`)) return;
    removeScenario(sc.id);
    toast.message(`Removed · ${sc.name}`);
  };

  const handleExport = async (sc: Scenario) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      drawScenarioReport(doc, sc);
      doc.save(`${sc.projectId}-drill-${sc.id}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`Exported · ${sc.name}`);
    } catch (e) {
      console.error(e);
      toast.error('Export failed');
    }
  };

  return (
    <AppShell
      crumbs={[
        { label: 'Projects', to: '/projects' },
        { label: projectName, to: `/project/${projectId}` },
        { label: 'Threat Drill Simulator' },
      ]}
      title="Threat Drill Simulator"
      subtitle="Defensive lockdown, accountability, and protocol readiness planning"
      actions={
        <div className="flex items-center gap-2">
          {scenarios.length === 0 && (
            <Button size="sm" variant="outline" onClick={seedDemoScenarios}>
              Load sample scenarios
            </Button>
          )}
          <Button size="sm" onClick={() => setWizardOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />New scenario
          </Button>
        </div>
      }
    >
      <div className="max-w-[1280px] mx-auto px-6 py-6 space-y-4">

        {/* Honesty + framing banner */}
        <div className="bg-primary/5 border border-primary/30 rounded-lg px-4 py-3 text-[11.5px] text-foreground/90 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <strong className="text-foreground">Defensive planning module.</strong> Scenarios validate
            lockdown response, accountability procedures, and protocol coverage against the engineered
            infrastructure. No attacker tactics are modeled or recommended.
          </div>
        </div>

        {scenarios.length === 0 ? (
          <EmptyState onCreate={() => setWizardOpen(true)} onSeed={seedDemoScenarios} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {scenarios.map((sc) => (
              <ScenarioCard
                key={sc.id}
                sc={sc}
                onOpen={() => nav(`/project/${projectId}/drill/${sc.id}`)}
                onDuplicate={() => handleDuplicate(sc)}
                onDelete={() => handleDelete(sc)}
                onExport={() => handleExport(sc)}
                onRecompute={() => { recomputeScenario(sc.id); toast.message('Recomputed gaps + readiness'); }}
              />
            ))}
          </div>
        )}
      </div>

      {wizardOpen && (
        <ScenarioWizard
          projectId={projectId}
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => { setWizardOpen(false); nav(`/project/${projectId}/drill/${id}`); }}
        />
      )}
    </AppShell>
  );
}

// ────────────────────────────────────────────────────────────────────

function ScenarioCard({ sc, onOpen, onDuplicate, onDelete, onExport, onRecompute }: {
  sc: Scenario;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
  onRecompute: () => void;
}) {
  const highGaps = sc.gaps.filter((g) => g.severity === 'high').length;
  const medGaps = sc.gaps.filter((g) => g.severity === 'med').length;
  const score = sc.readinessScore ?? null;
  const scoreTone = score == null ? '#94A3B8' : score >= 80 ? '#2EA66B' : score >= 55 ? '#E5A23A' : '#E5484D';
  const ago = sc.lastSimulatedAt
    ? new Date(sc.lastSimulatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:border-border-strong transition-colors flex flex-col">
      <button
        onClick={onOpen}
        className="text-left px-4 pt-4 pb-3 flex items-start gap-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium leading-tight text-foreground truncate">{sc.name}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {SCENARIO_TYPE_LABEL[sc.type]} · protocol {sc.protocol.version}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      <div className="px-4 pt-1 pb-3 grid grid-cols-3 gap-3 text-[11px] border-t border-border/60">
        <div>
          <div className="uppercase tracking-wider text-muted-foreground/80 text-[9.5px]">Readiness</div>
          <div className="font-medium tabular-nums" style={{ color: scoreTone }}>
            {score == null ? '— · run' : `${score}/100`}
          </div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-muted-foreground/80 text-[9.5px]">Gaps</div>
          <div className="font-medium tabular-nums">
            {highGaps > 0 && <span className="text-destructive">{highGaps}</span>}
            {highGaps > 0 && medGaps > 0 && <span className="text-muted-foreground">·</span>}
            {medGaps > 0 && <span className="text-warning">{medGaps}</span>}
            {highGaps + medGaps === 0 && <span className="text-success">none</span>}
          </div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-muted-foreground/80 text-[9.5px]">Last run</div>
          <div className="font-medium tabular-nums text-foreground/90">{ago}</div>
        </div>
      </div>

      {sc.gaps.slice(0, 2).map((g) => (
        <div key={g.id} className="px-4 pb-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: g.severity === 'high' ? '#E5484D' : '#E5A23A' }} />
          <span className="truncate">{g.label}</span>
        </div>
      ))}

      <div className="px-3 py-2 border-t border-border/60 flex items-center gap-1 mt-auto">
        <button onClick={onOpen} className="text-[11px] px-2 h-7 rounded hover:bg-secondary/50 text-foreground">Open</button>
        <button onClick={onRecompute} className="text-[11px] px-2 h-7 rounded hover:bg-secondary/50 text-muted-foreground" title="Recompute gaps + readiness">
          <CheckCircle2 className="w-3.5 h-3.5 inline -mt-0.5" /> Run
        </button>
        <button onClick={onDuplicate} className="text-[11px] px-2 h-7 rounded hover:bg-secondary/50 text-muted-foreground">
          <Copy className="w-3.5 h-3.5 inline -mt-0.5" /> Duplicate
        </button>
        <button onClick={onExport} className="text-[11px] px-2 h-7 rounded hover:bg-secondary/50 text-muted-foreground">
          <FileDown className="w-3.5 h-3.5 inline -mt-0.5" /> Export
        </button>
        <button onClick={onDelete} className="ml-auto text-[11px] px-2 h-7 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onCreate, onSeed }: { onCreate: () => void; onSeed: () => void }) {
  return (
    <div className="border-2 border-dashed border-border rounded-lg p-10 text-center bg-card/40">
      <ShieldAlert className="w-8 h-8 text-primary mx-auto mb-3" />
      <div className="text-[15px] font-medium tracking-tight text-foreground">No scenarios yet</div>
      <div className="text-[12px] text-muted-foreground mt-1.5 max-w-md mx-auto leading-snug">
        Start by drafting a scenario for an existing protocol — a lockdown drill, a shelter-in-place,
        or a perimeter event. The simulator scores readiness against the engineered devices on your canvas.
      </div>
      <div className="mt-5 flex items-center justify-center gap-2">
        <Button size="sm" onClick={onCreate}><Plus className="w-3.5 h-3.5 mr-1" />New scenario</Button>
        <Button size="sm" variant="outline" onClick={onSeed}>Load sample scenarios</Button>
      </div>
    </div>
  );
}

// ─── Scenario wizard ────────────────────────────────────────────────

function ScenarioWizard({ projectId, onClose, onCreated }: {
  projectId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const addScenario = useProjectStore((s) => s.addScenario);
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ScenarioType>('lockdown-drill');
  const [name, setName] = useState('');
  const [campus, setCampus] = useState('');
  const [occupancy, setOccupancy] = useState<number | ''>('');
  const [objective, setObjective] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<Scenario['timeOfDay']>('morning');
  const [assumptions, setAssumptions] = useState('All exterior doors locked. Front office staffed.');
  const [protocolSource, setProtocolSource] = useState<'manual' | 'ai-draft'>('ai-draft');

  const submit = () => {
    const id = `scn-${Date.now().toString(36).slice(-6)}`;
    const finalName = name.trim() || `${SCENARIO_TYPE_LABEL[type]} · ${new Date().toLocaleDateString()}`;
    const protocol: ScenarioProtocol = protocolSource === 'ai-draft'
      ? { version: 'ai-draft-1', source: 'ai-draft', steps: aiDraftSteps(type) }
      : defaultProtocol();
    const sc: Scenario = {
      id, projectId, name: finalName, type, campus,
      occupancy: typeof occupancy === 'number' ? occupancy : undefined,
      timeOfDay, objective: objective.trim() || undefined,
      assumptions: assumptions.trim() || undefined,
      protocol,
      zones: [],
      runs: [],
      gaps: [],
      versionLabel: 'draft-1',
    };
    addScenario(sc);
    toast.success(`Scenario created · ${finalName}`);
    onCreated(id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center px-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[560px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <div className="flex-1">
            <div className="text-[14.5px] font-medium tracking-tight text-foreground">New drill scenario</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Step {step} of 5 · {['Type', 'Location', 'Protocol', 'Rules', 'Review'][step - 1]}</div>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4 min-h-[260px] text-foreground">
          {step === 1 && (
            <>
              <FormLabel>Scenario type</FormLabel>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(SCENARIO_TYPE_LABEL) as ScenarioType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`text-left text-[12px] px-3 py-2 rounded border transition-colors ${type === t ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border hover:border-border-strong text-muted-foreground hover:text-foreground'}`}
                  >
                    {SCENARIO_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <Field label="Scenario name (optional)">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${SCENARIO_TYPE_LABEL[type]} — Admin Building`} className="dv-input" />
              </Field>
              <Field label="Campus / building / floor descriptor">
                <input value={campus} onChange={(e) => setCampus(e.target.value)} placeholder="Lincoln HS · Bldg A · Ground" className="dv-input" />
              </Field>
              <Field label="Estimated occupancy in scope">
                <input type="number" min={0} value={occupancy} onChange={(e) => setOccupancy(e.target.value ? Number(e.target.value) : '')} placeholder="450" className="dv-input" />
              </Field>
            </>
          )}
          {step === 3 && (
            <>
              <FormLabel>Protocol source</FormLabel>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setProtocolSource('ai-draft')}
                  className={`text-left text-[12px] px-3 py-3 rounded border transition-colors ${protocolSource === 'ai-draft' ? 'border-primary/60 bg-primary/10' : 'border-border hover:border-border-strong'}`}
                >
                  <div className="font-medium text-foreground">AI-draft starter</div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5">Generates a baseline lockdown / accountability protocol you can edit.</div>
                </button>
                <button
                  onClick={() => setProtocolSource('manual')}
                  className={`text-left text-[12px] px-3 py-3 rounded border transition-colors ${protocolSource === 'manual' ? 'border-primary/60 bg-primary/10' : 'border-border hover:border-border-strong'}`}
                >
                  <div className="font-medium text-foreground">Empty · build manually</div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5">Start from a blank protocol. Add steps in the editor.</div>
                </button>
              </div>
              <div className="text-[10.5px] text-muted-foreground/80 pt-2 border-t border-border/60">
                Upload (PDF / DOCX / TXT) is available inside the scenario editor.
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <Field label="Drill objective">
                <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Validate ground-floor lockdown sequence + reunification path" className="dv-input" />
              </Field>
              <Field label="Time of day">
                <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value as Scenario['timeOfDay'])} className="dv-input">
                  <option value="pre-school">Pre-school (before bell)</option>
                  <option value="morning">Morning (08:00–11:00)</option>
                  <option value="midday">Midday (11:00–13:00)</option>
                  <option value="afternoon">Afternoon (13:00–15:30)</option>
                  <option value="after-school">After-school</option>
                  <option value="evening">Evening</option>
                  <option value="overnight">Overnight</option>
                </select>
              </Field>
              <Field label="Operational assumptions">
                <textarea value={assumptions} onChange={(e) => setAssumptions(e.target.value)} rows={3} className="dv-input" />
              </Field>
            </>
          )}
          {step === 5 && (
            <div className="text-[12px] text-muted-foreground space-y-1">
              <Review label="Type"        value={SCENARIO_TYPE_LABEL[type]} />
              <Review label="Name"        value={name || `${SCENARIO_TYPE_LABEL[type]} — ${new Date().toLocaleDateString()}`} />
              <Review label="Location"    value={campus || '—'} />
              <Review label="Occupancy"   value={String(occupancy || '—')} />
              <Review label="Time of day" value={timeOfDay ?? '—'} />
              <Review label="Objective"   value={objective || '—'} />
              <Review label="Protocol"    value={protocolSource === 'ai-draft' ? 'AI-draft starter' : 'Empty · build manually'} />
              <Review label="Assumptions" value={assumptions || '—'} />
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between">
          <button onClick={onClose} className="text-[12px] px-3 h-8 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/50">Cancel</button>
          <div className="flex items-center gap-2">
            {step > 1 && <button onClick={() => setStep((n) => n - 1)} className="text-[12px] px-3 h-8 rounded border border-border hover:bg-secondary/50">Back</button>}
            {step < 5
              ? <Button size="sm" onClick={() => setStep((n) => n + 1)}>Next</Button>
              : <Button size="sm" onClick={submit}>Create scenario</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormLabel({ children }: { children: any }) {
  return <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-1.5">{children}</div>;
}
function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <FormLabel>{label}</FormLabel>
      {children}
    </label>
  );
}
function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/60 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground tabular-nums max-w-[60%] text-right">{value}</span>
    </div>
  );
}

// ─── AI draft (rule-based seed) ─────────────────────────────────────

function aiDraftSteps(type: ScenarioType): ProtocolStep[] {
  const base: Array<Omit<ProtocolStep, 'id'>> = [];
  if (type === 'lockdown-drill' || type === 'unauthorized-entry' || type === 'forced-door-event') {
    base.push(
      { section: 'lockdown-triggers',      text: 'Lockdown initiated via key-fob, panic button, or PA command.', mappedDeviceIds: [], owner: 'Front-office staff' },
      { section: 'communication-tree',     text: 'Notify SRO → Principal → District security ops → 911.', mappedDeviceIds: [] },
      { section: 'pa-announcements',       text: 'Announce: "LOCKDOWN — secure your room, lights off, away from doors."', mappedDeviceIds: [], owner: 'PA operator' },
      { section: 'classroom-response',     text: 'Lock door, cover window, gather students in safe area, take attendance.', mappedDeviceIds: [], owner: 'Teacher' },
      { section: 'common-area-response',   text: 'Move occupants to nearest classroom or safe room within 90 s.', mappedDeviceIds: [] },
      { section: 'student-accountability', text: 'Each teacher reports attendance via designated channel within 5 min.', mappedDeviceIds: [] },
      { section: 'all-clear',              text: 'PA "All-clear" announced only by SRO or designee with verified channel.', mappedDeviceIds: [] },
      { section: 'after-action',           text: 'Debrief within 24 h. Log gaps, file with district safety officer.', mappedDeviceIds: [] },
    );
  } else if (type === 'shelter-in-place') {
    base.push(
      { section: 'lockdown-triggers',      text: 'Weather / hazmat shelter triggered by district alert or PA command.', mappedDeviceIds: [] },
      { section: 'pa-announcements',       text: 'Announce: "SHELTER-IN-PLACE — move to designated interior areas."', mappedDeviceIds: [], owner: 'PA operator' },
      { section: 'common-area-response',   text: 'Occupants relocate to safe rooms; HVAC isolation initiated.', mappedDeviceIds: [] },
      { section: 'student-accountability', text: 'Roster check by safe-room owner within 10 min.', mappedDeviceIds: [] },
      { section: 'all-clear',              text: 'All-clear issued after district + AHJ confirmation.', mappedDeviceIds: [] },
    );
  } else if (type === 'secure-perimeter' || type === 'after-hours-intrusion') {
    base.push(
      { section: 'lockdown-triggers',      text: 'Perimeter alarm or after-hours motion event triggers automatic lockdown.', mappedDeviceIds: [] },
      { section: 'communication-tree',     text: 'Auto-page to district ops + SRO + responding agency.', mappedDeviceIds: [] },
      { section: 'common-area-response',   text: 'All exterior doors auto-lock; interior doors prompted to secure.', mappedDeviceIds: [] },
      { section: 'all-clear',              text: 'Manual all-clear after physical verification by SRO.', mappedDeviceIds: [] },
    );
  } else if (type === 'bus-loop-emergency') {
    base.push(
      { section: 'lockdown-triggers',      text: 'Bus driver / monitor activates panic — buses re-routed away from loop.', mappedDeviceIds: [] },
      { section: 'pa-announcements',       text: 'Announce on bus-loop PA: "Hold inside building; do not enter loop."', mappedDeviceIds: [] },
      { section: 'common-area-response',   text: 'Loop-exit cameras tagged; LPR feed pulled for incident.', mappedDeviceIds: [] },
      { section: 'reunification',          text: 'Reunification redirected to indoor designated zone, not bus loop.', mappedDeviceIds: [] },
    );
  } else {
    base.push(
      { section: 'lockdown-triggers',      text: 'Manual trigger only — review readiness for automation.', mappedDeviceIds: [] },
      { section: 'all-clear',              text: 'Verified all-clear procedure to be defined by site.', mappedDeviceIds: [] },
    );
  }
  return base.map((b, i) => ({ ...b, id: `step-${Date.now().toString(36).slice(-4)}-${i}` }));
}

// ─── Sample scenario seeding ────────────────────────────────────────

function useSeedDemoScenarios(projectId: string) {
  const addScenario = useProjectStore((s) => s.addScenario);
  return () => {
    const samples: Array<Pick<Scenario, 'type' | 'name'> & { occupancy?: number; campus?: string }> = [
      { type: 'lockdown-drill', name: 'Lockdown Drill — Admin Building', campus: 'Lincoln HS · Admin · Ground', occupancy: 220 },
      { type: 'unauthorized-entry', name: 'Intrusion Event — Main Entry', campus: 'Lincoln HS · Main · 1st', occupancy: 480 },
      { type: 'bus-loop-emergency', name: 'Bus Loop Emergency', campus: 'Lincoln HS · Bus Loop · Exterior', occupancy: 320 },
      { type: 'secure-perimeter', name: 'Perimeter Breach — West Gate', campus: 'Lincoln HS · West · Exterior', occupancy: 50 },
      { type: 'shelter-in-place', name: 'Shelter-in-Place — Science Wing', campus: 'Lincoln HS · Science · 2nd', occupancy: 180 },
    ];
    for (const s of samples) {
      const id = `scn-${Date.now().toString(36).slice(-4)}-${s.name.slice(0, 6).replace(/\W+/g, '')}`;
      addScenario({
        id, projectId,
        name: s.name, type: s.type,
        campus: s.campus, occupancy: s.occupancy,
        timeOfDay: 'morning', objective: 'Validate engineered response',
        protocol: { version: 'ai-draft-1', source: 'ai-draft', steps: aiDraftSteps(s.type) },
        zones: [], runs: [], gaps: [],
        versionLabel: 'draft-1',
      });
    }
    toast.success('Loaded 5 sample scenarios');
  };
}

// ─── PDF export shared by library + editor ──────────────────────────

export function drawScenarioReport(doc: any, sc: Scenario) {
  // Cover
  doc.setFillColor(31, 39, 56); doc.rect(0, 0, 612, 792, 'F');
  doc.setFillColor(82, 146, 220); doc.rect(0, 0, 612, 6, 'F');
  doc.setTextColor(238, 241, 247);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(28);
  doc.text('Drill Simulation Report', 56, 220);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(14);
  doc.text(sc.name, 56, 250);
  doc.setFontSize(11); doc.setTextColor(168, 178, 200);
  doc.text(`Scenario type · ${SCENARIO_TYPE_LABEL[sc.type]}`, 56, 270);
  if (sc.campus) doc.text(`Location · ${sc.campus}`, 56, 286);
  doc.text(`Protocol · ${sc.protocol.version} · ${sc.protocol.steps.length} steps`, 56, 302);
  doc.text(`Readiness · ${sc.readinessScore ?? '—'}/100`, 56, 318);
  doc.text(`Generated · ${new Date().toLocaleString()}`, 56, 334);
  doc.setFontSize(9); doc.setTextColor(120, 134, 162);
  doc.text('Deeper Vision · Defensive readiness planning', 56, 760);
  doc.text('Confidential', 540, 760);

  // Page 2 — Gaps
  doc.addPage();
  doc.setTextColor(31, 39, 56);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('Gaps & recommendations', 56, 64);
  doc.setDrawColor(82, 146, 220); doc.line(56, 72, 556, 72);

  let y = 96;
  if (sc.gaps.length === 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(46, 166, 107);
    doc.text('No unresolved gaps. Scenario passes basic engineering checks.', 56, y);
  } else {
    for (const g of sc.gaps) {
      if (y > 720) { doc.addPage(); y = 64; }
      const sevColor: [number, number, number] = g.severity === 'high' ? [229, 72, 77] : g.severity === 'med' ? [229, 162, 58] : [125, 134, 153];
      doc.setFillColor(...sevColor); doc.rect(56, y - 8, 4, 4, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(31, 39, 56);
      doc.text(g.label, 66, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(80, 90, 110);
      const detailLines = doc.splitTextToSize(g.detail, 480);
      doc.text(detailLines, 66, y + 14);
      y += 14 + detailLines.length * 11;
      if (g.suggestion) {
        doc.setFontSize(9.5); doc.setTextColor(45, 111, 184);
        const sLines = doc.splitTextToSize(`Suggestion: ${g.suggestion}`, 480);
        doc.text(sLines, 66, y);
        y += sLines.length * 11 + 4;
      }
      if (g.estimatedFixCost) {
        doc.setFontSize(9); doc.setTextColor(120, 134, 162);
        doc.text(`Approx. cost to close: $${g.estimatedFixCost.toLocaleString()}`, 66, y);
        y += 12;
      }
      y += 10;
    }
  }

  // Page 3 — Protocol
  doc.addPage();
  doc.setTextColor(31, 39, 56);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('Protocol steps', 56, 64);
  doc.setDrawColor(82, 146, 220); doc.line(56, 72, 556, 72);

  y = 96;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  for (const step of sc.protocol.steps) {
    if (y > 720) { doc.addPage(); y = 64; }
    doc.setTextColor(45, 111, 184); doc.setFontSize(9);
    doc.text(`[${step.section}]`, 56, y);
    doc.setTextColor(31, 39, 56); doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(step.text, 500);
    doc.text(lines, 56, y + 12);
    y += 14 + lines.length * 12 + 4;
  }
}
