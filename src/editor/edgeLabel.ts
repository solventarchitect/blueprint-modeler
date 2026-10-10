import type { LayerBox } from "@/layout/bands";
import { pointOnPath } from "@/layout/edgePath";

/** An axis-aligned rectangle in canvas (flow) units. */
export type Rect = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };

/** Edge label box size in canvas units (11px mono text on a padded background; see globals.css). */
const CHAR = 6.7;
const PAD = 6;
const HEIGHT = 16;

/** Layer name tabs, in canvas units, as LayerOverlay draws them (keep the two in step). */
const TAB_CHAR = 7.5; // 10px mono, uppercase, 0.14em tracking
const TAB_PAD = 12;
const TAB_HEIGHT = 24;

/**
 * Where each layer's name sits: a tab of constant on-screen size above the box's top-left corner
 * while editing, or small text inside that corner otherwise (presenting, small screens).
 */
export function layerTabRects(boxes: LayerBox[], zoom: number, tabsAbove: boolean): Rect[] {
  return boxes.map((b) =>
    tabsAbove
      ? { x: b.x + 4 / zoom, y: b.y - TAB_HEIGHT / zoom, w: (b.name.length * TAB_CHAR + TAB_PAD) / zoom, h: TAB_HEIGHT / zoom }
      : { x: b.x + 12, y: b.y + 6, w: b.name.length * TAB_CHAR, h: 14 },
  );
}

/** A point a fraction along an edge's path, whatever its style (curved or right angles). */
export const pointOnCubic = (path: string, t: number): Point | null => pointOnPath(path, t);

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Positions along the edge to try, nearest the middle first. Near the ends, a label sits inside an element's layer box, clear of tabs. */
const TRIES = [0.5, 0.36, 0.64, 0.26, 0.74, 0.18, 0.82, 0.12, 0.88];

/**
 * The label position for an edge: its middle, unless the label would cover a layer name, in which
 * case the nearest point along the edge where it is clear. When no point is clear (tabs are large
 * in canvas units when zoomed far out), the point where it covers least.
 */
export function labelPoint(path: string, label: string, obstacles: Rect[], middle: Point): Point {
  if (!label || obstacles.length === 0) return middle;
  const w = label.length * CHAR + 2 * PAD;
  let best = middle;
  let least = Infinity;
  for (const t of TRIES) {
    const p = t === 0.5 ? middle : pointOnCubic(path, t);
    if (!p) return middle;
    const box = { x: p.x - w / 2, y: p.y - HEIGHT / 2, w, h: HEIGHT };
    const covered = obstacles.reduce((sum, o) => sum + overlap(box, o), 0);
    if (covered === 0) return p;
    if (covered < least) [best, least] = [p, covered];
  }
  return best;
}
