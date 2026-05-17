# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Deeper Vision** — a physical-security engineering / field-survey OS for low-voltage integrators. The live app is https://deeper-vision-ashy.vercel.app/ . The package name (`@figma/my-make-file`) is left over from the original Figma Make scaffold; ignore it.

Single-page React app, no backend — everything persists to `localStorage` via a versioned Zustand store. There are no real users, services, or APIs; the live URL is the dev's verification surface.

## Commands

```bash
npm run dev          # Vite dev server (port 5173)
npm run build        # type-checks via vite-plugin-react + builds → dist/
```

There is **no `test`, `lint`, or `typecheck` script**. Type errors surface during `npm run build`; if a change compiles there, it'll deploy.

### Deploy ritual

`vercel.json` is configured to **deploy the committed `dist/` directly** (`buildCommand: "echo skip-build-using-prebuilt-dist"`). So every shipped change is two commits:

```bash
git commit -m "feat: ..."                   # 1. source change
npm run build                                # 2. produce new dist/
git add dist && git commit -m "build: dist with <short-sha> stamp (...)"
npx vercel deploy --prod --yes               # 3. ship
```

Vite injects `__APP_VERSION__` / `__COMMIT_HASH__` / `__BUILD_TIME__` via `define` (see [`vite.config.ts`](vite.config.ts)); the canvas's bottom-left footer renders this so you can verify the live build isn't stale Vercel cache. `VERCEL_GIT_COMMIT_SHA` env var wins over local `git rev-parse` when present.

## Architecture

### Top-level layout

- [`src/app/App.tsx`](src/app/App.tsx) — `BrowserRouter` with ~40 routes, one per screen, plus the always-mounted `ThemeProvider` (mirrors `useProjectStore(s.canvasTheme)` onto `<html data-theme>`), `PdfExporter`, `ShortcutOverlay`, and `Toaster`.
- [`src/app/screens/`](src/app/screens/) — one file per route. Most are 200–800 LOC; **`EngineeringCanvas.tsx` is ~11k LOC** and is the heart of the product.
- [`src/app/components/`](src/app/components/) — `AppShell`, shared chrome, plus `components/ui/` (shadcn primitives) and `components/ui/dv.tsx` (Deeper Vision primitives — `DvButton`, `DvCard`, `DvPill`, `IntegrationCard`, …).
- [`src/app/components/canvas/`](src/app/components/canvas/) — canvas helpers. The key one is `SurveyorSymbols.tsx` (technical plan-symbol SVG library).
- [`src/app/lib/`](src/app/lib/) — `compatibility.ts` (which devices can host which — door / IDF rules), `productCatalog.ts` (SAMPLE_PRODUCTS), `floorplanImport.ts` (PDF/PNG → floor background), `engineering.ts`.
- [`src/app/lifecycle/`](src/app/lifecycle/) — project-phase state machine (`phases.ts`).
- [`src/styles/theme.css`](src/styles/theme.css) — design tokens for Light Drafting / Slate Engineering / Dark Command themes. Theme switches via `data-theme` attribute.

### Single store

[`src/app/store/projectStore.ts`](src/app/store/projectStore.ts) — one Zustand store under persist key **`deeperVisionStore` version 5**. Every screen reads from it; there are **no local SEED arrays** users can edit. State shape lives in [`src/app/store/types.ts`](src/app/store/types.ts).

**Persist migrations** are how visual-system defaults reach existing users. Example: the v3 → v4 migration rewrites `canvasTheme: 'slate' | 'dark'` to `'light'` so users see the redesigned default. The v4 → v5 migration adds the empty `surveyItems` slice and corrects any pre-fix `floor.scalePxToFt > 1` value back to ft-per-px (the field is "1 px = X ft", not the inverse). If you change a meaningful default, bump the version + add a migrate step rather than relying on first-time-user state.

Key entity types worth knowing:
- `Device` — anything plotted on the canvas. Carries `stack: string[]` (legacy attached accessory ids on a host), `attachedPathwayId` (when a jack/coupler/pull-box auto-attached to a route), and `accessoryKind` for cable accessories. For door-class devices (`inf.door*` / `inf.gate*` / `inf.storefront*` / `inf.doubledoor*`) the **persisted door hardware schedule** lives on the device itself: `doorAssembly: DoorHardware[]` plus `doorElectrification` (`fail-safe` / `fail-secure`) and `doorReaderLocation` (`mullion` / `wall`). A device's headline survey state is `surveyStatus` (`todo` / `verified` / `issue` / `skip`).
- `Pathway` — cable runs, conduit, J-hooks, trays, sleeves. Distinguished by `pathwayKind`. Bundles share a `bundleId`. Conduit fields: `conduitType` + `conduitSize`. Termination fields: `patchPort` + `switchPort`. Accessory tally: `accessories: Partial<Record<'jack'|'coupler'|...,number>>`.
- `SurveyItem` — object-linked field note or checklist item. Each one carries `objectType` (`device` / `door` / `pathway` / `idf` / `floor`) + `objectId` + `text` + `status` + `author` + timestamps. Photo metadata persists as a `SurveyPhotoPlaceholder` (filename + size only — actual blob upload is still pending; UI labels it as such). Rendered in the EditDrawer's Survey tile and the PathwayDrawer's Notes sub-tab via `SurveyPanel`.

### Engineering Canvas — the surveyor

Layout rules are **non-negotiable** (the user has restated these many times):

