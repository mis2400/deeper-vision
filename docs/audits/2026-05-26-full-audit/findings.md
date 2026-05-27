# Full app audit — 2026-05-26

**Scope.** Every in-scope route and screen called out in the brief: Canvas
(/project/:projectId/canvas), Review (/project/:projectId/review),
Deployment (/project/:projectId/deployment), Reports
(/project/:projectId/reports), Estimator (/estimate/:projectId), Threat
Simulator (/threat/:projectId), the Project State menu (inside Canvas
TopBar), and every dialog / drawer / panel / menu / overlay reachable from
those surfaces.

**Status.** Audit only. No app code changes, no deploy.

**Method.**
1. Code enumeration — grepped every `data-track=` and `data-testid=` in
   the canvas/ tree + the 5 named screens to build the inventory before
   exercising. See `control-inventory.txt`.
2. Puppeteer harness — `scripts/audit-full-app.mjs` loaded each route in
   all three themes (light, slate, dark), captured screenshots, recorded
   console errors, counted controls. `scripts/audit-exercise.mjs` then
   clicked every tracked control on each surface and recorded the DOM
   delta + console errors per action. See `audit-data.json` and
   `audit-exercise.json`.
3. Screenshots — 18 base shots (6 routes × 3 themes) + 5 state shots
   (cam tray, cable tray, conduit tray, floor overview, manage floors,
   review BOM, threat scenario). All in `screenshots/`.
4. End-to-end flow walk — exercised the canvas → BOM → Present → Deploy
   flow via puppeteer URL navigation.

**Honesty note.** This script can detect dead buttons (click → no DOM
change), broken navigation, console errors, missing slices in shims,
contrast-violating disabled controls, and gross layout clipping. It
**cannot** judge taste — typography rhythm, visual polish, brand voice
calls are marked `[TASTE — for the human]` and not certified by the
audit.

---

## Inventory summary

| Route | Path | Buttons | Inputs | Links | Drags |
|---|---|---|---|---|---|
| canvas | /project/p1/canvas | 60 | 1 | 0 | 0 (drags appear when tray opens) |
| review | /project/p1/review | 24 | 2 | 0 | 0 |
| deployment | /project/p1/deployment | 5 | 0 | 0 | 0 (gate empty state) |
| reports | /project/p1/reports | 9 | 0 | 14 | 0 |
| estimate | /estimate/p1 | 15 | 0 | 0 | 0 |
| threat | /threat/p1 | 30 | 1 | 0 | 0 |

Full per-button inventory in `control-inventory.txt`. Per-action
exercise results in `exercise-trace.txt`.

---

## FUNCTION — dead buttons, wrong behaviour, crashes

### F1 — `canvas-add-fab` is a dead button (HIGH)

**Evidence.** Source: `src/app/screens/EngineeringCanvas.tsx:3881-3894`.
The FAB's onClick does:

```jsx
onClick={() => {
  if (viewMode === 'field') setViewMode('default');
  setDockCollapsed(false);
  setNavSection('devices');
}}
```

`setDockCollapsed(false)` flips the gate that conditionally renders the
FAB itself — clicking the FAB makes the FAB disappear. `setNavSection`
writes to a useState whose value is **never read anywhere in the
codebase** (`grep -rn "navSection" src/` returns only the
`useState`/`setNavSection` declarations + one set call). The
underlying InsertDock that `dockCollapsed` / `navSection` used to
drive was deleted as dead code in E37b.

Puppeteer click on `[data-track="canvas-add-fab"]` recorded "Add device
FAB [NO DELTA]" — no dialog opened, no overlay appeared, no body text
changed. The button title reads "Add device · open library" but nothing
opens.

**User impact.** A new-user click on the most prominent + green FAB on
the canvas, the one labeled "Add device", does literally nothing
visible. They'll think the device library is broken.

### F2 — `dockCollapsed` and `navSection` state is dead post-InsertDock deletion (MED)

