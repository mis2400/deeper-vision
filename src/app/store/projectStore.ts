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
  Scenario, ScenarioZone, ScenarioRun, ProtocolStep, ScenarioGap,
  Bus, BusCamera, BusDVR, BusCableRoute, BusEventInput, BusCommissioningCheck,
  EstimateLine, LensCfg, ActivityItem, ActivityType, LifecyclePhase, HealthStatus,
  Opportunity, OpportunityStage, Touch, Task,
  ProjectMode, UserRole, EngineeringLayer, CanvasLayerState, DEFAULT_CANVAS_LAYERS,
  CanvasDisplayPrefs, DEFAULT_DISPLAY_PREFS, ProjectTechModel,
  SurveyItem, SurveyObjectType,
} from './types';
import { buildSeed } from './seed';
import { PHASES, nextPhase as nextPhaseFn, previousPhase as previousPhaseFn } from '../lifecycle/phases';
import { pathwayLengthFt, ftPerPxForFloor } from '../lib/engineering';

/** Map a lifecycle phase to its default operational mode. Used when no
 *  user override is set on a project. */
export function defaultModeForPhase(phase: LifecyclePhase): ProjectMode {
  switch (phase) {
    case 'lead': case 'discovery': case 'walk_scheduled':
      return 'survey';
    case 'survey':
      return 'survey';
    case 'engineering':
      return 'engineering';
    case 'estimate':
      return 'estimate';
    case 'proposal': case 'customer_review': case 'approved':
      return 'proposal';
    case 'deployment': case 'commissioning':
      return 'deployment';
    case 'completed': case 'managed_service': case 'support': case 'archived':
      return 'service';
  }
}

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
  /** Field-deployment work order progress. Keyed by the derived WO id
   *  (`wo-${kind}-${sourceId}`). The full WorkOrder shape is re-derived
   *  from canvas state via `deriveWorkOrders`; this slice carries only
   *  the mutable progress (status, completed checklist, photos, etc.). */
  workOrderProgress: Record<string, import('./types').WorkOrderProgress>;
  /** Per-project pricebook overrides. Keyed by projectId. Each
   *  entry can override door-hardware unit prices + labor, cable per-ft
   *  prices, and the project's labor rate + markup. Empty entries fall
   *  through to defaults so the absence of a pricebook == legacy
   *  behaviour. */
  projectPricebooks: Record<string, import('./types').ProjectPricebook>;
  /** Attachments — single shared slice keyed by attachment id. Each
   *  entry carries projectId + linkedObjectType/Id so the
   *  AttachmentPanel can scope lookups per device/door/pathway/WO
   *  without forcing per-entity arrays into other shapes. */
  attachments: Record<string, import('./types').Attachment>;
  // ── Threat Drill Simulator ──
  scenarios:     Record<string, Scenario>;
  // ── Bus Security Designer ──
  buses:         Record<string, Bus>;
  busCameras:    Record<string, BusCamera>;
  busDVRs:       Record<string, BusDVR>;
  busCableRoutes:Record<string, BusCableRoute>;
  busEvents:     Record<string, BusEventInput>;
  busChecks:     Record<string, BusCommissioningCheck>;
  opportunities: Record<string, Opportunity>;
  touches:       Record<string, Touch>;
  tasks:         Record<string, Task>;
  activity:      Record<string, ActivityItem>;
  /** Object-linked survey notes / checklist items captured on-site.
   *  Each item points at a Device / Door / Pathway / IDF / Floor. */
  surveyItems:   Record<string, SurveyItem>;

  // ── UX preferences ──
  /** Per-project mode override. When unset, mode is derived from
   *  the project's lifecycle phase via defaultModeForPhase. */
  projectModes: Record<string, ProjectMode>;
  /** Per-project canvas layer visibility. Defaults to DEFAULT_CANVAS_LAYERS
   *  on first read. */
  canvasLayers: Record<string, CanvasLayerState>;
  /** Per-project display preferences (icon size, label density, base map,
   *  coverage opacity). Defaults to DEFAULT_DISPLAY_PREFS on first read. */
  canvasDisplay: Record<string, CanvasDisplayPrefs>;
  /** Per-project tech model — drives manufacturer / product filtering.
   *  When unset, defaults to 'hybrid'. */
  projectTechModels: Record<string, ProjectTechModel>;
  /** Global current-user role preference. Defaults to 'engineer'. */
  currentRole: UserRole;
  /** Surveyor canvas theme: light drafting / slate engineering / dark
   *  command. Persists across sessions; default = 'slate' so the canvas
   *  is no longer the darkest possible surface. */
  canvasTheme: 'light' | 'slate' | 'dark';

  // ── Project actions ──
  /** Create a new project. Caller supplies the full record (including id +
   *  createdAt/updatedAt). Use alongside addSite/addBuilding/addFloor when
   *  spinning up a project from intake. */
  addProject:    (p: Project) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;

  // ── UX preference actions ──
  setProjectMode:    (projectId: string, mode: ProjectMode | null) => void;
  setUserRole:       (role: UserRole) => void;
  setCanvasTheme:    (theme: 'light' | 'slate' | 'dark') => void;
  setCanvasLayer:    (projectId: string, layer: EngineeringLayer, on: boolean) => void;
  setCanvasLayers:   (projectId: string, patch: Partial<CanvasLayerState>) => void;
  resetCanvasLayers: (projectId: string) => void;

  setCanvasDisplay:  (projectId: string, patch: Partial<CanvasDisplayPrefs>) => void;
  resetCanvasDisplay:(projectId: string) => void;

  setProjectTechModel: (projectId: string, model: ProjectTechModel) => void;

  // ── CRM actions ──
  /** Create a customer. Caller supplies id + addresses; createdAt/updatedAt
   *  are stamped if omitted. */
  addCustomer:       (c: Customer) => void;
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

  // ── Site / Building / Floor / walls ──
  /** Create a site under a project. */
  addSite:     (s: Site) => void;
  /** Create a building under a site. */
  addBuilding: (b: Building) => void;
  updateFloor: (id: string, patch: Partial<Floor>) => void;

  // ── Survey capture ──
  /** Add a survey note / checklist item bound to a canvas object.
   *  When `id` is omitted, the store generates one. Returns the id. */
  addSurveyItem:    (item: Omit<SurveyItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => string;
  updateSurveyItem: (id: string, patch: Partial<SurveyItem>) => void;
  removeSurveyItem: (id: string) => void;

  // ── Threat Drill ──
  addScenario:    (s: Scenario) => void;
  updateScenario: (id: string, patch: Partial<Scenario>) => void;
  removeScenario: (id: string) => void;
  /** Recompute gaps + readiness for a scenario from current project state. */
  recomputeScenario: (id: string) => void;

  // ── Bus Security ──
  addBus:    (b: Bus) => void;
  updateBus: (id: string, patch: Partial<Bus>) => void;
  removeBus: (id: string) => void;
  addBusCamera:     (c: BusCamera) => void;
  updateBusCamera:  (id: string, patch: Partial<BusCamera>) => void;
  removeBusCamera:  (id: string) => void;
  addBusDVR:        (d: BusDVR) => void;
  updateBusDVR:     (id: string, patch: Partial<BusDVR>) => void;
  removeBusDVR:     (id: string) => void;
  addBusCableRoute: (c: BusCableRoute) => void;
  removeBusCableRoute: (id: string) => void;
  addBusEvent:      (e: BusEventInput) => void;
  removeBusEvent:   (id: string) => void;
  updateBusCheck:   (id: string, patch: Partial<BusCommissioningCheck>) => void;
  /** Seed the standard 11-step commissioning checklist for a bus. */
  seedBusCommissioning: (busId: string) => void;
  /** Add a floor (used by Add Floor Map and VisionScan import). The
   *  buildingId is required so the canvas's site/building/floor selector
   *  can pick it up. */
  addFloor: (floor: Floor) => void;
  /** Bulk-replace walls on a floor (used by VisionScan import which writes
   *  a generated set of walls). */
  setFloorWalls: (floorId: string, walls: Floor['walls']) => void;
  /** Set or clear the floor background (imported PNG/JPG/PDF or generated). */
  setFloorBackground: (floorId: string, bg: Floor['background'] | null) => void;

  // ── Project pricebook actions ──
  /** Override one door-hardware unit's price or labor. Pass `undefined`
   *  to clear that field; pass `null` for the whole patch to drop the
   *  hardware override entirely (falls back to the default). */
  setPricebookDoorHardware: (
    projectId: string,
    hw: import('./types').DoorHardware,
    patch: import('./types').DoorHardwarePricebookEntry | null,
  ) => void;
  /** Override the per-foot price for a cable type. Pass `null` to clear. */
  setPricebookCablePerFt: (projectId: string, cableType: string, pricePerFt: number | null) => void;
  /** Override the project labor rate ($/hr). Pass `null` to clear. */
  setPricebookLaborRate: (projectId: string, rate: number | null) => void;
  /** Override the project markup (0..1). Pass `null` to clear. */
  setPricebookMarkup: (projectId: string, markup: number | null) => void;
  /** Clear ALL pricebook overrides for the project. */
  resetPricebook: (projectId: string) => void;

  // ── Attachment actions ──
  /** Persist a new attachment. Caller supplies the full record (id,
   *  projectId, linked object, fileName, etc.). */
  addAttachment: (a: import('./types').Attachment) => void;
  /** Patch an attachment. Stamps `updatedAt`. */
  updateAttachment: (id: string, patch: Partial<import('./types').Attachment>) => void;
  /** Remove an attachment by id. No-op when missing. */
  removeAttachment: (id: string) => void;

  // ── Project state export / import (shared-demo sync) ──
  /** Replace this project's slice of the store with the contents of an
   *  exported envelope. Other projects' state is preserved. Throws if
   *  the envelope kind/version doesn't match. */
  importProjectState: (envelope: import('./types').ProjectStateEnvelope) => void;

  // ── Field deployment / work order actions ──
  /** Patch the persisted progress for a derived work order. The progress
   *  record is created on first write; `updatedAt` is stamped on every
   *  call. WorkOrders are derived from canvas state each render, so only
   *  the progress here is persisted. */
  patchWorkOrderProgress: (woId: string, patch: Partial<import('./types').WorkOrderProgress>) => void;
  /** Toggle a single checklist item by id within a work order. */
  toggleWorkOrderChecklist: (woId: string, itemId: string) => void;
  /** Set the WO's status. When flipping to 'blocked', the previous status
   *  is stashed so unblocking restores it. */
  setWorkOrderStatus: (woId: string, status: import('./types').WorkOrderStatus) => void;
  /** Add a placeholder photo entry. We capture filename + optional size +
   *  optional tag, no real blob — file uploads land with backend work. */
  addWorkOrderPhotoPlaceholder: (woId: string, photo: { fileName: string; sizeKb?: number; tag?: string }) => void;
  removeWorkOrderPhotoPlaceholder: (woId: string, photoId: string) => void;

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

      // UX prefs default state — populated lazily per project.
      projectModes:      {},
      canvasLayers:      {},
      canvasDisplay:     {},
      projectTechModels: {},
      currentRole:       'engineer',
      canvasTheme:       'light',
      workOrderProgress: {},
      projectPricebooks: {},
      attachments:       {},

      // ── UX preference actions ──
      setProjectMode: (projectId, mode) =>
        set((s) => {
          const next = { ...s.projectModes };
          if (mode == null) delete next[projectId];
          else              next[projectId] = mode;
          return { projectModes: next };
        }),
      setUserRole: (role) => set(() => ({ currentRole: role })),
      setCanvasTheme: (theme) => set(() => ({ canvasTheme: theme })),
      setCanvasLayer: (projectId, layer, on) =>
        set((s) => ({
          canvasLayers: {
            ...s.canvasLayers,
            [projectId]: { ...DEFAULT_CANVAS_LAYERS, ...s.canvasLayers[projectId], [layer]: on },
          },
        })),
      setCanvasLayers: (projectId, patch) =>
        set((s) => ({
          canvasLayers: {
            ...s.canvasLayers,
            [projectId]: { ...DEFAULT_CANVAS_LAYERS, ...s.canvasLayers[projectId], ...patch },
          },
        })),
      resetCanvasLayers: (projectId) =>
        set((s) => {
          const { [projectId]: _, ...rest } = s.canvasLayers;
          return { canvasLayers: rest };
        }),
      setCanvasDisplay: (projectId, patch) =>
        set((s) => ({
          canvasDisplay: {
            ...s.canvasDisplay,
            [projectId]: { ...DEFAULT_DISPLAY_PREFS, ...s.canvasDisplay[projectId], ...patch },
          },
        })),
      resetCanvasDisplay: (projectId) =>
        set((s) => {
          const { [projectId]: _, ...rest } = s.canvasDisplay;
          return { canvasDisplay: rest };
        }),
      setProjectTechModel: (projectId, model) =>
        set((s) => ({
          projectTechModels: { ...s.projectTechModels, [projectId]: model },
        })),

      addProject: (p) =>
        set((s) => ({ projects: { ...s.projects, [p.id]: p } })),
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
      addCustomer: (c) =>
        set((s) => ({ customers: { ...s.customers, [c.id]: c } })),
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

      addSite: (st) =>
        set((s) => ({ sites: { ...s.sites, [st.id]: st } })),
      addBuilding: (b) =>
        set((s) => ({ buildings: { ...s.buildings, [b.id]: b } })),
      updateFloor: (id, patch) =>
        set((s) => (s.floors[id] ? { floors: { ...s.floors, [id]: { ...s.floors[id], ...patch } } } : s)),
      addFloor: (floor) => set((s) => ({ floors: { ...s.floors, [floor.id]: floor } })),
      setFloorWalls: (floorId, walls) =>
        set((s) => (s.floors[floorId] ? { floors: { ...s.floors, [floorId]: { ...s.floors[floorId], walls } } } : s)),
      setFloorBackground: (floorId, bg) =>
        set((s) => (s.floors[floorId] ? { floors: { ...s.floors, [floorId]: { ...s.floors[floorId], background: bg ?? undefined } } } : s)),

      // ── Survey capture ──────────────────────────────────────────
      addSurveyItem: (input) => {
        _activityCounter += 1;
        const now = Date.now();
        const id = input.id ?? `srv-${now.toString(36).slice(-5)}-${_activityCounter}`;
        const item: SurveyItem = {
          id,
          projectId: input.projectId,
          floorId: input.floorId,
          objectType: input.objectType,
          objectId: input.objectId,
          kind: input.kind ?? 'note',
          text: input.text,
          status: input.status ?? 'todo',
          author: input.author,
          createdAt: now,
          updatedAt: now,
          photo: input.photo,
        };
        set((s) => ({ surveyItems: { ...s.surveyItems, [id]: item } }));
        return id;
      },
      updateSurveyItem: (id, patch) =>
        set((s) => s.surveyItems[id]
          ? { surveyItems: { ...s.surveyItems, [id]: { ...s.surveyItems[id], ...patch, updatedAt: Date.now() } } }
          : s),
      removeSurveyItem: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.surveyItems; return { surveyItems: rest }; }),

      // ── Threat Drill ─────────────────────────────────────────────
      addScenario: (sc) => set((s) => ({ scenarios: { ...s.scenarios, [sc.id]: sc } })),
      updateScenario: (id, patch) =>
        set((s) => (s.scenarios[id]
          ? { scenarios: { ...s.scenarios, [id]: { ...s.scenarios[id], ...patch } } }
          : s)),
      removeScenario: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.scenarios; return { scenarios: rest }; }),
      recomputeScenario: (id) =>
        set((s) => {
          const sc = s.scenarios[id];
          if (!sc) return s;
          // Pull project state for the analyzer. We compute gaps in a pure
          // helper (computeScenarioGaps) defined below so it stays unit-
          // testable and re-callable from the AI side panel.
          const result = computeScenarioGaps(s, sc);
          return {
            scenarios: {
              ...s.scenarios,
              [id]: { ...sc, gaps: result.gaps, readinessScore: result.readiness, lastSimulatedAt: Date.now() },
            },
          };
        }),

      // ── Bus Security ─────────────────────────────────────────────
      addBus: (b) => set((s) => ({ buses: { ...s.buses, [b.id]: b } })),
      updateBus: (id, patch) =>
        set((s) => (s.buses[id]
          ? { buses: { ...s.buses, [id]: { ...s.buses[id], ...patch } } }
          : s)),
      removeBus: (id) => set((s) => {
        const { [id]: _, ...rest } = s.buses;
        // Cascade-delete dependents
        const cams = Object.fromEntries(Object.entries(s.busCameras).filter(([, c]) => c.busId !== id));
        const dvrs = Object.fromEntries(Object.entries(s.busDVRs).filter(([, d]) => d.busId !== id));
        const cables = Object.fromEntries(Object.entries(s.busCableRoutes).filter(([, c]) => c.busId !== id));
        const events = Object.fromEntries(Object.entries(s.busEvents).filter(([, e]) => e.busId !== id));
        const checks = Object.fromEntries(Object.entries(s.busChecks).filter(([, c]) => c.busId !== id));
        return { buses: rest, busCameras: cams, busDVRs: dvrs, busCableRoutes: cables, busEvents: events, busChecks: checks };
      }),
      addBusCamera: (c) => set((s) => ({ busCameras: { ...s.busCameras, [c.id]: c } })),
      updateBusCamera: (id, patch) =>
        set((s) => (s.busCameras[id]
          ? { busCameras: { ...s.busCameras, [id]: { ...s.busCameras[id], ...patch } } }
          : s)),
      removeBusCamera: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.busCameras; return { busCameras: rest }; }),
      addBusDVR: (d) => set((s) => ({ busDVRs: { ...s.busDVRs, [d.id]: d } })),
      updateBusDVR: (id, patch) =>
        set((s) => (s.busDVRs[id]
          ? { busDVRs: { ...s.busDVRs, [id]: { ...s.busDVRs[id], ...patch } } }
          : s)),
      removeBusDVR: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.busDVRs; return { busDVRs: rest }; }),
      addBusCableRoute: (c) => set((s) => ({ busCableRoutes: { ...s.busCableRoutes, [c.id]: c } })),
      removeBusCableRoute: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.busCableRoutes; return { busCableRoutes: rest }; }),
      addBusEvent: (e) => set((s) => ({ busEvents: { ...s.busEvents, [e.id]: e } })),
      removeBusEvent: (id) =>
        set((s) => { const { [id]: _, ...rest } = s.busEvents; return { busEvents: rest }; }),
      updateBusCheck: (id, patch) =>
        set((s) => (s.busChecks[id]
          ? { busChecks: { ...s.busChecks, [id]: { ...s.busChecks[id], ...patch } } }
          : s)),
      seedBusCommissioning: (busId) => set((s) => {
        const stepLabels = [
          'Recorder powers on (ignition + steady state)',
          'All cameras record to assigned DVR channels',
          'GPS fix acquired within 60 s of start-up',
          'Cellular uplink registers and reports health',
          'Wi-Fi offload negotiates depot SSID',
          'Playback confirmed for every camera channel',
          'Event button records flagged clip',
          'Stop-arm trigger fires and tags clip',
          'Driver monitor / status LED indicates ready',
          'Cables secured and concealed; service loop verified',
          'Roof / firewall penetrations sealed against weather',
        ];
        const checks: Record<string, BusCommissioningCheck> = { ...s.busChecks };
        for (const step of stepLabels) {
          const id = `chk-${busId}-${step.slice(0, 18).replace(/\W+/g, '-')}`;
          if (!checks[id]) checks[id] = { id, busId, step, status: 'pending' };
        }
        return { busChecks: checks };
      }),

      // ── Project state import (shared-demo sync) ─────────────────
      // Replaces only the imported project's records, preserving other
      // projects in the same store. The corresponding export helper
      // lives below as `exportProjectState` (pure function).
      importProjectState: (env) => set((s) => {
        if (!env || env.kind !== 'deeper-vision-project-state') {
          throw new Error('Not a Deeper Vision project state envelope.');
        }
        if (env.version !== 1) {
          throw new Error(`Envelope version ${env.version} is not supported.`);
        }
        const pid = env.projectId;
        // Compute the set of object-ids that belong to this project so
        // we can drop surveyItems + workOrderProgress entries that
        // reference them (they're rewritten from the envelope below).
        const oldSites = Object.values(s.sites).filter((x) => x.projectId === pid).map((x) => x.id);
        const oldBuildings = Object.values(s.buildings).filter((b) => oldSites.includes(b.siteId)).map((b) => b.id);
        const oldFloors = Object.values(s.floors).filter((f) => oldBuildings.includes(f.buildingId) || f.projectId === pid).map((f) => f.id);
        const oldDevices = Object.values(s.devices).filter((d) => d.projectId === pid).map((d) => d.id);
        const oldDoors = Object.values(s.doors).filter((d) => d.projectId === pid).map((d) => d.id);
        const oldPathways = Object.values(s.pathways).filter((p) => p.projectId === pid).map((p) => p.id);
        const oldIdfs = Object.values(s.idfs).filter((i) => i.projectId === pid).map((i) => i.id);
        const oldObjectIds = new Set<string>([...oldDevices, ...oldDoors, ...oldPathways, ...oldIdfs, ...oldFloors]);

        // Strip out the old records for this project.
        const filter = <T>(rec: Record<string, T>, keep: (v: T) => boolean): Record<string, T> => {
          const out: Record<string, T> = {};
          for (const [k, v] of Object.entries(rec)) if (keep(v)) out[k] = v;
          return out;
        };
        const projects   = { ...s.projects, [pid]: env.data.project };
        const customers  = env.data.customer ? { ...s.customers, [env.data.customer.id]: env.data.customer } : s.customers;
        const sites      = filter(s.sites,      (x) => x.projectId !== pid);
        const buildings  = filter(s.buildings,  (b) => !oldSites.includes(b.siteId));
        const floors     = filter(s.floors,     (f) => !oldBuildings.includes(f.buildingId) && f.projectId !== pid);
        const devices    = filter(s.devices,    (d: any) => d.projectId !== pid);
        const doors      = filter(s.doors,      (d) => d.projectId !== pid);
        const pathways   = filter(s.pathways,   (p) => p.projectId !== pid);
        const idfs       = filter(s.idfs,       (i) => i.projectId !== pid);
        const estimates  = filter(s.estimates,  (e) => e.projectId !== pid);
        const surveyItems = filter(s.surveyItems, (it: any) => !oldObjectIds.has(it.objectId));
        const workOrderProgress = filter(s.workOrderProgress, (wp) => {
          // wp.id format: wo-{kind}-{sourceId}. Drop if sourceId belonged
          // to this project's old object set; the envelope re-adds.
          const m = wp.id.match(/^wo-[^-]+-(.+)$/);
          return !m || !oldObjectIds.has(m[1]);
        });

        // Splice in the new envelope's records.
        for (const x of env.data.sites)       sites[x.id]      = x;
        for (const x of env.data.buildings)   buildings[x.id]  = x;
        for (const x of env.data.floors)      floors[x.id]     = x;
        for (const x of env.data.devices)     devices[x.id]    = x;
        for (const x of env.data.doors)       doors[x.id]      = x;
        for (const x of env.data.pathways)    pathways[x.id]   = x;
        for (const x of env.data.idfs)        idfs[x.id]       = x;
        for (const x of env.data.estimates)   estimates[x.id]  = x;
        for (const x of env.data.surveyItems) surveyItems[x.id] = x;
        for (const x of env.data.workOrderProgress) workOrderProgress[x.id] = x;

        const patch: any = {
          projects, customers, sites, buildings, floors,
          devices, doors, pathways, idfs, estimates,
          surveyItems, workOrderProgress,
        };
        // Per-project UI prefs (optional in envelope).
        if (env.data.canvasLayers) {
          patch.canvasLayers = { ...s.canvasLayers, [pid]: env.data.canvasLayers };
        }
        if (env.data.canvasDisplay) {
          patch.canvasDisplay = { ...s.canvasDisplay, [pid]: env.data.canvasDisplay };
        }
        if (env.data.projectMode) {
          patch.projectModes = { ...s.projectModes, [pid]: env.data.projectMode };
        }
        if (env.data.projectTechModel) {
          patch.projectTechModels = { ...s.projectTechModels, [pid]: env.data.projectTechModel };
        }
        // Pricebook: if the envelope carries one, apply it; otherwise
        // drop any existing pricebook for this project so the imported
        // state matches the source machine. (Absence in the envelope is
        // semantically "no overrides on the source".)
        if (env.data.pricebook) {
          patch.projectPricebooks = { ...s.projectPricebooks, [pid]: env.data.pricebook };
        } else {
          const { [pid]: _drop, ...restPb } = s.projectPricebooks;
          patch.projectPricebooks = restPb;
        }
        // Attachments: replace ONLY this project's attachments;
        // other projects' attachments are preserved. Absence of an
        // `attachments` array in the envelope means "no attachments
        // on the source machine for this project".
        const incomingAttachments = env.data.attachments ?? [];
        const keptAttachments: Record<string, import('./types').Attachment> = {};
        for (const [aid, a] of Object.entries(s.attachments)) {
          if (a.projectId !== pid) keptAttachments[aid] = a;
        }
        for (const a of incomingAttachments) keptAttachments[a.id] = a;
        patch.attachments = keptAttachments;
        return patch;
      }),

      // ── Work order progress actions ─────────────────────────────
      // The full WorkOrder shape (kind / title / checklist) is re-derived
      // every render by `deriveWorkOrders` from current canvas state. We
      // only persist the mutable bits here. Every write stamps updatedAt.
      patchWorkOrderProgress: (woId, patch) =>
        set((s) => {
          const prev = s.workOrderProgress[woId] ?? {
            id: woId,
            status: 'ready' as import('./types').WorkOrderStatus,
            completed: [],
            updatedAt: Date.now(),
          };
          return {
            workOrderProgress: {
              ...s.workOrderProgress,
              [woId]: { ...prev, ...patch, id: woId, updatedAt: Date.now() },
            },
          };
        }),
      toggleWorkOrderChecklist: (woId, itemId) =>
        set((s) => {
          const prev = s.workOrderProgress[woId] ?? {
            id: woId,
            status: 'ready' as import('./types').WorkOrderStatus,
            completed: [],
            updatedAt: Date.now(),
          };
          const has = prev.completed.includes(itemId);
          const completed = has ? prev.completed.filter((c) => c !== itemId) : [...prev.completed, itemId];
          return {
            workOrderProgress: {
              ...s.workOrderProgress,
              [woId]: { ...prev, completed, updatedAt: Date.now() },
            },
          };
        }),
      setWorkOrderStatus: (woId, status) =>
        set((s) => {
          const prev = s.workOrderProgress[woId];
          const prevStatus = prev?.status;
          const base: import('./types').WorkOrderProgress = prev ?? {
            id: woId,
            status,
            completed: [],
            updatedAt: Date.now(),
          };
          // When the user flips to blocked, stash the prior status so a
          // later unblock can restore. When flipping out of blocked, drop
          // the stash so the toggle isn't sticky.
          const next: import('./types').WorkOrderProgress = {
            ...base,
            status,
            prevStatus: status === 'blocked' ? prevStatus : undefined,
            // Clear the blocker text when leaving blocked status.
            blocker: status === 'blocked' ? base.blocker : undefined,
            updatedAt: Date.now(),
          };
          return { workOrderProgress: { ...s.workOrderProgress, [woId]: next } };
        }),
      addWorkOrderPhotoPlaceholder: (woId, photo) =>
        set((s) => {
          const prev = s.workOrderProgress[woId] ?? {
            id: woId,
            status: 'ready' as import('./types').WorkOrderStatus,
            completed: [],
            updatedAt: Date.now(),
          };
          const photoEntry: import('./types').WorkOrderPhotoPlaceholder = {
            id: `pp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            fileName: photo.fileName,
            sizeKb: photo.sizeKb,
            addedAt: Date.now(),
            tag: photo.tag,
          };
          return {
            workOrderProgress: {
              ...s.workOrderProgress,
              [woId]: {
                ...prev,
                photoPlaceholders: [...(prev.photoPlaceholders ?? []), photoEntry],
                updatedAt: Date.now(),
              },
            },
          };
        }),
      removeWorkOrderPhotoPlaceholder: (woId, photoId) =>
        set((s) => {
          const prev = s.workOrderProgress[woId];
          if (!prev?.photoPlaceholders) return s;
          return {
            workOrderProgress: {
              ...s.workOrderProgress,
              [woId]: {
                ...prev,
                photoPlaceholders: prev.photoPlaceholders.filter((p) => p.id !== photoId),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      // ── Project pricebook actions ───────────────────────────────
      // All four edit actions stamp `updatedAt` and write into the
      // `projectPricebooks` slice keyed by projectId. The empty-record
      // shape is `{ projectId, updatedAt }`; downstream code (deriveBOM)
      // treats missing fields as fall-through to defaults.
      setPricebookDoorHardware: (projectId, hw, patch) =>
        set((s) => {
          const prev = s.projectPricebooks[projectId] ?? { projectId, updatedAt: 0 };
          const doorHardware = { ...(prev.doorHardware ?? {}) } as Partial<Record<import('./types').DoorHardware, import('./types').DoorHardwarePricebookEntry>>;
          if (patch === null) {
            delete doorHardware[hw];
          } else {
            const cur = doorHardware[hw] ?? {};
            doorHardware[hw] = {
              price: patch.price === undefined ? cur.price : (patch.price ?? undefined),
              labor: patch.labor === undefined ? cur.labor : (patch.labor ?? undefined),
            };
            // Drop the entry entirely if both fields are now undefined.
            if (doorHardware[hw]?.price == null && doorHardware[hw]?.labor == null) {
              delete doorHardware[hw];
            }
          }
          return {
            projectPricebooks: {
              ...s.projectPricebooks,
              [projectId]: { ...prev, projectId, doorHardware, updatedAt: Date.now() },
            },
          };
        }),
      setPricebookCablePerFt: (projectId, cableType, pricePerFt) =>
        set((s) => {
          const prev = s.projectPricebooks[projectId] ?? { projectId, updatedAt: 0 };
          const cablePerFt = { ...(prev.cablePerFt ?? {}) };
          if (pricePerFt === null) delete cablePerFt[cableType];
          else                     cablePerFt[cableType] = pricePerFt;
          return {
            projectPricebooks: {
              ...s.projectPricebooks,
              [projectId]: { ...prev, projectId, cablePerFt, updatedAt: Date.now() },
            },
          };
        }),
      setPricebookLaborRate: (projectId, rate) =>
        set((s) => {
          const prev = s.projectPricebooks[projectId] ?? { projectId, updatedAt: 0 };
          return {
            projectPricebooks: {
              ...s.projectPricebooks,
              [projectId]: { ...prev, projectId, laborRate: rate ?? undefined, updatedAt: Date.now() },
            },
          };
        }),
      setPricebookMarkup: (projectId, markup) =>
        set((s) => {
          const prev = s.projectPricebooks[projectId] ?? { projectId, updatedAt: 0 };
          return {
            projectPricebooks: {
              ...s.projectPricebooks,
              [projectId]: { ...prev, projectId, markup: markup ?? undefined, updatedAt: Date.now() },
            },
          };
        }),
      resetPricebook: (projectId) =>
        set((s) => {
          const { [projectId]: _, ...rest } = s.projectPricebooks;
          return { projectPricebooks: rest };
        }),

      // ── Attachment actions ──
      addAttachment: (a) =>
        set((s) => ({ attachments: { ...s.attachments, [a.id]: a } })),
      updateAttachment: (id, patch) =>
        set((s) => {
          const prev = s.attachments[id];
          if (!prev) return s;
          return { attachments: { ...s.attachments, [id]: { ...prev, ...patch, id, updatedAt: Date.now() } } };
        }),
      removeAttachment: (id) =>
        set((s) => {
          const { [id]: _drop, ...rest } = s.attachments;
          return { attachments: rest };
        }),

      resetDemoData: () => set(() => ({ ...buildSeed(), workOrderProgress: {}, projectPricebooks: {}, attachments: {} })),
    }),
    {
      name: 'deeperVisionStore',
      version: 8,
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
        if (version < 3) {
          // v2 → v3: the surveyor UX hard-reset moves the default theme away
          // from Dark Command. Existing users whose persisted theme was
          // 'dark' get pushed to 'slate' once so the redesign actually lands;
          // they can flip back via the overflow menu if they want.
          if (persisted.canvasTheme === 'dark') {
            persisted.canvasTheme = 'slate';
          }
        }
        if (version < 4) {
          // v3 → v4: the visual redesign pass moves the default away from
          // Slate to Light Drafting so the canvas reads as a real drafting
          // surface, not a dark prototype. Existing users on slate/dark get
          // pushed to light once; they can flip back via the overflow menu.
          if (persisted.canvasTheme === 'slate' || persisted.canvasTheme === 'dark') {
            persisted.canvasTheme = 'light';
          }
        }
        if (version < 5) {
          // v4 → v5: introduce the object-linked surveyItems slice + the
          // earlier-pass calibration fix that inverted scalePxToFt for users
          // who calibrated before the fix. Walk every floor and if its
          // stored scale is > 1 (suspiciously px-per-ft instead of ft-per-px),
          // invert it. New value is ft-per-px = 1 / old; default seed (0.05)
          // is untouched. Then ensure the surveyItems slice exists.
          persisted.surveyItems ??= {};
          if (persisted.floors) {
            for (const [fid, f] of Object.entries(persisted.floors as Record<string, any>)) {
              if (typeof f?.scalePxToFt === 'number' && f.scalePxToFt > 1) {
                persisted.floors[fid] = { ...f, scalePxToFt: 1 / f.scalePxToFt };
              }
            }
          }
        }
        if (version < 6) {
          // v5 → v6: introduce the field-deployment workOrderProgress slice
          // (per-work-order persisted status + checklist completion + photo
          // placeholders + serial/MAC + notes + blocker). Empty default is
          // safe because deriveWorkOrders treats a missing entry as a
          // freshly-generated WO in 'ready' status.
          persisted.workOrderProgress ??= {};
        }
        if (version < 7) {
          // v6 → v7: introduce the per-project pricebook slice
          // (door-hardware unit / labor + cable per-ft + labor rate +
          // markup overrides). Empty default is safe because
          // deriveCanvasBomRows treats missing entries as fall-through
          // to UNIT_PRICE / DOOR_HARDWARE_PRICE / CABLE_UNIT_PRICE.
          persisted.projectPricebooks ??= {};
        }
        if (version < 8) {
          // v7 → v8: introduce the shared `attachments` slice. Empty
          // default is safe because attachmentsFor / projectAttachments
          // selectors treat the absence of a slice (or absence of any
          // entries for a given link target) as "no attachments yet".
          persisted.attachments ??= {};
        }
        return persisted;
      },
      // Custom merge: for the brand-new CRM slices, fall back to the seed
      // when the persisted slice is empty. Otherwise v1 users whose state
      // gets migrated to v2 would see a completely empty pipeline (because
      // Zustand's default merge prefers persisted, and persisted has `{}`
      // for slices that didn't exist in v1). Their non-CRM state (projects,
      // canvas devices, etc.) is preserved unchanged.
      merge: (persisted: any, current: any) => {
        const merged: any = { ...current, ...(persisted ?? {}) };
        const isEmpty = (m: any) => !m || Object.keys(m).length === 0;
        for (const slice of ['contacts', 'opportunities', 'touches', 'tasks'] as const) {
          if (isEmpty(persisted?.[slice])) merged[slice] = current[slice];
        }
        return merged;
      },
      // Only persist data slices, not action references (those are on every
      // hydrate anyway). UX prefs (mode/role/layers) ARE persisted so they
      // survive reloads — that's the whole point of having them.
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
        projectModes:      s.projectModes,
        canvasLayers:      s.canvasLayers,
        canvasDisplay:     s.canvasDisplay,
        projectTechModels: s.projectTechModels,
        currentRole:       s.currentRole,
        canvasTheme:       s.canvasTheme,
        scenarios:         s.scenarios,
        buses:             s.buses,
        busCameras:        s.busCameras,
        busDVRs:           s.busDVRs,
        busCableRoutes:    s.busCableRoutes,
        busEvents:         s.busEvents,
        busChecks:         s.busChecks,
        surveyItems:       s.surveyItems,
        workOrderProgress: s.workOrderProgress,
        projectPricebooks: s.projectPricebooks,
        attachments:       s.attachments,
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

  // ── Survey selectors ──────────────────────────────────────────
  /** Survey items attached to a specific canvas object (device, door, pathway,
   *  IDF, or floor), newest first. */
  surveyItemsForObject: (
    s: ProjectState,
    objectType: SurveyObjectType,
    objectId: string,
  ): SurveyItem[] =>
    Object.values(s.surveyItems)
      .filter((i) => i.objectType === objectType && i.objectId === objectId)
      .sort((a, b) => b.createdAt - a.createdAt),

  /** All survey items for a project, newest first. */
  surveyItemsForProject: (s: ProjectState, projectId: string): SurveyItem[] =>
    Object.values(s.surveyItems)
      .filter((i) => i.projectId === projectId)
      .sort((a, b) => b.createdAt - a.createdAt),

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

  /** Effective project mode: user override if set, otherwise derived
   *  from the project's lifecycle phase. */
  modeForProject: (s: ProjectState, projectId: string): ProjectMode => {
    if (s.projectModes[projectId]) return s.projectModes[projectId];
    const phase = s.projects[projectId]?.lifecyclePhase;
    return phase ? defaultModeForPhase(phase) : 'engineering';
  },

  /** Resolved canvas layer state for a project. Falls back to defaults. */
  layersForProject: (s: ProjectState, projectId: string): CanvasLayerState =>
    ({ ...DEFAULT_CANVAS_LAYERS, ...s.canvasLayers[projectId] }),

  /** Resolved display preferences for a project. */
  displayForProject: (s: ProjectState, projectId: string): CanvasDisplayPrefs =>
    ({ ...DEFAULT_DISPLAY_PREFS, ...s.canvasDisplay[projectId] }),

  /** Resolved tech model for a project. Defaults to 'hybrid'. */
  techModelForProject: (s: ProjectState, projectId: string): ProjectTechModel =>
    s.projectTechModels[projectId] ?? 'hybrid',

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

/** Canonical price / labor map for door-assembly hardware components.
 *  Source of truth for both deriveBOM's door rollup and the canvas
 *  Impact preview. Prices and labor units are reasonable defaults for
 *  preview purposes — they should be calibrated against the integrator's
 *  current pricebook before any customer-facing estimate goes out. */
export const DOOR_HARDWARE_PRICE: Record<
  import('./types').DoorHardware,
  { price: number; labor: number; desc: string }
> = {
  reader:     { price: 285,  labor: 0.75, desc: 'Card / mobile reader' },
  strike:     { price: 540,  labor: 1.5,  desc: 'Electric strike' },
  maglock:    { price: 245,  labor: 1.0,  desc: 'Magnetic lock' },
  rex:        { price: 215,  labor: 0.5,  desc: 'REX motion / button' },
  dps:        { price:  85,  labor: 0.3,  desc: 'Door position switch' },
  contact:    { price:  22,  labor: 0.25, desc: 'Door contact' },
  intercom:   { price: 720,  labor: 1.5,  desc: 'Intercom station' },
  panic:      { price: 845,  labor: 1.5,  desc: 'Panic bar / crash device' },
  autoop:     { price:1850,  labor: 4.0,  desc: 'Auto-operator / push-plate' },
  controller: { price: 980,  labor: 2.0,  desc: 'Access controller input' },
  psu:        { price: 425,  labor: 0.75, desc: '12/24 VDC power supply' },
};

/** Roll a Device's doorAssembly[] into BOM-shaped lines. Returns one line
 *  per selected hardware component plus a labor-hour summary. Pure / safe
 *  to call from render. Used by both ImpactPreviewSection (per-device
 *  preview) and deriveBOM (project-wide rollup). */
export function deriveDoorAssemblyLines(device: import('./types').Device): {
  lines: { id: string; hw: import('./types').DoorHardware; description: string; unitPrice: number; qty: number; uom: 'ea'; laborHours: number }[];
  laborHours: number;
  hardwareTotal: number;
} {
  const items = device.doorAssembly ?? [];
  const lines = items.map((hw) => {
    const meta = DOOR_HARDWARE_PRICE[hw];
    return {
      id: `door-${device.id}-${hw}`,
      hw,
      description: meta.desc,
      unitPrice: meta.price,
      qty: 1,
      uom: 'ea' as const,
      laborHours: meta.labor,
    };
  });
  return {
    lines,
    laborHours: lines.reduce((s, l) => s + l.laborHours, 0),
    hardwareTotal: lines.reduce((s, l) => s + l.unitPrice * l.qty, 0),
  };
}

export const CABLE_UNIT_PRICE: Record<string, number> = {
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

  // ── Catalog pricing — each device carries `product` = catalog product
  // id. We look it up to pull MSRP + laborUnits + manufacturer/model so
  // the BOM line carries real numbers instead of the generic UNIT_PRICE
  // fallback. UNIT_PRICE remains as the safety net when a device wasn't
  // placed from the catalog (e.g. seeded demo data with an older id). ──
  // Inlined import via require would create a cycle (canvas → store →
  // canvas). Use a dynamic-load pattern: read the global window mirror
  // when available, otherwise fall back to UNIT_PRICE.
  let catalogProducts: any[] = [];
  try {
    // Lazy: dynamic require is fine here because vite/rollup will inline
    // the module on bundle. Avoid top-level import to prevent cycle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    catalogProducts = (globalThis as any).__catalogProducts ?? [];
  } catch { /* noop */ }

  // Group devices by catalog product (preferred) OR by type fallback.
  type Group = { qty: number; price: number; labor: number; desc: string; sku: string };
  const groups = new Map<string, Group>();
  for (const d of devices as any[]) {
    const cat = catalogProducts.find((cp: any) => cp.id === d.product);
    if (cat) {
      const key = `cat:${cat.id}`;
      const prev = groups.get(key) ?? {
        qty: 0,
        price: cat.msrp ?? 0,
        labor: cat.laborUnits ?? UNIT_PRICE[d.type]?.labor ?? 0,
        desc: `${cat.manufacturer} · ${cat.model}`,
        sku: cat.id,
      };
      prev.qty += 1;
      groups.set(key, prev);
    } else {
      const meta = UNIT_PRICE[d.type] ?? { price: 0, labor: 0, desc: d.type };
      const key = `type:${d.type}`;
      const prev = groups.get(key) ?? { qty: 0, price: meta.price, labor: meta.labor, desc: meta.desc, sku: d.type };
      prev.qty += 1;
      groups.set(key, prev);
    }
  }

  const lines: EstimateLine[] = [];

  groups.forEach((agg, key) => {
    lines.push({
      id: `dev-${projectId}-${key}`,
      sourceKind: 'device',
      sku: agg.sku,
      description: agg.desc,
      qty: agg.qty,
      uom: 'ea',
      unitPrice: agg.price,
      laborHours: agg.labor * agg.qty,
    });
  });

  // Camera accessories — each device can carry an `accessories[]` array of
  // accessory product-ids. We sum the count and a flat price for each
  // (MSRPs live in the canvas-side ACCESSORIES catalog; here we use a
  // simple flat 65 USD default so the BOM at least surfaces the line).
  // When the accessory catalog migrates to the store, this can be tightened.
  const accCounts = new Map<string, number>();
  for (const dev of devices as any[]) {
    for (const aid of (dev.accessories ?? []) as string[]) {
      accCounts.set(aid, (accCounts.get(aid) ?? 0) + 1);
    }
  }
  accCounts.forEach((qty, aid) => {
    lines.push({
      id: `acc-${projectId}-${aid}`,
      sourceKind: 'manual',
      sku: aid,
      description: `Accessory · ${aid.replace(/^acc-/, '').replace(/-/g, ' ')}`,
      qty,
      uom: 'ea',
      unitPrice: 65,
      laborHours: 0.25 * qty,
    });
  });

  // Doors → one line each. The canonical Door records (state.doors) and
  // the in-canvas door-as-Device records (devices with doorAssembly[])
  // are summarised through the same DOOR_HARDWARE_PRICE table. Each
  // selected hardware component becomes one BOM line so the Estimator can
  // group them under "Access control · doors" and the per-device Impact
  // preview can show the same numbers.
  for (const door of doors) {
    const hwSum = door.hardware.reduce((acc, h) => {
      const meta = DOOR_HARDWARE_PRICE[h] ?? { price: 0, labor: 0 };
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

  // Door-as-Device with doorAssembly[] — produced by the canvas inspector
  // (DoorAssemblySection). Each selected component generates its own BOM
  // line, so the Estimator shows reader / strike / rex / etc. broken out
  // rather than rolled into one mystery total.
  for (const dev of devices as any[]) {
    const t = String(dev?.type ?? '');
    const isOpening = t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor');
    if (!isOpening) continue;
    const assembly = (dev.doorAssembly ?? []) as import('./types').DoorHardware[];
    if (assembly.length === 0) continue;
    for (const hw of assembly) {
      const meta = DOOR_HARDWARE_PRICE[hw];
      if (!meta) continue;
      lines.push({
        id: `door-asm-${dev.id}-${hw}`,
        sourceKind: 'door',
        sourceId: dev.id,
        sku: `door-hw:${hw}`,
        description: `${dev.id} · ${meta.desc}`,
        qty: 1, uom: 'ea',
        unitPrice: meta.price,
        laborHours: meta.labor,
      });
    }
  }

  // Pathways → cable feet + small conduit allocation.
  // Uses pathwayLengthFt (lib/engineering) so the BOM, canvas labels, and
  // PathwayDrawer all agree. Per-floor calibration via floor.scalePxToFt;
  // fallback is the canvas default (1 / 20 ft per px) until /calibrate runs.
  for (const p of pathways) {
    const floor = p.floorId ? state.floors[p.floorId] : undefined;
    const ft = pathwayLengthFt(p, floor);
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

// ─────────────────── Per-source BOM rows (canvas drawer) ──────────
// deriveBOM aggregates devices by catalog SKU, which is great for an
// invoice but loses the link between a row and a specific glyph on
// the canvas. The canvas-side BOM drawer needs the inverse: one row
// per canvas object so clicking a row can focus its source. This
// helper returns those per-source rows, plus categorisation and the
// Proposed / Existing flag for door-assembly hardware.
export function deriveCanvasBomRows(
  state: ProjectState,
  projectId: string,
): {
  rows: import('./types').CanvasBomRow[];
  totals: {
    deviceCount: number;
    proposedMaterial: number;
    existingDocumented: number;
    cable: number;
    laborHours: number;
    laborTotal: number;
    sellTotal: number;
    missingPriceCount: number;
    laborRate: number;
    markup: number;
  };
} {
  // Pricebook overrides take precedence over the project's estimate
  // record, which in turn takes precedence over the hardcoded defaults.
  // Missing entries fall through to defaults so absence == legacy.
  const pricebook = state.projectPricebooks[projectId];
  const laborRate = pricebook?.laborRate ?? state.estimates[`est-${projectId}`]?.laborRate ?? 95;
  const markup    = pricebook?.markup    ?? state.estimates[`est-${projectId}`]?.markup    ?? 0.18;

  const devices = selectors.devicesForProject(state, projectId);
  const doors = Object.values(state.doors).filter((d) => d.projectId === projectId);
  const pathways = selectors.pathwaysForProject(state, projectId);
  const idfs = selectors.idfsForProject(state, projectId);

  let catalogProducts: any[] = [];
  try { catalogProducts = (globalThis as any).__catalogProducts ?? []; } catch { /* noop */ }

  // Resolve effective door-hardware unit/labor with pricebook fallthrough.
  function effectiveDoorHw(hw: import('./types').DoorHardware): { price: number; labor: number; desc: string; overridden: boolean } {
    const def = DOOR_HARDWARE_PRICE[hw];
    if (!def) return { price: 0, labor: 0, desc: hw, overridden: false };
    const pb = pricebook?.doorHardware?.[hw];
    const priceOverride = pb?.price != null;
    const laborOverride = pb?.labor != null;
    return {
      price: pb?.price ?? def.price,
      labor: pb?.labor ?? def.labor,
      desc:  def.desc,
      overridden: priceOverride || laborOverride,
    };
  }
  // Resolve effective per-ft cable price with pricebook fallthrough.
  function effectiveCablePerFt(cableType: string): { perFt: number; overridden: boolean } {
    const pb = pricebook?.cablePerFt?.[cableType];
    if (pb != null) return { perFt: pb, overridden: true };
    return { perFt: CABLE_UNIT_PRICE[cableType] ?? 0.5, overridden: false };
  }

  function categoryFromType(t: string): import('./types').CanvasBomCategory {
    if (t.startsWith('cam'))                 return 'cameras';
    if (t.startsWith('acc') || t.startsWith('aud.intercom') || t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor')) return 'access';
    if (t.startsWith('net') || t.startsWith('sto') || t.startsWith('pwr') || t === 'inf.rack' || t === 'inf.mdf') return 'network';
    return 'other';
  }

  function shortKindLabel(t: string): string {
    if (t === 'cam.bullet')      return 'Bullet';
    if (t === 'cam.dome')        return 'Dome';
    if (t === 'cam.ptz')         return 'PTZ';
    if (t === 'cam.multisensor') return 'Multisensor';
    if (t === 'cam.fisheye')     return 'Fisheye';
    if (t === 'cam.thermal')     return 'Thermal';
    if (t === 'cam.lpr')         return 'LPR';
    if (t === 'cam.body')        return 'Body cam';
    if (t === 'acc.reader')      return 'Reader';
    if (t === 'acc.biometric')   return 'Biometric';
    if (t === 'acc.intercom')    return 'Intercom';
    if (t === 'aud.intercom')    return 'Intercom';
    if (t === 'net.switch')      return 'Switch';
    if (t === 'net.firewall')    return 'Firewall';
    if (t === 'net.ap')          return 'AP';
    if (t === 'pwr.ups')         return 'UPS';
    if (t === 'sto.nvr')         return 'NVR';
    if (t === 'sto.server')      return 'Server';
    if (t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor')) return 'Opening';
    if (t === 'inf.rack' || t === 'inf.mdf' || t === 'net.idf' || t === 'net.mdf') return 'Rack';
    return t;
  }

  const rows: import('./types').CanvasBomRow[] = [];

  // ── Per-device rows. Door-class openings emit one row per hardware
  // item (honoring doorAssemblyState for Proposed / Existing). All
  // other devices emit one row per device id.
  for (const d of devices as any[]) {
    const t = String(d?.type ?? '');
    const isOpening = t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor');
    if (isOpening) {
      const assembly: import('./types').DoorHardware[] = d.doorAssembly ?? [];
      const stateMap = (d.doorAssemblyState ?? {}) as Partial<Record<import('./types').DoorHardware, 'proposed' | 'existing'>>;
      // Always show the opening itself even with no hardware, so the user
      // can see the door appears in the BOM (e.g. for labor budgeting).
      if (assembly.length === 0) {
        rows.push({
          id: `door-asm-${d.id}-none`,
          category: 'access',
          sourceKind: 'door',
          sourceId: d.id,
          isExisting: false,
          description: 'Opening (no hardware specified yet)',
          meta: `${shortKindLabel(t)} · ${d.id}`,
          qty: 1, uom: 'ea',
          unitPrice: 0,
          laborHours: 0,
          missingPrice: false,
        });
        continue;
      }
      for (const hw of assembly) {
        const eff = effectiveDoorHw(hw);
        if (!DOOR_HARDWARE_PRICE[hw]) continue;
        const isExisting = stateMap[hw] === 'existing';
        rows.push({
          id: `door-asm-${d.id}-${hw}`,
          category: 'access',
          sourceKind: 'door',
          sourceId: d.id,
          isExisting,
          description: eff.desc,
          meta: `${shortKindLabel(t)} · ${d.id}`,
          qty: 1, uom: 'ea',
          unitPrice: eff.price,
          laborHours: eff.labor,
          missingPrice: eff.price === 0,
          overridden: eff.overridden,
        });
      }
      continue;
    }
    // Non-opening device — single row.
    const cat = catalogProducts.find((cp: any) => cp.id === d.product);
    const fallback = UNIT_PRICE[t];
    // Standalone access-control devices (e.g. an `acc.reader` placed on
    // a wall, not on a door) share semantics with the matching door-
    // hardware class — so a pricebook override for that class should
    // apply here too. Keeps the user's mental model coherent: "set
    // reader cost = $500" affects every reader on the project.
    const deviceToHw: Record<string, import('./types').DoorHardware> = {
      'acc.reader':    'reader',
      'acc.strike':    'strike',
      'acc.maglock':   'maglock',
      'acc.rex':       'rex',
      'acc.exit':      'panic',
      'acc.biometric': 'reader',
      'acc.controller':'controller',
      'acc.psu':       'psu',
      'acc.dps':       'contact',
      'aud.intercom':  'intercom',
    };
    const hwKey = deviceToHw[t];
    const pbHw = hwKey ? pricebook?.doorHardware?.[hwKey] : undefined;
    const price = pbHw?.price ?? cat?.msrp ?? fallback?.price ?? 0;
    const labor = pbHw?.labor ?? cat?.laborUnits ?? fallback?.labor ?? 0;
    const overridden = pbHw?.price != null || pbHw?.labor != null;
    const product = cat ? `${cat.manufacturer} · ${cat.model}` : undefined;
    rows.push({
      id: `dev-${d.id}`,
      category: categoryFromType(t),
      sourceKind: 'device',
      sourceId: d.id,
      isExisting: false,
      description: fallback?.desc ?? t,
      meta: `${shortKindLabel(t)} · ${d.id}`,
      product,
      qty: 1, uom: 'ea',
      unitPrice: price,
      laborHours: labor,
      missingPrice: price === 0,
      overridden,
    });
  }

  // ── Canonical door records (state.doors). These predate the
  // door-as-Device pattern; they get one row per hardware item with
  // no Proposed/Existing distinction (the legacy schema doesn't carry
  // that flag).
  for (const door of doors) {
    if (!door.hardware || door.hardware.length === 0) {
      rows.push({
        id: `door-${door.id}-none`,
        category: 'access',
        sourceKind: 'door',
        sourceId: door.id,
        isExisting: false,
        description: 'Opening (no hardware specified yet)',
        meta: `Door · ${door.id}`,
        qty: 1, uom: 'ea',
        unitPrice: 0,
        laborHours: 0,
        missingPrice: false,
      });
      continue;
    }
    for (const hw of door.hardware) {
      if (!DOOR_HARDWARE_PRICE[hw]) continue;
      const eff = effectiveDoorHw(hw);
      rows.push({
        id: `door-${door.id}-${hw}`,
        category: 'access',
        sourceKind: 'door',
        sourceId: door.id,
        isExisting: false,
        description: eff.desc,
        meta: `Door · ${door.id}`,
        qty: 1, uom: 'ea',
        unitPrice: eff.price,
        laborHours: eff.labor,
        missingPrice: eff.price === 0,
        overridden: eff.overridden,
      });
    }
  }

  // ── Pathways. One row per cable run; length uses the per-floor
  // calibrated px-to-ft scale so the BOM agrees with the canvas
  // labels and the pathway drawer.
  for (const p of pathways) {
    const floor = p.floorId ? state.floors[p.floorId] : undefined;
    const ft = pathwayLengthFt(p, floor);
    const eff = effectiveCablePerFt(p.cableType);
    const qty = ft * p.cableCount;
    rows.push({
      id: `pw-${p.id}`,
      category: 'cabling',
      sourceKind: 'pathway',
      sourceId: p.id,
      isExisting: false,
      description: `${p.cableType.toUpperCase()} · ${p.cableCount}× · ${ft} ft`,
      meta: `Run · ${p.id}`,
      qty,
      uom: 'ft',
      unitPrice: eff.perFt,
      laborHours: ft * 0.02 * p.cableCount,
      missingPrice: eff.perFt === 0,
      overridden: eff.overridden,
    });
  }

  // ── IDFs. Switch + UPS rows.
  for (const idf of idfs) {
    for (const sw of idf.switches ?? []) {
      const meta = UNIT_PRICE['net.switch'];
      rows.push({
        id: `idf-${idf.id}-sw-${sw.model}`,
        category: 'network',
        sourceKind: 'idf',
        sourceId: idf.id,
        isExisting: false,
        description: `${sw.model} · ${sw.portsTotal} ports`,
        meta: `Rack · ${idf.id}`,
        qty: 1, uom: 'ea',
        unitPrice: meta.price,
        laborHours: meta.labor,
        missingPrice: meta.price === 0,
      });
    }
    if (idf.power?.upsModel) {
      const meta = UNIT_PRICE['pwr.ups'];
      rows.push({
        id: `idf-${idf.id}-ups`,
        category: 'network',
        sourceKind: 'idf',
        sourceId: idf.id,
        isExisting: false,
        description: `${idf.power.upsModel} · ~${idf.power.upsRuntimeMin ?? 30} min runtime`,
        meta: `Rack · ${idf.id}`,
        qty: 1, uom: 'ea',
        unitPrice: meta.price,
        laborHours: meta.labor,
        missingPrice: meta.price === 0,
      });
    }
  }

  // ── Totals. Existing rows are documented but excluded from
  // proposed material; cable is its own column; labor is rolled up
  // across all non-existing rows.
  let proposedMaterial = 0;
  let existingDocumented = 0;
  let cable = 0;
  let laborHours = 0;
  let deviceCount = 0;
  let missingPriceCount = 0;
  for (const r of rows) {
    const lineTotal = r.unitPrice * r.qty;
    if (r.sourceKind === 'pathway') {
      cable += lineTotal;
    } else if (r.isExisting) {
      existingDocumented += lineTotal;
    } else {
      proposedMaterial += lineTotal;
    }
    if (!r.isExisting) laborHours += r.laborHours;
    if (r.sourceKind === 'device' || r.sourceKind === 'door' || r.sourceKind === 'idf') deviceCount += r.qty;
    if (r.missingPrice) missingPriceCount += 1;
  }
  const laborTotal = laborHours * laborRate;
  const sellTotal = (proposedMaterial + cable + laborTotal) * (1 + markup);

  return {
    rows,
    totals: {
      deviceCount,
      proposedMaterial,
      existingDocumented,
      cable,
      laborHours,
      laborTotal,
      sellTotal,
      missingPriceCount,
      laborRate,
      markup,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// PROJECT STATE EXPORT — shared-demo sync helper
// ═══════════════════════════════════════════════════════════════════
// Builds a `ProjectStateEnvelope` for the named project. Pure over a
// store snapshot so the UI can call it inside a render without
// triggering a re-render. The corresponding apply lives on the store
// as `importProjectState`.

export function exportProjectState(
  state: ProjectState,
  projectId: string,
  opts?: { buildLabel?: string },
): import('./types').ProjectStateEnvelope {
  const project = state.projects[projectId];
  if (!project) {
    throw new Error(`No project with id "${projectId}" in store.`);
  }
  const customer = project.customerId ? state.customers[project.customerId] : undefined;
  const sites      = Object.values(state.sites).filter((x) => x.projectId === projectId);
  const siteIds    = new Set(sites.map((x) => x.id));
  const buildings  = Object.values(state.buildings).filter((b) => siteIds.has(b.siteId));
  const buildingIds = new Set(buildings.map((b) => b.id));
  const floors     = Object.values(state.floors).filter((f) => buildingIds.has(f.buildingId) || f.projectId === projectId);
  const floorIds   = new Set(floors.map((f) => f.id));
  const devices    = Object.values(state.devices).filter((d: any) => d.projectId === projectId);
  const doors      = Object.values(state.doors).filter((d) => d.projectId === projectId);
  const pathways   = Object.values(state.pathways).filter((p) => p.projectId === projectId);
  const idfs       = Object.values(state.idfs).filter((i) => i.projectId === projectId);
  const estimates  = Object.values(state.estimates).filter((e) => e.projectId === projectId);

  // Survey items track an objectId — keep only those that point at one
  // of the project's devices / doors / pathways / idfs / floors.
  const objectIds = new Set<string>([
    ...devices.map((d: any) => d.id),
    ...doors.map((d: any) => d.id),
    ...pathways.map((p: any) => p.id),
    ...idfs.map((i: any) => i.id),
    ...floorIds,
  ]);
  const surveyItems = Object.values(state.surveyItems).filter((it: any) => objectIds.has(it.objectId));

  // Work order progress is keyed by `wo-{kind}-{sourceId}`. Carry only
  // entries whose sourceId belongs to this project's object set.
  const workOrderProgress = Object.values(state.workOrderProgress).filter((wp) => {
    const m = wp.id.match(/^wo-[^-]+-(.+)$/);
    return !!m && objectIds.has(m[1]);
  });

  return {
    kind: 'deeper-vision-project-state',
    version: 1,
    exportedAt: Date.now(),
    buildLabel: opts?.buildLabel,
    projectId,
    summary: {
      projectName: project.name,
      deviceCount: devices.length,
      pathwayCount: pathways.length,
      doorCount: doors.length + devices.filter((d: any) => {
        const t = String(d.type);
        return t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor');
      }).length,
      idfCount: idfs.length,
      floorCount: floors.length,
      workOrderProgressCount: workOrderProgress.length,
    },
    data: {
      project,
      customer,
      sites,
      buildings,
      floors,
      devices: devices as any[],
      doors,
      pathways,
      idfs,
      estimates,
      surveyItems: surveyItems as any[],
      workOrderProgress,
      canvasLayers: state.canvasLayers[projectId],
      canvasDisplay: state.canvasDisplay[projectId],
      projectMode: state.projectModes[projectId],
      projectTechModel: state.projectTechModels[projectId],
      pricebook: state.projectPricebooks[projectId],
      attachments: Object.values(state.attachments).filter((a) => a.projectId === projectId),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// ATTACHMENT LOOKUPS — selector-style helpers for the panel + reports
// ═══════════════════════════════════════════════════════════════════

/** All attachments linked to a specific canvas object (device / door /
 *  pathway / work order / floor / report). Caller-side memoization
 *  recommended for large lists. */
export function attachmentsFor(
  state: ProjectState,
  linkedObjectType: import('./types').AttachmentLinkType,
  linkedObjectId: string,
): import('./types').Attachment[] {
  return Object.values(state.attachments).filter(
    (a) => a.linkedObjectType === linkedObjectType && a.linkedObjectId === linkedObjectId,
  );
}

/** Every attachment on a project across all link types. Sorted newest
 *  first so the Reports Center "recent attachments" surface is cheap. */
export function projectAttachments(state: ProjectState, projectId: string): import('./types').Attachment[] {
  return Object.values(state.attachments)
    .filter((a) => a.projectId === projectId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Per-category counts for a project. Reports Center renders a small
 *  grid of these as the attachments summary. */
export function projectAttachmentCounts(
  state: ProjectState,
  projectId: string,
): Record<import('./types').AttachmentCategory, number> {
  const out: Record<import('./types').AttachmentCategory, number> = {
    photo: 0, video: 0, pdf: 0, spec: 0, drawing: 0, closeout: 0, note: 0, other: 0,
  };
  for (const a of Object.values(state.attachments)) {
    if (a.projectId !== projectId) continue;
    out[a.category] = (out[a.category] ?? 0) + 1;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// FIELD DEPLOYMENT / WORK ORDERS — derived from canvas state
// ═══════════════════════════════════════════════════════════════════
// One work order per camera, per door opening with an assembly, per
// pathway run, and per IDF rack. The WO's title, checklist, default
// role, and labor estimate are derived; the mutable progress (status,
// completed-ids, photos, serial/MAC, blocker) lives on the
// workOrderProgress slice and is merged in via woProgress() so a
// reload returns the user to where they left off.
//
// Stable WO ids of the form `wo-${kind}-${sourceId}` mean the same
// physical install carries its progress across renders even when the
// device list reorders.

function defaultProgress(woId: string): import('./types').WorkOrderProgress {
  return { id: woId, status: 'ready', completed: [], updatedAt: 0 };
}

function buildLocation(state: ProjectState, floorId: string | undefined): string | undefined {
  if (!floorId) return undefined;
  const floor = state.floors[floorId];
  if (!floor) return undefined;
  const bld = state.buildings[floor.buildingId];
  return bld ? `${bld.name} · ${floor.name}` : floor.name;
}

function cameraChecklist(): import('./types').WorkOrderChecklistItem[] {
  return [
    { id: 'mount',      label: 'Mount camera at marked location' },
    { id: 'cable-pull', label: 'Pull cable to nearest IDF / PoE switch' },
    { id: 'terminate',  label: 'Terminate RJ45 (T568B both ends)' },
    { id: 'label',      label: 'Label cable + jack with WO id' },
    { id: 'aim',        label: 'Aim camera per coverage plan' },
    { id: 'verify',     label: 'Verify DORI target with calibrated subject' },
    { id: 'photo',      label: 'Upload install photo' },
    { id: 'serial-mac', label: 'Record MAC + serial' },
  ];
}

function doorChecklist(assembly: import('./types').DoorHardware[]): import('./types').WorkOrderChecklistItem[] {
  const items: import('./types').WorkOrderChecklistItem[] = [
    { id: 'verify-opening', label: 'Verify opening type + handing matches design' },
  ];
  const have = new Set(assembly);
  if (have.has('reader') || have.has('intercom') || have.has('panic')) {
    items.push({ id: 'install-reader', label: 'Install reader / intercom on mullion or wall' });
  }
  if (have.has('strike') || have.has('maglock')) {
    items.push({ id: 'install-lock',  label: 'Install strike / maglock + secure power transfer' });
  }
  if (have.has('dps') || have.has('contact')) {
    items.push({ id: 'install-dps',   label: 'Install door position sensor on frame + door' });
  }
  if (have.has('rex')) {
    items.push({ id: 'install-rex',   label: 'Install REX motion / button on egress side' });
  }
  if (have.has('controller') || have.has('psu')) {
    items.push({ id: 'install-head',  label: 'Mount controller + PSU in IDF or head-end' });
  }
  items.push(
    { id: 'wire-back',    label: 'Pull + terminate wiring back to controller' },
    { id: 'test-egress',  label: 'Test free egress (REX, panic, fail-safe behaviour)' },
    { id: 'commission',   label: 'Commission opening + cycle 10 times under load' },
    { id: 'photo-door',   label: 'Upload before + after photo of opening' },
  );
  return items;
}

function pathwayChecklist(): import('./types').WorkOrderChecklistItem[] {
  return [
    { id: 'stage',        label: 'Stage cable + tools at start of run' },
    { id: 'pull',         label: 'Pull cable along planned route (respect bend radius)' },
    { id: 'support',      label: 'Support every 4–5 ft (J-hook / tray / conduit)' },
    { id: 'label-both',   label: 'Label both ends with run id + termination' },
    { id: 'terminate',    label: 'Terminate both ends + dress patch panel side' },
    { id: 'test',         label: 'Certify run (continuity / PoE budget / length)' },
    { id: 'photo-run',    label: 'Upload representative photo of finished pull' },
  ];
}

function idfChecklist(): import('./types').WorkOrderChecklistItem[] {
  return [
    { id: 'rack-mount',   label: 'Mount switch + UPS in IDF rack' },
    { id: 'ground-bond',  label: 'Bond rack ground to building ground bar' },
    { id: 'power',        label: 'Land conditioned power + verify UPS runtime' },
    { id: 'patch',        label: 'Patch terminated runs to switch ports' },
    { id: 'network',      label: 'Verify uplink + VLAN config' },
    { id: 'label-rack',   label: 'Label rack + port assignments' },
    { id: 'photo-rack',   label: 'Upload finished-rack photo' },
  ];
}

/** Look up persisted progress, falling back to a fresh ready record. */
function woProgress(state: ProjectState, woId: string): import('./types').WorkOrderProgress {
  return state.workOrderProgress[woId] ?? defaultProgress(woId);
}

export function deriveWorkOrders(state: ProjectState, projectId: string): import('./types').WorkOrder[] {
  const orders: import('./types').WorkOrder[] = [];
  const devices = selectors.devicesForProject(state, projectId);
  const doors   = Object.values(state.doors).filter((d) => d.projectId === projectId);
  const pathways = selectors.pathwaysForProject(state, projectId);
  const idfs    = selectors.idfsForProject(state, projectId);

  let catalogProducts: any[] = [];
  try { catalogProducts = (globalThis as any).__catalogProducts ?? []; } catch { /* noop */ }

  // Effective door-hardware labor with pricebook fallthrough, so the WO
  // labor estimates stay in sync with the BOM drawer's per-row figures.
  const pricebook = state.projectPricebooks[projectId];
  const hwLabor = (hw: import('./types').DoorHardware): number =>
    pricebook?.doorHardware?.[hw]?.labor ?? DOOR_HARDWARE_PRICE[hw]?.labor ?? 0;

  // ── Cameras ───────────────────────────────────────────────────
  for (const d of devices as any[]) {
    const t = String(d.type);
    if (!t.startsWith('cam')) continue;
    const id = `wo-camera-${d.id}`;
    const cat = catalogProducts.find((cp: any) => cp.id === d.product);
    const subtitle = cat ? `${cat.manufacturer} · ${cat.model}` : (UNIT_PRICE[t]?.desc ?? t);
    const labor = (cat?.laborUnits ?? UNIT_PRICE[t]?.labor ?? 1.5);
    orders.push({
      id,
      kind: 'camera',
      sourceId: d.id,
      title: `Install ${d.id}`,
      subtitle,
      location: buildLocation(state, d.floorId),
      role: 'Camera tech',
      priority: t === 'cam.ptz' || t === 'cam.multisensor' ? 'high' : 'med',
      estLaborHours: labor,
      checklist: cameraChecklist(),
      progress: woProgress(state, id),
    });
  }

  // ── Doors (devices with doorAssembly + legacy state.doors) ───
  // 1) door-as-Device records (the canvas-native flow). One WO per
  //    opening with the checklist tailored to which hardware exists.
  for (const d of devices as any[]) {
    const t = String(d.type);
    const isOpening = t.startsWith('inf.door') || t.startsWith('inf.gate') || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor');
    if (!isOpening) continue;
    const assembly = (d.doorAssembly ?? []) as import('./types').DoorHardware[];
    const id = `wo-door-${d.id}`;
    // Sum labor across hardware items so the estimate reflects assembly size.
    const labor = assembly.reduce((s, hw) => s + hwLabor(hw), 0);
    const stateMap = (d.doorAssemblyState ?? {}) as Partial<Record<import('./types').DoorHardware, 'proposed' | 'existing'>>;
    const proposedCount = assembly.filter((hw) => stateMap[hw] !== 'existing').length;
    orders.push({
      id,
      kind: 'door',
      sourceId: d.id,
      title: `Install ${d.id} access control opening`,
      subtitle: assembly.length === 0
        ? 'No hardware specified yet'
        : `${proposedCount} proposed hardware item${proposedCount === 1 ? '' : 's'}${proposedCount !== assembly.length ? ` · ${assembly.length - proposedCount} existing` : ''}`,
      location: buildLocation(state, d.floorId),
      role: 'Access integrator',
      priority: assembly.length >= 4 ? 'high' : assembly.length >= 1 ? 'med' : 'low',
      estLaborHours: Math.max(labor, 1.0),
      checklist: doorChecklist(assembly),
      progress: woProgress(state, id),
    });
  }
  // 2) legacy Door records. Treated the same shape so the field user
  //    sees them in one list.
  for (const door of doors) {
    const id = `wo-door-${door.id}`;
    if (orders.some((o) => o.id === id)) continue; // de-dup if both representations exist
    const labor = (door.hardware ?? []).reduce((s, hw) => s + hwLabor(hw as import('./types').DoorHardware), 0);
    orders.push({
      id,
      kind: 'door',
      sourceId: door.id,
      title: `Install ${door.id} access control opening`,
      subtitle: door.hardware?.length ? `${door.hardware.length} hardware items` : 'No hardware specified yet',
      location: buildLocation(state, door.floorId),
      role: 'Access integrator',
      priority: (door.hardware?.length ?? 0) >= 4 ? 'high' : (door.hardware?.length ?? 0) >= 1 ? 'med' : 'low',
      estLaborHours: Math.max(labor, 1.0),
      checklist: doorChecklist((door.hardware ?? []) as import('./types').DoorHardware[]),
      progress: woProgress(state, id),
    });
  }

  // ── Pathways ──────────────────────────────────────────────────
  for (const p of pathways) {
    const id = `wo-pathway-${p.id}`;
    const floor = p.floorId ? state.floors[p.floorId] : undefined;
    const ft = pathwayLengthFt(p, floor);
    const labor = Math.round(ft * 0.02 * p.cableCount * 10) / 10;
    orders.push({
      id,
      kind: 'pathway',
      sourceId: p.id,
      title: `Pull cable ${p.id}`,
      subtitle: `${(p.cableType ?? 'cat6a').toUpperCase()} · ${p.cableCount}× · ${ft} ft`,
      location: buildLocation(state, p.floorId),
      role: 'Cable installer',
      priority: ft > 200 ? 'high' : 'low',
      estLaborHours: Math.max(labor, 0.5),
      checklist: pathwayChecklist(),
      progress: woProgress(state, id),
    });
  }

  // ── IDFs ──────────────────────────────────────────────────────
  for (const idf of idfs) {
    const id = `wo-idf-${idf.id}`;
    const hasUps = !!idf.power?.upsModel;
    const switchCount = (idf.switches ?? []).length;
    orders.push({
      id,
      kind: 'idf',
      sourceId: idf.id,
      title: `Install ${idf.id} rack equipment`,
      subtitle: `${switchCount} switch${switchCount === 1 ? '' : 'es'}${hasUps ? ' · UPS' : ''}`,
      location: buildLocation(state, idf.floorId),
      role: 'Network technician',
      priority: switchCount >= 2 || hasUps ? 'high' : 'med',
      estLaborHours: (switchCount * 3) + (hasUps ? 1.5 : 0),
      checklist: idfChecklist(),
      progress: woProgress(state, id),
    });
  }

  // Sort by kind (cameras → doors → pathways → idf) then by source id.
  const KIND_ORDER: Record<import('./types').WorkOrderKind, number> = {
    camera: 0, door: 1, pathway: 2, idf: 3,
  };
  orders.sort((a, b) => {
    if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return a.sourceId.localeCompare(b.sourceId);
  });
  return orders;
}

// ═══════════════════════════════════════════════════════════════════
// THREAT DRILL — GAP ANALYSIS + READINESS SCORE
// ═══════════════════════════════════════════════════════════════════
// Pure function over a state snapshot + a scenario. Returns the list
// of gaps (severity + suggestion + focus) and a readiness score 0–100.
// Drives both the side panel chips and the report.

export function computeScenarioGaps(
  s: ProjectState,
  sc: Scenario,
): { gaps: ScenarioGap[]; readiness: number } {
  const gaps: ScenarioGap[] = [];
  // Scope devices to this project
  const projectDevices = Object.values(s.devices).filter((d: any) => d.projectId === sc.projectId);
  const cameras = projectDevices.filter((d: any) => d.type?.startsWith('cam.'));
  const speakers = projectDevices.filter((d: any) => d.type === 'aud.speaker' || d.type === 'aud.horn' || d.type === 'aud.amp');
  const intercoms = projectDevices.filter((d: any) => d.type === 'acc.intercom' || d.type === 'aud.intercom');
  const doors = projectDevices.filter((d: any) => d.type?.startsWith('inf.door') || d.type === 'acc.exit' || d.type === 'acc.door' || d.type === 'acc.gate');
  const maglocks = projectDevices.filter((d: any) => d.type === 'acc.maglock');
  const idfs = projectDevices.filter((d: any) => d.type === 'net.idf' || d.type === 'net.switch' || d.type === 'inf.rack' || d.type === 'inf.mdf');

  // Helper: point-in-rect check, with ~150px slack so a camera mounted
  // outside but pointing into the zone still counts as covering it.
  const rectIntersects = (z: ScenarioZone, x: number, y: number, slack = 0) =>
    x >= z.rect.x - slack && x <= z.rect.x + z.rect.w + slack
    && y >= z.rect.y - slack && y <= z.rect.y + z.rect.h + slack;

  // 1. Each accountability zone needs camera coverage
  for (const z of sc.zones) {
    const isAccount = ['classroom', 'cafeteria', 'gym', 'restroom', 'exterior'].includes(z.kind);
    if (!isAccount) continue;
    const cams = cameras.filter((c: any) => rectIntersects(z, c.x, c.y, 180));
    if (cams.length === 0) {
      gaps.push({
        id: `g-blind-${z.id}`,
        severity: 'high',
        kind: 'blind-spot',
        label: `${z.label} has no camera coverage`,
        detail: 'No camera within ~50 ft of this zone. Visual accountability not possible.',
        focusZoneId: z.id,
        suggestion: 'Add a fixed dome at the zone perimeter (Axis P3265-LV or Verkada CD42-E).',
        estimatedFixCost: 1450,
      });
    }
  }

  // 2. Safe zones need PA coverage
  for (const z of sc.zones) {
    if (z.kind !== 'safe-room' && z.kind !== 'lockdown-zone' && z.kind !== 'reunification') continue;
    const pas = speakers.filter((p: any) => rectIntersects(z, p.x, p.y, 180));
    if (pas.length === 0) {
      gaps.push({
        id: `g-pa-${z.id}`,
        severity: 'med',
        kind: 'no-pa',
        label: `${z.label} has no PA coverage`,
        detail: 'No IP speaker or horn within audible range; lockdown announcements may not reach occupants.',
        focusZoneId: z.id,
        suggestion: 'Add Axis C1410 ceiling speaker or C1310-E horn at the zone.',
        estimatedFixCost: 595,
      });
    }
  }

  // 3. Maglock without REX (re-uses canHost-style heuristic)
  for (const m of maglocks as any[]) {
    const rex = projectDevices.find((x: any) =>
      (x.type === 'acc.exit' || x.type === 'acc.dps') && Math.hypot(x.x - m.x, x.y - m.y) < 80);
    if (!rex) {
      gaps.push({
        id: `g-rex-${m.id}`,
        severity: 'high',
        kind: 'no-rex',
        label: `Maglock ${m.id} has no REX`,
        detail: 'IBC 1010.1.9.7 requires a request-to-exit device adjacent to maglocked openings.',
        focusDeviceIds: [m.id],
        suggestion: 'Drop a Camden CM-330 wave-to-exit or Bosch REX-PIR within 12 in. of the maglock.',
        estimatedFixCost: 185,
      });
    }
  }

  // 4. Doors without lockdown capability (no strike + no maglock linked)
  for (const d of doors as any[]) {
    if (!d.type?.startsWith('inf.door')) continue;
    const electrified = (d.stack ?? []).some((aid: string) => {
      const a = s.devices[aid];
      return a && (a.type === 'acc.strike' || a.type === 'acc.maglock');
    });
    if (!electrified) {
      gaps.push({
        id: `g-lock-${d.id}`,
        severity: 'high',
        kind: 'no-lockdown',
        label: `${d.label || d.id} cannot be locked from the access system`,
        detail: 'Door is not electrified — no remote lock confirmation, no lockdown response.',
        focusDeviceIds: [d.id],
        suggestion: 'Add an electric strike (Von Duprin 6210) or maglock + REX pair.',
        estimatedFixCost: 285,
      });
    }
  }

  // 5. Protocol gaps — sections present in the catalog but missing from protocol
  const presentSections = new Set(sc.protocol.steps.map((p) => p.section));
  const required: { section: ProtocolStep['section']; label: string }[] = [
    { section: 'lockdown-triggers',      label: 'Lockdown triggers' },
    { section: 'pa-announcements',       label: 'PA announcements' },
    { section: 'classroom-response',     label: 'Classroom response' },
    { section: 'student-accountability', label: 'Student accountability' },
    { section: 'reunification',          label: 'Reunification' },
    { section: 'all-clear',              label: 'All-clear process' },
  ];
  for (const r of required) {
    if (!presentSections.has(r.section)) {
      gaps.push({
        id: `g-proto-${r.section}`,
        severity: 'med',
        kind: 'protocol-gap',
        label: `Protocol missing: ${r.label}`,
        detail: `No step found for ${r.label}. Drill may not be defensible in an after-action review.`,
        suggestion: 'Use the AI protocol builder to draft this section against current device coverage.',
      });
    }
  }

  // 6. Accountability zones beyond rated occupancy of nearest safe room
  for (const z of sc.zones) {
    if (z.kind !== 'classroom' && z.kind !== 'cafeteria' && z.kind !== 'gym') continue;
    if (z.occupancy && z.occupancy > 35) {
      gaps.push({
        id: `g-occ-${z.id}`,
        severity: 'low',
        kind: 'occupancy-overflow',
        label: `${z.label} occupancy ${z.occupancy} above 35-person target`,
        detail: 'High-occupancy spaces require redundant communication paths and dedicated accountability.',
        focusZoneId: z.id,
        suggestion: 'Add a secondary speaker and define a backup accountability owner.',
      });
    }
  }

  // 7. Network single point of failure — every PoE device behind one IDF
  if (cameras.length >= 6 && idfs.length <= 1) {
    gaps.push({
      id: 'g-spof',
      severity: 'med',
      kind: 'network-spof',
      label: 'Single IDF dependency for all cameras',
      detail: `${cameras.length} cameras served by ${idfs.length || 'no'} IDF — switch failure removes all coverage.`,
      suggestion: 'Distribute cameras across at least two IDFs or add a redundant uplink.',
      estimatedFixCost: 3495,
    });
  }

  // ── Readiness score: start at 100, subtract per gap weighted by severity.
  let score = 100;
  for (const g of gaps) score -= g.severity === 'high' ? 12 : g.severity === 'med' ? 6 : 3;
  // Bonus for having coverage on every safe zone
  const safeZones = sc.zones.filter((z) => z.kind === 'safe-room' || z.kind === 'lockdown-zone');
  if (safeZones.length > 0 && !gaps.some((g) => g.kind === 'no-pa')) score += 4;
  // Floor at 0, ceiling at 100
  score = Math.max(0, Math.min(100, score));
  return { gaps, readiness: score };
}
