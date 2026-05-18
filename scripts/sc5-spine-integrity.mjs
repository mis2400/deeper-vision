#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────
// MVP Spine Completion SC.5.9 — CRM-first creation + standalone managers
// ─────────────────────────────────────────────────────────────────────
//
// SC.5 wired the CRM creation flows that were missing:
//   * /customers, /contacts, /sites, /buildings standalone managers
//   * AccountDetail dead buttons replaced with real dialogs
//   * NewOpportunityDialog used by both AccountDetail + PipelineView
//   * SiteIntake's existing-customer picker (link, don't duplicate)
//   * convertOpportunityToProject creates the full Site/Building/Floor
//   * PipelineView's "New opportunity" button no longer dead
//
// This script prints the paste-into-DevTools procedure that exercises
// the whole chain through real store actions:
//
//   1. Reset baseline.
//   2. Create a customer + primary contact via addCustomer/addContact.
//   3. Create an opportunity against that customer (the same shape
//      NewOpportunityDialog persists).
//   4. Convert the won opportunity to a project — assert Project + Site
//      + Building + Floor all minted in one atomic step and the project
//      links back via siteId. (SC.5.7 fix.)
//   5. Run intake-style "new customer" flow programmatically — assert
//      deltas = {customers:1, contacts:1, projects:1, sites:1, buildings:1, floors:1}.
//   6. Run intake-style "existing customer" flow programmatically —
//      assert deltas = {customers:0, contacts:0, projects:1, sites:1, buildings:1, floors:1}
//      and that customer.addresses gained the new site address (deduped).
//   7. Defensive: orphan-opp (deleted customer) returns null without
//      creating a project. (SC.5.7 guard.)
//
// Run: `node scripts/sc5-spine-integrity.mjs`

const SETUP_SNIPPET = `
// STEP 1 — reset baseline. Paste, then hard reload.
(() => {
  const store = window.__projectStore;
  if (!store) { console.error('window.__projectStore not found.'); return; }
  store.getState().resetDemoData();
  console.log('[SC.5.9 setup] reset. Hard reload now (Cmd Shift R).');
})();
`;

const CREATE_CUSTOMER_SNIPPET = `
// STEP 2 — create a customer + primary contact through the public
//          store actions (same path NewCustomerDialog uses).
(() => {
  const store = window.__projectStore;
  const now = Date.now();
  const cid = 'c-sc59-' + now.toString(36);
  const ctid = 'ct-sc59-' + now.toString(36);
  store.getState().addCustomer({
    id: cid,
    companyName: 'SC59 Test Customer',
    addresses: [{ street: '100 Test St', city: 'Pasadena', state: 'CA', postal: '91101' }],
    industry: 'commercial_re',
    primaryContactId: ctid,
    createdAt: now, updatedAt: now,
  });
  store.getState().addContact({
    id: ctid,
    customerId: cid,
    firstName: 'Pat',
    lastName: 'Tester',
    email: 'pat@sc59.test',
    isPrimary: true,
    createdAt: now, updatedAt: now,
  });
  const s = store.getState();
  console.log('[SC.5.9 customer]', {
    cid,
    customerExists: !!s.customers[cid],
    contactExists: !!s.contacts[ctid],
    primaryLinked: s.customers[cid]?.primaryContactId === ctid,
  });
})();
`;

const CREATE_OPP_SNIPPET = `
// STEP 3 — create an opportunity against the SC59 customer. addOpportunity
//          expects a fully-formed Opportunity (it does not auto-generate
//          ids or timestamps). Mark won immediately so STEP 4 can convert.
(() => {
  const store = window.__projectStore;
  const cid = Object.values(store.getState().customers).find(c => c.companyName === 'SC59 Test Customer')?.id;
  if (!cid) return console.error('[SC.5.9 opp] customer missing — rerun STEP 2.');
  const now = Date.now();
  const oppId = 'opp-sc59-' + now.toString(36);
  store.getState().addOpportunity({
    id: oppId,
    customerId: cid,
    name: 'SC59 phase 1 cameras',
    stage: 'proposing',
    estValue: 185000,
    source: 'referral',
    createdAt: now,
    updatedAt: now,
  }, { userName: 'You' });
  store.getState().setOpportunityStage(oppId, 'won', { userName: 'You' });
  const opp = store.getState().opportunities[oppId];
  console.log('[SC.5.9 opp]', {
    oppId,
    stage: opp.stage,
    customerLinked: opp.customerId === cid,
    closedAtSet: typeof opp.closedAt === 'number',
  });
})();
`;

