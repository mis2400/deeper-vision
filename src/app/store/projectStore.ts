// Single shared project store. Persists to localStorage under a versioned key
// (deeperVisionStore:v1) and exposes both granular actions (per-entity CRUD)
// and computed selectors (devicesForProject, lineForDevice, etc.).
//
// Every screen consumes this. There is no more local SEED data anywhere that
// the user can interact with — only static product catalog / nav copy / etc.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Customer, Contact, Project, Site, Building, Floor, Device, Door, Pathway, IDF, Estimate,
  EstimateLine, LensCfg, ActivityItem, ActivityType, LifecyclePhase, HealthStatus,
  Opportunity, OpportunityStage, Touch, Task,
} from './types';
import { buildSeed } from './seed';
import { PHASES, nextPhase as nextPhaseFn, previousPhase as previousPhaseFn } from '../lifecycle/phases';

/** Default probability a stage carries unless the opportunity overrides it. */
export const STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  inquiry:     0.10,
  qualified:   0.30,
  discovery:   0.45,
  proposing:   0.60,
  negotiating: 0.80,
  won:         1.00,
  lost:        0.00,
  on_hold:     0.20,
};

// ─────────────────────────── State shape ──────────────────────────
interface ProjectState {
  customers:     Record<string, Customer>;
  contacts:      Record<string, Contact>;
  projects:      Record<string, Project>;
  sites:         Record<string, Site>;
  buildings:     Record<string, Building>;
  floors:        Record<string, Floor>;
  devices:       Record<string, Device>;
  doors:         Record<string, Door>;
  pathways:      Record<string, Pathway>;
  idfs:          Record<string, IDF>;
  estimates:     Record<string, Estimate>;
  opportunities: Record<string, Opportunity>;
  touches:       Record<string, Touch>;
  tasks:         Record<string, Task>;
  activity:      Record<string, ActivityItem>;

  // ── Project actions ──
  updateProject: (id: string, patch: Partial<Project>) => void;

  // ── CRM actions ──
  updateCustomer:    (id: string, patch: Partial<Customer>) => void;

  addContact:        (c: Contact, opts?: { userName?: string }) => void;
  updateContact:     (id: string, patch: Partial<Contact>) => void;
  removeContact:     (id: string) => void;

  addOpportunity:    (o: Opportunity, opts?: { userName?: string }) => void;
  updateOpportunity: (id: string, patch: Partial<Opportunity>) => void;
  setOpportunityStage: (id: string, stage: OpportunityStage, opts?: { userName?: string; lossReason?: string }) => void;
  removeOpportunity: (id: string) => void;
  /** Convert a (typically won) opportunity into a real Project record.
   *  Returns the new project's id, or null on failure. */
  convertOpportunityToProject: (oppId: string, opts?: { userName?: string; projectName?: string; startingPhase?: LifecyclePhase }) => string | null;

