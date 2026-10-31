/**
 * Saved flows (M70): a named walk through the model, one relationship a step ("customer places an
 * order"), played like a data flow with each element numbered as the walk reaches it. Pure.
 */
import type { BlastRadius } from "./impact";
import type { Flow, FlowStep, Model } from "./schema";

const ends = (model: Model, s: FlowStep) => {
  const e = model.edges.find((x) => x.id === s.edge);
  return e ? { from: s.back ? e.to : e.from, to: s.back ? e.from : e.to, type: e.type } : null;
};

/**
 * The steps of a flow that still make one unbroken walk: each along a relationship in the model,
 * each leaving where the one before arrived. The walk is cut at the first step that doesn't.
 */
export function unbrokenSteps(model: Model, flow: Flow): FlowStep[] {
  const kept: FlowStep[] = [];
  let at: string | null = null;
  for (const s of flow.steps) {
    const e = ends(model, s);
    if (!e || (at !== null && e.from !== at)) break;
    kept.push(s);
    at = e.to;
  }
  return kept;
}

/** The model with every flow cut where its walk breaks (a relationship gone or turned round); the same model when none does. */
export function withUnbrokenFlows(model: Model): Model {
  if (!model.flows?.length) return model;
  let changed = false;
  const flows = model.flows.map((f) => {
    const steps = unbrokenSteps(model, f);
    if (steps.length === f.steps.length) return f;
    changed = true;
    return { ...f, steps };
  });
  return changed ? { ...model, flows } : model;
}

/**
 * A flow as a walk the blast radius strip can play: step 0 is where the first step leaves, step k the
 * element the k-th step reaches, along its relationship. It stops where the walk breaks.
 */
export function flowRadius(model: Model, flow: Flow): BlastRadius {
  const walked = unbrokenSteps(model, flow).map((s) => ({ ...ends(model, s)!, edge: s.edge }));
  if (!walked.length) return { start: "", direction: "dependencies", steps: [], reached: 0, truncated: false };
  const start = walked[0]!.from;
  return {
    start,
    direction: "dependencies",
    steps: [{ hop: 0, nodeIds: [start], edgeIds: [] }, ...walked.map((w, i) => ({ hop: i + 1, nodeIds: [w.to], edgeIds: [w.edge] }))],
    reached: new Set(walked.map((w) => w.to).filter((id) => id !== start)).size,
    truncated: false,
  };
}

/** The steps that can follow from an element: each of its relationships, walked away from it. */
export function nextSteps(model: Model, from: string): (FlowStep & { to: string })[] {
  return model.edges.flatMap((e) => (e.from === from ? [{ edge: e.id, to: e.to }] : e.to === from ? [{ edge: e.id, back: true as const, to: e.from }] : []));
}

/** The CSDM label for the way a step walks: the parent's label forward ("Runs on"), the child's backward ("Used by"). */
const label = (type: string, back?: boolean) => {
  if (type.startsWith("reference:")) return back ? `referenced by its “${type.slice(10)}” field` : `references through “${type.slice(10)}”`;
  const [parent, child] = type.split("::");
  return (back ? child : parent) ?? parent ?? type;
};

/** One step in words: "Checkout web app → web-prod-01 (Runs on)". */
export function flowStepText(model: Model, s: FlowStep): string {
  const e = ends(model, s);
  if (!e) return "A relationship that is no longer in the model";
  const name = (id: string) => model.nodes.find((n) => n.id === id)?.name || "Untitled";
  return `${name(e.from)} → ${name(e.to)} (${label(e.type, s.back)})`;
}
