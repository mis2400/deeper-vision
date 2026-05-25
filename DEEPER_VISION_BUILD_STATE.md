# Deeper Vision Build State

Last updated: 2026-05-18

This file is the working handoff between Codex, Claude, and the user. Treat
`/Users/mis/Projects/deeper-vision` as the active Deeper Vision codebase unless
the user explicitly points to another repo.

## Active Codebase

- Repo: `/Users/mis/Projects/deeper-vision`
- Stack: React + Vite + TypeScript-style TSX + Zustand store
- Primary screen: `src/app/screens/EngineeringCanvas.tsx`
- QA log: `QA_CHECKLIST.md`
- Current preview route: `/project/p1/canvas`

Do not confuse this with older or alternate builds:

- `/Users/mis/siteshield-planner` is the older static no-build prototype.
- `/Users/mis/Desktop/Enterprise UX_UI Design System 2` is a Figma-exported
  React/Vite design shell, not the currently verified repo.
- `/Users/mis/Projects/deeper-vision-old` is an older git repo copy.

## Product Direction

Deeper Vision is an enterprise physical-security engineering operating system,
not a generic dashboard. The Engineering Canvas / Site Designer is the core
product.

The workflow priority remains:

1. Upload or select floor plan / satellite base.
2. Calibrate scale.
3. Place and manipulate cameras, doors, hardware, IDF/MDF, and pathways.
4. Configure camera FOV, DORI, target simulation, and multisensor lenses.
5. Build intelligent door assemblies by dropping hardware into doors.
6. Draw cable/conduit/pathways with length and labor impact.
7. Generate BOM, warnings, QA, reports, and deployment outputs from the canvas.

## Latest Imported Claude Pass

Source: Cloud Sync / Local Snapshot Foundation Pass — shipped 2026-05-18 on top
of Reports / Proposal Package.

Changed files already present in repo:

- `src/app/screens/EngineeringCanvas.tsx`
- `src/app/screens/ReviewMode.tsx`
- `src/app/screens/DeploymentMode.tsx`
- `src/app/screens/ReportsCenter.tsx`
- `src/app/components/canvas/ProjectStateMenu.tsx`
- `src/app/components/canvas/PricebookEditor.tsx`
- `src/app/services/projectSync.ts`
- `src/app/App.tsx`
- `src/app/lib/compatibility.ts`
- `src/app/store/projectStore.ts`
- `src/app/store/types.ts`
- `QA_CHECKLIST.md`

Verified changes now present across Honesty passes 2, 3, Direct Manipulation QA,
Canvas Ergonomics, Pathway Vertex Editing, Pathway Editing Polish, and Floor
Plan Setup UX, Camera Designer UX, Door Assembly UX, BOM / Estimate,
Presentation / Review Mode, Field Deployment, Project State / Demo Sync,
Pricebook Calibration, Reports / Proposal Package, and Cloud Sync / Local
Snapshot Foundation:

- Camera Compatibility tab no longer makes fake verified compliance claims.
  It now renders `Compliance checklist · preview`, shows a `Rules engine not wired`
  banner, and marks camera rows as pending.
- Camera Telemetry body is honest for cameras: no live telemetry feed connected.
- Non-camera Compatibility bodies are now honest preview surfaces. Doors,
  readers, and IDF-style branches render pending, kind-aware rows instead of
  fake `Verified`, `Clear`, or `Class 2` claims.
- Non-camera Telemetry body is defensive and honest: no live telemetry feed
  connected, no hardcoded uptime / packet-loss claims.
- Demo scan is removed as an inline primary TopBar button and moved into More
  as `Demo scan` with a `DEMO ONLY` chip.
- Conduit tray defaults to 6 common sizes:
  `EMT 1/2"`, `EMT 3/4"`, `EMT 1"`, `PVC 3/4"`, `PVC 1"`, `Raceway`.
  A toggle expands to the full 30-button size matrix.
- `validMounts('acc.controller')` and `validMounts('acc.psu')` return
  `['door', 'idf']`.
- Door assembly persistence was verified for controller + PSU after reload.
- The `PathwaysOverlay` React warning root cause was fixed in `finishCableDraw`:
  `addPathway`, `setTool`, and toast side effects were moved out of the
  `setCableDraw` updater. A `cableDrawRef` mirrors the latest draw state so the
  finish path can stay side-effect-free inside React's updater.
