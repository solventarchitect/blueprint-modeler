import { describe, expect, it } from "vitest";
import { createModel } from "@/model";
import { connectionProblem, initialHistory, laneY, modernEdge, reduce, SLOT, type Action, type History } from "./state";

const T = "2026-09-27T12:00:00.000Z";
const now = () => T;
const run = (actions: Action[], start: History = initialHistory(createModel("M", new Date(T), "m"))) =>
  actions.reduce((s, a) => reduce(s, a, now), start);

const base: Action[] = [
  { type: "add-node", id: "ba", class: "business_application", name: "Checkout" },
  { type: "add-node", id: "svc", class: "application_service", name: "Checkout — prod" },
  { type: "add-node", id: "host", class: "host", name: "web-01" },
];

describe("model details", () => {
  it("sets, trims and clears the description and Artifact ID, as one undo step each", () => {
    let s = run([{ type: "model-details", description: "  Order flow.  ", artifactId: " EA-0042 " }]);
    expect(s.present).toMatchObject({ description: "Order flow.", artifactId: "EA-0042" });
    // Name, then the details, right after it in the file.
    expect(Object.keys(s.present).slice(0, 6)).toEqual(["schema", "id", "name", "date", "description", "artifactId"]);
    s = run([{ type: "model-details", artifactId: "" }], s);
    expect("artifactId" in s.present).toBe(false);
    expect(s.present.description).toBe("Order flow.");
    expect(run([{ type: "model-details", description: "Order flow." }], s)).toBe(s);
    s = run([{ type: "undo" }], s);
    expect(s.present.artifactId).toBe("EA-0042");
  });

  it("sets the model date, in file order after the name", () => {
    let s = run([{ type: "model-details", date: "2026-10-04" }]);
    expect(s.present.date).toBe("2026-10-04");
    expect(Object.keys(s.present).slice(0, 4)).toEqual(["schema", "id", "name", "date"]);
    expect(run([{ type: "model-details", date: "2026-10-04" }], s)).toBe(s);
    s = run([{ type: "model-details", date: "" }], s);
    expect("date" in s.present).toBe(false);
  });
});

