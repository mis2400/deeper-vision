#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────
// MVP Spine Completion SC.7.8 — Technical correctness pass
// ─────────────────────────────────────────────────────────────────────
//
// SC.7 closed the cumulative deferred technical-correctness gaps:
//   * Camera cones honor per-floor scalePxToFt (audit #6, was hardcoded
//     3.83 px/ft across 7 sites).
//   * EngineeringCanvas breadcrumb reads the actual project name (was
//     hardcoded 'Riverbend HQ').
//   * ProposalCanvasSnapshot blueprints offload to IndexedDB so
//     localStorage stays small (v29 -> v30).
//   * TicketNote.visibility flag: operator can author internal-only
//     notes that never reach the customer portal (v30 -> v31).
//
// This script prints the paste-into-DevTools procedure that exercises
// the whole chain. Steps that depend on real DOM (the canvas SVG,
// the portal renderer) include the data-testid assertions.
//
// Run: `node scripts/sc7-spine-integrity.mjs`

const PROJECT_ID = 'p1';

const SETUP_SNIPPET = `
// STEP 1 — reset baseline. Paste, then hard reload.
(() => {
  const store = window.__projectStore;
  if (!store) { console.error('window.__projectStore not found.'); return; }
  store.getState().resetDemoData();
  console.log('[SC.7.8 setup] reset. Hard reload now (Cmd Shift R).');
})();
`;

const CONE_CALIBRATION_SNIPPET = `
// STEP 2 — SC.7.1 cone calibration. Read a cone path's radius on
//          /project/${PROJECT_ID}/canvas, calibrate the active floor
//          to a different scale, confirm the radius changes by the
//          same ratio. Was a hardcoded 3.83 px/ft before SC.7.1; the
//          fix uses ftPerPxForFloor(floor).
(async () => {
  const store = window.__projectStore;
  const fid = store.getState().currentFloorIdByProject?.['${PROJECT_ID}']
           ?? Object.values(store.getState().floors).find(f => f.projectId === '${PROJECT_ID}')?.id;
  if (!fid) return console.error('[SC.7.8 cone] no active floor');

  const radius = (p) => {
    if (!p) return null;
    const m = p.match(/A\\s+([\\d.-]+)\\s+([\\d.-]+)/);
    return m ? parseFloat(m[1]) : null;
  };
  // Wait one tick after each store update so React paints.
  const tick = () => new Promise((r) => setTimeout(r, 400));

  // Uncalibrated default (0.05 ft/px).
  store.getState().updateFloor(fid, { scalePxToFt: 0.05, calibratedAt: undefined });
  await tick();
  const before = radius(document.querySelector('path[fill*="url(#fov-grad"]')?.getAttribute('d'));

  // Calibrate to 0.125 ft/px (2.5x looser scale, so cone radius shrinks 2.5x).
  store.getState().updateFloor(fid, {
    scalePxToFt: 0.125, calibratedAt: Date.now(),
    calibrationReferenceFt: 10, calibrationMeasuredPx: 80,
  });
  await tick();
  const after = radius(document.querySelector('path[fill*="url(#fov-grad"]')?.getAttribute('d'));

  console.log('[SC.7.8 cone-calibration]', {
    beforeRadius: before,
    afterRadius: after,
    expectedRatio: 0.125 / 0.05,
    actualRatio: before && after ? (before / after).toFixed(2) : null,
    auditOk: before && after && Math.abs((before / after) - 2.5) < 0.01,
  });
})();
`;

const BREADCRUMB_SNIPPET = `
// STEP 3 — SC.7.2 breadcrumb. Each project's canvas should read its
//          own name. Pre SC.7.2 the breadcrumb hardcoded 'Riverbend
//          HQ' on every project.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = window.__projectStore;
  const projects = Object.values(store.getState().projects);
  if (projects.length < 2) return console.error('[SC.7.8 breadcrumb] need at least 2 projects');
  const a = projects[0]; const b = projects[1];

  window.history.pushState({}, '', '/project/' + a.id + '/canvas');
  window.dispatchEvent(new PopStateEvent('popstate'));
  await sleep(700);
  const headA = document.body.innerText.slice(0, 300);

  window.history.pushState({}, '', '/project/' + b.id + '/canvas');
  window.dispatchEvent(new PopStateEvent('popstate'));
  await sleep(700);
  const headB = document.body.innerText.slice(0, 300);

  console.log('[SC.7.8 breadcrumb]', {
    showsA: headA.includes(a.name),
    showsB: headB.includes(b.name),
    leaksRiverbendA: headA.includes('Riverbend HQ'),
    leaksRiverbendB: headB.includes('Riverbend HQ'),
    auditOk: headA.includes(a.name) && headB.includes(b.name)
          && !headA.includes('Riverbend HQ') && !headB.includes('Riverbend HQ'),
  });
})();
`;

