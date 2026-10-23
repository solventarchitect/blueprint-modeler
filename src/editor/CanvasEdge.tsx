"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { BaseEdge, Position, useStore, type EdgeProps } from "@xyflow/react";
import type { LayerBox } from "@/layout/bands";
import { edgePath, type LineStyle } from "@/layout/edgePath";
import type { Side } from "@/layout/geometry";
import { labelPoint, layerTabRects, planLabels, type Rect } from "@/layout/edgeLabel";

/** Where the layer names sit on the canvas, so edge labels can stay clear of them. */
export const LabelObstaclesContext = createContext<Rect[]>([]);
/** What the label plan needs from the editor (M50): each edge's line and label, and the element boxes. */
export type LabelPlanInput = { items: { id: string; path: string; label: string; middle: { x: number; y: number }; span: number }[]; nodes: Rect[] };
/** Where each edge's label is planned to sit, shortest line first, clear of elements, layer names and earlier labels (M50). */
export const LabelPlanContext = createContext<{ id: string; at: { x: number; y: number }; box: Rect }[]>([]);
/** How relationships are drawn (View › Line style). */
export const LineStyleContext = createContext<LineStyle>("curved");

const sideOf = (p: Position | undefined): Side => (p === Position.Top ? "top" : p === Position.Left ? "left" : p === Position.Right ? "right" : "bottom");

/** A relationship in the chosen line style, with its label at the planned spot (clear of layer names, elements and other labels). */
export function CanvasEdge(props: EdgeProps) {
  const tabs = useContext(LabelObstaclesContext);
  const plan = useContext(LabelPlanContext);
  const style = useContext(LineStyleContext);
  const { path, label: mid } = edgePath(
    { x: props.sourceX, y: props.sourceY, side: sideOf(props.sourcePosition) },
    { x: props.targetX, y: props.targetY, side: sideOf(props.targetPosition) },
    style,
  );
  const text = typeof props.label === "string" ? props.label : "";
  // The planned spot; an edge the plan does not know (none while labels are off) keeps off the layer names itself.
  const at = plan.find((l) => l.id === props.id)?.at ?? labelPoint(path, text, tabs, mid);
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
 * Provides the layer name positions and the label plan to the edges. Only this provider follows the
 * zoom (tabs keep a constant on-screen size), so zooming re-plans and re-renders the edges, not the
 * whole editor. The plan runs here so it can keep labels off the tabs too, and every edge then draws
 * exactly the planned spot (M50): no edge places its label on its own, so none can land on another.
 */
export function LabelObstacles({ boxes, tabsAbove, show, plan, children }: { boxes: LayerBox[]; tabsAbove: boolean; show: boolean; plan: LabelPlanInput; children: ReactNode }) {
  const zoom = useStore((s) => s.transform[2]);
  const rects = useMemo(() => (show ? layerTabRects(boxes, zoom, tabsAbove) : []), [show, boxes, zoom, tabsAbove]);
  const planned = useMemo(() => (plan.items.length ? planLabels(plan.items, [...plan.nodes, ...rects]) : []), [plan, rects]);
  return (
    <LabelObstaclesContext.Provider value={rects}>
      <LabelPlanContext.Provider value={planned}>{children}</LabelPlanContext.Provider>
    </LabelObstaclesContext.Provider>
  );
}
