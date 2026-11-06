import { describe, expect, it } from "vitest";
import type { SnapshotSummary } from "@/storage";
import { snapshotPair } from "./Snapshots";

// M83: comparing two snapshots with each other.
const s = (id: string, taken: string, damaged = false): SnapshotSummary => ({ id, modelId: "m", name: id, taken, nodes: 1, edges: 0, ...(damaged ? { damaged: true as const } : {}) });

describe("snapshotPair (M83)", () => {
  it("starts from the second newest readable snapshot to the newest (the list is newest first)", () => {
    expect(snapshotPair([s("c", "2026-11-03T03:00:00Z"), s("b", "2026-11-02T00:00:00Z"), s("a", "2026-11-01T00:00:00Z")])).toEqual({ from: "b", to: "c" });
  });
  it("skips snapshots that can't be read, and offers nothing with fewer than two", () => {
    expect(snapshotPair([s("c", "2026-11-03T00:00:00Z"), s("x", "2026-11-02T00:00:00Z", true), s("a", "2026-11-01T00:00:00Z")])).toEqual({ from: "a", to: "c" });
    expect(snapshotPair([s("c", "2026-11-03T00:00:00Z"), s("x", "2026-11-02T00:00:00Z", true)])).toBeNull();
    expect(snapshotPair([])).toBeNull();
  });
});
