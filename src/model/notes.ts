import type { Model, Note } from "./schema";

/** Where an element sits; one with no position is drawn at (0, 0), as the canvas draws it. Undefined when there is no such element. */
const placeOf = (model: Pick<Model, "layout" | "nodes">, id: string) => (model.nodes.some((n) => n.id === id) ? (model.layout[id] ?? { x: 0, y: 0 }) : undefined);

/** M93: where a note sits on the canvas: from its element's top left when attached, else where it was put. */
export function noteAt(model: Pick<Model, "layout" | "nodes">, note: Note): { x: number; y: number } {
  const at = note.attachedTo ? placeOf(model, note.attachedTo) : undefined;
  return at ? { x: at.x + note.x, y: at.y + note.y } : { x: note.x, y: note.y };
}

/** A note freed from its element, kept where it was (given where the element was). */
const freed = (n: Note, at: { x: number; y: number } | undefined): Note => ({ id: n.id, text: n.text, x: at ? at.x + n.x : n.x, y: at ? at.y + n.y : n.y });

/** M93: a note attached to an element the model doesn't hold is kept where its numbers put it, free. */
export function withKnownNoteElements(model: Model): Model {
  const known = new Set(model.nodes.map((n) => n.id));
  if (!model.notes?.some((n) => n.attachedTo && !known.has(n.attachedTo))) return model;
  return { ...model, notes: model.notes.map((n) => (n.attachedTo && !known.has(n.attachedTo) ? freed(n, undefined) : n)) };
}

/** M93: after a change, a note whose element went stays where it was on the canvas, free. */
export function withNotesKept(before: Model, after: Model): Model {
  if (!after.notes?.length) return after;
  const known = new Set(after.nodes.map((n) => n.id));
  if (!after.notes.some((n) => n.attachedTo && !known.has(n.attachedTo))) return after;
  return { ...after, notes: after.notes.map((n) => (n.attachedTo && !known.has(n.attachedTo) ? freed(n, placeOf(before, n.attachedTo)) : n)) };
}

/** M93: a note attached to an element (`to`), or freed (`null`), staying where it is on the canvas. */
export function withNoteAttached(model: Model, id: string, to: string | null): Model {
  const note = model.notes?.find((n) => n.id === id);
  if (!note || (to && !placeOf(model, to)) || (note.attachedTo ?? null) === to) return model;
  const at = noteAt(model, note);
  const target = to ? placeOf(model, to)! : null;
  const next: Note = target ? { id, text: note.text, x: at.x - target.x, y: at.y - target.y, attachedTo: to! } : { id, text: note.text, x: at.x, y: at.y };
  return { ...model, notes: model.notes!.map((n) => (n.id === id ? next : n)) };
}
