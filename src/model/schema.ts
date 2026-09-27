import { z } from "zod";

/** Current model file version. Bump it only with a migration in migrate.ts. */
export const CURRENT_SCHEMA = 1 as const;

const id = z.string().min(1).max(64);
const name = z.string().max(200);

export const nodeSchema = z.object({
  id,
  class: z.string().min(1).max(64),
  name,
  attrs: z.record(z.string().max(64), z.string().max(2000)).optional(),
});

export const edgeSchema = z.object({
  id,
  from: id,
  to: id,
  type: z.string().min(1).max(64),
});

export const positionSchema = z.object({ x: z.number().finite(), y: z.number().finite() });

export const modelSchema = z.object({
  schema: z.literal(CURRENT_SCHEMA),
  id,
  name,
  created: z.iso.datetime(),
  updated: z.iso.datetime(),
  nodes: z.array(nodeSchema).max(5000),
  edges: z.array(edgeSchema).max(20000),
  /** Layout sidecar, keyed by node id. Positions never live on the nodes themselves. */
  layout: z.record(id, positionSchema),
});

export type Node = z.infer<typeof nodeSchema>;
export type Edge = z.infer<typeof edgeSchema>;
export type Model = z.infer<typeof modelSchema>;

/** Edge identity: two edges with the same endpoints and type are the same relationship. */
export const edgeKey = (e: Pick<Edge, "from" | "type" | "to">) => `${e.from}|${e.type}|${e.to}`;
