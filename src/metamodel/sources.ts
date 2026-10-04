/**
 * Public sources for every metamodel entry (CLAUDE.md rule 3). Only ServiceNow-published or
 * ServiceNow-hosted material. Page numbers are the CSDM 5 white paper's printed page numbers.
 */
export type SourceId = keyof typeof sources;

export const sources = {
  whitepaper: {
    title: "CSDM 5 white paper (Scott Lemm, Rob Koeten)",
    url: "https://www.servicenow.com/community/s/cgfwn76974/attachments/cgfwn76974/common-service-data-model-kb/744/3/CSDM%205%20w%20links.pdf",
  },
  csdmCiRelationships: {
    title: "CSDM CI relationships (ServiceNow docs)",
    url: "https://www.servicenow.com/docs/r/servicenow-platform/common-service-data-model-csdm/ci-relationships.html",
  },
  whitepaperAnnouncement: {
    title: "CSDM 5 — get the CSDM 5 white paper (ServiceNow Community)",
    url: "https://www.servicenow.com/community/common-service-data-model/csdm-5-finally-get-the-csdm-5-white-paper-here/ta-p/3254967",
  },
  baToServiceInstanceType: {
    title: "CSDM 5.0 — Business App to Service Instance relationship change (ServiceNow Community)",
    url: "https://www.servicenow.com/community/common-service-data-model-forum/csdm-5-0-business-app-to-service-instance-relationship-change/m-p/3299351",
  },
  k8sDiscovery: {
    title: "Kubernetes discovery using patterns (ServiceNow docs, Yokohama)",
    url: "https://www.servicenow.com/docs/bundle/yokohama-it-operations-management/page/product/service-mapping/concept/kubernetes-discovery.html",
  },
  k8sExtensionClasses: {
    title: "Kubernetes extension classes (ServiceNow docs, Yokohama)",
    url: "https://www.servicenow.com/docs/r/yokohama/servicenow-platform/cmdb-ci-class-models/cmdb-ci-class-models-kubernetes.html",
  },
  ciRelTypeDefinitions: {
    title: "Definition which reflects the relationship types' purpose (ServiceNow Community, accepted solution)",
    url: "https://www.servicenow.com/community/itom-forum/definiton-which-reflects-the-relationship-types-purpose/td-p/2937885",
  },
  whatIsCsdm: {
    title: "What is CSDM? (ServiceNow)",
    url: "https://www.servicenow.com/products/it-operations-management/what-is-csdm.html",
  },
  vcenterData: {
    title: "Data collected for VMware vCenter Server (ServiceNow docs, Xanadu)",
    url: "https://www.servicenow.com/docs/r/LZHoJyH9VPKmhdIph_6gSw/MrxGJ1ymu0tR1YLAO8gLPw",
  },
  cmdbTables: {
    title: "CMDB tables descriptions (ServiceNow docs, Australia)",
    url: "https://www.servicenow.com/docs/r/q4dSP2Icgr1SFv5wanVXvQ/1GLrH0vZKHQqi0lHfIjuTw",
  },
  firewallClasses: {
    title: "Firewall extension classes (ServiceNow docs, Zurich)",
    url: "https://www.servicenow.com/docs/r/zS6yb8e~gR8BPjeviYdV9g/kzOkxVxTwpgzyWjlyFXTNg",
  },
  tlsClasses: {
    title: "Transport Layer Security (TLS) extension classes (ServiceNow docs, Australia)",
    url: "https://www.servicenow.com/docs/r/q4dSP2Icgr1SFv5wanVXvQ/pl0wRmikajlXfxHlVTDgyQ",
  },
  certificateTables: {
    title: "Certificate Inventory and Management tables (ServiceNow docs, Yokohama)",
    url: "https://www.servicenow.com/docs/r/Tm19yM2Ui3~uN9XFBacppg/sLX~EcXPv4RqvF~K8BHrNQ",
  },
  adDiscovery: {
    title: "Active Directory Domain Controller discovery (ServiceNow docs, Yokohama)",
    url: "https://www.servicenow.com/docs/r/Tm19yM2Ui3~uN9XFBacppg/P8eRF~oQRpn6OQ541CbyGw",
  },
} as const satisfies Record<string, { title: string; url: string }>;

/** A citation: which source, and where in it. */
export type SourceRef = { id: SourceId; page?: number; quote?: string };
