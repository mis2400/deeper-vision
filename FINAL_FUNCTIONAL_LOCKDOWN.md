# Final Functional Lockdown

This is the audit of the **functional + UX lockdown pass**. The goal: every visible control on every primary screen does something real, or it's gone. No "deferred." No "future pass." No "placeholder." If a button is on screen, you can press it and something useful happens.

The previous `FINAL_LOCKDOWN_AUDIT.md` documented the route + canvas-control disposition. This document documents the **functional changes that landed in this pass** and the **honest current state** of the product.

---

## 1. What landed this pass

### 1.1 Tech-model filtering now actually filters

Previously, switching the Cloud / On-prem / Hybrid pill at the top of the canvas changed a single store value and **did nothing visible**. The library, the recommendations, the badges — none of them respected it.

This pass:

- Every `Product` entry in `EngineeringCanvas.PRODUCTS` is now classified into one or more tech-model ecosystems (`cloud`, `on_prem`, `hybrid`, or `all`).
- Classification happens via the `MANUFACTURER_TECH_MODEL` map. Verkada, Meraki, Rhombus, Brivo, Alta, Eagle Eye, Arcules → cloud. Axis, Hanwha, Avigilon, Bosch, Genetec, Milestone, FLIR → on-prem (and hybrid). HID, Von Duprin, Securitron, APC and other infrastructure → all (always shown).
- The `productMatchesTechModel(p, model)` predicate is the single source of truth and is used in:
  - The category list (each row shows "X in stack · Y total" with the in-stack count flagged amber when zero).
  - The level-2 type sections (in-stack SKUs first; off-stack SKUs only appear when the user searches by name and are visibly desaturated).
  - The dock header sub-text ("N in cloud stack · M total · 9 categories").
- A new badge column on the right of each product row shows **Recommended** (green) for top-pick SKUs in the active stack, and **Outside stack** (slate) for products that don't match the project's active model.

Result: changing the Stack pill at the top now visibly reshapes the device library.

### 1.2 Product inventory expanded

`PRODUCTS` went from ~55 SKUs to ~100+, with **all major manufacturers** represented:

- **Cloud cameras**: Verkada CB52-E / CB62-E / CD62-E / CD72-E / CD92 / CF81-E, Meraki MV63 / MV13, Rhombus R600 / R400.
- **On-prem cameras**: Axis P1468 / P1465 / Q1798 / P3265 / P3267 / Q6315 / Q6135 / P3827 / M4327 / Q1961 / W120, Hanwha XNO-9083R / XND-9082RF / PNM-9320 / PNM-12082RVD / PNF-9010R / XNP-9250R, Avigilon H5A bullet/dome/PTZ/multi, Bosch DINION 8000i / FLEXIDOME 8000i / MIC fusion 9000i / AUTODOME multi 7000i / DINION 5100i, Pelco Sarix, Vivotek FD9387 / FE9382, FLIR FC / FH.
- **Access control readers**: HID Signo 20 / 40 / 20K, Alta R3, Brivo ACR1255, Verkada AD34, Suprema BioStation 3, Iris ID iCAM 7S.
- **Locks / exit**: Von Duprin 6210, HES 9600, Securitron M62 / M38, Bosch REX-PIR, STI SS-2000, Boon Edam Speedlane 360, 2N IP Verso, Aiphone IX-DV.
- **Network**: Cisco C9300-48P / 24P, Meraki MS355-48X, HPE Aruba 2930F, APC NetShelter SX, Middle Atlantic WMRK-24, Cisco C9166, Meraki MR57, Fortinet FortiGate 100F, Palo Alto PA-1410, Ubiquiti airFiber 60.
- **Storage**: Axis S1216, Hanwha WRN-1610S, Genetec Streamvault 4000, Milestone XProtect SRV, Dell PowerEdge R760, Eagle Eye CMVR 308, Arcules Cloud Bridge.
- **Plus** intrusion, audio, displays, power, sensors — all unchanged but now properly classified.

### 1.3 Canvas fullscreen mode

Two view modes are now distinct and named:

- **Focus** (eye-off icon) — hides the in-app chrome (top bar, left nav rail, insert dock). The canvas dominates the window. Click "Exit immersive" pill at top-left to return.
- **Fullscreen** (maximize icon) — calls the browser Fullscreen API (`requestFullscreen` / `webkitRequestFullscreen` / `msRequestFullscreen`). Fills the entire monitor. Auto-flips on Focus mode at the same time so the canvas is truly alone on the screen. Escape exits cleanly; fullscreen-change events keep state in sync.

