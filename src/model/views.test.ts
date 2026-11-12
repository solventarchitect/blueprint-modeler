import { describe, expect, it } from "vitest";
import { filterText } from "./compare";
import { createModel, viewFilterSchema, viewSchema, type Model } from "./index";
import { ALL_ELEMENTS, COLORINGS, filterActive, inView, legend, MARKERS, PALETTE, slotMap, slotOf, coloringWords, storedColorBy, valueLabels, viewColorBy } from "./views";

function m(): Model {
  const model = createModel("T", new Date("2026-09-27T00:00:00Z"), "t");
  model.nodes = [
    { id: "cap", class: "business_capability", name: "Orders", attrs: { lifecycle: "Operational", owner: "Ann" } },
    { id: "ba", class: "business_application", name: "Checkout", attrs: { lifecycle: "Design", owner: "Ann" } },
    { id: "svc", class: "application_service", name: "Checkout — prod", attrs: { lifecycle: "Operational", environment: "Production", owner: " Bo " } },
    { id: "svc2", class: "application_service", name: "Checkout — test", attrs: { environment: "Test" } },
    { id: "host", class: "host", name: "web-01" },
  ];
  model.layout = Object.fromEntries(model.nodes.map((n, i) => [n.id, { x: i * 300, y: 0 }]));
  return model;
}
const ids = (model: Model, f: Parameters<typeof inView>[1]) => model.nodes.filter((n) => inView(n, f, model)).map((n) => n.id);

describe("filters (M54)", () => {
  it("show everything with no filter, and say so", () => {
    expect(ids(m(), ALL_ELEMENTS.filter)).toEqual(["cap", "ba", "svc", "svc2", "host"]);
    expect(filterActive(ALL_ELEMENTS.filter)).toBe(false);
    expect(filterActive({ layers: [] })).toBe(false);
  });

  it("match any value within one dimension, and every dimension at once", () => {
    expect(ids(m(), { lifecycle: ["Operational", "Design"] })).toEqual(["cap", "ba", "svc"]);
    expect(ids(m(), { lifecycle: ["Operational"], layers: ["service"] })).toEqual(["svc"]);
    expect(ids(m(), { classes: ["application_service"], environment: ["Test"] })).toEqual(["svc2"]);
    expect(filterActive({ classes: ["host"] })).toBe(true);
  });

  it("treat the empty value as Not set, and compare owners and environments trimmed", () => {
    expect(ids(m(), { lifecycle: [""] })).toEqual(["svc2", "host"]);
    expect(ids(m(), { owner: ["Bo"] })).toEqual(["svc"]);
    expect(ids(m(), { environment: [""] })).toEqual(["cap", "ba", "host"]);
  });
});

describe("legend and color slots (M54)", () => {
  it("lists life cycle stages in CSDM order, then Not set, with counts in the view", () => {
    const l = legend(m(), "lifecycle", {});
    expect(l.map((e) => [e.label, e.count])).toEqual([["Design", 1], ["Operational", 2], ["Not set", 2]]);
    expect(l.at(-1)!.slot).toBe("none");
    const filtered = legend(m(), "lifecycle", { layers: ["service"] });
    expect(filtered.map((e) => [e.label, e.count])).toEqual([["Design", 0], ["Operational", 1], ["Not set", 1]]);
  });

  it("orders environments and owners by how many elements carry them, then by name", () => {
    expect(legend(m(), "owner", {}).map((e) => e.label)).toEqual(["Ann", "Bo", "Not set"]);
    expect(legend(m(), "environment", {}).map((e) => e.label)).toEqual(["Production", "Test", "Not set"]);
  });

  it("keeps a value's color when a filter changes the counts", () => {
    const all = legend(m(), "lifecycle", {});
    const some = legend(m(), "lifecycle", { layers: ["service"] });
    expect(some.map((e) => e.slot)).toEqual(all.map((e) => e.slot));
    expect(slotOf(m(), "lifecycle", m().nodes[0]!)).toBe(all.find((e) => e.value === "Operational")!.slot);
  });

  it("gives at most one color per palette slot, then Other", () => {
    const big = m();
    big.nodes = Array.from({ length: PALETTE.dark.length + 2 }, (_, i) => ({ id: `n${i}`, class: "host", name: `h${i}`, attrs: { owner: `Owner ${String(i).padStart(2, "0")}` } }));
    const slots = legend(big, "owner", {}).map((e) => e.slot);
    expect(slots.slice(0, PALETTE.dark.length)).toEqual(PALETTE.dark.map((_, i) => i));
    expect(slots.slice(PALETTE.dark.length)).toEqual(["other"]);
    // The values past the palette look alike, so the legend gives them one row.
    expect(legend(big, "owner", {}).at(-1)).toMatchObject({ key: "(other)", label: "Other (2 values)", count: 2 });
  });

  it("has nothing to list when coloring by layer", () => {
    expect(legend(m(), "layer", {})).toEqual([]);
  });

  it("has a distinct marker shape for every color, plus Other and Not set", () => {
    expect(MARKERS.slots).toHaveLength(PALETTE.dark.length);
    expect(new Set([...MARKERS.slots, MARKERS.other, MARKERS.none]).size).toBe(PALETTE.dark.length + 2);
  });
});

