import { describe, expect, it } from "vitest";
import { classById } from "@/metamodel";
import { createModel, type Model } from "@/model";
import { initialHistory, reduce } from "./state";
import { suggestions } from "./suggest";

function m(nodes: [string, string][], edges: [string, string, string][] = []): Model {
  const model = createModel("T", new Date("2026-09-27T00:00:00Z"), "t");
  model.nodes = nodes.map(([id, cls]) => ({ id, class: cls, name: id }));
  model.edges = edges.map(([from, to, type], i) => ({ id: `e${i}`, from, to, type }));
  model.layout = Object.fromEntries(nodes.map(([id], i) => [id, { x: i * 300, y: 0 }]));
  return model;
}

describe("suggestions", () => {
  it("offers the next step of the CSDM chain first, with the required direction and type", () => {
    const s = suggestions(m([["ba", "business_application"]]), "ba");
    expect(s.map((x) => (x.kind === "new" ? x.cls : x.nodeId))).toEqual(["business_capability", "application_service", "information_object", "business_process"]);
    expect(s[0]).toMatchObject({ kind: "new", outgoing: false, type: "Provided by::Provides" });
    expect(s[1]).toMatchObject({ kind: "new", outgoing: true, type: "Uses::Used by" });
  });

  it("lists elements already on the canvas before new ones, skipping ones already related", () => {
    const model = m([["ba", "business_application"], ["cap", "business_capability"], ["svc", "application_service"], ["other", "host"]], [["cap", "ba", "Provided by::Provides"]]);
    const s = suggestions(model, "ba");
    expect(s.filter((x) => x.kind === "existing").map((x) => (x as { nodeId: string }).nodeId)).toEqual(["svc"]);
    expect(s[0]).toMatchObject({ kind: "existing", from: "ba", to: "svc", type: "Uses::Used by" });
  });

  it("never suggests the generic Service Instance, and keeps CMDB classes for CMDB elements", () => {
    const svc = suggestions(m([["svc", "application_service"]]), "svc");
    expect(svc.some((x) => x.kind === "new" && (x.cls === "service_instance" || x.cls.startsWith("kubernetes_")))).toBe(false);
    const k8s = suggestions(m([["w", "kubernetes_workload"]]), "w");
    expect(k8s.some((x) => x.kind === "new" && x.cls === "kubernetes_cluster")).toBe(true);
    expect(svc.length).toBeLessThanOrEqual(5);
  });

  it("every suggestion is an allowed relationship: adding it with its element is one undo step", () => {
    const model = m([["ba", "business_application"]]);
    for (const s of suggestions(model, "ba")) {
      if (s.kind !== "new") continue;
      const h = reduce(initialHistory(model), { type: "add-related", id: "n", class: s.cls, name: "New", edgeId: "e", relatedTo: "ba", outgoing: s.outgoing, edgeType: s.type });
      expect(h.present.edges, s.cls).toHaveLength(1);
      expect(h.past, s.cls).toHaveLength(1);
      // Same column as the element when its lane has room there; beside it when they share a lane.
      expect(h.present.layout.n!.x, s.cls).toBe(classById(s.cls)!.layer === "design" ? 288 : 0);
    }
  });
});
