import { allTiles, capabilityLegend, capabilityMap, count, filterActive, inView, slotColor, slotMap, slotMarker, tileCounts, UNTITLED_MODEL, type CapabilityTile, type Model, type Slot } from "@/model";
import { clip, esc, MONO, palettes, SANS, svgTitleBlock, type SvgTheme, type SvgView } from "./svg";

/** Tile geometry: a leaf's width, the colored bar, padding, the gap between tiles, line heights. */
const T = { w: 216, bar: 6, pad: 12, gap: 12, name: 18, nameChars: 24, counts: 16, top: 10, bottom: 12 } as const;
/** Characters of the 9px uppercase mono "also in" line a tile's width holds. */
const alsoChars = (w: number) => Math.floor((w - 2 * T.pad) / 5.6);
const PAD = 32;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** A name in at most two lines of `width` characters, the second ending with "…" when it doesn't fit. */
function nameLines(name: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of name.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length <= 2) return lines.map((l) => clip(l, width));
  return [lines[0]!, clip(`${lines[1]}…`, width)].map((l) => clip(l, width));
}

type Placed = { tile: CapabilityTile; x: number; y: number; w: number; h: number; head: number; name: string[]; counts: string[]; depth: number; children: Placed[] };

/** Sizes in rows of about √n, each row as wide as its first √n sizes, wrapping when the next doesn't fit. */
function pack(sizes: { w: number; h: number }[]): { at: { x: number; y: number }[]; w: number; h: number } {
  if (!sizes.length) return { at: [], w: 0, h: 0 };
  const cols = Math.ceil(Math.sqrt(sizes.length));
  const widest = Math.max(...sizes.map((s) => s.w));
  const row = Math.max(widest, sizes.slice(0, cols).reduce((a, s) => a + s.w, 0) + (cols - 1) * T.gap);
  const at: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  let w = 0;
  for (const s of sizes) {
    if (x > 0 && x + s.w > row) {
      y += rowH + T.gap;
      x = 0;
      rowH = 0;
    }
    at.push({ x, y });
    x += s.w + T.gap;
    rowH = Math.max(rowH, s.h);
    w = Math.max(w, x - T.gap);
  }
  return { at, w, h: y + rowH };
}

/**
 * Every tile's size, with the capabilities inside it laid out (positions relative to the tile), built
 * bottom up without recursion. `marked`: tiles carry a color marker, so names leave it room.
 */
function measure(model: Model, tiles: CapabilityTile[], marked: boolean): Placed[] {
  const names = new Map(model.nodes.map((n) => [n.id, n.name]));
  const depth = new Map<string, number>();
  for (const t of tiles) depth.set(t.id, 0);
  const order = allTiles(tiles);
  for (const t of order) for (const c of t.children) depth.set(c.id, depth.get(t.id)! + 1);
  const placed = new Map<string, Placed>();
  for (const tile of [...order].reverse()) {
    const name = nameLines(names.get(tile.id) || "Untitled", marked ? T.nameChars - 3 : T.nameChars);
    // The counts, one part a line: "2 Business Applications", "5 with its parts".
    const counts = tileCounts(tile).split(" · ");
    const head = T.bar + T.top + name.length * T.name + 4 + counts.length * T.counts + T.bottom;
    const kids = tile.children.map((c) => placed.get(c.id)!);
    const packed = pack(kids);
    kids.forEach((k, i) => {
      k.x = T.pad + packed.at[i]!.x;
      k.y = head + packed.at[i]!.y;
    });
    const w = Math.max(T.w, kids.length ? packed.w + 2 * T.pad : 0);
    const h = kids.length ? head + packed.h + T.pad : head;
    placed.set(tile.id, { tile, x: 0, y: 0, w, h, head, name, counts, depth: depth.get(tile.id)!, children: kids });
  }
  return tiles.map((t) => placed.get(t.id)!);
}

/**
 * M92: the capability map as a standalone SVG in the chosen theme. Each Business Capability is a tile
 * inside its parent's, naming how many Business Applications support it (and its parts). With a view,
 * tiles take its coloring (a colored bar and marker, a legend in the title block) and what its filter
 * leaves out is faded.
 */
