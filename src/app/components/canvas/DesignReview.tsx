// DV Assist Phase 1 — Final Design Review modal.
//
// Runs every rule across the project, aggregates by category, and
// renders a summary report. All counts are real, computed from the
// actual design state. The report links into the same per-finding
// fix paths Action mode uses; the modal stays open across applies
// so the operator can sweep down the list in one session.

import { useEffect, useMemo, useState } from 'react';
import {
  X, AlertCircle, AlertTriangle, Info, CircleCheck, Wrench, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProjectStore } from '../../store/projectStore';
import {
  runAllRules, groupByCategory,
  type Finding, type FindingCategory, type FindingSeverity,
} from '../../lib/assistantRules';
import { executeAction, undoAction } from '../../lib/assistantActions';
import type { AiAction } from '../../store/types';

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<FindingCategory, string> = {
  license:     'License',
  mount:       'Mount',
  environment: 'Environment',
  power:       'Power',
  capacity:    'Capacity',
  pathway:     'Pathway',
  distance:    'Distance',
  coverage:    'Coverage',
  topology:    'Topology',
};

const SEVERITY_META: Record<FindingSeverity, { Icon: typeof AlertCircle; tone: string; bg: string }> = {
  critical: { Icon: AlertCircle,   tone: 'text-red-500',    bg: 'bg-red-500/10 border-red-500/20' },
  warn:     { Icon: AlertTriangle, tone: 'text-amber-500',  bg: 'bg-amber-500/10 border-amber-500/20' },
  info:     { Icon: Info,          tone: 'text-sky-500',    bg: 'bg-sky-500/10 border-sky-500/20' },
};

