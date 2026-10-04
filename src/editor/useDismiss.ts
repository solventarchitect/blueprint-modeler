"use client";

import { useEffect, type RefObject } from "react";

/**
 * While a disclosure panel is open: a press outside closes it, and Escape closes it wherever focus
 * is (a click on a heading in the panel leaves focus on the page) and returns focus to its button.
 * Escape is marked handled, so the editor's own Escape (closing a blast radius) skips it.
 */
export function useDismiss(open: boolean, close: () => void, root: RefObject<HTMLElement | null>, button: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close, root, button]);
}
