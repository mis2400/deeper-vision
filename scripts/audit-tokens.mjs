#!/usr/bin/env node
/*
 * Design-token audit gate. Enforces the M10 visual pass contract.
 *
 * Three raw-value patterns are tracked, each grandfathered against a
 * per-file baseline so the gate cannot break existing code but DOES
 * block any new raw value entering the codebase:
 *
 *   1. text-[Npx]    Tailwind arbitrary type sizes. Should be one of
 *                    the --chrome-* tokens (text-[9px] / text-[10px] /
 *                    text-[11px] / text-[12px] / text-[13px]) or the
 *                    base scale (text-xs / text-sm / text-base / ...).
 *
 *   2. raw hex       /#[0-9A-Fa-f]{3,8}\b/ in source. Should be a
 *                    semantic CSS variable (var(--primary), etc) or
 *                    the device-domain KIND_TONE / LENS_TONE tables
 *                    (which are domain data, not chrome).
 *
 *   3. transition-all duration-Nms  Tailwind raw transition utilities.
 *                    Should be `transitionDuration: 'var(--motion-*)'`
 *                    inline or scoped to the matching named easing.
 *
 * The baseline is scripts/audit-tokens-baseline.json. Run
 * `node scripts/audit-tokens.mjs --write-baseline` to refresh after
 * legitimate migration work lands.
 *
 * Files in EXCLUDE own the design token system itself and are
 * intentionally exempt: theme.css carries the raw px / hex values that
 * back the tokens, and the canvas constants table (KIND_TONE,
 * LENS_TONE, DEVICE_COLOR_PALETTE) is domain data.
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const BASELINE_PATH = join(ROOT, 'scripts', 'audit-tokens-baseline.json');

const EXCLUDE_FILES = new Set([
  'src/styles/theme.css',
  'src/app/canvas/constants.ts',
]);

const PATTERNS = [
  { name: 'text-px', re: /\btext-\[\d+(?:\.\d+)?px\]/g },
  { name: 'hex',     re: /#[0-9A-Fa-f]{3,8}\b/g },
  { name: 'tx-all',  re: /\btransition-all\s+duration-\d+/g },
];

async function walk(dir, files = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (e) { if (e.code === 'ENOENT') return files; throw e; }
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

function countMatches(text) {
  let total = 0;
  for (const p of PATTERNS) {
    const m = text.match(p.re);
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
    const c = countMatches(text);
    if (c > 0) counts[rel] = c;
  }

  if (writeBaseline) {
    const json = JSON.stringify(counts, null, 2) + '\n';
    const { writeFile } = await import('node:fs/promises');
    await writeFile(BASELINE_PATH, json, 'utf8');
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`Wrote token baseline: ${Object.keys(counts).length} files, ${total} raw token usages.`);
    return;
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error('Tokens audit: baseline missing. Run `node scripts/audit-tokens.mjs --write-baseline`.');
    process.exit(1);
  }
  const baseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8'));

  const regressions = [];
  for (const [f, c] of Object.entries(counts)) {
    const base = baseline[f] ?? 0;
    if (c > base) regressions.push({ file: f, baseline: base, current: c });
  }

  if (regressions.length > 0) {
    console.error('Tokens audit FAILED — files added new raw design values:');
    console.error('');
    for (const r of regressions) {
      console.error(`  ${r.file}: ${r.baseline} → ${r.current} (+${r.current - r.baseline})`);
    }
    console.error('');
    console.error('Use design tokens instead:');
    console.error('  - Type sizes: var(--chrome-{2xs,xs,sm,md,lg}) or text-xs/sm/base/...');
    console.error('  - Colors: var(--primary) / var(--foreground) / var(--muted-foreground) / ...');
    console.error('  - Motion: var(--motion-fast|standard|slow) with var(--ease-out|spring)');
    console.error('');
    console.error('If a legitimate new raw value is required:');
    console.error('  node scripts/audit-tokens.mjs --write-baseline');
    process.exit(1);
  }

  const totalCurrent = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalBaseline = Object.values(baseline).reduce((a, b) => a + b, 0);
  const drift = totalBaseline - totalCurrent;
  const driftMsg = drift > 0 ? ` (${drift} fewer than baseline — migration progress)` : '';
  console.log(`Tokens audit OK: ${Object.keys(counts).length} files with raw values, ${totalCurrent} total${driftMsg}.`);
}

run().catch((err) => {
  console.error('Tokens audit crashed:', err);
  process.exit(1);
});
