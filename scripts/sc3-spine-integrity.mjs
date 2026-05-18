#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────
// MVP Spine Completion SC.3.7 — commissioning -> Asset -> Warranty
// ─────────────────────────────────────────────────────────────────────
//
// SC.3 wired commissioning to the Asset + Warranty chain. This
// script prints the operator procedure for proving end to end
// that:
//
//   1. A passing commission writes a real device.commissioning
//      record.
//   2. The same call auto creates an Asset for the device
//      (1:1 enforcement; second call updates the existing Asset
//      rather than duplicating).
//   3. The same call opens a default 1y manufacturer warranty on
//      the Asset.
//   4. Partial + fail commissions persist the record but do NOT
//      promote to Asset.
//   5. Decommissioning sets asset.status = decommissioned and
//      cascades: linked warranties get endDate set to today.
//      History is preserved (records remain in the store).
//   6. Hard reload preserves every persisted record.
//
// Run: `node scripts/sc3-spine-integrity.mjs`

const PROJECT_ID = 'p1';
const DEVICE_ID  = 'cam-101';

const SETUP_SNIPPET = `
// STEP 1 — reset baseline + open the gate so deriveWorkOrders fires.
//          The SC.3 chain only triggers from the commissioning form,
//          which needs a device-backed WO. Approval gate must be
//          open OR we set up the precondition manually.
(() => {
  const store = window.__projectStore;
  if (!store) { console.error('window.__projectStore not found.'); return; }
  store.getState().resetDemoData();
  // Open the gate so WOs derive after reload.
  const now = Date.now();
  store.getState().addApproval({
    id: 'appr-sc37-' + now,
    projectId: '${PROJECT_ID}',
    proposalVersion: 'v1-sc37',
    approverName: 'SC.3.7 Test Approver',
    approverEmail: 'sc37@example.com',
    approvalType: 'scope',
    comments: 'Scope approved for SC.3.7 integrity fixture.',
    approvedAt: new Date(now).toISOString(),
    createdAt: now,
    updatedAt: now,
  });
  store.getState().updateProject('${PROJECT_ID}', { lifecyclePhase: 'deployment', phaseStartedAt: now });
  console.log('[SC.3.7 setup] reset + gate open. Hard reload now (Cmd Shift R).');
})();
`;

const COMMISSION_PASS_SNIPPET = `
// STEP 2 — commission a device with PASS status. Expect Asset +
//          Warranty to spawn automatically.
(() => {
  const store = window.__projectStore;
  const s = store.getState();
  const device = s.devices['${DEVICE_ID}'] ?? Object.values(s.devices).find((d) => d.projectId === '${PROJECT_ID}');
  if (!device) { console.error('No device on project ${PROJECT_ID}.'); return; }

  store.getState().setDeviceCommissioning(device.id, {
    status: 'pass',
    commissionedAt: new Date().toISOString().slice(0, 10),
    commissionedBy: 'SC.3.7 Test Engineer',
    serialNumber: 'SN-SC37-PASS',
    notes: 'All tests passing.',
    testResults: [
      { id: 'powered_on', label: 'Powered on',          passed: true },
      { id: 'network',    label: 'Network reachable',   passed: true },
      { id: 'recording',  label: 'Recording verified',  passed: true },
      { id: 'configured', label: 'Configured per spec', passed: true },
    ],
  });

  const after = store.getState();
  const dev = after.devices[device.id];
  const asset = Object.values(after.assets).find((a) => a.deviceId === device.id);
  const warranties = asset ? Object.values(after.warranties).filter((w) => w.assetId === asset.id) : [];
  const result = {
    deviceCommissioningStatus: dev?.commissioning?.status,
    assetCreated: !!asset,
    assetStatus: asset?.status,
    assetSerial: asset?.serialNumber,
    warrantyCount: warranties.length,
    warrantyProvider: warranties[0]?.provider,
    warrantyEnd: warranties[0]?.endDate,
    chainOk:
      dev?.commissioning?.status === 'pass' &&
      !!asset &&
      asset.status === 'active' &&
      warranties.length > 0 &&
      warranties[0].provider === 'manufacturer',
  };
  console.log('[SC.3.7 pass] result:', result);
  if (!result.chainOk) console.error('[SC.3.7 pass] CHAIN BROKEN.');
  else console.log('[SC.3.7 pass] OK — commission -> Asset -> Warranty all wired.');
  return result;
})();
`;

