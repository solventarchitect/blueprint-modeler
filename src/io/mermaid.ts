/**
 * The model as a Mermaid flowchart (M82): text that GitHub, GitLab, Confluence and Notion draw in
 * Markdown, so a model can live next to the docs it explains. One subgraph per CSDM layer, top
 * down; each element labeled with its name and class; each relationship with its forward word.
 * Planned and Retiring are said in words and drawn dashed. No library, no network. Pure.
 */
import { classById, type Layer } from "@/metamodel";
import { LAYERS } from "@/layout/bands";
import { PLAN_LABEL, UNTITLED_MODEL, type Model } from "@/model";
import { relationshipWord } from "./svg";

/**
 * Text for inside a quoted Mermaid label: the characters that could end the label or start markup
 * as entity codes, line breaks as spaces. `%` too, since `%%{…}%%` anywhere is a directive.
 */
export const mermaidLabel = (s: string) =>
  s
    .replace(/#/g, "#35;")
    .replace(/"/g, "#quot;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;")
    .replace(/%/g, "#37;")
    // A label opening with a backtick is a Markdown string to Mermaid; any backtick is kept as text.
    .replace(/`/g, "#96;")
    .replace(/[\r\n]+/g, " ");

/** Text for a `%%` comment line: one line, no directive. */
const comment = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/%/g, "％");

/** Light layer fills and strokes, as the draw.io export uses (literal hex, for any Markdown page). */
const LAYER_STYLE: Record<Layer, string> = {
  business: "fill:#f7eedc,stroke:#6d4e17,color:#121e2b",
  design: "fill:#e0eff7,stroke:#005785,color:#121e2b",
  service: "fill:#e9e5ff,stroke:#2000d6,color:#121e2b",
  functional: "fill:#e8eef5,stroke:#406996,color:#121e2b",
  infrastructure: "fill:#eceff3,stroke:#34557a,color:#121e2b",
};

/** `note`: what part of the model this is (M81's "what's shown"), said in a second comment line. */
export function modelToMermaid(model: Model, note = ""): string {
  const id = new Map(model.nodes.map((n, i) => [n.id, `n${i}`]));
  const out = [`%% ${comment(model.name || UNTITLED_MODEL)} · Blueprint Modeler (model.mikereams.com)`, ...(note ? [`%% ${comment(note)}`] : []), "flowchart TB"];
  const used = new Set<Layer>();
  for (const layer of LAYERS) {
    const nodes = model.nodes.filter((n) => classById(n.class)?.layer === layer.id);
    if (!nodes.length) continue;
    used.add(layer.id);
    out.push(`  subgraph ${layer.id}["${mermaidLabel(layer.name)}"]`, "    direction TB");
    for (const n of nodes) {
      const cls = classById(n.class)?.label ?? n.class;
      out.push(`    ${id.get(n.id)}["${mermaidLabel(n.name || "Untitled")}<br/>${mermaidLabel(cls)}${n.plan ? ` · ${PLAN_LABEL[n.plan]}` : ""}"]`);
    }
    out.push("  end");
  }
  // Elements of a class this version doesn't place in a layer: outside the subgraphs.
  for (const n of model.nodes.filter((x) => !classById(x.class))) out.push(`  ${id.get(n.id)}["${mermaidLabel(n.name || "Untitled")}<br/>${mermaidLabel(n.class)}"]`);
  for (const e of model.edges) {
    const from = id.get(e.from);
    const to = id.get(e.to);
    if (!from || !to) continue;
    // A type with no forward word (such as "::Used by", which an imported file can hold) takes the whole type.
    const word = relationshipWord(e.type).trim() || e.type.replace(/::/g, " ").trim() || "related";
    const label = `${mermaidLabel(word)}${e.plan ? ` (${PLAN_LABEL[e.plan].toLowerCase()})` : ""}`;
    out.push(`  ${from} ${e.plan ? "-.->" : "-->"}|"${label}"| ${to}`);
  }
  for (const layer of LAYERS) if (used.has(layer.id)) out.push(`  classDef ${layer.id}Layer ${LAYER_STYLE[layer.id]}`);
  for (const layer of LAYERS) {
    const ids = model.nodes.filter((n) => classById(n.class)?.layer === layer.id).map((n) => id.get(n.id));
    if (ids.length) out.push(`  class ${ids.join(",")} ${layer.id}Layer`);
  }
  const marked = model.nodes.filter((n) => n.plan).map((n) => id.get(n.id));
  if (marked.length) out.push("  classDef planned stroke-dasharray:5 4", `  class ${marked.join(",")} planned`);
  return `${out.join("\n")}\n`;
}
