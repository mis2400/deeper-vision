// DoorAssemblySection — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Checklist editor for the door hardware "assembly"
// persisted on the Device record itself (one model, not a stack
// of ghost accessory devices). Renders only for opening-type
// devices; otherwise emits nothing so the Stack tile retains
// its own StackSectionForHost body for non-doors.
//
// Persists doorAssembly, doorElectrification,
// doorReaderLocation, and per-hardware Proposed / Existing
// state directly on the Device via onUpdate. Surfaces a
// heuristic rule check pass with severity-coloured warnings
// (high / med / info) — labelled as "not certified code
// compliance" to honour the honesty rule.

import { Check } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import type { DoorHardware } from '../../store/types';
import { DrawerSection } from '../components/DrawerPrimitives';
import type { Device } from '../types';

export function DoorAssemblySection({
  d, onUpdate,
}: { d: Device; onUpdate: (p: Partial<Device>) => void }) {
  const isDoorish =
    (d.type as string).startsWith('inf.door')
    || (d.type as string).startsWith('inf.gate')
    || (d.type as string).startsWith('inf.storefront')
    || (d.type as string).startsWith('inf.doubledoor');
  if (!isDoorish) return null;
  const assembly: DoorHardware[] = d.doorAssembly ?? [];
  const stateMap = ((d as any).doorAssemblyState ?? {}) as Partial<Record<DoorHardware, 'proposed' | 'existing'>>;
  const electrification = d.doorElectrification;
  const readerLocation = d.doorReaderLocation;
  // Flip a single hardware row between Proposed and Existing without
  // removing it from the assembly. Used by the segmented pill on each
  // active tile.
  const setHwState = (h: DoorHardware, state: 'proposed' | 'existing') => {
    const dev = useProjectStore.getState().devices[d.id];
    const cur = ((dev as any)?.doorAssemblyState ?? {}) as Partial<Record<DoorHardware, 'proposed' | 'existing'>>;
    onUpdate({ doorAssemblyState: { ...cur, [h]: state } } as any);
  };
  // Door-type prettifier for the Opening summary card.
  const openingType = (() => {
    const t = d.type as string;
    if (t.includes('door-double'))       return 'Double door';
    if (t.includes('door-storefront'))   return 'Storefront opening';
    if (t.includes('door-sliding'))      return 'Sliding door';
    if (t.includes('gate-swing'))        return 'Swing gate';
    if (t.includes('gate-slide'))        return 'Slide gate';
    if (t.includes('elevator'))          return 'Elevator';
    return 'Single door';
  })();
  // Engineering rule checks — labelled as heuristics, NOT code
  // certification. Same honesty contract as Compatibility tab.
  const has = (h: DoorHardware) => assembly.includes(h);
  type RuleWarning = { id: string; severity: 'high' | 'med' | 'info'; title: string; detail: string };
  const warnings: RuleWarning[] = [];
  if (has('maglock') && !has('rex')) {
    warnings.push({ id: 'mag-no-rex', severity: 'high', title: 'Maglock without REX', detail: 'Maglocks require a REX (request-to-exit) or panic device for code-compliant egress.' });
  }
  if (has('maglock') && !has('panic')) {
    warnings.push({ id: 'mag-no-fire', severity: 'med', title: 'Maglock fire release', detail: 'Add a fire-alarm release wiring note in the Notes tab — maglocks must drop on fire signal in most jurisdictions.' });
  }
  if (has('strike') && !has('psu')) {
    warnings.push({ id: 'strike-no-psu', severity: 'high', title: 'Strike without power supply', detail: 'Electric strike needs a 12 / 24 VDC PSU. Drop a PSU onto the door or note one nearby.' });
  }
  if (has('reader') && !has('controller')) {
    warnings.push({ id: 'reader-no-ctrl', severity: 'high', title: 'Reader without controller', detail: 'A reader needs a controller (Mercury / Verkada / S2 / similar) to make access decisions.' });
  }
  if ((has('dps') || has('contact')) && !has('controller')) {
    warnings.push({ id: 'monitor-no-ctrl', severity: 'med', title: 'Door monitor without controller', detail: 'DPS / door contact reports to a controller input — add one or wire to an existing panel.' });
  }
  if ((has('strike') || has('maglock')) && !has('controller')) {
    warnings.push({ id: 'lock-no-ctrl', severity: 'med', title: 'Electrified lock without controller', detail: 'Strikes and maglocks energize from a controller relay. Add a controller or note an existing panel.' });
  }
  if (has('intercom') && has('reader')) {
    warnings.push({ id: 'intercom-plus-reader', severity: 'info', title: 'Intercom + separate reader', detail: 'Many video-intercom stations include a card reader. Confirm you actually need both — otherwise drop one to save labor + BOM.' });
  }
  const ITEMS: { id: DoorHardware; label: string; hint: string }[] = [
    { id: 'reader',     label: 'Reader',       hint: 'Card / mobile credential.' },
    { id: 'strike',     label: 'Electric strike', hint: 'Fail-secure release at the latch.' },
    { id: 'maglock',    label: 'Maglock',      hint: 'Magnetic hold. Requires REX + fire release.' },
    { id: 'rex',        label: 'REX',          hint: 'Request-to-exit motion / button.' },
    { id: 'dps',        label: 'DPS',          hint: 'Door position switch (contact).' },
    { id: 'contact',    label: 'Door contact', hint: 'Monitors open / closed state.' },
    { id: 'intercom',   label: 'Intercom',     hint: 'Audio / video call station.' },
    { id: 'panic',      label: 'Panic bar',    hint: 'Crash bar / panic device.' },
    { id: 'autoop',     label: 'Auto-operator',hint: 'ADA push-plate / automatic open.' },
    { id: 'controller', label: 'Controller',   hint: 'Access-control panel input.' },
    { id: 'psu',        label: 'Power supply', hint: '12 / 24 VDC PSU + transformer.' },
  ];
  // Read the freshest assembly from the store each tick so rapid clicks /
  // automated toggles compose instead of clobbering one another. The
  // closure's `assembly` variable is from the last render and lags behind.
  const toggle = (h: DoorHardware) => {
    const dev = useProjectStore.getState().devices[d.id];
    const current = dev?.doorAssembly ?? [];
    const set = new Set<DoorHardware>(current);
    const stateMap = { ...((dev as any)?.doorAssemblyState ?? {}) } as Partial<Record<DoorHardware, 'proposed' | 'existing'>>;
    if (set.has(h)) {
      set.delete(h);
      delete stateMap[h];
    } else {
      set.add(h);
      // Inspector toggles default to 'proposed' too — same contract as
      // the drag-attach flow so the BOM is consistent regardless of how
      // the hardware got onto the opening.
      stateMap[h] = 'proposed';
    }
    onUpdate({ doorAssembly: Array.from(set), doorAssemblyState: stateMap } as any);
  };
  const _hasMag = assembly.includes('maglock');
  const _hasRex = assembly.includes('rex');
  void _hasMag; void _hasRex;
  return (
    <>
      {/* Opening summary — compact one-line read of the opening's type +
          electrification + reader location + total hardware count. Lets
          the surveyor confirm at a glance "what is this opening?" before
          digging into the assembly checklist. */}
      <DrawerSection title="Opening summary">
        <div className="rounded-md border border-border bg-secondary/15 p-2.5 text-[11px] space-y-1" data-testid="opening-summary">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Type</span>
            <span className="text-foreground">{openingType}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Hardware</span>
            <span className="text-foreground tabular-nums">{assembly.length} / {ITEMS.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Electrification</span>
            <span className="text-foreground">{electrification === 'fail-safe' ? 'Fail-safe' : electrification === 'fail-secure' ? 'Fail-secure' : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Reader location</span>
            <span className="text-foreground">{readerLocation === 'mullion' ? 'Mullion' : readerLocation === 'wall' ? 'Wall' : '—'}</span>
          </div>
        </div>
      </DrawerSection>

      <DrawerSection title={`Hardware assembly · ${assembly.length}/${ITEMS.length}`}>
        <div className="text-[11px] text-muted-foreground/85 mb-2">
          One persisted schedule per opening. Each item carries a Proposed
          / Existing flag so the BOM can split "to install" from
          "already there".
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {ITEMS.map((it) => {
            const on = assembly.includes(it.id);
            const state = stateMap[it.id] ?? 'proposed';
            return (
              <div
                key={it.id}
                title={it.hint}
                data-testid={`door-assembly-${it.id}`}
                data-track={`door-assembly-${it.id}`}
                className={`rounded-md border text-[11px] transition-colors ${
                  on
                    ? 'border-primary/60 bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground'
                }`}
              >
                <button
                  onClick={() => toggle(it.id)}
                  className="w-full text-left px-2.5 py-2"
                  data-testid={`door-assembly-${it.id}-toggle`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${on ? 'border-primary bg-primary/30' : 'border-border'}`}>
                      {on && <Check className="w-2.5 h-2.5" />}
                    </span>
                    {it.label}
                  </div>
                </button>
                {on && (
                  <div className="px-2 pb-2 -mt-1 flex items-center gap-1 text-[9.5px] uppercase tracking-[0.10em]" data-testid={`door-assembly-${it.id}-state`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setHwState(it.id, 'proposed'); }}
                      className={`flex-1 py-0.5 rounded border transition-colors ${
                        state === 'proposed'
                          ? 'border-emerald-400/40 bg-emerald-400/12 text-emerald-300'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                      data-testid={`door-assembly-${it.id}-proposed`}
                    >Proposed</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setHwState(it.id, 'existing'); }}
                      className={`flex-1 py-0.5 rounded border transition-colors ${
                        state === 'existing'
                          ? 'border-sky-400/40 bg-sky-400/12 text-sky-300'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                      data-testid={`door-assembly-${it.id}-existing`}
                    >Existing</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DrawerSection>

      {warnings.length > 0 && (
        <DrawerSection title={`Engineering rule check · ${warnings.length}`}>
          <div className="text-[10px] uppercase tracking-[0.10em] text-amber-300 mb-1">
            Heuristic rules · not certified code compliance
          </div>
          <div className="space-y-1.5" data-testid="door-warnings">
            {warnings.map((w) => {
              const tone =
                w.severity === 'high' ? '#F87171' :
                w.severity === 'med'  ? '#FACC15' :
                                        '#94A3B8';
              return (
                <div
                  key={w.id}
                  data-testid={`door-warning-${w.id}`}
                  className="rounded-md border p-2 text-[11px] leading-snug"
                  style={{
                    borderColor: `${tone}55`,
                    background: `${tone}10`,
                  }}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] uppercase tracking-[0.10em] tabular-nums" style={{ color: tone }}>{w.severity}</span>
                    <span className="font-medium text-foreground">{w.title}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">{w.detail}</div>
                </div>
              );
            })}
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Electrification & reader location">
        <div className="grid grid-cols-2 gap-1.5">
          {(['fail-safe', 'fail-secure'] as const).map((opt) => {
            const on = electrification === opt;
            return (
              <button
                key={opt}
                onClick={() => onUpdate({ doorElectrification: opt })}
                data-testid={`door-elec-${opt}`}
                className={`text-left px-2.5 py-2 rounded-md border text-[11px] transition-colors ${
                  on ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt === 'fail-safe' ? 'Fail-safe' : 'Fail-secure'}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {(['mullion', 'wall'] as const).map((opt) => {
            const on = readerLocation === opt;
            return (
              <button
                key={opt}
                onClick={() => onUpdate({ doorReaderLocation: opt })}
                data-testid={`door-readerloc-${opt}`}
                className={`text-left px-2.5 py-2 rounded-md border text-[11px] transition-colors ${
                  on ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Reader · {opt === 'mullion' ? 'Mullion' : 'Wall'}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground leading-snug">
          Fail-safe drops on power loss (egress doors); Fail-secure stays locked (perimeter / sensitive). Pair maglocks with a fire-alarm release per local code.
        </div>
      </DrawerSection>
    </>
  );
}
