/**
 * Model health report (M64): a one-page summary of how complete and how CSDM-conformant a model
 * is, for a governance review. Pure: the same model always gives the same report. Printed (or
 * saved as a PDF) from the Export menu.
 */
import { classById, lifecycleFor, type Layer } from "@/metamodel";
import { evaluateHints } from "./hints";
import type { Model } from "./schema";

const LAYER_ORDER: { id: Layer; name: string }[] = [
  { id: "business", name: "Business" },
  { id: "design", name: "Design" },
  { id: "service", name: "Service" },
  { id: "functional", name: "Functional" },
  { id: "infrastructure", name: "Infrastructure" },
];

export type HealthReport = {
  elements: number;
  relationships: number;
  /** Every CSDM layer, with how many elements it has (0: the model doesn't reach it). */
  layers: { id: Layer; name: string; count: number }[];
  warnings: number;
  infos: number;
  /** The hints, one row per kind: warnings first, in the hint catalog's order. */
  hints: { title: string; severity: "warning" | "info"; count: number; elements: string[] }[];
  /** Elements with no relationship at all, by name. */
  unconnected: string[];
  /** How many elements have each detail set, of those that can have it. */
  details: { label: string; set: number; of: number }[];
};

export function healthReport(model: Model): HealthReport {
  const name = (id: string) => model.nodes.find((n) => n.id === id)?.name || "Untitled";
  const results = evaluateHints(model);
  const hints: HealthReport["hints"] = [];
  for (const r of results) {
    let row = hints.find((h) => h.title === r.hint.title);
    if (!row) hints.push((row = { title: r.hint.title, severity: r.hint.severity, count: 0, elements: [] }));
    row.count++;
    for (const id of r.nodeIds) if (!row.elements.includes(name(id))) row.elements.push(name(id));
  }
  const connected = new Set(model.edges.flatMap((e) => [e.from, e.to]));
  const has = (key: "owner" | "environment" | "lifecycle" | "description") => (n: Model["nodes"][number]) => !!n.attrs?.[key]?.trim();
  const withLifecycle = model.nodes.filter((n) => lifecycleFor(n.class));
  return {
    elements: model.nodes.length,
    relationships: model.edges.length,
    layers: LAYER_ORDER.map((l) => ({ ...l, count: model.nodes.filter((n) => classById(n.class)?.layer === l.id).length })),
    warnings: results.filter((r) => r.hint.severity === "warning").length,
    infos: results.filter((r) => r.hint.severity === "info").length,
    hints,
    unconnected: model.nodes.filter((n) => !connected.has(n.id)).map((n) => n.name || "Untitled"),
    details: [
      { label: "Description", set: model.nodes.filter(has("description")).length, of: model.nodes.length },
      { label: "Life cycle stage", set: withLifecycle.filter(has("lifecycle")).length, of: withLifecycle.length },
      { label: "Environment", set: model.nodes.filter(has("environment")).length, of: model.nodes.length },
      { label: "Owner", set: model.nodes.filter(has("owner")).length, of: model.nodes.length },
    ],
  };
}
