# Surveyor UI/UX Audit
_Pre-redesign snapshot for the SURVEYOR UI/UX HARD RESET pass._

- Live URL audited: https://deeper-vision-ashy.vercel.app/project/p1/canvas
- Local file:       `src/app/screens/EngineeringCanvas.tsx` (~7800 LOC)
- Date:             2026-05-16
- Viewport:         1440 × 900, default theme (Dark Command), default project

The audit walks every visible affordance in the default `/project/:id/canvas`
state and records what it is, where it is, whether it works, whether it
adds noise, and what the redesign pass does with it.

---

## 1 · Top chrome (TopBar)

| # | Control | Location | Purpose | Works | Default? | Problem | Decision |
|---|---|---|---|---|---|---|---|
| T1 | Project crumb (Projects / Riverbend HQ / Canvas) | Top-left | Wayfinding | yes | yes | Fine; rarely used mid-survey | **Keep** |
| T2 | Floor dropdown (Ground floor) | Top-left after crumb | Floor switching | yes | yes | OK | **Keep** |
| T3 | Live status chip | Next to floor | Liveness indicator | static | yes | Decorative; no signal | **Hide** by default (debug only) |
| T4 | Snap toggle | Center-left | Toggle 20px snap | yes | yes | OK | **Keep** |
| T5 | Units toggle (ft / m) | Center-left | Switch units | yes | yes | OK | **Keep** |
| T6 | Plan source button | Center-left | Re-open Onboarding | yes | yes | Rarely needed; eats space | **Move** to overflow |
| T7 | Scan / Build button | Center | Open ScanBuild modal | yes | yes | Already prominent — good | **Keep**, promote color |
| T8 | THEME pill (Drafting / Slate / Dark) | Center | Theme picker | yes | yes | Three-button pill eats space; should be in overflow | **Move** to overflow menu |
| T9 | STACK pill (Cloud / On-prem / Hybrid) | Center | Tech-model picker | yes | yes | Doesn't visibly change product list; clutter | **Move** to dock header where it's contextual + add live counts |
| T10 | Avatars JS / MK / RT | Center-right | Presence (mock) | static | yes | Cute, irrelevant | **Hide** by default |
| T11 | View-mode picker (Default / Field / Canvas) | Right | Switch view modes | yes | yes | Three icons + labels = wide | **Keep**, compress labels |
| T12 | Fullscreen | Right | Browser FS | yes | yes | OK | **Keep**, move to overflow on small viewports |
| T13 | Pop out | Right | Open new window | yes | yes | Rarely used | **Move** to overflow |
| T14 | Run vision scan (Sparkles) | Right | Route to /visionscan | yes | yes | Duplicates Scan/Build entry | **Hide**; ScanBuild covers it |

### Net problem
Top bar carries ~12 controls and 2 segmented pills. Reads as a SaaS app, not a survey workspace.

### Net redesign
Reduce to ~6 visible items (crumb + floor, snap+units, Scan/Build, view picker) plus a single overflow menu (theme, stack, plan source, fullscreen, pop-out, presence).

---

## 2 · Left navigation rail

| # | Control | Location | Purpose | Decision |
|---|---|---|---|---|
| L1 | 56px icon rail (Overview / Devices / Maps / Reports / Docs / …) | Far left | Section switcher | **Keep**, but always 56px — never wider. Hide in Field & Canvas modes (already done) |

The rail itself is honest. The clutter comes from what the active section _renders_ (the giant 320px InsertDock when Devices is active).

---

## 3 · Insert dock (Devices section panel)

| # | Control | Location | Default? | Problem | Decision |
|---|---|---|---|---|---|
| D1 | 320px permanent panel | Left, after nav rail | yes | Eats 25% of width permanently — biggest cause of "canvas isn't the hero" | **Default to COLLAPSED** (48px icon rail) on first load |
| D2 | "Device library — 142 in hybrid stack" header | D1 top | yes | Fine when needed | Hidden when collapsed |
| D3 | Layers button | D1 top right | yes | OK | Move into collapsed rail |
| D4 | Search input | D1 | yes | Fine when expanded | Hidden when collapsed |
| D5 | Top-level group chips (All / Physical / Cyber / Infra / IT / AV / Fire / Building / Env / Power) | D1 mid | yes | 10 chips wrap to 2 rows; noisy | Keep when expanded; hidden when collapsed |
| D6 | 9–14 vertical category rows (Cameras / Access / …) | D1 main | yes | Always-visible; noisy | Keep when expanded |
| D7 | "Pick a category to browse" footer | D1 bottom | yes | OK | Keep when expanded |

### Net redesign
Default collapsed to 48px icon strip. **A floating "Add" FAB** at canvas
bottom-right opens the dock (or routes to Scan/Build for greenfield).

---

## 4 · Floating canvas overlays (always-on)

