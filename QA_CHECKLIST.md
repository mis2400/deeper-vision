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
