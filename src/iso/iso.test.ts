import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { behind, bridgeRoute, BRIDGE_CLEAR, isoScene, drawOrder, paintOrder, pipeRoute, project, depth, HEIGHT, STEP, SLAB, type Rect } from "./scene";
import { isoToSvg, mix } from "./svg";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");

describe("isometric scene (M59)", () => {
  it("projects 2:1 dimetric: x − y across, (x + y) / 2 − z down", () => {
    expect(project({ x: 100, y: 0, z: 0 })).toEqual({ x: 100, y: 50 });
    expect(project({ x: 0, y: 100, z: 0 })).toEqual({ x: -100, y: 50 });
    expect(project({ x: 0, y: 0, z: 40 })).toEqual({ x: 0, y: -40 });
    // Moving along the view direction changes nothing on screen, only depth.
    expect(project({ x: 10, y: 10, z: 10 })).toEqual(project({ x: 0, y: 0, z: 0 }));
    expect(depth({ x: 10, y: 10, z: 10 })).toBeGreaterThan(depth({ x: 0, y: 0, z: 0 }));
  });

  it("keeps the 2D layout: each element stands on its layer's slab, raised by layer, taller toward the business", () => {
    const m = checkout();
    const s = isoScene(m, "iso");
    expect(s.blocks).toHaveLength(m.nodes.length);
    for (const b of s.blocks) {
      const pos = m.layout[b.id]!;
      expect(b.rect.x).toBe(pos.x + 6);
      expect(b.rect.y).toBe(pos.y + 6);
      expect(b.h).toBe(HEIGHT[b.layer]);
      expect(b.z).toBe(s.slabs.find((x) => x.layer === b.layer)!.top);
    }
    const top = (l: string) => s.slabs.find((x) => x.layer === l)!.top;
    expect(top("infrastructure")).toBe(0);
    expect(top("business")).toBe(4 * STEP.iso);
    expect(top("business")).toBeGreaterThan(top("design"));
    expect(HEIGHT.business).toBeGreaterThan(HEIGHT.infrastructure);
    // Exploded spreads the same layers further apart.
    expect(isoScene(m, "exploded").slabs.find((x) => x.layer === "business")!.top).toBe(4 * STEP.exploded);
  });

  it("routes a relationship in one layer as a pipe on the slab, along x then y, between the blocks' edges", () => {
    const s = isoScene(checkout(), "iso");
    const pipes = s.edges.filter((e) => !e.across);
    expect(pipes.length).toBeGreaterThan(0);
    for (const e of pipes) {
      const a = s.blocks.find((b) => b.id === e.from)!;
      expect(e.points.every((p) => p.z === a.z + 1)).toBe(true);
      for (let i = 1; i < e.points.length; i++) {
        const [p, q] = [e.points[i - 1]!, e.points[i]!];
        expect(p.x === q.x || p.y === q.y).toBe(true); // never diagonal on the slab
      }
    }
  });

  it("joins layers with a bridge along the axes only: up from the lower top, back, along the higher lane, down onto its top (M60)", () => {
    for (const mode of ["iso", "exploded"] as const) {
      const s = isoScene(checkout(), mode);
      const lines = s.edges.filter((e) => e.across);
      expect(lines.length).toBeGreaterThan(0);
      for (const e of lines) {
        const a = s.blocks.find((b) => b.id === e.from)!;
        const b = s.blocks.find((x) => x.id === e.to)!;
        const top = (k: typeof a) => ({ x: k.rect.x + k.rect.w / 2, y: k.rect.y + k.rect.d / 2, z: k.z + k.h });
        // From the `from` block's top to the `to` block's top, whichever way is up.
        expect(e.points[0]).toEqual(top(a));
        expect(e.points.at(-1)).toEqual(top(b));
        // Every segment runs along exactly one axis, so on screen it takes one of the pipes' angles.
        for (let i = 1; i < e.points.length; i++) {
          const [p, q] = [e.points[i - 1]!, e.points[i]!];
          expect([p.x !== q.x, p.y !== q.y, p.z !== q.z].filter(Boolean)).toHaveLength(1);
        }
        // The runs between the layers are just above the higher layer's tops: above every layer they pass.
        const high = a.z > b.z ? a : b;
        expect(e.points.slice(1, -1).every((p) => p.z === high.z + high.h + BRIDGE_CLEAR)).toBe(true);
      }
    }
  });

  it("drops zero-length legs of a bridge", () => {
    const s = isoScene(checkout(), "iso");
    const [a, b] = [s.blocks[0]!, s.blocks.find((x) => x.layer !== s.blocks[0]!.layer)!];
    // Put b straight behind a: the bridge is up, back and down, with no sideways leg.
    const aligned = { ...b, rect: { ...b.rect, x: a.rect.x, w: a.rect.w } };
    expect(bridgeRoute(a, aligned)).toHaveLength(4);
    const offset = { ...b, rect: { ...b.rect, x: a.rect.x + 400 } };
    expect(bridgeRoute(a, offset)).toHaveLength(5);
  });

  it("draws the farthest layers first", () => {
    const s = isoScene(checkout(), "iso");
    const order = drawOrder(s);
    expect(order).toHaveLength(s.slabs.length);
    // The example runs top to bottom, Business at the back: it is drawn first, Infrastructure last.
    expect(order[0]).toBe("business");
    expect(order[order.length - 1]).toBe("infrastructure");
    expect(SLAB).toBeGreaterThan(0);
  });

  it("orders two separated boxes by the side of the plane they are on, whatever their heights", () => {
    const back = { x: 0, y: 0, w: 100, d: 50 };
    const front = { x: 0, y: 100, w: 100, d: 50 };
    // The back box stands far higher, yet the front one is nearer: a plane y = 75 separates them.
    expect(behind(back, 500, front, 0)).toBeLessThan(0);
    expect(behind(front, 0, back, 500)).toBeGreaterThan(0);
    const left = { x: 0, y: 0, w: 50, d: 50 };
    const right = { x: 80, y: 0, w: 50, d: 50 };
    expect(behind(left, 0, right, 0)).toBeLessThan(0);
  });
});

