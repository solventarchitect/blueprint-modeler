/**
 * Model compare (M58): what changed from another model (an earlier file or another saved model, the
 * "base") to this one. Pure, so the canvas marks, the change list and the tests agree.
 *
 * Elements match by id first (a saved copy or an exported file keeps its ids), then, among those
 * left, by class and name (ignoring case and outer spaces), one to one in file order. Relationships
 * match by id when both ends match too, then by their ends and type. Positions are not compared: a
 * re-layout is not a change to the model.
 */
import { classById } from "@/metamodel";
import { attrValue } from "./views";
import type { Edge, Model, Node } from "./schema";

export type CompareField = "name" | "class" | "description" | "lifecycle" | "environment" | "owner" | "ref" | "links";
export type FieldChange = { field: CompareField; before: string; after: string };
export type ElementRef = { id: string; name: string; kind: string };
export type EdgeRef = { id: string; from: string; to: string; type: string };

export type Comparison = {
  /** In this model, not in the base (ids in this model). */
  added: ElementRef[];
  /** In the base, not in this model (ids in the base). */
  removed: ElementRef[];
  /** In both, with what differs (ids in this model). */
  changed: (ElementRef & { changes: FieldChange[] })[];
  /** Relationships in this model only; ends named by element name. */
  edgesAdded: EdgeRef[];
  /** Relationships in the base only; ends named by element name. */
  edgesRemoved: EdgeRef[];
  /** Relationships in both whose type differs (ids in this model). */
  edgesChanged: (EdgeRef & { before: string })[];
};

export const FIELD_LABEL: Record<CompareField, string> = {
  name: "Name",
  class: "Class",
  description: "Description",
  lifecycle: "Life cycle stage",
  environment: "Environment",
  owner: "Owner",
  ref: "Record number",
  links: "Links",
};

const kindOf = (n: Node) => classById(n.class)?.label ?? n.class;
const ref = (n: Node): ElementRef => ({ id: n.id, name: n.name || "Untitled", kind: kindOf(n) });
const norm = (s: string) => s.trim().toLowerCase();

function fields(n: Node): Record<CompareField, string> {
  return {
    name: n.name,
    class: kindOf(n),
    description: (n.attrs?.description ?? "").trim(),
    lifecycle: attrValue(n, "lifecycle"),
    environment: attrValue(n, "environment"),
    owner: attrValue(n, "owner"),
    // M65: the record number, and the links by title and address (titles shown when they differ).
    ref: (n.attrs?.ref ?? "").trim(),
    links: (n.links ?? []).map((l) => `${l.title} (${l.url})`).join(", "),
  };
}

/** Elements in `base` matched to elements in `current`: base id → current id. */
export function matchElements(current: Model, base: Model): Map<string, string> {
  const match = new Map<string, string>();
  const taken = new Set<string>();
  const ids = new Set(current.nodes.map((n) => n.id));
  for (const b of base.nodes)
    if (ids.has(b.id)) {
      match.set(b.id, b.id);
      taken.add(b.id);
    }
  const key = (n: Node) => `${n.class}|${norm(n.name)}`;
  const free = new Map<string, string[]>();
  for (const n of current.nodes) if (!taken.has(n.id)) free.set(key(n), [...(free.get(key(n)) ?? []), n.id]);
  for (const b of base.nodes) {
    if (match.has(b.id)) continue;
    const id = free.get(key(b))?.shift();
    if (id) match.set(b.id, id);
  }
  return match;
}

export function compareModels(current: Model, base: Model): Comparison {
  const match = matchElements(current, base);
  const matched = new Set(match.values());
  const byId = new Map(current.nodes.map((n) => [n.id, n]));
  const baseById = new Map(base.nodes.map((n) => [n.id, n]));

  const added = current.nodes.filter((n) => !matched.has(n.id)).map(ref);
  const removed = base.nodes.filter((n) => !match.has(n.id)).map(ref);
  const changed: Comparison["changed"] = [];
  for (const b of base.nodes) {
    const id = match.get(b.id);
    if (!id) continue;
    const n = byId.get(id)!;
    const [was, now] = [fields(b), fields(n)];
    const changes = (Object.keys(was) as CompareField[]).filter((f) => was[f] !== now[f]).map((f) => ({ field: f, before: was[f], after: now[f] }));
    if (changes.length) changed.push({ ...ref(n), changes });
  }

  const name = (m: Map<string, Node>, id: string) => m.get(id)?.name || "Untitled";
  const named = (e: Edge, m: Map<string, Node>): EdgeRef => ({ id: e.id, from: name(m, e.from), to: name(m, e.to), type: e.type });
  // A base relationship in this model's terms: its ends mapped through the element match.
  const mapped = (e: Edge) => ({ from: match.get(e.from), to: match.get(e.to) });
  // Every relationship at each ends-and-type (a file can hold the same one twice), taken first unused first.
  const edgeAt = new Map<string, Edge[]>();
  for (const e of current.edges) edgeAt.set(`${e.from}|${e.to}|${e.type}`, [...(edgeAt.get(`${e.from}|${e.to}|${e.type}`) ?? []), e]);
  const edgeById = new Map(current.edges.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const edgesRemoved: EdgeRef[] = [];
  const edgesChanged: Comparison["edgesChanged"] = [];
  for (const e of base.edges) {
    const { from, to } = mapped(e);
    const same = edgeById.get(e.id);
    if (same && !seen.has(same.id) && same.from === from && same.to === to) {
      seen.add(same.id);
      if (same.type !== e.type) edgesChanged.push({ ...named(same, byId), before: e.type });
      continue;
    }
    const byEnds = from && to ? edgeAt.get(`${from}|${to}|${e.type}`)?.find((x) => !seen.has(x.id)) : undefined;
    if (byEnds) {
      seen.add(byEnds.id);
      continue;
    }
    edgesRemoved.push(named(e, baseById));
  }
  const edgesAdded = current.edges.filter((e) => !seen.has(e.id)).map((e) => named(e, byId));
  return { added, removed, changed, edgesAdded, edgesRemoved, edgesChanged };
}

/** Whether two models are the same, as far as compare looks. */
export const sameModel = (c: Comparison) => !c.added.length && !c.removed.length && !c.changed.length && !c.edgesAdded.length && !c.edgesRemoved.length && !c.edgesChanged.length;
