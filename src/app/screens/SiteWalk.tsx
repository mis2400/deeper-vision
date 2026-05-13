import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/Button';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Camera, MapPin, MessageSquare, Plus, ArrowRight } from 'lucide-react';

interface Note { id: string; loc: string; text: string; time: string; img: string; }

const NOTES: Note[] = [
  { id: 'n1', loc: 'Lobby NE',       text: 'Existing analog camera mounted at 10ft, replace with IP bullet.', time: '09:14', img: 'https://images.unsplash.com/photo-1581092334415-7c9a91d1aa30?w=600&q=70' },
  { id: 'n2', loc: 'Main entry',     text: 'Glass door, narrow stile — confirm reader fits. Maglock above.',   time: '09:22', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=70' },
  { id: 'n3', loc: 'IDF-A closet',   text: 'Existing 24P PoE switch at 60% capacity. Room for new switch.',    time: '09:31', img: 'https://images.unsplash.com/photo-1581090700227-1e8e6c3edbc4?w=600&q=70' },
  { id: 'n4', loc: 'Exterior north', text: 'Need PTZ for parking coverage. J-box on column.',                  time: '09:47', img: 'https://images.unsplash.com/photo-1573164574472-797cdf4a583a?w=600&q=70' },
  { id: 'n5', loc: 'Loading dock',   text: 'Existing strike worn. Replace with Von Duprin 6210.',              time: '10:02', img: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=600&q=70' },
  { id: 'n6', loc: 'Roof access',    text: 'Card reader only, no exterior reader. DPS required.',              time: '10:18', img: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=600&q=70' },
];

export function SiteWalk() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();
  const [sel, setSel] = useState(NOTES[0]);

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Site walk' }]}
      title="Site walk"
      subtitle={`${NOTES.length} captures · ${new Date().toLocaleDateString()}`}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline"><Plus className="w-3.5 h-3.5 mr-1" />New capture</Button>
          <Button size="sm" onClick={() => nav(`/project/${projectId}/canvas`)}>Sync to canvas <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
        </div>
      }
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-[1fr_360px] gap-4">
        <div className="grid grid-cols-3 gap-3">
          {NOTES.map((n) => (
            <button key={n.id} onClick={() => setSel(n)} className={`group text-left bg-card border rounded-lg overflow-hidden transition-colors ${sel.id === n.id ? 'border-primary' : 'border-border hover:border-border-strong'}`}>
              <div className="aspect-[4/3] bg-secondary overflow-hidden">
                <ImageWithFallback src={n.img} alt={n.loc} className="w-full h-full object-cover" />
              </div>
              <div className="p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />{n.loc}
                </div>
                <div className="text-sm mt-1 line-clamp-2">{n.text}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden h-fit">
          <div className="aspect-[4/3] bg-secondary overflow-hidden">
            <ImageWithFallback src={sel.img} alt={sel.loc} className="w-full h-full object-cover" />
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />{sel.loc} · {sel.time}
            </div>
            <p className="text-sm mt-2 leading-relaxed">{sel.text}</p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1"><Camera className="w-3.5 h-3.5 mr-1" />Add photo</Button>
              <Button size="sm" variant="outline" className="flex-1"><MessageSquare className="w-3.5 h-3.5 mr-1" />Note</Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