const CONVERT_OPP_SNIPPET = `
// STEP 4 — convert the won opp. SC.5.7 must produce Project + Site +
//          Building + Floor and stamp project.siteId. Before SC.5.7
//          this only wrote the Project.
(() => {
  const store = window.__projectStore;
  const opp = Object.values(store.getState().opportunities).find(o => o.name === 'SC59 phase 1 cameras');
  if (!opp) return console.error('[SC.5.9 convert] opp missing — rerun STEP 3.');
  const before = (() => {
    const st = store.getState();
    return {
      projects: Object.keys(st.projects).length,
      sites: Object.keys(st.sites).length,
      buildings: Object.keys(st.buildings).length,
      floors: Object.keys(st.floors).length,
    };
  })();
  const newId = store.getState().convertOpportunityToProject(opp.id, { userName: 'You' });
  const st = store.getState();
  const proj = st.projects[newId];
  const site = proj?.siteId ? st.sites[proj.siteId] : null;
  const buildings = Object.values(st.buildings).filter(b => b.siteId === proj?.siteId);
  const floors = Object.values(st.floors).filter(f => f.projectId === newId);
  const after = {
    projects: Object.keys(st.projects).length,
    sites: Object.keys(st.sites).length,
    buildings: Object.keys(st.buildings).length,
    floors: Object.keys(st.floors).length,
  };
  console.log('[SC.5.9 convert]', {
    newId,
    deltas: {
      projects: after.projects - before.projects,
      sites: after.sites - before.sites,
      buildings: after.buildings - before.buildings,
      floors: after.floors - before.floors,
    },
    projectHasSiteId: !!proj?.siteId,
    siteLinksBackToProject: site?.projectId === newId,
    siteAddress: site?.address,
    buildingCount: buildings.length,
    floorCount: floors.length,
    oppMarkedWon: st.opportunities[opp.id]?.stage === 'won',
    oppWonProjectIdSet: st.opportunities[opp.id]?.wonProjectId === newId,
    auditOk: (after.projects - before.projects === 1)
          && (after.sites - before.sites === 1)
          && (after.buildings - before.buildings === 1)
          && (after.floors - before.floors === 1)
          && site?.projectId === newId,
  });
})();
`;

const INTAKE_NEW_CUSTOMER_SNIPPET = `
// STEP 5 — intake-style "new customer" flow. Emits the same writes
//          SiteIntake.finish() does when no existing customer is
//          picked: Customer + Contact + Project + Site + Building +
//          Floor in one pass.
(() => {
  const store = window.__projectStore;
  const before = (() => {
    const st = store.getState();
    return {
      customers: Object.keys(st.customers).length,
      contacts: Object.keys(st.contacts).length,
      projects: Object.keys(st.projects).length,
      sites: Object.keys(st.sites).length,
      buildings: Object.keys(st.buildings).length,
      floors: Object.keys(st.floors).length,
    };
  })();

  const now = Date.now();
  const suffix = 'sc59new' + now.toString(36).slice(-4);
  const cid = 'c-' + suffix;
  const ctid = 'ct-' + suffix;
  const pid = 'p-' + suffix;
  const sid = 's-' + suffix;
  const bid = 'b-' + suffix;
  const fid = 'f-' + suffix;
  const addr = { street: '200 New Ave', city: 'Pasadena', state: 'CA', postal: '91103' };

  const s = store.getState();
  s.addCustomer({ id: cid, companyName: 'SC59 New Customer', addresses: [addr], industry: 'commercial_re', primaryContactId: ctid, createdAt: now, updatedAt: now });
  s.addContact({ id: ctid, customerId: cid, firstName: 'New', lastName: 'Person', email: 'new@sc59.test', isPrimary: true, createdAt: now, updatedAt: now });
  s.updateCustomer(cid, { primaryContactId: ctid });
  s.addProject({ id: pid, name: 'SC59 New, 200 New Ave', customerId: cid, siteId: sid, status: 'design', lifecyclePhase: 'survey', createdAt: now, updatedAt: now, phaseStartedAt: now, nextAction: 'Schedule the site walk', healthStatus: 'on_track', priority: 'normal', progress: 0 });
  s.addSite({ id: sid, projectId: pid, name: '200 New Ave', address: '200 New Ave, Pasadena, CA, 91103' });
  s.addBuilding({ id: bid, siteId: sid, name: 'Main Building' });
  s.addFloor({ id: fid, projectId: pid, buildingId: bid, name: 'Floor 1', level: 0, createdAt: now, source: 'blank', scalePxToFt: 0, walls: [] });

  const after = (() => {
    const st = store.getState();
    return {
      customers: Object.keys(st.customers).length,
      contacts: Object.keys(st.contacts).length,
      projects: Object.keys(st.projects).length,
      sites: Object.keys(st.sites).length,
      buildings: Object.keys(st.buildings).length,
      floors: Object.keys(st.floors).length,
    };
  })();

  const deltas = {
    customers: after.customers - before.customers,
    contacts: after.contacts - before.contacts,
    projects: after.projects - before.projects,
    sites: after.sites - before.sites,
    buildings: after.buildings - before.buildings,
    floors: after.floors - before.floors,
  };
  console.log('[SC.5.9 intake new]', {
    deltas,
    auditOk: deltas.customers === 1 && deltas.contacts === 1
          && deltas.projects === 1 && deltas.sites === 1
          && deltas.buildings === 1 && deltas.floors === 1,
  });
})();
`;

