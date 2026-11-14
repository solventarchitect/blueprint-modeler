import { describe, expect, it } from "vitest";
import { createModel, type Model } from "@/model";
import { capabilityMapSvg } from "./capmap";

// M92: the capability map as a standalone picture.
function m(): Model {
  return {
    ...createModel("Shop", new Date("2026-11-14T00:00:00Z"), "m1"),
    nodes: [
      { id: "sell", class: "business_capability", name: "Sell", attrs: { owner: "Sales" } },
      { id: "online", class: "business_capability", name: "Sell online", attrs: { owner: "Digital" } },
      { id: "store", class: "business_capability", name: "Sell in store", attrs: { owner: "Sales" } },
      { id: "hr", class: "business_capability", name: "Manage people & pay" },
      { id: "shop", class: "business_application", name: "Shop" },
    ],
    edges: [
      { id: "p1", from: "online", to: "sell", type: "reference:parent" },
      { id: "p2", from: "store", to: "sell", type: "reference:parent" },
      { id: "a1", from: "online", to: "shop", type: "Provided by::Provides" },
    ],
  };
}
type Rect = { x: number; y: number; w: number; h: number };
/** Each tile's outline, read back from the picture. */
function tiles(svg: string): Map<string, Rect> {
  const out = new Map<string, Rect>();
  for (const g of svg.matchAll(/<g data-cap="([^"]+)"[^>]*><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
    out.set(g[1]!, { x: +g[2]!, y: +g[3]!, w: +g[4]!, h: +g[5]! });
  }
  return out;
}
const inside = (a: Rect, b: Rect) => a.x > b.x && a.y > b.y && a.x + a.w < b.x + b.w && a.y + a.h < b.y + b.h;
const apart = (a: Rect, b: Rect) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

describe("capability map picture (M92)", () => {
  it("draws each capability inside its parent, siblings apart, with names and counts", () => {
    const svg = capabilityMapSvg(m(), "light");
    const t = tiles(svg);
    expect([...t.keys()]).toEqual(["sell", "online", "store", "hr"]);
    expect(inside(t.get("online")!, t.get("sell")!)).toBe(true);
    expect(inside(t.get("store")!, t.get("sell")!)).toBe(true);
    expect(apart(t.get("online")!, t.get("store")!)).toBe(true);
    expect(apart(t.get("sell")!, t.get("hr")!)).toBe(true);
    expect(svg).toContain(">Sell online<");
    expect(svg).toContain(">Manage people &amp; pay<");
    expect(svg).toContain(">1 Business Application<");
    // A parent's counts, one part a line.
    expect(svg).toContain(">No Business Applications<");
    expect(svg).toContain(">1 with its parts<");
    // The picture fits what it draws.
    const [, w, h] = /width="([\d.]+)" height="([\d.]+)"/.exec(svg)!.map(Number);
    for (const r of t.values()) expect(r.x + r.w <= w! && r.y + r.h <= h!).toBe(true);
  });

  it("names itself, and says what it shows", () => {
    const svg = capabilityMapSvg(m(), "dark");
    expect(svg).toMatch(/^<\?xml/);
    expect(svg).toContain('role="img"');
    expect(svg).toContain("<title id=\"t\">Capability map: Shop</title>");
    expect(svg).toContain("4 Business Capabilities");
    expect(svg).toContain("<defs>");
    expect(svg).toContain('fill="#121e2b"');
  });

  it("follows the view: its coloring on each tile with a legend, and what its filter leaves out faded", () => {
    const svg = capabilityMapSvg(m(), "light", { filter: { owner: ["Sales"] }, colorBy: "owner", name: "Sales" });
    expect(svg).toContain("View: Sales · colored by owner");
    expect(svg).toMatch(/<g data-cap="sell"[^>]*data-slot="\d"/);
    // Left out by the filter: a ghost, as the canvas pictures draw one.
    expect(svg).toMatch(/<g data-cap="online" data-faded=""[^>]*><rect [^>]*stroke-dasharray="4 3"/);
    expect(svg).not.toMatch(/<g data-cap="sell" data-faded/);
    // A capability with no owner takes the "none" color.
    expect(svg).toMatch(/<g data-cap="hr"[^>]*data-slot="none"/);
  });

  it("says when there are no capabilities", () => {
    const svg = capabilityMapSvg({ ...m(), nodes: m().nodes.filter((n) => n.class !== "business_capability") }, "light");
    expect(svg).toContain("No Business Capabilities in this model.");
    expect(tiles(svg).size).toBe(0);
  });
});
