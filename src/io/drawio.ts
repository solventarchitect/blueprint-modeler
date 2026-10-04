import { archimateElements, type Lens, showsArchimate } from "@/frameworks";
import { classById, isClassId, type Layer } from "@/metamodel";
import { UNTITLED_MODEL, type Model } from "@/model";
import { layoutOrientation } from "@/layout/bands";
import { edgeSides } from "@/layout/geometry";

/**
 * The model as a draw.io file (.drawio, mxGraph XML). `modelToDrawio` returns the readable,
 * uncompressed form; `modelToDrawioFile` compresses the diagram the way draw.io does, which is
 * what Lucidchart's importer requires (it rejects uncompressed files as "not a valid Draw.io XML
 * file" — verified 2026-09-27). Each element carries its CSDM class, ServiceNow table and layer as
 * draw.io properties; draw.io keeps them, Lucid's importer drops them. No library, no network.
 */

const W = 224;
const H = 72;

/** Light theme, literal hex (Blueprint tokens): imported diagrams usually land on white pages. */
const ink = "#121e2b";
const line = "#34557a";
const layerFill: Record<Layer, string> = {
  business: "#f7eedc",
  design: "#e0eff7",
  service: "#e9e5ff",
  functional: "#e8eef5",
  infrastructure: "#eceff3",
};
const layerStroke: Record<Layer, string> = {
  business: "#6d4e17",
  design: "#005785",
  service: "#2000d6",
  functional: "#406996",
  infrastructure: "#34557a",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "&#10;");

/** XML-safe, unique cell ids: draw.io reserves "0" and "1". */
function idMaker() {
  const used = new Set(["0", "1"]);
  return (raw: string) => {
    const base = `c-${raw.replace(/[^A-Za-z0-9_.-]/g, "_")}`;
    let id = base;
    for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
    used.add(id);
    return id;
  };
}

const side = { top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5] } as const;

export function modelToDrawio(model: Model, opts: { lens?: Lens; now?: Date } = {}): string {
  const lens = opts.lens ?? "csdm";
  const makeId = idMaker();
  const cellId = new Map<string, string>();
  const box = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const n of model.nodes) {
    cellId.set(n.id, makeId(n.id));
    const p = model.layout[n.id] ?? { x: 0, y: 0 };
    box.set(n.id, { x: Math.round(p.x), y: Math.round(p.y), w: W, h: H });
  }
  const columns = layoutOrientation(model, Object.fromEntries([...box].map(([id, b]) => [id, { width: b.w, height: b.h }]))) === "columns";

  const cells: string[] = [];
  for (const n of model.nodes) {
    const def = classById(n.class);
    const layer: Layer = def?.layer ?? "design";
    const classLabel = def?.label ?? n.class;
    const alt = showsArchimate(lens) && isClassId(n.class) ? archimateElements[n.class].label : undefined;
    const label = `${n.name || "Untitled"}\n${classLabel}${alt ? `\nArchiMate · ${alt}` : ""}`;
    const b = box.get(n.id)!;
    const style = [
      "rounded=0",
      "whiteSpace=wrap",
      "html=0",
      `fillColor=${layerFill[layer]}`,
      `strokeColor=${layerStroke[layer]}`,
      `fontColor=${ink}`,
      "fontSize=12",
      "align=left",
      "spacingLeft=10",
      "verticalAlign=middle",
    ].join(";");
    const props = [
      `label="${esc(label)}"`,
      `csdm_class="${esc(classLabel)}"`,
      def?.table ? `ci_class="${esc(def.table)}"` : "",
      `layer="${layer}"`,
      alt ? `archimate_element="${esc(alt)}"` : "",
      `blueprint_id="${esc(n.id)}"`,
    ]
      .filter(Boolean)
      .join(" ");
    cells.push(
      `<object ${props} id="${cellId.get(n.id)}"><mxCell style="${style};" vertex="1" parent="1"><mxGeometry x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" as="geometry"/></mxCell></object>`,
    );
  }

  for (const e of model.edges) {
    const a = box.get(e.from);
    const b = box.get(e.to);
    if (!a || !b) continue;
    const [ss, ts] = edgeSides(a, b, columns);
    const label = e.type.startsWith("reference:") ? "reference" : (e.type.split("::")[0] ?? e.type);
    const style = [
      "edgeStyle=orthogonalEdgeStyle",
      "rounded=0",
      "html=0",
      "endArrow=block",
      "endFill=1",
      `strokeColor=${line}`,
      `fontColor=${line}`,
      "fontSize=11",
      "labelBackgroundColor=#ffffff",
      `exitX=${side[ss][0]}`,
      `exitY=${side[ss][1]}`,
      `entryX=${side[ts][0]}`,
      `entryY=${side[ts][1]}`,
    ].join(";");
    cells.push(
      `<object label="${esc(label)}" relationship_type="${esc(e.type)}" id="${makeId(`e-${e.id}`)}"><mxCell style="${style};" edge="1" parent="1" source="${cellId.get(e.from)}" target="${cellId.get(e.to)}"><mxGeometry relative="1" as="geometry"/></mxCell></object>`,
    );
  }

  const modified = (opts.now ?? new Date(model.updated)).toISOString();
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<mxfile host="Blueprint Modeler" modified="${modified}" agent="Blueprint Modeler (model.mikereams.com)" version="24.0.0" type="device">`,
    `<diagram id="${esc(makeId("page"))}" name="${esc(model.name || UNTITLED_MODEL)}">`,
    `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="8" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" math="0" shadow="0">`,
    `<root>`,
    `<mxCell id="0"/>`,
    `<mxCell id="1" parent="0"/>`,
    ...cells,
    `</root>`,
    `</mxGraphModel>`,
    `</diagram>`,
    `</mxfile>`,
    "",
  ].join("\n");
}

/** draw.io's diagram compression: encodeURIComponent → raw deflate → base64. */
export async function compressDiagram(xml: string): Promise<string> {
  const stream = new Blob([encodeURIComponent(xml)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Inverse of `compressDiagram` (tests and round-trip checks). */
export async function decompressDiagram(b64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return decodeURIComponent(await new Response(stream).text());
}

/** The file to download: same document with the diagram compressed (Lucid-importable). */
export async function modelToDrawioFile(model: Model, opts: { lens?: Lens; now?: Date } = {}): Promise<string> {
  const xml = modelToDrawio(model, opts);
  const start = xml.indexOf("<mxGraphModel");
  const end = xml.indexOf("</mxGraphModel>") + "</mxGraphModel>".length;
  const packed = await compressDiagram(xml.slice(start, end));
  return `${xml.slice(0, start).replace(/\n$/, "")}${packed}${xml.slice(end).replace(/^\n/, "")}`;
}
