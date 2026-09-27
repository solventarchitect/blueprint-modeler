import { allowedTypes, type ClassId } from "@/metamodel";
import { createModel, type Model } from "@/model";
import { nextPosition } from "@/editor/state";

/**
 * Starter models. Fictional organizations and systems only — nothing here describes a real
 * company's estate. Each one teaches something: a complete chain, a planned application with
 * no deployment yet, a shared platform service, a Kubernetes deployment in the CMDB's Kubernetes
 * classes, and an AI assistant modeled like any other application.
 */
type Spec = { id: string; name: string; summary: string; nodes: [string, ClassId, string][]; edges: [string, string][] };

const specs: Spec[] = [
  {
    id: "checkout",
    name: "Online store checkout",
    summary: "A complete chain: capability → Business Application → production and test service instances → software → hosts, exposed through a Business Service Offering.",
    nodes: [
      ["cap", "business_capability", "Order management"],
      ["ba", "business_application", "Checkout"],
      ["data", "information_object", "Customer orders"],
      ["bs", "business_service", "Online shopping"],
      ["bso", "business_service_offering", "Online shopping — North America"],
      ["tms", "technology_management_service", "Application hosting"],
      ["tmso", "technology_management_service_offering", "Application hosting — non-production"],
      ["prod", "application_service", "Checkout — production"],
      ["test", "application_service", "Checkout — test"],
      ["web", "application", "Checkout web app"],
      ["db", "application", "Orders database"],
      ["h1", "host", "web-prod-01"],
      ["h2", "host", "db-prod-01"],
      ["h3", "host", "web-test-01"],
    ],
    edges: [
      ["cap", "ba"],
      ["ba", "data"],
      ["ba", "prod"],
      ["ba", "test"],
      ["bs", "bso"],
      ["bso", "prod"],
      ["tms", "tmso"],
      ["tmso", "test"],
      ["prod", "web"],
      ["prod", "db"],
      ["test", "h3"],
      ["web", "h1"],
      ["db", "h2"],
    ],
  },
  {
    id: "hr-portal",
    name: "HR self-service portal",
    summary: "A process-led view: onboarding depends on an HR portal delivered as a service, and a planned payroll application with no deployment yet — watch the hints.",
    nodes: [
      ["proc", "business_process", "Onboard a new hire"],
      ["cap", "business_capability", "Workforce management"],
      ["portal", "business_application", "HR portal"],
      ["payroll", "business_application", "Payroll (planned)"],
      ["bs", "business_service", "HR help"],
      ["bso", "business_service_offering", "HR help — employees"],
      ["svc", "application_service", "HR portal — production"],
      ["api", "api", "Payroll API"],
    ],
    edges: [
      ["proc", "portal"],
      ["cap", "portal"],
      ["cap", "payroll"],
      ["portal", "svc"],
      ["bs", "bso"],
      ["bso", "svc"],
      ["api", "svc"],
    ],
  },
  {
    id: "db-platform",
    name: "Shared database platform",
    summary: "A Technology Management Service Offering shared databases: two Application Services depend on the same database software and network — one is not exposed yet.",
    nodes: [
      ["tms", "technology_management_service", "Database hosting"],
      ["tmso", "technology_management_service_offering", "PostgreSQL — production"],
      ["a", "business_application", "Inventory"],
      ["b", "business_application", "Reporting"],
      ["sa", "application_service", "Inventory — production"],
      ["sb", "application_service", "Reporting — production"],
      ["pg", "application", "PostgreSQL cluster"],
      ["h1", "host", "pg-node-01"],
      ["h2", "host", "pg-node-02"],
      ["net", "network", "Data-center network"],
    ],
    edges: [
      ["tms", "tmso"],
      ["a", "sa"],
      ["b", "sb"],
      ["tmso", "sa"],
      ["sa", "pg"],
      ["sb", "pg"],
      ["sa", "net"],
      ["pg", "h1"],
      ["pg", "h2"],
    ],
  },
  {
    id: "kubernetes",
    name: "Storefront on Kubernetes",
    summary: "A containerized app in the CMDB's Kubernetes classes: the storefront's service instance depends on its workloads and cluster, a Kubernetes Service fronts the catalog, and the cluster's nodes are hosted on servers — all offered by the platform team.",
    nodes: [
      ["cap", "business_capability", "Digital commerce"],
      ["ba", "business_application", "Storefront"],
      ["bs", "business_service", "Online store"],
      ["bso", "business_service_offering", "Online store — web"],
      ["tms", "technology_management_service", "Container platform"],
      ["tmso", "technology_management_service_offering", "Kubernetes — production"],
      ["svc", "application_service", "Storefront — production"],
      ["api", "api", "Catalog API"],
      ["ns", "kubernetes_namespace", "storefront"],
      ["web", "kubernetes_workload", "storefront-web"],
      ["cat", "kubernetes_workload", "catalog-service"],
      ["ksvc", "kubernetes_service", "catalog"],
      ["cluster", "kubernetes_cluster", "prod-cluster"],
      ["n1", "kubernetes_node", "node-a"],
      ["n2", "kubernetes_node", "node-b"],
      ["h1", "host", "vm-node-a"],
      ["h2", "host", "vm-node-b"],
    ],
    edges: [
      ["cap", "ba"],
      ["ba", "svc"],
      ["bs", "bso"],
      ["bso", "svc"],
      ["tms", "tmso"],
      ["tmso", "svc"],
      ["api", "svc"],
      ["svc", "web"],
      ["svc", "cat"],
      ["svc", "cluster"],
      ["web", "cluster"],
      ["cat", "cluster"],
      ["ksvc", "cat"],
      ["cluster", "ns"],
      ["cluster", "ksvc"],
      ["cluster", "n1"],
      ["cluster", "n2"],
      ["h1", "n1"],
      ["h2", "n2"],
    ],
  },
  {
    id: "enterprise-ai",
    name: "Enterprise AI assistant",
    summary: "An AI assistant modeled like any other application: a Business Application with its knowledge source, a production service on an AI platform offering, and the model and index it runs on. A planned refund agent has no deployment yet — watch the hints.",
    nodes: [
      ["proc", "business_process", "Resolve a customer case"],
      ["cap", "business_capability", "Customer support"],
      ["ba", "business_application", "Support assistant"],
      ["agent", "business_application", "Refund agent (planned)"],
      ["kb", "information_object", "Knowledge articles"],
      ["bs", "business_service", "Customer support"],
      ["bso", "business_service_offering", "Customer support — chat"],
      ["tms", "technology_management_service", "AI platform"],
      ["tmso", "technology_management_service_offering", "Model gateway — production"],
      ["svc", "application_service", "Support assistant — production"],
      ["api", "api", "Model gateway API"],
      ["orch", "application", "Assistant orchestrator"],
      ["vec", "application", "Vector index"],
      ["llm", "application", "Hosted language model"],
      ["h1", "host", "app-node-01"],
      ["gpu", "host", "gpu-node-01"],
    ],
    edges: [
      ["proc", "ba"],
      ["cap", "ba"],
      ["cap", "agent"],
      ["ba", "kb"],
      ["ba", "svc"],
      ["bs", "bso"],
      ["bso", "svc"],
      ["tms", "tmso"],
      ["tmso", "svc"],
      ["api", "svc"],
      ["svc", "orch"],
      ["svc", "vec"],
      ["svc", "llm"],
      ["orch", "h1"],
      ["vec", "h1"],
      ["llm", "gpu"],
    ],
  },
];

function build(spec: Spec, now: Date, id: string): Model {
  let model = createModel(spec.name, now, id);
  for (const [nid, cls, name] of spec.nodes) {
    model = { ...model, nodes: [...model.nodes, { id: nid, class: cls, name }], layout: { ...model.layout, [nid]: nextPosition(model, cls) } };
  }
  const classOf = new Map(spec.nodes.map(([nid, cls]) => [nid, cls]));
  model.edges = spec.edges.map(([from, to], i) => {
    const type = allowedTypes(classOf.get(from)!, classOf.get(to)!)[0];
    if (!type) throw new Error(`example ${spec.id}: ${from} → ${to} is not allowed`);
    return { id: `e${i + 1}`, from, to, type };
  });
  return model;
}

export type Example = { id: string; name: string; summary: string; create: (now?: Date, id?: string) => Model };

export const examples: Example[] = specs.map((s) => ({
  id: s.id,
  name: s.name,
  summary: s.summary,
  create: (now = new Date(), id = crypto.randomUUID()) => build(s, now, id),
}));
