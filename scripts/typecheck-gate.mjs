#!/usr/bin/env node
/*
 * Deploy gate — narrow type check that fails on the specific class
 * of regression that has shipped twice now:
 *   - `selectedDoriLevel` referenced inside CanvasSurface without
 *     a matching prop / local — blanked the canvas on every device
 *     click.
 *   - `GAP` referenced inside SelectionPill after the const was
 *     deleted in a refactor — blanked the canvas on every device
 *     click again.
 *
 * Both are TS2304 errors ("Cannot find name"). esbuild ships them
 * because it doesn't do reference resolution; tsc catches them in
 * about three seconds.
 *
 * This script runs `tsc --noEmit`, filters output to TS2304 lines
 * only, and exits non-zero if any exist. The other 175 ish
 * pre-existing type errors (TS2339, TS2322, etc.) are intentionally
 * NOT gated — they're shape mismatches and missing properties, not
 * code that will throw at runtime. Cleaning them up is a separate
 * pass. The brief was explicit: "fix the real bugs (undefined refs
 * especially) and report the rest. From now on this class fails the
 * gate before deploy."
 */

import { spawnSync } from 'node:child_process';

const r = spawnSync('npx', ['tsc', '--noEmit'], { encoding: 'utf-8' });
const lines = ((r.stdout || '') + (r.stderr || '')).split('\n');
const undefinedRefs = lines.filter((l) => l.includes('error TS2304:'));

if (undefinedRefs.length > 0) {
  console.error('Type-check gate failed — undefined identifiers detected:');
  console.error('');
  for (const l of undefinedRefs) console.error('  ' + l);
  console.error('');
  console.error(`Found ${undefinedRefs.length} TS2304 error(s). Deploy blocked.`);
  console.error('These are runtime ReferenceErrors waiting to fire. Declare the');
  console.error('identifier, pass it as a prop, or remove the dead reference.');
  process.exit(1);
}

console.log('Type-check gate passed (0 TS2304 undefined identifiers).');
process.exit(0);
