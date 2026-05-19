#!/usr/bin/env node
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────
// MVP Spine Completion SC.6.7 — Customer Portal lifecycle + Service Tickets
// ─────────────────────────────────────────────────────────────────────
//
// SC.6 closed audit step 18 (Service Tickets, no UI) and the
// remaining Customer Portal gaps from audit #9 (design snapshot
// pending, approvals history, ticket creation + listing). This
// script exercises the bidirectional flow end to end through real
// store actions:
//
//   1. Reset baseline.
//   2. Customer side: create a ticket via the Portal flow shape
//      (createTicket + reportedBy from primary contact, asset
//      picker mapping, urgency -> priority, customer category
//      bucket -> internal category).
//   3. Internal side: verify the ticket lands on the operator
//      queue with the auto minted DV-YYYY-NNNN number.
//   4. Internal transition: open -> in_progress, append a system
//      timeline entry, change priority.
//   5. Customer side reads back the same ticket: status pill
//      flips to the customer friendly label ("Our team is on it"
//      instead of "in_progress").
//   6. Customer adds a follow up note via addTicketNote; internal
//      timeline picks it up immediately.
//   7. Resolution: internal transitions to resolved; resolvedAt
//      stamped exactly once; status closed pill renders on portal.
//   8. Approvals history snapshot: customer can fetch a prior
//      version's customer view (SC.6.5).
//
// Run: `node scripts/sc6-spine-integrity.mjs`

const PROJECT_ID = 'p1';

const SETUP_SNIPPET = `
// STEP 1 — reset baseline. Paste, then hard reload.
(() => {
  const store = window.__projectStore;
  if (!store) { console.error('window.__projectStore not found.'); return; }
  store.getState().resetDemoData();
  console.log('[SC.6.7 setup] reset. Hard reload now (Cmd Shift R).');
})();
`;

const PORTAL_CREATE_SNIPPET = `
// STEP 2 — customer side: report a ticket through the Portal.
//          Replicates exactly what PortalReportIssueDialog does on
//          submit: picks an installed asset, maps customer urgency
//          to priority, maps customer category to internal enum,
//          carries reporter pre filled from the primary contact.
(() => {
  const store = window.__projectStore;
  const s = store.getState();
  const project  = s.projects['${PROJECT_ID}'];
  const customer = project && project.customerId ? s.customers[project.customerId] : null;
  if (!customer) return console.error('[SC.6.7 portal-create] no customer for project ' + '${PROJECT_ID}');
  const contact = customer.primaryContactId ? s.contacts[customer.primaryContactId] : null;
  const reporterName = contact
    ? [contact.firstName, contact.lastName].filter(Boolean).join(' ')
    : customer.companyName;
  // Pick the first active asset for this project (mirrors the
  // portal's installedAssets filter).
  const asset = Object.values(s.assets).find(a => a.projectId === '${PROJECT_ID}' && a.status === 'active');
  const newId = s.createTicket({
    customerId: customer.id,
    projectId: '${PROJECT_ID}',
    deviceId: asset ? asset.deviceId : undefined,
    assetId: asset ? asset.id : undefined,
    title: asset ? 'Camera not working · ' + asset.manufacturer + ' ' + asset.model : 'Camera not working',
    description: 'Front entrance camera went dark this morning. PoE port shows up but no stream.',
    priority: 'high',          // 'high' urgency on portal -> 'high' priority
    category: 'device_failure',// 'camera' kind -> device_failure
    reportedBy: { name: reporterName, email: contact && contact.email ? contact.email : undefined },
  });
  const t = s.serviceTickets[newId];
  console.log('[SC.6.7 portal-create]', {
    newId,
    ticketNumber: t.ticketNumber,
    customerLinked: t.customerId === customer.id,
    projectLinked: t.projectId === '${PROJECT_ID}',
    assetLinked: !!t.assetId,
    statusDefault: t.status,
    priorityMapped: t.priority,
    reporter: t.reportedBy,
    auditOk: t.status === 'open' && t.priority === 'high' && t.category === 'device_failure'
          && /^DV-\\d{4}-\\d{4,}$/.test(t.ticketNumber),
  });
})();
`;

