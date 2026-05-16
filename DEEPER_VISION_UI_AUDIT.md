# Deeper Vision — UI Audit
_Pre-rebuild snapshot for the DEEPER VISION UI SYSTEM REBUILD pass._

- Live URL audited: https://deeper-vision-ashy.vercel.app/
- Local dev: http://localhost:5173/
- Date: 2026-05-16
- Viewport: 1440 × 900, theme = Slate Engineering (new default)

The 10 before screenshots live in [docs/ui-audit/before](docs/ui-audit/before/);
the post-rebuild captures will live in [docs/ui-audit/after](docs/ui-audit/after/).

---

## 01 · Dashboard

**Before**: [docs/ui-audit/before/01-dashboard.png](docs/ui-audit/before/01-dashboard.png)

- **Outdated**: integration cards are generic dark tiles with no recognisable brand
  marks — looks like placeholder seed data.
- **Too dark**: the dark navy background flattens the entire screen; cards and
  metrics blend into one slab.
- **Cluttered**: too many sections compete for top-billing — Today, Active
  Projects, Pipeline, Team, Integrations, Customer Ops are all rendered at the
  same visual weight.
- **Weak buttons**: small gray "View" / "Open" / "Manage" buttons read as admin
  UI.
- **Generic panels**: cards have one uniform shadow + radius; no hierarchy.

