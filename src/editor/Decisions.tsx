"use client";

import { useEffect, useId, useRef, useState } from "react";
import { classById } from "@/metamodel";
import { decisionLinks, decisionsSupersededBy, DECISION_STATUSES, DECISION_STATUS_LABEL, formatModelDate, replacementChoices, MAX_DECISION_ELEMENTS, MAX_DECISIONS, UNTITLED_MODEL, type Decision, type DecisionStatus, type Model } from "@/model";
import { downloadText } from "@/io/download";
import { fileBase } from "@/io/file";
import { decisionsCsv } from "@/io/table";
import type { Action } from "./state";

const btn = "inline-flex min-h-8 cursor-pointer items-center border border-border-strong bg-surface-raised px-2.5 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";
const field = "min-h-8 border border-border-strong bg-surface-raised px-2 text-sm text-ink";
const TEXTS = [
  ["context", "Context", "What made a decision necessary: the forces, constraints and options."],
  ["decision", "Decision", "What was decided."],
  ["consequences", "Consequences", "What follows from it, good and bad."],
] as const;

/** Where the dialog opens: on a decision, or making one about an element (from the Inspector). */
export type DecisionsStart = { pick?: string; about?: string };

/** A decision as the model keeps it: trimmed, empty text and no elements left out (as the reducer saves it). */
function kept(d: Decision): Decision {
  const { id, status, supersededBy, date, elements } = d;
  const text = (k: (typeof TEXTS)[number][0]) => (d[k]?.trim() ? { [k]: d[k]!.trim() } : {});
  return { id, title: d.title.trim(), status, ...(status === "superseded" && supersededBy ? { supersededBy } : {}), ...(date ? { date } : {}), ...text("context"), ...text("decision"), ...text("consequences"), ...(elements?.length ? { elements } : {}) };
}

