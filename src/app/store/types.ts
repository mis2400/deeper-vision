// Central data model. Every screen reads from + writes to this shape.
// Keep this file decoupled from React — pure types only.

// ─────────────────────────── Lifecycle ────────────────────────────
// Canonical phase enum. Snake_case matches the lifecycle config keys and
// keeps URLs / activity messages readable. Every project carries exactly
// one phase at a time; transitions are gated by the rules in
// src/app/lifecycle/phases.ts.
export type LifecyclePhase =
  | 'lead'
  | 'discovery'
  | 'walk_scheduled'
  | 'survey'
  | 'engineering'
  | 'estimate'
  | 'proposal'
  | 'customer_review'
  | 'approved'
  | 'deployment'
  | 'commissioning'
  | 'completed'
  | 'managed_service'
  | 'support'
  | 'archived';

export type HealthStatus = 'on_track' | 'at_risk' | 'blocked' | 'complete';

// ─────────────────────────── Modes & roles ────────────────────────
// Coarser than the 15-phase lifecycle — these are *operational* modes
// that change what tools, overlays, telemetry, and drawer content the
// app surfaces. A user can override the mode independently of the
// project's lifecycle phase (e.g. flip to 'presentation' for a demo).
export type ProjectMode =
  | 'survey'
  | 'engineering'
  | 'estimate'
  | 'proposal'
  | 'deployment'
  | 'service'
  | 'presentation';

// Role is a per-user preference. It changes emphasis: what's hoisted to
// primary, which shortcuts are surfaced, what's hidden behind "advanced".
export type UserRole =
  | 'sales'
  | 'estimator'
  | 'engineer'
  | 'pm'
  | 'field'
  | 'service'
  | 'customer';

// Toggleable engineering overlays on the canvas. Each one gates a class
// of always-on visual noise so the canvas can be calm by default and
// loud only when the engineer asks for it.
export type EngineeringLayer =
  | 'fov'          // FOV cones on cameras
  | 'labels'       // device id labels under each device
  | 'dimensions'   // dimension chains between adjacent cameras
  | 'pathways'     // pathway runs + cable counts
  | 'rooms'        // room labels
  | 'nec'          // NEC / compliance markings
  | 'thermal'      // thermal-coverage heatmap
  | 'bandwidth'    // bandwidth / data-flow overlay
  | 'conduit_ids'  // conduit identifier labels
  | 'presence';    // live collaborator cursors

export type CanvasLayerState = Record<EngineeringLayer, boolean>;

/** What the canvas paints by default. Quiet. Engineers turn on more
 *  as they need it. */
export const DEFAULT_CANVAS_LAYERS: CanvasLayerState = {
  fov:         true,
  labels:      true,
  dimensions:  false,
  pathways:    true,
  rooms:       false,
  nec:         false,
  thermal:     false,
  bandwidth:   false,
  conduit_ids: false,
  presence:    false,
};

// ─────────────────────────── Display preferences ─────────────────
// Persisted per-project. Drives icon scale, label visibility, base map
// selection, and coverage cone opacity. The engineer can dial these to
// match a dense site or a quiet presentation. Tracked separately from
// engineering layer toggles because these are dial-style (size, density,
// opacity) rather than on/off.

export type IconSize = 'compact' | 'standard' | 'large';
export type LabelDensity = 'hidden' | 'selected' | 'important' | 'all';
export type BaseMapMode =
  | 'blueprint'   // uploaded floorplan
  | 'satellite'   // aerial imagery
  | 'street'      // 2D streetmap (light)
  | 'hybrid'      // satellite + street labels overlaid
  | 'dark'        // dark 2D map
  | 'blank';      // pure grid, no base

export interface CanvasDisplayPrefs {
  iconSize: IconSize;
  labelDensity: LabelDensity;
  /** 0..100 — applied to FOV cones as opacity scalar. */
  coverageOpacity: number;
  baseMap: BaseMapMode;
}

export const DEFAULT_DISPLAY_PREFS: CanvasDisplayPrefs = {
  iconSize:        'standard',
  labelDensity:    'important',
  coverageOpacity: 80,
  baseMap:         'blueprint',
};

// ─────────────────────────── Project tech model ──────────────────
// Filters which manufacturers / product lines are surfaced when picking
// hardware. Cloud-first projects bias toward Verkada/Rhombus/Meraki;
// on-prem toward Axis/Avigilon/Genetec ecosystem; hybrid shows both.
export type ProjectTechModel = 'cloud' | 'on_prem' | 'hybrid';

