"use client";

import { useEffect, useId, useRef, useState } from "react";
import { relationshipWord } from "@/io/svg";
import { LAYERS } from "@/layout/bands";
import { classById, classes, isExtended, lifecycleFor, type ClassId } from "@/metamodel";
import { classChange, count, type Edge, type Model } from "@/model";

const btn = "inline-flex min-h-8 cursor-pointer items-center border border-border-strong bg-surface-raised px-2.5 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";
const field = "min-h-8 border border-border-strong bg-surface-raised px-2 text-sm text-ink";
const LISTED = 8;

/** "Runs on becomes Depends on"; two reference fields would both read "reference", so those name their field. */
function becomes(was: string, now: string) {
  const [a, b] = [relationshipWord(was), relationshipWord(now)];
  const field = (type: string, word: string) => (type.startsWith("reference:") ? `${word} (${type.slice("reference:".length)})` : word);
  return a === b ? `${field(was, a)} becomes ${field(now, b)}` : `${a} becomes ${b}`;
}

/** What changing the class would do, in words: one paragraph or list per kind of outcome. */
export function classChangeWords(model: Model, id: string, cls: ClassId) {
  const change = classChange(model, id, cls);
  if (!change) return null;
  const name = (nid: string) => `“${model.nodes.find((n) => n.id === nid)?.name || "Untitled"}”`;
  const ends = (e: Edge) => `${name(e.from)} → ${name(e.to)}`;
  const gone = new Set(change.removed.map((r) => r.edge.id));
  const flows = (model.flows ?? []).filter((f) => f.steps.some((s) => gone.has(s.edge))).length;
  const stage = model.nodes.find((n) => n.id === id)?.attrs?.lifecycle;
  const stages = lifecycleFor(cls)?.stages;
  return {
    change,
    kept: change.kept.length,
    retyped: change.retyped.map((r) => `${ends(r.edge)}: ${becomes(r.edge.type, r.type)}`),
    removed: change.removed.map((r) => `${ends(r.edge)} (${relationshipWord(r.edge.type)})${r.why === "duplicate" ? ": it would repeat another relationship" : ""}`),
    flows,
    stage: stage && !stages?.includes(stage) ? stage : undefined,
  };
}

/** The outcome as one sentence, for the status line once it is done. */
export function classChangeSaid(words: NonNullable<ReturnType<typeof classChangeWords>>) {
  const parts: [number, string][] = [
    [words.kept, "kept"],
    [words.retyped.length, "given a new type"],
    [words.removed.length, "removed"],
  ];
  const said = parts.filter(([n]) => n > 0).map(([n, what], i) => `${i ? n : count(n, "relationship")} ${what}`);
  if (!said.length) return "It had no relationships.";
  return `${said.join(", ")}.${words.flows ? ` ${count(words.flows, "saved flow")} cut short.` : ""}`;
}

function Listed({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 ml-4 list-disc text-sm">
      {items.slice(0, LISTED).map((t, i) => (
        // Two relationships can read the same (two untitled ends), so the place in the list is the key.
        <li key={i}>{t}</li>
      ))}
      {items.length > LISTED && <li>and {items.length - LISTED} more</li>}
    </ul>
  );
}

/**
 * M89: choose another class for an element. Before anything changes, it says what happens to each
 * relationship: kept, given the type CSDM allows between the two, or removed. Nothing is changed
 * until Change class; one undo step brings everything back.
 */
export function ChangeClassDialog({ model, id, extended, onChange, onClose }: { model: Model; id: string; /** Offer the Extended classes too, as the palette does. */ extended: boolean; onChange: (cls: ClassId) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [cls, setCls] = useState<ClassId | "">("");
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  const node = model.nodes.find((n) => n.id === id);
  if (!node) return null;
  const now = classById(node.class);
  const total = model.edges.filter((e) => e.from === id || e.to === id).length;
  const words = cls ? classChangeWords(model, id, cls) : null;
  const next = cls ? classById(cls) : undefined;
  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${uid}-title`}
      aria-describedby={`${uid}-help`}
      data-testid="reclass-dialog"
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto border border-border-strong bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (!cls || !words) return;
          onChange(cls);
          // Closing it (not just unmounting) is what lets focus leave the modal; onClose puts it back.
          dialog.current?.close();
        }}
      >
        <div className="border-b border-border px-4 py-3">
          <h2 id={`${uid}-title`} className="text-base font-medium">
            Change class
          </h2>
          <p id={`${uid}-help`} className="mt-1 text-sm text-ink-muted">
            “{node.name || "Untitled"}” is {now ? `of class ${now.label}` : "of a class this version doesn't know"}. Its name, properties, tags and position stay. Its relationships are kept where CSDM allows one between the two classes.
          </p>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4">
          <label className="flex flex-col gap-1 text-sm sm:max-w-sm">
            <span className="text-ink-muted">New class</span>
            <select className={field} value={cls} onChange={(e) => setCls(e.target.value as ClassId | "")}>
              <option value="">Choose a class</option>
              {LAYERS.map((layer) => (
                <optgroup key={layer.id} label={`${layer.name} layer`}>
                  {classes
                    .filter((c) => c.layer === layer.id && c.id !== node.class && (extended || !isExtended(c)))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div aria-live="polite" data-testid="reclass-outcome" className="flex flex-col gap-2 text-sm">
            {!words || !next ? (
              <p className="text-ink-muted">{total ? `Choose a class to see what happens to its ${count(total, "relationship")}.` : "It has no relationships, so only its class changes."}</p>
            ) : (
              <>
                {total === 0 && <p>It has no relationships, so only its class changes.</p>}
                {words.kept > 0 && <p>Keeps {count(words.kept, "relationship")} as {words.kept === 1 ? "it is" : "they are"}.</p>}
                {words.retyped.length > 0 && (
                  <div>
                    <p>
                      {count(words.retyped.length, "relationship")} {words.retyped.length === 1 ? "takes" : "take"} the type CSDM allows for {next.label}:
                    </p>
                    <Listed items={words.retyped} />
                  </div>
                )}
                {words.removed.length > 0 && (
                  <div>
                    <p>
                      Removes {count(words.removed.length, "relationship")} CSDM has no place for with {next.label}:
                    </p>
                    <Listed items={words.removed} />
                  </div>
                )}
                {words.flows > 0 && (
                  <p>
                    {count(words.flows, "saved flow")} {words.flows === 1 ? "walks" : "walk"} a removed relationship and {words.flows === 1 ? "stops" : "stop"} there.
                  </p>
                )}
                {words.stage && (
                  <p>
                    Its life cycle stage, “{words.stage}”, is not a stage for {next.label}. It stays until you change it.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" className={btn} onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="submit" className={btn} disabled={!cls}>
            Change class
          </button>
        </div>
      </form>
    </dialog>
  );
}
