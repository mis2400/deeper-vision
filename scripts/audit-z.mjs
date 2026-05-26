#!/usr/bin/env node
/*
 * Z-index audit gate. Enforces the M2 z-index token contract.
 *
 * The token scale lives on :root in src/styles/theme.css (--z-canvas
 * through --z-shortcut-help) and is exposed as utility classes via
 * @layer utilities in the same file (.z-canvas / .z-rail / .z-modal /
 * etc). Every NEW use of a z-index should reach for one of those classes.
 *
 * This script counts RAW z-index usages per file:
 *   - z-[N]            (Tailwind arbitrary value)
 *   - z-N\b            (Tailwind preset z-10/z-20/...)
 *   - zIndex: N        (inline style)
 *   - z-index: N       (raw CSS)
 *
 * It compares each file's count against scripts/audit-z-baseline.json
 * (committed). If any file's raw count goes UP, the gate fails. The
 * baseline updates as subsequent rebuild milestones migrate raw values
 * to token classes; counts can only go down or stay flat.
 *
 * Two files are excluded from the audit because they OWN the z-index
 * scale and document the layer order:
 *   - src/styles/theme.css         (the token definitions live here)
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const BASELINE_PATH = join(ROOT, 'scripts', 'audit-z-baseline.json');
const EXCLUDE_FILES = new Set([
  'src/styles/theme.css',
]);

const RAW_PATTERNS = [
  /\bz-\[\d+\]/g,
  /\bz-\d+\b/g,
  /\bzIndex\s*:\s*\d+/g,
  /\bz-index\s*:\s*\d+/g,
];

async function walk(dir, files = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return files;
    throw e;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, files);
    else if (/\.(tsx?|jsx?|css)$/.test(e.name)) files.push(p);
  }
  return files;
}

function relpath(abs) {
  return abs.startsWith(ROOT + '/') ? abs.slice(ROOT.length + 1) : abs;
}

function countRaw(text) {
  let total = 0;
  for (const re of RAW_PATTERNS) {
    const m = text.match(re);
    if (m) total += m.length;
  }
  return total;
}

async function run() {
  const writeBaseline = process.argv.includes('--write-baseline');

  const files = await walk(join(ROOT, 'src'));
  const counts = {};
  for (const f of files) {
    const rel = relpath(f);
    if (EXCLUDE_FILES.has(rel)) continue;
    const text = await readFile(f, 'utf8');
    const c = countRaw(text);
    if (c > 0) counts[rel] = c;
  }

  if (writeBaseline) {
    const json = JSON.stringify(counts, null, 2) + '\n';
    const { writeFile } = await import('node:fs/promises');
    await writeFile(BASELINE_PATH, json, 'utf8');
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`Wrote baseline: ${Object.keys(counts).length} files, ${total} raw z-index usages.`);
    return;
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(`Z audit: baseline missing. Run \`node scripts/audit-z.mjs --write-baseline\` to create it.`);
    process.exit(1);
  }
  const baseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8'));

  const regressions = [];
  for (const [f, c] of Object.entries(counts)) {
    const base = baseline[f] ?? 0;
    if (c > base) regressions.push({ file: f, baseline: base, current: c });
  }

  if (regressions.length > 0) {
    console.error('Z-index audit FAILED — files added new raw z-index usages:');
    console.error('');
    for (const r of regressions) {
      console.error(`  ${r.file}: ${r.baseline} → ${r.current} (+${r.current - r.baseline})`);
    }
    console.error('');
    console.error('Use one of the token classes from src/styles/theme.css instead:');
    console.error('  z-canvas / z-device / z-handle / z-floor-badge / z-rail');
    console.error('  z-bottom-bar / z-selection-menu / z-inspector / z-dv-assist');
    console.error('  z-overlay / z-popover / z-modal / z-confirm / z-toast / z-shortcut-help');
    console.error('');
    console.error('If a legitimate new raw z-index is required, update the baseline:');
    console.error('  node scripts/audit-z.mjs --write-baseline');
    process.exit(1);
  }

  const totalCurrent = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalBaseline = Object.values(baseline).reduce((a, b) => a + b, 0);
  const drift = totalBaseline - totalCurrent;
  const driftMsg = drift > 0 ? ` (${drift} fewer than baseline — migration progress)` : drift < 0 ? '' : '';
  console.log(`Z audit OK: ${Object.keys(counts).length} files with raw z-index, ${totalCurrent} total${driftMsg}.`);
}

run().catch((err) => {
  console.error('Z audit crashed:', err);
  process.exit(1);
});
