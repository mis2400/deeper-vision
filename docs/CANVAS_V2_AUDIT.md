# Canvas V2 Audit
*Discovery only · date: 2026-05-18 · branch: audit/canvas-v2*

Scope: `src/app/screens/EngineeringCanvas.tsx` (14721 lines), the canvas component tree under `src/app/components/canvas/`, and the entities they read/write in `src/app/store/projectStore.ts` (3264 lines) + `src/app/store/types.ts` (1756 lines). The Canvas screen renders the heart of the product: surveyors place cameras, doors, IDFs, pathways, walls, and produce real security designs.

Headline numbers
- One file, ~14.7k SLOC. 117 top-level declarations. ~60 inline components from `TopBar` through `FloorplanBackgroundControls`. 247 `useState/useRef/useEffect` call sites in the file. 58 distinct `useProjectStore` subscriptions just inside this one component. 170 ref/state hook lines flow through one root component.
- Heart of the canvas state lives in roughly 60 `useState` calls in `EngineeringCanvas()` (lines 696–2034), plus 12 refs and 8 layered useEffects. Every store mutation by every nested component re-renders that root.
- Tools shipped: `select / pan / measure / wall / cable / conduit / pathway / calibrate` (line 75). Text / comment removed during the gap-closure pass with the note "never wired to real handlers."
- Persist version is v17 (`projectStore.ts:1599`). Migrations exist but no canvas state migration since v6 (workOrderProgress). Pre-fix scale inversion happens once at v5.

Reviewer voice: senior engineer who has shipped Figma/Miro/Autodesk-class canvas tools. Bias is direct, factual, and ruthless about controls that don't earn their place.

---

## A. What's implemented and working

Placement and editing
- Drag from bottom device bar onto canvas, including click-to-arm fallback so a missed drag still becomes an intent (`EngineeringCanvas.tsx:1322` armedProduct, `:1603` placeProductAt).
- 8 device kinds, ~13 device sub-types (`:79`), driven from one PRODUCTS adapter view of the unified catalog (`:509`).
- Drag-onto-host attach with compatibility validation via `lib/compatibility.ts canHost()`. Door/IDF/rack hosts highlight an attach ring during drag (`:1741` hoverHost, `:1808` findHostUnderPointer).
- Door-as-device assembly: a single door can hold reader, strike, maglock, REX, DPS, contact, intercom, panic, autoop, controller, PSU, each with a Proposed/Existing flag (`store/types.ts:557`).
- Multisensor 4-lens engineering with linked/independent modes and per-lens rotation/FOV/range/focal/enabled (`:317` DEFAULT_MULTISENSOR_LENSES, `:8295` MultisensorLensChips).
- Rotation ring + cone tip + FOV edge handles with pan-aware math (`:7435` ConeHandles, `:7531` RotationRing).
- Duplicate selected with offset and deep-clone of lens config (`:2004`).
- Color override per device from an 8-color palette (`:295` DEVICE_COLOR_PALETTE).
- Per-device hide / lock toggles via Layers panel (`:5537`–`:5550`, persisted to localStorage keys `canvas:<projectId>:hidden|locked`).

Drawing tools
- Wall draw with Enter/Esc commit (`:1715`).
- Measure tool with live rubber-band (`:813` measure state, `:6056` rubber band).
- Cable/conduit/pathway draw with Enter to finish, Esc to cancel, vertex editing via `PathwayVertexEditor` (`:873` cableDraw, `:906` finishCableDraw, `:12401` PathwayVertexEditor).
- Vertex insertion on segment hover and vertex deletion with Backspace (`:12252` PathwaysOverlay, `:12564` keydown handler).
- In-canvas calibrate tool: click two points, enter feet, commits `scalePxToFt + calibratedAt + calibrationReferenceFt + calibrationMeasuredPx` to the floor (`:821`, `:847` applyCalibration).

Navigation and viewport
- Pan with Hand tool (`:5932`). Pinch/wheel zoom centred on cursor (`:6008`).
- Auto-fit on mount, on viewport resize, on background change. Honours a `userTouchedViewRef` so the camera doesn't snap during edits (`:1461`).
- Zoom dock with in/out/fit/actual-scale (`:13789` ZoomDock, `:1408` applyFit, `:1414` applyActualScale, `:1419` applyCenter).
- MiniMap with overview bounds matching main viewport (`:13828`).
- StatusBar showing tool, zoom, device counts (`:13915`).

Selection model
- Click selects, Shift/Cmd extends (LayersPanel `:5449`).
- Marquee selection in Select tool when the pointer starts on inert geometry (`:5938`).
- Selection pill anchored to the device with primary actions + a More overflow, kind-specific (`:8374` SelectionPill, `:8736` ExpandMenu).
- Multi-select pill with group actions; URL `?focus=<deviceId>` deep-selects from AI Assistant citations (`:961`).
- Selected pathway gets its own PathwayDrawer side panel (`:10356`).

Persistence
- All canvas entities persist via Zustand v17 store, partialised to local-storage. Devices, doors, pathways, IDFs, floors, surveys, attachments, work orders, pricebooks, AI conversations, audit logs all serialise (`projectStore.ts:1599`).
- Per-project canvasLayers and canvasDisplay overrides persist (`projectStore.ts setCanvasLayer/setCanvasDisplay`).
- Per-project tech-model filter persists (`projectStore.ts setProjectTechModel`).
- Floor calibration `(scalePxToFt, calibratedAt, calibrationReferenceFt, calibrationMeasuredPx)` is the source of truth for every foot conversion in the canvas (`:733` currentFloorPxToFt). Earlier inversion bug auto-migrates at v5.
- Imported floorplan background persists inline as data URL plus position/scale/rotation/opacity (`store/types.ts:436` FloorBackground).
- Walls persist on the floor record `(floor.walls)`. Pathway vertices and lengths persist on `Pathway`.

