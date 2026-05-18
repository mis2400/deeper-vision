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
  AlertTriangle,
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
        />

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
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─────────────────────── Top bar ────────────────────────────────
function BuilderTopBar({ proposal, viewerMode, setViewerMode, dirty, onSave }: {
  proposal: Proposal;
  viewerMode: ViewerMode;
  setViewerMode: (m: ViewerMode) => void;
  dirty: boolean;
  onSave: () => void;
}) {
  const statusTone = STATUS_TONE[proposal.status];
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

      {/* Save. Send + PDF + Versions land in SC.4.7 / 4.8 / 4.9. */}
      <Button
        onClick={onSave}
        disabled={!dirty || proposal.status !== 'draft'}
        data-testid="proposal-save"
      >
        <Save className="w-3.5 h-3.5 mr-1" />Save
      </Button>
    </div>
  );
}

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

function SectionEditor({ section, draft, setDraft, totals }: {
  section: SectionId;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  totals: ReturnType<typeof deriveProposalInternalTotals>;
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
        >
          <div className="mt-4">
            <label className="text-xs text-muted-foreground">Payment schedule (optional)</label>
            <textarea
              value={cv.paymentSchedule ?? ''}
              onChange={(e) => patchCv({ paymentSchedule: e.target.value })}
              placeholder="50% on signing · 40% at substantial completion · 10% on commissioning"
              rows={3}
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
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
        />
      );
    case 'lines':
      return (
        <BomLinesSection
          lines={draft.bomSnapshot}
          setLines={(updater) => setDraft((d) => ({ ...d, bomSnapshot: typeof updater === 'function' ? updater(d.bomSnapshot) : updater }))}
        />
      );
    case 'pricing':
      return (
        <PricingSection
          internalView={draft.internalView}
          patchIv={patchIv}
          totals={totals}
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

function NarrativeSection({ title, subtitle, value, onChange, minRows, testid, children }: {
  title: string;
  subtitle: string;
  value: string;
  onChange: (v: string) => void;
  minRows: number;
  testid: string;
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
        className="mt-3 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm leading-relaxed"
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

function BomLinesSection({ lines, setLines }: {
  lines: ProposalLine[];
  setLines: (updater: ProposalLine[] | ((prev: ProposalLine[]) => ProposalLine[])) => void;
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
          />
        ))}
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
      </div>
    </div>
  );
}

function BomLinesSectionGroup({ section, lines, onPatch, onRemove, onAdd }: {
  section: ProposalLine['section'];
  lines: ProposalLine[];
  onPatch: (id: string, patch: Partial<ProposalLine>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
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
          <BomLineRow key={l.id} line={l} onPatch={onPatch} onRemove={onRemove} />
        ))}
      </div>
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
    </section>
  );
}

function BomLineRow({ line, onPatch, onRemove }: {
  line: ProposalLine;
  onPatch: (id: string, patch: Partial<ProposalLine>) => void;
  onRemove: (id: string) => void;
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
          className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary px-1 py-0.5 truncate"
          data-testid={`proposal-bom-desc-${line.id}`}
        />
        <input
          value={line.internalNote ?? ''}
          onChange={(e) => onPatch(line.id, { internalNote: e.target.value })}
          placeholder="Internal note (operator only)"
          className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary px-1 text-[10.5px] text-muted-foreground italic"
          data-testid={`proposal-bom-note-${line.id}`}
        />
      </div>
      <input
        type="number"
        value={line.quantity}
        min={0}
        step={1}
        onChange={(e) => onPatch(line.id, { quantity: Number(e.target.value) || 0 })}
        className="bg-input-background border border-input-border rounded px-1.5 py-1 text-right tabular-nums"
      />
      <input
        value={line.unit}
        onChange={(e) => onPatch(line.id, { unit: e.target.value })}
        className="bg-input-background border border-input-border rounded px-1.5 py-1 text-center"
      />
      <input
        type="number"
        value={line.unitCost}
        min={0}
        step={0.01}
        onChange={(e) => onPatch(line.id, { unitCost: Number(e.target.value) || 0 })}
        className="bg-input-background border border-input-border rounded px-1.5 py-1 text-right tabular-nums"
        title="Internal unit cost. Never shown to customer."
      />
      <input
        type="number"
        value={line.unitPrice}
        min={0}
        step={0.01}
        onChange={(e) => onPatch(line.id, { unitPrice: Number(e.target.value) || 0 })}
        className="bg-input-background border border-input-border rounded px-1.5 py-1 text-right tabular-nums"
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
        onChange={(e) => onPatch(line.id, { laborHours: Number(e.target.value) || 0 })}
        className="bg-input-background border border-input-border rounded px-1.5 py-1 text-right tabular-nums"
        title="Labor hours total for this line (not per unit)."
      />
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onPatch(line.id, { hideFromCustomer: !hidden })}
          title={hidden ? 'Hidden from customer view. Click to show.' : 'Visible to customer. Click to hide.'}
          className={`p-1 rounded ${hidden ? 'text-muted-foreground/60' : 'text-foreground'} hover:bg-secondary`}
          data-testid={`proposal-bom-hide-${line.id}`}
        >
          {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onRemove(line.id)}
          title="Remove line"
          className="p-1 rounded text-rose-400 hover:bg-rose-500/10"
          data-testid={`proposal-bom-remove-${line.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────── Pricing section (SC.4.6) ───────────────
function PricingSection({ internalView, patchIv, totals, onApplyMarginToLines }: {
  internalView: ProposalInternalView;
  patchIv: (patch: Partial<ProposalInternalView>) => void;
  totals: ReturnType<typeof deriveProposalInternalTotals>;
  onApplyMarginToLines: () => void;
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
          onChange={(v) => patchIv({ laborRatePerHour: v })}
          testid="proposal-pricing-labor-rate"
        />
        <PricingInput
          label="Burden"
          suffix="%"
          value={internalView.burdenPct * 100}
          step={1}
          max={95}
          onChange={(v) => patchIv({ burdenPct: clampPct(v / 100) })}
          testid="proposal-pricing-burden"
        />
        <PricingInput
          label="Target margin"
          suffix="%"
          value={internalView.marginPct * 100}
          step={1}
          max={95}
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
            <button
              type="button"
              onClick={onApplyMarginToLines}
              className="mt-2 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15"
              data-testid="proposal-pricing-apply-margin"
            >
              Reprice every line at {pct(internalView.marginPct)} margin
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PricingInput({ label, suffix, value, step, max, onChange, testid }: {
  label: string;
  suffix: string;
  value: number;
  step: number;
  max?: number;
  onChange: (v: number) => void;
  testid: string;
}) {
  // Display value clamped to max so a 96% type in does not stick
  // in the input while the store holds 95%.
  const displayValue = typeof max === 'number' ? Math.min(max, value) : value;
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="mt-1 flex items-center bg-input-background border border-input-border rounded-md overflow-hidden">
        <input
          type="number"
          value={displayValue}
          step={step}
          max={max}
          min={0}
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
