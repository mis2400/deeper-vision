#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────
// MVP Spine Completion SC.2.7 — approval gate + WO derivation test
// ─────────────────────────────────────────────────────────────────────
//
// SC.2 wired the Approval record to its first real consumer: the
// work order gate in deriveWorkOrders. This script prints the
// operator procedure for proving end to end that:
//
//   1. A fresh project shows zero work orders even with devices on
//      the canvas (approval gate blocks).
//   2. Adding a scope approval AND advancing the phase to deployment
//      unlocks work order derivation.
//   3. Removing the approval re blocks the gate so work orders
//      disappear on the next render.
//   4. The state survives a hard reload — the gate is pure
//      derivation, no localStorage flags.
//
// Run: `node scripts/sc2-spine-integrity.mjs`

const PROJECT_ID = 'p1';

const SETUP_SNIPPET = `
// STEP 1 — reset baseline so the test starts clean. Paste into DevTools:
(() => {
  const store = window.__projectStore;
  if (!store) { console.error('window.__projectStore not found.'); return; }
  store.getState().resetDemoData();
  console.log('[SC.2.7 setup] resetDemoData called. Hard reload now (Cmd Shift R).');
})();
`;

const PRE_GATE_SNIPPET = `
// STEP 2 — after reload, confirm WOs are blocked by the gate:
(() => {
  const store = window.__projectStore;
  const s = store.getState();
  // Strip any seeded approvals + force phase backwards so the
  // gate is definitively closed for the test.
  for (const a of Object.values(s.approvals).filter((a) => a.projectId === '${PROJECT_ID}')) {
    store.getState().removeApproval(a.id);
  }
  store.getState().updateProject('${PROJECT_ID}', { lifecyclePhase: 'engineering' });
  const after = store.getState();
  // The exported selector module isn't on window; derive inline.
  const approvalsForP = Object.values(after.approvals).filter((a) => a.projectId === '${PROJECT_ID}');
  // deriveWorkOrders IS on the action surface? It is not — it's
  // a pure export. So we count what should be there using the
  // exported deriveWorkOrders from window if present, otherwise
  // verify the gate by checking the empty state in the UI.
  const result = {
    approvalsOnProject: approvalsForP.length,
    projectPhase: after.projects['${PROJECT_ID}']?.lifecyclePhase,
    expectedGateReason: 'no_approval (no approvals + phase too early)',
    nextStep: 'Open /project/${PROJECT_ID}/deployment in a new tab. Expect: "Work orders generate after customer approves scope." Filter row should be HIDDEN.',
  };
  console.log('[SC.2.7 pre gate] state ready:', result);
  return result;
})();
`;

const OPEN_GATE_SNIPPET = `
// STEP 3 — open the gate: add a scope approval + advance to deployment phase.
(() => {
  const store = window.__projectStore;
  const now = Date.now();
  const approvalId = 'appr-sc27-' + now;
  store.getState().addApproval({
    id: approvalId,
    projectId: '${PROJECT_ID}',
    proposalVersion: 'v1-sc27',
    approverName: 'SC.2.7 Test Approver',
    approverEmail: 'sc27@example.com',
    approvalType: 'scope',
    comments: 'Scope approved by integrity fixture.',
    approvedAt: new Date(now).toISOString(),
    createdAt: now,
    updatedAt: now,
  });
  store.getState().updateProject('${PROJECT_ID}', { lifecyclePhase: 'deployment', phaseStartedAt: now });
  const after = store.getState();
  const approvalsForP = Object.values(after.approvals).filter((a) => a.projectId === '${PROJECT_ID}');
  const summary = {
    approvalId,
    approvalsOnProject: approvalsForP.length,
    latestType: approvalsForP.sort((a, b) => b.createdAt - a.createdAt)[0]?.approvalType,
    projectPhase: after.projects['${PROJECT_ID}']?.lifecyclePhase,
    expected: 'Gate should be OPEN. Refresh /project/${PROJECT_ID}/deployment. Expect: real work order list (devices, doors, pathways). Filter row visible.',
  };
  console.log('[SC.2.7 open gate] state ready:', summary);
  return summary;
})();
`;