  logTouch:          (t: Omit<Touch, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => string;
  removeTouch:       (id: string) => void;

  addTask:           (t: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { id?: string; status?: import('./types').TaskStatus }) => string;
  updateTask:        (id: string, patch: Partial<Task>) => void;
  completeTask:      (id: string, opts?: { userName?: string }) => void;
  snoozeTask:        (id: string, until: number) => void;
  removeTask:        (id: string) => void;

  // ── Lifecycle actions ──
  setProjectPhase:     (projectId: string, phase: LifecyclePhase, opts?: { userName?: string }) => void;
  advanceProjectPhase: (projectId: string, opts?: { userName?: string }) => LifecyclePhase | null;
  revertProjectPhase:  (projectId: string, opts?: { userName?: string }) => LifecyclePhase | null;
  setNextAction:       (projectId: string, text: string) => void;
  setProjectHealth:    (projectId: string, h: HealthStatus, opts?: { userName?: string }) => void;
  completePhaseItem:   (projectId: string, phase: LifecyclePhase, itemId: string, opts?: { userName?: string }) => void;
  uncompletePhaseItem: (projectId: string, phase: LifecyclePhase, itemId: string, opts?: { userName?: string }) => void;

  // ── Activity feed ──
  logActivity: (a: Omit<ActivityItem, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => void;

  // ── Device actions ──
  addDevice:    (d: Device, opts?: { userName?: string; log?: boolean }) => void;
  updateDevice: (id: string, patch: Partial<Device>, opts?: { userName?: string; log?: boolean }) => void;
  removeDevice: (id: string, opts?: { userName?: string; log?: boolean }) => void;

  // ── Door actions ──
  addDoor:    (d: Door) => void;
  updateDoor: (id: string, patch: Partial<Door>) => void;
  removeDoor: (id: string) => void;

  // ── Pathway actions ──
  addPathway:    (p: Pathway) => void;
  updatePathway: (id: string, patch: Partial<Pathway>) => void;
  removePathway: (id: string) => void;

  // ── IDF actions ──
  addIDF:    (i: IDF) => void;
  updateIDF: (id: string, patch: Partial<IDF>) => void;
  removeIDF: (id: string) => void;

  // ── Floor / walls ──
  updateFloor: (id: string, patch: Partial<Floor>) => void;

  // ── Reset / utility ──
  resetDemoData: () => void;
}

// Module-level counter so logActivity ids stay unique within a session
// even when fired in rapid succession (Date.now collisions on fast tests).
let _activityCounter = 0;

// ─────────────────────────── Store ────────────────────────────────
// Expose the store on window in dev for browser-console inspection. Never
// reference this in app code — UI components must use the React hook so
// re-renders work. The escape hatch is strictly for ad-hoc debugging.
declare global {
  // eslint-disable-next-line no-var
  var __projectStore: any;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      ...buildSeed(),

      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects[id]
            ? { ...s.projects, [id]: { ...s.projects[id], ...patch, updatedAt: Date.now() } }
            : s.projects,
        })),

      // ── Lifecycle ──
      setProjectPhase: (projectId, phase, opts) => {
        const prev = get().projects[projectId];
        if (!prev) return;
        const now = Date.now();
        const completed = prev.lifecyclePhase !== phase ? { phaseCompletedAt: now } : {};
        set((s) => ({
          projects: { ...s.projects, [projectId]: {
            ...prev,
            ...completed,
            lifecyclePhase: phase,
            phaseStartedAt: now,
            phaseUpdatedAt: now,
            updatedAt: now,
          } },
        }));
        if (prev.lifecyclePhase !== phase) {
          get().logActivity({
            projectId, type: 'phase_changed',
            message: `Phase advanced: ${prev.lifecyclePhase} → ${phase}`,
            userName: opts?.userName,
          });
        }
      },
      advanceProjectPhase: (projectId, opts) => {
        const p = get().projects[projectId];
        if (!p) return null;
        const next = nextPhaseFn(p.lifecyclePhase);
        if (!next) return null;
        get().setProjectPhase(projectId, next, opts);
        return next;
      },
      revertProjectPhase: (projectId, opts) => {
        const p = get().projects[projectId];
        if (!p) return null;
        const prev = previousPhaseFn(p.lifecyclePhase);
        if (!prev) return null;
        get().setProjectPhase(projectId, prev, opts);
        return prev;
      },
      setNextAction: (projectId, text) =>
        set((s) => s.projects[projectId] ? {
          projects: { ...s.projects, [projectId]: { ...s.projects[projectId], nextAction: text, phaseUpdatedAt: Date.now(), updatedAt: Date.now() } },
        } : s),
      setProjectHealth: (projectId, h, opts) => {
        const prev = get().projects[projectId];
        if (!prev) return;
        set((s) => ({
          projects: { ...s.projects, [projectId]: { ...prev, healthStatus: h, updatedAt: Date.now() } },
        }));
        if (prev.healthStatus !== h) {
          get().logActivity({ projectId, type: 'health_changed', message: `Health: ${prev.healthStatus ?? 'unset'} → ${h}`, userName: opts?.userName });
        }
      },
      completePhaseItem: (projectId, phase, itemId, opts) => {
        const p = get().projects[projectId];
        if (!p) return;
        const items = { ...(p.phaseItems ?? {}) };
        items[phase] = { ...(items[phase] ?? {}), [itemId]: true };
        set((s) => ({
          projects: { ...s.projects, [projectId]: { ...p, phaseItems: items, phaseUpdatedAt: Date.now(), updatedAt: Date.now() } },
        }));
        const label = PHASES[phase].requiredCompletionItems.find((i) => i.id === itemId)?.label ?? itemId;
        get().logActivity({ projectId, type: 'phase_item_completed', message: `Completed: ${label}`, userName: opts?.userName });
      },
      uncompletePhaseItem: (projectId, phase, itemId, opts) => {
        const p = get().projects[projectId];
        if (!p?.phaseItems?.[phase]) return;
        const phaseMap = { ...(p.phaseItems[phase] as Record<string, boolean>) };
        delete phaseMap[itemId];
        const items = { ...p.phaseItems, [phase]: phaseMap };
        set((s) => ({
          projects: { ...s.projects, [projectId]: { ...p, phaseItems: items, phaseUpdatedAt: Date.now(), updatedAt: Date.now() } },
        }));
        const label = PHASES[phase].requiredCompletionItems.find((i) => i.id === itemId)?.label ?? itemId;
        get().logActivity({ projectId, type: 'phase_item_uncompleted', message: `Un-completed: ${label}`, userName: opts?.userName });
      },

      // ── Activity ──
      logActivity: (a) => {
        _activityCounter += 1;
        const id = a.id ?? `act-${Date.now()}-${_activityCounter}`;
        const item: ActivityItem = {
          id,
          projectId: a.projectId,
          customerId: a.customerId,
          opportunityId: a.opportunityId,
          type: a.type,
          message: a.message,
          userName: a.userName,
          createdAt: a.createdAt ?? Date.now(),
          relatedEntityId: a.relatedEntityId,
        };
        set((s) => ({ activity: { ...s.activity, [id]: item } }));
      },

      // ── CRM: Customer ──
      updateCustomer: (id, patch) =>
        set((s) => s.customers[id] ? ({
          customers: { ...s.customers, [id]: { ...s.customers[id], ...patch, updatedAt: Date.now() } },
        }) : s),

      // ── CRM: Contact ──
      addContact: (c, opts) => {
        set((s) => ({ contacts: { ...s.contacts, [c.id]: c } }));
        get().logActivity({
          customerId: c.customerId, type: 'contact_added',
          message: `Added contact ${c.firstName} ${c.lastName}${c.title ? ` (${c.title})` : ''}`,
          userName: opts?.userName, relatedEntityId: c.id,
        });
      },
      updateContact: (id, patch) =>
        set((s) => s.contacts[id] ? ({
          contacts: { ...s.contacts, [id]: { ...s.contacts[id], ...patch, updatedAt: Date.now() } },
        }) : s),
      removeContact: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.contacts; return { contacts: rest }; }),

      // ── CRM: Opportunity ──
      addOpportunity: (o, opts) => {
        set((s) => ({ opportunities: { ...s.opportunities, [o.id]: o } }));
        get().logActivity({
          customerId: o.customerId, opportunityId: o.id, type: 'opportunity_created',
          message: `New opportunity: ${o.name}${o.estValue ? ` ($${Math.round(o.estValue / 1000)}k)` : ''}`,
          userName: opts?.userName, relatedEntityId: o.id,
        });
      },
      updateOpportunity: (id, patch) =>
        set((s) => s.opportunities[id] ? ({
          opportunities: { ...s.opportunities, [id]: { ...s.opportunities[id], ...patch, updatedAt: Date.now() } },
        }) : s),
      setOpportunityStage: (id, stage, opts) => {
        const prev = get().opportunities[id];
        if (!prev || prev.stage === stage) return;
        const now = Date.now();
        const closing = stage === 'won' || stage === 'lost';
        set((s) => ({
          opportunities: { ...s.opportunities, [id]: {
            ...prev,
            stage,
            // Auto-update probability unless the user has overridden it.
            probability: prev.probability != null && prev.probability !== STAGE_PROBABILITY[prev.stage]
              ? prev.probability
              : STAGE_PROBABILITY[stage],
            lossReason: stage === 'lost' ? (opts?.lossReason ?? prev.lossReason) : prev.lossReason,
            closedAt: closing ? now : prev.closedAt,
            updatedAt: now,
          } },
        }));
        const type: ActivityType =
          stage === 'won'  ? 'opportunity_won' :
          stage === 'lost' ? 'opportunity_lost' :
                             'opportunity_stage_changed';
        const message =
          stage === 'won'  ? `Closed-won: ${prev.name}${prev.estValue ? ` ($${Math.round(prev.estValue / 1000)}k)` : ''}` :
          stage === 'lost' ? `Closed-lost: ${prev.name}${opts?.lossReason ? ` · ${opts.lossReason}` : ''}` :
                             `Opportunity moved: ${prev.stage} → ${stage}`;
        get().logActivity({
          customerId: prev.customerId, opportunityId: id, type, message,
          userName: opts?.userName, relatedEntityId: id,
        });
      },
      removeOpportunity: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.opportunities; return { opportunities: rest }; }),

      convertOpportunityToProject: (oppId, opts) => {
        const opp = get().opportunities[oppId];
        if (!opp) return null;
        if (opp.wonProjectId) return opp.wonProjectId; // already converted
        // Make sure the opportunity is marked won first.
        if (opp.stage !== 'won') {
          get().setOpportunityStage(oppId, 'won', { userName: opts?.userName });
        }
        // Spawn a project shell tied back to the opportunity.
        const now = Date.now();
        const newId = `p-${oppId}-${now.toString(36).slice(-5)}`;
        const startingPhase: LifecyclePhase = opts?.startingPhase ?? 'walk_scheduled';
        const newProject: Project = {
          id: newId,
          name: opts?.projectName ?? opp.name,
          customerId: opp.customerId,
          status: 'design',
          lifecyclePhase: startingPhase,
          createdAt: now, updatedAt: now,
          phaseStartedAt: now,
          opportunityId: oppId,
          contractValue: opp.estValue,
          assignedSalesUserId: opp.ownerUserId,
          nextAction: 'Schedule the site walk',
          healthStatus: 'on_track',
          priority: 'normal',
          progress: 0,
        };
        set((s) => ({
          projects:      { ...s.projects, [newId]: newProject },
          opportunities: { ...s.opportunities, [oppId]: { ...s.opportunities[oppId], wonProjectId: newId, updatedAt: now } },
        }));
        get().logActivity({
          customerId: opp.customerId, opportunityId: oppId, projectId: newId, type: 'opportunity_converted',
          message: `Opportunity converted to project: ${newProject.name}`, userName: opts?.userName, relatedEntityId: newId,
        });
        return newId;
      },

      // ── CRM: Touch ──
      logTouch: (t) => {
        _activityCounter += 1;
        const id = t.id ?? `tch-${Date.now()}-${_activityCounter}`;
        const touch: Touch = {
          id,
          customerId: t.customerId,
          contactId: t.contactId,
          opportunityId: t.opportunityId,
          projectId: t.projectId,
          type: t.type,
          summary: t.summary,
          detail: t.detail,
          userId: t.userId,
          userName: t.userName,
          occurredAt: t.occurredAt,
          createdAt: t.createdAt ?? Date.now(),
        };
        set((s) => ({ touches: { ...s.touches, [id]: touch } }));
        get().logActivity({
          customerId: touch.customerId, opportunityId: touch.opportunityId, projectId: touch.projectId,
          type: 'touch_logged', message: `${touch.type}: ${touch.summary}`,
          userName: touch.userName, relatedEntityId: id,
        });
        return id;
      },
      removeTouch: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.touches; return { touches: rest }; }),

      // ── CRM: Task ──
      addTask: (t) => {
        _activityCounter += 1;
        const id = t.id ?? `tsk-${Date.now()}-${_activityCounter}`;
        const now = Date.now();
        const task: Task = {
          id,
          customerId: t.customerId,
          contactId: t.contactId,
          opportunityId: t.opportunityId,
          projectId: t.projectId,
          title: t.title,
          detail: t.detail,
          status: t.status ?? 'open',
          dueDate: t.dueDate,
          snoozedUntil: t.snoozedUntil,
          assignedUserId: t.assignedUserId,
          assignedUserName: t.assignedUserName,
          createdAt: now, updatedAt: now,
        };
        set((s) => ({ tasks: { ...s.tasks, [id]: task } }));
        if (task.customerId || task.projectId || task.opportunityId) {
          get().logActivity({
            customerId: task.customerId, opportunityId: task.opportunityId, projectId: task.projectId,
            type: 'task_created', message: `Task: ${task.title}`,
            userName: task.assignedUserName, relatedEntityId: id,
          });
        }
        return id;
      },
      updateTask: (id, patch) =>
        set((s) => s.tasks[id] ? ({
          tasks: { ...s.tasks, [id]: { ...s.tasks[id], ...patch, updatedAt: Date.now() } },
        }) : s),
      completeTask: (id, opts) => {
        const prev = get().tasks[id];
        if (!prev) return;
        const now = Date.now();
        set((s) => ({
          tasks: { ...s.tasks, [id]: { ...prev, status: 'done', completedAt: now, updatedAt: now } },
        }));
        get().logActivity({
          customerId: prev.customerId, opportunityId: prev.opportunityId, projectId: prev.projectId,
          type: 'task_completed', message: `Task done: ${prev.title}`,
          userName: opts?.userName ?? prev.assignedUserName, relatedEntityId: id,
        });
      },
      snoozeTask: (id, until) =>
        set((s) => s.tasks[id] ? ({
          tasks: { ...s.tasks, [id]: { ...s.tasks[id], status: 'snoozed', snoozedUntil: until, updatedAt: Date.now() } },
        }) : s),
      removeTask: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.tasks; return { tasks: rest }; }),

      addDevice: (d, opts) => {
        set((s) => ({ devices: { ...s.devices, [d.id]: d } }));
        if (opts?.log !== false) get().logActivity({ projectId: d.projectId, type: 'device_added', message: `Added ${d.label || d.id} (${d.type})`, userName: opts?.userName, relatedEntityId: d.id });
      },
      updateDevice: (id, patch, opts) => {
        const prev = get().devices[id];
        if (!prev) return;
        set((s) => ({ devices: { ...s.devices, [id]: { ...prev, ...patch } } }));
        // Only log meaningful movements to avoid spamming the feed during drag.
        // Heuristic: log when x/y delta > 8 px OR when rot/fov/range changes by
        // a meaningful chunk OR when notes change.
        if (opts?.log === false) return;
        const movedFar = patch.x !== undefined && Math.abs(patch.x - prev.x) > 8;
        const notesChanged = patch.notes !== undefined && patch.notes !== prev.notes;
        if (movedFar) {
          get().logActivity({ projectId: prev.projectId, type: 'device_moved', message: `Moved ${id}`, userName: opts?.userName, relatedEntityId: id });
        } else if (notesChanged) {
          get().logActivity({ projectId: prev.projectId, type: 'note_added', message: `Note on ${id}: ${(patch.notes ?? '').slice(0, 80)}`, userName: opts?.userName, relatedEntityId: id });
        }
      },
      removeDevice: (id, opts) => {
        const prev = get().devices[id];
        set((s) => { const { [id]: _, ...rest } = s.devices; return { devices: rest }; });
        if (prev && opts?.log !== false) get().logActivity({ projectId: prev.projectId, type: 'device_removed', message: `Removed ${id}`, userName: opts?.userName, relatedEntityId: id });
      },

      addDoor: (d) => set((s) => ({ doors: { ...s.doors, [d.id]: d } })),
      updateDoor: (id, patch) =>
        set((s) => (s.doors[id] ? { doors: { ...s.doors, [id]: { ...s.doors[id], ...patch } } } : s)),
      removeDoor: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.doors; return { doors: rest }; }),

      addPathway: (p) => set((s) => ({ pathways: { ...s.pathways, [p.id]: p } })),
      updatePathway: (id, patch) =>
        set((s) => (s.pathways[id] ? { pathways: { ...s.pathways, [id]: { ...s.pathways[id], ...patch } } } : s)),
      removePathway: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.pathways; return { pathways: rest }; }),

      addIDF: (i) => set((s) => ({ idfs: { ...s.idfs, [i.id]: i } })),
      updateIDF: (id, patch) =>
        set((s) => (s.idfs[id] ? { idfs: { ...s.idfs, [id]: { ...s.idfs[id], ...patch } } } : s)),
      removeIDF: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.idfs; return { idfs: rest }; }),

      updateFloor: (id, patch) =>
        set((s) => (s.floors[id] ? { floors: { ...s.floors, [id]: { ...s.floors[id], ...patch } } } : s)),

      resetDemoData: () => set(() => ({ ...buildSeed() })),
    }),
    {
      name: 'deeperVisionStore',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // Migration hook — v1 (pre-CRM) → v2: flatten Customer.contacts into the
      // top-level contacts slice and ensure the new opportunities/touches/tasks
      // slices exist so v1-persisted state doesn't blow up the new selectors.
      migrate: (persisted: any, version: number) => {
        if (!persisted) return persisted;
        if (version < 2) {
          const customers: Record<string, any> = {};
          const contacts:  Record<string, any> = persisted.contacts ?? {};
          if (persisted.customers) {
            for (const [cid, raw] of Object.entries(persisted.customers as Record<string, any>)) {
              const { contacts: inline = [], ...rest } = raw;
              customers[cid] = rest;
              for (const ec of inline) {
                if (!ec?.id) continue;
                // Map old shape { id, name, role, email, phone } → new Contact.
                const [first, ...restName] = (ec.name ?? '').split(' ');
                contacts[ec.id] = {
                  id: ec.id,
                  customerId: cid,
                  firstName: first ?? ec.name ?? '',
                  lastName:  restName.join(' '),
                  title:     ec.role,
                  email:     ec.email,
                  phone:     ec.phone,
                  isPrimary: !contacts[`__primary-set-${cid}`],
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                };
                contacts[`__primary-set-${cid}`] = true as any;
              }
            }
            // Strip the sentinel markers we used to claim the primary.
            for (const k of Object.keys(contacts)) if (k.startsWith('__primary-set-')) delete contacts[k];
            persisted.customers = customers;
            persisted.contacts  = contacts;
          }
          persisted.opportunities ??= {};
          persisted.touches       ??= {};
          persisted.tasks         ??= {};
        }
        return persisted;
      },
      // Only persist data slices, not action references (those are on every
      // hydrate anyway).
      partialize: (s) => ({
        customers:     s.customers,
        contacts:      s.contacts,
        projects:      s.projects,
        sites:         s.sites,
        buildings:     s.buildings,
        floors:        s.floors,
        devices:       s.devices,
        doors:         s.doors,
        pathways:      s.pathways,
        idfs:          s.idfs,
        estimates:     s.estimates,
        opportunities: s.opportunities,
        touches:       s.touches,
        tasks:         s.tasks,
        activity:      s.activity,
      }),
    },
  ),
);

