import type { ClassId } from "./classes";
import type { SourceRef } from "./sources";

/**
 * How sure we are of the relationship TYPE label (the pairing itself always has a source):
 * - "reported": the label appears in ServiceNow material we cite — the white paper's relationship
 *   figure (Figure 16, p. 48) or ServiceNow product documentation;
 * - "conventional": no public ServiceNow text we cite names the type for this pair: a standard CMDB
 *   relationship type commonly used for it, or, for records outside the CMDB, a plain description of
 *   the link. Shown as a suggestion; needs review.
 */
export type TypeEvidence = "reported" | "conventional";

export type RelDef = {
  from: ClassId;
  to: ClassId;
  /** A CMDB relationship record, or a reference field on the `from` record. */
  kind: "relationship" | "reference";
  /** Relationship type labels in ServiceNow's "parent::child" form, preferred first. */
  types: readonly string[];
  /** Types kept only so older models still load; flagged by a hint. */
  legacyTypes?: readonly string[];
  /**
   * Types accepted on load when an edge runs the other way (`to` → `from`): the direction older
   * Blueprint files used before the pair was corrected to match the white paper. Flagged by a hint.
   */
  legacyReverse?: readonly string[];
  typeEvidence: TypeEvidence;
  source: SourceRef;
  note?: string;
};

/** A reference-field edge is stored with this type. */
export const referenceType = (field: string) => `reference:${field}`;

/** The white paper's relationship figure (Figure 16). */
const FIG16 = { id: "whitepaper", page: 48 } as const;

/** Every Service Instance class: the base and its types. */
export const INSTANCES = [
  "service_instance",
  "application_service",
  "data_service_instance",
  "connection_service_instance",
  "network_service_instance",
  "operational_process_service_instance",
  "facility_service_instance",
] as const;

/** Instance types Figure 16 shows depending on other service instances. */
const DEPENDENT_INSTANCES = ["application_service", "data_service_instance", "network_service_instance", "operational_process_service_instance", "facility_service_instance"] as const;

