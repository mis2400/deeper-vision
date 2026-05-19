// SC.3.1 — shared commissioning UI. Imported from both
// DeploymentMode.tsx (desktop) and DeploymentModeMobile.tsx so the
// sheet, summary panel, and default test list live in one place.
//
// Default test checklist: brief calls these four out explicitly.
// Per device type overrides slot into testResults later via a small
// lookup; the persisted shape never has to change because each test
// carries its own id.

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Circle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type { Device, DeviceCommissioning, DeviceCommissionStatus, DeviceCommissionTest } from '../store/types';

export const DEFAULT_COMMISSION_TESTS: DeviceCommissionTest[] = [
  { id: 'powered_on', label: 'Powered on',          passed: false },
  { id: 'network',    label: 'Network reachable',   passed: false },
  { id: 'recording',  label: 'Recording verified',  passed: false },
  { id: 'configured', label: 'Configured per spec', passed: false },
];

export const COMMISSION_STATUS_META: Record<DeviceCommissionStatus, { label: string; tone: string }> = {
  pending: { label: 'Pending',          tone: '#94A3B8' },
  pass:    { label: 'Pass',             tone: '#10B981' },
  partial: { label: 'Partial · review', tone: '#F59E0B' },
  fail:    { label: 'Fail',             tone: '#EF4444' },
};

export function commissionStatusFromTests(tests: DeviceCommissionTest[]): DeviceCommissionStatus {
  if (tests.length === 0) return 'pending';
  const passed = tests.filter((t) => t.passed).length;
  if (passed === tests.length) return 'pass';
  if (passed === 0) return 'fail';
  return 'partial';
}

export function CommissionSummaryPanel({ device }: { device: Device }) {
  const c = device.commissioning;
  if (!c) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 bg-secondary/10 text-[12px] text-muted-foreground">
        Not yet commissioned. Use the Commission action when the install is verified.
      </div>
    );
  }
  const meta = COMMISSION_STATUS_META[c.status];
  return (
    <div className="rounded-lg border border-border p-3 bg-secondary/15">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Commissioning</div>
        <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[10px] border"
          style={{ color: meta.tone, borderColor: `${meta.tone}55`, background: `${meta.tone}14` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.tone }} />{meta.label}
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 mt-2 text-[11px]">
        <span className="text-muted-foreground">Date</span><span className="text-foreground">{c.commissionedAt || '—'}</span>
        <span className="text-muted-foreground">By</span><span className="text-foreground">{c.commissionedBy || '—'}</span>
        {c.serialNumber && (<><span className="text-muted-foreground">Serial</span><span className="text-foreground">{c.serialNumber}</span></>)}
      </div>
      {c.testResults.length > 0 && (
        <ul className="mt-3 space-y-1">
          {c.testResults.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-[11px]">
              {t.passed
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className={t.passed ? 'text-foreground' : 'text-muted-foreground'}>{t.label}</span>
            </li>
          ))}
        </ul>
      )}
      {c.notes && (
        <div className="mt-3 text-[11px] text-foreground whitespace-pre-wrap">{c.notes}</div>
      )}
    </div>
  );
}

export function CommissionSheet({ device, onCancel, onDone }: {
  device: Device;
  onCancel: () => void;
  onDone: () => void;
}) {
  const setCommissioning = useProjectStore((s) => s.setDeviceCommissioning);
  const prev = device.commissioning;
  const [name, setName] = useState(prev?.commissionedBy ?? '');
  const [date, setDate] = useState(prev?.commissionedAt ?? new Date().toISOString().slice(0, 10));
  const [serial, setSerial] = useState(prev?.serialNumber ?? '');
  const [notes, setNotes] = useState(prev?.notes ?? '');
  const [tests, setTests] = useState<DeviceCommissionTest[]>(() =>
    prev?.testResults && prev.testResults.length > 0
      ? prev.testResults.map((t) => ({ ...t }))
      : DEFAULT_COMMISSION_TESTS.map((t) => ({ ...t })),
  );
  const [errors, setErrors] = useState<{ name?: string; date?: string }>({});
  const [busy, setBusy] = useState(false);

  const derivedStatus = commissionStatusFromTests(tests);
  const meta = COMMISSION_STATUS_META[derivedStatus];

  const toggleTest = (id: string) =>
    setTests((arr) => arr.map((t) => (t.id === id ? { ...t, passed: !t.passed } : t)));

  const submit = () => {
    const errs: typeof errors = {};
    const trimmedName = name.trim();
    const trimmedDate = date.trim();
    if (!trimmedName) errs.name = 'Required';
    if (!trimmedDate) errs.date = 'Required';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setBusy(true);
    try {
      const record: DeviceCommissioning = {
        status: derivedStatus,
        commissionedAt: trimmedDate,
        commissionedBy: trimmedName,
        serialNumber: serial.trim() || undefined,
        notes: notes.trim() || undefined,
        testResults: tests,
      };
      setCommissioning(device.id, record);
      toast.success(`Commissioning ${derivedStatus}`, {
        description: `${device.label || device.id} marked ${meta.label.toLowerCase()}.`,
      });
      onDone();
    } catch (err) {
      console.error('Commissioning save failed', (err as any)?.name);
      toast.error('Could not save commissioning. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 p-0 sm:p-6" data-testid="commission-sheet">
      <div className="bg-card w-full sm:max-w-md sm:rounded-xl shadow-2xl border-t sm:border border-border max-h-[92vh] [@supports(height:100dvh)]:max-h-[92dvh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Commission {device.label || device.id}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Record the install tests + sign off. Pass status creates a real Asset record.
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[10px] border shrink-0"
              style={{ color: meta.tone, borderColor: `${meta.tone}55`, background: `${meta.tone}14` }}>
              {meta.label}
            </span>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Commissioner</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="commission-name"
            />
            {errors.name && <div className="text-[11px] text-destructive mt-1">{errors.name}</div>}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Commissioning date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="commission-date"
            />
            {errors.date && <div className="text-[11px] text-destructive mt-1">{errors.date}</div>}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Serial number (optional)</label>
            <input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="Often unknown at install"
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="commission-serial"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tests</label>
            <ul className="mt-1 space-y-1.5">
              {tests.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => toggleTest(t.id)}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors ${
                      t.passed
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                        : 'border-border hover:bg-secondary/40 text-muted-foreground'
                    }`}
                    data-testid={`commission-test-${t.id}`}
                  >
                    {t.passed
                      ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                      : <Circle className="w-3.5 h-3.5" />}
                    <span className="text-sm">{t.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="text-[11px] text-muted-foreground mt-1.5">
              All tests passing records as Pass. Mixed results record as Partial. None passing record as Fail.
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the next tech should know."
              rows={3}
              className="mt-1 w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm"
              data-testid="commission-notes"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center h-8 px-3 rounded-md text-[12px] text-muted-foreground hover:text-foreground border border-border"
          >Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
            data-testid="commission-submit"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {busy ? 'Saving…' : `Save · ${meta.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
