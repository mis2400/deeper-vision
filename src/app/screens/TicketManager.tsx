// SC.6.1 — Service Ticket manager. Standalone /tickets route showing
// every ServiceTicket across every customer + project. Closes the
// audit gap from step 18 (no internal ticket UI shipped before this
// pass). Parallels the SC.5 cross-customer managers in structure:
// filters at the top, list below, click row to drill into detail.
//
// Detail view lives at /ticket/:ticketId (SC.6.2). This screen wires
// the navigation but does not own ticket mutation beyond create.
//
// SC.6.4 reuses TICKET_STATUS_* + TICKET_PRIORITY_* maps from
// lib/ticketLabels so the customer surface and this internal surface
// stay in lockstep.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import {
  Plus, LifeBuoy, ChevronRight, Search, AlertTriangle,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type {
  ServiceTicket, TicketStatus, TicketPriority, TicketCategory,
} from '../store/types';
import { NewTicketDialog } from '../components/ticketDialogs';
import {
  TICKET_STATUS_INTERNAL,
  TICKET_PRIORITY_LABEL,
  TICKET_CATEGORY_INTERNAL,
  TICKET_STATUS_TONE,
  TICKET_PRIORITY_TONE,
} from '../lib/ticketLabels';

type StatusFilter   = TicketStatus | 'all' | 'active' | 'orphaned';
type PriorityFilter = TicketPriority | 'all';
type CategoryFilter = TicketCategory | 'all';

// 'active' default hides resolved/closed AND orphans. 'orphaned' is
// the explicit triage view per the schema comment in types.ts:548-556
// ("internal triage views can still list it") so the operator has a
// path to see tickets whose parent customer or project was deleted.
const STATUS_FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all',              label: 'All' },
  { id: 'active',           label: 'Active' },
  { id: 'open',             label: 'Open' },
  { id: 'in_progress',      label: 'In progress' },
  { id: 'waiting_customer', label: 'Waiting on customer' },
  { id: 'resolved',         label: 'Resolved' },
  { id: 'closed',           label: 'Closed' },
  { id: 'orphaned',         label: 'Orphaned' },
];

