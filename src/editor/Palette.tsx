"use client";

import { archimateElements, type Lens } from "@/frameworks";
import { classes, isCsdmCore, isExtended, type ClassId, type Layer } from "@/metamodel";
import { layerAccent } from "./layerAccent";

const LAYERS: { id: Layer; label: string }[] = [
  { id: "business", label: "Business" },
  { id: "design", label: "Design" },
  { id: "service", label: "Service" },
  { id: "functional", label: "Functional" },
  { id: "infrastructure", label: "Infrastructure" },
];

/** Element palette, grouped by layer. Each button adds one element and hands focus to its name. */
export function Palette({ onAdd, lens = "csdm", extended = false }: { onAdd: (cls: ClassId) => void; lens?: Lens; extended?: boolean }) {
  return (
    <nav aria-label="Element palette" className="flex flex-col gap-4 p-4">
      <p id="palette-cmdb-note" className="sr-only">
        A CMDB class from ServiceNow product documentation, not part of the CSDM white paper.
      </p>
      {LAYERS.map((layer) => (
        <section key={layer.id} aria-labelledby={`palette-${layer.id}`}>
          <h2 id={`palette-${layer.id}`} className="font-mono text-[0.65rem] tracking-[0.14em] text-ink-muted uppercase">
            {layer.label}
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {classes
              .filter((c) => c.layer === layer.id && (extended || !isExtended(c)))
              .map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onAdd(c.id)}
                    aria-describedby={isCsdmCore(c) ? undefined : "palette-cmdb-note"}
                    className={`flex w-full cursor-pointer items-center gap-2 border border-border border-l-4 bg-surface-raised px-2.5 py-1.5 text-left text-sm leading-snug text-ink hover:border-accent hover:text-accent ${layerAccent[c.layer]}`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span>{c.label}</span>
                      {lens === "archimate" && <span aria-hidden="true" className="font-mono text-[0.65rem] text-ai">{archimateElements[c.id].label}</span>}
                    </span>
                    {!isCsdmCore(c) && (
                      <span aria-hidden="true" title="CMDB class, not CSDM core" className="border border-border-strong px-1 font-mono text-[0.6rem] tracking-[0.08em] text-ink-muted">
                        CMDB
                      </span>
                    )}
                    <span aria-hidden="true" className="font-mono text-ink-muted">
                      +
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
