import type { LayerBox } from "@/layout/bands";
import { flattenPath, pointAlong, pointOnPath } from "@/layout/edgePath";

/** An axis-aligned rectangle in canvas (flow) units. `weight` scales how much covering it costs (default 1). */
export type Rect = { x: number; y: number; w: number; h: number; weight?: number };
/** Covering another label costs this much more than covering an element: one hides two labels, the other reads through its background. */
export const LABEL_WEIGHT = 4;
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

/** The box a label occupies, centered on its point (the same metrics labelPoint tests against). */
export const labelBox = (p: Point, label: string): Rect => {
  const w = label.length * CHAR + 2 * PAD;
  return { x: p.x - w / 2, y: p.y - HEIGHT / 2, w, h: HEIGHT };
};

/** Whether two rectangles share any area. */
export const overlaps = (a: Rect, b: Rect) => overlap(a, b) > 0;

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Positions along the edge to try, nearest the middle first, every 4% out to 6% from either end (M50:
 * fine enough to find the gap between two element boxes a line runs through). Near the ends, a label
 * sits inside an element's layer box, clear of tabs.
 */
const TRIES = [0.5, ...Array.from({ length: 11 }, (_, i) => 0.04 * (i + 1)).flatMap((d) => [0.5 - d, 0.5 + d])];
/** Positions along the line for the beside-the-line fallback. */
const BESIDE = [0.5, 0.3, 0.7];

/**
 * The label position for an edge: its middle, unless the label would cover an obstacle (a layer name,
 * an element, another label), in which case the nearest point along the edge where it is clear. When
 * no point is clear, the point where it covers least, weighted: another label counts LABEL_WEIGHT times
 * an element (M50), so a crowded line lands on an element's edge rather than on a label.
 */
export function labelPoint(path: string, label: string, obstacles: Rect[], middle: Point): Point {
  if (!label || obstacles.length === 0) return middle;
  const w = label.length * CHAR + 2 * PAD;
  let best = middle;
  let least = Infinity;
  const flat = flattenPath(path); // Once per edge, then sampled for each try.
  if (!flat) return middle;
  const cost = (p: Point) => {
    const box = { x: p.x - w / 2, y: p.y - HEIGHT / 2, w, h: HEIGHT };
    return obstacles.reduce((sum, o) => sum + overlap(box, o) * (o.weight ?? 1), 0);
  };
  const consider = (p: Point) => {
    const covered = cost(p);
    if (covered === 0) return true;
    // A clear margin, so floating-point noise never prefers a later try over the middle.
    if (covered < least - 1e-6) [best, least] = [p, covered];
    return false;
  };
  for (const t of TRIES) if (consider(t === 0.5 ? middle : pointAlong(flat, t))) return t === 0.5 ? middle : pointAlong(flat, t);
  // Nothing along the line is clear (a line too short for two labels, or lines converging on one
  // element): a spot beside the line, next to where a label on the line would be, at the middle then nearer the ends.
  for (const t of BESIDE) {
    const a = pointAlong(flat, Math.max(0, t - 0.05));
    const b = pointAlong(flat, Math.min(1, t + 0.05));
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
    const c = t === 0.5 ? middle : pointAlong(flat, t);
    // One label's extent away across the line, so it clears a label centered on the line.
    const off = Math.abs(n.x) * w + Math.abs(n.y) * HEIGHT + 2;
    for (const sign of [1, -1]) {
      const p = { x: c.x + sign * n.x * off, y: c.y + sign * n.y * off };
      if (consider(p)) return p;
    }
  }
  return best;
}

/**
 * Label positions for a whole picture (M50): each edge, shortest line first, keeps clear of the fixed
 * obstacles (element boxes) and of the labels placed before it, so labels avoid each other too. The
 * result is in planning order (the canvas treats earlier entries as obstacles for later ones).
 * `span` is the straight distance between the line's ends. The canvas and the exports both use it.
 */
export function planLabels(items: { id: string; path: string; label: string; middle: Point; span: number }[], fixed: Rect[]): { id: string; at: Point; box: Rect }[] {
  const placed: { id: string; at: Point; box: Rect }[] = [];
  // Short lines first: they have the fewest places to go, so a long line sharing their middle moves instead.
  const order = items.map((it, i) => ({ it, i })).sort((a, b) => a.it.span - b.it.span || a.i - b.i);
  for (const { it } of order) {
    const at = it.label ? labelPoint(it.path, it.label, [...fixed, ...placed.filter((p) => p.box.w > 0).map((p) => ({ ...p.box, weight: LABEL_WEIGHT }))], it.middle) : it.middle;
    // No label: nothing occupies the spot.
    placed.push({ id: it.id, at, box: it.label ? labelBox(at, it.label) : { x: at.x, y: at.y, w: 0, h: 0 } });
  }
  return placed;
}
