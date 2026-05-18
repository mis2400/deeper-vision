// SC.5.2 + SC.5.8 — shared New Opportunity dialog. Used by
// AccountDetail (single customer context — customer locked) and
// PipelineView (any customer — picker enabled). Persists via
// addOpportunity; refresh tolerant.

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { useProjectStore } from '../store/projectStore';
import type { OpportunityStage, OpportunitySource } from '../store/types';

const STAGE_OPTIONS: { id: OpportunityStage; label: string; defaultProb: number }[] = [
  { id: 'inquiry',     label: 'Inquiry',      defaultProb: 0.10 },
  { id: 'qualified',   label: 'Qualified',    defaultProb: 0.25 },
  { id: 'discovery',   label: 'Discovery',    defaultProb: 0.40 },
  { id: 'proposing',   label: 'Proposing',    defaultProb: 0.60 },
  { id: 'negotiating', label: 'Negotiating',  defaultProb: 0.80 },
  { id: 'on_hold',     label: 'On hold',      defaultProb: 0.20 },
];

const SOURCE_OPTIONS: { id: OpportunitySource; label: string }[] = [
  { id: 'referral',          label: 'Referral' },
  { id: 'inbound_web',       label: 'Inbound web' },
  { id: 'cold_outreach',     label: 'Cold outreach' },
  { id: 'existing_customer', label: 'Existing customer' },
  { id: 'partner',           label: 'Partner' },
  { id: 'rfp',               label: 'RFP' },
  { id: 'other',             label: 'Other' },
];

export function NewOpportunityDialog({ defaultCustomerId, onClose, onCreated }: {
  /** When set, the customer picker is hidden / locked. AccountDetail
   *  passes this so the opportunity is always against the customer
   *  the operator was viewing. PipelineView leaves it undefined. */
  defaultCustomerId?: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const customersMap = useProjectStore((s) => s.customers);
  const addOpportunity = useProjectStore((s) => s.addOpportunity);

  const customers = useMemo(
    () => Object.values(customersMap).sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [customersMap],
  );

  const [name, setName]               = useState('');
  const [customerId, setCustomerId]   = useState(defaultCustomerId ?? customers[0]?.id ?? '');
  const [estValue, setEstValue]       = useState('');
  const [stage, setStage]             = useState<OpportunityStage>('inquiry');
  const [source, setSource]           = useState<OpportunitySource | ''>('');
  const [expectedClose, setExpectedClose] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors]           = useState<{ name?: string; customerId?: string; estValue?: string }>({});
  const [busy, setBusy]               = useState(false);

  const customerLocked = !!defaultCustomerId;

  const submit = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Required';
    if (!customerId) errs.customerId = 'Pick a customer';
    if (estValue.trim() && Number.isNaN(Number(estValue))) errs.estValue = 'Must be a number';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setBusy(true);
    try {
      const now = Date.now();
      const id = `opp-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      addOpportunity({
        id,
        customerId,
        name: name.trim(),
        stage,
        estValue: estValue.trim() ? Number(estValue) : undefined,
        source: (source || undefined) as OpportunitySource | undefined,
        expectedCloseDate: expectedClose ? new Date(expectedClose + 'T12:00:00').getTime() : undefined,
        description: description.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      }, { userName: 'You' });
      toast.success('Opportunity created', { description: name.trim() });
      onCreated?.(id);
      onClose();
    } catch (err) {
      console.error('Opportunity create failed', err);
      toast.error('Could not create opportunity. Try again.');
      setBusy(false);
    }
  };

  if (customers.length === 0) {
    return (
      <DialogShell onClose={onClose} title="New opportunity" subtitle="Add a deal to the pipeline.">
        <div className="px-5 py-4">
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>No customers on file yet. Create a customer first from /customers.</span>
          </div>
        </div>
        <DialogFooter onClose={onClose} />
      </DialogShell>
    );
  }

  return (
    <DialogShell onClose={onClose} title="New opportunity" subtitle="Add a deal to the pipeline. Links to a customer; convert to a project on close-won.">
      <div className="px-5 py-4 space-y-3" data-testid="opp-new-dialog">
        <Field label="Deal name *" error={errors.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Acme HQ camera refresh"
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="opp-field-name"
          />
        </Field>
        <Field label={customerLocked ? 'Customer (locked)' : 'Customer *'} error={errors.customerId}>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={customerLocked}
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm disabled:opacity-60"
            data-testid="opp-field-customer"
          >
            {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estimated value (USD)" error={errors.estValue}>
            <input
              value={estValue}
              onChange={(e) => setEstValue(e.target.value)}
              inputMode="numeric"
              placeholder="125000"
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm tabular-nums"
              data-testid="opp-field-estValue"
            />
          </Field>
          <Field label="Stage">
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as OpportunityStage)}
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="opp-field-stage"
            >
              {STAGE_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expected close">
            <input
              type="date"
              value={expectedClose}
              onChange={(e) => setExpectedClose(e.target.value)}
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="opp-field-close"
            />
          </Field>
          <Field label="Source">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as OpportunitySource | '')}
              className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="opp-field-source"
            >
              <option value="">Select source</option>
              {SOURCE_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description / notes">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Scope notes, decision criteria, blockers."
            className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
            data-testid="opp-field-description"
          />
        </Field>
      </div>
      <DialogFooter onClose={onClose}>
        <Button onClick={submit} disabled={busy} data-testid="opp-submit">
          <Plus className="w-3.5 h-3.5 mr-1" />
          {busy ? 'Creating…' : 'Create opportunity'}
        </Button>
      </DialogFooter>
    </DialogShell>
  );
}

// ─────────────────────── Dialog primitives ──────────────────────
function DialogShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
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
