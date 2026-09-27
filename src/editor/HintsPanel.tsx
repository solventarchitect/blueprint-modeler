"use client";

import { sources } from "@/metamodel";
import type { HintResult } from "@/model";

type Props = { results: HintResult[]; activeId: string | null; onFocus: (r: HintResult) => void; scopeName?: string };

/** Conformance hints: advice with its source, never a block. Selecting one highlights its elements. */
export function HintsPanel({ results, activeId, onFocus, scopeName }: Props) {
  if (results.length === 0) {
    return <p className="p-4 text-sm text-ink-muted">{scopeName ? `No hints for ${scopeName}.` : "No hints. The model follows the CSDM guidance this tool checks."}</p>;
  }
  return (
    <ul className="flex flex-col gap-2 p-4" aria-label="Conformance hints">
      {results.map((r) => {
        const src = sources[r.hint.source.id];
        const page = "page" in r.hint.source ? `, p. ${r.hint.source.page}` : "";
        return (
          <li key={r.id} className={`border border-border p-3 ${activeId === r.id ? "border-status" : ""}`}>
            <button type="button" onClick={() => onFocus(r)} className="flex w-full cursor-pointer items-start gap-2 text-left" aria-pressed={activeId === r.id}>
              <span
                aria-hidden="true"
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[0.7rem] font-semibold ${
                  r.hint.severity === "warning" ? "bg-status text-accent-ink" : "border border-border-strong text-ink-muted"
                }`}
              >
                {r.hint.severity === "warning" ? "!" : "i"}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">
                  <span className="sr-only">{r.hint.severity === "warning" ? "Warning: " : "Note: "}</span>
                  {r.hint.title}
                </span>
                <span className="text-sm text-ink-soft">{r.message}</span>
                <span className="text-xs text-ink-muted">{r.hint.explanation}</span>
              </span>
            </button>
            <a className="mt-2 ml-7 inline-block text-xs text-accent underline underline-offset-4" href={src.url} target="_blank" rel="noopener noreferrer">
              Source: {r.hint.source.id === "whitepaper" ? `CSDM 5 white paper${page}` : "ServiceNow Community"}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