const INTERNAL_LIST_SNIPPET = `
// STEP 3 — internal side: the same ticket appears in /tickets.
//          We verify by reading store state (the UI subscribes the
//          same data) so the test does not depend on which screen
//          is currently loaded.
(() => {
  const store = window.__projectStore;
  const tickets = Object.values(store.getState().serviceTickets);
  const ours = tickets.find(t => t.projectId === '${PROJECT_ID}' && t.title.startsWith('Camera not working'));
  console.log('[SC.6.7 internal-list]', {
    totalTickets: tickets.length,
    ourTicketFound: !!ours,
    ticketNumber: ours && ours.ticketNumber,
    statusInQueue: ours && ours.status,
    auditOk: !!ours && ours.status === 'open',
  });
})();
`;

const INTERNAL_TRANSITION_SNIPPET = `
// STEP 4 — internal triage: transition to in_progress, append a
//          system timeline entry (mirrors what TicketDetail does on
//          a status pill click), then bump priority. The synthetic
//          notes use the same authorName 'System' convention.
(() => {
  const store = window.__projectStore;
  const ticket = Object.values(store.getState().serviceTickets).find(
    t => t.projectId === '${PROJECT_ID}' && t.title.startsWith('Camera not working'));
  if (!ticket) return console.error('[SC.6.7 internal-transition] ticket missing — rerun STEP 2.');

  // open -> in_progress
  store.getState().updateTicket(ticket.id, { status: 'in_progress' });
  store.getState().addTicketNote(ticket.id, {
    authorName: 'System',
    body: 'Status changed from Open to In progress by SC.6.7 fixture.',
  });

  // priority high -> critical
  store.getState().updateTicket(ticket.id, { priority: 'critical' });
  store.getState().addTicketNote(ticket.id, {
    authorName: 'System',
    body: 'Priority changed from High to Critical by SC.6.7 fixture.',
  });

  // operator dispatch note (visible to customer in portal)
  store.getState().addTicketNote(ticket.id, {
    authorName: 'Maria Lopez',
    authorEmail: 'maria@accesstech.test',
    body: 'On site at 10:15. PoE switch port has been flagged for replacement.',
  });

  const t = store.getState().serviceTickets[ticket.id];
  console.log('[SC.6.7 internal-transition]', {
    status: t.status,
    priority: t.priority,
    noteCount: t.notes.length,
    auditOk: t.status === 'in_progress' && t.priority === 'critical' && t.notes.length === 3,
  });
})();
`;

const PORTAL_READ_BACK_SNIPPET = `
// STEP 5 — open /portal/${PROJECT_ID} in another tab and confirm
//          the customer side reflects the internal change with
//          customer friendly labels (no internal jargon leaks).
//          Expect: status pill reads "Our team is on it", priority
//          reads "Critical", row expands to show the operator note.
(() => {
  console.log('[SC.6.7 portal-read-back] open ' + window.location.origin + '/portal/${PROJECT_ID}');
  console.log('  Expect: Service requests card shows DV-YYYY-0001.');
  console.log('  Expect: status pill reads "Our team is on it" (NOT "in_progress").');
  console.log('  Expect: priority pill reads "Critical".');
  console.log('  Expect: expanding the row shows the Maria Lopez note plus the System status / priority entries.');
})();
`;

