// ScanBuildFloorplanDialog — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. The "Add plan" picker: two recommended starting
// points (upload a real plan, or sketch from a blank canvas).
// The earlier satellite + demo-scan cards were retired in
// Canvas V2 Pass 1.0 because both surfaces violated the
// honesty rule (mocked tiles / mocked AR with "preview only"
// disclaimers). Pure presentational — props for each branch.

import { AlertTriangle, Compass, FolderUp, PencilLine, ScanLine, X } from 'lucide-react';

export function ScanBuildFloorplanDialog({
  onClose, onScanCamera, onUpload, onSatellite, onDrawScratch,
}: {
  onClose: () => void;
  onScanCamera: () => void;
  onUpload: () => void;
  onSatellite: () => void;
  onDrawScratch: () => void;
}) {
  type Opt = { id: string; icon: any; tone: string; title: string; sub: string; honest?: string; onClick: () => void; recommended?: boolean; track: string };
  // Canvas V2 Pass 1.0 — removed the "satellite / address base" card
  // (live tiles not connected; the card carried a "preview only"
  // disclaimer that violated CLAUDE.md's honesty rule) and the "demo
  // site scan" card (mocked AR/LiDAR with a "Demo workflow" disclaimer
  // on the primary surface). Upload and Blank both ship real backing.
  const opts: Opt[] = [
    {
      id: 'upload', icon: FolderUp, tone: '#A371F7', track: 'scan-build-upload',
      title: 'Upload a plan',
      sub: 'PNG, JPG, or PDF. Most users start here. Drop in a floor plan, set the scale, and plot devices.',
      onClick: onUpload, recommended: true,
    },
    {
      id: 'draw', icon: PencilLine, tone: '#F08F3C', track: 'scan-build-draw',
      title: 'Start with a blank canvas',
      sub: 'Sketch walls, rooms, and openings from scratch. Snap to grid is on.',
      onClick: onDrawScratch,
    },
  ];
  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[760px] max-w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <ScanLine className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight">Add a floor plan</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">Pick how you want to bring this site in. You'll set the scale right after.</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {opts.map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.id}
                onClick={o.onClick}
                data-track={o.track}
                className="text-left group rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-secondary/20 p-4 transition-colors flex flex-col gap-2.5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${o.tone}1F`, color: o.tone, boxShadow: `inset 0 0 0 1px ${o.tone}55` }}
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.7} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium tracking-tight">{o.title}</span>
                      {o.recommended && (
                        <span className="text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-300">Start here</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{o.sub}</p>
                {o.honest && (
                  <div className="mt-1 text-[10px] text-amber-300/85 bg-amber-300/10 border border-amber-300/25 rounded px-2 py-1 flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
                    <span className="leading-snug">{o.honest}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="px-6 py-3 border-t border-border text-[11px] text-muted-foreground flex items-center gap-2">
          <Compass className="w-3 h-3" />
          Next step is always Set scale — click two points on a known feature and enter its real distance. Esc to cancel.
        </div>
      </div>
    </div>
  );
}
