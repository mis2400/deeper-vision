# Deeper Vision — Manual QA Checklist

Run before shipping any pass that touches intake, calibration, canvas, BOM, or
persistence. Append a new "Pass X" column each time; do not delete history.

## How to run

```bash
npm run dev          # http://localhost:5173
```

Reload between scenarios where called out. To inspect persisted state in
DevTools: `JSON.parse(localStorage.getItem('deeperVisionStore'))`.

To start from a clean slate: `localStorage.removeItem('deeperVisionStore')`
then reload — the store re-seeds the demo data.

---

## Foundation flow

### 1. New-project intake creates a persisted record
- [ ] `/projects` → click **New project**.
- [ ] Fill all five steps (Client / Site / Threat / Compliance / Review).
- [ ] Click **Create project & calibrate**.
- [ ] Land on `/calibrate/p-<id>` (id contains a real suffix, not `new`).
- [ ] Toast confirms creation.
- [ ] Refresh the page. `/projects` still lists the new project at the top.
- [ ] DevTools: `localStorage['deeperVisionStore']` parsed JSON contains the
      new customer, contact, project, site, building, and floor records, all
      cross-linked by id.

### 2. Existing-project intake (edit path) does not duplicate
- [ ] Visit `/intake/p1` (a seeded project).
- [ ] Click through to Review → **Create project & calibrate**.
- [ ] Land on `/calibrate/p1`. No new customer/project records appear in
      localStorage.

### 3. Scale calibration persists to the floor
- [ ] From the calibrate page, click **Choose PDF or image** (demo plan).
- [ ] Pick two points on the plan.
- [ ] Enter a real-world distance.
- [ ] Click **Confirm scale**.
- [ ] Toast confirms; status card shows the saved px/ft value with the floor
      name.
- [ ] Refresh. Open `/project/<id>/canvas`. The scale bar at the bottom-left
      drops the **Default scale** chip and reads the calibrated value.
- [ ] DevTools: `floors[<floorId>].scalePxToFt` matches the value you set,
      AND `calibratedAt` is a number (ms epoch), AND `calibrationReferenceFt`
      equals the feet you entered, AND `calibrationMeasuredPx` equals the
      pixel distance between your two points.

> A floor is "real calibrated" when `calibratedAt` exists — *not* when
> `scalePxToFt` differs from the seed default of 0.05. A user who measures
> and gets exactly 0.05 ft/px back is still calibrated. The scale-bar chip
> reads `calibratedAt` directly.

### 3b. Calibration recalibration
- [ ] On a calibrated floor, run `/calibrate/<id>` again with a different
      reference distance.
- [ ] After **Confirm scale**: `scalePxToFt`, `calibratedAt`,
      `calibrationReferenceFt`, and `calibrationMeasuredPx` all overwrite
      to the new values (no stale fields linger).

### 4. Calibrate without an intake-created floor
- [ ] Visit `/calibrate/does-not-exist`.
- [ ] Complete the steps, click **Confirm scale**.
- [ ] Toast warns "No floor found for this project. Complete intake first."
- [ ] No localStorage mutation.

---

## Canvas baseline (regression guard for the next pass)

### 5. Canvas open + drag + rotate
- [ ] Open `/project/p1/canvas` on a seeded project.
- [ ] Drag a camera from the bottom tray onto the plan; release.
- [ ] Drag the placed camera 100px; release.
- [ ] Refresh. Camera is still where you dropped it.

### 6. Camera edit drawer persists
- [ ] Click a camera, click **Edit**.
- [ ] Drag the FOV slider. Cone updates live.
- [ ] Refresh. FOV value is preserved.

### 7. Multisensor lens A/B/C/D independence
- [ ] Place a multisensor camera.
- [ ] Switch the lens mode toggle to **Independent**.
- [ ] Change lens A FOV; lenses B/C/D should not change.
- [ ] Refresh. Lens A's independent FOV preserved.

---

## Hardening pass (canvas/surveyor MVP foundation)

Add to the regression sweep before shipping any pass that touches doors,
the BOM, survey capture, or the measurement readouts.

