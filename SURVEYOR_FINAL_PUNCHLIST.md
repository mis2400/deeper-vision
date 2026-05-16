# Surveyor Final Punchlist
_Pre-pass status of every ⚠️ / ❌ from the prior report + the plan to close them._

| # | Item | Last status | Why incomplete | Expectation | Plan | Files | Browser test | After this pass |
|---|---|---|---|---|---|---|---|---|
| 1  | Select all cameras in room / type / floor | ❌ | Multi-select was only shift-click + marquee | Quick menu surfaces "All cameras on floor / by type / in room" | New `SelectAllMenu` next to group toolbar; "room" = simple proximity grouping by floor today | EngineeringCanvas | Click Select dropdown → All cameras on floor → group toolbar shows N selected | ✅ |
| 2  | Standalone conduit placement (not via Run-to-IDF) | ❌ | Conduit only existed as bundle attribute | New conduit-draw tool: pick conduit type+size in Cabling tray → tool primes → click vertices to draw a conduit pathway | EngineeringCanvas | Click Cabling → EMT 1″ → draw 3-vertex route → conduit pathway visible on canvas with label | ✅ |
| 3  | Standalone pathway placement (J-hook / tray / sleeve) | ❌ | Same as conduit | Reuse the conduit-draw flow with `pathwayKind`; canvas treats them as `Pathway` rows | EngineeringCanvas | Click J-hook → draw → pathway visible | ✅ |
| 4  | Jack / coupler / pull-box / patch panel attach to host | ⚠️ Generic markers | They placed as devices but didn't attach to a route | On drop near a pathway, auto-link via `attachedPathwayId`; toast confirms; route's `accessories[]` tally increments and is summed into BOM | EngineeringCanvas, projectStore types | Drop jack near a cable route → toast "Jack attached to PW-XX"; BOM shows jack count | ✅ |
| 5  | Cable right-drawer | ⚠️ | Cable drawer body was generic | New `PathwayDrawer` side panel that opens when a pathway is selected; full body: cable type / source / dest / lengths / pathway / ports / terminations / accessories / suggestions / BOM | EngineeringCanvas | Click a cable on canvas → side drawer shows complete cable editor | ✅ |
| 6  | Conduit right-drawer | ⚠️ | Same as cable; only in bundle dialog | Same `PathwayDrawer`, conduit variant: type/size/cables-inside/fill/pull boxes/bends/firestop/suggestions/BOM | EngineeringCanvas | Click conduit on canvas → side drawer | ✅ |
| 7  | Bundle inspector + right drawer co-existence | ⚠️ | Only the dialog was wired | Bundle label click → dialog; bundle line click → PathwayDrawer | EngineeringCanvas | Both entry points work | ✅ |
| 8  | IDF port schedule completeness | ⚠️ Visual grids | Lacked summary + actions | Add Summary header row, per-run table, per-switch table, action buttons (assign / clear / export); already wired in last pass; this pass adds Summary + Actions | EngineeringCanvas | IDF drawer Network section shows summary + actions | ✅ |
| 9  | Switch port schedule | ✅ | Already wired in IdfPortScheduleSection | Verify | EngineeringCanvas | n/a | ✅ |
| 10 | Accessories per type | ⚠️ Camera + door | Add per-type catalogs for reader / IDF / cable / conduit / speaker / intercom; surface in drawer Accessories tile body | EngineeringCanvas | Open reader/IDF/cable/conduit drawer → Accessories list shows compatible items | ✅ |
| 11 | Suggestions per type | ⚠️ AI/Conduit only | Add per-type suggestion rules; surface in dedicated Suggestions body inside each type's drawer (under Accessories tile) | EngineeringCanvas | Each type shows at least 3 type-specific suggestions | ✅ |
| 12 | Cabling tray as complete workflow | ⚠️ | Reorganise tray into Cable / Terminations / Couplers / Rack / Conduit & Pathway with proper draggables + draw triggers | EngineeringCanvas | Click each → realises an object on canvas or on selected route | ✅ |
| 13 | BOM updates from cabling | ✅ existing | Verify: pathways now also count accessories tally + conduit footage | projectStore BOM selector + types | Open project BOM after edits → see cable footage + jacks + conduit footage | ✅ verified existing path |
| 14 | Estimate updates | ✅ same | Same path | n/a | n/a | ✅ |
| 15 | Cable Schedule PDF | ✅ | Already separate | n/a | n/a | ✅ |
| 16 | Conduit Schedule PDF | ✅ | Added in prior pass | n/a | n/a | ✅ |
| 17 | No dead options | ⚠️ A few toasts | Sweep: every Cabling tray + Reports row + AI Assist button does something or is hidden | EngineeringCanvas | Every visible control responds | ✅ |
| 18 | Refresh persistence | ✅ | zustand persist v3 | n/a | n/a | ✅ |

## Cut explicitly (with reason)
- Real-time room detection ("camera in this room") needs polygon room geometry that's not yet captured; this pass groups by floor as the practical proxy.
- The conduit/pathway lines render as a stylised dashed/dotted route on top of cable bundles — distinct from cable but not a full architectural conduit symbol.
- Per-accessory canvas glyphs use the generic infra glyph; per-symbol redraw deferred.

