export type Side = "top" | "bottom" | "left" | "right";
type Point = { x: number; y: number };

/**
 * Which sides an edge leaves and enters by. Same lane (within 60px vertically): side to side, so
 * the edge does not loop round the nodes; otherwise bottom to top (or top to bottom going up).
 * With the layers as columns it is the other way round: same column (within 60px sideways) goes
 * up or down, otherwise side to side. Shared by the canvas and the exports so all draw the same picture.
 */
export function edgeSides(from: Point, to: Point, columns = false): [Side, Side] {
  const sideways = (): [Side, Side] => (from.x <= to.x ? ["right", "left"] : ["left", "right"]);
  const upDown = (): [Side, Side] => (from.y < to.y ? ["bottom", "top"] : ["top", "bottom"]);
  if (columns) return Math.abs(from.x - to.x) < 60 ? upDown() : sideways();
  return Math.abs(from.y - to.y) < 60 ? sideways() : upDown();
}
