import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { archimateElements, archimateRelationshipFor } from "@/frameworks";
import { allowedTypes, classById, relationships, type ClassId, type RelDef } from "@/metamodel";
import { parseModel, type Model } from "@/model";
import { modelToArchimateXml } from "./archimate";
import { exchangeToModel, type Exchange, type ExchangeElement, type ExchangeRelationship } from "./archimateImport";

// M87: an ArchiMate exchange file read back into a CSDM model. The XML is read in the browser
// (readExchange, covered end to end); these tests cover what is made from what was read.
const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const opts = { id: "new", now: new Date("2026-11-07T12:00:00Z") };

/** What our own export writes, as readExchange gives it back: the class and type as properties, some relationships reversed. */
function asExported(m: Model): Exchange {
  const classOf = new Map(m.nodes.map((n) => [n.id, n.class]));
  return {
    name: m.name,
    documentation: "Exported from Blueprint Modeler (https://model.mikereams.com): CSDM classes mapped to ArchiMate 3.2 elements.",
    elements: m.nodes.map((n) => ({ id: `el-${n.id}`, type: archimateElements[n.class as ClassId].type, name: n.name, properties: { "CSDM class": classById(n.class)!.label } })),
    relationships: m.edges.map((e) => {
      const r = archimateRelationshipFor(classOf.get(e.from)!, classOf.get(e.to)!);
      const [a, b] = r?.reverse ? [e.to, e.from] : [e.from, e.to];
      return { id: `rel-${e.id}`, type: r?.type ?? "Association", source: `el-${a}`, target: `el-${b}`, properties: { "CSDM relationship type": e.type } };
    }),
    diagram: { name: m.name, nodes: m.nodes.map((n) => ({ elementRef: `el-${n.id}`, x: m.layout[n.id]!.x + 40, y: m.layout[n.id]!.y + 40, w: 224, h: 64 })) },
  };
}


const unescape = (t: string) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
/** Our exporter's real XML, read back with a reader for its own layout (the browser's parser isn't here). */
function readOurXml(xml: string): Exchange {
  const attr = (tag: string, a: string) => unescape(new RegExp(`${a}="([^"]*)"`).exec(tag)?.[1] ?? "");
  const value = (block: string) => unescape(/<value[^>]*>([^<]*)<\/value>/.exec(block)?.[1] ?? "");
  const elements = [...xml.matchAll(/<element ([^>]*)>\s*<name[^>]*>([^<]*)<\/name>\s*<properties>([\s\S]*?)<\/properties>/g)].map(([, tag, name, props]) => ({
    id: attr(tag!, "identifier"),
    type: attr(tag!, "xsi:type"),
    name: unescape(name!),
    properties: { "CSDM class": value(props!) },
  }));
  const relationships = [...xml.matchAll(/<relationship ([^>]*)>\s*<properties>([\s\S]*?)<\/properties>/g)].map(([, tag, props]) => ({
    id: attr(tag!, "identifier"),
    type: attr(tag!, "xsi:type"),
    source: attr(tag!, "source"),
    target: attr(tag!, "target"),
    properties: { "CSDM relationship type": value(props!) },
  }));
  const nodes = [...xml.matchAll(/<node ([^>]*)\/>/g)].map(([, tag]) => ({ elementRef: attr(tag!, "elementRef"), x: Number(attr(tag!, "x")), y: Number(attr(tag!, "y")), w: Number(attr(tag!, "w")), h: Number(attr(tag!, "h")) }));
  return { name: unescape(/<name[^>]*>([^<]*)<\/name>/.exec(xml)![1]!), elements, relationships, diagram: { name: "", nodes } };
}
const triple = (m: Model) => m.edges.map((e) => `${e.from} ${e.type} ${e.to}`).sort();

