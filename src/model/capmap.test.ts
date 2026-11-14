import { describe, expect, it } from "vitest";
import { allTiles, capabilityLegend, capabilityMap, createModel, legend, tileCounts, type CapabilityTile, type Model } from "./index";

// M92: the model's Business Capabilities as nested tiles, each counting the Business Applications that support it.
function m(): Model {
  return {
    ...createModel("Shop", new Date("2026-11-14T00:00:00Z"), "m1"),
    nodes: [
      { id: "sell", class: "business_capability", name: "Sell" },
      { id: "online", class: "business_capability", name: "Sell online" },
      { id: "store", class: "business_capability", name: "Sell in store" },
      { id: "pay", class: "business_capability", name: "Take payment" },
      { id: "hr", class: "business_capability", name: "Manage people" },
      { id: "shop", class: "business_application", name: "Shop" },
      { id: "pos", class: "business_application", name: "Point of sale" },
      { id: "payments", class: "business_application", name: "Payments" },
      { id: "svc", class: "application_service", name: "Shop production" },
    ],
    edges: [
      // A child refers to its parent.
      { id: "p1", from: "online", to: "sell", type: "reference:parent" },
      { id: "p2", from: "store", to: "sell", type: "reference:parent" },
      { id: "p3", from: "pay", to: "online", type: "reference:parent" },
      { id: "a1", from: "online", to: "shop", type: "Provided by::Provides" },
      { id: "a2", from: "store", to: "pos", type: "Provided by::Provides" },
      { id: "a3", from: "pay", to: "payments", type: "Provided by::Provides" },
      // Older files drew it from the application.
      { id: "a4", from: "payments", to: "store", type: "Provides::Provided by" },
      { id: "x1", from: "shop", to: "svc", type: "Uses::Used by" },
    ],
  };
}
/** The tree as nested [name-id, direct apps, all apps, children]: easy to read in a failure. */
const shape = (tiles: CapabilityTile[]): unknown[] => tiles.map((t) => [t.id, t.apps, t.allApps, shape(t.children)]);

describe("capability map (M92)", () => {
  it("puts each capability inside its parent, in the model's order, counting the applications that support it and its parts", () => {
    expect(shape(capabilityMap(m()))).toEqual([
      ["sell", [], 3, [
        ["online", ["shop"], 2, [["pay", ["payments"], 1, []]]],
        ["store", ["pos", "payments"], 2, []],
      ]],
      ["hr", [], 0, []],
    ]);
  });

  it("an application that supports several parts of a capability counts once in it", () => {
    const sell = capabilityMap(m())[0]!;
    // Payments supports Take payment (in Sell online) and Sell in store: three distinct applications under Sell.
    expect(sell.allApps).toBe(3);
  });

  it("a capability with two parents is drawn under the first, and says where else it belongs", () => {
    const model: Model = { ...m(), edges: [...m().edges, { id: "p4", from: "pay", to: "store", type: "reference:parent" }] };
    const [sell] = capabilityMap(model);
    const store = sell!.children.find((t) => t.id === "store")!;
    const pay = sell!.children.find((t) => t.id === "online")!.children[0]!;
    expect(pay).toMatchObject({ id: "pay", alsoUnder: ["store"] });
    expect(store.children).toEqual([]);
    expect(store.allApps).toBe(2);
  });

  it("a loop of parents is broken where the model first meets it, so every capability shows once", () => {
    const model: Model = {
      ...createModel("Loop", new Date("2026-11-14T00:00:00Z"), "m2"),
      nodes: [
        { id: "a", class: "business_capability", name: "A" },
        { id: "b", class: "business_capability", name: "B" },
        { id: "c", class: "business_capability", name: "C" },
      ],
      edges: [
        { id: "e1", from: "a", to: "b", type: "reference:parent" },
        { id: "e2", from: "b", to: "a", type: "reference:parent" },
        { id: "e3", from: "c", to: "c", type: "reference:parent" },
      ],
    };
    const tiles = capabilityMap(model);
    expect(shape(tiles)).toEqual([
      ["a", [], 0, [["b", [], 0, []]]],
      ["c", [], 0, []],
    ]);
    // A is drawn at the top, so its parent B is named as where else it belongs.
    expect(tiles[0]!.alsoUnder).toEqual(["b"]);
    expect(tiles[1]!.alsoUnder).toEqual([]);
  });

  it("none when the model has no Business Capabilities", () => {
    expect(capabilityMap({ ...m(), nodes: m().nodes.filter((n) => n.class !== "business_capability") })).toEqual([]);
  });

  it("says each tile's counts, adding its parts' only when they add to it", () => {
    const words = Object.fromEntries(allTiles(capabilityMap(m())).map((t) => [t.id, tileCounts(t)]));
    expect(words).toEqual({
      sell: "No Business Applications · 3 with its parts",
      online: "1 Business Application · 2 with its parts",
      pay: "1 Business Application",
      store: "2 Business Applications",
      hr: "No Business Applications",
    });
  });

  it("the legend keeps the canvas's colors, lists only what the capabilities carry, and counts them", () => {
    const owned: Model = {
      ...m(),
      nodes: m().nodes.map((n) =>
        n.id === "shop" || n.id === "pos" || n.id === "payments" ? { ...n, attrs: { owner: "IT" } } : n.id === "sell" || n.id === "online" ? { ...n, attrs: { owner: "Sales" } } : n,
      ),
    };
    // IT owns the most elements, so it takes the first color on the canvas; Sales the second.
    expect(legend(owned, "owner", {}).map((e) => [e.label, e.slot, e.count])).toEqual([["IT", 0, 3], ["Sales", 1, 2], ["Not set", "none", 4]]);
    // The map lists Sales in that same color, and Not set, counting capabilities only.
    expect(capabilityLegend(owned, "owner", {}).map((e) => [e.label, e.slot, e.count])).toEqual([["Sales", 1, 2], ["Not set", "none", 3]]);
    // A filter counts the capabilities it keeps.
    expect(capabilityLegend(owned, "owner", { owner: ["Sales"] }).map((e) => [e.label, e.count])).toEqual([["Sales", 2], ["Not set", 0]]);
    expect(capabilityLegend(owned, "layer", {})).toEqual([]);
  });
});
