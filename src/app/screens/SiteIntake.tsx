import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { ArrowRight, ArrowLeft, Check, Users, Building2, Shield, Scale, FileCheck } from 'lucide-react';

type Step = 'client' | 'site' | 'threat' | 'compliance' | 'review';

const COMPLIANCE = [
  { id: 'hipaa', label: 'HIPAA' }, { id: 'pci', label: 'PCI-DSS' }, { id: 'cjis', label: 'CJIS' },
  { id: 'sox', label: 'SOX' }, { id: 'glba', label: 'GLBA' }, { id: 'nerc', label: 'NERC-CIP' },
  { id: 'fips', label: 'FIPS-201' }, { id: 'ferpa', label: 'FERPA' },
];

const BUILDING_TYPES = ['Office', 'Healthcare', 'K-12 School', 'University', 'Retail', 'Warehouse', 'Data center', 'Government', 'Critical infrastructure', 'Multifamily', 'Hospitality', 'Industrial'];
const THREAT_LEVELS = [
  { id: 'low', label: 'Low' }, { id: 'moderate', label: 'Moderate' }, { id: 'high', label: 'High' }, { id: 'critical', label: 'Critical' },
];

export function SiteIntake() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [step, setStep] = useState<Step>('client');
  const [client, setClient] = useState({ company: '', contact: '', email: '', phone: '' });
  const [site, setSite] = useState({ address: '', city: '', state: '', zip: '', sqft: '', floors: '1', type: '' });
  const [threat, setThreat] = useState({ level: 'moderate', notes: '' });
  const [comp, setComp] = useState<Set<string>>(new Set());
  const [ahj, setAhj] = useState({ jurisdiction: '', permit: true, kickoff: '', target: '' });

  const steps: Array<{ id: Step; label: string; icon: any }> = [
    { id: 'client', label: 'Client', icon: Users },
    { id: 'site', label: 'Site', icon: Building2 },
    { id: 'threat', label: 'Threat', icon: Shield },
    { id: 'compliance', label: 'Compliance', icon: Scale },
    { id: 'review', label: 'Review', icon: FileCheck },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  const finish = () => navigate(`/calibrate/${projectId ?? 'new'}`);

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
