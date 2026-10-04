"use client";

import { useCallback, useId, useRef, useState } from "react";
import { UNTITLED_MODEL } from "@/model";
import type { ModelSummary } from "@/storage";
import { ArtifactIcon } from "./CanvasTitle";
import { when } from "./ModelManager";
import { useDismiss } from "./useDismiss";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The toolbar's Model menu: a button naming the open model, opening a panel of every model stored
 * in this browser (newest first), each with its Artifact ID, the start of its description, its size
 * and when it last changed. Choosing one opens it. Escape, a click outside or focus leaving the
 * panel closes it; Escape and a choice return focus to the button. The panel spans the toolbar.
 */
export function ModelMenu({
  models,
  currentId,
  currentName,
  onOpen,
  buttonClass,
}: {
  models: ModelSummary[];
  currentId: string;
  currentName: string;
  onOpen: (id: string) => void;
  buttonClass: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, button);

  const choose = (modelId: string) => {
    setOpen(false);
    button.current?.focus();
    if (modelId !== currentId) onOpen(modelId);
  };

  return (
    <div
      ref={root}
      onBlur={(e) => {
        // Tabbing out of the panel closes it, so it never sits over the control that has focus.
        if (open && e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      {/* Fixed width: a long model name must not re-wrap the toolbar after the canvas has been fitted. */}
      <button
        ref={button}
        type="button"
        className={`${buttonClass} w-48 justify-between`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        data-testid="model-menu-button"
        data-count={models.length}
        data-current={currentId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sr-only">Open model: </span>
        <span data-testid="current-model" className="min-w-0 truncate">
          {currentName || UNTITLED_MODEL}
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      <div
        id={`${id}-panel`}
        hidden={!open}
        data-testid="model-menu"
        className="absolute inset-x-4 top-full z-30 mt-1 max-h-[min(70vh,40rem)] max-w-5xl overflow-y-auto border border-border-strong bg-surface-raised p-4 shadow-lg"
      >
        <h2 className="font-mono text-[0.65rem] tracking-[0.14em] text-accent uppercase">
          Models in this browser · {models.length}
        </h2>
        <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {models.map((m, i) => {
            const current = m.id === currentId;
            const name = m.name || UNTITLED_MODEL;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  data-model-name={name /* read by the e2e helpers to list the models */}
                  aria-labelledby={`${id}-${i}-name`}
                  aria-describedby={`${id}-${i}-about`}
                  aria-current={current || undefined}
                  className={`flex h-full w-full cursor-pointer flex-col border px-3 py-2 text-left hover:bg-surface focus-visible:bg-surface ${current ? "border-accent" : "border-border"}`}
                  onClick={() => choose(m.id)}
                >
                  <span className="flex w-full items-start justify-between gap-2">
                    <span id={`${id}-${i}-name`} className="min-w-0 truncate text-sm font-medium text-ink">
                      {name}
                    </span>
                    {current && (
                      <span aria-hidden="true" className="shrink-0 font-mono text-[0.6rem] tracking-[0.12em] text-accent uppercase">
                        Open
                      </span>
                    )}
                  </span>
                  <span id={`${id}-${i}-about`} className="mt-1 flex flex-col gap-1 text-xs">
                    {m.artifactId && (
                      <span className="flex items-center gap-1.5 font-mono text-ink-soft">
                        <ArtifactIcon className="size-3.5" label="Artifact ID" />
                        <span className="truncate">{m.artifactId}</span>
                      </span>
                    )}
                    {m.description && <span className="line-clamp-2 text-ink-muted">{m.description}</span>}
                    <span className="text-ink-muted">
                      {m.damaged ? "Can't be read" : `${count(m.nodes, "element", "elements")} · ${count(m.edges, "relationship", "relationships")}`} · Updated {when(m.updated)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