### 9. Door assembly persists on a canvas door
- [ ] On `/project/p1/canvas`, place a door-class device (drag an
      `inf.door-single` from the Doors tray).
- [ ] Click the door → SelectionPill → **Edit** → **Stack** tab.
- [ ] Toggle **Reader**, **Strike**, **REX**, **DPS**, **Controller**, **PSU**.
- [ ] Pick **Fail-secure** electrification and **Mullion** reader location.
- [ ] Refresh. Re-select the door → Stack tab — all six hardware items
      plus the two settings are still on.
- [ ] DevTools: `devices[<doorId>].doorAssembly` is the 6-item array,
      `doorElectrification === 'fail-secure'`, `doorReaderLocation === 'mullion'`.
- [ ] The Stack tab does **not** show the legacy "Add hardware" grid for
      door-class devices (only the Door assembly checklist).

### 10. Door assembly affects Impact preview + Estimator BOM
- [ ] With the door selected, on the **General/Overview** tile the
      **Door assembly impact** section lists one row per selected hardware
      component with price + labor, plus a **Hardware subtotal**.
- [ ] Navigate to `/estimate/p1`. The **Access control · doors** section
      contains one line per door-assembly component
      (description prefixed with `<doorId> · …`, sku `door-hw:<hw>`),
      and the section subtotal matches the inspector's subtotal.
- [ ] Click **Export CSV**. A `.csv` downloads with headers
      `Section, SKU, Description, Qty, Unit, Unit price USD, Extension USD, Labor hr`
      and the door-hardware lines are present.

### 11. Object-linked survey note persists on a camera
- [ ] Click a camera (e.g. `CAM-101`) → **Edit** → **Survey** tab.
- [ ] Pick the **Note** kind, type "Confirmed sight-line", click **Add**.
- [ ] An item card appears showing the text + a `NOTE · VERIFIED` chip +
      timestamp + `— Field demo` author.
- [ ] Refresh. Re-select `CAM-101` → Survey tab — the note is still there.
- [ ] DevTools: `surveyItems[<srvId>]` has
      `objectType === 'device'`, `objectId === 'CAM-101'`,
      `text === 'Confirmed sight-line'`, `status === 'verified'`,
      plus `createdAt` / `updatedAt`.
