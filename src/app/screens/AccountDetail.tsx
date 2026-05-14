// Account command center — /account/:customerId
//
// Mirror of /project/:id but scoped to the customer (account). Shows every
// contact, opportunity, project, touch, and task tied to one account. This
// is where a sales rep lives between deals — everything about a single
// customer in one view.

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import {
  Building2, Mail, Phone, Globe, MapPin, Plus, ChevronRight, ArrowRight,
  Users, DollarSign, Briefcase, Activity as ActivityIcon, CheckCircle2,
  Star, Calendar, Clock,
} from 'lucide-react';
import { useProjectStore, STAGE_PROBABILITY } from '../store/projectStore';
import { PHASES } from '../lifecycle/phases';
import type {
  Contact, Opportunity, Project, Touch, Task, OpportunityStage,
} from '../store/types';

type Tab = 'contacts' | 'opportunities' | 'projects' | 'activity' | 'tasks';

const STAGE_TONE: Record<OpportunityStage, string> = {
  inquiry:     'text-slate-300 border-slate-600/60',
  qualified:   'text-blue-300 border-blue-500/40',
  discovery:   'text-cyan-300 border-cyan-500/40',
  proposing:   'text-violet-300 border-violet-500/40',
  negotiating: 'text-amber-300 border-amber-500/40',
  won:         'text-emerald-300 border-emerald-500/40',
  lost:        'text-rose-300 border-rose-500/40',
  on_hold:     'text-zinc-300 border-zinc-500/40',
};

const STAGE_LABEL: Record<OpportunityStage, string> = {
  inquiry: 'Inquiry', qualified: 'Qualified', discovery: 'Discovery',
  proposing: 'Proposing', negotiating: 'Negotiating', won: 'Won', lost: 'Lost', on_hold: 'On hold',
};

const ROLE_LABEL: Record<string, string> = {
  decision_maker: 'Decision maker', champion: 'Champion', technical: 'Technical',
  finance: 'Finance', security: 'Security', facilities: 'Facilities',
  operations: 'Operations', other: 'Other',
};

