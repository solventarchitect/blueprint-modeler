import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { compareModels, sameModel } from "./compare";
import { decisionCounts, decisionLinks, decisionsAbout, decisionsSupersededBy, DECISION_STATUS_LABEL, replacementChoices, withKnownDecisionElements, withKnownDecisionLinks } from "./decisions";
import { decisionSchema, MAX_DECISIONS, modelSchema, parseModel, serializeModel, type Decision, type Model } from "./index";

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

describe("decision counts (M80)", () => {
  it("how many decisions concern each element; elements with none are absent", () => {
    const m: Model = { ...checkout(), decisions: [cache, { id: "d2", title: "Other", status: "proposed", elements: ["cap"] }, { id: "d3", title: "None", status: "accepted" }] };
    const counts = decisionCounts(m);
    expect(Object.fromEntries(counts)).toEqual({ ba: 1, cap: 2 });
    expect(decisionCounts(checkout()).size).toBe(0);
  });
});

describe("decision links (M85, still format 1)", () => {
  const cdn: Decision = { id: "d2", title: "Serve the catalog from a CDN", status: "accepted" };
  const old: Decision = { ...cache, status: "superseded", supersededBy: "d2" };
  const linked = (): Model => ({ ...checkout(), decisions: [old, cdn] });

  it("round-trip, with supersededBy right after the status; ignored by 1.22's reader", () => {
    const m = linked();
    const r = roundTrip(m);
    expect(r.ok && r.model).toEqual(m);
    // Once read (as the reducer saves it too), the file has it right after the status.
    expect(r.ok && Object.keys(JSON.parse(serializeModel(r.model)).decisions[0]).slice(0, 4)).toEqual(["id", "title", "status", "supersededBy"]);
    const older = modelSchema.extend({ decisions: decisionSchema.omit({ supersededBy: true }).array().optional() });
    const parsed = older.safeParse(JSON.parse(serializeModel(m)));
    expect(parsed.success && parsed.data.decisions?.[0]).not.toHaveProperty("supersededBy");
  });

  it("a link is dropped, not the decision, when it isn't Superseded, names itself or a missing decision, or loops back", () => {
    const file = JSON.parse(serializeModel(checkout()));
    const r = parseModel({
      ...file,
      decisions: [
        { ...cache, id: "a", status: "accepted", supersededBy: "b" },
        { ...cache, id: "b", status: "superseded", supersededBy: "b" },
        { ...cache, id: "c", status: "superseded", supersededBy: "gone" },
        { ...cache, id: "d", status: "superseded", supersededBy: "e" },
        { ...cache, id: "e", status: "superseded", supersededBy: "d" },
        { ...cache, id: "f", status: "superseded", supersededBy: "a" },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const links = Object.fromEntries(r.model.decisions!.map((d) => [d.id, d.supersededBy ?? null]));
    // d and e point at each other: the first keeps its link, the one closing the loop loses it.
    expect(links).toEqual({ a: null, b: null, c: null, d: "e", e: null, f: "a" });
    expect(withKnownDecisionLinks(linked())).toEqual(linked());
  });

  it("Supersedes and Superseded by, both ways; what can replace a decision leaves out itself and what it replaces", () => {
    const m: Model = { ...checkout(), decisions: [{ ...old, id: "a", supersededBy: "b" }, { ...cdn, id: "b", status: "superseded", supersededBy: "c" }, { ...cdn, id: "c", title: "Edge cache" }, { ...cdn, id: "x", title: "Other" }] };
    expect(decisionsSupersededBy(m, "b").map((d) => d.id)).toEqual(["a"]);
    expect(decisionsSupersededBy(m, "x")).toEqual([]);
    expect(replacementChoices(m, "b").map((d) => d.id)).toEqual(["c", "x"]);
    expect(replacementChoices(m, "c").map((d) => d.id)).toEqual(["x"]);
    expect(decisionLinks(m, m.decisions![1]!)).toEqual(["Superseded by “Edge cache”", "Supersedes “Cache the product catalog”"]);
    expect(decisionLinks(m, m.decisions![3]!)).toEqual([]);
  });

  it("a link this version can't read is dropped, not the decision; a read decision keeps the saved key order", () => {
    const file = JSON.parse(serializeModel(checkout()));
    for (const bad of [null, "", 7, "x".repeat(65)]) {
      const r = parseModel({ ...file, decisions: [{ ...old, supersededBy: bad }, cdn] });
      expect(r.ok && r.model.decisions).toEqual([{ ...cache, status: "superseded" }, cdn]);
    }
    const r = parseModel({ ...file, decisions: [{ elements: ["ba"], date: "2026-10-30", decision: "D", supersededBy: "d2", status: "superseded", title: "T", id: "d1" }, cdn] });
    expect(r.ok && Object.keys(r.model.decisions![0]!)).toEqual(["id", "title", "status", "supersededBy", "date", "decision", "elements"]);
  });

  it("Compare: renaming the replacement is not a change to the decisions it replaced", () => {
    const base = linked();
    const now: Model = { ...base, decisions: [old, { ...cdn, title: "Serve it from a CDN" }] };
    expect(compareModels(now, base).decisions.changed.map((c) => c.id)).toEqual(["d2"]);
  });

  it("Compare names a changed successor by its title", () => {
    const base = linked();
    const now: Model = { ...base, decisions: [{ ...old, supersededBy: "d3" }, cdn, { id: "d3", title: "Edge cache", status: "accepted" }] };
    expect(compareModels(now, base).decisions.changed).toEqual([{ id: "d1", name: "Cache the product catalog", changes: [{ field: "Superseded by", before: "Serve the catalog from a CDN", after: "Edge cache" }] }]);
  });
});