Both buttons live in the top bar, right side, between the team avatars and the **Run vision scan** action.

### 1.4 Add Building / Add Floor map now actually work

The Maps panel previously had two dead buttons ("Add building", "Import") and one dead link on every expanded building ("Add floor map to X").

This pass:

- **Add building** opens an `AddBuildingDialog` (modal): name + optional address. On submit, appends a new `SiteBuilding` to the panel's state, seeded with a default Ground floor, auto-expands the new building, switches the active floor to it, and emits a toast confirming.
- **Add floor map to <building>** opens an `AddFloorDialog`: floor name + source picker (Blueprint / Satellite / Sketch). On submit, appends a floor to the building, switches active floor, toast confirms.
- **Import** button removed — no real importer backend exists. Will return when DWG / PDF / image ingestion is wired.

State is local to the `MapsPanel` for now. When the multi-floor canvas store integration lands, the same handlers will dispatch through the project store instead.

### 1.5 Non-working buttons removed

Per the absolute rule "if a button doesn't work, hide it":

- **Top bar Share button** — removed. No sharing backend.
- **Top bar Undo / Redo** — already removed in a previous pass.
- **Maps panel Import button** — removed (see 1.4).
- **MoreHorizontal kebab on floor rows** — removed (was a hover-only ghost with no menu).

### 1.6 VisionScan honesty banner

VisionScan is a **simulated** workflow. The five findings on screen come from a representative project — not from analysis of the user's live canvas. The subtitle is updated to say so, and a high-visibility amber banner at the top spells out the scope: "When the analysis engine connects, this same UI will surface real coverage gaps, code issues, PoE budget overruns, and cable-length warnings."

This is the right framing because the UI design itself is correct and reviewable; only the back-end is missing.

---

## 2. State of every primary screen (post-pass)

Legend: ✅ working · ⚠️ simulated but visible · ❌ blocked

| Route | Screen | Status | Notes |
|---|---|---|---|
| `/login` | LoginScreen | ✅ | Demo button → /dashboard. Manual form → /dashboard. Both work. |
| `/dashboard` | Dashboard | ✅ | Six sections live: Today, Pipeline, Projects, Team, Integrations, Customer Operations. Reads real store. |
| `/projects` | ProjectHub | ✅ | Bucket filters, lifecycle chips, customer link — all backed by store. |
| `/project/:projectId` | ProjectCenter | ✅ | Phase timeline, owners, activity, next-action banner — backed by store. |
| `/project/:projectId/canvas` | EngineeringCanvas | ✅ | Heart of the product. Drag physics, magnetic snap, attach rings, tech-model filtering, fullscreen, multisensor lens engineering, 6 base map modes, drag-onto-host with compatibility validation, cable pathway draw, measure tool, undo via Esc, persistence to localStorage. |
| `/crm` | PipelineView | ✅ | Kanban kanban backed by `opportunities` slice. |
| `/account/:customerId` | AccountDetail | ✅ | 5 tabs reading the store. |
| `/catalog` | ProductCatalog | ✅ | Sample catalog with filters; labeled sample. |
| `/estimate/:projectId` | EstimatorView | ✅ | Live BOM derived from canvas devices. Customer role gates internal cost. |
| `/portal/:projectId` | CustomerPortal | ✅ | Customer-facing review surface. |
| `/commission/:projectId` | Commissioning | ✅ | Test results gate-checked per device. |
| `/pathways/:projectId` | PathwayRouting | ✅ | Cable runs visible per project. |
| `/visionscan` | VisionScan | ⚠️ | Simulated workflow with honesty banner. Scripted findings. |
| `/calibrate/:projectId` | BlueprintCalibration | ⚠️ | Two-point scale UI exists; result is local-only (not persisted yet). Hidden from primary nav. |
| `/intake/:projectId` | SiteIntake | ⚠️ | Form-only; doesn't write back. Hidden from primary nav. |
| `/flow/:projectId` | FlowView | ⚠️ | Illustrative workflow diagram. Hidden from primary nav. |
| Other hidden routes | (various) | ❌ | Mounted in App.tsx so deep links don't 404 but not in command palette. See `FINAL_LOCKDOWN_AUDIT.md` for the full list. |

