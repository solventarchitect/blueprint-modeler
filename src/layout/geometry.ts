export type Side = "top" | "bottom" | "left" | "right";
type Point = { x: number; y: number };

/**
 * Which sides an edge leaves and enters by. Same lane (within 60px vertically): side to side, so
 * the edge does not loop round the nodes; otherwise bottom to top (or top to bottom going up).
 * Shared by the canvas and the SVG export so both draw the same picture.
 */
export function edgeSides(from: Point, to: Point): [Side, Side] {
  if (Math.abs(from.y - to.y) < 60) return from.x <= to.x ? ["right", "left"] : ["left", "right"];
  return from.y < to.y ? ["bottom", "top"] : ["top", "bottom"];
}
