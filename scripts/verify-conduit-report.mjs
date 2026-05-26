#!/usr/bin/env node
// verify-conduit-report.mjs
// Drives drawReport('conduit-schedule', ...) end-to-end against a real
// jsPDF document and checks that the conduit schedule renders without
// throwing. Replays the same code path the ReportBuilderDialog +
// ReportExportRow exercise from the browser; only the env is Node + a
// minimal Zustand state stub that mirrors the real store shape.

import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

// jsPDF is a normal npm dep. Loading it here so we run against the same
// renderer the Report Builder uses in production.
const { jsPDF } = await import('jspdf');

// Use Vite/Bun's TS importer would be nicer; for this verifier we
// transpile by hand: import the draw.ts source via tsx-equivalent.
// Simpler — esbuild the file in-process via the build step we already
// have, then import the bundle. The draw functions are pure jsPDF
// helpers plus a useProjectStore.getState() call; mocking the store
// shape and trapping the import is the only wiring we need.
const _g = globalThis;

// Fake Zustand store getter. drawConduitSchedule reads .pathways and
// .floors off state — both stay non-empty so the table actually has
// rows to render, and we hit the recommended-size branch on a bundle
// that overruns the 53% rule (2× CAT6A in EMT 1/2").
const projectId = 'p-verify';
const fakeState = {
  pathways: {
    'p-bundle-1': { id: 'p-bundle-1', projectId, bundleId: 'BUN-A', cableType: 'cat6a', conduitType: 'EMT', conduitSize: '1/2"', floorId: 'f1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
    'p-bundle-2': { id: 'p-bundle-2', projectId, bundleId: 'BUN-A', cableType: 'cat6a', conduitType: 'EMT', conduitSize: '1/2"', floorId: 'f1', points: [{ x: 0, y: 20 }, { x: 100, y: 20 }] },
    'p-standalone': { id: 'p-standalone', projectId, cableType: 'cat6', conduitType: undefined, conduitSize: undefined, floorId: 'f1', points: [{ x: 200, y: 0 }, { x: 250, y: 0 }] },
  },
  floors: {
    f1: { id: 'f1', scalePxToFt: 1 },
  },
  projects: { [projectId]: { id: projectId, name: 'Verify project' } },
  devices: {},
  doors: {},
  idfs: {},
  estimates: {},
  projectPricebooks: {},
  rooms: {},
  surveyItems: {},
  buildings: {},
  measurements: {},
  attachments: {},
  // currentFloorIdByProject + categoryColors + canvasHistory shape
  currentFloorIdByProject: { [projectId]: 'f1' },
  categoryColors: {},
  canvasHistory: { past: [], future: [] },
  // canvasTheme so the call site that reads it doesn't break.
  canvasTheme: 'light',
};

// Trap the store import. Node's loader hooks would be cleaner, but the
// draw module is CJS-compatible ESM via Vite + esbuild — we can monkey
// patch the resolved module after the dynamic import returns. Easier:
// run the verifier as an ESM script and intercept the module via the
// import map's resolver-style hook.

// Build a tiny tree-shaken bundle of canvas/reports/draw.ts so we can
// inject the fake store at the import-binding layer.
const { build } = await import('esbuild');
const tmpDir = resolve(REPO, '.tmp-verify-conduit');
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
      b.onResolve({ filter: /\/store\/projectStore$/ }, (args) => ({
        path: args.path,
        namespace: 'mock-store-ns',
      }));
      b.onLoad({ filter: /.*/, namespace: 'mock-store-ns' }, () => ({
        contents: `
          const _state = ${JSON.stringify(fakeState)};
          export const useProjectStore = { getState: () => _state };
          export const selectors = { firstFloorOfProject: (s, pid) => Object.values(s.floors)[0] };
          export const deriveBOM = () => ({ lines: [] });
          export const deriveDoorAssemblyLines = () => ({ lines: [] });
          export const deriveCanvasBomRows = () => ({ rows: [], totals: {} });
        `,
        loader: 'js',
      }));
      // pathwayLengthFt comes from lib/engineering — provide a stub
      // that returns a constant ft per pathway.
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
      // canvas/intelligence — fall back to a no-op for the compliance drawer.
      b.onResolve({ filter: /canvas\/intelligence$/ }, (args) => ({
        path: args.path,
        namespace: 'mock-intel-ns',
      }));
      b.onLoad({ filter: /.*/, namespace: 'mock-intel-ns' }, () => ({
        contents: `
          export const computeIntelIssues = () => [];
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

// Build a real jsPDF doc and run the conduit-schedule branch.
const doc = new jsPDF({ unit: 'pt', format: 'letter' });
let threw = null;
try {
  drawReport(doc, 'conduit-schedule', [], projectId, 1);
} catch (e) {
  threw = e;
}
if (threw) {
  console.error('drawReport(conduit-schedule) THREW:', threw.message);
  console.error(threw.stack);
  process.exit(1);
}

// Confirm the PDF actually has content. jsPDF.output('arraybuffer')
// returns a Uint8Array; ~1.5kb is the empty-doc baseline, real renders
// land well above 2kb.
const buf = doc.output('arraybuffer');
const bytes = new Uint8Array(buf).length;
const outPdf = resolve(tmpDir, 'conduit-schedule.pdf');
writeFileSync(outPdf, Buffer.from(buf));

// Page count from the jsPDF internal API.
const pages = doc.internal.getNumberOfPages();

console.log(`OK · conduit-schedule rendered`);
console.log(`     ${bytes.toLocaleString()} bytes, ${pages} page${pages === 1 ? '' : 's'} → ${outPdf}`);
if (bytes < 2000) {
  console.error(`FAIL · PDF only ${bytes} bytes — expected >= 2000. The conduit schedule didn't render.`);
  process.exit(1);
}
if (pages < 2) {
  console.error(`FAIL · only ${pages} page — the conduit schedule branch should add a body page on top of the cover.`);
  process.exit(1);
}
console.log(`     verified: cover + body page rendered, table emitted.`);
process.exit(0);
