// Lifecycle phase definitions. The store has one truth — `project.lifecyclePhase`
// — and this file describes what each phase MEANS: owner, primary route,
// completion checklist, allowed transitions, recommended modules.
//
// Routes use the literal `:id` placeholder. Call `routeFor(phase, projectId)`
// to substitute. This keeps the config a pure value and avoids accidental
// hardcoding of demo project ids.

import type { LifecyclePhase, OwnerRole, HealthStatus } from '../store/types';

export interface PhaseItem {
  id: string;
  label: string;
  /** Optional pointer to the page where the user completes this item. */
  href?: string;
}

export interface PhaseConfig {
  id: LifecyclePhase;
  label: string;
  shortLabel: string;
  description: string;
  ownerRole: OwnerRole;
  /** Where the user works during this phase. Use `:id` placeholder. */
  primaryRoute: string;
  /** Phases the project can flow forward to. First entry is the "advance"
   *  default; others are alternate routes (e.g. archive). */
  allowedNextPhases: LifecyclePhase[];
  /** Phases the project can flow back to (e.g. customer review → engineering
   *  for a revision). */
  allowedPreviousPhases: LifecyclePhase[];
  /** Checklist that should be done before the phase can advance. Soft-gated
   *  for now — UI shows progress + warning, doesn't block. */
  requiredCompletionItems: PhaseItem[];
  /** Cards / nav links surfaced on the command center while in this phase. */
  visibleModules: { label: string; href: string }[];
  /** Whether the customer can see this project state in /portal/:id. */
  customerVisible: boolean;
  /** Tailwind tone classes for status pills. Two flavors — solid (bg+text)
   *  and outline (border+text) — pick at the consumer. */
  tone: { solid: string; outline: string; dot: string };
}

// ─────────────────────────── Tones ────────────────────────────────
// Tightly constrained set so the lifecycle reads as a gradient (cool → warm
// → green) instead of a rainbow.
const TONE = {
  slate:   { solid: 'bg-slate-500/15 text-slate-300',     outline: 'border-slate-500/40 text-slate-300',   dot: 'bg-slate-400' },
  blue:    { solid: 'bg-blue-500/15 text-blue-300',       outline: 'border-blue-500/40 text-blue-300',     dot: 'bg-blue-400' },
  cyan:    { solid: 'bg-cyan-500/15 text-cyan-300',       outline: 'border-cyan-500/40 text-cyan-300',     dot: 'bg-cyan-400' },
  violet:  { solid: 'bg-violet-500/15 text-violet-300',   outline: 'border-violet-500/40 text-violet-300', dot: 'bg-violet-400' },
  amber:   { solid: 'bg-amber-500/15 text-amber-300',     outline: 'border-amber-500/40 text-amber-300',   dot: 'bg-amber-400' },
  orange:  { solid: 'bg-orange-500/15 text-orange-300',   outline: 'border-orange-500/40 text-orange-300', dot: 'bg-orange-400' },
  emerald: { solid: 'bg-emerald-500/15 text-emerald-300', outline: 'border-emerald-500/40 text-emerald-300', dot: 'bg-emerald-400' },
  green:   { solid: 'bg-green-500/15 text-green-300',     outline: 'border-green-500/40 text-green-300',   dot: 'bg-green-400' },
  rose:    { solid: 'bg-rose-500/15 text-rose-300',       outline: 'border-rose-500/40 text-rose-300',     dot: 'bg-rose-400' },
};

