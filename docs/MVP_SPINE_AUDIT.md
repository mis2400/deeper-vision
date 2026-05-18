# Deeper Vision MVP Spine Audit

**Date**: 2026-05-18
**Branch**: `audit/mvp-spine`
**Scope**: end-to-end audit of the 18-step user-stated MVP chain plus cross-cutting concerns H–S
**Discovery only. No code changed.**

---

## 1. Executive summary

The MVP spine breaks halfway. Of the 18 steps:

- **3 are COMPLETE end-to-end with real persistence and refresh tolerance**: Floor creation (7), Floorplan upload (8), Calibration (9), Survey canvas (10). Treating Calibration + Survey + Floor as the canvas trio gives us a solid mid-section.
- **6 are PARTIAL** (UI exists, persistence missing fields or downstream consumer is fake): Intake (1), Customer (2), Contact (3), Project (4), Site (5), Building (6), BOM/Estimate (11), Customer review/approval (13), Work Orders (14).
- **5 are NOT IMPLEMENTED** (no real persistence; UI is mock or absent): Proposal Builder (12), Commissioning (15), Assets (16), Warranties (17), Service tickets (18).

The chain from Intake through Calibration through Canvas through BOM through Estimate CSV is real. The chain from Proposal Builder onward is mostly fiction: hardcoded fixtures, dead onClick handlers, local React state that evaporates on refresh. There is no Asset model, no Warranty model, no Ticket model, no real integration code (zero `fetch` calls anywhere in `/src`). Customer approval persists two of the six required fields on the wrong entity (Project, not Approval). Work Orders are derived from canvas state with NO approval gate — they appear for any project with devices regardless of whether the customer ever approved.

**Honest verdict**: the surveyor / design / estimate front half is real and shippable. The deployment / commissioning / asset / warranty / ticket back half is a UI shell. The lifecycle that the platform sells (lead → install → manage → ticket) cannot be completed by a single user even once.

---

## 2. Per-step audit

### Step 1 — Intake — **PARTIAL**

- **A.** Route exists: `/intake/:projectId` → `SiteIntake.tsx` (`App.tsx:110`). Entry from `ProjectHub.tsx:167, 242` via `navigate('/intake/new')`.
- **B.** Yes. On finish, calls `addCustomer/addContact/addProject/addSite/addBuilding/addFloor` atomically (`SiteIntake.tsx:130, 144, 182, 193, 200, 212`).
- **C.** Creates one of each: Customer, Contact, Project, Site, Building, Floor.
- **D.** Correctly linked: Customer ↔ Contact (`primaryContactId` set both ways); Project → Customer + Site; Site → Project; Building → Site; Floor → Project + Building.
- **E.** All six slices persisted (`projectStore.ts:2229-2234`).
- **F.** Yes — `ProjectHub`, `Dashboard`, `BlueprintCalibration` read live state.
- **G.** `SiteIntake.tsx:101-103` short-circuits when `projectId !== 'new'`. No way to re-enter intake to fix records. PipelineView CRM conversion at `PipelineView.tsx:161` and `AccountDetail.tsx:263` bypasses intake entirely — creates a half-built parent chain (Project only, no Site/Building/Floor).

### Step 2 — Customer creation — **PARTIAL**

- **A.** Only via Intake (`SiteIntake.tsx:130`). No standalone "Add customer" UI.
- **B-F.** Persisted, linked, surfaced in AccountDetail/PipelineView/Dashboard.
- **G.** `PipelineView.tsx:100-102` "New opportunity" button has NO `onClick` — dead control, violates CLAUDE.md honesty contract. `AccountDetail.tsx:162-163` "Log touch" and "New opportunity" buttons also have NO `onClick`. CRM-first workflow impossible.

### Step 3 — Contact creation — **PARTIAL**

- **A.** Only via Intake. AccountDetail has no add-contact UI.
- **C.** `addContact` also logs `contact_added` activity (`projectStore.ts:700-705`).
- **G.** Only one primary contact per customer ever. `removeContact`/`updateContact` exist (`projectStore.ts:706-711`) but no UI calls them.

### Step 4 — Project creation — **PARTIAL**