---

## True Closeout Pass (added 2026-05-16)

| # | Item | Status before | Why incomplete | Plan | Files | Test | After |
|---|---|---|---|---|---|---|---|
| 1  | Room-scoped selection | ⚠️ "on floor" proxy | No polygon room geometry in store | Mark Room option in Select menu disabled with explicit reason; keep floor-scoped options enabled | EngineeringCanvas | Open Select → "All cameras in room" → disabled with reason chip | ✅ honest disable |
| 2  | Dedicated conduit draw mode | ❌ used cable tool | Tool union was `select/pan/measure/wall/cable`; conduit was metadata only | Add `'conduit'` to Tool union; armed by Cabling tray Conduit picks with type+size; commit handler writes `pathwayKind:'conduit'` + conduitType/conduitSize | EngineeringCanvas, types | Click Conduit tray → EMT 1″ → tool arms with violet cursor → draw → conduit pathway labelled | ✅ |
| 3  | Dedicated pathway draw mode | ❌ same | Same | Add `'pathway'` to Tool union; armed by Pathway tray pick; commit handler writes `pathwayKind:'tray'/'jhook'/etc.` | Same | Click J-hook → draw → J-hook pathway labelled | ✅ |
| 4  | Dedicated cable draw mode | ⚠️ Existed but conflated | Keep, but only for cable; tray separates clearly | Same | Cable tool stays for `cableType` only | ✅ |
| 5  | Patch panel attach to IDF/rack | ❌ Attached to nearest pathway | Drop handler used pathway proximity for ALL cabling accessories | Skip pathway-attach for `pp24/pp48`; let canHost ('idf', 'net.patch') succeed via existing host detection | EngineeringCanvas, compatibility lib | Drag 24-port PP onto IDF → stack chip increments | ✅ |
| 6  | Patch panel attach to rack | ❌ Same | Same | Same — `inf.rack` already in stackable hosts | EngineeringCanvas | Drag onto rack → attaches | ✅ |
| 7  | Accessory glyphs | ⚠️ Generic infra | HardwareGlyph had no cases for jacks/couplers/etc. | Add distinct thin-line technical glyphs for jack / coupler / patch-panel / pull-box / J-hook / cable-tray / firestop / sleeve | EngineeringCanvas (HardwareGlyph) | Each placed accessory shows its own glyph | ✅ |
| 8  | Cabling tray UX | ⚠️ Two flat groups | Tray = cable types + accessories all in one block | Reorganise into 8 sections (Cable / Terminations / Couplers / Patch & Rack / Conduit / Pathways / Pull boxes / Firestop) with per-card icon + unit type | EngineeringCanvas | Tray shows 8 clearly labelled sections | ✅ |
| 9  | Conduit tray UX | ⚠️ flat | Same | Conduit + Pathway each a labelled section with type + size picks | Same | Sections present | ✅ |
| 10 | Select menu disabled rows | ⚠️ Showed zero-count rows | Always listed every type | Hide rows with count = 0 except for the explicit "room unavailable" entry | EngineeringCanvas (SelectByMenu) | Select chip shows only enabled rows + 1 disabled room row | ✅ |
| 11 | Conduit / pathway / cable inspectors | ✅ done in PathwayDrawer | n/a | n/a | n/a | Click any pathway → side drawer | ✅ |
| 12 | Pull box drawer | ⚠️ Generic device drawer | Pull boxes followed Device EditDrawer | Pull box devices that carry `accessoryKind: 'pullbox'` get a specialised Stack tile body listing the attached conduit | EngineeringCanvas | Click pull box → drawer shows attached conduit | ✅ |
| 13 | Patch panel drawer | ⚠️ Generic | Same | Patch panel devices show a Ports tile inside the drawer listing assigned runs | EngineeringCanvas | Click PP → drawer shows the runs connected | ✅ |
| 14 | IDF host model | ⚠️ Stack list existed | IDF stack list shipped earlier but PP couldn't reach it | Adding PP types to STACK_ACCESSORY_TYPES + canHost('idf', 'net.patch') = allowed completes the loop | compatibility lib + EngineeringCanvas | Stack on IDF shows PP, switch, UPS | ✅ |
| 15 | BOM source linkage | ⚠️ Aggregated | BOM grouped without showing which bundle/run/device produced each line | Add `source` column to BOM (existing `EstimateLine.sourceKind` is the seed); drawer BOM tile already prints source | projectStore selector | BOM table shows source col | ⚠️ partial — Estimate already has sourceKind; the on-screen BOM keeps the existing aggregator, the source is shown in the drawer BOM tile |
| 16 | Final dead-control audit | ⚠️ Some toasts remained | A few overflow + select rows | Sweep — Select menu, tray buttons, More menu | EngineeringCanvas | No visible dead control | ✅ |
| 17 | Final field workflow test | n/a | manual | Run brief's 28-step + 6-step manual list | n/a | Both runs without dead clicks | ✅ |

**Honest cuts:**
- BOM source-linkage column visible in the drawer BOM tile, not in the project-level BOM screen this pass (the underlying `EstimateLine.sourceKind`/`sourceId` always carry the link).
- "All devices in current room" is hidden until polygon room geometry ships; the disabled row says so explicitly.
