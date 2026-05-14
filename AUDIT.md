# DEEPER VISION — Phase 1 Audit

Status snapshot as of `5301c51` + maturity-pass commits. Read top-to-bottom; the
"Foundational gaps" section is the architectural truth that the rest of the
audit hangs from.

---

## 1 · Foundational gaps (fix BEFORE anything else)

| # | Finding | Evidence | Severity |
|---|---|---|---|
| **F1** | **No shared state across screens.** Every route holds its own SEED data. Moving a camera on `/project/1/canvas` is invisible to `/estimate/1`, `/pathways/1`, `/commission/1`, etc. The platform is 29 isolated demos. | `grep useContext / createContext / zustand` → only shadcn-internal context. No project store. | **Critical** |
| **F2** | **Almost nothing persists to localStorage.** Engineering work (placed devices, lens configs, rotations, notes) is wiped on reload. Only `canvas:<projectId>:hidden`, `canvas:<projectId>:locked`, and the floorplan geometry survive. | `grep localStorage` → 6 hits, none on the device array. | **Critical** |
| **F3** | **22 of 30 routes are orphans.** Only `/projects`, `/help`, `/settings`, `/intake/new`, and project-canvas links are reachable from the UI. The hamburger menu (AppShell) covers 18 of the 30 — but uses hardcoded `p1` IDs that don't match real projects (`1`, `2`, `3`, `4`). | `grep navigate\( ` returns 4 unique destinations; hamburger uses `p1`, ProjectHub uses `1`. | **Critical** |
| **F4** | **No lifecycle hierarchy.** All routes are flat siblings in App.tsx. No notion of "this is a sales screen vs. an engineering screen vs. an operations screen." | App.tsx is a single 30-line `<Routes>` block, no grouping, no guards. | **High** |
| **F5** | **EngineeringCanvas is a 3,879-line monolith.** 41 useState calls, 12 hardcoded data arrays, every concept in one file. Refactoring anything risks breaking everything else. | `wc -l screens/EngineeringCanvas.tsx` → 3879. Next-largest screen is 201 lines. | **High** |
| **F6** | **No CRM concepts exist.** No companies, contacts, opportunities, stages, pipelines. The "lead → project → service" arc has zero substrate. | No mention of company/contact/opportunity/lead/pipeline anywhere in `src/`. | **Critical** (for the vision) |

---

## 2 · Per-route audit

Labels: **Working** · **Placeholder** · **Fake** · **Broken** · **Laggy** · **Duplicate** · **Confusing** · **Orphan** · **Remove**

### Sales & intake

| Route | Label | Notes / Top issues |
|---|---|---|
| `/login` | **Working w/ caveat** | Submits to `/projects` without validating; "Continue with SSO" and "Request access" both navigate to `/projects` — three differently-named paths, identical behavior. Demo card I added is the only honest part. **Action:** keep the visual; back with real auth later. |
| `/intake/:projectId` (Site Intake) | **Placeholder + Orphan** | Reachable only via "New project" button. 5-step wizard with 7 useStates, but pressing Continue at step 5 doesn't create a project or write anywhere — pure local form state. 5 TODO markers in source. **Action:** wire to a project store; make this the canonical project-creation flow. |

### Project portfolio

| Route | Label | Notes |
|---|---|---|
| `/projects` (ProjectHub) | **Working** | Filter chips work; grid/list toggle works; cards navigate to canvas. Best-built screen in the app. Counts and statuses are hardcoded though. **Action:** swap hardcoded list for store-driven list when F1 is fixed. |

### Survey & engineering (the canvas)

| Route | Label | Notes |
|---|---|---|
| `/visionscan` | **Placeholder** | 5-button form for "Building type / Scan quality" — submit doesn't actually scan, just navigates. No real LiDAR plumbing, no AI floorplan extraction. **Action:** simulate a real scan flow with progress states; persist generated floorplan to the project store. |
| `/sitewalk/:projectId` | **Placeholder + Orphan** | 4 action cards (Capture Photo / Record Video / Voice Note / Scan QR) — none of these are wired. "Save Draft" + "Complete Walk" call toasts only. **Action:** at minimum, wire toast feedback; long-term, build real capture flow + persist to project. |
| `/project/:projectId/canvas` (EngineeringCanvas) | **Working but monolithic** | 3879 lines. Drag, selection, rotation ring, FOV/range handles, multisensor 4-lens, drawer, telemetry all work. But: device state is local — moving a camera here doesn't affect `/estimate`. **Action:** F1 + F5 — extract to a store, split file. |
| `/calibrate/:projectId` | **Orphan** | Two-point calibration UI exists but the resulting scale doesn't propagate to the canvas geometry. **Action:** remove until the scale value is actually used, OR wire it. |
| `/door/:doorId` | **Orphan + Confusing** | Standalone door-engineering page. Disconnected from the canvas — there's no way to get here from a door placed on the canvas. **Action:** make this a drawer or drill-in from the canvas, not its own route. |
| `/interactions` | **Documentation page, Orphan** | Reference for canvas interaction patterns. Not a product feature. **Action:** move to `/docs/interactions` or delete. |
| `/layers/:projectId` (LayerStack) | **Placeholder + Orphan** | 77-line stub. Toggles for layer visibility that don't actually drive anything. **Action:** delete or merge into a canvas layers panel. |

