import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { groupsOf } from "@/model";
import { DEFAULT_SIZE } from "./layout";
import { arrangeByGroups, GROUP_GAP, GROUP_PAD, groupFrames, ownGroups } from "./groupLayout";

const make = (id: string) => examples.find((e) => e.id === id)!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const overlaps = (a: { x: number; w: number }, b: { x: number; w: number }) => a.x < b.x + b.w && b.x < a.x + a.w;

describe("arrangeByGroups (M56)", () => {
  it("gives each group its own band, keeping every element in its row", () => {
    const m = make("db-platform");
    const groups = groupsOf(m, "business_application");
    const layout = arrangeByGroups(m, groups)!;
    expect(layout).not.toBeNull();
    for (const n of m.nodes) expect(layout[n.id]!.y).toBe(m.layout[n.id]!.y);
    // After arranging, the frames the canvas draws (each element in its first group) sit side by side,
    // though the PostgreSQL cluster belongs to both groups.
    const after = { ...m, layout };
    expect(groups.filter((g) => g.nodeIds.some((id) => groups[0]!.nodeIds.includes(id)))).toHaveLength(2);
    const frames = groupFrames(ownGroups(groups), after.layout);
    expect(frames).toHaveLength(2);
    expect(overlaps(frames[0]!, frames[1]!)).toBe(false);
    expect(frames[1]!.x - (frames[0]!.x + frames[0]!.w)).toBe(GROUP_GAP - 2 * GROUP_PAD);
    // Arranged already: nothing to move.
    expect(arrangeByGroups(after, groups)).toBeNull();
  });

  it("never puts two elements in one spot, whatever rows they were in", () => {
    const m = make("checkout");
    // Hand-placed: every element on one row, as with lanes off.
    const flat = { ...m, layout: Object.fromEntries(m.nodes.map((n, i) => [n.id, { x: i * 300, y: i % 2 ? 20 : 0 }])) };
    const layout = arrangeByGroups(flat, groupsOf(flat, "service_offering"))!;
    const boxes = m.nodes.map((n) => ({ ...layout[n.id]!, w: DEFAULT_SIZE.width, h: DEFAULT_SIZE.height }));
    for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) expect(overlaps(a, b) && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
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

  it("frames a shared element once, with its first group, and counts what each frame holds", () => {
    const m = make("db-platform");
    const groups = ownGroups(groupsOf(m, "business_application"));
    const cluster = m.nodes.find((n) => n.name === "PostgreSQL cluster")!.id;
    expect(groups.filter((g) => g.nodeIds.includes(cluster))).toHaveLength(1);
    expect(groupFrames(groups, m.layout).map((f) => f.count)).toEqual(groups.map((g) => g.nodeIds.length));
  });
});
