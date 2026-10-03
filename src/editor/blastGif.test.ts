import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { blastRadius, type Model } from "@/model";
import { blastFrames, GIF_MAX_SIDE, gifScale } from "./blastGif";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date(0), "m");
const idOf = (m: Model, name: string) => m.nodes.find((x) => x.name === name)!.id;

describe("blast radius GIF frames", () => {
  it("has one frame per step, each captioned, holding the last one longer", () => {
    const m = checkout();
    const r = blastRadius(m, idOf(m, "db-prod-01"), "impact");
    const f = blastFrames(m, r, "dark", "csdm");
    expect(f.svgs).toHaveLength(5);
    expect(f.delaysCs).toEqual([150, 150, 150, 150, 300]);
    expect(f.svgs[0]).toContain(">If db-prod-01 fails · Start · 0 of 6 affected<");
    expect(f.svgs[2]).toContain(">If db-prod-01 fails · Hop 2 of 4 · 2 of 6 affected<");
    expect(f.svgs[2]!.match(/data-blast=/g)).toHaveLength(3);
    expect(f.svgs[4]!.match(/data-blast=/g)).toHaveLength(7);
  });

  it("carries a text summary of every hop, for the file and the status line", () => {
    const m = checkout();
    const f = blastFrames(m, blastRadius(m, idOf(m, "db-prod-01"), "impact"), "light", "csdm");
    expect(f.summary).toBe(
      "Blast radius: if db-prod-01 fails, 6 elements are affected within 4 hops. Hop 1: Orders database. Hop 2: Checkout — production. Hop 3: Checkout, Online shopping — North America. Hop 4: Order management, Online shopping.",
    );
    const d = blastFrames(m, blastRadius(m, idOf(m, "Checkout"), "dependencies"), "dark", "csdm");
    expect(d.svgs[0]).toContain(">What Checkout needs · Start · 0 of 8 needed<");
  });

  it("is one still frame when nothing is reached", () => {
    const m = checkout();
    const f = blastFrames(m, blastRadius(m, idOf(m, "Online shopping"), "impact"), "dark", "csdm");
    expect(f.svgs).toHaveLength(1);
    expect(f.delaysCs).toEqual([300]);
  });

  it("builds its palette from the theme's colors", () => {
    const m = checkout();
    const f = blastFrames(m, blastRadius(m, idOf(m, "db-prod-01"), "impact"), "dark", "csdm");
    expect(f.palette).toEqual(expect.arrayContaining([0x121e2b, 0xdeb163, 0xe99696]));
    expect(f.palette.length).toBeLessThanOrEqual(256);
  });

  it("caps the picture's longest side and its area", () => {
    expect(gifScale(800, 600)).toBe(1);
    expect(Math.round(3200 * gifScale(3200, 900))).toBeLessThanOrEqual(GIF_MAX_SIDE);
    const s = gifScale(1600, 1600);
    expect(1600 * s * 1600 * s).toBeLessThanOrEqual(1600 * 1200 + 1);
  });
});
