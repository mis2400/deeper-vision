// Customer Portal — V1 4F. Branded read-only project view the customer
// opens from a shared link. No AppShell, no internal navigation, no
// dead controls. The customer sees:
//   • Workspace branding (logo, name, brand color)
//   • Project name + scope summary derived from the actual record
//   • Real schedule from lifecyclePhase + PHASE_TIMELINE
//   • Real document list from project attachments (excluding internalOnly)
//   • Workspace contact derived from project members or workspace name
//   • Approve action that writes back to the Project record
//
// No internal "Skip to canvas", no breadcrumbs, no engineer tabs.

import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import {
  Calendar, FileText, Check, Download, Mail, Phone, MapPin,
  Building2, Clock, ShieldCheck, ArrowRight,
} from 'lucide-react';

import { Button } from '../components/Button';
import { useProjectStore } from '../store/projectStore';
import { PHASE_TIMELINE } from '../lifecycle/phases';
import type { LifecyclePhase, Attachment } from '../store/types';

// Phases shown on the customer schedule. We collapse the internal
// pipeline ('lead', 'discovery', 'walk_scheduled', 'survey',
// 'engineering', 'estimate') into a single "Design" milestone so the
// customer view stays scannable.
const CUSTOMER_PHASES: Array<{ id: string; label: string; phases: LifecyclePhase[] }> = [
  { id: 'design',       label: 'Design',                 phases: ['lead', 'discovery', 'walk_scheduled', 'survey', 'engineering', 'estimate', 'proposal'] },
  { id: 'review',       label: 'Customer review',        phases: ['customer_review'] },
  { id: 'approved',     label: 'Approved + ordered',     phases: ['approved'] },
  { id: 'install',      label: 'Install',                phases: ['deployment'] },
  { id: 'commission',   label: 'Commission',             phases: ['commissioning'] },
  { id: 'completed',    label: 'Live + supported',       phases: ['completed', 'managed_service', 'support'] },
];

