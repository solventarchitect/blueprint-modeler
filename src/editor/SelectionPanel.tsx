"use client";

import { useId, useState } from "react";
import type { AlignEdge } from "@/layout/align";
import { lifecycleFor } from "@/metamodel";
import type { Node } from "@/model";

/** The properties a selection can set on all its elements at once (M63). */
export type BatchKey = "lifecycle" | "environment" | "owner";

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

const input = "min-h-9 border border-border-strong bg-surface px-2 text-sm text-ink";

/**
 * The elements a change applies to (M63): all of them, except that a life cycle stage goes only to
 * those whose class has a CSDM life cycle.
 */
export function batchTargets(nodes: Node[], key: BatchKey): Node[] {
  return key === "lifecycle" ? nodes.filter((n) => lifecycleFor(n.class)) : nodes;
}

/** The value every element shares, "" when none has one, or null when they differ. */
const common = (nodes: Node[], key: BatchKey) => {
  const values = new Set(nodes.map((n) => n.attrs?.[key]?.trim() ?? ""));
  return values.size === 1 ? [...values][0]! : null;
};

/**
 * The life cycle stages every selected element's class offers (M63), and how many elements have no
 * CSDM life cycle (they are left alone).
 */
export function sharedStages(nodes: Node[]): { stages: string[]; skipped: number } {
  const lists = nodes.map((n) => lifecycleFor(n.class)?.stages ?? null);
  const withStages = lists.filter((l): l is readonly string[] => !!l);
  const stages = withStages.length ? withStages[0]!.filter((s) => withStages.every((l) => l.includes(s))) : [];
  return { stages, skipped: lists.length - withStages.length };
}

/** A text property for all of them: Apply (or Enter) sets it on every one; applied empty, it clears them. */
function BatchText({ label, nodes, k, list, onSet }: { label: string; nodes: Node[]; k: BatchKey; list: string; onSet: (key: BatchKey, value: string) => void }) {
  const shared = common(nodes, k);
  const [draft, setDraft] = useState(shared ?? "");
  // The shared value changed (applied, undone): start again from it, keeping the field (and focus).
  const [from, setFrom] = useState(shared);
  if (from !== shared) {
    setFrom(shared);
    setDraft(shared ?? "");
  }
  const id = useId();
  const apply = () => onSet(k, draft);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="text-ink-muted">
        {label}
      </label>
      <div className="flex gap-1">
        <input
          id={id}
          className={`${input} min-w-0 flex-1`}
          value={draft}
          list={list}
          maxLength={100}
          placeholder={shared === null ? "Mixed" : "Not set"}
          aria-describedby={`${id}-help`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
        />
        <button type="button" className={button} onClick={apply} aria-label={`Apply ${label.toLowerCase()} to all ${nodes.length}`}>
          Apply
        </button>
      </div>
      <span id={`${id}-help`} className="text-xs text-ink-muted">
        {shared === null ? "They differ now. " : ""}Applied empty, it clears them.
      </span>
    </div>
  );
}

/** The side panel while several elements are selected: what they are, and what to do with them. */
export function SelectionPanel({
  names,
  nodes = [],
  suggestions = { environment: [], owner: [] },
  onArrange,
  onSetAttr,
  onDelete,
  onClear,
}: {
  names: string[];
  nodes?: Node[];
  suggestions?: { environment: string[]; owner: string[] };
  onArrange: (k: ArrangeKind) => void;
  onSetAttr?: (key: BatchKey, value: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const lifecycleId = useId();
  const { stages, skipped } = sharedStages(nodes);
  const withLifecycle = nodes.filter((n) => lifecycleFor(n.class));
  const lifecycle = withLifecycle.length ? common(withLifecycle, "lifecycle") : "";
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
      {onSetAttr && nodes.length > 1 && (
        // Keyed by the selection: another selection starts from its own values.
        <section key={nodes.map((n) => n.id).join(" ")} aria-labelledby={`${lifecycleId}-head`} className="flex flex-col gap-3 border-t border-border pt-3">
          <h3 id={`${lifecycleId}-head`} className="text-sm font-medium text-ink">
            Set for all {nodes.length}
          </h3>
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor={lifecycleId} className="text-ink-muted">
              Life cycle stage
            </label>
            <select
              id={lifecycleId}
              className={input}
              value={lifecycle ?? "__mixed"}
              disabled={!stages.length}
              aria-describedby={`${lifecycleId}-help`}
              onChange={(e) => e.target.value !== "__mixed" && onSetAttr("lifecycle", e.target.value)}
            >
              {lifecycle === null && (
                <option value="__mixed" disabled>
                  Mixed
                </option>
              )}
              <option value="">Not set</option>
              {stages.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
              {lifecycle && !stages.includes(lifecycle) && <option value={lifecycle}>{lifecycle} (not a stage for all of them)</option>}
            </select>
            <span id={`${lifecycleId}-help`} className="text-xs text-ink-muted">
              {!withLifecycle.length
                ? "None of these classes has a CSDM life cycle."
                : !stages.length
                ? "These classes share no life cycle stage: set it on each one."
                : `The stages all of them offer.${skipped ? ` ${skipped} without a CSDM life cycle ${skipped === 1 ? "is" : "are"} left as ${skipped === 1 ? "it is" : "they are"}.` : ""}`}
            </span>
          </div>
          <BatchText label="Environment" nodes={nodes} k="environment" list="bm-batch-environment-options" onSet={onSetAttr} />
          <BatchText label="Owner" nodes={nodes} k="owner" list="bm-batch-owner-options" onSet={onSetAttr} />
          <datalist id="bm-batch-environment-options">
            {suggestions.environment.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="bm-batch-owner-options">
            {suggestions.owner.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </section>
      )}
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
