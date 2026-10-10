import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW, mergeView } from "./ViewMenu";

describe("view options", () => {
  it("default to curved lines, and read older saved options without a line style", () => {
    expect(DEFAULT_VIEW.lines).toBe("curved");
    expect(mergeView({ boxes: false, lanes: true }).lines).toBe("curved");
    expect(mergeView({ lines: "right-angles" }).lines).toBe("right-angles");
    // Anything but the two styles falls back.
    expect(mergeView({ lines: "zigzag" }).lines).toBe("curved");
    expect(mergeView(null).boxes).toBe(true);
  });
});
