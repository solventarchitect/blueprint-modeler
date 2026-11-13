import { describe, expect, it } from "vitest";
import { createModel, inView } from "@/model";
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

describe("decisions (M78)", () => {
  const d = { id: "d1", title: "  Cache the catalog  ", status: "proposed" as const, elements: ["ba", "svc"] };
  it("save adds or replaces in place, trimmed, one undo step each; delete removes the key with the last", () => {
    let s = run([...base, { type: "save-decision", decision: d }]);
    expect(s.present.decisions).toEqual([{ ...d, title: "Cache the catalog" }]);
    const again = run([{ type: "save-decision", decision: { ...d, title: "Cache the catalog" } }], s);
    expect(again).toBe(s);
    s = run([{ type: "save-decision", decision: { ...d, status: "accepted" } }], s);
    expect(s.present.decisions).toHaveLength(1);
    expect(s.present.decisions![0]!.status).toBe("accepted");
    expect(run([{ type: "save-decision", decision: { ...d, title: " " } }], s)).toBe(s);
    s = run([{ type: "delete-decision", id: "d1" }], s);
    expect("decisions" in s.present).toBe(false);
    s = run([{ type: "undo" }], s);
    expect(s.present.decisions![0]!.status).toBe("accepted");
  });

  it("deleting an element takes it off the decisions about it, in the same undo step", () => {
    let s = run([...base, { type: "save-decision", decision: d }, { type: "delete-node", id: "ba" }]);
    expect(s.present.decisions![0]!.elements).toEqual(["svc"]);
    s = run([{ type: "delete-nodes", ids: ["svc"] }], s);
    expect(s.present.decisions![0]).not.toHaveProperty("elements");
    s = run([{ type: "undo" }, { type: "undo" }], s);
    expect(s.present.decisions![0]!.elements).toEqual(["ba", "svc"]);
  });

  it("M85: Superseded by is kept only for a Superseded decision naming another, never a loop", () => {
    const b = { id: "d2", title: "Edge cache", status: "accepted" as const };
    let s = run([...base, { type: "save-decision", decision: d }, { type: "save-decision", decision: b }]);
    s = run([{ type: "save-decision", decision: { ...d, status: "superseded", supersededBy: "d2" } }], s);
    expect(s.present.decisions![0]).toMatchObject({ status: "superseded", supersededBy: "d2" });
    expect(Object.keys(s.present.decisions![0]!).slice(0, 4)).toEqual(["id", "title", "status", "supersededBy"]);
    // d2 can't be replaced by d1, which it already replaces: the link is left out, the rest saved.
    const loop = run([{ type: "save-decision", decision: { ...b, status: "superseded", supersededBy: "d1", context: "Why" } }], s);
    expect(loop.present.decisions![1]).toEqual({ ...b, status: "superseded", context: "Why" });
    expect(run([{ type: "save-decision", decision: { ...b, status: "superseded", supersededBy: "d2" } }], s).present.decisions![1]).not.toHaveProperty("supersededBy");
    expect(run([{ type: "save-decision", decision: { ...b, status: "superseded", supersededBy: "gone" } }], s).present.decisions![1]).not.toHaveProperty("supersededBy");
    // Back to Accepted drops it.
    expect(run([{ type: "save-decision", decision: { ...d, title: "Cache the catalog", status: "accepted", supersededBy: "d2" } }], s).present.decisions![0]).not.toHaveProperty("supersededBy");
  });

  it("M85: deleting a decision takes it off the decisions it replaced, in the same undo step", () => {
    let s = run([...base, { type: "save-decision", decision: { id: "d2", title: "Edge cache", status: "accepted" } }, { type: "save-decision", decision: { ...d, status: "superseded", supersededBy: "d2" } }]);
    s = run([{ type: "delete-decision", id: "d2" }], s);
    expect(s.present.decisions).toEqual([{ ...d, title: "Cache the catalog", status: "superseded" }]);
    s = run([{ type: "undo" }], s);
    expect(s.present.decisions![1]!.supersededBy).toBe("d2");
  });
});

