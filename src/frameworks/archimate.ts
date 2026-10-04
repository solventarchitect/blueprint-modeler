import { relationships, type ClassId } from "@/metamodel";

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
export type ArchimateLayer = "Motivation" | "Strategy" | "Business" | "Application" | "Technology" | "Physical" | "Implementation & Migration" | "Other";

/** Element type names as the exchange format spells them (ElementTypeEnum). */
export type ArchimateElementType =
  | "Capability"
  | "ValueStream"
  | "Driver"
  | "Goal"
  | "Outcome"
  | "Requirement"
  | "WorkPackage"
  | "Artifact"
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
  | "Path"
  | "Equipment"
  | "Facility"
  | "Grouping";

/** Relationship type names as the exchange format spells them (RelationshipTypeEnum). */
export type ArchimateRelationshipType = "Composition" | "Aggregation" | "Assignment" | "Realization" | "Serving" | "Access" | "Influence" | "Association";

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
    note: "Name trap: a CSDM Application Service is a deployed instance, not an ArchiMate Application Service (exposed behavior). It reads as an Application Component that realizes the logical Business Application.",
    source: "application",
  },
  service_instance: {
    type: "Grouping",
    label: "Grouping",
    layer: "Other",
    note: "The base class spans many kinds of instance, so it reads as a grouping of what delivers the service. Pick a specific type for a precise element.",
    source: "spec",
  },
  data_service_instance: {
    type: "Node",
    label: "Node",
    layer: "Technology",
    note: "The platform that provides the data services; model the data itself as Data Objects or Artifacts if you need it.",
    source: "technology",
  },
  connection_service_instance: {
    type: "Path",
    label: "Path",
    layer: "Technology",
    note: "A link between nodes through which they exchange data.",
    source: "technology",
  },
  network_service_instance: { type: "CommunicationNetwork", label: "Communication Network", layer: "Technology", source: "technology" },
  operational_process_service_instance: {
    type: "Equipment",
    label: "Equipment",
    layer: "Physical",
    note: "The connected devices and machinery that carry out the process; model the process itself as a Technology Process if you need it.",
    source: "spec",
  },
  facility_service_instance: {
    type: "Facility",
    label: "Facility",
    layer: "Physical",
    note: "The facility whose services it represents, such as a plant, office or control center.",
    source: "spec",
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
  strategic_priority: { type: "Driver", label: "Driver", layer: "Motivation", note: "A key focus area that motivates the organization's goals.", source: "spec" },
  goal: { type: "Goal", label: "Goal", layer: "Motivation", source: "spec" },
  target: { type: "Outcome", label: "Outcome", layer: "Motivation", note: "ArchiMate outcomes are measurable end results, like CSDM targets.", source: "spec" },
  product_idea: { type: "Requirement", label: "Requirement", layer: "Motivation", note: "A proposed product, feature or change: a statement of need.", source: "spec" },
  planning_item: { type: "WorkPackage", label: "Work Package", layer: "Implementation & Migration", source: "spec" },
  value_stream: { type: "ValueStream", label: "Value Stream", layer: "Strategy", source: "strategy" },
  value_stream_stage: { type: "ValueStream", label: "Value Stream", layer: "Strategy", note: "A stage is itself a value stream that its parent is composed of.", source: "strategy" },
  sdlc_component: { type: "Artifact", label: "Artifact", layer: "Technology", note: "The developed code that realizes the application.", source: "technology" },
  product_model: { type: "Product", label: "Product", layer: "Business", note: "The catalog definition of a product; elements are instances of it.", source: "business" },
  ai_application: { type: "SystemSoftware", label: "System Software", layer: "Technology", source: "technology" },
  ai_function: { type: "TechnologyService", label: "Technology Service", layer: "Technology", note: "A cloud AI service consumed on demand.", source: "technology" },
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
  vcenter_instance: { type: "SystemSoftware", label: "System Software", layer: "Technology", note: "The management software for a virtualization estate.", source: "technology" },
  vcenter_datacenter: {
    type: "Grouping",
    label: "Grouping",
    layer: "Other",
    note: "A vCenter datacenter is a management container; ArchiMate groups things with a grouping. Use Location for a physical site.",
    source: "spec",
  },
  vcenter_cluster: { type: "Node", label: "Node", layer: "Technology", note: "A cluster is a node that aggregates other nodes.", source: "technology" },
  esx_server: { type: "Node", label: "Node", layer: "Technology", note: "Use Device when you mean the physical server; its hypervisor is System Software.", source: "technology" },
  vmware_instance: { type: "Node", label: "Node", layer: "Technology", note: "An execution environment its hypervisor server provides.", source: "technology" },
  vcenter_datastore: { type: "Node", label: "Node", layer: "Technology", note: "Storage presented to the servers; use Device for the physical array.", source: "technology" },
  firewall_device: { type: "Node", label: "Node", layer: "Technology", note: "Use Device when you mean the physical appliance.", source: "technology" },
  firewall_cluster: { type: "Node", label: "Node", layer: "Technology", note: "A cluster is a node that aggregates other nodes.", source: "technology" },
  load_balancer: { type: "Node", label: "Node", layer: "Technology", note: "Use Device when you mean the physical appliance.", source: "technology" },
  vpn: { type: "CommunicationNetwork", label: "Communication Network", layer: "Technology", source: "technology" },
  certificate: { type: "Artifact", label: "Artifact", layer: "Technology", note: "A certificate is a file deployed on the things that use it.", source: "technology" },
  ad_controller: { type: "SystemSoftware", label: "System Software", layer: "Technology", note: "Directory software running on its server.", source: "technology" },
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
  "business_capability>business_application": { type: "Realization", reverse: true, reads: "the application realizes the capability" },
  "business_process>business_capability": { type: "Realization", reverse: false, reads: "the process realizes the capability" },
  "business_application>information_object": { type: "Access", reverse: false, reads: "the application accesses the object" },
  "business_process>business_application": { type: "Serving", reverse: true, reads: "the application serves the process" },
  "business_service>business_service_offering": { type: "Aggregation", reverse: true, reads: "the product aggregates the service" },
  "business_capability>business_service": { type: "Realization", reverse: true, reads: "the service realizes the capability" },
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
  "api>application_service": { type: "Composition", reverse: true, reads: "the instance is composed of its interface" },
  "api>application": { type: "Realization", reverse: true, reads: "the system software realizes the interface" },
  "api>business_service_offering": { type: "Serving", reverse: false, reads: "the interface serves the product" },
  "application_service>application_service": { type: "Serving", reverse: true, reads: "the dependency serves the dependent instance" },
  "application>host": { type: "Aggregation", reverse: true, reads: "the node aggregates the system software" },
  "business_capability>business_capability": { type: "Aggregation", reverse: true, reads: "the parent capability aggregates the child" },
  "value_stream>business_capability": { type: "Serving", reverse: true, reads: "the capability serves the value stream" },
  "value_stream_stage>business_capability": { type: "Serving", reverse: true, reads: "the capability serves the stage" },
  "value_stream>business_process": { type: "Realization", reverse: true, reads: "the process realizes the value stream" },
  "value_stream_stage>business_process": { type: "Realization", reverse: true, reads: "the process realizes the stage" },
  "value_stream_stage>value_stream": { type: "Composition", reverse: true, reads: "the value stream is composed of its stages" },
  "product_idea>planning_item": { type: "Realization", reverse: true, reads: "the work realizes the idea" },
  "planning_item>goal": { type: "Realization", reverse: false, reads: "the work realizes the goal" },
  "planning_item>target": { type: "Realization", reverse: false, reads: "the work realizes the outcome" },
  "target>goal": { type: "Realization", reverse: false, reads: "the outcome realizes the goal" },
  "goal>strategic_priority": { type: "Influence", reverse: true, reads: "the driver influences the goal" },
  "product_idea>product_model": { type: "Association", reverse: false, reads: "the idea concerns the product" },
  "planning_item>product_model": { type: "Association", reverse: false, reads: "the work concerns the product" },
  "business_application>product_model": { type: "Association", reverse: false, reads: "the application is an instance of the product" },
  "application_service>product_model": { type: "Association", reverse: false, reads: "the instance is an instance of the product" },
  "business_service_offering>product_model": { type: "Association", reverse: false, reads: "the offering is an instance of the product" },
  "technology_management_service_offering>product_model": { type: "Association", reverse: false, reads: "the offering is an instance of the product" },
  "application>product_model": { type: "Association", reverse: false, reads: "the software is an instance of the product" },
  "host>product_model": { type: "Association", reverse: false, reads: "the node is an instance of the product" },
  "business_application>sdlc_component": { type: "Realization", reverse: true, reads: "the component's code realizes the application" },
  "sdlc_component>application_service": { type: "Realization", reverse: false, reads: "the component's code realizes the deployed instance" },
  "application_service>ai_application": { type: "Serving", reverse: true, reads: "the AI software serves the instance" },
  "ai_application>host": { type: "Aggregation", reverse: true, reads: "the node aggregates the AI software" },
  "application_service>ai_function": { type: "Serving", reverse: true, reads: "the AI service serves the instance" },
  "data_service_instance>ai_function": { type: "Serving", reverse: true, reads: "the AI service serves the data platform" },
  "kubernetes_cluster>kubernetes_namespace": { type: "Aggregation", reverse: false, reads: "the cluster aggregates the namespace" },
  "kubernetes_cluster>kubernetes_node": { type: "Aggregation", reverse: false, reads: "the cluster aggregates its nodes" },
  "kubernetes_cluster>kubernetes_pod": { type: "Aggregation", reverse: false, reads: "the cluster aggregates the pod" },
  "kubernetes_cluster>kubernetes_service": { type: "Composition", reverse: false, reads: "the cluster is composed of the interface" },
  "kubernetes_workload>kubernetes_cluster": { type: "Assignment", reverse: true, reads: "the cluster is assigned to run the workload" },
  "kubernetes_service>kubernetes_workload": { type: "Composition", reverse: true, reads: "the workload is reached through the interface" },
  "host>kubernetes_node": { type: "Assignment", reverse: false, reads: "the host is assigned to run the Kubernetes Node" },
  "host>kubernetes_pod": { type: "Aggregation", reverse: false, reads: "the host aggregates the pod" },
  "application_service>kubernetes_workload": { type: "Serving", reverse: true, reads: "the workload serves the instance" },
  "application_service>kubernetes_cluster": { type: "Serving", reverse: true, reads: "the cluster serves the instance" },
  "host>vmware_instance": { type: "Serving", reverse: true, reads: "the virtual machine serves the guest server" },
  "host>esx_server": { type: "Serving", reverse: true, reads: "the ESX Server serves the guest server" },
  "vmware_instance>esx_server": { type: "Serving", reverse: true, reads: "the ESX Server serves the virtual machine" },
  "vcenter_cluster>esx_server": { type: "Aggregation", reverse: false, reads: "the cluster aggregates its ESX Servers" },
  "vcenter_datacenter>vmware_instance": { type: "Aggregation", reverse: false, reads: "the datacenter groups the virtual machine" },
  "vcenter_datacenter>esx_server": { type: "Aggregation", reverse: false, reads: "the datacenter groups the ESX Server" },
  "vcenter_datacenter>vcenter_datastore": { type: "Aggregation", reverse: false, reads: "the datacenter groups the datastore" },
  "vcenter_datacenter>vcenter_cluster": { type: "Aggregation", reverse: false, reads: "the datacenter groups the cluster" },
  "vcenter_datastore>vmware_instance": { type: "Serving", reverse: false, reads: "the datastore serves the virtual machine" },
  "vcenter_datastore>esx_server": { type: "Serving", reverse: false, reads: "the datastore serves the ESX Server" },
  "vcenter_instance>host": { type: "Aggregation", reverse: true, reads: "the node aggregates the system software" },
  "application_service>vcenter_instance": { type: "Serving", reverse: true, reads: "the system software serves the instance" },
  "application_service>vcenter_cluster": { type: "Serving", reverse: true, reads: "the cluster serves the instance" },
  "ad_controller>host": { type: "Aggregation", reverse: true, reads: "the node aggregates the system software" },
  "application_service>firewall_device": { type: "Serving", reverse: true, reads: "the firewall serves the instance" },
  "application_service>firewall_cluster": { type: "Serving", reverse: true, reads: "the firewall cluster serves the instance" },
  "application_service>load_balancer": { type: "Serving", reverse: true, reads: "the load balancer serves the instance" },
  "application_service>vpn": { type: "Serving", reverse: true, reads: "the network serves the instance" },
  "application_service>ad_controller": { type: "Serving", reverse: true, reads: "the system software serves the instance" },
  "network_service_instance>firewall_device": { type: "Association", reverse: false, reads: "the network relies on the firewall" },
  "network_service_instance>firewall_cluster": { type: "Association", reverse: false, reads: "the network relies on the firewall cluster" },
  "network_service_instance>load_balancer": { type: "Association", reverse: false, reads: "the network relies on the load balancer" },
  "network_service_instance>vpn": { type: "Aggregation", reverse: false, reads: "the network aggregates the VPN" },
  "network_service_instance>ad_controller": { type: "Association", reverse: false, reads: "the network relies on the directory software" },
  "firewall_cluster>firewall_device": { type: "Aggregation", reverse: false, reads: "the cluster aggregates its firewalls" },
  "host>certificate": { type: "Assignment", reverse: false, reads: "the certificate is deployed on the node" },
  "application>certificate": { type: "Assignment", reverse: false, reads: "the certificate is deployed on the system software" },
  "load_balancer>certificate": { type: "Assignment", reverse: false, reads: "the certificate is deployed on the load balancer" },
  "firewall_device>certificate": { type: "Assignment", reverse: false, reads: "the certificate is deployed on the firewall" },
};

