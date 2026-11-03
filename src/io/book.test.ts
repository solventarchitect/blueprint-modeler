import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import type { Flow } from "@/model";
import { bookContents, bookDecisions, bookElements, bookFlows, BOOK_SECTIONS } from "./book";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const order: Flow = { id: "f1", name: "Customer places an order", steps: [{ edge: "e6" }, { edge: "e9" }, { edge: "e12" }] };

describe("the model book (M76)", () => {
  it("has its sections in order", () => {
    expect(BOOK_SECTIONS).toEqual(["Picture", "The model by layer", "Elements", "Relationships", "Saved flows", "Decisions", "Health"]);
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

describe("the model book's decisions (M78)", () => {
  it("each decision with its status, date, the elements it concerns by name, and its text", () => {
    const m = { ...checkout(), decisions: [{ id: "d1", title: "Cache the catalog", status: "accepted" as const, date: "2026-10-30", decision: "Read-through cache.", elements: ["cap", "ba"] }, { id: "d2", title: "Retire ERP", status: "proposed" as const }] };
    const name = (id: string) => m.nodes.find((n) => n.id === id)!.name;
    expect(bookDecisions(m)).toEqual([
      { title: "Cache the catalog", meta: `Accepted · Oct 30, 2026 · Concerns ${[name("ba"), name("cap")].sort().join(", ")}`, parts: [["Decision", "Read-through cache."]] },
      { title: "Retire ERP", meta: "Proposed", parts: [] },
    ]);
  });
});

describe("the model book's contents (M81)", () => {
  it("every section with what it holds", () => {
    const m = { ...checkout(), flows: [order], decisions: [{ id: "d1", title: "X", status: "proposed" as const }] };
    expect(bookContents(m)).toEqual(["Picture", "The model by layer (5 layers)", "Elements (14)", "Relationships (13)", "Saved flows (1)", "Decisions (1)", "Health"]);
    expect(bookContents({ ...checkout(), nodes: [], edges: [], layout: {} })).toEqual(["Picture", "The model by layer", "Elements (none)", "Relationships (none)", "Saved flows (none)", "Decisions (none)", "Health"]);
  });
});

describe("the book of a part (M81 review)", () => {
  it("counts an element's relationships in the whole model, not just the part", () => {
    const whole = checkout();
    const part = { ...whole, nodes: whole.nodes.filter((n) => n.id === "ba"), edges: [], layout: { ba: whole.layout.ba! } };
    const rows = bookElements(part, whole).rows;
    expect(rows.map((r) => r.id)).toEqual(["ba"]);
    expect(Number(rows[0]!.relationships)).toBe(whole.edges.filter((e) => e.from === "ba" || e.to === "ba").length);
  });
});
