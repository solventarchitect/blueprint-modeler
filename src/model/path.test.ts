import { describe, expect, it } from "vitest";
import { createModel, flowStepText, MAX_PATHS, shortestPaths, type Model } from "./index";

// M91: the shortest chains of relationships between two elements, whichever way each is drawn.
function m(): Model {
  return {
    ...createModel("Shop", new Date("2026-11-13T00:00:00Z"), "m1"),
    nodes: [
      { id: "cap", class: "business_capability", name: "Sell online" },
      { id: "ba", class: "business_application", name: "Shop" },
      { id: "svc", class: "application_service", name: "Shop production" },
      { id: "app", class: "application", name: "shop.war" },
      { id: "db", class: "application", name: "Orders database" },
      { id: "host", class: "host", name: "web-01" },
      { id: "alone", class: "host", name: "spare-01" },
    ],
    edges: [
      { id: "e1", from: "cap", to: "ba", type: "Provided by::Provides" },
      { id: "e2", from: "ba", to: "svc", type: "Uses::Used by" },
      { id: "e3", from: "svc", to: "app", type: "Depends on::Used by" },
      { id: "e4", from: "svc", to: "db", type: "Depends on::Used by" },
      { id: "e5", from: "app", to: "host", type: "Runs on::Runs" },
      { id: "e6", from: "db", to: "host", type: "Runs on::Runs" },
    ],
  };
}
const words = (model: Model, a: string, b: string) => shortestPaths(model, a, b).paths.map((p) => p.map((s) => flowStepText(model, s)));

describe("path between two elements (M91)", () => {
  it("finds the shortest chain, each step leaving where the one before arrived", () => {
    expect(shortestPaths(m(), "cap", "svc")).toEqual({ paths: [[{ edge: "e1" }, { edge: "e2" }]], more: false });
    expect(words(m(), "cap", "svc")).toEqual([["Sell online → Shop (Provided by)", "Shop → Shop production (Uses)"]]);
  });

  it("walks a relationship against its arrow where the chain runs that way", () => {
    expect(shortestPaths(m(), "host", "ba").paths[0]).toEqual([{ edge: "e5", back: true }, { edge: "e3", back: true }, { edge: "e2", back: true }]);
    // Two elements that share a neighbor: down one relationship and back up another.
    expect(shortestPaths(m(), "app", "db").paths).toEqual([
      [{ edge: "e3", back: true }, { edge: "e4" }],
      [{ edge: "e5" }, { edge: "e6", back: true }],
    ]);
  });

  it("gives every equally short chain, in the model's order, and no longer one", () => {
    expect(shortestPaths(m(), "cap", "host")).toEqual({
      paths: [
        [{ edge: "e1" }, { edge: "e2" }, { edge: "e3" }, { edge: "e5" }],
        [{ edge: "e1" }, { edge: "e2" }, { edge: "e4" }, { edge: "e6" }],
      ],
      more: false,
    });
    // A direct relationship is the only shortest chain, whatever else joins them.
    const direct: Model = { ...m(), edges: [...m().edges, { id: "e7", from: "svc", to: "host", type: "Depends on::Used by" }] };
    expect(shortestPaths(direct, "svc", "host").paths).toEqual([[{ edge: "e7" }]]);
    // Two relationships between the same two elements are two chains.
    const twice: Model = { ...m(), edges: [...m().edges, { id: "e8", from: "svc", to: "ba", type: "Depends on::Used by" }] };
    expect(shortestPaths(twice, "ba", "svc").paths).toEqual([[{ edge: "e2" }], [{ edge: "e8", back: true }]]);
  });

  it("none for elements nothing joins, the same element twice, or one that isn't there", () => {
    expect(shortestPaths(m(), "cap", "alone")).toEqual({ paths: [], more: false });
    expect(shortestPaths(m(), "cap", "cap")).toEqual({ paths: [], more: false });
    expect(shortestPaths(m(), "cap", "nope")).toEqual({ paths: [], more: false });
  });

  it("stops listing after a limit, and says there are more", () => {
    // A ladder: 5 rungs of two parallel relationships each gives 32 equally short chains.
    const nodes = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, class: "application_service", name: `S${i}` }));
    const edges = Array.from({ length: 5 }, (_, i) => [
      { id: `a${i}`, from: `s${i}`, to: `s${i + 1}`, type: "Depends on::Used by" },
      { id: `b${i}`, from: `s${i + 1}`, to: `s${i}`, type: "Depends on::Used by" },
    ]).flat();
    const r = shortestPaths({ ...m(), nodes, edges }, "s0", "s5");
    expect(r.paths).toHaveLength(MAX_PATHS);
    expect(r.more).toBe(true);
    expect(r.paths[0]).toEqual([{ edge: "a0" }, { edge: "a1" }, { edge: "a2" }, { edge: "a3" }, { edge: "a4" }]);
    expect(new Set(r.paths.map((p) => JSON.stringify(p))).size).toBe(MAX_PATHS);
  });
});
