"use client";

import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
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

/** What the canvas does with a layer's handle (a box or lane label) when editing is possible. */
export type LayerHandlers = {
  selected: Layer | null;
  onPointerDown: (layer: Layer, e: PointerEvent<HTMLElement>) => void;
  onClick: (layer: Layer, e: MouseEvent<HTMLElement>) => void;
  onKeyDown: (layer: Layer, e: KeyboardEvent<HTMLElement>) => void;
  onContextMenu: (layer: Layer, e: MouseEvent<HTMLElement>) => void;
};

export const layerHandleId = (layer: Layer) => `layer-handle-${layer}`;
const HELP_ID = "layer-handle-help";

/**
 * Translucent layer boxes and full-width lanes, drawn in flow coordinates behind edges and nodes.
 * The boxes and bands are decorative. Each layer's label is a handle when editing is possible:
 * press it to select the layer, drag it (or the selected box) to move the layer with everything in
 * it, or use the arrow keys. With lanes on, the lane labels are the handles, so boxes drop theirs.
 */
export function LayerOverlay({
  boxes,
  lanes,
  showBoxes,
  showLanes,
  handlers,
}: {
  boxes: LayerBox[];
  lanes: Lane[];
  showBoxes: boolean;
  showLanes: boolean;
  /** Absent while presenting or on small screens: labels are plain text then. */
  handlers?: LayerHandlers;
}) {
  const { x, y, zoom } = useViewport();
  const visibleLeft = -x / zoom;
  const visibleTop = -y / zoom;
  const count = (layer: Layer) => boxes.find((b) => b.layer === layer)?.nodeIds.length ?? 0;

  const handle = (layer: Layer, name: string, extra: string) =>
    handlers ? (
      <button
        type="button"
        id={layerHandleId(layer)}
        data-testid="layer-handle"
        aria-pressed={handlers.selected === layer}
        aria-label={`${name} layer, ${count(layer)} element${count(layer) === 1 ? "" : "s"}`}
        aria-describedby={HELP_ID}
        className={`nopan nodrag nowheel pointer-events-auto absolute flex min-h-6 cursor-grab items-center px-1.5 font-mono tracking-[0.14em] uppercase active:cursor-grabbing hover:bg-surface-raised focus-visible:bg-surface-raised ${
          handlers.selected === layer ? "bg-surface-raised ring-2 ring-accent" : ""
        } ${extra}`}
        style={{ color: labelColor[layer] }}
        onPointerDown={(e) => handlers.onPointerDown(layer, e)}
        onClick={(e) => handlers.onClick(layer, e)}
        onKeyDown={(e) => handlers.onKeyDown(layer, e)}
        onContextMenu={(e) => handlers.onContextMenu(layer, e)}
      >
        {name}
      </button>
    ) : (
      <span aria-hidden="true" className={`absolute font-mono tracking-[0.14em] uppercase ${extra}`} style={{ color: labelColor[layer] }}>
        {name}
      </span>
    );

  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute top-0 left-0" style={{ zIndex: -1 }}>
        {handlers && (
          <p id={HELP_ID} className="sr-only">
            Press to select the layer. Drag it, or use the arrow keys, to move the layer with everything in it; Shift with an arrow moves it further. Shift+F10 opens its menu.
          </p>
        )}
        {showLanes &&
          lanes.map((l, i) => (
            <div
              key={l.layer}
              data-testid="layer-lane"
              className="absolute"
              style={{
                transform: l.columns ? `translate(${l.start}px, ${-LANE_SPAN / 2}px)` : `translate(${-LANE_SPAN / 2}px, ${l.start}px)`,
                width: l.columns ? l.end - l.start : LANE_SPAN,
                height: l.columns ? LANE_SPAN : l.end - l.start,
                background:
                  handlers?.selected === l.layer
                    ? `color-mix(in oklab, ${layerColor[l.layer]} 14%, transparent)`
                    : i % 2 === 0
                      ? `color-mix(in oklab, ${layerColor[l.layer]} 5%, transparent)`
                      : "transparent",
                [l.columns ? "borderLeft" : "borderTop"]: i === 0 ? "none" : `1px dashed color-mix(in oklab, ${layerColor[l.layer]} 45%, transparent)`,
              }}
            >
              {/* The label sits at the visible edge of the lane: the left of the view for a row, the top for a column. */}
              <div
                data-testid="layer-lane-label"
                className="absolute text-[11px]"
                style={
                  l.columns
                    ? { left: 6, top: LANE_SPAN / 2 + visibleTop + 12 / zoom, transform: `scale(${1 / zoom})`, transformOrigin: "0 0" }
                    : { left: LANE_SPAN / 2 + visibleLeft + 12 / zoom, top: 6, transform: `scale(${1 / zoom})`, transformOrigin: "0 0" }
                }
              >
                {handle(l.layer, l.name, "left-0 top-0 whitespace-nowrap")}
              </div>
            </div>
          ))}
        {showBoxes &&
          boxes.map((b) => {
            const selected = handlers?.selected === b.layer;
            return (
              <div
                key={b.layer}
                data-testid="layer-box"
                aria-hidden="true"
                className={`absolute rounded-md ${selected ? "nopan nodrag pointer-events-auto cursor-move" : ""}`}
                style={{
                  transform: `translate(${b.x}px, ${b.y}px)`,
                  width: b.w,
                  height: b.h,
                  background: `color-mix(in oklab, ${layerColor[b.layer]} ${selected ? 14 : 8}%, transparent)`,
                  border: selected ? "2px solid var(--accent)" : `1px solid color-mix(in oklab, ${layerColor[b.layer]} 40%, transparent)`,
                }}
                onPointerDown={selected && handlers ? (e) => handlers.onPointerDown(b.layer, e) : undefined}
                onContextMenu={selected && handlers ? (e) => handlers.onContextMenu(b.layer, e) : undefined}
              />
            );
          })}
        {showBoxes &&
          !showLanes &&
          boxes.map((b) => (
            <div
              key={b.layer}
              data-testid="layer-box-label"
              className="absolute text-[10px]"
              style={{ transform: `translate(${b.x}px, ${b.y}px) scale(${handlers ? 1 / zoom : 1})`, transformOrigin: "0 0" }}
            >
              {/* A handle is kept at a constant on-screen size (24px targets), so it sits on top of the box like a tab. */}
              {handle(b.layer, b.name, handlers ? "left-1 bottom-0 whitespace-nowrap" : "left-3 top-1.5 whitespace-nowrap")}
            </div>
          ))}
      </div>
    </ViewportPortal>
  );
}
