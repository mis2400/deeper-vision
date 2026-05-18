// SC.5.4 — Site manager. Cross customer list of every Site.
// Sites belong to projects in the current schema; the customer
// column derives via the parent project's customerId.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Plus, MapPinned, ChevronRight, Building2 } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { NewSiteDialog } from '../components/crmDialogs';

export function SiteManager() {
  const navigate = useNavigate();
  const sitesMap     = useProjectStore((s) => s.sites);
  const projectsMap  = useProjectStore((s) => s.projects);
  const customersMap = useProjectStore((s) => s.customers);
  const buildingsMap = useProjectStore((s) => s.buildings);

  const [newOpen, setNewOpen] = useState(false);

  const sites = useMemo(() => Object.values(sitesMap).sort((a, b) => a.name.localeCompare(b.name)), [sitesMap]);
  const buildingCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of Object.values(buildingsMap)) {
      m.set(b.siteId, (m.get(b.siteId) ?? 0) + 1);
    }
    return m;
  }, [buildingsMap]);

  return (
    <AppShell
      crumbs={[{ label: 'CRM' }, { label: 'Sites' }]}
      title="Sites"
      subtitle={`${sites.length} on file`}
      actions={
        <Button size="sm" onClick={() => setNewOpen(true)} data-testid="site-new">
          <Plus className="w-3.5 h-3.5 mr-1" />New site
        </Button>
      }
    >
      <div className="max-w-[1100px] mx-auto px-6 py-6">
        {sites.length === 0 ? (
          <EmptyState onCreate={() => setNewOpen(true)} />
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_180px_140px_100px_40px] gap-3 px-4 py-2 border-b border-border bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <div>Site</div>
              <div>Customer</div>
              <div>Project</div>
              <div>Buildings</div>
              <div />
            </div>
            <ul className="divide-y divide-border">
              {sites.map((s) => {
                const project = projectsMap[s.projectId];
                const customer = project?.customerId ? customersMap[project.customerId] : undefined;
                return (
                  <li key={s.id} className="hover:bg-secondary/30">
                    <button
                      type="button"
                      onClick={() => project && navigate(`/project/${project.id}`)}
                      className="w-full text-left grid grid-cols-[1fr_180px_140px_100px_40px] gap-3 px-4 py-3 items-center"
                      data-testid={`site-row-${s.id}`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          <MapPinned className="w-3.5 h-3.5 text-muted-foreground" />
                          {s.name}
                        </div>
                        {s.address && <div className="text-[11px] text-muted-foreground truncate pl-5">{s.address}</div>}
                      </div>
                      <div className="text-xs truncate">
                        {customer?.companyName ?? <span className="text-muted-foreground italic">orphan</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{project?.name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground tabular-nums inline-flex items-center gap-1">
                        <Building2 className="w-3 h-3" />{buildingCounts.get(s.id) ?? 0}
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

      {newOpen && <NewSiteDialog onClose={() => setNewOpen(false)} />}
    </AppShell>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center max-w-md mx-auto py-16">
      <div className="w-12 h-12 rounded-xl bg-secondary/60 inline-flex items-center justify-center">
        <MapPinned className="w-5 h-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium mt-4">No sites yet</h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        A site is a physical location for a project. Add one to scope buildings and floors against it.
      </p>
      <Button className="mt-5" onClick={onCreate} data-testid="site-new-empty">
        <Plus className="w-4 h-4 mr-1" />New site
      </Button>
    </div>
  );
}
