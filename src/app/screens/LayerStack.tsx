import { useState } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Eye, EyeOff, Lock, Unlock, GripVertical, Plus } from 'lucide-react';

interface Layer { id: string; name: string; visible: boolean; locked: boolean; opacity: number; color: string; count: number; }

const INITIAL: Layer[] = [
  { id: 'arch',   name: 'Architecture',   visible: true,  locked: true,  opacity: 100, color: '#7D8590', count: 0 },
  { id: 'video',  name: 'Video',          visible: true,  locked: false, opacity: 100, color: '#2F81F7', count: 28 },
  { id: 'access', name: 'Access control', visible: true,  locked: false, opacity: 100, color: '#3FB950', count: 16 },
  { id: 'fov',    name: 'Coverage / FOV', visible: true,  locked: false, opacity: 60,  color: '#A371F7', count: 28 },
  { id: 'cable',  name: 'Cable paths',    visible: false, locked: false, opacity: 100, color: '#D29922', count: 42 },
  { id: 'measure',name: 'Dimensions',     visible: false, locked: false, opacity: 100, color: '#F85149', count: 8  },
  { id: 'notes',  name: 'Notes',          visible: true,  locked: false, opacity: 100, color: '#79C0FF', count: 5  },
];

const PRESETS = [
  { id: 'design',  label: 'Design',   layers: ['arch', 'video', 'access', 'fov', 'notes'] },
  { id: 'install', label: 'Install',  layers: ['arch', 'video', 'access', 'cable'] },
  { id: 'client',  label: 'Client',   layers: ['arch', 'video', 'access'] },
  { id: 'permit',  label: 'Permit',   layers: ['arch', 'video', 'access', 'cable', 'measure'] },
];

export function LayerStack() {
  const { projectId = 'p1' } = useParams();
  const [layers, setLayers] = useState(INITIAL);

  const update = (id: string, patch: Partial<Layer>) => setLayers((ls) => ls.map((l) => l.id === id ? { ...l, ...patch } : l));
  const applyPreset = (ids: string[]) => setLayers((ls) => ls.map((l) => ({ ...l, visible: ids.includes(l.id) })));

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Canvas', to: `/project/${projectId}/canvas` }, { label: 'Layers' }]}
      title="Layer stack"
      subtitle="Organize the drawing — show, hide, lock, fade"
      actions={<Button size="sm" variant="outline"><Plus className="w-3.5 h-3.5 mr-1" />New layer</Button>}
    >
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-2">View presets</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => applyPreset(p.layers)} className="px-3 py-1.5 rounded border border-border text-xs hover:bg-secondary">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {layers.map((l) => (
            <div key={l.id} className="px-3 py-2.5 border-b border-border last:border-b-0 flex items-center gap-3 hover:bg-secondary/30">
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab" />
              <button onClick={() => update(l.id, { visible: !l.visible })} className="text-muted-foreground hover:text-foreground">
                {l.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button onClick={() => update(l.id, { locked: !l.locked })} className="text-muted-foreground hover:text-foreground">
                {l.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4 opacity-40" />}
              </button>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.color }} />
              <div className={`flex-1 ${l.visible ? '' : 'opacity-50'}`}>
                <div className="text-sm">{l.name}</div>
                <div className="text-[10px] text-muted-foreground">{l.count} items</div>
              </div>
              <div className="flex items-center gap-2 w-40">
                <input type="range" min={0} max={100} value={l.opacity} onChange={(e) => update(l.id, { opacity: Number(e.target.value) })} className="flex-1 accent-primary" />
                <span className="text-[10px] text-muted-foreground w-8 text-right">{l.opacity}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
