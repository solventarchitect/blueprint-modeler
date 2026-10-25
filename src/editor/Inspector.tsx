"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ARCHIMATE_TRADEMARK, archimateElements, archimateRelationshipFor, archimateSources, type ElementMapping, type Lens, showsArchimate } from "@/frameworks";
import { ArchimateGlyph } from "@/frameworks/ArchimateGlyph";
import { classSlug } from "@/guide";
import { allowedTypes, classById, ENVIRONMENT_EXAMPLES, isClassId, isCsdmCore, LIFE_CYCLE, lifecycleFor, sources } from "@/metamodel";
import { modelDate, type Model } from "@/model";
import type { Action } from "./state";
import { suggestionDetail, suggestionLabel, type Suggestion } from "./suggest";

type Props = {
  model: Model;
  selectedId: string | null;
  dispatch: (a: Action) => void;
  focusName: number;
  /** Bumped to move focus to "Add a relationship" (context menu). */
  focusConnect?: number;
  /** Relationships to offer while the element has none. */
  suggestions?: Suggestion[];
  onSuggest?: (s: Suggestion) => void;
  onSelect: (id: string | null) => void;
  newId: () => string;
  lens?: Lens;
  /** Show the selected element's blast radius; `from` gets focus back when it closes. */
  onBlast?: (from: HTMLElement) => void;
  /** Show the data flow from the selected Business Capability or Business Process. */
  onFlow?: (from: HTMLElement) => void;
};

const input =
  "w-full border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2";
const button =
  "cursor-pointer border border-border-strong px-2.5 py-1.5 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60";

/** Name committed on Enter or blur, so typing a name is one undo step, not one per key. */
function NameField({
  id,
  value,
  label,
  onCommit,
  focusToken,
  optional = false,
  maxLength = 200,
  help,
  list,
}: {
  id: string;
  value: string;
  /** A datalist of suggestions (M54: environments, owners already used). */
  list?: string;
  label: string;
  onCommit: (v: string) => void;
  focusToken?: number;
  /** An optional field may be cleared; a name falls back to its last value when left empty. */
  optional?: boolean;
  maxLength?: number;
  help?: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  // A new value, or another element: start again from it (adjusted while rendering, not in an effect).
  const [from, setFrom] = useState({ value, id });
  if (from.value !== value || from.id !== id) {
    setFrom({ value, id });
    setDraft(value);
  }
  useEffect(() => {
    if (focusToken) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [focusToken]);
  const commit = () => draft !== value && onCommit(optional ? draft.trim() : draft.trim() || value);
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      <input
        ref={ref}
        className={input}
        value={draft}
        maxLength={maxLength}
        list={list}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(value);
        }}
      />
      {help && <span className="text-xs text-ink-muted">{help}</span>}
    </label>
  );
}

const PROCESS_LABEL = { product: "product", tangible: "tangible / physical", logical: "intangible / logical", document: "document", "tangible-or-logical": "tangible / physical or intangible / logical" } as const;

/**
 * The element's CSDM life cycle stage (M54): the stages of the life cycle process its class follows,
 * from the CSDM 5 white paper. Saved on change, one undo step. A value from a file that is not a stage
 * for this class is kept and shown as such.
 */
function LifecycleField({ cls, value, onCommit }: { cls: string; value: string; onCommit: (v: string) => void }) {
  const lc = lifecycleFor(cls);
  // No CSDM life cycle for this class: nothing to set, but a value from a file can still be seen and cleared.
  if (!lc)
    return value ? (
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">Life cycle stage</span>
        <select className={input} value={value} onChange={(e) => onCommit(e.target.value)}>
          <option value="">Not set</option>
          <option value={value}>{value} (no life cycle for this class)</option>
        </select>
      </label>
    ) : null;
  const pages = lc.process === "tangible-or-logical" ? `pp. ${LIFE_CYCLE.tangible.source.page}, ${LIFE_CYCLE.logical.source.page}` : `p. ${LIFE_CYCLE[lc.process].source.page}`;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted">Life cycle stage</span>
      <select className={input} value={value} onChange={(e) => onCommit(e.target.value)}>
        <option value="">Not set</option>
        {lc.stages.map((st) => (
          <option key={st} value={st}>
            {st}
          </option>
        ))}
        {value && !lc.stages.includes(value) && <option value={value}>{value} (not a stage for this class)</option>}
      </select>
      <span className="text-xs text-ink-muted">
        The {PROCESS_LABEL[lc.process]} life cycle,{" "}
        <a className="text-accent underline underline-offset-4" href={sources.whitepaper.url} target="_blank" rel="noopener noreferrer">
          CSDM 5 white paper<span className="sr-only"> (opens in a new tab)</span>
        </a>
        , {pages}.
      </span>
    </label>
  );
}

