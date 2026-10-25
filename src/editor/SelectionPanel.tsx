"use client";

import type { AlignEdge } from "@/layout/align";

/** What a selection of several elements can do (M57): line up on an edge or center, or spread out evenly. */
export type ArrangeKind = AlignEdge | "spread-x" | "spread-y";

export const ARRANGE: { id: ArrangeKind; label: string; short: string; done: string }[] = [
  { id: "left", label: "Align left", short: "Left", done: "on their left edges" },
  { id: "center", label: "Align centers", short: "Centers", done: "on their centers" },
  { id: "right", label: "Align right", short: "Right", done: "on their right edges" },
  { id: "top", label: "Align top", short: "Top", done: "on their top edges" },
  { id: "middle", label: "Align middles", short: "Middles", done: "on their middles" },
  { id: "bottom", label: "Align bottom", short: "Bottom", done: "on their bottom edges" },
  { id: "spread-x", label: "Distribute horizontally", short: "Horizontally", done: "evenly across" },
  { id: "spread-y", label: "Distribute vertically", short: "Vertically", done: "evenly down" },
];

// As the Inspector's buttons.
const button = "cursor-pointer border border-border-strong px-2.5 py-1.5 text-sm text-ink hover:border-accent hover:text-accent";

/** The side panel while several elements are selected: what they are, and what to do with them. */
export function SelectionPanel({ names, onArrange, onDelete, onClear }: { names: string[]; onArrange: (k: ArrangeKind) => void; onDelete: () => void; onClear: () => void }) {
  const group = (title: string, kinds: ArrangeKind[]) => (
    <div role="group" aria-label={title} className="flex flex-col gap-1">
      <span className="text-sm text-ink-muted">{title}</span>
      <div className="grid grid-cols-3 gap-1">
        {kinds.map((k) => {
          const a = ARRANGE.find((x) => x.id === k)!;
          return (
            <button key={k} type="button" className={button} aria-label={a.label} onClick={() => onArrange(k)}>
              {a.short}
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-4 p-4" data-testid="selection-panel">
      <div>
        <h2 className="font-medium text-ink">{names.length} elements selected</h2>
        <p className="mt-1 text-sm text-ink-muted">{names.join(", ")}</p>
      </div>
      {group("Align horizontally", ["left", "center", "right"])}
      {group("Align vertically", ["top", "middle", "bottom"])}
      <div role="group" aria-label="Distribute" className="flex flex-col gap-1">
        <span className="text-sm text-ink-muted">Distribute evenly</span>
        <div className="grid grid-cols-2 gap-1">
          {(["spread-x", "spread-y"] as const).map((k) => (
            <button key={k} type="button" className={button} aria-label={ARRANGE.find((x) => x.id === k)!.label} onClick={() => onArrange(k)}>
              {ARRANGE.find((x) => x.id === k)!.short}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-ink-muted">Drag any of them to move them together. Shift+click adds or removes an element; Esc clears the selection.</p>
      <div className="flex gap-2">
        <button type="button" className={button} onClick={onClear}>
          Clear selection
        </button>
        <button type="button" className={button} onClick={onDelete}>
          Delete {names.length} elements
        </button>
      </div>
    </div>
  );
}
