"use client";

import { useEffect, useRef, useState } from "react";
import { UNTITLED_MODEL } from "@/model";
import type { ModelSummary } from "@/storage";

const button =
  "inline-flex min-h-8 cursor-pointer items-center gap-1 border border-border-strong bg-surface-raised px-2.5 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";
const danger = "inline-flex min-h-8 cursor-pointer items-center border border-status bg-status px-2.5 text-sm font-medium text-accent-ink hover:opacity-90";

export const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

/**
 * The models saved in this browser: open, download or delete each one, or delete them all.
 * A modal dialog (focus stays inside; Escape closes). Deleting asks once, in place.
 */
export function ModelManager({
  open,
  onClose,
  models,
  currentId,
  onOpen,
  onDownload,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  models: ModelSummary[];
  currentId: string;
  onOpen: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (ids: string[]) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState<string | "all" | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      setConfirming(null);
      setStatus("");
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const del = async (ids: string[], label: string) => {
    await onDelete(ids);
    setConfirming(null);
    setStatus(label);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="models-title"
      onClose={onClose}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] border border-border-strong bg-surface p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <h2 id="models-title" className="text-base font-semibold">
          Models in this browser
        </h2>
        <button type="button" className={button} onClick={onClose}>
          Close
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
        <p className="text-sm text-ink-muted">
          {models.length} model{models.length === 1 ? "" : "s"} saved in this browser only. Download a model to keep a copy before you delete it; deleting cannot be undone.
        </p>
        <ul className="mt-3 flex flex-col divide-y divide-border border-y border-border" data-testid="model-list">
          {models.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{m.name || UNTITLED_MODEL}</span>
                <span className="block text-xs text-ink-muted">
                  {m.id === currentId ? "Open now · " : ""}Saved {when(m.updated)}
                </span>
              </span>
              {confirming === m.id ? (
                <span className="flex items-center gap-2" role="group" aria-label={`Confirm deleting ${m.name || UNTITLED_MODEL}`}>
                  <button type="button" className={danger} onClick={() => void del([m.id], `Deleted ${m.name || UNTITLED_MODEL}.`)} autoFocus>
                    Delete for good
                  </button>
                  <button type="button" className={button} onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <button type="button" className={button} disabled={m.id === currentId} onClick={() => (onOpen(m.id), onClose())} aria-label={`Open ${m.name || UNTITLED_MODEL}`}>
                    Open
                  </button>
                  <button type="button" className={button} onClick={() => onDownload(m.id)} aria-label={`Download ${m.name || UNTITLED_MODEL}`}>
                    Download
                  </button>
                  <button type="button" className={button} onClick={() => setConfirming(m.id)} aria-label={`Delete ${m.name || UNTITLED_MODEL}`}>
                    Delete
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
        <p role="status" aria-live="polite" className="text-sm text-ink-muted">
          {status}
        </p>
        {confirming === "all" ? (
          <span className="flex items-center gap-2" role="group" aria-label="Confirm deleting every model">
            <button type="button" className={danger} onClick={() => void del(models.map((m) => m.id), "Deleted every model. A new empty model is open.")} autoFocus>
              Delete all {models.length} for good
            </button>
            <button type="button" className={button} onClick={() => setConfirming(null)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className={button} disabled={models.length === 0} onClick={() => setConfirming("all")}>
            Delete all models…
          </button>
        )}
      </div>
    </dialog>
  );
}

