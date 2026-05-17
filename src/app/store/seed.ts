// Initial demo state. Transplants the SEED_DEVICES and SEED projects that
// previously lived inside individual screens into the shared store, so every
// screen draws from the same source. Build Order #2 added a full CRM
// substrate — Customers, Contacts, Opportunities, Touches, Tasks — woven
// through the existing project data so the lifecycle starts at "lead", not
// at "project exists".

import type {
  Customer, Contact, Project, Site, Building, Floor, Device, Door, Pathway,
  IDF, Estimate, LensCfg, Opportunity, Touch, Task, ActivityItem,
} from './types';

/** Cardinal default lens layout for new multisensors. */
export const DEFAULT_MULTISENSOR_LENSES: { a: LensCfg; b: LensCfg; c: LensCfg; d: LensCfg } = {
  a: { rotation: 0,   fov: 90, range: 60, focal: 2.8, enabled: true },
  b: { rotation: 90,  fov: 90, range: 60, focal: 2.8, enabled: true },
  c: { rotation: 180, fov: 90, range: 60, focal: 2.8, enabled: true },
  d: { rotation: 270, fov: 90, range: 60, focal: 2.8, enabled: true },
};

const now = Date.now();
const days = (n: number) => now - 1000 * 60 * 60 * 24 * n;
const hours = (n: number) => now - 1000 * 60 * 60 * n;

// ── Customers ─────────────────────────────────────────────────────
// Customers now carry full CRM metadata: industry, account tier, account
// owner, primary contact. Embedded `contacts` is gone — contacts live in
// their own slice and reference customerId.
const CUSTOMERS: Customer[] = [
  { id: 'c1', companyName: 'Acme Industries',          industry: 'manufacturing',
    accountTier: 'strategic', ownerUserId: 'u-mei',    primaryContactId: 'ct-c1-jd',
    website: 'acme-industries.com', employees: 2400,
    addresses: [{ street: '500 Congress Ave', city: 'Austin',        state: 'TX' }],
    createdAt: days(420), updatedAt: hours(2) },
  { id: 'c2', companyName: 'Mercy Health',             industry: 'healthcare',
    accountTier: 'strategic', ownerUserId: 'u-mei',    primaryContactId: 'ct-c2-sm',
    website: 'mercy.health', employees: 8200,
    addresses: [{ street: '1200 Medical Pkwy', city: 'Dallas',       state: 'TX' }],
    createdAt: days(360), updatedAt: hours(6) },
  { id: 'c3', companyName: 'Unibail-Rodamco',          industry: 'commercial_re',
    accountTier: 'growth',   ownerUserId: 'u-tom',     primaryContactId: 'ct-c3-mw',
    website: 'unibail-rodamco-westfield.com', employees: 600,
    addresses: [{ street: '865 Market St',     city: 'San Francisco', state: 'CA' }],
    createdAt: days(280), updatedAt: days(1) },
  { id: 'c4', companyName: 'Equinix',                  industry: 'data_center',
    accountTier: 'strategic', ownerUserId: 'u-mei',    primaryContactId: 'ct-c4-jk',
    website: 'equinix.com', employees: 12000,
    addresses: [{ street: '4150 Network Way',  city: 'Ashburn',       state: 'VA' }],
    createdAt: days(540), updatedAt: days(3) },
  { id: 'c5', companyName: 'Portland Public Schools',  industry: 'education',
    accountTier: 'growth',   ownerUserId: 'u-rita',    primaryContactId: 'ct-c5-rh',
    website: 'pps.net', employees: 5400,
    addresses: [{ street: '1600 Education Way', city: 'Portland',     state: 'OR' }],
    createdAt: days(180), updatedAt: days(1) },
  { id: 'c6', companyName: 'BlackRock REIT',           industry: 'multifamily',
    accountTier: 'growth',   ownerUserId: 'u-tom',     primaryContactId: 'ct-c6-tp',
    website: 'blackrockreit.com', employees: 320,
    addresses: [{ street: '88 Riverside',      city: 'Brooklyn',      state: 'NY' }],
    createdAt: days(140), updatedAt: hours(4) },
];

