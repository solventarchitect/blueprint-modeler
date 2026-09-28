import { describe, expect, it } from "vitest";
import { createModel } from "@/model";
import { distributeEvenly } from "./distribute";

const withLayout = (layout: Record<string, { x: number; y: number }>) => ({ ...createModel("M", new Date(0), "m"), layout });

describe("distributeEvenly", () => {
  it("makes the gaps equal between the leftmost and rightmost, keeping heights", () => {
    const m = withLayout({ a: { x: 0, y: 10 }, b: { x: 900, y: 20 }, c: { x: 100, y: 30 }, d: { x: 1200, y: 40 } });
    expect(distributeEvenly(m, ["a", "b", "c", "d"], 300)).toEqual({ a: { x: 0, y: 10 }, c: { x: 400, y: 30 }, b: { x: 800, y: 20 }, d: { x: 1200, y: 40 } });
  });

  it("widens the span when elements would sit closer than the pitch", () => {
    const m = withLayout({ a: { x: 0, y: 0 }, b: { x: 50, y: 0 }, c: { x: 60, y: 0 } });
    expect(distributeEvenly(m, ["a", "b", "c"], 336)).toEqual({ a: { x: 0, y: 0 }, b: { x: 336, y: 0 }, c: { x: 672, y: 0 } });
  });

  it("does nothing for fewer than two elements or when already even", () => {
    expect(distributeEvenly(withLayout({ a: { x: 0, y: 0 } }), ["a"], 336)).toBeNull();
    expect(distributeEvenly(withLayout({ a: { x: 0, y: 0 }, b: { x: 400, y: 0 } }), ["a", "b"], 336)).toBeNull();
  });
});
