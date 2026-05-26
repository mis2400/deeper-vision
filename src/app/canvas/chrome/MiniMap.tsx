// MiniMap — extracted from screens/EngineeringCanvas.tsx as part of
// the M11 monolith breakup. Small floor-overview navigator that
// appears at the bottom-right of the canvas, defaults to OFF, and
// toggles back when the engineer wants spatial context.
//
// Pure render — no closures on EngineeringCanvas state. Renders a
// scaled-down version of devices + walls + background.

import { CircleDot, EyeOff, Map as MapIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { KIND_TONE, TYPE_KIND } from '../constants';
import type { Device, Wall } from '../types';

export function MiniMap({ devices, walls, background }: {
  devices: Device[];
  walls?: Wall[];
  background?: { x: number; y: number; naturalWidth: number; naturalHeight: number; scale: number } | null;
}) {
  // UX hard-reset: minimap defaults to OFF on the calm canvas. A single
  // eye icon in the bottom-right toggles it back when the engineer wants
  // a viewport overview. (Was visible-by-default, was "OVERVIEW" labelled.)
  const [visible, setVisible] = useState<boolean>(() => {
    try { return localStorage.getItem('canvas:minimap:visible') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('canvas:minimap:visible', visible ? '1' : '0'); } catch {}
  }, [visible]);
  // V1 1A.4 — bounds compute matches the P0.7 canvas auto-fit: union
  // floor background, walls, and devices so the minimap shows the
  // actual plan, not the seed 800x600 default. Theme-safe colors so
  // it reads in light / slate / dark.
  const bounds = useMemo(() => {
    let minX = 80, minY = 80, maxX = 720, maxY = 560;
    if (background) {
      minX = background.x;
      minY = background.y;
      maxX = background.x + background.naturalWidth * background.scale;
      maxY = background.y + background.naturalHeight * background.scale;
    }
    for (const d of devices) {
      if (typeof d.x !== 'number' || typeof d.y !== 'number') continue;
      if (d.x < minX) minX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.x > maxX) maxX = d.x;
      if (d.y > maxY) maxY = d.y;
    }
    for (const w of walls ?? []) {
      const wxL = Math.min(w.x1, w.x2), wxR = Math.max(w.x1, w.x2);
      const wyT = Math.min(w.y1, w.y2), wyB = Math.max(w.y1, w.y2);
      if (wxL < minX) minX = wxL;
      if (wyT < minY) minY = wyT;
      if (wxR > maxX) maxX = wxR;
      if (wyB > maxY) maxY = wyB;
    }
    const pad = 24;
    return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 };
  }, [devices, walls, background]);
  if (!visible) return (
    <button onClick={() => setVisible(true)} title="Show minimap" data-track="canvas-minimap-show" className="absolute bottom-5 right-5 z-20 w-9 h-9 rounded-xl bg-card/85 backdrop-blur-xl border border-border/80 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] hidden md:flex items-center justify-center text-muted-foreground hover:text-foreground">
      <MapIcon className="w-4 h-4" />
    </button>
  );
  return (
    <div className="absolute bottom-5 right-5 z-20 w-[200px] bg-card/90 backdrop-blur-xl border border-border/80 rounded-xl shadow-[var(--shadow-floating)] overflow-hidden hidden md:block">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><CircleDot className="w-3 h-3" />Overview</span>
        <button onClick={() => setVisible(false)} title="Hide minimap" className="hover:text-foreground"><EyeOff className="w-3 h-3" /></button>
      </div>
      <div className="p-2">
        <svg
          viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full rounded-md"
          style={{ height: '150px', background: 'var(--secondary)' }}
        >
          {background && (
            <rect
              x={background.x} y={background.y}
              width={background.naturalWidth * background.scale}
              height={background.naturalHeight * background.scale}
              fill="var(--card)" stroke="var(--border-strong)" strokeWidth={Math.max(2, bounds.w / 240)}
            />
          )}
          {(walls ?? []).map((w) => (
            <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="var(--foreground)" strokeWidth={Math.max(2, bounds.w / 320)} strokeLinecap="round" />
          ))}
          {devices.map((d) => (
            <circle
              key={d.id}
              cx={d.x} cy={d.y}
              r={Math.max(5, bounds.w / 90)}
              fill={KIND_TONE[TYPE_KIND[d.type]]}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

// StatusBar moved to canvas/chrome/StatusBar.tsx as part of M11
// monolith breakup. The import at the top of this file now provides
// the same component.


/* ═══════════════════════════════════════════════════════════════════════
   REPORT EXPORT — premium PDFs generated live from canvas state
   ═══════════════════════════════════════════════════════════════════════
   Each report type is a discrete generator that pulls the right slice of
   project data and writes it to a jsPDF document with consistent branding,
   typography, and section structure. The user clicks once; the file
   downloads. */

type ReportKind =
  | 'engineering' | 'customer' | 'camera-schedule' | 'door-schedule'
  | 'cable-schedule' | 'conduit-schedule' | 'bom' | 'compliance' | 'commissioning';