- **Left side = tools only.** The slim black `DrawingToolRail` is the only thing on the left. No device categories ever go here. Tools: Select / Pan / Measure / Wall / Snap / Layers / Map + "More" tile for coming-soon. Clicking a tool opens a 260px side panel with tool-specific actions (Fit/Center/Actual for Pan, "All cameras on floor" buttons for Select, Scan/Build launcher for Map, etc.).
- **Bottom = devices/equipment only.** `BottomDeviceBar` carries 13 categories: Cameras · Access · Doors · Cabling · Conduit · Network · Power · Intercom · Audio/PA · Intrusion · Fire · Sensors · Infrastructure. Each opens a tray above the bar. Cabling + Conduit have hand-written tray bodies; the others use a 4-col product card grid driven by `PRODUCTS` filtered by `types`.
- The old `LeftNavRail` (project section nav) and `InsertDock` (device library) are **not mounted** on the canvas page — they exist in code but are gated off.

**Plotted glyphs**: `HardwareGlyph` checks `SURVEYOR_SYMBOL_HAS(type)` and prefers the technical plan-symbol from `components/canvas/SurveyorSymbols.tsx` (monochrome, `currentColor`, 24×24 viewBox). A legacy per-type SVG branch is kept as fallback.

**Internal tool state vs. UI**: `tool === 'cable'` / `'conduit'` / `'pathway'` exists as a `Tool` union value so the engine can route vertex clicks correctly, but **Cable / Cabling / Conduit are not visible as left-rail items**. They're armed from the bottom Cabling / Conduit trays (`drawModeRef` carries kind + conduit type + size into `finishCableDraw`).

**View modes**: `viewMode: 'default' | 'field' | 'canvas'`. Default = full chrome. Field = TopBar drops to 44px, side rails hidden. Canvas = everything hidden except a small Exit chip + floating tool/devices reopeners. Escape unwinds the most-immersive layer first.

### Hard rules / conventions that have come up repeatedly

1. **Tools-left / devices-bottom separation** is structural, not stylistic. Don't break it.
2. **"If a control doesn't work, hide it or mark it `Coming soon`."** Visible dead options are explicitly forbidden.
3. **Honest simulated labels.** Where a feature is simulated (satellite tiles, VisionScan AR/LiDAR, scan workflow), label it as such on screen. Don't fake real integrations.
4. **No new modules** when the brief asks for visual / surveyor work. The dev frequently lists Bus Designer / Threat Drill / Quote Builder / Marketing site / `deepervision-ai` / Dashboard / CRM as off-limits for canvas-focused passes.
5. **Two-commit deploy ritual** (source, then `build: dist with <sha> stamp`). The dist commit lets the live URL reflect the change without a Vercel build step.
6. **Audit docs** (`SURVEYOR_*.md`, `*_AUDIT.md`, `FINAL_*.md` at root) are written before large redesign passes — the dev often asks for one as a mandatory first step. Read them to understand recent intent.
7. **Headless screenshot capture**: `BottomDeviceBar` honors `?openTray=<id>` on mount so Chrome `--screenshot` can reach sub-states without post-load interactions.
8. **Per-pass acceptance criteria live in [`docs/MVP_ACCEPTANCE_CHECKLIST.md`](docs/MVP_ACCEPTANCE_CHECKLIST.md)** — extend it (new section + rows) rather than starting parallel feature-audit docs. The checklist uses an explicit verification legend (`UI-verified` / `Store-verified` / `Not yet verified`); preserve that vocabulary so old and new sections stay comparable. Manual human-walkthrough QA lives separately in [`QA_CHECKLIST.md`](QA_CHECKLIST.md).

### Routing notes

The product is sprawling — ~40 routes. The canvas (`/project/:projectId/canvas`) is the main surface and gets nearly all the attention. The Threat Drill (`/project/:projectId/drill`), Bus Designer (`/project/:projectId/bus`), and Dashboard (`/dashboard`) routes are real but typically off-limits in surveyor-focused work.

## Where things actually live

- Canvas auto-fit / pan / zoom math: top of `EngineeringCanvas.tsx` (`computeFit`, `applyFit`, `applyCenter`, `applyActualScale`, pan state).
- Canvas-to-canvas drag-stack (drop a reader onto a door → attach): the device's `onPointerUp` handler dispatches `dv-stack-attach` on the SVG; the parent listener runs `canHost(...)` from [`src/app/lib/compatibility.ts`](src/app/lib/compatibility.ts) and either writes to `host.stack[]` or toasts a rejection.
- Bundle visualisation + clickable pathways: `PathwaysOverlay` inside the canvas SVG. Bundle labels and individual run lines each dispatch their own pick event up to the parent.
- Right drawer: `EditDrawer` for devices (12-tile grid filtered by `tilesForDevice(d)`); `PathwayDrawer` for pathways (cable / conduit variants with sub-tabs).
- Bundle inspector + conduit fill calculator: `BundleInspectorDialog` opens on bundle-label click. `computeBundleFill(count, cableType, conduitSize)` uses NEC 53/31/40 % rules + `EMT_SIZES` + `CABLE_OD_IN` tables.

## Out-of-scope by default

Per durable instructions from the user, do **not** work on these without explicit ask:

- Bus Designer (`screens/BusDesigner.tsx`, `screens/BusFleet.tsx`)
- Threat Drill (`screens/ThreatDrillEditor.tsx`, `screens/ThreatDrillLibrary.tsx`)
- Dashboard / CRM (`screens/Dashboard.tsx`, `screens/PipelineView.tsx`, `screens/AccountDetail.tsx`)
- `deepervision-ai` (separate Next.js marketing repo, lives elsewhere on this machine)
- Quote / Proposal builders (`screens/ProposalBuilder.tsx`)
- Any new module