// ─────────────────────────── Phase definitions ────────────────────
export const PHASES: Record<LifecyclePhase, PhaseConfig> = {
  lead: {
    id: 'lead', label: 'Lead', shortLabel: 'Lead',
    description: 'Inbound inquiry not yet qualified.',
    ownerRole: 'sales',
    primaryRoute: '/projects',
    allowedNextPhases: ['discovery', 'archived'],
    allowedPreviousPhases: [],
    requiredCompletionItems: [
      { id: 'company',     label: 'Company / district selected' },
      { id: 'contact',     label: 'Primary contact captured' },
      { id: 'opportunity', label: 'Opportunity value estimated' },
      { id: 'address',     label: 'Site address entered' },
    ],
    visibleModules: [],
    customerVisible: false,
    tone: TONE.slate,
  },
  discovery: {
    id: 'discovery', label: 'Discovery', shortLabel: 'Discovery',
    description: 'Scope-of-work conversation. Pain, budget, timeline.',
    ownerRole: 'sales',
    primaryRoute: '/projects',
    allowedNextPhases: ['walk_scheduled', 'archived'],
    allowedPreviousPhases: ['lead'],
    requiredCompletionItems: [
      { id: 'pain',     label: 'Pain points documented' },
      { id: 'budget',   label: 'Budget range identified' },
      { id: 'timeline', label: 'Target completion date' },
      { id: 'scope',    label: 'High-level scope agreed' },
    ],
    visibleModules: [],
    customerVisible: false,
    tone: TONE.slate,
  },
  walk_scheduled: {
    id: 'walk_scheduled', label: 'Walk scheduled', shortLabel: 'Walk',
    description: 'Job walk on the calendar; survey crew assigned.',
    ownerRole: 'sales',
    primaryRoute: '/projects',
    allowedNextPhases: ['survey', 'discovery', 'archived'],
    allowedPreviousPhases: ['discovery'],
    requiredCompletionItems: [
      { id: 'date',  label: 'Walk date confirmed' },
      { id: 'crew',  label: 'Survey crew assigned' },
      { id: 'gear',  label: 'Field gear / scan kit ready' },
    ],
    visibleModules: [],
    customerVisible: false,
    tone: TONE.cyan,
  },
  survey: {
    id: 'survey', label: 'Survey', shortLabel: 'Survey',
    description: 'On-site capture: floorplans, photos, infra, threats.',
    ownerRole: 'field',
    primaryRoute: '/sitewalk/:id',
    allowedNextPhases: ['engineering', 'walk_scheduled', 'archived'],
    allowedPreviousPhases: ['walk_scheduled'],
    requiredCompletionItems: [
      { id: 'plans',  label: 'Floorplans uploaded / scanned',  href: '/visionscan' },
      { id: 'photos', label: 'Site photos attached',            href: '/sitewalk/:id' },
      { id: 'notes',  label: 'Site notes captured',             href: '/sitewalk/:id' },
      { id: 'tag',    label: 'Existing doors / devices tagged', href: '/sitewalk/:id' },
      { id: 'cal',    label: 'Floorplan calibrated to scale',   href: '/calibrate/:id' },
    ],
    visibleModules: [
      { label: 'Site walk',    href: '/sitewalk/:id' },
      { label: 'VisionScan',   href: '/visionscan' },
      { label: 'Calibration',  href: '/calibrate/:id' },
    ],
    customerVisible: false,
    tone: TONE.cyan,
  },
  engineering: {
    id: 'engineering', label: 'Engineering', shortLabel: 'Engineering',
    description: 'Design: device placement, FOV, doors, pathways, IDFs.',
    ownerRole: 'engineering',
    primaryRoute: '/project/:id/canvas',
    allowedNextPhases: ['estimate', 'survey', 'archived'],
    allowedPreviousPhases: ['survey'],
    requiredCompletionItems: [
      { id: 'cal',    label: 'Floorplan calibrated',                  href: '/calibrate/:id' },
      { id: 'cams',   label: 'Cameras placed and aimed',              href: '/project/:id/canvas' },
      { id: 'doors',  label: 'Doors configured with hardware',        href: '/project/:id/canvas' },
      { id: 'paths',  label: 'Pathways drawn',                         href: '/pathways/:id' },
      { id: 'idfs',   label: 'IDFs / switches assigned',               href: '/project/:id/canvas' },
      { id: 'warn',   label: 'Engineering warnings reviewed' },
    ],
    visibleModules: [
      { label: 'Engineering canvas', href: '/project/:id/canvas' },
      { label: 'Door engineering',   href: '/project/:id/canvas?tool=door' },
      { label: 'Pathways',           href: '/pathways/:id' },
      { label: 'Flow view',          href: '/flow/:id' },
      { label: 'Power & cable',      href: '/power/:id' },
    ],
    customerVisible: false,
    tone: TONE.violet,
  },
  estimate: {
    id: 'estimate', label: 'Estimate', shortLabel: 'Estimate',
    description: 'Roll-up: BOM, labor, alternates, margin.',
    ownerRole: 'estimating',
    primaryRoute: '/estimate/:id',
    allowedNextPhases: ['proposal', 'engineering', 'archived'],
    allowedPreviousPhases: ['engineering'],
    requiredCompletionItems: [
      { id: 'bom',        label: 'BOM reviewed',           href: '/estimate/:id' },
      { id: 'labor',      label: 'Labor hours calculated', href: '/estimate/:id' },
      { id: 'pricing',    label: 'Pricing applied',         href: '/estimate/:id' },
      { id: 'alternates', label: 'Alternates considered' },
    ],
    visibleModules: [
      { label: 'BOM / Estimate', href: '/estimate/:id' },
      { label: 'Power & cable',  href: '/power/:id' },
      { label: 'Permit packet',  href: '/permit/:id' },
    ],
    customerVisible: false,
    tone: TONE.violet,
  },
  proposal: {
    id: 'proposal', label: 'Proposal', shortLabel: 'Proposal',
    description: 'Customer-facing document drafted and reviewed internally.',
    ownerRole: 'sales-or-estimating',
    primaryRoute: '/proposal/:id',
    allowedNextPhases: ['customer_review', 'estimate', 'archived'],
    allowedPreviousPhases: ['estimate'],
    requiredCompletionItems: [
      { id: 'gen',         label: 'Proposal generated',          href: '/proposal/:id' },
      { id: 'exclusions',  label: 'Exclusions added',             href: '/proposal/:id' },
      { id: 'review',      label: 'Internal review approved' },
    ],
    visibleModules: [
      { label: 'Proposal builder', href: '/proposal/:id' },
      { label: 'Permit packet',    href: '/permit/:id' },
    ],
    customerVisible: false,
    tone: TONE.amber,
  },
  customer_review: {
    id: 'customer_review', label: 'Customer review', shortLabel: 'Review',
    description: 'Customer reviews the proposal; comments / revisions land here.',
    ownerRole: 'customer',
    primaryRoute: '/portal/:id',
    allowedNextPhases: ['approved', 'proposal', 'engineering', 'archived'],
    allowedPreviousPhases: ['proposal'],
    requiredCompletionItems: [
      { id: 'viewed',    label: 'Customer opened the portal',       href: '/portal/:id' },
      { id: 'comments',  label: 'Comments resolved' },
      { id: 'revstatus', label: 'Revision status communicated' },
    ],
    visibleModules: [
      { label: 'Customer portal', href: '/portal/:id' },
      { label: 'Change orders',   href: '/changeorders/:id' },
    ],
    customerVisible: true,
    tone: TONE.amber,
  },
  approved: {
    id: 'approved', label: 'Approved', shortLabel: 'Approved',
    description: 'Customer signed. PO captured. Ready to deploy.',
    ownerRole: 'pm',
    primaryRoute: '/project/:id',
    allowedNextPhases: ['deployment', 'archived'],
    allowedPreviousPhases: ['customer_review'],
    requiredCompletionItems: [
      { id: 'signed', label: 'Proposal signed' },
      { id: 'po',     label: 'PO captured' },
      { id: 'kick',   label: 'Kickoff scheduled' },
    ],
    visibleModules: [
      { label: 'Project command center', href: '/project/:id' },
    ],
    customerVisible: true,
    tone: TONE.orange,
  },
  deployment: {
    id: 'deployment', label: 'Deployment', shortLabel: 'Deploy',
    description: 'Work orders out, crews on site, materials staged.',
    ownerRole: 'pm',
    primaryRoute: '/workorders/:id',
    allowedNextPhases: ['commissioning', 'approved', 'archived'],
    allowedPreviousPhases: ['approved'],
    requiredCompletionItems: [
      { id: 'wos',        label: 'Work orders created',     href: '/workorders/:id' },
      { id: 'install',    label: 'Installers assigned',     href: '/workorders/:id' },
      { id: 'materials',  label: 'Materials staged' },
      { id: 'schedule',   label: 'Schedule confirmed' },
    ],
    visibleModules: [
      { label: 'Work orders',  href: '/workorders/:id' },
      { label: 'Change orders', href: '/changeorders/:id' },
      { label: 'Commissioning', href: '/commission/:id' },
    ],
    customerVisible: true,
    tone: TONE.orange,
  },
  commissioning: {
    id: 'commissioning', label: 'Commissioning', shortLabel: 'Commission',
    description: 'Per-device tests, punch list, customer signoff.',
    ownerRole: 'field',
    primaryRoute: '/commission/:id',
    allowedNextPhases: ['completed', 'deployment', 'archived'],
    allowedPreviousPhases: ['deployment'],
    requiredCompletionItems: [
      { id: 'tests',   label: 'Device tests passed',         href: '/commission/:id' },
      { id: 'network', label: 'Network verified',            href: '/commission/:id' },
      { id: 'doors',   label: 'Doors verified end-to-end',   href: '/commission/:id' },
      { id: 'punch',   label: 'Punch list resolved' },
      { id: 'signoff', label: 'Customer signoff' },
    ],
    visibleModules: [
      { label: 'Commissioning', href: '/commission/:id' },
      { label: 'Work orders',    href: '/workorders/:id' },
      { label: 'Change orders',  href: '/changeorders/:id' },
    ],
    customerVisible: true,
    tone: TONE.orange,
  },
  completed: {
    id: 'completed', label: 'Completed', shortLabel: 'Done',
    description: 'Deployment closed out; warranty + service handoff in flight.',
    ownerRole: 'pm',
    primaryRoute: '/project/:id',
    allowedNextPhases: ['managed_service', 'archived'],
    allowedPreviousPhases: ['commissioning'],
    requiredCompletionItems: [
      { id: 'closeout', label: 'Closeout package delivered' },
      { id: 'invoice',  label: 'Final invoice sent' },
    ],
    visibleModules: [
      { label: 'Customer portal', href: '/portal/:id' },
    ],
    customerVisible: true,
    tone: TONE.emerald,
  },
  managed_service: {
    id: 'managed_service', label: 'Managed service', shortLabel: 'Service',
    description: 'Live system under service agreement.',
    ownerRole: 'service',
    primaryRoute: '/maintenance/:id',
    allowedNextPhases: ['support', 'archived'],
    allowedPreviousPhases: ['completed'],
    requiredCompletionItems: [
      { id: 'warranty',    label: 'Warranties loaded' },
      { id: 'maintenance', label: 'Maintenance schedule active', href: '/maintenance/:id' },
      { id: 'tickets',     label: 'Ticketing enabled' },
      { id: 'portal',      label: 'Customer portal active',      href: '/portal/:id' },
    ],
    visibleModules: [
      { label: 'Maintenance',     href: '/maintenance/:id' },
      { label: 'Customer portal', href: '/portal/:id' },
      { label: 'Change orders',   href: '/changeorders/:id' },
      { label: 'Live integration', href: '/live/:id' },
    ],
    customerVisible: true,
    tone: TONE.green,
  },
  support: {
    id: 'support', label: 'Support', shortLabel: 'Support',
    description: 'Active ticket / incident in flight.',
    ownerRole: 'service',
    primaryRoute: '/maintenance/:id',
    allowedNextPhases: ['managed_service', 'archived'],
    allowedPreviousPhases: ['managed_service'],
    requiredCompletionItems: [
      { id: 'triage',   label: 'Ticket triaged' },
      { id: 'assigned', label: 'Technician assigned' },
      { id: 'resolved', label: 'Issue resolved' },
    ],
    visibleModules: [
      { label: 'Live integration', href: '/live/:id' },
      { label: 'Maintenance',      href: '/maintenance/:id' },
    ],
    customerVisible: true,
    tone: TONE.rose,
  },
  archived: {
    id: 'archived', label: 'Archived', shortLabel: 'Archived',
    description: 'Project closed; no longer active.',
    ownerRole: 'pm',
    primaryRoute: '/projects',
    allowedNextPhases: [],
    allowedPreviousPhases: ['lead', 'discovery', 'walk_scheduled', 'survey', 'engineering', 'estimate', 'proposal', 'customer_review', 'approved', 'deployment', 'commissioning', 'completed', 'managed_service', 'support'],
    requiredCompletionItems: [],
    visibleModules: [],
    customerVisible: false,
    tone: TONE.slate,
  },
};

