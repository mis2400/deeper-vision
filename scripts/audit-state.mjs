#!/usr/bin/env node
/*
 * State model audit gate. Catches the two patterns that produced the
 * /deployment crash and that the M3 milestone is migrating away from.
 *
 * Pattern 1 — whole-store subscription:
 *   const state = useProjectStore();
 *   const x = useProjectStore();  // anywhere
 *   useProjectStore();             // bare call as a hook
 *
 * Every store write re-renders every component holding the whole store
 * reference, regardless of which slice changed. Combined with a useMemo
 * or useEffect whose deps include a derived array/object, this produces
 * an infinite re-render loop (the React error #185 class we already
 * burned a day on).
 *
 * Pattern 2 — useEffect with `state` or whole-store variable in deps:
 *   useEffect(() => { ... }, [state]);
 *
 * Same shape as 1 but flagged on the effect itself.
 *
 * Both patterns exist in the current codebase (six files have whole-store
 * subscriptions today). They are grandfathered via the per-file baseline
 * in scripts/audit-state-baseline.json; rebuild milestones migrate them
 * to selector subscriptions, and counts can only go down or stay flat.
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const BASELINE_PATH = join(ROOT, 'scripts', 'audit-state-baseline.json');

// Whole-store subscription patterns. Each occurrence on a line counts as
// one. Captures the two common shapes:
//   `const x = useProjectStore();`     — assignment without a selector
//   `useProjectStore()` (bare hook call)
// Followed by `(` immediately so we don't false-positive on the import.
const STORE_RE = /\buseProjectStore\(\s*\)/g;

async function walk(dir, files = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (e) { if (e.code === 'ENOENT') return files; throw e; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, files);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) files.push(p);
  }
  return files;
}

function relpath(abs) {
  return abs.startsWith(ROOT + '/') ? abs.slice(ROOT.length + 1) : abs;
}

function countMatches(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

async function run() {
  const writeBaseline = process.argv.includes('--write-baseline');

  const files = await walk(join(ROOT, 'src'));
  const counts = {};
  for (const f of files) {
    const text = await readFile(f, 'utf8');
    const c = countMatches(text, STORE_RE);
    if (c > 0) counts[relpath(f)] = c;
  }

  if (writeBaseline) {
    const json = JSON.stringify(counts, null, 2) + '\n';
    const { writeFile } = await import('node:fs/promises');
    await writeFile(BASELINE_PATH, json, 'utf8');
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`Wrote state baseline: ${Object.keys(counts).length} files, ${total} whole-store subscriptions.`);
    return;
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error('State audit: baseline missing. Run `node scripts/audit-state.mjs --write-baseline`.');
    process.exit(1);
  }
  const baseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8'));

  const regressions = [];
  for (const [f, c] of Object.entries(counts)) {
    const base = baseline[f] ?? 0;
    if (c > base) regressions.push({ file: f, baseline: base, current: c });
  }

  if (regressions.length > 0) {
    console.error('State audit FAILED — files added new whole-store subscriptions:');
    console.error('');
    for (const r of regressions) {
      console.error(`  ${r.file}: ${r.baseline} → ${r.current} (+${r.current - r.baseline})`);
    }
    console.error('');
    console.error('Use a selector subscription instead. Example:');
    console.error('  const devices  = useProjectStore((s) => s.devices);');
    console.error('  const projects = useProjectStore((s) => s.projects);');
    console.error('');
    console.error('For derived helpers that need the whole state, use');
    console.error('useProjectStore.getState() inside the helper rather than');
    console.error('subscribing to the whole store from the component.');
    console.error('');
    console.error('If a legitimate new whole-store subscription is required:');
    console.error('  node scripts/audit-state.mjs --write-baseline');
    process.exit(1);
  }

  const totalCurrent = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalBaseline = Object.values(baseline).reduce((a, b) => a + b, 0);
  const drift = totalBaseline - totalCurrent;
  const driftMsg = drift > 0 ? ` (${drift} fewer than baseline — migration progress)` : '';
  console.log(`State audit OK: ${Object.keys(counts).length} files with whole-store sub, ${totalCurrent} total${driftMsg}.`);
}

run().catch((err) => {
  console.error('State audit crashed:', err);
  process.exit(1);
});