const CLOSE_GATE_SNIPPET = `
// STEP 4 — close the gate: delete the scope approval. WOs should disappear.
(() => {
  const store = window.__projectStore;
  const s = store.getState();
  const target = Object.values(s.approvals).find((a) => a.projectId === '${PROJECT_ID}' && a.approvalType === 'scope');
  if (!target) { console.error('[SC.2.7 close gate] no scope approval found.'); return; }
  store.getState().removeApproval(target.id);
  const after = store.getState();
  const approvalsForP = Object.values(after.approvals).filter((a) => a.projectId === '${PROJECT_ID}');
  const summary = {
    removedId: target.id,
    approvalsOnProject: approvalsForP.length,
    projectPhase: after.projects['${PROJECT_ID}']?.lifecyclePhase,
    expected: 'Gate should be CLOSED (no_approval). Refresh /project/${PROJECT_ID}/deployment. Expect: awaiting approval empty state.',
  };
  console.log('[SC.2.7 close gate] state ready:', summary);
  return summary;
})();
`;

const PORTAL_SMOKE_SNIPPET = `
// STEP 5 — portal smoke. From a fresh, scope approved project,
// confirm the portal's status pill, history toggle, and form work.
(() => {
  const url = '/portal/${PROJECT_ID}';
  console.log('[SC.2.7 portal] open ' + url + ' in a new tab.');
  console.log('  Expect status pill: Scope approved (violet).');
  console.log('  Expect button label: "Record next approval".');
  console.log('  Expect approval history toggle to appear if 2+ approvals exist.');
  console.log('  Submit a design approval. Watch the pill change to Design approved? NO — pill reads the latest record, so a newer design after scope shows "Design approved".');
  console.log('  ProjectCenter /project/${PROJECT_ID}/ Approvals section should grow to N+1 rows.');
})();
`;

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log(' SC.2.7 spine integrity test — approval gate + WO derivation');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('Procedure exercises the full SC.2 chain: approval form ->');
console.log('approvals slice -> workOrderGate -> deriveWorkOrders.');
console.log('All snippets paste into DevTools (Cmd Option J on Chrome).');
console.log('');
console.log('STEP 1 — reset baseline:');
console.log('─── SETUP ────────────────────────────────────────────────────────────');
console.log(SETUP_SNIPPET);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('Hard reload (Cmd Shift R). Then:');
console.log('');
console.log('STEP 2 — assert gate is CLOSED:');
console.log('─── PRE GATE ─────────────────────────────────────────────────────────');
console.log(PRE_GATE_SNIPPET);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('STEP 3 — open the gate via scope approval:');
console.log('─── OPEN GATE ────────────────────────────────────────────────────────');
console.log(OPEN_GATE_SNIPPET);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('STEP 4 — close the gate by removing the approval:');
console.log('─── CLOSE GATE ───────────────────────────────────────────────────────');
console.log(CLOSE_GATE_SNIPPET);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('STEP 5 — portal smoke walkthrough:');
console.log('─── PORTAL SMOKE ─────────────────────────────────────────────────────');
console.log(PORTAL_SMOKE_SNIPPET);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('ACCEPTANCE CHECKLIST');
console.log('  [ ] STEP 2: /project/p1/deployment shows "Work orders generate after customer approves scope." Filter row hidden.');
console.log('  [ ] STEP 3: /project/p1/deployment shows real work order list with devices, doors, pathways. Filter row visible.');
console.log('  [ ] STEP 4: /project/p1/deployment reverts to the awaiting empty state. Filter row hidden.');
console.log('  [ ] STEP 5: /portal/p1 status pill changes match each step (Awaiting -> Scope approved -> Awaiting).');
console.log('  [ ] After a hard reload at each step, the displayed state is preserved (gate is pure derivation, not session memory).');
console.log('  [ ] ReportsCenter Field deployment tile shows "Awaiting gate" when the gate is closed, real counts when open.');
console.log('');