// ── Contacts ──────────────────────────────────────────────────────
// 2 contacts per major customer so the account-detail page reads alive.
// Ids namespaced ct-<customerId>-<initials>.
const CONTACTS: Contact[] = [
  // Acme
  { id: 'ct-c1-jd', customerId: 'c1', firstName: 'John',  lastName: 'Doe',
    title: 'Director of Facilities', email: 'jd@acme-industries.com', phone: '+1 512 555 0140',
    role: 'decision_maker', isPrimary: true,
    createdAt: days(420), updatedAt: days(30) },
  { id: 'ct-c1-ls', customerId: 'c1', firstName: 'Lara',  lastName: 'Singh',
    title: 'IT Infrastructure Lead', email: 'lsingh@acme-industries.com', phone: '+1 512 555 0157',
    role: 'technical',
    createdAt: days(360), updatedAt: days(60) },

  // Mercy
  { id: 'ct-c2-sm', customerId: 'c2', firstName: 'Sarah', lastName: 'Miller',
    title: 'Director of Security Operations', email: 'smiller@mercy.health', phone: '+1 214 555 0182',
    role: 'security', isPrimary: true,
    createdAt: days(360), updatedAt: days(7) },
  { id: 'ct-c2-av', customerId: 'c2', firstName: 'Aaron', lastName: 'Vega',
    title: 'VP of Hospital Operations', email: 'avega@mercy.health',
    role: 'champion',
    createdAt: days(300), updatedAt: days(14) },

  // Unibail-Rodamco
  { id: 'ct-c3-mw', customerId: 'c3', firstName: 'Mike',  lastName: 'Wong',
    title: 'Asset Manager — West Coast', email: 'mwong@urw.com',
    role: 'decision_maker', isPrimary: true,
    createdAt: days(280), updatedAt: days(45) },
  { id: 'ct-c3-ec', customerId: 'c3', firstName: 'Erin',  lastName: 'Cho',
    title: 'Mall Operations Lead', email: 'echo@urw.com',
    role: 'operations',
    createdAt: days(220), updatedAt: days(20) },

  // Equinix
  { id: 'ct-c4-jk', customerId: 'c4', firstName: 'Jordan',lastName: 'Kim',
    title: 'Site Operations Manager', email: 'jkim@equinix.com',
    role: 'decision_maker', isPrimary: true,
    createdAt: days(540), updatedAt: days(90) },
  { id: 'ct-c4-pn', customerId: 'c4', firstName: 'Priya', lastName: 'Nair',
    title: 'Physical Security Engineer', email: 'pnair@equinix.com',
    role: 'technical',
    createdAt: days(400), updatedAt: days(60) },

  // Portland Public Schools
  { id: 'ct-c5-rh', customerId: 'c5', firstName: 'Rita',  lastName: 'Holmes',
    title: 'District Security Coordinator', email: 'rholmes@pps.net', phone: '+1 503 555 0166',
    role: 'decision_maker', isPrimary: true,
    createdAt: days(180), updatedAt: days(5) },

  // BlackRock REIT
  { id: 'ct-c6-tp', customerId: 'c6', firstName: 'Tom',   lastName: 'Park',
    title: 'Property Operations Manager', email: 'tpark@blackrockreit.com',
    role: 'decision_maker', isPrimary: true,
    createdAt: days(140), updatedAt: days(2) },
  { id: 'ct-c6-no', customerId: 'c6', firstName: 'Nadia', lastName: 'Ortiz',
    title: 'Director of Finance', email: 'nortiz@blackrockreit.com',
    role: 'finance',
    createdAt: days(120), updatedAt: days(30) },
];

