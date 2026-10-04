import { describe, expect, it } from "vitest";
import { impactRule, impactRows } from "./impact";
import { relationships } from "./relationships";
import { sources } from "./sources";

describe("impact rules", () => {
  it("cover every relationship the metamodel allows", () => {
    for (const r of relationships) {
      const rule = impactRule(r);
      expect(["from", "to", "none"], `${r.from} → ${r.to}`).toContain(rule.dependent);
      expect(rule.why.length, `${r.from} → ${r.to}`).toBeGreaterThan(10);
      expect(rule.why, `${r.from} → ${r.to} has no rule of its own`).not.toBe("No impact rule for this relationship type.");
    }
  });

  it("cite ServiceNow-hosted sources and say how sure they are", () => {
    for (const r of relationships) {
      const rule = impactRule(r);
      expect(["stated", "conventional"]).toContain(rule.evidence);
      expect(new URL(sources[rule.source.id].url).hostname).toMatch(/(^|\.)servicenow\.com$/);
    }
  });

  it("follow the stated rule for Depends on::Used by: the parent is affected when the child fails", () => {
    const dep = relationships.find((r) => r.from === "application_service" && r.to === "application")!;
    expect(impactRule(dep)).toMatchObject({ dependent: "from", evidence: "stated" });
  });

  it("send impact down to what runs inside a container, and up from what a hosted element runs on", () => {
    const pod = relationships.find((r) => r.from === "kubernetes_cluster" && r.to === "kubernetes_pod")!;
    expect(impactRule(pod).dependent).toBe("to");
    const runsOn = relationships.find((r) => r.from === "application" && r.to === "host")!;
    expect(impactRule(runsOn).dependent).toBe("from");
    const hosts = relationships.find((r) => r.from === "host" && r.to === "kubernetes_node")!;
    expect(impactRule(hosts).dependent).toBe("to");
  });

  it("send impact from failed virtualization and firewall infrastructure to what depends on it", () => {
    const rule = (from: string, to: string) => impactRule(relationships.find((r) => r.from === from && r.to === to)!).dependent;
    expect(rule("vmware_instance", "esx_server")).toBe("from"); // a failing ESX Server affects its virtual machines
    expect(rule("host", "vmware_instance")).toBe("from"); // a failing virtual machine affects its guest server
    expect(rule("host", "esx_server")).toBe("from");
    expect(rule("vcenter_cluster", "esx_server")).toBe("from"); // a failing member degrades the cluster
    expect(rule("vcenter_datastore", "vmware_instance")).toBe("to"); // a failing datastore affects what is stored on it
    expect(rule("vcenter_datastore", "esx_server")).toBe("none"); // only what is stored on it is affected
    expect(rule("vcenter_datacenter", "esx_server")).toBe("to");
    expect(rule("firewall_cluster", "firewall_device")).toBe("from"); // a failing firewall degrades its cluster
  });

  it("send impact from an expired certificate to whatever uses it", () => {
    const r = relationships.find((r) => r.from === "load_balancer" && r.to === "certificate")!;
    expect(impactRule(r).dependent).toBe("from");
  });

  it("do not spread impact through planning, strategy or build-time links", () => {
    const planning = relationships.filter((r) => ["Promoted to", "Aligned to", "Measures", "In service of", "Many-to-many map"].includes(r.types[0]!));
    expect(planning.length).toBeGreaterThan(0);
    for (const r of planning) expect(impactRule(r).dependent, `${r.from} → ${r.to}`).toBe("none");
    const sdlc = relationships.find((r) => r.from === "business_application" && r.to === "sdlc_component")!;
    expect(impactRule(sdlc).dependent).toBe("none");
  });

  it("summarize as guide rows that account for every relationship exactly once", () => {
    const rows = impactRows();
    expect(rows.reduce((n, row) => n + row.pairs.length, 0)).toBe(relationships.length);
    for (const row of rows) expect(row.effect.length).toBeGreaterThan(10);
  });
});