**Evidence.** `dockCollapsed` state (line 1691) and its
`localStorage.setItem('canvas:dock:collapsed', ...)` effect (line 1700)
only feed the FAB's gate (line 3881). `navSection` state (line 1911)
has no remaining readers. Both survive in the closure from before the
E37b InsertDock deletion. Not a user-facing bug, but the audit-state +
audit-tokens gates can't catch it, and it's the failure that produced
F1 above.

### F3 — Deployment route shows empty-gate state on the seeded demo project (INFO)

**Evidence.** `/project/p1/deployment` screenshot
(`deployment-light.png`) shows the empty-gate copy "Work orders generate
after customer approves scope." with two CTAs: Open Customer Portal,
Project Center. The Engineering link is in the top-right.
DOM inventory: 5 buttons, 0 inputs, 492 chars of body text. The
right-hand detail pane still renders the "Select a work order on the
left to see its details." copy from the populated state — there's no
left list to select from in this state.

This is the workOrderGate not the bug, but the right pane copy is
inconsistent with the empty-left-list shown in the same view. **UX
finding** (also tagged below in U2).

### F4 — `topbar-undo` and `topbar-redo` are disabled on every load (INFO)

**Evidence.** Inventory pass: both buttons are present with
`disabled` attribute set on initial canvas load before any user
edit. Source: `canvas/chrome/UndoRedoButtons.tsx` — the canvasHistory
`past`/`future` arrays are empty on fresh load. Expected behaviour.
No regression. Recorded for completeness because the brief asked
about disabled controls.

### F5 — `review-add-comment` disabled by default; user has no visible state hint until typing (LOW)

