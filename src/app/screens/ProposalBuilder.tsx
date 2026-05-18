// Proposal Builder — SC.4.4 + SC.4.5 + SC.4.6.
//
// Real wiring replaces the prior 13 line hardcoded fixture audited
// as CRITICAL gap #1. This file owns three sub passes worth of
// surface because they are tightly coupled: the scaffolding (4.4)
// only makes sense once it can render real BOM lines (4.5) with
// a real pricing waterfall (4.6) feeding the totals.
//
// Send / PDF / Version-history controls intentionally NOT rendered
// here. They appear as SC.4.7 / 4.8 / 4.9 land. Until then the
// only top bar action is Save plus the Internal / Customer-safe
// viewer toggle.
//
// Internal vs customer enforcement: the toggle is render only. The
// customer preview reads from `toCustomerView(proposal)` which is
// pure data layer stripping (no cost / labor / margin / burden /
// notes / hidden lines). Same selector is used by the PDF + portal
// + share link in subsequent passes.
//
// Pricing math: the brief assigns local math for the proposal
// pricing waterfall to this batch. CLAUDE.md notes the sibling
// `quote-engine` repo owns durable pricing math, but no API call
// exists in /src today; this surface stays self contained until a
// real endpoint lands.

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import {
  FileText, FileSignature, ScrollText, Layers, DollarSign, Lock,
  Save, Eye, EyeOff, Plus, Trash2,
  AlertTriangle, Send, Copy, Mail, Link as LinkIcon, Download,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  useProjectStore, deriveCanvasBomRows,
} from '../store/projectStore';
import {
  toCustomerView, deriveProposalInternalTotals,
  bomRowToProposalLine, applyMarginToLines, repriceAllLinesByMargin,
  DEFAULT_LABOR_RATE_PER_HOUR, DEFAULT_BURDEN_PCT, DEFAULT_MARGIN_PCT,
} from '../lib/proposalView';
import { generateProposalPdf } from '../lib/proposalPdf';
import type {
  Proposal, ProposalLine, ProposalCustomerView, ProposalInternalView,
} from '../store/types';

type SectionId =
  | 'header' | 'execSummary' | 'scope' | 'lines' | 'pricing'
  | 'terms' | 'acceptance' | 'internalNotes';

type ViewerMode = 'internal' | 'customer';

const SECTIONS_INTERNAL: { id: SectionId; label: string; icon: any }[] = [
  { id: 'header',         label: 'Header',           icon: FileText },
  { id: 'execSummary',    label: 'Executive summary', icon: ScrollText },
  { id: 'scope',          label: 'Scope',            icon: Layers },
  { id: 'lines',          label: 'BOM Lines',        icon: FileSignature },
  { id: 'pricing',        label: 'Pricing',          icon: DollarSign },
  { id: 'terms',          label: 'Terms',            icon: ScrollText },
  { id: 'acceptance',     label: 'Acceptance',       icon: FileSignature },
  { id: 'internalNotes',  label: 'Internal notes',   icon: Lock },
];

export function ProposalBuilder() {
  const { projectId = 'p1' } = useParams();

  // Subscribe to narrow slices + derive via useMemo. Avoids the
  // closure-over-state memo footgun a prior version of this file
  // had (memo deps lied about reading the full state object).
  const project        = useProjectStore((s) => s.projects[projectId]);
  const proposalsMap   = useProjectStore((s) => s.proposals);
  const createProposal = useProjectStore((s) => s.createProposal);
  const updateProposal = useProjectStore((s) => s.updateProposal);

  const projectProposals = useMemo(
    () =>
      Object.values(proposalsMap)
        .filter((p) => p.projectId === projectId)
        .sort((a, b) => b.version - a.version),
    [proposalsMap, projectId],
  );
  const latestProposal = projectProposals[0] ?? null;

  // SC.4.9 will add an explicit version override. For now: the
  // active proposal is whatever activeIdOverride points at, falling
  // through to the latest. No race window where activeProposal is
  // null while latestProposal exists.
  const [activeIdOverride, setActiveIdOverride] = useState<string | null>(null);
  const activeProposal: Proposal | null =
    (activeIdOverride && proposalsMap[activeIdOverride]) || latestProposal;

  // Click-once guard so the operator can't double-tap Create and
  // accidentally mint two proposals (which would silently orphan
  // one before activeIdOverride settles).
  const [creating, setCreating] = useState(false);

  // No proposal yet => empty state with Create CTA.
  if (!activeProposal) {
    return (
      <AppShell
        crumbs={[{ label: 'Projects', to: '/projects' }, { label: project?.name ?? 'Project', to: `/project/${projectId}` }, { label: 'Proposal' }]}
        title="Proposal Builder"
      >
        <NoProposalState
          projectId={projectId}
          busy={creating}
          onCreate={() => {
            if (creating) return;
            setCreating(true);
            try {
              // Read the live store on demand so we don't subscribe
              // the whole component to every canvas edit.
              const liveState = useProjectStore.getState();
              const bomRows = deriveCanvasBomRows(liveState, projectId).rows;
              const initialLines = bomRows
                .map(bomRowToProposalLine)
                // Drop rows that have neither price nor labor (the
                // "Opening (no hardware specified yet)" placeholders
                // are dropped here but ANY row carrying labor or
                // cost is kept so empty openings can still budget).
                .filter((l) => l.unitCost > 0 || (l.laborHours ?? 0) > 0);
              const lines = applyMarginToLines(initialLines, DEFAULT_MARGIN_PCT);

              const customerView: ProposalCustomerView = {
                header: project ? `${project.name} security system proposal` : 'Security system proposal',
                executiveSummary: 'Replace this with a short overview the customer should read first. Two or three sentences.',
                scope: 'Design, supply, install, program, and commission the security system documented in the line items below.',
                footer: 'Pricing valid for 30 days from proposal date.',
                terms: standardTerms(),
                paymentSchedule: '50% on signing · 40% at substantial completion · 10% on commissioning',
              };
              const internalView: ProposalInternalView = {
                laborRatePerHour: DEFAULT_LABOR_RATE_PER_HOUR,
                burdenPct: DEFAULT_BURDEN_PCT,
                marginPct: DEFAULT_MARGIN_PCT,
                notes: '',
              };
              const id = createProposal({
                projectId,
                customerView,
                internalView,
                bomSnapshot: lines,
                status: 'draft',
              });
              setActiveIdOverride(id);
              toast.success('Proposal created', {
                description: `${lines.length} BOM line${lines.length === 1 ? '' : 's'} populated from the canvas. Edit and save when ready.`,
              });
            } finally {
              setCreating(false);
            }
          }}
        />
      </AppShell>
    );
  }

  return (
    <BuilderShell
      projectId={projectId}
      projectName={project?.name ?? 'Project'}
      proposal={activeProposal}
      updateProposal={updateProposal}
    />
  );
}

