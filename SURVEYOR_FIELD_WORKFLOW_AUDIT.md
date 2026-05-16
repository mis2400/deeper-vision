# Surveyor Field Workflow Audit
_Pre-rebuild snapshot for the SURVEYOR FIELD WORKFLOW REBUILD — NO MORE PATCHES pass._

- Audited URL: https://deeper-vision-ashy.vercel.app/project/p6/canvas (also `/p1`)
- Local source: `src/app/screens/EngineeringCanvas.tsx` (~8000 LOC)
- Date: 2026-05-16

The audit walks the live surveyor against the user's 20-point list and
captures, for each item, what's broken / confusing / missing and what
this pass should do.

---

## 1 · Canvas size / floorplan fit

- **Current**: Canvas viewport is wide, but the floorplan SVG is drawn
  inside a fixed `0 0 1280 800` viewBox with the active background image
  pinned at `(80,80) 640×480`. Nothing auto-fits to the visible viewport,
  so on a 1440 viewport with the dock collapsed the actual plan content
  sits at ~50% of the visible area with empty dark space to the right.
- **What's broken**: No `Fit plan`, `Center plan`, `Actual scale`
  buttons. Zoom buttons exist but don't compute a fit.
- **Decision**: Add Fit / Center / Actual-scale buttons to the ZoomDock
  and an auto-fit on first mount or whenever the floor background or
  viewport size changes.

## 2 · View modes (Default / Field / Canvas)

- **Current**: `viewMode === 'default'` shows TopBar + LeftNavRail (56px)
  + InsertDock (48–320px). `viewMode === 'field'` hides BOTH side rails.
  `viewMode === 'canvas'` hides everything including TopBar.
- **What's broken**: The user explicitly said "When clicking Field /
  Canvas, the left toolbar disappears incorrectly." The current "left
  rail" is `LeftNavRail` (a project section nav), not a drawing toolbar
  — there *is no* drawing toolbar today. The brief calls for a black
  tool rail visible in Default + Field.
- **Decision**: Introduce a dedicated black **DrawingToolRail** that
  hosts Select / Pan / Measure / Wall / Door / Window / Text / Scale /
  Snap / Layers; it stays visible in Default + Field; Canvas mode shows
  a small "Tools" reopener.

## 3 · Left tool rail

- **Current**: The leftmost rail is `LeftNavRail` — 56px wide, holds the
  section switcher (Overview / Devices / Maps / Reports / Docs / …). It
  mixes navigation with what should be drawing tools.
- **Decision**: Keep the section switcher in Default mode but move the
  drawing tools into a separate dark tool rail mounted on the canvas
  pane. This rail is always visible whenever the canvas itself is
  (Default + Field; collapsible reopener in Canvas).

## 4 · Bottom cursor / hand / ruler toolbar

- **Current**: `QuickTools` capsule (Select / Pan / Measure / Cable /
  Wall) floats bottom-center.
- **Decision**: REMOVE this capsule and replace with a horizontal Bottom
  Device Bar. The tools (cursor / hand / ruler / wall) move into the
  black left tool rail.

## 5 · Bottom Device Bar — does not exist today

- **Current**: There is no bottom device bar. Devices are added via the
  collapsible 320px left InsertDock.
- **Decision**: Build a horizontal Bottom Device Bar with categories
  (Cameras / Access / Doors / Cabling / Conduit / Network / Power /
  Fire / Sensors / AV / Audio / Intercom / Infrastructure). Each
  category opens a tray above the bar with the placeable items.

## 6 · Device library cleanup

- **Current**: 13 vertical category rows + 10 group chip wrap inside the
  320px InsertDock. Reads as chip soup.
- **Decision**: Reduce to 8 cleaner top-level categories per the brief
  (Physical Security / Infrastructure / Network / IT / Cabling &
  Pathways / Power / Audio / Visual / Fire / Life Safety /
  Environmental). The InsertDock collapsed default stays; the dock is
  no longer the primary insert path — the Bottom Device Bar is.

## 7 · Object icons

- **Current**: `HardwareGlyph` uses thin-line architectural strokes
  (already good for cameras / doors / access / network). The shipping
  set is honest, but a few types (intrusion / sensors / power / cabling)
  fall back to lucide icons via `KIND_ICON`.
- **Decision**: Keep `HardwareGlyph` style; add thin-line plan glyphs
  for any new categories surfaced in the Bottom Device Bar.

## 8 · Object selection behavior

- **Current**: Compact SelectionPill (status / ID / type / Edit) +
  Expand menu. **Stacking on canvas does NOT work** — you can drop a
  reader from the library onto a placed door, but you cannot drag a
  reader already on the floor onto a placed door.
- **Decision**: Implement pickup-and-drop stacking on canvas. While
  dragging a device, detect a compatible host under the cursor and on
  release attach via the existing `canHost` rules.

## 9 · Right edit drawer (generic vs specific)

