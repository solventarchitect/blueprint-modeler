import type { SourceRef } from "./sources";

/**
 * Conformance hint catalogue. Hints advise; they never block. `evaluateHints` (src/model/hints.ts)
 * decides which apply to a model; the wording and sources live here.
 */
export type HintDef = {
  id: string;
  severity: "info" | "warning";
  title: string;
  explanation: string;
  source: SourceRef;
};

export const hints = [
  {
    id: "ba-without-capability",
    severity: "info",
    title: "Business application has no business capability",
    explanation: "Relate each business application to the capabilities it serves, for visualization and reporting.",
    source: { id: "whitepaper", page: 31 },
  },
  {
    id: "ba-without-service-instance",
    severity: "info",
    title: "Business application has no application service",
    explanation: "Where the application is deployed, model each running instance as an application service related to it.",
    source: { id: "whitepaper", page: 11 },
  },
  {
    id: "ba-direct-to-infrastructure",
    severity: "warning",
    title: "Business application linked straight to infrastructure",
    explanation:
      "Infrastructure belongs under the application service that runs on it. Relate the business application to an application service, and the service to its applications and hosts.",
    source: { id: "whitepaper", page: 38 },
  },
  {
    id: "service-not-exposed",
    severity: "info",
    title: "Application service is not exposed through an offering",
    explanation: "Expose application services through the related business or technology management service offering.",
    source: { id: "whitepaper", page: 39 },
  },
  {
    id: "capability-too-deep",
    severity: "warning",
    title: "Capability hierarchy deeper than six levels",
    explanation: "Keep business capability hierarchies to six levels or fewer.",
    source: { id: "whitepaper" },
  },
  {
    id: "capability-cycle",
    severity: "warning",
    title: "Circular capability hierarchy",
    explanation: "A capability cannot be its own ancestor. Remove one parent link to break the loop.",
    source: { id: "whitepaper" },
  },
  {
    id: "disallowed-relationship",
    severity: "warning",
    title: "Relationship not used in CSDM",
    explanation: "These two element types are not related this way in CSDM. Remove the relationship, or route it through the element CSDM puts between them.",
    source: { id: "whitepaper" },
  },
  {
    id: "legacy-relationship-type",
    severity: "info",
    title: "Legacy relationship type",
    explanation: "Consumes::Consumed by between a business application and an application service is the CSDM 4 type; CSDM 5 shows Uses::Used by.",
    source: { id: "baToServiceInstanceType" },
  },
] as const satisfies readonly HintDef[];

export type HintId = (typeof hints)[number]["id"];