// ── Projects ──────────────────────────────────────────────────────
// Seeded projects span the full lifecycle so the demo has at least one
// project in each major phase — useful for the ProjectHub filters and for
// QA'ing phase-specific behavior. Each project that originated from a
// closed-won opportunity links back via opportunityId.
const PROJECTS: Project[] = [
  { id: 'p1', name: 'Acme HQ — Austin',          customerId: 'c1', siteId: 's1', status: 'design',  lifecyclePhase: 'engineering',     team: 4, progress: 36,  updated: '2h ago',  createdAt: days(40), updatedAt: hours(2),  phaseStartedAt: days(5),  healthStatus: 'on_track', nextAction: 'Place remaining cameras + run pathway to IDF-1', priority: 'high',     assignedEngineerUserId: 'u-jordan', opportunityId: 'opp-4', contractValue: 245000 },
  { id: 'p2', name: 'Mercy Hospital Tower B',    customerId: 'c2', siteId: 's2', status: 'review',  lifecyclePhase: 'proposal',         team: 6, progress: 50,  updated: '6h ago',  createdAt: days(80), updatedAt: hours(6),  phaseStartedAt: days(2),  healthStatus: 'at_risk',  nextAction: 'Lock down exclusions before Friday review',         priority: 'critical', assignedSalesUserId: 'u-mei', opportunityId: 'opp-5', contractValue: 620000 },
  { id: 'p3', name: 'Westfield Mall Renovation', customerId: 'c3', siteId: 's3', status: 'install', lifecyclePhase: 'deployment',       team: 9, progress: 71,  updated: '1d ago',  createdAt: days(120),updatedAt: days(1),   phaseStartedAt: days(7),  healthStatus: 'on_track', nextAction: 'Confirm overnight pulls in the east wing',          priority: 'high',     assignedPMUserId: 'u-diego', contractValue: 1850000 },
  { id: 'p4', name: 'Central Data Center',       customerId: 'c4', siteId: 's4', status: 'live',    lifecyclePhase: 'managed_service',  team: 3, progress: 100, updated: '3d ago',  createdAt: days(220),updatedAt: days(3),   phaseStartedAt: days(180),healthStatus: 'complete', nextAction: 'Q3 firmware sweep this week',                      priority: 'normal',   contractValue: 2400000 },
  { id: 'p5', name: 'Lincoln High School',       customerId: 'c5', siteId: 's5', status: 'design',  lifecyclePhase: 'survey',           team: 3, progress: 21,  updated: '1d ago',  createdAt: days(30), updatedAt: days(1),   phaseStartedAt: days(1),  healthStatus: 'on_track', nextAction: 'Upload remaining floorplan PDFs',                   priority: 'normal',   assignedSalesUserId: 'u-rita', opportunityId: 'opp-6', contractValue: 410000 },
  { id: 'p6', name: 'Riverside Apartments',      customerId: 'c6', siteId: 's6', status: 'review',  lifecyclePhase: 'customer_review',  team: 5, progress: 57,  updated: '4h ago',  createdAt: days(60), updatedAt: hours(4),  phaseStartedAt: days(1),  healthStatus: 'on_track', nextAction: 'Awaiting comments from BlackRock',                  priority: 'high',     assignedSalesUserId: 'u-tom', contractValue: 310000 },
];

