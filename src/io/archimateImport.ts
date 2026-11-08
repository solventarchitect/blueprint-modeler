import { archimateImportGuesses, archimateRelationshipFor, archimateTypeLabel } from "@/frameworks";
import { classById, classes, relationshipsBetween, type ClassId } from "@/metamodel";
import { CURRENT_SCHEMA, parseModel, type Edge, type Model, type Node } from "@/model";
import { MAX_FILE_CHARS, type ImportResult } from "./file";

/**
 * M87: an ArchiMate® Model Exchange File Format document read into a new model. Our own export
 * (src/io/archimate.ts) carries each element's CSDM class and each relationship's CSDM type as
 * properties, which win; otherwise the class is guessed from the ArchiMate type
 * (archimateImportGuesses) and the relationship from the CSDM relationships between the two
 * classes whose ArchiMate reading matches. What has no CSDM counterpart is listed, never dropped
 * silently. The XML is read with the browser's own parser (readExchange); everything made from
 * it is plain data (exchangeToModel), so it is tested without a browser.
 */

export type ExchangeElement = { id: string; type: string; name: string; documentation?: string; properties: Record<string, string> };
export type ExchangeRelationship = { id: string; type: string; source: string; target: string; properties: Record<string, string> };
export type ExchangeNode = { elementRef: string; x: number; y: number; w: number; h: number };
/** What a file says, by property name (not id, which tools rename). The first diagram's element boxes, nested ones included. */
export type Exchange = {
  name: string;
  documentation?: string;
  elements: ExchangeElement[];
  relationships: ExchangeRelationship[];
  diagram?: { name: string; nodes: ExchangeNode[] };
};