describe("the decisions filter follows the model (M88)", () => {
  const kept = (h: History) => h.present.nodes.filter((n) => inView(n, { decisions: ["with"] }, h.present)).map((n) => n.id);
  it("making, changing, deleting and undoing a decision changes what Has decisions keeps", () => {
    let s = run([...base, { type: "save-decision", decision: { id: "d1", title: "Cache", status: "proposed", elements: ["ba"] } }]);
    expect(kept(s)).toEqual(["ba"]);
    s = run([{ type: "save-decision", decision: { id: "d1", title: "Cache", status: "proposed", elements: ["ba", "host"] } }], s);
    expect(kept(s)).toEqual(["ba", "host"]);
    s = run([{ type: "delete-node", id: "host" }], s);
    expect(kept(s)).toEqual(["ba"]);
    s = run([{ type: "delete-decision", id: "d1" }], s);
    expect(kept(s)).toEqual([]);
    s = run([{ type: "undo" }], s);
    expect(kept(s)).toEqual(["ba"]);
  });
});

describe("change an element's class (M89)", () => {
  const linked: Action[] = [
    ...base,
    { type: "add-node", id: "app", class: "application", name: "checkout.war" },
    { type: "add-edge", id: "e1", from: "ba", to: "svc" },
    { type: "add-edge", id: "e2", from: "svc", to: "app" },
    { type: "add-edge", id: "e3", from: "app", to: "host" },
    { type: "save-flow", flow: { id: "f1", name: "Order", steps: [{ edge: "e1" }, { edge: "e2" }, { edge: "e3" }] } },
  ];

  it("changes the class and its relationships in one undo step; a flow keeps the steps that still stand", () => {
    let s = run(linked);
    expect(s.present.edges.map((e) => e.type)).toEqual(["Uses::Used by", "Depends on::Used by", "Runs on::Runs"]);
    const before = s;
    s = run([{ type: "set-class", id: "app", class: "application_service" }], s);
    expect(s.present.nodes.find((n) => n.id === "app")!.class).toBe("application_service");
    expect(s.present.edges.map((e) => [e.id, e.type])).toEqual([["e1", "Uses::Used by"], ["e2", "Depends on::Used by"], ["e3", "Depends on::Used by"]]);
    expect(s.present.flows![0]!.steps).toHaveLength(3);
    expect(s.present.layout.app).toEqual(before.present.layout.app);
    expect(run([{ type: "undo" }], s).present).toEqual(before.present);

    // A class with no place for its relationships: they go, and the flow stops where the chain breaks.
    s = run([{ type: "set-class", id: "svc", class: "business_capability", at: { x: 16, y: 32 } }], before);
    expect(s.present.edges.map((e) => e.id)).toEqual(["e3"]);
    expect(s.present.flows![0]!.steps).toEqual([]);
    expect(s.present.layout.svc).toEqual({ x: 16, y: 32 });
    expect(run([{ type: "undo" }], s).present).toEqual(before.present);
  });

  it("is no step for the same class or an element that isn't there", () => {
    const s = run(linked);
    expect(run([{ type: "set-class", id: "app", class: "application" }], s)).toBe(s);
    expect(run([{ type: "set-class", id: "nope", class: "host" }], s)).toBe(s);
  });
});

describe("reverse a relationship (M90)", () => {
  const linked: Action[] = [
    ...base,
    { type: "add-node", id: "svc2", class: "application_service", name: "Payments" },
    { type: "add-edge", id: "e1", from: "ba", to: "svc" },
    { type: "add-edge", id: "e2", from: "svc", to: "svc2" },
    { type: "save-flow", flow: { id: "f1", name: "Order", steps: [{ edge: "e1" }, { edge: "e2" }] } },
  ];

  it("turns it round in one undo step; the flow that walks it is whole afterwards", () => {
    const before = run(linked);
    const s = run([{ type: "reverse-edge", id: "e2" }], before);
    expect(s.present.edges.find((e) => e.id === "e2")).toMatchObject({ from: "svc2", to: "svc", type: "Depends on::Used by" });
    expect(s.present.flows![0]!.steps).toEqual([{ edge: "e1" }, { edge: "e2", back: true }]);
    expect(run([{ type: "undo" }], s).present).toEqual(before.present);
  });

  it("is no step where CSDM has no relationship that way round, or for a relationship that isn't there", () => {
    const s = run(linked);
    expect(run([{ type: "reverse-edge", id: "e1" }], s)).toBe(s);
    expect(run([{ type: "reverse-edge", id: "nope" }], s)).toBe(s);
  });
});
