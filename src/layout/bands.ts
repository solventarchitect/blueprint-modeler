import { classById, type Layer } from "@/metamodel";
import type { Model } from "@/model";
import { DEFAULT_SIZE, type Size } from "./layout";

/** CSDM layers top to bottom, with the names shown on boxes, lanes and present-mode steps. */
export const LAYERS: { id: Layer; name: string }[] = [
  { id: "business", name: "Business" },
  { id: "design", name: "Design" },
  { id: "service", name: "Service" },
  { id: "functional", name: "Functional" },
  { id: "infrastructure", name: "Infrastructure" },
];

const BOX_PAD = 24;
export type Rect = { x: number; y: number; w: number; h: number };
export type LayerBox = Rect & { layer: Layer; name: string; nodeIds: string[] };
/** A lane's span: y (rows, the usual) or x (columns, when the layers sit side by side). */
export type Lane = { layer: Layer; name: string; start: number; end: number; columns: boolean };

type Sizes = Record<string, Size | undefined>;
const sizeOf = (sizes: Sizes, id: string) => sizes[id] ?? DEFAULT_SIZE;

/** A translucent box around each layer's elements (layers with no elements get none). */
export function layerBoxes(model: Model, sizes: Sizes = {}, skip?: string): LayerBox[] {
  const boxes: LayerBox[] = [];
  for (const { id, name } of LAYERS) {
    const nodes = model.nodes.filter((n) => n.id !== skip && classById(n.class)?.layer === id && model.layout[n.id]);
    if (nodes.length === 0) continue;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const n of nodes) {
      const p = model.layout[n.id]!;
      const s = sizeOf(sizes, n.id);
      x1 = Math.min(x1, p.x);
      y1 = Math.min(y1, p.y);
      x2 = Math.max(x2, p.x + s.width);
      y2 = Math.max(y2, p.y + s.height);
    }
    boxes.push({ layer: id, name, nodeIds: nodes.map((n) => n.id), x: x1 - BOX_PAD, y: y1 - BOX_PAD - 12, w: x2 - x1 + 2 * BOX_PAD, h: y2 - y1 + 2 * BOX_PAD + 12 });
  }
  return boxes;
}

/**
 * Which way the layers run. Columns when every populated layer sits wholly to the right of the one
 * before it and the layers do not also stack top to bottom (a left-to-right layout); rows
 * otherwise, including a single layer or no elements.
 */
export function layoutOrientation(model: Model, sizes: Sizes = {}, skip?: string): "rows" | "columns" {
  return orientationOf(layerBoxes(model, sizes, skip));
}

/** Rows win when the layers both stack and step sideways (a hand-drawn diagonal is still top-down). */
function orientationOf(boxes: LayerBox[]): "rows" | "columns" {
  if (boxes.length < 2) return "rows";
  if (boxes.every((b, i) => i === 0 || b.y >= boxes[i - 1]!.y + boxes[i - 1]!.h)) return "rows";
  return boxes.every((b, i) => i === 0 || b.x >= boxes[i - 1]!.x + boxes[i - 1]!.w) ? "columns" : "rows";
}

/**
 * Full-width lanes (or full-height, as columns), one per layer that has elements, in layer order.
 * Where two layers' elements overlap along the lane axis, the boundary sits halfway between them
 * so lanes never overlap.
 */
export function layerLanes(model: Model, sizes: Sizes = {}, skip?: string): Lane[] {
  const boxes = layerBoxes(model, sizes, skip);
  const columns = orientationOf(boxes) === "columns";
  const lanes = boxes.map((b) => (columns ? { layer: b.layer, name: b.name, start: b.x, end: b.x + b.w, columns } : { layer: b.layer, name: b.name, start: b.y, end: b.y + b.h, columns }));
  for (let i = 1; i < lanes.length; i++) {
    const before = lanes[i - 1]!;
    const lane = lanes[i]!;
    const edge = Math.round((before.end + lane.start) / 2);
    before.end = edge;
    lane.start = edge;
  }
  return lanes;
}

/**
 * With lanes on, an element dropped outside its own layer's lane settles back inside it (lanes are
 * computed from the other elements, so the moved one cannot drag its lane along). Returns the
 * position to keep, and whether it moved.
 */
export function settleIntoLane(model: Model, sizes: Sizes, id: string, pos: { x: number; y: number }): { x: number; y: number; settled: boolean; lane?: string } {
  const node = model.nodes.find((n) => n.id === id);
  const layer = node ? classById(node.class)?.layer : undefined;
  const lane = layerLanes(model, sizes, id).find((l) => l.layer === layer);
  if (!lane) return { ...pos, settled: false };
  const size = sizeOf(sizes, id);
  const extent = lane.columns ? size.width : size.height;
  const min = lane.start + 16;
  const max = Math.max(min, lane.end - extent - 16);
  const along = Math.min(Math.max(lane.columns ? pos.x : pos.y, min), max);
  const settled = along !== (lane.columns ? pos.x : pos.y);
  return lane.columns ? { x: along, y: pos.y, settled, lane: lane.name } : { x: pos.x, y: along, settled, lane: lane.name };
}
