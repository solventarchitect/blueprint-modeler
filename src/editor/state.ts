import { acceptedTypes, allowedTypes, classById, relationshipsBetween, type ClassId, type Layer } from "@/metamodel";
import type { Side } from "@/layout/geometry";
import { edgeKey, linkSchema, MAX_LINKS, MAX_VIEWS, viewSchema, type Link, withDetails, type Edge, type Model, type Node, type View } from "@/model";

/**
 * Editor state: the model plus undo/redo history. Pure functions only, so every rule the
 * canvas enforces (allowed relationships, unique edges, layout sidecar) is unit-tested here.
 */
export type History = { past: Model[]; present: Model; future: Model[] };

export type Action =
  | { type: "load"; model: Model }
  | { type: "rename-model"; name: string }
  | { type: "model-details"; date?: string; description?: string; artifactId?: string }
  | { type: "add-node"; id: string; class: ClassId; name: string }
  | { type: "rename-node"; id: string; name: string }
  | { type: "describe-node"; id: string; description: string }
  | { type: "set-attr"; id: string; key: "lifecycle" | "environment" | "owner" | "ref"; value: string }
  | { type: "set-links"; id: string; links: Link[] }
  | { type: "set-attrs"; ids: string[]; key: "lifecycle" | "environment" | "owner"; value: string }
  | { type: "save-view"; view: View }
  | { type: "delete-view"; id: string }
  | { type: "move-node"; id: string; x: number; y: number }
  | { type: "delete-node"; id: string }
  | { type: "delete-nodes"; ids: string[]; edgeIds?: string[] }
  | { type: "add-edge"; id: string; from: string; to: string; edgeType?: string }
  | { type: "add-related"; id: string; class: ClassId; name: string; edgeId: string; relatedTo: string; outgoing: boolean; edgeType: string; at?: { x: number; y: number } }
  | { type: "delete-edge"; id: string }
  | { type: "update-edge"; id: string; from: string; to: string; edgeType: string }
  /** M61: the side a relationship leaves (`from`) or reaches (`to`); null goes back to automatic, absent keeps it. */
  | { type: "set-ports"; id: string; from?: Side | null; to?: Side | null }
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
      const next = withDetails(model, {
        date: action.date ?? model.date,
        description: action.description ?? model.description,
        artifactId: action.artifactId ?? model.artifactId,
      });
      return next.date === model.date && next.description === model.description && next.artifactId === model.artifactId ? null : next;
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
    case "set-links": {
      // M65: what the file would keep (titled http(s) links, at most five); none removes the key.
      const node = model.nodes.find((n) => n.id === action.id);
      if (!node) return null;
      const links = action.links.flatMap((l) => {
        const r = linkSchema.safeParse(l);
        return r.success ? [r.data] : [];
      }).slice(0, MAX_LINKS);
      if (JSON.stringify(links) === JSON.stringify(node.links ?? [])) return null;
      return {
        ...model,
        nodes: model.nodes.map((n) => {
          if (n.id !== action.id) return n;
          const { links: _old, ...rest } = n;
          void _old;
          return links.length ? { ...rest, links } : rest;
        }),
      };
    }
    case "set-attr":
    case "set-attrs": {
      // Life cycle, environment, owner (M54), on one element or several at once (M63): trimmed; empty
      // removes the key, and empty attrs go away. One undo step, or none when nothing changes.
      const ids = new Set(action.type === "set-attr" ? [action.id] : action.ids);
      const value = action.value.trim();
      const changes = (n: Node) => ids.has(n.id) && (n.attrs?.[action.key] ?? "") !== value;
      if (!model.nodes.some(changes)) return null;
      return {
        ...model,
        nodes: model.nodes.map((n) => {
          if (!changes(n)) return n;
          const attrs = Object.fromEntries(Object.entries(n.attrs ?? {}).filter(([k]) => k !== action.key));
          if (value) attrs[action.key] = value;
          return { ...n, attrs: Object.keys(attrs).length ? attrs : undefined };
        }),
      };
    }
    case "save-view": {
      // Add, or replace in place a view with the same id (rename, new filter or coloring).
      const views = model.views ?? [];
      const i = views.findIndex((v) => v.id === action.view.id);
      if (i >= 0 && JSON.stringify(views[i]) === JSON.stringify(action.view)) return null;
      // Never store what the model file would refuse: a view the schema rejects, or a 21st view.
      if (!viewSchema.safeParse(action.view).success || (i < 0 && views.length >= MAX_VIEWS)) return null;
      const next = i >= 0 ? views.map((v, k) => (k === i ? action.view : v)) : [...views, action.view];
      return { ...model, views: next };
    }
    case "delete-view": {
      const views = model.views ?? [];
      if (!views.some((v) => v.id === action.id)) return null;
      const rest = views.filter((v) => v.id !== action.id);
      const { views: _gone, ...without } = model;
      void _gone;
      return rest.length ? { ...model, views: rest } : without;
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
        // Where it was dropped (M53), else in its layer near the element it relates to.
        layout: { ...model.layout, [action.id]: action.at ?? placeNear(model, action.class, model.layout[anchor.id]?.x ?? 0) },
      };
      const [from, to] = action.outgoing ? [anchor.id, action.id] : [action.id, anchor.id];
      if (connectionProblem(withNode, from, to, action.edgeType)) return null;
      return { ...withNode, edges: [...withNode.edges, { id: action.edgeId, from, to, type: action.edgeType }] };
    }
    case "delete-nodes": {
      // A whole layer or selection at once, with their relationships and any other selected
      // relationships (edgeIds), as one undo step.
      const ids = new Set(action.ids.filter((id) => model.nodes.some((n) => n.id === id)));
      const lines = new Set(action.edgeIds ?? []);
      if (ids.size === 0 && !model.edges.some((e) => lines.has(e.id))) return null;
      const layout = { ...model.layout };
      for (const id of ids) delete layout[id];
      return {
        ...model,
        nodes: model.nodes.filter((n) => !ids.has(n.id)),
        edges: model.edges.filter((e) => !ids.has(e.from) && !ids.has(e.to) && !lines.has(e.id)),
        layout,
      };
    }
    case "update-edge": {
      // Replace one edge in place (e.g. bring a legacy edge to its CSDM 5 type and direction).
      const edge = model.edges.find((e) => e.id === action.id);
      if (!edge) return null;
      const others = { ...model, edges: model.edges.filter((e) => e.id !== action.id) };
      if (connectionProblem(others, action.from, action.to, action.edgeType)) return null;
      // A relationship turned round keeps no chosen sides: they belonged to the other ends.
      const turned = action.from !== edge.from || action.to !== edge.to;
      return {
        ...model,
        edges: model.edges.map((e) => {
          if (e.id !== action.id) return e;
          const { ports, ...rest } = e;
          return { ...rest, from: action.from, to: action.to, type: action.edgeType, ...(ports && !turned ? { ports } : {}) };
        }),
      };
    }
    case "set-ports": {
      const edge = model.edges.find((e) => e.id === action.id);
      if (!edge) return null;
      const pick = (v: Side | null | undefined, cur: Side | undefined) => (v === undefined ? cur : (v ?? undefined));
      const from = pick(action.from, edge.ports?.from);
      const to = pick(action.to, edge.ports?.to);
      if (from === edge.ports?.from && to === edge.ports?.to) return null;
      const { ports: _old, ...rest } = edge;
      void _old;
      // Stored only when set, and only the sides that are, so files without chosen sides stay as they were.
      const ports = { ...(from ? { from } : {}), ...(to ? { to } : {}) };
      const next: Edge = from || to ? { ...rest, ports } : rest;
      return { ...model, edges: model.edges.map((e) => (e.id === action.id ? next : e)) };
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
