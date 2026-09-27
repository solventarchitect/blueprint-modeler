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
export type Lane = { layer: Layer; name: string; top: number; bottom: number };

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
 * Full-width lanes, one per layer that has elements, in layer order. Where two layers' elements
 * overlap vertically, the boundary sits halfway between them so lanes never overlap.
 */
export function layerLanes(model: Model, sizes: Sizes = {}, skip?: string): Lane[] {
  const boxes = layerBoxes(model, sizes, skip);
  const lanes = boxes.map((b) => ({ layer: b.layer, name: b.name, top: b.y, bottom: b.y + b.h }));
  for (let i = 1; i < lanes.length; i++) {
    const above = lanes[i - 1]!;
    const lane = lanes[i]!;
    const edge = Math.round((above.bottom + lane.top) / 2);
    above.bottom = edge;
    lane.top = edge;
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
  const h = sizeOf(sizes, id).height;
  const min = lane.top + 16;
  const max = Math.max(min, lane.bottom - h - 16);
  const y = Math.min(Math.max(pos.y, min), max);
  return { x: pos.x, y, settled: y !== pos.y, lane: lane.name };
}