if (typeof window !== 'undefined') {
  (globalThis as any).__projectStore = useProjectStore;
}

// ─────────────────────────── Selectors ────────────────────────────
// These are plain functions over the snapshot so callers can compose them
// without forcing component re-renders on unrelated state. Use with
// useProjectStore(useShallow(s => ...)) or call selectors directly from
// store.getState() in non-React code paths.

export const selectors = {
  /** All projects, newest first. */
  projectList: (s: ProjectState): Project[] =>
    Object.values(s.projects).sort((a, b) => b.updatedAt - a.updatedAt),

  /** First floor of a project (used by the canvas when the user hasn't picked a floor). */
  firstFloorOfProject: (s: ProjectState, projectId: string): Floor | null => {
    const site = Object.values(s.sites).find((x) => x.projectId === projectId);
    if (!site) return null;
    const building = Object.values(s.buildings).find((b) => b.siteId === site.id);
    if (!building) return null;
    return Object.values(s.floors).find((f) => f.buildingId === building.id) ?? null;
  },

  floorsForProject: (s: ProjectState, projectId: string): Floor[] => {
    const site = Object.values(s.sites).find((x) => x.projectId === projectId);
    if (!site) return [];
    const buildings = Object.values(s.buildings).filter((b) => b.siteId === site.id);
    const ids = new Set(buildings.map((b) => b.id));
    return Object.values(s.floors).filter((f) => ids.has(f.buildingId));
  },

  /** All devices belonging to a project (any floor). */
  devicesForProject: (s: ProjectState, projectId: string): Device[] =>
    Object.values(s.devices).filter((d) => d.projectId === projectId),

  /** Devices on a specific floor (canvas drilldown). */
  devicesForFloor: (s: ProjectState, floorId: string): Device[] =>
    Object.values(s.devices).filter((d) => d.floorId === floorId),

  doorsForFloor: (s: ProjectState, floorId: string): Door[] =>
    Object.values(s.doors).filter((d) => d.floorId === floorId),

  pathwaysForFloor: (s: ProjectState, floorId: string): Pathway[] =>
    Object.values(s.pathways).filter((p) => p.floorId === floorId),

  idfsForFloor: (s: ProjectState, floorId: string): IDF[] =>
    Object.values(s.idfs).filter((i) => i.floorId === floorId),

  pathwaysForProject: (s: ProjectState, projectId: string): Pathway[] =>
    Object.values(s.pathways).filter((p) => p.projectId === projectId),

  idfsForProject: (s: ProjectState, projectId: string): IDF[] =>
    Object.values(s.idfs).filter((i) => i.projectId === projectId),

  estimateForProject: (s: ProjectState, projectId: string): Estimate | null =>
    Object.values(s.estimates).find((e) => e.projectId === projectId) ?? null,

  /** Project activity feed, newest first. */
  activityForProject: (s: ProjectState, projectId: string, limit = 50): ActivityItem[] =>
    Object.values(s.activity)
      .filter((a) => a.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit),

  // ── CRM selectors ──
  contactsForCustomer: (s: ProjectState, customerId: string): Contact[] =>
    Object.values(s.contacts).filter((c) => c.customerId === customerId),

  primaryContactForCustomer: (s: ProjectState, customerId: string): Contact | undefined => {
    const customer = s.customers[customerId];
    if (customer?.primaryContactId) return s.contacts[customer.primaryContactId];
    return Object.values(s.contacts).find((c) => c.customerId === customerId && c.isPrimary)
      ?? Object.values(s.contacts).find((c) => c.customerId === customerId);
  },

  opportunitiesForCustomer: (s: ProjectState, customerId: string): Opportunity[] =>
    Object.values(s.opportunities)
      .filter((o) => o.customerId === customerId)
      .sort((a, b) => b.updatedAt - a.updatedAt),

  opportunitiesByStage: (s: ProjectState, stage: OpportunityStage): Opportunity[] =>
    Object.values(s.opportunities)
      .filter((o) => o.stage === stage)
      .sort((a, b) => b.updatedAt - a.updatedAt),

  projectsForCustomer: (s: ProjectState, customerId: string): Project[] =>
    Object.values(s.projects)
      .filter((p) => p.customerId === customerId)
      .sort((a, b) => b.updatedAt - a.updatedAt),

  touchesForCustomer: (s: ProjectState, customerId: string, limit = 50): Touch[] =>
    Object.values(s.touches)
      .filter((t) => t.customerId === customerId)
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, limit),

  touchesForOpportunity: (s: ProjectState, opportunityId: string, limit = 50): Touch[] =>
    Object.values(s.touches)
      .filter((t) => t.opportunityId === opportunityId)
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, limit),

  tasksForCustomer: (s: ProjectState, customerId: string): Task[] =>
    Object.values(s.tasks)
      .filter((t) => t.customerId === customerId)
      .sort(taskSort),

  tasksForUser: (s: ProjectState, userId: string): Task[] =>
    Object.values(s.tasks)
      .filter((t) => t.assignedUserId === userId)
      .sort(taskSort),

  openTasksForUser: (s: ProjectState, userId: string): Task[] =>
    Object.values(s.tasks)
      .filter((t) => t.assignedUserId === userId && t.status === 'open')
      .sort(taskSort),

  /** Activity scoped to a customer — includes events explicitly tagged with
   *  customerId and those whose projectId belongs to the customer. */
  activityForCustomer: (s: ProjectState, customerId: string, limit = 50): ActivityItem[] => {
    const projectIds = new Set(
      Object.values(s.projects).filter((p) => p.customerId === customerId).map((p) => p.id),
    );
    return Object.values(s.activity)
      .filter((a) => a.customerId === customerId || (a.projectId && projectIds.has(a.projectId)))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },

  /** Pipeline totals. Sum of estValue across open opportunities and
   *  probability-weighted forecast across the same set. */
  pipelineSummary: (s: ProjectState): { open: number; weighted: number; openCount: number; wonThisQuarter: number } => {
    const all = Object.values(s.opportunities);
    let open = 0, weighted = 0, openCount = 0, wonThisQuarter = 0;
    const qStart = quarterStart(Date.now());
    for (const o of all) {
      if (o.stage === 'won' && o.closedAt && o.closedAt >= qStart) wonThisQuarter += o.estValue ?? 0;
      if (o.stage === 'won' || o.stage === 'lost') continue;
      open += o.estValue ?? 0;
      weighted += (o.estValue ?? 0) * (o.probability ?? STAGE_PROBABILITY[o.stage]);
      openCount += 1;
    }
    return { open, weighted, openCount, wonThisQuarter };
  },
};