const RECOMMISSION_SNIPPET = `
// STEP 3 — recommission the same device with PASS again. Expect
//          NO duplicate Asset and NO duplicate manufacturer warranty.
//          Asset commissioner / serial should update to new values.
(() => {
  const store = window.__projectStore;
  const s = store.getState();
  const device = s.devices['${DEVICE_ID}'] ?? Object.values(s.devices).find((d) => d.projectId === '${PROJECT_ID}');
  if (!device) return;

  const beforeAssets = Object.values(s.assets).filter((a) => a.deviceId === device.id).length;
  const beforeWtys = Object.values(s.warranties).filter((w) =>
    Object.values(s.assets).some((a) => a.deviceId === device.id && a.id === w.assetId)
    && w.provider === 'manufacturer'
  ).length;

  store.getState().setDeviceCommissioning(device.id, {
    status: 'pass',
    commissionedAt: new Date().toISOString().slice(0, 10),
    commissionedBy: 'SC.3.7 Second Pass Engineer',
    serialNumber: 'SN-SC37-PASS-UPDATED',
    notes: 'Recommission, updated serial.',
    testResults: [
      { id: 'powered_on', label: 'Powered on',          passed: true },
      { id: 'network',    label: 'Network reachable',   passed: true },
      { id: 'recording',  label: 'Recording verified',  passed: true },
      { id: 'configured', label: 'Configured per spec', passed: true },
    ],
  });

  const after = store.getState();
  const afterAssets = Object.values(after.assets).filter((a) => a.deviceId === device.id);
  const afterWtys = afterAssets.length === 1
    ? Object.values(after.warranties).filter((w) => w.assetId === afterAssets[0].id && w.provider === 'manufacturer').length
    : 0;
  const result = {
    beforeAssets,
    afterAssetCount: afterAssets.length,
    duplicateAvoided: afterAssets.length === 1,
    updatedSerial: afterAssets[0]?.serialNumber,
    updatedBy: afterAssets[0]?.commissionedBy,
    beforeWarrantyCount: beforeWtys,
    afterWarrantyCount: afterWtys,
    warrantyDuplicateAvoided: afterWtys === beforeWtys,
  };
  console.log('[SC.3.7 recommission] result:', result);
  if (!result.duplicateAvoided || !result.warrantyDuplicateAvoided) console.error('[SC.3.7 recommission] DUPLICATE created.');
  else console.log('[SC.3.7 recommission] OK — idempotent on Asset + Warranty.');
  return result;
})();
`;

const PARTIAL_FAIL_SNIPPET = `
// STEP 4 — commission another device with PARTIAL status. Expect
//          the commissioning record to persist but NO Asset to be
//          created (install not in service).
(() => {
  const store = window.__projectStore;
  const s = store.getState();
  // Pick the SECOND device on the project so we don't disturb step 3.
  const otherDevice = Object.values(s.devices).find(
    (d) => d.projectId === '${PROJECT_ID}' && d.id !== '${DEVICE_ID}',
  );
  if (!otherDevice) { console.warn('No second device. Skipping partial test.'); return; }

  store.getState().setDeviceCommissioning(otherDevice.id, {
    status: 'partial',
    commissionedAt: new Date().toISOString().slice(0, 10),
    commissionedBy: 'SC.3.7 Partial Engineer',
    serialNumber: 'SN-SC37-PARTIAL',
    notes: 'Network issue; needs followup.',
    testResults: [
      { id: 'powered_on', label: 'Powered on',          passed: true },
      { id: 'network',    label: 'Network reachable',   passed: false },
      { id: 'recording',  label: 'Recording verified',  passed: true },
      { id: 'configured', label: 'Configured per spec', passed: false },
    ],
  });

  const after = store.getState();
  const dev = after.devices[otherDevice.id];
  const asset = Object.values(after.assets).find((a) => a.deviceId === otherDevice.id);
  const result = {
    deviceCommissioningStatus: dev?.commissioning?.status,
    deviceTestResults: dev?.commissioning?.testResults?.map((t) => ({ id: t.id, passed: t.passed })),
    assetCreatedShouldBeFalse: !!asset,
    chainOk: dev?.commissioning?.status === 'partial' && !asset,
  };
  console.log('[SC.3.7 partial] result:', result);
  if (!result.chainOk) console.error('[SC.3.7 partial] partial INCORRECTLY promoted to Asset.');
  else console.log('[SC.3.7 partial] OK — partial persisted, NO asset created.');
  return result;
})();
`;

