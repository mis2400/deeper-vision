#!/usr/bin/env node
/*
 * Report-PDF audit gate. Drives canvas/reports/draw.ts drawReport()
 * against a real jsPDF document for every ReportKind value and
 * confirms each branch renders a non-empty multi-page PDF without
 * throwing. Replays the same code path the ReportBuilderDialog +
 * ReportExportRow exercise in the browser; only the env is Node +
 * an esbuild bundle that mocks useProjectStore.getState() and the
 * shared helpers at the import-binding layer.
 *
 * Catches the bug class that originally lived in drawConduitSchedule:
 *   - Wrong call shape (missing args, wrong arg order) doesn't get
 *     caught by `npm run build` because jsPDF accepts `any` for most
 *     params; the runtime throw only surfaces when the drawer
 *     actually runs.
 *   - The audit-runtime suite doesn't exercise PDF generation either
 *     (no report route in the 8 audited canvas routes).
 *
 * So this script is the only thing standing between a Report Builder
 * regression and a production "Export failed" toast. Run as part of
 * `npm run verify`.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const { jsPDF } = await import('jspdf');
const { build } = await import('esbuild');

// Fake Zustand store that gives every drawer something real to render:
// pathways for cable + conduit schedules, devices spanning camera +
// access + network kinds for engineering / customer / camera / door
// schedules, doors for the door schedule, idfs targeted by bundles
// for the cable schedule, intel issues exercised via the compliance
// drawer's filter. Pricebook left empty so deriveBOM falls back to
// the defaults the engineering packet expects.
const projectId = 'p-verify';
const fakeState = {
  pathways: {
    'p-bundle-1': { id: 'p-bundle-1', projectId, bundleId: 'BUN-A', cableType: 'cat6a', conduitType: 'EMT', conduitSize: '1/2"', targetId: 'idf-1', sourceId: 'cam-1', floorId: 'f1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], cableCount: 1 },
    'p-bundle-2': { id: 'p-bundle-2', projectId, bundleId: 'BUN-A', cableType: 'cat6a', conduitType: 'EMT', conduitSize: '1/2"', targetId: 'idf-1', sourceId: 'cam-2', floorId: 'f1', points: [{ x: 0, y: 20 }, { x: 100, y: 20 }], cableCount: 1 },
    'p-standalone': { id: 'p-standalone', projectId, cableType: 'cat6', sourceId: 'cam-3', floorId: 'f1', points: [{ x: 200, y: 0 }, { x: 250, y: 0 }], cableCount: 1 },
  },
  floors: {
    f1: { id: 'f1', projectId, scalePxToFt: 1 },
  },
  projects: { [projectId]: { id: projectId, name: 'Verify project' } },
  devices: {
    'cam-1':   { id: 'cam-1',   projectId, floorId: 'f1', type: 'cam.dome',     label: 'Dome 1',     product: 'verkada-cd62-e',  x: 0,   y: 0,   ndaa: true,  ir: true,  rot: 0 },
    'cam-2':   { id: 'cam-2',   projectId, floorId: 'f1', type: 'cam.bullet',   label: 'Bullet 1',   product: 'avigilon-h6a-bo', x: 100, y: 0,   ndaa: false, ir: true,  rot: 0 },
    'cam-3':   { id: 'cam-3',   projectId, floorId: 'f1', type: 'cam.bullet',   label: 'Bullet 2',   product: 'verkada-cb52-te', x: 200, y: 0,   ndaa: true,  ir: false, rot: 0 },
    'door-1':  { id: 'door-1',  projectId, floorId: 'f1', type: 'inf.door',     label: 'Main entry', x: 0,   y: 50,  stack: ['acc-r1'] },
    'door-2':  { id: 'door-2',  projectId, floorId: 'f1', type: 'inf.gate',     label: 'Side gate',  x: 50,  y: 50,  stack: [] },
    'acc-r1':  { id: 'acc-r1',  projectId, floorId: 'f1', type: 'acc.reader',   label: 'Reader',     x: 5,   y: 55,  linkedIds: ['door-1'] },
    'idf-1':   { id: 'idf-1',   projectId, floorId: 'f1', type: 'net.idf',      label: 'IDF-A',      x: 300, y: 0   },
    'mag-1':   { id: 'mag-1',   projectId, floorId: 'f1', type: 'acc.maglock',  label: 'Maglock',    x: 0,   y: 60  },
  },
  doors: {
    'door-1': { id: 'door-1', projectId, floorId: 'f1', label: 'Main entry' },
    'door-2': { id: 'door-2', projectId, floorId: 'f1', label: 'Side gate' },
  },
  idfs: {
    'idf-1': { id: 'idf-1', projectId, floorId: 'f1', name: 'IDF-A' },
  },
  estimates: {
    [`est-${projectId}`]: { laborRate: 95, markup: 0.18 },
  },
  projectPricebooks: {},
  rooms: {},
  surveyItems: {},
  buildings: {},
  measurements: {},
  attachments: {},
  currentFloorIdByProject: { [projectId]: 'f1' },
  categoryColors: {},
  canvasHistory: { past: [], future: [] },
  canvasTheme: 'light',
};

const REPORT_KINDS = [
  'engineering',
  'customer',
  'camera-schedule',
  'door-schedule',
  'cable-schedule',
  'conduit-schedule',
  'bom',
  'compliance',
  'commissioning',
];

const tmpDir = resolve(REPO, '.tmp-audit-reports');
if (!existsSync(tmpDir)) mkdirSync(tmpDir);
const outFile = resolve(tmpDir, 'draw.bundle.mjs');

await build({
  entryPoints: [resolve(REPO, 'src/app/canvas/reports/draw.ts')],
  outfile: outFile,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  external: [],
  plugins: [{
    name: 'mock-store',
    setup(b) {
      // Trap useProjectStore so .getState() returns our fakeState.
      // deriveBOM gets a small set of rows so drawBOMReport's table
      // actually emits content. selectors stay minimal — drawer code
      // only calls firstFloorOfProject.
      b.onResolve({ filter: /\/store\/projectStore$/ }, (args) => ({
        path: args.path,
        namespace: 'mock-store-ns',
      }));
      b.onLoad({ filter: /.*/, namespace: 'mock-store-ns' }, () => ({
        contents: `
          const _state = ${JSON.stringify(fakeState)};
          export const useProjectStore = { getState: () => _state };
          export const selectors = { firstFloorOfProject: (s, pid) => Object.values(s.floors)[0] };
          export const deriveBOM = (_s, _pid) => ({
            lines: [
              { sku: 'verkada-cd62-e',  description: 'Verkada CD62-E dome',   qty: 1, uom: 'ea', unitPrice: 1099, laborHours: 1.5 },
              { sku: 'avigilon-h6a-bo', description: 'Avigilon H6A bullet',   qty: 1, uom: 'ea', unitPrice: 1299, laborHours: 1.5 },
              { sku: 'verkada-cb52-te', description: 'Verkada CB52-TE bullet', qty: 1, uom: 'ea', unitPrice:  999, laborHours: 1.5 },
              { sku: null,              description: 'Cat6A · 24 AWG · per ft', qty: 200, uom: 'ft', unitPrice: 0.31, laborHours: 0 },
            ],
          });
          export const deriveDoorAssemblyLines = () => ({ lines: [] });
          export const deriveCanvasBomRows = () => ({ rows: [], totals: {} });
        `,
        loader: 'js',
      }));
      // pathwayLengthFt — sum of segment lengths in canvas units, which
      // matches the production helper for floors with scalePxToFt=1.
      b.onResolve({ filter: /\/lib\/engineering$/ }, (args) => ({
        path: args.path,
        namespace: 'mock-engineering-ns',
      }));
      b.onLoad({ filter: /.*/, namespace: 'mock-engineering-ns' }, () => ({
        contents: `
          export const pathwayLengthFt = (p, _floor) => {
            if (!p || !Array.isArray(p.points) || p.points.length < 2) return 0;
            let sum = 0;
            for (let i = 1; i < p.points.length; i++) {
              const a = p.points[i - 1], b = p.points[i];
              sum += Math.hypot(b.x - a.x, b.y - a.y);
            }
            return Math.round(sum);
          };
        `,
        loader: 'js',
      }));
      // canvas/intelligence — feed a deterministic set of issues so the
      // compliance drawer's filter (high severity + compliance/ada kinds)
      // returns real rows instead of an empty table.
      b.onResolve({ filter: /canvas\/intelligence$/ }, (args) => ({
        path: args.path,
        namespace: 'mock-intel-ns',
      }));
      b.onLoad({ filter: /.*/, namespace: 'mock-intel-ns' }, () => ({
        contents: `
          export const computeIntelIssues = () => [
            { id: 'code-1', kind: 'compliance', severity: 'high', x: 0, y: 0, label: 'Maglock without REX', detail: 'mag-1 needs a REX device.' },
            { id: 'ada-1',  kind: 'ada',        severity: 'info', x: 0, y: 0, label: 'Reader unlinked',     detail: 'acc-r1 needs a host door.' },
          ];
        `,
        loader: 'js',
      }));
    },
  }],
});

