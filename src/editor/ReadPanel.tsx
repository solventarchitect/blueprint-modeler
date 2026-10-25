"use client";

import type { OutlineLayer, Reading, Sentence } from "./reading";

export type ReadMode = "sentences" | "outline";

type Props = {
  reading: Reading;
  activeEdgeId: string | null;
  onFocus: (s: Sentence) => void;
  scopeName?: string;
  /** M55: the relationships as sentences, or every element as an outline by layer. */
  mode: ReadMode;
  onMode: (m: ReadMode) => void;
  outline: OutlineLayer[];
  /** Select an element from the outline and bring it into view. */
  onGo: (id: string) => void;
  selectedIds: string[];
  /** Elements the current view filters out (they can still be gone to: that lifts the filter). */
  faded: Set<string>;
};

const choice = (on: boolean) =>
  `cursor-pointer border px-2.5 py-1 text-sm ${on ? "border-accent bg-accent text-accent-ink" : "border-border-strong text-ink hover:border-accent hover:text-accent"}`;

/** The model in words: one sentence per relationship (choosing one highlights it), or an outline of every element by layer. */
export function ReadPanel({ reading, activeEdgeId, onFocus, scopeName, mode, onMode, outline, onGo, selectedIds, faded }: Props) {
  const empty = reading.groups.length === 0;
  return (
    <div className="flex flex-col gap-4 p-4" data-testid="read-panel">
      <div role="group" aria-label="Read as" className="flex">
        <button type="button" className={choice(mode === "sentences")} aria-pressed={mode === "sentences"} onClick={() => onMode("sentences")}>
          Sentences
        </button>
        <button type="button" className={`${choice(mode === "outline")} -ml-px`} aria-pressed={mode === "outline"} onClick={() => onMode("outline")}>
          Outline
        </button>
      </div>
      {mode === "outline" ? (
        <nav aria-label="Model outline" data-testid="outline" className="flex flex-col gap-4">
          {outline.length === 0 ? (
            <p className="text-sm text-ink-muted">No elements yet. Add one from the palette and it is listed here, under its layer.</p>
          ) : (
            outline.map((l) => (
              <section key={l.layer} aria-labelledby={`outline-${l.layer}`}>
                <h3 id={`outline-${l.layer}`} className="font-mono text-[0.65rem] tracking-[0.12em] text-ink-muted uppercase">
                  {l.name} <span className="sr-only">layer, </span>· {l.items.length} <span className="sr-only">{l.items.length === 1 ? "element" : "elements"}</span>
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {l.items.map((i) => {
                    const meta = [...i.details, `${i.links} relationship${i.links === 1 ? "" : "s"}`, ...(faded.has(i.id) ? ["filtered out"] : [])].join(" · ");
                    const current = selectedIds.includes(i.id);
                    return (
                      <li key={i.id}>
                        {/* Named by kind and name; the details are its description, read after a pause. */}
                        <button
                          type="button"
                          onClick={() => onGo(i.id)}
                          aria-current={current || undefined}
                          aria-labelledby={`outline-${i.id}-kind outline-${i.id}-name`}
                          aria-describedby={`outline-${i.id}-meta`}
                          className={`flex w-full cursor-pointer flex-col border px-2.5 py-1.5 text-left hover:border-accent ${current ? "border-accent" : "border-border"}`}
                        >
                          <span id={`outline-${i.id}-kind`} className="font-mono text-[0.65rem] tracking-[0.12em] text-ink-muted uppercase">
                            {i.kind}
                          </span>
                          <span id={`outline-${i.id}-name`} className="text-sm font-medium text-ink">
                            {i.name}
                          </span>
                          <span id={`outline-${i.id}-meta`} className="text-xs text-ink-muted">
                            {meta}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </nav>
      ) : (
        <>
          {empty ? (
            <p className="text-sm text-ink-muted">{scopeName ? `No relationships for ${scopeName} yet.` : "No relationships yet. Connect two elements and the model reads here."}</p>
          ) : (
            reading.groups.map((g) => (
              <section key={g.nodeId} aria-labelledby={`read-${g.nodeId}`}>
                <h3 id={`read-${g.nodeId}`} className="flex flex-col">
                  <span className="font-mono text-[0.65rem] tracking-[0.12em] text-ink-muted uppercase">{g.kind}</span>
                  <span className="text-sm font-medium text-ink">{g.name}</span>
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {g.sentences.map((s) => (
                    <li key={s.edgeId}>
                      <button
                        type="button"
                        onClick={() => onFocus(s)}
                        aria-pressed={activeEdgeId === s.edgeId}
                        className={`w-full cursor-pointer border px-2.5 py-1.5 text-left text-sm text-ink-soft hover:text-ink ${activeEdgeId === s.edgeId ? "border-status text-ink" : "border-border"}`}
                      >
                        {s.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
          {reading.unconnected.length > 0 && (
            <p className="border-t border-border pt-3 text-xs text-ink-muted">
              Not connected yet: {reading.unconnected.map((u) => `${u.name} (${u.kind})`).join(", ")}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
