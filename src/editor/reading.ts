import { archimateElements, archimateRelationshipFor, archimateVerb, type Lens } from "@/frameworks";
import { classById, isClassId } from "@/metamodel";
import type { Model } from "@/model";

/** One relationship as a sentence, subject first. */
export type Sentence = { edgeId: string; subjectId: string; objectId: string; text: string };
export type ReadingGroup = { nodeId: string; name: string; kind: string; sentences: Sentence[] };
export type Reading = { groups: ReadingGroup[]; unconnected: { id: string; name: string; kind: string }[] };

const nameOf = (name: string) => `“${name || "Untitled"}”`;

/** CSDM's parent-side label as a verb: "Uses" → "uses", "Provided by" → "is provided by". */
export function csdmVerb(type: string): string {
  if (type.startsWith("reference:")) return "references";
  const parent = type.split("::")[0] ?? type;
  const verb = parent.charAt(0).toLowerCase() + parent.slice(1);
  return / by$/.test(verb) ? `is ${verb}` : verb;
}

/**
 * The model read aloud: one sentence per relationship, grouped by the element each sentence starts
 * with. The CSDM lenses read CSDM relationship types from the parent; the ArchiMate-only lens reads
 * the ArchiMate relationship from ArchiMate's source end, with ArchiMate element types. `scopeId`
 * keeps only the relationships that touch that element (and lists no unconnected elements).
 */
export function readModel(model: Model, lens: Lens, scopeId?: string | null): Reading {
  const nodes = new Map(model.nodes.map((n) => [n.id, n]));
  const archimate = lens === "archimate-only";
  const kindOf = (id: string) => {
    const cls = nodes.get(id)?.class ?? "";
    if (archimate && isClassId(cls)) return archimateElements[cls].label;
    return classById(cls)?.label ?? cls;
  };
  const term = (id: string) => `${kindOf(id)} ${nameOf(nodes.get(id)?.name ?? "")}`;

  const sentences: Sentence[] = [];
  for (const e of model.edges) {
    if (!nodes.has(e.from) || !nodes.has(e.to)) continue;
    if (scopeId && e.from !== scopeId && e.to !== scopeId) continue;
    if (archimate) {
      const m = archimateRelationshipFor(nodes.get(e.from)!.class, nodes.get(e.to)!.class);
      const [subject, object] = m?.reverse ? [e.to, e.from] : [e.from, e.to];
      sentences.push({ edgeId: e.id, subjectId: subject, objectId: object, text: `${term(subject)} ${archimateVerb[m?.type ?? "Association"]} ${term(object)}.` });
    } else {
      const field = e.type.startsWith("reference:") ? ` through its “${e.type.slice("reference:".length)}” field` : "";
      sentences.push({ edgeId: e.id, subjectId: e.from, objectId: e.to, text: `${term(e.from)} ${csdmVerb(e.type)} ${term(e.to)}${field}.` });
    }
  }

  const byName = (a: string, b: string) => (nodes.get(a)?.name ?? "").localeCompare(nodes.get(b)?.name ?? "") || kindOf(a).localeCompare(kindOf(b)) || a.localeCompare(b);
  const groups = new Map<string, Sentence[]>();
  for (const s of sentences) groups.set(s.subjectId, [...(groups.get(s.subjectId) ?? []), s]);
  return {
    groups: [...groups.keys()].sort(byName).map((id) => ({
      nodeId: id,
      name: nodes.get(id)?.name || "Untitled",
      kind: kindOf(id),
      sentences: groups.get(id)!.sort((a, b) => byName(a.objectId, b.objectId) || a.text.localeCompare(b.text)),
    })),
    unconnected: scopeId
      ? []
      : model.nodes
          .filter((n) => !model.edges.some((e) => e.from === n.id || e.to === n.id))
          .map((n) => n.id)
          .sort(byName)
          .map((id) => ({ id, name: nodes.get(id)?.name || "Untitled", kind: kindOf(id) })),
  };
}
