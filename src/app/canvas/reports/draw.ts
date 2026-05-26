// Report PDF drawing — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Pure jsPDF helpers + the 9-way drawReport router that
// composes a cover + per-kind body. Each per-kind drawer reads
// from the store live via getState so no store hooks are
// required at the call site — ReportExportRow / ReportBuilderDialog
// just hand a jsPDF doc, the report kind, the devices list, the
// project id and the px-to-ft scale.

import { isStackableHost } from '../utils';
import { CABLE_OD_IN, EMT_SIZES } from '../cabling';
import { TYPE_KIND } from '../constants';
import { computeIntelIssues } from '../intelligence';
import type { Device } from '../types';
import { pathwayLengthFt } from '../../lib/engineering';
import { deriveBOM, useProjectStore } from '../../store/projectStore';

export type ReportKind =
  | 'engineering' | 'customer' | 'camera-schedule' | 'door-schedule'
  | 'cable-schedule' | 'conduit-schedule' | 'bom' | 'compliance' | 'commissioning';

/** Top-level report router. Each branch composes its own pages using
 *  shared helpers (drawCover, drawTable, drawHeader). */
export function drawReport(doc: any, kind: ReportKind, devices: Device[], projectId: string, pxToFt: number) {
  drawCover(doc, kind, projectId);
  doc.addPage();
  switch (kind) {
    case 'engineering':       return drawEngineeringPacket(doc, devices, projectId);
    case 'customer':          return drawCustomerPresentation(doc, devices, projectId);
    case 'camera-schedule':   return drawCameraSchedule(doc, devices);
    case 'door-schedule':     return drawDoorSchedule(doc, devices);
    case 'cable-schedule':    return drawCableSchedule(doc, projectId);
    case 'conduit-schedule':  return drawConduitSchedule(doc, projectId);
    case 'bom':               return drawBOMReport(doc, projectId);
    case 'compliance':        return drawComplianceReport(doc, devices, pxToFt);
    case 'commissioning':     return drawCommissioningReport(doc, devices);
  }
}

/** Conduit schedule — one row per assigned conduit run, aggregated by
 *  bundle. Mirrors the cable schedule's drawing helpers so the look is
 *  consistent with the rest of the report system. */
function drawConduitSchedule(doc: any, projectId: string) {
  const _state = useProjectStore.getState();
  const pathways = (Object.values(_state.pathways) as any[]).filter((p) => p.projectId === projectId);
  const floors = _state.floors;
  // Group bundles by bundleId; standalone runs become single-row entries.
  const byBundle: Record<string, any[]> = {};
  pathways.forEach((p) => {
    const k = p.bundleId ?? p.id;
    (byBundle[k] ??= []).push(p);
  });
  const rows: string[][] = [];
  Object.entries(byBundle).forEach(([id, group]) => {
    const first = group[0];
    const count = group.length;
    const ct = String(first.cableType ?? 'cat6a').toLowerCase();
    const od = CABLE_OD_IN[ct] ?? 0.31;
    const totalArea = count * Math.PI * (od / 2) ** 2;
    const size = first.conduitSize ?? '—';
    const conduitArea = EMT_SIZES.find((e) => e.size === size)?.areaIn2;
    const fillPct = conduitArea ? `${((totalArea / conduitArea) * 100).toFixed(0)}%` : '—';
    const rec = ((): string => {
      const rule = count <= 1 ? 0.53 : count === 2 ? 0.31 : 0.40;
      const r = EMT_SIZES.find((e) => totalArea / e.areaIn2 <= rule);
      return r?.size ?? '—';
    })();
    rows.push([
      id,
      first.conduitType ?? 'none',
      size,
      String(group.reduce((s, x) => s + pathwayLengthFt(x, floors[x.floorId ?? '']), 0)) + ' ft',
      `${count} × ${ct.toUpperCase()}`,
      fillPct,
      rec,
      first.conduitType && first.conduitSize ? 'assigned' : 'open',
    ]);
  });
  // M11 fix — the original code passed only (doc, title) to drawHeader
  // (page=undefined → "Page undefined") and (doc, headers, rows) to
  // drawTable (startY became the headers array, colW was undefined →
  // `colW[i]` threw on every column). Both calls now match the
  // signatures the other report drawers use: drawHeader(doc, title, 2)
  // and drawTable(doc, startY, headers, rows, colW).
  drawHeader(doc, 'Conduit schedule', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(22, 30, 46);
  doc.text('Conduit schedule', 56, 76);
  drawTable(doc, 100,
    ['Conduit ID', 'Type', 'Size', 'Length', 'Cables', 'Fill %', 'Recommended', 'Status'],
    rows,
    [60, 50, 55, 55, 65, 50, 95, 65],
  );
}

const REPORT_TITLE: Record<ReportKind, string> = {
  'engineering': 'Engineering packet',
  'customer': 'Customer presentation',
  'camera-schedule': 'Camera schedule',
  'door-schedule': 'Door schedule',
  'cable-schedule': 'Cable & pathway schedule',
  'conduit-schedule': 'Conduit schedule',
  'bom': 'Bill of materials',
  'compliance': 'Compliance checklist',
  'commissioning': 'Commissioning report',
};

function drawCover(doc: any, kind: ReportKind, projectId: string) {
  // Premium cover page: brand bar + project meta + date + revision.
  doc.setFillColor(22, 30, 46); doc.rect(0, 0, 612, 792, 'F');
  doc.setFillColor(82, 146, 220); doc.rect(0, 0, 612, 6, 'F');
  doc.setTextColor(232, 237, 244);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(34);
  doc.text(REPORT_TITLE[kind], 56, 240);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13);
  doc.setTextColor(168, 178, 200);
  doc.text(`Project · ${projectId}`, 56, 268);
  doc.setFontSize(11);
  doc.text(`Generated · ${new Date().toLocaleString()}`, 56, 286);
  doc.text('Deeper Vision · Engineering OS for physical security', 56, 304);
  // Footer brand
  doc.setFontSize(9); doc.setTextColor(120, 134, 162);
  doc.text('DEEPER VISION · CONFIDENTIAL', 56, 760);
  doc.text('Page 1', 540, 760);
}

