import { describe, expect, it } from "vitest";
import { createModel } from "@/model";
import { createMemoryStore } from "./index";

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
