// SettingsView — Phase 3 enterprise readiness buildout.
// Mounted at /settings. Each tab is its own component below; the
// store wires operator preferences (Phase 3A), with later sub-passes
// landing real Billing / Integrations / Team / Notifications /
// Security / Advanced surfaces.

import { useState, useMemo } from 'react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { User, CreditCard, Plug, Users, Bell, Lock, Check, FileDown, Trash2, RefreshCw, Search } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type { PlanTier, BillingCycle, Invoice, PaymentMethod, IntegrationId } from '../store/types';
import { toast } from 'sonner';

type Section = 'account' | 'billing' | 'integrations' | 'team' | 'notifications' | 'security';

// Honesty contract: only nav entries that route to a real surface
// render. The Advanced tab lands in 3G; until then the entry is
// not shown at all (no "Coming soon" tile).
const NAV: Array<{ id: Section; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'account',       label: 'Account',       icon: User },
  { id: 'billing',       label: 'Billing',       icon: CreditCard },
  { id: 'integrations',  label: 'Integrations',  icon: Plug },
  { id: 'team',          label: 'Team',          icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security',      label: 'Security',      icon: Lock },
];

export function SettingsView() {
  const [sec, setSec] = useState<Section>('account');

  return (
    <AppShell crumbs={[{ label: 'Settings' }]} title="Settings" subtitle="Operator preferences, billing, integrations, team, security">
      <div className="max-w-[1100px] mx-auto px-6 py-6 grid grid-cols-[220px_1fr] gap-4">
        <nav className="bg-card border border-border rounded-lg p-2 h-fit">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = sec === n.id;
            return (
              <button key={n.id} onClick={() => setSec(n.id)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded text-sm ${active ? 'bg-secondary' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
                <Icon className="w-3.5 h-3.5" />
                {n.label}
              </button>
            );
          })}
        </nav>

        <div className="space-y-4">
          {sec === 'account' && <Account />}
          {sec === 'billing' && <Billing />}
          {sec === 'integrations' && <Integrations />}
          {sec === 'team' && <Team />}
          {sec === 'notifications' && <Notifications />}
          {sec === 'security' && <Security />}
        </div>
      </div>
    </AppShell>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <div className="text-sm font-medium">{title}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
      <div className="p-4 space-y-4" style={{ paddingBlock: 'calc(1rem * var(--density-y, 1))' }}>{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-center gap-3" style={{ paddingBlock: 'calc(0.25rem * var(--density-y, 1))' }}>
      <label className="text-sm text-muted-foreground">
        {label}
        {hint && <div className="text-[10px] text-muted-foreground/70 mt-0.5 font-normal">{hint}</div>}
      </label>
      {children}
    </div>
  );
}

const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className="bg-input-background border border-input-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
);

const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className="bg-input-background border border-input-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
);

// ─────────────────────────── Account (Phase 3A) ────────────────────

