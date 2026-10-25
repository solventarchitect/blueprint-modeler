import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { groupsOf, primaryGroup } from "./groups";

const make = (id: string) => examples.find((e) => e.id === id)!.create(new Date("2026-09-27T00:00:00Z"), "m1");
const names = (m: ReturnType<typeof make>, ids: string[]) => ids.map((id) => m.nodes.find((n) => n.id === id)!.name).sort();

describe("groupsOf (M56)", () => {
  it("groups a Business Application with everything it reaches, never what reaches it", () => {
    const m = make("checkout");
    const [g, ...rest] = groupsOf(m, "business_application");
    expect(rest).toEqual([]);
    expect(g!.label).toBe("Checkout");
    expect(m.nodes.find((n) => n.id === g!.nodeIds[0])!.name).toBe("Checkout");
    expect(names(m, g!.nodeIds)).toEqual(
      ["Checkout", "Customer orders", "Checkout — production", "Checkout — test", "Checkout web app", "Orders database", "web-prod-01", "db-prod-01", "web-test-01"].sort(),
    );
    // The capability it provides is above it, not in it.
    expect(names(m, g!.nodeIds)).not.toContain("Order management");
  });

  it("puts a shared element in every group that reaches it; its first group is its own for layout", () => {
    const m = make("db-platform");
    const gs = groupsOf(m, "business_application");
    expect(gs.map((g) => g.label)).toEqual(["Inventory", "Reporting"]);
    const cluster = m.nodes.find((n) => n.name === "PostgreSQL cluster")!.id;
    expect(gs.every((g) => g.nodeIds.includes(cluster))).toBe(true);
    expect(primaryGroup(gs).get(cluster)).toBe(gs[0]!.key);
  });

  it("groups by Service Offering from both kinds of offering", () => {
    const m = make("checkout");
    expect(groupsOf(m, "service_offering").map((g) => g.label)).toEqual(["Application hosting — non-production", "Online shopping — North America"]);
  });

  it("groups by environment value, leaving elements without one out", () => {
    const m = make("checkout");
    const withEnv = { ...m, nodes: m.nodes.map((n) => (n.name.startsWith("web-") ? { ...n, attrs: { environment: n.name.includes("test") ? "Test" : "Production" } } : n)) };
    expect(groupsOf(withEnv, "environment").map((g) => [g.label, g.nodeIds.length])).toEqual([
      ["Production", 1],
      ["Test", 1],
    ]);
    expect(groupsOf(m, "environment")).toEqual([]);
  });
});