// ── Opportunities ─────────────────────────────────────────────────
// Sales-pipeline records. Some are open (pre-project), some are closed-won
// and back-link to the projects they spawned, one is closed-lost so the
// pipeline view has a realistic lost-deals tab.
const OPPORTUNITIES: Opportunity[] = [
  { id: 'opp-1', customerId: 'c1', primaryContactId: 'ct-c1-jd', name: 'Acme HQ — Phase 2 expansion',
    stage: 'qualified', estValue: 185000, probability: 0.45, expectedCloseDate: days(-45),
    source: 'existing_customer', ownerUserId: 'u-mei',
    description: 'Add 22 additional IP cameras + 8 doors on floors 4–6 after Phase 1 success.',
    createdAt: days(28), updatedAt: days(4) },

  { id: 'opp-2', customerId: 'c2', primaryContactId: 'ct-c2-sm', name: 'Mercy ER — Tower C cameras',
    stage: 'discovery', estValue: 98000, probability: 0.35, expectedCloseDate: days(-60),
    source: 'existing_customer', ownerUserId: 'u-mei',
    description: 'Camera coverage refresh for Emergency Department, ~36 new fixtures.',
    createdAt: days(18), updatedAt: days(2) },

  { id: 'opp-3', customerId: 'c6', primaryContactId: 'ct-c6-tp', name: 'Riverside South tower',
    stage: 'proposing', estValue: 310000, probability: 0.6, expectedCloseDate: days(-21),
    source: 'referral', ownerUserId: 'u-tom',
    description: 'Camera + access for the new south tower, opening Q4.',
    createdAt: days(45), updatedAt: hours(8) },

  // Closed-won — tied to existing projects
  { id: 'opp-4', customerId: 'c1', primaryContactId: 'ct-c1-jd', name: 'Acme HQ — Austin',
    stage: 'won', estValue: 245000, probability: 1, source: 'cold_outreach', ownerUserId: 'u-mei',
    description: 'Original Phase 1 deployment for the Austin HQ — 28 IP cameras, 16 doors.',
    wonProjectId: 'p1', closedAt: days(40),
    createdAt: days(80), updatedAt: days(40) },

  { id: 'opp-5', customerId: 'c2', primaryContactId: 'ct-c2-sm', name: 'Mercy Hospital Tower B',
    stage: 'won', estValue: 620000, probability: 1, source: 'rfp', ownerUserId: 'u-mei',
    description: 'Tower B floors 8-14 cameras, access control, intercom.',
    wonProjectId: 'p2', closedAt: days(80),
    createdAt: days(150), updatedAt: days(80) },

  { id: 'opp-6', customerId: 'c5', primaryContactId: 'ct-c5-rh', name: 'Lincoln HS — initial deployment',
    stage: 'won', estValue: 410000, probability: 1, source: 'partner', ownerUserId: 'u-rita',
    description: 'District pilot — full camera + access build at Lincoln HS.',
    wonProjectId: 'p5', closedAt: days(30),
    createdAt: days(75), updatedAt: days(30) },

  // Lost
  { id: 'opp-7', customerId: 'c4', primaryContactId: 'ct-c4-jk', name: 'Equinix DC15 LPR upgrade',
    stage: 'lost', estValue: 87000, probability: 0, source: 'existing_customer', ownerUserId: 'u-mei',
    description: 'LPR cameras for North entrance.',
    lossReason: 'No CapEx in Q2 — revisit Q3.',
    closedAt: days(14),
    createdAt: days(60), updatedAt: days(14) },

  // Top of funnel
  { id: 'opp-8', customerId: 'c3', primaryContactId: 'ct-c3-mw', name: 'Westfield Mall — Phase 2',
    stage: 'inquiry', estValue: 200000, probability: 0.2, expectedCloseDate: days(-90),
    source: 'inbound_web', ownerUserId: 'u-tom',
    description: 'Inbound interest in expanding camera coverage to outdoor parking.',
    createdAt: days(7), updatedAt: days(1) },
];

