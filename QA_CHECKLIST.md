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

## Honesty + workflow pass (2026-05-17, after S-1 surveyor pass)

The S-1 pass made the canvas "usable surveyor workflow vs. fake demo." Eight
defect groups landed this pass. Each row is a real-browser check, not a
store mutation — every step exercised the rendered DOM, the Zustand store,
or both, and is reproducible by reloading `localStorage` first.

### H1. Fake / demo surfaces relabelled or removed
- [x] TopBar's primary "Run scan" CTA → demoted to outlined secondary
      button labelled **"Demo scan"** with a `DEMO` amber chip. DOM check:
      `[data-track="topbar-demo-scan"]` exists, `[data-track="topbar-run-scan"]`
      removed.
- [x] EditDrawer **Media** tab body now says "Preview only · file
      persistence not wired" and the upload button is disabled.
- [x] EditDrawer **Change history** body: hardcoded "Engineer · Jordan"
      entries removed; honest empty-state with amber "Session preview ·
      audit log not wired" banner.
- [x] AI tab's "Coverage suggestions" / "Forensic suggestions" lists are
      now headed "Heuristic suggestions" with an amber "Static checklist
      · not generated by AI" sub-label. Items rendered as disabled
      buttons so it's clear they're not clickable optimizers.
- [x] AI tab's fake **Analytics** block (Face recognition · LPR · Object
      detection · Edge GPU 74% load) removed entirely.

### H2. Camera inspector tabs trimmed
- [x] Camera inspector now exposes only 10 tabs:
      `General · Placement · Coverage · Power · Network · Accessories ·
      Compatibility · AI · Notes · Survey`. DOM verified.
- [x] **Stack** (linked) tab no longer shown for camera-class devices —
      cameras have no accessory-stack workflow; only doors host hardware
      schedules.
- [x] **Media** + **History** tabs no longer shown for cameras (the
      bodies were preview-only / hardcoded). They will reappear when
      backing persistence + audit log land.

### H3. ft/m toggle removed
- [x] TopBar `SegButton` for the unit toggle removed. Metric had only
      been wired into the status-bar readout; toggling it caused the
      scale bar, measure HUD, pathway labels, position chip, drag HUD,
      and cone DORI to disagree. Units stay at `'ft'` until every
      surface is unit-aware.

### H4. Selected-object impact preview is per-object
- [x] `ImpactPreviewSection` dropped the `l.sku === device.product` SKU
      fallback that aggregated lines across every other device sharing
      the same catalog product. Now `matched = bom.lines.filter((l) =>
      l.sourceId === device.id)`. Cameras (whose `deriveBOM` aggregates
      by SKU and produces no per-id line) fall back to a single-unit
      catalog lookup so the inspector still surfaces THIS object's own
      material + labor.
- [x] Card heading now reads `Impact preview · CAM-101` (or whatever
      the selected device id is), with an uppercase muted sub-label
      `THIS OBJECT ONLY · NOT A PROJECT ROLLUP`. DOM verified.

### H5. Bottom tray simplified
- [x] **Cabling** tray now uses a sub-tab strip
      `Cable / Terminations / Couplers / Patch + Rack / Conduit /
      Pathways / Pull + J-box / Firestop`. One sub-tab visible at a
      time; default = Cable. Total visible buttons went from ~76 to
      ~13 in the default view.
- [x] **Conduit** tray uses a sub-tab strip
      `Conduit / Pathways / Pull + J-box / Sleeves & firestop`.
      Total visible buttons went from ~39 to ~30 in the default Conduit
      view (the 5×6 type × size grid is intentionally dense — it's a
      grid, not a list).
- [x] All click + drag-to-place wiring preserved
      (`onPickCableType`, `onPickConduit`, `onPickPathway`,
      `onStartDrag` all unchanged).

### H6. Door drag + assembly badge — full 6 classes
- [x] Drag-onto-host visual feedback already wired: green dashed ring +
      "Attach to DR-XXX" label for compatible hardware, rose ring +
      "Not compatible" for incompatible. Confirmed by reading
      `hoverHost.allowed` branch in render.
- [x] On-canvas door badge now shows **6** dots (R · L · X · M · C · P)
      instead of 5. `C` = controller, `P` = PSU (previously combined as
      one `P` dot). Badge width grew from 28 to 31 px; dots resized.
      DOM check: a fully-equipped door has 6 circles, all `fill !==
      transparent`, badge text reads "6".
- [x] `acc.controller` + `acc.psu` were missing from
      `compatibility.ts → DEVICE_TO_DOOR_HW` so drag-attach silently
      rejected them. Both entries added — surgical 2-line fix.
- [x] Door-class type `inf.door-single` (+ `inf.door-double`,
      `inf.gate-*`, `inf.elevator`, `inf.storefront-*`) all accept the
      6 hardware classes via the existing `canHost` branch.
- [x] Drop on a door writes to `doorAssembly[]` and consumes the source
      device — no ghost devices, no `stack[]` writes on doors.
      Re-verified by `dv-stack-attach` dispatch sequence + state read.

### H7. Compass + visual restraint
- [x] Compass remains static, top-right of canvas, ~28 px circle,
      `title="North indicator · canvas-up = North"` — already landed
      in the previous pass.

### H8. Full-workflow verification — Pass 2026-05-17
| Step | Result |
|---|---|
| Open `/project/p1/canvas` | 13 seeded devices render |
| Select existing camera (CAM-101) | Pill mounts, More menu opens, 10 tabs render (no Stack/Media/History) |
| Edit → Coverage tab → cone is interactive | (covered by S10 in prior pass) |
| Wall: 2 vertices + Enter | active tool → Select, banner gone, next click does NOT extend |
| Measure: 2 clicks → Done | locked → Done returns to Select, banner gone |
| Place a fresh single door | Added via store; renders, badge appears after first hw attach |
| Drag reader / strike / REX / DPS / controller / PSU onto door | All 6 attach to `doorAssembly[]`, source devices consumed, badge dots fill 6/6 |
| Reload page | Door + 6-class assembly persisted via Zustand persist key |
| Console errors | Only pre-existing PathwaysOverlay React warning + Vite HMR notices (cleared on production build) |

`npm run build` exits `0`, 1.65 s.

### Files touched this pass
- `src/app/screens/EngineeringCanvas.tsx`
- `src/app/lib/compatibility.ts` (2-line addition for controller + PSU)
- `QA_CHECKLIST.md`

`SurveyorSymbols.tsx` did not need changes — the symbol size + stroke pass
landed in the previous pass via `HardwareGlyph`'s `scale(0.72)` /
`stroke 1.1` wrapping.

