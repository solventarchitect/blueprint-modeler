import { archimateElements, type Lens, showsArchimate } from "@/frameworks";
import { classById, isClassId, type Layer } from "@/metamodel";
import type { Model } from "@/model";
import { edgeSides, type Side } from "@/layout/geometry";

export type SvgTheme = "dark" | "light";

/** Blueprint roles as literal hex (tokens.css), so the file stands alone: no CSS vars, nothing remote. */
const palettes = {
  dark: { bg: "#121e2b", node: "#172738", ink: "#f6f7f9", muted: "#7b9ec7", line: "#7b9ec7", status: "#deb163", accent: "#5ec8ff", ai: "#b4a7ff" },
  light: { bg: "#f6f7f9", node: "#ffffff", ink: "#121e2b", muted: "#406996", line: "#34557a", status: "#6d4e17", accent: "#005785", ai: "#2000d6" },
} as const;

const layerColor = (p: (typeof palettes)[SvgTheme], layer: Layer) =>
  ({ business: p.status, design: p.accent, service: p.ai, functional: p.muted, infrastructure: p.line })[layer];

const SANS = "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const W = 224;
const PAD = 32;
const CLASS_CHARS = 26; // uppercase mono at 10px with tracking, inside 200px
const NAME_CHARS = 24;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const r1 = (n: number) => Math.round(n * 10) / 10;

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

type Box = { x: number; y: number; w: number; h: number };

function anchor(b: Box, side: Side) {
  switch (side) {
    case "top":
      return { x: b.x + b.w / 2, y: b.y, dx: 0, dy: -1 };
    case "bottom":
      return { x: b.x + b.w / 2, y: b.y + b.h, dx: 0, dy: 1 };
    case "left":
      return { x: b.x, y: b.y + b.h / 2, dx: -1, dy: 0 };
    case "right":
      return { x: b.x + b.w, y: b.y + b.h / 2, dx: 1, dy: 0 };
  }
}

/**
 * The model as a standalone SVG in the chosen theme: same boxes, lanes and edge routing as the
 * canvas, system fonts (IBM Plex if installed), no scripts, no external references.
 */
export function modelToSvg(model: Model, theme: SvgTheme, opts: { lens?: Lens } = {}): string {
  const lens = opts.lens ?? "csdm";
  const altOf = (cls: string) => (showsArchimate(lens) && isClassId(cls) ? archimateElements[cls].label : undefined);
  const p = palettes[theme];
  const boxes = new Map<string, Box & { lines: string[] }>();
  for (const n of model.nodes) {
    const pos = model.layout[n.id] ?? { x: 0, y: 0 };
    const lines = wrap((classById(n.class)?.label ?? n.class).toUpperCase(), CLASS_CHARS);
    boxes.set(n.id, { x: pos.x, y: pos.y, w: W, h: 20 + lines.length * 14 + 22 + (altOf(n.class) ? 20 : 0), lines });
  }

  const all = [...boxes.values()];
  const minX = all.length ? Math.min(...all.map((b) => b.x)) - PAD : 0;
  const minY = all.length ? Math.min(...all.map((b) => b.y)) - PAD : 0;
  const maxX = all.length ? Math.max(...all.map((b) => b.x + b.w)) + PAD : 2 * PAD;
  const maxY = all.length ? Math.max(...all.map((b) => b.y + b.h)) + PAD : 2 * PAD;
  const width = maxX - minX;
  const height = maxY - minY;

  const edges: string[] = [];
  for (const e of model.edges) {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    if (!a || !b) continue;
    const [ss, ts] = edgeSides(a, b);
    const s = anchor(a, ss);
    const t = anchor(b, ts);
    const d = Math.max((s.dx ? Math.abs(t.x - s.x) : Math.abs(t.y - s.y)) / 2, 24);
    const c1 = { x: s.x + s.dx * d, y: s.y + s.dy * d };
    const c2 = { x: t.x + t.dx * d, y: t.y + t.dy * d };
    const mid = { x: (s.x + 3 * c1.x + 3 * c2.x + t.x) / 8, y: (s.y + 3 * c1.y + 3 * c2.y + t.y) / 8 };
    const label = e.type.startsWith("reference:") ? "reference" : (e.type.split("::")[0] ?? e.type);
    const lw = label.length * 6.6 + 8;
    edges.push(
      `<path d="M${r1(s.x)} ${r1(s.y)} C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(t.x)} ${r1(t.y)}" fill="none" stroke="${p.line}" stroke-width="1.25" marker-end="url(#arrow)"/>`,
      `<rect x="${r1(mid.x - lw / 2)}" y="${r1(mid.y - 8)}" width="${r1(lw)}" height="16" fill="${p.bg}"/>`,
      `<text x="${r1(mid.x)}" y="${r1(mid.y + 4)}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${p.muted}">${esc(label)}</text>`,
    );
  }

  const nodes: string[] = [];
  for (const n of model.nodes) {
    const b = boxes.get(n.id)!;
    const layer = classById(n.class)?.layer ?? "design";
    const alt = altOf(n.class);
    const cls = b.lines
      .map((l, i) => `<text x="${b.x + 14}" y="${b.y + 22 + i * 14}" font-family="${MONO}" font-size="10" letter-spacing="1.2" fill="${p.muted}">${esc(l)}</text>`)
      .join("");
    nodes.push(
      `<g><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${p.node}" stroke="${p.line}"/>` +
        `<rect x="${b.x}" y="${b.y}" width="4" height="${b.h}" fill="${layerColor(p, layer)}"/>` +
        cls +
        `<text x="${b.x + 14}" y="${b.y + b.h - 14 - (alt ? 20 : 0)}" font-family="${SANS}" font-size="14" font-weight="500" fill="${p.ink}">${esc(clip(n.name || "Untitled", NAME_CHARS))}</text>` +
        (alt
          ? `<line x1="${b.x + 14}" y1="${b.y + b.h - 26}" x2="${b.x + b.w - 10}" y2="${b.y + b.h - 26}" stroke="${p.line}" stroke-opacity="0.4"/>` +
            `<text x="${b.x + 14}" y="${b.y + b.h - 10}" font-family="${MONO}" font-size="10" fill="${p.ai}">ArchiMate · ${esc(alt)}</text>`
          : "") +
        `</g>`,
    );
  }

  const title = esc(model.name || "Untitled model");
  const desc = esc(
    `CSDM model with ${model.nodes.length} elements and ${model.edges.length} relationships${showsArchimate(lens) ? ", with ArchiMate 3.2 element names" : ""}, exported from Blueprint Modeler.`,
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="t d">`,
    `<title id="t">${title}</title><desc id="d">${desc}</desc>`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${p.line}"/></marker></defs>`,
    `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${p.bg}"/>`,
    ...edges,
    ...nodes,
    `</svg>`,
    "",
  ].join("\n");
}
