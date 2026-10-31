"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { classById, LIFE_CYCLE } from "@/metamodel";
import { LAYERS } from "@/layout/bands";
import { attrValue, COLOR_BY, COLOR_BY_LABEL, filterActive, GROUP_BY, GROUP_BY_LABEL, type GroupBy, inView, legend, MAX_VIEWS, modelTags, PLAN_LABEL, PLAN_STATUSES, planOf, type PlanStatus, slotMarker, type ColorBy, type LegendEntry, type Model, type ViewFilter } from "@/model";
import { ToolbarIcon } from "./ToolbarIcon";
import { useDismiss } from "./useDismiss";

/** The view in use: a saved view's id (or null for an unsaved one), its filter, its coloring and its grouping (M56). */
export type ShownView = { id: string | null; filter: ViewFilter; colorBy: ColorBy; groupBy?: GroupBy };

/** A saved view in use whose filter or coloring was changed since: said so, so the screen never claims the saved one. */
function isEdited(model: Model, shown: ShownView) {
  const saved = model.views?.find((v) => v.id === shown.id);
  return !!saved && JSON.stringify([saved.filter, saved.colorBy, saved.groupBy ?? null]) !== JSON.stringify([shown.filter, shown.colorBy, shown.groupBy ?? null]);
}


/** A value's marker, in its slot color. */
export function SlotMarker({ entry, size = 10 }: { entry: Pick<LegendEntry, "slot">; size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 10 10" width={size} height={size} className="shrink-0" style={{ fill: `var(--slot-${entry.slot})` }}>
      <path d={slotMarker(entry.slot)} fillRule="evenodd" />
    </svg>
  );
}

/**
 * The Views menu (M54), in the Arrange group: All elements, every saved view (the one in use marked),
 * and Filter and color…, which opens the dialog. Escape or a press outside closes it.
 */
