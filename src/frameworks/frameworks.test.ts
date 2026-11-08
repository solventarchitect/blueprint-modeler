import { describe, expect, it } from "vitest";
import { classes, isClassId, relationships } from "@/metamodel";
import { archimateElements, archimateImportGuesses, archimateRelationshipFor, archimateSources, archimateTypeLabel } from "./archimate";

/** ElementTypeEnum / RelationshipTypeEnum names from the ArchiMate Model Exchange File Format 3.1 XSD. */
const EXCHANGE_ELEMENTS = new Set(["ValueStream", "Driver", "Goal", "Outcome", "Requirement", "WorkPackage", "Capability", "BusinessProcess", "BusinessService", "BusinessObject", "Product", "ApplicationComponent", "ApplicationInterface", "DataObject", "TechnologyService", "TechnologyInterface", "SystemSoftware", "Node", "Device", "CommunicationNetwork", "Path", "Equipment", "Facility", "Artifact", "Grouping"]);
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

  it("M87: each import guess is a real class with a public source, and agrees with the lens where it maps that type", () => {
    for (const [type, g] of Object.entries(archimateImportGuesses)) {
      expect(isClassId(g!.class), type).toBe(true);
      expect(archimateSources[g!.source].url, type).toMatch(/^https:\/\/(pubs\.)?opengroup\.org\//);
      if (type !== "Device" && type !== "DataObject") expect(archimateElements[g!.class as keyof typeof archimateElements].type, type).toBe(type);
    }
    // Every type the lens uses has a guess, except the ones a CSDM class can't be told from.
    const used = new Set(Object.values(archimateElements).map((m) => m.type));
    expect([...used].filter((t) => !archimateImportGuesses[t]).sort()).toEqual(["Grouping", "TechnologyInterface"]);
    expect(archimateTypeLabel("BusinessActor")).toBe("Business Actor");
  });
});
