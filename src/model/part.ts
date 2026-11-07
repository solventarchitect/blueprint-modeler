/**
 * The part of a model that is shown (M81): the elements given, the relationships between them (less
 * any the state shown leaves out), their layout, the saved flows cut where they leave the part (an
 * empty one dropped), and the decisions about kept elements or about none. No saved views. Pure.
 */
import { withKnownDecisionElements, withKnownDecisionLinks } from "./decisions";
import { withUnbrokenFlows } from "./flows";
import type { Model } from "./schema";

export function modelPart(model: Model, nodeIds: ReadonlySet<string>, dropEdges: ReadonlySet<string> = new Set()): Model {
  const { views: _views, flows: _flows, decisions: _decisions, ...rest } = model;
  void _views;
  void _flows;
  void _decisions;
  const nodes = model.nodes.filter((n) => nodeIds.has(n.id));
  const edges = model.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to) && !dropEdges.has(e.id));
  const layout = Object.fromEntries(Object.entries(model.layout).filter(([id]) => nodeIds.has(id)));
  // A decision about elements none of which are kept is not about this part; one about none stays.
  const decisions = (model.decisions ?? []).filter((d) => !d.elements?.length || d.elements.some((e) => nodeIds.has(e)));
  // M85: a decision left out takes its Superseded by off the decisions it replaced.
  const cut = withKnownDecisionLinks(withKnownDecisionElements(withUnbrokenFlows({ ...rest, nodes, edges, layout, ...(model.flows?.length ? { flows: model.flows } : {}), ...(decisions.length ? { decisions } : {}) })));
  const flows = cut.flows?.filter((f) => f.steps.length);
  const { flows: _f, ...out } = cut;
  void _f;
  return flows?.length ? { ...out, flows } : out;
}
