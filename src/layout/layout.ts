import type { ElkNode } from "elkjs/lib/elk-api";
import { classById, type Layer } from "@/metamodel";
import type { Model } from "@/model";

/** Lane order, top to bottom. ELK partitions keep every element in its CSDM layer's band. */
const partitionOf: Record<Layer, number> = { business: 0, design: 1, service: 2, functional: 3, infrastructure: 4 };

export type Size = { width: number; height: number };
export const DEFAULT_SIZE: Size = { width: 224, height: 64 };

/** Something that lays out an ELK graph: elk.bundled in tests, a Web Worker in the browser. */
export type LayoutEngine = { layout: (graph: ElkNode) => Promise<ElkNode> };

/**
 * How the layers are arranged. `auto` lets ELK place everything within its layer's band;
 * `rows` and `columns` give each layer exactly one row or column; `symmetric` centers each layer
 * on a shared axis. (`fillSpace` below is the fifth Layout menu entry; it keeps the arrangement.)
 */
export type LayoutMode = "auto" | "rows" | "columns" | "symmetric";

/** The ELK graph for a model: layered, partitioned by CSDM layer, down or to the right. */
export function toElkGraph(model: Model, sizes: Record<string, Size> = {}, direction: "DOWN" | "RIGHT" = "DOWN"): ElkNode {
  return {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.partitioning.activate": "true",
      "elk.layered.spacing.nodeNodeBetweenLayers": "72",
      // Room for a side-to-side edge's label and arrow between neighbors in a layer.
      "elk.spacing.nodeNode": "112",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: model.nodes.map((n) => {
      const layer = classById(n.class)?.layer ?? "design";
      const size = sizes[n.id] ?? DEFAULT_SIZE;
      return { id: n.id, width: size.width, height: size.height, layoutOptions: { "elk.partitioning.partition": String(partitionOf[layer]) } };
    }),
    edges: model.edges.map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] })),
  };
}

/** New layout sidecar from an ELK result: whole pixels, one entry per node. */
export function fromElkResult(result: ElkNode): Model["layout"] {
  const layout: Model["layout"] = {};
  for (const c of result.children ?? []) layout[c.id] = { x: Math.round(c.x ?? 0), y: Math.round(c.y ?? 0) };
  return layout;
}

/**
 * Extra room ELK does not know about, added below (or, in columns, beside) each CSDM layer:
 * stacked layer boxes then leave space for the lower box's name tab (boxes pad 36 above their
 * elements and 24 below).
 */
export const LAYER_GAP = 144;

/** Gap between neighbors in a single row or column. */
const PITCH_GAP = 112;

const layerOf = (n: Model["nodes"][number]) => classById(n.class)?.layer ?? "design";
const sizeOf = (sizes: Record<string, Size> | undefined, id: string) => sizes?.[id] ?? DEFAULT_SIZE;

/** The model's nodes grouped by CSDM layer, in layer order, empty layers left out. */
function groups(model: Model) {
  const map = new Map<number, Model["nodes"]>();
  for (const n of model.nodes) {
    const k = partitionOf[layerOf(n)];
    map.set(k, [...(map.get(k) ?? []), n]);
  }
  return [...map.entries()].sort(([a], [b]) => a - b).map(([, nodes]) => nodes);
}

export async function autoLayout(engine: LayoutEngine, model: Model, sizes?: Record<string, Size>, mode: LayoutMode = "auto"): Promise<Model["layout"]> {
  if (model.nodes.length === 0) return {};
  const columns = mode === "columns";
  const layout = fromElkResult(await engine.layout(toElkGraph(model, sizes, columns ? "RIGHT" : "DOWN")));
  for (const n of model.nodes) {
    const p = layout[n.id];
    if (!p) continue;
    if (columns) p.x += partitionOf[layerOf(n)] * LAYER_GAP;
    else p.y += partitionOf[layerOf(n)] * LAYER_GAP;
  }
  if (mode === "rows" || mode === "columns") return strict(model, sizes, layout, columns);
  if (mode === "symmetric") return symmetric(model, sizes, layout);
  return layout;
}