Coverage and analysis
- DORI bands rendered on selected cone (`:7275`), with target simulator that uses real EN-50132-7 / IEC 62676 px/m math and the camera's floor calibration (`:11505` TargetSimOverlay).
- Camera FOV cone direction respects pan/zoom for handle math.
- Live AI Optimize panel ranks and explains hardening hints for the selected camera (`:10243` AiOptimizeSection).
- Intelligence layer surfaces blindspot / overlap / PoE / low-light chips toggleable from the top-right pill (`:11994`).

Engineering layers and display
- 10 declared engineering layers (`store/types.ts:56` EngineeringLayer). 5 are wired in the panel (`:5697` rows): fov, labels, pathways, dimensions, presence. Rooms/NEC/thermal/bandwidth/conduit_ids are intentionally hidden from the panel today (acknowledged at `:5692`).
- Display preferences: 6 base maps, 3 icon sizes, 4 label densities, 0–100 % coverage opacity, persistent per project.

Cable and conduit
- 8 cable types, 6 conduit types, 30+ trade sizes (`:3953` EMT_SIZES, `:489` CABLE_TYPES).
- Conduit fill calculation against bundle count with pass/fail (`:3966` computeBundleFill).
- Bundle inspector dialog (`:3982`) and per-pathway PathwayDrawer with route / conduit / cables-inside / accessories / suggestions / BOM / notes / files sub-tabs (`:10356`).
- IDF port schedule renders per-switch port assignment (`:10124` IdfPortScheduleSection).
- Run-to-IDF dialog wires devices to an IDF with auto-bundle (`:4177`).
- Patch panel and cable accessory auto-attach within 60-px proximity to the nearest pathway (`:1948`, `:1957`).

Export and reports
- Live BOM drawer on canvas with proposed/existing split, CSV with UTF-8 BOM and RFC-4180 quoting (`:13941` ReportExportRow, drawer entry at TopBar BOM button).
- Report Builder dialog produces jsPDF (`:3733`, `:3781`). Reports route at `/project/:projectId/reports` reuses the same data.
- Project state envelope export/import as JSON via `ProjectStateMenu` (`components/canvas/ProjectStateMenu.tsx`).
- Named local snapshots via `services/projectSync.ts`.

Modes
- Default / field / canvas view modes plus browser Fullscreen API integration (`:1049`, `:1089`).
- Focus mode pairs with Fullscreen API and survives `fullscreenchange` events (`:1114`).
- Persona/role pill renders on TopBar; threat simulator integration adds `?hint=…` overlays (`:957`).

Honesty surfaces
- Coverage / Compatibility / Telemetry tabs are honest "preview / not wired" panels for non-cameras (`:11380`–`:11402`).
- Demo scan is now hidden behind the More overflow.
- Pricebook overrides surface as "Overridden" badges on affected rows.

---

## B. What's half-shipped or flawed

### B1. Undo / Redo missing on the canvas (Severity: CRITICAL, Effort: L)
- Evidence: `EngineeringCanvas.tsx:790` comment "diff … to keep undo history concise" implies a stack that doesn't exist. No store action records history. `useProjectStore` exposes no undo/redo selector. The two TopBar buttons were removed during the lockdown pass (`FINAL_LOCKDOWN_AUDIT.md:81` "Visual only, no handler … HIDE this pass").
- What's wrong: a 14k-LOC design surface with no undo. One stray Delete or Cmd-A + drag loses placement work permanently. This is the single biggest reason an operator will not trust the tool with real customer work.
- What was supposed to happen: the lockdown audit promised "action history is a real subsystem; honest to hide buttons until built." Two years of "next pass" never landed. CANVAS_AUDIT.md sec 13 still lists "Undo / Redo wiring" as deferred.

### B2. The single-component monolith blocks Edit confidence (Severity: HIGH, Effort: L)
- Evidence: `EngineeringCanvas.tsx:1` through `:14721`. 60+ inline components, 247 hook sites, 58 store subscribes in one component. `DEEPER_VISION_BUILD_STATE.md:340` calls this out as a Known Technical Risk: "Vite HMR may fail mid-edit … the file is very large."
- What's wrong: every store change re-runs the root component, which re-creates every callback that is closed over `devices`, `pan`, `zoom`, `tool`, etc. The dependency arrays on the keyboard, drag, and marquee handlers (`:1734`, `:1996`, `:1582`) are deep enough that any innocuous edit risks a stale closure or an infinite loop.
- What was supposed to happen: F5 in `AUDIT.md` filed this in 2025 ("3879-line monolith"). Nothing was extracted; the file is now nearly 4× larger.

### B3. Media tab is a visibly disabled control (Severity: MEDIUM, Effort: S)
- Evidence: `:11461`–`:11481` renders a disabled "Add media (disabled)" button with the disclosure "Preview only · file persistence not wired."
- What's wrong: CLAUDE.md `Honesty contract for not-yet-wired features` rules this out: "If a feature doesn't work, the control doesn't render. No disabled buttons with disclaimer text." The Files tab (AttachmentPanel) ships real attachments, so Media is also redundant.
- What was supposed to happen: hide the tab entirely. The Files tab covers the workflow.

### B4. History tab is a visibly disabled control (Severity: MEDIUM, Effort: S)
- Evidence: `:11483`–`:11495` "Session preview · audit log not wired." Identical CLAUDE.md violation.
- What was supposed to happen: hide the tab, restore it once per-object change history is captured.

### B5. Floor switcher in TopBar is a static dropdown (Severity: HIGH, Effort: M)
- Evidence: `EngineeringCanvas.tsx:717` "Which floor are we editing? For now: first floor of this project. (When multi-floor switching lands…)". TopBar exposes a Floor dropdown (`:3164` props.floor). The dropdown updates local `floor` state but `currentFloorId` is always `firstFloorOfProject` (`:720`). `BottomDeviceBar` line `:13204` carries the same TODO. So changing the dropdown changes nothing visible.
- What's wrong: dead control. Operator clicks "Level 2" and gets the same plan back. Mute violation of honesty contract.
- What was supposed to happen: switching floors should swap the active floor's background, walls, devices, BOM scope. Multi-floor projects are core scope; CANVAS_AUDIT.md item 2.1 promises this.

