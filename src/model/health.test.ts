import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { createModel } from "./model";
import { healthReport } from "./health";

const make = (id: string) => examples.find((e) => e.id === id)!.create(new Date("2026-09-27T00:00:00Z"), "m1");

describe("healthReport (M64)", () => {
  it("counts elements by CSDM layer, and says which layers have none", () => {
    const r = healthReport(make("checkout"));
    expect(r.elements).toBe(14);
    expect(r.relationships).toBe(make("checkout").edges.length);
    expect(r.layers.map((l) => [l.name, l.count])).toEqual([
      ["Business", 1],
      ["Design", 2],
      ["Service", 6],
      ["Functional", 2],
      ["Infrastructure", 3],
    ]);
    // Only hosts: every other layer has none.
    const hosts = { ...make("checkout"), nodes: make("checkout").nodes.filter((n) => n.class === "host"), edges: [] };
    expect(healthReport(hosts).layers.filter((l) => l.count === 0).map((l) => l.name)).toEqual(["Business", "Design", "Service", "Functional"]);
  });

  it("groups the hints by kind, warnings first, with the elements they name", () => {
    const m = make("checkout");
    // A second Business Application with nothing around it: no capability, no service.
    m.nodes.push({ id: "x", class: "business_application", name: "Ledger" });
    m.layout.x = { x: 0, y: 0 };
    const r = healthReport(m);
    expect(r.warnings + r.infos).toBe(r.hints.reduce((n, h) => n + h.count, 0));
    const titles = r.hints.map((h) => h.title);
    expect(titles).toContain("Business Application has no Business Capability");
    const noCap = r.hints.find((h) => h.title === "Business Application has no Business Capability")!;
    expect(noCap.elements).toEqual(["Ledger"]);
    // Warnings come before infos.
    const firstInfo = r.hints.findIndex((h) => h.severity === "info");
    expect(r.hints.slice(firstInfo).every((h) => h.severity === "info")).toBe(true);
    expect(r.unconnected).toEqual(["Ledger"]);
  });

  it("measures how complete the elements' details are", () => {
    const m = make("checkout");
    m.nodes = m.nodes.map((n, i) => (i < 3 ? { ...n, attrs: { ...n.attrs, owner: "Team", lifecycle: "Operational", environment: "Production" } } : n));
    const r = healthReport(m);
    const row = (label: string) => r.details.find((d) => d.label === label)!;
    expect(row("Owner")).toMatchObject({ set: 3, of: 14 });
    expect(row("Environment")).toMatchObject({ set: 3, of: 14 });
    // Life cycle: only elements whose class has a CSDM life cycle count.
    expect(row("Life cycle stage").of).toBeLessThanOrEqual(14);
    expect(row("Life cycle stage").set).toBe(3);
    expect(row("Description").of).toBe(14);
  });

  it("reports an empty model without dividing by zero", () => {
    const r = healthReport(createModel("Empty", new Date("2026-09-27T00:00:00Z"), "e"));
    expect(r.elements).toBe(0);
    expect(r.hints).toEqual([]);
    expect(r.details.every((d) => d.set === 0 && d.of === 0)).toBe(true);
  });
});
