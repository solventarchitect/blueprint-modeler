import { describe, expect, it } from "vitest";
import { createModel } from "@/model";
import { createMemoryStore, snapshotSummary, summary, toRow } from "./index";

describe("memory store", () => {
  it("puts, lists newest first, gets back an equal model, and removes", async () => {
    const store = createMemoryStore();
    const a = createModel("A", new Date("2026-09-27T10:00:00Z"), "a");
    const b = createModel("B", new Date("2026-09-27T11:00:00Z"), "b");
    await store.put(a);
    await store.put(b);
    expect((await store.list()).map((s) => s.id)).toEqual(["b", "a"]);
    expect(await store.get("a")).toEqual({ ok: true, model: a });
    await store.remove("a");
    expect(await store.get("a")).toBeUndefined();
    expect((await store.list()).map((s) => s.id)).toEqual(["b"]);
  });

  it("keeps the summary in the stored row, reads older rows from their JSON, and marks unreadable ones", () => {
    const m = { ...createModel("Checkout", new Date("2026-09-27T10:00:00Z"), "c"), artifactId: "EA-0042" };
    const row = toRow(m);
    expect(row).toMatchObject({ artifactId: "EA-0042", nodes: 0, edges: 0 });
    // A row saved before M38 has no summary fields: they come from its JSON.
    expect(summary({ id: "c", name: "Checkout", updated: m.updated, json: row.json })).toMatchObject({ artifactId: "EA-0042", nodes: 0, edges: 0 });
    expect(summary({ id: "d", name: "Broken", updated: m.updated, json: "{not json" })).toMatchObject({ damaged: true });
  });

  it("summarizes each model for the Model menu: details and counts", async () => {
    const store = createMemoryStore();
    const m = { ...createModel("Checkout", new Date("2026-09-27T10:00:00Z"), "c"), description: "Order flow.", artifactId: "EA-0042" };
    m.nodes = [{ id: "ba", class: "business_application", name: "Checkout" }, { id: "svc", class: "application_service", name: "Checkout — prod" }];
    m.edges = [{ id: "e1", from: "ba", to: "svc", type: "Uses::Used by" }];
    m.layout = { ba: { x: 0, y: 0 }, svc: { x: 0, y: 200 } };
    await store.put(m);
    await store.put(createModel("Plain", new Date("2026-09-27T09:00:00Z"), "p"));
    expect(await store.list()).toEqual([
      { id: "c", name: "Checkout", updated: "2026-09-27T10:00:00.000Z", description: "Order flow.", artifactId: "EA-0042", nodes: 2, edges: 1 },
      { id: "p", name: "Plain", updated: "2026-09-27T09:00:00.000Z", nodes: 0, edges: 0 },
    ]);
  });
});

describe("snapshots (M66)", () => {
  const model = (name: string, at: string) => createModel(name, new Date(at), "m");
  it("keeps named snapshots of a model, newest first, each read back as it was", async () => {
    const store = createMemoryStore();
    const m = model("Checkout", "2026-10-28T10:00:00Z");
    await store.put(m);
    await store.putSnapshot({ id: "s1", modelId: "m", name: "Before review", taken: "2026-10-28T10:05:00.000Z", model: m });
    const changed = { ...m, name: "Checkout v2" };
    await store.putSnapshot({ id: "s2", modelId: "m", name: "After review", taken: "2026-10-28T11:00:00.000Z", model: changed });
    expect((await store.listSnapshots("m")).map((s) => [s.id, s.name, s.nodes, s.edges])).toEqual([
      ["s2", "After review", 0, 0],
      ["s1", "Before review", 0, 0],
    ]);
    expect(await store.getSnapshot("s1")).toEqual({ ok: true, model: m });
    expect(await store.getSnapshot("s2")).toEqual({ ok: true, model: changed });
    expect(await store.listSnapshots("other")).toEqual([]);
  });

  it("deletes one snapshot, and all of a model's snapshots with the model", async () => {
    const store = createMemoryStore();
    const m = model("Checkout", "2026-10-28T10:00:00Z");
    await store.put(m);
    await store.putSnapshot({ id: "s1", modelId: "m", name: "One", taken: "2026-10-28T10:05:00.000Z", model: m });
    await store.putSnapshot({ id: "s2", modelId: "m", name: "Two", taken: "2026-10-28T10:06:00.000Z", model: m });
    await store.removeSnapshot("s1");
    expect((await store.listSnapshots("m")).map((s) => s.id)).toEqual(["s2"]);
    await store.remove("m");
    expect(await store.listSnapshots("m")).toEqual([]);
    expect(await store.getSnapshot("s2")).toBeUndefined();
  });

  it("reports a damaged snapshot rather than trusting it", () => {
    expect(snapshotSummary({ id: "s", modelId: "m", name: "Bad", taken: "2026-10-28T10:00:00.000Z", json: "{nope" })).toMatchObject({ damaged: true });
  });
});
