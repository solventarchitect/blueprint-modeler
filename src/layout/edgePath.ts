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
 * two stubs (a Z when the ends face each other, a U otherwise), with rounded corners. The label
 * sits on the middle run.
 */
function stepped(s: End, t: End) {
  const ds = dir(s.side), dt = dir(t.side);
  const a = { x: s.x + ds.x * STUB, y: s.y + ds.y * STUB };
  const b = { x: t.x + dt.x * STUB, y: t.y + dt.y * STUB };
  const pts: Point[] = [s, a];
  const vertical = ds.y !== 0;
  if (vertical && dt.y !== 0 && ds.y !== dt.y) {
    // Facing each other up/down: a Z through the midline between the stubs.
    const my = (a.y + b.y) / 2;
    pts.push({ x: a.x, y: my }, { x: b.x, y: my });
  } else if (!vertical && dt.x !== 0 && ds.x !== dt.x) {
    const mx = (a.x + b.x) / 2;
    pts.push({ x: mx, y: a.y }, { x: mx, y: b.y });
  } else if (vertical) {
    // Same side, or a mix: across at the stub line, then down/up to the target's stub.
    pts.push({ x: b.x, y: a.y });
  } else {
    pts.push({ x: a.x, y: b.y });
  }
  pts.push(b, t);
  // Drop runs of zero length so corners are real corners.
  const clean = pts.filter((p, i) => i === 0 || Math.abs(p.x - pts[i - 1]!.x) > 0.01 || Math.abs(p.y - pts[i - 1]!.y) > 0.01);
  const path = roundedPolyline(clean);
  // The label on the longest middle run.
  let best = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 }, len = -1;
  for (let i = 1; i < clean.length - 2; i++) {
    const l = Math.hypot(clean[i + 1]!.x - clean[i]!.x, clean[i + 1]!.y - clean[i]!.y);
    if (l > len) [best, len] = [{ x: (clean[i]!.x + clean[i + 1]!.x) / 2, y: (clean[i]!.y + clean[i + 1]!.y) / 2 }, l];
  }
  return { path, label: best };
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

/**
 * The point a fraction `t` along a path made of M, L, Q and C commands (what the two styles draw),
 * by length. Null when the path cannot be read.
 */
export function pointOnPath(path: string, t: number): Point | null {
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
  if (poly.length < 2) return poly[0] ?? null;
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < poly.length; i++) {
    const l = Math.hypot(poly[i]!.x - poly[i - 1]!.x, poly[i]!.y - poly[i - 1]!.y);
    lens.push(l);
    total += l;
  }
  let want = Math.min(Math.max(t, 0), 1) * total;
  for (let i = 0; i < lens.length; i++) {
    if (want <= lens[i]! || i === lens.length - 1) {
      const f = lens[i]! ? want / lens[i]! : 0;
      const p = poly[i]!, q = poly[i + 1]!;
      return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
    }
    want -= lens[i]!;
  }
  return poly[poly.length - 1]!;
}
