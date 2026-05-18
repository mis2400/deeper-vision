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
  Building2, Clock, ShieldCheck, ArrowRight, Package,
} from 'lucide-react';

import { Button } from '../components/Button';
import { useProjectStore } from '../store/projectStore';
import { toCustomerView, type ProposalCustomerArtifact } from '../lib/proposalView';
import { PHASE_TIMELINE } from '../lifecycle/phases';
import type { LifecyclePhase, Attachment, ApprovalType, Asset, Device, Warranty, ProposalLine } from '../store/types';

/** SC.2.1 — roll a vN style proposal version forward by one when
 *  the prior approval used a recognisable vN tag. Non-matching
 *  versions (e.g. "v1-rev-A", "draft", "2026.04") pass through
 *  unchanged so the customer can override. */
function nextProposalVersion(prior: string | undefined): string {
  if (!prior) return 'v1';
  const m = prior.match(/^v(\d+)$/i);
  if (!m) return prior;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n)) return prior;
  return `v${n + 1}`;
}

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
  const addApproval      = useProjectStore((s) => s.addApproval);
  // SC.2.1 — read prior approvals. Raw subscription + useMemo
  // (matches every other screen's pattern) so the selector's
  // fresh-array return doesn't trip React 18's getSnapshot
  // identity check.
  const approvalsMap     = useProjectStore((s) => s.approvals);
  const priorApprovals   = useMemo(
    () => Object.values(approvalsMap)
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime()),
    [approvalsMap, projectId],
  );
  const latestApproval   = priorApprovals[0] ?? null;
  // SC.3.6 — installed assets the customer is allowed to see.
  // Only active assets (no decommissioned, no orphaned). Walks
  // assets -> device -> floor for the location string.
  const assetsMap       = useProjectStore((s) => s.assets);
  const warrantiesMap   = useProjectStore((s) => s.warranties);
  const devicesMap      = useProjectStore((s) => s.devices);
  const floorsMap       = useProjectStore((s) => s.floors);
  const installedAssets = useMemo(
    () => Object.values(assetsMap)
      .filter((a) => a.projectId === projectId && a.status === 'active')
      .sort((a, b) => b.createdAt - a.createdAt),
    [assetsMap, projectId],
  );

  // SC.4.7 — pick the live customer facing proposal. Prefer the
  // latest sent / approved version. Only fall back to a superseded
  // version if it is the LATEST one AND a newer (sent / approved)
  // record exists; otherwise hiding the card is more honest than
  // promising a link that does not yet exist. The portal renders
  // its customer view only; toCustomerView strips every internal
  // field at the data layer so a screenshot or DevTools dump can't
  // leak cost / margin / labor numbers.
  const proposalsMap = useProjectStore((s) => s.proposals);
  const sentProposal = useMemo(() => {
    const projectProposals = Object.values(proposalsMap).filter((p) => p.projectId === projectId);
    if (projectProposals.length === 0) return null;
    const liveCandidates = projectProposals.filter((p) => p.status === 'sent' || p.status === 'approved');
    if (liveCandidates.length > 0) {
      return liveCandidates.reduce((max, p) => (p.version > max.version ? p : max), liveCandidates[0]);
    }
    // No sent / approved version exists at all. Even if there's a
    // superseded record, it's not honest to surface a "newer one
    // is coming" banner when no newer one has been sent. Hide the
    // card.
    return null;
  }, [proposalsMap, projectId]);
  const proposalArtifact = useMemo(
    () => sentProposal ? toCustomerView(sentProposal) : null,
    [sentProposal],
  );

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

  // SC.2.1 + SC.2.3 — full approval form writes through
  // addApproval (SC.1.1). Lifecycle phase still advances via
  // updateProject on scope / final approvals so the operator
  // workflow keeps moving. Legacy Project.customerApprovedAt /
  // customerApprovedBy are gone (v26 -> v27 migration).
  const [approveOpen, setApproveOpen] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [approverEmail, setApproverEmail] = useState('');
  const [approvalType, setApprovalType] = useState<ApprovalType>('design');
  const [proposalVersion, setProposalVersion] = useState('v1');
  const [approverComments, setApproverComments] = useState('');
  const [approveBusy, setApproveBusy] = useState(false);
  const [approveErrors, setApproveErrors] = useState<{ name?: string; email?: string; version?: string }>({});

  // SC.4.10 — when a live sent proposal exists, derive the
  // proposal version from it directly (the customer is approving
  // THIS specific version, not a free text label they invent).
  // Fall back to the legacy roll forward when no proposal exists
  // (a pre SC.4 project still allows ad hoc approvals).
  const openApproveSheet = () => {
    const sentProposalVersionLabel = sentProposal ? `v${sentProposal.version}` : nextProposalVersion(latestApproval?.proposalVersion);
    setProposalVersion(sentProposalVersionLabel);
    setApproverName('');
    setApproverEmail('');
    setApproverComments('');
    setApprovalType('design');
    setApproveErrors({});
    setApproveOpen(true);
  };

  const submitApproval = () => {
    if (!project) return;
    // Required field validation. Email is a simple shape check, not
    // RFC 5322 perfect — we just want to catch obvious typos.
    const errs: typeof approveErrors = {};
    const trimmedName = approverName.trim();
    const trimmedEmail = approverEmail.trim();
    const trimmedVersion = proposalVersion.trim();
    if (!trimmedName) errs.name = 'Required';
    if (!trimmedEmail) errs.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) errs.email = 'Enter a valid email';
    if (!trimmedVersion) errs.version = 'Required';
    if (Object.keys(errs).length > 0) {
      setApproveErrors(errs);
      return;
    }

    setApproveBusy(true);
    try {
      const now = Date.now();
      // Random suffix avoids same millisecond collisions when a
      // script (e.g. SC.2.7 integrity loader) fires multiple
      // approvals back to back.
      const approvalId = `appr-${project.id}-${now}-${Math.random().toString(36).slice(2, 8)}`;
      addApproval({
        id: approvalId,
        projectId: project.id,
        proposalVersion: trimmedVersion,
        approverName: trimmedName,
        approverEmail: trimmedEmail,
        approvalType,
        comments: approverComments.trim(),
        approvedAt: new Date(now).toISOString(),
        createdAt: now,
        updatedAt: now,
      });

      // SC.2.3 — legacy mirror write retired. Lifecycle phase
      // advance still fires on scope / final approvals so the
      // operator-side workflow keeps moving; everything else now
      // reads from the Approval record via approvalsForProject.
      const phasesEligible: LifecyclePhase[] = ['proposal', 'customer_review'];
      if (
        (approvalType === 'scope' || approvalType === 'final')
        && project.lifecyclePhase
        && phasesEligible.includes(project.lifecyclePhase)
      ) {
        updateProject(project.id, {
          lifecyclePhase: 'approved',
          phaseStartedAt: now,
          updatedAt: now,
        });
      }

      toast.success(`${approvalTypeLabel(approvalType)} approval recorded.`, {
        description: `Thanks ${trimmedName}. Your team has been notified.`,
      });

      // Clear and close so a follow up approval (e.g. design then
      // scope) starts from a blank slate.
      setApproveOpen(false);
      setApproverName('');
      setApproverEmail('');
      setApproverComments('');
      setApproveErrors({});
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
          {latestApproval?.approvalType === 'final' && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-success/15 text-success border border-success/40 rounded-full px-2.5 py-1">
              <Check className="w-3 h-3" />
              Final approval {new Date(latestApproval.approvedAt).toLocaleDateString()}
              {latestApproval.approverName ? ` by ${latestApproval.approverName}` : ''}
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

          {/* SC.4.7 — sent proposal card. Renders only when a
              proposal has been sent. Reads from toCustomerView so
              internal cost / margin / labor never reach the DOM. */}
          {proposalArtifact && (
            <Card icon={<FileText className="w-4 h-4 text-muted-foreground" />} title={`Proposal v${proposalArtifact.version}`}>
              <ProposalCard artifact={proposalArtifact} />
            </Card>
          )}

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

          {/* SC.3.6 — Installed assets (read only, customer safe).
              Hidden if there are no active assets yet so the
              portal stays calm pre commissioning. Decommissioned
              and orphaned assets are filtered out upstream. */}
          {installedAssets.length > 0 && (
            <Card icon={<Package className="w-4 h-4 text-muted-foreground" />} title="Installed equipment">
              <div className="divide-y divide-border -mx-1">
                {installedAssets.map((a) => (
                  <InstalledAssetRow
                    key={a.id}
                    asset={a}
                    device={devicesMap[a.deviceId]}
                    floorName={floorsMap[devicesMap[a.deviceId]?.floorId ?? '']?.name}
                    warranties={Object.values(warrantiesMap).filter((w) => w.assetId === a.id)}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-3">
          {/* Approval card — SC.2.1 + SC.2.6.
              Status pill summarises the current gate state in
              customer safe wording. Only a `final` approval flips
              the card into the "Approved" success state; design /
              scope / change-order approvals keep the Approve button
              visible so the customer can progress through the gates
              without losing access. View history expands an inline
              list when multiple approvals exist; the latest of each
              type is highlighted, earlier same type approvals are
              labelled Superseded. */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Approval</div>
              <ApprovalStatusPill latest={latestApproval} />
            </div>
            {/* SC.4.10 — newer version banner. Fires when the
                customer has approved a prior version AND the
                currently live sent proposal is a different
                version. Audit trail: the approval row in the
                history list still references the original version. */}
            {sentProposal && latestApproval && latestApproval.proposalVersion !== `v${sentProposal.version}` && (
              <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700" data-testid="portal-newer-version-banner">
                You approved {latestApproval.proposalVersion} on {new Date(latestApproval.approvedAt).toLocaleDateString()}. A newer version (v{sentProposal.version}) is now available. Review the proposal above and record a fresh approval below if you want to sign off on this revision.
              </div>
            )}
            {latestApproval?.approvalType === 'final' ? (
              <div className="mt-2">
                <div className="text-sm flex items-center gap-1.5 text-success">
                  <Check className="w-4 h-4" />
                  Final approval recorded
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(latestApproval.approvedAt).toLocaleString()}
                  {latestApproval.approverName && <> · by {latestApproval.approverName}</>}
                </div>
              </div>
            ) : (
              <>
                {latestApproval && (
                  <div className="mt-2 mb-3 rounded-md border border-border bg-secondary/40 px-3 py-2">
                    <div className="text-xs text-foreground">
                      Latest: <span className="font-medium">{approvalTypeLabel(latestApproval.approvalType)}</span> approval ({latestApproval.proposalVersion})
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(latestApproval.approvedAt).toLocaleString()} · {latestApproval.approverName}
                    </div>
                  </div>
                )}
                <p className="text-sm mt-1.5 text-muted-foreground leading-relaxed">
                  {latestApproval
                    ? 'Record the next approval as the project progresses.'
                    : 'When you are ready, approve the current proposal so your team can release procurement.'}
                </p>
                <Button className="w-full mt-3" onClick={openApproveSheet}>
                  {latestApproval ? 'Record next approval' : 'Approve proposal'} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </>
            )}
            {priorApprovals.length > 1 && (
              <ApprovalHistoryToggle approvals={priorApprovals} />
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
          email={approverEmail}
          onEmail={setApproverEmail}
          approvalType={approvalType}
          onApprovalType={setApprovalType}
          proposalVersion={proposalVersion}
          onProposalVersion={setProposalVersion}
          /* SC.4.10 — when there's a live sent proposal, the
             version is determined by the data layer (the operator
             can't invent a different version number). */
          versionLocked={!!sentProposal}
          comments={approverComments}
          onComments={setApproverComments}
          errors={approveErrors}
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

// ─────────────────────── Installed asset row (SC.3.6) ──────────
// Customer safe device type labels. Internal type codes get
// translated to plain English. Anything not in this map falls
// back to the device.label or the type code as a last resort.
const ASSET_TYPE_LABEL: Record<string, string> = {
  'cam.dome':         'Dome camera',
  'cam.bullet':       'Bullet camera',
  'cam.turret':       'Turret camera',
  'cam.ptz':          'PTZ camera',
  'cam.multisensor':  'Multisensor camera',
  'cam.fisheye':      'Fisheye camera',
  'cam.lpr':          'License plate camera',
  'cam.thermal':      'Thermal camera',
  'inf.door':         'Access door',
  'inf.doubledoor':   'Double access door',
  'inf.storefront':   'Storefront door',
  'inf.gate':         'Gate',
};

function friendlyAssetTitle(asset: Asset, device?: Device): string {
  if (!device) return `${asset.manufacturer} ${asset.model}`;
  const t = String(device.type);
  const direct = ASSET_TYPE_LABEL[t];
  if (direct) return direct;
  // Best effort: strip the category prefix from "cam.foo" -> "Foo".
  const tail = t.split('.').slice(1).join(' ') || t;
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

function InstalledAssetRow({ asset, device, floorName, warranties }: {
  asset: Asset;
  device?: Device;
  floorName?: string;
  warranties: Warranty[];
}) {
  const title = friendlyAssetTitle(asset, device);
  // Pick the most relevant warranty status for the badge: prefer
  // expired, then expiring, then active. Mirrors the "loudest
  // signal first" pattern: if anything needs attention, surface
  // that first.
  const now = Date.now();
  const badgeWty = (() => {
    if (warranties.length === 0) return null;
    const expired   = warranties.find((w) => new Date(w.endDate).getTime() < now);
    if (expired) return { kind: 'expired'  as const, w: expired };
    const expiring  = warranties.find((w) => {
      const end = new Date(w.endDate).getTime();
      return Number.isFinite(end) && end - now <= 90 * 24 * 60 * 60 * 1000;
    });
    if (expiring) return { kind: 'expiring' as const, w: expiring };
    return { kind: 'active' as const, w: warranties[0] };
  })();
  const badge = badgeWty && (() => {
    if (badgeWty.kind === 'expired')  return { label: 'Warranty expired',  tone: 'text-rose-700 border-rose-500/40 bg-rose-500/10' };
    if (badgeWty.kind === 'expiring') return { label: 'Warranty expiring', tone: 'text-amber-700 border-amber-500/40 bg-amber-500/10' };
    return { label: 'Under warranty', tone: 'text-success border-success/40 bg-success/10' };
  })();

  return (
    <div className="flex items-start gap-3 px-1 py-2.5">
      <Package className="w-4 h-4 text-muted-foreground flex-none mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{title}</div>
        <div className="text-[11px] text-muted-foreground">
          {asset.manufacturer} {asset.model}
          {floorName && <> · {floorName}</>}
          <> · Installed {new Date(asset.commissionedAt).toLocaleDateString()}</>
        </div>
      </div>
      {badge && (
        <span className={`shrink-0 inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${badge.tone}`}>
          {badge.label}
        </span>
      )}
    </div>
  );
}

// ─────────────────────── Proposal card (SC.4.7) ─────────────────
// Customer facing render of the sent proposal. Reads from the
// stripped ProposalCustomerArtifact only — no internal fields are
// in scope. Line items group by section with a per section subtotal
// and a project total at the bottom.
const PROPOSAL_SECTION_LABEL: Record<ProposalLine['section'], string> = {
  cameras:        'Cameras',
  access:         'Access control',
  cabling:        'Cabling',
  conduit:        'Conduit',
  walls:          'Walls',
  infrastructure: 'Infrastructure',
  labor:          'Labor',
  other:          'Other',
};

function ProposalCard({ artifact }: {
  artifact: ProposalCustomerArtifact;
}) {
  const grouped = useMemo(() => {
    const m = new Map<ProposalLine['section'], typeof artifact.lines>();
    for (const l of artifact.lines) {
      const arr = m.get(l.section) ?? [];
      arr.push(l);
      m.set(l.section, arr);
    }
    return m;
  }, [artifact]);

  return (
    <div className="space-y-5" data-testid="portal-proposal-card">
      <div>
        <div className="text-base font-medium leading-tight">{artifact.customerView.header}</div>
        {artifact.sentAt && (
          <div className="text-[11px] text-muted-foreground mt-1">
            Sent {new Date(artifact.sentAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {artifact.customerView.executiveSummary && (
        <ProposalBlock title="Executive summary">{artifact.customerView.executiveSummary}</ProposalBlock>
      )}
      {artifact.customerView.scope && (
        <ProposalBlock title="Scope of work">{artifact.customerView.scope}</ProposalBlock>
      )}

      {grouped.size > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Line items</div>
          <div className="space-y-3">
            {Array.from(grouped.entries()).map(([section, lines]) => {
              const sub = lines.reduce((s, l) => s + l.lineTotal, 0);
              return (
                <div key={section} className="border border-border rounded-md overflow-hidden">
                  <div className="px-3 py-1.5 bg-secondary/40 flex items-center justify-between text-[11px]">
                    <span className="font-medium uppercase tracking-wider">{PROPOSAL_SECTION_LABEL[section]}</span>
                    <span className="text-muted-foreground tabular-nums">${money(sub)}</span>
                  </div>
                  <table className="w-full text-[12px]">
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.id} className="border-t border-border first:border-t-0">
                          <td className="px-3 py-1.5">{l.description}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums w-24 text-muted-foreground">{l.quantity} {l.unit}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums w-24">${money(l.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-3 flex items-center justify-between text-base font-medium">
        <span>Project total</span>
        <span className="tabular-nums">${money(artifact.totals.sellTotal)}</span>
      </div>
      {artifact.paymentSchedule && (
        <div className="text-[12px] text-muted-foreground">{artifact.paymentSchedule}</div>
      )}

      {artifact.customerView.footer && (
        <ProposalBlock title="Acceptance">{artifact.customerView.footer}</ProposalBlock>
      )}
      {artifact.customerView.terms && (
        <ProposalBlock title="Terms">{artifact.customerView.terms}</ProposalBlock>
      )}
    </div>
  );
}

function ProposalBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <div className="text-[14px] leading-relaxed whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function money(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

// ─────────────────────── Approval status pill (SC.2.6) ──────────
// Customer safe summary of the gate state. Maps the (possibly
// empty) approval list into one of five short labels.
function ApprovalStatusPill({ latest }: { latest: import('../store/types').Approval | null }) {
  const status: { label: string; tone: string } = (() => {
    if (!latest) return { label: 'Awaiting approval', tone: 'text-muted-foreground border-border bg-secondary' };
    switch (latest.approvalType) {
      case 'final':        return { label: 'Final approval',    tone: 'text-success border-success/40 bg-success/10' };
      case 'scope':        return { label: 'Scope approved',    tone: 'text-violet-400 border-violet-500/40 bg-violet-500/10' };
      case 'change-order': return { label: 'Change approved',   tone: 'text-amber-400 border-amber-500/40 bg-amber-500/10' };
      case 'design':       return { label: 'Design approved',   tone: 'text-sky-400 border-sky-500/40 bg-sky-500/10' };
      default:             return { label: 'Approval recorded', tone: 'text-foreground border-border bg-secondary' };
    }
  })();
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${status.tone}`}
      data-testid="portal-approval-status"
    >
      {status.label}
    </span>
  );
}

// ─────────────────────── Approval history toggle (SC.2.6) ───────
// Inline expansion when more than one approval exists. Labels the
// latest of each type as the current record and earlier same type
// entries as Superseded so the customer understands which version
// of the design / scope / final is currently in force.
function ApprovalHistoryToggle({ approvals }: { approvals: import('../store/types').Approval[] }) {
  const [open, setOpen] = useState(false);
  // Map each type to its newest approval id; everything else of
  // that type is superseded. `approvals` arrives sorted newest
  // first so the first hit per type wins.
  const latestIdByType = new Map<string, string>();
  for (const a of approvals) {
    if (!latestIdByType.has(a.approvalType)) latestIdByType.set(a.approvalType, a.id);
  }
  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
        data-testid="portal-approval-history-toggle"
      >
        {open ? 'Hide approval history' : `View approval history (${approvals.length})`}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5" data-testid="portal-approval-history-list">
          {approvals.map((a) => {
            const superseded = latestIdByType.get(a.approvalType) !== a.id;
            return (
              <li key={a.id} className="text-[11px] flex items-start gap-2">
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {new Date(a.approvedAt).toLocaleDateString()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="text-foreground">{approvalTypeLabel(a.approvalType)}</span>
                  <span className="text-muted-foreground"> · {a.proposalVersion} · {a.approverName}</span>
                </span>
                {superseded && (
                  <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground/70 border border-border rounded px-1">
                    Superseded
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────── Approve sheet ───────────────────────────
// SC.2.1 — full form. Five real fields land in the Approval record;
// all required validation is local + inline. Mobile responsive
// (bottom sheet under sm, centered modal above).
const APPROVAL_TYPES: { id: ApprovalType; label: string; hint: string }[] = [
  { id: 'design',        label: 'Design',        hint: 'Sign off the drawing / layout. Does not release procurement.' },
  { id: 'scope',         label: 'Scope',         hint: 'Sign off the line items and totals. Releases procurement.' },
  { id: 'final',         label: 'Final',         hint: 'Sign off the completed install. Triggers handoff to live support.' },
  { id: 'change-order',  label: 'Change order',  hint: 'Approve a mid project change to scope or pricing.' },
];

function approvalTypeLabel(t: ApprovalType): string {
  return APPROVAL_TYPES.find((x) => x.id === t)?.label ?? t;
}

function ApproveSheet({
  name, onName, email, onEmail, approvalType, onApprovalType,
  proposalVersion, onProposalVersion, versionLocked, comments, onComments,
  errors, onCancel, onConfirm, busy, companyName,
}: {
  name: string;
  onName: (v: string) => void;
  email: string;
  onEmail: (v: string) => void;
  approvalType: ApprovalType;
  onApprovalType: (v: ApprovalType) => void;
  proposalVersion: string;
  onProposalVersion: (v: string) => void;
  /** SC.4.10 — when a live sent proposal exists, the version is
   *  determined by the data layer (the customer is approving THAT
   *  version specifically). Field renders read only with a hint. */
  versionLocked?: boolean;
  comments: string;
  onComments: (v: string) => void;
  errors: { name?: string; email?: string; version?: string };
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  companyName?: string;
}) {
  const activeTypeHint = APPROVAL_TYPES.find((t) => t.id === approvalType)?.hint;
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
          {/* Approval type */}
          <div>
            <label className="text-xs text-muted-foreground">Approval type</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {APPROVAL_TYPES.map((t) => {
                const active = approvalType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onApprovalType(t.id)}
                    className={`text-left text-xs px-2.5 py-2 rounded-md border transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-border-strong'
                    }`}
                    data-testid={`approve-type-${t.id}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            {activeTypeHint && (
              <div className="text-[11px] text-muted-foreground mt-1.5">{activeTypeHint}</div>
            )}
          </div>

          {/* Proposal version */}
          <div>
            <label className="text-xs text-muted-foreground">Proposal version</label>
            <input
              value={proposalVersion}
              onChange={(e) => onProposalVersion(e.target.value)}
              placeholder="v1"
              disabled={versionLocked}
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
              data-testid="approve-version"
            />
            {versionLocked && (
              <div className="text-[11px] text-muted-foreground mt-1">
                You're approving the version your team sent. This is automatic.
              </div>
            )}
            {errors.version && <div className="text-[11px] text-destructive mt-1">{errors.version}</div>}
          </div>

          {/* Approver name */}
          <div>
            <label className="text-xs text-muted-foreground">Your name</label>
            <input
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="Full name"
              autoFocus
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="approve-name"
            />
            {errors.name && <div className="text-[11px] text-destructive mt-1">{errors.name}</div>}
          </div>

          {/* Approver email */}
          <div>
            <label className="text-xs text-muted-foreground">Your email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="approve-email"
            />
            {errors.email && <div className="text-[11px] text-destructive mt-1">{errors.email}</div>}
          </div>

          {/* Comments */}
          <div>
            <label className="text-xs text-muted-foreground">Comments (optional)</label>
            <textarea
              value={comments}
              onChange={(e) => onComments(e.target.value)}
              placeholder="Anything your team should know about this approval."
              rows={3}
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="approve-comments"
            />
          </div>

          <div className="text-[11px] text-muted-foreground">
            We record this approval with your name, email, type, version, and the time. This is not a binding e signature; it tells your team you said go.
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={onConfirm} disabled={busy} data-testid="approve-submit">
            <Check className="w-3.5 h-3.5 mr-1" />
            {busy ? 'Saving…' : 'I approve'}
          </Button>
        </div>
      </div>
    </div>
  );
}
