"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import type { Model } from "@/model";
import type { Size } from "@/layout/layout";
import type { SvgHighlight, SvgTheme, SvgView } from "@/io/svg";
import { isoScene, project, type IsoMode } from "@/iso/scene";
import { isoToSvg } from "@/iso/svg";
import type { ZoomCommand } from "./ZoomMenu";
import type { Layer } from "@/metamodel";

/** What the editor can ask of the isometric view: the Zoom menu's commands. */
export type IsoHandle = { zoom: (c: ZoomCommand) => void };

/** The theme being viewed, kept current: the header toggle's choice (data-theme), else the system's. */
function useViewedTheme(): SvgTheme {
  const read = (): SvgTheme => {
    const chosen = document.documentElement.dataset.theme;
    if (chosen === "light" || chosen === "dark") return chosen;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  };
  const [theme, setTheme] = useState<SvgTheme>("dark");
  useEffect(() => {
    const update = () => setTheme(read());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);
  return theme;
}

const MIN = 0.1;
const MAX = 4;
const clamp = (k: number) => Math.min(MAX, Math.max(MIN, k));

/**
 * The isometric view (M59): the same picture as the isometric image export, over the canvas, read
 * only. Drag or arrow keys pan, the wheel or + and − zoom, 0 fits; a click on a block selects its
 * element (the Inspector shows it). Editing stays in Plan.
 */
export function IsoView({
  model,
  mode,
  view,
  highlight,
  sizes,
  selectedId,
  onSelect,
  onZoom,
  lift,
  ref,
}: {
  model: Model;
  mode: IsoMode;
  view?: SvgView;
  highlight?: SvgHighlight;
  sizes: Record<string, Size | undefined>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Tells the Zoom menu the picture's zoom. */
  onZoom?: (k: number) => void;
  /** Present: the layer being shown, lifted. */
  lift?: Layer;
  ref?: Ref<IsoHandle>;
}) {
  const theme = useViewedTheme();
  const box = useRef<HTMLDivElement>(null);
  const svg = useMemo(
    () => isoToSvg(model, theme, { mode, view, highlight, sizes, selectedId, lift, packets: true, idPrefix: "iso-" }).replace(/^<\?xml[^>]*>\n/, ""),
    [model, theme, mode, view, highlight, sizes, selectedId, lift],
  );
  // The picture's own size and origin, from its viewBox.
  const vb = useMemo(() => {
    const m = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
    return m ? { x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) } : { x: 0, y: 0, w: 1, h: 1 };
  }, [svg]);
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });
  useEffect(() => onZoom?.(t.k), [t.k, onZoom]);

  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const k = clamp(Math.min(1, (el.clientWidth / vb.w) * 0.96, (el.clientHeight / vb.h) * 0.96));
    setT({ k, x: (el.clientWidth - vb.w * k) / 2, y: (el.clientHeight - vb.h * k) / 2 });
  }, [vb.w, vb.h]);
  // Fit on entering and when the layers spread or close; not on every edit, so the reader keeps their place.
  const fitted = useRef<string>("");
  const entering = useRef<ReturnType<typeof setTimeout>>(undefined);
  useLayoutEffect(() => {
    const key = `${model.id}:${mode}`;
    if (fitted.current === key) return;
    fitted.current = key;
    fit();
    // Raise the layers into place (CSS, on this element only for the moment, so later redraws such
    // as a new selection do not replay it).
    const el = box.current;
    if (!el) return;
    el.classList.add("iso-entering");
    clearTimeout(entering.current);
    entering.current = setTimeout(() => el.classList.remove("iso-entering"), 1300);
  }, [model.id, mode, fit]);
  useEffect(() => () => clearTimeout(entering.current), []);

  const zoomAt = useCallback((k: number, px: number, py: number) => {
    setT((c) => {
      const nk = clamp(k);
      return { k: nk, x: px - ((px - c.x) * nk) / c.k, y: py - ((py - c.y) * nk) / c.k };
    });
  }, []);
  const center = () => ({ x: (box.current?.clientWidth ?? 0) / 2, y: (box.current?.clientHeight ?? 0) / 2 });

  useImperativeHandle(
    ref,
    () => ({
      zoom: (c: ZoomCommand) => {
        if (c === "fit") fit();
        else if (c === "selection") {
          const b = selectedId ? isoScene(model, mode, sizes, lift).blocks.find((x) => x.id === selectedId) : undefined;
          if (!b) return;
          const at = project({ x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.d / 2, z: b.z + b.h });
          const k = 1.25;
          const m = center();
          setT({ k, x: m.x - (at.x - vb.x) * k, y: m.y - (at.y - vb.y) * k });
        } else {
          const m = center();
          zoomAt(c, m.x, m.y);
        }
      },
    }),
    [fit, model, mode, sizes, lift, selectedId, vb.x, vb.y, zoomAt],
  );

  // Wheel zoom around the pointer (a native listener: React's wheel events are passive).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setT((c) => {
        const nk = clamp(c.k * Math.exp(-e.deltaY * 0.0015));
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        return { k: nk, x: px - ((px - c.x) * nk) / c.k, y: py - ((py - c.y) * nk) / c.k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  return (
    <div
      ref={box}
      data-testid="iso-view"
      data-iso-mode={mode}
      tabIndex={0}
      role="group"
      aria-label={`${mode === "exploded" ? "Exploded" : "Isometric"} view, read only`}
      aria-describedby="iso-view-help"
      className="absolute inset-0 z-10 cursor-grab touch-none overflow-hidden bg-canvas outline-offset-[-2px] select-none active:cursor-grabbing"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, y: e.clientY, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < 4) return;
        d.moved = true;
        d.x = e.clientX;
        d.y = e.clientY;
        setT((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
      }}
      // A cancelled drag (the browser took the pointer) ends without a click.
      onPointerCancel={() => (drag.current = null)}
      onLostPointerCapture={() => (drag.current = null)}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d || d.moved) return;
        // A click, not a drag: select the block under it, or nothing.
        const hit = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.closest("[data-iso-el]"));
        onSelect(hit?.closest("[data-iso-el]")?.getAttribute("data-iso-el") ?? null);
      }}
      onKeyDown={(e) => {
        const m = center();
        const step = 48;
        const keys: Record<string, () => void> = {
          "+": () => zoomAt(t.k * 1.25, m.x, m.y),
          "=": () => zoomAt(t.k * 1.25, m.x, m.y),
          "-": () => zoomAt(t.k / 1.25, m.x, m.y),
          "0": fit,
          ArrowLeft: () => setT((c) => ({ ...c, x: c.x + step })),
          ArrowRight: () => setT((c) => ({ ...c, x: c.x - step })),
          ArrowUp: () => setT((c) => ({ ...c, y: c.y + step })),
          ArrowDown: () => setT((c) => ({ ...c, y: c.y - step })),
        };
        const run = !e.ctrlKey && !e.metaKey && !e.altKey ? keys[e.key] : undefined;
        if (!run) return;
        e.preventDefault();
        e.stopPropagation();
        run();
      }}
    >
      <p id="iso-view-help" className="sr-only">
        The model in isometric: one slab per CSDM layer, Infrastructure lowest and Business highest, each element a block on its layer. Arrow keys pan, plus and minus zoom, 0 fits the view. The Read tab lists the model in words; switch to Plan to edit.
      </p>
      <div
        data-testid="iso-picture"
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`, transformOrigin: "0 0", width: vb.w, height: vb.h }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
