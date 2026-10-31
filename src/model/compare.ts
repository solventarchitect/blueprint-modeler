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
import { attrValue, COLOR_BY_LABEL } from "./views";
import { GROUP_BY_LABEL } from "./groups";
import { LAYER_ORDER } from "./health";
import { PLAN_LABEL, planOf, type PlanStatus } from "./plan";
import type { Edge, Flow, Model, Node, View, ViewFilter } from "./schema";

export type CompareField = "name" | "class" | "description" | "lifecycle" | "environment" | "owner" | "ref" | "links" | "plan" | "tags";
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
  /** Relationships in both whose type or plan status differs (ids in this model): `before` is the base type; `plan` the plan status before and after, when it changed (M68). */
  edgesChanged: (EdgeRef & { before: string; plan?: { before: string; after: string } })[];
  /** M72: the model's own details that differ (date as set, description, artifact ID). */
  details: DetailChange[];
  /** M72: saved views added, removed and changed. */
  views: NamedChanges;
  /** M72: saved flows added, removed and changed. */
  flows: NamedChanges;
};

export type DetailField = "date" | "description" | "artifactId";
export type DetailChange = { field: DetailField; before: string; after: string };
/** A saved view or flow by id and name, and what differs on one in both (each field in words). */
export type NamedRef = { id: string; name: string };
export type NamedChanges = { added: NamedRef[]; removed: NamedRef[]; changed: (NamedRef & { changes: { field: string; before: string; after: string }[] })[] };

export const DETAIL_LABEL: Record<DetailField, string> = { date: "Date", description: "Description", artifactId: "Artifact ID" };

