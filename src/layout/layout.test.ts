import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";
import { classById } from "@/metamodel";
import { examples } from "@/examples";
import { layerBoxes } from "./bands";
import { autoLayout, DEFAULT_SIZE, fillSpace, LAYER_GAP } from "./layout";

const order = ["business", "design", "service", "functional", "infrastructure"];

describe("autoLayout", () => {
  const elk = new ELK();

  for (const ex of examples) {
    it(`keeps CSDM layers top to bottom without overlaps (${ex.id})`, async () => {
      const model = ex.create(new Date(0), "m");
      const layout = await autoLayout(elk, model);
      expect(Object.keys(layout).sort()).toEqual(model.nodes.map((n) => n.id).sort());

      const rank = (id: string) => order.indexOf(classById(model.nodes.find((n) => n.id === id)!.class)!.layer);
      for (const a of model.nodes) {
        for (const b of model.nodes) {
          if (rank(a.id) < rank(b.id)) expect(layout[a.id]!.y).toBeLessThan(layout[b.id]!.y);
          if (a.id < b.id) {
            const pa = layout[a.id]!;
            const pb = layout[b.id]!;
            const apart = Math.abs(pa.x - pb.x) >= DEFAULT_SIZE.width || Math.abs(pa.y - pb.y) >= DEFAULT_SIZE.height;
            expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
          }
        }
      }
    });
  }

  it("leaves room between stacked layer boxes for a layer's name tab", async () => {
    for (const ex of examples) {
      const model = ex.create(new Date(0), "m");
      const boxes = layerBoxes({ ...model, layout: await autoLayout(elk, model) });
      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i]!.y - (boxes[i - 1]!.y + boxes[i - 1]!.h), `${ex.id}: ${boxes[i]!.name}`).toBeGreaterThanOrEqual(LAYER_GAP);
      }
    }
  });

  const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date(0), "m");
  const layerOf = (model: ReturnType<typeof checkout>, id: string) => classById(model.nodes.find((n) => n.id === id)!.class)!.layer;
  const byLayer = (model: ReturnType<typeof checkout>, layout: Record<string, { x: number; y: number }>) => {
    const groups = new Map<string, { x: number; y: number }[]>();
    for (const n of model.nodes) groups.set(layerOf(model, n.id), [...(groups.get(layerOf(model, n.id)) ?? []), layout[n.id]!]);
    return order.filter((l) => groups.has(l)).map((l) => groups.get(l)!);
  };
  const noOverlap = (ps: { x: number; y: number }[]) => {
    for (const a of ps) for (const b of ps) if (a !== b) expect(Math.abs(a.x - b.x) >= DEFAULT_SIZE.width || Math.abs(a.y - b.y) >= DEFAULT_SIZE.height).toBe(true);
  };

  it("top to bottom puts each CSDM layer on one row, rows in layer order, nothing overlapping", async () => {
    const model = checkout();
    const layout = await autoLayout(elk, model, undefined, "rows");
    const rows = byLayer(model, layout);
    for (const row of rows) expect(new Set(row.map((p) => p.y)).size).toBe(1);
    for (let i = 1; i < rows.length; i++) expect(rows[i]![0]!.y).toBeGreaterThan(rows[i - 1]![0]!.y + DEFAULT_SIZE.height);
    noOverlap(Object.values(layout));
  });

  it("left to right puts each CSDM layer in one column, columns in layer order, nothing overlapping", async () => {
    const model = checkout();
    const layout = await autoLayout(elk, model, undefined, "columns");
    const cols = byLayer(model, layout);
    for (const col of cols) expect(new Set(col.map((p) => p.x)).size).toBe(1);
    for (let i = 1; i < cols.length; i++) expect(cols[i]![0]!.x).toBeGreaterThan(cols[i - 1]![0]!.x + DEFAULT_SIZE.width);
    noOverlap(Object.values(layout));
  });

  it("symmetric centers every layer on the same axis, layers still top to bottom", async () => {
    const model = checkout();
    const layout = await autoLayout(elk, model, undefined, "symmetric");
    const centers = byLayer(model, layout).map((ps) => (Math.min(...ps.map((p) => p.x)) + Math.max(...ps.map((p) => p.x + DEFAULT_SIZE.width))) / 2);
    for (const c of centers) expect(Math.abs(c - centers[0]!)).toBeLessThanOrEqual(1);
    const rows = byLayer(model, layout);
    for (let i = 1; i < rows.length; i++) expect(Math.min(...rows[i]!.map((p) => p.y))).toBeGreaterThan(Math.max(...rows[i - 1]!.map((p) => p.y)));
    noOverlap(Object.values(layout));
  });

  it("returns an empty layout for an empty model", async () => {
    const model = examples[0]!.create(new Date(0), "m");
    expect(await autoLayout(elk, { ...model, nodes: [], edges: [], layout: {} })).toEqual({});
  });
});

describe("fillSpace", () => {
  const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date(0), "m");
  const bounds = (layout: Record<string, { x: number; y: number }>) => {
    const ps = Object.values(layout);
    const x = Math.min(...ps.map((p) => p.x)), y = Math.min(...ps.map((p) => p.y));
    return { x, y, w: Math.max(...ps.map((p) => p.x + DEFAULT_SIZE.width)) - x, h: Math.max(...ps.map((p) => p.y + DEFAULT_SIZE.height)) - y };
  };

  it("stretches the picture to the view's shape without shrinking it or reordering anything", () => {
    const model = checkout();
    const before = bounds(model.layout);
    for (const aspect of [0.5, 3]) {
      const layout = fillSpace(model, {}, aspect)!;
      const after = bounds(layout);
      expect(Math.abs(after.w / after.h - aspect)).toBeLessThan(0.05);
      expect(after.w).toBeGreaterThanOrEqual(before.w - 1);
      expect(after.h).toBeGreaterThanOrEqual(before.h - 1);
      expect(after.x).toBe(before.x);
      expect(after.y).toBe(before.y);
      for (const a of model.nodes) {
        for (const b of model.nodes) {
          if (model.layout[a.id]!.x < model.layout[b.id]!.x) expect(layout[a.id]!.x).toBeLessThan(layout[b.id]!.x);
          if (model.layout[a.id]!.y < model.layout[b.id]!.y) expect(layout[a.id]!.y).toBeLessThan(layout[b.id]!.y);
        }
      }
    }
  });

  it("does nothing for a picture already that shape, or with fewer than two elements", () => {
    const model = checkout();
    const b = bounds(model.layout);
    expect(fillSpace(model, {}, b.w / b.h)).toBeNull();
    expect(fillSpace({ ...model, nodes: model.nodes.slice(0, 1) }, {}, 2)).toBeNull();
  });
});