/** A CI's description: saved when the field loses focus (Ctrl+Enter also saves; Escape reverts). */
function DescriptionField({
  id,
  value,
  onCommit,
  help = "Shown when you hover the element, and exported to ServiceNow as its description.",
}: {
  id: string;
  value: string;
  onCommit: (v: string) => void;
  help?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [from, setFrom] = useState({ value, id });
  if (from.value !== value || from.id !== id) {
    setFrom({ value, id });
    setDraft(value);
  }
  const commit = () => draft.trim() !== value && onCommit(draft);
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-muted">Description</span>
      <textarea
        className={`${input} min-h-20 resize-y py-1.5`}
        value={draft}
        maxLength={1000}
        rows={3}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commit();
          if (e.key === "Escape") setDraft(value);
        }}
      />
      <span className="text-xs text-ink-muted">{help}</span>
    </label>
  );
}

/** Reads a CSDM edge in ArchiMate terms, e.g. "Serving — the node serves the instance". */
function archimateRelFor(model: Model) {
  const classOf = new Map(model.nodes.map((n) => [n.id, n.class]));
  return (from: string, to: string) => {
    const m = archimateRelationshipFor(classOf.get(from) ?? "", classOf.get(to) ?? "");
    return m ? `${m.type} — ${m.reads}` : undefined;
  };
}

