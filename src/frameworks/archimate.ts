import type { ClassId } from "@/metamodel";

/**
 * ArchiMate® 3.2 lens: how each CSDM class and relationship reads in ArchiMate. A view over the
 * model, never stored in it. The mapping is our interpretation, written in our own words; each
 * element cites the chapter of the public specification that defines it. Relationship types were
 * checked against the specification's relationship tables (every pair below is an allowed
 * relationship in ArchiMate 3.2).
 *
 * ArchiMate® is a registered trademark of The Open Group.
 */

export const archimateSources = {
  spec: { title: "ArchiMate® 3.2 Specification (The Open Group)", url: "https://pubs.opengroup.org/architecture/archimate32-doc/" },
  strategy: { title: "ArchiMate® 3.2 Specification — Strategy Layer", url: "https://pubs.opengroup.org/architecture/archimate32-doc/ch-Strategy-Layer.html" },
  business: { title: "ArchiMate® 3.2 Specification — Business Layer", url: "https://pubs.opengroup.org/architecture/archimate32-doc/ch-Business-Layer.html" },
  application: { title: "ArchiMate® 3.2 Specification — Application Layer", url: "https://pubs.opengroup.org/architecture/archimate32-doc/ch-Application-Layer.html" },
  technology: { title: "ArchiMate® 3.2 Specification — Technology Layer", url: "https://pubs.opengroup.org/architecture/archimate32-doc/ch-Technology-Layer.html" },
  exchange: { title: "ArchiMate® Model Exchange File Format 3.1 (XSD)", url: "https://www.opengroup.org/xsd/archimate/" },
} as const satisfies Record<string, { title: string; url: string }>;

export type ArchimateSourceId = keyof typeof archimateSources;
export type ArchimateLayer = "Strategy" | "Business" | "Application" | "Technology" | "Other";

/** Element type names as the exchange format spells them (ElementTypeEnum). */
export type ArchimateElementType =
  | "Capability"
  | "BusinessProcess"
  | "BusinessService"
  | "BusinessObject"
  | "Product"
  | "ApplicationComponent"
  | "ApplicationInterface"
  | "TechnologyService"
  | "SystemSoftware"
  | "Node"
  | "TechnologyInterface"
  | "CommunicationNetwork"
  | "Grouping";

/** Relationship type names as the exchange format spells them (RelationshipTypeEnum). */
export type ArchimateRelationshipType = "Composition" | "Aggregation" | "Assignment" | "Realization" | "Serving" | "Access" | "Association";

export type ElementMapping = {
  type: ArchimateElementType;
  label: string;
  layer: ArchimateLayer;
  note?: string;
  source: ArchimateSourceId;
};

export const archimateElements = {
  business_capability: { type: "Capability", label: "Capability", layer: "Strategy", source: "strategy" },
  business_process: { type: "BusinessProcess", label: "Business Process", layer: "Business", source: "business" },
  business_application: {
    type: "ApplicationComponent",
    label: "Application Component",
    layer: "Application",
    note: "The logical application, independent of where or how often it is deployed.",
    source: "application",
  },
  information_object: {
    type: "BusinessObject",
    label: "Business Object",
    layer: "Business",
    note: "At the application level, a Data Object realizes it.",
    source: "business",
  },
  business_service: { type: "BusinessService", label: "Business Service", layer: "Business", source: "business" },
  business_service_offering: {
    type: "Product",
    label: "Product",
    layer: "Business",
    note: "An offering packages a service with commitments such as hours and support levels, which ArchiMate expresses as a product (with a contract).",
    source: "business",
  },
  technology_management_service: { type: "TechnologyService", label: "Technology Service", layer: "Technology", source: "technology" },
  technology_management_service_offering: {
    type: "TechnologyService",
    label: "Technology Service",
    layer: "Technology",
    note: "An offering of the parent service; model its commitments as a contract if you need them.",
    source: "technology",
  },
  application_service: {
    type: "ApplicationComponent",
    label: "Application Component",
    layer: "Application",
    note: "Name trap: a CSDM application service is a deployed instance, not an ArchiMate Application Service (exposed behavior). It reads as an application component that realizes the logical business application.",
    source: "application",
  },
  api: { type: "ApplicationInterface", label: "Application Interface", layer: "Application", source: "application" },
  application: {
    type: "SystemSoftware",
    label: "System Software",
    layer: "Technology",
    note: "Installed software such as a web server, database engine or container runtime.",
    source: "technology",
  },
  host: { type: "Node", label: "Node", layer: "Technology", note: "Use Device when you mean physical hardware.", source: "technology" },
  network: { type: "CommunicationNetwork", label: "Communication Network", layer: "Technology", source: "technology" },
  kubernetes_cluster: {
    type: "Node",
    label: "Node",
    layer: "Technology",
    note: "A cluster is a node that aggregates other nodes.",
    source: "technology",
  },
  kubernetes_node: { type: "Node", label: "Node", layer: "Technology", source: "technology" },
  kubernetes_namespace: {
    type: "Grouping",
    label: "Grouping",
    layer: "Other",
    note: "A namespace partitions a cluster; ArchiMate groups things with a grouping.",
    source: "spec",
  },
  kubernetes_workload: {
    type: "SystemSoftware",
    label: "System Software",
    layer: "Technology",
    note: "A containerized workload; model its container image as an Artifact if you need it.",
    source: "technology",
  },
  kubernetes_service: {
    type: "TechnologyInterface",
    label: "Technology Interface",
    layer: "Technology",
    note: "A stable endpoint to reach a workload, which is what an ArchiMate interface is, not an ArchiMate Technology Service.",
    source: "technology",
  },
  kubernetes_pod: {
    type: "Node",
    label: "Node",
    layer: "Technology",
    note: "An execution environment for its containers.",
    source: "technology",
  },
} as const satisfies Record<ClassId, ElementMapping>;

