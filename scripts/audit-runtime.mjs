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

const PREVIEW_PORT = 4173;
const BASE = `http://localhost:${PREVIEW_PORT}`;
const OUT = 'audit-runtime-shots';
const BLANK_BODY_THRESHOLD = 40; // characters; below this is a white screen
const NETWORK_IDLE_MS = 1500;
const POST_ACTION_MS = 1500;

if (!existsSync(OUT)) mkdirSync(OUT);

// ─── Routes ───────────────────────────────────────────────────────────
// One entry per surface the operator hits. `after` runs an interaction
// before we sample the body / capture the screenshot.
const routes = [
  { name: 'canvas',     path: '/project/p1/canvas' },
  { name: 'deployment', path: '/project/p1/deployment' },
  { name: 'review',     path: '/project/p1/review' },
  { name: 'canvas-bom', path: '/project/p1/canvas', after: 'open-bom' },
  { name: 'canvas-sel', path: '/project/p1/canvas', after: 'select-device' },
];

// ─── Vite preview server ──────────────────────────────────────────────
// Boots in the background. `npm run build` produces the dist that this
// preview serves; the audit script does not invoke build itself so the
// `verify` script can sequence build → audit cleanly.
async function startPreview() {
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
  } else if (route.after === 'select-device') {
    await page.evaluate(() => {
      const node = document.querySelector('[data-device-id="CAM-105"]');
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
    });
    await new Promise((r) => setTimeout(r, POST_ACTION_MS));
  }

  const bodyText = await page.evaluate(() => (document.body.innerText || '').trim());
  const shot = join(OUT, `${route.name}.png`);
  await page.screenshot({ path: shot });
  await page.close();

  return { route, bodyText, bodyLen: bodyText.length, errors, shot };
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
      const tag = blank ? 'BLANK' : r.errors.length > 0 ? 'ERROR' : 'OK';
      const mark = tag === 'OK' ? '✓' : '✗';
      console.log(`  ${mark} ${r.route.name.padEnd(12)} body=${String(r.bodyLen).padStart(5)}B  consoleErrors=${r.errors.length}  shot=${r.shot}`);
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
    }

    if (failures.length > 0) {
      console.error('\nRuntime audit FAILED — deploy blocked:\n');
      for (const f of failures) {
        console.error('  ' + f);
        console.error('');
      }
      process.exit(1);
    }

    console.log(`\nRuntime audit passed: ${results.length}/${results.length} routes render, 0 console errors.`);
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