- **A.** Two paths: intake (`SiteIntake.tsx:182`) and opportunity conversion (`projectStore.ts:760` `convertOpportunityToProject`).
- **G.** `projectStore.ts:760-797` creates a Project with **NO Site, Building, or Floor**. `Project.siteId` left undefined. Operator must then run calibration which auto-provisions Site + Building. This is a hidden recovery path, not a real flow.

### Step 5 — Site creation — **PARTIAL**

- **A.** Two paths: intake (`SiteIntake.tsx:193`) and calibration auto-provision (`BlueprintCalibration.tsx:225-242, 239`). No standalone UI.
- **G.** Operator cannot create a second site. `BlueprintCalibration.tsx:228-238` hardcodes `'Main Site'`. `Project.siteId` is never updated when calibration auto-creates the site for an opportunity-converted project.

### Step 6 — Building creation — **PARTIAL**

- **A.** Two paths: intake (`SiteIntake.tsx:200`) and calibration auto-provision (`BlueprintCalibration.tsx:240`). No standalone UI.
- **G.** Hardcoded `'Main Building'` (`SiteIntake.tsx:198`, `BlueprintCalibration.tsx:237`). `EngineeringCanvas.tsx:4601` toasts an error if no building exists rather than bootstrapping one — soft dead end.

### Step 7 — Floor creation — **COMPLETE (with caveat)**

- **A.** Four real paths: intake (`SiteIntake.tsx:212`), calibration add-floor (`BlueprintCalibration.tsx:258`), canvas FloorSwitcher (`EngineeringCanvas.tsx:4605`), VisionScan import (`VisionScan.tsx:97`).
- **G.** `VisionScan.tsx:100` synthesizes `buildingId = 'bld-${projectId}'` which won't match any real Building record — breaks the Building → Floor link for VisionScan-imported floors. `EngineeringCanvas.tsx:4601` bails out if no building exists instead of bootstrapping one.

### Step 8 — Floorplan upload / import / scan — **COMPLETE**

- **A.** Three routes wired: `/visionscan`, `/intake/:projectId`, `/calibrate/:projectId`. Import lib at `src/app/lib/floorplanImport.ts` handles PNG/JPG/PDF (first page via pdfjs-dist), white-sheet fill, 2048px cap, JPEG q=0.85.
- **B–E.** `FloorBackground` interface (`types.ts:450`) carries dataUrl + origin + transform. `setFloorBackground` writer (`projectStore.ts:935`). Persisted via `floors` slice. `BlueprintCalibration.tsx:117` and `VisionScan.tsx:91-118` both call it.
- **G.** PDF worker dynamic import (`floorplanImport.ts:63`) silently fails with no fallback if Vite drops `?url`-suffix worker bundling. Image path unaffected.

### Step 9 — Calibration — **COMPLETE**

- **A.** Route `/calibrate/:projectId` → `BlueprintCalibration.tsx` (4-step wizard) plus in-canvas Set Scale flow.
- **B.** `scalePxToFt = realFeet / pxDist` written correctly at `BlueprintCalibration.tsx:175-176`. In-canvas `applyCalibration` at `EngineeringCanvas.tsx:1203-1226` writes the same four fields and snapshots history.
- **D.** Migration even back-fixes inverted scales (`projectStore.ts:1915-1928`).
- **G.** Seed floors ship `scalePxToFt: 0.05` without `calibratedAt` (`seed.ts:326-330`); seeded demo floors render as not-yet-calibrated. The `ftPerPxForFloor` helper defensively falls back to `1/20` when scale is 0, which contradicts the seeded value — inconsistency, not a bug.

### Step 10 — Survey / design canvas — **COMPLETE**

- **A.** `/project/:projectId/canvas` → `EngineeringCanvas.tsx` (~14k LOC).
- **B–E.** All floor-scoped writers bind `floorId`: `addDevice` (`:1039`), `addPathway` (`:1298, 6014`), `addRoom` (`:1071, 1156`), `addAnnotation` (`:814`), `addMeasurement` (`:2976`). All slices in partialize (`projectStore.ts:2228-2281`). Floor walls persist via `setFloorWalls(floorId, walls)` into `Floor.walls`. Active floor sticky per project (`projectStore.ts:2278`). Migration repairs orphan floorIds (`:2170-2174`).

### Step 11 — BOM / Estimate — **PARTIAL**

