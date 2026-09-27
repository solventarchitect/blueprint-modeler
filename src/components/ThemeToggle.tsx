"use client";

import { useEffect, useState } from "react";

export type Theme = "auto" | "light" | "dark";
export const THEME_KEY = "bm-theme";
const next: Record<Theme, Theme> = { auto: "light", light: "dark", dark: "auto" };
const label: Record<Theme, string> = { auto: "Auto", light: "Light", dark: "Dark" };

/** Runs before first paint (first thing in <body>) so a saved theme never flashes the wrong one. */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** Cycles Auto (OS setting) → Light → Dark. The choice is kept in this browser only. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  // Storage is the source of truth: re-apply it on mount, and again if anything resets <html>
  // (React rebuilds it after a recoverable hydration error, which drops data-theme).
  useEffect(() => {
    const stored = () => {
      try {
        return localStorage.getItem(THEME_KEY);
      } catch {
        return null;
      }
    };
    const root = document.documentElement;
    const t = stored() ?? root.dataset.theme ?? null;
    if (t !== "light" && t !== "dark") return;
    root.dataset.theme = t;
    setTheme(t);
    const observer = new MutationObserver(() => {
      const current = stored();
      if ((current === "light" || current === "dark") && root.dataset.theme !== current) root.dataset.theme = current;
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    if (t === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try {
      if (t === "auto") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, t);
    } catch {
      // Storage blocked: the choice still applies until the page is closed.
    }
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
