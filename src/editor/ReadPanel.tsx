"use client";

import type { Reading, Sentence } from "./reading";

type Props = { reading: Reading; activeEdgeId: string | null; onFocus: (s: Sentence) => void; scopeName?: string };

/** The model read aloud, one sentence per relationship. Choosing a sentence highlights that relationship. */
export function ReadPanel({ reading, activeEdgeId, onFocus, scopeName }: Props) {
  const empty = reading.groups.length === 0;
  return (
    <div className="flex flex-col gap-4 p-4" data-testid="read-panel">
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
    </div>
  );
}
