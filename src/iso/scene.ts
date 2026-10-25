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
/** A relationship's route: a pipe on its layer's slab (same layer) or a bridge between the blocks' tops (across layers); both run only along the three axes. */
export type IsoEdge = { id: string; from: string; to: string; points: P3[]; across: boolean };
export type IsoScene = { slabs: IsoSlab[]; blocks: IsoBlock[]; edges: IsoEdge[]; mode: IsoMode };

/** Bottom to top: how many steps above the ground each layer stands. */
export const RANK: Record<Layer, number> = { infrastructure: 0, functional: 1, service: 2, design: 3, business: 4 };
/** The rise from one layer to the next, by mode (the design system's elevation scale: z-3 tight, past z-4 exploded). */
export const STEP: Record<IsoMode, number> = { iso: 48, exploded: 160 };
/** Block heights by layer: platforms lie flat, things closer to the business stand taller. */
export const HEIGHT: Record<Layer, number> = { infrastructure: 22, functional: 28, service: 34, design: 40, business: 46 };
export const SLAB = 8;
/** How far Present lifts the layer it is showing above its place. */
export const LIFT = 36;
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

/** `lift`: a layer Present is showing, raised above its place. */
/** The overlap of two ranges, or null. */
const overlap = (a0: number, a1: number, b0: number, b1: number) => (Math.max(a0, b0) < Math.min(a1, b1) ? { from: Math.max(a0, b0), to: Math.min(a1, b1) } : null);

/**
 * A pipe on the slab from the edge of one block to the edge of the other, never diagonal (the design
 * system's rule) and never through either block: straight across where the blocks face each other
 * (their y or x ranges overlap), else one right angle, which then always turns outside both blocks.
 * Null when the blocks overlap.
 */
export function pipeRoute(a: Rect, b: Rect): { x: number; y: number }[] | null {
  const ys = overlap(a.y, a.y + a.d, b.y, b.y + b.d);
  const xs = overlap(a.x, a.x + a.w, b.x, b.x + b.w);
  if (ys && xs) return null;
  if (ys) {
    const y = (ys.from + ys.to) / 2;
    return a.x < b.x ? [{ x: a.x + a.w, y }, { x: b.x, y }] : [{ x: a.x, y }, { x: b.x + b.w, y }];
  }
  if (xs) {
    const x = (xs.from + xs.to) / 2;
    return a.y < b.y ? [{ x, y: a.y + a.d }, { x, y: b.y }] : [{ x, y: a.y }, { x, y: b.y + b.d }];
  }
  const ca = center(a);
  const cb = center(b);
  const corner = { x: cb.x, y: ca.y };
  return [exitPoint(a, ca, corner), corner, exitPoint(b, cb, corner)];
}

/** How far above its layer's block tops a bridge runs, before it drops onto the block it joins. */
export const BRIDGE_CLEAR = 14;

/**
 * Across layers (M60): a bridge along the three axes only, so it keeps the pipes' angles. It rises
 * straight up from the top of the lower block to just above the higher layer's block tops, runs
 * back or forward (y) over the layers between (all lower), then across (x) along the higher block's
 * own lane, above its row, and drops onto its top. Staying over the lanes keeps it inside the
 * picture (running across in front of the lower layer first made wide V's below everything). Drawn
 * from `from` to `to`, whichever is higher.
 */
export function bridgeRoute(a: IsoBlock, b: IsoBlock): P3[] {
  const [low, high] = a.z <= b.z ? [a, b] : [b, a];
  const cl = center(low.rect);
  const ch = center(high.rect);
  const z = high.z + high.h + BRIDGE_CLEAR;
  const points: P3[] = [
    { x: cl.x, y: cl.y, z: low.z + low.h },
    { x: cl.x, y: cl.y, z },
    { x: cl.x, y: ch.y, z },
    { x: ch.x, y: ch.y, z },
    { x: ch.x, y: ch.y, z: high.z + high.h },
  ].filter((p, i, all) => i === 0 || p.x !== all[i - 1]!.x || p.y !== all[i - 1]!.y || p.z !== all[i - 1]!.z);
  return low === a ? points : points.reverse();
}

export function isoScene(model: Model, mode: IsoMode, sizes: Record<string, Size | undefined> = {}, lift?: Layer): IsoScene {
  const step = STEP[mode];
  const layerOf = new Map(model.nodes.map((n) => [n.id, classById(n.class)?.layer ?? "design"] as const));
  const top = (layer: Layer) => RANK[layer] * step + (layer === lift ? LIFT : 0);
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
    if (a.layer === b.layer) {
      const route = pipeRoute(a.rect, b.rect);
      // Blocks that overlap (stacked, or pasted onto one another) have no gap for a pipe.
      if (route) edges.push({ id: e.id, from: e.from, to: e.to, points: route.map((p) => ({ ...p, z: a.z + 1 })), across: false });
    } else {
      edges.push({ id: e.id, from: e.from, to: e.to, points: bridgeRoute(a, b), across: true });
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

export type Solid = { rect: Rect; z: number; h: number };

/** A box's outline on screen, as its projected bounds. */
function screenBounds(s: Solid) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const x of [s.rect.x, s.rect.x + s.rect.w])
    for (const y of [s.rect.y, s.rect.y + s.rect.d])
      for (const z of [s.z, s.z + s.h]) {
        const p = project({ x, y, z });
        xs.push(p.x);
        ys.push(p.y);
      }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/**
 * Painter's order for boxes, back to front. Only boxes whose outlines overlap on screen need an order
 * between them, and `behind` gives each such pair its true one; a topological sort of those pairs
 * keeps every overlap right (a plain sort would not: `behind` is not transitive across pairs that
 * never meet). Ties, and the rare cycle of overlapping footprints, go to the deeper middle.
 */
export function paintOrder<T extends Solid>(items: T[]): T[] {
  const n = items.length;
  const bounds = items.map(screenBounds);
  const after: number[][] = items.map(() => []);
  const indeg = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const a = bounds[i]!;
      const b = bounds[j]!;
      if (a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0) continue;
      const c = behind(items[i]!.rect, items[i]!.z, items[j]!.rect, items[j]!.z);
      const [first, second] = c <= 0 ? [i, j] : [j, i];
      after[first]!.push(second);
      indeg[second]!++;
    }
  const mid = (t: T) => depth({ x: t.rect.x + t.rect.w / 2, y: t.rect.y + t.rect.d / 2, z: t.z });
  const left = new Set(items.keys());
  const out: T[] = [];
  while (left.size) {
    let pick = -1;
    for (const i of left) if (indeg[i] === 0 && (pick < 0 || mid(items[i]!) < mid(items[pick]!))) pick = i;
    if (pick < 0) for (const i of left) if (pick < 0 || mid(items[i]!) < mid(items[pick]!)) pick = i; // a cycle: break it
    left.delete(pick);
    out.push(items[pick]!);
    for (const j of after[pick]!) indeg[j]!--;
  }
  return out;
}

/** Back to front: the layers farthest from the viewer first, each counted with its blocks' heights. */
export function drawOrder(scene: IsoScene): Layer[] {
  const tallest = (l: Layer) => Math.max(0, ...scene.blocks.filter((b) => b.layer === l).map((b) => b.h));
  const solids = [...scene.slabs]
    .sort((a, b) => LAYERS.findIndex((l) => l.id === a.layer) - LAYERS.findIndex((l) => l.id === b.layer))
    .map((s) => ({ layer: s.layer, rect: s.rect, z: s.top - SLAB, h: SLAB + tallest(s.layer) }));
  return paintOrder(solids).map((s) => s.layer);
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
