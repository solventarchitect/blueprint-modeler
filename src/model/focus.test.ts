import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { focusArea, FOCUS_DEPTHS } from "./focus";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");

describe("focus on an element (M74)", () => {
  it("keeps the element and everything within 1, 2 or 3 relationships, either way", () => {
    const m = checkout();
    const id = (name: string) => m.nodes.find((n) => n.name === name)!.id;
    const web = id("Checkout web app");
    const near = (n: string) => m.edges.filter((e) => e.from === n || e.to === n).flatMap((e) => [e.from, e.to]);
    const one = focusArea(m, web, 1);
    expect(one).toEqual(new Set([web, ...near(web)]));
    const two = focusArea(m, web, 2);
    expect(two).toEqual(new Set([...one, ...[...one].flatMap(near)]));
    expect(focusArea(m, web, 3).size).toBeGreaterThanOrEqual(two.size);
    expect(FOCUS_DEPTHS).toEqual([1, 2, 3]);
  });

  it("leaves out relationships the state shown leaves out; an element not in the model keeps nothing", () => {
    const m = checkout();
    const web = m.nodes.find((n) => n.name === "Checkout web app")!.id;
    const host = m.nodes.find((n) => n.name === "web-prod-01")!.id;
    const hostEdge = m.edges.find((e) => (e.from === web && e.to === host) || (e.to === web && e.from === host))!;
    expect(focusArea(m, web, 1, new Set([hostEdge.id])).has(host)).toBe(false);
    expect(focusArea(m, "gone", 2)).toEqual(new Set());
  });
});