export function ViewsMenu({ model, shown, onShow, onEdit, buttonClass }: { model: Model; shown: ShownView; onShow: (v: ShownView) => void; onEdit: () => void; buttonClass: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, button);
  const all = shown.id === null && !filterActive(shown.filter) && shown.colorBy === "layer" && !shown.groupBy;
  const saved = model.views?.find((v) => v.id === shown.id);
  const edited = isEdited(model, shown);
  const label = all ? "Views" : `Views: ${saved ? `${saved.name}${edited ? " (edited)" : ""}` : "Unsaved"}`;
  const pick = (run: () => void) => {
    setOpen(false);
    button.current?.focus();
    run();
  };
  const item = "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-surface focus-visible:bg-surface";
  const check = (on: boolean) => (
    <span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${on ? "border-accent bg-accent text-accent-ink" : "border-border-strong"}`}>
      {on ? "●" : ""}
    </span>
  );
  return (
    <div
      ref={root}
      className="relative"
      onBlur={(e) => {
        if (open && e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      {/*
        A fixed width, so choosing a view never reflows the toolbar: a dot marks a view in use, and its name
        is in the button's name and tooltip (and the canvas legend). Icon only from 1180 to 1319px, where
        the word would push the Arrange group onto a second row.
      */}
      <button
        ref={button}
        id="views-button"
        type="button"
        className={buttonClass}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <ToolbarIcon name="views" />
        <span aria-hidden="true" className="min-[1180px]:max-[1319px]:hidden">
          Views
        </span>
        {!all && <span aria-hidden="true" data-testid="views-active" className="size-1.5 rounded-full bg-accent" />}
        <span aria-hidden="true">▾</span>
      </button>
      <div id={panelId} hidden={!open} data-testid="views-menu" role="group" aria-label="Views" className="absolute left-0 z-20 mt-1 w-72 border border-border-strong bg-surface-raised py-1">
        <ul>
          <li>
            <button type="button" aria-pressed={all} className={item} onClick={() => pick(() => onShow({ id: null, filter: {}, colorBy: "layer" }))}>
              {check(all)}
              <span className="flex flex-col">
                <span>All elements</span>
                <span className="text-xs text-ink-muted">Every element, in layer colors</span>
              </span>
            </button>
          </li>
          {(model.views ?? []).map((v) => (
            <li key={v.id}>
              <button type="button" aria-pressed={shown.id === v.id} className={item} onClick={() => pick(() => onShow({ id: v.id, filter: v.filter, colorBy: v.colorBy, groupBy: v.groupBy }))}>
                {check(shown.id === v.id)}
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{v.name}</span>
                  <span className="text-xs text-ink-muted">
                    {model.nodes.filter((n) => inView(n, v.filter)).length} of {model.nodes.length} elements · {COLOR_BY_LABEL[v.colorBy]} colors
                    {v.groupBy ? ` · by ${GROUP_BY_LABEL[v.groupBy]}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li aria-hidden="true" className="my-1 border-t border-border" />
          <li>
            <button type="button" className={item} onClick={() => pick(onEdit)}>
              Filter and color…
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

/** Every value of a dimension present in the model, in a stable order, with Not set ("") last when some element has none. */
function present(model: Model, get: (n: Model["nodes"][number]) => string, order?: (a: string, b: string) => number) {
  const set = [...new Set(model.nodes.map(get).filter(Boolean))].sort(order ?? ((a, b) => a.localeCompare(b)));
  return model.nodes.some((n) => !get(n)) ? [...set, ""] : set;
}

/** Every life cycle stage once, in the white paper's order (as the legend lists them). */
const STAGES = [...new Set(Object.values(LIFE_CYCLE).flatMap((p) => p.stages))];

/**
 * Filter and color (M54): a modal dialog over the canvas. Every change applies at once (the count says
 * how many elements the view keeps); the bottom row saves it as a new view, or updates, renames or
 * deletes the saved view in use. Mounted while open; Escape or Close shuts it.
 */
export function ViewDialog({
  model,
  shown,
  onChange,
  onSave,
  onUpdate,
  onDelete,
  onClose,
}: {
  model: Model;
  shown: ShownView;
  onChange: (v: ShownView) => void;
  onSave: (name: string) => void;
  onUpdate: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const saved = model.views?.find((v) => v.id === shown.id);
  const [name, setName] = useState(saved?.name ?? "");
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  const kept = model.nodes.filter((n) => inView(n, shown.filter)).length;
  // Tags match ignoring case (M69), so they are ticked and unticked ignoring case too.
  const same = (key: keyof ViewFilter, a: string, b: string) => (key === "tags" ? a.toLowerCase() === b.toLowerCase() : a === b);
  const ticked = (key: keyof ViewFilter, value: string) => (shown.filter[key] ?? []).some((x) => same(key, x, value));
  const toggle = (key: keyof ViewFilter, value: string) => {
    const cur = shown.filter[key] ?? [];
    const next = ticked(key, value) ? cur.filter((x) => !same(key, x, value)) : [...cur, value];
    onChange({ ...shown, filter: { ...shown.filter, [key]: next.length ? next : undefined } });
  };
  // M69: the model's tags, then Not tagged; and any ticked tag no element carries any more, so it can be unticked.
  const inModel = modelTags(model);
  const stale = (shown.filter.tags ?? []).filter((t) => t && !inModel.some((m) => m.toLowerCase() === t.toLowerCase()));
  const tagValues = inModel.length || stale.length ? [...inModel, ...stale, ...(model.nodes.some((n) => !n.tags?.length) || shown.filter.tags?.includes("") ? [""] : [])] : [];
  const groups: { key: keyof ViewFilter; label: string; values: string[]; text: (v: string) => string }[] = [
    { key: "layers", label: "Layer", values: LAYERS.map((l) => l.id).filter((l) => model.nodes.some((n) => classById(n.class)?.layer === l)), text: (v) => LAYERS.find((l) => l.id === v)?.name ?? v },
    { key: "classes", label: "Class", values: [...new Set(model.nodes.map((n) => n.class))].sort((a, b) => (classById(a)?.label ?? a).localeCompare(classById(b)?.label ?? b)), text: (v) => classById(v)?.label ?? v },
    { key: "lifecycle", label: "Life cycle stage", values: present(model, (n) => attrValue(n, "lifecycle"), (a, b) => (STAGES.indexOf(a) + 1 || 99) - (STAGES.indexOf(b) + 1 || 99) || a.localeCompare(b)), text: (v) => v || "Not set" },
    { key: "environment", label: "Environment", values: present(model, (n) => attrValue(n, "environment")), text: (v) => v || "Not set" },
    { key: "owner", label: "Owner", values: present(model, (n) => attrValue(n, "owner")), text: (v) => v || "Not set" },
    // M68: only when something is Planned or Retiring (everything Live leaves nothing to choose between).
    // M69: every tag in the model (one spelling each, ignoring case), then Not tagged; only once something is tagged.
    { key: "tags", label: "Tag", values: tagValues, text: (v) => v || "Not tagged" },
    { key: "plan", label: "Plan status", values: model.nodes.some((n) => n.plan) ? PLAN_STATUSES.filter((p) => model.nodes.some((n) => planOf(n) === p)) : [], text: (v) => PLAN_LABEL[v as PlanStatus] ?? v },
  ];
  const btn = "inline-flex min-h-8 cursor-pointer items-center border border-border-strong bg-surface-raised px-2.5 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";
  const trimmed = name.trim();
  const full = (model.views?.length ?? 0) >= MAX_VIEWS;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="view-dialog-title"
      data-testid="view-dialog"
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] border border-border-strong bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="view-dialog-title" className="text-base font-medium">
          Filter and color
        </h2>
        <p className="text-sm text-ink-muted" aria-live="polite" data-testid="view-count">
          Showing {kept} of {model.nodes.length} elements
        </p>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        <fieldset>
          <legend className="text-sm font-medium">Color by</legend>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {COLOR_BY.map((c) => (
              <label key={c} className="flex min-h-6 items-center gap-1.5 text-sm">
                <input type="radio" name="view-color-by" checked={shown.colorBy === c} onChange={() => onChange({ ...shown, colorBy: c })} />
                {COLOR_BY_LABEL[c]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">Group by</legend>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
            {([undefined, ...GROUP_BY] as (GroupBy | undefined)[]).map((g) => (
              <label key={g ?? "none"} className="flex min-h-6 items-center gap-1.5 text-sm">
                <input type="radio" name="view-group-by" checked={shown.groupBy === g} onChange={() => onChange({ ...shown, groupBy: g })} />
                {g ? GROUP_BY_LABEL[g] : "None"}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-muted">A frame around each group: a Business Application or Service Offering with everything it reaches, or the elements in one environment. Worked out from the model, nothing is stored on the elements.</p>
        </fieldset>
        <div>
          <p className="text-sm font-medium">Show only</p>
          <p className="text-xs text-ink-muted">Within a group any ticked value matches; every group with ticks must match. A group with no ticks keeps everything. The others stay in place, faded.</p>
          <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {groups
              .filter((g) => g.values.length)
              .map((g) => (
                <fieldset key={g.key}>
                  <legend className="font-mono text-[0.65rem] tracking-[0.14em] text-ink-muted uppercase">{g.label}</legend>
                  {/* Rows 24px tall, so every checkbox has a 24px target (WCAG 2.5.8). */}
                  <ul className="mt-1 flex max-h-40 flex-col overflow-y-auto">
                    {g.values.map((v) => (
                      <li key={v || "(not set)"}>
                        <label className="flex min-h-6 items-center gap-1.5 text-sm">
                          <input type="checkbox" checked={ticked(g.key, v)} onChange={() => toggle(g.key, v)} />
                          <span className={v ? "" : "text-ink-muted"}>{g.text(v)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ))}
          </div>
          <button type="button" className={`${btn} mt-3`} disabled={!filterActive(shown.filter)} onClick={() => onChange({ ...shown, filter: {} })}>
            Clear the filter
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t border-border px-4 py-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="text-ink-muted">View name</span>
          <input
            className="w-full border border-border-strong bg-surface-raised px-2.5 py-1.5 text-sm text-ink"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && trimmed) {
                e.preventDefault();
                if (saved) onUpdate(trimmed);
                else if (!full) onSave(trimmed);
              }
            }}
          />
        </label>
        {saved && (
          <button type="button" className={btn} disabled={!trimmed} onClick={() => onUpdate(trimmed)}>
            Update “{saved.name}”
          </button>
        )}
        <button type="button" className={btn} disabled={!trimmed || full} onClick={() => onSave(trimmed)}>
          Save as new view
        </button>
        {saved && (
          <button type="button" className={btn} onClick={onDelete}>
            Delete view
          </button>
        )}
        <button type="button" className={btn} onClick={() => dialog.current?.close()}>
          Close
        </button>
        {full && <p className="basis-full text-xs text-ink-muted">A model holds up to {MAX_VIEWS} views: delete one to save another.</p>}
      </div>
    </dialog>
  );
}

/**
 * The legend (M54), top right of the canvas while a view colors by a property or filters: each value
 * with its marker, color and count in the view, and how many elements the filter keeps.
 */
export function ViewLegend({ model, shown, onEdit, onShowAll, groups, onArrange }: { model: Model; shown: ShownView; onEdit?: () => void; onShowAll?: () => void; groups?: number; onArrange?: () => void }) {
  const active = filterActive(shown.filter);
  if (!active && shown.colorBy === "layer" && !shown.groupBy) return null;
  const entries = legend(model, shown.colorBy, shown.filter);
  const kept = model.nodes.filter((n) => inView(n, shown.filter)).length;
  const name = model.views?.find((v) => v.id === shown.id)?.name;
  return (
    <figure className="max-w-64 border border-border bg-surface-raised px-3 py-2" data-testid="view-legend">
      <figcaption className="font-mono text-[0.65rem] tracking-[0.12em] text-ink-muted uppercase">{name ? `View: ${name}${isEdited(model, shown) ? " (edited)" : ""}` : "View"}</figcaption>
      {shown.colorBy !== "layer" && (
        <>
          <p className="mt-1 text-xs text-ink-soft">Colored by {COLOR_BY_LABEL[shown.colorBy].toLowerCase()}</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {entries.map((e) => (
              <li key={e.key} className="flex items-center gap-2 text-xs text-ink-soft">
                <SlotMarker entry={e} />
                <span className={`min-w-0 flex-1 truncate ${e.slot === "none" ? "text-ink-muted" : ""}`}>{e.label}</span>
                <span className="font-mono text-ink-muted">{e.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {shown.groupBy && (
        <p className="mt-1 text-xs text-ink-soft">
          Grouped by {GROUP_BY_LABEL[shown.groupBy]}: {groups ? `${groups} group${groups === 1 ? "" : "s"}` : "no groups in this model"}
          {onArrange && !!groups && (
            <>
              {" "}
              <button type="button" className="cursor-pointer text-accent underline underline-offset-4" onClick={onArrange}>
                Arrange by group
              </button>
            </>
          )}
        </p>
      )}
      {active && <p className="mt-1 text-xs text-ink-soft">Showing {kept} of {model.nodes.length} elements; the rest are faded.</p>}
      {(onEdit || onShowAll) && (
        <p className="mt-1.5 flex gap-3 text-xs">
          {onEdit && (
            <button type="button" className="cursor-pointer text-accent underline underline-offset-4" onClick={onEdit}>
              Edit…
            </button>
          )}
          {onShowAll && (
            <button type="button" className="cursor-pointer text-accent underline underline-offset-4" onClick={onShowAll}>
              Show all
            </button>
          )}
        </p>
      )}
    </figure>
  );
}
