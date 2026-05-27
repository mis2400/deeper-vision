#!/usr/bin/env node
// audit-exercise.mjs — phase 2 of the full audit. Targeted clicks on
// every important canvas / screen control, recording before/after DOM
// changes + console errors per action. Reuses the vite preview started
// by the previous run (or starts one if not running).

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePort } from './audit-port.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const OUT_DIR = resolve(REPO, 'docs/audits/2026-05-26-full-audit');
const SHOT_DIR = resolve(OUT_DIR, 'screenshots');
const PROJECT_ID = 'p1';
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

const { default: puppeteer } = await import('puppeteer');

async function startVitePreview() {
  // M11 audit fix (E69): reclaim the port from any stale vite preview
  // left behind by a previous run before spawning a new one. Without
  // this, two back to back exercise runs (or a verify + manual run)
  // hit "address already in use" and the new run produces zero data,
  // making the audit report look healthier than it is.
  const cleaned = await freePort(PORT);
  if (cleaned) console.log(`Reclaimed port ${PORT} (killed ${cleaned.pids.join(',')} via ${cleaned.signal}).`);
  return new Promise((res) => {
    const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT)], { cwd: REPO });
    proc.stdout.on('data', (b) => {
      const s = b.toString();
      if (new RegExp(`Local:.*${PORT}|ready in`, 'i').test(s)) res(proc);
    });
    setTimeout(() => res(proc), 3000);
  });
}

const POST_ACTION_MS = 600;

async function click(page, selector, label) {
  const errs = [];
  const onErr = (msg) => { if (msg.type() === 'error') errs.push(msg.text()); };
  const onPageErr = (e) => errs.push(`page: ${e.message}`);
  page.on('console', onErr);
  page.on('pageerror', onPageErr);
  const before = await page.evaluate(() => ({
    bodyLen: (document.body.textContent ?? '').length,
    dialogCount: document.querySelectorAll('[role="dialog"], [data-testid*="dialog"], [data-testid*="confirm"]').length,
    drawerCount: document.querySelectorAll('[data-testid*="drawer"], [data-canvas-chrome="drawer"]').length,
    overlayCount: document.querySelectorAll('.absolute.inset-0.bg-black\\/55, [role="menu"]').length,
    url: location.pathname,
  }));
  const found = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return { tag: el.tagName.toLowerCase(), text: el.textContent?.trim().slice(0, 60), disabled: el.hasAttribute('disabled') };
  }, selector);
  if (!found) {
    page.off('console', onErr); page.off('pageerror', onPageErr);
    return { selector, label, found: false, before, after: null, errs };
  }
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) (el).click();
  }, selector);
  await new Promise((r) => setTimeout(r, POST_ACTION_MS));
  const after = await page.evaluate(() => ({
    bodyLen: (document.body.textContent ?? '').length,
    dialogCount: document.querySelectorAll('[role="dialog"], [data-testid*="dialog"], [data-testid*="confirm"]').length,
    drawerCount: document.querySelectorAll('[data-testid*="drawer"], [data-canvas-chrome="drawer"]').length,
    overlayCount: document.querySelectorAll('.absolute.inset-0.bg-black\\/55, [role="menu"]').length,
    url: location.pathname,
  }));
  page.off('console', onErr);
  page.off('pageerror', onPageErr);
  return { selector, label, found: true, beforeText: found.text, disabled: found.disabled, before, after, errs };
}

async function loadRoute(page, path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
}

const viteProc = await startVitePreview();
console.log('Vite preview ready');

const results = { canvas: [], review: [], deployment: [], reports: [], estimate: [], threat: [] };

