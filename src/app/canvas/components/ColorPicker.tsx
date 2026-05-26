// ColorPicker — extracted from screens/EngineeringCanvas.tsx as
// part of the M11 monolith breakup. Shared color-picker popover
// used by the InsertDock category-color swatches AND the
// per-device color override inside the inspector tray. Renders a
// trigger swatch + a portal-positioned popover with the preset
// palette (DEVICE_COLOR_PALETTE) plus a custom hex input.
//
// Popover positioning: ReactDOM.createPortal at document.body with
// `position: fixed`. Avoids container clipping bugs the earlier
// kebab/ExpandMenu popover hit when the trigger sat near a canvas
// edge. On open we measure the trigger's viewport rect and pick a
// side (below preferred, above on underflow) and a horizontal
// alignment (left of trigger preferred, right-edge clamp on
// overflow), then clamp to a 6 px viewport inset.
//
// `currentColor` is the resolved color this swatch represents.
// `onPick(hex)` is called with either a valid hex string or an
// empty string ("reset to default").

import { Check } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEVICE_COLOR_PALETTE } from '../constants';

export function ColorPicker({
  currentColor,
  onPick,
  title = 'Pick a color',
  size = 18,
  // `align` is retained for backwards compatibility with existing
  // call sites but is no longer the primary positioning input.
  // Positioning is computed from the trigger's viewport rect; the
  // align hint biases the horizontal preference when there's room
  // on either side.
  align: _align = 'left',
}: {
  currentColor: string;
  onPick: (hex: string) => void;
  title?: string;
  size?: number;
  align?: 'left' | 'right';
}) {
  void _align;
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(currentColor || '#5292DC');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Popover dimensions (rough; measured against actual content after
  // first paint). Used to compute flip/clamp before the menu has a
  // rendered rect of its own. 200 px wide, ~180 px tall covers the
  // 5-col preset grid + the custom-hex row.
  const POPOVER_W = 200;
  const POPOVER_H = 184;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const computePosition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const INSET = 6;
    const GAP = 4;
    // Use the menu's actual height once it's rendered; fall back to
    // the rough constant during first paint.
    const menuH = menuRef.current?.offsetHeight ?? POPOVER_H;
    const menuW = menuRef.current?.offsetWidth ?? POPOVER_W;
    // Vertical: prefer below; flip above on overflow; clamp to inset.
    let top = r.bottom + GAP;
    if (top + menuH > vh - INSET) {
      const aboveTop = r.top - menuH - GAP;
      if (aboveTop >= INSET) top = aboveTop;
      else top = Math.max(INSET, vh - menuH - INSET);
    }
    // Horizontal: prefer aligning the menu's LEFT edge with the
    // trigger's LEFT edge (so the picker reads as a dropdown under
    // the button). Flip to right-align on overflow; clamp to inset
    // on either side.
    let left = r.left;
    if (left + menuW > vw - INSET) {
      left = Math.max(INSET, r.right - menuW);
    }
    if (left < INSET) left = INSET;
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePosition();
    const onResize = () => computePosition();
    const onScroll = () => computePosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true); // capture so we get scroll events from any ancestor
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, computePosition]);

  // Recompute once the menu DOM has a real height (the rough constant
  // can be off by 10-20 px depending on font metrics; we measure and
  // adjust on the next animation frame so the flip/clamp uses true
  // dimensions).
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const rafId = requestAnimationFrame(() => computePosition());
    return () => cancelAnimationFrame(rafId);
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => { if (open) setCustom(currentColor || '#5292DC'); }, [open, currentColor]);

  const popover = open && pos ? (
    <div
      ref={menuRef}
      role="menu"
      data-testid="color-picker-menu"
      className="fixed z-[60] w-[200px] rounded-md p-2 space-y-2"
      style={{
        top: pos.top,
        left: pos.left,
        background: 'var(--popover)',
        border: '1px solid var(--border)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
      }}
    >
      <div className="grid grid-cols-5 gap-1.5">
        {DEVICE_COLOR_PALETTE.map((c) => {
          const isReset = c.id === 'reset';
          const isCurrent = (currentColor || '') === c.hex;
          if (isReset) {
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { onPick(''); setOpen(false); }}
                title="Use default color"
                data-testid="color-picker-reset"
                className={`h-7 rounded border text-[9px] tracking-tight transition-colors ${
                  !currentColor
                    ? 'border-primary/60 text-primary bg-primary/10'
                    : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                Default
              </button>
            );
          }
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => { onPick(c.hex); setOpen(false); }}
              title={c.name}
              data-testid={`color-picker-preset-${c.id}`}
              className="h-7 rounded border transition-colors flex items-center justify-center"
              style={{
                background: c.hex,
                borderColor: isCurrent ? 'var(--foreground)' : 'var(--border)',
              }}
            >
              {isCurrent && <Check className="w-3 h-3 text-white drop-shadow" />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
        <input
          type="color"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          data-testid="color-picker-custom"
          className="w-7 h-7 rounded cursor-pointer bg-transparent"
          aria-label="Custom color"
        />
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="#RRGGBB"
          className="flex-1 text-[10.5px] font-mono bg-transparent border border-border/60 rounded px-1.5 py-1 text-foreground focus:outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => {
            const hex = custom.trim();
            if (/^#([0-9a-fA-F]{6})$/.test(hex)) {
              onPick(hex);
              setOpen(false);
            }
          }}
          data-testid="color-picker-custom-apply"
          className="px-1.5 py-1 rounded text-[10px] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          OK
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={title}
        aria-label={title}
        data-testid="color-picker-swatch"
        className="rounded border border-border/60 hover:border-foreground transition-colors"
        style={{ width: size, height: size, background: currentColor }}
      />
      {popover && createPortal(popover, document.body)}
    </>
  );
}