/**
 * One row (or column) per layer: elements keep ELK's order along the row and sit an equal pitch
 * apart; rows follow one another with LAYER_GAP between them.
 */
function strict(model: Model, sizes: Record<string, Size> | undefined, elk: Model["layout"], columns: boolean): Model["layout"] {
  const layout: Model["layout"] = {};
  let offset = 0;
  for (const nodes of groups(model)) {
    const ordered = [...nodes].sort((a, b) => (columns ? elk[a.id]!.y - elk[b.id]!.y : elk[a.id]!.x - elk[b.id]!.x));
    let along = 0;
    let thickness = 0;
    for (const n of ordered) {
      const s = sizeOf(sizes, n.id);
      layout[n.id] = columns ? { x: offset, y: along } : { x: along, y: offset };
      along += (columns ? s.height : s.width) + PITCH_GAP;
      thickness = Math.max(thickness, columns ? s.width : s.height);
    }
    offset += thickness + LAYER_GAP;
  }
  return layout;
}

/** ELK's arrangement with every layer centered on the same vertical axis. */
function symmetric(model: Model, sizes: Record<string, Size> | undefined, elk: Model["layout"]): Model["layout"] {
  const layout: Model["layout"] = { ...elk };
  const spans = groups(model).map((nodes) => {
    const left = Math.min(...nodes.map((n) => elk[n.id]!.x));
    const right = Math.max(...nodes.map((n) => elk[n.id]!.x + sizeOf(sizes, n.id).width));
    return { nodes, center: (left + right) / 2 };
  });
  const axis = Math.max(...spans.map((s) => s.center));
  for (const { nodes, center } of spans) {
    const dx = Math.round(axis - center);
    for (const n of nodes) layout[n.id] = { x: elk[n.id]!.x + dx, y: elk[n.id]!.y };
  }
  return layout;
}

/**
 * Stretch the picture, as arranged, to the shape of the view (`aspect` = width / height) so a fit
 * leaves no empty band: positions spread apart along the shorter side, order and the top-left
 * corner kept, nothing shrunk. Null when the picture already has that shape or is too small.
 */
export function fillSpace(model: Model, sizes: Record<string, Size> | undefined, aspect: number): Model["layout"] | null {
  const placed = model.nodes.filter((n) => model.layout[n.id]);
  if (placed.length < 2 || !(aspect > 0)) return null;
  const pos = (n: Model["nodes"][number]) => model.layout[n.id]!;
  const x0 = Math.min(...placed.map((n) => pos(n).x));
  const y0 = Math.min(...placed.map((n) => pos(n).y));
  const w = Math.max(...placed.map((n) => pos(n).x + sizeOf(sizes, n.id).width)) - x0;
  const h = Math.max(...placed.map((n) => pos(n).y + sizeOf(sizes, n.id).height)) - y0;
  const xSpan = Math.max(...placed.map((n) => pos(n).x)) - x0;
  const ySpan = Math.max(...placed.map((n) => pos(n).y)) - y0;
  // Target width or height; the fixed element sizes come off before scaling the spans of positions.
  let sx = 1;
  let sy = 1;
  if (w / h < aspect && xSpan > 0) sx = (h * aspect - (w - xSpan)) / xSpan;
  else if (w / h > aspect && ySpan > 0) sy = (w / aspect - (h - ySpan)) / ySpan;
  if (Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return null;
  const next: Model["layout"] = {};
  for (const n of placed) next[n.id] = { x: Math.round(x0 + (pos(n).x - x0) * sx), y: Math.round(y0 + (pos(n).y - y0) * sy) };
  return placed.every((n) => next[n.id]!.x === pos(n).x && next[n.id]!.y === pos(n).y) ? null : next;
}