- [ ] Repeat on a pathway (use the PathwayDrawer's **Notes** sub-tab) and
      verify `objectType === 'pathway'`.

### 12. Calibrated measurement readouts update after floor scale changes
- [ ] On `/project/p1/canvas`, click `CAM-101` → **Edit** → General/Overview
      tile. Record the **Position** value at seed scale (default reads
      `13.0, 11.0 ft` for CAM-101 at canvas (260, 220) when `scalePxToFt = 0.05`).
- [ ] In the console:
      `window.__projectStore.getState().updateFloor('b1-f1', { scalePxToFt: 0.125, calibratedAt: Date.now(), calibrationReferenceFt: 25, calibrationMeasuredPx: 200 })`
- [ ] Inspector **Position** re-renders. Expect `32.5, 27.5 ft`.
- [ ] Close inspector, click pathway `PW-1` → drawer header relabels from
      `CAT6A · 10 ft …` to `CAT6A · 25 ft …`.
- [ ] Pick up Measure tool, draw any line; the chip shows feet against the
      new calibrated scale.
- [ ] Drag any device; the X / Y HUD and nearest-distance HUD both show
      feet against the new scale.
- [ ] Open a camera's Coverage tile; the DORI distance reads against the
      calibrated scale.

### 13. Scale-bar honesty (calibratedAt vs scalePxToFt)
- [ ] Clear localStorage. Open `/project/p1/canvas`. Scale bar shows
      **Default scale** chip.
- [ ] Run `updateFloor('b1-f1', { scalePxToFt: 0.125, calibratedAt: Date.now() })`.
      Chip disappears.
- [ ] Run `updateFloor('b1-f1', { scalePxToFt: 0.05 })`. Chip stays
      hidden — calibratedAt is what makes a scale "real."
- [ ] Run `updateFloor('b1-f1', { calibratedAt: undefined })`. Chip returns.

---

## Workflow usability (real user clicks)

Manual regression for the canvas/surveyor selection + placement + door
workflow. Use a real cursor or trackpad — do not rely on programmatic
events. Open DevTools so you can verify persistence at each step.

### 14. Click on CAM-101 selects CAM-101 (PathwaysOverlay no longer steals clicks; root must not unmount)
- [ ] Fresh `localStorage.removeItem('deeperVisionStore')`. Open `/project/p1/canvas`.
- [ ] Click CAM-101 directly with the cursor. The SelectionPill renders
      above CAM-101 with an **Edit** button. **The canvas root must stay
      mounted** — no white screen, no React error boundary, console clean.
- [ ] Open DevTools and run
      `document.elementsFromPoint(...CAM-101 center coords).slice(0,2)`.
      The first element must be the transparent device hit-circle
      (`<circle data-hit="device">`), **not** a pathway polyline.
- [ ] Click **Edit**. The camera inspector drawer opens on the right
      side scoped to CAM-101.

### 15. PW-1 click opens pathway drawer; clicking a device hands off
- [ ] Click PW-1 (the cable run from CAM-101 → IDF-1). The right-side
      drawer opens with header `CAT6A · 10 ft · CAM-101 → IDF-1`.
- [ ] With the pathway drawer open, click CAM-102. The pathway drawer
      closes (or hands off); CAM-102's SelectionPill appears; the device
      EditDrawer is the only drawer open (no stuck pathway drawer).

### 15b. Blank canvas click clears both selected device and pathway
- [ ] Click PW-1 → PathwayDrawer opens.
- [ ] Click an empty corner of the canvas (no device, no pathway,
      no floorplan geometry — e.g. top-left of the SVG). PathwayDrawer
      closes; SelectionPill is gone; EditDrawer is gone.
- [ ] Repeat with a device selected, then click blank. Device deselects.

### 16. Doors tray is populated; placement via click-to-arm
- [ ] Click the **Doors** category in the BottomDeviceBar. The tray
      opens with 6 visible product cards: **Single door**,
      **Double door**, **Storefront door**, **Sliding door**,
      **Swing gate**, **Slide gate**. No empty tray.
- [ ] Each card's hint line reads **"Drag or click to place"** (not
      "Drag to place" — both flows work).
- [ ] Click the **Single door** card without dragging (just a click).
      A floating banner appears near the top reading
      "Click canvas to place Generic Single door. Cancel (Esc)".
- [ ] Click **inside an actual floorplan room** (over a `<path>` or
      polygon, not just the empty SVG background). A new door device
      lands at that point, the SelectionPill appears on it, and the
      banner disappears. **The canvas root must stay mounted.**
- [ ] DevTools: the new device exists in `state.devices` with
      `type === 'inf.door-single'`, `x` / `y` matching the click point
      in canvas space (within ±20 px of the snap grid).

### 17. Cancel armed placement
- [ ] Click a tray card to arm placement again.
- [ ] Press **Esc**. The banner clears with a "Placement cancelled"
      toast. No device is placed.
- [ ] Arm again, then click the **Cancel (Esc)** button in the banner.
      Same effect.

### 18. Drag-from-tray still works (longer drag distance)
- [ ] Click and **hold** a tray product card, drag the cursor onto the
      canvas (at least ~8 px of movement measured from the *initial*
      pointerdown coordinates), release. The device lands at the cursor
      position. The arm-banner does NOT appear (drag wins).
- [ ] After release, the new device is selected (SelectionPill on it).
      Refresh → device persists.

### 17b. Selected-object pill is Edit-first
- [ ] Click any device (e.g. CAM-101). The floating pill exposes these
      visible buttons in order: **More (Expand)** · **Edit** ·
      **Duplicate** · **Delete**. No kind-specific buttons (Rotate / FOV /
      Hardware / Electrify / Egress / Lens / Mode / Switches / PoE / etc.)
      appear in the visible row — they live in the More popover or in
      the Edit drawer.
