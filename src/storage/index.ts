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

/** How many snapshots a model keeps (M66). */
export const MAX_SNAPSHOTS = 20;
/** A snapshot to keep (M66): a model as it was, named, kept with the model in this browser only. */
export type Snapshot = { id: string; modelId: string; name: string; taken: string; model: Model };
/** What the Snapshots dialog lists, without reading each snapshot's model. */
export type SnapshotSummary = { id: string; modelId: string; name: string; taken: string; nodes: number; edges: number; damaged?: true };

export interface ModelStore {
  list(): Promise<ModelSummary[]>;
  get(id: string): Promise<StoredModel | undefined>;
  put(model: Model): Promise<void>;
  /** Removes the model and its snapshots. */
  remove(id: string): Promise<void>;
  listSnapshots(modelId: string): Promise<SnapshotSummary[]>;
  getSnapshot(id: string): Promise<StoredModel | undefined>;
  putSnapshot(snapshot: Snapshot): Promise<void>;
  removeSnapshot(id: string): Promise<void>;
}

type SnapshotRow = { id: string; modelId: string; name: string; taken: string; json: string; nodes?: number; edges?: number };
const toSnapshotRow = (s: Snapshot): SnapshotRow => ({ id: s.id, modelId: s.modelId, name: s.name, taken: s.taken, json: serializeModel(s.model), nodes: s.model.nodes.length, edges: s.model.edges.length });
/** A snapshot row's summary; one whose model can't be read is marked, not trusted. */
export function snapshotSummary(r: SnapshotRow): SnapshotSummary {
  const base = { id: r.id, modelId: r.modelId, name: r.name, taken: r.taken };
  try {
    JSON.parse(r.json);
  } catch {
    return { ...base, nodes: 0, edges: 0, damaged: true };
  }
  return { ...base, nodes: r.nodes ?? 0, edges: r.edges ?? 0 };
}
const byTakenDesc = (a: SnapshotSummary, b: SnapshotSummary) => b.taken.localeCompare(a.taken);

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

function fromRow(row: Pick<Row, "json">): StoredModel {
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
  const snapshots = new Map<string, SnapshotRow>();
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
      for (const [k, s] of snapshots) if (s.modelId === id) snapshots.delete(k);
    },
    async listSnapshots(modelId) {
      return [...snapshots.values()].filter((s) => s.modelId === modelId).map(snapshotSummary).sort(byTakenDesc);
    },
    async getSnapshot(id) {
      const row = snapshots.get(id);
      return row ? fromRow(row) : undefined;
    },
    async putSnapshot(snapshot) {
      snapshots.set(snapshot.id, toSnapshotRow(snapshot));
    },
    async removeSnapshot(id) {
      snapshots.delete(id);
    },
  };
}

const DB = "blueprint-modeler";
const STORE = "models";
/** M66: version 2 adds the snapshots store, indexed by the model they belong to. */
const DB_VERSION = 2;
const SNAPSHOTS = "snapshots";

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
export function createIndexedDbStore(factory: IDBFactory = indexedDB, onBlocked?: () => void): ModelStore {
  const open = new Promise<IDBDatabase>((resolve, reject) => {
    const req = factory.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SNAPSHOTS)) db.createObjectStore(SNAPSHOTS, { keyPath: "id" }).createIndex("modelId", "modelId");
    };
    req.onsuccess = () => {
      // Another tab opening a newer version: let it upgrade (this tab keeps working until reload).
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
    // A tab still on the version before snapshots holds the database open: the upgrade waits for it.
    req.onblocked = () => onBlocked?.();
  });
  const tx = async (mode: IDBTransactionMode) => (await open).transaction(STORE, mode).objectStore(STORE);
  const snaps = async (mode: IDBTransactionMode) => (await open).transaction(SNAPSHOTS, mode).objectStore(SNAPSHOTS);
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
      // The model and its snapshots go together, in one transaction.
      const t = (await open).transaction([STORE, SNAPSHOTS], "readwrite");
      t.objectStore(STORE).delete(id);
      const index = t.objectStore(SNAPSHOTS).index("modelId");
      const keys = await request(index.getAllKeys(id));
      for (const k of keys) t.objectStore(SNAPSHOTS).delete(k);
      await committed(t);
    },
    async listSnapshots(modelId) {
      const rows = (await request((await snaps("readonly")).index("modelId").getAll(modelId))) as SnapshotRow[];
      return rows.map(snapshotSummary).sort(byTakenDesc);
    },
    async getSnapshot(id) {
      const row = (await request((await snaps("readonly")).get(id))) as SnapshotRow | undefined;
      return row ? fromRow(row) : undefined;
    },
    async putSnapshot(snapshot) {
      const store = await snaps("readwrite");
      store.put(toSnapshotRow(snapshot));
      await committed(store.transaction);
    },
    async removeSnapshot(id) {
      const store = await snaps("readwrite");
      store.delete(id);
      await committed(store.transaction);
    },
  };
}

/** The store to use in the browser: IndexedDB when it opens, memory otherwise. */
export async function openBrowserStore(onBlocked?: () => void): Promise<{ store: ModelStore; persistent: boolean }> {
  try {
    if (typeof indexedDB === "undefined") throw new Error("no IndexedDB");
    const store = createIndexedDbStore(indexedDB, onBlocked);
    await store.list();
    return { store, persistent: true };
  } catch {
    return { store: createMemoryStore(), persistent: false };
  }
}
