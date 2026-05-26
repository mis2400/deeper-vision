// CoverageStatsPanel — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. Small chrome panel pinned
// top-right that summarises grid coverage (covered cells, area,
// gap, and a breakdown by device-kind group). Pure presentational
// — takes a precomputed `grid` summary and renders. Hex colours
// in the `groups` table are domain data (device-kind tones), not
// chrome — same pattern as KIND_TONE in the monolith.

export function CoverageStatsPanel({ grid }: {
  grid: {
    coveredCount: number;
    totalCount: number;
    coveragePct: number;
    totalAreaFt: number;
    coveredAreaFt: number;
    gapAreaFt: number;
    areaByGroupFt: Record<string, number>;
  };
}) {
  const fmtFt2 = (n: number) => `${Math.round(n).toLocaleString()} ft²`;
  const pct = Math.round(grid.coveragePct * 100);
  const tone = pct >= 85 ? 'text-success' : pct >= 60 ? 'text-amber-400' : 'text-destructive';
  const groups: Array<{ id: string; label: string; tone: string }> = [
    { id: 'camera',  label: 'Cameras',  tone: '#2F81F7' },
    { id: 'access',  label: 'Access',   tone: '#3FB950' },
    { id: 'sensor',  label: 'Sensors',  tone: '#F08F3C' },
    { id: 'audio',   label: 'Audio',    tone: '#A371F7' },
    { id: 'network', label: 'Network',  tone: '#22D3EE' },
  ];
  return (
    <div className="absolute top-16 right-3 z-30 w-[240px] bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-md p-3 text-[12px]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Coverage</div>
        <div className={`tabular-nums font-medium ${tone}`}>{pct}%</div>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
        <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between"><span className="text-muted-foreground">Floor area</span><span className="tabular-nums">{fmtFt2(grid.totalAreaFt)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Covered</span><span className="tabular-nums text-success">{fmtFt2(grid.coveredAreaFt)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Gap</span><span className="tabular-nums text-destructive">{fmtFt2(grid.gapAreaFt)}</span></div>
        <div className="flex justify-between text-[10px] text-muted-foreground/80"><span>Grid cells</span><span className="tabular-nums">{grid.coveredCount} / {grid.totalCount}</span></div>
      </div>
      <div className="border-t border-border mt-2.5 pt-2 space-y-1 text-[11px]">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">By kind</div>
        {groups.map((g) => {
          const a = grid.areaByGroupFt[g.id] ?? 0;
          if (a < 1) return null;
          const p = grid.totalAreaFt > 0 ? Math.round((a / grid.totalAreaFt) * 100) : 0;
          return (
            <div key={g.id} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: g.tone }} />
              <span className="flex-1 text-muted-foreground">{g.label}</span>
              <span className="tabular-nums text-foreground">{fmtFt2(a)}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">{p}%</span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border mt-2.5 pt-1.5 text-[10px] text-muted-foreground">
        Live · recomputes on every device move.
      </div>
    </div>
  );
}
