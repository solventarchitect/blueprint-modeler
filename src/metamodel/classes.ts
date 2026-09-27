import type { SourceRef } from "./sources";

/** The seven CSDM 5 domains (white paper p. 14). No class in the palette sits in the last two yet. */
export type Domain =
  | "foundation"
  | "design-planning"
  | "build-integration"
  | "service-delivery"
  | "service-consumption"
  | "ideation-strategy"
  | "manage-portfolio";

/** Drawing lane on the canvas, top to bottom (the white paper's digital system layers). */
export type Layer = "business" | "design" | "service" | "functional" | "infrastructure";

export type ClassDef = {
  id: string;
  label: string;
  domain: Domain;
  layer: Layer;
  /** ServiceNow table, where the white paper names it (table summary, p. 47). */
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
    source: { id: "whitepaper", page: 16 },
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
    source: { id: "whitepaper", page: 45 },
  },
  {
    id: "business_service_offering",
    label: "Business Service Offering",
    domain: "service-consumption",
    layer: "service",
    table: "service_offering",
    description: "A consumable option of a Business Service. Application Services are exposed through offerings.",
    source: { id: "whitepaper", page: 45 },
  },
  {
    id: "technology_management_service",
    label: "Technology Management Service",
    domain: "service-delivery",
    layer: "service",
    table: "cmdb_ci_service_technical",
    description: "A provider-focused service that manages technology layered under business and Application Services.",
    source: { id: "whitepaper", page: 42 },
  },
  {
    id: "technology_management_service_offering",
    label: "Technology Management Service Offering",
    domain: "service-delivery",
    layer: "service",
    table: "service_offering",
    description:
      "A stratification of a Technology Management Service by geography, environment, support group, approval group and similar options.",
    source: { id: "whitepaper", page: 42 },
  },
  {
    id: "application_service",
    label: "Application Service",
    domain: "service-delivery",
    layer: "service",
    table: "cmdb_ci_service_discovered",
    description:
      "A deployed, running instance of an application, e.g. per environment or region: the application type of Service Instance. Its table follows how it is populated: manual or Service Mapping (cmdb_ci_service_discovered), tags, calculated, or a dynamic CI group (cmdb_ci_query_based_service).",
    source: { id: "whitepaper", page: 38 },
  },
  // Service Instance family (CSDM 5): the relabeled base table and the new siblings of Application
  // Service. The siblings are a data model only: no UI, created and maintained manually (p. 38).
  {
    id: "service_instance",
    label: "Service Instance",
    domain: "service-delivery",
    layer: "service",
    table: "cmdb_ci_service_auto",
    description:
      "The base class for every deployed instance of a service; CSDM 5 relabeled the old Application Service base table. Pick a specific type where you can: it is for reporting across all of them.",
    source: { id: "whitepaper", page: 37 },
  },
  {
    id: "data_service_instance",
    label: "Data Service Instance",
    domain: "service-delivery",
    layer: "service",
    table: "cmdb_ci_data_service_instance",
    description:
      "A deployed or provisioned instance of data services: database servers and services, storage, AI and machine-learning services such as pipelines and models, and data products.",
    source: { id: "whitepaper", page: 39 },
  },
  {
    id: "connection_service_instance",
    label: "Connection Service Instance",
    domain: "service-delivery",
    layer: "service",
    table: "cmdb_ci_connection_service_instance",
    description:
      "A logical or physical network connection, such as a VLAN, LAN or WLAN, kept as a CI so it takes part in dependency and impact analysis.",
    source: { id: "whitepaper", page: 39 },
  },
  {
    id: "network_service_instance",
    label: "Network Service Instance",
    domain: "service-delivery",
    layer: "service",
    table: "cmdb_ci_network_service_instance",
    description:
      "A deployed or provisioned instance of network services built on network functions. With connections, it forms the service delivery network.",
    source: { id: "whitepaper", page: 39 },
  },
  {
    id: "operational_process_service_instance",
    label: "Operational Process Service Instance",
    domain: "service-delivery",
    layer: "service",
    table: "cmdb_ci_operational_process_service_instance",
    description:
      "An instance of an operational process, such as manufacturing, utility or warehouse operations, carried out by connected devices and equipment.",
    source: { id: "whitepaper", page: 40 },
  },
  {
    id: "facility_service_instance",
    label: "Facility Service Instance",
    domain: "service-delivery",
    layer: "service",
    table: "cmdb_ci_facility_service_instance",
    description:
      "A service tied to running a facility, such as heating and cooling, lighting, power, water, building access or elevators.",
    source: { id: "whitepaper", page: 40 },
  },
  {
    id: "api",
    label: "API",
    domain: "service-delivery",
    layer: "functional",
    table: "cmdb_ci_api",
    description: "An interface a service exposes or depends on.",
    source: { id: "whitepaper", page: 41 },
  },
  {
    id: "application",
    label: "Application",
    domain: "service-delivery",
    layer: "functional",
    table: "cmdb_ci_appl",
    description: "Installed software running on a host: a web server, application server, database instance, middleware.",
    source: { id: "whitepaper", page: 41 },
  },
  {
    id: "host",
    label: "Host",
    domain: "service-delivery",
    layer: "infrastructure",
    description: "A physical or virtual computer an application runs on.",
    source: { id: "whitepaper", page: 42 },
  },
  {
    id: "network",
    label: "Network",
    domain: "service-delivery",
    layer: "infrastructure",
    description: "Network infrastructure a service depends on.",
    source: { id: "whitepaper", page: 42 },
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
