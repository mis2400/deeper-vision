/* ─────────────────────────────────────────────────────────────────────
   DEEPER VISION — shared UI primitives
   ─────────────────────────────────────────────────────────────────────
   Small, theme-aware building blocks that every core screen
   (Dashboard / Project Center / Canvas / Catalog / Estimate / Report
   Builder) draws from so the platform reads as one product. Tokens
   come from `src/styles/theme.css`. Variants are intentionally narrow
   — the goal is "fewer choices, sharper choices."
   ─────────────────────────────────────────────────────────────────── */

import * as React from 'react';
import { cn } from './utils';

// ── DvButton ──────────────────────────────────────────────────────────

type DvButtonVariant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'destructive';
type DvButtonSize    = 'sm' | 'md' | 'lg';

const BTN_BASE = 'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed';

const BTN_VARIANT: Record<DvButtonVariant, string> = {
  primary:     'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 focus-visible:ring-[var(--primary)]/45 shadow-[var(--shadow-low)]',
  secondary:   'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--muted)] border border-[var(--border)] focus-visible:ring-[var(--primary)]/35',
  subtle:      'bg-transparent text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--secondary)]/40 focus-visible:ring-[var(--primary)]/30',
  ghost:       'bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40 hover:text-[var(--foreground)] focus-visible:ring-[var(--primary)]/25',
  destructive: 'bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90 focus-visible:ring-[var(--destructive)]/40 shadow-[var(--shadow-low)]',
};

const BTN_SIZE: Record<DvButtonSize, string> = {
  sm: 'h-7  px-2.5 text-[12px]   rounded-md',
  md: 'h-9  px-3.5 text-[13px]   rounded-lg',
  lg: 'h-11 px-4.5 text-[14px]   rounded-lg',
};

export const DvButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: DvButtonVariant;
    size?: DvButtonSize;
    icon?: React.ReactNode;
    iconRight?: React.ReactNode;
  }
>(function DvButton({ variant = 'primary', size = 'md', icon, iconRight, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className)}
      style={{ transitionDuration: 'var(--motion-fast)' }}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
});

// ── DvIconButton ──────────────────────────────────────────────────────

export const DvIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: DvButtonVariant;
    size?: DvButtonSize;
  }
>(function DvIconButton({ variant = 'subtle', size = 'md', className, children, ...rest }, ref) {
  const sz = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  return (
    <button
      ref={ref}
      {...rest}
      className={cn(BTN_BASE, BTN_VARIANT[variant], sz, 'rounded-lg p-0', className)}
      style={{ transitionDuration: 'var(--motion-fast)' }}
    >
      {children}
    </button>
  );
});

// ── DvCard ────────────────────────────────────────────────────────────

export function DvCard({
  className,
  interactive,
  padding = 'md',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}) {
  const pad =
    padding === 'none' ? '' :
    padding === 'sm'   ? 'p-3' :
    padding === 'lg'   ? 'p-6' :
    'p-4';
  return (
    <div
      {...rest}
      className={cn(
        'rounded-xl border bg-[var(--card)] text-[var(--card-foreground)]',
        'border-[var(--border)] shadow-[var(--shadow-low)]',
        interactive && 'transition-all cursor-pointer hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-medium)] hover:-translate-y-[1px]',
        pad,
        className,
      )}
      style={{ transitionDuration: 'var(--motion-standard)', ...(rest.style ?? {}) }}
    >
      {children}
    </div>
  );
}

// ── DvPill ────────────────────────────────────────────────────────────

type DvPillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const PILL_TONE: Record<DvPillTone, string> = {
  neutral: 'bg-[var(--secondary)]/40 text-[var(--muted-foreground)] border-[var(--border)]/60',
  info:    'bg-[var(--primary)]/12  text-[var(--primary)]          border-[var(--primary)]/30',
  success: 'bg-[var(--success)]/14  text-[var(--success)]          border-[var(--success)]/30',
  warning: 'bg-[var(--warning)]/14  text-[var(--warning)]          border-[var(--warning)]/30',
  danger:  'bg-[var(--destructive)]/14 text-[var(--destructive)]   border-[var(--destructive)]/30',
};

