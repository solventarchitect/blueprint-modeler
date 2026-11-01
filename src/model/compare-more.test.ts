import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { compareModels, sameModel } from "./compare";
import type { Flow, Model, View } from "./schema";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const order: Flow = { id: "f1", name: "Customer places an order", steps: [{ edge: "e6" }, { edge: "e9" }, { edge: "e12" }] };
const prod: View = { id: "v1", name: "Production", filter: { environment: ["Production"] }, colorBy: "layer" };

describe("Compare sees the model's details (M72)", () => {
  it("name, date, description and artifact ID, before and after; the same model has none", () => {
    const base = checkout();
    expect(compareModels(base, base).details).toEqual([]);
    const now: Model = { ...base, name: "Checkout 2027", date: "2027-01-15", description: "Next year's checkout.", artifactId: "EA-0042" };
    const c = compareModels(now, base);
    // Not the name (another model's name differs by design); the date as set.
    expect(c.details.map((d) => d.field)).toEqual(["date", "description", "artifactId"]);
    expect(c.details.find((d) => d.field === "artifactId")).toEqual({ field: "artifactId", before: "BM-EX-001", after: "EA-0042" });
    expect(c.details.find((d) => d.field === "date")!.after).toBe("2027-01-15");
    expect(sameModel(c)).toBe(false);
  });
});

describe("Compare sees saved views (M72)", () => {
  it("added, removed and changed views, matched by id then by name; what changed is said in words", () => {
    const base = { ...checkout(), views: [prod, { id: "v2", name: "Owners", filter: {}, colorBy: "owner" as const }] };
    const now = {
      ...base,
      views: [
        { ...prod, name: "Prod", filter: { environment: ["Production", "Staging"], tags: ["Team A"] }, colorBy: "environment" as const, groupBy: "environment" as const },
        { id: "v3", name: "Retiring", filter: { plan: ["retiring"] }, colorBy: "layer" as const },
      ],
    };
    const c = compareModels(now, base);
    expect(c.views.added).toEqual([{ id: "v3", name: "Retiring" }]);
    expect(c.views.removed).toEqual([{ id: "v2", name: "Owners" }]);
    expect(c.views.changed).toEqual([
      {
        id: "v1",
        name: "Prod",
        changes: [
          { field: "Name", before: "Production", after: "Prod" },
          { field: "Filter", before: "Environment: Production", after: "Environment: Production, Staging; Tags: Team A" },
          { field: "Color by", before: "Layer", after: "Environment" },
          { field: "Group by", before: "None", after: "Environment" },
        ],
      },
    ]);
    // A view saved again under a new id but the same name is the same view.
    const reSaved = { ...base, views: [{ ...prod, id: "v9" }, base.views[1]!] };
    expect(sameModel(compareModels(reSaved, base))).toBe(true);
  });
});

describe("Compare sees saved flows (M72)", () => {
  it("added, removed and changed flows; steps compared by what they walk, not by ids", () => {
    const base = { ...checkout(), flows: [order] };
    expect(sameModel(compareModels(base, base))).toBe(true);
    const longer = { ...base, flows: [{ ...order, name: "Order placed", steps: [...order.steps, { edge: "e12", back: true as const }] }, { id: "f2", name: "Back", steps: [] }] };
    const c = compareModels(longer, base);
    expect(c.flows.added).toEqual([{ id: "f2", name: "Back" }]);
    expect(c.flows.changed).toEqual([
      {
        id: "f1",
        name: "Order placed",
        changes: [
          { field: "Name", before: "Customer places an order", after: "Order placed" },
          { field: "Steps", before: "3 steps", after: "4 steps, the walk differs from step 4" },
        ],
      },
    ]);
    expect(compareModels(base, longer).flows.removed).toEqual([{ id: "f2", name: "Back" }]);
    // The same walk under other relationship ids (a model rebuilt from a file) is not a change.
    const renumbered = { ...base, edges: base.edges.map((e) => ({ ...e, id: `r${e.id}` })), flows: [{ ...order, steps: order.steps.map((s) => ({ edge: `r${s.edge}` })) }] };
    expect(compareModels(renumbered, base).flows.changed).toEqual([]);
  });
});

describe("Compare's details, views and flows: the cases around them (M72 review)", () => {
  it("another model with another name, or undated copies made on other days, are not a change to the details", () => {
    const base = checkout();
    const copy = { ...base, id: "m2", name: "Another name", created: "2027-03-01T00:00:00.000Z", date: undefined };
    expect(compareModels(copy, { ...base, date: undefined }).details).toEqual([]);
    expect(compareModels({ ...base, date: "2027-01-15" }, { ...base, date: undefined }).details).toEqual([{ field: "date", before: "", after: "2027-01-15" }]);
  });

  it("renaming an element a flow walks through is not a change to the flow", () => {
    const base = { ...checkout(), flows: [order] };
    const renamed = { ...base, nodes: base.nodes.map((n) => (n.name === "Checkout web app" ? { ...n, name: "Checkout web app v2" } : n)) };
    expect(compareModels(renamed, base).flows.changed).toEqual([]);
    // The same count, a different walk: said as such.
    const turned = { ...base, flows: [{ ...order, steps: [order.steps[0]!, order.steps[1]!, { edge: "e9", back: true as const }] }] };
    expect(compareModels(turned, base).flows.changed[0]!.changes).toEqual([{ field: "Steps", before: "3 steps", after: "3 steps, the walk differs from step 3" }]);
  });

  it("id comes before name; same-named views match one to one; a filter's values in a new order are not a change", () => {
    const v = (id: string, name: string, environment: string[] = []): View => ({ id, name, filter: { environment }, colorBy: "layer" });
    const base = { ...checkout(), views: [v("v1", "Prod"), v("v2", "Owners")] };
    const now = { ...base, views: [v("v1", "Owners"), v("v3", "Prod")] };
    const c = compareModels(now, base);
    expect(c.views.changed.map((x) => x.id)).toEqual(["v1"]);
    expect(c.views.removed).toEqual([{ id: "v2", name: "Owners" }]);
    expect(c.views.added).toEqual([{ id: "v3", name: "Prod" }]);
    const twice = { ...base, views: [v("a", "Same", ["A", "B"]), v("b", "Same", [""])] };
    const again = { ...base, views: [v("x", "Same", ["B", "A"]), v("y", "Same", [""])] };
    expect(sameModel(compareModels(again, twice))).toBe(true);
  });
});

describe("a view's filter in words (M72)", () => {
  it("names every kind of filter, in a fixed order", async () => {
    const { filterText } = await import("./compare");
    expect(filterText({})).toBe("All elements");
    expect(filterText({ layers: ["infrastructure", "business"], classes: ["business_capability"], lifecycle: [""], owner: ["Ana"], plan: ["retiring", "live"], tags: ["b", "a"] })).toBe(
      "Layer: Business, Infrastructure; Class: Business Capability; Life cycle stage: Not set; Owner: Ana; Plan status: Live, Retiring; Tags: a, b",
    );
  });
});
