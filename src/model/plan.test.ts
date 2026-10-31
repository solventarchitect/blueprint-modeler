import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { inView, filterActive } from "./views";
import { modelSchema } from "./schema";
import { planHidden, planOf, PLAN_LABEL } from "./plan";
import { reduce, initialHistory } from "@/editor/state";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");

describe("plan status in the model file (M68)", () => {
  it("is optional on elements and relationships; absent reads as Live", () => {
    const m = checkout();
    expect(m.nodes.every((n) => planOf(n) === "live")).toBe(true);
    const json = JSON.parse(JSON.stringify(m));
    json.nodes[0].plan = "planned";
    json.edges[0].plan = "retiring";
    const parsed = modelSchema.parse(json);
    expect(planOf(parsed.nodes[0]!)).toBe("planned");
    expect(planOf(parsed.edges[0]!)).toBe("retiring");
    expect(PLAN_LABEL.retiring).toBe("Retiring");
  });

  it("a value this version doesn't know is dropped, not the file", () => {
    const json = JSON.parse(JSON.stringify(checkout()));
    json.nodes[0].plan = "someday";
    json.edges[0].plan = 7;
    const parsed = modelSchema.parse(json);
    expect(parsed.nodes[0]!.plan).toBeUndefined();
    expect(JSON.stringify(parsed.nodes[0])).not.toContain("plan");
    expect(parsed.edges[0]!.plan).toBeUndefined();
  });
});

describe("set-plan (M68)", () => {
  it("sets an element's or a relationship's plan status, one undo step; Live removes the key", () => {
    const m = checkout();
    const n = m.nodes[1]!.id;
    const e = m.edges[0]!.id;
    let h = reduce(initialHistory(m), { type: "set-plan", target: "node", id: n, plan: "planned" });
    expect(h.present.nodes[1]!.plan).toBe("planned");
    expect(h.past).toHaveLength(1);
    expect(reduce(h, { type: "set-plan", target: "node", id: n, plan: "planned" })).toBe(h);
    h = reduce(h, { type: "set-plan", target: "edge", id: e, plan: "retiring" });
    expect(h.present.edges[0]!.plan).toBe("retiring");
    h = reduce(h, { type: "set-plan", target: "node", id: n, plan: "live" });
    expect("plan" in h.present.nodes[1]!).toBe(false);
    expect(h.past).toHaveLength(3);
  });
});

describe("Current and Target (M68)", () => {
  it("Current hides what is planned, Target what is retiring, with the relationships that touch them", () => {
    const m = checkout();
    const [a, b, c] = m.nodes;
    m.nodes = m.nodes.map((n) => (n.id === a!.id ? { ...n, plan: "planned" as const } : n.id === b!.id ? { ...n, plan: "retiring" as const } : n));
    const loose = m.edges.find((e) => ![a!.id, b!.id].includes(e.from) && ![a!.id, b!.id].includes(e.to))!;
    m.edges = m.edges.map((e) => (e.id === loose.id ? { ...e, plan: "planned" as const } : e));
    const touches = (id: string) => m.edges.filter((e) => e.from === id || e.to === id).map((e) => e.id);

    const both = planHidden(m, "both");
    expect(both.nodes.size + both.edges.size).toBe(0);

    const cur = planHidden(m, "current");
    expect([...cur.nodes]).toEqual([a!.id]);
    expect(cur.edges).toEqual(new Set([loose.id, ...touches(a!.id)]));
    expect(cur.nodes.has(c!.id)).toBe(false);

    const tgt = planHidden(m, "target");
    expect([...tgt.nodes]).toEqual([b!.id]);
    expect(tgt.edges).toEqual(new Set(touches(b!.id)));
  });
});

describe("filter by plan status (M68)", () => {
  it("a view can keep elements by plan status; Live matches elements with none set", () => {
    const m = checkout();
    const planned = { ...m.nodes[0]!, plan: "planned" as const };
    expect(filterActive({ plan: ["planned"] })).toBe(true);
    expect(inView(planned, { plan: ["planned"] })).toBe(true);
    expect(inView(m.nodes[1]!, { plan: ["planned"] })).toBe(false);
    expect(inView(m.nodes[1]!, { plan: ["live"] })).toBe(true);
  });
});

describe("compare sees plan status (M68)", () => {
  it("an element's or a relationship's plan status that changed is a change", async () => {
    const { compareModels } = await import("./compare");
    const base = checkout();
    const now = { ...base, nodes: base.nodes.map((n, i) => (i === 1 ? { ...n, plan: "retiring" as const } : n)), edges: base.edges.map((e, i) => (i === 0 ? { ...e, plan: "planned" as const } : e)) };
    const c = compareModels(now, base);
    expect(c.changed).toHaveLength(1);
    expect(c.changed[0]!.changes).toEqual([{ field: "plan", before: "Live", after: "Retiring" }]);
    expect(c.edgesChanged).toHaveLength(1);
    expect(c.edgesChanged[0]!.plan).toEqual({ before: "Live", after: "Planned" });
    expect(c.edgesChanged[0]!.before).toBe(base.edges[0]!.type);
  });
});

describe("a saved view's plan status filter (M68)", () => {
  it("keeps the values this version knows; others are dropped, not the file", () => {
    const json = JSON.parse(JSON.stringify(checkout()));
    json.views = [{ id: "v1", name: "Changes", filter: { plan: ["planned", "someday", "planned", "a", "b", "c"] }, colorBy: "layer" }];
    const parsed = modelSchema.parse(json);
    expect(parsed.views![0]!.filter.plan).toEqual(["planned"]);
    json.views[0].filter.plan = ["later"];
    expect(modelSchema.parse(json).views![0]!.filter.plan).toBeUndefined();
  });
});