### B6. "Verified scale" chip is the only way to recalibrate (Severity: MEDIUM, Effort: S)
- Evidence: `:2933` V1 1A.5 made the badge a button that arms calibrate mode. There is no visible "Recalibrate" entry anywhere else once a floor has been calibrated.
- What's wrong: discoverability. The user is unlikely to click a small "Verified" pill expecting it to swap into calibrate mode. The badge should keep its current behaviour and a clearly-labelled "Recalibrate" should also live under the Floorplan controls (`:14235`) and inside the Calibrate route.

### B7. Lock and Hide per device are panel-only (Severity: MEDIUM, Effort: S)
- Evidence: `LayersPanel:5537`–`:5550` shows lock/hide toggles. The SelectionPill's overflow menu (`:8736` ExpandMenu) removed Lock during the cleanup pass with the note "Lock action is gone … re-add once `updateDevice({locked:true})` is wired" (`MVP_ACCEPTANCE_CHECKLIST.md` CV-6).
- What's wrong: lock is implemented (`lockedIds` Set in localStorage), but the canvas itself does not enforce it — `setDevices` (`:756`) still moves a device whose id is in `lockedIds`. The canvas honours hidden via a `hiddenIds.has(d.id)` filter (`:2186`); lock is not used anywhere. So lock is a visible chip on the layers panel that visually toggles but does not actually prevent drag, rotate, or delete.

### B8. Pop-out window is a true pop-up that browsers block (Severity: LOW, Effort: S)
- Evidence: `:2122` Pop-out opens `/project/.../canvas?popout=1` via `window.open`. Toast on block.
- What's wrong: in Chrome with default settings, this is blocked silently every time. The persona of the user (operator on a single MacBook) almost never has pop-ups whitelisted. The "two-monitor" intent is real but the implementation is the worst delivery vector.
- What was supposed to happen: either drop the feature or expose it via Open-in-New-Tab semantics with a target=`_blank` link.

### B9. Hidden engineering layers still appear in the schema (Severity: LOW, Effort: S)
- Evidence: `:5697` EngineeringLayersSection lists 5 working layers. Schema in `store/types.ts:56` declares 10 (rooms, nec, thermal, bandwidth, conduit_ids, presence). Hidden ones are still wired through `setCanvasLayer`.
- What's wrong: any URL that flips them on is silently dropped; the canvas never paints them. Either prune the enum or paint stubs that say "Coming Q3."

### B10. Coverage cone density and intelligence chips overlap visually (Severity: LOW, Effort: M)
- Evidence: `:11994` IntelligenceLayer paints flagged-issue chips above devices. `:7304` FOV renders coverage. On a busy floor (20+ cameras), the chips sit on top of cones with no edge masking.
- What's wrong: visual collision at scale. Operator can't read both. Add a small offset or hide chip-stack when zoom <1.

### B11. Multi-select pill does not expose every group action (Severity: MEDIUM, Effort: S)
- Evidence: SelectionPill `:8374` renders for a single device. When `selIds.size > 1`, only the Layers panel exposes hide/lock — no on-canvas multi-action toolbar appears. Run-to-IDF (`:4177`) is the only multi-select action surfaced.
- What's wrong: standard expectation in a canvas tool — bulk delete, bulk align, bulk lock, bulk color, bulk duplicate. None exist.

### B12. Drag accessory auto-attach uses midpoint distance only (Severity: LOW, Effort: M)
- Evidence: `:1957` cable accessory attach picks "the nearest pathway midpoint within 60 units."
- What's wrong: midpoint distance is wrong for long runs. A jack dropped at vertex 5 of a 10-segment run will fail to attach to that run because the midpoint is far away. Use projected distance to the nearest segment.

### B13. `placeProductAt` and the drag-drop path duplicate logic (Severity: LOW, Effort: M)
- Evidence: `:1603` placeProductAt (click-to-arm) and `:1808` pointerup handler each compute prefix/cohort/id with subtle differences. The drag path supports cable-accessory attach; click-to-arm does not.
- What's wrong: two code paths drift. Asymmetric features depend on whether the user clicked or dragged. Unify into one helper.

### B14. Marquee selection ignores hidden devices (Severity: LOW, Effort: S)
- Evidence: `:5986` `for (const d of devices)` iterates the prop-filtered list (which already excludes hidden). Fine in isolation but visually confusing: a marquee around a hidden glyph "selects nothing".
- What's wrong: subtle UX bug — user expects either (a) marquee selects everything in the rectangle or (b) hidden items are not interactable. Today, hidden items are gone from the marquee result but still visible in the layers panel as not-selected. Pick one model.

### B15. Wall tool only works on blank base (Severity: LOW, Effort: S)
- Evidence: `QuickTools:13747` showWall is gated. When a floorplan background is present, wall drawing is hidden. But there's no inline guidance — operator who wants to trace over a floor plan finds the wall tool missing without explanation.
- What's wrong: the design likely assumed walls = sketched plan, but tracing over a blueprint is a real workflow. Either re-enable with a "trace mode" or surface the rationale inline.

### B16. Pathway distance over 295 ft uses copper-only warning text on all cable types (Severity: LOW, Effort: S)
- Evidence: `:10397` `overDistance = isCable && !cableType.includes('fiber') && lenFt > 295`. Warning text at `:10493`.
- What's wrong: substring match on `'fiber'` skips fiber. Good. But other lengths (e.g. Cat6 vs Cat6A) have different reality (most Cat6A patch is rated 100 m / 328 ft, not 295). Codify the per-cableType limit instead of one hard-coded threshold.

### B17. Calibrate apply panel coexists with measure overlay (Severity: LOW, Effort: S)
- Evidence: `:820` calibrate state, `:813` measure state. Both render in the same area. User flipping between Measure and Calibrate sees both overlays stacked momentarily.
- What's wrong: tool-mode mutual exclusion isn't enforced. Resetting one when the other arms is missing in a few code paths.