export function capabilityMapSvg(model: Model, theme: SvgTheme, view?: SvgView): string {
  const p = palettes[theme];
  const tiles = capabilityMap(model);
  const caps = allTiles(tiles).length;
  const colored = view && view.colorBy !== "layer" ? view : undefined;
  const shownView = view && (colored || filterActive(view.filter)) ? view : undefined;
  const slotOf = colored ? slotMap(model, colored.colorBy, colored.colorTags) : null;
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  const faded = (id: string) => !!shownView && !inView(byId.get(id)!, shownView.filter, model);

  const roots = measure(model, tiles, !!slotOf);
  const packed = pack(roots);
  const lead = caps ? `${count(caps, "Business Capability", "Business Capabilities")}, each inside its parent; a tile counts the Business Applications that support it.` : "No Business Capabilities in this model.";
  const tb = svgTitleBlock(model, theme, shownView, allTiles(tiles).filter((t) => !faded(t.id)).length, Math.max(packed.w, 480), "", caps, {
    entries: colored ? capabilityLegend(model, colored.colorBy, colored.filter, colored.colorTags) : undefined,
    counted: "capabilities",
  });
  const leadH = 28;
  const top = PAD / 2 + tb.height + leadH;
  const width = r1(Math.max(packed.w, tb.width, lead.length * 7) + 2 * PAD);
  const height = r1(top + packed.h + PAD);

  const out: string[] = [];
  const draw = (t: Placed, x: number, y: number) => {
    const slot: Slot | null = slotOf ? slotOf(byId.get(t.tile.id)!) : null;
    // Faded by the view: a ghost, as the canvas pictures draw one (no fill, dashed, muted text that keeps 4.5:1).
    const ghost = faded(t.tile.id);
    const fill = ghost ? p.bg : t.depth % 2 ? p.bg : p.node;
    const attrs = `${ghost ? ' data-faded=""' : ""}${slot !== null ? ` data-slot="${slot}"` : ""}`;
    out.push(`<g data-cap="${esc(t.tile.id)}"${attrs}><rect x="${r1(x)}" y="${r1(y)}" width="${r1(t.w)}" height="${r1(t.h)}" fill="${fill}" stroke="${p.line}"${ghost ? ' stroke-dasharray="4 3"' : ""}/>`);
    if (slot !== null) {
      out.push(`<rect x="${r1(x)}" y="${r1(y)}" width="${r1(t.w)}" height="${T.bar}" fill="${ghost ? p.line : slotColor(slot, theme)}"/>`);
      out.push(slotMarkerSvg(slot, theme, x + t.w - 20, y + T.bar + 6, ghost));
    }
    let ty = y + T.bar + T.top;
    for (const l of t.name) {
      ty += T.name;
      out.push(`<text x="${r1(x + T.pad)}" y="${r1(ty - 4)}" font-family="${SANS}" font-size="14" font-weight="600" fill="${ghost ? p.muted : p.ink}">${esc(l)}</text>`);
    }
    ty += 4;
    for (const l of t.counts) {
      ty += T.counts;
      out.push(`<text x="${r1(x + T.pad)}" y="${r1(ty - 4)}" font-family="${SANS}" font-size="12" fill="${p.muted}">${esc(l)}</text>`);
    }
    if (t.tile.alsoUnder.length) {
      // Drawn once: a second parent is said, not drawn again.
      const also = t.tile.alsoUnder.map((id) => byId.get(id)?.name || "Untitled").join(", ");
      out.push(`<text x="${r1(x + t.w - T.pad)}" y="${r1(y + t.head - T.bottom + 8)}" text-anchor="end" font-family="${MONO}" font-size="9" fill="${p.muted}">${esc(clip(`ALSO IN ${also.toUpperCase()}`, alsoChars(t.w)))}</text>`);
    }
    out.push(`</g>`);
  };
  // Parents first, so a tile is drawn over the one it sits in; no recursion, so any depth draws.
  for (const stack: [Placed, number, number][] = roots.map((r, i) => [r, PAD + packed.at[i]!.x, top + packed.at[i]!.y] as [Placed, number, number]).reverse(); stack.length; ) {
    const [t, x, y] = stack.pop()!;
    draw(t, x, y);
    for (const c of [...t.children].reverse()) stack.push([c, x + c.x, y + c.y]);
  }

  const title = `Capability map: ${model.name || UNTITLED_MODEL}`;
  const desc = `${caps ? `${count(caps, "Business Capability", "Business Capabilities")}, each drawn inside its parent and counting the Business Applications that support it` : "No Business Capabilities"}, exported from Blueprint Modeler.${colored ? " Each capability is colored as the view colors it." : ""}${shownView && filterActive(shownView.filter) ? " Capabilities outside the view's filter are drawn faded, with a dashed outline." : ""}`;
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="t d">`,
    `<title id="t">${esc(title)}</title><desc id="d">${esc(desc)}</desc>`,
    `<defs></defs>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${p.bg}"/>`,
    ...tb.render(PAD, PAD / 2 - 8),
    `<text data-title="lead" x="${PAD}" y="${r1(PAD / 2 + tb.height + 12)}" font-family="${SANS}" font-size="13" fill="${p.muted}">${esc(lead)}</text>`,
    ...out,
    `</svg>`,
  ].join("\n");
}

/** A slot's marker at (x, y), 10px square. */
const slotMarkerSvg = (slot: Slot, theme: SvgTheme, x: number, y: number, ghost: boolean) =>
  `<path d="${slotMarker(slot)}" transform="translate(${r1(x)} ${r1(y)})" fill="${slotColor(slot, theme)}" fill-rule="evenodd"${ghost ? ' opacity="0.4"' : ""}/>`;