// ── Touches (interaction log) ─────────────────────────────────────
const TOUCHES: Touch[] = [
  // Acme — opp-1
  { id: 'tch-1', customerId: 'c1', contactId: 'ct-c1-jd', opportunityId: 'opp-1', type: 'meeting',
    summary: 'Phase 2 scoping with John at HQ', detail: 'Walked floors 4-6, discussed timeline aligning with Phase 1 close. Need updated floor counts.',
    userName: 'Mei L.', occurredAt: days(4), createdAt: days(4) },
  { id: 'tch-2', customerId: 'c1', contactId: 'ct-c1-ls', opportunityId: 'opp-1', type: 'email',
    summary: 'Sent network capacity questionnaire to Lara',
    userName: 'Mei L.', occurredAt: days(12), createdAt: days(12) },

  // Mercy — opp-2
  { id: 'tch-3', customerId: 'c2', contactId: 'ct-c2-sm', opportunityId: 'opp-2', type: 'call',
    summary: 'Sarah confirmed budget for ED refresh in FY26',
    userName: 'Mei L.', occurredAt: days(2), createdAt: days(2) },
  { id: 'tch-4', customerId: 'c2', contactId: 'ct-c2-av', opportunityId: 'opp-2', type: 'meeting',
    summary: 'Discovery session with Dr. Vega',
    detail: 'Reviewed compliance constraints (HIPAA), layout sensitivities for triage areas.',
    userName: 'Mei L.', occurredAt: days(10), createdAt: days(10) },

  // Riverside — opp-3
  { id: 'tch-5', customerId: 'c6', contactId: 'ct-c6-tp', opportunityId: 'opp-3', type: 'quote_sent',
    summary: 'Proposal v1 sent — $310k', detail: 'Awaiting feedback from Tom + Nadia.',
    userName: 'Tom B.', occurredAt: hours(8), createdAt: hours(8) },
  { id: 'tch-6', customerId: 'c6', contactId: 'ct-c6-no', opportunityId: 'opp-3', type: 'call',
    summary: 'Finance review with Nadia — split payment schedule',
    userName: 'Tom B.', occurredAt: days(3), createdAt: days(3) },
  { id: 'tch-7', customerId: 'c6', contactId: 'ct-c6-tp', opportunityId: 'opp-3', type: 'site_visit',
    summary: 'Walked the South tower site with Tom',
    userName: 'Tom B.', occurredAt: days(18), createdAt: days(18) },

  // Westfield top of funnel — opp-8
  { id: 'tch-8', customerId: 'c3', contactId: 'ct-c3-mw', opportunityId: 'opp-8', type: 'email',
    summary: 'Mike replied to inbound — open to a discovery call in 2 wks',
    userName: 'Tom B.', occurredAt: days(1), createdAt: days(1) },

  // Equinix lost — opp-7
  { id: 'tch-9', customerId: 'c4', contactId: 'ct-c4-jk', opportunityId: 'opp-7', type: 'note',
    summary: 'Marked lost — Jordan confirmed FY budget locked',
    detail: 'Re-engage in early Q3 when capex window reopens.',
    userName: 'Mei L.', occurredAt: days(14), createdAt: days(14) },

  // Lincoln HS won post-sale activity (now in survey phase)
  { id: 'tch-10', customerId: 'c5', contactId: 'ct-c5-rh', projectId: 'p5', type: 'meeting',
    summary: 'Kickoff with Rita — survey schedule + access plan',
    userName: 'Rita H.', occurredAt: days(1), createdAt: days(1) },

  // Acme HQ post-win project touches
  { id: 'tch-11', customerId: 'c1', contactId: 'ct-c1-jd', projectId: 'p1', type: 'meeting',
    summary: 'Mid-engineering check-in', detail: 'Reviewed atrium multisensor placement.',
    userName: 'Jordan K.', occurredAt: days(3), createdAt: days(3) },
  { id: 'tch-12', customerId: 'c1', contactId: 'ct-c1-ls', projectId: 'p1', type: 'email',
    summary: 'Sent IDF placement options to Lara',
    userName: 'Jordan K.', occurredAt: days(6), createdAt: days(6) },

  // Mercy proposal in-flight project touches
  { id: 'tch-13', customerId: 'c2', contactId: 'ct-c2-sm', projectId: 'p2', type: 'quote_sent',
    summary: 'Proposal v3 delivered to Sarah for Tower B',
    userName: 'Mei L.', occurredAt: hours(6), createdAt: hours(6) },

  // Westfield mall mid-deployment
  { id: 'tch-14', customerId: 'c3', contactId: 'ct-c3-ec', projectId: 'p3', type: 'site_visit',
    summary: 'Walked east wing pull schedule with Erin',
    userName: 'Diego R.', occurredAt: days(2), createdAt: days(2) },

  // Equinix managed-service quarterly review
  { id: 'tch-15', customerId: 'c4', contactId: 'ct-c4-pn', projectId: 'p4', type: 'meeting',
    summary: 'Q2 QBR — firmware roadmap',
    userName: 'Mei L.', occurredAt: days(8), createdAt: days(8) },

  // BlackRock customer review feedback in-flight
  { id: 'tch-16', customerId: 'c6', contactId: 'ct-c6-tp', projectId: 'p6', type: 'note',
    summary: 'Tom opened the portal — viewing proposal',
    userName: 'System', occurredAt: hours(5), createdAt: hours(5) },
];

