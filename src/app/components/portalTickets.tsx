// SC.6.3 + 6.4 — Customer Portal service ticket surface. Lives in
// the portal's left column alongside Scope / Schedule / Proposal /
// Documents / Installed equipment.
//
// SC.6.3 — PortalReportIssueDialog: customer-facing form (issue
// kind in plain English, optional device picker scoped to the
// customer's commissioned assets only, free text description,
// urgency low/medium/high mapped via CUSTOMER_URGENCY_TO_PRIORITY,
// reporter pre filled from the primary contact when available).
// Submit calls the same createTicket store action operators use,
// so the ticket lands in /tickets immediately (no separate path).
//
// SC.6.4 — PortalTicketsCard: customer-safe list of their own
// project's tickets. Open + waiting items float first, then
// resolved + closed. Each row expands inline to show the timeline
// + an "add follow up note" form so the bidirectional thread
// works without a separate detail surface.
//
// Customer-safe rules (audit honesty contract):
//   * Status labels come from TICKET_STATUS_CUSTOMER (never the
//     internal enum strings).
//   * No internal jargon: 'in_progress' renders "Our team is on it",
//     'waiting_customer' renders "We need your help", etc.
//   * Internal-only attributes (assignedTo, ticketNumber prefix
//     scheme) are hidden. Ticket number IS displayed because it
//     gives the customer a reference they can quote in email.
//   * Author of notes left visible — the customer should see who is
//     writing back ("Sarah from Access Tech" not just "Note").

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  LifeBuoy, Plus, X, ChevronDown, ChevronRight, AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { Button } from './Button';
import { useProjectStore } from '../store/projectStore';
import type {
  ServiceTicket, TicketPriority, Asset, Device, Customer, Contact,
} from '../store/types';
import {
  TICKET_STATUS_CUSTOMER,
  TICKET_STATUS_TONE,
  TICKET_PRIORITY_LABEL,
  TICKET_PRIORITY_TONE,
  CUSTOMER_TICKET_KINDS,
  CUSTOMER_URGENCY_TO_PRIORITY,
} from '../lib/ticketLabels';

const URGENCY_LEVELS: { id: 'low' | 'medium' | 'high'; label: string; hint: string }[] = [
  { id: 'low',    label: 'Low',    hint: 'No rush. Whenever you can get to it.' },
  { id: 'medium', label: 'Medium', hint: 'Inconvenient. Please look this week.' },
  { id: 'high',   label: 'High',   hint: 'Affecting daily operations. Please prioritize.' },
];

