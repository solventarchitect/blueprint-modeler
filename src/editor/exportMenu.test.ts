import { describe, expect, it } from "vitest";
import { EXPORT_GROUPS, exportItems } from "./ExportMenu";

describe("the Export mega menu (M79)", () => {
  it("five groups in order; every item in exactly one, in the menu's order", () => {
    expect(EXPORT_GROUPS.map((g) => g.label)).toEqual(["Share", "Images", "Documents", "Animations", "Other tools"]);
    expect(EXPORT_GROUPS.map((g) => g.items.map((i) => i.kind))).toEqual([
      ["link", "view-link", "json"],
      ["svg-dark", "svg-light", "png-dark", "png-light", "print"],
      ["book", "book-shown", "report"],
      ["blast-gif", "flow-gif", "scenario-gif"],
      ["archimate", "drawio", "servicenow"],
    ]);
    const all = EXPORT_GROUPS.flatMap((g) => g.items.map((i) => i.kind));
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(exportItems.map((i) => i.kind).sort());
  });
});
