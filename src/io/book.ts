/**
 * The model book (M76): one printable document for a design or governance review, printed or saved
 * as a PDF through the browser: the title block and contents, the picture, the model by layer, the
 * elements and relationships tables, the saved flows with their steps, the decisions (M78) and the health summary. Built
 * as DOM nodes with text content only (the picture is our own SVG, parsed as SVG), as the health
 * report is.
 */
import { classById } from "@/metamodel";
import { DECISION_STATUS_LABEL, decisionLinks, flowRadius, flowStepText, formatModelDate, healthReport, modelDate, UNTITLED_MODEL, type Model } from "@/model";
import { outlineModel } from "@/editor/reading";
import { elementRows, ELEMENT_COLUMNS, relationshipRows, type ElementRow } from "./table";
import { el, healthSections, table } from "./report";
import { relationshipWord } from "./svg";

export const BOOK_SECTIONS = ["Picture", "The model by layer", "Elements", "Relationships", "Saved flows", "Decisions", "Health"] as const;

/** M81: the contents, each section with what it holds (counts only where a section lists something). */
export function bookContents(model: Model): string[] {
  const count = (n: number) => (n ? `(${n})` : "(none)");
  const layers = model.nodes.length ? outlineModel(model, "csdm").length : 0;
  return [
    "Picture",
    layers ? `The model by layer (${layers} layer${layers === 1 ? "" : "s"})` : "The model by layer",
    `Elements ${count(model.nodes.length)}`,
    `Relationships ${count(model.edges.length)}`,
    `Saved flows ${count(model.flows?.length ?? 0)}`,
    `Decisions ${count(model.decisions?.length ?? 0)}`,
    "Health",
  ];
}

/** M78: each decision, in the model's order: its title; status, date and the elements it concerns (by name); and its text, part by part. */
export function bookDecisions(model: Model): { title: string; meta: string; parts: [string, string][] }[] {
  const nameOf = (id: string) => model.nodes.find((n) => n.id === id)?.name || "Untitled";
  return (model.decisions ?? []).map((d) => {
    const about = (d.elements ?? []).map(nameOf).sort((a, b) => a.localeCompare(b));
    const meta = [DECISION_STATUS_LABEL[d.status], d.date ? formatModelDate(d.date) : "", ...decisionLinks(model, d), about.length ? `Concerns ${about.join(", ")}` : ""].filter(Boolean).join(" · ");
    const parts = ([["Context", d.context], ["Decision", d.decision], ["Consequences", d.consequences]] as const).filter(([, t]) => t).map(([k, t]): [string, string] => [k, t!]);
    return { title: d.title, meta, parts };
  });
}

/** Each saved flow, in the model's order: its name, where it starts and each step in words. */
export function bookFlows(model: Model): { name: string; start: string; steps: string[] }[] {
  const nameOf = (id: string) => model.nodes.find((n) => n.id === id)?.name || "Untitled";
  return (model.flows ?? []).map((f) => {
    const r = flowRadius(model, f);
    return { name: f.name || "Untitled flow", start: r.steps.length ? nameOf(r.start) : "", steps: f.steps.slice(0, Math.max(0, r.steps.length - 1)).map((s) => flowStepText(model, s)) };
  });
}

const LAYER_RANK: Record<string, number> = { business: 0, design: 1, service: 2, functional: 3, infrastructure: 4 };
/**
 * The elements table's rows and columns for the book: by layer then name, as the model by layer
 * lists them; a column no element fills (other than the name, class and layer) is left out.
 */
