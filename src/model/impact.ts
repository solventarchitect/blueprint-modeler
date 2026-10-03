import { impactRule, relationshipsBetween, type ImpactRule } from "@/metamodel";
import type { Edge, Model } from "./schema";

/**
 * Blast radius: starting from one element, walk the model hop by hop along relationships that
 * spread impact (see `impactRule`).
 * - "impact": what is affected if the element fails (its dependents, their dependents, …);
 * - "dependencies": what the element relies on (the same walk the other way).
 * Each element appears once, at its nearest hop. Relationships the metamodel does not allow, or
 * that do not spread impact, are not followed.
 */
export type BlastDirection = "impact" | "dependencies";
export type BlastStep = { hop: number; nodeIds: string[]; edgeIds: string[] };
export type BlastRadius = {
  start: string;
  direction: BlastDirection;
  steps: BlastStep[];
  /** Elements reached, not counting the start. */
  reached: number;
  /** True when the hop limit stopped the walk before it ran out of elements. */
  truncated: boolean;
};

export const MAX_HOPS = 12;

/** The dependent and depended-on element of an edge, or null when the edge does not spread impact. */
export function impactEnds(model: Model, edge: Edge): { dependent: string; dependency: string; rule: ImpactRule } | null {
  const cls = (id: string) => model.nodes.find((n) => n.id === id)?.class ?? "";
  const from = cls(edge.from);
  const to = cls(edge.to);
  const forward = relationshipsBetween(from, to).find((r) => r.types.includes(edge.type) || (r.legacyTypes ?? []).includes(edge.type));
  if (forward) {
    const rule = impactRule(forward);
    if (rule.dependent === "none") return null;
    return rule.dependent === "from" ? { dependent: edge.from, dependency: edge.to, rule } : { dependent: edge.to, dependency: edge.from, rule };
  }
  // Older files drew some pairs the other way round; the definition's "from" is this edge's "to".
  const reverse = relationshipsBetween(to, from).find((r) => (r.legacyReverse ?? []).includes(edge.type));
  if (reverse) {
    const rule = impactRule(reverse);
    if (rule.dependent === "none") return null;
    return rule.dependent === "from" ? { dependent: edge.to, dependency: edge.from, rule } : { dependent: edge.from, dependency: edge.to, rule };
  }
  return null;
}

export function blastRadius(model: Model, startId: string, direction: BlastDirection = "impact", maxHops = MAX_HOPS): BlastRadius {
  const empty = { start: startId, direction, steps: [], reached: 0, truncated: false };
  if (!model.nodes.some((n) => n.id === startId)) return empty;

  // For each element, the edges along which impact leaves it (in the chosen direction).
  const out = new Map<string, { edgeId: string; next: string }[]>();
  for (const e of model.edges) {
    const ends = impactEnds(model, e);
    if (!ends) continue;
    const [here, next] = direction === "impact" ? [ends.dependency, ends.dependent] : [ends.dependent, ends.dependency];
    out.set(here, [...(out.get(here) ?? []), { edgeId: e.id, next }]);
  }

  const order = new Map(model.nodes.map((n, i) => [n.id, i]));
  const byModelOrder = (a: string, b: string) => (order.get(a) ?? 0) - (order.get(b) ?? 0);
  const edgeOrder = new Map(model.edges.map((e, i) => [e.id, i]));
  const seen = new Set([startId]);
  const steps: BlastStep[] = [{ hop: 0, nodeIds: [startId], edgeIds: [] }];
  let frontier = [startId];
  let truncated = false;

  while (frontier.length) {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    for (const id of frontier) {
      for (const { edgeId, next } of out.get(id) ?? []) {
        // Elements join `seen` after the hop, so every edge into a newly reached element is kept;
        // edges between two elements first reached in the same hop are not part of any step.
        if (seen.has(next)) continue;
        nodeIds.add(next);
        edgeIds.add(edgeId);
      }
    }
    if (!nodeIds.size) break;
    if (steps.length > maxHops) {
      truncated = true;
      break;
    }
    for (const id of nodeIds) seen.add(id);
    steps.push({
      hop: steps.length,
      nodeIds: [...nodeIds].sort(byModelOrder),
      edgeIds: [...edgeIds].sort((a, b) => (edgeOrder.get(a) ?? 0) - (edgeOrder.get(b) ?? 0)),
    });
    frontier = [...nodeIds];
  }

  return { start: startId, direction, steps, reached: seen.size - 1, truncated };
}
