"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { capabilityMapSvg } from "@/io/capmap";
import { downloadText } from "@/io/download";
import { fileBase } from "@/io/file";
import { pngScale, svgToPng } from "@/io/png";
import type { SvgTheme } from "@/io/svg";
import {
  allTiles,
  capabilityLegend,
  capabilityMap,
  coloringWords,
  COLOR_BY_LABEL,
  count,
  filterActive,
  inView,
  slotMap,
  slotMarker,
  tileCounts,
  UNTITLED_MODEL,
  valueLabels,
  type CapabilityTile,
  type Model,
} from "@/model";
import { SlotMarker, shownColorTags, type ShownView } from "./Views";

/**
 * A tile's width in rem: a leaf's, or as wide as about √n of its children side by side (as the
 * picture lays them out), so a parent shows its parts in rows, not one column.
 */
function widthRem(t: CapabilityTile): number {
  if (!t.children.length) return 13;
  const ws = t.children.map(widthRem);
  const cols = Math.ceil(Math.sqrt(ws.length));
  return Math.max(Math.max(...ws), ws.slice(0, cols).reduce((a, w) => a + w, 0) + (cols - 1) * 0.75) + 1.5;
}

const btn = "inline-flex min-h-8 cursor-pointer items-center border border-border-strong bg-surface-raised px-2.5 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";

/**
 * M92: the model's Business Capabilities as nested tiles, each inside its parent, counting the
 * Business Applications that support it. Tiles take the view's coloring, and what its filter leaves
 * out is faded. A tile goes to its capability on the canvas. Saved as an image (SVG or PNG).
 * A modal dialog; Escape or Close closes it.
 */
