import { describe, expect, it } from "vitest";
import { edgePath, pointOnPath, type LineStyle } from "./edgePath";

const s = { x: 100, y: 100, side: "bottom" as const };
const t = { x: 300, y: 300, side: "top" as const };

describe("edge paths", () => {
  it("draws a curve by default and right angles on request, both from the same ends", () => {
    const curved = edgePath(s, t, "curved");
    const stepped = edgePath(s, t, "right-angles");
    expect(curved.path).toMatch(/^M100 100 C/);
    expect(curved.path).not.toMatch(/ L/);
    expect(stepped.path).toMatch(/^M100 100/);
    expect(stepped.path).not.toMatch(/ C/);
    expect(stepped.path).toMatch(/ L| Q/);
    for (const p of [curved, stepped]) {
      expect(pointOnPath(p.path, 0)).toEqual({ x: 100, y: 100 });
      expect(pointOnPath(p.path, 1)).toEqual({ x: 300, y: 300 });
    }
  });

  it("puts the stepped path's corners at right angles, with its label in the middle of the line", () => {
    const { path, label } = edgePath(s, t, "right-angles");
    // Every segment is horizontal or vertical (rounded corners aside).
    const pts = [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)|Q-?[\d.]+ -?[\d.]+ (-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1] ?? m[3]), y: Number(m[2] ?? m[4]) }));
    // Each rounded corner (Q) turns by 90°: the runs on either side of it are straight.
    for (let i = 1; i < pts.length; i++) {
      const dx = Math.abs(pts[i]!.x - pts[i - 1]!.x), dy = Math.abs(pts[i]!.y - pts[i - 1]!.y);
      // A corner's two short legs are the only diagonal step (8px each way); everything else is straight.
      if (dx <= 8 && dy <= 8) continue;
      expect(Math.min(dx, dy), `${pts[i - 1]!.x},${pts[i - 1]!.y} → ${pts[i]!.x},${pts[i]!.y}`).toBeLessThan(0.01);
    }
    expect(label.x).toBeGreaterThan(100);
    expect(label.x).toBeLessThan(300);
    const half = pointOnPath(path, 0.5)!;
    expect(Math.hypot(half.x - label.x, half.y - label.y)).toBeLessThan(60);
  });

  it("samples points along a path whatever its commands", () => {
    const p = pointOnPath("M0 0 L100 0 L100 100", 0.5)!;
    expect(p).toEqual({ x: 100, y: 0 });
    expect(pointOnPath("M0 0 L100 0 L100 100", 0.75)).toEqual({ x: 100, y: 50 });
    expect(pointOnPath("not a path", 0.5)).toBeNull();
  });

  it("never doubles back when the ends are closer than two stubs, and centers the label on a straight line", () => {
    const reverses = (path: string) => {
      const pts = [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)|Q-?[\d.]+ -?[\d.]+ (-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1] ?? m[3]), y: Number(m[2] ?? m[4]) }));
      const last = { x: 0, y: 0 };
      for (let i = 1; i < pts.length; i++) {
        const d = { x: Math.sign(pts[i]!.x - pts[i - 1]!.x), y: Math.sign(pts[i]!.y - pts[i - 1]!.y) };
        if ((d.x && d.x === -last.x) || (d.y && d.y === -last.y)) return true;
        if (d.x) last.x = d.x;
        if (d.y) last.y = d.y;
      }
      return false;
    };
    // Stacked elements 30px apart (anchors), and a sideways pair whose target sits behind the source's stub.
    expect(reverses(edgePath({ x: 100, y: 100, side: "bottom" }, { x: 140, y: 130, side: "top" }, "right-angles").path)).toBe(false);
    expect(reverses(edgePath({ x: 200, y: 100, side: "right" }, { x: 210, y: 300, side: "left" }, "right-angles").path)).toBe(false);
    expect(reverses(edgePath(s, t, "right-angles").path)).toBe(false);
    // A straight vertical line is one run: its label is at the middle, not the first of two equal halves.
    const straight = edgePath({ x: 100, y: 100, side: "bottom" }, { x: 100, y: 300, side: "top" }, "right-angles");
    expect(straight.label).toEqual({ x: 100, y: 200 });
    const styles: LineStyle[] = ["curved", "right-angles"];
    for (const st of styles) expect(edgePath(s, t, st).path.startsWith("M100 100")).toBe(true);
  });
});