export type OwnerRole =
  | 'sales'
  | 'field'
  | 'engineering'
  | 'estimating'
  | 'sales-or-estimating'
  | 'customer'
  | 'pm'
  | 'service';

// ─────────────────────────── CRM / Sales ──────────────────────────
// First-class CRM entities. A Customer (account) owns contacts and is the
// target of opportunities; an Opportunity is the pre-project pipeline entity
// (lead → won → spawns a Project); a Touch is one logged interaction; a
// Task is a follow-up assigned to a user.

export type ContactRole =
  | 'decision_maker'
  | 'champion'
  | 'technical'
  | 'finance'
  | 'security'
  | 'facilities'
  | 'operations'
  | 'other';

export interface Contact {
  id: string;
  customerId: string;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
  role?: ContactRole;
  isPrimary?: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Address {
  street: string;
  city: string;
  state?: string;
  postal?: string;
}

export type Industry =
  | 'healthcare' | 'education' | 'retail' | 'data_center' | 'hospitality'
  | 'government' | 'commercial_re' | 'manufacturing' | 'logistics'
  | 'multifamily' | 'other';

export type AccountTier = 'strategic' | 'growth' | 'standard';

export interface Customer {
  id: string;
  companyName: string;
  addresses: Address[];
  industry?: Industry;
  accountTier?: AccountTier;
  /** Sales rep / account exec. */
  ownerUserId?: string;
  primaryContactId?: string;
  website?: string;
  employees?: number;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}

// ── Opportunities ─────────────────────────────────────────────────
export type OpportunityStage =
  | 'inquiry'        // first contact made
  | 'qualified'      // worth pursuing
  | 'discovery'      // gathering requirements
  | 'proposing'      // proposal out for review
  | 'negotiating'    // working terms
  | 'won'            // closed-won → project spawned
  | 'lost'
  | 'on_hold';

export type OpportunitySource =
  | 'referral' | 'inbound_web' | 'cold_outreach' | 'existing_customer'
  | 'partner' | 'rfp' | 'other';

export interface Opportunity {
  id: string;
  customerId: string;
  primaryContactId?: string;
  name: string;
  stage: OpportunityStage;
  /** Expected contract value in USD. */
  estValue?: number;
  /** Manual override of the stage's default probability (0..1). */
  probability?: number;
  expectedCloseDate?: number;
  source?: OpportunitySource;
  ownerUserId?: string;
  description?: string;
  lossReason?: string;
  /** Set when stage='won' and a Project was spawned. */
  wonProjectId?: string;
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
}

// ── Touches (interaction log) ─────────────────────────────────────
export type TouchType =
  | 'call' | 'email' | 'meeting' | 'note' | 'demo'
  | 'site_visit' | 'sms' | 'quote_sent';

export interface Touch {
  id: string;
  customerId: string;
  contactId?: string;
  opportunityId?: string;
  projectId?: string;
  type: TouchType;
  summary: string;
  detail?: string;
  userId?: string;
  userName?: string;
  occurredAt: number;
  createdAt: number;
}

// ── Tasks (follow-ups) ────────────────────────────────────────────
export type TaskStatus = 'open' | 'done' | 'snoozed';

export interface Task {
  id: string;
  customerId?: string;
  contactId?: string;
  opportunityId?: string;
  projectId?: string;
  title: string;
  detail?: string;
  status: TaskStatus;
  dueDate?: number;
  snoozedUntil?: number;
  assignedUserId?: string;
  assignedUserName?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

// ─────────────────────────── Project tree ─────────────────────────
export interface Project {
  id: string;
  name: string;
  customerId?: string;
  siteId?: string;
  status: 'design' | 'review' | 'install' | 'live' | 'archived';
  lifecyclePhase: LifecyclePhase;
  team?: number;
  progress?: number; // 0..100 — surface-level; real progress derives from phase
  updated?: string;  // human label, e.g. "2h ago"
  createdAt: number; // ms epoch
  updatedAt: number;

  // ── Lifecycle metadata ──
  /** When the current phase began. */
  phaseStartedAt?: number;
  /** Last touch on phase data (item completion, role swap, next action edit). */
  phaseUpdatedAt?: number;
  /** Set when the phase officially completes (advance moves to next phase). */
  phaseCompletedAt?: number;
  /** Per-phase checklist completion state.
   *  Shape: { [phaseId]: { [itemId]: true } } */
  phaseItems?: Partial<Record<LifecyclePhase, Record<string, boolean>>>;