/** Details of the selected element, its relationships, and a keyboard way to add more. */
export function Inspector({ model, selectedId, dispatch, focusName, focusConnect = 0, suggestions = [], onSuggest, onSelect, newId, lens = "csdm", onBlast, onFlow }: Props) {
  const connectRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (focusConnect) connectRef.current?.focus();
  }, [focusConnect]);
  const node = model.nodes.find((n) => n.id === selectedId);
  const connectId = useId();
  const archimateRel = archimateRelFor(model);
  const [target, setTarget] = useState("");
  // Another element: no relationship target picked yet.
  const [targetFor, setTargetFor] = useState(selectedId);
  if (targetFor !== selectedId) {
    setTargetFor(selectedId);
    setTarget("");
  }

  if (!node) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <NameField id={model.id} value={model.name} label="Model name" onCommit={(name) => dispatch({ type: "rename-model", name })} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Date</span>
          <input
            type="date"
            className={input}
            value={modelDate(model)}
            onChange={(e) => e.target.value && dispatch({ type: "model-details", date: e.target.value })}
          />
          <span className="text-xs text-ink-muted">The model&apos;s date, shown in the title block. Starts as the day the model was created.</span>
        </label>
        <DescriptionField
          id={model.id}
          value={model.description ?? ""}
          help="Optional. Shown under the model's name on the canvas, when presenting and in images."
          onCommit={(description) => dispatch({ type: "model-details", description })}
        />
        <NameField
          id={model.id}
          value={model.artifactId ?? ""}
          label="Artifact ID"
          optional
          maxLength={64}
          help="Optional. Your reference for this model, such as a document or architecture ID. Shown with a tag icon above the name."
          onCommit={(artifactId) => dispatch({ type: "model-details", artifactId })}
        />
        <p className="text-sm text-ink-muted">
          {model.nodes.length} elements · {model.edges.length} relationships. Add an element from the palette, or select one on the canvas.
        </p>
      </div>
    );
  }

  const def = classById(node.class);
  const nameOf = (id: string) => model.nodes.find((n) => n.id === id)?.name || "Untitled";
  const outgoing = model.edges.filter((e) => e.from === node.id);
  const incoming = model.edges.filter((e) => e.to === node.id);
  // Candidate connections in either direction, only where the metamodel allows them.
  const options = model.nodes
    .filter((n) => n.id !== node.id)
    .flatMap((n) => [
      ...allowedTypes(node.class, n.class).map((t) => ({ value: `out|${n.id}|${t}`, label: `→ ${n.name || "Untitled"} (${t})` })),
      ...allowedTypes(n.class, node.class).map((t) => ({ value: `in|${n.id}|${t}`, label: `← ${n.name || "Untitled"} (${t})` })),
    ])
    .filter((o) => {
      const [dir, other, t] = o.value.split("|");
      const [from, to] = dir === "out" ? [node.id, other] : [other, node.id];
      return !model.edges.some((e) => e.from === from && e.to === to && e.type === t);
    });

  const am: ElementMapping | undefined = showsArchimate(lens) && isClassId(node.class) ? archimateElements[node.class] : undefined;

  const addRelationship = () => {
    const [dir, other, t] = target.split("|");
    if (!other || !t) return;
    const [from, to] = dir === "out" ? [node.id, other] : [other, node.id];
    dispatch({ type: "add-edge", id: newId(), from, to, edgeType: t });
    setTarget("");
  };

  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-4">
      <div>
        <p className="font-mono text-[0.65rem] tracking-[0.14em] text-ink-muted uppercase">{def?.label}</p>
        <p className="mt-1 text-sm text-ink-soft">{def?.description}</p>
        {def && !isCsdmCore(def) && (
          <p className="mt-1 text-xs text-ink-muted" data-testid="cmdb-extension">
            A CMDB class from ServiceNow product documentation, not part of the CSDM white paper.
          </p>
        )}
        {def && (
          <a className="mt-1 inline-block text-xs text-accent underline underline-offset-4" href={sources[def.source.id].url} target="_blank" rel="noopener noreferrer">
            Source: {def.source.id === "whitepaper" ? "CSDM 5 white paper" : sources[def.source.id].title}
            {"page" in def.source ? `, p. ${def.source.page}` : ""}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
        {def && (
          <a className="mt-2 flex min-h-6 w-fit items-center text-xs text-accent underline underline-offset-4" href={`/guide#${classSlug(def.id)}`}>
            In the guide: what {def.label} connects to
          </a>
        )}
      </div>
      {am && (
        <section aria-labelledby="archimate-heading" className="border border-border p-3" data-testid="lens-panel">
          <h2 id="archimate-heading" className="font-mono text-[0.65rem] tracking-[0.14em] text-ink-muted uppercase">
            In ArchiMate 3.2
          </h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-ai">
            <ArchimateGlyph type={am.type} />
            {am.label}
          </p>
          <p className="text-xs text-ink-muted">{am.layer} layer</p>
          {am.note && <p className="mt-1 text-xs text-ink-soft">{am.note}</p>}
          <a className="mt-1 inline-block text-xs text-accent underline underline-offset-4" href={archimateSources[am.source].url} target="_blank" rel="noopener noreferrer">
            Source: {archimateSources[am.source].title.replace("ArchiMate® 3.2 Specification — ", "ArchiMate 3.2, ")}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <p className="mt-1 text-[0.65rem] text-ink-muted">{ARCHIMATE_TRADEMARK}</p>
        </section>
      )}
      <NameField id={node.id} value={node.name} label="Name" focusToken={focusName} onCommit={(name) => dispatch({ type: "rename-node", id: node.id, name })} />
      <DescriptionField id={node.id} value={node.attrs?.description ?? ""} onCommit={(description) => dispatch({ type: "describe-node", id: node.id, description })} />
      <LifecycleField cls={node.class} value={node.attrs?.lifecycle ?? ""} onCommit={(value) => dispatch({ type: "set-attr", id: node.id, key: "lifecycle", value })} />
      <NameField
        id={node.id}
        value={node.attrs?.environment ?? ""}
        label="Environment"
        optional
        list="bm-environment-options"
        help="For example Production, Test or Development."
        onCommit={(value) => dispatch({ type: "set-attr", id: node.id, key: "environment", value })}
      />
      <NameField id={node.id} value={node.attrs?.owner ?? ""} label="Owner" optional list="bm-owner-options" help="A person, team or group." onCommit={(value) => dispatch({ type: "set-attr", id: node.id, key: "owner", value })} />
      {/* Suggestions: the white paper's environment examples and every value already used in this model. */}
      <datalist id="bm-environment-options">
        {[...new Set([...ENVIRONMENT_EXAMPLES.values, ...model.nodes.map((n) => n.attrs?.environment?.trim() ?? "").filter(Boolean)])].map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="bm-owner-options">
        {[...new Set(model.nodes.map((n) => n.attrs?.owner?.trim() ?? "").filter(Boolean))].map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <section aria-labelledby="rel-heading" className="flex flex-col gap-2">
        <h2 id="rel-heading" className="text-sm font-medium">
          Relationships
        </h2>
        {outgoing.length + incoming.length === 0 && <p className="text-sm text-ink-muted">None yet.</p>}
        {outgoing.length + incoming.length === 0 && suggestions.length > 0 && onSuggest && (
          <div data-testid="inspector-suggestions">
            <p className="text-xs text-ink-muted">Suggested — each adds an allowed relationship:</p>
            <ul className="mt-1 flex flex-col gap-1">
              {suggestions.map((s) => (
                <li key={s.kind === "existing" ? s.nodeId : s.cls}>
                  <button type="button" className={`${button} flex w-full flex-col items-start text-left`} onClick={() => onSuggest(s)}>
                    <span>{suggestionLabel(s)}</span>
                    <span className="font-mono text-[0.65rem] text-ink-muted">{suggestionDetail(s)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {[...outgoing.map((e) => ({ e, text: `→ ${nameOf(e.to)}` })), ...incoming.map((e) => ({ e, text: `← ${nameOf(e.from)}` }))].map(({ e, text }) => (
            <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex flex-col">
                <span>{text}</span>
                <span className="font-mono text-xs text-ink-muted">{e.type}</span>
                {showsArchimate(lens) && archimateRel(e.from, e.to) && <span className="text-xs text-ai">ArchiMate: {archimateRel(e.from, e.to)}</span>}
              </span>
              <button type="button" className={button} onClick={() => dispatch({ type: "delete-edge", id: e.id })} aria-label={`Remove relationship ${text} ${e.type}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <label htmlFor={connectId} className="mt-2 text-sm text-ink-muted">
          Add a relationship
        </label>
        <div className="flex gap-2">
          <select id={connectId} ref={connectRef} className={input} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">{options.length ? "Choose an element…" : "No allowed relationships yet"}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="button" className={button} disabled={!target} onClick={addRelationship}>
            Add
          </button>
        </div>
      </section>

      {onBlast && (
        <div className="flex flex-col gap-1">
          <button type="button" className={`${button} self-start`} onClick={(e) => onBlast(e.currentTarget)}>
            Show blast radius
          </button>
          <span className="text-xs text-ink-muted">What is affected if this element fails, hop by hop. Changes nothing.</span>
        </div>
      )}
      {onFlow && (
        <div className="flex flex-col gap-1">
          <button type="button" className={`${button} self-start`} onClick={(e) => onFlow(e.currentTarget)}>
            Show data flow
          </button>
          <span className="text-xs text-ink-muted">Where its data goes, step by step, through everything it relies on. Changes nothing.</span>
        </div>
      )}

      <button
        type="button"
        className={`${button} self-start`}
        onClick={() => {
          dispatch({ type: "delete-node", id: node.id });
          onSelect(null);
        }}
      >
        Delete element
      </button>
    </div>
  );
}
