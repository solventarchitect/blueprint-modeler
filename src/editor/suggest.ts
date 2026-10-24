import { allowedTypes, classById, classes, isCsdmCore, isExtended, type ClassId } from "@/metamodel";
import type { Model } from "@/model";

/** A relationship the editor offers for an element that has none yet. */
export type Suggestion =
  | { kind: "existing"; nodeId: string; from: string; to: string; type: string; name: string; classLabel: string }
  | { kind: "new"; cls: ClassId; outgoing: boolean; type: string; classLabel: string };

/** Classes roughly in the order a CSDM model is built, so the likeliest next step comes first. */
const PRIORITY: string[] = [
  "business_capability",
  "business_application",
  "application_service",
  "business_service_offering",
  "technology_management_service_offering",
  "business_service",
  "technology_management_service",
  "information_object",
  "business_process",
  "application",
  "host",
  "api",
  "network",
  "data_service_instance",
  "network_service_instance",
  "connection_service_instance",
  "operational_process_service_instance",
  "facility_service_instance",
];

const MAX_EXISTING = 3;
const MAX_NEW = 5;

type NewSuggestion = Extract<Suggestion, { kind: "new" }>;

/** Build-order rank of a class beside `cls` (the same class last), and the allowed pairing with it. */
function relate(cls: string) {
  const rank = (other: string) => (other === cls ? 900 : PRIORITY.includes(other) ? PRIORITY.indexOf(other) : 500);
  const pair = (other: string) => {
    const out = allowedTypes(cls, other)[0];
    if (out) return { outgoing: true, type: out };
    const inn = allowedTypes(other, cls)[0];
    return inn ? { outgoing: false, type: inn } : null;
  };
  return { rank, pair };
}

/**
 * Every class a new element could have, related to `nodeId` (M53 quick-add), in build order, each
 * with the direction and preferred type the metamodel requires — so adding one always gives an
 * allowed relationship. The generic Service Instance is never offered (pick a type); CMDB extension
 * classes only for elements outside the CSDM core; extended classes when the element is one, or
 * when `extended` is on (the palette shows them).
 */
export function relatedClasses(model: Model, nodeId: string, { extended = false }: { extended?: boolean } = {}): NewSuggestion[] {
  const node = model.nodes.find((n) => n.id === nodeId);
  const def = node && classById(node.class);
  if (!node || !def) return [];
  const { rank, pair } = relate(node.class);
  return classes
    .filter((c) => c.id !== "service_instance" && (isCsdmCore(c) || !isCsdmCore(def)) && (!isExtended(c) || extended || isExtended(def)))
    .flatMap((c) => {
      const p = pair(c.id);
      return p ? [{ kind: "new" as const, cls: c.id, outgoing: p.outgoing, type: p.type, classLabel: c.label }] : [];
    })
    .sort((a, b) => rank(a.cls) - rank(b.cls));
}

/**
 * Relationships to offer for `nodeId`: elements already on the canvas it can relate to (nearest
 * first in the build order), then new elements to add. Each carries the direction and preferred
 * type the metamodel requires, so choosing one always produces an allowed relationship.
 */
export function suggestions(model: Model, nodeId: string): Suggestion[] {
  const node = model.nodes.find((n) => n.id === nodeId);
  const def = node && classById(node.class);
  if (!node || !def) return [];
  const { rank, pair } = relate(node.class);

  const related = new Set(model.edges.flatMap((e) => (e.from === nodeId ? [e.to] : e.to === nodeId ? [e.from] : [])));
  const existing: Suggestion[] = model.nodes
    .filter((n) => n.id !== nodeId && !related.has(n.id))
    .flatMap((n) => {
      const p = pair(n.class);
      if (!p) return [];
      const s: Suggestion = {
        kind: "existing",
        nodeId: n.id,
        from: p.outgoing ? nodeId : n.id,
        to: p.outgoing ? n.id : nodeId,
        type: p.type,
        name: n.name || "Untitled",
        classLabel: classById(n.class)?.label ?? n.class,
      };
      return [{ s, r: rank(n.class) }];
    })
    .sort((a, b) => a.r - b.r)
    .slice(0, MAX_EXISTING)
    .map((x) => x.s);

  return [...existing, ...relatedClasses(model, nodeId).slice(0, MAX_NEW)];
}

/** Accessible name and visible label of one suggestion. */
export const suggestionLabel = (s: Suggestion) => (s.kind === "existing" ? `Connect to ${s.name}` : `New ${s.classLabel}`);

/** Short text for a suggestion's relationship, with its direction from the element's side. */
export const suggestionDetail = (s: Suggestion) => (s.type.startsWith("reference:") ? "reference" : s.type);