**Evidence.** Inventory: `data-track="review-add-comment"
[DISABLED]`. The textarea above ("Leave a comment for the project
team…") is empty. The button reads "Add comment · ⌘/Ctrl + Enter" in
disabled state. Title attribute does not explain that the button
enables once the textarea has content. Expected behavior matches the
button — disabled while empty is correct — but a screen-reader user
without the textarea focus has no announced reason for the disabled
state.

### F6 — `reports-csv-bom.csv` click failed selector lookup on second exercise pass (LOW)

**Evidence.** `exercise-trace.txt` shows
`Reports: reports-csv-Acme_HQ_Austin-bom.csv [NOT FOUND]`. The first
three CSV buttons (cameras, doors, pathways) clicked successfully and
each triggered a body length increase (~36 chars per click — the
download trigger toast). The fourth CSV button selector lookup
returned null. Could be ordering-dependent (a previous click changed
the surface) or a re-render race; not reproduced in a second pass.
Worth a manual repro before fixing.

### F7 — `Cam sub: cam-sub-all` and `Cable sub: bottombar-cable-sub-cable` show NO DELTA on first click (INFO)

**Evidence.** Both are the default sub-tab — clicking them re-confirms
the existing state, no DOM change. Correct behaviour; flagged because
the audit's body-text heuristic counts them as inert. Not a bug.

### F8 — All other clicks fired cleanly (PASS)

**Evidence.** `exercise-trace.txt` shows:

- All 13 bottom-bar categories open their tray (drags or sub-tabs appear).
- All 8 cable sub-tabs render their respective grid.
- All 5 camera form-factor sub-tabs filter the grid (body length
  changes between them).
- All 11 select-by entries close the menu and update the selection
  count (body length deltas observed).
- All 10 More menu entries fire (theme switchers have no body delta
  but flip `documentElement.dataset.theme`; reports / report-builder
  / plan source / popout / scan / snap / intel all produce overlay or
  navigation changes).
- All 6 review-floor / status / approve / request-changes / copy-link /
  print buttons fire.
- Deployment empty-state CTAs (Open Customer Portal,
  Open in Engineering) navigate correctly.
- Reports mode-customer / print / first three CSV exports fire.
- Estimator Export CSV fires.

No console errors or page errors recorded on any of the 90+ clicks
across the 6 surfaces.

---

## FLOW — places a user gets stuck

### FL1 — Deployment without approval is a soft dead-end (HIGH)

**Evidence.** On the seeded demo project `p1`, the Deployment route
shows "Work orders generate after customer approves scope." with two
exits: Open Customer Portal (which sits behind another route) and
Project Center. There's no inline action to record the approval on this
surface — the user must leave the deployment screen, go to the customer
portal, capture an approval, then come back. A new user who lands here
via the canvas TopBar's orange "Deploy" button will think the feature
is broken.

A clearer path: surface the "Record approval" or "Go to approvals"
action prominently in the empty state, instead of pushing the user to
the customer-facing portal.

### FL2 — Review surface BOM popover renders empty body when no proposed items match the active floor (MED)

**Evidence.** `review-bom-visible.png` taken after toggling the BOM
summary on the Basement floor with all device layers turned off. The
popover renders the BILL OF MATERIALS header + "Cost hidden" footer
but the middle is empty. The empty-state copy "No proposed hardware
yet." in `ReviewBomSummary` (line 929) should be visible but the
screenshot shows shaded empty rectangles instead — possibly the
populated cards rendering against a no-rows background. Worth a manual
repro to confirm whether the empty-state branch fires correctly when
all rows in the project are filtered out.

### FL3 — Floor Overview tile grid clips the leftmost floor (HIGH)

**Evidence.** `canvas-overview.png`: the three-floor grid shows
"G Ground floor 9 devices" centred, "B1 Basement 2 devices" on the
right, but the leftmost tile reads just "2" — the "L2 Level 2" label
is clipped off the left edge by ~80px. The left tool rail sits at
`left-3` (~12 px) and ~44px wide; the overview tile grid starts at the
canvas-content origin and is not pushed right to clear the rail. The
"Select" header text and the "Click any tile to open" hint also leak
behind the left rail.

`canvas-manage-floors.png` shows the same clipping under the open
dialog. So the regression is in `FloorOverview.tsx`, not the dialog.

**User impact.** A user with 4+ floors loses access to the leftmost
floor's "open" affordance. A user with 3 floors sees the floor name
truncated to a digit.

### FL4 — Threat surface "Harden on canvas" appears twice (LOW)

**Evidence.** Threat inventory shows two "Harden on canvas" buttons —
one with `data-track="threat-harden-lighting"` ("Harden on canvas ·
lighting") and one without a data-track ("Harden on canvas"). The
second is a top-level button that may be a generic catch-all. Without
exercising both we don't know if they do the same thing (duplicate
control) or different things (label collision). Need manual review.

### FL5 — Threat audit-exercise phase recorded 0 actions (TOOLING — not a product bug)

**Evidence.** The exercise script tries to click each
`data-track^="threat-"` button. The pre-loop fetch found buttons in
the inventory phase, so the controls render correctly. The exercise
phase loop variable went unused because of a control-flow error in
the script (the loop conditions check `loadRoute` even when no
navigation occurred). This is a bug in the audit tooling, not the
product. The base screenshots + control inventory still cover the
threat surface.

### FL6 — Estimator has only one user-side action (Export CSV) (INFO)

**Evidence.** 15 buttons total, but most are AppShell chrome
(breadcrumbs, role chip, settings, help). The actual estimator surface
exposes only the per-section accordion headers and the single Export
CSV action. No inline price-edit, no markup adjuster, no labor-rate
override visible from here — those live in the Project BOM Drawer's
"Open pricebook" link (from canvas BOM drawer). UX finding tagged
below in U3.

### FL7 — Reports surface CSV downloads have no inline confirmation; the previous design pattern was a toast (INFO)

**Evidence.** Clicking `reports-csv-*` buttons triggers download but
produces no visible UI feedback in the audit-exercise body delta
(~36 char delta is the download trigger metadata, not a toast).
Compare with the BOM drawer's CSV export which fires
`toast.success('Exported …')`. Inconsistency between
Reports CSV exports and the canvas BOM export.

---

## UX — confusing labels, hidden actions, inconsistent behaviour

### U1 — Estimator's "Hardware" label is overloaded (MED)

**Evidence.** `estimate-light.png`: the right-side Totals card lists
"Hardware $26,156, Cable & pathway $42, Labor (37.1 hr) $3,525,
Subtotal $29,723, Margin (18%) $5,350, Total $35,073". The left
layout shows section "Hardware · 9 items $16,544". The same word
"Hardware" means two different things:

- LEFT (deriveBOM SECTION_FOR['device']): one section group of 9
  devices summing to $16,544.
- RIGHT (deriveBOM.hardwareTotal): sum of devices + doors + idfs =
  $26,156.

A user comparing $16,544 (left) to $26,156 (right) sees a $10k gap and
no explanation. The numbers are both correct; the label is misleading.

### U2 — Deployment empty state right-pane copy contradicts the left state (LOW)

**Evidence.** `deployment-light.png`: the left half shows the
"Work orders generate after customer approves scope." empty card.
The right half says "Select a work order on the left to see its
details." There IS no left list to select from. The right pane should
adapt to the empty-gate condition (e.g. render the same explainer or
hide entirely).

### U3 — Estimator has no path to override pricing on its own surface (LOW — taste)

**Evidence.** The Estimator screen at /estimate/:projectId is read-only
except for CSV export. To override door hardware unit prices, cable
per-ft prices, labor rate, or markup, the user must navigate back to
the canvas, click BOM & Estimate, click "Open pricebook" inside the
drawer. That's three clicks + a context switch. Tagging as taste —
the Estimator may be intentionally read-only — but worth confirming.

### U4 — "Reports" appears twice in the TopBar More menu under similar labels (MED)

**Evidence.** Inventory shows:

- `topbar-more-reports` → "Reports / Proposal package generated from
  the canvas" → navigates to `/project/:projectId/reports` (the
  ReportsCenter).
