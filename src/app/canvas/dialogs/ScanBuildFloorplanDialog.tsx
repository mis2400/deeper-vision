// ScanBuildFloorplanDialog — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. The "Add plan" picker: the honest entry point into the
// floor surface. Upload and Blank are production paths. Site map
// uses the app's generated map layer, which labels itself as simulated
// on-canvas. Vision scan opens the existing demo workflow and does not
// claim real LiDAR capture.

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
  const opts: Opt[] = [
    {
      id: 'upload', icon: FolderUp, tone: 'var(--primary)', track: 'scan-build-upload',
      title: 'Upload a plan',
      sub: 'PNG, JPG, or PDF. Most users start here. Drop in a floor plan, set the scale, and plot devices.',
      onClick: onUpload, recommended: true,
    },
    {
      id: 'site-map', icon: Compass, tone: 'var(--chart-2)', track: 'scan-build-satellite',
      title: 'Use site map layer',
      sub: 'Start from a generated site context layer, then trace the building footprint and calibrate before plotting.',
      honest: 'This is not live Google or satellite imagery yet. The canvas labels it as a simulated map layer.',
      onClick: onSatellite,
    },
    {
      id: 'scan', icon: ScanLine, tone: 'var(--success)', track: 'scan-build-camera',
      title: 'Open vision scan demo',
      sub: 'Walk through the scan flow and import generated walls into the canvas for review.',
      honest: 'Camera, AR, and LiDAR capture are not wired in the web app yet. Use the mobile app track for the real capture path.',
      onClick: onScanCamera,
    },
    {
      id: 'draw', icon: PencilLine, tone: 'var(--warning)', track: 'scan-build-draw',
      title: 'Start with a blank canvas',
      sub: 'Sketch walls, rooms, and openings from scratch. Snap to grid is on.',
      onClick: onDrawScratch,
    },
  ];
  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[820px] max-w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, color-mix(in oklab, var(--command-panel-elevated) 94%, white 6%), var(--command-panel))',
          borderColor: 'var(--command-border-strong)',
          color: 'var(--command-fg)',
          boxShadow: '0 28px 70px -28px rgba(0,0,0,0.78)',
        }}
      >
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start gap-3" style={{ borderColor: 'var(--command-border)' }}>
          <div
            className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0"
            style={{
              background: 'color-mix(in oklab, var(--command-accent) 15%, transparent)',
              color: 'var(--command-accent)',
              boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--command-accent) 35%, transparent)',
            }}
          >
            <ScanLine className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--command-fg)' }}>Add a floor plan</div>
            <div className="text-[12px] text-muted-foreground mt-0.5" style={{ color: 'var(--command-muted)' }}>Choose the source for this floor. Scale comes next before devices should be trusted.</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            style={{ color: 'var(--command-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {opts.map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.id}
                onClick={o.onClick}
                data-track={o.track}
                className="text-left group rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-secondary/20 p-4 transition-colors flex flex-col gap-2.5"
                style={{
                  background: 'var(--command-panel-elevated)',
                  borderColor: o.recommended ? 'color-mix(in oklab, var(--command-accent) 45%, var(--command-border))' : 'var(--command-border)',
                  color: 'var(--command-fg)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: `color-mix(in oklab, ${o.tone} 12%, transparent)`,
                      color: o.tone,
                      boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${o.tone} 35%, transparent)`,
                    }}
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.7} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium tracking-tight" style={{ color: 'var(--command-fg)' }}>{o.title}</span>
                      {o.recommended && (
                        <span
                          className="text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-300"
                          style={{ background: 'color-mix(in oklab, var(--command-accent) 16%, transparent)', color: 'var(--command-accent)' }}
                        >
                          Start here
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-[12px] text-muted-foreground leading-relaxed" style={{ color: 'var(--command-muted)' }}>{o.sub}</p>
                {o.honest && (
                  <div
                    className="mt-1 text-[10px] text-amber-300/85 bg-amber-300/10 border border-amber-300/25 rounded px-2 py-1 flex items-start gap-1.5"
                    style={{
                      background: 'color-mix(in oklab, var(--command-warning) 10%, transparent)',
                      borderColor: 'color-mix(in oklab, var(--command-warning) 26%, transparent)',
                      color: 'var(--command-warning)',
                    }}
                  >
                    <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
                    <span className="leading-snug">{o.honest}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div
          className="px-6 py-3 border-t border-border text-[11px] text-muted-foreground flex items-center gap-2"
          style={{ borderColor: 'var(--command-border)', color: 'var(--command-muted)' }}
        >
          <Compass className="w-3 h-3" />
          Use a known feature such as a 3 ft door opening to set scale. Esc closes this picker.
        </div>
      </div>
    </div>
  );
}
