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

/** What a view can color elements by (M54). */
export const COLOR_BY = ["layer", "lifecycle", "environment", "owner"] as const;
// Values as long as an element property can be (attrs strings), so any value in a model can be filtered on.
const values = (max: number) => z.array(z.string().max(2000)).max(max).optional();
/** A view's filter: within one dimension any value matches; every dimension given must match. "" = not set. */
export const viewFilterSchema = z.object({
  layers: values(10),
  classes: values(200),
  lifecycle: values(50),
  environment: values(200),
  owner: values(200),
});
/** How many views a model can hold. */
export const MAX_VIEWS = 20;
/** A saved view (M54): a named filter and coloring. Optional and additive in format 1. */
export const viewSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  filter: viewFilterSchema,
  colorBy: z.enum(COLOR_BY),
});

export const modelSchema = z.object({
  schema: z.literal(CURRENT_SCHEMA),
  id,
  name,
  /** The model's date (a revision or "as of" date), shown in the title block; the creation day when absent. */
  date: z.iso.date().optional(),
  /** Optional: what the model is for, shown under its name on the canvas and in images. */
  description: z.string().max(1000).optional(),
  /** Optional: the owner's reference for the model, such as a document or architecture ID. */
  artifactId: z.string().max(64).optional(),
  created: z.iso.datetime(),
  updated: z.iso.datetime(),
  nodes: z.array(nodeSchema).max(5000),
  edges: z.array(edgeSchema).max(20000),
  /** Layout sidecar, keyed by node id. Positions never live on the nodes themselves. */
  layout: z.record(id, positionSchema),
  /** Saved views (M54); absent when there are none. Older versions ignore it. */
  views: z
    .array(viewSchema)
    .max(MAX_VIEWS)
    .refine((vs) => new Set(vs.map((v) => v.id)).size === vs.length, "Two views share an id")
    .optional(),
});

export type Node = z.infer<typeof nodeSchema>;
export type Edge = z.infer<typeof edgeSchema>;
export type Model = z.infer<typeof modelSchema>;
export type View = z.infer<typeof viewSchema>;
export type ViewFilter = z.infer<typeof viewFilterSchema>;
export type ColorBy = (typeof COLOR_BY)[number];

/** Edge identity: two edges with the same endpoints and type are the same relationship. */
export const edgeKey = (e: Pick<Edge, "from" | "type" | "to">) => `${e.from}|${e.type}|${e.to}`;