export function TicketManager() {
  const navigate = useNavigate();
  const ticketsMap   = useProjectStore((s) => s.serviceTickets);
  const customersMap = useProjectStore((s) => s.customers);
  const projectsMap  = useProjectStore((s) => s.projects);

  const [newOpen, setNewOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('active');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [projectFilter, setProjectFilter]   = useState<string>('');

  const customers = useMemo(
    () => Object.values(customersMap).sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [customersMap],
  );

  // Project filter is scoped to the picked customer so a "project"
  // dropdown that lists 200 unrelated projects doesn't get in the
  // operator's way. When no customer is picked the project filter
  // hides entirely.
  const projectsForFilter = useMemo(
    () => Object.values(projectsMap).filter((p) => !customerFilter || p.customerId === customerFilter).sort((a, b) => a.name.localeCompare(b.name)),
    [projectsMap, customerFilter],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Object.values(ticketsMap).filter((t) => {
      if (statusFilter === 'orphaned') {
        if (!t.isOrphaned) return false;
      } else {
        // Every non-orphan filter hides orphans by default. Operator
        // opts in via the Orphaned filter when they want to triage them.
        if (t.isOrphaned) return false;
        if (statusFilter === 'active') {
          if (t.status === 'resolved' || t.status === 'closed') return false;
        } else if (statusFilter !== 'all') {
          if (t.status !== statusFilter) return false;
        }
      }
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (customerFilter && t.customerId !== customerFilter) return false;
      if (projectFilter  && t.projectId  !== projectFilter)  return false;
      if (q) {
        const haystack = [
          t.ticketNumber,
          t.title,
          t.description,
          t.reportedBy?.name,
          customersMap[t.customerId]?.companyName,
          projectsMap[t.projectId]?.name,
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    // Sort by priority (critical/high first), then newest update.
    const priRank: Record<TicketPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    list.sort((a, b) => priRank[a.priority] - priRank[b.priority] || (b.updatedAt - a.updatedAt));
    return list;
  }, [ticketsMap, customersMap, projectsMap, query, statusFilter, priorityFilter, categoryFilter, customerFilter, projectFilter]);

  const { activeCount, orphanCount } = useMemo(() => {
    let active = 0;
    let orphan = 0;
    for (const t of Object.values(ticketsMap)) {
      if (t.isOrphaned) { orphan += 1; continue; }
      if (t.status !== 'closed' && t.status !== 'resolved') active += 1;
    }
    return { activeCount: active, orphanCount: orphan };
  }, [ticketsMap]);

  return (
    <AppShell
      crumbs={[{ label: 'Work' }, { label: 'Service tickets' }]}
      title="Service tickets"
      subtitle={
        `${activeCount} active · ${Object.keys(ticketsMap).length} total`
        + (orphanCount ? ` · ${orphanCount} orphaned` : '')
      }
      actions={
        <Button size="sm" onClick={() => setNewOpen(true)} data-testid="ticket-new">
          <Plus className="w-3.5 h-3.5 mr-1" />New ticket
        </Button>
      }
    >
      <div className="max-w-[1300px] mx-auto px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-3 space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ticket number, title, description, customer, project"
              data-testid="ticket-search"
              className="w-full text-sm h-9 pl-9 pr-3 rounded-md border border-border bg-background placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <FilterSelect
              label="Status" value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              options={STATUS_FILTER_OPTIONS}
              testId="ticket-filter-status"
            />
            <FilterSelect
              label="Priority" value={priorityFilter}
              onChange={(v) => setPriorityFilter(v as PriorityFilter)}
              options={[{ id: 'all', label: 'All' }, ...(['critical','high','medium','low'] as TicketPriority[]).map((p) => ({ id: p, label: TICKET_PRIORITY_LABEL[p] }))]}
              testId="ticket-filter-priority"
            />
            <FilterSelect
              label="Category" value={categoryFilter}
              onChange={(v) => setCategoryFilter(v as CategoryFilter)}
              options={[{ id: 'all', label: 'All' }, ...(Object.keys(TICKET_CATEGORY_INTERNAL) as TicketCategory[]).map((c) => ({ id: c, label: TICKET_CATEGORY_INTERNAL[c] }))]}
              testId="ticket-filter-category"
            />
            <FilterSelect
              label="Customer" value={customerFilter}
              onChange={(v) => { setCustomerFilter(v); setProjectFilter(''); }}
              options={[{ id: '', label: 'All' }, ...customers.map((c) => ({ id: c.id, label: c.companyName }))]}
              testId="ticket-filter-customer"
            />
            <FilterSelect
              label="Project" value={projectFilter}
              onChange={setProjectFilter}
              disabled={!customerFilter}
              options={[{ id: '', label: customerFilter ? 'All' : 'Pick a customer first' }, ...projectsForFilter.map((p) => ({ id: p.id, label: p.name }))]}
              testId="ticket-filter-project"
            />
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            hasAny={Object.keys(ticketsMap).length > 0}
            onCreate={() => setNewOpen(true)}
          />
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[110px_minmax(0,1fr)_160px_160px_120px_90px_60px] gap-3 px-4 py-2 border-b border-border bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <div>Ticket</div>
              <div>Title</div>
              <div>Customer</div>
              <div>Project</div>
              <div>Status</div>
              <div>Priority</div>
              <div className="text-right">Age</div>
            </div>
            <ul className="divide-y divide-border">
              {filtered.map((t) => (
                <TicketRow
                  key={t.id}
                  ticket={t}
                  customerName={customersMap[t.customerId]?.companyName ?? '(unknown)'}
                  projectName={projectsMap[t.projectId]?.name ?? '(unknown)'}
                  onOpen={() => navigate(`/ticket/${t.id}`)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      {newOpen && (
        <NewTicketDialog
          onClose={() => setNewOpen(false)}
          onCreated={(id) => navigate(`/ticket/${id}`)}
        />
      )}
    </AppShell>
  );
}

function TicketRow({ ticket, customerName, projectName, onOpen }: {
  ticket: ServiceTicket;
  customerName: string;
  projectName: string;
  onOpen: () => void;
}) {
  return (
    <li className="hover:bg-secondary/30">
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left grid grid-cols-[110px_minmax(0,1fr)_160px_160px_120px_90px_60px] gap-3 px-4 py-3 items-center"
        data-testid={`ticket-row-${ticket.id}`}
      >
        <div className="text-xs font-mono text-muted-foreground tabular-nums">{ticket.ticketNumber}</div>
        <div className="min-w-0">
          <div className="text-sm truncate">{ticket.title}</div>
          <div className="text-[11px] text-muted-foreground truncate">{ticket.description}</div>
        </div>
        <div className="text-xs truncate">{customerName}</div>
        <div className="text-xs text-muted-foreground truncate">{projectName}</div>
        <div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${TICKET_STATUS_TONE[ticket.status]}`}>
            {TICKET_STATUS_INTERNAL[ticket.status]}
          </span>
        </div>
        <div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${TICKET_PRIORITY_TONE[ticket.priority]}`}>
            {TICKET_PRIORITY_LABEL[ticket.priority]}
          </span>
        </div>
        <div className="text-right text-[11px] text-muted-foreground tabular-nums inline-flex items-center justify-end gap-1">
          {ageShort(ticket.createdAt)}
          <ChevronRight className="w-3 h-3" />
        </div>
      </button>
    </li>
  );
}

function FilterSelect({
  label, value, onChange, options, disabled, testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        data-testid={testId}
        className="bg-input-background border border-input-border rounded-md px-2 py-1.5 text-xs disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ hasAny, onCreate }: { hasAny: boolean; onCreate: () => void }) {
  return (
    <div className="text-center max-w-md mx-auto py-16">
      <div className="w-12 h-12 rounded-xl bg-secondary/60 inline-flex items-center justify-center">
        <LifeBuoy className="w-5 h-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium mt-4">
        {hasAny ? 'No tickets match the filters.' : 'No service tickets yet'}
      </h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        {hasAny
          ? 'Loosen the filters or search for a different term.'
          : 'Tickets get created either here or from the Customer Portal. New tickets land in the operator queue automatically.'}
      </p>
      {!hasAny && (
        <Button className="mt-5" onClick={onCreate} data-testid="ticket-new-empty">
          <Plus className="w-4 h-4 mr-1" />New ticket
        </Button>
      )}
    </div>
  );
}

function ageShort(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}
