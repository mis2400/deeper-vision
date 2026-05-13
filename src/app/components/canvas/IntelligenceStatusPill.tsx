import { useMemo } from 'react';
import { AlertTriangle, Zap, EyeOff, Network, Flame, ShieldAlert, Activity } from 'lucide-react';

export interface IntelligenceIssue {
  id: string;
  kind: 'overlap' | 'blind' | 'poe' | 'nec' | 'thermal' | 'lowlight' | 'congestion';
  severity: 'info' | 'warn' | 'crit';
  label: string;
  targetId?: string;
}

interface Props {
  issues: IntelligenceIssue[];
  onJump?: (issue: IntelligenceIssue) => void;
}

const KIND_META: Record<IntelligenceIssue['kind'], { icon: any; label: string; tone: string }> = {
  overlap:    { icon: Activity,      label: 'Overlap',    tone: 'text-blue-300'   },
  blind:      { icon: EyeOff,        label: 'Blind',      tone: 'text-rose-300'   },
  poe:        { icon: Zap,           label: 'PoE',        tone: 'text-amber-300'  },
  nec:        { icon: AlertTriangle, label: 'NEC',        tone: 'text-amber-300'  },
  thermal:    { icon: Flame,         label: 'Thermal',    tone: 'text-orange-300' },
  lowlight:   { icon: ShieldAlert,   label: 'Low-light',  tone: 'text-purple-300' },
  congestion: { icon: Network,       label: 'Congestion', tone: 'text-cyan-300'   },
};

export function IntelligenceStatusPill({ issues, onJump }: Props) {
  const grouped = useMemo(() => {
    const m = new Map<IntelligenceIssue['kind'], IntelligenceIssue[]>();
    for (const i of issues) {
      const arr = m.get(i.kind) ?? [];
      arr.push(i);
      m.set(i.kind, arr);
    }
    return m;
  }, [issues]);

  const crit = issues.filter((i) => i.severity === 'crit').length;
  const warn = issues.filter((i) => i.severity === 'warn').length;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <div className="group bg-[var(--panel-background)]/90 backdrop-blur-2xl border border-primary/30 rounded-full shadow-2xl pl-3 pr-2 py-1.5 flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <span className="relative inline-flex w-1.5 h-1.5">
            <span className={`absolute inset-0 rounded-full ${crit ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'} opacity-60`} />
            <span className={`relative inline-flex w-1.5 h-1.5 rounded-full ${crit ? 'bg-rose-500' : warn ? 'bg-amber-400' : 'bg-emerald-500'}`} />
          </span>
          <span className="text-[9px] uppercase tracking-[0.22em] text-primary">Intelligence</span>
        </div>
        <div className="h-4 w-px bg-border/60" />
        <div className="flex items-center gap-1">
          {Array.from(grouped.entries()).map(([kind, arr]) => {
            const meta = KIND_META[kind];
            const Icon = meta.icon;
            const first = arr[0];
            return (
              <button
                key={kind}
                onClick={() => first && onJump?.(first)}
                title={`${arr.length} ${meta.label}${arr.length === 1 ? '' : 's'} — click to jump`}
                className="group/btn flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-secondary/60 transition-colors"
              >
                <Icon className={`w-3 h-3 ${meta.tone}`} />
                <span className="text-[10px] tabular-nums text-foreground">{arr.length}</span>
              </button>
            );
          })}
          {issues.length === 0 && (
            <span className="text-[10px] text-emerald-300/80 tracking-wide px-1">All clear</span>
          )}
        </div>
      </div>
    </div>
  );
}