### B18. ReportBuilderDialog "Print snapshot" uses a synchronous SVG-serialise + DOM walk (Severity: LOW, Effort: M)
- Evidence: `:3781` jsPDF dynamic import inside a click handler that also walks the SVG.
- What's wrong: at 50+ devices on a complex blueprint, the dialog "Generate" button can pause the main thread for hundreds of ms. No spinner is shown until after the freeze.

### B19. TopBar pop-out + Compass nav exists; LeftNavRail commented out in the layout (Severity: LOW, Effort: S)
- Evidence: `:2151` "Project section nav … used to live here on the left … now reachable through the TopBar overflow menu." Yet `LeftNavRail` and `MapsPanel` components remain in the file (`:3506`, `:3535`) and are still imported elsewhere.
- What's wrong: dead components mounted only in unreachable code paths. ~400 SLOC that no canvas user can see.

---

## C. Promised or requested but not implemented

### C1. Drag-onto-host hit-test fully wired (Severity: HIGH, Effort: M)
- Source: CANVAS_AUDIT.md §10 "Drag-onto-host hit detection (drop a reader onto a door, get attached) — DEFERRED — hit-test wiring is its own pass." That was 2025. The hit-test is now in `:1808` findHostUnderPointer + `:1948` cable accessory path, BUT the door-only hardware classes (strike, maglock, REX) still drop on the floor without auto-attach if the operator releases more than 26 px away from a door. Toast warns but the device sits orphaned.
- Why it matters: every real install drops a strike onto a door — that's the whole point of the access-control workflow. Operators who get the warning toast and ignore it end up with floating accessories in the BOM.

### C2. Real map tile providers for satellite / hybrid / street (Severity: MEDIUM, Effort: L)
- Source: CANVAS_AUDIT.md §13 "Map mode rendering for Street / Hybrid / Dark — picker shows them; FloorPlan still paints them as Blank. Either ship a tile provider or hide those options." `FINAL_FUNCTIONAL_LOCKDOWN.md` later claims 6 distinct simulated surfaces. Reading `:6957` FloorPlan, satellite/street/hybrid/dark render synthetic patterns, NOT real tiles. SimulatedMapBadge labels them honestly but the brief asked for an honest answer.
- Why it matters: outdoor camera planning needs real aerial imagery. Today the canvas cannot trace over a real parking lot.

### C3. Multi-floor switching (Severity: HIGH, Effort: M)
- Source: `EngineeringCanvas.tsx:717` "For now: first floor of this project. (When multi-floor switching lands…)". `BottomDeviceBar:13204` TODO. Floor dropdown in TopBar present but inert.
- Why it matters: any multi-storey building (every retail, every corporate office) needs separate floor plans. Current state effectively limits the product to single-storey survey, which is wildly under-spec for Mohammad's market (commercial / multifamily / education).

### C4. Real VisionScan / blueprint OCR / DWG ingest (Severity: HIGH, Effort: L)
- Source: `DEEPER_VISION_BUILD_STATE.md` "VisionScan remains a simulated AR / LiDAR walkthrough." `FINAL_FUNCTIONAL_LOCKDOWN.md` lists Import button removed because no real importer backend exists.
- Why it matters: most security designers receive PDFs / DWGs from architects. The flow today is "import a PDF as background image" — losing the layer/wall/door semantics that DWG carries. Competitor (Verkada Site Designer, Avigilon Cloud) consume DWG natively.

### C5. Cable run length includes 10 % slack but no per-floor riser drop (Severity: MEDIUM, Effort: S)
- Source: `:10490` "Route length 10 % slack + service loop" but vertical riser (floor-to-floor) is not added anywhere.
- Why it matters: real cable estimates for multi-floor projects need per-riser drop heights. Once multi-floor lands (C3), this becomes urgent.

### C6. Per-object change history (Severity: MEDIUM, Effort: M)
- Source: drawer History tab `:11483` "Session preview · audit log not wired."
- Why it matters: when a customer asks "who moved CAM-12 and when?", the only answer today is "we don't know."

### C7. Live telemetry and device connectors (Severity: LOW, Effort: L)
- Source: drawer Coverage/Telemetry "No live telemetry feed connected. … will appear here when the camera connector ships." Repeated for doors/readers/IDFs.
- Why it matters: aligned with the customer pitch but explicitly out of scope until cloud connectors exist.

### C8. Room polygons and room-scoped selection (Severity: MEDIUM, Effort: M)
- Source: `SURVEYOR_FINAL_PUNCHLIST.md` "Real-time room detection ('camera in this room') needs polygon room geometry that's not yet captured." `Floor.rooms` already exists in the schema (`store/types.ts:427`) but is never populated, never read.
- Why it matters: "Select all cameras in lobby" is the single most-asked-for grouping in field work. Floor-scoped selection is the placeholder today.

### C9. Real Lock action enforcement (Severity: MEDIUM, Effort: S)
- Source: `MVP_ACCEPTANCE_CHECKLIST.md CV-6` "Lock action is gone … re-add once `updateDevice({locked:true})` is wired." 14 months later it isn't.
- Why it matters: see B7 — lock chip exists but does nothing protective.

### C10. AI Assistant inline on canvas (Severity: LOW, Effort: M)
- Source: `DEEPER_VISION_BUILD_STATE.md` known gap: "AI inline assistant as a side-panel. Inline issue chips already exist via IntelligenceLayer; a true conversational sidebar is not yet shipped." The standalone /ai route exists; the canvas does not embed it.
- Why it matters: the assistant already knows the selection via `setAssistantContext` (`:1007`). It just isn't surfaced.

### C11. Real DWG/IFC export (Severity: LOW, Effort: L)
- Source: not explicitly promised but assumed by the "real security designs" framing. Today export is PDF + CSV only.
- Why it matters: integrators usually have to re-draw deliverables in AutoCAD for permit. DWG/IFC export would unlock the handoff.

### C12. Share/collaborate (Severity: LOW, Effort: L)
- Source: `FINAL_FUNCTIONAL_LOCKDOWN.md` "Top bar Share button — removed. No sharing backend." Presence cursors are mocked (`:1657`).
- Why it matters: real collaboration would replace the export/import dance entirely. Mock cursors imply a feature that isn't there.

