import type { Side } from "./geometry";

/** How relationships are drawn: curves (the default) or horizontal and vertical runs with square corners. */
export type LineStyle = "curved" | "right-angles";
export const LINE_STYLES: LineStyle[] = ["curved", "right-angles"];

export type End = { x: number; y: number; side: Side };
type Point = { x: number; y: number };

const r1 = (n: number) => Math.round(n * 10) / 10;
const dir = (side: Side): Point => (side === "top" ? { x: 0, y: -1 } : side === "bottom" ? { x: 0, y: 1 } : side === "left" ? { x: -1, y: 0 } : { x: 1, y: 0 });

/** How far a stepped line leaves an element before it turns. */
const STUB = 24;
const RADIUS = 8;

/**
 * The path of a relationship between two ends, in the given style, and where its label sits.
 * Shared by the canvas and the SVG export so both draw the same line.
 */
export function edgePath(s: End, t: End, style: LineStyle): { path: string; label: Point } {
  return style === "right-angles" ? stepped(s, t) : curved(s, t);
}

/** A cubic whose control points leave each end straight, by half the distance (24 at least). */
function curved(s: End, t: End) {
  const ds = dir(s.side), dt = dir(t.side);
  const d = Math.max((ds.x ? Math.abs(t.x - s.x) : Math.abs(t.y - s.y)) / 2, 24);
  const c1 = { x: s.x + ds.x * d, y: s.y + ds.y * d };
  const c2 = { x: t.x + dt.x * d, y: t.y + dt.y * d };
  const label = { x: (s.x + 3 * c1.x + 3 * c2.x + t.x) / 8, y: (s.y + 3 * c1.y + 3 * c2.y + t.y) / 8 };
  return { path: `M${r1(s.x)} ${r1(s.y)} C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(t.x)} ${r1(t.y)}`, label };
}

/**
 * Horizontal and vertical runs: out of each end by a stub, then across at the midpoint between the
 * two stubs (a Z when the ends face each other, a U otherwise), with rounded corners. When the ends
 * are closer than the two stubs, the stubs shrink so the line never doubles back. The label sits on
 * the middle run.
 */
function stepped(s: End, t: End) {
  const ds = dir(s.side), dt = dir(t.side);
  const facing = ds.x === -dt.x && ds.y === -dt.y;
  // Facing ends closer than two stubs along the exit axis: shorter stubs, never less than a corner.
  const gap = facing ? (ds.x ? (t.x - s.x) * ds.x : (t.y - s.y) * ds.y) : Infinity;
  const stub = facing && gap < 2 * STUB ? Math.max(gap / 2, RADIUS) : STUB;
  const a = { x: s.x + ds.x * stub, y: s.y + ds.y * stub };
  const b = { x: t.x + dt.x * stub, y: t.y + dt.y * stub };
  const pts: Point[] = [s, a];
  const vertical = ds.y !== 0;
  if (facing && vertical) {
    // Facing each other up/down: a Z through the midline between the stubs.
    const my = (a.y + b.y) / 2;
    pts.push({ x: a.x, y: my }, { x: b.x, y: my });
  } else if (facing) {
    const mx = (a.x + b.x) / 2;
    pts.push({ x: mx, y: a.y }, { x: mx, y: b.y });
  } else if (vertical) {
    // Same side, or a mix: across at the stub line, then down/up to the target's stub.
    pts.push({ x: b.x, y: a.y });
  } else {
    pts.push({ x: a.x, y: b.y });
  }
  pts.push(b, t);
  const clean = simplify(pts);
  const path = roundedPolyline(clean);
  // The label on the longest middle run; a tie goes to the run nearest the line's midpoint.
  const midpoint = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
  let best = midpoint, len = -1, near = Infinity;
  for (let i = 1; i < clean.length - 2; i++) {
    const p = clean[i]!, q = clean[i + 1]!;
    const l = Math.hypot(q.x - p.x, q.y - p.y);
    const c = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    const d = Math.hypot(c.x - midpoint.x, c.y - midpoint.y);
    if (l > len + 0.01 || (Math.abs(l - len) <= 0.01 && d < near)) [best, len, near] = [c, l, d];
  }
  if (clean.length <= 3) best = pointOnPath(path, 0.5) ?? midpoint;
  return { path, label: best };
}

/** Drops zero-length runs and merges collinear ones, so corners are real corners. */
function simplify(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(p.x - prev.x) < 0.01 && Math.abs(p.y - prev.y) < 0.01) continue;
    const before = out[out.length - 2];
    if (prev && before && ((Math.abs(before.x - prev.x) < 0.01 && Math.abs(prev.x - p.x) < 0.01) || (Math.abs(before.y - prev.y) < 0.01 && Math.abs(prev.y - p.y) < 0.01))) {
      out[out.length - 1] = p; // Same direction as the last run: extend it.
      continue;
    }
    out.push(p);
  }
  return out;
}

