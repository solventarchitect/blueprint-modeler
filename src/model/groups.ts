/**
 * Group by (M56): frames around the elements that belong together, worked out from the model rather
 * than stored in it (Mike, 2026-10-25: grouping as a view, no format change). Pure, shared by the
 * canvas, the image export and the tests.
 *
 * - Business Application, Service Offering: the element and everything it reaches by following its
 *   relationships the way they point (CSDM draws them parent to child: a Business Application uses
 *   its Application Services, which depend on Applications, which run on Hosts). An element reached
 *   from two of them is in both groups.
 * - Environment: the elements with that environment set; elements without one are in no group.
 */
import { attrValue } from "./views";
import type { GroupBy, Model } from "./schema";

export const GROUP_BY_LABEL: Record<GroupBy, string> = {
  business_application: "Business Application",
  service_offering: "Service Offering",
  environment: "Environment",
};
/** The classes a group starts from, by grouping. */
const ANCHORS: Record<Exclude<GroupBy, "environment">, string[]> = {
  business_application: ["business_application"],
  service_offering: [
    "business_service_offering",
    "technology_management_service_offering",
  ],
};

/** One group: a stable key (for collapse state), its name, the element it starts from, and its members (anchor first). */
export type Group = {
  key: string;
  label: string;
  anchorId?: string;
  nodeIds: string[];
};

export function groupsOf(model: Model, by: GroupBy): Group[] {
  if (by === "environment") {
    const byValue = new Map<string, string[]>();
    for (const n of model.nodes) {
      const v = attrValue(n, "environment");
      if (v) byValue.set(v, [...(byValue.get(v) ?? []), n.id]);
    }
    return [...byValue.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([v, ids]) => ({ key: `env:${v}`, label: v, nodeIds: ids }));
  }
  const out = new Map<string, string[]>();
  for (const e of model.edges)
    out.set(e.from, [...(out.get(e.from) ?? []), e.to]);
  return model.nodes
    .filter((n) => ANCHORS[by].includes(n.class))
    .sort(
      (a, b) =>
        (a.name || "Untitled").localeCompare(b.name || "Untitled") ||
        a.id.localeCompare(b.id),
    )
    .map((a) => {
      const seen = new Set([a.id]);
      const queue = [a.id];
      while (queue.length)
        for (const next of out.get(queue.shift()!) ?? [])
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
      return {
        key: `${by}:${a.id}`,
        label: a.name || "Untitled",
        anchorId: a.id,
        nodeIds: [...seen],
      };
    });
}

/** Each element's first group (in the groups' order), the one it is laid out with. */
export function primaryGroup(groups: Group[]): Map<string, string> {
  const primary = new Map<string, string>();
  for (const g of groups)
    for (const id of g.nodeIds) if (!primary.has(id)) primary.set(id, g.key);
  return primary;
}
