import { allowedTypes, type ClassId } from "@/metamodel";
import { createModel, type Model } from "@/model";
import { nextPosition } from "@/editor/state";

/**
 * Starter models. Fictional organizations and systems only — nothing here describes a real
 * company's estate. Each one teaches something: a complete chain, a planned application with
 * no deployment yet, and a shared platform service.
 */
type Spec = { id: string; name: string; summary: string; nodes: [string, ClassId, string][]; edges: [string, string][] };

const specs: Spec[] = [
  {
    id: "checkout",
    name: "Online store checkout",
    summary: "A complete chain: capability → business application → production and test service instances → software → hosts, exposed through a business service offering.",
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
      ["ba", "cap"],
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
      ["portal", "cap"],
      ["payroll", "cap"],
      ["portal", "svc"],
      ["bs", "bso"],
      ["bso", "svc"],
      ["svc", "api"],
    ],
  },
  {
    id: "db-platform",
    name: "Shared database platform",
    summary: "A technology management service offering shared databases: two application services depend on the same database software and network — one is not exposed yet.",
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
