import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { Sparkles, Send, User, Paperclip, Lightbulb } from 'lucide-react';

interface Msg { id: string; role: 'user' | 'ai'; text: string; time: string; }

const SEED: Msg[] = [
  { id: 'm1', role: 'ai', text: 'Hi — I have full context on this project (28 cameras, 16 doors, 3 IDFs). Ask me anything about coverage, BOM, code compliance, or scheduling.', time: '09:12' },
  { id: 'm2', role: 'user', text: 'Are we within PoE budget on IDF-C?', time: '09:13' },
  { id: 'm3', role: 'ai', text: 'IDF-C is at 420W of 445W budget (94%). One more PTZ would push you over. Recommendation: move CAM-308 to IDF-B (currently at 63%), or upgrade the C9300-24P to a 48P with higher PoE budget.', time: '09:13' },
];

const SUGGESTIONS = [
  'Summarize the design intent for the client',
  'Check ADA mounting compliance for all readers',
  'Find single points of failure in the access control path',
  'Generate a 5-day install schedule from the BOM',
];

export function AIAssistant() {
  const { projectId = 'p1' } = useParams();
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const send = (text?: string) => {
    const t = (text ?? draft).trim();
    if (!t) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMsgs((m) => [...m, { id: `u${m.length}`, role: 'user', text: t, time: now }]);
    setDraft('');
    setTimeout(() => {
      setMsgs((m) => [...m, { id: `a${m.length}`, role: 'ai', text: 'Working on it — I\'ll cross-check the canvas, BOM, and code library and report back.', time: now }]);
    }, 600);
  };

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'AI assistant' }]}
      title="Assist"
      subtitle="Project-aware reasoning over your design, BOM, and code library"
      fullBleed
    >
      <div className="h-full flex flex-col max-w-3xl mx-auto w-full">
        <div className="px-6 py-3 border-b border-border flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Context loaded · Project {projectId} · 28 devices · 13 documents
        </div>

        <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
          {msgs.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${m.role === 'ai' ? 'bg-primary/10 text-primary' : 'bg-secondary'}`}>
                {m.role === 'ai' ? <Sparkles className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              <div className={`max-w-[80%] ${m.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block text-sm rounded-lg px-3 py-2 ${m.role === 'ai' ? 'bg-card border border-border' : 'bg-primary text-primary-foreground'}`}>{m.text}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{m.time}</div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {msgs.length <= 3 && (
          <div className="px-6 pb-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Try</div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-xs px-2.5 py-1.5 rounded border border-border hover:bg-secondary text-muted-foreground hover:text-foreground">{s}</button>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-3 border-t border-border">
          <div className="flex items-center gap-2 bg-input-background border border-input-border rounded-lg px-3 py-2 focus-within:border-primary">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ask about coverage, BOM, code, schedule…" className="flex-1 bg-transparent text-sm focus:outline-none" />
            <Button size="sm" onClick={() => send()} disabled={!draft.trim()}><Send className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
