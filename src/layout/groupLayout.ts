import { classById } from "@/metamodel";
import { primaryGroup, type Group, type Model } from "@/model";
import { layoutOrientation } from "./bands";
import { DEFAULT_SIZE, type Size } from "./layout";

type Sizes = Record<string, Size | undefined>;
/** Room between one element and the next in a group's band, and between bands. */
export const GROUP_ITEM_GAP = 48;
export const GROUP_GAP = 112;
/** How far a group's frame stands out from its elements; the tab sits on its top edge. */
export const GROUP_PAD = 20;

/**
 * Arrange by group (M56): each group gets its own band across the layers, so its frame holds its
 * elements and frames sit side by side; elements keep their layer row (or column), in the order they
 * stood. An element in two groups goes with its first. Elements in no group follow the last band.
 * Returns the new positions, or null when nothing would move.
 */
export function arrangeByGroups(model: Model, groups: Group[], sizes: Sizes = {}): Model["layout"] | null {
  const placed = model.nodes.filter((n) => model.layout[n.id]);
  if (!placed.length || !groups.length) return null;
  const columns = layoutOrientation(model, sizes) === "columns";
  // Along the band (across the layers' direction) and across it.
  const along = (id: string) => (columns ? model.layout[id]!.y : model.layout[id]!.x);
  const span = (id: string) => (columns ? (sizes[id] ?? DEFAULT_SIZE).height : (sizes[id] ?? DEFAULT_SIZE).width);
  const primary = primaryGroup(groups);
  const order = [...groups.map((g) => g.key), ""];
  const layerOf = (id: string) => classById(model.nodes.find((n) => n.id === id)!.class)?.layer ?? "design";

  const start = Math.min(...placed.map((n) => along(n.id)));
  const next: Model["layout"] = {};
  let cursor = start;
  for (const key of order) {
    const members = placed.filter((n) => (primary.get(n.id) ?? "") === key).map((n) => n.id);
    if (!members.length) continue;
    const byLayer = new Map<string, string[]>();
    for (const id of members) byLayer.set(layerOf(id), [...(byLayer.get(layerOf(id)) ?? []), id]);
    let width = 0;
    for (const ids of byLayer.values()) {
      let at = cursor;
      for (const id of ids.sort((a, b) => along(a) - along(b) || a.localeCompare(b))) {
        const p = model.layout[id]!;
        next[id] = columns ? { x: p.x, y: Math.round(at) } : { x: Math.round(at), y: p.y };
        at += span(id) + GROUP_ITEM_GAP;
      }
      width = Math.max(width, at - GROUP_ITEM_GAP - cursor);
    }
    cursor += width + GROUP_GAP;
  }
  return placed.every((n) => next[n.id]!.x === model.layout[n.id]!.x && next[n.id]!.y === model.layout[n.id]!.y) ? null : next;
}

export type Frame = { key: string; label: string; count: number; x: number; y: number; w: number; h: number };

/** A frame around each group's placed elements, from their positions and sizes. */
export function groupFrames(groups: Group[], layout: Model["layout"], sizes: Sizes = {}): Frame[] {
  return groups.flatMap((g) => {
    const ids = g.nodeIds.filter((id) => layout[id]);
    if (!ids.length) return [];
    const x0 = Math.min(...ids.map((id) => layout[id]!.x));
    const y0 = Math.min(...ids.map((id) => layout[id]!.y));
    const x1 = Math.max(...ids.map((id) => layout[id]!.x + (sizes[id] ?? DEFAULT_SIZE).width));
    const y1 = Math.max(...ids.map((id) => layout[id]!.y + (sizes[id] ?? DEFAULT_SIZE).height));
    return [{ key: g.key, label: g.label, count: g.nodeIds.length, x: x0 - GROUP_PAD, y: y0 - GROUP_PAD, w: x1 - x0 + 2 * GROUP_PAD, h: y1 - y0 + 2 * GROUP_PAD }];
  });
}