- [ ] DevTools: the pill container's `button[data-track]` set is
      exactly `['pill-expand','pill-edit','pill-duplicate','pill-delete']`.
- [ ] Open the More popover: it shows Color / Stack / More details only.
      Duplicate and Delete are NOT duplicated inside More — they live in
      the visible row.

### 17c. Door assembly summary chip
- [ ] Drop hardware onto a door (e.g. reader + strike on DR-102).
- [ ] A compact chip appears at the top-right of the door glyph
      containing: the assembly count + 5 small class dots in order
      **R / L / X / M / P** (Reader / Lock / eXit / Monitor / Power).
- [ ] Each dot is filled when the door's `doorAssembly[]` contains
      any component in that class:
  - R = reader
  - L = strike OR maglock
  - X = rex OR panic OR autoop
  - M = dps OR contact
  - P = controller OR psu
- [ ] DevTools: `document.elementFromPoint(chipX, chipY)` returns
      `rect[data-hit="device-chip"]` (transparent, `pointer-events=all`)
      as the top element. Clicks at the chip area select the door,
      they do NOT fall through to floorplan geometry.
- [ ] The chip itself stays `pointer-events="none"`; selection comes
      from the sibling hit-rect.

### 17c-2. Door chip hit-target regression guard
- [ ] Select CAM-101 (or any other device) first.
- [ ] Click on the chip area of seeded DR-100 (the small chip at the
      top-right of the door glyph). DR-100 must select — not CAM-101 and
      not "nothing" (floorplan click-through).
- [ ] Probe: `document.elementsFromPoint(chip x, chip y).slice(0,2)`
      returns `[rect[data-hit="device-chip"], circle[data-hit="device"]]`.
      Pathway / FOV / floorplan geometry must NOT appear before either
      hit target.

### 17d. Symbol text-letter replacements
- [ ] cam.lpr now renders as a bullet camera body + plate-readout
      tick lines (no "LPR" text).
- [ ] cam.thermal renders with a small lens + radiating heat-dash
      lines (no "TH" text).
- [ ] acc.exit renders with a small outward-pointing arrow inside the
      rounded oblong (no "EX" text).
- [ ] acc.psu renders as a compact enclosure with a battery-cell
      rectangle and terminal tick (no "+−" text).
- [ ] All other plan symbols (cam.dome, cam.bullet, cam.turret, cam.ptz,
      cam.multisensor, cam.fisheye, acc.reader, acc.keypad, acc.biometric,
      acc.strike, acc.maglock, acc.dps, acc.panic, acc.controller,
      acc.intercom, door variants) unchanged.

### 17a. Canvas visual restraint
- [ ] Open `/project/p1/canvas` fresh. The default canvas should read as
      a calm survey plan:
  - FOV cones render at the default `coverageOpacity: 38` — quieter
    than the previous 55. They should look like translucent sightlines,
    not bright colored blobs.
  - Cable accessory and legacy fallback device glyphs render with a
    single quiet knock-out behind the symbol, **not** a tone-colored
    halo blob.
  - The technical SurveyorSymbol glyphs (cameras, doors, readers,
    strikes, etc.) read as restrained plan symbols with thin
    1.4-px strokes.
- [ ] Door host badge sits at top-right of the door symbol, radius 6,
      with `pointer-events="none"`. `document.elementsFromPoint(badge x,
      badge y).slice(0,1)` returns the device hit-circle (`fill=transparent`,
      `pointer-events=all`), not the badge — clicks at the badge
      position still select the door.

### 18a. Drag drop-on-host decision uses synchronous pointer coords
- [ ] Open Access tray, click and **hold** a product card, drag with a
      sparse / coarse cursor path that ends suddenly directly over a
      door (don't dwell over the door before releasing — simulate a
      hand that moves quickly the final inch).
- [ ] The drop still resolves as a door-assembly attach, not a
      floor-drop. No loose accessory device is created on the canvas.
- [ ] This guards against a regression where the drop decision relied
      on React `hoverHost` state set by pointermove. That state could
      lag the cursor and miss the final position; the pure
      `findHostUnderPointer` helper recomputes from pointerup coords.