// SC.6.4 — main card. Lists this customer's tickets for this
// project and offers the "Report an issue" entry point.
export function PortalTicketsCard({
  customerId, projectId, customer, primaryContact, installedAssets, devicesMap,
}: {
  customerId: string;
  projectId: string;
  customer: Customer | null;
  primaryContact: Contact | null;
  installedAssets: Asset[];
  devicesMap: Record<string, Device | undefined>;
}) {
  const ticketsMap = useProjectStore((s) => s.serviceTickets);
  const [reportOpen, setReportOpen] = useState(false);

  // SC.5.2 already filters at the customer level on the operator
  // side; we narrow further to the SPECIFIC project the portal is
  // showing so a customer with multiple projects sees only the
  // tickets that belong here.
  const tickets = useMemo(
    () => Object.values(ticketsMap)
      .filter((t) => !t.isOrphaned && t.customerId === customerId && t.projectId === projectId)
      .sort((a, b) => {
        // Open + waiting on customer + in_progress float to the top.
        // resolved + closed sink. Within each bucket, newest update first.
        const aClosed = a.status === 'resolved' || a.status === 'closed';
        const bClosed = b.status === 'resolved' || b.status === 'closed';
        if (aClosed !== bClosed) return aClosed ? 1 : -1;
        return b.updatedAt - a.updatedAt;
      }),
    [ticketsMap, customerId, projectId],
  );

  const openCount = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length;

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Service requests</h2>
            {openCount > 0 && (
              <span className="text-[10px] text-muted-foreground tabular-nums">{openCount} active</span>
            )}
          </div>
          <Button size="sm" onClick={() => setReportOpen(true)} data-testid="portal-report-issue">
            <Plus className="w-3.5 h-3.5 mr-1" />Report an issue
          </Button>
        </div>

        {tickets.length === 0 ? (
          <div className="text-sm text-muted-foreground leading-relaxed">
            Nothing reported yet. If something needs attention, tap Report an issue and we will get someone on it.
          </div>
        ) : (
          <ul className="divide-y divide-border -mx-1" data-testid="portal-ticket-list">
            {tickets.map((t) => (
              <PortalTicketRow
                key={t.id}
                ticket={t}
                primaryContact={primaryContact}
              />
            ))}
          </ul>
        )}
      </div>

      {reportOpen && (
        <PortalReportIssueDialog
          customerId={customerId}
          projectId={projectId}
          customer={customer}
          primaryContact={primaryContact}
          installedAssets={installedAssets}
          devicesMap={devicesMap}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  );
}

function PortalTicketRow({ ticket, primaryContact }: {
  ticket: ServiceTicket;
  primaryContact: Contact | null;
}) {
  const addTicketNote = useProjectStore((s) => s.addTicketNote);
  const [expanded, setExpanded] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [busy, setBusy] = useState(false);

  // Default the reply-author to the customer's primary contact name.
  // noteAuthor is null until the customer types something, so a late-
  // arriving primaryContact (store hydration race) seeds the input
  // correctly instead of freezing on "Customer". When the customer
  // edits the field, their edit sticks.
  const defaultAuthor = useMemo(
    () => primaryContact
      ? [primaryContact.firstName, primaryContact.lastName].filter(Boolean).join(' ') || 'Customer'
      : 'Customer',
    [primaryContact],
  );
  const [noteAuthorDraft, setNoteAuthorDraft] = useState<string | null>(null);
  const noteAuthor = noteAuthorDraft ?? defaultAuthor;

  // Timeline sort. TicketNote.createdAt is ISO 8601 per the schema,
  // and lexicographic sort on ISO strings is chronological. Defensive
  // normalizer in case anything writes a numeric ms timestamp (older
  // migrations, future bug) so the conversation order never scrambles.
  const tsKey = (s: string | number) => {
    if (typeof s === 'number') return s;
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : 0;
  };
  // SC.7.7 — customer surface NEVER renders a note with
  // visibility === 'internal'. Defensive `|| !n.visibility` covers
  // any pre-migration note that somehow slipped through; after the
  // v30 -> v31 backfill runs cleanly that branch should never fire.
  const timeline = useMemo(
    () => (ticket.notes ?? [])
      .filter((n) => n.visibility === 'customer' || !n.visibility)
      .slice()
      .sort((a, b) => tsKey(a.createdAt) - tsKey(b.createdAt)),
    [ticket.notes],
  );

  const postNote = () => {
    const body = noteBody.trim();
    const author = noteAuthor.trim() || defaultAuthor;
    if (!body) {
      toast.error('Write something before posting.');
      return;
    }
    setBusy(true);
    try {
      addTicketNote(ticket.id, {
        authorName: author,
        authorEmail: primaryContact?.email,
        body,
      });
      setNoteBody('');
      toast.success('Note saved. Your team will see it on their next refresh.');
    } catch (err) {
      console.error('PortalTicketRow.postNote failed', err);
      toast.error('Could not post the note.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-2.5 px-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left flex items-start gap-3"
        data-testid={`portal-ticket-row-${ticket.id}`}
      >
        <span className="mt-0.5 text-muted-foreground">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${TICKET_STATUS_TONE[ticket.status]}`}>
              {TICKET_STATUS_CUSTOMER[ticket.status]}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${TICKET_PRIORITY_TONE[ticket.priority]}`}>
              {TICKET_PRIORITY_LABEL[ticket.priority]}
            </span>
            <span className="text-xs text-foreground truncate">{ticket.title}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {ticket.ticketNumber} · opened {ageShort(ticket.createdAt)}
            {ticket.updatedAt !== ticket.createdAt && ` · last update ${ageShort(ticket.updatedAt)}`}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 ml-6 space-y-3">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{ticket.description}</p>

          {timeline.length > 0 && (
            <div className="rounded-md border border-border bg-secondary/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3 h-3" />Conversation
              </div>
              <ol className="space-y-2.5">
                {timeline.map((n) => (
                  <li key={n.id} className="border-l-2 border-border pl-2.5">
                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{n.authorName}</span>
                      <span> · {new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap mt-0.5">{n.body}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="space-y-2">
            <input
              type="text"
              value={noteAuthor}
              onChange={(e) => setNoteAuthorDraft(e.target.value)}
              placeholder="Your name"
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid={`portal-note-author-${ticket.id}`}
            />
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={3}
              placeholder="Add a follow up note. Your team will see it on their next refresh."
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm resize-none"
              data-testid={`portal-note-body-${ticket.id}`}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={postNote} disabled={busy} data-testid={`portal-note-submit-${ticket.id}`}>
                Post note
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

// SC.6.3 — Report an issue dialog.
export function PortalReportIssueDialog({
  customerId, projectId, customer, primaryContact, installedAssets, devicesMap, onClose,
}: {
  customerId: string;
  projectId: string;
  customer: Customer | null;
  primaryContact: Contact | null;
  installedAssets: Asset[];
  devicesMap: Record<string, Device | undefined>;
  onClose: () => void;
}) {
  const createTicket = useProjectStore((s) => s.createTicket);

  const defaultReporterName = useMemo(
    () => primaryContact
      ? [primaryContact.firstName, primaryContact.lastName].filter(Boolean).join(' ')
      : '',
    [primaryContact],
  );

  const [issueKindId, setIssueKindId] = useState<string>(CUSTOMER_TICKET_KINDS[0].id);
  const [assetId, setAssetId]       = useState<string>('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency]       = useState<'low' | 'medium' | 'high'>('medium');
  const [reporterName, setReporterName]   = useState(defaultReporterName);
  const [reporterEmail, setReporterEmail] = useState(primaryContact?.email ?? '');
  const [errors, setErrors] = useState<{ description?: string; reporterName?: string }>({});
  const [busy, setBusy]     = useState(false);

  const issueKind = CUSTOMER_TICKET_KINDS.find((k) => k.id === issueKindId) ?? CUSTOMER_TICKET_KINDS[0];
  const hasAssets = installedAssets.length > 0;

  const submit = () => {
    const next: typeof errors = {};
    if (!description.trim()) next.description = 'Tell us what is happening.';
    if (!reporterName.trim()) next.reporterName = 'Please leave your name.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const pickedAsset = installedAssets.find((a) => a.id === assetId);
      // Build the internal title from the chosen issue kind + a
      // device hint when supplied. Operators see this in the
      // /tickets queue; customers see only the kind label.
      const deviceHint = pickedAsset
        ? `${pickedAsset.manufacturer} ${pickedAsset.model}`
        : null;
      const internalTitle = deviceHint
        ? `${issueKind.label} · ${deviceHint}`
        : issueKind.label;

      const priority: TicketPriority = CUSTOMER_URGENCY_TO_PRIORITY[urgency];

      createTicket({
        customerId,
        projectId,
        deviceId: pickedAsset?.deviceId,
        assetId: pickedAsset?.id,
        title: internalTitle,
        description: description.trim(),
        priority,
        category: issueKind.category,
        reportedBy: {
          name: reporterName.trim(),
          email: reporterEmail.trim() || undefined,
        },
      });
      toast.success('Request saved. Your team will see it on their next refresh.');
      onClose();
    } catch (err) {
      console.error('PortalReportIssueDialog.submit failed', err);
      toast.error('Could not send the request. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg w-full max-w-[520px] max-h-[92vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="portal-report-dialog"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h2 className="text-base font-medium">Report an issue</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {customer ? customer.companyName : 'Your project'} · we usually reply within a business day.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">What kind of issue?</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CUSTOMER_TICKET_KINDS.map((k) => {
                const on = issueKindId === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setIssueKindId(k.id)}
                    data-testid={`portal-issue-kind-${k.id}`}
                    className={`p-2.5 rounded-md border text-left transition-colors ${on ? 'border-primary bg-primary/10' : 'border-border hover:border-border-strong'}`}
                  >
                    <div className="text-sm">{k.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{k.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {hasAssets && (
            <div>
              <label className="text-xs text-muted-foreground">Which device? (optional)</label>
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                data-testid="portal-asset-picker"
                className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              >
                <option value="">Not specific to one device</option>
                {installedAssets.map((a) => {
                  const dev = devicesMap[a.deviceId];
                  const loc = dev?.label ? ` · ${dev.label}` : '';
                  return (
                    <option key={a.id} value={a.id}>
                      {a.manufacturer} {a.model}{loc}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">What is happening? *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="When did it start? What were you doing? Anything you already tried?"
              data-testid="portal-issue-description"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm resize-none"
            />
            {errors.description && <ErrorRow text={errors.description} />}
          </div>

          <div>
            <label className="text-xs text-muted-foreground">How urgent?</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {URGENCY_LEVELS.map((u) => {
                const on = urgency === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUrgency(u.id)}
                    data-testid={`portal-urgency-${u.id}`}
                    className={`p-2.5 rounded-md border text-left transition-colors ${on ? 'border-primary bg-primary/10' : 'border-border hover:border-border-strong'}`}
                  >
                    <div className="text-sm">{u.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{u.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Your name *</label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="First and last"
                data-testid="portal-reporter-name"
                className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              />
              {errors.reporterName && <ErrorRow text={errors.reporterName} />}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Your email</label>
              <input
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="optional"
                data-testid="portal-reporter-email"
                className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy} data-testid="portal-report-submit">
            {busy ? 'Sending…' : 'Send request'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorRow({ text }: { text: string }) {
  return (
    <p className="mt-1 text-[11px] text-destructive inline-flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" />{text}
    </p>
  );
}

function ageShort(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
