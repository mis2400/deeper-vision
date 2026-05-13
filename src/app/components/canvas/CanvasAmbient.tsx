import { useMemo } from 'react';

interface Props {
  width: number;
  height: number;
  active?: boolean;
}

// Cinematic backdrop: drifting starfield + slow radar sweep + horizon scanline.
// Purely decorative — sits behind everything in the SVG. Adds the "alive engineering environment" feel.
export function CanvasAmbient({ width, height, active = true }: Props) {
  if (!active) return null;

  // Deterministic particle field so it doesn't churn on every render.
  const particles = useMemo(() => {
    const seed = 8731;
    const rand = (n: number) => {
      const x = Math.sin(seed + n * 12.97) * 43758.5453;
      return x - Math.floor(x);
    };
    return Array.from({ length: 64 }, (_, i) => ({
      x: rand(i) * width,
      y: rand(i + 100) * height,
      r: 0.6 + rand(i + 200) * 1.4,
      d: 6 + rand(i + 300) * 14,
      o: 0.15 + rand(i + 400) * 0.35,
    }));
  }, [width, height]);

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.max(width, height) * 0.65;

  return (
    <g pointerEvents="none" className="canvas-ambient">
      <defs>
        {/* Subtle blueprint grain — fractal noise composited at low opacity for depth */}
        <filter id="ambient-grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.75  0 0 0 0 1  0 0 0 0.18 0" />
        </filter>
        <radialGradient id="ambient-vignette" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="rgba(56,189,248,0.04)" />
          <stop offset="60%" stopColor="rgba(15,23,42,0)" />
          <stop offset="100%" stopColor="rgba(2,6,23,0.55)" />
        </radialGradient>
        <linearGradient id="ambient-sweep" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(56,189,248,0)" />
          <stop offset="80%" stopColor="rgba(56,189,248,0.18)" />
          <stop offset="100%" stopColor="rgba(125,211,252,0.45)" />
        </linearGradient>
        <linearGradient id="ambient-scan" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="rgba(56,189,248,0)" />
          <stop offset="48%" stopColor="rgba(56,189,248,0)" />
          <stop offset="50%" stopColor="rgba(125,211,252,0.22)" />
          <stop offset="52%" stopColor="rgba(56,189,248,0)" />
          <stop offset="100%" stopColor="rgba(56,189,248,0)" />
        </linearGradient>
      </defs>

      {/* Blueprint grain — barely-there texture so the canvas reads as a surface, not a void */}
      <rect x={0} y={0} width={width} height={height} fill="#0a0e1a" filter="url(#ambient-grain)" opacity={0.5} />

      {/* Soft vignette — desaturates the periphery so the working area pops */}
      <rect x={0} y={0} width={width} height={height} fill="url(#ambient-vignette)" />

      {/* Concentric range rings — like a sonar / GIS plot */}
      {[0.18, 0.32, 0.48, 0.66].map((f, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r * f}
          fill="none"
          stroke="rgba(56,189,248,0.07)"
          strokeWidth={0.6}
          strokeDasharray={i % 2 ? '4 6' : undefined}
        />
      ))}

      {/* Radar sweep — slow rotating wedge */}
      <g transform={`translate(${cx},${cy})`} opacity={0.55}>
        <g>
          <path
            d={`M 0 0 L ${r} 0 A ${r} ${r} 0 0 0 ${Math.cos(-Math.PI / 6) * r} ${Math.sin(-Math.PI / 6) * r} Z`}
            fill="url(#ambient-sweep)"
            opacity={0.6}
          />
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="28s" repeatCount="indefinite" />
        </g>
      </g>

      {/* Drifting horizon scanline — slow vertical pass */}
      <rect x={0} y={0} width={width} height={height} fill="url(#ambient-scan)" opacity={0.4}>
        <animate attributeName="y" from={-height} to={height} dur="14s" repeatCount="indefinite" />
      </rect>

      {/* Slow drifting particles */}
      {particles.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#7DD3FC" opacity={p.o}>
          <animate attributeName="cy" values={`${p.y};${p.y - 14};${p.y}`} dur={`${p.d}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values={`${p.o};${p.o * 0.3};${p.o}`} dur={`${p.d}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
}
