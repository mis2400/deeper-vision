# MVP Acceptance Checklist

Functional reviewer audit for the Deeper Vision MVP foundation. Each item carries
a status, a manual verification step, and the file(s) it lives in. Update the
"Last verified" footer whenever you re-run the checks.

Status legend: `Done` · `In progress` · `To-do` · `Not in scope`.

**Verification legend (used in Section 6 and later):**
- **UI-verified** — exercised via a real `.click()` / `input` event dispatched against the rendered DOM, then re-read from the same DOM. This is the strongest signal short of a human cursor.
- **Store-verified** — exercised via `useProjectStore.getState().xxx(...)` (i.e. bypassing the React handler chain). Proves the persistence pipeline works but doesn't prove the UI control is wired correctly.
- **Not yet verified** — left unchecked because no automated harness exercised it this pass. Items here should be the first thing a manual human reviewer hits.

---

## 1 · Intake creates real, persisted records

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| INT-1 | `SiteIntake` finish creates a `Customer`, primary `Contact`, `Project`, `Site`, `Building`, and `Floor` in the store | Done |
| INT-2 | New project's `id` is used in the redirect to `/calibrate/:projectId` (no `/calibrate/new` ghost route) | Done |
| INT-3 | After a hard refresh, the new Customer / Project / Site / Building / Floor are still in the store | Done |
| INT-4 | New project is visible in `/dashboard` (project list reads from the store) | Done |

**Manual verification.**
1. Open `/intake`, fill required fields (company, contact name, site address, ZIP), click through Site → Threat → Compliance → Review → Finish.
2. Confirm the URL becomes `/calibrate/<some-id>` where `<some-id>` is not the literal string `new`.
3. Hit reload. Navigate to `/dashboard`; the new project must appear with the entered name.
4. Open DevTools → Application → Local Storage → `deeperVisionStore`. Search for the entered company name; entries for `customers`, `contacts`, `projects`, `sites`, `buildings`, `floors` must all reference the new ids.

---

## 2 · Calibration writes a real scale and survives refresh

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| CAL-1 | `BlueprintCalibration` writes `scalePxToFt = realFeet / pxDist` to the project's active `Floor` | Done |
| CAL-2 | If a floorplan image is uploaded, it is persisted into `floor.background` via the existing background mechanism | Done |
| CAL-3 | After "Open canvas" the canvas opens the same project's floor with the calibrated scale already in place | Done |
| CAL-4 | After refresh on the canvas page, `floor.scalePxToFt` and `floor.background` are still set | Done |

**Manual verification.**
1. Continue from INT step 4 (you should be at `/calibrate/<projectId>`).
2. Upload a floorplan PNG/JPG (any small image works).
3. Click two known points and enter the real-world distance in feet (e.g. 10).
4. Click "Open canvas".
5. In DevTools storage, confirm the project's floor has `scalePxToFt` set to a non-zero number and `background.dataUrl` populated.
6. Hard refresh the canvas page; the floorplan must still be visible and the scale unchanged.

---

## 3 · Canvas selection + Edit are reliable

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| SEL-1 | Every plotted device renders with a stable `data-testid="device-<id>"` and `data-track="device-<id>"` | Done |
| SEL-2 | Every plotted device has a transparent hit-circle large enough (~ touch target) to click reliably without pixel-hunting the glyph | Done |
| SEL-3 | Clicking a device shows the minimal SelectionPill (identity + Expand + Edit) | Done |
| SEL-4 | Edit opens the right-side inspector drawer scoped to the clicked device | Done |
| SEL-5 | No visible no-op actions in the Expand menu (Lock is removed until implemented) | Done |
| SEL-6 | Camera coverage slider change in the inspector persists across refresh | Done |

**Manual verification.**
1. On the canvas, click a camera (`CAM-101` from the seed). The minimal pill must appear above the glyph.
2. Click "Edit" in the pill. The right drawer must open with the CAM-101 inspector tiles.
3. In DevTools, run `document.querySelector('[data-testid="device-CAM-101"]')` — it must return the `<g>` element.
4. Open the Expand menu (the `⋯` / "More" button on the pill). Confirm `Lock` is gone; `Duplicate / Color / Stack / More details / Delete` remain.
5. In the inspector's Coverage tile, drag the FOV/range slider. Refresh. Re-select CAM-101 and confirm the coverage value held.

---

## 4 · Calibrated pathway lengths + real CSV export

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| PW-1 | Shared `pathwayLengthFt(pathway, floor)` helper exists and is the single source of truth | Done |
| PW-2 | `deriveBOM` uses the per-floor scale, not a hardcoded 20 px/ft | Done |
| PW-3 | Canvas bundle/pathway labels show the calibrated length | Done |
| PW-4 | `PathwayDrawer` shows the calibrated length | Done |
| PW-5 | Visible bug "PW-1 shows 0 ft despite having points" is fixed | Done |
| PW-6 | `EstimatorView` "Export CSV" downloads a real CSV generated from `deriveBOM` | Done |
| PW-7 | Any other export/send button that is not implemented is disabled or labeled `Coming soon` | Done |

**Manual verification.**
1. After calibration above, on the canvas open the Cabling tray, pick Cat6A, plot a multi-vertex cable run between two devices and double-click to finish.
2. The pathway label in the canvas, the entry in PathwayDrawer (right side, Pathway tab), and the line in `/project/<id>/estimate` must all show the same nonzero foot count, derived from the calibrated scale.
3. Click `Export CSV` on the Estimator. A `.csv` file must download with one row per BOM line, with quantity, unit, unit cost, and extension columns.
4. Confirm any sibling "Send to AP" / "Send to PM" buttons (if present) are either disabled or relabeled.

---

## 5 · Build / runtime smoke

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| BLD-1 | `npm run build` exits 0 (type-checks pass) | Done |
| BLD-2 | `/intake` → `/calibrate/:projectId` → `/project/:projectId/canvas` flow works in a fresh localStorage | Done |
| BLD-3 | No console errors on the canvas page after the flow | Done |

---

## Out of scope this pass (do not re-open)

- Visual redesign / typography / colour passes
- Threat Drill, Bus Designer, AI-Compliance, CRM, Quote/Proposal screens
- Marketing site / `deepervision-ai`
- Any new module

---

## 6 · Canvas / Surveyor — object-driven workflow

