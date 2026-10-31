import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { createModel, formatModelDate, modelDate, withDetails } from "@/model";
import { svgColors, modelToSvg } from "./svg";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const idOf = (m: ReturnType<typeof checkout>, name: string) => m.nodes.find((n) => n.name === name)!.id;

describe("SVG title block", () => {
  it("draws the model name above the diagram, with the Artifact ID and description only when they exist", () => {
    const m = withDetails(checkout(), {});
    const plain = modelToSvg(m, "light");
    expect(plain).toContain('data-title="name"');
    expect(plain).toMatch(/data-title="name"[^>]*>Online Store Checkout</);
    expect(plain).not.toContain('data-title="artifact"');
    // The date is always there: a blueprint carries one.
    expect(plain).toMatch(new RegExp(`data-title="date"[^>]*>${formatModelDate(modelDate(m))}<`));
    expect(plain).not.toContain('data-title="description"');

    const svg = modelToSvg({ ...m, artifactId: "EA-0042", description: "How an order moves from the web store to the database. ".repeat(15).trim() }, "light");
    expect(svg).toMatch(/data-title="artifact"[\s\S]*<path[^>]*data-icon="artifact"[\s\S]*>EA-0042</);
    const lines = svg.match(/<tspan[^>]*data-title-line/g) ?? [];
    // Long descriptions wrap to at most three lines, the last ending with an ellipsis.
    expect(lines.length).toBe(3);
    expect(svg).toMatch(/…<\/tspan><\/text>/);
    // The title block sits above the highest element: the picture grows upward to hold it.
    const top = (s: string) => Number(s.match(/viewBox="[-\d.]+ ([-\d.]+)/)![1]);
    expect(top(svg)).toBeLessThan(top(plain));
  });
});

describe("SVG title block width", () => {
  it("widens a small picture so a long Artifact ID and description stay inside it", () => {
    const one = createModel("A", new Date("2026-09-27T00:00:00Z"), "a");
    one.nodes = [{ id: "h", class: "host", name: "web-01" }];
    one.layout = { h: { x: 0, y: 0 } };
    const svg = modelToSvg({ ...one, artifactId: "X".repeat(64), description: "word ".repeat(60).trim() }, "light");
    const [x, , w] = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+)/)!.slice(1).map(Number);
    // 64 mono characters at 12 px (about 7.6 px each) after a 20 px icon, inside the 32 px margins.
    expect(x! + w!).toBeGreaterThanOrEqual(x! + 32 + 20 + 64 * 7.6 + 32);
    const longest = Math.max(...[...svg.matchAll(/data-title-line="">([^<]*)</g)].map((m) => m[1]!.length));
    expect(32 + longest * 7.2 + 32).toBeLessThanOrEqual(w!);
  });
});

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