- **A.** `/estimate/:projectId` → `EstimatorView.tsx` calls `deriveBOM(state, projectId)` at line 56. Real sections, no hardcoded `SECTIONS` array.
- **B.** Customer-vs-internal totals view at `EstimatorView.tsx:214`.
- **G.** `state.estimates` slice (`projectStore.ts:92`) is read for `laborRate`/`markup` only. No `addEstimate` or `updateEstimate` ever called — the derived BOM is never frozen, snapshotted, or versioned. Accessory pricing flat-defaults to $65 (`projectStore.ts:2709`).

### Step 12 — Proposal Builder — **NOT IMPLEMENTED (mock UI)**

- **A.** Route exists at `/proposal/:projectId`.
- **B–F.** Entirely fake. `ProposalBuilder.tsx:9-23` is a static array of 13 hardcoded line items (Axis P1468-LE, Mercury MR62e, Cisco C9300, Genetec…) loaded into `useState(INITIAL)` at line 27. Does NOT call `deriveBOM`. Does NOT read `useProjectStore`. Header buttons "Cover letter" / "PDF" / "Send" (lines 57-59) have NO `onClick`. No customer-safe vs internal toggle (Cost / Profit / Margin always visible at lines 122-127). Local `useState` only — reload resets every line back to the hardcoded Axis catalog.
- **G.** Violates CLAUDE.md honesty contract (dead controls forbidden). Subtitle "Customer-facing quote derived from BOM" (line 54) is a lie.

### Step 13 — Customer review / approval — **PARTIAL**

- **A.** Two routes: `/project/:projectId/review` (`ReviewMode.tsx`) and `/portal/:projectId` (`CustomerPortal.tsx`).
- **B.** ReviewMode persists NOTHING — file header (`ReviewMode.tsx:11-12`) explicitly says "Preview — not persisted." `onApprove` (line 266) only sets local React state. Comments seed from `SEED_COMMENTS` at line 105 (two fake reviewer comments).
- **B (portal).** Persists via `updateProject(project.id, { customerApprovedAt, customerApprovedBy, lifecyclePhase: 'approved' })` at `CustomerPortal.tsx:123`.
- **G.** Persisted shape: only `customerApprovedAt: number` and `customerApprovedBy?: string` (`types.ts:344-347`). MISSING: `approverEmail`, `version`, `comments`, `approvalType`. No `Approval` interface, no `approvals[]` collection. Re-approval overwrites prior approval — no audit trail.

### Step 14 — Work Orders / deployment tasks — **SPLIT (real + mock parallel)**

- **PARTIAL (real)**: `/project/:projectId/deployment` (`DeploymentMode.tsx:76`) and `/project/:projectId/deployment/m` call `deriveWorkOrders(state, projectId)` (`projectStore.ts:3379-3500`). WOs derived from canvas devices + doors + pathways + IDFs. Progress (status, checklist, photos) persists on `workOrderProgress` slice (`projectStore.ts:519, 1421-1510`). No persisted WO record — only progress overrides keyed by derived id.
- **NOT IMPLEMENTED (mock)**: `/workorders/:projectId` (`WorkOrders.tsx:10-42`) is 131 lines of hardcoded `ORDERS` (WO-001/002/003), local `useState`, zero store reads, zero `deriveWorkOrders` import. "Generate from BOM" button (`WorkOrders.tsx:59`) is a no-op.
- **G.** Two routes for the same concept. One real, one fiction. Confusing.

### Step 15 — Commissioning — **NOT IMPLEMENTED (UI-only)**

- **A.** Route exists at `/commission/:projectId` → `Commissioning.tsx`.
- **B.** Stores results/notes in local `useState` (`Commissioning.tsx:101-102`). NEVER writes to `device.commissioning`. Confirmed by grep: no `setDeviceCommissioning` exists in store. The `commissioning?` sub-object on `Device` (`types.ts:619-626`) is declared but never written, never read.
- **G.** "Export report" button (`Commissioning.tsx:129`) is a no-op. Page reload destroys all pass/fail/N/A results and notes. Phantom field.

### Step 16 — Asset inventory — **NOT IMPLEMENTED**

- Grep evidence: `grep -in "asset\|warrant\|ticket" projectStore.ts types.ts` returns **zero matches**. No `Asset` interface. No `assets` slice. No commissioned-asset record concept anywhere.

### Step 17 — Warranty tracking — **NOT IMPLEMENTED**