| ID | Acceptance criterion | Status | Evidence |
|----|----------------------|--------|----------|
| CV-1 | Every visible camera/IDF/reader/sensor renders with `data-testid="device-<id>"` and `data-track="device-<id>"` | Done | UI-verified |
| CV-2 | Every visible door-class device (`inf.door-*` / `inf.gate*` / `inf.storefront*` / `inf.doubledoor*`) renders with `data-testid="door-<id>"` | Done | UI-verified |
| CV-3 | Every pathway label renders with `data-testid="pathway-<id>"` and `data-track="pathway-<id>"` (bundle + standalone) | Done | UI-verified |
| CV-4 | Every device has a 36 × 36 px transparent hit-circle (`circle[data-hit="device"]`) so clicks register without pixel-hunting | Done | UI-verified |
| CV-5 | Selection toolbar (SelectionPill) stays minimal: identity + essential quick actions + Expand + Edit. No visible no-op actions | Done | UI-verified |
| CV-6 | The Lock action is gone from the SelectionPill expand menu (re-add once `updateDevice({locked:true})` is wired) | Done | UI-verified |
| CV-7 | Clicking Edit opens the EditDrawer scoped to the selected device | Done | **UI-verified** (real `.click()` on the device's outer `<g>` → SelectionPill mounts → `.click()` on the `Edit` button → EditDrawer renders for CAM-101 with the General tab active) |
| CV-8 | Camera FOV / range / rotation edits persist after refresh | Done | **UI-verified** (real `input` event on the FOV / range / rotation `<input type="range">` sliders in the Coverage tile → `localStorage.deviceCAM-101 = {fov:98,range:72,rot:42}` → page reload → re-open inspector → all three sliders re-mount at 98 / 72 / 42) |
| CV-9 | Multisensor lens A/B/C/D rotation / FOV / range / focal / enabled persist independently after refresh | Done | Store-verified (`updateDevice('CAM-103', { lenses:{...,a:{rotation:25,fov:110,range:70,focal:2.8,enabled:true}} })` survives reload; per-lens slider UI not driven by this pass — see CV-23 follow-up risk) |
| CV-10 | Door assembly choices (reader / strike / maglock / rex / dps / contact / intercom / panic / autoop / controller / psu) persist as `device.doorAssembly[]` after refresh | Done | **UI-verified** (real `.click()` on `[data-testid="door-assembly-reader"]` and 5 sibling buttons after the per-toggle-fresh-read fix → `doorAssembly:["reader","strike","rex","dps","controller","psu"]` → reload → all 6 still present) |
| CV-11 | Door electrification (fail-safe / fail-secure) and reader location (mullion / wall) persist after refresh | Done | **UI-verified** (real `.click()` on `[data-testid="door-elec-fail-secure"]` + `[data-testid="door-readerloc-mullion"]` → both survive reload) |
| CV-12 | Pathway source / destination / cable type / conduit / notes persist after refresh | Done | Store-verified (`updatePathway('PW-1', { cableType:'fiber-mm', notes:'…' })` survives reload; the PathwayDrawer sub-tab inputs weren't individually driven this pass) |
| CV-13 | `PW-1` renders a nonzero calculated length whether or not the seed includes `lengthFt`, using the calibrated `floor.scalePxToFt` (canvas labels + PathwayDrawer header + Estimator BOM all agree) | Done | UI-verified (drawer header shows `… · 10 ft` on default scale; `… · 25 ft` after `updateFloor` to 0.125 ft/px) |
| CV-14 | New tile **Survey** is present in every device EditDrawer (camera/door/reader/IDF/cable) and in the PathwayDrawer Notes tab | Done | UI-verified (`[data-track="drawer-tab-survey"]` resolves; PathwayDrawer Notes tab renders `SurveyPanel`) |
| CV-15 | Adding a survey note to a camera persists across refresh and stays linked to that camera's id | Done | UI-verified (typed in `[data-testid="survey-input"]`, clicked `[data-testid="survey-add-btn"]`, item appears as `[data-testid="survey-item-…"]`, survives reload) |
| CV-16 | Survey items carry `id / projectId / floorId / objectType / objectId / kind / text / status / author / createdAt / updatedAt`. Photo metadata is stored honestly with a "upload pending" disclosure | Done | Store-verified — schema enforced by the TypeScript `SurveyItem` interface |
| CV-17 | Survey items appear in `state.surveyItems` and survive `localStorage` reload (persist v5) | Done | UI-verified (note added via UI → `JSON.parse(localStorage.getItem('deeperVisionStore')).version === 5` and the item is in `state.surveyItems`) |
| CV-18 | A device's headline `surveyStatus` (`todo / verified / issue / skip`) persists | Done | Store-verified (`updateDevice({surveyStatus:'verified'})` → reload → held); UI buttons exist (`[data-testid="survey-status-*"]`) but weren't individually clicked this pass |
| CV-19 | Inspector Overview tab shows an Impact preview with material lines, labor hours, and (for cameras) PoE draw, pulled live from `deriveBOM` | Done | UI-verified (Overview tile renders the live BOM matches; door variant adds the `Door assembly impact · N` block with `[data-testid="impact-door-*"]` rows) |
| CV-20 | Calibration scale changes propagate immediately into pathway labels + the Impact preview | Done | UI-verified (changing `floor.scalePxToFt` → drawer header relabels `25 ft`) |
| CV-21 | A v4 → v5 persist migration adds the empty `surveyItems` slice and inverts any pre-fix `scalePxToFt` that was stored as px-per-ft (> 1) back to ft-per-px | Done | Store-verified (migration code path is exercised when an old persist is loaded; not driven by a real legacy fixture this pass) |
| CV-22 | The Estimator's Cable & pathways section continues to show `CAT6A · 2× · 10 ft · $16` (helper unchanged) | Done | UI-verified (Estimator route screenshot shows the line) |

## 7a · Calibrated measurement hardening

| ID | Acceptance criterion | Status | Evidence |
|----|----------------------|--------|----------|
| MS-1 | `Floor` type carries explicit calibration metadata: `calibratedAt`, `calibrationReferenceFt`, `calibrationMeasuredPx` (all optional) | Done | Code-verified (`src/app/store/types.ts`) |
| MS-2 | `BlueprintCalibration` Confirm writes `scalePxToFt` + `calibratedAt` + `calibrationReferenceFt` + `calibrationMeasuredPx` to the active floor | Done | Code-verified (`src/app/screens/BlueprintCalibration.tsx` Confirm onClick now writes all four) |
| MS-3 | Scale-bar "calibrated vs. default" decision uses `floor.calibratedAt`, **not** `scalePxToFt !== 0.05` | Done | UI-verified — 4-case matrix:<br>• `0.05 + no calibratedAt` → **Default scale chip** (correct)<br>• `0.125 + calibratedAt` → no chip (correct)<br>• `0.05 + calibratedAt` → no chip (correct — defeats the old 0.05 check)<br>• `calibratedAt` cleared again → **Default scale chip** (correct) |
| MS-4 | Inspector Position row uses `floor.scalePxToFt` | Done | UI-verified — CAM-101 at (260, 220) reads `13.0, 11.0 ft` at seed scale (0.05) and `32.5, 27.5 ft` after `updateFloor({scalePxToFt: 0.125, calibratedAt: …})` |
| MS-5 | PathwayDrawer header length uses `floor.scalePxToFt` | Done | UI-verified — PW-1 reads `CAT6A · 10 ft` at seed scale and `CAT6A · 25 ft` at 0.125 ft/px |
| MS-6 | Drag HUD nearest-distance label uses `floor.scalePxToFt` | Done | Code-verified — `(nearest.d * currentFloorPxToFt).toFixed(1) ft` |
| MS-7 | Drag HUD device X / Y readout uses `floor.scalePxToFt` | Done | Code-verified — `(movingDev.x * currentFloorPxToFt).toFixed(1) · (movingDev.y * currentFloorPxToFt).toFixed(1) ft` |
| MS-8 | Drag HUD nearest neighbour readout uses `floor.scalePxToFt` | Done | Code-verified — `${nearest.id} · ${(nearest.d * currentFloorPxToFt).toFixed(1)} ft` |
| MS-9 | Camera dimension chains use `floor.scalePxToFt` | Done | Code-verified — `(dist * currentFloorPxToFt).toFixed(1)′` |
| MS-10 | Measure tool live distance uses `floor.scalePxToFt` | Done | Code-verified — `const ft = distPx * currentFloorPxToFt` |
| MS-11 | Live cable-draw running length uses `floor.scalePxToFt` | Done | Code-verified — `const ft = lengthPx * currentFloorPxToFt` |
| MS-12 | DORI / prosecution distance readout uses `floor.scalePxToFt` (via the camera's `floorId`) | Done | Code-verified — `TargetSimOverlay` subscribes to `ftPerPxForFloor(s.floors[d.floorId])` and computes `distFt = dist * pxToFt` |
| MS-13 | Grid-snap behaviour stays on the 20 px visual grid (this is a visual choice, not a measurement) | Done | Code-verified — sites at lines 1464–1465, 1721–1722, 1744–1745, 1752–1753, 5198–5199 all still use `Math.round(* / 20) * 20`. Snap only governs vertex placement; every displayed foot value is calibrated |
| MS-14 | Zero remaining hardcoded `/20` displayed-foot conversions in `EngineeringCanvas.tsx` | Done | Code-verified — `grep -n '/ 20\|/20\b'` returns only grid-snap sites + Tailwind opacity classes (`bg-secondary/20`) + the helper's own doc comment |
| MS-15 | No floor-typed `as any` casts remain in code touched by this pass | Done | Code-verified — `grep "as any"` in EngineeringCanvas returns 0 floor-field hits (the remaining hits are device-id casts on unrelated code paths, out of scope for this pass) |

## 7 · Canvas / Surveyor — hardening pass

| ID | Acceptance criterion | Status | Evidence |
|----|----------------------|--------|----------|
| HV-1 | `DoorHardware` type includes every option exposed in the UI (added `'dps'`) | Done | UI-verified (toggling `dps` writes `'dps'` into `doorAssembly[]` with no TS errors at build) |
| HV-2 | `DoorAssemblySection` reads/writes via typed `Device.doorAssembly / doorElectrification / doorReaderLocation` — no `as any` casts | Done | Code-verified (grep returns 0 hits inside the section) |
| HV-3 | `SurveyPanel` uses the typed `SurveyItemStatus` for its `deviceStatus` prop instead of an inline string union | Done | Code-verified |
| HV-4 | Door / opening devices no longer expose the legacy ghost-accessory "Add hardware" path in `StackSectionForHost`; the panel renders nothing for empty doors and read-only legacy chips for any leftover ids | Done | UI-verified (door's Stack tab now shows only the DoorAssemblySection — the old grid of `+ Reader / + Strike / …` buttons is gone) |
| HV-5 | Non-door hosts (IDF / MDF / rack) keep their Add hardware switch/patch/UPS path | Done | Code-verified (branch retained for `!isDoor` hosts) |
| HV-6 | A canonical `DOOR_HARDWARE_PRICE` map exists in `projectStore` keyed by every `DoorHardware` value, with explicit price + labor + desc | Done | Code-verified (exported constant covers all 11 options) |
| HV-7 | `deriveDoorAssemblyLines(device)` helper produces per-component `lines + laborHours + hardwareTotal` from a Device's `doorAssembly` | Done | UI-verified (Impact preview uses it; six rows for a six-item assembly with totals that match the table) |
| HV-8 | `deriveBOM` rolls every door-as-Device `doorAssembly` entry into individual `sourceKind: 'door'` lines (one per component) so the Estimator surfaces them under Access control · doors | Done | UI-verified (Estimator screenshot shows `DOOR-101 · Card / mobile reader $285`, `DOOR-101 · Electric strike $540`, etc., 6 new lines totalling the expected $2,530) |
| HV-9 | Door inspector's Overview tab shows a "Door assembly impact" block when `doorAssembly.length > 0`, with per-component price + labor and a hardware subtotal | Done | UI-verified (`[data-testid^="impact-door-"]` returns 6 rows; "Hardware subtotal $2,530" is rendered) |
| HV-10 | Impact preview clearly labels itself as **preview only** so it's not mistaken for a customer-ready estimate | Done | UI-verified (footer reads "Preview only — derived from DV's internal price/labor defaults. Recalibrate against your pricebook before sending a customer estimate.") |
| HV-11 | Real native `.click()` on a device's outer `<g>` selects it. Hardening: `onClick` was added in parallel with `onPointerDown` so plain clicks + screen readers + mobile taps don't depend on pointer capture; `setPointerCapture` is wrapped in `try/catch` so synthetic / invalid pointerIds no longer swallow the selection | Done | **UI-verified** (`document.querySelector('[data-testid="device-CAM-101"]').dispatchEvent(new MouseEvent('click', {bubbles:true,button:0}))` → SelectionPill + Edit button both render) |
| HV-12 | `DoorAssemblySection.toggle()` reads the latest `doorAssembly` from the store on every click (functional update) instead of from a stale closure, so rapid toggles compose | Done | UI-verified (6 sequential `.click()`s on different hardware buttons in the same tick all land in `doorAssembly` after the fix) |

**Manual verification.**
1. Clear localStorage. Open `/project/p1/canvas`. Confirm:
   - `document.querySelectorAll('[data-testid^="device-"]').length === 8`
   - `document.querySelector('[data-testid="pathway-PW-1"]')` is non-null.
2. From the browser console, run `window.__projectStore.getState().addDevice({ id: 'DOOR-101', type: 'inf.door-single', projectId: 'p1', floorId: 'b1-f1', label: 'Main entry', product: '', x: 300, y: 130, rot: 0 })`. Confirm `document.querySelector('[data-testid="door-DOOR-101"]')` exists.
3. Click CAM-101 → the minimal SelectionPill appears with `Edit / FOV / Rotate / Duplicate / ⋯` (no Lock).
4. Click Edit → inspector opens with `General · Placement · Coverage · Power · Network · Accessories · Compatibility · Notes · Media · History · Stack · AI · Survey`.
5. In Coverage, change FOV → reload page → value held.
6. For CAM-103 (the seeded multisensor) change Lens A rotation → reload → value held.
7. Open the Survey tab on CAM-101, add a note, reload, re-select CAM-101, open Survey — the note is still there with timestamp + Field demo author.
8. Click DOOR-101 → Edit → Stack tab → "Door assembly" checkboxes toggle. Toggle Reader + Strike + REX → set Electrification = fail-secure → reload → choices held.
9. Click the PW-1 polyline → drawer opens, header shows `CAT6A · 10 ft · CAM-101 → IDF-1`. Switch to Notes → add a survey note → reload → note held.
10. In a console, call `window.__projectStore.getState().updateFloor('b1-f1', { scalePxToFt: 0.125 })` → re-open PW-1 drawer — header now reads `… · 25 ft`. Confirms calibration flows.

---

## 8 · Phase 2 — AI Assistant + Threat Simulator V1

Two killer features that prove the operational-intelligence positioning. Every claim is grounded in live project state; no fake LLM, no invented risk numbers, no fake confidence.

### 8a · AI Assistant (`/ai/:projectId`)

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| AI-1 | Conversation history persists per project across reload (`aiConversations` slice + partialize + v9 migration + 50 conv / 200 msg / 32 KB text caps) | Done |
| AI-2 | Streaming responses feel instant — first token under 500 ms perceived | Done — engine streams 4-20 char chunks at ~14 ms cadence |
| AI-3 | Sidebar: new conversation + delete with confirm; mobile drawer toggle below `lg` | Done |
| AI-4 | Empty state surfaces three project-aware example prompts derived from live device / IDF / WO counts | Done |
| AI-5 | Context awareness — any shipped surface (canvas / review / reports / deployment / dashboard) broadcasts surface + site + floor + selection. Engine narrows answers to that scope. Operator can clear or broaden plainly ("across all floors") | Done |
| AI-6 | Source citations — every project-data claim carries an inline chip; chip click navigates to the owning surface; canvas honors `?focus=` deep-select. Truncation at 8 with explicit "+N more" | Done |
| AI-7 | Inference label renders on generalizations (coverage / PoE answers are tagged) | Done |
| AI-8 | Confidence chip (High / Medium / Low) on judgment responses only, with mandatory tooltip. Low triggers "Would you like me to verify?" follow-up | Done |
| AI-9 | Six apply-action types: add-device, resolve-event, assign-workflow, create-note, schedule-check, generate-report. Each runs a real store mutation, logs the outcome on the message, ships an Undo affordance | Done |
| AI-10 | Voice input via Web Speech API. Mic button hides when unsupported. Seven distinct error codes mapped to one-line operator messages — no generic "Recognition error" | Done |
| AI-11 | Mobile layout at 375 px portrait: sidebar collapses to drawer, sticky input, mic + send reachable. Uses `100dvh` so the iOS keyboard doesn't push the input off-screen | Done |

### 8b · Threat Simulator (`/threat/:projectId`)

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| TS-1 | Deterministic scenario engine: same scenario + same state always produces same score. Every gap is grounded in real camera positions + declared range | Done |
| TS-2 | Library carries 12 scenarios across perimeter / tailgate / loading / social / vehicle / IT closet / asset removal / late-night / after-action — covers the brief minimum of 10 | Done |
| TS-3 | Path animates continuously on the canvas at 60 fps via requestAnimationFrame. Actor dot interpolates between hops; pulsing halo telegraphs movement | Done |
| TS-4 | Camera coverage circles render at real device positions with real range. Active cameras (in range of the live actor position) tint emerald in real time | Done |
| TS-5 | Exposure score animates live as the path plays. Tied to elapsed engine math, not arbitrary | Done |
| TS-6 | Breakdown panel lists every gap hop with its exposure contribution + a recommended hardening action | Done |
| TS-7 | Time scrubber: range input + step-back / step-forward buttons. Scrub pauses playback to avoid input fights | Done |
| TS-8 | "Harden on canvas" per breakdown row with 4 hint kinds (camera, access, motion, lighting) assigned by hop position. Canvas reads `?hint=…` and renders an anchor overlay that auto-clears on placement | Done |
| TS-9 | Print threat report PDF: cover, scenario summary, scored severity, path snapshot (vector), contributing factors, hardening recommendations. Customer / project name in cover stripe | Done |
| TS-10 | Capture baseline + before/after comparison: two score tiles, delta in pts, list of gaps closed by hardening, list of any newly opened gaps. Saved into the PDF when present | Done |

**Manual verification.**
1. `/ai/p1`. Click "What is the BOM total" prompt. Response streams, citations appear ("Reports", project), confidence chip High visible.
2. Ask "tell me a joke". Response refuses cleanly. Low confidence chip. "Would you like me to verify?" link appears (purely cosmetic for refusal, but confirms the gate fires).
3. Click "where are the coverage gaps". Apply suggestions appear: "Drop a camera on Level 2" and "Schedule a coverage re-walk in 7 days". Click the camera one — device count goes 5 → 6, chip flips to "Applied", Undo button visible. Click Undo — back to 5, "Undone" footnote rendered.
4. Open canvas with `?focus=CAM-101` — CAM-101 starts selected.
5. Open the persona popover, switch persona — chip dot color changes. Open the assistant — context chip carries the surface name.
6. `/threat/p1`. Click "Play" — actor dot moves, coverage circles light up emerald as the camera in range sees it, score animates.
7. Drag the time scrubber — playback pauses, actor jumps to that point, score recomputes for elapsed hops.
8. Click "Harden on canvas · lighting" on a breakdown row — canvas opens, overlay reads "Threat Simulator suggested fix · Add a perimeter light at Rear service door for deterrence."
9. Click "Capture baseline" → "Print threat report" — PDF carries the scenario, path snapshot, factors, AND a before/after section (no change yet since nothing was hardened in between).
10. Drop a camera near the Rear service door on the canvas. Return to threat simulator. Score is lower. Before/after panel shows the delta + lists "Closed by hardening".

---

## 9 · Phase 3 — Settings buildout for enterprise readiness

Seven tabs that take Settings from a profile page to a real V1 enterprise surface. Every channel that needs backend reach is honest about what works today vs. what ships with the auth / billing / notification backends. The Advanced tab also relocates the prior "Reset demo" escape hatch off the Projects header.

### 9a · Account (3A)

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| ST-A1 | Profile fields (full name, email, job title) persist via `userPrefs` slice | Done |
| ST-A2 | Theme 3-way (Light Drafting / Slate Engineering / Dark Command) writes `data-theme` on `<html>` | Done |
| ST-A3 | Density 2-way (Comfortable / Compact) writes `data-density` + `--density-y` token | Done |
| ST-A4 | Accent color picker overrides `--primary` CSS variable inline; preset swatches with theme-default reset | Done |
| ST-A5 | Language + Time zone selects with live `Intl.DateTimeFormat` preview row | Done |

### 9b · Billing (3B)

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| ST-B1 | Three plans (Starter / Studio / Enterprise) with feature lists + per-seat pricing | Done |
| ST-B2 | Monthly / Annual toggle with derived "Save N%" indicator | Done |
| ST-B3 | Live usage meters (Projects / Seats / Storage) derived from real store data, tint amber > 80% + rose over | Done |
| ST-B4 | Payment method form with local Luhn check + brand detection; persists last4 + brand + expiry only | Done |
| ST-B5 | Invoice history with "Generate this period's invoice" + per-row PDF export | Done |

### 9c · Integrations marketplace (3C)

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| ST-C1 | 14 connectors across 7 categories (accounting / CRM / field service / communications / VMS / access control / pricing) | Done |
| ST-C2 | Search + category filter | Done |
| ST-C3 | Connect / Disconnect persists; Sync stamps lastSyncAt | Done |
| ST-C4 | Connect toast is explicit: "connection saved locally. Real OAuth lands with backend." | Done |

### 9d · Team (3D)

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| ST-D1 | Member directory table with role picker, status pill, last-active, remove | Done |
| ST-D2 | Invite modal with email + display name + role; validates + persists as `inviteStatus: pending` | Done |
| ST-D3 | Role definitions panel lists 6 built-in roles + notes custom roles ship Enterprise | Done |
| ST-D4 | Bulk CSV invite parser: tolerates header, validates email, skips duplicates, defaults missing role to engineer | Done |

### 9e · Notifications (3E)

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| ST-E1 | 14 event types across 6 groups (Projects / Field / Threat / Billing / Team / Digests) | Done |
| ST-E2 | Per-event routing across 5 channels: email cadence (immediate/daily/weekly/off), in-app, push, Slack, Teams | Done |
| ST-E3 | Slack / Teams checkboxes disabled when the integration isn't connected; tooltip points at Integrations | Done |
| ST-E4 | Channel readiness summary panel | Done |

### 9f · Security (3F)

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| ST-F1 | Compliance badges (SOC 2 / ISO 27001 / GDPR / HIPAA BAA) with honest status | Done |
| ST-F2 | Data residency 3-way (US / EU / ANZ) | Done |
| ST-F3 | SSO config — SAML metadata URL or OIDC issuer / clientId / clientSecret + auto-enroll email domains | Done |
| ST-F4 | SCIM endpoint generator + bearer token reveal + rotate action | Done |
| ST-F5 | API keys — create with scope picker, secret shown once, revoke action | Done |
| ST-F6 | Webhooks — URL + event multi-select + signing secret last 4 stored + test ping with simulated 200/502 | Done |
| ST-F7 | Audit log — every security touchpoint logs an entry; filters by user / action / 7/30/90/all days; CSV export | Done |
| ST-F8 | Two factor authentication — TOTP secret + 8 recovery codes generated once | Done |
| ST-F9 | Active sessions — current device seeded from navigator.userAgent; sign-out-others flips others to revoked | Done |

### 9g · Advanced (3G)

| ID | Acceptance criterion | Status |
|----|----------------------|--------|
| ST-G1 | Workspace identity — name, logo upload (≤256 KB embedded as data URL), brand color picker, custom domain with hostname regex | Done |
| ST-G2 | Developer mode toggle persisted to `workspaceSettings.devMode` | Done |
| ST-G3 | Data export — full JSON dump of every persisted slice, downloads via Blob URL, logs audit entry | Done |
| ST-G4 | Reset demo data relocated from ProjectHub header to this tab | Done |
| ST-G5 | Delete workspace — "type delete to confirm" modal, clears persisted store, reloads | Done |

**Manual verification.**
1. `/settings`. Profile fields, theme/density/accent live changes, time zone preview.
2. Billing → click violet swatch on Account first, see accent travel into Billing; click Annual cycle → "Save 20%" appears; click Studio plan card → currently selected; generate an invoice → row appears + PDF downloads cleanly.
3. Add a Visa test card (4242 4242 4242 4242 / 12/29 / 123) → persists as `last4=4242, brand=visa`.
4. Integrations → search "verkada", click Connect → toast "connection saved locally. Real OAuth lands with backend." Click Sync → "Synced just now" appears.
5. Team → invite mei@deepervision.com → row appears as pending; mark accepted → status flips; CSV bulk invite a 2-row CSV → counts shown in toast.
6. Notifications → flip "Threat high exposure" email cadence to Weekly → persists; Slack checkbox disabled until you Connect Slack on Integrations.
7. Security → Enable SSO + OIDC → fill issuer / clientId → Save → audit entry "SSO config updated" logged. Generate SCIM endpoint → URL + token revealed → Rotate → new token + audit entry. Create API key → secret shown once banner → copy + dismiss → key row shows prefix only. Create webhook → secret last4 in toast → test ping → simulated 200 logged + audit entry. Filter audit log by user → CSV exports the visible rows. Enable 2FA → recovery codes appear. Sessions → "Sign out other sessions" → audit entry "Other sessions signed out".
8. Advanced → upload a small PNG logo → embedded; pick a brand color; type "portal.example.com" custom domain → Save → toast. Export workspace data → JSON file downloads with all slices. Reset demo data → confirm → seed projects restored, your Settings choices preserved. Delete workspace → type "delete" → reloads with fresh store.

---

## 10 · Canvas V2 Pass 1 — Trust Restoration

Goal: an operator using the Canvas trusts it. Nothing dishonest, work cannot be lost without recovery, selection + action primitives work as expected, locked items stay locked, the canvas behaves like a tool.

Sub passes shipped on `main`:

| Pass | Commit | What |
|---|---|---|
| 1.0 | 9827eefe | Stop lying. Hid the dead Media + History drawer tabs, the inert TopBar Floor dropdown, the "Use an address" mocked card, the ScanBuild satellite + demo scan cards, the AddFloor satellite source, "DWG / DXF" false-format copy, bottom dock "coming soon" disabled buttons, heuristic-suggestion disabled-button pattern. Zero dead controls remain in the canvas chrome. |
| 1.1 | 8107c455 | Undo / redo. New canvasHistory slice (store v17 → v18). 50 step in memory, 20 persisted. Snapshot based. Auto label derivation in setDevices facade. Walls migrated from local state to store. Cmd Z, Shift Cmd Z, Ctrl Y. Toolbar buttons + toast feedback. |
| 1.2 | 96e813f2 | Lock enforcement. setDevices facade refuses removes + updates on lockedIds. "N locked items skipped" toast. Lock toggle in SelectionPill with primary tone when locked. |
| 1.3 | 18d98b3f | Selection primitives. Marquee + Shift click already existed; added Cmd / Ctrl click toggle, Cmd / Ctrl A (Shift includes locked), Esc clears both selId and selIds. |
| 1.4 | b49eac87 | Copy / paste / duplicate. Cmd C / V / D. In memory clipboard. Multi select aware. linkedIds and stack dropped from clones. Refs let the keyboard handler stay bound once. |
| 1.5 | 82d57357 | Alignment + distribute. Six align buttons (L / centre-H / R / T / centre-V / B) and two distribute buttons (≥3 selected). Single grouped undo per action. |
| 1.6 | 62c5affe | Arrow nudge. 1 unit per press, 10 with Shift. Multi select moves as a group. Focus aware (skips inputs). |
| 1.7 | 1fde908c | Door hardware no longer orphans on the floor. 120 unit fallback auto attach to nearest door; honest reject if no door nearby. |
| 1.8 | af1dc899 | Persistent tape measure. New measurements slice (store v18 → v19). Click two points to commit; multiple concurrent measurements; click label to remove one; Hide all / Show all / Clear all in the measure tool banner. Labels recompute against the floor's live scale on every render. |
| 1.9 | d659ce3c | Cmd K search + command bar. Searches devices / pathways / IDFs by id / name / type. Common commands (Select all cameras / doors / readers, Fit, Centre, Show/Hide measurements, Toggle layers, Undo, Redo). Click result to select + pan to position. |

### Verification done this pass

- **Build**: `npm run build` green after every sub pass commit.
- **Cold load**: `/project/p1/canvas` loads with zero console errors.
- **Honesty sweep (post 1.0)**: live DOM grep returns zero hits for "Media", "History", "Preview only", "not wired", "coming soon", "DWG", "DXF", "Demo workflow", "stylised preview".
- **Undo/redo round trip (post 1.1)**: store level test confirmed `addDevice → canvasUndo → device removed → canvasRedo → device restored`. Cmd Z dispatched via `window.dispatchEvent` correctly pops past and pushes future.
- **Cmd K overlay (post 1.9)**: opens via `window.dispatchEvent` of Cmd K. Shows COMMANDS section + DEVICES (RECENT) with the seeded CAM-101 / CAM-102 at their store coordinates.
- **Browser smoke**: visually confirmed honest Floor badge, two card import dialog, Cmd K overlay layout, undo / redo toolbar buttons enabled / disabled state.

### Known follow ups not addressed in Pass 1

- Per device lock badge on the canvas glyph (selection pill covers the active case; non selected case relies on the Layers panel).
- Right click context menu on a device (lock toggle still reachable via selection pill + Layers panel).
- Door place: doors aren't placed directly on the canvas today (they come from VisionScan import), so the door place mutation is not yet wrapped in pushCanvasHistory. When the canvas grows a direct addDoor path, wrap it the same way devices are.
- Linked relationship deep clone on duplicate (door + its hardware stack as one clone). Pass 1.4 explicitly drops linkedIds + stack on clones to avoid cross wired references.
- Walls and pathways are not lockable today because lockedIds keys by device id. The ref pattern from Pass 1.2 extends when they gain per item lock state.
- Mobile / touch fallback button for Cmd K. Today the bar is meta / ctrl key only.

### Risk notes for post deploy smoke test

- The setDevices facade now snapshots into history before each mutation. If an existing flow was calling setDevices in a tight loop without coalescing, that could inflate history. Spot check: open Layers panel, marquee select 20 devices, drag — past stack should grow by 1, not 20.
- Walls migration: local wall state is gone. VisionScan imports already wrote to Floor.walls so existing imported walls render unchanged. New walls drawn through the wall tool now persist across reload; verify by drawing a wall, navigating away, returning.
- Store v17 → v18 → v19 migration is forward-only. Persist key `deeperVisionStore`. Users with v16 or earlier get the chained `canvasHistory` + `measurements` slices written on first hydrate; their existing data is untouched.

## 11 · Canvas V2 Pass 2 — Multi floor + Coverage + Rooms + Annotations

Goal: an operator can design a real multi floor building with confidence. Devices placed on floor 3 stay on floor 3. Each floor can have its own blueprint and scale. Camera + non camera coverage are visible with gap detection. Rooms are first class entities. Annotations let operators communicate intent on the canvas.

Sub passes shipped on `main`:

| Pass | Commit | What |
|---|---|---|
| 2A.1 | cfc02e7c | Floor model: required projectId + createdAt, currentFloorIdByProject slice, v19→v20 migration, p1 Basement seeded |
| 2A.2 + 2A.3 | d61743d7 | Real floor dropdown (descending elevation), Cmd↑/↓ nav, canvas filters per floor, pathway filter, selection clears on switch |
| 2A.4 | c80dc595 | Upload + pathway commit + run-to-IDF + dock counts target active floor; per-floor blueprint + per-floor calibration verified |
| 2A.5 + 2A.6 | 01a78111 | Manage Floors dialog (add/rename/delete with cascade + undo); defaultNameForLevel naming convention |
| 2A.7 | 92d687eb | Multi floor overview mode (tile grid, drill in, Cmd⇧O) |
| 2A.8 | 2ba32c05 | BOM floor filter + per-row floor chip + minimap floor strip |
| 2B.1 | 819580a9 | CoverageProfile types + DEFAULT_COVERAGE_BY_TYPE registry (motion, reader, AP, speaker etc.) |
| 2B.2 | bd21f778 | Non camera coverage overlay rendering (radius circles + cone wedges) gated by `coverage` layer |
| 2B.3 | 9f9cc8ae | Coverage gap detection heat map (red/green grid, off by default) |
| 2B.4 | 7b4242d8 | Coverage stats panel (overall %, per kind breakdown, gap area) auto-shows with heat map |
| 2C.1 | df089995 | Room polygon drawing tool (`R` key), Room store slice (v20→v21), sensitivity-tinted polygons |
| 2C.2 | 2aa4bcfb | Auto-detect rectangular rooms from walls (Cmd K command) |
| 2C.3 | e9ead1ba | Room inspector (name/description/occupancy/sensitivity), centroid labels, area readout |
| 2C.4 | c529e2c1 | BOM rows annotated with the room each device sits in (point in polygon) |
| 2D.1 + 2D.2 + 2D.3 | f0f3ecbf | Annotation slice (v21→v22), notes + numbered callouts tool (`N` key), layer toggle |

### Verification done this pass

- **Build**: `npm run build` green after every sub pass commit.
- **Cold load**: `/project/p1/canvas` loads with zero console errors after the chained v19 → v22 migration.
- **Multi floor round trip (post 2A.3)**: switching the FloorSwitcher between Ground / Level 2 / Basement filtered devices, pathways, and walls per floor. Cmd Up / Down stepped through the elevation correctly.
- **Per floor blueprint (post 2A.4)**: distinct backgrounds applied to each of p1's three floors render correctly; per floor scale verified (Level 2's `0.1` ft/px reads VERIFIED, Basement reads DEFAULT SCALE).
- **Multi floor overview (post 2A.7)**: tile grid showed all 3 floors with distinct backgrounds + correct device dots + counts. Clicking a tile drilled in to the picked floor.
- **Coverage (post 2B.2)**: AP radius circles + reader proximity radii visible on the canvas; layer toggle hides / shows them.
- **Gap heat map (post 2B.3)**: red/green grid renders, cells flip when devices are moved. Frame rate stayed smooth on the seeded p1 floor.

### Known follow ups deferred to a follow up pass

- Reports (PDF) per floor / per room sections, and floor labels on every device callout. The canvas BOM grew floor + room chips; the PDF export side is its own scoped pass.
- Per-room rows in `CoverageStatsPanel`. `coverageGrid` is in place; adding per-room area is a straightforward extension.
- Hover-on-cell tooltip ("3 cameras see this point") + largest contiguous gap label on the heat map.
- Annotation polish: arrow pointer rendering for `pointToDeviceId`, color picker UI, highlight zone polygon drawing, auto renumber on callout delete, "Print without annotations" toggle in the report builder.
- Cmd K search results extended to include rooms by name.
- Full planar face detection for `Detect rooms from walls` (today: orthogonal rectangles only).

### Risk notes for post deploy smoke test

- Chained v19 → v20 → v21 → v22 migrations, all forward only, all defensively coerce tampered shapes. Verified on a live v19 persisted blob: 12 seeded floors loaded with 0 orphans, 0 missing createdAt, 0 devices missing floorId.
- The Pass 2 fresh reset opens p1 on Ground floor (not Basement) — that ordering preference is documented in the `firstFloorOfProject` helper and the resetDemoData seed.
- Wall draw in Pass 1.1 already migrated walls to `floors[id].walls`; Pass 2A's per floor filtering reuses that path. No double migration risk.
- `pathways` floor filter is opt-in via the `floorId` prop on `PathwaysOverlay`. Other (non canvas) callers continue to read all pathways — verified by grep.
- Coverage stats panel mounts only when the heatmap layer is on, so the per-render coverage rasterisation cost is opt-in.

## 12 · Canvas V2 Pass 1.5 — Mobile chrome hotfix

Inserted between Pass 1 and Pass 2 in commit order. Pass 2 was already on main when the mobile audit surfaced these. No store schema changes. All five sub passes ship under the `md` breakpoint (768 px) and leave desktop chrome untouched.

- [x] **1.5.1 Top toolbar overflow strategy.** Four desktop chrome buttons (Add plan, BOM, Present, Deploy) plus the view picker, fullscreen toggle, ProjectStateMenu, and "more" overflow are now `hidden md:inline-flex` and gain `whitespace-nowrap`. Mobile collapses all of them into a single `MobileActionsMenu` (`MoreHorizontal` trigger) that lists Project actions, View mode, and Fullscreen toggle in a 240 px sheet at `right-0 top-10 z-[60]`. TopBar bumped from `z-30` to `z-[45]` so the menu paints above the drawing rail. Same commit carried the TDZ hotfix for `detectRoomsFromWalls` (now declared after `allWalls` with a ref pattern so the Cmd K command always calls the latest closure).
- [x] **1.5.2 Button label sizing.** Verified via 1.5.1's `whitespace-nowrap` + `hidden md:inline-flex` strategy. No mobile-visible chrome button can wrap. AppShell header already uses `hidden md:flex` on Jump-to search + ModeRolePill; remaining buttons (App menu, Help, Settings) are icon-only.
- [x] **1.5.3 Canvas mobile fit.** Hid five overlapping chrome surfaces on mobile so the canvas fills the viewport: BottomDeviceBar (placement is a desktop task, bar is ~864 px wide), ZoomControls (~336 px, pinch zoom works), MiniMap + toggle button, MiniMapFloorStrip (FloorSwitcher in TopBar handles floors), the bottom-right Add device FAB, and the CableTypePicker. DrawingToolRail compacts on mobile (`w-10 h-10` tiles, no text labels under icons, `top-2 left-2` padding instead of `top-3 left-3`). Cleaned up a pre-existing duplicate `projectId` prop on TopBar at the same time.
- [x] **1.5.4 Mobile canvas action access.** Added an icon-only Search trigger to AppShell header (`flex md:hidden`, 36 × 36 px) that opens the same CommandPalette as the desktop Jump-to. Undo / Redo + FloorSwitcher were already icon-only and remain visible at every viewport.
- [x] **1.5.5 Bottom floating UI cleanup.** Hid the calibration scale chip ("0 — 1.9 ft — DEFAULT SCALE — Set scale") on mobile. The chip is engineer-only and was confusing in isolation now that surrounding chrome is gone. Desktop unchanged.

### Verification done this pass

- **Build**: `npm run build` green after every sub pass change. No TS errors.
- **Mobile inspection**: confirmed `hidden md:*` Tailwind classes via DOM inspection at 375 px. Tools rail, undo/redo, search trigger, mobile actions menu, floor switcher all visible and reachable.
- **Desktop regression check**: TopBar at ≥768 px renders identically to Pass 2 (all chrome buttons + view picker + fullscreen + state menu visible). BottomDeviceBar / ZoomControls / MiniMap unchanged on desktop.

### Known follow ups deferred

- Mobile device placement workflow (`Add device` flow on touch). Today mobile users can pan, zoom, select, measure, undo, redo, and switch floors — they cannot place new devices. Future pass may add a "tap to drop" picker or accept that placement stays desktop only.
- ZoomControls could expose a compact two-button (zoom in / zoom out) version on mobile if user feedback shows pinch is insufficient.
- "Default scale" + "Set scale" desktop chip wording could read more clearly as a status + action pair (currently two uppercase tags side by side).

## 13 · Spine Completion SC.1 — Data Models foundation

Sourced from `docs/MVP_SPINE_AUDIT.md` Batch A. Five of the eighteen spine steps were blocked because the underlying data models did not exist. SC.1 builds those models in the Zustand store as pure foundation; no UI work, no screen changes, no buttons. Each sub pass is its own commit with full review loop.

- [x] **SC.1.1 Approval model (v22 → v23).** Replaces the flat `Project.customerApprovedAt` / `customerApprovedBy` pair with first class `Approval` records. Multiple approvals per project supported (design, scope, final, change order). v22 → v23 migration backfills legacy data with deterministic id `appr-${pid}-${ts}` so partial failure replay is idempotent. Project legacy fields kept for back compat; SC.3 retires them.
- [x] **SC.1.2 Asset model (v23 → v24).** Post commission identity of a Device. Model decision: ONE Asset per Device, enforced via idempotent `createAssetFromDevice` (returns existing id on repeat). `assetForDevice` selector is a single record fetch, not a list.
- [x] **SC.1.3 Warranty model (v24 → v25).** Coverage periods on Assets. Many per Asset (manufacturer + integrator + extended). `expiringWarranties(days = 90)` selector surfaces renewal pressure.
- [x] **SC.1.4 ServiceTicket model (v25 → v26).** Last node in the spine. Auto generated human readable ticket number `DV-YYYY-NNNN` minted from per year max in current state (no separate counter slice). `updateTicket` strips immutable fields (id, ticketNumber, customerId, createdAt, notes, resolvedAt) so the audit trail can't be blanked via the generic patch path. Notes change only through `addTicketNote`. `resolvedAt` auto stamped once on first transition to `resolved`; preserved on subsequent transitions.
- [x] **SC.1.5 cross model integrity sweep.** Runs in both `migrate` (version bumps) and `merge` (steady state loads). Walks Assets / Warranties / Tickets; flags orphans when required parents are missing. Cascade policy: ORPHAN, NEVER DELETE. Idempotent two way reconciliation (a restored parent clears the flag in the same pass).
- [x] **SC.1.6 integrity test script.** `scripts/sc1-spine-integrity.mjs` prints the operator procedure for validating end to end persistence: reset → fixture loader (real action calls) → reload → inspector. Snippets paste straight into DevTools.

### Verification done this pass

- **Build**: `npm run build` green after every sub pass commit. No TS errors.
- **Review loop**: task verifier COMPLETE on SC.1.1. Code reviewer caught issues on every sub pass; all CRITICAL + IMPORTANT findings addressed in the same commit:
  - SC.1.1 — CRITICAL `resetDemoData` miss on the new slice; IMPORTANT migration idempotency by scan replaced with deterministic id check; IMPORTANT `addApproval` upsert preserves prior `createdAt`; IMPORTANT TODO on deprecated `Project.customerApprovedAt` fields.
  - SC.1.2 — 0 CRITICAL / 0 IMPORTANT. Docstring drift on `createAssetFromDevice` fixed inline so SC.1.3 + SC.1.4 mirror the right pattern.
  - SC.1.3 — clean.
  - SC.1.4 — IMPORTANT `updateTicket` resolvedAt clobber via patch; IMPORTANT `updateTicket` immutable field strip (id / ticketNumber / customerId / createdAt / notes / resolvedAt); MINOR id collision in tight loops fixed via in `set` retry; MINOR strict 4 digit regex on ticket number parse; MINOR array entry guard in migration.
- **Persist version**: `deeperVisionStore` v26. Four forward only migrations all defensively coerce tampered shapes (Array, null, string, missing nested arrays).
- **Integrity sweep**: confirmed silent on a clean store; emits one console.warn line summarising flips when anything was flagged or cleared.

### Known follow ups deferred to SC.3+

- `CustomerPortal.tsx:115-116` still writes the legacy `Project.customerApprovedAt` / `customerApprovedBy` pair instead of calling `addApproval`. Migrating the writer lives in SC.3 (Batch B / Commissioning + Approval gate). Existing data is covered by the v22 → v23 backfill.
- `Maintenance.tsx` + `ChangeOrders.tsx` are still hardcoded mocks. SC.6 / Batch F is the rewrite.
- Asset `id` explicit override path can collide with another Device's record via the `id` parameter on `createAssetFromDevice`. No callers today; SC.1.6 fixture uses device id. Worth tightening when an explicit-id writer first appears.
- `removeAsset` / `removeApproval` / `removeWarranty` / `removeTicket` return a fresh `assets` object even on miss. Pattern matches sibling CRUD slices; cheap to guard when an "audit pass for unnecessary re renders" lands.

### Risk notes for post deploy smoke test

- Store version jumped four steps in one batch (v22 → v23 → v24 → v25 → v26). Each migration is independent; partial failure on any one preserves the prior version.
- Two new fields on existing types (`Warranty.isOrphaned`, `ServiceTicket.isOrphaned`) — both optional booleans, never required, so older serialised shapes round trip fine.
- Approval backfill is idempotent: re running the v22 → v23 step on a state that already has approvals just preserves them.
- Integrity sweep runs on every load. Cost is O(assets + warranties + tickets); negligible at MVP scale.

## 14 · Spine Completion SC.2 — Approval Gate + WO Canonicalization

Sourced from `docs/MVP_SPINE_AUDIT.md` Batch B. Wires SC.1's Approval record to its first real consumer (Work Order derivation), retires the legacy `Project.customerApprovedAt` / `customerApprovedBy` fields backfilled in SC.1.1, kills the parallel mock `/workorders/:projectId` screen, and surfaces approval state honestly on the customer portal + project center + reports. Closes audit CRITICAL gap #4 and HIGH gaps #5 + #7.

- [x] **SC.2.1 Customer Portal approval form.** Five field form (name, email, type, version, comments) replaces the prior single name modal. Required field inline validation. Submit calls `addApproval` with all six required Approval fields plus a unique id `appr-{pid}-{ts}-{rand}`. Form clears + closes on success. Approve button hidden only when latest approval is `final`; design / scope / change order keep the button visible so the customer can progress through gates. `nextProposalVersion` helper rolls a vN tag forward.
- [x] **SC.2.2 Approvals audit trail on Project Center.** New section under Key metrics renders every approval newest first with type badge, approver, version, timestamp, and one line comment preview. Click expands inline for full details + record id. Empty state links the operator to the Customer Portal where approvals get created. Reads via raw `approvalsMap` + useMemo (matches existing identity check avoidance pattern).
- [x] **SC.2.3 Retire `Project.customerApprovedAt` / `customerApprovedBy`.** Both fields removed from the Project interface. v26 -> v27 migration walks every persisted Project and deletes both fields. CustomerPortal mirror write retired; lifecycle phase advance now lives in a small standalone `updateProject` call on scope / final approvals. Hero approval banner reads from `latestApproval` (gated on `approvalType === 'final'`).
- [x] **SC.2.4 Work Order screen canonicalization.** `/workorders/:projectId` (131 line hardcoded mock with a no op "Generate from BOM" button) becomes a 22 line redirect shim to `/project/:id/deployment` so any pre existing bookmark survives. Four nav references in `lifecycle/phases.ts` repointed from `/workorders/:id` to `/project/:id/deployment`.
- [x] **SC.2.5 Work Order approval gate.** New `selectors.workOrderGate(state, projectId)` returns `{ ok, reason, latestApproval, phase }` with `reason ∈ 'ok' | 'no_approval' | 'design_only' | 'phase_too_early'`. `deriveWorkOrders` short circuits to `[]` when not OK. Phase set: `'deployment' | 'commissioning' | 'completed' | 'managed_service' | 'support'`. Approval requirement: latest record is `scope` or `final` (design + change order alone don't unlock). DeploymentMode + DeploymentModeMobile render reason specific empty states with appropriate CTAs (Customer Portal or Project Center). ReportsCenter Executive Summary tile + Field Deployment Summary section both show "Awaiting gate" copy instead of misleading 0/0 complete.
- [x] **SC.2.6 Customer Portal approval status display.** `ApprovalStatusPill` at the top of the approval card maps the latest record to one of five customer safe labels (Awaiting approval / Design approved / Scope approved / Change approved / Final approval). `ApprovalHistoryToggle` renders below when >1 approval exists; expanded list highlights the latest per type and labels earlier same type entries as "Superseded".
- [x] **SC.2.7 SC.2 integrity test script.** `scripts/sc2-spine-integrity.mjs` prints a five step DevTools paste procedure: reset baseline -> assert gate closed -> open via scope approval + phase advance -> close via approval removal -> portal smoke walkthrough. Each step has an acceptance checklist line.

### Verification done this pass

- **Build**: `npm run build` green after every sub pass commit. No TS errors.
- **Persist version**: `deeperVisionStore` v27. SC.2.3 v26 -> v27 migration deletes the deprecated `customerApprovedAt` / `customerApprovedBy` fields from every persisted Project.
- **Review loop**: code reviewer caught:
  - SC.2.1 — 3 IMPORTANT (Approve button hidden after first approval, same ms id collision, lying "roll forward" comment) + 2 MINOR. All addressed.
  - SC.2.5 — 3 IMPORTANT (ReportsCenter showing misleading zeros, DeploymentMode filters visible during gated empty state, gate sort risk on malformed `approvedAt`) + 2 MINOR. All addressed.
  - SC.2.2 / SC.2.3 / SC.2.4 / SC.2.6 — clean.
- **Gate semantics**: confirmed strict reading of the brief. Latest approval must be `scope` or `final` (design + change order alone don't unlock). Phase must be `deployment` or later. Both AND'd. Customer approving scope advances the project to `'approved'` phase; operator must manually advance to `'deployment'` before WOs derive.

### Known follow ups deferred

- The legacy mock `/workorders/:projectId` route entry stays in `App.tsx` as a no op redirect. Removing the route entirely would 404 cached bookmarks; safer to keep the redirect.
- `latestApprovalForProject` selector + the gate's inline lookup share logic but don't share an implementation (the gate sorts by numeric `createdAt`, the selector sorts by `approvedAt` ISO string). Acceptable today; if a sort fix lands in one, mirror to the other.
- Mobile `synthState` passed to `deriveWorkOrders` is `as any` which hides any new slice the derive function might start reading. SC.3+ refactor candidate.
- The "view history" toggle on the portal lists approvals chronologically with a Superseded label per same type duplicate. A future polish pass could group by type with the active one expanded.

### Risk notes for post deploy smoke test

- v26 -> v27 deletes fields from in memory + persisted Project records. The SC.1.1 backfill already pushed those values into Approval records, so no data loss; just a schema simplification.
- Existing seed data: confirm Riverbend HQ (p1) has at least one Approval record after the v23 + v27 migrations run (the seed may need a fresh `resetDemoData()` to land cleanly).
- `deriveWorkOrders` now gated. Any consumer that displayed "X work orders" on a project without approval now reads zero. Confirmed updates on: DeploymentMode, DeploymentModeMobile, ReportsCenter Executive Summary + Field Deployment Summary. Not audited: assistantEngine.ts, projectSync.ts, Dashboard.tsx rollups — those receive `[]` which is correct, but should be confirmed they don't surface misleading "0" copy.

## 15 · Spine Completion SC.3 — Commissioning writes back

Sourced from `docs/MVP_SPINE_AUDIT.md` Batch C. Closes audit CRITICAL gap #3 by wiring commissioning to first class records: the device gets a real `commissioning` field, a passing commission auto creates an Asset (per SC.1.2 one-to-one rule), and the same call opens a default 1y manufacturer Warranty against the Asset. Wires steps 14 → 15 → 16 of the MVP spine end to end.

- [x] **SC.3.1 Commissioning form on deployment surface.** New shared module `src/app/components/CommissionSheet.tsx` exports the modal form + summary panel + default test list + status meta + `commissionStatusFromTests` helper. Form captures commissioner name, commissioning date (defaults to today), serial (optional), notes, and a four item test checklist (powered on / network reachable / recording verified / configured per spec). Status derives from test results: all pass = pass, mixed = partial, none = fail. DeploymentMode adds a Commission action button in the WO detail status row (with label that adapts to current state: Commission / Recommission / Resolve partial / Retry commission) plus a CommissionSummaryPanel below the status timeline. DeploymentModeMobile adds a 44 px Commissioning SectionCard. Pathways + IDFs + legacy state.doors get no Commission UI because they have no Device id to write commissioning against.
- [x] **SC.3.2 + SC.3.3 Auto Asset + Warranty on pass.** `setDeviceCommissioning` chains side effects on `status === 'pass'`: resolves manufacturer + model from the catalog product, calls `createAssetFromDevice` (idempotent), calls `updateAsset` to bring serial / commissioner / date forward (without blanking prior serial when caller omits it), opens a default `wty-${assetId}-mfr` 1y manufacturer warranty if no manufacturer warranty exists. Date arithmetic anchored at local noon so timestamps survive DST + display the correct day in Pasadena. Defensive `if (!assetId) return` before warranty write. Partial + fail commissions persist the record but do NOT promote to Asset.
- [x] **SC.3.4 Assets list on Project Center.** New Assets section under Approvals renders every project asset newest first with status badge (Active / Decommissioned / Service required / Orphaned), device label, manufacturer, model, commissioned date + by, serial when present, and linked warranty count. Click expands inline with full detail grid + warranties list (tone per warranty: Active green, Expiring within 90 days amber, Expired rose). Empty state links direct to `/project/:id/deployment`. SC.6 service ticket placeholder rendered as plain italic text (not a disabled button) so the honesty contract holds.
- [x] **SC.3.5 Edit + decommission asset.** Asset expansion gains "Edit asset" toggle that flips serial / status / notes to inputs (manufacturer + model stay read only — they derive from the catalog). Decommission lives behind a two click confirm (rose toned). Decommission cascade: sets `asset.status = 'decommissioned'`, then for every linked warranty whose endDate is in the future calls `updateWarranty` to set endDate to today. History is preserved (records never deleted). Each warranty row has its own Edit toggle that flips to a form with provider select, type input, start + end date pickers, terms textarea, coverage textarea.
- [x] **SC.3.6 Customer Portal installed assets preview.** New "Installed equipment" Card on the portal renders only active assets (decommissioned + orphaned hidden). Each row shows a plain English device label (Dome camera / Access door / etc) translated via `ASSET_TYPE_LABEL`, manufacturer + model, floor name (if available), installed date, and a warranty status badge with three tones (Under warranty / Warranty expiring / Warranty expired). Loudest signal wins so a single expired warranty surfaces over the others. No cost data, no internal jargon, no ids exposed. Card hides entirely when there are no active assets.
- [x] **SC.3.7 SC.3 integrity test script.** `scripts/sc3-spine-integrity.mjs` prints a six step DevTools paste procedure: reset + open the gate → commission with PASS (assert Asset + Warranty spawn) → recommission (assert idempotency on both) → commission another device with PARTIAL (assert no Asset created) → decommission asset (assert cascade to warranties + history preserved) → hard reload then inspector.

### Verification done this pass

- **Build**: `npm run build` green after every sub pass commit. No TS errors.
- **Persist version**: `deeperVisionStore` v27 (unchanged from SC.2; SC.3 made no schema bumps — the new `device.commissioning` field is `import('./types').DeviceCommissioning` which carries forward through the existing devices slice, no migration needed because the prior placeholder field was never written).
- **Review loop**: code reviewer caught:
  - SC.3.2 + SC.3.3 — 2 IMPORTANT (undefined serial blanks asset on recommission; UTC date parsing shifts displayed commissioning day west of UTC) + 4 MINOR. Both IMPORTANT addressed inline (filter undefineds + local noon anchor).
  - SC.3.1 / SC.3.4 / SC.3.5 / SC.3.6 — clean.
- **Chain semantics**: confirmed strict reading of brief.
  - PASS triggers Asset + Warranty auto creation.
  - PARTIAL + FAIL persist commissioning record only.
  - Recommission with PASS is idempotent on Asset (one-to-one rule from SC.1.2) and on default manufacturer Warranty (only opened the first time).
  - Decommissioned → active silent flip on recommission per inline comment; intentional V1 default.

### Known follow ups deferred

- SC.3.5 inline edit for asset notes also forwards `notes: ''` when the operator clears the field. Compared to the serial undefined fix this is intentional (notes are bulk free text the operator wants to clear) but worth documenting.
- Decommissioning surfaces no toast confirming the cascade ("decommissioned X; ended Y warranties"). Worth a follow up polish pass.
- Auto warranty resurrection: deleting the manufacturer warranty then recommissioning re creates the same `wty-${assetId}-mfr` id. Predictable but the audit trail loses the prior deletion record.
- Activity log doesn't fire on Asset created or Warranty opened. Would need extending the `ActivityType` enum first.
- Customer Portal asset row links to nothing (no detail drawer); deferred to SC.6.

### Risk notes for post deploy smoke test

- `device.commissioning` shape replaced; any prior persisted blobs had `install / firmware / network / signal / signedOff / notes` keys. None of those were ever written (audit-confirmed phantom field), so no real data exists to migrate. The shape change is type-only and the persisted record will be undefined for every device until commissioning is recorded fresh.
- Side effect chain runs INSIDE `setDeviceCommissioning`, so every caller (UI form, integrity script, future API webhook) gets the same Asset + Warranty creation automatically. No risk of forgetting to call.
- `createAssetFromDevice` idempotency relies on a deviceId-keyed scan in the assets slice. On a project with thousands of devices the scan is O(devices) per pass; acceptable at MVP scale.

## 16 · Spine Completion SC.4 — Proposal Builder real wiring

Closes audit CRITICAL gap #1. Replaces the 143 line hardcoded fixture proposal builder with a real one that derives from the project's BOM (now including walls + conduit + accessories per SC.4.2), supports internal vs customer safe viewer modes via a data layer split, computes a pricing waterfall with margin / burden / labor rate, sends real proposals, generates customer safe PDFs, and tracks versions with supersede + compare. SC.2 approvals now reference real proposal versions with audit trail integrity preserved across supersedes.

- [x] **SC.4.1 Proposal data model.** `Proposal` interface with split customerView / internalView shapes, `ProposalLine` with section + cost + price + labor + hideFromCustomer, `ProposalStatus` union (draft / sent / approved / superseded / archived). createProposal auto increments version per project from inside the set callback. updateProposal strips immutable fields (id, projectId, version, createdAt). supersedeProposal marks prior superseded + creates new draft pre populated + backfills supersededBy pointer. v27 → v28 migration (greenfield). isOrphaned added for SC.1.5 integrity sweep.
- [x] **SC.4.2 BOM derivation gap fixes.** Conduit pathways emit a conduit line at CONDUIT_UNIT_PRICE_PER_FT (was billed as cable). New walls aggregation line per project (linear feet via Euclidean distance × floor.scalePxToFt). Accessory iteration parity between deriveBOM and deriveCanvasBomRows via shared constants (ACCESSORY_DEFAULT_PRICE, ACCESSORY_DEFAULT_LABOR_HOURS). CanvasBomCategory extended with 'conduit' + 'walls' buckets.
- [x] **SC.4.3 Customer-safe vs internal view split.** New `src/app/lib/proposalView.ts`. `toCustomerView(proposal)` returns `ProposalCustomerArtifact` with ZERO internal fields (hidden lines stripped, unitCost / laborHours / internalNote projected away). `deriveProposalInternalTotals(proposal)` returns the full cost waterfall (loadedCost, sellTotal, grossProfit, gpPct, customerSubtotal). `customerArtifactContainsInternalLeaks(artifact)` is the SC.4.11 integrity assertion. `bomRowToProposalLine`, `applyMarginToLines`, `repriceAllLinesByMargin` helpers.
- [x] **SC.4.4 + 4.5 + 4.6 Proposal Builder UI scaffolding + BOM lines + pricing.** Full rewrite of `ProposalBuilder.tsx`. Empty state with Create CTA. Two column body (section nav + section editor). Eight sections (Header, Executive summary, Scope, BOM Lines, Pricing, Terms, Acceptance, Internal notes). BOM Lines grouped by section with column header row, per row qty / unit / cost / sell / line sell / labor hrs editing, hide from customer toggle, custom line add per section (auto hidden until priced). Pricing waterfall with labor rate / burden / target margin inputs (bounded at 95%). Customer line items total surfaced as separate row + Reprice every line action so customer total tracks operator target.
- [x] **SC.4.7 Send to Customer flow.** Send button only renders on draft AND no dirty edits. SendDialog: two phases (confirm + share). Confirm has contact dropdown + validation (header, ≥1 visible line, customer total > 0). Share surfaces real portal URL with Copy + mailto helper. Lock banner above section editor when status !== 'draft' + every input disabled. Customer Portal renders the sent proposal via toCustomerView. Pre existing priorApprovals infinite loop fix (raw subscription + useMemo instead of fresh-array selector). Approve-after-send: architectural decision documented in code (option b — explicit Create New Version, not silent draft spawn).
- [x] **SC.4.8 Generate PDF.** New `src/app/lib/proposalPdf.ts` using jsPDF (dynamic import). Pure function over `ProposalCustomerArtifact` so the PDF physically cannot leak internal data. Letter portrait multi page with cover (brand bar + logo + integrator + title + version + prepared for + project total), executive summary, scope, line items table grouped by SECTION_ORDER (deterministic), per group subtotal, mid section page break repaints header + column labels, project total, payment schedule, acceptance with signature block, terms (own page), per page footer. Logo format auto detected from data URL prefix. parseColor supports 3-digit hex shorthand. Per-line pagination for long paragraphs.
- [x] **SC.4.9 Version history + supersede + compare.** Top bar: VersionPicker dropdown listing all versions (newest first, status badge, sent / created date). New version button (renders on sent / approved only) calls supersedeProposal + switches to the new draft. Compare button (visible when 2+ versions exist) opens CompareVersionsDialog: pick two versions, see added / removed / modified BOM lines, changed narrative sections, pricing parameter deltas.
- [x] **SC.4.10 Approval flow integration with versions.** Customer Portal ApproveSheet seeds proposalVersion from `v${sentProposal.version}`. Version field locked + reads "automatic" when a live sent proposal exists (customer can't invent a version number). Newer version banner on approval card when latestApproval.proposalVersion ≠ live sent proposal's version label. Approval records retain their original proposalVersion across supersedes (audit trail intact).
- [x] **SC.4.11 SC.4 integrity test script.** `scripts/sc4-spine-integrity.mjs` prints a seven step DevTools paste procedure: reset → create → assert view split has zero leaks → send → approve → supersede + send v2 → portal banner walkthrough. Plus a PDF visual inspection checklist.

### Verification done this pass

- **Build**: `npm run build` green after every sub pass commit. No TS errors.
- **Persist version**: `deeperVisionStore` v28 (SC.4.1 added the proposals slice; greenfield migration).
- **Review loop**: code reviewer caught:
  - SC.4.4-4.6 — 2 CRITICAL + 7 IMPORTANT + 4 MINOR. All CRITICAL + IMPORTANT addressed.
  - SC.4.7 — 3 IMPORTANT + 4 MINOR. All IMPORTANT addressed.
  - SC.4.8 — 4 IMPORTANT + 3 MINOR. All IMPORTANT addressed.
  - SC.4.1 / 4.2 / 4.3 / 4.9 / 4.10 — clean.
- **Browser verified** per sub pass via preview server with DOM scanning + eval based assertions:
  - View split: zero forbidden internal strings (Cost, Internal note, Burden, margin, Loaded, GP, labor rate, unitCost, hideFromCustomer) in customer preview / portal proposal card.
  - Send: status flips, sentAt persisted, share URL surfaces.
  - PDF: 17.6 KB blob with `application/pdf` MIME, no error toast.
  - Supersede: v1 marked superseded with supersededBy pointer, v2 draft created.
  - Compare: 1 modified line surfaced after a price bump on v2.
  - Version mismatch banner: correct copy after the supersede+send flow.
  - Approve sheet version field locked to live sent proposal's version label.

### Known follow ups deferred

- Rich text editor for narrative sections (currently plain textareas with paragraph break rendering).
- Bulk product swap on BOM Lines (deferred per SC.4.5 brief).
- Per device type test checklist overrides for commissioning (mentioned in SC.3.1, still pending).
- Real email send infrastructure. Today the SendDialog surfaces the portal URL + mailto helper; no SMTP / API.
- ProposalLine.laborHours semantic clarification (column header now reads "Labor hrs" with tooltip; the persisted shape carries totals not per unit values; documented in the type).
- Compare modal could grow a side by side narrative diff for richer textual changes. V1 surfaces "which sections changed" only.
- Quote-engine sibling repo integration (per CLAUDE.md). Local pricing math stays in this repo until the API endpoint exists.

### Risk notes for post deploy smoke test

- New v28 migration is greenfield (no data backfill). Existing persisted blobs round trip cleanly.
- Proposal records persist via partialize. Send flow + supersede flow are atomic store actions; no localStorage race.
- PDF generator dynamically imports jspdf so the proposal builder initial bundle stays small.
- Customer Portal proposal card hidden unless a sent or approved proposal exists. Pre SC.4 projects render the portal as before.

## 17 · Spine Completion SC.6 — Customer Portal lifecycle + Service Tickets

Closes audit step 18 (Service Ticket CRUD UI, not implemented before this batch) and the remaining audit #9 gaps on the Customer Portal (approvals history, ticket creation + listing). After SC.6 every spine step has both an internal operator surface and a customer facing surface.

- [x] **SC.6.1 Internal /tickets manager.** Cross customer / cross project list. Filters: status (with `active` preset that hides resolved + closed + orphans, plus an explicit `orphaned` view per the schema's triage contract), priority, category, customer, project. Search across number / title / description / customer / project. Sort by priority then most recent update. NewTicketDialog with customer + project pickers (project scoped to picked customer), title, description, priority, category, reporter via contact picker with freeform override. AppShell sidebar gains a Tickets entry in the work group.
- [x] **SC.6.2 Ticket Detail with timeline.** `/ticket/:ticketId` header (number, title, category), description card, timeline oldest first with synthetic System notes auto appended on every status / priority transition. Cmd+Enter submits operator notes from a textarea. Status / priority handlers read live store state inside the handler so a rapid double click cannot log a stale "from X to Y" or duplicate transition. Linked records rail (customer, project, device clickable; asset / warranty expanded inline). assignedTo controlled with useEffect re seed on ticket id / value change. Not found state with back button.
- [x] **SC.6.3 Customer Portal ticket creation.** New `PortalReportIssueDialog` in `src/app/components/portalTickets.tsx`. Customer friendly issue kind grid (CUSTOMER_TICKET_KINDS — camera / access / config / warranty / question / other → internal category). Optional device picker scoped to commissioned assets only (SC.3.6 filtering). Description, urgency (low / medium / high → ticket priority via CUSTOMER_URGENCY_TO_PRIORITY). Reporter name + email pre filled from the customer's primary contact (overridable). Submit calls the same `createTicket` action operators use so the ticket lands on `/tickets` immediately.
- [x] **SC.6.4 Customer Portal ticket list + status visibility.** New `PortalTicketsCard` on the Customer Portal. Lists this customer's tickets for this project (filters orphans + cross customer leaks via an ownership guard `customer.id === project.customerId`). Active first, then resolved / closed. Each row expands inline: description, conversation timeline (oldest first with mixed timestamp normalizer), follow up note form. Status + priority pills use TICKET_STATUS_CUSTOMER / TICKET_PRIORITY_LABEL — `in_progress` renders as "Our team is on it", `waiting_customer` renders as "We need your help". `defaultAuthor` uses a controlled once pattern (noteAuthorDraft falls through to derived default until the customer types) so a late hydration race cannot freeze the input on "Customer". Operator side note form gains a hint reminding operators the customer sees every note; schema lacks an internal only flag today (the design is mutual conversation).
- [x] **SC.6.5 Customer Portal approvals history.** Extends the existing `ApprovalHistoryToggle` (SC.2.6). Each row surfaces the approver's comments inline. The version label is a button that opens a customer safe snapshot of that proposal version (reuses `ProposalCard` + `toCustomerView`). When a version is no longer in the store the label degrades to plain text rather than a dead click. `proposalsByVersion` map subscribed in CustomerPortal so lookups are O(1).
- [x] **SC.6.6 Customer Portal design snapshot.** Option A landed: new `ProposalCanvasSnapshot` type on the Proposal record, captured at send time, rendered as a static SVG in the portal. `canvasSnapshot.ts` denormalizes Floor / Wall / Device / Room into a lean snapshot (devices collapse accessories to a count; walls normalize to a `points[]` array; rooms dedupe between the standalone slice and inline Floor.rooms). `sendProposal` is a new atomic store action that captures + flips status + sets sentAt under a single set() so the snapshot can never drift from the proposal. Deep clone via `JSON.parse(JSON.stringify(...))` on capture so a later in-place mutation of `device.coverage` or `floor.background` cannot rewrite history — also smoke tests serializability with a readable error before the persist layer would silently fail. v28 → v29 migration is a no-op; existing proposals get `canvasSnapshot = undefined` and the portal card hides for them (backfill would lie). Portal `PortalDesignSnapshotCard` renders floors with a tab strip, walls as line segments, rooms as polygons, devices as colored dots with snapshot-frozen labels and a customer friendly kind legend. Coverage cones / radii / polygons rendered with the schema's half-angle convention. Card title branches on `sentProposal.status` so "Approved design" only shows after the customer actually approves; sent-but-not-approved reads "Proposed design". SC.1.5 orphan sweep verified to NOT walk canvasSnapshot. Size warn at 2 MB per snapshot in console (SC.7 watch item).
- [x] **SC.6.7 SC.6 integrity test script.** `scripts/sc6-spine-integrity.mjs` prints an eight step paste procedure: reset → portal create → internal queue assertion → triage transitions → visual portal read back → customer reply → resolve + resolvedAt stability → approvals history version snapshot. STEPS 2 / 3 / 4 / 6 / 7 / 8 verified live to `auditOk:true` against the dev server.

### Verification done this pass

- **Build**: `npm run build` green after every sub pass commit. No TS errors.
- **Persist version**: `deeperVisionStore` v29 (SC.6.6 added `canvasSnapshot` to Proposal; migration is a no-op leaving every existing proposal with the field undefined since backfill would lie about what the customer saw at send time).
- **Review loop**: code reviewer caught:
  - SC.6.1 + 6.2 — 1 CRITICAL (status/priority audit-trail race) + 5 IMPORTANT + 2 MINOR. All CRITICAL + IMPORTANT addressed; race fixed by reading live store state inside the transition handler.
  - SC.6.3 + 6.4 — 3 CRITICAL + 5 IMPORTANT + 2 MINOR. defaultAuthor freeze fixed via controlled once pattern; ownership guard added to PortalTicketsCard render; operator side note form gains customer visibility hint; toast wording corrected (no "immediately" claim); destructive token instead of raw rose tone; localeCompare normalizer for mixed timestamps. Internal note visibility flag deferred (requires schema bump, out of scope for SC.6.3/6.4).
  - SC.6.5 — single pass clean.
  - SC.6.6 — 1 CRITICAL (shared references in snapshot) + 6 IMPORTANT + 3 MINOR. CRITICAL fixed via JSON deep clone on capture (also catches non serializable fields with a readable error). IMPORTANT fixes: title branches on status ("Proposed design" vs "Approved design"); bbox memo deps stabilised via per floor useMemos; cone arithmetic corrected (fovDeg is half angle per the schema, not full FOV); blueprint rotation pivots on image center; size warn no longer swallows JSON failures; floor scoping unified through floorIdSet across walls + inline rooms; sendProposal mints now once and passes it to capture so capturedAt and sentAt agree to the millisecond.
- **Browser verified** end to end via preview server with real DOM scanning + eval based assertions:
  - DV-2026-0001 created from /portal/p1 with priority=high, category=device_failure, reporter pre filled from c1 primary contact.
  - Customer follow up note "Update: tried unplugging..." landed in ticket.notes with authorName + email.
  - Operator side: ticket appears in /tickets queue with "1 active · 1 total" subtitle; timeline shows the customer's note.
  - Operator transitions to in_progress → portal row text changes to "Our team is on it" (customer friendly label) instead of leaking "In progress".
  - Status transitions emit System timeline entries chronologically; resolvedAt stamps once and survives a bounce.
  - SC.6.5 history toggle: 2 rows with date / type / version button / approver name; v1 click opens modal showing the v1 customer view at 12 cameras even when v2 raw shows 14 (point in time snapshot integrity).
  - Orphaned ticket triage: explicit `Orphaned` filter exposes the count; subtitle reads "1 active · 2 total · 1 orphaned".

### Known follow ups deferred

- **Internal note visibility flag on TicketNote.** Today every note in the ticket thread is mutually visible. Operator note form carries an inline hint reminding the operator the customer sees their notes. A `visibility: 'internal' | 'customer'` field on TicketNote + a portal filter is a future schema bump.
- **Snapshot blueprint factoring (SC.7).** Floor blueprint dataUrls are inline in the snapshot. Multi floor projects with rich blueprints can push a single snapshot past the 2 MB warn threshold. Move blueprints to a separate IndexedDB slice and reference them by hash so localStorage's 5–10 MB ceiling is not chewed by one proposal version per project. The capture helper logs a console warn at 2 MB so the threshold is observable.
- **Realtime push.** Both sides see updates only on next page load / store rehydrate. Toast copy reflects this honestly ("Your team will see it on their next refresh") rather than promising a live transport.
- **Operator authorship normalization.** Note authors render as written — operators are advised to use a customer ready full name. A schema enforced display name + brand suffix is a future polish pass.
- **Customer priority adjustment audit.** Customer submits an urgency (low/med/high); operator may re triage to critical or downgrade. The portal shows the operator adjusted priority. Storing the original `customerUrgency` separately is a future schema bump.
- **Hardcoded "Riverbend HQ" breadcrumb on EngineeringCanvas.** Pre existing tech debt surfaced when verifying SC.5.7 / SC.6.2; orthogonal to SC.6.

### Risk notes for post deploy smoke test

- v28 → v29 migration is a no-op (canvasSnapshot defaults undefined on existing proposals). Hydrate-time risk is nil.
- New routes `/tickets` and `/ticket/:ticketId` registered. Old localStorage with no `serviceTickets` slice already migrated in SC.1.4.
- Customer Portal Service requests card is gated on `customer && project.customerId === customer.id` so a misrouted /portal/:id link cannot write tickets against the wrong customer.
- /portal/:id ApprovalHistoryToggle modal renders inside the portal page, no navigation away. Modal close clears `viewVersion` so a stale ref cannot keep rendering.
- New canvas snapshots are inline in `proposals` slice persistence. A 24 device, 3 floor seed project snapshots clean at ~3 KB serialized; size warn fires at 2 MB and is loud in DevTools, no UI break.

## 18 · Spine Completion SC.7 — Technical correctness

Closes audit #6 (camera cones using hardcoded PX_PER_FT) and the SC.6.6 blueprint factoring follow-up, plus the cumulative deferred MINORs from prior batches. Two schema bumps (v29 → v30 for the snapshot background field; v30 → v31 for TicketNote.visibility). No new user-facing features.

- [x] **SC.7.1 Camera cone calibration.** Every cone consumer (single-lens FOV, fisheye, multisensor per lens, ConeHandles, FovCone, ReviewMode FovCone, target-sim reach figure, computeIntelIssues + drawComplianceReport via the report pipeline) threads `pxToFt` from `ftPerPxForFloor(floor)` instead of the legacy 3.83 px/ft hardcode. Calibrated backgrounds now paint cones at the correct physical scale; uncalibrated floors fall back to the canvas default (0.05 ft/px) matching wall scale and surface the existing "Default scale" chip. Cable-run > 90m warning compares real feet (295 ft) instead of raw pixels. Dropped two unused PX_PER_FT declarations as dead code. Browser verified: scalePxToFt 0.05 → 0.125 produced an exact 2.5x cone-radius change (1000 → 400 px).
- [x] **SC.7.2 Breadcrumb fix.** EngineeringCanvas breadcrumb now reads `useProjectStore((s) => s.projects[projectId]?.name)` instead of the hardcoded 'Riverbend HQ'. Two follow-ups in the orphaned SectionPanel: subtitle composes the project name dynamically; the fake docs list uses neutral labels with a comment explaining the placeholder. Verified across `/project/p1/canvas` (Acme HQ — Austin) and `/project/p2/canvas` (Mercy Hospital Tower B) — both render their own name, zero Riverbend leaks.
- [x] **SC.7.3 Blueprint factoring to IndexedDB (v29 → v30).** New `src/app/lib/blueprintStore.ts` owns a dedicated IndexedDB object store keyed by SHA-1 prefix of the dataUrl content. `captureCanvasSnapshot` is async, writes the dataUrl to IndexedDB and stores a `dataUrlRef` hash in the snapshot. `sendProposal` became async; `ProposalBuilder.handleSend` awaits it. Migration is a no-op (existing SC.6.6 snapshots keep their inline dataUrl). Portal `SnapshotBackground` sub-component resolves dataUrlRef via IndexedDB lazily. Browser verified: 80 KB synthetic blueprint went to IndexedDB; snapshot stored only the 16-char hash; persisted localStorage stayed at 108 KB.
- [x] **SC.7.4 Typography normalization.** 414 occurrences of legacy `text-[10.5px]` / `text-[11.5px]` / `text-[12.5px]` across 31 files swept to the nearest chrome scale (rounded down to preserve density intent). Zero half-px arbitrary values remain in `src/`.
- [x] **SC.7.5 DeviceType union completion.** Store-level DeviceType expanded to cover every category the canvas paints (cam.turret, int.*, inf.*, fls.*, cyb.*, bld.*, plus the missing acc / aud / sen subtypes). Canvas's local DeviceType / DeviceKind now alias the store types — single source of truth, no drift. Dock category array normalised to canonical store names; the few aspirational entries that have no renderer yet (cam.turret, inf.door bare, fls dock shorthand, inf.transformer) carry a `// dock-only` comment so the audit grep stays clean.
- [x] **SC.7.6 Cumulative MINOR cleanup.** `latestApprovalForProject` + `workOrderGate` selectors switched to single-pass max scans. `DeploymentModeMobile` dropped the blanket `as any` on the synthesised partial state — now casts through `unknown as ProjectState` with a narrowing comment. `ProjectHub.relativeUpdated` wrapped in `useMemo`. Two items defer to follow-ups with documented rationale: whole-store `useProjectStore()` subscriptions on 7 screens (substantial pass with UX regression risk), and the `JSON.stringify` dirty detection in ProposalBuilder (correct, perf cost immaterial at MVP proposal sizes).
- [x] **SC.7.7 TicketNote.visibility flag (v30 → v31).** Closes the deferred CRITICAL #2 from SC.6.3/6.4. `TicketNote.visibility: 'internal' | 'customer'` (optional, defaults to `'customer'`). Migration walks every persisted serviceTicket and backfills `visibility: 'customer'` on every note that lacks the field. `addTicketNote` accepts an optional visibility, defaults to customer. Internal `TicketDetail` gains a Customer / Internal toggle — defaults to Customer, resets to Customer after every post so a stuck-internal state can't silently hide the next reply. Timeline shows an amber "Internal" chip + tinted left border on internal notes. Customer Portal filters notes to `visibility === 'customer' || !n.visibility`; the defensive fallback never needs to fire after the migration. Browser verified: hand-seeded v30 blob with a no-visibility note hydrated to v31 with `visibility = 'customer'`; UI-authored internal note hides on the portal, shows with the Internal chip on the internal detail.
- [x] **SC.7.8 SC.7 integrity test script.** `scripts/sc7-spine-integrity.mjs` prints a 7-step paste procedure covering cone calibration, breadcrumb per-project, blueprint IndexedDB factoring, ticket visibility round-trip, and the v30 → v31 migration backfill assertion. Every step verified live during the SC.7 sub-pass commits.

### Verification done this pass

- **Build**: `npm run build` green after every sub pass commit. No TS errors.
- **Persist version**: `deeperVisionStore` v29 → v30 → v31 (two bumps in one batch; both migrations idempotent and safe to re-run).
- **Review loop**: lean per-sub-pass given the technical-correctness scope. Browser verification ran on every user-visible deliverable.
- **Browser verified** end to end via the preview server:
  - Cone radius 2.5x at scalePxToFt 0.05 → 0.125 with no other changes.
  - Project name shows correctly on p1 and p2 canvases; "Riverbend HQ" never appears.
  - 80 KB synthetic blueprint goes to IndexedDB; snapshot carries only the hash; portal renderer fetches + paints the blueprint on floor tab change.
  - Operator-authored internal note hides on the portal, shows with the Internal chip on the internal detail. Toggle defaults to Customer, resets after submit.
  - v30 → v31 migration walked a pre-migration blob and wrote `visibility = 'customer'` on the legacy un-flagged note.

### Known follow ups deferred

- **Whole-store `useProjectStore()` subscriptions on 7 screens** (EngineeringCanvas, ReportsCenter, ReviewMode, DeploymentMode, EstimatorView, ThreatSimulator, ProjectStateMenu). Narrowing each is a substantial pass; out of scope for the SC.7.6 MINOR cleanup.
- **`JSON.stringify` dirty detection in ProposalBuilder.dirty**. Code is semantically correct; perf cost is immaterial at MVP proposal sizes. Rip-and-replace risk outweighs the marginal saving.
- **Orphan SectionPanel in EngineeringCanvas**. Dead code (no JSX callers in the repo). The breadcrumb and overview leaks were patched in place; future cleanup can delete the panel wholesale or rewire it.
- **Dock-only DeviceType entries** (`cam.turret`, `inf.door` bare, `fls dock shorthand`, `inf.transformer`). Each is tagged with a `// dock-only` comment so a future schema extension can wire renderers + drop the comment.
- **Lazy migration of SC.6.6 inline blueprints to IndexedDB**. New snapshots write the hash; old SC.6.6 snapshots keep their inline payload until they're superseded out of the store. Lazy migration on portal mount is a future polish pass.

### Risk notes for post deploy smoke test

- Two schema bumps in one batch (v28 → v29 → v30 → v31 across SC.6 + SC.7). Each migration is a no-op or a defensive backfill; tested live against synthetic v29 and v30 blobs.
- IndexedDB lives at origin `deeper-vision-ashy.vercel.app` independently of the production canvas — fresh deploy gets a fresh `deeper-vision-blueprints` DB on first proposal send. Old snapshots that pre-date SC.7.3 continue to render via inline dataUrl.
- TicketNote visibility migration touches every persisted ticket, but the inner loop is a single field write per note with no allocation. Safe even on a workspace with 10k tickets.

## Last verified

- **Date:** 2026-05-18 (MVP Spine Completion SC.4 — Proposal Builder real wiring on top of SC.3)
- **Build:** `npm run build` — passing (vite v6.3.5, ~1941 modules, no TS errors)
- **Persist version:** `deeperVisionStore` v28 (SC.4.1 v27 → v28 migration adds the `proposals` slice; greenfield, no backfill)
- **UI-verified flow** (real `MouseEvent('click')` + real `Event('input')` against the rendered DOM, then re-read from the same DOM):
  1. Fresh localStorage → `/project/p1/canvas` loads cleanly.
  2. Real native click on `[data-testid="device-CAM-101"]` → SelectionPill renders; Edit button visible.
  3. Click `Edit` → drawer opens scoped to CAM-101.
  4. Switch to Coverage tile, slide rotation → 42°, FOV → 98°, range → 72 ft → store + localStorage both reflect new values.
  5. Hard reload → re-select CAM-101, re-open Coverage — sliders re-mount at 42 / 98 / 72.
  6. Add DOOR-101 (`addDevice`), click `[data-testid="door-DOOR-101"]` → click Edit → Stack tab.
  7. Click `[data-testid="door-assembly-reader/strike/rex/dps/controller/psu]` + `[data-testid="door-elec-fail-secure"]` + `[data-testid="door-readerloc-mullion"]` → all six hardware items plus electrification + reader location persist.
  8. Reload → all six persisted; opening Overview tile shows `Door assembly impact · 6` with subtotal `$2,530`.
  9. Navigate to `/estimate/p1` → "Access control · doors" section lists 6 DOOR-101 hardware lines summing to `$2,530`, in addition to the seeded DOOR-101 legacy hardware line.
- **Store-only verified** (action call, no UI click):
  - CV-9 multisensor Lens A
  - CV-12 pathway property edits (UI exists in PathwayDrawer; not exercised this pass)
  - CV-18 survey-status toggle buttons
  - CV-21 v4 → v5 legacy-scale migration (code path covered; no real legacy fixture loaded)
- **Not yet verified:**
  - Real-cursor (human) survey item add on a *device* (we exercised it on a *pathway* this pass; the camera EditDrawer's SurveyPanel uses identical wiring)
  - Pathway inspector edits via the PathwayDrawer's sub-tab inputs
  - Multisensor lens slider UI per lens (A/B/C/D)
  - Calibration screen photo upload (synthetic file events can't drive a `<input type="file">`)
- **Calibrated-measurement verification (this pass):**
  - At `scalePxToFt = 0.05` (seed default, no `calibratedAt`): inspector Position reads `13.0, 11.0 ft` for CAM-101 at (260, 220) px; scale bar shows the **Default scale** chip.
  - After `updateFloor({ scalePxToFt: 0.125, calibratedAt: now })`: inspector Position re-renders to `32.5, 27.5 ft`; PW-1 drawer header relabels to `CAT6A · 25 ft`; scale bar drops the Default chip.
  - 4-case scale-bar matrix (UI-verified): `0.05/no-meta → chip`, `0.125/meta → no-chip`, `0.05/meta → no-chip`, `meta-cleared → chip`.
  - Code-verified the 6 non-inspector measurement readouts (nearest distance, drag X/Y HUD, drag nearest HUD, dimension chain, measure tool, live cable draw) all read `currentFloorPxToFt` via the new subscription, and `TargetSimOverlay` reads `ftPerPxForFloor(s.floors[d.floorId])` directly.
- **Known remaining risks:**
  - StatusBar text "1 in = 10 ft" near the top of the canvas is still a static label (not part of the 8 sites the user asked to fix). It should be promoted to a calibrated readout in a follow-up.
  - The Drag HUD readouts assume the moving device's coordinates already match the *current* floor. When per-floor switching lands, devices belonging to a different floor than the active one will display ft against the active floor's scale — fine for visual feedback during a drag, misleading if cross-floor drag ever becomes possible.
  - Old persisted stores written before `calibratedAt` existed will hydrate with `calibratedAt: undefined` and therefore show the "Default scale" chip even if the user previously calibrated. Users who ran `/calibrate` in a prior version must re-run it once to set the metadata. No automatic migration was added — guessing whether a non-default `scalePxToFt` is "calibrated" would re-introduce the very heuristic this pass removes.
  - `doorAssembly` lives on `Device`, not on the canonical `Door` interface. This was the explicit MVP decision (canvas is the source of truth); migrating to a Device↔Door pair is a follow-up. Door records created via the (offscreen) door management UI continue to live in `state.doors` and roll up separately.
  - `deriveBOM` now consumes `doorAssembly` for door-as-Device records. The legacy `state.doors` rollup is unchanged. If both representations exist for the same opening you'll see double-counted lines until door records are unified.
  - Survey photo blobs are still metadata-only — only filename / size persist; the actual upload is labeled "pending" in the UI.
  - `DOOR_HARDWARE_PRICE` is a preview default. The Impact section footer says so explicitly; do not use the preview totals as a customer estimate without recalibrating against the integrator's pricebook.
  - Old persisted stores with the pre-fix `scalePxToFt > 1` are auto-inverted on first v5 hydrate. That is a destructive write to the user's localStorage scale — back up before the upgrade if a user has carefully calibrated scales they care about.
  - Real-cursor (human-driven) verification was not performed this pass; programmatic `MouseEvent('click')` is the strongest signal short of that. Recommend a Playwright run before each release.

## Backend Phase 1A — Supabase Auth + multi tenancy (this batch)

Two worlds coexist after this batch. Auth + organizations live in
Supabase; the Zustand store (design data, currently v31) still lives
in localStorage exactly as before. Phase 1B will move the design
data over.

- **BF1A.0-1 — Supabase client.** Project created in dashboard;
  URL + publishable key in `.env.local` (gitignored). Service role
  key never touched. Client at `src/app/lib/supabaseClient.ts`.
  Live health probe returns 200.
- **BF1A.2-3 — Schema + RLS.** Three tables live (`profiles`,
  `organizations`, `organization_members`). `is_org_member` /
  `is_org_admin` / `is_org_owner` SECURITY DEFINER helpers gate
  every cross row read. Bootstrap insert policy lets the org
  creator claim ownership; the post review patch (BF1A security
  patches) additionally requires `created_by = auth.uid()` to
  close the orphan org takeover surface.
- **BF1A.4 — Login screen.** Email + password sign in / sign up via
  Supabase Auth. Real errors, real loading, real session persistence.
  SSO / forgot / demo affordances HIDDEN until backend work for
  each lands. "Check your email" state after sign up.
- **BF1A.5 — Org create / join.** Invite codes (no SMTP dependency).
  `create_organization_with_owner` SECURITY DEFINER RPC creates
  org + first owner membership atomically. `create_invite` /
  `accept_invite` RPCs gate role conferral (admins can only mint
  member; owners can mint owner / admin) and rate limit acceptance
  to 10 attempts per 5 minutes per uid.
- **BF1A.6 — Auth gate.** UX layer routing gate around every
  internal route. Three real states + a transport error retry.
  SIGNED_OUT renders the loading frame synchronously before
  navigate to avoid a flash of protected content. The design data
  remains in localStorage behind the gate.
- **BF1A.7 — Verification doc + deploy proposal.** Full record in
  `docs/BACKEND_PHASE1A_VERIFICATION.md`.

**Deferred to Phase 1B:** every design entity (projects, devices,
pathways, idfs, proposals, approvals, work orders, tickets, etc.)
migrates from localStorage to Supabase tables carrying
`organization_id`. The schema plan is fully written out in
`docs/BACKEND_SCHEMA_PLAN.md` so 1B is a clean continuation.

**Live RLS isolation test deferred:** the clean test that signs up
two real users through the public auth endpoint requires
`mailer_autoconfirm: true` AND a cleared email rate limit. Both
prerequisites pending. The shell script is in chat; runs against
the live project as soon as both clear.