function Account() {
  const userPrefs    = useProjectStore((s) => s.userPrefs);
  const setUserPrefs = useProjectStore((s) => s.setUserPrefs);
  const canvasTheme  = useProjectStore((s) => s.canvasTheme);
  const setCanvasTheme = useProjectStore((s) => s.setCanvasTheme);

  // Local mirror so profile fields aren't writing on every keystroke.
  // Phase 3A: the store updates on Save, not on input.
  const [fullName, setFullName] = useState(userPrefs.fullName ?? '');
  const [email,    setEmail]    = useState(userPrefs.email ?? '');
  const [jobTitle, setJobTitle] = useState(userPrefs.jobTitle ?? '');

  const onSaveProfile = () => {
    setUserPrefs({
      fullName: fullName.trim() || undefined,
      email: email.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
    });
    toast.success('Profile saved.');
  };

  // V1 3A — A small curated accent list. Operator can clear back to
  // the theme default. Free-form hex input is a follow-up; presets
  // cover the integrator brand colors we've seen in the wild.
  const ACCENTS: Array<{ id: string | undefined; label: string; color: string }> = [
    { id: undefined,   label: 'Theme default', color: 'var(--primary)' },
    { id: '#2D6FB8',   label: 'Blueprint',      color: '#2D6FB8' },
    { id: '#7C3AED',   label: 'Violet',         color: '#7C3AED' },
    { id: '#0F766E',   label: 'Teal',           color: '#0F766E' },
    { id: '#C2410C',   label: 'Brick',          color: '#C2410C' },
    { id: '#1E40AF',   label: 'Deep blue',      color: '#1E40AF' },
    { id: '#15803D',   label: 'Forest',         color: '#15803D' },
  ];

  // Time zones — a sensible operator-friendly subset. Real product
  // ships the full IANA list; this is the shipping subset for V1.
  const TIMEZONES = [
    'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
    'America/Phoenix', 'America/Anchorage', 'America/Honolulu',
    'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Amsterdam',
    'Asia/Tokyo', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Dubai', 'Asia/Kolkata',
    'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
    'UTC',
  ];

  // Languages — V1 ships a small set that maps to operator regions.
  const LANGUAGES: Array<{ value: string; label: string }> = [
    { value: 'en-US',  label: 'English (United States)' },
    { value: 'en-GB',  label: 'English (United Kingdom)' },
    { value: 'es-ES',  label: 'Español' },
    { value: 'fr-FR',  label: 'Français' },
    { value: 'de-DE',  label: 'Deutsch' },
    { value: 'pt-BR',  label: 'Português (Brasil)' },
    { value: 'ja-JP',  label: '日本語' },
    { value: 'zh-Hans', label: '简体中文' },
  ];

  return (
    <>
      <Panel title="Profile">
        <Field label="Full name"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="How your name appears in the app" /></Field>
        <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
        <Field label="Job title" hint="Shown next to comments and applied actions."><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Project lead" /></Field>
        <div className="pt-2 flex justify-end"><Button size="sm" onClick={onSaveProfile}>Save profile</Button></div>
      </Panel>

      <Panel title="Appearance" subtitle="Theme, density, and accent. Changes apply immediately and persist across sessions.">
        <Field label="Theme">
          <div className="inline-flex rounded-md border border-border bg-background overflow-hidden text-[12px]" role="radiogroup" aria-label="Theme">
            {(['light', 'slate', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setCanvasTheme(t)}
                role="radio"
                aria-checked={canvasTheme === t}
                className={`px-3 py-1.5 capitalize transition-colors ${canvasTheme === t ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/40 text-muted-foreground'}`}
                data-testid={`settings-theme-${t}`}
              >
                {t === 'light' ? 'Light drafting' : t === 'slate' ? 'Slate engineering' : 'Dark command'}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Density" hint="Compact tightens vertical rhythm in opted-in surfaces.">
          <div className="inline-flex rounded-md border border-border bg-background overflow-hidden text-[12px]" role="radiogroup" aria-label="Density">
            {(['comfortable', 'compact'] as const).map((d) => (
              <button
                key={d}
                onClick={() => { setUserPrefs({ density: d }); toast.success(`Density set to ${d}.`, { duration: 2000 }); }}
                role="radio"
                aria-checked={userPrefs.density === d}
                className={`px-3 py-1.5 capitalize transition-colors ${userPrefs.density === d ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/40 text-muted-foreground'}`}
                data-testid={`settings-density-${d}`}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Accent color" hint="Overrides the theme's primary tint. Use your integrator brand color.">
          <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="Accent">
            {ACCENTS.map((a) => {
              const active = (userPrefs.accent ?? null) === (a.id ?? null);
              return (
                <button
                  key={a.label}
                  onClick={() => { setUserPrefs({ accent: a.id }); toast.success(`Accent set to ${a.label.toLowerCase()}.`, { duration: 2000 }); }}
                  role="radio"
                  aria-checked={active}
                  title={a.label}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${active ? 'border-foreground scale-110' : 'border-border hover:scale-105'}`}
                  style={{ background: a.color }}
                  data-testid={`settings-accent-${a.id ?? 'default'}`}
                />
              );
            })}
          </div>
        </Field>
      </Panel>

      <Panel title="Language and time zone" subtitle="Used for dates, times, and any localized strings. Defaults to your browser on first read.">
        <Field label="Language">
          <Select
            value={userPrefs.language}
            onChange={(e) => { setUserPrefs({ language: e.target.value }); toast.success('Language updated.', { duration: 2000 }); }}
            data-testid="settings-language"
          >
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            {/* When the browser language isn't in the curated list, surface it as a passthrough so the operator sees their actual setting. */}
            {!LANGUAGES.some((l) => l.value === userPrefs.language) && (
              <option value={userPrefs.language}>{userPrefs.language} (browser default)</option>
            )}
          </Select>
        </Field>
        <Field label="Time zone">
          <Select
            value={userPrefs.timeZone}
            onChange={(e) => { setUserPrefs({ timeZone: e.target.value }); toast.success(`Time zone set to ${e.target.value}.`, { duration: 2000 }); }}
            data-testid="settings-timezone"
          >
            {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            {!TIMEZONES.includes(userPrefs.timeZone) && (
              <option value={userPrefs.timeZone}>{userPrefs.timeZone} (system)</option>
            )}
          </Select>
        </Field>
        <Field label="Preview">
          <div className="text-[12px] text-muted-foreground">
            {useMemo(() => {
              try {
                return new Intl.DateTimeFormat(userPrefs.language, {
                  dateStyle: 'full',
                  timeStyle: 'short',
                  timeZone: userPrefs.timeZone,
                }).format(new Date());
              } catch {
                return 'Browser cannot format with this combination.';
              }
            }, [userPrefs.language, userPrefs.timeZone])}
          </div>
        </Field>
      </Panel>
    </>
  );
}

// ─────────────────────────── Other tabs (Phase 3B-3G land later) ───

// ─────────────────────────── Billing (Phase 3B) ────────────────────

interface PlanDef {
  id: PlanTier;
  name: string;
  monthlyPerSeat: number;
  /** Annual price per seat — equivalent monthly for the savings calc. */
  annualPerSeat: number;
  /** Seats included for the price quoted (additional are at the same rate). */
  description: string;
  features: string[];
  budget: { projects: number; seats: number; storageGb: number };
}

const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPerSeat: 95,
    annualPerSeat: 75,
    description: 'For an integrator running fewer than 25 active projects.',
    features: ['Up to 25 projects', '5 seats included', '20 GB shared storage', 'Email support'],
    budget: { projects: 25, seats: 5, storageGb: 20 },
  },
  {
    id: 'studio',
    name: 'Studio',
    monthlyPerSeat: 245,
    annualPerSeat: 195,
    description: 'For active design teams running parallel projects.',
    features: ['Up to 200 projects', '12 seats included', '250 GB shared storage', 'Priority support', 'Brand accent + portal links'],
    budget: { projects: 200, seats: 12, storageGb: 250 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPerSeat: 0,
    annualPerSeat: 0,
    description: 'Custom pricing. SSO, SCIM, custom roles, audit log export.',
    features: ['Unlimited projects', 'Unlimited seats', '5 TB shared storage', 'SAML SSO + SCIM', 'Custom roles', 'White-label exports'],
    budget: { projects: Infinity, seats: Infinity, storageGb: 5_000 },
  },
];

function planDef(id: PlanTier): PlanDef {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

function priceFor(plan: PlanDef, cycle: BillingCycle): number | null {
  if (plan.monthlyPerSeat === 0) return null;
  return cycle === 'monthly' ? plan.monthlyPerSeat : plan.annualPerSeat;
}

function annualSavingsPct(plan: PlanDef): number {
  if (plan.monthlyPerSeat === 0) return 0;
  const monthlyTotal = plan.monthlyPerSeat * 12;
  const annualTotal  = plan.annualPerSeat * 12;
  return Math.round(((monthlyTotal - annualTotal) / monthlyTotal) * 100);
}

function Billing() {
  const billing = useProjectStore((s) => s.billing);
  const setBilling = useProjectStore((s) => s.setBilling);
  const setPaymentMethod = useProjectStore((s) => s.setPaymentMethod);
  const addInvoice = useProjectStore((s) => s.addInvoice);

  // Real usage meters — computed from actual store data.
  const projectsCount = useProjectStore((s) => Object.keys(s.projects).length);
  const seatsCount    = 1 + Object.keys(useProjectStore((s) => s.contacts)).length; // operator + contacts as a stand-in for invited seats
  const storageUsedMb = useProjectStore((s) => Object.values(s.attachments).reduce((acc, a) => acc + ((a as any).sizeKb ?? 0), 0)) / 1024;

  const plan = planDef(billing.plan);
  const monthlyOrAnnual = priceFor(plan, billing.cycle);
  const seatTotal = monthlyOrAnnual != null ? monthlyOrAnnual * billing.seats : null;

  const onSwitchPlan = (id: PlanTier) => {
    setBilling({ plan: id });
    toast.success(`Plan switched to ${planDef(id).name}.`, { duration: 3000 });
  };
  const onSwitchCycle = (cycle: BillingCycle) => {
    setBilling({ cycle });
    toast.success(`Billing cycle: ${cycle}.`, { duration: 2500 });
  };
  const onGenerateInvoice = () => {
    const now = Date.now();
    const periodEnd = now;
    const periodStart = now - 30 * 86_400_000;
    const inv: Invoice = {
      id: `inv-${now.toString(36)}`,
      number: `INV-${new Date(now).getFullYear()}-${String(billing.invoices.length + 1).padStart(3, '0')}`,
      amount: seatTotal ?? 0,
      currency: 'USD',
      status: 'paid',
      periodStart,
      periodEnd,
      issuedAt: now,
      paidAt: now,
    };
    addInvoice(inv);
    toast.success(`Generated ${inv.number}.`, { duration: 2500 });
  };

  return (
    <>
      <Panel title="Current plan" subtitle="Usage meters are computed live from your project state.">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-base font-medium">{plan.name}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">{plan.description}</div>
            {seatTotal != null ? (
              <div className="text-[12px] text-muted-foreground mt-2 tabular-nums">
                ${monthlyOrAnnual}/seat · {billing.seats} seats · <span className="text-foreground">${seatTotal.toLocaleString()} / {billing.cycle === 'monthly' ? 'mo' : 'mo equivalent, billed annually'}</span>
              </div>
            ) : (
              <div className="text-[12px] text-muted-foreground mt-2">Enterprise pricing — talk to sales for a quote.</div>
            )}
            <div className="text-[11px] text-muted-foreground mt-1">
              Renews {new Date(billing.renewsAt).toLocaleDateString()}.
            </div>
          </div>
          {/* Annual / monthly toggle with explicit savings indicator on annual. */}
          <div className="inline-flex rounded-md border border-border bg-background overflow-hidden text-[12px]">
            {(['monthly', 'annual'] as const).map((c) => (
              <button
                key={c}
                onClick={() => onSwitchCycle(c)}
                className={`px-3 py-1.5 capitalize transition-colors ${billing.cycle === c ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/40 text-muted-foreground'}`}
                data-testid={`billing-cycle-${c}`}
              >
                {c}{c === 'annual' && annualSavingsPct(plan) > 0 ? ` · save ${annualSavingsPct(plan)}%` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Usage meters — real numbers from the store. */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <UsageMeter label="Projects"  used={projectsCount}  budget={plan.budget.projects} format={(n) => n === Infinity ? '∞' : `${n}`} />
          <UsageMeter label="Seats"     used={seatsCount}     budget={plan.budget.seats}    format={(n) => n === Infinity ? '∞' : `${n}`} />
          <UsageMeter label="Storage"   used={storageUsedMb / 1024} budget={plan.budget.storageGb} format={(n) => `${n.toFixed(1)} GB`} />
        </div>
      </Panel>

      <Panel title="Switch plan" subtitle="Plan changes apply immediately. Pro-rating lands with the billing backend.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PLANS.map((p) => {
            const isCurrent = p.id === billing.plan;
            const price = priceFor(p, billing.cycle);
            return (
              <div
                key={p.id}
                className={`relative rounded-lg border p-3 transition-colors ${isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                data-testid={`billing-plan-${p.id}`}
              >
                {isCurrent && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] text-primary">
                    <Check className="w-3 h-3" />Current
                  </span>
                )}
                <div className="text-[13px] font-medium">{p.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{p.description}</div>
                <div className="text-[14px] font-medium tabular-nums mt-2">
                  {price == null ? 'Custom' : `$${price}`}
                  {price != null && <span className="text-[11px] text-muted-foreground"> / seat / mo</span>}
                </div>
                <ul className="text-[11.5px] text-muted-foreground space-y-1 mt-3 mb-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check className="w-3 h-3 mt-0.5 text-emerald-500 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => onSwitchPlan(p.id)}>
                    {p.id === 'enterprise' ? 'Talk to sales' : 'Switch'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <PaymentMethodPanel current={billing.paymentMethod} onSave={setPaymentMethod} />

      <Panel title="Invoice history" subtitle="Past invoices download as PDFs. The render is generated locally — no third party sees the data.">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[12px] text-muted-foreground">{billing.invoices.length} invoice{billing.invoices.length === 1 ? '' : 's'} on file.</div>
          <Button size="sm" variant="outline" onClick={onGenerateInvoice}>Generate this period's invoice</Button>
        </div>
        {billing.invoices.length === 0 ? (
          <div className="text-[12px] text-muted-foreground text-center py-6 border border-dashed border-border rounded-md">
            No invoices yet. Generate one above to see how the PDF lays out.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {billing.invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-1.5 px-2 rounded border border-border bg-background">
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium tabular-nums">{inv.number}</div>
                  <div className="text-[10.5px] text-muted-foreground">
                    {new Date(inv.periodStart).toLocaleDateString()} → {new Date(inv.periodEnd).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[12px] font-medium tabular-nums">${inv.amount.toLocaleString()}</span>
                  <span className={`text-[10px] uppercase tracking-[0.10em] ${inv.status === 'paid' ? 'text-emerald-600' : inv.status === 'open' ? 'text-amber-600' : 'text-rose-600'}`}>{inv.status}</span>
                  <Button size="sm" variant="ghost" onClick={() => exportInvoicePdf(inv, plan, billing.seats)} data-testid={`invoice-pdf-${inv.id}`}>
                    <FileDown className="w-3.5 h-3.5 mr-1" />PDF
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function UsageMeter({ label, used, budget, format }: { label: string; used: number; budget: number; format: (n: number) => string }) {
  const pct = budget === Infinity ? 0 : Math.min(100, Math.round((used / budget) * 100));
  const over = budget !== Infinity && used > budget;
  const tone = over ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-primary';
  return (
    <div className="rounded-md border border-border bg-background p-2.5">
      <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground">{label}</div>
      <div className="text-[14px] font-medium tabular-nums mt-1">
        {format(used)} <span className="text-[11px] text-muted-foreground">/ {format(budget)}</span>
      </div>
      <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden mt-1.5">
        <div className={`h-full ${tone} transition-all`} style={{ width: budget === Infinity ? '4%' : `${pct}%` }} />
      </div>
    </div>
  );
}

function PaymentMethodPanel({ current, onSave }: { current?: PaymentMethod; onSave: (pm: PaymentMethod | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [number, setNumber] = useState('');
  const [exp, setExp]       = useState(''); // MM/YY
  const [cvc, setCvc]       = useState('');

  const cardBrand = detectBrand(number);
  const numberValid = luhn(number.replace(/\s+/g, '')) && number.replace(/\s+/g, '').length >= 13;
  const expValid    = /^\d{2}\s*\/\s*\d{2}$/.test(exp);
  const cvcValid    = /^\d{3,4}$/.test(cvc);
  const canSave = numberValid && expValid && cvcValid;

  const onSubmit = () => {
    if (!canSave) return;
    const last4 = number.replace(/\s+/g, '').slice(-4);
    const [mm, yy] = exp.split('/').map((s) => Number(s.trim()));
    onSave({
      brand: cardBrand,
      last4,
      expMonth: mm,
      expYear: 2000 + yy,
      savedAt: Date.now(),
    });
    setEditing(false);
    setNumber(''); setExp(''); setCvc('');
    toast.success('Payment method saved locally. Real charges land with the billing backend.');
  };

  return (
    <Panel title="Payment method" subtitle="Card metadata persists locally. Card details are never sent to any server until the billing backend ships.">
      {!current && !editing && (
        <div className="text-[12px] text-muted-foreground">No payment method on file yet.
          <Button size="sm" className="ml-2" onClick={() => setEditing(true)}>Add a card</Button>
        </div>
      )}
      {current && !editing && (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm capitalize">{current.brand} ending {current.last4}</div>
            <div className="text-[11px] text-muted-foreground">Expires {String(current.expMonth).padStart(2, '0')} / {current.expYear}</div>
            <div className="text-[10px] text-muted-foreground/80 mt-0.5">Saved {new Date(current.savedAt).toLocaleDateString()}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Replace</Button>
            <Button size="sm" variant="ghost" onClick={() => { onSave(null); toast.message('Payment method removed.'); }} title="Remove the card">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
      {editing && (
        <div className="space-y-3">
          <Field label="Card number">
            <Input value={number} onChange={(e) => setNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" inputMode="numeric" maxLength={23} />
          </Field>
          <Field label="Expiry (MM/YY)">
            <Input value={exp} onChange={(e) => setExp(formatExpiry(e.target.value))} placeholder="MM/YY" inputMode="numeric" maxLength={5} />
          </Field>
          <Field label="CVC">
            <Input value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" inputMode="numeric" maxLength={4} />
          </Field>
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setNumber(''); setExp(''); setCvc(''); }}>Cancel</Button>
            <Button size="sm" disabled={!canSave} onClick={onSubmit}>Save card</Button>
          </div>
          {!canSave && number.length > 0 && (
            <div className="text-[10.5px] text-amber-600">
              {!numberValid ? 'Card number fails the Luhn check.' : !expValid ? 'Expiry must be MM/YY.' : 'CVC must be 3 or 4 digits.'}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function detectBrand(num: string): PaymentMethod['brand'] {
  const d = num.replace(/\s+/g, '');
  if (/^4/.test(d))                 return 'visa';
  if (/^5[1-5]/.test(d))            return 'mastercard';
  if (/^3[47]/.test(d))             return 'amex';
  if (/^6(?:011|5)/.test(d))        return 'discover';
  return 'unknown';
}
function formatCardNumber(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 19);
  return d.replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}
function luhn(num: string): boolean {
  if (!/^\d+$/.test(num)) return false;
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

async function exportInvoicePdf(inv: Invoice, plan: PlanDef, seats: number) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = 612, H = 792;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Invoice', 40, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(inv.number, 40, 72);
  doc.setTextColor(15, 23, 42);
  let y = 130;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Billed to', 40, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text('Operator workspace', 40, y + 14);
  doc.text(`Period: ${new Date(inv.periodStart).toLocaleDateString()} → ${new Date(inv.periodEnd).toLocaleDateString()}`, 40, y + 28);
  doc.text(`Issued: ${new Date(inv.issuedAt).toLocaleDateString()}`, 40, y + 42);
  y += 80;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Line items', 40, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  const lineDesc = `${plan.name} plan · ${seats} seats`;
  doc.text(lineDesc, 40, y);
  doc.text(`$${inv.amount.toLocaleString()}`, W - 80, y, { align: 'right' });
  y += 30;
  doc.setDrawColor(229, 231, 235);
  doc.line(40, y, W - 40, y);
  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Total', 40, y);
  doc.text(`$${inv.amount.toLocaleString()} ${inv.currency}`, W - 80, y, { align: 'right' });
  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`Status: ${inv.status}${inv.paidAt ? ` · paid ${new Date(inv.paidAt).toLocaleDateString()}` : ''}`, 40, y);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`DeeperVision · Generated ${new Date().toISOString().slice(0, 10)}`, 40, H - 30);
  doc.save(`${inv.number}.pdf`);
}

// ─────────────────────────── Integrations (Phase 3C) ──────────────

type IntegrationCategory = 'accounting' | 'crm' | 'field' | 'communications' | 'vms' | 'access' | 'pricing';

interface IntegrationDef {
  id: IntegrationId;
  name: string;
  category: IntegrationCategory;
  short: string;
  vendor: string;
  /** Initials shown in the logo tile (we don't ship third-party
   *  trademarks as bitmap logos). */
  initials: string;
  /** Tile background — neutral pastel so the card grid has rhythm. */
  tone: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  // Accounting & finance
  { id: 'quickbooks',   name: 'QuickBooks Online', category: 'accounting',     vendor: 'Intuit',           short: 'Push invoices + sync customers.',                    initials: 'QB', tone: '#0F766E' },
  { id: 'netsuite',     name: 'NetSuite',          category: 'accounting',     vendor: 'Oracle',           short: 'ERP-grade billing + revenue recognition.',           initials: 'NS', tone: '#374151' },
  { id: 'stripe-pay',   name: 'Stripe Payments',   category: 'accounting',     vendor: 'Stripe',           short: 'Charge cards + ACH against signed proposals.',       initials: 'St', tone: '#7C3AED' },
  // CRM + sales
  { id: 'hubspot',      name: 'HubSpot',           category: 'crm',            vendor: 'HubSpot',          short: 'Pipeline + opportunities + contact sync.',           initials: 'HS', tone: '#EA580C' },
  { id: 'salesforce',   name: 'Salesforce',        category: 'crm',            vendor: 'Salesforce',       short: 'Opportunity → project handoff + activity log.',       initials: 'SF', tone: '#0EA5E9' },
  // Field service
  { id: 'servicetitan', name: 'ServiceTitan',      category: 'field',          vendor: 'ServiceTitan',     short: 'Field dispatch + work order parity.',                initials: 'ST', tone: '#0369A1' },
  // Communications
  { id: 'slack',        name: 'Slack',             category: 'communications', vendor: 'Salesforce',       short: 'Threaded notifications + commands.',                 initials: 'Sk', tone: '#7C3AED' },
  { id: 'msteams',      name: 'Microsoft Teams',   category: 'communications', vendor: 'Microsoft',        short: 'Channel notifications + meeting links on activity.', initials: 'MT', tone: '#5B6BC0' },
  { id: 'google-workspace', name: 'Google Workspace', category: 'communications', vendor: 'Google',         short: 'Calendar + Drive attachments on projects.',          initials: 'GW', tone: '#15803D' },
  // VMS
  { id: 'verkada',      name: 'Verkada Command',   category: 'vms',            vendor: 'Verkada',          short: 'Push designs into Command; sync device inventory.',  initials: 'Vk', tone: '#DC2626' },
  { id: 'axis',         name: 'Axis Camera Station', category: 'vms',          vendor: 'Axis',             short: 'Read live device state + push commissioning data.',   initials: 'Ax', tone: '#1F2937' },
  { id: 'genetec',      name: 'Genetec Security Center', category: 'vms',      vendor: 'Genetec',          short: 'Bidirectional sync with the security platform.',     initials: 'Gn', tone: '#0F172A' },
  { id: 'milestone',    name: 'Milestone XProtect', category: 'vms',           vendor: 'Milestone',        short: 'Push placements; read recording state per camera.',  initials: 'Ms', tone: '#1E40AF' },
  // Internal pricing engine (sibling repo)
  { id: 'quote-engine', name: 'Quote Engine',      category: 'pricing',        vendor: 'Access Tech',      short: 'Pull pricing for the Estimator + Proposal builder.', initials: 'Qe', tone: '#2D6FB8' },
];

const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  accounting:     'Accounting',
  crm:            'CRM',
  field:          'Field service',
  communications: 'Communications',
  vms:            'VMS',
  access:         'Access control',
  pricing:        'Pricing',
};

function Integrations() {
  const integrations = useProjectStore((s) => s.integrations);
  const setStatus = useProjectStore((s) => s.setIntegrationStatus);
  const recordSync = useProjectStore((s) => s.recordIntegrationSync);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | IntegrationCategory>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INTEGRATIONS.filter((i) => {
      if (category !== 'all' && i.category !== category) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q) || i.vendor.toLowerCase().includes(q) || i.short.toLowerCase().includes(q);
    });
  }, [query, category]);

  const connectedCount = Object.values(integrations).filter((r) => r.status === 'connected').length;

  const onToggle = (def: IntegrationDef) => {
    const cur = integrations[def.id];
    if (cur?.status === 'connected') {
      setStatus(def.id, 'available');
      toast.message(`${def.name} disconnected.`, { duration: 2500 });
    } else {
      setStatus(def.id, 'connected');
      toast.success(`${def.name} connection saved locally. Real OAuth lands with backend.`, { duration: 3500 });
    }
  };
  const onSync = (def: IntegrationDef) => {
    recordSync(def.id);
    toast.success(`${def.name} synced.`, { duration: 2000 });
  };

  return (
    <>
      <Panel title="Marketplace" subtitle={`${INTEGRATIONS.length} connectors. ${connectedCount} active. Connections persist locally; real OAuth handshakes land with each integration's backend wiring.`}>
        {/* Filters: search + category chips */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search connectors"
              className="w-full bg-input-background border border-input-border rounded-md pl-8 pr-3 py-1.5 text-[12.5px] focus:outline-none focus:border-primary"
              data-testid="integrations-search"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(['all', ...Object.keys(CATEGORY_LABEL)] as Array<'all' | IntegrationCategory>).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`text-[11px] px-2 py-1 rounded transition-colors ${category === c ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                data-testid={`integrations-cat-${c}`}
              >
                {c === 'all' ? 'All' : CATEGORY_LABEL[c as IntegrationCategory]}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[12px] text-muted-foreground border border-dashed border-border rounded-md">
            No connectors match the filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((def) => {
              const rec = integrations[def.id];
              const connected = rec?.status === 'connected';
              return (
                <div
                  key={def.id}
                  className={`rounded-lg border p-3 transition-colors ${connected ? 'border-primary/40 bg-primary/5' : 'border-border bg-background'}`}
                  data-testid={`integration-${def.id}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center text-white font-semibold shrink-0"
                      style={{ background: def.tone }}
                      aria-hidden
                    >
                      {def.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium truncate">{def.name}</span>
                        {connected && (
                          <span className="text-[10px] uppercase tracking-[0.10em] text-emerald-600 inline-flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Connected
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground">{def.vendor} · {CATEGORY_LABEL[def.category]}</div>
                    </div>
                  </div>
                  <div className="text-[11.5px] text-muted-foreground mt-2 leading-snug">{def.short}</div>
                  <div className="flex items-center justify-between mt-3 gap-2">
                    {connected ? (
                      <>
                        <div className="text-[10.5px] text-muted-foreground">
                          {rec?.lastSyncAt ? `Synced ${formatAgo(rec.lastSyncAt)}` : `Connected ${formatAgo(rec?.connectedAt ?? Date.now())}`}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => onSync(def)} title="Record a sync stamp"><RefreshCw className="w-3 h-3" /></Button>
                          <Button size="sm" variant="outline" onClick={() => onToggle(def)}>Disconnect</Button>
                        </div>
                      </>
                    ) : (
                      <Button size="sm" className="ml-auto" onClick={() => onToggle(def)} data-testid={`integration-${def.id}-connect`}>Connect</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}

function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

function Team() {
  const team = [
    { n: 'Casey Park',  e: 'casey@deepervision.com',  r: 'Owner' },
    { n: 'Mei Lin',     e: 'mei@deepervision.com',    r: 'Engineer' },
    { n: 'Diego Reyes', e: 'diego@deepervision.com',  r: 'Technician' },
    { n: 'Jordan Kim',  e: 'jordan@deepervision.com', r: 'Network' },
  ];
  return (
    <Panel title="Members">
      {team.map((m) => (
        <div key={m.e} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0">
          <div>
            <div className="text-sm">{m.n}</div>
            <div className="text-xs text-muted-foreground">{m.e}</div>
          </div>
          <span className="text-xs text-muted-foreground">{m.r}</span>
        </div>
      ))}
      <Button size="sm" className="mt-2">Invite teammate</Button>
    </Panel>
  );
}

function Notifications() {
  const rows = [
    'Threat simulation findings',
    'Change orders awaiting approval',
    'Commissioning failures',
    'Weekly project digest',
  ];
  return (
    <Panel title="Email me about">
      {rows.map((r, i) => (
        <label key={r} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0">
          <span className="text-sm">{r}</span>
          <input type="checkbox" defaultChecked={i < 3} className="accent-primary" />
        </label>
      ))}
    </Panel>
  );
}

function Security() {
  return (
    <>
      <Panel title="Two factor authentication"><Button size="sm">Enable 2FA</Button></Panel>
      <Panel title="Active sessions">
        <div className="text-sm">MacBook Pro · Chrome · San Francisco</div>
        <div className="text-xs text-muted-foreground">Last active 2 minutes ago</div>
      </Panel>
    </>
  );
}

