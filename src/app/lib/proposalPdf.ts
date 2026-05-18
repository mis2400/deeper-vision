// SC.4.8 — proposal PDF generator. Pure function; takes a stripped
// `ProposalCustomerArtifact` (NEVER a raw Proposal) so the PDF
// physically cannot serialize internal cost / margin / labor /
// burden data. Same data-layer enforcement that the portal render
// uses.
//
// jsPDF is already in package.json (the EngineeringCanvas PDF
// export pulls it in). Dynamic import to keep the proposal builder
// bundle small until the operator actually clicks Generate PDF.

import type { ProposalCustomerArtifact } from './proposalView';
import type { ProposalLine } from '../store/types';

const SECTION_LABEL: Record<ProposalLine['section'], string> = {
  cameras:        'Cameras',
  access:         'Access control',
  cabling:        'Cabling',
  conduit:        'Conduit',
  walls:          'Walls',
  infrastructure: 'Infrastructure',
  labor:          'Labor',
  other:          'Other',
};

// Deterministic section order for the PDF table. Iterating the
// grouped Map in insertion order produced different orderings on
// proposals where the canvas BOM grew in a different sequence —
// regenerating today vs tomorrow could swap section positions.
// SECTION_ORDER fixes the order across every proposal.
const SECTION_ORDER: ProposalLine['section'][] = [
  'cameras', 'access', 'cabling', 'conduit', 'walls', 'infrastructure', 'labor', 'other',
];

/** Optional integrator-side branding pulled from workspace
 *  settings. Caller decides what to pass in; the PDF works with
 *  no branding at all. */
export interface ProposalPdfBranding {
  integratorName?: string;
  brandColor?: string;
  /** Optional logo as a data URL (the workspace settings logo
   *  field is already a data URL). */
  logoDataUrl?: string;
}

/** Optional customer context for the cover page. The portal route
 *  already knows the customer name; pass it through so the PDF
 *  cover renders "Prepared for ..." without re subscribing. */
export interface ProposalPdfCustomer {
  companyName?: string;
  contactName?: string;
}

const LETTER_WIDTH_PT  = 612;   // 8.5" * 72
const LETTER_HEIGHT_PT = 792;   // 11"  * 72
const MARGIN_PT = 54;           // 0.75"
const TEXT_WIDTH = LETTER_WIDTH_PT - MARGIN_PT * 2;

const FONT_BODY = 10;
const FONT_SECTION = 12;
const FONT_HEADING = 16;
const FONT_TITLE = 22;
const LINE_HEIGHT = 1.35;

/** Generate a customer facing PDF for the given proposal artifact.
 *  Returns the filename for the caller to log / toast. Triggers a
 *  download in the browser. */