---

## D. Standard features missing

(Verified against the file before listing. Skipped items already shipped: marquee multi-select, alignment-guides for moving devices at 5-px tolerance, snap to 20-px grid via `:1917`, the keyboard delete + escape + meta-zoom, the cmd-click + shift-click range selection in the layers panel, duplicate via the SelectionPill, PNG/PDF export.)

### D1. Arrow-key nudge for selected device(s) (Severity: HIGH, Effort: S)
- What it does: arrow keys move selection 1 px; with Shift, 10 px. Industry-standard in every design tool since 1995.
- Why it matters: precision placement after a coarse drop. Today the operator has to drag with the mouse and hope. Grep confirms zero arrow-key handlers in the canvas keydown effect (`:1675`).

### D2. Copy / paste / duplicate keyboard shortcuts (Severity: HIGH, Effort: S)
- What it does: Cmd-C, Cmd-V, Cmd-D for copy / paste / duplicate. Today duplicate is the only one and it's pill-only (`:2004`).
- Why it matters: 12 cameras down a hallway is faster with paste than with the bottom bar. Standard expectation.

### D3. Alignment / distribute commands (Severity: HIGH, Effort: M)
- What it does: select 3+ devices → align left/right/centre, distribute horizontally/vertically. Today, the only assist is the 5-px magnetic snap on a single drag.
- Why it matters: a row of cameras across a parking lot looks engineered, not eyeballed. Figma-class table-stakes.

### D4. Group / ungroup (Severity: MEDIUM, Effort: M)
- What it does: bind devices into a logical group (e.g. all entrance hardware for door D-3) so they move/rotate as one and inherit attributes.
- Why it matters: door assemblies are partially this (DoorAssembly), but cross-device groups (a camera + intercom + reader at one entrance) have no representation.

### D5. Smart guides (Figma-style snap lines when moving) (Severity: MEDIUM, Effort: M)
- What it does: while dragging, render alignment lines to other devices' centres / edges / 20-px increments and snap with tolerance.
- Why it matters: the existing snapTargets (`:5894`) draws nothing visible. The 4-px-tolerance behavior triggers but the user can't see the guide line.

### D6. Per-device lock that actually locks (Severity: HIGH, Effort: S)
- What it does: locked devices ignore drag, rotate, delete. Today `lockedIds` Set is decorative (see B7).
- Why it matters: once a floor is laid out, the senior engineer locks final positions so a junior reviewer doesn't bump them.

### D7. Coverage visualisation for non-cameras (Severity: HIGH, Effort: M)
- What it does: motion-sensor range circles, AP wifi range, intrusion zones, access strike reach. Today only camera cones render.
- Why it matters: integrators sell motion + intrusion. The canvas only paints camera coverage, so a sensor coverage gap is invisible.

### D8. Annotations: text labels, callouts, arrows (Severity: MEDIUM, Effort: M)
- What it does: drop a text label or arrow callout on the floor plan. The Text and Comment tools were removed (`:72` comment) for being dead. They're standard.
- Why it matters: "Coverage tested 2026-04-12" or "FOV obstructed by tree" written directly on the plan. Today this lives in object notes that don't show on the plan.

### D9. Measurement probe with running tape (Severity: LOW, Effort: S)
- What it does: persistent on-canvas tape measure that survives between selections, plus area measurement (square footage).
- Why it matters: the measure tool exists (`:813`) but clears on next click. No area probe.

### D10. Layer locking (not just visibility) (Severity: LOW, Effort: S)
- What it does: lock the FOV layer so it can be shown but not clicked through. Today layers toggle only on/off.
- Why it matters: reviewing FOV without accidentally picking a camera.

### D11. Layer visibility per kind not just per layer (Severity: LOW, Effort: S)
- What it does: hide all access devices while keeping cameras visible. Today only per-device hide works (LayersPanel), not per-kind.
- Why it matters: presentation modes ("show only cameras"). PowerPoint-class.

### D12. Version history / named saves / snapshots inline (Severity: MEDIUM, Effort: S)
- What it does: snapshots exist via Project State menu but are buried. A "Save snapshot before this change" should be one click.
- Why it matters: B1's lack of undo bites every day; snapshots are the half-mitigation today, but the entry point is too deep.

### D13. Export formats: PNG, DWG, IFC (Severity: MEDIUM, Effort: L for DWG/IFC, S for PNG)
- What it does: native raster image export (PNG) of the canvas; CAD interchange (DWG / IFC) for handoff to architects and permitting.
- Why it matters: see C11. PNG specifically is a 2-hour add (canvas to data URL + download).

### D14. Print to scale (Severity: MEDIUM, Effort: M)
- What it does: print a Tabloid sheet at 1/4" = 1' true scale.
- Why it matters: field crew tapes the printout to a clipboard. Today reports route prints whatever the browser does.

### D15. Symbol library completeness (Severity: LOW, Effort: M)
- What it does: a glyph for every DeviceType. Today, DEVICE_ICON (`:7605`) maps 70+ types, but a few new ones (fls.*, bld.*, cyb.*) fall back to a generic icon.
- Why it matters: a kit-of-parts that looks right is what makes the canvas feel like an industry product.

### D16. Camera lens-config UI: focal sliders per lens (Severity: LOW, Effort: S)
- What it does: per-lens focal/range slider on multisensor. `DEEPER_VISION_BUILD_STATE.md:340` known risk: "Multisensor focal length is still a per-lens field, but there is no direct focal drag handle yet."
- Why it matters: the data model is there; the UI isn't.

### D17. Door hardware schedule (export) and code compliance checks (Severity: MEDIUM, Effort: M)
- What it does: NFPA 101 egress checks, ADA reach-range checks for readers, fire-rated hardware checks. Door assemblies have warnings (`:9304`) but they're heuristic. A schedule export grouped by opening is missing.
- Why it matters: any AHJ submittal needs a door hardware schedule. Today it's CSV-derivable but not a first-class export.

