#!/usr/bin/env node
// audit-full-app.mjs — comprehensive audit script for the 2026-05-26
// full app audit. Loads each in-scope route under puppeteer, captures
// screenshots in all three themes, enumerates interactive controls,
// exercises a representative set, records console errors and DOM
// behavior. Output goes to docs/audits/2026-05-26-full-audit/.
//
// Audit only — no app code changes, no deploy.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const OUT_DIR = resolve(REPO, 'docs/audits/2026-05-26-full-audit');
const SHOT_DIR = resolve(OUT_DIR, 'screenshots');
if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });

const PROJECT_ID = 'p1';
const BASE = 'http://localhost:4173';

const ROUTES = [
  { id: 'canvas',     path: `/project/${PROJECT_ID}/canvas`,     screen: 'EngineeringCanvas' },
  { id: 'review',     path: `/project/${PROJECT_ID}/review`,     screen: 'ReviewMode' },
  { id: 'deployment', path: `/project/${PROJECT_ID}/deployment`, screen: 'DeploymentMode' },
  { id: 'reports',    path: `/project/${PROJECT_ID}/reports`,    screen: 'ReportsCenter' },
  { id: 'estimate',   path: `/estimate/${PROJECT_ID}`,           screen: 'EstimatorView' },
  { id: 'threat',     path: `/threat/${PROJECT_ID}`,             screen: 'ThreatSimulator' },
];

const THEMES = ['light', 'slate', 'dark'];

const VIEWPORT = { width: 1440, height: 900 };

const { default: puppeteer } = await import('puppeteer');

function startVitePreview() {
  return new Promise((resolveReady, rejectReady) => {
    const proc = spawn('npx', ['vite', 'preview', '--port', '4173'], { cwd: REPO });
    proc.stdout.on('data', (b) => {
      const s = b.toString();
      if (/Local:.*4173|ready in/i.test(s)) resolveReady(proc);
    });
    proc.stderr.on('data', (b) => process.stderr.write(b));
    proc.on('exit', (code) => { if (code !== 0) rejectReady(new Error(`vite preview exited ${code}`)); });
    setTimeout(() => resolveReady(proc), 3000);
  });
}

const POST_NAV_MS = 1200;
const POST_ACTION_MS = 500;
const findings = [];

function logFinding(bucket, severity, id, title, evidence) {
  findings.push({ bucket, severity, id, title, evidence });
}

async function exerciseRoute(page, route, theme) {
  const consoleErrors = [];
  const pageErrors = [];
  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(BASE + route.path, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, POST_NAV_MS));

  // Set theme via document.documentElement[data-theme]
  await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await new Promise((r) => setTimeout(r, 300));

  // Capture screenshot
  const shotPath = resolve(SHOT_DIR, `${route.id}-${theme}.png`);
  await page.screenshot({ path: shotPath, fullPage: false }).catch((e) => {
    logFinding('FUNCTION', 'HIGH', `screenshot-failed-${route.id}-${theme}`,
      `Screenshot failed for ${route.id} (${theme})`, `puppeteer.screenshot threw: ${e.message}`);
  });

  // Enumerate controls in the route
  const controls = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
    const inputs  = Array.from(document.querySelectorAll('input, textarea, select'));
    const links   = Array.from(document.querySelectorAll('a[href]'));
    const drags   = Array.from(document.querySelectorAll('[draggable="true"]'));
    return {
      buttonCount: buttons.length,
      inputCount:  inputs.length,
      linkCount:   links.length,
      dragCount:   drags.length,
      buttonsWithoutHandler: buttons.filter((b) => {
        return !b.onclick
          && !b.hasAttribute('data-track')
          && !b.hasAttribute('data-testid')
          && !b.getAttribute('aria-label')
          && b.textContent?.trim();
      }).length,
      disabledControls: [...buttons, ...inputs].filter((el) => el.hasAttribute('disabled')).length,
      bodyTextLen: (document.body.textContent ?? '').length,
    };
  });

  return { route: route.id, theme, consoleErrors, pageErrors, controls, screenshot: shotPath };
}

async function exerciseCanvasMobileBar(page) {
  await page.goto(BASE + `/project/${PROJECT_ID}/canvas`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise((r) => setTimeout(r, POST_NAV_MS));
  // Open each bottom-bar category and screenshot
  const cats = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-track^="bottombar-cat-"]')).map((b) => ({
      track: b.getAttribute('data-track'),
      label: b.getAttribute('title') ?? b.textContent?.trim() ?? '',
    }));
  });
  const opens = [];
  for (const cat of cats) {
    await page.evaluate((tk) => {
      const b = document.querySelector(`[data-track="${tk}"]`);
      if (b) (b).click();
    }, cat.track);
    await new Promise((r) => setTimeout(r, POST_ACTION_MS));
    const trayOpen = await page.evaluate(() => {
      return !!document.querySelector('[data-testid="cam-sub-tabs"]')
        || !!document.querySelector('[data-testid="cable-sub-tabs"]')
        || !!document.querySelector('[data-testid="conduit-sub-tabs"]')
        || !!document.querySelector('[role="menu"]')
        || (document.querySelectorAll('button[draggable="true"]').length > 0);
    });
    opens.push({ track: cat.track, label: cat.label, trayOpen });
    // close via Escape
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 150));
  }
  return opens;
}

