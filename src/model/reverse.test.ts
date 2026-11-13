import { describe, expect, it } from "vitest";
import { createModel, reversal, withReversed, type Model } from "./index";

// M90: a relationship turned round, where CSDM has one that way.
function m(): Model {
  return {
    ...createModel("Shop", new Date("2026-11-13T00:00:00Z"), "m1"),
    nodes: [
      { id: "a", class: "application_service", name: "Checkout" },
      { id: "b", class: "application_service", name: "Payments" },
      { id: "conn", class: "connection_service_instance", name: "Store link" },
      { id: "net", class: "network_service_instance", name: "WAN" },
      { id: "app", class: "application", name: "checkout.war" },
      { id: "host", class: "host", name: "web-01" },
    ],
    edges: [
      { id: "e1", from: "a", to: "b", type: "Depends on::Used by", ports: { from: "right", to: "top" }, plan: "planned" },
      { id: "e2", from: "conn", to: "net", type: "Provided by::Provides", ports: { to: "left" } },
      { id: "e3", from: "app", to: "host", type: "Runs on::Runs" },
    ],
  };
}

describe("reverse a relationship (M90)", () => {
  it("swaps the ends and keeps the type where CSDM allows it that way round", () => {
    expect(reversal(m(), "e1")).toEqual({ type: "Depends on::Used by", retyped: false });
    const next = withReversed(m(), "e1");
    // The line stays where it was drawn: each chosen side goes with its element. What it carries stays.
    expect(next.edges[0]).toEqual({ id: "e1", from: "b", to: "a", type: "Depends on::Used by", ports: { from: "top", to: "right" }, plan: "planned" });
    expect(next.edges.slice(1)).toEqual(m().edges.slice(1));
    expect(next.nodes).toEqual(m().nodes);
  });

  it("takes the type CSDM allows in the new direction when it is another one", () => {
    expect(reversal(m(), "e2")).toEqual({ type: "Connected by::Connects", retyped: true });
    expect(withReversed(m(), "e2").edges[1]).toEqual({ id: "e2", from: "net", to: "conn", type: "Connected by::Connects", ports: { from: "left" } });
  });

  it("is refused where CSDM has no relationship that way round, where it would repeat one, and for a relationship to itself", () => {
    expect(reversal(m(), "e3")).toEqual({ why: "not-allowed" });
    const twice: Model = { ...m(), edges: [...m().edges, { id: "e4", from: "b", to: "a", type: "Depends on::Used by" }] };
    expect(reversal(twice, "e1")).toEqual({ why: "duplicate" });
    // The repeat can be of the type it would take, not the one it has.
    const taken: Model = { ...m(), edges: [...m().edges, { id: "e7", from: "net", to: "conn", type: "Connected by::Connects" }] };
    expect(reversal(taken, "e2")).toEqual({ why: "duplicate" });
    expect(withReversed(taken, "e2")).toBe(taken);
    const loop: Model = { ...m(), edges: [{ id: "e5", from: "a", to: "a", type: "Depends on::Used by" }] };
    expect(reversal(loop, "e5")).toEqual({ why: "itself" });
    expect(reversal(m(), "nope")).toBeNull();
    for (const [model, id] of [[m(), "e3"], [twice, "e1"], [loop, "e5"], [m(), "nope"]] as const) expect(withReversed(model, id)).toBe(model);
  });

  it("a relationship older files drew the other way is turned to its CSDM 5 form", () => {
    const model: Model = {
      ...m(),
      nodes: [...m().nodes, { id: "ba", class: "business_application", name: "Shop" }, { id: "cap", class: "business_capability", name: "Sell online" }],
      edges: [{ id: "old", from: "ba", to: "cap", type: "Provides::Provided by", ports: { from: "top" } }],
    };
    expect(reversal(model, "old")).toEqual({ type: "Provided by::Provides", retyped: true });
    expect(withReversed(model, "old").edges).toEqual([{ id: "old", from: "cap", to: "ba", type: "Provided by::Provides", ports: { to: "top" } }]);
  });

  it("a flow that walks it there and back still does, each step turned", () => {
    const model: Model = { ...m(), flows: [{ id: "f1", name: "Ask and answer", steps: [{ edge: "e1" }, { edge: "e1", back: true }] }] };
    expect(withReversed(model, "e1").flows![0]!.steps).toEqual([{ edge: "e1", back: true }, { edge: "e1" }]);
    // Twice round is where it started.
    expect(withReversed(withReversed(model, "e1"), "e1")).toEqual(model);
  });

  it("a saved flow that walks it keeps walking the same way", () => {
    const model: Model = {
      ...m(),
      edges: [...m().edges, { id: "e6", from: "b", to: "net", type: "Depends on::Used by" }],
      flows: [
        { id: "f1", name: "Pay", steps: [{ edge: "e1" }, { edge: "e6" }] },
        { id: "f2", name: "Back", steps: [{ edge: "e6", back: true }, { edge: "e1", back: true }] },
      ],
    };
    expect(withReversed(model, "e1").flows).toEqual([
      { id: "f1", name: "Pay", steps: [{ edge: "e1", back: true }, { edge: "e6" }] },
      { id: "f2", name: "Back", steps: [{ edge: "e6", back: true }, { edge: "e1" }] },
    ]);
  });
});
