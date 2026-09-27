import { parseModel, serializeModel, type Issue, type Model } from "@/model";

/** Largest model file we will read (characters). Well above the schema's node/edge caps. */
export const MAX_FILE_CHARS = 5_000_000;

export type ImportResult = { ok: true; model: Model; issues: Issue[]; copied: boolean } | { ok: false; error: string };

/** A safe file name from the model name: lowercase words joined by hyphens. */
export function fileBase(model: Pick<Model, "name">): string {
  const slug = model.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "model";
}

export const exportJson = (model: Model) => ({ filename: `${fileBase(model)}.json`, text: serializeModel(model) });

/**
 * Read a model file. Nothing is saved here: the caller stores the result only when `ok`.
 * A file whose id matches a model already in this browser is imported as a copy with a new id,
 * so an import never overwrites existing work.
 */
export function importJson(text: string, existingIds: ReadonlySet<string>, newId: () => string = () => crypto.randomUUID()): ImportResult {
  if (text.length > MAX_FILE_CHARS) return { ok: false, error: "The file is too large to be a Blueprint Modeler model (over 5 MB)." };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "The file is not JSON. Choose a model file exported from Blueprint Modeler." };
  }
  const r = parseModel(data);
  if (!r.ok) return r;
  const copied = existingIds.has(r.model.id);
  return { ok: true, model: copied ? { ...r.model, id: newId() } : r.model, issues: r.issues, copied };
}
