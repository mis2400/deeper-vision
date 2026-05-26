// Camera resolution helpers — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup.
//
// RESOLUTION_LABEL_TO_PX maps the catalog's resolution string ("4K",
// "1080p", etc) to actual pixel dimensions. RESOLUTION_PRESETS is the
// drawer-row picker list, with shared-pixel labels collapsed into one
// chip plus aliases. cameraResolution resolves a device's effective
// resolution (per-device override > catalog > null).

import { CATALOG } from '../catalog';
import type { Device } from '../types';

export const RESOLUTION_LABEL_TO_PX: Record<string, { widthPx: number; heightPx: number }> = {
  '720p':  { widthPx: 1280, heightPx:  720 },
  '1080p': { widthPx: 1920, heightPx: 1080 },
  '2MP':   { widthPx: 1920, heightPx: 1080 },
  '4MP':   { widthPx: 2592, heightPx: 1520 },
  '5MP':   { widthPx: 2880, heightPx: 1620 },
  '6MP':   { widthPx: 3072, heightPx: 1728 },
  '8MP':   { widthPx: 3840, heightPx: 2160 },
  '4K':    { widthPx: 3840, heightPx: 2160 },
  '12MP':  { widthPx: 4000, heightPx: 3000 },
  '8K':    { widthPx: 7680, heightPx: 4320 },
};

/** Unique resolution presets surfaced in the drawer, derived from the
 *  RESOLUTION_LABEL_TO_PX map. Labels sharing the same pixel signature
 *  (1080p / 2MP and 4K / 8MP) collapse into one chip with the merged
 *  label so picking 4K can't visually highlight 8MP (or vice versa). */
export const RESOLUTION_PRESETS: { label: string; widthPx: number; heightPx: number }[] = (() => {
  const preferred = ['720p', '1080p', '4MP', '5MP', '6MP', '4K', '12MP', '8K'];
  return preferred.map((label) => {
    const px = RESOLUTION_LABEL_TO_PX[label];
    const aliases = Object.entries(RESOLUTION_LABEL_TO_PX)
      .filter(([l, p]) => l !== label && p.widthPx === px.widthPx && p.heightPx === px.heightPx)
      .map(([l]) => l);
    return {
      label: aliases.length ? `${label} · ${aliases.join(' · ')}` : label,
      widthPx: px.widthPx,
      heightPx: px.heightPx,
    };
  });
})();

/** Effective resolution for a single-lens camera. Precedence:
 *   1. Per-device override (`d.resolution`) — set from the drawer.
 *   2. Catalog product's `resolution` label, mapped via
 *      RESOLUTION_LABEL_TO_PX.
 *   3. null — no honest source; caller skips DORI bands and shows a hint.
 *  Returns null for multisensor / fisheye intentionally (they don't use
 *  single-cone DORI math). */
export function cameraResolution(d: Device): { widthPx: number; heightPx: number } | null {
  if (d.type === 'cam.multisensor' || d.type === 'cam.fisheye') return null;
  // The Device shape in canvas/types doesn't carry a resolution field
  // yet (lives on the store-side device); cast to access it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dd = d as any;
  if (dd.resolution && dd.resolution.widthPx > 0 && dd.resolution.heightPx > 0) {
    return dd.resolution;
  }
  const cat = CATALOG.find((p) => p.id === d.product);
  if (cat?.resolution) {
    const mapped = RESOLUTION_LABEL_TO_PX[cat.resolution];
    if (mapped) return mapped;
  }
  return null;
}
