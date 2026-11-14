import type { ColorBy, Model, ViewFilter } from "./schema";
import { inView, legend, slotMap, valueLabels, type LegendEntry } from "./views";
import { count } from "./words";

/** M92: one Business Capability in the capability map, with the capabilities that sit inside it. */
export type CapabilityTile = {
  id: string;
  /** The Business Applications related to it, in the model's order. */
  apps: string[];
  /** How many different Business Applications support it or any capability inside it. */
  allApps: number;
  children: CapabilityTile[];
  /** Its other parents: a capability is drawn once, under one parent. */
  alsoUnder: string[];
};

const CAPABILITY = "business_capability";
const APPLICATION = "business_application";

/**
 * Which parent each capability is drawn under: its first, unless that makes a loop. A loop is broken
 * at its first member (in the model's order) that has a parent outside it, which it is drawn under
 * when that doesn't lead back into the loop; otherwise at its first member, which goes to the top.
 * Never makes a loop, so every capability is drawn once.
 */
function drawnParents(caps: string[], parents: Map<string, string[]>, order: Map<string, number>): Map<string, string | null> {
  const drawn = new Map(caps.map((c) => [c, parents.get(c)?.[0] ?? null]));
  const state = new Map<string, 1 | 2>();
  const leadsInto = (from: string, loop: Set<string>) => {
    const seen = new Set<string>();
    for (let y: string | null = from; y && !seen.has(y); y = drawn.get(y) ?? null) {
      if (loop.has(y)) return true;
      seen.add(y);
    }
    return false;
  };
  for (const c of caps) {
    if (state.has(c)) continue;
    const path: string[] = [];
    let x: string | null = c;
    while (x && !state.has(x)) {
      state.set(x, 1);
      path.push(x);
      x = drawn.get(x) ?? null;
    }
    if (x && state.get(x) === 1) {
      const loop = path.slice(path.indexOf(x));
      const members = new Set(loop);
      const byOrder = [...loop].sort((a, b) => order.get(a)! - order.get(b)!);
      const outside = byOrder.map((m) => [m, parents.get(m)!.find((p) => !members.has(p) && !leadsInto(p, members))] as const).find(([, p]) => p);
      if (outside) drawn.set(outside[0], outside[1]!);
      else drawn.set(byOrder[0]!, null);
    }
    for (const p of path) state.set(p, 2);
  }
  return drawn;
}

/**
 * M92: the model's Business Capabilities as nested tiles, each inside its parent (a child refers to
 * its parent), in the model's order. A Business Application supports a capability when any
 * relationship joins the two, whichever way it is drawn. A capability with several parents is drawn
 * under the first; a loop of parents is broken as `drawnParents` says. Built without recursion, so a
 * hierarchy of any depth is drawn.
 */
export function capabilityMap(model: Model): CapabilityTile[] {
  const classOf = new Map(model.nodes.map((n) => [n.id, n.class]));
  const order = new Map(model.nodes.map((n, i) => [n.id, i]));
  const caps = model.nodes.filter((n) => n.class === CAPABILITY).map((n) => n.id);
  const parents = new Map<string, string[]>();
  const apps = new Map<string, Set<string>>();
  const support = (cap: string, app: string) => {
    if (!apps.has(cap)) apps.set(cap, new Set());
    apps.get(cap)!.add(app);
  };
  for (const e of model.edges) {
    const from = classOf.get(e.from);
    const to = classOf.get(e.to);
    if (from === CAPABILITY && to === CAPABILITY) {
      const list = parents.get(e.from) ?? [];
      if (e.from !== e.to && !list.includes(e.to)) parents.set(e.from, [...list, e.to]);
    } else if (from === CAPABILITY && to === APPLICATION) support(e.from, e.to);
    else if (from === APPLICATION && to === CAPABILITY) support(e.to, e.from);
  }
  const drawn = drawnParents(caps, parents, order);
  const childrenOf = new Map<string | null, string[]>();
  for (const c of caps) {
    const p = drawn.get(c) ?? null;
    childrenOf.set(p, [...(childrenOf.get(p) ?? []), c]);
  }
  // Top down, then built bottom up: a tile's children are ready before it.
  const topDown: string[] = [];
  for (const stack = [...(childrenOf.get(null) ?? [])].reverse(); stack.length; ) {
    const id = stack.pop()!;
    topDown.push(id);
    stack.push(...[...(childrenOf.get(id) ?? [])].reverse());
  }
  const tiles = new Map<string, CapabilityTile>();
  const sets = new Map<string, Set<string>>();
  for (const id of [...topDown].reverse()) {
    const own = [...(apps.get(id) ?? [])].sort((a, b) => order.get(a)! - order.get(b)!);
    const kids = childrenOf.get(id) ?? [];
    // The applications across the parts, grown from the largest child's set (taken over, not copied).
    const kidSets = kids.map((k) => sets.get(k)!);
    const all = kidSets.reduce((a, s) => (s.size > a.size ? s : a), new Set<string>());
    for (const s of kidSets) if (s !== all) for (const a of s) all.add(a);
    for (const a of own) all.add(a);
    for (const k of kids) sets.delete(k);
    sets.set(id, all);
    tiles.set(id, { id, apps: own, allApps: all.size, children: kids.map((k) => tiles.get(k)!), alsoUnder: (parents.get(id) ?? []).filter((p) => p !== drawn.get(id)) });
  }
  return (childrenOf.get(null) ?? []).map((id) => tiles.get(id)!);
}

/** M92: a tile's counts in words: "2 Business Applications · 5 with its parts". */
export function tileCounts(t: Pick<CapabilityTile, "apps" | "allApps" | "children">): string {
  const own = t.apps.length ? count(t.apps.length, "Business Application") : "No Business Applications";
  return t.children.length && t.allApps > t.apps.length ? `${own} · ${t.allApps} with its parts` : own;
}

/** M92: every tile in the map, each parent before the capabilities inside it. */
export function allTiles(tiles: CapabilityTile[]): CapabilityTile[] {
  const out: CapabilityTile[] = [];
  for (const stack = [...tiles].reverse(); stack.length; ) {
    const t = stack.pop()!;
    out.push(t);
    stack.push(...[...t.children].reverse());
  }
  return out;
}

/**
 * M92: the legend of the map's coloring. Colors are worked out over the whole model, so a value has
 * the color it has on the canvas; only values the capabilities carry are listed, counting the
 * capabilities in the view.
 */
export function capabilityLegend(model: Model, by: ColorBy, filter: ViewFilter, tags?: readonly string[]): LegendEntry[] {
  const slotOf = slotMap(model, by, tags);
  if (!slotOf) return [];
  const labelOf = valueLabels(model, by, tags);
  const counts = new Map<string, number>();
  const used = new Set<string>();
  const others = new Set<string>();
  for (const n of model.nodes) {
    if (n.class !== CAPABILITY) continue;
    const slot = slotOf(n);
    used.add(String(slot));
    if (slot === "other") others.add(labelOf(n));
    if (inView(n, filter, model)) counts.set(String(slot), (counts.get(String(slot)) ?? 0) + 1);
  }
  return legend(model, by, filter, tags)
    .filter((e) => used.has(String(e.slot)))
    .map((e) => ({ ...e, count: counts.get(String(e.slot)) ?? 0, ...(e.slot === "other" ? { label: `Other (${count(others.size, "value")})` } : {}) }));
}