export const FIELD_LABEL: Record<CompareField, string> = {
  name: "Name",
  class: "Class",
  description: "Description",
  lifecycle: "Life cycle stage",
  environment: "Environment",
  owner: "Owner",
  ref: "Record number",
  links: "Links",
  plan: "Plan status",
  tags: "Tags",
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
    plan: PLAN_LABEL[planOf(n)],
    // M69: compared as a set, so a new order is not a change; shown in the element's own order.
    tags: (n.tags ?? []).join(", "),
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

// Not the model's name: Compare is mostly with another model, whose name differs by design. The date
// as set: an undated model's date is its creation day, which differs between copies nobody dated.
const DETAIL_FIELDS: DetailField[] = ["date", "description", "artifactId"];
const detailOf = (m: Model, f: DetailField): string => (m[f] ?? "").trim();

/** Saved views or flows in both: by id first, then by name (ignoring case), one to one. */
function matchNamed<T extends NamedRef>(current: readonly T[], base: readonly T[]): Map<T, T> {
  const out = new Map<T, T>();
  const free = [...current];
  const take = (i: number, b: T) => out.set(b, free.splice(i, 1)[0]!);
  const rest: T[] = [];
  for (const b of base) {
    const i = free.findIndex((c) => c.id === b.id);
    if (i >= 0) take(i, b);
    else rest.push(b);
  }
  for (const b of rest) {
    const i = free.findIndex((c) => norm(c.name) === norm(b.name));
    if (i >= 0) take(i, b);
  }
  return out;
}

function namedChanges<T extends NamedRef>(current: readonly T[], base: readonly T[], differences: (now: T, was: T) => { field: string; before: string; after: string }[]): NamedChanges {
  const match = matchNamed(current, base);
  const matched = new Set(match.values());
  const r = (x: T): NamedRef => ({ id: x.id, name: x.name });
  return {
    added: current.filter((c) => !matched.has(c)).map(r),
    removed: base.filter((b) => !match.has(b)).map(r),
    // In this model's order, as it lists them now.
    changed: [...match]
      .sort(([, a], [, b]) => current.indexOf(a) - current.indexOf(b))
      .flatMap(([was, now]) => {
        const changes = differences(now, was);
        return changes.length ? [{ ...r(now), changes }] : [];
      }),
  };
}

const LAYER_WORD: Record<string, string> = Object.fromEntries(LAYER_ORDER.map((l) => [l.id, l.name]));
/** A view's filter in words, each dimension's values in a fixed order so a new order is not a change. */
export function filterText(f: ViewFilter): string {
  const list = (vals: string[] | undefined, word: (v: string) => string) => [...new Set((vals ?? []).map((v) => (v === "" ? "Not set" : word(v))))].sort((a, b) => a.localeCompare(b)).join(", ");
  const dims: [string, string[] | undefined, (v: string) => string][] = [
    ["Layer", f.layers, (v) => LAYER_WORD[v] ?? v],
    ["Class", f.classes, (v) => classById(v)?.label ?? v],
    ["Life cycle stage", f.lifecycle, (v) => v],
    ["Environment", f.environment, (v) => v],
    ["Owner", f.owner, (v) => v],
    ["Plan status", f.plan, (v) => PLAN_LABEL[v as PlanStatus] ?? v],
    ["Tags", f.tags, (v) => v],
  ];
  const parts = dims.filter(([, vals]) => vals?.length).map(([label, vals, word]) => `${label}: ${list(vals, word)}`);
  return parts.length ? parts.join("; ") : "All elements";
}

function viewChanges(now: View, was: View) {
  const pairs: [string, string, string][] = [
    ["Name", was.name, now.name],
    ["Filter", filterText(was.filter), filterText(now.filter)],
    ["Color by", COLOR_BY_LABEL[was.colorBy], COLOR_BY_LABEL[now.colorBy]],
    ["Group by", was.groupBy ? GROUP_BY_LABEL[was.groupBy] : "None", now.groupBy ? GROUP_BY_LABEL[now.groupBy] : "None"],
  ];
  return pairs.filter(([, b, a]) => b !== a).map(([field, before, after]) => ({ field, before, after }));
}

/**
 * A flow's steps compared by the relationships they walk, matched as Compare matches them (by id, or
 * by their ends and type), so other relationship ids or a renamed element are not a change to the flow.
 */
function flowChanges(edgeMatch: ReadonlyMap<string, string>) {
  return (now: Flow, was: Flow) => {
    const out: { field: string; before: string; after: string }[] = [];
    if (now.name !== was.name) out.push({ field: "Name", before: was.name, after: now.name });
    const same = (i: number) => {
      const [b, a] = [was.steps[i], now.steps[i]];
      return !!a && !!b && edgeMatch.get(b.edge) === a.edge && !!a.back === !!b.back;
    };
    const first = Array.from({ length: Math.max(now.steps.length, was.steps.length) }, (_, i) => i).find((i) => !same(i));
    const steps = (n: number) => `${n} step${n === 1 ? "" : "s"}`;
    if (first !== undefined) out.push({ field: "Steps", before: steps(was.steps.length), after: `${steps(now.steps.length)}, the walk differs from step ${first + 1}` });
    return out;
  };
}

export function compareModels(current: Model, base: Model): Comparison {
  const match = matchElements(current, base);
  const matched = new Set(match.values());
  const byId = new Map(current.nodes.map((n) => [n.id, n]));
  const baseById = new Map(base.nodes.map((n) => [n.id, n]));

  const added = current.nodes.filter((n) => !matched.has(n.id)).map(ref);
  const removed = base.nodes.filter((n) => !match.has(n.id)).map(ref);
  const changed: Comparison["changed"] = [];
  // M69: tags compare as a set, so a new order is not a change (a new spelling is).
  const tagSet = (n: Node) => [...(n.tags ?? [])].sort().join("\n");
  for (const b of base.nodes) {
    const id = match.get(b.id);
    if (!id) continue;
    const n = byId.get(id)!;
    const [was, now] = [fields(b), fields(n)];
    const differs = (f: CompareField) => (f === "tags" ? tagSet(b) !== tagSet(n) : was[f] !== now[f]);
    const changes = (Object.keys(was) as CompareField[]).filter(differs).map((f) => ({ field: f, before: was[f], after: now[f] }));
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
  /** M72: base relationship id → the matched relationship in this model (for saved flows). */
  const edgeMatch = new Map<string, string>();
  const edgesRemoved: EdgeRef[] = [];
  const edgesChanged: Comparison["edgesChanged"] = [];
  /** A matched relationship whose type or plan status differs from the base's. */
  const note = (now: Edge, was: Edge) => {
    const [pb, pa] = [PLAN_LABEL[planOf(was)], PLAN_LABEL[planOf(now)]];
    if (now.type !== was.type || pb !== pa) edgesChanged.push({ ...named(now, byId), before: was.type, ...(pb !== pa ? { plan: { before: pb, after: pa } } : {}) });
  };
  for (const e of base.edges) {
    const { from, to } = mapped(e);
    const same = edgeById.get(e.id);
    if (same && !seen.has(same.id) && same.from === from && same.to === to) {
      seen.add(same.id);
      edgeMatch.set(e.id, same.id);
      note(same, e);
      continue;
    }
    const byEnds = from && to ? edgeAt.get(`${from}|${to}|${e.type}`)?.find((x) => !seen.has(x.id)) : undefined;
    if (byEnds) {
      seen.add(byEnds.id);
      edgeMatch.set(e.id, byEnds.id);
      note(byEnds, e);
      continue;
    }
    edgesRemoved.push(named(e, baseById));
  }
  const edgesAdded = current.edges.filter((e) => !seen.has(e.id)).map((e) => named(e, byId));
  const details = DETAIL_FIELDS.map((field) => ({ field, before: detailOf(base, field), after: detailOf(current, field) })).filter((d) => d.before !== d.after);
  const views = namedChanges(current.views ?? [], base.views ?? [], viewChanges);
  const flows = namedChanges(current.flows ?? [], base.flows ?? [], flowChanges(edgeMatch));
  return { added, removed, changed, edgesAdded, edgesRemoved, edgesChanged, details, views, flows };
}

const none = (n: NamedChanges) => !n.added.length && !n.removed.length && !n.changed.length;

/** Whether two models are the same, as far as compare looks. */
export const sameModel = (c: Comparison) =>
  !c.added.length && !c.removed.length && !c.changed.length && !c.edgesAdded.length && !c.edgesRemoved.length && !c.edgesChanged.length && !c.details.length && none(c.views) && none(c.flows);
