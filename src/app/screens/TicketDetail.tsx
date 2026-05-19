// SC.6.2 — Ticket Detail page. Header metadata + status pill +
// priority pill, linked records (customer, project, device, asset,
// warranty), description, notes timeline (oldest first — reads top
// down like a conversation, matches Slack / Linear / GitHub default;
// status transitions auto-log into the same stream so the operator
// can see what happened in order without a parallel "events" panel).
// Add Note action appends to ticket.notes[] via addTicketNote.
//
// Status transitions: open → in_progress → waiting_customer →
// resolved → closed. The component does not enforce a strict state
// machine — operators can move backwards or skip forward (e.g. an
// open ticket can be closed without ever going through resolved)
// because real triage doesn't always follow the happy path. Every
// transition emits a synthetic timeline note tagged authorName
// "System" so the audit trail is visible inline.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import {
  LifeBuoy, Building2, FolderKanban, Box, ShieldCheck, MessageSquare, ChevronRight, ArrowLeft, AlertTriangle,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type {
  TicketStatus, TicketPriority, TicketCategory,
} from '../store/types';
import {
  TICKET_STATUS_INTERNAL,
  TICKET_PRIORITY_LABEL,
  TICKET_CATEGORY_INTERNAL,
  TICKET_STATUS_TONE,
  TICKET_PRIORITY_TONE,
} from '../lib/ticketLabels';

const STATUS_ORDER: TicketStatus[] = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'];

