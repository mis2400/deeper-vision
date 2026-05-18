// ProjectStateMenu — compact popover on the Engineering Canvas TopBar
// that exposes the four shared-demo-sync actions:
//
//   ↓ Export project JSON
//   ↑ Import project JSON
//   ⟲ Reset to shared demo
//   🗑 Clear local project state
//
// State persistence is local (Zustand + localStorage), so a project
// edited on localhost won't appear on the live URL automatically.
// Export/import lets the user move a snapshot between environments;
// Reset / Clear give a predictable starting point for demos.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useProjectStore, exportProjectState } from '../../store/projectStore';
import type { ProjectStateEnvelope } from '../../store/types';
import { buildLabel, COMMIT_HASH } from '../../../build-info';
import {
  Database, Download, Upload as UploadIcon, RotateCcw, Trash2,
  AlertTriangle, X, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  projectId: string;
  /** Triggered after import / reset / clear so the parent can refresh
   *  derived UI (selection, etc.). The component does its own toast +
   *  optional reload. */
  onAfterStateReplaced?: () => void;
}

export function ProjectStateMenu({ projectId, onAfterStateReplaced }: Props) {
  const importProjectState = useProjectStore((s) => s.importProjectState);
  const resetDemoData = useProjectStore((s) => s.resetDemoData);
  const fullState = useProjectStore();

  const [open, setOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<ProjectStateEnvelope | null>(null);
  const [pendingResetKind, setPendingResetKind] = useState<'reset' | 'clear' | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [open]);

  const onExport = useCallback(() => {
    try {
      const env = exportProjectState(fullState, projectId, { buildLabel: buildLabel() });
      const json = JSON.stringify(env, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeId = projectId.replace(/[^a-z0-9-_]+/gi, '_');
      const stamp = new Date(env.exportedAt).toISOString().slice(0, 10);
      a.download = `deeper-vision-${safeId}-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setOpen(false);
      toast.success('Project state exported', {
        description: `${a.download} · ${env.summary.deviceCount} devices · ${env.summary.pathwayCount} pathways · ${env.summary.workOrderProgressCount} work-order records`,
        duration: 4000,
      });
    } catch (e: any) {
      toast.error('Export failed', { description: String(e?.message ?? e), duration: 5000 });
    }
  }, [fullState, projectId]);

  const onImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFilePicked = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so picking the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ProjectStateEnvelope;
      if (!parsed || parsed.kind !== 'deeper-vision-project-state') {
        toast.error('Not a Deeper Vision state file', { description: 'Expected a JSON envelope with kind "deeper-vision-project-state".', duration: 6000 });
        return;
      }
      if (parsed.version !== 1) {
        toast.error('Unsupported envelope version', { description: `Got version ${String(parsed.version)}; this build expects version 1.`, duration: 6000 });
        return;
      }
      setPendingImport(parsed);
      setOpen(false);
    } catch (err: any) {
      toast.error('Could not read file', { description: String(err?.message ?? err), duration: 6000 });
    }
  }, []);

  const applyImport = useCallback(() => {
    if (!pendingImport) return;
    try {
      importProjectState(pendingImport);
      toast.success('Project state imported', {
        description: `Replaced ${pendingImport.projectId} · ${pendingImport.summary.deviceCount} devices · ${pendingImport.summary.pathwayCount} pathways`,
        duration: 4000,
      });
      setPendingImport(null);
      onAfterStateReplaced?.();
    } catch (err: any) {
      toast.error('Import failed', { description: String(err?.message ?? err), duration: 6000 });
    }
  }, [pendingImport, importProjectState, onAfterStateReplaced]);

  const applyReset = useCallback(() => {
    if (pendingResetKind === 'reset') {
      resetDemoData();
      toast.success('Reset to shared demo', { description: 'Local state replaced with the seeded demo data.', duration: 3500 });
      setPendingResetKind(null);
      onAfterStateReplaced?.();
      // Send the user back to the canvas root so /review or /deployment
      // doesn't render against stale local selection state.
      setTimeout(() => { window.location.assign(`/project/${projectId}/canvas`); }, 250);
    } else if (pendingResetKind === 'clear') {
      // Drop the persisted blob so the next load runs the seed clean.
      try { localStorage.removeItem('deeperVisionStore'); } catch { /* noop */ }
      toast.success('Local project state cleared', { description: 'Reloading to a fresh seed…', duration: 2500 });
      setPendingResetKind(null);
      setTimeout(() => { window.location.assign(`/project/${projectId}/canvas`); }, 400);
    }
  }, [pendingResetKind, resetDemoData, projectId, onAfterStateReplaced]);

  return (
    <div className="relative" ref={rootRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={onFilePicked}
        className="hidden"
        data-testid="project-state-file-input"
      />
      <button
        onClick={() => setOpen((v) => !v)}
        title="Project state · export / import / reset"
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-medium border transition-colors ${open ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border hover:bg-secondary/50 text-foreground'}`}
        data-track="topbar-project-state"
      >
        <Database className="w-3.5 h-3.5" />Project state
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-9 z-50 w-[320px] rounded-xl overflow-hidden"
          style={{
            background: 'var(--panel-background, var(--popover, #ffffff))',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--border)',
            boxShadow: '0 22px 48px -16px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.04)',
          }}
          data-testid="project-state-menu"
        >
          <div className="px-3 pt-3 pb-2 border-b border-border/60">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Move state</div>
          </div>
          <button onClick={onExport}
            className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-secondary/40 transition-colors"
            data-track="project-state-export"
          >
            <Download className="w-3.5 h-3.5 text-foreground/80 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-foreground font-medium">Export project JSON</div>
              <div className="text-[10.5px] text-muted-foreground leading-snug">Download {projectId} · devices, doors, pathways, work-order progress, calibration.</div>
            </div>
          </button>
          <button onClick={onImportClick}
            className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-secondary/40 transition-colors border-t border-border/40"
            data-track="project-state-import"
          >
            <UploadIcon className="w-3.5 h-3.5 text-foreground/80 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-foreground font-medium">Import project JSON</div>
              <div className="text-[10.5px] text-muted-foreground leading-snug">Pick a previously exported file to replace this project's state.</div>
            </div>
          </button>

          <div className="px-3 pt-3 pb-2 border-t border-border/60">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Reset</div>
          </div>
          <button onClick={() => setPendingResetKind('reset')}
            className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-secondary/40 transition-colors"
            data-track="project-state-reset-demo"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-foreground font-medium">Reset to shared demo</div>
              <div className="text-[10.5px] text-muted-foreground leading-snug">Restore the seeded polished demo so reviewer feedback is predictable.</div>
            </div>
          </button>
          <button onClick={() => setPendingResetKind('clear')}
            className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-red-500/10 transition-colors border-t border-border/40"
            data-track="project-state-clear-local"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-red-500 font-medium">Clear local project state</div>
              <div className="text-[10.5px] text-muted-foreground leading-snug">Removes the persisted blob in this browser, then reloads to a fresh seed. Local only.</div>
            </div>
          </button>

          <div className="px-3 py-2.5 border-t border-border/60 bg-secondary/15 space-y-1">
            <p className="text-[10.5px] text-foreground/80 leading-snug">This prototype stores project state in <span className="font-medium">this browser</span>.</p>
            <p className="text-[10.5px] text-muted-foreground leading-snug">Export / import lets you move a demo state between local and live.</p>
            <p className="text-[10.5px] text-muted-foreground leading-snug">Cloud sync will replace this later.</p>
          </div>
        </div>
      )}

      {pendingImport && (
        <ImportConfirmModal
          envelope={pendingImport}
          onCancel={() => setPendingImport(null)}
          onApply={applyImport}
        />
      )}
      {pendingResetKind && (
        <ResetConfirmModal
          kind={pendingResetKind}
          projectId={projectId}
          onCancel={() => setPendingResetKind(null)}
          onApply={applyReset}
        />
      )}
    </div>
  );
}

