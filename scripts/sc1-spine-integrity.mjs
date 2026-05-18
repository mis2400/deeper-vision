#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────
// MVP Spine Completion SC.1.6 — integrity test
// ─────────────────────────────────────────────────────────────────────
//
// The Zustand store this app uses is browser only (persist to
// localStorage). There is no Node side store instance to write to.
// So this "script" prints the deterministic operator procedure for
// validating the SC.1 chain end to end against the live app:
//
//   1. Reset demo data so we start from a known baseline.
//   2. Paste a one shot fixture loader into the browser DevTools
//      console. The loader uses the same actions the app uses
//      (addApproval, createAssetFromDevice, addWarranty,
//      createTicket), so it exercises the real code paths.
//   3. Hard reload. Inspect localStorage. Confirm every record
//      survived and every linkage is intact.
//
// Run: `node scripts/sc1-spine-integrity.mjs`
//
// What gets created:
//   1x Project (uses seeded p1 = Riverbend HQ)
//   1x Approval against that project
//   1x Asset from one of that project's seeded devices
//   1x Warranty on that asset
//   1x ServiceTicket linked to customer + project + device + asset + warranty

const PROJECT_ID = 'p1';
const DEVICE_ID  = 'cam-101';

const FIXTURE_SNIPPET = `
// Paste this into the browser DevTools console at:
//   https://deeper-vision-ashy.vercel.app/project/p1/canvas
//
// or your local dev server. The store action API is the same.

(() => {
  const store = window.__projectStore;
  if (!store) {
    console.error('window.__projectStore not found. Are you in dev/staging build?');
    return;
  }
  const s = store.getState();

  // Pick the seeded project + first device to anchor the test.
  const project = s.projects['${PROJECT_ID}'];
  if (!project) { console.error('Project ${PROJECT_ID} not seeded. Run resetDemoData() first.'); return; }
  const device = s.devices['${DEVICE_ID}'] ?? Object.values(s.devices).find((d) => d.projectId === '${PROJECT_ID}');
  if (!device) { console.error('No device on project ${PROJECT_ID} to anchor the Asset. Run resetDemoData().'); return; }

  // 1. Approval
  const approvalId = 'appr-sc1-test-' + Date.now();
  s.addApproval({
    id: approvalId,
    projectId: project.id,
    proposalVersion: 'v1-test',
    approverName: 'SC.1.6 Test Approver',
    approverEmail: 'sc16@example.com',
    approvalType: 'design',
    comments: 'Approved by SC.1.6 integrity fixture.',
    approvedAt: new Date().toISOString(),
    createdAt: 0,
    updatedAt: 0,
  });

  // 2. Asset (idempotent on deviceId)
  const assetId = s.createAssetFromDevice({
    deviceId: device.id,
    projectId: project.id,
    customerId: project.customerId,
    manufacturer: device.mfr ?? 'Test Mfr',
    model: device.model ?? device.type ?? 'Test Model',
    serialNumber: 'SN-SC16-TEST',
    commissionedBy: 'SC.1.6 Test Engineer',
    status: 'active',
  });

  // 3. Warranty on the asset
  const warrantyId = 'wty-' + assetId + '-mfr';
  const now = Date.now();
  s.addWarranty({
    id: warrantyId,
    assetId,
    provider: 'manufacturer',
    type: 'SC.1.6 Test 1y standard',
    startDate: new Date(now).toISOString().slice(0, 10),
    endDate: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    terms: 'Test terms.',
    coverage: 'Parts only.',
    serialNumber: 'SN-SC16-TEST',
    notes: '',
    createdAt: 0,
    updatedAt: 0,
  });

  // 4. ServiceTicket linked to all parents
  const ticketId = store.getState().createTicket({
    customerId: project.customerId,
    projectId: project.id,
    deviceId: device.id,
    assetId,
    warrantyId,
    title: 'SC.1.6 test ticket',
    description: 'Issued by the SC.1.6 integrity fixture. Safe to close.',
    priority: 'medium',
    category: 'configuration',
    reportedBy: { name: 'SC.1.6 Tester', email: 'sc16@example.com' },
  });

  // 5. Append a timeline note.
  store.getState().addTicketNote(ticketId, {
    authorName: 'SC.1.6 Tester',
    authorEmail: 'sc16@example.com',
    body: 'Timeline check: this note should survive reload.',
  });

  // Verify everything is in state.
  const after = store.getState();
  const summary = {
    approvalId,
    assetId,
    warrantyId,
    ticketId,
    ticketNumber: after.serviceTickets[ticketId]?.ticketNumber,
    approvalCount: Object.values(after.approvals).filter((a) => a.projectId === project.id).length,
    assetCount:    Object.values(after.assets).filter((a) => a.projectId === project.id).length,
    warrantyCount: Object.values(after.warranties).filter((w) => w.assetId === assetId).length,
    ticketCount:   Object.values(after.serviceTickets).filter((t) => t.projectId === project.id).length,
    noteCount:     after.serviceTickets[ticketId]?.notes.length,
  };
  console.log('[SC.1.6 fixture] created:', summary);
  console.log('[SC.1.6 fixture] next step: hard reload, then re run the inspector block.');
  return summary;
})();
`;