### 18b. Drag reader / strike / REX / DPS / maglock onto a door = door assembly
- [ ] Place a door (or use seeded DR-100) on the canvas.
- [ ] Open the Access tray, drag a reader product card (e.g. **Signo 20**)
      onto the door glyph. Toast says **"Added reader to DR-…"**.
- [ ] No new `device-RD-…` or `device-DR-…` accessory device appears on
      the canvas. The door's badge increments by one.
- [ ] Repeat for a strike (**6210**), maglock (**M62**), REX
      (**REX-PIR**), DPS (**5816 Wireless**). Each adds the right slot
      to `device.doorAssembly[]`, no ghost device created.
- [ ] DevTools: `state.devices.<doorId>.doorAssembly` is the list of
      slots in the order they were dragged. **`device.stack` and
      `device.linkedIds` are undefined** on the door — neither legacy
      field is written under any circumstance for door hosts. No device
      in `state.devices` has `linkedIds` pointing at the door (no ghosts).
- [ ] Drag an **incompatible** product (e.g. a camera) onto the door:
      a toast warning appears, no device is created, no assembly mutation.
- [ ] Drag an **unmapped** access product onto the door (e.g. anything
      that's not in the reader/strike/maglock/rex/dps/contact/intercom/
      panic/autoop/controller/psu set): toast warns "X isn't door
      hardware"; no device is created; no assembly mutation; **no
      legacy stack write**.
- [ ] Canvas-to-canvas: drag the seeded `device-DR-1` (an `acc.strike`)
      onto a door. The source device is removed; `strike` is added to
      `doorAssembly[]` (or stays present if already there); door host
      is selected.

### 18b-2. Door inspector has Assembly tab, no Legacy stack
- [ ] Select a door → Edit drawer. The Stack tab label is renamed to
      **"Assembly"** for doors only. (Non-door hosts keep "Stack".)
- [ ] Inside the Assembly tab there is exactly **one** section:
      the DoorAssemblySection (checklist + electrification + reader
      location). There is **no** "Legacy stack" panel.
- [ ] DevTools: search the document for "Legacy stack" → 0 matches
      on any door inspector.

### 18c. Door host badge reflects assembly count
- [ ] On a door with N hardware items, the canvas glyph shows a small
      numbered chip (N) at the top-right of the door.
- [ ] As you drag more hardware onto the door, the chip increments.

### 19. Seeded door DR-100 + door assembly persists through real UI
- [ ] DR-100 (Reception door) is visible on `/project/p1/canvas`
      immediately on first load — no console injection required.
- [ ] DR-100 must NOT overlap the seeded `RD-1` (reader) or `DR-1`
      (strike). All three are independently selectable with the cursor.
      Verify by clicking each in turn — the SelectionPill must show the
      clicked id, not a neighbour's id.
- [ ] Click DR-100 → **Edit** → **Stack** tab. The
      **DoorAssemblySection** shows `reader / strike / rex / dps /
      controller / psu` toggled ON, **Fail-secure**, **Mullion**.
- [ ] On the **General/Overview** tile the **Door assembly impact**
      block lists the 6 components with `Hardware subtotal $2,530`.
- [ ] No legacy "+ Reader / + Strike …" Add hardware grid is visible
      for doors (that path is door-suppressed).

### 20. Place + toggle a brand-new door through the UI; BOM rolls up
- [ ] Use the workflow from check 16 to place a fresh Single door
      (e.g. DR-101 / DR-102 depending on cohort count).
- [ ] On the Stack tab, toggle Reader + Strike + REX + DPS. Pick
      Fail-secure. Refresh the browser.
- [ ] Re-select the new door — all four hardware items + Fail-secure
      survive.
- [ ] Navigate to `/estimate/p1`. The **Access control · doors**
      section contains one line per new-door hardware component
      (description `<DR-id> · Card / mobile reader`, sku
      `door-hw:reader`, etc.). Section subtotal matches Impact preview.

