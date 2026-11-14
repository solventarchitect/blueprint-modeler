import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import type { Model } from "@/model";
import { modelToSvg, notesToDraw } from "./svg";

// M93: notes drawn in the pictures, as on the canvas, when they are shown.
const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
function withNotes(): Model {
  const m = checkout();
  const first = m.nodes[0]!;
  return {
    ...m,
    notes: [
      { id: "n1", text: "Free note far to the right", x: 5000, y: 0 },
      { id: "n2", text: "Who owns this & why?\nSecond line", x: 10, y: -90, attachedTo: first.id },
    ],
  };
}

describe("notes in pictures (M93)", () => {
  it("draws each note where the canvas puts it, an attached one from its element, with what it is on", () => {
    const m = withNotes();
    const boxes = notesToDraw(m);
    const at = m.layout[m.nodes[0]!.id]!;
    expect(boxes.map((b) => [b.id, b.x, b.y, b.on])).toEqual([
      ["n1", 5000, 0, ""],
      ["n2", at.x + 10, at.y - 90, m.nodes[0]!.name],
    ]);
    expect(boxes[1]!.lines).toEqual(["Who owns this & why?", "Second line"]);
    const svg = modelToSvg(m, "light", { notes: true });
    expect(svg).toContain('<g data-note="n1">');
    expect(svg).toContain(">Who owns this &amp; why?<");
    expect(svg).toContain(`NOTE · ON ${m.nodes[0]!.name.toUpperCase()}`);
    // The picture is wide enough for the note far to the right.
    const [, w] = /viewBox="(-?[\d.]+) /.exec(svg)!.map(Number);
    const [, , , vw] = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+)/.exec(svg)!.map(Number);
    expect(w! + vw!).toBeGreaterThan(5000 + 208);
  });

  it("leaves notes out when they are hidden, and a note on an element the picture leaves out", () => {
    const m = withNotes();
    expect(modelToSvg(m, "light")).not.toContain("data-note");
    const part: Model = { ...m, nodes: m.nodes.slice(1) };
    expect(notesToDraw(part).map((b) => b.id)).toEqual(["n1"]);
  });

  it("keeps a long note to twelve lines, the last ending with …", () => {
    const long: Model = { ...withNotes(), notes: [{ id: "n", text: Array.from({ length: 80 }, (_, i) => `word${i}`).join(" "), x: 0, y: 0 }] };
    const [b] = notesToDraw(long);
    expect(b!.lines).toHaveLength(12);
    expect(b!.lines.at(-1)!.endsWith("…")).toBe(true);
  });

  it("breaks a word longer than a line across lines, not cut", () => {
    const word = "x".repeat(70);
    const [b] = notesToDraw({ ...withNotes(), notes: [{ id: "n", text: word, x: 0, y: 0 }] });
    expect(b!.lines.join("")).toBe(word);
  });
});