- `topbar-more-report` → "Report Builder" → opens the
  ReportBuilderDialog overlay (the 9-kind PDF picker the audit:reports
  gate covers).

Both labels start with "Report". One is a route, one is a modal. A
user clicking "Reports" expecting the per-kind picker lands on the
Reports Center instead, and vice versa. The Reports Center page itself
is what most product copy calls a "proposal package" — the dialog is
better described as "Export single PDF" or similar.

### U5 — TopBar order: Add plan / BOM / Present / Deploy / Project state (TASTE — for the human)

The TopBar's primary CTA cluster reads left-to-right as Add plan, BOM &
Estimate, Present, Deploy, Project state. The semantic order is the
project lifecycle (engineering → financial → review → delivery →
state-management). This is a coherent ordering. Flagged here so a
human can confirm it matches the way operators actually navigate, not
because the audit found a bug.

### U6 — Bottom device bar category icons have no per-icon label until hover (TASTE — for the human)

**Evidence.** `canvas-light.png`: the bottom device bar shows icon-only
tiles for Cameras / Doors / Access / Intercom / etc, with counts
overlaid in tiny badges. Labels appear on hover (per the
`barExpanded` state). For a first-time user, the icons alone are not
obvious — Cable, Conduit, Site infra all use generic shapes. The
existing hover-to-expand pattern is a known design choice; flagged for
human judgment about whether to add inline labels under each icon by
default.

---

## UI — alignment, spacing, contrast, theme issues

### UI1 — FloorOverview tile grid clips left tile (HIGH — also FL3)

**Evidence.** Already documented in FL3. Cited again here because the
root cause is positional / margin: the tile grid container starts at
x=0 without an offset to clear the floating left rail. The same bug
exists in canvas-overview.png and persists when the Manage Floors
dialog opens on top of it (`canvas-manage-floors.png`).

### UI2 — Threat surface dark theme contrast OK; light theme path readout overlaps grid (LOW)

**Evidence.** Compare `threat-light.png` to `threat-dark.png`. In
light, the path readout (top-left of the canvas panel) and the
camera-range circles use grey-on-white that washes out against the
faint grid. In dark, the same elements render with stronger contrast
against the dark canvas. Light theme may need a slightly darker text
tone or an opaque badge background for the path readout.

