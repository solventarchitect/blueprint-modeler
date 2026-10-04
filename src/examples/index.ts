import type { Lens } from "@/frameworks";
import { allowedTypes, classById, classes, isCsdmCore, isExtended, relationships, type ClassId, type Layer } from "@/metamodel";
import { createModel, type Model } from "@/model";
import { nextPosition, SLOT } from "@/editor/state";

/**
 * Starter models. Fictional organizations and systems only — nothing here describes a real
 * company's estate. Each one teaches something: a complete chain, a planned application with
 * no deployment yet, a shared platform service, a Kubernetes deployment in the CMDB's Kubernetes
 * classes, an AI assistant modeled like any other application, security infrastructure behind
 * services, ServiceNow modeled as a platform in its own CMDB, server virtualization and virtual
 * desktops in the CMDB's VMware classes, a claims system read purely in ArchiMate, and the CSDM 5
 * core metamodel itself.
 */
/** Groups in the Examples menu, in menu order. */
export const exampleCategories = [
  { id: "application", label: "Application architecture" },
  { id: "security", label: "Security architecture" },
  { id: "servicenow", label: "ServiceNow platform" },
  { id: "reference", label: "Reference architecture" },
  { id: "frameworks", label: "Frameworks and metamodel" },
] as const;
export type ExampleCategory = (typeof exampleCategories)[number]["id"];

/** `grid`: hand-placed rows (see layoutGrid); without it, each layer is one row in node order. */
type Spec = { id: string; name: string; category: ExampleCategory; summary: string; nodes: [string, ClassId, string][]; edges: [string, string][]; lens?: Lens; grid?: (string | null)[][] };

