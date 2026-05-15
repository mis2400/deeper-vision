import { BrandLogo } from './BrandLogo';
import { openShortcutOverlay } from './ShortcutOverlay';

/**
 * Subtle screen-blended brand mark, lower-right.
 * Click pops the global keyboard shortcut overlay.
 */
export function BrandWatermark({ fixed = false }: { fixed?: boolean }) {
  return (
    <div
      className={`${fixed ? 'fixed' : 'absolute'} bottom-3 right-3 z-[5] group`}
      style={{ pointerEvents: 'auto' }}
    >
      <button
        onClick={openShortcutOverlay}
        title="Keyboard shortcuts (?)"
        className="block opacity-[0.18] hover:opacity-90 transition-opacity mix-blend-screen hover:mix-blend-normal cursor-pointer"
      >
        <BrandLogo variant="mono" theme="dark" height={16} />
      </button>
      <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 px-2 py-0.5 rounded bg-black/80 border border-white/10 text-[9px] tracking-[0.18em] uppercase text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
        Shortcuts · ?
      </div>
    </div>
  );
}