### Analysis

| Route | Label | Notes |
|---|---|---|
| `/flow/:projectId` (FlowView) | **Working but fake** | Renders a fixed device topology graph; "Simulate failure cascade" button has 0 onClick handlers. 6 hardcoded data arrays. **Action:** drive from the project store; wire the cascade simulation. |
| `/pathways/:projectId` | **Placeholder** | 113 lines, 1 button, 0 onClick — the entire screen is decorative. **Action:** rebuild with real pathway state OR delete until BOM is alive. |
| `/power/:projectId` (PowerCablePlan) | **Placeholder** | 148 lines, 1 button, 0 onClick. Hardcoded IDF / PoE / wattage data. **Action:** drive from canvas devices' PoE wattage; otherwise delete. |
| `/threat/:projectId` (ThreatSimulator) | **Placeholder + Orphan** | 201 lines, 5 buttons + 5 handlers, but the "threats" and "paths" are seeded constants. No connection to actual canvas state. **Action:** either deepen with real adversarial-path generation off the floorplan or delete. |
| `/ai/:projectId` (AIAssistant) | **Placeholder** | 90 lines, 2 buttons, 1 TODO. Looks like a chatbot stub. **Action:** delete as a standalone screen; AI should be embedded contextually in the canvas (your earlier brief). |

### Estimating & handoff

| Route | Label | Notes |
|---|---|---|
| `/estimate/:projectId` (EstimatorView) | **Fake** | 122 lines. BOM totals, labor, markup all hardcoded — they don't reflect any actual placed devices. **Action:** derive from the project store (cameras × unit prices, etc.). |
| `/proposal/:projectId` (ProposalBuilder) | **Placeholder** | 143 lines, 3 buttons, 0 onClick. **Action:** wire generation flow; pull data from BOM/estimate. |
| `/permit/:projectId` (PermitPacket) | **Placeholder** | 125 lines, 2 buttons, 0 onClick. **Action:** define what "permit packet" means concretely first; until then delete from menu. |

### Deployment & ops

| Route | Label | Notes |
|---|---|---|
| `/commission/:projectId` | **Working w/ caveat** | Tab structure (Install / Firmware / Network / Signal / Punch / Signoff) works. "Mark pass" works. Field tools (Photo / Ping / Stream / Bandwidth) show toasts. But devices are hardcoded — disconnected from the canvas. **Action:** derive devices from project store. |
| `/workorders/:projectId` | **Placeholder** | 131 lines, 3 buttons, 2 onClick. **Action:** define workflow before building UI; for now, keep as nav-reachable stub. |
| `/maintenance/:projectId` | **Working w/ caveat** | 98 lines, table of jobs, status filter works, but all jobs are hardcoded. **Action:** persist jobs to a store. |
| `/changeorders/:projectId` | **Placeholder** | 138 lines, 4 buttons, 3 onClick. "New change order" toasts only. **Action:** define data model first. |
| `/portal/:projectId` (CustomerPortal) | **Placeholder** | 107 lines, 3 buttons, 1 onClick. Approve Proposal / Request Changes / Send Message all toast only. **Action:** build a real approval flow that writes back to the project store. |

### Customer operations & reference

| Route | Label | Notes |
|---|---|---|
| `/live/:projectId` (LiveIntegration) | **Confusing + Orphan** | 106 lines. "Mode" pills (Normal/Lockdown/Emergency/Active Shooter) suggest live alarm system, but all data is fake. Overlaps with Commissioning visually. **Action:** decide if this is "live monitoring" (operations) or "incident response" (separate product); pick one. |
| `/devices` (DeviceLibrary) | **Working w/ caveat** | Catalog table renders. "Add" buttons navigate to canvas. But the catalog itself is a 13-product local array. **Action:** move to `src/app/lib/catalog.ts` (already exists from prior session) and consume from a single source. |
| `/admin/library` (ComponentAdmin) | **Duplicate** | Overlaps significantly with `/devices`. Two screens, same purpose. **Action:** merge or pick one. |
| `/kb` (KnowledgeBase) | **Placeholder** | 101 lines. Article tiles that don't open anything. **Action:** either make a real KB or delete from nav. |
| `/help` (HelpCenter) | **Working** | 80 lines, no interactions, but it doesn't claim to. Static reference page. **Action:** OK. |
| `/settings` (SettingsView) | **Fake** | 182 lines, 6 buttons, 1 onClick. 3 `defaultValue` inputs that don't persist. **Action:** wire to a real settings store OR remove unimplemented sections. |