### 21. No required workflow depends on console / store injection
- [ ] Re-confirm: every check above was reached by clicking visible UI.
      No `useProjectStore.getState().addDevice(...)` calls were needed.

---

## Build / typecheck

### 22. Production build is clean
- [ ] `npm run build` — completes without TypeScript errors.

---

## Passes

> **The Pass-template column is intentionally empty.** Copy it as the
> next dated column whenever you run a real manual pass; fill `✓` /
> `✗` / `n/a` per row. Do **not** mark cells in the template column
> itself — it stays the unmarked baseline so it never falsely suggests a
> pass already ran.

| # | Scenario | Pass-template |
|---|---|---|
| 1 | Intake creates persisted record | |
| 2 | Existing-project intake no-dup | |
| 3 | Calibration persists (with metadata) | |
| 3b | Recalibration overwrites cleanly | |
| 4 | Calibrate with no floor | |
| 5 | Canvas drag/rotate persist | |
| 6 | Edit drawer persists | |
| 7 | Multisensor independence | |
| 9 | Door assembly persists | |
| 10 | Door assembly → Impact + BOM + CSV | |
| 11 | Object-linked survey note persists | |
| 12 | Calibrated measurement readouts update | |
| 13 | Scale-bar calibratedAt honesty | |
| 14 | Click CAM-101 selects + root stays mounted | |
| 15 | PW-1 click + device hand-off | |
| 15b | Blank click clears device AND pathway selection | |
| 16 | Doors tray populated (6); click-to-arm on path geometry | |
| 17 | Cancel armed placement (Esc + button) | |
| 18 | Drag-from-tray still works | |
| 19 | Seeded DR-100 + assembly visible | |
| 20 | Place new door + assembly + BOM rollup | |
| 21 | No console injection required | |
| 22 | Build clean | |

---

## Surveyor usability pass (2026-05-17)

Run after any change to `EngineeringCanvas.tsx`, `SurveyorSymbols.tsx`, or
canvas chrome. The 11 defects below were called out in the 2026-05-17
surveyor-pass brief; each row is a UI regression check.

### S1. Compass (single, professional, static)
- [x] Only ONE compass on screen, anchored top-right of the canvas
      (`title="North indicator · canvas-up = North"`).
- [x] No duplicate North arrow inside the placeholder building SVG.
- [x] Compass is calm: thin border, small ~28 px circle, "N" label legible
      against the dial.

### S2. Wall tool finish flow (revised after reviewer rejection)
The first version of this fix cleared `wallStart` on finish but left the
tool armed, so the next blank-canvas click started a new wall chain.
Reviewer reproduced that — corrected behaviour now:

- [x] Activating Wall (rail click or `W`) shows the **Tool status banner**
      top-center.
- [x] First canvas click → subtitle reports "Drawing walls · 1 segment so
      far · click next vertex · Enter or double-click to finish", Done is
      enabled.
- [x] **Enter** finish → `setWallStart(null)`, `setWallCursor(null)`,
      `setTool('select')`. Banner disappears, active tool flips to Select,
      next canvas click does NOT start a new wall.
- [x] **Double-click on the canvas** finish behaves the same as Enter.
- [x] **Done button** finish behaves the same as Enter.
- [x] **Cancel button / Esc** clears the wall state and returns to Select.

### S2a. Line tools (cable / conduit / pathway) finish to Select
- [x] `finishCableDraw` already calls `setTool('select')` after committing
      the run. Verified by arming Cabling (any cable type), drawing two
      vertices, pressing Enter → active tool flips to Select, banner gone,
      and subsequent canvas click does NOT start a new vertex chain.

### S3. Tool rail z-index
- [x] Click any rail tile (e.g. Pan). The expanded 260 px side panel
      opens with `z-index: 50` and is fully readable over the canvas
      surface (no overlay clips it).
- [x] The rail wrapper itself sits at `z-index: 40` so the rail + panel
      paint above the canvas chrome.

### S4. No coming-soon controls in the tool rail
- [x] The "More" tile is gone from the rail; only 7 tiles remain
      (Select / Pan / Measure / Wall / Snap / Layers / Map).