export async function generateProposalPdf(
  artifact: ProposalCustomerArtifact,
  opts: {
    branding?: ProposalPdfBranding;
    customer?: ProposalPdfCustomer;
    /** Override the auto generated file name. */
    filename?: string;
  } = {},
): Promise<string> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });

  const filename = opts.filename
    ?? `proposal-${artifact.projectId}-v${artifact.version}.pdf`;

  // ── Cover ──────────────────────────────────────────────────────
  drawCover(doc, artifact, opts.branding, opts.customer);

  // ── Body sections ──────────────────────────────────────────────
  doc.addPage();
  let y = MARGIN_PT;
  y = drawSectionHeading(doc, 'Executive summary', y);
  y = drawParagraph(doc, artifact.customerView.executiveSummary, y);

  y = ensurePageRoom(doc, y, 80);
  y = drawSectionHeading(doc, 'Scope of work', y);
  y = drawParagraph(doc, artifact.customerView.scope, y);

  // ── Line items table ──────────────────────────────────────────
  if (artifact.lines.length > 0) {
    y = ensurePageRoom(doc, y, 120);
    y = drawSectionHeading(doc, 'Line items', y);
    y = drawLinesTable(doc, artifact, y);
  }

  // ── Totals ────────────────────────────────────────────────────
  y = ensurePageRoom(doc, y, 80);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SECTION);
  doc.text('Project total', MARGIN_PT, y);
  doc.text(`$${money(artifact.totals.sellTotal)}`, LETTER_WIDTH_PT - MARGIN_PT, y, { align: 'right' });
  y += 18;

  if (artifact.paymentSchedule) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_BODY);
    y = drawParagraph(doc, artifact.paymentSchedule, y);
  }

  // ── Acceptance + Terms ────────────────────────────────────────
  if (artifact.customerView.footer) {
    y = ensurePageRoom(doc, y, 100);
    y = drawSectionHeading(doc, 'Acceptance', y);
    y = drawParagraph(doc, artifact.customerView.footer, y);

    // Signature block.
    y = ensurePageRoom(doc, y, 100);
    y += 24;
    doc.setDrawColor(180);
    doc.line(MARGIN_PT, y, MARGIN_PT + 220, y);
    doc.line(MARGIN_PT + 280, y, MARGIN_PT + 460, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_BODY - 1);
    doc.setTextColor(110);
    doc.text('Customer signature', MARGIN_PT, y);
    doc.text('Date', MARGIN_PT + 280, y);
    doc.setTextColor(0);
  }

  if (artifact.customerView.terms) {
    doc.addPage();
    let ty = MARGIN_PT;
    ty = drawSectionHeading(doc, 'Terms', ty);
    drawParagraph(doc, artifact.customerView.terms, ty);
  }

  // ── Footer on every page ──────────────────────────────────────
  drawPageFooters(doc, artifact, opts.branding);

  doc.save(filename);
  return filename;
}

// ─────────────────────── Drawing primitives ─────────────────────
function drawCover(doc: any, a: ProposalCustomerArtifact, b?: ProposalPdfBranding, c?: ProposalPdfCustomer) {
  // Brand bar across the top.
  if (b?.brandColor) {
    const [r, g, bl] = parseColor(b.brandColor);
    doc.setFillColor(r, g, bl);
    doc.rect(0, 0, LETTER_WIDTH_PT, 8, 'F');
  }

  let y = 120;
  if (b?.logoDataUrl) {
    try {
      // Detect the image format from the data URL prefix so jsPDF
      // gets the right decoder. Defaults to PNG for unrecognised
      // prefixes (which historically would fail silently if the
      // pasted logo was a JPG).
      const fmt = detectImageFormat(b.logoDataUrl);
      doc.addImage(b.logoDataUrl, fmt, MARGIN_PT, y - 40, 60, 60);
    } catch {
      // Decoder still rejected (rare). Skip the logo; title and
      // wordmark below still render.
    }
  }
  if (b?.integratorName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_BODY);
    doc.setTextColor(110);
    doc.text(b.integratorName.toUpperCase(), MARGIN_PT + (b.logoDataUrl ? 80 : 0), y - 8);
    doc.setTextColor(0);
  }

  y = 240;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_TITLE);
  const titleLines = doc.splitTextToSize(
    a.customerView.header?.trim() || 'Security system proposal',
    TEXT_WIDTH,
  );
  doc.text(titleLines, MARGIN_PT, y);
  y += titleLines.length * FONT_TITLE * LINE_HEIGHT;

  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_BODY);
  doc.setTextColor(80);
  doc.text(`Version ${a.version}`, MARGIN_PT, y);
  y += FONT_BODY * LINE_HEIGHT;
  doc.text(`Issued ${new Date(a.createdAtIso).toLocaleDateString()}`, MARGIN_PT, y);
  y += FONT_BODY * LINE_HEIGHT;
  if (a.sentAt) {
    doc.text(`Sent ${new Date(a.sentAt).toLocaleDateString()}`, MARGIN_PT, y);
    y += FONT_BODY * LINE_HEIGHT;
  }

  // Prepared for box (only when we have a customer).
  if (c?.companyName) {
    y += 24;
    doc.setTextColor(110);
    doc.setFontSize(FONT_BODY - 1);
    doc.text('PREPARED FOR', MARGIN_PT, y);
    y += FONT_BODY * LINE_HEIGHT;
    doc.setTextColor(0);
    doc.setFontSize(FONT_SECTION);
    doc.text(c.companyName, MARGIN_PT, y);
    y += FONT_SECTION * LINE_HEIGHT;
    if (c.contactName) {
      doc.setFontSize(FONT_BODY);
      doc.setTextColor(80);
      doc.text(c.contactName, MARGIN_PT, y);
      doc.setTextColor(0);
    }
  }

  // Project total — bottom of cover.
  const totalY = LETTER_HEIGHT_PT - MARGIN_PT - 40;
  doc.setDrawColor(220);
  doc.line(MARGIN_PT, totalY - 12, LETTER_WIDTH_PT - MARGIN_PT, totalY - 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_HEADING);
  doc.text('Project total', MARGIN_PT, totalY + 8);
  doc.text(`$${money(a.totals.sellTotal)}`, LETTER_WIDTH_PT - MARGIN_PT, totalY + 8, { align: 'right' });
}

