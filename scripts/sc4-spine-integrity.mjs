#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────
// MVP Spine Completion SC.4.11 — Proposal end to end
// ─────────────────────────────────────────────────────────────────────
//
// SC.4 wired the Proposal record + builder + customer / internal
// split + PDF + version supersede + approval linkage. This script
// prints the DevTools paste procedure that exercises the whole
// chain through real action calls:
//
//   1. Reset baseline.
//   2. Create proposal -> BOM populates with walls + conduit +
//      accessories per SC.4.2.
//   3. Edit BOM lines + pricing.
//   4. Toggle internal vs customer view, assert NO internal
//      strings leak via the SC.4.3 customer artifact auditor.
//   5. Send proposal -> status flips, sentAt persisted.
//   6. Approve via portal action -> Approval record created
//      referencing the live proposal version.
//   7. Supersede with new version -> v1 marked superseded with
//      supersededBy pointer, v2 minted as draft.
//   8. Assert: v1 Approval still references "v1" (audit trail
//      preserved).
//   9. Send v2 -> portal banner condition holds (newer version
//      available).
//
// Run: `node scripts/sc4-spine-integrity.mjs`

const PROJECT_ID = 'p1';

const SETUP_SNIPPET = `
// STEP 1 — reset baseline. Paste, then hard reload.
(() => {
  const store = window.__projectStore;
  if (!store) { console.error('window.__projectStore not found.'); return; }
  store.getState().resetDemoData();
  console.log('[SC.4.11 setup] reset. Hard reload now (Cmd Shift R).');
})();
`;

const CREATE_PROPOSAL_SNIPPET = `
// STEP 2 — open /proposal/p1 in a new tab and click Create proposal.
//          Then come back here and run this assertion.
(async () => {
  const store = window.__projectStore;
  await new Promise(r => setTimeout(r, 500));
  const s = store.getState();
  const p = Object.values(s.proposals).find(p => p.projectId === '${PROJECT_ID}');
  if (!p) {
    console.error('[SC.4.11 create] no proposal. Click Create proposal in /proposal/p1.');
    return;
  }
  const sections = Array.from(new Set(p.bomSnapshot.map(l => l.section))).sort();
  // SC.4.2 gap fix: walls + conduit + accessories should appear.
  const result = {
    proposalId: p.id,
    version: p.version,
    status: p.status,
    lineCount: p.bomSnapshot.length,
    sectionsPresent: sections,
    hasWalls:    sections.includes('walls'),
    hasConduit:  sections.includes('conduit'),
    hasAccessories: p.bomSnapshot.some(l => l.id.startsWith('pl-acc-')),
  };
  console.log('[SC.4.11 create]', result);
  return result;
})();
`;

const VIEW_SPLIT_SNIPPET = `
// STEP 3 — assert customer artifact strips every internal field.
//          Uses the SC.4.3 auditor function directly.
(async () => {
  const store = window.__projectStore;
  const sViewMod = await import('/src/app/lib/proposalView.ts');
  const p = Object.values(store.getState().proposals).find(p => p.projectId === '${PROJECT_ID}');
  if (!p) { console.error('[SC.4.11 view split] no proposal.'); return; }
  const artifact = sViewMod.toCustomerView(p);
  const leaks = sViewMod.customerArtifactContainsInternalLeaks(artifact);
  const internalTotals = sViewMod.deriveProposalInternalTotals(p);
  console.log('[SC.4.11 view split]', {
    artifactLines: artifact.lines.length,
    customerSellTotal: artifact.totals.sellTotal,
    internalLoadedCost: internalTotals.loadedCost,
    internalGpPct: internalTotals.gpPct,
    forbiddenLeaks: leaks,
    chainOk: leaks.length === 0,
  });
  return leaks.length === 0;
})();
`;

const SEND_SNIPPET = `
// STEP 4 — programmatically send the draft. (Or click Send in the
//          UI; both paths use the same store action.)
(() => {
  const store = window.__projectStore;
  const p = Object.values(store.getState().proposals).find(p => p.projectId === '${PROJECT_ID}');
  if (!p) return console.error('[SC.4.11 send] no proposal.');
  if (p.status !== 'draft') return console.warn('[SC.4.11 send] already', p.status);
  store.getState().updateProposal(p.id, { status: 'sent', sentAt: Date.now(), sentTo: 'test-contact' });
  const after = store.getState().proposals[p.id];
  console.log('[SC.4.11 send]', { status: after.status, sentAt: typeof after.sentAt === 'number', sentTo: after.sentTo });
})();
`;