describe("editor state", () => {
  it("places new elements in their layer lane, left to right", () => {
    const s = run([...base, { type: "add-node", id: "ba2", class: "business_application", name: "Billing" }]);
    expect(s.present.layout.ba).toEqual({ x: 0, y: laneY.design });
    expect(s.present.layout.ba2).toEqual({ x: SLOT, y: laneY.design });
    expect(s.present.layout.host).toEqual({ x: 0, y: laneY.infrastructure });
  });

  it("adds an allowed relationship with the preferred type", () => {
    const s = run([...base, { type: "add-edge", id: "e1", from: "ba", to: "svc" }]);
    expect(s.present.edges).toEqual([{ id: "e1", from: "ba", to: "svc", type: "Uses::Used by" }]);
  });

  it("refuses disallowed, reversed, self and duplicate relationships, with a reason", () => {
    const s = run([...base, { type: "add-edge", id: "e1", from: "ba", to: "svc" }]);
    expect(connectionProblem(s.present, "ba", "host")).toMatch(/not related directly/);
    expect(connectionProblem(s.present, "svc", "ba")).toMatch(/other way/);
    expect(connectionProblem(s.present, "ba", "ba")).toMatch(/itself/);
    expect(connectionProblem(s.present, "ba", "svc")).toMatch(/already exists/);
    expect(connectionProblem(s.present, "ba", "svc", "Consumes::Consumed by")).toMatch(/not used between/);
    const after = run([{ type: "add-edge", id: "e2", from: "ba", to: "host" }], s);
    expect(after).toBe(s);
  });

  it("deletes an element with its relationships and layout", () => {
    const s = run([...base, { type: "add-edge", id: "e1", from: "ba", to: "svc" }, { type: "delete-node", id: "svc" }]);
    expect(s.present.nodes.map((n) => n.id)).toEqual(["ba", "host"]);
    expect(s.present.edges).toEqual([]);
    expect(s.present.layout.svc).toBeUndefined();
  });

  it("undoes and redoes, and a new change clears the redo stack", () => {
    let s = run([...base, { type: "rename-node", id: "ba", name: "Checkout v2" }]);
    s = reduce(s, { type: "undo" });
    expect(s.present.nodes[0]!.name).toBe("Checkout");
    s = reduce(s, { type: "redo" });
    expect(s.present.nodes[0]!.name).toBe("Checkout v2");
    s = reduce(s, { type: "undo" });
    s = reduce(s, { type: "rename-node", id: "ba", name: "Other" }, now);
    expect(s.future).toEqual([]);
  });

  it("ignores no-op changes so they never enter history", () => {
    const s = run(base);
    expect(reduce(s, { type: "rename-node", id: "ba", name: "Checkout" }, now)).toBe(s);
    expect(reduce(s, { type: "move-node", id: "ba", x: 0, y: laneY.design }, now)).toBe(s);
  });

  it("applies an auto-layout as one undo step, ignoring unknown ids", () => {
    const s = run([...base, { type: "set-layout", layout: { ba: { x: 10.4, y: 20 }, svc: { x: 30, y: 40 }, ghost: { x: 1, y: 1 } } }]);
    expect(s.present.layout.ba).toEqual({ x: 10, y: 20 });
    expect(s.present.layout.svc).toEqual({ x: 30, y: 40 });
    expect(s.present.layout.host).toEqual({ x: 0, y: laneY.infrastructure });
    expect(s.present.layout).not.toHaveProperty("ghost");
    const undone = reduce(s, { type: "undo" }, now);
    expect(undone.present.layout.ba).toEqual({ x: 0, y: laneY.design });
    expect(reduce(s, { type: "set-layout", layout: s.present.layout }, now)).toBe(s);
  });

  it("deletes several elements (a layer) as one undo step", () => {
    const s = run([...base, { type: "add-edge", id: "e1", from: "ba", to: "svc" }, { type: "delete-nodes", ids: ["ba", "svc", "ghost"] }]);
    expect(s.present.nodes.map((n) => n.id)).toEqual(["host"]);
    expect(s.present.edges).toEqual([]);
    expect(Object.keys(s.present.layout)).toEqual(["host"]);
    expect(reduce(s, { type: "undo" }, now).present.nodes).toHaveLength(3);
    expect(reduce(s, { type: "delete-nodes", ids: ["ghost"] }, now)).toBe(s);
  });

  it("delete-nodes also removes other selected relationships, in the same undo step (M57)", () => {
    const s = run([
      ...base,
      { type: "add-edge", id: "e1", from: "ba", to: "svc" },
      { type: "delete-nodes", ids: [], edgeIds: ["e1"] },
    ]);
    expect(s.present.edges).toEqual([]);
    expect(s.present.nodes).toHaveLength(3);
    const back = reduce(s, { type: "undo" }, now);
    expect(back.present.edges.map((e) => e.id)).toEqual(["e1"]);
    expect(reduce(back, { type: "delete-nodes", ids: [], edgeIds: ["nope"] }, now)).toBe(back);
  });

  it("brings a legacy edge to its CSDM 5 type and direction in one step", () => {
    const start = run([
      { type: "add-node", id: "cap", class: "business_capability", name: "Orders" },
      { type: "add-node", id: "ba", class: "business_application", name: "Checkout" },
    ]);
    const legacy = { ...start, present: { ...start.present, edges: [{ id: "e1", from: "ba", to: "cap", type: "Provides::Provided by" }] } };
    const fix = modernEdge(legacy.present, legacy.present.edges[0]!);
    expect(fix).toEqual({ from: "cap", to: "ba", type: "Provided by::Provides" });
    const s = reduce(legacy, { type: "update-edge", id: "e1", from: fix!.from, to: fix!.to, edgeType: fix!.type }, now);
    expect(s.present.edges).toEqual([{ id: "e1", from: "cap", to: "ba", type: "Provided by::Provides" }]);
    expect(modernEdge(s.present, s.present.edges[0]!)).toBeNull();
    expect(reduce(s, { type: "update-edge", id: "e1", from: "ba", to: "cap", edgeType: "Provides::Provided by" }, now)).toBe(s);
  });

  it("adds a related element where it was dropped, when given a position (M53)", () => {
    const model = createModel("T", new Date("2026-09-27T00:00:00Z"), "t");
    model.nodes = [{ id: "ba", class: "business_application", name: "Checkout" }];
    model.layout = { ba: { x: 0, y: 240 } };
    const h = reduce(initialHistory(model), { type: "add-related", id: "n", class: "application_service", name: "New", edgeId: "e", relatedTo: "ba", outgoing: true, edgeType: "Uses::Used by", at: { x: 512, y: 800 } });
    expect(h.present.layout.n).toEqual({ x: 512, y: 800 });
    expect(h.present.edges).toEqual([{ id: "e", from: "ba", to: "n", type: "Uses::Used by" }]);
    expect(h.past).toHaveLength(1);
  });

  it("sets, trims and clears an element's life cycle, environment and owner, one undo step each (M54)", () => {
    const model = createModel("T", new Date("2026-09-27T00:00:00Z"), "t");
    model.nodes = [{ id: "ba", class: "business_application", name: "Checkout", attrs: { description: "Sells" } }];
    model.layout = { ba: { x: 0, y: 0 } };
    let h = reduce(initialHistory(model), { type: "set-attr", id: "ba", key: "lifecycle", value: "Operational" });
    h = reduce(h, { type: "set-attr", id: "ba", key: "owner", value: "  Ann  " });
    expect(h.present.nodes[0]!.attrs).toEqual({ description: "Sells", lifecycle: "Operational", owner: "Ann" });
    expect(h.past).toHaveLength(2);
    // Same value again: no new step.
    expect(reduce(h, { type: "set-attr", id: "ba", key: "owner", value: "Ann" }).past).toHaveLength(2);
    h = reduce(h, { type: "set-attr", id: "ba", key: "lifecycle", value: "" });
    expect(h.present.nodes[0]!.attrs).toEqual({ description: "Sells", owner: "Ann" });
  });

  it("sets, or clears, one property on several elements in one undo step (M63)", () => {
    const model = createModel("T", new Date("2026-09-27T00:00:00Z"), "t");
    model.nodes = [
      { id: "a", class: "host", name: "web-1", attrs: { environment: "Test" } },
      { id: "b", class: "host", name: "web-2" },
      { id: "c", class: "host", name: "db-1", attrs: { environment: "Production", owner: "DBA" } },
    ];
    model.layout = { a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, c: { x: 600, y: 0 } };
    let h = reduce(initialHistory(model), { type: "set-attrs", ids: ["a", "b", "c"], key: "environment", value: "  Production " });
    expect(h.present.nodes.map((n) => n.attrs?.environment)).toEqual(["Production", "Production", "Production"]);
    expect(h.past).toHaveLength(1);
    // Already so on every one: no new step.
    expect(reduce(h, { type: "set-attrs", ids: ["a", "b", "c"], key: "environment", value: "Production" }).past).toHaveLength(1);
    h = reduce(h, { type: "set-attrs", ids: ["a", "c"], key: "owner", value: "" });
    expect(h.present.nodes.map((n) => n.attrs)).toEqual([{ environment: "Production" }, { environment: "Production" }, { environment: "Production" }]);
    expect(h.past).toHaveLength(2);
    h = reduce(h, { type: "undo" });
    h = reduce(h, { type: "undo" });
    expect(h.present.nodes.map((n) => n.attrs)).toEqual(model.nodes.map((n) => n.attrs));
    // Unknown ids change nothing.
    expect(reduce(h, { type: "set-attrs", ids: ["zz"], key: "owner", value: "x" }).past).toHaveLength(0);
  });

  it("sets an element's links and record number, one undo step each; no links means none stored (M65)", () => {
    const model = createModel("T", new Date("2026-09-27T00:00:00Z"), "t");
    model.nodes = [{ id: "ba", class: "business_application", name: "Checkout" }];
    model.layout = { ba: { x: 0, y: 0 } };
    const links = [{ title: "Runbook", url: "https://example.com/runbook" }];
    let h = reduce(initialHistory(model), { type: "set-links", id: "ba", links });
    expect(h.present.nodes[0]!.links).toEqual(links);
    expect(reduce(h, { type: "set-links", id: "ba", links: [...links] }).past).toHaveLength(1);
    // Never more than five, and only http(s) addresses with a title.
    const many = Array.from({ length: 7 }, (_, i) => ({ title: `L${i}`, url: `https://example.com/${i}` }));
    h = reduce(h, { type: "set-links", id: "ba", links: [...many, { title: "x", url: "javascript:alert(1)" }] });
    expect(h.present.nodes[0]!.links).toHaveLength(5);
    h = reduce(h, { type: "set-links", id: "ba", links: [] });
    expect("links" in h.present.nodes[0]!).toBe(false);
    h = reduce(h, { type: "set-attr", id: "ba", key: "ref", value: " APM0001234 " });
    expect(h.present.nodes[0]!.attrs).toEqual({ ref: "APM0001234" });
    expect(h.past).toHaveLength(4);
  });

  it("restores a snapshot in one undo step, keeping the model's own id and created date (M66)", () => {
    const model = createModel("T", new Date("2026-09-27T00:00:00Z"), "t");
    model.nodes = [{ id: "ba", class: "business_application", name: "Checkout" }];
    model.layout = { ba: { x: 0, y: 0 } };
    const snap = { ...model, id: "other", created: "2020-01-01T00:00:00.000Z", name: "T then", nodes: [], layout: {} };
    let h = reduce(initialHistory(model), { type: "restore", model: snap });
    expect(h.present).toMatchObject({ id: "t", created: model.created, name: "T then", nodes: [] });
    expect(h.past).toHaveLength(1);
    // The same again changes nothing.
    expect(reduce(h, { type: "restore", model: snap }).past).toHaveLength(1);
    h = reduce(h, { type: "undo" });
    expect(h.present.nodes.map((n) => n.name)).toEqual(["Checkout"]);
  });

  it("saves, replaces and deletes views, one undo step each, keeping the list order (M54)", () => {
    const model = createModel("T", new Date("2026-09-27T00:00:00Z"), "t");
    const v = (id: string, name: string) => ({ id, name, filter: { layers: ["business"] }, colorBy: "layer" as const });
    let h = reduce(initialHistory(model), { type: "save-view", view: v("a", "First") });
    h = reduce(h, { type: "save-view", view: v("b", "Second") });
    h = reduce(h, { type: "save-view", view: { ...v("a", "First, renamed"), colorBy: "owner" } });
    expect(h.present.views!.map((x) => [x.id, x.name, x.colorBy])).toEqual([["a", "First, renamed", "owner"], ["b", "Second", "layer"]]);
    h = reduce(h, { type: "delete-view", id: "a" });
    expect(h.present.views!.map((x) => x.id)).toEqual(["b"]);
    h = reduce(h, { type: "delete-view", id: "b" });
    expect(h.present.views).toBeUndefined();
    expect(h.past).toHaveLength(5);
    expect(reduce(h, { type: "delete-view", id: "nope" }).past).toHaveLength(5);
  });

  it("never stores a view the model file would refuse: a 21st view, or an invalid one", () => {
    const model = createModel("T", new Date("2026-09-27T00:00:00Z"), "t");
    let h = initialHistory(model);
    for (let i = 0; i < 20; i++) h = reduce(h, { type: "save-view", view: { id: `v${i}`, name: `View ${i}`, filter: {}, colorBy: "owner" } });
    expect(h.present.views).toHaveLength(20);
    const full = reduce(h, { type: "save-view", view: { id: "v20", name: "One too many", filter: {}, colorBy: "owner" } });
    expect(full).toBe(h);
    // Renaming one of the twenty still works.
    expect(reduce(h, { type: "save-view", view: { id: "v0", name: "Renamed", filter: {}, colorBy: "owner" } }).present.views![0]!.name).toBe("Renamed");
    const bad = reduce(initialHistory(model), { type: "save-view", view: { id: "x", name: "   ", filter: {}, colorBy: "owner" } });
    expect(bad.present.views).toBeUndefined();
    // Store what you can filter on: a value as long as an element property may be is fine.
    const long = reduce(initialHistory(model), { type: "save-view", view: { id: "y", name: "Long", filter: { owner: ["x".repeat(2000)] }, colorBy: "owner" } });
    expect(long.present.views).toHaveLength(1);
  });

  it("stamps updated on change", () => {
    const s = run(base);
    expect(s.present.updated).toBe(T);
  });
});