---

## 3 · Architectural recommendation: lifecycle hierarchy

The user's vision: **CRM → Project → Survey → Engineering → BOM → Proposal → Approval → Deployment → Commissioning → Operations → Service → Lifecycle**.

Mapping current routes onto that:

| Phase | Current routes | Status |
|---|---|---|
| **0. CRM / Sales** | _none_ | **Missing entirely.** No companies, contacts, opportunities, pipelines. |
| **1. Projects** | `/projects` | Works. Needs store-driven data. |
| **2. Survey** | `/visionscan`, `/sitewalk/:id`, `/calibrate/:id` | Three separate placeholder screens. Should be one survey flow. |
| **3. Engineering** | `/project/:id/canvas`, `/door/:id`, `/layers/:id`, `/interactions` | Canvas is the hero; the other three should be drawers or removed. |
| **4. Analysis** | `/flow/:id`, `/pathways/:id`, `/power/:id`, `/threat/:id`, `/ai/:id` | Five screens, four are placeholders. Most should be tabs/drawers within the canvas, not separate routes. |
| **5. BOM / Estimating** | `/estimate/:id` | Hardcoded; needs to derive from canvas. |
| **6. Proposal / Customer Review** | `/proposal/:id`, `/portal/:id` | Both placeholders. Should be one connected flow. |
| **7. Permitting** | `/permit/:id` | Placeholder. Possibly defer. |
| **8. Deployment / Commissioning** | `/commission/:id`, `/workorders/:id` | Commissioning works structurally. Work orders is a placeholder. |
| **9. Customer Operations** | `/portal/:id`, `/live/:id` | Two screens, neither does what they imply. The actual long-term moat is here. |
| **10. Service / Tickets** | _none_ | **Missing entirely.** |
| **11. Lifecycle Mgmt** | `/maintenance/:id`, `/changeorders/:id` | Both partial. |
| **Reference / Admin** | `/devices`, `/admin/library`, `/kb`, `/help`, `/settings` | Mostly fine; deduplicate /devices vs /admin/library. |

---

## 4 · What to remove now (without losing anything)

These are pure deletes — nothing depends on them, they confuse the nav:

- `/interactions` — internal documentation, not a product surface
- `/layers/:projectId` — 77-line stub that overlaps with the canvas Layers panel
- `/admin/library` — duplicates `/devices`
- `/ai/:projectId` standalone — should be embedded contextually in the canvas

After deletion: **26 routes → 22**, all of which earn their place.

## 5 · What to BUILD next (in order)

Strictly in this sequence — each unlocks the next:

1. **Project store + persistence** (F1 + F2). Single source of truth for devices, lens configs, walls, calibration, intake fields, BOM rows, commissioning state. Persists to localStorage keyed by `projectId`. Without this everything else is theater.
2. **Real CRM substrate** (F6). Add `Company`, `Contact`, `Opportunity`, `Pipeline` to the project store. Build `/leads` and `/contacts` screens.
3. **Lifecycle phase machine.** Each project carries a `phase: 'lead' | 'survey' | 'engineering' | 'bom' | 'proposal' | 'approved' | 'deploying' | 'commissioning' | 'live' | 'service' | 'archived'`. Phase drives which sidebar items are emphasized.
4. **Wire estimating to the canvas.** When canvas devices change, BOM line items recompute. Margin/labor surface in the drawer in real time.
5. **Customer review flow.** `/portal/:id` shows the live project; approve writes back to the store and advances phase.
6. **Service / tickets** as the long-term moat.

---

## 6 · Performance + glitches

Re-checked under the maturity pass:

- **Drag is now smooth** post the useDragHandler ref-pattern fix.
- **Coverage cones** — multisensor uses per-cone radial gradients (atmospheric). Single-cam still uses the older grad defs — fine, but inconsistent.
- **Canvas renders quickly** on a 6-device floorplan. With 50+ devices, expect re-render cost from the 41-useState parent. Need React.memo on FOV/HardwareGlyph when we hit that scale.
- **No major glitches detected** in this audit. The "feels flat" complaint earlier was visual/architectural, not perf.

---

## 7 · Brand + identity

- **Wordmark**: "DEEPER VISION" with cyan VISION. Fine.
- **Typography**: defaults. Needs an opinionated display font + careful number tabular treatment for telemetry.
- **Iconography**: 100% lucide-react. Workable but generic. Custom icons for the 6-8 most-used concepts (camera lens, multisensor, IDF, pathway, target) would differentiate.
- **Loading states**: none. Every transition is instant. A 200ms scan animation on /visionscan or a project-load shimmer would add weight.
- **Onboarding**: none. A 4-card tour the first time a user opens the canvas would help.

These are polish items — **lower priority than the foundational gaps**.
