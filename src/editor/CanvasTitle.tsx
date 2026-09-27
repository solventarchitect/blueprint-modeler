"use client";

import { useViewport, ViewportPortal } from "@xyflow/react";
import type { LayerBox } from "@/layout/bands";

/** Title size in canvas units, and the smallest it may look on screen when zoomed out. */
const SIZE = 28;
const MIN_ON_SCREEN = 18;
/** Space between the title and the highest element (or its layer box tab), in screen pixels. */
const GAP = 12;
/** Height of a layer box tab on screen, when the tab sits above its box (see LayerOverlay). */
const TAB = 24;

/**
 * The model's name as a header on the canvas: left-aligned with the leftmost element and just
 * above the highest one, so it follows the diagram as elements move. It grows upward from that
 * corner, so it never covers an element, and it keeps a readable size when zoomed out.
 */
export function CanvasTitle({ name, boxes, tabsAbove, decorative }: { name: string; boxes: LayerBox[]; tabsAbove: boolean; decorative: boolean }) {
  const { zoom } = useViewport();
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const scale = Math.max(1, MIN_ON_SCREEN / (SIZE * zoom));
  const bottom = top - (GAP + (tabsAbove ? TAB : 0)) / zoom;
  const Tag = decorative ? "p" : "h1";
  return (
    <ViewportPortal>
      <div
        className="pointer-events-none absolute top-0 left-0"
        style={{ transform: `translate(${left}px, ${bottom}px) scale(${scale})`, transformOrigin: "0 0", zIndex: -1 }}
      >
        <Tag
          data-testid="canvas-title"
          aria-hidden={decorative || undefined}
          className={`absolute bottom-0 left-0 font-semibold tracking-tight whitespace-nowrap ${name ? "text-ink" : "text-ink-muted"}`}
          style={{ fontSize: SIZE, lineHeight: 1.15 }}
        >
          {name || "Untitled model"}
        </Tag>
      </div>
    </ViewportPortal>
  );
}
