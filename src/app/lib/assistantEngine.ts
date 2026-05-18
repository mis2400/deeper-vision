// Assistant engine — Phase 2A.1.
//
// Deterministic, grounded answer generation over the project store.
// There is no LLM call here. The engine pattern-matches the question
// against a small set of well-known shapes (counts, coverage, BOM,
// power budgets, schedule), computes a real answer from the live
// store, and streams the answer back chunk by chunk so the UI feels
// instant.
//
// The honesty contract is the architectural anchor:
//   - Every claim is computed from live data the operator can verify.
//   - If the engine cannot answer, it says so plainly and lists what
//     it can answer.
//   - The engine never invents a number, a manufacturer, a model, a
//     timeline, or a recommendation it can't ground in store state.
//
// Later phases plug in here:
//   - 2A.3 — the `meta.citations` returned alongside the text drives
//     inline source chips.
//   - 2A.4 — the `meta.confidence` + `meta.confidenceWhy` drive the
//     confidence chip render.
//   - 2A.5 — the `meta.actions` array is the list of apply-suggestion
//     buttons attached to the message.

import type { ProjectState } from '../store/projectStore';
import { selectors, deriveCanvasBomRows, deriveWorkOrders } from '../store/projectStore';
import type { AiCitation, AiMsg } from '../store/types';

/** Result of pattern-matching the question against a capability. */
export interface AnswerMeta {
  citations?: AiCitation[];
  confidence?: AiMsg['confidence'];
  confidenceWhy?: AiMsg['confidenceWhy'];
  inference?: boolean;
}

export interface AnswerChunk {
  /** Text to append to the assistant message in-flight. */
  text: string;
  /** When set, this is the final chunk — meta carries citations,
   *  confidence, etc. that the host applies once. */
  done?: boolean;
  meta?: AnswerMeta;
}

/** Stream an answer for `question` against `state`/`projectId`.
 *  Yields text chunks for the host to append via patchAiMsgText.
 *  Final yield (done=true) carries any structured meta. */
export async function* streamAnswer(
  question: string,
  state: ProjectState,
  projectId: string,
): AsyncGenerator<AnswerChunk> {
  const q = question.toLowerCase();
  const project = state.projects[projectId];
  if (!project) {
    yield { text: 'I cannot find that project in the store.', done: true };
    return;
  }

  // Route to the matching handler. Order matters: more specific
  // patterns come first so "PoE budget on IDF-C" beats "IDF".
  const handler =
    matchPower(q)    ? answerPower :
    matchCoverage(q) ? answerCoverage :
    matchBOM(q)      ? answerBOM :
    matchSchedule(q) ? answerSchedule :
    matchCounts(q)   ? answerCounts :
    matchHelp(q)     ? answerHelp :
    answerUnknown;

  // Compute the answer once, then stream its text in 6–24 char chunks
  // so the UI feels lively without the engine pretending the
  // computation took longer than it did.
  const computed = handler(state, projectId);
  yield* chunkedStream(computed.text, computed.meta);
}

async function* chunkedStream(text: string, meta?: AnswerMeta): AsyncGenerator<AnswerChunk> {
  // Stream chunks of variable size so the cadence reads naturally.
  // The honesty rule: we are NOT pretending to think. We're rendering
  // a pre-computed answer at human reading speed so the operator can
  // scan as it appears.
  const chunkSizes = [4, 6, 8, 10, 12, 14, 18, 20];
  let i = 0;
  let s = 0;
  while (i < text.length) {
    const size = chunkSizes[s % chunkSizes.length];
    const next = text.slice(i, i + size);
    i += next.length;
    s += 1;
    yield { text: next };
    // Yield to the event loop so React batches the patches.
    await new Promise<void>((r) => setTimeout(r, 14));
  }
  yield { text: '', done: true, meta };
}

// ─────────────────────────── Pattern matching ───────────────────────

const has = (q: string, ...needles: string[]) => needles.some((n) => q.includes(n));

