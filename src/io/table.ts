/**
 * The model as tables (M67): the rows the table view shows, and CSV for a spreadsheet. Pure.
 */
import { classById } from "@/metamodel";
import { attrValue, evaluateHints, PLAN_LABEL, planOf, type Model } from "@/model";

const LAYER_NAME: Record<string, string> = { business: "Business", design: "Design", service: "Service", functional: "Functional", infrastructure: "Infrastructure" };

export type ElementRow = {
  id: string;
  name: string;
  cls: string;
  layer: string;
  lifecycle: string;
  environment: string;
  owner: string;
  /** M68: Live, Planned or Retiring. */
  plan: string;
  ref: string;
  relationships: number;
  hints: number;
};
export type RelationshipRow = { id: string; from: string; type: string; to: string; plan: string };

export function elementRows(model: Model): ElementRow[] {
  const hintsOf = new Map<string, number>();
  for (const h of evaluateHints(model)) for (const id of new Set(h.nodeIds)) hintsOf.set(id, (hintsOf.get(id) ?? 0) + 1);
  const related = new Map<string, number>();
  for (const e of model.edges) for (const id of new Set([e.from, e.to])) related.set(id, (related.get(id) ?? 0) + 1);
  return model.nodes.map((n) => {
    const c = classById(n.class);
    return {
      id: n.id,
      name: n.name || "Untitled",
      cls: c?.label ?? n.class,
      layer: c ? LAYER_NAME[c.layer]! : "",
      lifecycle: attrValue(n, "lifecycle"),
      environment: attrValue(n, "environment"),
      owner: attrValue(n, "owner"),
      plan: PLAN_LABEL[planOf(n)],
      ref: (n.attrs?.ref ?? "").trim(),
      relationships: related.get(n.id) ?? 0,
      hints: hintsOf.get(n.id) ?? 0,
    };
  });
}

export function relationshipRows(model: Model): RelationshipRow[] {
  const name = (id: string) => model.nodes.find((n) => n.id === id)?.name || "Untitled";
  return model.edges.map((e) => ({ id: e.id, from: name(e.from), type: e.type, to: name(e.to), plan: PLAN_LABEL[planOf(e)] }));
}

/**
 * One CSV cell: quoted when it holds a comma, quote or line break (quotes doubled). A cell that a
 * spreadsheet would read as a formula (=, +, -, @, tab, carriage return first) is kept as text with
 * a leading apostrophe, so a name from someone else's model can't run as one.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A CSV file: a byte order mark (so spreadsheets read UTF-8), a header, CRLF line ends. */
export function toCsv(header: string[], rows: string[][]): string {
  return `﻿${[header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export const ELEMENT_COLUMNS: { key: keyof ElementRow; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "cls", label: "Class" },
  { key: "layer", label: "Layer" },
  { key: "lifecycle", label: "Life cycle stage" },
  { key: "environment", label: "Environment" },
  { key: "owner", label: "Owner" },
  { key: "plan", label: "Plan status" },
  { key: "ref", label: "Record number" },
  { key: "relationships", label: "Relationships" },
  { key: "hints", label: "Hints" },
];

export const elementsCsv = (rows: ElementRow[]) => toCsv(ELEMENT_COLUMNS.map((c) => c.label), rows.map((r) => ELEMENT_COLUMNS.map((c) => String(r[c.key]))));
export const relationshipsCsv = (rows: RelationshipRow[]) => toCsv(["From", "Relationship", "To", "Plan status"], rows.map((r) => [r.from, r.type, r.to, r.plan]));
