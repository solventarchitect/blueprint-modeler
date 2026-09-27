import { CURRENT_SCHEMA } from "./schema";

/**
 * Migrations from version n to n+1, applied in order. Version 1 is the first published format,
 * so there are none yet; add `2: (v1) => v2` here when the format changes.
 */
const migrations: Record<number, (input: Record<string, unknown>) => Record<string, unknown>> = {};

export type MigrateResult = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

export function migrate(input: unknown): MigrateResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "This is not a Blueprint Modeler file." };
  }
  let value = input as Record<string, unknown>;
  const version = value.schema;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: "This is not a Blueprint Modeler file (no schema version)." };
  }
  if (version > CURRENT_SCHEMA) {
    return { ok: false, error: `This file was made by a newer version of Blueprint Modeler (format ${version}). Reload the page to update.` };
  }
  for (let v = version + 1; v <= CURRENT_SCHEMA; v++) {
    const step = migrations[v];
    if (!step) return { ok: false, error: `No migration to format ${v}.` };
    value = { ...step(value), schema: v };
  }
  return { ok: true, value };
}
