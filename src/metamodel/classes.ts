import type { SourceRef } from "./sources";

/** The seven CSDM 5 domains (white paper p. 14). No class sits in Manage Portfolios yet. */
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
  /** In the optional "Extended" palette group (off by default): CSDM 5 classes beyond the core chain. */
  extended?: boolean;
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
  // Extended (optional palette group): CSDM 5 classes outside the core realization chain. Records
  // in the Ideation & Strategy and Foundation domains are not CMDB CIs; they link by reference.
  {
    id: "strategic_priority",
    label: "Strategic Priority",
    domain: "ideation-strategy",
    layer: "business",
    table: "sn_gf_strategy",
    extended: true,
    description: "A key, cross-functional focus area that drives long-term goals, likely spanning several business units.",
    source: { id: "whitepaper", page: 30 },
  },
  {
    id: "goal",
    label: "Goal",
    domain: "ideation-strategy",
    layer: "business",
    table: "sn_gf_goal",
    extended: true,
    description: "A broad, qualitative outcome the organization wants, often for a business unit and in service of a Strategic Priority.",
    source: { id: "whitepaper", page: 30 },
  },
  {
    id: "target",
    label: "Target",
    domain: "ideation-strategy",
    layer: "business",
    table: "sn_gf_goal_target",
    extended: true,
    description: "A quantifiable measure of a Goal: a milestone tracked over time.",
    source: { id: "whitepaper", page: 30 },
  },
  {
    id: "product_idea",
    label: "Product Idea",
    domain: "ideation-strategy",
    layer: "business",
    table: "sn_align_core_product_idea",
    extended: true,
    description: "A product, feature, enhancement or change proposal that can be curated and promoted into demand, a project, an epic or a story.",
    source: { id: "whitepaper", page: 30 },
  },
  {
    id: "planning_item",
    label: "Planning Item",
    domain: "ideation-strategy",
    layer: "business",
    table: "sn_align_core_planning_item",
    extended: true,
    description: "Work that is aligned to goals, planned and executed: a demand, project, epic or custom work item.",
    source: { id: "whitepaper", page: 30 },
  },
  {
    id: "value_stream",
    label: "Value Stream",
    domain: "foundation",
    layer: "business",
    table: "cmn_value_stream",
    extended: true,
    description: "How work really happens across the organization to deliver value, a product or service, to a customer.",
    source: { id: "whitepaper", page: 14 },
  },
  {
    id: "value_stream_stage",
    label: "Value Stream Stage",
    domain: "foundation",
    layer: "business",
    table: "cmn_value_stream_stage",
    extended: true,
    description: "A distinct grouping of activities within a Value Stream.",
    source: { id: "whitepaper", page: 15 },
  },
  {
    id: "sdlc_component",
    label: "SDLC Component",
    domain: "build-integration",
    layer: "design",
    table: "cmdb_ci_sdlc_component",
    extended: true,
    description:
      "An individually developed part of a Business Application, such as a microservice or an infrastructure configuration. A deployed application-type component is an Application Service.",
    source: { id: "whitepaper", page: 34 },
  },
  {
    id: "product_model",
    label: "Product Model",
    domain: "foundation",
    layer: "design",
    table: "cmdb_model",
    extended: true,
    description: "The product record (goods or services) a CI refers to through its model: owner, status, life cycle and end of life. Not a CI.",
    source: { id: "whitepaper", page: 17 },
  },
  {
    id: "ai_application",
    label: "AI Application",
    domain: "service-delivery",
    layer: "functional",
    table: "cmdb_ci_appl_ai_application",
    extended: true,
    description: "AI software running on a host, container platform or cluster: machine-learning models, analytics or AI-enabled applications. An extension of Application.",
    source: { id: "whitepaper", page: 41 },
  },
  {
    id: "ai_function",
    label: "AI Function",
    domain: "service-delivery",
    layer: "functional",
    table: "cmdb_ci_function_ai",
    extended: true,
    description: "An AI SaaS function on a public cloud platform, offering on-demand machine learning, data processing or AI tasks.",
    source: { id: "whitepaper", page: 41 },
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