export function CapabilityMapDialog({ model, shown, onGoTo, onClose }: { model: Model; shown: ShownView; onGoTo: (id: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [theme, setTheme] = useState<SvgTheme>("light");
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  const tags = shownColorTags(shown);
  const colored = shown.colorBy !== "layer";
  const filtered = filterActive(shown.filter);
  const tiles = useMemo(() => capabilityMap(model), [model]);
  const caps = allTiles(tiles).length;
  const entries = useMemo(() => (colored ? capabilityLegend(model, shown.colorBy, shown.filter, tags) : []), [model, colored, shown.colorBy, shown.filter, tags]);
  const slotOf = useMemo(() => slotMap(model, shown.colorBy, tags), [model, shown.colorBy, tags]);
  const valueOf = useMemo(() => valueLabels(model, shown.colorBy, tags), [model, shown.colorBy, tags]);
  const byId = useMemo(() => new Map(model.nodes.map((n) => [n.id, n])), [model]);
  const kept = allTiles(tiles).filter((t) => inView(byId.get(t.id)!, shown.filter, model)).length;
  const viewName = model.views?.find((v) => v.id === shown.id)?.name;

  const picture = (t: SvgTheme) => capabilityMapSvg(model, t, { filter: shown.filter, colorBy: shown.colorBy, colorTags: tags, ...(viewName ? { name: viewName } : {}) });
  const base = `${fileBase(model)}-capability-map-${theme}`;
  const saveSvg = () => {
    downloadText(`${base}.svg`, picture(theme), "image/svg+xml");
    setStatus(`Saved ${base}.svg.`);
  };
  const savePng = () => {
    const svg = picture(theme);
    const size = /width="([\d.]+)" height="([\d.]+)"/.exec(svg);
    setStatus(`Making ${base}.png…`);
    void svgToPng(svg, size ? pngScale(Number(size[1]), Number(size[2])) : 2)
      .then(({ blob, width, height }) =>
        blob.arrayBuffer().then((buf) => {
          downloadText(`${base}.png`, new Uint8Array(buf), "image/png");
          setStatus(`Saved ${base}.png (${width} × ${height} px).`);
        }),
      )
      .catch(() => setStatus("Could not make the PNG in this browser. Nothing was saved."));
  };

  // A plain function, not a component: a component made here would be new each render and lose focus.
  const tileItem = (tile: CapabilityTile, depth: number) => {
    const n = byId.get(tile.id)!;
    const slot = slotOf ? slotOf(n) : null;
    const faded = filtered && !inView(n, shown.filter, model);
    const also = tile.alsoUnder.map((id) => byId.get(id)?.name || "Untitled");
    return (
      <li
        key={tile.id}
        data-cap={tile.id}
        data-slot={slot ?? undefined}
        data-faded={faded ? "" : undefined}
        // Faded by the view: a ghost, as on the canvas (no fill, dashed, muted text that keeps 4.5:1).
        className={`flex flex-col border border-border-strong ${faded ? "border-dashed bg-transparent" : depth % 2 ? "bg-surface" : "bg-surface-raised"}`}
        style={{
          flex: `1 1 ${widthRem(tile)}rem`,
          minWidth: `min(${widthRem(tile)}rem, 100%)`,
          // The view's color as a bar along the top; a faded tile keeps only its dashed outline.
          ...(slot !== null && !faded ? { borderTopWidth: 6, borderTopColor: `var(--slot-${slot})` } : {}),
        }}
      >
        <button
          type="button"
          className="group relative cursor-pointer px-3 pt-2 pb-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          onClick={() => onGoTo(tile.id)}
        >
          {slot !== null && (
            <svg aria-hidden="true" viewBox="0 0 10 10" className={`absolute top-2.5 right-2.5 size-2.5 ${faded ? "opacity-40" : ""}`} style={{ fill: `var(--slot-${slot})` }}>
              <path d={slotMarker(slot)} fillRule="evenodd" />
            </svg>
          )}
          <span className={`block pr-4 font-medium group-hover:text-accent ${faded ? "text-ink-muted" : "text-ink"}`}>{n.name || "Untitled"}</span>
          <span className="mt-0.5 block text-xs text-ink-muted">{tileCounts(tile)}</span>
          {also.length > 0 && <span className="mt-0.5 block text-xs text-ink-muted">Also in {also.join(", ")}</span>}
          <span className="sr-only">
            {colored ? `. ${COLOR_BY_LABEL[shown.colorBy]}: ${valueOf(n)}` : ""}
            {faded ? ". Outside the view's filter" : ""}
          </span>
        </button>
        {tile.children.length > 0 && (
          <ul aria-label={`Inside ${n.name || "Untitled"}`} className="flex flex-wrap gap-3 px-3 pb-3">
            {tile.children.map((c) => tileItem(c, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${uid}-title`}
      aria-describedby={`${uid}-help`}
      data-testid="capability-map"
      onClose={onClose}
      className="m-auto flex h-[calc(100dvh-2rem)] w-[min(80rem,calc(100vw-2rem))] max-w-none flex-col border border-border-strong bg-surface p-0 text-ink backdrop:bg-black/40 [&:not([open])]:hidden"
    >
      <div className="border-b border-border px-4 py-3">
        <h2 id={`${uid}-title`} className="text-base font-medium">
          Capability map of “{model.name || UNTITLED_MODEL}”
        </h2>
        <p id={`${uid}-help`} className="mt-1 text-sm text-ink-muted">
          {caps
            ? `${count(caps, "Business Capability", "Business Capabilities")}, each inside its parent. A tile counts the Business Applications that support it, and those of the capabilities inside it. Choose one to go to it on the canvas.`
            : "This model has no Business Capabilities yet. Add one from the palette; connect it to another to make that one its parent."}
        </p>
      </div>
      {caps > 0 && (colored || filtered) && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 pt-3 text-sm" data-testid="capability-map-legend">
          <p className="text-ink-soft">
            {viewName ? `View: ${viewName}. ` : ""}
            {colored ? `Colored by ${coloringWords(shown.colorBy, tags)}, as the view is.` : ""}
            {filtered ? ` Showing ${kept} of ${count(caps, "capability", "capabilities")}; the rest are faded.` : ""}
          </p>
          {colored && (
            <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1">
              {entries.map((e) => (
                <li key={e.key} className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <SlotMarker entry={e} />
                  <span className={e.slot === "none" ? "text-ink-muted" : ""}>{e.label}</span>
                  <span className="font-mono text-ink-muted">{e.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p role="status" className="px-4 pt-2 text-sm text-ink-muted">
        {status}
      </p>
      <div className="mx-4 my-2 min-h-0 flex-1 overflow-auto">
        {caps > 0 && (
          <ul aria-label="Business Capabilities" className="flex flex-wrap items-start gap-3">
            {tiles.map((t) => tileItem(t, 0))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
        <label className="mr-auto flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Image theme</span>
          <select className="min-h-8 border border-border-strong bg-surface-raised px-2 text-sm text-ink" value={theme} onChange={(e) => setTheme(e.target.value as SvgTheme)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <button type="button" className={btn} disabled={!caps} onClick={saveSvg}>
          Save as SVG
        </button>
        <button type="button" className={btn} disabled={!caps} onClick={savePng}>
          Save as PNG
        </button>
        <button type="button" className={btn} onClick={() => dialog.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}