const CLASS_PROPERTY = "csdm class";
const TYPE_PROPERTY = "csdm relationship type";
const OUR_EXPORT = "Exported from Blueprint Modeler";
const MAX_NODES = 5000;
const MAX_EDGES = 20000;
const LISTED = 5;
// Our elements' size, which a diagram's boxes are scaled to (to the nearest half), and the rows for what isn't on one.
const NODE_W = 224;
const NODE_H = 72;
const ROW = 6;
const STEP_X = 272;
const STEP_Y = 160;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const prop = (props: Record<string, string>, name: string) => Object.entries(props).find(([k]) => k.trim().toLowerCase() === name)?.[1]?.trim();
const typeLabel = (type: string) => {
  const t = archimateTypeLabel(type);
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const labelOf = (id: ClassId) => classById(id)!.label;
const listed = (items: string[]) => (items.length > LISTED ? `${items.slice(0, LISTED).join(", ")}, and ${items.length - LISTED} more` : items.join(", "));
const halfStep = (n: number) => Math.max(1, Math.round(n * 2) / 2);

/** The class a property names, by label or id, ignoring case. */
function namedClass(value: string | undefined): ClassId | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  return classes.find((c) => c.label.toLowerCase() === v || c.id === v)?.id;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

export type ArchimateImport = { ok: true; model: Model; notes: string[] } | { ok: false; error: string };

export function exchangeToModel(ex: Exchange, { id, now }: { id: string; now: Date }): ArchimateImport {
  if (!ex.elements.length) return { ok: false, error: "It has no elements." };
  const notes: string[] = [];
  const named = (e: ExchangeElement) => (e.name.trim() ? `${typeLabel(e.type)} “${e.name.trim()}”` : typeLabel(e.type));

  // Elements: the class our export wrote, else the guess from the ArchiMate type, else not imported.
  const kept: { e: ExchangeElement; cls: ClassId }[] = [];
  const guessed = new Map<string, number>();
  const skipped: ExchangeElement[] = [];
  // An identifier used twice: the first element keeps it (relationships and boxes name it), the others are listed.
  const twice: ExchangeElement[] = [];
  const ids = new Set<string>();
  for (const e of ex.elements) {
    if (ids.has(e.id)) {
      twice.push(e);
      continue;
    }
    ids.add(e.id);
    const own = namedClass(prop(e.properties, CLASS_PROPERTY));
    // Only the table's own entries: a type spelled like an object's built-in ("constructor") is just unknown.
    const guess = own || !Object.hasOwn(archimateImportGuesses, e.type) ? undefined : archimateImportGuesses[e.type];
    if (own) kept.push({ e, cls: own });
    else if (guess) {
      kept.push({ e, cls: guess.class });
      const key = `${typeLabel(e.type)} as ${labelOf(guess.class)}`;
      guessed.set(key, (guessed.get(key) ?? 0) + 1);
    } else skipped.push(e);
  }
  if (!kept.length) return { ok: false, error: `None of its ${plural(ex.elements.length, "element")} has a CSDM class here (${listed(skipped.map(named))}).` };
  if (kept.length > MAX_NODES) return { ok: false, error: `It has ${kept.length} elements CSDM can hold; a model holds at most ${MAX_NODES}.` };

  // Ids: the file's, when they fit and are new; otherwise n1, n2…
  const used = new Set<string>();
  const fresh = (raw: string, prefix: string) => {
    if (raw && raw.length <= 64 && !used.has(raw)) return used.add(raw), raw;
    let i = used.size + 1;
    while (used.has(`${prefix}${i}`)) i++;
    return used.add(`${prefix}${i}`), `${prefix}${i}`;
  };
  const nodeId = new Map<string, string>();
  const classOf = new Map<string, ClassId>();
  // Our export prefixes ids (el-, rel-); with its property present, the id comes back as it was.
  const ours = (raw: string, prefix: string, props: Record<string, string>, key: string) => (raw.startsWith(prefix) && prop(props, key) ? raw.slice(prefix.length) : raw);
  const nodes: Node[] = kept.map(({ e, cls }) => {
    const nid = fresh(ours(e.id, "el-", e.properties, CLASS_PROPERTY), "n");
    nodeId.set(e.id, nid);
    classOf.set(nid, cls);
    const doc = e.documentation?.trim();
    return { id: nid, class: cls, name: e.name.trim().slice(0, 200) || "Untitled", ...(doc ? { attrs: { description: doc.slice(0, 2000) } } : {}) };
  });
  if (guessed.size) {
    const n = [...guessed.values()].reduce((a, b) => a + b, 0);
    notes.push(`Guessed the CSDM class of ${plural(n, "element")} from ${n === 1 ? "its" : "their"} ArchiMate type: ${[...guessed].map(([k, c]) => `${k} (${c})`).join(", ")}.`);
  }
  if (skipped.length) notes.push(`Not imported: ${plural(skipped.length, "element")} with no CSDM class here: ${listed(skipped.map(named))}.`);
  if (twice.length) notes.push(`Not imported: ${plural(twice.length, "element")} whose identifier another element already has: ${listed(twice.map(named))}.`);

  // Relationships: our export's type in either direction (it writes some reversed), else the CSDM
  // relationship whose ArchiMate reading matches the type and direction, then any CSDM relationship
  // between the two classes. An end that isn't imported, or no CSDM relationship, is listed.
  const byId = new Map<string, ExchangeElement>([...kept.map(({ e }) => [e.id, e] as const), ...skipped.map((e) => [e.id, e] as const)]);
  const end = (ref: string) => {
    const e = byId.get(ref);
    return e ? `“${e.name.trim() || "Untitled"}”` : "another relationship";
  };
  const endNamed = (ref: string) => {
    const e = byId.get(ref);
    return e && !e.name.trim() ? typeLabel(e.type) : end(ref);
  };
  const edges: Edge[] = [];
  const seen = new Set<string>();
  const left: string[] = [];
  let guessedRels = 0;
  for (const r of ex.relationships) {
    const said = `${typeLabel(r.type)} ${endNamed(r.source)} → ${endNamed(r.target)}`;
    const a = nodeId.get(r.source);
    const b = nodeId.get(r.target);
    if (!a || !b) {
      left.push(`${said} (an end not imported)`);
      continue;
    }
    const ca = classOf.get(a)!;
    const cb = classOf.get(b)!;
    const own = prop(r.properties, TYPE_PROPERTY);
    let pick: { from: string; to: string; type: string } | undefined;
    let guessedThis = false;
    if (own && own.length <= 64) {
      // Undo our export exactly: the way round whose ArchiMate reading it would have written as this
      // relationship (some are written reversed). The type is kept as written, older ones and ones
      // breaking the rules too, for Hints to flag as a model file's would be.
      for (const [from, to, cf, ct] of [
        [a, b, ca, cb],
        [b, a, cb, ca],
      ] as const) {
        const m = archimateRelationshipFor(cf, ct);
        if ((m?.type ?? "Association") === r.type && (m?.reverse ? to : from) === a) {
          pick = { from, to, type: own };
          break;
        }
      }
    }
    if (!pick) {
      // Score each CSDM relationship between the two: same ArchiMate type and direction 3, same type 2, any 1.
      let best = 0;
      for (const [from, to, cf, ct] of [
        [a, b, ca, cb],
        [b, a, cb, ca],
      ] as const) {
        for (const def of relationshipsBetween(cf, ct)) {
          const m = archimateRelationshipFor(cf, ct);
          // Where the ArchiMate relationship starts, given this CSDM direction.
          const starts = m?.reverse ? to : from;
          const score = m?.type === r.type ? (starts === a ? 3 : 2) : 1;
          if (score > best && def.types[0]) {
            best = score;
            pick = { from, to, type: def.types[0] };
          }
        }
      }
      guessedThis = !!pick;
    }
    if (!pick) {
      left.push(`${said} (no CSDM relationship between ${labelOf(ca)} and ${labelOf(cb)})`);
      continue;
    }
    const key = `${pick.from}\u0000${pick.to}\u0000${pick.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (edges.length === MAX_EDGES) {
      left.push(`${said} (a model holds at most ${MAX_EDGES} relationships)`);
      continue;
    }
    edges.push({ id: fresh(ours(r.id, "rel-", r.properties, TYPE_PROPERTY), "e"), ...pick });
    if (guessedThis) guessedRels++;
  }
  if (guessedRels) notes.push(`Guessed the CSDM relationship of ${plural(guessedRels, "relationship")} from ${guessedRels === 1 ? "its" : "their"} ArchiMate type and direction.`);
  if (left.length) notes.push(`Not imported: ${plural(left.length, "relationship")}: ${listed(left)}.`);

  // The picture: the first diagram's boxes (the first box of an element wins), scaled so small
  // ArchiMate boxes space like ours; the rest in rows below it.
  const layout: Model["layout"] = {};
  const boxes = (ex.diagram?.nodes ?? []).filter((b) => nodeId.has(b.elementRef) && Number.isFinite(b.x) && Number.isFinite(b.y));
  const sx = halfStep(NODE_W / (median(boxes.map((b) => b.w)) || NODE_W));
  const sy = halfStep(NODE_H / (median(boxes.map((b) => b.h)) || NODE_H));
  for (const b of boxes) {
    const nid = nodeId.get(b.elementRef)!;
    if (!layout[nid]) layout[nid] = { x: Math.round(b.x * sx), y: Math.round(b.y * sy) };
  }
  const placed = Object.values(layout);
  const top = placed.length ? Math.max(...placed.map((p) => p.y)) + STEP_Y : 0;
  const leftEdge = placed.length ? Math.min(...placed.map((p) => p.x)) : 0;
  const rest = nodes.filter((n) => !layout[n.id]);
  rest.forEach((n, i) => (layout[n.id] = { x: leftEdge + (i % ROW) * STEP_X, y: top + Math.floor(i / ROW) * STEP_Y }));
  if (!ex.diagram) notes.push("The file has no diagram, so the elements are placed in rows.");
  else if (rest.length) notes.push(`${plural(rest.length, "element")} not on the diagram “${ex.diagram.name.trim() || "Untitled"}” ${rest.length === 1 ? "is" : "are"} placed below it.`);

  const stamp = now.toISOString();
  const doc = ex.documentation?.trim();
  const model: Model = {
    schema: CURRENT_SCHEMA,
    id,
    name: ex.name.trim().slice(0, 200) || "Imported ArchiMate Model",
    ...(doc && !doc.startsWith(OUR_EXPORT) ? { description: doc.slice(0, 1000) } : {}),
    created: stamp,
    updated: stamp,
    nodes,
    edges,
    layout,
  };
  return { ok: true, model, notes };
}

const XSI = "http://www.w3.org/2001/XMLSchema-instance";

/** The exchange format's own elements (any namespace prefix), direct children only. */
const kids = (el: Element, name: string) => [...el.children].filter((c) => c.localName === name);
const kid = (el: Element, name: string) => kids(el, name)[0];
/** A text in English when the file has several languages, else the first. */
function text(el: Element | undefined, name: string): string | undefined {
  if (!el) return undefined;
  const all = kids(el, name);
  const en = all.find((n) => (n.getAttribute("xml:lang") ?? "").toLowerCase().startsWith("en")) ?? all[0];
  return en?.textContent ?? undefined;
}
const xsiType = (el: Element) => (el.getAttributeNS(XSI, "type") ?? el.getAttribute("xsi:type") ?? "").replace(/^.*:/, "");

/** Reads an exchange document as plain data, or says why it can't. */
export function readExchange(doc: Document): Exchange | { error: string } {
  const root = doc.documentElement;
  if (!root || root.localName !== "model" || doc.getElementsByTagName("parsererror").length) {
    return { error: "It is not an ArchiMate exchange file (Open Group Model Exchange File Format)." };
  }
  const propertyNames = new Map<string, string>();
  for (const d of kids(kid(root, "propertyDefinitions") ?? root, "propertyDefinition")) propertyNames.set(d.getAttribute("identifier") ?? "", text(d, "name") ?? "");
  const properties = (el: Element) =>
    Object.fromEntries(
      kids(kid(el, "properties") ?? el, "property").flatMap((p) => {
        const n = propertyNames.get(p.getAttribute("propertyDefinitionRef") ?? "");
        return n ? [[n, text(p, "value") ?? ""]] : [];
      }),
    );
  const elements = kids(kid(root, "elements") ?? root, "element").map((e) => {
    const documentation = text(e, "documentation");
    return { id: e.getAttribute("identifier") ?? "", type: xsiType(e), name: text(e, "name") ?? "", ...(documentation ? { documentation } : {}), properties: properties(e) };
  });
  const relationships = kids(kid(root, "relationships") ?? root, "relationship").map((r) => ({
    id: r.getAttribute("identifier") ?? "",
    type: xsiType(r),
    source: r.getAttribute("source") ?? "",
    target: r.getAttribute("target") ?? "",
    properties: properties(r),
  }));
  // The first diagram, its element boxes at any depth (the format gives absolute positions).
  const view = kids(kid(kid(root, "views") ?? root, "diagrams") ?? root, "view")[0];
  const nodes: ExchangeNode[] = [];
  const walk = (el: Element) => {
    for (const n of kids(el, "node")) {
      const ref = n.getAttribute("elementRef");
      if (ref) nodes.push({ elementRef: ref, x: Number(n.getAttribute("x")), y: Number(n.getAttribute("y")), w: Number(n.getAttribute("w")), h: Number(n.getAttribute("h")) });
      walk(n);
    }
  };
  if (view) walk(view);
  const documentation = text(root, "documentation");
  return {
    name: text(root, "name") ?? "",
    ...(documentation ? { documentation } : {}),
    elements,
    relationships,
    ...(view ? { diagram: { name: text(view, "name") ?? "", nodes } } : {}),
  };
}

/** True when a file's text looks like XML rather than a model file (JSON). */
export const looksLikeXml = (text: string) => text.trimStart().startsWith("<");

/**
 * Read an ArchiMate exchange file into a new model with a new id. Nothing is saved here. A document
 * type declaration is refused (the format doesn't use one, and it is how entity tricks get in).
 */
export function importArchimate(text: string, newId: () => string = () => crypto.randomUUID(), now = new Date()): ImportResult {
  if (text.length > MAX_FILE_CHARS) return { ok: false, error: "The file is too large (over 5 MB)." };
  if (/^\s*(?:<\?[\s\S]*?\?>\s*|<!--[\s\S]*?-->\s*)*<!DOCTYPE/i.test(text)) return { ok: false, error: "It declares a document type, which an ArchiMate exchange file doesn't use." };
  const read = readExchange(new DOMParser().parseFromString(text, "application/xml"));
  if ("error" in read) return { ok: false, error: read.error };
  const r = exchangeToModel(read, { id: newId(), now });
  if (!r.ok) return r;
  const checked = parseModel(r.model);
  if (!checked.ok) return checked;
  return { ok: true, model: checked.model, issues: checked.issues, notes: r.notes, copied: false };
}
