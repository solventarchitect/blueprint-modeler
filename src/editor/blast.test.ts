import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { blastRadius, type Model } from "@/model";
import { blastAnnouncement, blastProgress, blastSteps, blastView } from "./blast";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date(0), "m");
const idOf = (m: Model, name: string) => m.nodes.find((x) => x.name === name)!.id;
const nameOf = (m: Model) => (id: string) => m.nodes.find((n) => n.id === id)?.name || "Untitled";

describe("blast view", () => {
  it("shows only the start at step 0, then adds one hop per step", () => {
    const m = checkout();
    const r = blastRadius(m, idOf(m, "db-prod-01"), "impact");
    const v0 = blastView(m, r, 0);
    expect([...v0.nodes.keys()]).toEqual([idOf(m, "db-prod-01")]);
    expect(v0.nodes.get(idOf(m, "db-prod-01"))).toEqual({ hop: 0, current: true });
    expect(v0.edges.size).toBe(0);

    const v2 = blastView(m, r, 2);
    expect(v2.nodes.get(idOf(m, "Orders database"))).toEqual({ hop: 1, current: false });
    expect(v2.nodes.get(idOf(m, "Checkout — production"))).toEqual({ hop: 2, current: true });
    expect(v2.nodes.has(idOf(m, "Checkout"))).toBe(false);
    expect([...v2.edges.values()].filter((e) => e.current)).toHaveLength(r.steps[2]!.edgeIds.length);
  });

  it("clamps the step to the radius", () => {
    const m = checkout();
    const r = blastRadius(m, idOf(m, "db-prod-01"), "impact");
    expect(blastView(m, r, 99).nodes.size).toBe(r.reached + 1);
    expect(blastView(m, r, -3).nodes.size).toBe(1);
  });

  it("marks each carried relationship with the way impact travels along it", () => {
    const m = checkout();
    const r = blastRadius(m, idOf(m, "db-prod-01"), "impact");
    const v = blastView(m, r, r.steps.length - 1);
    for (const step of r.steps.slice(1)) {
      for (const id of step.edgeIds) {
        const e = m.edges.find((x) => x.id === id)!;
        // The edge runs from the element reached earlier to the one this hop reached.
        expect(v.edges.get(id)!.forward).toBe(step.nodeIds.includes(e.to));
      }
    }
    // Checkout's relationships are all drawn from the dependent element, so impact runs against each line.
    expect(new Set([...v.edges.values()].map((e) => e.forward))).toEqual(new Set([false]));
  });

  it("runs with the line where the dependent is the To element (a capability's parent)", () => {
    const base = checkout();
    const m: Model = {
      ...base,
      nodes: [...base.nodes, { id: "parent", class: "business_capability", name: "Commerce", attrs: {} }],
      edges: [...base.edges, { id: "up", from: idOf(base, "Order management"), to: "parent", type: "reference:parent" }],
    };
    const r = blastRadius(m, idOf(m, "db-prod-01"), "impact");
    const v = blastView(m, r, r.steps.length - 1);
    expect(v.nodes.get("parent")).toEqual({ hop: 5, current: true });
    expect(v.edges.get("up")).toEqual({ current: true, forward: true });
  });

  it("is empty for an element that is not in the model", () => {
    const m = checkout();
    const v = blastView(m, blastRadius(m, "nope", "impact"), 0);
    expect(v.nodes.size).toBe(0);
    expect(v.edges.size).toBe(0);
  });
});

describe("blast text", () => {
  it("summarizes progress in words", () => {
    const m = checkout();
    const r = blastRadius(m, idOf(m, "db-prod-01"), "impact");
    expect(blastProgress(r, 0)).toBe("Start · 0 of 6 affected");
    expect(blastProgress(r, 2)).toBe("Hop 2 of 4 · 2 of 6 affected");
    expect(blastProgress(r, 4)).toBe("Hop 4 of 4 · 6 of 6 affected");
    const d = blastRadius(m, idOf(m, "Checkout"), "dependencies");
    expect(blastProgress(d, 1)).toBe("Hop 1 of 3 · 3 of 8 needed");
  });

  it("announces each step, naming the elements it reached", () => {
    const m = checkout();
    const r = blastRadius(m, idOf(m, "db-prod-01"), "impact");
    expect(blastAnnouncement(r, 0, nameOf(m))).toBe("Blast radius: if db-prod-01 fails, 6 elements are affected within 4 hops.");
    expect(blastAnnouncement(r, 1, nameOf(m))).toBe("Hop 1: Orders database affected.");
    expect(blastAnnouncement(r, 3, nameOf(m))).toBe("Hop 3: Checkout, Online shopping — North America affected.");
    const d = blastRadius(m, idOf(m, "Checkout"), "dependencies");
    expect(blastAnnouncement(d, 0, nameOf(m))).toBe("Dependencies: Checkout needs 8 elements within 3 hops.");
    expect(blastAnnouncement(d, 3, nameOf(m))).toBe("Hop 3: web-prod-01, db-prod-01 needed.");
  });

  it("says plainly when nothing is reached, and when the hop limit stopped the walk", () => {
    const m = checkout();
    const leaf = idOf(m, "Online shopping");
    expect(blastAnnouncement(blastRadius(m, leaf, "impact"), 0, nameOf(m))).toBe(
      "Blast radius: nothing is affected if Online shopping fails. No relationship carries impact from it.",
    );
    expect(blastProgress(blastRadius(m, leaf, "impact"), 0)).toBe("Start · nothing affected");
    const one = blastRadius(m, idOf(m, "db-prod-01"), "impact", 1);
    expect(one.truncated).toBe(true);
    expect(blastAnnouncement(one, 0, nameOf(m))).toBe("Blast radius: if db-prod-01 fails, 1 element is affected within 1 hop (stopped at the hop limit).");
  });

  it("lists every step with its names, for the step list", () => {
    const m = checkout();
    const r = blastRadius(m, idOf(m, "db-prod-01"), "impact");
    const list = blastSteps(r, nameOf(m));
    expect(list).toHaveLength(5);
    expect(list[0]).toEqual({ hop: 0, label: "Failed", names: ["db-prod-01"] });
    expect(list[4]).toEqual({ hop: 4, label: "Hop 4", names: ["Order management", "Online shopping"] });
    expect(blastSteps(blastRadius(m, idOf(m, "Checkout"), "dependencies"), nameOf(m))[0]!.label).toBe("Start");
  });
});
