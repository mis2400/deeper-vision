// Product catalog — /catalog
//
// Browse the sample product catalog with manufacturer / category / tech-
// model filters. Reads from src/app/lib/productCatalog.ts. Labelled
// clearly as a sample — the real database is not yet connected.

import { useMemo, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Search, X, Filter } from 'lucide-react';
import { SAMPLE_PRODUCTS, type Product, type ProductCategory } from '../lib/productCatalog';
import type { ProjectTechModel } from '../store/types';
import { useProjectStore } from '../store/projectStore';
import { useParams } from 'react-router';

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  camera: 'Cameras', reader: 'Readers', lock: 'Locks',
  intercom: 'Intercoms', intrusion: 'Intrusion', speaker: 'Speakers / PA',
  av: 'AV', network: 'Networking', power: 'Power',
  cable: 'Wire & Cable', conduit: 'Conduit', gate: 'Gates',
  elevator: 'Elevators', sensor: 'Sensors', rack: 'Racks',
  controller: 'Controllers', recorder: 'Recorders',
};

export function ProductCatalog() {
  const { projectId } = useParams();
  // Default the tech-model filter to the active project's tech model if
  // available — opening the catalog in the context of a project should
  // immediately mirror what the canvas's InsertDock is showing.
  const projectTechModelsMap = useProjectStore((s) => s.projectTechModels);
  const projectTechModel = projectId ? projectTechModelsMap[projectId] : undefined;
  const [q, setQ] = useState('');
  const [mfrFilter, setMfrFilter] = useState<string | 'all'>('all');
  const [catFilter, setCatFilter] = useState<ProductCategory | 'all'>('all');
  const [techFilter, setTechFilter] = useState<ProjectTechModel | 'all'>(projectTechModel ?? 'all');
  const [ndaaOnly, setNdaaOnly] = useState(false);

  const manufacturers = useMemo(() => {
    const set = new Set<string>(SAMPLE_PRODUCTS.map((p) => p.manufacturer));
    return Array.from(set).sort();
  }, []);

  const categories = useMemo(() => {
    const counts: Partial<Record<ProductCategory, number>> = {};
    for (const p of SAMPLE_PRODUCTS) counts[p.category] = (counts[p.category] ?? 0) + 1;
    return Object.keys(counts).sort() as ProductCategory[];
  }, []);

  const filtered = useMemo(() => {
    let list = SAMPLE_PRODUCTS;
    if (mfrFilter !== 'all') list = list.filter((p) => p.manufacturer === mfrFilter);
    if (catFilter !== 'all') list = list.filter((p) => p.category === catFilter);
    if (techFilter !== 'all') list = list.filter((p) => p.techModels.includes(techFilter as ProjectTechModel));
    if (ndaaOnly)            list = list.filter((p) => p.ndaa);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((p) => `${p.manufacturer} ${p.model} ${p.productLine ?? ''} ${p.notes ?? ''}`.toLowerCase().includes(needle));
    }
    return list;
  }, [q, mfrFilter, catFilter, techFilter, ndaaOnly]);

  return (
    <AppShell
      crumbs={[{ label: 'Product catalog' }]}
      title="Product catalog"
      subtitle={`${SAMPLE_PRODUCTS.length} products · ${manufacturers.length} manufacturers · sample data`}
    >
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">

        {/* ── Project context (when opened from a project URL) ── */}
        {projectTechModel && (
          <div className="bg-primary/8 border border-primary/30 rounded-lg px-4 py-2.5 text-[11px] text-primary/90 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" />
            Showing products for the active project's <strong className="mx-1">{projectTechModel === 'on_prem' ? 'on-prem' : projectTechModel}</strong> stack.
            <button onClick={() => setTechFilter('all')} className="ml-auto text-[11px] underline opacity-80 hover:opacity-100">
              Show all stacks
            </button>
          </div>
        )}

        {/* ── Sample notice ───────────────────────────────────── */}
        <div className="bg-amber-500/8 border border-amber-500/30 rounded-lg px-4 py-2.5 text-[11px] text-amber-200/90 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-amber-300/80" />
          Sample product catalog. Manufacturer database, distributor pricing, and live lead-times are not yet connected — these entries are representative SKUs across the major manufacturers, kept honest about coverage.
        </div>

        {/* ── Filter bar ──────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search manufacturer, model, line, notes"
              className="w-full bg-input-background border border-input-border rounded-md pl-8 pr-3 h-9 text-[12px] focus:outline-none focus:border-primary/60"
            />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Select label="Manufacturer" value={mfrFilter} options={[{ id: 'all', label: 'All manufacturers' }, ...manufacturers.map((m) => ({ id: m, label: m }))]} onChange={setMfrFilter as any} />
          <Select label="Category" value={catFilter} options={[{ id: 'all', label: 'All categories' }, ...categories.map((c) => ({ id: c, label: CATEGORY_LABEL[c] }))]} onChange={setCatFilter as any} />
          <Select label="Tech model" value={techFilter} options={[
            { id: 'all', label: 'Any' },
            { id: 'cloud', label: 'Cloud' },
            { id: 'on_prem', label: 'On-prem' },
            { id: 'hybrid', label: 'Hybrid' },
          ]} onChange={setTechFilter as any} />
          <label className="inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground cursor-pointer">
            <input type="checkbox" checked={ndaaOnly} onChange={(e) => setNdaaOnly(e.target.checked)} className="accent-primary" />
            NDAA only
          </label>
          <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">{filtered.length} of {SAMPLE_PRODUCTS.length}</span>
        </div>

        {/* ── Product table ────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-[11px] text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Product</th>
                <th className="text-left px-4 py-2.5 font-medium">Category</th>
                <th className="text-left px-4 py-2.5 font-medium">Stack</th>
                <th className="text-left px-4 py-2.5 font-medium">PoE</th>
                <th className="text-left px-4 py-2.5 font-medium">NDAA / ONVIF</th>
                <th className="text-left px-4 py-2.5 font-medium">Resolution</th>
                <th className="text-right px-4 py-2.5 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[12px] text-muted-foreground">No products match.</td></tr>
              ) : filtered.map((p) => <ProductRow key={p.id} p={p} />)}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function ProductRow({ p }: { p: Product }) {
  return (
    <tr className="border-t border-border/70 hover:bg-secondary/20">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-100">{p.manufacturer}{p.productLine ? <span className="text-muted-foreground"> · {p.productLine}</span> : null}</div>
        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.model}</div>
      </td>
      <td className="px-4 py-3 text-[12px]">
        <span className="text-slate-200">{CATEGORY_LABEL[p.category]}</span>
        {p.subcategory && <div className="text-[11px] text-muted-foreground">{p.subcategory}</div>}
      </td>
      <td className="px-4 py-3">
        <div className="inline-flex flex-wrap gap-1">
          {p.techModels.map((m) => (
            <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60 text-slate-200">
              {m === 'on_prem' ? 'on-prem' : m}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-[12px] text-slate-200">
        {p.poeClass ? `Class ${p.poeClass}${p.powerW ? ` · ${p.powerW}W` : ''}` : (p.powerW ? `${p.powerW}W` : <span className="text-muted-foreground">—</span>)}
      </td>
      <td className="px-4 py-3 text-[12px]">
        <div className="inline-flex gap-1.5">
          {p.ndaa && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">NDAA</span>}
          {p.onvifProfile && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">ONVIF {p.onvifProfile}</span>}
          {!p.ndaa && !p.onvifProfile && <span className="text-muted-foreground">—</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-[12px] text-slate-200">{p.resolution ?? <span className="text-muted-foreground">—</span>}</td>
      <td className="px-4 py-3 text-right text-[11px] text-muted-foreground max-w-[280px] truncate">{p.notes ?? '—'}</td>
    </tr>
  );
}

function Select<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-input-background border border-input-border rounded-md px-2 h-8 text-[12px] text-slate-200 focus:outline-none focus:border-primary/60"
      >
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}
