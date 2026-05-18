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
  // Default to selected-only labels — the canvas should be calm at first
  // glance; users opt into more visual density via the Layers panel.
  labelDensity:    'selected',
  // 55% reads as a quiet architectural overlay rather than a neon HUD.
  // Default FOV cone opacity. Quieter than the original 55 so dense
  // canvases read more like a surveyor's plan than a cartoon heatmap.
  // Users can still dial it up via canvas display preferences.
  coverageOpacity: 38,
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

  // ── Intake scope (Phase 4C) ──
  /** What kind of engagement this is. Drives canvas defaults + the
   *  project card label. */
  scopeKind?: 'new-build' | 'retrofit' | 'expansion' | 'managed-service-takeover';
  /** Existing security systems the customer already has in place at
   *  intake. Drives canvas pre-population + estimator notes. */
  existingSystems?: Array<'camera-vms' | 'access-control' | 'intrusion' | 'fire-alarm' | 'network' | 'bas' | 'none'>;
  /** Budget bracket selected at intake. Operator-readable label. */
  budgetRange?: 'under-50k' | '50k-150k' | '150k-500k' | '500k-2m' | 'over-2m';
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
  projectId?: string;
  buildingId: string;
  name: string;
  level: number;     // 0 = ground, 1 = level 2, -1 = basement
  source: 'blueprint' | 'satellite' | 'sketch' | 'blank';
  /** Scale: 1 canvas pixel = scalePxToFt feet. Set by /calibrate. */
  scalePxToFt: number;
  /** When the user last confirmed the scale via /calibrate. Presence (not
   *  the numeric value of scalePxToFt) is what marks a floor as "really
   *  calibrated" — a seeded default of 0.05 ft/px with no calibratedAt is
   *  *not* the same as a user who measured and got 0.05 ft/px back. */
  calibratedAt?: number;
  /** Real-world feet the user entered during calibration. */
  calibrationReferenceFt?: number;
  /** Measured pixel distance between the two reference points at
   *  calibration time. Persisted so future re-renders / re-calibrations
   *  can show the user what they previously measured. */
  calibrationMeasuredPx?: number;
  /** User-drawn walls (in canvas px). */
  walls: Wall[];
  /** Floorplan polygon (corners) — survives reload via the floorplanGeometry
   *  store, but mirrored here so the canvas can render even before that store
   *  is initialized. Optional. */
  corners?: { x: number; y: number }[];
  rooms?: { id: string; name: string; corners: { x: number; y: number }[] }[];
  /** Imported floorplan background. Set when the user runs Import Floorplan
   *  (PNG / JPG / PDF first page) or when VisionScan imports a generated
   *  plan. The data URL is held inline so the file survives a refresh
   *  without a backend object store. Large files are downscaled before
   *  storage to keep localStorage manageable. */
  background?: FloorBackground;
}

export interface FloorBackground {
  /** Data URL — image/png or image/jpeg, downscaled to max 2048px on long
   *  edge so localStorage stays under a few MB. */
  dataUrl: string;
  /** Original filename (for re-export and the inspector). */
  fileName: string;
  /** Source: user-imported file vs VisionScan-generated synthetic. */
  origin: 'pdf' | 'png' | 'jpg' | 'visionscan';
  /** Top-left canvas-px position of the image. */
  x: number;
  y: number;
  /** Display scale (1 = native pixels). */
  scale: number;
  /** Rotation in degrees, CW. */
  rotation: number;
  /** 0–1 opacity. */
  opacity: number;
  /** Native image pixel dimensions. */
  naturalWidth: number;
  naturalHeight: number;
  /** Locked = no accidental drag. */
  locked?: boolean;
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
  /** Per-object color override (hex). When set, this color drives the device
   *  glyph tone, the cone tone, and the label tone — overriding the default
   *  category color. Used for visually grouping infrastructure by site
   *  function (e.g. all loading-dock cameras orange, all perimeter blue).
   *  Constrained to the DEVICE_COLOR_PALETTE for visual coherence. */
  color?: string;
  /** Other entity ids this device is linked to (pathway endpoint, parent IDF, etc.). */
  linkedIds?: string[];
  /** When a cable accessory (jack / coupler / pull box / firestop / J-hook)
   *  is placed near a pathway, it auto-attaches; the attached pathway id
   *  lives here so the drawer + BOM can roll up the accessory under that
   *  route. Also used by patch panels that anchor to an IDF host. */
  attachedPathwayId?: string;
  /** Free-form sub-kind for cable accessories so the canvas can label
   *  them ("Jack" / "Coupler" / "Pull box" / etc.) without a per-type
   *  DeviceType expansion. */
  accessoryKind?: 'jack' | 'jack-shld' | 'coupler' | 'patchcord' | 'pp24' | 'pp48' | 'pullbox' | 'jbox' | 'jhook' | 'tray' | 'firestop' | 'sleeve';
  /** Hardware stack — ordered list of accessory device-ids that are physically
   *  mounted on this host (door, gate, infrastructure object). The host
   *  renders a small stack-count chip; the inspector lists each accessory.
   *  When the host moves, the stack moves with it. Mirrored to each
   *  accessory's linkedIds so the relationship is queryable from either end. */
  stack?: string[];
  /** Accessory product-ids tied to this device — mounts, junction boxes,
   *  poles, etc. Drives the camera inspector "Accessories" section and the
   *  BOM auto-rollup of mount hardware. */
  accessories?: string[];
  /** Commissioning state per phase — present once commissioning starts. */
  commissioning?: {
    install?: 'pending' | 'pass' | 'fail';
    firmware?: 'pending' | 'pass' | 'fail';
    network?: 'pending' | 'pass' | 'fail';
    signal?: 'pending' | 'pass' | 'fail';
    signedOff?: boolean;
    notes?: string;
  };
  // ── Door-as-device assembly (only meaningful when type starts with 'inf.door',
  //    'inf.gate', 'inf.storefront', 'inf.doubledoor'). Persists the access-control
  //    components attached to this opening as one coherent record, instead of
  //    spawning separate accessory devices on the canvas. The legacy `stack[]`
  //    field is kept for visual-stack flows but is no longer the source of truth
  //    for door hardware schedules / BOM rollups.
  doorAssembly?: DoorHardware[];
  /** Per-hardware-class Proposed / Existing state. Defaults to
   *  'proposed' for any hw added by drag-attach (we assume new
   *  drops are part of the proposed design). The user can flip a
   *  row to 'existing' to mark hardware already on the opening so
   *  the BOM reads "to add" vs "already there" cleanly. Only keys
   *  for hw classes present in `doorAssembly` are meaningful. */
  doorAssemblyState?: Partial<Record<DoorHardware, 'proposed' | 'existing'>>;
  /** Door electrification, when relevant. */
  doorElectrification?: 'fail-safe' | 'fail-secure';
  /** Where the reader physically sits on the opening. */
  doorReaderLocation?: 'mullion' | 'wall';
  /** Survey status — used by the Survey tile + project rollups. */
  surveyStatus?: 'todo' | 'verified' | 'issue' | 'skip';
}