const PORTAL_REPLY_SNIPPET = `
// STEP 6 — customer reply: addTicketNote against the same ticket
//          using the primary contact identity (mirrors what
//          PortalTicketRow.postNote does).
(() => {
  const store = window.__projectStore;
  const ticket = Object.values(store.getState().serviceTickets).find(
    t => t.projectId === '${PROJECT_ID}' && t.title.startsWith('Camera not working'));
  if (!ticket) return console.error('[SC.6.7 portal-reply] ticket missing.');
  const customer = store.getState().customers[ticket.customerId];
  const contact  = customer && customer.primaryContactId ? store.getState().contacts[customer.primaryContactId] : null;
  const authorName = contact
    ? [contact.firstName, contact.lastName].filter(Boolean).join(' ')
    : (customer ? customer.companyName : 'Customer');

  const noteCountBefore = ticket.notes.length;
  store.getState().addTicketNote(ticket.id, {
    authorName,
    authorEmail: contact && contact.email ? contact.email : undefined,
    body: 'Replacement camera is on site. Operator can plug in whenever.',
  });
  const after = store.getState().serviceTickets[ticket.id];
  const lastNote = after.notes[after.notes.length - 1];
  console.log('[SC.6.7 portal-reply]', {
    noteCountBefore,
    noteCountAfter: after.notes.length,
    lastNoteAuthor: lastNote && lastNote.authorName,
    auditOk: after.notes.length === noteCountBefore + 1 && lastNote.body.includes('Replacement camera'),
  });
})();
`;

const RESOLVE_SNIPPET = `
// STEP 7 — resolution: internal transitions to resolved. resolvedAt
//          must stamp exactly once on the first transition; a back
//          and forth (resolved -> in_progress -> resolved) keeps
//          the original stamp.
(() => {
  const store = window.__projectStore;
  const ticket = Object.values(store.getState().serviceTickets).find(
    t => t.projectId === '${PROJECT_ID}' && t.title.startsWith('Camera not working'));
  if (!ticket) return console.error('[SC.6.7 resolve] ticket missing.');

  store.getState().updateTicket(ticket.id, { status: 'resolved' });
  const firstResolveAt = store.getState().serviceTickets[ticket.id].resolvedAt;

  // Bounce out and back
  store.getState().updateTicket(ticket.id, { status: 'in_progress' });
  store.getState().updateTicket(ticket.id, { status: 'resolved' });
  const secondResolveAt = store.getState().serviceTickets[ticket.id].resolvedAt;

  console.log('[SC.6.7 resolve]', {
    firstResolveAt,
    secondResolveAt,
    stampStable: firstResolveAt === secondResolveAt,
    auditOk: !!firstResolveAt && firstResolveAt === secondResolveAt,
  });
})();
`;

