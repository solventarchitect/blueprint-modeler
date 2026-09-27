import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { modelToDrawio } from "./drawio";
import { LUCID_FREE, lucidFit, lucidFitMessage, lucidFitNote } from "./lucid";

const at = new Date("2026-09-27T00:00:00Z");
const checkout = () => examples.find((e) => e.id === "checkout")!.create(at, "m1");
const objects = (xml: string) =>
  [...xml.matchAll(/<object ([^>]*)>/g)].map((m) => Object.fromEntries([...m[1]!.matchAll(/([\w:]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));

describe("draw.io export", () => {
  it("writes an uncompressed mxfile with the two root cells, one vertex per element and one edge per relationship", () => {
    const m = checkout();
    const xml = modelToDrawio(m, { now: at });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<mxfile ')).toBe(true);
    expect(xml).toContain('<mxCell id="0"/>\n<mxCell id="1" parent="0"/>');
    expect(xml.match(/vertex="1"/g)).toHaveLength(m.nodes.length);
    expect(xml.match(/edge="1"/g)).toHaveLength(m.edges.length);
  });

  it("binds every edge to existing vertex ids and keeps the CSDM data as properties", () => {
    const xml = modelToDrawio(checkout(), { now: at });
    const objs = objects(xml);
    const ids = new Set(objs.map((o) => o.id));
    expect(ids.size).toBe(objs.length);
    for (const m of xml.matchAll(/source="([^"]+)" target="([^"]+)"/g)) {
      expect(ids.has(m[1]!)).toBe(true);
      expect(ids.has(m[2]!)).toBe(true);
    }
    const ba = objs.find((o) => o.blueprint_id === "ba")!;
    expect(ba.csdm_class).toBe("Business Application");
    expect(ba.ci_class).toBe("cmdb_ci_business_app");
    expect(ba.label).toBe("Checkout&#10;Business Application");
    expect(objs.some((o) => o.relationship_type === "Uses::Used by" && o.label === "Uses")).toBe(true);
  });

  it("escapes names, makes clashing ids unique, and adds the ArchiMate name under the lens", () => {
    const m = checkout();
    m.nodes[0] = { ...m.nodes[0]!, id: "a b", name: `Orders & <"returns">` };
    m.nodes.push({ id: "a_b", class: "host", name: "clash" });
    m.layout = { ...m.layout, "a b": { x: 0, y: 0 }, a_b: { x: 10, y: 10 } };
    m.edges = m.edges.filter((e) => e.from !== m.nodes[0]!.id && e.to !== m.nodes[0]!.id);
    const xml = modelToDrawio(m, { lens: "archimate", now: at });
    const ids = objects(xml).map((o) => o.id!);
    expect(new Set(ids).size).toBe(ids.length);
    expect(xml).toContain("Orders &amp; &lt;&quot;returns&quot;&gt;");
    expect(objects(xml).find((o) => o.blueprint_id === "ba")!.archimate_element).toBe("Application Component");
  });

  it("is deterministic for the same model", () => {
    expect(modelToDrawio(checkout(), { now: at })).toBe(modelToDrawio(checkout(), { now: at }));
  });

  it("exports every example", () => {
    for (const ex of examples) {
      const m = ex.create(at, ex.id);
      expect(modelToDrawio(m, { now: at }).match(/vertex="1"/g) ?? []).toHaveLength(m.nodes.length);
    }
  });
});

describe("Lucid fit", () => {
  it("counts one object per element and per relationship against the Free limit", () => {
    const m = checkout();
    const fit = lucidFit(m);
    expect(fit.objects).toBe(m.nodes.length + m.edges.length);
    expect(fit.limit).toBe(LUCID_FREE.objectLimit);
    expect(fit.fitsFree).toBe(fit.objects <= 60);
  });

  it("flags models over the limit, inclusive at the limit", () => {
    const nodes = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, class: "host", name: `h${i}` }));
    const edges = Array.from({ length: 30 }, (_, i) => ({ id: `e${i}`, from: "n0", to: `n${i}`, type: "x" }));
    expect(lucidFit({ nodes, edges }).fitsFree).toBe(true);
    const over = lucidFit({ nodes, edges: [...edges, { id: "e30", from: "n1", to: "n2", type: "x" }] });
    expect(over.fitsFree).toBe(false);
    expect(lucidFitNote(over)).toBe("61 Lucid objects · over Free's 60, needs a paid plan");
    expect(lucidFitMessage(over)).toContain("editing an imported diagram needs a paid Lucid plan");
  });

  it("cites public sources", () => {
    for (const url of Object.values(LUCID_FREE.sources)) expect(url).toMatch(/^https:\/\/(community|help)\.lucid\.co\//);
  });
});
