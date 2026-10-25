"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FIELD_LABEL, UNTITLED_MODEL, type Comparison } from "@/model";
import type { ModelSummary } from "@/storage";
import { when } from "./ModelManager";

const btn = "inline-flex min-h-8 cursor-pointer items-center border border-border-strong bg-surface-raised px-2.5 text-sm text-ink hover:border-accent hover:text-accent";
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What the open model is being compared with (M58): another model as it is saved, or a file. */
export type CompareBase = { label: string };

/**
 * Compare with… (M58): pick another model saved in this browser, or a model file. A modal dialog;
 * Escape or Cancel closes it. A file that is not a model says why, here.
 */
export function CompareDialog({
  models,
  currentId,
  onModel,
  onFile,
  onClose,
  error,
}: {
  models: ModelSummary[];
  currentId: string;
  onModel: (id: string) => void;
  onFile: (file: File) => void;
  onClose: () => void;
  error: string | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  const others = models.filter((m) => m.id !== currentId);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="compare-title"
      aria-describedby="compare-help"
      data-testid="compare-dialog"
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] border border-border-strong bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <div className="border-b border-border px-4 py-3">
        <h2 id="compare-title" className="text-base font-medium">
          Compare with…
        </h2>
        <p id="compare-help" className="mt-1 text-sm text-ink-muted">
          See what changed from another model to this one: an earlier copy saved here, or a model file. Nothing changes in either model.
        </p>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        <section aria-labelledby="compare-saved">
          <h3 id="compare-saved" className="text-sm font-medium">
            Saved in this browser
          </h3>
          {others.length ? (
            <ul className="mt-1.5 flex max-h-72 flex-col gap-1 overflow-y-auto">
              {others.map((m) => (
                <li key={m.id}>
                  <button type="button" className={`${btn} w-full justify-between gap-2 py-1.5 text-left`} onClick={() => onModel(m.id)}>
                    <span className="truncate">{m.name || UNTITLED_MODEL}</span>
                    <span className="shrink-0 text-xs text-ink-muted">{when(m.updated)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-ink-muted">No other models are saved here yet.</p>
          )}
        </section>
        <section aria-labelledby="compare-file" className="flex flex-col items-start gap-1.5">
          <h3 id="compare-file" className="text-sm font-medium">
            From a file
          </h3>
          <button type="button" className={btn} onClick={() => fileInput.current?.click()}>
            Choose a model file…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            data-testid="compare-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onFile(f);
            }}
          />
          {error && (
            <p role="alert" className="text-sm text-invalid">
              {error}
            </p>
          )}
        </section>
      </div>
      <div className="flex justify-end border-t border-border px-4 py-3">
        <button type="button" className={btn} onClick={() => dialog.current?.close()}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}

/** The counts in words: "2 added, 1 changed, 1 relationship removed", or that nothing differs. */
export function compareSummary(c: Comparison) {
  const parts = [
    c.added.length && `${count(c.added.length, "element")} added`,
    c.changed.length && `${count(c.changed.length, "element")} changed`,
    c.removed.length && `${count(c.removed.length, "element")} removed`,
    c.edgesAdded.length && `${count(c.edgesAdded.length, "relationship")} added`,
    c.edgesChanged.length && `${count(c.edgesChanged.length, "relationship")} changed`,
    c.edgesRemoved.length && `${count(c.edgesRemoved.length, "relationship")} removed`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "No differences";
}

/**
 * The bar while comparing (M58): with what, the counts, and the change list (a disclosure): every
 * added or changed element is a button that goes to it; removed ones, which this model no longer
 * has, are listed by name. Close (or Escape) ends the comparison.
 */
export function CompareBar({ base, comparison, onGo, onClose, buttonClass }: { base: CompareBase; comparison: Comparison; onGo: (id: string) => void; onClose: () => void; buttonClass: string }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const c = comparison;
  const item = "cursor-pointer text-left text-sm text-ink underline underline-offset-2 hover:text-accent";
  const edgeText = (e: { from: string; to: string; type: string }) => `${e.from} → ${e.to} (${e.type.split("::")[0]})`;
  return (
    <div role="region" aria-label="Compare" data-testid="compare-bar" className="flex flex-col gap-1.5 border-b border-border px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-xs tracking-[0.14em] text-accent uppercase">Compare</p>
        <h2 className="text-sm font-medium">Changes since “{base.label}”</h2>
        <p className="text-sm text-ink-muted" aria-live="polite" data-testid="compare-summary">
          {compareSummary(c)}
        </p>
        <span className="ml-auto flex gap-2">
          <button type="button" className={buttonClass} aria-expanded={open} aria-controls={`${id}-list`} onClick={() => setOpen(!open)}>
            {open ? "Hide changes" : "Show changes"}
          </button>
          <button type="button" className={buttonClass} onClick={onClose} aria-keyshortcuts="Escape">
            Close
          </button>
        </span>
      </div>
      {open && (
        <div id={`${id}-list`} data-testid="compare-list" className="grid max-h-48 gap-x-6 gap-y-2 overflow-y-auto pb-1 sm:grid-cols-3">
          <section aria-labelledby={`${id}-added`}>
            <h3 id={`${id}-added`} className="text-xs font-medium text-ink-muted">
              <span aria-hidden="true">+ </span>Added
            </h3>
            <ul className="mt-1 flex flex-col gap-0.5">
              {c.added.map((e) => (
                <li key={e.id}>
                  <button type="button" className={item} onClick={() => onGo(e.id)}>
                    {e.name} <span className="text-ink-muted">({e.kind})</span>
                  </button>
                </li>
              ))}
              {c.edgesAdded.map((e) => (
                <li key={e.id} className="text-sm text-ink-soft">
                  {edgeText(e)}
                </li>
              ))}
              {!c.added.length && !c.edgesAdded.length && <li className="text-sm text-ink-muted">Nothing</li>}
            </ul>
          </section>
          <section aria-labelledby={`${id}-changed`}>
            <h3 id={`${id}-changed`} className="text-xs font-medium text-ink-muted">
              <span aria-hidden="true">~ </span>Changed
            </h3>
            <ul className="mt-1 flex flex-col gap-0.5">
              {c.changed.map((e) => (
                <li key={e.id}>
                  <button type="button" className={item} onClick={() => onGo(e.id)}>
                    {e.name} <span className="text-ink-muted">({e.kind})</span>
                  </button>
                  <span className="block text-xs text-ink-muted">
                    {e.changes.map((f) => `${FIELD_LABEL[f.field]}: ${f.before || "not set"} → ${f.after || "not set"}`).join("; ")}
                  </span>
                </li>
              ))}
              {c.edgesChanged.map((e) => (
                <li key={e.id} className="text-sm text-ink-soft">
                  {edgeText(e)}, was {e.before.split("::")[0]}
                </li>
              ))}
              {!c.changed.length && !c.edgesChanged.length && <li className="text-sm text-ink-muted">Nothing</li>}
            </ul>
          </section>
          <section aria-labelledby={`${id}-removed`}>
            <h3 id={`${id}-removed`} className="text-xs font-medium text-ink-muted">
              <span aria-hidden="true">− </span>Removed
            </h3>
            <ul className="mt-1 flex flex-col gap-0.5">
              {c.removed.map((e) => (
                <li key={e.id} className="text-sm text-ink-soft">
                  {e.name} <span className="text-ink-muted">({e.kind})</span>
                </li>
              ))}
              {c.edgesRemoved.map((e) => (
                <li key={e.id} className="text-sm text-ink-soft">
                  {edgeText(e)}
                </li>
              ))}
              {!c.removed.length && !c.edgesRemoved.length && <li className="text-sm text-ink-muted">Nothing</li>}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
