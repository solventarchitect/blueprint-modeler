"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createModel, type Model } from "@/model";
import { openBrowserStore, type ModelStore, type ModelSummary } from "@/storage";
import { initialHistory, reduce, type Action, type History } from "./state";

export type SaveStatus = "loading" | "saved" | "saving" | "memory-only" | "error";

const EMPTY: History = initialHistory(createModel("Untitled model", new Date(0), "placeholder"));

/**
 * The open model, its undo history, and autosave to this browser. Loads the most recently
 * updated model (or creates one); every change is written back after a short pause.
 */
export function useModelDocument() {
  const [history, dispatchRaw] = useReducer((s: History, a: Action) => reduce(s, a), EMPTY);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const store = useRef<ModelStore | null>(null);
  const loadedId = useRef<string | null>(null);
  const persistent = useRef(true);

  const refreshList = useCallback(async () => {
    if (store.current) setModels(await store.current.list());
  }, []);

  const open = useCallback(async (id?: string) => {
    const s = store.current;
    if (!s) return;
    const list = await s.list();
    const targetId = id ?? list[0]?.id;
    let model: Model | undefined;
    if (targetId) {
      const got = await s.get(targetId);
      if (got?.ok) model = got.model;
      else if (got) setProblem(`A saved model could not be opened: ${got.error}`);
    }
    if (!model) {
      model = createModel("Untitled model");
      await s.put(model);
    }
    loadedId.current = model.id;
    dispatchRaw({ type: "load", model });
    setModels(await s.list());
  }, []);

  useEffect(() => {
    let cancelled = false;
    openBrowserStore().then(async (opened) => {
      if (cancelled) return;
      store.current = opened.store;
      persistent.current = opened.persistent;
      await open();
      setStatus(opened.persistent ? "saved" : "memory-only");
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Autosave the present model once it has settled.
  const model = history.present;
  useEffect(() => {
    const s = store.current;
    if (!s || loadedId.current !== model.id) return;
    setStatus((st) => (st === "memory-only" ? st : "saving"));
    const t = setTimeout(() => {
      s.put(model)
        .then(() => {
          setStatus(persistent.current ? "saved" : "memory-only");
          return refreshList();
        })
        .catch(() => setStatus("error"));
    }, 300);
    return () => clearTimeout(t);
  }, [model, refreshList]);

  const newModel = useCallback(async () => {
    const s = store.current;
    if (!s) return;
    const m = createModel("Untitled model");
    await s.put(m);
    await open(m.id);
  }, [open]);

  /** Save a ready-made model (an example) as a new model and open it. */
  const createFrom = useCallback(
    async (m: Model) => {
      const s = store.current;
      if (!s) return;
      await s.put(m);
      await open(m.id);
    },
    [open],
  );

  return {
    model,
    createFrom,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    dispatch: dispatchRaw,
    status,
    models,
    open,
    newModel,
    problem,
    dismissProblem: () => setProblem(null),
  };
}