### D18. Conduit fill calculation displayed inline (Severity: LOW, Effort: S)
- What it does: live fill % on canvas pathway label as cables get assigned. Today `computeBundleFill` exists (`:3966`) but the result only appears in the bundle inspector dialog.
- Why it matters: NEC 40 % fill is the rule. Inline number prevents over-fill before the inspector ever opens.

### D19. Run-length and bend-count on cable runs (Severity: LOW, Effort: S)
- What it does: derive bend count from vertex count, surface as a warning when > 4 90° bends (pull-tension limit). lengthFt is shown; bend count isn't.
- Why it matters: integrators care because pulled fiber breaks past 4 bends.

### D20. Cross-floor risers / stack view (Severity: HIGH, Effort: L)
- What it does: connect a cable from a device on floor 1 to an IDF on floor 3. Today every entity is locked to one floorId.
- Why it matters: once C3 (multi-floor) lands, this is the next thing every operator hits.

### D21. Copy floor / mirror floor (Severity: MEDIUM, Effort: M)
- What it does: stamp the same layout (with adjusted floor names) across 8 identical hotel floors.
- Why it matters: hospitality / multifamily is a giant chunk of Mohammad's market. Repetitive floors are the norm.

### D22. Search and locate by ID/label (Severity: MEDIUM, Effort: S)
- What it does: Cmd-K palette that jumps the view to a device by id/label.
- Why it matters: on a 200-device floor, "find CAM-101" should be a search, not a scroll.

### D23. Zoom-to-selection (Severity: LOW, Effort: S)
- What it does: a key (e.g. F) zooms to fit the selection. Industry standard.
- Why it matters: complementary to D22.

### D24. Saved camera/lens presets (Severity: LOW, Effort: M)
- What it does: save a custom "Verkada CD92 + 100 ft DORI Identify range" preset and reuse on next placement.
- Why it matters: every integrator has 5 SKUs they place on 90 % of jobs.

### D25. Mobile / tablet touch handling (Severity: LOW, Effort: L)
- What it does: pinch zoom, two-finger pan, long-press for context menu. Today the canvas uses pointer events which mostly work on iPad, but rotation handles and lens chips are tiny.
- Why it matters: field surveyors work on iPad. Today they fight the UI.

---

## E. Performance and correctness gaps

### E1. Root component re-renders on every store mutation (Severity: HIGH)
- Evidence: 58 `useProjectStore` subscriptions in `EngineeringCanvas.tsx`. Many select the entire `devices` / `pathways` / `floors` map (e.g. `:712 storeDevices = useProjectStore((s) => s.devices)`).
- What to look for: any single device update via `updateDevice` triggers a new `devices` reference; `useMemo` at `:745` re-runs; root re-renders; every child receives new prop identities. At 200 devices, the React DevTools profiler will show 30–60 ms per drag step.

### E2. SVG canvas re-renders every device on every drag step (Severity: HIGH)
- Evidence: `CanvasSurface` at `:5875` renders `devices.map(...)` for FOV cones, glyphs, labels, halos. No `React.memo` on `FOV`, `HardwareGlyph`, `RotationRing`, `ConeHandles`.
- What to look for: 200 devices × 4 sub-renderings × 60 fps drag = 48 000 React reconciliations / second. The atmosphere filters (grain, vignette, fov-bloom defined at `:6109`) compound the cost.

### E3. `setDevices` facade dispatches add/update/remove via diff (Severity: MEDIUM)
- Evidence: `:756` setDevices reads the entire store snapshot every call, does a Set diff, and dispatches one action per changed device.
- What to look for: marquee delete of 50 devices makes 50 store actions and 50 persist writes. Should batch into a single transaction.

### E4. `surfaceRef`/event-bus pattern leaks listeners on hot reload (Severity: LOW)
- Evidence: `:1475` adds 6 custom event listeners on the SVG element with `devices` and `setDevices` in deps (`:1582`). Each device change rebuilds the listener chain.
- What to look for: in dev, HMR can leave stale listeners alive briefly. In prod, every `devices` reference change re-registers.

### E5. Drag-and-drop uses window-level pointer listeners (Severity: LOW)
- Evidence: `:1989` `window.addEventListener('pointermove', onMove)` inside the drag effect. Cleanup in the return.
- What to look for: listener thrash on every drag start/end. Works but is heavier than React's SyntheticEvent path. Marquee uses pointer capture more cleanly.

### E6. Floorplan background image is base64 in localStorage (Severity: MEDIUM)
- Evidence: `store/types.ts:436` FloorBackground stores `dataUrl` inline. 5 MB localStorage quota in most browsers.
- What to look for: a 4-floor project with high-res blueprints can blow the quota silently. The persist wrapper logs the failure but the user sees no error. Migration to IndexedDB or compressed JPEG is overdue.

### E7. Multi-floor `currentFloorId = firstFloorOfProject` hard-coded (Severity: CRITICAL for correctness when multi-floor ships)
- Evidence: `:720`. Devices `filter` (`:745`) uses this id; if a device's `floorId` doesn't match, it's hidden. Floor.scalePxToFt likewise hard-coded.
- What to look for: today this is "correct enough" because every device sits on floor 1. The day someone adds a second floor and a device on it, the second-floor devices vanish. This is a latent correctness trap.

### E8. Coordinate inconsistency in target sim across floors (Severity: LOW)
- Evidence: `:11519` TargetSimOverlay reads `ftPerPxForFloor(d.floorId)` correctly. But the canvas-wide `currentFloorPxToFt` (`:733`) reads the active floor, not the device's floor. The drag HUD readouts (`:5905`) compute distances using the active floor's scale.
- What to look for: cross-floor drag (currently impossible, see E7) would silently render the wrong feet.

### E9. Stale closures in custom-event handlers (Severity: LOW)
- Evidence: `:1485` `onStackAttach` reads `devices` from the closure. Effect deps `[devices, setDevices]` so it rebinds every change. Works, but the rebind cost (E2 amplifier) is real.

