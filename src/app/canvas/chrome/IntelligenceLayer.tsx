// IntelligenceLayer — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Renders the floating intelligence overlay: the
// per-issue chips that land on top of the canvas at each
// finding's coordinate, and the legacy Engineering Assistant
// side panel docked bottom-left.
//
// Vestigial props: setOpen / setZoom / onFit / onActual were
// wired to the old IntelligenceRail render path that M4
// retired (those controls moved into LeftRail). They stay in
// the prop type because the parent's call site still hands
// them in — removing them is out of scope for this monolith
// pass. Same with `panelOpen` local state: nothing currently
// flips it true, but the conditional render path stays so
// future panel-opener wiring can land without re-introducing
// the JSX.

import { Activity, Check, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { computeIntelIssues, type IntelIssue } from '../intelligence';
import type { Device } from '../types';

export function IntelligenceLayer({ devices, pxToFt, zoom, open, setOpen, setZoom, onFit, onActual }: { devices: Device[]; pxToFt: number; zoom: number; open: boolean; setOpen: (b: boolean) => void; setZoom: (z: number) => void; onFit: () => void; onActual: () => void }) {
  void setOpen; void setZoom; void onFit; void onActual;
  const issues = useMemo(() => computeIntelIssues(devices, pxToFt), [devices, pxToFt]);
  const _summary = useMemo(() => {
    const by: Record<string, number> = {};
    issues.forEach((i) => { by[i.severity] = (by[i.severity] ?? 0) + 1; });
    return by;
  }, [issues]);
  void _summary;
  /** Active "AI Assistant" side-panel state. The pill in the top-right both
   *  toggles inline canvas chips (compact mode, default) and opens the
   *  full assistant panel for an expanded engineering review. */
  const [panelOpen, setPanelOpen] = useState(false);
  // Item 3 — the right rail is now always visible because it carries
  // the zoom controls (previously bottom-left ZoomDock). The
  // on-canvas intelligence chips + the assistant panel still gate
  // on `open`; only the rail itself renders unconditionally.
  const toneFor = (k: IntelIssue['kind']) =>
    k === 'overlap' ? '#F59E0B'
    : k === 'blindspot' ? '#FB7185'
    : k === 'poe' ? '#7CC2FF'
    : k === 'low-light' ? '#A78BFA'
    : k === 'storage' ? '#3FB950'
    : k === 'ada' ? '#A78BFA'
    : k === 'permit' ? '#E5B23A'
    : k === 'compliance' ? '#E5484D'
    : k === 'cabling' ? '#22D3EE'
    : '#34D399';
  const sevDot = (s: IntelIssue['severity']) => s === 'high' ? '#F87171' : s === 'warn' ? '#FACC15' : '#7CC2FF';
  return (
    <>
      {/* canvas chips */}
      {open && issues.map((iss) => (
        <div
          key={iss.id}
          className="absolute z-20 pointer-events-auto select-none"
          style={{ left: iss.x * zoom, top: iss.y * zoom, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[10px] whitespace-nowrap"
            style={{
              background: 'rgba(8,12,20,0.82)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${toneFor(iss.kind)}55`,
              boxShadow: `0 6px 14px -6px rgba(0,0,0,0.6), 0 0 0 1px ${toneFor(iss.kind)}22`,
              color: '#E2E8F0',
            }}
            title={iss.detail}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sevDot(iss.severity), animation: 'glow-breathe 2.4s ease-in-out infinite' }} />
            <span className="font-medium tracking-wide">{iss.label}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{iss.detail}</span>
          </div>
        </div>
      ))}

      {/* M4 — IntelligenceRail render removed. The zoom controls,
          chips toggle, and view layers it carried are merged into the
          unified LeftRail (canvas/chrome/LeftRail.tsx). The intel
          chips overlay above this comment still renders unconditionally
          when `open` is true. */}

      {/* AI Assistant side panel — embedded on the right of the canvas.
          Lists every issue with severity, location, and suggestion.
          Clicking a row scrolls the canvas viewport to that issue's
          coordinates. Not a chatbot — this is an engineering review
          that updates the moment the canvas changes. */}
      {panelOpen && (
        <div
          /* Group C.5 — assistant panel now opens from the BOTTOM-LEFT
             where the new intel rail lives, instead of the cleared
             right side. Bottom anchor keeps the panel docked to the
             button that opened it; max-height keeps it from
             overlapping the top chrome on short viewports. */
          className="absolute bottom-3 left-[64px] z-30 w-[320px] max-h-[calc(100vh-180px)] overflow-hidden flex flex-col rounded-xl"
          style={{
            background: 'var(--popover)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(82,146,220,0.30)',
            boxShadow: '0 22px 48px -16px rgba(0,0,0,0.75), 0 0 0 1px rgba(82,146,220,0.08)',
          }}
        >
          <div className="px-3.5 py-2.5 border-b border-white/8 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-300" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-foreground tracking-tight">Engineering assistant</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Live findings from your canvas · {issues.length || 'none'}
              </div>
            </div>
            <button onClick={() => setPanelOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-auto flex-1">
            {issues.length === 0 ? (
              <div className="px-4 py-8 text-center text-[11px] text-emerald-300/80">
                <Check className="w-4 h-4 mx-auto mb-2 text-emerald-300" />
                No issues detected. The design passes basic engineering checks.
              </div>
            ) : (
              issues
                .slice()
                .sort((a, b) => {
                  const order = { high: 0, warn: 1, info: 2 } as const;
                  return order[a.severity] - order[b.severity];
                })
                .map((iss) => (
                  <div
                    key={iss.id}
                    className="px-3.5 py-2.5 border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: sevDot(iss.severity), boxShadow: `0 0 6px ${sevDot(iss.severity)}80` }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium text-foreground tracking-tight">{iss.label}</span>
                          <span
                            className="text-[9px] uppercase tracking-[0.10em] px-1 rounded"
                            style={{ background: `${toneFor(iss.kind)}1f`, color: toneFor(iss.kind) }}
                          >
                            {iss.kind}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground/90 mt-0.5 leading-snug">{iss.detail}</div>
                        {iss.suggestion && (
                          <div className="text-[10px] text-muted-foreground mt-1.5 leading-snug border-l-2 border-sky-400/30 pl-2 italic">
                            {iss.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
          <div className="px-3.5 py-2 border-t border-white/8 text-[9.5px] text-muted-foreground leading-relaxed flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Updates as you edit the canvas. Heuristics, not legal advice.
          </div>
        </div>
      )}
    </>
  );
}
