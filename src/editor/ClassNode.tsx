"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { ArchimateGlyph } from "@/frameworks/ArchimateGlyph";
import type { ArchimateElementType } from "@/frameworks";
import { classById } from "@/metamodel";
import { layerAccent } from "./layerAccent";

export type ClassNodeData = {
  name: string;
  cls: string;
  hint?: "warning" | "info";
  highlight?: boolean;
  /** The element this class maps to under the active framework lens. */
  alt?: { type: ArchimateElementType; label: string };
};
export type ClassFlowNode = Node<ClassNodeData, "csdm">;

/** One CSDM element on the canvas. Handles on all four sides; connection mode is loose. */
function ClassNodeView({ data, selected }: NodeProps<ClassFlowNode>) {
  const def = classById(data.cls);
  const ring = data.highlight ? "ring-2 ring-status ring-offset-2 ring-offset-surface" : selected ? "outline-2 outline-offset-2 outline-accent" : "";
  return (
    <div className={`relative w-56 border border-border-strong border-l-4 bg-surface-raised px-3 py-2.5 text-left ${layerAccent[def?.layer ?? "design"]} ${ring}`}>
      <Handle id="top" type="source" position={Position.Top} className="!size-2.5 !border-accent !bg-surface" />
      <p className="font-mono text-[0.65rem] tracking-[0.12em] text-ink-muted uppercase">{def?.label ?? data.cls}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-ink">{data.name || "Untitled"}</p>
      {data.alt && (
        <p className="mt-1.5 flex items-center gap-1.5 border-t border-border pt-1.5 font-mono text-[0.65rem] tracking-[0.04em] text-ai" data-testid="lens-label">
          <ArchimateGlyph type={data.alt.type} />
          <span className="truncate">{data.alt.label}</span>
        </p>
      )}
      {data.hint && (
        <span
          aria-hidden="true"
          className={`absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full font-mono text-[0.7rem] font-semibold ${
            data.hint === "warning" ? "bg-status text-accent-ink" : "border border-border-strong bg-surface text-ink-muted"
          }`}
        >
          {data.hint === "warning" ? "!" : "i"}
        </span>
      )}
      <Handle id="bottom" type="source" position={Position.Bottom} className="!size-2.5 !border-accent !bg-surface" />
      <Handle id="left" type="source" position={Position.Left} className="!size-2.5 !border-accent !bg-surface" />
      <Handle id="right" type="source" position={Position.Right} className="!size-2.5 !border-accent !bg-surface" />
    </div>
  );
}

export const ClassNode = memo(ClassNodeView);
