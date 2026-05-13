import { useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import type { Vec2 } from '../../lib/engineering';

interface Props {
  children: (helpers: {
    toWorld: (clientX: number, clientY: number) => Vec2;
    zoom: number;
  }) => ReactNode;
  onBackgroundClick?: (world: Vec2) => void;
  onBackgroundMove?: (world: Vec2) => void;
  onTransform?: (t: { tx: number; ty: number; zoom: number }) => void;
  cursor?: string;
}

export function CanvasViewport({ children, onBackgroundClick, onBackgroundMove, onTransform, cursor }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [zoom, setZoom] = useState(1);
  const panning = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Vec2 => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - tx) / zoom,
        y: (clientY - rect.top - ty) / zoom,
      };
    },
    [tx, ty, zoom],
  );

  useEffect(() => { onTransform?.({ tx, ty, zoom }); }, [tx, ty, zoom, onTransform]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = -e.deltaY * 0.0015;
      const nextZoom = Math.min(4, Math.max(0.2, zoom * (1 + delta)));
      const k = nextZoom / zoom;
      setTx(mx - (mx - tx) * k);
      setTy(my - (my - ty) * k);
      setZoom(nextZoom);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [tx, ty, zoom]);

  return (
    <div
      ref={ref}
      className="absolute inset-0 overflow-hidden select-none"
      style={{ cursor: cursor ?? (panning.current ? 'grabbing' : 'default') }}
      onMouseDown={(e) => {
        if (e.button === 1 || (e.button === 0 && e.altKey) || e.button === 2) {
          panning.current = { x: e.clientX, y: e.clientY, tx, ty };
        }
      }}
      onMouseMove={(e) => {
        if (panning.current) {
          setTx(panning.current.tx + (e.clientX - panning.current.x));
          setTy(panning.current.ty + (e.clientY - panning.current.y));
        } else if (onBackgroundMove) {
          onBackgroundMove(toWorld(e.clientX, e.clientY));
        }
      }}
      onMouseUp={(e) => {
        const wasPan = !!panning.current;
        panning.current = null;
        if (!wasPan && e.target === e.currentTarget && onBackgroundClick) {
          onBackgroundClick(toWorld(e.clientX, e.clientY));
        }
      }}
      onMouseLeave={() => {
        panning.current = null;
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* engineering grid (tracks viewport) */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: '400%',
          height: '400%',
          transform: `translate(${tx % (40 * zoom)}px, ${ty % (40 * zoom)}px)`,
          backgroundImage: `
            linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)
          `,
          backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
          pointerEvents: 'none',
        }}
      />
      {/* world layer */}
      <div
        className="absolute origin-top-left"
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${zoom})`, willChange: 'transform' }}
      >
        {children({ toWorld, zoom })}
      </div>
      {/* zoom readout */}
      <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-card/80 backdrop-blur-sm border border-border text-[10px] text-engineering">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
