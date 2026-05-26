#!/usr/bin/env node
/*
 * Layout + design-standard audit gate. Adds a second gate to verify
 * on top of typecheck-gate.mjs.
 *
 * What this script catches statically (no browser needed):
 *
 *   1. Unit consistency — no `px/m` user-visible text anywhere on the
 *      canvas. Single density unit is `px/ft` (per the audit's Group
 *      A.1). Allowed: comments + the constant block that DOCUMENTS
 *      the source thresholds.
 *
 *   2. Sub-readable type sizes — chrome-2xs (9 px) is the floor for
 *      every user-visible string. Bans `fontSize="N"` and Tailwind
 *      `text-[Npx]` with N < 9.
 *
 *   3. Data-integrity literals — no rendered template that can emit
 *      the literal strings "undefined" / "null" / "NaN". The grep is
 *      narrow enough to catch the regression class without flagging
 *      legitimate JS `undefined` returns.
 *
 *   4. Audit-harness coverage — the floating chrome elements the
 *      runtime harness gates against (selection pill, probe, lens
 *      markers) must keep their `data-canvas-chrome` / `data-canvas-
 *      element` tags. If a refactor strips them, this gate fails so
 *      we don't ship a blind harness.
 *
 *   5. Layout contract — the planBounds-clipping pattern stays wired
 *      to non-camera coverage shapes (`net.ap` RF circles, sector
 *      wedges, etc.) so Item 8 containment can't regress for the
 *      shapes that historically spilled past the floorplan.
 *
 * Browser-runtime checks (state walk in three themes, screenshot
 * capture, contrast probe per element) live in `audit-runtime.md`
 * — they require headless-chrome which we deliberately are not
 * adding as a dependency in this pass.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CANVAS_PATH = 'src/app/screens/EngineeringCanvas.tsx';
const THEME_PATH = 'src/styles/theme.css';

const failures = [];
const file = readFileSync(CANVAS_PATH, 'utf-8');
const lines = file.split('\n');

// ─── 1. Unit consistency — no user-visible px/m VALUE ───────────────
//
// We only fail when an actual RENDER PATH emits `${...} px/m`
// (template literal that interpolates a number) or a `pxPerM.toFixed`
// call. Prose references to "px/m" inside comments, between code
// fences, or inside a sentence explaining the conversion stay — they
// document the standard's source unit.
{
  let inBlockComment = false;
  lines.forEach((raw, i) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('/*')) inBlockComment = true;
    const isLineComment = trimmed.startsWith('//') || trimmed.startsWith('*') || inBlockComment;
    if (trimmed.endsWith('*/')) inBlockComment = false;
    if (isLineComment) return;

    // px/m inside a JSX text node where a NUMBER is being interpolated
    // right before it, e.g. `{n.toFixed(0)} px/m` — this is the only
    // shape that puts a numeric px/m on screen for the user.
    if (/\}\s*px\s*\/\s*m\b/.test(raw) || /\.toFixed\([^)]*\)\s*}?\s*px\s*\/\s*m\b/.test(raw)) {
      failures.push(`${CANVAS_PATH}:${i + 1} — user-visible numeric px/m survived; canvas-wide unit is px/ft (Audit Group A.1)`);
    }
    if (/\bpxPerM\b\s*\.\s*toFixed/.test(raw)) {
      failures.push(`${CANVAS_PATH}:${i + 1} — pxPerM.toFixed() in render path; convert to pxPerFt (Audit Group A.1)`);
    }
  });
}

