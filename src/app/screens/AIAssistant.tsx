// AIAssistant — Phase 2A surface. Operator-facing project intelligence.
// Mounted at /ai/:projectId. Phase 2A.1 lands the foundation:
//   - Conversations persist per project in the Zustand store
//   - Real streaming over a deterministic local engine (no fake LLM)
//   - Sidebar list with new + delete
//   - Empty state with project-aware example prompts
//
// Honesty contract: every answer is computed from live project data.
// The engine says "I cannot answer that" rather than guessing. Later
// passes (2A.3 source citations, 2A.4 confidence chips, 2A.5 apply
// actions) plug into the same engine's structured meta output.

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { useProjectStore } from '../store/projectStore';
import { streamAnswer, suggestPrompts } from '../lib/assistantEngine';
import {
  Sparkles, Send, User, Plus, Trash2, MessageSquare, Lightbulb, X as XIcon,
  Crosshair, Info,
} from 'lucide-react';
import type { AiCitation, AiMsg } from '../store/types';

export function AIAssistant() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();

  const project        = useProjectStore((s) => s.projects[projectId]);
  const conversations  = useProjectStore((s) => s.aiConversations);
  const newConv        = useProjectStore((s) => s.newAiConversation);
  const deleteConv     = useProjectStore((s) => s.deleteAiConversation);
  const appendMsg      = useProjectStore((s) => s.appendAiMsg);
  const patchMsgText   = useProjectStore((s) => s.patchAiMsgText);
  const patchMsg       = useProjectStore((s) => s.patchAiMsg);
  // V1 2A.2 — read the transient context the operator's previous
  // surface broadcast. The assistant intentionally does NOT overwrite
  // it on mount: if the operator was on /canvas with CAM-101
  // selected, the assistant inherits that scope so the first question
  // narrows automatically. Operator can clear from the chip below.
  const assistantContext = useProjectStore((s) => s.assistantContext);
  const clearAssistantContext = useProjectStore((s) => s.setAssistantContext);
  // Only count context as "active" when it carries a real handle —
  // site, floor, or selection. Otherwise hide the chip.
  const ctxActive = assistantContext && (assistantContext.siteId || assistantContext.floorId || assistantContext.selectionId);

  // Conversations for THIS project, most recent first.
  const projectConvs = useMemo(
    () => Object.values(conversations).filter((c) => c.projectId === projectId).sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations, projectId],
  );

  // Active conversation id — last touched defaults; null when none.
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (activeId && conversations[activeId]) return;
    setActiveId(projectConvs[0]?.id ?? null);
  }, [activeId, projectConvs, conversations]);

  const active = activeId ? conversations[activeId] : null;
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  // V1 2A.1 — track in-flight streams so unmount / navigation cancels
  // them cleanly. Each new send mints a token; the loop exits as soon
  // as the cancelled flag flips.
  const cancelledRef = useRef(false);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  // Always scroll the thread to the bottom as new content lands.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [active?.messages.length, streaming]);

  // Build a fresh conversation lazily on first send if none exists.
  const ensureConversation = useCallback((): string => {
    if (activeId && conversations[activeId]) return activeId;
    const id = newConv(projectId);
    setActiveId(id);
    return id;
  }, [activeId, conversations, newConv, projectId]);

  const send = useCallback(async (text?: string) => {
    const t = (text ?? draft).trim();
    if (!t || streaming) return;
    setDraft('');
    cancelledRef.current = false;
    const cid = ensureConversation();
    // Push the user message immediately.
    appendMsg(cid, { role: 'user', text: t, ts: Date.now() });
    // Push an empty assistant message we'll stream into.
    const assistantId = appendMsg(cid, { role: 'assistant', text: '', ts: Date.now(), streaming: true });
    setStreaming(true);
    let finalised = false;
    try {
      const state = useProjectStore.getState();
      for await (const chunk of streamAnswer(t, state, projectId, assistantContext)) {
        if (cancelledRef.current) break;
        if (chunk.text) patchMsgText(cid, assistantId, chunk.text);
        if (chunk.done) {
          patchMsg(cid, assistantId, { streaming: false, ...(chunk.meta ?? {}) });
          finalised = true;
        }
      }
    } catch (e) {
      patchMsg(cid, assistantId, {
        streaming: false,
        text: 'Something went wrong producing that answer. The error has been logged in the console.',
      });
      finalised = true;
      // eslint-disable-next-line no-console
      console.error('[assistant] stream error', e);
    } finally {
      // V1 2A.4 fix — if the loop broke before the done chunk
      // arrived (cancelled via unmount, or generator exception),
      // the persisted assistant message would stay `streaming: true`
      // forever. Clear the flag so the bubble loses its caret and
      // the chip / inference / confidence gates can render on next
      // mount.
      if (!finalised) patchMsg(cid, assistantId, { streaming: false });
      setStreaming(false);
    }
  }, [draft, streaming, ensureConversation, appendMsg, patchMsgText, patchMsg, projectId]);

  const onNew = () => {
    const id = newConv(projectId);
    setActiveId(id);
    setDraft('');
  };

  const onDelete = (cid: string) => {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    // Pick the next active before the delete so the auto-select effect
    // doesn't race against the store update.
    const nextActive = cid === activeId
      ? (projectConvs.find((c) => c.id !== cid)?.id ?? null)
      : activeId;
    deleteConv(cid);
    setActiveId(nextActive);
  };

  if (!project) {
    return (
      <AppShell crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'AI assistant' }]}>
        <div className="p-8 text-sm text-muted-foreground">
          No project at <span className="font-mono text-foreground">{projectId}</span>. <button onClick={() => nav('/projects')} className="text-primary underline">Pick a project</button>.
        </div>
      </AppShell>
    );
  }

  // Empty state prompts. Computed from the live store but keyed on a
  // coarse signal (device count) so we don't re-run on every streaming
  // chunk patch. Operators rarely change device counts mid-stream, so
  // this trades freshness on edits we never see for a calm thread.
  const deviceCountSignal = useProjectStore((s) => Object.values(s.devices).filter((d) => d.projectId === projectId).length);
  const prompts = useMemo(() => suggestPrompts(useProjectStore.getState(), projectId), [projectId, deviceCountSignal]);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: project.name, to: `/project/${projectId}` }, { label: 'Assistant' }]}
      fullBleed
    >
      <div className="h-full grid grid-cols-[260px_minmax(0,1fr)]">
        {/* Conversation sidebar */}
        <aside className="border-r border-border bg-background/60 flex flex-col min-h-0">
          <div className="p-3 border-b border-border">
            <button
              onClick={onNew}
              className="w-full h-9 inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90 text-[12px] font-medium"
              data-track="ai-new-conv"
            >
              <Plus className="w-3.5 h-3.5" />New conversation
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {projectConvs.length === 0 ? (
              <div className="text-[11px] text-muted-foreground text-center py-6">No conversations yet.</div>
            ) : (
              projectConvs.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <div
                    key={c.id}
                    className={`group rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                      isActive ? 'bg-secondary text-foreground' : 'hover:bg-secondary/50 text-muted-foreground'
                    }`}
                    onClick={() => setActiveId(c.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[12px] truncate flex-1">{c.title}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-[10px] text-muted-foreground/80 mt-0.5 tabular-nums">{relativeTime(c.updatedAt)}</div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Thread */}
        <div className="flex flex-col min-h-0">
          {/* Context strip */}
          <div className="px-5 py-2.5 border-b border-border bg-background/60 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Grounded in <span className="text-foreground">{project.name}</span></span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {active && active.messages.length > 0 ? (
              <>
                {active.messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    msg={m}
                    projectId={projectId}
                    onOpenCitation={(c) => nav(citationHref(c, projectId))}
                    onVerifyFollowup={() => { void send('Walk me through where you got that, citing each device or record I should look at.'); }}
                  />
                ))}
                <div ref={endRef} />
              </>
            ) : (
              <EmptyState prompts={prompts} onPick={send} />
            )}
          </div>

          {/* Input */}
          <div className="px-5 py-3 border-t border-border bg-background/70">
            {/* V1 2A.2 — context chip. Shown when another surface
                broadcast a real selection / floor. Operator can clear
                it; the engine drops the scope on next send. */}
            {ctxActive && assistantContext && (
              <div className="mb-2 inline-flex items-center gap-1.5 h-6 pl-1.5 pr-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10.5px]" data-testid="ai-context-chip">
                <Crosshair className="w-3 h-3" />
                <span className="tracking-tight">
                  Scope
                  {assistantContext.surface && assistantContext.surface !== 'assistant' && (
                    <span className="text-primary/70"> · {assistantContext.surface}</span>
                  )}
                  {assistantContext.siteName && !assistantContext.floorName && (
                    <span className="text-primary/70"> · {assistantContext.siteName}</span>
                  )}
                  {assistantContext.floorName && (
                    <span className="text-primary/70"> · {assistantContext.floorName}</span>
                  )}
                  {assistantContext.selectionLabel && (
                    <span className="text-primary/70"> · {assistantContext.selectionLabel}</span>
                  )}
                </span>
                <button
                  onClick={() => clearAssistantContext(null)}
                  className="ml-0.5 h-4 w-4 inline-flex items-center justify-center rounded-full hover:bg-primary/20"
                  title="Drop scope. Ask about the whole project."
                >
                  <XIcon className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2 bg-input-background border border-input-border rounded-lg px-3 py-2 focus-within:border-primary transition-colors">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
                }}
                placeholder={streaming ? 'Answering…' : ctxActive ? 'Ask scoped to this context, or say "across the whole project"…' : 'Ask about coverage, BOM, PoE, work orders…'}
                rows={1}
                disabled={streaming}
                className="flex-1 bg-transparent text-[13px] focus:outline-none resize-none max-h-32 placeholder:text-muted-foreground/60"
                data-testid="ai-input"
              />
              <button
                onClick={() => void send()}
                disabled={!draft.trim() || streaming}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground disabled:bg-secondary disabled:text-muted-foreground"
                data-track="ai-send"
                title={streaming ? 'Wait for the current answer to finish' : 'Send (Enter)'}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground">Enter to send. Shift+Enter for a new line.</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/** Resolve a citation to its target route. Future passes may add a
 *  `?focus=` query param so the destination surface highlights the
 *  exact entity; today the link opens the owning surface, which is
 *  honest scope-wise but doesn't auto-select. */
