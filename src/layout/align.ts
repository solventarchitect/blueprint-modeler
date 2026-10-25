import type { Model } from "@/model";
import { DEFAULT_SIZE, type Size } from "./layout";

type Sizes = Record<string, Size | undefined>;
export type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type Rect = { x: number; y: number; width: number; height: number };

const sizeOf = (sizes: Sizes, id: string) => sizes[id] ?? DEFAULT_SIZE;

/**
 * Line up elements on one edge or center line of the box around them (M57): left, center and
 * right move them across, top, middle and bottom up or down; the other coordinate stays. Returns
 * the new positions, or null when there is nothing to change.
 */
export function alignNodes(model: Model, ids: string[], sizes: Sizes, edge: AlignEdge): Model["layout"] | null {
  const placed = ids.filter((id) => model.layout[id]);
  if (placed.length < 2) return null;
  const rects = placed.map((id) => ({ id, ...model.layout[id]!, ...sizeOf(sizes, id) }));
  const left = Math.min(...rects.map((r) => r.x));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const top = Math.min(...rects.map((r) => r.y));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  const at = (r: (typeof rects)[number]) => {
    switch (edge) {
      case "left":
        return { x: left, y: r.y };
      case "center":
        return { x: (left + right) / 2 - r.width / 2, y: r.y };
      case "right":
        return { x: right - r.width, y: r.y };
      case "top":
        return { x: r.x, y: top };
      case "middle":
        return { x: r.x, y: (top + bottom) / 2 - r.height / 2 };
      case "bottom":
        return { x: r.x, y: bottom - r.height };
    }
  };
  const next = Object.fromEntries(rects.map((r) => {
    const p = at(r);
    return [r.id, { x: Math.round(p.x), y: Math.round(p.y) }];
  }));
  return placed.every((id) => next[id]!.x === model.layout[id]!.x && next[id]!.y === model.layout[id]!.y) ? null : next;
}

/** A guide line to draw while dragging: vertical at x (axis "x") or horizontal at y, from one end to the other. */
export type Guide = { axis: "x" | "y"; at: number; from: number; to: number };

const xs = (r: Rect) => [r.x, r.x + r.width / 2, r.x + r.width];
const ys = (r: Rect) => [r.y, r.y + r.height / 2, r.y + r.height];

/**
 * Smart guides (M57): the shift that lines the moving box up with another element (its left, center
 * or right with theirs, and its top, middle or bottom with theirs), each axis on its own, when one is
 * within `threshold`; the nearest wins. Also the guide lines to draw through everything that lines up.
 */
export function snapToGuides(moving: Rect, others: Rect[], threshold: number): { dx: number; dy: number; guides: Guide[] } {
  const best = (mine: number[], theirs: (r: Rect) => number[]) => {
    let d: number | null = null;
    for (const o of others) for (const t of theirs(o)) for (const m of mine) {
      const diff = t - m;
      if (Math.abs(diff) <= threshold && (d === null || Math.abs(diff) < Math.abs(d))) d = diff;
    }
    return d;
  };
  const dx = best(xs(moving), xs) ?? 0;
  const dy = best(ys(moving), ys) ?? 0;
  const snapped = { ...moving, x: moving.x + dx, y: moving.y + dy };
  const guides: Guide[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
  // A line through every edge or center of the moved box that now matches another element's.
  for (const m of xs(snapped)) {
    const hits = others.filter((o) => xs(o).some((t) => near(t, m)));
    if (hits.length) guides.push({ axis: "x", at: m, from: Math.min(snapped.y, ...hits.map((h) => h.y)), to: Math.max(snapped.y + snapped.height, ...hits.map((h) => h.y + h.height)) });
  }
  for (const m of ys(snapped)) {
    const hits = others.filter((o) => ys(o).some((t) => near(t, m)));
    if (hits.length) guides.push({ axis: "y", at: m, from: Math.min(snapped.x, ...hits.map((h) => h.x)), to: Math.max(snapped.x + snapped.width, ...hits.map((h) => h.x + h.width)) });
  }
  return { dx, dy, guides };
}

/** The box around some rectangles. */
export function boundsOf(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, width: Math.max(...rects.map((r) => r.x + r.width)) - x, height: Math.max(...rects.map((r) => r.y + r.height)) - y };
}
