import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { allowedTypes, classes, isCsdmCore, isExtended } from "@/metamodel";
import { blastRadius, evaluateHints, parseModel, serializeModel } from "@/model";
import { SLOT } from "@/editor/state";
import { exampleCategories, examples } from "./index";

const NEW = ["dmz-edge", "directory", "remote-access", "servicenow-itsm", "servicenow-instances", "servicenow-integrations", "server-virtualization", "vdi"];

describe("examples", () => {
  it("are valid models that load without relationship warnings", () => {
    for (const ex of examples) {
      const r = parseModel(JSON.parse(serializeModel(ex.create(new Date("2026-09-27T00:00:00Z"), ex.id))));
      expect(r.ok, ex.id).toBe(true);
      if (r.ok) expect(r.issues, ex.id).toEqual([]);
    }
  });

  it("teach what their summaries say", () => {
    const hintIds = (id: string) => evaluateHints(examples.find((e) => e.id === id)!.create()).map((h) => h.hint.id);
    expect(hintIds("checkout")).toEqual([]);
    expect(hintIds("hr-portal")).toEqual(["ba-without-service-instance"]);
    expect(hintIds("db-platform")).toEqual(["service-not-exposed"]);
    expect(hintIds("kubernetes")).toEqual([]);
    expect(hintIds("enterprise-ai")).toEqual(["ba-without-service-instance"]);
    expect(hintIds("archimate-claims")).toEqual([]);
    expect(hintIds("csdm5-metamodel")).toEqual(["generic-service-instance"]);
    for (const id of NEW) expect(hintIds(id), id).toEqual([]);
  });

  it("the new examples draw the classes they teach", () => {
    const classesOf = (id: string) => new Set(examples.find((e) => e.id === id)!.create().nodes.map((n) => n.class as string));
    const has = (id: string, cls: string[]) => expect([...classesOf(id)], id).toEqual(expect.arrayContaining(cls));
    has("dmz-edge", ["network_service_instance", "firewall_cluster", "firewall_device", "load_balancer", "certificate", "network"]);
    has("directory", ["ad_controller", "host", "certificate", "application_service"]);
    has("remote-access", ["network_service_instance", "vpn", "firewall_cluster", "firewall_device", "certificate", "ad_controller"]);
    has("servicenow-itsm", ["business_application", "application_service", "business_service_offering", "technology_management_service_offering"]);
    has("servicenow-instances", ["application_service", "application", "host"]);
    has("servicenow-integrations", ["api", "application_service", "application"]);
    has("server-virtualization", ["vcenter_instance", "vcenter_datacenter", "vcenter_cluster", "esx_server", "vmware_instance", "vcenter_datastore", "host"]);
    has("vdi", ["load_balancer", "certificate", "application", "vmware_instance", "esx_server", "vcenter_cluster", "ad_controller"]);
  });

  it("reach what their summaries say when a blast radius is shown", () => {
    const reach = (id: string, start: string) => {
      const m = examples.find((e) => e.id === id)!.create();
      return blastRadius(m, start).steps.flatMap((s) => s.nodeIds);
    };
    expect(reach("dmz-edge", "cert")).toEqual(expect.arrayContaining(["lb", "edge", "svc", "ba", "bso", "tmso"]));
    expect(reach("directory", "dir")).toEqual(expect.arrayContaining(["hr", "files", "ba", "tmso"]));
    expect(reach("remote-access", "cert")).toEqual(expect.arrayContaining(["fw1", "fw2", "fwc", "ra", "bso"]));
    expect(reach("servicenow-instances", "h1")).toEqual(expect.arrayContaining(["mid1", "prod", "ba", "tmso"]));
    expect(reach("servicenow-instances", "h1")).not.toContain("test");
    expect(reach("server-virtualization", "esx1")).toEqual(expect.arrayContaining(["vm1", "g1", "vc", "vs", "cl", "tmso"]));
    expect(reach("server-virtualization", "esx1")).not.toContain("g2");
    expect(reach("vdi", "esx1")).toEqual(expect.arrayContaining(["bvm", "bh", "broker", "d1", "svc", "bso"]));
  });

  it("lay the new examples out on their grids, at most five columns wide, with no two elements in the same place", () => {
    for (const id of NEW) {
      const m = examples.find((e) => e.id === id)!.create();
      const spots = m.nodes.map((n) => `${m.layout[n.id]!.x},${m.layout[n.id]!.y}`);
      expect(new Set(spots).size, id).toBe(spots.length);
      expect(Math.max(...Object.values(m.layout).map((p) => p.x)), id).toBeLessThanOrEqual(4 * SLOT);
    }
  });

  it("change their elements, relationships and layouts only on purpose", () => {
    // SHA-256 of every example serialized in menu order (nodes, edges, layout). Last changed in M39:
    // a Business Capability (and for Server Virtualization a Business Application) added to the
    // examples that had no capability or process.
    const out = examples.map((ex) => {
      const m = ex.create(new Date("2026-09-27T00:00:00Z"), ex.id);
      return [ex.id, { nodes: m.nodes, edges: m.edges, layout: m.layout }];
    });
    expect(createHash("sha256").update(JSON.stringify(out)).digest("hex")).toBe("e687b617dd5c6c4bb55abcbca6d2b6590b94de48d18d67b8e370aab1c647082b");
  });

  it("each belong to a listed category, and every listed category has examples", () => {
    const ids = exampleCategories.map((c) => c.id);
    for (const ex of examples) expect(ids, ex.id).toContain(ex.category);
    for (const c of exampleCategories) expect(examples.filter((e) => e.category === c.id).length, c.id).toBeGreaterThan(0);
    expect(exampleCategories.map((c) => c.label)).toEqual(["Application architecture", "Security architecture", "ServiceNow platform", "Reference architecture", "Frameworks and metamodel"]);
    const of = (id: string) => examples.find((e) => e.id === id)!.category;
    expect(["checkout", "hr-portal", "db-platform", "enterprise-ai"].map(of)).toEqual(Array(4).fill("application"));
    expect(["dmz-edge", "directory", "remote-access"].map(of)).toEqual(Array(3).fill("security"));
    expect(["servicenow-itsm", "servicenow-instances", "servicenow-integrations"].map(of)).toEqual(Array(3).fill("servicenow"));
    expect(["kubernetes", "server-virtualization", "vdi"].map(of)).toEqual(Array(3).fill("reference"));
    expect([of("archimate-claims"), of("csdm5-metamodel")]).toEqual(["frameworks", "frameworks"]);
  });

  it("are named in Title Case", () => {
    const small = new Set(["a", "an", "and", "as", "at", "for", "in", "of", "on", "or", "the", "to"]);
    for (const ex of examples) {
      ex.name.split(/[\s-]+/).forEach((word, i) => {
        const w = word.replace(/^[(]/, "");
        if (i > 0 && small.has(w)) return;
        expect(w[0], `${ex.name}: ${word}`).toBe(w[0]!.toUpperCase());
      });
      expect(ex.create().name).toBe(ex.name);
    }
    expect(examples.map((e) => e.name)).toContain("Online Store Checkout");
  });

  it("each have a description and a sequenced Artifact ID, and a Business Capability or Business Process", () => {
    examples.forEach((ex, i) => {
      const m = ex.create();
      expect(m.description?.length, ex.id).toBeGreaterThan(20);
      expect(m.artifactId, ex.id).toBe(`BM-EX-${String(i + 1).padStart(3, "0")}`);
      expect(m.date, ex.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(m.nodes.some((n) => n.class === "business_capability" || n.class === "business_process"), ex.id).toBe(true);
    });
  });

  it("the ArchiMate example opens in the ArchiMate-only lens", () => {
    expect(examples.find((e) => e.id === "archimate-claims")!.lens).toBe("archimate-only");
  });

  it("the metamodel example has every CSDM 5 core class once, and only allowed relationships", () => {
    const m = examples.find((e) => e.id === "csdm5-metamodel")!.create();
    const core = classes.filter((c) => isCsdmCore(c) && !isExtended(c)).map((c) => c.id);
    expect(m.nodes.map((n) => n.class).sort()).toEqual([...core].sort());
    for (const e of m.edges) expect(allowedTypes(e.from, e.to), `${e.from} → ${e.to}`).toContain(e.type);
    expect(new Set(m.edges.map((e) => `${e.from}>${e.to}`)).size).toBe(m.edges.length);
  });
});