// ─────────────────────────── Doors & hardware ─────────────────────
export type DoorType = 'single' | 'double' | 'storefront' | 'roll-up' | 'gate' | 'elevator' | 'vestibule';
export type DoorMaterial = 'hollow-metal' | 'wood' | 'aluminum' | 'glass';
export type DoorHardware =
  | 'reader'
  | 'strike'
  | 'maglock'
  | 'rex'
  | 'dps'           // door position switch — distinct from a "contact" sensor pair
  | 'contact'
  | 'intercom'
  | 'panic'
  | 'autoop'
  | 'controller'
  | 'psu';

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

// ─────────────────────────── Survey capture ──────────────────────
// One note / checklist item attached to a specific object on a floor.
// Surveyors capture these on-site as they walk; engineering reads them
// back from the inspector while validating placement and BOM. Photo
// blobs aren't stored inline yet — only honest metadata placeholders
// pointing at a pending upload. Persists with the rest of the project.
export type SurveyObjectType = 'device' | 'door' | 'pathway' | 'idf' | 'floor';
export type SurveyItemStatus = 'todo' | 'verified' | 'issue' | 'skip';
export type SurveyItemKind = 'note' | 'check';

export interface SurveyPhotoPlaceholder {
  /** Original filename the surveyor named the photo (best-effort). */
  fileName: string;
  /** Bytes — only when known. */
  sizeBytes?: number;
  /** When the photo was captured / queued (ms epoch). */
  capturedAt?: number;
  /** Honest disclosure: real blob upload pending. */
  pendingUpload: true;
  /** Optional free-form caption. */
  caption?: string;
}

export interface SurveyItem {
  id: string;
  projectId: string;
  /** Floor the surveyed object lives on. Optional for project-level items. */
  floorId?: string;
  /** Type of the object this note hangs off. */
  objectType: SurveyObjectType;
  /** ID of the object — Device.id / Door.id / Pathway.id / IDF.id / Floor.id. */
  objectId: string;
  kind: SurveyItemKind;
  text: string;
  status: SurveyItemStatus;
  /** Display name of the surveyor / engineer (demo data uses 'Field demo'). */
  author?: string;
  createdAt: number;
  updatedAt: number;
  /** Optional photo metadata — real upload pending. */
  photo?: SurveyPhotoPlaceholder;
}

