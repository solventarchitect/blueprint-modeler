import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { compareModels, sameModel, type Comparison } from "./compare";
import type { Model } from "./schema";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const by = (m: Model, name: string) => m.nodes.find((n) => n.name === name)!;
const counts = (c: Comparison) => [c.added.length, c.removed.length, c.changed.length, c.edgesAdded.length, c.edgesRemoved.length, c.edgesChanged.length];

describe("compareModels (M58)", () => {
  it("finds nothing between a model and itself, or the same model laid out again", () => {
    const m = checkout();
    expect(sameModel(compareModels(m, m))).toBe(true);
    const moved = { ...m, layout: Object.fromEntries(Object.entries(m.layout).map(([id, p]) => [id, { x: p.x + 100, y: p.y }])) };
    expect(sameModel(compareModels(moved, m))).toBe(true);
  });

  it("lists added and removed elements and the relationships that go with them", () => {
    const base = checkout();
    const host = by(base, "db-prod-01");
    const current: Model = {
      ...base,
      nodes: [...base.nodes.filter((n) => n.id !== host.id), { id: "new1", class: host.class, name: "db-prod-02" }],
      edges: base.edges.map((e) => (e.to === host.id ? { ...e, id: "x" + e.id, to: "new1" } : e.from === host.id ? { ...e, id: "x" + e.id, from: "new1" } : e)),
    };
    const c = compareModels(current, base);
    expect(c.added).toEqual([{ id: "new1", name: "db-prod-02", kind: "Host" }]);
    expect(c.removed).toEqual([{ id: host.id, name: "db-prod-01", kind: "Host" }]);
    const touching = base.edges.filter((e) => e.from === host.id || e.to === host.id).length;
    expect(c.edgesAdded).toHaveLength(touching);
    expect(c.edgesRemoved).toHaveLength(touching);
    expect(c.edgesRemoved[0]).toMatchObject({ to: "db-prod-01" });
  });

  it("reports what changed on an element that is in both, field by field", () => {
    const base = checkout();
    const ba = by(base, "Checkout");
    const current = { ...base, nodes: base.nodes.map((n) => (n.id === ba.id ? { ...n, name: "Checkout v2", attrs: { lifecycle: "Operational", owner: "Ana" } } : n)) };
    const c = compareModels(current, base);
    expect(counts(c)).toEqual([0, 0, 1, 0, 0, 0]);
    expect(c.changed[0]!.changes).toEqual([
      { field: "name", before: "Checkout", after: "Checkout v2" },
      { field: "lifecycle", before: "", after: "Operational" },
      { field: "owner", before: "", after: "Ana" },
    ]);
  });

  it("matches elements by class and name when the ids differ (another model built the same way)", () => {
    const base = checkout();
    const renamed = (s: string) => `other-${s}`;
    const current: Model = {
      ...base,
      nodes: base.nodes.map((n) => ({ ...n, id: renamed(n.id), name: n.name.toUpperCase() === n.name ? n.name : ` ${n.name.toLowerCase()} ` })),
      edges: base.edges.map((e) => ({ ...e, id: renamed(e.id), from: renamed(e.from), to: renamed(e.to) })),
      layout: Object.fromEntries(Object.entries(base.layout).map(([id, p]) => [renamed(id), p])),
    };
    const c = compareModels(current, base);
    // Same elements and relationships; only the names' case and spacing differ, which counts as a name change.
    expect(c.added).toEqual([]);
    expect(c.removed).toEqual([]);
    expect(c.edgesAdded).toEqual([]);
    expect(c.edgesRemoved).toEqual([]);
  });

  it("reports a relationship whose type changed, and keeps duplicate names one to one", () => {
    const base = checkout();
    const e = base.edges[0]!;
    const current = { ...base, edges: base.edges.map((x) => (x.id === e.id ? { ...x, type: "Depends on::Used by" } : x)) };
    const c = compareModels(current, base);
    expect(c.edgesChanged).toEqual([expect.objectContaining({ id: e.id, type: "Depends on::Used by", before: e.type })]);

    const twin = { ...base, nodes: [...base.nodes, { id: "t1", class: "host", name: "db-prod-01" }, { id: "t2", class: "host", name: "db-prod-01" }] };
    const one = { ...base, nodes: [...base.nodes, { id: "u1", class: "host", name: "db-prod-01" }] };
    expect(compareModels(twin, one).added).toHaveLength(1);
  });
});

describe("compareModels with the same relationship twice (M58)", () => {
  it("pairs parallel relationships one to one, by ends and type", () => {
    const base = examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
    const e = base.edges[0]!;
    const twice = { ...base, edges: [...base.edges, { ...e, id: "dup" }] };
    const other = { ...twice, edges: twice.edges.map((x) => ({ ...x, id: `o-${x.id}` })) };
    const c = compareModels(other, twice);
    expect(c.edgesAdded).toEqual([]);
    expect(c.edgesRemoved).toEqual([]);
  });
});
