import { describe, expect, it } from "vitest";
import { createModel, evaluateHints, type Model } from "./index";

function m(nodes: [string, string][], edges: [string, string, string][] = []): Model {
  const model = createModel("T", new Date("2026-09-27T00:00:00Z"), "t");
  model.nodes = nodes.map(([id, cls]) => ({ id, class: cls, name: id }));
  model.edges = edges.map(([from, to, type], i) => ({ id: `e${i}`, from, to, type }));
  model.layout = Object.fromEntries(nodes.map(([id], i) => [id, { x: i * 10, y: 0 }]));
  return model;
}
const ids = (model: Model) => evaluateHints(model).map((h) => h.hint.id);

describe("evaluateHints", () => {
  it("is quiet for a complete chain", () => {
    const model = m(
      [["cap", "business_capability"], ["ba", "business_application"], ["svc", "application_service"], ["tms", "technology_management_service"], ["off", "technology_management_service_offering"], ["host", "host"]],
      [["cap", "ba", "Provided by::Provides"], ["ba", "svc", "Uses::Used by"], ["tms", "off", "reference:parent"], ["off", "svc", "Contains::Contained by"], ["svc", "host", "Depends on::Used by"]],
    );
    expect(evaluateHints(model)).toEqual([]);
  });

  it("flags an offering without its parent service", () => {
    expect(ids(m([["off", "business_service_offering"]]))).toContain("offering-without-service");
    expect(ids(m([["bs", "business_service"], ["off", "business_service_offering"]], [["bs", "off", "reference:parent"]]))).not.toContain("offering-without-service");
  });

  it("flags pairs drawn the way older files drew them, and still counts them", () => {
    const hints = ids(m([["cap", "business_capability"], ["ba", "business_application"]], [["ba", "cap", "Provides::Provided by"]]));
    expect(hints).toContain("legacy-relationship-type");
    expect(hints).not.toContain("ba-without-capability");
    expect(hints).not.toContain("disallowed-relationship");
  });

  it("flags a lone business application for capability and service, and names it", () => {
    const hints = evaluateHints(m([["ba", "business_application"]]));
    expect(hints.map((h) => h.hint.id)).toEqual(["ba-without-capability", "ba-without-service-instance"]);
    expect(hints[0]!.nodeIds).toEqual(["ba"]);
    expect(hints[0]!.message).toContain("ba");
  });

  it("flags an application service no offering exposes", () => {
    expect(ids(m([["svc", "application_service"]]))).toEqual(["service-not-exposed"]);
  });

  it("puts a business application wired straight to a host first, as a warning", () => {
    const hints = evaluateHints(m([["ba", "business_application"], ["h", "host"]], [["ba", "h", "Depends on::Used by"]]));
    expect(hints[0]).toMatchObject({ hint: { id: "ba-direct-to-infrastructure", severity: "warning" }, edgeIds: ["e0"] });
  });

  it("flags other relationships CSDM does not use, and legacy types", () => {
    expect(ids(m([["h", "host"], ["n", "network"]], [["h", "n", "Uses::Used by"]]))).toEqual(["disallowed-relationship"]);
    const legacy = m(
      [["ba", "business_application"], ["svc", "application_service"]],
      [["ba", "svc", "Consumes::Consumed by"]],
    );
    expect(ids(legacy)).toContain("legacy-relationship-type");
  });

  it("flags capability hierarchies deeper than six levels, once, on the leaf", () => {
    const nodes: [string, string][] = Array.from({ length: 7 }, (_, i) => [`c${i}`, "business_capability"]);
    const edges: [string, string, string][] = nodes.slice(1).map(([id], i) => [id, `c${i}`, "reference:parent"]);
    const hints = evaluateHints(m(nodes, edges));
    expect(hints.filter((h) => h.hint.id === "capability-too-deep").map((h) => h.nodeIds)).toEqual([["c6"]]);
    expect(ids(m(nodes.slice(0, 6), edges.slice(0, 5)))).not.toContain("capability-too-deep");
  });

  it("reports a capability cycle once", () => {
    const hints = evaluateHints(
      m([["a", "business_capability"], ["b", "business_capability"]], [["a", "b", "reference:parent"], ["b", "a", "reference:parent"]]),
    );
    expect(hints.filter((h) => h.hint.id === "capability-cycle")).toHaveLength(1);
  });
});