export type RelationshipMapping = {
  type: ArchimateRelationshipType;
  /** True when the ArchiMate relationship runs the other way (e.g. CSDM "depends on" ↔ ArchiMate "serves"). */
  reverse: boolean;
  /** How to read it, in ArchiMate terms. */
  reads: string;
};

/** Keyed by `${from}>${to}` over CSDM class ids; one entry per relationship pair in the metamodel. */
export const archimateRelationships: Record<string, RelationshipMapping> = {
  "business_application>application_service": { type: "Realization", reverse: true, reads: "the deployed instance realizes the application" },
  "business_application>business_capability": { type: "Realization", reverse: false, reads: "the application realizes the capability" },
  "business_application>information_object": { type: "Access", reverse: false, reads: "the application accesses the object" },
  "business_process>business_application": { type: "Serving", reverse: true, reads: "the application serves the process" },
  "business_service>business_service_offering": { type: "Aggregation", reverse: true, reads: "the product aggregates the service" },
  "business_service>business_capability": { type: "Realization", reverse: false, reads: "the service realizes the capability" },
  "technology_management_service>technology_management_service_offering": {
    type: "Aggregation",
    reverse: false,
    reads: "the service aggregates its offering",
  },
  "business_service_offering>application_service": { type: "Serving", reverse: true, reads: "the instance serves the product" },
  "technology_management_service_offering>application_service": { type: "Serving", reverse: false, reads: "the technology service serves the instance" },
  "application_service>application": { type: "Serving", reverse: true, reads: "the system software serves the instance" },
  "application_service>host": { type: "Serving", reverse: true, reads: "the node serves the instance" },
  "application_service>network": { type: "Serving", reverse: true, reads: "the network serves the instance" },
  "application_service>api": { type: "Composition", reverse: false, reads: "the instance is composed of its interface" },
  "application_service>application_service": { type: "Serving", reverse: true, reads: "the dependency serves the dependent instance" },
  "application>host": { type: "Aggregation", reverse: true, reads: "the node aggregates the system software" },
  "business_capability>business_capability": { type: "Aggregation", reverse: true, reads: "the parent capability aggregates the child" },
  "kubernetes_cluster>kubernetes_namespace": { type: "Aggregation", reverse: false, reads: "the cluster aggregates the namespace" },
  "kubernetes_cluster>kubernetes_node": { type: "Aggregation", reverse: false, reads: "the cluster aggregates its nodes" },
  "kubernetes_cluster>kubernetes_pod": { type: "Aggregation", reverse: false, reads: "the cluster aggregates the pod" },
  "kubernetes_cluster>kubernetes_service": { type: "Composition", reverse: false, reads: "the cluster is composed of the interface" },
  "kubernetes_workload>kubernetes_cluster": { type: "Assignment", reverse: true, reads: "the cluster is assigned to run the workload" },
  "kubernetes_service>kubernetes_workload": { type: "Composition", reverse: true, reads: "the workload is reached through the interface" },
  "host>kubernetes_node": { type: "Assignment", reverse: false, reads: "the host is assigned to run the Kubernetes node" },
  "host>kubernetes_pod": { type: "Aggregation", reverse: false, reads: "the host aggregates the pod" },
  "application_service>kubernetes_workload": { type: "Serving", reverse: true, reads: "the workload serves the instance" },
  "application_service>kubernetes_cluster": { type: "Serving", reverse: true, reads: "the cluster serves the instance" },
};

export const archimateRelationshipFor = (from: string, to: string): RelationshipMapping | undefined => archimateRelationships[`${from}>${to}`];

export const ARCHIMATE_TRADEMARK = "ArchiMate® is a registered trademark of The Open Group.";
