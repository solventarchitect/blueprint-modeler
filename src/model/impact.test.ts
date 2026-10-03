import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { blastRadius } from "./impact";
import type { Model } from "./schema";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date(0), "m");
const ids = (m: Model, names: string[]) => names.map((n) => m.nodes.find((x) => x.name === n)!.id).sort();
const hop = (r: ReturnType<typeof blastRadius>, i: number) => [...(r.steps[i]?.nodeIds ?? [])].sort();

describe("blast radius", () => {
  it("walks impact outward hop by hop from a failed host", () => {
    const m = checkout();
    const [db] = ids(m, ["db-prod-01"]);
    const r = blastRadius(m, db!, "impact");
    expect(hop(r, 0)).toEqual(ids(m, ["db-prod-01"]));
    expect(hop(r, 1)).toEqual(ids(m, ["Orders database"]));
    expect(hop(r, 2)).toEqual(ids(m, ["Checkout — production"]));
    expect(hop(r, 3)).toEqual(ids(m, ["Checkout", "Online shopping — North America"]));
    expect(hop(r, 4)).toEqual(ids(m, ["Online shopping", "Order management"]));
    expect(r.steps).toHaveLength(5);
    // Data the application uses is not harmed by the application failing.
    expect(r.steps.flatMap((s) => s.nodeIds)).not.toContain(ids(m, ["Customer orders"])[0]);
  });

  it("lists, for each hop, the relationships that carried the impact", () => {
    const m = checkout();
    const [db] = ids(m, ["db-prod-01"]);
    const r = blastRadius(m, db!, "impact");
    expect(r.steps[0]!.edgeIds).toEqual([]);
    for (const step of r.steps.slice(1)) {
      expect(step.edgeIds.length).toBeGreaterThan(0);
      for (const id of step.edgeIds) {
        const e = m.edges.find((x) => x.id === id)!;
        expect(step.nodeIds.includes(e.from) || step.nodeIds.includes(e.to)).toBe(true);
      }
    }
  });

  it("walks the other way to list what an element depends on", () => {
    const m = checkout();
    const [ba] = ids(m, ["Checkout"]);
    const r = blastRadius(m, ba!, "dependencies");
    // The application uses its information object, so the data is one of its dependencies.
    expect(hop(r, 1)).toEqual(ids(m, ["Customer orders", "Checkout — production", "Checkout — test"]));
    expect(hop(r, 2)).toEqual(ids(m, ["Checkout web app", "Orders database", "web-test-01"]));
    expect(hop(r, 3)).toEqual(ids(m, ["db-prod-01", "web-prod-01"]));
    expect(r.reached).toBe(8);
  });

  it("stops in a loop and reaches each element once, at its nearest hop", () => {
    const m: Model = {
      ...checkout(),
      nodes: [
        { id: "a", class: "application_service", name: "A", attrs: {} },
        { id: "b", class: "application_service", name: "B", attrs: {} },
        { id: "c", class: "application", name: "C", attrs: {} },
      ],
      edges: [
        { id: "ab", from: "a", to: "b", type: "Depends on::Used by" },
        { id: "ba", from: "b", to: "a", type: "Depends on::Used by" },
        { id: "bc", from: "b", to: "c", type: "Depends on::Used by" },
      ],
      layout: {},
    };
    const r = blastRadius(m, "c", "impact");
    expect(r.steps.map((s) => s.nodeIds)).toEqual([["c"], ["b"], ["a"]]);
  });

  it("ignores relationships the metamodel does not allow, and those that do not spread impact", () => {
    const m: Model = {
      ...checkout(),
      nodes: [
        { id: "ba", class: "business_application", name: "BA", attrs: {} },
        { id: "h", class: "host", name: "H", attrs: {} },
        { id: "sdlc", class: "sdlc_component", name: "S", attrs: {} },
      ],
      edges: [
        { id: "x", from: "ba", to: "h", type: "Runs on::Runs" },
        { id: "y", from: "ba", to: "sdlc", type: "Contains::Contained by" },
      ],
      layout: {},
    };
    expect(blastRadius(m, "h", "impact").reached).toBe(0);
    expect(blastRadius(m, "sdlc", "impact").reached).toBe(0);
  });

  it("reads older files: legacy types and edges drawn the old way round", () => {
    const m: Model = {
      ...checkout(),
      nodes: [
        { id: "ba", class: "business_application", name: "BA", attrs: {} },
        { id: "as", class: "application_service", name: "AS", attrs: {} },
      ],
      edges: [{ id: "e", from: "ba", to: "as", type: "Consumes::Consumed by" }],
      layout: {},
    };
    expect(blastRadius(m, "as", "impact").steps[1]!.nodeIds).toEqual(["ba"]);
  });

  it("reads an edge an older file drew the other way round, in both directions", () => {
    // Older files stored Business Capability ← Business Application as BA "Provides::Provided by" Capability.
    const m: Model = {
      ...checkout(),
      nodes: [
        { id: "ba", class: "business_application", name: "BA", attrs: {} },
        { id: "cap", class: "business_capability", name: "Cap", attrs: {} },
      ],
      edges: [{ id: "e", from: "ba", to: "cap", type: "Provides::Provided by" }],
      layout: {},
    };
    expect(blastRadius(m, "ba", "impact").steps[1]).toEqual({ hop: 1, nodeIds: ["cap"], edgeIds: ["e"] });
    expect(blastRadius(m, "cap", "impact").reached).toBe(0);
    expect(blastRadius(m, "cap", "dependencies").steps[1]!.nodeIds).toEqual(["ba"]);
  });

  it("stops at the hop limit and says so", () => {
    const m = checkout();
    const [db] = ids(m, ["db-prod-01"]);
    const r = blastRadius(m, db!, "impact", 2);
    expect(r.steps).toHaveLength(3);
    expect(r.truncated).toBe(true);
    expect(blastRadius(m, db!, "impact").truncated).toBe(false);
    // The walk ends exactly at hop 4: a limit of 4 is not a truncation.
    expect(blastRadius(m, db!, "impact", 4).truncated).toBe(false);
  });

  it("returns nothing for an unknown element", () => {
    expect(blastRadius(checkout(), "nope", "impact").steps).toEqual([]);
  });
});
