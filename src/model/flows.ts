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
 * A flow as a walk the blast radius strip can play: step 0 is where the first step leaves, step k the
 * element the k-th step reaches, along its relationship. A step whose relationship is gone is skipped.
 */
export function flowRadius(model: Model, flow: Flow): BlastRadius {
  const walked = flow.steps.flatMap((s) => {
    const e = ends(model, s);
    return e ? [{ ...e, edge: s.edge }] : [];
  });
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
