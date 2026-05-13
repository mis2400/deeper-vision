import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Keyboard, MousePointer, Move, ZoomIn } from 'lucide-react';

interface Shortcut { keys: string[]; label: string; }
interface Group { id: string; title: string; icon: React.ComponentType<{ className?: string }>; items: Shortcut[]; }

const GROUPS: Group[] = [
  { id: 'tools', title: 'Tools', icon: MousePointer, items: [
    { keys: ['V'], label: 'Select' },
    { keys: ['H'], label: 'Pan' },
    { keys: ['C'], label: 'Place camera' },
    { keys: ['D'], label: 'Place door' },
    { keys: ['R'], label: 'Place reader' },
    { keys: ['L'], label: 'Draw cable' },
    { keys: ['M'], label: 'Measure' },
    { keys: ['T'], label: 'Text' },
  ]},
  { id: 'view', title: 'View', icon: ZoomIn, items: [
    { keys: ['⌘', '+'], label: 'Zoom in' },
    { keys: ['⌘', '-'], label: 'Zoom out' },
    { keys: ['⌘', '0'], label: 'Fit to screen' },
    { keys: ['⌘', '1'], label: 'Actual size' },
    { keys: ['Space', 'Drag'], label: 'Pan' },
    { keys: ['Scroll'], label: 'Zoom at cursor' },
  ]},
  { id: 'edit', title: 'Edit', icon: Move, items: [
    { keys: ['⌘', 'Z'], label: 'Undo' },
    { keys: ['⌘', '⇧', 'Z'], label: 'Redo' },
    { keys: ['⌘', 'D'], label: 'Duplicate' },
    { keys: ['⌫'], label: 'Delete' },
    { keys: ['⌘', 'A'], label: 'Select all' },
    { keys: ['⌘', 'G'], label: 'Group' },
  ]},
  { id: 'global', title: 'Global', icon: Keyboard, items: [
    { keys: ['⌘', 'K'], label: 'Command palette' },
    { keys: ['⌘', 'S'], label: 'Save' },
    { keys: ['⌘', '/'], label: 'Toggle assistant' },
    { keys: ['?'], label: 'Show this cheat sheet' },
  ]},
];

export function CanvasInteractions() {
  const [q, setQ] = useState('');
  const filter = (g: Group) => g.items.filter((s) => !q || s.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell
      crumbs={[{ label: 'Help', to: '/help' }, { label: 'Canvas shortcuts' }]}
      title="Canvas shortcuts"
      subtitle="Every keyboard and pointer interaction in one place"
    >
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shortcuts…" className="w-full bg-input-background border border-input-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary" />
        <div className="space-y-4">
          {GROUPS.map((g) => {
            const items = filter(g);
            if (items.length === 0) return null;
            const Icon = g.icon;
            return (
              <div key={g.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">{g.title}</h3>
                </div>
                <div>
                  {items.map((s) => (
                    <div key={s.label} className="px-4 py-2.5 border-b border-border last:border-b-0 flex items-center justify-between">
                      <span className="text-sm">{s.label}</span>
                      <div className="flex gap-1">
                        {s.keys.map((k, i) => (
                          <kbd key={i} className="text-[11px] bg-secondary border border-border rounded px-1.5 py-0.5 min-w-[24px] text-center">{k}</kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
