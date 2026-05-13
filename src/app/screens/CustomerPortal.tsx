import { useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Check, FileText, Calendar, MessageSquare, Download } from 'lucide-react';

interface DocRow { id: string; title: string; kind: string; updated: string; }
interface Phase { id: string; name: string; date: string; status: 'done' | 'now' | 'next'; }

const DOCS: DocRow[] = [
  { id: 'd1', title: 'Proposal v3 — Riverbend HQ', kind: 'Proposal', updated: '2026-05-11' },
  { id: 'd2', title: 'Floor plan — Level 1',       kind: 'Drawing',  updated: '2026-05-08' },
  { id: 'd3', title: 'Floor plan — Level 2',       kind: 'Drawing',  updated: '2026-05-08' },
  { id: 'd4', title: 'Bill of materials',          kind: 'BOM',      updated: '2026-05-11' },
  { id: 'd5', title: 'Install schedule',           kind: 'Schedule', updated: '2026-05-09' },
];

const PHASES: Phase[] = [
  { id: 'p1', name: 'Design',         date: 'Apr 1 – May 12', status: 'done' },
  { id: 'p2', name: 'Permit & order', date: 'May 13 – Jun 3', status: 'now' },
  { id: 'p3', name: 'Install',        date: 'Jun 4 – Jul 8',  status: 'next' },
  { id: 'p4', name: 'Commission',     date: 'Jul 9 – Jul 18', status: 'next' },
];

export function CustomerPortal() {
  const { projectId = 'p1' } = useParams();
  const [approved, setApproved] = useState(false);

  return (
    <AppShell
      crumbs={[{ label: 'Client portal' }]}
      title="Riverbend HQ — Security upgrade"
      subtitle="Owner view · everything you need to track this project"
    >
      <div className="max-w-[1100px] mx-auto px-6 py-6 grid grid-cols-[1fr_300px] gap-4">
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Scope</div>
            <p className="text-sm mt-2 leading-relaxed">
              Replace legacy analog cameras with 28 IP cameras across three floors, modernize access control on 16 doors with HID Signo readers and Mercury controllers, and consolidate monitoring under a single Genetec head end. Includes structured cabling, three IDFs, and one year of warranty.
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Schedule</h3>
            </div>
            <div className="p-4 space-y-3">
              {PHASES.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${p.status === 'done' ? 'bg-emerald-400' : p.status === 'now' ? 'bg-primary' : 'bg-secondary border border-border-strong'}`} />
                  <div className="flex-1">
                    <div className="text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.date}</div>
                  </div>
                  {p.status === 'now' && <span className="text-[10px] uppercase tracking-wider text-primary">In progress</span>}
                  {i < PHASES.length - 1 && null}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Documents</h3>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {DOCS.map((d) => (
                  <tr key={d.id} className="border-t border-border first:border-t-0 hover:bg-secondary/20">
                    <td className="px-4 py-2.5">{d.title}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{d.kind}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{d.updated}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button className="text-muted-foreground hover:text-foreground"><Download className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Approval</div>
            <p className="text-sm mt-2 text-muted-foreground">Approve the current proposal to release procurement.</p>
            {approved ? (
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-400"><Check className="w-3.5 h-3.5" /> Approved — May 13, 2026</div>
            ) : (
              <Button className="w-full mt-3" size="sm" onClick={() => setApproved(true)}>Approve proposal</Button>
            )}
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Your point of contact</div>
            <div className="mt-2 text-sm">Casey Park</div>
            <div className="text-xs text-muted-foreground">Project lead · Deeper Vision</div>
            <Button className="w-full mt-3" size="sm" variant="outline"><MessageSquare className="w-3.5 h-3.5 mr-1" />Message Casey</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
