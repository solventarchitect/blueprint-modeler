import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { archimateElements, archimateRelationshipFor } from "@/frameworks";
import { allowedTypes, classById, type ClassId } from "@/metamodel";
import { parseModel, type Model } from "@/model";
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
    const back = (id: string) => id.replace(/^el-/, "");
    expect(model.nodes.map((n) => [back(n.id), n.class, n.name])).toEqual(m.nodes.map((n) => [n.id, n.class, n.name]));
    expect(model.edges.map((e) => [back(e.from), back(e.to), e.type]).sort()).toEqual(m.edges.map((e) => [e.from, e.to, e.type]).sort());
    // Same picture, moved together by the export's margin.
    for (const n of m.nodes) expect(model.layout[`el-${n.id}`]).toEqual({ x: m.layout[n.id]!.x + 40, y: m.layout[n.id]!.y + 40 });
    expect(notes).toEqual([]);
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
          relationships: [rel("r1", "Aggregation", long, "b", { "CSDM relationship type": "Nonsense" }), rel("r2", "Aggregation", long, "b")],
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
    expect(model.edges).toEqual([{ id: "r1", from: "b", to: model.nodes[0]!.id, type: allowedTypes("application", "host")[0] }]);
  });

  it("refuses more elements than a model can hold", () => {
    const elements = Array.from({ length: 5001 }, (_, i) => el(`n${i}`, "Node", `N${i}`));
    expect(exchangeToModel({ name: "x", elements, relationships: [] }, opts)).toEqual({ ok: false, error: "It has 5001 elements CSDM can hold; a model holds at most 5000." });
  });
});
