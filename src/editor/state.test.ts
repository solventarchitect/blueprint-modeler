import { describe, expect, it } from "vitest";
import { createModel } from "@/model";
import { connectionProblem, initialHistory, laneY, reduce, type Action, type History } from "./state";

const T = "2026-09-27T12:00:00.000Z";
const now = () => T;
const run = (actions: Action[], start: History = initialHistory(createModel("M", new Date(T), "m"))) =>
  actions.reduce((s, a) => reduce(s, a, now), start);

const base: Action[] = [
  { type: "add-node", id: "ba", class: "business_application", name: "Checkout" },
  { type: "add-node", id: "svc", class: "application_service", name: "Checkout — prod" },
  { type: "add-node", id: "host", class: "host", name: "web-01" },
];

describe("editor state", () => {
  it("places new elements in their layer lane, left to right", () => {
    const s = run([...base, { type: "add-node", id: "ba2", class: "business_application", name: "Billing" }]);
    expect(s.present.layout.ba).toEqual({ x: 0, y: laneY.design });
    expect(s.present.layout.ba2).toEqual({ x: 288, y: laneY.design });
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

  it("stamps updated on change", () => {
    const s = run(base);
    expect(s.present.updated).toBe(T);
  });
});
