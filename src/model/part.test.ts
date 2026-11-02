import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { modelPart } from "./part";
import type { Model } from "./schema";

// M81: the part of a model that is shown, for a model book of what's shown.
const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");

describe("modelPart (M81)", () => {
  it("keeps the elements given, the relationships between them, and their layout; no saved views", () => {
    const m: Model = { ...checkout(), views: [{ id: "v", name: "All", filter: {}, colorBy: "layer" }] };
    const keep = new Set(["ba", "data", "cap"]);
    const p = modelPart(m, keep);
    expect(p.nodes.map((n) => n.id).sort()).toEqual(["ba", "cap", "data"]);
    expect(p.edges.every((e) => keep.has(e.from) && keep.has(e.to))).toBe(true);
    expect(p.edges.length).toBe(m.edges.filter((e) => keep.has(e.from) && keep.has(e.to)).length);
    expect(Object.keys(p.layout).sort()).toEqual(["ba", "cap", "data"]);
    expect(p.views).toBeUndefined();
  });

  it("leaves out relationships the state shown leaves out", () => {
    const m = checkout();
    const keep = new Set(m.nodes.map((n) => n.id));
    const drop = new Set([m.edges[0]!.id]);
    expect(modelPart(m, keep, drop).edges.map((e) => e.id)).toEqual(m.edges.slice(1).map((e) => e.id));
  });

  it("cuts flows where they leave the part and drops the empty ones; keeps decisions about kept elements (and those about none)", () => {
    const m: Model = {
      ...checkout(),
      flows: [{ id: "f1", name: "Order", steps: [{ edge: "e6" }, { edge: "e9" }, { edge: "e12" }] }],
      decisions: [
        { id: "d1", title: "About ba and host", status: "accepted", elements: ["ba", "h1"] },
        { id: "d2", title: "About something left out", status: "proposed", elements: ["test"] },
        { id: "d3", title: "About the whole model", status: "proposed" },
      ],
    };
    const p = modelPart(m, new Set(["ba", "data", "cap"]));
    expect(p.flows).toBeUndefined();
    expect(p.decisions).toEqual([
      { id: "d1", title: "About ba and host", status: "accepted", elements: ["ba"] },
      { id: "d3", title: "About the whole model", status: "proposed" },
    ]);
    // Every element: the whole model back, but for its saved views.
    const all = modelPart(m, new Set(m.nodes.map((n) => n.id)));
    expect(all.flows).toEqual(m.flows);
    expect(all.decisions).toHaveLength(3);
  });
});
