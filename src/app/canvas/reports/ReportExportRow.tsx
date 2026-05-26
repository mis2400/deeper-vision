// ReportExportRow — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Single-row button used in the legacy "Reports" list
// (icon + label + sub + PDF button). On click dynamically loads
// jspdf, builds a doc, hands it to drawReport, saves, and surfaces
// a sonner toast. Stateful via local useState for the busy flag.

import { useState } from 'react';
import { toast } from 'sonner';
import type { Device } from '../types';
import { drawReport, type ReportKind } from './draw';

export function ReportExportRow({
  icon: Icon, label, sub, tone, kind, devices, projectId, pxToFt,
}: { icon: any; label: string; sub: string; tone: string; kind: ReportKind; devices: Device[]; projectId: string; pxToFt: number }) {
  const [busy, setBusy] = useState(false);
  const handleExport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      drawReport(doc, kind, devices, projectId, pxToFt);
      doc.save(`${projectId}-${kind}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`Exported · ${label}`, { duration: 3000 });
    } catch (e) {
      console.error(e);
      toast.error('Export failed', { description: 'See console for details.', duration: 5000 });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={handleExport}
      disabled={busy}
      className="w-full text-left px-3 py-2.5 hover:bg-secondary/40 border-b border-border/50 flex items-center gap-3 disabled:opacity-60"
    >
      <div
        className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0"
        style={{ boxShadow: `inset 0 0 0 1.5px ${tone}`, color: tone }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] truncate">{label}</div>
        <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
      </div>
      <span className="text-[10px] font-medium text-primary">{busy ? 'Exporting…' : 'PDF'}</span>
    </button>
  );
}