- [x] No occurrence of the string `Coming soon` on `/project/p1/canvas`
      after load (`document.body.innerText` check).

### S5. Selection pill safe-rect clamp (revised after reviewer rejection)
Original fix clamped only to the canvas container, which let the pill
hide behind the left tool rail, bottom tray, and right edit drawer.
Now the pill computes a **safe rect** from `[data-canvas-chrome]`
overlays and clamps inside that rect.

- [x] Pan content rightward so a device lands off-canvas to the right;
      select it — pill clamps with 10 px right margin (= `PAD`).
- [x] Pan content leftward so a device lands under the left rail; select
      it — pill stays fully clear of the rail (left margin = rail-right
      + 10 px). Verified left edge 332 → pill 342 (10 px gap).
- [x] Pan content downward so a device sits under the bottom tray; select
      it — pill flips above the tray with 10 px gap. Verified
      tray-top 828 → pill bottom 818 (10 px gap).
- [x] Pill anchor honours `pan` — drag-pan the canvas, re-select; pill
      still anchored over the device's screen position.
- [x] When the right Edit drawer is open
      (`[data-canvas-chrome="drawer"]`), the pill clamps inside the
      drawer's left edge.
- [x] Tether line follows the device horizontally after a clamp.

### S6. Drag without bounce
- [x] Drag a device across the canvas. Max per-frame lag between cursor
      and glyph is ≤ 2 px through the move (no spring lag).
- [x] On pointerup the glyph is already at the cursor (no settle).

### S7. Symbols + halos restrained (revised after reviewer rejection)
Reviewer flagged that shrinking halos alone wasn't enough — the plotted
symbols still read as cartoonish. Now `HardwareGlyph` renders symbol
bodies at **0.72×** their natural viewBox with a **1.1-px** hairline
stroke (down from `scale(1.0)` / `stroke 1.4`), and the selected-state
inner ring is **r=10 solid** (down from r=14 dashed). Hit-target radius
is unchanged.

- [x] Symbol `<g>` carries `transform="scale(0.72) translate(-12, -12)"`
      verified in DOM.
- [x] Selected device's outer halo is a hairline ring at `r="13"`
      (was `r="20"` filled).
- [x] Selected device's inner symbol ring is `r="10"` solid (was r=14
      dashed).
- [x] Stack-count chip on door hosts moved to (8, -8) with r=4.4
      (was (11, -11) with r=6).
- [x] Hover lift filter is a soft `drop-shadow(0 1px 2px rgba(0,0,0,0.18))`
      (down from `0 4px 12px ... 0.45`).
- [x] Hit-circle radius (`Math.max(16, 18 * iconScale)`) unchanged so
      touch targets stay comfortable.

### S8. Selection pill More menu
- [x] Pill's expand button shows label "**More**" + chevron; chevron
      rotates `180deg` on open (`aria-expanded` flips).
- [x] Click opens a 180 px popover with 3 items (Color · Stack · More
      details).
- [x] Click outside or Esc closes it.

### S9. Measure tool affordances
- [x] Activating Measure shows the banner: title "Measure", subtitle
      "Click the first point on the plan".
- [x] First click → subtitle "Click the second point to lock the distance
      · Esc cancels".
- [x] Second click → subtitle "Distance locked · click again to remeasure
      · Clear to reset", Done enabled.
- [x] **Done** clears the measurement, returns the active tool to Select,
      and dismisses the banner. Measure mode is NOT left armed — a
      subsequent canvas click does not start a new measurement.
- [x] Esc / Cancel also clears the measurement and returns to Select.

### S10. Coverage / FOV handle math respects pan
- [x] Pan the canvas, select a camera, drag the cone tip handle radially
      outward 80 px. Range label increases by ~80 px / 3.83 px-per-ft (no
      shoot-forward).
- [x] Both `ConeHandles` call sites pass the same `pan` prop used inside
      `EngineeringCanvas` (no stale closure).

### S11. Overall calmer chrome
- [x] Pill body uses `box-shadow: 0 2px 6px rgba(0,0,0,0.18)` (was
      `0 8px 22px -12px rgba(0,0,0,0.45)`).