export function AccountDetail() {
  const { customerId = 'c1' } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('opportunities');

  // Subscribe to raw maps; derive in useMemo.
  const customersMap     = useProjectStore((s) => s.customers);
  const contactsMap      = useProjectStore((s) => s.contacts);
  const opportunitiesMap = useProjectStore((s) => s.opportunities);
  const projectsMap      = useProjectStore((s) => s.projects);
  const touchesMap       = useProjectStore((s) => s.touches);
  const tasksMap         = useProjectStore((s) => s.tasks);
  const activityMap      = useProjectStore((s) => s.activity);

  const setOppStage   = useProjectStore((s) => s.setOpportunityStage);
  const convertOpp    = useProjectStore((s) => s.convertOpportunityToProject);
  const completeTask  = useProjectStore((s) => s.completeTask);

  const customer = customersMap[customerId];

  const contacts: Contact[] = useMemo(
    () => Object.values(contactsMap).filter((c) => c.customerId === customerId),
    [contactsMap, customerId],
  );
  const opportunities: Opportunity[] = useMemo(
    () => Object.values(opportunitiesMap)
      .filter((o) => o.customerId === customerId)
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [opportunitiesMap, customerId],
  );
  const projects: Project[] = useMemo(
    () => Object.values(projectsMap)
      .filter((p) => p.customerId === customerId)
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [projectsMap, customerId],
  );
  const touches: Touch[] = useMemo(
    () => Object.values(touchesMap)
      .filter((t) => t.customerId === customerId)
      .sort((a, b) => b.occurredAt - a.occurredAt),
    [touchesMap, customerId],
  );
  const tasks: Task[] = useMemo(
    () => Object.values(tasksMap)
      .filter((t) => t.customerId === customerId)
      .sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (b.status === 'done' && a.status !== 'done') return -1;
        return (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity);
      }),
    [tasksMap, customerId],
  );

  // Activity scoped to customer: explicitly tagged + activities on this
  // customer's projects.
  const activity = useMemo(() => {
    const projectIds = new Set(projects.map((p) => p.id));
    return Object.values(activityMap)
      .filter((a) => a.customerId === customerId || (a.projectId && projectIds.has(a.projectId)))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  }, [activityMap, projects, customerId]);

  const openOppValue = useMemo(
    () => opportunities
      .filter((o) => o.stage !== 'won' && o.stage !== 'lost')
      .reduce((s, o) => s + (o.estValue ?? 0), 0),
    [opportunities],
  );
  const wonValue = useMemo(
    () => opportunities.filter((o) => o.stage === 'won').reduce((s, o) => s + (o.estValue ?? 0), 0),
    [opportunities],
  );
  const openTaskCount = useMemo(() => tasks.filter((t) => t.status === 'open').length, [tasks]);

  if (!customer) {
    return (
      <AppShell crumbs={[{ label: 'Accounts', to: '/crm' }, { label: 'Unknown' }]}>
        <div className="max-w-xl mx-auto px-6 py-12 text-center">
          <h2 className="text-lg font-medium mb-2">Account not found</h2>
          <p className="text-sm text-muted-foreground mb-4">No customer with id <code>{customerId}</code> exists.</p>
          <Button variant="outline" onClick={() => navigate('/crm')}>Back to pipeline</Button>
        </div>
      </AppShell>
    );
  }

  const primaryContact = customer.primaryContactId
    ? contactsMap[customer.primaryContactId]
    : contacts.find((c) => c.isPrimary) ?? contacts[0];
  const address = customer.addresses?.[0];

  const TAB_META: { id: Tab; label: string; count?: number; icon: React.ReactNode }[] = [
    { id: 'opportunities', label: 'Opportunities', count: opportunities.length, icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: 'contacts',      label: 'Contacts',      count: contacts.length,      icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'projects',      label: 'Projects',      count: projects.length,      icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: 'activity',      label: 'Activity',      count: activity.length,      icon: <ActivityIcon className="w-3.5 h-3.5" /> },
    { id: 'tasks',         label: 'Tasks',         count: openTaskCount,        icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <AppShell
      crumbs={[
        { label: 'CRM', to: '/crm' },
        { label: customer.companyName },
      ]}
      title={customer.companyName}
      subtitle={[
        customer.industry && industryLabel(customer.industry),
        customer.accountTier && tierLabel(customer.accountTier),
        customer.ownerUserId && `Owner: ${customer.ownerUserId.replace(/^u-/, '')}`,
        address && `${address.city}${address.state ? `, ${address.state}` : ''}`,
      ].filter(Boolean).join(' · ')}
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline"><Plus className="w-3.5 h-3.5 mr-1" />Log touch</Button>
          <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" />New opportunity</Button>
        </div>
      }
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">

        {/* ── Header card ─────────────────────────────── */}
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="grid grid-cols-[1fr_320px] gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {customer.accountTier && (
                  <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${tierTone(customer.accountTier)}`}>
                    {customer.accountTier === 'strategic' && <Star className="w-3 h-3" />}
                    {tierLabel(customer.accountTier)}
                  </span>
                )}
                {customer.industry && (
                  <span className="text-[11.5px] text-muted-foreground">{industryLabel(customer.industry)}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {customer.website && (
                  <InfoRow icon={<Globe className="w-3.5 h-3.5" />} label="Website">
                    <a href={`https://${customer.website}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{customer.website}</a>
                  </InfoRow>
                )}
                {customer.employees && (
                  <InfoRow icon={<Users className="w-3.5 h-3.5" />} label="Employees">{customer.employees.toLocaleString('en-US')}</InfoRow>
                )}
                {address && (
                  <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="HQ">
                    {address.street}, {address.city}{address.state ? `, ${address.state}` : ''}
                  </InfoRow>
                )}
                {customer.ownerUserId && (
                  <InfoRow icon={<Building2 className="w-3.5 h-3.5" />} label="Account owner">
                    {customer.ownerUserId.replace(/^u-/, '')}
                  </InfoRow>
                )}
              </div>
            </div>

            <div>
              <div className="text-[11.5px] font-medium text-slate-200 mb-2 tracking-tight">Primary contact</div>
              {primaryContact ? (
                <div className="bg-secondary/30 border border-border/60 rounded-md p-3">
                  <div className="text-sm font-medium">{primaryContact.firstName} {primaryContact.lastName}</div>
                  {primaryContact.title && <div className="text-xs text-muted-foreground mt-0.5">{primaryContact.title}</div>}
                  <div className="mt-2 space-y-1 text-xs">
                    {primaryContact.email && (
                      <a href={`mailto:${primaryContact.email}`} className="flex items-center gap-1.5 text-primary hover:underline">
                        <Mail className="w-3 h-3" />{primaryContact.email}
                      </a>
                    )}
                    {primaryContact.phone && (
                      <a href={`tel:${primaryContact.phone}`} className="flex items-center gap-1.5 text-foreground hover:underline">
                        <Phone className="w-3 h-3" />{primaryContact.phone}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground bg-secondary/20 border border-border/40 rounded-md p-3">No primary contact yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Stat tiles ─────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Open pipeline" value={money(openOppValue)} hint={`${opportunities.filter((o) => o.stage !== 'won' && o.stage !== 'lost').length} deals`} />
          <Stat label="Lifetime won" value={money(wonValue)} hint={`${opportunities.filter((o) => o.stage === 'won').length} closed-won`} />
          <Stat label="Active projects" value={String(projects.filter((p) => p.lifecyclePhase !== 'archived').length)} hint={`${projects.length} total`} />
          <Stat label="Open tasks" value={String(openTaskCount)} />
        </div>

        {/* ── Tabs ─────────────────────────────────────── */}
        <div className="flex items-center border-b border-border gap-1">
          {TAB_META.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t.icon}
              {t.label}
              {typeof t.count === 'number' && <span className="text-[10px] text-muted-foreground">({t.count})</span>}
            </button>
          ))}
        </div>

        <div>
          {tab === 'opportunities' && (
            <OpportunitiesTab
              opps={opportunities}
              onOpen={(o) => o.wonProjectId ? navigate(`/project/${o.wonProjectId}`) : undefined}
              onStageChange={(id, stage) => setOppStage(id, stage, { userName: 'You' })}
              onConvert={(id) => {
                const projectId = convertOpp(id, { userName: 'You' });
                if (projectId) navigate(`/project/${projectId}`);
              }}
            />
          )}
          {tab === 'contacts' && <ContactsTab contacts={contacts} customer={customer} />}
          {tab === 'projects' && <ProjectsTab projects={projects} onOpen={(id) => navigate(`/project/${id}`)} />}
          {tab === 'activity' && <ActivityTab items={activity} touches={touches} />}
          {tab === 'tasks' && (
            <TasksTab
              tasks={tasks}
              onComplete={(id) => completeTask(id, { userName: 'You' })}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────

function OpportunitiesTab({ opps, onOpen, onStageChange, onConvert }: {
  opps: Opportunity[];
  onOpen: (o: Opportunity) => void;
  onStageChange: (id: string, stage: OpportunityStage) => void;
  onConvert: (id: string) => void;
}) {
  if (opps.length === 0) {
    return <EmptyState label="No opportunities yet. New deals will show up here." />;
  }
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground bg-secondary/30">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Opportunity</th>
            <th className="text-left px-4 py-2 font-medium">Stage</th>
            <th className="text-right px-4 py-2 font-medium">Value</th>
            <th className="text-right px-4 py-2 font-medium">Forecast</th>
            <th className="text-left px-4 py-2 font-medium">Owner</th>
            <th className="text-left px-4 py-2 font-medium">Close</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {opps.map((o) => {
            const forecast = (o.estValue ?? 0) * (o.probability ?? STAGE_PROBABILITY[o.stage]);
            return (
              <tr key={o.id} className="border-t border-border hover:bg-secondary/20">
                <td className="px-4 py-3">
                  <button onClick={() => onOpen(o)} className="text-left">
                    <div className="font-medium">{o.name}</div>
                    {o.description && <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{o.description}</div>}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={o.stage}
                    onChange={(e) => onStageChange(o.id, e.target.value as OpportunityStage)}
                    className={`bg-input-background border rounded text-xs px-2 py-1 focus:outline-none focus:border-primary ${STAGE_TONE[o.stage]}`}
                    title="Change stage"
                  >
                    {(['inquiry','qualified','discovery','proposing','negotiating','won','lost','on_hold'] as OpportunityStage[]).map((s) => (
                      <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{money(o.estValue ?? 0)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{money(forecast)}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.ownerUserId?.replace(/^u-/, '') ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{o.expectedCloseDate ? shortDate(o.expectedCloseDate) : (o.closedAt ? `closed ${shortDate(o.closedAt)}` : '—')}</td>
                <td className="px-4 py-3 text-right">
                  {o.stage === 'won' && !o.wonProjectId && (
                    <button onClick={() => onConvert(o.id)} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-primary/40 text-primary hover:bg-primary/10" title="Convert to project">
                      Convert <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {o.wonProjectId && <span className="text-[10px] text-muted-foreground">→ project</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ContactsTab({ contacts, customer }: { contacts: Contact[]; customer: { primaryContactId?: string } }) {
  if (contacts.length === 0) return <EmptyState label="No contacts yet. Add the first one." />;
  return (
    <div className="grid grid-cols-2 gap-3">
      {contacts.map((c) => {
        const isPrimary = c.id === customer.primaryContactId || c.isPrimary;
        return (
          <div key={c.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-sm font-medium">{c.firstName} {c.lastName}</div>
                  {isPrimary && <Star className="w-3 h-3 text-amber-400" />}
                </div>
                {c.title && <div className="text-xs text-muted-foreground mt-0.5">{c.title}</div>}
                {c.role && <div className="text-[11px] text-muted-foreground mt-2">{ROLE_LABEL[c.role] ?? c.role}</div>}
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-primary hover:underline"><Mail className="w-3 h-3" />{c.email}</a>}
              {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-foreground hover:underline"><Phone className="w-3 h-3" />{c.phone}</a>}
            </div>
            {c.notes && <div className="mt-3 text-xs text-muted-foreground">{c.notes}</div>}
          </div>
        );
      })}
    </div>
  );
}

function ProjectsTab({ projects, onOpen }: { projects: Project[]; onOpen: (id: string) => void }) {
  if (projects.length === 0) return <EmptyState label="No projects yet. Won opportunities will spawn projects here." />;
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground bg-secondary/30">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Project</th>
            <th className="text-left px-4 py-2 font-medium">Phase</th>
            <th className="text-right px-4 py-2 font-medium">Contract value</th>
            <th className="text-left px-4 py-2 font-medium">Next action</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const phaseCfg = PHASES[p.lifecyclePhase];
            return (
              <tr key={p.id} onClick={() => onOpen(p.id)} className="border-t border-border cursor-pointer hover:bg-secondary/20">
                <td className="px-4 py-3"><div className="font-medium">{p.name}</div></td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${phaseCfg.tone.outline}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${phaseCfg.tone.dot}`} />
                    {phaseCfg.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{p.contractValue ? money(p.contractValue) : '—'}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs line-clamp-1">{p.nextAction ?? '—'}</td>
                <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTab({ items, touches }: { items: import('../store/types').ActivityItem[]; touches: Touch[] }) {
  // Merge activity and touches into a single time-ordered feed.
  const merged = useMemo(() => {
    const stream = [
      ...items.map((a) => ({ kind: 'activity' as const, id: a.id, ts: a.createdAt, message: a.message, userName: a.userName, type: a.type })),
      ...touches.map((t) => ({ kind: 'touch' as const, id: t.id, ts: t.occurredAt, message: t.summary, detail: t.detail, userName: t.userName, type: t.type as string })),
    ];
    stream.sort((a, b) => b.ts - a.ts);
    return stream;
  }, [items, touches]);

  if (merged.length === 0) return <EmptyState label="No activity yet." />;
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
      {merged.map((m) => (
        <div key={`${m.kind}-${m.id}`} className="px-4 py-3 flex items-start gap-3">
          <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${dotForType(m.type)}`} />
          <div className="flex-1 min-w-0">
            <div className="text-sm">{m.message}</div>
            {m.kind === 'touch' && (m as any).detail && (
              <div className="text-xs text-muted-foreground mt-0.5">{(m as any).detail}</div>
            )}
            <div className="text-[10px] text-muted-foreground mt-1">
              <span className="text-muted-foreground/80">{m.type.replace(/_/g, ' ')}</span>
              {m.userName ? <> · {m.userName}</> : null} · {timeAgo(m.ts)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TasksTab({ tasks, onComplete }: { tasks: Task[]; onComplete: (id: string) => void }) {
  if (tasks.length === 0) return <EmptyState label="No tasks for this account." />;
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
      {tasks.map((t) => {
        const overdue = t.status === 'open' && t.dueDate != null && t.dueDate < Date.now();
        const done = t.status === 'done';
        return (
          <div key={t.id} className="px-4 py-3 flex items-start gap-3 hover:bg-secondary/20">
            <button onClick={() => !done && onComplete(t.id)} className={`mt-0.5 shrink-0 ${done ? 'text-emerald-400' : 'text-muted-foreground hover:text-emerald-400'}`}>
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>{t.title}</div>
              {t.detail && <div className="text-xs text-muted-foreground mt-0.5">{t.detail}</div>}
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                {t.assignedUserName && <span>{t.assignedUserName}</span>}
                {t.dueDate && (
                  <span className={overdue ? 'text-amber-400' : ''}>
                    <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                    {overdue ? 'Overdue · ' : ''}{shortDate(t.dueDate)}
                  </span>
                )}
                {t.status === 'snoozed' && <span><Calendar className="w-2.5 h-2.5 inline mr-0.5" />Snoozed</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className="text-xl font-medium mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11.5px] text-muted-foreground inline-flex items-center gap-1">{icon}{label}</div>
      <div className="text-sm mt-0.5">{children}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="text-center py-12 text-sm text-muted-foreground bg-card border border-border rounded-lg">{label}</div>;
}

// ─── helpers ──────────────────────────────────────────────────────

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`;
  return `$${n.toLocaleString('en-US')}`;
}
function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function timeAgo(ms: number): string {
  const d = Date.now() - ms;
  const sec = Math.floor(d / 1000); if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60); if (min < 60) return `${min}m ago`;
  const hr  = Math.floor(min / 60); if (hr < 24)  return `${hr}h ago`;
  const days = Math.floor(hr / 24); return `${days}d ago`;
}
function industryLabel(i: string): string {
  return ({
    healthcare: 'Healthcare', education: 'Education', retail: 'Retail',
    data_center: 'Data center', hospitality: 'Hospitality', government: 'Government',
    commercial_re: 'Commercial RE', manufacturing: 'Manufacturing',
    logistics: 'Logistics', multifamily: 'Multifamily', other: 'Other',
  } as Record<string, string>)[i] ?? i;
}
function tierLabel(t: string): string {
  return ({ strategic: 'Strategic', growth: 'Growth', standard: 'Standard' } as Record<string, string>)[t] ?? t;
}
function tierTone(t: string): string {
  return ({
    strategic: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    growth:    'text-blue-300 border-blue-500/40 bg-blue-500/10',
    standard:  'text-slate-300 border-slate-500/40 bg-slate-500/10',
  } as Record<string, string>)[t] ?? 'text-muted-foreground border-border';
}
function dotForType(type: string): string {
  if (type.startsWith('opportunity')) return 'bg-amber-400';
  if (type.startsWith('touch') || type === 'call' || type === 'email' || type === 'meeting' || type === 'note' || type === 'demo' || type === 'site_visit' || type === 'sms' || type === 'quote_sent') return 'bg-cyan-400';
  if (type.startsWith('phase')) return 'bg-blue-400';
  if (type.startsWith('device')) return 'bg-violet-400';
  if (type.startsWith('task')) return 'bg-emerald-400';
  if (type.startsWith('contact')) return 'bg-rose-400';
  return 'bg-slate-400';
}
