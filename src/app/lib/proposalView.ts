// SC.4.3 — proposal view + totals helpers. Pure functions. The
// `toCustomerView` enforcement happens at the data layer so screen
// renders, PDF exports, and the public Customer Portal serialise
// from the same stripped shape. Internal fields are physically
// removed, not just CSS hidden, so a screenshot or DevTools dump
// of the customer artifact can't leak cost data.

import type {
  Proposal,
  ProposalLine,
  ProposalCustomerView,
  CanvasBomRow,
} from '../store/types';

/** Customer safe shape. ZERO internal fields. ProposalLine entries
 *  are filtered (hidden lines stripped) AND each remaining line
 *  loses unitCost, laborHours, and internalNote. */
export interface ProposalCustomerArtifact {
  id: string;
  projectId: string;
  version: number;
  status: Proposal['status'];
  customerView: ProposalCustomerView;
  /** Customer safe line items: hidden lines stripped, internal
   *  fields blanked. */
  lines: Array<{
    id: string;
    section: ProposalLine['section'];
    sku?: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
  }>;
  totals: {
    subtotal: number;
    /** Sell total = subtotal (customer view does NOT expose burden
     *  or labor breakdowns; what they see is what they sign). */
    sellTotal: number;
  };
  paymentSchedule?: string;
  sentAt?: number;
  /** ISO of created so the portal can display "Proposal v3 from
   *  the 18th" without doing date math on the consumer side. */
  createdAtIso: string;
}

/** Strip everything internal. Pure transformation; never mutates
 *  the source proposal. Used by every customer facing artifact
 *  (portal render, PDF export, public share link). */
export function toCustomerView(proposal: Proposal): ProposalCustomerArtifact {
  // Filter hidden lines + project away internal fields.
  const visibleLines = proposal.bomSnapshot
    .filter((l) => !l.hideFromCustomer)
    .map((l) => ({
      id: l.id,
      section: l.section,
      sku: l.sku,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      lineTotal: roundCurrency(l.quantity * l.unitPrice),
    }));

  const subtotal = visibleLines.reduce((s, l) => s + l.lineTotal, 0);

  return {
    id: proposal.id,
    projectId: proposal.projectId,
    version: proposal.version,
    status: proposal.status,
    customerView: { ...proposal.customerView },
    lines: visibleLines,
    totals: {
      subtotal: roundCurrency(subtotal),
      sellTotal: roundCurrency(subtotal),
    },
    paymentSchedule: proposal.customerView.paymentSchedule,
    sentAt: proposal.sentAt,
    createdAtIso: new Date(proposal.createdAt).toISOString(),
  };
}

/** Internal totals: full cost waterfall the operator needs to set
 *  margin. Only used in internal view; never serialized to a
 *  customer artifact. */
export interface ProposalInternalTotals {
  /** Sum of unitCost * quantity across ALL lines (including hidden). */
  costSubtotal: number;
  /** Sum of laborHours * quantity. */
  laborHours: number;
  /** laborHours * laborRatePerHour. */
  laborCost: number;
  /** (costSubtotal + laborCost) * burdenPct. */
  burdenCost: number;
  /** costSubtotal + laborCost + burdenCost. Operator's load before margin. */
  loadedCost: number;
  /** loadedCost / (1 - marginPct), or loadedCost when margin is 0. */
  sellTotal: number;
  /** sellTotal - loadedCost. */
  grossProfit: number;
  /** grossProfit / sellTotal — convenience for the operator panel. */
  gpPct: number;
  /** Sum of unitPrice * quantity for visible (customer facing)
   *  lines. The customer artifact uses this same number; surfaces
   *  here so the operator can see "customer subtotal" alongside
   *  the internal view. */
  customerSubtotal: number;
}

export function deriveProposalInternalTotals(proposal: Proposal): ProposalInternalTotals {
  let costSubtotal = 0;
  let laborHours = 0;
  let customerSubtotal = 0;
  for (const l of proposal.bomSnapshot) {
    costSubtotal += l.unitCost * l.quantity;
    // laborHours is TOTAL per line (not per unit) per the
    // ProposalLine type comment. Sum directly.
    laborHours   += l.laborHours ?? 0;
    if (!l.hideFromCustomer) {
      customerSubtotal += l.unitPrice * l.quantity;
    }
  }
  const laborCost  = laborHours * proposal.internalView.laborRatePerHour;
  const burdenCost = (costSubtotal + laborCost) * proposal.internalView.burdenPct;
  const loadedCost = costSubtotal + laborCost + burdenCost;
  // Margin is target gross margin: sell = loadedCost / (1 - margin).
  // Clamp margin to [0, 0.95) to prevent division blow up.
  const margin = Math.min(0.95, Math.max(0, proposal.internalView.marginPct));
  const sellTotal = margin > 0 ? loadedCost / (1 - margin) : loadedCost;
  const grossProfit = sellTotal - loadedCost;
  const gpPct = sellTotal > 0 ? grossProfit / sellTotal : 0;
  return {
    costSubtotal: roundCurrency(costSubtotal),
    laborHours:   round1(laborHours),
    laborCost:    roundCurrency(laborCost),
    burdenCost:   roundCurrency(burdenCost),
    loadedCost:   roundCurrency(loadedCost),
    sellTotal:    roundCurrency(sellTotal),
    grossProfit:  roundCurrency(grossProfit),
    gpPct:        round3(gpPct),
    customerSubtotal: roundCurrency(customerSubtotal),
  };
}