function drawHeader(doc: any, title: string, page: number) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.setTextColor(120, 134, 162);
  doc.text('Deeper Vision · ' + title, 56, 40);
  doc.text(`Page ${page}`, 540, 40);
  doc.setDrawColor(82, 146, 220); doc.setLineWidth(0.5);
  doc.line(56, 48, 556, 48);
}

function drawTable(doc: any, startY: number, headers: string[], rows: (string | number)[][], colW: number[]): number {
  // Header row
  doc.setFillColor(240, 244, 250); doc.rect(56, startY, 500, 18, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(50, 64, 90);
  let x = 60;
  headers.forEach((h, i) => { doc.text(h, x, startY + 12); x += colW[i]; });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.setTextColor(36, 46, 66);
  let y = startY + 32;
  for (const row of rows) {
    if (y > 740) { doc.addPage(); drawHeader(doc, 'continued', (doc.internal.getNumberOfPages())); y = 80; }
    x = 60;
    row.forEach((cell, i) => {
      const str = String(cell ?? '');
      doc.text(str.length > 32 ? str.slice(0, 30) + '…' : str, x, y);
      x += colW[i];
    });
    y += 16;
  }
  doc.setDrawColor(220, 226, 236); doc.line(56, y - 8, 556, y - 8);
  return y;
}

function drawEngineeringPacket(doc: any, devices: Device[], projectId: string) {
  drawHeader(doc, 'Engineering packet', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(22, 30, 46);
  doc.text('Project summary', 56, 76);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 74, 102);
  const cams = devices.filter((d) => TYPE_KIND[d.type] === 'camera').length;
  const access = devices.filter((d) => TYPE_KIND[d.type] === 'access').length;
  const idfs = devices.filter((d) => d.type === 'net.idf' || d.type === 'net.switch').length;
  doc.text(`Project ID: ${projectId}`, 56, 96);
  doc.text(`Cameras: ${cams}  ·  Access devices: ${access}  ·  Network: ${idfs}`, 56, 112);
  doc.text(`Total devices: ${devices.length}`, 56, 128);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Device schedule', 56, 160);
  drawTable(doc, 168,
    ['ID', 'Type', 'Label', 'Product'],
    devices.slice(0, 60).map((d) => [d.id, d.type, d.label ?? '—', d.product ?? '—']),
    [80, 110, 150, 160],
  );
}

function drawCustomerPresentation(doc: any, devices: Device[], projectId: string) {
  drawHeader(doc, 'Customer presentation', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(22, 30, 46);
  doc.text('System overview', 56, 86);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(60, 74, 102);
  doc.text(`This proposal covers the design and installation of ${devices.length} security devices`, 56, 110);
  doc.text(`across the ${projectId} site. The system is engineered for 24/7 operation,`, 56, 126);
  doc.text(`30-day video retention, and code-compliant access control on every opening.`, 56, 142);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('What you get', 56, 180);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  [
    `${devices.filter((d) => TYPE_KIND[d.type] === 'camera').length} cameras across exterior and interior coverage`,
    `${devices.filter((d) => TYPE_KIND[d.type] === 'access').length} access points with credential, REX, and DPS hardware`,
    `Network infrastructure rated for the device count plus 30 % growth headroom`,
    `Full commissioning, training, and a 1-year warranty on installation labor`,
  ].forEach((line, i) => doc.text('•  ' + line, 64, 200 + i * 18));

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Investment summary', 56, 304);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  const estTotal = Math.round(devices.length * 1480 * 1.18);
  doc.text(`Indicative total: $${estTotal.toLocaleString()}`, 56, 326);
  doc.setFontSize(9); doc.setTextColor(120, 134, 162);
  doc.text('Final pricing depends on cable run lengths, mounting hardware, and labor schedule. See BOM for detail.', 56, 346);
}

function drawCameraSchedule(doc: any, devices: Device[]) {
  drawHeader(doc, 'Camera schedule', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Camera schedule', 56, 76);
  const cams = devices.filter((d) => TYPE_KIND[d.type] === 'camera');
  drawTable(doc, 100,
    ['ID', 'Type', 'Location', 'Product', 'IR'],
    cams.map((c) => [c.id, c.type.replace('cam.', ''), c.label ?? '—', c.product ?? '—', c.ir ? 'Yes' : 'No']),
    [70, 80, 130, 160, 60],
  );
}

function drawDoorSchedule(doc: any, devices: Device[]) {
  drawHeader(doc, 'Door schedule', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Door / opening schedule', 56, 76);
  const doors = devices.filter((d) => isStackableHost(d.type));
  drawTable(doc, 100,
    ['ID', 'Type', 'Label', 'Stack count', 'Hardware'],
    doors.map((d) => [d.id, d.type.replace('inf.', ''), d.label ?? '—', String(d.stack?.length ?? 0),
      (d.stack ?? []).map((id) => devices.find((x) => x.id === id)?.type ?? id).join(', ').slice(0, 36) || '—']),
    [70, 100, 110, 80, 140],
  );
}

function drawCableSchedule(doc: any, projectId: string) {
  drawHeader(doc, 'Cable & pathway schedule', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Cable & pathway schedule', 56, 76);
  // Read pathways live from the store; use the calibrated per-floor scale.
  const _state = useProjectStore.getState();
  const pathways = (Object.values(_state.pathways) as any[]).filter((p) => p.projectId === projectId);
  drawTable(doc, 100,
    ['ID', 'Type', 'Cable', 'Count', 'Length ft'],
    pathways.map((p) => [p.id, p.type ?? '—', p.cableType ?? '—', String(p.cableCount ?? 1), String(pathwayLengthFt(p, _state.floors[p.floorId ?? '']))]),
    [80, 80, 100, 60, 80],
  );
}

function drawBOMReport(doc: any, projectId: string) {
  drawHeader(doc, 'Bill of materials', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Bill of materials', 56, 76);
  const state = useProjectStore.getState();
  const bom = deriveBOM(state, projectId);
  drawTable(doc, 100,
    ['SKU', 'Description', 'Qty', 'Unit', 'Unit $', 'Ext $'],
    bom.lines.map((l: any) => [l.sku ?? '—', l.description, l.qty, l.uom ?? 'ea', l.unitPrice, Math.round(l.qty * l.unitPrice)]),
    [80, 220, 40, 50, 60, 70],
  );
}

function drawComplianceReport(doc: any, devices: Device[], pxToFt: number) {
  drawHeader(doc, 'Compliance checklist', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Compliance checklist', 56, 76);
  const cams = devices.filter((d) => TYPE_KIND[d.type] === 'camera');
  const ndaaPct = cams.length ? Math.round((cams.filter((c) => c.ndaa).length / cams.length) * 100) : 100;
  const issues = computeIntelIssues(devices, pxToFt).filter((i) => i.severity === 'high' || i.kind === 'compliance' || i.kind === 'ada');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(60, 74, 102);
  doc.text(`NDAA · ${ndaaPct}% of cameras compliant`, 56, 110);
  doc.text(`Fire egress · ${issues.filter((i) => i.kind === 'compliance').length} open issue${issues.filter((i) => i.kind === 'compliance').length === 1 ? '' : 's'}`, 56, 130);
  doc.text(`ADA reach · ${issues.filter((i) => i.kind === 'ada').length} open issue${issues.filter((i) => i.kind === 'ada').length === 1 ? '' : 's'}`, 56, 150);
  drawTable(doc, 180,
    ['Severity', 'Kind', 'Label', 'Detail'],
    issues.map((i) => [i.severity, i.kind, i.label, i.detail]),
    [70, 90, 130, 220],
  );
}

function drawCommissioningReport(doc: any, devices: Device[]) {
  drawHeader(doc, 'Commissioning report', 2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Commissioning report', 56, 76);
  drawTable(doc, 100,
    ['ID', 'Type', 'Install', 'Firmware', 'Network', 'Signal', 'Signed off'],
    devices.map((d: any) => {
      const c = d.commissioning ?? {};
      return [d.id, d.type, c.install ?? '—', c.firmware ?? '—', c.network ?? '—', c.signal ?? '—', c.signedOff ? 'Yes' : 'No'];
    }),
    [70, 100, 60, 70, 60, 60, 80],
  );
}
