import type { Model, Note } from "./schema";

/** M93: where a note sits on the canvas: from its element's top left when attached, else where it was put. */
export function noteAt(model: Pick<Model, "layout">, note: Note): { x: number; y: number } {
  const at = note.attachedTo ? model.layout[note.attachedTo] : undefined;
  return at ? { x: at.x + note.x, y: at.y + note.y } : { x: note.x, y: note.y };
}

/** A note freed from its element, kept where it was (given where the element was). */
const freed = (n: Note, at: { x: number; y: number } | undefined): Note => ({ id: n.id, text: n.text, x: at ? at.x + n.x : n.x, y: at ? at.y + n.y : n.y });

/** M93: a note attached to an element the model doesn't hold is kept where its numbers put it, free. */
export function withKnownNoteElements(model: Model): Model {
  if (!model.notes?.some((n) => n.attachedTo && !model.layout[n.attachedTo])) return model;
  return { ...model, notes: model.notes.map((n) => (n.attachedTo && !model.layout[n.attachedTo] ? freed(n, undefined) : n)) };
}

/** M93: after a change, a note whose element went stays where it was on the canvas, free. */
export function withNotesKept(before: Model, after: Model): Model {
  if (!after.notes?.some((n) => n.attachedTo && !after.layout[n.attachedTo])) return after;
  return { ...after, notes: after.notes.map((n) => (n.attachedTo && !after.layout[n.attachedTo] ? freed(n, before.layout[n.attachedTo]) : n)) };
}

/** M93: a note attached to an element (`to`), or freed (`null`), staying where it is on the canvas. */
export function withNoteAttached(model: Model, id: string, to: string | null): Model {
  const note = model.notes?.find((n) => n.id === id);
  if (!note || (to && !model.layout[to]) || (note.attachedTo ?? null) === to) return model;
  const at = noteAt(model, note);
  const target = to ? model.layout[to]! : null;
  const next: Note = target ? { id, text: note.text, x: at.x - target.x, y: at.y - target.y, attachedTo: to! } : { id, text: note.text, x: at.x, y: at.y };
  return { ...model, notes: model.notes!.map((n) => (n.id === id ? next : n)) };
}
