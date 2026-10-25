import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { groupsOf } from "@/model";
import { DEFAULT_SIZE } from "./layout";
import { arrangeByGroups, GROUP_GAP, GROUP_PAD, groupFrames } from "./groupLayout";

const make = (id: string) => examples.find((e) => e.id === id)!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const overlaps = (a: { x: number; w: number }, b: { x: number; w: number }) => a.x < b.x + b.w && b.x < a.x + a.w;

describe("arrangeByGroups (M56)", () => {
  it("gives each group its own band, keeping every element in its row", () => {
    const m = make("db-platform");
    const groups = groupsOf(m, "business_application");
    const layout = arrangeByGroups(m, groups)!;
    expect(layout).not.toBeNull();
    for (const n of m.nodes) expect(layout[n.id]!.y).toBe(m.layout[n.id]!.y);
    // After arranging, each element is in its first group's band: those bands do not overlap.
    const after = { ...m, layout };
    const frames = groupFrames(groups.map((g, i) => ({ ...g, nodeIds: g.nodeIds.filter((id) => i === 0 || !groups[0]!.nodeIds.includes(id)) })), after.layout);
    expect(frames).toHaveLength(2);
    expect(overlaps(frames[0]!, frames[1]!)).toBe(false);
    expect(frames[1]!.x - (frames[0]!.x + frames[0]!.w)).toBe(GROUP_GAP - 2 * GROUP_PAD);
    // Arranged already: nothing to move.
    expect(arrangeByGroups(after, groups)).toBeNull();
  });

  it("does nothing without groups", () => {
    expect(arrangeByGroups(make("checkout"), [])).toBeNull();
  });
});

describe("groupFrames (M56)", () => {
  it("draws a frame around a group's elements, padded", () => {
    const m = make("checkout");
    const [g] = groupsOf(m, "business_application");
    const [f] = groupFrames([g!], m.layout);
    const xs = g!.nodeIds.map((id) => m.layout[id]!.x);
    expect(f!.x).toBe(Math.min(...xs) - GROUP_PAD);
    expect(f!.x + f!.w).toBe(Math.max(...xs) + DEFAULT_SIZE.width + GROUP_PAD);
    expect(f!.count).toBe(g!.nodeIds.length);
  });
});