- Camera direct manipulation was corrected under panned canvas state:
  `RotationRing` now receives `pan` and subtracts `pan.x / pan.y` before zoom
  conversion, matching the prior `ConeHandles` coordinate fix.
- Multisensor linked mode now behaves as promised: dragging one lens handle in
  linked mode fans out range/FOV changes across all four lenses while preserving
  each lens rotation. Independent mode remains per-lens.
- Drawing tools are less sticky: Escape now clears cable/conduit/pathway/wall
  draw state and returns to Select. Right-click on the canvas also cancels
  in-flight drawing tools via `onSurfaceContextMenu`.
- Door assembly drag/drop was re-verified: reader, strike, REX, DPS,
  controller, and PSU attach into the door assembly, update the badge, and
  persist after reload.
- Coverage rendering was tuned to reduce visual noise:
  unselected/sibling camera cones are much more subordinate, selected cones get
  a restrained boost, DORI arcs and FOV edges are quieter, and the aim line no
  longer competes as heavily with walls, labels, and pathways.
- Multisensor rendering was softened for non-active lenses, while active lens
  chips are clearer with a brighter lens-tinted background, underline, and
  larger glowing dot.
- Cone, FOV-edge, and rotation handles are slightly larger and share the
  `.dv-cone-handle` hover affordance so draggable controls read better without
  becoming bulky.
- Right-click handling is now scoped: Select / Pan allow the native browser
  context menu, while active drawing tools still use right-click to cancel and
  return to Select.
- Selected pathways now render true per-vertex edit handles through
  `PathwayVertexEditor`. Vertices can be dragged with pan-aware math and write
  updated `points` plus fresh `lengthFt` back to the store.
- Pathway segments expose a `+` affordance on hover so users can insert a new
  vertex without redrawing the run.
- That `+` now follows the cursor's nearest projected point on the segment
  rather than being pinned to the midpoint.
- Pathway vertices can be removed with Backspace/Delete while preserving a
  minimum of two points.
- Edited pathway geometry and recalculated lengths persist after reload.
- Vertex drag and segment insertion now honor the existing Snap toggle:
  Snap ON rounds to the 20 px / 1 ft grid, while Snap OFF allows smooth
  sub-grid placement.
- Active/dragged vertices have stronger visual emphasis and a small `X · Y ft`
  HUD based on the calibrated px-to-ft scale.
- TopBar now exposes **Add plan** instead of the old Scan/Build wording.
- Add plan opens a user-facing source picker with Upload, Satellite/address,
  Blank canvas, and demo/VisionScan-style options.
- Upload plan flow now shows a preview thumbnail, editable plan name, floor
  context, and a clear **Scale not verified** status before saving.
- **Save & set scale** closes the modal and arms an in-canvas Calibrate tool.
- Calibrate mode supports click Point A, click Point B, cyan A→B visual line,
  pixel-distance chip, feet input, Apply scale, Cancel, Escape, and right-click
  cancellation.
- Applying scale writes `scalePxToFt`, `calibratedAt`,
  `calibrationReferenceFt`, and `calibrationMeasuredPx` to the floor. Scale bar
  flips from amber default status to green **Verified**.
- Scale bar now has a direct **Set scale** CTA when a floor is unverified, so
  users can recalibrate without re-uploading.
- Floor plan controls now include quick rotate left/right, fit, reset, opacity,
  scale, and rotation controls.
- Pathway labels and derived measurement readouts reflow against the updated
  floor scale.
- Camera Designer UX is live: camera model picker, spec chips, direct FOV labels,
  DORI target preview with plain-language verdict, IEC pass/fail strip, and
  multisensor lens summary.
- Door devices now carry `doorAssemblyState` so each hardware class can be
  marked `proposed` or `existing`.
- Drag-attached door hardware defaults to **Proposed** and persists with the
  door assembly.
- Selected doors render a clearer opening hint and compact RLXMCP-style hardware
  badge.
- Door inspector Assembly tab now reads like an access-control opening:
  Opening summary, hardware rows with Proposed/Existing pills, engineering rule
  checks, and electrification context.
- Door warning rules are live heuristic checks, clearly labelled as not certified
  code compliance. Covered examples include strike without PSU, reader without
  controller, monitored contact without controller, lock without controller, and
  related access-control pairing issues.
- Door object impact separates Proposed from Existing hardware. Proposed counts
  toward door-only subtotal; Existing is documented and excluded/struck through.