function drawSectionHeading(doc: any, label: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SECTION);
  doc.setTextColor(0);
  doc.text(label.toUpperCase(), MARGIN_PT, y);
  doc.setDrawColor(220);
  doc.line(MARGIN_PT, y + 4, LETTER_WIDTH_PT - MARGIN_PT, y + 4);
  return y + 18;
}

function drawParagraph(doc: any, text: string, y: number): number {
  if (!text) return y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_BODY);
  doc.setTextColor(40);
  // Split on paragraph breaks first so spacing reads right.
  const paragraphs = text.split(/\n\s*\n/);
  const lineH = FONT_BODY * LINE_HEIGHT;
  // Page-bottom guard MATCHES ensurePageRoom (-30) so paragraph
  // text never overlaps the page footer.
  const bottomGuard = () => LETTER_HEIGHT_PT - MARGIN_PT - 30;
  for (const p of paragraphs) {
    const lines = doc.splitTextToSize(p, TEXT_WIDTH);
    // Page break per LINE so a paragraph longer than one usable
    // page splits across pages instead of silently truncating.
    for (const line of lines) {
      if (y + lineH > bottomGuard()) {
        doc.addPage();
        y = MARGIN_PT;
        // Re assert font + color since addPage doesn't reset
        // them but the previous page may have changed them via
        // a footer pass — defensive.
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_BODY);
        doc.setTextColor(40);
      }
      doc.text(line, MARGIN_PT, y);
      y += lineH;
    }
    y += 6;
  }
  doc.setTextColor(0);
  return y;
}

