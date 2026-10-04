import { acceptedTypes, allowedTypes, isClassId, relationshipsBetween } from "@/metamodel";
import { migrate } from "./migrate";
import { CURRENT_SCHEMA, edgeKey, modelSchema, type Model } from "./schema";

export type Issue = { level: "warning"; code: "disallowed-relationship" | "legacy-type"; edgeId: string; message: string };
export type ParseResult = { ok: true; model: Model; issues: Issue[] } | { ok: false; error: string };

/** The name a new model starts with. */
export const UNTITLED_MODEL = "Untitled Model";

/**
 * The model with its optional details set: trimmed, absent when empty, and placed right after the
 * name, so an exported file reads name, description, Artifact ID, then the rest.
 */
export function withDetails(model: Model, details: { description?: string; artifactId?: string }): Model {
  const description = details.description?.trim() ?? "";
  const artifactId = details.artifactId?.trim() ?? "";
  const { schema, id, name, created, updated, nodes, edges, layout } = model;
  return { schema, id, name, ...(description ? { description } : {}), ...(artifactId ? { artifactId } : {}), created, updated, nodes, edges, layout };
}

/** A new, empty model. */
export function createModel(name: string, now = new Date(), id: string = crypto.randomUUID()): Model {
  const ts = now.toISOString();
  return { schema: CURRENT_SCHEMA, id, name, created: ts, updated: ts, nodes: [], edges: [], layout: {} };
}

/**
 * Parse anything that claims to be a model (an imported file, a stored record).
 * Rejects what cannot be loaded safely: wrong shape, unknown classes, duplicate ids, edges that
 * point nowhere, layout for nodes that do not exist. Loads, with warnings, relationships the
 * metamodel does not allow — an imported sketch may break the rules, and hints say so later.
 */
export function parseModel(input: unknown): ParseResult {
  const migrated = migrate(input);
  if (!migrated.ok) return migrated;

  const parsed = modelSchema.safeParse(migrated.value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? ` at ${first.path.join(".")}` : "";
    return { ok: false, error: `The file is not a valid model${where}: ${first?.message ?? "unknown problem"}.` };
  }
  const model = withDetails(parsed.data, parsed.data);

  const nodeIds = new Set<string>();
  for (const n of model.nodes) {
    if (nodeIds.has(n.id)) return { ok: false, error: `Two elements share the id "${n.id}".` };
    if (!isClassId(n.class)) return { ok: false, error: `Unknown element type "${n.class}" on "${n.name || n.id}".` };
    nodeIds.add(n.id);
  }
  const classOf = new Map(model.nodes.map((n) => [n.id, n.class]));

  const edgeIds = new Set<string>();
  const keys = new Set<string>();
  const issues: Issue[] = [];
  for (const e of model.edges) {
    if (edgeIds.has(e.id)) return { ok: false, error: `Two relationships share the id "${e.id}".` };
    edgeIds.add(e.id);
    const from = classOf.get(e.from);
    const to = classOf.get(e.to);
    if (!from || !to) return { ok: false, error: `Relationship "${e.id}" points to an element that does not exist.` };
    const key = edgeKey(e);
    if (keys.has(key)) return { ok: false, error: `The same relationship appears twice (${e.type}).` };
    keys.add(key);

    if (!acceptedTypes(from, to).includes(e.type)) {
      issues.push({
        level: "warning",
        code: "disallowed-relationship",
        edgeId: e.id,
        message: relationshipsBetween(from, to).length
          ? `"${e.type}" is not a relationship type used between these elements.`
          : "These two element types are not related directly in CSDM.",
      });
    } else if (!allowedTypes(from, to).includes(e.type)) {
      issues.push({ level: "warning", code: "legacy-type", edgeId: e.id, message: `"${e.type}" is a legacy relationship type.` });
    }
  }

  for (const nodeId of Object.keys(model.layout)) {
    if (!nodeIds.has(nodeId)) return { ok: false, error: `Layout refers to an element that does not exist ("${nodeId}").` };
  }
  return { ok: true, model, issues };
}

/** Stable, human-readable file content (the JSON export). */
export function serializeModel(model: Model): string {
  return `${JSON.stringify(model, null, 2)}\n`;
}