const mod = await import(outFile);
const drawReport = mod.drawReport;
if (typeof drawReport !== 'function') {
  console.error('drawReport not found in bundle');
  process.exit(1);
}

const devicesArr = Object.values(fakeState.devices);
const failures = [];
const results = [];

for (const kind of REPORT_KINDS) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let threw = null;
  try {
    drawReport(doc, kind, devicesArr, projectId, 1);
  } catch (e) {
    threw = e;
  }
  if (threw) {
    failures.push({ kind, message: threw.message, stack: threw.stack });
    continue;
  }
  const buf = doc.output('arraybuffer');
  const bytes = new Uint8Array(buf).length;
  const pages = doc.internal.getNumberOfPages();
  const outPdf = resolve(tmpDir, `${kind}.pdf`);
  writeFileSync(outPdf, Buffer.from(buf));
  results.push({ kind, bytes, pages, outPdf });
  if (bytes < 2000) {
    failures.push({ kind, message: `PDF only ${bytes} bytes — expected >= 2000.`, outPdf });
  }
  if (pages < 2) {
    failures.push({ kind, message: `Only ${pages} page — the ${kind} branch should add a body page on top of the cover.`, outPdf });
  }
}

if (failures.length === 0) {
  console.log(`Reports audit OK: ${results.length} kinds rendered, all cover + body pages emitted.`);
  for (const r of results) {
    console.log(`  ${r.kind.padEnd(20)} ${String(r.bytes).padStart(7)} bytes, ${r.pages} pages → ${r.outPdf}`);
  }
  process.exit(0);
}

console.error(`Reports audit FAILED: ${failures.length} kind${failures.length === 1 ? '' : 's'} broken.\n`);
for (const f of failures) {
  console.error(`  ${f.kind}: ${f.message}`);
  if (f.stack) console.error(f.stack.split('\n').slice(0, 5).map((l) => '    ' + l).join('\n'));
}
process.exit(1);
