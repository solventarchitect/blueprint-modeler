"use client";

import { Handle, Position, useViewport, ViewportPortal, type Node, type NodeProps } from "@xyflow/react";
import type { Frame } from "@/layout/groupLayout";

/**
 * Group frames (M56): a frame around each group's elements, drawn in flow coordinates behind the
 * edges and nodes like the layer boxes, with a tab on its top edge naming the group. The tab is a
 * button that collapses the group into one block (aria-expanded), readable at any zoom; the canvas
 * brings a tab into view when it gets focus.
 */
export function GroupOverlay({ frames, onToggle, onFocusTab, kind }: { frames: Frame[]; onToggle: (key: string) => void; onFocusTab?: (f: Frame, el: HTMLElement) => void; kind: string }) {
  const { zoom } = useViewport();
  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute top-0 left-0" style={{ zIndex: -1 }}>
        {frames.map((f) => (
          <div key={f.key} data-testid="group-frame" data-group={f.key}>
            <div className="bm-group-frame absolute" style={{ transform: `translate(${f.x}px, ${f.y}px)`, width: f.w, height: f.h }} />
            <button
              type="button"
              aria-expanded="true"
              aria-label={`${kind} ${f.label}, ${f.count} element${f.count === 1 ? "" : "s"}: collapse`}
              title="Collapse into one block"
              className="bm-group-tab pointer-events-auto absolute flex cursor-pointer items-center gap-1 whitespace-nowrap"
              // The tab keeps its size on screen, sitting on the frame's top edge.
              style={{ transform: `translate(${f.x}px, ${f.y}px) scale(${1 / zoom}) translateY(-100%)`, transformOrigin: "0 0", maxWidth: Math.max(f.w * zoom, 96) }}
              onClick={() => onToggle(f.key)}
              onFocus={(e) => onFocusTab?.(f, e.currentTarget)}
            >
              <span aria-hidden="true" className="shrink-0">▾</span>
              <span className="min-w-0 truncate">{f.label}</span>
              <span aria-hidden="true" className="shrink-0 opacity-70">
                · {f.count}
              </span>
            </button>
          </div>
        ))}
      </div>
    </ViewportPortal>
  );
}

export type GroupNodeData = { label: string; kind: string; count: number; groupKey: string; onExpand: () => void };
export type GroupFlowNode = Node<GroupNodeData, "group">;

/**
 * A collapsed group (M56): one block standing for its elements, where its frame began. Relationships
 * to its elements from outside run to it (dashed). Its Expand button opens the group again.
 */
export function GroupNode({ data }: NodeProps<GroupFlowNode>) {
  const hidden = "!pointer-events-none !opacity-0";
  return (
    <div className="bm-group-node flex w-56 flex-col gap-1 px-3 py-2.5" data-testid="group-node" data-group={data.groupKey}>
      {(["top", "right", "bottom", "left"] as const).map((s) => (
        <Handle key={s} id={s} type="source" position={Position[(s.charAt(0).toUpperCase() + s.slice(1)) as "Top"]} isConnectable={false} className={hidden} />
      ))}
      <span className="font-mono text-[0.65rem] tracking-[0.12em] text-ink-muted uppercase">{data.kind} group</span>
      <span className="text-sm font-medium text-ink">{data.label}</span>
      <span className="flex items-center justify-between gap-2 text-xs text-ink-muted">
        {data.count} element{data.count === 1 ? "" : "s"}, collapsed
        <button
          type="button"
          className="nodrag cursor-pointer border border-border-strong px-1.5 py-0.5 text-xs text-ink hover:border-accent hover:text-accent"
          aria-expanded="false"
          aria-label={`Expand ${data.kind} ${data.label}`}
          onClick={data.onExpand}
        >
          Expand
        </button>
      </span>
    </div>
  );
}