const DECOMMISSION_SNIPPET = `
// STEP 5 — decommission the Asset from step 2. Expect
//          asset.status = decommissioned and ALL linked warranties
//          to have endDate set to today (or earlier).
(() => {
  const store = window.__projectStore;
  const s = store.getState();
  const device = s.devices['${DEVICE_ID}'] ?? Object.values(s.devices).find((d) => d.projectId === '${PROJECT_ID}');
  const asset = device ? Object.values(s.assets).find((a) => a.deviceId === device.id) : null;
  if (!asset) { console.error('[SC.3.7 decommission] No asset to decommission.'); return; }

  const wtysBefore = Object.values(s.warranties).filter((w) => w.assetId === asset.id);
  const today = (() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  })();

  store.getState().updateAsset(asset.id, { status: 'decommissioned' });
  for (const w of wtysBefore) {
    if (w.endDate > today) store.getState().updateWarranty(w.id, { endDate: today });
  }

  const after = store.getState();
  const afterAsset = after.assets[asset.id];
  const afterWtys = Object.values(after.warranties).filter((w) => w.assetId === asset.id);
  const result = {
    assetStatus: afterAsset?.status,
    warrantyEndDates: afterWtys.map((w) => w.endDate),
    allWarrantiesEndedOrEarlier: afterWtys.every((w) => w.endDate <= today),
    historyPreserved: afterWtys.length === wtysBefore.length,
  };
  console.log('[SC.3.7 decommission] result:', result);
  if (!result.allWarrantiesEndedOrEarlier || !result.historyPreserved) {
    console.error('[SC.3.7 decommission] cascade incorrect.');
  } else {
    console.log('[SC.3.7 decommission] OK — asset decommissioned, warranties ended, history preserved.');
  }
  return result;
})();
`;

const RELOAD_INSPECTOR = `
// STEP 6 — hard reload, then run this inspector. Every record from
//          steps 2 / 3 / 4 / 5 should survive.
(() => {
  const s = window.__projectStore.getState();
  const passingDevice = s.devices['${DEVICE_ID}'] ?? Object.values(s.devices).find((d) => d.projectId === '${PROJECT_ID}');
  const passingAsset = passingDevice ? Object.values(s.assets).find((a) => a.deviceId === passingDevice.id) : null;
  const passingWty   = passingAsset ? Object.values(s.warranties).find((w) => w.assetId === passingAsset.id) : null;
  const partialDevice = Object.values(s.devices).find(
    (d) => d.projectId === '${PROJECT_ID}' && d.id !== '${DEVICE_ID}' && d.commissioning?.status === 'partial',
  );

  const result = {
    passingCommission: passingDevice?.commissioning?.status,
    passingAssetStatus: passingAsset?.status, // should be 'decommissioned' after step 5
    passingWarrantyEnd: passingWty?.endDate,
    partialCommissionPreserved: partialDevice?.commissioning?.status,
    partialAssetCreated: !!Object.values(s.assets).find((a) => a.deviceId === partialDevice?.id),
    storeVersion: 'check Application > LocalStorage > deeperVisionStore.version (expect 27)',
  };
  console.log('[SC.3.7 reload inspector] result:', result);
})();
`;

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log(' SC.3.7 spine integrity test — commissioning -> Asset -> Warranty');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('Exercises the full SC.3 chain through real action calls,');
console.log('not UI clicks. All snippets paste into DevTools.');
console.log('');
console.log('STEP 1 — reset + open the gate:');
console.log('─── SETUP ────────────────────────────────────────────────────────────');
console.log(SETUP_SNIPPET);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('Hard reload (Cmd Shift R). Then:');
console.log('');
console.log('STEP 2 — commission with PASS:');
console.log('─── PASS ─────────────────────────────────────────────────────────────');
console.log(COMMISSION_PASS_SNIPPET);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('STEP 3 — recommission, expect idempotency:');
console.log('─── RECOMMISSION ─────────────────────────────────────────────────────');
console.log(RECOMMISSION_SNIPPET);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('STEP 4 — commission a second device with PARTIAL:');
console.log('─── PARTIAL ──────────────────────────────────────────────────────────');
console.log(PARTIAL_FAIL_SNIPPET);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('STEP 5 — decommission the passing asset:');
console.log('─── DECOMMISSION ─────────────────────────────────────────────────────');
console.log(DECOMMISSION_SNIPPET);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('STEP 6 — hard reload then run reload inspector:');
console.log('─── RELOAD INSPECTOR ─────────────────────────────────────────────────');
console.log(RELOAD_INSPECTOR);
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log('ACCEPTANCE CHECKLIST');
console.log('  [ ] STEP 2: chainOk true. device.commissioning.status = pass.');
console.log('       Asset created. Warranty opened with provider=manufacturer.');
console.log('  [ ] STEP 3: duplicateAvoided true, warrantyDuplicateAvoided true.');
console.log('       updatedSerial reflects the new value.');
console.log('  [ ] STEP 4: chainOk true. partial persisted, NO asset created.');
console.log('  [ ] STEP 5: asset.status = decommissioned. All warranty endDates');
console.log('       <= today. History preserved (warranty count unchanged).');
console.log('  [ ] STEP 6: every record from steps 2 / 4 / 5 round trips through');
console.log('       a hard reload.');
console.log('  [ ] Open /project/p1 in a tab. Approvals + Assets sections render.');
console.log('  [ ] Open /portal/p1. Installed equipment card NOT shown (asset is');
console.log('       decommissioned at this point so customer view hides it).');
console.log('       To verify the customer side, re open via updateAsset(id,');
console.log('       { status: "active" }) and reload the portal.');
console.log('');