/** Order tasks: overdue first (oldest due first), then upcoming by due date,
 *  then no-due, then snoozed/done. */
function taskSort(a: Task, b: Task): number {
  const score = (t: Task) => {
    if (t.status === 'done')   return 1e15;
    if (t.status === 'snoozed') return 1e14 + (t.snoozedUntil ?? 0);
    if (t.dueDate == null)     return 1e10;
    return t.dueDate;
  };
  return score(a) - score(b);
}

function quarterStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime();
}

// ─────────────────────────── Migration helpers ────────────────────
// In case localStorage carries a project whose lifecyclePhase value uses an
// older string ("bom-review", "scheduled-walk", "customer-revision",
// "managed-service") we transparently normalize it on every read via the
// existing partialize roundtrip. For now we just ensure projects on hydration
// have the seed defaults; a full migrate fn would live here when schema bumps.

// ─────────────────────────── BOM derivation ───────────────────────
// Live-compute estimate lines from the devices/doors/pathways/idfs on a
// project. Called by /estimate/:id (and any other screen that needs a BOM).
// This is intentionally NOT persisted — it derives every time so the canvas
// is always the source of truth.
const UNIT_PRICE: Record<string, { price: number; labor: number; desc: string }> = {
  'cam.bullet':      { price:  849, labor: 1.5,  desc: 'Bullet camera' },
  'cam.dome':        { price:  625, labor: 1.25, desc: 'Dome camera' },
  'cam.ptz':         { price: 3299, labor: 2.5,  desc: 'PTZ camera' },
  'cam.multisensor': { price: 2895, labor: 2.5,  desc: 'Multisensor camera' },
  'cam.fisheye':     { price: 1480, labor: 1.5,  desc: 'Fisheye camera' },
  'cam.thermal':     { price: 4250, labor: 2.0,  desc: 'Thermal camera' },
  'cam.lpr':         { price: 2199, labor: 2.0,  desc: 'LPR camera' },
  'cam.body':        { price:  950, labor: 1.25, desc: 'Body / dome camera' },
  'acc.reader':      { price:  285, labor: 0.75, desc: 'Card / mobile reader' },
  'acc.strike':      { price:  540, labor: 1.5,  desc: 'Electric strike' },
  'acc.maglock':     { price:  245, labor: 1.0,  desc: 'Magnetic lock' },
  'acc.rex':         { price:  215, labor: 0.5,  desc: 'REX motion' },
  'acc.exit':        { price:  845, labor: 1.5,  desc: 'Exit device' },
  'acc.door':        { price:    0, labor: 0,    desc: 'Door (no hardware)' },
  'acc.gate':        { price: 2400, labor: 4.0,  desc: 'Gate operator' },
  'acc.biometric':   { price: 1395, labor: 1.5,  desc: 'Biometric reader' },
  'net.idf':         { price:    0, labor: 0,    desc: 'IDF (cabinet billed separately)' },
  'net.mdf':         { price:    0, labor: 0,    desc: 'MDF (cabinet billed separately)' },
  'net.switch':      { price: 4400, labor: 3.0,  desc: 'PoE switch (48 port)' },
  'net.ap':          { price:  280, labor: 1.0,  desc: 'Wireless AP' },
  'net.firewall':    { price: 2200, labor: 2.0,  desc: 'Firewall' },
  'net.bridge':      { price:  650, labor: 1.5,  desc: 'Wireless bridge' },
  'net.fiber':       { price:    0, labor: 0,    desc: 'Fiber link' },
  'net.copper':      { price:    0, labor: 0,    desc: 'Copper link' },
  'net.wireless':    { price:    0, labor: 0,    desc: 'Wireless link' },
  'pwr.ups':         { price: 1620, labor: 1.5,  desc: 'UPS battery backup' },
  'pwr.poe':         { price:  425, labor: 0.5,  desc: 'PoE injector / power supply' },
  'pwr.surge':       { price:  185, labor: 0.5,  desc: 'Surge suppressor' },
  'pwr.solar':       { price: 2900, labor: 3.0,  desc: 'Solar power kit' },
  'sen.motion':      { price:  165, labor: 0.75, desc: 'Motion sensor' },
  'sen.glass':       { price:   88, labor: 0.5,  desc: 'Glass-break sensor' },
  'sen.contact':     { price:   22, labor: 0.25, desc: 'Door/window contact' },
  'sen.panic':       { price:  120, labor: 0.5,  desc: 'Panic button' },
  'sen.smoke':       { price:   95, labor: 0.5,  desc: 'Smoke detector' },
  'aud.speaker':     { price:  145, labor: 1.0,  desc: 'Ceiling speaker' },
  'aud.intercom':    { price:  720, labor: 1.5,  desc: 'Intercom' },
  'aud.horn':        { price:  615, labor: 1.0,  desc: 'IP horn / talk-down' },
  'aud.amp':         { price:  985, labor: 1.5,  desc: 'Audio amplifier' },
  'sto.nvr':         { price: 6890, labor: 3.0,  desc: 'NVR' },
  'sto.cloud':       { price: 1200, labor: 0.5,  desc: 'Cloud recorder' },
  'sto.server':      { price:12500, labor: 4.0,  desc: 'AI / VMS server' },
  'dis.monitor':     { price:  450, labor: 0.5,  desc: 'Monitor' },
  'dis.video-wall':  { price: 8400, labor: 4.0,  desc: 'Video wall' },
  'dis.kiosk':       { price: 2200, labor: 2.0,  desc: 'Kiosk' },
};

