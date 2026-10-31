"use client";

import { useEffect, useId, useRef, useState } from "react";
import { classById } from "@/metamodel";
import { flowStepText, MAX_FLOW_STEPS, MAX_FLOWS, nextSteps, UNTITLED_MODEL, type Flow, type Model } from "@/model";
import type { Action } from "./state";

const btn = "inline-flex min-h-8 cursor-pointer items-center border border-border-strong bg-surface-raised px-2.5 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";
const field = "min-h-8 border border-border-strong bg-surface-raised px-2 text-sm text-ink";
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/**
 * Saved flows (M70): named walks through the model, one relationship a step ("customer places an
 * order"), built here from where the walk is (each next step is one of the relationships of the
 * element it has reached) and played in the strip above the canvas, each element numbered by its
 * step. Kept in the model (and its file); each change is one undo step. A modal dialog.
 */
export function FlowsDialog({
  model,
  editable,
  dispatch,
  newId,
  onPlay,
  onClose,
}: {
  model: Model;
  /** False below 768px, where the editor is view-only: flows can be played, not changed. */
  editable: boolean;
  dispatch: (a: Action) => void;
  newId: () => string;
  onPlay: (flowId: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const flows = model.flows ?? [];
  const [pickedId, setPickedId] = useState<string | null>(flows[0]?.id ?? null);
  const picked = flows.find((f) => f.id === pickedId) ?? flows[0] ?? null;
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  const nameOf = (id: string) => model.nodes.find((n) => n.id === id)?.name || "Untitled";
  const save = (f: Flow, said: string) => {
    dispatch({ type: "save-flow", flow: f });
    setStatus(said);
  };
  const create = () => {
    const name = newName.trim();
    if (!name || flows.length >= MAX_FLOWS) return;
    const id = newId();
    save({ id, name, steps: [] }, `Made flow “${name}”. Choose where it starts.`);
    setPickedId(id);
    setNewName("");
    setTimeout(() => document.getElementById(`${uid}-start`)?.focus(), 0);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${uid}-title`}
      data-testid="flows-dialog"
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] border border-border-strong bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <div className="border-b border-border px-4 py-3">
        <h2 id={`${uid}-title`} className="text-base font-medium">
          Saved flows of “{model.name || UNTITLED_MODEL}”
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          A flow walks the model one relationship at a time, such as a customer placing an order. Play it to step through it on the canvas, or save it as a GIF. Flows are kept in the model and its file.
        </p>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        <p role="status" className="text-sm text-ink-muted">
          {status}
        </p>
        {flows.length > 0 && (
          <section aria-labelledby={`${uid}-list`}>
            <h3 id={`${uid}-list`} className="text-sm font-medium">
              Flows ({flows.length} of {MAX_FLOWS})
            </h3>
            <ul className="mt-1.5 flex flex-col gap-1">
              {flows.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2" data-testid="flow">
                  <button type="button" aria-pressed={picked?.id === f.id} className={`${btn} aria-pressed:border-accent aria-pressed:text-accent`} onClick={() => setPickedId(f.id)}>
                    {f.name}
                  </button>
                  <span className="text-xs text-ink-muted">{plural(f.steps.length, "step")}</span>
                  <button
                    type="button"
                    className={btn}
                    disabled={!f.steps.length}
                    aria-label={`Play flow ${f.name}`}
                    onClick={() => {
                      dialog.current?.close();
                      onPlay(f.id);
                    }}
                  >
                    Play
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {picked && editable && (
          <FlowEditor
            key={picked.id}
            model={model}
            flow={picked}
            uid={uid}
            nameOf={nameOf}
            save={save}
            onDelete={() => {
              dispatch({ type: "delete-flow", id: picked.id });
              setStatus(`Deleted flow “${picked.name}”. Undo brings it back.`);
              setPickedId(null);
              setTimeout(() => document.getElementById(`${uid}-new`)?.focus(), 0);
            }}
          />
        )}
        {picked && !editable && (
          <ol aria-label={`Steps of ${picked.name}`} className="flex list-decimal flex-col gap-0.5 pl-6 text-sm">
            {picked.steps.map((s, i) => (
              <li key={`${i}:${s.edge}`}>{flowStepText(model, s)}</li>
            ))}
          </ol>
        )}
        {editable &&
          (flows.length >= MAX_FLOWS ? (
            <p className="text-sm text-ink-muted">A model keeps up to {MAX_FLOWS} flows: delete one to make another.</p>
          ) : (
            <section aria-labelledby={`${uid}-make`} className="flex flex-col gap-1.5">
              <h3 id={`${uid}-make`} className="text-sm font-medium">
                New flow
              </h3>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <span className="text-ink-muted">New flow name</span>
                  <input
                    id={`${uid}-new`}
                    className={field}
                    value={newName}
                    maxLength={80}
                    placeholder="Customer places an order"
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        create();
                      }
                    }}
                  />
                </label>
                <button type="button" className={btn} disabled={!newName.trim()} onClick={create}>
                  Make flow
                </button>
              </div>
            </section>
          ))}
      </div>
      <div className="flex justify-end border-t border-border px-4 py-3">
        <button type="button" className={btn} onClick={() => dialog.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}

/** One flow's name and steps: each next step leaves the element the flow has reached; the last can be taken back. */
function FlowEditor({
  model,
  flow,
  uid,
  nameOf,
  save,
  onDelete,
}: {
  model: Model;
  flow: Flow;
  uid: string;
  nameOf: (id: string) => string;
  save: (f: Flow, said: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(flow.name);
  // Where a flow with steps began, so taking them all back keeps its start.
  const first = flow.steps[0] && model.edges.find((e) => e.id === flow.steps[0]!.edge);
  const [start, setStart] = useState(first ? (flow.steps[0]!.back ? first.to : first.from) : "");
  // Asked here, so it belongs to this flow only; Delete takes focus once, when the question appears.
  const [confirming, setConfirming] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) deleteButton.current?.focus();
  }, [confirming]);
  const [next, setNext] = useState("");
  const last = flow.steps.at(-1);
  const lastEdge = last && model.edges.find((e) => e.id === last.edge);
  // Where the flow is: the element its last step reached, else the start chosen for its first step.
  const at = lastEdge ? (last!.back ? lastEdge.from : lastEdge.to) : start;
  const options = at ? nextSteps(model, at) : [];
  const full = flow.steps.length >= MAX_FLOW_STEPS;
  const kind = (id: string) => classById(model.nodes.find((n) => n.id === id)?.class ?? "")?.label ?? "";
  const commitName = () => {
    const t = name.trim();
    if (!t) return setName(flow.name);
    if (t !== flow.name) save({ ...flow, name: t }, `Renamed the flow “${t}”.`);
  };
  const add = () => {
    const o = options.find((x) => `${x.edge}|${x.back ? 1 : 0}` === next);
    if (!o) return;
    save({ ...flow, steps: [...flow.steps, o.back ? { edge: o.edge, back: true } : { edge: o.edge }] }, `Step ${flow.steps.length + 1}: ${flowStepText(model, o)}.`);
    setNext("");
    setTimeout(() => document.getElementById(`${uid}-next`)?.focus(), 0);
  };
  const takeBack = () => {
    save({ ...flow, steps: flow.steps.slice(0, -1) }, `Took back step ${flow.steps.length}.`);
    setTimeout(() => document.getElementById(flow.steps.length > 1 ? `${uid}-next` : `${uid}-start`)?.focus(), 0);
  };
  return (
    <section aria-labelledby={`${uid}-edit`} className="flex flex-col gap-2 border border-border p-3">
      <h3 id={`${uid}-edit`} className="text-sm font-medium">
        Flow “{flow.name}”
      </h3>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-muted">Flow name</span>
        <input
          className={field}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitName();
            }
          }}
        />
      </label>
      {flow.steps.length ? (
        <ol aria-label={`Steps of ${flow.name}`} className="flex list-decimal flex-col gap-0.5 pl-6 text-sm" data-testid="flow-steps">
          {flow.steps.map((s, i) => (
            <li key={`${i}:${s.edge}`}>{flowStepText(model, s)}</li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink-muted">No steps yet.</p>
      )}
      {!lastEdge && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Starts at</span>
          <select id={`${uid}-start`} className={field} value={start} onChange={(e) => setStart(e.target.value)}>
            <option value="">Choose an element…</option>
            {[...model.nodes]
              .sort((a, b) => (a.name || "Untitled").localeCompare(b.name || "Untitled"))
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name || "Untitled"} ({kind(n.id)})
                </option>
              ))}
          </select>
        </label>
      )}
      {full ? (
        <p className="text-sm text-ink-muted">A flow has up to {MAX_FLOW_STEPS} steps.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="text-ink-muted">{at ? `Next step from ${nameOf(at)}` : "Next step"}</span>
            <select id={`${uid}-next`} className={field} value={next} disabled={!options.length} onChange={(e) => setNext(e.target.value)}>
              <option value="">{!at ? "Choose where it starts first" : options.length ? "Choose a relationship…" : "No relationships from here"}</option>
              {options.map((o) => (
                <option key={`${o.edge}|${o.back ? 1 : 0}`} value={`${o.edge}|${o.back ? 1 : 0}`}>
                  {flowStepText(model, o)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={btn} disabled={!next} onClick={add}>
            Add step
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={!flow.steps.length} onClick={takeBack}>
          Take back the last step
        </button>
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span>Delete this flow? Undo brings it back.</span>
            <button type="button" className={btn} ref={deleteButton} onClick={onDelete}>
              Delete
            </button>
            <button type="button" className={btn} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </span>
        ) : (
          <button type="button" className={btn} onClick={() => setConfirming(true)}>
            Delete flow
          </button>
        )}
      </div>
    </section>
  );
}
