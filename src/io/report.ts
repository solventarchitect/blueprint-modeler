/**
 * The model health report's printed page (M64), built as DOM nodes with text content only (names
 * come from the model, so nothing is ever parsed as HTML).
 */
import { formatModelDate, modelDate, UNTITLED_MODEL, type HealthReport, type Model } from "@/model";

type Child = Node | string;
function el(tag: string, attrs: Record<string, string> = {}, ...children: Child[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const pct = (set: number, of: number) => (of ? `${Math.round((set / of) * 100)}%` : "—");
/** At most this many names in a cell; the rest are counted. */
const MAX_NAMES = 12;
const names = (list: string[]) => (list.length > MAX_NAMES ? `${list.slice(0, MAX_NAMES).join(", ")} and ${list.length - MAX_NAMES} more` : list.join(", "));

/** "a", "a and b", "a, b and c". */
const listed = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** The summary sentence, also used for the editor's announcement. */
export function reportSummary(r: HealthReport): string {
  const missing = r.layers.filter((l) => !l.count).map((l) => l.name);
  return [
    `${plural(r.elements, "element")} and ${plural(r.relationships, "relationship")}.`,
    `${plural(r.warnings, "warning")} and ${plural(r.infos, "note")}.`,
    missing.length ? `No elements in the ${listed(missing)} ${missing.length === 1 ? "layer" : "layers"}.` : "Every CSDM layer has elements.",
  ].join(" ");
}

export function reportSheet(model: Model, r: HealthReport, today: string): HTMLElement {
  const table = (caption: string, head: string[], rows: Child[][]) =>
    el("table", {}, el("caption", {}, caption), el("thead", {}, el("tr", {}, ...head.map((h) => el("th", { scope: "col" }, h)))), el("tbody", {}, ...rows.map((row) => el("tr", {}, ...row.map((c) => el("td", {}, c))))));
  return el(
    "article",
    { class: "bm-report" },
    el("p", { class: "bm-report-kicker" }, "Blueprint Modeler · Model health report"),
    el("h1", {}, model.name || UNTITLED_MODEL),
    el("p", {}, `Model date ${formatModelDate(modelDate(model))} · Report printed ${formatModelDate(today)}`),
    el("p", { class: "bm-report-summary" }, reportSummary(r)),
    table(
      "Elements by CSDM layer",
      ["Layer", "Elements"],
      r.layers.map((l) => [l.name, l.count ? String(l.count) : "None"]),
    ),
    r.hints.length
      ? table(
          "Hints",
          ["Severity", "Hint", "Times", "Elements"],
          r.hints.map((h) => [h.severity === "warning" ? "Warning" : "Note", h.title, String(h.count), names(h.elements)]),
        )
      : el("p", {}, "No hints: nothing in this model goes against the CSDM checks the modeler makes."),
    table(
      "Details filled in",
      ["Detail", "Set", "Of", "Share"],
      r.details.map((d) => [d.label, String(d.set), String(d.of), pct(d.set, d.of)]),
    ),
    el("p", {}, "Life cycle stage counts only elements whose class has a CSDM life cycle."),
    el("h2", {}, "Elements without relationships"),
    el("p", {}, r.unconnected.length ? names(r.unconnected) : "None: every element is related to another."),
    el("p", { class: "bm-report-foot" }, "The hints are the modeler's own checks, written from ServiceNow's public CSDM material; see the class guide at model.mikereams.com/guide. Not affiliated with ServiceNow."),
  );
}