---

## 3. State of every canvas control

| Control | Status | Notes |
|---|---|---|
| Pointer (V) | ✅ | Selects + edits |
| Hand (H) | ✅ | Pans the canvas |
| Measure (M) | ✅ | Two-click distance, Esc clears |
| Cable / pathway (C) | ✅ | Click vertices, Enter / dbl-click to finish, persists via `addPathway` |
| Wall draw (W) | ✅ | Click vertices |
| Zoom in / out / fit | ✅ | Bottom-left dock |
| Layers panel | ✅ | Right rail |
| **Stack pill (Cloud / On-prem / Hybrid)** | ✅ | **NEW THIS PASS** — visibly reshapes the device library |
| Map mode picker | ✅ | 6 honest modes; Satellite/Street/Hybrid/Dark all render distinct simulated surfaces |
| Layer toggles | ✅ | Unimplemented toggles already hidden in last pass; remaining ones (fov, labels, dimensions, pathways, presence) all visibly affect the canvas |
| Icon size / label density / coverage opacity | ✅ | All persist per project |
| **Focus mode** | ✅ | Hides chrome, immersive canvas |
| **Fullscreen** | ✅ | **NEW THIS PASS** — browser Fullscreen API; pairs with Focus |
| Selected object toolbars | ✅ | All 6 device-class toolbars work; tabs open inspector drawer |
| Drag physics | ✅ | Spring/damper, magnetic snap, hover-host attach ring |
| Drag-onto-host attach | ✅ | Compatibility validation via `canHost(host, candidate)`. Maglock → REX warning surfaces. |
| Multisensor lens engineering | ✅ | A/B/C/D chips, linked/independent modes, per-lens rotation/FOV/range/focal |
| Scale bar / North arrow | ✅ | Bottom-right indicators |
| Run vision scan | ⚠️ | Navigates to /visionscan (simulated) |
| **Add building** | ✅ | **NEW THIS PASS** — opens modal, persists to MapsPanel state |
| **Add floor map** | ✅ | **NEW THIS PASS** — opens modal, persists to MapsPanel state |
| Share button | — | **REMOVED THIS PASS** (no backend) |
| Import button | — | **REMOVED THIS PASS** (no backend) |

---

## 4. What still isn't done

Honest list of things the design assumes but doesn't ship yet:

1. **Real VisionScan analysis engine.** UI is locked; backend is a 1.8s setTimeout that surfaces scripted findings.
2. **Real floorplan ingestion** (DWG / PDF / image → traced geometry). The Import button is removed for this reason.
3. **Action-history undo/redo subsystem.** Esc clears in-progress tools; deletes a selected device. There's no global undo stack yet.
4. **Site/Building/Floor persistence in the project store.** The Maps panel now mutates local state on add; that state survives within the session but doesn't flow through `projectStore`.
5. **Sharing surface.** No external view links, no role-scoped public URLs.
6. **AI inline assistant as a side-panel.** Inline issue chips already exist via `IntelligenceLayer`; a true conversational sidebar is not yet shipped.

Each of these has UI hooks in place (or carefully removed). Adding the backend or persistence in a future pass should not require redesign.

---

## 5. How to verify

```bash
npx vite build  # passes; no TS errors
npm run dev     # then visit /project/p1/canvas
```

Steps to see the new behavior:

1. Open the canvas. Note "Device library · N in hybrid stack · M total · 9 categories" at the top of the insert dock.
2. Click the Stack pill at the top of the canvas → switch to **Cloud**. Watch the library re-rank: Verkada, Meraki, Rhombus float to the top with **Recommended** badges; Axis, Hanwha, Avigilon disappear unless you type their name in search (then they appear at the bottom, desaturated, with an **Outside stack** badge).
3. Switch to **On-prem**. The reverse happens.
4. Click **Fullscreen** in the top-right bar. The window goes fullscreen and chrome hides. Click "Exit fullscreen" pill (top-left) to return.
5. Open the **Maps** nav section. Click **Add building**. Fill in a name, click **Add building**. New entry appears at the bottom of the list, auto-expanded with one Ground floor.
6. Click **Add floor map to <new building>**. Pick a source. New floor appears.

If any of these stop working in a future pass, this doc is the regression checklist.

— Lockdown pass complete.
