// Drawer primitives — extracted from
// screens/EngineeringCanvas.tsx as part of the M11 monolith
// breakup. Three tiny building blocks used across the device /
// pathway inspector tray and many supporting section panels:
//
//   - Row             — label + value pair with theme-aware
//                       contrast and an optional tone for status
//                       values (e.g. green ✓ / amber ⚠ / red ✗).
//   - DrawerSection   — section heading + body wrapper that
//                       keeps the inspector reading like a
//                       configuration page, not a debug HUD.
//   - FindingRow      — coloured "high / warn / ok" status row
//                       used by the suggestion panels.
//
// All three are pure presentational. Refined for editorial
// readability over HUD density: sentence case, no letter
// tracking, calmer weights, more breathing room.

export function Row({ label, value, tone }: { label: string; value: any; tone?: string }) {
  // Theme-aware contrast — the old code hardcoded value to #E7EDF6
  // and the divider to white/[0.04], which read as near-invisible on
  // the light drafting theme's white drawer surface. Both now route
  // through theme tokens so Mount values, PoE numbers, etc. stay
  // readable across all three themes.
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-b-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[12px] tabular-nums font-medium text-foreground" style={tone ? { color: tone } : undefined}>{value}</span>
    </div>
  );
}

export function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-[13px] font-medium text-foreground mb-3 tracking-tight">{title}</div>
      {children}
    </div>
  );
}

export function FindingRow({ severity, text }: { severity: 'high' | 'warn' | 'ok'; text: string }) {
  const tone = severity === 'high' ? '#E55B5B' : severity === 'warn' ? '#E5A23A' : '#4FB87E';
  return (
    <div className="flex items-start gap-2 rounded-md border p-2" style={{ borderColor: `${tone}40`, background: `${tone}10` }}>
      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: tone }} />
      <span className="text-[11px] leading-snug" style={{ color: tone }}>{text}</span>
    </div>
  );
}
