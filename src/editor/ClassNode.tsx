"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { classById } from "@/metamodel";

export type ClassNodeData = { name: string; cls: string };
export type ClassFlowNode = Node<ClassNodeData, "csdm">;

const layerAccent: Record<string, string> = {
  business: "border-l-status",
  design: "border-l-accent",
  service: "border-l-ai",
  functional: "border-l-ink-muted",
  infrastructure: "border-l-border-strong",
};

/** One CSDM element on the canvas. Handles top and bottom; connection mode is loose. */
function ClassNodeView({ data, selected }: NodeProps<ClassFlowNode>) {
  const def = classById(data.cls);
  return (
    <div
      className={`w-52 border border-border-strong border-l-4 bg-surface-raised px-3 py-2 text-left shadow-none ${
        layerAccent[def?.layer ?? "design"]
      } ${selected ? "outline-2 outline-offset-2 outline-accent" : ""}`}
    >
      <Handle id="top" type="source" position={Position.Top} className="!size-2.5 !border-accent !bg-surface" />
      <p className="font-mono text-[0.65rem] tracking-[0.12em] text-ink-muted uppercase">{def?.label ?? data.cls}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-ink">{data.name || "Untitled"}</p>
      <Handle id="bottom" type="source" position={Position.Bottom} className="!size-2.5 !border-accent !bg-surface" />
    </div>
  );
}

export const ClassNode = memo(ClassNodeView);
