// BottomDeviceBar — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. The LIVE bottom device
// bar: the one that actually starts every drag and lands every
// drop. The drag flow is:
//
//   1. Tray card mounts as
//        <button draggable onDragStart={beginProductDrag(p.id, e)} />
//      so the HTML5 drag pipeline picks the product id up cleanly.
//   2. Same card also wires onPointerDown={onStartDrag(p, e)} to
//      drive the parent's custom ghost-preview drag (mouse-based
//      placement without the OS drag pipeline).
//
// Both wires are preserved verbatim. The drag-placed-device
// audit assertion exercises the HTML5 path via the
// window.__dvSimulateDrop production seam; the data-track keys
// it looks up (`bottombar-cam-*`, `bottombar-cat-cam`) are
// intact below. Behaviour and pixels identical.
//
// Props in (six total):
//   - onStartDrag(p, e)        — pointer-down ghost-preview drag
//   - onPickTool(t)            — arm a canvas tool (cable / etc)
//   - onPickCableType(id)      — arm cable-draw with a specific type
//   - onPickConduit(type, sz?) — arm conduit-draw with type + size
//   - onPickPathway(kind, lbl) — arm pathway-draw with a kind
//   - tool                     — active canvas tool (for highlights)
//
// Store sub: categoryColors + setCategoryColor (V3.6 Part B
// category-color picker), devices + pathways for the per-floor
// count badges, and the sticky currentFloorIdByProject so the
// counts reflect the operator's active floor — not the project
// fallback. All other state is local.

