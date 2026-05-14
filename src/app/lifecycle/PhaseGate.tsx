// Soft phase-gate banner. Renders a warning when the user lands on a screen
// that prerequisite data hasn't been built up to yet — without blocking them.
// Lives at the top of /estimate/:id, /portal/:id, /commission/:id, etc.

import { useNavigate } from 'react-router';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';

export interface PhaseGateBannerProps {
  /** Sentence shown to the user (e.g. "No devices have been engineered yet."). */
  reason: string;
  /** Action label + href for the recommended next step. */
  action?: { label: string; href: string };
  /** Optional tone override. Default 'warning'. */
  tone?: 'warning' | 'info';
}

export function PhaseGateBanner({ reason, action, tone = 'warning' }: PhaseGateBannerProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const toneCls = tone === 'warning'
    ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
    : 'bg-primary/10 border-primary/40 text-primary';

  return (
    <div className={`mx-auto max-w-[1400px] px-6 pt-4`}>
      <div className={`rounded-lg border px-4 py-2.5 flex items-center gap-3 ${toneCls}`}>
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <div className="flex-1 text-sm leading-tight">{reason}</div>
        {action && (
          <button
            onClick={() => navigate(action.href)}
            className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-current hover:bg-white/5 transition-colors"
          >
            {action.label}
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="opacity-60 hover:opacity-100 transition-opacity"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
