# Engineering Canvas — Control Audit

Status as of the canvas hard-reset pass. Every visible interactive control on the canvas is listed here, including its current behavior and the disposition decided in this pass.

The legend used in the **Disposition** column:
- **KEEP** — visible, works as labelled.
- **MOVE-TO-MORE** — kept, but only visible inside the "More" overflow popover.
- **REMOVED** — taken out of the visible UI because the implementation did not exist.
- **DEFERRED** — kept but flagged as substrate-only; UI wiring is the next pass.
- **DOCUMENTED** — works but lacks an obvious affordance; tooltip / label improved.

---

## 1. Top bar (above canvas surface)

| Control | Location | What it should do | Current state | Disposition |
|---|---|---|---|---|
| Project identity badge | Top-bar left | Show project + "Live" status | Static label "Riverbend HQ" | **DOCUMENTED** — labelled as project context; data wiring still uses the live project name |
| Floor dropdown | Top-bar left | Switch between floors of the active building | Opens a dropdown; only one floor wired today | **KEEP** — works; multi-floor switching is its own pass |
| Snap toggle (S) | Top-bar middle | Snap drags to a 20px grid | Works | **KEEP** |
| Units toggle (U) | Top-bar middle | Swap ft / m | Works | **KEEP** |
| Plan source | Top-bar middle | Open the plan-source onboarding picker | Works (re-opens onboarding) | **KEEP** |
| **Tech stack picker (Cloud / On-prem / Hybrid)** | Top-bar middle | Filter device catalog by ecosystem | **New this pass** — persists per project | **KEEP** |
| Undo (⌘Z) | Top-bar right | Revert last canvas action | Icon-only; no handler wired | **DEFERRED** — kept visible with tooltip; full action history is the next pass |
| Redo (⌘⇧Z) | Top-bar right | Re-apply reverted action | Icon-only; no handler wired | **DEFERRED** |
| Avatars | Top-bar right | Show collaborators | Static placeholders | **KEEP** as visual presence; live presence is in the layers panel |
| Share | Top-bar right | Open share / link dialog | Visual-only | **DEFERRED** — kept; full sharing flow is post-MVP |
| Run vision scan | Top-bar right | Navigate to `/visionscan` | Works | **KEEP** |

## 2. Left rail (LeftNavRail + InsertDock)

| Control | Location | What it should do | Current state | Disposition |
|---|---|---|---|---|
| Section nav rail | Left rail (top) | Switch sections (devices / sections panel) | Works | **KEEP** |
| Insert dock (device library) | Left panel | Drag a device onto the canvas | Works | **KEEP** |
| Manufacturer / category accordions | Insert dock | Expand product categories | Works | **KEEP** |
| Tech-model filter (in dock) | Inside InsertDock | Filter products by Cloud / On-prem | **DEFERRED** — the filter UI is in TopBar only this pass; surfacing inside the dock is the next pass | **DEFERRED** |

## 3. Selected-object floating toolbar (SelectionPill)

Each kind exposes ≤5 primary actions. The rest are inside the "More" overflow popover, with Delete rendered in rose tone.

| Kind | Primary | More overflow |
|---|---|---|
| Camera | Edit · Rotate · FOV · Duplicate | AI · Target sim · Link path · Note · **Delete** |
| Multisensor | Edit · Lens · Mode · Target | AI optimize · Duplicate · Note · **Delete** |
| Door | Edit · Hardware · Electrify · Egress | Validate · Schedule · Pathway · Exploded view · **Delete** |
| Reader | Edit · Link door · Mount · Validate | AI hint · Duplicate · Note · **Delete** |
| Pathway | Edit route · Add bend · Add pull box · Cable | Fiber · EMT · Wireless · AI · Fill % · **Delete** |
| IDF | Edit · Switches · PoE · Links | Thermal · UPS · Fiber · Failure analysis · **Delete** |

| Header chip | Previous state | Disposition |
|---|---|---|
| `rot/focal/DORI` metric chips | Always visible — clutter | **REMOVED** from header. The same numbers live inside the Coverage drawer where they're editable. |