/** A decision's status, date and how many elements it concerns, in words. */
export const decisionMeta = (d: Decision) =>
  [DECISION_STATUS_LABEL[d.status], d.date ? formatModelDate(d.date) : "", d.elements?.length ? `${d.elements.length} element${d.elements.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");

/**
 * Decisions (M78): architecture decision records kept with the model (title, status, date, context,
 * decision, consequences and the elements they concern), listed here and shown in the Inspector of
 * those elements. Kept in the model (and its file); each save is one undo step. A modal dialog.
 */
export function DecisionsDialog({
  model,
  editable,
  dispatch,
  newId,
  today,
  start = {},
  onClose,
  onSelectElements,
}: {
  model: Model;
  /** False below 768px, where the editor is view-only: decisions can be read, not changed. */
  editable: boolean;
  dispatch: (a: Action) => void;
  newId: () => string;
  /** The local day, as YYYY-MM-DD: a new decision's date. */
  today: string;
  start?: DecisionsStart;
  onClose: () => void;
  /** M80: select a decision's elements on the canvas (closes the dialog). */
  onSelectElements?: (ids: string[], title: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const decisions = model.decisions ?? [];
  const about = start.about && model.nodes.find((n) => n.id === start.about);
  const [pickedId, setPickedId] = useState<string | null>(start.pick ?? (about ? null : (decisions[0]?.id ?? null)));
  const picked = decisions.find((d) => d.id === pickedId) ?? null;
  const [newTitle, setNewTitle] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    // Making one about an element: straight to its title.
    if (about && editable) document.getElementById(`${uid}-new`)?.focus();
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = () => {
    const title = newTitle.trim();
    if (!title || decisions.length >= MAX_DECISIONS) return;
    const id = newId();
    dispatch({ type: "save-decision", decision: { id, title, status: "proposed", date: today, ...(about ? { elements: [about.id] } : {}) } });
    setStatus(`Made decision “${title}”${about ? `, about ${about.name || "Untitled"}` : ""}. Fill in its context, decision and consequences.`);
    setPickedId(id);
    setNewTitle("");
    setTimeout(() => document.getElementById(`${uid}-context`)?.focus(), 0);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${uid}-title`}
      data-testid="decisions-dialog"
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(48rem,calc(100vw-2rem))] border border-border-strong bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <div className="border-b border-border px-4 py-3">
        <h2 id={`${uid}-title`} className="text-base font-medium">
          Decisions of “{model.name || UNTITLED_MODEL}”
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Architecture decisions kept with the model: what was decided, why, what follows, and the elements it concerns. Each shows in the Inspector of those elements and in the model book.
        </p>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        <p role="status" className="text-sm text-ink-muted">
          {status}
        </p>
        {decisions.length > 0 ? (
          <section aria-labelledby={`${uid}-list`}>
            <h3 id={`${uid}-list`} className="text-sm font-medium">
              Decisions ({decisions.length} of {MAX_DECISIONS})
            </h3>
            <ul className="mt-1.5 flex flex-col gap-1">
              {decisions.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2" data-testid="decision">
                  <button type="button" aria-pressed={picked?.id === d.id} className={`${btn} aria-pressed:border-accent aria-pressed:text-accent`} onClick={() => setPickedId(d.id)}>
                    {d.title}
                  </button>
                  <span className="text-xs text-ink-muted">{[decisionMeta(d), ...decisionLinks(model, d)].join(" · ")}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          !editable && <p className="text-sm text-ink-muted">No decisions yet.</p>
        )}
        {picked &&
          (editable ? (
            <DecisionEditor
              key={picked.id}
              model={model}
              decision={picked}
              uid={uid}
              onSelectElements={onSelectElements}
              onOpen={setPickedId}
              save={(d, said) => {
                dispatch({ type: "save-decision", decision: d });
                // A save as the editor goes (another decision picked) says nothing, so it never talks over what happens next.
                if (said) setStatus(said);
              }}
              onDelete={() => {
                dispatch({ type: "delete-decision", id: picked.id });
                setStatus(`Deleted decision “${picked.title}”. Undo brings it back.`);
                setPickedId(null);
                setTimeout(() => document.getElementById(`${uid}-new`)?.focus(), 0);
              }}
            />
          ) : (
            <DecisionText model={model} decision={picked} onSelectElements={onSelectElements} onOpen={setPickedId} />
          ))}
        {editable &&
          (decisions.length >= MAX_DECISIONS ? (
            <p className="text-sm text-ink-muted">A model keeps up to {MAX_DECISIONS} decisions: delete one to make another.</p>
          ) : (
            <section aria-labelledby={`${uid}-make`} className="flex flex-col gap-1.5">
              <h3 id={`${uid}-make`} className="text-sm font-medium">
                New decision{about ? ` about ${about.name || "Untitled"}` : ""}
              </h3>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <span className="text-ink-muted">New decision title</span>
                  <input
                    id={`${uid}-new`}
                    className={field}
                    value={newTitle}
                    maxLength={120}
                    placeholder="Cache the product catalog"
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        create();
                      }
                    }}
                  />
                </label>
                <button type="button" className={btn} disabled={!newTitle.trim()} onClick={create}>
                  Make decision
                </button>
              </div>
            </section>
          ))}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
        {decisions.length > 0 && (
          <button
            type="button"
            className={btn}
            onClick={() => {
              downloadText(`${fileBase(model)}-decisions.csv`, decisionsCsv(model), "text/csv;charset=utf-8");
              setStatus(`Saved ${decisions.length} decision${decisions.length === 1 ? "" : "s"} as CSV.`);
            }}
          >
            Save as CSV
          </button>
        )}
        <button type="button" className={btn} onClick={() => dialog.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}

const nameOf = (model: Model, id: string) => model.nodes.find((n) => n.id === id)?.name || "Untitled";

/**
 * M85: the decision that replaced this one, and those it replaced, each a button that opens it here.
 * Below a decision's status, so its chain can be walked either way.
 */