const BLUEPRINT_INDEXEDDB_SNIPPET = `
// STEP 4 — SC.7.3 blueprint factoring. Send a proposal on a project
//          that has a blueprint background. Snapshot must carry a
//          dataUrlRef (hash), NOT inline dataUrl. localStorage stays
//          small; blueprint blob lives in IndexedDB.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = window.__projectStore;
  const fid = Object.values(store.getState().floors).find(f => f.projectId === '${PROJECT_ID}')?.id;
  if (!fid) return console.error('[SC.7.8 blueprint] no floor');

  // ~50 KB synthetic blueprint inline.
  const filler = 'AAAA'.repeat(12000);
  const fakeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==' + filler;

  store.getState().updateFloor(fid, {
    background: {
      dataUrl: fakeDataUrl, fileName: 'sc78.png', origin: 'png',
      x: 0, y: 0, scale: 1, rotation: 0, opacity: 1,
      naturalWidth: 800, naturalHeight: 600,
    },
  });
  await sleep(100);

  const draftId = store.getState().createProposal({
    projectId: '${PROJECT_ID}',
    customerView: { header: 'SC.7.8 fixture', executiveSummary: '', scope: '' },
    internalView:  { notes: '', loadedCost: 0, gpPct: 0 },
    bomSnapshot: [{ id: 'pl-1', section: 'cameras', description: 'Cam', quantity: 1, unit: 'ea', unitPrice: 100, lineTotal: 100 }],
    status: 'draft',
  });
  const ok = await store.getState().sendProposal(draftId);
  const sent = store.getState().proposals[draftId];
  const snapBg = sent?.canvasSnapshot?.floors.find(f => f.id === fid)?.background;
  const persistSize = (localStorage.getItem('deeperVisionStore') ?? '').length;

  console.log('[SC.7.8 blueprint-indexeddb]', {
    sendOk: ok,
    snapBgHasInlineDataUrl: !!snapBg?.dataUrl,
    snapBgHasDataUrlRef: !!snapBg?.dataUrlRef,
    persistSizeKB: Math.round(persistSize / 1024),
    auditOk: ok && !snapBg?.dataUrl && !!snapBg?.dataUrlRef && persistSize < 1024 * 1024,
  });
})();
`;

const TICKET_VISIBILITY_SNIPPET = `
// STEP 5 — SC.7.7 ticket visibility. Operator authors one customer
//          note and one internal note. Customer Portal must show
//          only the customer note. Internal Ticket Detail must
//          show both with an Internal badge on the second.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = window.__projectStore;
  const tid = store.getState().createTicket({
    customerId: 'c1', projectId: '${PROJECT_ID}',
    title: 'Visibility integrity test',
    description: 'Two notes follow — one customer, one internal.',
    priority: 'medium', category: 'other',
    reportedBy: { name: 'John Doe' },
  });
  store.getState().addTicketNote(tid, { authorName: 'Maria', body: 'Customer-visible reply.' });
  store.getState().addTicketNote(tid, { authorName: 'Maria', body: 'Internal commentary.', visibility: 'internal' });

  const t = store.getState().serviceTickets[tid];
  const customerVisible = t.notes.filter(n => n.visibility === 'customer' || !n.visibility);
  const internal = t.notes.filter(n => n.visibility === 'internal');

  // Visit the portal and inspect the rendered timeline
  window.history.pushState({}, '', '/portal/${PROJECT_ID}');
  window.dispatchEvent(new PopStateEvent('popstate'));
  await sleep(800);
  const row = document.querySelector('[data-testid^="portal-ticket-row-"]');
  row?.click();
  await sleep(300);
  const portalText = document.body.innerText;

  console.log('[SC.7.8 ticket-visibility]', {
    storeCustomerCount: customerVisible.length,
    storeInternalCount: internal.length,
    portalShowsCustomerReply: portalText.includes('Customer-visible reply.'),
    portalLeaksInternalNote: portalText.includes('Internal commentary.'),
    auditOk: customerVisible.length === 1 && internal.length === 1
          && portalText.includes('Customer-visible reply.')
          && !portalText.includes('Internal commentary.'),
  });
})();
`;