- **Current**: All devices get the same 12-tile grid (General /
  Placement / Coverage / Power / Network / Accessories / Compatibility
  / Notes / Media / History / Stack / AI). Bodies are conditional on
  `bodyShows(tab, key)` but the **tile set itself** is the same for a
  camera, a door, an IDF, and a cable.
- **Decision**: Make the tile set device-type aware (`tilesForKind`).
  Camera shows Coverage / Lens; Door shows Hardware Stack / Opening /
  Egress; IDF shows Rack / Switches / PoE; Cable shows Route / Fill etc.

## 10 · Category-specific edit panels

- **Current**: Body content is mostly generic. Coverage exists only
  on cameras (good). Door bodies show camera-style fields.
- **Decision**: Add type-specific section bodies per the brief
  (Door = Hardware Stack + Opening + Egress + Fire rating + ADA;
  IDF = Rack + Port schedule + PoE budget; Cable = Route + Fill).

## 11 · Drag/drop placement

- **Current**: Drag-from-library onto canvas works (with host-detection
  for stack hosts). Drag-from-canvas-to-canvas-host does NOT attach.
- **Decision**: Wire the existing `hoverHost` detection to the on-
  canvas drag path as well.

## 12 · Stack hardware onto hosts

- See #8 and #11. **Decision** = pickup-and-drop on canvas + visible
  stack count badge on the host glyph + drawer Stack section listing.

## 13 · Door + reader + strike + lock workflow

- **Current**: Door type exists (`acc.door` family). Stack types exist
  (reader / strike / maglock / REX / DPS / panic / closer / electrified
  hinge). Compatibility map in `lib/compatibility.ts`. Stack list lives
  on the device record under `stack[]`.
- **Decision**: Drawer "Hardware Stack" section on Door selection lists
  every attached component + an Add menu with the door-compatible
  hardware. Drag-and-drop on canvas wires up the same attach path.

## 14 · Cabling / conduit / pathway availability

- **Current**: Cable tool exists (`tool === 'cable'`) but is buried in
  the bottom QuickTools capsule. Cable type picker shows when cable
  tool is active. Pathway records live in the store. Conduit / pull
  box / cable tray are not surfaced as placeable categories.
- **Decision**: Cabling becomes a first-class Bottom Device Bar
  category with cable types (Cat6 / Cat6A / Fiber / 18/2 / 18/4 etc.)
  AND a Conduit category (EMT / PVC / FMC / cable tray / pull box).

## 15 · Cable drawing workflow

- **Current**: Click vertices → double-click / Enter to commit. Works.
  Type picker is a small capsule. No bundle visual.
- **Decision**: Keep the existing draw flow but surface it from the
  Bottom Bar Cabling tray.

## 16 · IDF home-run workflow

- **Current**: Does not exist. IDF/MDF devices exist but there is no
  "select N devices → Run to IDF" path.
- **Decision**: Add multi-select (shift-click) + a "Run to IDF" command
  that creates pathway records from each selected device to the chosen
  IDF and shows a bundle label.

## 17 · Non-working menu options

- **Current**: Many items in the library are placeable (cameras /
  access / doors / network / infra). Some types in `Other elements`
  section (Comment pin / Hazard area / AI suggestion zone) don't
  actually create entities yet.
- **Decision**: Hide every item that doesn't actually create a real
  entity. The Bottom Bar trays only show items that have a real
  `DeviceType` they can drop on canvas.

## 18 · Satellite / map view

- **Current**: Cleaned in the prior pass (SVG aerial + Simulated label).
- **Decision**: No change this pass.

## 19 · FOV / Coverage workflow

- **Current**: Coverage Overview / Prosecution sub-tabs exist (prior
  pass). On-canvas "Coverage check" card hidden by default.
- **Decision**: No change this pass.

## 20 · Report / export entry

- **Current**: ReportBuilderDialog (prior pass) reachable from TopBar
  overflow + Reports nav section.
- **Decision**: No change this pass.

---

## Decisions summary

1. **Auto-fit floorplan**: on mount, on background change, on viewport
   resize. Buttons: Fit / Center / Actual scale on the ZoomDock.
2. **Black DrawingToolRail** on the left of the canvas pane: always
   visible in Default + Field; Canvas shows a small "Tools" reopener.
3. **Bottom Device Bar**: horizontal strip with category icons + label;
   click to open a tray of placeable items above the bar.
4. **Remove the bottom QuickTools capsule**: tools move to the rail.
5. **On-canvas pickup-and-drop stacking**: drag a placed reader onto a
   placed door → attach via `canHost`. Stack count badge on the host.
6. **Category-specific drawer tiles** per device kind.
7. **Cabling as a category** in the Bottom Device Bar.
8. **Run-to-IDF** workflow on multi-select + bundle label.
9. **Conduit fill calculator** in Assist.

## Out-of-scope (explicit honesty)

- Full plan-grade icon redraw beyond the existing HardwareGlyph set.
- Real backend persistence for media uploads, change history, AI
  Assistant findings.
- Door schedule export beyond what the existing Reports module ships.
- The brief lists very long per-category tile lists; this pass adds
  the high-value differentiators per type, not every single field.
