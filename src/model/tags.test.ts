import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { initialHistory, reduce } from "@/editor/state";
import { compareModels } from "./compare";
import { modelSchema, MAX_TAGS } from "./schema";
import { filterActive, inView } from "./views";
import { parseTags, tagsOf } from "./tags";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");

describe("tags in the model file (M69)", () => {
  it("are optional; kept trimmed, once each (ignoring case), at most ten", () => {
    const json = JSON.parse(JSON.stringify(checkout()));
    json.nodes[0].tags = [" Team A ", "team a", "Program X", "", 7, "x".repeat(41), ...Array.from({ length: 20 }, (_, i) => `t${i}`)];
    const parsed = modelSchema.parse(json);
    expect(parsed.nodes[0]!.tags).toEqual(["Team A", "Program X", "t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"]);
    expect(parsed.nodes[0]!.tags).toHaveLength(MAX_TAGS);
    expect(tagsOf(parsed.nodes[1]!)).toEqual([]);
  });

  it("not a list, or nothing left: no key, and the file still loads", () => {
    const json = JSON.parse(JSON.stringify(checkout()));
    json.nodes[0].tags = "Team A";
    json.nodes[1].tags = ["  "];
    const parsed = modelSchema.parse(json);
    expect(JSON.stringify(parsed.nodes[0])).not.toContain("tags");
    expect(JSON.stringify(parsed.nodes[1])).not.toContain("tags");
  });

  it("typed as a comma-separated list", () => {
    expect(parseTags("Team A, program x ,, Team a")).toEqual(["Team A", "program x"]);
    expect(parseTags("")).toEqual([]);
  });
});

describe("set-tags (M69)", () => {
  it("sets an element's tags, one undo step; none removes the key", () => {
    const m = checkout();
    const id = m.nodes[2]!.id;
    let h = reduce(initialHistory(m), { type: "set-tags", id, tags: [" Team A", "team a", "Billing"] });
    expect(h.present.nodes[2]!.tags).toEqual(["Team A", "Billing"]);
    expect(reduce(h, { type: "set-tags", id, tags: ["Team A", "Billing"] })).toBe(h);
    h = reduce(h, { type: "set-tags", id, tags: [] });
    expect("tags" in h.present.nodes[2]!).toBe(false);
    expect(h.past).toHaveLength(2);
  });
});

describe("filter by tag (M69)", () => {
  it("keeps an element carrying any tag listed; \"\" keeps the untagged; case doesn't matter", () => {
    const m = checkout();
    const tagged = { ...m.nodes[0]!, tags: ["Team A", "Billing"] };
    expect(filterActive({ tags: ["team a"] })).toBe(true);
    expect(inView(tagged, { tags: ["team a"] })).toBe(true);
    expect(inView(tagged, { tags: ["Other"] })).toBe(false);
    expect(inView(m.nodes[1]!, { tags: [""] })).toBe(true);
    expect(inView(tagged, { tags: [""] })).toBe(false);
  });
});

describe("compare sees tags (M69)", () => {
  it("tags that changed are a change; a new order is not", () => {
    const base = checkout();
    base.nodes = base.nodes.map((n, i) => (i === 0 ? { ...n, tags: ["A", "B"] } : n));
    const reordered = { ...base, nodes: base.nodes.map((n, i) => (i === 0 ? { ...n, tags: ["B", "A"] } : n)) };
    expect(compareModels(reordered, base).changed).toEqual([]);
    const now = { ...base, nodes: base.nodes.map((n, i) => (i === 0 ? { ...n, tags: ["A"] } : n)) };
    expect(compareModels(now, base).changed[0]!.changes).toEqual([{ field: "tags", before: "A, B", after: "A" }]);
  });
});

describe("tags and commas, and a new spelling (M69 review)", () => {
  it("a tag with a comma is dropped (tags are typed and shown as a comma-separated list)", () => {
    const json = JSON.parse(JSON.stringify(checkout()));
    json.nodes[0].tags = ["Cost center 1,200", "Billing"];
    expect(modelSchema.parse(json).nodes[0]!.tags).toEqual(["Billing"]);
  });
  it("Compare sees a tag's new spelling", () => {
    const base = checkout();
    base.nodes = base.nodes.map((n, i) => (i === 0 ? { ...n, tags: ["team a"] } : n));
    const now = { ...base, nodes: base.nodes.map((n, i) => (i === 0 ? { ...n, tags: ["Team A"] } : n)) };
    expect(compareModels(now, base).changed[0]!.changes).toEqual([{ field: "tags", before: "team a", after: "Team A" }]);
  });
});