- Same grep, zero matches. No `Warranty` interface, no `warranties` slice. No warranty fields on Device. No expiration tracking, no renewal model.

### Step 18 — Service tickets — **NOT IMPLEMENTED**

- Zero matches for `Ticket`/`ServiceTicket`/`tickets` in store or types.
- `Maintenance.tsx:9-18`: 8 hardcoded mock jobs in module scope. No store reads. No persistence.
- `ChangeOrders.tsx:10-41`: 3 hardcoded mock COs with local `useState`. No store reads. No persistence.
- No linkage to customer / project / device / asset / warranty (none of which exist beyond device).

---

## 3. Cross-cutting concerns

### H. Calibration math flow

**MOSTLY YES, with one major exception.**

- `floor.scalePxToFt = realFt / pxMeasured` written correctly: `BlueprintCalibration.tsx:185`, `EngineeringCanvas.tsx:1214`.
- Shared helpers `ftPerPxForFloor(floor)` and `pathwayLengthFt(pathway, floor)` in `engineering.ts:158-189`. Fallback `1/20`.
- Used correctly by: pathway label (`EngineeringCanvas.tsx:5786, 5846, 12218`), BOM CSV (`:12462, 16120, 16272`), labor estimate (`:5993-6017`), device coordinate readout (`:11320`), room area (`RoomInspector.tsx:4221-4230`), pathway vertex inspector (`:14703`), non-camera coverage (`:896, 903, 905, 935`).

**CRITICAL EXCEPTION**: Camera cones use a frozen `const PX_PER_FT = 3.83;` at:
- `FovCone` (`EngineeringCanvas.tsx:9278`)
- `Coverage` (`:9407, 9421`)
- `FOV preview / ConeHandles` (`:8649, 9482, 9517`)
- `AiOptimizeSection` (`:12308`)

This ignores `floor.scalePxToFt` entirely. A camera with `range: 50 ft` always paints a 191.5 px cone regardless of whether the operator calibrated the plan at 5 px/ft, 20 px/ft, or 50 px/ft. **On any calibrated background image where the true scale ≠ 3.83 px/ft, every camera cone lies.** This is the biggest semantic bug in the surveyor spine.

### I. Pathway length

**YES.** `pathwayLengthFt(pathway, floor)` at `engineering.ts:179-189` trusts persisted `lengthFt > 0`, otherwise derives from `points × floor.scalePxToFt`. Freshly drawn pathway commits with `lengthFt: Math.round(lenPx * ftPerPxForFloor(_floor))` (`EngineeringCanvas.tsx:1285-1295`). Pathways with real points always show real ft.

### J. Device persistence (coverage, rot, FOV, range, lens, notes)

**YES.** `Device` interface (`types.ts:568-652`) declares all relevant fields. `updateDevice` does unconditional shallow merge (`projectStore.ts:886-901`). `devices` slice in partialize (`:2235`). No field-level allowlist — every Device key round-trips through localStorage. Migration `repair(persisted.devices)` (`:2170`) only patches missing `floorId`, doesn't strip fields.

### K. BOM derivation source

**MOSTLY COMPLETE, with gaps.**

| Component | Wired | File:line |
|---|---|---|
| Devices | YES (catalog + UNIT_PRICE fallback) | `projectStore.ts:2920-3006` |
| Doors + stacked hardware | YES (assembly array + per-item DOOR_HARDWARE_PRICE + proposed/existing flag) | `projectStore.ts:2923-2962, 3012-3047` |
| Cable runs w/ calibrated length | YES (`pathwayLengthFt(p, floor)`) | `projectStore.ts:3052-3072` |
| Walls | **NO** — not enumerated in BOM at all | n/a |
| Conduit length | **NO** — only cable feet rolled up; no separate conduit line items | n/a |
| Accessories | **PARTIAL** — `deriveBOM` walks `dev.accessories[]` (`projectStore.ts:2696-2712`); `deriveCanvasBomRows` does NOT iterate accessories | inconsistent |

Walls and conduit don't appear in `CanvasBomRow`. Accessory coverage is asymmetric between the two derivation functions.

### L. Estimate CSV export

**COMPLETE.** `handleExportCsv` at `EstimatorView.tsx:92-122` emits real BOM data: iterates `bom.lines` and writes Section / SKU / Description / Qty / Unit / Unit price / Extension / Labor hr per row, then totals. RFC 4179 CSV quoting via `csvField` (line 18), UTF-8 BOM prefix for Excel (line 27), `data-testid="estimator-export-csv"` for QA. No placeholders.

