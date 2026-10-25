import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { csdmVerb, outlineModel, readModel } from "./reading";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const all = (r: ReturnType<typeof readModel>) => r.groups.flatMap((g) => g.sentences.map((s) => s.text));

describe("reading a model", () => {
  it("turns CSDM relationship types into verbs from the parent side", () => {
    expect(csdmVerb("Uses::Used by")).toBe("uses");
    expect(csdmVerb("Depends on::Used by")).toBe("depends on");
    expect(csdmVerb("Provided by::Provides")).toBe("is provided by");
    expect(csdmVerb("Contains::Contained by")).toBe("contains");
    expect(csdmVerb("reference:parent")).toBe("references");
  });

  it("reads every relationship once in the CSDM lenses, with Title Case class names", () => {
    const m = checkout();
    for (const lens of ["csdm", "archimate"] as const) {
      const r = readModel(m, lens);
      expect(all(r)).toHaveLength(m.edges.length);
      expect(all(r)).toContain("Business Capability “Order management” is provided by Business Application “Checkout”.");
      expect(r.unconnected).toEqual([]);
    }
  });

  it("reads ArchiMate relationships from ArchiMate's source end in the ArchiMate-only lens", () => {
    const r = readModel(checkout(), "archimate-only");
    // CSDM draws Business Application → Application Service; ArchiMate's realization runs the other way.
    expect(all(r)).toContain("Application Component “Checkout — production” realizes Application Component “Checkout”.");
    const prod = r.groups.find((g) => g.name === "Checkout — production")!;
    expect(prod.kind).toBe("Application Component");
    expect(prod.sentences.some((s) => s.objectId === "ba")).toBe(true);
  });

  it("groups by subject in name order, scopes to a selection, and lists unconnected elements", () => {
    const m = checkout();
    const r = readModel(m, "csdm");
    const names = r.groups.map((g) => g.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

    const scoped = readModel(m, "csdm", "prod");
    expect(all(scoped).every((t) => t.includes("“Checkout — production”"))).toBe(true);
    expect(all(scoped)).toHaveLength(m.edges.filter((e) => e.from === "prod" || e.to === "prod").length);
    expect(scoped.unconnected).toEqual([]);

    const lonely = { ...m, nodes: [...m.nodes, { id: "x", class: "host", name: "spare-01" }] };
    expect(readModel(lonely, "csdm").unconnected).toEqual([{ id: "x", name: "spare-01", kind: "Host" }]);
  });

  it("names the field of a reference relationship", () => {
    const m = checkout();
    const bs = m.edges.find((e) => e.from === "bs")!;
    const r = readModel({ ...m, edges: [{ ...bs, type: "reference:parent" }] }, "csdm", "bs");
    expect(all(r)[0]).toMatch(/references .+ through its “parent” field\.$/);
  });
});

describe("the outline (M55)", () => {
  it("lists every element once, under its layer in canvas order, by name, with its relationship count", () => {
    const m = checkout();
    const o = outlineModel(m, "csdm");
    expect(o.map((l) => l.name)).toEqual(["Business", "Design", "Service", "Functional", "Infrastructure"]);
    expect(o.flatMap((l) => l.items)).toHaveLength(m.nodes.length);
    for (const l of o) expect(l.items.map((i) => i.name)).toEqual([...l.items.map((i) => i.name)].sort((a, b) => a.localeCompare(b)));
    const cap = o[0]!.items[0]!;
    expect(cap).toMatchObject({ name: "Order management", kind: "Business Capability", links: 1, details: [] });
    // Each relationship counts once at each end.
    expect(o.flatMap((l) => l.items).reduce((n, i) => n + i.links, 0)).toBe(m.edges.length * 2);
  });

  it("shows life cycle stage, environment and owner where set, and the ArchiMate term in that lens", () => {
    const m = checkout();
    const id = m.nodes.find((n) => n.name === "Order management")!.id;
    const withAttrs = { ...m, nodes: m.nodes.map((n) => (n.id === id ? { ...n, attrs: { lifecycle: "Operational", owner: "Ana" } } : n)) };
    expect(outlineModel(withAttrs, "csdm")[0]!.items[0]!.details).toEqual(["Operational", "Owner: Ana"]);
    expect(outlineModel(withAttrs, "archimate-only")[0]!.items[0]!.kind).toBe("Capability");
  });

  it("leaves out empty layers and counts an unconnected element as 0", () => {
    const m = checkout();
    const host = m.nodes.find((n) => n.name === "Order management")!;
    const lone = { ...m, nodes: [host], edges: [] };
    expect(outlineModel(lone, "csdm")).toEqual([{ layer: "business", name: "Business", items: [expect.objectContaining({ links: 0 })] }]);
  });
});