const CABLE_UNIT_PRICE: Record<string, number> = {
  'cat6':       0.42,
  'cat6a':      0.78,
  'fiber-sm':   1.85,
  'fiber-mm':   1.65,
  'coax':       0.55,
  'power':      0.30,
  'composite':  1.40,
};

/** Compute estimate line items live from a project's current devices, doors,
 *  pathways, and IDFs. Returns lines + headline totals. Pure function — safe
 *  to call inside React render. */
export function deriveBOM(state: ProjectState, projectId: string): {
  lines: EstimateLine[];
  hardwareTotal: number;
  laborHours: number;
  laborTotal: number;
  cableTotal: number;
  total: number;
} {
  const project = state.projects[projectId];
  const laborRate = state.estimates[`est-${projectId}`]?.laborRate ?? 95;
  const markup = state.estimates[`est-${projectId}`]?.markup ?? 0.18;

  const devices = selectors.devicesForProject(state, projectId);
  const doors = Object.values(state.doors).filter((d) => d.projectId === projectId);
  const pathways = selectors.pathwaysForProject(state, projectId);
  const idfs = selectors.idfsForProject(state, projectId);

  // Group devices by type → one line per type with summed qty.
  const byType = new Map<string, { qty: number; price: number; labor: number; desc: string }>();
  for (const d of devices) {
    const meta = UNIT_PRICE[d.type] ?? { price: 0, labor: 0, desc: d.type };
    const prev = byType.get(d.type) ?? { qty: 0, price: meta.price, labor: meta.labor, desc: meta.desc };
    prev.qty += 1;
    byType.set(d.type, prev);
  }

  const lines: EstimateLine[] = [];

  byType.forEach((agg, type) => {
    lines.push({
      id: `dev-${projectId}-${type}`,
      sourceKind: 'device',
      sku: type,
      description: agg.desc,
      qty: agg.qty,
      uom: 'ea',
      unitPrice: agg.price,
      laborHours: agg.labor * agg.qty,
    });
  });

  // Doors → one line each (so hardware can vary). Sum hardware unit prices.
  for (const door of doors) {
    const hwSum = door.hardware.reduce((acc, h) => {
      const meta = UNIT_PRICE[(`acc.${h}`) as keyof typeof UNIT_PRICE] ?? { price: 0, labor: 0 };
      return { price: acc.price + meta.price, labor: acc.labor + meta.labor };
    }, { price: 0, labor: 0 });
    lines.push({
      id: `door-${door.id}`,
      sourceKind: 'door',
      sourceId: door.id,
      sku: `door:${door.doorType}`,
      description: `Door · ${door.doorType} · hardware: ${door.hardware.join(', ') || 'none'}`,
      qty: 1, uom: 'ea',
      unitPrice: hwSum.price,
      laborHours: hwSum.labor,
    });
  }

  // Pathways → cable feet + small conduit allocation.
  const pxPerFt = 20; // matches canvas scale; will be replaced when /calibrate is wired.
  for (const p of pathways) {
    let lengthPx = 0;
    for (let i = 1; i < p.points.length; i++) {
      lengthPx += Math.hypot(p.points[i].x - p.points[i - 1].x, p.points[i].y - p.points[i - 1].y);
    }
    const ft = p.lengthFt ?? Math.round(lengthPx / pxPerFt);
    const unitFt = CABLE_UNIT_PRICE[p.cableType] ?? 0.5;
    lines.push({
      id: `pw-${p.id}-cable`,
      sourceKind: 'pathway',
      sourceId: p.id,
      sku: `cable:${p.cableType}`,
      description: `${p.cableType.toUpperCase()} · ${p.cableCount}× · ${ft} ft`,
      qty: ft * p.cableCount,
      uom: 'ft',
      unitPrice: unitFt,
      laborHours: ft * 0.02 * p.cableCount, // ~1.2 min per ft per pull
    });
  }

  // IDFs → switch + UPS allocations.
  for (const idf of idfs) {
    for (const sw of idf.switches ?? []) {
      lines.push({
        id: `idf-${idf.id}-sw-${sw.model}`,
        sourceKind: 'idf',
        sourceId: idf.id,
        sku: sw.model,
        description: `${sw.model} · ${sw.portsTotal} ports`,
        qty: 1, uom: 'ea',
        unitPrice: UNIT_PRICE['net.switch'].price,
        laborHours: UNIT_PRICE['net.switch'].labor,
      });
    }
    if (idf.power?.upsModel) {
      lines.push({
        id: `idf-${idf.id}-ups`,
        sourceKind: 'idf',
        sourceId: idf.id,
        sku: idf.power.upsModel,
        description: `${idf.power.upsModel} · ~${idf.power.upsRuntimeMin ?? 30} min runtime`,
        qty: 1, uom: 'ea',
        unitPrice: UNIT_PRICE['pwr.ups'].price,
        laborHours: UNIT_PRICE['pwr.ups'].labor,
      });
    }
  }

  // Totals
  const hardwareTotal = lines.filter((l) => l.sourceKind !== 'pathway').reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const cableTotal = lines.filter((l) => l.sourceKind === 'pathway').reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const laborHours = lines.reduce((s, l) => s + (l.laborHours ?? 0), 0);
  const laborTotal = laborHours * laborRate;
  const total = (hardwareTotal + cableTotal + laborTotal) * (1 + markup);

  void project; // silence unused if we don't surface project name here
  return { lines, hardwareTotal, cableTotal, laborHours, laborTotal, total };
}
