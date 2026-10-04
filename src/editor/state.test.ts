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

  it("stamps updated on change", () => {
    const s = run(base);
    expect(s.present.updated).toBe(T);
  });
});