const INSPECTOR_SNIPPET = `
// After a hard reload, paste this to confirm everything persisted:
(() => {
  const s = window.__projectStore.getState();
  const project = s.projects['${PROJECT_ID}'];
  const device  = s.devices['${DEVICE_ID}'] ?? Object.values(s.devices).find((d) => d.projectId === '${PROJECT_ID}');
  const assetForDev = Object.values(s.assets).find((a) => a.deviceId === (device && device.id));
  const wtysForAsset = Object.values(s.warranties).filter((w) => w.assetId === (assetForDev && assetForDev.id));
  const tktsForProj = Object.values(s.serviceTickets).filter((t) => t.projectId === '${PROJECT_ID}');
  const result = {
    storeVersion: 'check the persist:value in DevTools > Application > LocalStorage',
    approvalForProject: Object.values(s.approvals).find((a) => a.projectId === '${PROJECT_ID}'),
    assetForDevice: assetForDev,
    warrantyForAsset: wtysForAsset[0],
    ticketForProject: tktsForProj[0],
    ticketNoteCount: tktsForProj[0]?.notes.length,
    chainIntact:
      !!Object.values(s.approvals).find((a) => a.projectId === '${PROJECT_ID}') &&
      !!assetForDev &&
      wtysForAsset.length > 0 &&
      tktsForProj.length > 0 &&
      (tktsForProj[0]?.notes.length ?? 0) > 0,
  };
  console.log('[SC.1.6 inspector] result:', result);
  if (!result.chainIntact) console.error('[SC.1.6 inspector] CHAIN BROKEN — one or more records did not survive reload.');
  else console.log('[SC.1.6 inspector] OK — every link survived.');
  return result;
})();
`;

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log(' SC.1.6 spine integrity test — operator procedure');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('STEP 1. Open the app in your browser, dev or live URL.');
console.log('        Dev:  http://localhost:5173/project/p1/canvas');
console.log('        Live: https://deeper-vision-ashy.vercel.app/project/p1/canvas');
console.log('');
console.log('STEP 2. Open DevTools console.');
console.log('');
console.log('STEP 3. (Optional, recommended) Reset to known baseline:');
console.log('');
console.log('          window.__projectStore.getState().resetDemoData()');
console.log('');
console.log('        Then hard reload (Cmd Shift R) so the v26 store seeds clean.');
console.log('');
console.log('STEP 4. Paste this fixture loader into the console:');
console.log('');
console.log('─── FIXTURE LOADER ───────────────────────────────────────────────────');
console.log(FIXTURE_SNIPPET);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('STEP 5. Hard reload (Cmd Shift R).');
console.log('');
console.log('STEP 6. Paste this inspector into the console after reload:');
console.log('');
console.log('─── INSPECTOR ───────────────────────────────────────────────────────');
console.log(INSPECTOR_SNIPPET);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('STEP 7. Confirm output ends with:');
console.log('          [SC.1.6 inspector] OK — every link survived.');
console.log('');
console.log('Bonus: check Application > Local Storage > deeperVisionStore.');
console.log('       Top level key `state.approvals` / `state.assets` /');
console.log('       `state.warranties` / `state.serviceTickets` should each');
console.log('       contain the matching record. The top level `version`');
console.log('       field should read 26.');
console.log('');
