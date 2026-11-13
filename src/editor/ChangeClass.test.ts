import { describe, expect, it } from "vitest";
import { createModel, type Model } from "@/model";
import { classChangeSaid, classChangeWords } from "./ChangeClass";

// M89: the words the dialog and the status line use for what a class change does.
function m(): Model {
  return {
    ...createModel("Payroll", new Date("2026-11-13T00:00:00Z"), "m1"),
    nodes: [
      { id: "cap", class: "business_capability", name: "Pay people" },
      { id: "ba", class: "business_application", name: "Payroll" },
      { id: "svc", class: "application_service", name: "Payroll production" },
      { id: "app", class: "application", name: "payroll.war" },
      { id: "host", class: "host", name: "web-01" },
      { id: "io", class: "information_object", name: "Pay data" },
    ],
    edges: [
      { id: "e1", from: "cap", to: "ba", type: "Provided by::Provides" },
      { id: "e2", from: "ba", to: "svc", type: "Uses::Used by" },
      { id: "e3", from: "svc", to: "app", type: "Depends on::Used by" },
      { id: "e4", from: "app", to: "host", type: "Runs on::Runs" },
      { id: "e5", from: "ba", to: "io", type: "reference:information_object" },
    ],
  };
}

describe("change class, in words (M89)", () => {
  it("the status sentence names relationships once, on its first part, whatever that part is", () => {
    expect(classChangeSaid(classChangeWords(m(), "app", "application_service")!)).toBe("1 relationship kept, 1 given a new type.");
    expect(classChangeSaid(classChangeWords(m(), "host", "business_capability")!)).toBe("1 relationship removed.");
    expect(classChangeSaid(classChangeWords(m(), "ba", "application")!)).toBe("3 relationships removed.");
    expect(classChangeSaid(classChangeWords(m(), "io", "product_model")!)).toBe("1 relationship given a new type.");
    const alone: Model = { ...m(), edges: [] };
    expect(classChangeSaid(classChangeWords(alone, "host", "application")!)).toBe("It had no relationships.");
  });

  it("says when a saved flow is cut short", () => {
    const model: Model = { ...m(), flows: [{ id: "f1", name: "Pay run", steps: [{ edge: "e1" }, { edge: "e2" }] }] };
    expect(classChangeSaid(classChangeWords(model, "ba", "application")!)).toBe("3 relationships removed. 1 saved flow cut short.");
  });

  it("two reference fields are told apart by their field, not both called “reference”", () => {
    expect(classChangeWords(m(), "io", "product_model")!.retyped).toEqual(["“Payroll” → “Pay data”: reference (information_object) becomes reference (model_id)"]);
    expect(classChangeWords(m(), "app", "application_service")!.retyped).toEqual(["“payroll.war” → “web-01”: Runs on becomes Depends on"]);
  });
});
