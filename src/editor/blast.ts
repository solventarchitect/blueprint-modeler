import type { BlastRadius, Model } from "@/model";

/**
 * What the canvas shows at one step of a blast radius: every element reached so far with its hop,
 * and the relationships that carried impact, with the way impact runs along each line.
 * Step 0 is the start element alone; step k adds the elements reached at hop k.
 */
export type BlastView = {
  nodes: Map<string, { hop: number; current: boolean }>;
  /**
   * `forward`: impact runs along the line's own direction (from → to); otherwise against it. In the
   * Dependencies view the walk runs against impact, so the newly reached element is where impact comes from.
   */
  edges: Map<string, { current: boolean; forward: boolean }>;
};

/**
 * `blast`: a blast radius (impact or dependencies). `flow`: a data flow from a Business Capability or
 * Business Process, the same walk as its dependencies, shown as data travelling toward each element
 * it reaches.
 */
export type BlastKind = "blast" | "flow";

const clamp = (r: BlastRadius, k: number) => Math.max(0, Math.min(k, r.steps.length - 1));

export function blastView(model: Model, r: BlastRadius, step: number, kind: BlastKind = "blast"): BlastView {
  const view: BlastView = { nodes: new Map(), edges: new Map() };
  if (!r.steps.length) return view;
  const k = clamp(r, step);
  const to = new Map(model.edges.map((e) => [e.id, e.to]));
  for (const s of r.steps.slice(0, k + 1)) {
    const current = s.hop === k;
    for (const id of s.nodeIds) view.nodes.set(id, { hop: s.hop, current });
    for (const id of s.edgeIds) {
      const towardReached = s.nodeIds.includes(to.get(id) ?? "");
      // Impact belongs to the relationship (toward the dependent); data travels with the walk.
      const forward = kind === "flow" ? towardReached : r.direction === "impact" ? towardReached : !towardReached;
      view.edges.set(id, { current, forward });
    }
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

/** "Step 2 of 3 · 5 of 8 reached" — the data flow strip's progress line. */
export function flowProgress(r: BlastRadius, step: number): string {
  const k = clamp(r, step);
  const where = k === 0 ? "Source" : `Step ${k} of ${hops(r)}`;
  if (r.reached === 0) return `${where} · nothing reached`;
  const sofar = r.steps.slice(1, k + 1).reduce((n, s) => n + s.nodeIds.length, 0);
  return `${where} · ${sofar} of ${r.reached} reached`;
}

/** What a screen reader hears at each step of a data flow. */
export function flowAnnouncement(r: BlastRadius, step: number, nameOf: (id: string) => string): string {
  const k = clamp(r, step);
  const start = nameOf(r.start);
  if (k > 0) return `Step ${k}: data reaches ${r.steps[k]!.nodeIds.map(nameOf).join(", ")}.`;
  if (r.reached === 0) return `Data flow: nothing follows from ${start}. No relationship carries data from it.`;
  const limit = r.truncated ? " (stopped at the step limit)" : "";
  return `Data flow: from ${start}, data reaches ${plural(r.reached, "element")} in ${plural(hops(r), "step")}${limit}.`;
}

/** Every step of a data flow with the names it reached, for the step list. */
export function flowSteps(r: BlastRadius, nameOf: (id: string) => string): { hop: number; label: string; names: string[] }[] {
  return r.steps.map((s) => ({ hop: s.hop, label: s.hop === 0 ? "Source" : `Step ${s.hop}`, names: s.nodeIds.map(nameOf) }));
}
