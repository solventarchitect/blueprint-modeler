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