/** Readings for the Service Instance family, generated per pair from Figure 16's rules. */
const INSTANCE_RELATIONSHIPS: Record<string, RelationshipMapping> = Object.fromEntries(
  relationships.flatMap((r): [string, RelationshipMapping][] => {
    const key = `${r.from}>${r.to}`;
    if (key in archimateRelationships) return [];
    const [type] = r.types;
    if (r.from === "business_service_offering") return [[key, { type: "Serving", reverse: true, reads: "the instance serves the product" }]];
    if (r.from === "technology_management_service_offering") return [[key, { type: "Serving", reverse: false, reads: "the technology service serves the instance" }]];
    if (type === "Depends on::Used by") return [[key, { type: "Serving", reverse: true, reads: "the dependency serves the dependent instance" }]];
    if (type === "Connected by::Connects") return [[key, { type: "Association", reverse: false, reads: "the path connects the instance" }]];
    if (key === "connection_service_instance>network_service_instance") return [[key, { type: "Realization", reverse: true, reads: "the network realizes the path" }]];
    return [];
  }),
);

export const archimateRelationshipFor = (from: string, to: string): RelationshipMapping | undefined =>
  archimateRelationships[`${from}>${to}`] ?? INSTANCE_RELATIONSHIPS[`${from}>${to}`];

export const ARCHIMATE_TRADEMARK = "ArchiMate® is a registered trademark of The Open Group.";