export function TicketDetail() {
  const navigate = useNavigate();
  const { ticketId } = useParams();
  const ticket        = useProjectStore((s) => (ticketId ? s.serviceTickets[ticketId] : undefined));
  const customer      = useProjectStore((s) => (ticket ? s.customers[ticket.customerId] : undefined));
  const project       = useProjectStore((s) => (ticket ? s.projects[ticket.projectId] : undefined));
  const device        = useProjectStore((s) => (ticket?.deviceId ? s.devices[ticket.deviceId] : undefined));
  const asset         = useProjectStore((s) => (ticket?.assetId ? s.assets[ticket.assetId] : undefined));
  const warranty      = useProjectStore((s) => (ticket?.warrantyId ? s.warranties[ticket.warrantyId] : undefined));
  const updateTicket  = useProjectStore((s) => s.updateTicket);
  const addTicketNote = useProjectStore((s) => s.addTicketNote);

  const [noteBody, setNoteBody]   = useState('');
  const [noteAuthor, setNoteAuthor] = useState('You');
  const [submitting, setSubmitting] = useState(false);
  // Controlled assignee, seeded from the ticket and re-seeded when
  // the ticket id changes (navigation between detail pages) or the
  // store mutates it from another tab. defaultValue + onBlur was
  // brittle: the input went stale if assignedTo updated elsewhere.
  const [assigneeDraft, setAssigneeDraft] = useState(ticket?.assignedTo ?? '');
  useEffect(() => {
    setAssigneeDraft(ticket?.assignedTo ?? '');
  }, [ticket?.id, ticket?.assignedTo]);

  // Timeline = ticket.notes sorted by createdAt ascending. Both
  // operator notes and synthetic status-transition notes live in the
  // same array; sorting is by their ISO 8601 createdAt string, which
  // sorts correctly lexicographically.
  const timeline = useMemo(
    () => (ticket?.notes ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [ticket?.notes],
  );

  if (!ticket) {
    return (
      <AppShell crumbs={[{ label: 'Tickets', to: '/tickets' }, { label: 'Not found' }]} title="Ticket not found">
        <div className="max-w-md mx-auto py-16 text-center">
          <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">
            This ticket doesn't exist or has been deleted.
          </p>
          <Button className="mt-5" onClick={() => navigate('/tickets')}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to tickets
          </Button>
        </div>
      </AppShell>
    );
  }

  // Status + priority handlers re-read the live store state inside the
  // handler so a rapid double-click can't log "from Open to Resolved"
  // when the actual prior state was already In progress. The React
  // closure value is stale by the time React schedules the second
  // handler; useProjectStore.getState() is synchronous and authoritative.
  const handleStatusChange = (next: TicketStatus) => {
    const liveTicket = useProjectStore.getState().serviceTickets[ticket.id];
    if (!liveTicket || liveTicket.status === next) return;
    const prevLabel = TICKET_STATUS_INTERNAL[liveTicket.status];
    const nextLabel = TICKET_STATUS_INTERNAL[next];
    updateTicket(ticket.id, { status: next });
    addTicketNote(ticket.id, {
      authorName: 'System',
      body: `Status changed from ${prevLabel} to ${nextLabel} by ${noteAuthor || 'an operator'}.`,
    });
  };

  const handleAssignChange = (val: string) => {
    updateTicket(ticket.id, { assignedTo: val.trim() || undefined });
  };

  const handlePriorityChange = (next: TicketPriority) => {
    const liveTicket = useProjectStore.getState().serviceTickets[ticket.id];
    if (!liveTicket || liveTicket.priority === next) return;
    const prevLabel = TICKET_PRIORITY_LABEL[liveTicket.priority];
    const nextLabel = TICKET_PRIORITY_LABEL[next];
    updateTicket(ticket.id, { priority: next });
    addTicketNote(ticket.id, {
      authorName: 'System',
      body: `Priority changed from ${prevLabel} to ${nextLabel} by ${noteAuthor || 'an operator'}.`,
    });
  };

  const handleAddNote = () => {
    const body = noteBody.trim();
    const author = noteAuthor.trim() || 'You';
    if (!body) {
      toast.error('Write something before posting.');
      return;
    }
    setSubmitting(true);
    try {
      addTicketNote(ticket.id, { authorName: author, body });
      setNoteBody('');
      toast.success('Note added');
    } catch (err) {
      console.error('addTicketNote failed', err);
      toast.error('Could not add the note.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      crumbs={[
        { label: 'Tickets', to: '/tickets' },
        { label: ticket.ticketNumber },
      ]}
      title={ticket.title}
      subtitle={`${ticket.ticketNumber} · ${TICKET_CATEGORY_INTERNAL[ticket.category]}`}
    >
      <div className="max-w-[1100px] mx-auto px-6 py-6 grid grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* ── LEFT: description + timeline ───────────────────────── */}
        <div className="space-y-5">
          <section className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Description</h2>
            <p className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="ticket-description">{ticket.description}</p>
          </section>

          <section className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 inline-flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />Timeline
            </h2>
            {timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No activity yet. Add a note below to start the timeline.</p>
            ) : (
              <ol className="space-y-3" data-testid="ticket-timeline">
                {timeline.map((n) => (
                  <li key={n.id} className="border-l-2 border-border pl-3">
                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{n.authorName}</span>
                      <span> · {new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap mt-0.5">{n.body}</div>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-5 pt-4 border-t border-border space-y-2">
              <input
                type="text"
                value={noteAuthor}
                onChange={(e) => setNoteAuthor(e.target.value)}
                placeholder="Your name"
                className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
                data-testid="ticket-note-author"
              />
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                onKeyDown={(e) => {
                  // Cmd+Enter (mac) / Ctrl+Enter (linux/windows) posts the
                  // note. Plain Enter inserts a newline so the operator can
                  // write multi-line context without the input swallowing it.
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !submitting) {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
                rows={3}
                placeholder="Add a note. Cmd+Enter to post."
                className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm resize-none"
                data-testid="ticket-note-body"
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleAddNote} disabled={submitting} data-testid="ticket-note-submit">
                  Post note
                </Button>
              </div>
            </div>
          </section>
        </div>

        {/* ── RIGHT: rail with status, assignment, linked records ── */}
        <aside className="space-y-4">
          <section className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {STATUS_ORDER.map((s) => {
                  const on = s === ticket.status;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      data-testid={`ticket-status-${s}`}
                      className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${on ? TICKET_STATUS_TONE[s] : 'text-muted-foreground border-border hover:border-border-strong'}`}
                    >
                      {TICKET_STATUS_INTERNAL[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Priority</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(['critical','high','medium','low'] as TicketPriority[]).map((p) => {
                  const on = p === ticket.priority;
                  return (
                    <button
                      key={p}
                      onClick={() => handlePriorityChange(p)}
                      className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${on ? TICKET_PRIORITY_TONE[p] : 'text-muted-foreground border-border hover:border-border-strong'}`}
                    >
                      {TICKET_PRIORITY_LABEL[p]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Assigned to</label>
              <input
                type="text"
                value={assigneeDraft}
                onChange={(e) => setAssigneeDraft(e.target.value)}
                onBlur={(e) => handleAssignChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder="Operator name or id"
                className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-1.5 text-xs"
                data-testid="ticket-assign-to"
              />
            </div>
          </section>

          <section className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Linked records</h3>
            <ul className="space-y-2 text-sm">
              <LinkedRow
                icon={<Building2 className="w-3.5 h-3.5" />}
                label="Customer"
                value={customer?.companyName ?? 'Missing'}
                onClick={customer ? () => navigate(`/account/${customer.id}`) : undefined}
              />
              <LinkedRow
                icon={<FolderKanban className="w-3.5 h-3.5" />}
                label="Project"
                value={project?.name ?? 'Missing'}
                onClick={project ? () => navigate(`/project/${project.id}`) : undefined}
              />
              {ticket.deviceId && (
                <LinkedRow
                  icon={<Box className="w-3.5 h-3.5" />}
                  label="Device"
                  value={device ? `${device.kind ?? 'Device'} · ${device.label ?? device.id}` : `Missing · ${ticket.deviceId}`}
                  onClick={project ? () => navigate(`/project/${project.id}/canvas`) : undefined}
                />
              )}
              {ticket.assetId && (
                <li className="rounded-md border border-border bg-secondary/20 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <Box className="w-3 h-3" />Asset
                  </div>
                  {asset ? (
                    <div className="mt-1 text-xs space-y-0.5">
                      <div className="font-medium">{asset.manufacturer} {asset.model}</div>
                      {asset.serialNumber && <div className="text-muted-foreground">SN {asset.serialNumber}</div>}
                      <div className="text-muted-foreground capitalize">{asset.status}</div>
                      <div className="text-muted-foreground">Commissioned {new Date(asset.commissionedAt).toLocaleDateString()} by {asset.commissionedBy}</div>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-amber-400/80">Asset record missing.</div>
                  )}
                </li>
              )}
              {ticket.warrantyId && (
                <li className="rounded-md border border-border bg-secondary/20 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />Warranty
                  </div>
                  {warranty ? (
                    <div className="mt-1 text-xs space-y-0.5">
                      <div className="font-medium">{warranty.type}</div>
                      <div className="text-muted-foreground">{warranty.coverage}</div>
                      <div className="text-muted-foreground">
                        {new Date(warranty.startDate).toLocaleDateString()} – {new Date(warranty.endDate).toLocaleDateString()}
                        {' · '}
                        {warrantyStateLabel(warranty.endDate)}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-amber-400/80">Warranty record missing.</div>
                  )}
                </li>
              )}
            </ul>
          </section>

          <section className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Reported by</h3>
            <div className="text-sm">{ticket.reportedBy?.name ?? '—'}</div>
            {ticket.reportedBy?.email && (
              <div className="text-[11px] text-muted-foreground">{ticket.reportedBy.email}</div>
            )}
            <div className="text-[11px] text-muted-foreground mt-2">
              Opened {new Date(ticket.createdAt).toLocaleString()}
            </div>
            {ticket.resolvedAt && (
              <div className="text-[11px] text-emerald-400 mt-0.5">
                Resolved {new Date(ticket.resolvedAt).toLocaleString()}
              </div>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function LinkedRow({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void }) {
  // Render as a real button only when there's somewhere to go. Without
  // a target we render a non-interactive row — no chevron, no hover —
  // so the operator can see what the ticket points at without the UI
  // promising a click that does nothing.
  if (!onClick) {
    return (
      <li className="px-2 py-1.5 flex items-center gap-2 min-w-0">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-xs truncate text-muted-foreground">{value}</span>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/30"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className="text-xs truncate">{value}</span>
        </span>
        <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />
      </button>
    </li>
  );
}

function warrantyStateLabel(endDate: string): string {
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(end)) return 'unknown';
  if (Date.now() > end) return 'out of coverage';
  const daysLeft = Math.ceil((end - Date.now()) / 86_400_000);
  if (daysLeft < 30) return `${daysLeft}d left`;
  if (daysLeft < 365) return `${Math.ceil(daysLeft / 30)}mo left`;
  return 'in coverage';
}
