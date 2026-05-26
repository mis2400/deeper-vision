// FloorSwitcher + ManageFloorsDialog + defaultNameForLevel —
// extracted from screens/EngineeringCanvas.tsx as part of the M11
// monolith breakup. The top-bar floor dropdown plus its "Manage
// floors..." child modal. Tightly coupled: the dialog is opened
// from a row inside the dropdown menu and shares the level-naming
// helper, so all three move together.

import { Check, ChevronDown, Layers, Plus, Settings2, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useProjectStore } from '../../store/projectStore';

/**
 * Canvas V2 Pass 2A.6 — naming convention. Level is the source of
 * truth for sort order; this helper derives a default display name
 * from a level integer. Operators can always override with a custom
 * name; level still drives the sort.
 */
function defaultNameForLevel(level: number): string {
  if (level === 0) return 'Ground floor';
  if (level > 0) return `Level ${level + 1}`;
  if (level === -1) return 'Basement';
  if (level === -2) return 'Sub-basement';
  return `B${Math.abs(level)}`;
}

export function FloorSwitcher({ projectId }: { projectId: string }) {
  const floorsMap = useProjectStore((s) => s.floors);
  const stickyId  = useProjectStore((s) => s.currentFloorIdByProject[projectId]);
  const setSticky = useProjectStore((s) => s.setCurrentFloorIdForProject);
  const [manageOpen, setManageOpen] = useState(false);
  const projectFloors = useMemo(() => {
    return Object.values(floorsMap)
      .filter((f) => f.projectId === projectId)
      .sort((a, b) => (b.level - a.level) || ((b.createdAt ?? 0) - (a.createdAt ?? 0)));
  }, [floorsMap, projectId]);
  const activeId = stickyId || projectFloors.find((f) => f.level === 0)?.id || projectFloors[projectFloors.length - 1]?.id || '';
  const active = projectFloors.find((f) => f.id === activeId) ?? null;

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // Level badge string. Operators in commercial/multifamily think
  // in B2 / B1 / G / L2 / L3 — short, unambiguous, building-elevation.
  const levelBadge = (level: number) => {
    if (level < 0) return `B${Math.abs(level)}`;
    if (level === 0) return 'G';
    return `L${level + 1}`;
  };

  // Single floor case: render a static badge with a "Single floor"
  // tooltip, but visually identical to the dropdown so the chrome
  // doesn't shift when an operator adds a second floor later.
  const isMulti = projectFloors.length > 1;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => isMulti && setOpen((v) => !v)}
        title={isMulti ? `${projectFloors.length} floors · ⌘↑ / ⌘↓ to switch` : 'Single floor on this project'}
        data-track="topbar-floor-switcher"
        className={`inline-flex items-center gap-2 h-9 px-3 rounded-lg font-medium border border-border bg-card text-foreground transition-colors ${isMulti ? 'hover:bg-secondary/50 hover:border-border-strong' : 'cursor-default'}`}
        style={{ fontSize: 'var(--chrome-md)', letterSpacing: '-0.01em', boxShadow: 'var(--shadow-flat)' }}
      >
        <Layers className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
        <span>{active?.name || 'Floor'}</span>
        {active && (
          <span className="tabular-nums font-semibold rounded-md px-1.5 py-0.5"
            style={{ fontSize: 'var(--chrome-xs)', color: 'var(--muted-foreground)', background: 'var(--secondary)' }}>
            {levelBadge(active.level)}
          </span>
        )}
        {isMulti && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />}
      </button>
      {open && isMulti && (
        <div
          role="listbox"
          className="absolute left-0 mt-1 min-w-[220px] bg-card border border-border rounded-lg shadow-xl z-[60] overflow-hidden"
        >
          {projectFloors.map((f) => {
            const isActive = f.id === activeId;
            return (
              <button
                key={f.id}
                role="option"
                aria-selected={isActive}
                onClick={() => { setSticky(projectId, f.id); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/40 text-foreground'}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {isActive ? <Check className="w-3.5 h-3.5 flex-none" /> : <span className="w-3.5 h-3.5 flex-none" />}
                  <span className="truncate">{f.name}</span>
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground bg-secondary/60 rounded px-1.5 py-0.5">
                  {levelBadge(f.level)}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => { setOpen(false); setManageOpen(true); }}
            className="w-full text-left px-3 py-2 text-sm border-t border-border hover:bg-secondary/40 flex items-center gap-2"
            data-track="floor-switcher-manage"
          >
            <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
            Manage floors…
          </button>
          <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground tracking-wider uppercase">⌘↑ / ⌘↓ to switch</div>
        </div>
      )}
      {manageOpen && (
        <ManageFloorsDialog
          projectId={projectId}
          onClose={() => setManageOpen(false)}
        />
      )}
    </div>
  );
}

function ManageFloorsDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const floorsMap = useProjectStore((s) => s.floors);
  const devicesMap = useProjectStore((s) => s.devices);
  const doorsMap = useProjectStore((s) => s.doors);
  const pathwaysMap = useProjectStore((s) => s.pathways);
  const measurementsMap = useProjectStore((s) => s.measurements);
  const updateFloor = useProjectStore((s) => s.updateFloor);
  const removeFloor = useProjectStore((s) => s.removeFloor);
  const addFloor = useProjectStore((s) => s.addFloor);
  const removeDevice = useProjectStore((s) => s.removeDevice);
  const removeDoor = useProjectStore((s) => s.removeDoor);
  const removePathway = useProjectStore((s) => s.removePathway);
  const removeMeasurement = useProjectStore((s) => s.removeMeasurement);
  const setCurrentFloorIdForProject = useProjectStore((s) => s.setCurrentFloorIdForProject);
  const pushHistory = useProjectStore((s) => s.pushCanvasHistory);

  const projectFloors = useMemo(() => {
    return Object.values(floorsMap)
      .filter((f) => f.projectId === projectId)
      .sort((a, b) => (b.level - a.level) || ((b.createdAt ?? 0) - (a.createdAt ?? 0)));
  }, [floorsMap, projectId]);

  // Per floor record counts so the operator can see what they'd lose on delete.
  const countsByFloor = useMemo(() => {
    const out: Record<string, { devices: number; doors: number; pathways: number; measurements: number }> = {};
    for (const f of projectFloors) out[f.id] = { devices: 0, doors: 0, pathways: 0, measurements: 0 };
    for (const d of Object.values(devicesMap) as any[]) { if (out[d.floorId]) out[d.floorId].devices += 1; }
    for (const d of Object.values(doorsMap) as any[]) { if (out[d.floorId]) out[d.floorId].doors += 1; }
    for (const p of Object.values(pathwaysMap) as any[]) { if (out[p.floorId]) out[p.floorId].pathways += 1; }
    for (const m of Object.values(measurementsMap) as any[]) { if (out[m.floorId]) out[m.floorId].measurements += 1; }
    return out;
  }, [projectFloors, devicesMap, doorsMap, pathwaysMap, measurementsMap]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [levelDraft, setLevelDraft] = useState<number>(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLevel, setNewLevel] = useState<number>(0);

  // ESC closes (when not in a sub modal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmDelete) { setConfirmDelete(null); return; }
      if (editingId) { setEditingId(null); return; }
      if (adding) { setAdding(false); return; }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirmDelete, editingId, adding]);

  const startEdit = (f: any) => { setEditingId(f.id); setNameDraft(f.name); setLevelDraft(f.level); };
  const cancelEdit = () => { setEditingId(null); };
  const saveEdit = () => {
    if (!editingId) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) { toast.error('Floor name cannot be empty.'); return; }
    const lvl = Math.max(-9, Math.min(99, Math.round(levelDraft)));
    pushHistory('Renamed floor', ['floors']);
    updateFloor(editingId, { name: trimmed, level: lvl });
    setEditingId(null);
  };

  const handleAdd = () => {
    // Canvas V2 Pass 2A.6 — accept either a custom name or fall back
    // to a default derived from the level. The level alone is enough
    // to add a floor; the operator can rename later.
    const trimmed = newName.trim() || defaultNameForLevel(newLevel);
    // Reuse an existing building on this project, else bail.
    const sibling = projectFloors[0];
    if (!sibling) { toast.error('Cannot add a floor before the project has a building.'); return; }
    const lvl = Math.max(-9, Math.min(99, Math.round(newLevel)));
    const id = `f-${Date.now().toString(36).slice(-5)}-${Math.random().toString(36).slice(2, 5)}`;
    pushHistory('Added floor', ['floors']);
    addFloor({
      id,
      projectId,
      buildingId: sibling.buildingId,
      name: trimmed,
      level: lvl,
      createdAt: Date.now(),
      source: 'blank',
      scalePxToFt: 0,
      walls: [],
    });
    setCurrentFloorIdForProject(projectId, id);
    toast.success(`Added ${trimmed}`);
    setAdding(false);
    setNewName('');
    setNewLevel(0);
  };

  const handleDelete = (id: string) => {
    const f = floorsMap[id];
    if (!f) return;
    const c = countsByFloor[id];
    const totalRecords = (c?.devices ?? 0) + (c?.doors ?? 0) + (c?.pathways ?? 0) + (c?.measurements ?? 0);
    // Snapshot every slice the cascade touches so undo restores the
    // floor and every dependent record atomically.
    pushHistory(`Removed ${f.name}`, ['floors', 'devices', 'doors', 'pathways']);
    // Cascade dependents.
    for (const d of Object.values(devicesMap) as any[]) { if (d.floorId === id) removeDevice(d.id); }
    for (const d of Object.values(doorsMap) as any[]) { if (d.floorId === id) removeDoor(d.id); }
    for (const p of Object.values(pathwaysMap) as any[]) { if (p.floorId === id) removePathway(p.id); }
    for (const m of Object.values(measurementsMap) as any[]) { if (m.floorId === id) removeMeasurement(m.id); }
    removeFloor(id);
    toast.success(`Removed ${f.name}${totalRecords > 0 ? ` and ${totalRecords} dependent record${totalRecords === 1 ? '' : 's'}` : ''}. Undoable with ⌘Z.`);
    setConfirmDelete(null);
  };

  const levelBadge = (level: number) => {
    if (level < 0) return `B${Math.abs(level)}`;
    if (level === 0) return 'G';
    return `L${level + 1}`;
  };

  return (
    <div className="fixed inset-0 z-[70] bg-foreground/40 flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Floors</div>
            <div className="text-[11px] text-muted-foreground">{projectFloors.length} {projectFloors.length === 1 ? 'floor' : 'floors'} on this project</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto">
          {projectFloors.map((f) => {
            const c = countsByFloor[f.id] ?? { devices: 0, doors: 0, pathways: 0, measurements: 0 };
            const totalRecords = c.devices + c.doors + c.pathways + c.measurements;
            const editing = editingId === f.id;
            if (editing) {
              return (
                <div key={f.id} className="px-4 py-3 border-b border-border space-y-2 bg-secondary/30">
                  <div>
                    <label className="text-[11px] text-muted-foreground">Name</label>
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }}
                      autoFocus
                      className="mt-1 w-full bg-input-background border border-input-border rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-muted-foreground">Level</label>
                    <input
                      type="number"
                      value={levelDraft}
                      onChange={(e) => setLevelDraft(Number(e.target.value))}
                      min={-9} max={99}
                      className="w-20 bg-input-background border border-input-border rounded px-2 py-1.5 text-sm tabular-nums"
                    />
                    <span className="text-[11px] text-muted-foreground">{levelDraft >= 0 ? `Level ${levelDraft + 1}` : `Basement ${Math.abs(levelDraft)}`}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveEdit} className="text-[11px] px-3 h-7 rounded bg-primary text-primary-foreground hover:opacity-90">Save</button>
                    <button onClick={cancelEdit} className="text-[11px] px-3 h-7 rounded border border-border text-muted-foreground hover:text-foreground">Cancel</button>
                  </div>
                </div>
              );
            }
            return (
              <div key={f.id} className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] tabular-nums text-muted-foreground bg-secondary/60 rounded px-1.5 py-0.5">{levelBadge(f.level)}</span>
                  <div className="min-w-0">
                    <div className="text-sm truncate">{f.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.devices} {c.devices === 1 ? 'device' : 'devices'}
                      {c.doors > 0 && ` · ${c.doors} door${c.doors === 1 ? '' : 's'}`}
                      {c.pathways > 0 && ` · ${c.pathways} pathway${c.pathways === 1 ? '' : 's'}`}
                      {f.background ? ' · plan loaded' : ' · no plan'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-none">
                  <button onClick={() => startEdit(f)} title="Edit name + level" className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/40">
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                  {projectFloors.length > 1 && (
                    <button onClick={() => setConfirmDelete(f.id)} title="Remove floor" className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {confirmDelete === f.id && (
                  <div className="fixed inset-0 z-[80] bg-foreground/50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
                    <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="px-4 py-3 border-b border-border">
                        <div className="text-sm font-medium">Remove {f.name}?</div>
                      </div>
                      <div className="px-4 py-3 text-sm">
                        {totalRecords > 0 ? (
                          <>
                            <span className="text-foreground">{f.name} has {totalRecords} item{totalRecords === 1 ? '' : 's'}</span>
                            <span className="text-muted-foreground"> ({c.devices} device{c.devices === 1 ? '' : 's'}{c.doors > 0 && `, ${c.doors} door${c.doors === 1 ? '' : 's'}`}{c.pathways > 0 && `, ${c.pathways} pathway${c.pathways === 1 ? '' : 's'}`}{c.measurements > 0 && `, ${c.measurements} measurement${c.measurements === 1 ? '' : 's'}`}). Remove anyway? Undoable with ⌘Z.</span>
                          </>
                        ) : (
                          'This floor is empty. Remove?'
                        )}
                      </div>
                      <div className="px-4 py-2.5 border-t border-border flex justify-end gap-2">
                        <button onClick={() => setConfirmDelete(null)} className="text-[11px] px-3 h-7 rounded border border-border text-muted-foreground hover:text-foreground">Cancel</button>
                        <button onClick={() => handleDelete(f.id)} className="text-[11px] px-3 h-7 rounded bg-destructive text-destructive-foreground hover:opacity-90">Remove</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {adding ? (
            <div className="px-4 py-3 border-b border-border space-y-2 bg-secondary/30">
              <div>
                <label className="text-[11px] text-muted-foreground">Name <span className="text-muted-foreground/70">(leave blank to use default)</span></label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                  autoFocus
                  placeholder={defaultNameForLevel(newLevel)}
                  className="mt-1 w-full bg-input-background border border-input-border rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-muted-foreground">Level</label>
                <input
                  type="number"
                  value={newLevel}
                  onChange={(e) => setNewLevel(Number(e.target.value))}
                  min={-9} max={99}
                  className="w-20 bg-input-background border border-input-border rounded px-2 py-1.5 text-sm tabular-nums"
                />
                <span className="text-[11px] text-muted-foreground">0 = Ground, 1 = first floor up, -1 = basement</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAdd} className="text-[11px] px-3 h-7 rounded bg-primary text-primary-foreground hover:opacity-90">Add</button>
                <button onClick={() => setAdding(false)} className="text-[11px] px-3 h-7 rounded border border-border text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="w-full px-4 py-2.5 text-left text-sm text-primary hover:bg-primary/5 flex items-center gap-2">
              <Plus className="w-3.5 h-3.5" />
              Add floor
            </button>
          )}
        </div>
        <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
          Removed floors and their devices can be brought back with ⌘Z while this session is active.
        </div>
      </div>
    </div>
  );
}
