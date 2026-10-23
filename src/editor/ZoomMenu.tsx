"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useStore } from "@xyflow/react";
import { ToolbarIcon } from "./ToolbarIcon";

/** The zoom levels the menu jumps to; the canvas allows 0.2–2 (React Flow's default maxZoom). */
export const ZOOM_PRESETS = [0.5, 1, 2] as const;

export type ZoomCommand = "fit" | "selection" | (typeof ZOOM_PRESETS)[number];

/**
 * Toolbar menu over the viewport: the current zoom as its label, then Fit, Zoom to selection and
 * the presets. The same commands answer Shift+1, Shift+2 and Shift+0 on the canvas (see Editor).
 */
export function ZoomMenu({ onCommand, canZoomToSelection, buttonClass }: { onCommand: (c: ZoomCommand) => void; canZoomToSelection: boolean; buttonClass: string }) {
  const zoom = useStore((s) => s.transform[2]);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const run = (c: ZoomCommand) => {
    setOpen(false);
    onCommand(c);
    button.current?.focus();
  };
  const item = "flex w-full cursor-pointer items-center justify-between gap-4 px-3 py-2 text-left text-sm text-ink hover:bg-surface focus-visible:bg-surface disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent";
  const key = "font-mono text-xs text-ink-muted";
  const percent = `${Math.round(zoom * 100)}%`;

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button ref={button} type="button" className={`${buttonClass} min-w-24`} aria-expanded={open} aria-controls={listId} aria-label={`Zoom, ${percent}`} data-testid="zoom-menu" onClick={() => setOpen((o) => !o)}>
        <ToolbarIcon name="zoom" />
        <span aria-hidden="true">{percent}</span> <span aria-hidden="true">▾</span>
      </button>
      <ul id={listId} hidden={!open} className="absolute left-0 z-20 mt-1 w-56 border border-border-strong bg-surface-raised py-1">
        <li>
          <button type="button" className={item} onClick={() => run("fit")} aria-keyshortcuts="Shift+1">
            Fit view <kbd className={key}>Shift+1</kbd>
          </button>
        </li>
        <li>
          <button type="button" className={item} disabled={!canZoomToSelection} onClick={() => run("selection")} aria-keyshortcuts="Shift+2">
            Zoom to selection <kbd className={key}>Shift+2</kbd>
          </button>
        </li>
        <li aria-hidden="true" className="my-1 border-t border-border" />
        {ZOOM_PRESETS.map((z) => (
          <li key={z}>
            <button type="button" className={item} aria-pressed={Math.abs(zoom - z) < 0.005} onClick={() => run(z)} aria-keyshortcuts={z === 1 ? "Shift+0" : undefined}>
              {z * 100}% {z === 1 && <kbd className={key}>Shift+0</kbd>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
