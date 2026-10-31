import { z } from "zod";

/** Current model file version. Bump it only with a migration in migrate.ts. */
export const CURRENT_SCHEMA = 1 as const;

const id = z.string().min(1).max(64);
const name = z.string().max(200);

/** How many links an element can carry (M65). */
export const MAX_LINKS = 5;
/** A web address a link may open: http or https only, never a script or another scheme. */
export const isWebUrl = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};
/**
 * What someone typed as a link's address, as the address to store: a scheme-less address
 * ("example.com/x", "localhost:3000") is taken as https; the result is the browser's own form of it
 * (what `href` opens), or null when it is not an http(s) address.
 */
export function toWebAddress(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^(javascript|data|vbscript|mailto|tel|file|blob|about|ftp):/i.test(t);
  const candidate = hasScheme ? t : `https://${t}`;
  return isWebUrl(candidate) ? new URL(candidate).href : null;
}
export const linkSchema = z.object({
  title: z.string().trim().min(1).max(100),
  // Stored in the browser's own form, so what is checked, shown, compared and opened is one string.
  url: z
    .string()
    .trim()
    .max(2000)
    .refine(isWebUrl)
    .transform((u) => new URL(u).href),
});
export type Link = z.infer<typeof linkSchema>;

/**
 * M68: plan status, Planned (not there yet) or Retiring (going away); absent is Live. Optional and
 * additive in format 1: older versions ignore it. A value this version doesn't know is dropped, not the file.
 */
export const PLANS = ["planned", "retiring"] as const;
const plan = z.enum(PLANS).optional().catch(undefined);

/** M69: how many tags an element can carry, and how long each can be. */
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 40;
/**
 * Tags as stored: trimmed, non-empty, at most MAX_TAG_LENGTH characters, no comma (tags are typed
 * and shown as a comma-separated list), once each ignoring case (the first spelling wins), at most MAX_TAGS.
 */
export function cleanTags(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values.slice(0, 200)) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t || t.length > MAX_TAG_LENGTH || t.includes(",") || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

export const nodeSchema = z.object({
  id,
  class: z.string().min(1).max(64),
  name,
  // M54: lifecycle, environment, owner; M65: ref, a record number such as APM0001234 (text only).
  attrs: z.record(z.string().max(64), z.string().max(2000)).optional(),
  /**
   * M65: links to pages about the element (runbooks, records). Optional and additive in format 1:
   * older versions ignore it. A link that is not a titled http(s) address is dropped, not the file.
   */
  links: z
    .unknown()
    .transform((value): Link[] | undefined => {
      if (!Array.isArray(value)) return undefined;
      const kept = value
        .slice(0, 50)
        .map((x) => linkSchema.safeParse(x))
        .filter((r) => r.success)
        .map((r) => r.data!)
        .slice(0, MAX_LINKS);
      // None left: no key at all, as the editor stores it.
      return kept.length ? kept : undefined;
    })
    .optional(),
  plan,
  /**
   * M69: free labels (a team, program or cost center). Optional and additive in format 1: older
   * versions ignore it. A tag that is not text or is too long is dropped, not the file.
   */
  tags: z
    .unknown()
    .transform((value): string[] | undefined => {
      if (!Array.isArray(value)) return undefined;
      const kept = cleanTags(value);
      return kept.length ? kept : undefined;
    })
    .optional(),
});

/** The sides of an element a relationship can leave or reach. */
export const SIDES = ["top", "right", "bottom", "left"] as const;
const side = z.enum(SIDES);

export const edgeSchema = z.object({
  id,
  from: id,
  to: id,
  type: z.string().min(1).max(64),
  /**
   * M61: the side a relationship leaves its From element and reaches its To element on, where the
   * modeler chose one; absent sides are picked from the layout. Optional and additive in format 1:
   * older versions ignore it and pick both.
   */
  ports: z.object({ from: side.optional(), to: side.optional() }).optional(),
  plan,
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
  /** M68: plan status ("live", "planned", "retiring"); older versions ignore it and keep every element. A value this version doesn't know is dropped, not the file. */
  plan: z
    .unknown()
    .transform((v): string[] | undefined => {
      if (!Array.isArray(v)) return undefined;
      const kept = [...new Set(v.filter((x): x is string => x === "live" || x === "planned" || x === "retiring"))];
      return kept.length ? kept : undefined;
    })
    .optional(),
  /** M69: tags; an element carrying any of them is kept ("" keeps the untagged). Older versions ignore it. */
  tags: values(200),
});
/** What a view can group elements by (M56), worked out from the model; see groups.ts. */
export const GROUP_BY = ["business_application", "service_offering", "environment"] as const;
/** How many views a model can hold. */
export const MAX_VIEWS = 20;
/** A saved view (M54): a named filter and coloring. Optional and additive in format 1. */
export const viewSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  filter: viewFilterSchema,
  colorBy: z.enum(COLOR_BY),
  /** M56: frames around the elements that belong together; optional and additive in format 1 (older versions ignore it). */
  // A grouping this version does not know drops the grouping, not the file.
  groupBy: z.enum(GROUP_BY).optional().catch(undefined),
});

/** M70: how many saved flows a model can hold, and how many steps a flow can have. */
export const MAX_FLOWS = 20;
export const MAX_FLOW_STEPS = 50;
/** One step of a saved flow: along a relationship, from its From end to its To end, or against it (`back`). */
export const flowStepSchema = z.object({ edge: id, back: z.literal(true).optional().catch(undefined) });
/** A saved flow (M70): a named walk through the model, one relationship a step, played like a data flow. */
export const flowSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  steps: z
    .array(z.unknown())
    .transform((xs) => xs.slice(0, 500).flatMap((x) => {
      const r = flowStepSchema.safeParse(x);
      return r.success ? [r.data.back ? { edge: r.data.edge, back: true as const } : { edge: r.data.edge }] : [];
    }).slice(0, MAX_FLOW_STEPS)),
});
export type FlowStep = z.infer<typeof flowStepSchema>;
export type Flow = z.infer<typeof flowSchema>;

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
  /**
   * M70: saved flows. Optional and additive in format 1: older versions ignore it. A flow or step
   * this version can't read is dropped, not the file; a second flow with the same id too; at most MAX_FLOWS.
   */
  flows: z
    .unknown()
    .transform((value): Flow[] | undefined => {
      if (!Array.isArray(value)) return undefined;
      const seen = new Set<string>();
      const kept: Flow[] = [];
      for (const x of value.slice(0, 200)) {
        const r = flowSchema.safeParse(x);
        if (!r.success || seen.has(r.data.id)) continue;
        seen.add(r.data.id);
        kept.push(r.data);
        if (kept.length === MAX_FLOWS) break;
      }
      return kept.length ? kept : undefined;
    })
    .optional(),
});

export type Node = z.infer<typeof nodeSchema>;
export type Edge = z.infer<typeof edgeSchema>;
export type Model = z.infer<typeof modelSchema>;
export type View = z.infer<typeof viewSchema>;
export type ViewFilter = z.infer<typeof viewFilterSchema>;
export type ColorBy = (typeof COLOR_BY)[number];
export type GroupBy = (typeof GROUP_BY)[number];
export type Plan = (typeof PLANS)[number];

/** Edge identity: two edges with the same endpoints and type are the same relationship. */
export const edgeKey = (e: Pick<Edge, "from" | "type" | "to">) => `${e.from}|${e.type}|${e.to}`;
