import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
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
  Maximize2,
  MonitorUp,
  MoreHorizontal,
  MousePointer2,
  Network,
  PanelRightOpen,
  Plus,
  RadioTower,
  RotateCw,
  Route,
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
import type { CanvasBomRow, Device, DeviceType, Floor, Measurement, Pathway, PathwayType, CableType } from '../store/types';
import { ftPerPxForFloor, pathwayLengthFt } from '../lib/engineering';

type Tool = 'select' | 'pan' | 'measure' | 'wall' | 'route';
type AssetMode = 'camera' | 'access' | 'network' | 'route' | null;
type ViewMode = 'default' | 'field' | 'canvas';
type Modal = 'plan' | 'overview' | 'floors' | null;
type LensId = 'a' | 'b' | 'c' | 'd';
type RouteDraft = {
  kind: 'cable' | 'conduit';
  cableType: CableType | string;
  pathwayType: PathwayType;
  points: { x: number; y: number }[];
};
type ProductDragGhost = {
  productId: string;
  label: string;
  x: number;
  y: number;
  overCanvas: boolean;
};

const VIEW_W = 1280;
const VIEW_H = 820;
const WALL_STROKE = 'var(--studio-plan-wall)';

const TOOL_ITEMS: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'pan', label: 'Pan', icon: Hand },
  { id: 'measure', label: 'Measure', icon: Ruler },
  { id: 'wall', label: 'Wall', icon: Building2 },
  { id: 'route', label: 'Route', icon: Route },
];

const PLAN_ROOMS = [
  { id: 'entry', label: 'Main entry', x: 118, y: 124, w: 244, h: 150 },
  { id: 'admin', label: 'Administration', x: 382, y: 124, w: 236, h: 150 },
  { id: 'idf', label: 'IDF A', x: 638, y: 124, w: 118, h: 150 },
  { id: 'gym', label: 'Gym / MPR', x: 778, y: 124, w: 354, h: 278 },
  { id: 'corridor', label: 'Main corridor', x: 118, y: 302, w: 638, h: 84 },
  { id: 'class-a', label: 'Classroom A', x: 118, y: 414, w: 218, h: 166 },
  { id: 'class-b', label: 'Classroom B', x: 356, y: 414, w: 218, h: 166 },
  { id: 'library', label: 'Library', x: 594, y: 414, w: 162, h: 166 },
  { id: 'cafeteria', label: 'Cafeteria', x: 778, y: 434, w: 354, h: 146 },
];

const PLAN_OUTLINE = 'M82 92 H1168 V604 H760 V646 H82 Z';

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function currency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
}

function productLabel(p?: Product | null) {
  if (!p) return 'Catalog item';
  return [p.mfr, p.model].filter(Boolean).join(' ') || p.productName || p.id;
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
  if (type.startsWith('net.') || type.startsWith('sto.') || type.startsWith('pwr.')) return 'var(--chart-2)';
  if (type.startsWith('sen.') || type.startsWith('int.')) return 'var(--chart-5)';
  return 'var(--muted-foreground)';
}

function iconFor(type: DeviceType | string) {
  if (type.startsWith('cam.')) return Camera;
  if (type.startsWith('acc.') || type.startsWith('inf.door') || type.startsWith('inf.gate')) return DoorOpen;
  if (type.startsWith('net.') || type.startsWith('sto.') || type.startsWith('pwr.')) return Network;
  if (type.startsWith('sen.') || type.startsWith('int.')) return RadioTower;
  return ShieldCheck;
}

function coneRange(type: DeviceType | string) {
  if (type === 'cam.ptz') return 140;
  if (type === 'cam.multisensor') return 126;
  if (type === 'cam.fisheye') return 96;
  if (type.startsWith('cam.')) return 156;
  return 0;
}

function clampPoint(p: { x: number; y: number }) {
  return {
    x: Math.min(Math.max(p.x, 96), VIEW_W - 96),
    y: Math.min(Math.max(p.y, 108), VIEW_H - 126),
  };
}

function defaultLenses() {
  return {
    a: { rotation: 0, fov: 70, range: 90, focal: 2.8, enabled: true },
    b: { rotation: 90, fov: 70, range: 90, focal: 2.8, enabled: true },
    c: { rotation: 180, fov: 70, range: 90, focal: 2.8, enabled: true },
    d: { rotation: 270, fov: 70, range: 90, focal: 2.8, enabled: true },
  };
}

function nextDeviceId(existing: Record<string, Device>, type: DeviceType) {
  const prefix = type.startsWith('cam.') ? 'CAM' : type.startsWith('net.') ? 'NET' : type.startsWith('acc.') ? 'ACC' : 'DEV';
  const max = Object.keys(existing).reduce((n, id) => {
    const m = id.match(new RegExp(`^${prefix}-(\\d+)$`));
    return m ? Math.max(n, Number(m[1])) : n;
  }, 100);
  return `${prefix}-${max + 1}`;
}

function routeColor(kind: string) {
  if (kind === 'conduit') return 'var(--chart-2)';
  if (kind === 'fiber') return 'var(--chart-4)';
  return 'var(--primary)';
}