- `npm run build` was reported passing in the imported pass.

- A new TopBar entry **BOM & Estimate** opens a right-side `ProjectBomDrawer`
  (460 px). Header has the project name, line + device count, an honest **CSV**
  button, and an X to close. Opening it clears any active EditDrawer /
  PathwayDrawer selection so the right-side slot is the BOM exclusively.
- The drawer is fed by a new pure helper `deriveCanvasBomRows(state, projectId)`
  in `projectStore.ts`. It emits per-source rows (one per device, one per
  door-assembly hardware item, one per pathway, one per IDF switch/UPS) so
  every row is clickable.
- Row click: device or door row sets `selId` and opens the EditDrawer;
  pathway row sets `selPathwayId` and opens the PathwayDrawer. Verified end
  to end (CAM-101 → EditDrawer headline, PW-1 → PathwayDrawer with
  `CAT6A · 10 ft · CAM-101 → IDF-1`).
- Each door-hardware row honours `device.doorAssemblyState[hw]`: an
  Existing flag renders the row at lower opacity with line-through totals
  AND excludes it from the proposed material subtotal. Existing dollars
  still appear in the totals card under "Existing documented".
- Totals card surfaces: Proposed material, Cable, Labor (hr + $),
  Existing documented (struck), Sell total at the project markup. Seeded
  project values: `$23,031 / $16 / 30.8 hr · $2,921 / $285 struck / $30,642
  @ 18%`. Pricing is preview-grade; the card says so on every render.
- Filter pills `All / Cameras / Access / Network / Cabling / Existing`
  carry live counts and disable when empty. Seeded counts: `25 / 5 / 16 /
  3 / 1 / 1`.
- Missing-price detector: any row with `unitPrice === 0` raises an amber
  warning under the totals card with the count of affected lines.
- CSV export is REAL — UTF-8 with BOM (Excel-clean currency), RFC-4180
  quoting, per-row lines, and a trailing TOTALS block. Filename uses the
  project name with non-alphanumeric stripped. Verified end-to-end: 2,332
  bytes of `text/csv` for the seeded project.
- New shared types `CanvasBomCategory` + `CanvasBomRow` in
  `store/types.ts`.
- A new reviewer-facing route `/project/:projectId/review` mounts
  `ReviewMode.tsx`, a clean presentation surface for customer/stakeholder
  feedback.
- Engineering Canvas now has a **Present** TopBar button that links from
  `/project/:id/canvas` to `/project/:id/review`.
- Review Mode shows the project name, status pill, reviewer-safe canvas,
  floor picker, layer toggles, read-only object details, BOM summary, comments
  panel, and navigation back to Engineering.
- Review layer toggles cover cameras, doors, access, network, pathways,
  coverage/FOV cones, notes, and BOM summary.
- Object click in review mode is read-only: cameras show model/coverage/mount
  details, doors show proposed/existing hardware summary, and pathways show
  type/length/bundle.
- BOM summary in review mode hides cost by default; **Show cost** reveals the
  sell total only when explicitly requested.
- **Copy review link** uses real `navigator.clipboard.writeText`.
- Comments, approval status, Approve, and Request changes are session-scoped and
  clearly labelled preview-only / not persisted.
- A new field execution route `/project/:projectId/deployment` mounts
  `DeploymentMode.tsx`.
- Engineering Canvas now has a **Deploy** TopBar button that links from
  `/project/:id/canvas` to `/project/:id/deployment`.
- `deriveWorkOrders(state, projectId)` generates work orders from live canvas
  state: cameras, door openings/assemblies, pathways/cable runs, and IDF/network
  equipment where represented.
- New persisted `workOrderProgress` slice stores status, checklist completion,
  serial/MAC, notes, blocker text, and photo metadata per work order.
- Persist migration bumped to v6 and initializes `workOrderProgress` without
  disturbing existing canvas state.
- Deployment Mode shows project progress, work order filters, selected work
  order detail, status timeline, source summary, mini floor preview with source
  highlight, kind-aware checklist, notes, serial/MAC fields, mock tech
  assignment, blocker action, and photo metadata placeholders.
- Status/checklist/photo/serial/MAC/blocker state survives hard reload via
  Zustand/localStorage.
- Engineering Canvas now has a compact **Project state** menu in the TopBar.
- Project state export downloads a `deeper-vision-p1-*.json` envelope containing
  the project/floors/background metadata, devices, door assembly states,
  pathways, IDFs, work order progress, and summary counts.