  // ── Assignments ──
  assignedSalesUserId?: string;
  assignedEngineerUserId?: string;
  assignedEstimatorUserId?: string;
  assignedPMUserId?: string;

  // ── Operational state ──
  priority?: 'low' | 'normal' | 'high' | 'critical';
  dueDate?: number;
  /** Short imperative copy shown on the project card and command center
   *  describing the next concrete step. Auto-filled when phase changes but
   *  editable. */
  nextAction?: string;
  healthStatus?: HealthStatus;

  // ── CRM linkage ──
  /** Set when this project was spawned from a won Opportunity. */
  opportunityId?: string;
  /** Optional projected contract value carried over from the opportunity. */
  contractValue?: number;
}

// ─────────────────────────── Activity feed ────────────────────────
// One log entry per meaningful change. Surfaced on the project command
// center; later we may roll up across projects for a global feed.
export type ActivityType =
  | 'phase_changed'
  | 'phase_item_completed'
  | 'phase_item_uncompleted'
  | 'device_added'
  | 'device_moved'
  | 'device_updated'
  | 'device_duplicated'
  | 'device_removed'
  | 'estimate_viewed'
  | 'proposal_generated'
  | 'customer_review_opened'
  | 'commission_test_pass'
  | 'commission_test_fail'
  | 'health_changed'
  | 'note_added'
  // CRM
  | 'opportunity_created'
  | 'opportunity_stage_changed'
  | 'opportunity_won'
  | 'opportunity_lost'
  | 'opportunity_converted'
  | 'touch_logged'
  | 'task_created'
  | 'task_completed'
  | 'contact_added';

export interface ActivityItem {
  id: string;
  /** Project context (if any). Optional now — CRM events (opp created,
   *  touch logged) can pre-date project existence. */
  projectId?: string;
  customerId?: string;
  opportunityId?: string;
  type: ActivityType;
  message: string;
  userName?: string;
  createdAt: number;
  relatedEntityId?: string;
}

export interface Site {
  id: string;
  projectId: string;
  name: string;
  address: string;
}

export interface Building {
  id: string;
  siteId: string;
  name: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  name: string;
  level: number;     // 0 = ground, 1 = level 2, -1 = basement
  source: 'blueprint' | 'satellite' | 'sketch' | 'blank';
  /** Scale: 1 canvas pixel = scalePxToFt feet. Set by /calibrate. */
  scalePxToFt: number;
  /** User-drawn walls (in canvas px). */
  walls: Wall[];
  /** Floorplan polygon (corners) — survives reload via the floorplanGeometry
   *  store, but mirrored here so the canvas can render even before that store
   *  is initialized. Optional. */
  corners?: { x: number; y: number }[];
  rooms?: { id: string; name: string; corners: { x: number; y: number }[] }[];
}

export interface Wall {
  id: string;
  x1: number; y1: number; x2: number; y2: number;
}

// ─────────────────────────── Hardware (canvas devices) ────────────
// Keep DeviceType in sync with EngineeringCanvas — these strings drive the
// glyph + cone + toolbar branches.
export type DeviceType =
  | 'cam.bullet' | 'cam.dome' | 'cam.ptz' | 'cam.multisensor' | 'cam.fisheye' | 'cam.thermal' | 'cam.lpr' | 'cam.body'
  | 'acc.reader' | 'acc.strike' | 'acc.maglock' | 'acc.rex' | 'acc.exit' | 'acc.door' | 'acc.gate' | 'acc.biometric'
  | 'net.idf'   | 'net.mdf'    | 'net.switch'  | 'net.ap'    | 'net.firewall' | 'net.bridge' | 'net.fiber' | 'net.copper' | 'net.wireless'
  | 'pwr.ups'   | 'pwr.poe'    | 'pwr.surge'   | 'pwr.solar'
  | 'sen.motion' | 'sen.glass' | 'sen.contact' | 'sen.panic' | 'sen.smoke'
  | 'aud.speaker' | 'aud.intercom' | 'aud.horn' | 'aud.amp'
  | 'sto.nvr' | 'sto.cloud' | 'sto.server'
  | 'dis.monitor' | 'dis.video-wall' | 'dis.kiosk';

export type DeviceKind = 'camera' | 'access' | 'network' | 'power' | 'sensor' | 'audio' | 'storage' | 'display' | 'intrusion';

export type LensId = 'a' | 'b' | 'c' | 'd';
export type ActiveLens = LensId | 'all';
export type LensMode = 'linked' | 'independent';

export interface LensCfg {
  rotation: number; // °, relative to device body
  fov: number;      // horizontal °
  range: number;    // ft, DORI Detect bound
  focal: number;    // mm
  enabled: boolean;
}

export interface Device {
  id: string;
  projectId: string;
  floorId: string;
  type: DeviceType;
  /** Cosmetic label (room / location) — e.g. "Lobby NE". */
  label: string;
  /** Product catalog id — see lib/catalog if used. */
  product: string;
  x: number; y: number;
  rot: number;     // ° body rotation
  // Lens engineering (single-cam):
  focal?: number;
  fov?: number;
  range?: number;
  mountFt?: number;
  ir?: boolean;
  ndaa?: boolean;
  // Multisensor only:
  lenses?: { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg };
  lensMode?: LensMode;
  // Free-form:
  notes?: string;
  /** Other entity ids this device is linked to (pathway endpoint, parent IDF, etc.). */
  linkedIds?: string[];
  /** Commissioning state per phase — present once commissioning starts. */
  commissioning?: {
    install?: 'pending' | 'pass' | 'fail';
    firmware?: 'pending' | 'pass' | 'fail';
    network?: 'pending' | 'pass' | 'fail';
    signal?: 'pending' | 'pass' | 'fail';
    signedOff?: boolean;
    notes?: string;
  };
}

// ─────────────────────────── Doors & hardware ─────────────────────
export type DoorType = 'single' | 'double' | 'storefront' | 'roll-up' | 'gate' | 'elevator' | 'vestibule';
export type DoorMaterial = 'hollow-metal' | 'wood' | 'aluminum' | 'glass';
export type DoorHardware = 'reader' | 'strike' | 'maglock' | 'rex' | 'contact' | 'intercom' | 'panic' | 'autoop' | 'controller' | 'psu';

export interface Door {
  id: string;
  projectId: string;
  floorId: string;
  x: number; y: number;
  rot: number;
  width: number;            // inches
  doorType: DoorType;
  material: DoorMaterial;
  fireRated?: boolean;
  ada?: boolean;
  hardware: DoorHardware[];
  electrification?: 'fail-safe' | 'fail-secure';
  readerLocation?: 'mullion' | 'wall';
  notes?: string;
  media?: string[];         // urls to attached photos
}

// ─────────────────────────── Pathways ─────────────────────────────
export type PathwayType = 'conduit' | 'tray' | 'open' | 'fiber' | 'wireless' | 'underground' | 'flex';
export type CableType = 'cat6' | 'cat6a' | 'fiber-sm' | 'fiber-mm' | 'coax' | 'power' | 'composite';

export interface Pathway {
  id: string;
  projectId: string;
  floorId: string;
  type: PathwayType;
  /** Ordered waypoints (canvas px). */
  points: { x: number; y: number }[];
  sourceId?: string;       // device or IDF id
  destinationId?: string;
  cableType: CableType;
  cableCount: number;
  conduitFill?: number;    // 0..1 (NEC fill ratio)
  lengthFt?: number;       // optional — can be derived from points + scale
  notes?: string;
}

// ─────────────────────────── IDF / network rack ───────────────────
export interface IDF {
  id: string;
  projectId: string;
  floorId: string;
  x: number; y: number;
  name: string;            // e.g. "IDF-1"
  switches?: { model: string; portsPoe: number; portsTotal: number; poeBudgetW: number }[];
  power?: { upsModel?: string; upsRuntimeMin?: number; loadW?: number };
  notes?: string;
}

// ─────────────────────────── Estimate ─────────────────────────────
export interface EstimateLine {
  id: string;
  sourceKind: 'device' | 'door' | 'pathway' | 'idf' | 'labor' | 'manual';
  sourceId?: string;        // entity that generated this line
  sku?: string;
  description: string;
  qty: number;
  uom?: string;             // 'ea' | 'ft' | 'hr'
  unitPrice: number;
  laborHours?: number;
}

export interface Estimate {
  id: string;
  projectId: string;
  lines: EstimateLine[];
  laborRate: number;         // $/hr
  markup: number;            // 0..1, e.g. 0.18 = 18%
  notes?: string;
}