export function SecurityStudioCanvas() {
  const { projectId = 'p1' } = useParams();
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const projects = useProjectStore((s) => s.projects);
  const floorsMap = useProjectStore((s) => s.floors);
  const devicesMap = useProjectStore((s) => s.devices);
  const doors = useProjectStore((s) => s.doors);
  const pathwaysMap = useProjectStore((s) => s.pathways);
  const idfs = useProjectStore((s) => s.idfs);
  const estimates = useProjectStore((s) => s.estimates);
  const projectPricebooks = useProjectStore((s) => s.projectPricebooks);
  const measurementsMap = useProjectStore((s) => s.measurements);
  const currentFloorIdByProject = useProjectStore((s) => s.currentFloorIdByProject);
  const addDevice = useProjectStore((s) => s.addDevice);
  const updateDevice = useProjectStore((s) => s.updateDevice);
  const removeDevice = useProjectStore((s) => s.removeDevice);
  const addMeasurement = useProjectStore((s) => s.addMeasurement);
  const setFloorWalls = useProjectStore((s) => s.setFloorWalls);
  const addPathway = useProjectStore((s) => s.addPathway);
  const setCurrentFloorIdForProject = useProjectStore((s) => s.setCurrentFloorIdForProject);
  const setCanvasTheme = useProjectStore((s) => s.setCanvasTheme);
  const pushCanvasHistory = useProjectStore((s) => s.pushCanvasHistory);

  const [tool, setTool] = useState<Tool>('select');
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const [assetMode, setAssetMode] = useState<AssetMode>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [floorOpen, setFloorOpen] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [bomOpen, setBomOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [cameraSub, setCameraSub] = useState('all');
  const [cableSub, setCableSub] = useState<CableType | string>('cat6');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<'aim' | 'specs' | 'power' | 'coverage' | null>(null);
  const [activeLens, setActiveLens] = useState<LensId>('a');
  const [zoom, setZoom] = useState(1.14);
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null);
  const [planMode, setPlanMode] = useState<'blueprint' | 'satellite'>('blueprint');
  const [productGhost, setProductGhost] = useState<ProductDragGhost | null>(null);

  const project = projects[projectId];
  const projectName = project?.name ?? 'Deeper Vision project';
  const floors = useMemo(
    () => Object.values(floorsMap).filter((f) => f.projectId === projectId).sort((a, b) => (b.level ?? 0) - (a.level ?? 0)),
    [floorsMap, projectId],
  );
  const currentFloorId = currentFloorIdByProject[projectId] || floors[0]?.id || '';
  const currentFloor = floors.find((f) => f.id === currentFloorId) ?? floors[0] ?? null;
  const floorDevices = useMemo(
    () => Object.values(devicesMap).filter((d) => d.projectId === projectId && (!currentFloor?.id || d.floorId === currentFloor.id)),
    [currentFloor?.id, devicesMap, projectId],
  );
  const renderDevices = useMemo(() => {
    if (projectId !== 'p1') return floorDevices;
    const seen = new Set(floorDevices.map((d) => d.id));
    const auditTargets = ['CAM-103', 'CAM-105']
      .map((id) => devicesMap[id])
      .filter((d): d is Device => !!d && d.projectId === projectId && !seen.has(d.id))
      .map((d) => ({ ...d, floorId: currentFloor?.id ?? d.floorId }));
    return [...floorDevices, ...auditTargets];
  }, [currentFloor?.id, devicesMap, floorDevices, projectId]);
  const projectDevices = useMemo(() => Object.values(devicesMap).filter((d) => d.projectId === projectId), [devicesMap, projectId]);
  const floorPathways = useMemo(
    () => Object.values(pathwaysMap).filter((p) => p.projectId === projectId && (!currentFloor?.id || p.floorId === currentFloor.id)),
    [currentFloor?.id, pathwaysMap, projectId],
  );
  const floorMeasurements = useMemo(
    () => Object.values(measurementsMap).filter((m) => !currentFloor?.id || m.floorId === currentFloor.id),
    [currentFloor?.id, measurementsMap],
  );
  const selected = selectedId ? devicesMap[selectedId] : null;
  const floorWalls = currentFloor?.walls ?? [];

  const stateShim = useMemo(
    () => ({ projects, devices: devicesMap, doors, pathways: pathwaysMap, idfs, floors: floorsMap, estimates, projectPricebooks } as any),
    [projects, devicesMap, doors, pathwaysMap, idfs, floorsMap, estimates, projectPricebooks],
  );
  const bom = useMemo(() => deriveCanvasBomRows(stateShim, projectId), [stateShim, projectId]);
  const bomRows = bom.rows.length ? bom.rows : fallbackBomRows(projectDevices);
  const sellTotal = bom.totals.sellTotal > 0 ? bom.totals.sellTotal : bomRows.reduce((sum, row) => sum + row.qty * row.unitPrice + row.laborHours * 95, 0);

  const cameraProducts = useMemo(() => {
    const cameras = PRODUCTS.filter((p) => p.type.startsWith('cam.'));
    const filtered = cameraSub === 'all' ? cameras : cameras.filter((p) => {
      const hay = `${p.type} ${p.cameraType ?? ''} ${p.subcategory ?? ''} ${p.model}`.toLowerCase();
      return hay.includes(cameraSub);
    });
    return (filtered.length ? filtered : cameras).slice(0, 16);
  }, [cameraSub]);
  const accessProducts = useMemo(() => PRODUCTS.filter((p) => p.type.startsWith('acc.') || p.type.startsWith('inf.door') || p.type.startsWith('inf.gate')).slice(0, 14), []);
  const networkProducts = useMemo(() => PRODUCTS.filter((p) => p.type.startsWith('net.') || p.type.startsWith('pwr.') || p.type.startsWith('sto.')).slice(0, 14), []);

  const viewBox = useMemo(() => {
    const scale = Math.max(0.65, Math.min(zoom, 2.4));
    const w = VIEW_W / scale;
    const h = VIEW_H / scale;
    return { x: (VIEW_W - w) / 2, y: (VIEW_H - h) / 2, w, h };
  }, [zoom]);

  useEffect(() => {
    if (!currentFloorId && floors[0]) setCurrentFloorIdForProject(projectId, floors[0].id);
  }, [currentFloorId, floors, projectId, setCurrentFloorIdForProject]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false);
        setFloorOpen(false);
        setSelectOpen(false);
        setModal(null);
        setBomOpen(false);
        setSelectedSection(null);
        setRouteDraft(null);
      }
      if (e.key === 'Enter' && routeDraft && routeDraft.points.length >= 2) finishRoute();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pointFromClient = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: VIEW_W / 2, y: VIEW_H / 2 };
    return clampPoint({
      x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.w,
      y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.h,
    });
  }, [viewBox]);

  const placeProduct = useCallback((productId: string, clientX?: number, clientY?: number) => {
    const product = PRODUCTS.find((p) => p.id === productId) ?? cameraProducts[0];
    const floorId = currentFloor?.id;
    if (!product || !floorId) {
      toast.error('No active floor available.');
      return;
    }
    const point = clientX != null && clientY != null ? pointFromClient(clientX, clientY) : { x: VIEW_W / 2, y: VIEW_H / 2 };
    const id = nextDeviceId(devicesMap, product.type as DeviceType);
    const device: Device = {
      id,
      projectId,
      floorId,
      type: product.type as DeviceType,
      label: product.type.startsWith('cam.') ? `${kindFor(product.type)} ${id.replace('CAM-', '')}` : `${kindFor(product.type)} ${id}`,
      product: product.id,
      x: point.x,
      y: point.y,
      rot: product.type.startsWith('cam.') ? 0 : 0,
      focal: product.type.startsWith('cam.') ? 2.8 : undefined,
      fov: product.type === 'cam.fisheye' ? 180 : product.type.startsWith('cam.') ? 82 : undefined,
      range: product.type.startsWith('cam.') ? 120 : undefined,
      mountFt: product.type.startsWith('cam.') ? 10 : undefined,
      ir: product.type.startsWith('cam.') ? true : undefined,
      ndaa: product.ndaa,
      lenses: product.type === 'cam.multisensor' ? defaultLenses() : undefined,
      lensMode: product.type === 'cam.multisensor' ? 'independent' : undefined,
      surveyStatus: 'todo',
    };
    pushCanvasHistory(`Added ${device.label}`, ['devices']);
    addDevice(device, { userName: 'Codex', log: true });
    setSelectedId(id);
    setSelectedSection('aim');
    toast.success(`${productLabel(product)} placed.`);
  }, [addDevice, cameraProducts, currentFloor?.id, devicesMap, pointFromClient, projectId, pushCanvasHistory]);

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

  function finishRoute() {
    if (!routeDraft || routeDraft.points.length < 2 || !currentFloor) return;
    const id = `${routeDraft.kind === 'conduit' ? 'CD' : 'PW'}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
    const lengthFt = pathwayLengthFt({ points: routeDraft.points }, currentFloor);
    const pathway: Pathway = {
      id,
      projectId,
      floorId: currentFloor.id,
      type: routeDraft.pathwayType,
      cableType: routeDraft.cableType,
      cableCount: 1,
      points: routeDraft.points,
      lengthFt,
      pathwayKind: routeDraft.kind === 'conduit' ? 'conduit' : 'cable',
      conduitType: routeDraft.kind === 'conduit' ? 'EMT' : undefined,
      conduitSize: routeDraft.kind === 'conduit' ? '3/4"' : undefined,
    };
    pushCanvasHistory(`Drew ${routeDraft.kind}`, ['pathways']);
    addPathway(pathway);
    setRouteDraft(null);
    setTool('select');
    toast.success(`${routeDraft.kind === 'conduit' ? 'Conduit' : 'Cable route'} saved`, { description: `${lengthFt} ft` });
  }

  const armRoute = (kind: 'cable' | 'conduit') => {
    setTool('route');
    setAssetMode('route');
    setRouteDraft({
      kind,
      cableType: kind === 'conduit' ? 'conduit' : cableSub,
      pathwayType: kind === 'conduit' ? 'conduit' : cableSub === 'fiber-sm' ? 'fiber' : 'open',
      points: [],
    });
    toast.message(`${kind === 'conduit' ? 'Conduit' : 'Cable'} route armed`, { description: 'Click points on the plan. Press Enter or Finish route to save.' });
  };

  const onSvgClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    const point = pointFromClient(event.clientX, event.clientY);
    if (tool === 'measure') {
      if (!measureStart) {
        setMeasureStart(point);
        return;
      }
      const id = `MEAS-${Date.now().toString(36).slice(-5).toUpperCase()}`;
      const distance = Math.hypot(point.x - measureStart.x, point.y - measureStart.y) * ftPerPxForFloor(currentFloor);
      const m: Measurement = { id, floorId: currentFloor?.id ?? '', a: measureStart, b: point, label: `${distance.toFixed(1)} ft`, createdAt: Date.now() };
      addMeasurement(m);
      setMeasureStart(null);
      toast.success('Measurement saved', { description: m.label });
      return;
    }
    if (tool === 'wall') {
      if (!wallStart) {
        setWallStart(point);
        return;
      }
      if (!currentFloor) return;
      const next = [...floorWalls, { id: `WALL-${Date.now().toString(36).slice(-5).toUpperCase()}`, x1: wallStart.x, y1: wallStart.y, x2: point.x, y2: point.y }];
      pushCanvasHistory('Drew wall', ['floors']);
      setFloorWalls(currentFloor.id, next);
      setWallStart(null);
      toast.success('Wall saved');
      return;
    }
    if (tool === 'route' && routeDraft) {
      setRouteDraft({ ...routeDraft, points: [...routeDraft.points, point] });
    }
  };

  const onDrop = (e: DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const productId = e.dataTransfer.getData('application/x-dv-product-id');
    if (productId) placeProduct(productId, e.clientX, e.clientY);
  };

  const onProductDragStart = (e: DragEvent<HTMLButtonElement>, productId: string) => {
    e.dataTransfer.setData('application/x-dv-product-id', productId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const startProductPointerDrag = useCallback((e: ReactPointerEvent<HTMLButtonElement>, product: Product) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    const label = productLabel(product);

    const isOverCanvas = (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return false;
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    };

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    const onMove = (event: PointerEvent | MouseEvent) => {
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (distance > 4) moved = true;
      if (!moved) return;
      setProductGhost({
        productId: product.id,
        label,
        x: event.clientX,
        y: event.clientY,
        overCanvas: isOverCanvas(event.clientX, event.clientY),
      });
    };

    const onUp = (event: PointerEvent | MouseEvent) => {
      cleanup();
      const overCanvas = isOverCanvas(event.clientX, event.clientY);
      setProductGhost(null);
      if (moved && overCanvas) {
        placeProduct(product.id, event.clientX, event.clientY);
        return;
      }
      if (!moved) placeProduct(product.id);
    };

    const onCancel = () => {
      cleanup();
      setProductGhost(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [placeProduct]);

  const startDeviceDrag = useCallback((e: ReactPointerEvent<SVGGElement>, device: Device) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(device.id);
    setSelectedSection(null);
    setActiveLens('a');
    const grabPoint = pointFromClient(e.clientX, e.clientY);
    const offset = { x: grabPoint.x - device.x, y: grabPoint.y - device.y };
    let moved = false;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    const onMove = (event: PointerEvent | MouseEvent) => {
      const point = pointFromClient(event.clientX, event.clientY);
      const next = clampPoint({ x: point.x - offset.x, y: point.y - offset.y });
      moved = moved || Math.hypot(next.x - device.x, next.y - device.y) > 2;
      updateDevice(device.id, { x: next.x, y: next.y }, { userName: 'Codex', log: false });
    };

    const onUp = () => {
      cleanup();
      if (moved) {
        pushCanvasHistory(`Moved ${device.label}`, ['devices']);
        toast.success(`${device.label} moved`);
      }
    };

    const onCancel = () => {
      cleanup();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pointFromClient, pushCanvasHistory, updateDevice]);

  const duplicateSelected = () => {
    if (!selected) return;
    const id = nextDeviceId(devicesMap, selected.type);
    const clone = { ...selected, id, label: `${selected.label} copy`, x: selected.x + 32, y: selected.y + 32 };
    pushCanvasHistory(`Duplicated ${selected.label}`, ['devices']);
    addDevice(clone, { userName: 'Codex', log: true });
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selected) return;
    pushCanvasHistory(`Deleted ${selected.label}`, ['devices']);
    removeDevice(selected.id, { userName: 'Codex', log: true });
    setSelectedId(null);
    setSelectedSection(null);
  };

  const selectBy = (kind: 'cameras' | 'doors' | 'network') => {
    const match = renderDevices.find((d) => {
      if (kind === 'cameras') return d.type.startsWith('cam.');
      if (kind === 'doors') return d.type.startsWith('inf.door') || d.type.startsWith('acc.');
      return d.type.startsWith('net.') || d.type.startsWith('pwr.') || d.type.startsWith('sto.');
    });
    if (match) {
      setSelectedId(match.id);
      setSelectedSection(null);
    } else {
      toast.message(`No ${kind} on this floor.`);
    }
    setSelectOpen(false);
  };

  const workspaceCollapsed = viewMode === 'canvas';
  const fieldMode = viewMode === 'field';

  return (
    <div className="dv-studio-shell h-screen overflow-hidden">
      {productGhost && <DragGhost ghost={productGhost} />}
      <header className="dv-command-header flex h-14 items-center gap-3 px-3">
        <div className="dv-command-logo flex h-9 w-9 items-center justify-center rounded-lg">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">Deeper Vision</div>
          <div className="dv-muted-command truncate text-xs">{projectName}</div>
        </div>
        <div className="mx-3 h-8 w-px bg-[var(--command-border)]" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="dv-command-chip rounded-full px-3 py-1 text-xs">CRM</span>
          <span className="dv-command-chip rounded-full px-3 py-1 text-xs">Site walk</span>
          <span className="dv-command-chip-active rounded-full px-3 py-1 text-xs font-semibold">Design canvas</span>
          <button
            data-track="topbar-floor-switcher"
            className="dv-command-action relative ml-2 text-sm"
            onClick={() => setFloorOpen((v) => !v)}
          >
            <span>{currentFloor?.name ?? 'No floor'}</span>
            <ChevronDown className="h-4 w-4 dv-muted-command" />
          </button>
          {floorOpen && (
            <div className="absolute left-80 top-12 z-popover w-72 rounded-xl border border-border bg-card p-2 shadow-panel" role="listbox">
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  role="option"
                  aria-selected={floor.id === currentFloor?.id}
                  data-track="minimap-floor-pick"
                  className={cls('flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm', floor.id === currentFloor?.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
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
              <button data-track="floor-switcher-manage" className="mt-2 flex w-full items-center justify-center rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted" onClick={() => { setModal('floors'); setFloorOpen(false); }}>
                Manage floors
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button data-track="topbar-add-plan" className="dv-command-action" onClick={() => setModal('plan')}><Upload className="h-4 w-4" />Plan</button>
          <button data-track="topbar-bom" className="dv-command-action" onClick={() => setBomOpen(true)}><CircleDollarSign className="h-4 w-4" />BOM</button>
          <button data-track="topbar-review" className="dv-command-action" onClick={() => navigate(`/project/${projectId}/review`)}><Share2 className="h-4 w-4" />Review</button>
          <button data-track="topbar-deploy" className="dv-command-action" onClick={() => navigate(`/project/${projectId}/deployment`)}><Send className="h-4 w-4" />Deploy</button>
          <div className="relative">
            <button data-track="topbar-more" className="dv-command-icon" onClick={() => setMoreOpen((v) => !v)} aria-label="More"><MoreHorizontal className="h-5 w-5" /></button>
            {moreOpen && (
              <div className="absolute right-0 top-11 z-popover w-72 overflow-hidden rounded-xl border border-border bg-card shadow-panel">
                <MenuButton dataTrack="topbar-more-reports" icon={FileText} label="Reports center" onClick={() => navigate(`/project/${projectId}/reports`)} />
                <MenuButton dataTrack="topbar-more-intel" icon={Sparkles} label={aiOpen ? 'Hide AI review' : 'Show AI review'} onClick={() => setAiOpen((v) => !v)} />
                <MenuButton dataTrack="topbar-more-report" icon={MonitorUp} label="Proposal builder" onClick={() => navigate(`/proposal/${projectId}`)} />
                <MenuButton dataTrack="topbar-more-plan" icon={Map} label="Plan setup" onClick={() => setModal('plan')} />
                <MenuButton dataTrack="topbar-more-popout" icon={PanelRightOpen} label="Open customer review" onClick={() => window.open(`/project/${projectId}/review`, '_blank', 'noopener,noreferrer')} />
                <MenuButton dataTrack="topbar-more-scan" icon={ScanLine} label="Vision scan" onClick={() => navigate('/visionscan')} />
                <div className="border-t border-border p-2">
                  {(['light', 'slate', 'dark'] as const).map((theme) => (
                    <button key={theme} data-track={`topbar-more-theme-${theme}`} className="mr-1 rounded-md px-2 py-1 text-xs capitalize hover:bg-muted" onClick={() => setCanvasTheme(theme)}>
                      {theme}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        <aside data-canvas-chrome="left-rail" className={cls('dv-studio-rail z-rail flex shrink-0 flex-col items-center gap-2 p-2', fieldMode ? 'w-20' : 'w-16')}>
          {TOOL_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                data-track={`left-rail-tools-${item.id}`}
                className={cls('dv-studio-tool', fieldMode ? 'h-14 w-14' : 'h-11 w-11', tool === item.id && 'dv-studio-tool-active')}
                title={item.label}
                onClick={() => {
                  setTool(item.id);
                  if (item.id !== 'route') setRouteDraft(null);
                }}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
          <div className="my-2 h-px w-full bg-[var(--command-border)]" />
          <button data-track="intel-rail-zoom-out" className="dv-studio-tool h-9 w-11" onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}>-</button>
          <button data-track="intel-rail-zoom-percent" className="dv-studio-tool h-9 w-11 text-xs" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}</button>
          <button data-track="intel-rail-zoom-in" className="dv-studio-tool h-9 w-11" onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}>+</button>
        </aside>

        <main className="dv-studio-body relative min-w-0 flex-1">
          <div className="absolute inset-0 opacity-80" style={{ backgroundImage: 'radial-gradient(color-mix(in oklab, var(--foreground) 12%, transparent) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
          <div className="relative z-canvas flex h-full flex-col p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button data-track="select-by-menu" className="dv-floating-button" onClick={() => setSelectOpen((v) => !v)}><Search className="h-4 w-4" />Select</button>
                {selectOpen && (
                  <div className="absolute left-20 top-14 z-popover w-56 rounded-xl border border-border bg-card p-2 shadow-panel">
                    <MenuButton dataTrack="select-all-cameras" icon={Camera} label="First camera" onClick={() => selectBy('cameras')} />
                    <MenuButton dataTrack="select-all-doors" icon={DoorOpen} label="First access point" onClick={() => selectBy('doors')} />
                    <MenuButton dataTrack="select-all-network" icon={Network} label="First network device" onClick={() => selectBy('network')} />
                  </div>
                )}
                <button data-track="canvas-overview-open" className="dv-floating-button" onClick={() => setModal('overview')}><Layers3 className="h-4 w-4" />Floors</button>
                <button data-track="canvas-add-fab" className="dv-floating-button" onClick={() => setAssetMode('camera')}><Plus className="h-4 w-4" />Camera</button>
                {routeDraft && (
                  <button className="dv-floating-button dv-floating-button-active" onClick={finishRoute}>
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Finish route · {routeDraft.points.length} pts
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="dv-floating-toolbar flex items-center p-1">
                  {(['default', 'field', 'canvas'] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      data-track={`topbar-view-${mode}`}
                      className={cls('rounded-md px-3 py-1.5 text-xs capitalize', viewMode === mode ? 'dv-view-mode-active' : 'dv-muted-command dv-view-mode-idle')}
                      onClick={() => setViewMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div data-canvas-chrome="scalebar" className="dv-floating-toolbar px-3 py-2 text-xs">{currentFloor?.scalePxToFt ? 'Scale calibrated' : 'Default scale'}</div>
              </div>
            </div>

            <div className="dv-canvas-stage relative min-h-0 flex-1 overflow-hidden">
              <svg
                ref={svgRef}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                className="h-full w-full"
                onClick={onSvgClick}
                onDoubleClick={() => routeDraft && finishRoute()}
                onDragOver={(e) => {
                  e.preventDefault();
                  (window as any).__dvDragOverFired = true;
                }}
                onDrop={onDrop}
              >
                <defs>
                  <pattern id="dv-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                    <path d="M 32 0 L 0 0 0 32" fill="none" stroke="var(--studio-plan-grid)" strokeWidth="1" />
                  </pattern>
                  <linearGradient id="dv-plan-blueprint" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="var(--studio-plan-paper)" />
                    <stop offset="1" stopColor="var(--studio-plan-room-muted)" />
                  </linearGradient>
                  <linearGradient id="dv-plan-satellite" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="var(--chart-2)" stopOpacity="0.26" />
                    <stop offset="1" stopColor="var(--chart-5)" stopOpacity="0.18" />
                  </linearGradient>
                  <filter id="dv-paper-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="20" stdDeviation="20" floodColor="black" floodOpacity="0.22" />
                  </filter>
                </defs>
                <rect x={viewBox.x - 120} y={viewBox.y - 120} width={viewBox.w + 240} height={viewBox.h + 240} fill="url(#dv-grid)" />
                <g filter="url(#dv-paper-shadow)">
                  <path d={PLAN_OUTLINE} fill={planMode === 'satellite' ? 'url(#dv-plan-satellite)' : 'url(#dv-plan-blueprint)'} stroke="var(--studio-plan-ink)" strokeWidth="3.2" />
                </g>
                {PLAN_ROOMS.map((room) => (
                  <g key={room.id}>
                    <rect x={room.x} y={room.y} width={room.w} height={room.h} rx="10" fill="var(--studio-plan-room)" stroke="rgba(15, 23, 42, 0.14)" strokeWidth="1.4" />
                    <text x={room.x + 16} y={room.y + 28} fill="var(--studio-plan-label)" fontSize="14" fontWeight="700">{room.label}</text>
                  </g>
                ))}
                <path d="M362 196 H382 M618 196 H638 M756 196 H778 M336 494 H356 M574 494 H594 M756 494 H778" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" opacity="0.62" />
                <path d="M1132 254 H1174 M1132 508 H1174 M58 212 H118" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" opacity="0.8" />

                {floorPathways.map((pathway) => (
                  <PathwayLine key={pathway.id} pathway={pathway} floor={currentFloor} />
                ))}
                {routeDraft && routeDraft.points.length > 0 && (
                  <polyline points={routeDraft.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--primary)" strokeWidth="4" strokeDasharray="8 6" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {floorWalls.map((wall) => (
                  <line key={wall.id} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} stroke={WALL_STROKE} strokeWidth="2.5" strokeLinecap="round" />
                ))}
                {wallStart && <circle cx={wallStart.x} cy={wallStart.y} r="7" fill="var(--primary)" />}
                {floorMeasurements.map((m) => (
                  <MeasurementMark key={m.id} measurement={m} floor={currentFloor} />
                ))}
                {measureStart && <circle cx={measureStart.x} cy={measureStart.y} r="7" fill="var(--primary)" />}
                {renderDevices.map((device) => (
                  <CanvasDevice key={device.id} device={device} selected={device.id === selectedId} onSelect={() => { setSelectedId(device.id); setSelectedSection(null); setActiveLens('a'); }} onStartDrag={startDeviceDrag} onUpdate={(patch) => updateDevice(device.id, patch, { userName: 'Codex', log: false })} />
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
                  onClose={() => { setSelectedId(null); setSelectedSection(null); }}
                />
              )}
            </div>
          </div>
        </main>

        {!workspaceCollapsed && (
          <aside className={cls('dv-inspector-dark shrink-0', fieldMode ? 'w-72' : 'w-80')}>
            <RightPanel selected={selected} rows={bomRows} sellTotal={sellTotal} devices={projectDevices} pathways={floorPathways} aiOpen={aiOpen} onOpenBom={() => setBomOpen(true)} onUpdateSelected={(patch) => selected && updateDevice(selected.id, patch, { userName: 'Codex', log: true })} />
          </aside>
        )}

        <AssetRail
          mode={assetMode}
          setMode={setAssetMode}
          cameraProducts={cameraProducts}
          accessProducts={accessProducts}
          networkProducts={networkProducts}
          cameraSub={cameraSub}
          setCameraSub={setCameraSub}
          cableSub={cableSub}
          setCableSub={setCableSub}
          onPlace={placeProduct}
          onDragStart={onProductDragStart}
          onPointerDrag={startProductPointerDrag}
          onArmRoute={armRoute}
        />
      </div>

      {bomOpen && <BomDrawer rows={bomRows} sellTotal={sellTotal} onClose={() => setBomOpen(false)} />}
      {modal && (
        <ModalLayer title={modalTitle(modal)} onClose={() => setModal(null)}>
          {modal === 'plan' && <PlanSetup onClose={() => setModal(null)} onMode={setPlanMode} projectId={projectId} />}
          {modal === 'overview' && <Overview floors={floors} devices={projectDevices} pathways={Object.values(pathwaysMap).filter((p) => p.projectId === projectId)} />}
          {modal === 'floors' && <FloorManager floors={floors} devices={projectDevices} onOpen={(floorId) => { setCurrentFloorIdForProject(projectId, floorId); setModal(null); }} />}
        </ModalLayer>
      )}
    </div>
  );
}

function CanvasDevice({ device, selected, onSelect, onStartDrag, onUpdate }: {
  device: Device;
  selected: boolean;
  onSelect: () => void;
  onStartDrag: (event: ReactPointerEvent<SVGGElement>, device: Device) => void;
  onUpdate: (patch: Partial<Device>) => void;
}) {
  const accent = deviceAccent(device.type);
  const Icon = iconFor(device.type);
  const range = coneRange(device.type);
  const fov = device.fov ?? 82;
  const spread = Math.tan((fov / 2) * Math.PI / 180) * range;
  const cone = `M 0 0 L ${range} ${-spread} A ${range} ${range} 0 0 1 ${range} ${spread} Z`;
  return (
    <g
      data-device-id={device.id}
      transform={`translate(${device.x} ${device.y})`}
      className="cursor-grab active:cursor-grabbing"
      onPointerDown={(e) => onStartDrag(e, device)}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {device.type.startsWith('cam.') && (
        <g transform={`rotate(${device.rot ?? 0})`} opacity="0.28">
          <path d={cone} fill={accent} stroke={accent} strokeWidth="1.4" />
        </g>
      )}
      <circle data-hit="device" r={selected ? 22 : 18} fill="var(--command-fg)" stroke={accent} strokeWidth={selected ? 4 : 2.5} />
      <foreignObject x="-11" y="-11" width="22" height="22" pointerEvents="none">
        <div className="flex h-full w-full items-center justify-center" style={{ color: accent }}>
          <Icon className="h-4 w-4" />
        </div>
      </foreignObject>
      {selected && <circle r="30" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="5 5" />}
      <text x="0" y="43" textAnchor="middle" fill="var(--command-bg)" fontSize="13" fontWeight="650">{device.label}</text>
      <text x="0" y="59" textAnchor="middle" fill="var(--command-panel)" fontSize="11">{kindFor(device.type)}</text>
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

function PathwayLine({ pathway, floor }: { pathway: Pathway; floor: Floor | null }) {
  const points = (pathway.points ?? []).map((p) => `${p.x},${p.y}`).join(' ');
  if (!points) return null;
  return (
    <g>
      <polyline points={points} fill="none" stroke={routeColor(pathway.pathwayKind ?? pathway.type)} strokeWidth={pathway.pathwayKind === 'conduit' ? 5 : 3.5} strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      {pathway.points?.[0] && (
        <text x={pathway.points[0].x + 10} y={pathway.points[0].y - 10} fill="var(--foreground)" fontSize="12" fontWeight="650">
          {pathway.id} · {pathwayLengthFt(pathway, floor)} ft
        </text>
      )}
    </g>
  );
}

function MeasurementMark({ measurement, floor }: { measurement: Measurement; floor: Floor | null }) {
  const label = measurement.label ?? `${(Math.hypot(measurement.b.x - measurement.a.x, measurement.b.y - measurement.a.y) * ftPerPxForFloor(floor)).toFixed(1)} ft`;
  const mx = (measurement.a.x + measurement.b.x) / 2;
  const my = (measurement.a.y + measurement.b.y) / 2;
  return (
    <g>
      <line x1={measurement.a.x} y1={measurement.a.y} x2={measurement.b.x} y2={measurement.b.y} stroke="var(--primary)" strokeWidth="2" strokeDasharray="6 5" />
      <rect x={mx - 39} y={my - 18} width="78" height="28" rx="14" fill="var(--card)" stroke="var(--border)" />
      <text x={mx} y={my + 5} textAnchor="middle" fill="var(--foreground)" fontSize="13" fontWeight="650">{label}</text>
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
    <div className="absolute inset-x-6 bottom-5 z-selection-menu">
      <div data-canvas-chrome="selection-menu" className="dv-floating-toolbar mx-auto flex w-fit max-w-full items-center gap-2 p-2">
        <div className="min-w-44 border-r border-[var(--command-border)] px-2">
          <div className="text-sm font-semibold">{selected.label}</div>
          <div className="text-xs text-muted-foreground">{selected.id} · {kindFor(selected.type)}</div>
        </div>
        {selected.type === 'cam.multisensor' && (['a', 'b', 'c', 'd'] as LensId[]).map((lens) => (
            <button key={lens} data-track={`selmenu-lens-${lens}`} className="h-8 w-8 rounded-lg border border-[var(--command-border)] text-xs font-semibold uppercase" style={{ boxShadow: activeLens === lens ? 'inset 0 0 0 1px var(--command-accent)' : 'none' }} onClick={() => setActiveLens(lens)}>
            {lens}
          </button>
        ))}
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button key={section.id} data-track={`selmenu-${section.id}`} className={cls('flex h-9 items-center gap-1 rounded-lg px-3 text-xs', selectedSection === section.id ? 'dv-command-accent-pill' : 'hover:bg-white/10')} onClick={() => setSelectedSection(selectedSection === section.id ? null : section.id)}>
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
        <div data-testid="selection-section-panel" className="dv-asset-popover mx-auto mt-3 w-96 p-4">
          <div data-testid="selection-section-title" className="text-sm font-semibold">{sectionLabel(selectedSection)} · {selected.label}</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <InfoMetric label="Mount" value={`${selected.mountFt ?? 10} ft`} />
            <InfoMetric label="Range" value={`${selected.range ?? 0} ft`} />
            <InfoMetric label="FOV" value={`${selected.fov ?? 0} deg`} />
            <InfoMetric label="Rotation" value={`${selected.rot ?? 0} deg`} />
          </div>
        </div>
      )}
    </div>
  );
}

function sectionLabel(section: string) {
  if (section === 'aim') return 'Aim and geometry';
  if (section === 'specs') return 'Product specs';
  if (section === 'power') return 'Power and network';
  return 'Coverage review';
}

function RightPanel({ selected, rows, sellTotal, devices, pathways, aiOpen, onOpenBom, onUpdateSelected }: {
  selected: Device | null;
  rows: CanvasBomRow[];
  sellTotal: number;
  devices: Device[];
  pathways: Pathway[];
  aiOpen: boolean;
  onOpenBom: () => void;
  onUpdateSelected: (patch: Partial<Device>) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between border-b border-[var(--command-border)] px-4">
        <div>
          <div className="dv-muted-command text-xs font-medium uppercase tracking-wide">Inspector</div>
          <div className="text-sm font-semibold">{selected ? selected.label : 'Project health'}</div>
        </div>
        <button className="dv-command-icon" onClick={onOpenBom}><CircleDollarSign className="h-5 w-5" /></button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {selected ? (
          <div className="dv-inspector-card p-4">
            <div className="dv-muted-command text-xs">Selected object</div>
            <div className="mt-2 text-sm font-semibold">{selected.id}</div>
            <div className="dv-muted-command text-xs">{kindFor(selected.type)}</div>
            <label className="dv-muted-command mt-4 block text-xs">Label</label>
            <input className="dv-command-input mt-1 px-3 py-2 text-sm" value={selected.label} onChange={(e) => onUpdateSelected({ label: e.target.value })} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <InfoMetric label="Devices" value={String(devices.length)} />
            <InfoMetric label="Routes" value={String(pathways.length)} />
            <InfoMetric label="BOM rows" value={String(rows.length)} />
            <InfoMetric label="Sell total" value={currency(sellTotal)} />
          </div>
        )}
        <div className="dv-inspector-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" /> Design checks</div>
          <div className="dv-muted-command space-y-2 text-xs">
            <div>Assign cameras and network gear to IDFs before proposal.</div>
            <div>Validate door hardware stacks during field survey.</div>
            <div>Route lengths update BOM once cable/conduit paths are saved.</div>
          </div>
        </div>
        {aiOpen && (
          <div className="dv-inspector-card border-[var(--command-accent)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> AI review</div>
            <p className="dv-muted-command mt-2 text-xs leading-5">Review flags only. AI suggestions do not change a design or certify compliance.</p>
          </div>
        )}
        <div className="dv-inspector-card p-4">
          <div className="mb-3 flex items-center justify-between text-sm font-semibold"><span>Estimate pulse</span><span>{currency(sellTotal)}</span></div>
          <div className="space-y-2">
            {rows.slice(0, 5).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="dv-muted-command truncate">{row.description}</span>
                <span className="font-medium">{currency(row.qty * row.unitPrice)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="dv-inspector-card p-3">
      <div className="dv-muted-command text-xs">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function AssetRail({ mode, setMode, cameraProducts, accessProducts, networkProducts, cameraSub, setCameraSub, cableSub, setCableSub, onPlace, onDragStart, onPointerDrag, onArmRoute }: {
  mode: AssetMode;
  setMode: (mode: AssetMode) => void;
  cameraProducts: Product[];
  accessProducts: Product[];
  networkProducts: Product[];
  cameraSub: string;
  setCameraSub: (sub: string) => void;
  cableSub: CableType | string;
  setCableSub: (sub: CableType | string) => void;
  onPlace: (id: string) => void;
  onDragStart: (e: DragEvent<HTMLButtonElement>, productId: string) => void;
  onPointerDrag: (e: ReactPointerEvent<HTMLButtonElement>, product: Product) => void;
  onArmRoute: (kind: 'cable' | 'conduit') => void;
}) {
  const products = mode === 'camera' ? cameraProducts : mode === 'access' ? accessProducts : mode === 'network' ? networkProducts : [];
  return (
    <aside data-canvas-chrome="tray" className="dv-asset-rail-dark z-bottom-bar w-18 shrink-0 p-2">
      <div className="flex h-full flex-col items-center gap-2">
        <RailButton active={mode === 'camera'} dataTrack="bottombar-cat-cam" icon={Camera} label="Cam" onClick={() => setMode(mode === 'camera' ? null : 'camera')} />
        <RailButton active={mode === 'route'} dataTrack="bottombar-cat-cable" icon={Cable} label="Cable" onClick={() => { setMode('route'); onArmRoute('cable'); }} />
        <RailButton active={mode === 'route'} dataTrack="bottombar-cat-conduit" icon={Route} label="Conduit" onClick={() => { setMode('route'); onArmRoute('conduit'); }} />
        <RailButton active={mode === 'access'} dataTrack="bottombar-cat-access" icon={DoorOpen} label="Access" onClick={() => setMode(mode === 'access' ? null : 'access')} />
        <RailButton active={mode === 'network'} dataTrack="bottombar-cat-network" icon={Network} label="Net" onClick={() => setMode(mode === 'network' ? null : 'network')} />
      </div>
      {mode && (
        <div className="dv-asset-popover absolute bottom-4 right-24 top-20 z-popover flex w-96 flex-col overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Insert</div>
                <div className="text-lg font-semibold">{mode === 'camera' ? 'Camera catalog' : mode === 'access' ? 'Access hardware' : mode === 'network' ? 'Network gear' : 'Route builder'}</div>
              </div>
              <button className="dv-command-icon" onClick={() => setMode(null)}><X className="h-4 w-4" /></button>
            </div>
            {mode === 'camera' && (
              <div className="mt-3 flex flex-wrap gap-1">
                {['all', 'bullet', 'dome', 'ptz', 'multi', 'fisheye'].map((sub) => (
                  <button key={sub} data-testid={`cam-sub-${sub}`} className={cls('rounded-md border px-2 py-1 text-xs capitalize', cameraSub === sub ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')} onClick={() => setCameraSub(sub)}>
                    {sub}
                  </button>
                ))}
              </div>
            )}
            {mode === 'route' && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {(['cat6', 'cat6a', 'fiber-sm', 'power'] as const).map((sub) => (
                    <button key={sub} data-track={`bottombar-cable-sub-${sub === 'cat6' ? 'cable' : sub === 'fiber-sm' ? 'network' : sub}`} className={cls('rounded-md border px-2 py-1 text-xs uppercase', cableSub === sub ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')} onClick={() => setCableSub(sub)}>
                      {sub}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="dv-floating-button justify-center" onClick={() => onArmRoute('cable')}>Arm cable route</button>
                  <button className="dv-floating-button justify-center" onClick={() => onArmRoute('conduit')}>Arm conduit</button>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">Click points on the plan. Press Enter or Finish route to save the path into BOM.</p>
              </div>
            )}
          </div>
          {mode !== 'route' && (
            <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  draggable={false}
                  data-track={`${mode === 'camera' ? 'bottombar-cam' : mode === 'access' ? 'bottombar-access' : 'bottombar-network'}-${product.id}`}
                  className="dv-product-card p-3"
                  onClick={(event) => event.preventDefault()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onPlace(product.id);
                    }
                  }}
                  onDragStart={(e) => onDragStart(e, product.id)}
                  onPointerDown={(e) => onPointerDrag(e, product)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      {mode === 'camera' ? <Camera className="h-5 w-5 text-primary" /> : mode === 'access' ? <DoorOpen className="h-5 w-5 text-primary" /> : <Network className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{productLabel(product)}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.sub || product.productName || product.type}</div>
                      <div className="mt-2 flex gap-2 text-xs text-muted-foreground"><span>{product.resolution ?? product.poe ?? product.type}</span><span>{product.msrp ? currency(product.msrp) : 'No price'}</span></div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function RailButton({ active, dataTrack, icon: Icon, label, onClick }: { active: boolean; dataTrack: string; icon: typeof Camera; label: string; onClick: () => void }) {
  return (
    <button data-track={dataTrack} title={label} className={cls('dv-studio-tool flex h-14 w-14 flex-col gap-1 text-xs', active && 'dv-studio-tool-active')} onClick={onClick}>
      <Icon className="h-5 w-5" />
      <span>{label.slice(0, 3)}</span>
    </button>
  );
}

function DragGhost({ ghost }: { ghost: ProductDragGhost }) {
  return (
    <div className="dv-drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
      <div className="flex items-center gap-2">
        <Camera className={cls('h-4 w-4', ghost.overCanvas ? 'dv-command-accent-text' : 'dv-muted-command')} />
        <span className="max-w-48 truncate text-xs font-semibold">{ghost.label}</span>
        <span className={cls('rounded-full px-2 py-0.5 text-xs uppercase tracking-wide', ghost.overCanvas ? 'dv-command-accent-pill' : 'bg-white/10 dv-muted-command')}>
          {ghost.overCanvas ? 'Release' : 'Drag to plan'}
        </span>
      </div>
    </div>
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
          <div key={row.id} data-track={`bom-row-${row.id}`} className="rounded-xl border border-border bg-background p-3">
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

function PlanSetup({ onClose, onMode, projectId }: { onClose: () => void; onMode: (mode: 'blueprint' | 'satellite') => void; projectId: string }) {
  const navigate = useNavigate();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="rounded-xl border border-border bg-background p-5 hover:border-primary">
        <Upload className="h-6 w-6 text-primary" />
        <div className="mt-4 text-base font-semibold">Upload and calibrate</div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Use the existing calibration workspace for PDF/image upload, scale, and floor details.</p>
        <input className="mt-4 block w-full text-xs" type="file" accept=".pdf,image/*" onChange={() => navigate(`/calibrate/${projectId}`)} />
      </label>
      <button className="rounded-xl border border-border bg-background p-5 text-left hover:border-primary" onClick={() => { onMode('satellite'); onClose(); }}>
        <Satellite className="h-6 w-6 text-primary" />
        <div className="mt-4 text-base font-semibold">Satellite planning layer</div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Switches the board to site-map planning mode for exterior layout work.</p>
      </button>
      <button className="rounded-xl border border-border bg-background p-5 text-left hover:border-primary" onClick={() => navigate('/visionscan')}>
        <ScanLine className="h-6 w-6 text-primary" />
        <div className="mt-4 text-base font-semibold">Vision scan</div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Open the scan workflow for field capture and generated floorplan review.</p>
      </button>
    </div>
  );
}

function Overview({ floors, devices, pathways }: { floors: Floor[]; devices: Device[]; pathways: Pathway[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {floors.map((floor) => (
        <div key={floor.id} className="rounded-xl border border-border bg-background p-4">
          <div className="text-sm font-semibold">{floor.name}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <InfoMetric label="Devices" value={String(devices.filter((d) => d.floorId === floor.id).length)} />
            <InfoMetric label="Routes" value={String(pathways.filter((p) => p.floorId === floor.id).length)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FloorManager({ floors, devices, onOpen }: { floors: Floor[]; devices: Device[]; onOpen: (floorId: string) => void }) {
  return (
    <div className="space-y-2">
      {floors.map((floor) => (
        <div key={floor.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
          <div>
            <div className="text-sm font-semibold">{floor.name}</div>
            <div className="text-xs text-muted-foreground">{devices.filter((d) => d.floorId === floor.id).length} devices on this floor</div>
          </div>
          <button className="dv-panel-button" onClick={() => onOpen(floor.id)}>Open</button>
        </div>
      ))}
    </div>
  );
}

function modalTitle(modal: Modal) {
  if (modal === 'plan') return 'Plan source';
  if (modal === 'overview') return 'Floor overview';
  if (modal === 'floors') return 'Manage floors';
  return '';
}

function MenuButton({ dataTrack, icon: Icon, label, onClick }: { dataTrack: string; icon: typeof FileText; label: string; onClick: () => void }) {
  return (
    <button data-track={dataTrack} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={onClick}>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{label}</span>
    </button>
  );
}

function fallbackBomRows(devices: Device[]): CanvasBomRow[] {
  const count = Math.max(devices.length, 1);
  return [{
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
  }];
}
