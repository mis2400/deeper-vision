// SC.5.5 — Building manager. Cross customer list of every
// Building. Joins via site -> project -> customer to surface the
// customer column.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Plus, Building2, ChevronRight, Layers as LayersIcon } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { NewBuildingDialog } from '../components/crmDialogs';

export function BuildingManager() {
  const navigate = useNavigate();
  const buildingsMap = useProjectStore((s) => s.buildings);
  const sitesMap     = useProjectStore((s) => s.sites);
  const projectsMap  = useProjectStore((s) => s.projects);
  const customersMap = useProjectStore((s) => s.customers);
  const floorsMap    = useProjectStore((s) => s.floors);

  const [newOpen, setNewOpen] = useState(false);

  const buildings = useMemo(
    () => Object.values(buildingsMap).sort((a, b) => a.name.localeCompare(b.name)),
    [buildingsMap],
  );
  const floorCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of Object.values(floorsMap)) {
      m.set(f.buildingId, (m.get(f.buildingId) ?? 0) + 1);
    }
    return m;
  }, [floorsMap]);

  return (
    <AppShell
      crumbs={[{ label: 'CRM' }, { label: 'Buildings' }]}
      title="Buildings"
      subtitle={`${buildings.length} on file`}
      actions={
        <Button size="sm" onClick={() => setNewOpen(true)} data-testid="building-new">
          <Plus className="w-3.5 h-3.5 mr-1" />New building
        </Button>
      }
    >
      <div className="max-w-[1100px] mx-auto px-6 py-6">
        {buildings.length === 0 ? (
          <EmptyState onCreate={() => setNewOpen(true)} />
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_180px_160px_100px_40px] gap-3 px-4 py-2 border-b border-border bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <div>Building</div>
              <div>Customer</div>
              <div>Site</div>
              <div>Floors</div>
              <div />
            </div>
            <ul className="divide-y divide-border">
              {buildings.map((b) => {
                const site = sitesMap[b.siteId];
                const project = site ? projectsMap[site.projectId] : undefined;
                const customer = project?.customerId ? customersMap[project.customerId] : undefined;
                return (
                  <li key={b.id} className="hover:bg-secondary/30">
                    <button
                      type="button"
                      onClick={() => project && navigate(`/project/${project.id}`)}
                      className="w-full text-left grid grid-cols-[1fr_180px_160px_100px_40px] gap-3 px-4 py-3 items-center"
                      data-testid={`building-row-${b.id}`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                          {b.name}
                        </div>
                      </div>
                      <div className="text-xs truncate">
                        {customer?.companyName ?? <span className="text-muted-foreground italic">orphan</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{site?.name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground tabular-nums inline-flex items-center gap-1">
                        <LayersIcon className="w-3 h-3" />{floorCounts.get(b.id) ?? 0}
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

      {newOpen && <NewBuildingDialog onClose={() => setNewOpen(false)} />}
    </AppShell>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center max-w-md mx-auto py-16">
      <div className="w-12 h-12 rounded-xl bg-secondary/60 inline-flex items-center justify-center">
        <Building2 className="w-5 h-5 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium mt-4">No buildings yet</h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        Buildings live inside sites. Create a site first, then add buildings to it.
      </p>
      <Button className="mt-5" onClick={onCreate} data-testid="building-new-empty">
        <Plus className="w-4 h-4 mr-1" />New building
      </Button>
    </div>
  );
}