// ── Tasks (follow-ups) ────────────────────────────────────────────
const TASKS: Task[] = [
  { id: 'tsk-1', customerId: 'c1', opportunityId: 'opp-1', title: 'Follow up with Acme on Phase 2 scope',
    detail: 'Need building counts + power available per IDF.',
    status: 'open', dueDate: days(-2),
    assignedUserId: 'u-mei', assignedUserName: 'Mei L.',
    createdAt: days(4), updatedAt: days(4) },

  { id: 'tsk-2', customerId: 'c2', opportunityId: 'opp-2', title: 'Schedule discovery call with Mercy Tower C',
    detail: 'Looking for second half of next week.',
    status: 'open', dueDate: days(1),   // overdue by a day
    assignedUserId: 'u-mei', assignedUserName: 'Mei L.',
    createdAt: days(10), updatedAt: days(10) },

  { id: 'tsk-3', customerId: 'c6', opportunityId: 'opp-3', title: 'Chase Riverside on proposal feedback',
    status: 'open', dueDate: days(-3),
    assignedUserId: 'u-tom', assignedUserName: 'Tom B.',
    createdAt: days(3), updatedAt: hours(6) },

  { id: 'tsk-4', customerId: 'c4', opportunityId: 'opp-7', title: 'Q3 budget cycle — re-engage Equinix LPR',
    detail: 'Wait until early July, ping Jordan.',
    status: 'snoozed', snoozedUntil: days(-60),
    assignedUserId: 'u-mei', assignedUserName: 'Mei L.',
    createdAt: days(14), updatedAt: days(14) },

  { id: 'tsk-5', customerId: 'c1', projectId: 'p1', title: 'Prep mid-project QBR deck for Acme',
    status: 'open', dueDate: days(-7),
    assignedUserId: 'u-mei', assignedUserName: 'Mei L.',
    createdAt: days(2), updatedAt: days(2) },

  { id: 'tsk-6', customerId: 'c2', projectId: 'p2', title: 'Mercy: send ICU integration case study',
    status: 'open', dueDate: days(-1),
    assignedUserId: 'u-mei', assignedUserName: 'Mei L.',
    createdAt: days(1), updatedAt: days(1) },

  { id: 'tsk-7', customerId: 'c3', projectId: 'p3', title: 'Confirm overnight access — east wing pulls',
    status: 'open', dueDate: days(0),
    assignedUserId: 'u-diego', assignedUserName: 'Diego R.',
    createdAt: days(2), updatedAt: days(1) },
];

// ── Sites / Buildings / Floors ────────────────────────────────────
const SITES: Site[]      = PROJECTS.map((p) => ({ id: `s${p.id.slice(1)}`, projectId: p.id, name: p.name, address: CUSTOMERS.find(c => c.id === p.customerId)?.addresses[0] ? `${CUSTOMERS.find(c => c.id === p.customerId)!.addresses[0].street}` : '' }));
const BUILDINGS: Building[] = SITES.map((s) => ({ id: `b${s.id.slice(1)}`, siteId: s.id, name: 'Building A' }));
const FLOORS: Floor[] = BUILDINGS.flatMap((b) => [
  { id: `${b.id}-f1`, buildingId: b.id, name: 'Ground floor', level: 0, source: 'blueprint', scalePxToFt: 0.05, walls: [] },
  { id: `${b.id}-f2`, buildingId: b.id, name: 'Level 2',      level: 1, source: 'blueprint', scalePxToFt: 0.05, walls: [] },
]);

const F_P1_GROUND = `b1-f1`;
const F_P5_GROUND = `b5-f1`;
const F_P3_GROUND = `b3-f1`;