/**
 * SC.4.7 — semantics decision: edits after sending.
 *
 * When an operator clicks Save on a proposal whose status is no
 * longer `draft` (because it was sent, approved, superseded, or
 * archived), the save is REJECTED. The operator must explicitly
 * Create New Version (SC.4.9) to spawn a fresh draft.
 *
 * Alternative considered: silently mint a draft v(n+1) on the
 * first edit after sending. Rejected because it makes the version
 * graph ambiguous (two people looking at the same project would
 * see phantom v2 drafts appear from typos), and it splits operator
 * intent across "edit means draft new version" vs the explicit
 * Create New Version button.
 *
 * Chosen approach matches the audit's CRITICAL #2 finding on
 * approval / proposal version integrity: every persisted record
 * is the result of an explicit operator action, never a silent
 * side effect.
 */

// ─────────────────────── Empty state ─────────────────────────────
function NoProposalState({ projectId, onCreate, busy }: { projectId: string; onCreate: () => void; busy: boolean }) {
  return (
    <div className="max-w-2xl mx-auto p-10 text-center">
      <div className="w-12 h-12 rounded-xl bg-secondary/60 inline-flex items-center justify-center">
        <FileSignature className="w-5 h-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium mt-4">No proposal yet for this project</h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        A proposal is a customer facing quote derived from the project's BOM. Create one to
        populate line items from the canvas, edit pricing and terms, and send to the customer
        for approval.
      </p>
      <Button className="mt-5" onClick={onCreate} disabled={busy} data-testid="proposal-create-cta">
        <Plus className="w-4 h-4 mr-1" />
        {busy ? 'Creating…' : `Create proposal for ${projectId}`}
      </Button>
    </div>
  );
}

