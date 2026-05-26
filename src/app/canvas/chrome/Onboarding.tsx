// Onboarding + StartCard — extracted from screens/EngineeringCanvas.tsx
// as part of the M11 monolith breakup. The empty-canvas splash that
// asks the operator to pick a starting context (blueprint, blank).
// Pure presentational — onPick + onClose callbacks only.

import { PencilLine, Upload, X } from 'lucide-react';

export function Onboarding({ onPick, onClose }: { onPick: (s: 'blueprint' | 'blank') => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 bg-background/85 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-7 py-5 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">New canvas</div>
            <h2 className="text-xl mt-1">How would you like to start?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pick the source. We'll ask you to set scale once a plan is loaded.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Canvas V2 Pass 1.0 — "Use an address" was removed. It opened
            a mocked geocoding step that resolved any address to a
            sample aerial image. The blueprint and blank paths both
            ship real backing. */}
        <div className="p-5 grid grid-cols-2 gap-3">
          <StartCard
            icon={Upload} title="Upload a blueprint"
            sub="PDF, PNG, or JPG. We'll ask for two reference points to set scale."
            onClick={() => onPick('blueprint')}
          />
          <StartCard
            icon={PencilLine} title="Start blank"
            sub="Sketch walls and rooms with the wall tool. Best for renovations and tenant fit outs."
            onClick={() => onPick('blank')}
          />
        </div>
        <div className="px-5 pb-5 text-xs text-muted-foreground">
          You can change the source later. Site walks, vision scans, and import all attach to whichever you start with.
        </div>
      </div>
    </div>
  );
}

function StartCard({ icon: Icon, title, sub, onClick, accent }: { icon: any; title: string; sub: string; onClick: () => void; accent?: boolean }) {
  return (
    <button onClick={onClick} className={`text-left p-4 rounded-xl border transition-all ${accent ? 'border-primary bg-primary/5 hover:bg-primary/10' : 'border-border hover:border-border-strong bg-background hover:bg-secondary/30'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-3 text-sm">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{sub}</div>
    </button>
  );
}
