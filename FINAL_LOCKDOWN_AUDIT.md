# Final Lockdown Audit

State of the live app at the start of the lockdown pass. Every route assessed; every control on the canvas accounted for. Honest categories.

**Legend**
- **REAL** — Screen has working logic backed by the project store. Persists. Usable.
- **PARTIAL** — Screen has visible UI but missing wiring (e.g., reads store but no write path, or writes only locally).
- **PLACEHOLDER** — Shell screen from the original Figma export; visual UI only, no real data path.
- **HIDDEN** — Action of this pass: remove from primary navigation.

---

## 1. Route audit

| Route | Component | Status | Disposition this pass |
|---|---|---|---|
| `/login` | LoginScreen | REAL | Keep. Redirect target switches from `/projects` → `/dashboard`. |
| `/dashboard` | **NEW** — Dashboard | NEW | Build this pass. Six sections, store-backed where possible, placeholder-labeled where not. |
| `/projects` | ProjectHub | REAL | Keep. Customer-name link, lifecycle phase chips, bucket filters all working. |
| `/project/:projectId` | ProjectCenter | REAL | Keep. Next-action banner, phase timeline, owners, activity feed all backed by store. |
| `/project/:projectId/canvas` | EngineeringCanvas | REAL | Keep — the heart of the product. |
| `/crm` | PipelineView | REAL | Keep. Kanban backed by `opportunities` slice. |
| `/account/:customerId` | AccountDetail | REAL | Keep. 5 tabs, all reading from store. |
| `/devices` | DeviceLibrary | PARTIAL | Standalone library page. Has been superseded by the InsertDock on the canvas. **HIDE from primary nav**; route remains accessible from settings if needed. |
| `/estimate/:projectId` | EstimatorView | REAL | Keep. BOM derived from canvas devices live. |
| `/portal/:projectId` | CustomerPortal | REAL | Keep. Customer-facing review surface. |
| `/commission/:projectId` | Commissioning | REAL | Keep. Test results gate-checked per device. |
| `/pathways/:projectId` | PathwayRouting | REAL | Keep. Cable runs visible per project. |
| `/flow/:projectId` | FlowView | PARTIAL | Keep but de-emphasize — the workflow diagram is illustrative. |
| `/sitewalk/:projectId` | SiteWalk | PLACEHOLDER | **HIDE** until built. Survey lives in BlueprintCalibration for now. |
| `/visionscan` | VisionScan | PLACEHOLDER | **HIDE**. AI-LiDAR placeholder. |
| `/calibrate/:projectId` | BlueprintCalibration | PARTIAL | Two-point scale calibration UI exists. Calibration result is local-only — does not yet persist to the floor record. **HIDE from primary palette**; reachable from canvas top-bar setup. |
| `/intake/:projectId` | SiteIntake | PARTIAL | Form-only; doesn't write back to project record. **HIDE**. |
| `/threat/:projectId` | ThreatSimulator | PLACEHOLDER | **HIDE**. |
| `/layers/:projectId` | LayerStack | PLACEHOLDER | **HIDE** — superseded by the canvas's own Layers panel. |
| `/power/:projectId` | PowerCablePlan | PLACEHOLDER | **HIDE** — superseded by canvas pathway routing. |
| `/proposal/:projectId` | ProposalBuilder | PARTIAL | UI surface exists; doesn't yet bind to a specific design snapshot. **HIDE** until version-locking is added. |
| `/permit/:projectId` | PermitPacket | PLACEHOLDER | **HIDE**. |
| `/workorders/:projectId` | WorkOrders | PARTIAL | Visual task list; not generated from approved scope. **HIDE**. |
| `/maintenance/:projectId` | Maintenance | PLACEHOLDER | **HIDE**. |
| `/changeorders/:projectId` | ChangeOrders | PLACEHOLDER | **HIDE**. |
| `/door/:doorId` | DoorEngineering | PLACEHOLDER | **HIDE** — door engineering lives inside the canvas's edit drawer. |
| `/ai/:projectId` | AIAssistant | PLACEHOLDER | **HIDE** — AI suggestions are now contextual on the canvas. |
| `/interactions` | CanvasInteractions | PLACEHOLDER | **HIDE** — dev reference doc. |
| `/admin/library` | ComponentAdmin | PLACEHOLDER | **HIDE**. |
| `/kb` | KnowledgeBase | PLACEHOLDER | **HIDE**. |
| `/live/:projectId` | LiveIntegration | PLACEHOLDER | **HIDE** — live device feeds are a future module. |
| `/help` | HelpCenter | REAL (thin) | Keep accessible via the `?` icon in the header. |
| `/settings` | SettingsView | REAL (thin) | Keep. |
| `/catalog` | **NEW** — ProductCatalog | NEW | Build this pass. Lists sample products with filters; labeled "Sample catalog". |

