import type { ClassId } from "./classes";
import type { SourceRef } from "./sources";

/**
 * How sure we are of the relationship TYPE label (the pairing itself always has a source):
 * - "reported": the label appears in ServiceNow material we cite — the white paper's relationship
 *   figure (Figure 16, p. 48) or ServiceNow product documentation;
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
