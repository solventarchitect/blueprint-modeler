"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MAX_SNAPSHOTS, type SnapshotSummary } from "@/storage";
import { UNTITLED_MODEL } from "@/model";

const btn = "inline-flex min-h-8 cursor-pointer items-center border border-border-strong bg-surface-raised px-2.5 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** When a snapshot was taken, to the minute, in the viewer's own time zone. */
export const takenAt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

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
  onClose,
}: {
  modelName: string;
  list: () => Promise<SnapshotSummary[]>;
  onTake: (name: string) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  onCompare: (s: SnapshotSummary) => void;
  onRestore: (s: SnapshotSummary) => void;
  onDelete: (s: SnapshotSummary) => Promise<void>;
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
  const take = async () => {
    if (busy) return;
    setBusy(true);
    const label = name.trim() || `Snapshot, ${takenAt(new Date().toISOString())}`;
    const r = await onTake(label);
    setBusy(false);
    if (!r.ok) return setError((e) => ({ text: r.error, n: (e?.n ?? 0) + 1 }));
    setError(null);
    setName("");
    setStatus(`Took snapshot “${label}”.`);
    await reload();
    nameInput.current?.focus();
  };
  const remove = async (s: SnapshotSummary, at: number) => {
    await onDelete(s);
    setConfirming(null);
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
                          <button type="button" data-snapshot-first className={btn} aria-label={`Compare with snapshot ${s.name}`} onClick={() => onCompare(s)}>
                            Compare
                          </button>
                          <button type="button" className={btn} aria-label={`Restore snapshot ${s.name}`} onClick={() => onRestore(s)}>
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
      </div>
      <div className="flex justify-end border-t border-border px-4 py-3">
        <button type="button" className={btn} onClick={() => dialog.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}
