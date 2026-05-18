// SC.5.1 — Customer manager surface. The integrator's standalone
// list view + creation form for Customer records. Before SC.5 the
// only way to create a customer was via the SiteIntake side
// effect chain; this is the CRM-first entry point.
//
// Persistence goes through addCustomer (and addContact when the
// operator fills the optional primary contact during creation).
// Refresh tolerant via the Zustand persist slice.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import {
  Plus, Users, Building2, Mail, Phone, MoreHorizontal,
  AlertTriangle, ChevronRight, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useProjectStore } from '../store/projectStore';
import type { Customer, Contact, Industry } from '../store/types';

const INDUSTRY_OPTIONS: { id: Industry; label: string }[] = [
  { id: 'commercial_re', label: 'Commercial real estate' },
  { id: 'healthcare',    label: 'Healthcare' },
  { id: 'education',     label: 'Education' },
  { id: 'retail',        label: 'Retail' },
  { id: 'data_center',   label: 'Data center' },
  { id: 'hospitality',   label: 'Hospitality' },
  { id: 'government',    label: 'Government' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'logistics',     label: 'Logistics' },
  { id: 'multifamily',   label: 'Multifamily' },
  { id: 'other',         label: 'Other' },
];

export function CustomerManager() {
  const navigate = useNavigate();
  const customersMap = useProjectStore((s) => s.customers);
  const contactsMap  = useProjectStore((s) => s.contacts);
  const projectsMap  = useProjectStore((s) => s.projects);
  const activityMap  = useProjectStore((s) => s.activity);

  const customers = useMemo(
    () => Object.values(customersMap).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [customersMap],
  );

  const [newOpen, setNewOpen] = useState(false);

  return (
    <AppShell
      crumbs={[{ label: 'CRM' }, { label: 'Customers' }]}
      title="Customers"
      subtitle={`${customers.length} on file`}
      actions={
        <Button size="sm" onClick={() => setNewOpen(true)} data-testid="customer-new">
          <Plus className="w-3.5 h-3.5 mr-1" />New customer
        </Button>
      }
    >
      <div className="max-w-[1100px] mx-auto px-6 py-6">
        {customers.length === 0 ? (
          <EmptyState onCreate={() => setNewOpen(true)} />
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_140px_140px_120px_40px] gap-3 px-4 py-2 border-b border-border bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <div>Customer</div>
              <div>Primary contact</div>
              <div>Projects</div>
              <div>Last activity</div>
              <div />
            </div>
            <ul className="divide-y divide-border">
              {customers.map((c) => (
                <CustomerRow
                  key={c.id}
                  customer={c}
                  primaryContact={c.primaryContactId ? contactsMap[c.primaryContactId] : undefined}
                  projects={Object.values(projectsMap).filter((p) => p.customerId === c.id)}
                  lastActivity={Object.values(activityMap)
                    .filter((a) => projectsMap[a.projectId]?.customerId === c.id)
                    .reduce((max, a) => Math.max(max, a.createdAt), 0)}
                  onOpen={() => navigate(`/account/${c.id}`)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      {newOpen && (
        <NewCustomerDialog
          onClose={() => setNewOpen(false)}
          onCreated={(id) => {
            setNewOpen(false);
            navigate(`/account/${id}`);
          }}
        />
      )}
    </AppShell>
  );
}

// ─────────────────────── Empty state ─────────────────────────────
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center max-w-md mx-auto py-16">
      <div className="w-12 h-12 rounded-xl bg-secondary/60 inline-flex items-center justify-center">
        <Users className="w-5 h-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium mt-4">No customers yet</h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        Create your first to begin tracking projects, contacts, sites, and assets in one place.
      </p>
      <Button className="mt-5" onClick={onCreate} data-testid="customer-new-empty">
        <Plus className="w-4 h-4 mr-1" />New customer
      </Button>
    </div>
  );
}

// ─────────────────────── Customer row ────────────────────────────
function CustomerRow({ customer, primaryContact, projects, lastActivity, onOpen }: {
  customer: Customer;
  primaryContact?: Contact;
  projects: { lifecyclePhase?: string }[];
  lastActivity: number;
  onOpen: () => void;
}) {
  const activeProjects = projects.filter((p) => p.lifecyclePhase && p.lifecyclePhase !== 'archived' && p.lifecyclePhase !== 'completed').length;
  return (
    <li className="hover:bg-secondary/30">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left grid grid-cols-[1fr_140px_140px_120px_40px] gap-3 px-4 py-3 items-center"
        data-testid={`customer-row-${customer.id}`}
      >
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{customer.companyName}</div>
          {customer.addresses?.[0] && (
            <div className="text-[11px] text-muted-foreground truncate">
              {[customer.addresses[0].city, customer.addresses[0].state].filter(Boolean).join(', ')}
            </div>
          )}
        </div>
        <div className="min-w-0 text-xs text-muted-foreground truncate">
          {primaryContact
            ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim()
            : <span className="italic text-muted-foreground/60">No contact</span>}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {projects.length} <span className="opacity-60">total</span>
          {activeProjects > 0 && <span className="text-emerald-500 ml-2">{activeProjects} active</span>}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {lastActivity ? relativeShort(lastActivity) : '—'}
        </div>
        <div className="text-muted-foreground"><ChevronRight className="w-3.5 h-3.5" /></div>
      </button>
    </li>
  );
}

function relativeShort(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)    return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

// ─────────────────────── New customer dialog ─────────────────────
function NewCustomerDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const addCustomer = useProjectStore((s) => s.addCustomer);
  const addContact  = useProjectStore((s) => s.addContact);

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry]       = useState<Industry | ''>('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [street, setStreet]           = useState('');
  const [city, setCity]               = useState('');
  const [state, setState]             = useState('');
  const [postal, setPostal]           = useState('');
  const [notes, setNotes]             = useState('');
  const [errors, setErrors]           = useState<{ companyName?: string; contactEmail?: string }>({});
  const [busy, setBusy]               = useState(false);

  const submit = () => {
    const errs: typeof errors = {};
    const trimmedName = companyName.trim();
    if (!trimmedName) errs.companyName = 'Required';
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      errs.contactEmail = 'Enter a valid email';
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setBusy(true);
    try {
      const now = Date.now();
      const cid = `c-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      let primaryContactId: string | undefined;
      const trimmedContactName = contactName.trim();
      if (trimmedContactName || contactEmail.trim()) {
        // Split "First Last"; everything after the first space is last.
        const [first, ...rest] = trimmedContactName.split(/\s+/);
        primaryContactId = `ct-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        addContact({
          id: primaryContactId,
          customerId: cid,
          firstName: first ?? '',
          lastName: rest.join(' '),
          email: contactEmail.trim() || undefined,
          phone: contactPhone.trim() || undefined,
          isPrimary: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      const addresses = (street || city || state || postal)
        ? [{ street: street.trim(), city: city.trim(), state: state.trim() || undefined, postal: postal.trim() || undefined }]
        : [];
      addCustomer({
        id: cid,
        companyName: trimmedName,
        addresses,
        industry: (industry || undefined) as Industry | undefined,
        primaryContactId,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
      toast.success('Customer created', { description: trimmedName });
      onCreated(cid);
    } catch (err) {
      console.error('Customer create failed', err);
      toast.error('Could not create customer. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-6" data-testid="customer-new-dialog">
      <div className="bg-card w-full sm:max-w-md sm:rounded-xl shadow-2xl border-t sm:border border-border max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-medium">New customer</div>
          <div className="text-xs text-muted-foreground mt-1">
            Add a company. You can add contacts, sites, and projects to it from the customer detail page.
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Field label="Company name *" error={errors.companyName}>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoFocus
              placeholder="Acme Health Network"
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="customer-field-companyName"
            />
          </Field>
          <Field label="Industry">
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value as Industry | '')}
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="customer-field-industry"
            >
              <option value="">Select an industry</option>
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </Field>

          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-2 pt-3 border-t border-border/60">
            Primary contact (optional)
          </div>
          <Field label="Name">
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="First Last"
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="customer-field-contactName"
            />
          </Field>
          <Field label="Email" error={errors.contactEmail}>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@company.com"
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="customer-field-contactEmail"
            />
          </Field>
          <Field label="Phone">
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="555 555 5555"
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="customer-field-contactPhone"
            />
          </Field>

          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-2 pt-3 border-t border-border/60">
            Address (optional)
          </div>
          <Field label="Street">
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-[1fr_80px_100px] gap-2">
            <Field label="City">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              />
            </Field>
            <Field label="State">
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              />
            </Field>
            <Field label="ZIP">
              <input
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
                className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Internal notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything the sales / engineering team should know."
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center h-8 px-3 rounded-md text-[12px] text-muted-foreground hover:text-foreground border border-border"
          >Cancel</button>
          <Button onClick={submit} disabled={busy} data-testid="customer-create-submit">
            <Plus className="w-3.5 h-3.5 mr-1" />
            {busy ? 'Creating…' : 'Create customer'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {error && <div className="text-[11px] text-destructive mt-1">{error}</div>}
    </label>
  );
}
