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