// ─────────────────────────── Site walk captures ───────────────────
// Mobile-first field captures the operator takes BEFORE there's a canvas
// object to attach to. A SurveyItem hangs off a placed device / door /
// pathway / IDF / floor; a SiteCapture is the raw pre-design observation
// (photo + voice memo + room label) gathered during the site walk. They
// can be promoted to SurveyItems later once devices are placed.
//
// Honesty: photo + audio are inline base64 because there's no upload
// backend. The store is local-storage backed, so a single project's
// captures are practically capped at a few dozen items before the
// browser quota bites. The UI shows the operator a running quota meter
// and offers PDF export so nothing has to live in the browser forever.
export interface SiteCapture {
  id: string;
  projectId: string;
  /** Room or area label, e.g. "Lobby NE", "IDF-A closet", "Loading dock". */
  label: string;
  /** Optional free-form note typed or dictated by the operator. */
  note?: string;
  /** Optional inline photo data URL (downscaled JPEG). */
  photoDataUrl?: string;
  /** Approx bytes of the photo for the storage meter. */
  photoBytes?: number;
  /** Optional inline voice memo data URL (audio/webm or audio/mp4). */
  audioDataUrl?: string;
  /** Voice memo runtime in milliseconds. */
  audioDurationMs?: number;
  /** Approx bytes of the audio for the storage meter. */
  audioBytes?: number;
  /** Optional GPS fix if the operator granted geolocation. */
  lat?: number;
  lng?: number;
  /** Who captured it (display name from userPrefs at capture time). */
  author?: string;
  createdAt: number;
  updatedAt: number;
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
  targetId?: string;       // alias for bundle target IDF/rack
  cableType: CableType | string;
  cableCount: number;
  conduitFill?: number;    // 0..1 (NEC fill ratio)
  /** When multiple paths share a bundleId, the canvas / inspector
   *  collapses them into one labelled bundle. */
  bundleId?: string;
  /** Conduit assignment for this run / bundle. Type + trade size as a
   *  string ("EMT 3/4\"") + fill % at last calculation. */
  conduitType?: 'EMT' | 'PVC' | 'FMC' | 'LFMC' | 'raceway' | 'tray' | 'none';
  conduitSize?: string;    // e.g. '3/4"', '1"', '1-1/4"'
  /** Assigned IDF patch panel + port + switch + port for sequential
   *  schedules. Written by the IDF port-schedule helper, persisted
   *  here so refresh shows the same assignment. */
  patchPort?: number;
  switchPort?: number;
  /** Tally of cable accessories counted into BOM for this run/bundle. */
  accessories?: Partial<Record<'jack' | 'coupler' | 'patchcord' | 'label' | 'pullbox' | 'jhook' | 'tray' | 'firestop', number>>;
  /** When this pathway is a standalone conduit / cable tray / J-hook
   *  run (not a cable bundle), this carries the placement kind. Cable
   *  bundles leave it undefined. */
  pathwayKind?: 'cable' | 'conduit' | 'tray' | 'jhook' | 'sleeve' | 'raceway' | 'duct';
  /** When a placed device (jack / coupler / pull box / etc.) attaches
   *  itself to a route, the route's id lands here on the device so the
   *  drawer can show "Attached to PW-XX" and BOM can roll it up. */
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

// ═══════════════════════════════════════════════════════════════════
// ATTACHMENTS — local file metadata + (small) image previews
// ═══════════════════════════════════════════════════════════════════
// Single shared model used by canvas device/door/pathway inspectors,
// the deployment work-order photo section, and the reports center
// attachments grid. Persisted in its own `attachments` slice keyed by
// id so individual entities don't have to carry their own arrays.
//
// Storage rules (honest local-only contract):
//   - Small images (≤ ~256 KB raw, downsampled to max 800px on long
//     edge as JPEG q0.8) are stored as `dataUrl` so the panel can
//     render thumbnails. `storageMode: 'local-preview'`.
//   - Larger files OR non-image types are stored as metadata only
//     (filename, size, MIME, category). `storageMode: 'local-meta'`.
//     The user sees a file-card without a preview.
//   - `storageMode: 'cloud'` is reserved for the future backend pass;
//     no path produces it today.
// Cloud file storage is not connected; the panel says so.

export type AttachmentLinkType =
  | 'project' | 'floor' | 'device' | 'door' | 'pathway' | 'workOrder' | 'report';

export type AttachmentCategory =
  | 'photo' | 'video' | 'pdf' | 'spec' | 'drawing' | 'closeout' | 'note' | 'other';

export type AttachmentStorageMode = 'local-preview' | 'local-meta' | 'cloud';

export interface Attachment {
  id: string;
  projectId: string;
  linkedObjectType: AttachmentLinkType;
  linkedObjectId: string;
  fileName: string;
  /** MIME type as reported by the File object (`image/jpeg` etc). */
  fileType: string;
  /** Original file size in bytes. */
  fileSize: number;
  category: AttachmentCategory;
  uploadedBy?: string;
  createdAt: number;
  updatedAt?: number;
  notes?: string;
  /** When true, this attachment + its notes are hidden in the Reports
   *  Center customer view. The internal view always shows them. */
  internalOnly?: boolean;
  /** Data URL preview. Present only when `storageMode === 'local-preview'`. */
  dataUrl?: string;
  storageMode: AttachmentStorageMode;
}

// ═══════════════════════════════════════════════════════════════════
// PROJECT PRICEBOOK — per-project price + labor + markup overrides
// ═══════════════════════════════════════════════════════════════════
// Editable in the BOM drawer's Pricebook editor. Each entry overrides
// the corresponding default (DOOR_HARDWARE_PRICE / CABLE_UNIT_PRICE /
// estimate.laborRate / estimate.markup) for one project only. Empty
// overrides fall through to defaults so missing pricebook == legacy
// behaviour. The overrides survive reload via the workOrderProgress-
// adjacent `projectPricebooks` slice.

export interface DoorHardwarePricebookEntry {
  /** USD override for the hardware unit price. Undefined = inherit default. */
  price?: number;
  /** Labor-hour override for the install of this hardware. Undefined = inherit. */
  labor?: number;
}

export interface ProjectPricebook {
  projectId: string;
  /** Door hardware overrides — keyed by `DoorHardware` id. */
  doorHardware?: Partial<Record<DoorHardware, DoorHardwarePricebookEntry>>;
  /** Cable per-foot overrides — keyed by `CableType` string. */
  cablePerFt?: Partial<Record<string, number>>;
  /** Project labor rate override ($/hr). */
  laborRate?: number;
  /** Project markup override (0..1, e.g. 0.18 = 18%). */
  markup?: number;
  updatedAt: number;
}

// ═══════════════════════════════════════════════════════════════════
// PROJECT STATE ENVELOPE — export / import for shared-demo sync
// ═══════════════════════════════════════════════════════════════════
// Lets the user move project state between local + live without a
// backend. Carries the canvas surfaces (project, customer, site,
// buildings, floors, devices, doors, pathways, IDFs, estimates) plus
// derived-but-mutable progress (workOrderProgress, surveyItems) and
// per-project UI prefs (canvasLayers, canvasDisplay, projectMode,
// projectTechModel). Each entity carries its full record so the import
// side can replace this project's slice without touching other
// projects' records.
//
// `version` is the envelope schema version, NOT the store persist
// version. Bump when the envelope shape changes.

/** Summary returned by `importProjectState` so callers can surface
 *  a single end-of-import toast rather than spamming one per
 *  rejected record. Counts attachments accepted, attachments dropped
 *  for validation failure or projectId mismatch, and attachments
 *  whose id collided with a preserved (different-project) record so
 *  the import had to rename them. */
export interface ImportSummary {
  acceptedAttachments: number;
  rejectedAttachments: number;
  /** Per-reason counts, suitable for human-readable concatenation
   *  ("3 · bad-dataUrl · 1 · oversize-fileSize"). */
  rejectionReasons: Record<string, number>;
  /** Number of incoming attachments whose id was already in use by a
   *  different project; import renamed them with an `-imp-...`
   *  suffix to preserve the existing record. */
  renamedAttachments: number;
}

export interface ProjectStateEnvelope {
  /** Always "deeper-vision-project-state" so we can refuse to import
   *  arbitrary JSON. */
  kind: 'deeper-vision-project-state';
  /** Envelope schema version. Bump for breaking changes. */
  version: 1;
  /** When the export ran (epoch ms). */
  exportedAt: number;
  /** Build label captured at export time so the import side can warn
   *  if the source was from a different app version. */
  buildLabel?: string;
  /** ID of the project whose state this envelope carries. */
  projectId: string;
  /** Cosmetic display fields so the import-confirmation modal can show
   *  "Replace 'Acme HQ — Austin' with 24 devices?" without rehydrating. */
  summary: {
    projectName: string;
    deviceCount: number;
    pathwayCount: number;
    doorCount: number;
    idfCount: number;
    floorCount: number;
    workOrderProgressCount: number;
  };
  data: {
    project: Project;
    customer?: Customer;
    sites: Site[];
    buildings: Building[];
    floors: Floor[];
    devices: Device[];
    doors: Door[];
    pathways: Pathway[];
    idfs: IDF[];
    estimates: Estimate[];
    surveyItems: SurveyItem[];
    workOrderProgress: WorkOrderProgress[];
    /** Per-project UI prefs — optional. */
    canvasLayers?: CanvasLayerState;
    canvasDisplay?: CanvasDisplayPrefs;
    projectMode?: ProjectMode;
    projectTechModel?: ProjectTechModel;
    /** Per-project pricebook overrides — optional. When present, takes
     *  precedence over `DOOR_HARDWARE_PRICE` / `CABLE_UNIT_PRICE` /
     *  the estimate's labor + markup for this project on the import side. */
    pricebook?: ProjectPricebook;
    /** Project-scoped attachments. Optional in the envelope so older
     *  exports load without complaint; absent on import means "wipe
     *  this project's attachments locally". */
    attachments?: Attachment[];
  };
}

// ═══════════════════════════════════════════════════════════════════
// FIELD DEPLOYMENT / WORK ORDERS
// ═══════════════════════════════════════════════════════════════════
// Work orders are derived from canvas state (one per camera / door /
// pathway / IDF) and merged with persisted progress in WorkOrderProgress.
// Progress is mutable: status, completed checklist ids, photo
// placeholders, serial / MAC, blocker text, and field notes. The
// generated WorkOrder shape (kind, title, checklist) re-derives every
// render so a freshly added device gets its WO without any export step.

export type WorkOrderStatus = 'ready' | 'assigned' | 'on-site' | 'installing' | 'testing' | 'complete' | 'blocked';
export type WorkOrderKind = 'camera' | 'door' | 'pathway' | 'idf';

export interface WorkOrderChecklistItem {
  id: string;
  label: string;
}

export interface WorkOrderPhotoPlaceholder {
  id: string;
  fileName: string;
  /** Best-effort field; we capture metadata only because real upload is pending. */
  sizeKb?: number;
  addedAt: number;
  /** Optional tag — e.g. "before", "after", "wiring", "labeling". */
  tag?: string;
}

/** Persisted, mutable progress for a derived work order. Keyed by
 *  `wo-${kind}-${sourceId}` so the same record sticks to a device even
 *  if other fields change. */
export interface WorkOrderProgress {
  id: string;
  status: WorkOrderStatus;
  /** Stored when status flips to 'blocked' so unblock can restore. */
  prevStatus?: WorkOrderStatus;
  /** IDs of WorkOrderChecklistItem the field user has marked done. */
  completed: string[];
  assignedTo?: string;
  serial?: string;
  mac?: string;
  fieldNotes?: string;
  /** Active blocker text. Empty / undefined = no blocker. */
  blocker?: string;
  photoPlaceholders?: WorkOrderPhotoPlaceholder[];
  updatedAt: number;
}

/** Derived work order shape — assembled by `deriveWorkOrders`. The
 *  `progress` field is the merged persisted record (with seeded defaults
 *  when the WO has never been touched). */
export interface WorkOrder {
  id: string;
  kind: WorkOrderKind;
  sourceId: string;
  title: string;
  subtitle?: string;
  /** Building / floor summary. */
  location?: string;
  /** Default role label — "Camera tech", "Access integrator", etc. */
  role: string;
  priority: 'low' | 'med' | 'high';
  estLaborHours: number;
  checklist: WorkOrderChecklistItem[];
  progress: WorkOrderProgress;
}

// Per-source BOM rows used by the canvas-side BOM drawer. Unlike
// EstimateLine (which aggregates devices by SKU), one row = one
// canvas object so the drawer can click a row and select the
// originating device / door hardware / pathway on the floorplan.
export type CanvasBomCategory = 'cameras' | 'access' | 'network' | 'cabling' | 'labor' | 'other';
export interface CanvasBomRow {
  id: string;
  category: CanvasBomCategory;
  /** Where the row came from on the canvas. Drives the row-click selection. */
  sourceKind: 'device' | 'door' | 'pathway' | 'idf' | 'labor';
  /** Device / door / pathway / idf id — selecting this on the canvas focuses the source object. */
  sourceId?: string;
  /** Whether this row represents existing (already-on-site) hardware. Existing rows
   *  are documented but excluded from proposed totals. */
  isExisting: boolean;
  description: string;
  /** Short context label (e.g. "Door · door-12", "Run · pw-04", "Bullet · cam-7"). */
  meta?: string;
  /** Manufacturer / model line when known. Empty otherwise. */
  product?: string;
  qty: number;
  uom: string;               // 'ea' | 'ft' | 'hr'
  unitPrice: number;
  laborHours: number;
  /** True when unitPrice came back as 0 (no catalog hit + no UNIT_PRICE entry). */
  missingPrice: boolean;
  /** True when this row's unitPrice or laborHours came from a project-pricebook override. */
  overridden?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// THREAT DRILL SIMULATOR — emergency-readiness planning module
// ═══════════════════════════════════════════════════════════════════
// Defensive-only. Models how the engineered infrastructure responds
// during emergency drills; identifies coverage gaps, protocol gaps,
// and accountability gaps. Never models attacker tactics.

export type ScenarioType =
  | 'lockdown-drill'
  | 'shelter-in-place'
  | 'secure-perimeter'
  | 'unauthorized-entry'
  | 'forced-door-event'
  | 'panic-button-event'
  | 'bus-loop-emergency'
  | 'after-hours-intrusion';

export type ScenarioZoneKind =
  // Safe / response
  | 'safe-room'
  | 'lockdown-zone'
  | 'reunification'
  | 'staff-command'
  | 'first-responder-staging'
  | 'medical-triage'
  | 'bus-staging'
  // Accountability
  | 'classroom'
  | 'cafeteria'
  | 'gym'
  | 'restroom'
  | 'exterior';

export interface ScenarioZone {
  id: string;
  kind: ScenarioZoneKind;
  /** Display label, e.g. "Classroom 204" */
  label: string;
  /** Rectangle (canvas-px) defining the zone footprint. */
  rect: { x: number; y: number; w: number; h: number };
  /** Estimated occupancy used by the readiness calc. */
  occupancy?: number;
  /** Free-form protocol notes the planner attaches to this zone. */
  notes?: string;
}

/** Threat marker + ordered waypoints. Single path per scenario for v1;
 *  the schema supports multiple via runs[]. */
export interface ScenarioRun {
  id: string;
  label: string;
  /** Start point (canvas-px). */
  start: { x: number; y: number };
  /** Ordered waypoints the planner draws after the start. */
  waypoints: { x: number; y: number; tSec: number }[];
  /** Drill speed multiplier for playback. */
  speedX: number;
}

export type ProtocolSection =
  | 'lockdown-triggers'
  | 'communication-tree'
  | 'pa-announcements'
  | 'classroom-response'
  | 'common-area-response'
  | 'student-accountability'
  | 'reunification'
  | 'all-clear'
  | 'after-action';

export interface ProtocolStep {
  id: string;
  section: ProtocolSection;
  /** What the protocol says, verbatim or paraphrased. */
  text: string;
  /** Device-ids on the canvas this step depends on (door / cam / PA). */
  mappedDeviceIds: string[];
  /** Author-tagged owner role (e.g. "Front-office staff", "SRO"). */
  owner?: string;
  /** Done flag for the after-action review. */
  verified?: boolean;
}

export interface ScenarioProtocol {
  version: string;
  source: 'manual' | 'uploaded' | 'ai-draft';
  uploadedFile?: { name: string; bytes: number };
  steps: ProtocolStep[];
}

export interface ScenarioGap {
  id: string;
  severity: 'high' | 'med' | 'low';
  kind: 'blind-spot' | 'no-lockdown' | 'no-pa' | 'no-accountability'
      | 'no-rex' | 'protocol-gap' | 'occupancy-overflow' | 'network-spof';
  label: string;
  detail: string;
  /** Optional zone or device focus for the canvas chip. */
  focusZoneId?: string;
  focusDeviceIds?: string[];
  /** AI suggestion (string for now; structured object later). */
  suggestion?: string;
  /** Approximate dollar cost to close, if knowable. */
  estimatedFixCost?: number;
}

export interface Scenario {
  id: string;
  projectId: string;
  name: string;
  type: ScenarioType;
  /** Free-form site descriptor — typically "Campus / Building / Floor". */
  campus?: string;
  buildingId?: string;
  floorId?: string;
  /** Estimated population in scope at scenario time. */
  occupancy?: number;
  /** "School day · morning bell" — used by AI to pick sensible defaults. */
  timeOfDay?: 'pre-school' | 'morning' | 'midday' | 'afternoon' | 'after-school' | 'evening' | 'overnight';
  /** Drill objective in plain English. */
  objective?: string;
  /** Operational assumptions ("All exterior doors locked", etc.). */
  assumptions?: string;
  /** Protocol attached to this scenario. */
  protocol: ScenarioProtocol;
  /** Zones drawn on the canvas. */
  zones: ScenarioZone[];
  /** Threat marker + waypoints. Empty until placed. */
  runs: ScenarioRun[];
  /** Computed gaps from the last simulation. */
  gaps: ScenarioGap[];
  /** Computed readiness score 0–100. */
  readinessScore?: number;
  /** ISO timestamp of last simulation run. */
  lastSimulatedAt?: number;
  /** Author-tagged history note for the version chip. */
  versionLabel?: string;
}

// ═══════════════════════════════════════════════════════════════════
// BUS SECURITY DESIGNER — fleet vehicle security infrastructure
// ═══════════════════════════════════════════════════════════════════

export type BusType =
  | 'type-a' | 'type-c' | 'type-d'
  | 'transit' | 'activity' | 'special-needs' | 'van';

/** Camera mounting position on the bus body (top-down + side views
 *  share the same enum so the UI can render either). */
export type BusCameraLocation =
  | 'driver-area'         // facing driver
  | 'aisle-front'         // dome above front rows
  | 'aisle-mid'           // dome above middle rows
  | 'aisle-rear'          // dome above rear rows
  | 'door-entry'          // entry doorway
  | 'rear-cabin'          // wide-angle inside rear
  | 'road-forward'        // forward exterior windshield
  | 'road-rear'           // rearview exterior
  | 'side-left'           // exterior left side
  | 'side-right'          // exterior right side
  | 'stop-arm'            // stop-arm enforcement
  | 'wheelchair-lift'     // lift bay coverage
  | 'lpr';                // license-plate capture

export interface BusCamera {
  id: string;
  busId: string;
  location: BusCameraLocation;
  /** Position in the top-down bus template (0..1 normalized along bus length / width). */
  uX: number;
  uY: number;
  /** Heading in degrees, 0 = facing front of bus. */
  rot: number;
  /** Horizontal field of view. */
  fov: number;
  /** Effective range in feet at design-grade resolution. */
  rangeFt: number;
  /** DVR channel binding — must be unique per bus. */
  dvrChannel?: number;
  /** Catalog product id (lookups into productCatalog SAMPLE_PRODUCTS). */
  productId?: string;
  /** Power draw in watts. */
  powerW?: number;
  /** Mount type for the BOM. */
  mount?: 'flush' | 'corner' | 'pendant' | 'pole' | 'side-window';
  /** IP / vandal rating summary. */
  rating?: string;
  notes?: string;
}

export type BusDVRType = 'mobile-dvr' | 'mobile-nvr' | 'cloud-bridge';
export interface BusDVR {
  id: string;
  busId: string;
  kind: BusDVRType;
  manufacturer: string;
  model: string;
  /** Total channels supported. */
  channels: number;
  /** Storage capacity in GB (SSD/SD). */
  storageGB: number;
  gps: boolean;
  lte: boolean;
  wifiOffload: boolean;
  /** Discrete sensor inputs (event button, stop-arm trigger, ignition). */
  sensorInputs: number;
  /** Power input voltage. */
  inputVDC: '12V' | '24V' | '12/24V';
  notes?: string;
}

export type BusCableKind = 'aviation' | 'ethernet' | 'power-harness' | 'gps-antenna' | 'event-button' | 'speaker';
export interface BusCableRoute {
  id: string;
  busId: string;
  kind: BusCableKind;
  /** Friendly label, e.g. "CAM-3 → DVR". */
  label: string;
  /** Path in bus template (0..1 normalized). */
  path: { x: number; y: number }[];
  /** Concealment difficulty signal — drives labor estimate. */
  difficulty: 'easy' | 'moderate' | 'difficult';
  lengthFt: number;
}

export interface BusEventInput {
  id: string;
  busId: string;
  kind: 'panic-button' | 'event-marker' | 'stop-arm-trigger' | 'ignition' | 'status-led' | 'driver-monitor' | 'touch-display';
  label: string;
  /** Wired to a DVR sensor input. */
  inputIndex?: number;
}

export interface BusCommissioningCheck {
  id: string;
  busId: string;
  step: string;
  status: 'pending' | 'pass' | 'fail';
  notes?: string;
}

export interface Bus {
  id: string;
  projectId: string;
  /** District-facing bus tag (e.g. "78"). */
  busTag: string;
  year?: number;
  make?: string;
  model?: string;
  vin?: string;
  busType: BusType;
  capacity?: number;
  hasWheelchairLift?: boolean;
  hasStopArm?: boolean;
  voltage: '12V' | '24V';
  batteryLocation?: string;
  fusePanelLocation?: string;
  /** Days of footage the design must retain. */
  retentionTargetDays: number;
  /** Cellular upload required. */
  cellularRequired: boolean;
  /** Wi-Fi offload at depot. */
  wifiOffload: boolean;
  /** Author-tagged stage. */
  status: 'draft' | 'engineered' | 'approved' | 'installed' | 'commissioned';
  notes?: string;
}

// ─────────────────────────── AI Assistant ─────────────────────────
// Phase 2A — operator-facing project intelligence. Conversations are
// the unit of persistence; each conversation belongs to a project so
// the assistant always has implicit scope.

/** Transient context an in-flight surface broadcasts to the
 *  Assistant. Phase 2A.2 — the assistant uses this as implicit
 *  scope so a question asked from a selected camera answers about
 *  that camera, not the whole project. NOT persisted; cleared on
 *  reload. */
export interface AssistantContext {
  /** Which shipped surface set the context. */
  surface: 'canvas' | 'reports' | 'deployment' | 'review' | 'projects' | 'dashboard' | 'project-center' | 'assistant';
  projectId?: string;
  /** When the operator is focused on a specific site within the
   *  project. Engine scopes counts / coverage to this site when no
   *  floor is set. */
  siteId?: string;
  siteName?: string;
  /** When the operator is focused on a specific floor (canvas, plan
   *  preview). The engine scopes counts / coverage to this floor. */
  floorId?: string;
  floorName?: string;
  /** When the operator has a specific entity selected. The engine
   *  scopes single-entity questions to this. `'workorder'` doubles
   *  as the field-deployment event type until a dedicated alert /
   *  monitoring event entity ships. */
  selectionKind?: 'device' | 'pathway' | 'idf' | 'workorder' | 'comment';
  selectionId?: string;
  selectionLabel?: string;
  /** Wall-clock when set, used by the assistant input chip to show
   *  a recent-ness signal. */
  updatedAt: number;
}

export type AiMsgRole = 'user' | 'assistant';

/** Source citation — points back at a concrete record the answer was
 *  derived from. The assistant must never claim a number it didn't
 *  cite; ungrounded statements are labeled 'inference'. */
export interface AiCitation {
  /** Display label rendered inside the chip ("CAM-101", "IDF-A"). */
  label: string;
  /** What kind of source — drives the open behavior on click. */
  kind: 'device' | 'door' | 'pathway' | 'idf' | 'floor' | 'project' | 'report' | 'workorder';
  /** Source id matching the entity record in the store. */
  refId: string;
  /** Optional explicit deep link override; otherwise derived from kind+refId. */
  href?: string;
}

export interface AiMsg {
  id: string;
  role: AiMsgRole;
  /** Body text. May be streamed in via patchAiMsgText. */
  text: string;
  /** Wall-clock when the message was created. */
  ts: number;
  /** Set true while a streaming response is still appending tokens. */
  streaming?: boolean;
  /** Inline source chips (only on assistant messages). */
  citations?: AiCitation[];
  /** Confidence tier when the message is a judgment / recommendation.
   *  Omit on plain answers. */
  confidence?: 'high' | 'medium' | 'low';
  /** Optional explanation rendered on confidence-chip hover. */
  confidenceWhy?: string;
  /** When set, the message is labeled as inference (no direct source
   *  data supports the specific claim). */
  inference?: boolean;
  /** Apply-suggestion buttons attached to the message. */
  actions?: AiAction[];
  /** Outcome log of any action the operator clicked Apply on. */
  applied?: AiAppliedRecord[];
}

/** Concrete, executable suggestion the assistant offers. Each action
 *  maps to a real store mutation; clicking Apply runs it and logs the
 *  result back into the message. */
export type AiAction =
  | { id: string; kind: 'add-device'; label: string; deviceType: string; nearFloorId?: string; hint?: string }
  | { id: string; kind: 'resolve-event'; label: string; refId: string; hint?: string }
  | { id: string; kind: 'assign-workflow'; label: string; refId: string; assignTo: string; hint?: string }
  | { id: string; kind: 'create-note'; label: string; body: string; hint?: string }
  | { id: string; kind: 'schedule-check'; label: string; refId: string; dueInDays: number; hint?: string }
  | { id: string; kind: 'generate-report'; label: string; reportKind: 'engineering' | 'customer' | 'commissioning'; hint?: string };

export interface AiAppliedRecord {
  actionId: string;
  appliedAt: number;
  /** Short user-visible result line ("Added CAM-110 on Ground floor"). */
  result: string;
  /** Whether the operator subsequently undid it. */
  undone?: boolean;
  /** Undo payload — opaque blob the action handler reads to reverse. */
  undoPayload?: any;
}

export interface AiConversation {
  id: string;
  projectId: string;
  /** First-message-derived title. The first user message becomes the
   *  title; if blank, "Untitled conversation". Operator can rename. */
  title: string;
  createdAt: number;
  updatedAt: number;
  /** Ordered message list. */
  messages: AiMsg[];
}

// ─────────────────────────── User preferences ─────────────────────
// Phase 3A — operator-scoped settings persisted to localStorage so
// the preferred theme / accent / language travels across sessions.
// Density is a Tailwind-level convenience: 'compact' tightens
// vertical rhythm via the data-density attribute on <html>; the
// chrome scale tokens stay the same. Accent is an optional override
// of --primary so an integrator can paint the app with their brand.

export interface UserPrefs {
  /** UI density (vertical rhythm). 'comfortable' is the default. */
  density: 'compact' | 'comfortable';
  /** Optional brand accent hex (e.g. '#7C3AED'). When set, applied
   *  via a CSS custom property override on <html>. Empty / unset =
   *  the theme's stock primary. */
  accent?: string;
  /** BCP-47 language tag (defaults to navigator.language at first
   *  read). */
  language: string;
  /** IANA time zone (defaults to Intl.DateTimeFormat resolvedOptions
   *  at first read). */
  timeZone: string;
  /** Optional display name + email + role headline. Profile fields
   *  for the Account tab. Backend lands later; today these persist
   *  locally so the operator's name shows up consistently. */
  fullName?: string;
  email?: string;
  jobTitle?: string;
}

/** Built-in defaults the store hydrates with on first run. */
export const DEFAULT_USER_PREFS: UserPrefs = {
  density: 'comfortable',
  language: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
  timeZone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
};

// ─────────────────────────── Billing (Phase 3B) ───────────────────
// Operator-facing billing surface. No real Stripe; persistence is
// local. The Account / Billing UI honestly states that payment
// processing requires the billing backend.

export type PlanTier = 'starter' | 'studio' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual';

export interface PlanFeatureBudget {
  /** Max number of projects the tier allows. */
  projects: number;
  /** Max seats included. */
  seats: number;
  /** Storage in GB. */
  storageGb: number;
}

export interface PaymentMethod {
  brand: 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';
  last4: string;
  expMonth: number;
  expYear: number;
  /** ISO when the card was last saved locally. */
  savedAt: number;
}

export interface Invoice {
  id: string;
  /** Display number ("INV-2026-04"). */
  number: string;
  amount: number;
  currency: 'USD';
  status: 'paid' | 'open' | 'failed';
  periodStart: number;
  periodEnd: number;
  issuedAt: number;
  paidAt?: number;
}

export interface BillingState {
  plan: PlanTier;
  cycle: BillingCycle;
  seats: number;
  /** When the current plan renews. */
  renewsAt: number;
  paymentMethod?: PaymentMethod;
  invoices: Invoice[];
}

/** Default billing state used on first hydrate. Plausible Studio
 *  subscription so the Settings surface has something to render. */
export const DEFAULT_BILLING: BillingState = {
  plan: 'studio',
  cycle: 'monthly',
  seats: 6,
  renewsAt: Date.now() + 30 * 86_400_000,
  invoices: [],
};

// ─────────────────────────── Integrations (Phase 3C) ───────────────
// Marketplace state. Connections persist locally; real OAuth lands
// with each integration's backend wiring. The UI is explicit about
// "connection saved locally" so the operator doesn't think a real
// handshake happened.

export type IntegrationId =
  | 'quickbooks' | 'hubspot' | 'salesforce' | 'servicetitan' | 'netsuite' | 'stripe-pay'
  | 'slack' | 'msteams' | 'google-workspace'
  | 'verkada' | 'axis' | 'genetec' | 'milestone'
  | 'quote-engine';

export type IntegrationStatus = 'connected' | 'available';

export interface IntegrationRecord {
  id: IntegrationId;
  status: IntegrationStatus;
  connectedAt?: number;
  lastSyncAt?: number;
  /** Operator's friendly note attached to the connection. */
  note?: string;
}

// ─────────────────────────── Team (Phase 3D) ──────────────────────
// Workspace member directory. Distinct from CRM Contacts (which
// represent the integrator's customers); these are operator
// teammates with workspace access.

export type WorkspaceRoleId =
  | 'owner' | 'admin' | 'engineer' | 'sales' | 'field' | 'customer'
  | string; // custom roles (Enterprise tier) come through as freeform strings

export type WorkspaceInviteStatus = 'pending' | 'accepted' | 'revoked';

export interface WorkspaceMember {
  id: string;
  fullName: string;
  email: string;
  role: WorkspaceRoleId;
  /** When the operator invited / added them. */
  addedAt: number;
  /** Last active stamp — null for never. */
  lastActiveAt?: number;
  /** Invite status. Members invited via the modal start as 'pending'
   *  until the backend confirms — today the operator can mark
   *  accepted manually. Real auth lands separately. */
  inviteStatus: WorkspaceInviteStatus;
  /** Optional list of project ids the member is on. Empty = all. */
  projectIds?: string[];
}

// ─────────────────────────── Notifications (Phase 3E) ─────────────
// Per-event notification routing. Channels persist locally; the
// real delivery (email send, push token, Slack/Teams API call)
// lands when the notification backend ships.

export type NotificationEventKey =
  | 'project-status-change'
  | 'project-comment-added'
  | 'project-approval-requested'
  | 'project-approval-granted'
  | 'wo-blocked'
  | 'wo-completed'
  | 'wo-photo-uploaded'
  | 'threat-high-exposure'
  | 'threat-simulation-run'
  | 'billing-payment-failed'
  | 'billing-plan-renewing'
  | 'team-member-invited'
  | 'team-member-joined'
  | 'weekly-digest';

export type EmailDigestCadence = 'immediate' | 'daily' | 'weekly' | 'off';

export interface NotificationPref {
  email: EmailDigestCadence;
  inApp: boolean;
  push:  boolean;
  /** Routed to the connected Slack workspace (if any). */
  slack: boolean;
  /** Routed to the connected Microsoft Teams workspace (if any). */
  teams: boolean;
}

/** Default routing for a freshly-created event preference. */
export const DEFAULT_NOTIFICATION_PREF: NotificationPref = {
  email: 'daily',
  inApp: true,
  push:  false,
  slack: false,
  teams: false,
};

// ─────────────────────────── Security (Phase 3F) ──────────────────
// SSO config, SCIM, API keys, webhooks, audit log, 2FA, sessions,
// data residency. UI is real V1; persistence is local. Real OAuth
// handshakes / SAML / SCIM POSTs land with the auth backend.

export type SsoProtocol = 'saml' | 'oidc';
export interface SsoConfig {
  enabled: boolean;
  protocol: SsoProtocol;
  /** SAML metadata URL or pasted XML. */
  metadataUrl?: string;
  /** OIDC issuer URL. */
  issuer?: string;
  /** OIDC client id. */
  clientId?: string;
  /** OIDC client secret. Persisted locally; cleared on log-out
   *  surfaces ship. */
  clientSecret?: string;
  /** Email domains automatically enrolled via SSO. */
  emailDomains: string[];
  /** When the config was last updated. */
  updatedAt?: number;
}

export interface ScimConfig {
  enabled: boolean;
  /** Generated endpoint the IdP POSTs to. */
  endpointPath: string;
  /** Bearer token the IdP uses. */
  token: string;
  /** When the token was rotated. */
  rotatedAt: number;
}

export type ApiKeyScope = 'read' | 'write' | 'admin';
export interface ApiKey {
  id: string;
  name: string;
  /** First 8 chars of the token. The full secret is shown once on
   *  create and never persisted in cleartext after. */
  prefix: string;
  scopes: ApiKeyScope[];
  createdAt: number;
  createdBy?: string;
  lastUsedAt?: number;
  revokedAt?: number;
}

export type WebhookEvent =
  | 'project.created' | 'project.status_changed' | 'project.approved'
  | 'workorder.completed' | 'workorder.blocked'
  | 'threat.high_exposure'
  | 'invoice.paid' | 'invoice.failed';

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  /** HMAC signing secret. Last 4 chars only kept after creation. */
  secretLast4: string;
  active: boolean;
  createdAt: number;
  lastDeliveredAt?: number;
  lastStatus?: number;
}

export type AuditAction =
  | 'member.invited' | 'member.removed' | 'role.changed'
  | 'integration.connected' | 'integration.disconnected'
  | 'apikey.created' | 'apikey.revoked'
  | 'webhook.created' | 'webhook.deleted' | 'webhook.test_ping'
  | 'sso.updated' | 'scim.rotated'
  | 'project.exported' | 'workspace.signed_out_others';

export interface AuditEntry {
  id: string;
  who: string;
  action: AuditAction;
  /** Free-form target (id or label of the touched record). */
  target?: string;
  detail?: string;
  ts: number;
  /** IP / region context — placeholder until the auth backend
   *  attaches the real client IP. */
  context?: string;
}

export type SecuritySessionStatus = 'active' | 'idle' | 'revoked';
export interface SecuritySession {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  startedAt: number;
  lastActiveAt: number;
  status: SecuritySessionStatus;
  current: boolean;
}

export type DataResidency = 'us' | 'eu' | 'anz';

export interface TwoFactor {
  enabled: boolean;
  /** Base32 TOTP secret. Local-only; real enrollment + verification
   *  happens server side when the auth backend ships. */
  secret?: string;
  /** Hashed-recovery codes are not in scope yet; the V1 UI shows
   *  plain recovery codes once and warns the operator to copy
   *  them. */
  recoveryCodes?: string[];
  enrolledAt?: number;
}

export interface SecurityState {
  sso: SsoConfig;
  scim: ScimConfig;
  apiKeys: Record<string, ApiKey>;
  webhooks: Record<string, Webhook>;
  audit: AuditEntry[];
  sessions: Record<string, SecuritySession>;
  twoFactor: TwoFactor;
  residency: DataResidency;
}

/** Default Security state on first hydrate. */
export const DEFAULT_SECURITY: SecurityState = {
  sso: { enabled: false, protocol: 'saml', emailDomains: [] },
  scim: { enabled: false, endpointPath: '', token: '', rotatedAt: 0 },
  apiKeys: {},
  webhooks: {},
  audit: [],
  sessions: {},
  twoFactor: { enabled: false },
  residency: 'us',
};

// ─────────────────────────── Workspace (Phase 3G) ─────────────────
// Advanced tab — workspace identity, white-label, dev mode.

export interface WorkspaceSettings {
  /** Display name shown on cover pages + footers. */
  name: string;
  /** Optional logo as a data URL (so it persists locally without a
   *  CDN). Operators can paste / pick a PNG. */
  logoDataUrl?: string;
  /** Brand color used in customer-facing exports (PDFs, portal
   *  themes). Distinct from the operator's UI accent so the work
   *  surface and the deliverable can differ. */
  brandColor?: string;
  /** Custom domain for white-label portal links. Validated against
   *  a basic hostname regex; DNS verification ships with backend. */
  customDomain?: string;
  /** Developer mode toggles internal debug surfaces. Persisted so
   *  the dev / staff operator doesn't have to re-enable per
   *  session. */
  devMode: boolean;
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  name: 'Access Tech Security',
  devMode: false,
};
