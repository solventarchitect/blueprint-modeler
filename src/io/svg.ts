import { archimateElements, archimateFill, archimateRelationshipFor, archimateTypeInk, edgeNotation, markerSvg, type Lens, type MarkerShape, showsArchimate } from "@/frameworks";
import { classById, isClassId, type Layer } from "@/metamodel";
import { COLOR_BY_LABEL, filterActive, GROUP_BY_LABEL, groupsOf, type GroupBy, formatModelDate, inView, legend, modelDate, PALETTE, slotColor, slotMap, slotMarker, UNTITLED_MODEL, PLAN_VIEW_LABEL, planHidden, type ColorBy, type Model, type PlanView, type ViewFilter } from "@/model";
import { layoutOrientation } from "@/layout/bands";
import { groupFrames, ownGroups } from "@/layout/groupLayout";
import { planLabels } from "@/layout/edgeLabel";
import { edgePath, type LineStyle } from "@/layout/edgePath";
import { edgeEnds, type Side } from "@/layout/geometry";
import { ARTIFACT_ICON_PATH } from "./icons";

export type SvgTheme = "dark" | "light";

/** Blueprint roles as literal hex (tokens.css), so the file stands alone: no CSS vars, nothing remote. */
export const palettes = {
  dark: { bg: "#121e2b", node: "#172738", ink: "#f6f7f9", muted: "#7b9ec7", line: "#7b9ec7", status: "#deb163", accent: "#5ec8ff", ai: "#b4a7ff", invalid: "#e99696", onBadge: "#121e2b" },
  light: { bg: "#f6f7f9", node: "#ffffff", ink: "#121e2b", muted: "#406996", line: "#34557a", status: "#6d4e17", accent: "#005785", ai: "#2000d6", invalid: "#b12525", onBadge: "#ffffff" },
} as const;

/**
 * A blast radius step drawn into the picture (M34 GIF frames): the start element (hop 0) and each
 * element reached so far get an outline and a badge; the relationships that carried impact turn the
 * status color, the current hop's dashed; an optional caption band sits above the diagram.
 */
export type SvgHighlight = {
  impact: boolean;
  /** A data flow: every mark and carried line in the flow color, the source marked ▶. */
  flow?: boolean;
  nodes: ReadonlyMap<string, { hop: number; current: boolean }>;
  /** `forward`: whether the impact or data runs the way the relationship points (the isometric packets use it). */
  edges: ReadonlyMap<string, { current: boolean; forward?: boolean }>;
  /** `reserve`: characters of width to keep for the caption, so frames with shorter captions match in size. */
  caption?: { label: string; text: string; reserve?: number };
};

/** A view (M54) drawn into the picture: elements outside the filter fade; color by puts a colored bar and a marker on each element, with a legend in the title block. */
export type SvgView = { filter: ViewFilter; colorBy: ColorBy; groupBy?: GroupBy; name?: string; state?: PlanView };

/**
 * The state shown (M71) in a picture: Current or Target leaves out what the canvas leaves out, and the
 * title block names it. Current and target keeps everything and, when anything is planned or retiring,
 * says how the picture marks them (`marks`).
 */
export function stateShown(model: Model, state: PlanView | undefined, marks: string): { model: Model; label: string } {
  if (state === "current" || state === "target") {
    const out = planHidden(model, state);
    const shown = out.nodes.size || out.edges.size ? { ...model, nodes: model.nodes.filter((n) => !out.nodes.has(n.id)), edges: model.edges.filter((e) => !out.edges.has(e.id)) } : model;
    return { model: shown, label: PLAN_VIEW_LABEL[state] };
  }
  const marked = model.nodes.some((n) => n.plan) || model.edges.some((e) => e.plan);
  return { model, label: marked ? `${PLAN_VIEW_LABEL.both}: ${marks}` : "" };
}
/** A group frame's name tab (M56), on the frame's top edge. */
const GROUP_TAB_H = 18;