export function CustomerPortal() {
  const { projectId = 'p1' } = useParams();
  const project          = useProjectStore((s) => s.projects[projectId]);
  const customer         = useProjectStore((s) => (project?.customerId ? s.customers[project.customerId] : null));
  const contact          = useProjectStore((s) => (customer?.primaryContactId ? s.contacts[customer.primaryContactId] : null));
  const sitesMap         = useProjectStore((s) => s.sites);
  const workspaceSettings = useProjectStore((s) => s.workspaceSettings);
  const members          = useProjectStore((s) => s.workspaceMembers);
  const attachments      = useProjectStore((s) => s.attachments);
  const updateProject    = useProjectStore((s) => s.updateProject);

  const projectSite = useMemo(
    () => Object.values(sitesMap).find((s) => s.projectId === projectId) ?? null,
    [sitesMap, projectId],
  );

  // Filter attachments: only this project, only customer-visible items,
  // newest first. Strip the internalOnly + non-shareable storageMode
  // items so we don't promise a download we cannot serve.
  const docs = useMemo<Attachment[]>(
    () => Object.values(attachments)
      .filter((a) => a.projectId === projectId)
      .filter((a) => !a.internalOnly)
      .filter((a) => a.dataUrl || a.storageMode === 'cloud')
      .sort((a, b) => b.createdAt - a.createdAt),
    [attachments, projectId],
  );

  // Project lead: first workspace member assigned to this project, else
  // the first owner-role member, else null (the workspace name covers
  // it in the contact card).
  const projectLead = useMemo(() => {
    const all = Object.values(members);
    return all.find((m) => m.projectIds?.includes(projectId))
      ?? all.find((m) => m.role === 'owner')
      ?? null;
  }, [members, projectId]);

  // Schedule: walk PHASE_TIMELINE and bucket each into the customer
  // milestone groups. The active phase wins the "now" state; everything
  // before it is "done"; everything after is "next".
  const currentPhaseIdx = project?.lifecyclePhase
    ? PHASE_TIMELINE.indexOf(project.lifecyclePhase)
    : -1;
  const schedule = useMemo(() => CUSTOMER_PHASES.map((m) => {
    const idxs = m.phases.map((p) => PHASE_TIMELINE.indexOf(p));
    const minIdx = Math.min(...idxs);
    const maxIdx = Math.max(...idxs);
    let status: 'done' | 'now' | 'next' = 'next';
    if (currentPhaseIdx >= 0) {
      if (currentPhaseIdx > maxIdx) status = 'done';
      else if (currentPhaseIdx >= minIdx) status = 'now';
    }
    return { ...m, status };
  }), [currentPhaseIdx]);

  // Branding
  const brandName  = workspaceSettings?.name || 'Deeper Vision';
  const brandColor = workspaceSettings?.brandColor || 'var(--primary)';
  const brandLogo  = workspaceSettings?.logoDataUrl;

  // Approval modal state
  const [approveOpen, setApproveOpen] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [approveBusy, setApproveBusy] = useState(false);

  const submitApproval = () => {
    if (!project) return;
    setApproveBusy(true);
    try {
      const now = Date.now();
      // Stamp the approval timestamp + optional approver name. Also
      // advance the lifecyclePhase to 'approved' if the project is in
      // a stage where approval makes sense.
      const phasesEligible: LifecyclePhase[] = ['proposal', 'customer_review'];
      const patch: any = {
        customerApprovedAt: now,
        customerApprovedBy: approverName.trim() || undefined,
        updatedAt: now,
      };
      if (project.lifecyclePhase && phasesEligible.includes(project.lifecyclePhase)) {
        patch.lifecyclePhase = 'approved';
        patch.phaseStartedAt = now;
      }
      updateProject(project.id, patch);
      toast.success('Thanks. Your approval was recorded.');
      setApproveOpen(false);
    } catch (err) {
      console.error('Customer approval failed', (err as any)?.name);
      toast.error('Could not save the approval. Try again.');
    } finally {
      setApproveBusy(false);
    }
  };

  // ── Empty state when projectId is unknown ────────────────────
  if (!project) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-lg p-8 max-w-md text-center">
          <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground opacity-40" />
          <h2 className="mt-4 text-base">This link is no longer valid</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The project this portal points to could not be found. Reach out to your contact for an updated link.
          </p>
        </div>
      </div>
    );
  }

  const siteAddress = projectSite?.address || (customer?.addresses?.[0]
    ? [customer.addresses[0].street, customer.addresses[0].city, customer.addresses[0].state, customer.addresses[0].postal].filter(Boolean).join(', ')
    : '');
  const approvedAt = project.customerApprovedAt;

  return (
    <div className="min-h-screen bg-secondary">
      {/* Branded header */}
      <header
        className="border-b border-border bg-card"
        style={{ borderTopWidth: 4, borderTopColor: brandColor, borderTopStyle: 'solid' }}
      >
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {brandLogo ? (
              <img src={brandLogo} alt={brandName} className="h-9 w-9 rounded object-contain bg-secondary" />
            ) : (
              <div className="h-9 w-9 rounded flex items-center justify-center text-sm font-medium text-primary-foreground" style={{ background: brandColor }}>
                {brandName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm truncate">{brandName}</div>
              <div className="text-xs text-muted-foreground">Project portal</div>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground hidden sm:block">
            <div>Customer view</div>
            <div className="opacity-70">Read only · approve when ready</div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-card border-b border-border">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{customer?.companyName ?? 'Client project'}</div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-medium">{project.name}</h1>
          {siteAddress && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />{siteAddress}
            </div>
          )}
          {approvedAt && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-success/15 text-success border border-success/40 rounded-full px-2.5 py-1">
              <Check className="w-3 h-3" />
              Approved {new Date(approvedAt).toLocaleDateString()}
              {project.customerApprovedBy ? ` by ${project.customerApprovedBy}` : ''}
            </div>
          )}
        </div>
      </section>

      {/* Body */}
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          {/* Scope */}
          <Card title="Scope of work">
            <ScopeSummary projectName={project.name} scopeKind={project.scopeKind} existingSystems={project.existingSystems} />
          </Card>

          {/* Schedule */}
          <Card icon={<Calendar className="w-4 h-4 text-muted-foreground" />} title="Schedule">
            <div className="space-y-2.5">
              {schedule.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-none ${
                      m.status === 'done' ? 'bg-success' : m.status === 'now' ? 'bg-primary' : 'bg-secondary border border-border-strong'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{m.label}</div>
                  </div>
                  {m.status === 'now' && (
                    <span className="text-[10px] uppercase tracking-wider text-primary">In progress</span>
                  )}
                  {m.status === 'done' && (
                    <span className="text-[10px] uppercase tracking-wider text-success">Done</span>
                  )}
                </div>
              ))}
            </div>
            {project.phaseStartedAt && (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                Current phase started {new Date(project.phaseStartedAt).toLocaleDateString()}
              </div>
            )}
          </Card>

          {/* Documents */}
          <Card icon={<FileText className="w-4 h-4 text-muted-foreground" />} title="Documents">
            {docs.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nothing shared yet. Your team will publish documents here as they're ready.
              </div>
            ) : (
              <div className="divide-y divide-border -mx-1">
                {docs.map((d) => (
                  <DocRowItem key={d.id} doc={d} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-3">
          {/* Approval */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Approval</div>
            {approvedAt ? (
              <div className="mt-2">
                <div className="text-sm flex items-center gap-1.5 text-success">
                  <Check className="w-4 h-4" />
                  Approved
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(approvedAt).toLocaleString()}
                  {project.customerApprovedBy && <> · by {project.customerApprovedBy}</>}
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm mt-1.5 text-muted-foreground leading-relaxed">
                  When you're ready, approve the current proposal so your team can release procurement.
                </p>
                <Button className="w-full mt-3" onClick={() => setApproveOpen(true)}>
                  Approve proposal <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </>
            )}
          </div>

          {/* Contact */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Your point of contact</div>
            {projectLead ? (
              <>
                <div className="mt-1.5 text-sm">{projectLead.fullName}</div>
                <div className="text-xs text-muted-foreground capitalize">{projectLead.role} · {brandName}</div>
                <div className="mt-3 space-y-1.5">
                  {projectLead.email && (
                    <a
                      href={`mailto:${projectLead.email}`}
                      className="flex items-center gap-1.5 text-xs text-foreground hover:underline"
                    >
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      {projectLead.email}
                    </a>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mt-1.5 text-sm">{brandName}</div>
                <div className="text-xs text-muted-foreground">Project team</div>
              </>
            )}
          </div>

          {/* Your details */}
          {(customer || contact) && (
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">On your side</div>
              {customer?.companyName && <div className="mt-1.5 text-sm">{customer.companyName}</div>}
              {contact && (
                <div className="text-xs text-muted-foreground mt-1">
                  {[contact.firstName, contact.lastName].filter(Boolean).join(' ')}
                  {contact.title && <> · {contact.title}</>}
                </div>
              )}
              <div className="mt-2.5 space-y-1.5">
                {contact?.email && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" />{contact.email}
                  </div>
                )}
                {contact?.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" />{contact.phone}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-6">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3" />
            {brandName}
          </div>
          <div>Project portal · read only</div>
        </div>
      </footer>

      {approveOpen && (
        <ApproveSheet
          name={approverName}
          onName={setApproverName}
          onCancel={() => setApproveOpen(false)}
          onConfirm={submitApproval}
          busy={approveBusy}
          companyName={customer?.companyName}
        />
      )}
    </div>
  );
}

// ─────────────────────── Card primitive ──────────────────────────
function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─────────────────────── Scope summary ───────────────────────────
function ScopeSummary({
  projectName, scopeKind, existingSystems,
}: {
  projectName: string;
  scopeKind?: 'new-build' | 'retrofit' | 'expansion' | 'managed-service-takeover';
  existingSystems?: string[];
}) {
  const kindLabel: Record<string, string> = {
    'new-build': 'New build',
    'retrofit': 'Retrofit',
    'expansion': 'Expansion',
    'managed-service-takeover': 'Managed takeover',
  };
  const systemLabel: Record<string, string> = {
    'camera-vms': 'Camera VMS',
    'access-control': 'Access control',
    'intrusion': 'Intrusion',
    'fire-alarm': 'Fire alarm',
    'network': 'Network infrastructure',
    'bas': 'Building automation',
    'none': 'Greenfield install',
  };
  const systems = (existingSystems ?? []).map((s) => systemLabel[s] ?? s).join(' · ');

  return (
    <div className="space-y-2.5">
      <p className="text-sm leading-relaxed">
        {projectName}{scopeKind ? `. ${kindLabel[scopeKind]} engagement.` : '.'}
      </p>
      {systems && (
        <div className="text-xs text-muted-foreground">
          <span className="uppercase tracking-wider">Existing on site</span>
          <div className="text-foreground mt-0.5">{systems}</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────── Doc row ─────────────────────────────────
function DocRowItem({ doc }: { doc: Attachment }) {
  const canDownload = !!doc.dataUrl;
  const handleDownload = () => {
    if (!canDownload || !doc.dataUrl) return;
    const a = document.createElement('a');
    a.href = doc.dataUrl;
    a.download = doc.fileName;
    a.click();
  };
  const kindLabel: Record<string, string> = {
    photo: 'Photo', video: 'Video', pdf: 'PDF', spec: 'Spec',
    drawing: 'Drawing', closeout: 'Closeout', note: 'Note', other: 'File',
  };
  return (
    <div className="flex items-center gap-3 px-1 py-2.5">
      <FileText className="w-4 h-4 text-muted-foreground flex-none" />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{doc.fileName}</div>
        <div className="text-[11px] text-muted-foreground">
          {kindLabel[doc.category] ?? doc.category} · {new Date(doc.createdAt).toLocaleDateString()}
        </div>
      </div>
      {canDownload && (
        <button
          onClick={handleDownload}
          className="text-muted-foreground hover:text-foreground p-2 rounded"
          aria-label={`Download ${doc.fileName}`}
        >
          <Download className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────── Approve sheet ───────────────────────────
function ApproveSheet({
  name, onName, onCancel, onConfirm, busy, companyName,
}: {
  name: string;
  onName: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  companyName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-6">
      <div className="bg-card w-full sm:max-w-md sm:rounded-xl shadow-2xl border-t sm:border border-border max-h-[92vh] [@supports(height:100dvh)]:max-h-[92dvh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-medium">Approve the proposal</div>
          <div className="text-xs text-muted-foreground mt-1">
            {companyName
              ? `On behalf of ${companyName}, confirm this proposal so your team can release procurement.`
              : 'Confirm this proposal so your team can release procurement.'}
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Your name (optional)</label>
            <input
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="Type your name to sign"
              autoFocus
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            />
            <div className="text-[11px] text-muted-foreground mt-1.5">
              We record the time and your name with the approval. This is not a binding e signature; it tells your team you said go.
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={onConfirm} disabled={busy}>
            <Check className="w-3.5 h-3.5 mr-1" />
            {busy ? 'Saving…' : 'I approve'}
          </Button>
        </div>
      </div>
    </div>
  );
}
