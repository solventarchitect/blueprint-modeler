import type { ArchimateLayer, ArchimateRelationshipType, RelationshipMapping } from "./archimate";

/**
 * ArchiMate® 3.2 relationship notation and layer colors for the "ArchiMate 3.2 only" lens. Drawn for
 * this app from the specification's descriptions (no copied artwork); shared by the canvas, its legend
 * and the SVG export so they always agree.
 */

export type MarkerShape = "diamond-filled" | "diamond-hollow" | "dot" | "arrow-filled" | "arrow-open" | "triangle-hollow";

/** Line style plus the decoration at ArchiMate's source and target ends. */
export type Notation = { dash?: string; source?: MarkerShape; target?: MarkerShape };

export const notation: Record<ArchimateRelationshipType, Notation> = {
  Composition: { source: "diamond-filled" },
  Aggregation: { source: "diamond-hollow" },
  Assignment: { source: "dot", target: "arrow-filled" },
  Realization: { dash: "6 4", target: "triangle-hollow" },
  Serving: { target: "arrow-open" },
  // Access with no read/write mode given: a dotted line with no arrowhead.
  Access: { dash: "2 3" },
  Influence: { dash: "6 4", target: "arrow-open" },
  Association: {},
};

/** How each relationship reads in a sentence, ArchiMate source first. */
export const archimateVerb: Record<ArchimateRelationshipType, string> = {
  Composition: "is composed of",
  Aggregation: "aggregates",
  Assignment: "is assigned to",
  Realization: "realizes",
  Serving: "serves",
  Access: "accesses",
  Influence: "influences",
  Association: "is associated with",
};

/**
 * Notation for a CSDM edge drawn from `from` to `to`. A reversed mapping means ArchiMate's source is
 * the CSDM `to` element, so the end decorations swap. Pairs with no mapping read as Association, as the
 * ArchiMate export does.
 */
export function edgeNotation(m: RelationshipMapping | undefined): { type: ArchimateRelationshipType; dash?: string; atFrom?: MarkerShape; atTo?: MarkerShape } {
  const type = m?.type ?? "Association";
  const n = notation[type];
  return m?.reverse ? { type, dash: n.dash, atFrom: n.target, atTo: n.source } : { type, dash: n.dash, atFrom: n.source, atTo: n.target };
}

/**
 * Marker geometry, drawn pointing along the line with the tip at (refX, refY); `orient="auto-start-reverse"`
 * turns the same marker around at a line's start. `fill`: "line" (the line's color), "ground" (hollow:
 * the background shows through) or "none" (stroke only).
 */
/** On-screen size of a marker relative to its geometry: big enough to read at the canvas's usual zoom. */
export const MARKER_SCALE = 1.3;

export const markerGeometry: Record<MarkerShape, { w: number; h: number; refX: number; refY: number; d: string; fill: "line" | "ground" | "none" }> = {
  "diamond-filled": { w: 14, h: 10, refX: 13.5, refY: 5, d: "M0.5 5L7 0.5L13.5 5L7 9.5Z", fill: "line" },
  "diamond-hollow": { w: 14, h: 10, refX: 13.5, refY: 5, d: "M0.5 5L7 0.5L13.5 5L7 9.5Z", fill: "ground" },
  dot: { w: 10, h: 10, refX: 9, refY: 5, d: "M1 5a4 4 0 1 0 8 0a4 4 0 1 0-8 0Z", fill: "line" },
  "arrow-filled": { w: 10, h: 10, refX: 10, refY: 5, d: "M0 0.5L10 5L0 9.5Z", fill: "line" },
  "arrow-open": { w: 10, h: 10, refX: 9.5, refY: 5, d: "M1 1L9.5 5L1 9", fill: "none" },
  "triangle-hollow": { w: 14, h: 14, refX: 13, refY: 7, d: "M1 1L13 7L1 13Z", fill: "ground" },
};

/** SVG <marker> markup for one shape in one color. Shared by the canvas defs and the SVG export. */
export function markerSvg(id: string, shape: MarkerShape, line: string, ground: string): string {
  const g = markerGeometry[shape];
  const fill = g.fill === "line" ? line : g.fill === "ground" ? ground : "none";
  return (
    `<marker id="${id}" viewBox="0 0 ${g.w} ${g.h}" refX="${g.refX}" refY="${g.refY}" markerWidth="${g.w * MARKER_SCALE}" markerHeight="${g.h * MARKER_SCALE}" markerUnits="userSpaceOnUse" orient="auto-start-reverse">` +
    `<path d="${g.d}" fill="${fill}" stroke="${line}" stroke-width="1.25" stroke-linejoin="round"/></marker>`
  );
}

/**
 * Element fill per ArchiMate layer: the conventional ArchiMate tool colors in light, the same hues at
 * 22% over the raised surface in dark. On a fill, names stay >= 7:1 and the ArchiMate type uses
 * `archimateTypeInk` (>= 5.2:1 in dark, where the purple AI ink would fall below 4.5:1); checked by
 * script and e2e. "Other" (grouping) keeps the plain surface.
 */
export const archimateFill: Record<"dark" | "light", Record<ArchimateLayer, string | undefined>> = {
  light: {
    Motivation: "#ccccff",
    Strategy: "#f5deaa",
    Business: "#ffffb5",
    Application: "#b5ffff",
    Technology: "#c9e7b7",
    Physical: "#c9e7b7",
    "Implementation & Migration": "#ffe0e0",
    Other: undefined,
  },
  dark: {
    Motivation: "#3f4b64",
    Strategy: "#484f51",
    Business: "#4a5754",
    Application: "#3a5764",
    Technology: "#3e5154",
    Physical: "#3e5154",
    "Implementation & Migration": "#4a505d",
    Other: undefined,
  },
};

/** The ArchiMate type label on a layer fill (export colors; the canvas uses the --am-ink token). */
export const archimateTypeInk: Record<"dark" | "light", string> = { dark: "#ccd8e5", light: "#2000d6" };
