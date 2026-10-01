import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { relationships } from "@/metamodel";
import { archimateRelationshipFor } from "./archimate";
import { archimateFill, archimateVerb, edgeNotation, markerGeometry, markerSvg, notation } from "./notation";

describe("ArchiMate notation", () => {
  it("has a notation and a verb for every relationship type the mapping uses", () => {
    for (const r of relationships) {
      const m = archimateRelationshipFor(r.from, r.to);
      expect(m, `${r.from}>${r.to}`).toBeDefined();
      expect(notation[m!.type]).toBeDefined();
      expect(archimateVerb[m!.type]).toBeTruthy();
    }
  });

  it("draws the decorations the specification gives each relationship", () => {
    expect(notation.Composition).toEqual({ source: "diamond-filled" });
    expect(notation.Aggregation).toEqual({ source: "diamond-hollow" });
    expect(notation.Assignment).toEqual({ source: "dot", target: "arrow-filled" });
    expect(notation.Realization).toEqual({ dash: "6 4", target: "triangle-hollow" });
    expect(notation.Serving).toEqual({ target: "arrow-open" });
    expect(notation.Access.dash).toBeTruthy();
    expect(notation.Association).toEqual({});
  });

  it("swaps the ends when ArchiMate's relationship runs against the CSDM edge", () => {
    expect(edgeNotation({ type: "Realization", reverse: false, reads: "" })).toMatchObject({ atFrom: undefined, atTo: "triangle-hollow", dash: "6 4" });
    expect(edgeNotation({ type: "Realization", reverse: true, reads: "" })).toMatchObject({ atFrom: "triangle-hollow", atTo: undefined });
    expect(edgeNotation({ type: "Assignment", reverse: true, reads: "" })).toMatchObject({ atFrom: "arrow-filled", atTo: "dot" });
    expect(edgeNotation(undefined)).toEqual({ type: "Association", dash: undefined, atFrom: undefined, atTo: undefined });
  });

  it("writes standalone markers with the tip at the reference point", () => {
    for (const shape of Object.keys(markerGeometry) as (keyof typeof markerGeometry)[]) {
      const svg = markerSvg(`am-${shape}`, shape, "#111111", "#ffffff");
      expect(svg).toMatch(new RegExp(`^<marker id="am-${shape}" `));
      expect(svg).toContain('orient="auto-start-reverse"');
      expect(svg).not.toMatch(/var\(|url\(/);
    }
  });

  it("keeps the canvas layer fills (globals.css) equal to the export's", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const token = { Motivation: "motivation", Strategy: "strategy", Business: "business", Application: "application", Technology: "technology", "Implementation & Migration": "implementation" } as const;
    for (const [layer, name] of Object.entries(token)) {
      const values = [...css.matchAll(new RegExp(`--am-${name}: (#[0-9a-f]{6});`, "g"))].map((m) => m[1]);
      // Dark default, then the two light blocks (OS setting and the header toggle).
      expect(values, layer).toEqual([archimateFill.dark[layer as keyof typeof token], archimateFill.light[layer as keyof typeof token], archimateFill.light[layer as keyof typeof token]]);
    }
  });
});
