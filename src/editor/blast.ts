import type { BlastRadius, Model } from "@/model";

/**
 * What the canvas shows at one step of a blast radius: every element reached so far with its hop,
 * and the relationships that carried impact, with the way impact runs along each line.
 * Step 0 is the start element alone; step k adds the elements reached at hop k.
 */
export type BlastView = {
  nodes: Map<string, { hop: number; current: boolean }>;
  /** `forward`: impact runs along the line's own direction (from → to); otherwise against it. */
  edges: Map<string, { current: boolean; forward: boolean }>;
};

const clamp = (r: BlastRadius, k: number) => Math.max(0, Math.min(k, r.steps.length - 1));

export function blastView(model: Model, r: BlastRadius, step: number): BlastView {
  const view: BlastView = { nodes: new Map(), edges: new Map() };
  if (!r.steps.length) return view;
  const k = clamp(r, step);
  const to = new Map(model.edges.map((e) => [e.id, e.to]));
  for (const s of r.steps.slice(0, k + 1)) {
    const current = s.hop === k;
    for (const id of s.nodeIds) view.nodes.set(id, { hop: s.hop, current });
    for (const id of s.edgeIds) view.edges.set(id, { current, forward: s.nodeIds.includes(to.get(id) ?? "") });
  }
  return view;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const verb = (r: BlastRadius) => (r.direction === "impact" ? "affected" : "needed");
const hops = (r: BlastRadius) => Math.max(0, r.steps.length - 1);

/** "Hop 2 of 4 · 2 of 6 affected" — the control strip's progress line. */
export function blastProgress(r: BlastRadius, step: number): string {
  const k = clamp(r, step);
  const where = k === 0 ? "Start" : `Hop ${k} of ${hops(r)}`;
  if (r.reached === 0) return `${where} · nothing ${verb(r)}`;
  const sofar = r.steps.slice(1, k + 1).reduce((n, s) => n + s.nodeIds.length, 0);
  return `${where} · ${sofar} of ${r.reached} ${verb(r)}`;
}

/** What a screen reader hears at each step (the editor's status line). */
export function blastAnnouncement(r: BlastRadius, step: number, nameOf: (id: string) => string): string {
  const k = clamp(r, step);
  const start = nameOf(r.start);
  if (k > 0) return `Hop ${k}: ${r.steps[k]!.nodeIds.map(nameOf).join(", ")} ${verb(r)}.`;
  const limit = r.truncated ? " (stopped at the hop limit)" : "";
  if (r.direction === "impact") {
    if (r.reached === 0) return `Blast radius: nothing is affected if ${start} fails. No relationship carries impact from it.`;
    return `Blast radius: if ${start} fails, ${plural(r.reached, "element")} ${r.reached === 1 ? "is" : "are"} affected within ${plural(hops(r), "hop")}${limit}.`;
  }
  if (r.reached === 0) return `Dependencies: ${start} needs nothing. No relationship that carries impact leads from it.`;
  return `Dependencies: ${start} needs ${plural(r.reached, "element")} within ${plural(hops(r), "hop")}${limit}.`;
}

/** Every step with the names it reached, for the step list. */
export function blastSteps(r: BlastRadius, nameOf: (id: string) => string): { hop: number; label: string; names: string[] }[] {
  return r.steps.map((s) => ({
    hop: s.hop,
    label: s.hop === 0 ? (r.direction === "impact" ? "Failed" : "Start") : `Hop ${s.hop}`,
    names: s.nodeIds.map(nameOf),
  }));
}
