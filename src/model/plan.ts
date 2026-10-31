/**
 * Current and target state (M68): each element and relationship is Live (the default, nothing
 * stored), Planned (not there yet) or Retiring (going away). Current shows the architecture as it
 * is (without what is planned), Target as it will be (without what is retiring). Pure.
 */
import type { Edge, Model, Node, Plan } from "./schema";

export type PlanStatus = "live" | Plan;
export const PLAN_STATUSES: readonly PlanStatus[] = ["live", "planned", "retiring"];
export const PLAN_LABEL: Record<PlanStatus, string> = { live: "Live", planned: "Planned", retiring: "Retiring" };

/** What the canvas shows: Both (everything, Planned and Retiring marked), Current or Target. */
export type PlanView = "both" | "current" | "target";
export const PLAN_VIEW_LABEL: Record<PlanView, string> = { both: "Current and target", current: "Current state", target: "Target state" };

export const planOf = (x: Pick<Node | Edge, "plan">): PlanStatus => x.plan ?? "live";

/** What a plan view leaves out: the elements and relationships of the other state, and the relationships that touch a left-out element. */
export function planHidden(model: Model, view: PlanView): { nodes: ReadonlySet<string>; edges: ReadonlySet<string> } {
  if (view === "both") return { nodes: new Set(), edges: new Set() };
  const out: Plan = view === "current" ? "planned" : "retiring";
  const nodes = new Set(model.nodes.filter((n) => n.plan === out).map((n) => n.id));
  const edges = new Set(model.edges.filter((e) => e.plan === out || nodes.has(e.from) || nodes.has(e.to)).map((e) => e.id));
  return { nodes, edges };
}