try {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => { localStorage.setItem('dv-audit-bypass', 'true'); });

  // ───────────── CANVAS exercises
  await loadRoute(page, `/project/${PROJECT_ID}/canvas`);
  // Open BOM drawer
  results.canvas.push(await click(page, '[data-track="topbar-bom"]', 'TopBar BOM & Estimate'));
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 400));

  // Open Present
  results.canvas.push(await click(page, '[data-track="topbar-review"]', 'TopBar Present'));
  await loadRoute(page, `/project/${PROJECT_ID}/canvas`);

  // Open Deploy
  results.canvas.push(await click(page, '[data-track="topbar-deploy"]', 'TopBar Deploy'));
  await loadRoute(page, `/project/${PROJECT_ID}/canvas`);

  // Open Add plan
  results.canvas.push(await click(page, '[data-track="topbar-add-plan"]', 'TopBar Add plan'));
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 400));

  // Open More menu, then click each item
  results.canvas.push(await click(page, '[data-track="topbar-more"]', 'TopBar More'));
  const moreItems = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-track^="topbar-more-"]')).map((b) => b.getAttribute('data-track')),
  );
  for (const tk of moreItems) {
    // Re-open More if it closed
    await page.evaluate(() => {
      const open = document.querySelector('[data-track^="topbar-more-"]');
      if (!open) {
        const b = document.querySelector('[data-track="topbar-more"]');
        if (b) (b).click();
      }
    });
    await new Promise((r) => setTimeout(r, 250));
    if (tk.startsWith('topbar-more-theme-')) {
      // Theme switchers — record but don't navigate away
      results.canvas.push(await click(page, `[data-track="${tk}"]`, `More: ${tk}`));
    } else if (tk === 'topbar-more-snap' || tk === 'topbar-more-intel') {
      // Toggle controls — click + re-check should toggle state
      results.canvas.push(await click(page, `[data-track="${tk}"]`, `More toggle: ${tk}`));
    } else {
      // Navigation / dialog openers — capture the effect, then return
      results.canvas.push(await click(page, `[data-track="${tk}"]`, `More item: ${tk}`));
      await new Promise((r) => setTimeout(r, 300));
      // Return to canvas in case it navigated or opened a modal
      const url = await page.evaluate(() => location.pathname);
      if (url !== `/project/${PROJECT_ID}/canvas`) {
        await loadRoute(page, `/project/${PROJECT_ID}/canvas`);
        await click(page, '[data-track="topbar-more"]', 're-open More');
      } else {
        await page.keyboard.press('Escape');
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  await loadRoute(page, `/project/${PROJECT_ID}/canvas`);

  // Test view-mode buttons
  for (const m of ['default', 'field', 'canvas']) {
    results.canvas.push(await click(page, `[data-track="topbar-view-${m}"]`, `View mode ${m}`));
  }

  await loadRoute(page, `/project/${PROJECT_ID}/canvas`);

  // Test all left-rail tools
  const toolTracks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-track^="left-rail-tools-"]')).map((b) => b.getAttribute('data-track')),
  );
  for (const tk of toolTracks) {
    results.canvas.push(await click(page, `[data-track="${tk}"]`, `Tool: ${tk}`));
  }

  // Open select-by menu, click each entry
  await click(page, '[data-track="select-by-menu"]', 'Select-by menu (open)');
  const selByItems = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-track^="select-"]')).map((b) => b.getAttribute('data-track')),
  );
  for (const tk of selByItems) {
    if (tk === 'select-by-menu') continue;
    await page.evaluate(() => {
      const open = document.querySelector('[data-track^="select-all-"]');
      if (!open) { const b = document.querySelector('[data-track="select-by-menu"]'); if (b) (b).click(); }
    });
    await new Promise((r) => setTimeout(r, 200));
    results.canvas.push(await click(page, `[data-track="${tk}"]`, `Select-by: ${tk}`));
    await new Promise((r) => setTimeout(r, 200));
  }

  // Open the Cameras tray, snapshot, click a few sub-tabs
  await loadRoute(page, `/project/${PROJECT_ID}/canvas`);
  results.canvas.push(await click(page, '[data-track="bottombar-cat-cam"]', 'Open Cameras tray'));
  await page.screenshot({ path: resolve(SHOT_DIR, 'canvas-cam-tray.png'), fullPage: false });
  const camSubs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="cam-sub-"]')).map((b) => b.getAttribute('data-testid')),
  );
  for (const tid of camSubs) {
    results.canvas.push(await click(page, `[data-testid="${tid}"]`, `Cam sub: ${tid}`));
  }
  // Click a camera card and verify it triggers the drag start handler
  const camCard = await page.evaluate(() => {
    const card = document.querySelector('[data-track^="bottombar-cam-"]');
    return card?.getAttribute('data-track') ?? null;
  });
  if (camCard) {
    results.canvas.push(await click(page, `[data-track="${camCard}"]`, `Camera card click (no drag): ${camCard}`));
  }

  // Open Cabling tray
  await loadRoute(page, `/project/${PROJECT_ID}/canvas`);
  results.canvas.push(await click(page, '[data-track="bottombar-cat-cable"]', 'Open Cabling tray'));
  await page.screenshot({ path: resolve(SHOT_DIR, 'canvas-cable-tray.png'), fullPage: false });
  const cableSubs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-track^="bottombar-cable-sub-"]')).map((b) => b.getAttribute('data-track')),
  );
  for (const tk of cableSubs) {
    results.canvas.push(await click(page, `[data-track="${tk}"]`, `Cable sub: ${tk}`));
  }

  // Open Conduit tray
  await loadRoute(page, `/project/${PROJECT_ID}/canvas`);
  results.canvas.push(await click(page, '[data-track="bottombar-cat-conduit"]', 'Open Conduit tray'));
  await page.screenshot({ path: resolve(SHOT_DIR, 'canvas-conduit-tray.png'), fullPage: false });

  // canvas-add-fab and canvas-overview-open
  await loadRoute(page, `/project/${PROJECT_ID}/canvas`);
  results.canvas.push(await click(page, '[data-track="canvas-add-fab"]', 'Add device FAB'));
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 400));
  results.canvas.push(await click(page, '[data-track="canvas-overview-open"]', 'Floor overview open'));
  await page.screenshot({ path: resolve(SHOT_DIR, 'canvas-overview.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 400));

  // Floor switcher
  results.canvas.push(await click(page, '[data-track="topbar-floor-switcher"]', 'Floor switcher open'));
  const floorPicks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-track="minimap-floor-pick"]')).length,
  );
  results.canvas.push({ selector: 'minimap-floor-pick-count', label: 'Floor picks visible', found: true, count: floorPicks });

  // Manage floors
  await page.evaluate(() => { const b = document.querySelector('[data-track="floor-switcher-manage"]'); if (b) (b).click(); });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: resolve(SHOT_DIR, 'canvas-manage-floors.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 400));

  // ───────────── REVIEW exercises
  await loadRoute(page, `/project/${PROJECT_ID}/review`);
  const reviewTracks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-track^="review-"]')).map((b) => b.getAttribute('data-track')),
  );
  for (const tk of reviewTracks) {
    results.review.push(await click(page, `[data-track="${tk}"]`, `Review: ${tk}`));
    // Some clicks navigate. Reload if so.
    const url = await page.evaluate(() => location.pathname);
    if (!url.endsWith('/review')) await loadRoute(page, `/project/${PROJECT_ID}/review`);
  }
  await page.screenshot({ path: resolve(SHOT_DIR, 'review-bom-visible.png'), fullPage: false });

  // ───────────── DEPLOYMENT exercises
  await loadRoute(page, `/project/${PROJECT_ID}/deployment`);
  const deploymentTracks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-track^="deploy"]')).map((b) => b.getAttribute('data-track')),
  );
  for (const tk of deploymentTracks) {
    results.deployment.push(await click(page, `[data-track="${tk}"]`, `Deployment: ${tk}`));
    const url = await page.evaluate(() => location.pathname);
    if (!url.endsWith('/deployment')) await loadRoute(page, `/project/${PROJECT_ID}/deployment`);
  }

  // ───────────── REPORTS exercises
  await loadRoute(page, `/project/${PROJECT_ID}/reports`);
  const reportsTracks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-track^="reports-"]')).map((b) => b.getAttribute('data-track')),
  );
  for (const tk of reportsTracks) {
    results.reports.push(await click(page, `[data-track="${tk}"]`, `Reports: ${tk}`));
    const url = await page.evaluate(() => location.pathname);
    if (!url.endsWith('/reports')) await loadRoute(page, `/project/${PROJECT_ID}/reports`);
  }
  await page.screenshot({ path: resolve(SHOT_DIR, 'reports-customer-mode.png'), fullPage: false });

  // ───────────── ESTIMATE exercises
  await loadRoute(page, `/estimate/${PROJECT_ID}`);
  results.estimate.push(await click(page, '[data-testid="estimator-export-csv"]', 'Estimator Export CSV'));

  // ───────────── THREAT exercises
  await loadRoute(page, `/threat/${PROJECT_ID}`);
  const threatTracks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-track^="threat-"]')).map((b) => b.getAttribute('data-track')),
  );
  for (const tk of threatTracks.slice(0, 6)) {  // limit to first scenario picks
    results.threat.push(await click(page, `[data-track="${tk}"]`, `Threat: ${tk}`));
    const url = await page.evaluate(() => location.pathname);
    if (!url.startsWith('/threat')) await loadRoute(page, `/threat/${PROJECT_ID}`);
  }
  await page.screenshot({ path: resolve(SHOT_DIR, 'threat-scenario-loaded.png'), fullPage: false });

  writeFileSync(resolve(OUT_DIR, 'audit-exercise.json'), JSON.stringify(results, null, 2));
  // M11 audit fix (E70): write the human readable trace alongside the
  // JSON so they can never drift. Earlier in the audit the .txt was
  // committed by hand and went stale (it showed F1 as `[NO DELTA]`
  // even after the fix landed because nothing regenerated it). Now
  // every exercise run rewrites exercise-trace.txt from the same
  // results object the JSON is built from.
  writeFileSync(resolve(OUT_DIR, 'exercise-trace.txt'), formatTrace(results));
  console.log('Exercise results written. Routes covered:', Object.keys(results).map((k) => `${k}=${results[k].length}`).join(' '));
  await browser.close();
} finally {
  if (viteProc && !viteProc.killed) viteProc.kill('SIGTERM');
}

