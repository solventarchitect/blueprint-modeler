import { classById } from "@/metamodel";
import { filterActive, inView, slotColor, slotMap, slotMarker, UNTITLED_MODEL, type Model } from "@/model";
import { clip, esc, layerColor, MONO, palettes, SANS, svgTitleBlock, type SvgHighlight, type SvgTheme, type SvgView } from "@/io/svg";
import type { Size } from "@/layout/layout";
import { behind, boxFaces, drawOrder, isoScene, project, RANK, SLAB, type IsoMode, type P3 } from "./scene";
import type { Layer } from "@/metamodel";

/** Mixes `a` into `b` by `t` (sRGB, 0–1); both "#rrggbb". */
export function mix(a: string, b: string, t: number): string {
  const c = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(c(a, i) * t + c(b, i) * (1 - t)).toString(16).padStart(2, "0")).join("")}`;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const pts = (ps: P3[]) => ps.map((p) => project(p)).map((q) => `${r1(q.x)},${r1(q.y)}`).join(" ");
const PAD = 40;
const NAME_CHARS = 26;

export type IsoOptions = {
  mode?: IsoMode;
  view?: SvgView;
  highlight?: SvgHighlight;
  /** Measured element sizes (the canvas's); the export uses the defaults. */
  sizes?: Record<string, Size | undefined>;
  selectedId?: string | null;
  /** Leave out the title block. */
  untitled?: boolean;
  /** Prefix for the title and description ids, when the picture shares a page. */
  idPrefix?: string;
  /** Present: the layer being shown, lifted above its place and outlined. */
  lift?: Layer;
  /** On screen: packets running along the relationships a blast radius or data flow carried. */
  packets?: boolean;
};

/**
 * The model in isometric as a standalone SVG (M59), for the screen and for export: slabs per CSDM
 * layer, blocks per element in the face shades of the Motion + Isometric design system (top 18%,
 * front sides 10% and 5% of the signal color over the sheet, 1px edges at 75%), relationships as
 * pipes on a slab or straight lines between layers, and an upright label over every block. With a view
 * (M54) the filtered-out elements are ghosts and color-by colors the blocks; a blast radius or data
 * flow marks what it reaches. Literal colors only, no scripts, nothing remote.
 */
export function isoToSvg(model: Model, theme: SvgTheme, opts: IsoOptions = {}): string {
  const mode = opts.mode ?? "iso";
  const p = palettes[theme];
  const view = opts.view && (filterActive(opts.view.filter) || opts.view.colorBy !== "layer") ? opts.view : undefined;
  const faded = new Set(view ? model.nodes.filter((n) => !inView(n, view.filter)).map((n) => n.id) : []);
  const slotFor = view ? slotMap(model, view.colorBy) : null;
  const hl = opts.highlight;
  const scene = isoScene(model, mode, opts.sizes, opts.lift);
  const nodeById = new Map(model.nodes.map((n) => [n.id, n]));

  const quad = (ps: P3[], fill: string, stroke: string, extra = "") => `<polygon points="${pts(ps)}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"${extra}/>`;
  const body: string[] = [];
  for (const layer of drawOrder(scene)) {
    const slab = scene.slabs.find((s) => s.layer === layer)!;
    const c = layerColor(p, layer);
    const f = boxFaces(slab.rect, slab.top - SLAB, slab.top);
    const lifted = opts.lift === layer;
    const rim = lifted ? p.accent : mix(c, p.bg, 0.5);
    // Each layer is one group (its slab, pipes and blocks), so the screen can raise it into place.
    body.push(`<g data-iso-layer="${layer}" data-rank="${RANK[layer]}"${lifted ? ` data-lifted=""` : ""}>`);
    body.push(
      `<g data-iso-slab="${layer}">` +
        quad(f.left, mix(c, p.bg, 0.05), rim) +
        quad(f.right, mix(c, p.bg, 0.08), rim) +
        quad(f.top, mix(c, p.bg, 0.1), rim, lifted ? ` stroke-width="2"` : "") +
        `</g>`,
    );
    // Pipes on this slab, under its blocks.
    for (const e of scene.edges.filter((x) => !x.across && scene.blocks.find((b) => b.id === x.from)?.layer === layer)) body.push(pipe(e.id, e.from, e.to, e.points));
    const blocks = scene.blocks.filter((b) => b.layer === layer).sort((a, b) => behind(a.rect, a.z, b.rect, b.z));
    for (const b of blocks) {
      const ghost = faded.has(b.id);
      const slot = slotFor?.(nodeById.get(b.id)!) ?? null;
      const col = slot === null ? c : slotColor(slot, theme);
      const fb = boxFaces(b.rect, b.z, b.z + b.h);
      const edge = ghost ? p.line : mix(col, p.bg, 0.75);
      const dash = ghost ? ` stroke-dasharray="4 3"` : "";
      const sel = opts.selectedId === b.id;
      body.push(
        `<g data-iso-el="${esc(b.id)}"${ghost ? ` data-faded=""` : ""}${sel ? ` data-selected=""` : ""}>` +
          quad(fb.left, ghost ? p.bg : mix(col, p.bg, 0.05), edge, dash) +
          quad(fb.right, ghost ? p.bg : mix(col, p.bg, 0.1), edge, dash) +
          quad(fb.top, ghost ? p.bg : mix(col, p.bg, 0.18), sel ? p.accent : edge, sel ? ` stroke-width="2.5"` : dash) +
          (slot === null ? "" : marker(slot, fb.top, ghost)) +
          `</g>`,
      );
    }
    body.push(`</g>`);
  }
  // Lines between layers, over everything they pass.
  for (const e of scene.edges.filter((x) => x.across)) body.push(pipe(e.id, e.from, e.to, e.points));
  // Labels upright over each block, nearest last, so the front of the picture reads on top.
  const labels = [...scene.blocks].sort((a, b) => project({ ...mid(a.rect), z: a.z + a.h }).y - project({ ...mid(b.rect), z: b.z + b.h }).y);
  for (const b of labels) {
    const n = nodeById.get(b.id)!;
    const ghost = faded.has(b.id);
    const at = project({ ...mid(b.rect), z: b.z + b.h });
    const name = clip(n.name || "Untitled", NAME_CHARS);
    const cls = (classById(n.class)?.label ?? n.class).toUpperCase();
    const w = Math.max(name.length * 7.2, cls.length * 6.4) + 12;
    body.push(
      `<g data-iso-label="${esc(b.id)}">` +
        `<rect x="${r1(at.x - w / 2)}" y="${r1(at.y - 34)}" width="${r1(w)}" height="30" fill="${p.bg}" fill-opacity="0.85"/>` +
        `<text x="${r1(at.x)}" y="${r1(at.y - 22)}" text-anchor="middle" font-family="${MONO}" font-size="9" letter-spacing="1" fill="${p.muted}">${esc(cls)}</text>` +
        `<text x="${r1(at.x)}" y="${r1(at.y - 9)}" text-anchor="middle" font-family="${SANS}" font-size="12.5" font-weight="500" fill="${ghost ? p.muted : p.ink}">${esc(name)}</text>` +
        `</g>`,
    );
  }
  // Blast radius or data flow marks: an outline on the top face and a badge, as in the plan picture.
  if (hl) {
    for (const b of scene.blocks) {
      const mark = hl.nodes.get(b.id);
      if (!mark) continue;
      const color = hl.flow ? p.ai : mark.hop > 0 ? p.status : hl.impact ? p.invalid : p.accent;
      const glyph = mark.hop > 0 ? String(mark.hop) : hl.flow ? "▶" : hl.impact ? "×" : "◎";
      const top = boxFaces(b.rect, b.z, b.z + b.h).top;
      const corner = project(top[0]!);
      body.push(
        `<g data-blast="${mark.hop === 0 ? "start" : "reached"}" data-blast-hop="${mark.hop}">` +
          `<polygon points="${pts(top)}" fill="none" stroke="${color}" stroke-width="${mark.current ? 3.5 : 2.5}"/>` +
          `<circle cx="${r1(corner.x)}" cy="${r1(corner.y)}" r="11" fill="${color}"/><text x="${r1(corner.x)}" y="${r1(corner.y + 4)}" text-anchor="middle" font-family="${MONO}" font-size="12" font-weight="600" fill="${p.onBadge}">${glyph}</text>` +
          `</g>`,
      );
    }
  }

  // The picture's extent: every projected corner, every label, then the title block above it.
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (q: P3) => {
    const s = project(q);
    xs.push(s.x);
    ys.push(s.y);
  };
  for (const s of scene.slabs) for (const q of Object.values(boxFaces(s.rect, s.top - SLAB, s.top)).flat()) add(q);
  for (const b of scene.blocks) {
    for (const q of Object.values(boxFaces(b.rect, b.z, b.z + b.h)).flat()) add(q);
    const at = project({ ...mid(b.rect), z: b.z + b.h });
    ys.push(at.y - 40);
    xs.push(at.x - 110, at.x + 110);
  }
  for (const e of scene.edges) e.points.forEach(add);
  const minX = (xs.length ? Math.min(...xs) : 0) - PAD;
  const maxX = (xs.length ? Math.max(...xs) : 2 * PAD) + PAD;
  const tb = opts.untitled ? null : svgTitleBlock(model, theme, view, model.nodes.length - faded.size, maxX - minX - 2 * PAD);
  const width = Math.ceil(Math.max(maxX - minX, tb ? tb.width + 2 * PAD : 0));
  const minY = (ys.length ? Math.min(...ys) : 0) - PAD - (tb ? tb.height : 0);
  const maxY = (ys.length ? Math.max(...ys) : 2 * PAD) + PAD;
  const height = Math.ceil(maxY - minY);
  const ids = opts.idPrefix ?? "";
  const name = model.name || UNTITLED_MODEL;
  const desc = `CSDM model with ${model.nodes.length} elements and ${model.edges.length} relationships, drawn in isometric${mode === "exploded" ? " with its layers spread apart" : ""}: one slab per CSDM layer, Infrastructure lowest, Business highest. Exported from Blueprint Modeler.`;
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r1(minX)} ${r1(minY)} ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${ids}t ${ids}d" data-iso="${mode}">`,
    `<title id="${ids}t">${esc(name)}</title><desc id="${ids}d">${esc(desc)}</desc>`,
    `<defs><marker id="iso-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${p.line}"/></marker>${
      hl ? `<marker id="iso-arrow-blast" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${hl.flow ? p.ai : p.status}"/></marker>` : ""
    }</defs>`,
    `<rect x="${r1(minX)}" y="${r1(minY)}" width="${width}" height="${height}" fill="${p.bg}"/>`,
    ...(tb ? tb.render(minX + PAD, minY) : []),
    ...body,
    `</svg>`,
    "",
  ].join("\n");

  function pipe(id: string, from: string, to: string, points: P3[]) {
    const carried = hl?.edges.get(id);
    const fade = faded.has(from) || faded.has(to);
    const stroke = carried ? `stroke="${hl?.flow ? p.ai : p.status}" stroke-width="2.5"${carried.current ? ` stroke-dasharray="10 6"` : ""}` : `stroke="${p.line}" stroke-width="1.5"`;
    const line = `<polyline data-iso-rel="${esc(id)}" points="${pts(points)}" pathLength="100" fill="none" ${stroke} stroke-linejoin="round" marker-end="url(#${carried ? "iso-arrow-blast" : "iso-arrow"})"${fade ? ` opacity="0.2" data-faded=""` : ""}/>`;
    // A packet runs the way the impact or the data travels (backward when the walk went against the arrow).
    const packet =
      opts.packets && carried
        ? `<polyline data-iso-packet="${carried.forward === false ? "back" : "on"}" points="${pts(points)}" pathLength="100" fill="none" stroke="${hl?.flow ? p.ai : p.status}" stroke-width="5" stroke-linecap="round" stroke-dasharray="3 97"/>`
        : "";
    return line + packet;
  }

  function marker(slot: Parameters<typeof slotMarker>[0], top: P3[], ghost: boolean) {
    // The value's marker, upright at the top face's back corner (never color alone).
    const at = project(top[0]!);
    return `<path data-slot="${slot}" d="${slotMarker(slot)}" transform="translate(${r1(at.x - 5)} ${r1(at.y + 4)})" fill="${slotColor(slot, theme)}" fill-rule="evenodd"${ghost ? ` opacity="0.4"` : ""}/>`;
  }
}

function mid(r: { x: number; y: number; w: number; d: number }) {
  return { x: r.x + r.w / 2, y: r.y + r.d / 2 };
}
