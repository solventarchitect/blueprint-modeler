import { acceptedTypes, allowedTypes, isClassId } from "@/metamodel";
import type { Edge, Model } from "./schema";

/**
 * M89: what changing an element's class does to its relationships. Each one is kept as written when
 * CSDM accepts its type between the two classes as they would be (older types too); otherwise it takes
 * the type CSDM allows between them in the same direction; otherwise it is removed. A new type that
 * would repeat a relationship already there is removed too, and so is a relationship from the element to
 * itself that isn't accepted as written. Direction is never changed here.
 */
export type ClassChange = {
  kept: Edge[];
  retyped: { edge: Edge; type: string }[];
  removed: { edge: Edge; why: "not-allowed" | "duplicate" }[];
};

/** Null when there is nothing to change: no such element, an unknown class, or the class it already has. */
export function classChange(model: Model, id: string, cls: string): ClassChange | null {
  const node = model.nodes.find((n) => n.id === id);
  if (!node || !isClassId(cls) || node.class === cls) return null;
  const classOf = (nid: string) => (nid === id ? cls : (model.nodes.find((n) => n.id === nid)?.class ?? ""));
  const key = (from: string, to: string, type: string) => `${from}\u0000${to}\u0000${type}`;
  const mine = model.edges.filter((e) => e.from === id || e.to === id);
  const out: ClassChange = { kept: [], retyped: [], removed: [] };
  // What stays as written first, so a new type never repeats one of them, whatever the order.
  const taken = new Set(model.edges.filter((e) => !mine.includes(e)).map((e) => key(e.from, e.to, e.type)));
  const rest: Edge[] = [];
  for (const e of mine) {
    if (acceptedTypes(classOf(e.from), classOf(e.to)).includes(e.type)) {
      out.kept.push(e);
      taken.add(key(e.from, e.to, e.type));
    } else rest.push(e);
  }
  for (const e of rest) {
    // Nothing relates to itself: a loop that isn't accepted as written is not given another type.
    const type = e.from === e.to ? undefined : allowedTypes(classOf(e.from), classOf(e.to))[0];
    if (!type) out.removed.push({ edge: e, why: "not-allowed" });
    else if (taken.has(key(e.from, e.to, type))) out.removed.push({ edge: e, why: "duplicate" });
    else {
      out.retyped.push({ edge: e, type });
      taken.add(key(e.from, e.to, type));
    }
  }
  return out;
}

/** The model with the element's class changed and its relationships as classChange says. The same model when there is nothing to change. */
export function withClass(model: Model, id: string, cls: string): Model {
  const change = classChange(model, id, cls);
  if (!change) return model;
  const gone = new Set(change.removed.map((r) => r.edge.id));
  const type = new Map(change.retyped.map((r) => [r.edge.id, r.type]));
  return {
    ...model,
    nodes: model.nodes.map((n) => (n.id === id ? { ...n, class: cls } : n)),
    edges: model.edges.filter((e) => !gone.has(e.id)).map((e) => (type.has(e.id) ? { ...e, type: type.get(e.id)! } : e)),
  };
}