function citationHref(c: AiCitation, projectId: string): string {
  if (c.href) return c.href;
  switch (c.kind) {
    case 'project':   return `/project/${projectId}`;
    case 'report':    return `/project/${projectId}/reports`;
    case 'workorder': return `/project/${projectId}/deployment?focus=${encodeURIComponent(c.refId)}`;
    case 'device':    return `/project/${projectId}/canvas?focus=${encodeURIComponent(c.refId)}`;
    case 'pathway':   return `/project/${projectId}/canvas?focus=${encodeURIComponent(c.refId)}`;
    case 'idf':       return `/project/${projectId}/canvas?focus=${encodeURIComponent(c.refId)}`;
    case 'door':      return `/door/${encodeURIComponent(c.refId)}`;
    case 'floor':     return `/project/${projectId}/canvas?floor=${encodeURIComponent(c.refId)}`;
    default:          return `/project/${projectId}`;
  }
}

function MessageBubble({ msg, projectId, onOpenCitation, onVerifyFollowup }: {
  msg: AiMsg;
  projectId: string;
  onOpenCitation: (c: AiCitation) => void;
  onVerifyFollowup: () => void;
}) {
  const isUser = msg.role === 'user';
  const text = msg.text;
  const streaming = !!msg.streaming;
  const citations = isUser ? undefined : msg.citations;
  const showInference = !isUser && msg.inference && !streaming;
  // Phase 2A.4 — confidence chip + Low-confidence verify follow-up.
  const showConfidence = !isUser && !streaming && msg.confidence;
  const isLow = msg.confidence === 'low';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${isUser ? 'bg-secondary text-muted-foreground' : 'bg-primary/15 text-primary'}`}>
        {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block text-[13px] leading-snug rounded-lg px-3 py-2 whitespace-pre-wrap ${isUser ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>
          {text || (streaming ? <span className="text-muted-foreground italic">…</span> : '')}
          {streaming && text && <span className="inline-block w-1.5 h-3.5 ml-0.5 align-text-bottom bg-current animate-pulse opacity-60" aria-hidden />}
        </div>
        {/* V1 2A.3 — inline source chips. Each is clickable and opens
            the source surface; canvas / deployment honor ?focus= so
            the chip deep-selects. Citations beyond a glanceable
            window (CITATION_VISIBLE_MAX) collapse into a "+N more"
            chip that expands the full list on click. Truncation is
            never silent. */}
        {!streaming && citations && citations.length > 0 && (
          <CitationsRow citations={citations} onOpen={onOpenCitation} />
        )}
        {/* V1 2A.3 — inference label. Renders when the engine flagged
            the answer as derived from a rule of thumb rather than
            direct data. Honesty contract. */}
        {showInference && (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-600">
            <Info className="w-3 h-3" />
            Inference. Specific data not directly available.
          </div>
        )}
        {/* V1 2A.4 — confidence chip. Only on judgment responses
            (engine omits the field on pure answers like counts /
            help). Tooltip is mandatory per brief: "No chip without a
            tooltip." */}
        {showConfidence && (
          <div className="mt-1 inline-flex items-center gap-1.5">
            <ConfidenceChip level={msg.confidence!} why={msg.confidenceWhy} />
            {isLow && (
              <button
                onClick={onVerifyFollowup}
                className="text-[10.5px] text-primary hover:underline"
                title="Send a follow-up that asks me to verify this against the canvas."
              >
                Would you like me to verify?
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfidenceChip({ level, why }: { level: 'high' | 'medium' | 'low'; why?: string }) {
  const meta = {
    high:   { label: 'High',   cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600' },
    medium: { label: 'Medium', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-600' },
    low:    { label: 'Low',    cls: 'border-rose-500/30 bg-rose-500/10 text-rose-600' },
  }[level];
  return (
    <span
      className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full border text-[10.5px] tracking-tight ${meta.cls}`}
      title={why ?? `${meta.label} confidence`}
      data-testid="ai-confidence"
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} />
      <span>{meta.label} confidence</span>
    </span>
  );
}

