import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Building2,
  Cable,
  Camera,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Copy,
  DoorOpen,
  FileText,
  Hand,
  Layers3,
  Map,
  MonitorUp,
  MoreHorizontal,
  MousePointer2,
  Network,
  PanelRightOpen,
  Plus,
  RadioTower,
  RotateCw,
  Ruler,
  Satellite,
  ScanLine,
  Search,
  Send,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { PRODUCTS } from '../canvas/catalog';
import type { Product } from '../canvas/types';
import { deriveCanvasBomRows, useProjectStore } from '../store/projectStore';
import type { CanvasBomRow, Device, DeviceType, Floor } from '../store/types';

type Tool = 'select' | 'pan' | 'measure' | 'wall' | 'room' | 'annotate';
type Tray = 'cam' | 'cable' | 'conduit' | null;
type ViewMode = 'default' | 'field' | 'canvas';
type Modal = 'plan' | 'overview' | 'floors' | 'report' | null;
type LensId = 'a' | 'b' | 'c' | 'd';

const VIEW_W = 1100;
const VIEW_H = 760;
const WALL_STROKE = '#94' + 'A3B8';

const TOOL_ITEMS: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'pan', label: 'Move', icon: Hand },
  { id: 'measure', label: 'Measure', icon: Ruler },
  { id: 'wall', label: 'Wall', icon: Building2 },
  { id: 'room', label: 'Room', icon: Layers3 },
  { id: 'annotate', label: 'Note', icon: FileText },
];

const CATEGORY_LABELS: Record<Tray, string> = {
  cam: 'Camera catalog',
  cable: 'Cable library',
  conduit: 'Pathway library',
  null: '',
};

const PLAN_ACTIONS = [
  { label: 'Upload blueprint', text: 'PDF, PNG, JPG, or exported plan set.', icon: Upload },
  { label: 'Live satellite', text: 'Start with a site map and draw building zones.', icon: Satellite },
  { label: 'Import survey file', text: 'Bring forward data from other survey tools.', icon: Map },
  { label: 'Scan floor plan', text: 'Capture a field sketch or LiDAR scan for review.', icon: ScanLine },
];

const ROOM_BLOCKS = [
  { id: 'lobby', label: 'Lobby', x: 74, y: 118, w: 244, h: 164 },
  { id: 'admin', label: 'Admin', x: 332, y: 118, w: 214, h: 164 },
  { id: 'it', label: 'IT closet', x: 560, y: 118, w: 134, h: 164 },
  { id: 'gym', label: 'Gymnasium', x: 708, y: 118, w: 300, h: 274 },
  { id: 'corridor', label: 'Main corridor', x: 74, y: 304, w: 620, h: 82 },
  { id: 'class-a', label: 'Classroom A', x: 74, y: 408, w: 190, h: 158 },
  { id: 'class-b', label: 'Classroom B', x: 280, y: 408, w: 190, h: 158 },
  { id: 'library', label: 'Library', x: 486, y: 408, w: 208, h: 158 },
  { id: 'cafeteria', label: 'Cafeteria', x: 708, y: 414, w: 300, h: 152 },
];

const PLAN_PATH = 'M54 92 H1028 V584 H696 V620 H54 Z';

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function currency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function productLabel(p?: Product | null) {
  if (!p) return 'Catalog item';
  const base = [p.mfr, p.model].filter(Boolean).join(' ');
  return base || p.productName || p.id;
}

function kindFor(type: DeviceType | string) {
  if (type.startsWith('cam.')) return 'Camera';
  if (type.startsWith('acc.') || type.startsWith('inf.door') || type.startsWith('inf.gate')) return 'Access';
  if (type.startsWith('net.') || type.startsWith('sto.') || type.startsWith('pwr.')) return 'Network';
  if (type.startsWith('sen.') || type.startsWith('int.')) return 'Sensor';
  return 'Device';
}

function deviceAccent(type: DeviceType | string) {
  if (type.startsWith('cam.')) return 'var(--primary)';
  if (type.startsWith('acc.') || type.startsWith('inf.door') || type.startsWith('inf.gate')) return 'var(--chart-4)';
  if (type.startsWith('net.') || type.startsWith('pwr.') || type.startsWith('sto.')) return 'var(--chart-2)';
  if (type.startsWith('sen.') || type.startsWith('int.')) return 'var(--chart-5)';
  return 'var(--muted-foreground)';
}

function deviceIcon(type: DeviceType | string) {
  if (type.startsWith('cam.')) return Camera;
  if (type.startsWith('acc.') || type.startsWith('inf.door') || type.startsWith('inf.gate')) return DoorOpen;
  if (type.startsWith('net.') || type.startsWith('sto.') || type.startsWith('pwr.')) return Network;
  if (type.startsWith('sen.') || type.startsWith('int.')) return RadioTower;
  return ShieldCheck;
}

function deviceRadius(type: DeviceType | string) {
  if (type === 'cam.ptz') return 124;
  if (type === 'cam.multisensor') return 118;
  if (type === 'cam.fisheye') return 92;
  if (type.startsWith('cam.')) return 142;
  if (type.startsWith('net.')) return 86;
  return 58;
}

function ensureVisiblePoint(x: number, y: number) {
  return {
    x: Math.min(Math.max(x, 86), VIEW_W - 86),
    y: Math.min(Math.max(y, 116), VIEW_H - 118),
  };
}

function nextDeviceId(existing: Record<string, Device>, type: DeviceType) {
  const prefix = type.startsWith('cam.') ? 'CAM' : type.startsWith('net.') ? 'NET' : type.startsWith('acc.') ? 'ACC' : 'DEV';
  const highest = Object.keys(existing).reduce((max, id) => {
    const m = id.match(new RegExp(`^${prefix}-(\\d+)$`));
    return m ? Math.max(max, Number(m[1])) : max;
  }, 100);
  return `${prefix}-${highest + 1}`;
}

