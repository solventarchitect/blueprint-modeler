import { describe, expect, it } from "vitest";
import { edgeEnds, edgeSides } from "./geometry";

describe("edgeSides", () => {
  it("leaves by the bottom between rows and sideways within a row", () => {
    expect(edgeSides({ x: 0, y: 0 }, { x: 300, y: 200 })).toEqual(["bottom", "top"]);
    expect(edgeSides({ x: 0, y: 200 }, { x: 300, y: 0 })).toEqual(["top", "bottom"]);
    expect(edgeSides({ x: 0, y: 0 }, { x: 300, y: 20 })).toEqual(["right", "left"]);
    expect(edgeSides({ x: 300, y: 0 }, { x: 0, y: 20 })).toEqual(["left", "right"]);
  });

  it("with columns, leaves sideways between columns and up or down within one", () => {
    expect(edgeSides({ x: 0, y: 0 }, { x: 300, y: 200 }, true)).toEqual(["right", "left"]);
    expect(edgeSides({ x: 300, y: 0 }, { x: 0, y: 200 }, true)).toEqual(["left", "right"]);
    expect(edgeSides({ x: 0, y: 0 }, { x: 20, y: 200 }, true)).toEqual(["bottom", "top"]);
    expect(edgeSides({ x: 0, y: 200 }, { x: 20, y: 0 }, true)).toEqual(["top", "bottom"]);
  });
});

describe("edgeEnds (M61)", () => {
  it("keeps the sides the modeler chose and picks the rest from the layout", () => {
    const [a, b] = [{ x: 0, y: 0 }, { x: 300, y: 200 }];
    expect(edgeEnds(undefined, a, b)).toEqual(["bottom", "top"]);
    expect(edgeEnds({ from: "right" }, a, b)).toEqual(["right", "top"]);
    expect(edgeEnds({ to: "left" }, a, b)).toEqual(["bottom", "left"]);
    expect(edgeEnds({ from: "top", to: "bottom" }, a, b)).toEqual(["top", "bottom"]);
  });
});
