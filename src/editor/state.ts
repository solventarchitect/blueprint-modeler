import { acceptedTypes, allowedTypes, classById, relationshipsBetween, type ClassId, type Layer } from "@/metamodel";
import { edgeKey, type Edge, type Model, type Node } from "@/model";

/**
 * Editor state: the model plus undo/redo history. Pure functions only, so every rule the
 * canvas enforces (allowed relationships, unique edges, layout sidecar) is unit-tested here.
 */
export type History = { past: Model[]; present: Model; future: Model[] };

export type Action =
  | { type: "load"; model: Model }
  | { type: "rename-model"; name: string }
  | { type: "model-details"; description?: string; artifactId?: string }
  | { type: "add-node"; id: string; class: ClassId; name: string }
  | { type: "rename-node"; id: string; name: string }
  | { type: "describe-node"; id: string; description: string }
  | { type: "move-node"; id: string; x: number; y: number }
  | { type: "delete-node"; id: string }
  | { type: "delete-nodes"; ids: string[] }
  | { type: "add-edge"; id: string; from: string; to: string; edgeType?: string }
  | { type: "add-related"; id: string; class: ClassId; name: string; edgeId: string; relatedTo: string; outgoing: boolean; edgeType: string }
  | { type: "delete-edge"; id: string }
  | { type: "update-edge"; id: string; from: string; to: string; edgeType: string }
  | { type: "set-layout"; layout: Model["layout"] }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 100;

/** Vertical lanes: the white paper's layers, top to bottom. */
/** Lane rows, spaced so a layer's name tab fits between stacked layer boxes (see layout/bands). */
export const laneY: Record<Layer, number> = { business: 0, design: 240, service: 480, functional: 720, infrastructure: 960 };
/** Column pitch: node width (224) + room for a side-to-side edge's label and arrow. */
export const SLOT = 336;

export const initialHistory = (model: Model): History => ({ past: [], present: model, future: [] });

/** "a Host" / "an Application Service": class labels are title-cased entity names. */
const withArticle = (label: string) => `${/^[AEIOU]/.test(label) ? "an" : "a"} ${label}`;

/** Why a connection is refused, or null when it is allowed. */
export function connectionProblem(model: Model, from: string, to: string, edgeType?: string): string | null {
  const a = model.nodes.find((n) => n.id === from);
  const b = model.nodes.find((n) => n.id === to);
  if (!a || !b) return "Both elements must exist.";
  if (from === to) return "An element cannot be related to itself.";
  const types = allowedTypes(a.class, b.class);
  const aLabel = classById(a.class)?.label ?? a.class;
  const bLabel = classById(b.class)?.label ?? b.class;
  if (types.length === 0) {
    const reverse = relationshipsBetween(b.class, a.class).length > 0;
    return reverse
      ? `Draw it the other way: from the ${bLabel} to the ${aLabel}.`
      : `${withArticle(aLabel).replace(/^a/, "A")} is not related directly to ${withArticle(bLabel)} in CSDM.`;
  }
  const type = edgeType ?? types[0]!;
  if (!types.includes(type)) return `"${type}" is not used between ${withArticle(aLabel)} and ${withArticle(bLabel)}.`;
  if (model.edges.some((e) => edgeKey(e) === edgeKey({ from, to, type }))) return "That relationship already exists.";
  return null;
}

/** Where a new element of `cls` goes: its layer's lane, right of whatever is already there. */
export function nextPosition(model: Model, cls: ClassId): { x: number; y: number } {
  const layer = classById(cls)!.layer;
  const y = laneY[layer];
  const xs = model.nodes
    .filter((n) => classById(n.class)?.layer === layer)
    .map((n) => model.layout[n.id]?.x ?? 0);
  return { x: xs.length ? Math.max(...xs) + SLOT : 0, y };
}

/**
 * The CSDM 5 form of a legacy edge (an older type, or a pair older files drew the other way), or
 * null when the edge is already current or has no current form.
 */
export function modernEdge(model: Model, edge: Edge): { from: string; to: string; type: string } | null {
  const a = model.nodes.find((n) => n.id === edge.from);
  const b = model.nodes.find((n) => n.id === edge.to);
  if (!a || !b) return null;
  if (allowedTypes(a.class, b.class).includes(edge.type) || !acceptedTypes(a.class, b.class).includes(edge.type)) return null;
  const same = allowedTypes(a.class, b.class)[0];
  if (same) return { from: edge.from, to: edge.to, type: same };
  const flipped = allowedTypes(b.class, a.class)[0];
  return flipped ? { from: edge.to, to: edge.from, type: flipped } : null;
}

/** Where a new element related to one at `nearX` goes: its lane, in the same column when that spot is free. */
export function placeNear(model: Model, cls: ClassId, nearX: number): { x: number; y: number } {
  const layer = classById(cls)!.layer;
  const y = laneY[layer];
  const taken = model.nodes.some((n) => classById(n.class)?.layer === layer && Math.abs((model.layout[n.id]?.x ?? 0) - nearX) < SLOT);
  return taken ? nextPosition(model, cls) : { x: nearX, y };
}

