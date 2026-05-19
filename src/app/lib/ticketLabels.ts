// SC.6.1 — Display label maps for ServiceTicket enums. The internal
// variants are what operators see (matches the schema's term of art);
// the customer variants are what the Customer Portal shows so the
// portal never leaks internal jargon like `waiting_customer` or
// `in_progress`. The brief specifically asks for those two friendlier
// phrasings.
//
// SC.6.4 reuses the customer maps; keeping them centralized so the
// portal and any future customer-facing surface (email digest,
// status webhook) stay in lockstep.

import type {
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '../store/types';

export const TICKET_STATUS_INTERNAL: Record<TicketStatus, string> = {
  open:              'Open',
  in_progress:       'In progress',
  waiting_customer:  'Waiting on customer',
  resolved:          'Resolved',
  closed:            'Closed',
};

export const TICKET_STATUS_CUSTOMER: Record<TicketStatus, string> = {
  open:              'Open',
  in_progress:       'Our team is on it',
  waiting_customer:  'We need your help',
  resolved:          'Resolved',
  closed:            'Closed',
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low:      'Low',
  medium:   'Medium',
  high:     'High',
  critical: 'Critical',
};

// Tailwind tone classes for each status. Used by status pills on
// both internal and customer surfaces.
export const TICKET_STATUS_TONE: Record<TicketStatus, string> = {
  open:              'text-blue-300 border-blue-500/40 bg-blue-500/10',
  in_progress:       'text-amber-300 border-amber-500/40 bg-amber-500/10',
  waiting_customer:  'text-violet-300 border-violet-500/40 bg-violet-500/10',
  resolved:          'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  closed:            'text-zinc-300 border-zinc-500/40 bg-zinc-500/10',
};

export const TICKET_PRIORITY_TONE: Record<TicketPriority, string> = {
  low:      'text-zinc-300 border-zinc-500/40',
  medium:   'text-blue-300 border-blue-500/40',
  high:     'text-amber-300 border-amber-500/40',
  critical: 'text-rose-300 border-rose-500/40',
};

export const TICKET_CATEGORY_INTERNAL: Record<TicketCategory, string> = {
  device_failure: 'Device failure',
  configuration: 'Configuration',
  warranty_claim: 'Warranty claim',
  preventive:    'Preventive',
  user_request:  'User request',
  other:         'Other',
};

// Customer-facing category buckets. SC.6.3 maps these onto the
// internal enum at submit time so the operator-side analytics stay
// consistent while the customer sees plain English.
export const CUSTOMER_TICKET_KINDS: {
  id: string;
  label: string;
  category: TicketCategory;
  hint: string;
}[] = [
  { id: 'camera',     label: 'Camera not working',        category: 'device_failure', hint: 'Image missing, frozen, distorted, or device offline.' },
  { id: 'access',     label: 'Door access issue',         category: 'device_failure', hint: 'Reader not reading, lock not releasing, schedule wrong.' },
  { id: 'config',     label: 'Settings or schedule change', category: 'configuration', hint: 'You need a permission, schedule, or notification updated.' },
  { id: 'warranty',   label: 'Warranty replacement',      category: 'warranty_claim', hint: 'Device is under warranty and needs to be swapped.' },
  { id: 'question',   label: 'Question about my system',  category: 'user_request',   hint: 'You want help understanding how something works.' },
  { id: 'other',      label: 'Other',                     category: 'other',          hint: 'Anything else you want our team to look at.' },
];

// Maps a customer "urgency" choice to the internal TicketPriority.
// The portal exposes three levels; the schema supports four. We
// don't expose 'critical' to the customer — that is reserved for
// internal triage escalation per shop convention.
export const CUSTOMER_URGENCY_TO_PRIORITY: Record<'low' | 'medium' | 'high', TicketPriority> = {
  low:    'low',
  medium: 'medium',
  high:   'high',
};

export function ticketStatusLabel(status: TicketStatus, audience: 'internal' | 'customer' = 'internal'): string {
  return audience === 'customer'
    ? TICKET_STATUS_CUSTOMER[status]
    : TICKET_STATUS_INTERNAL[status];
}

export function ticketPriorityLabel(p: TicketPriority): string {
  return TICKET_PRIORITY_LABEL[p];
}

export function ticketCategoryLabel(c: TicketCategory): string {
  return TICKET_CATEGORY_INTERNAL[c];
}
