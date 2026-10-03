import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { svgColors, modelToSvg } from "./svg";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const idOf = (m: ReturnType<typeof checkout>, name: string) => m.nodes.find((n) => n.name === name)!.id;

describe("SVG highlight (blast radius frames)", () => {
  it("marks the start, numbers each reached element, colors the carried relationships and adds a caption", () => {
    const m = checkout();
    const db = idOf(m, "db-prod-01");
    const orders = idOf(m, "Orders database");
    const edge = m.edges.find((e) => e.from === orders && e.to === db)!;
    const svg = modelToSvg(m, "dark", {
      highlight: {
        impact: true,
        nodes: new Map([
          [db, { hop: 0, current: false }],
          [orders, { hop: 1, current: true }],
        ]),
        edges: new Map([[edge.id, { current: true }]]),
        caption: { label: "Blast radius", text: "If db-prod-01 fails · Hop 1 of 4 · 1 of 6 affected" },
      },
    });
    expect(svg).toContain(">BLAST RADIUS<");
    expect(svg).toContain(">If db-prod-01 fails · Hop 1 of 4 · 1 of 6 affected<");
    expect(svg).toContain('data-blast="start"');
    expect(svg).toContain('data-blast-hop="1"');
    expect(svg.match(/data-blast=/g)).toHaveLength(2);
    // Start: the error color and ×; reached: the status color and its hop number.
    expect(svg).toMatch(/fill="#e99696"[^>]*\/><text[^>]*>×</);
    expect(svg).toMatch(/fill="#deb163"[^>]*\/><text[^>]*>1</);
    expect(svg).toContain('marker-end="url(#arrow-blast)"');
    expect(svg).toContain('stroke="#deb163" stroke-width="2.5" stroke-dasharray="10 6"');
    // The caption band widens the picture upward; nothing loads or runs.
    expect(svg).not.toMatch(/<script|<image|<foreignObject|href=/i);
  });

  it("uses the accent and ◎ for the start of a Dependencies view, in the light theme's colors", () => {
    const m = checkout();
    const svg = modelToSvg(m, "light", { highlight: { impact: false, nodes: new Map([[idOf(m, "Checkout"), { hop: 0, current: true }]]), edges: new Map() } });
    expect(svg).toMatch(/fill="#005785"[^>]*\/><text[^>]*>◎</);
    expect(svg).not.toContain(">BLAST RADIUS<");
  });

  it("is unchanged without a highlight", () => {
    const m = checkout();
    expect(modelToSvg(m, "dark", { highlight: undefined })).toBe(modelToSvg(m, "dark"));
    expect(modelToSvg(m, "dark")).not.toContain("data-blast");
  });

  it("lists the colors a frame can use, for the GIF palette", () => {
    const dark = svgColors("dark", "csdm");
    expect(dark.surfaces).toEqual(expect.arrayContaining(["#121e2b", "#172738"]));
    expect(dark.inks).toEqual(expect.arrayContaining(["#f6f7f9", "#deb163", "#e99696", "#5ec8ff"]));
    const am = svgColors("light", "archimate-only");
    expect(am.surfaces).toEqual(expect.arrayContaining(["#b5ffff", "#ffffb5"]));
    expect(am.inks).toContain("#2000d6");
    // Every color an SVG uses is in the list.
    const m = checkout();
    for (const [theme, lens] of [["dark", "csdm"], ["light", "archimate-only"], ["dark", "archimate"]] as const) {
      const { surfaces, inks } = svgColors(theme, lens);
      const known = new Set([...surfaces, ...inks]);
      const svg = modelToSvg(m, theme, { lens, highlight: { impact: true, nodes: new Map([[m.nodes[0]!.id, { hop: 0, current: true }], [m.nodes[1]!.id, { hop: 1, current: true }]]), edges: new Map([[m.edges[0]!.id, { current: true }]]), caption: { label: "Blast radius", text: "x" } } });
      for (const c of svg.match(/#[0-9a-f]{6}/gi) ?? []) expect(known, `${theme}/${lens} ${c}`).toContain(c.toLowerCase());
    }
  });
});