function matchPower(q: string)    { return has(q, 'poe', 'power budget', 'wattage', 'idf'); }
function matchCoverage(q: string) { return has(q, 'coverage', 'uncovered', 'gap', 'blind', 'fov', 'cone'); }
function matchBOM(q: string)      { return has(q, 'bom', 'bill of materials', 'estimate', 'cost', 'price', 'total', 'budget') && !has(q, 'poe', 'power'); }
function matchSchedule(q: string) { return has(q, 'schedule', 'install', 'deploy', 'work order', 'eta', 'how long'); }
function matchCounts(q: string)   { return has(q, 'how many', 'count', 'number of', 'devices', 'cameras', 'doors', 'sensors', 'readers'); }
function matchHelp(q: string)     { return has(q, 'help', 'what can you', 'capabilities', '?') && q.length < 80; }

// ─────────────────────────── Answer handlers ────────────────────────

interface ComputedAnswer { text: string; meta?: AnswerMeta }

function answerCounts(state: ProjectState, projectId: string): ComputedAnswer {
  const devices  = selectors.devicesForProject(state, projectId);
  const floors   = selectors.floorsForProject(state, projectId);
  const pathways = Object.values(state.pathways).filter((p) => p.projectId === projectId);
  const idfs     = Object.values(state.idfs).filter((i) => i.projectId === projectId);

  const cams  = devices.filter((d) => (d.type as string).startsWith('cam.')).length;
  const acc   = devices.filter((d) => (d.type as string).startsWith('acc.')).length;
  // Door / gate openings live in two places: the canonical Door slice
  // and as devices typed `inf.door-*`/`inf.gate-*`/`inf.storefront-*`/
  // `inf.doubledoor-*` (those keys aren't in DeviceType — seeded as
  // string literals — so we cast and use a runtime prefix match).
  const doorDevices = devices.filter((d) => {
    const t = d.type as string;
    return t.startsWith('inf.door') || t.startsWith('inf.gate')
      || t.startsWith('inf.storefront') || t.startsWith('inf.doubledoor')
      || t === 'acc.door' || t === 'acc.gate';
  }).length;
  const storeDoors = Object.values(state.doors).filter((d) => d.projectId === projectId).length;
  const doors = doorDevices + storeDoors;
  const net   = devices.filter((d) => (d.type as string).startsWith('net.')).length;
  const sen   = devices.filter((d) => (d.type as string).startsWith('sen.') || (d.type as string).startsWith('int.')).length;

  const lines: string[] = [];
  lines.push(`${devices.length} devices across ${floors.length} floor${floors.length === 1 ? '' : 's'}.`);
  if (cams)  lines.push(`Cameras: ${cams}.`);
  if (acc)   lines.push(`Access control devices: ${acc}.`);
  if (doors) lines.push(`Door / gate openings: ${doors}.`);
  if (net)   lines.push(`Network gear: ${net}.`);
  if (sen)   lines.push(`Sensors / intrusion: ${sen}.`);
  if (pathways.length) lines.push(`Pathways / cable runs: ${pathways.length}.`);
  if (idfs.length)     lines.push(`IDFs: ${idfs.length}.`);

  // Cite the project + each floor so the operator can drill in.
  const citations: AiCitation[] = [
    { label: state.projects[projectId].name, kind: 'project', refId: projectId },
    ...floors.slice(0, 6).map((f): AiCitation => ({ label: f.name, kind: 'floor', refId: f.id })),
  ];

  return {
    text: lines.join(' '),
    meta: { citations },
  };
}