// Render a single click result as one aligned trace line. The format
// matches the original hand maintained exercise-trace.txt so the diff
// noise on first regen is minimal.
function formatTraceLine(r) {
  const label = (r.label ?? r.selector ?? '').padEnd(55);
  if (!r.found) return '  ' + label + ' [NOT FOUND]';
  if (r.disabled) return '  ' + label + ' [DISABLED]';
  const b = r.before?.bodyLen ?? 0;
  const a = r.after?.bodyLen ?? 0;
  const u0 = r.before?.url ?? '';
  const u1 = r.after?.url ?? '';
  const urlPart = (u0 !== u1) ? ` url->${u1}` : '';
  const ovl0 = r.before?.overlayCount ?? 0;
  const ovl1 = r.after?.overlayCount ?? 0;
  const ovlPart = (ovl0 !== ovl1) ? ` ovl0->${ovl1}` : '';
  let delta = '';
  if (a === b && !urlPart && !ovlPart) delta = ' [NO DELTA]';
  else if (a !== b) delta = ` body${b}->${a}`;
  if (typeof r.count === 'number') delta += ` count=${r.count}`;
  return '  ' + label + delta + urlPart + ovlPart;
}

function formatTrace(results) {
  const sections = ['canvas', 'review', 'deployment', 'reports', 'estimate', 'threat'];
  const lines = [];
  for (const s of sections) {
    const arr = results[s] ?? [];
    lines.push(`=== ${s} (${arr.length} actions) ===`);
    for (const r of arr) lines.push(formatTraceLine(r));
    lines.push('');
  }
  return lines.join('\n');
}
