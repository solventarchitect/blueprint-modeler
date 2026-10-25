import { classById, type Layer } from "@/metamodel";
import { LAYERS, layerBoxes } from "@/layout/bands";
import { DEFAULT_SIZE, type Size } from "@/layout/layout";
import type { Model } from "@/model";

/**
 * The isometric view (M59): the model's own 2D layout lifted into three dimensions. Each CSDM layer's
 * box becomes a slab, raised by layer (Infrastructure on the ground, Business highest), and each
 * element stands on its layer's slab where it sits in 2D, as a block whose height grows toward the
 * business (the Motion + Isometric design system's block rule). The layout's lanes run back to front,
 * so the higher layers stand behind the lower ones and nothing hides another layer's elements.
 *
 * World axes: x and y are the 2D canvas axes (y toward the viewer), z is up. The projection is the
 * design system's 2:1 dimetric, orthographic: screen x = x − y, screen y = (x + y) / 2 − z.
 */

export type IsoMode = "iso" | "exploded";
export type P3 = { x: number; y: number; z: number };
export type Rect = { x: number; y: number; w: number; d: number };

export type IsoSlab = { layer: Layer; rect: Rect; top: number };
export type IsoBlock = { id: string; layer: Layer; rect: Rect; z: number; h: number };
/** A relationship's route: a pipe on its layer's slab (same layer) or a straight line between the blocks' tops (across layers). */
export type IsoEdge = { id: string; from: string; to: string; points: P3[]; across: boolean };
export type IsoScene = { slabs: IsoSlab[]; blocks: IsoBlock[]; edges: IsoEdge[]; mode: IsoMode };

/** Bottom to top: how many steps above the ground each layer stands. */
const RANK: Record<Layer, number> = { infrastructure: 0, functional: 1, service: 2, design: 3, business: 4 };
/** The rise from one layer to the next, by mode (the design system's elevation scale: z-3 tight, past z-4 exploded). */
export const STEP: Record<IsoMode, number> = { iso: 48, exploded: 160 };
/** Block heights by layer: platforms lie flat, things closer to the business stand taller. */
export const HEIGHT: Record<Layer, number> = { infrastructure: 22, functional: 28, service: 34, design: 40, business: 46 };
export const SLAB = 8;
/** How far a block stands in from its 2D box, so neighbors read as separate blocks. */
const INSET = 6;

export const project = (p: P3) => ({ x: p.x - p.y, y: (p.x + p.y) / 2 - p.z });
/** Painter's order: larger is nearer the viewer (the view looks down the (−1, −1, −1) direction). */
export const depth = (p: P3) => p.x + p.y + p.z;

const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.d / 2 });

/** Where a segment from inside a rectangle to `to` leaves it (the segments are axis-aligned). */
function exitPoint(r: Rect, from: { x: number; y: number }, to: { x: number; y: number }) {
  if (from.x === to.x) return { x: from.x, y: to.y > from.y ? r.y + r.d : r.y };
  return { x: to.x > from.x ? r.x + r.w : r.x, y: from.y };
}

export function isoScene(model: Model, mode: IsoMode, sizes: Record<string, Size | undefined> = {}): IsoScene {
  const step = STEP[mode];
  const layerOf = new Map(model.nodes.map((n) => [n.id, classById(n.class)?.layer ?? "design"] as const));
  const top = (layer: Layer) => RANK[layer] * step;
  const slabs: IsoSlab[] = layerBoxes(model, sizes).map((b) => ({ layer: b.layer, rect: { x: b.x, y: b.y, w: b.w, d: b.h }, top: top(b.layer) }));
  const blocks: IsoBlock[] = [];
  for (const n of model.nodes) {
    const pos = model.layout[n.id];
    if (!pos) continue;
    const layer = layerOf.get(n.id)!;
    const s = sizes[n.id] ?? DEFAULT_SIZE;
    blocks.push({ id: n.id, layer, rect: { x: pos.x + INSET, y: pos.y + INSET, w: s.width - 2 * INSET, d: s.height - 2 * INSET }, z: top(layer), h: HEIGHT[layer] });
  }
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const edges: IsoEdge[] = [];
  for (const e of model.edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b || a === b) continue;
    const ca = center(a.rect);
    const cb = center(b.rect);
    if (a.layer === b.layer) {
      // On the slab, along x then y (the design system's pipes never run diagonally), from the edge of
      // one block to the edge of the other.
      const z = a.z + 1;
      const corner = { x: cb.x, y: ca.y };
      const path = [ca, corner, cb].filter((p, i, all) => i === 0 || p.x !== all[i - 1]!.x || p.y !== all[i - 1]!.y);
      const start = exitPoint(a.rect, path[0]!, path[1]!);
      const end = exitPoint(b.rect, path[path.length - 1]!, path[path.length - 2]!);
      const points = [start, ...path.slice(1, -1), end].map((p) => ({ x: p.x, y: p.y, z }));
      edges.push({ id: e.id, from: e.from, to: e.to, points, across: false });
    } else {
      // Across layers: a straight line from the top of one block to the top of the other, between the
      // floors. (Right-angled bridges at this scale cross the whole picture; the design system's
      // never-diagonal rule is for pipes on a slab.)
      const points = [
        { x: ca.x, y: ca.y, z: a.z + a.h },
        { x: cb.x, y: cb.y, z: b.z + b.h },
      ];
      edges.push({ id: e.id, from: e.from, to: e.to, points, across: true });
    }
  }
  return { slabs, blocks, edges, mode };
}

/**
 * Painter's order for two boxes: when a plane x = c or y = c separates their footprints, every sight
 * line meets the one on the viewer's side of it last, whatever their heights (the view looks down
 * (−1, −1, −1)); otherwise the deeper middle is nearer. Lanes and the blocks in them are separated,
 * so this is exact for laid-out models.
 */
export function behind(a: Rect, za: number, b: Rect, zb: number): number {
  if (a.y + a.d <= b.y) return -1;
  if (b.y + b.d <= a.y) return 1;
  if (a.x + a.w <= b.x) return -1;
  if (b.x + b.w <= a.x) return 1;
  return depth({ x: a.x + a.w / 2, y: a.y + a.d / 2, z: za }) - depth({ x: b.x + b.w / 2, y: b.y + b.d / 2, z: zb });
}

/** Back to front: the layers farthest from the viewer first, as LAYERS order breaks ties. */
export function drawOrder(scene: IsoScene): Layer[] {
  return [...scene.slabs]
    .sort((a, b) => behind(a.rect, a.top, b.rect, b.top) || LAYERS.findIndex((l) => l.id === a.layer) - LAYERS.findIndex((l) => l.id === b.layer))
    .map((s) => s.layer);
}

/** The block faces a viewer sees, as world-space quads: top, then the two front sides (+y, +x). */
export function boxFaces(r: Rect, z0: number, z1: number): { top: P3[]; left: P3[]; right: P3[] } {
  const x0 = r.x, x1 = r.x + r.w, y0 = r.y, y1 = r.y + r.d;
  return {
    top: [{ x: x0, y: y0, z: z1 }, { x: x1, y: y0, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 }],
    // The +y face shows on the viewer's left, the +x face on the right.
    left: [{ x: x0, y: y1, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 }],
    right: [{ x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y1, z: z1 }, { x: x1, y: y0, z: z1 }],
  };
}
