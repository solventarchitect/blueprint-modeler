"use client";

import { Handle, NodeToolbar, Position, useConnection, useInternalNode, useStore, useViewport, type Node, type NodeProps } from "@xyflow/react";
import { createContext, memo, useContext, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArchimateGlyph } from "@/frameworks/ArchimateGlyph";
import type { ArchimateElementType, ArchimateLayer } from "@/frameworks";
import { classById } from "@/metamodel";
import { ConnectionModelContext } from "./ConnectionLine";
import { layerAccent } from "./layerAccent";
import { connectionProblem } from "./state";
import { suggestionDetail, suggestionLabel, type Suggestion } from "./suggest";

export type ClassNodeData = {
  name: string;
  cls: string;
  hint?: "warning" | "info";
  highlight?: boolean;
  /** Directly connected to the selected element. */
  neighbor?: boolean;
  description?: string;
  /** The element this class maps to under the active framework lens. */
  alt?: { type: ArchimateElementType; label: string; layer: ArchimateLayer };
  /** ArchiMate-only lens: the ArchiMate element type heads the element, and CSDM names are hidden. */
  archimateOnly?: boolean;
  /** Offer relationship suggestions (editing, and the element has no relationships yet). */
  suggest?: boolean;
  /** Reached by the open blast radius: the start (hop 0) or an element reached at `hop`. */
  blast?: { hop: number; current: boolean; impact: boolean };
};

/** ArchiMate-only lens: the element's fill follows its ArchiMate layer (tokens in globals.css). */
const archimateBg: Record<ArchimateLayer, string> = {
  Motivation: "bg-am-motivation",
  Strategy: "bg-am-strategy",
  Business: "bg-am-business",
  Application: "bg-am-application",
  Technology: "bg-am-technology",
  Physical: "bg-am-technology",
  "Implementation & Migration": "bg-am-implementation",
  Other: "bg-surface-raised",
};

const CARD_WIDTH = 256; // w-64
const CARD_OFFSET = 12;

/** Suggestions for an element with no relationships, and what choosing one does. */
export const SuggestContext = createContext<{
  list: (nodeId: string) => Suggestion[];
  pick: (nodeId: string, s: Suggestion) => void;
  dismiss: (nodeId: string) => void;
} | null>(null);

/**
 * The suggestion card beside an unconnected element: shown while it is selected or hovered, stays
 * while the pointer is over it, and closes with Escape or its close button (WCAG 1.4.13).
 */
