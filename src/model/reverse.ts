import { allowedTypes } from "@/metamodel";
import type { Model } from "./schema";

/**
 * M90: what turning a relationship round would give. Its type stays where CSDM allows that type in the
 * new direction, otherwise it takes the one CSDM allows that way. Refused (`why`) where CSDM has no
 * relationship that way round, where the result would repeat a relationship already there, and for a
 * relationship from an element to itself. Null when there is no such relationship.
 */
export function reversal(model: Model, id: string): { type: string; retyped: boolean } | { why: "not-allowed" | "duplicate" | "itself" } | null {
  const e = model.edges.find((x) => x.id === id);
  if (!e) return null;
  if (e.from === e.to) return { why: "itself" };
  const classOf = (nid: string) => model.nodes.find((n) => n.id === nid)?.class ?? "";
  const types = allowedTypes(classOf(e.to), classOf(e.from));
  const type = types.includes(e.type) ? e.type : types[0];
  if (!type) return { why: "not-allowed" };
  if (model.edges.some((x) => x.id !== e.id && x.from === e.to && x.to === e.from && x.type === type)) return { why: "duplicate" };
  return { type, retyped: type !== e.type };
}

/**
 * The model with the relationship turned round: ends swapped, each chosen side still on its element,
 * and every flow step along it turned too, so saved flows walk the same way. The same model when it
 * can't be turned.
 */
export function withReversed(model: Model, id: string): Model {
  const r = reversal(model, id);
  if (!r || "why" in r) return model;
  const flows = model.flows?.map((f) => (f.steps.some((s) => s.edge === id) ? { ...f, steps: f.steps.map((s) => (s.edge !== id ? s : s.back ? { edge: s.edge } : { edge: s.edge, back: true as const })) } : f));
  return {
    ...model,
    ...(flows ? { flows } : {}),
    edges: model.edges.map((e) => {
      if (e.id !== id) return e;
      const { ports, ...rest } = e;
      const swapped = ports && { ...(ports.to ? { from: ports.to } : {}), ...(ports.from ? { to: ports.from } : {}) };
      return { ...rest, from: e.to, to: e.from, type: r.type, ...(swapped ? { ports: swapped } : {}) };
    }),
  };
}
