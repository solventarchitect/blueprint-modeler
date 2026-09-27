import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { exportJson, fileBase, importJson } from "./file";
import { modelToSvg } from "./svg";

const model = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");

describe("JSON import/export", () => {
  it("round-trips a model and its layout exactly", () => {
    const m = model();
    const r = importJson(exportJson(m).text, new Set());
    expect(r).toEqual({ ok: true, model: m, issues: [], copied: false });
  });

  it("imports a copy with a new id when the id is already in this browser", () => {
    const m = model();
    const r = importJson(exportJson(m).text, new Set([m.id]), () => "m2");
    expect(r.ok && r.copied && r.model.id).toBe("m2");
    expect(r.ok && r.model.nodes).toEqual(m.nodes);
  });

  it("rejects non-JSON, invalid and oversized files with a readable error", () => {
    expect(importJson("not json", new Set())).toMatchObject({ ok: false, error: expect.stringContaining("not JSON") });
    expect(importJson(JSON.stringify({ schema: 1, id: "x" }), new Set())).toMatchObject({ ok: false, error: expect.stringContaining("not a valid model") });
    expect(importJson(" ".repeat(5_000_001), new Set())).toMatchObject({ ok: false, error: expect.stringContaining("too large") });
  });

  it("names files from the model name", () => {
    expect(fileBase({ name: "Online store — checkout!" })).toBe("online-store-checkout");
    expect(fileBase({ name: "  " })).toBe("model");
    expect(exportJson(model()).filename).toBe("online-store-checkout.json");
  });
});

describe("SVG export", () => {
  for (const theme of ["dark", "light"] as const) {
    it(`is standalone and accessible (${theme})`, () => {
      const m = model();
      const svg = modelToSvg(m, theme);
      expect(svg.startsWith("<?xml")).toBe(true);
      expect(svg).toContain('role="img"');
      expect(svg).toContain(`<title id="t">${m.name}</title>`);
      for (const n of m.nodes) expect(svg).toContain(n.name.slice(0, 20).replace(/&/g, "&amp;")); // long names are clipped
      expect(svg.match(/marker-end="url\(#arrow\)"/g)).toHaveLength(m.edges.length);
      // Nothing that could load or run anything: the only URL is the SVG namespace.
      expect(svg).not.toMatch(/<script|<image|<foreignObject|href=|@import|url\((?!#arrow\))/i);
      expect(svg.match(/https?:\/\/[^"]*/g)).toEqual(["http://www.w3.org/2000/svg"]);
    });
  }

  it("escapes names", () => {
    const m = model();
    m.nodes[0] = { ...m.nodes[0]!, name: `<script>&"'` };
    const svg = modelToSvg(m, "dark");
    expect(svg).toContain("&lt;script&gt;&amp;&quot;&apos;");
    expect(svg).not.toContain("<script>");
  });

  it("uses different colors per theme", () => {
    expect(modelToSvg(model(), "dark")).toContain("#121e2b");
    expect(modelToSvg(model(), "light")).toContain("#f6f7f9");
  });
});