// ── Devices ───────────────────────────────────────────────────────
// Project p1 (Acme HQ) gets the original SEED_DEVICES from the canvas. Other
// projects get smaller sample sets so cross-project navigation also feels
// alive without bloating the seed.
const DEVICES: Device[] = [
  // p1 — Acme HQ ground floor
  { id: 'CAM-101', projectId: 'p1', floorId: F_P1_GROUND, type: 'cam.bullet',      label: 'Lobby NE',   product: 'p-axis-p1468',  x: 260, y: 220, rot:  35 },
  { id: 'CAM-102', projectId: 'p1', floorId: F_P1_GROUND, type: 'cam.bullet',      label: 'Lobby SW',   product: 'p-axis-p1468',  x: 260, y: 460, rot: -35 },
  { id: 'CAM-103', projectId: 'p1', floorId: F_P1_GROUND, type: 'cam.multisensor', label: 'Atrium',     product: 'p-axis-p3827',  x: 480, y: 340, rot:   0,
    lensMode: 'linked',
    lenses: { ...DEFAULT_MULTISENSOR_LENSES } },
  { id: 'CAM-104', projectId: 'p1', floorId: F_P1_GROUND, type: 'cam.ptz',         label: 'Exterior N', product: 'p-axis-q6315',  x: 620, y: 200, rot: 200 },
  { id: 'CAM-105', projectId: 'p1', floorId: F_P1_GROUND, type: 'cam.fisheye',     label: 'Conference', product: 'p-axis-m4327',  x: 700, y: 460, rot:   0 },
  { id: 'RD-1',    projectId: 'p1', floorId: F_P1_GROUND, type: 'acc.reader',      label: 'Lobby in',   product: 'p-hid-signo20', x: 400, y: 130, rot:   0 },
  { id: 'DR-1',    projectId: 'p1', floorId: F_P1_GROUND, type: 'acc.strike',      label: 'Main entry', product: 'p-vd-6210',     x: 420, y: 130, rot:   0 },
  { id: 'AP-1',    projectId: 'p1', floorId: F_P1_GROUND, type: 'net.ap',          label: 'Floor 1 AP', product: 'p-cisco-ap',    x: 360, y: 320, rot:   0 },

  // p5 — Lincoln High School ground floor (sample)
  { id: 'CAM-LH-1', projectId: 'p5', floorId: F_P5_GROUND, type: 'cam.dome',       label: 'Main entrance', product: 'p-axis-p3265', x: 320, y: 240, rot:  90 },
  { id: 'CAM-LH-2', projectId: 'p5', floorId: F_P5_GROUND, type: 'cam.bullet',     label: 'Parking lot',   product: 'p-axis-p1468', x: 200, y: 420, rot: 200 },
  { id: 'RD-LH-1',  projectId: 'p5', floorId: F_P5_GROUND, type: 'acc.reader',     label: 'Main door',     product: 'p-hid-signo20',x: 380, y: 180, rot:   0 },

  // p3 — Westfield Mall (sample)
  { id: 'CAM-WM-1', projectId: 'p3', floorId: F_P3_GROUND, type: 'cam.ptz',        label: 'Center court',  product: 'p-axis-q6315', x: 500, y: 320, rot:  45 },
  { id: 'CAM-WM-2', projectId: 'p3', floorId: F_P3_GROUND, type: 'cam.multisensor',label: 'Food court',    product: 'p-axis-p3827', x: 720, y: 380, rot:   0,
    lensMode: 'linked',
    lenses: { ...DEFAULT_MULTISENSOR_LENSES } },
];

// ── Doors ─────────────────────────────────────────────────────────
const DOORS: Door[] = [
  { id: 'DOOR-101', projectId: 'p1', floorId: F_P1_GROUND, x: 420, y: 130, rot: 0,  width: 36, doorType: 'single', material: 'hollow-metal', fireRated: true, ada: true, hardware: ['reader', 'strike', 'rex', 'contact'], electrification: 'fail-secure', readerLocation: 'wall' },
];

// ── Pathways ──────────────────────────────────────────────────────
const PATHWAYS: Pathway[] = [
  { id: 'PW-1', projectId: 'p1', floorId: F_P1_GROUND, type: 'conduit', cableType: 'cat6a', cableCount: 2,
    points: [{ x: 260, y: 220 }, { x: 360, y: 220 }, { x: 360, y: 320 }],
    sourceId: 'CAM-101', destinationId: 'IDF-1', conduitFill: 0.18 },
];

// ── IDFs ──────────────────────────────────────────────────────────
const IDFS: IDF[] = [
  { id: 'IDF-1', projectId: 'p1', floorId: F_P1_GROUND, x: 360, y: 320, name: 'IDF-1',
    switches: [{ model: 'Cisco C9300-48P', portsPoe: 48, portsTotal: 48, poeBudgetW: 740 }],
    power: { upsModel: 'APC SRT 2200VA', upsRuntimeMin: 32, loadW: 380 } },
];

// ── Estimates ─────────────────────────────────────────────────────
// Estimates start empty per project — derived live from devices/doors/pathways
// the first time the user visits /estimate/:projectId. See selectors in store.
const ESTIMATES: Estimate[] = PROJECTS.map((p) => ({
  id: `est-${p.id}`, projectId: p.id, lines: [], laborRate: 95, markup: 0.18,
}));