- Project state import validates the envelope shape, shows a confirmation
  summary, then replaces only the target project slice in local store.
- **Reset to shared demo** restores the seeded demo project and redirects to
  `/project/p1/canvas`.
- **Clear local project state** removes the persisted `deeperVisionStore` blob
  and reloads the app.
- The Project State UI clearly explains that this prototype stores project state
  in this browser and export/import is the bridge until cloud sync exists.
- Export/import round-trip was verified across canvas, review, and deployment.
- BOM drawer now has a **Pricebook** button.
- `PricebookEditor` modal supports project markup, labor hourly rate, door
  hardware price/labor overrides, and cable-per-foot overrides.
- New `projectPricebooks` persisted slice stores per-project overrides and
  ships with the v7 persistence migration.
- `deriveCanvasBomRows`, `deriveWorkOrders`, CSV export, and the Project State
  envelope all honor pricebook overrides.
- BOM drawer honesty card flips from preview pricing to
  **Project pricebook overrides active** once overrides exist.
- Rows using pricebook overrides show an **Overridden** badge.
- Overrides persist after reload and round-trip through Project State
  export/import.
- A new route `/project/:projectId/reports` mounts `ReportsCenter.tsx`, a
  polished report/proposal package generated from the same canvas/store data as
  the engineering workspace.
- Engineering Canvas now has a sky-blue **Reports** TopBar button between
  Deploy and Project state.
- Review Mode also has a **Reports** button in the top bar.
- Reports Center supports Internal and Customer views. Customer mode hides
  internal BOM/cost details, pricing assumptions, signature lines, and
  low-severity warnings.
- Reports Center renders executive metrics, site/floor schedule, per-floor
  schematic plan previews, camera schedule, door hardware schedule, cabling /
  pathway schedule, BOM & estimate summary, deployment summary, warnings,
  assumptions/exclusions, and a labelled attachments placeholder.
- Reports schedules read from live Zustand state and helpers:
  `deriveCanvasBomRows`, `deriveWorkOrders`, devices, floors, pathways,
  doorAssembly/doorAssemblyState, pricebook overrides, and calibrated scale.
- Camera, door, pathway, and BOM tables each have real CSV export.
- **Print / Save PDF** uses browser `window.print()` with print styles and is
  clearly a browser-print workflow, not a backend PDF renderer.
- Plan previews are schematic SVGs generated from canvas data and are labelled
  as such, not passed off as exact screenshots.
- A new sync service layer exists at `src/app/services/projectSync.ts` with
  helpers for sync mode, local snapshots, export, import, restore, list, and
  delete operations.
- Project State menu is now wider and starts with **Sync status** plus
  **Snapshots** sections.
- Sync status clearly reports current mode as local browser storage and cloud
  sync as not connected, with local save timestamp, project state size, store
  blob size, and counters for devices, doors, pathways, IDFs, floors, work
  orders, pricebook overrides, and snapshots.
- Named local snapshots can be saved, listed, restored, and deleted. They are
  stored separately from the main Zustand store in `deeperVisionSnapshots`.
- Snapshot restore uses the existing `importProjectState` path, so restored
  state updates canvas, BOM, reports, deployment, pricebook, and work-order
  surfaces.
- Reset to shared demo and Clear local project state leave snapshot history
  intact, and the UI explains this behavior.
- Project State footer copy now explicitly says edits are stored in this
  browser and moving edits between local/live requires Export/Import or
  Snapshots until cloud sync is connected.

Production state:

- Stable live URL: `https://deeper-vision-ashy.vercel.app/project/p1/canvas`
- Stable review URL: `https://deeper-vision-ashy.vercel.app/project/p1/review`
- Stable deployment URL: `https://deeper-vision-ashy.vercel.app/project/p1/deployment`
- Stable reports URL: `https://deeper-vision-ashy.vercel.app/project/p1/reports`
- Cloud Sync / Snapshot deployment: `dpl_38QaNUG82e3LDJJhCEujA2WPcX9K`
- Source commit: `f2521f95` (Cloud Sync / Local Snapshot foundation).
- Build commit: `4afc2dda` (dist with `f2521f95` stamp).
- Live bundle reported by Vercel: `index-C8Knehy6.js`.
- Local verification: live HTML references `/assets/index-C8Knehy6.js` and
  `/project/p1/canvas` returns HTTP 200.