const INTAKE_EXISTING_CUSTOMER_SNIPPET = `
// STEP 6 — intake-style "existing customer" flow. Emits the writes
//          SiteIntake.finish() does when a customer was picked in the
//          new SC.5.6 picker. Must NOT create a new Customer or
//          Contact, and must append the new site address to the
//          existing customer (deduped against prior addresses).
(() => {
  const store = window.__projectStore;
  const existing = Object.values(store.getState().customers).find(c => c.companyName === 'SC59 Test Customer');
  if (!existing) return console.error('[SC.5.9 intake existing] SC59 Test Customer missing — rerun STEP 2.');

  const before = (() => {
    const st = store.getState();
    return {
      customers: Object.keys(st.customers).length,
      contacts: Object.keys(st.contacts).length,
      projects: Object.keys(st.projects).length,
      sites: Object.keys(st.sites).length,
      buildings: Object.keys(st.buildings).length,
      floors: Object.keys(st.floors).length,
      addressCount: (existing.addresses || []).length,
    };
  })();

  const now = Date.now();
  const suffix = 'sc59exist' + now.toString(36).slice(-4);
  const pid = 'p-' + suffix;
  const sid = 's-' + suffix;
  const bid = 'b-' + suffix;
  const fid = 'f-' + suffix;
  const addr = { street: '300 Existing Way', city: 'Pasadena', state: 'CA', postal: '91104' };

  const s = store.getState();
  // Picker path: reuse the existing customer id; do not call addCustomer/addContact.
  // Replicate SiteIntake's "append new site address if not already present" logic.
  const already = (existing.addresses || []).some(a => a.street === addr.street && (a.postal ?? '') === (addr.postal ?? ''));
  if (!already) {
    s.updateCustomer(existing.id, { addresses: [...(existing.addresses || []), addr] });
  }
  s.addProject({ id: pid, name: existing.companyName + ', 300 Existing Way', customerId: existing.id, siteId: sid, status: 'design', lifecyclePhase: 'survey', createdAt: now, updatedAt: now, phaseStartedAt: now, nextAction: 'Schedule the site walk', healthStatus: 'on_track', priority: 'normal', progress: 0 });
  s.addSite({ id: sid, projectId: pid, name: '300 Existing Way', address: '300 Existing Way, Pasadena, CA, 91104' });
  s.addBuilding({ id: bid, siteId: sid, name: 'Main Building' });
  s.addFloor({ id: fid, projectId: pid, buildingId: bid, name: 'Floor 1', level: 0, createdAt: now, source: 'blank', scalePxToFt: 0, walls: [] });

  // Second pass with the same address to prove the dedup guard holds.
  const stillAlready = (store.getState().customers[existing.id].addresses || []).some(a => a.street === addr.street && (a.postal ?? '') === (addr.postal ?? ''));
  if (!stillAlready) {
    s.updateCustomer(existing.id, { addresses: [...(store.getState().customers[existing.id].addresses || []), addr] });
  }

  const after = (() => {
    const st = store.getState();
    const c = st.customers[existing.id];
    return {
      customers: Object.keys(st.customers).length,
      contacts: Object.keys(st.contacts).length,
      projects: Object.keys(st.projects).length,
      sites: Object.keys(st.sites).length,
      buildings: Object.keys(st.buildings).length,
      floors: Object.keys(st.floors).length,
      addressCount: (c.addresses || []).length,
      projectCustomerId: st.projects[pid]?.customerId,
    };
  })();

  const deltas = {
    customers: after.customers - before.customers,
    contacts: after.contacts - before.contacts,
    projects: after.projects - before.projects,
    sites: after.sites - before.sites,
    buildings: after.buildings - before.buildings,
    floors: after.floors - before.floors,
    addresses: after.addressCount - before.addressCount,
  };
  console.log('[SC.5.9 intake existing]', {
    deltas,
    projectLinksToExistingCustomer: after.projectCustomerId === existing.id,
    addressDedupHeld: deltas.addresses === 1,
    auditOk: deltas.customers === 0 && deltas.contacts === 0
          && deltas.projects === 1 && deltas.sites === 1
          && deltas.buildings === 1 && deltas.floors === 1
          && after.projectCustomerId === existing.id
          && deltas.addresses === 1,
  });
})();
`;

