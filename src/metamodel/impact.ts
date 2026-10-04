import type { ClassId } from "./classes";
import { relationships, type RelDef } from "./relationships";
import type { SourceRef } from "./sources";

/**
 * Which way impact travels along a relationship, for the blast-radius view.
 *
 * Relationship types are stored in ServiceNow's "parent::child" form with `from` as the parent.
 * A rule names the end that is affected when the other end fails:
 * - "from": the parent depends on the child (a failing child affects its parent);
 * - "to": the child depends on the parent (a failing parent affects its child);
 * - "none": the link records planning, strategy or build-time structure, not a runtime dependency.
 *
 * Evidence:
 * - "stated": a ServiceNow-hosted source states the direction for this type;
 * - "conventional": our reading of the type's name and of how CSDM uses the pair. Needs review.
 *
 * This is a what-if on the model, not ServiceNow's Impacted Services calculation, which follows its
 * own rules.
 */
export type ImpactEnd = "from" | "to" | "none";
export type ImpactEvidence = "stated" | "conventional";
export type ImpactRule = { dependent: ImpactEnd; evidence: ImpactEvidence; source: SourceRef; why: string };

const STATED: SourceRef = {
  id: "ciRelTypeDefinitions",
  quote: "Parent CI depends on child CI. Meaning that problem/change in the child CI may impact the parent CI.",
};

const conventional = (dependent: ImpactEnd, why: string, source: SourceRef = { id: "csdmCiRelationships" }): ImpactRule => ({
  dependent,
  evidence: "conventional",
  source,
  why,
});

/** Rules by preferred relationship type. */
const byType: Record<string, ImpactRule> = {
  "Depends on::Used by": { dependent: "from", evidence: "stated", source: STATED, why: "The parent depends on the child, so a failing child affects the parent." },
  "Uses::Used by": conventional("from", "The parent uses the child, so a failing child affects the parent."),
  "Runs on::Runs": conventional("from", "Software runs on its host, so a failing host affects what runs on it.", {
    id: "ciRelTypeDefinitions",
    quote: "Typically between a CI that represents a software application, to the hosting hardware/VM.",
  }),
  "Hosted on::Hosts": conventional("from", "An element hosted on another stops when its host fails.", {
    id: "ciRelTypeDefinitions",
    quote: "Hosting relationship between an element and its host.",
  }),
  "Hosts::Hosted on": conventional("to", "A host carries what it hosts, so a failing host affects the hosted element."),
  "Provided by::Provides": conventional("from", "Whatever is provided by the child is lost when the child fails."),
  "Receives data from::Sends data to": conventional("from", "The receiver depends on the sender for its data."),
  "Connected by::Connects": conventional("from", "An instance reached through a connection is cut off when the connection fails."),
  "Cluster of::Cluster": conventional("from", "A cluster is made of its members, so failing members degrade the cluster."),
  "Operationalizes::Operationalized by": conventional("to", "A capability is carried out by its processes, so a failing process affects the capability."),
  "Contains::Contained by": conventional("to", "What runs inside a container stops when the container fails.", {
    id: "ciRelTypeDefinitions",
    quote: "Typically a containment relationship (CI to contained CI).",
  }),
  "Instantiates::Instantiated by": conventional("from", "A guest server is the operating system its virtual machine runs, so a failing virtual machine takes the server down.", { id: "vcenterData" }),
  "Virtualized by::Virtualizes": conventional("from", "A virtualized server runs on its hypervisor server, so a failing hypervisor affects it.", { id: "vcenterData" }),
  "Registered on::Has registered": conventional("from", "A virtual machine runs on the server it is registered on, so a failing server affects it.", { id: "vcenterData" }),
  "Members::Member of": conventional("from", "A cluster is made of its members, so failing members degrade the cluster.", { id: "vcenterData" }),
  "Provides storage for::Stored on": conventional("to", "What is stored on a datastore is affected when the datastore fails.", { id: "vcenterData" }),
  "reference:parent": conventional("from", "A service is made up of its offerings, so a failing offering affects the service."),
};

const NONE = (why: string, source: SourceRef) => conventional("none", why, source);
const BUILD_TIME = NONE("Records how software is built and released, not a runtime dependency.", { id: "whitepaper", page: 34 });

/** Pairs whose meaning differs from their type's default. */
const byPair: Partial<Record<`${ClassId}>${ClassId}`, ImpactRule>> = {
  "business_capability>business_capability": conventional(
    "to",
    "A capability rolls up into its parent capability, so the parent is affected when a part of it is.",
    { id: "whitepaper", page: 32 },
  ),
  // A Kubernetes Service fronts its workload: when the workload fails the service has nothing to serve.
  "kubernetes_service>kubernetes_workload": conventional("from", "The service fronts the workload, so a failing workload leaves it with nothing to serve.", { id: "k8sDiscovery" }),
  // An ESX Server mounts a datastore, but only the virtual machines stored on it are affected when it
  // fails; that path is drawn by Provides storage for, so this link does not spread impact.
  "vcenter_datastore>esx_server": NONE("The server mounts the datastore, but only virtual machines stored on it are affected; Provides storage for carries that.", { id: "vcenterData" }),
  "business_application>sdlc_component": BUILD_TIME,
  "sdlc_component>application_service": BUILD_TIME,
};

/** A Technology Management Service Offering contains the service instances it covers (Figure 16). */
const OFFERING_CONTAINS = conventional(
  "from",
  "An offering covers the service instances it contains, so a failing instance affects the offering.",
  { id: "whitepaper", page: 48 },
);

const PLANNING = NONE("Records planning or strategy information, which is referential, not a runtime dependency.", { id: "whitepaper", page: 14 });
const PRODUCT_MODEL = NONE("Points to a product model record, not a runtime dependency.", { id: "whitepaper", page: 46 });

/** Types that never spread impact: planning, strategy, mapping and product-model references. */
const NON_RUNTIME = new Set(["Promoted to", "Aligned to", "Measures", "In service of", "Many-to-many map", "Related to"]);

export function impactRule(def: RelDef): ImpactRule {
  const pair = byPair[`${def.from}>${def.to}`];
  if (pair) return pair;
  const type = def.types[0] ?? "";
  if (def.from === "technology_management_service_offering" && type === "Contains::Contained by") return OFFERING_CONTAINS;
  if (type === "reference:model_id") return PRODUCT_MODEL;
  if (byType[type]) return byType[type];
  if (NON_RUNTIME.has(type) || type.startsWith("reference:")) return PLANNING;
  return NONE("No impact rule for this relationship type.", { id: "csdmCiRelationships" });
}

/** Guide rows: one per distinct rule, with the pairs it covers. */
export type ImpactRow = { type: string; rule: ImpactRule; effect: string; pairs: { from: ClassId; to: ClassId }[] };

export function impactRows(): ImpactRow[] {
  const rows = new Map<string, ImpactRow>();
  for (const r of relationships) {
    const rule = impactRule(r);
    const type = r.types[0] ?? "";
    const key = `${type}|${rule.dependent}|${rule.why}`;
    const effect =
      rule.dependent === "from"
        ? "When the To element fails, the From element is affected."
        : rule.dependent === "to"
          ? "When the From element fails, the To element is affected."
          : "Does not spread impact.";
    const row = rows.get(key) ?? { type, rule, effect, pairs: [] };
    row.pairs.push({ from: r.from, to: r.to });
    rows.set(key, row);
  }
  return [...rows.values()];
}
