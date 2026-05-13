import { useEffect, useState } from 'react';
import { BrandLogo } from './BrandLogo';

type Shortcut = { keys: string[]; label: string };
type Group = { title: string; items: Shortcut[] };

const GROUPS: Group[] = [
  {
    title: 'Tools',
    items: [
      { keys: ['V'], label: 'Select tool' },
      { keys: ['H'], label: 'Pan tool' },
      { keys: ['M'], label: 'Measure' },
      { keys: ['C'], label: 'Camera' },
      { keys: ['D'], label: 'Door' },
      { keys: ['R'], label: 'Pathway / routing' },
      { keys: ['T'], label: 'Target / actor' },
    ],
  },
  {
    title: 'Selection',
    items: [
      { keys: ['↑', '↓', '←', '→'], label: 'Nudge 1px' },
      { keys: ['⇧', '↑↓←→'], label: 'Nudge 10px' },
      { keys: ['Del'], label: 'Delete selection' },
      { keys: ['Esc'], label: 'Clear selection / cancel' },
    ],
  },
  {
    title: 'Edit',
    items: [
      { keys: ['⌘', 'Z'], label: 'Undo' },
      { keys: ['⌘', '⇧', 'Z'], label: 'Redo' },
      { keys: ['Enter'], label: 'Finish pathway' },
    ],
  },
  {
    title: 'Canvas / View',
    items: [
      { keys: ['P'], label: 'Presentation coverage mode' },
      { keys: ['Scroll'], label: 'Zoom' },
      { keys: ['⌥', 'Drag'], label: 'Pan' },
      { keys: ['⇧', 'Click'], label: 'Multi-select' },
    ],
  },
  {
    title: 'Manipulation',
    items: [
      { keys: ['Drag ring'], label: 'Rotate device' },
      { keys: ['⇧', 'Drag ring'], label: 'Snap to 15°' },
      { keys: ['Click marker'], label: 'Jump to AI issue' },
    ],
  },
  {
    title: 'Help',
    items: [
      { keys: ['?'], label: 'Toggle this overlay' },
    ],
  },
];

export const SHORTCUT_OVERLAY_EVENT = 'deepervision:open-shortcuts';

export function openShortcutOverlay() {
  window.dispatchEvent(new CustomEvent(SHORTCUT_OVERLAY_EVENT));
}

export function ShortcutOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    const onCustom = () => setOpen((o) => !o);
    window.addEventListener('keydown', onKey);
    window.addEventListener(SHORTCUT_OVERLAY_EVENT, onCustom);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(SHORTCUT_OVERLAY_EVENT, onCustom);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md animate-in fade-in"
         onClick={() => setOpen(false)}>
      <div
        className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-[var(--panel-background)]/95 backdrop-blur-2xl border border-primary/40 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-7 py-5 border-b border-border/60">
          <div className="flex items-center gap-4">
            <BrandLogo variant="compact" theme="dark" height={32} />
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-primary">Keyboard Reference</p>
              <h2 className="text-lg">Shortcuts</h2>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1 text-[11px] rounded border border-border/60 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
          >Esc</button>
        </div>

        <div className="px-7 py-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="text-[10px] uppercase tracking-[0.18em] text-primary mb-2.5">{g.title}</p>
              <div className="space-y-1.5">
                {g.items.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 py-1">
                    <span className="text-[12px] text-muted-foreground">{s.label}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded border border-border/60 bg-secondary/40 text-foreground text-[10px] font-mono tracking-tight shadow-[inset_0_-1px_0_rgba(0,0,0,0.3)]"
                        >{k}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-7 py-3 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Deeper Vision · Engineering OS</span>
          <span>Press <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-secondary/40 text-foreground font-mono">?</kbd> anywhere to reopen</span>
        </div>
      </div>
    </div>
  );
}
