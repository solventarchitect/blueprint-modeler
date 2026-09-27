"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type MenuItem =
  | { kind: "item"; label: string; onSelect: () => void; disabled?: boolean; danger?: boolean }
  | { kind: "check"; label: string; checked: boolean; onSelect: () => void }
  | { kind: "separator" };

/**
 * A right-click menu (also opened with Shift+F10 or the Menu key). Follows the ARIA menu pattern:
 * focus moves to the first item, arrow keys, Home and End move between items, Enter or Space
 * chooses, Escape or Tab closes and returns focus to where the menu was opened. A click outside
 * closes it too.
 */
export function ContextMenu({
  x,
  y,
  label,
  items,
  onClose,
}: {
  x: number;
  y: number;
  label: string;
  items: MenuItem[];
  /** `restoreFocus` is true when the menu closed from the keyboard without choosing (Escape, Tab). */
  onClose: (restoreFocus: boolean) => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const r = menu.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ left: Math.max(4, Math.min(x, window.innerWidth - r.width - 4)), top: Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) });
  }, [x, y]);

  const buttons = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]") ?? [])];
  useEffect(() => buttons().find((b) => b.getAttribute("aria-disabled") !== "true")?.focus(), []);

  useEffect(() => {
    const close = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) onClose(false);
    };
    const blur = () => onClose(false);
    document.addEventListener("pointerdown", close, true);
    window.addEventListener("resize", blur);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      window.removeEventListener("resize", blur);
      window.removeEventListener("blur", blur);
    };
  }, [onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const all = buttons();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    const go = (n: number) => {
      e.preventDefault();
      all[(n + all.length) % all.length]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(all.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
    } else if (e.key === "Tab") {
      e.preventDefault();
      onClose(true);
    }
  };

  const itemClass = "flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-surface focus-visible:bg-surface focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:text-ink-muted";

  return (
    <div
      ref={menu}
      role="menu"
      aria-label={label}
      data-testid="context-menu"
      className="fixed z-50 min-w-56 border border-border-strong bg-surface-raised py-1 shadow-lg"
      style={pos}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, n) =>
        it.kind === "separator" ? (
          <div key={n} role="separator" className="my-1 border-t border-border" />
        ) : (
          <button
            key={n}
            type="button"
            role={it.kind === "check" ? "menuitemcheckbox" : "menuitem"}
            aria-checked={it.kind === "check" ? it.checked : undefined}
            aria-disabled={it.kind === "item" && it.disabled ? true : undefined}
            tabIndex={-1}
            className={`${itemClass} ${it.kind === "item" && it.danger ? "text-status" : "text-ink"}`}
            onClick={() => {
              if (it.kind === "item" && it.disabled) return;
              onClose(false);
              it.onSelect();
            }}
          >
            {it.kind === "check" && (
              <span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center border text-[10px] ${it.checked ? "border-accent bg-accent text-accent-ink" : "border-border-strong"}`}>
                {it.checked ? "✓" : ""}
              </span>
            )}
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}
