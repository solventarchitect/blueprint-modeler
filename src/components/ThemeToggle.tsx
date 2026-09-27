"use client";

import { useEffect, useState } from "react";

export type Theme = "auto" | "light" | "dark";
export const THEME_KEY = "bm-theme";
const next: Record<Theme, Theme> = { auto: "light", light: "dark", dark: "auto" };
const label: Record<Theme, string> = { auto: "Auto", light: "Light", dark: "Dark" };

/** Runs before first paint (inline in <head>) so a saved theme never flashes the wrong one. */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** Cycles Auto (OS setting) → Light → Dark. The choice is kept in this browser only. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === "light" || t === "dark") setTheme(t);
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
