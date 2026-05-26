// DV Assist Phase 1 — canvas panel shell.
//
// Persistent in canvas consultant. Lives at the bottom right of the
// canvas surface. Three modes: Passive (observes, available for
// questions), Suggestion (surfaces findings proactively — DVA.5
// wires real findings into this slot), Action (executes approved
// changes — DVA.6 wires the Action mode body).
//
// Shared brain with /ai/:projectId: both surfaces read the same
// `aiConversations` slice in the store and can hand context back
// and forth via `assistantContext`. Two views, one mind.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles, ChevronUp, ChevronDown, ExternalLink,
  AlertCircle, AlertTriangle, Info, CircleCheck,
  Undo2, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { useProjectStore } from '../../store/projectStore';
import type { AiAction, AssistantPanelMode } from '../../store/types';
import { runAllRules, type Finding, type FindingSeverity, type SuggestedFix } from '../../lib/assistantRules';
import { executeAction, undoAction } from '../../lib/assistantActions';
import {
  BULK_PRESETS, previewBulkOperation, executeBulkOperation, undoBulkOperation,
  type BulkPreset,
} from '../../lib/bulkOperations';
import { DesignReview } from './DesignReview';
import { ClipboardCheck } from 'lucide-react';

interface Props {
  projectId: string;
}

// Mode tag tones — semantic tokens only, no hardcoded hex.
// Passive reads as restful; Suggestion as alert (but not loud); Action
// as decisive. All three use the same accent system so the panel feels
// like one consistent surface across mode switches.
const MODE_LABEL: Record<AssistantPanelMode, string> = {
  passive: 'Passive',
  suggestion: 'Suggestion',
  action: 'Action',
};

const MODE_DESCRIPTION: Record<AssistantPanelMode, string> = {
  passive: 'Observing. Ready to answer questions.',
  suggestion: 'Surfacing findings as you design.',
  action: 'Approved fixes will execute from here.',
};