// ─────────────────────── Builder shell ──────────────────────────
function BuilderShell({ projectId, projectName, proposal, updateProposal }: {
  projectId: string;
  projectName: string;
  proposal: Proposal;
  updateProposal: (id: string, patch: Partial<Proposal>) => void;
}) {
  const [activeSection, setActiveSection] = useState<SectionId>('lines');
  const [viewerMode, setViewerMode] = useState<ViewerMode>('internal');
  // SC.4.7 — send dialog state. Opens on Send click; closes on
  // Cancel or after the persistence + URL surface step.
  const [sendOpen, setSendOpen] = useState(false);

  // SC.4.8 — workspace branding + customer context for the PDF
  // cover. Narrow subscriptions; the handler reads them via
  // closure when the button is clicked.
  const workspaceSettings = useProjectStore((s) => s.workspaceSettings);
  const customer = useProjectStore((s) => {
    const proj = s.projects[projectId];
    return proj?.customerId ? s.customers[proj.customerId] : undefined;
  });
  const primaryContact = useProjectStore((s) => {
    const cId = customer?.primaryContactId;
    return cId ? s.contacts[cId] : undefined;
  });
  const [pdfBusy, setPdfBusy] = useState(false);

  // Local working copy. The user's edits accumulate here and land
  // on the store on Save. Reset whenever the proposal id changes.
  const [draft, setDraft] = useState<{
    customerView: ProposalCustomerView;
    internalView: ProposalInternalView;
    bomSnapshot: ProposalLine[];
  }>({
    customerView: { ...proposal.customerView },
    internalView: { ...proposal.internalView },
    bomSnapshot: proposal.bomSnapshot.map((l) => ({ ...l })),
  });
  useEffect(() => {
    setDraft({
      customerView: { ...proposal.customerView },
      internalView: { ...proposal.internalView },
      bomSnapshot: proposal.bomSnapshot.map((l) => ({ ...l })),
    });
  }, [proposal.id]);

  const dirty = useMemo(() => {
    return JSON.stringify(draft.customerView) !== JSON.stringify(proposal.customerView)
        || JSON.stringify(draft.internalView) !== JSON.stringify(proposal.internalView)
        || JSON.stringify(draft.bomSnapshot)   !== JSON.stringify(proposal.bomSnapshot);
  }, [draft, proposal]);

  const handleSave = () => {
    // Re-read status from the live store so a concurrent Send (or
    // a debug action in another tab) can't be silently overwritten
    // by a stale prop check. The prop captured at render time may
    // be a draft while the store's already moved to 'sent'.
    const current = useProjectStore.getState().proposals[proposal.id];
    if (!current || current.status !== 'draft') {
      toast.error('This version is locked.', {
        description: 'Use Create New Version to revise a sent or approved proposal.',
      });
      return;
    }
    updateProposal(proposal.id, {
      customerView: draft.customerView,
      internalView: draft.internalView,
      bomSnapshot: draft.bomSnapshot,
    });
    toast.success(`Proposal v${proposal.version} saved.`);
  };

  const totals = useMemo(
    () => deriveProposalInternalTotals({ ...proposal, ...draft }),
    [draft, proposal],
  );
  const customerArtifact = useMemo(
    () => toCustomerView({ ...proposal, ...draft }),
    [draft, proposal],
  );

  // SC.4.8 — Generate PDF handler. Reads the live customer
  // artifact (already stripped via toCustomerView) so the PDF can
  // never serialize internal cost / margin / labor data.
  const handleGeneratePdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const branding = {
        integratorName: workspaceSettings?.name,
        brandColor: workspaceSettings?.brandColor,
        logoDataUrl: workspaceSettings?.logoDataUrl,
      };
      const contactName = primaryContact
        ? [primaryContact.firstName, primaryContact.lastName].filter(Boolean).join(' ')
        : undefined;
      const filename = await generateProposalPdf(customerArtifact, {
        branding,
        customer: { companyName: customer?.companyName, contactName },
      });
      toast.success('PDF generated', { description: filename });
    } catch (err) {
      console.error('Proposal PDF generation failed', err);
      toast.error('Could not generate PDF. Try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  // SC.4.7 — lock state. A proposal that isn't a draft cannot
  // accept edits via this builder (per the architectural decision
  // documented above the BuilderShell function). Pass `locked`
  // through every editor so inputs render disabled instead of
  // pretending to accept input that will silently vanish.
  const locked = proposal.status !== 'draft';
  const lockedReason: string | null =
    proposal.status === 'sent'        ? 'This version was sent to the customer. Use Create New Version to revise.'
    : proposal.status === 'approved'  ? 'This version was approved by the customer. Use Create New Version to revise.'
    : proposal.status === 'superseded' ? 'This version was superseded by a newer one. Open the newer version to make edits.'
    : proposal.status === 'archived'  ? 'This version is archived. Open or create a draft to make edits.'
    : null;

  return (
    <AppShell
      fullBleed
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: projectName, to: `/project/${projectId}` }, { label: 'Proposal' }]}
    >
      <div className="h-full flex flex-col bg-background text-foreground">
        <BuilderTopBar
          proposal={proposal}
          viewerMode={viewerMode}
          setViewerMode={setViewerMode}
          dirty={dirty}
          onSave={handleSave}
          onSend={() => setSendOpen(true)}
          onGeneratePdf={handleGeneratePdf}
          pdfBusy={pdfBusy}
        />

        {/* SC.4.7 — lock banner for non draft proposals. Honest
            warning that edits won't persist + a pointer at the
            recovery path (Create New Version, SC.4.9). */}
        {lockedReason && (
          <div className="shrink-0 border-b border-amber-500/30 bg-amber-500/5 px-4 py-2 text-[12px] text-amber-700 flex items-center gap-2" data-testid="proposal-lock-banner">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{lockedReason}</span>
          </div>
        )}

        {viewerMode === 'customer' ? (
          <div className="flex-1 min-h-0 overflow-auto">
            <CustomerPreview artifact={customerArtifact} />
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-[200px_minmax(0,1fr)]">
            <SectionNav
              active={activeSection}
              setActive={setActiveSection}
            />
            <div className="overflow-auto p-6">
              <SectionEditor
                section={activeSection}
                draft={draft}
                setDraft={setDraft}
                totals={totals}
                locked={locked}
              />
            </div>
          </div>
        )}
      </div>

      {/* SC.4.7 — Send to Customer dialog. Renders only when
          opened from the top bar. Two phases: confirm + share. */}
      {sendOpen && (
        <SendDialog
          proposal={proposal}
          projectId={projectId}
          onClose={() => setSendOpen(false)}
        />
      )}
    </AppShell>
  );
}