function Suggestions({ id, name, visible, onHover }: { id: string; name: string; visible: boolean; onHover: (over: boolean) => void }) {
  const ctx = useContext(SuggestContext);
  const items = visible && ctx ? ctx.list(id) : [];
  // Keep the card inside the canvas: open downward from the top half and upward from the bottom
  // half, and on the left when there is no room on the right.
  const node = useInternalNode(id);
  const { x: vx, y: vy, zoom } = useViewport();
  const width = useStore((st) => st.width);
  const height = useStore((st) => st.height);
  const pos = node?.internals.positionAbsolute ?? { x: 0, y: 0 };
  const low = pos.y * zoom + vy > height / 2;
  const left = pos.x * zoom + vx;
  const fitsRight = left + (node?.measured.width ?? 224) * zoom + CARD_OFFSET + CARD_WIDTH <= width;
  const fitsLeft = left - CARD_OFFSET - CARD_WIDTH >= 0;
  // Zoomed in so far that neither side has room: above or below the element instead.
  const side = fitsRight ? Position.Right : fitsLeft ? Position.Left : low ? Position.Top : Position.Bottom;
  const align = side === Position.Top || side === Position.Bottom ? "start" : low ? "end" : "start";
  // The list scrolls when the card would run past the canvas edge it opens toward.
  const nodeTop = pos.y * zoom + vy;
  const nodeBottom = nodeTop + (node?.measured.height ?? 60) * zoom;
  const room = side === Position.Top ? nodeTop : side === Position.Bottom ? height - nodeBottom : low ? nodeBottom : height - nodeTop;
  const listMax = Math.max(120, room - CARD_OFFSET - 64);
  return (
    <NodeToolbar isVisible={visible && items.length > 0} position={side} align={align} offset={CARD_OFFSET}>
      <div
        role="group"
        aria-label={`Suggested relationships for ${name}`}
        data-testid="suggestions"
        className="nopan nodrag w-64 border border-border-strong bg-surface-raised p-2 shadow-lg"
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            ctx?.dismiss(id);
          }
        }}
      >
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="font-mono text-[0.65rem] tracking-[0.14em] text-ink-muted uppercase">Connect it</p>
          <button
            type="button"
            aria-label="Hide suggestions"
            className="flex size-6 cursor-pointer items-center justify-center text-ink-muted hover:text-ink"
            onClick={() => ctx?.dismiss(id)}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <ul className="mt-1 flex flex-col overflow-y-auto" style={{ maxHeight: listMax }}>
          {items.map((s) => (
            <li key={s.kind === "existing" ? s.nodeId : s.cls}>
              <button
                type="button"
                className="flex w-full cursor-pointer flex-col px-2 py-1.5 text-left hover:bg-surface focus-visible:bg-surface"
                onClick={() => ctx?.pick(id, s)}
              >
                <span className="text-sm text-ink">{suggestionLabel(s)}</span>
                <span className="font-mono text-[0.65rem] text-ink-muted">
                  {s.kind === "existing" ? `${s.classLabel} · ` : ""}
                  {suggestionDetail(s)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </NodeToolbar>
  );
}
export type ClassFlowNode = Node<ClassNodeData, "csdm">;

/** One CSDM element on the canvas. Handles on all four sides; connection mode is loose. */
function ClassNodeView({ id, data, selected, dragging }: NodeProps<ClassFlowNode>) {
  const def = classById(data.cls);
  // While a relationship is being drawn, mark every element it can be dropped on.
  const model = useContext(ConnectionModelContext);
  const fromId = useConnection((c) => (c.inProgress ? c.fromNode.id : null));
  const target = !!(fromId && model && fromId !== id && connectionProblem(model, fromId, id) === null);

  // Hover shows suggestions after a short pause; leaving waits briefly so the pointer can reach the card.
  const [hovered, setHovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hover = (over: boolean) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHovered(over), over ? 250 : 300);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  // Hovered (not while dragging or drawing): highlight, lifted above its neighbors so its description shows.
  const focus = hovered && !dragging && !fromId;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrapper = box.current?.closest<HTMLElement>(".react-flow__node");
    if (!wrapper) return;
    wrapper.style.zIndex = focus ? "1000" : "";
  }, [focus]);

  const blast = data.blast;
  const ring = target
    ? "outline-2 outline-dashed outline-offset-4 outline-valid"
    : blast
      ? `${blast.current ? "outline-[3px]" : "outline-2"} outline-offset-2 ${blast.hop > 0 ? "outline-status" : blast.impact ? "outline-invalid" : "outline-accent"} ${blast.current ? "blast-pulse" : ""}`
      : data.highlight
      ? "ring-2 ring-status ring-offset-2 ring-offset-surface"
      : selected
        ? "outline-2 outline-offset-2 outline-accent"
        : data.neighbor
          ? "outline-4 outline-offset-2 outline-neighbor"
          : focus
            ? "outline-2 outline-offset-2 outline-accent/70"
            : "";
  return (
    <div
      ref={box}
      className={`relative w-56 border border-border-strong border-l-4 px-3 py-2.5 text-left ${data.neighbor && !selected ? "bg-neighbor-tint" : data.archimateOnly && data.alt ? archimateBg[data.alt.layer] : "bg-surface-raised"} ${layerAccent[def?.layer ?? "design"]} ${ring} ${focus ? "shadow-lg" : ""}`}
      data-connect-target={target || undefined}
      data-neighbor={data.neighbor || undefined}
      data-archimate-layer={data.archimateOnly ? data.alt?.layer : undefined}
      data-hovered={focus || undefined}
      data-blast={blast ? (blast.hop === 0 ? "start" : "reached") : undefined}
      data-blast-hop={blast?.hop}
      data-blast-current={blast?.current || undefined}
      style={blast?.hop === 0 ? ({ "--pulse": blast.impact ? "var(--invalid)" : "var(--accent)" } as CSSProperties) : undefined}
      onMouseEnter={() => hover(true)}
      onMouseLeave={() => hover(false)}
    >
      {data.suggest && <Suggestions id={id} name={data.name || "Untitled"} visible={(selected || hovered) && !fromId && !dragging} onHover={hover} />}
      <Handle id="top" type="source" position={Position.Top} className="!size-2.5 !border-accent !bg-surface" />
      {data.archimateOnly && data.alt ? (
        // On a layer fill the type takes --am-ink (the purple AI ink falls below 4.5:1 on dark fills).
        <p
          className={`flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.12em] uppercase ${!data.neighbor || selected ? (data.alt.layer === "Other" ? "text-ai" : "text-am-ink") : "text-ai"}`}
          data-testid="archimate-type"
        >
          <ArchimateGlyph type={data.alt.type} />
          <span className="truncate">{data.alt.label}</span>
        </p>
      ) : (
        // Over the neighbor tint, the muted gray falls below 4.5:1; the softer ink keeps it readable.
        <p className={`font-mono text-[0.65rem] tracking-[0.12em] uppercase ${data.neighbor && !selected ? "text-ink-soft" : "text-ink-muted"}`}>{def?.label ?? data.cls}</p>
      )}
      <p className="mt-0.5 truncate text-sm font-medium text-ink">{data.name || "Untitled"}</p>
      {focus && data.description && (
        // Out of flow, so showing it never changes the element's measured size (edges and boxes stay put).
        <p data-testid="node-description" className="absolute top-full right-0 left-0 -mt-px border border-t-0 border-border-strong bg-surface-raised px-3 py-2 text-xs text-ink-soft">
          {data.description}
        </p>
      )}
      {data.alt && !data.archimateOnly && (
        <p className="mt-1.5 flex items-center gap-1.5 border-t border-border pt-1.5 font-mono text-[0.65rem] tracking-[0.04em] text-ai" data-testid="lens-label">
          <ArchimateGlyph type={data.alt.type} />
          <span className="truncate">{data.alt.label}</span>
        </p>
      )}
      {blast && (
        // The node's accessible name says the same ("affected at hop 2"), so the badge is hidden from it.
        <span
          aria-hidden="true"
          data-testid="blast-badge"
          className={`absolute -top-2.5 -left-2.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[0.7rem] font-semibold text-accent-ink ${
            blast.hop > 0 ? "bg-status" : blast.impact ? "bg-invalid" : "bg-accent"
          }`}
        >
          {blast.hop > 0 ? blast.hop : blast.impact ? "×" : "◎"}
        </span>
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
