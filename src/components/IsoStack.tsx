"use client";

import { useState, type CSSProperties } from "react";
import { classById, type ClassId } from "@/metamodel";

/**
 * The realization chain from the hero figures, bottom up: one slab per CSDM layer, each carrying its
 * element, colored as the layer is on the canvas. Height grows toward the business (the isometric
 * design system's block rule: taller means closer to the business). Blocks stand on the slab's
 * front-left edge, so a slab above hides them only while the stack is collapsed: exploding it shows
 * what sits inside each layer.
 */
const stack: { layer: string; color: string; text: string; cls: ClassId; name: string; w: number; d: number; h: number }[] = [
  { layer: "Infrastructure", color: "var(--border-strong)", text: "var(--ink-soft)", cls: "host", name: "web-prod-01", w: 44, d: 44, h: 22 },
  { layer: "Functional", color: "var(--ink-muted)", text: "var(--ink-soft)", cls: "application", name: "checkout-web", w: 44, d: 56, h: 26 },
  { layer: "Service", color: "var(--ai)", text: "var(--ai)", cls: "application_service", name: "Checkout — production", w: 48, d: 72, h: 30 },
  { layer: "Design", color: "var(--accent)", text: "var(--accent)", cls: "business_application", name: "Checkout", w: 52, d: 84, h: 34 },
  { layer: "Business", color: "var(--status)", text: "var(--status)", cls: "business_capability", name: "Order Management", w: 56, d: 96, h: 40 },
];

export const isoStackTitle = "The realization chain, stacked in isometric";
export const isoStackDesc = `Five stacked layers, from Infrastructure at the bottom to Business at the top: ${stack
  .map((s) => `the ${classById(s.cls)!.label} ${s.name}`)
  .join(", ")
  .replace(/, (?=[^,]*$)/, " and ")}. Data rises between the layers.`;

/**
 * The landing page's hero art (after the Motion + Isometric design system): the realization chain as
 * isometric slabs that settle bottom-up on load, float, carry data up between the layers and explode
 * on request. Drawn in CSS 3D (decorative; named and described in text). Reduced motion: no float,
 * no packets, no settling; the stack holds its end state and still explodes, at once.
 */
export function IsoStack() {
  const [exploded, setExploded] = useState(false);
  return (
    <div>
      <div className="iso-stage" role="img" aria-label={isoStackTitle} aria-describedby="iso-stack-desc" data-testid="iso-stack" data-exploded={exploded || undefined}>
        <div className="iso-scene">
          <div className="iso-shadow" aria-hidden="true" />
          {stack.map((s, i) => (
            <div key={s.cls} className="iso-layer" style={{ "--i": i, "--c": s.color } as CSSProperties}>
              {i < stack.length - 1 && (
                <>
                  <span className="iso-riser" style={{ left: "calc(var(--s) * 10)", top: "calc(var(--s) * 120)" }}>
                    <span className="iso-packet" style={{ "--d": `${-i * 0.6}s` } as CSSProperties} />
                  </span>
                  <span className="iso-riser" style={{ left: "calc(var(--s) * 120)", top: "calc(var(--s) * 10)" }}>
                    <span className="iso-packet" style={{ "--d": `${-i * 0.6 - 1.2}s` } as CSSProperties} />
                  </span>
                </>
              )}
              <div className="iso-enter">
                <div className="iso-float">
                  <div className="iso-blk iso-slab">
                    <span className="t">
                      <span className="iso-plate">
                        <span className="iso-plate-layer" style={{ color: s.text }}>
                          {s.layer}
                        </span>
                        <span className="iso-plate-name">{s.name}</span>
                      </span>
                    </span>
                    <span className="s" />
                    <span className="w" />
                  </div>
                  <div
                    className="iso-blk iso-el"
                    style={{ "--w": s.w, "--dp": s.d, "--h": `calc(var(--s) * ${s.h})` } as CSSProperties}
                  >
                    <span className="t" />
                    <span className="s" />
                    <span className="w" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p id="iso-stack-desc" className="sr-only">
        {isoStackDesc}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs tracking-[0.12em] text-ink-muted uppercase">{"// Fig. 00 · the chain in isometric"}</p>
        <button
          type="button"
          aria-pressed={exploded}
          onClick={() => setExploded((e) => !e)}
          className="min-h-11 cursor-pointer border border-border px-4 font-mono text-xs tracking-[0.08em] text-ink-soft hover:border-accent hover:text-ink"
        >
          Explode the stack
        </button>
      </div>
    </div>
  );
}
