# Canvas V3 — verification record

This doc captures the audit findings + acceptance evidence for the
Canvas V3 sub-passes that shipped in the autonomous batch
(V3.1, V3.2, V3.7, V3.8, V3.9, V3.10, V3.11, V3.12, V3.14). The
aesthetic-judgment-heavy sub-passes (V3.3, V3.4, V3.5, V3.6, V3.13)
are paused awaiting check-in.

## V3.1 — Dead control census + fixes

Exhaustive Explore-agent walk over 9 canvas surfaces, 89 interactive
elements catalogued. Prior SC passes had already honored the
no-dead-controls contract on nearly all of them.

Real defects found:

- **`pill-expand-stack` routed to the wrong tab.** Opened `compliance`
  instead of `linked` (the actual stack / assembly section). Fixed in
  commit `af768559`.
- **Stack item shown on non-stackable devices** (cameras, isolated
  sensors). Now gated on `isStackableHost(d.type)`. Same commit.
- **"More details" item duplicated the pill's Edit button.** Both
  opened the drawer at the Overview tab. V3.1 removed it as a
  duplicate; V3.2 restored it per the V3 spec's explicit listing
  (it's the menu-level equivalent for operators who reach for the
  menu before the button).

DOCUMENTED items retained with honest copy:

- Wall tool panel — type / fire-rating / orthogonal-lock note
  ("controls ship with the wall schema bump"). Schema work is out
  of scope for the UX pass.
- IntelligenceStatusPill — gated by feature flag in the AI Assistant.

## V3.2 — Selected-object pill rewrite

The pill body now contains exactly five elements per Mohammad's
original spec: status dot, object ID, object type, Expand, Edit.

Per-element disposition for everything previously in the pill:

| Element | Disposition | Rationale |
|---|---|---|
| MultisensorLensChips strip | MOVED to drawer | Drawer's Coverage section already has identical inline chips bound to the same `activeLens` + `lensMode` state. The pill's copy was a duplicate from V2's HUD pattern. Component declaration deleted (~80 LOC). |
| Duplicate button | MOVED to Expand menu | Lock-state styling carries through (muted + disabled handler when locked). |
| Lock / Unlock toggle | MOVED to Expand menu | Label flips with state; always interactive so the operator can unlock a pinned device. |
| Delete button | MOVED to Expand menu | Destructive tone preserved. Disabled when locked. |
| Per-kind toolbar action arrays (rotate / FOV / target sim / AI optimize / link path / hardware / electrify / egress / switches / PoE / bend / pull box / etc) | REMOVED ENTIRELY | Were never rendered after the V3.1 audit; sat in `actions`, `primaryActions`, `overflowActions` arrays that no JSX consumed. Deep-dive editing surfaces live in the drawer. |
| focal / doriRange / DORI band overlay | REMOVED | V3 spec: "no FOV summary, no DORI band, no AI chips, no coverage card, no telemetry" in the pill. Lives in the drawer Coverage section. |
| Read-only Stack popover (bottom chip listing mounted accessories) | REMOVED | V3 spec: "no stack details" in the pill. The Expand menu's Stack item routes to the drawer's linked tab where stack edits actually happen. |

Browser verified live: 2 buttons in the pill body for both camera
and door selections; Expand menu has 5 items on camera (no Stack)
and 6 items on door (with Stack). Lock click disables Duplicate +
Delete with correct hover titles.

## V3.7 — Tool rail discipline

Rail already met the V3 standard (slim, black, vertical, icon-first,
working tools only — Select / Pan / Measure / Wall / Room / Annotate
/ Layers / Map; zero coming-soon tools in the visible rail). Two
cleanups:

- Removed the unreachable `panelId === 'snap'` branch in
  `ToolPanelBody`. The Snap tile was dropped from the rail a while
  back (duplicate of the wall-panel and top-bar overflow snap
  toggles), leaving the body unreachable.
