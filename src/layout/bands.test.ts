import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { layerBoxes, layerLanes, layoutOrientation, settleIntoLane } from "./bands";

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
    for (let i = 1; i < lanes.length; i++) expect(lanes[i]!.start).toBe(lanes[i - 1]!.end);
    for (const l of lanes) expect(l.end).toBeGreaterThan(l.start);
    expect(lanes.some((l) => l.columns)).toBe(false);
  });

  it("settle a dropped element back into its own layer's lane", () => {
    const m = model();
    const hostLane = layerLanes(m, {}, "h1").find((l) => l.name === "Infrastructure")!;
    const r = settleIntoLane(m, {}, "h1", { x: 10, y: -500 });
    expect(r.settled).toBe(true);
    expect(r.lane).toBe("Infrastructure");
    expect(r.y).toBeGreaterThanOrEqual(hostLane.start);
    expect(r.x).toBe(10);
    const inside = settleIntoLane(m, {}, "h1", { x: 10, y: m.layout.h1!.y });
    expect(inside.settled).toBe(false);
  });

  it("read as columns when the layers sit side by side in layer order, rows otherwise", () => {
    const m = model();
    expect(layoutOrientation(m)).toBe("rows");
    const boxes = layerBoxes(m);
    const sideways = { ...m, layout: { ...m.layout } };
    for (const [i, b] of boxes.entries()) for (const id of b.nodeIds) sideways.layout[id] = { x: m.layout[id]!.x - b.x + i * 2000, y: m.layout[id]!.y - b.y };
    expect(layoutOrientation(sideways)).toBe("columns");
    const lanes = layerLanes(sideways);
    expect(lanes.every((l) => l.columns)).toBe(true);
    expect(lanes.map((l) => l.name)).toEqual(["Business", "Design", "Service", "Functional", "Infrastructure"]);
    for (let i = 1; i < lanes.length; i++) expect(lanes[i]!.start).toBe(lanes[i - 1]!.end);
    // A dropped element settles sideways into its column.
    const r = settleIntoLane(sideways, {}, "h1", { x: -5000, y: 10 });
    expect(r.settled).toBe(true);
    expect(r.y).toBe(10);
    expect(r.x).toBeGreaterThanOrEqual(lanes.find((l) => l.name === "Infrastructure")!.start);
    expect(layoutOrientation({ ...m, nodes: m.nodes.filter((n) => n.class === "host") })).toBe("rows");
  });

  it("skip empty layers", () => {
    const m = model();
    const only = { ...m, nodes: m.nodes.filter((n) => n.class === "host") };
    expect(layerBoxes(only).map((b) => b.name)).toEqual(["Infrastructure"]);
  });
});
