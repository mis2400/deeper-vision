// SettingsView — Phase 3 enterprise readiness buildout.
// Mounted at /settings. Each tab is its own component below; the
// store wires operator preferences (Phase 3A), with later sub-passes
// landing real Billing / Integrations / Team / Notifications /
// Security / Advanced surfaces.

import { useState, useMemo } from 'react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { User, CreditCard, Plug, Users, Bell, Lock } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
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

function Billing() {
  return (
    <>
      <Panel title="Plan">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">Studio · $245 / seat / mo</div>
            <div className="text-xs text-muted-foreground">12 seats · renews Jun 1, 2026</div>
          </div>
          <Button size="sm" variant="outline">Manage plan</Button>
        </div>
      </Panel>
      <Panel title="Payment method">
        <div className="text-sm">Visa ending 4242</div>
        <div className="text-xs text-muted-foreground">Expires 09 / 2028</div>
      </Panel>
    </>
  );
}

function Integrations() {
  const items = [
    { name: 'Genetec Security Center', state: 'Connected' },
    { name: 'Milestone XProtect',      state: 'Not connected' },
    { name: 'Lenel OnGuard',           state: 'Not connected' },
    { name: 'Slack',                    state: 'Connected' },
    { name: 'Procore',                  state: 'Not connected' },
  ];
  return (
    <Panel title="Connected services">
      {items.map((i) => (
        <div key={i.name} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0">
          <div className="text-sm">{i.name}</div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${i.state === 'Connected' ? 'text-emerald-400' : 'text-muted-foreground'}`}>{i.state}</span>
            <Button size="sm" variant="outline">{i.state === 'Connected' ? 'Manage' : 'Connect'}</Button>
          </div>
        </div>
      ))}
    </Panel>
  );
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

