"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MAX_SNAPSHOTS, type SnapshotSummary } from "@/storage";
import { UNTITLED_MODEL, type Comparison } from "@/model";
import { ChangeList, compareSummary } from "./Compare";

const btn = "inline-flex min-h-8 cursor-pointer items-center border border-border-strong bg-surface-raised px-2.5 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** When a snapshot was taken, to the minute, in the viewer's own time zone. */
export const takenAt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/**
 * M83: the two snapshots Compare two starts with: the second newest readable one to the newest (the
 * list is newest first); null with fewer than two that can be read.
 */
export function snapshotPair(items: SnapshotSummary[]): { from: string; to: string } | null {
  const ok = items.filter((s) => !s.damaged);
  return ok.length >= 2 ? { from: ok[1]!.id, to: ok[0]!.id } : null;
}

/**
 * Snapshots (M66): the open model as it was at moments the modeler chose to keep, in this browser
 * only (never in the model file or a share link). Each can be compared with the model as it is now
 * (Compare, M58) or restored into it, one undo step. A modal dialog; Escape or Close closes it.
 */
export function SnapshotsDialog({
  modelName,
  list,
  onTake,
  onCompare,
  onRestore,
  onDelete,
  onCompareTwo,
  onClose,
}: {
  modelName: string;
  list: () => Promise<SnapshotSummary[]>;
  onTake: (name: string) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  /** False when the snapshot could not be read (the dialog stays open and says so). */
  onCompare: (s: SnapshotSummary) => Promise<boolean>;
  onRestore: (s: SnapshotSummary) => Promise<boolean>;
  onDelete: (s: SnapshotSummary) => Promise<void>;
  /** M83: what changed from one snapshot to another (null when either could not be read). Nothing changes in the open model. */
  onCompareTwo?: (from: SnapshotSummary, to: SnapshotSummary) => Promise<Comparison | null>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const uid = useId();
  const [items, setItems] = useState<SnapshotSummary[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; n: number } | null>(null);
  const [status, setStatus] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  const reload = useCallback(async () => setItems(await list()), [list]);
  // M83: Compare two. The picks start at the second newest and the newest; a pick deleted since falls back to them.
  const [pick, setPick] = useState<{ from?: string; to?: string }>({});
  const [result, setResult] = useState<{ from: SnapshotSummary; to: SnapshotSummary; comparison: Comparison } | null>(null);
  const readable = (items ?? []).filter((s) => !s.damaged);
  const pair = snapshotPair(items ?? []);
  const fromId = readable.some((s) => s.id === pick.from) ? pick.from! : pair?.from;
  const toId = readable.some((s) => s.id === pick.to) ? pick.to! : pair?.to;
  // A newer request (another click, other picks, a snapshot taken or deleted) makes an older one's answer stale.
  const run = useRef(0);
  const [comparing, setComparing] = useState(false);
  const compareTwo = async () => {
    const from = readable.find((s) => s.id === fromId);
    const to = readable.find((s) => s.id === toId);
    if (!onCompareTwo || !from || !to || from.id === to.id) return;
    const mine = ++run.current;
    setComparing(true);
    const comparison = await onCompareTwo(from, to);
    if (mine !== run.current) return;
    setComparing(false);
    if (!comparison) return fail(unreadable);
    setError(null);
    setResult({ from, to, comparison });
    setStatus(`From “${from.name}” to “${to.name}”: ${compareSummary(comparison)}.`);
  };
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    // The list arrives from storage (the state is set when it does, never during the effect).
    let live = true;
    void list().then((got) => live && setItems(got));
    return () => {
      live = false;
    };
    // Loaded once, when the dialog opens; changes made here reload it themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const full = (items?.length ?? 0) >= MAX_SNAPSHOTS;
  const fail = (text: string) => setError((e) => ({ text, n: (e?.n ?? 0) + 1 }));
  const unreadable = "That snapshot could not be read.";
  const firstRow = () => listRef.current?.querySelector<HTMLElement>("[data-snapshot-first]");
  const take = async () => {
    if (busy) return;
    setBusy(true);
    const label = name.trim() || `Snapshot, ${takenAt(new Date().toISOString())}`;
    const r = await onTake(label);
    setBusy(false);
    if (!r.ok) return fail(r.error);
    setError(null);
    setName("");
    setStatus(`Took snapshot “${label}”.`);
    // The default picks may move to the new snapshot: a result shown for the old ones goes.
    run.current++;
    setComparing(false);
    setResult(null);
    await reload();
    // The name field, for the next one; when that was the last one allowed, the newest snapshot.
    setTimeout(() => (nameInput.current ?? firstRow())?.focus(), 0);
  };
  const remove = async (s: SnapshotSummary, at: number) => {
    try {
      await onDelete(s);
    } catch {
      return fail(`The snapshot “${s.name}” could not be deleted.`);
    }
    setConfirming(null);
    run.current++;
    setComparing(false);
    setResult(null);
    setStatus(`Deleted snapshot “${s.name}”.`);
    await reload();
    // Focus stays in the list: the snapshot that took its place, the one before it, else the name field.
    setTimeout(() => {
      const rows = listRef.current?.querySelectorAll<HTMLElement>("[data-snapshot-first]") ?? [];
      (rows[at] ?? rows[at - 1] ?? nameInput.current)?.focus();
    }, 0);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${uid}-title`}
      aria-describedby={`${uid}-help`}
      data-testid="snapshots-dialog"
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(38rem,calc(100vw-2rem))] border border-border-strong bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <div className="border-b border-border px-4 py-3">
        <h2 id={`${uid}-title`} className="text-base font-medium">
          Snapshots of “{modelName || UNTITLED_MODEL}”
        </h2>
        <p id={`${uid}-help`} className="mt-1 text-sm text-ink-muted">
          Keep the model as it is now, to compare with later or go back to. Snapshots stay in this browser with the model: they are not in the model file or a share link.
        </p>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        <section aria-labelledby={`${uid}-take`} className="flex flex-col gap-1.5">
          <h3 id={`${uid}-take`} className="text-sm font-medium">
            Take a snapshot
          </h3>
          {full ? (
            <p className="text-sm text-ink-muted">A model keeps up to {MAX_SNAPSHOTS} snapshots: delete one to take another.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                <span className="text-ink-muted">Name (optional)</span>
                <input
                  ref={nameInput}
                  className="min-h-8 border border-border-strong bg-surface-raised px-2 text-sm text-ink"
                  value={name}
                  maxLength={80}
                  placeholder="Before the review"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${uid}-error` : undefined}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void take();
                    }
                  }}
                />
              </label>
              <button type="button" className={btn} disabled={busy} onClick={() => void take()}>
                Take snapshot
              </button>
            </div>
          )}
          {error && (
            <p key={error.n} id={`${uid}-error`} role="alert" className="text-sm text-invalid">
              {error.text}
            </p>
          )}
          <p role="status" className="text-sm text-ink-muted">
            {status}
          </p>
        </section>
        <section aria-labelledby={`${uid}-kept`}>
          <h3 id={`${uid}-kept`} className="text-sm font-medium">
            Kept {items ? `(${items.length} of ${MAX_SNAPSHOTS})` : ""}
          </h3>
          {items === null ? (
            <p className="mt-1.5 text-sm text-ink-muted">Loading…</p>
          ) : items.length ? (
            <ul ref={listRef} className="mt-1.5 flex max-h-80 flex-col gap-1.5 overflow-y-auto" data-testid="snapshot-list">
              {items.map((s, i) => (
                <li key={s.id} className="flex flex-col gap-1 border border-border px-2.5 py-2" data-testid="snapshot">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="min-w-0 truncate text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-ink-muted">
                      {takenAt(s.taken)}
                      {s.damaged ? " · Can't be read" : ` · ${count(s.nodes, "element")} · ${count(s.edges, "relationship")}`}
                    </span>
                  </span>
                  {confirming === s.id ? (
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      <span>Delete this snapshot? This can&apos;t be undone.</span>
                      {/* Focus moves to the question's answer as it appears. */}
                      <button type="button" data-snapshot-first className={btn} ref={(el) => el?.focus()} onClick={() => void remove(s, i)}>
                        Delete
                      </button>
                      <button
                        type="button"
                        className={btn}
                        onClick={() => {
                          setConfirming(null);
                          setTimeout(() => listRef.current?.querySelectorAll<HTMLElement>("[data-snapshot-first]")[i]?.focus(), 0);
                        }}
                      >
                        Keep it
                      </button>
                    </span>
                  ) : (
                    <span className="flex flex-wrap gap-1.5">
                      {!s.damaged && (
                        <>
                          <button type="button" data-snapshot-first className={btn} aria-label={`Compare with snapshot ${s.name}`} onClick={() => void onCompare(s).then((ok) => ok || fail(unreadable))}>
                            Compare
                          </button>
                          <button type="button" className={btn} aria-label={`Restore snapshot ${s.name}`} onClick={() => void onRestore(s).then((ok) => ok || fail(unreadable))}>
                            Restore
                          </button>
                        </>
                      )}
                      <button type="button" data-snapshot-first={s.damaged ? "" : undefined} className={btn} aria-label={`Delete snapshot ${s.name}`} onClick={() => setConfirming(s.id)}>
                        Delete
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-ink-muted">No snapshots of this model yet.</p>
          )}
        </section>
        {onCompareTwo && pair && (
          <section aria-labelledby={`${uid}-two`} className="flex flex-col gap-1.5" data-testid="compare-two">
            <h3 id={`${uid}-two`} className="text-sm font-medium">
              Compare two snapshots
            </h3>
            <p className="text-xs text-ink-muted">What changed from one to the other. The open model stays as it is.</p>
            <div className="flex flex-wrap items-end gap-2">
              {(["from", "to"] as const).map((k) => (
                <label key={k} className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <span className="text-ink-muted">{k === "from" ? "From" : "To"}</span>
                  <select
                    className="min-h-8 border border-border-strong bg-surface-raised px-2 text-sm text-ink"
                    value={k === "from" ? fromId : toId}
                    onChange={(e) => {
                      setPick((p) => ({ ...p, [k]: e.target.value }));
                      run.current++;
                      setComparing(false);
                      setResult(null);
                    }}
                  >
                    {readable.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({takenAt(s.taken)})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <button type="button" className={btn} disabled={fromId === toId || comparing} aria-describedby={fromId === toId ? `${uid}-same` : undefined} onClick={() => void compareTwo()}>
                {comparing ? "Comparing…" : "Compare these"}
              </button>
            </div>
            {fromId === toId && (
              <p id={`${uid}-same`} className="text-xs text-ink-muted">
                Choose two different snapshots.
              </p>
            )}
            {result && (
              <div className="flex flex-col gap-1 border border-border px-2.5 py-2" data-testid="compare-two-result">
                <h4 className="text-sm font-medium">
                  Changes from “{result.from.name}” to “{result.to.name}”
                </h4>
                <p className="text-sm text-ink-muted">{compareSummary(result.comparison)}</p>
                <ChangeList listId={`${uid}-two-list`} comparison={result.comparison} heading="h5" className="max-h-72 overflow-y-auto" />
              </div>
            )}
          </section>
        )}
      </div>
      <div className="flex justify-end border-t border-border px-4 py-3">
        <button type="button" className={btn} onClick={() => dialog.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}