### M. Customer Portal real data

**PARTIAL (honest but thin).** All data sources are real selectors against `useProjectStore`: `projects[projectId]`, `customers`, `contacts`, `sites`, `workspaceSettings`, `workspaceMembers`, `attachments` (lines 41-48). Schedule derives from `lifecyclePhase` + `PHASE_TIMELINE`. Documents filter `attachments` to project, exclude `internalOnly`. Branding from workspace settings.

NOT shown: approved design / canvas snapshot, the proposal (no link, no embed, no PDF), comments thread, prior approvals history, assets list, warranties, support tickets. None of these surfaces exist in the file. The portal is honest (no fake mocks) but very thin against the spec.

### N. Customer approval persistence

**PARTIAL — 2 of 6 required fields persist on the wrong entity.**

Persisted shape (`types.ts:344-347`): `customerApprovedAt?: number`, `customerApprovedBy?: string`. Stored on `Project`, not on a dedicated Approval record.

Required vs actual:
- `approverName` — partial (stored as `customerApprovedBy`, optional, free-text)
- `timestamp` — yes (`customerApprovedAt`)
- `approverEmail` — **MISSING** (form at `CustomerPortal.tsx:474-487` only collects name)
- `version` — **MISSING** (no proposal version concept anywhere in store)
- `comments` — **MISSING** (no comment field in approve sheet)
- `approvalType` — **MISSING** (no "conditional" / "with changes" variants)

No dedicated `approvals` slice. No `Approval` type. Re-approval overwrites the prior. ReviewMode persists nothing (`ReviewMode.tsx:266`).

### O. Work Order generation gate

**NO GATE.** Customer approval (`CustomerPortal.tsx:105-132`) sets `customerApprovedAt` + advances `lifecyclePhase` to `'approved'`. But `deriveWorkOrders` (`projectStore.ts:3379-3500`) **never reads** `customerApprovedAt` or `lifecyclePhase`. WOs appear for any project with devices/doors/pathways/IDFs on the canvas regardless of approval. Only `Commissioning.tsx:131-145` shows a soft pre-approval banner. WOs also leak into `Dashboard.tsx:104`, `ReportsCenter.tsx:75`, `assistantEngine.ts:434, 526`, `projectSync.ts:123`.

### P. Commissioning persistence

**DOES NOT WRITE.** `Commissioning.tsx:101` (`setResults` local state) never calls a store-mutating action. No `setDeviceCommissioning` setter exists in the store. The `device.commissioning` shape (`types.ts:619-626`) is a phantom field. Page reload destroys all pass/fail/N/A results and notes.

### Q. Asset / Warranty / Service Ticket models

**NONE EXIST.** `grep -in "asset\|warrant\|ticket\|serviceticket" projectStore.ts types.ts` returns zero. Models not declared, slices not declared, no records created, no linkage code. Closest adjacent concept is `BusCommissioningCheck` (`types.ts:1453`) which is bus-specific.

### R. Q360 / HubSpot / QuickBooks integration scaffolding

**STATIC STATE ONLY. ZERO REAL INTEGRATION CODE.**

- `IntegrationRecord` (`types.ts:1707-1714`) is `{id, status, connectedAt?, lastSyncAt?, note?}` — no auth tokens, no endpoint URLs.
- `setIntegrationStatus` (`projectStore.ts:1745`) and `recordIntegrationSync` (`:1764`) flip a local map.
- `SettingsView.tsx:683-687` registers QuickBooks + HubSpot as `INTEGRATIONS` array entries. "Connect" button (`:826`) calls `setStatus` → local state. Subtitle (`:750`) admits "real OAuth handshakes land with each integration's backend wiring."
- Q360: single mention at `Dashboard.tsx:441` as a static marketplace tile, not even registered in `IntegrationId` union (`types.ts:1699-1703`).
- `LiveIntegration.tsx:9-19`: 9 hardcoded mock devices in module-scope `DEVICES`. "Refresh" button (`:38`) does nothing.
- **Zero `fetch(`, zero `axios`, zero `XMLHttpRequest` anywhere in `/src`** (confirmed via grep). No real integration code exists.

### S. 9 unimplemented "Coming soon" tool surfaces