const el = (id: string, type: string, name: string, properties: Record<string, string> = {}): ExchangeElement => ({ id, type, name, properties });
const rel = (id: string, type: string, source: string, target: string, properties: Record<string, string> = {}): ExchangeRelationship => ({ id, type, source, target, properties });
const ok = (r: ReturnType<typeof exchangeToModel>) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe("ArchiMate exchange import (M87)", () => {
  it("our own export comes back as the same model: classes, names, relationships and the picture", () => {
    const m = checkout();
    const { model, notes } = ok(exchangeToModel(asExported(m), opts));
    expect(parseModel(model).ok).toBe(true);
    expect(model).toMatchObject({ id: "new", name: m.name, created: "2026-11-07T12:00:00.000Z", updated: "2026-11-07T12:00:00.000Z" });
    expect(model).not.toHaveProperty("description");
    // Our export's ids come back as they were (it prefixes them).
    expect(model.nodes.map((n) => [n.id, n.class, n.name])).toEqual(m.nodes.map((n) => [n.id, n.class, n.name]));
    expect(triple(model)).toEqual(triple(m));
    // Same picture, moved together by the export's margin.
    for (const n of m.nodes) expect(model.layout[n.id]).toEqual({ x: m.layout[n.id]!.x + 40, y: m.layout[n.id]!.y + 40 });
    expect(notes).toEqual([]);
  });

  it("every example, through the real exporter and back: same ids, classes, names and relationships, each way round", () => {
    for (const ex of examples) {
      const m = ex.create(new Date("2026-09-27T00:00:00Z"), "m1");
      const { model, notes } = ok(exchangeToModel(readOurXml(modelToArchimateXml(m)), opts));
      expect(model.nodes.map((n) => [n.id, n.class, n.name]), ex.id).toEqual(m.nodes.map((n) => [n.id, n.class, n.name]));
      expect(triple(model), ex.id).toEqual(triple(m));
      expect(model.edges.map((e) => e.id).sort(), ex.id).toEqual(m.edges.map((e) => e.id).sort());
      expect(notes, ex.id).toEqual([]);
    }
  });

  it("every relationship the metamodel defines, including older types and ones kept the other way, round-trips as written", () => {
    for (const def of relationships as readonly RelDef[]) {
      const types = [...def.types.map((t) => [def.from, def.to, t]), ...(def.legacyTypes ?? []).map((t) => [def.from, def.to, t]), ...(def.legacyReverse ?? []).map((t) => [def.to, def.from, t])];
      for (const [from, to, type] of types) {
        const m: Model = { ...checkout(), nodes: [{ id: "a", class: from!, name: "A" }, { id: "b", class: to!, name: "B" }], edges: [{ id: "e1", from: "a", to: "b", type: type! }], layout: { a: { x: 0, y: 0 }, b: { x: 300, y: 0 } } };
        const { model } = ok(exchangeToModel(readOurXml(modelToArchimateXml(m)), opts));
        expect(triple(model), `${from}>${to} ${type}`).toEqual(triple(m));
      }
    }
    // One that breaks the rules is kept as written too, for Hints to flag, as a model file keeps it.
    const odd: Model = { ...checkout(), nodes: [{ id: "a", class: "host", name: "A" }, { id: "b", class: "business_capability", name: "B" }], edges: [{ id: "e1", from: "a", to: "b", type: "Uses::Used by" }], layout: {} };
    expect(triple(ok(exchangeToModel(readOurXml(modelToArchimateXml(odd)), opts)).model)).toEqual(["a Uses::Used by b"]);
  });

  it("a type name a plain object already has (constructor) is just a type with no CSDM class", () => {
    const r = ok(exchangeToModel({ name: "x", elements: [el("a", "Node", "A"), el("b", "constructor", "B"), el("c", "toString", "")], relationships: [] }, opts));
    expect(r.model.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(r.notes).toContain("Not imported: 2 elements with no CSDM class here: Constructor “B”, To String.");
  });

  it("an identifier used twice: the first element keeps it, the second is listed, not wired in its place", () => {
    const r = ok(
      exchangeToModel(
        { name: "x", elements: [el("a", "Node", "First"), el("a", "SystemSoftware", "Second"), el("s", "SystemSoftware", "Sw")], relationships: [rel("r1", "Aggregation", "a", "s"), rel("r2", "Aggregation", "a", "s")] },
        opts,
      ),
    );
    expect(r.model.nodes.map((n) => [n.id, n.name])).toEqual([
      ["a", "First"],
      ["s", "Sw"],
    ]);
    expect(r.model.edges).toHaveLength(1);
    expect(r.notes).toContain("Not imported: 1 element whose identifier another element already has: System Software “Second”.");
    expect(r.notes).toContain("Guessed the CSDM relationship of 1 relationship from its ArchiMate type and direction.");
  });

  it("without our properties, the class is guessed from the ArchiMate type, and says so", () => {
    const { model, notes } = ok(
      exchangeToModel(
        {
          name: "Archi sketch",
          elements: [el("a", "ApplicationComponent", "Order app"), el("b", "Device", "Rack server"), el("c", "DataObject", "Orders"), el("d", "Device", "Spare")],
          relationships: [],
        },
        opts,
      ),
    );
    expect(model.nodes.map((n) => [n.id, n.class])).toEqual([
      ["a", "business_application"],
      ["b", "host"],
      ["c", "information_object"],
      ["d", "host"],
    ]);
    expect(notes).toContain("Guessed the CSDM class of 4 elements from their ArchiMate type: Application Component as Business Application (1), Device as Host (2), Data Object as Information Object (1).");
  });

  it("a property naming a class this version doesn't know falls back to the guess", () => {
    const { model, notes } = ok(exchangeToModel({ name: "x", elements: [el("a", "Node", "Box", { "CSDM class": "Mainframe" })], relationships: [] }, opts));
    expect(model.nodes[0]!.class).toBe("host");
    expect(notes[0]).toMatch(/^Guessed the CSDM class of 1 element from its ArchiMate type: Node as Host \(1\)\.$/);
  });

  it("a relationship without our property: the CSDM relationship whose ArchiMate reading matches type and direction", () => {
    const { model, notes } = ok(
      exchangeToModel(
        {
          name: "x",
          elements: [el("app", "ApplicationComponent", "Order app"), el("proc", "BusinessProcess", "Take orders"), el("srv", "Node", "web-01")],
          // ArchiMate: the application serves the process; CSDM: the process uses the application.
          relationships: [rel("r1", "Serving", "app", "proc"), rel("r2", "Composition", "app", "srv")],
        },
        opts,
      ),
    );
    expect(model.edges).toEqual([{ id: "r1", from: "proc", to: "app", type: allowedTypes("business_process", "business_application")[0] }]);
    expect(notes).toContain("Guessed the CSDM relationship of 1 relationship from its ArchiMate type and direction.");
    expect(notes).toContain("Not imported: 1 relationship: Composition “Order app” → “web-01” (no CSDM relationship between Business Application and Host).");
  });

  it("lists what has no CSDM class, and the relationships that touch it; nothing is dropped silently", () => {
    const { model, notes } = ok(
      exchangeToModel(
        {
          name: "x",
          elements: [
            el("p", "BusinessProcess", "Take orders"),
            el("who", "BusinessActor", "Customer"),
            el("j", "AndJunction", ""),
            el("loc", "Location", "Ohio"),
            el("g", "Grouping", "Zone A"),
            el("s1", "Stakeholder", "CFO"),
            el("s2", "Stakeholder", "CIO"),
          ],
          relationships: [rel("r1", "Serving", "who", "p"), rel("r2", "Flow", "p", "j"), rel("r3", "Association", "p", "rel-elsewhere")],
        },
        opts,
      ),
    );
    expect(model.nodes.map((n) => n.id)).toEqual(["p"]);
    expect(model.edges).toEqual([]);
    expect(notes).toContain("Not imported: 6 elements with no CSDM class here: Business Actor “Customer”, And Junction, Location “Ohio”, Grouping “Zone A”, Stakeholder “CFO”, and 1 more.");
    expect(notes).toContain(
      "Not imported: 3 relationships: Serving “Customer” → “Take orders” (an end not imported), Flow “Take orders” → And Junction (an end not imported), Association “Take orders” → another relationship (an end not imported).",
    );
  });

  it("a file with nothing CSDM can hold is refused", () => {
    const r = exchangeToModel({ name: "x", elements: [el("who", "BusinessActor", "Customer")], relationships: [] }, opts);
    expect(r).toEqual({ ok: false, error: "None of its 1 element has a CSDM class here (Business Actor “Customer”)." });
    expect(exchangeToModel({ name: "x", elements: [], relationships: [] }, opts)).toEqual({ ok: false, error: "It has no elements." });
  });

  it("small ArchiMate boxes are spread to fit ours; elements off the diagram go in rows below it", () => {
    const { model, notes } = ok(
      exchangeToModel(
        {
          name: "x",
          elements: [el("a", "Node", "A"), el("b", "Node", "B"), el("c", "Node", "C"), el("d", "Node", "D")],
          relationships: [],
          diagram: {
            name: "Main",
            nodes: [
              { elementRef: "a", x: 12, y: 24, w: 120, h: 55 },
              { elementRef: "b", x: 172, y: 24, w: 120, h: 55 },
              { elementRef: "a", x: 500, y: 500, w: 120, h: 55 },
              { elementRef: "nope", x: 0, y: 0, w: 120, h: 55 },
            ],
          },
        },
        opts,
      ),
    );
    // Scaled so a 120-wide box spaces like our 224-wide elements: twice the width, half again the height.
    expect(model.layout.a).toEqual({ x: 24, y: 36 });
    expect(model.layout.b).toEqual({ x: 344, y: 36 });
    expect(model.layout.c!.y).toBeGreaterThan(36 + 120);
    expect(model.layout.d!.y).toBe(model.layout.c!.y);
    expect(model.layout.d!.x).toBeGreaterThan(model.layout.c!.x);
    expect(notes).toContain("2 elements not on the diagram “Main” are placed below it.");
  });

  it("with no diagram, the elements are placed in rows", () => {
    const elements = Array.from({ length: 7 }, (_, i) => el(`n${i}`, "Node", `N${i}`));
    const { model, notes } = ok(exchangeToModel({ name: "x", elements, relationships: [] }, opts));
    const ys = new Set(Object.values(model.layout).map((p) => p.y));
    expect(ys.size).toBe(2);
    expect(notes).toContain("The file has no diagram, so the elements are placed in rows.");
  });

  it("names, documentation and ids fit the model's limits; duplicate relationships are joined", () => {
    const long = "x".repeat(100);
    const { model } = ok(
      exchangeToModel(
        {
          name: "  ",
          documentation: "What this model is for.",
          elements: [
            { ...el(long, "Node", "A".repeat(300)), documentation: "D".repeat(3000) },
            el("b", "SystemSoftware", "   "),
          ],
          // The node aggregates the system software (CSDM: the Application runs on the Host), twice.
          relationships: [rel("r1", "Aggregation", long, "b"), rel("r2", "Aggregation", long, "b"), rel("r3", "Aggregation", long, "b", { "CSDM relationship type": "Nonsense" })],
        },
        opts,
      ),
    );
    expect(parseModel(model).ok).toBe(true);
    expect(model.name).toBe("Imported ArchiMate Model");
    expect(model.description).toBe("What this model is for.");
    expect(model.nodes[0]!.id).toMatch(/^n\d+$/);
    expect(model.nodes[0]!.name).toHaveLength(200);
    expect(model.nodes[0]!.attrs?.description).toHaveLength(2000);
    expect(model.nodes[1]!.name).toBe("Untitled");
    // r2 joins r1; r3 states its own type, kept as written (Hints flag it, as for a model file).
    expect(model.edges).toEqual([
      { id: "r1", from: "b", to: model.nodes[0]!.id, type: allowedTypes("application", "host")[0] },
      { id: "r3", from: "b", to: model.nodes[0]!.id, type: "Nonsense" },
    ]);
  });

  it("refuses more elements than a model can hold", () => {
    const elements = Array.from({ length: 5001 }, (_, i) => el(`n${i}`, "Node", `N${i}`));
    expect(exchangeToModel({ name: "x", elements, relationships: [] }, opts)).toEqual({ ok: false, error: "It has 5001 elements CSDM can hold; a model holds at most 5000." });
  });
});
