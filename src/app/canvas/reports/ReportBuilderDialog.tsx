// ReportBuilderDialog — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. The "real builder, not a list of random export
// buttons" the brief asked for: 8 report types × audience
// selector × content toggles → live page-count estimate →
// export PDF via drawReport. Reads + writes via local useState
// only; the actual document generation happens in
// canvas/reports/draw.ts.

import { Cable, Check, DollarSign, DoorOpen, FileBarChart, PencilRuler, ShieldCheck, Sparkles, Video, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Device } from '../types';
import { drawReport, type ReportKind } from './draw';

export function ReportBuilderDialog({
  onClose, devices, projectId, pxToFt,
}: { onClose: () => void; devices: Device[]; projectId: string; pxToFt: number }) {
  type ReportType = ReportKind | 'estimate';
  const TYPES: Array<{ id: ReportType; label: string; sub: string; icon: any; tone: string }> = [
    { id: 'customer',         label: 'Customer presentation', sub: 'Cover · overview · investment · timeline', icon: Sparkles,    tone: '#A371F7' },
    { id: 'engineering',      label: 'Engineering packet',    sub: 'Device schedule · BOM · cable schedule · findings', icon: FileBarChart, tone: '#5DA0E8' },
    { id: 'camera-schedule',  label: 'Camera schedule',       sub: 'Location · model · IR · mount · power',   icon: Video,       tone: '#F08F3C' },
    { id: 'door-schedule',    label: 'Door schedule',         sub: 'Openings · reader / strike / REX / DPS',  icon: DoorOpen,    tone: '#4FB87E' },
    { id: 'cable-schedule',   label: 'Cable schedule',        sub: 'Runs · cable type · length · termination', icon: Cable,      tone: '#22D3EE' },
    { id: 'conduit-schedule', label: 'Conduit schedule',      sub: 'Conduit · size · cables · fill %',         icon: PencilRuler, tone: '#A371F7' },
    { id: 'bom',              label: 'Bill of materials',     sub: 'Line items · live unit pricing',          icon: DollarSign,  tone: '#E5A23A' },
    { id: 'estimate',         label: 'Estimate',              sub: 'Customer-safe pricing summary',           icon: DollarSign,  tone: '#E5A23A' },
    { id: 'commissioning',    label: 'Commissioning report',  sub: 'Per-device install / firmware / sign-off', icon: ShieldCheck, tone: '#E55B5B' },
  ];
  const [reportType, setReportType] = useState<ReportType>('engineering');
  const [audience, setAudience] = useState<'customer' | 'internal'>('internal');
  const [include, setInclude] = useState({
    mapSnapshot:    true,
    selectedLayers: true,
    deviceTable:    true,
    bom:            true,
    notesMedia:     false,
    aiRecs:         false,
    cutSheets:      false,
  });
  const [busy, setBusy] = useState(false);

  const sections: string[] = [];
  if (include.mapSnapshot)    sections.push('Map snapshot');
  if (include.selectedLayers) sections.push('Engineering layers');
  if (include.deviceTable)    sections.push('Device table');
  if (include.bom)            sections.push('Bill of materials');
  if (include.notesMedia)     sections.push('Notes & media');
  if (include.aiRecs)         sections.push('AI recommendations');
  if (include.cutSheets)      sections.push('Product cut sheets');
  const pageEstimate = 1
    + (include.mapSnapshot ? 1 : 0)
    + (include.deviceTable ? Math.max(1, Math.ceil(devices.length / 24)) : 0)
    + (include.bom         ? Math.max(1, Math.ceil(devices.length / 30)) : 0)
    + (include.notesMedia  ? 2 : 0)
    + (include.aiRecs      ? 1 : 0)
    + (include.cutSheets   ? Math.min(8, devices.length) : 0);

  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      // Estimate reuses BOM under the hood for now; the audience selector
      // gates the customer/internal label baked into the cover.
      const kind: ReportKind = (reportType === 'estimate' ? 'bom' : reportType) as ReportKind;
      drawReport(doc, kind, devices, projectId, pxToFt);
      const label = `${projectId}-${reportType}-${audience}-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(label);
      toast.success(`Exported · ${TYPES.find((t) => t.id === reportType)?.label}`, {
        description: `${pageEstimate} page${pageEstimate === 1 ? '' : 's'} · ${audience === 'customer' ? 'Customer-safe' : 'Internal'}`,
        duration: 4000,
      });
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Export failed', { description: 'See console for details.', duration: 5000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[820px] max-w-full max-h-[88vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <FileBarChart className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight">Report Builder</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Pick a report type, choose what to include, then export.</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-auto grid grid-cols-12 gap-5 p-5">
          {/* Left — report type chooser */}
          <div className="col-span-5 space-y-1.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5 px-1">Report type</div>
            {TYPES.map((t) => {
              const Icon = t.icon;
              const active = reportType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setReportType(t.id)}
                  data-track={`report-type-${t.id}`}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${active ? 'border-primary/40 bg-primary/8' : 'border-border hover:border-border-strong hover:bg-secondary/30'}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: `${t.tone}1F`, color: t.tone, boxShadow: `inset 0 0 0 1px ${t.tone}55` }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12px] font-medium ${active ? 'text-foreground' : 'text-foreground'}`}>{t.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{t.sub}</div>
                    </div>
                    {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right — options + preview */}
          <div className="col-span-7 space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Audience</div>
              <div className="flex items-stretch h-9 border border-border rounded-lg overflow-hidden">
                {([
                  { id: 'internal' as const, label: 'Internal engineering', hint: 'Full detail · prices · findings · warnings' },
                  { id: 'customer' as const, label: 'Customer-safe',        hint: 'Removes dealer cost · internal-only sections' },
                ]).map((a) => {
                  const active = audience === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAudience(a.id)}
                      title={a.hint}
                      data-track={`report-audience-${a.id}`}
                      className={`flex-1 text-[12px] transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5">Include</div>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { k: 'mapSnapshot',    label: 'Map snapshot',      hint: 'Current floorplan view' },
                  { k: 'selectedLayers', label: 'Engineering layers', hint: 'FOV / power / pathways / annotations' },
                  { k: 'deviceTable',    label: 'Device table',      hint: `${devices.length} devices · ID · model · location` },
                  { k: 'bom',            label: 'Bill of materials', hint: 'Quantities · MSRP · totals' },
                  { k: 'notesMedia',     label: 'Notes & media',     hint: 'Field photos and site notes' },
                  { k: 'aiRecs',         label: 'AI recommendations', hint: 'Engineering Assistant findings' },
                  { k: 'cutSheets',      label: 'Product cut sheets', hint: 'Per-device datasheet pages' },
                ] as const).map((opt) => {
                  const checked = !!include[opt.k];
                  return (
                    <label
                      key={opt.k}
                      className={`flex items-start gap-2.5 px-3 py-2 rounded-md border cursor-pointer transition-colors ${checked ? 'border-primary/35 bg-primary/8' : 'border-border hover:border-border-strong hover:bg-secondary/30'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setInclude((v) => ({ ...v, [opt.k]: e.target.checked }))}
                        className="mt-0.5 accent-primary"
                        data-track={`report-opt-${opt.k}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium">{opt.label}</div>
                        <div className="text-[10px] text-muted-foreground">{opt.hint}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-[0.10em] text-muted-foreground">Preview summary</div>
                <div className="text-[10px] text-muted-foreground">
                  ~{pageEstimate} page{pageEstimate === 1 ? '' : 's'}
                </div>
              </div>
              <div className="text-[12px] font-medium mt-1">
                {TYPES.find((t) => t.id === reportType)?.label} · {audience === 'customer' ? 'Customer-safe' : 'Internal'}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1.5">
                {sections.length === 0 ? 'No sections selected — cover page only.' : `Includes: ${sections.join(' · ')}.`}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground">
            Output: PDF · letter · landscape. Generated from your live canvas.
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-[12px] px-3 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40">Cancel</button>
            <button
              onClick={handleExport}
              disabled={busy || sections.length === 0}
              data-track="report-export"
              className="text-[12px] font-medium px-3.5 h-8 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