function ImportConfirmModal({ envelope, onCancel, onApply }: {
  envelope: ProjectStateEnvelope;
  onCancel: () => void;
  onApply: () => void;
}) {
  const exportedAt = new Date(envelope.exportedAt).toLocaleString();
  const matchesBuild = envelope.buildLabel?.includes(COMMIT_HASH);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" data-testid="project-state-import-confirm">
      <div className="w-full max-w-md rounded-xl overflow-hidden"
        style={{
          background: 'var(--popover, #ffffff)',
          border: '1px solid var(--border)',
          boxShadow: '0 32px 64px -24px rgba(0,0,0,0.5)',
        }}
      >
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.12)', color: '#22D3EE' }}>
            <UploadIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold tracking-tight">Replace project state?</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">This overwrites the current local state for <span className="font-mono text-foreground">{envelope.projectId}</span>.</div>
          </div>
          <button onClick={onCancel} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-2 text-[12px]">
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
            <Kv k="Project"   v={envelope.summary.projectName} />
            <Kv k="Exported"  v={exportedAt} />
            <Kv k="Devices"   v={String(envelope.summary.deviceCount)} />
            <Kv k="Doors"     v={String(envelope.summary.doorCount)} />
            <Kv k="Pathways"  v={String(envelope.summary.pathwayCount)} />
            <Kv k="IDFs"      v={String(envelope.summary.idfCount)} />
            <Kv k="Floors"    v={String(envelope.summary.floorCount)} />
            <Kv k="WO state"  v={String(envelope.summary.workOrderProgressCount)} />
          </div>
          {envelope.buildLabel && (
            <div className="pt-2 border-t border-border/40 text-[10.5px] text-muted-foreground">
              Source build: <span className="font-mono text-foreground">{envelope.buildLabel}</span>
              {!matchesBuild && (
                <div className="flex items-start gap-1.5 mt-1 text-amber-500">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Different build than this page. Imports across versions usually work, but schema changes (e.g. v5 → v6) may surface as unexpected behaviour.</span>
                </div>
              )}
            </div>
          )}
          <div className="text-[10.5px] text-muted-foreground leading-snug pt-2 border-t border-border/40">
            Other projects in your browser are untouched. This is irreversible — export the current state first if you want a rollback file.
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onCancel}
            className="inline-flex items-center h-8 px-3 rounded-md text-[12px] border border-border hover:bg-secondary/40">
            Cancel
          </button>
          <button onClick={onApply}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90"
            data-track="project-state-import-apply"
          >
            <UploadIcon className="w-3.5 h-3.5" />Replace local state
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetConfirmModal({ kind, projectId, onCancel, onApply }: {
  kind: 'reset' | 'clear';
  projectId: string;
  onCancel: () => void;
  onApply: () => void;
}) {
  const isClear = kind === 'clear';
  const tone = isClear ? '#EF4444' : '#F59E0B';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" data-testid="project-state-reset-confirm">
      <div className="w-full max-w-md rounded-xl overflow-hidden"
        style={{
          background: 'var(--popover, #ffffff)',
          border: '1px solid var(--border)',
          boxShadow: '0 32px 64px -24px rgba(0,0,0,0.5)',
        }}
      >
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${tone}22`, color: tone }}>
            {isClear ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold tracking-tight">
              {isClear ? 'Clear local project state?' : 'Reset to shared demo?'}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {isClear
                ? 'Removes the persisted blob for this browser and reloads.'
                : 'Restores the seeded polished demo so the canvas / review / deployment routes show a predictable state.'}
            </div>
          </div>
          <button onClick={onCancel} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/40"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 text-[12px] space-y-2">
          <div className="text-foreground/90">
            {isClear
              ? <>This drops <span className="font-mono">localStorage["deeperVisionStore"]</span> and reloads <span className="font-mono">/project/{projectId}/canvas</span>. Any local edits you've made and not exported will be lost. Other browser tabs on this domain will also be reset on their next load.</>
              : <>This rebuilds the seeded demo state (every project — not just {projectId}). Local edits across projects will be lost. Reviewers will see the same canvas you do on a fresh load.</>
            }
          </div>
          <div className="text-[10.5px] text-muted-foreground leading-snug pt-2 border-t border-border/40">
            Local only. The live URL is a separate browser and isn't touched by either action.
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onCancel}
            className="inline-flex items-center h-8 px-3 rounded-md text-[12px] border border-border hover:bg-secondary/40">
            Cancel
          </button>
          <button onClick={onApply}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] border text-primary-foreground"
            style={{ background: tone, borderColor: `${tone}99` }}
            data-track={isClear ? 'project-state-clear-apply' : 'project-state-reset-apply'}
          >
            {isClear ? <Trash2 className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
            {isClear ? 'Clear + reload' : 'Reset + reload'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{k}</span>
      <span className="text-[12px] text-foreground text-right truncate">{v}</span>
    </>
  );
}
