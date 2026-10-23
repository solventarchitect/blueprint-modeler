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

  it("show relationship labels by default, also for options saved before the toggle existed (M50)", () => {
    expect(DEFAULT_VIEW.labels).toBe(true);
    expect(mergeView({ minimap: false }).labels).toBe(true);
    expect(mergeView({ labels: false }).labels).toBe(false);
  });

  it("show the minimap by default, also for options saved before it existed (M49)", () => {
    expect(DEFAULT_VIEW.minimap).toBe(true);
    expect(mergeView({ boxes: false }).minimap).toBe(true);
    expect(mergeView({ minimap: false }).minimap).toBe(false);
  });
});