/** Every color a picture in this theme and lens can use: large fills, then lines and text; with `view`, the color-by colors too. */
export function svgColors(theme: SvgTheme, lens: Lens, view?: SvgView): { surfaces: string[]; inks: string[] } {
  const p = palettes[theme];
  const amOnly = lens === "archimate-only";
  const fills = amOnly ? Object.values(archimateFill[theme]).filter((c): c is string => !!c) : [];
  const slots = view && view.colorBy !== "layer" ? [...PALETTE[theme], PALETTE.other[theme], PALETTE.none[theme]] : [];
  const inks = [p.ink, p.muted, p.line, p.status, p.accent, p.ai, p.invalid, p.onBadge, ...(amOnly ? [archimateTypeInk[theme]] : []), ...slots];
  return { surfaces: [...new Set([p.bg, p.node, ...fills])], inks: [...new Set(inks)] };
}

const CAPTION_H = 48;

export const layerColor = (p: (typeof palettes)[SvgTheme], layer: Layer) =>
  ({ business: p.status, design: p.accent, service: p.ai, functional: p.muted, infrastructure: p.line })[layer];

export const SANS = "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const W = 224;
const PAD = 32;
const CLASS_CHARS = 26; // uppercase mono at 10px with tracking, inside 200px
const NAME_CHARS = 24;

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
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

/** Words into lines of at most `width` characters; past `max` lines the last one ends with "…". */
function wrapText(text: string, width: number, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines.map((l) => clip(l, width));
  return [...lines.slice(0, max - 1), clip(`${lines[max - 1]}…`, width)];
}

/** The title block: model name, with its Artifact ID above and description below when they exist. */
const TITLE = { top: 28, artifact: 22, name: 28, line: 18, gap: 24, nameChar: 12.4, textChar: 7.2, monoChar: 7.6, maxName: 800 } as const;
/** The view legend in the title block: a head line, then rows of entries (12px sans, about 6.8px a character). */
const LEGEND = { head: 26, row: 20, char: 6.8, marker: 16, gap: 20 } as const;

type Box = { x: number; y: number; w: number; h: number };

function anchor(b: Box, side: Side) {
  switch (side) {
    case "top":
      return { x: b.x + b.w / 2, y: b.y };
    case "bottom":
      return { x: b.x + b.w / 2, y: b.y + b.h };
    case "left":
      return { x: b.x, y: b.y + b.h / 2 };
    case "right":
      return { x: b.x + b.w, y: b.y + b.h / 2 };
  }
}

/**
 * The title block of an exported picture: the reference line (Artifact ID and date), the model's name,
 * its description and, with a view (M54), the view's head line and legend. `avail` is the drawing's
 * width, which the description and legend wrap to. Shared by the plan and isometric pictures.
 */
