"use client";

import { useEffect, useId, useRef, useState } from "react";
import { exampleCategories, examples } from "@/examples";

/**
 * The toolbar's Examples menu: a disclosure button opening a panel of categories, each listing its
 * examples with a short summary, Blank model first. Escape, a click outside or focus leaving the
 * panel closes it; Escape and a choice return focus to the button. The panel spans the toolbar
 * (its positioned ancestor), one column on narrow screens.
 */
export function ExamplesMenu({ onPick, onBlank, buttonClass }: { onPick: (id: string) => void; onBlank: () => void; buttonClass: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    // Escape closes it wherever focus is (a click on a heading in the panel leaves focus on the
    // page). Marked handled, so the editor's own Escape (closing a blast radius) skips it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const choose = (run: () => void) => {
    setOpen(false);
    button.current?.focus();
    run();
  };

  return (
    <div
      ref={root}
      onBlur={(e) => {
        // Tabbing out of the panel closes it, so it never sits over the control that has focus.
        if (open && e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button ref={button} type="button" className={buttonClass} aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen((o) => !o)}>
        Examples <span aria-hidden="true">▾</span>
      </button>
      <div
        id={`${id}-panel`}
        hidden={!open}
        data-testid="examples-menu"
        className="absolute inset-x-4 top-full z-30 mt-1 max-h-[min(70vh,40rem)] max-w-5xl overflow-y-auto border border-border-strong bg-surface-raised p-4 shadow-lg"
      >
        <button
          type="button"
          aria-labelledby={`${id}-blank-name`}
          aria-describedby={`${id}-blank-summary`}
          className="w-full cursor-pointer border border-accent px-3 py-2 text-left hover:bg-surface focus-visible:bg-surface sm:w-auto"
          onClick={() => choose(onBlank)}
        >
          <span id={`${id}-blank-name`} className="block text-sm font-medium text-ink">
            Blank model
          </span>
          <span id={`${id}-blank-summary`} className="block text-xs text-ink-muted">
            An empty canvas: add elements from the palette.
          </span>
        </button>
        <div className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          {exampleCategories.map((c) => (
            <section key={c.id} aria-labelledby={`${id}-${c.id}`}>
              <h2 id={`${id}-${c.id}`} className="font-mono text-[0.65rem] tracking-[0.14em] text-accent uppercase">
                {c.label}
              </h2>
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {examples
                  .filter((ex) => ex.category === c.id)
                  .map((ex) => (
                    <li key={ex.id}>
                      <button
                        type="button"
                        data-name={ex.name /* read by the e2e helpers to list the examples */}
                        aria-labelledby={`${id}-${ex.id}-name`}
                        aria-describedby={`${id}-${ex.id}-summary`}
                        className="w-full cursor-pointer px-2 py-1.5 text-left hover:bg-surface focus-visible:bg-surface"
                        onClick={() => choose(() => onPick(ex.id))}
                      >
                        <span id={`${id}-${ex.id}-name`} className="block text-sm font-medium text-ink">
                          {ex.name}
                        </span>
                        <span id={`${id}-${ex.id}-summary`} className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                          {ex.summary}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