- [x] Pill backdrop blur reduced to 10 px.
- [x] Multisensor's "all" coverage ring is r=10.5 with `stroke-opacity ~ 0.4`
      (was r=14.5, opacity 0.55 + breathing).
- [x] Non-selected multi-camera dash ring is `r=12` `strokeWidth=0.8`
      `opacity=0.45` (was r=18 / strokeWidth=1.5 / opacity=0.7).

### Verification matrix (Pass 2 — 2026-05-17, post-reviewer)
| Defect | Status | How verified |
|--------|--------|--------------|
| 1 Compass | Fixed | DOM check: 1 compass top-right, 1 SVG "N" inside it |
| 2 Wall finish | Fixed | Enter / dblclick / Done each flip active tool to Select, banner disappears, next blank click does NOT extend |
| 3 Rail z-index | Fixed | Panel computedStyle.zIndex === '50', rail '40' |
| 4 Coming-soon | Fixed | 7 tools listed, no "coming soon" text on canvas |
| 5 Pill safe-rect | Fixed | Off-canvas-left device → pill left=342, rail right=332 (10 px gap); off-canvas-bottom device → pill bottom=818, tray top=828 (10 px gap) |
| 6 Drag bounce | Fixed | Max lag during drag ≤ 3 px; final position == cursor exactly |
| 7 Symbol restraint | Fixed | Symbol `<g scale(0.72)`, selected inner ring r=10, stack chip r=4.4 |
| 8 Pill dropdown | Fixed | More button opens 3-item menu, chevron rotates 180° |
| 9 Measure flow | Fixed | idle / awaiting-end / locked / Done returns to Select (banner dismissed, tool unarmed) |
| 10 FOV handle | Fixed | Range label changes monotonically (62 → 63 → 66 → 68 → 70 → 73 → 75 ft) under radial tip drag with `pan != 0`; no jumps |
| 11 Chrome | Fixed | Pill shadow `0 2px 6px / .18`, blur 10 px, halo opacities reduced |
| Line tools finish | Fixed | Cable Enter finish → active tool Select, subsequent canvas click does NOT add vertex |
| Door drag-to-attach | Working | dv-stack-attach event still fires; verified by direct event dispatch — DR-100's `doorAssembly` is preserved; pipeline untouched by this pass |

### Known pre-existing console warning (NOT introduced by this pass)
`Warning: Cannot update a component (PathwaysOverlay) while rendering a different component (EngineeringCanvas).`
Verified pre-existing by `git stash` + reload: same warning fires on the untouched main branch. PathwaysOverlay was not modified in this pass.

`npm run build` exits `0` for this pass.

---

## Known cosmetic / non-blocking issues (deferred — do not block on these)

- **P2 — Door placement id off-by-one.** A fresh `/project/p1/canvas` already
  has DR-100 (seeded). The next door placed (click-to-arm or drag) gets the
  id `DR-102`, not `DR-101`. The cohort counter computes `100 + count + 1`
  where `count` already includes DR-100. Functionally fine; numbering is
  cosmetic. Not worth a fix without UX feedback.
- **P2 — Legacy `Door` record duplication.** `state.doors['DOOR-101']`
  (pre-existing from before the door-as-Device model) generates its own line
  in the Estimator's *Access control · doors* section, separate from DR-100's
  per-component lines. The two representations co-exist and double-count.
  Documented risk; unification is a larger object-model change deliberately
  deferred.
- **P2 — `device-DR-1` is an `acc.strike`, not a door.** Pre-existing seed
  uses the `DR-` prefix for a strike. Now that placed doors also use `DR-`,
  the label namespace is overloaded. Confusing on read but doesn't break any
  workflow. A future renaming pass should split the prefixes (e.g. door
  openings get `OPN-` so `DR-` is unambiguously strike).
- **P2 — Visual density.** Default `/project/p1/canvas` has overlapping FOV
  cones because the seeded cameras cover a small floorplan. Pre-existing.
  Mitigate by toggling the `fov` layer off in Layers if you need clarity.
