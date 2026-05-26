// PathwayDrawer — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. Right-side drawer that
// surfaces every detail about the selected cable or conduit
// pathway: 9-way sub-tab nav (General / Route / Conduit /
// Terminations or Cables / Accessories / Suggestions / BOM /
// Notes / Files), live conduit-fill calc, port assignments,
// over-distance findings, attachments. Reads + writes via
// useProjectStore. SurveyPanel and AttachmentPanel are reused
// from their shared homes; drawer primitives (Row /
// DrawerSection / FindingRow) and the conduit-fill math
// (EMT_SIZES / computeBundleFill) ride on real imports too.

import { Cable, DollarSign, FileText, ListChecks, Network as NetworkIcon, Paperclip, PencilLine, PencilRuler, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AttachmentPanel } from '../../components/canvas/AttachmentPanel';
import { pathwayLengthFt } from '../../lib/engineering';
import { useProjectStore } from '../../store/projectStore';
import { computeBundleFill, EMT_SIZES } from '../cabling';
import { DrawerSection, FindingRow, Row } from '../components/DrawerPrimitives';
import { SurveyPanel } from '../components/SurveyPanel';

export function PathwayDrawer({ pathwayId, onClose, onOpenBundle }: {
  pathwayId: string;
  onClose: () => void;
  onOpenBundle: (bundleId: string) => void;
}) {
  const pathways = useProjectStore((s) => s.pathways);
  const devices  = useProjectStore((s) => s.devices);
  const floors   = useProjectStore((s) => s.floors);
  const updatePathway = useProjectStore((s) => s.updatePathway);
  const removePathway = useProjectStore((s) => s.removePathway);
  const p = (pathways as any)[pathwayId];
  // Sub-tab state: General / Route / Conduit / Terminations / Accessories / Suggestions / BOM / Notes
  type Sub = 'general' | 'route' | 'conduit' | 'terms' | 'acc' | 'sugg' | 'bom' | 'notes' | 'files';
  const [sub, setSub] = useState<Sub>('general');
  // useMemo hooks below must run before the early return so the order
  // of hook calls stays stable across render passes.
  const attached = useMemo(() =>
    p ? Object.values(devices as any).filter((d: any) => d?.attachedPathwayId === pathwayId) : [],
  [devices, pathwayId, p]);
  const cablesInside = useMemo(() => {
    if (!p) return [] as any[];
    const isConduitPath = p.pathwayKind === 'conduit' || p.pathwayKind === 'tray' || p.pathwayKind === 'jhook' || p.pathwayKind === 'sleeve' || p.pathwayKind === 'raceway' || p.pathwayKind === 'duct';
    if (!isConduitPath) return [] as any[];
    return Object.values(pathways as any).filter((x: any) => x.id !== pathwayId && x.attachedPathwayId === pathwayId);
  }, [pathways, pathwayId, p]);
  if (!p) {
    return (
      <div className="shrink-0 w-[420px] h-full bg-card border-l border-border p-4">
        <div className="text-[12px] text-muted-foreground">Pathway not found.</div>
        <button onClick={onClose} className="mt-3 text-[11px] px-3 h-7 rounded-md border border-border">Close</button>
      </div>
    );
  }
  const isCable = !p.pathwayKind || p.pathwayKind === 'cable';
  const isConduit = p.pathwayKind === 'conduit' || p.pathwayKind === 'tray' || p.pathwayKind === 'jhook' || p.pathwayKind === 'sleeve' || p.pathwayKind === 'raceway' || p.pathwayKind === 'duct';
  const cableType = String(p.cableType ?? 'cat6a');
  const src = p.sourceId ? (devices as any)[p.sourceId] : undefined;
  const tgt = p.targetId ? (devices as any)[p.targetId] : (p.destinationId ? (devices as any)[p.destinationId] : undefined);
  const fill = isConduit ? computeBundleFill(cablesInside.length || 0, String(cablesInside[0]?.cableType ?? 'cat6a'), p.conduitSize) : null;
  // Cable distance assist: > 295 ft on copper Ethernet is over spec
  const lenFt = pathwayLengthFt(p, floors[p.floorId ?? '']);
  const overDistance = isCable && !cableType.includes('fiber') && lenFt > 295;

  const SUB_TABS: { id: Sub; label: string; icon: any }[] = isCable
    ? [
        { id: 'general',   label: 'General',      icon: ListChecks },
        { id: 'route',     label: 'Route',        icon: PencilLine },
        { id: 'conduit',   label: 'Conduit',      icon: PencilRuler },
        { id: 'terms',     label: 'Ports',        icon: NetworkIcon },
        { id: 'acc',       label: 'Accessories',  icon: PencilRuler },
        { id: 'sugg',      label: 'Suggestions',  icon: Sparkles },
        { id: 'bom',       label: 'BOM',          icon: DollarSign },
        { id: 'notes',     label: 'Notes',        icon: FileText },
        { id: 'files',     label: 'Files',        icon: Paperclip },
      ]
    : [
        { id: 'general',   label: 'General',      icon: ListChecks },
        { id: 'conduit',   label: 'Type / Size',  icon: PencilRuler },
        { id: 'terms',     label: 'Cables',       icon: Cable },
        { id: 'route',     label: 'Pull boxes',   icon: PencilLine },
        { id: 'sugg',      label: 'Suggestions',  icon: Sparkles },
        { id: 'bom',       label: 'BOM',          icon: DollarSign },
        { id: 'notes',     label: 'Notes',        icon: FileText },
        { id: 'files',     label: 'Files',        icon: Paperclip },
      ];

  return (
    <div
      className="shrink-0 h-full flex flex-col"
      style={{
        width: 420,
        background: 'var(--drawer-background)',
        color: 'var(--drawer-foreground)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      <div className="px-5 pt-5 pb-3 border-b border-white/[0.05] flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: isConduit ? '#A371F71F' : '#22D3EE1F', color: isConduit ? '#A371F7' : '#22D3EE', boxShadow: 'inset 0 0 0 1px ' + (isConduit ? '#A371F755' : '#22D3EE55') }}>
          {isConduit ? <PencilRuler className="w-5 h-5" /> : <Cable className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold tracking-tight">{p.id}</div>
          <div className="text-[11px] text-muted-foreground">
            {isConduit
              ? `${p.conduitType ?? p.pathwayKind?.toUpperCase()}${p.conduitSize ? ' ' + p.conduitSize : ''} · ${lenFt} ft`
              : `${cableType.toUpperCase()} · ${lenFt} ft${src ? ` · ${src.id ?? p.sourceId} →` : ''} ${tgt?.id ?? p.targetId ?? p.destinationId ?? '—'}`}
          </div>
          {p.bundleId && (
            <button onClick={() => onOpenBundle(p.bundleId)} data-track="pathway-open-bundle" className="mt-1 text-[10px] text-primary hover:underline">
              In bundle {p.bundleId} → open bundle inspector
            </button>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
      </div>

      <div className="px-3 py-2 border-b border-white/[0.05] grid grid-cols-4 gap-1">
        {SUB_TABS.map((t) => {
          const active = sub === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              data-track={`pathway-tab-${t.id}`}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-md text-[10px] tracking-tight transition-colors ${active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
            >
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-auto p-3 space-y-3" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {sub === 'general' && (
          <DrawerSection title={isConduit ? 'Conduit summary' : 'Cable summary'}>
            <Row label="ID"           value={p.id} />
            <Row label={isConduit ? 'Type' : 'Cable type'} value={isConduit ? (p.conduitType ?? p.pathwayKind?.toUpperCase() ?? 'EMT') : cableType.toUpperCase()} />
            {isConduit && p.conduitSize && <Row label="Trade size" value={p.conduitSize} />}
            <Row label="Length"       value={`${lenFt} ft`} />
            {src && <Row label="Source"      value={src.id ?? p.sourceId} />}
            {(tgt || p.targetId) && <Row label="Destination" value={tgt?.id ?? p.targetId} />}
            {p.bundleId && <Row label="Bundle"      value={p.bundleId} />}
            {p.patchPort && <Row label="Patch port"  value={`PP-01 · ${String(p.patchPort).padStart(2, '0')}`} />}
            {p.switchPort && <Row label="Switch port" value={`SW-01 · ${String(p.switchPort).padStart(2, '0')}`} />}
          </DrawerSection>
        )}

        {isCable && sub === 'route' && (
          <DrawerSection title="Route">
            <Row label="Vertices" value={String((p.points ?? []).length)} />
            <Row label="Route length" value={`${lenFt} ft (incl. 10% slack + service loop)`} />
            <Row label="Source"     value={src?.id ?? p.sourceId ?? '—'} />
            <Row label="Destination" value={tgt?.id ?? p.targetId ?? '—'} />
            {overDistance && <FindingRow severity="warn" text={`Run is ${lenFt} ft — exceeds 295 ft copper Ethernet limit. Switch to fiber or add an intermediate switch.`} />}
          </DrawerSection>
        )}

        {sub === 'conduit' && (
          isCable ? (
            <DrawerSection title="Conduit assignment">
              <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1.5">Conduit type</div>
              <div className="flex flex-wrap gap-1 mb-3">
                {(['none','EMT','PVC','FMC','LFMC','tray'] as const).map((t) => {
                  const active = (p.conduitType ?? 'none') === t;
                  return (
                    <button
                      key={t}
                      onClick={() => updatePathway(pathwayId, { conduitType: t === 'none' ? undefined : t, conduitSize: t === 'none' ? undefined : p.conduitSize } as any)}
                      data-track={`pathwaydrawer-conduit-${t}`}
                      className={`text-[11px] px-2 py-1 rounded border transition-colors ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                    >{t === 'none' ? 'None' : t}</button>
                  );
                })}
              </div>
              {p.conduitType && (
                <>
                  <div className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground mb-1.5">Trade size</div>
                  <div className="grid grid-cols-3 gap-1">
                    {EMT_SIZES.map((e) => {
                      const active = p.conduitSize === e.size;
                      return (
                        <button
                          key={e.size}
                          onClick={() => updatePathway(pathwayId, { conduitSize: e.size } as any)}
                          data-track={`pathwaydrawer-size-${e.size.replace(/\W/g,'')}`}
                          className={`text-[11px] py-1 rounded border transition-colors ${active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:border-border-strong hover:bg-secondary/30 text-foreground'}`}
                        >{e.size}</button>
                      );
                    })}
                  </div>
                </>
              )}
            </DrawerSection>
          ) : (
            <DrawerSection title="Conduit type & size">
              <Row label="Type" value={p.conduitType ?? p.pathwayKind?.toUpperCase() ?? '—'} />
              <Row label="Trade size" value={p.conduitSize ?? '—'} />
              <Row label="Internal area" value={p.conduitSize ? `${EMT_SIZES.find((e) => e.size === p.conduitSize)?.areaIn2.toFixed(3) ?? '—'} in²` : '—'} />
              <Row label="Length" value={`${lenFt} ft`} />
            </DrawerSection>
          )
        )}

        {sub === 'terms' && (
          isCable ? (
            <>
              <DrawerSection title="Terminations">
                {attached.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground italic">No terminations placed. Drop a jack, coupler, or patch panel from the bottom Cabling tray near this run to attach it.</div>
                ) : (
                  <div className="space-y-1">
                    {attached.map((a: any) => (
                      <Row key={a.id} label={`${a.accessoryKind ?? 'Accessory'} · ${a.id}`} value="attached" tone="#4FB87E" />
                    ))}
                  </div>
                )}
              </DrawerSection>
              <DrawerSection title="Ports">
                <Row label="Patch panel port" value={p.patchPort ? `PP-01 · ${String(p.patchPort).padStart(2, '0')}` : '—'} />
                <Row label="Switch port"      value={p.switchPort ? `SW-01 · ${String(p.switchPort).padStart(2, '0')}` : '—'} />
              </DrawerSection>
            </>
          ) : (
            <DrawerSection title={`Cables inside · ${cablesInside.length}`}>
              {cablesInside.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic">No cables routed through this conduit yet. Drop a cable run near it or use Run-to-IDF with "Existing conduit".</div>
              ) : (
                <div className="space-y-1">
                  {cablesInside.map((c: any) => (
                    <Row key={c.id} label={c.id} value={String(c.cableType ?? 'cat6').toUpperCase()} />
                  ))}
                </div>
              )}
              {fill && p.conduitSize && (
                <div className="mt-2">
                  <Row label="Fill" value={`${fill.fillPct.toFixed(1)}% (${(fill.rule * 100).toFixed(0)}% rule)`} tone={fill.passes ? '#4FB87E' : '#E5A23A'} />
                  {fill.recommended && !fill.passes && (
                    <button
                      onClick={() => updatePathway(pathwayId, { conduitSize: fill.recommended } as any)}
                      data-track="pathwaydrawer-apply-recommendation"
                      className="mt-2 text-[11px] font-medium px-3 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    >
                      Apply recommended {fill.recommended}
                    </button>
                  )}
                </div>
              )}
            </DrawerSection>
          )
        )}

        {sub === 'acc' && (
          <DrawerSection title="Accessories">
            <div className="text-[11px] text-muted-foreground italic mb-2">
              {isCable ? 'Cable accessories for this run. Tally rolls up into BOM.' : 'Conduit accessories for this run.'}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(isCable
                ? ['jack','coupler','patchcord','label','firestop','sleeve','pullbox'] as const
                : ['pullbox','jbox','coupler','firestop','sleeve','tray'] as const
              ).map((kind) => {
                const count = (p.accessories?.[kind as any] ?? 0);
                return (
                  <div key={kind} className="rounded-md border border-border bg-background px-2.5 py-2 flex items-center justify-between text-[11px]">
                    <span className="font-medium tracking-tight capitalize">{kind}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updatePathway(pathwayId, { accessories: { ...(p.accessories ?? {}), [kind]: Math.max(0, count - 1) } } as any)}
                        className="w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        data-track={`pathwaydrawer-acc-dec-${kind}`}
                      >−</button>
                      <span className="tabular-nums w-5 text-center">{count}</span>
                      <button
                        onClick={() => updatePathway(pathwayId, { accessories: { ...(p.accessories ?? {}), [kind]: count + 1 } } as any)}
                        className="w-5 h-5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        data-track={`pathwaydrawer-acc-inc-${kind}`}
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </DrawerSection>
        )}

        {sub === 'sugg' && (
          <DrawerSection title="Suggestions">
            {(() => {
              const findings: { sev: 'high' | 'warn' | 'ok'; text: string }[] = [];
              if (isCable) {
                if (overDistance) findings.push({ sev: 'warn', text: `Run is ${lenFt} ft — exceeds 295 ft copper Ethernet limit. Switch to fiber or add an intermediate switch closer to the source.` });
                if (cableType === 'cat6' && p.notes?.toLowerCase().includes('outdoor')) findings.push({ sev: 'warn', text: 'Indoor Cat6 routed outdoors. Use outdoor or direct-burial cable.' });
                if (!p.patchPort)  findings.push({ sev: 'warn', text: 'No patch panel port assigned. Use IDF drawer or BundleInspector "Assign ports sequentially".' });
                if (!p.switchPort) findings.push({ sev: 'warn', text: 'No switch port assigned. Same path.' });
                if ((p.accessories?.firestop ?? 0) === 0 && (p.notes?.toLowerCase().includes('wall') || p.notes?.toLowerCase().includes('plenum'))) findings.push({ sev: 'warn', text: 'Wall/plenum penetration noted — add firestop sleeve + sealant.' });
                if (findings.length === 0) findings.push({ sev: 'ok', text: 'Run looks healthy. Distance, terminations, and rating all within spec.' });
              } else {
                if (cablesInside.length === 0) findings.push({ sev: 'warn', text: 'No cables assigned. Drop cable runs onto this pathway or use Run-to-IDF with "Existing conduit".' });
                if (fill && !fill.passes) findings.push({ sev: 'warn', text: `Conduit overfilled (${fill.fillPct.toFixed(0)}%). ${fill.recommended ? `Recommend ${fill.recommended} or split.` : 'Split conduit — no standard size satisfies the rule.'}` });
                if ((p.accessories?.pullbox ?? 0) === 0 && (p.points ?? []).length > 3) findings.push({ sev: 'warn', text: 'Long route with multiple bends — add at least one pull box to reduce pulling tension.' });
                if (findings.length === 0) findings.push({ sev: 'ok', text: 'Conduit looks healthy. Fill, capacity, and bends all within spec.' });
              }
              return (
                <div className="space-y-1.5">
                  {findings.map((f, i) => <FindingRow key={i} severity={f.sev} text={f.text} />)}
                </div>
              );
            })()}
          </DrawerSection>
        )}

        {sub === 'bom' && (
          <DrawerSection title="BOM impact">
            <Row label={isConduit ? 'Conduit footage' : 'Cable footage'} value={`${lenFt} ft`} />
            {isCable && cableType && <Row label="Cable type" value={cableType.toUpperCase()} />}
            {p.accessories && Object.entries(p.accessories).map(([k, v]: any) => (
              v ? <Row key={k} label={k} value={String(v)} /> : null
            ))}
            {p.conduitType && p.conduitSize && <Row label="Conduit" value={`${p.conduitType} ${p.conduitSize}`} />}
            <div className="mt-2 text-[10px] text-muted-foreground italic">Counts flow into project BOM via the Pathways selector.</div>
          </DrawerSection>
        )}

        {sub === 'notes' && (
          <>
            <DrawerSection title="Notes">
              <textarea
                key={pathwayId}
                value={p.notes ?? ''}
                onChange={(e) => updatePathway(pathwayId, { notes: e.target.value } as any)}
                placeholder="Pathway notes — pulling strategy, firestop ratings, route deviations, etc."
                className="dv-input text-[12px] resize-none min-h-[120px]"
              />
              <button
                onClick={() => { removePathway(pathwayId); onClose(); toast.message('Pathway removed', { duration: 2500 }); }}
                data-track="pathwaydrawer-remove"
                className="mt-3 text-[11px] px-3 h-8 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                Delete pathway
              </button>
            </DrawerSection>
            <SurveyPanel
              projectId={p.projectId}
              floorId={p.floorId}
              objectType="pathway"
              objectId={pathwayId}
            />
          </>
        )}

        {sub === 'files' && (
          <DrawerSection title="Files & attachments">
            <AttachmentPanel
              projectId={p.projectId}
              linkedObjectType="pathway"
              linkedObjectId={pathwayId}
              defaultCategory="photo"
              title="Pathway files"
              compact
            />
          </DrawerSection>
        )}
      </div>
    </div>
  );
}