/** Linear order of phases for timelines / progress bars. Excludes 'archived'
 *  (a terminal off-the-line state). */
export const PHASE_TIMELINE: LifecyclePhase[] = [
  'lead', 'discovery', 'walk_scheduled', 'survey', 'engineering',
  'estimate', 'proposal', 'customer_review', 'approved',
  'deployment', 'commissioning', 'completed', 'managed_service', 'support',
];

/** Resolve `:id` and any other placeholders in a phase route. */
export function routeFor(phase: LifecyclePhase, projectId: string): string {
  return PHASES[phase].primaryRoute.replaceAll(':id', projectId);
}

export function expandRoute(href: string, projectId: string): string {
  return href.replaceAll(':id', projectId);
}

/** Phase progress as a 0..100 number based on the linear timeline. Used by
 *  ProjectHub progress bars. */
export function progressPctFor(phase: LifecyclePhase): number {
  const i = PHASE_TIMELINE.indexOf(phase);
  if (i < 0) return 0;
  return Math.round(((i + 1) / PHASE_TIMELINE.length) * 100);
}

/** What's the natural "advance" target from this phase? First entry in the
 *  config's allowedNextPhases, excluding archived. */
export function nextPhase(phase: LifecyclePhase): LifecyclePhase | null {
  const next = PHASES[phase].allowedNextPhases.find((p) => p !== 'archived');
  return next ?? null;
}

