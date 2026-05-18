import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { ArrowRight, ArrowLeft, Check, Users, Building2, Shield, Scale, FileCheck, Hammer } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type { Address, Customer, Industry, Project, Site, Building, Floor, Contact } from '../store/types';

// Map the intake's freeform "building type" picker onto the store's Industry
// enum. Anything we don't recognise falls back to 'other' so the Customer
// record still validates.
const INDUSTRY_BY_BUILDING_TYPE: Record<string, Industry> = {
  'Office': 'commercial_re',
  'Healthcare': 'healthcare',
  'K-12 School': 'education',
  'University': 'education',
  'Retail': 'retail',
  'Warehouse': 'logistics',
  'Data center': 'data_center',
  'Government': 'government',
  'Critical infrastructure': 'other',
  'Multifamily': 'multifamily',
  'Hospitality': 'hospitality',
  'Industrial': 'manufacturing',
};

type Step = 'client' | 'site' | 'scope' | 'threat' | 'compliance' | 'review';

const COMPLIANCE = [
  { id: 'hipaa', label: 'HIPAA' }, { id: 'pci', label: 'PCI-DSS' }, { id: 'cjis', label: 'CJIS' },
  { id: 'sox', label: 'SOX' }, { id: 'glba', label: 'GLBA' }, { id: 'nerc', label: 'NERC-CIP' },
  { id: 'fips', label: 'FIPS-201' }, { id: 'ferpa', label: 'FERPA' },
];

const BUILDING_TYPES = ['Office', 'Healthcare', 'K-12 School', 'University', 'Retail', 'Warehouse', 'Data center', 'Government', 'Critical infrastructure', 'Multifamily', 'Hospitality', 'Industrial'];
const THREAT_LEVELS = [
  { id: 'low', label: 'Low' }, { id: 'moderate', label: 'Moderate' }, { id: 'high', label: 'High' }, { id: 'critical', label: 'Critical' },
];

// V1 4C — Scope step library.
const SCOPE_KINDS: Array<{ id: 'new-build' | 'retrofit' | 'expansion' | 'managed-service-takeover'; label: string; hint: string }> = [
  { id: 'new-build',                 label: 'New build',           hint: 'Greenfield install from intake to handover.' },
  { id: 'retrofit',                  label: 'Retrofit',            hint: 'Replace or upgrade existing infrastructure.' },
  { id: 'expansion',                 label: 'Expansion',           hint: 'Extend coverage into a new floor / building.' },
  { id: 'managed-service-takeover',  label: 'Managed takeover',    hint: 'Inherit + maintain a system someone else installed.' },
];
const EXISTING_SYSTEMS: Array<{ id: 'camera-vms' | 'access-control' | 'intrusion' | 'fire-alarm' | 'network' | 'bas' | 'none'; label: string }> = [
  { id: 'camera-vms',     label: 'Camera VMS' },
  { id: 'access-control', label: 'Access control' },
  { id: 'intrusion',      label: 'Intrusion' },
  { id: 'fire-alarm',     label: 'Fire alarm' },
  { id: 'network',        label: 'Network infrastructure' },
  { id: 'bas',            label: 'Building automation' },
  { id: 'none',           label: 'None / greenfield' },
];
const BUDGETS: Array<{ id: 'under-50k' | '50k-150k' | '150k-500k' | '500k-2m' | 'over-2m'; label: string; midpoint: number }> = [
  { id: 'under-50k',  label: 'Under $50k',     midpoint: 25_000 },
  { id: '50k-150k',   label: '$50k – $150k',   midpoint: 100_000 },
  { id: '150k-500k',  label: '$150k – $500k',  midpoint: 325_000 },
  { id: '500k-2m',    label: '$500k – $2M',    midpoint: 1_250_000 },
  { id: 'over-2m',    label: 'Over $2M',       midpoint: 3_000_000 },
];

