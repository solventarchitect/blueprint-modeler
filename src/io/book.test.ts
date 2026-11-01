import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import type { Flow } from "@/model";
import { bookElements, bookFlows, BOOK_SECTIONS } from "./book";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const order: Flow = { id: "f1", name: "Customer places an order", steps: [{ edge: "e6" }, { edge: "e9" }, { edge: "e12" }] };

describe("the model book (M76)", () => {
  it("has its sections in order", () => {
    expect(BOOK_SECTIONS).toEqual(["Picture", "The model by layer", "Elements", "Relationships", "Saved flows", "Health"]);
  });

  it("lists each saved flow with its start and steps in words, in the model's order", () => {
    const m = { ...checkout(), flows: [order, { id: "f2", name: "Empty", steps: [] }] };
    expect(bookFlows(m)).toEqual([
      {
        name: "Customer places an order",
        start: "Online shopping — North America",
        steps: [
          "Online shopping — North America → Checkout — production (Depends on)",
          "Checkout — production → Checkout web app (Depends on)",
          "Checkout web app → web-prod-01 (Runs on)",
        ],
      },
      { name: "Empty", start: "", steps: [] },
    ]);
    expect(bookFlows(checkout())).toEqual([]);
  });
});

describe("the model book's elements table (M76 review)", () => {
  it("by layer then name; columns no element fills are left out", () => {
    const m = checkout();
    const { columns, rows } = bookElements(m);
    expect(rows[0]!.layer).toBe("Business");
    expect(rows.at(-1)!.layer).toBe("Infrastructure");
    expect(columns.map((c) => c.key)).toEqual(["name", "cls", "layer", "relationships", "hints"]);
    const owned = { ...m, nodes: m.nodes.map((n, i) => (i === 0 ? { ...n, attrs: { owner: "Ana" }, plan: "planned" as const } : n)) };
    expect(bookElements(owned).columns.map((c) => c.key)).toEqual(["name", "cls", "layer", "owner", "relationships", "hints", "plan"]);
  });

  it("a flow without a name is named", () => {
    expect(bookFlows({ ...checkout(), flows: [{ id: "f", name: "", steps: [] }] })[0]!.name).toBe("Untitled flow");
  });
});
