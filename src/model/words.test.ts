import { describe, expect, it } from "vitest";
import { count } from "./words";

describe("count", () => {
  it("says one in the singular, any other number in the plural", () => {
    expect(count(1, "element")).toBe("1 element");
    expect(count(0, "element")).toBe("0 elements");
    expect(count(2, "relationship")).toBe("2 relationships");
    expect(count(1, "reference")).toBe("1 reference");
    expect(count(3, "child", "children")).toBe("3 children");
  });
});
