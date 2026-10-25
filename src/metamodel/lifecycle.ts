/**
 * CSDM life cycle stages (M54), quoted from the CSDM 5 white paper's "Life Cycle Processes"
 * (printed pp. 20-26). Only the stage names are used, not the stage statuses. Each class gets the
 * list of the process the white paper ties its kind of record to:
 * - Product: "visible only on Product (Models) tables" (p. 21) → Product Model.
 * - Document: "document assets (Contracts) and CIs (Business Process)" (p. 26) → Business Process.
 * - Tangible / physical: "tangible / physical-related tables in Asset and CMDB" (p. 22) → the
 *   physical device classes. Ideation is "on Product Model" there, so it is not a CI stage.
 * - Intangible / logical: "logical-related tables in Asset and CMDB" (p. 24) → every other CMDB
 *   class. Ideation is "on Product Models" here too.
 * Host, Network and Load Balancer can be physical or virtual, so they offer both lists. Strategy,
 * planning and value-stream records are not CMDB tables: no life cycle.
 */
import { classes } from "./classes";
import type { SourceRef } from "./sources";

export type LifeCycleProcess = "product" | "tangible" | "logical" | "document";

export const LIFE_CYCLE: Record<LifeCycleProcess, { stages: readonly string[]; source: SourceRef }> = {
  product: { stages: ["Ideation", "Design", "Build", "Operational", "End of Life"], source: { id: "whitepaper", page: 21 } },
  tangible: { stages: ["Purchase", "Inventory", "Deploy", "Operational", "Defective", "Missing", "End of Operation", "End of Life"], source: { id: "whitepaper", page: 22 } },
  logical: { stages: ["Purchase", "Design", "Inventory", "Deploy", "Operational", "End of Operation", "End of Life"], source: { id: "whitepaper", page: 24 } },
  document: { stages: ["Ideation", "Operational", "End of Life"], source: { id: "whitepaper", page: 26 } },
};

const DOCUMENT = new Set(["business_process"]);
const PRODUCT = new Set(["product_model"]);
const TANGIBLE = new Set(["esx_server", "firewall_device"]);
const PHYSICAL_OR_VIRTUAL = new Set(["host", "network", "load_balancer"]);

/** Both lists for a class that may be physical or virtual: logical order, then the tangible-only stages. */
const BOTH = [...LIFE_CYCLE.logical.stages, ...LIFE_CYCLE.tangible.stages.filter((s) => !LIFE_CYCLE.logical.stages.includes(s))];

/** The life cycle stages a class offers, or null when its records are outside the CMDB. */
export function lifecycleFor(classId: string): { process: LifeCycleProcess | "tangible-or-logical"; stages: readonly string[] } | null {
  const c = classes.find((x) => x.id === classId);
  if (!c) return null;
  const table = "table" in c ? String(c.table) : "";
  if (/^(sn_|cmn_)/.test(table)) return null;
  if (DOCUMENT.has(c.id)) return { process: "document", stages: LIFE_CYCLE.document.stages };
  if (PRODUCT.has(c.id)) return { process: "product", stages: LIFE_CYCLE.product.stages };
  if (TANGIBLE.has(c.id)) return { process: "tangible", stages: LIFE_CYCLE.tangible.stages };
  if (PHYSICAL_OR_VIRTUAL.has(c.id)) return { process: "tangible-or-logical", stages: BOTH };
  return { process: "logical", stages: LIFE_CYCLE.logical.stages };
}

/** "An instance may be designated by environment such as Development, Test, Production, Prod1, Prod2 etc." (p. 11). Suggestions only: any text is allowed. */
export const ENVIRONMENT_EXAMPLES = { values: ["Production", "Test", "Development"], source: { id: "whitepaper", page: 11 } as SourceRef };
