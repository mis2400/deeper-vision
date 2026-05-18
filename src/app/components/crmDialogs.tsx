// SC.5.2 + SC.5.3 + SC.5.4 + SC.5.5 — shared CRM creation dialogs.
// Used by AccountDetail, ContactManager, SiteManager, BuildingManager,
// and ProjectHub. Single source of truth for the persistence calls
// (addContact, logTouch, addSite, addBuilding, addProject) so a
// future schema bump only touches one file.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Plus, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { useProjectStore } from '../store/projectStore';
import type {
  Contact, ContactRole, TouchType, Project, LifecyclePhase,
} from '../store/types';

const TOUCH_TYPES: { id: TouchType; label: string }[] = [
  { id: 'call',       label: 'Call' },
  { id: 'email',      label: 'Email' },
  { id: 'meeting',    label: 'Meeting' },
  { id: 'note',       label: 'Note' },
  { id: 'demo',       label: 'Demo' },
  { id: 'site_visit', label: 'Site visit' },
  { id: 'sms',        label: 'SMS' },
  { id: 'quote_sent', label: 'Quote sent' },
];

const CONTACT_ROLES: { id: ContactRole; label: string }[] = [
  { id: 'decision_maker', label: 'Decision maker' },
  { id: 'champion',       label: 'Champion' },
  { id: 'technical',      label: 'Technical' },
  { id: 'finance',        label: 'Finance' },
  { id: 'security',       label: 'Security' },
  { id: 'facilities',     label: 'Facilities' },
  { id: 'operations',     label: 'Operations' },
  { id: 'other',          label: 'Other' },
];

// ──────────────────────────────────────────────────────────────────
// Log touch
// ──────────────────────────────────────────────────────────────────
export function LogTouchDialog({ customerId, onClose }: {
  customerId: string;
  onClose: () => void;
}) {
  const logTouch = useProjectStore((s) => s.logTouch);
  const customer = useProjectStore((s) => s.customers[customerId]);
  const contactsMap = useProjectStore((s) => s.contacts);
  const contacts = useMemo(
    () => Object.values(contactsMap).filter((c) => c.customerId === customerId),
    [contactsMap, customerId],
  );

  const [type, setType]         = useState<TouchType>('call');
  const [summary, setSummary]   = useState('');
  const [contactId, setContactId] = useState<string>(contacts[0]?.id ?? '');
  const [detail, setDetail]     = useState('');
  const [occurredAt, setOccurredAt] = useState(toLocalDatetime(new Date()));
  const [errors, setErrors]     = useState<{ summary?: string }>({});
  const [busy, setBusy]         = useState(false);

  const submit = () => {
    const errs: typeof errors = {};
    if (!summary.trim()) errs.summary = 'Required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setBusy(true);
    try {
      const occurredTs = new Date(occurredAt).getTime();
      logTouch({
        customerId,
        contactId: contactId || undefined,
        type,
        summary: summary.trim(),
        detail: detail.trim() || undefined,
        userName: 'You',
        occurredAt: Number.isFinite(occurredTs) ? occurredTs : Date.now(),
      });
      toast.success('Touch logged', { description: summary.trim() });
      onClose();
    } catch (err) {
      console.error('Touch log failed', err);
      toast.error('Could not log touch. Try again.');
      setBusy(false);
    }
  };

  return (
    <DialogShell title="Log touch" subtitle={`Track an interaction with ${customer?.companyName ?? 'this customer'}.`}>
      <div className="px-5 py-4 space-y-3" data-testid="touch-dialog">
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TouchType)}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="touch-field-type"
          >
            {TOUCH_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Summary *" error={errors.summary}>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            autoFocus
            placeholder="Talked through the camera count change."
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="touch-field-summary"
          />
        </Field>
        {contacts.length > 0 && (
          <Field label="Contact (optional)">
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="touch-field-contact"
            >
              <option value="">No specific contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.firstName, c.lastName].filter(Boolean).join(' ')}{c.title ? ` · ${c.title}` : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="When">
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="touch-field-occurredAt"
          />
        </Field>
        <Field label="Detail (optional)">
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="touch-field-detail"
          />
        </Field>
      </div>
      <DialogFooter onClose={onClose}>
        <Button onClick={submit} disabled={busy} data-testid="touch-submit">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {busy ? 'Saving…' : 'Log touch'}
        </Button>
      </DialogFooter>
    </DialogShell>
  );
}