/** Round to cents. */
function roundCurrency(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** SC.4.3 audit helper. Returns true if the artifact contains any
 *  internal field that should have been stripped. Used by the
 *  SC.4.11 integrity script. */
export function customerArtifactContainsInternalLeaks(artifact: ProposalCustomerArtifact): string[] {
  const leaks: string[] = [];
  // Stringify the artifact and look for substrings that should
  // never appear in a customer view. This is belt + braces — the
  // shape itself does not declare these fields, so a leak would
  // mean a developer manually injected one.
  const json = JSON.stringify(artifact);
  const forbidden = ['unitCost', 'laborHours', 'internalNote', 'marginPct', 'burdenPct', 'grossProfit', 'gpPct', 'loadedCost', 'laborRatePerHour'];
  for (const key of forbidden) {
    if (json.includes(`"${key}"`)) leaks.push(key);
  }
  return leaks;
}

// ─────────────────────── Default values ─────────────────────────
// SC.4.6 reads these when an operator clicks Create proposal and
// no per project / org defaults exist. Documented constants so
// the integrity script can assert against them.
export const DEFAULT_LABOR_RATE_PER_HOUR = 95;
export const DEFAULT_BURDEN_PCT = 0.18;
export const DEFAULT_MARGIN_PCT = 0.28;

// ─────────────────────── BOM -> ProposalLine ────────────────────
// SC.4.5 — convert canvas BOM rows (per source rows from
// deriveCanvasBomRows) into the ProposalLine shape. Section
// mapping is identity for the categories that overlap, with
// 'network' rolled into 'infrastructure' so the customer PDF
// table of contents reads more naturally.
//
// Pricing seed: marginPct is applied on the operator side via
// internalView.marginPct. Initial unitPrice carries a sane default
// (the canvas row's unitPrice, which already includes catalog
// MSRP) so a freshly created draft is not all zeros. Operator can
// override per line.

const SECTION_FROM_CATEGORY: Record<CanvasBomRow['category'], ProposalLine['section']> = {
  cameras:        'cameras',
  access:         'access',
  cabling:        'cabling',
  conduit:        'conduit',
  walls:          'walls',
  network:        'infrastructure',
  labor:          'labor',
  other:          'other',
};

export function bomRowToProposalLine(row: CanvasBomRow): ProposalLine {
  // SKU resolution: prefer the row's product id if present (devices
  // backed by a catalog product carry one as a non-typed extra),
  // otherwise fall back to the row id. Avoids relying on the
  // sourceKind discriminator that drifted from the type.
  const sku = (row as any).product || row.id;
  return {
    id: `pl-${row.id}`,
    section: SECTION_FROM_CATEGORY[row.category] ?? 'other',
    sku,
    description: row.description,
    quantity: row.qty,
    unit: row.uom,
    unitCost: row.unitPrice,
    // Default sell = cost. applyMarginToLines bumps every line on
    // Create. Operator overrides win per line.
    unitPrice: row.unitPrice,
    laborHours: row.laborHours,
    hideFromCustomer: false,
  };
}

/** Apply a margin to every line that does not already have a sell
 *  price set (or where sell == cost, which is the default seed).
 *  Used by Create proposal to set a sensible initial sell across
 *  the board. */
export function applyMarginToLines(lines: ProposalLine[], marginPct: number): ProposalLine[] {
  const margin = Math.min(0.95, Math.max(0, marginPct));
  if (margin === 0) return lines.map((l) => ({ ...l }));
  return lines.map((l) => {
    // Only bump lines where the operator hasn't overridden the price
    // (i.e. unitPrice === unitCost from the seed).
    if (l.unitPrice !== l.unitCost) return { ...l };
    return { ...l, unitPrice: roundCurrency(l.unitCost / (1 - margin)) };
  });
}

/** SC.4.6 fix — reprice EVERY line based on margin, overriding
 *  any prior per line sell. Used by the "Apply margin to all
 *  lines" Pricing section action so the customer total tracks
 *  the operator's target margin. Skips lines with zero cost. */
export function repriceAllLinesByMargin(lines: ProposalLine[], marginPct: number): ProposalLine[] {
  const margin = Math.min(0.95, Math.max(0, marginPct));
  return lines.map((l) => {
    if (l.unitCost <= 0) return { ...l };
    const newPrice = margin > 0
      ? roundCurrency(l.unitCost / (1 - margin))
      : roundCurrency(l.unitCost);
    return { ...l, unitPrice: newPrice };
  });
}