### E10. `useEffect` at `:1346` writes localStorage on every hidden/locked change (Severity: LOW)
- Evidence: JSON.stringify of a Set, on every toggle. Marquee-hide 100 devices = 100 writes.

### E11. Onboarding modal mounted by default (`onboarded = true`) (Severity: LOW)
- Evidence: `:700`. Cosmetic. The "blueprint or blank?" picker is intentionally suppressed, but the dead component (`:3070` Onboarding) still ships in the bundle.

### E12. `cableDrawRef` mirror exists to dodge a known React 18 render-phase warning (Severity: LOW)
- Evidence: `:904`–`:951` includes 40 lines of comment explaining why `setCableDraw` cannot run side effects. The same pattern likely needs to be applied to other tool finish paths (wall, measure) that already use the safer two-step.

### E13. ResizeObserver in auto-fit effect (`:1468`) leaks across project switches (Severity: LOW)
- Evidence: observer is created with current surfaceRef; on project change the same effect re-runs but the prior observer is disconnected in cleanup. Works, but in profile shows a 5-ms blip every navigation.

### E14. AttachmentPanel re-reads the entire attachments map per render (Severity: LOW)
- Evidence: `AttachmentPanel.tsx` reads `useProjectStore((s) => s.attachments)` then filters. With 100s of attachments, the rerender cost grows.

### E15. The wheel-zoom CustomEvent indirection (`:6008`) (Severity: LOW)
- Evidence: SVG dispatches a CustomEvent that the parent listens to in another effect. Works but is a code smell: state lives in the parent, child fires an event the parent decodes. A callback prop is cleaner.

### E16. Selector returns plain objects which trigger Zustand's shallow-equality default (Severity: LOW)
- Evidence: `:1132` `canvasLayersMap = useProjectStore((s) => s.canvasLayers)` followed by spread to merge defaults. Every reference change causes the spread to re-run.

---

## F. Severity + effort summary

| Severity | Effort | Title | Where |
|---|---|---|---|
| CRITICAL | L | Undo / Redo missing on the canvas | B1 |
| CRITICAL | M | `currentFloorId = firstFloorOfProject` hard-coded (latent correctness trap) | E7 |
| HIGH | L | EngineeringCanvas monolith (14.7k SLOC, 60+ inline components) | B2 |
| HIGH | M | Floor switcher dropdown is inert | B5 |
| HIGH | M | Drag-onto-host attach for door hardware still drops orphan accessories | C1 |
| HIGH | M | Multi-floor switching not implemented | C3 |
| HIGH | L | Real VisionScan / DWG / blueprint OCR ingest | C4 |
| HIGH | S | Arrow-key nudge | D1 |
| HIGH | S | Copy / paste / duplicate keyboard shortcuts | D2 |
| HIGH | M | Alignment / distribute commands | D3 |
| HIGH | S | Per-device lock that actually locks | D6 |
| HIGH | M | Coverage visualisation for non-cameras | D7 |
| HIGH | L | Cross-floor risers / stack view | D20 |
| HIGH | — | Root component re-renders on every store mutation | E1 |
| HIGH | — | SVG canvas re-renders every device on every drag step | E2 |
| MEDIUM | S | Media tab is a visibly disabled control | B3 |
| MEDIUM | S | History tab is a visibly disabled control | B4 |
| MEDIUM | S | "Verified scale" chip is the only way to recalibrate | B6 |
| MEDIUM | S | Lock and Hide enforcement gap | B7 |
| MEDIUM | S | Multi-select pill missing group actions | B11 |
| MEDIUM | L | Real map tile providers for satellite / hybrid / street | C2 |
| MEDIUM | S | Cable run length missing per-floor riser drop | C5 |
| MEDIUM | M | Per-object change history | C6 |
| MEDIUM | M | Room polygons and room-scoped selection | C8 |
| MEDIUM | S | Real Lock action enforcement | C9 |
| MEDIUM | M | Group / ungroup | D4 |
| MEDIUM | M | Smart guides (Figma-style snap lines) | D5 |
| MEDIUM | M | Annotations: text labels, callouts, arrows | D8 |
| MEDIUM | S | Version history / named saves / snapshots inline | D12 |
| MEDIUM | L | Export formats: PNG, DWG, IFC | D13 |
| MEDIUM | M | Print to scale | D14 |
| MEDIUM | M | Door hardware schedule + code compliance checks | D17 |
| MEDIUM | L | Cross-floor risers / stack view | D20 |
| MEDIUM | M | Copy floor / mirror floor | D21 |
| MEDIUM | S | Search and locate by ID/label | D22 |
| MEDIUM | — | `setDevices` facade dispatches per-device store action | E3 |
| MEDIUM | — | Floorplan base64 in localStorage | E6 |
| LOW | S | Pop-out window blocked by default | B8 |
| LOW | S | Hidden engineering layers still in schema | B9 |
| LOW | M | Coverage cones and intelligence chips overlap | B10 |
| LOW | M | Drag accessory auto-attach uses midpoint distance | B12 |
| LOW | M | placeProductAt vs drag-drop path duplicate logic | B13 |
| LOW | S | Marquee ignores hidden devices | B14 |
| LOW | S | Wall tool gated on blank base only | B15 |
| LOW | S | Pathway over-distance warning oversimplified | B16 |
| LOW | S | Calibrate and measure overlays can co-render | B17 |
| LOW | M | Report Builder snapshot freezes main thread | B18 |
| LOW | S | LeftNavRail and MapsPanel are dead components | B19 |
| LOW | L | Live telemetry and device connectors | C7 |
| LOW | M | AI Assistant inline on canvas | C10 |
| LOW | L | DWG/IFC export | C11 |
| LOW | L | Sharing surface | C12 |
| LOW | S | Measurement probe / persistent tape / area probe | D9 |
| LOW | S | Layer locking | D10 |
| LOW | S | Layer visibility per kind | D11 |
| LOW | S | Symbol library completeness | D15 |
| LOW | S | Per-lens focal slider on multisensor | D16 |
| LOW | S | Conduit fill inline | D18 |
| LOW | S | Cable bend-count warning | D19 |
| LOW | M | Saved camera/lens presets | D24 |
| LOW | L | Mobile/tablet touch handling | D25 |
| LOW | — | Stale custom-event listeners | E4 |
| LOW | — | Window-level pointer listeners in drag | E5 |
| LOW | — | Coordinate inconsistency across floors | E8 |
| LOW | — | Stale closures in event handlers | E9 |
| LOW | — | localStorage write per hidden/locked toggle | E10 |
| LOW | — | Onboarding component shipped but suppressed | E11 |
| LOW | — | cableDrawRef pattern not generalised | E12 |
| LOW | — | ResizeObserver leak per project switch | E13 |
| LOW | — | AttachmentPanel re-reads full attachments map | E14 |
| LOW | — | Wheel-zoom CustomEvent indirection | E15 |
| LOW | — | Zustand selector reference instability | E16 |

