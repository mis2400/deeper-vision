import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { User, CreditCard, Plug, Users, Bell, Lock } from 'lucide-react';

type Section = 'account' | 'billing' | 'integrations' | 'team' | 'notifications' | 'security';

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
    <AppShell crumbs={[{ label: 'Settings' }]} title="Settings" subtitle="Account, team, billing, and integrations">
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border text-sm font-medium">{title}</div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-center gap-3">
      <label className="text-sm text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className="bg-input-background border border-input-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
);

function Account() {
  return (
    <Panel title="Profile">
      <Field label="Full name"><Input defaultValue="Casey Park" /></Field>
      <Field label="Email"><Input defaultValue="casey@deepervision.com" /></Field>
      <Field label="Role"><Input defaultValue="Project lead" /></Field>
      <Field label="Time zone">
        <select className="bg-input-background border border-input-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary">
          <option>America/Los_Angeles</option><option>America/New_York</option><option>Europe/London</option>
        </select>
      </Field>
      <div className="pt-2 flex justify-end"><Button size="sm">Save</Button></div>
    </Panel>
  );
}

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
      <Panel title="Two-factor authentication"><Button size="sm">Enable 2FA</Button></Panel>
      <Panel title="Active sessions">
        <div className="text-sm">MacBook Pro · Chrome · San Francisco</div>
        <div className="text-xs text-muted-foreground">Last active 2 minutes ago</div>
      </Panel>
    </>
  );
}