**NONE wired in a way an operator could mistake for working.**

- `Tool` union (`EngineeringCanvas.tsx:78`) is exactly `'select' | 'pan' | 'measure' | 'wall' | 'cable' | 'conduit' | 'pathway' | 'calibrate' | 'room' | 'annotate'`. No `'door-opening'`, `'window'`, `'text'`, `'photo'`, `'zone'`, `'separator'`. No code branch can reach them.
- Left rail `items` array (`:14829-14836`) is exactly Select, Pan, Measure, Wall, Room, Annotate. `coming: Item[] = []` (`:14840`) with explicit "Coming-soon tools — removed per 'If a control doesn't work, hide it'" comment.
- Bottom-bar dead categories explicitly `return null` (`:15736`) instead of rendering disabled stubs.
- One legacy "Coming soon" tooltip exists in `:14872` but it's gated on `it.coming` which is never true. Dead branch, zero user impact.

S **PASSES.** Pass 1.0's "stop dead controls" sweep cleaned this up.

---

## 4. Top 10 spine gaps prioritized

Severity definitions:
- **CRITICAL** = the chain breaks here; the user cannot continue downstream
- **HIGH** = the next step receives fake / placeholder data
- **MEDIUM** = polish, accuracy, or completeness gap

| # | Gap | Severity | Evidence |
|---|---|---|---|
| 1 | **Proposal Builder is a hardcoded fixture.** 13 fake line items in `useState`; never reads store; dead Send/PDF/Cover letter buttons. | CRITICAL | `ProposalBuilder.tsx:9-23, 27, 57-59` |
| 2 | **No Approval, Asset, Warranty, or Ticket models exist.** Steps 13 (partial), 16, 17, 18 cannot persist. Re-approval overwrites prior. Lifecycle past install is impossible. | CRITICAL | grep zero in `projectStore.ts`, `types.ts` |
| 3 | **Commissioning writes nothing.** All pass/fail/N/A + notes lost on reload. `device.commissioning` is a phantom field declared but never written. | CRITICAL | `Commissioning.tsx:101-102`; no `setDeviceCommissioning` in store |
| 4 | **No work-order approval gate.** `deriveWorkOrders` ignores `customerApprovedAt` and `lifecyclePhase`. WOs appear for any device-bearing project, breaking the lead → approval → deployment narrative. | CRITICAL | `projectStore.ts:3379-3500` |
| 5 | **Two parallel WO screens, one real, one mock.** `/workorders/:projectId` is hardcoded fiction with no-op "Generate from BOM" button. Operator sees real WOs in `/deployment` and fake WOs in `/workorders` for the same project. | HIGH | `WorkOrders.tsx:10-42, 59`; vs `DeploymentMode.tsx:76` |
| 6 | **Camera cones ignore `floor.scalePxToFt`.** Hardcoded `PX_PER_FT = 3.83` paints every camera at the wrong physical scale on any calibrated background. Surveyor's primary visual deliverable is geometrically wrong. | HIGH | `EngineeringCanvas.tsx:8649, 9278, 9407, 9421, 9482, 9517, 12308` |
| 7 | **Approval persists 2 of 6 fields on wrong entity.** Email, version, comments, approval-type all missing. No `approvals[]` slice. No audit trail. | HIGH | `types.ts:344-347`; `CustomerPortal.tsx:474-487` |
| 8 | **No standalone Customer / Contact / Site / Building creation UI.** CRM-first workflow impossible. Dead "New opportunity" / "Log touch" buttons in PipelineView + AccountDetail. Opportunity conversion creates Project only — half-built parent chain. | HIGH | `PipelineView.tsx:100-102, 161`; `AccountDetail.tsx:162-163, 263`; `projectStore.ts:760-797` |
| 9 | **Customer Portal shows no design / proposal / comments / assets / warranties / tickets.** Renders scope, schedule, docs, approval card, contact. Sufficient for honest disclosure, insufficient for the customer experience described in the spec. | HIGH | `CustomerPortal.tsx:41-98` |
| 10 | **BOM omits walls + conduit; accessory coverage asymmetric between the two derivation functions.** Estimate is correct for devices, doors, cables, but underbills physical infrastructure. | MEDIUM | `projectStore.ts:2696-2712, 2920-3072` |