export const relationships = [
  {
    from: "business_application",
    to: "application_service",
    kind: "relationship",
    types: ["Uses::Used by"],
    legacyTypes: ["Consumes::Consumed by"],
    typeEvidence: "reported",
    source: {
      id: "csdmCiRelationships",
      quote: "A Business Application, ultimately, relates to an Application Service table and not any other type of Service Instance.",
    },
    note: "CSDM 4 used Consumes::Consumed by; the CSDM 5 relationship figure (p. 48) shows Uses::Used by. A Business Application relates to Application Services only, not to other Service Instance types.",
  },
  {
    from: "business_capability",
    to: "business_application",
    kind: "relationship",
    types: ["Provided by::Provides"],
    legacyReverse: ["Provides::Provided by"],
    typeEvidence: "reported",
    source: FIG16,
    note: "Drawn from the capability, as the white paper's figure does. Older Blueprint files drew it from the application (Provides::Provided by).",
  },
  {
    from: "business_application",
    to: "information_object",
    kind: "relationship",
    types: ["Uses::Used by"],
    legacyTypes: [referenceType("information_object")],
    typeEvidence: "reported",
    source: FIG16,
    note: "A CMDB relationship in the CSDM 5 figure. Older Blueprint files used a reference field.",
  },
  {
    from: "business_process",
    to: "business_capability",
    kind: "relationship",
    types: ["Operationalizes::Operationalized by"],
    typeEvidence: "reported",
    source: FIG16,
  },
  {
    from: "business_process",
    to: "business_application",
    kind: "relationship",
    types: ["Depends on::Used by"],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 33, quote: "Business Applications are related to Business Processes and Business Process Activities" },
    note: "The single Business Process reference field on a Business Application is legacy in CSDM 5; use a relationship.",
  },
  {
    from: "business_service",
    to: "business_service_offering",
    kind: "reference",
    types: [referenceType("parent")],
    typeEvidence: "conventional",
    source: FIG16,
    note: "The figure shows a reference (\"Published as\") from the service to its offerings; the field name is ours.",
  },
  {
    from: "business_capability",
    to: "business_service",
    kind: "relationship",
    types: ["Provided by::Provides"],
    legacyReverse: ["Provides::Provided by"],
    typeEvidence: "reported",
    source: FIG16,
    note: "Drawn from the capability, as the white paper's figure does. Older Blueprint files drew it from the service (Provides::Provided by).",
  },
  {
    from: "technology_management_service",
    to: "technology_management_service_offering",
    kind: "reference",
    types: [referenceType("parent")],
    typeEvidence: "conventional",
    source: FIG16,
    note: "The figure shows a reference (\"Published as\") from the service to its offerings; the field name is ours.",
  },
  {
    from: "business_service_offering",
    to: "application_service",
    kind: "relationship",
    types: ["Depends on::Used by"],
    typeEvidence: "reported",
    source: FIG16,
  },
  {
    from: "technology_management_service_offering",
    to: "application_service",
    kind: "relationship",
    types: ["Contains::Contained by"],
    legacyTypes: ["Depends on::Used by"],
    typeEvidence: "reported",
    source: FIG16,
    note: "CSDM 5 shows a Technology Management Service Offering containing the service instances it covers. Older Blueprint files used Depends on::Used by.",
  },
  {
    from: "application_service",
    to: "application",
    kind: "relationship",
    types: ["Depends on::Used by"],
    typeEvidence: "reported",
    source: FIG16,
  },
  ...(["host", "network"] as const).map((to) => ({
    from: "application_service" as const,
    to,
    kind: "relationship" as const,
    types: ["Depends on::Used by"],
    typeEvidence: "conventional" as const,
    source: {
      id: "whitepaper" as const,
      page: 38,
      quote: "These applications and hosts are all configured to offer the service",
    },
    note: "A drawing shortcut. In the CMDB, an application runs on the infrastructure, and Service Mapping discovers the service's infrastructure through its applications.",
  })),
  {
    from: "api",
    to: "application_service",
    kind: "relationship",
    types: ["Receives data from::Sends data to"],
    legacyReverse: ["Depends on::Used by"],
    typeEvidence: "reported",
    source: FIG16,
    note: "Drawn from the API, as the white paper's figure does. Older Blueprint files drew it from the service (Depends on::Used by).",
  },
  {
    from: "api",
    to: "application",
    kind: "relationship",
    types: ["Provided by::Provides"],
    typeEvidence: "reported",
    source: FIG16,
  },
  {
    from: "api",
    to: "business_service_offering",
    kind: "relationship",
    types: ["Receives data from::Sends data to"],
    typeEvidence: "reported",
    source: FIG16,
  },
  {
    from: "application_service",
    to: "application_service",
    kind: "relationship",
    types: ["Depends on::Used by"],
    typeEvidence: "reported",
    source: FIG16,
  },
  {
    from: "application",
    to: "host",
    kind: "relationship",
    types: ["Runs on::Runs"],
    typeEvidence: "reported",
    source: FIG16,
    note: "The figure relates applications to infrastructure CIs in general.",
  },
  {
    from: "business_capability",
    to: "business_capability",
    kind: "reference",
    types: [referenceType("parent")],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 32, quote: "The total number of levels cannot exceed more than six in the hierarchy" },
  },
  // Service Instance family — Figure 16 relates offerings and dependencies to "Service Instance (*various)".
  ...INSTANCES.filter((to) => to !== "application_service").flatMap((to) => [
    { from: "business_service_offering" as const, to, kind: "relationship" as const, types: ["Depends on::Used by"], typeEvidence: "reported" as const, source: FIG16 },
    { from: "technology_management_service_offering" as const, to, kind: "relationship" as const, types: ["Contains::Contained by"], typeEvidence: "reported" as const, source: FIG16 },
  ]),
  ...DEPENDENT_INSTANCES.flatMap((from) =>
    INSTANCES.filter((to) => to !== "connection_service_instance" && !(from === "application_service" && to === "application_service")).map((to) => ({
      from,
      to,
      kind: "relationship" as const,
      types: ["Depends on::Used by"],
      typeEvidence: "reported" as const,
      source: FIG16,
    })),
  ),
  ...INSTANCES.filter((from) => from !== "connection_service_instance").map((from) => ({
    from,
    to: "connection_service_instance" as const,
    kind: "relationship" as const,
    types: ["Connected by::Connects"],
    typeEvidence: "reported" as const,
    source: FIG16,
  })),
  {
    from: "connection_service_instance",
    to: "network_service_instance",
    kind: "relationship",
    types: ["Provided by::Provides"],
    typeEvidence: "reported",
    source: FIG16,
  },
  // Extended classes. Foundation and Ideation & Strategy records are referential, not CMDB
  // relationships (p. 14), so these are references or mapping tables.
  ...(["business_capability", "business_process"] as const).flatMap((to) =>
    (["value_stream", "value_stream_stage"] as const).map((from) => ({
      from,
      to,
      kind: "reference" as const,
      types: ["Many-to-many map"],
      typeEvidence: "reported" as const,
      source: { id: "whitepaper" as const, page: 15, quote: "Each value stream stage may be related to one or more Business Processes and Business Capabilities through m2m tables" },
    })),
  ),
  {
    from: "value_stream_stage",
    to: "value_stream",
    kind: "reference",
    types: [referenceType("value_stream")],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 15, quote: "a distinct grouping of activities within a value stream" },
    note: "Each stage belongs to one value stream; the field name is ours.",
  },
  {
    from: "product_idea",
    to: "planning_item",
    kind: "reference",
    types: ["Promoted to"],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 30, quote: "can be curated and/or promoted into demand, project, epic, or story" },
  },
  ...(["goal", "target"] as const).map((to) => ({
    from: "planning_item" as const,
    to,
    kind: "reference" as const,
    types: ["Aligned to"],
    typeEvidence: "conventional" as const,
    source: { id: "whitepaper" as const, page: 30, quote: "Planning Items are aligned to Goals and Targets." },
  })),
  {
    from: "target",
    to: "goal",
    kind: "reference",
    types: ["Measures"],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 30, quote: "Targets are quantifiable measures for goals." },
  },
  {
    from: "goal",
    to: "strategic_priority",
    kind: "reference",
    types: ["In service of"],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 30, quote: "are often specific to business units or are in service of strategic priorities" },
  },
  ...(["product_idea", "planning_item"] as const).map((from) => ({
    from,
    to: "product_model" as const,
    kind: "reference" as const,
    types: ["Related to"],
    typeEvidence: "conventional" as const,
    source: { id: "whitepaper" as const, page: 30, quote: "ideas and planning items are related to new or existing products" },
  })),
  ...(["business_application", "application_service", "business_service_offering", "technology_management_service_offering", "application", "host"] as const).map((from) => ({
    from,
    to: "product_model" as const,
    kind: "reference" as const,
    types: [referenceType("model_id")],
    typeEvidence: "reported" as const,
    source:
      from === "business_application"
        ? { id: "whitepaper" as const, page: 33, quote: "Product Models are the core referential object on Business Application through the model_id attribute." }
        : { id: "whitepaper" as const, page: 46, quote: "Product Models are the core referential object on CIs through the model_id attribute." },
  })),
  { from: "business_application", to: "sdlc_component", kind: "relationship", types: ["Contains::Contained by"], typeEvidence: "reported", source: FIG16 },
  {
    from: "sdlc_component",
    to: "application_service",
    kind: "relationship",
    types: ["Contains::Contained by"],
    typeEvidence: "reported",
    source: FIG16,
    note: "A deployed instance of an application-type SDLC Component is an Application Service (p. 35).",
  },
  {
    from: "application_service",
    to: "ai_application",
    kind: "relationship",
    types: ["Depends on::Used by"],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 41, quote: "This is an extension from cmdb_ci_appl." },
    note: "Pairing inferred: AI Application extends Application, so it takes Application's relationships.",
  },
  {
    from: "ai_application",
    to: "host",
    kind: "relationship",
    types: ["Runs on::Runs"],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 41, quote: "AI software applications that can run on various platforms" },
    note: "Pairing inferred: AI Application extends Application, which runs on infrastructure (Figure 16).",
  },
  ...(["application_service", "data_service_instance"] as const).map((from) => ({
    from,
    to: "ai_function" as const,
    kind: "relationship" as const,
    types: ["Depends on::Used by"],
    typeEvidence: "conventional" as const,
    source: { id: "whitepaper" as const, page: 41, quote: "AI SaaS applications deployed on public cloud platforms that offer scalable, on-demand services" },
    note: "Pairing inferred: a service instance that uses a SaaS AI function depends on it. The white paper does not name this pair.",
  })),
  // Kubernetes — relationship types as the discovery documentation lists them.
  {
    from: "kubernetes_cluster",
    to: "kubernetes_namespace",
    kind: "relationship",
    types: ["Contains::Contained by"],
    typeEvidence: "reported",
    source: { id: "k8sDiscovery", quote: "Kubernetes Cluster [cmdb_ci_kubernetes_cluster] Contains::Contained By Kubernetes Namespace" },
  },
  {
    from: "kubernetes_cluster",
    to: "kubernetes_node",
    kind: "relationship",
    types: ["Cluster of::Cluster"],
    typeEvidence: "reported",
    source: { id: "k8sDiscovery" },
  },
  {
    from: "kubernetes_cluster",
    to: "kubernetes_pod",
    kind: "relationship",
    types: ["Contains::Contained by"],
    typeEvidence: "reported",
    source: { id: "k8sDiscovery" },
  },
  {
    from: "kubernetes_cluster",
    to: "kubernetes_service",
    kind: "relationship",
    types: ["Contains::Contained by"],
    typeEvidence: "reported",
    source: { id: "k8sDiscovery" },
  },
  {
    from: "kubernetes_workload",
    to: "kubernetes_cluster",
    kind: "relationship",
    types: ["Hosted on::Hosts"],
    typeEvidence: "reported",
    source: { id: "k8sDiscovery", quote: "Kubernetes Workload [cmdb_ci_kubernetes_workload] Hosted on::Hosts Kubernetes Cluster" },
  },
  {
    from: "kubernetes_service",
    to: "kubernetes_workload",
    kind: "relationship",
    types: ["Provides::Provided by"],
    typeEvidence: "reported",
    source: { id: "k8sDiscovery", quote: "Kubernetes Service [cmdb_ci_kubernetes_service] Provides::Provided By Kubernetes Workload" },
  },
  {
    from: "host",
    to: "kubernetes_node",
    kind: "relationship",
    types: ["Hosts::Hosted on"],
    typeEvidence: "reported",
    source: { id: "k8sDiscovery" },
    note: "The documentation names a Linux server as the host.",
  },
  {
    from: "host",
    to: "kubernetes_pod",
    kind: "relationship",
    types: ["Contains::Contained by"],
    typeEvidence: "reported",
    source: { id: "k8sDiscovery" },
    note: "The documentation names a Linux server as the host.",
  },
  ...(["kubernetes_workload", "kubernetes_cluster"] as const).map((to) => ({
    from: "application_service" as const,
    to,
    kind: "relationship" as const,
    types: ["Depends on::Used by"],
    typeEvidence: "conventional" as const,
    source: {
      id: "whitepaper" as const,
      page: 38,
      quote: "These applications and hosts are all configured to offer the service",
    },
    note: "Pairing inferred: a workload and its cluster are components configured to offer the service, like applications and hosts. The Kubernetes documentation does not name this pair.",
  })),
  // Server virtualization: types and directions as the vCenter discovery documentation lists them
  // (parent first). Its guest server is Computer [cmdb_ci_computer], drawn here as a Host.
  {
    from: "host",
    to: "vmware_instance",
    kind: "relationship",
    types: ["Instantiates::Instantiated by"],
    typeEvidence: "reported",
    source: { id: "vcenterData", quote: "Computer [cmdb_ci_computer] Instantiates::Instantiated by VM Instance [cmdb_ci_vmware_instance]" },
    note: "Drawn from the guest server, as the documentation lists it: the server is the operating system the virtual machine runs.",
  },
  {
    from: "host",
    to: "esx_server",
    kind: "relationship",
    types: ["Virtualized by::Virtualizes"],
    typeEvidence: "reported",
    source: { id: "vcenterData", quote: "Computer [cmdb_ci_computer] Virtualized by::Virtualizes ESX Server [cmdb_ci_esx_server]" },
  },
  {
    from: "vmware_instance",
    to: "esx_server",
    kind: "relationship",
    types: ["Registered on::Has registered"],
    typeEvidence: "reported",
    source: { id: "vcenterData", quote: "VMware Virtual Machine Instance [cmdb_ci_vmware_instance] Registered on::Has registered ESX Server [cmdb_ci_esx_server]" },
  },
  {
    from: "vcenter_cluster",
    to: "esx_server",
    kind: "relationship",
    types: ["Members::Member of"],
    typeEvidence: "reported",
    source: { id: "vcenterData", quote: "VMware vCenter Cluster [cmdb_ci_vcenter_cluster] Members::Member of ESX Server [cmdb_ci_esx_server]" },
  },
  ...(["vmware_instance", "esx_server", "vcenter_datastore", "vcenter_cluster"] as const).map((to) => ({
    from: "vcenter_datacenter" as const,
    to,
    kind: "relationship" as const,
    types: ["Contains::Contained by"],
    typeEvidence: "reported" as const,
    source: { id: "vcenterData" as const },
  })),
  {
    from: "vcenter_datastore",
    to: "vmware_instance",
    kind: "relationship",
    types: ["Provides storage for::Stored on"],
    typeEvidence: "reported",
    source: { id: "vcenterData" },
  },
  {
    from: "vcenter_datastore",
    to: "esx_server",
    kind: "relationship",
    types: ["Used by::Uses"],
    typeEvidence: "reported",
    source: { id: "vcenterData" },
  },
  {
    from: "vcenter_instance",
    to: "host",
    kind: "relationship",
    types: ["Runs on::Runs"],
    typeEvidence: "conventional",
    source: { id: "cmdbTables", quote: "Installed instance of VMware VCenter software." },
    note: "Pairing inferred: vCenter is installed software, and applications run on infrastructure (white paper Figure 16). The vCenter documentation does not name this pair.",
  },
  ...(["vcenter_instance", "vcenter_cluster"] as const).map((to) => ({
    from: "application_service" as const,
    to,
    kind: "relationship" as const,
    types: ["Depends on::Used by"],
    typeEvidence: "conventional" as const,
    source: { id: "whitepaper" as const, page: 38, quote: "These applications and hosts are all configured to offer the service" },
    note: "Pairing inferred: the platform's management software and cluster are configured to offer the service, like applications and hosts. The vCenter documentation does not name this pair.",
  })),
  // Security. ServiceNow's documentation names these classes but not, except for the domain
  // controller, how they relate; the pairs below are inferred and their types conventional.
  {
    from: "ad_controller",
    to: "host",
    kind: "relationship",
    types: ["Runs on::Runs"],
    typeEvidence: "reported",
    source: { id: "adDiscovery", quote: "Active Directory Domain Controller [cmdb_ci_ad_controller] Runs on::Runs Windows Server [cmdb_ci_win_server]" },
    note: "The documentation names a Windows server as the host.",
  },
  ...(["firewall_device", "firewall_cluster", "load_balancer", "vpn", "ad_controller"] as const).flatMap((to) => [
    {
      from: "application_service" as const,
      to,
      kind: "relationship" as const,
      types: ["Depends on::Used by"],
      typeEvidence: "conventional" as const,
      source: { id: "whitepaper" as const, page: 38, quote: "These applications and hosts are all configured to offer the service" },
      note: "Pairing inferred: security infrastructure the service is configured to use, like its applications and hosts.",
    },
    {
      from: "network_service_instance" as const,
      to,
      kind: "relationship" as const,
      types: ["Depends on::Used by"],
      typeEvidence: "conventional" as const,
      source: { id: "whitepaper" as const, page: 39 },
      note: "Pairing inferred: a Network Service Instance is built on network functions such as firewalls, load balancers and VPNs.",
    },
  ]),
  {
    from: "firewall_cluster",
    to: "firewall_device",
    kind: "relationship",
    types: ["Cluster of::Cluster"],
    typeEvidence: "conventional",
    source: { id: "firewallClasses", quote: "Group of firewall nodes that work as a single logical entity." },
    note: "The type Kubernetes discovery uses between a cluster and its nodes; the firewall documentation does not name one.",
  },
  ...(["host", "application", "load_balancer", "firewall_device"] as const).map((from) => ({
    from,
    to: "certificate" as const,
    kind: "relationship" as const,
    types: ["Uses::Used by"],
    typeEvidence: "conventional" as const,
    source: {
      id: "certificateTables" as const,
      quote: "All the relationships with the managed certificate are stored in the CI Relationship [cmdb_rel_ci] table. The relationships can be for servers, applications, or business services.",
    },
    note:
      from === "firewall_device"
        ? "Pairing inferred: a firewall that ends VPN or TLS sessions holds a certificate as a server does. The documentation does not name the type."
        : "The documentation does not name the type; Uses::Used by reads as the CI using its certificate.",
  })),
] as const satisfies readonly RelDef[];
