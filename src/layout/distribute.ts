import type { Model } from "@/model";

/**
 * Spread elements evenly from left to right, keeping each one's height on the canvas: the leftmost
 * stays put, the gaps become equal, and the span grows when the elements would sit closer than
 * `pitch` apart. Returns the new positions, or null when there is nothing to change.
 */
export function distributeEvenly(model: Model, ids: string[], pitch: number): Model["layout"] | null {
  const placed = ids.filter((id) => model.layout[id]).sort((a, b) => model.layout[a]!.x - model.layout[b]!.x || model.layout[a]!.y - model.layout[b]!.y);
  if (placed.length < 2) return null;
  const x0 = model.layout[placed[0]!]!.x;
  const span = Math.max(model.layout[placed[placed.length - 1]!]!.x - x0, (placed.length - 1) * pitch);
  const step = span / (placed.length - 1);
  const next = Object.fromEntries(placed.map((id, i) => [id, { x: Math.round(x0 + i * step), y: model.layout[id]!.y }]));
  return placed.every((id) => next[id]!.x === model.layout[id]!.x) ? null : next;
}
