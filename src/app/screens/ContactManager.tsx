// SC.5.3 — Contact manager. Cross customer list of every Contact
// on file. Standalone surface so an integrator can sweep contacts
// without navigating to each customer one at a time.
//
// Reuses NewContactDialog from src/app/components/crmDialogs.tsx
// so creation persistence + validation rules match the version in
// AccountDetail.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Plus, Users, Mail, Phone, ChevronRight, Star, Search } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { NewContactDialog } from '../components/crmDialogs';

export function ContactManager() {
  const navigate = useNavigate();
  const contactsMap  = useProjectStore((s) => s.contacts);
  const customersMap = useProjectStore((s) => s.customers);
  const touchesMap   = useProjectStore((s) => s.touches);

  const [query, setQuery]   = useState('');
  const [newOpen, setNewOpen] = useState(false);

  const contacts = useMemo(() => {
    const list = Object.values(contactsMap);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter((c) => {
          const name = `${c.firstName} ${c.lastName}`.toLowerCase();
          const company = customersMap[c.customerId]?.companyName.toLowerCase() ?? '';
          return name.includes(q)
            || (c.email ?? '').toLowerCase().includes(q)
            || (c.title ?? '').toLowerCase().includes(q)
            || company.includes(q);
        })
      : list;
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [contactsMap, customersMap, query]);

  const lastTouchByContact = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of Object.values(touchesMap)) {
      if (!t.contactId) continue;
      const prev = m.get(t.contactId);
      if (prev === undefined || t.occurredAt > prev) m.set(t.contactId, t.occurredAt);
    }
    return m;
  }, [touchesMap]);

  return (
    <AppShell
      crumbs={[{ label: 'CRM' }, { label: 'Contacts' }]}
      title="Contacts"
      subtitle={`${Object.keys(contactsMap).length} on file across ${Object.keys(customersMap).length} customers`}
      actions={
        <Button size="sm" onClick={() => setNewOpen(true)} data-testid="contact-new">
          <Plus className="w-3.5 h-3.5 mr-1" />New contact
        </Button>
      }
    >
      <div className="max-w-[1100px] mx-auto px-6 py-6">
        <div className="relative mb-4">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, title, or company"
            className="w-full text-sm h-9 pl-9 pr-3 rounded-md border border-border bg-background placeholder:text-muted-foreground/50"
            data-testid="contact-search"
          />
        </div>

        {contacts.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <Users className="w-6 h-6 text-muted-foreground mx-auto" />
            <div className="text-sm mt-3 font-medium">
              {query ? 'No contacts match that search.' : 'No contacts yet'}
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {query ? 'Try a different name, email, or company.' : 'Add your first to track relationships at customer accounts.'}
            </p>
            {!query && (
              <Button size="sm" className="mt-3" onClick={() => setNewOpen(true)} data-testid="contact-new-empty">
                <Plus className="w-3.5 h-3.5 mr-1" />New contact
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_160px_160px_120px_120px_40px] gap-3 px-4 py-2 border-b border-border bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <div>Contact</div>
              <div>Customer</div>
              <div>Title / role</div>
              <div>Email / phone</div>
              <div>Last touched</div>
              <div />
            </div>
            <ul className="divide-y divide-border">
              {contacts.map((c) => {
                const customer = customersMap[c.customerId];
                const last = lastTouchByContact.get(c.id);
                return (
                  <li key={c.id} className="hover:bg-secondary/30">
                    <button
                      type="button"
                      onClick={() => customer && navigate(`/account/${customer.id}`)}
                      className="w-full text-left grid grid-cols-[1fr_160px_160px_120px_120px_40px] gap-3 px-4 py-3 items-center"
                      data-testid={`contact-row-${c.id}`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          {c.isPrimary && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                          {[c.firstName, c.lastName].filter(Boolean).join(' ') || '(unnamed)'}
                        </div>
                      </div>
                      <div className="min-w-0 text-xs truncate">{customer?.companyName ?? <span className="text-muted-foreground italic">orphan</span>}</div>
                      <div className="min-w-0 text-xs text-muted-foreground truncate">{c.title ?? <span className="text-muted-foreground/60">—</span>}</div>
                      <div className="min-w-0 text-xs text-muted-foreground truncate">
                        {c.email
                          ? <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
                          : c.phone
                            ? <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>
                            : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {last ? relativeShort(last) : '—'}
                      </div>
                      <div className="text-muted-foreground"><ChevronRight className="w-3.5 h-3.5" /></div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {newOpen && (
        <NewContactDialog
          onClose={() => setNewOpen(false)}
          onCreated={(id) => {
            const c = useProjectStore.getState().contacts[id];
            if (c) navigate(`/account/${c.customerId}`);
          }}
        />
      )}
    </AppShell>
  );
}

function relativeShort(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}
