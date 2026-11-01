/**
 * The model book (M76): one printable document for a design or governance review, printed or saved
 * as a PDF through the browser: the title block, the picture, the model by layer, the elements and
 * relationships tables, the saved flows with their steps, and the health summary. Built as DOM nodes
 * with text content only (the picture is our own SVG, parsed as SVG), as the health report is.
 */
import { flowRadius, flowStepText, formatModelDate, healthReport, modelDate, UNTITLED_MODEL, type Model } from "@/model";
import { outlineModel } from "@/editor/reading";
import { elementRows, ELEMENT_COLUMNS, relationshipRows } from "./table";
import { el, healthSections, table } from "./report";

export const BOOK_SECTIONS = ["Picture", "The model by layer", "Elements", "Relationships", "Saved flows", "Health"] as const;

/** Each saved flow, in the model's order: its name, where it starts and each step in words. */
export function bookFlows(model: Model): { name: string; start: string; steps: string[] }[] {
  const nameOf = (id: string) => model.nodes.find((n) => n.id === id)?.name || "Untitled";
  return (model.flows ?? []).map((f) => {
    const r = flowRadius(model, f);
    return { name: f.name, start: r.steps.length ? nameOf(r.start) : "", steps: f.steps.slice(0, Math.max(0, r.steps.length - 1)).map((s) => flowStepText(model, s)) };
  });
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The book's sheet: `svg` is the picture as the editor draws it (light theme), `today` the printing day. */
export function bookSheet(model: Model, svg: string, today: string): HTMLElement {
  const picture = document.importNode(new DOMParser().parseFromString(svg, "image/svg+xml").documentElement, true);
  const section = (title: (typeof BOOK_SECTIONS)[number], ...children: (Node | string)[]) => el("section", { class: "bm-book-section" }, el("h2", {}, title), ...children);
  const flows = bookFlows(model);
  return el(
    "article",
    { class: "bm-report bm-book" },
    el("p", { class: "bm-report-kicker" }, "Blueprint Modeler · Model book"),
    el("h1", {}, model.name || UNTITLED_MODEL),
    el("p", {}, [model.artifactId ? `Artifact ID ${model.artifactId}` : "", `Model date ${formatModelDate(modelDate(model))}`, `Printed ${formatModelDate(today)}`].filter(Boolean).join(" · ")),
    ...(model.description ? [el("p", {}, model.description)] : []),
    el("p", {}, `${plural(model.nodes.length, "element")}, ${plural(model.edges.length, "relationship")}, ${plural(flows.length, "saved flow")}.`),
    section("Picture", el("div", { class: "bm-book-picture" }, picture)),
    section(
      "The model by layer",
      ...outlineModel(model, "csdm").flatMap((l) => [
        el("h3", {}, `${l.name} (${l.items.length})`),
        el("ul", {}, ...l.items.map((it) => el("li", {}, `${it.name} (${it.kind})${it.details.length ? ` · ${it.details.join(" · ")}` : ""}`))),
      ]),
    ),
    section(
      "Elements",
      table(
        "Every element",
        ELEMENT_COLUMNS.map((c) => c.label),
        elementRows(model).map((r) => ELEMENT_COLUMNS.map((c) => String(r[c.key]))),
      ),
    ),
    section(
      "Relationships",
      model.edges.length
        ? table(
            "Every relationship",
            ["From", "Relationship", "To", "Plan status"],
            relationshipRows(model).map((r) => [r.from, r.type.split("::")[0] ?? r.type, r.to, r.plan]),
          )
        : el("p", {}, "No relationships yet."),
    ),
    section(
      "Saved flows",
      ...(flows.length
        ? flows.flatMap((f) => [
            el("h3", {}, f.name),
            f.steps.length ? el("p", {}, `Starts at ${f.start}.`) : el("p", {}, "No steps yet."),
            ...(f.steps.length ? [el("ol", {}, ...f.steps.map((s) => el("li", {}, s)))] : []),
          ])
        : [el("p", {}, "No saved flows. Model menu › Saved flows… walks a use case through the model, one relationship at a time.")]),
    ),
    section("Health", ...healthSections(healthReport(model))),
    el("p", { class: "bm-report-foot" }, "Made with Blueprint Modeler (model.mikereams.com). The hints are the modeler's own checks, written from ServiceNow's public CSDM material. Not affiliated with ServiceNow."),
  );
}
