import type { SourceRef } from "./sources";

/**
 * Conformance hint catalog. Hints advise; they never block. `evaluateHints` (src/model/hints.ts)
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
    id: "model-without-business-anchor",
    severity: "info",
    title: "Model has no Business Capability or Business Process",
    explanation: "Start from what the business does: relate the model's applications and services to at least one Business Capability or Business Process, so the diagram reads top-down from business to infrastructure.",
    source: { id: "whitepaper", page: 31 },
  },
  {
    id: "ba-without-capability",
    severity: "info",
    title: "Business Application has no Business Capability",
    explanation: "Relate each Business Application to the capabilities it serves, for visualization and reporting.",
    source: { id: "whitepaper", page: 31 },
  },
  {
    id: "ba-without-service-instance",
    severity: "info",
    title: "Business Application has no Application Service",
    explanation: "Where the application is deployed, model each running instance as an Application Service related to it.",
    source: { id: "whitepaper", page: 11 },
  },
  {
    id: "ba-direct-to-infrastructure",
    severity: "warning",
    title: "Business Application linked straight to infrastructure",
    explanation:
      "Infrastructure belongs under the Application Service that runs on it. Relate the Business Application to an Application Service, and the service to its applications and hosts.",
    source: { id: "whitepaper", page: 38 },
  },
  {
    id: "service-not-exposed",
    severity: "info",
    title: "Service instance is not exposed through an offering",
    explanation:
      "Expose each service instance through the related Business Service Offering or Technology Management Service Offering. The white paper says this of Application Services; its relationship figure relates offerings to every service instance type.",
    source: { id: "whitepaper", page: 39, quote: "The offering of application services should be exposed via the related business or technical service offering." },
  },
  {
    id: "generic-service-instance",
    severity: "info",
    title: "Service Instance has no specific type",
    explanation:
      "Choose the type that fits: Application Service, or a Data, Connection, Network, Operational Process or Facility Service Instance. The base class is for reporting across all of them.",
    source: { id: "whitepaper", page: 37, quote: "New service instances extended from cmdb_ci_service_auto have been introduced to accommodate expanded use of services." },
  },
  {
    id: "capability-too-deep",
    severity: "warning",
    title: "Capability hierarchy deeper than six levels",
    explanation: "Keep Business Capability hierarchies to six levels or fewer.",
    source: { id: "whitepaper", page: 32, quote: "The total number of levels cannot exceed more than six in the hierarchy" },
  },
  {
    id: "capability-cycle",
    severity: "warning",
    title: "Circular capability hierarchy",
    explanation: "A capability cannot be its own ancestor. Remove one parent link to break the loop.",
    source: { id: "whitepaper", page: 32 },
  },
  {
    id: "disallowed-relationship",
    severity: "warning",
    title: "Relationship not used in CSDM",
    explanation: "These two element types are not related this way in CSDM. Remove the relationship, or route it through the element CSDM puts between them.",
    source: { id: "whitepaper", page: 48 },
  },
  {
    id: "offering-without-service",
    severity: "info",
    title: "Offering has no parent service",
    explanation: "An offering is a stratification of one service. Relate each Business Service Offering to its Business Service, and each Technology Management Service Offering to its Technology Management Service.",
    source: { id: "whitepaper", page: 45, quote: "A Business Service Offering is defined as a stratification of the service" },
  },
  {
    id: "legacy-relationship-type",
    severity: "info",
    title: "Legacy relationship type",
    explanation:
      "This relationship uses an older type or direction: a CSDM 4 type (such as Consumes::Consumed by), or how an earlier Blueprint file drew it. Delete it and redraw it to get the CSDM 5 type.",
    source: { id: "whitepaper", page: 48 },
  },
] as const satisfies readonly HintDef[];

export type HintId = (typeof hints)[number]["id"];