Repo state from inspection:

- Tracked source clean at commit `4afc2dda`.
- Untracked by standing rule: `.mcp.json`, `node_modules/path2d/`,
  `node_modules/pdfjs-dist/`.
- This handoff file remains untracked unless intentionally added later.

## Known Remaining Honesty Gaps

- `/visionscan` remains a simulated AR / LiDAR walkthrough.
- Media uploads, per-object change history, and AI suggestions are preview-only
  surfaces, already labeled from prior honesty pass.
- Compatibility and Telemetry should now be honest across device kinds; keep
  this as a regression guard in future inspector work.
- Review Mode comments/status/approval are intentionally session-scoped until a
  backend review workflow exists.
- Deployment Mode mock tech assignment and photo upload are preview-only; photo
  rows persist metadata only, not real blobs.
- Reports Center attachments slot is a placeholder until file upload/storage
  lands with cloud sync.
- Reports Center comments/approval are not a backend workflow; Review Mode still
  owns the current session-only review comments/status.
- Cloud sync status is honest: cloud sync is not connected yet. Snapshots are
  real local browser snapshots, not multi-user cloud sync.

## Known Technical Risks

- Vite HMR may fail mid-edit on `EngineeringCanvas.tsx` because the file is very
  large. Production build has been reported clean after full reload.
- Vite Fast Refresh may log an incompatible export notice around
  `DEFAULT_MULTISENSOR_LENSES` during dev edits, falling back to full reload.
- `EngineeringCanvas.tsx` is large enough that future edits should be batched
  carefully and verified with a full browser pass.
- Multisensor focal length is still a per-lens field, but there is no direct
  focal drag handle yet. If a focal slider/handle is added, linked-mode
  propagation must include it.
- Coverage opacity still respects the user-facing opacity slider. If set to
  100%, overlays will intentionally brighten.
- Pathway snap rounds X and Y independently. For diagonal segments this snaps to
  the nearest grid cell, not the nearest point along the segment line.
- The pathway coordinate HUD is canvas-origin relative. If a future floor-origin
  feature lands, the HUD should convert through that origin.
- The segment `+` hit area is intentionally small and professional; it may need
  a larger grab radius at very low zoom.
- Satellite/address mode is still an honest placeholder/stylised aerial mode,
  not live connected map tiles.
- Calibration input accepts decimal feet only for now, not feet/inches strings.
- Upload/calibration writes to the active project/floor path used by the canvas;
  multi-floor picking inside the upload modal remains out of scope.
- Calibration math is canvas-space based. If a user later rotates or rescales
  the imported plan manually, they should recalibrate.
- Door assembly state is keyed by hardware class, so one door cannot represent
  two separate readers with different existing/proposed states yet.
- Door hardware compatibility remains heuristic, not certified code compliance.
- Work orders are derived from seeded/local canvas state, not dispatched through
  a backend scheduler.
- Project State export/import is local-file based, not cloud sync. It solves
  demo sharing and local/live alignment today, but a backend should replace it
  for multi-user collaboration.
- Pricebook overrides are local/project-scoped and are not connected to ERP,
  accounting, distributor feeds, or vendor catalogs yet.
- Pricebook overrides are class/category based today. Product/SKU-level price
  overrides are a future pass.
- Reports Center uses schematic SVG plan previews, not exact exported canvas
  screenshots.
- Reports Center PDF output is browser print/save-as-PDF, not server-generated
  PDF composition.
- Local snapshots live in browser localStorage under a separate key; they do not
  move across browsers/devices unless exported/imported through Project State.

## Next Practical Build Priorities

1. True file/attachment storage: connect reports, review, deployment, and
   object inspectors to real upload/blob storage instead of placeholders.
2. Backend persistence / collaboration: promote the project-state envelope
   and `projectSync.ts` service layer into Supabase/Firebase/API storage so
   review comments, deployment progress, snapshots, pricebooks, and canvas edits
   sync between users without manual JSON files.
3. Pricebook expansion: add SKU-level/vendor-import price overrides if the
   next estimating pass needs exact catalog pricing rather than class pricing.
4. Collapse `deriveBOM` + `deriveCanvasBomRows` once the legacy Estimator
   view migrates to per-source rows. They agree on totals when prices and
   catalog data are identical, but two helpers is technical debt to retire.
5. Keep UI work canvas-first and avoid dashboard expansion until the
   designer workflow feels reliable.
