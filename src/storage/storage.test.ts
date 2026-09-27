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
});