export function SiteIntake() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [step, setStep] = useState<Step>('client');
  const [client, setClient] = useState({ company: '', contact: '', email: '', phone: '' });
  const [site, setSite] = useState({ address: '', city: '', state: '', zip: '', sqft: '', floors: '1', type: '' });
  // V1 4C — Scope step state. Kind starts empty so we can tell the
  // difference between "user picked retrofit" and "user skipped the step";
  // downstream defaults must not lie about user input.
  const [scope, setScope] = useState<{ kind: typeof SCOPE_KINDS[number]['id'] | ''; existing: Set<typeof EXISTING_SYSTEMS[number]['id']>; budget: typeof BUDGETS[number]['id'] | '' }>({ kind: '', existing: new Set(), budget: '' });
  const [threat, setThreat] = useState({ level: 'moderate', notes: '' });
  const [comp, setComp] = useState<Set<string>>(new Set());
  const [ahj, setAhj] = useState({ jurisdiction: '', permit: true, kickoff: '', target: '' });

  const steps: Array<{ id: Step; label: string; icon: any }> = [
    { id: 'client',     label: 'Client',     icon: Users },
    { id: 'site',       label: 'Site',       icon: Building2 },
    { id: 'scope',      label: 'Scope',      icon: Hammer },
    { id: 'threat',     label: 'Threat',     icon: Shield },
    { id: 'compliance', label: 'Compliance', icon: Scale },
    { id: 'review',     label: 'Review',     icon: FileCheck },
  ];
  const idx = steps.findIndex((s) => s.id === step);

  const addCustomer = useProjectStore((s) => s.addCustomer);
  const addContact = useProjectStore((s) => s.addContact);
  const addProject = useProjectStore((s) => s.addProject);
  const addSite = useProjectStore((s) => s.addSite);
  const addBuilding = useProjectStore((s) => s.addBuilding);
  const addFloor = useProjectStore((s) => s.addFloor);
  const updateCustomer = useProjectStore((s) => s.updateCustomer);

  // If we were invoked with an existing projectId we just hop straight to
  // calibration without creating duplicate records. The intake screen is only
  // a create flow today; "edit project" is a separate (future) surface.
  const finish = () => {
    if (projectId && projectId !== 'new') {
      navigate(`/calibrate/${projectId}`);
      return;
    }
    try {
      const now = Date.now();
      const suffix = `${now.toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;
      const customerId = `c-${suffix}`;
      const contactId = `ct-${suffix}`;
      const newProjectId = `p-${suffix}`;
      const siteId = `s-${suffix}`;
      const buildingId = `b-${suffix}`;
      const floorId = `f-${suffix}`;

      const address: Address = {
        street: site.address,
        city: site.city,
        state: site.state || undefined,
        postal: site.zip || undefined,
      };
      const customer: Customer = {
        id: customerId,
        companyName: client.company || site.address || 'New customer',
        addresses: [address],
        industry: INDUSTRY_BY_BUILDING_TYPE[site.type],
        primaryContactId: contactId,
        createdAt: now,
        updatedAt: now,
      };
      addCustomer(customer);

      const nameParts = client.contact.trim().split(/\s+/);
      const contact: Contact = {
        id: contactId,
        customerId,
        firstName: nameParts[0] || client.contact || 'Primary',
        lastName: nameParts.slice(1).join(' ') || '',
        email: client.email || undefined,
        phone: client.phone || undefined,
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      };
      addContact(contact);

      // Stamp the customer's primaryContactId now that the contact exists —
      // belt-and-braces in case the customer write landed before the contact.
      updateCustomer(customerId, { primaryContactId: contactId });

      const projectName = client.company
        ? `${client.company}${site.address ? ` — ${site.address}` : ''}`
        : site.address || 'New project';
      const nextAction = ahj.kickoff
        ? `Site walk · kickoff ${ahj.kickoff}`
        : 'Schedule the site walk';
      const dueDate = ahj.target ? new Date(ahj.target).getTime() : undefined;
      // 4C: persist the scope step. budget midpoint seeds contractValue so the
      // pipeline / dashboard show realistic numbers from intake forward. Only
      // write fields the user actually picked — don't fabricate a scopeKind.
      const budgetDef = BUDGETS.find((b) => b.id === scope.budget);
      const existingSystemsArr = scope.existing.size ? Array.from(scope.existing) : undefined;
      const newProject: Project = {
        id: newProjectId,
        name: projectName,
        customerId,
        siteId,
        status: 'design',
        lifecyclePhase: 'survey',
        createdAt: now,
        updatedAt: now,
        phaseStartedAt: now,
        nextAction,
        dueDate: Number.isFinite(dueDate) ? dueDate : undefined,
        healthStatus: 'on_track',
        priority: threat.level === 'critical' || threat.level === 'high' ? 'high' : 'normal',
        progress: 0,
        scopeKind: scope.kind || undefined,
        existingSystems: existingSystemsArr,
        budgetRange: scope.budget || undefined,
        contractValue: budgetDef?.midpoint,
      };
      addProject(newProject);

      const siteAddressLine = [site.address, site.city, site.state, site.zip]
        .filter(Boolean)
        .join(', ');
      const newSite: Site = {
        id: siteId,
        projectId: newProjectId,
        name: site.address || client.company || 'Main Site',
        address: siteAddressLine,
      };
      addSite(newSite);

      const newBuilding: Building = {
        id: buildingId,
        siteId,
        name: 'Main Building',
      };
      addBuilding(newBuilding);

      const newFloor: Floor = {
        id: floorId,
        projectId: newProjectId,
        buildingId,
        name: 'Floor 1',
        level: 0,
        source: 'blank',
        scalePxToFt: 0,
        walls: [],
      };
      addFloor(newFloor);

      toast.success(`Project created: ${projectName}`);
      navigate(`/calibrate/${newProjectId}`);
    } catch (err) {
      console.error('SiteIntake.finish failed', err);
      toast.error('Could not create the project. Check the console.');
    }
  };

  return (
    <AppShell crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'New project' }]} title="Site intake" subtitle={`Step ${idx + 1} of ${steps.length}`}>
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center gap-1 mb-6">
          {steps.map((s, i) => {
            const active = s.id === step;
            const done = i < idx;
            return (
              <button key={s.id} onClick={() => setStep(s.id)} className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${active ? 'bg-primary/15 text-primary' : done ? 'text-foreground hover:bg-secondary' : 'text-muted-foreground hover:bg-secondary'}`}>
                {done ? <Check className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          {step === 'client' && (
            <div className="space-y-3">
              <Field label="Company" value={client.company} onChange={(v) => setClient({ ...client, company: v })} />
              <Field label="Primary contact" value={client.contact} onChange={(v) => setClient({ ...client, contact: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" value={client.email} onChange={(v) => setClient({ ...client, email: v })} />
                <Field label="Phone" value={client.phone} onChange={(v) => setClient({ ...client, phone: v })} />
              </div>
            </div>
          )}
          {step === 'site' && (
            <div className="space-y-3">
              <Field label="Street address" value={site.address} onChange={(v) => setSite({ ...site, address: v })} />
              <div className="grid grid-cols-3 gap-3">
                <Field label="City" value={site.city} onChange={(v) => setSite({ ...site, city: v })} />
                <Field label="State" value={site.state} onChange={(v) => setSite({ ...site, state: v })} />
                <Field label="ZIP" value={site.zip} onChange={(v) => setSite({ ...site, zip: v })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Sq ft" value={site.sqft} onChange={(v) => setSite({ ...site, sqft: v })} />
                <Field label="Floors" value={site.floors} onChange={(v) => setSite({ ...site, floors: v })} />
                <div>
                  <label className="text-xs text-muted-foreground">Building type</label>
                  <select value={site.type} onChange={(e) => setSite({ ...site, type: e.target.value })} className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm">
                    <option value="">Select…</option>
                    {BUILDING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
          {step === 'scope' && (
            <div className="space-y-5">
              <div>
                <label className="text-xs text-muted-foreground">Project type</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {SCOPE_KINDS.map((k) => {
                    const on = scope.kind === k.id;
                    return (
                      <button key={k.id} onClick={() => setScope({ ...scope, kind: k.id })} className={`p-3 rounded-md border text-left transition-colors ${on ? 'border-primary bg-primary/10' : 'border-border hover:border-border-strong'}`}>
                        <div className="text-sm">{k.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{k.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Existing systems on site</label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {EXISTING_SYSTEMS.map((sys) => {
                    const on = scope.existing.has(sys.id);
                    return (
                      <button
                        key={sys.id}
                        onClick={() => {
                          // "None" is mutually exclusive with the other systems.
                          // Toggling none on clears the set first; toggling any
                          // other system on clears none.
                          const next = new Set(scope.existing);
                          if (sys.id === 'none') {
                            if (on) {
                              next.delete('none');
                            } else {
                              next.clear();
                              next.add('none');
                            }
                          } else {
                            next.delete('none');
                            if (on) {
                              next.delete(sys.id);
                            } else {
                              next.add(sys.id);
                            }
                          }
                          setScope({ ...scope, existing: next });
                        }}
                        className={`p-2.5 rounded-md border text-xs transition-colors ${on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-border-strong'}`}
                      >
                        {sys.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Budget range</label>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {BUDGETS.map((b) => {
                    const on = scope.budget === b.id;
                    return (
                      <button key={b.id} onClick={() => setScope({ ...scope, budget: b.id })} className={`p-2.5 rounded-md border text-xs transition-colors ${on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-border-strong'}`}>
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {step === 'threat' && (
            <div className="space-y-3">
              <label className="text-xs text-muted-foreground">Threat level</label>
              <div className="grid grid-cols-4 gap-2">
                {THREAT_LEVELS.map((t) => (
                  <button key={t.id} onClick={() => setThreat({ ...threat, level: t.id })} className={`p-3 rounded-md border text-sm transition-colors ${threat.level === t.id ? 'border-primary bg-primary/10' : 'border-border hover:border-border-strong'}`}>{t.label}</button>
                ))}
              </div>
              <Field label="Notes" textarea value={threat.notes} onChange={(v) => setThreat({ ...threat, notes: v })} />
            </div>
          )}
          {step === 'compliance' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Frameworks (select all that apply)</label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {COMPLIANCE.map((c) => {
                    const on = comp.has(c.id);
                    return (
                      <button key={c.id} onClick={() => { const n = new Set(comp); on ? n.delete(c.id) : n.add(c.id); setComp(n); }} className={`p-2.5 rounded-md border text-xs transition-colors ${on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-border-strong'}`}>{c.label}</button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Authority Having Jurisdiction" value={ahj.jurisdiction} onChange={(v) => setAhj({ ...ahj, jurisdiction: v })} />
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={ahj.permit} onChange={(e) => setAhj({ ...ahj, permit: e.target.checked })} />
                    Permit required
                  </label>
                </div>
                <Field label="Kickoff date" value={ahj.kickoff} onChange={(v) => setAhj({ ...ahj, kickoff: v })} placeholder="2026-05-20" />
                <Field label="Target go-live" value={ahj.target} onChange={(v) => setAhj({ ...ahj, target: v })} placeholder="2026-09-15" />
              </div>
            </div>
          )}
          {step === 'review' && (
            <div className="space-y-3 text-sm">
              <Row label="Client" v={`${client.company || '—'} · ${client.contact || '—'}`} />
              <Row label="Site" v={`${site.address || '—'}, ${site.city || ''} ${site.state || ''} · ${site.sqft || '—'} sq ft`} />
              <Row label="Project type" v={SCOPE_KINDS.find((k) => k.id === scope.kind)?.label || 'Not set'} />
              <Row label="Existing systems" v={scope.existing.size ? Array.from(scope.existing).map((id) => EXISTING_SYSTEMS.find((s) => s.id === id)?.label || id).join(', ') : 'None recorded'} />
              <Row label="Budget" v={BUDGETS.find((b) => b.id === scope.budget)?.label || 'Not set'} />
              <Row label="Threat" v={threat.level} />
              <Row label="Frameworks" v={comp.size ? [...comp].join(', ').toUpperCase() : 'None'} />
              <Row label="AHJ" v={`${ahj.jurisdiction || '—'} · permit ${ahj.permit ? 'required' : 'waived'}`} />
              <Row label="Schedule" v={`Kickoff ${ahj.kickoff || '—'} → Go-live ${ahj.target || '—'}`} />
              <div className="pt-4 flex justify-end">
                <Button onClick={finish}>Create project & calibrate <ArrowRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <Button variant="ghost" disabled={idx === 0} onClick={() => setStep(steps[Math.max(0, idx - 1)].id)}>
            <ArrowLeft className="w-4 h-4 mr-1" />Back
          </Button>
          {step !== 'review' && (
            <Button onClick={() => setStep(steps[Math.min(steps.length - 1, idx + 1)].id)}>
              Continue <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, placeholder, textarea }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm resize-none" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm" />
      )}
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">{label}</span><span>{v}</span></div>;
}