describe("connection points (M61)", () => {
  const withEdge = () => run([...base, { type: "add-edge", id: "e1", from: "ba", to: "svc" }]);

  it("keeps a chosen side for either end, one undo step each, and back to automatic with null", () => {
    let s = run([{ type: "set-ports", id: "e1", from: "right" }], withEdge());
    expect(s.present.edges[0]!.ports).toEqual({ from: "right" });
    s = run([{ type: "set-ports", id: "e1", to: "top" }], s);
    expect(s.present.edges[0]!.ports).toEqual({ from: "right", to: "top" });
    expect(run([{ type: "set-ports", id: "e1", to: "top" }], s)).toBe(s);
    s = run([{ type: "set-ports", id: "e1", from: null }], s);
    expect(s.present.edges[0]!.ports).toEqual({ to: "top" });
    s = run([{ type: "set-ports", id: "e1", from: null, to: null }], s);
    // Nothing chosen: the field goes, so the file is as before.
    expect("ports" in s.present.edges[0]!).toBe(false);
    expect(run([{ type: "undo" }], s).present.edges[0]!.ports).toEqual({ to: "top" });
    expect(run([{ type: "set-ports", id: "nope", from: "top" }], s)).toBe(s);
  });

  it("keeps the chosen sides when a relationship is updated in place without turning round", () => {
    const s = run([{ type: "set-ports", id: "e1", from: "right", to: "left" }], withEdge());
    const e = s.present.edges[0]!;
    const retyped = run([{ type: "update-edge", id: "e1", from: e.from, to: e.to, edgeType: e.type }], s);
    expect(retyped.present.edges[0]!.ports).toEqual({ from: "right", to: "left" });
  });
});