// ── Activity feed seed ────────────────────────────────────────────
// A handful of recent events per active project so the command center
// doesn't read as empty on first visit. Now also includes CRM-shaped
// activity (opp wins, touches) so account-detail and pipeline feeds are alive.
const ACTIVITY: ActivityItem[] = [
  { id: 'a1', projectId: 'p1', customerId: 'c1', type: 'device_added',  message: 'Placed CAM-103 multisensor in the atrium', userName: 'Jordan K.',  createdAt: hours(4) },
  { id: 'a2', projectId: 'p1', customerId: 'c1', type: 'phase_changed', message: 'Phase advanced: survey → engineering',     userName: 'Jordan K.',  createdAt: days(5) },
  { id: 'a3', projectId: 'p1', customerId: 'c1', type: 'note_added',    message: 'Note on RD-1: confirm mullion blocking',   userName: 'Jordan K.',  createdAt: hours(8) },
  { id: 'a4', projectId: 'p2', customerId: 'c2', type: 'phase_changed', message: 'Phase advanced: estimate → proposal',       userName: 'Mei L.',     createdAt: days(2) },
  { id: 'a5', projectId: 'p3', customerId: 'c3', type: 'commission_test_pass', message: 'CAM-WM-1 install verified', userName: 'Diego R.', createdAt: hours(22) },
  { id: 'a6', projectId: 'p6', customerId: 'c6', type: 'customer_review_opened', message: 'BlackRock opened the proposal', userName: 'Customer',  createdAt: hours(5) },

  // CRM
  { id: 'a7',  customerId: 'c1', opportunityId: 'opp-1', type: 'opportunity_created',
    message: 'New opportunity: Acme HQ — Phase 2 expansion ($185k)', userName: 'Mei L.', createdAt: days(28) },
  { id: 'a8',  customerId: 'c6', opportunityId: 'opp-3', type: 'opportunity_stage_changed',
    message: 'Opportunity moved: discovery → proposing', userName: 'Tom B.', createdAt: hours(8) },
  { id: 'a9',  customerId: 'c4', opportunityId: 'opp-7', type: 'opportunity_lost',
    message: 'Closed-lost: Equinix DC15 LPR upgrade · no Q2 budget', userName: 'Mei L.', createdAt: days(14) },
  { id: 'a10', customerId: 'c5', opportunityId: 'opp-6', projectId: 'p5', type: 'opportunity_converted',
    message: 'Lincoln HS opportunity won — project p5 spawned', userName: 'Rita H.', createdAt: days(30) },
  { id: 'a11', customerId: 'c2', opportunityId: 'opp-2', type: 'touch_logged',
    message: 'Discovery session with Dr. Vega', userName: 'Mei L.', createdAt: days(10) },
];

// ── Public seed function ──────────────────────────────────────────
/** Returns the canonical initial state for the store. Called on first load
 *  and by the user-facing "Reset demo data" button. */
export function buildSeed() {
  const byId = <T extends { id: string }>(arr: T[]) =>
    Object.fromEntries(arr.map((x) => [x.id, x])) as Record<string, T>;

  return {
    customers:     byId(CUSTOMERS),
    contacts:      byId(CONTACTS),
    projects:      byId(PROJECTS),
    sites:         byId(SITES),
    buildings:     byId(BUILDINGS),
    floors:        byId(FLOORS),
    devices:       byId(DEVICES),
    doors:         byId(DOORS),
    pathways:      byId(PATHWAYS),
    idfs:          byId(IDFS),
    estimates:     byId(ESTIMATES),
    opportunities: byId(OPPORTUNITIES),
    touches:       byId(TOUCHES),
    tasks:         byId(TASKS),
    activity:      byId(ACTIVITY),
    // Threat Drill + Bus Security modules start empty by default;
    // user creates scenarios / buses via the wizards. Seeded demo
    // entries are added lazily on first visit if the project is empty.
    scenarios:     {},
    buses:         {},
    busCameras:    {},
    busDVRs:       {},
    busCableRoutes:{},
    busEvents:     {},
    busChecks:     {},
    // Object-linked survey notes start empty per project; users add them
    // from the canvas inspector while walking the site.
    surveyItems:   {},
  };
}
