// SimulatedMapBadge — extracted from screens/EngineeringCanvas.tsx.
// Stylised "Simulated map layer" chip the FloorPlan stub modes render
// on top of their satellite / street / hybrid / dark / blank surfaces
// so the operator knows the layer is a render, not a live tile.
//
// Pure SVG, no state. Used inside the canvas viewport so it's an
// <g> rather than a chrome <div>.

export interface SimulatedMapBadgeProps {
  label: string;
  tone?: 'light' | 'dark';
}

export function SimulatedMapBadge({ label, tone = 'light' }: SimulatedMapBadgeProps) {
  const bg = tone === 'dark' ? 'rgba(13,20,36,0.85)' : 'rgba(13,20,36,0.78)';
  const fg = '#F4E07A';
  return (
    <g transform="translate(540, 580)">
      <rect width="170" height="20" rx="10" fill={bg} stroke={fg + '55'} strokeWidth="0.6" />
      <circle cx="11" cy="10" r="3" fill={fg} opacity="0.85" />
      <text x="20" y="14" fill={fg} fontSize="10.5" fontFamily="ui-sans-serif">{label}</text>
    </g>
  );
}

export default SimulatedMapBadge;
