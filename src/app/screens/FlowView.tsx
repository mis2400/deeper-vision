import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AppShell } from '../components/AppShell';

interface Node { id: string; label: string; sub: string; route: string; col: number; row: number; }
interface Edge { from: string; to: string; }

const NODES: Node[] = [
  { id: 'intake',  label: 'Site intake',     sub: 'Client & threat profile', route: '/intake',                  col: 0, row: 1 },
  { id: 'walk',    label: 'Site walk',       sub: 'Photos & notes',          route: '/project/p1/site-walk',    col: 1, row: 0 },
  { id: 'cal',     label: 'Calibrate',       sub: 'Set plan scale',          route: '/project/p1/calibrate',    col: 1, row: 2 },
  { id: 'canvas',  label: 'Design canvas',   sub: 'Place devices, draw FOV', route: '/project/p1/canvas',       col: 2, row: 1 },
  { id: 'threat',  label: 'Threat sim',      sub: 'Run scenarios',           route: '/project/p1/threat',       col: 3, row: 0 },
  { id: 'power',   label: 'Power & cable',   sub: 'IDFs, PoE, runs',         route: '/project/p1/power',        col: 3, row: 2 },
  { id: 'estim',   label: 'Estimator',       sub: 'Cost roll-up',            route: '/project/p1/estimator',    col: 4, row: 1 },
  { id: 'prop',    label: 'Proposal',        sub: 'Send to client',          route: '/project/p1/proposal',     col: 5, row: 1 },
  { id: 'permit',  label: 'Permit packet',   sub: 'Stamp & submit',          route: '/project/p1/permit',       col: 6, row: 0 },
  { id: 'work',    label: 'Work orders',     sub: 'Install tasks',           route: '/project/p1/work-orders',  col: 6, row: 1 },
  { id: 'commish', label: 'Commission',      sub: 'Acceptance tests',        route: '/project/p1/commission',   col: 6, row: 2 },
  { id: 'live',    label: 'Operate',         sub: 'Live integration',        route: '/project/p1/live',         col: 7, row: 1 },
];

const EDGES: Edge[] = [
  { from: 'intake', to: 'walk' }, { from: 'intake', to: 'cal' },
  { from: 'walk', to: 'canvas' }, { from: 'cal', to: 'canvas' },
  { from: 'canvas', to: 'threat' }, { from: 'canvas', to: 'power' },
  { from: 'threat', to: 'estim' }, { from: 'power', to: 'estim' },
  { from: 'estim', to: 'prop' },
  { from: 'prop', to: 'permit' }, { from: 'prop', to: 'work' }, { from: 'prop', to: 'commish' },
  { from: 'permit', to: 'live' }, { from: 'work', to: 'live' }, { from: 'commish', to: 'live' },
];

const COL_W = 180;
const ROW_H = 110;
const NODE_W = 150;
const NODE_H = 64;

export function FlowView() {
  const { projectId = 'p1' } = useParams();
  const nav = useNavigate();
  const [hover, setHover] = useState<string | null>(null);

  const pos = (n: Node) => ({ x: n.col * COL_W + 30, y: n.row * ROW_H + 30 });
  const byId = (id: string) => NODES.find((n) => n.id === id)!;

  const width = 8 * COL_W;
  const height = 3 * ROW_H + 60;

  return (
    <AppShell
      crumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Flow' }]}
      title="Project flow"
      subtitle="Every phase of this project, end to end"
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="bg-card border border-border rounded-lg p-4 overflow-auto">
          <svg width={width} height={height} className="block">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#30363D" />
              </marker>
            </defs>
            {EDGES.map((e, i) => {
              const a = pos(byId(e.from));
              const b = pos(byId(e.to));
              const x1 = a.x + NODE_W;
              const y1 = a.y + NODE_H / 2;
              const x2 = b.x;
              const y2 = b.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              return <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="#30363D" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)" />;
            })}
            {NODES.map((n) => {
              const p = pos(n);
              const active = hover === n.id;
              return (
                <g key={n.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer" onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onClick={() => nav(n.route.replace('p1', projectId))}>
                  <rect width={NODE_W} height={NODE_H} rx="6" fill="#161B22" stroke={active ? '#2F81F7' : '#30363D'} strokeWidth="1.5" />
                  <text x="12" y="24" fill="#E6EDF3" fontSize="13">{n.label}</text>
                  <text x="12" y="44" fill="#7D8590" fontSize="11">{n.sub}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="text-xs text-muted-foreground mt-3">Click any node to open that step.</div>
      </div>
    </AppShell>
  );
}
