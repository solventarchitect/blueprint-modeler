"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ENVIRONMENT_EXAMPLES, lifecycleFor } from "@/metamodel";
import { PLAN_LABEL, PLAN_STATUSES, planOf, UNTITLED_MODEL, type Model, type PlanStatus } from "@/model";
import { downloadText } from "@/io/download";
import { fileBase } from "@/io/file";
import { ELEMENT_COLUMNS, elementRows, elementsCsv, relationshipRows, relationshipsCsv, type ElementRow, type RelationshipRow } from "@/io/table";
import type { Action } from "./state";

const btn = "inline-flex min-h-8 cursor-pointer items-center border border-border-strong bg-surface-raised px-2.5 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";
const cell = "min-h-8 w-full min-w-28 border border-border-strong bg-surface-raised px-2 text-sm text-ink";
const RELATIONSHIP_COLUMNS: { key: keyof RelationshipRow; label: string }[] = [
  { key: "from", label: "From" },
  { key: "type", label: "Relationship" },
  { key: "to", label: "To" },
  { key: "plan", label: "Plan status" },
];
type Tab = "elements" | "relationships";
type Sort = { key: string; dir: "ascending" | "descending" };

/** Rows in the order asked for: numbers by value, text in the viewer's own collation; ties keep model order. */
function sorted<T extends Record<string, string | number>>(rows: T[], sort: Sort | null): T[] {
  if (!sort) return rows;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const sign = sort.dir === "ascending" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[sort.key]!;
    const y = b[sort.key]!;
    return sign * (typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y)));
  });
}
const matches = (row: Record<string, string | number>, q: string) => !q || Object.entries(row).some(([k, v]) => k !== "id" && String(v).toLowerCase().includes(q));

/**
 * A text cell edited in place: saved trimmed when it loses focus or on Enter (one undo step); Escape
 * puts back what it held, and closes the dialog only when there is nothing to put back. A required
 * cell (Name) left empty keeps what it had, as the Inspector does.
 */
function TextCell({ value, label, list, required, onCommit }: { value: string; label: string; list?: string; required?: boolean; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);
  const [held, setHeld] = useState(value);
  // The model changed under the cell (undo, or a save elsewhere): show what it holds now.
  if (held !== value) {
    setHeld(value);
    setText(value);
  }
  const commit = () => {
    const next = text.trim() || (required ? value : "");
    if (next !== value) onCommit(next);
    // What is shown is what was saved (trimmed, or the name put back).
    setText(next);
  };
  return (
    <input
      className={cell}
      aria-label={label}
      list={list}
      value={text}
      maxLength={200}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape" && text !== value) {
          e.preventDefault();
          setText(value);
        }
      }}
    />
  );
}

function SortHeader({ label, sortKey, sort, onSort }: { label: string; sortKey: string; sort: Sort | null; onSort: (s: Sort) => void }) {
  const dir = sort?.key === sortKey ? sort.dir : undefined;
  return (
    <th scope="col" aria-sort={dir ?? "none"} className="sticky top-0 z-10 border-b border-border-strong bg-surface px-2 py-1.5 text-left font-medium whitespace-nowrap">
      <button type="button" className="inline-flex cursor-pointer items-center gap-1 hover:text-accent" onClick={() => onSort({ key: sortKey, dir: dir === "ascending" ? "descending" : "ascending" })}>
        {label}
        <span aria-hidden="true" className="text-xs text-ink-muted">
          {dir === "ascending" ? "▲" : dir === "descending" ? "▼" : "↕"}
        </span>
      </button>
    </th>
  );
}

/**
 * The table view (M67): every element and relationship of the open model as rows, to review a large
 * model from the keyboard. Elements can be sorted and filtered; their name, life cycle stage,
 * environment and owner are edited in place (each change one undo step), and Go to selects one on
 * the canvas. Either table can be saved as CSV. A modal dialog; Escape or Close closes it.
 */
