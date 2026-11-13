import { describe, expect, it } from "vitest";
import { classChange, createModel, withClass, type Model } from "./index";

// M89: an element changes class; its relationships are kept where CSDM still allows one between the two.
function m(): Model {
  return {
    ...createModel("Payroll", new Date("2026-11-13T00:00:00Z"), "m1"),
    nodes: [
      { id: "cap", class: "business_capability", name: "Pay people" },
      { id: "ba", class: "business_application", name: "Payroll", attrs: { owner: "HR" }, tags: ["Team A"] },
      { id: "svc", class: "application_service", name: "Payroll — production" },
      { id: "app", class: "application", name: "payroll.war" },
      { id: "host", class: "host", name: "web-01" },
    ],
    edges: [
      { id: "e1", from: "cap", to: "ba", type: "Provided by::Provides" },
      { id: "e2", from: "ba", to: "svc", type: "Uses::Used by" },
      { id: "e3", from: "svc", to: "app", type: "Depends on::Used by" },
      { id: "e4", from: "app", to: "host", type: "Runs on::Runs" },
    ],
    layout: { cap: { x: 0, y: 0 }, ba: { x: 0, y: 240 }, svc: { x: 0, y: 480 }, app: { x: 0, y: 720 }, host: { x: 0, y: 960 } },
  };
}
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("change an element's class (M89)", () => {
  it("keeps a relationship CSDM allows as it is, and gives one a new type where the two still relate another way", () => {
    const c = classChange(m(), "app", "application_service")!;
    expect(ids(c.kept)).toEqual(["e3"]);
    expect(c.retyped).toEqual([{ edge: m().edges[3], type: "Depends on::Used by" }]);
    expect(c.removed).toEqual([]);
    const after = withClass(m(), "app", "application_service");
    expect(after.nodes.find((n) => n.id === "app")).toEqual({ id: "app", class: "application_service", name: "payroll.war" });
    expect(after.edges).toEqual([m().edges[0], m().edges[1], m().edges[2], { id: "e4", from: "app", to: "host", type: "Depends on::Used by" }]);
    expect(after.layout).toEqual(m().layout);
  });

  it("removes the relationships CSDM has no place for, in either direction it was drawn", () => {
    const c = classChange(m(), "ba", "application")!;
    expect(c.kept).toEqual([]);
    expect(c.retyped).toEqual([]);
    expect(c.removed.map((r) => [r.edge.id, r.why])).toEqual([
      ["e1", "not-allowed"],
      ["e2", "not-allowed"],
    ]);
    const after = withClass(m(), "ba", "application");
    expect(ids(after.edges)).toEqual(["e3", "e4"]);
    // Everything else about the element stays: name, properties, tags, position.
    expect(after.nodes.find((n) => n.id === "ba")).toEqual({ id: "ba", class: "application", name: "Payroll", attrs: { owner: "HR" }, tags: ["Team A"] });
  });

  it("an older type the new pair still accepts is kept as written; a new type that would repeat another relationship is removed", () => {
    const model = m();
    model.edges.push({ id: "e5", from: "app", to: "host", type: "Depends on::Used by" }, { id: "e6", from: "ba", to: "svc", type: "Consumes::Consumed by" });
    const c = classChange(model, "app", "application_service")!;
    expect(ids(c.kept)).toEqual(["e3", "e5"]);
    expect(c.retyped).toEqual([]);
    expect(c.removed.map((r) => [r.edge.id, r.why])).toEqual([["e4", "duplicate"]]);
    // e6, an older type between Business Application and Application Service, is not this element's: untouched.
    expect(ids(withClass(model, "app", "application_service").edges)).toEqual(["e1", "e2", "e3", "e5", "e6"]);
  });

  it("a relationship from an element to itself follows both ends", () => {
    const model: Model = { ...m(), nodes: [{ id: "s", class: "application_service", name: "S" }], edges: [{ id: "e", from: "s", to: "s", type: "Depends on::Used by" }], layout: { s: { x: 0, y: 0 } } };
    expect(classChange(model, "s", "business_capability")!.retyped).toEqual([{ edge: model.edges[0], type: "reference:parent" }]);
    expect(classChange(model, "s", "host")!.removed.map((r) => r.why)).toEqual(["not-allowed"]);
  });

  it("nothing to do for the same class, an unknown class or an unknown element", () => {
    expect(classChange(m(), "app", "application")).toBeNull();
    expect(classChange(m(), "app", "mainframe")).toBeNull();
    expect(classChange(m(), "nope", "host")).toBeNull();
    const model = m();
    expect(withClass(model, "app", "application")).toBe(model);
  });
});
