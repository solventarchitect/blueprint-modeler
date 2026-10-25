import type { Model } from "@/model";

/**
 * Spread elements evenly from left to right, keeping each one's height on the canvas: the leftmost
 * stays put, the gaps become equal, and the span grows when the elements would sit closer than
 * `pitch` apart. With axis "y", the same from top to bottom (M57). Returns the new positions, or
 * null when there is nothing to change.
 */
export function distributeEvenly(model: Model, ids: string[], pitch: number, axis: "x" | "y" = "x"): Model["layout"] | null {
  const other = axis === "x" ? "y" : "x";
  const placed = ids.filter((id) => model.layout[id]).sort((a, b) => model.layout[a]![axis] - model.layout[b]![axis] || model.layout[a]![other] - model.layout[b]![other]);
  if (placed.length < 2) return null;
  const v0 = model.layout[placed[0]!]![axis];
  const span = Math.max(model.layout[placed[placed.length - 1]!]![axis] - v0, (placed.length - 1) * pitch);
  const step = span / (placed.length - 1);
  const next = Object.fromEntries(placed.map((id, i) => [id, { ...model.layout[id]!, [axis]: Math.round(v0 + i * step) }]));
  return placed.every((id) => next[id]![axis] === model.layout[id]![axis]) ? null : next;
}