async function exerciseTopBarMore(page) {
  await page.goto(BASE + `/project/${PROJECT_ID}/canvas`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise((r) => setTimeout(r, POST_NAV_MS));
  await page.evaluate(() => {
    const b = document.querySelector('[data-track="topbar-more"]');
    if (b) (b).click();
  });
  await new Promise((r) => setTimeout(r, POST_ACTION_MS));
  // Capture all More menu items
  const items = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-track^="topbar-more-"]')).map((b) => ({
      track: b.getAttribute('data-track'),
      label: b.textContent?.trim() ?? '',
      disabled: b.hasAttribute('disabled'),
    }));
  });
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 150));
  return items;
}

async function exerciseReportsRow(page) {
  // The Reports surface exposes export buttons that drive PDF generation.
  await page.goto(BASE + `/project/${PROJECT_ID}/reports`, { waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise((r) => setTimeout(r, POST_NAV_MS));
  const rows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).filter((b) => {
      const t = (b.textContent ?? '').toLowerCase();
      return t.includes('export') || t.includes('print') || t.includes('email');
    }).map((b) => ({
      label: b.textContent?.trim() ?? '',
      disabled: b.hasAttribute('disabled'),
    })).slice(0, 30);
  });
  return rows;
}

async function inventoryAllControls(page, routePath, label) {
  await page.goto(BASE + routePath, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, POST_NAV_MS));
  return await page.evaluate(() => {
    const enumerate = (sel) =>
      Array.from(document.querySelectorAll(sel)).map((el) => ({
        tag: el.tagName.toLowerCase(),
        track: el.getAttribute('data-track') ?? null,
        testid: el.getAttribute('data-testid') ?? null,
        aria: el.getAttribute('aria-label') ?? null,
        title: el.getAttribute('title') ?? null,
        text: (el.textContent ?? '').trim().slice(0, 80),
        disabled: el.hasAttribute('disabled'),
        href: el.getAttribute('href') ?? null,
      }));
    return {
      buttons: enumerate('button, [role="button"]'),
      inputs:  enumerate('input, textarea, select'),
      links:   enumerate('a[href]'),
      drags:   enumerate('[draggable="true"]'),
    };
  });
}

const viteProc = await startVitePreview();
console.log('Vite preview running on :4173');

try {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // Bypass auth gate. Flag value is the literal string 'true' — see
  // src/app/components/AuthGate.tsx isAuditBypass(). Anything else
  // (e.g. '1') silently falls through to the real Supabase check and
  // lands every navigation on /login.
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('dv-audit-bypass', 'true');
  });

  // PHASE 1 — base screenshots per route per theme + console error capture
  const baseResults = [];
  for (const route of ROUTES) {
    for (const theme of THEMES) {
      const r = await exerciseRoute(page, route, theme);
      baseResults.push(r);
      if (r.pageErrors.length || r.consoleErrors.length) {
        logFinding('FUNCTION', 'HIGH', `console-errors-${route.id}-${theme}`,
          `Console errors on ${route.id} (${theme})`,
          `pageErrors: ${JSON.stringify(r.pageErrors)}, consoleErrors: ${JSON.stringify(r.consoleErrors).slice(0, 500)}`);
      }
      if (r.controls.bodyTextLen < 100) {
        logFinding('FUNCTION', 'HIGH', `blank-${route.id}-${theme}`,
          `Route appears blank on ${theme} theme`,
          `body text length only ${r.controls.bodyTextLen} chars`);
      }
      if (r.controls.disabledControls > 0) {
        logFinding('FLOW', 'INFO', `disabled-controls-${route.id}-${theme}`,
          `${r.controls.disabledControls} disabled control(s) on ${route.id} (${theme})`,
          `inventory pass — count only; per-control identity captured in inventory phase`);
      }
    }
  }

  // PHASE 2 — full control inventory for in-scope routes (light theme only)
  const inventories = {};
  for (const route of ROUTES) {
    inventories[route.id] = await inventoryAllControls(page, route.path, route.id);
  }

  // PHASE 3 — canvas-specific exercises
  const canvasBarOpens = await exerciseCanvasMobileBar(page);
  for (const o of canvasBarOpens) {
    if (!o.trayOpen) {
      logFinding('FUNCTION', 'MED', `canvas-cat-no-tray-${o.track}`,
        `Bottom-bar category ${o.track} opens nothing visible`,
        `clicked ${o.track}, no tray / menu / draggable cards appeared in 500ms`);
    }
  }
  const topbarMoreItems = await exerciseTopBarMore(page);

  // PHASE 4 — reports surface buttons
  const reportsExportRows = await exerciseReportsRow(page);

  // Persist raw data so the human reader can audit the audit.
  const data = {
    generatedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    routes: ROUTES.map((r) => r.id),
    themes: THEMES,
    baseResults,
    inventories,
    canvasBarOpens,
    topbarMoreItems,
    reportsExportRows,
    findings,
  };
  writeFileSync(resolve(OUT_DIR, 'audit-data.json'), JSON.stringify(data, null, 2));

  await browser.close();
  console.log(`Audit data written: ${resolve(OUT_DIR, 'audit-data.json')}`);
  console.log(`Findings recorded: ${findings.length}`);
} finally {
  if (viteProc && !viteProc.killed) viteProc.kill('SIGTERM');
}