function DecisionLinks({ model, decision: d, onOpen }: { model: Model; decision: Decision; onOpen: (id: string) => void }) {
  const by = d.supersededBy ? model.decisions?.find((x) => x.id === d.supersededBy) : undefined;
  const replaced = decisionsSupersededBy(model, d.id);
  if (!by && !replaced.length) return null;
  const open = (x: Decision) => (
    <button key={x.id} type="button" className="cursor-pointer text-left text-accent underline underline-offset-4" onClick={() => onOpen(x.id)}>
      {x.title}
    </button>
  );
  return (
    <div className="flex flex-col gap-1 text-sm" data-testid="decision-links">
      {by && <p>Superseded by {open(by)}</p>}
      {replaced.length > 0 && (
        <p>
          Supersedes{" "}
          {replaced.map((x, i) => (
            <span key={x.id}>
              {i > 0 && ", "}
              {open(x)}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/** A decision as text, for the view-only editor below 768px. */
function DecisionText({ model, decision: d, onSelectElements, onOpen }: { model: Model; decision: Decision; onSelectElements?: (ids: string[], title: string) => void; onOpen: (id: string) => void }) {
  return (
    <article aria-label={d.title} className="flex flex-col gap-1.5 text-sm">
      <h3 className="font-medium">{d.title}</h3>
      <p className="text-ink-muted">{decisionMeta(d)}</p>
      <DecisionLinks model={model} decision={d} onOpen={onOpen} />
      {TEXTS.map(([k, label]) =>
        d[k] ? (
          <div key={k}>
            <h4 className="text-xs font-medium text-ink-muted">{label}</h4>
            <p className="whitespace-pre-line">{d[k]}</p>
          </div>
        ) : null,
      )}
      {!!d.elements?.length && <p>Concerns {d.elements.map((e) => nameOf(model, e)).join(", ")}</p>}
      {!!d.elements?.length && onSelectElements && (
        <button type="button" className={`${btn} self-start`} onClick={() => onSelectElements(d.elements!, d.title)}>
          Select its elements
        </button>
      )}
    </article>
  );
}

/** One decision's fields, saved together (one undo step); changes not yet saved are saved when another decision is picked or the dialog closes. */
function DecisionEditor({
  model,
  decision,
  uid,
  save,
  onDelete,
  onSelectElements,
  onOpen,
}: {
  model: Model;
  decision: Decision;
  uid: string;
  save: (d: Decision, said?: string) => void;
  onDelete: () => void;
  onSelectElements?: (ids: string[], title: string) => void;
  /** M85: open another decision (this one's changes are saved as the editor goes). */
  onOpen: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Decision>(decision);
  const dirty = JSON.stringify(kept(draft)) !== JSON.stringify(kept(decision));
  const valid = !!draft.title.trim();
  const [confirming, setConfirming] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const askButton = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  useEffect(() => {
    // The question takes focus once; Keep it gives it back to the button that asked.
    if (confirming) deleteButton.current?.focus();
    else if (asked.current) askButton.current?.focus();
    asked.current = confirming;
  }, [confirming]);
  // Saved when this editor goes (another decision picked, the dialog closed), so nothing typed is lost;
  // not after a delete. A title emptied meanwhile keeps the saved one.
  const deleted = useRef(false);
  const pending = useRef<Decision | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    pending.current = dirty && !deleted.current ? { ...kept(draft), title: valid ? draft.title.trim() : decision.title } : null;
    saveRef.current = save;
  });
  useEffect(
    () => () => {
      if (pending.current && !deleted.current) saveRef.current(pending.current);
    },
    [],
  );
  // Removing an element moves focus to the next Remove button, else the previous, else Add an element.
  const removeAt = (i: number) => {
    const rest = elements.filter((_, k) => k !== i);
    set({ elements: rest });
    setTimeout(() => document.getElementById(rest.length ? `${uid}-rm-${Math.min(i, rest.length - 1)}` : `${uid}-add`)?.focus(), 0);
  };
  const set = (patch: Partial<Decision>) => setDraft((d) => ({ ...d, ...patch }));
  const choices = replacementChoices(model, decision.id);
  const elements = draft.elements ?? [];
  const others = model.nodes.filter((n) => !elements.includes(n.id)).sort((a, b) => (a.name || "Untitled").localeCompare(b.name || "Untitled"));

  return (
    <section aria-labelledby={`${uid}-edit`} className="flex flex-col gap-3 border-t border-border pt-3" data-testid="decision-editor">
      <h3 id={`${uid}-edit`} className="text-sm font-medium">
        Decision “{decision.title}”
      </h3>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-ink-muted">Title</span>
          <input className={field} value={draft.title} maxLength={120} aria-invalid={!valid} aria-describedby={valid ? undefined : `${uid}-title-missing`} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Status</span>
          <select
            className={field}
            value={draft.status}
            onChange={(e) => {
              const next = e.target.value as DecisionStatus;
              // M85: Superseded asks what replaced it (focus goes to the question); any other status drops the answer.
              const { supersededBy: _by, ...rest } = draft;
              void _by;
              setDraft(next === "superseded" ? { ...draft, status: next } : { ...rest, status: next });
              if (next === "superseded" && choices.length) setTimeout(() => document.getElementById(`${uid}-by`)?.focus(), 0);
            }}
          >
            {DECISION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DECISION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Date</span>
          <input
            type="date"
            className={field}
            value={draft.date ?? ""}
            onChange={(e) => {
              const { date: _old, ...rest } = draft;
              void _old;
              setDraft(e.target.value ? { ...rest, date: e.target.value } : rest);
            }}
          />
        </label>
      </div>
      {draft.status === "superseded" &&
        (choices.length ? (
          <label className="flex flex-col gap-1 text-sm sm:max-w-sm">
            <span className="text-ink-muted">Superseded by</span>
            <select
              id={`${uid}-by`}
              className={field}
              value={draft.supersededBy ?? ""}
              aria-describedby={`${uid}-by-help`}
              onChange={(e) => {
                const { supersededBy: _by, ...rest } = draft;
                void _by;
                setDraft(e.target.value ? { ...rest, supersededBy: e.target.value } : rest);
              }}
            >
              <option value="">Not chosen</option>
              {choices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            <span id={`${uid}-by-help`} className="text-xs text-ink-muted">
              The decision that replaces this one. It then says it supersedes this one.
            </span>
          </label>
        ) : (
          <p className="text-xs text-ink-muted">Make the decision that replaces this one, then choose it here.</p>
        ))}
      {/* The replacement as chosen here (saved as the editor goes), and what this one replaced. */}
      <DecisionLinks model={model} decision={{ ...decision, supersededBy: draft.status === "superseded" ? draft.supersededBy : undefined }} onOpen={onOpen} />
      {!valid && (
        <p id={`${uid}-title-missing`} className="text-xs text-invalid">
          A decision needs a title. Until it has one, the saved title “{decision.title}” is kept.
        </p>
      )}
      {TEXTS.map(([k, label, help]) => (
        <div key={k} className="flex flex-col gap-1 text-sm">
          <label htmlFor={`${uid}-${k}`} className="text-ink-muted">
            {label}
          </label>
          <textarea id={`${uid}-${k}`} className={`${field} min-h-16 py-1`} rows={3} maxLength={4000} value={draft[k] ?? ""} aria-describedby={`${uid}-${k}-help`} onChange={(e) => set({ [k]: e.target.value })} />
          <span id={`${uid}-${k}-help`} className="text-xs text-ink-muted">
            {help}
          </span>
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-ink-muted" id={`${uid}-about`}>
          Elements it concerns
        </p>
        {elements.length ? (
          <ul aria-labelledby={`${uid}-about`} className="flex flex-wrap gap-1.5">
            {elements.map((id, i) => {
              const n = model.nodes.find((x) => x.id === id);
              const name = nameOf(model, id);
              return (
                <li key={id} className="inline-flex items-center gap-1 border border-border px-1.5 py-0.5 text-sm">
                  <span>
                    {name}
                    {n && <span className="text-ink-muted"> ({classById(n.class)?.label ?? n.class})</span>}
                  </span>
                  <button type="button" id={`${uid}-rm-${i}`} className="cursor-pointer px-1 text-ink-muted hover:text-accent" aria-label={`Remove ${name}`} onClick={() => removeAt(i)}>
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-ink-muted">None yet.</p>
        )}
        {elements.length < MAX_DECISION_ELEMENTS && others.length > 0 && (
          <label className="flex flex-col gap-1 text-sm sm:max-w-sm">
            <span className="text-ink-muted">Add an element</span>
            <select id={`${uid}-add`} className={field} value="" onChange={(e) => e.target.value && set({ elements: [...elements, e.target.value] })}>
              <option value="">Choose an element…</option>
              {others.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name || "Untitled"} ({classById(n.class)?.label ?? n.class})
                </option>
              ))}
            </select>
          </label>
        )}
        {elements.length > 0 && onSelectElements && (
          // Changes not saved yet are saved as the dialog closes (see above), so the selection matches them.
          <button type="button" className={`${btn} self-start`} onClick={() => onSelectElements(elements, (draft.title.trim() || decision.title))}>
            Select its elements
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} disabled={!dirty || !valid} onClick={() => save(kept(draft), `Saved decision “${draft.title.trim()}”.`)}>
          Save decision
        </button>
        {confirming ? (
          <>
            <span className="text-sm">Delete “{decision.title}”?</span>
            <button
              ref={deleteButton}
              type="button"
              className={btn}
              onClick={() => {
                deleted.current = true;
                onDelete();
              }}
            >
              Delete
            </button>
            <button type="button" className={btn} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button ref={askButton} type="button" className={btn} onClick={() => setConfirming(true)}>
            Delete decision…
          </button>
        )}
      </div>
    </section>
  );
}
