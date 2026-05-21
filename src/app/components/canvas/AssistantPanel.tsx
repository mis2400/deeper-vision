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

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles, ChevronUp, ChevronDown, ExternalLink,
  AlertCircle, AlertTriangle, Info, CircleCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useProjectStore } from '../../store/projectStore';
import type { AssistantPanelMode } from '../../store/types';
import { runAllRules, type Finding, type FindingSeverity } from '../../lib/assistantRules';

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
      <button
        data-testid="assistant-panel-trigger"
        onClick={() => setOpen(true)}
        title="Open DV Assist"
        className="absolute bottom-3 right-3 z-40 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border shadow-md text-foreground hover:bg-secondary/40 transition-colors"
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
          <ActionBodyPlaceholder />
        )}
      </div>
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
          <FindingRow key={f.id} f={f} />
        ))}
      </ul>
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const sevMeta = SEVERITY_META[f.severity];
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

function ActionBodyPlaceholder() {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">{MODE_DESCRIPTION.action}</p>
      <p className="text-foreground/80">
        DV Assist will execute approved fixes here once Suggestion mode finds something it can resolve. Every action is reversible with the canvas undo stack.
      </p>
    </div>
  );
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