export function DvPill({
  tone = 'neutral',
  className,
  dot,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: DvPillTone; dot?: boolean }) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10.5px] font-medium uppercase tracking-[0.10em]',
        PILL_TONE[tone],
        className,
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// ── DvBadge — non-pill counters / hints (no border, looser tone) ──────

export function DvBadge({
  tone = 'neutral',
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: DvPillTone }) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 rounded text-[10.5px] tabular-nums',
        PILL_TONE[tone].replace(/border-[^\s]+/g, ''),
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── DvStatusDot ───────────────────────────────────────────────────────

export function DvStatusDot({
  tone = 'neutral',
  size = 8,
  pulse,
  className,
  style,
}: {
  tone?: DvPillTone;
  size?: number;
  pulse?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const color =
    tone === 'success' ? 'var(--success)' :
    tone === 'warning' ? 'var(--warning)' :
    tone === 'danger'  ? 'var(--destructive)' :
    tone === 'info'    ? 'var(--primary)' :
    'var(--muted-foreground)';
  return (
    <span
      className={cn('inline-block rounded-full shrink-0', pulse && 'animate-pulse', className)}
      style={{ width: size, height: size, background: color, boxShadow: pulse ? `0 0 8px ${color}` : undefined, ...style }}
    />
  );
}

// ── DvEmptyState ──────────────────────────────────────────────────────

export function DvEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-10 px-6', className)}>
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-[var(--secondary)]/40 text-[var(--muted-foreground)] flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <div className="text-[14px] font-medium tracking-tight text-[var(--foreground)]">{title}</div>
      {description && <div className="mt-1.5 text-[12px] text-[var(--muted-foreground)] max-w-[44ch] leading-relaxed">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── IntegrationCard — text-mark logos for connected services ──────────

type IntegrationStatus = 'connected' | 'available' | 'attention' | 'syncing';

export function IntegrationCard({
  mark,
  markColor,
  name,
  category,
  status,
  lastSync,
  objectCount,
  onAction,
  className,
}: {
  /** Short text mark — e.g. "VK" for Verkada, "HS" for HubSpot. */
  mark: string;
  markColor: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  lastSync?: string;
  objectCount?: string;
  onAction?: () => void;
  className?: string;
}) {
  const statusLabel: Record<IntegrationStatus, { label: string; tone: DvPillTone }> = {
    connected: { label: 'Connected', tone: 'success' },
    available: { label: 'Available', tone: 'neutral' },
    attention: { label: 'Attention', tone: 'warning' },
    syncing:   { label: 'Syncing',   tone: 'info' },
  };
  const s = statusLabel[status];
  const isConnected = status === 'connected' || status === 'syncing' || status === 'attention';
  return (
    <DvCard className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[13px] font-semibold tracking-tight"
          style={{
            background: `${markColor}1A`,
            color: markColor,
            boxShadow: `inset 0 0 0 1px ${markColor}40`,
          }}
        >
          {mark}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium tracking-tight text-[var(--foreground)] truncate">{name}</div>
          <div className="text-[11px] text-[var(--muted-foreground)] truncate">{category}</div>
        </div>
        <DvPill tone={s.tone} dot>{s.label}</DvPill>
      </div>
      {isConnected && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]/60">
          <div>
            <div className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Last sync</div>
            <div className="text-[12px] tabular-nums text-[var(--foreground)] mt-0.5">{lastSync ?? '—'}</div>
          </div>
          <div>
            <div className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Synced</div>
            <div className="text-[12px] tabular-nums text-[var(--foreground)] mt-0.5">{objectCount ?? '—'}</div>
          </div>
        </div>
      )}
      <div className="pt-1">
        <DvButton
          variant={isConnected ? 'subtle' : 'primary'}
          size="sm"
          onClick={onAction}
          className="w-full"
          data-track={`integration-${name.toLowerCase().replace(/\s+/g, '-')}-action`}
        >
          {isConnected ? 'Manage' : 'Connect'}
        </DvButton>
      </div>
    </DvCard>
  );
}