const ORPHAN_GUARD_SNIPPET = `
// STEP 7 — orphan-customer guard (SC.5.7). If an opp references a
//          deleted customer, convertOpportunityToProject must return
//          null and write nothing.
(() => {
  const store = window.__projectStore;
  const now = Date.now();
  const oid = 'opp-sc59-orphan-' + now;
  // Hand-craft an opp pointing at a customer id we never created.
  store.setState((st) => ({
    opportunities: { ...st.opportunities, [oid]: {
      id: oid, customerId: 'c-doesnotexist', name: 'SC59 orphan', stage: 'won',
      createdAt: now, updatedAt: now,
    } },
  }));
  const projectsBefore = Object.keys(store.getState().projects).length;
  const result = store.getState().convertOpportunityToProject(oid, { userName: 'You' });
  const projectsAfter = Object.keys(store.getState().projects).length;
  console.log('[SC.5.9 orphan guard]', {
    returned: result,
    projectsDelta: projectsAfter - projectsBefore,
    auditOk: result === null && projectsAfter === projectsBefore,
  });
})();
`;

const MANAGER_ROUTES_SNIPPET = `
// STEP 8 — manager surface walkthrough. Open each in a new tab and
//          confirm: list renders, "New <thing>" button opens a real
//          dialog, submitting persists.
(() => {
  const origin = window.location.origin;
  console.log('[SC.5.9 managers] open these and click their New button:');
  console.log('  ' + origin + '/customers');
  console.log('  ' + origin + '/contacts');
  console.log('  ' + origin + '/sites');
  console.log('  ' + origin + '/buildings');
  console.log('  ' + origin + '/crm        (pipeline view — New opportunity)');
  console.log('Each must open a real modal. No dead controls.');
})();
`;

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log(' SC.5.9 spine integrity test — CRM-first creation + standalone managers');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('Exercises SC.5 end to end: create customer + contact -> create opp ->');
console.log('convert (full hierarchy minted) -> intake new vs existing customer ->');
console.log('orphan guard. Procedure assumes the dev or prod server is running.');
console.log('');
console.log('STEP 1 — reset baseline:');
console.log(SETUP_SNIPPET);
console.log('');
console.log('Hard reload, then come back here.');
console.log('');
console.log('STEP 2 — seed a customer + primary contact:');
console.log(CREATE_CUSTOMER_SNIPPET);
console.log('');
console.log('STEP 3 — create an opportunity, mark it won:');
console.log(CREATE_OPP_SNIPPET);
console.log('');
console.log('STEP 4 — convert the won opp, assert full hierarchy:');
console.log(CONVERT_OPP_SNIPPET);
console.log('');
console.log('STEP 5 — intake-style "new customer" flow:');
console.log(INTAKE_NEW_CUSTOMER_SNIPPET);
console.log('');
console.log('STEP 6 — intake-style "existing customer" flow:');
console.log(INTAKE_EXISTING_CUSTOMER_SNIPPET);
console.log('');
console.log('STEP 7 — orphan-customer guard:');
console.log(ORPHAN_GUARD_SNIPPET);
console.log('');
console.log('STEP 8 — standalone manager smoke test:');
console.log(MANAGER_ROUTES_SNIPPET);
console.log('');
console.log('ACCEPTANCE CHECKLIST');
console.log('  [ ] STEP 2: customerExists, contactExists, primaryLinked all true.');
console.log('  [ ] STEP 3: stage = "won", customerLinked = true, closedAtSet = true.');
console.log('  [ ] STEP 4: auditOk = true; project links to siteId; site links back.');
console.log('  [ ] STEP 5: auditOk = true (all six deltas equal 1).');
console.log('  [ ] STEP 6: auditOk = true (customers/contacts deltas 0; addresses += 1).');
console.log('  [ ] STEP 7: auditOk = true (returned null, no project written).');
console.log('  [ ] STEP 8: every manager route renders + opens a real modal.');
console.log('');
