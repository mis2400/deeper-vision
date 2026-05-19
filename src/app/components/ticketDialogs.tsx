// SC.6.1 — Internal NewTicketDialog. Same modal shape as the CRM
// dialogs from SC.5: floating panel + close, validates required
// fields, calls createTicket and returns the new id so the parent
// can navigate to the detail page.
//
// Used by:
//   - TicketManager toolbar "New ticket" button
//   - AccountDetail Tickets tab "New ticket" affordance (later)
//
// Excluded from this dialog (intentional):
//   - device / asset / warranty pickers. SC.6.2 (ticket detail) is a
//     better place to attach those once the ticket exists, since it
//     can lazily load the per-project device list without bloating
//     the create modal. Operators who do want to attach on create
//     can do it from the detail page immediately after.

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from './Button';
import { X, AlertTriangle } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type {
  TicketPriority,
  TicketCategory,
  Customer,
  Project,
  Contact,
} from '../store/types';
import {
  TICKET_PRIORITY_LABEL,
  TICKET_CATEGORY_INTERNAL,
} from '../lib/ticketLabels';

const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'medium', 'high', 'critical'];
const CATEGORY_OPTIONS: TicketCategory[] = [
  'device_failure', 'configuration', 'warranty_claim', 'preventive', 'user_request', 'other',
];

export function NewTicketDialog({
  defaultCustomerId,
  defaultProjectId,
  onClose,
  onCreated,
}: {
  /** When set, the customer picker is locked (called from AccountDetail). */
  defaultCustomerId?: string;
  /** When set, project picker is preselected. */
  defaultProjectId?: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const customersMap = useProjectStore((s) => s.customers);
  const projectsMap  = useProjectStore((s) => s.projects);
  const contactsMap  = useProjectStore((s) => s.contacts);
  const createTicket = useProjectStore((s) => s.createTicket);

  const customers = useMemo(
    () => Object.values(customersMap).sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [customersMap],
  );

  const [customerId, setCustomerId] = useState<string>(defaultCustomerId ?? customers[0]?.id ?? '');
  const [projectId, setProjectId]   = useState<string>(defaultProjectId ?? '');
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority]     = useState<TicketPriority>('medium');
  const [category, setCategory]     = useState<TicketCategory>('device_failure');
  const [reporterName, setReporterName]   = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterContactId, setReporterContactId] = useState<string>('');
  const [errors, setErrors] = useState<{ customerId?: string; projectId?: string; title?: string; description?: string; reporterName?: string }>({});
  const [busy, setBusy]     = useState(false);

  const customerLocked = !!defaultCustomerId;

  // Projects scoped to the picked customer. If none exist we keep
  // the picker disabled rather than throwing the operator to a
  // dead state.
  const projects = useMemo(
    () => Object.values(projectsMap).filter((p) => p.customerId === customerId).sort((a, b) => b.updatedAt - a.updatedAt),
    [projectsMap, customerId],
  );

  // Contacts scoped to the picked customer. Used to populate the
  // reportedBy field by selection rather than freeform typing.
  const contacts = useMemo(
    () => Object.values(contactsMap).filter((c) => c.customerId === customerId).sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [contactsMap, customerId],
  );

  // When customer changes, drop any stale project / contact selection.
  useEffect(() => {
    if (projectId && !projects.some((p) => p.id === projectId)) setProjectId('');
    if (reporterContactId && !contacts.some((c) => c.id === reporterContactId)) {
      setReporterContactId('');
    }
  }, [customerId, projects, contacts, projectId, reporterContactId]);

  // If contact id is set, mirror its name + email into the reporter
  // free-text fields so the operator can edit before submit.
  useEffect(() => {
    if (!reporterContactId) return;
    const c = contactsMap[reporterContactId];
    if (!c) return;
    setReporterName([c.firstName, c.lastName].filter(Boolean).join(' '));
    setReporterEmail(c.email ?? '');
  }, [reporterContactId, contactsMap]);

  const submit = () => {
    const next: typeof errors = {};
    if (!customerId) next.customerId = 'Pick a customer.';
    if (!projectId)  next.projectId  = 'Pick a project.';
    if (!title.trim())       next.title       = 'Title is required.';
    if (!description.trim()) next.description = 'Describe the issue so the technician has context.';
    if (!reporterName.trim()) next.reporterName = 'Who is reporting this?';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const id = createTicket({
        customerId,
        projectId,
        title: title.trim(),
        description: description.trim(),
        priority,
        category,
        reportedBy: {
          name: reporterName.trim(),
          email: reporterEmail.trim() || undefined,
        },
      });
      toast.success('Ticket created');
      onCreated?.(id);
      onClose();
    } catch (err) {
      console.error('NewTicketDialog.submit failed', err);
      toast.error('Could not create the ticket.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg w-[560px] max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="new-ticket-dialog"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-base font-medium">New service ticket</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Customer */}
          <div>
            <label className="text-xs text-muted-foreground">Customer *</label>
            {customerLocked ? (
              <div className="mt-1 px-3 py-2 text-sm bg-secondary/50 border border-border rounded-md">
                {customersMap[customerId]?.companyName ?? '(unknown)'}
              </div>
            ) : (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                data-testid="ticket-customer-picker"
                className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              >
                <option value="">Pick a customer…</option>
                {customers.map((c: Customer) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            )}
            {errors.customerId && <ErrorRow text={errors.customerId} />}
          </div>

          {/* Project */}
          <div>
            <label className="text-xs text-muted-foreground">Project *</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={!customerId || projects.length === 0}
              data-testid="ticket-project-picker"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">Pick a project…</option>
              {projects.map((p: Project) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {customerId && projects.length === 0 && (
              <p className="text-[11px] text-amber-400/80 mt-1">This customer has no projects. Open the customer page to add one first.</p>
            )}
            {errors.projectId && <ErrorRow text={errors.projectId} />}
          </div>

          {/* Title */}
          <div>
            <label className="text-xs text-muted-foreground">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Camera offline in lobby"
              data-testid="ticket-title"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            />
            {errors.title && <ErrorRow text={errors.title} />}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is the issue? When did it start? Anything the on-site contact already tried?"
              data-testid="ticket-description"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm resize-none"
            />
            {errors.description && <ErrorRow text={errors.description} />}
          </div>

          {/* Priority + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{TICKET_PRIORITY_LABEL[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{TICKET_CATEGORY_INTERNAL[c]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reporter — contact picker + freeform overrides */}
          <div>
            <label className="text-xs text-muted-foreground">Reported by *</label>
            {contacts.length > 0 && (
              <select
                value={reporterContactId}
                onChange={(e) => setReporterContactId(e.target.value)}
                className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm mb-2"
                data-testid="ticket-reporter-picker"
              >
                <option value="">Pick from this customer's contacts…</option>
                {contacts.map((c: Contact) => (
                  <option key={c.id} value={c.id}>
                    {[c.firstName, c.lastName].filter(Boolean).join(' ') || '(unnamed)'}
                    {c.title ? ` · ${c.title}` : ''}
                  </option>
                ))}
              </select>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Name"
                data-testid="ticket-reporter-name"
                className="bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              />
              <input
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="Email (optional)"
                className="bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              />
            </div>
            {errors.reporterName && <ErrorRow text={errors.reporterName} />}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={busy} data-testid="ticket-submit">
            {busy ? 'Creating…' : 'Create ticket'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorRow({ text }: { text: string }) {
  return (
    <p className="mt-1 text-[11px] text-rose-400 inline-flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" />{text}
    </p>
  );
}
