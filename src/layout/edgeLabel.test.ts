import { describe, expect, it } from "vitest";
import type { LayerBox } from "@/layout/bands";
import { labelBox, labelPoint, layerTabRects, planLabels, pointOnCubic } from "./edgeLabel";

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

  it("plans labels in order so no two share a spot, and keeps them off element boxes (M50)", () => {
    const middle = { x: 40, y: 50 };
    // Two edges along the same line: the second must leave the first's label alone.
    const twin = planLabels(
      [
        { id: "a", path: vertical, label: "Uses", middle, span: 100 },
        { id: "b", path: vertical, label: "Uses", middle, span: 100 },
      ],
      [],
    );
    expect(twin[0]!.at).toEqual(middle);
    expect(twin[1]!.at).not.toEqual(middle);
    // A shorter line is planned first, whatever its order, so the long one is the one that moves.
    const long = "M40,-400 C40,50 40,50 40,500";
    const bySpan = planLabels(
      [
        { id: "long", path: long, label: "Uses", middle, span: 900 },
        { id: "short", path: vertical, label: "Uses", middle, span: 100 },
      ],
      [],
    );
    expect(bySpan.map((l) => l.id)).toEqual(["short", "long"]);
    expect(bySpan[0]!.at).toEqual(middle);
    expect(bySpan[1]!.at).not.toEqual(middle);
    const [first, second] = twin.map((l) => l.box);
    const apart = second!.y >= first!.y + first!.h || second!.y + second!.h <= first!.y;
    expect(apart).toBe(true);
    // An element box over the middle pushes the label off it.
    const element = { x: 0, y: 40, w: 224, h: 20 };
    const [moved] = planLabels([{ id: "a", path: vertical, label: "Uses", middle, span: 100 }], [element]);
    expect(moved!.at.y + 8 <= element.y || moved!.at.y - 8 >= element.y + element.h).toBe(true);
    // Two labels on one short line (a pair related both ways): the second sits beside the line.
    const short = "M40,0 C40,20 40,20 40,40";
    const pair = planLabels(
      [
        { id: "ab", path: short, label: "Depends on", middle: { x: 40, y: 20 }, span: 40 },
        { id: "ba", path: short, label: "Depends on", middle: { x: 40, y: 20 }, span: 40 },
      ],
      [
        { x: -112, y: -60, w: 224, h: 60 },
        { x: -112, y: 40, w: 224, h: 60 },
      ],
    );
    expect(pair[0]!.at).toEqual({ x: 40, y: 20 });
    expect(Math.abs(pair[1]!.at.x - 40)).toBeGreaterThanOrEqual(16);
    const [p0, p1] = pair.map((l) => l.box);
    expect(p1!.x >= p0!.x + p0!.w || p1!.x + p1!.w <= p0!.x || p1!.y >= p0!.y + p0!.h || p1!.y + p1!.h <= p0!.y).toBe(true);
    // Nothing clear: it covers an element rather than another label.
    const wallL = { x: -100, y: -100, w: 300, h: 140 }; // covers t ≤ 0.4
    const wallR = { x: -100, y: 60, w: 300, h: 140 }; // covers t ≥ 0.6
    const taken = planLabels(
      [
        { id: "first", path: vertical, label: "Uses", middle, span: 50 },
        { id: "second", path: vertical, label: "Uses", middle, span: 100 },
      ],
      [wallL, wallR],
    );
    expect(taken[0]!.at).toEqual(middle);
    expect(taken[1]!.at).not.toEqual(middle);
    // An empty label takes the middle and occupies nothing.
    const [blank] = planLabels([{ id: "a", path: vertical, label: "", middle, span: 100 }], [element]);
    expect(blank!.at).toEqual(middle);
    expect(blank!.box.w).toBe(0);
    expect(labelBox(middle, "Uses").w).toBeGreaterThan(12);
  });
});
