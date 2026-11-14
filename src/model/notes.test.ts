import { describe, expect, it } from "vitest";
import { createModel, MAX_NOTES, noteAt, parseModel, serializeModel, withNoteAttached, withNotesKept, type Model } from "./index";

// M93: notes on the canvas: free text placed anywhere, or attached to an element so it moves with it.
function m(): Model {
  return {
    ...createModel("Shop", new Date("2026-11-14T00:00:00Z"), "m1"),
    nodes: [
      { id: "ba", class: "business_application", name: "Shop" },
      { id: "svc", class: "application_service", name: "Shop production" },
    ],
    edges: [],
    layout: { ba: { x: 100, y: 200 }, svc: { x: 400, y: 200 } },
    notes: [
      { id: "n1", text: "Who owns this?", x: 40, y: -60, attachedTo: "ba" },
      { id: "n2", text: "Assumes one region.", x: 700, y: 50 },
    ],
  };
}

describe("notes (M93)", () => {
  it("a note attached to an element sits relative to it; a free one where it was put", () => {
    expect(noteAt(m(), m().notes![0]!)).toEqual({ x: 140, y: 140 });
    expect(noteAt(m(), m().notes![1]!)).toEqual({ x: 700, y: 50 });
    const moved: Model = { ...m(), layout: { ...m().layout, ba: { x: 0, y: 0 } } };
    expect(noteAt(moved, moved.notes![0]!)).toEqual({ x: 40, y: -60 });
  });

  it("round-trips in the model file; a note that can't be read is dropped, not the file", () => {
    const back = parseModel(JSON.parse(serializeModel(m())));
    expect(back.ok && back.model.notes).toEqual(m().notes);
    const raw = JSON.parse(serializeModel(m()));
    raw.notes.push({ id: "bad", text: 42, x: 0, y: 0 }, { id: "n2", text: "Same id", x: 1, y: 1 }, { id: "n3", text: "Odd", x: 1, y: 2, attachedTo: { no: 1 } });
    const r = parseModel(raw);
    expect(r.ok && r.model.notes!.map((n) => n.id)).toEqual(["n1", "n2", "n3"]);
    expect(r.ok && r.model.notes![2]).toEqual({ id: "n3", text: "Odd", x: 1, y: 2 });
    // No notes: no list in the file.
    const none = parseModel({ ...raw, notes: [] });
    expect(none.ok && "notes" in none.model).toBe(false);
  });

  it("a note attached to an element the file doesn't hold is kept where it is, free", () => {
    const raw = JSON.parse(serializeModel(m()));
    raw.notes[0].attachedTo = "gone";
    const r = parseModel(raw);
    expect(r.ok && r.model.notes![0]).toEqual({ id: "n1", text: "Who owns this?", x: 40, y: -60 });
  });

  it("holds at most MAX_NOTES", () => {
    const raw = JSON.parse(serializeModel(m()));
    raw.notes = Array.from({ length: MAX_NOTES + 5 }, (_, i) => ({ id: `n${i}`, text: "x", x: i, y: 0 }));
    const r = parseModel(raw);
    expect(r.ok && r.model.notes!.length).toBe(MAX_NOTES);
  });

  it("when its element goes, an attached note stays where it was, free", () => {
    const after: Model = { ...m(), nodes: [m().nodes[1]!], layout: { svc: m().layout.svc! } };
    expect(withNotesKept(m(), after).notes).toEqual([{ id: "n1", text: "Who owns this?", x: 140, y: 140 }, m().notes![1]]);
    // Nothing gone: the same model back.
    const base = m();
    expect(withNotesKept(base, base)).toBe(base);
  });

  it("attaching or freeing a note keeps it where it is on the canvas", () => {
    const freed = withNoteAttached(m(), "n1", null);
    expect(freed.notes![0]).toEqual({ id: "n1", text: "Who owns this?", x: 140, y: 140 });
    const onSvc = withNoteAttached(m(), "n2", "svc");
    expect(onSvc.notes![1]).toEqual({ id: "n2", text: "Assumes one region.", x: 300, y: -150, attachedTo: "svc" });
    expect(noteAt(onSvc, onSvc.notes![1]!)).toEqual({ x: 700, y: 50 });
    // Unknown note or element: unchanged.
    const base = m();
    expect(withNoteAttached(base, "nope", "svc")).toBe(base);
    expect(withNoteAttached(base, "n2", "nope")).toBe(base);
  });

  it("an element with no position is where the canvas draws it, (0, 0): a note on it stays on it", () => {
    const unplaced: Model = { ...m(), layout: { svc: m().layout.svc! } };
    expect(noteAt(unplaced, unplaced.notes![0]!)).toEqual({ x: 40, y: -60 });
    const back = parseModel(JSON.parse(serializeModel(unplaced)));
    expect(back.ok && back.model.notes![0]!.attachedTo).toBe("ba");
    expect(withNoteAttached(unplaced, "n2", "ba").notes![1]).toEqual({ id: "n2", text: "Assumes one region.", x: 700, y: 50, attachedTo: "ba" });
    expect(withNotesKept(unplaced, unplaced)).toBe(unplaced);
  });
});