---

## G. Canvas V2 brief recommendation

The product is good enough that the only way to make it great is to stop adding features and pay debt. Six items break the trust contract immediately: B1, B5, C1, C3, D6, E7. They all share a root cause — the canvas was built as a single component before multi-floor and undo were taken seriously, and the architectural decisions baked in then now block every honest feature ask.

Three passes, in order. Each pass is bounded and ships a coherent jump in operator confidence.

### Pass 1 — Trust restoration (Selection + manipulation + undo)
Theme: never lose the user's work; let them work like they would in Figma.

Items
- B1 — Undo / Redo subsystem (CRITICAL/L)
- D1 — Arrow-key nudge (HIGH/S)
- D2 — Copy / paste / duplicate keyboard shortcuts (HIGH/S)
- D3 — Alignment / distribute (HIGH/M)
- D6 — Lock enforcement (HIGH/S)
- B7/C9 — Lock chip wiring (MEDIUM/S)
- B11 — Multi-select pill with group actions (MEDIUM/S)
- B3 — Hide Media tab (MEDIUM/S)
- B4 — Hide History tab (MEDIUM/S)
- D9 — Persistent tape measure and area probe (LOW/S)
- D22 — Cmd-K search by ID/label (MEDIUM/S)
- D23 — Zoom-to-selection (LOW/S)

Reasoning: every item above is an existing-canvas hygiene improvement that does not require touching the floor model. Undo is the centrepiece — every other change in V2 will be safer to test once the operator can roll back. The cluster also lets us reach for canvas state without first solving multi-floor, which keeps risk bounded. Effort estimate: 2 to 3 weeks of focused work, much of which is the undo subsystem (action-history store slice + serialize-able command pattern).

### Pass 2 — Floor as a first-class concept (Multi-floor + accurate measurements + scope-aware UI)
Theme: stop pretending the building has one floor.

Items
- B5 — Wire floor switcher to swap active floor (HIGH/M)
- C3 — Multi-floor switching implementation (HIGH/M)
- E7 — Replace `firstFloorOfProject` with selected-floor id (CRITICAL/M)
- D20 — Cross-floor risers / stack view (HIGH/L)
- D21 — Copy floor / mirror floor (MEDIUM/M)
- C5 — Per-riser cable drop in BOM (MEDIUM/S)
- E8 — Per-device floor scale lookup in HUDs (LOW/S)
- C8 + D11 — Room polygons + room-scoped selection + visibility per kind (MEDIUM/M)
- B6 + B19 — Surface Recalibrate in floor controls; delete unreachable LeftNavRail (MEDIUM/S, LOW/S)
- D7 — Coverage circles for motion / wifi / strike-reach (HIGH/M)
- D8 — Inline annotations: text + callout + arrow (MEDIUM/M)

Reasoning: this is the pass that unblocks any commercial or multi-storey job. The technical risk is real (every selector touches floor id), but the work is well-scoped and the data model already supports it. Pair with coverage-for-non-cameras and annotations to demonstrate the breadth of what becomes possible. Effort estimate: 4 to 6 weeks.

### Pass 3 — Real-world deliverables (Ingest + export + door schedules + performance)
Theme: take what's on screen and put it into the world.

Items
- C1 — Drag-onto-host attach for door hardware (HIGH/M)
- C4 — Real PDF/DWG ingest (HIGH/L)
- D13 — PNG export today, DWG and IFC export when integrators ask (MEDIUM/L)
- D14 — Print to scale (MEDIUM/M)
- D17 — Door hardware schedule + heuristic code checks (MEDIUM/M)
- C2 — Real map tile provider for satellite/hybrid (MEDIUM/L)
- B2 / E1 / E2 / E3 — Split EngineeringCanvas, memoise renders, batch store writes (HIGH/L for split; HIGH for perf wins)
- E6 — Move floorplan background to IndexedDB (MEDIUM/M)
- B18 — Move ReportBuilder snapshot off main thread (LOW/M)
- D24 — Saved camera/lens presets (LOW/M)
- D15 — Symbol library completeness (LOW/M)
- D5 — Smart guides while dragging (MEDIUM/M)

Reasoning: by Pass 3, the canvas has earned the right to spend a chunk of budget on file-format and tile-provider work. The performance and refactor work is paired here because the multi-floor pass will have made the perf problems acute; this is the moment to split EngineeringCanvas.tsx into a per-tool / per-overlay file tree without rewriting from scratch. Effort estimate: 6 to 8 weeks across deliverables; the file split alone is ~2 weeks.

Items deferred past V2
- C6 (per-object change history) — depends on a real backend audit log.
- C7 (live telemetry) — depends on cloud connectors.
- C10 (AI inline) — better delivered as a Pass 4 once the canvas surface is stable.
- C11 (DWG/IFC) — addressed in Pass 3 to the extent integrators ask; full coverage is post-V2.
- C12 (sharing) — full collaboration requires backend; presence mock should be removed earlier.
- D25 (mobile/tablet) — separate workstream; the canvas needs to be split (Pass 3 prep) first.