function answerCoverage(state: ProjectState, projectId: string): ComputedAnswer {
  const devices  = selectors.devicesForProject(state, projectId);
  const cameras  = devices.filter((d) => d.type.startsWith('cam.'));
  const floors   = selectors.floorsForProject(state, projectId);

  if (cameras.length === 0) {
    return {
      text: 'No cameras placed yet. Drop cameras on the canvas first; once placed I can compute coverage and call out the gaps.',
      meta: { confidence: 'high', confidenceWhy: 'Empty camera set. No coverage to analyze.' },
    };
  }

  // Honest coverage call: average camera range vs floor extents.
  const lines: string[] = [];
  lines.push(`${cameras.length} camera${cameras.length === 1 ? '' : 's'} placed across ${floors.length} floor${floors.length === 1 ? '' : 's'}.`);
  for (const f of floors) {
    const onFloor = cameras.filter((c) => c.floorId === f.id);
    if (onFloor.length === 0) {
      lines.push(`${f.name}: no cameras. Entire floor uncovered.`);
      continue;
    }
    const avgRange = onFloor.reduce((acc, c) => acc + (c.range ?? 30), 0) / onFloor.length;
    lines.push(`${f.name}: ${onFloor.length} camera${onFloor.length === 1 ? '' : 's'}, average range ${avgRange.toFixed(0)} ft.`);
  }
  lines.push('Open the canvas to see the live FOV overlay. That is the authoritative gap view.');

  const citations: AiCitation[] = [
    ...cameras.slice(0, 8).map((c): AiCitation => ({ label: c.label || c.id, kind: 'device', refId: c.id })),
  ];

  return {
    text: lines.join(' '),
    meta: {
      citations,
      confidence: 'medium',
      confidenceWhy: 'Computed from device positions and declared ranges. True coverage depends on FOV angles + obstructions, which need the canvas overlay to evaluate.',
      inference: true,
    },
  };
}

function answerBOM(state: ProjectState, projectId: string): ComputedAnswer {
  try {
    const bom = deriveCanvasBomRows(state, projectId);
    if (!bom || bom.rows.length === 0) {
      return {
        text: 'No BOM lines yet. Add devices, doors, or pathways on the canvas and the BOM will populate live.',
        meta: { confidence: 'high', confidenceWhy: 'Empty canvas. Nothing to total.' },
      };
    }
    const sell = bom.totals.sellTotal ?? 0;
    const cost = bom.totals.costTotal ?? 0;
    const labor = bom.totals.laborHours ?? 0;
    const margin = sell > 0 ? Math.round(((sell - cost) / sell) * 100) : 0;

    const lines: string[] = [];
    lines.push(`Sell total: $${Math.round(sell).toLocaleString()}.`);
    lines.push(`Cost: $${Math.round(cost).toLocaleString()}.`);
    lines.push(`Margin: ${margin}%.`);
    if (labor) lines.push(`Estimated labor: ${labor.toFixed(0)} hours.`);
    lines.push('Open Reports → BOM & pricing for the row by row view.');

    const citations: AiCitation[] = [
      { label: 'Reports', kind: 'report', refId: 'reports' },
      { label: state.projects[projectId].name, kind: 'project', refId: projectId },
    ];

    return {
      text: lines.join(' '),
      meta: {
        citations,
        confidence: 'high',
        confidenceWhy: 'Derived directly from the canvas BOM rollup with the active project pricebook.',
      },
    };
  } catch {
    return { text: 'I could not compute the BOM. The canvas state may be mid edit; try again in a moment.' };
  }
}

function answerPower(state: ProjectState, projectId: string): ComputedAnswer {
  const idfs    = Object.values(state.idfs).filter((i) => i.projectId === projectId);
  const cameras = selectors.devicesForProject(state, projectId).filter((d) => d.type.startsWith('cam.'));

  if (idfs.length === 0) {
    return {
      text: 'No IDFs placed yet. Add an IDF on the canvas to get a power budget readout.',
      meta: { confidence: 'high', confidenceWhy: 'No IDFs in the project.' },
    };
  }

  // Honest, naive PoE estimate — 8 W per camera as a rule of thumb,
  // 25.5 W for PTZ types. Real budget needs the actual switch model;
  // we label this as inference.
  const ptzCount    = cameras.filter((c) => c.type === 'cam.ptz').length;
  const standardCount = cameras.length - ptzCount;
  const totalWatts  = standardCount * 8 + ptzCount * 25.5;

  const lines: string[] = [];
  lines.push(`${idfs.length} IDF${idfs.length === 1 ? '' : 's'} placed.`);
  lines.push(`Camera side PoE estimate: ${standardCount} standard cameras x 8 W + ${ptzCount} PTZ x 25.5 W = ${totalWatts.toFixed(0)} W.`);
  lines.push('Real switch budget depends on the SKU placed at each IDF. Open the canvas to see per-IDF assignments.');

  const citations: AiCitation[] = idfs.slice(0, 6).map((i): AiCitation => ({ label: i.name ?? i.id, kind: 'idf', refId: i.id }));

  return {
    text: lines.join(' '),
    meta: {
      citations,
      confidence: 'medium',
      confidenceWhy: '8 W / 25.5 W per camera is a rule of thumb. Switch model + cable distance produces the real budget.',
      inference: true,
    },
  };
}