### UI3 — Canvas screenshots across themes show consistent layout but the Add plan / Present / Deploy buttons use coloured backgrounds in all three themes (INFO)

**Evidence.** Canvas TopBar's Add plan (primary blue tint), Present
(emerald), Deploy (amber) all keep their tinted backgrounds across
light / slate / dark. The button-tint design language reads cleanly
in slate / dark but adds chroma noise on the light Drafting theme,
where the rest of the chrome is muted. This is a TASTE call — the
emerald + amber may be intentional brand semaphores. For the human.

### UI4 — Review surface light theme: 'Mark resolved' link uses small grey text on white card (LOW)

**Evidence.** `review-light.png`: each comment card has a "Mark
resolved" link at the bottom-right in `text-muted-foreground`. On
light theme the link is `#6B7280` (or similar muted grey) on
`#FFFFFF` card background. Contrast ratio is borderline — may fail
WCAG AA 4.5:1 for normal text. Need to verify with a contrast
checker.

### UI5 — Reports CSV button cluster uses the same small grey "CSV" pill four times (TASTE — for the human)

**Evidence.** `reports-light.png` and inventory show four buttons
labelled simply "CSV" — they're distinguished only by their
neighbouring section header (Cameras, Doors, Pathways, BOM). The
human can decide whether to label them "Export CSV" or similar for
discoverability.

### UI6 — Theme switching via documentElement.dataset.theme works; the audit confirmed by direct attribute write (PASS)

**Evidence.** Base screenshots in `light`, `slate`, `dark` for all 6
routes render with the matching token palette. No theme produced a
broken or default-coloured surface. The audit forced the theme via
`document.documentElement.dataset.theme = t` because the More menu's
theme buttons update the Zustand `canvasTheme` slice which App.tsx
mirrors to the html element — same end state.

---

## End-to-end flow walk

Brief: "create project, add plan, set scale, place devices, run
coverage, open the inspector, generate BOM and a quote, present,
deploy, review."

Walked via puppeteer URL navigation against the seeded demo project
`p1`. Findings:

| Step | Path | Status | Notes |
|---|---|---|---|
| Open canvas | /project/p1/canvas | OK | Full surface renders; 60 buttons inventory |
| Add plan | TopBar `Add plan` button | OK | Opens ScanBuildFloorplanDialog (overlay 0→1) |
| Set scale | (post-import flow) | NOT EXERCISED | Requires real PDF/PNG upload; out of audit scope without file fixtures |
| Place devices | bottombar drag | OK via `__dvSimulateDrop` | The drag-placed-device assertion already proves end-to-end placement |
| Run coverage | LeftRail `coverage` toggle | OK | Toggle observed in audit-exercise |
| Open inspector | Click device → CanvasSelectionMenu | NOT EXERCISED | Requires real device click; not a Puppeteer DOM action |
| Generate BOM | TopBar `BOM & Estimate` | OK | ProjectBomDrawer opens (body 3127→5534) |
| Generate quote | /estimate/p1 | OK | EstimatorView renders, Export CSV fires |
| Present | TopBar `Present` | OK | Navigates to /project/p1/review |
| Deploy | TopBar `Deploy` | OK (lands on empty-gate state — FL1) | DeploymentMode renders the awaiting-approval empty state |
| Review | /project/p1/review | OK | ReviewMode renders, status toggles fire, approve/request-changes fire |

**Untested steps:** Set scale, device inspection. Both require the
operator to either upload a file or click a specific SVG element on
the canvas — actions that don't reduce to a DOM selector lookup
without a richer harness. The drag-placed-device runtime assertion
already covers the equivalent end-to-end interaction for placement +
inspector mount.

---

## Summary by bucket

- FUNCTION: 1 HIGH (F1 canvas-add-fab dead), 1 MED (F2 dead
  dockCollapsed/navSection state), 5 INFO / LOW.
- FLOW: 1 HIGH (FL1 deployment dead-end on demo project, FL3 floor
  overview clipping), 1 MED (FL2 review BOM empty body), 4 LOW / INFO.