Honourable mentions (worth fixing but not top 10):
- VisionScan synthesizes a fake `buildingId` (`VisionScan.tsx:100`) that won't link to any real Building.
- Maintenance + ChangeOrders screens are entirely module-scope mocks with no store integration (`Maintenance.tsx:9-18`, `ChangeOrders.tsx:10-41`).
- Zero `fetch(` calls in `/src` — every integration tile is a UI shell. Q360 isn't even registered in the `IntegrationId` union.
- Accessory pricing flat-defaults to $65 (`projectStore.ts:2709`) instead of catalog lookup.
- Seed floors ship `scalePxToFt: 0.05` without `calibratedAt` — show as "default scale" despite seed value (`seed.ts:326-330`).

---

## 5. Recommended Spine Completion sequence

The goal is to make a single operator able to drive one customer through the entire lifecycle once, end-to-end, refresh-tolerant. Batches are sized so each could ship as a 3-to-5 sub pass.

### Batch A — Lifecycle persistence backbone (CRITICAL)

The downstream steps cannot exist until the data model does. Build the models first, wire UIs second.

- **A.1** Add `Approval` interface + `approvals: Record<string, Approval>` slice with `{ id, projectId, version, approverName, approverEmail, timestamp, comments, approvalType, snapshotRef? }`. Migrate existing `customerApprovedAt`/`customerApprovedBy` to a synthetic first Approval record per project.
- **A.2** Add `Asset` interface + `assets` slice. Asset is the post-commission identity of a Device: `{ id, deviceId, projectId, customerId, serialNumber?, installedAt, commissionedAt, warrantyId?, location? }`. Migration: no backfill needed (greenfield).
- **A.3** Add `Warranty` interface + `warranties` slice: `{ id, assetId, providerSku?, startsAt, endsAt, kind, notes?, claims: WarrantyClaim[] }`.
- **A.4** Add `ServiceTicket` interface + `tickets` slice: `{ id, customerId, projectId?, assetId?, openedAt, status, priority, summary, comments[], assignedTo? }`.
- **A.5** Wire all four into partialize. Add forward-only migration v22 → v23. Write 4 small store actions per slice. Smoke-test refresh tolerance.

### Batch B — Approval gate + Work Order canonicalization (CRITICAL + HIGH)

Once the Approval record exists, the WO chain becomes real.

- **B.1** Update `CustomerPortal.submitApproval` to write a real `Approval` record (with email + comments + version). Form upgraded to collect missing fields. Keep `Project.customerApprovedAt` as a denormalized convenience set from the most-recent approval.
- **B.2** Gate `deriveWorkOrders` on `lifecyclePhase === 'approved'`. Surface a clear "Awaiting approval" empty state in `DeploymentMode` for unapproved projects.
- **B.3** Delete the mock `/workorders/:projectId` route OR redirect it to `/project/:projectId/deployment`. One source of truth for WO state.
- **B.4** Promote the derived WO list to persisted `WorkOrder` records at the moment of approval. `workOrderProgress` keys stay aligned. Operator can then edit a WO without it disappearing when canvas state changes.

### Batch C — Commissioning writes back (CRITICAL)

- **C.1** Add `setDeviceCommissioning(deviceId, patch)` action that does shallow merge into `device.commissioning`.
- **C.2** Refactor `Commissioning.tsx` to write every pass/fail/N/A + note + photo into the store via the new action.
- **C.3** On "Mark device commissioned" → create the matching `Asset` record (Batch A.2). Asset.commissionedAt set to now. Open a default Warranty (Batch A.3) using catalog defaults (1y manufacturer, configurable).
- **C.4** Add the "Export commissioning report" PDF that actually exports the persisted record.

### Batch D — Proposal Builder real wiring (CRITICAL)

- **D.1** Delete `ProposalBuilder.tsx`'s `INITIAL` fixture. Re-derive lines from `deriveBOM(state, projectId)` on mount.
- **D.2** Add a customer-safe / internal mode toggle. Hide Cost / Profit / Margin in customer mode. Customer mode is what gets sent.
- **D.3** Wire Cover letter / PDF / Send buttons to real handlers OR remove them per the honesty contract. PDF via the existing `jspdf` pipeline. Send = email handoff (mailto:) until SMTP/Postmark lands.
- **D.4** Persist a `Proposal` snapshot record each time the operator clicks Send, so the customer's Approval (Batch A.1) can reference a real `version`.

