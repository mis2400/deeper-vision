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

## Build / typecheck

### 14. Production build is clean
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
| 14 | Build clean | |
