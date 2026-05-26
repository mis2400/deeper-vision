// Cabling and conduit math — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Trade sizes, cable outer diameters, and the conduit
// fill calculation that drives BundleInspectorDialog and the
// pathway inspector readouts. Pure data + pure functions; no
// React or store dependencies.

export const EMT_SIZES: { size: string; areaIn2: number }[] = [
  { size: '1/2"',   areaIn2: 0.304 },
  { size: '3/4"',   areaIn2: 0.533 },
  { size: '1"',     areaIn2: 0.864 },
  { size: '1-1/4"', areaIn2: 1.496 },
  { size: '1-1/2"', areaIn2: 2.036 },
  { size: '2"',     areaIn2: 3.356 },
];

export const CABLE_OD_IN: Record<string, number> = {
  cat5e: 0.21, cat6: 0.24, cat6a: 0.31, fiber: 0.20,
  '18/2': 0.21, '18/4': 0.27, '22/6': 0.32, speaker: 0.24,
  fire: 0.27, coax: 0.27,
};

/**
 * NEC conduit fill calc for a bundle of like cables in one conduit.
 * - 1 cable  → 53% rule
 * - 2 cables → 31% rule (the NEC tighter limit for 2 conductors)
 * - 3+ cables → 40% rule
 *
 * Returns the fill percentage against the rule, whether the conduit
 * passes, and (when not given a size) the smallest standard EMT
 * trade size that would clear the rule. `recommended` is undefined
 * if no listed trade size fits — caller should split the bundle.
 */
export function computeBundleFill(
  count: number,
  cableType: string,
  conduitSize?: string,
): { fillPct: number; rule: number; recommended?: string; passes: boolean; totalAreaIn2: number; conduitAreaIn2?: number } {
  const ct = String(cableType ?? 'cat6a').toLowerCase();
  const od = CABLE_OD_IN[ct] ?? 0.31;
  const totalArea = count * Math.PI * (od / 2) ** 2;
  const rule = count <= 1 ? 0.53 : count === 2 ? 0.31 : 0.40;
  const recommendedRow = EMT_SIZES.find((e) => totalArea / e.areaIn2 <= rule);
  const recommended = recommendedRow?.size;
  if (!conduitSize) {
    return { fillPct: 0, rule, recommended, passes: true, totalAreaIn2: totalArea };
  }
  const row = EMT_SIZES.find((e) => e.size === conduitSize);
  if (!row) return { fillPct: 0, rule, recommended, passes: true, totalAreaIn2: totalArea };
  const fillPct = (totalArea / row.areaIn2) * 100;
  return { fillPct, rule, recommended, passes: fillPct / 100 <= rule, totalAreaIn2: totalArea, conduitAreaIn2: row.areaIn2 };
}