const APPROVE_SNIPPET = `
// STEP 5 — programmatically record a scope approval against the
//          live sent proposal. Mirrors what the portal Approve
//          form does.
(() => {
  const store = window.__projectStore;
  const sent = Object.values(store.getState().proposals).find(p => p.projectId === '${PROJECT_ID}' && p.status === 'sent');
  if (!sent) return console.error('[SC.4.11 approve] no sent proposal.');
  const now = Date.now();
  store.getState().addApproval({
    id: 'appr-sc411-' + now,
    projectId: '${PROJECT_ID}',
    proposalVersion: 'v' + sent.version,
    approverName: 'SC.4.11 Test',
    approverEmail: 'sc411@example.com',
    approvalType: 'scope',
    comments: 'Approved by SC.4.11 fixture.',
    approvedAt: new Date(now).toISOString(),
    createdAt: now,
    updatedAt: now,
  });
  const approvals = Object.values(store.getState().approvals).filter(a => a.projectId === '${PROJECT_ID}');
  console.log('[SC.4.11 approve]', {
    approvalCount: approvals.length,
    latestProposalVersion: approvals.sort((a, b) => b.createdAt - a.createdAt)[0]?.proposalVersion,
  });
})();
`;

const SUPERSEDE_SNIPPET = `
// STEP 6 — supersede the sent proposal + send the new draft.
//          Assert: v1 status flips to superseded; v1 approval
//          still references "v1" (NOT silently re pointed at v2).
(() => {
  const store = window.__projectStore;
  const v1 = Object.values(store.getState().proposals).find(p => p.projectId === '${PROJECT_ID}' && p.status === 'sent');
  if (!v1) return console.error('[SC.4.11 supersede] no sent proposal.');
  const v2Id = store.getState().supersedeProposal(v1.id);
  // Send v2.
  store.getState().updateProposal(v2Id, { status: 'sent', sentAt: Date.now() });
  const after = store.getState();
  const v1Now = after.proposals[v1.id];
  const v2Now = after.proposals[v2Id];
  const approvals = Object.values(after.approvals).filter(a => a.projectId === '${PROJECT_ID}');
  console.log('[SC.4.11 supersede]', {
    v1Status: v1Now.status,
    v1SupersededBy: v1Now.supersededBy,
    v2Version: v2Now.version,
    v2Status: v2Now.status,
    approvalVersionPreserved: approvals[0]?.proposalVersion,
    auditOk: v1Now.status === 'superseded' && v1Now.supersededBy === v2Id && approvals[0]?.proposalVersion === 'v1',
  });
})();
`;

const PORTAL_BANNER_SNIPPET = `
// STEP 7 — open /portal/p1 in a new tab and confirm:
//          - Proposal card shows v2.
//          - Newer version banner reads "You approved v1 ... v2 is now available."
//          - Approve sheet, version input is locked to "v2".
(() => {
  console.log('[SC.4.11 portal] open ' + window.location.origin + '/portal/${PROJECT_ID}');
  console.log('  Expect: Proposal v2 card visible.');
  console.log('  Expect: amber banner reads "You approved v1 on <date>. A newer version (v2) is now available."');
  console.log('  Expect: clicking "Record next approval" opens a sheet with the version field DISABLED reading "v2".');
})();
`;

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log(' SC.4.11 spine integrity test — Proposal Builder full chain');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('Exercises SC.4 end to end: BOM derivation -> create -> view split');
console.log('-> send -> approve -> supersede -> banner. Procedure assumes the dev');
console.log('or prod server is running.');
console.log('');
console.log('STEP 1 — reset baseline:');
console.log(SETUP_SNIPPET);
console.log('');
console.log('Hard reload, then open /proposal/p1 in a new tab.');
console.log('');
console.log('STEP 2 — click Create proposal in /proposal/p1, then run:');
console.log(CREATE_PROPOSAL_SNIPPET);
console.log('');
console.log('STEP 3 — verify customer artifact has zero internal leaks:');
console.log(VIEW_SPLIT_SNIPPET);
console.log('');
console.log('STEP 4 — send the proposal:');
console.log(SEND_SNIPPET);
console.log('');
console.log('STEP 5 — record a scope approval:');
console.log(APPROVE_SNIPPET);
console.log('');
console.log('STEP 6 — supersede + send v2, verify audit trail:');
console.log(SUPERSEDE_SNIPPET);
console.log('');
console.log('STEP 7 — portal smoke walkthrough:');
console.log(PORTAL_BANNER_SNIPPET);
console.log('');
console.log('ACCEPTANCE CHECKLIST');
console.log('  [ ] STEP 2: lineCount > 0; hasWalls = true (if floors have walls);');
console.log('       hasConduit = true (if pathways with type=conduit exist).');
console.log('  [ ] STEP 3: chainOk = true (forbiddenLeaks empty).');
console.log('  [ ] STEP 4: sentAt is a number; status flipped to "sent".');
console.log('  [ ] STEP 5: approvalCount >= 1; latestProposalVersion = "v1".');
console.log('  [ ] STEP 6: auditOk = true.');
console.log('  [ ] STEP 7: portal banner + locked version field per the prompts.');
console.log('  [ ] PDF: from any version, click Generate PDF in the top bar.');
console.log('       A real PDF downloads (>10 KB, application/pdf, no error toast).');
console.log('       Open the PDF and verify the cover, line items, project total,');
console.log('       and terms render. Customer view only -- no cost, margin, GP.');
console.log('');
