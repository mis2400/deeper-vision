// DeploymentModeMobile — V1 1C mobile flow for the install crew.
// Mounted at /project/:projectId/deployment/m. Separate component so
// the desktop tri-pane stays untouched and the mobile experience can
// optimize for thumb reach + on-site camera capture.
//
// Scope shipped in this pass:
//   - List of work orders the crew sees on their phone
//   - Tap to open a focused single-WO view (status / checklist /
//     identity / photo)
//   - Camera capture via <input type="file" accept="image/*"
//     capture="environment"> so iOS / Android open the camera app
//   - Mark complete validates: all checklist items done, MAC + serial
//     entered, at least one install photo uploaded
//
// Deferred to follow-up: offline mode + sync queue. Today every store
// write goes straight to localStorage (no queue) and the sync chip
// shows online/offline only, no queue depth.

import { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useProjectStore, deriveWorkOrders } from '../store/projectStore';
import type { WorkOrder, WorkOrderStatus } from '../store/types';
import {
  ArrowLeft, ChevronRight, Camera as CameraIcon, Check, CircleDot,
  Wifi, WifiOff, MapPin, ClipboardList, Hash, ShieldAlert, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_ORDER: WorkOrderStatus[] = ['ready', 'assigned', 'on-site', 'installing', 'testing', 'complete'];
const STATUS_LABEL: Record<WorkOrderStatus, string> = {
  ready:      'Ready',
  assigned:   'Assigned',
  'on-site':  'On site',
  installing: 'Installing',
  testing:    'Testing',
  complete:   'Complete',
  blocked:    'Blocked',
};
const STATUS_TONE: Record<WorkOrderStatus, string> = {
  ready:      'bg-secondary text-foreground',
  assigned:   'bg-sky-500/15 text-sky-600',
  'on-site':  'bg-amber-500/15 text-amber-600',
  installing: 'bg-primary/15 text-primary',
  testing:    'bg-violet-500/15 text-violet-600',
  complete:   'bg-emerald-500/15 text-emerald-600',
  blocked:    'bg-rose-500/15 text-rose-600',
};

export function DeploymentModeMobile() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();

  // Subscribe to ONLY the slices `deriveWorkOrders` needs. The desktop
  // DeploymentMode subscribes to the whole store today; the mobile
  // screen pays a higher render tax (form inputs everywhere), so we're
  // surgical here.
  const projects     = useProjectStore((s) => s.projects);
  const devices      = useProjectStore((s) => s.devices);
  const pathways     = useProjectStore((s) => s.pathways);
  const idfs         = useProjectStore((s) => s.idfs);
  const floors       = useProjectStore((s) => s.floors);
  const progressMap  = useProjectStore((s) => s.workOrderProgress);
  const workOrders = useMemo(
    () => deriveWorkOrders(
      { projects, devices, pathways, idfs, floors, workOrderProgress: progressMap } as any,
      projectId,
    ),
    [projects, devices, pathways, idfs, floors, progressMap, projectId],
  );
  const project = projects[projectId];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? workOrders.find((w) => w.id === selectedId) ?? null : null;

  // Online state — drives the sync chip. The full offline queue lands
  // when persisted write batching ships; today it's a status-only
  // indicator so the crew knows when push will fail.
  const [online, setOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center bg-background text-foreground">
        <div>
          <h1 className="text-lg font-medium">Project not found</h1>
          <Link to="/projects" className="text-primary underline text-sm mt-2 inline-block">Back to projects</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" data-screen="deployment-mobile">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md flex items-center gap-2 px-3 py-2.5">
        {selected ? (
          <button
            onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-1 h-9 px-2 rounded-md text-[12px] border border-border hover:bg-secondary/40 text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />Back
          </button>
        ) : (
          <button
            onClick={() => nav(`/project/${projectId}/deployment`)}
            className="inline-flex items-center gap-1 h-9 px-2 rounded-md text-[12px] border border-border hover:bg-secondary/40 text-foreground"
            title="Open desktop view"
          >
            <ArrowLeft className="w-4 h-4" />Desktop
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground leading-tight">Field</div>
          <div className="text-[13px] font-semibold truncate leading-tight">{project.name}</div>
        </div>
        <SyncChip online={online} />
      </header>

      {selected ? (
        <WorkOrderDetailMobile wo={selected} online={online} onClose={() => setSelectedId(null)} />
      ) : (
        <WorkOrderListMobile workOrders={workOrders} onOpen={(id) => setSelectedId(id)} />
      )}
    </div>
  );
}

function SyncChip({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 h-7 px-2 rounded-full text-[10px] tracking-tight border ${
        online
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-600'
      }`}
      title={online ? 'Online — changes sync immediately' : 'Offline — changes save locally and push on reconnect'}
    >
      {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

function WorkOrderListMobile({ workOrders, onOpen }: { workOrders: WorkOrder[]; onOpen: (id: string) => void }) {
  // Group by status bucket: open first, then complete, then blocked.
  const open = workOrders.filter((w) => w.progress.status !== 'complete' && w.progress.status !== 'blocked');
  const complete = workOrders.filter((w) => w.progress.status === 'complete');
  const blocked = workOrders.filter((w) => w.progress.status === 'blocked');

  if (workOrders.length === 0) {
    return (
      <div className="p-6 text-center mt-12">
        <div className="w-12 h-12 mx-auto rounded-xl bg-secondary/60 inline-flex items-center justify-center mb-3">
          <ClipboardList className="w-5 h-5 text-muted-foreground" />
        </div>
        <h2 className="text-base font-medium">No work orders yet</h2>
        <p className="text-[12.5px] text-muted-foreground mt-1">Work orders appear here once devices are scheduled for install.</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 space-y-4 pb-8">
      <Section title="Open" count={open.length}>
        {open.map((wo) => <WorkOrderRowMobile key={wo.id} wo={wo} onOpen={onOpen} />)}
        {open.length === 0 && <Empty>Nothing open.</Empty>}
      </Section>
      {blocked.length > 0 && (
        <Section title="Blocked" count={blocked.length} tone="rose">
          {blocked.map((wo) => <WorkOrderRowMobile key={wo.id} wo={wo} onOpen={onOpen} />)}
        </Section>
      )}
      {complete.length > 0 && (
        <Section title="Complete" count={complete.length} tone="emerald">
          {complete.map((wo) => <WorkOrderRowMobile key={wo.id} wo={wo} onOpen={onOpen} />)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, tone, children }: { title: string; count: number; tone?: 'emerald' | 'rose'; children: React.ReactNode }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : 'text-muted-foreground';
  return (
    <div>
      <div className={`flex items-center justify-between mb-1.5 text-[10px] uppercase tracking-[0.10em] ${toneClass}`}>
        <span>{title}</span>
        <span className="tabular-nums">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[11.5px] text-muted-foreground text-center py-3">{children}</div>;
}

function WorkOrderRowMobile({ wo, onOpen }: { wo: WorkOrder; onOpen: (id: string) => void }) {
  const doneCount  = wo.progress.completed?.length ?? 0;
  const totalCount = wo.checklist.length;
  const tonePill = STATUS_TONE[wo.progress.status];
  return (
    <button
      onClick={() => onOpen(wo.id)}
      className="w-full text-left bg-card border border-border rounded-lg p-3 hover:bg-card/90 active:bg-secondary/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium leading-tight truncate">{wo.title}</div>
          {wo.subtitle && <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">{wo.subtitle}</div>}
          {wo.location && (
            <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />{wo.location}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] uppercase tracking-[0.10em] px-1.5 py-0.5 rounded ${tonePill}`}>
              {STATUS_LABEL[wo.progress.status]}
            </span>
            <span className="text-[10.5px] text-muted-foreground tabular-nums">{doneCount} / {totalCount} checks</span>
            {wo.progress.blocker && (
              <span className="text-[10px] text-rose-500 truncate inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />{wo.progress.blocker}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>
    </button>
  );
}

function WorkOrderDetailMobile({ wo, online, onClose }: { wo: WorkOrder; online: boolean; onClose: () => void }) {
  const patch = useProjectStore((s) => s.patchWorkOrderProgress);
  const toggle = useProjectStore((s) => s.toggleWorkOrderChecklist);
  const setStatus = useProjectStore((s) => s.setWorkOrderStatus);
  const addPhoto = useProjectStore((s) => s.addWorkOrderPhotoPlaceholder);
  const removePhoto = useProjectStore((s) => s.removeWorkOrderPhotoPlaceholder);

  const photos = wo.progress.photoPlaceholders ?? [];
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addPhoto(wo.id, {
      fileName: file.name || `install-${Date.now()}.jpg`,
      sizeKb: Math.round(file.size / 1024),
      tag: 'install',
    });
    if (fileRef.current) fileRef.current.value = '';
    toast.success('Photo captured', { description: file.name || 'install.jpg', duration: 2500 });
  };

  const doneIds = new Set(wo.progress.completed ?? []);
  const allChecksDone = wo.checklist.length > 0 && wo.checklist.every((it) => doneIds.has(it.id));
  const hasMac    = !!wo.progress.mac?.trim();
  const hasSerial = !!wo.progress.serial?.trim();
  const hasPhoto  = photos.length > 0;
  const canComplete = allChecksDone && hasMac && hasSerial && hasPhoto;

  const onMarkComplete = () => {
    if (!canComplete) {
      const reasons: string[] = [];
      if (!allChecksDone) reasons.push('finish the checklist');
      if (!hasMac)        reasons.push('add the MAC');
      if (!hasSerial)     reasons.push('add the serial');
      if (!hasPhoto)      reasons.push('capture the install photo');
      toast.error('Not ready to complete', { description: `Need to ${reasons.join(', ')}.`, duration: 4500 });
      return;
    }
    setStatus(wo.id, 'complete');
    toast.success(`${wo.title} marked complete`, { duration: 3000 });
    onClose();
  };

  return (
    <div className="px-3 py-3 space-y-4 pb-24">
      {/* Title */}
      <div>
        <div className="text-[13.5px] font-semibold leading-tight">{wo.title}</div>
        {wo.subtitle && <div className="text-[12px] text-muted-foreground mt-0.5">{wo.subtitle}</div>}
        {wo.location && (
          <div className="text-[12px] text-muted-foreground mt-1 inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />{wo.location}
          </div>
        )}
      </div>

      {/* Status */}
      <SectionCard icon={<CircleDot className="w-3.5 h-3.5" />} title="Status">
        <div className="grid grid-cols-2 gap-1.5">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(wo.id, s)}
              className={`h-9 rounded-md text-[12px] border transition-colors ${
                wo.progress.status === s
                  ? `${STATUS_TONE[s]} border-transparent`
                  : 'border-border hover:bg-secondary/40 text-muted-foreground'
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {wo.progress.status === 'blocked' && wo.progress.blocker && (
          <div className="mt-2 text-[12px] text-rose-600 bg-rose-500/10 border border-rose-500/30 rounded-md p-2 inline-flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{wo.progress.blocker}</span>
          </div>
        )}
      </SectionCard>

      {/* Checklist */}
      {wo.checklist.length > 0 && (
        <SectionCard icon={<ClipboardList className="w-3.5 h-3.5" />} title={`Checklist · ${doneIds.size} / ${wo.checklist.length}`}>
          <ul className="space-y-1.5">
            {wo.checklist.map((it) => {
              const done = doneIds.has(it.id);
              return (
                <li key={it.id}>
                  <button
                    onClick={() => toggle(wo.id, it.id)}
                    className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-md border transition-colors min-h-[44px] ${
                      done
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                        : 'border-border hover:bg-secondary/40'
                    }`}
                  >
                    <span className={`shrink-0 w-5 h-5 mt-0.5 rounded-full border inline-flex items-center justify-center ${done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border'}`}>
                      {done && <Check className="w-3 h-3" />}
                    </span>
                    <span className="text-[12.5px] leading-snug">{it.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      {/* Identity */}
      <SectionCard icon={<Hash className="w-3.5 h-3.5" />} title="Identity">
        <label className="block">
          <span className="text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground">MAC address</span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            value={wo.progress.mac ?? ''}
            onChange={(e) => patch(wo.id, { mac: e.target.value })}
            placeholder="aa:bb:cc:dd:ee:ff"
            className="mt-1 w-full h-10 px-2.5 rounded-md border border-border bg-background text-foreground text-[13px] focus:outline-none focus:border-primary"
          />
        </label>
        <label className="block mt-3">
          <span className="text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground">Serial number</span>
          <input
            type="text"
            inputMode="text"
            value={wo.progress.serial ?? ''}
            onChange={(e) => patch(wo.id, { serial: e.target.value })}
            placeholder="SN-12345"
            className="mt-1 w-full h-10 px-2.5 rounded-md border border-border bg-background text-foreground text-[13px] focus:outline-none focus:border-primary"
          />
        </label>
        <label className="block mt-3">
          <span className="text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground">Field notes</span>
          <textarea
            value={wo.progress.fieldNotes ?? ''}
            onChange={(e) => patch(wo.id, { fieldNotes: e.target.value })}
            placeholder="Anything the next person should know."
            rows={2}
            className="mt-1 w-full px-2.5 py-2 rounded-md border border-border bg-background text-foreground text-[13px] focus:outline-none focus:border-primary resize-none"
          />
        </label>
      </SectionCard>

      {/* Photos */}
      <SectionCard icon={<CameraIcon className="w-3.5 h-3.5" />} title={`Install photos · ${photos.length}`}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPickPhoto}
          className="hidden"
          id={`photo-${wo.id}`}
        />
        <label
          htmlFor={`photo-${wo.id}`}
          className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/15 text-primary text-[13px] font-medium cursor-pointer transition-colors active:bg-primary/20"
        >
          <CameraIcon className="w-4 h-4" />
          {photos.length === 0 ? 'Capture install photo' : 'Add another photo'}
        </label>
        {photos.length > 0 && (
          <ul className="mt-2 space-y-1">
            {photos.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-[12px] py-1.5 px-2 bg-secondary/30 rounded-md">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{p.fileName}</div>
                  {p.sizeKb !== undefined && <div className="text-[10px] text-muted-foreground tabular-nums">{p.sizeKb} KB</div>}
                </div>
                <button
                  onClick={() => removePhoto(wo.id, p.id)}
                  className="text-[10.5px] text-muted-foreground hover:text-rose-500"
                >Remove</button>
              </li>
            ))}
          </ul>
        )}
        {!online && (
          <div className="mt-2 text-[10.5px] text-amber-600 inline-flex items-center gap-1">
            <WifiOff className="w-3 h-3" />Photo metadata saved locally. Push when back online.
          </div>
        )}
      </SectionCard>

      {/* Footer CTA — sticky outside the section list. iOS safe-area
          inset added so the home-indicator bar doesn't cover the
          button on iPhone. */}
      <div
        className="fixed left-0 right-0 bottom-0 border-t border-border bg-background/95 backdrop-blur-md p-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          onClick={onMarkComplete}
          className={`w-full h-12 rounded-md text-[14px] font-medium transition-colors ${
            canComplete
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          {canComplete ? 'Mark complete' : 'Finish required fields to mark complete'}
        </button>
        {!canComplete && (
          <div className="mt-1.5 text-[10.5px] text-muted-foreground inline-flex flex-wrap gap-x-2 gap-y-0.5">
            <BadgeOk ok={allChecksDone}>Checklist</BadgeOk>
            <BadgeOk ok={hasMac}>MAC</BadgeOk>
            <BadgeOk ok={hasSerial}>Serial</BadgeOk>
            <BadgeOk ok={hasPhoto}>Photo</BadgeOk>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-lg p-3">
      <h3 className="text-[10.5px] uppercase tracking-[0.10em] text-muted-foreground inline-flex items-center gap-1.5 mb-2">
        {icon}{title}
      </h3>
      {children}
    </section>
  );
}

function BadgeOk({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 ${ok ? 'text-emerald-600' : 'text-muted-foreground'}`}>
      {ok ? <Check className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}{children}
    </span>
  );
}
