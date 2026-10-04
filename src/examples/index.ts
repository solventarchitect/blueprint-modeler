import type { Lens } from "@/frameworks";
import { allowedTypes, classes, isCsdmCore, isExtended, relationships, type ClassId, type Layer } from "@/metamodel";
import { createModel, type Model } from "@/model";
import { nextPosition, SLOT } from "@/editor/state";

/**
 * Starter models. Fictional organizations and systems only — nothing here describes a real
 * company's estate. Each one teaches something: a complete chain, a planned application with
 * no deployment yet, a shared platform service, a Kubernetes deployment in the CMDB's Kubernetes
 * classes, an AI assistant modeled like any other application, a claims system read purely in
 * ArchiMate, and the CSDM 5 core metamodel itself.
 */
/** Groups in the Examples menu, in menu order. */
export const exampleCategories = [
  { id: "application", label: "Application architecture" },
  { id: "reference", label: "Reference architecture" },
  { id: "frameworks", label: "Frameworks and metamodel" },
] as const;
export type ExampleCategory = (typeof exampleCategories)[number]["id"];

type Spec = { id: string; name: string; category: ExampleCategory; summary: string; nodes: [string, ClassId, string][]; edges: [string, string][]; lens?: Lens };

const specs: Spec[] = [
  {
    id: "checkout",
    name: "Online store checkout",
    category: "application",
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
    category: "application",
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
    category: "application",
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
    category: "reference",
    summary: "Containerization reference: a storefront in the CMDB's Kubernetes classes. Its service instance depends on its workloads and cluster, a Kubernetes Service fronts the catalog, and the cluster's nodes are hosted on servers — all offered by the platform team.",
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
    category: "application",
    summary: "An AI assistant modeled like any other application: a Business Application with its knowledge source, a production service on an AI platform offering, and the hosted language model as a CSDM 5 Data Service Instance. A planned refund agent has no deployment yet — watch the hints.",
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
      ["llm", "data_service_instance", "Hosted language model — production"],
      ["h1", "host", "app-node-01"],
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
      ["tmso", "llm"],
      ["api", "svc"],
      ["svc", "orch"],
      ["svc", "vec"],
      ["svc", "llm"],
      ["orch", "h1"],
      ["vec", "h1"],
    ],
  },
  {
    id: "archimate-claims",
    name: "Claims handling (ArchiMate view)",
    category: "frameworks",
    summary: "A claims system read purely in ArchiMate 3.2: opens in the ArchiMate-only lens, so elements show their ArchiMate type and relationships their ArchiMate name — capability, process, product, application components, interface, system software and nodes.",
    lens: "archimate-only",
    nodes: [
      ["cap", "business_capability", "Claims management"],
      ["proc", "business_process", "Handle a claim"],
      ["bs", "business_service", "Claims service"],
      ["bso", "business_service_offering", "Claims service — standard cover"],
      ["ba", "business_application", "Claims system"],
      ["data", "information_object", "Claim record"],
      ["prod", "application_service", "Claims system — production"],
      ["api", "api", "Claims API"],
      ["tms", "technology_management_service", "Hosting"],
      ["tmso", "technology_management_service_offering", "Hosting — production"],
      ["web", "application", "Claims web server"],
      ["db", "application", "Claims database"],
      ["h1", "host", "claims-prod-01"],
      ["h2", "host", "claims-db-01"],
    ],
    edges: [
      ["proc", "cap"],
      ["cap", "ba"],
      ["cap", "bs"],
      ["proc", "ba"],
      ["bs", "bso"],
      ["ba", "data"],
      ["ba", "prod"],
      ["bso", "prod"],
      ["api", "prod"],
      ["tms", "tmso"],
      ["tmso", "prod"],
      ["prod", "web"],
      ["prod", "db"],
      ["web", "h1"],
      ["db", "h2"],
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

export type Example = { id: string; name: string; category: ExampleCategory; summary: string; lens?: Lens; create: (now?: Date, id?: string) => Model };

const LAYER_ORDER: Layer[] = ["business", "design", "service", "functional", "infrastructure"];
const PER_ROW = 4;
const ROW = 190; // element height (up to ~80) + room for a vertical relationship label
const LAYER_GAP = 170; // below a layer's last row: its box padding, the next box's name tab and padding

/**
 * The CSDM 5 core metamodel as a model: one element per class in the white paper (no extended or
 * CMDB-only classes), named after the class, and one relationship per allowed pair between them.
 * Each layer wraps into rows so the poster stays readable.
 */
function metamodel(now: Date, id: string): Model {
  const core = classes.filter((c) => isCsdmCore(c) && !isExtended(c));
  const model = createModel("CSDM 5 core metamodel", now, id);
  let y = 0;
  for (const layer of LAYER_ORDER) {
    const inLayer = core.filter((c) => c.layer === layer);
    inLayer.forEach((c, i) => {
      model.nodes.push({ id: c.id, class: c.id, name: c.label });
      model.layout[c.id] = { x: (i % PER_ROW) * SLOT, y: y + Math.floor(i / PER_ROW) * ROW };
    });
    if (inLayer.length) y += Math.ceil(inLayer.length / PER_ROW - 1) * ROW + LAYER_GAP + 60;
  }
  const ids = new Set(core.map((c) => c.id as string));
  const seen = new Set<string>();
  for (const r of relationships) {
    const key = `${r.from}>${r.to}`;
    if (r.from === r.to || !ids.has(r.from) || !ids.has(r.to) || seen.has(key)) continue;
    const type = allowedTypes(r.from, r.to)[0];
    if (!type) continue;
    seen.add(key);
    model.edges.push({ id: `e${model.edges.length + 1}`, from: r.from, to: r.to, type });
  }
  return model;
}

export const examples: Example[] = [
  ...specs.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    summary: s.summary,
    lens: s.lens,
    create: (now = new Date(), id = crypto.randomUUID()) => build(s, now, id),
  })),
  {
    id: "csdm5-metamodel",
    name: "CSDM 5 core metamodel",
    category: "frameworks",
    lens: "csdm",
    summary:
      "Every class in the CSDM 5 white paper (no extended or CMDB-only classes) and each relationship the metamodel allows between them — a map to read before modeling. CSDM 6 has not been published yet (September 2026), so this is CSDM 5.",
    create: (now = new Date(), id = crypto.randomUUID()) => metamodel(now, id),
  },
];