export function bookElements(model: Model, whole: Model = model): { columns: { key: keyof ElementRow; label: string }[]; rows: ElementRow[] } {
  const layerOf = new Map(model.nodes.map((n) => [n.id, LAYER_RANK[classById(n.class)?.layer ?? ""] ?? 9]));
  // M81: a part's rows come from the whole model, so relationships and hints count every one an element has.
  const rows = elementRows(whole).filter((r) => layerOf.has(r.id)).sort((a, b) => layerOf.get(a.id)! - layerOf.get(b.id)! || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const always = new Set<keyof ElementRow>(["name", "cls", "layer", "relationships", "hints"]);
  const empty = (k: keyof ElementRow) => rows.every((r) => r[k] === "" || (k === "plan" && r[k] === "Live"));
  return { columns: ELEMENT_COLUMNS.filter((c) => always.has(c.key) || !empty(c.key)), rows };
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * The book's sheet: `svg` is the picture as the editor draws it (light theme); `shown` says what it
 * shows; `today` is the printing day. M81: with `whole`, `model` is the part shown (see modelPart):
 * the cover says so, the elements table counts every relationship and hint an element has, and the
 * health summary is the whole model's, said so.
 */
export function bookSheet(model: Model, svg: string, today: string, shown = "", whole?: Model): HTMLElement {
  const section = (title: (typeof BOOK_SECTIONS)[number], ...children: (Node | string)[]) => el("section", { class: `bm-book-section${title === "Picture" ? " bm-book-picture-page" : ""}` }, el("h2", {}, title), ...children);
  const none = () => el("p", {}, "No elements yet.");
  const flows = bookFlows(model);
  const decisions = bookDecisions(model);
  const els = bookElements(model, whole ?? model);
  const empty = model.nodes.length === 0;
  const picture = empty ? none() : el("div", { class: "bm-book-picture" }, document.importNode(new DOMParser().parseFromString(svg, "image/svg+xml").documentElement, true));
  return el(
    "article",
    { class: "bm-report bm-book" },
    el("p", { class: "bm-report-kicker" }, "Blueprint Modeler · Model book"),
    el("h1", {}, model.name || UNTITLED_MODEL),
    el("p", {}, [model.artifactId ? `Artifact ID ${model.artifactId}` : "", `Model date ${formatModelDate(modelDate(model))}`, `Printed ${formatModelDate(today)}`].filter(Boolean).join(" · ")),
    ...(model.description ? [el("p", { class: "bm-book-description" }, model.description)] : []),
    el("p", {}, `${plural(model.nodes.length, "element")}, ${plural(model.edges.length, "relationship")}, ${flows.length ? plural(flows.length, "saved flow") : "no saved flows"}.`),
    // M81: a part says so on the cover, before anything else is read.
    ...(whole && shown ? [el("p", { class: "bm-book-part" }, shown)] : []),
    el("h2", { class: "bm-book-contents-title" }, "Contents"),
    el("ol", { class: "bm-book-contents" }, ...bookContents(model).map((c) => el("li", {}, c))),
    section("Picture", ...(!whole && shown && !empty ? [el("p", {}, shown)] : []), picture),
    section(
      "The model by layer",
      ...(empty
        ? [none()]
        : outlineModel(model, "csdm").flatMap((l) => [el("h3", {}, `${l.name} (${l.items.length})`), el("ul", {}, ...l.items.map((it) => el("li", {}, `${it.name} (${it.kind})`)))])),
    ),
    section(
      "Elements",
      empty
        ? none()
        : table(
            "Every element, by layer",
            els.columns.map((c) => c.label),
            els.rows.map((r) => els.columns.map((c) => String(r[c.key]))),
            { class: "bm-book-wide" },
          ),
    ),
    section(
      "Relationships",
      model.edges.length
        ? table(
            "Every relationship",
            ["From", "Relationship", "To", "Plan status"],
            relationshipRows(model).map((r) => [r.from, relationshipWord(r.type), r.to, r.plan]),
            { class: "bm-book-wide" },
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
    section(
      "Decisions",
      ...(decisions.length
        ? decisions.flatMap((d) => [el("h3", {}, d.title), el("p", {}, d.meta), ...d.parts.flatMap(([k, t]) => [el("h4", {}, k), el("p", { class: "bm-book-text" }, t)])])
        : [el("p", {}, "No decisions. Model menu › Decisions… records what was decided, why, and the elements it concerns.")]),
    ),
    section("Health", ...(whole ? [el("p", {}, "For the whole model, so relationships to elements left out still count.")] : []), ...healthSections(healthReport(whole ?? model), "h3")),
    el("p", { class: "bm-report-foot" }, "Made with Blueprint Modeler (model.mikereams.com). The hints are the modeler's own checks, written from ServiceNow's public CSDM material. Not affiliated with ServiceNow."),
  );
}
