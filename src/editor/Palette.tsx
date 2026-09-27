"use client";

import { classes, type ClassId, type Layer } from "@/metamodel";

const LAYERS: { id: Layer; label: string }[] = [
  { id: "business", label: "Business" },
  { id: "design", label: "Design" },
  { id: "service", label: "Service" },
  { id: "functional", label: "Functional" },
  { id: "infrastructure", label: "Infrastructure" },
];

/** Element palette, grouped by layer. Each button adds one element and hands focus to its name. */
export function Palette({ onAdd }: { onAdd: (cls: ClassId) => void }) {
  return (
    <nav aria-label="Element palette" className="flex flex-col gap-4 p-4">
      {LAYERS.map((layer) => (
        <section key={layer.id} aria-labelledby={`palette-${layer.id}`}>
          <h2 id={`palette-${layer.id}`} className="font-mono text-[0.65rem] tracking-[0.14em] text-ink-muted uppercase">
            {layer.label}
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {classes
              .filter((c) => c.layer === layer.id)
              .map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onAdd(c.id)}
                    className="w-full cursor-pointer border border-border px-2.5 py-1.5 text-left text-sm text-ink hover:border-accent hover:text-accent"
                  >
                    <span aria-hidden="true">+ </span>
                    {c.label}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
