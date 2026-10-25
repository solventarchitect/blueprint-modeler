import { describe, expect, it } from "vitest";
import { createModel } from "@/model";
import { alignNodes, boundsOf, snapToGuides } from "./align";
import { distributeEvenly } from "./distribute";

const withLayout = (layout: Record<string, { x: number; y: number }>) => ({ ...createModel("M", new Date(0), "m"), layout });
const sizes = { a: { width: 200, height: 60 }, b: { width: 100, height: 40 }, c: { width: 300, height: 80 } };
const m = withLayout({ a: { x: 0, y: 0 }, b: { x: 400, y: 100 }, c: { x: 150, y: 300 } });
// The box around them: x 0–500, y 0–380.

describe("alignNodes", () => {
  it.each([
    ["left", { a: { x: 0, y: 0 }, b: { x: 0, y: 100 }, c: { x: 0, y: 300 } }],
    ["right", { a: { x: 300, y: 0 }, b: { x: 400, y: 100 }, c: { x: 200, y: 300 } }],
    ["center", { a: { x: 150, y: 0 }, b: { x: 200, y: 100 }, c: { x: 100, y: 300 } }],
    ["top", { a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, c: { x: 150, y: 0 } }],
    ["bottom", { a: { x: 0, y: 320 }, b: { x: 400, y: 340 }, c: { x: 150, y: 300 } }],
    ["middle", { a: { x: 0, y: 160 }, b: { x: 400, y: 170 }, c: { x: 150, y: 150 } }],
  ] as const)("lines them up on the %s of the box around them, keeping the other coordinate", (edge, want) => {
    expect(alignNodes(m, ["a", "b", "c"], sizes, edge)).toEqual(want);
  });

  it("uses the default size for an element not yet measured", () => {
    expect(alignNodes(withLayout({ a: { x: 0, y: 0 }, b: { x: 500, y: 0 } }), ["a", "b"], {}, "right")).toEqual({ a: { x: 500, y: 0 }, b: { x: 500, y: 0 } });
  });

  it("does nothing for fewer than two elements or when already aligned", () => {
    expect(alignNodes(m, ["a"], sizes, "left")).toBeNull();
    expect(alignNodes(m, ["a", "missing"], sizes, "left")).toBeNull();
    expect(alignNodes(withLayout({ a: { x: 0, y: 0 }, b: { x: 0, y: 99 } }), ["a", "b"], sizes, "left")).toBeNull();
  });
});

describe("distributeEvenly down the page (axis y)", () => {
  it("makes the vertical steps equal, keeping each x", () => {
    const v = withLayout({ a: { x: 5, y: 0 }, b: { x: 6, y: 900 }, c: { x: 7, y: 100 } });
    expect(distributeEvenly(v, ["a", "b", "c"], 128, "y")).toEqual({ a: { x: 5, y: 0 }, c: { x: 7, y: 450 }, b: { x: 6, y: 900 } });
  });
});

describe("snapToGuides", () => {
  const other = { x: 100, y: 0, width: 200, height: 60 };

  it("snaps left to left within the threshold and draws the line through both", () => {
    const r = snapToGuides({ x: 104, y: 200, width: 200, height: 60 }, [other], 6);
    expect(r.dx).toBe(-4);
    expect(r.dy).toBe(0);
    // Same width, so left, center and right all line up.
    expect(r.guides.filter((g) => g.axis === "x").map((g) => g.at)).toEqual([100, 200, 300]);
    expect(r.guides[0]).toMatchObject({ from: 0, to: 260 });
  });

  it("snaps a center to an edge, the nearest match winning", () => {
    // Moving center 196 (x 146, width 100): other's center 200 is 4 away, other's left 100 is far.
    const r = snapToGuides({ x: 146, y: 300, width: 100, height: 40 }, [other], 6);
    expect(r.dx).toBe(4);
    expect(r.guides).toEqual([{ axis: "x", at: 200, from: 0, to: 340 }]);
  });

  it("snaps each axis on its own: top to bottom", () => {
    const r = snapToGuides({ x: 600, y: 63, width: 50, height: 50 }, [other], 6);
    expect(r).toEqual({ dx: 0, dy: -3, guides: [{ axis: "y", at: 60, from: 100, to: 650 }] });
  });

  it("leaves the box alone and draws nothing when nothing is near", () => {
    expect(snapToGuides({ x: 400, y: 400, width: 50, height: 50 }, [other], 6)).toEqual({ dx: 0, dy: 0, guides: [] });
    expect(snapToGuides({ x: 400, y: 400, width: 50, height: 50 }, [], 6)).toEqual({ dx: 0, dy: 0, guides: [] });
  });
});

describe("boundsOf", () => {
  it("is the box around them", () => {
    expect(boundsOf([{ x: 10, y: 20, width: 5, height: 5 }, { x: -5, y: 30, width: 50, height: 10 }])).toEqual({ x: -5, y: 20, width: 50, height: 20 });
  });
});