**Decisions**
- Add proper text-logo cards for HubSpot · Salesforce · Q360 · QuickBooks ·
  NetSuite · Outlook · Google Calendar · Verkada · Axis · Avigilon · Genetec ·
  Milestone (text-mark fallback because we don't ship trademarked logos).
- Apply shared `Card`, `Button`, `Pill` UI primitives.

## 02 · Project Center

**Before**: [docs/ui-audit/before/02-project-center.png](docs/ui-audit/before/02-project-center.png)

- **Outdated**: row-based list with timestamps; reads like a database explorer.
- **Cluttered**: every project carries 6+ inline badges.
- **Weak buttons**: tiny "Open" buttons get lost in the row.

**Decisions**: tighten with shared `Card` + `Button` primitives; project status
becomes a single colored `Pill`.

## 03 · Engineering Canvas (default state)

**Before**: [docs/ui-audit/before/03-canvas-default.png](docs/ui-audit/before/03-canvas-default.png)

- **Outdated**: minimap labelled "OVERVIEW" + Screen/Export PDF buttons stick on
  the bottom-right of every canvas — feels like a debug HUD.
- **Cluttered**: status bar + zoom dock + minimap + scale + tools + FAB +
  build stamp all visible simultaneously.

**Decisions**
- **Hide** the minimap and the Screen/Export PDF inline buttons by default;
  resurface them via the canvas overflow.
- Keep tools + zoom + scale + north + FAB.

## 04 · Canvas with product drawer open

**Before**: [docs/ui-audit/before/04-canvas-dock-open.png](docs/ui-audit/before/04-canvas-dock-open.png)

- **Improved last pass** — stack picker + live counts in the dock header.
- **Still dense**: 13 category rows + group chip wrap + search + stack picker.

**Decisions**: tighten typography; promote `Recommended` count visually.

## 05 · Canvas with device selected

**Before**: [docs/ui-audit/before/05-canvas-selected.png](docs/ui-audit/before/05-canvas-selected.png)

- **Already minimal** — pill (status dot · ID · type · Edit) only.
- **Still good** from the prior pass.

**Decisions**: no change.

## 06 · Canvas with right drawer open

**Before**: [docs/ui-audit/before/06-canvas-drawer-open.png](docs/ui-audit/before/06-canvas-drawer-open.png)

- 12-tile grid (3 per row) already in place.
- Section headers are subtle but consistent.

**Decisions**: header gains a `floor · room · zone` line per the brief.

## 07 · Coverage / FOV editing

**Before**: [docs/ui-audit/before/07-canvas-coverage.png](docs/ui-audit/before/07-canvas-coverage.png)

- **Past failure**: a 280px "Coverage check" card used to float over the canvas.
- **Fixed last pass**: TargetSimOverlay gated to Coverage drawer tab.
- **Still missing**: Coverage tab does not split Overview vs. Prosecution per
  the brief.

**Decisions**: split Coverage section body into Overview / Prosecution tabs.

## 08 · Product Catalog

**Before**: [docs/ui-audit/before/08-product-catalog.png](docs/ui-audit/before/08-product-catalog.png)

- Dense table-style listing.
- Filters along the left.

**Decisions**: in scope for next pass; here we ensure typography/buttons share
the new system tokens.

## 09 · Estimate / BOM

**Before**: [docs/ui-audit/before/09-estimate-bom.png](docs/ui-audit/before/09-estimate-bom.png)

- Captured almost-blank (route may have lazy-loaded after our budget); the screen
  itself in normal use is a spreadsheet-style table.

**Decisions**: typography sweep via shared system; not full redesign this pass.

## 10 · Report export

**Before**: [docs/ui-audit/before/10-report-export.png](docs/ui-audit/before/10-report-export.png)

- Today: a list of 8 export rows under Reports nav with no actual builder.
- "Export PDF" tab on the canvas minimap duplicates this.

**Decisions**: build a `ReportBuilderDialog` with report types · options ·
preview summary · export button, hide the duplicate canvas Export.

---

## Shared design system gaps (will be filled)

- No single `Button` primitive — every screen rolls its own.
- No `Card` primitive — every card hand-rolls border, radius, padding.
- No `Pill` / `Badge` — same.
- Spacing / radius / shadow tokens are inconsistent (mix of `rounded-md`,
  `rounded-lg`, `rounded-xl`).
- No motion tokens — every transition declares its own duration.
- No typography scale — every section picks its own `text-[12px]`,
  `text-[12.5px]`, etc.

## What this pass will deliver

1. `theme.css` design-token expansion (spacing / radius / shadow / motion /
   typography) on top of the existing colour tokens.
2. `components/ui/Button.tsx`, `Card.tsx`, `Pill.tsx`, `IntegrationCard.tsx`
   primitives.
3. Dashboard rebuild using the new primitives with real text-mark integration
   cards.
4. Canvas: hide the minimap + Export inline by default.
5. Coverage tab Overview / Prosecution split.
6. Real `ReportBuilderDialog` reachable from canvas + Reports nav.
7. After screenshots saved to `docs/ui-audit/after/`.

## Out of scope (explicit honesty)

- Full repaint of Project Center / Product Catalog / Estimate / BOM — they
  inherit the new tokens but are not redesigned end-to-end in this pass.
- Dashboard re-architecture — visual rebuild only, not a new IA.
- Animations beyond a hover lift / soft cross-fade.

---

## After / before notes (per screen)

| # | Screen | Before | After | Net change |
|---|---|---|---|---|
| 01 | Dashboard           | [before](docs/ui-audit/before/01-dashboard.png) | [after](docs/ui-audit/after/01-dashboard.png) | Integration grid swapped to 12 IntegrationCards with brand-colored text marks + connection status + manage CTA |
| 02 | Project Center      | [before](docs/ui-audit/before/02-project-center.png) | [after](docs/ui-audit/after/02-project-center.png) | Inherits new tokens via theme.css; no structural rebuild this pass |
| 03 | Canvas default      | [before](docs/ui-audit/before/03-canvas-default.png) | [after](docs/ui-audit/after/03-canvas-default.png) | MiniMap collapsed to a single eye icon; PdfExporter hidden on canvas |
| 04 | Canvas dock open    | [before](docs/ui-audit/before/04-canvas-dock-open.png) | [after](docs/ui-audit/after/04-canvas-dock-open.png) | Same as v4 (stack picker + live counts retained) |
| 05 | Canvas selected     | [before](docs/ui-audit/before/05-canvas-selected.png) | [after](docs/ui-audit/after/05-canvas-selected.png) | Compact pill only |
| 06 | Canvas drawer open  | [before](docs/ui-audit/before/06-canvas-drawer-open.png) | [after](docs/ui-audit/after/06-canvas-drawer-open.png) | Same 12-tile grid |
| 07 | Canvas Coverage     | [before](docs/ui-audit/before/07-canvas-coverage.png) | [after](docs/ui-audit/after/07-canvas-coverage.png) | Big "Coverage check" canvas card removed; Overview / Prosecution sub-tabs in the drawer |
| 08 | Product Catalog     | [before](docs/ui-audit/before/08-product-catalog.png) | [after](docs/ui-audit/after/08-product-catalog.png) | Inherits theme tokens; not redesigned this pass |
| 09 | Estimate / BOM      | [before](docs/ui-audit/before/09-estimate-bom.png) | [after](docs/ui-audit/after/09-estimate-bom.png) | Inherits theme tokens; not redesigned this pass |
| 10 | Report export       | [before](docs/ui-audit/before/10-report-export.png) | [after](docs/ui-audit/after/10-report-export.png) | New Report Builder modal: 8 types · audience · 7 include toggles · live page count · Export PDF |
