import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";
import { classById } from "@/metamodel";
import { examples } from "@/examples";
import { autoLayout, DEFAULT_SIZE } from "./layout";

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

  it("returns an empty layout for an empty model", async () => {
    const model = examples[0]!.create(new Date(0), "m");
    expect(await autoLayout(elk, { ...model, nodes: [], edges: [], layout: {} })).toEqual({});
  });
});