const specs: Spec[] = [
  {
    id: "checkout",
    name: "Online Store Checkout",
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
    name: "HR Self-Service Portal",
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
    name: "Shared Database Platform",
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
    name: "Enterprise AI Assistant",
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
    id: "dmz-edge",
    name: "Internet Edge and DMZ",
    category: "security",
    grid: [["cap"], ["ba"], [null, "bs", "bso", "tms", "tmso"], ["svc", null, "edge"], [null, "web"], ["dmz", "h1", "fwc", "lb", "cert"], [null, "fw1", null, "fw2"]],
    summary:
      "A public customer portal behind the internet edge: its Application Service depends on the edge as a CSDM 5 Network Service Instance, built on a Firewall Cluster and a Load Balancer that uses the site's Unique Certificate. Show the certificate's blast radius to see what an expiry reaches.",
    nodes: [
      ["cap", "business_capability", "Customer self-service"],
      ["bs", "business_service", "Customer portal"],
      ["tms", "technology_management_service", "Network security"],
      ["ba", "business_application", "Customer portal"],
      ["bso", "business_service_offering", "Customer portal — public web"],
      ["tmso", "technology_management_service_offering", "Perimeter security — production"],
      ["svc", "application_service", "Customer portal — production"],
      ["edge", "network_service_instance", "Internet edge — production"],
      ["web", "application", "Portal web server"],
      ["h1", "host", "dmz-web-01"],
      ["dmz", "network", "DMZ network"],
      ["lb", "load_balancer", "edge-lb-01"],
      ["cert", "certificate", "portal.example.com"],
      ["fwc", "firewall_cluster", "edge-fw"],
      ["fw1", "firewall_device", "edge-fw-a"],
      ["fw2", "firewall_device", "edge-fw-b"],
    ],
    edges: [
      ["cap", "ba"],
      ["ba", "svc"],
      ["bs", "bso"],
      ["bso", "svc"],
      ["tms", "tmso"],
      ["tmso", "edge"],
      ["svc", "edge"],
      ["svc", "web"],
      ["svc", "dmz"],
      ["web", "h1"],
      ["edge", "lb"],
      ["edge", "fwc"],
      ["lb", "cert"],
      ["fwc", "fw1"],
      ["fwc", "fw2"],
    ],
  },
  {
    id: "directory",
    name: "Directory and Sign-In Services",
    category: "security",
    grid: [[null, "cap"], [null, "ba"], ["tms2"], ["tmso2", null, "tmso", "tms"], ["hr", "dir", "files"], [null, "dc1", "dc2"], ["c1", "h1", "h2", "c2"]],
    summary:
      "Directory services as a shared technology offering: two Active Directory Domain Controllers run on Windows servers, each server uses its certificate, and other services depend on the directory. Show the directory's blast radius to see who loses sign-in.",
    nodes: [
      ["cap", "business_capability", "Identity and access management"],
      ["tms", "technology_management_service", "Identity and access"],
      ["tms2", "technology_management_service", "Enterprise applications"],
      ["ba", "business_application", "Corporate directory"],
      ["tmso", "technology_management_service_offering", "Directory services — production"],
      ["tmso2", "technology_management_service_offering", "Enterprise applications — production"],
      ["hr", "application_service", "HR portal — production"],
      ["dir", "application_service", "Corporate directory — production"],
      ["files", "application_service", "File shares — production"],
      ["dc1", "ad_controller", "DC1"],
      ["dc2", "ad_controller", "DC2"],
      ["h1", "host", "dc-01"],
      ["c1", "certificate", "dc-01.corp.example.com"],
      ["h2", "host", "dc-02"],
      ["c2", "certificate", "dc-02.corp.example.com"],
    ],
    edges: [
      ["cap", "ba"],
      ["ba", "dir"],
      ["tms", "tmso"],
      ["tmso", "dir"],
      ["tms2", "tmso2"],
      ["tmso2", "hr"],
      ["tmso2", "files"],
      ["hr", "dir"],
      ["files", "dir"],
      ["dir", "dc1"],
      ["dir", "dc2"],
      ["dc1", "h1"],
      ["dc2", "h2"],
      ["h1", "c1"],
      ["h2", "c2"],
    ],
  },
  {
    id: "remote-access",
    name: "Remote Access VPN",
    category: "security",
    grid: [["bs", "bso", "tmso", "tms"], [null, "ra"], ["dc"], ["h", "vpn", "fwc"], [null, "fw1", "cert", "fw2"]],
    summary:
      "Remote access as a CSDM 5 Network Service Instance offered to employees: it depends on the Virtual Private Network, a Firewall Cluster whose Firewall Devices use the gateway certificate, and an Active Directory Domain Controller for sign-in.",
    nodes: [
      ["bs", "business_service", "Remote work"],
      ["tms", "technology_management_service", "Network security"],
      ["bso", "business_service_offering", "Remote access — employees"],
      ["tmso", "technology_management_service_offering", "Remote access — production"],
      ["ra", "network_service_instance", "Remote access VPN — production"],
      ["dc", "ad_controller", "DC1"],
      ["vpn", "vpn", "Employee VPN"],
      ["fwc", "firewall_cluster", "vpn-fw"],
      ["fw1", "firewall_device", "vpn-fw-a"],
      ["fw2", "firewall_device", "vpn-fw-b"],
      ["cert", "certificate", "vpn.example.com"],
      ["h", "host", "dc-01"],
    ],
    edges: [
      ["bs", "bso"],
      ["bso", "ra"],
      ["tms", "tmso"],
      ["tmso", "ra"],
      ["ra", "vpn"],
      ["ra", "fwc"],
      ["ra", "dc"],
      ["fwc", "fw1"],
      ["fwc", "fw2"],
      ["fw1", "cert"],
      ["fw2", "cert"],
      ["dc", "h"],
    ],
  },
  {
    id: "servicenow-itsm",
    name: "ServiceNow Service Management",
    category: "servicenow",
    grid: [[null, null, "proc", "cap"], [null, null, null, "ba"], ["bs", null, "tms"], ["bso1", "bso2", "tmso"], [null, null, null, "prod"]],
    summary:
      "ServiceNow modeled as a platform in its own CMDB: a Business Application, the production instance as an Application Service, IT support offerings that depend on it, and a technology offering for the team that runs it.",
    nodes: [
      ["proc", "business_process", "Resolve an incident"],
      ["cap", "business_capability", "IT service management"],
      ["bs", "business_service", "IT support"],
      ["tms", "technology_management_service", "ServiceNow platform"],
      ["ba", "business_application", "ServiceNow platform"],
      ["bso1", "business_service_offering", "IT support — incidents"],
      ["bso2", "business_service_offering", "IT support — requests"],
      ["tmso", "technology_management_service_offering", "ServiceNow administration"],
      ["prod", "application_service", "ServiceNow — production"],
    ],
    edges: [
      ["proc", "cap"],
      ["proc", "ba"],
      ["cap", "ba"],
      ["ba", "prod"],
      ["bs", "bso1"],
      ["bs", "bso2"],
      ["bso1", "prod"],
      ["bso2", "prod"],
      ["tms", "tmso"],
      ["tmso", "prod"],
    ],
  },
  {
    id: "servicenow-instances",
    name: "ServiceNow Instances and MID Servers",
    category: "servicenow",
    grid: [[null, "cap"], [null, "ba"], [null, null, null, "tms", "tmso"], ["prod", "test", "dev"], ["mid1", "mid2", "mid3"], ["h1", "h2", "h3"]],
    summary:
      "The instance estate: production, test and development instances as Application Services under one technology offering, and MID Servers — software on hosts in your own network that the instances work through — as Applications. Show a MID Server host's blast radius.",
    nodes: [
      ["cap", "business_capability", "IT service management"],
      ["tms", "technology_management_service", "ServiceNow platform"],
      ["ba", "business_application", "ServiceNow platform"],
      ["tmso", "technology_management_service_offering", "ServiceNow administration"],
      ["prod", "application_service", "ServiceNow — production"],
      ["test", "application_service", "ServiceNow — test"],
      ["dev", "application_service", "ServiceNow — development"],
      ["mid1", "application", "MID Server — production 1"],
      ["mid2", "application", "MID Server — production 2"],
      ["mid3", "application", "MID Server — non-production"],
      ["h1", "host", "mid-prod-01"],
      ["h2", "host", "mid-prod-02"],
      ["h3", "host", "mid-nonprod-01"],
    ],
    edges: [
      ["cap", "ba"],
      ["ba", "prod"],
      ["ba", "test"],
      ["ba", "dev"],
      ["tms", "tmso"],
      ["tmso", "prod"],
      ["tmso", "test"],
      ["tmso", "dev"],
      ["prod", "mid1"],
      ["prod", "mid2"],
      ["test", "mid3"],
      ["dev", "mid3"],
      ["mid1", "h1"],
      ["mid2", "h2"],
      ["mid3", "h3"],
    ],
  },
  {
    id: "servicenow-integrations",
    name: "ServiceNow Integrations",
    category: "servicenow",
    grid: [[null, "cap"], [null, "ba"], ["tms", null, null, "tms2"], ["tmso", null, null, "tmso2"], ["mon", "prod", "hr"], [null, null, null, "idp"], ["mid", "a3", "a1", "a2"], ["h"]],
    summary:
      "How the instance connects: it depends on the HR system for employee data and on the identity platform for account provisioning, each of which exposes an API; it exposes its own Events API, and monitoring, which sends it events, depends on it; a MID Server reaches the systems in your network.",
    nodes: [
      ["cap", "business_capability", "IT service management"],
      ["tms", "technology_management_service", "ServiceNow platform"],
      ["tms2", "technology_management_service", "Enterprise applications"],
      ["ba", "business_application", "ServiceNow platform"],
      ["tmso", "technology_management_service_offering", "ServiceNow administration"],
      ["tmso2", "technology_management_service_offering", "Enterprise applications — production"],
      ["mon", "application_service", "Monitoring — production"],
      ["prod", "application_service", "ServiceNow — production"],
      ["hr", "application_service", "HR system — production"],
      ["idp", "application_service", "Identity platform — production"],
      ["a3", "api", "Events API"],
      ["a1", "api", "Employee API"],
      ["a2", "api", "Provisioning API"],
      ["mid", "application", "MID Server"],
      ["h", "host", "mid-prod-01"],
    ],
    edges: [
      ["cap", "ba"],
      ["ba", "prod"],
      ["tms", "tmso"],
      ["tmso", "prod"],
      ["tms2", "tmso2"],
      ["tmso2", "hr"],
      ["tmso2", "idp"],
      ["tmso2", "mon"],
      ["prod", "hr"],
      ["prod", "idp"],
      ["mon", "prod"],
      ["a1", "hr"],
      ["a2", "idp"],
      ["a3", "prod"],
      ["prod", "mid"],
      ["mid", "h"],
    ],
  },
  {
    id: "server-virtualization",
    name: "Server Virtualization",
    category: "reference",
    grid: [["tms", "tmso", "vs"], ["vc", null, null, "inv"], ["g1", "vm1", "vm2", "g2"], ["esx1", "ds", "esx2", "esx3"], ["cl", null, null, "dc"]],
    summary:
      "Server virtualization in the CMDB's VMware classes: a VMware vCenter Datacenter holds a VMware vCenter Cluster of three ESX Servers and a datastore; each virtual machine is registered on an ESX Server and stored on the datastore, and its guest server instantiates it and is virtualized by that ESX Server. vCenter runs on one of the guests. Show an ESX Server's blast radius.",
    nodes: [
      ["tms", "technology_management_service", "Infrastructure hosting"],
      ["tmso", "technology_management_service_offering", "Virtual servers — production"],
      ["vs", "application_service", "Virtualization platform — production"],
      ["vc", "vcenter_instance", "vCenter"],
      ["inv", "application", "Inventory app"],
      ["g1", "host", "vcsa-01"],
      ["g2", "host", "app-01"],
      ["vm1", "vmware_instance", "vcsa-01"],
      ["vm2", "vmware_instance", "app-01"],
      ["ds", "vcenter_datastore", "datastore-01"],
      ["esx1", "esx_server", "esx-01"],
      ["esx2", "esx_server", "esx-02"],
      ["esx3", "esx_server", "esx-03"],
      ["cl", "vcenter_cluster", "prod-cluster-01"],
      ["dc", "vcenter_datacenter", "DC-East"],
    ],
    edges: [
      ["tms", "tmso"],
      ["tmso", "vs"],
      ["vs", "vc"],
      ["vc", "g1"],
      ["inv", "g2"],
      ["g1", "vm1"],
      ["g2", "vm2"],
      ["g1", "esx1"],
      ["g2", "esx2"],
      ["vm1", "esx1"],
      ["vm2", "esx2"],
      ["ds", "vm1"],
      ["ds", "vm2"],
      ["cl", "esx1"],
      ["cl", "esx2"],
      ["cl", "esx3"],
      ["dc", "cl"],
      ["dc", "ds"],
    ],
  },
  {
    id: "vdi",
    name: "Virtual Desktops (VDI)",
    category: "reference",
    grid: [["bs", "bso", "tmso", "tms"], [null, null, "svc"], ["broker", null, null, null, "dc"], ["bh", "d1", "lb", "d2", "dch"], ["bvm", "esx1", "cert", "esx2"], [null, null, "cl"]],
    summary:
      "Virtual desktops as a service: employees reach a gateway Load Balancer that uses its certificate, a desktop broker on a virtual machine hands out pooled Windows desktops on ESX Servers in a VMware vCenter Cluster, and an Active Directory Domain Controller signs people in. ServiceNow's public documentation has no desktop-delivery classes, so the broker is an Application, and each desktop pool is drawn as one Host.",
    nodes: [
      ["bs", "business_service", "Workplace"],
      ["tms", "technology_management_service", "End-user computing"],
      ["bso", "business_service_offering", "Virtual desktop — employees"],
      ["tmso", "technology_management_service_offering", "Virtual desktop platform — production"],
      ["svc", "application_service", "Virtual desktops — production"],
      ["broker", "application", "Desktop broker"],
      ["dc", "ad_controller", "DC1"],
      ["lb", "load_balancer", "vdi-gateway"],
      ["cert", "certificate", "desktop.example.com"],
      ["bh", "host", "broker-01"],
      ["d1", "host", "desktop-pool-01"],
      ["d2", "host", "desktop-pool-02"],
      ["dch", "host", "dc-01"],
      ["bvm", "vmware_instance", "broker-01"],
      ["esx1", "esx_server", "esx-vdi-01"],
      ["esx2", "esx_server", "esx-vdi-02"],
      ["cl", "vcenter_cluster", "vdi-cluster"],
    ],
    edges: [
      ["bs", "bso"],
      ["bso", "svc"],
      ["tms", "tmso"],
      ["tmso", "svc"],
      ["svc", "lb"],
      ["svc", "broker"],
      ["svc", "d1"],
      ["svc", "d2"],
      ["svc", "dc"],
      ["lb", "cert"],
      ["broker", "bh"],
      ["dc", "dch"],
      ["bh", "bvm"],
      ["bh", "esx1"],
      ["bvm", "esx1"],
      ["d1", "esx1"],
      ["d2", "esx2"],
      ["cl", "esx1"],
      ["cl", "esx2"],
    ],
  },
  {
    id: "archimate-claims",
    name: "Claims Handling (ArchiMate View)",
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
  if (spec.grid) model.layout = layoutGrid(spec, spec.grid);
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
 * Positions from a hand-placed grid: one row per entry, top to bottom, `null` leaving a column
 * empty. Rows of the same layer sit ROW apart; a new layer starts below the previous layer's box.
 * Placing elements by hand keeps related ones side by side, so relationships run between
 * neighbors instead of behind other elements.
 */
function layoutGrid(spec: Spec, grid: (string | null)[][]): Model["layout"] {
  const layerOf = new Map(spec.nodes.map(([nid, cls]) => [nid, classById(cls)!.layer]));
  const layout: Model["layout"] = {};
  let y = 0;
  let prev: Layer | undefined;
  for (const row of grid) {
    const layers = new Set(row.filter((n): n is string => n !== null).map((n) => layerOf.get(n)));
    if (layers.size !== 1 || layers.has(undefined)) throw new Error(`example ${spec.id}: a grid row must hold elements of one layer`);
    const layer = [...layers][0] as Layer;
    if (prev && LAYER_ORDER.indexOf(layer) < LAYER_ORDER.indexOf(prev)) throw new Error(`example ${spec.id}: grid layers out of order`);
    if (prev) y += layer === prev ? ROW : LAYER_GAP + 60;
    row.forEach((n, i) => {
      if (n === null) return;
      if (n in layout) throw new Error(`example ${spec.id}: ${n} placed twice`);
      layout[n] = { x: i * SLOT, y };
    });
    prev = layer;
  }
  for (const [nid] of spec.nodes) if (!(nid in layout)) throw new Error(`example ${spec.id}: ${nid} is not placed`);
  return layout;
}

/**
 * The CSDM 5 core metamodel as a model: one element per class in the white paper (no extended or
 * CMDB-only classes), named after the class, and one relationship per allowed pair between them.
 * Each layer wraps into rows so the poster stays readable.
 */
function metamodel(now: Date, id: string): Model {
  const core = classes.filter((c) => isCsdmCore(c) && !isExtended(c));
  const model = createModel("CSDM 5 Core Metamodel", now, id);
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
    name: "CSDM 5 Core Metamodel",
    category: "frameworks",
    lens: "csdm",
    summary:
      "Every class in the CSDM 5 white paper (no extended or CMDB-only classes) and each relationship the metamodel allows between them — a map to read before modeling. CSDM 6 has not been published yet (September 2026), so this is CSDM 5.",
    create: (now = new Date(), id = crypto.randomUUID()) => metamodel(now, id),
  },
];
