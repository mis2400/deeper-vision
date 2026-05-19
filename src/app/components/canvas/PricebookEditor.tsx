// PricebookEditor — modal that lets the user override BOM pricing per
// project. Sits "on top of" the BOM drawer so totals can be watched
// updating live in the right-side drawer underneath.
//
// Sections:
//   • Markup + labor rate
//   • Door hardware (one row per DoorHardware kind)
//   • Cable per ft (one row per CableType)
//
// Each row shows the catalog default, an empty-allowed override input,
// the effective value (override or default), and a per-row Reset.
//
// Persistence is local (Zustand + localStorage) keyed by projectId.
// The footer makes the not-ERP-connected contract explicit.

import { useState, useRef, useEffect } from 'react';
import {
  useProjectStore, DOOR_HARDWARE_PRICE, CABLE_UNIT_PRICE,
} from '../../store/projectStore';
import type { DoorHardware, ProjectPricebook } from '../../store/types';
import { X, RotateCcw, DollarSign, KeyRound, Cable, Briefcase, Percent } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  projectId: string;
  onClose: () => void;
}

const DOOR_HW_ORDER: DoorHardware[] = ['reader', 'strike', 'maglock', 'rex', 'dps', 'contact', 'intercom', 'panic', 'autoop', 'controller', 'psu'];

const CABLE_ORDER: { id: string; label: string }[] = [
  { id: 'cat6',      label: 'CAT6' },
  { id: 'cat6a',     label: 'CAT6A' },
  { id: 'fiber-sm',  label: 'Fiber · single-mode' },
  { id: 'fiber-mm',  label: 'Fiber · multi-mode' },
  { id: 'coax',      label: 'Coax' },
  { id: 'power',     label: 'Power' },
  { id: 'composite', label: 'Composite' },
];

const DEFAULT_LABOR_RATE = 95;
const DEFAULT_MARKUP = 0.18;

