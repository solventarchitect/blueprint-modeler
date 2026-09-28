import { classById } from "@/metamodel";
import type { Model } from "@/model";
import { workbook, type Sheet } from "./xlsx";

const NO_TABLE = "No CMDB table";
const HEADER = ["name", "description", "sys_class_name", "blueprint_id"];

/**
 * The model as a ServiceNow import workbook: one sheet per target table (named after it), a
 * cmdb_rel_ci sheet for relationships, a references sheet for reference fields, and a README.
 * Columns become import set fields; the README says how to map them.
 */
export function modelToServiceNowSheets(model: Model): Sheet[] {
  const byTable = new Map<string, string[][]>();
  for (const n of model.nodes) {
    const def = classById(n.class);
    const table = def?.table ?? NO_TABLE;
    const rows = byTable.get(table) ?? [];
    rows.push([n.name, n.attrs?.description ?? "", def?.table ?? `(${def?.label ?? n.class})`, n.id]);
    byTable.set(table, rows);
  }
  const node = new Map(model.nodes.map((n) => [n.id, n]));
  const label = (id: string) => node.get(id)?.name ?? "";
  const cls = (id: string) => {
    const def = classById(node.get(id)?.class ?? "");
    return def?.table ?? def?.label ?? "";
  };
  const rels = model.edges.filter((e) => !e.type.startsWith("reference:"));
  const refs = model.edges.filter((e) => e.type.startsWith("reference:"));

  const tables = [...byTable.keys()].sort((a, b) => (a === NO_TABLE ? 1 : b === NO_TABLE ? -1 : a.localeCompare(b)));
  return [
    {
      name: "README",
      rows: [
        ["Blueprint Modeler export for ServiceNow"],
        [`Model: ${model.name || "Untitled model"} (${model.nodes.length} elements, ${rels.length} relationships, ${refs.length} references)`],
        [""],
        ["How to import"],
        ["1. Load each table sheet into an import set (System Import Sets › Load Data), one sheet at a time."],
        ["2. Transform map to the table the sheet is named after: name → Name; description → Description (short_description on CI tables); blueprint_id → correlation_id (CI tables), and coalesce on it so a re-import updates instead of duplicating."],
        ["3. Then load the cmdb_rel_ci sheet: look up parent and child by correlation_id (parent_blueprint_id, child_blueprint_id) and set type from the type column (a cmdb_rel_type name)."],
        ["4. The references sheet lists reference fields (such as parent or model_id): set them on the 'from' record after both records exist."],
        [`5. Elements whose class has no CMDB table in Blueprint's metamodel are on the '${NO_TABLE}' sheet: choose a table for them first.`],
        [""],
        ["Check the target tables and fields on your instance before importing; this workbook is a starting point, not a certified integration. Not affiliated with or endorsed by ServiceNow."],
      ],
    },
    ...tables.map((t) => ({ name: t, rows: [HEADER, ...byTable.get(t)!] })),
    {
      name: "cmdb_rel_ci",
      rows: [
        ["parent", "parent_class", "type", "child", "child_class", "parent_blueprint_id", "child_blueprint_id"],
        ...rels.map((e) => [label(e.from), cls(e.from), e.type, label(e.to), cls(e.to), e.from, e.to]),
      ],
    },
    {
      name: "references",
      rows: [
        ["from", "from_class", "field", "to", "to_class", "from_blueprint_id", "to_blueprint_id"],
        ...refs.map((e) => [label(e.from), cls(e.from), e.type.slice("reference:".length), label(e.to), cls(e.to), e.from, e.to]),
      ],
    },
  ];
}

export const modelToServiceNowXlsx = (model: Model): Uint8Array => workbook(modelToServiceNowSheets(model));
