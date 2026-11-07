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

/** M85: where a decision's chain of replacements leads, following each Superseded by once (stops at a loop). */
function chain(byId: Map<string, Decision>, from: string): string[] {
  const seen: string[] = [];
  for (let at: string | undefined = from; at && !seen.includes(at); at = byId.get(at)?.supersededBy) seen.push(at);
  return seen;
}

/** M85: the decisions a decision replaces (that are Superseded by it), in the model's order. */
export const decisionsSupersededBy = (model: Model, id: string) => (model.decisions ?? []).filter((d) => d.supersededBy === id);

/**
 * M85: the decisions that can replace one: any other, except one whose own chain of replacements
 * already leads back to it (that would make a loop). In the model's order.
 */
export function replacementChoices(model: Model, id: string): Decision[] {
  const decisions = model.decisions ?? [];
  const byId = new Map(decisions.map((d) => [d.id, d]));
  return decisions.filter((d) => d.id !== id && !chain(byId, d.id).includes(id));
}

/**
 * M85: the model with each decision's Superseded by kept only when it is Superseded, names another
 * decision in the model, and doesn't close a loop (read in the model's order, the link that would close
 * one is dropped). The decision itself is always kept. The same model when nothing changes.
 */
export function withKnownDecisionLinks(model: Model): Model {
  if (!model.decisions?.some((d) => d.supersededBy)) return model;
  const ids = new Set(model.decisions.map((d) => d.id));
  const byId = new Map<string, Decision>();
  let changed = false;
  const decisions = model.decisions.map((d) => {
    let out = d;
    if (d.supersededBy) {
      const ok = d.status === "superseded" && d.supersededBy !== d.id && ids.has(d.supersededBy) && !chain(byId, d.supersededBy).includes(d.id);
      if (!ok) {
        const { supersededBy: _gone, ...rest } = d;
        void _gone;
        out = rest;
        changed = true;
      }
    }
    byId.set(out.id, out);
    return out;
  });
  return changed ? { ...model, decisions } : model;
}

/** M85: a decision's links in words: who replaced it, then whom it replaced. */
export function decisionLinks(model: Model, d: Decision): string[] {
  const title = (id: string) => model.decisions?.find((x) => x.id === id)?.title;
  const by = d.supersededBy && title(d.supersededBy);
  const replaced = decisionsSupersededBy(model, d.id);
  return [...(by ? [`Superseded by “${by}”`] : []), ...(replaced.length ? [`Supersedes ${replaced.map((x) => `“${x.title}”`).join(", ")}`] : [])];
}
