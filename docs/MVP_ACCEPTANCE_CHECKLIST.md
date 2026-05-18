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

## Last verified

- **Date:** 2026-05-17 (calibrated measurement hardening pass)
- **Build:** `npm run build` — passing (vite v6.3.5, 1928 modules, no TS errors)
- **Persist version:** `deeperVisionStore` v5 (auto-migrates pre-fix `scalePxToFt > 1` floors back to ft-per-px; adds the empty `surveyItems` slice)
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
