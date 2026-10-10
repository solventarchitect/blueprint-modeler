"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LINE_STYLES, type LineStyle } from "@/layout/edgePath";
import { ToolbarIcon } from "./ToolbarIcon";

export type ViewOptions = { boxes: boolean; lanes: boolean; snap: boolean; extended: boolean; lines: LineStyle };
export const VIEW_KEY = "bm-view";
export const DEFAULT_VIEW: ViewOptions = { boxes: true, lanes: false, snap: false, extended: false, lines: "curved" };

/** Saved options over the defaults; options saved before a key existed (or with a bad value) take the default. */
export function mergeView(saved: unknown): ViewOptions {
  const v = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  const bool = (k: keyof ViewOptions) => (typeof v[k] === "boolean" ? (v[k] as boolean) : (DEFAULT_VIEW[k] as boolean));
  return {
    boxes: bool("boxes"),
    lanes: bool("lanes"),
    snap: bool("snap"),
    extended: bool("extended"),
    lines: LINE_STYLES.includes(v.lines as LineStyle) ? (v.lines as LineStyle) : DEFAULT_VIEW.lines,
  };
}

export function readView(): ViewOptions {
  try {
    return mergeView(JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null"));
  } catch {
    return DEFAULT_VIEW;
  }
}

export function saveView(v: ViewOptions) {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(v));
  } catch {
    // Storage blocked: the options still apply until the page is closed.
  }
}

const lineStyles: { id: LineStyle; label: string }[] = [
  { id: "curved", label: "Curved" },
  { id: "right-angles", label: "Right angles" },
];

const items: { key: "boxes" | "lanes" | "snap" | "extended"; label: string; note: string }[] = [
  { key: "boxes", label: "Layer boxes", note: "A box around each CSDM layer" },
  { key: "lanes", label: "Lanes", note: "Full-width bands; drops settle in their layer" },
  { key: "snap", label: "Snap to grid", note: "Positions snap to 16px" },
  { key: "extended", label: "Extended classes", note: "Strategy, value streams, SDLC, product models, AI, virtualization and security in the palette" },
];

/** Disclosure menu of view toggles. Escape or a click outside closes it. */
export function ViewMenu({ value, onChange, buttonClass }: { value: ViewOptions; onChange: (v: ViewOptions) => void; buttonClass: string }) {
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
      <button ref={button} type="button" className={buttonClass} aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}>
        <ToolbarIcon name="view" />
        View <span aria-hidden="true">▾</span>
      </button>
      <ul id={listId} hidden={!open} className="absolute left-0 z-20 mt-1 w-64 border border-border-strong bg-surface-raised py-1">
        {items.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              aria-pressed={value[it.key]}
              className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-2 text-left hover:bg-surface focus-visible:bg-surface"
              onClick={() => onChange({ ...value, [it.key]: !value[it.key] })}
            >
              <span aria-hidden="true" className={`mt-0.5 flex size-4 shrink-0 items-center justify-center border text-[10px] ${value[it.key] ? "border-accent bg-accent text-accent-ink" : "border-border-strong"}`}>
                {value[it.key] ? "✓" : ""}
              </span>
              <span className="flex flex-col">
                <span className="text-sm text-ink">{it.label}</span>
                <span className="text-xs text-ink-muted">{it.note}</span>
              </span>
            </button>
          </li>
        ))}
        <li className="mt-1 border-t border-border px-3 pt-2 pb-1">
          <span id={`${listId}-lines`} className="text-sm text-ink">
            Line style
          </span>
          <span className="block text-xs text-ink-muted">How relationships are drawn, here and in images</span>
          <span role="group" aria-labelledby={`${listId}-lines`} className="mt-1.5 inline-flex">
            {lineStyles.map((l, i) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={value.lines === l.id}
                className={`inline-flex min-h-8 cursor-pointer items-center border border-border-strong px-2.5 text-xs text-ink-soft hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink aria-pressed:hover:text-accent-ink ${i ? "-ml-px" : ""}`}
                onClick={() => onChange({ ...value, lines: l.id })}
              >
                {l.label}
              </button>
            ))}
          </span>
        </li>
      </ul>
    </div>
  );
}
