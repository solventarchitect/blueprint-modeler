import { describe, expect, it } from "vitest";
import { classes, relationships } from "@/metamodel";
import { classKinds, classLinks, classSlug, decodeEnds, encodeEnds, GUIDE_SECTIONS, itemMatches, searchText, type GuideFilter } from "./index";

const none: GuideFilter = { query: "", layers: new Set(), kinds: new Set() };

describe("class anchors", () => {
  it("give every class a unique, readable anchor that no section uses", () => {
    expect(classSlug("business_application")).toBe("business-application");
    const slugs = classes.map((c) => classSlug(c.id));
    expect(new Set(slugs).size).toBe(classes.length);
    for (const s of slugs) {
      expect(s).toMatch(/^[a-z0-9-]+$/);
      expect(GUIDE_SECTIONS.map((x) => x.id)).not.toContain(s);
    }
  });
});

describe("class kinds", () => {
  it("are core for white-paper classes, CMDB for product-doc classes, and Extended when behind the toggle", () => {
    expect(classKinds(classes.find((c) => c.id === "business_application")!)).toEqual(["core"]);
    expect(classKinds(classes.find((c) => c.id === "kubernetes_cluster")!)).toEqual(["cmdb"]);
    const esx = classKinds(classes.find((c) => c.id === "esx_server")!);
    expect(esx).toContain("extended");
    expect(esx).toContain("cmdb");
    // Every class has at least one kind, so a kind chip can always find it.
    for (const c of classes) expect(classKinds(c).length).toBeGreaterThan(0);
  });
});

describe("class links", () => {
  it("list every relationship a class takes part in, once each way", () => {
    const ba = classLinks("business_application");
    expect(ba.out.map((l) => l.to)).toContain("application_service");
    expect(ba.in.map((l) => l.from)).toContain("business_capability");
    const total = classes.reduce((n, c) => n + classLinks(c.id).out.length, 0);
    expect(total).toBe(relationships.length);
    expect(classes.reduce((n, c) => n + classLinks(c.id).in.length, 0)).toBe(relationships.length);
  });

  it("carry the relationship's types for each link", () => {
    const link = classLinks("business_application").out.find((l) => l.to === "application_service")!;
    expect(link.types).toContain("Uses::Used by");
  });
});

describe("filter", () => {
  const item = { text: searchText("Business Application", "cmdb_ci_business_app", "What the business uses"), ends: [{ layer: "design" as const, kinds: ["core" as const] }] };

  it("shows everything when empty", () => {
    expect(itemMatches(item, none)).toBe(true);
  });

  it("matches every word of the query, in any order and case, anywhere in the text", () => {
    expect(itemMatches(item, { ...none, query: "APPLICATION" })).toBe(true);
    expect(itemMatches(item, { ...none, query: "business_app" })).toBe(true);
    expect(itemMatches(item, { ...none, query: "uses business" })).toBe(true);
    expect(itemMatches(item, { ...none, query: "uses host" })).toBe(false);
    expect(itemMatches(item, { ...none, query: "   " })).toBe(true);
  });

  it("keeps an item when any of its layers, and any of its kinds, is selected", () => {
    expect(itemMatches(item, { ...none, layers: new Set(["design", "service"]) })).toBe(true);
    expect(itemMatches(item, { ...none, layers: new Set(["infrastructure"]) })).toBe(false);
    expect(itemMatches(item, { ...none, kinds: new Set(["cmdb"]) })).toBe(false);
    const both = { ...item, ends: [...item.ends, { layer: "infrastructure" as const, kinds: ["cmdb" as const] }] };
    expect(itemMatches(both, { ...none, layers: new Set(["infrastructure"]) })).toBe(true);
  });

  it("needs one end of a relationship to meet both the layer and the kind", () => {
    // Host (infrastructure, CMDB) → Product Model (design, extended): no end is extended infrastructure.
    const row = { text: "host product model", ends: [{ layer: "infrastructure" as const, kinds: ["cmdb" as const] }, { layer: "design" as const, kinds: ["cmdb" as const, "extended" as const] }] };
    expect(itemMatches(row, { ...none, layers: new Set(["infrastructure"]), kinds: new Set(["extended"]) })).toBe(false);
    expect(itemMatches(row, { ...none, layers: new Set(["design"]), kinds: new Set(["extended"]) })).toBe(true);
    expect(itemMatches(row, { ...none, layers: new Set(["infrastructure"]), kinds: new Set(["cmdb"]) })).toBe(true);
  });

  it("round-trips ends through the data attribute", () => {
    const ends = [{ layer: "design" as const, kinds: ["core" as const] }, { layer: "infrastructure" as const, kinds: ["cmdb" as const, "extended" as const] }];
    expect(encodeEnds(ends)).toBe("design:core infrastructure:cmdb,extended");
    expect(decodeEnds(encodeEnds(ends))).toEqual(ends);
    expect(decodeEnds("")).toEqual([]);
  });

  it("leaves items with no layer or kind (hints) to the query alone", () => {
    const hint = { text: searchText("Business Application without a capability"), ends: [] };
    expect(itemMatches(hint, { query: "capability", layers: new Set(["infrastructure"]), kinds: new Set(["cmdb"]) })).toBe(true);
    expect(itemMatches(hint, { query: "kubernetes", layers: new Set(), kinds: new Set() })).toBe(false);
  });
});