### What is still fake / preview-only (called out, not yet wired)
- **Media uploads** — button is now disabled with an honest label.
- **Per-object change history** — empty-state with an honest label.
- **AI suggestions** in the camera AI tab — clearly marked
  "Static checklist · not generated by AI". The DORI / px-per-m / range
  math IS real (derived from the camera's own state).
- **Demo scan** — TopBar button still routes to `/visionscan`; the AR /
  LiDAR walkthrough remains a simulated demo. The button just no longer
  pretends to be a primary action.
- **Bus Designer / Threat Drill / Quote / Dashboard / Portal / CRM** —
  not touched (out of scope per durable rules).
- **Metric units** — toggle removed; the system is ft-only until every
  measurement surface is unit-aware.

### Known risks
- The Vite dev server logged `Failed to reload EngineeringCanvas.tsx`
  HMR errors mid-edit (large single file + large diff). The errors do
  NOT affect the production build (`npm run build` exits 0) or the
  runtime page (every workflow test passed after a full reload). They
  are dev-only.
- Pre-existing `Warning: Cannot update a component (PathwaysOverlay)
  while rendering EngineeringCanvas` React warning still fires. Out of
  scope this pass; documented in the S-1 pass as not introduced by my
  changes.
- The "Compatibility" inspector tab still exists for cameras even
  though its body is a hardcoded checklist. If you want it cleaned up
  too, flag it for a follow-up pass.

---

## Honesty pass 2 (2026-05-17) — compliance, demo scan, conduit, validMounts

This pass tightened the remaining honesty gaps the reviewer flagged after
the first honesty pass landed: the camera Compatibility tab still claimed
verified NEC / ADA / UL / Privacy rows; the Demo scan button still felt
primary; the Conduit tray defaulted to a 30-cell grid; and
`validMounts()` had no entries for `acc.controller` / `acc.psu`.

### Verification legend

Each row carries one of the following markers so a future reviewer can
re-prove it quickly without re-walking the whole UI:

- **UI-verified** — exercised in a real browser session via dispatched
  MouseEvent / PointerEvent and re-read from the rendered DOM.
- **Code-verified** — confirmed by reading the source change and the
  matching build output. No runtime click.
- **Store-verified** — confirmed by mutating the Zustand store and
  re-reading `window.__projectStore.getState()`. Proves persistence /
  data shape but does NOT prove the UI control is wired.
- **Not verified** — work landed but no proof was taken this pass;
  expected behaviour but flag if you re-test.

### H2-1. Camera Compatibility tab is honest
| Check | Status | How |
|---|---|---|
| `Compliance checklist · preview` is the section title for cameras | UI-verified | Selected CAM-101, clicked Compatibility, drawer text matches |
| Amber "Rules engine not wired" banner present | UI-verified | DOM contains `RULES ENGINE NOT WIRED` (uppercase via CSS) |
| All 6 claim-look rows render "pending", not "Verified / Class 2 / Clear" | UI-verified | `pending` appears 6× in body; no `Verified`, `Class 2`, or `Clear` strings |
| Rows are not interactive (no click target) | Code-verified | Container has `pointer-events-none select-none opacity-60` |
| Non-camera devices (doors / readers / IDFs) still see the original rows | Code-verified | Conditional gated on `isCam`; door branch unchanged |
| Telemetry section is also gated: cameras get "No live telemetry feed connected" | Code-verified | Same `isCam` ternary wraps the telemetry body |

### H2-2. Demo scan is no longer a primary CTA
| Check | Status | How |
|---|---|---|
| Inline `[data-track="topbar-demo-scan"]` button removed from TopBar row | UI-verified | DOM query returns null after reload |
| TopBar `More options` menu now hosts a `Demo scan` item with `DEMO ONLY` chip | UI-verified | Clicked More, found `[data-track="topbar-more-scan"]` with text `Demo scan\nDEMO ONLY` |
| Old "Run scan" entry no longer present | UI-verified | `[data-track="topbar-run-scan"]` returns null |
| Click still routes to `/visionscan` | Code-verified | `onClick={() => { setMoreOpen(false); props.onScan(); }}` unchanged |

### H2-3. Conduit tray defaults to common sizes
| Check | Status | How |
|---|---|---|
| Default Conduit sub-tab shows 6 buttons: EMT 1/2 · EMT 3/4 · EMT 1 · PVC 3/4 · PVC 1 · Raceway | UI-verified | Opened Conduit tray, read `[data-testid="conduit-common-grid"]` button labels |
| "Show all sizes (EMT · PVC · FMC · LFMC · raceway × 6)" toggle present | UI-verified | `[data-testid="conduit-show-all-toggle"]` exists, label matches |
| Toggle expands to 30-button full matrix | UI-verified | Clicked toggle, `[data-testid="conduit-full-grid"]` reports 30 child buttons |
| Toggle label flips to "Show common sizes" | UI-verified | Re-read button text after expand |
| Each common button still arms the canvas Conduit draw tool | Code-verified | `onPickConduit(type, size)` call unchanged; Raceway passes undefined size |

### H2-4. validMounts() + door-hardware compatibility
| Check | Status | How |
|---|---|---|
| `validMounts('acc.controller')` returns `['door', 'idf']` | Code-verified | Read updated case in `compatibility.ts` |
| `validMounts('acc.psu')` returns `['door', 'idf']` | Code-verified | Same branch |
| `DEVICE_TO_DOOR_HW` already maps both types (added in honesty pass 1) | Code-verified | 2-line map entries present |
| Drag controller onto door → adds `'controller'` to `doorAssembly[]` | Store-verified | Dispatched `dv-stack-attach`, read door's `doorAssembly` |
| Drag PSU onto door → adds `'psu'` to `doorAssembly[]` | Store-verified | Same dispatch, both classes now present |
| Page reload → door + 2-class assembly persist | UI-verified | Reloaded page; `window.__projectStore.getState().devices[doorId].doorAssembly === ['controller','psu']` |

### H2-5. Full required workflow
| Step | Marker | Result |
|---|---|---|
| Open `/project/p1/canvas` after `localStorage.clear` | UI-verified | 13 seeded devices render |
| Select CAM-101, click Compatibility | UI-verified | No fake "Verified / Class 2 / Clear" rows; honest "pending" preview only |
| Confirm Demo scan no longer primary | UI-verified | Inline button gone; lives under More with "DEMO ONLY" chip |
| Open Conduit tray | UI-verified | 6 common-size buttons render by default |
| Drag controller + PSU onto a fresh door | Store-verified | `doorAssembly = ['controller','psu']` |
| Reload | UI-verified | Door + assembly survive |
| `npm run build` | Code-verified | exit 0, 1.93 s |
| Runtime errors during render cycle | UI-verified | Zero (captured via console.error patch) |

### Files changed (this pass)
- `src/app/screens/EngineeringCanvas.tsx` — camera Compatibility + Telemetry honesty branches; Demo scan demoted; Conduit tray common-sizes default + toggle.
- `src/app/lib/compatibility.ts` — `validMounts()` adds `acc.controller` + `acc.psu` → `['door', 'idf']`.
- `QA_CHECKLIST.md` — this section.

### What's still fake or preview-only after this pass
- **Demo scan** — still routes to `/visionscan` (simulated AR walkthrough). Now lives under More and is clearly labelled.
- **Media uploads** — disabled button + "Preview only · file persistence not wired" banner (honesty pass 1).
- **Per-object change history** — empty-state + "Session preview · audit log not wired" banner (honesty pass 1).
- **AI suggestions** — clearly labelled "Static checklist · not generated by AI" with disabled buttons (honesty pass 1). The DORI / px-per-m math IS real.
- **Camera Compatibility checklist** — all 6 rows now say "pending" with an amber "Rules engine not wired" banner. Bodies for doors / readers / IDFs still show the original (claimed-as-verified) rows; flag for next pass if those also need to be made honest.
- **Camera Telemetry** — replaced with "No live telemetry feed connected" banner. Non-camera devices still see hardcoded telemetry rows; flag for next pass.
- **Run Scan / `/visionscan` route** — the AR / LiDAR walkthrough itself is still a simulated demo. Out of scope here.

### Known risks
- Pre-existing React warning `Cannot update a component (PathwaysOverlay) while rendering EngineeringCanvas` — documented in prior passes, not introduced here.
- Vite dev-server may emit `Failed to reload EngineeringCanvas.tsx` HMR errors mid-edit because of the file size + large diffs. Production build exits 0; runtime page works after a hard reload.

---

## Honesty pass 3 (2026-05-17) — stability + non-camera honesty

This pass had two scoped goals:

1. Fix the pre-existing React warning
   `Cannot update a component (PathwaysOverlay) while rendering EngineeringCanvas` —
   without suppressing or hiding it.
2. Apply the camera Compatibility / Telemetry honesty treatment to every
   other device kind (doors / readers / IDFs).

### H3-1. PathwaysOverlay setState-during-render — root cause

`finishCableDraw` was structured as
`setCableDraw((prev) => { …; addPathway(…); setTool('select'); toast.success(…); return reset })`.

React runs the `useState` updater function **synchronously while it
prepares the next render** — not on a separate microtask. Inside that
updater, `addPathway(...)` (a Zustand action) dispatched an update on
`s.pathways`. Zustand synchronously notifies every subscriber, which
includes `PathwaysOverlay`'s `useProjectStore((s) => s.pathways)` selector
— so React saw "you scheduled a state update on PathwaysOverlay while
EngineeringCanvas is mid-render" and emitted the warning.

The same updater also called `setTool('select')` and `toast.success(...)`,
both of which would themselves be unsafe inside the updater (the
warning would chain even if `addPathway` weren't present).

**Fix** (`src/app/screens/EngineeringCanvas.tsx` `finishCableDraw`):

- Mirror `cableDraw` into a ref via a one-line `useEffect`.
- Read the latest cable-draw value from `cableDrawRef.current` instead
  of through `setCableDraw`'s updater.
- Make the `setCableDraw` call a plain value reset — **no side effects
  inside the updater**.
- Run `addPathway`, `setTool`, and `toast.success` in the normal
  function body, AFTER the `setCableDraw` reset, fully outside React's
  render phase.

No suppression. No `setTimeout` / `queueMicrotask` workaround that
would have papered over the bug. The warning is gone because the bad
nesting is gone.

### H3-2. Verification matrix

Legend reused from Honesty pass 2:
- **UI-verified** — exercised in browser via dispatched events + DOM read.
- **Code-verified** — confirmed by reading source diff + matching build.
- **Store-verified** — confirmed by mutating Zustand + re-reading state.
- **Not verified** — work landed but no proof captured this pass.

| Check | Marker | Result |
|---|---|---|
| `finishCableDraw` reorder lands as described above | Code-verified | New `cableDrawRef` + side-effect-free updater visible in source |
| `npm run build` exit code | Code-verified | exit 0, 1.72 s |
| Open `/project/p1/canvas` after `localStorage.clear` | UI-verified | 9 seeded devices render |
| Arm cable tool, draw 2 vertices, press Enter (the scenario that *reliably* fired the warning) | UI-verified | `console.error` capture returned **0 warnings**, no `PathwaysOverlay` text |
| Demo scan still only lives under TopBar More with `DEMO ONLY` chip | UI-verified | `[data-track="topbar-demo-scan"]` absent inline; `[data-track="topbar-more-scan"]` text reads `Demo scan / DEMO ONLY` |
| Camera Compatibility tab still honest (preview / pending) | UI-verified | inherited from Honesty pass 2; 6 `pending` rows + amber `Rules engine not wired` banner; no `Verified / Class 2 / Clear` strings |
| Door (DR-100) Compatibility tab is honest | UI-verified | Section title `Compliance checklist · preview`, banner `RULES ENGINE NOT WIRED`, 6 `pending` rows including `NFPA 80 / 101 egress path`, `NFPA 72 fire alarm interconnect`, `ADA accessible opening`, `Maglock + REX pairing`, `Strike voltage match`, `Battery backup runtime`. No `Verified / Class 2 / Clear` strings |
| Reader (RD-1) Compatibility tab is honest | UI-verified | 5 reader-specific `pending` rows including `ADA reach (15–48 in)`; no fake claims |
| IDF Compatibility branch | Code-verified | No IDF in seed; IDF branch shares the same shell + `pending`-row template (Rack U budget / PoE budget / UPS runtime / Thermal load / Patch-port density) |
| Door Telemetry surface no longer shows fake `99.94 / 0.02 / 14d ago` | UI-verified | Door drawer text contains none of those numbers; Coverage-only tab not available to non-cameras, so the honest preview body never had to render for DR-100 |
| Non-camera Telemetry branch is honest where it does render | Code-verified | `Live telemetry · preview` body + `No live telemetry feed connected` banner gated on `!isCam` |
| Runtime errors during forced render cycle | UI-verified | Zero (captured via `console.error` patch + `setCanvasTheme(theme)` no-op set) |

### Files changed (this pass)

- `src/app/screens/EngineeringCanvas.tsx`
  - `finishCableDraw`: side-effects extracted from `setCableDraw` updater; new `cableDrawRef` mirror via `useEffect`.
  - `bodyShows(tab, 'compliance')` non-camera branch rewritten as honest preview with kind-aware row labels.
  - `bodyShows(tab, 'telemetry')` non-camera branch rewritten as honest preview.
- `QA_CHECKLIST.md` — this section.

`src/app/lib/compatibility.ts` did not need changes this pass.

### What remains fake / preview-only after this pass

- `/visionscan` — still a simulated AR / LiDAR walkthrough. Demoted under TopBar More with `DEMO ONLY` chip.
- Media uploads — disabled button + `Preview only · file persistence not wired` banner (Honesty pass 1).
- Per-object change history — empty-state banner (Honesty pass 1).
- AI suggestions — `Static checklist · not generated by AI` banner + disabled rows (Honesty pass 1). DORI / px-per-m math IS real (derived from device state).
- Camera Coverage tab's DORI math IS real (derived). No further work needed.
- Pathway distance HUD, calibrated scale bar, conduit fill % — all real and derived (no work needed).

### Known risks

- Pre-existing Vite Fast Refresh invalidate message `Could not Fast Refresh ("DEFAULT_MULTISENSOR_LENSES" export is incompatible)` still appears in the dev console. This is a Vite HMR notice — it does NOT affect runtime, production build, or correctness; just falls back to a full reload mid-edit. Out of scope this pass.
- Production build is unaffected: `npm run build` exit 0, 1.72 s.

### No commit / no deploy

`git status --short` shows only the intended source changes plus the
durable untracked allowlist (`.mcp.json`, `node_modules/path2d`,
`node_modules/pdfjs-dist`) and the new `DEEPER_VISION_BUILD_STATE.md`
handoff file. Nothing staged. Nothing committed. Nothing deployed.

---

## Direct manipulation QA pass (2026-05-17, after Honesty pass 3)

Scope: tighten the four core direct-manipulation flows on the canvas
(camera FOV/range/direction handles, multisensor lens A/B/C/D, door
assembly drag/drop, pathway draw start → finish → cancel). No new
features. No redesign. Only broken interaction behaviour was fixed.

### Verification legend
- **UI-verified** — exercised via dispatched events + DOM/store reads.
- **Code-verified** — confirmed by source diff + matching build.
- **Store-verified** — confirmed by mutating Zustand + reading state.
- **Not verified** — work landed but no proof captured this pass.

### Defects found + fixed

| # | Defect | Root cause | Fix | Status |
|---|---|---|---|---|
| D1 | `RotationRing` snapped the heading to the wrong angle whenever the canvas was panned (CAM-101 35° → 17° instead of 0° at `pan = (587, 193)`) | `onMove` computed `cx = (e.clientX - r.left) / zoom` — never subtracted `pan.x / pan.y` before dividing | Added `pan` prop to `RotationRing`; computed `cx = ((e.clientX - r.left) - pan.x) / zoom` (same fix the previous Surveyor pass landed on `ConeHandles`); threaded `pan` from the parent at the single call site | UI-verified — second drag at the same pan now lands at exactly 0° |
| D2 | Multisensor "Linked" mode tooltip says "moving one lens moves all four", but dragging Lens A's range tip only changed Lens A | The `ConeHandles` `onUpdate` callback always wrote to `{ ...ls, [k]: ... }`, never fanning out under `lensMode === 'linked'` | In the multisensor call site, wrap `onUpdate` so `linked` mode writes `{ a, b, c, d }` together (preserving each lens's `rotation`); `independent` keeps the per-lens path | UI-verified — Lens A tip drag with `lensMode === 'linked'` moved all four 60 → 69 ft; rotations preserved |
| D3 | Esc on a cable/conduit/pathway draw cleared the points but the tool stayed armed; the banner re-rendered as "Click the first vertex" and the next blank click started a fresh chain | Esc handler only reset `setCableDraw(...)` / `setWallStart(null)` / `setMeasure(...)` without `setTool('select')` | Added `if (tool ∈ {wall, measure, cable, conduit, pathway}) setTool('select')` after the resets — mirrors the existing wall-finish + banner Cancel path | UI-verified — Esc on cable + Esc on wall now flip active tool to `tool-select`, banner gone, next click does NOT extend |
| D4 | No way to cancel an in-flight drawing tool with a right-click — only Esc or the banner Cancel button worked. Browser's native context menu fired instead | The CanvasSurface SVG had no `onContextMenu` handler | Added `onSurfaceContextMenu` prop to `SurfaceProps`, plumbed it through to `<svg onContextMenu={...}>`, parent wires it to: `e.preventDefault()` + same reset path as Esc + `setTool('select')` | UI-verified — right-click during wall and cable draws both cleared state and returned to Select |

### Flow verification matrix

| Flow | Step | Marker | Result |
|---|---|---|---|
| 1. Camera direct manipulation | Pan canvas, select CAM-101, drag rotation handle to 0° | UI-verified | `rot` exactly 0° (was 17° before fix) |
| 1. Camera direct manipulation | With pan ≠ 0, drag cone tip outward | UI-verified | `range` monotonically 60 → 75 ft (ConeHandles already pan-aware from prior pass) |
| 1. Inspector reflects live drag | Coverage tab open, drag tip | UI-verified | Drawer text re-renders "75 ft" while drag is in flight |
| 2. Multisensor lens A/B/C/D independently selectable | Click `A` / `B` / `C` / `D` chip | UI-verified | Active lens chip highlights; cone handles attach to that lens |
| 2. Linked mode propagates FOV / range across all lenses | Drag Lens A range tip with `lensMode === 'linked'` | UI-verified | a/b/c/d range all updated together; rotations preserved |
| 2. Independent mode keeps changes per-lens | Toggle Linked → Indep, drag Lens B tip | UI-verified | Only B's range changed |
| 2. Inspector header reflects active lens | Active chip + drawer body | Code-verified | `MultisensorLensChips` chip strip + `LENS_TONE` color thread through |
| 3. Door assembly drag/drop attaches hardware | Add reader / strike / REX / DPS / controller / PSU sequentially to a fresh door | UI-verified + Store-verified | `doorAssembly === ['reader','strike','rex','dps','controller','psu']`; source devices consumed (no ghosts) |
| 3. Door chip / count updates on the canvas | Inspect badge element | Code-verified | 6-dot RLXMCP badge driven by `doorAssembly` (Honesty pass 2 +/- this pass) |
| 3. Door inspector shows assembly breakdown | Open inspector → Assembly tab | Code-verified | `DoorAssemblySection` driven by `doorAssembly` |
| 3. Reload preserves assembly | Reload `/project/p1/canvas` | UI-verified | `devices[doorId].doorAssembly` still all 6 entries |
| 4. Pathway draw: click to start, click to add | Cable Cat6a + 2 canvas clicks | UI-verified | Banner shows `2 vertex… click to add… Enter or double-click to finish` |
| 4. Enter finishes | Press Enter after vertex 2 | UI-verified | Pathway committed, banner gone, tool → Select |
| 4. Double-click finishes | (regression check from prior pass) | UI-verified previously | Behavior unchanged |
| 4. Esc cancels and returns to Select | Esc after vertex 2 | UI-verified | banner gone, tool → Select, next click does NOT extend |
| 4. Right-click cancels and returns to Select | contextmenu on canvas | UI-verified | banner gone, tool → Select |
| 4. Length calculated from calibrated scale | Existing `pathwayLengthFt` helper | Code-verified | Unchanged in this pass; lengths still flow through `ftPerPxForFloor` |
| 5. Console errors / warnings | Forced render cycle | UI-verified | Zero runtime errors captured |

### Files changed (this pass)
- `src/app/screens/EngineeringCanvas.tsx`
  - `RotationRing`: new `pan` prop + pan-aware `onMove` coord math.
  - `RotationRing` call site: threads `pan={pan}`.
  - Multisensor `ConeHandles` call site: `onUpdate` now writes to all four lenses when `lensMode === 'linked'`.
  - Global `Escape` key handler: flips active tool to `select` after clearing draw state.
  - `SurfaceProps`: new `onSurfaceContextMenu` prop.
  - `CanvasSurface` SVG: `onContextMenu={onSurfaceContextMenu}`.
  - Parent `CanvasSurface` call site: wires `onSurfaceContextMenu` to `e.preventDefault()` + draw-state reset + `setTool('select')`.

`src/app/lib/compatibility.ts` did not need changes this pass.

### Remaining risks
- Pre-existing Vite Fast Refresh notice `Could not Fast Refresh ("DEFAULT_MULTISENSOR_LENSES" export is incompatible)` still appears during dev edits. Dev-only; production build clean.
- `EngineeringCanvas.tsx` is still ~11k lines. Future direct-manipulation work will benefit from extracting `RotationRing`, `ConeHandles`, and the drawing-tool banner into their own files. Out of scope this pass.
- Multisensor `linked` mode now propagates range and FOV — `focal` is also a per-lens field but is not currently exposed via a drag handle, so the propagation only fires when the user drags a tip or edge. If we later add a focal slider, it should be added to the propagation set too.
- Right-click is now consumed by the canvas SVG even when no drawing tool is armed (`e.preventDefault()` runs unconditionally inside `onSurfaceContextMenu`). This is intentional — CAD-tool feel — but if the user later wants a browser context menu over inert background, the handler can early-return when `tool === 'select' || tool === 'pan'`.

### Build result
`npm run build` → exit 0, 1.75 s. Bundle artifacts NOT staged.

### No commit / no deploy
- `git status --short` shows: `M QA_CHECKLIST.md`, `M src/app/lib/compatibility.ts` (carried diff from prior approved-but-uncommitted passes), `M src/app/screens/EngineeringCanvas.tsx`, plus the durable untracked allowlist (`.mcp.json`, `node_modules/path2d`, `node_modules/pdfjs-dist`) and the handoff `DEEPER_VISION_BUILD_STATE.md`.
- Nothing staged. Nothing committed. Nothing deployed.

---

## Canvas Ergonomics Pass (2026-05-17, after Direct Manipulation pass)

Scope: usability, visual hierarchy, and interaction clarity inside the
Engineering Canvas. No new features. No layout redesign. No dashboard
work. The pass tunes existing surfaces only.

### Verification legend
- **UI-verified** — exercised in browser via dispatched events + DOM read.
- **Code-verified** — confirmed by source diff + matching build.
- **Store-verified** — confirmed by mutating Zustand + reading state.
- **Not verified** — work landed but no proof captured this pass.

### UX issues fixed (before → after)

| # | Issue | Before | After |
|---|---|---|---|
| E1 | Unselected camera coverage dominated the plan | Soft-mode baseline `opacity = 0.75 × dim`; selected boosted 1.15× | Baseline `0.55 × dim`; selected boost dropped slightly to 1.2× and the parent's `dim` keeps sibling cones at 0.28× (so selected/sibling ratio ≈ 4.3×) |
| E2 | Single-lens cone edge stroke + DORI arcs competed with walls / doors / labels | Edge stroke 0.6 px / 0.45 opacity; DORI arcs 0.30/0.23/0.16 opacity | Edge stroke 0.5 px / 0.32 opacity; DORI arcs 0.22/0.17/0.12 opacity (math unchanged) |
| E3 | Multisensor cone fill + DORI competed in dense plans | Per-lens cone fill 0.32× when non-active; FovCone edge stroke 0.7 px / 0.42 opacity; FovCone DORI 0.25 opacity | Non-active per-lens fill 0.22×; FovCone edge stroke 0.5 px / 0.30 opacity; FovCone DORI 0.18 opacity |
| E4 | Multisensor active lens chip blended in too easily | Active chip background `${lensColor}1A`, active dot 7 px | Active chip background `${lensColor}2A`, **bottom 1.5 px lens-tinted underline**, active dot 8 px with stronger glow |
| E5 | Cone tip / FOV edge / rotation handles felt cramped, no hover affordance | Tip bg r=7 / inner r=3.5; edge bg r=6 / inner r=3; rotation handle r=6 / r=3.5; static opacity | Tip bg r=8 / inner r=3.6 (+ stroke 1.1); edge bg r=7 / inner r=3.1 (+ stroke 0.85); rotation handle r=7 / r=3.6; new `.dv-cone-handle` class with CSS `opacity 0.22 → 0.42 on hover` so the glow ring "wakes up" before you click |
| E6 | Right-click was consumed unconditionally — broke browser context menu / "Inspect element" everywhere on the canvas, even when no drawing tool was armed | `e.preventDefault()` always ran inside `onSurfaceContextMenu` | `preventDefault()` and tool reset run ONLY when `tool ∈ {wall, measure, cable, conduit, pathway}` — Select / Pan get native browser context menu back |

### Verification matrix

| Check | Marker | Result |
|---|---|---|
| `npm run build` | Code-verified | exit 0, 1.91 s |
| Open `/project/p1/canvas` after `localStorage.clear` | UI-verified | 9 seeded devices render at 1440×900 viewport |
| Coverage clean (default) mode — unselected cameras readable but subordinate | UI-verified | Sibling cone opacity ≈ 0.058 (was ≈ 0.080); selected camera cone ≈ 0.251 (was ≈ 0.328). Walls, room labels, doors all read clearly through cones |
| Selected camera handles are obvious | UI-verified | Tip / edge / rotation handles all carry `.dv-cone-handle`; hover bumps glow ring 0.22 → 0.42 via CSS; cursors `ew-resize` / `crosshair` / `grab` unchanged |
| Multisensor lens A/B/C/D clearly identified | UI-verified | Active chip carries lens-tinted background `${color}2A` + 1.5 px lens-colored underline + 8 px dot with `0 0 8px {color}AA` glow; non-active chips render at the slate-muted color |
| Door assembly chip remains readable | UI-verified | 6-dot R/L/X/M/C/P chip from prior pass unchanged; rect width 31, dots at `r=1.05` with lens-tinted fill when present |
| Pathway anchors visible + editable | UI-verified | Existing pathway polyline + hit-stroke unchanged; cursor `pointer` on hover; clicking opens PathwayDrawer (no per-vertex anchor handles added — that's a feature, not polish) |
| Right-click only prevents default during drawing tools | UI-verified | `contextmenu` dispatched in Select mode → `defaultPrevented === false`; same event in Wall mode → `defaultPrevented === true` AND tool flips back to Select |
| Runtime console errors during forced render cycle | UI-verified | Zero |

### Regression guard (all prior-pass behaviors still pass)

| Flow | Marker | Result |
|---|---|---|
| Camera rotation under pan | UI-verified | CAM-101 35° → 0° with `pan = (587, 193)` |
| Camera range tip drag | UI-verified | CAM-101 60 → 77 ft (test had to target the inner solid circle, not the bg ring) |
| Multisensor linked-mode propagation | UI-verified | Lens A tip drag 60 → 69 ft propagated to a/b/c/d together; rotations preserved |
| Esc cancel for cable | UI-verified | Active tool flips to `tool-select`; banner gone |
| Right-click cancel for active drawing tool | UI-verified | Wall cancel returns Select |
| Door drag/drop attach + persistence | Store-verified | Controller + PSU attached to fresh door (`doorAssembly = ['controller','psu']`) |
| Demo scan only lives under TopBar More with `DEMO ONLY` | Code-verified | Inline button still absent; More item still present (no churn this pass) |
| Compatibility / Telemetry remain honest preview surfaces | Code-verified | Bodies unchanged this pass; gating still on `isCam` for camera vs other kinds |

### Files changed (this pass)
- `src/app/screens/EngineeringCanvas.tsx`
  - `FOV()` (single-lens): baseline opacity reduced; selected boost 1.15 → 1.2; edge stroke 0.6 → 0.5 px, edge opacity 0.45 → 0.32; DORI arc opacity ladder 0.30/0.23/0.16 → 0.22/0.17/0.12; inner aim line opacity 0.55 → 0.40.
  - `FOV()` (multisensor): non-active per-lens cone multiplier 0.32 → 0.22; hover-paired ratios 1.15/0.25 → 1.10/0.18.
  - `FovCone()`: edge stroke 0.7 → 0.5 px / 0.42 → 0.30 opacity; DORI arcs 0.25 → 0.18 opacity.
  - `ConeHandles()`: tip/edge handle radii bumped; new `.dv-cone-handle` className; strokes slightly thicker for contrast.
  - `RotationRing()`: handle dot gets `.dv-cone-handle` className for consistent hover.
  - Top-of-canvas style block: added `.dv-cone-handle > circle:first-child` transition + `:hover` opacity rule.
  - `MultisensorLensChips`: active chip background `${color}1A` → `${color}2A`; added `inset 0 -1.5px 0 ${color}` underline; active dot 7 → 8 px with stronger glow.
  - `CanvasSurface` parent `onSurfaceContextMenu`: now early-returns when no drawing tool is active so `preventDefault()` only runs during wall / measure / cable / conduit / pathway.

`src/app/lib/compatibility.ts` not touched this pass.

### Remaining risks
- Pathway per-vertex anchor handles do NOT exist yet. The user mentioned "pathway anchors should show hover affordance" — today the whole polyline carries `cursor: pointer` on hover and opens the PathwayDrawer. Adding per-vertex dots is a feature (not polish) and was deliberately left out.
- Coverage default (`coverageOpacity: 38` in display prefs) is still the user-facing dimmer that drives `dim`. The new baseline + small selected boost are calibrated against that default; if a user pushes the slider to 100, cones will read brighter (which is the intent of that control).
- Pre-existing Vite Fast Refresh notice around `DEFAULT_MULTISENSOR_LENSES` still appears mid-edit. Dev-only.
- The `.dv-cone-handle` hover rule uses CSS `:hover` on an SVG `<g>` — modern browsers support this, but if we drop to an older legacy target, the affordance silently no-ops (cursor and fixed glow still work).
- Right-click in Select / Pan now opens the native browser context menu. The user explicitly asked for this; if "Inspect element" is undesirable in a customer-facing build, a thin wrapper can re-enable preventDefault behind a flag.

### Build result
`npm run build` → exit 0, 1.91 s. Dist not staged.

### No commit / no deploy confirmation
- `git status --short` shows: `M QA_CHECKLIST.md`, `M src/app/lib/compatibility.ts` (carried diff from prior approved-but-uncommitted passes), `M src/app/screens/EngineeringCanvas.tsx`, plus the durable untracked allowlist (`.mcp.json`, `node_modules/path2d`, `node_modules/pdfjs-dist`) and the handoff `DEEPER_VISION_BUILD_STATE.md`.
- Nothing staged. Nothing committed. Nothing deployed.

---

## Pathway Vertex Editing Pass (2026-05-17, after Canvas Ergonomics pass)

Scope: turn pathway lines from "clickable polyline that opens a drawer"
into a real engineering editing tool — drag any vertex, insert a new
vertex on any segment, delete a vertex with Backspace/Delete (gated so
the pathway always keeps ≥ 2 points). No new product features beyond
the editing capability itself. No layout redesign.

### Verification legend
- **UI-verified** — exercised in browser via dispatched events + DOM read.
- **Code-verified** — confirmed by source diff + matching build.
- **Store-verified** — confirmed by mutating Zustand + reading state.
- **Not verified** — work landed but no proof captured this pass.

### Interaction gaps closed (before → after)

| # | Gap | Before | After |
|---|---|---|---|
| V1 | No way to move an existing pathway vertex | Polyline was clickable but vertices were invisible / non-editable | Selected pathway now renders a per-vertex handle at every `points[i]`; hover glow + cursor `grab`; drag pushes the new point + recomputed `lengthFt` through `updatePathway`; persistence via Zustand persist key works on reload |
| V2 | No way to insert a vertex on a segment | Had to redraw a whole new pathway to bend a run | Hovering any segment surfaces a small `+` insert affordance at the segment midpoint; click splices a new vertex at the midpoint and makes it draggable |
| V3 | No way to delete a vertex without deleting the whole pathway | Only "delete entire pathway" via drawer existed | Hovering a vertex + pressing Backspace or Delete removes that vertex (gated to a minimum of 2 remaining points so the pathway never collapses) |
| V4 | Edits weren't reflected in length / BOM | `pathwayLengthFt` short-circuits on stored `lengthFt > 0`, so geometry changes would only update length on full redraw | Every edit path (drag, insert, delete) writes both `points` and a fresh `lengthFt = pathwayLengthFt({ points: next }, floor)` so drawer + BOM stay live |

### Verification matrix

| Check | Marker | Result |
|---|---|---|
| `npm run build` | Code-verified | exit 0, 1.74 s |
| Open `/project/p1/canvas` after `localStorage.clear` | UI-verified | 9 seeded devices + 1 seeded pathway `PW-1` render |
| Vertex handles do NOT appear when no pathway is selected | UI-verified | `[data-testid^="pathway-vertex-"]` count = 0 on idle |
| Vertex handles DO appear when pathway selected | UI-verified | Clicking PW-1 → 3 vertex handles render (matches the 3 stored points) |
| Drag a vertex updates store + length live | Store-verified | Middle vertex (360, 220) → (388.32, 241.24); `lengthFt` recomputed from previous to 11 ft mid-drag |
| Insert a new vertex via segment-`+` | Store-verified | Hovering segment 0 reveals `+`; click inserts the exact midpoint (324.16, 230.62) at index 1; points 3 → 4 |
| Delete a vertex via keyboard | Store-verified | Hovering vertex 1, pressing Delete → points 4 → 3, then 3 → 2 |
| Delete-guard at ≥ 2 points | UI-verified | Pathway at 2 points, attempted Delete → points still 2 (no-op) |
| Reload preserves edited geometry | UI-verified | After insert at midpoint + clear `localStorage` reload, store points + length exactly match the pre-reload snapshot (3 vertices, 4 ft) |
| Vertex handles do not block device selection | Code-verified | `PathwayVertexEditor` only renders when `selPathwayId != null`; handles never paint for unselected pathways |
| Right-click in Select / Pan still hits native browser context menu | UI-verified | `defaultPrevented === false` after `contextmenu` dispatched in Select mode |
| Right-click in Wall still cancels the in-flight draw and returns to Select | UI-verified | `defaultPrevented === true`, active tool flips to `tool-select` |
| Esc cancel for cable returns to Select | UI-verified | Banner gone, active tool `tool-select` |
| Camera rotation under pan (regression) | UI-verified | CAM-101 rotates from 35° → 0° at `pan ≈ (587, 193)` |
| Door drag/drop with controller + PSU (regression) | Store-verified | Fresh door's `doorAssembly === ['reader','controller','psu']` |
| Demo scan still only lives under TopBar More | UI-verified | Inline demo button absent |
| Runtime console errors during forced render cycle | UI-verified | Zero |

### Files changed (this pass)
- `src/app/screens/EngineeringCanvas.tsx`
  - `SurfaceProps`: new `selPathwayId: string | null` prop so the canvas surface knows which pathway is selected.
  - `CanvasSurface` destructure: pulls `selPathwayId`.
  - Parent `CanvasSurface` call site (line ~1979): passes `selPathwayId={selPathwayId}` (already in EngineeringCanvas state).
  - New `<PathwayVertexEditor>` mount inside the canvas SVG content group, after the device loop (line ~6047) — paints handles above pathways AND devices.
  - New `function PathwayVertexEditor({ pathwayId, svgRef, zoom, pan })` defined after `PathwaysOverlay`:
    - Reads `pathways[pathwayId]` + `floors` + `updatePathway` via Zustand selectors.
    - Drag handler installs `window` pointermove/pointerup listeners so capture survives a fast cursor leaving the handle; converts client → canvas coords via the same pan-aware formula used by `ConeHandles` / `RotationRing`.
    - Segment-insert: hovering any segment surfaces a `+` glyph at the midpoint; click splices a new vertex.
    - Vertex delete: hovered vertex + Backspace/Delete; guarded against dropping below 2 points; ignores keystrokes while focus is in INPUT / TEXTAREA.
    - Length: every mutation writes `lengthFt = pathwayLengthFt({ points: next }, floor)` so the drawer / BOM live-update.

`src/app/lib/compatibility.ts` not touched this pass.

### Remaining risks
- Native `pointerenter` doesn't bubble — React's `onPointerEnter` handlers ARE invoked but tests must use `pointerover` for synthetic verification (production user hover works normally via real mouse pointer).
- Drag handles do not "snap" to grid the way wall vertices do; this is intentional (pathways follow plenum / cable-tray routing, not floor grid). If needed later, can be gated by the existing `snap` UI toggle.
- Insert affordance currently snaps to the **segment midpoint** rather than the nearest point on the segment under the cursor. Midpoint is simpler and predictable; an "insert at nearest point" upgrade is possible but adds geometry that's easy to mis-tune.
- A pathway with only 2 points cannot be split mid-segment without first hovering the segment to see the `+`. If users complain that the segment-hover hit zone (transparent thick stroke) feels too easy to grab while panning, the stroke width can be narrowed.
- Pre-existing Vite Fast Refresh notice around `DEFAULT_MULTISENSOR_LENSES` still appears. Production build clean.

### Build result
`npm run build` → exit 0, 1.74 s. Dist not staged.

### No commit / no deploy confirmation
- `git status --short` shows: `M QA_CHECKLIST.md`, `M src/app/lib/compatibility.ts` (carried diff from prior approved-but-uncommitted passes), `M src/app/screens/EngineeringCanvas.tsx`, plus the durable untracked allowlist (`.mcp.json`, `node_modules/path2d`, `node_modules/pdfjs-dist`) and the handoff `DEEPER_VISION_BUILD_STATE.md`.
- Nothing staged. Nothing committed. Nothing deployed.

---

## Pathway Editing Polish Pass (2026-05-17, after Pathway Vertex Editing pass)

Scope: tighten the pathway vertex editor so insertion + drag feel
closer to CAD/Figma. No new product surfaces; this pass only adjusts
the existing `PathwayVertexEditor` behaviour.

### Verification legend
- **UI-verified** — exercised in browser via dispatched events + DOM read.
- **Code-verified** — confirmed by source diff + matching build.
- **Store-verified** — confirmed by mutating Zustand + reading state.
- **Not verified** — work landed but no proof captured this pass.

### Behavior before → after

| # | Before | After |
|---|---|---|
| P1 | Segment-insert `+` was pinned to the segment midpoint regardless of cursor position | `+` tracks the cursor's nearest projection onto the hovered segment; click inserts the vertex at that exact point (still clamped to the segment endpoints) |
| P2 | Vertex drag + insert never snapped, even when the TopBar Snap toggle was ON | Both vertex drag and `+` insert honor the existing `snap` toggle and round to the project-wide 20 px / 1 ft grid. Snap OFF restores free movement |
| P3 | Active vertex was barely distinguishable from idle; no coordinate readout | Active vertex gets a stronger glow (`r 6 → 8.5`, opacity `0.22 → 0.32`) + thicker outline. While dragging, a small `X · Y ft` HUD floats above the vertex showing the calibrated canvas coords |
| P4 | Insert was always at the midpoint even if cursor was hovering the segment's end | Cursor projection is clamped via the standard parametric `t = clamp(0,1)`, so the `+` never escapes the segment |

### Verification matrix

| Check | Marker | Result |
|---|---|---|
| `npm run build` | Code-verified | exit 0, 2.12 s |
| Open `/project/p1/canvas` after `localStorage.clear` | UI-verified | 9 devices + 1 pathway PW-1 render at 1440×900 |
| Select PW-1 | UI-verified | Vertex handles render (3 per the seeded polyline) |
| Hover segment 0 at ~25% along the segment, click `+` | UI-verified | `+` rendered at `transform="translate(280, 220)"`; inserted point landed at (280, 220) — close to cursor target (285, 220), snapped to grid because Snap is ON by default. Midpoint would have been (310, 220) — clearly NOT used |
| Toggle Snap OFF, drag vertex 1 a small distance | UI-verified | Vertex landed at (290.62, 226.37) — sub-grid free movement |
| Toggle Snap ON, drag vertex 1 again | UI-verified | Vertex landed at (340, 240) — both axes on the 20 px grid |
| Delete vertex while ≥ 3 points | Store-verified | Points drop by 1 each Delete |
| ≥ 2 guard holds | UI-verified | At 2 points, Delete is a no-op |
| Reload preserves edited geometry | UI-verified | Pre/post-reload snapshots match exactly (points + lengthFt) |
| Right-click in Select / Pan stays native | UI-verified | `defaultPrevented = false` |
| Right-click in Wall cancels and returns Select | UI-verified | `defaultPrevented = true`, tool → Select |
| Esc cancel for cable returns to Select | UI-verified | Banner gone, tool → Select |
| Camera rotation under pan (regression) | UI-verified | CAM-101 35° → 0° at `pan ≈ (587, 193)` |
| Door drag/drop with controller + PSU (regression) | Store-verified | Fresh door's `doorAssembly === ['reader','controller','psu']` |
| Demo scan still under TopBar More only | UI-verified | Inline button absent |
| Runtime console errors during forced render cycle | UI-verified | Zero |

### Files changed (this pass)
- `src/app/screens/EngineeringCanvas.tsx`
  - `<PathwayVertexEditor>` mount: now passes `snap={snap}` and `pxToFt={currentFloorPxToFt}` from CanvasSurface.
  - `PathwayVertexEditor` signature: added `snap: boolean` + `pxToFt: number` props.
  - Internal state: added `insertPt`, `dragIdx`, plus a `snapRef` mirror so pointermove always reads the current snap value.
  - New `applySnap(p)` helper rounds to the project's 20 px grid when `snap` is on.
  - New `projectOnSegment(p, a, b)` helper (clamped parametric projection) used for the cursor-tracking `+`.
  - `onVertexDown` move handler: passes points through `applySnap` so vertex drag respects the toggle; also flips `dragIdx` so the HUD shows up.
  - `onInsertSegment`: now uses the cursor's projected point (or the live `insertPt` from segment hover) instead of the midpoint, both passed through `applySnap`.
  - New `onSegmentMove` handler on each segment hit-zone keeps the `+` glyph tracking the cursor.
  - JSX: `+` glyph's `translate(...)` driven by `insertPt`-snapped point; active vertex paints with stronger glow + outline; while dragging, a small `[panel-bg]` rect + `<text>` reads `X · Y ft` above the vertex (calibrated via `pxToFt`).

`src/app/lib/compatibility.ts` not touched this pass.

### Remaining risks
- The `+` glyph's hit area is small (≈ 6 px). Snap-locked clicks on segments at very high zoom-out may need a follow-up to bump the glyph's grab radius. Not seen in current tests at 1440×900.
- The HUD reports raw canvas-space coords scaled by the floor's `scalePxToFt`. If a user has shifted the floor's origin (no such feature today), the readout would still be canvas-relative — not a problem for the current scope.
- `applySnap` rounds X and Y independently. For diagonal segments this snaps each axis to the nearest grid cell rather than to the nearest point on the segment. If a future "snap along segment" mode is wanted, it can layer on top.
- Pre-existing Vite Fast Refresh notice around `DEFAULT_MULTISENSOR_LENSES` still appears mid-edit. Production build clean.

### Build result
`npm run build` → exit 0, 2.12 s. Dist not staged.

### No commit / no deploy confirmation
- `git status --short` shows: `M QA_CHECKLIST.md`, `M src/app/lib/compatibility.ts` (carried diff from prior approved-but-uncommitted passes), `M src/app/screens/EngineeringCanvas.tsx`, plus the durable untracked allowlist (`.mcp.json`, `node_modules/path2d`, `node_modules/pdfjs-dist`) and the handoff `DEEPER_VISION_BUILD_STATE.md`.
- Nothing staged. Nothing committed. Nothing deployed.

---

## Floor Plan Setup UX Pass (2026-05-18, after Pathway Editing Polish pass)

Scope: make the plan-setup flow feel polished and end-to-end testable
from inside the Engineering Canvas. Add a clear entry point, an upload
modal with a real preview + name + status, in-canvas two-point scale
calibration, a verified-scale badge, and obvious cleanup controls. No
new product modules.

### Local test URL
`http://localhost:5173/project/p1/canvas`
Run with `npm run dev` from `/Users/mis/Projects/deeper-vision`.

### Verification legend
- **UI-verified** — exercised in browser via dispatched events + DOM read.
- **Code-verified** — confirmed by source diff + matching build.
- **Store-verified** — confirmed by mutating Zustand + reading state.
- **Not verified** — work landed but no proof captured this pass.

### What you can click / test

| Step | What to do | Where |
|---|---|---|
| 1 | Click **Add plan** in the TopBar (was "Scan / Build") | TopBar left |
| 2 | Pick **Upload a plan** (the first card, marked "Start here") | Add-plan dialog |
| 3 | Pick a PNG / JPG / PDF (first page) — preview appears with **Scale not verified** chip | Upload dialog |
| 4 | Edit the **Plan name** input (saves on blur) | Upload dialog |
| 5 | Click **Save & set scale →** — modal closes, the in-canvas Calibrate tool is armed | Upload dialog footer |
| 6 | Click point **A** on a known feature (e.g. a door), then click point **B** at the other end | Canvas |
| 7 | A cyan A→B line + apply panel appear — type **3** ft + click **Apply scale** | Apply panel |
| 8 | Scale bar at the bottom flips its amber **Default scale** chip + Set-scale button for a green **Verified** badge | Bottom-center |
| 9 | Pathway lengths reflow live against the new floor scale | PathwayDrawer + canvas labels |
| 10 | Top-left floor-plan controls dock now has rotate ⟲ / ⟳ / Fit quick-actions on top of the Opacity / Scale / Rotation sliders + Reset | Top-left |
| 11 | Or skip to the scale bar's **Set scale** button to re-calibrate later without re-uploading | Bottom-center |

### Verification matrix

| Check | Marker | Result |
|---|---|---|
| `npm run build` | Code-verified | exit 0, 3.52 s |
| Open `/project/p1/canvas` after `localStorage.clear` | UI-verified | 9 devices + 1 pathway render at 1440×900; **Add plan** button visible in TopBar; scale bar shows amber **Default scale** + **Set scale** button |
| TopBar **Add plan** opens the 3-option dialog (Upload / Satellite / Blank / Demo) | UI-verified | All four cards render; **Upload** has "Start here" chip |
| **Upload a plan** opens the new upload modal | UI-verified | Picker + supported-types reads "PNG, JPG, or PDF (first page) · up to ~2k px on the longest edge" |
| Synthetic PNG file → preview thumb + name input + Scale-not-verified chip | UI-verified | `import-preview-panel` mounts, `import-name-input` value = "demo-plan", `import-save-and-scale` button visible |
| **Save & set scale** closes modal AND flips active tool to `'calibrate'` | UI-verified | Modal gone, tool-status banner reads "Set scale · Click point A on a known feature (door width, parking stall, etc.)" |
| Click point A + point B paints a cyan rubber-band line | UI-verified | `data-testid="calibrate-line"` present; `calibrate-apply-panel` opens with the px count chip |
| Type 3 ft + Apply | UI-verified | `floors[fid].scalePxToFt` changed from 0.05 → 0.0314, `calibratedAt` set, toast "Scale verified", tool → Select |
| Scale bar shows green **Verified** badge | UI-verified | `[data-testid="scale-verified-badge"]` present; **Set scale** button removed |
| Plan is visible on canvas | UI-verified | Floor `background.dataUrl` rendered (screenshot confirms); FloorplanBackgroundControls panel visible top-left |
| Pathway length recomputes against the new scale | Code-verified | `pathwayLengthFt({points}, floor)` → 6 ft after calibrate (was undefined / default-scale). `pathwayLengthFt` always uses `floor.scalePxToFt`, so labels reflow on every render |
| Rotate ⟲ / ⟳ / Fit quick actions render on the floor-plan dock | UI-verified | `[data-testid="floorplan-quick-actions"]`, `floorplan-rotate-left`, `floorplan-rotate-right`, `floorplan-fit` all present |
| Esc cancels Calibrate and returns to Select | UI-verified | Inherits from prior pass — banner gone, tool flipped |
| Right-click cancels Calibrate inside drawing-tool branch | Code-verified | `onSurfaceContextMenu` `isDrawing` set now includes `'calibrate'`; `preventDefault` only fires in drawing tools |
| Runtime console errors during forced render cycle | UI-verified | Zero (after the `RotateCcw` import fix) |

### Files changed (this pass)
- `src/app/screens/EngineeringCanvas.tsx`
  - `Tool` union now includes `'calibrate'`.
  - New `calibrate` state + `setCalibrate` + `setCalibrateFt` + `resetCalibrate` callback in EngineeringCanvas.
  - New `applyCalibration(realFt)` that writes `scalePxToFt + calibratedAt + calibrationReferenceFt + calibrationMeasuredPx` via `updateFloor` and flips tool to Select.
  - `SurfaceProps` extended with `calibrate: { a, b, cursor }`; `CanvasSurface` destructures + threads it.
  - Inside CanvasSurface SVG: renders a cyan A → B line + endpoint dots + live px chip while the Calibrate tool is active.
  - `CanvasSurface.onClick` + `onMouseMove` + `onContextMenu` now recognise `'calibrate'` so the click-through and cancel paths behave like the other drawing tools.
  - Global `Escape` keydown handler resets calibrate state and flips back to Select.
  - Tool-status banner adds a `'Set scale'` row with "Click point A …" / "Click point B …" subtitles, suppressed once both A + B exist (the apply panel takes over).
  - New floating **CalibrationApplyPanel** (inline JSX, top-center) with the feet input + Apply / Cancel buttons.
  - Scale bar: green **Verified** badge when `floor.calibratedAt` is set; amber **Default scale** chip + **Set scale** button when not. **Set scale** arms `tool: 'calibrate'`.
  - TopBar button renamed "Scan / Build" → **Add plan** with `data-track="topbar-add-plan"` + an `Upload` icon. Dialog header + options copy reworded to user-friendly language; Upload is now the recommended first option.
  - `ScanBuildFloorplanDialog.onUpload` no longer detours through MapsPanel — it sets a new EngineeringCanvas-level `canvasImportOpen` true so the redesigned upload modal opens directly.
  - New EngineeringCanvas-level mount of `<ImportFloorplanDialog>` with `onStartCalibrate` wired to arm the in-canvas Calibrate tool.
  - `ImportFloorplanDialog` extended: preview thumbnail, plan-name input (saves to `background.fileName` on blur), floor name display, **Scale not verified** chip overlay, footer with **Replace file** / **Save without scale** / **Save & set scale →** buttons. The handler no longer auto-closes the modal after a file pick — the user reviews + saves.
  - `FloorplanBackgroundControls` gains a quick-actions row (rotate -90° / +90° / Fit at 100%) above the existing sliders + Reset.
  - Added `RotateCcw` to the lucide icon imports (the prior pass missed it, which crashed `FloorplanBackgroundControls` once a plan was imported).
- `QA_CHECKLIST.md` — this section.

`src/app/lib/compatibility.ts` not touched this pass.

### What works
- TopBar **Add plan** dialog with reworded, user-friendly option cards.
- Upload modal: preview + plan name + Scale-not-verified chip + Save / Replace / Save-and-scale flow.
- In-canvas Calibrate tool with banner, A→B line, live px count, Apply panel, Esc + right-click + Cancel paths, fresh scale persists to the floor record.
- Verified-scale badge swap on the scale bar (Default → Verified) + Set scale CTA when not calibrated.
- Pathway length recompute against the new scale.
- Floor-plan controls dock: rotate ⟲ / ⟳ / Fit quick-actions, plus existing Opacity / Scale / Rotation sliders + Reset.
- Calibrate flow is reachable two ways: from the Upload modal's "Save & set scale →" CTA AND from the scale bar's "Set scale" button (so users who already have a plan can re-calibrate).

### What is still mocked
- **Satellite mode** — the dialog now labels the Satellite option clearly as "Live satellite tiles are not connected yet. The base shown is a stylised preview using the address you enter." When chosen, it sets `planSource: 'satellite'` which renders the stylised SVG aerial (parking, vegetation, building roof) with the existing `SimulatedMapBadge`.
- **Inches input** — the apply panel accepts decimal feet only this pass. Inches parsing was not implemented (called out in the brief as acceptable). Helper text already says "Example: a single door is usually 3 ft."
- **/visionscan AR/LiDAR scan** — still a simulated walkthrough. The dialog labels it clearly as "Demo workflow — capture is simulated. Use Upload to bring in a real plan."
- **Multi-floor switching** — the upload modal writes to the project's first floor (`storeSelectors.firstFloorOfProject(s, projectId)`). Floor selection UI in the modal is read-only this pass; the modal explicitly notes "Multi-floor switching is one project view away — this pass writes to the active floor."

### Remaining risks
- Calibration math assumes the calibration line was drawn in canvas-space (it is). It does NOT account for the imported plan's user-applied `scale` / `rotation`. If the user later rotates or rescales the plan via the FloorplanBackgroundControls dock, they will need to recalibrate. This matches engineering convention.
- The apply panel's input is `type="number"` with `step={0.1}`. A user typing "3'6\"" will not be parsed — they need to type "3.5" instead. The helper text covers this case but it could be made more visible.
- Pre-existing Vite Fast Refresh notice around `DEFAULT_MULTISENSOR_LENSES` still fires during dev edits. Production build clean.

### Build result
`npm run build` → exit 0, 3.52 s. Dist not staged.

### No commit / no deploy confirmation
- `git status --short` shows: `M QA_CHECKLIST.md`, `M src/app/lib/compatibility.ts` (carried diff from prior approved-but-uncommitted passes), `M src/app/screens/EngineeringCanvas.tsx`, plus the durable untracked allowlist (`.mcp.json`, `node_modules/path2d`, `node_modules/pdfjs-dist`) and the handoff `DEEPER_VISION_BUILD_STATE.md`.
- Nothing staged. Nothing committed. Nothing deployed.

---

## Camera Designer UX Pass (2026-05-18, after Floor Plan Setup pass)

Scope: make selecting, configuring, and understanding a camera easier
and more professional — closer to Axis Site Designer in clarity, still
Deeper Vision in shape. No new product modules.

### Local test URL
`http://localhost:5173/project/p1/canvas`
(Run with `npm run dev` from `/Users/mis/Projects/deeper-vision`.)

### Verification legend
- **UI-verified** — exercised in browser via dispatched events + DOM read.
- **Code-verified** — confirmed by source diff + matching build.
- **Store-verified** — confirmed by mutating Zustand + reading state.
- **Not verified** — work landed but no proof captured this pass.

### What you can click / test

| Step | What to do | Where |
|---|---|---|
| 1 | Click CAM-101 — selected halo, rotation ring, range tip, FOV edge handles all visible | Canvas |
| 2 | Drag the **range tip** (ew-resize cursor); the "50 ft" → live number badge follows | Cone tip |
| 3 | Drag either **FOV edge** (crosshair cursor); the new "70° fov" badge updates live between the two edges | Cone edges |
| 4 | Drag the **rotation handle** on the outer ring; the heading badge above the device updates | Above device |
| 5 | Open Edit → **General** tab; the new **Model selection** card sits below Identity with a dropdown of 19+ camera catalog rows and a chip row showing resolution / form factor / focal range / IR / NDAA / IP rating | Inspector → General |
| 6 | Pick a different model from the dropdown; toast confirms + Identity/Product Details/Investment sections re-read from the new catalog row | Inspector → General |
| 7 | Open **Coverage** tab → see the new **Target preview · {distance} ft** card with a coloured verdict (Identify / Recognize / Observe / Detect / Below detect) + a plain-language explainer + a per-grade Pass / Fail strip | Inspector → Coverage |
| 8 | Drag the Coverage tab's **Distance** slider OR drag the canvas range tip → DORI verdict and the per-grade Pass/Fail re-read live | Inspector + canvas |
| 9 | Place / select a multisensor camera (CAM-103 seeded) → Coverage tab shows a **Lenses** card with A / B / C / D rows displaying rotation / fov / range side-by-side; click a row to set that lens active; "Linked" mode is called out at the bottom of the card | Inspector → Coverage |
| 10 | Verify "Add plan" + scale calibration from the prior pass still work end-to-end | TopBar + bottom scale bar |

### Verification matrix

| Check | Marker | Result |
|---|---|---|
| `npm run build` | Code-verified | exit 0, 2.23 s |
| Open `/project/p1/canvas` after `localStorage.clear` | UI-verified | 9 devices render at 1440×900 |
| Cone tip "{range} ft" badge present | UI-verified | "50 ft" reads next to CAM-101's tip handle |
| Cone edge "{fov}° fov" badge present (new this pass) | UI-verified | "70° fov" reads centred between the two FOV edge handles |
| **Camera model picker** present on General tab | UI-verified | `[data-testid="camera-model-picker"]` with 19 options; current value `p-axis-p1468` |
| Picking a different model updates `device.product` | Store-verified | Switched to `p-axis-p1465`; spec chips + Product Details re-render |
| **Spec chips** show resolution / type / focal / IR / NDAA / IP rating where present | UI-verified | "4MP · bullet · 2.8–8 mm · NDAA · IP66" |
| **Target preview** card on Coverage tab shows verdict + plain language | UI-verified | "At 50 ft · Observe quality · You can read activity (gait, clothing, gesture) but faces are limited." |
| **Per-grade pass/fail** strip (Identify / Recognize / Observe / Detect with IEC thresholds) | UI-verified | Identify FAIL, Recognize FAIL, Observe PASS, Detect PASS at 50 ft / 70° |
| **DORI legacy estimate** still shown (rule-of-thumb distance breakpoints) for comparison | UI-verified | Section retained, footer notes the Target preview is authoritative |
| **Multisensor Lenses summary** card on Coverage tab for CAM-103 | UI-verified | A / B / C / D rows render with `rot / fov / range` columns; clicking a row sets active lens |
| Add plan entry point still present | UI-verified | `[data-track="topbar-add-plan"]` visible |
| Scale calibration still works (regression) | UI-verified | Set scale → click A → click B → 3 ft → Apply → `scalePxToFt` updated, **Verified** badge appears |
| Runtime console errors during forced render cycle | UI-verified | Zero |

### Before / after summary

| Surface | Before | After |
|---|---|---|
| Cone edge handles | Glow rings only, no live label | Single shared `{fov}° fov` chip between the two edges, updates live during drag |
| Camera General tab | Identity + read-only product details — no way to change model from the inspector | New **Model selection** card with a dropdown of all compatible catalog rows + spec chips (resolution / camera type / focal range / IR / NDAA / IP rating); changing model rewrites `device.product`, the spec chips, Product Details, Investment, and BOM impact section all re-read |
| Coverage tab | "DORI ranges" rule-of-thumb breakpoints, no plain-language verdict | New **Target preview · {distance} ft** card with coloured verdict (Identify / Recognize / Observe / Detect / Below detect), subject px/m, plain-language sentence, and Pass/Fail strip against IEC 62676-4 / EN 50132-7 thresholds (250 / 125 / 62 / 25 px/m). Legacy DORI section retained but labelled "(legacy estimate)" |
| Coverage tab (multisensor) | Chip strip + sliders for active lens only — no compact comparison of A/B/C/D | New **Lenses** card lists all four lenses with rotation / fov / range; clicking a row sets active lens; mode line at bottom calls out Linked vs Independent semantics |
| Inspector header | Already showed kind dot + device id + mfr · model (Floor Plan Setup pass) | Unchanged this pass; reads new product after a model swap |

### Files changed (this pass)
- `src/app/screens/EngineeringCanvas.tsx`
  - `ConeHandles`: added a live `{fovDeg}° fov` chip centred between the two FOV edge handles. The existing `{rangeFt} ft` chip on the tip stays.
  - `ProductOverviewSection`: new **Model selection** section with a `<select>` dropdown of `CATALOG.filter(p => p.deviceType === d.type)` (camera-only), a spec-chip row (resolution / cameraType / focalRange / IR / NDAA / ipRating), and an `onChangeModel` callback that writes through `updateDevice(id, { product: newId })` with a confirmation toast.
  - Coverage Overview body: new **Target preview** section using the existing `pxPerM` live derivation. Verdict picks the strongest IEC grade still satisfied; plain-language string per grade. New per-grade Pass / Fail strip below.
  - Coverage Overview body: legacy "DORI ranges" section retained but renamed "DORI ranges (legacy estimate)" with footer pointing to the Target preview as the authoritative readout.
  - Coverage Overview body (multisensor): new compact **Lenses** card with one row per lens (A/B/C/D) showing rotation, fov, range. Clicking a row sets `activeLens`; mode line below confirms Linked vs Independent semantics.

`src/app/lib/compatibility.ts` not touched this pass.

### What is live vs mocked
- **Live (derived from current device state, no mocks):**
  - Cone tip range chip + cone edge fov chip
  - Target preview verdict + per-grade pass/fail (uses real `pxPerM` math from the Coverage tab's existing prosecution derivation, IEC thresholds)
  - Subject px / m number
  - Multisensor lens summary rotation / fov / range columns
  - BOM impact card on a camera — re-reads when the model changes (this was already wired against `device.product`)
  - Spec chips on the model picker — pull from the catalog row for the currently selected product
- **Mocked / honest preview (called out in QA / drawer copy):**
  - Catalog itself is a curated sample — there is no live vendor API. The Model selection footer says so: "Catalog is a curated sample — vendor APIs are not connected."
  - Telemetry sub-section on Coverage tab (overlap %, blind spot %, "Confidence 0.92") is heuristic, retained from prior passes; not yet swapped to honest preview.
  - Compatibility tab is still preview-only across all device kinds (Honesty pass 3).

### Remaining risks
- IR chip on the model picker shows "IR on" only when `device.ir === true`. The catalog's `Product` interface does not carry an `irRangeFt`; we deferred adding it this pass.
- The plain-language verdict assumes a 1080p horizontal sensor + 1.7 m subject + face width 0.18 m (EN-50132-7 defaults). Catalog `resolution` is not yet used in the px/m math — high-resolution cameras (4K, 8K) will under-report `pxPerM` until the formula is rewired. Easy follow-up.
- Selection halo + cone handle hover were already polished in earlier passes; this pass intentionally did not add another visual treatment.
- Pre-existing Vite Fast Refresh notice around `DEFAULT_MULTISENSOR_LENSES` still fires during dev edits. Production build clean.

### Build result
`npm run build` → exit 0, 2.23 s. Dist not staged.

### No commit / no deploy confirmation
- `git status --short` shows: `M QA_CHECKLIST.md`, `M src/app/lib/compatibility.ts` (carried diff from prior approved-but-uncommitted passes), `M src/app/screens/EngineeringCanvas.tsx`, plus the durable untracked allowlist (`.mcp.json`, `node_modules/path2d`, `node_modules/pdfjs-dist`) and the handoff `DEEPER_VISION_BUILD_STATE.md`.
- Nothing staged. Nothing committed. Nothing deployed.

---

## Door Assembly UX Pass (2026-05-18, after Camera Designer UX pass)

Scope: make doors feel like real access-control openings — not just
icons with attached parts. Add a Proposed / Existing flag per
hardware row, a kind-aware Engineering rule check list, a compact
Opening summary, and a split BOM impact (Proposed counted, Existing
documented). No new product modules.

### Local test URL
`http://localhost:5173/project/p1/canvas`
(Run with `npm run dev` from `/Users/mis/Projects/deeper-vision`.)

### Verification legend
- **UI-verified** — exercised in browser via dispatched events + DOM read.
- **Code-verified** — confirmed by source diff + matching build.
- **Store-verified** — confirmed by mutating Zustand + reading state.
- **Not verified** — work landed but no proof captured this pass.

### What you can click / test

| Step | What to do | Where |
|---|---|---|
| 1 | Drop a single door (from the bottom **Doors** tray) onto the canvas — click-to-arm, click again on the plan | Bottom bar → canvas |
| 2 | Drag reader / strike / REX / DPS / controller / PSU products onto the door — the existing green/red attach ring still fires, hardware lands in the door's `doorAssembly[]`, each row defaults to **Proposed** | Canvas |
| 3 | Click the door — a subtle dashed rectangle now indicates the active opening | Canvas |
| 4 | Open Edit → **Assembly** tab. New top card: **Opening summary** (type, hardware count, electrification, reader location). Below: the **Hardware assembly** grid. Each active tile now has a small **Proposed / Existing** toggle pill | Inspector → Assembly |
| 5 | Click **Existing** on the reader row → row tag switches to sky-blue "EXISTING"; persisted to `device.doorAssemblyState.reader === 'existing'` | Inspector |
| 6 | Toggle the **controller** OFF (uncheck the tile) → new **Engineering rule check** card lights up with **Reader without controller**, **Door monitor without controller**, **Electrified lock without controller** rows (severity colour-coded HIGH / MED / INFO) | Inspector |
| 7 | Toggle the **PSU** OFF → **Strike without power supply** warning appears (HIGH) | Inspector |
| 8 | Open Edit → **General** tab → scroll to **Door assembly impact** card. Each row carries a green PROPOSED or sky EXISTING tag; subtotal splits into **Proposed hardware** (counted) + **Existing hardware (excluded from total)**. The price on Existing rows is also struck-through | Inspector → General |
| 9 | Reload the page — both `doorAssembly` and `doorAssemblyState` survive Zustand persist | Browser |
| 10 | Regression: TopBar **Add plan** + **Set scale** still work; camera FOV / range / rotation / multisensor / DORI verdict / pathway vertex editing all intact | Canvas + inspectors |

### Verification matrix

| Check | Marker | Result |
|---|---|---|
| `npm run build` | Code-verified | exit 0, 2.21 s |
| Open `/project/p1/canvas` after `localStorage.clear` | UI-verified | 9 devices + DR-100 render |
| Place fresh door + drag 6 hw classes (R / S / X / D / C / P) | Store-verified | `doorAssembly = ['reader','strike','rex','dps','controller','psu']`, every entry in `doorAssemblyState` is `'proposed'` |
| Selected-door dashed-rect hint renders | UI-verified | `[data-testid="door-selected-hint-{id}"]` present after click |
| Opening summary card visible | UI-verified | "Single door · 6/11 hardware" + electrification / reader-location rows |
| Mark reader = Existing | Store-verified | `doorAssemblyState.reader === 'existing'` |
| Toggle controller + PSU OFF → engineering rule warnings | UI-verified | 4 warnings appear: HIGH Strike-no-PSU + HIGH Reader-no-controller + MED Monitor-no-controller + MED Lock-no-controller |
| Warnings card carries "Heuristic rules · not certified code compliance" banner | Code-verified | Renders above the warning list whenever `warnings.length > 0` |
| BOM impact splits proposed / existing | UI-verified | "Proposed hardware $840" + "Existing hardware (excluded from total) $285" + per-row EXISTING tag + strike-through unit price |
| Reload preserves `doorAssembly` + `doorAssemblyState` | UI-verified | All 4 remaining items + reader-existing flag intact after `location.reload()` |
| TopBar Add plan + scale calibration (regression) | UI-verified | Add plan button + Set scale button both present |
| Camera FOV badge "70° fov" + range badge "10 ft" (regression) | UI-verified | Both render on selected CAM-101 |
| Camera model picker (regression) | UI-verified | `[data-testid="camera-model-picker"]` present in General tab |
| Camera DORI verdict card (regression) | UI-verified | `[data-testid="dori-verdict"]` present in Coverage tab |
| Runtime console errors during forced render cycle | UI-verified | Zero |

### Files changed (this pass)
- `src/app/store/types.ts` — added `doorAssemblyState?: Partial<Record<DoorHardware, 'proposed' | 'existing'>>` to `Device`.
- `src/app/screens/EngineeringCanvas.tsx`
  - Drag-attach handler (both copies): new hw drops default to `'proposed'`; toast copy updated.
  - `DoorAssemblySection.toggle`: writes to `doorAssemblyState`; off-toggle deletes that key, on-toggle sets `'proposed'`.
  - New `setHwState(h, state)` helper that flips a row between Proposed / Existing without removing it from the assembly.
  - New **Opening summary** card (door type, hw count, electrification, reader location).
  - **Hardware assembly** grid: each active tile now has a segmented Proposed / Existing pill row below the checkbox, both buttons `stopPropagation` so they don't toggle the tile off.
  - New **Engineering rule check** card with heuristic banner. Rules: maglock-no-rex, maglock-no-fire-release, strike-no-psu, reader-no-controller, monitor-no-controller, electrified-lock-no-controller, intercom-plus-reader. Severity HIGH / MED / INFO colour-coded.
  - **Electrification & reader location** card gets an explainer footer (fail-safe vs fail-secure + fire-alarm release note).
  - `ImpactPreviewSection` door rollup body: per-row PROPOSED / EXISTING tag with colour + strike-through pricing on Existing rows. Subtotal splits into Proposed (counted) + Existing (excluded). New header "This door only · N proposed · M existing".
  - Selected-door visual: new dashed rounded-rect "opening hint" behind the device glyph + RLXMCP badge.

`src/app/lib/compatibility.ts` not touched this pass.

### What is live vs heuristic/mock
- **Live** (derived from current state, no fakes):
  - `doorAssembly` + `doorAssemblyState` per-row + reload persistence (Zustand persist v5).
  - Drag-attach honours the existing pan-aware host-detection + `canHost('door', ...)` + `productTypeToDoorHardware` mapping.
  - BOM impact pulls from `DOOR_HARDWARE_PRICE` in `projectStore.ts` and splits on the live `doorAssemblyState` flag.
  - All 7 engineering rule warnings derive from the actual `doorAssembly` array.
- **Heuristic** (clearly labelled):
  - Warnings card banner: "Heuristic rules · not certified code compliance" — same honesty contract as Compatibility tab.
  - `DOOR_HARDWARE_PRICE` is a sample table — not a vendor list. Inspector copy already says "Per-component preview from the active door assembly."
- **Already-honest preview** (from earlier passes):
  - Compatibility tab is still preview-only.
  - Telemetry is still preview-only.

### Remaining risks
- `doorAssemblyState` is keyed by HW class, so a door cannot carry two readers (one Existing + one Proposed). The existing dedup in drag-attach already prevented duplicates, so this is consistent with how the data model has always worked.
- Engineering rule checks are heuristic — they reflect typical low-voltage practice, not jurisdictional code. Banner says so.
- Maglock + fire release is rendered as a MED info note, not a hard requirement — the underlying fire-alarm-release wiring lives outside the door's own data (separate input) and isn't tracked yet.
- Pre-existing Vite Fast Refresh notice around `DEFAULT_MULTISENSOR_LENSES` still fires during dev edits. Production build clean.

### Build result
`npm run build` → exit 0, 2.21 s.

### Deployment
This pass DOES deploy to Vercel production. See the final report for the live URL + the source + build commit hashes.

---

## BOM / Estimate From Canvas Pass (2026-05-17, after Door Assembly UX pass)

**Goal.** Project-level BOM you can read, audit, and export from inside the
canvas — derived live from the floor plan, not a parallel form. Row click
focuses the source object so the BOM is also a navigation surface.

### What shipped this pass

- New TopBar entry **BOM & Estimate** (left cluster, next to *Add plan*).
  Opens the project BOM as a right-side drawer (460 px, blurred panel) so
  the canvas stays visible while you audit.
- New right-side drawer **ProjectBomDrawer**: header (project + line count),
  totals card, filter pills, grouped rows, CSV export.
- New helper `deriveCanvasBomRows(state, projectId)` in `projectStore.ts`.
  Returns *per-source* rows (one row per device, one row per door-assembly
  hardware item, one row per pathway, one row per IDF switch/UPS) so each
  row is selectable on the canvas — unlike `deriveBOM` which aggregates
  devices by catalog SKU for the legacy Estimator.
- New shared types `CanvasBomCategory` + `CanvasBomRow` in `store/types.ts`.

### What is honest vs heuristic

- **Live**: rows come from `state.devices` / `state.doors` /
  `state.pathways` / `state.idfs` via the new helper. Pathway length uses
  the per-floor calibrated `scalePxToFt` via `pathwayLengthFt` so the BOM,
  canvas labels, and PathwayDrawer all agree. Per-row `Proposed / Existing`
  reads from `device.doorAssemblyState[hw]` (the flag the prior pass added).
- **Heuristic**: pricing uses `UNIT_PRICE` / `DOOR_HARDWARE_PRICE` /
  `CABLE_UNIT_PRICE` sample tables — same source as the legacy Estimator.
  The totals card says explicitly: *"Pricing is preview-grade. Calibrate
  against pricebook before quote."* Rows missing a price get a "No price"
  pill and the count shows in an amber warning under the totals card.
- CSV export is REAL: builds a UTF-8 CSV with BOM (so Excel renders
  currency cleanly), RFC-4180-quoted fields, and triggers a real download
  via `URL.createObjectURL` + `<a download>`. Verified end-to-end: a
  2,332-byte CSV with the project-name-safe filename
  `Acme_HQ_Austin-bom.csv` was produced from the seeded project.

### What the user can verify in the browser

- TopBar shows **BOM & Estimate** with `BarChart3` icon. Click → drawer
  slides in from the right.
- Totals card shows: Proposed material, Cable, Labor (hr + $), Existing
  documented (struck-through), Sell total with markup %. The seeded
  `/project/p1/canvas` reads `$23,031 / $16 / 30.8 hr · $2,921 / $285
  struck / $30,642 @ 18%`.
- Filter pills `All / Cameras / Access / Network / Cabling / Existing`
  each show a live count and disable when empty. Counts on seed:
  `25 / 5 / 16 / 3 / 1 / 1`.
- Rows are grouped under category headers (`CAMERAS · 5`, `ACCESS
  CONTROL · 16`, `NETWORK & POWER · 3`, `CABLE & PATHWAYS · 1`). Each
  group header shows its proposed subtotal and (if any) its existing
  subtotal struck through next to it.
- Each row shows: small meta line (e.g. `Bullet · CAM-101`, `Opening ·
  DR-100`, `Run · PW-1`), bold description, product line if known
  (`Axis · P1468-LE`), labor hours, and right-aligned qty + unit price +
  line total.
- Door rows carry a **Proposed** (emerald) or **Existing** (amber) pill.
  Existing rows render at lower opacity with line-through qty/unit/total
  so the user can see they exist but don't count toward the proposed
  total.
- Row click: device or door row sets `selId` and slides the EditDrawer
  in (BOM drawer closes); pathway row sets `selPathwayId` and slides the
  PathwayDrawer in. Verified with CAM-101 → EditDrawer headline, PW-1 →
  PathwayDrawer with `CAT6A · 10 ft · CAM-101 → IDF-1`.
- **CSV** button in the drawer header: produces the per-row CSV plus a
  trailing TOTALS block (devices on plan, proposed material, existing
  documented, cable, labor hours, labor cost, markup, sell total). Shows
  a toast on success.
- Opening BOM clears any active EditDrawer / PathwayDrawer selection so
  the right-side slot is exclusively the BOM until the user picks a row.

### Regression checks

- TopBar **Add plan** still opens the source picker (Upload / Satellite /
  Blank / VisionScan-style options) — verified.
- Camera select + EditDrawer headline still appears for `CAM-101` after a
  BOM row click — verified.
- PathwayDrawer still mounts on a pathway row click with correct cable
  type + termination metadata — verified.
- `npm run build` clean, 2.08 s. New bundle hash captured in the deploy
  commit below.

### Remaining risks

- `deriveCanvasBomRows` and `deriveBOM` now both live in the store and
  cover overlapping ground. The legacy Estimator view still uses
  `deriveBOM` (group-by-SKU). They agree on totals when prices and
  catalog data are identical, but a future pass could collapse them.
- Pricing is preview-grade until the integrator wires their own
  pricebook. The warning under the totals card states this explicitly.
- Pathway labor uses `0.02 hr/ft × cableCount` as a flat estimate — fine
  for a sanity check, not a quote. Same source as the legacy Estimator.
- IDF and labor rows currently have no canvas glyph to focus on; row
  click for those raises an informational toast rather than navigating.
- Pre-existing Vite Fast Refresh notice around `DEFAULT_MULTISENSOR_LENSES`
  still fires during dev edits. Production build clean.

### Build result

`npm run build` → exit 0, 2.08 s, new bundle hash captured below.

### Deployment

This pass DOES deploy to Vercel production. See the final report for the
live URL + the source + build commit hashes.

---

## Presentation / Review Mode Pass (2026-05-17, after BOM / Estimate pass)

**Goal.** Customer / reviewer / district-stakeholder-facing presentation of
a project. Read-only. No engineering tools, no edit drawers, no internal
cost by default. New route `/project/:projectId/review`.

### What shipped this pass

- New route `/project/:projectId/review` → `screens/ReviewMode.tsx`.
- New "Present" entry button on the Engineering Canvas TopBar (emerald
  pill, `Presentation` icon, sits to the right of *BOM & Estimate*).
- Three-column layout: 240 px layer rail · canvas · 340 px review panel.
- Read-only SVG canvas. Renders floor-plan image background, walls,
  pathway lines, device glyphs (via the shared `SurveyorSymbolBody` from
  `components/canvas/SurveyorSymbols.tsx`), and optional camera FOV cones
  using the same `PX_PER_FT` math as the engineering canvas.
- Pan/zoom: wheel = zoom (cursor-centred), shift-drag or right-drag = pan,
  middle-button = pan. Auto-fits content on floor change.
- Layer toggles with live counts: Cameras, Doors, Access, Network,
  Pathways, Coverage (FOV cones), Notes (sensors / alarm points).
- BOM summary card (toggled off by default). High-level qty per category;
  cost gated behind an explicit *Show cost* button so a reviewer who
  hasn't been briefed on dollars doesn't see them by accident. Uses the
  `deriveCanvasBomRows` helper added in the previous pass.
- Click any device or pathway → read-only detail card in the right
  panel.
  - Camera: model (manufacturer · model), coverage (`fov° × range ft`
    for single-lens, omnidirectional for fisheye), mount height, IR /
    NDAA flags, location in calibrated feet.
  - Door: opening type, proposed-hardware list with Proposed / Existing
    pill per item, electrification, reader location.
  - Pathway: cable type, length (uses calibrated `pathwayLengthFt`),
    conductor count, conduit size, bundle id if any.
- Review panel:
  - Project name + status pill (Draft / Ready / Approved) with quick
    inline toggle.
  - 2 seed comments + reviewer-name input + comment composer + Send
    button (⌘/Ctrl+Enter shortcut).
  - **Approve** / **Request changes** buttons that flip the status pill.
  - Explicit *"Preview only · session-scoped"* badge + footer disclaimer
    so users know status + comments don't sync to a backend yet.
- **Copy review link** button: real `navigator.clipboard.writeText` of
  the current URL + success toast. Verified end-to-end.
- **Open in Engineering** button returns to `/project/:id/canvas` for
  the original designer.

### What is honest vs preview-only

- **Honest, real**:
  - All canvas data is read from the same Zustand store the engineering
    canvas writes to. Edits made on the canvas appear here on next load
    with no extra export step.
  - Layer counts, BOM rollup, pathway lengths, door hardware lists are
    derived live; nothing is hardcoded.
  - Copy review link writes the real URL to the system clipboard.
- **Preview-only, labelled in UI**:
  - Comments + reviewer-name input are session-scoped. Each added
    comment carries a "SESSION ONLY · NOT PERSISTED" tag.
  - Status (Draft / Ready / Approved) is session-only; toast on every
    flip says "Status is session-scoped until approval workflow is wired".
  - Two seed comments are intentionally there so the panel reads as a
    realistic UI rather than empty chrome; they're clearly attributed
    and remain seeded across reloads.

### What the reviewer can verify in the browser

1. Open `/project/p1/canvas` → click **Present** in the TopBar (emerald
   button next to *BOM & Estimate*).
2. Land on `/project/p1/review`. Header reads "Deeper Vision · Review"
   + project name + status pill.
3. Toggle layers in the left rail — counts and visible glyphs update.
4. Toggle Coverage — camera FOV cones appear in pink/red over the canvas.
5. Toggle BOM summary — a card opens top-right showing qty per category.
   Click *Show cost* to reveal the project sell total; click again to
   hide.
6. Click any camera glyph → right panel shows model, coverage, mount
   height, location.
7. Click a door (e.g. DR-100) → right panel shows the proposed-hardware
   list with Proposed / Existing pills.
8. Click a pathway line → right panel shows cable type, length, bundle.
9. Type a comment → click Send → comment appears with the
   "SESSION ONLY · NOT PERSISTED" badge + toast.
10. Click **Approve** → status pill flips to Approved (emerald) + toast
    notes the preview-only status.
11. Click **Copy review link** → toast shows the URL was copied.
12. Click **Open in Engineering** → returns to `/canvas`; all engineering
    workflows still work.

### Regression checks (Engineering Canvas)

- TopBar **Add plan**, **BOM & Estimate**, and **Present** all visible
  and clickable — verified.
- BOM drawer still opens with the same 25-line / $30,642 / 18%-markup
  numbers as the previous pass — verified.
- Drawing tool rail still mounts — verified.
- Camera / door click + EditDrawer still works — verified prior pass.

### Remaining risks

- Comments + status are intentionally session-only. Real persistence
  needs a backend (or a new persisted slice in the Zustand store with a
  version bump). The UI is clearly labelled.
- The review canvas uses its own pan/zoom — independent of the canvas
  state. That's intentional (reviewer's framing shouldn't move the
  engineer's view), but means zoom and pan don't carry across routes.
- Coverage cone rendering reuses the single-lens / fisheye / multisensor
  math from the engineering canvas but is intentionally calmer (single
  opacity tier, no overlap/blind-spot HUD). For a closer engineering
  audit, the engineer should use `/canvas`.
- The BOM summary card hides cost by default to protect the reviewer
  conversation; the warning under "Show cost" remains preview-grade as
  in the BOM pass.

### Build result

`npm run build` → exit 0, 2.35 s. New bundle hash captured in the
deploy commit below.

### Deployment

This pass DOES deploy to Vercel production. See the final report for the
live URL + the source + build commit hashes.

---

## Field Deployment / Work Orders Pass (2026-05-17, after Presentation / Review pass)

**Goal.** Turn approved/proposed canvas objects into field work orders a
technician / project manager can execute. New route
`/project/:projectId/deployment`. Status + checklist + serial/MAC +
photo placeholders + blockers all persist across reloads via a new
`workOrderProgress` slice on the Zustand store (persist version bumped
v5 → v6).

### What shipped this pass

- New TopBar entry **Deploy** on the Engineering Canvas (amber pill,
  `HardHat` icon, sits to the right of *Present*). Sits next to BOM /
  Present, doesn't replace them.
- New route `/project/:projectId/deployment` → `screens/DeploymentMode
  .tsx`.
- New helper `deriveWorkOrders(state, projectId)` in `projectStore.ts`.
  Emits one work order per camera, per door opening with an assembly
  (legacy `state.doors` records included with de-dup), per pathway run,
  and per IDF rack. Title, subtitle, location, default role, priority,
  estimated labor (rolled up from `UNIT_PRICE` / `DOOR_HARDWARE_PRICE`
  / pathway labor formula), and checklist are derived live from canvas
  state. Mutable progress (status, completed-ids, photo placeholders,
  serial/MAC, blocker, field notes) is merged in from the new
  `workOrderProgress` slice.
- New types in `store/types.ts`: `WorkOrder`, `WorkOrderStatus`,
  `WorkOrderKind`, `WorkOrderChecklistItem`, `WorkOrderPhotoPlaceholder`,
  `WorkOrderProgress`.
- New store actions: `patchWorkOrderProgress`,
  `toggleWorkOrderChecklist`, `setWorkOrderStatus`,
  `addWorkOrderPhotoPlaceholder`, `removeWorkOrderPhotoPlaceholder`.
- v5 → v6 persist migration: ensures the empty `workOrderProgress`
  slice exists on existing users' state.

### Layout

Three-pane: 400 px left WO list with search + status + type filters,
center detail panel with header + status timeline + assigned tech +
serial/MAC + source summary + mini floor preview + field notes + photos,
400 px right checklist panel.

### Honest vs preview-only

- **Honest, real**:
  - Work order list is derived live from canvas. Add a camera on
    `/canvas`, jump to `/deployment` — a new WO appears.
  - Status (Ready / Assigned / On site / Installing / Testing /
    Complete / Blocked), per-checklist-item completion, serial #, MAC,
    blocker text, and field notes all persist in `workOrderProgress` via
    Zustand + localStorage. Verified end-to-end with a hard reload:
    status, checklist, serial, MAC, photo metadata all survived.
  - Each work order's labor estimate, location ("Building A · Ground
    floor"), and source summary reflect the canvas state.
  - Mini floor preview reuses the calibrated background + walls + glyph
    rendering; the highlighted source object pulses with an SVG animation
    so the tech can see WHERE on the plan.
  - Door work orders honor `doorAssemblyState`: Proposed / Existing
    pills carry through; the title summary reads "3 proposed hardware
    items · 1 existing".
- **Preview-only, clearly labelled**:
  - Photo upload is metadata only. Each photo card carries a
    "PREVIEW · METADATA ONLY" badge and a "Real upload lands when blob
    storage is wired" footnote. Filename + tag + addedAt are persisted.
  - Tech assignment is a mock roster ("Sam Ortiz · Cam crew", etc.) —
    real dispatch lands with backend work. Note under the selector
    states this.
  - Footer disclaimer: "Status + checklist progress persist across
    reloads. Photo upload is preview-only."

### Work order kinds + their checklists

- **Camera** (8 items): Mount, Pull cable, Terminate RJ45, Label,
  Aim, Verify DORI, Upload install photo, Record MAC + serial.
- **Door** (variable, 4–10 items): Verify opening, then conditional
  rows per assembly (Install reader if reader present, Install lock if
  strike/maglock, Install DPS if dps/contact, Install REX if rex, Mount
  controller/PSU if controller/psu), then Wire-back, Test egress,
  Commission cycle 10×, Upload photos.
- **Pathway** (7 items): Stage, Pull (respect bend radius), Support
  every 4–5 ft, Label both ends, Terminate, Certify, Upload photo.
- **IDF** (7 items): Mount, Bond ground, Land power + UPS, Patch,
  Verify network, Label, Upload finished-rack photo.

### What the user can verify in the browser

1. `/project/p1/canvas` → click **Deploy** in the TopBar (amber, right
   of *Present*).
2. Lands on `/project/p1/deployment`. Header shows project name + 0%
   install progress + 0 complete / 9 open pills.
3. Left rail has 9 WOs visible (5 cameras, 1 door, 1 idf, 2 pathways
   — varies with seed). Each row shows id, title, subtitle, status pill,
   progress bar, hr estimate, and priority.
4. Click any camera WO — detail shows model (Axis · P1468-LE), coverage
   (70° × 50 ft), Status timeline, Mark-complete / Flag-blocker
   actions, Assigned tech selector, Serial / MAC inputs, Source · camera
   summary, Location on plan (pulsing orange ring around the source),
   Field notes, Install photos.
5. Click a status step → status pill flips. Click checklist items in
   right panel → progress bar in the WO row updates.
6. Filter to **Door** → 1 row. Click DOOR-101 → checklist shows 9
   items conditional on the assembly hardware. Proposed/Existing pills
   reflect canvas state.
7. Filter to **Blocked** + click *Flag blocker* on the open detail →
   row appears in Blocked filter. Type blocker text → persists on
   blur. Clear blocker → row leaves Blocked.
8. Type a photo filename + pick a tag (before / after / wiring /
   label / other) + click ＋ → row appears with tag + size estimate +
   "Preview · metadata only" badge.
9. Set Serial # + MAC → persists.
10. **Hard reload** → all status, checklist, serial, MAC, photo
    metadata, and blocker text survives.
11. Click **Open in Engineering** → returns to `/canvas`; all engineering
    workflows still work.

### Regression checks (Engineering Canvas + Review)

- TopBar **Add plan**, **BOM & Estimate**, **Present**, **Deploy** all
  visible and clickable — verified.
- Drawing tool rail still mounts — verified.
- BOM drawer still opens — verified (prior pass numbers unchanged).
- ReviewMode `Open in Engineering` still navigates back — fixed a
  shared product-model display typo (`product.mfr` → `product.manufacturer`)
  in both Deployment and Review screens so the catalog manufacturer
  string actually renders. No other Review changes.

### Build result

`npm run build` → exit 0, 1.94 s. New bundle hash captured in the
deploy commit below.

### Persistence migration

`deeperVisionStore` bumped from v5 → v6. Migration adds an empty
`workOrderProgress: {}` slice if missing. Existing users keep all
their canvas state untouched; they just gain a `workOrderProgress`
record per work order as they touch them.

### Deployment

This pass DOES deploy to Vercel production. See the final report for the
live URL + the source + build commit hashes.

---

## Shared Project State / Demo Sync Pass (2026-05-17, after Field Deployment pass)

**Goal.** Make local-vs-live state divergence operational. Add a
"Project state" menu in the Engineering Canvas that exports the
current project to a downloadable JSON, imports a previously
exported file, resets to the seeded demo, or clears local
localStorage.

### What shipped this pass

- New popover `<ProjectStateMenu projectId={pid}/>` in
  `components/canvas/ProjectStateMenu.tsx`. Mounts in the Engineering
  Canvas TopBar (right of *Deploy*, left of *Snap*). Compact
  `Database` icon + label + chevron.
- New helper `exportProjectState(state, projectId, opts)` in
  `projectStore.ts`. Pure over a snapshot — safe to call inside
  render. Returns a `ProjectStateEnvelope` carrying the project +
  customer + sites + buildings + floors + devices + doors + pathways
  + IDFs + estimates + per-project surveyItems + per-project work-
  order progress + per-project UI prefs (canvasLayers, canvasDisplay,
  projectMode, projectTechModel). Captures a build label so the
  import confirmation can warn on version drift.
- New store action `importProjectState(env)` that replaces ONLY this
  project's slice. Other projects in the same browser are preserved.
  Validates kind + version; throws on mismatch.
- New `ProjectStateEnvelope` + summary type in `store/types.ts`.

### Layout

The TopBar gains: **Project state ▾** (compact, right of Deploy).
Click → 320 px popover with two sections:
- **Move state**: Export project JSON · Import project JSON.
- **Reset**: Reset to shared demo (amber) · Clear local project state
  (red).

Footer disclaimer (always visible):
> This prototype stores project state in this browser.
> Export / import lets you move a demo state between local and live.
> Cloud sync will replace this later.

Import + reset + clear actions each open a confirmation modal that
spells out the consequences (envelope summary for import, what gets
dropped for reset/clear).

### Honest vs preview / local-only

- **Real, live**:
  - Export downloads a real `.json` file via `URL.createObjectURL` +
    `<a download>`. Filename pattern
    `deeper-vision-${projectId}-${YYYY-MM-DD}.json`.
  - Import reads the picked file via `File.text()`, parses JSON,
    validates the envelope, shows a confirmation modal with the
    summary, then merges into the store. Reload not required — the
    store updates trigger React re-render so the canvas reflects
    immediately.
  - Reset to shared demo calls the existing `resetDemoData` action
    + clears `workOrderProgress`, then navigates to
    `/project/p1/canvas` so the user lands on a known-good state.
  - Clear local removes the `deeperVisionStore` key from
    localStorage and reloads. Next boot runs the seed clean.
  - End-to-end verified: marker note `EXPORT-MARKER:...` set on
    CAM-101, exported (envelope contains it at
    `env.data.devices[CAM-101].notes`), reset clears it, import
    restores it. /review and /deployment both reflect the imported
    state without an additional reload step.
- **Local-only, labelled in UI**:
  - Footer paragraph + import-confirmation modal each state that
    this prototype is browser-local and that cloud sync replaces
    this later.
  - Import warns visually when the envelope's build label doesn't
    match this page's build (amber chip).

### Envelope format

```
{
  "kind": "deeper-vision-project-state",
  "version": 1,
  "exportedAt": <ms>,
  "buildLabel": "v0.0.1 · <sha> · ...",
  "projectId": "p1",
  "summary": { projectName, deviceCount, pathwayCount, doorCount, idfCount, floorCount, workOrderProgressCount },
  "data": {
    project, customer?,
    sites[], buildings[], floors[],
    devices[], doors[], pathways[], idfs[],
    estimates[],
    surveyItems[], workOrderProgress[],
    canvasLayers?, canvasDisplay?, projectMode?, projectTechModel?
  }
}
```

`version` is the envelope's own schema; bump for breaking changes. It is
distinct from the store's persist version (currently 6).

### What the user can verify in the browser

1. `/project/p1/canvas` → TopBar shows **Project state** button (right
   of *Deploy*).
2. Click → popover opens with **Move state** (Export / Import) and
   **Reset** (Reset to shared demo / Clear local project state)
   sections plus the 3-line disclaimer.
3. Make a change on the canvas (add a device, edit a door's
   electrification, etc.).
4. **Export project JSON** → toast confirms; a
   `deeper-vision-p1-YYYY-MM-DD.json` file downloads. The envelope
   contains the change.
5. **Reset to shared demo** → confirmation modal, click Reset; the
   change disappears; canvas returns to seeded demo state; URL
   resets to `/project/p1/canvas`.
6. **Import project JSON** → file picker, pick the file from step 4;
   confirmation modal shows project name + counts + exported
   timestamp; click *Replace local state*; change returns to the
   canvas immediately.
7. Navigate to `/review` and `/deployment` — imported state reflects
   there too (verified via marker note round-trip).
8. **Clear local project state** → confirmation modal, click Clear;
   page reloads to a fresh seeded canvas; localStorage no longer
   carries `deeperVisionStore`.

### Regression checks

- TopBar **Add plan**, **BOM & Estimate**, **Present**, **Deploy**,
  **Project state** all visible — verified.
- Drawing tool rail still mounts — verified.
- Verified end-to-end on /canvas, /review, /deployment.
- No React/runtime console errors (only the standing Vite HMR
  websocket cosmetic warnings).

### Remaining risks / future cloud sync

- All four actions are browser-local. A shared canonical demo state
  for the whole team requires a backend or a "canonical snapshot
  bundled with the build" mechanism. This pass deliberately ships
  the local primitives that a future cloud sync will reuse.
- Import is replace-style (overwrite this project's slice). A future
  merge mode could keep both states under different project ids.
- Envelope `version` is 1 today. When the persisted store schema
  bumps (the v5 → v6 type), import-time migrations would land
  alongside this version field.

### Build result

`npm run build` → exit 0, 2.54 s. New bundle hash captured in the
deploy commit below.

### Deployment

This pass DOES deploy to Vercel production. See the final report for
the live URL + the source + build commit hashes.

---

## Pricebook Calibration Pass (2026-05-18, after Shared Project State pass)

**Goal.** Per-project editable pricing for BOM/Estimate. Default
`UNIT_PRICE` / `DOOR_HARDWARE_PRICE` / `CABLE_UNIT_PRICE` /
estimate.laborRate + markup remain as fallbacks; user overrides take
precedence per project.

### What shipped this pass

- New `<PricebookEditor>` modal in
  `components/canvas/PricebookEditor.tsx`. 720 px modal opens from a
  new **Pricebook** button in the BOM drawer header (left of CSV).
- New store slice `projectPricebooks: Record<projectId, ProjectPricebook>`.
- Persist version v6 → v7. Migration adds the empty slice.
- New types in `store/types.ts`: `ProjectPricebook`,
  `DoorHardwarePricebookEntry`. `CanvasBomRow` gains optional
  `overridden?: boolean`.
- New store actions: `setPricebookDoorHardware`,
  `setPricebookCablePerFt`, `setPricebookLaborRate`,
  `setPricebookMarkup`, `resetPricebook`.
- `deriveCanvasBomRows` checks pricebook overrides first (per door
  hardware, per cable type, project labor rate, project markup), with
  fall-through to the existing defaults. Each row carries `overridden`
  so the BOM drawer can badge it.
- Pricebook overrides also apply to standalone access-control devices
  (`acc.reader`, `acc.strike`, `acc.maglock`, `acc.rex`, `acc.exit`,
  `acc.biometric`, `acc.controller`, `acc.psu`, `acc.dps`,
  `aud.intercom`) — so a "reader = $500" override affects loose
  reader devices on the canvas too, not just door-asm rows.
- `deriveWorkOrders` uses the same hardware-labor override so BOM
  and work-order estimates stay aligned for the same opening.
- `CABLE_UNIT_PRICE` is now `export const` so the editor can read
  defaults.
- BOM drawer:
  - **Pricebook** button (cyan when overrides present) with the
    override count as a chip suffix.
  - Honesty text flips: "Preview pricing. Open pricebook to
    calibrate." when no overrides; "Project pricebook overrides
    active · N overrides · not connected to ERP yet." when overrides
    present.
  - Per-row **Overridden** badge (primary tone) when the row's price
    or labor came from a pricebook override.
  - Small secondary "N rows using pricebook overrides" line under
    the totals card.
- Project state export envelope now includes `data.pricebook`.
  `importProjectState` applies it (and clears any local pricebook
  for the project when the envelope lacks one).

### Layout

Editor sections:
- **Markup + labor** — labor rate ($/hr) + project markup (%).
- **Door hardware** — one row per `DoorHardware` (reader, strike,
  maglock, rex, dps, contact, intercom, panic, autoop, controller,
  psu) with separate price + labor inputs. Per-row reset.
- **Cable per ft** — one row per `CableType` (cat6, cat6a, fiber-sm,
  fiber-mm, coax, power, composite).

Each row: label / default / override input / effective / per-row
reset. Header gets a **Reset all** button (with confirm) when any
override is present. Footer disclaimer: "Pricebook overrides are
stored in this browser for this project. They feed the BOM drawer,
CSV export, and field-deployment labor estimates immediately. Not
connected to ERP / accounting / pricebook vendor sync yet."

### What the user can verify in the browser

1. `/project/p1/canvas` → open **BOM & Estimate**. Header now has a
   **Pricebook** button left of CSV.
2. Click → modal opens. With no overrides set, the BOM totals card
   reads "Preview pricing. Open pricebook to calibrate."
3. Change **Labor rate** to 120. Effective column flips to 120;
   reset button activates. BOM "Labor" total recomputes.
4. Change **Project markup** to 25. Sell total recomputes
   immediately under the modal. The "% MARKUP" label changes.
5. Change door **Reader** price to 500. BOM rows for every reader
   on the project (door-assembly hardware AND standalone `RD-1`
   device) update to $500 each and get an **Overridden** pill.
6. Change cable **CAT6A** to 1.25. The PW-1 cable row's `@ $1.25/ft`
   updates and the row gets an **Overridden** pill.
7. Header **Pricebook** button now reads `Pricebook · 4` and the
   honesty card flips to "Project pricebook overrides active · 4
   overrides · not connected to ERP yet." in cyan.
8. **Reload** the page. Open BOM → totals and overrides persist.
9. Open **Project state** → Export project JSON → the envelope's
   `data.pricebook` carries the 4 overrides.
10. **Reset to shared demo** clears the pricebook (sell total
    returns to default).
11. **Import** the previously exported JSON → overrides return.
12. Open the BOM CSV export → reader rows show `500.00`, cable row
    shows `1.25`, totals reflect 25% markup.

### Regression checks

- BOM filter pills + row click + CSV export all unchanged in
  shape — verified.
- Project state export/import still works for the rest of the
  envelope; pricebook is purely additive.
- Engineering canvas / Review / Deployment routes still mount and
  render correctly; deployment WO labor reflects the overrides for
  hardware classes that the user changed.
- No new React warnings or runtime errors in console (only the
  standing Vite HMR websocket cosmetic noise).

### What is live vs not-connected-to-ERP

- **Live, real**:
  - Overrides apply immediately on edit; BOM rows + totals +
    work-order labor + CSV export all reflect them.
  - Persistence via Zustand + localStorage (v7 migration).
  - Project state JSON envelope round-trips overrides.
- **Not connected**:
  - No ERP / accounting / vendor pricebook sync.
  - No catalog-product-level overrides yet (only door-hardware
    classes, cable types, labor rate, markup) — explicitly within
    the brief's "if a full model is too big, start with…" scope.

### Build result

`npm run build` → exit 0, 2.13 s. New bundle hash captured in the
deploy commit below.

### Deployment

This pass DOES deploy to Vercel production. See the final report for
the live URL + the source + build commit hashes.

---

## Reports / Proposal Package Pass (2026-05-18, after Pricebook Calibration)

**Goal.** Generate a polished, printable proposal package from live
canvas data. New route `/project/:projectId/reports`. Two visibility
modes — Internal (full BOM + pricing assumptions) and Customer-safe
(hides cost detail).

### What shipped this pass

- New `<ReportsCenter>` screen at
  `src/app/screens/ReportsCenter.tsx` (~900 LOC).
- New route `/project/:projectId/reports` in `App.tsx`.
- New TopBar entry button **Reports** (sky-blue, `FileText` icon) in
  the Engineering Canvas TopBar, right of *Deploy*.
- New Review Mode top-bar entry **Reports** (sky-blue, between *Copy
  review link* and *Open in Engineering*).
- 13 report sections, all derived live from the Zustand store:
  - Cover header (project, customer, ref id, generated date, mode
    badge)
  - Executive summary (6 metric tiles + 2 financial tiles in
    internal view)
  - Site & floors schedule
  - Plan preview (one per floor) — schematic SVG generated from
    canvas data: walls + devices via `SurveyorSymbolBody` + pathway
    polylines. Labelled "schematic generated from canvas data".
  - Camera schedule (ID / type / model / floor / coverage / mount / IR)
  - Door hardware schedule (one card per opening with class +
    description + Proposed / Existing pill)
  - Cabling & pathway schedule (run / cable / conductors / length /
    kind / conduit / bundle)
  - BOM & estimate summary (internal-only): proposed material, cable,
    labor, existing documented; sell total card with pricebook-override
    state; category breakdown
  - Field deployment summary: install-progress bar + per-kind table
    (Cameras / Doors / Pathways / IDF) with complete/blocked/open/hours
    remaining
  - Pricing assumptions (internal-only, when pricebook overrides
    exist): labor rate override, markup override, door-hardware
    override table, cable per-ft override table
  - Open warnings & issues: heuristic checks (missing prices,
    uncalibrated floors, maglock-without-REX, strike-without-controller,
    strike-without-PSU, no cameras). Customer view shows only HIGH
    severity items.
  - Assumptions & exclusions (Included / Excluded standard scope
    lists)
  - Attachments placeholder (labelled preview-only)
  - Footer: project ref + build label + signature lines (internal
    only)
- CSV export buttons per schedule (cameras, doors, pathways, BOM).
  Real downloads, RFC-4180 quoting.
- **Print / Save PDF** button → invokes `window.print()`. Page is
  itself the document; print stylesheet (inline `@media print`) hides
  the top control bar, button chrome, and CSV buttons, fits content
  to letter @ 18mm × 14mm margins, page-break-inside avoid on each
  section.

### Honest vs not-yet-connected

- **Live, real**:
  - Every section pulls from the same Zustand store the canvas
    writes to. Add a camera on /canvas → next /reports load shows
    it in the camera schedule.
  - Plan preview SVGs render the calibrated background + walls +
    pathway polylines + device glyphs (shared `SurveyorSymbolBody`).
  - BOM summary reflects pricebook overrides (sell total + per-row
    badges + missing-price warnings) via the existing
    `deriveCanvasBomRows` helper.
  - Deployment summary reflects persisted `workOrderProgress` via
    `deriveWorkOrders`.
  - All four CSV exports produce real downloads.
  - Print to PDF works via `window.print()`; the user picks "Save as
    PDF" in the browser print dialog.
- **Preview / labelled**:
  - Plan preview is a clean schematic, not a screenshot. Top of each
    plan preview reads "Schematic generated from canvas data".
  - Pricing assumptions footer: "Not connected to ERP / accounting /
    vendor pricebook sync yet."
  - Attachments slot is a placeholder; copy reads "File upload +
    storage lands with the cloud sync pass."
  - Customer view shows a "Cost detail is hidden in customer view"
    notice in the executive summary.

### What the user can verify in the browser

1. Open `/project/p1/canvas` → TopBar gains a sky-blue **Reports**
   button (between *Deploy* and *Project state*).
2. Click → navigates to `/project/p1/reports`. Header shows project
   name, generated date, project ref, **Internal view** badge.
3. Executive summary shows tiles for cameras / doors / pathways /
   access devices / IDF racks / floors (counts derived live).
   Internal view adds Sell total (with pricebook-override note) +
   Field deployment progress tiles.
4. Site & floors table lists every floor with calibration chip.
5. Per-floor "Plan preview" SVG renders the schematic.
6. Camera schedule table (5 rows in seed) + CSV export.
7. Door hardware schedule: cards for DR-100 / DOOR-101 with
   Proposed / Existing pills per hardware row + CSV export.
8. Cabling & pathway schedule + CSV export.
9. BOM & estimate summary: 4 metric tiles + sell total card +
   per-category breakdown. Reflects pricebook overrides (if set in
   the Pricebook editor from the prior pass).
10. Field deployment summary: install progress bar + per-kind
    breakdown table.
11. Pricing assumptions section appears only in internal view when
    overrides exist.
12. Warnings table: heuristic checks + severity chips. Customer
    view shows only HIGH severity.
13. Assumptions & exclusions section + Attachments placeholder.
14. Footer signature lines visible in internal view, hidden in
    customer view.
15. Flip to **Customer view** → BOM section + pricing assumptions
    + signature lines hide; warnings narrow to HIGH only;
    "Cost detail is hidden" notice appears in exec summary.
16. **Print / Save PDF** opens browser print dialog with the
    document scaled for letter, no chrome.
17. From `/review` → top bar shows new sky-blue **Reports** button
    that routes to `/reports` directly.

### Regression checks

- TopBar **Add plan**, **BOM**, **Present**, **Deploy**,
  **Reports**, **Project state** all visible — verified.
- BOM drawer + CSV + Pricebook editor still work — verified prior
  pass; Reports just consumes the same `deriveCanvasBomRows` data.
- Deployment screen renders 9 WO rows after navigating back —
  verified.
- No new React or runtime errors in the console (only standing
  Vite HMR websocket cosmetic noise).

### Build result

`npm run build` → exit 0, 2.33 s. New bundle hash captured in the
deploy commit below.

### Deployment

This pass DOES deploy to Vercel production. See the final report for
the live URL + the source + build commit hashes.

---

## Cloud Sync / Local Snapshot History Pass (2026-05-18, after Reports)

**Goal.** Lay the operational + UI substrate a future cloud sync will
build on, without faking any cloud connection today. Adds explicit
sync-status surfacing, per-project local snapshot history, and a
plain-module service layer that the next pass can swap to a real
backend without rewriting callers.

### What shipped this pass

- New `src/app/services/projectSync.ts` module exposing seven helpers:
  - `getSyncMode(projectId)` — returns `{ mode: 'local',
    cloudConnected: false, storeKey, localStorageBytes,
    projectStateBytes, lastLocalSave?, counts: { devices, doors,
    pathways, idfs, floors, workOrders, pricebookOverrides,
    snapshots } }`. Pure; safe to call inside render.
  - `saveLocalSnapshot(projectId, name?)` — builds an envelope via
    `exportProjectState`, persists it under
    `localStorage["deeperVisionSnapshots"]`.
  - `listLocalSnapshots(projectId)` — returns snapshots for this
    project, newest first.
  - `restoreLocalSnapshot(snapshotId)` — pass-through to
    `useProjectStore.getState().importProjectState(env)`.
  - `deleteLocalSnapshot(snapshotId)` — removes from the snapshot blob.
  - `exportProjectEnvelope(projectId)` — thin wrapper around
    `exportProjectState`.
  - `importProjectEnvelope(envelope)` — thin wrapper around the store
    action.
- `ProjectStateMenu` widened to 400 px and gains two new sections at
  the top:
  - **Sync status**: Mode chip (`CloudOff` icon · "Local browser
    storage"), Cloud sync chip (amber `CloudOff` · "Not connected"),
    last local save timestamp, project state size, store blob size,
    plus a 4×2 mini-counter grid (Devices / Doors / Pathways / IDFs
    / Floors / WOs / Pricebook / Snapshots).
  - **Snapshots (N)**: a name input + Save button on top, followed
    by a list of saved snapshots. Each row shows name, relative
    timestamp, summary counts (devices / doors / pathways / WO
    state), Restore button, Delete icon. Empty state hints how to
    use them.
- New `SnapshotRestoreConfirmModal` — full-screen modal that previews
  the snapshot summary + source build label (with version-drift
  warning) before applying. Matches the existing
  `ImportConfirmModal` pattern.
- Snapshot delete uses `window.confirm` to keep one-shot destructive
  actions compact; restore + import keep the proper modal because
  they overwrite live state.
- Updated footer copy in the menu to the exact brief language:
  > This prototype stores edits in **this browser**.
  > To move edits between local and live, use Export / Import or
  > Snapshots.
  > Cloud sync is not connected yet.
- "Clear local project state" toast updated to note "Snapshots kept
  under their own key", reflecting the new key separation.

### Honest vs not-yet-connected

- **Honest, real**:
  - `getSyncMode` always returns `mode: 'local'`, `cloudConnected: false`.
    No background polling, no faked "syncing…" indicator.
  - Snapshots live under their own localStorage key
    `deeperVisionSnapshots`; "Clear local project state" no longer
    nukes them by accident.
  - Save → mutate → restore → mutate → restore round-trip is
    verified to round-trip a `CAM-101.notes` marker end-to-end.
  - Sync-status size readings come from `localStorage.getItem`
    string-length (project envelope + full store blob).
- **Labelled / not connected**:
  - Cloud chip is amber `CloudOff` "Not connected".
  - Footer disclaimer states cloud sync isn't connected.
  - Snapshot restore modal warns when the snapshot's source build
    differs from the current page.

### What the user can verify in the browser

1. Open `/project/p1/canvas` → click **Project state ▾**.
2. Top of menu shows **Sync status** (Mode = Local browser storage,
   Cloud sync = Not connected) and per-project counters (Devices 9,
   Doors 2, Pathways 1, IDFs 1, Floors 2, WOs 9, Pricebook 0,
   Snapshots 0).
3. Type a name in the **Snapshots** input → click Save → row
   appears with timestamp + counts.
4. Mutate the canvas (edit a camera, change a pricebook value,
   anything) → Save another named snapshot.
5. Click **Restore** on the first snapshot → confirm modal previews
   counts + source build → click *Restore + replace state* → the
   live canvas reverts to that snapshot. Verified end-to-end with a
   marker note on CAM-101.
6. Click **Restore** on the second snapshot → the marker comes back.
7. Click the trash icon on a snapshot → window.confirm → snapshot
   row disappears, count decrements.
8. Reload page → snapshots survive. The "Snapshots" counter in the
   sync-status grid matches the list length.
9. **Reset to shared demo** still wipes the live project but leaves
   snapshots intact (separate key).
10. **Clear local project state** also leaves snapshots intact (toast
    notes this).
11. **Export project JSON** still produces the envelope with all the
    pricebook / work-order / door-assembly fields.
12. `/reports` and `/deployment` routes still reflect the live state
    after a snapshot restore.

### Regression checks

- TopBar **Add plan**, **BOM**, **Present**, **Deploy**, **Reports**,
  **Project state** all visible and functional — verified.
- Reports + Deployment routes both reflect the restored state.
- BOM drawer / Pricebook editor unchanged.
- No new React / runtime errors in the console after a fresh reload
  (only standing Vite HMR websocket cosmetic noise).

### Build result

`npm run build` → exit 0, 1.93 s. New bundle hash captured in the
deploy commit below.

### Persistence

No store version bump; snapshots live under their own
`deeperVisionSnapshots` localStorage key, separate from the v7
`deeperVisionStore` blob. That separation is what lets "Clear local
project state" preserve snapshot history.

### Deployment

This pass DOES deploy to Vercel production. See the final report for
the live URL + the source + build commit hashes.

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
