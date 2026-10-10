"use client";

import { Position, type ConnectionLineComponentProps } from "@xyflow/react";
import { createContext, useContext } from "react";
import { edgePath } from "@/layout/edgePath";
import type { Side } from "@/layout/geometry";
import { LineStyleContext } from "./CanvasEdge";
import { allowedTypes } from "@/metamodel";
import type { Model } from "@/model";
import { connectionProblem } from "./state";

/** The model being edited, for judging a connection while it is still being dragged. */
export const ConnectionModelContext = createContext<Model | null>(null);

/** What the line should say over a target: the relationship it will create, or why it can't. */
export function connectionVerdict(model: Model, from: string, to: string): { ok: true; text: string } | { ok: false; text: string } {
  const problem = connectionProblem(model, from, to);
  if (problem) return { ok: false, text: problem };
  const a = model.nodes.find((n) => n.id === from)!;
  const b = model.nodes.find((n) => n.id === to)!;
  return { ok: true, text: allowedTypes(a.class, b.class)[0]! };
}

/**
 * The line drawn while connecting: accent while searching, green with ✓ and the relationship type
 * over a valid target, red and dashed with ✕ and the reason over an invalid one — before release.
 */
export function ConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition, fromNode, toNode, connectionStatus }: ConnectionLineComponentProps) {
  const model = useContext(ConnectionModelContext);
  const style = useContext(LineStyleContext);
  const sideOf = (p: Position | undefined): Side => (p === Position.Top ? "top" : p === Position.Left ? "left" : p === Position.Right ? "right" : "bottom");
  const { path } = edgePath({ x: fromX, y: fromY, side: sideOf(fromPosition) }, { x: toX, y: toY, side: sideOf(toPosition) }, style);
  const verdict = model && toNode ? connectionVerdict(model, fromNode.id, toNode.id) : null;
  const status = verdict ? (verdict.ok ? "valid" : "invalid") : (connectionStatus ?? "searching");
  const color = status === "valid" ? "var(--valid)" : status === "invalid" ? "var(--invalid)" : "var(--accent)";
  const label = verdict ? `${verdict.ok ? "✓" : "✕"} ${verdict.text}` : null;
  const width = label ? Math.min(label.length * 6.4 + 16, 520) : 0;

  return (
    <g className="bm-connection" data-status={status}>
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeDasharray={status === "invalid" ? "6 4" : undefined} className="react-flow__connection-path" />
      <circle cx={toX} cy={toY} r={4} fill={color} />
      {label && (
        <g transform={`translate(${toX + 12} ${toY - 26})`} data-testid="connection-verdict">
          <rect width={width} height={22} rx={3} fill="var(--surface-raised)" stroke={color} />
          <text x={8} y={15} fontSize={12} fill={color} fontFamily="var(--font-sans)">
            {label.length > 80 ? `${label.slice(0, 79)}…` : label}
          </text>
        </g>
      )}
    </g>
  );
}
