"use client";

import { Panel } from "@xyflow/react";
import { MARKER_SCALE, markerGeometry, notation, type ArchimateRelationshipType, type MarkerShape } from "@/frameworks";

/** Edge tones, matching the edge classes in globals.css: plain, connected to the selection, hinted. */
export type EdgeTone = "line" | "neighbor" | "status" | "accent";
type MarkerTone = EdgeTone | "legend";
const toneColor: Record<MarkerTone, string> = { line: "var(--border-strong)", neighbor: "var(--neighbor)", status: "var(--status)", accent: "var(--accent)", legend: "var(--border-strong)" };
/** What a hollow marker shows through: the canvas on edges, the legend's own background in the legend. */
const groundColor: Record<MarkerTone, string> = { line: "var(--canvas)", neighbor: "var(--canvas)", status: "var(--canvas)", accent: "var(--canvas)", legend: "var(--surface-raised)" };

/** The id React Flow resolves as `url('#…')` for a marker shape in a tone. */
export const markerId = (shape: MarkerShape, tone: MarkerTone) => `am-${shape}-${tone}`;

/** ArchiMate relationship markers for the canvas, one per shape and tone. Rendered once, out of sight. */
export function NotationMarkers() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute" focusable="false">
      <defs>
        {(Object.keys(toneColor) as MarkerTone[]).flatMap((tone) =>
          (Object.keys(markerGeometry) as MarkerShape[]).map((shape) => {
            const g = markerGeometry[shape];
            const line = toneColor[tone];
            const fill = g.fill === "line" ? line : g.fill === "ground" ? groundColor[tone] : "none";
            return (
              <marker
                key={markerId(shape, tone)}
                id={markerId(shape, tone)}
                viewBox={`0 0 ${g.w} ${g.h}`}
                refX={g.refX}
                refY={g.refY}
                markerWidth={g.w * MARKER_SCALE}
                markerHeight={g.h * MARKER_SCALE}
                markerUnits="userSpaceOnUse"
                orient="auto-start-reverse"
              >
                <path d={g.d} style={{ fill, stroke: line }} strokeWidth={1.25} strokeLinejoin="round" />
              </marker>
            );
          }),
        )}
      </defs>
    </svg>
  );
}

const ORDER = Object.keys(notation) as ArchimateRelationshipType[];

/** Key to the relationship notation on the canvas: only the relationship types the model uses. */
export function NotationLegend({ types }: { types: ReadonlySet<ArchimateRelationshipType> }) {
  const shown = ORDER.filter((t) => types.has(t));
  if (shown.length === 0) return null;
  return (
    <Panel position="top-right" className="!m-3">
      <figure className="border border-border bg-surface-raised px-3 py-2" data-testid="notation-legend">
        <figcaption className="font-mono text-[0.65rem] tracking-[0.12em] text-ink-muted uppercase">ArchiMate relationships</figcaption>
        <ul className="mt-1.5 flex flex-col gap-1">
          {shown.map((t) => {
            const n = notation[t];
            return (
              <li key={t} className="flex items-center gap-2 text-xs text-ink-soft">
                <svg aria-hidden="true" width="56" height="14" viewBox="0 0 56 14" className="shrink-0">
                  <line
                    x1="6"
                    y1="7"
                    x2="50"
                    y2="7"
                    style={{ stroke: toneColor.line }}
                    strokeWidth={1.5}
                    strokeDasharray={n.dash}
                    markerStart={n.source ? `url(#${markerId(n.source, "legend")})` : undefined}
                    markerEnd={n.target ? `url(#${markerId(n.target, "legend")})` : undefined}
                  />
                </svg>
                {t}
              </li>
            );
          })}
        </ul>
      </figure>
    </Panel>
  );
}
