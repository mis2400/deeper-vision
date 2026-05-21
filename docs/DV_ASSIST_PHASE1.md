# DV Assist Phase 1 — what is real, what awaits the Data Hub

DV Assist is the always present design consultant in the canvas. Phase 1
builds the engine: design validation, final review, bulk operations,
context aware Q&A, and the three operating modes (Passive, Suggestion,
Action). It runs client side against the existing Zustand store plus a
curated product knowledge seed.

This doc is the honest map between what ships today and what depends on
the future Data Hub backend.

## What ships in Phase 1 (the engine)

- A curated product seed in `src/app/lib/productCatalog.ts` carrying the
  metadata the rules engine consumes: license requirements, recommended
  mounts, indoor / outdoor environment, PoE class plus watts, switch
  capacity (port count, PoE port count, PoE budget watts), and cable
  distance limits.
- A pure rules engine that computes findings against real store state.
  Every finding cites a real object id; every suggested fix maps to a
  real store mutation.
- The assistant surface that already exists at `/ai/:projectId` shares
  its conversation store with a new in canvas panel. Two views, one
  brain.
- Local pattern matched answers for the question shapes the engine
  recognizes; Anthropic API fallback for everything else, with the
  inference badge and lower confidence chip carried through so the user
  can tell a grounded local computation from an LLM inference.
- Action mode with the existing undo system: every applied change is
  reversible.
- Bulk operation engine: select scope, preview affected devices, confirm,
  execute as a single undoable transaction.
- Final Design Review that runs every rule on the whole project and
  presents the counts as one report.
- Context aware upsell recommendations grounded in real placed device
  gaps.

## What this seed deliberately is not

The product seed is curated, not the full manufacturer catalog. The new
fields cover only the SKUs the validation engine needs to reason about
today:

- Eight Cisco / Meraki / Aruba / Ruckus / Ubiquiti / Netgear / Juniper
  PoE switches now carry real `portCount` + `poePortCount` +
  `poeBudgetWatts`. Other switches in the catalog leave these undefined
  and the "switch overloaded" rule simply does not fire against them.
- The Belden Cat6A line and the CommScope OM4 multimode line carry
  `maxCableRunFt`. Other cables are undefined, distance rule silent.
- Two cameras (the Axis P1468-LE bullet and the Hanwha XNO-9083R
  bullet) carry `requiresLicense: true` and a `defaultLicenseId`
  pointing at a real VMS license SKU. Every other camera in the seed
  leaves `requiresLicense` undefined, meaning the "missing license"
  rule cannot fire against it. Verkada style all in one cameras are
  correctly left out: their cloud subscription is bundled into the
  camera SKU itself.
- A small set of mount accessories (T91, T94, TG6, TP01, MWD, MPL, CB
  series) carry `mountForDeviceTypes`. Other accessories leave the
  field undefined and the "missing mount" rule cannot suggest them
  even when a real product exists.
- Seven license SKUs cover the major VMS ecosystems (ACS, Genetec
  Omnicast, Milestone XProtect, Eagle Eye Cloud, Avigilon ACC) plus
  per reader access control (LenelS2 OnGuard, Genetec Synergis).

Every field is optional. When a value is unknown, the rule that would
have consumed it stays silent rather than guessing. That keeps the
engine honest until the Data Hub backend replaces the seed with the
full distributor catalog.

## What waits for the Data Hub

The full DV Assist vision needs a backend product catalog that does not
exist yet. The pieces that wait on it:

- Full manufacturer catalog depth. The seed covers eight switches; the
  Data Hub covers every shipping switch with real specs from the
  manufacturer feed.
- Catalog by conversation: "find me a 24 port multigig PoE+ switch with
  at least 500W budget" returning real distributor inventory rather
  than the eight rows the seed knows about.
- Lifecycle awareness across all products. Today the seed has
  `warrantyYears` on a handful of products. The Data Hub will surface
  end of life dates, firmware advisories, NDAA changes, and active
  recalls as they move.
- Real time pricing. The seed carries sample retail and dealer cost.
  The Data Hub binds to a live distributor price list with rebate
  awareness.

Engine code reads exclusively through the helpers in
`src/app/lib/productCatalog.ts` (`requiresLicense`, `licensesFor`,
`defaultLicenseFor`, `licenseTerms`, `mountsForDeviceType`,
`recommendedMountFor`, `switchPortCount`, `switchPoeBudget`,
`poeDrawWatts`, `maxCableRunFor`). When the Data Hub lands, every
read swaps at that boundary; the rules and the assistant surface do
not change.

## Contracts the DVA.3 rules engine must honor

- **`poeDrawWatts(p)` undefined means "skip, do not assume zero."** A
  product with no `powerDrawWatts` and no `poeClass` may be AC powered
  or may be a PoE device the seed has not measured. The PoE budget
  rule must drop these from the sum rather than adding zero.
- **Mount suggestions must intersect.** `mountsForDeviceType(t)`
  returns every accessory in the catalog that targets device type `t`;
  `accessoriesFor(host)` returns the accessories the host vendor
  declared compatible. The "device missing a mount" rule must compute
  the intersection so a fix path the host never validated cannot be
  surfaced. The helper layer deliberately does not pre intersect so
  the rules engine can pick its own join policy.
- **License matches honor manufacturer scope.** `licensesFor(host)`
  returns vendor agnostic licenses plus any license whose
  `coversManufacturers` includes the host manufacturer. The "missing
  license" rule should rank `defaultLicenseFor(host)` first, then
  the rest, and never surface a license that the helper omitted.

## Schema reconciliation

The seed extension added these fields. Existing schema audited first;
no field was duplicated under a new name.

| New field | Where it lives | Reuses or new |
|---|---|---|
| `requiresLicense` | `Product` | new |
| `defaultLicenseId` | `Product` | new |
| `licenseType` | `Product` (license SKUs only) | new |
| `licenseTermYears` | `Product` (license SKUs only) | new |
| `licenseTermOptions` | `Product` (license SKUs only) | new |
| `coversCategories` | `Product` (license SKUs only) | new |
| `coversProductIds` | `Product` (license SKUs only) | new |
| `coversManufacturers` | `Product` (license SKUs only) | new |
| `portCount` | `Product` (switches only) | new |
| `poePortCount` | `Product` (switches only) | new |
| `poeBudgetWatts` | `Product` (switches only) | new |
| `maxCableRunFt` | `Product` (cables only) | new |
| `mountForDeviceTypes` | `Product` (accessories only) | new |
| `recommendedMountId` | `Product` (host devices) | new |
| `'license'` | `ProductCategory` union | new |

Fields the brief named that already existed and were reused:

| Brief name | Existing field |
|---|---|
| `compatibleMounts` | `mounts: ProductMountType['surface'][]` |
| `environment` | `indoorOutdoor: 'indoor' \| 'outdoor' \| 'both'` |
| `poeClass + watts` | `poeClass: 1 \| 2 \| 3 \| 4` + `powerDrawWatts: number` |

The IEEE PoE class mapping is documented in `poeDrawWatts()` so the
rules engine can fall back to a class max when a specific device's
`powerDrawWatts` is undefined.
