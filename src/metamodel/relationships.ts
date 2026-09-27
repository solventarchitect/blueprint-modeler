import type { ClassId } from "./classes";
import type { SourceRef } from "./sources";

/**
 * How sure we are of the relationship TYPE label (the pairing itself always has a source):
 * - "reported": the label appears in the white paper graphic, per a ServiceNow Community thread;
 * - "conventional": a standard CMDB relationship type commonly used for this pairing, but no
 *   public ServiceNow text we cite names it for this pair. Shown as a suggestion; needs review.
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
  typeEvidence: TypeEvidence;
  source: SourceRef;
  note?: string;
};

/** A reference-field edge is stored with this type. */
export const referenceType = (field: string) => `reference:${field}`;

export const relationships = [
  {
    from: "business_application",
    to: "application_service",
    kind: "relationship",
    types: ["Uses::Used by"],
    legacyTypes: ["Consumes::Consumed by"],
    typeEvidence: "reported",
    source: { id: "baToServiceInstanceType" },
    note: "CSDM 4 used Consumes::Consumed by; the CSDM 5 white paper graphic (p. 48) shows Uses::Used by, while its paragraph still says consumes.",
  },
  {
    from: "business_application",
    to: "business_capability",
    kind: "relationship",
    types: ["Provides::Provided by"],
    typeEvidence: "conventional",
    source: {
      id: "whitepaper",
      page: 31,
      quote: "It is recommended that you establish a CI relationship between the business capability and the business applications",
    },
  },
  {
    from: "business_application",
    to: "information_object",
    kind: "reference",
    types: [referenceType("information_object")],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 33, quote: "referenced by the business application" },
  },
  {
    from: "business_process",
    to: "business_application",
    kind: "relationship",
    types: ["Depends on::Used by"],
    typeEvidence: "conventional",
    source: { id: "whitepaper", quote: "Business applications are related to Business Processes and Business Process Activities" },
    note: "The single Business Process reference field on a Business Application is legacy in CSDM 5; use a relationship.",
  },
  {
    from: "business_service",
    to: "business_service_offering",
    kind: "reference",
    types: [referenceType("parent")],
    typeEvidence: "conventional",
    source: { id: "whitepaper", quote: "has one or more Business Service Offerings" },
  },
  {
    from: "business_service",
    to: "business_capability",
    kind: "relationship",
    types: ["Provides::Provided by"],
    typeEvidence: "conventional",
    source: { id: "whitepaper", quote: "typically underpins one or more business capabilities" },
  },
  {
    from: "technology_management_service",
    to: "technology_management_service_offering",
    kind: "reference",
    types: [referenceType("parent")],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 42 },
  },
  {
    from: "business_service_offering",
    to: "application_service",
    kind: "relationship",
    types: ["Depends on::Used by"],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 39, quote: "The offering of application services should be exposed via the related business or technical service offering." },
  },
  {
    from: "technology_management_service_offering",
    to: "application_service",
    kind: "relationship",
    types: ["Depends on::Used by"],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 39, quote: "The offering of application services should be exposed via the related business or technical service offering." },
  },
  ...(["application", "host", "network", "api"] as const).map((to) => ({
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
  })),
  {
    from: "application_service",
    to: "application_service",
    kind: "relationship",
    types: ["Depends on::Used by"],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 11 },
    note: "Service-to-service dependencies; the white paper does not name the type.",
  },
  {
    from: "application",
    to: "host",
    kind: "relationship",
    types: ["Runs on::Runs"],
    typeEvidence: "conventional",
    source: { id: "whitepaper", page: 38 },
  },
  {
    from: "business_capability",
    to: "business_capability",
    kind: "reference",
    types: [referenceType("parent")],
    typeEvidence: "conventional",
    source: { id: "whitepaper", quote: "The total number of levels cannot exceed more than six in the hierarchy" },
  },
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
] as const satisfies readonly RelDef[];