function drawLinesTable(doc: any, a: ProposalCustomerArtifact, startY: number): number {
  // Group by section, iterate SECTION_ORDER so the section order
  // is identical every time the PDF regenerates.
  const grouped = new Map<ProposalLine['section'], typeof a.lines>();
  for (const l of a.lines) {
    const arr = grouped.get(l.section) ?? [];
    arr.push(l);
    grouped.set(l.section, arr);
  }

  const COL_DESC_X = MARGIN_PT;
  const COL_QTY_X  = MARGIN_PT + 320;
  const COL_PRICE_X = MARGIN_PT + 400;
  const COL_TOTAL_X = LETTER_WIDTH_PT - MARGIN_PT;
  const ROW_H = 16;

  let y = startY + 4;

  // Helpers (re used when a section spans a page break to repaint
  // the section header + column headers at the new page top).
  const drawGroupHeader = (section: ProposalLine['section'], subtotal: number, yPos: number, continued: boolean): number => {
    doc.setFillColor(245, 246, 248);
    doc.rect(MARGIN_PT - 2, yPos - 11, TEXT_WIDTH + 4, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_BODY);
    doc.setTextColor(60);
    const label = SECTION_LABEL[section].toUpperCase() + (continued ? ' (CONTINUED)' : '');
    doc.text(label, COL_DESC_X, yPos);
    // Only show subtotal on the FIRST page header for the section
    // so the customer doesn't see two subtotals for the same group.
    if (!continued) {
      doc.text(`$${money(subtotal)}`, COL_TOTAL_X, yPos, { align: 'right' });
    }
    doc.setTextColor(0);
    return yPos + ROW_H;
  };
  const drawColumnHeaders = (yPos: number): number => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_BODY - 1.5);
    doc.setTextColor(120);
    doc.text('Description', COL_DESC_X, yPos);
    doc.text('Qty', COL_QTY_X, yPos, { align: 'right' });
    doc.text('Unit', COL_PRICE_X, yPos, { align: 'right' });
    doc.text('Line total', COL_TOTAL_X, yPos, { align: 'right' });
    doc.setTextColor(0);
    return yPos + ROW_H - 4;
  };

  for (const section of SECTION_ORDER) {
    const lines = grouped.get(section);
    if (!lines || lines.length === 0) continue;

    y = ensurePageRoom(doc, y, ROW_H * 3);
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    y = drawGroupHeader(section, subtotal, y, false);
    y = drawColumnHeaders(y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_BODY);

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const descLines = doc.splitTextToSize(l.description, 300);
      const rowHeight = Math.max(ROW_H, descLines.length * FONT_BODY * LINE_HEIGHT);
      // Page break BEFORE the row so we don't render half of it.
      if (y + rowHeight > LETTER_HEIGHT_PT - MARGIN_PT - 30) {
        doc.addPage();
        y = MARGIN_PT;
        // Repaint the section header + column headers so the
        // reader knows what they're looking at.
        y = drawGroupHeader(section, subtotal, y, true);
        y = drawColumnHeaders(y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FONT_BODY);
      }
      doc.text(descLines, COL_DESC_X, y);
      doc.text(`${l.quantity} ${l.unit}`, COL_QTY_X, y, { align: 'right' });
      doc.text(`$${money(l.unitPrice)}`, COL_PRICE_X, y, { align: 'right' });
      doc.text(`$${money(l.lineTotal)}`, COL_TOTAL_X, y, { align: 'right' });
      y += rowHeight;
      // Row separator except after the last row of a section.
      if (i < lines.length - 1) {
        doc.setDrawColor(235);
        doc.line(MARGIN_PT, y - 4, LETTER_WIDTH_PT - MARGIN_PT, y - 4);
      }
    }
    y += 4;
  }

  return y;
}

function drawPageFooters(doc: any, a: ProposalCustomerArtifact, b?: ProposalPdfBranding) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_BODY - 2);
    doc.setTextColor(140);
    const left = b?.integratorName
      ? `${b.integratorName} · Proposal v${a.version}`
      : `Proposal v${a.version}`;
    doc.text(left, MARGIN_PT, LETTER_HEIGHT_PT - 24);
    doc.text(`Page ${i} of ${total}`, LETTER_WIDTH_PT - MARGIN_PT, LETTER_HEIGHT_PT - 24, { align: 'right' });
    doc.setTextColor(0);
  }
}

function ensurePageRoom(doc: any, y: number, needed: number): number {
  if (y + needed > LETTER_HEIGHT_PT - MARGIN_PT - 30) {
    doc.addPage();
    return MARGIN_PT;
  }
  return y;
}

// ─────────────────────── Helpers ────────────────────────────────
function money(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function parseColor(hexOrCssVar: string): [number, number, number] {
  // Accepts "#RRGGBB" or "#RGB". rgb(...), var(...), and other
  // CSS values can't be resolved at PDF generation time and fall
  // through to a dark slate default.
  const long = /^#?([0-9a-fA-F]{6})$/.exec(hexOrCssVar);
  if (long) {
    const n = parseInt(long[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const short = /^#?([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(hexOrCssVar);
  if (short) {
    const r = parseInt(short[1] + short[1], 16);
    const g = parseInt(short[2] + short[2], 16);
    const b = parseInt(short[3] + short[3], 16);
    return [r, g, b];
  }
  return [45, 55, 72]; // slate 800
}

function detectImageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  // jsPDF supports PNG / JPEG / WebP natively. SVG is NOT supported
  // by jsPDF.addImage; falls through to PNG which will reject.
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
}