## 4. Edit drawer (right side, opens via "Edit" button)

| Previous (10 tabs) | New (6 tabs) | Behavior |
|---|---|---|
| Overview | **General** | Identity + location summary |
| Mounting | **Placement** | Mount type, height, tilt, pan |
| Lens & FOV + AI & Analytics + Telemetry | **Coverage** | One screen for cones, AI hints, live telemetry |
| Power + Network | **Power & Network** | One screen for PoE + IDF + bandwidth |
| Compliance + Linked | **Compatibility** | One screen for code compliance + linked devices |
| Notes | **Notes & Media** | Free-form notes |

When the SelectionPill's "AI" button or "Link path" button opens a previously-distinct internal section, the tab strip highlights the parent tab so the user always knows where they are.

## 5. Canvas overlays (gated by engineering layers)

All overlays toggle via Layers panel → "Engineering layers" section. Defaults are quiet.

| Overlay | Default | What it shows | Gated by |
|---|---|---|---|
| FOV cones | On | Camera coverage cones (selected device's cone always shows) | `layers.fov` |
| Device labels | On | ID label under each device | `layers.labels` + `display.labelDensity` |
| Dimension chains | Off | Distance labels between adjacent cameras | `layers.dimensions` |
| Pathways | On | Cable run polylines | `layers.pathways` |
| Rooms | Off | Room outlines + names | `layers.rooms` (no painting yet) |
| NEC | Off | Compliance markings | `layers.nec` (substrate only) |
| Thermal | Off | Heat coverage map | `layers.thermal` (substrate only) |
| Bandwidth | Off | Data flow saturation | `layers.bandwidth` (substrate only) |
| Conduit IDs | Off | Pathway identifier labels | `layers.conduit_ids` (substrate only) |
| Presence cursors | Off | Live collaborator arrows | `layers.presence` |

## 6. Display preferences (Layers panel → Display section)

| Control | Options | Default | Persists? |
|---|---|---|---|
| Map mode | Blueprint / Satellite / Street / Hybrid / Dark / Blank | Blueprint | Per project |
| Icon size | Compact / Standard / Large | Standard | Per project |
| Label density | Hidden / Selected / Important / All | Important | Per project |
| Coverage opacity | 0 – 100 % slider | 80 % | Per project |

Note: **Street / Hybrid / Dark map modes render as Blank today** because the FloorPlan renderer hasn't been extended yet — the picker is honest about offering them; the renderer follow-up is the next pass.

## 7. Floating canvas controls

| Control | Location | Purpose | Disposition |
|---|---|---|---|
| Coverage mode switch | Top-left of canvas | Style of FOV cones (soft / heatmap / wireframe / …) | **KEEP** — works |
| Intelligence pill | Top-right | Toggle issue chips (overlap / blindspot / PoE / low-light) | **KEEP** — defaults to off |
| Focus toggle | Top-right (next to intelligence) | Hide chrome for a clean view | **KEEP** |
| Status bar | Top-center | Active tool + zoom + counts | **KEEP** |
| QuickTools | Bottom-center | Select / Pan / Measure / Wall | **KEEP** — Text and Comment removed (see audit row below) |
| Zoom dock | Bottom-left | Zoom in / out / fit | **KEEP** |
| MiniMap | Bottom-right | Mini canvas overview | **KEEP** |
| **Build stamp** | Bottom-left, above ZoomDock | Verify deployment freshness | **NEW** — `commit · build-date` |

## 8. Bottom toolbar (QuickTools) — tool-by-tool

| Tool | Hotkey | Behavior before | Behavior after | Disposition |
|---|---|---|---|---|
| Select | V | Selects + edits objects | Same | **KEEP** — tooltip clarified to differentiate from Pan |
| Pan | H | Pans the map | Same | **KEEP** — tooltip: "Pan the map · does not select" |
| Measure | M | Listed in palette, click was a no-op | **Now functional**: click first point, move cursor for live rubber-band, click second point to commit; ESC clears; double-click clears; distance chip in feet at midpoint | **KEEP** — fixed |
| Text | T | Listed in palette, no click handler | Removed from palette | **REMOVED** |
| Comment | N | Listed in palette, no click handler | Removed from palette | **REMOVED** |
| Wall | W | Click two points to draw a wall (only shown on blank base) | Same | **KEEP** |

## 9. Target simulation (canvas overlay)

| Element | Before | After | Disposition |
|---|---|---|---|
| Subject indicator | Filled cartoon head + body | Minimal stick figure (no face) | **REDESIGNED** |
| Detail panel | Synthetic portrait + "face clarity / prosecution" bars | Real DORI math: distance, off-axis, px/m, DORI band ladder (Detect ≥25 / Observe ≥63 / Recognize ≥125 / Identify ≥250 px/m), pixels-on-subject (face/body/height), operating conditions (sensor / HFOV / width-at-distance / px-ft) | **REDESIGNED** |
| "Simulated" badge | Implied | Explicit amber "Simulated" pill in the header + footer note "Computed from camera FOV + range. No video feed simulated." | **NEW** |

## 10. Compatibility validation

| Layer | Status |
|---|---|
| Rule engine (`src/app/lib/compatibility.ts`) | **DONE** — `canHost()` returns `{allowed, reason, hint, requires}` for door / IDF / floor hosts |
| Toast on device add (Sonner) | **DONE** — placing door-only hardware (strike / maglock / REX) directly on the floor surfaces a warning toast pointing the engineer to drag it onto a door instead |
| Drag-onto-host hit detection (drop a reader onto a door, get attached) | **DEFERRED** — hit-test wiring is its own pass |

## 11. Product database / schema

| Layer | Status |
|---|---|
| `Product` interface with manufacturer / category / cloud-or-on-prem / ONVIF / NDAA / PoE / mounts / accessories / pricing | **DONE** in `src/app/lib/productCatalog.ts` |
| Sample entries (32 representative SKUs across Verkada, Rhombus, Meraki, Axis, Hanwha, Avigilon, Bosch, HID, Openpath, Brivo, Mercury, LenelS2, Adams Rite, HES, Securitron, Von Duprin, Schlage, Aiphone, 2N, Cisco, Aruba, Ubiquiti, APC, Altronix, LifeSafety, Belden, Panduit, Corning) | **DONE** — labelled clearly as **sample catalog** in the schema's header |
| Filter by tech model (`productsFor()`, `isRecommended()`) | **DONE** |
| InsertDock surface using the catalog for recommended badges | **DEFERRED** to next pass |

## 12. Build stamp

| Element | Description |
|---|---|
| Vite define injection | `__APP_VERSION__`, `__COMMIT_HASH__`, `__BUILD_TIME__` injected at compile time via `vite.config.ts` |
| `src/build-info.ts` | Exposes `APP_VERSION`, `COMMIT_HASH`, `BUILD_TIME`, `buildLabel()` |
| Canvas footer badge | Discreet `commit · date time` in bottom-left, visible to verify the live Vercel deployment is fresh |

## 13. Not addressed this pass — explicit deferrals

These are real items in the brief. They will not be addressed by ignoring them; they're called out here so we can stage the next pass.

- **Drag-onto-host wiring** (drop a reader into a door) — rule engine is in, hit-detection is not.
- **Cable drawing as a first-class tool** — schema is in (composite / Cat6 / Cat6A / fiber / 18-2 / 22-6 / coax / OSP), but no drawing tool on the canvas yet.
- **Map mode rendering for Street / Hybrid / Dark** — picker shows them; FloorPlan still paints them as Blank. Either ship a tile provider or hide those options.
- **Object library expansion** — current library focuses on cameras / access / network. Doors-as-objects, intercoms, gates, elevators, sensors, racks need their own category entries in InsertDock.
- **Double-door / storefront / sliding / roll-up / vehicle gate** — DoorType already has these values in the schema; UI for picking is in the door drawer's Hardware section, but no first-class "place a double door from the library" action.
- **Undo / Redo wiring** — buttons present, no action history yet.

## Final commit info

Build stamp visible bottom-left of the canvas. Refresh the page after deploy to confirm.
