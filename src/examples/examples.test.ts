import { describe, expect, it } from "vitest";
import { allowedTypes, classes, isCsdmCore, isExtended } from "@/metamodel";
import { evaluateHints, parseModel, serializeModel } from "@/model";
import { exampleCategories, examples } from "./index";

describe("examples", () => {
  it("are valid models that load without relationship warnings", () => {
    for (const ex of examples) {
      const r = parseModel(JSON.parse(serializeModel(ex.create(new Date("2026-09-27T00:00:00Z"), ex.id))));
      expect(r.ok, ex.id).toBe(true);
      if (r.ok) expect(r.issues, ex.id).toEqual([]);
    }
  });

  it("teach what their summaries say", () => {
    const hintIds = (id: string) => evaluateHints(examples.find((e) => e.id === id)!.create()).map((h) => h.hint.id);
    expect(hintIds("checkout")).toEqual([]);
    expect(hintIds("hr-portal")).toEqual(["ba-without-service-instance"]);
    expect(hintIds("db-platform")).toEqual(["ba-without-capability", "ba-without-capability", "service-not-exposed"]);
    expect(hintIds("kubernetes")).toEqual([]);
    expect(hintIds("enterprise-ai")).toEqual(["ba-without-service-instance"]);
    expect(hintIds("archimate-claims")).toEqual([]);
    expect(hintIds("csdm5-metamodel")).toEqual(["generic-service-instance"]);
  });

  it("each belong to a listed category, and every listed category has examples", () => {
    const ids = exampleCategories.map((c) => c.id);
    for (const ex of examples) expect(ids, ex.id).toContain(ex.category);
    for (const c of exampleCategories) expect(examples.filter((e) => e.category === c.id).length, c.id).toBeGreaterThan(0);
    expect(exampleCategories.map((c) => c.label)).toEqual(["Application architecture", "Reference architecture", "Frameworks and metamodel"]);
    const of = (id: string) => examples.find((e) => e.id === id)!.category;
    expect(["checkout", "hr-portal", "db-platform", "enterprise-ai"].map(of)).toEqual(Array(4).fill("application"));
    expect(of("kubernetes")).toBe("reference");
    expect([of("archimate-claims"), of("csdm5-metamodel")]).toEqual(["frameworks", "frameworks"]);
  });

  it("the ArchiMate example opens in the ArchiMate-only lens", () => {
    expect(examples.find((e) => e.id === "archimate-claims")!.lens).toBe("archimate-only");
  });

  it("the metamodel example has every CSDM 5 core class once, and only allowed relationships", () => {
    const m = examples.find((e) => e.id === "csdm5-metamodel")!.create();
    const core = classes.filter((c) => isCsdmCore(c) && !isExtended(c)).map((c) => c.id);
    expect(m.nodes.map((n) => n.class).sort()).toEqual([...core].sort());
    for (const e of m.edges) expect(allowedTypes(e.from, e.to), `${e.from} → ${e.to}`).toContain(e.type);
    expect(new Set(m.edges.map((e) => `${e.from}>${e.to}`)).size).toBe(m.edges.length);
  });
});