function roundedPolyline(pts: Point[]): string {
  let d = `M${r1(pts[0]!.x)} ${r1(pts[0]!.y)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    const prev = pts[i - 1]!;
    const next = pts[i + 1];
    if (!next) {
      d += ` L${r1(p.x)} ${r1(p.y)}`;
      break;
    }
    const r = Math.min(RADIUS, Math.hypot(p.x - prev.x, p.y - prev.y) / 2, Math.hypot(next.x - p.x, next.y - p.y) / 2);
    const inDir = { x: Math.sign(p.x - prev.x), y: Math.sign(p.y - prev.y) };
    const outDir = { x: Math.sign(next.x - p.x), y: Math.sign(next.y - p.y) };
    const before = { x: p.x - inDir.x * r, y: p.y - inDir.y * r };
    const after = { x: p.x + outDir.x * r, y: p.y + outDir.y * r };
    d += ` L${r1(before.x)} ${r1(before.y)} Q${r1(p.x)} ${r1(p.y)} ${r1(after.x)} ${r1(after.y)}`;
  }
  return d;
}

/** A path flattened to a polyline with the running length at each point, for sampling along it. */
export type FlatPath = { poly: Point[]; at: number[]; total: number };

/**
 * The point a fraction `t` along a path made of M, L, Q and C commands (what the two styles draw),
 * by length. Null when the path cannot be read. Sampling many points: `flattenPath` once, then `pointAlong`.
 */
export function pointOnPath(path: string, t: number): Point | null {
  const flat = flattenPath(path);
  return flat ? pointAlong(flat, t) : null;
}

export function flattenPath(path: string): FlatPath | null {
  const cmds = [...path.matchAll(/([MLQC])\s*([^MLQC]+)/g)];
  if (!cmds.length || cmds[0]![1] !== "M") return null;
  // Flatten to a polyline: curves sampled.
  const poly: Point[] = [];
  let cur: Point | null = null;
  for (const [, c, args] of cmds) {
    const n = args!.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi)?.map(Number) ?? [];
    if (c === "M" && n.length >= 2) {
      cur = { x: n[0]!, y: n[1]! };
      poly.push(cur);
    } else if (c === "L" && cur && n.length >= 2) {
      cur = { x: n[0]!, y: n[1]! };
      poly.push(cur);
    } else if (c === "Q" && cur && n.length >= 4) {
      const p0 = cur, p1 = { x: n[0]!, y: n[1]! }, p2 = { x: n[2]!, y: n[3]! };
      for (let i = 1; i <= 8; i++) {
        const u = i / 8, v = 1 - u;
        poly.push({ x: v * v * p0.x + 2 * v * u * p1.x + u * u * p2.x, y: v * v * p0.y + 2 * v * u * p1.y + u * u * p2.y });
      }
      cur = p2;
    } else if (c === "C" && cur && n.length >= 6) {
      const p0 = cur, p1 = { x: n[0]!, y: n[1]! }, p2 = { x: n[2]!, y: n[3]! }, p3 = { x: n[4]!, y: n[5]! };
      for (let i = 1; i <= 32; i++) {
        const u = i / 32, v = 1 - u;
        const a = v * v * v, b = 3 * v * v * u, cc = 3 * v * u * u, d = u * u * u;
        poly.push({ x: a * p0.x + b * p1.x + cc * p2.x + d * p3.x, y: a * p0.y + b * p1.y + cc * p2.y + d * p3.y });
      }
      cur = p3;
    } else return null;
  }
  if (!poly.length) return null;
  const at = [0];
  for (let i = 1; i < poly.length; i++) at.push(at[i - 1]! + Math.hypot(poly[i]!.x - poly[i - 1]!.x, poly[i]!.y - poly[i - 1]!.y));
  return { poly, at, total: at[at.length - 1]! };
}

export function pointAlong({ poly, at, total }: FlatPath, t: number): Point {
  if (poly.length < 2 || total === 0) return poly[0]!;
  const want = Math.min(Math.max(t, 0), 1) * total;
  let i = 1;
  while (i < at.length - 1 && at[i]! < want) i++;
  const p = poly[i - 1]!, q = poly[i]!;
  const seg = at[i]! - at[i - 1]!;
  const f = seg ? (want - at[i - 1]!) / seg : 0;
  return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
}