export function DesignReview({ projectId, open, onClose }: Props) {
  const devices  = useProjectStore((s) => s.devices);
  const pathways = useProjectStore((s) => s.pathways);
  const rooms    = useProjectStore((s) => s.rooms);
  const floors   = useProjectStore((s) => s.floors);
  const idfs     = useProjectStore((s) => s.idfs);
  const project  = useProjectStore((s) => s.projects[projectId]);

  const { findings, summary } = useMemo(() => {
    const filter = <T extends { projectId: string }>(rec: Record<string, T>): T[] =>
      Object.values(rec).filter((x) => x.projectId === projectId);
    const projectDevices = filter(devices);
    const projectFloors = filter(floors);
    const projectIdfs   = filter(idfs);
    const findings = runAllRules({
      devices:  projectDevices,
      pathways: filter(pathways),
      rooms:    filter(rooms),
      floors:   projectFloors,
      idfs:     projectIdfs,
    });
    const cameraCount = projectDevices.filter((d) => d.type.startsWith('cam.')).length;
    const doorCount = projectDevices.filter((d) =>
      d.type.startsWith('inf.door') || d.type.startsWith('inf.gate')).length;
    const idfCount = projectIdfs.length;
    const summary = {
      devices: projectDevices.length,
      cameras: cameraCount,
      doors: doorCount,
      floors: projectFloors.length,
      idfs: idfCount,
      findings: findings.length,
      critical: findings.filter((f) => f.severity === 'critical').length,
      warn:     findings.filter((f) => f.severity === 'warn').length,
      info:     findings.filter((f) => f.severity === 'info').length,
    };
    return { findings, summary };
  }, [projectId, devices, pathways, rooms, floors, idfs]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const byCategory = groupByCategory(findings);

  const onApply = (f: Finding) => {
    const action = suggestedFixToAction(f);
    if (!action) {
      toast.error('No fix path available for this finding.');
      return;
    }
    const res = executeAction(action, projectId);
    if (res.refused) { toast.error(res.result); return; }
    if (res.undoPayload) {
      toast.success(res.result, {
        action: {
          label: 'Undo',
          onClick: () => {
            const reverted = undoAction({
              actionId: f.id, appliedAt: Date.now(),
              result: res.result, undoPayload: res.undoPayload,
            });
            if (reverted) toast.success(reverted);
          },
        },
        duration: 6000,
      });
    } else {
      toast.success(res.result);
    }
  };

  return (
    <div
      data-testid="design-review-backdrop"
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={onClose}
    >
      <div
        data-testid="design-review"
        className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border/60 flex items-center gap-3">
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Final design review
          </h2>
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {project?.name ?? projectId}
          </span>
          <button
            data-testid="design-review-close"
            onClick={onClose}
            className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary strip — real counts, no inflation. */}
        <div className="px-5 py-3 border-b border-border/60 grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
          <Stat label="Devices" value={summary.devices} />
          <Stat label="Cameras" value={summary.cameras} />
          <Stat label="Doors" value={summary.doors} />
          <Stat label="Floors" value={summary.floors} />
          <Stat label="IDFs" value={summary.idfs} />
          <Stat label="Findings" value={summary.findings} />
        </div>

        {/* Severity breakdown */}
        <div className="px-5 py-2.5 border-b border-border/60 flex items-center gap-4 text-[12px]">
          <SeverityChip count={summary.critical} severity="critical" />
          <SeverityChip count={summary.warn}     severity="warn" />
          <SeverityChip count={summary.info}     severity="info" />
        </div>

        {/* Body — sections per category. */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {summary.findings === 0 ? (
            <div className="flex items-start gap-2 px-3 py-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <CircleCheck className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-foreground">No issues detected.</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Every rule passed against the current design state.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {(Object.keys(byCategory) as FindingCategory[]).map((cat) => {
                const list = byCategory[cat];
                if (!list || list.length === 0) return null;
                return (
                  <section key={cat} data-testid={`design-review-category-${cat}`}>
                    <header className="flex items-center gap-2 mb-2">
                      <h3 className="text-[13px] font-semibold tracking-tight text-foreground">
                        {CATEGORY_LABEL[cat]}
                      </h3>
                      <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        {list.length}
                      </span>
                    </header>
                    <ul className="space-y-1.5">
                      {list.map((f) => (
                        <ReviewFinding key={f.id} f={f} onApply={onApply} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[20px] font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function SeverityChip({ count, severity }: { count: number; severity: FindingSeverity }) {
  const meta = SEVERITY_META[severity];
  return (
    <span className="inline-flex items-center gap-1.5">
      <meta.Icon className={`w-3.5 h-3.5 ${meta.tone}`} />
      <span className="font-mono tabular-nums text-foreground">{count}</span>
      <span className="text-muted-foreground capitalize">{severity}</span>
    </span>
  );
}

function ReviewFinding({ f, onApply }: { f: Finding; onApply: (f: Finding) => void }) {
  const meta = SEVERITY_META[f.severity];
  const fix = f.suggestedFix;
  const fixCanExecute = fix && (fix.kind === 'add-license' || fix.kind === 'add-mount' || fix.kind === 'add-accessory');
  const fixIsManual   = fix && fix.kind === 'select-and-edit';
  return (
    <li
      data-testid={`design-review-finding-${f.id}`}
      className={`px-3 py-2.5 rounded-md border ${meta.bg}`}
    >
      <div className="flex items-start gap-2.5">
        <meta.Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.tone}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-foreground leading-tight">{f.title}</p>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{f.description}</p>
          {fix && (
            <div className="mt-1.5 flex items-center gap-2">
              {fixCanExecute ? (
                <button
                  data-testid={`design-review-apply-${f.id}`}
                  onClick={() => onApply(f)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-primary-foreground bg-primary hover:opacity-90 transition-opacity"
                >
                  <Wrench className="w-3 h-3" /> {fix.label}
                </button>
              ) : fixIsManual ? (
                <button
                  data-testid={`design-review-open-${f.id}`}
                  onClick={() => onApply(f)}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  {fix.label} <ExternalLink className="w-3 h-3" />
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function suggestedFixToAction(f: Finding): AiAction | undefined {
  const fix = f.suggestedFix;
  if (!fix) return undefined;
  const actionId = `dva-review-${f.id}`;
  switch (fix.kind) {
    case 'add-license':
      return { id: actionId, kind: 'add-license', label: fix.label, deviceId: fix.deviceId, productId: fix.productId };
    case 'add-mount':
      return { id: actionId, kind: 'add-mount', label: fix.label, deviceId: fix.deviceId, productId: fix.productId };
    case 'add-accessory':
      return { id: actionId, kind: 'add-accessory', label: fix.label, deviceId: fix.deviceId, productId: fix.productId };
    case 'select-and-edit':
      return { id: actionId, kind: 'select-and-edit', label: fix.label, objectId: fix.objectId, objectKind: fix.objectKind === 'room' ? 'room' : fix.objectKind };
  }
}