export function svgTitleBlock(model: Model, theme: SvgTheme, view: SvgView | undefined, shownCount: number, avail: number, state = "", total = model.nodes.length) {
  const p = palettes[theme];
  const name = model.name || UNTITLED_MODEL;
  const artifactId = model.artifactId?.trim() ?? "";
  const about = model.description?.trim() ?? "";
  // Description lines: as wide as the diagram allows, between 40 and 110 characters (readable).
  const aboutChars = Math.min(110, Math.max(40, Math.floor(avail / TITLE.textChar)));
  const aboutLines = about ? wrapText(about, aboutChars, 3) : [];
  // The view legend: entries wrap into rows as wide as the diagram (at least 480px).
  // The head line: the view (when there is one), the state shown (M71), and how many elements show.
  const legendHead =
    view || state
      ? [...(view ? [view.name ? `View: ${view.name}` : "View", view.colorBy !== "layer" ? `colored by ${COLOR_BY_LABEL[view.colorBy].toLowerCase()}` : "", view.groupBy ? `grouped by ${GROUP_BY_LABEL[view.groupBy]}` : ""] : []), state, `showing ${shownCount} of ${total} elements`].filter(Boolean).join(" · ")
      : "";
  const legendRows: { label: string; slot: Parameters<typeof slotColor>[0]; w: number }[][] = [];
  if (view) {
    const rowWidth = Math.max(480, avail);
    let row: (typeof legendRows)[number] = [];
    let used = 0;
    for (const e of legend(model, view.colorBy, view.filter)) {
      const label = `${clip(e.label, 40)} (${e.count})`;
      const w = LEGEND.marker + label.length * LEGEND.char + LEGEND.gap;
      if (row.length && used + w > rowWidth) {
        legendRows.push(row);
        row = [];
        used = 0;
      }
      row.push({ label, slot: e.slot, w });
      used += w;
    }
    if (row.length) legendRows.push(row);
  }
  const legendH = legendHead ? LEGEND.head + legendRows.length * LEGEND.row : 0;
  // The title block sets a minimum width: name (22px sans), Artifact ID (12px mono after its icon),
  // description lines and the legend.
  const width = Math.max(
    Math.min(name.length * TITLE.nameChar, TITLE.maxName),
    (artifactId ? 20 + (artifactId.length + 3) * TITLE.monoChar : 0) + 12 * TITLE.monoChar,
    ...aboutLines.map((l) => l.length * TITLE.textChar),
    legendHead.length * TITLE.textChar,
    ...legendRows.map((r) => r.reduce((a, x) => a + x.w, 0)),
  );
  const height = TITLE.top + TITLE.artifact + TITLE.name + (aboutLines.length ? 6 + aboutLines.length * TITLE.line : 0) + legendH + TITLE.gap;
  /** The block's markup, its text starting at x = tx, its top at y = top. */
  const render = (tx: number, top: number): string[] => {
    let ty = top + TITLE.top;
    const out: string[] = [];
    // The reference line: the Artifact ID (with its tag icon) when set, then the model's date.
    const date = formatModelDate(modelDate(model));
    out.push(
      artifactId
        ? `<g data-title="artifact"><path data-icon="artifact" d="${ARTIFACT_ICON_PATH}" transform="translate(${tx} ${ty - 12}) scale(0.875)" fill="none" stroke="${p.muted}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
            `<text x="${tx + 20}" y="${ty}" font-family="${MONO}" font-size="12" letter-spacing="0.4" fill="${p.muted}">${esc(clip(artifactId, 64))}<tspan dx="8">·</tspan><tspan data-title="date" dx="8">${esc(date)}</tspan></text></g>`
        : `<text data-title="date" x="${tx}" y="${ty}" font-family="${MONO}" font-size="12" letter-spacing="0.4" fill="${p.muted}">${esc(date)}</text>`,
    );
    ty += TITLE.artifact;
    ty += TITLE.name - 6;
    out.push(`<text data-title="name" x="${tx}" y="${ty}" font-family="${SANS}" font-size="22" font-weight="600" fill="${p.ink}">${esc(clip(name, Math.floor(TITLE.maxName / TITLE.nameChar)))}</text>`);
    if (aboutLines.length) {
      out.push(
        `<text data-title="description" x="${tx}" y="${ty + 6}" font-family="${SANS}" font-size="13" fill="${p.muted}">` +
          aboutLines.map((l) => `<tspan x="${tx}" dy="${TITLE.line}" data-title-line="">${esc(l)}</tspan>`).join("") +
          `</text>`,
      );
    }
    if (legendHead) {
      let ly = ty + 6 + aboutLines.length * TITLE.line + LEGEND.head;
      out.push(`<text data-title="view" x="${tx}" y="${ly - 6}" font-family="${SANS}" font-size="13" fill="${p.muted}">${esc(legendHead)}</text>`);
      for (const row of legendRows) {
        let lx = tx;
        ly += LEGEND.row;
        for (const it of row) {
          out.push(
            `<g data-legend="${it.slot}"><path d="${slotMarker(it.slot)}" transform="translate(${lx} ${ly - 15})" fill="${slotColor(it.slot, theme)}" fill-rule="evenodd"/>` +
              `<text x="${lx + LEGEND.marker}" y="${ly - 6}" font-family="${SANS}" font-size="12" fill="${p.ink}">${esc(it.label)}</text></g>`,
          );
          lx += it.w;
        }
      }
    }
    return out;
  };
  return { width, height, render };
}

/**
 * The model as a standalone SVG in the chosen theme: same boxes, lanes and edge routing as the
 * canvas, system fonts (IBM Plex if installed), no scripts, no external references.
 */
export function modelToSvg(whole: Model, theme: SvgTheme, opts: { lens?: Lens; highlight?: SvgHighlight; lines?: LineStyle; labels?: boolean; view?: SvgView } = {}): string {
  const { model, label: stateLabel } = stateShown(whole, opts.view?.state, "planned dotted, retiring struck through");
  const lens = opts.lens ?? "csdm";
  // "All elements" colored by layer draws exactly as without a view.
  const view = opts.view && (filterActive(opts.view.filter) || opts.view.colorBy !== "layer" || opts.view.groupBy) ? opts.view : undefined;
  const faded = new Set(view ? model.nodes.filter((n) => !inView(n, view.filter)).map((n) => n.id) : []);
  const slotFor = view ? slotMap(model, view.colorBy) : null;
  const lines = opts.lines ?? "curved";
  const showLabels = opts.labels ?? true;
  const hl = opts.highlight;
  // ArchiMate-only: the ArchiMate type heads each element (no CSDM line), fills follow the ArchiMate
  // layer, and relationships carry ArchiMate notation — as on the canvas.
  const amOnly = lens === "archimate-only";
  const altOf = (cls: string) => (showsArchimate(lens) && !amOnly && isClassId(cls) ? archimateElements[cls].label : undefined);
  const headOf = (cls: string) => (amOnly && isClassId(cls) ? archimateElements[cls].label : (classById(cls)?.label ?? cls));
  const fillOf = (cls: string) => (amOnly && isClassId(cls) ? archimateFill[theme][archimateElements[cls].layer] : undefined);
  const p = palettes[theme];
  const boxes = new Map<string, Box & { lines: string[] }>();
  for (const n of model.nodes) {
    const pos = model.layout[n.id] ?? { x: 0, y: 0 };
    const lines = wrap(headOf(n.class).toUpperCase(), CLASS_CHARS);
    boxes.set(n.id, { x: pos.x, y: pos.y, w: W, h: 20 + lines.length * 14 + 22 + (altOf(n.class) ? 20 : 0), lines });
  }

  const all = [...boxes.values()];
  // Group frames (M56), every group open: collapsing is for the screen only.
  const frames = view?.groupBy ? groupFrames(ownGroups(groupsOf(model, view.groupBy)), model.layout, Object.fromEntries([...boxes].map(([id, b]) => [id, { width: b.w, height: b.h }]))) : [];
  const tabText = (f: (typeof frames)[number]) => `${f.label} · ${f.count}`;
  const tabW = (f: (typeof frames)[number]) => tabText(f).length * 6.6 + 16;
  // What the image has to hold: the elements, and the frames with their tabs.
  const extent = [...all, ...frames.map((f) => ({ x: f.x, y: f.y - GROUP_TAB_H, w: Math.max(f.w, tabW(f)), h: f.h + GROUP_TAB_H }))];
  const columns = layoutOrientation(model, Object.fromEntries([...boxes].map(([id, b]) => [id, { width: b.w, height: b.h }]))) === "columns";
  const minX = all.length ? Math.min(...extent.map((b) => b.x)) - PAD : 0;
  const name = model.name || UNTITLED_MODEL;
  const diagramMaxX = all.length ? Math.max(...extent.map((b) => b.x + b.w)) + PAD : 2 * PAD;
  const tb = svgTitleBlock(model, theme, view, model.nodes.length - faded.size, diagramMaxX - minX - 2 * PAD, stateLabel, whole.nodes.length);
  const titleWidth = tb.width;
  const maxX = Math.max(
    diagramMaxX,
    hl?.caption ? minX + 2 * PAD + Math.max(hl.caption.text.length, hl.caption.reserve ?? 0) * 7.6 : -Infinity,
    minX + 2 * PAD + titleWidth,
  );
  const titleH = tb.height;
  const minY = (all.length ? Math.min(...extent.map((b) => b.y)) - PAD : 0) - titleH - (hl?.caption ? CAPTION_H : 0);
  const maxY = all.length ? Math.max(...extent.map((b) => b.y + b.h)) + PAD : 2 * PAD;
  const width = hl?.caption ? Math.ceil(maxX - minX) : maxX - minX;
  const height = maxY - minY;

  const classOf = (id: string) => model.nodes.find((n) => n.id === id)?.class ?? "";
  const shapes = new Set<MarkerShape>();
  const edges: string[] = [];
  // Relationships that carried impact are drawn last, over the others.
  const order = hl ? [...model.edges.filter((e) => !hl.edges.has(e.id)), ...model.edges.filter((e) => hl.edges.has(e.id))] : model.edges;
  const routed = model.edges.flatMap((e) => {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    if (!a || !b) return [];
    const [ss, ts] = edgeEnds(e.ports, a, b, columns);
    const s = anchor(a, ss);
    const t = anchor(b, ts);
    // The same router as the canvas, so the image matches the screen.
    const { path: pathD, label: mid } = edgePath({ x: s.x, y: s.y, side: ss }, { x: t.x, y: t.y, side: ts }, lines);
    const am = amOnly ? edgeNotation(archimateRelationshipFor(classOf(e.from), classOf(e.to))) : undefined;
    const label = am ? am.type : e.type.startsWith("reference:") ? "reference" : (e.type.split("::")[0] ?? e.type);
    return [{ e, pathD, mid, am, label, span: Math.hypot(t.x - s.x, t.y - s.y) }];
  });
  // Labels keep clear of element boxes and of each other, as on the canvas (M50).
  const planned = new Map(planLabels(routed.map((r) => ({ id: r.e.id, path: r.pathD, label: showLabels ? r.label : "", middle: r.mid, span: r.span })), all).map((l) => [l.id, l.at]));
  for (const e of order) {
    const r = routed.find((x) => x.e.id === e.id);
    if (!r) continue;
    const { pathD, am, label } = r;
    const mid = planned.get(e.id) ?? r.mid;
    const lw = label.length * 6.6 + 8;
    const carried = hl?.edges.get(e.id);
    let ends = ` marker-end="url(#${carried ? "arrow-blast" : "arrow"})"`;
    if (am) {
      // The current hop's dash replaces the notation's dash, as on the canvas.
      ends = (am.dash && !carried?.current ? ` stroke-dasharray="${am.dash}"` : "") + (am.atFrom ? ` marker-start="url(#am-${am.atFrom})"` : "") + (am.atTo ? ` marker-end="url(#am-${am.atTo})"` : "");
      if (am.atFrom) shapes.add(am.atFrom);
      if (am.atTo) shapes.add(am.atTo);
    }
    // Planned and retiring (M71) dash as on the canvas, unless the notation or the current hop dashes it.
    const planDash = !am?.dash && !carried?.current ? (e.plan === "planned" ? ` stroke-dasharray="14 4 2 4"` : e.plan === "retiring" ? ` stroke-dasharray="2 5" stroke-linecap="round"` : "") : "";
    const stroke = (carried ? `stroke="${hl?.flow ? p.ai : p.status}" stroke-width="2.5"${carried.current ? ` stroke-dasharray="10 6"` : ""}` : `stroke="${p.line}" stroke-width="1.25"`) + planDash;
    // A relationship to a faded element fades with it, as on the canvas: the line only, so its label
    // (muted ink on the background) stays readable.
    const fade = faded.has(e.from) || faded.has(e.to);
    edges.push(`<path d="${pathD}" fill="none" ${stroke}${ends}${fade ? ` opacity="0.2" data-faded=""` : ""} data-edge="${esc(e.id)}"${e.plan ? ` data-plan="${e.plan}"` : ""}/>`);
    if (showLabels)
      edges.push(
        `<rect x="${r1(mid.x - lw / 2)}" y="${r1(mid.y - 8)}" width="${r1(lw)}" height="16" fill="${p.bg}"/>`,
        `<text x="${r1(mid.x)}" y="${r1(mid.y + 4)}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${p.muted}">${esc(label)}</text>`,
      );
  }

  const nodes: string[] = [];
  for (const n of model.nodes) {
    const b = boxes.get(n.id)!;
    const layer = classById(n.class)?.layer ?? "design";
    const alt = altOf(n.class);
    // Faded by the view (M54): a ghost, as on the canvas: no fill, a dashed outline and bar, and text in
    // the muted ink, which keeps 4.5:1 on the background, so the element stays readable.
    const ghost = faded.has(n.id);
    const cls = b.lines
      .map((l, i) => `<text x="${b.x + 14}" y="${b.y + 22 + i * 14}" font-family="${MONO}" font-size="10" letter-spacing="1.2" fill="${ghost ? p.muted : amOnly ? (fillOf(n.class) ? archimateTypeInk[theme] : p.ai) : p.muted}">${esc(l)}</text>`)
      .join("");
    const slot = slotFor?.(n) ?? null;
    // Planned (M71): a dotted outline, as on the canvas; Retiring: the name struck through.
    const shownName = clip(n.name || "Untitled", NAME_CHARS);
    const nameY = b.y + b.h - 14 - (alt ? 20 : 0);
    nodes.push(
      `<g${ghost ? ` data-faded=""` : ""}><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${ghost ? p.bg : (fillOf(n.class) ?? p.node)}" stroke="${p.line}"${ghost ? ` stroke-dasharray="4 3"` : n.plan === "planned" ? ` stroke-dasharray="2 3" stroke-width="1.5"` : ""} data-node="${esc(n.id)}"${n.plan ? ` data-plan="${n.plan}"` : ""}/>` +
        `<rect x="${b.x}" y="${b.y}" width="4" height="${b.h}" fill="${ghost ? p.line : slot === null ? layerColor(p, layer) : slotColor(slot, theme)}"/>` +
        (slot === null ? "" : `<path data-slot="${slot}" d="${slotMarker(slot)}" transform="translate(${b.x + b.w - 18} ${b.y + 8})" fill="${slotColor(slot, theme)}" fill-rule="evenodd"${ghost ? ` opacity="0.4"` : ""}/>`) +
        cls +
        `<text x="${b.x + 14}" y="${nameY}" font-family="${SANS}" font-size="14" font-weight="500" fill="${ghost ? p.muted : p.ink}">${esc(shownName)}</text>` +
        (n.plan === "retiring" ? `<line data-strike="" x1="${b.x + 14}" y1="${nameY - 5}" x2="${r1(b.x + 14 + Math.min(shownName.length * 7.8, b.w - 24))}" y2="${nameY - 5}" stroke="${ghost ? p.muted : p.ink}" stroke-width="1.5"/>` : "") +
        (alt
          ? `<line x1="${b.x + 14}" y1="${b.y + b.h - 26}" x2="${b.x + b.w - 10}" y2="${b.y + b.h - 26}" stroke="${p.line}" stroke-opacity="0.4"/>` +
            `<text x="${b.x + 14}" y="${b.y + b.h - 10}" font-family="${MONO}" font-size="10" fill="${ghost ? p.muted : p.ai}">ArchiMate · ${esc(alt)}</text>`
          : "") +
        `</g>`,
    );
  }
  // Blast radius marks go over every element, so a badge is never hidden by a neighbor.
  if (hl) {
    for (const n of model.nodes) {
      const mark = hl.nodes.get(n.id);
      if (!mark) continue;
      const b = boxes.get(n.id)!;
      const color = hl.flow ? p.ai : mark.hop > 0 ? p.status : hl.impact ? p.invalid : p.accent;
      const glyph = mark.hop > 0 ? String(mark.hop) : hl.flow ? "▶" : hl.impact ? "×" : "◎";
      nodes.push(
        `<g data-blast="${mark.hop === 0 ? "start" : "reached"}" data-blast-hop="${mark.hop}">` +
          `<rect x="${b.x - 5}" y="${b.y - 5}" width="${b.w + 10}" height="${b.h + 10}" fill="none" stroke="${color}" stroke-width="${mark.current ? 3.5 : 2.5}"/>` +
          `<circle cx="${b.x}" cy="${b.y}" r="11" fill="${color}"/><text x="${b.x}" y="${b.y + 4}" text-anchor="middle" font-family="${MONO}" font-size="12" font-weight="600" fill="${p.onBadge}">${glyph}</text>` +
          `</g>`,
      );
    }
  }
  // Title block at the top, aligned with the leftmost element; a blast caption goes below it.
  const tx = minX + PAD;
  const titleBlock = tb.render(tx, minY);
  const capY = minY + titleH;
  const caption = hl?.caption
    ? `<text x="${tx}" y="${capY + 20}" font-family="${MONO}" font-size="10" letter-spacing="1.4" fill="${hl.flow ? p.ai : p.status}">${esc(hl.caption.label.toUpperCase())}</text>` +
      `<text x="${tx}" y="${capY + 38}" font-family="${SANS}" font-size="14" font-weight="500" fill="${p.ink}">${esc(hl.caption.text)}</text>`
    : "";

  const title = esc(name);
  const desc = esc(
    amOnly
      ? `CSDM model with ${model.nodes.length} elements and ${model.edges.length} relationships, shown as an ArchiMate 3.2 view (ArchiMate element types, relationship notation and layer colors), exported from Blueprint Modeler.`
      : `CSDM model with ${model.nodes.length} elements and ${model.edges.length} relationships${showsArchimate(lens) ? ", with ArchiMate 3.2 element names" : ""}, exported from Blueprint Modeler.`,
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="t d">`,
    `<title id="t">${title}</title><desc id="d">${desc}</desc>`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${p.line}"/></marker>${
      hl ? `<marker id="arrow-blast" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${hl.flow ? p.ai : p.status}"/></marker>` : ""
    }${[...shapes]
      .sort()
      .map((shape) => markerSvg(`am-${shape}`, shape, p.line, p.bg))
      .join("")}</defs>`,
    `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${p.bg}"/>`,
    ...titleBlock,
    ...frames.map(
      (f) =>
        `<g data-group-frame="${esc(f.key)}"><rect x="${r1(f.x)}" y="${r1(f.y)}" width="${r1(f.w)}" height="${r1(f.h)}" fill="none" stroke="${p.line}" stroke-dasharray="6 4"/>` +
        `<rect x="${r1(f.x)}" y="${r1(f.y - GROUP_TAB_H)}" width="${r1(tabW(f))}" height="${GROUP_TAB_H}" fill="${p.bg}" stroke="${p.line}"/>` +
        `<text x="${r1(f.x + 8)}" y="${r1(f.y - 5)}" font-family="${MONO}" font-size="11" fill="${p.muted}">${esc(tabText(f))}</text></g>`,
    ),
    ...edges,
    ...nodes,
    ...(caption ? [caption] : []),
    `</svg>`,
    "",
  ].join("\n");
}
