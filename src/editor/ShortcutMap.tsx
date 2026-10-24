"use client";

import { useEffect, useRef, useState } from "react";
import { isMac, keyLabel } from "./CommandPalette";

/** Every keyboard shortcut the editor answers, by where it works. Keep in step with the handlers in Editor and its panels. */
export const SHORTCUTS: { area: string; keys: { keys: string[]; does: string }[] }[] = [
  {
    area: "Anywhere in the editor",
    keys: [
      { keys: ["Ctrl+K"], does: "Command palette: every command, and every element by name" },
      { keys: ["?"], does: "This list of shortcuts" },
      { keys: ["Ctrl+Z"], does: "Undo" },
      { keys: ["Ctrl+Shift+Z", "Ctrl+Y"], does: "Redo" },
      { keys: ["Esc"], does: "Close a menu, dialog, blast radius or data flow" },
    ],
  },
  {
    area: "Canvas",
    keys: [
      { keys: ["Shift+1"], does: "Fit view" },
      { keys: ["Shift+2"], does: "Zoom to selection" },
      { keys: ["Shift+0"], does: "Zoom to 100%" },
      { keys: ["Tab"], does: "Move to the next element or relationship" },
      { keys: ["Enter", "Space"], does: "Select the focused element" },
      { keys: ["Arrow keys"], does: "Move the selected element (with Shift: 4× as far)" },
      { keys: ["Space"], does: "Hold and drag to pan" },
      { keys: ["Shift+F10", "Menu"], does: "Menu for the focused element, relationship, layer or canvas" },
      { keys: ["Shift+A"], does: "Add a new element related to the focused or selected one" },
      { keys: ["Delete", "Backspace"], does: "Delete the selected element or relationship" },
      { keys: ["Arrow keys"], does: "Move a focused layer label 16 px (with Shift: 64 px)" },
      { keys: ["Esc"], does: "Unselect a layer label, or hide suggested relationships" },
    ],
  },
  {
    area: "Side panel",
    keys: [
      { keys: ["Enter"], does: "Save a name or other one-line field" },
      { keys: ["Ctrl+Enter"], does: "Save a description" },
      { keys: ["Esc"], does: "Put back what the field had" },
      { keys: ["←", "→"], does: "Switch between the Details, Hints and Read tabs" },
    ],
  },
  {
    area: "Presenting",
    keys: [
      { keys: ["→", "Page Down", "Space"], does: "Next layer" },
      { keys: ["←", "Page Up"], does: "Previous layer" },
      { keys: ["Home"], does: "Overview" },
      { keys: ["Esc"], does: "Stop presenting" },
    ],
  },
];

const kbd = "border border-border-strong bg-surface px-1.5 font-mono text-xs text-ink";

/** The shortcut map (M52): a modal dialog listing SHORTCUTS. Mounted while open; Escape or Close shuts it. */
export function ShortcutMap({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mac] = useState(isMac);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="shortcuts-title"
      data-testid="shortcut-map"
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] border border-border-strong bg-surface p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="shortcuts-title" className="text-base font-medium">
          Keyboard shortcuts
        </h2>
        <button
          type="button"
          className="inline-flex min-h-8 cursor-pointer items-center border border-border-strong bg-surface-raised px-2.5 text-sm text-ink hover:border-accent hover:text-accent"
          onClick={() => dialog.current?.close()}
        >
          Close
        </button>
      </div>
      <div className="grid gap-x-8 gap-y-5 px-4 py-4 sm:grid-cols-2">
        {SHORTCUTS.map((s) => (
          <section key={s.area} aria-labelledby={`shortcuts-${s.area}`}>
            <h3 id={`shortcuts-${s.area}`} className="font-mono text-[0.65rem] tracking-[0.14em] text-ink-muted uppercase">
              {s.area}
            </h3>
            <dl className="mt-2 flex flex-col gap-1.5 text-sm">
              {s.keys.map((k) => (
                <div key={k.does} className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-soft">{k.does}</dt>
                  <dd className="flex shrink-0 flex-wrap justify-end gap-1">
                    {k.keys.map((key, i) => (
                      <span key={key} className="flex items-baseline gap-1">
                        {i > 0 && <span className="text-xs text-ink-muted">or</span>}
                        <kbd className={kbd}>{keyLabel(key, mac)}</kbd>
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      {mac && <p className="border-t border-border px-4 py-2 text-xs text-ink-muted">⌘ is the Command key.</p>}
    </dialog>
  );
}