export function TableView({
  model,
  editable,
  dispatch,
  onGoTo,
  onClose,
}: {
  model: Model;
  /** False below 768px, where the editor is view-only. */
  editable: boolean;
  dispatch: (a: Action) => void;
  onGoTo: (id: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [tab, setTab] = useState<Tab>("elements");
  const [query, setQuery] = useState("");
  const [sorts, setSorts] = useState<Record<Tab, Sort | null>>({ elements: null, relationships: null });
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  const q = query.trim().toLowerCase();
  const elements = useMemo(() => elementRows(model), [model]);
  const relationships = useMemo(() => relationshipRows(model), [model]);
  // While focus is in the rows, they keep their order and membership: a saved edit doesn't move or
  // hide the row being worked in (and take focus with it). Leaving the rows applies filter and sort.
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const shownElements = useMemo(() => {
    if (frozen) {
      const byId = new Map(elements.map((r) => [r.id, r]));
      return frozen.map((id) => byId.get(id)).filter((r) => !!r);
    }
    return sorted(elements.filter((r) => matches(r, q)), sorts.elements);
  }, [elements, q, sorts.elements, frozen]);
  const shownRelationships = useMemo(() => sorted(relationships.filter((r) => matches(r, q)), sorts.relationships), [relationships, q, sorts.relationships]);
  const shown = tab === "elements" ? shownElements.length : shownRelationships.length;
  const total = tab === "elements" ? elements.length : relationships.length;
  const noun = tab === "elements" ? (total === 1 ? "element" : "elements") : total === 1 ? "relationship" : "relationships";
  const classOf = useMemo(() => new Map(model.nodes.map((n) => [n.id, n.class])), [model]);
  const planOfId = useMemo(() => new Map(model.nodes.map((n) => [n.id, n.plan])), [model]);
  const nameOf = useMemo(() => new Map(model.nodes.map((n) => [n.id, n.name])), [model]);
  const owners = useMemo(() => [...new Set(elements.map((r) => r.owner).filter(Boolean))].sort(), [elements]);

  const onSort = (s: Sort) => setSorts((all) => ({ ...all, [tab]: s }));
  const exportCsv = () => {
    const name = `${fileBase(model)}-${tab}.csv`;
    downloadText(name, tab === "elements" ? elementsCsv(shownElements) : relationshipsCsv(shownRelationships), "text/csv;charset=utf-8");
    setStatus(`Saved ${shown} ${shown === 1 ? "row" : "rows"} as ${name}.`);
  };
  const onTabKey = (e: ReactKeyboardEvent) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next: Tab = e.key === "Home" ? "elements" : e.key === "End" ? "relationships" : tab === "elements" ? "relationships" : "elements";
    setTab(next);
    setStatus("");
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  const lifecycleCell = (r: ElementRow) => {
    const lc = lifecycleFor(classOf.get(r.id) ?? "");
    if (!editable || (!lc && !r.lifecycle)) return r.lifecycle;
    const label = `Life cycle stage of ${r.name}`;
    return (
      <select className={cell} aria-label={label} value={r.lifecycle} onChange={(e) => dispatch({ type: "set-attr", id: r.id, key: "lifecycle", value: e.target.value })}>
        <option value="">Not set</option>
        {lc?.stages.map((st) => (
          <option key={st} value={st}>
            {st}
          </option>
        ))}
        {r.lifecycle && !lc?.stages.includes(r.lifecycle) && (
          <option value={r.lifecycle}>
            {r.lifecycle} ({lc ? "not a stage for this class" : "no life cycle for this class"})
          </option>
        )}
      </select>
    );
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${uid}-title`}
      data-testid="table-dialog"
      onClose={onClose}
      className="m-auto flex h-[calc(100dvh-2rem)] w-[min(80rem,calc(100vw-2rem))] max-w-none flex-col border border-border-strong bg-surface p-0 text-ink backdrop:bg-black/40 [&:not([open])]:hidden"
    >
      <div className="border-b border-border px-4 py-3">
        <h2 id={`${uid}-title`} className="text-base font-medium">
          Table of “{model.name || UNTITLED_MODEL}”
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {editable ? "Sort, filter and edit elements in place: each change is one undo step. " : "Sort and filter; editing needs a screen at least 768px wide. "}
          CSV saves the rows shown.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 px-4 pt-3">
        <div role="tablist" aria-label="Table" className="flex gap-1">
          {(["elements", "relationships"] as const).map((t) => (
            <button
              key={t}
              id={`${uid}-tab-${t}`}
              type="button"
              role="tab"
              aria-selected={tab === t}
              aria-controls={`${uid}-panel`}
              tabIndex={tab === t ? 0 : -1}
              onKeyDown={onTabKey}
              onClick={() => {
                setTab(t);
                setStatus("");
              }}
              className={`min-h-8 cursor-pointer border px-2.5 text-sm ${tab === t ? "border-accent text-accent" : "border-border-strong text-ink hover:text-accent"}`}
            >
              {t === "elements" ? `Elements (${elements.length})` : `Relationships (${relationships.length})`}
            </button>
          ))}
        </div>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="text-ink-muted">Filter</span>
          <input type="search" className="min-h-8 border border-border-strong bg-surface-raised px-2 text-sm text-ink" value={query} onChange={(e) => {
              setQuery(e.target.value);
              setStatus("");
            }} placeholder="Any text in a row" />
        </label>
        <button type="button" className={btn} disabled={shown === 0} onClick={exportCsv}>
          Save as CSV
        </button>
      </div>
      <p role="status" className="px-4 pt-2 text-sm text-ink-muted">
        {q ? `${shown} of ${total} ${noun} match.` : ""} {status}
      </p>
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`} className="mx-4 my-2 min-h-0 flex-1 overflow-auto border border-border">
        {total === 0 ? (
          <p className="p-3 text-sm text-ink-muted">The model has no {tab} yet.</p>
        ) : tab === "elements" ? (
          <table className="w-full border-collapse text-sm" data-testid="elements-table">
            <caption className="sr-only">Elements{sorts.elements ? `, sorted by ${ELEMENT_COLUMNS.find((c) => c.key === sorts.elements!.key)?.label}, ${sorts.elements.dir}` : ""}</caption>
            <thead>
              <tr>
                {ELEMENT_COLUMNS.map((c) => (
                  <SortHeader key={c.key} label={c.label} sortKey={c.key} sort={sorts.elements} onSort={onSort} />
                ))}
                <th scope="col" className="sticky top-0 z-10 border-b border-border-strong bg-surface px-2 py-1.5">
                  <span className="sr-only">Go to</span>
                </th>
              </tr>
            </thead>
            <tbody
              onFocus={() => setFrozen((f) => f ?? shownElements.map((r) => r.id))}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setFrozen(null);
              }}
            >
              {shownElements.map((r) => (
                <tr key={r.id} className="border-b border-border align-middle">
                  <th scope="row" className="px-2 py-1 text-left font-normal">
                    {editable ? <TextCell required value={nameOf.get(r.id) ?? ""} label={`Name of ${r.name}`} onCommit={(name) => dispatch({ type: "rename-node", id: r.id, name })} /> : r.name}
                  </th>
                  <td className="px-2 py-1 whitespace-nowrap">{r.cls}</td>
                  <td className="px-2 py-1">{r.layer}</td>
                  <td className="px-2 py-1">{lifecycleCell(r)}</td>
                  <td className="px-2 py-1">{editable ? <TextCell value={r.environment} label={`Environment of ${r.name}`} list={`${uid}-environments`} onCommit={(value) => dispatch({ type: "set-attr", id: r.id, key: "environment", value })} /> : r.environment}</td>
                  <td className="px-2 py-1">{editable ? <TextCell value={r.owner} label={`Owner of ${r.name}`} list={`${uid}-owners`} onCommit={(value) => dispatch({ type: "set-attr", id: r.id, key: "owner", value })} /> : r.owner}</td>
                  <td className="px-2 py-1">{r.ref}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.relationships}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.hints}</td>
                  <td className="px-2 py-1">
                    {editable ? (
                      <select className={cell} aria-label={`Plan status of ${r.name}`} value={planOf({ plan: planOfId.get(r.id) })} onChange={(e) => dispatch({ type: "set-plan", target: "node", id: r.id, plan: e.target.value as PlanStatus })}>
                        {PLAN_STATUSES.map((p) => (
                          <option key={p} value={p}>
                            {PLAN_LABEL[p]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      r.plan
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <button type="button" className={btn} aria-label={`Go to ${r.name}`} onClick={() => onGoTo(r.id)}>
                      Go to
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse text-sm" data-testid="relationships-table">
            <caption className="sr-only">Relationships{sorts.relationships ? `, sorted by ${RELATIONSHIP_COLUMNS.find((c) => c.key === sorts.relationships!.key)?.label}, ${sorts.relationships.dir}` : ""}</caption>
            <thead>
              <tr>
                {RELATIONSHIP_COLUMNS.map((c) => (
                  <SortHeader key={c.key} label={c.label} sortKey={c.key} sort={sorts.relationships} onSort={onSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {shownRelationships.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className="px-2 py-1.5">{r.from}</td>
                  <td className="px-2 py-1.5">{r.type}</td>
                  <td className="px-2 py-1.5">{r.to}</td>
                  <td className="px-2 py-1.5">{r.plan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > 0 && shown === 0 && <p className="p-3 text-sm text-ink-muted">Nothing matches “{query.trim()}”.</p>}
      </div>
      <datalist id={`${uid}-environments`}>
        {ENVIRONMENT_EXAMPLES.values.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
      <datalist id={`${uid}-owners`}>
        {owners.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      <div className="flex justify-end border-t border-border px-4 py-3">
        <button type="button" className={btn} onClick={() => dialog.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}
