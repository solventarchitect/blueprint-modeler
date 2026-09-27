import type { ElkNode } from "elkjs/lib/elk-api";
import { classById, type Layer } from "@/metamodel";
import type { Model } from "@/model";

/** Lane order, top to bottom. ELK partitions keep every element in its CSDM layer's band. */
const partitionOf: Record<Layer, number> = { business: 0, design: 1, service: 2, functional: 3, infrastructure: 4 };

export type Size = { width: number; height: number };
export const DEFAULT_SIZE: Size = { width: 224, height: 64 };

/** Something that lays out an ELK graph: elk.bundled in tests, a Web Worker in the browser. */
export type LayoutEngine = { layout: (graph: ElkNode) => Promise<ElkNode> };

/** The ELK graph for a model: top-down, layered, partitioned by CSDM layer. */
export function toElkGraph(model: Model, sizes: Record<string, Size> = {}): ElkNode {
  return {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.partitioning.activate": "true",
      "elk.layered.spacing.nodeNodeBetweenLayers": "72",
      "elk.spacing.nodeNode": "64",
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

export async function autoLayout(engine: LayoutEngine, model: Model, sizes?: Record<string, Size>): Promise<Model["layout"]> {
  if (model.nodes.length === 0) return {};
  return fromElkResult(await engine.layout(toElkGraph(model, sizes)));
}