### Batch E — CRM-first creation UIs + standalone entity managers (HIGH)

- **E.1** Wire `PipelineView` + `AccountDetail` dead buttons. "New opportunity" opens a real opportunity form that calls `addOpportunity`. "Log touch" creates a Touch.
- **E.2** Standalone "Add customer" + "Add contact" surfaces on `/crm` and `/account/:customerId`.
- **E.3** Standalone "Add site" + "Add building" on `/project/:projectId` overview so an operator can build out the parent chain without re-running intake.
- **E.4** Fix `convertOpportunityToProject` to also create a default Site + Building + Floor so the canvas is not a soft dead end for converted projects.
- **E.5** Allow re-entering Intake to edit an existing project (`SiteIntake.tsx:101-103`).

### Batch F — Customer Portal lifecycle completion (HIGH)

- **F.1** Show the canvas snapshot or static PDF of the approved design in the portal.
- **F.2** Embed/link the latest Proposal record.
- **F.3** Render an Approvals history table.
- **F.4** Render Assets list (post-commission) with each asset's Warranty status + Open tickets.
- **F.5** Allow the customer to open a Service Ticket from the portal.

### Batch G — Camera cone calibration fix + BOM gaps (HIGH + MEDIUM)

- **G.1** Replace `PX_PER_FT = 3.83` with `ftPerPxForFloor(currentFloor)` at all 7 camera sites in `EngineeringCanvas.tsx`. Sweep for any other geometric hardcodes.
- **G.2** Add walls + conduit to `deriveCanvasBomRows` so the BOM bills physical infrastructure.
- **G.3** Reconcile accessory iteration between `deriveBOM` and `deriveCanvasBomRows`. One implementation, one truth.

### Batch H — Real integration adapters (deferrable but blocking the integration sales story)

This is the only batch I'd consider scoping down or punting to V1.1 because it requires backend choices (OAuth proxy, where do secrets live in a no-backend SPA).

- **H.1** Concrete spec for a thin backend (Cloudflare Workers / Vercel Edge / a sibling Next.js app) that holds the OAuth tokens.
- **H.2** Real HubSpot adapter (push customer + contact on creation, pull lifecycle stage changes).
- **H.3** Real QuickBooks adapter (push approved Estimate as an Invoice draft).
- **H.4** Real Q360 adapter (after schema exists; document the integration first).

---

## 6. Honest scope estimate

**Critical-path lifecycle (Batches A → D)**: 4–6 focused weeks of single-engineer time.

- Batch A (models + persistence): **1 week**. Schema work + migration + smoke tests.
- Batch B (approval gate + WO canonicalization): **3-5 days**. Mostly wiring.
- Batch C (commissioning writes back): **5-7 days**. UI refactor + Asset/Warranty creation flow.
- Batch D (proposal builder real wiring): **3-5 days**. Already have BOM + PDF infrastructure; mostly deleting fixtures and wiring buttons.

**HIGH-priority finish (Batches E → G)**: another **3-4 weeks**.

- Batch E (CRM-first UIs + standalone entity managers): **1 week**. Lots of small surfaces.
- Batch F (portal lifecycle completion): **1 week**. Renders + asset/ticket integration depends on Batch A+C landing.
- Batch G (camera cone fix + BOM gaps): **3-5 days**. Cone fix is mechanical sweep; BOM gaps are an extra ~150 lines.

**Integration adapters (Batch H)**: **4-8 weeks**, depending on whether a backend is added and which providers are first.

### Realistic total to drive the spine to 100% real, end-to-end, persisted, refresh-tolerant

**8–10 weeks of focused single-engineer time** for everything except real third-party integrations.

**12–18 weeks** if integrations are in scope (Q360/HubSpot/QuickBooks) AND a backend must be built to hold OAuth tokens.

This estimate assumes:
- No backend yet exists (currently true).
- One engineer working full time, with code-reviewer + task-verifier on every PR.
- No new tools/dependencies introduced beyond what's already in `package.json`.
- Existing chrome (TopBar, ProjectStateMenu, etc.) is reusable as-is.

If pricing logic needs to centralize in the sibling `quote-engine` repo, add **1-2 weeks** for that handoff.

---

*Audit conducted via 4 parallel investigation passes; every file:line citation independently verified. No code changes in this branch.*