function apply(model: Model, action: Action): Model | null {
  switch (action.type) {
    case "rename-model":
      return action.name === model.name ? null : { ...model, name: action.name };
    case "model-details": {
      const description = (action.description ?? model.description ?? "").trim();
      const artifactId = (action.artifactId ?? model.artifactId ?? "").trim();
      if (description === (model.description ?? "") && artifactId === (model.artifactId ?? "")) return null;
      // Rebuilt in file order, so the details sit right after the name in an exported file.
      const { schema, id, name, created, updated, nodes, edges, layout } = model;
      return { schema, id, name, ...(description ? { description } : {}), ...(artifactId ? { artifactId } : {}), created, updated, nodes, edges, layout };
    }
    case "add-node": {
      if (model.nodes.some((n) => n.id === action.id)) return null;
      const node: Node = { id: action.id, class: action.class, name: action.name };
      return { ...model, nodes: [...model.nodes, node], layout: { ...model.layout, [action.id]: nextPosition(model, action.class) } };
    }
    case "rename-node": {
      const node = model.nodes.find((n) => n.id === action.id);
      if (!node || node.name === action.name) return null;
      return { ...model, nodes: model.nodes.map((n) => (n.id === action.id ? { ...n, name: action.name } : n)) };
    }
    case "describe-node": {
      const node = model.nodes.find((n) => n.id === action.id);
      const description = action.description.trim();
      if (!node || (node.attrs?.description ?? "") === description) return null;
      const attrs = Object.fromEntries(Object.entries(node.attrs ?? {}).filter(([k]) => k !== "description"));
      if (description) attrs.description = description;
      return { ...model, nodes: model.nodes.map((n) => (n.id === action.id ? { ...n, attrs: Object.keys(attrs).length ? attrs : undefined } : n)) };
    }
    case "move-node": {
      const pos = model.layout[action.id];
      if (!pos || (pos.x === action.x && pos.y === action.y)) return null;
      return { ...model, layout: { ...model.layout, [action.id]: { x: Math.round(action.x), y: Math.round(action.y) } } };
    }
    case "set-layout": {
      // Auto-layout: every position at once, as one undo step. Ignores ids not in the model.
      const layout = { ...model.layout };
      let changed = false;
      for (const n of model.nodes) {
        const p = action.layout[n.id];
        if (!p) continue;
        const next = { x: Math.round(p.x), y: Math.round(p.y) };
        if (layout[n.id]?.x !== next.x || layout[n.id]?.y !== next.y) changed = true;
        layout[n.id] = next;
      }
      return changed ? { ...model, layout } : null;
    }
    case "delete-node": {
      if (!model.nodes.some((n) => n.id === action.id)) return null;
      const layout = { ...model.layout };
      delete layout[action.id];
      return {
        ...model,
        nodes: model.nodes.filter((n) => n.id !== action.id),
        edges: model.edges.filter((e) => e.from !== action.id && e.to !== action.id),
        layout,
      };
    }
    case "add-related": {
      // A new element and its relationship to an existing one, as one undo step.
      const anchor = model.nodes.find((n) => n.id === action.relatedTo);
      if (!anchor || model.nodes.some((n) => n.id === action.id)) return null;
      const node: Node = { id: action.id, class: action.class, name: action.name };
      const withNode = {
        ...model,
        nodes: [...model.nodes, node],
        layout: { ...model.layout, [action.id]: placeNear(model, action.class, model.layout[anchor.id]?.x ?? 0) },
      };
      const [from, to] = action.outgoing ? [anchor.id, action.id] : [action.id, anchor.id];
      if (connectionProblem(withNode, from, to, action.edgeType)) return null;
      return { ...withNode, edges: [...withNode.edges, { id: action.edgeId, from, to, type: action.edgeType }] };
    }
    case "delete-nodes": {
      // A whole layer at once, as one undo step.
      const ids = new Set(action.ids.filter((id) => model.nodes.some((n) => n.id === id)));
      if (ids.size === 0) return null;
      const layout = { ...model.layout };
      for (const id of ids) delete layout[id];
      return {
        ...model,
        nodes: model.nodes.filter((n) => !ids.has(n.id)),
        edges: model.edges.filter((e) => !ids.has(e.from) && !ids.has(e.to)),
        layout,
      };
    }
    case "update-edge": {
      // Replace one edge in place (e.g. bring a legacy edge to its CSDM 5 type and direction).
      const edge = model.edges.find((e) => e.id === action.id);
      if (!edge) return null;
      const others = { ...model, edges: model.edges.filter((e) => e.id !== action.id) };
      if (connectionProblem(others, action.from, action.to, action.edgeType)) return null;
      return { ...model, edges: model.edges.map((e) => (e.id === action.id ? { ...e, from: action.from, to: action.to, type: action.edgeType } : e)) };
    }
    case "add-edge": {
      if (connectionProblem(model, action.from, action.to, action.edgeType)) return null;
      const from = model.nodes.find((n) => n.id === action.from)!;
      const to = model.nodes.find((n) => n.id === action.to)!;
      const edge: Edge = { id: action.id, from: action.from, to: action.to, type: action.edgeType ?? allowedTypes(from.class, to.class)[0]! };
      return { ...model, edges: [...model.edges, edge] };
    }
    case "delete-edge":
      return model.edges.some((e) => e.id === action.id) ? { ...model, edges: model.edges.filter((e) => e.id !== action.id) } : null;
    default:
      return null;
  }
}

/** Reducer with history. `now` stamps `updated` on every real change. */
export function reduce(state: History, action: Action, now: () => string = () => new Date().toISOString()): History {
  switch (action.type) {
    case "load":
      return initialHistory(action.model);
    case "undo": {
      const prev = state.past.at(-1);
      return prev ? { past: state.past.slice(0, -1), present: prev, future: [state.present, ...state.future] } : state;
    }
    case "redo": {
      const next = state.future[0];
      return next ? { past: [...state.past, state.present], present: next, future: state.future.slice(1) } : state;
    }
    default: {
      const changed = apply(state.present, action);
      if (!changed) return state;
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: { ...changed, updated: now() }, future: [] };
    }
  }
}
