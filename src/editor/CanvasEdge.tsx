"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { BaseEdge, getBezierPath, useStore, type EdgeProps } from "@xyflow/react";
import type { LayerBox } from "@/layout/bands";
import { labelPoint, layerTabRects, type Rect } from "./edgeLabel";

/** Where the layer names sit on the canvas, so edge labels can stay clear of them. */
export const LabelObstaclesContext = createContext<Rect[]>([]);

/** React Flow's bezier edge, with its label moved along the line when it would cover a layer name. */
export function CanvasEdge(props: EdgeProps) {
  const obstacles = useContext(LabelObstaclesContext);
  const [path, midX, midY] = getBezierPath(props);
  const text = typeof props.label === "string" ? props.label : "";
  const at = labelPoint(path, text, obstacles, { x: midX, y: midY });
  return (
    <BaseEdge
      id={props.id}
      path={path}
      labelX={at.x}
      labelY={at.y}
      label={props.label}
      labelStyle={props.labelStyle}
      labelShowBg={props.labelShowBg}
      labelBgStyle={props.labelBgStyle}
      labelBgPadding={props.labelBgPadding}
      labelBgBorderRadius={props.labelBgBorderRadius}
      style={props.style}
      markerStart={props.markerStart}
      markerEnd={props.markerEnd}
      interactionWidth={props.interactionWidth}
    />
  );
}

/**
 * Provides the layer name positions to the edges. Only this provider follows the zoom (tabs keep a
 * constant on-screen size), so zooming re-renders the edges, not the whole editor.
 */
export function LabelObstacles({ boxes, tabsAbove, show, children }: { boxes: LayerBox[]; tabsAbove: boolean; show: boolean; children: ReactNode }) {
  const zoom = useStore((s) => s.transform[2]);
  const rects = useMemo(() => (show ? layerTabRects(boxes, zoom, tabsAbove) : []), [show, boxes, zoom, tabsAbove]);
  return <LabelObstaclesContext.Provider value={rects}>{children}</LabelObstaclesContext.Provider>;
}