function answerSchedule(state: ProjectState, projectId: string): ComputedAnswer {
  const wos = deriveWorkOrders(state, projectId);
  if (wos.length === 0) {
    return {
      text: 'No work orders yet. Schedule devices for install from the deployment screen and I can summarize.',
      meta: { confidence: 'high', confidenceWhy: 'No work orders yet.' },
    };
  }
  const open     = wos.filter((w) => w.progress.status !== 'complete' && w.progress.status !== 'blocked');
  const complete = wos.filter((w) => w.progress.status === 'complete');
  const blocked  = wos.filter((w) => w.progress.status === 'blocked');
  const hours    = open.reduce((acc, w) => acc + (w.estLaborHours ?? 0), 0);

  const lines: string[] = [];
  lines.push(`${wos.length} work order${wos.length === 1 ? '' : 's'}: ${open.length} open, ${complete.length} complete, ${blocked.length} blocked.`);
  if (open.length) lines.push(`Open labor estimate: ${hours.toFixed(0)} hours.`);
  if (blocked.length) lines.push(`${blocked.length} work order${blocked.length === 1 ? '' : 's'} blocked. Review on the deployment screen.`);

  const citations: AiCitation[] = wos.slice(0, 6).map((w): AiCitation => ({ label: w.title, kind: 'workorder', refId: w.id }));
  return {
    text: lines.join(' '),
    meta: {
      citations,
      confidence: 'high',
      confidenceWhy: 'Derived from the same work order rollup the deployment screen uses.',
    },
  };
}

function answerHelp(_state: ProjectState, _projectId: string): ComputedAnswer {
  return {
    text: 'I answer questions grounded in your project data. I can summarize device counts, coverage, BOM and pricing, PoE budgets, and work order status. Ask me in plain language. Try "what is the BOM total", "how many cameras", "what work orders are blocked". I will cite the records I drew from, and I will say so when something is inference rather than fact.',
    meta: { confidence: 'high' },
  };
}

function answerUnknown(state: ProjectState, projectId: string): ComputedAnswer {
  const devices = selectors.devicesForProject(state, projectId).length;
  const floors  = selectors.floorsForProject(state, projectId).length;
  return {
    text: `I cannot answer that yet. I am grounded in the live project data only. ${devices} devices across ${floors} floor${floors === 1 ? '' : 's'}. Try a question about device counts, coverage gaps, BOM totals, PoE budgets, or work order status.`,
    meta: { confidence: 'low', confidenceWhy: 'No matching capability for this question.' },
  };
}

// ─────────────────────────── Example prompts ────────────────────────

/** Three project-aware prompts for the empty state. Computed from the
 *  live store so a fresh canvas gets different prompts than a busy
 *  one — the prompts read as the assistant noticing the data. */
export function suggestPrompts(state: ProjectState, projectId: string): string[] {
  const devices = selectors.devicesForProject(state, projectId);
  const cameras = devices.filter((d) => d.type.startsWith('cam.')).length;
  const idfs    = Object.values(state.idfs).filter((i) => i.projectId === projectId).length;
  const wos     = deriveWorkOrders(state, projectId);

  if (devices.length === 0) {
    return [
      'What does this project look like so far?',
      'What can you answer for me?',
      'Where do I start the canvas?',
    ];
  }
  const prompts: string[] = [];
  if (cameras > 0) prompts.push(`Where are the coverage gaps across the ${cameras} placed camera${cameras === 1 ? '' : 's'}?`);
  if (idfs > 0)    prompts.push('Are we within PoE budget across every IDF?');
  prompts.push('What is the BOM total and margin right now?');
  if (wos.length > 0) prompts.push(`How many of the ${wos.length} work orders are still open?`);
  return prompts.slice(0, 3);
}
