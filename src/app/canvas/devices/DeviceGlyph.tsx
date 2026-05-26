// DeviceGlyph — extracted from screens/EngineeringCanvas.tsx as part
// of the M11 monolith breakup.
//
// Renders the schematic plan symbol for a device at chrome sizes
// (dock / palette / drag-ghost / layer rows). The canvas itself uses
// HardwareGlyph via SurveyorSymbol at richer fidelity; this is the
// surface where the same symbols read in small contexts.
//
// Resolves the device's tone by precedence:
//   1. caller-passed `tone` override
//   2. per-category color override on the store
//   3. KIND_TONE default
// Subscribes only to the `categoryColors` slice of the store so it
// re-renders ONLY when the user picks a new category color.

import { SurveyorSymbol } from '../../components/canvas/SurveyorSymbols';
import { useProjectStore } from '../../store/projectStore';
import { KIND_TONE, TYPE_KIND } from '../constants';
import type { DeviceType } from '../types';
import { SURVEYOR_SYMBOL_HAS } from '../utils';

export interface DeviceGlyphProps {
  type: DeviceType;
  size: number;
  tone?: string;
}

export function DeviceGlyph({ type, size, tone }: DeviceGlyphProps) {
  const overrideMap = useProjectStore((s) => s.categoryColors);
  const kind = TYPE_KIND[type];
  const ink = tone ?? overrideMap?.[kind] ?? KIND_TONE[kind];
  if (SURVEYOR_SYMBOL_HAS(type)) {
    const stroke = size <= 16 ? 1.6 : size <= 22 ? 1.5 : 1.4;
    return (
      <span
        className="inline-flex items-center justify-center"
        style={{ width: size, height: size, color: ink }}
      >
        <SurveyorSymbol id={type} size={size} stroke={stroke} />
      </span>
    );
  }
  // Fallback for any device type without a surveyor symbol. Flagged
  // in dev console; renders a dashed box at the device's tone so the
  // missing symbol is visible during development.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn('[DeviceGlyph] no SurveyorSymbol for device type', type);
  }
  return (
    <span
      className="inline-flex items-center justify-center border border-dashed border-current/40"
      style={{ width: size, height: size, color: ink, fontSize: Math.max(8, size * 0.45) }}
      title={`Missing icon for ${type}`}
    >
      ?
    </span>
  );
}

export default DeviceGlyph;
