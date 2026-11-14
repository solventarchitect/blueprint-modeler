import type { ColorBy, Model, ViewFilter } from "./schema";
import { inView, legend, slotMap, type LegendEntry } from "./views";
import { count } from "./words";

/** M92: one Business Capability in the capability map, with the capabilities that sit inside it. */
export type CapabilityTile = {
  id: string;
  /** The Business Applications related to it, in the model's order. */
  apps: string[];
  /** How many different Business Applications support it or any capability inside it. */
  allApps: number;
  children: CapabilityTile[];
  /** Its other parents: a capability is drawn once, under its first parent. */
  alsoUnder: string[];
};

const CAPABILITY = "business_capability";
const APPLICATION = "business_application";

/**
 * M92: the model's Business Capabilities as nested tiles, each inside its parent (a child refers to
 * its parent), in the model's order. A Business Application supports a capability when any
 * relationship joins the two, whichever way it is drawn. A capability with several parents is drawn
 * under the first; a loop of parents is broken at the capability the model lists first.
 */
export function capabilityMap(model: Model): CapabilityTile[] {
  const classOf = new Map(model.nodes.map((n) => [n.id, n.class]));
  const order = new Map(model.nodes.map((n, i) => [n.id, i]));
  const caps = model.nodes.filter((n) => n.class === CAPABILITY).map((n) => n.id);
  const parents = new Map<string, string[]>();
  const apps = new Map<string, Set<string>>();
  for (const e of model.edges) {
    const from = classOf.get(e.from);
    const to = classOf.get(e.to);
    if (from === CAPABILITY && to === CAPABILITY) {
      const list = parents.get(e.from) ?? [];
      if (e.from !== e.to && !list.includes(e.to)) parents.set(e.from, [...list, e.to]);
    } else if (from === CAPABILITY && to === APPLICATION) {
      if (!apps.has(e.from)) apps.set(e.from, new Set());
      apps.get(e.from)!.add(e.to);
    } else if (from === APPLICATION && to === CAPABILITY) {
      if (!apps.has(e.to)) apps.set(e.to, new Set());
      apps.get(e.to)!.add(e.from);
    }
  }
  const placed = new Set<string>();
  const build = (id: string, under: string | null): { tile: CapabilityTile; all: Set<string> } => {
    placed.add(id);
    const own = [...(apps.get(id) ?? [])].sort((a, b) => order.get(a)! - order.get(b)!);
    const all = new Set(own);
    const children: CapabilityTile[] = [];
    for (const c of caps) {
      if (placed.has(c) || parents.get(c)?.[0] !== id) continue;
      const child = build(c, id);
      children.push(child.tile);
      for (const a of child.all) all.add(a);
    }
    return { tile: { id, apps: own, allApps: all.size, children, alsoUnder: (parents.get(id) ?? []).filter((p) => p !== under) }, all };
  };
  const roots: CapabilityTile[] = [];
  for (const c of caps) if (!parents.has(c)) roots.push(build(c, null).tile);
  // What a loop of parents kept from the top: each loop starts at the capability listed first.
  for (const c of caps) if (!placed.has(c)) roots.push(build(c, null).tile);
  return roots.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

/** M92: a tile's counts in words: "2 Business Applications · 5 with its parts". */
export function tileCounts(t: Pick<CapabilityTile, "apps" | "allApps" | "children">): string {
  const own = t.apps.length ? count(t.apps.length, "Business Application") : "No Business Applications";
  return t.children.length && t.allApps > t.apps.length ? `${own} · ${t.allApps} with its parts` : own;
}

/** M92: every tile in the map, parents before the capabilities inside them. */
export const allTiles = (tiles: CapabilityTile[]): CapabilityTile[] => tiles.flatMap((t) => [t, ...allTiles(t.children)]);

/**
 * M92: the legend of the map's coloring. Colors are worked out over the whole model, so a value has
 * the color it has on the canvas; only values the capabilities carry are listed, counting the
 * capabilities in the view.
 */
export function capabilityLegend(model: Model, by: ColorBy, filter: ViewFilter, tags?: readonly string[]): LegendEntry[] {
  const slotOf = slotMap(model, by, tags);
  if (!slotOf) return [];
  const counts = new Map<string, number>();
  const used = new Set<string>();
  for (const n of model.nodes) {
    if (n.class !== CAPABILITY) continue;
    const slot = String(slotOf(n));
    used.add(slot);
    if (inView(n, filter, model)) counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  return legend(model, by, filter, tags)
    .filter((e) => used.has(String(e.slot)))
    .map((e) => ({ ...e, count: counts.get(String(e.slot)) ?? 0 }));
}
