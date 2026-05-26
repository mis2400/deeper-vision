// UndoRedoButtons — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. Small top-bar segmented
// pair (Undo / Redo) that drives the canvas history slice.
// Pure: pulls past/future stacks straight from useProjectStore
// and calls canvasUndo / canvasRedo, surfacing the popped label
// via a toast.

import { Redo2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectStore } from '../../store/projectStore';

export function UndoRedoButtons() {
  const past = useProjectStore((s) => s.canvasHistory.past);
  const future = useProjectStore((s) => s.canvasHistory.future);
  const nextUndo = past[past.length - 1];
  const nextRedo = future[future.length - 1];
  const canUndo = !!nextUndo;
  const canRedo = !!nextRedo;
  const handleUndo = () => {
    const popped = useProjectStore.getState().canvasUndo();
    if (popped) toast.message(`Undo: ${popped.label}`, { duration: 2000 });
  };
  const handleRedo = () => {
    const popped = useProjectStore.getState().canvasRedo();
    if (popped) toast.message(`Redo: ${popped.label}`, { duration: 2000 });
  };
  return (
    <div className="inline-flex items-center gap-0.5 h-8 px-0.5 rounded-lg border border-border bg-background">
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        title={canUndo ? `Undo: ${nextUndo.label}  (⌘Z)` : 'Nothing to undo'}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${canUndo ? 'text-foreground hover:bg-secondary' : 'text-muted-foreground/40 cursor-default'}`}
        data-track="topbar-undo"
        aria-label="Undo"
      >
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleRedo}
        disabled={!canRedo}
        title={canRedo ? `Redo: ${nextRedo.label}  (⇧⌘Z)` : 'Nothing to redo'}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${canRedo ? 'text-foreground hover:bg-secondary' : 'text-muted-foreground/40 cursor-default'}`}
        data-track="topbar-redo"
        aria-label="Redo"
      >
        <Redo2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
