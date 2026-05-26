// CableTypePicker — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. Bottom-centre floating
// pill row that lets the operator pick which cable type the
// next drawn pathway should be. Stacks above the bottom device
// bar so the chips don't overlap the category icons. Pure
// presentational — selected value + setter via props.

import { CABLE_TYPES } from '../constants';
import type { CableTypeId } from '../types';

export function CableTypePicker({ value, onChange }: { value: CableTypeId; onChange: (t: CableTypeId) => void }) {
  return (
    // Item 4 — bottom bar is now at bottom-3; picker stacks above it
    // at bottom-[80px] so the cable type chips don't overlap the
    // category icons.
    <div className="absolute left-1/2 -translate-x-1/2 bottom-[80px] z-20 select-none hidden md:block">
      <div className="bg-card/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)] px-1.5 py-1.5 flex items-center gap-1 max-w-[680px] overflow-x-auto">
        <span className="text-[10px] uppercase tracking-[0.10em] text-muted-foreground px-1.5 shrink-0">Cable</span>
        {CABLE_TYPES.map((c) => {
          const active = c.id === value;
          return (
            <button
              key={c.id}
              onClick={() => onChange(c.id)}
              title={`${c.label} — ${c.note} · $${c.pricePerFt.toFixed(2)}/ft`}
              className={`shrink-0 px-2 h-7 rounded-md text-[11px] transition-colors flex items-center gap-1.5 ${
                active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
              }`}
              style={active ? { boxShadow: `inset 0 0 0 1px ${c.tone}55` } : undefined}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: c.tone }} />
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