// ──────────────────────────────────────────────────────────────────
// New contact
// ──────────────────────────────────────────────────────────────────
export function NewContactDialog({ defaultCustomerId, onClose, onCreated }: {
  defaultCustomerId?: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const addContact = useProjectStore((s) => s.addContact);
  const updateCustomer = useProjectStore((s) => s.updateCustomer);
  const customersMap = useProjectStore((s) => s.customers);
  const contactsMap  = useProjectStore((s) => s.contacts);
  const customers = useMemo(
    () => Object.values(customersMap).sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [customersMap],
  );
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? customers[0]?.id ?? '');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [title, setTitle]         = useState('');
  const [role, setRole]           = useState<ContactRole | ''>('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes]         = useState('');
  const [errors, setErrors] = useState<{ firstName?: string; email?: string; customerId?: string }>({});
  const [busy, setBusy] = useState(false);
  const customerLocked = !!defaultCustomerId;

  if (customers.length === 0) {
    return (
      <DialogShell title="New contact" subtitle="Add a person to a customer.">
        <div className="px-5 py-4">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>No customers yet. Create a customer from /customers first.</span>
          </div>
        </div>
        <DialogFooter onClose={onClose} />
      </DialogShell>
    );
  }

  // Auto-suggest primary when this would be the customer's first contact.
  const customerHasAnyContact = Object.values(contactsMap).some((c) => c.customerId === customerId);

  const submit = () => {
    const errs: typeof errors = {};
    if (!firstName.trim() && !lastName.trim()) errs.firstName = 'Required';
    if (!email.trim()) errs.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Enter a valid email';
    if (!customerId) errs.customerId = 'Pick a customer';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setBusy(true);
    try {
      const now = Date.now();
      const id = `ct-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const wantsPrimary = isPrimary || !customerHasAnyContact;
      addContact({
        id,
        customerId,
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        title: title.trim() || undefined,
        role: (role || undefined) as ContactRole | undefined,
        isPrimary: wantsPrimary,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
      if (wantsPrimary) {
        // Promote this contact to primary on the customer record so
        // every existing reader (portal, project center) picks it up.
        updateCustomer(customerId, { primaryContactId: id });
      }
      toast.success('Contact added', { description: `${firstName.trim()} ${lastName.trim()}`.trim() });
      onCreated?.(id);
      onClose();
    } catch (err) {
      console.error('Contact create failed', err);
      toast.error('Could not add contact. Try again.');
      setBusy(false);
    }
  };

  return (
    <DialogShell title="New contact" subtitle={customerLocked ? `Add a person at this customer.` : 'Add a person to a customer.'}>
      <div className="px-5 py-4 space-y-3" data-testid="contact-new-dialog">
        <Field label={customerLocked ? 'Customer (locked)' : 'Customer *'} error={errors.customerId}>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={customerLocked}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm disabled:opacity-60"
            data-testid="contact-field-customer"
          >
            {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name *" error={errors.firstName}>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="contact-field-firstName"
            />
          </Field>
          <Field label="Last name">
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="contact-field-lastName"
            />
          </Field>
        </div>
        <Field label="Email *" error={errors.email}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="contact-field-email"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="contact-field-phone"
            />
          </Field>
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Director of facilities"
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="contact-field-title"
            />
          </Field>
        </div>
        <Field label="Role tag">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ContactRole | '')}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="contact-field-role"
          >
            <option value="">Select role</option>
            {CONTACT_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </Field>
        {customerHasAnyContact && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              data-testid="contact-field-primary"
            />
            Mark as primary contact for this customer
          </label>
        )}
        <Field label="Internal notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="contact-field-notes"
          />
        </Field>
      </div>
      <DialogFooter onClose={onClose}>
        <Button onClick={submit} disabled={busy} data-testid="contact-submit">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {busy ? 'Saving…' : 'Add contact'}
        </Button>
      </DialogFooter>
    </DialogShell>
  );
}

// ──────────────────────────────────────────────────────────────────
// New site (Site belongs to a project per the current schema — we
// surface the same dialog under the customer context by linking
// to ANY project for that customer, or stub a project shell. For
// SC.5 V1 we link to an explicit existing project; standalone site
// creation pre project is deferred to a later schema bump.)
// ──────────────────────────────────────────────────────────────────
export function NewSiteDialog({ defaultProjectId, defaultCustomerId, onClose, onCreated }: {
  defaultProjectId?: string;
  defaultCustomerId?: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const addSite = useProjectStore((s) => s.addSite);
  const projectsMap = useProjectStore((s) => s.projects);

  const eligibleProjects = useMemo(
    () => Object.values(projectsMap)
      .filter((p) => !defaultCustomerId || p.customerId === defaultCustomerId)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [projectsMap, defaultCustomerId],
  );

  const [projectId, setProjectId] = useState(defaultProjectId ?? eligibleProjects[0]?.id ?? '');
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postal, setPostal] = useState('');
  const [errors, setErrors] = useState<{ name?: string; projectId?: string }>({});
  const [busy, setBusy] = useState(false);

  if (eligibleProjects.length === 0) {
    return (
      <DialogShell title="New site" subtitle="Sites attach to projects.">
        <div className="px-5 py-4">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>No projects {defaultCustomerId ? 'for this customer' : 'on file'} yet. Create a project first, then add sites to it.</span>
          </div>
        </div>
        <DialogFooter onClose={onClose} />
      </DialogShell>
    );
  }

  const submit = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Required';
    if (!projectId) errs.projectId = 'Pick a project';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setBusy(true);
    try {
      const now = Date.now();
      const id = `site-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const addressLine = [street.trim(), city.trim(), state.trim(), postal.trim()].filter(Boolean).join(', ');
      addSite({
        id,
        projectId,
        name: name.trim(),
        // Site.address is required string; default to empty when
        // the operator skipped it.
        address: addressLine,
      });
      toast.success('Site created', { description: name.trim() });
      onCreated?.(id);
      onClose();
    } catch (err) {
      console.error('Site create failed', err);
      toast.error('Could not create site. Try again.');
      setBusy(false);
    }
  };

  return (
    <DialogShell title="New site" subtitle="Add a site location to a project.">
      <div className="px-5 py-4 space-y-3" data-testid="site-new-dialog">
        <Field label="Project *" error={errors.projectId}>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="site-field-project"
          >
            {eligibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Site name *" error={errors.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Main campus"
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="site-field-name"
          />
        </Field>
        <Field label="Street">
          <input
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="site-field-street"
          />
        </Field>
        <div className="grid grid-cols-[1fr_80px_100px] gap-2">
          <Field label="City">
            <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm" />
          </Field>
          <Field label="State">
            <input value={state} onChange={(e) => setState(e.target.value)} className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm" />
          </Field>
          <Field label="ZIP">
            <input value={postal} onChange={(e) => setPostal(e.target.value)} className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm" />
          </Field>
        </div>
      </div>
      <DialogFooter onClose={onClose}>
        <Button onClick={submit} disabled={busy} data-testid="site-submit">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {busy ? 'Saving…' : 'Create site'}
        </Button>
      </DialogFooter>
    </DialogShell>
  );
}

// ──────────────────────────────────────────────────────────────────
// New building
// ──────────────────────────────────────────────────────────────────
export function NewBuildingDialog({ defaultSiteId, defaultCustomerId, onClose, onCreated }: {
  defaultSiteId?: string;
  defaultCustomerId?: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const addBuilding = useProjectStore((s) => s.addBuilding);
  const sitesMap = useProjectStore((s) => s.sites);
  const projectsMap = useProjectStore((s) => s.projects);

  const eligibleSites = useMemo(() => {
    const all = Object.values(sitesMap);
    if (!defaultCustomerId) return all;
    return all.filter((s) => {
      const proj = projectsMap[s.projectId];
      return proj && proj.customerId === defaultCustomerId;
    });
  }, [sitesMap, projectsMap, defaultCustomerId]);

  const [siteId, setSiteId] = useState(defaultSiteId ?? eligibleSites[0]?.id ?? '');
  const [name, setName] = useState('');
  const [floorCount, setFloorCount] = useState('1');
  const [grossSqFt, setGrossSqFt] = useState('');
  const [type, setType] = useState('');
  const [errors, setErrors] = useState<{ name?: string; siteId?: string }>({});
  const [busy, setBusy] = useState(false);

  if (eligibleSites.length === 0) {
    return (
      <DialogShell title="New building" subtitle="Buildings attach to sites.">
        <div className="px-5 py-4">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>No sites {defaultCustomerId ? 'for this customer' : 'on file'} yet. Create a site first, then add buildings to it.</span>
          </div>
        </div>
        <DialogFooter onClose={onClose} />
      </DialogShell>
    );
  }

  const submit = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Required';
    if (!siteId) errs.siteId = 'Pick a site';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setBusy(true);
    try {
      const now = Date.now();
      const id = `bld-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      addBuilding({
        id,
        siteId,
        name: name.trim(),
        type: type.trim() || undefined,
        floorsCount: Number(floorCount) || 1,
        grossSqFt: grossSqFt.trim() ? Number(grossSqFt) : undefined,
      } as any);
      toast.success('Building created', { description: name.trim() });
      onCreated?.(id);
      onClose();
    } catch (err) {
      console.error('Building create failed', err);
      toast.error('Could not create building. Try again.');
      setBusy(false);
    }
  };

  return (
    <DialogShell title="New building" subtitle="Add a building to a site.">
      <div className="px-5 py-4 space-y-3" data-testid="building-new-dialog">
        <Field label="Site *" error={errors.siteId}>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="building-field-site"
          >
            {eligibleSites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Building name *" error={errors.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Tower A"
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="building-field-name"
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Floors">
            <input
              type="number"
              min={1}
              value={floorCount}
              onChange={(e) => setFloorCount(e.target.value)}
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm tabular-nums"
              data-testid="building-field-floors"
            />
          </Field>
          <Field label="Gross sq ft">
            <input
              type="number"
              min={0}
              value={grossSqFt}
              onChange={(e) => setGrossSqFt(e.target.value)}
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm tabular-nums"
              data-testid="building-field-grossSqFt"
            />
          </Field>
          <Field label="Type">
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="office / warehouse"
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="building-field-type"
            />
          </Field>
        </div>
      </div>
      <DialogFooter onClose={onClose}>
        <Button onClick={submit} disabled={busy} data-testid="building-submit">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {busy ? 'Saving…' : 'Create building'}
        </Button>
      </DialogFooter>
    </DialogShell>
  );
}

// ──────────────────────────────────────────────────────────────────
// New project (links to customer, optionally creates site /
// building / floor if none exist)
// ──────────────────────────────────────────────────────────────────
export function NewProjectDialog({ defaultCustomerId, onClose, onCreated }: {
  defaultCustomerId?: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const addProject  = useProjectStore((s) => s.addProject);
  const addSite     = useProjectStore((s) => s.addSite);
  const addBuilding = useProjectStore((s) => s.addBuilding);
  const addFloor    = useProjectStore((s) => s.addFloor);
  const customersMap = useProjectStore((s) => s.customers);
  const customers = useMemo(
    () => Object.values(customersMap).sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [customersMap],
  );
  const navigate = useNavigate();

  const [customerId, setCustomerId] = useState(defaultCustomerId ?? customers[0]?.id ?? '');
  const [name, setName]             = useState('');
  const [phase, setPhase]           = useState<LifecyclePhase>('discovery');
  const [siteName, setSiteName]     = useState('Main Site');
  const [buildingName, setBuildingName] = useState('Main Building');
  const [errors, setErrors] = useState<{ name?: string; customerId?: string; siteName?: string; buildingName?: string }>({});
  const [busy, setBusy] = useState(false);
  const customerLocked = !!defaultCustomerId;

  if (customers.length === 0) {
    return (
      <DialogShell title="New project" subtitle="Projects attach to a customer.">
        <div className="px-5 py-4">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>No customers yet. Create a customer first.</span>
          </div>
        </div>
        <DialogFooter onClose={onClose} />
      </DialogShell>
    );
  }

  const submit = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Required';
    if (!customerId) errs.customerId = 'Pick a customer';
    if (!siteName.trim()) errs.siteName = 'Required';
    if (!buildingName.trim()) errs.buildingName = 'Required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setBusy(true);
    try {
      const now = Date.now();
      const projectId = `p-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const siteId    = `site-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const buildingId = `bld-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const floorId   = `fl-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      const project: Project = {
        id: projectId,
        name: name.trim(),
        customerId,
        siteId,
        status: 'design',
        lifecyclePhase: phase,
        createdAt: now,
        updatedAt: now,
        phaseStartedAt: now,
      };
      addProject(project);
      addSite({
        id: siteId,
        projectId,
        name: siteName.trim(),
      } as any);
      addBuilding({
        id: buildingId,
        siteId,
        name: buildingName.trim(),
        floorsCount: 1,
      } as any);
      addFloor({
        id: floorId,
        projectId,
        buildingId,
        name: 'Ground floor',
        level: 0,
        scalePxToFt: 0.05,
        createdAt: now,
      } as any);
      toast.success('Project created', { description: name.trim() });
      onCreated?.(projectId);
      onClose();
      navigate(`/project/${projectId}`);
    } catch (err) {
      console.error('Project create failed', err);
      toast.error('Could not create project. Try again.');
      setBusy(false);
    }
  };

  return (
    <DialogShell title="New project" subtitle="Creates the project plus a default site, building, and ground floor so the canvas is ready immediately.">
      <div className="px-5 py-4 space-y-3" data-testid="project-new-dialog">
        <Field label={customerLocked ? 'Customer (locked)' : 'Customer *'} error={errors.customerId}>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={customerLocked}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm disabled:opacity-60"
            data-testid="project-field-customer"
          >
            {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </Field>
        <Field label="Project name *" error={errors.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Riverbend HQ camera refresh"
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="project-field-name"
          />
        </Field>
        <Field label="Lifecycle phase">
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value as LifecyclePhase)}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="project-field-phase"
          >
            <option value="discovery">Discovery</option>
            <option value="survey">Survey</option>
            <option value="engineering">Engineering</option>
            <option value="estimate">Estimate</option>
            <option value="proposal">Proposal</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Default site name *" error={errors.siteName}>
            <input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="project-field-siteName"
            />
          </Field>
          <Field label="Default building name *" error={errors.buildingName}>
            <input
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="project-field-buildingName"
            />
          </Field>
        </div>
      </div>
      <DialogFooter onClose={onClose}>
        <Button onClick={submit} disabled={busy} data-testid="project-submit">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {busy ? 'Creating…' : 'Create project'}
        </Button>
      </DialogFooter>
    </DialogShell>
  );
}

// ──────────────────────────────────────────────────────────────────
// Shared primitives
// ──────────────────────────────────────────────────────────────────
function DialogShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-6">
      <div className="bg-card w-full sm:max-w-md sm:rounded-xl shadow-2xl border-t sm:border border-border max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogFooter({ onClose, children }: { onClose: () => void; children?: React.ReactNode }) {
  return (
    <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center h-8 px-3 rounded-md text-[12px] text-muted-foreground hover:text-foreground border border-border"
      >Cancel</button>
      {children}
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

function toLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
