// StatusBar — extracted from screens/EngineeringCanvas.tsx as part of
// the M11 monolith breakup. Pure presentational chrome: tool name +
// dimension + device counts, rendered as a pill at the top-center of
// the canvas.
//
// No internal state, no store subscriptions. Pixel identical to the
// in-monolith version it replaces.

import type { DeviceKind, Tool } from '../types';
import { KIND_TONE } from '../constants';

export interface StatusBarProps {
  tool: Tool;
  zoom: number;
  counts: Record<DeviceKind, number>;
  units: 'ft' | 'm';
}

export function StatusBar({ tool, zoom: _zoom, counts, units }: StatusBarProps) {
  const toolLabel = tool === 'select' ? 'Select' : tool === 'pan' ? 'Pan' : tool === 'measure' ? 'Measure' : tool === 'wall' ? 'Wall' : tool === 'cable' ? 'Cable' : 'Tool';
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 top-4 z-20 inline-flex items-center gap-3 px-3.5 h-8 rounded-full bg-card border border-border text-foreground"
      data-canvas-chrome="topbar-status"
      style={{ fontSize: 'var(--chrome-sm)', boxShadow: 'var(--shadow-flat)' }}
    >
      <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: 'var(--primary)' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary)' }} aria-hidden />
        {toolLabel}
      </span>
      <span aria-hidden style={{ width: '1px', height: '12px', background: 'var(--border)' }} />
      <span style={{ color: 'var(--muted-foreground)' }}>1 in = 10 {units}</span>
      <span aria-hidden style={{ width: '1px', height: '12px', background: 'var(--border)' }} />
      <span className="inline-flex items-center gap-2.5 tabular-nums" data-testid="status-counts">
        <span className="inline-flex items-center gap-1.5 font-medium" title="Cameras">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: KIND_TONE.camera }} aria-hidden />
          {counts.camera}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium" title="Access">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: KIND_TONE.access }} aria-hidden />
          {counts.access}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium" title="Network">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: KIND_TONE.network }} aria-hidden />
          {counts.network}
        </span>
      </span>
    </div>
  );
}

export default StatusBar;
