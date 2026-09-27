import { acceptedTypes, allowedTypes, hints, INSTANCES, type HintDef, type HintId } from "@/metamodel";
import type { Model } from "./schema";

/** One hint that applies to a model, and the elements it is about. */
export type HintResult = {
  id: string;
  hint: HintDef;
  message: string;
  nodeIds: string[];
  edgeIds: string[];
};

const INFRA = new Set(["application", "host", "network", "api"]);
const MAX_CAPABILITY_LEVELS = 6;
const INSTANCE_SET = new Set<string>(INSTANCES);
const OFFERING_PARENT: Record<string, string> = {
  business_service_offering: "business_service",
  technology_management_service_offering: "technology_management_service",
};
const def = (id: HintId) => hints.find((h) => h.id === id)!;

/**
 * Which conformance hints apply to `model`. Pure and deterministic: same model, same hints, in
 * the same order (warnings first, then by hint catalog order, then by element order).
 */
export function evaluateHints(model: Model): HintResult[] {
  const out: HintResult[] = [];
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const label = (id: string) => byId.get(id)?.name || "Untitled";
  const outgoing = (id: string) => model.edges.filter((e) => e.from === id);
  const incoming = (id: string) => model.edges.filter((e) => e.to === id);
  const classOf = (id: string) => byId.get(id)?.class;
  const push = (id: HintId, key: string, message: string, nodeIds: string[], edgeIds: string[] = []) =>
    out.push({ id: `${id}:${key}`, hint: def(id), message, nodeIds, edgeIds });

  // Relationship-level checks (only reachable through imported files; the editor refuses these).
  for (const e of model.edges) {
    const from = classOf(e.from)!;
    const to = classOf(e.to)!;
    if (acceptedTypes(from, to).includes(e.type)) {
      if (!allowedTypes(from, to).includes(e.type)) {
        push("legacy-relationship-type", e.id, `${label(e.from)} → ${label(e.to)} uses ${e.type}.`, [e.from, e.to], [e.id]);
      }
      continue;
    }
    if (from === "business_application" && INFRA.has(to)) {
      push("ba-direct-to-infrastructure", e.id, `${label(e.from)} is linked straight to ${label(e.to)}.`, [e.from, e.to], [e.id]);
    } else {
      push("disallowed-relationship", e.id, `${label(e.from)} → ${label(e.to)} (${e.type}).`, [e.from, e.to], [e.id]);
    }
  }

  for (const n of model.nodes) {
    if (n.class === "business_application") {
      // Drawn from the capability; older files drew it from the application.
      const capable = incoming(n.id).some((e) => classOf(e.from) === "business_capability") || outgoing(n.id).some((e) => classOf(e.to) === "business_capability");
      if (!capable) {
        push("ba-without-capability", n.id, `${label(n.id)} is not related to a Business Capability.`, [n.id]);
      }
      if (!outgoing(n.id).some((e) => classOf(e.to) === "application_service")) {
        push("ba-without-service-instance", n.id, `${label(n.id)} has no Application Service.`, [n.id]);
      }
    }
    if (n.class === "service_instance") {
      push("generic-service-instance", n.id, `${label(n.id)} is a generic Service Instance.`, [n.id]);
    }
    if (INSTANCE_SET.has(n.class)) {
      const exposed = incoming(n.id).some((e) => {
        const c = classOf(e.from);
        return c === "business_service_offering" || c === "technology_management_service_offering";
      });
      if (!exposed) push("service-not-exposed", n.id, `${label(n.id)} is not exposed through a service offering.`, [n.id]);
    }
    const parentService = OFFERING_PARENT[n.class];
    if (parentService && !incoming(n.id).some((e) => classOf(e.from) === parentService)) {
      push("offering-without-service", n.id, `${label(n.id)} has no parent service.`, [n.id]);
    }
  }

  // Capability hierarchy: child → parent reference edges.
  const parentsOf = new Map<string, string[]>();
  for (const e of model.edges) {
    if (classOf(e.from) === "business_capability" && classOf(e.to) === "business_capability") {
      parentsOf.set(e.from, [...(parentsOf.get(e.from) ?? []), e.to]);
    }
  }
  const reportedCycles = new Set<string>();
  const deepest = new Map<string, number>();
  const depth = (id: string, path: string[]): number => {
    if (path.includes(id)) {
      const cycle = path.slice(path.indexOf(id));
      const key = [...cycle].sort().join(",");
      if (!reportedCycles.has(key)) {
        reportedCycles.add(key);
        push("capability-cycle", key, `${cycle.map(label).join(" → ")} → ${label(id)}.`, cycle);
      }
      return 0;
    }
    const cached = deepest.get(id);
    if (cached !== undefined) return cached;
    const parents = parentsOf.get(id) ?? [];
    const d = 1 + (parents.length ? Math.max(...parents.map((p) => depth(p, [...path, id]))) : 0);
    deepest.set(id, d);
    return d;
  };
  for (const n of model.nodes) {
    if (n.class !== "business_capability") continue;
    const d = depth(n.id, []);
    const isLeaf = !model.edges.some((e) => e.to === n.id && classOf(e.from) === "business_capability");
    if (isLeaf && d > MAX_CAPABILITY_LEVELS) {
      push("capability-too-deep", n.id, `${label(n.id)} sits ${d} levels deep.`, [n.id]);
    }
  }

  const order = new Map<string, number>(hints.map((h, i) => [h.id, i]));
  return out.sort(
    (a, b) =>
      (a.hint.severity === b.hint.severity ? 0 : a.hint.severity === "warning" ? -1 : 1) ||
      order.get(a.hint.id)! - order.get(b.hint.id)!,
  );
}
