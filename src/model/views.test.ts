import { describe, expect, it } from "vitest";
import { createModel, type Model } from "./index";
import { ALL_ELEMENTS, filterActive, inView, legend, MARKERS, PALETTE, slotOf } from "./views";

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
const ids = (model: Model, f: Parameters<typeof inView>[1]) => model.nodes.filter((n) => inView(n, f)).map((n) => n.id);

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
    expect(slots.slice(PALETTE.dark.length)).toEqual(["other", "other"]);
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
