// AiOptimizeSection — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Camera inspector section with Overview / Prosecution
// sub-modes. Overview shows range + HFOV + coverage area +
// mount height + IR + NDAA chips; Prosecution computes
// px/ft at midrange and grades each forensic capability
// (identification, recognition, LPR, court-ready export)
// against DORI_PX_PER_FT. Both modes feed a static
// "heuristic suggestions" checklist below — labelled as
// static-not-AI to honour the honesty rule.

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { DORI_PX_PER_FT } from '../coverage/dori';
import { cameraResolution } from '../coverage/resolution';
import { DrawerSection, Row } from '../components/DrawerPrimitives';
import type { Device } from '../types';

export function AiOptimizeSection({ d, tone }: { d: Device; tone: string }) {
  const [mode, setMode] = useState<'overview' | 'prosecution'>('overview');
  const rangeFt = d.range ?? (d.type === 'cam.ptz' ? 44 : d.type === 'cam.bullet' ? 50 : 30);
  const fovDeg  = d.fov ?? (d.type === 'cam.ptz' ? 36 : d.type === 'cam.fisheye' ? 360 : 70);
  // Item 8 + Audit Group A.1 — same density chain as the cone bands +
  // probe + Target preview. Replaces the hardcoded `sensorPx = 1920`
  // so this section's "general usefulness" density at half range now
  // agrees with every other density readout in the drawer. Display
  // unit is px/ft (single canvas-wide unit per the audit) and the
  // pass/fail thresholds come from DORI_PX_PER_FT so a future tweak
  // to the IEC table can't drift this surface out of sync.
  const aiResolution = cameraResolution(d);
  const sensorPx = aiResolution?.widthPx ?? 1920;
  const halfFovRad = (fovDeg * Math.PI / 180) / 2;
  const tanHalfFov = Math.tan(halfFovRad);
  const midDistFt = rangeFt * 0.5;
  const pxPerFt = tanHalfFov > 0 ? sensorPx / (2 * midDistFt * tanHalfFov) : Infinity;
  // Threshold for license plate at ~4 m / 13 ft (320 px/m ≈ 97.54 px/ft);
  // not in DORI_PX_PER_FT because LPR isn't a DORI grade — kept local.
  const LPR_PX_PER_FT = 320 / 3.28084;

  return (
    <>
      <DrawerSection title="Optimize">
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setMode('overview')}
            className="flex-1 py-1.5 rounded text-[11px]"
            style={mode === 'overview'
              ? { background: `${tone}1A`, color: '#F8FAFC', boxShadow: `inset 0 0 0 1px ${tone}55` }
              : { color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Overview
          </button>
          <button
            onClick={() => setMode('prosecution')}
            className="flex-1 py-1.5 rounded text-[11px]"
            style={mode === 'prosecution'
              ? { background: `${tone}1A`, color: '#F8FAFC', boxShadow: `inset 0 0 0 1px ${tone}55` }
              : { color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Prosecution
          </button>
        </div>
        {mode === 'overview' ? (
          <>
            <Row label="Range"      value={`${rangeFt} ft`} />
            <Row label="HFOV"       value={`${fovDeg}°`} />
            <Row label="Coverage"   value={`${Math.round((Math.PI * Math.pow(rangeFt, 2) * (fovDeg / 360)))} sq ft`} />
            <Row label="Mount AFF"  value={`${d.mountFt ?? 10} ft`} />
            <Row label="IR"         value={d.ir ? 'Enabled' : 'No IR'} tone={d.ir ? '#34D399' : undefined} />
            <Row label="NDAA"       value={d.ndaa ? 'Compliant' : '—'} tone={d.ndaa ? '#34D399' : undefined} />
          </>
        ) : (
          <>
            <Row label="px/ft @ midrange" value={pxPerFt.toFixed(1)} />
            <Row label="Identification"  value={pxPerFt >= DORI_PX_PER_FT.identify ? 'Yes' : pxPerFt >= DORI_PX_PER_FT.recognize ? 'Marginal' : 'No'} tone={pxPerFt >= DORI_PX_PER_FT.identify ? '#34D399' : pxPerFt >= DORI_PX_PER_FT.recognize ? '#FACC15' : '#F87171'} />
            <Row label="Recognition"     value={pxPerFt >= DORI_PX_PER_FT.recognize ? 'Yes' : 'No'} tone={pxPerFt >= DORI_PX_PER_FT.recognize ? '#34D399' : '#F87171'} />
            <Row label="License plate"   value={d.type === 'cam.lpr' ? 'LPR sensor · yes' : (pxPerFt >= LPR_PX_PER_FT ? 'Yes (≤13 ft)' : 'Marginal')} tone={d.type === 'cam.lpr' ? '#34D399' : (pxPerFt >= LPR_PX_PER_FT ? '#34D399' : '#FACC15')} />
            <Row label="Forensic export" value={pxPerFt >= DORI_PX_PER_FT.identify ? 'Court-ready' : 'Best-effort'} tone={pxPerFt >= DORI_PX_PER_FT.identify ? '#34D399' : '#FACC15'} />
            <Row label="Distance @ ID grade" value={tanHalfFov > 0 ? `${Math.round(sensorPx / (2 * DORI_PX_PER_FT.identify * tanHalfFov))} ft` : '—'} />
          </>
        )}
      </DrawerSection>
      <DrawerSection title={mode === 'overview' ? 'Heuristic suggestions' : 'Heuristic forensic notes'}>
        <div className="text-[10px] uppercase tracking-[0.10em] text-amber-300 mb-1">
          Static checklist · not generated by AI
        </div>
        {(mode === 'overview'
          ? [
            'Rotate ±12° to remove blind spot at corner',
            'Drop mount height to 8 ft for tighter face area',
            'Move 4 ft toward entry to widen coverage of approach',
            'Enable IR for 24/7 starlight performance',
          ]
          : [
            'Step focal to 6.0 mm to push ID-grade pixels at door',
            'Add a second camera at 30° offset for face cross-shot',
            'Switch to 4K sensor (currently 1080p) for plate at 30 ft',
            'Lower mount to 7 ft for prosecution-grade face capture',
          ]
        ).map((s, i) => (
          // Static checklist row. Was a disabled button which violated
          // the "no disabled controls with disclaimer text" rule from
          // CLAUDE.md; rendered as a plain list instead.
          <div key={i} className="w-full text-left text-[11px] text-foreground px-2 py-1.5 mb-1 rounded border border-white/10">
            <Sparkles className="w-3 h-3 inline mr-1.5" style={{ color: tone }} />{s}
          </div>
        ))}
      </DrawerSection>
      {/* The previous "Analytics" block claimed live telemetry — face
          recognition, LPR, object detection, edge-GPU load — that the
          canvas does not have. Removed entirely; analytics belong on a
          live connector, not in a static drawer card. */}
    </>
  );
}