describe("isometric SVG (M59)", () => {
  it("is a standalone picture: literal colors, no scripts, nothing remote; one block and one label per element", () => {
    const m = checkout();
    const svg = isoToSvg(m, "dark");
    expect(svg).toMatch(/^<\?xml/);
    expect(svg).not.toMatch(/<script|href=|var\(--|url\((?!#iso-arrow)/);
    expect(svg.match(/data-iso-el=/g)).toHaveLength(m.nodes.length);
    expect(svg.match(/data-iso-label=/g)).toHaveLength(m.nodes.length);
    expect(svg.match(/data-iso-rel=/g)).toHaveLength(m.edges.length);
    expect(svg).toContain('data-iso="iso"');
    expect(isoToSvg(m, "dark", { mode: "exploded" })).toContain('data-iso="exploded"');
    // The same title block as the plan picture: name, Artifact ID and description.
    expect(svg).toMatch(/data-title="name"[^>]*>Online Store Checkout</);
    expect(svg).toContain(">BM-EX-001<");
    expect(svg).toContain('data-title="description"');
  });

  it("draws the same model the same way every time, and leaves the title out on request", () => {
    const m = checkout();
    expect(isoToSvg(m, "light")).toBe(isoToSvg(m, "light"));
    expect(isoToSvg(m, "light", { untitled: true })).not.toContain('data-title="name"');
    expect(isoToSvg(m, "light")).toContain('data-title="name"');
  });

  it("follows a view: filtered-out elements are ghosts, color-by marks each block with its value's marker", () => {
    const m = checkout();
    m.nodes[0]!.attrs = { ...m.nodes[0]!.attrs, environment: "Production" };
    const svg = isoToSvg(m, "dark", { view: { filter: { environment: ["Production"] }, colorBy: "environment", name: "Prod" } });
    expect(svg.match(/data-iso-el="[^"]+" data-faded=""/g)).toHaveLength(m.nodes.length - 1);
    expect(svg.match(/<path data-slot=/g)).toHaveLength(m.nodes.length);
    expect(svg).toMatch(/data-title="view"[^>]*>View: Prod · colored by environment · showing 1 of \d+ elements</);
    // Relationships to a ghost fade.
    expect(svg).toMatch(/data-iso-rel="[^"]+"[^>]*opacity="0.2" data-faded=""/);
  });

  it("marks a blast radius on the blocks it reaches", () => {
    const m = checkout();
    const [a, b] = [m.nodes[0]!.id, m.nodes[1]!.id];
    const svg = isoToSvg(m, "light", { highlight: { impact: true, nodes: new Map([[a, { hop: 0, current: true }], [b, { hop: 1, current: true }]]), edges: new Map() } });
    expect(svg).toContain('data-blast="start"');
    expect(svg).toContain('data-blast-hop="1"');
  });

  it("mixes colors in sRGB", () => {
    expect(mix("#ffffff", "#000000", 0.5)).toBe("#808080");
    expect(mix("#5ec8ff", "#121e2b", 1)).toBe("#5ec8ff");
    expect(mix("#5ec8ff", "#121e2b", 0)).toBe("#121e2b");
  });
});

describe("isometric edge cases (M59 review)", () => {
  const inside = (p: { x: number; y: number }, r: Rect) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.d;

  it("draws no pipe between stacked blocks, and does not crash", () => {
    const m = checkout();
    const pipe = isoScene(m, "iso").edges.find((x) => !x.across)!;
    const [a, b] = [pipe.from, pipe.to];
    m.layout[b] = { ...m.layout[a]! };
    expect(() => isoToSvg(m, "dark")).not.toThrow();
    expect(isoScene(m, "iso").edges.find((e) => e.from === a && e.to === b)).toBeUndefined();
  });

  it("routes pipes straight where blocks face each other, else with one turn outside both, never through either", () => {
    const a: Rect = { x: 0, y: 0, w: 200, d: 60 };
    expect(pipeRoute(a, { x: 260, y: 20, w: 200, d: 60 })).toEqual([{ x: 200, y: 40 }, { x: 260, y: 40 }]); // rows offset by 20
    expect(pipeRoute(a, { x: 100, y: 120, w: 200, d: 60 })).toEqual([{ x: 150, y: 60 }, { x: 150, y: 120 }]); // columns overlap
    expect(pipeRoute(a, { x: 50, y: 10, w: 200, d: 60 })).toBeNull(); // overlapping blocks
    for (let i = 0; i < 200; i++) {
      const b: Rect = { x: Math.round(Math.random() * 1200 - 600), y: Math.round(Math.random() * 600 - 300), w: 200, d: 60 };
      const route = pipeRoute(a, b);
      if (!route) continue;
      for (const p of route) {
        expect(inside(p, a)).toBe(false);
        expect(inside(p, b)).toBe(false);
      }
      for (let k = 1; k < route.length; k++) expect(route[k - 1]!.x === route[k]!.x || route[k - 1]!.y === route[k]!.y).toBe(true);
    }
  });

  it("paints every pair that overlaps on screen in its true order, in free-form layouts too", () => {
    let pairs = 0;
    for (let t = 0; t < 200; t++) {
      // Twelve blocks scattered without overlapping footprints.
      const items: { rect: Rect; z: number; h: number }[] = [];
      while (items.length < 12) {
        const r: Rect = { x: Math.round(Math.random() * 900), y: Math.round(Math.random() * 500), w: 208, d: 68 };
        if (items.every((o) => r.x + r.w <= o.rect.x || o.rect.x + o.rect.w <= r.x || r.y + r.d <= o.rect.y || o.rect.y + o.rect.d <= r.y)) items.push({ rect: r, z: 0, h: 40 });
      }
      const order = paintOrder(items);
      const at = new Map(order.map((x, i) => [x, i]));
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++) {
          const [a, b] = [items[i]!, items[j]!];
          const pa = [project({ x: a.rect.x, y: a.rect.y + a.rect.d, z: 0 }).x, project({ x: a.rect.x + a.rect.w, y: a.rect.y, z: 0 }).x];
          const pb = [project({ x: b.rect.x, y: b.rect.y + b.rect.d, z: 0 }).x, project({ x: b.rect.x + b.rect.w, y: b.rect.y, z: 0 }).x];
          if (pa[1]! <= pb[0]! || pb[1]! <= pa[0]!) continue; // apart on screen: any order
          const ya = [project({ x: a.rect.x, y: a.rect.y, z: a.h }).y, project({ x: a.rect.x + a.rect.w, y: a.rect.y + a.rect.d, z: 0 }).y];
          const yb = [project({ x: b.rect.x, y: b.rect.y, z: b.h }).y, project({ x: b.rect.x + b.rect.w, y: b.rect.y + b.rect.d, z: 0 }).y];
          if (ya[1]! <= yb[0]! || yb[1]! <= ya[0]!) continue;
          pairs++;
          expect(Math.sign(at.get(a)! - at.get(b)!)).toBe(Math.sign(behind(a.rect, a.z, b.rect, b.z)));
        }
    }
    expect(pairs).toBeGreaterThan(100);
  });

  it("escapes every model string it writes", () => {
    const m = checkout();
    const evil = `"><script>alert(1)</script><img src=x onerror=alert(1) '`;
    m.name = evil;
    m.nodes[0]!.name = evil;
    const svg = isoToSvg(m, "dark", { view: { filter: {}, colorBy: "owner", name: evil } });
    expect(svg).not.toMatch(/<script|<img|onerror=alert\(1\) '/);
    expect(svg).toContain("&lt;script&gt;");
  });
});