describe("SVG of a view (M54)", () => {
  const withProps = () => {
    const m = checkout();
    const set = (name: string, attrs: Record<string, string>) => {
      const n = m.nodes.find((x) => x.name === name)!;
      n.attrs = { ...n.attrs, ...attrs };
    };
    set("db-prod-01", { environment: "Production", lifecycle: "Operational" });
    set(m.nodes[0]!.name, { environment: "Test" });
    return m;
  };

  it("draws exactly as before for All elements colored by layer", () => {
    const m = withProps();
    expect(modelToSvg(m, "dark", { view: { filter: {}, colorBy: "layer" } })).toBe(modelToSvg(m, "dark"));
  });

  it("fades the elements outside the filter and the relationships that touch them", () => {
    const m = withProps();
    const svg = modelToSvg(m, "light", { view: { filter: { environment: ["Production"] }, colorBy: "layer", name: "Prod" } });
    const fadedNodes = svg.match(/<g data-faded="">/g) ?? [];
    expect(fadedNodes).toHaveLength(m.nodes.length - 1);
    // A ghost, not transparency: dashed outline, text in the muted ink (4.5:1 or better on the background).
    const db = svg.split("<g").find((g) => g.includes(">db-prod-01<"))!;
    expect(db).not.toContain("data-faded");
    const ghost = svg.split("<g").find((g) => g.startsWith(' data-faded=""><rect'))!;
    expect(ghost).toContain('stroke-dasharray="4 3"');
    expect(ghost).toMatch(/font-size="14" font-weight="500" fill="#406996"/);
    expect(ghost).not.toContain("opacity");
    // Only one element is in view, so every relationship has a faded end.
    expect((svg.match(/<path [^>]*opacity="0.2" data-faded=""/g) ?? []).length).toBe(m.edges.length);
    expect(svg).toMatch(new RegExp(`data-title="view"[^>]*>View: Prod · showing 1 of ${m.nodes.length} elements<`));
    // No color-by legend rows when coloring by layer.
    expect(svg).not.toContain("data-legend=");
  });

  it("colors by a property with a marker on each element and a legend with counts", () => {
    const m = withProps();
    const svg = modelToSvg(m, "dark", { view: { filter: {}, colorBy: "environment" } });
    expect(svg).toMatch(/data-title="view"[^>]*>View · colored by environment · showing \d+ of \d+ elements</);
    expect(svg).toContain('data-legend="0"');
    expect(svg).toContain('data-legend="none"');
    expect(svg).toContain(">Production (1)<");
    expect(svg).toContain(">Test (1)<");
    expect(svg).toContain(`>Not set (${m.nodes.length - 2})<`);
    // One marker per element.
    expect((svg.match(/<path data-slot=/g) ?? []).length).toBe(m.nodes.length);
    // The legend makes the title block taller, so the picture is too.
    const h = (s: string) => Number(/height="([\d.]+)"/.exec(s)![1]);
    expect(h(svg)).toBeGreaterThan(h(modelToSvg(m, "dark")));
  });

  it("uses only colors the GIF palette knows", () => {
    const m = withProps();
    for (const theme of ["dark", "light"] as const) {
      const view = { filter: { environment: ["Production", "Test"] }, colorBy: "environment" as const };
      const { surfaces, inks } = svgColors(theme, "csdm", view);
      const known = new Set([...surfaces, ...inks]);
      for (const c of modelToSvg(m, theme, { view }).match(/#[0-9a-f]{6}/gi) ?? []) expect(known, `${theme} ${c}`).toContain(c.toLowerCase());
    }
  });
});

describe("SVG connection points (M61)", () => {
  it("draws a relationship from the sides the modeler chose, and the same picture when they are the automatic ones", () => {
    const m = checkout();
    const e = m.edges[0]!;
    const withPorts = (ports: { from?: "top" | "right" | "bottom" | "left"; to?: "top" | "right" | "bottom" | "left" }) => ({ ...m, edges: m.edges.map((x) => (x.id === e.id ? { ...x, ports } : x)) });
    const before = modelToSvg(m, "light");
    // The checkout example runs top to bottom: a relationship between rows leaves by the bottom.
    expect(modelToSvg(withPorts({ from: "bottom", to: "top" }), "light")).toBe(before);
    expect(modelToSvg(withPorts({ from: "left", to: "right" }), "light")).not.toBe(before);
  });
});

describe("group frames in the image (M56)", () => {
  it("draws a frame and a named tab for each group, inside the image, and says how it is grouped", () => {
    const m = checkout();
    const svg = modelToSvg(m, "light", { view: { filter: {}, colorBy: "layer", groupBy: "business_application" } });
    expect(svg.match(/data-group-frame=/g)).toHaveLength(1);
    expect(svg).toContain("Checkout · 9");
    expect(svg).toContain("grouped by Business Application");
    const [vx, vy, vw, vh] = svg.match(/viewBox="([^"]+)"/)![1]!.split(" ").map(Number) as [number, number, number, number];
    const [, x, y, w, h] = svg.match(/data-group-frame="[^"]+"><rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/)!.map(Number) as number[];
    expect(x! >= vx && y! - 18 >= vy && x! + w! <= vx + vw && y! + h! <= vy + vh).toBe(true);
  });

  it("draws no frames without a grouping", () => {
    expect(modelToSvg(checkout(), "light", { view: { filter: {}, colorBy: "layer" } })).not.toContain("data-group-frame");
  });
});

describe("the state shown in images (M71)", () => {
  // Checkout web app is planned, web-prod-01 retiring, and one relationship between live elements planned.
  const planned = () => {
    const m = checkout();
    const web = idOf(m, "Checkout web app");
    const host = idOf(m, "web-prod-01");
    const loose = m.edges.find((e) => ![web, host].includes(e.from) && ![web, host].includes(e.to))!.id;
    return {
      m: { ...m, nodes: m.nodes.map((n) => (n.id === web ? { ...n, plan: "planned" as const } : n.id === host ? { ...n, plan: "retiring" as const } : n)), edges: m.edges.map((e) => (e.id === loose ? { ...e, plan: "planned" as const } : e)) },
      web,
      host,
      loose,
    };
  };
  const view = (state: "both" | "current" | "target") => ({ filter: {}, colorBy: "layer" as const, state });
  const names = (svg: string) => [...svg.matchAll(/data-node="([^"]+)"/g)].map((x) => x[1]);
  const edgeIds = (svg: string) => [...svg.matchAll(/data-edge="([^"]+)"/g)].map((x) => x[1]);

  it("Current leaves out what is planned, and the relationships touching it; the title block names the state", () => {
    const { m, web, host, loose } = planned();
    const svg = modelToSvg(m, "light", { view: view("current") });
    expect(names(svg)).not.toContain(web);
    expect(names(svg)).toContain(host);
    expect(edgeIds(svg)).not.toContain(loose);
    expect(edgeIds(svg).some((id) => m.edges.find((e) => e.id === id)!.from === web || m.edges.find((e) => e.id === id)!.to === web)).toBe(false);
    expect(svg).toMatch(/data-title="view"[^>]*>Current state · showing \d+ of \d+ elements</);
    // No legend: the state alone is not a view.
    expect(svg).not.toContain("data-legend=");
  });

  it("Target leaves out what is retiring; with a view, the state follows the view's name", () => {
    const { m, web, host } = planned();
    const svg = modelToSvg(m, "light", { view: { filter: {}, colorBy: "environment", name: "Prod", state: "target" } });
    expect(names(svg)).toContain(web);
    expect(names(svg)).not.toContain(host);
    expect(svg).toMatch(/data-title="view"[^>]*>View: Prod · colored by environment · Target state · showing \d+ of \d+ elements</);
  });

  it("current and target marks planned (dotted) and retiring (struck through), and says so; a model with neither says nothing", () => {
    const { m, web, host, loose } = planned();
    const svg = modelToSvg(m, "light", { view: view("both") });
    expect(names(svg)).toEqual(expect.arrayContaining([web, host]));
    expect(svg).toMatch(new RegExp(`data-node="${web}" data-plan="planned"`));
    expect(svg).toMatch(new RegExp(`data-node="${host}" data-plan="retiring"`));
    expect(svg).toMatch(/data-strike=""/);
    expect(svg).toMatch(new RegExp(`data-edge="${loose}" data-plan="planned"`));
    expect(svg).toMatch(/data-title="view"[^>]*>Current and target: planned dotted, retiring struck through, each labeled · showing \d+ of \d+ elements</);
    const plain = modelToSvg(checkout(), "light", { view: view("both") });
    expect(plain).not.toContain('data-title="view"');
    expect(plain).not.toContain("data-plan=");
  });
});

describe("the state's count (M71)", () => {
  it("what the state leaves out still counts in the total", () => {
    const m = checkout();
    const pm = { ...m, nodes: m.nodes.map((n, i) => (i === 0 ? { ...n, plan: "planned" as const } : n)) };
    const svg = modelToSvg(pm, "light", { view: { filter: {}, colorBy: "layer", state: "current" } });
    expect(svg).toMatch(new RegExp(`Current state · showing ${m.nodes.length - 1} of ${m.nodes.length} elements<`));
  });
});

describe("the state shown in images, in words (M71 review)", () => {
  const view = (state: "both" | "current" | "target") => ({ filter: {}, colorBy: "layer" as const, state });
  it("planned and retiring are said in words: on the class line, and on a relationship's label (even where ArchiMate notation takes the dash)", () => {
    const m = checkout();
    const web = idOf(m, "Checkout web app");
    const e = m.edges[0]!;
    const pm = { ...m, nodes: m.nodes.map((n) => (n.id === web ? { ...n, plan: "planned" as const } : n)), edges: m.edges.map((x) => (x.id === e.id ? { ...x, plan: "retiring" as const } : x)) };
    const svg = modelToSvg(pm, "light", { view: view("both") });
    expect(svg).toContain("· PLANNED");
    expect(svg).toMatch(/ · Retiring<\/text>/);
    expect(svg).toMatch(new RegExp(`stroke-dasharray="2 5" stroke-linecap="round"[^>]*data-edge="${e.id}" data-plan="retiring"`));
    const am = modelToSvg(pm, "light", { lens: "archimate-only", view: view("both") });
    expect(am).toMatch(/ · Retiring<\/text>/);
  });

  it("the image's description names the state and what it leaves out", () => {
    const m = checkout();
    const pm = { ...m, nodes: m.nodes.map((n, i) => (i === 0 ? { ...n, plan: "planned" as const } : n)) };
    const svg = modelToSvg(pm, "light", { view: view("current") });
    expect(svg).toMatch(new RegExp(`<desc id="d">[^<]*Current state \\(1 of ${m.nodes.length} elements and \\d+ of ${m.edges.length} relationships left out: what is planned\\)\\.</desc>`));
  });

  it("a model with nothing planned still names Current; everything left out still draws a picture", () => {
    expect(modelToSvg(checkout(), "light", { view: view("current") })).toMatch(/data-title="view"[^>]*>Current state · showing (\d+) of \1 elements</);
    const m = checkout();
    const gone = { ...m, nodes: m.nodes.map((n) => ({ ...n, plan: "retiring" as const })) };
    const svg = modelToSvg(gone, "light", { view: view("target") });
    expect(svg).toMatch(new RegExp(`Target state · showing 0 of ${m.nodes.length} elements<`));
    expect(svg).not.toContain("NaN");
  });
});