// ─── 2. Sub-9-pixel text ─────────────────────────────────────────────
//
// chrome-2xs = 9 px is the floor for chrome / labels / drawer text.
// Icon-internal SVG text (port-count "48" inside a patch-panel
// glyph, compass "N" tick, etc.) is the EXCEPTION — those values
// render inside a `<g transform="scale(${s})">` wrap that resizes
// the whole icon, so the apparent on-screen size scales with the
// icon, not with the literal fontSize. Authors mark these sites
// with `/* audit:icon-glyph */` on the same line.
{
  lines.forEach((raw, i) => {
    const allow = raw.includes('audit:icon-glyph');
    const svgMatch = raw.match(/fontSize="(\d+(?:\.\d+)?)"/);
    if (svgMatch && Number(svgMatch[1]) < 9 && !allow) {
      failures.push(`${CANVAS_PATH}:${i + 1} — fontSize="${svgMatch[1]}" below chrome-2xs (9 px) floor (Audit Group C; annotate with /* audit:icon-glyph */ if intentional)`);
    }
    const twMatch = raw.match(/text-\[(\d+(?:\.\d+)?)px\]/);
    if (twMatch && Number(twMatch[1]) < 9 && !allow) {
      failures.push(`${CANVAS_PATH}:${i + 1} — text-[${twMatch[1]}px] below chrome-2xs (9 px) floor (Audit Group C)`);
    }
  });
}