**Result**: 13 routes become primary nav. 18 routes hidden from the command palette (still mounted in App.tsx so deep links don't 404, but invisible to users).

---

## 2. Canvas control audit

| Control | Behavior | Disposition |
|---|---|---|
| **Pointer tool (V)** | Selects and edits objects | KEEP — works |
| **Hand tool (H)** | Pans the map | KEEP — works |
| **Measure tool (M)** | Two-click distance measurement | KEEP — fixed in earlier pass |
| **Cable / pathway draw** | Was absent | **BUILD THIS PASS** — new `pathway` tool, click points, Enter to finish, Esc to cancel, persists via existing `addPathway` action, length computed from geometry |
| **Wall draw (W)** | Click points to add wall segments | KEEP — works when base is blank |
| **Zoom in / out / fit** | ZoomDock at bottom-left | KEEP — works |
| **Layers panel** | Right rail | KEEP |
| **Map mode picker** (Blueprint / Satellite / Street / Hybrid / Dark / Blank) | Blueprint and Blank render correctly. Satellite/Hybrid/Street/Dark currently fall through to Blank | **FIX THIS PASS** — implement clearly simulated variants for each mode so the choice is honest, labeled "Simulated map layer" |
| **Engineering layer toggles** (fov, labels, dimensions, pathways, rooms, nec, thermal, bandwidth, conduit_ids, presence) | fov, labels, dimensions, pathways, presence all visibly affect the canvas. Rooms, NEC, thermal, bandwidth, conduit_ids do NOT paint anything | **HIDE the four unimplemented toggles** from the layer panel (rooms, NEC, thermal, bandwidth, conduit_ids). Re-surface when the corresponding renderers exist. |
| **Display: Icon size** | Compact / Standard / Large | KEEP — works, persists |
| **Display: Label density** | Hidden / Selected / Important / All | KEEP — works, persists |
| **Display: Coverage opacity** | Slider 0–100 | KEEP — works, persists |
| **Scale bar** | Was absent | **BUILD THIS PASS** — small ruler bottom-right of canvas showing nominal foot scale |
| **North arrow** | Was absent | **BUILD THIS PASS** — small N indicator |
| **Selected object toolbar (Camera)** | Edit · Rotate · FOV · Duplicate · More | KEEP — already locked to spec |
| **Selected object toolbar (Multisensor)** | Edit · Lens · Mode · Target · More | KEEP |
| **Selected object toolbar (Door)** | Edit · Hardware · Electrify · Egress · More | KEEP |
| **Selected object toolbar (Reader)** | Edit · Link door · Mount · Validate · More | KEEP |
| **Selected object toolbar (Pathway)** | Edit route · Add bend · Pull box · Cable · More | KEEP |
| **Selected object toolbar (IDF)** | Edit · Switches · PoE · Links · More | KEEP |
| **Drag physics** | Spring/damper with magnetic snap | KEEP — locked in last pass |
| **Undo / Redo buttons in TopBar** | Visual only, no handler | **HIDE THIS PASS** — action history is a real subsystem; honest to hide buttons until built |
| **Intelligence pill (top-right)** | Toggles AI issue chips overlay | KEEP — defaults off |
| **Focus button (removed in prior pass)** | n/a | n/a |
| **Coverage mode switch (removed in prior pass)** | n/a | n/a |
| **Build stamp** | Bottom-left, `commit · date` | KEEP — verifies cache |
| **Customer view toggle** | Was absent | **BUILD THIS PASS** — toggle in role pill; when on, hides internal cost/margin from drawer and EstimatorView |

---

## 3. Drawer audit

| Tab | Status | Notes |
|---|---|---|
| **General** | KEEP | Identity, location |
| **Placement** | KEEP | Mount type, height, tilt, pan |
| **Coverage** | KEEP | Lens controls, FOV, range, DORI, AI hints (grouped) |
| **Power & Network** | KEEP | PoE, IDF, bandwidth, telemetry |
| **Compatibility** | KEEP | Compliance + linked systems |
| **Notes & Media** | KEEP | Free-form notes, media placeholder |

No 10-tab maze; already consolidated to 6. The header is editorial. No changes needed in this pass beyond the visual lock-in already done.

---

## 4. Object library categories (InsertDock)

Verified placeable today: Cameras, Access (readers/strikes/maglocks/REX/exit devices/biometric), Network (IDF/MDF/switches/APs/firewalls/bridges), Power (UPS/PoE injectors/surge/solar), Sensors (motion/glass/contact/panic/smoke), Audio (speakers/intercoms/horns/amps), Storage (NVR/cloud/server), Display (monitor/video-wall/kiosk).

Categories listed in the brief but currently empty in the library: Doors-as-objects (DoorType variants in schema; canvas drop currently places them via the DoorEngineering screen rather than from InsertDock), Wire / Cable (no draggable cable kit), Conduit, Gates (gate operator schema exists but not in InsertDock category), Elevators, Environmental, Perimeter.

**Action this pass**: hide empty categories from InsertDock until they have a placeable. The brief's rule: "do not show a category unless at least one object can be placed."

---

## 5. Door types

`DoorType` enum already includes: single, double, storefront, roll-up, gate, elevator, vestibule.

**Action this pass**: Verify each type is selectable inside the door drawer's type picker; if any don't render visually differently on canvas, that's a deferral I'll be honest about.

---

## What this pass will deliver vs defer

**Delivered**:
1. This audit document
2. `/dashboard` — new screen, default after login, six sections
3. Command palette cleaned — only working routes visible
4. Map mode rendering — six honest variants (simulated where no live tile provider)
5. Layer toggles trimmed — only those that visibly affect canvas remain
6. Cable drawing tool — full draw → finish → persist → BOM
7. Scale bar + north arrow on canvas
8. Customer view toggle — hides cost/margin where applicable
9. Product catalog screen — filters work, feeds InsertDock context
10. Undo/Redo buttons removed (kept the icon space only if hidden)
11. Routes that are placeholders hidden from command palette

**Deferred with honest labels**:
- Full undo/redo action history (separate subsystem)
- Live tile providers for satellite/street (using simulated layers labeled as such)
- Service / tickets full module (substrate exists; UI is a labeled future)
- Several Figma-export screens (intake, threat sim, permit, etc.) — mounted but hidden from navigation

The acceptance checklist at the end of the report uses ✅ / ⚠️ / ❌ honestly.