export function PricebookEditor({ projectId, onClose }: Props) {
  const pricebook = useProjectStore((s) => s.projectPricebooks[projectId]) as ProjectPricebook | undefined;
  const estimate = useProjectStore((s) => s.estimates[`est-${projectId}`]);
  const setDoorHw      = useProjectStore((s) => s.setPricebookDoorHardware);
  const setCablePerFt  = useProjectStore((s) => s.setPricebookCablePerFt);
  const setLaborRate   = useProjectStore((s) => s.setPricebookLaborRate);
  const setMarkup      = useProjectStore((s) => s.setPricebookMarkup);
  const resetPricebook = useProjectStore((s) => s.resetPricebook);

  const defaultLaborRate = estimate?.laborRate ?? DEFAULT_LABOR_RATE;
  const defaultMarkup    = estimate?.markup    ?? DEFAULT_MARKUP;

  const onEsc = useRef<(e: KeyboardEvent) => void>();
  useEffect(() => {
    onEsc.current = (e) => { if (e.key === 'Escape') onClose(); };
    const handler = (e: KeyboardEvent) => onEsc.current?.(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const overrideCount =
    (Object.keys(pricebook?.doorHardware ?? {}).length) +
    (Object.keys(pricebook?.cablePerFt ?? {}).length) +
    (pricebook?.laborRate != null ? 1 : 0) +
    (pricebook?.markup    != null ? 1 : 0);

  const onResetAll = () => {
    if (overrideCount === 0) return;
    if (!window.confirm(`Clear all ${overrideCount} pricebook overrides for this project? Defaults will apply again.`)) return;
    resetPricebook(projectId);
    toast.message('Pricebook reset to defaults', { duration: 2800 });
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      data-testid="pricebook-editor"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[720px] max-h-[88vh] flex flex-col rounded-xl overflow-hidden"
        style={{
          background: 'var(--popover, #ffffff)',
          border: '1px solid var(--border)',
          boxShadow: '0 32px 64px -24px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-start gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(34,211,238,0.12)', color: '#22D3EE' }}>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight">Pricebook editor</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Overrides apply to this project's BOM only.
              {overrideCount > 0 && <span className="ml-1.5 text-foreground">{overrideCount} override{overrideCount === 1 ? '' : 's'} active.</span>}
            </div>
          </div>
          <button
            onClick={onResetAll}
            disabled={overrideCount === 0}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] border border-border hover:bg-secondary/40 text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            title="Clear all overrides for this project"
            data-track="pricebook-reset-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />Reset all
          </button>
          <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/40">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Markup + labor rate */}
          <Section title="Markup + labor" icon={Percent}>
            <PriceRow
              label="Labor rate"
              icon={Briefcase}
              defaultValue={defaultLaborRate}
              override={pricebook?.laborRate}
              prefix="$"
              suffix="/hr"
              step={1}
              onChange={(v) => setLaborRate(projectId, v)}
              onReset={() => setLaborRate(projectId, null)}
              track="labor-rate"
            />
            <PriceRow
              label="Project markup"
              icon={Percent}
              defaultValue={defaultMarkup * 100}
              override={pricebook?.markup != null ? pricebook.markup * 100 : undefined}
              suffix="%"
              step={0.5}
              onChange={(v) => setMarkup(projectId, v == null ? null : v / 100)}
              onReset={() => setMarkup(projectId, null)}
              track="markup"
            />
          </Section>

          {/* Door hardware */}
          <Section title="Door hardware" icon={KeyRound} hint="Unit price + install labor per opening hardware class.">
            <div className="grid grid-cols-[1fr_120px_120px_120px_28px] gap-x-3 gap-y-1.5 items-center text-[10px] uppercase tracking-[0.1em] text-muted-foreground px-1 mb-1">
              <span>Class</span>
              <span className="text-right">Default $</span>
              <span className="text-right">Override $</span>
              <span className="text-right">Effective</span>
              <span></span>
            </div>
            {DOOR_HW_ORDER.map((hw) => {
              const def = DOOR_HARDWARE_PRICE[hw];
              const pb = pricebook?.doorHardware?.[hw];
              return (
                <DoorHwRow
                  key={hw}
                  hw={hw}
                  desc={def.desc}
                  defaultPrice={def.price}
                  defaultLabor={def.labor}
                  overridePrice={pb?.price}
                  overrideLabor={pb?.labor}
                  onChange={(patch) => setDoorHw(projectId, hw, patch)}
                  onResetPrice={() => setDoorHw(projectId, hw, { price: undefined, labor: pb?.labor })}
                  onResetLabor={() => setDoorHw(projectId, hw, { price: pb?.price, labor: undefined })}
                  onResetAll={() => setDoorHw(projectId, hw, null)}
                />
              );
            })}
            <div className="text-[10px] text-muted-foreground pt-2 leading-snug px-1">
              Labor-hour override applies to both BOM rollup and work-order estimates so the two stay aligned.
            </div>
          </Section>

          {/* Cable per ft */}
          <Section title="Cable per ft" icon={Cable} hint="Dollars per linear foot, before conductor count and run length.">
            <div className="grid grid-cols-[1fr_120px_120px_120px_28px] gap-x-3 gap-y-1.5 items-center text-[10px] uppercase tracking-[0.1em] text-muted-foreground px-1 mb-1">
              <span>Cable</span>
              <span className="text-right">Default $/ft</span>
              <span className="text-right">Override $/ft</span>
              <span className="text-right">Effective</span>
              <span></span>
            </div>
            {CABLE_ORDER.map((c) => {
              const def = CABLE_UNIT_PRICE[c.id] ?? 0.5;
              const pb = pricebook?.cablePerFt?.[c.id];
              return (
                <PriceRow
                  key={c.id}
                  label={c.label}
                  defaultValue={def}
                  override={pb}
                  prefix="$"
                  suffix="/ft"
                  step={0.01}
                  precision={2}
                  onChange={(v) => setCablePerFt(projectId, c.id, v)}
                  onReset={() => setCablePerFt(projectId, c.id, null)}
                  track={`cable-${c.id}`}
                />
              );
            })}
          </Section>
        </div>

        {/* Footer disclaimer */}
        <div className="px-5 py-3 border-t border-border bg-secondary/15 text-[10px] text-muted-foreground leading-snug shrink-0">
          Pricebook overrides are stored in this browser for this project. They feed the BOM
          drawer, CSV export, and field-deployment labor estimates immediately. Not connected to
          ERP / accounting / pricebook vendor sync yet.
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, hint, children }: {
  title: string; icon: any; hint?: string; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <div className="text-[11px] uppercase tracking-[0.14em] text-foreground">{title}</div>
        {hint && <div className="text-[10px] text-muted-foreground ml-2 truncate">{hint}</div>}
      </div>
      <div className="rounded-lg border border-border bg-secondary/10 p-3 space-y-1.5">
        {children}
      </div>
    </section>
  );
}

function PriceRow({
  label, icon: Icon, defaultValue, override, prefix, suffix, step = 1, precision = 0,
  onChange, onReset, track,
}: {
  label: string;
  icon?: any;
  defaultValue: number;
  override?: number;
  prefix?: string;
  suffix?: string;
  step?: number;
  precision?: number;
  onChange: (v: number | null) => void;
  onReset: () => void;
  track: string;
}) {
  const has = override != null;
  const effective = has ? override : defaultValue;
  const fmt = (n: number) => (prefix ?? '') + n.toFixed(precision) + (suffix ?? '');
  return (
    <div className="grid grid-cols-[1fr_120px_120px_120px_28px] gap-x-3 items-center">
      <div className="flex items-center gap-1.5 min-w-0">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
        <span className="text-[12px] text-foreground truncate">{label}</span>
      </div>
      <span className="text-[11px] text-muted-foreground tabular-nums text-right">{fmt(defaultValue)}</span>
      <input
        type="number"
        value={has ? override : ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') onChange(null);
          else {
            const n = Number(raw);
            if (Number.isFinite(n) && n >= 0) onChange(n);
          }
        }}
        step={step}
        min={0}
        placeholder="—"
        className={`text-[12px] h-7 px-2 rounded border bg-background text-right tabular-nums focus:outline-none ${has ? 'border-primary/50 text-foreground' : 'border-border text-muted-foreground'}`}
        data-testid={`pricebook-override-${track}`}
      />
      <span className={`text-[12px] tabular-nums text-right ${has ? 'text-primary font-medium' : 'text-foreground'}`}>{fmt(effective)}</span>
      <button
        onClick={onReset}
        disabled={!has}
        className="h-7 w-7 rounded inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Reset this row to default"
        data-track={`pricebook-reset-${track}`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function DoorHwRow({
  hw, desc, defaultPrice, defaultLabor, overridePrice, overrideLabor,
  onChange, onResetPrice, onResetLabor, onResetAll,
}: {
  hw: DoorHardware;
  desc: string;
  defaultPrice: number;
  defaultLabor: number;
  overridePrice?: number;
  overrideLabor?: number;
  onChange: (patch: { price?: number; labor?: number }) => void;
  onResetPrice: () => void;
  onResetLabor: () => void;
  onResetAll: () => void;
}) {
  const hasPrice = overridePrice != null;
  const hasLabor = overrideLabor != null;
  const effPrice = hasPrice ? overridePrice : defaultPrice;
  const effLabor = hasLabor ? overrideLabor : defaultLabor;
  return (
    <>
      <div className="grid grid-cols-[1fr_120px_120px_120px_28px] gap-x-3 items-center">
        <div className="flex flex-col min-w-0">
          <span className="text-[12px] text-foreground truncate">{desc}</span>
          <span className="text-[9.5px] text-muted-foreground tracking-tight">{hw}</span>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums text-right">${defaultPrice.toFixed(0)}</span>
        <input
          type="number"
          value={hasPrice ? overridePrice : ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') onChange({ price: undefined, labor: overrideLabor });
            else {
              const n = Number(raw);
              if (Number.isFinite(n) && n >= 0) onChange({ price: n, labor: overrideLabor });
            }
          }}
          step={1}
          min={0}
          placeholder="—"
          className={`text-[12px] h-7 px-2 rounded border bg-background text-right tabular-nums focus:outline-none ${hasPrice ? 'border-primary/50 text-foreground' : 'border-border text-muted-foreground'}`}
          data-testid={`pricebook-override-door-${hw}-price`}
        />
        <span className={`text-[12px] tabular-nums text-right ${hasPrice ? 'text-primary font-medium' : 'text-foreground'}`}>${effPrice.toFixed(0)}</span>
        <button
          onClick={() => (hasPrice || hasLabor) ? onResetAll() : undefined}
          disabled={!hasPrice && !hasLabor}
          className="h-7 w-7 rounded inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Reset both price + labor for this hardware class"
          data-track={`pricebook-reset-door-${hw}`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_120px_120px_120px_28px] gap-x-3 items-center -mt-0.5">
        <div className="flex items-center gap-1.5 pl-5">
          <Briefcase className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Install labor</span>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums text-right">{defaultLabor.toFixed(2)} hr</span>
        <input
          type="number"
          value={hasLabor ? overrideLabor : ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') onChange({ price: overridePrice, labor: undefined });
            else {
              const n = Number(raw);
              if (Number.isFinite(n) && n >= 0) onChange({ price: overridePrice, labor: n });
            }
          }}
          step={0.05}
          min={0}
          placeholder="—"
          className={`text-[11px] h-6 px-2 rounded border bg-background text-right tabular-nums focus:outline-none ${hasLabor ? 'border-primary/50 text-foreground' : 'border-border text-muted-foreground'}`}
          data-testid={`pricebook-override-door-${hw}-labor`}
        />
        <span className={`text-[11px] tabular-nums text-right ${hasLabor ? 'text-primary font-medium' : 'text-foreground'}`}>{effLabor.toFixed(2)} hr</span>
        <button
          onClick={onResetLabor}
          disabled={!hasLabor}
          className="h-6 w-6 rounded inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Reset labor for this hardware class"
          data-track={`pricebook-reset-door-${hw}-labor`}
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>
    </>
  );
}