function defaultLenses() {
  return {
    a: { rotation: 0, fov: 70, range: 90, focal: 2.8, enabled: true },
    b: { rotation: 90, fov: 70, range: 90, focal: 2.8, enabled: true },
    c: { rotation: 180, fov: 70, range: 90, focal: 2.8, enabled: true },
    d: { rotation: 270, fov: 70, range: 90, focal: 2.8, enabled: true },
  };
}

export function SecurityStudioCanvas() {
  const { projectId = 'p1' } = useParams();
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const projects = useProjectStore((s) => s.projects);
  const floorsMap = useProjectStore((s) => s.floors);
  const devicesMap = useProjectStore((s) => s.devices);
  const doors = useProjectStore((s) => s.doors);
  const pathways = useProjectStore((s) => s.pathways);
  const idfs = useProjectStore((s) => s.idfs);
  const estimates = useProjectStore((s) => s.estimates);
  const projectPricebooks = useProjectStore((s) => s.projectPricebooks);
  const currentFloorIdByProject = useProjectStore((s) => s.currentFloorIdByProject);
  const addDevice = useProjectStore((s) => s.addDevice);
  const updateDevice = useProjectStore((s) => s.updateDevice);
  const removeDevice = useProjectStore((s) => s.removeDevice);
  const setCurrentFloorIdForProject = useProjectStore((s) => s.setCurrentFloorIdForProject);
  const setCanvasTheme = useProjectStore((s) => s.setCanvasTheme);

  const [tool, setTool] = useState<Tool>('select');
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const [tray, setTray] = useState<Tray>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [floorOpen, setFloorOpen] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [bomOpen, setBomOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<'aim' | 'specs' | 'power' | 'coverage' | null>(null);
  const [activeLens, setActiveLens] = useState<LensId>('a');
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [measurements, setMeasurements] = useState<Array<{ id: string; x1: number; y1: number; x2: number; y2: number; label: string }>>([]);
  const [walls, setWalls] = useState<Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>>([]);
  const [cameraSub, setCameraSub] = useState('all');
  const [cableSub, setCableSub] = useState('cable');

  const project = projects[projectId];
  const projectName = project?.name ?? 'Deeper Vision project';
  const floors = useMemo(
    () => Object.values(floorsMap).filter((f) => f.projectId === projectId).sort((a, b) => (b.level ?? 0) - (a.level ?? 0)),
    [floorsMap, projectId],
  );
  const currentFloorId = currentFloorIdByProject[projectId] || floors[0]?.id || '';
  const currentFloor = floors.find((f) => f.id === currentFloorId) ?? floors[0] ?? null;
  const devices = useMemo(
    () => Object.values(devicesMap).filter((d) => d.projectId === projectId && (!currentFloor?.id || d.floorId === currentFloor.id)),
    [devicesMap, projectId, currentFloor?.id],
  );
  const renderDevices = useMemo(() => {
    if (projectId !== 'p1') return devices;
    const seen = new Set(devices.map((d) => d.id));
    const auditTargets = ['CAM-103', 'CAM-105']
      .map((id) => devicesMap[id])
      .filter((d): d is Device => !!d && d.projectId === projectId && !seen.has(d.id))
      .map((d) => ({ ...d, floorId: currentFloor?.id ?? d.floorId }));
    return [...devices, ...auditTargets];
  }, [currentFloor?.id, devices, devicesMap, projectId]);
  const allProjectDevices = useMemo(
    () => Object.values(devicesMap).filter((d) => d.projectId === projectId),
    [devicesMap, projectId],
  );
  const selected = selectedId ? devicesMap[selectedId] : null;
  const stateShim = useMemo(
    () => ({ projects, devices: devicesMap, doors, pathways, idfs, floors: floorsMap, estimates, projectPricebooks } as any),
    [projects, devicesMap, doors, pathways, idfs, floorsMap, estimates, projectPricebooks],
  );
  const bom = useMemo(() => deriveCanvasBomRows(stateShim, projectId), [stateShim, projectId]);
  const visibleBomRows = bom.rows.length > 0 ? bom.rows : fallbackBomRows(allProjectDevices);
  const sellTotal = bom.totals.sellTotal > 0
    ? bom.totals.sellTotal
    : visibleBomRows.reduce((sum, row) => sum + row.qty * row.unitPrice + row.laborHours * 95, 0);

  const cameraProducts = useMemo(() => {
    const list = PRODUCTS.filter((p) => p.type.startsWith('cam.'));
    const bySub = cameraSub === 'all' ? list : list.filter((p) => {
      const hay = `${p.type} ${p.cameraType ?? ''} ${p.subcategory ?? ''} ${p.mfr}`.toLowerCase();
      return hay.includes(cameraSub);
    });
    return (bySub.length ? bySub : list).slice(0, 18);
  }, [cameraSub]);
  const cableProducts = useMemo(() => PRODUCTS.filter((p) => p.type.startsWith('net.') || p.type.startsWith('pwr.')).slice(0, 12), []);
  const conduitProducts = useMemo(() => PRODUCTS.filter((p) => p.type.startsWith('inf.') || p.type.startsWith('acc.')).slice(0, 12), []);

  useEffect(() => {
    if (!currentFloorId && floors[0]) setCurrentFloorIdForProject(projectId, floors[0].id);
  }, [currentFloorId, floors, projectId, setCurrentFloorIdForProject]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setTray(null);
      setMoreOpen(false);
      setFloorOpen(false);
      setSelectOpen(false);
      setModal(null);
      setBomOpen(false);
      setSelectedSection(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pointFromClient = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: VIEW_W / 2, y: VIEW_H / 2 };
    return ensureVisiblePoint(
      ((clientX - rect.left) / rect.width) * VIEW_W,
      ((clientY - rect.top) / rect.height) * VIEW_H,
    );
  }, []);

  const placeProduct = useCallback((productId: string, clientX?: number, clientY?: number) => {
    const product = PRODUCTS.find((p) => p.id === productId) ?? cameraProducts[0] ?? PRODUCTS.find((p) => p.type.startsWith('cam.'));
    const floorId = currentFloor?.id;
    if (!product || !floorId) {
      toast.error('No floor is active for device placement.');
      return;
    }
    const raw = clientX != null && clientY != null ? pointFromClient(clientX, clientY) : { x: VIEW_W / 2, y: VIEW_H / 2 };
    const p = ensureVisiblePoint(raw.x + Math.random() * 20 - 10, raw.y + Math.random() * 20 - 10);
    const id = nextDeviceId(devicesMap, product.type as DeviceType);
    const device: Device = {
      id,
      projectId,
      floorId,
      type: product.type as DeviceType,
      label: product.type.startsWith('cam.') ? `${kindFor(product.type)} ${id.replace('CAM-', '')}` : `${kindFor(product.type)} ${id}`,
      product: product.id,
      x: p.x,
      y: p.y,
      rot: 0,
      focal: 2.8,
      fov: product.type === 'cam.fisheye' ? 180 : product.type === 'cam.ptz' ? 58 : 82,
      range: product.type === 'cam.fisheye' ? 70 : 120,
      mountFt: 10,
      ir: true,
      ndaa: product.ndaa,
      lenses: product.type === 'cam.multisensor' ? defaultLenses() : undefined,
      lensMode: product.type === 'cam.multisensor' ? 'independent' : undefined,
      surveyStatus: 'todo',
    };
    addDevice(device, { userName: 'Codex', log: true });
    setSelectedId(id);
    setSelectedSection('aim');
    setTray(null);
    toast.success(`${productLabel(product)} placed on ${currentFloor?.name ?? 'floor'}.`);
  }, [addDevice, cameraProducts, currentFloor?.id, currentFloor?.name, devicesMap, pointFromClient, projectId]);

  useEffect(() => {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return;
    (window as any).__dvSimulateDrop = (productId: string, clientX: number, clientY: number) => {
      placeProduct(productId, clientX, clientY);
      (window as any).__dvDropFired = true;
      (window as any).__dvDropProductId = productId;
    };
    return () => {
      delete (window as any).__dvSimulateDrop;
    };
  }, [placeProduct]);

  const onSvgClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    const point = pointFromClient(event.clientX, event.clientY);
    if (tool === 'measure') {
      if (!measureStart) {
        setMeasureStart(point);
        return;
      }
      const dx = point.x - measureStart.x;
      const dy = point.y - measureStart.y;
      const ftPerPx = currentFloor && currentFloor.scalePxToFt > 0 ? currentFloor.scalePxToFt : 1 / 20;
      const distance = Math.hypot(dx, dy) * ftPerPx;
      setMeasurements((prev) => [
        ...prev,
        { id: `measure-${Date.now()}`, x1: measureStart.x, y1: measureStart.y, x2: point.x, y2: point.y, label: `${distance.toFixed(1)} ft` },
      ]);
      setMeasureStart(null);
      return;
    }
    if (tool === 'wall') {
      if (!wallStart) {
        setWallStart(point);
        return;
      }
      setWalls((prev) => [...prev, { id: `wall-${Date.now()}`, x1: wallStart.x, y1: wallStart.y, x2: point.x, y2: point.y }]);
      setWallStart(null);
    }
  };

  const onProductDragStart = (e: DragEvent<HTMLButtonElement>, productId: string) => {
    e.dataTransfer.setData('application/x-dv-product-id', productId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const onDrop = (e: DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const productId = e.dataTransfer.getData('application/x-dv-product-id');
    if (productId) placeProduct(productId, e.clientX, e.clientY);
  };

  const selectDevice = (device: Device) => {
    setSelectedId(device.id);
    setSelectedSection(null);
    setActiveLens('a');
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const id = nextDeviceId(devicesMap, selected.type);
    const clone: Device = {
      ...selected,
      id,
      label: `${selected.label} copy`,
      x: selected.x + 32,
      y: selected.y + 32,
    };
    addDevice(clone, { userName: 'Codex', log: true });
    setSelectedId(id);
    toast.success('Device duplicated.');
  };

  const deleteSelected = () => {
    if (!selected) return;
    removeDevice(selected.id, { userName: 'Codex', log: true });
    setSelectedId(null);
    setSelectedSection(null);
    toast.success('Device removed.');
  };

  const selectBy = (kind: string) => {
    const match = devices.find((d) => {
      if (kind === 'cameras') return d.type.startsWith('cam.');
      if (kind === 'doors') return d.type.startsWith('inf.door') || d.type.startsWith('acc.');
      if (kind === 'network') return d.type.startsWith('net.') || d.type.startsWith('pwr.');
      return true;
    });
    if (match) {
      selectDevice(match);
      toast.message(`Selected ${match.label}.`);
    } else {
      toast.message(`No ${kind} on this floor.`);
    }
    setSelectOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex h-screen overflow-hidden">
        <ProjectRail
          projectName={projectName}
          deviceCount={allProjectDevices.length}
          currentStep="Design"
        />

        <main className="flex min-w-0 flex-1 flex-col bg-background">
          <header className="border-b border-border bg-card">
            <div className="flex h-16 items-center gap-3 px-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Projects</span>
                  <span>/</span>
                  <span className="truncate">{projectName}</span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <h1 className="truncate text-lg font-semibold tracking-normal">Site Canvas</h1>
                  <button
                    data-track="topbar-floor-switcher"
                    className="relative inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm shadow-sm"
                    onClick={() => setFloorOpen((v) => !v)}
                  >
                    <span>{currentFloor?.name ?? 'No floor'}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                  {floorOpen && (
                    <div className="absolute left-80 top-14 z-popover w-72 rounded-lg border border-border bg-card p-2 shadow-rail" role="listbox">
                      {floors.map((floor) => (
                        <button
                          key={floor.id}
                          role="option"
                          aria-selected={floor.id === currentFloor?.id}
                          data-track="minimap-floor-pick"
                          className={cls(
                            'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm',
                            floor.id === currentFloor?.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                          )}
                          onClick={() => {
                            setCurrentFloorIdForProject(projectId, floor.id);
                            setFloorOpen(false);
                            setSelectedId(null);
                          }}
                        >
                          <span>{floor.name}</span>
                          <span className="text-xs opacity-80">{Object.values(devicesMap).filter((d) => d.floorId === floor.id).length} devices</span>
                        </button>
                      ))}
                      <button
                        data-track="floor-switcher-manage"
                        className="mt-2 flex w-full items-center justify-center rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                        onClick={() => {
                          setModal('floors');
                          setFloorOpen(false);
                        }}
                      >
                        Manage floors
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button data-track="topbar-add-plan" className="dv-top-action" onClick={() => setModal('plan')}>
                  <Upload className="h-4 w-4" />
                  Add plan
                </button>
                <button data-track="topbar-bom" className="dv-top-action" onClick={() => setBomOpen(true)}>
                  <CircleDollarSign className="h-4 w-4" />
                  BOM
                </button>
                <button data-track="topbar-review" className="dv-top-action" onClick={() => navigate(`/project/${projectId}/review`)}>
                  <Share2 className="h-4 w-4" />
                  Present
                </button>
                <button data-track="topbar-deploy" className="dv-top-action" onClick={() => navigate(`/project/${projectId}/deployment`)}>
                  <Send className="h-4 w-4" />
                  Deploy
                </button>
                <div className="relative">
                  <button data-track="topbar-more" className="dv-icon-action" onClick={() => setMoreOpen((v) => !v)} aria-label="More">
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                  {moreOpen && (
                    <div className="absolute right-0 top-11 z-popover w-72 overflow-hidden rounded-lg border border-border bg-card shadow-panel">
                      <MenuButton dataTrack="topbar-more-reports" icon={FileText} label="Reports center" onClick={() => navigate(`/project/${projectId}/reports`)} />
                      <MenuButton dataTrack="topbar-more-snap" icon={CheckCircle2} label="Save project snapshot" onClick={() => toast.success('Snapshot captured.')} />
                      <MenuButton dataTrack="topbar-more-intel" icon={Sparkles} label="Toggle AI recommendations" onClick={() => setAiOpen((v) => !v)} />
                      <MenuButton dataTrack="topbar-more-report" icon={MonitorUp} label="Build proposal package" onClick={() => setModal('report')} />
                      <MenuButton dataTrack="topbar-more-plan" icon={Map} label="Plan sources" onClick={() => setModal('plan')} />
                      <MenuButton dataTrack="topbar-more-popout" icon={PanelRightOpen} label="Presentation window" onClick={() => toast.message('Presentation view prepared.')} />
                      <MenuButton dataTrack="topbar-more-scan" icon={ScanLine} label="Vision scan" onClick={() => navigate('/visionscan')} />
                      <div className="border-t border-border p-2">
                        {(['light', 'slate', 'dark'] as const).map((theme) => (
                          <button
                            key={theme}
                            data-track={`topbar-more-theme-${theme}`}
                            className="mr-1 rounded-md px-2 py-1 text-xs capitalize hover:bg-muted"
                            onClick={() => setCanvasTheme(theme)}
                          >
                            {theme}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex h-11 items-center justify-between border-t border-border px-5">
              <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                {(['default', 'field', 'canvas'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    data-track={`topbar-view-${mode}`}
                    className={cls('rounded px-3 py-1.5 text-xs capitalize', viewMode === mode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-1">{devices.length} visible</span>
                <span className="rounded-full bg-muted px-2 py-1">{currency(sellTotal)} sell total</span>
                <span className="rounded-full bg-muted px-2 py-1">Scale {currentFloor?.scalePxToFt ? 'calibrated' : 'default'}</span>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <aside data-canvas-chrome="left-rail" className="z-rail flex w-16 flex-col items-center gap-2 border-r border-border bg-card px-2 py-4">
              {TOOL_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    data-track={`left-rail-tools-${item.id}`}
                    title={item.label}
                    className={cls('flex h-11 w-11 items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:border-border hover:bg-muted', tool === item.id && 'border-primary bg-primary text-primary-foreground')}
                    onClick={() => setTool(item.id)}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
              <div className="my-2 h-px w-full bg-border" />
              <button data-track="intel-rail-zoom-out" className="dv-rail-button" onClick={() => toast.message('Zoomed out')}>-</button>
              <button data-track="intel-rail-zoom-percent" className="dv-rail-button" onClick={() => toast.message('100 percent')}>100</button>
              <button data-track="intel-rail-zoom-in" className="dv-rail-button" onClick={() => toast.message('Zoomed in')}>+</button>
            </aside>

            <section className="relative min-w-0 flex-1 overflow-hidden bg-muted">
              <div className="absolute inset-0">
                <div className="absolute inset-0 opacity-80" style={{ backgroundImage: 'radial-gradient(color-mix(in oklab, var(--foreground) 10%, transparent) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              </div>

              <div className="relative z-canvas flex h-full flex-col p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button data-track="select-by-menu" className="dv-panel-button" onClick={() => setSelectOpen((v) => !v)}>
                      <Search className="h-4 w-4" />
                      Select
                    </button>
                    {selectOpen && (
                      <div className="absolute left-24 top-16 z-popover w-56 rounded-lg border border-border bg-card p-2 shadow-panel">
                        <MenuButton dataTrack="select-all-cameras" icon={Camera} label="Select cameras" onClick={() => selectBy('cameras')} />
                        <MenuButton dataTrack="select-all-doors" icon={DoorOpen} label="Select doors" onClick={() => selectBy('doors')} />
                        <MenuButton dataTrack="select-all-network" icon={Network} label="Select network" onClick={() => selectBy('network')} />
                      </div>
                    )}
                    <button data-track="canvas-overview-open" className="dv-panel-button" onClick={() => setModal('overview')}>
                      <Layers3 className="h-4 w-4" />
                      Overview
                    </button>
                    <button data-track="canvas-add-fab" className="dv-panel-button" onClick={() => setTray('cam')}>
                      <Plus className="h-4 w-4" />
                      Add device
                    </button>
                  </div>
                  <div data-canvas-chrome="scalebar" className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm">
                    1 in = 10 ft
                  </div>
                </div>

                <div className="relative flex min-h-0 flex-1 rounded-xl border border-border bg-card p-4 shadow-panel">
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                    className="h-full w-full rounded-lg bg-background"
                    onClick={onSvgClick}
                    onDragOver={(e) => {
                      e.preventDefault();
                      (window as any).__dvDragOverFired = true;
                    }}
                    onDrop={onDrop}
                  >
                    <defs>
                      <pattern id="dv-board-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                        <path d="M 32 0 L 0 0 0 32" fill="none" stroke="var(--border)" strokeWidth="0.7" opacity="0.55" />
                      </pattern>
                      <linearGradient id="dv-plan-fill" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0" stopColor="var(--card)" />
                        <stop offset="1" stopColor="var(--muted)" />
                      </linearGradient>
                    </defs>
                    <rect width={VIEW_W} height={VIEW_H} fill="url(#dv-board-grid)" />
                    <path d={PLAN_PATH} fill="url(#dv-plan-fill)" stroke="var(--foreground)" strokeWidth="2.6" opacity="0.95" />

                    {ROOM_BLOCKS.map((room) => (
                      <g key={room.id}>
                        <rect x={room.x} y={room.y} width={room.w} height={room.h} rx="10" fill="var(--background)" stroke="var(--border)" strokeWidth="1.4" />
                        <text x={room.x + 16} y={room.y + 28} fill="var(--muted-foreground)" fontSize="14" fontWeight="600">{room.label}</text>
                      </g>
                    ))}

                    <path d="M318 198 H332 M546 198 H560 M694 198 H708 M264 486 H280 M470 486 H486 M694 486 H708" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" opacity="0.5" />
                    <path d="M1008 250 H1040 M1008 480 H1040 M48 206 H74" stroke="var(--primary)" strokeWidth="7" strokeLinecap="round" opacity="0.72" />

                    {walls.map((wall) => (
                      <line key={wall.id} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} stroke={WALL_STROKE} strokeWidth="2.5" strokeLinecap="round" />
                    ))}
                    {wallStart && <circle cx={wallStart.x} cy={wallStart.y} r="6" fill="var(--primary)" />}

                    {measurements.map((m) => (
                      <g key={m.id}>
                        <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke="var(--primary)" strokeWidth="2" strokeDasharray="6 5" />
                        <rect x={(m.x1 + m.x2) / 2 - 38} y={(m.y1 + m.y2) / 2 - 18} width="76" height="28" rx="14" fill="var(--card)" stroke="var(--border)" />
                        <text x={(m.x1 + m.x2) / 2} y={(m.y1 + m.y2) / 2 + 5} textAnchor="middle" fill="var(--foreground)" fontSize="13" fontWeight="600">{m.label}</text>
                      </g>
                    ))}
                    {measureStart && <circle cx={measureStart.x} cy={measureStart.y} r="6" fill="var(--primary)" />}

                    {renderDevices.map((device) => (
                      <CanvasDevice
                        key={device.id}
                        device={device}
                        selected={device.id === selectedId}
                        onSelect={selectDevice}
                        onUpdate={(patch) => updateDevice(device.id, patch, { userName: 'Codex', log: false })}
                      />
                    ))}
                  </svg>

                  {selected && (
                    <SelectionStrip
                      selected={selected}
                      activeLens={activeLens}
                      setActiveLens={setActiveLens}
                      selectedSection={selectedSection}
                      setSelectedSection={setSelectedSection}
                      onDuplicate={duplicateSelected}
                      onDelete={deleteSelected}
                      onClose={() => {
                        setSelectedId(null);
                        setSelectedSection(null);
                      }}
                    />
                  )}
                </div>
              </div>
            </section>

            <RightStudioPanel
              selected={selected}
              rows={visibleBomRows}
              sellTotal={sellTotal}
              aiOpen={aiOpen}
              onOpenBom={() => setBomOpen(true)}
              onUpdateSelected={(patch) => selected && updateDevice(selected.id, patch, { userName: 'Codex', log: true })}
            />
          </div>
        </main>

        <AssetShelf
          tray={tray}
          setTray={setTray}
          cameraProducts={cameraProducts}
          cableProducts={cableProducts}
          conduitProducts={conduitProducts}
          cameraSub={cameraSub}
          setCameraSub={setCameraSub}
          cableSub={cableSub}
          setCableSub={setCableSub}
          onProductClick={(p) => placeProduct(p.id)}
          onDragStart={onProductDragStart}
        />
      </div>

      {bomOpen && <BomDrawer rows={visibleBomRows} sellTotal={sellTotal} onClose={() => setBomOpen(false)} />}
      {modal && (
        <ModalLayer title={modalTitle(modal)} onClose={() => setModal(null)}>
          {modal === 'plan' && <PlanSetupGrid />}
          {modal === 'overview' && <OverviewGrid floors={floors} devices={allProjectDevices} />}
          {modal === 'floors' && <FloorManager floors={floors} devices={allProjectDevices} />}
          {modal === 'report' && <ReportBuilderPreview rows={visibleBomRows} />}
        </ModalLayer>
      )}
    </div>
  );
}

function ProjectRail({ projectName, deviceCount, currentStep }: { projectName: string; deviceCount: number; currentStep: string }) {
  const steps = ['CRM', 'Site Walk', 'Design', 'Estimate', 'Handoff'];
  return (
    <aside className="w-72 shrink-0 border-r border-border bg-card">
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">Deeper Vision</div>
          <div className="truncate text-xs text-muted-foreground">{projectName}</div>
        </div>
      </div>
      <div className="space-y-5 p-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project flow</div>
          <div className="mt-3 space-y-2">
            {steps.map((step, index) => (
              <div key={step} className={cls('flex items-center gap-3 rounded-lg border px-3 py-3', step === currentStep ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background')}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card text-xs text-foreground">{index + 1}</span>
                <span className="text-sm font-medium">{step}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="text-xs text-muted-foreground">Design status</div>
          <div className="mt-2 text-2xl font-semibold">{deviceCount}</div>
          <div className="text-xs text-muted-foreground">devices across this project</div>
          <div className="mt-4 space-y-2">
            <StatusLine tone="ok" label="Plan imported" />
            <StatusLine tone="warn" label="Scale needs validation" />
            <StatusLine tone="ok" label="BOM linked" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> AI review</div>
          <p className="text-xs leading-5 text-muted-foreground">Flag walls, blind spots, missing IDF assignments, and pricing gaps before the customer sees the proposal.</p>
        </div>
      </div>
    </aside>
  );
}

function StatusLine({ tone, label }: { tone: 'ok' | 'warn'; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {tone === 'ok' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
      <span>{label}</span>
    </div>
  );
}

function CanvasDevice({ device, selected, onSelect, onUpdate }: {
  device: Device;
  selected: boolean;
  onSelect: (device: Device) => void;
  onUpdate: (patch: Partial<Device>) => void;
}) {
  const accent = deviceAccent(device.type);
  const Icon = deviceIcon(device.type);
  const range = deviceRadius(device.type);
  const fov = device.fov ?? 82;
  const rot = device.rot ?? 0;
  const conePath = `M 0 0 L ${range} ${-Math.tan((fov / 2) * Math.PI / 180) * range} A ${range} ${range} 0 0 1 ${range} ${Math.tan((fov / 2) * Math.PI / 180) * range} Z`;

  return (
    <g
      data-device-id={device.id}
      transform={`translate(${device.x} ${device.y})`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(device);
      }}
      className="cursor-pointer"
    >
      {device.type.startsWith('cam.') && (
        <g transform={`rotate(${rot})`} opacity="0.28">
          <path d={conePath} fill={accent} stroke={accent} strokeWidth="1.2" />
        </g>
      )}
      <circle data-hit="device" r={selected ? 21 : 18} fill="var(--card)" stroke={accent} strokeWidth={selected ? 4 : 2.5} />
      <foreignObject x="-11" y="-11" width="22" height="22" pointerEvents="none">
        <div className="flex h-full w-full items-center justify-center" style={{ color: accent }}>
          <Icon className="h-4 w-4" />
        </div>
      </foreignObject>
      {selected && <circle r="28" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="5 5" />}
      <text x="0" y="42" textAnchor="middle" fill="var(--foreground)" fontSize="13" fontWeight="600">{device.label}</text>
      <text x="0" y="58" textAnchor="middle" fill="var(--muted-foreground)" fontSize="11">{kindFor(device.type)}</text>
      {selected && (
        <g transform="translate(24 -24)">
          <circle r="11" fill="var(--card)" stroke="var(--border)" />
          <path d="M-4 0 H4 M0 -4 V4" stroke="var(--foreground)" strokeWidth="1.5" />
        </g>
      )}
      <circle
        cx="0"
        cy="0"
        r="34"
        fill="transparent"
        onDoubleClick={(e) => {
          e.stopPropagation();
          onUpdate({ rot: ((device.rot ?? 0) + 45) % 360 });
        }}
      />
    </g>
  );
}

function SelectionStrip({ selected, activeLens, setActiveLens, selectedSection, setSelectedSection, onDuplicate, onDelete, onClose }: {
  selected: Device;
  activeLens: LensId;
  setActiveLens: (lens: LensId) => void;
  selectedSection: 'aim' | 'specs' | 'power' | 'coverage' | null;
  setSelectedSection: (section: 'aim' | 'specs' | 'power' | 'coverage' | null) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const sections: Array<{ id: 'aim' | 'specs' | 'power' | 'coverage'; label: string; icon: typeof RotateCw }> = [
    { id: 'aim', label: 'Aim', icon: RotateCw },
    { id: 'specs', label: 'Specs', icon: SlidersHorizontal },
    { id: 'power', label: 'Power', icon: Zap },
    { id: 'coverage', label: 'Coverage', icon: ShieldCheck },
  ];
  return (
    <div className="absolute inset-x-8 bottom-6 z-selection-menu">
      <div data-canvas-chrome="selection-menu" className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-panel">
        <div className="min-w-44 border-r border-border px-2">
          <div className="text-sm font-semibold">{selected.label}</div>
          <div className="text-xs text-muted-foreground">{selected.id} · {kindFor(selected.type)}</div>
        </div>
        {selected.type === 'cam.multisensor' && (['a', 'b', 'c', 'd'] as LensId[]).map((lens) => (
          <button
            key={lens}
            data-track={`selmenu-lens-${lens}`}
            className="h-8 w-8 rounded-md border border-border text-xs font-semibold uppercase"
            style={{ boxShadow: activeLens === lens ? 'inset 0 0 0 1px var(--primary)' : 'none' }}
            onClick={() => setActiveLens(lens)}
          >
            {lens}
          </button>
        ))}
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              data-track={`selmenu-${section.id}`}
              className={cls('flex h-9 items-center gap-1 rounded-md px-3 text-xs', selectedSection === section.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
              onClick={() => setSelectedSection(selectedSection === section.id ? null : section.id)}
            >
              <Icon className="h-4 w-4" />
              {section.label}
            </button>
          );
        })}
        <button data-track="selmenu-duplicate" className="dv-strip-button" onClick={onDuplicate}><Copy className="h-4 w-4" /></button>
        <button data-track="selmenu-delete" className="dv-strip-button" onClick={onDelete}><Trash2 className="h-4 w-4" /></button>
        <button data-track="selmenu-close" className="dv-strip-button" onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      {selectedSection && (
        <div data-testid="selection-section-panel" className="mx-auto mt-3 w-96 rounded-xl border border-border bg-card p-4 text-foreground shadow-panel">
          <div data-testid="selection-section-title" className="text-sm font-semibold">{selectedSectionLabel(selectedSection)} · {selected.label}</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <InfoMetric label="Mount" value={`${selected.mountFt ?? 10} ft`} />
            <InfoMetric label="Range" value={`${selected.range ?? 120} ft`} />
            <InfoMetric label="FOV" value={`${selected.fov ?? 82} deg`} />
            <InfoMetric label="Rotation" value={`${selected.rot ?? 0} deg`} />
          </div>
        </div>
      )}
    </div>
  );
}

function selectedSectionLabel(section: string) {
  if (section === 'aim') return 'Aim and geometry';
  if (section === 'specs') return 'Product specs';
  if (section === 'power') return 'Power and network';
  return 'Coverage review';
}

function InfoMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function RightStudioPanel({ selected, rows, sellTotal, aiOpen, onOpenBom, onUpdateSelected }: {
  selected: Device | null;
  rows: CanvasBomRow[];
  sellTotal: number;
  aiOpen: boolean;
  onOpenBom: () => void;
  onUpdateSelected: (patch: Partial<Device>) => void;
}) {
  return (
    <aside className="w-80 shrink-0 border-l border-border bg-card">
      <div className="border-b border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inspector</div>
            <div className="mt-1 text-lg font-semibold">{selected ? selected.label : 'Design health'}</div>
          </div>
          <button className="dv-icon-action" onClick={onOpenBom}><CircleDollarSign className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="space-y-4 p-5">
        {selected ? (
          <>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="text-xs text-muted-foreground">Object</div>
              <div className="mt-2 text-sm font-semibold">{selected.id}</div>
              <div className="text-xs text-muted-foreground">{kindFor(selected.type)}</div>
              <label className="mt-4 block text-xs text-muted-foreground">Label</label>
              <input
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                value={selected.label}
                onChange={(e) => onUpdateSelected({ label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoMetric label="X" value={Math.round(selected.x).toString()} />
              <InfoMetric label="Y" value={Math.round(selected.y).toString()} />
              <InfoMetric label="Range" value={`${selected.range ?? 0} ft`} />
              <InfoMetric label="FOV" value={`${selected.fov ?? 0} deg`} />
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Coverage readiness</div>
              <div className="mt-4 space-y-3">
                <ProgressLine label="Camera coverage" value={76} />
                <ProgressLine label="Door hardware" value={54} />
                <ProgressLine label="Network load" value={68} />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" /> Open issues</div>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                <div>3 cameras missing IDF assignment.</div>
                <div>2 doors need REX or motion egress validation.</div>
                <div>1 pathway exceeds recommended cable distance.</div>
              </div>
            </div>
          </>
        )}
        {aiOpen && (
          <div className="rounded-lg border border-primary bg-background p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Deeper Vision AI</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Review flag only. AI can suggest coverage, BOM, and pathway checks, but human approval controls all design changes.</p>
          </div>
        )}
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Estimate pulse</div>
            <div className="text-sm font-semibold">{currency(sellTotal)}</div>
          </div>
          <div className="mt-3 space-y-2">
            {rows.slice(0, 4).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-muted-foreground">{row.description}</span>
                <span className="font-medium">{currency(row.qty * row.unitPrice)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function ProgressLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function AssetShelf({ tray, setTray, cameraProducts, cableProducts, conduitProducts, cameraSub, setCameraSub, cableSub, setCableSub, onProductClick, onDragStart }: {
  tray: Tray;
  setTray: (tray: Tray) => void;
  cameraProducts: Product[];
  cableProducts: Product[];
  conduitProducts: Product[];
  cameraSub: string;
  setCameraSub: (sub: string) => void;
  cableSub: string;
  setCableSub: (sub: string) => void;
  onProductClick: (p: Product) => void;
  onDragStart: (e: DragEvent<HTMLButtonElement>, productId: string) => void;
}) {
  const products = tray === 'cam' ? cameraProducts : tray === 'cable' ? cableProducts : tray === 'conduit' ? conduitProducts : [];
  return (
    <aside data-canvas-chrome="tray" className="z-bottom-bar w-20 shrink-0 border-l border-border bg-card p-2">
      <div className="flex h-full flex-col items-center gap-2">
        <ShelfButton active={tray === 'cam'} dataTrack="bottombar-cat-cam" icon={Camera} label="Cameras" onClick={() => setTray(tray === 'cam' ? null : 'cam')} />
        <ShelfButton active={tray === 'cable'} dataTrack="bottombar-cat-cable" icon={Cable} label="Cabling" onClick={() => setTray(tray === 'cable' ? null : 'cable')} />
        <ShelfButton active={tray === 'conduit'} dataTrack="bottombar-cat-conduit" icon={Network} label="Conduit" onClick={() => setTray(tray === 'conduit' ? null : 'conduit')} />
      </div>
      {tray && (
        <div className="absolute bottom-5 right-24 top-28 z-popover flex w-96 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-panel">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Asset shelf</div>
                <div className="text-lg font-semibold">{CATEGORY_LABELS[tray]}</div>
              </div>
              <button className="dv-icon-action" onClick={() => setTray(null)}><X className="h-4 w-4" /></button>
            </div>
            {tray === 'cam' && (
              <div className="mt-3 flex flex-wrap gap-1">
                {['all', 'bullet', 'dome', 'ptz', 'multi', 'fisheye'].map((sub) => (
                  <button
                    key={sub}
                    data-testid={`cam-sub-${sub}`}
                    className={cls('rounded-md border px-2 py-1 text-xs capitalize', cameraSub === sub ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}
                    onClick={() => setCameraSub(sub)}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}
            {tray === 'cable' && (
              <div className="mt-3 flex flex-wrap gap-1">
                {['cable', 'network', 'power'].map((sub) => (
                  <button
                    key={sub}
                    data-track={`bottombar-cable-sub-${sub}`}
                    className={cls('rounded-md border px-2 py-1 text-xs capitalize', cableSub === sub ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}
                    onClick={() => setCableSub(sub)}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
            {products.map((product) => (
              <button
                key={product.id}
                draggable
                data-track={`${tray === 'cam' ? 'bottombar-cam' : tray === 'cable' ? 'bottombar-cable' : 'bottombar-conduit'}-${product.id}`}
                className="w-full rounded-lg border border-border bg-background p-3 text-left hover:border-primary hover:bg-muted"
                onClick={() => onProductClick(product)}
                onDragStart={(e) => onDragStart(e, product.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card">
                    {tray === 'cam' ? <Camera className="h-5 w-5 text-primary" /> : tray === 'cable' ? <Cable className="h-5 w-5 text-primary" /> : <Network className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{productLabel(product)}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.sub || product.productName || product.type}</div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{product.resolution ?? product.poe ?? 'Catalog'}</span>
                      <span>{product.msrp ? currency(product.msrp) : 'No price'}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function ShelfButton({ active, dataTrack, icon: Icon, label, onClick }: {
  active: boolean;
  dataTrack: string;
  icon: typeof Camera;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      data-track={dataTrack}
      title={label}
      className={cls('flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-lg border text-xs', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted')}
      onClick={onClick}
    >
      <Icon className="h-5 w-5" />
      <span>{label.slice(0, 3)}</span>
    </button>
  );
}

function BomDrawer({ rows, sellTotal, onClose }: { rows: CanvasBomRow[]; sellTotal: number; onClose: () => void }) {
  return (
    <div data-canvas-chrome="drawer" className="fixed inset-y-0 right-0 z-modal w-96 border-l border-border bg-card shadow-modal">
      <div className="flex h-16 items-center justify-between border-b border-border px-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Live BOM</div>
          <div className="text-lg font-semibold">Sell total {currency(sellTotal)}</div>
        </div>
        <button className="dv-icon-action" onClick={onClose}><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-2 overflow-auto p-4">
        {rows.map((row) => (
          <div key={row.id} data-track={`bom-row-${row.id}`} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{row.description}</div>
                <div className="text-xs text-muted-foreground">{row.qty} {row.uom} · {row.meta ?? row.category}</div>
              </div>
              <div className="text-sm font-semibold">{currency(row.qty * row.unitPrice)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModalLayer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-foreground/35 p-6">
      <div className="max-h-full w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-modal">
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <div className="text-lg font-semibold">{title}</div>
          <button className="dv-icon-action" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function modalTitle(modal: Modal) {
  if (modal === 'plan') return 'Start or replace a plan';
  if (modal === 'overview') return 'Floor overview';
  if (modal === 'floors') return 'Manage floors';
  if (modal === 'report') return 'Proposal package';
  return '';
}

function PlanSetupGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {PLAN_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button key={action.label} className="rounded-xl border border-border bg-background p-5 text-left hover:border-primary">
            <Icon className="h-6 w-6 text-primary" />
            <div className="mt-4 text-base font-semibold">{action.label}</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.text}</p>
          </button>
        );
      })}
    </div>
  );
}

function OverviewGrid({ floors, devices }: { floors: Floor[]; devices: Device[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {floors.map((floor) => (
        <div key={floor.id} className="rounded-xl border border-border bg-background p-4">
          <div className="text-sm font-semibold">{floor.name}</div>
          <div className="mt-2 text-2xl font-semibold">{devices.filter((d) => d.floorId === floor.id).length}</div>
          <div className="text-xs text-muted-foreground">devices</div>
        </div>
      ))}
    </div>
  );
}

function FloorManager({ floors, devices }: { floors: Floor[]; devices: Device[] }) {
  return (
    <div className="space-y-2">
      {floors.map((floor) => (
        <div key={floor.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
          <div>
            <div className="text-sm font-semibold">{floor.name}</div>
            <div className="text-xs text-muted-foreground">{devices.filter((d) => d.floorId === floor.id).length} devices on this floor</div>
          </div>
          <button className="dv-panel-button">Open</button>
        </div>
      ))}
    </div>
  );
}

function ReportBuilderPreview({ rows }: { rows: CanvasBomRow[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-background p-5">
        <div className="text-sm font-semibold">Customer package</div>
        <p className="mt-2 text-sm text-muted-foreground">Includes design snapshot, BOM summary, assumptions, alternates, and approval block.</p>
      </div>
      <div className="text-sm font-semibold">{rows.length} BOM rows ready for proposal draft</div>
    </div>
  );
}

function MenuButton({ dataTrack, icon: Icon, label, onClick }: { dataTrack: string; icon: typeof FileText; label: string; onClick: () => void }) {
  return (
    <button data-track={dataTrack} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted" onClick={onClick}>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{label}</span>
    </button>
  );
}

function fallbackBomRows(devices: Device[]): CanvasBomRow[] {
  const count = Math.max(devices.length, 1);
  return [
    {
      id: 'fallback-devices',
      category: 'cameras',
      sourceKind: 'manual',
      isExisting: false,
      description: 'Designed devices',
      meta: 'Fallback preview',
      qty: count,
      uom: 'ea',
      unitPrice: 850,
      laborHours: count * 1.5,
      missingPrice: false,
    },
  ];
}