// ─────────────────────── Top bar ────────────────────────────────
function BuilderTopBar({ proposal, viewerMode, setViewerMode, dirty, onSave, onSend, onGeneratePdf, pdfBusy }: {
  proposal: Proposal;
  viewerMode: ViewerMode;
  setViewerMode: (m: ViewerMode) => void;
  dirty: boolean;
  onSave: () => void;
  onSend: () => void;
  onGeneratePdf: () => void;
  pdfBusy: boolean;
}) {
  const statusTone = STATUS_TONE[proposal.status];
  // SC.4.7 — Send is only available on a clean draft. A dirty
  // draft must be saved first (so what's sent matches what's in
  // the store). A non draft is already locked.
  const canSend = proposal.status === 'draft' && !dirty;
  return (
    <div className="shrink-0 border-b border-border bg-background/95 px-4 py-2.5 flex items-center gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <FileSignature className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate">Proposal · v{proposal.version}</span>
        <span className={`inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusTone}`}>
          {proposal.status}
        </span>
        {dirty && proposal.status === 'draft' && (
          <span className="inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-500">
            Unsaved
          </span>
        )}
      </div>
      <div className="flex-1" />

      {/* Viewer toggle */}
      <div className="inline-flex items-stretch h-8 rounded-md border border-border overflow-hidden">
        <button
          onClick={() => setViewerMode('internal')}
          className={`px-2.5 text-[12px] inline-flex items-center gap-1 ${viewerMode === 'internal' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          data-testid="proposal-viewer-internal"
        >
          <EyeOff className="w-3.5 h-3.5" />Internal
        </button>
        <button
          onClick={() => setViewerMode('customer')}
          className={`px-2.5 text-[12px] inline-flex items-center gap-1 border-l border-border ${viewerMode === 'customer' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          data-testid="proposal-viewer-customer"
        >
          <Eye className="w-3.5 h-3.5" />Customer preview
        </button>
      </div>

      <Button
        onClick={onSave}
        disabled={!dirty || proposal.status !== 'draft'}
        data-testid="proposal-save"
        variant="outline"
      >
        <Save className="w-3.5 h-3.5 mr-1" />Save
      </Button>

      {/* SC.4.8 — Generate PDF. Renders on every status except
          archived. PDF reads the customer view artifact only, so
          it physically cannot leak internal data — same data layer
          enforcement as the portal render and the Send dialog. */}
      {proposal.status !== 'archived' && (
        <Button
          onClick={onGeneratePdf}
          disabled={pdfBusy}
          variant="outline"
          data-testid="proposal-generate-pdf"
          title="Generate a customer safe PDF of this proposal"
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          {pdfBusy ? 'Generating…' : 'PDF'}
        </Button>
      )}

      {/* SC.4.7 — Send to Customer. Only renders on a draft so
          the honesty contract holds (no disabled "Send" sitting
          on a sent proposal pretending the action is meaningful).
          Non draft statuses get a status hint so the operator
          isn't staring at empty space wondering why Send is gone. */}
      {proposal.status === 'draft' ? (
        <Button
          onClick={onSend}
          disabled={!canSend}
          data-testid="proposal-send"
          title={canSend ? 'Send to customer' : 'Save your changes before sending'}
        >
          <Send className="w-3.5 h-3.5 mr-1" />Send to customer
        </Button>
      ) : (
        <span className="text-[11px] text-muted-foreground" data-testid="proposal-status-hint">
          {STATUS_HINT[proposal.status]} {proposal.sentAt ? new Date(proposal.sentAt).toLocaleDateString() : ''}
        </span>
      )}
    </div>
  );
}

const STATUS_HINT: Record<Proposal['status'], string> = {
  draft:      'Draft',
  sent:       'Sent',
  approved:   'Approved',
  superseded: 'Superseded',
  archived:   'Archived',
};

const STATUS_TONE: Record<Proposal['status'], string> = {
  draft:       'border-border text-muted-foreground bg-secondary',
  sent:        'border-sky-500/40 bg-sky-500/10 text-sky-300',
  approved:    'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  superseded:  'border-amber-500/40 bg-amber-500/10 text-amber-300',
  archived:    'border-slate-500/40 bg-slate-500/10 text-slate-300',
};

// ─────────────────────── Section nav ────────────────────────────
function SectionNav({ active, setActive }: {
  active: SectionId;
  setActive: (id: SectionId) => void;
}) {
  return (
    <nav className="border-r border-border bg-background/40 p-2 space-y-0.5" data-testid="proposal-section-nav">
      {SECTIONS_INTERNAL.map((s) => {
        const Icon = s.icon;
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`w-full text-left px-2.5 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/30'
            }`}
            data-testid={`proposal-section-${s.id}`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─────────────────────── Section editor ─────────────────────────
type Draft = {
  customerView: ProposalCustomerView;
  internalView: ProposalInternalView;
  bomSnapshot: ProposalLine[];
};

function SectionEditor({ section, draft, setDraft, totals, locked }: {
  section: SectionId;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  totals: ReturnType<typeof deriveProposalInternalTotals>;
  locked: boolean;
}) {
  const cv = draft.customerView;
  const iv = draft.internalView;
  const patchCv = (patch: Partial<ProposalCustomerView>) =>
    setDraft((d) => ({ ...d, customerView: { ...d.customerView, ...patch } }));
  const patchIv = (patch: Partial<ProposalInternalView>) =>
    setDraft((d) => ({ ...d, internalView: { ...d.internalView, ...patch } }));

  switch (section) {
    case 'header':
      return (
        <NarrativeSection
          title="Header"
          subtitle="Headline at the top of the proposal. Keep it short."
          value={cv.header}
          onChange={(v) => patchCv({ header: v })}
          minRows={2}
          testid="proposal-edit-header"
          locked={locked}
        />
      );
    case 'execSummary':
      return (
        <NarrativeSection
          title="Executive summary"
          subtitle="Two or three sentences the customer should read first. Outcome, scope, timeline."
          value={cv.executiveSummary}
          onChange={(v) => patchCv({ executiveSummary: v })}
          minRows={4}
          testid="proposal-edit-exec"
          locked={locked}
        />
      );
    case 'scope':
      return (
        <NarrativeSection
          title="Scope of work"
          subtitle="Plain English description of what the line items below deliver."
          value={cv.scope}
          onChange={(v) => patchCv({ scope: v })}
          minRows={6}
          testid="proposal-edit-scope"
          locked={locked}
        />
      );
    case 'terms':
      return (
        <NarrativeSection
          title="Terms"
          subtitle="Contract terms attached as is to the customer PDF."
          value={cv.terms}
          onChange={(v) => patchCv({ terms: v })}
          minRows={10}
          testid="proposal-edit-terms"
          locked={locked}
        />
      );
    case 'acceptance':
      return (
        <NarrativeSection
          title="Acceptance"
          subtitle="Closing copy above the customer signature block. Payment schedule lives below."
          value={cv.footer}
          onChange={(v) => patchCv({ footer: v })}
          minRows={3}
          testid="proposal-edit-acceptance"
          locked={locked}
        >
          <div className="mt-4">
            <label className="text-xs text-muted-foreground">Payment schedule (optional)</label>
            <textarea
              value={cv.paymentSchedule ?? ''}
              onChange={(e) => patchCv({ paymentSchedule: e.target.value })}
              placeholder="50% on signing · 40% at substantial completion · 10% on commissioning"
              rows={3}
              disabled={locked}
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="proposal-edit-payment-schedule"
            />
          </div>
        </NarrativeSection>
      );
    case 'internalNotes':
      return (
        <NarrativeSection
          title="Internal notes"
          subtitle="Operator only. Never shown to the customer, never serialized into the PDF."
          value={iv.notes ?? ''}
          onChange={(v) => patchIv({ notes: v })}
          minRows={6}
          testid="proposal-edit-internal-notes"
          locked={locked}
        />
      );
    case 'lines':
      return (
        <BomLinesSection
          lines={draft.bomSnapshot}
          setLines={(updater) => setDraft((d) => ({ ...d, bomSnapshot: typeof updater === 'function' ? updater(d.bomSnapshot) : updater }))}
          locked={locked}
        />
      );
    case 'pricing':
      return (
        <PricingSection
          internalView={draft.internalView}
          patchIv={patchIv}
          totals={totals}
          locked={locked}
          onApplyMarginToLines={() => {
            setDraft((d) => ({
              ...d,
              bomSnapshot: repriceAllLinesByMargin(d.bomSnapshot, d.internalView.marginPct),
            }));
            toast.success('Margin applied to every line', {
              description: `All sell prices recomputed at ${(draft.internalView.marginPct * 100).toFixed(0)}% target margin.`,
            });
          }}
        />
      );
    default:
      return null;
  }
}

function NarrativeSection({ title, subtitle, value, onChange, minRows, testid, locked, children }: {
  title: string;
  subtitle: string;
  value: string;
  onChange: (v: string) => void;
  minRows: number;
  testid: string;
  locked?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      <h2 className="text-base font-medium">{title}</h2>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={minRows}
        disabled={locked}
        className="mt-3 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
        data-testid={testid}
      />
      {children}
    </div>
  );
}

// ─────────────────────── BOM Lines section (SC.4.5) ─────────────
const SECTION_LABEL: Record<ProposalLine['section'], string> = {
  cameras:        'Cameras',
  access:         'Access control',
  cabling:        'Cabling',
  conduit:        'Conduit',
  walls:          'Walls',
  infrastructure: 'Infrastructure',
  labor:          'Labor',
  other:          'Other',
};

function BomLinesSection({ lines, setLines, locked }: {
  lines: ProposalLine[];
  setLines: (updater: ProposalLine[] | ((prev: ProposalLine[]) => ProposalLine[])) => void;
  locked: boolean;
}) {
  const grouped = useMemo(() => {
    const m = new Map<ProposalLine['section'], ProposalLine[]>();
    for (const l of lines) {
      const arr = m.get(l.section) ?? [];
      arr.push(l);
      m.set(l.section, arr);
    }
    return m;
  }, [lines]);

  const patchLine = (id: string, patch: Partial<ProposalLine>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.id !== id));
  const addCustomLine = (section: ProposalLine['section']) => {
    setLines((prev) => [
      ...prev,
      {
        id: `pl-custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        section,
        description: 'Custom line item',
        quantity: 1,
        unit: 'ea',
        unitCost: 0,
        unitPrice: 0,
        laborHours: 0,
        // Start hidden so a $0 placeholder line never leaks into
        // the customer preview. Operator un hides once priced.
        hideFromCustomer: true,
      },
    ]);
  };

  return (
    <div className="max-w-5xl">
      <h2 className="text-base font-medium">BOM Lines</h2>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        Each line is editable. Cost columns are internal only and never reach the customer view.
        Hide a line from the customer with the eye toggle (the cost stays in the internal totals).
      </p>

      <div className="mt-4 space-y-5">
        {Array.from(grouped.entries()).map(([section, sectionLines]) => (
          <BomLinesSectionGroup
            key={section}
            section={section}
            lines={sectionLines}
            onPatch={patchLine}
            onRemove={removeLine}
            onAdd={() => addCustomLine(section)}
            locked={locked}
          />
        ))}
        {!locked && (
          <div className="border border-dashed border-border rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-2">Add a line to a new section</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SECTION_LABEL) as ProposalLine['section'][])
                .filter((s) => !grouped.has(s))
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addCustomLine(s)}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-border-strong"
                  >
                    <Plus className="w-3 h-3" />{SECTION_LABEL[s]}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BomLinesSectionGroup({ section, lines, onPatch, onRemove, onAdd, locked }: {
  section: ProposalLine['section'];
  lines: ProposalLine[];
  onPatch: (id: string, patch: Partial<ProposalLine>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  locked: boolean;
}) {
  const subtotalCost = lines.reduce((s, l) => s + l.unitCost * l.quantity, 0);
  const subtotalSell = lines
    .filter((l) => !l.hideFromCustomer)
    .reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  return (
    <section className="rounded-lg border border-border" data-testid={`proposal-bom-group-${section}`}>
      <header className="px-3 py-2 border-b border-border flex items-center justify-between bg-secondary/20">
        <div className="text-[12px] font-medium uppercase tracking-wider">{SECTION_LABEL[section]}</div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {lines.length} line{lines.length === 1 ? '' : 's'} · Cost ${formatMoney(subtotalCost)} · Sell ${formatMoney(subtotalSell)}
        </div>
      </header>
      {/* Column header row so labor semantics are visible without
          relying on the per cell tooltips. */}
      <div className="grid grid-cols-[1fr_70px_70px_90px_90px_90px_70px_36px] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-secondary/10">
        <div>Description</div>
        <div className="text-right">Qty</div>
        <div className="text-center">Unit</div>
        <div className="text-right">Cost</div>
        <div className="text-right">Sell</div>
        <div className="text-right">Line sell</div>
        <div className="text-right" title="Labor hours total for this line, not per unit">Labor hrs</div>
        <div />
      </div>
      <div className="divide-y divide-border">
        {lines.map((l) => (
          <BomLineRow key={l.id} line={l} onPatch={onPatch} onRemove={onRemove} locked={locked} />
        ))}
      </div>
      {!locked && (
        <footer className="px-3 py-2 border-t border-border/50">
          <button
            type="button"
            onClick={onAdd}
            className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
            data-testid={`proposal-bom-add-${section}`}
          >
            <Plus className="w-3 h-3" />Add custom line
          </button>
        </footer>
      )}
    </section>
  );
}

function BomLineRow({ line, onPatch, onRemove, locked }: {
  line: ProposalLine;
  onPatch: (id: string, patch: Partial<ProposalLine>) => void;
  onRemove: (id: string) => void;
  locked: boolean;
}) {
  const lineCost = line.unitCost * line.quantity;
  const lineSell = line.unitPrice * line.quantity;
  const hidden = !!line.hideFromCustomer;
  return (
    <div
      className={`grid grid-cols-[1fr_70px_70px_90px_90px_90px_70px_36px] gap-2 px-3 py-2 items-center text-[12px] ${hidden ? 'opacity-60' : ''}`}
      data-testid={`proposal-bom-row-${line.id}`}
    >
      <div className="min-w-0">
        <input
          value={line.description}
          onChange={(e) => onPatch(line.id, { description: e.target.value })}
          disabled={locked}
          className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary px-1 py-0.5 truncate disabled:hover:border-transparent"
          data-testid={`proposal-bom-desc-${line.id}`}
        />
        <input
          value={line.internalNote ?? ''}
          onChange={(e) => onPatch(line.id, { internalNote: e.target.value })}
          placeholder="Internal note (operator only)"
          disabled={locked}
          className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary px-1 text-[10.5px] text-muted-foreground italic disabled:hover:border-transparent"
          data-testid={`proposal-bom-note-${line.id}`}
        />
      </div>
      <input
        type="number"
        value={line.quantity}
        min={0}
        step={1}
        disabled={locked}
        onChange={(e) => onPatch(line.id, { quantity: Number(e.target.value) || 0 })}
        className="bg-input-background border border-input-border rounded px-1.5 py-1 text-right tabular-nums"
      />
      <input
        value={line.unit}
        onChange={(e) => onPatch(line.id, { unit: e.target.value })}
        disabled={locked}
        className="bg-input-background border border-input-border rounded px-1.5 py-1 text-center disabled:opacity-60"
      />
      <input
        type="number"
        value={line.unitCost}
        min={0}
        step={0.01}
        disabled={locked}
        onChange={(e) => onPatch(line.id, { unitCost: Number(e.target.value) || 0 })}
        className="bg-input-background border border-input-border rounded px-1.5 py-1 text-right tabular-nums disabled:opacity-60"
        title="Internal unit cost. Never shown to customer."
      />
      <input
        type="number"
        value={line.unitPrice}
        min={0}
        step={0.01}
        disabled={locked}
        onChange={(e) => onPatch(line.id, { unitPrice: Number(e.target.value) || 0 })}
        className="bg-input-background border border-input-border rounded px-1.5 py-1 text-right tabular-nums disabled:opacity-60"
        title="Customer facing sell price per unit."
        data-testid={`proposal-bom-price-${line.id}`}
      />
      <div className="text-right tabular-nums text-muted-foreground" title={`Cost $${formatMoney(lineCost)}`}>
        ${formatMoney(lineSell)}
      </div>
      <input
        type="number"
        value={line.laborHours ?? 0}
        min={0}
        step={0.1}
        disabled={locked}
        onChange={(e) => onPatch(line.id, { laborHours: Number(e.target.value) || 0 })}
        className="bg-input-background border border-input-border rounded px-1.5 py-1 text-right tabular-nums disabled:opacity-60"
        title="Labor hours total for this line (not per unit)."
      />
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onPatch(line.id, { hideFromCustomer: !hidden })}
          disabled={locked}
          title={hidden ? 'Hidden from customer view. Click to show.' : 'Visible to customer. Click to hide.'}
          className={`p-1 rounded ${hidden ? 'text-muted-foreground/60' : 'text-foreground'} hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent`}
          data-testid={`proposal-bom-hide-${line.id}`}
        >
          {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onRemove(line.id)}
          disabled={locked}
          title="Remove line"
          className="p-1 rounded text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 disabled:hover:bg-transparent"
          data-testid={`proposal-bom-remove-${line.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────── Pricing section (SC.4.6) ───────────────
function PricingSection({ internalView, patchIv, totals, onApplyMarginToLines, locked }: {
  internalView: ProposalInternalView;
  patchIv: (patch: Partial<ProposalInternalView>) => void;
  totals: ReturnType<typeof deriveProposalInternalTotals>;
  onApplyMarginToLines: () => void;
  locked: boolean;
}) {
  const customerDelta = totals.customerSubtotal - totals.sellTotal;
  const customerDeltaSignificant = Math.abs(customerDelta) > 1;
  return (
    <div className="max-w-3xl">
      <h2 className="text-base font-medium flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-muted-foreground" />
        Pricing
      </h2>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        Internal only. The customer view shows the sum of line items plus payment schedule.
        Burden, margin, and labor rate are never serialized to the customer artifact.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <PricingInput
          label="Labor rate"
          suffix="$/hr"
          value={internalView.laborRatePerHour}
          step={1}
          disabled={locked}
          onChange={(v) => patchIv({ laborRatePerHour: v })}
          testid="proposal-pricing-labor-rate"
        />
        <PricingInput
          label="Burden"
          suffix="%"
          value={internalView.burdenPct * 100}
          step={1}
          max={95}
          disabled={locked}
          onChange={(v) => patchIv({ burdenPct: clampPct(v / 100) })}
          testid="proposal-pricing-burden"
        />
        <PricingInput
          label="Target margin"
          suffix="%"
          value={internalView.marginPct * 100}
          step={1}
          max={95}
          disabled={locked}
          onChange={(v) => patchIv({ marginPct: clampPct(v / 100) })}
          testid="proposal-pricing-margin"
        />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-secondary/20 divide-y divide-border" data-testid="proposal-pricing-waterfall">
        <WaterfallRow label="Equipment cost"        value={`$${formatMoney(totals.costSubtotal)}`} />
        <WaterfallRow label={`Labor (${totals.laborHours} hr)`} value={`$${formatMoney(totals.laborCost)}`} />
        <WaterfallRow label={`Burden (${pct(internalView.burdenPct)})`} value={`$${formatMoney(totals.burdenCost)}`} />
        <WaterfallRow label="Loaded cost"           value={`$${formatMoney(totals.loadedCost)}`} bold />
        <WaterfallRow label={`Target margin (${pct(internalView.marginPct)})`} value={`$${formatMoney(totals.grossProfit)}`} />
        <WaterfallRow label={`Target sell at GP ${pct(totals.gpPct)}`} value={`$${formatMoney(totals.sellTotal)}`} bold highlight />
        {/* Customer-facing total is the source of truth — surface
            it next to the target so the operator sees both. */}
        <WaterfallRow label="Customer line items total" value={`$${formatMoney(totals.customerSubtotal)}`} bold />
      </div>

      {customerDeltaSignificant && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div>
              Customer line items total ${formatMoney(totals.customerSubtotal)} differs from the
              margin target ${formatMoney(totals.sellTotal)} by {customerDelta > 0 ? '+' : ''}${formatMoney(customerDelta)}.
              The customer signs the line items total; the target margin is operator only.
            </div>
            {!locked && (
              <button
                type="button"
                onClick={onApplyMarginToLines}
                className="mt-2 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15"
                data-testid="proposal-pricing-apply-margin"
              >
                Reprice every line at {pct(internalView.marginPct)} margin
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PricingInput({ label, suffix, value, step, max, disabled, onChange, testid }: {
  label: string;
  suffix: string;
  value: number;
  step: number;
  max?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  testid: string;
}) {
  // Display value clamped to max so a 96% type in does not stick
  // in the input while the store holds 95%.
  const displayValue = typeof max === 'number' ? Math.min(max, value) : value;
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className={`mt-1 flex items-center bg-input-background border border-input-border rounded-md overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
        <input
          type="number"
          value={displayValue}
          step={step}
          max={max}
          min={0}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-right tabular-nums focus:outline-none"
          data-testid={testid}
        />
        <span className="px-2 text-xs text-muted-foreground border-l border-input-border">{suffix}</span>
      </div>
    </div>
  );
}

function WaterfallRow({ label, value, bold, highlight }: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`px-4 py-2.5 flex items-center justify-between ${highlight ? 'bg-primary/5' : ''}`}>
      <span className={`text-[12px] ${bold ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-[13px] tabular-nums ${bold ? 'text-foreground font-medium' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

// ─────────────────────── Customer preview ───────────────────────
function CustomerPreview({ artifact }: {
  artifact: ReturnType<typeof toCustomerView>;
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
    <div className="max-w-4xl mx-auto p-8 space-y-6" data-testid="proposal-customer-preview">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Customer preview · v{artifact.version}</div>
      <h1 className="text-2xl font-medium">{artifact.customerView.header}</h1>

      <CustomerBlock title="Executive summary">{artifact.customerView.executiveSummary}</CustomerBlock>
      <CustomerBlock title="Scope of work">{artifact.customerView.scope}</CustomerBlock>

      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">Line items</h2>
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([section, lines]) => {
            const sectionSub = lines.reduce((s, l) => s + l.lineTotal, 0);
            return (
              <section key={section} className="border border-border rounded-lg overflow-hidden">
                <header className="px-3 py-2 bg-secondary/30 flex items-center justify-between">
                  <div className="text-[12px] font-medium uppercase tracking-wider">{SECTION_LABEL[section]}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">Subtotal ${formatMoney(sectionSub)}</div>
                </header>
                <table className="w-full text-[12px]">
                  <thead className="text-muted-foreground bg-secondary/10">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-normal">Description</th>
                      <th className="text-right px-3 py-1.5 font-normal w-20">Qty</th>
                      <th className="text-right px-3 py-1.5 font-normal w-24">Unit</th>
                      <th className="text-right px-3 py-1.5 font-normal w-28">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-t border-border">
                        <td className="px-3 py-1.5">{l.description}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{l.quantity} {l.unit}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">${formatMoney(l.unitPrice)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">${formatMoney(l.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-2">
        <div className="flex items-center justify-between text-base font-medium">
          <span>Project total</span>
          <span className="tabular-nums">${formatMoney(artifact.totals.sellTotal)}</span>
        </div>
        {artifact.paymentSchedule && (
          <div className="text-[12px] text-muted-foreground">{artifact.paymentSchedule}</div>
        )}
      </div>

      {artifact.customerView.footer && (
        <CustomerBlock title="Acceptance">{artifact.customerView.footer}</CustomerBlock>
      )}
      {artifact.customerView.terms && (
        <CustomerBlock title="Terms">{artifact.customerView.terms}</CustomerBlock>
      )}
    </div>
  );
}

function CustomerBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">{title}</h2>
      <div className="text-[14px] leading-relaxed whitespace-pre-wrap">{children}</div>
    </div>
  );
}

// ─────────────────────── Helpers ───────────────────────────────
function formatMoney(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(0.95, Math.max(0, n));
}

function standardTerms(): string {
  return [
    'Pricing is valid for 30 days from the proposal date.',
    'Tax, permits, and inspection fees are not included unless explicitly listed above.',
    'A 50% deposit is required to release equipment procurement.',
    'Substantial completion is defined as the moment all line items are installed and powered.',
    'Warranty terms attach as a separate document and follow each manufacturer\'s standard coverage period.',
  ].join('\n\n');
}

// ─────────────────────── Send dialog (SC.4.7) ────────────────────
// Two phase modal. Phase 1 ("confirm"): pick a contact + validate
// the proposal has the minimum required fields. Phase 2 ("share"):
// surface the customer portal URL with a Copy button and a
// mailto: helper that opens the operator's email client. The
// honesty rule means no fake "Email sent" toasts; the operator
// shares the link manually.
function SendDialog({ proposal, projectId, onClose }: {
  proposal: Proposal;
  projectId: string;
  onClose: () => void;
}) {
  // Build the contact options from the project's customer record.
  const project = useProjectStore((s) => s.projects[projectId]);
  const customer = useProjectStore((s) =>
    project?.customerId ? s.customers[project.customerId] : undefined,
  );
  const allContacts = useProjectStore((s) => s.contacts);
  const updateProposal = useProjectStore((s) => s.updateProposal);

  const contacts = useMemo(() => {
    if (!customer) return [];
    const out = Object.values(allContacts).filter((c) => c.customerId === customer.id);
    // Primary first.
    out.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    return out;
  }, [allContacts, customer]);

  const [phase, setPhase] = useState<'confirm' | 'share'>('confirm');
  // Guard against an orphan `sentTo` (a contact id that no longer
  // exists in the customer's contacts). Falls back to the first
  // available contact id, then empty string.
  const initialContactId = useMemo(() => {
    if (proposal.sentTo && contacts.some((c) => c.id === proposal.sentTo)) return proposal.sentTo;
    return contacts[0]?.id ?? '';
  }, [proposal.sentTo, contacts]);
  const [selectedContactId, setSelectedContactId] = useState<string>(initialContactId);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Validation. Required fields for sending: a non empty header,
  // at least one BOM line visible to the customer, AND a non zero
  // customer total. The last check protects against a $0 proposal
  // (every visible line has qty 0 or price 0).
  const visibleLines = proposal.bomSnapshot.filter((l) => !l.hideFromCustomer);
  const customerTotal = visibleLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const validationErrors: string[] = [];
  if (!proposal.customerView.header.trim()) validationErrors.push('Header is empty');
  if (visibleLines.length === 0) validationErrors.push('Customer view has zero line items (every line is hidden)');
  else if (customerTotal <= 0) validationErrors.push('Customer total is $0. Set quantities and sell prices before sending.');

  const selectedContact = contacts.find((c) => c.id === selectedContactId);
  const portalUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/portal/${projectId}`
      : `/portal/${projectId}`;

  const handleSend = () => {
    if (validationErrors.length > 0) return;
    setBusy(true);
    try {
      // Re read status from the store so a concurrent Send / supersede
      // can't be silently overwritten.
      const current = useProjectStore.getState().proposals[proposal.id];
      if (!current || current.status !== 'draft') {
        toast.error('Proposal is no longer a draft.');
        setBusy(false);
        return;
      }
      updateProposal(proposal.id, {
        status: 'sent',
        sentAt: Date.now(),
        sentTo: selectedContactId || undefined,
      });
      setPhase('share');
      toast.success(`Proposal v${proposal.version} marked sent.`);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  const mailtoHref = (() => {
    const to = selectedContact?.email ?? '';
    const subject = encodeURIComponent(
      `${proposal.customerView.header || 'Security proposal'} · v${proposal.version}`,
    );
    const greeting = selectedContact?.firstName ? `Hi ${selectedContact.firstName},\n\n` : '';
    const body = encodeURIComponent(
      `${greeting}Your proposal is ready to review and approve at the link below.\n\n${portalUrl}\n\nReach out if you have any questions.`,
    );
    return `mailto:${to}?subject=${subject}&body=${body}`;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-6" data-testid="proposal-send-dialog">
      <div className="bg-card w-full sm:max-w-md sm:rounded-xl shadow-2xl border-t sm:border border-border max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-medium">
            {phase === 'confirm' ? `Send proposal v${proposal.version}` : `Proposal v${proposal.version} sent`}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {phase === 'confirm'
              ? 'Marks the proposal sent and makes it visible on the customer portal. Edits will require Create New Version.'
              : 'Share the link below with the customer so they can review and approve.'}
          </div>
        </div>

        {phase === 'confirm' ? (
          <div className="px-5 py-4 space-y-3">
            {validationErrors.length > 0 && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Can't send yet</div>
                  <ul className="list-disc pl-4 mt-1">
                    {validationErrors.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground">Send to</label>
              {contacts.length > 0 ? (
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
                  data-testid="proposal-send-contact"
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.firstName, c.lastName].filter(Boolean).join(' ')}{c.isPrimary ? ' · primary' : ''}{c.email ? ` · ${c.email}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1 rounded-md border border-dashed border-border bg-secondary/20 px-3 py-2 text-[11px] text-muted-foreground">
                  No contacts on file for this customer. The proposal will still be sent; you'll need to share the link manually after.
                </div>
              )}
            </div>

            <div className="text-[11px] text-muted-foreground">
              The customer portal will show this proposal version as the current live version.
              The Save button locks on send; revisions require Create New Version.
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Customer portal link</label>
              <div className="mt-1 flex items-stretch border border-input-border rounded-md overflow-hidden">
                <div className="flex-1 px-3 py-2 text-[12px] bg-input-background font-mono truncate" data-testid="proposal-share-url">
                  {portalUrl}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 inline-flex items-center gap-1 text-[12px] border-l border-input-border hover:bg-secondary"
                  data-testid="proposal-share-copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {selectedContact?.email && (
              <a
                href={mailtoHref}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                data-testid="proposal-share-mailto"
              >
                <Mail className="w-3.5 h-3.5" />
                Open mail to {selectedContact.firstName || selectedContact.email}
              </a>
            )}

            <div className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <LinkIcon className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                The portal is the live customer surface. Share this link by email, Slack, or any
                channel you already use. No email is sent automatically.
              </span>
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          {phase === 'confirm' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="inline-flex items-center h-8 px-3 rounded-md text-[12px] text-muted-foreground hover:text-foreground border border-border"
              >Cancel</button>
              <Button
                onClick={handleSend}
                disabled={busy || validationErrors.length > 0}
                data-testid="proposal-send-confirm"
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                {busy ? 'Sending…' : 'Confirm send'}
              </Button>
            </>
          ) : (
            <Button onClick={onClose} data-testid="proposal-send-done">
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
