import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { modelToArchimateXml } from "./archimate";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const attrs = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag} ([^>]*)>`, "g"))].map((m) => Object.fromEntries([...m[1]!.matchAll(/([\w:]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));

describe("ArchiMate exchange export", () => {
  it("writes one element per node with its mapped type, and one relationship per edge", () => {
    const m = checkout();
    const xml = modelToArchimateXml(m);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"')).toBe(true);
    const els = attrs(xml, "element");
    expect(els).toHaveLength(m.nodes.length);
    expect(els.find((e) => e.identifier === "el-ba")!["xsi:type"]).toBe("ApplicationComponent");
    expect(els.find((e) => e.identifier === "el-cap")!["xsi:type"]).toBe("Capability");
    expect(attrs(xml, "relationship")).toHaveLength(m.edges.length);
    expect(attrs(xml, "node")).toHaveLength(m.nodes.length);
    expect(attrs(xml, "connection")).toHaveLength(m.edges.length);
  });

  it("follows the lens direction: CSDM 'depends on' becomes ArchiMate 'serving' from the dependency", () => {
    const xml = modelToArchimateXml(checkout());
    const rels = attrs(xml, "relationship");
    // checkout: prod (application service) → web (application): the system software serves the instance.
    expect(rels.some((r) => r.source === "el-web" && r.target === "el-prod" && r["xsi:type"] === "Serving")).toBe(true);
    // ba → cap: the application realizes the capability, same direction.
    expect(rels.some((r) => r.source === "el-ba" && r.target === "el-cap" && r["xsi:type"] === "Realization")).toBe(true);
  });

  it("uses unique NCName identifiers, non-negative positions and escaped names, and falls back to Association", () => {
    const m = checkout();
    m.nodes[0] = { ...m.nodes[0]!, id: "a b", name: `Orders & <"returns">` };
    m.nodes.push({ id: "a_b", class: "host", name: "clash" });
    m.layout = { ...m.layout, "a b": { x: -300, y: -40 }, a_b: { x: 10, y: 10 } };
    m.edges = m.edges.map((e) => (e.to === "cap" ? { ...e, to: "a b" } : e));
    m.edges.push({ id: "odd", from: "h1", to: "ba", type: "Odd::Type" });
    const xml = modelToArchimateXml(m);
    const ids = [...xml.matchAll(/identifier="([^"]+)"/g)].map((x) => x[1]!);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z_][A-Za-z0-9_.-]*$/);
    for (const n of attrs(xml, "node")) {
      expect(Number(n.x)).toBeGreaterThanOrEqual(0);
      expect(Number(n.y)).toBeGreaterThanOrEqual(0);
    }
    expect(xml).toContain("Orders &amp; &lt;&quot;returns&quot;&gt;");
    expect(attrs(xml, "relationship").find((r) => r.identifier === "rel-odd")!["xsi:type"]).toBe("Association");
  });

  it("keeps the CSDM class and relationship type as properties, and an empty model stays valid", () => {
    const xml = modelToArchimateXml(checkout());
    expect(xml).toContain('<property propertyDefinitionRef="pd-csdm-class"><value xml:lang="en">Business Application</value></property>');
    expect(xml).toContain('<property propertyDefinitionRef="pd-csdm-type"><value xml:lang="en">Uses::Used by</value></property>');
    const empty = modelToArchimateXml({ ...checkout(), nodes: [], edges: [], layout: {} });
    expect(empty).not.toContain("<elements>");
    expect(empty).not.toContain("<relationships>");
  });
});
