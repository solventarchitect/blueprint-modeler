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

  it("name ServiceNow tables in cmdb_ci_* form when they name one", () => {
    for (const c of classes) if ("table" in c) expect(c.table, c.id).toMatch(/^cmdb_ci_[a-z_]+$/);
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
      expect(allowedTypes("application_service", infra).length, infra).toBeGreaterThan(0);
    }
    expect(allowedTypes("business_application", "application_service")).toEqual(["Uses::Used by"]);
  });

  it("still accept the CSDM 4 type on load, but not for new edges", () => {
    expect(acceptedTypes("business_application", "application_service")).toContain("Consumes::Consumed by");
    expect(allowedTypes("business_application", "application_service")).not.toContain("Consumes::Consumed by");
  });
});

describe("hints", () => {
  it("have unique ids and a public source each", () => {
    expect(new Set(hints.map((h) => h.id)).size).toBe(hints.length);
    for (const h of hints) expect(sources[h.source.id], h.id).toBeDefined();
  });
});
