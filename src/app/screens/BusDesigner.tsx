// Bus Security Designer — per-bus editor
//
// Top-down bus template with camera placement, FOV cones, DVR / power
// validation, AI warnings, cable routing, event buttons, BOM rollup,
// and commissioning checklist. Everything store-backed.

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import {
  Bus as BusIcon, Plus, Trash2, AlertTriangle, CheckCircle2, FileDown,
  Cable, Zap, Antenna, ChevronRight, ChevronLeft, MousePointer2,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type { Bus, BusCamera, BusCameraLocation, BusDVR, BusEventInput, BusCommissioningCheck } from '../store/types';
import { toast } from 'sonner';

const CAM_LOCATION_LABEL: Record<BusCameraLocation, string> = {
  'driver-area':       'Driver area',
  'aisle-front':       'Aisle · front',
  'aisle-mid':         'Aisle · mid',
  'aisle-rear':        'Aisle · rear',
  'door-entry':        'Entry door',
  'rear-cabin':        'Rear cabin',
  'road-forward':      'Road · forward',
  'road-rear':         'Road · rear',
  'side-left':         'Side · left',
  'side-right':        'Side · right',
  'stop-arm':          'Stop arm',
  'wheelchair-lift':   'Wheelchair lift',
  'lpr':               'LPR',
};

/** Default placement (uX, uY in 0..1 of the bus rectangle) and heading
 *  per location. Lets the user one-click drop cameras into the right
 *  position; they can drag later. */
const CAM_LOCATION_DEFAULT: Record<BusCameraLocation, { uX: number; uY: number; rot: number; fov: number; rangeFt: number }> = {
  'driver-area':       { uX: 0.10, uY: 0.30, rot: 180, fov: 90, rangeFt: 10 },
  'aisle-front':       { uX: 0.28, uY: 0.50, rot: 180, fov: 110, rangeFt: 18 },
  'aisle-mid':         { uX: 0.52, uY: 0.50, rot: 180, fov: 110, rangeFt: 18 },
  'aisle-rear':        { uX: 0.78, uY: 0.50, rot: 180, fov: 110, rangeFt: 18 },
  'door-entry':        { uX: 0.18, uY: 0.85, rot: 90, fov: 100, rangeFt: 12 },
  'rear-cabin':        { uX: 0.92, uY: 0.50, rot: 180, fov: 120, rangeFt: 22 },
  'road-forward':      { uX: 0.05, uY: 0.50, rot: 0, fov: 70, rangeFt: 50 },
  'road-rear':         { uX: 0.95, uY: 0.50, rot: 180, fov: 70, rangeFt: 40 },
  'side-left':         { uX: 0.50, uY: 0.10, rot: 270, fov: 95, rangeFt: 30 },
  'side-right':        { uX: 0.50, uY: 0.90, rot: 90, fov: 95, rangeFt: 30 },
  'stop-arm':          { uX: 0.55, uY: 0.10, rot: 270, fov: 80, rangeFt: 40 },
  'wheelchair-lift':   { uX: 0.50, uY: 0.85, rot: 90, fov: 100, rangeFt: 14 },
  'lpr':               { uX: 0.95, uY: 0.45, rot: 180, fov: 25, rangeFt: 50 },
};

/** Sample DVR / NVR options. Mirrors the broader catalog idea. */
const DVR_CATALOG: Array<{ id: string; manufacturer: string; model: string; channels: number; storageGB: number; gps: boolean; lte: boolean; wifi: boolean; sensorInputs: number; inputVDC: BusDVR['inputVDC']; msrp: number }> = [
  { id: 'dvr-seon-trooper', manufacturer: 'Seon (Safe Fleet)', model: 'Trooper TX',  channels: 8,  storageGB: 1000, gps: true, lte: true,  wifi: true, sensorInputs: 8,  inputVDC: '12/24V', msrp: 2895 },
  { id: 'dvr-seon-trooper-12', manufacturer: 'Seon (Safe Fleet)', model: 'Trooper TX 12', channels: 12, storageGB: 2000, gps: true, lte: true,  wifi: true, sensorInputs: 12, inputVDC: '12/24V', msrp: 3895 },
  { id: 'dvr-angel-axn8',  manufacturer: 'Angel Trax', model: 'AXN8',         channels: 8,  storageGB: 1000, gps: true, lte: true,  wifi: true, sensorInputs: 6,  inputVDC: '12/24V', msrp: 2695 },
  { id: 'dvr-rosco-dv8',   manufacturer: 'Rosco Vision', model: 'DV8 HD',     channels: 8,  storageGB: 1000, gps: true, lte: false, wifi: true, sensorInputs: 4,  inputVDC: '12/24V', msrp: 2495 },
  { id: 'dvr-gemini-mdvr', manufacturer: 'Gemini', model: 'MDVR-12',          channels: 12, storageGB: 2000, gps: true, lte: true,  wifi: true, sensorInputs: 10, inputVDC: '12/24V', msrp: 3495 },
];

/** Sample camera SKUs used per location. Production catalog supersedes. */
const BUS_CAM_SKU_BY_LOCATION: Record<BusCameraLocation, { sku: string; mfr: string; model: string; msrp: number; powerW: number }> = {
  'driver-area':     { sku: 'cam-bus-dome',    mfr: 'Seon',        model: 'BusCam HD Dome',     msrp: 245, powerW: 4 },
  'aisle-front':     { sku: 'cam-bus-dome',    mfr: 'Seon',        model: 'BusCam HD Dome',     msrp: 245, powerW: 4 },
  'aisle-mid':       { sku: 'cam-bus-dome',    mfr: 'Seon',        model: 'BusCam HD Dome',     msrp: 245, powerW: 4 },
  'aisle-rear':      { sku: 'cam-bus-dome',    mfr: 'Seon',        model: 'BusCam HD Dome',     msrp: 245, powerW: 4 },
  'door-entry':      { sku: 'cam-bus-door',    mfr: 'Angel Trax',  model: 'AT-Door 1080p',      msrp: 285, powerW: 4 },
  'rear-cabin':      { sku: 'cam-bus-wide',    mfr: 'Seon',        model: 'BusCam Wide 1080p',  msrp: 295, powerW: 5 },
  'road-forward':    { sku: 'cam-bus-road',    mfr: 'Rosco',       model: 'Road-Forward HD',    msrp: 425, powerW: 5 },
  'road-rear':       { sku: 'cam-bus-rear',    mfr: 'Rosco',       model: 'Rear-View HD',       msrp: 395, powerW: 5 },
  'side-left':       { sku: 'cam-bus-side',    mfr: 'Seon',        model: 'BusCam Side HD',     msrp: 345, powerW: 5 },
  'side-right':      { sku: 'cam-bus-side',    mfr: 'Seon',        model: 'BusCam Side HD',     msrp: 345, powerW: 5 },
  'stop-arm':        { sku: 'cam-bus-stoparm', mfr: 'Gatekeeper',  model: 'Stop-Arm LPR',       msrp: 1095, powerW: 6 },
  'wheelchair-lift': { sku: 'cam-bus-dome',    mfr: 'Seon',        model: 'BusCam HD Dome',     msrp: 245, powerW: 4 },
  'lpr':             { sku: 'cam-bus-lpr',     mfr: 'Gatekeeper',  model: 'Plate Capture HD',   msrp: 895, powerW: 6 },
};

export function BusDesigner() {
  const { projectId = 'p1', busId = '' } = useParams();
  const nav = useNavigate();

  const bus = useProjectStore((s) => s.buses[busId]);
  const projectName = useProjectStore((s) => s.projects[projectId]?.name ?? 'Project');
  const updateBus = useProjectStore((s) => s.updateBus);
  // Subscribe to raw maps; derive arrays via useMemo so selectors don't
  // return new array references on every render (infinite-loop guard).
  const busCamerasMap = useProjectStore((s) => s.busCameras);
  const busDVRsMap = useProjectStore((s) => s.busDVRs);
  const busChecksMap = useProjectStore((s) => s.busChecks);
  const busEventsMap = useProjectStore((s) => s.busEvents);
  const cameras = useMemo(() => Object.values(busCamerasMap).filter((c) => c.busId === busId), [busCamerasMap, busId]);
  const dvrs = useMemo(() => Object.values(busDVRsMap).filter((d) => d.busId === busId), [busDVRsMap, busId]);
  const checks = useMemo(() => Object.values(busChecksMap).filter((c) => c.busId === busId), [busChecksMap, busId]);
  const events = useMemo(() => Object.values(busEventsMap).filter((e) => e.busId === busId), [busEventsMap, busId]);

  const addBusCamera = useProjectStore((s) => s.addBusCamera);
  const updateBusCamera = useProjectStore((s) => s.updateBusCamera);
  const removeBusCamera = useProjectStore((s) => s.removeBusCamera);
  const addBusDVR = useProjectStore((s) => s.addBusDVR);
  const updateBusDVR = useProjectStore((s) => s.updateBusDVR);
  const removeBusDVR = useProjectStore((s) => s.removeBusDVR);
  const addBusEvent = useProjectStore((s) => s.addBusEvent);
  const removeBusEvent = useProjectStore((s) => s.removeBusEvent);
  const updateBusCheck = useProjectStore((s) => s.updateBusCheck);

  const dvr = dvrs[0];
  const [tab, setTab] = useState<'design' | 'electrical' | 'cabling' | 'events' | 'commissioning' | 'bom'>('design');
  const [selectedCamId, setSelectedCamId] = useState<string | null>(null);
  const [addCamMenuOpen, setAddCamMenuOpen] = useState(false);

  // ── AI validation
  const validation = useMemo(() => {
    const items: { severity: 'high' | 'med' | 'low'; label: string; detail: string }[] = [];
    if (!bus) return items;
    // DVR channels
    if (dvr && cameras.length > dvr.channels) {
      items.push({ severity: 'high', label: `${cameras.length} cameras over ${dvr.channels}-channel DVR`,
        detail: 'Upgrade to a 12-channel mobile DVR or split cameras across two recorders.' });
    }
    if (!dvr && cameras.length > 0) {
      items.push({ severity: 'high', label: 'No DVR selected', detail: 'Select a mobile DVR/NVR to capture and tag clips.' });
    }
    // Storage retention math: assume ~6 Mbps per channel · cameras · 86400 s · days
    if (dvr) {
      const tbNeeded = (cameras.length * 6 * 86400 * bus.retentionTargetDays) / 8e9;
      if (tbNeeded * 1000 > dvr.storageGB) {
        items.push({ severity: 'med', label: `Storage below ${bus.retentionTargetDays}-day target`,
          detail: `${cameras.length} cameras · ${bus.retentionTargetDays} d needs ≈ ${tbNeeded.toFixed(1)} TB; DVR has ${(dvr.storageGB / 1000).toFixed(1)} TB.` });
      }
      if (bus.cellularRequired && !dvr.lte) {
        items.push({ severity: 'med', label: 'Cellular required but DVR lacks LTE', detail: 'Choose a recorder with onboard LTE or add an external modem.' });
      }
      if (!dvr.gps) {
        items.push({ severity: 'med', label: 'GPS missing from DVR', detail: 'GPS is required for event geotag and tamper validation.' });
      }
    }
    // Coverage
    if (bus.hasStopArm && !cameras.some((c) => c.location === 'stop-arm')) {
      items.push({ severity: 'high', label: 'Stop-arm camera missing', detail: 'Stop-arm-equipped buses require a dedicated stop-arm capture camera.' });
    }
    if (bus.hasWheelchairLift && !cameras.some((c) => c.location === 'wheelchair-lift')) {
      items.push({ severity: 'med', label: 'Wheelchair-lift camera missing', detail: 'Add a lift-bay dome for accessibility and accountability.' });
    }
    if (!cameras.some((c) => c.location === 'road-forward')) {
      items.push({ severity: 'low', label: 'No forward-road camera', detail: 'Forward-road footage drives incident triangulation; add a windshield-mounted camera.' });
    }
    if (!cameras.some((c) => c.location === 'driver-area')) {
      items.push({ severity: 'low', label: 'No driver-area camera', detail: 'Driver-area coverage supports incident review and driver coaching.' });
    }
    if (events.length === 0) {
      items.push({ severity: 'low', label: 'No panic / event button placed', detail: 'Driver panic + event-marker buttons are standard for fleet safety.' });
    }
    // Power
    const powerDraw = cameras.reduce((sum, c) => sum + (c.powerW ?? 4), 0) + (dvr ? 35 : 0);
    if (powerDraw > 80 && bus.voltage === '12V') {
      items.push({ severity: 'med', label: `Power draw ${powerDraw} W is high for 12 V`,
        detail: 'Use a DC/DC converter and a fused power harness; avoid sharing existing OEM circuits.' });
    }
    return items;
  }, [bus, dvr, cameras, events]);

  if (!bus) {
    return (
      <AppShell crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Bus not found' }]} title="Bus not found">
        <div className="p-10 text-muted-foreground">
          Bus id <code>{busId}</code> not found.
          <button className="ml-2 text-primary underline" onClick={() => nav(`/project/${projectId}/bus`)}>Back to fleet</button>
        </div>
      </AppShell>
    );
  }

  const handleAddCamera = (loc: BusCameraLocation) => {
    if (cameras.some((c) => c.location === loc)) {
      toast.message(`${CAM_LOCATION_LABEL[loc]} camera already exists`);
      return;
    }
    const sku = BUS_CAM_SKU_BY_LOCATION[loc];
    const def = CAM_LOCATION_DEFAULT[loc];
    const channel = nextChannel(cameras, dvr);
    const cam: BusCamera = {
      id: `bcam-${Date.now().toString(36).slice(-5)}`,
      busId, location: loc,
      uX: def.uX, uY: def.uY, rot: def.rot,
      fov: def.fov, rangeFt: def.rangeFt,
      dvrChannel: channel,
      productId: sku.sku,
      powerW: sku.powerW,
      mount: loc === 'road-forward' || loc === 'lpr' ? 'flush' : loc.startsWith('side') ? 'side-window' : 'flush',
    };
    addBusCamera(cam);
    setSelectedCamId(cam.id);
    setAddCamMenuOpen(false);
  };

  const handleAddDVR = (id: string) => {
    const cat = DVR_CATALOG.find((d) => d.id === id);
    if (!cat) return;
    if (dvr) removeBusDVR(dvr.id);
    const d: BusDVR = {
      id: `dvr-${Date.now().toString(36).slice(-5)}`,
      busId,
      kind: 'mobile-dvr',
      manufacturer: cat.manufacturer,
      model: cat.model,
      channels: cat.channels,
      storageGB: cat.storageGB,
      gps: cat.gps, lte: cat.lte, wifiOffload: cat.wifi,
      sensorInputs: cat.sensorInputs,
      inputVDC: cat.inputVDC,
    };
    addBusDVR(d);
    toast.success(`DVR · ${cat.manufacturer} ${cat.model}`);
  };

  const exportReport = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      drawBusReport(doc, bus, cameras, dvr, events, checks, validation);
      doc.save(`${projectId}-bus-${bus.busTag}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Exported bus design report');
    } catch (e) { console.error(e); toast.error('Export failed'); }
  };

  // Bus rectangle dimensions in canvas px (scaled to viewBox)
  const BUS_W = 920;
  const BUS_H = 220;

  return (
    <AppShell
      crumbs={[
        { label: 'Projects', to: '/projects' },
        { label: projectName, to: `/project/${projectId}` },
        { label: 'Bus Security', to: `/project/${projectId}/bus` },
        { label: `Bus ${bus.busTag}` },
      ]}
      title={`Bus ${bus.busTag}`}
      subtitle={`${BUS_TYPE_LABEL[bus.busType]}${bus.year ? ` · ${bus.year}` : ''}${bus.make ? ` · ${bus.make}` : ''}${bus.model ? ` ${bus.model}` : ''}`}
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportReport}>
            <FileDown className="w-3.5 h-3.5 mr-1" />Export PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => nav(`/project/${projectId}/bus`)}>
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />Fleet
          </Button>
        </div>
      }
      fullBleed
    >
      <div className="h-full flex flex-col bg-background text-foreground">
        {/* Tabs */}
        <div className="border-b border-border bg-card px-4 flex items-center gap-1">
          {(['design', 'electrical', 'cabling', 'events', 'commissioning', 'bom'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 h-9 text-[12.5px] capitalize transition-colors border-b-2 ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'bom' ? 'BOM' : t}
            </button>
          ))}
          <div className="ml-auto text-[11px] text-muted-foreground">
            {cameras.length} cameras · {dvr ? `${dvr.channels}-ch DVR` : 'No DVR'} · {bus.retentionTargetDays} d retention
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[1fr_320px]">
          {/* Main pane */}
          <div className="overflow-auto bg-canvas-background">
            {tab === 'design' && (
              <div className="p-6 space-y-4">
                {/* Top-down bus template + cameras */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="text-[12px] uppercase tracking-wider text-muted-foreground mb-3">Top-down · interior + exterior camera placement</div>
                  <svg viewBox={`-40 -40 ${BUS_W + 80} ${BUS_H + 80}`} className="w-full">
                    {/* Bus body */}
                    <rect x={0} y={0} width={BUS_W} height={BUS_H} rx={32} fill="var(--card)" stroke="var(--border-strong)" strokeWidth={2.5} />
                    {/* Front (driver) cap */}
                    <path d={`M 0 ${BUS_H * 0.2} Q -22 ${BUS_H * 0.5} 0 ${BUS_H * 0.8}`} stroke="var(--border-strong)" strokeWidth={2.5} fill="none" />
                    {/* Windshield */}
                    <rect x={20} y={BUS_H * 0.22} width={42} height={BUS_H * 0.56} fill="var(--canvas-background)" stroke="var(--muted-foreground)" strokeWidth={1} />
                    <text x={42} y={BUS_H * 0.55} fontSize={9} textAnchor="middle" fill="var(--muted-foreground)">DRV</text>
                    {/* Entry door */}
                    <rect x={BUS_W * 0.16} y={BUS_H - 14} width={48} height={14} fill="var(--muted)" stroke="var(--border-strong)" />
                    <text x={BUS_W * 0.16 + 24} y={BUS_H - 3} fontSize={9} textAnchor="middle" fill="var(--foreground)">Entry</text>
                    {/* Stop arm marker */}
                    {bus.hasStopArm && (
                      <g>
                        <line x1={BUS_W * 0.55} y1={0} x2={BUS_W * 0.55} y2={-22} stroke="var(--destructive)" strokeWidth={2} />
                        <text x={BUS_W * 0.55} y={-26} fontSize={9} textAnchor="middle" fill="var(--destructive)">STOP ARM</text>
                      </g>
                    )}
                    {/* Wheelchair lift marker */}
                    {bus.hasWheelchairLift && (
                      <g>
                        <rect x={BUS_W * 0.52} y={BUS_H} width={50} height={14} fill="var(--warning)" opacity={0.4} stroke="var(--warning)" />
                        <text x={BUS_W * 0.52 + 25} y={BUS_H + 11} fontSize={9} textAnchor="middle" fill="var(--foreground)">LIFT</text>
                      </g>
                    )}
                    {/* Seat rows */}
                    {Array.from({ length: 11 }).map((_, i) => (
                      <g key={i}>
                        <rect x={90 + i * 70} y={20} width={56} height={32} fill="var(--muted)" opacity={0.4} stroke="var(--muted-foreground)" strokeWidth={0.5} />
                        <rect x={90 + i * 70} y={BUS_H - 52} width={56} height={32} fill="var(--muted)" opacity={0.4} stroke="var(--muted-foreground)" strokeWidth={0.5} />
                      </g>
                    ))}

                    {/* Cameras + cones */}
                    {cameras.map((c) => {
                      const cx = c.uX * BUS_W;
                      const cy = c.uY * BUS_H;
                      const isSel = selectedCamId === c.id;
                      // Cone: range scaled — 1 ft ≈ 4 px
                      const r = c.rangeFt * 4;
                      const half = c.fov / 2;
                      const a1 = ((c.rot - half) * Math.PI) / 180;
                      const a2 = ((c.rot + half) * Math.PI) / 180;
                      const x1 = cx + Math.cos(a1) * r;
                      const y1 = cy + Math.sin(a1) * r;
                      const x2 = cx + Math.cos(a2) * r;
                      const y2 = cy + Math.sin(a2) * r;
                      const large = half > 90 ? 1 : 0;
                      const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
                      return (
                        <g key={c.id} onPointerDown={(e) => { e.stopPropagation(); setSelectedCamId(c.id); }} style={{ cursor: 'pointer' }}>
                          <path d={path} fill="#F08F3C" fillOpacity={isSel ? 0.18 : 0.10} />
                          <circle cx={cx} cy={cy} r={isSel ? 8 : 6} fill="#F08F3C" />
                          <circle cx={cx} cy={cy} r={isSel ? 4 : 3} fill="var(--canvas-background)" />
                          {c.dvrChannel != null && (
                            <text x={cx} y={cy - 11} fontSize={8.5} textAnchor="middle" fill="#F08F3C" fontWeight="600">ch{c.dvrChannel}</text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Camera roster */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                    <div className="text-[12.5px] font-medium text-foreground">Camera roster · {cameras.length}</div>
                    <div className="ml-auto relative">
                      <Button size="sm" onClick={() => setAddCamMenuOpen((o) => !o)}>
                        <Plus className="w-3.5 h-3.5 mr-1" />Add camera
                      </Button>
                      {addCamMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 z-30 w-[260px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                          {(Object.keys(CAM_LOCATION_LABEL) as BusCameraLocation[]).map((loc) => (
                            <button
                              key={loc}
                              onClick={() => handleAddCamera(loc)}
                              disabled={cameras.some((c) => c.location === loc)}
                              className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-secondary/50 text-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
                            >
                              {CAM_LOCATION_LABEL[loc]}
                              {cameras.some((c) => c.location === loc) && <span className="text-[10px] text-success">added</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {cameras.length === 0 ? (
                    <div className="text-center py-10 text-[12px] text-muted-foreground">
                      No cameras yet. Click <strong className="text-foreground">Add camera</strong> to place per-location coverage.
                    </div>
                  ) : (
                    <table className="w-full text-[11.5px]">
                      <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/30">
                        <tr>
                          <th className="text-left px-4 py-1.5">Location</th>
                          <th className="text-left px-4 py-1.5">Product</th>
                          <th className="text-right px-4 py-1.5">Ch</th>
                          <th className="text-right px-4 py-1.5">FOV</th>
                          <th className="text-right px-4 py-1.5">Range</th>
                          <th className="text-right px-4 py-1.5">Power</th>
                          <th className="text-right px-4 py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cameras.map((c) => {
                          const sku = BUS_CAM_SKU_BY_LOCATION[c.location];
                          return (
                            <tr key={c.id} className={`border-t border-border/60 ${selectedCamId === c.id ? 'bg-primary/8' : ''}`}>
                              <td className="px-4 py-2 text-foreground">{CAM_LOCATION_LABEL[c.location]}</td>
                              <td className="px-4 py-2 text-muted-foreground">{sku.mfr} · {sku.model}</td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                <input type="number" min={1} max={dvr?.channels ?? 16} value={c.dvrChannel ?? ''} onChange={(e) => updateBusCamera(c.id, { dvrChannel: e.target.value ? Number(e.target.value) : undefined })} className="dv-input !py-0.5 !px-1.5 !text-[11px] w-14 text-right" />
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-foreground">{c.fov}°</td>
                              <td className="px-4 py-2 text-right tabular-nums text-foreground">{c.rangeFt} ft</td>
                              <td className="px-4 py-2 text-right tabular-nums text-foreground">{c.powerW ?? sku.powerW} W</td>
                              <td className="px-4 py-2 text-right">
                                <button onClick={() => removeBusCamera(c.id)} className="text-muted-foreground hover:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* DVR section */}
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border text-[12.5px] font-medium text-foreground">Recorder / DVR</div>
                  <div className="p-4">
                    {dvr ? (
                      <div className="text-[12px] grid grid-cols-2 gap-3">
                        <Field label="Manufacturer">{dvr.manufacturer}</Field>
                        <Field label="Model">{dvr.model}</Field>
                        <Field label="Channels">{dvr.channels}</Field>
                        <Field label="Storage">{(dvr.storageGB / 1000).toFixed(1)} TB</Field>
                        <Field label="GPS"><Badge ok={dvr.gps} /></Field>
                        <Field label="LTE"><Badge ok={dvr.lte} /></Field>
                        <Field label="Wi-Fi offload"><Badge ok={dvr.wifiOffload} /></Field>
                        <Field label="Sensor inputs">{dvr.sensorInputs}</Field>
                        <div className="col-span-2 pt-2 border-t border-border/60 flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => removeBusDVR(dvr.id)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" />Remove DVR
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-[12px] text-muted-foreground">Pick a recorder from the catalog:</div>
                        {DVR_CATALOG.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => handleAddDVR(d.id)}
                            className="w-full text-left px-3 py-2 rounded border border-border hover:border-primary/40 hover:bg-primary/4 transition-colors"
                          >
                            <div className="text-[12px] font-medium text-foreground">{d.manufacturer} · {d.model}</div>
                            <div className="text-[11px] text-muted-foreground">{d.channels} ch · {(d.storageGB / 1000).toFixed(1)} TB · {[d.gps && 'GPS', d.lte && 'LTE', d.wifi && 'Wi-Fi'].filter(Boolean).join(' · ')} · ${d.msrp.toLocaleString()}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'electrical' && (
              <div className="p-6 space-y-3 max-w-[640px]">
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="text-[13px] font-medium text-foreground mb-2">Electrical baseline</div>
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <Field label="Voltage"><EditNum value={Number(bus.voltage.replace('V', ''))} onChange={(v) => updateBus(bus.id, { voltage: v >= 18 ? '24V' : '12V' })} suffix=" V" /></Field>
                    <Field label="Retention target"><EditNum value={bus.retentionTargetDays} onChange={(v) => updateBus(bus.id, { retentionTargetDays: v })} suffix=" days" /></Field>
                    <Field label="Camera power draw">{cameras.reduce((s, c) => s + (c.powerW ?? 4), 0)} W</Field>
                    <Field label="DVR power draw">{dvr ? '35 W' : '—'}</Field>
                    <Field label="Total draw">{cameras.reduce((s, c) => s + (c.powerW ?? 4), 0) + (dvr ? 35 : 0)} W</Field>
                    <Field label="Battery location"><input className="dv-input" value={bus.batteryLocation ?? ''} placeholder="Engine bay" onChange={(e) => updateBus(bus.id, { batteryLocation: e.target.value })} /></Field>
                    <Field label="Fuse panel location"><input className="dv-input" value={bus.fusePanelLocation ?? ''} placeholder="Driver kick panel" onChange={(e) => updateBus(bus.id, { fusePanelLocation: e.target.value })} /></Field>
                  </div>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="text-[13px] font-medium text-foreground mb-2 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-warning" />Recommended power harness
                  </div>
                  <ul className="text-[12px] text-muted-foreground space-y-1.5 leading-snug">
                    <li>• 10 AWG fused to battery + 14 AWG ignition-trigger leg</li>
                    <li>• Inline 10 A blade fuse within 18 in of battery</li>
                    <li>• DC/DC converter regulated 12 V output (≥{cameras.reduce((s, c) => s + (c.powerW ?? 4), 0) + (dvr ? 35 : 0) + 15} W headroom)</li>
                    <li>• Ground to chassis at clean unpainted point; star washer; ohm to chassis &lt; 0.5 Ω</li>
                  </ul>
                </div>
              </div>
            )}

            {tab === 'cabling' && (
              <div className="p-6 space-y-3 max-w-[720px]">
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="text-[13px] font-medium text-foreground mb-2 flex items-center gap-2"><Cable className="w-3.5 h-3.5 text-primary" />Cable plan</div>
                  <ul className="text-[12px] text-muted-foreground space-y-1.5 leading-snug">
                    <li>• Aviation cable (4-pin or 6-pin) from each camera to DVR (~{cameras.length * 24} ft total at avg 24 ft / cam)</li>
                    <li>• Concealment: roof channel → A-pillar → headliner → equipment box</li>
                    <li>• Service loops of ~12 in at each end</li>
                    <li>• GPS antenna cable: roof-mount → headliner → DVR (≈18 ft)</li>
                    <li>• Wi-Fi / LTE antennas: external mag-mount or roof-flush; sealed penetrations</li>
                    <li>• Event-button cable: dash → DVR sensor input #{events[0]?.inputIndex ?? 1}</li>
                  </ul>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Cable routing on a 3-D bus template is not modeled in v1; this section captures the install-ready plan for the harness drawing.
                </div>
              </div>
            )}

            {tab === 'events' && (
              <div className="p-6 max-w-[640px]">
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border flex items-center">
                    <div className="text-[12.5px] font-medium text-foreground">Event inputs & driver controls</div>
                    <div className="ml-auto flex items-center gap-1">
                      {(['panic-button', 'event-marker', 'stop-arm-trigger', 'ignition', 'driver-monitor', 'touch-display'] as const).map((k) => (
                        <button
                          key={k}
                          onClick={() => {
                            if (events.some((e) => e.kind === k)) { toast.message(`${k} already added`); return; }
                            addBusEvent({ id: `bev-${Date.now().toString(36).slice(-5)}`, busId, kind: k, label: k.replace(/-/g, ' '), inputIndex: events.length + 1 });
                          }}
                          className="text-[10.5px] px-2 h-7 rounded border border-border hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                        >
                          + {k.replace(/-/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                  {events.length === 0 ? (
                    <div className="text-center py-10 text-[12px] text-muted-foreground">No event inputs yet.</div>
                  ) : (
                    <table className="w-full text-[12px]">
                      <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/30">
                        <tr>
                          <th className="text-left px-4 py-1.5">Kind</th>
                          <th className="text-left px-4 py-1.5">Label</th>
                          <th className="text-right px-4 py-1.5">DVR input</th>
                          <th className="text-right px-4 py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((e) => (
                          <tr key={e.id} className="border-t border-border/60">
                            <td className="px-4 py-2 capitalize text-foreground">{e.kind.replace(/-/g, ' ')}</td>
                            <td className="px-4 py-2 text-muted-foreground">{e.label}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-foreground">#{e.inputIndex ?? '—'}</td>
                            <td className="px-4 py-2 text-right">
                              <button onClick={() => removeBusEvent(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {tab === 'commissioning' && (
              <div className="p-6 max-w-[720px]">
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border text-[12.5px] font-medium text-foreground">Commissioning checklist · {checks.filter(c => c.status === 'pass').length}/{checks.length} passed</div>
                  {checks.length === 0
                    ? <div className="px-4 py-6 text-[12px] text-muted-foreground">Checklist hasn't been seeded yet. Open the fleet dashboard and re-add this bus.</div>
                    : checks.map((c) => (
                      <div key={c.id} className="px-4 py-2.5 border-t border-border/60 flex items-center gap-3 text-[12px]">
                        <button
                          onClick={() => updateBusCheck(c.id, { status: c.status === 'pass' ? 'pending' : c.status === 'pending' ? 'fail' : 'pass' })}
                          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${c.status === 'pass' ? 'bg-success border-success text-white' : c.status === 'fail' ? 'bg-destructive border-destructive text-white' : 'border-muted-foreground'}`}
                          title="Cycle: pending → fail → pass"
                        >
                          {c.status === 'pass' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {c.status === 'fail' && <X className="w-3.5 h-3.5" />}
                        </button>
                        <div className="flex-1 text-foreground">{c.step}</div>
                        <div className="text-[10.5px] capitalize text-muted-foreground">{c.status}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {tab === 'bom' && (
              <div className="p-6 max-w-[760px]">
                {(() => {
                  const lines: { sku: string; desc: string; qty: number; unit: number; ext: number }[] = [];
                  // Cameras
                  const camGroups = new Map<string, { mfr: string; model: string; msrp: number; qty: number }>();
                  for (const c of cameras) {
                    const sku = BUS_CAM_SKU_BY_LOCATION[c.location];
                    const k = `${sku.mfr}-${sku.model}`;
                    const cur = camGroups.get(k) ?? { mfr: sku.mfr, model: sku.model, msrp: sku.msrp, qty: 0 };
                    cur.qty++;
                    camGroups.set(k, cur);
                  }
                  camGroups.forEach((g, k) => lines.push({
                    sku: k, desc: `${g.mfr} · ${g.model}`, qty: g.qty, unit: g.msrp, ext: g.qty * g.msrp,
                  }));
                  if (dvr) {
                    const cat = DVR_CATALOG.find((d) => d.model === dvr.model);
                    lines.push({ sku: dvr.model, desc: `${dvr.manufacturer} · ${dvr.model} · ${dvr.channels}-ch / ${(dvr.storageGB / 1000).toFixed(1)} TB`, qty: 1, unit: cat?.msrp ?? 2895, ext: cat?.msrp ?? 2895 });
                  }
                  // Cable + harness
                  const cableFt = cameras.length * 24;
                  if (cableFt > 0) lines.push({ sku: 'cable-aviation', desc: 'Aviation cable (per ft)', qty: cableFt, unit: 1.85, ext: cableFt * 1.85 });
                  // Antennas
                  if (dvr?.lte) lines.push({ sku: 'ant-lte', desc: 'LTE antenna · roof-mount', qty: 1, unit: 65, ext: 65 });
                  if (dvr?.gps) lines.push({ sku: 'ant-gps', desc: 'GPS antenna · roof-mount', qty: 1, unit: 49, ext: 49 });
                  if (dvr?.wifiOffload) lines.push({ sku: 'ant-wifi', desc: 'Wi-Fi antenna · external mag', qty: 1, unit: 39, ext: 39 });
                  // Power harness
                  lines.push({ sku: 'harness-12v', desc: 'Power harness · 10 AWG + inline fuse', qty: 1, unit: 145, ext: 145 });
                  if (cameras.reduce((s, c) => s + (c.powerW ?? 4), 0) + (dvr ? 35 : 0) > 60) {
                    lines.push({ sku: 'dcdc', desc: 'DC/DC converter (regulated 12 V)', qty: 1, unit: 285, ext: 285 });
                  }
                  // Labor
                  const labor = cameras.length * 1.4 + (dvr ? 4 : 0) + 2;
                  lines.push({ sku: 'labor', desc: 'Field install + commissioning labor', qty: Math.round(labor * 10) / 10, unit: 110, ext: Math.round(labor * 110) });
                  const hwTotal = lines.filter(l => l.sku !== 'labor').reduce((s, l) => s + l.ext, 0);
                  const laborTotal = lines.find(l => l.sku === 'labor')?.ext ?? 0;
                  const grand = hwTotal + laborTotal;
                  return (
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-border text-[12.5px] font-medium text-foreground">Bus BOM</div>
                      <table className="w-full text-[12px]">
                        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/30">
                          <tr>
                            <th className="text-left px-4 py-1.5">Item</th>
                            <th className="text-right px-4 py-1.5">Qty</th>
                            <th className="text-right px-4 py-1.5">Unit</th>
                            <th className="text-right px-4 py-1.5">Extended</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((l) => (
                            <tr key={l.sku} className="border-t border-border/60">
                              <td className="px-4 py-2 text-foreground">{l.desc}<span className="text-[10px] text-muted-foreground font-mono ml-2">{l.sku}</span></td>
                              <td className="px-4 py-2 text-right tabular-nums text-foreground">{l.qty}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">${l.unit.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right tabular-nums font-medium text-foreground">${Math.round(l.ext).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-secondary/30">
                          <tr>
                            <td className="px-4 py-2 text-right text-muted-foreground" colSpan={3}>Hardware</td>
                            <td className="px-4 py-2 text-right tabular-nums text-foreground">${hwTotal.toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 text-right text-muted-foreground" colSpan={3}>Labor</td>
                            <td className="px-4 py-2 text-right tabular-nums text-foreground">${laborTotal.toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 text-right text-foreground font-medium" colSpan={3}>Total · per bus</td>
                            <td className="px-4 py-2 text-right tabular-nums text-primary font-medium">${grand.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Right: AI assistant */}
          <div className="border-l border-border bg-card overflow-auto">
            <div className="px-4 py-3 border-b border-border text-[12.5px] font-medium text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Design validation
            </div>
            {validation.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-success">
                <CheckCircle2 className="w-5 h-5 text-success mx-auto mb-1.5" />
                Design clears basic engineering checks.
              </div>
            ) : (
              validation.map((v, i) => (
                <div key={i} className="px-3.5 py-2.5 border-b border-border/60">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: v.severity === 'high' ? '#E5484D' : v.severity === 'med' ? '#E5A23A' : '#7CC2FF' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-foreground leading-tight">{v.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{v.detail}</div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Bus profile quick-edit */}
            <div className="px-4 py-3 border-t border-border">
              <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-2">Bus profile</div>
              <Field2 label="Capacity"><input type="number" min={0} value={bus.capacity ?? ''} onChange={(e) => updateBus(bus.id, { capacity: Number(e.target.value || 0) })} className="dv-input" /></Field2>
              <Field2 label="Wheelchair lift"><ToggleSm checked={!!bus.hasWheelchairLift} onChange={(v) => updateBus(bus.id, { hasWheelchairLift: v })} /></Field2>
              <Field2 label="Stop arm"><ToggleSm checked={!!bus.hasStopArm} onChange={(v) => updateBus(bus.id, { hasStopArm: v })} /></Field2>
              <Field2 label="Cellular required"><ToggleSm checked={bus.cellularRequired} onChange={(v) => updateBus(bus.id, { cellularRequired: v })} /></Field2>
              <Field2 label="Wi-Fi offload"><ToggleSm checked={bus.wifiOffload} onChange={(v) => updateBus(bus.id, { wifiOffload: v })} /></Field2>
              <Field2 label="Status">
                <select value={bus.status} onChange={(e) => updateBus(bus.id, { status: e.target.value as Bus['status'] })} className="dv-input">
                  <option value="draft">draft</option>
                  <option value="engineered">engineered</option>
                  <option value="approved">approved</option>
                  <option value="installed">installed</option>
                  <option value="commissioned">commissioned</option>
                </select>
              </Field2>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ──────────────────────────────────────────────────────────────────

const BUS_TYPE_LABEL: Record<BusType, string> = {
  'type-a': 'Type A', 'type-c': 'Type C', 'type-d': 'Type D',
  'transit': 'Transit', 'activity': 'Activity', 'special-needs': 'Special-needs', 'van': 'Van',
};
type BusType = NonNullable<Bus['busType']>;

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-0.5">{label}</div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}

function Field2({ label, children }: { label: string; children: any }) {
  return (
    <div className="mb-2">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

function EditNum({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center gap-1">
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value || 0))} className="dv-input !py-0.5 w-20" />
      {suffix && <span className="text-[11px] text-muted-foreground">{suffix.trim()}</span>}
    </div>
  );
}

function Badge({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-success/15 text-success">YES</span>
    : <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">NO</span>;
}

function ToggleSm({ checked, onChange }: { checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className={`px-2.5 h-7 rounded border text-[11.5px] ${checked ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
      {checked ? 'Yes' : 'No'}
    </button>
  );
}

function nextChannel(existing: BusCamera[], dvr?: BusDVR): number {
  const used = new Set(existing.map((c) => c.dvrChannel).filter((n): n is number => n != null));
  const max = dvr?.channels ?? 16;
  for (let i = 1; i <= max; i++) if (!used.has(i)) return i;
  return 1;
}

// ─── PDF report ────────────────────────────────────────────────────

function drawBusReport(
  doc: any, bus: Bus, cams: BusCamera[], dvr: BusDVR | undefined,
  events: BusEventInput[], checks: BusCommissioningCheck[],
  validation: { severity: string; label: string; detail: string }[],
) {
  // Cover
  doc.setFillColor(31, 39, 56); doc.rect(0, 0, 612, 792, 'F');
  doc.setFillColor(82, 146, 220); doc.rect(0, 0, 612, 6, 'F');
  doc.setTextColor(238, 241, 247);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(28);
  doc.text('Bus Security Design', 56, 220);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(14);
  doc.text(`Bus ${bus.busTag}`, 56, 250);
  doc.setFontSize(11); doc.setTextColor(168, 178, 200);
  doc.text(`${BUS_TYPE_LABEL[bus.busType]}${bus.year ? ` · ${bus.year}` : ''}${bus.make ? ` · ${bus.make}` : ''}${bus.model ? ` ${bus.model}` : ''}`, 56, 270);
  doc.text(`Cameras · ${cams.length}    DVR · ${dvr ? `${dvr.manufacturer} ${dvr.model}` : 'not selected'}`, 56, 286);
  doc.text(`Retention · ${bus.retentionTargetDays} d    Cellular · ${bus.cellularRequired ? 'required' : 'no'}    Wi-Fi · ${bus.wifiOffload ? 'depot' : 'no'}`, 56, 302);
  doc.text(`Generated · ${new Date().toLocaleString()}`, 56, 318);
  doc.setFontSize(9); doc.setTextColor(120, 134, 162);
  doc.text('Deeper Vision · Fleet security engineering', 56, 760);
  doc.text('Confidential', 540, 760);

  // Page 2 — cameras
  doc.addPage();
  doc.setTextColor(31, 39, 56);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('Camera schedule', 56, 64);
  doc.setDrawColor(82, 146, 220); doc.line(56, 72, 556, 72);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  let y = 96;
  for (const c of cams) {
    if (y > 720) { doc.addPage(); y = 64; }
    const sku = BUS_CAM_SKU_BY_LOCATION[c.location];
    doc.setTextColor(31, 39, 56);
    doc.text(CAM_LOCATION_LABEL[c.location], 56, y);
    doc.setTextColor(80, 90, 110);
    doc.text(`${sku.mfr} · ${sku.model}`, 220, y);
    doc.text(`Ch ${c.dvrChannel ?? '—'}    FOV ${c.fov}°    Range ${c.rangeFt} ft    ${c.powerW ?? sku.powerW} W`, 360, y);
    y += 16;
  }

  // Page 3 — validation
  doc.addPage();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.setTextColor(31, 39, 56);
  doc.text('Validation & gaps', 56, 64);
  doc.setDrawColor(82, 146, 220); doc.line(56, 72, 556, 72);
  y = 96;
  if (validation.length === 0) {
    doc.setFontSize(11); doc.setTextColor(46, 166, 107);
    doc.text('No unresolved validation issues.', 56, y);
  } else {
    for (const v of validation) {
      if (y > 720) { doc.addPage(); y = 64; }
      const sevColor: [number, number, number] = v.severity === 'high' ? [229, 72, 77] : v.severity === 'med' ? [229, 162, 58] : [125, 134, 153];
      doc.setFillColor(...sevColor); doc.rect(56, y - 8, 4, 4, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(31, 39, 56);
      doc.text(v.label, 66, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(80, 90, 110);
      const lines = doc.splitTextToSize(v.detail, 480);
      doc.text(lines, 66, y + 14);
      y += 14 + lines.length * 11 + 10;
    }
  }

  // Page 4 — commissioning
  doc.addPage();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.setTextColor(31, 39, 56);
  doc.text('Commissioning checklist', 56, 64);
  doc.setDrawColor(82, 146, 220); doc.line(56, 72, 556, 72);
  y = 96;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  for (const c of checks) {
    if (y > 720) { doc.addPage(); y = 64; }
    const stateColor: [number, number, number] = c.status === 'pass' ? [46, 166, 107] : c.status === 'fail' ? [229, 72, 77] : [200, 200, 200];
    doc.setFillColor(...stateColor); doc.circle(58, y - 3, 3, 'F');
    doc.setTextColor(31, 39, 56);
    doc.text(c.step, 70, y);
    doc.setTextColor(120, 134, 162);
    doc.text(c.status, 540, y, { align: 'right' });
    y += 15;
  }
}
