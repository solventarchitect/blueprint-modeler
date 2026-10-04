"use client";

import { useViewport, ViewportPortal } from "@xyflow/react";
import { ARTIFACT_ICON_PATH } from "@/io/icons";
import type { LayerBox } from "@/layout/bands";
import { formatModelDate, UNTITLED_MODEL } from "@/model";

/** Title size in canvas units, and the smallest it may look on screen when zoomed out. */
const SIZE = 28;
const MIN_ON_SCREEN = 18;
/** Space between the title and the highest element (or its layer box tab), in screen pixels. */
const GAP = 12;
/** Height of a layer box tab on screen, when the tab sits above its box (see LayerOverlay). */
const TAB = 24;

/**
 * Room to leave above the diagram when fitting it, in screen pixels: the title block's height at
 * the zoom the fit will land on (the block never shrinks below MIN_ON_SCREEN), plus its gap and a
 * layer tab. The block is about 60 canvas units with the reference line and name, 137 with a
 * three-line description.
 */
export function titleRoom(hasDescription: boolean, zoomAfterFit: number): number {
  const units = hasDescription ? 137 : 60;
  const scale = Math.max(1, MIN_ON_SCREEN / (SIZE * zoomAfterFit));
  return Math.ceil(units * zoomAfterFit * scale + GAP + TAB + 8);
}

/** The Artifact ID icon (a tag), named for screen readers so the ID is announced with its meaning. */
export function ArtifactIcon({ className = "size-4", label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <path d={ARTIFACT_ICON_PATH} />
    </svg>
  );
}

/**
 * The model's title block on the canvas: its Artifact ID (with a tag icon) and date, name and
 * description, the optional parts only when set. Left-aligned with the leftmost element and just above the
 * highest one, so it follows the diagram as elements move; it grows upward from that corner, so it
 * never covers an element, and it keeps a readable size when zoomed out.
 */
export function CanvasTitle({
  name,
  date,
  description,
  artifactId,
  boxes,
  tabsAbove,
  decorative,
}: {
  name: string;
  /** YYYY-MM-DD. */
  date: string;
  description?: string;
  artifactId?: string;
  boxes: LayerBox[];
  tabsAbove: boolean;
  decorative: boolean;
}) {
  const { zoom } = useViewport();
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  // The description wraps at the diagram's width (at least 480 units, at most 680), so it never
  // reaches far past the elements a fit makes room for.
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const aboutWidth = Math.min(680, Math.max(480, right - left));
  const scale = Math.max(1, MIN_ON_SCREEN / (SIZE * zoom));
  const bottom = top - (GAP + (tabsAbove ? TAB : 0)) / zoom;
  const Tag = decorative ? "p" : "h1";
  return (
    <ViewportPortal>
      <div
        className="pointer-events-none absolute top-0 left-0"
        style={{ transform: `translate(${left}px, ${bottom}px) scale(${scale})`, transformOrigin: "0 0", zIndex: -1 }}
      >
        <div data-testid="canvas-title-block" aria-hidden={decorative || undefined} className="absolute bottom-0 left-0 flex flex-col">
          <p className="mb-1.5 flex items-center gap-1.5 font-mono tracking-[0.04em] whitespace-nowrap text-ink-muted" style={{ fontSize: 14 }}>
            {artifactId && (
              <>
                <ArtifactIcon className="size-[1.1em]" label="Artifact ID" />
                <span data-testid="canvas-artifact">{artifactId}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <time data-testid="canvas-date" dateTime={date}>
              {formatModelDate(date)}
            </time>
          </p>
          <Tag
            data-testid="canvas-title"
            className={`font-semibold tracking-tight whitespace-nowrap ${name ? "text-ink" : "text-ink-muted"}`}
            style={{ fontSize: SIZE, lineHeight: 1.15 }}
          >
            {name || UNTITLED_MODEL}
          </Tag>
          {description && (
            <p data-testid="canvas-description" className="mt-2 line-clamp-3 text-ink-soft" style={{ fontSize: 16, lineHeight: 1.45, width: "max-content", maxWidth: aboutWidth }}>
              {description}
            </p>
          )}
        </div>
      </div>
    </ViewportPortal>
  );
}
