// Canvas intelligence — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. The signal-extraction layer
// that powers both the on-canvas intelligence chips AND the
// embedded AI Assistant panel AND the Compliance section of the
// PDF report cluster. Pure: feeds on devices + pxToFt, returns
// IntelIssue records — no React, no store calls.

import { TYPE_KIND } from './constants';
import type { Device } from './types';

export interface IntelIssue {
  id: string;
  kind: 'overlap' | 'blindspot' | 'poe' | 'low-light' | 'nec' | 'storage' | 'ada' | 'permit' | 'compliance' | 'cabling';
  severity: 'info' | 'warn' | 'high';
  x: number;
  y: number;
  label: string;
  detail: string;
  /** Optional suggestion the AI assistant prints below the headline. */
  suggestion?: string;
}

/** Real-time engineering intelligence — pulls signals from the canvas state
 *  and surfaces actionable findings. This is the substrate that drives both
 *  the on-canvas chips AND the embedded AI Assistant panel.
 *
 *  SC.7.1: takes the per-floor pixel-to-foot scale so the physical-distance
 *  checks (cable run > 90m, etc.) use real feet on calibrated floors. Falls
 *  back to the canvas default (0.05 ft/px) when the floor is uncalibrated. */
export function computeIntelIssues(devices: Device[], pxToFt: number): IntelIssue[] {
  const cams = devices.filter((d) => TYPE_KIND[d.type] === 'camera');
  const access = devices.filter((d) => TYPE_KIND[d.type] === 'access');
  const idfs = devices.filter((d) => d.type === 'net.idf' || d.type === 'net.switch');
  const maglocks = devices.filter((d) => d.type === 'acc.maglock');
  const out: IntelIssue[] = [];

  // ── 1. Coverage overlap (two cameras within 80px) ──
  for (let i = 0; i < cams.length; i++) {
    for (let j = i + 1; j < cams.length; j++) {
      const a = cams[i], b = cams[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 80) {
        out.push({
          id: `ov-${a.id}-${b.id}`,
          kind: 'overlap',
          severity: dist < 50 ? 'high' : 'warn',
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          label: 'Coverage overlap',
          detail: `${a.id} ↔ ${b.id} · ${Math.round((1 - dist / 110) * 100)}% redundant`,
          suggestion: 'Re-aim one camera or drop the second — overlap rarely buys redundancy worth the PoE budget.',
        });
      }
    }
  }

  // ── 2. PoE budget pressure ──
  // Average PoE-class draw 12W per camera. If we exceed 360W (most 48-port
  // PoE+ switches' budget), warn. If we exceed 720W (PoE++), error.
  if (cams.length > 0 && idfs.length === 0) {
    out.push({
      id: 'poe-no-idf',
      kind: 'poe',
      severity: 'warn',
      x: cams[0].x, y: cams[0].y - 24,
      label: 'No IDF placed',
      detail: `${cams.length} camera${cams.length === 1 ? '' : 's'} on canvas with no IDF/MDF — switch needed.`,
      suggestion: 'Drop an IDF / network rack from the Network category, then re-home each camera to its closest IDF.',
    });
  } else if (cams.length >= 6) {
    const cx = cams.reduce((s, c) => s + c.x, 0) / cams.length;
    const cy = cams.reduce((s, c) => s + c.y, 0) / cams.length;
    const estW = cams.length * 12;
    out.push({
      id: 'poe-load',
      kind: 'poe',
      severity: estW > 720 ? 'high' : estW > 360 ? 'warn' : 'info',
      x: cx, y: cy,
      label: 'PoE budget',
      detail: `${cams.length} cameras · est. ${estW}W (${estW > 720 ? 'requires PoE++' : estW > 360 ? 'within PoE+ budget' : 'comfortable'}).`,
      suggestion: estW > 720
        ? 'Spread across two PoE++ switches, or move PTZ/multisensor loads to PoE injectors.'
        : 'Stay within ~80% of the switch budget. Reserve headroom for IR LEDs and heater elements outdoors.',
    });
  }

  // ── 3. NVR storage estimate ──
  // 6 Mbps avg bitrate * 24h * 30 days * cameras / 8000 = TB needed
  if (cams.length >= 4) {
    const tb = Math.round((cams.length * 6 * 86400 * 30) / 8e9 * 10) / 10;
    const nvrs = devices.filter((d) => d.type === 'sto.nvr' || d.type === 'sto.server' || d.type === 'sto.cloud').length;
    if (nvrs === 0) {
      out.push({
        id: 'storage-missing',
        kind: 'storage',
        severity: 'warn',
        x: cams[0].x + 60, y: cams[0].y + 60,
        label: 'No NVR placed',
        detail: `${cams.length} cameras · ~${tb} TB for 30-day retention.`,
        suggestion: 'Drop a Recording & Storage device. NVRs ship in 16-, 32-, 64-channel SKUs.',
      });
    }
  }

  // ── 4. Maglock → REX compliance ──
  for (const m of maglocks) {
    const hasRex = access.some((a) =>
      (a.type === 'acc.exit' || a.type === 'acc.dps' || a.type === 'acc.panic-bar')
      && Math.hypot(a.x - m.x, a.y - m.y) < 70,
    );
    if (!hasRex) {
      out.push({
        id: `code-rex-${m.id}`,
        kind: 'compliance',
        severity: 'high',
        x: m.x, y: m.y + 22,
        label: 'Maglock without REX',
        detail: `${m.id} requires a REX (request-to-exit) for fire-egress compliance.`,
        suggestion: 'Drop a REX or panic bar adjacent to this maglock — required by IBC 1010.1.9.7.',
      });
    }
  }

  // ── 5. Blind spot heuristic on bullet cameras aimed away from cluster ──
  cams.forEach((c) => {
    if (c.type === 'cam.bullet' && Math.abs(c.rot) > 150) {
      out.push({
        id: `bs-${c.id}`,
        kind: 'blindspot',
        severity: 'info',
        x: c.x - 22, y: c.y - 18,
        label: 'Possible blind spot',
        detail: `${c.id} aimed away from entry path.`,
        suggestion: 'Confirm this camera covers an actual approach. Re-aim toward the door / sidewalk if not.',
      });
    }
  });

  // ── 6. Cable distance over Cat6 spec (~90m / 295ft) ──
  // SC.7.1: convert each candidate distance to feet via the calibrated
  // scale, then compare against the actual 295 ft threshold. The prior
  // version compared raw pixels (600 px) and divided by 3.83 px/ft for
  // the detail string, which mis-fired on every calibrated background.
  if (idfs.length > 0) {
    for (const c of cams) {
      let minPx = Infinity;
      for (const i of idfs) minPx = Math.min(minPx, Math.hypot(c.x - i.x, c.y - i.y));
      const minFt = minPx * pxToFt;
      if (minFt > 295) {
        out.push({
          id: `cab-${c.id}`,
          kind: 'cabling',
          severity: 'warn',
          x: c.x + 18, y: c.y - 18,
          label: 'Cable run exceeds 90m',
          detail: `${c.id} is ~${Math.round(minFt)} ft from nearest IDF.`,
          suggestion: 'Add a midspan PoE injector at 70m, switch to fiber, or place a closer IDF.',
        });
      }
    }
  }

  // ── 7. ADA reach on readers ──
  // Readers labeled with z-axis height above 48" don't get one yet (no schema
  // for height). Instead flag readers with no linked door — a different ADA
  // signal (path-of-travel) but useful: "where does this go?"
  for (const r of access.filter((d) => d.type === 'acc.reader')) {
    if (!r.linkedIds?.length) {
      out.push({
        id: `ada-${r.id}`,
        kind: 'ada',
        severity: 'info',
        x: r.x, y: r.y + 22,
        label: 'Reader unlinked',
        detail: `${r.id} is not linked to a door — confirm mount height ≤ 48\".`,
        suggestion: 'Drag this reader onto a door, or open Inspector → Link to specify the host.',
      });
    }
  }

  // ── 8. Pole-mount permit hint (when an LPR or PTZ has been placed near
  //     the canvas edge — proxy for "perimeter" / "outdoors") ──
  for (const c of cams) {
    if ((c.type === 'cam.ptz' || c.type === 'cam.lpr') && (c.x < 80 || c.x > 720 || c.y < 80 || c.y > 520)) {
      out.push({
        id: `permit-${c.id}`,
        kind: 'permit',
        severity: 'info',
        x: c.x, y: c.y + 28,
        label: 'Pole mount likely',
        detail: `${c.id} placed at perimeter — pole / parapet mount may require a building permit.`,
        suggestion: 'Confirm with local AHJ before bidding. Pasadena / LA County typically require it for >10ft poles.',
      });
    }
  }

  return out;
}
