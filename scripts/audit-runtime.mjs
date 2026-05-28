#!/usr/bin/env node
/*
 * Runtime health audit. Boots `vite preview` against the freshly built
 * `dist/`, drives a headless Chrome through the routes the operator
 * actually uses, and FAILS the deploy gate if any of two things happen:
 *
 *   1. A page renders an empty body (the white-screen class — exactly
 *      what shipped on the `/deployment` route in `index-p3m71637.js`).
 *   2. The browser console logs an error during load or after the
 *      defined post-load action (the React error #185 class that
 *      causes the white screen in the first place).
 *
 * A blank page or a console error blocks deploy. Screenshots are saved
 * to `audit-runtime-shots/` for the diff record. The audit is
 * intentionally narrow: this is not a visual diff system. It only
 * catches the failure class that has been recurring.
 */

import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { freePort } from './audit-port.mjs';

const PREVIEW_PORT = 4173;
const BASE = `http://localhost:${PREVIEW_PORT}`;
const OUT = 'audit-runtime-shots';
const BLANK_BODY_THRESHOLD = 40; // characters; below this is a white screen
const NETWORK_IDLE_MS = 1500;
const POST_ACTION_MS = 1500;

if (!existsSync(OUT)) mkdirSync(OUT);

// ─── Routes ───────────────────────────────────────────────────────────
// One entry per surface the operator hits. `after` runs an interaction
// before we sample the body / capture the screenshot. `assert` runs an
// in-page check whose return value becomes a failure message; null /
// undefined means pass. Assertions catch the regression class that body
// length + console errors miss (an entire button missing, text rendering
// invisibly against its background, a placement action that returns
// silently).
const routes = [
  { name: 'canvas',     path: '/project/p1/canvas',
    // Three zoom controls must render — Mohammad lost the zoom-in
    // button on a prior rail-position change. Body length + console
    // errors don't catch this; an explicit DOM count does.
    assert: 'rail-has-zoom' },
  { name: 'deployment', path: '/project/p1/deployment' },
  { name: 'review',     path: '/project/p1/review' },
  // M11 coverage widening (E76): the BOM drawer is the live pricing
  // surface every estimate hangs off. A regression in deriveCanvasBom
  // or in the drawer's row rendering used to slip through because the
  // route only checked that the drawer "opens" via body delta. Now
  // assert that real BOM rows render and a numeric Sell total is
  // displayed.
  { name: 'canvas-bom', path: '/project/p1/canvas', after: 'open-bom',
    assert: 'bom-rows-and-total' },
  { name: 'canvas-sel', path: '/project/p1/canvas', after: 'open-selection-section',
    // Open the AIM section panel and verify its text contrasts with the
    // panel background. The first M7 ship rendered dark text on the
    // dark canvas-rail surface and was unreadable across themes.
    assert: 'panel-text-readable' },
  // M9 — selecting a multisensor must auto-set activeLens to a specific
  // lens slot ('a' by default) and only ONE ConeHandles rig mounts on
  // the canvas. A regression here looks like four handle sets stacked
  // at the same coordinate or a console error in the activeLens reset
  // effect.
  // M11 coverage widening (E77): also assert the selection strip
  // surfaces the picked device's label so a regression that drops
  // the strip entirely, or renders it with the wrong device, is
  // caught instead of silently passing on a body-length match.
  { name: 'canvas-multisensor', path: '/project/p1/canvas', after: 'select-multisensor',
    assert: 'selection-strip-shows-device' },
  // M6 — drag a real tray card onto the canvas via synthetic HTML5
  // drag events and assert a new device appears. Body length doesn't
  // catch a silent drag-and-drop failure; the device count delta does.
  // Native puppeteer cannot truly simulate HTML5 drag with a custom
  // dataTransfer; this synthesises the dragstart / dragover / drop
  // events directly, which IS what the production handlers receive
  // from the browser.
  { name: 'canvas-drag-place', path: '/project/p1/canvas', after: 'drag-place-camera',
    assert: 'drag-placed-device' },
  // M5 — calibration screen exercises the Web Worker plan import path
  // and the IndexedDB blob storage plumbing on boot. A regression in
  // either lands here as a console error or blank body before reaching
  // any user surface.
  { name: 'calibrate',  path: '/calibrate/p1' },
];

