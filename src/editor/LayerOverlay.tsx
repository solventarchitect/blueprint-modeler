"use client";

import { useViewport, ViewportPortal } from "@xyflow/react";
import type { Layer } from "@/metamodel";
import type { Lane, LayerBox } from "@/layout/bands";

/** Layer color roles (same as the nodes' left bars), for boxes and lanes. */
export const layerColor: Record<Layer, string> = {
  business: "var(--status)",
  design: "var(--accent)",
  service: "var(--ai)",
  functional: "var(--ink-muted)",
  infrastructure: "var(--border-strong)",
};

/** Label text colors: the layer color, except the two neutral layers, whose gray is too light for text over its own tint. */
const labelColor: Record<Layer, string> = { ...layerColor, functional: "var(--ink-soft)", infrastructure: "var(--ink-soft)" };

const LANE_SPAN = 200_000;

/**
 * Translucent layer boxes and full-width lanes, drawn in flow coordinates behind edges and nodes.
 * Decorative: pointer events pass through, and every element is aria-hidden (the node labels
 * already name each element's class). With lanes on, the lane labels name the layers, so boxes drop
 * theirs rather than repeat them.
 */
export function LayerOverlay({ boxes, lanes, showBoxes, showLanes }: { boxes: LayerBox[]; lanes: Lane[]; showBoxes: boolean; showLanes: boolean }) {
  const { x, zoom } = useViewport();
  const visibleLeft = -x / zoom;
  return (
    <ViewportPortal>
      <div aria-hidden="true" className="pointer-events-none absolute top-0 left-0" style={{ zIndex: -1 }}>
        {showLanes &&
          lanes.map((l, i) => (
            <div
              key={l.layer}
              data-testid="layer-lane"
              className="absolute"
              style={{
                transform: `translate(${-LANE_SPAN / 2}px, ${l.top}px)`,
                width: LANE_SPAN,
                height: l.bottom - l.top,
                background: i % 2 === 0 ? `color-mix(in oklab, ${layerColor[l.layer]} 5%, transparent)` : "transparent",
                borderTop: i === 0 ? "none" : `1px dashed color-mix(in oklab, ${layerColor[l.layer]} 45%, transparent)`,
              }}
            >
              <span
                data-testid="layer-lane-label"
                className="absolute font-mono text-[11px] tracking-[0.14em] uppercase"
                style={{ left: LANE_SPAN / 2 + visibleLeft + 12 / zoom, top: 6, color: labelColor[l.layer], transform: `scale(${1 / zoom})`, transformOrigin: "0 0" }}
              >
                {l.name}
              </span>
            </div>
          ))}
        {showBoxes &&
          boxes.map((b) => (
            <div
              key={b.layer}
              data-testid="layer-box"
              className="absolute rounded-md"
              style={{
                transform: `translate(${b.x}px, ${b.y}px)`,
                width: b.w,
                height: b.h,
                background: `color-mix(in oklab, ${layerColor[b.layer]} 8%, transparent)`,
                border: `1px solid color-mix(in oklab, ${layerColor[b.layer]} 40%, transparent)`,
              }}
            >
              {!showLanes && (
                <span data-testid="layer-box-label" className="absolute top-1.5 left-3 font-mono text-[10px] tracking-[0.14em] uppercase" style={{ color: labelColor[b.layer] }}>
                  {b.name}
                </span>
              )}
            </div>
          ))}
      </div>
    </ViewportPortal>
  );
}
