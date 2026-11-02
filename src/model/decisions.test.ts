import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { compareModels, sameModel } from "./compare";
import { decisionsAbout, DECISION_STATUS_LABEL, withKnownDecisionElements } from "./decisions";
import { MAX_DECISIONS, modelSchema, parseModel, serializeModel, type Decision, type Model } from "./index";

// M78: architecture decision records kept with the model.
const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const cache: Decision = {
  id: "d1",
  title: "Cache the product catalog",
  status: "accepted",
  date: "2026-10-30",
  context: "Catalog reads dominate checkout traffic.",
  decision: "Put a read-through cache in front of the catalog.",
  consequences: "Prices can be a minute stale.",
  elements: ["ba", "cap"],
};
const roundTrip = (m: Model) => parseModel(JSON.parse(serializeModel(m)));

describe("decisions in the model file (M78, still format 1)", () => {
  it("round-trip exactly, after the flows; none means no key, so older files stay byte-identical", () => {
    const m: Model = { ...checkout(), decisions: [cache, { id: "d2", title: "Retire the legacy ERP", status: "proposed" }] };
    const r = roundTrip(m);
    expect(r.ok && r.model).toEqual(m);
    expect(Object.keys(JSON.parse(serializeModel(m))).at(-1)).toBe("decisions");
    expect(serializeModel(checkout())).not.toContain("decisions");
  });

  it("are ignored, not refused, by 1.19's reader", () => {
    const older = modelSchema.omit({ decisions: true });
    const parsed = older.safeParse(JSON.parse(serializeModel({ ...checkout(), decisions: [cache] })));
    expect(parsed.success).toBe(true);
    expect(parsed.success && "decisions" in parsed.data).toBe(false);
  });

  it("drop a decision this version can't read, a repeated id, and past the limit; not the file", () => {
    const file = JSON.parse(serializeModel(checkout()));
    const r = parseModel({
      ...file,
      decisions: [
        cache,
        { ...cache, title: "Same id again" },
        { id: "d3", title: "", status: "accepted" },
        { id: "d4", title: "Unknown status", status: "rejected" },
        { id: "d5", title: "Bad date kept without it", status: "superseded", date: "next week" },
        ...Array.from({ length: MAX_DECISIONS + 5 }, (_, i) => ({ id: `x${i}`, title: `D${i}`, status: "proposed" })),
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.model.decisions).toHaveLength(MAX_DECISIONS);
    expect(r.model.decisions!.slice(0, 2)).toEqual([cache, { id: "d5", title: "Bad date kept without it", status: "superseded" }]);
  });

  it("keep only elements that are in the model, each once", () => {
    const m: Model = { ...checkout(), decisions: [{ ...cache, elements: ["ba", "gone", "ba", "cap"] }] };
    const r = roundTrip(m);
    expect(r.ok && r.model.decisions?.[0]?.elements).toEqual(["ba", "cap"]);
    expect(withKnownDecisionElements(checkout())).toEqual(checkout());
  });
});

describe("decisions about an element (M78)", () => {
  it("lists the decisions that concern it, in the model's order, with their status named", () => {
    const m: Model = { ...checkout(), decisions: [cache, { id: "d2", title: "Other", status: "proposed", elements: ["data"] }] };
    expect(decisionsAbout(m, "cap").map((d) => d.id)).toEqual(["d1"]);
    expect(decisionsAbout(m, "nope")).toEqual([]);
    expect(DECISION_STATUS_LABEL).toEqual({ proposed: "Proposed", accepted: "Accepted", superseded: "Superseded" });
  });
});

describe("Compare sees decisions (M78)", () => {
  it("added, removed and changed, matched by id then title; what changed in words", () => {
    const base: Model = { ...checkout(), decisions: [cache, { id: "d2", title: "Retire the legacy ERP", status: "proposed" }] };
    expect(sameModel(compareModels(base, base))).toBe(true);
    const now: Model = { ...base, decisions: [{ ...cache, status: "superseded", elements: ["ba"], consequences: "" }, { id: "d3", title: "Use one identity provider", status: "accepted" }] };
    const c = compareModels(now, base);
    expect(c.decisions.added).toEqual([{ id: "d3", name: "Use one identity provider" }]);
    expect(c.decisions.removed).toEqual([{ id: "d2", name: "Retire the legacy ERP" }]);
    const names = (ids: string[]) => ids.map((i) => base.nodes.find((n) => n.id === i)!.name).sort().join(", ");
    expect(c.decisions.changed).toEqual([
      {
        id: "d1",
        name: "Cache the product catalog",
        changes: [
          { field: "Status", before: "Accepted", after: "Superseded" },
          { field: "Consequences", before: "Prices can be a minute stale.", after: "" },
          { field: "Elements", before: names(["ba", "cap"]), after: names(["ba"]) },
        ],
      },
    ]);
    expect(sameModel(c)).toBe(false);
  });

  it("a renamed element is not a change to the decisions about it", () => {
    const base: Model = { ...checkout(), decisions: [cache] };
    const renamed: Model = { ...base, nodes: base.nodes.map((n) => (n.id === "ba" ? { ...n, name: "Checkout 2" } : n)) };
    expect(compareModels(renamed, base).decisions.changed).toEqual([]);
  });
});
