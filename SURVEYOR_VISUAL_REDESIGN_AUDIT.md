# Surveyor Visual Redesign — Audit
_Pre-redesign snapshot for the SURVEYOR VISUAL REDESIGN — ACTUAL UI/UX TRANSFORMATION pass._

- Audited URL: https://deeper-vision-ashy.vercel.app/project/p6/canvas
- Local dev:   http://localhost:5173/project/p6/canvas
- Date:        2026-05-16
- Viewport:    1440 × 900
- Theme:       Slate Engineering (default after prior pass — still reads as dark)

Before screenshots → [`docs/surveyor-visual-redesign/before/`](docs/surveyor-visual-redesign/before/).
After screenshots will land in [`docs/surveyor-visual-redesign/after/`](docs/surveyor-visual-redesign/after/).

---

## What still looks dated

| Surface | What's wrong | What changes this pass |
|---|---|---|
| Canvas background | Mid-slate `#2A3548` reads as "dark prototype" — the floorplan sits inside a coloured void | Default theme switches to **Light Drafting** (off-white drafting paper) — store default + persist migration to v4 |
| Floating panels | Translucent dark glass blur — premium-but-cyber, not premium-engineering | Light: white cards + 1px borders + soft shadow tokens already in theme.css |
| Bottom device bar | Card + backdrop-blur read as floating chrome, not a tool palette | Pinned chrome surface with 1px top border; per-tile underline active-state |
| ZoomDock + tools capsule | Three separate floating chrome elements compete for the corner | Keep ZoomDock; tools moved to the left rail (already done); polish radii + shadows to match |

## What looks cartoonish / fake

| Surface | What's wrong | What changes this pass |
|---|---|---|
| Plotted camera / door / IDF glyphs | Filled tone circle backdrop + simplified body — reads as "kid's diagram" | New `SurveyorSymbols.tsx` with technical plan-symbol shapes (security-plan-style camera triangles, double-door swing arcs, IDF rack outline). HardwareGlyph now consumes these. |
| Cable accessory glyphs (jack / coupler / patch panel) | Small but still encased in a tone circle | Symbols render without the tone halo — match plan-symbol aesthetic |
| Bottom bar category icons | Lucide multipurpose icons (Video / DoorOpen / Cable) — feel generic | Same Lucide bases retained for category nav (intentional — they read as nav, not as plotted objects); plan-symbol icons reserved for the canvas |

## What looks too dark

The whole surface reads dark. Slate canvas + dark drawer + dark dock + dark
floating panels stack until the visible UI is overwhelmingly dark navy.

- **Default theme** moves to **Light Drafting** so off-white dominates.
- **Floorplan paper** uses a true off-white with charcoal linework.
- **Tool rail** stays black/charcoal — the contrast against the light canvas
  makes it read as a real tool palette (vs. dark-on-dark in slate mode).

## What looks cluttered

| Surface | Clutter source | Fix |
|---|---|---|
| Top of canvas | StatusBar pill (`Select · 1 in = 10 ft · counts`) duplicates info | Keep but quieter visual weight |
| Inspector dock | "Device library · 142 in stack · 13 categories" + chip soup + stack picker + 13 category rows when expanded | Default = collapsed dock (already shipped); polish the icon-rail's resting state to feel intentional |
| Right edge | North indicator floats separately from the scale | Group both into a single bottom-right unit |
| Bottom bar | 11 categories at once with mixed-weight labels | Visual rhythm: equal width, single-line truncation, underline active state |

## What looks like a prototype

- **Floating "More" overflow menu** is a small chevron icon next to the user — reads "settings". Move look toward a real menu button with clear iconography.
- **Build stamp footer** at bottom-left has good intent but ships at 8.5px which reads as debug text. Bump to 10px, keep dim.
- **Pop-out tab** opens a duplicate window via window.open — works but presents as a generic browser button. Keep but tone its visual weight down (it lives in the overflow menu in this pass).

## Decisions

1. **Light Drafting default theme** (persist migration v3 → v4 rewrites slate → light).
2. **New `SurveyorSymbols.tsx`** under `src/app/components/canvas/` with thin-line plan-symbol SVGs for camera (dome / bullet / turret / PTZ / multisensor / fisheye / LPR), access (reader / keypad / strike / maglock / REX / DPS / panic / controller), infrastructure (single / double / storefront / sliding doors / gate / window / elevator), network (IDF / MDF / rack / switch / patch panel / NVR / UPS), cabling (cable run / bundle / conduit / pull box / J-hook / cable tray / coupler / jack / firestop sleeve), power (PSU / transformer / battery / PoE injector).
3. **HardwareGlyph rewired** to consume `SurveyorSymbols` and drop the filled-tone halo so plotted objects look like a plan.
4. **Left toolbar expand-on-click panel** with tool name + shortcut + description + tool-specific options.
5. **Polish pass on right drawer** spacing + header.
6. **After screenshots** prove the change.

## Out of scope (explicit honesty)

- Full polish of cable / conduit drawer body cards — typography sweep, not a structural redesign.
- Brand-new button system — instead, the existing DV primitives (`components/ui/dv.tsx`) get applied to the canvas overflow + tool rail.
- New light-mode palette for *every* surface in the app beyond the canvas + drawer + bottom bar (those are the surveyor-visible surfaces).
