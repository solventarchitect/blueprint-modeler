import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { layerBoxes, layerLanes, settleIntoLane } from "./bands";

const model = () => examples.find((e) => e.id === "checkout")!.create(new Date(0), "m");

describe("layer boxes and lanes", () => {
  it("draw one box per populated layer, containing every element of that layer", () => {
    const m = model();
    const boxes = layerBoxes(m);
    expect(boxes.map((b) => b.name)).toEqual(["Business", "Design", "Service", "Functional", "Infrastructure"]);
    for (const b of boxes) {
      for (const id of b.nodeIds) {
        const p = m.layout[id]!;
        expect(p.x).toBeGreaterThan(b.x);
        expect(p.y).toBeGreaterThan(b.y);
        expect(p.x + 224).toBeLessThan(b.x + b.w);
        expect(p.y + 64).toBeLessThan(b.y + b.h);
      }
    }
  });

  it("stack lanes in layer order without gaps or overlaps", () => {
    const lanes = layerLanes(model());
    for (let i = 1; i < lanes.length; i++) expect(lanes[i]!.top).toBe(lanes[i - 1]!.bottom);
    for (const l of lanes) expect(l.bottom).toBeGreaterThan(l.top);
  });

  it("settle a dropped element back into its own layer's lane", () => {
    const m = model();
    const hostLane = layerLanes(m, {}, "h1").find((l) => l.name === "Infrastructure")!;
    const r = settleIntoLane(m, {}, "h1", { x: 10, y: -500 });
    expect(r.settled).toBe(true);
    expect(r.lane).toBe("Infrastructure");
    expect(r.y).toBeGreaterThanOrEqual(hostLane.top);
    expect(r.x).toBe(10);
    const inside = settleIntoLane(m, {}, "h1", { x: 10, y: m.layout.h1!.y });
    expect(inside.settled).toBe(false);
  });

  it("skip empty layers", () => {
    const m = model();
    const only = { ...m, nodes: m.nodes.filter((n) => n.class === "host") };
    expect(layerBoxes(only).map((b) => b.name)).toEqual(["Infrastructure"]);
  });
});
