import { useState, useRef } from 'react';
import { User2, X, Sun, CloudFog, Moon, Users } from 'lucide-react';

type Lighting = 'day' | 'lowlight' | 'night-ir';
type Weather = 'clear' | 'fog' | 'rain';

interface Props {
  enabled: boolean;
  onClose: () => void;
  // Confidence is computed by the caller given target position vs coverage.
  // Caller supplies a resolver; we fall back to a synthetic value if absent.
  resolveConfidence?: (pos: { x: number; y: number }) => number;
}

/**
 * Target Simulator — a draggable human silhouette overlay on the canvas.
 * Renders into the parent's relative container; absolute-positioned.
 *
 * Live confidence bar reports:
 *   • face clarity
 *   • prosecution quality
 *   • body visibility
 *   • IR effectiveness
 * combined with lighting/weather modifiers.
 */
export function TargetSimulator({ enabled, onClose, resolveConfidence }: Props) {
  const [pos, setPos] = useState({ x: 420, y: 320 });
  const [lighting, setLighting] = useState<Lighting>('day');
  const [weather, setWeather] = useState<Weather>('clear');
  const [crowd, setCrowd] = useState(0);
  const dragRef = useRef<{ ox: number; oy: number } | null>(null);

  if (!enabled) return null;

  const base = resolveConfidence?.(pos) ?? 78;
  const lightMod = lighting === 'day' ? 0 : lighting === 'lowlight' ? -18 : -8;
  const weatherMod = weather === 'clear' ? 0 : weather === 'fog' ? -14 : -7;
  const crowdMod = -crowd * 6;
  const confidence = Math.max(2, Math.min(99, base + lightMod + weatherMod + crowdMod));
  const tone =
    confidence > 80 ? 'text-emerald-300' :
    confidence > 55 ? 'text-amber-300' :
    'text-rose-300';
  const ring =
    confidence > 80 ? '#34D399' :
    confidence > 55 ? '#F59E0B' :
    '#F43F5E';

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragRef.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setPos({ x: e.clientX - dragRef.current.ox, y: e.clientY - dragRef.current.oy });
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <>
      {/* Draggable silhouette + confidence ring */}
      <div
        className="absolute z-40 select-none"
        style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -100%)' }}
      >
        <svg
          width={92}
          height={120}
          viewBox="0 0 92 120"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ cursor: 'grab', touchAction: 'none' }}
        >
          {/* footprint shadow */}
          <ellipse cx={46} cy={112} rx={18} ry={4} fill="#000" opacity={0.5} />
          {/* confidence ring */}
          <circle cx={46} cy={112} r={22} fill="none" stroke={ring} strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray={`${confidence * 1.38} 999`} transform="rotate(-90 46 112)" />
          {/* human silhouette */}
          <g fill="#E2E8F0" opacity={0.95}>
            <circle cx={46} cy={22} r={11} />
            <path d="M28 44 Q46 36 64 44 L66 86 Q56 92 46 92 Q36 92 26 86 Z" />
            <rect x={40} y={88} width={5} height={20} rx={2} />
            <rect x={47} y={88} width={5} height={20} rx={2} />
          </g>
          {/* live badge */}
          <g transform={`translate(58, 6)`}>
            <rect x={-1} y={-1} width={34} height={16} rx={3} fill="#0B1220" stroke={ring} strokeOpacity={0.7} />
            <text x={16} y={11} fontFamily="ui-monospace, monospace" fontSize={10} fill={ring} textAnchor="middle">{confidence}%</text>
          </g>
        </svg>
      </div>

      {/* HUD panel for sim conditions */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <div className="bg-[var(--panel-background)]/95 backdrop-blur-2xl border border-primary/30 rounded-xl shadow-2xl px-3 py-2 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <User2 className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-primary">Target Sim</span>
          </div>
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-1">
            <Btn icon={<Sun className="w-3 h-3" />}    label="Day"      active={lighting==='day'}      onClick={()=>setLighting('day')} />
            <Btn icon={<Moon className="w-3 h-3" />}   label="Low"      active={lighting==='lowlight'} onClick={()=>setLighting('lowlight')} />
            <Btn icon={<Moon className="w-3 h-3" />}   label="IR"       active={lighting==='night-ir'} onClick={()=>setLighting('night-ir')} />
          </div>
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-1">
            <Btn label="Clear" active={weather==='clear'} onClick={()=>setWeather('clear')} />
            <Btn icon={<CloudFog className="w-3 h-3" />} label="Fog"  active={weather==='fog'}   onClick={()=>setWeather('fog')} />
            <Btn label="Rain"  active={weather==='rain'}  onClick={()=>setWeather('rain')} />
          </div>
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3 text-muted-foreground" />
            <input
              type="range"
              min={0}
              max={4}
              value={crowd}
              onChange={(e) => setCrowd(Number(e.target.value))}
              className="w-16 h-1 accent-primary"
            />
            <span className="text-[9px] tabular-nums text-muted-foreground w-3">{crowd}</span>
          </div>
          <div className="h-4 w-px bg-border/60" />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Conf</span>
            <span className={`text-[12px] tabular-nums font-medium ${tone}`}>{confidence}%</span>
          </div>
          <button
            onClick={onClose}
            className="ml-1 p-1 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </>
  );
}

function Btn({ icon, label, active, onClick }: { icon?: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
