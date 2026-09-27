import { describe, expect, it } from "vitest";
import { createModel, migrate, parseModel, serializeModel, type Model } from "./index";

const NOW = new Date("2026-09-27T12:00:00.000Z");

function sample(): Model {
  const m = createModel("Checkout", NOW, "m-1");
  m.nodes = [
    { id: "cap", class: "business_capability", name: "Order management" },
    { id: "ba", class: "business_application", name: "Checkout" },
    { id: "svc", class: "application_service", name: "Checkout — prod", attrs: { environment: "production" } },
    { id: "host", class: "host", name: "web-01" },
  ];
  m.edges = [
    { id: "e1", from: "cap", to: "ba", type: "Provided by::Provides" },
    { id: "e2", from: "ba", to: "svc", type: "Uses::Used by" },
    { id: "e3", from: "svc", to: "host", type: "Depends on::Used by" },
  ];
  m.layout = { cap: { x: 0, y: 0 }, ba: { x: 0, y: 160 }, svc: { x: 0, y: 320 }, host: { x: 0, y: 480 } };
  return m;
}

const roundTrip = (m: Model) => parseModel(JSON.parse(serializeModel(m)));

describe("parseModel", () => {
  it("round-trips a valid model exactly, with no issues", () => {
    const m = sample();
    const r = roundTrip(m);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.model).toEqual(m);
    expect(r.issues).toEqual([]);
  });

  it("serializes stably", () => {
    expect(serializeModel(sample())).toBe(serializeModel(sample()));
    expect(serializeModel(sample()).endsWith("\n")).toBe(true);
  });

  it("rejects things that are not models, with a readable message", () => {
    for (const bad of [null, [], "x", 42, {}, { schema: "1" }]) {
      const r = parseModel(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/not a Blueprint Modeler file/);
    }
  });

  it("rejects files from a newer version", () => {
    const r = parseModel({ ...sample(), schema: 99 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/newer version/);
  });

  it("rejects unknown element types, duplicate ids, dangling edges, duplicate edges and orphan layout", () => {
    const cases: [string, (m: Model) => void, RegExp][] = [
      ["unknown class", (m) => (m.nodes[0]!.class = "cmdb_ci_mystery"), /Unknown element type/],
      ["duplicate node", (m) => m.nodes.push({ ...m.nodes[0]! }), /share the id/],
      ["dangling edge", (m) => (m.edges[0]!.to = "nope"), /does not exist/],
      ["duplicate edge", (m) => m.edges.push({ ...m.edges[0]!, id: "e9" }), /appears twice/],
      ["orphan layout", (m) => (m.layout.ghost = { x: 1, y: 1 }), /Layout refers/],
      ["bad shape", (m) => ((m as unknown as { nodes: unknown }).nodes = "x"), /not a valid model at nodes/],
    ];
    for (const [label, mutate, expected] of cases) {
      const m = sample();
      mutate(m);
      const r = roundTrip(m);
      expect(r.ok, label).toBe(false);
      if (!r.ok) expect(r.error, label).toMatch(expected);
    }
  });

  it("loads rule-breaking relationships with a warning instead of refusing them", () => {
    const m = sample();
    m.edges.push({ id: "e4", from: "ba", to: "host", type: "Depends on::Used by" });
    const r = roundTrip(m);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.issues).toEqual([expect.objectContaining({ code: "disallowed-relationship", edgeId: "e4" })]);
  });

  it("flags the CSDM 4 business application → application service type as legacy", () => {
    const m = sample();
    m.edges[1]!.type = "Consumes::Consumed by";
    const r = roundTrip(m);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.issues).toEqual([expect.objectContaining({ code: "legacy-type", edgeId: "e2" })]);
  });
});

describe("files from earlier Blueprint versions", () => {
  it("still load pairs drawn the old way, flagged as legacy", () => {
    const m = sample();
    m.edges[0] = { id: "e1", from: "ba", to: "cap", type: "Provides::Provided by" };
    const r = roundTrip(m);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.issues).toEqual([expect.objectContaining({ code: "legacy-type", edgeId: "e1" })]);
  });
});

describe("migrate", () => {
  it("passes the current version through unchanged", () => {
    const m = sample();
    expect(migrate(m)).toEqual({ ok: true, value: m });
  });
});