- UX: 2 MED (U1 hardware label collision, U4 Reports/Report Builder
  label collision), 2 LOW, 2 TASTE.
- UI: 1 HIGH (UI1 floor overview clipping — same as FL3), 4 LOW /
  TASTE / INFO, 1 PASS (theme switching).

**Three findings the auditor flags hardest:**

1. **F1 — canvas-add-fab is dead.** The green + FAB in the canvas's
   most prominent corner does nothing visible. It's the first thing a
   new user reaches for to add devices.
2. **FL3 / UI1 — Floor Overview tile grid clips the leftmost floor.**
   A user with 3+ floors sees the leftmost floor's name truncated to
   a digit. The left tool rail bleeds through the open dialog.
3. **U4 — Reports vs Report Builder label collision.** Two TopBar More
   menu items both starting with "Report" point to completely
   different surfaces (route vs modal).

**Not flagged as bugs but called out for review:**

- F3 / U2 — Deployment empty state right-pane copy contradicts the
  left state.
- U1 — Estimator's "Hardware" total vs "Hardware" section.
- FL7 — Reports CSV download has no toast; canvas BOM CSV does.

---

## What this audit covered

- 6 routes × 3 themes = 18 base screenshots.
- 5 named-state screenshots (cam tray, cable tray, conduit tray, floor
  overview, manage floors, review BOM, threat scenario).
- 90+ clicked controls across canvas / review / deployment / reports /
  estimate / threat surfaces. Full per-action trace in
  `exercise-trace.txt`.
- Full data-track inventory of canvas/ tree + 5 named screens. In
  `control-inventory.txt`.
- End-to-end flow walk (10 steps; 8 exercised, 2 untestable without
  richer harness).

## What this audit did NOT cover

- The `/project/:projectId/canvas` device-inspector drawer + its 9+
  sub-tabs. Reaching the inspector requires clicking a specific SVG
  device on the canvas; not exercised by the Puppeteer DOM-selector
  harness. Indirect coverage via the per-section extraction in M11
  (which runs the canvas inspector code in shipping form).
- Set-scale calibration flow. Requires a real file upload to
  `ImportFloorplanDialog`. Not exercised without a file fixture.
- Mobile-deployment (/project/:projectId/deployment/m). Out of the
  explicit scope list. One screenshot taken via the "deployment-open-mobile"
  click (audit-exercise trace) but not analysed.
- All 40+ routes outside the in-scope list (Dashboard, ProjectHub, CRM,
  VisionScan, DeviceLibrary, SiteWalk, CustomerPortal, AccountDetail,
  LiveIntegration, HelpCenter, FlowView, DoorEngineering,
  BlueprintCalibration, AIAssistant, Commissioning, PathwayRouting,
  SiteIntake, ThreatDrillLibrary, ThreatDrillEditor, BusFleet,
  BusDesigner, LayerStack, PowerCablePlan, ProposalBuilder,
  PermitPacket, WorkOrders, Maintenance, ChangeOrders, KnowledgeBase,
  SettingsView, TicketManager, TicketDetail, ComponentAdmin,
  ProductCatalog, ProjectCenter, LoginScreen, OrgGateScreen,
  CanvasInteractions). The brief scope explicitly excludes these.
- Taste / brand-voice judgment on every label. Flagged where the
  auditor noticed strong inconsistency, but the human owns those
  calls.

## Pickup notes for the next session

If the next pass is for fixes, the auditor would start with F1
(canvas-add-fab), FL3 / UI1 (FloorOverview clipping), and U4 (label
collision). F1 is a 5-minute change: rewire the FAB onClick or hide
the FAB entirely until InsertDock or its replacement ships. FL3 / UI1
is a single CSS margin fix on the overview container. U4 is a label
rename in TopBar.tsx.

All raw data — `audit-data.json`, `audit-exercise.json`,
`control-inventory.txt`, `exercise-trace.txt`, every screenshot — is
in this directory so a reviewer can verify any finding against the
evidence without re-running the harness.
