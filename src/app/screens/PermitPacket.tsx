import { useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Stamp, FileCheck, FileWarning, Download, Send, Check, CheckCircle2 } from 'lucide-react';

interface Doc { id: string; title: string; type: 'drawing' | 'form' | 'spec' | 'cert'; status: 'ready' | 'review' | 'missing'; pages: number; ref?: string; }

const DOCS: Doc[] = [
  { id: 'd1', title: 'E-1.0 · Security Site Plan',     type: 'drawing', status: 'ready',   pages: 1, ref: 'NFPA 731 §6.2' },
  { id: 'd2', title: 'E-1.1 · Camera Coverage Plan',   type: 'drawing', status: 'ready',   pages: 1 },
  { id: 'd3', title: 'E-1.2 · Access Control Riser',   type: 'drawing', status: 'ready',   pages: 1 },
  { id: 'd4', title: 'E-1.3 · Cable Tray & Conduit',   type: 'drawing', status: 'review',  pages: 2 },
  { id: 'd5', title: 'E-2.0 · Single-Line Diagram',    type: 'drawing', status: 'ready',   pages: 1 },
  { id: 'd6', title: 'E-2.1 · Door Hardware Schedule', type: 'drawing', status: 'ready',   pages: 3 },
  { id: 'd7', title: 'AHJ Submittal Form',             type: 'form',    status: 'ready',   pages: 4 },
  { id: 'd8', title: 'Fire Alarm Interface Letter',    type: 'form',    status: 'missing', pages: 1, ref: 'NFPA 72 §21.2.4' },
  { id: 'd9', title: 'Locksmith Spec Sheets',          type: 'spec',    status: 'ready',   pages: 18 },
  { id: 'd10', title: 'UL 294 Certifications',         type: 'cert',    status: 'ready',   pages: 6 },
  { id: 'd11', title: 'UL 2050 Monitoring Cert',       type: 'cert',    status: 'review',  pages: 2 },
  { id: 'd12', title: 'Contractor License',             type: 'cert',    status: 'ready',   pages: 1 },
  { id: 'd13', title: 'Insurance COI',                  type: 'cert',    status: 'ready',   pages: 1 },
  { id: 'd14', title: 'Manufacturer Cut Sheets',        type: 'spec',    status: 'ready',   pages: 42 },
];

const CHECKS = [
  { code: 'NFPA 731 §6.2', label: 'Premises security plan documented', ok: true },
  { code: 'NFPA 72 §21.2', label: 'Fire alarm interface listed & rated', ok: false },
  { code: 'UL 294', label: 'Access controllers listed', ok: true },
  { code: 'UL 2050', label: 'Central station monitoring listed', ok: true },
  { code: 'IBC 1010', label: 'Egress hardware not impeded by maglock', ok: true },
  { code: 'ADA 404', label: 'Reader mounting heights compliant', ok: true },
  { code: 'NEC 725', label: 'Class 2 power-limited cable separation', ok: true },
];

export function PermitPacket() {
  const { projectId = 'p1' } = useParams();
  const [stamp, setStamp] = useState({ engineer: 'Casey Pham, PE', license: 'TX-EE-118472', date: '2026-05-13' });
  const ready = DOCS.filter((d) => d.status === 'ready').length;
  const pages = DOCS.reduce((a, d) => a + d.pages, 0);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Canvas', to: `/project/${projectId}/canvas` }, { label: 'Permit packet' }]}
      title="Permit & compliance packet"
      subtitle="AHJ submittal · stamped drawings · code references"
      actions={
        <>
          <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" />Export ZIP</Button>
          <Button size="sm"><Send className="w-3.5 h-3.5 mr-1" />Submit to AHJ</Button>
        </>
      }
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Submittal documents</h3>
              <div className="text-xs text-muted-foreground">{ready}/{DOCS.length} ready · {pages} pages</div>
            </div>
            <div className="space-y-1.5">
              {DOCS.map((d) => (
                <div key={d.id} className="p-2.5 rounded border border-border flex items-center gap-3">
                  {d.status === 'ready' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {d.status === 'review' && <FileCheck className="w-4 h-4 text-amber-400 shrink-0" />}
                  {d.status === 'missing' && <FileWarning className="w-4 h-4 text-red-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{d.title}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                      <span className="uppercase">{d.type}</span> · {d.pages}p
                      {d.ref && <span className="text-amber-400">{d.ref}</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider ${d.status === 'ready' ? 'text-emerald-400' : d.status === 'review' ? 'text-amber-400' : 'text-red-400'}`}>{d.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2">Code compliance checks</h3>
            <div className="grid grid-cols-2 gap-2">
              {CHECKS.map((c) => (
                <div key={c.code} className="p-2.5 rounded border border-border flex items-center gap-2">
                  {c.ok ? <Check className="w-4 h-4 text-emerald-400" /> : <FileWarning className="w-4 h-4 text-red-400" />}
                  <div className="flex-1">
                    <div className="text-xs">{c.label}</div>
                    <div className="text-[10px] text-muted-foreground">{c.code}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3"><Stamp className="w-4 h-4" />Engineer of Record</h3>
          <div className="aspect-square bg-background rounded border-2 border-primary/40 flex items-center justify-center">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sealed by</div>
              <div className="text-sm font-medium mt-1">{stamp.engineer}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{stamp.license}</div>
              <div className="text-[10px] text-muted-foreground mt-2">{stamp.date}</div>
              <div className="mt-2 inline-block px-2 py-0.5 border border-primary rounded text-[10px] text-primary">P.E. SEAL</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <SmallInput label="Engineer" value={stamp.engineer} onChange={(v) => setStamp({ ...stamp, engineer: v })} />
            <SmallInput label="License #" value={stamp.license} onChange={(v) => setStamp({ ...stamp, license: v })} />
            <SmallInput label="Stamp date" value={stamp.date} onChange={(v) => setStamp({ ...stamp, date: v })} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SmallInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-input-background border border-input-border rounded px-2 py-1.5 text-xs" />
    </div>
  );
}
