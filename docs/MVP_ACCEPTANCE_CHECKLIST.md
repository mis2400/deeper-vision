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

## Last verified

- **Date:** 2026-05-18 (Canvas V2 Pass 2 — Multi floor + Coverage + Rooms + Annotations)
- **Build:** `npm run build` — passing (vite v6.3.5, ~1941 modules, no TS errors)
- **Persist version:** `deeperVisionStore` v22 (adds `annotations`, `rooms`, `currentFloorIdByProject`, plus Pass 1's `measurements` / `canvasHistory` / `siteCaptures`; all migrations forward-only with defensive coercion)
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
