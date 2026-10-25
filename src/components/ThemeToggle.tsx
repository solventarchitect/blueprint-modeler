"use client";

import { useEffect, useSyncExternalStore } from "react";

export type Theme = "auto" | "light" | "dark";
export const THEME_KEY = "bm-theme";
const next: Record<Theme, Theme> = { auto: "light", light: "dark", dark: "auto" };
const label: Record<Theme, string> = { auto: "Auto", light: "Light", dark: "Dark" };

/** Runs before first paint (first thing in <body>) so a saved theme never flashes the wrong one. */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

const CHANGED = "bm-theme-change";
const stored = (): string | null => {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
};
/** The theme on the page: the boot script and every choice set it on <html>, so the label always matches it. */
const readTheme = (): Theme => {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "auto";
};
/** This page's own choice (another tab's applies here on the next page load, as before). */
const subscribe = (onChange: () => void) => {
  addEventListener(CHANGED, onChange);
  return () => removeEventListener(CHANGED, onChange);
};

/** Cycles Auto (OS setting) → Light → Dark. The choice is kept in this browser only. */
export function ThemeToggle() {
  // Read after hydration (the server can't know it): the button says Auto until then.
  const theme = useSyncExternalStore(subscribe, readTheme, () => "auto" as Theme);

  // Storage is the source of truth: re-apply it on mount, and again if anything resets <html>
  // (React rebuilds it after a recoverable hydration error, which drops data-theme).
  useEffect(() => {
    const root = document.documentElement;
    const t = stored() ?? root.dataset.theme ?? null;
    if (t !== "light" && t !== "dark") return;
    root.dataset.theme = t;
    const observer = new MutationObserver(() => {
      const current = stored();
      if ((current === "light" || current === "dark") && root.dataset.theme !== current) root.dataset.theme = current;
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const choose = (t: Theme) => {
    if (t === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try {
      if (t === "auto") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, t);
    } catch {
      // Storage blocked: the choice still applies until the page is closed.
    }
    dispatchEvent(new Event(CHANGED));
  };

  return (
    <button
      type="button"
      onClick={() => choose(next[theme])}
      aria-label={`Color theme: ${label[theme]}. Switch to ${label[next[theme]]}`}
      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-3 text-sm text-ink-soft hover:text-accent"
      data-testid="theme-toggle"
    >
      <span aria-hidden="true" className="font-mono text-xs">
        {theme === "auto" ? "◐" : theme === "light" ? "○" : "●"}
      </span>
      <span aria-hidden="true">{label[theme]}</span>
    </button>
  );
}
