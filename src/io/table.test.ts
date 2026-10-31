import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { csvCell, elementRows, relationshipRows, toCsv } from "./table";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");

describe("table rows (M67)", () => {
  it("one row per element: class, layer, details and how many hints and relationships it has", () => {
    const m = checkout();
    const rows = elementRows(m);
    expect(rows).toHaveLength(14);
    const web = rows.find((r) => r.name === "Checkout web app")!;
    expect(web).toMatchObject({ cls: "Application", layer: "Functional", lifecycle: "", environment: "", owner: "" });
    expect(web.relationships).toBe(m.edges.filter((e) => e.from === web.id || e.to === web.id).length);
    expect(rows.every((r) => r.hints >= 0)).toBe(true);
  });

  it("one row per relationship, ends by name", () => {
    const m = checkout();
    const rows = relationshipRows(m);
    expect(rows).toHaveLength(13);
    expect(rows[0]).toEqual({ id: m.edges[0]!.id, from: expect.any(String), type: m.edges[0]!.type, to: expect.any(String), plan: "Live" });
  });
});

describe("CSV (M67)", () => {
  it("quotes what needs it, doubles quotes, and keeps a cell from starting a spreadsheet formula", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a, b")).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    for (const f of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) expect(csvCell(f).replace(/^"/, "")).toMatch(/^'/);
  });

  it("writes a header and one line per row, CRLF, with a BOM so spreadsheets read UTF-8", () => {
    const csv = toCsv(["Name", "Owner"], [["Checkout", "Team — A"], ["=cmd", ""]]);
    expect(csv.startsWith("﻿Name,Owner\r\n")).toBe(true);
    expect(csv.split("\r\n")).toEqual(["﻿Name,Owner", "Checkout,Team — A", "'=cmd,", ""]);
  });
});
