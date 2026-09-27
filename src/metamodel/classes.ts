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
    label: "Business Capability",
    domain: "design-planning",
    layer: "business",
    table: "cmdb_ci_business_capability",
    description: "What the business does, independent of how. Arranged in a hierarchy of at most six levels.",
    source: { id: "whitepaper", page: 31 },
  },
  {
    id: "business_process",
    label: "Business Process",
    domain: "foundation",
    layer: "business",
    table: "cmdb_ci_business_process",
    description: "How work is done. Related to the Business Applications that enable it.",
    source: { id: "whitepaper" },
  },
  {
    id: "business_application",
    label: "Business Application",
    domain: "design-planning",
    layer: "design",
    table: "cmdb_ci_business_app",
    description: "The logical software the business knows by name, independent of where or how many times it runs.",
    source: { id: "whitepaper", page: 31 },
  },
  {
    id: "information_object",
    label: "Information Object",
    domain: "design-planning",
    layer: "design",
    table: "cmdb_ci_information_object",
    description: "A kind of data a Business Application uses, recorded to scope governance and compliance.",
    source: { id: "whitepaper", page: 33 },
  },
  {
    id: "business_service",
    label: "Business Service",
    domain: "service-consumption",
    layer: "service",
    table: "cmdb_ci_service_business",
    description: "The service as the customer sees it, not what IT calls it. Single level, not a hierarchy.",
    source: { id: "whitepaper" },
  },
  {
    id: "business_service_offering",
    label: "Business Service Offering",
    domain: "service-consumption",
    layer: "service",
    description: "A consumable option of a Business Service. Application Services are exposed through offerings.",
    source: { id: "whitepaper", page: 39 },
  },
  {
    id: "technology_management_service",
    label: "Technology Management Service",
    domain: "service-delivery",
    layer: "service",
    table: "cmdb_ci_service_technical",
    description: "A provider-focused service that manages technology layered under business and Application Services.",
    source: { id: "whitepaper" },
  },
  {
    id: "technology_management_service_offering",
    label: "Technology Management Service Offering",
    domain: "service-delivery",
    layer: "service",
    description:
      "A stratification of a Technology Management Service by geography, environment, support group, approval group and similar options.",
    source: { id: "whitepaper", page: 42 },
  },
  {
    id: "application_service",
    label: "Application Service",
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
  // Kubernetes: the CMDB classes Kubernetes discovery creates, so container platforms can be drawn
  // with their own vocabulary instead of approximating them with applications and hosts.
  {
    id: "kubernetes_cluster",
    label: "Kubernetes Cluster",
    domain: "service-delivery",
    layer: "infrastructure",
    table: "cmdb_ci_kubernetes_cluster",
    description: "A Kubernetes Cluster: the control plane and nodes that run containerized workloads.",
    source: { id: "k8sDiscovery" },
  },
  {
    id: "kubernetes_node",
    label: "Kubernetes Node",
    domain: "service-delivery",
    layer: "infrastructure",
    table: "cmdb_ci_kubernetes_node",
    description: "A worker machine in a cluster, hosted on a server.",
    source: { id: "k8sDiscovery" },
  },
  {
    id: "kubernetes_namespace",
    label: "Kubernetes Namespace",
    domain: "service-delivery",
    layer: "functional",
    table: "cmdb_ci_kubernetes_namespace",
    description: "A named partition of a cluster, often one per team, application or environment.",
    source: { id: "k8sDiscovery" },
  },
  {
    id: "kubernetes_workload",
    label: "Kubernetes Workload",
    domain: "service-delivery",
    layer: "functional",
    table: "cmdb_ci_kubernetes_workload",
    description: "A deployment, daemon set or stateful set: the containers a cluster keeps running for an application.",
    source: { id: "k8sExtensionClasses" },
  },
  {
    id: "kubernetes_service",
    label: "Kubernetes Service",
    domain: "service-delivery",
    layer: "functional",
    table: "cmdb_ci_kubernetes_service",
    description: "A stable network endpoint in front of a workload's pods. Not a CSDM service: it is a runtime object.",
    source: { id: "k8sDiscovery" },
  },
  {
    id: "kubernetes_pod",
    label: "Kubernetes Pod",
    domain: "service-delivery",
    layer: "functional",
    table: "cmdb_ci_kubernetes_pod",
    description: "The smallest unit a cluster schedules: one or more containers running together on a server.",
    source: { id: "k8sDiscovery" },
  },
] as const satisfies readonly ClassDef[];

export type ClassId = (typeof classes)[number]["id"];