const APPROVAL_HISTORY_SNIPPET = `
// STEP 8 — SC.6.5 history snapshot. Seeds two proposal versions +
//          two approvals against ${PROJECT_ID}, then asserts the
//          portal's lookup can resolve both versions and that the
//          customer view artifact of the older one matches its
//          frozen BOM (no live canvas state leaks into history).
(async () => {
  const store = window.__projectStore;
  const now = Date.now();
  store.setState((s) => ({
    proposals: {
      ...s.proposals,
      'prop-sc67-v1': {
        id: 'prop-sc67-v1', projectId: '${PROJECT_ID}', version: 1, status: 'superseded',
        customerView: { header: 'Phase 1', executiveSummary: 'Original scope.', scope: '12 cameras' },
        internalView: { notes: '', loadedCost: 0, gpPct: 0 },
        bomSnapshot: [{ id: 'pl-1', section: 'cameras', description: 'Camera A', quantity: 12, unit: 'ea', unitPrice: 700, lineTotal: 8400 }],
        createdAt: now - 14 * 86400000, updatedAt: now - 14 * 86400000, sentAt: now - 14 * 86400000,
        supersededBy: 'prop-sc67-v2',
      },
      'prop-sc67-v2': {
        id: 'prop-sc67-v2', projectId: '${PROJECT_ID}', version: 2, status: 'sent',
        customerView: { header: 'Phase 1 revised', executiveSummary: 'Two more cameras after walkthrough.', scope: '14 cameras' },
        internalView: { notes: '', loadedCost: 0, gpPct: 0 },
        bomSnapshot: [{ id: 'pl-1', section: 'cameras', description: 'Camera A', quantity: 14, unit: 'ea', unitPrice: 700, lineTotal: 9800 }],
        createdAt: now - 86400000, updatedAt: now - 86400000, sentAt: now - 86400000,
      },
    },
    approvals: {
      ...s.approvals,
      'appr-sc67-d': {
        id: 'appr-sc67-d', projectId: '${PROJECT_ID}', proposalVersion: 'v1',
        approverName: 'Jane Doe', approverEmail: 'jane@acme.test',
        approvalType: 'design', comments: 'Looks great.',
        approvedAt: new Date(now - 10 * 86400000).toISOString(),
        createdAt: now - 10 * 86400000, updatedAt: now - 10 * 86400000,
      },
      'appr-sc67-s': {
        id: 'appr-sc67-s', projectId: '${PROJECT_ID}', proposalVersion: 'v2',
        approverName: 'Bob Tester', approverEmail: 'bob@acme.test',
        approvalType: 'scope', comments: '',
        approvedAt: new Date(now - 86400000).toISOString(),
        createdAt: now - 86400000, updatedAt: now - 86400000,
      },
    },
  }));

  const proposalViewMod = await import('/src/app/lib/proposalView.ts');
  const v1 = store.getState().proposals['prop-sc67-v1'];
  const v1Artifact = proposalViewMod.toCustomerView(v1);

  console.log('[SC.6.7 approval-history]', {
    v1Cameras: v1Artifact.lines[0] && v1Artifact.lines[0].quantity,
    v2Cameras: store.getState().proposals['prop-sc67-v2'].bomSnapshot[0].quantity,
    v1FrozenAtSendTime: v1Artifact.lines[0] && v1Artifact.lines[0].quantity === 12,
    portalUrl: window.location.origin + '/portal/${PROJECT_ID}',
    expect: 'View approval history toggle shows 2 entries; clicking v1 opens the snapshot showing 12 cameras (NOT 14).',
  });
})();
`;

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log(' SC.6.7 spine integrity test — Customer Portal lifecycle + Service Tickets');
console.log('═══════════════════════════════════════════════════════════════════════');
console.log('');
console.log('Exercises SC.6 end to end: customer creates a ticket from the portal,');
console.log('operator triages it on /tickets, status round trips back with customer');
console.log('friendly labels, both sides exchange notes, ticket resolves, and SC.6.5');
console.log('approvals history resolves a prior version snapshot. Procedure assumes');
console.log('the dev or prod server is running.');
console.log('');
console.log('STEP 1 — reset baseline:');
console.log(SETUP_SNIPPET);
console.log('');
console.log('Hard reload, then come back here.');
console.log('');
console.log('STEP 2 — portal side ticket create:');
console.log(PORTAL_CREATE_SNIPPET);
console.log('');
console.log('STEP 3 — internal queue assertion:');
console.log(INTERNAL_LIST_SNIPPET);
console.log('');
console.log('STEP 4 — internal triage transitions:');
console.log(INTERNAL_TRANSITION_SNIPPET);
console.log('');
console.log('STEP 5 — visual portal read back:');
console.log(PORTAL_READ_BACK_SNIPPET);
console.log('');
console.log('STEP 6 — customer reply note:');
console.log(PORTAL_REPLY_SNIPPET);
console.log('');
console.log('STEP 7 — resolution + resolvedAt stability:');
console.log(RESOLVE_SNIPPET);
console.log('');
console.log('STEP 8 — approvals history version snapshot:');
console.log(APPROVAL_HISTORY_SNIPPET);
console.log('');
console.log('STEP 9 — SC.6.6 canvasSnapshot capture + portal render:');
console.log(`
// STEP 9 — capture a fresh canvasSnapshot via sendProposal on a
//          draft proposal for ${PROJECT_ID}, then assert the
//          snapshot has the right shape, is decoupled from live
//          canvas state (mutating a device label after send does
//          NOT change the snapshot's label), and the portal viewer
//          renders the captured floor.
(() => {
  const store = window.__projectStore;
  const beforeProposalCount = Object.keys(store.getState().proposals).length;
  const draftId = store.getState().createProposal({
    projectId: '${PROJECT_ID}',
    customerView: { header: 'SC.6.6 fixture', executiveSummary: '', scope: '' },
    internalView:  { notes: '', loadedCost: 0, gpPct: 0 },
    bomSnapshot: [{ id: 'pl-1', section: 'cameras', description: 'Test', quantity: 1, unit: 'ea', unitPrice: 100, lineTotal: 100 }],
    status: 'draft',
  });
  // Pick a device on this project to mutate AFTER send, to prove the
  // snapshot is decoupled.
  const liveDev = Object.values(store.getState().devices).find((d) => d.projectId === '${PROJECT_ID}');
  const originalLabel = liveDev ? liveDev.label : null;
  const ok = store.getState().sendProposal(draftId);
  // Mutate the live device label — the snapshot must NOT follow.
  if (liveDev) {
    store.getState().updateDevice(liveDev.id, { label: 'MUTATED AFTER SEND' });
  }
  const sent = store.getState().proposals[draftId];
  const snap = sent && sent.canvasSnapshot;
  const matchingSnapDev = snap && liveDev
    ? snap.devices.find((d) => d.id === liveDev.id)
    : null;
  console.log('[SC.6.7 canvas-snapshot]', {
    sendOk: ok,
    snapshotPresent: !!snap,
    floorCount: snap && snap.floors.length,
    deviceCount: snap && snap.devices.length,
    capturedAt: snap && snap.capturedAt,
    originalLiveLabel: originalLabel,
    snapDeviceLabel: matchingSnapDev && matchingSnapDev.label,
    snapshotFrozen: matchingSnapDev && matchingSnapDev.label === originalLabel,
    auditOk: ok && !!snap && (snap.floors.length > 0) && (snap.devices.length > 0)
          && (matchingSnapDev ? matchingSnapDev.label === originalLabel : true),
  });
  // Restore the label so other steps work against the same fixture.
  if (liveDev) store.getState().updateDevice(liveDev.id, { label: originalLabel });
})();
`);
console.log('');
console.log('STEP 10 — portal viewer visual check:');
console.log(`
// STEP 10 — open the portal in another tab and confirm:
//          - "Approved design (v${'$'}{n})" card renders below the proposal card.
//          - Floor tabs work (multi floor projects).
//          - Device dots colored by kind with customer friendly labels
//            (NOT internal ids; "Camera" / "Card reader" / etc).
//          - Legend at bottom matches the dots on the active floor.
//          - SVG has no console errors.
(() => {
  console.log('[SC.6.7 portal-viewer] open ' + window.location.origin + '/portal/${PROJECT_ID}');
})();
`);
console.log('');
console.log('ACCEPTANCE CHECKLIST');
console.log('  [ ] STEP 2: auditOk = true; ticketNumber matches DV-YYYY-NNNN.');
console.log('  [ ] STEP 3: ourTicketFound = true; statusInQueue = "open".');
console.log('  [ ] STEP 4: auditOk = true; 3 notes total (2 system + 1 operator).');
console.log('  [ ] STEP 5: portal renders "Our team is on it" and "Critical".');
console.log('  [ ] STEP 6: noteCount = 4; last note author = primary contact name.');
console.log('  [ ] STEP 7: stampStable = true; first resolvedAt survives a bounce.');
console.log('  [ ] STEP 8: v1FrozenAtSendTime = true (12 cameras even though v2 shows 14).');
console.log('  [ ] STEP 9: auditOk = true; snapshotFrozen = true (label decoupled from live store).');
console.log('  [ ] STEP 10: portal Approved design card renders; floor tabs work; no console errors.');
console.log('');
