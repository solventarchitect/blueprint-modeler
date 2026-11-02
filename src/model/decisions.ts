/**
 * Decisions (M78): architecture decision records kept with the model, each concerning some of its
 * elements. Pure.
 */
import type { Decision, Model } from "./schema";

export type DecisionStatus = Decision["status"];
export const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = { proposed: "Proposed", accepted: "Accepted", superseded: "Superseded" };

/** The decisions that concern an element, in the model's order. */
export const decisionsAbout = (model: Model, nodeId: string) => (model.decisions ?? []).filter((d) => d.elements?.includes(nodeId));

/** The model with every decision's elements kept to those in the model (none left removes the key); the same model when nothing changes. */
export function withKnownDecisionElements(model: Model): Model {
  if (!model.decisions?.length) return model;
  const ids = new Set(model.nodes.map((n) => n.id));
  let changed = false;
  const decisions = model.decisions.map((d) => {
    if (!d.elements || d.elements.every((e) => ids.has(e))) return d;
    changed = true;
    const kept = d.elements.filter((e) => ids.has(e));
    const { elements: _gone, ...rest } = d;
    void _gone;
    return kept.length ? { ...rest, elements: kept } : rest;
  });
  return changed ? { ...model, decisions } : model;
}

/** M80: how many decisions concern each element (only elements some decision concerns). */
export function decisionCounts(model: Model): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of model.decisions ?? []) for (const e of d.elements ?? []) out.set(e, (out.get(e) ?? 0) + 1);
  return out;
}