const CITATION_VISIBLE_MAX = 8;

function CitationsRow({ citations, onOpen }: { citations: AiCitation[]; onOpen: (c: AiCitation) => void }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? citations : citations.slice(0, CITATION_VISIBLE_MAX);
  const overflow = citations.length - visible.length;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1 items-center" data-testid="ai-citations">
      <span className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground/70 mr-0.5">Sources</span>
      {visible.map((c, i) => (
        <button
          key={`${c.kind}-${c.refId}-${i}`}
          onClick={() => onOpen(c)}
          title={`Open ${c.kind} ${c.label}`}
          className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/15 text-primary text-[10.5px] transition-colors"
        >
          <span className="opacity-70">{c.kind}</span>
          <span className="font-medium">{c.label}</span>
        </button>
      ))}
      {overflow > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex items-center h-5 px-1.5 rounded-full border border-border bg-secondary/50 hover:bg-secondary text-muted-foreground text-[10.5px] transition-colors"
          title={`Show all ${citations.length} sources`}
        >
          +{overflow} more
        </button>
      )}
      {expanded && citations.length > CITATION_VISIBLE_MAX && (
        <button
          onClick={() => setExpanded(false)}
          className="inline-flex items-center h-5 px-1.5 rounded-full border border-border bg-secondary/50 hover:bg-secondary text-muted-foreground text-[10.5px] transition-colors"
          title="Collapse the source list"
        >
          Show less
        </button>
      )}
    </div>
  );
}

function EmptyState({ prompts, onPick }: { prompts: string[]; onPick: (text: string) => void }) {
  return (
    <div className="max-w-xl mx-auto pt-8">
      <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary inline-flex items-center justify-center mb-4">
        <Sparkles className="w-5 h-5" />
      </div>
      <h1 className="text-xl font-medium tracking-tight mb-1">What do you want to know?</h1>
      <p className="text-[13px] text-muted-foreground mb-5">
        I read your live project state. I cite the records I draw from, and I say so plainly when something is inference rather than fact.
      </p>
      <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground/70 mb-2 inline-flex items-center gap-1.5">
        <Lightbulb className="w-3 h-3" />Try
      </div>
      <div className="flex flex-col gap-2">
        {prompts.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="text-left text-[13px] border border-border rounded-md px-3 py-2 hover:border-primary/40 hover:bg-secondary/30 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
