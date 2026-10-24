"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { filterCommands, type Command } from "./commands";

/** On a Mac the shortcuts read ⌘ where other systems read Ctrl. Only called after a key or click opened a dialog. */
export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const keyLabel = (keys: string, mac: boolean) => (mac ? keys.replace(/Ctrl\+/g, "⌘") : keys);

const kbd = "border border-border-strong bg-surface px-1 font-mono text-[0.7rem] text-ink-muted";

/**
 * The command palette (M52): a modal dialog with a search box over every command in the editor.
 * ARIA combobox: showModal puts focus in the box (its first control) and it stays there, Up and Down move through the list (wrapping), Enter runs the
 * highlighted command, Escape closes. Mounted while open, so each opening starts empty. A command that
 * cannot run now stays listed with its reason. `onClose` gets the chosen command, if any, to run once
 * focus is back where the palette was opened from.
 */
export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: (chosen?: Command) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const chosen = useRef<Command | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [note, setNote] = useState("");
  const listId = useId();
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);
  const current = results[Math.min(active, results.length - 1)];
  const optionId = (i: number) => `${listId}-${i}`;
  const [mac] = useState(isMac);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  useEffect(() => {
    if (current) document.getElementById(optionId(results.indexOf(current)))?.scrollIntoView({ block: "nearest" });
  }); // Follows the highlight after every render.

  const choose = (c: Command | undefined) => {
    if (!c) return;
    if (c.disabled) {
      setNote(`${c.label}: ${c.disabled}`);
      return;
    }
    chosen.current = c;
    dialog.current?.close();
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Commands"
      data-testid="command-palette"
      onClose={() => onClose(chosen.current)}
      className="mx-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] border border-border-strong bg-surface p-0 text-ink backdrop:bg-black/60"
    >
      <div className="border-b border-border p-2">
        <input
          type="text"
          role="combobox"
          aria-label="Search commands"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={current ? optionId(results.indexOf(current)) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Type a command or an element name"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setNote("");
          }}
          onKeyDown={(e) => {
            const n = results.length;
            if (e.key === "ArrowDown" && n) {
              e.preventDefault();
              setActive((Math.min(active, n - 1) + 1) % n);
            } else if (e.key === "ArrowUp" && n) {
              e.preventDefault();
              setActive((Math.min(active, n - 1) + n - 1) % n);
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(current);
            }
          }}
          className="w-full border border-border-strong bg-surface-raised px-2.5 py-2 text-sm text-ink placeholder:text-ink-muted"
        />
      </div>
      <ul id={listId} role="listbox" aria-label="Commands" className="max-h-[min(24rem,50vh)] overflow-y-auto py-1">
        {results.map((c, i) => (
          <li
            key={c.id}
            id={optionId(i)}
            role="option"
            aria-selected={c === current}
            aria-disabled={c.disabled ? true : undefined}
            onPointerMove={() => c !== current && setActive(i)}
            onClick={() => choose(c)}
            className={`flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm ${c === current ? "bg-surface-raised" : ""} ${c.disabled ? "cursor-not-allowed" : ""}`}
          >
            <span aria-hidden="true" className={`h-5 w-0.5 shrink-0 ${c === current ? "bg-accent" : ""}`} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`truncate ${c.disabled ? "text-ink-muted" : "text-ink"}`}>{c.label}</span>
              {c.disabled && <span className="text-xs text-ink-muted">{c.disabled}</span>}
            </span>
            {c.keys && <kbd className={kbd}>{keyLabel(c.keys, mac)}</kbd>}
            <span className="shrink-0 font-mono text-[0.65rem] tracking-[0.08em] text-ink-muted uppercase">{c.group}</span>
          </li>
        ))}
      </ul>
      {results.length === 0 && <p className="px-3 py-3 text-sm text-ink-muted">No commands match “{query.trim()}”.</p>}
      <p className="sr-only" aria-live="polite">
        {note || (query.trim() ? `${results.length} command${results.length === 1 ? "" : "s"}` : "")}
      </p>
      {note && <p className="border-t border-border px-3 py-2 text-xs text-ink-muted" aria-hidden="true">{note}</p>}
      <p className="flex flex-wrap gap-x-3 border-t border-border px-3 py-1.5 text-xs text-ink-muted">
        <span><kbd className={kbd}>↑</kbd> <kbd className={kbd}>↓</kbd> move</span>
        <span><kbd className={kbd}>Enter</kbd> run</span>
        <span><kbd className={kbd}>Esc</kbd> close</span>
        <span>Type “shortcuts” for the full list</span>
      </p>
    </dialog>
  );
}