describe("palette contrast (WCAG 1.4.11: 3:1 against the element's own surface)", () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x! + 0.05) / (y! + 0.05);
  };
  it("every slot color reaches 3:1 on the node surface in both themes", () => {
    for (const [theme, node] of [["dark", "#172738"], ["light", "#ffffff"]] as const) {
      for (const c of [...PALETTE[theme], PALETTE.other[theme]]) expect(ratio(c, node), `${theme} ${c}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("canvas tokens match the export palette", () => {
  it("defines --slot-* in globals.css with the same hex as PALETTE, dark and light (both light blocks)", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const blocks = css.split(/\/\* Color by \(M54\)/).slice(1).map((b) => Object.fromEntries([...b.matchAll(/--slot-(\w+): (#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]])));
    expect(blocks).toHaveLength(3);
    const want = (t: "dark" | "light") => ({ ...Object.fromEntries(PALETTE[t].map((c, i) => [String(i), c])), other: PALETTE.other[t], none: PALETTE.none[t] });
    expect(blocks[0]).toEqual(want("dark"));
    expect(blocks[1]).toEqual(want("light"));
    expect(blocks[2]).toEqual(want("light"));
  });
});

describe("color by plan status and by tag (M77)", () => {
  function planned(): Model {
    const model = m();
    model.nodes[1]!.plan = "planned";
    model.nodes[3]!.plan = "retiring";
    model.nodes[0]!.tags = ["Team A", "Payments"];
    model.nodes[1]!.tags = ["team a"];
    model.nodes[2]!.tags = ["Payments"];
    return model;
  }

  it("lists plan statuses in a fixed order, each with its own color whichever states are present", () => {
    const l = legend(planned(), "plan", {});
    expect(l.map((e) => [e.label, e.count, e.slot])).toEqual([["Live", 3, 0], ["Planned", 1, 1], ["Retiring", 1, 2]]);
    const noLive = planned();
    noLive.nodes = noLive.nodes.filter((n) => n.plan);
    expect(legend(noLive, "plan", {}).map((e) => [e.label, e.slot])).toEqual([["Planned", 1], ["Retiring", 2]]);
    expect(slotOf(planned(), "plan", planned().nodes[3]!)).toBe(2);
  });

  it("colors by an element's first tag, ignoring case (the first spelling wins), Not tagged last", () => {
    const l = legend(planned(), "tag", {});
    expect(l.map((e) => [e.label, e.count])).toEqual([["Team A", 2], ["Payments", 1], ["Not tagged", 2]]);
    expect(slotOf(planned(), "tag", planned().nodes[1]!)).toBe(slotOf(planned(), "tag", planned().nodes[0]!));
    expect(slotOf(planned(), "tag", planned().nodes[4]!)).toBe("none");
  });

  it("names each element's value for the screen reader label", () => {
    const model = planned();
    expect(model.nodes.map(valueLabels(model, "plan"))).toEqual(["Live", "Planned", "Live", "Retiring", "Live"]);
    expect(model.nodes.map(valueLabels(model, "tag"))).toEqual(["Team A", "Team A", "Payments", "Not tagged", "Not tagged"]);
    expect(model.nodes.map(valueLabels(model, "owner"))).toEqual(["Ann", "Ann", "Bo", "Not set", "Not set"]);
  });

  it("stores the new colorings beside one older versions know, and reads them back", () => {
    expect(storedColorBy("plan")).toEqual({ colorBy: "layer", colorByExt: "plan" });
    expect(storedColorBy("tag")).toEqual({ colorBy: "layer", colorByExt: "tag" });
    expect(storedColorBy("owner")).toEqual({ colorBy: "owner" });
    expect(viewColorBy({ colorBy: "layer", colorByExt: "tag" })).toBe("tag");
    expect(viewColorBy({ colorBy: "owner" })).toBe("owner");
    expect(COLORINGS).toEqual(["layer", "lifecycle", "environment", "owner", "plan", "tag"]);
  });
});

describe("filter by decisions (M88)", () => {
  const decided = (): Model => ({ ...m(), decisions: [{ id: "d1", title: "Move to the cloud", status: "accepted", elements: ["ba", "svc"] }, { id: "d2", title: "Retire web-01", status: "proposed", elements: ["svc"] }] });

  it("keeps the elements a decision concerns, or those none does, or both", () => {
    const model = decided();
    expect(ids(model, { decisions: ["with"] })).toEqual(["ba", "svc"]);
    expect(ids(model, { decisions: ["without"] })).toEqual(["cap", "svc2", "host"]);
    expect(ids(model, { decisions: ["with", "without"] })).toEqual(["cap", "ba", "svc", "svc2", "host"]);
    expect(ids(model, { decisions: ["with"], environment: ["Production"] })).toEqual(["svc"]);
    expect(filterActive({ decisions: ["with"] })).toBe(true);
    // A model without decisions: Has decisions keeps nothing, and the same filter object works on any model.
    expect(ids(m(), { decisions: ["with"] })).toEqual([]);
  });

  it("is optional in format 1; a value this version doesn't know is dropped, not the view", () => {
    const parsed = viewFilterSchema.parse({ decisions: ["with", "sometimes", 3, "with"] });
    expect(parsed.decisions).toEqual(["with"]);
    expect(viewFilterSchema.parse({ decisions: ["nope"] })).not.toHaveProperty("decisions", expect.anything());
    expect(viewFilterSchema.parse({}).decisions).toBeUndefined();
  });

  it("is said in words, as Compare and images show a filter", () => {
    expect(filterText({ decisions: ["without", "with"] })).toBe("Decisions: Has decisions, No decisions");
  });
});

describe("color by chosen tags (M86)", () => {
  function tagged(): Model {
    const model = m();
    model.nodes[0]!.tags = ["Payments", "Team A"];
    model.nodes[1]!.tags = ["team a"];
    model.nodes[2]!.tags = ["Cost Center 7", "team b"];
    model.nodes[3]!.tags = ["Payments"];
    return model;
  }

  it("an element takes its first tag that is chosen (ignoring case); the legend follows the chosen order", () => {
    const model = tagged();
    const chosen = ["Team B", "team a"];
    expect(model.nodes.map(valueLabels(model, "tag", chosen))).toEqual(["Team A", "Team A", "team b", "None of these tags", "None of these tags"]);
    expect(legend(model, "tag", {}, chosen).map((e) => [e.label, e.count])).toEqual([["team b", 1], ["Team A", 2], ["None of these tags", 2]]);
    const slot = slotMap(model, "tag", chosen)!;
    expect(slot(model.nodes[2]!)).toBe(0);
    expect(slot(model.nodes[0]!)).toBe(1);
    expect(slot(model.nodes[3]!)).toBe("none");
    expect(slotOf(model, "tag", model.nodes[1]!, chosen)).toBe(1);
  });

  it("with none chosen, or a chosen tag no element carries, it colors as before; other colorings ignore the choice", () => {
    const model = tagged();
    expect(legend(model, "tag", {}, []).map((e) => e.label)).toEqual(legend(model, "tag", {}).map((e) => e.label));
    expect(legend(model, "tag", {}, ["Nobody"]).map((e) => [e.label, e.count])).toEqual([["None of these tags", 5]]);
    expect(legend(model, "lifecycle", {}, ["Team A"])).toEqual(legend(model, "lifecycle", {}));
  });

  it("a chosen tag keeps its color when one before it is on no element any more", () => {
    const model = tagged();
    const chosen = ["Team A", "Team B"];
    const before = slotMap(model, "tag", chosen)!;
    expect(before(model.nodes[2]!)).toBe(1);
    // Team A comes off every element: Team B is still the second chosen tag, and keeps its color.
    model.nodes[0]!.tags = ["Payments"];
    model.nodes[1]!.tags = [];
    expect(slotMap(model, "tag", chosen)!(model.nodes[2]!)).toBe(1);
    expect(legend(model, "tag", {}, chosen).map((e) => [e.label, e.slot])).toEqual([["team b", 1], ["None of these tags", "none"]]);
  });

  it("says the coloring in words, naming chosen tags", () => {
    expect(coloringWords("tag", ["Team A", "Team B"])).toBe("tags Team A, Team B");
    expect(coloringWords("tag")).toBe("tag");
    expect(coloringWords("lifecycle", ["Team A"])).toBe("life cycle stage");
  });

  it("is optional on a saved view in format 1; anything else this version can't read drops the choice, not the view", () => {
    const base = { id: "v1", name: "Teams", filter: {}, colorBy: "layer", colorByExt: "tag" };
    expect(viewSchema.parse({ ...base, colorTags: ["Team A", "Team B"] }).colorTags).toEqual(["Team A", "Team B"]);
    expect(viewSchema.parse({ ...base, colorTags: "Team A" }).colorTags).toBeUndefined();
    expect(viewSchema.parse({ ...base, colorTags: Array.from({ length: 201 }, (_, i) => `t${i}`) }).colorTags).toBeUndefined();
    expect(viewSchema.parse(base).colorTags).toBeUndefined();
  });
});