export function AssistantPanel({ projectId }: Props) {
  const mode = useProjectStore((s) => s.assistantPanelMode);
  const setMode = useProjectStore((s) => s.setAssistantPanelMode);
  const [open, setOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Track viewport for the mobile bottom sheet variant.
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Esc closes the expanded panel. Click outside does NOT close — the
  // panel is an ambient surface; accidental dismissal mid task is
  // worse than an extra tap. Matches the V3.3 drawer contract.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Collapsed affordance — small floating pill. Visible at all times
  // when the canvas is mounted. Restrained chrome per V3.9.
  if (!open) {
    return (
      <>
        <button
          data-testid="assistant-panel-trigger"
          onClick={() => setOpen(true)}
          title="Open DV Assist"
          /* Audit Group A.2 (second pass) — DV Assist used to sit at
             bottom-3 right-3 where it visually stacked next to the
             docked bottom toolbar. The new docked edit panel (Group
             C.6) lives in the same bottom region; lifting the trigger
             to bottom-[148px] clears both the tray and a collapsed
             edit panel, so a control never ends up tucked behind it. */
          className="absolute bottom-[148px] right-3 z-40 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border shadow-md text-foreground hover:bg-secondary/40 transition-colors"
          style={{
            // V3.9 motion discipline: opacity + color only, no scale, no
            // bounce. 120ms standard token.
            transitionDuration: 'var(--motion-fast, 120ms)',
          }}
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-[12px] font-medium tracking-tight">DV Assist</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{MODE_LABEL[mode]}</span>
          <ChevronUp className="w-3 h-3 text-muted-foreground" />
        </button>
        <DesignReview projectId={projectId} open={reviewOpen} onClose={() => setReviewOpen(false)} />
      </>
    );
  }

  // Expanded surface. On desktop a fixed card pinned bottom right; on
  // mobile a bottom sheet covering ~60% of the viewport. Either way
  // restrained chrome and a clear mode selector.
  const expandedClass = isMobile
    ? 'absolute left-3 right-3 bottom-3 z-40 max-h-[60vh] rounded-xl border border-border bg-card shadow-lg overflow-hidden flex flex-col'
    : 'absolute bottom-3 right-3 z-40 w-[360px] max-h-[420px] rounded-xl border border-border bg-card shadow-lg overflow-hidden flex flex-col';

  return (
    <div
      ref={panelRef}
      data-testid="assistant-panel"
      data-mode={mode}
      className={expandedClass}
      style={{ transitionDuration: 'var(--motion-standard, 200ms)' }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/40 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-[13px] font-semibold tracking-tight text-foreground">DV Assist</span>
        <span className="ml-auto inline-flex items-center gap-1">
          <button
            data-testid="assistant-panel-review"
            onClick={() => setReviewOpen(true)}
            title="Run final design review"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
          </button>
          <button
            data-testid="assistant-panel-open-route"
            onClick={() => navigate(`/ai/${projectId}`)}
            title="Open the full conversation history"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            data-testid="assistant-panel-close"
            onClick={() => setOpen(false)}
            title="Close (Esc)"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </span>
      </div>

      {/* Mode selector — three pill buttons. Active mode reads as a
          solid block with high contrast; inactive modes outlined. */}
      <div className="px-3 py-2 border-b border-border/40 grid grid-cols-3 gap-1">
        {(['passive', 'suggestion', 'action'] as AssistantPanelMode[]).map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              data-testid={`assistant-mode-${m}`}
              data-active={active ? 'true' : undefined}
              onClick={() => setMode(m)}
              className={`py-1.5 rounded-md text-[11px] font-medium tracking-tight transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-border/40'
              }`}
              style={{ transitionDuration: 'var(--motion-fast, 120ms)' }}
            >
              {MODE_LABEL[m]}
            </button>
          );
        })}
      </div>

      {/* Mode body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 text-[12px] leading-relaxed text-foreground">
        {mode === 'passive' && (
          <PassiveBody projectId={projectId} onNavigate={() => navigate(`/ai/${projectId}`)} />
        )}
        {mode === 'suggestion' && (
          <SuggestionBody projectId={projectId} />
        )}
        {mode === 'action' && (
          <ActionBody projectId={projectId} />
        )}
      </div>
      <DesignReview projectId={projectId} open={reviewOpen} onClose={() => setReviewOpen(false)} />
    </div>
  );
}

// ────────────────────────────── Mode bodies ─────────────────────────

function PassiveBody({ projectId, onNavigate }: { projectId: string; onNavigate: () => void }) {
  const convCount = useProjectStore((s) =>
    Object.values(s.aiConversations).filter((c) => c.projectId === projectId).length);
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">{MODE_DESCRIPTION.passive}</p>
      <p className="text-foreground/80">
        Switch to Suggestion to see real time findings as you design, or open the full conversation history to ask a question.
      </p>
      <button
        onClick={onNavigate}
        className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline"
      >
        Open conversation history
        {convCount > 0 && (
          <span className="text-muted-foreground">({convCount})</span>
        )}
        <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  );
}

// DVA.5 — real findings into Suggestion mode. The panel subscribes
// to the slices the rules engine needs and re-runs the rules on each
// store update. Findings are sorted critical → warn → info by
// `runAllRules`; we just render them. The Apply button for fixes is
// deferred to DVA.6 (honesty contract: no inert buttons).
function SuggestionBody({ projectId }: { projectId: string }) {
  const findings = useProjectFindings(projectId);
  if (findings.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground">{MODE_DESCRIPTION.suggestion}</p>
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-foreground/90">
          <CircleCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
          <p className="text-[12px]">No issues detected in the current design.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-[11px] uppercase tracking-[0.10em]">
        {findings.length} finding{findings.length === 1 ? '' : 's'}
      </p>
      <ul className="space-y-1.5">
        {findings.map((f) => (
          <FindingRow key={f.id} f={f} interactive={false} />
        ))}
      </ul>
    </div>
  );
}

/** AppliedState — kept only so the existing FindingRow signature can
 *  carry it through. After moving to toast undo, applied findings
 *  vanish from the list (the rule stops firing) so the inline
 *  "Applied" pill is rarely seen; the toast carries the Undo. */
type AppliedState = Record<string, { result: string; undoPayload: any }>;

function FindingRow({
  f,
  interactive,
  applied,
  onApply,
  onUndo,
}: {
  f: Finding;
  interactive: boolean;
  applied?: { result: string };
  onApply?: (f: Finding) => void;
  onUndo?: (f: Finding) => void;
}) {
  const sevMeta = SEVERITY_META[f.severity];
  const fix = f.suggestedFix;
  const fixCanExecute = fix && (fix.kind === 'add-license' || fix.kind === 'add-mount' || fix.kind === 'add-accessory');
  const fixIsManual   = fix && fix.kind === 'select-and-edit';
  const fixLabel = fix?.label;
  return (
    <li
      data-testid={`finding-${f.id}`}
      data-severity={f.severity}
      className="px-2.5 py-2 rounded-md border border-border/60 bg-secondary/20"
    >
      <div className="flex items-start gap-2">
        <sevMeta.Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${sevMeta.tone}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-foreground leading-tight">{f.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{f.description}</p>
          {interactive && (applied || fix) && (
            <div className="mt-1.5 flex items-center gap-2">
              {applied ? (
                <>
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.10em] text-emerald-500">
                    <CircleCheck className="w-3 h-3" /> Applied
                  </span>
                  <button
                    data-testid={`finding-undo-${f.id}`}
                    onClick={() => onUndo?.(f)}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Undo2 className="w-3 h-3" /> Undo
                  </button>
                </>
              ) : fixCanExecute ? (
                <button
                  data-testid={`finding-apply-${f.id}`}
                  onClick={() => onApply?.(f)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-primary-foreground bg-primary hover:opacity-90 transition-opacity"
                >
                  <Wrench className="w-3 h-3" /> Apply {fixLabel}
                </button>
              ) : fixIsManual ? (
                <button
                  data-testid={`finding-open-${f.id}`}
                  onClick={() => onApply?.(f)}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  {fixLabel} <ExternalLink className="w-3 h-3" />
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

const SEVERITY_META: Record<FindingSeverity, { Icon: typeof AlertCircle; tone: string }> = {
  critical: { Icon: AlertCircle,    tone: 'text-red-500' },
  warn:     { Icon: AlertTriangle,  tone: 'text-amber-500' },
  info:     { Icon: Info,           tone: 'text-sky-500' },
};

function ActionBody({ projectId }: { projectId: string }) {
  const findings = useProjectFindings(projectId);

  const onApply = useCallback((f: Finding) => {
    const action = suggestedFixToAction(f);
    if (!action) {
      toast.error('No fix path available for this finding.');
      return;
    }
    const res = executeAction(action, projectId);
    if (res.refused) {
      toast.error(res.result);
      return;
    }
    // Applying a fix typically removes the finding from the list
    // (the rule stops firing). The Undo lives on the toast itself
    // so the operator can revert immediately even after the row is
    // gone. Matches the canvas's ephemeral undo pattern.
    if (res.undoPayload) {
      toast.success(res.result, {
        action: {
          label: 'Undo',
          onClick: () => {
            const reverted = undoAction({
              actionId: f.id,
              appliedAt: Date.now(),
              result: res.result,
              undoPayload: res.undoPayload,
            });
            if (reverted) toast.success(reverted);
          },
        },
        duration: 6000,
      });
    } else {
      toast.success(res.result);
    }
  }, [projectId]);

  // No-op handler for FindingRow's onUndo prop. Toast carries the
  // real undo path; nothing inline triggers this.
  const onUndo = useCallback((_f: Finding) => {}, []);

  return (
    <div className="space-y-3">
      <BulkOperations projectId={projectId} />
      {findings.length === 0 ? (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-foreground/90">
          <CircleCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
          <p className="text-[12px]">Nothing to fix. Switch to Suggestion to scan again as you design.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-[11px] uppercase tracking-[0.10em]">
            {findings.length} finding{findings.length === 1 ? '' : 's'}
          </p>
          <ul className="space-y-1.5">
            {findings.map((f) => (
              <FindingRow
                key={f.id}
                f={f}
                interactive
                onApply={onApply}
                onUndo={onUndo}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────── Bulk operations ──────────────────────

function BulkOperations({ projectId }: { projectId: string }) {
  // Re render the bulk previews when devices change (since fixing
  // individual findings affects how many devices remain in scope).
  // We subscribe to the devices slice with a shallow check; the
  // preview itself is computed inline.
  useProjectStore((s) => s.devices);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Compute previews for every preset so the button captions can
  // surface honest counts ("Apply to 3 cameras"). This is cheap —
  // a handful of preset rows × small device counts.
  const previews = BULK_PRESETS.map((p) => ({ preset: p, preview: previewBulkOperation({ scope: p.scope, action: p.action }, projectId) }));
  const runnable = previews.filter((row) => row.preview.affected.length > 0);
  if (runnable.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-[11px] uppercase tracking-[0.10em]">
        Bulk
      </p>
      <ul className="space-y-1.5">
        {runnable.map(({ preset, preview }) => (
          <li
            key={preset.id}
            data-testid={`bulk-${preset.id}`}
            className="px-2.5 py-2 rounded-md border border-border/60 bg-secondary/20"
          >
            <p className="text-[12px] font-medium text-foreground leading-tight">{preset.label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {preview.affected.length} device{preview.affected.length === 1 ? '' : 's'} would change
              {preview.alreadyDone.length > 0 && <> · {preview.alreadyDone.length} already done</>}
              {preview.unreachable.length > 0 && <> · {preview.unreachable.length} no fix path</>}
            </p>
            {confirmId === preset.id ? (
              <BulkConfirmRow preset={preset} projectId={projectId} onDone={() => setConfirmId(null)} />
            ) : (
              <button
                data-testid={`bulk-trigger-${preset.id}`}
                onClick={() => setConfirmId(preset.id)}
                className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-primary-foreground bg-primary hover:opacity-90 transition-opacity"
              >
                <Wrench className="w-3 h-3" /> Review and apply
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BulkConfirmRow({
  preset,
  projectId,
  onDone,
}: {
  preset: BulkPreset;
  projectId: string;
  onDone: () => void;
}) {
  const preview = previewBulkOperation({ scope: preset.scope, action: preset.action }, projectId);
  const sample = preview.affected.slice(0, 3).map((a) => a.device.label || a.device.id).join(', ');
  const more = preview.affected.length - 3;
  const onConfirm = () => {
    const res = executeBulkOperation({ scope: preset.scope, action: preset.action }, projectId);
    if (res.undoPayloads.length === 0) {
      toast.message(res.result);
    } else {
      toast.success(res.result, {
        action: {
          label: 'Undo',
          onClick: () => { const r = undoBulkOperation(res.undoPayloads); toast.success(r); },
        },
        duration: 8000,
      });
    }
    onDone();
  };
  return (
    <div className="mt-1.5 space-y-1.5">
      <p className="text-[11px] text-foreground/80">
        Will apply to: {sample}{more > 0 ? ` + ${more} more` : ''}.
      </p>
      <div className="flex items-center gap-2">
        <button
          data-testid={`bulk-confirm-${preset.id}`}
          onClick={onConfirm}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-primary-foreground bg-primary hover:opacity-90 transition-opacity"
        >
          <CircleCheck className="w-3 h-3" /> Confirm {preview.affected.length}
        </button>
        <button
          onClick={onDone}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Convert a Finding's SuggestedFix into the AiAction shape the
 *  executor consumes. Returns undefined for findings with no fix. */
function suggestedFixToAction(f: Finding): AiAction | undefined {
  const fix = f.suggestedFix;
  if (!fix) return undefined;
  const actionId = `dva-${f.id}`;
  switch (fix.kind) {
    case 'add-license':
      return { id: actionId, kind: 'add-license', label: fix.label, deviceId: fix.deviceId, productId: fix.productId };
    case 'add-mount':
      return { id: actionId, kind: 'add-mount', label: fix.label, deviceId: fix.deviceId, productId: fix.productId };
    case 'add-accessory':
      return { id: actionId, kind: 'add-accessory', label: fix.label, deviceId: fix.deviceId, productId: fix.productId };
    case 'select-and-edit':
      return { id: actionId, kind: 'select-and-edit', label: fix.label, objectId: fix.objectId, objectKind: fix.objectKind === 'room' ? 'room' : fix.objectKind };
  }
}

// ────────────────────────────── Findings selector ───────────────────

/** Run the rules engine against the project's current store slice.
 *  Memoized on the slice identities so the rules only re-run when
 *  devices / pathways / rooms / floors / idfs actually change. */
function useProjectFindings(projectId: string): Finding[] {
  const devices  = useProjectStore((s) => s.devices);
  const pathways = useProjectStore((s) => s.pathways);
  const rooms    = useProjectStore((s) => s.rooms);
  const floors   = useProjectStore((s) => s.floors);
  const idfs     = useProjectStore((s) => s.idfs);
  return useMemo(() => {
    const filterByProject = <T extends { projectId: string }>(rec: Record<string, T>): T[] =>
      Object.values(rec).filter((x) => x.projectId === projectId);
    return runAllRules({
      devices:  filterByProject(devices),
      pathways: filterByProject(pathways),
      rooms:    filterByProject(rooms),
      floors:   filterByProject(floors),
      idfs:     filterByProject(idfs),
    });
  }, [projectId, devices, pathways, rooms, floors, idfs]);
}