| # | Control | Location | Default? | Problem | Decision |
|---|---|---|---|---|---|
| F1 | Floorplan background controls (opacity / scale / rotation) | Top-left over canvas | yes when bg exists | Big rectangle in the middle of the work area | **Move** to bottom-left corner, smaller, collapsible |
| F2 | StatusBar (Select · 1 in = 10 ft · counts) | Top-center | yes | Tiny, fine | **Keep** |
| F3 | IntelligenceLayer "CHIPS" panel | Top-right | yes | Big floating chip stack; debug feel | **Hide** by default; reopen via top-bar overflow |
| F4 | "ASSISTANT" panel | Right edge | yes | Adds another always-visible card | **Hide** by default; reopen via overflow |
| F5 | TargetSimOverlay (auto-positioned stick figure) | Camera-relative | yes on camera select | Auto-pops on every camera select — interferes with simple selection | **Off** by default; opened only when Coverage tab active |
| F6 | Coverage Check / DORI floating card | Center over canvas | yes for camera | The classic "debug overlay" complaint | **Remove from canvas**; live in drawer Coverage tab only |
| F7 | QuickTools capsule (Select / Pan / Measure / Cable / Wall) | Bottom-center | yes | Honest; small | **Keep** |
| F8 | CableTypePicker (when cable tool active) | Bottom-center | conditional | OK | **Keep** |
| F9 | ZoomDock (100% / +/- / fit) | Bottom-left | yes | Fine | **Keep** |
| F10 | MiniMap "OVERVIEW" | Bottom-right | yes | Big — blocks edge devices | **Smaller** + collapsible |
| F11 | "Screen / Export PDF" buttons | Bottom-right, on minimap | yes | Duplicates report export workflow | **Move** to overflow / Reports |
| F12 | North indicator | Top-right under view bar | yes | Subtle, fine | **Keep** |
| F13 | Scale bar | Bottom-center | yes | Honest about calibration | **Keep** |
| F14 | Build stamp footer | Bottom-left | yes | Tiny, honest | **Keep** |
| F15 | Drag ghost | Pointer | conditional | OK | **Keep** |

---

## 5 · Selected-object UX

| # | Control | Behavior | Problem | Decision |
|---|---|---|---|---|
| S1 | SelectionPill (status dot · ID · type · Expand · Edit) | Already minimal (prior pass) | OK | **Keep** as-is |
| S2 | ExpandMenu popover (Duplicate / Color / Lock / Stack / More / Delete) | Already exists | OK | **Keep** |
| S3 | Auto-positioned TargetSimOverlay on camera select | **Auto-fires on every camera click** | Single click → cone + stick figure + multiple chips appear | **Don't auto-open**. Show only when entering Coverage edit mode |
| S4 | FOV cones drawn for selected device | Per-layer toggle exists but cones for selected always render | Click adds visual mass | Keep selected-only cone but **dim until Coverage mode** |
| S5 | Multisensor ring breath | Subtle animation | OK | **Keep** |
| S6 | Spotlight ring on selection | Soft drop-shadow filter | OK | **Keep** |

---

## 6 · Right drawer (EditDrawer)

| # | Control | State | Problem | Decision |
|---|---|---|---|---|
| R1 | 12-tile grid (General / Placement / Coverage / Power / Network / Accessories / Compatibility / Notes / Media / History / Stack / AI) | Done in prior pass | None | **Keep** |
| R2 | Header (id, kind, model, manufacturer) | Done | Compact + clean | **Keep**; add room/floor/zone line |
| R3 | Coverage tab body | Renders FOV controls + DORI + telemetry | Splits across tabs; the floating Coverage Check on canvas duplicates it | **Make it the only place FOV details live**; remove the canvas card |
| R4 | Drawer width 400px | Fixed | OK | **Keep** |
| R5 | Drawer opens via Edit button on pill | Works | OK | **Keep** |
| R6 | Section bodies (Media / History) | Placeholders with honest disclaimers | OK | **Keep** |

---

## 7 · Scan / Build / Maps workflow

| # | Control | Status | Decision |
|---|---|---|---|
| W1 | Scan/Build button (TopBar) | Done | **Keep**, promote color (already cyan) |
| W2 | Scan/Build modal — 4 options | Done | **Keep** |
| W3 | Maps panel — primary CTA | Done | **Keep** |
| W4 | Add Building / Add Floor dialogs | Done | **Keep** |
| W5 | Import Floorplan dialog | Done | **Keep** |
| W6 | "Draw from scratch" tools menu | Wall tool armed via Scan/Build; no contextual side-menu for room/door/window/stair | ⚠️ **Add** a Draw-from-scratch tool group in Field mode |

---

## 8 · Visual system

| Theme | Default? | Problem |
|---|---|---|
| Dark Command | YES | App reads as "all black"; #07111f canvas dominates; user explicitly says "must no longer feel all black" |
| Slate Engineering | no | Solid mid-slate; better default |
| Light Drafting | no | Warmest |

### Decision
**Default theme switches from Dark Command → Slate Engineering** on first load.
Persisted choice still wins for return users.

---

## 9 · Cloud / On-prem / Hybrid

| State | Visible feedback today |
|---|---|
| Cloud | Picker highlights "Cloud"; library secretly filters in-stack products | 
| On-prem | Same | 
| Hybrid | All products shown |

### Problem
The pill is in the TopBar but no number or visible delta tells the engineer
"you just hid 60 products" — looks like a no-op. The audit confirms the
under-the-hood filter is correct (`productMatchesTechModel`); the UI does
not surface it.

### Decision
- Move the picker to the Dock header so it sits over the product list.
- Add live counts: `Cloud · 24 in stack · 118 hidden`.
- Show a small banner inside the product list when filter is active.

---

## 10 · Reports

| # | Control | Status |
|---|---|---|
| RP1 | "Export PDF" floating button on minimap | Duplicates Reports section; **move** to overflow |
| RP2 | Reports nav section → 8 export rows | Honest; works | **Keep** |

---

## Summary of decisions

- **Default theme**: Slate Engineering (not Dark Command).
- **Default dock**: collapsed 48px icon rail; floating Add FAB opens it.
- **TopBar**: compress to ~6 essentials + single overflow menu.
- **Selected camera**: stop auto-popping the stick-figure target.
- **FOV**: lives in the drawer's Coverage tab only — no canvas card.
- **Cloud/On-prem/Hybrid**: counts on the dock header; small banner.
- **Floating overlays**: hide CHIPS, ASSISTANT, OVERVIEW minimap, Screen/Export by default; available via overflow.
- **Floorplan controls**: move to corner, smaller.
- **Audit doc**: this file is the artifact required by the brief.
