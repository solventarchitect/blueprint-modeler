import { parseModel, serializeModel, type Model } from "@/model";

/**
 * Where models live between visits: this browser only (CLAUDE.md rule 2). Every read goes back
 * through parseModel, so a corrupted or hand-edited record is reported, never trusted.
 */
/** What the Model menu shows for each stored model, without opening it. `damaged`: the row cannot be read. */
export type ModelSummary = {
  id: string;
  name: string;
  updated: string;
  description?: string;
  artifactId?: string;
  nodes: number;
  edges: number;
  damaged?: true;
};
export type StoredModel = { ok: true; model: Model } | { ok: false; error: string };

export interface ModelStore {
  list(): Promise<ModelSummary[]>;
  get(id: string): Promise<StoredModel | undefined>;
  put(model: Model): Promise<void>;
  remove(id: string): Promise<void>;
}

/** A stored row: the serialized model, plus its summary so listing never parses every model. */
type Row = { id: string; name: string; updated: string; json: string; description?: string; artifactId?: string; nodes?: number; edges?: number };

/** The Model menu's summary of a row; rows saved before the summary fields existed are read from their JSON. */
export function summary(r: Row): ModelSummary {
  const base = { id: r.id, name: r.name, updated: r.updated };
  const details = (d?: string, a?: string) => ({ ...(d?.trim() ? { description: d.trim() } : {}), ...(a?.trim() ? { artifactId: a.trim() } : {}) });
  if (typeof r.nodes === "number" && typeof r.edges === "number") return { ...base, ...details(r.description, r.artifactId), nodes: r.nodes, edges: r.edges };
  try {
    const m = JSON.parse(r.json) as Partial<Model>;
    return {
      ...base,
      ...details(typeof m.description === "string" ? m.description : undefined, typeof m.artifactId === "string" ? m.artifactId : undefined),
      nodes: Array.isArray(m.nodes) ? m.nodes.length : 0,
      edges: Array.isArray(m.edges) ? m.edges.length : 0,
    };
  } catch {
    return { ...base, nodes: 0, edges: 0, damaged: true };
  }
}
const byUpdatedDesc = (a: ModelSummary, b: ModelSummary) => b.updated.localeCompare(a.updated);
export const toRow = (m: Model): Row => ({
  id: m.id,
  name: m.name,
  updated: m.updated,
  json: serializeModel(m),
  ...(m.description ? { description: m.description } : {}),
  ...(m.artifactId ? { artifactId: m.artifactId } : {}),
  nodes: m.nodes.length,
  edges: m.edges.length,
});

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

/**
 * A write is done when its transaction commits, not when its request succeeds: a quota error can
 * abort the transaction after the request has succeeded, and then nothing was written.
 */
function committed(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new DOMException("The write was rolled back.", "AbortError"));
  });
}

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
      const store = await tx("readwrite");
      store.put(toRow(model));
      await committed(store.transaction);
    },
    async remove(id) {
      const store = await tx("readwrite");
      store.delete(id);
      await committed(store.transaction);
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
