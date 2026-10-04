"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { createModel, UNTITLED_MODEL, type Model } from "@/model";
import { openBrowserStore, type ModelStore, type ModelSummary } from "@/storage";
import { initialHistory, reduce, type Action, type History } from "./state";

export type SaveStatus = "loading" | "saved" | "saving" | "memory-only" | "error";

const EMPTY: History = initialHistory(createModel(UNTITLED_MODEL, new Date(0), "placeholder"));

/**
 * The open model, its undo history, and autosave to this browser. Loads the most recently
 * updated model (or creates one); every change is written back after a short pause.
 */
export function useModelDocument() {
  const [history, dispatchRaw] = useReducer((s: History, a: Action) => reduce(s, a), EMPTY);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  /** True once the first load has finished: a model is open and the list of stored models is current. */
  const [ready, setReady] = useState(false);
  const store = useRef<ModelStore | null>(null);
  const loadedId = useRef<string | null>(null);
  const persistent = useRef(true);
  /** The open model's latest change while its autosave pause runs (null once written). */
  const pending = useRef<Model | null>(null);

  const refreshList = useCallback(async () => {
    if (store.current) setModels(await store.current.list());
  }, []);

  /**
   * Switching away cancels the outgoing model's autosave pause, so write a change still waiting in
   * it first (a deleted model has already been detached: loadedId is null). False when that write
   * failed: the caller stays on this model, so the unsaved change is still on screen.
   */
  const flushPending = useCallback(async (s: ModelStore) => {
    const waiting = pending.current;
    if (!waiting || waiting.id !== loadedId.current) return true;
    pending.current = null;
    try {
      await s.put(waiting);
      return true;
    } catch {
      // Its autosave runs again.
      pending.current = waiting;
      setStatus("error");
      setProblem("Your last change could not be saved, so the other model was not opened. Try again, or export this model first.");
      return false;
    }
  }, []);

  /** Opens a stored model (the most recent when no id is given). False when nothing was opened. */
  const open = useCallback(async (id?: string): Promise<boolean> => {
    const s = store.current;
    if (!s) return false;
    if (!(await flushPending(s))) return false;
    const list = await s.list();
    const targetId = id ?? list[0]?.id;
    let model: Model | undefined;
    if (targetId) {
      const got = await s.get(targetId);
      if (got?.ok) model = got.model;
      else if (got) setProblem(`A saved model could not be opened: ${got.error}`);
    }
    if (!model) {
      model = createModel(UNTITLED_MODEL);
      await s.put(model);
    }
    loadedId.current = model.id;
    dispatchRaw({ type: "load", model });
    setModels(await s.list());
    return true;
  }, [flushPending]);

  useEffect(() => {
    let canceled = false;
    openBrowserStore().then(async (opened) => {
      if (canceled) return;
      store.current = opened.store;
      persistent.current = opened.persistent;
      await open();
      setStatus(opened.persistent ? "saved" : "memory-only");
      setReady(true);
    });
    return () => {
      canceled = true;
    };
  }, [open]);

  // Autosave the present model once it has settled. The status flips to "Saving…" before the
  // change is painted, so "Saved" never shows while a save is still pending.
  const model = history.present;
  useLayoutEffect(() => {
    if (!store.current || loadedId.current !== model.id) return;
    setStatus((st) => (st === "memory-only" ? st : "saving"));
  }, [model]);
  useEffect(() => {
    const s = store.current;
    if (!s || loadedId.current !== model.id) return;
    pending.current = model;
    const t = setTimeout(() => {
      pending.current = null;
      // Deleting the open model detaches it (loadedId) before the next one loads; a save that was
      // still waiting must not write the deleted model back.
      if (loadedId.current !== model.id) return;
      s.put(model)
        .then(() => {
          setStatus(persistent.current ? "saved" : "memory-only");
          return refreshList();
        })
        .catch(() => setStatus("error"));
    }, 300);
    return () => clearTimeout(t);
  }, [model, refreshList]);

  // Leaving the page (close, reload, navigate away) writes a pending change at once instead of
  // dropping it with the timer.
  useEffect(() => {
    const flush = () => {
      const m = pending.current;
      if (m && store.current && loadedId.current === m.id) {
        pending.current = null;
        void store.current.put(m);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const newModel = useCallback(async () => {
    const s = store.current;
    if (!s) return;
    const m = createModel(UNTITLED_MODEL);
    await s.put(m);
    await open(m.id);
  }, [open]);

  /** A stored model, read back for download (the open one comes from memory, so it is never stale). */
  const read = useCallback(
    async (id: string): Promise<Model | undefined> => {
      if (id === model.id) return model;
      const got = await store.current?.get(id);
      return got?.ok ? got.model : undefined;
    },
    [model],
  );

  /**
   * Delete models from this browser. Deleting the open model first detaches autosave, so a
   * pending save cannot write it back; then the most recent remaining model opens (or a new one).
   */
  const remove = useCallback(
    async (ids: string[]) => {
      const s = store.current;
      if (!s || ids.length === 0) return;
      const openOne = ids.includes(loadedId.current ?? "");
      if (openOne) {
        loadedId.current = null;
        pending.current = null;
      }
      for (const id of ids) await s.remove(id);
      if (openOne) await open();
      else await refreshList();
    },
    [open, refreshList],
  );

  /**
   * Save a ready-made model (an example, an import) as a new model and open it. The open model's
   * waiting change is written first, so a failure there leaves nothing new behind. False when the
   * new model was not opened; the problem banner says why.
   */
  const createFrom = useCallback(
    async (m: Model): Promise<boolean> => {
      const s = store.current;
      if (!s || !(await flushPending(s))) return false;
      try {
        await s.put(m);
      } catch {
        setStatus("error");
        setProblem("This browser could not save the new model, so it was not opened. Free some space, or export a model you no longer need and delete it.");
        return false;
      }
      return open(m.id);
    },
    [open, flushPending],
  );

  return {
    model,
    createFrom,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    dispatch: dispatchRaw,
    status,
    ready,
    models,
    open,
    newModel,
    read,
    remove,
    problem,
    dismissProblem: () => setProblem(null),
  };
}
