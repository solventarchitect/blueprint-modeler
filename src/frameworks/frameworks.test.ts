import { describe, expect, it } from "vitest";
import { classes, relationships } from "@/metamodel";
import { archimateElements, archimateRelationshipFor, archimateSources } from "./archimate";

/** ElementTypeEnum / RelationshipTypeEnum names from the ArchiMate Model Exchange File Format 3.1 XSD. */
const EXCHANGE_ELEMENTS = new Set(["Capability", "BusinessProcess", "BusinessService", "BusinessObject", "Product", "ApplicationComponent", "ApplicationInterface", "DataObject", "TechnologyService", "SystemSoftware", "Node", "Device", "CommunicationNetwork", "Artifact"]);
const EXCHANGE_RELATIONSHIPS = new Set(["Composition", "Aggregation", "Assignment", "Realization", "Serving", "Access", "Influence", "Triggering", "Flow", "Specialization", "Association"]);

describe("ArchiMate lens", () => {
  it("maps every CSDM class to an exchange-format element type with a public source", () => {
    for (const c of classes) {
      const m = archimateElements[c.id];
      expect(m, c.id).toBeDefined();
      expect(EXCHANGE_ELEMENTS.has(m.type), `${c.id} → ${m.type}`).toBe(true);
      expect(archimateSources[m.source].url, c.id).toMatch(/^https:\/\/(pubs\.)?opengroup\.org\//);
    }
  });

  it("maps every relationship pair in the metamodel", () => {
    for (const r of relationships) {
      const m = archimateRelationshipFor(r.from, r.to);
      expect(m, `${r.from} > ${r.to}`).toBeDefined();
      expect(EXCHANGE_RELATIONSHIPS.has(m!.type), `${r.from} > ${r.to}`).toBe(true);
      expect(m!.reads.length, `${r.from} > ${r.to}`).toBeGreaterThan(5);
    }
  });

  it("warns about the application service name trap", () => {
    expect(archimateElements.application_service.note).toMatch(/not an ArchiMate Application Service/);
  });
});