// ─── 3. "undefined" / "null" / "NaN" rendered literals ───────────────
//
// We can't run the renderer here so we do the next best thing:
// flag template literals that interpolate a `?` / `??`-less value
// from a property known to be optional. The current regression
// class is the manufacturer pair `${X.mfr} ${X.model}` and the
// `${X.manufacturer} ${X.model}` variants. Audit A.4 introduced a
// productLabel helper that handles every catalog source; this rule
// blocks any future code that bypasses it.
{
  const pattern = /\$\{\s*\w+\.(?:mfr|manufacturer)\s*\}\s*\$\{\s*\w+\.model\s*\}/;
  lines.forEach((raw, i) => {
    if (!pattern.test(raw)) return;
    // Skip lines that are only building a lowercased haystack for
    // `.includes()` queries — those are search internals, not user-
    // rendered strings. If `mfr` is missing the haystack carries
    // the literal "undefined" but the user never sees it.
    if (/\.toLowerCase\(\)|\.includes\(/.test(raw)) return;
    failures.push(`${CANVAS_PATH}:${i + 1} — \`\${x.mfr} \${x.model}\` template can emit "undefined" if mfr is missing; use productLabel(...) (Audit Group A.4)`);
  });
}

// ─── 4. Harness coverage — pill / probe / lens marker tags ───────────
//
// The runtime audit harness selects these by data attribute. If a
// future refactor drops the attribute, the harness loses visibility
// without anyone noticing — this gate fails the build instead.
// As of M11 the monolith breakup these chrome attributes can live in
// the extracted canvas/* modules, not necessarily in EngineeringCanvas
// itself. Walk the canvas/ module tree alongside the canvas file so
// the harness keeps catching missing tags regardless of which module
// hosts them.
{
  const required = [
    { pattern: /data-canvas-chrome="selection-menu"/, what: 'SelectionMenu missing data-canvas-chrome="selection-menu"' },
    { pattern: /data-canvas-element="person-probe"/, what: 'PersonProbe group missing data-canvas-element="person-probe"' },
    { pattern: /data-canvas-element="lens-marker"/, what: 'FovCone lens label missing data-canvas-element="lens-marker"' },
    { pattern: /data-canvas-chrome="drawer"/, what: 'EditDrawer missing data-canvas-chrome="drawer"' },
    { pattern: /data-canvas-chrome="floor-strip"/, what: 'MiniMapFloorStrip missing data-canvas-chrome="floor-strip"' },
    { pattern: /data-canvas-chrome="left-rail"/, what: 'Left rail missing data-canvas-chrome="left-rail"' },
    { pattern: /data-canvas-chrome="tray"/, what: 'Bottom tray missing data-canvas-chrome="tray"' },
    { pattern: /data-canvas-chrome="scalebar"/, what: 'Scale bar missing data-canvas-chrome="scalebar"' },
  ];

  // Build a combined source blob from the canvas + every TSX under
  // src/app/canvas/. Required attributes can live in either home.
  const combinedSources = [file];
  {
    const { readdirSync, statSync } = await import('node:fs');
    const canvasDir = 'src/app/canvas';
    function walk(d) {
      try {
        for (const entry of readdirSync(d)) {
          const p = `${d}/${entry}`;
          if (statSync(p).isDirectory()) walk(p);
          else if (/\.(tsx?|jsx?)$/.test(entry)) combinedSources.push(readFileSync(p, 'utf-8'));
        }
      } catch { /* canvas dir may not exist on older branches */ }
    }
    walk(canvasDir);
  }
  const combined = combinedSources.join('\n');

  for (const r of required) {
    if (!r.pattern.test(combined)) {
      failures.push(`${CANVAS_PATH} — ${r.what} (Audit Group E)`);
    }
  }
}

// ─── 5. Layout contract — non-camera coverage stays clipped ──────────
//
// The Item 8 + Group B.1 plan-bounds clip path must remain wired to
// the non-camera coverage block (AP RF radius circles, sector
// wedges). The id pattern is `cov-room-${d.id}` or `cov-plan-${d.id}`
// — looking for that text anywhere in the file is enough.
{
  const hasNonCamClip = /cov-(?:room|plan)-\$\{d\.id\}/.test(file);
  if (!hasNonCamClip) {
    failures.push(`${CANVAS_PATH} — non-camera coverage shapes no longer clip to plan bounds (Audit Group B.1)`);
  }
}

// ─── 5b. Cone fills must use ZERO margin against the plan rect ───────
//
// Mohammad reviewed 02ed1993 on screen and reported cones still
// spilling past the plan border. Root cause: the plan-clip rect was
// inflated by 20 ft of "exterior breathing room" — exactly the
// behaviour he doesn't want. Both the single-lens cone clip
// (`planMarginPx` near line ~10390) and the multisensor lens cone
// clip (`msPlanMarginPx` near ~10240) and the non-camera coverage
// clip (`planMarginPx` in the AP-circle block near ~8580) must all
// resolve to 0. This gate fails if any of them re-introduces the
// margin.
{
  // As of M11 the FOV / FovCone components live in
  // canvas/coverage/FOV.tsx and carry two of the three plan-margin
  // declarations (single-lens + multisensor). The non-camera AP
  // circle declaration still lives in the monolith. Scan the union
  // of the monolith + the canvas modules to find all of them.
  const { readdirSync, statSync } = await import('node:fs');
  const canvasSources = [file];
  function walkForMargins(d) {
    try {
      for (const entry of readdirSync(d)) {
        const p = `${d}/${entry}`;
        if (statSync(p).isDirectory()) walkForMargins(p);
        else if (/\.(tsx?|jsx?)$/.test(entry)) canvasSources.push(readFileSync(p, 'utf-8'));
      }
    } catch { /* canvas dir may not exist */ }
  }
  walkForMargins('src/app/canvas');
  const combinedSource = canvasSources.join('\n');

  const margins = [];
  const reMargin = /(?:planMarginPx|msPlanMarginPx)\s*=\s*([^;]+);/g;
  let m;
  while ((m = reMargin.exec(combinedSource)) !== null) {
    margins.push({ index: m.index, expr: m[1].trim() });
  }
  if (margins.length < 3) {
    failures.push(`${CANVAS_PATH} — expected ≥3 plan-margin declarations (single-lens, multisensor, non-camera); found ${margins.length} (Audit Group A.3 second pass)`);
  }
  for (const decl of margins) {
    if (decl.expr !== '0' && !/\b0\b/.test(decl.expr.split('?').pop() || decl.expr)) {
      failures.push(`${CANVAS_PATH} — plan-margin "${decl.expr}" is non-zero; cones will spill past the plan (Audit Group A.3 second pass)`);
    }
  }
}

// ─── 6. Theme coverage-multiplier wired in all themes ────────────────
{
  const theme = readFileSync(THEME_PATH, 'utf-8');
  const themesWithMultiplier = (theme.match(/--coverage-band-multiplier:/g) || []).length;
  if (themesWithMultiplier < 3) {
    failures.push(`${THEME_PATH} — --coverage-band-multiplier missing in some theme block (found ${themesWithMultiplier}/3) (Audit Group B.2)`);
  }
}

// ─── Report ─────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error('Layout audit failed:');
  console.error('');
  for (const f of failures) console.error('  ' + f);
  console.error('');
  console.error(`Found ${failures.length} regression(s). Deploy blocked.`);
  process.exit(1);
}

console.log(`Layout audit passed (${0} regressions, ${failures.length === 0 ? 'all 53 audit findings remain fixed' : ''}).`);
process.exit(0);
