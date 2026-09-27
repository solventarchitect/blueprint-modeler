import { parseModel, serializeModel, type Model } from "@/model";

/**
 * Where models live between visits: this browser only (CLAUDE.md rule 2). Every read goes back
 * through parseModel, so a corrupted or hand-edited record is reported, never trusted.
 */
export type ModelSummary = { id: string; name: string; updated: string };
export type StoredModel = { ok: true; model: Model } | { ok: false; error: string };

export interface ModelStore {
  list(): Promise<ModelSummary[]>;
  get(id: string): Promise<StoredModel | undefined>;
  put(model: Model): Promise<void>;
  remove(id: string): Promise<void>;
}

type Row = { id: string; name: string; updated: string; json: string };

const summary = (r: Row): ModelSummary => ({ id: r.id, name: r.name, updated: r.updated });
const byUpdatedDesc = (a: ModelSummary, b: ModelSummary) => b.updated.localeCompare(a.updated);
const toRow = (m: Model): Row => ({ id: m.id, name: m.name, updated: m.updated, json: serializeModel(m) });

function fromRow(row: Row): StoredModel {
  let data: unknown;
  try {
    data = JSON.parse(row.json);
  } catch {
    return { ok: false, error: "The stored model is not valid JSON." };
  }
  const parsed = parseModel(data);
  return parsed.ok ? { ok: true, model: parsed.model } : { ok: false, error: parsed.error };
}

/** In-memory store: tests, and the fallback when IndexedDB is unavailable (private windows). */
export function createMemoryStore(): ModelStore {
  const rows = new Map<string, Row>();
  return {
    async list() {
      return [...rows.values()].map(summary).sort(byUpdatedDesc);
    },
    async get(id) {
      const row = rows.get(id);
      return row ? fromRow(row) : undefined;
    },
    async put(model) {
      rows.set(model.id, toRow(model));
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}

const DB = "blueprint-modeler";
const STORE = "models";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB store (browser). One object store, keyed by model id; rows hold the serialized model. */
export function createIndexedDbStore(factory: IDBFactory = indexedDB): ModelStore {
  const open = new Promise<IDBDatabase>((resolve, reject) => {
    const req = factory.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = async (mode: IDBTransactionMode) => (await open).transaction(STORE, mode).objectStore(STORE);
  return {
    async list() {
      const rows = (await request((await tx("readonly")).getAll())) as Row[];
      return rows.map(summary).sort(byUpdatedDesc);
    },
    async get(id) {
      const row = (await request((await tx("readonly")).get(id))) as Row | undefined;
      return row ? fromRow(row) : undefined;
    },
    async put(model) {
      await request((await tx("readwrite")).put(toRow(model)));
    },
    async remove(id) {
      await request((await tx("readwrite")).delete(id));
    },
  };
}

/** The store to use in the browser: IndexedDB when it opens, memory otherwise. */
export async function openBrowserStore(): Promise<{ store: ModelStore; persistent: boolean }> {
  try {
    if (typeof indexedDB === "undefined") throw new Error("no IndexedDB");
    const store = createIndexedDbStore();
    await store.list();
    return { store, persistent: true };
  } catch {
    return { store: createMemoryStore(), persistent: false };
  }
}
