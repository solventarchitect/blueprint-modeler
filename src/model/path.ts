import type { FlowStep, Model } from "./schema";

/** M91: how many equally short chains are listed between two elements. */
export const MAX_PATHS = 12;

/**
 * M91: the shortest chains of relationships between two elements, whichever way each relationship is
 * drawn. Each chain is a walk from `a` to `b`, a step per relationship (`back` where it is walked
 * against its arrow), as a saved flow's steps are. Every equally short chain is given, in the model's
 * order, up to MAX_PATHS (`more` says the list was cut). None when nothing joins them.
 */
export function shortestPaths(model: Model, a: string, b: string): { paths: FlowStep[][]; more: boolean } {
  const none = { paths: [], more: false };
  const known = new Set(model.nodes.map((n) => n.id));
  if (a === b || !known.has(a) || !known.has(b)) return none;
  // Each element's relationships, walked away from it, in the model's order.
  const out = new Map<string, { step: FlowStep; to: string }[]>();
  const add = (from: string, to: string, step: FlowStep) => out.set(from, [...(out.get(from) ?? []), { step, to }]);
  for (const e of model.edges) {
    if (e.from === e.to || !known.has(e.from) || !known.has(e.to)) continue;
    add(e.from, e.to, { edge: e.id });
    add(e.to, e.from, { edge: e.id, back: true });
  }
  // How far each element is from `b`: a step belongs to a shortest chain when it gets one nearer.
  const far = new Map([[b, 0]]);
  for (let ring = [b]; ring.length && !far.has(a); ) {
    const next: string[] = [];
    for (const id of ring) {
      for (const { to } of out.get(id) ?? []) {
        if (far.has(to)) continue;
        far.set(to, far.get(id)! + 1);
        next.push(to);
      }
    }
    ring = next;
  }
  if (!far.has(a)) return none;
  const paths: FlowStep[][] = [];
  let more = false;
  const walk = (at: string, sofar: FlowStep[]) => {
    if (more) return;
    if (at === b) return void (paths.length < MAX_PATHS ? paths.push(sofar) : (more = true));
    for (const { step, to } of out.get(at) ?? []) if (far.get(to) === far.get(at)! - 1) walk(to, [...sofar, step]);
  };
  walk(a, []);
  return { paths, more };
}
