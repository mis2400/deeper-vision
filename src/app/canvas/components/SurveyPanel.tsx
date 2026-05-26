// SurveyPanel — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. Reusable survey-notes
// block used inside both the device EditDrawer and the
// PathwayDrawer's Notes block. Lists every survey item attached
// to the given object (notes + checks with todo/verified/issue/
// skip status), lets the operator add a new one, edit status
// inline on checks, and remove items.
//
// Reads + writes via useProjectStore. Pulls the survey item map
// as a stable ref and filter/sort inside useMemo to avoid the
// "getSnapshot should be cached" warning under
// useSyncExternalStore (Zustand's underlying machinery).

import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useProjectStore } from '../../store/projectStore';
import type { SurveyItemStatus } from '../../store/types';
import { DrawerSection } from './DrawerPrimitives';

export function SurveyPanel({
  projectId, floorId, objectType, objectId,
  deviceStatus, onDeviceStatusChange,
}: {
  projectId: string;
  floorId?: string;
  objectType: 'device' | 'door' | 'pathway' | 'idf' | 'floor';
  objectId: string;
  /** Optional — only devices/doors carry the headline surveyStatus chip. */
  deviceStatus?: SurveyItemStatus;
  onDeviceStatusChange?: (s: SurveyItemStatus) => void;
}) {
  // Pull the raw map (stable ref) and filter+sort inside useMemo. Returning
  // a fresh array from the selector each render triggers React's
  // "getSnapshot should be cached" infinite-loop warning under
  // useSyncExternalStore — Zustand's underlying machinery.
  const allItems = useProjectStore((s) => s.surveyItems);
  const items = useMemo(
    () => Object.values(allItems)
      .filter((i) => i.objectType === objectType && i.objectId === objectId)
      .sort((a, b) => b.createdAt - a.createdAt),
    [allItems, objectType, objectId],
  );
  const addSurveyItem = useProjectStore((s) => s.addSurveyItem);
  const updateSurveyItem = useProjectStore((s) => s.updateSurveyItem);
  const removeSurveyItem = useProjectStore((s) => s.removeSurveyItem);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'note' | 'check'>('note');
  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addSurveyItem({
      projectId,
      floorId,
      objectType,
      objectId,
      kind,
      text: trimmed,
      status: kind === 'check' ? 'todo' : 'verified',
      author: 'Field demo',
    });
    setText('');
    toast.success(kind === 'check' ? 'Checklist item added' : 'Survey note added', { duration: 2500 });
  };
  return (
    <>
      {onDeviceStatusChange && (
        <DrawerSection title="Survey status">
          <div className="grid grid-cols-4 gap-1.5">
            {(['todo', 'verified', 'issue', 'skip'] as const).map((opt) => {
              const on = (deviceStatus ?? 'todo') === opt;
              return (
                <button
                  key={opt}
                  onClick={() => onDeviceStatusChange(opt)}
                  data-testid={`survey-status-${opt}`}
                  className={`text-center px-2 py-1.5 rounded-md border text-[11px] capitalize transition-colors ${
                    on ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </DrawerSection>
      )}
      <DrawerSection title={`Survey notes · ${items.length}`}>
        {items.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic mb-2">
            No survey notes yet. Add one below — they save against this object and persist on refresh.
          </div>
        ) : (
          <div className="space-y-1.5 mb-3">
            {items.map((it) => (
              <div key={it.id} className="rounded-md border border-border bg-secondary/15 px-2.5 py-2" data-testid={`survey-item-${it.id}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9.5px] uppercase tracking-[0.10em] px-1.5 py-0.5 rounded-sm ${
                    it.status === 'verified' ? 'bg-emerald-400/15 text-emerald-300'
                    : it.status === 'issue'   ? 'bg-rose-400/15 text-rose-300'
                    : it.status === 'skip'    ? 'bg-amber-300/15 text-amber-200'
                    : 'bg-muted text-muted-foreground'
                  }`}>{it.kind === 'check' ? 'Check' : 'Note'} · {it.status}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(it.createdAt).toLocaleString()}</span>
                  <button
                    onClick={() => removeSurveyItem(it.id)}
                    title="Remove"
                    data-testid={`survey-remove-${it.id}`}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-[12px] text-foreground whitespace-pre-wrap">{it.text}</div>
                {it.author && <div className="text-[10px] text-muted-foreground mt-1">— {it.author}</div>}
                {it.kind === 'check' && (
                  <div className="mt-1.5 flex gap-1.5">
                    {(['todo', 'verified', 'issue', 'skip'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateSurveyItem(it.id, { status: s })}
                        className={`text-[10px] px-1.5 py-0.5 rounded border capitalize ${
                          it.status === s ? 'border-primary/60 text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >{s}</button>
                    ))}
                  </div>
                )}
                {it.photo && (
                  <div className="mt-1.5 text-[10px] text-amber-200/85">
                    Photo · {it.photo.fileName} {it.photo.sizeBytes ? `(${Math.round(it.photo.sizeBytes / 1024)} KB)` : ''} — upload pending
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 mb-2">
          {(['note', 'check'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setKind(opt)}
              data-testid={`survey-kind-${opt}`}
              className={`text-[11px] px-2 py-1 rounded border capitalize ${kind === opt ? 'border-primary/60 text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >{opt}</button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(); }}
          placeholder={kind === 'check' ? 'Verify exterior PoE injector is in stock…' : 'On-site observation, blocking, GC handoff…'}
          data-testid="survey-input"
          className="dv-input text-[12px] resize-none min-h-[64px] w-full"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground">⌘/Ctrl+Enter to save</span>
          <button
            onClick={submit}
            disabled={!text.trim()}
            data-testid="survey-add-btn"
            className="text-[11px] px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >Add</button>
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground/85">
          Photos can be added — only the filename + size persists today; image upload is pending.
        </div>
      </DrawerSection>
    </>
  );
}