const MIGRATION_SNIPPET = `
// STEP 6 — SC.7.7 v30 -> v31 migration backfill. Hand-seed a v30
//          persist blob with a note lacking visibility, reload, and
//          confirm the migration wrote visibility='customer' on it.
//          The portal's defensive `|| !n.visibility` fallback should
//          NEVER need to fire — every persisted note carries the field.
(() => {
  const v30 = {
    state: { customers:{}, contacts:{}, projects:{}, sites:{}, buildings:{}, floors:{},
      proposals:{}, opportunities:{}, touches:{}, tasks:{}, devices:{}, doors:{},
      pathways:{}, idfs:{}, attachments:{}, approvals:{}, assets:{}, warranties:{},
      activity:{}, workOrderProgress:{}, snapshots:{}, busFleets:{}, buses:{},
      busCameras:{}, busDVRs:{}, busChecks:{}, busEvents:{}, projectPricebooks:{},
      surveyItems:{}, threatScenarios:{}, threatScenarioRuns:{},
      serviceTickets: {
        'tkt-legacy': {
          id: 'tkt-legacy', ticketNumber: 'DV-2024-9999',
          customerId: 'c1', projectId: '${PROJECT_ID}',
          title: 'Pre migration', description: 'No visibility on the note',
          priority: 'medium', category: 'other', status: 'open',
          reportedBy: { name: 'Legacy' },
          notes: [{ id: 'n1', authorName: 'Legacy', body: 'No visibility set', createdAt: '2026-04-01T00:00:00.000Z' }],
          createdAt: 1714521600000, updatedAt: 1714521600000,
        },
      },
    },
    version: 30,
  };
  localStorage.setItem('deeperVisionStore', JSON.stringify(v30));
  console.log('[SC.7.8 migration] v30 blob seeded. Hard reload, then run STEP 7.');
})();
`;

const MIGRATION_ASSERT_SNIPPET = `
// STEP 7 — assert the migration backfilled visibility='customer'.
(() => {
  const persisted = JSON.parse(localStorage.getItem('deeperVisionStore') ?? 'null');
  const note = persisted?.state?.serviceTickets?.['tkt-legacy']?.notes?.[0];
  console.log('[SC.7.8 migration-assert]', {
    persistedVersion: persisted?.version,
    noteVisibility: note?.visibility,
    auditOk: persisted?.version === 31 && note?.visibility === 'customer',
  });
})();
`;

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log(' SC.7.8 spine integrity test — Technical correctness');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('Verifies the four user-visible deliverables of SC.7:');
console.log('  - cone math honors calibration (SC.7.1)');
console.log('  - canvas breadcrumb shows real project name (SC.7.2)');
console.log('  - proposal blueprints offload to IndexedDB (SC.7.3)');
console.log('  - ticket internal notes never leak to the portal (SC.7.7)');
console.log('');
console.log('STEP 1 — reset baseline:');
console.log(SETUP_SNIPPET);
console.log('Hard reload, then open /project/' + PROJECT_ID + '/canvas in another tab.');
console.log('');
console.log('STEP 2 — cone calibration:');
console.log(CONE_CALIBRATION_SNIPPET);
console.log('STEP 3 — breadcrumb per project:');
console.log(BREADCRUMB_SNIPPET);
console.log('STEP 4 — blueprint IndexedDB factoring:');
console.log(BLUEPRINT_INDEXEDDB_SNIPPET);
console.log('STEP 5 — ticket visibility (customer / internal):');
console.log(TICKET_VISIBILITY_SNIPPET);
console.log('STEP 6 — seed v30 blob to test the migration backfill:');
console.log(MIGRATION_SNIPPET);
console.log('STEP 7 — hard reload after STEP 6, then run this assert:');
console.log(MIGRATION_ASSERT_SNIPPET);
console.log('ACCEPTANCE CHECKLIST');
console.log('  [ ] STEP 2: auditOk = true (actualRatio ≈ 2.5).');
console.log('  [ ] STEP 3: auditOk = true (no Riverbend leaks, both names show).');
console.log('  [ ] STEP 4: auditOk = true (snapshot has dataUrlRef, no inline dataUrl, persist < 1 MB).');
console.log('  [ ] STEP 5: auditOk = true (portal hides internal note).');
console.log('  [ ] STEP 7: auditOk = true (persistedVersion = 31, note backfilled to customer).');
console.log('');
