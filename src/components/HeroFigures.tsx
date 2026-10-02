"use client";

import { useEffect, useState, type ReactNode } from "react";

/** What each figure shows, in words: the figure's accessible name and description. */
export const heroFigures = [
  {
    label: "Chain",
    title: "Figure 1: the realization chain",
    desc: "A Business Capability, Order Management, is provided by the Business Application Checkout, which uses the Application Service Checkout — production. That service depends on the Application checkout-web, which runs on the Host web-prod-01.",
  },
  {
    label: "Caught early",
    title: "Figure 2: caught early",
    desc: "The same chain, with a line drawn straight from the Business Application Checkout to the Host web-prod-01. The editor refuses it: a Business Application is not related directly to a Host in CSDM. The route goes through the Application Service Checkout — production instead.",
  },
  {
    label: "ArchiMate",
    title: "Figure 3: read it in ArchiMate",
    desc: "The same elements read in ArchiMate 3.2: Order Management is a Capability realized by the Application Component Checkout, which is realized by the Application Component Checkout — production. The System Software checkout-web serves it, and the Node web-prod-01 aggregates the system software. Elements take their ArchiMate layer colors; the model itself stays in CSDM.",
  },
] as const;

/** How long each figure stays before the next one, unless paused. */
export const HERO_INTERVAL_MS = 8000;

/**
 * Steps the hero through its three figures. The SVG (children) never changes: this only sets
 * `data-fig`, and CSS moves each element into place. Rotation pauses while the pointer is over the
 * figure, stops when the viewer pauses or picks a figure and resumes only with Play (WCAG 2.2.2;
 * the APG carousel pattern), and starts paused with reduced motion.
 */
export function HeroFigures({ children }: { children: ReactNode }) {
  const [fig, setFig] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false);

  // Reduced motion: start paused (the Play button can still start it, with instant changes).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);

  const rotating = playing && !held;
  useEffect(() => {
    if (!rotating) return;
    const t = setInterval(() => setFig((f) => (f + 1) % heroFigures.length), HERO_INTERVAL_MS);
    return () => clearInterval(t);
  }, [rotating]);

  const current = heroFigures[fig]!;
  return (
    <div>
      <div
        role="img"
        aria-label={current.title}
        aria-describedby="hero-desc"
        className="hero-sheet"
        data-fig={fig}
        data-testid="hero-sheet"
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
      >
        {children}
      </div>
      <p id="hero-desc" className="sr-only">
        {current.desc}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs" role="group" aria-label="Hero figures">
        {heroFigures.map((f, i) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={fig === i}
            onClick={() => {
              setFig(i);
              setPlaying(false);
            }}
            className={`min-h-11 cursor-pointer border px-3 tracking-[0.08em] ${fig === i ? "border-accent text-ink" : "border-border text-ink-soft hover:border-accent hover:text-ink"}`}
          >
            <span className="text-ink-muted">{String(i + 1).padStart(2, "0")}</span> {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause the figures" : "Play the figures"}
          className="ml-auto inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center border border-border text-ink-soft hover:border-accent hover:text-ink"
        >
          <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
        </button>
      </div>
    </div>
  );
}
