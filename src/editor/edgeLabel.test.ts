import { describe, expect, it } from "vitest";
import type { LayerBox } from "@/layout/bands";
import { labelPoint, layerTabRects, pointOnCubic } from "./edgeLabel";

const box: LayerBox = { layer: "design", name: "Design", nodeIds: ["a"], x: 0, y: 100, w: 400, h: 120 };
const vertical = "M40,0 C40,50 40,50 40,100";

describe("edge labels", () => {
  it("reads points along a React Flow bezier path", () => {
    expect(pointOnCubic(vertical, 0)).toEqual({ x: 40, y: 0 });
    expect(pointOnCubic(vertical, 1)).toEqual({ x: 40, y: 100 });
    expect(pointOnCubic(vertical, 0.5)).toEqual({ x: 40, y: 50 });
    expect(pointOnCubic("not a path", 0.5)).toBeNull();
  });

  it("places layer tabs above the box while editing, inside it otherwise, at a constant screen size", () => {
    const [above] = layerTabRects([box], 0.5, true);
    expect(above!.y + above!.h).toBe(100);
    expect(above!.h).toBe(48);
    const [inside] = layerTabRects([box], 0.5, false);
    expect(inside!.y).toBeGreaterThan(100);
  });

  it("keeps the middle when it is clear, and slides along the edge off a layer tab", () => {
    const middle = { x: 40, y: 50 };
    expect(labelPoint(vertical, "Uses", [], middle)).toEqual(middle);
    const tab = { x: 0, y: 40, w: 80, h: 24 };
    const moved = labelPoint(vertical, "Provided by", [tab], middle);
    expect(moved.x).toBeCloseTo(40);
    expect(moved.y + 8 <= tab.y || moved.y - 8 >= tab.y + tab.h).toBe(true);
  });

  it("keeps the middle when nothing along the edge is clear, or the point that covers least", () => {
    const wall = { x: -100, y: -100, w: 300, h: 300 };
    expect(labelPoint(vertical, "Uses", [wall], { x: 40, y: 50 })).toEqual({ x: 40, y: 50 });
    const bigTab = { x: 0, y: 12, w: 300, h: 80 };
    expect(labelPoint(vertical, "Uses", [bigTab], { x: 40, y: 50 })).not.toEqual({ x: 40, y: 50 });
  });
});
