import { describe, expect, it } from "vitest";
import { classes } from "./classes";
import { ENVIRONMENT_EXAMPLES, LIFE_CYCLE, lifecycleFor } from "./lifecycle";

const stages = (id: string) => lifecycleFor(id)?.stages;

describe("CSDM life cycle stages (M54, CSDM 5 white paper pp. 20-26)", () => {
  it("quotes each process's stages in the white paper's order, with its page", () => {
    expect(LIFE_CYCLE.product).toMatchObject({ stages: ["Ideation", "Design", "Build", "Operational", "End of Life"], source: { id: "whitepaper", page: 21 } });
    expect(LIFE_CYCLE.tangible).toMatchObject({ stages: ["Purchase", "Inventory", "Deploy", "Operational", "Defective", "Missing", "End of Operation", "End of Life"], source: { id: "whitepaper", page: 22 } });
    expect(LIFE_CYCLE.logical).toMatchObject({ stages: ["Purchase", "Design", "Inventory", "Deploy", "Operational", "End of Operation", "End of Life"], source: { id: "whitepaper", page: 24 } });
    expect(LIFE_CYCLE.document).toMatchObject({ stages: ["Ideation", "Operational", "End of Life"], source: { id: "whitepaper", page: 26 } });
  });

  it("gives Business Process the document process and Product Model the product process", () => {
    expect(lifecycleFor("business_process")?.process).toBe("document");
    expect(lifecycleFor("product_model")?.process).toBe("product");
  });

  it("gives physical devices the tangible process, and classes that may be physical or virtual both lists", () => {
    expect(lifecycleFor("esx_server")?.process).toBe("tangible");
    expect(lifecycleFor("firewall_device")?.process).toBe("tangible");
    for (const id of ["host", "network", "load_balancer"]) {
      expect(lifecycleFor(id)?.process, id).toBe("tangible-or-logical");
      // Every stage of both lists, each once, logical order first.
      expect(new Set(stages(id))).toEqual(new Set([...LIFE_CYCLE.logical.stages, ...LIFE_CYCLE.tangible.stages]));
      expect(stages(id)!.length, id).toBe(new Set(stages(id)).size);
    }
  });

  it("gives every other CMDB class the logical process", () => {
    for (const id of ["business_application", "application_service", "service_instance", "business_service_offering", "information_object", "kubernetes_workload", "api"]) {
      expect(lifecycleFor(id)?.process, id).toBe("logical");
    }
  });

  it("has no life cycle for records outside the CMDB (strategy, planning and value streams)", () => {
    for (const c of classes) {
      const table = "table" in c ? (c.table as string) : "";
      const outside = /^(sn_|cmn_)/.test(table);
      expect(lifecycleFor(c.id) === null, c.id).toBe(outside);
    }
    expect(lifecycleFor("not_a_class")).toBeNull();
  });

  it("offers environment examples as the white paper words them for service instances", () => {
    expect(ENVIRONMENT_EXAMPLES).toMatchObject({ values: ["Production", "Test", "Development"], source: { id: "whitepaper", page: 11 } });
  });
});