export function previousPhase(phase: LifecyclePhase): LifecyclePhase | null {
  return PHASES[phase].allowedPreviousPhases[0] ?? null;
}

/** Quick-action button label and route per phase — surfaces on the project
 *  card and the command center. */
export function quickActionFor(phase: LifecyclePhase, projectId: string): {
  label: string; href: string;
} {
  const cfg = PHASES[phase];
  const route = expandRoute(cfg.primaryRoute, projectId);
  const labels: Record<LifecyclePhase, string> = {
    lead:            'Qualify lead',
    discovery:       'Continue discovery',
    walk_scheduled:  'View walk schedule',
    survey:          'Continue site walk',
    engineering:     'Open engineering canvas',
    estimate:        'Review estimate',
    proposal:        'Open proposal',
    customer_review: 'Open customer review',
    approved:        'Kick off deployment',
    deployment:      'Open work orders',
    commissioning:   'Continue commissioning',
    completed:       'Open project',
    managed_service: 'Open service center',
    support:         'Open active ticket',
    archived:        'Restore project',
  };
  return { label: labels[phase], href: route };
}

/** Health → tone helper. */
export function healthTone(h: HealthStatus | undefined) {
  switch (h) {
    case 'at_risk':  return { label: 'At risk',  cls: 'text-amber-400'   };
    case 'blocked':  return { label: 'Blocked',  cls: 'text-rose-400'    };
    case 'complete': return { label: 'Complete', cls: 'text-emerald-400' };
    case 'on_track':
    default:         return { label: 'On track', cls: 'text-slate-400'   };
  }
}
