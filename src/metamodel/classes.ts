import type { SourceRef } from "./sources";

/** CSDM 5 domains, as named in the white paper. */
export type Domain =
  | "foundation"
  | "design-planning"
  | "build-integration"
  | "service-delivery"
  | "service-consumption";

/** Drawing lane on the canvas, top to bottom (the white paper's digital system layers). */
export type Layer = "business" | "design" | "service" | "functional" | "infrastructure";

export type ClassDef = {
  id: string;
  label: string;
  domain: Domain;
  layer: Layer;
  /** ServiceNow table, where the white paper names it. */
  table?: string;
  description: string;
  source: SourceRef;
};

/**
 * v1 subset: the realization chain from capability to infrastructure, plus the services and
 * offerings that expose it. Written from the public white paper; descriptions are our own words.
 */
export const classes = [
  {
    id: "business_capability",
    label: "Business capability",
    domain: "design-planning",
    layer: "business",
    table: "cmdb_ci_business_capability",
    description: "What the business does, independent of how. Arranged in a hierarchy of at most six levels.",
    source: { id: "whitepaper", page: 31 },
  },
  {
    id: "business_process",
    label: "Business process",
    domain: "foundation",
    layer: "business",
    table: "cmdb_ci_business_process",
    description: "How work is done. Related to the business applications that enable it.",
    source: { id: "whitepaper" },
  },
  {
    id: "business_application",
    label: "Business application",
    domain: "design-planning",
    layer: "design",
    table: "cmdb_ci_business_app",
    description: "The logical software the business knows by name, independent of where or how many times it runs.",
    source: { id: "whitepaper", page: 31 },
  },
  {
    id: "information_object",
    label: "Information object",
    domain: "design-planning",
    layer: "design",
    table: "cmdb_ci_information_object",
    description: "A kind of data a business application uses, recorded to scope governance and compliance.",
    source: { id: "whitepaper", page: 33 },
  },
  {
    id: "business_service",
    label: "Business service",
    domain: "service-consumption",
    layer: "service",
    table: "cmdb_ci_service_business",
    description: "The service as the customer sees it, not what IT calls it. Single level, not a hierarchy.",
    source: { id: "whitepaper" },
  },
  {
    id: "business_service_offering",
    label: "Business service offering",
    domain: "service-consumption",
    layer: "service",
    description: "A consumable option of a business service. Application services are exposed through offerings.",
    source: { id: "whitepaper", page: 39 },
  },
  {
    id: "technology_management_service",
    label: "Technology management service",
    domain: "service-delivery",
    layer: "service",
    table: "cmdb_ci_service_technical",
    description: "A provider-focused service that manages technology layered under business and application services.",
    source: { id: "whitepaper" },
  },
  {
    id: "technology_management_service_offering",
    label: "Technology management service offering",
    domain: "service-delivery",
    layer: "service",
    description:
      "A stratification of a technology management service by geography, environment, support group, approval group and similar options.",
    source: { id: "whitepaper", page: 42 },
  },
  {
    id: "application_service",
    label: "Application service",
    domain: "service-delivery",
    layer: "service",
    table: "cmdb_ci_service_auto",
    description:
      "A deployed, running instance of an application (a service instance), e.g. per environment or region. Populated manually, by Service Mapping, tags or a dynamic query.",
    source: { id: "whitepaper", page: 11 },
  },
  {
    id: "api",
    label: "API",
    domain: "service-delivery",
    layer: "functional",
    table: "cmdb_ci_api",
    description: "An interface a service exposes or depends on.",
    source: { id: "whitepaper" },
  },
  {
    id: "application",
    label: "Application",
    domain: "service-delivery",
    layer: "functional",
    table: "cmdb_ci_appl",
    description: "Installed software running on a host: a web server, application server, database instance, middleware.",
    source: { id: "whitepaper", page: 38 },
  },
  {
    id: "host",
    label: "Host",
    domain: "service-delivery",
    layer: "infrastructure",
    description: "A physical or virtual computer an application runs on.",
    source: { id: "whitepaper", page: 38 },
  },
  {
    id: "network",
    label: "Network",
    domain: "service-delivery",
    layer: "infrastructure",
    description: "Network infrastructure a service depends on.",
    source: { id: "whitepaper", page: 38 },
  },
] as const satisfies readonly ClassDef[];

export type ClassId = (typeof classes)[number]["id"];
