/**
 * Focus on an element (M74): the element and everything within 1, 2 or 3 relationships of it, either
 * way; the rest of the model fades, as a filter fades it. Pure.
 */
import type { Model } from "./schema";

export const FOCUS_DEPTHS = [1, 2, 3] as const;
export type FocusDepth = (typeof FOCUS_DEPTHS)[number];

/** The ids of the elements within `depth` relationships of `id`; `skip`: relationships to leave out (the state shown). */
export function focusArea(model: Model, id: string, depth: number, skip: ReadonlySet<string> = new Set()): Set<string> {
  if (!model.nodes.some((n) => n.id === id)) return new Set();
  const next = new Map<string, string[]>();
  for (const e of model.edges) {
    if (skip.has(e.id)) continue;
    next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
    next.set(e.to, [...(next.get(e.to) ?? []), e.from]);
  }
  const area = new Set([id]);
  let ring = [id];
  for (let d = 0; d < depth && ring.length; d++) {
    ring = ring.flatMap((x) => next.get(x) ?? []).filter((x) => !area.has(x));
    for (const x of ring) area.add(x);
  }
  return area;
}