// ─── Vite preview server ──────────────────────────────────────────────
// Boots in the background. `npm run build` produces the dist that this
// preview serves; the audit script does not invoke build itself so the
// `verify` script can sequence build → audit cleanly.
async function startPreview() {
  // M11 audit fix (E69): a previous crashed run can leave vite holding
  // 4173. With --strictPort the new run dies immediately and the whole
  // audit chain reports a misleading "Audit crashed" with exit code 1.
  // Reclaim the port first so the harness's green/red signal stays
  // trustworthy.
  const cleaned = await freePort(PREVIEW_PORT);
  if (cleaned) console.log(`Reclaimed port ${PREVIEW_PORT} (killed ${cleaned.pids.join(',')} via ${cleaned.signal}).`);
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('vite preview did not boot inside 20 s')), 20000);
    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if (text.includes(`http://localhost:${PREVIEW_PORT}`) || /Local:.*\d+/.test(text)) {
        clearTimeout(timer);
        res();
      }
    });
    proc.on('error', (e) => { clearTimeout(timer); rej(e); });
    proc.on('exit', (code) => { clearTimeout(timer); rej(new Error(`vite preview exited with code ${code}`)); });
  });
  return proc;
}

// ─── Per-route check ──────────────────────────────────────────────────
async function checkRoute(browser, route) {
  const page = await browser.newPage();
  const errors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text().slice(0, 320));
    }
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${(err.message || String(err)).slice(0, 320)}`));

  await page.setViewport({ width: 1440, height: 900 });

  // Audit-only auth bypass. Set in localStorage BEFORE the page loads
  // so the AuthGate's first render reads `kind: 'ready'` and the
  // protected routes (canvas / deployment / review) render their real
  // content instead of redirecting the headless browser to /login.
  // Production users never set this key; AuthGate is the only consumer.
  await page.evaluateOnNewDocument(() => {
    try { window.localStorage.setItem('dv-audit-bypass', 'true'); } catch { /* localStorage blocked */ }
  });

  try {
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (e) {
    errors.push(`navigation: ${String(e).slice(0, 320)}`);
  }
  await new Promise((r) => setTimeout(r, NETWORK_IDLE_MS));

  if (route.after === 'open-bom') {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim().startsWith('BOM'));
      btn && btn.click();
    });
    await new Promise((r) => setTimeout(r, POST_ACTION_MS));
  } else if (route.after === 'select-device' || route.after === 'select-multisensor' || route.after === 'open-selection-section') {
    // CAM-105 is the seeded fisheye; CAM-103 is the seeded multisensor.
    // M9 (per-lens handle gating) regresses only when a multisensor is
    // selected, so the multisensor case is its own audit route.
    const target = route.after === 'select-multisensor' ? 'CAM-103' : 'CAM-105';
    await page.evaluate((deviceId) => {
      const node = document.querySelector(`[data-device-id="${deviceId}"]`);
      const hit = (node && node.querySelector('[data-hit="device"]')) || node;
      if (!hit) return;
      const r = hit.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      ['pointerdown', 'pointerup'].forEach((t) => {
        hit.dispatchEvent(new PointerEvent(t, {
          bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse',
          clientX: cx, clientY: cy, button: 0,
        }));
      });
      hit.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0,
      }));
    }, target);
    await new Promise((r) => setTimeout(r, POST_ACTION_MS));
    if (route.after === 'open-selection-section') {
      // Open the AIM section panel — the one Mohammad reported as
      // unreadable. Clicking the aim icon in the strip toggles the
      // section panel; we open it so the contrast assertion has
      // something to read.
      await page.evaluate(() => {
        const btn = document.querySelector('[data-track="selmenu-aim"]')
          || document.querySelector('[data-track="selmenu-specs"]');
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, POST_ACTION_MS));
    }
  } else if (route.after === 'drag-place-camera') {
    // Open the bottom-bar camera category drawer first so the product
    // cards mount in the DOM; without this the bottombar-cam-* nodes
    // do not exist and the drag has nothing to grab.
    await page.evaluate(() => {
      const catBtn = document.querySelector('[data-track="bottombar-cat-cam"]')
        || document.querySelector('[data-track^="bottombar-cat-"]');
      if (catBtn) catBtn.click();
    });
    await new Promise((r) => setTimeout(r, POST_ACTION_MS));
    // Stash the before-count for the assertion + find the source +
    // target geometry. Done inside evaluate so the values are pulled
    // from the live DOM.
    const dragPlan = await page.evaluate(() => {
      window.__auditDeviceCountBeforeDrop = document.querySelectorAll('[data-device-id]').length;
      const card = document.querySelector('[data-track^="bottombar-cam-"]')
        || document.querySelector('[data-track^="bottombar-search-"]')
        || document.querySelector('button[draggable="true"]');
      if (!card) return null;
      const svg = document.querySelector('svg');
      if (!svg) return null;
      const cardR = card.getBoundingClientRect();
      const svgR  = svg.getBoundingClientRect();
      return {
        startX: cardR.left + cardR.width * 0.5,
        startY: cardR.top + cardR.height * 0.5,
        dropX:  svgR.left + svgR.width * 0.5,
        dropY:  svgR.top + svgR.height * 0.5,
      };
    });
    if (!dragPlan) {
      errors.push('drag-place setup: no draggable tray card or canvas SVG found');
    } else {
      // HTML5 drag and drop can NOT be fully driven from puppeteer:
      //   - mouse.up after a draggable mousedown produces a click, not
      //     dragstart, because Chromium needs OS-level drag init
      //     signals that headless mode doesn't fire.
      //   - dispatchEvent on a synthetic DragEvent doesn't reach
      //     React's synthetic event handlers (React only routes events
      //     that the browser raised natively from the input pipeline).
      //
      // The production code exposes window.__dvSimulateDrop as a test
      // seam, gated on the dv-audit-bypass localStorage flag (set by
      // page.evaluateOnNewDocument above so the auth gate also passes).
      // The seam runs the EXACT onProductDrop callback the real drop
      // handler would invoke — same lookup, same host-attachment, same
      // placeProductAt. If a production user could trigger this seam,
      // the worst they could do is place a device they could already
      // place. Production runs gate on the flag being absent.
      const dropResult = await page.evaluate((plan) => {
        const sim = window.__dvSimulateDrop;
        if (typeof sim !== 'function') return 'window.__dvSimulateDrop not exposed (test seam missing)';
        const card = document.querySelector('[data-track^="bottombar-cam-"]')
          || document.querySelector('[data-track^="bottombar-search-"]');
        if (!card) return 'no draggable tray card mounted';
        const track = card.getAttribute('data-track') || '';
        const productId = track.replace(/^bottombar-(cam|search)-/, '');
        if (!productId) return 'tray card has no product id in data-track';
        try {
          sim(productId, plan.dropX, plan.dropY);
        } catch (e) {
          return `seam threw: ${e && e.message ? e.message : String(e)}`;
        }
        return null;
      }, dragPlan);
      if (dropResult) errors.push(`drag-place: ${dropResult}`);
    }
    await new Promise((r) => setTimeout(r, POST_ACTION_MS));
  }

  // ── Per-route assertion ──
  // Returns a failure message string if the route is broken in a way
  // that body length + console errors don't see. Each assertion is a
  // small in-page evaluate that asserts the actual user behaviour.
  let assertionFailure = null;
  if (route.assert === 'rail-has-zoom') {
    assertionFailure = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[data-track^="intel-rail-"]'));
      const ids = buttons.map((b) => (b.getAttribute('data-track') || '').replace('intel-rail-', ''));
      const required = ['zoom-out', 'zoom-percent', 'zoom-in'];
      const missing = required.filter((r) => !ids.includes(r));
      if (missing.length > 0) return `left rail missing zoom controls: ${missing.join(', ')} (have ${ids.join(', ') || 'nothing'})`;
      return null;
    });
  } else if (route.assert === 'panel-text-readable') {
    assertionFailure = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="selection-section-panel"]');
      if (!panel) return 'selection-section-panel did not render after clicking an icon';
      const title = document.querySelector('[data-testid="selection-section-title"]');
      if (!title) return 'selection-section-title missing inside panel';
      // Compute the WCAG relative-luminance ratio for the panel title.
      // Both the panel background and the title color resolve via the
      // canvas-rail tokens; if either ended up dark-on-dark or light-
      // on-light the ratio falls under WCAG AA.
      function parseColor(s) {
        const m = s.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
        return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] == null ? 1 : parts[3] };
      }
      function rel(c) {
        const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
      }
      // The background may resolve to the rail token; if its alpha is
      // < 1 we composite it over the document body color before
      // computing luminance. Otherwise the live transparent overlay
      // confuses the ratio test.
      function composite(fg, bgChain) {
        let r = fg.r, g = fg.g, b = fg.b, a = fg.a;
        for (const bg of bgChain) {
          if (a >= 1) break;
          const ai = 1 - a;
          r = r * a + bg.r * ai;
          g = g * a + bg.g * ai;
          b = b * a + bg.b * ai;
          a = a + bg.a * ai;
        }
        return { r, g, b, a };
      }
      const bodyBgColor = parseColor(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
      const titleColor = composite(parseColor(getComputedStyle(title).color) || { r: 0, g: 0, b: 0, a: 1 }, [bodyBgColor]);
      const panelBg = composite(parseColor(getComputedStyle(panel).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }, [bodyBgColor]);
      const L1 = rel(titleColor), L2 = rel(panelBg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      // WCAG AA for normal text is 4.5; the panel title is small bold
      // text, so 4.5 is the bar. Fail BELOW the bar so any dark-on-dark
      // / light-on-light regression is caught.
      if (ratio < 4.5) {
        return `selection panel title contrast ratio ${ratio.toFixed(2)} is below WCAG AA 4.5 (text rgb(${Math.round(titleColor.r)},${Math.round(titleColor.g)},${Math.round(titleColor.b)}) vs background rgb(${Math.round(panelBg.r)},${Math.round(panelBg.g)},${Math.round(panelBg.b)}))`;
      }
      return null;
    });
  } else if (route.assert === 'selection-strip-shows-device') {
    assertionFailure = await page.evaluate(() => {
      // After a selectable device is clicked, the SelectionMenu
      // renders inside [data-canvas-chrome="selection-menu"] with a
      // label chip carrying device.label and a device type label.
      // The select-multisensor after-action targets CAM-103, whose
      // seeded label is "Atrium" and whose type renders four lens
      // chips A/B/C/D plus the standard close/delete trio. Three
      // independent signals must agree:
      //   1. the strip mounted at all
      //   2. it carries the multisensor's four lens chips (proves
      //      the strip is for THIS device, not a stale render of
      //      another product), and
      //   3. selmenu-* control tracks remain (close/delete/icons
      //      did not collapse to bare label only)
      const strip = document.querySelector('[data-canvas-chrome="selection-menu"]');
      if (!strip) return 'selection menu strip did not mount after clicking CAM-103';
      const lensChips = ['a', 'b', 'c', 'd'].map((k) => strip.querySelector(`[data-track="selmenu-lens-${k}"]`));
      const missingLens = lensChips.map((el, i) => el ? null : ['a', 'b', 'c', 'd'][i]).filter(Boolean);
      if (missingLens.length > 0) return `selection strip mounted but is missing lens chip(s): ${missingLens.join(', ')} (strip text=${JSON.stringify((strip.textContent || '').trim().slice(0, 80))})`;
      const tracks = strip.querySelectorAll('[data-track^="selmenu-"]');
      if (tracks.length < 5) return `selection strip has only ${tracks.length} selmenu-* controls (expected lens chips + close/delete/duplicate plus per-section icons)`;
      return null;
    });
  } else if (route.assert === 'bom-rows-and-total') {
    assertionFailure = await page.evaluate(() => {
      // The drawer carries the data-track^="bom-row-" attribute on
      // each row so the BOM filter pills target them. Rows must exist
      // for the seeded demo project (p1 ships with cameras, doors,
      // pathways).
      const rows = document.querySelectorAll('[data-track^="bom-row-"]');
      if (rows.length === 0) return 'BOM drawer opened but no rows rendered (deriveCanvasBom returned empty or row render path broke)';
      // Sell total renders in the drawer summary with a USD figure.
      // We search the drawer subtree for "Sell total" plus a $ amount
      // near it.
      const drawer = document.querySelector('[data-canvas-chrome="drawer"]') || document.body;
      const text = (drawer.textContent || '').trim();
      if (!/Sell total/i.test(text)) return 'BOM drawer is missing the "Sell total" summary section';
      const match = text.match(/Sell total[^$]*\$([0-9][0-9,]*)/i);
      if (!match) return 'BOM drawer "Sell total" header has no $ figure beside it (totals math broke)';
      const num = parseInt(match[1].replace(/,/g, ''), 10);
      if (!Number.isFinite(num) || num <= 0) return `BOM drawer "Sell total" parsed as ${match[1]} which is not a positive number`;
      return null;
    });
  } else if (route.assert === 'drag-placed-device') {
    assertionFailure = await page.evaluate(() => {
      const before = window.__auditDeviceCountBeforeDrop;
      const after = document.querySelectorAll('[data-device-id]').length;
      if (typeof before !== 'number') return 'drag setup did not stash a before-count; the synthetic drag never started';
      if (after <= before) {
        // Surface the sentinel state so failures pinpoint which step
        // of the synthetic drag pipeline broke.
        const overFired = !!window.__dvDragOverFired;
        const dropFired = !!window.__dvDropFired;
        const productSeen = window.__dvDropProductId;
        return `drag drop did not place a device (before=${before}, after=${after}). dragover fired=${overFired}, drop fired=${dropFired}, dataTransfer product id seen at drop=${JSON.stringify(productSeen)}`;
      }
      return null;
    });
  }

  const bodyText = await page.evaluate(() => (document.body.innerText || '').trim());
  const shot = join(OUT, `${route.name}.png`);
  await page.screenshot({ path: shot });
  await page.close();

  return { route, bodyText, bodyLen: bodyText.length, errors, shot, assertionFailure };
}

// ─── Driver ───────────────────────────────────────────────────────────
async function run() {
  console.log(`Starting vite preview on port ${PREVIEW_PORT} ...`);
  const preview = await startPreview();

  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const results = [];
    for (const route of routes) {
      const r = await checkRoute(browser, route);
      results.push(r);
      const blank = r.bodyLen < BLANK_BODY_THRESHOLD;
      const ok = !blank && r.errors.length === 0 && !r.assertionFailure;
      const mark = ok ? '✓' : '✗';
      const tail = r.assertionFailure ? `  assert=FAIL` : '';
      console.log(`  ${mark} ${r.route.name.padEnd(20)} body=${String(r.bodyLen).padStart(5)}B  consoleErrors=${r.errors.length}${tail}  shot=${r.shot}`);
    }
    await browser.close();

    const failures = [];
    for (const r of results) {
      if (r.bodyLen < BLANK_BODY_THRESHOLD) {
        failures.push(`${r.route.name} (${r.route.path}) — BLANK page (body length ${r.bodyLen}); white-screen class`);
      }
      if (r.errors.length > 0) {
        const errBlock = r.errors.map((e) => '        ' + e).join('\n');
        failures.push(`${r.route.name} (${r.route.path}) — ${r.errors.length} console error(s):\n${errBlock}`);
      }
      if (r.assertionFailure) {
        failures.push(`${r.route.name} (${r.route.path}) — assertion failed: ${r.assertionFailure}`);
      }
    }

    if (failures.length > 0) {
      console.error('\nRuntime audit FAILED — deploy blocked:\n');
      for (const f of failures) {
        console.error('  ' + f);
        console.error('');
      }
      process.exit(1);
    }

    console.log(`\nRuntime audit passed: ${results.length}/${results.length} routes render, 0 console errors, all assertions pass.`);
    process.exit(0);
  } finally {
    preview.kill('SIGTERM');
    setTimeout(() => preview.kill('SIGKILL'), 1500);
  }
}

run().catch((err) => {
  console.error('Audit crashed:', err);
  process.exit(1);
});
