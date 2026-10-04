"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { LayoutMode } from "@/layout/layout";
import { ToolbarIcon } from "./ToolbarIcon";
import { useDismiss } from "./useDismiss";

export type LayoutChoice = LayoutMode | "fill";

const choices: { id: LayoutChoice; label: string; note: string }[] = [
  { id: "auto", label: "Auto-layout", note: "Places each element freely within its layer" },
  { id: "rows", label: "Top to bottom", note: "One row per layer, Business at the top" },
  { id: "columns", label: "Left to right", note: "One column per layer, Business on the left" },
  { id: "symmetric", label: "Symmetric", note: "Auto-layout with every layer centered on one axis" },
  { id: "fill", label: "Fill space", note: "Spread the picture, as arranged, to the shape of the view (never zoomed past 100%)" },
];

/**
 * The Layout menu: five arrangements, all by CSDM layer. The button reads "Laying out…" while one
 * runs. Escape or a press outside closes the panel and returns focus to the button.
 */
export function LayoutMenu({ busy, disabled, onChoose, buttonClass }: { busy: boolean; disabled: boolean; onChoose: (choice: LayoutChoice) => void; buttonClass: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, button);

  return (
    <div
      ref={root}
      className="relative"
      onBlur={(e) => {
        // Tabbing out of the panel closes it, so it never sits over the control that has focus.
        if (open && e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      {/* While a layout runs the button is aria-disabled, not disabled, so keyboard focus stays on it. */}
      <button
        ref={button}
        type="button"
        className={`${buttonClass} aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
        disabled={disabled}
        aria-disabled={busy || undefined}
        aria-busy={busy}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => !busy && setOpen((o) => !o)}
      >
        <ToolbarIcon name="layout" />
        {busy ? "Laying out…" : "Layout"} {!busy && <span aria-hidden="true">▾</span>}
      </button>
      <div id={panelId} hidden={!open} data-testid="layout-menu" role="group" aria-labelledby={`${panelId}-heading`} className="absolute left-0 z-20 mt-1 w-80 border border-border-strong bg-surface-raised py-1">
        <p id={`${panelId}-heading`} className="px-3 pt-1.5 pb-1 font-mono text-[10px] tracking-[0.14em] text-ink-muted uppercase">
          Arrange by CSDM layer
        </p>
        <ul>
          {choices.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                aria-labelledby={`${panelId}-${c.id}-name`}
                aria-describedby={`${panelId}-${c.id}-note`}
                className="flex w-full cursor-pointer flex-col px-3 py-2 text-left hover:bg-surface focus-visible:bg-surface"
                onClick={() => {
                  setOpen(false);
                  button.current?.focus();
                  onChoose(c.id);
                }}
              >
                <span id={`${panelId}-${c.id}-name`} className="text-sm text-ink">
                  {c.label}
                </span>
                <span id={`${panelId}-${c.id}-note`} className="text-xs text-ink-muted">
                  {c.note}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="px-3 pt-1 pb-1.5 text-xs text-ink-muted">Each one is a single undo step. Layer boxes and lanes follow the arrangement.</p>
      </div>
    </div>
  );
}