- Tightened the wall panel's deferred-control note into a chip-style
  DOCUMENTED treatment ("Wall type, fire-rating, and orthogonal-lock
  land with the wall schema bump"). The visible affordance is honest
  about what's not wired today.

## V3.8 — Bottom dock polish

Bottom device bar already passes the V3 spec on the substantive
items (category strip, sub-tabbed Cable + Conduit trays per the
consolidated doc, Esc + outside-click + drag-start dismiss,
no dead items). One small polish: `GripVertical` icon next to "Drag
or click to place" on main product cards for clearer drag affordance.

## V3.9 — Motion discipline

Three concrete removals on the live render path:

- **Multisensor "breathing ring"** around the selected camera body
  (a 3.2s `ease-in-out infinite` opacity loop). Per V3 brief:
  "Selection: precise ring or stroke, no halo or glow." Consumer-SaaS
  warmth, not Bluebeam restraint.
- Dead `glow-breathe` keyframe (only consumer was the breathing ring).
- Dead `scan-sweep` keyframe (zero consumers in rendered code).
- Dead `lens-chip-in` keyframe (only consumer was the pill-side
  MultisensorLensChips strip that V3.2 deleted).

Kept (function-serving, in spec):

- `pill-in` (180ms ease-out 4px lift) — positional cue tying pill to
  its device anchor; not overshoot.
- `soft-fade-in` (200ms opacity) — selection-ring appearance.
- `presence-pulse` — collaborator-cursor liveness signal.
- `cubic-bezier(0.22, 1, 0.36, 1)` decelerate easing on drag-move /
  drawer-slide / lens-preset card hover. Calm decelerate, not bouncy.

Dead-code paths with bouncier motion (orphaned `InsertDock` and
`QuickTools` components) were left in place — declared but never
mounted, so they don't reach the user. A future dead-code pass will
remove the orphan components entirely.

## V3.10 — Typography + color tightening

SC.7.4 already swept the bulk legacy half-pixel typography (414
sites of `text-[10.5px]` / `text-[11.5px]` / `text-[12.5px]`
collapsed onto chrome scale). V3.10 audited the canvas-scoped
residue and applied the "document and defer per element rather
than blanket-replacing" rule from the V3.10 watch.

Residue retained with inline documentation:

- 9 sub-chrome half-pixel sites (`text-[8.5px]` / `text-[9.5px]`)
  in dense HUD chips — DeviceMicroHUD DORI bands, CoverageHUD mode
  labels, ProjectStateMenu chip captions, scale-bar readouts.
  All sit BELOW the smallest chrome token (--chrome-2xs = 9 px)
  by design; rounding regresses dense-surface legibility.
- 2 inline hex colors: `#0B0F19/95` on the slim tool rail body and
  `#0B1220/95` on the DeviceMicroHUD popover. Both are intentional
  design-intent darks that explicitly do NOT theme-follow — the
  rail is a black slab regardless of theme so it reads as a
  separate technical layer.

## V3.11 — Map modes + compass + scale bar

Audit confirmed all six `BaseMapMode` values render distinct surfaces
(`blueprint` / `satellite` / `street` / `hybrid` / `dark` / `blank`).
Each non-blueprint, non-blank mode carries a `SimulatedMapBadge` —
honest about not hitting a live tile provider. Compass is a fixed
canvas-up = North indicator (no fake calibration-driven rotation).
Scale bar reads `floor.calibratedAt` and switches between a green
"Verified" badge and an amber "Default scale" + Set-scale CTA.

## V3.12 — Object expand menu real wiring

V3.2 wired Duplicate / Color / Lock / Stack / More details
end-to-end. V3.12 closed the remaining gap: pill-menu Delete now
warns when the selected device has linked records (stacked
accessories, linkedIds, attached pathway, reverse references from
other devices). Native confirm dialog lists the breakdown and gates
the deletion on an explicit OK. Devices with zero dependents delete
inline as before. Undo (Cmd+Z) is unchanged — the canvas history
system captures every `setDevices` mutation.

The keyboard delete shortcut (Delete / Backspace) deliberately
stays inline — power users wiring out a draft don't want a confirm
mid-flow. Both paths land in the same undo stack.

## V3.14 — Verification harness

`scripts/canvas-v3-verification.mjs` prints a six-step paste-into-
DevTools harness covering pill body integrity, camera / door menu
contents, lock-state gating, cone calibration regression
(SC.7.1), and a dead-control sweep across the visible canvas
surface. Each assertion verified live during the sub-pass commits.

## Paused for check-in (awaiting Mohammad)

The remaining V3 sub-passes are the aesthetic-judgment-heavy ones
flagged in the batch plan:

- **V3.3** — Right drawer redesign. The drawer is hundreds of LOC
  with shared sections (General / Accessories / Suggestions / Notes
  / Media / History / BOM contribution / AI Assist) plus category-
  specific sections per device type. Foundational for V3.4 + V3.5.
- **V3.4** — Camera drawer specifically. 12 sections × real wiring
  against the device state model. Largest of the heavy sub-passes.
- **V3.5** — Coverage / FOV experience like Axis Site Designer.
  Target simulation with live degradation, Overview / Prosecution
  sub-modes, multisensor presets + overlap heatmaps.
- **V3.6** — Custom technical icon set (~40 architectural-quality
  inline SVGs). Aesthetic judgment heavy.
- **V3.13** — Mobile canvas polish. Requires real device testing.