import { BatteryCharging, Cable, DoorOpen, Flame, GripVertical, Network as NetworkIcon, PencilRuler, Phone, ScanFace, Search, Server, ShieldAlert, Thermometer, Video, Volume2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { selectors as storeSelectors, useProjectStore } from '../../store/projectStore';
import { PRODUCTS, productMatchesTechModel } from '../catalog';
import { CABLE_TYPES, KIND_TONE, TYPE_KIND } from '../constants';
import { ColorPicker } from '../components/ColorPicker';
import { DeviceGlyph } from '../devices/DeviceGlyph';
import { beginProductDrag } from '../interaction/dragDrop';
import type { CableTypeId, DeviceType, Product, Tool } from '../types';

const TRAY_DESCRIPTION: Record<string, string> = {
  cam:      'Place CCTV and video devices on the floorplan.',
  acc:      'Place access-control hardware. Readers, strikes, and maglocks can stack onto door assemblies.',
  door:     'Place door openings — single, double, storefront, sliding, gates, and elevators.',
  cable:    'Cable, terminations, couplers, patch panels, conduit, pathways, pull boxes, and firestop.',
  conduit:  'Conduit, raceway, pathways, pull boxes, sleeves, and firestop. Pick a type to draw a route.',
  net:      'Network infrastructure — IDF, MDF, racks, switches, patch panels, NVRs.',
  power:    'Power supplies, UPS, transformers, PoE injectors, batteries.',
  intercom: 'Door and station intercoms. Link to a door from the drawer.',
  audio:    'Speakers, amplifiers, microphones for PA + BGM systems.',
  intrusion:'Intrusion sensors — glassbreak, contacts, panic buttons, vibration.',
  sensor:   'Environmental + safety sensors — motion, glass-break, smoke, temp.',
  fire:     'Fire-alarm devices — pull stations, smoke detectors, horns, strobes.',
  inf:      'Infrastructure — racks, MDFs, windows, walls.',
};

export function BottomDeviceBar({
  onStartDrag, onPickTool, onPickCableType, onPickConduit, onPickPathway, tool,
}: {
  onStartDrag: (p: Product, e: React.PointerEvent) => void;
  onPickTool: (t: Tool) => void;
  onPickCableType: (id: CableTypeId) => void;
  onPickConduit: (type: 'EMT' | 'PVC' | 'FMC' | 'LFMC' | 'raceway' | 'tray', size?: string) => void;
  onPickPathway: (kind: 'tray' | 'jhook' | 'sleeve' | 'raceway' | 'duct', label: string) => void;
  tool: Tool;
}) {
  // V3.6 Part B — direct store access for the category color picker in
  // the open tray header. The picker resolves the dock cat to its
  // representative DeviceKind via TYPE_KIND on the first DEVICE-typed
  // entry in `cat.types` (skipping dock-only category placeholders).
  const categoryColors = useProjectStore((s) => s.categoryColors);
  const setCategoryColor = useProjectStore((s) => s.setCategoryColor);
  // V1 P0.6 — dock is grouped by domain. A small uppercase label sits
  // above each group inside the bar, and the order follows a real
  // survey workflow: surveillance first, then access, then detect &
  // alarm, then AV, then the cable/power/network backbone, then site
  // infrastructure (racks, MDFs, walls). A thin divider sits between
  // groups so the visual rhythm reinforces the grouping.
  type GroupId = 'surveillance' | 'access' | 'detect' | 'av' | 'backbone' | 'site';
  type Cat = {
    id: string;
    label: string;
    icon: any;
    group: GroupId;
    /** Types that the tray exposes as placeable products. Selected from
     *  PRODUCTS so we always show real, in-catalog items. */
    types?: DeviceType[];
    /** Optional canvas tool to engage instead of opening a product tray
     *  (Cabling → cable tool). */
    tool?: Tool;
  };
  const GROUPS: { id: GroupId; label: string }[] = [
    { id: 'surveillance', label: 'Surveillance' },
    { id: 'access',       label: 'Access' },
    { id: 'detect',       label: 'Detect & alarm' },
    { id: 'av',           label: 'AV' },
    { id: 'backbone',     label: 'Cable, power, network' },
    { id: 'site',         label: 'Site' },
  ];
  // SC.7.5 — dock categories. Type strings normalised against the
  // unified DeviceType union from store/types. Where the dock had a
  // shorthand identifier ('inf.door', 'av.speaker', 'fire.pull') the
  // canonical store name replaces it. Entries that reference device
  // kinds the schema does not yet model carry an `as DeviceType` cast
  // with a `// dock-only` comment so a future schema extension can
  // grep them out.
  const cats: Cat[] = [
    // Cameras — `cam.turret` is dock-only; canvas renders it as a generic camera glyph.
    { id: 'cam',       group: 'surveillance', label: 'Cameras',    icon: Video,           types: ['cam.dome','cam.bullet','cam.turret' as DeviceType /* dock-only */,'cam.ptz','cam.multisensor','cam.fisheye','cam.lpr','cam.thermal'] },

    // Doors — canvas dock uses bare 'inf.door' / 'inf.gate' as
    // category-level pickers that fall through to the specific
    // variant on click. Marked dock-only so the schema doesn't grow
    // a member that nothing else renders.
    { id: 'door',      group: 'access', label: 'Doors',      icon: DoorOpen,        types: ['inf.door' as DeviceType /* dock-only category */, 'inf.door-double' as DeviceType /* dock-only */, 'inf.door-storefront', 'inf.gate-swing'] },
    { id: 'acc',       group: 'access', label: 'Access',     icon: ScanFace,        types: ['acc.reader','acc.keypad' as DeviceType /* dock-only */, 'acc.strike','acc.maglock','acc.exit','acc.dps','acc.panic-bar','acc.controller','acc.psu'] },
    { id: 'intercom',  group: 'access', label: 'Intercom',   icon: Phone,           types: ['acc.intercom','aud.intercom'] },

    { id: 'intrusion', group: 'detect', label: 'Intrusion',  icon: ShieldAlert,     types: ['sen.glass','sen.contact','sen.panic','int.contact'] },
    // Fire / life-safety — schema uses `fls.*`; dock keeps the
    // `fire.*` ids it was created with until each one is wired to a
    // renderer. Cast through as dock-only so the audit grep is clean.
    { id: 'fire',      group: 'detect', label: 'Fire',       icon: Flame,           types: ['fls.pull-station','fls.fire-panel','fls.strobe','fire.horn' as DeviceType /* dock-only, no renderer yet */] },
    { id: 'sensor',    group: 'detect', label: 'Sensors',    icon: Thermometer,     types: ['sen.motion','sen.glass','sen.smoke','sen.temp'] },

    { id: 'audio',     group: 'av',     label: 'Audio / PA', icon: Volume2,         types: ['aud.speaker','aud.amp','aud.mic'] },

    { id: 'net',       group: 'backbone', label: 'Network',  icon: NetworkIcon,     types: ['net.switch','net.idf','net.mdf','net.ap','net.firewall'] },
    { id: 'cable',     group: 'backbone', label: 'Cabling',  icon: Cable },
    { id: 'conduit',   group: 'backbone', label: 'Conduit',  icon: PencilRuler },
    // Power — dock kept the legacy `inf.*` ids. Canonical store
    // names: `pwr.ups`, `acc.psu`. `inf.transformer` has no
    // renderer; dock-only until the schema grows a transformer.
    { id: 'power',     group: 'backbone', label: 'Power',    icon: BatteryCharging, types: ['pwr.ups','acc.psu','inf.transformer' as DeviceType /* dock-only, no renderer yet */] },

    { id: 'inf',       group: 'site',   label: 'Site infra', icon: Server,          types: ['inf.rack','inf.mdf','inf.window','inf.wall-brick'] },
  ];
  // Open a tray on mount if the URL carries `?openTray=<id>` — used by
  // the headless screenshot capture script to reach sub-states cleanly.
  const initialOpen = (() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const id = sp.get('openTray');
      if (id && cats.some((c) => c.id === id)) return id;
    } catch {}
    return null;
  })();
  const [open, setOpen] = useState<string | null>(initialOpen);
  // Sub-tab state for the Cabling + Conduit trays. The trays used to
  // render every section's grid simultaneously (~76 buttons for Cabling,
  // ~39 for Conduit). Now each tray shows ONE section at a time, picked
  // by these sub-tabs, so the user sees a focused subset (≤12 buttons).
  const [cableSub, setCableSub] = useState<'cable'|'term'|'coupler'|'rack'|'conduit'|'pathway'|'box'|'firestop'>('cable');
  const [conduitSub, setConduitSub] = useState<'conduit'|'pathway'|'box'|'firestop'>('conduit');
  // Camera tray filters. Sub type tabs (PTZ / Fisheye / Dome / Bullet /
  // Multisensor) gate the visible cameras to one form factor; the
  // remaining types (turret, thermal, lpr, body) stay reachable via
  // 'all' + the product search box on the bar.
  type CamSub = 'all' | 'ptz' | 'fisheye' | 'dome' | 'bullet' | 'multisensor';
  const [camSub, setCamSub] = useState<CamSub>('all');
  const [camMfr, setCamMfr] = useState<string | null>(null);
  type CamTech = 'all' | 'cloud' | 'on_prem' | 'hybrid';
  const [camTech, setCamTech] = useState<CamTech>('all');
  // Global product search — driven by the search input docked on the
  // bottom toolbar (right of the category browser). Matches across
  // manufacturer, model, productLine, productName, cameraType,
  // subcategory, resolution — the haystack from the catalog audit. When
  // a query is active, the tray flips into a search-results mode
  // regardless of which category is open.
  const [searchQuery, setSearchQuery] = useState('');
  // Pass B: search input collapses to a single icon by default. Click
  // expands into the textbox; outside-click / Escape collapse back and
  // clear the query so the results panel dismisses with the same
  // gesture. The actual input + floating results panel are reused
  // verbatim from the V3 catalog browsing pass — only the chrome
  // shifted from "always-on input" to "icon trigger + on-demand input".
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  // Item 3 — bottom bar adopts the left-rail visual language. Icons
  // only by default; on hover (desktop) or tap (touch) the bar
  // reveals labels + group headers + count badges. Per-category
  // counts stay derived from real placement data — never fabricated.
  const [barHover, setBarHover] = useState(false);
  const [barTapExpand, setBarTapExpand] = useState(false);
  const barCoarsePointer = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches,
    [],
  );
  const barExpanded = barCoarsePointer ? barTapExpand : barHover;
  // The Conduit sub-tab defaults to a 6-button "common sizes" set
  // (EMT 1/2 · EMT 3/4 · EMT 1 · PVC 3/4 · PVC 1 · raceway). Flip this
  // toggle to expose the full 30-cell type × size matrix.
  const [conduitShowAll, setConduitShowAll] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);
  // Dismiss the tray OR the search panel on outside-click / Escape. Both
  // panels live inside trayRef so a click outside their bounds clears
  // whichever one is currently rendering. Without this branch the
  // search panel anchored a 760×420 zone above the bar and refused to
  // leave until the user hit the X button — out of step with every
  // other floating affordance.
  const searchPanelLive = searchQuery.trim().length >= 2;
  useEffect(() => {
    if (!open && !searchPanelLive && !searchOpen && !barTapExpand) return;
    const dismiss = () => { setOpen(null); setSearchQuery(''); setSearchOpen(false); setBarTapExpand(false); };
    const onDown = (e: MouseEvent) => {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) dismiss();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [open, searchPanelLive, searchOpen, barTapExpand]);
  // Focus the input when the user clicks the search icon so they can
  // start typing immediately. Runs after the conditional render flips
  // the textbox into the DOM.
  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => { searchInputRef.current?.focus(); });
    }
  }, [searchOpen]);

  // Resolve products per category. We only show items whose DeviceType is
  // present in the PRODUCTS catalog AND has at least one product — that
  // way no tray ever exposes a dead option (per the "no waste menus" rule).
  const productsByCat = useMemo(() => {
    const m: Record<string, Product[]> = {};
    for (const c of cats) {
      if (!c.types) { m[c.id] = []; continue; }
      // Prefix match (not exact) so a category like Doors (`inf.door`) catches
      // the real product types (`inf.door-single`, `inf.door-double`, etc.)
      // that the catalog actually ships. Exact `includes` left the Doors,
      // Gates, and Storefront trays empty.
      const pool = PRODUCTS.filter((p) =>
        c.types!.some((t) => p.type === t || (p.type as string).startsWith(t + '-')),
      );
      // Deduplicate by type so each device type shows once in the tray
      // unless multiple manufacturers exist; show first 12 to keep the
      // tray scannable.
      m[c.id] = pool.slice(0, 24);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const trayCat = cats.find((c) => c.id === open) ?? null;
  const trayProducts = open ? (productsByCat[open] ?? []) : [];

  // ── Camera tray — full pool + sub-type + manufacturer + tech filters ──
  // productsByCat['cam'] is sliced to 24 for the legacy unfiltered grid;
  // the sub-tab work needs the full 60 camera SKUs so a filter never
  // shows fewer than it should. Compute it once.
  const camFullPool = useMemo(
    () => PRODUCTS.filter((p) => TYPE_KIND[p.type] === 'camera'),
    [],
  );
  // Manufacturer dropdown options — only mfrs that actually have at
  // least one camera in the catalog.
  const camMfrOptions = useMemo(
    () => Array.from(new Set(camFullPool.map((p) => p.mfr))).sort(),
    [camFullPool],
  );
  // Pool narrowed by manufacturer + tech, sub-type independent. Drives
  // both the visible grid (further filtered by the active sub tab) and
  // the live tab counts so neither has to redo the same scan twice.
  const camMfrTechPool = useMemo(() => camFullPool.filter((p) => {
    if (camMfr && p.mfr !== camMfr) return false;
    if (camTech !== 'all' && !productMatchesTechModel(p, camTech)) return false;
    return true;
  }), [camFullPool, camMfr, camTech]);
  // Sub-tab counts keyed by CamSub. Memoized once per
  // (mfr, tech) change instead of recomputed inline inside the map of
  // tab buttons (which used to scan camFullPool six times per render).
  const camSubCounts = useMemo(() => ({
    all:         camMfrTechPool.length,
    ptz:         camMfrTechPool.filter((p) => p.type === 'cam.ptz').length,
    fisheye:     camMfrTechPool.filter((p) => p.type === 'cam.fisheye').length,
    dome:        camMfrTechPool.filter((p) => p.type === 'cam.dome').length,
    bullet:      camMfrTechPool.filter((p) => p.type === 'cam.bullet').length,
    multisensor: camMfrTechPool.filter((p) => p.type === 'cam.multisensor').length,
  }), [camMfrTechPool]);
  // Filtered cameras driving the cam tray grid.
  const camFiltered = useMemo(() => {
    const subType = (() => {
      switch (camSub) {
        case 'all':         return null;
        case 'ptz':         return 'cam.ptz';
        case 'fisheye':     return 'cam.fisheye';
        case 'dome':        return 'cam.dome';
        case 'bullet':      return 'cam.bullet';
        case 'multisensor': return 'cam.multisensor';
      }
    })();
    return subType ? camMfrTechPool.filter((p) => p.type === subType) : camMfrTechPool;
  }, [camMfrTechPool, camSub]);

  // ── Product search — global, matches across the audit haystack:
  //   manufacturer, model, productLine, productName, cameraType,
  //   subcategory, resolution. Hooked to the search box on the bar.
  const trimmedQuery = searchQuery.trim();
  const searchActive = trimmedQuery.length >= 2;
  const searchResults = useMemo(() => {
    if (!searchActive) return [];
    const q = trimmedQuery.toLowerCase();
    return PRODUCTS.filter((p) => {
      // Haystack: every field a surveyor might type. `p.sub` is the
      // pre-built subtitle the catalog adapter derives from notes +
      // resolution + cameraType, so feature keywords like "outdoor",
      // "NDAA", "varifocal" still match even when they're not in the
      // strict tagged fields.
      const hay = [
        p.mfr, p.model, p.productLine ?? '', p.productName ?? '',
        p.cameraType ?? '', p.subcategory ?? '', p.resolution ?? '',
        p.sub ?? '',
      ].join(' ').toLowerCase();
      return hay.includes(q);
    }).slice(0, 60);
  }, [searchActive, trimmedQuery]);

  // V1 P0.5 — count badges. The dock subscribes directly to devices +
  // pathways for the active floor so the parent's prop surface stays
  // clean and every store change flows in without extra plumbing.
  // Canvas V2 Pass 2A.4 — now reads the sticky currentFloorIdByProject
  // so the count badges match the floor the operator is actually
  // looking at, not the project's first floor.
  const { projectId: routeProjectId = 'p1' } = useParams();
  const projectIdForCounts = routeProjectId;
  const stickyForCounts = useProjectStore((s) => s.currentFloorIdByProject[projectIdForCounts]);
  const fallbackForCounts = useProjectStore((s) => storeSelectors.firstFloorOfProject(s, projectIdForCounts)?.id ?? '');
  const currentFloorIdForCounts = stickyForCounts || fallbackForCounts;
  const storeDevicesForCounts = useProjectStore((s) => s.devices);
  const storePathwaysForCounts = useProjectStore((s) => s.pathways);
  const floorDevices = useMemo(
    () => Object.values(storeDevicesForCounts).filter(
      (d) => d.projectId === projectIdForCounts && (currentFloorIdForCounts === '' || d.floorId === currentFloorIdForCounts),
    ),
    [storeDevicesForCounts, projectIdForCounts, currentFloorIdForCounts],
  );
  const floorPathways = useMemo(
    () => Object.values(storePathwaysForCounts).filter(
      (p) => p.projectId === projectIdForCounts && (currentFloorIdForCounts === '' || p.floorId === currentFloorIdForCounts),
    ),
    [storePathwaysForCounts, projectIdForCounts, currentFloorIdForCounts],
  );
  const countByCat = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of cats) {
      if (c.id === 'cable') {
        // Cable runs = pathways that aren't conduit infrastructure.
        out[c.id] = floorPathways.filter((p) => p.type !== 'conduit').length;
        continue;
      }
      if (c.id === 'conduit') {
        out[c.id] = floorPathways.filter((p) => p.type === 'conduit').length;
        continue;
      }
      if (!c.types) { out[c.id] = 0; continue; }
      out[c.id] = floorDevices.filter((d) =>
        c.types!.some((t) => d.type === t || (d.type as string).startsWith(t + '-')),
      ).length;
    }
    return out;
    // cats is a stable literal; depending on it would force re-eval every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorDevices, floorPathways]);

  return (
    <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 bottom-3 z-30 justify-center" ref={trayRef} data-canvas-chrome="tray">
      {/* Global product search results panel — wins over the category
          tray when a query is active so the operator always sees ONE
          source of truth above the bar. Same chrome as the tray for
          visual continuity. */}
      {searchActive && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[760px] max-w-[92vw] rounded-2xl border bg-card/95 backdrop-blur-xl shadow-[0_22px_48px_-16px_rgba(0,0,0,0.55)] overflow-hidden z-30"
          style={{ borderColor: 'var(--border)' }}
          data-testid="bottombar-search-panel"
        >
          <div className="px-4 pt-3 pb-2.5 border-b border-border flex items-center gap-3">
            <Search className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold tracking-tight text-foreground truncate">
                Search results for "{trimmedQuery}"
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {searchResults.length === 0
                  ? 'No catalog matches. Try a manufacturer, model number, or form factor.'
                  : `${searchResults.length} product${searchResults.length === 1 ? '' : 's'} matched across manufacturer, model, line, name, form factor, subcategory, resolution.`}
              </div>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              title="Clear search"
              data-testid="bottombar-search-clear"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="p-3 max-h-[420px] overflow-auto">
              <div className="grid grid-cols-4 gap-2">
                {searchResults.map((p) => {
                  const tone = KIND_TONE[TYPE_KIND[p.type]] ?? 'var(--primary)';
                  return (
                    <button
                      key={p.id}
                      draggable
                      onDragStart={(e) => { beginProductDrag(p.id, e); setSearchQuery(''); setOpen(null); }}
                      onPointerDown={(e) => { onStartDrag(p, e); setSearchQuery(''); setOpen(null); }}
                      data-track={`bottombar-search-${p.id}`}
                      className="group text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-[var(--shadow-low)] hover:-translate-y-[1px] transition-all p-3 flex flex-col gap-2"
                      style={{ transitionDuration: 'var(--motion-fast)' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: `${tone}14`, color: tone, boxShadow: `inset 0 0 0 1px ${tone}55` }}>
                          <DeviceGlyph type={p.type} size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium tracking-tight truncate text-foreground">{p.model}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{p.mfr}</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{p.sub ?? '—'}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {/* Tray (renders above the bar when a category is open AND the
          search panel isn't already active) */}
      {!searchActive && open && trayCat && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[760px] max-w-[92vw] rounded-2xl border bg-card/95 backdrop-blur-xl shadow-[0_22px_48px_-16px_rgba(0,0,0,0.55)] overflow-hidden z-30"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="px-4 pt-3 pb-2.5 border-b border-border flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/12 text-primary shrink-0">
              <trayCat.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold tracking-tight text-foreground">{trayCat.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{TRAY_DESCRIPTION[trayCat.id] ?? `Place ${trayCat.label.toLowerCase()} on the floorplan.`}</div>
            </div>
            {/* V3.6 Part B category picker — resolve this tray's
                representative DeviceKind from its first real device
                type, then bind the swatch to setCategoryColor. Tool
                categories (cable / conduit / pathway) have no kind
                so they get no picker. */}
            {(() => {
              const firstType = (trayCat.types ?? []).find((t) => !!TYPE_KIND[t as DeviceType]) as DeviceType | undefined;
              if (!firstType) return null;
              const kind = TYPE_KIND[firstType];
              const resolved = categoryColors?.[kind] ?? KIND_TONE[kind];
              return (
                <div className="shrink-0 flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground">Color</span>
                  <ColorPicker
                    currentColor={resolved}
                    onPick={(hex) => setCategoryColor(kind, hex || null)}
                    title={`${trayCat.label} color`}
                    size={18}
                    align="right"
                  />
                </div>
              );
            })()}
            <button onClick={() => setOpen(null)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40">
              <X className="w-4 h-4" />
            </button>
          </div>
          {trayCat.id === 'cable' ? (
            <div className="p-3 max-h-[360px] overflow-auto space-y-3">
              {/* Sub-tabbed layout. The tray used to render all 8 sections
                  expanded at once (~76 buttons visible). It now shows ONE
                  sub-tab's grid at a time so the user faces ≤12 buttons. */}
              {(() => {
                const fake = (id: string, label: string, note: string): Product => ({
                  id, type: 'net.switch' as DeviceType, mfr: 'Cable', model: label, sub: note, recommended: false,
                } as any);
                const CABLE_SUBS: { id: typeof cableSub; label: string }[] = [
                  { id: 'cable',    label: 'Cable' },
                  { id: 'term',     label: 'Terminations' },
                  { id: 'coupler', label: 'Couplers' },
                  { id: 'rack',     label: 'Patch / Rack' },
                  { id: 'conduit',  label: 'Conduit' },
                  { id: 'pathway',  label: 'Pathways' },
                  { id: 'box',      label: 'Pull / J-box' },
                  { id: 'firestop', label: 'Firestop' },
                ];
                return (
                  <>
                    <div
                      className="flex flex-wrap items-center gap-1 border-b border-border pb-2"
                      data-testid="cable-sub-tabs"
                    >
                      {CABLE_SUBS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setCableSub(s.id)}
                          data-track={`bottombar-cable-sub-${s.id}`}
                          className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                            cableSub === s.id
                              ? 'border-primary/40 bg-primary/12 text-primary'
                              : 'border-border text-muted-foreground hover:text-foreground hover:border-border-strong'
                          }`}
                        >{s.label}</button>
                      ))}
                    </div>
                    {cableSub === 'cable' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {(CABLE_TYPES as any[]).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { onPickCableType(c.id); setOpen(null); }}
                            data-track={`bottombar-cable-${c.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{c.label}</div>
                            <div className="text-[10px] text-muted-foreground">Data cable · per foot</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cableSub === 'term' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'jack',         label: 'RJ45 keystone',  pid: 'cabacc-jack-rj45' },
                          { id: 'jack-shld',    label: 'Shielded jack',  pid: 'cabacc-jack-shielded' },
                          { id: 'jack-outdoor', label: 'Outdoor jack',   pid: 'cabacc-jack-outdoor' },
                          { id: 'wallplate',    label: 'Wall plate',     pid: 'cabacc-wallplate' },
                          { id: 'surfmount',    label: 'Surface mount',  pid: 'cabacc-surfmount' },
                          { id: 'terminal',     label: 'Terminal block', pid: 'cabacc-terminal' },
                          { id: 'biscuit',      label: 'Biscuit jack',   pid: 'cabacc-biscuit' },
                          { id: 'patchcord',    label: 'Patch cord',     pid: 'cabacc-patchcord-7' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Termination · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Termination · each</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cableSub === 'coupler' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'coupler-rj45', label: 'RJ45 coupler',  pid: 'cabacc-coupler-rj45' },
                          { id: 'coupler-wp',   label: 'Weatherproof',  pid: 'cabacc-coupler-wp' },
                          { id: 'coupler-lc',   label: 'LC coupler',    pid: 'cabacc-coupler-lc' },
                          { id: 'coupler-sc',   label: 'SC coupler',    pid: 'cabacc-coupler-sc' },
                          { id: 'coupler-coax', label: 'Coax coupler',  pid: 'cabacc-coupler-coax' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Coupler · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Coupler · each</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cableSub === 'rack' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'pp24',        label: '24-port PP',         pid: 'cabacc-pp-24' },
                          { id: 'pp48',        label: '48-port PP',         pid: 'cabacc-pp-48' },
                          { id: 'pp-fiber',    label: 'Fiber patch panel',  pid: 'cabacc-pp-fiber' },
                          { id: 'splice',      label: 'Splice tray',        pid: 'cabacc-splice' },
                          { id: 'mgr',         label: 'Cable manager',      pid: 'cabacc-mgr' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Rack / IDF · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Rack / IDF · each</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cableSub === 'conduit' && (
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1.5 px-1">Pick a conduit type + trade size to arm the Conduit draw tool.</div>
                        <div className="grid grid-cols-6 gap-1">
                          {(['EMT','PVC','FMC','LFMC','raceway'] as const).map((t) => (
                            ['1/2"','3/4"','1"','1-1/4"','1-1/2"','2"'].map((sz) => (
                              <button
                                key={`${t}-${sz}`}
                                onClick={() => onPickConduit(t, sz)}
                                data-track={`bottombar-conduit-${t}-${sz.replace(/\W/g,'')}`}
                                className="text-left px-2 py-1.5 rounded border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors text-[10px]"
                              >
                                <div className="font-medium">{t} {sz}</div>
                                <div className="text-[9.5px] text-muted-foreground">Conduit · per ft</div>
                              </button>
                            ))
                          ))}
                        </div>
                      </div>
                    )}
                    {cableSub === 'pathway' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { kind: 'tray' as const,    label: 'Cable tray' },
                          { kind: 'jhook' as const,   label: 'J-hooks' },
                          { kind: 'raceway' as const, label: 'Surface raceway' },
                          { kind: 'duct' as const,    label: 'Underground duct' },
                          { kind: 'sleeve' as const,  label: 'Wall sleeve' },
                        ]).map((p) => (
                          <button
                            key={p.kind}
                            onClick={() => onPickPathway(p.kind, p.label)}
                            data-track={`bottombar-pathway-${p.kind}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{p.label}</div>
                            <div className="text-[10px] text-muted-foreground">Pathway · per ft</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cableSub === 'box' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'pullbox', label: 'Pull box',     pid: 'cabacc-pullbox' },
                          { id: 'jbox',    label: 'Junction box', pid: 'cabacc-jbox' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Conduit accessory · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Conduit accessory · each</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {cableSub === 'firestop' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'firestop', label: 'Firestop',    pid: 'cabacc-firestop' },
                          { id: 'sleeve',   label: 'Wall sleeve', pid: 'cabacc-sleeve' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Penetration · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/20 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Penetration · each</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : trayCat.id === 'conduit' ? (
            <div className="p-3 max-h-[360px] overflow-auto space-y-3">
              {(() => {
                const fake = (id: string, label: string, note: string): Product => ({
                  id, type: 'net.switch' as DeviceType, mfr: 'Conduit', model: label, sub: note, recommended: false,
                } as any);
                const CONDUIT_SUBS: { id: typeof conduitSub; label: string }[] = [
                  { id: 'conduit',  label: 'Conduit' },
                  { id: 'pathway',  label: 'Pathways' },
                  { id: 'box',      label: 'Pull / J-box' },
                  { id: 'firestop', label: 'Sleeves / firestop' },
                ];
                return (
                  <>
                    <div
                      className="flex flex-wrap items-center gap-1 border-b border-border pb-2"
                      data-testid="conduit-sub-tabs"
                    >
                      {CONDUIT_SUBS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setConduitSub(s.id)}
                          data-track={`bottombar-conduit-sub-${s.id}`}
                          className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                            conduitSub === s.id
                              ? 'border-primary/40 bg-primary/12 text-primary'
                              : 'border-border text-muted-foreground hover:text-foreground hover:border-border-strong'
                          }`}
                        >{s.label}</button>
                      ))}
                    </div>
                    {conduitSub === 'conduit' && (() => {
                      // Curated short list — the six options that cover ~90%
                      // of low-voltage runs. Surveyors reach for these first.
                      const COMMON: Array<{ type: 'EMT' | 'PVC' | 'FMC' | 'LFMC' | 'raceway'; size: string; label: string }> = [
                        { type: 'EMT', size: '1/2"', label: 'EMT 1/2"' },
                        { type: 'EMT', size: '3/4"', label: 'EMT 3/4"' },
                        { type: 'EMT', size: '1"',   label: 'EMT 1"' },
                        { type: 'PVC', size: '3/4"', label: 'PVC 3/4"' },
                        { type: 'PVC', size: '1"',   label: 'PVC 1"' },
                        { type: 'raceway', size: '',  label: 'Raceway' },
                      ];
                      return (
                        <>
                          {!conduitShowAll && (
                            <div className="grid grid-cols-3 gap-1.5" data-testid="conduit-common-grid">
                              {COMMON.map((c) => (
                                <button
                                  key={`${c.type}-${c.size}`}
                                  onClick={() => { onPickConduit(c.type, c.size || undefined); setOpen(null); }}
                                  data-track={`bottombar-conduit-${c.type}-${c.size.replace(/\W/g, '') || 'default'}`}
                                  className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                                >
                                  <div className="text-[11px] font-medium tracking-tight">{c.label}</div>
                                  <div className="text-[10px] text-muted-foreground">Per ft</div>
                                </button>
                              ))}
                            </div>
                          )}
                          {conduitShowAll && (
                            <div className="grid grid-cols-6 gap-1" data-testid="conduit-full-grid">
                              {(['EMT','PVC','FMC','LFMC','raceway'] as const).flatMap((t) =>
                                ['1/2"','3/4"','1"','1-1/4"','1-1/2"','2"'].map((sz) => (
                                  <button
                                    key={`${t}-${sz}`}
                                    onClick={() => { onPickConduit(t, sz); setOpen(null); }}
                                    data-track={`bottombar-conduit-${t}-${sz.replace(/\W/g, '')}`}
                                    className="text-left px-2 py-1.5 rounded border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors text-[10px]"
                                  >
                                    <div className="font-medium tracking-tight text-foreground">{t} {sz}</div>
                                    <div className="text-[9.5px] text-muted-foreground">Per ft</div>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => setConduitShowAll((v) => !v)}
                            data-testid="conduit-show-all-toggle"
                            data-track="bottombar-conduit-show-all"
                            className="mt-2 text-[10px] uppercase tracking-[0.10em] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1"
                          >
                            {conduitShowAll ? 'Show common sizes' : 'Show all sizes (EMT · PVC · FMC · LFMC · raceway × 6)'}
                          </button>
                        </>
                      );
                    })()}
                    {conduitSub === 'pathway' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { kind: 'tray' as const,    label: 'Cable tray' },
                          { kind: 'jhook' as const,   label: 'J-hooks' },
                          { kind: 'raceway' as const, label: 'Surface raceway' },
                          { kind: 'duct' as const,    label: 'Underground duct' },
                          { kind: 'sleeve' as const,  label: 'Wall sleeve' },
                        ]).map((p) => (
                          <button
                            key={p.kind}
                            onClick={() => { onPickPathway(p.kind, p.label); setOpen(null); }}
                            data-track={`bottombar-pathway-${p.kind}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{p.label}</div>
                            <div className="text-[10px] text-muted-foreground">Pathway · per ft</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {conduitSub === 'box' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'pullbox', label: 'Pull box',     pid: 'cabacc-pullbox' },
                          { id: 'jbox',    label: 'Junction box', pid: 'cabacc-jbox' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Conduit accessory · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Each</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {conduitSub === 'firestop' && (
                      <div className="grid grid-cols-4 gap-1.5">
                        {([
                          { id: 'firestop', label: 'Firestop',    pid: 'cabacc-firestop' },
                          { id: 'sleeve',   label: 'Wall sleeve', pid: 'cabacc-sleeve' },
                        ]).map((a) => (
                          <button
                            key={a.id}
                            onPointerDown={(e) => { onStartDrag(fake(a.pid, a.label, 'Penetration · each'), e); setOpen(null); }}
                            data-track={`bottombar-cableacc-${a.id}`}
                            className="text-left px-2.5 py-2 rounded-md border border-border hover:border-primary/40 hover:bg-secondary/30 transition-colors"
                          >
                            <div className="text-[11px] font-medium tracking-tight">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground">Each</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : trayCat.id === 'cam' ? (
            // ── Camera tray (V3 catalog browsing pass) ──────────────────
            // Sub-type tabs filter to a single form factor (PTZ, Fisheye,
            // Dome, Bullet, Multisensor). Above the tabs sit two
            // dropdowns: manufacturer (any catalog mfr that ships a
            // camera) and tech stack (Cloud / On-prem / Hybrid via
            // techModels.includes — array semantics). Tabs and filters
            // compose; the grid below shows the intersection. The other
            // camera types (turret, thermal, lpr, body) stay reachable
            // through the 'All' tab and the global product search on the
            // bar — they intentionally don't get their own tab.
            <div className="p-3 max-h-[420px] overflow-auto space-y-3">
              {/* Filters row */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="uppercase tracking-[0.10em]">Manufacturer</span>
                </div>
                <select
                  value={camMfr ?? ''}
                  onChange={(e) => setCamMfr(e.target.value || null)}
                  data-testid="cam-tray-mfr"
                  className="text-[11px] px-2 h-7 rounded-md border border-border bg-card focus:outline-none focus:border-primary/40"
                >
                  <option value="">All</option>
                  {camMfrOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <div className="ml-3 flex items-stretch border border-border rounded-md overflow-hidden">
                  {([
                    { id: 'all'     as const, label: 'All stacks' },
                    { id: 'cloud'   as const, label: 'Cloud' },
                    { id: 'on_prem' as const, label: 'On-prem' },
                    { id: 'hybrid'  as const, label: 'Hybrid' },
                  ]).map((m) => {
                    const active = camTech === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setCamTech(m.id)}
                        data-testid={`cam-tray-tech-${m.id}`}
                        className={`text-[10px] px-2 h-7 transition-colors ${active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                {(camMfr || camTech !== 'all' || camSub !== 'all') && (
                  <button
                    onClick={() => { setCamMfr(null); setCamTech('all'); setCamSub('all'); }}
                    data-testid="cam-tray-reset"
                    className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2"
                  >
                    Clear
                  </button>
                )}
              </div>
              {/* Sub type tabs — now icon buttons that REUSE the existing
                  DeviceGlyph art (no new icons drawn). Each tile shows
                  the device glyph + the live per-type count. The 'All'
                  tile uses the bottom-bar Cameras icon (Video lucide
                  glyph) since there's no DeviceType for "all cameras".
                  Note on the Dome tab: the catalog tags some turret
                  cameras with subcategory + cameraType 'turret' but
                  routes them through deviceType 'cam.dome' (one
                  renderer). Selecting Dome therefore shows both true
                  domes and turrets — search "turret" to pinpoint them. */}
              <div
                className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2"
                data-testid="cam-sub-tabs"
              >
                {([
                  { id: 'all'         as CamSub, label: 'All',          glyphType: null as DeviceType | null, lucide: Video },
                  { id: 'ptz'         as CamSub, label: 'PTZ',          glyphType: 'cam.ptz'         as DeviceType, lucide: null },
                  { id: 'fisheye'     as CamSub, label: 'Fisheye',      glyphType: 'cam.fisheye'     as DeviceType, lucide: null },
                  { id: 'dome'        as CamSub, label: 'Dome · Turret', glyphType: 'cam.dome'        as DeviceType, lucide: null },
                  { id: 'bullet'      as CamSub, label: 'Bullet',       glyphType: 'cam.bullet'      as DeviceType, lucide: null },
                  { id: 'multisensor' as CamSub, label: 'Multisensor',  glyphType: 'cam.multisensor' as DeviceType, lucide: null },
                ]).map((s) => {
                  const active = camSub === s.id;
                  const count = camSubCounts[s.id];
                  const LucideIcon = s.lucide;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setCamSub(s.id)}
                      data-testid={`cam-sub-${s.id}`}
                      title={`${s.label} · ${count}`}
                      className={`relative inline-flex flex-col items-center justify-center gap-0.5 w-[58px] h-[58px] rounded-lg border transition-colors ${
                        active
                          ? 'border-primary/40 bg-primary/12 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground hover:border-border-strong hover:bg-secondary/30'
                      }`}
                    >
                      {s.glyphType ? (
                        <DeviceGlyph type={s.glyphType} size={20} />
                      ) : LucideIcon ? (
                        <LucideIcon className="w-[20px] h-[20px]" strokeWidth={1.7} />
                      ) : null}
                      <span className="text-[9px] tracking-tight leading-none">{s.label.split(' · ')[0]}</span>
                      <span
                        className={`absolute top-0.5 right-1 text-[9px] tabular-nums leading-none ${
                          active ? 'text-primary/70' : 'text-muted-foreground/60'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              {camFiltered.length === 0 ? (
                <div className="px-5 py-8 text-center text-[12px] text-muted-foreground">
                  No cameras match those filters. Clear them, or search the full catalog from the bar below.
                </div>
              ) : (
                <>
                  <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground px-1">
                    {camFiltered.length} camera{camFiltered.length === 1 ? '' : 's'}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {camFiltered.map((p) => {
                      const tone = KIND_TONE[TYPE_KIND[p.type]] ?? 'var(--primary)';
                      return (
                        <button
                          key={p.id}
                          draggable
                          onDragStart={(e) => { beginProductDrag(p.id, e); setOpen(null); }}
                          onPointerDown={(e) => { onStartDrag(p, e); setOpen(null); }}
                          data-track={`bottombar-cam-${p.id}`}
                          className="group text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-[var(--shadow-low)] hover:-translate-y-[1px] transition-all p-3 flex flex-col gap-2"
                          style={{ transitionDuration: 'var(--motion-fast)' }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: `${tone}14`, color: tone, boxShadow: `inset 0 0 0 1px ${tone}55` }}>
                              <DeviceGlyph type={p.type} size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-medium tracking-tight truncate text-foreground">{p.model}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{p.mfr}</div>
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground line-clamp-2">{p.sub ?? '—'}</div>
                          <div className="flex items-center justify-between text-[10px]">
                            {(p as any).recommended ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-500">Recommended</span>
                            ) : <span />}
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <GripVertical className="w-3 h-3 opacity-60" />
                              Drag or click to place
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : trayProducts.length === 0 ? (
            <div className="px-5 py-8 text-center text-[12px] text-muted-foreground">
              No catalog items in this category yet.
            </div>
          ) : (
            // Default product-grid tray for acc / door / net / power / intercom / etc.
            // (Cameras get their own branch above with sub type tabs + filters.)
            // Cards carry an icon, manufacturer + model, and a per-card hint line.
            <div className="p-3 max-h-[360px] overflow-auto">
              <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1.5 px-1">{trayProducts.length} item{trayProducts.length === 1 ? '' : 's'}</div>
              <div className="grid grid-cols-4 gap-2">
                {trayProducts.map((p) => {
                  const tone = KIND_TONE[TYPE_KIND[p.type]] ?? 'var(--primary)';
                  return (
                    <button
                      key={p.id}
                      draggable
                      onDragStart={(e) => { beginProductDrag(p.id, e); setOpen(null); }}
                      onPointerDown={(e) => { onStartDrag(p, e); setOpen(null); }}
                      data-track={`bottombar-${trayCat.id}-${p.id}`}
                      className="group text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-[var(--shadow-low)] hover:-translate-y-[1px] transition-all p-3 flex flex-col gap-2"
                      style={{ transitionDuration: 'var(--motion-fast)' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: `${tone}14`, color: tone, boxShadow: `inset 0 0 0 1px ${tone}55` }}>
                          <DeviceGlyph type={p.type} size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium tracking-tight truncate text-foreground">{p.model}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{p.mfr}</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{p.sub ?? p.notes ?? '—'}</div>
                      <div className="flex items-center justify-between text-[10px]">
                        {(p as any).recommended ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-500">Recommended</span>
                        ) : <span />}
                        {/* V3.8 — explicit drag affordance. The cursor-grab
                            on the button already signals it; the icon makes
                            the affordance read at a glance without growing
                            the card height. */}
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <GripVertical className="w-3 h-3 opacity-60" />
                          Drag or click to place
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* The bar itself — Item 3 adopts the left-rail visual language.
          Icons-only by default with a compact ~44 px tile per category.
          On hover (desktop) or tap (touch) the bar reveals the per-
          category label, the per-group header, and the count badge
          on any category that has placed devices. Counts always read
          from countByCat (real placements) — no fabricated dots. */}
      <div
        onMouseEnter={() => !barCoarsePointer && setBarHover(true)}
        onMouseLeave={() => !barCoarsePointer && setBarHover(false)}
        onTouchStart={() => barCoarsePointer && setBarTapExpand(true)}
        data-bar-expanded={barExpanded ? 'true' : undefined}
        className="flex items-center rounded-2xl border backdrop-blur-md shadow-[0_18px_36px_-18px_rgba(0,0,0,0.65)]"
        style={{
          background: 'var(--canvas-rail)',
          borderColor: 'var(--canvas-rail-border)',
          // Item 1 — chrome matches the left tool rail exactly:
          // rounded-2xl, canvas-rail background, canvas-rail-border,
          // backdrop blur, same shadow strength. The bar floats over
          // the canvas, the plan extends beneath, no docked white
          // band behind it. Hover transition keeps the single
          // motion-standard / ease-out token from the prior pass.
          transitionProperty: 'background-color, border-color',
          transitionDuration: 'var(--motion-standard)',
          transitionTimingFunction: 'var(--ease-out)',
        }}
      >
        {GROUPS.map((g, gi) => {
          const groupCats = cats.filter((c) => c.group === g.id);
          if (groupCats.length === 0) return null;
          return (
            <div key={g.id} className="flex items-stretch">
              {gi > 0 && <span aria-hidden className="self-stretch w-px bg-white/10 my-1.5" />}
              <div className="flex flex-col justify-center">
                {/* Group header — always rendered to keep the bar's
                    geometry settled. Visible only when expanded via
                    opacity + max-height transitions tied to the single
                    --motion-standard / --ease-out pair. */}
                <div
                  className="px-2 text-[9px] uppercase tracking-[0.10em] font-medium text-white/45 whitespace-nowrap overflow-hidden"
                  style={{
                    maxHeight: barExpanded ? 14 : 0,
                    paddingTop: barExpanded ? 4 : 0,
                    opacity: barExpanded ? 1 : 0,
                    transitionProperty: 'max-height, padding-top, opacity',
                    transitionDuration: 'var(--motion-standard)',
                    transitionTimingFunction: 'var(--ease-out)',
                  }}
                >
                  {g.label}
                </div>
                <div className="flex items-center">
                  {groupCats.map((c) => {
                    const Icon = c.icon;
                    const isToolCat = !!c.tool;
                    const active = isToolCat ? tool === c.tool : open === c.id;
                    const count = productsByCat[c.id]?.length ?? 0;
                    const isConduitCat = c.id === 'conduit';
                    const isCableCat   = c.id === 'cable';
                    const dead = !isToolCat && !isConduitCat && !isCableCat && count === 0;
                    if (dead) return null;
                    const placedCount = countByCat[c.id] ?? 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          if (searchQuery) setSearchQuery('');
                          if (isToolCat && c.tool) { onPickTool(c.tool); setOpen(null); return; }
                          setOpen(open === c.id ? null : c.id);
                        }}
                        title={`${c.label}${placedCount > 0 ? ` · ${placedCount} placed` : ''}`}
                        data-track={`bottombar-cat-${c.id}`}
                        className={`group relative flex flex-col items-center justify-center w-[56px] pt-1.5 pb-2 ${active ? 'text-white' : 'text-white/65 hover:text-white'}`}
                        style={{
                          transitionProperty: 'color',
                          transitionDuration: 'var(--motion-standard)',
                          transitionTimingFunction: 'var(--ease-out)',
                        }}
                      >
                        <span className="absolute inset-x-1.5 top-1 bottom-1.5 rounded-md -z-10"
                          style={{
                            background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                            transitionProperty: 'background-color',
                            transitionDuration: 'var(--motion-standard)',
                            transitionTimingFunction: 'var(--ease-out)',
                          }}
                        />
                        <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
                        {/* Label — always in DOM at fixed width; opacity +
                            max-height drive visibility so the bar grows
                            and shrinks smoothly with no layout fights. */}
                        <span
                          className="text-[10px] tracking-tight font-medium whitespace-nowrap overflow-hidden"
                          style={{
                            maxHeight: barExpanded ? 14 : 0,
                            opacity: barExpanded ? 1 : 0,
                            marginTop: barExpanded ? 2 : 0,
                            transitionProperty: 'max-height, opacity, margin-top',
                            transitionDuration: 'var(--motion-standard)',
                            transitionTimingFunction: 'var(--ease-out)',
                          }}
                        >{c.label}</span>
                        {placedCount > 0 && (
                          <span
                            className={`absolute top-0.5 right-1 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] leading-[15px] text-center font-medium tabular-nums ${
                              active
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-white/15 text-white border border-white/15'
                            }`}
                          >
                            {placedCount > 99 ? '99+' : placedCount}
                          </span>
                        )}
                        <span
                          className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full transition-opacity"
                          style={{ background: 'var(--primary)', opacity: active ? 1 : 0 }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
        {/* Product search — Pass B collapses the input behind a single
            icon by default to keep the bar calm. Clicking the icon
            expands to the textbox; outside-click and Escape collapse
            back and clear the query. Haystack stays the same
            (manufacturer, model, productLine, productName, cameraType,
            subcategory, resolution, sub). The floating results panel
            above the bar is unchanged. */}
        <span aria-hidden className="self-stretch w-px bg-white/10 my-1.5" />
        <div className="flex flex-col justify-center">
          <div
            className="px-2 text-[9px] uppercase tracking-[0.10em] font-medium text-white/45 whitespace-nowrap overflow-hidden"
            style={{
              maxHeight: barExpanded ? 14 : 0,
              paddingTop: barExpanded ? 4 : 0,
              opacity: barExpanded ? 1 : 0,
              transitionProperty: 'max-height, padding-top, opacity',
              transitionDuration: 'var(--motion-standard)',
              transitionTimingFunction: 'var(--ease-out)',
            }}
          >
            Search
          </div>
          <div className="flex items-center px-2 py-1.5">
            {!searchOpen ? (
              <button
                onClick={() => setSearchOpen(true)}
                title="Search products"
                aria-label="Search products"
                data-testid="bottombar-search-icon"
                className={`w-[34px] h-[34px] flex items-center justify-center rounded-md border transition-colors ${
                  searchQuery
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-white/10 text-white/65 hover:text-white hover:bg-white/8'
                }`}
              >
                <Search className="w-4 h-4" />
              </button>
            ) : (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/55" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products"
                  data-testid="bottombar-search-input"
                  aria-label="Search products"
                  className="w-[200px] h-[34px] pl-7 pr-7 text-[12px] rounded-md border border-white/10 bg-white/5 text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-white/40"
                />
                <button
                  onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-white/65 hover:text-white"
                  title="Collapse search"
                  aria-label="Collapse search"
                  data-testid="bottombar-search-collapse"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
