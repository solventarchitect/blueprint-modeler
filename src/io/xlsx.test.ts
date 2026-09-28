import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { modelToServiceNowSheets, modelToServiceNowXlsx } from "./servicenow";
import { column, crc32, sheetNames, workbook } from "./xlsx";

/** Entry names of a zip, read from its central directory. */
function zipEntries(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const len = view.getUint16(at + 28, true);
    names.push(new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + len)));
    at += 46 + len;
  }
  return names;
}

describe("xlsx writer", () => {
  it("computes the standard CRC-32 and Excel column letters", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect([0, 25, 26, 27, 701, 702].map(column)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  it("keeps sheet names within Excel's rules", () => {
    expect(sheetNames(["a/b", "x".repeat(40), "Same", "same"])).toEqual(["a-b", "x".repeat(31), "Same", "same 2"]);
  });

  it("writes a zip with the Office Open XML parts, one worksheet per sheet", () => {
    const names = zipEntries(workbook([{ name: "One", rows: [["h"], ["<v & w>"]] }, { name: "Two", rows: [["h"]] }]));
    expect(names).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]);
  });
});

describe("ServiceNow export", () => {
  const model = examples[0]!.create(new Date(0), "m");
  const sheets = modelToServiceNowSheets(model);

  it("has a README, a sheet per target table, relationships and references", () => {
    expect(sheets[0]!.name).toBe("README");
    const tables = new Set(model.nodes.map((n) => sheets.find((s) => s.rows.slice(1).some((r) => r[3] === n.id))?.name));
    expect(tables.has(undefined)).toBe(false);
    const rel = sheets.find((s) => s.name === "cmdb_rel_ci")!;
    const ref = sheets.find((s) => s.name === "references")!;
    expect(rel.rows.length - 1 + ref.rows.length - 1).toBe(model.edges.length);
    expect(rel.rows.slice(1).every((r) => r[2]!.includes("::"))).toBe(true);
  });

  it("carries each element's description", () => {
    const n = model.nodes[0]!;
    const described = { ...model, nodes: model.nodes.map((m) => (m.id === n.id ? { ...m, attrs: { description: "Owned by the order team" } } : m)) };
    const row = modelToServiceNowSheets(described).flatMap((s) => s.rows).find((r) => r[3] === n.id)!;
    expect(row[1]).toBe("Owned by the order team");
  });

  it("produces a workbook", () => {
    expect(zipEntries(modelToServiceNowXlsx(model))).toContain("xl/workbook.xml");
  });
});
