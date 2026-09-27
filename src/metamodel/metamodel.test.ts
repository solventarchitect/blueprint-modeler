import { describe, expect, it } from "vitest";
import { acceptedTypes, allowedTypes, classes, hints, isClassId, relationships, sources } from "./index";

const SN_HOST = /(^|\.)servicenow\.com$/;

describe("sources", () => {
  it("are all ServiceNow-hosted https URLs", () => {
    for (const [id, s] of Object.entries(sources)) {
      const u = new URL(s.url);
      expect(u.protocol, id).toBe("https:");
      expect(u.hostname, id).toMatch(SN_HOST);
    }
  });
});

describe("classes", () => {
  it("have unique ids and a public source each", () => {
    expect(new Set(classes.map((c) => c.id)).size).toBe(classes.length);
    for (const c of classes) expect(sources[c.source.id], c.id).toBeDefined();
  });

  it("name ServiceNow tables in the forms the white paper uses when they name one", () => {
    for (const c of classes) if ("table" in c) expect(c.table, c.id).toMatch(/^(cmdb_ci_[a-z_]+|service_offering|cmdb_model|cmn_[a-z_]+|sn_[a-z_]+)$/);
  });

  it("keeps the extended group to CSDM 5 classes, each citing the white paper", () => {
    const ext = classes.filter((c) => "extended" in c && c.extended);
    expect(ext.map((c) => c.id)).toEqual(["strategic_priority", "goal", "target", "product_idea", "planning_item", "value_stream", "value_stream_stage", "sdlc_component", "product_model", "ai_application", "ai_function"]);
    for (const c of ext) expect(c.source, c.id).toMatchObject({ id: "whitepaper" });
  });
});

describe("relationships", () => {
  it("connect known classes, cite a source, and never repeat a pair", () => {
    const pairs = new Set<string>();
    for (const r of relationships) {
      expect(isClassId(r.from), r.from).toBe(true);
      expect(isClassId(r.to), r.to).toBe(true);
      expect(sources[r.source.id], `${r.from}->${r.to}`).toBeDefined();
      expect(r.types.length, `${r.from}->${r.to}`).toBeGreaterThan(0);
      const key = `${r.from}->${r.to}`;
      expect(pairs.has(key), key).toBe(false);
      pairs.add(key);
    }
  });

  it("route a business application to infrastructure only through an application service", () => {
    for (const infra of ["application", "host", "network", "api"]) {
      expect(allowedTypes("business_application", infra), infra).toEqual([]);
      const linked = allowedTypes("application_service", infra).length + allowedTypes(infra, "application_service").length;
      expect(linked, infra).toBeGreaterThan(0);
    }
    expect(allowedTypes("business_application", "application_service")).toEqual(["Uses::Used by"]);
  });

  it("still accept the CSDM 4 type on load, but not for new edges", () => {
    expect(acceptedTypes("business_application", "application_service")).toContain("Consumes::Consumed by");
    expect(allowedTypes("business_application", "application_service")).not.toContain("Consumes::Consumed by");
  });
});

describe("CSDM 5 relationship figure", () => {
  it("uses the types the white paper's Figure 16 shows", () => {
    expect(allowedTypes("business_capability", "business_application")).toEqual(["Provided by::Provides"]);
    expect(allowedTypes("business_capability", "business_service")).toEqual(["Provided by::Provides"]);
    expect(allowedTypes("business_process", "business_capability")).toEqual(["Operationalizes::Operationalized by"]);
    expect(allowedTypes("business_application", "information_object")).toEqual(["Uses::Used by"]);
    expect(allowedTypes("technology_management_service_offering", "application_service")).toEqual(["Contains::Contained by"]);
    expect(allowedTypes("api", "application_service")).toEqual(["Receives data from::Sends data to"]);
    expect(allowedTypes("application", "host")).toEqual(["Runs on::Runs"]);
  });

  it("accepts the directions and types older Blueprint files used, on load only", () => {
    expect(acceptedTypes("business_application", "business_capability")).toEqual(["Provides::Provided by"]);
    expect(allowedTypes("business_application", "business_capability")).toEqual([]);
    expect(acceptedTypes("application_service", "api")).toEqual(["Depends on::Used by"]);
    expect(acceptedTypes("technology_management_service_offering", "application_service")).toContain("Depends on::Used by");
  });
});

describe("Service Instance family", () => {
  const types = ["application_service", "data_service_instance", "connection_service_instance", "network_service_instance", "operational_process_service_instance", "facility_service_instance"];

  it("relates a Business Application to Application Services only", () => {
    for (const t of [...types, "service_instance"]) {
      expect(allowedTypes("business_application", t).length > 0, t).toBe(t === "application_service");
    }
  });

  it("lets both kinds of offering expose every instance type", () => {
    for (const t of [...types, "service_instance"]) {
      expect(allowedTypes("business_service_offering", t), t).toEqual(["Depends on::Used by"]);
      expect(allowedTypes("technology_management_service_offering", t), t).toEqual(["Contains::Contained by"]);
    }
  });

  it("connects instances through Connection Service Instances, provided by a Network Service Instance", () => {
    expect(allowedTypes("data_service_instance", "connection_service_instance")).toEqual(["Connected by::Connects"]);
    expect(allowedTypes("connection_service_instance", "network_service_instance")).toEqual(["Provided by::Provides"]);
    expect(allowedTypes("application_service", "data_service_instance")).toEqual(["Depends on::Used by"]);
  });

  it("names each instance table as the white paper's table summary does", () => {
    const table = (id: string) => classes.find((c) => c.id === id)!;
    expect(table("service_instance")).toMatchObject({ table: "cmdb_ci_service_auto" });
    expect(table("data_service_instance")).toMatchObject({ table: "cmdb_ci_data_service_instance" });
    expect(table("application_service")).toMatchObject({ table: "cmdb_ci_service_discovered" });
  });
});

describe("Kubernetes", () => {
  it("uses the relationship types the Kubernetes discovery documentation reports", () => {
    expect(allowedTypes("kubernetes_cluster", "kubernetes_namespace")).toEqual(["Contains::Contained by"]);
    expect(allowedTypes("kubernetes_cluster", "kubernetes_node")).toEqual(["Cluster of::Cluster"]);
    expect(allowedTypes("kubernetes_workload", "kubernetes_cluster")).toEqual(["Hosted on::Hosts"]);
    expect(allowedTypes("kubernetes_service", "kubernetes_workload")).toEqual(["Provides::Provided by"]);
    expect(allowedTypes("host", "kubernetes_node")).toEqual(["Hosts::Hosted on"]);
    for (const r of relationships.filter((r) => r.from.startsWith("kubernetes_") || r.to.startsWith("kubernetes_"))) {
      if (r.from !== "application_service") expect(r.typeEvidence, `${r.from}->${r.to}`).toBe("reported");
    }
  });
});

describe("hints", () => {
  it("have unique ids and a public source each", () => {
    expect(new Set(hints.map((h) => h.id)).size).toBe(hints.length);
    for (const h of hints) expect(sources[h.source.id], h.id).toBeDefined();
  });
});
