type Variant = 'full' | 'compact' | 'mono';
type Theme = 'dark' | 'light' | 'auto';

interface Props {
  variant?: Variant;
  theme?: Theme;
  height?: number;
  className?: string;
  withTagline?: boolean;
  onClick?: () => void;
  title?: string;
}

/**
 * Deeper Vision brand — transparent SVG, theme-aware.
 *
 * compact: scan-stack emblem (favicon / tight headers)
 * full:    emblem + "DEEPER VISION" wordmark, VISION in accent
 * mono:    same wordmark, single ink color (PDF stamps, watermarks)
 */
export function BrandLogo({
  variant = 'full',
  theme = 'dark',
  height = 32,
  className = '',
  withTagline = false,
  onClick,
  title,
}: Props) {
  const dark = theme === 'dark';
  const ink = dark ? '#F1F5F9' : '#0B1B33';
  const accent = dark ? '#3B82F6' : '#1E3A8A';
  const dim = dark ? 'rgba(241,245,249,0.55)' : 'rgba(11,27,51,0.55)';

  if (variant === 'compact') {
    const size = height;
    return (
      <div
        className={`inline-flex items-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{ height: size }}
        onClick={onClick}
        title={title}
      >
        <svg width={size} height={size} viewBox="0 0 44 44" aria-label="Deeper Vision">
          <rect x={1} y={1} width={42} height={42} rx={9} fill="none" stroke={accent} strokeWidth={1.2} opacity={0.55} />
          <rect x={11} y={11} width={22} height={2.6} rx={1.3} fill={ink} />
          <rect x={11} y={17} width={22} height={2.6} rx={1.3} fill={ink} />
          <rect x={11} y={23} width={22} height={2.6} rx={1.3} fill={accent} />
          <rect x={11} y={29} width={22} height={2.6} rx={1.3} fill={ink} opacity={0.55} />
          <circle cx={35} cy={11} r={1.6} fill={accent} />
        </svg>
      </div>
    );
  }

  // Shared wordmark for `full` and `mono`.
  const visionFill = variant === 'mono' ? ink : accent;
  const dotFill = variant === 'mono' ? ink : accent;
  const weight = variant === 'mono' ? 400 : 500;
  const font = '"SF Pro Display", "Inter", "Helvetica Neue", system-ui, sans-serif';
  // viewBox 520 x 88 (~5.9:1). Emblem on left, then DEEPER, then VISION.
  const w = (height / 88) * 520;

  const wordmark = (
    <svg
      width={w}
      height={height}
      viewBox="0 0 520 88"
      aria-label="Deeper Vision"
      style={{ display: 'block' }}
    >
      {/* Emblem: 4-bar scan stack */}
      <g transform="translate(4,22)">
        <rect x={0} y={0}  width={44} height={5} rx={2.5} fill={ink} />
        <rect x={0} y={11} width={34} height={5} rx={2.5} fill={visionFill} />
        <rect x={0} y={22} width={44} height={5} rx={2.5} fill={ink} />
        <rect x={0} y={33} width={20} height={5} rx={2.5} fill={ink} opacity={0.55} />
        <circle cx={46} cy={2.5} r={2.2} fill={visionFill} />
      </g>
      <text
        x={70} y={56}
        fontFamily={font}
        fontSize={36}
        fontWeight={weight}
        letterSpacing={3}
        fill={ink}
      >DEEPER</text>
      <text
        x={266} y={56}
        fontFamily={font}
        fontSize={36}
        fontWeight={weight}
        letterSpacing={3}
        fill={visionFill}
      >VISION</text>
      <circle cx={508} cy={52} r={2.6} fill={dotFill} />
    </svg>
  );

  if (variant === 'mono') {
    return (
      <span className={className} style={{ display: 'inline-block' }} title={title}>
        {wordmark}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex flex-col ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ height: withTagline ? height * 1.5 : height }}
      onClick={onClick}
      title={title}
    >
      {wordmark}
      {withTagline && (
        <span
          className="mt-1"
          style={{
            color: dim,
            fontFamily: '"SF Mono", "JetBrains Mono", ui-monospace, monospace',
            fontSize: Math.max(9, height * 0.28),
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          Next-Generation Security Engineering OS
        </span>
      )}
    </div>
  );
}
