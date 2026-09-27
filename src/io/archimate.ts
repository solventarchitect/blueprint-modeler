import { archimateElements, archimateRelationshipFor, type ArchimateRelationshipType, type ElementMapping } from "@/frameworks";
import { classById, isClassId } from "@/metamodel";
import type { Model } from "@/model";

/**
 * The model as an ArchiMate® Model Exchange File Format document (3.1 schema; namespace …/3.0/),
 * which ArchiMate tools such as Archi can import. Built from the ArchiMate lens: each CSDM element
 * becomes its mapped ArchiMate element, each relationship its mapped ArchiMate relationship
 * (Association when the pair has no mapping, e.g. a disallowed pair from an imported sketch), and
 * one diagram keeps the canvas positions. The CSDM class and relationship type travel as
 * properties so nothing is lost.
 */

const NS = "http://www.opengroup.org/xsd/archimate/3.0/";
const SCHEMA = "http://www.opengroup.org/xsd/archimate/3.0/ http://www.opengroup.org/xsd/archimate/3.1/archimate3_Diagram.xsd";
const NODE_W = 224;
const NODE_H = 64;
const MARGIN = 40;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
/** xs:ID values must be NCNames: start with a letter or underscore, no spaces or colons. */
const ncname = (prefix: string, id: string) => `${prefix}-${id.replace(/[^A-Za-z0-9_.-]/g, "_")}`;
const name = (s: string) => `<name xml:lang="en">${esc(s)}</name>`;
const prop = (ref: string, value: string) => `<property propertyDefinitionRef="${ref}"><value xml:lang="en">${esc(value)}</value></property>`;

export function modelToArchimateXml(model: Model): string {
  const out: string[] = [];
  // Sanitizing can make two ids equal ("a b" and "a_b"), so every identifier is made unique.
  const assigned = new Map<string, string>();
  const used = new Set<string>();
  const uid = (prefix: string, raw: string) => {
    const key = `${prefix}\u0000${raw}`;
    const known = assigned.get(key);
    if (known) return known;
    const base = ncname(prefix, raw);
    let candidate = base;
    for (let i = 2; used.has(candidate); i++) candidate = `${base}-${i}`;
    used.add(candidate);
    assigned.set(key, candidate);
    return candidate;
  };
  const elId = (id: string) => uid("el", id);
  const relId = (id: string) => uid("rel", id);
  const viewNodeId = (id: string) => uid("vn", id);
  const classOf = new Map(model.nodes.map((n) => [n.id, n.class]));

  out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  out.push(`<model xmlns="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${SCHEMA}" identifier="${uid("model", model.id)}">`);
  out.push(`  ${name(model.name || "Untitled model")}`);
  out.push(`  <documentation xml:lang="en">${esc("Exported from Blueprint Modeler (https://model.mikereams.com): CSDM classes mapped to ArchiMate 3.2 elements. ArchiMate® is a registered trademark of The Open Group.")}</documentation>`);

  if (model.nodes.length) out.push(`  <elements>`);
  for (const n of model.nodes) {
    const m: ElementMapping | undefined = isClassId(n.class) ? archimateElements[n.class] : undefined;
    const type = m?.type ?? "Grouping";
    out.push(`    <element identifier="${elId(n.id)}" xsi:type="${type}">`);
    out.push(`      ${name(n.name || "Untitled")}`);
    out.push(`      <properties>${prop("pd-csdm-class", classById(n.class)?.label ?? n.class)}</properties>`);
    out.push(`    </element>`);
  }
  if (model.nodes.length) out.push(`  </elements>`);

  const rels = model.edges.flatMap((e) => {
    if (!classOf.has(e.from) || !classOf.has(e.to)) return [];
    const m = archimateRelationshipFor(classOf.get(e.from)!, classOf.get(e.to)!);
    const type: ArchimateRelationshipType = m?.type ?? "Association";
    const [source, target] = m?.reverse ? [e.to, e.from] : [e.from, e.to];
    return [{ e, type, source, target }];
  });

  if (rels.length) {
    out.push(`  <relationships>`);
    for (const r of rels) {
      const access = r.type === "Access" ? ` accessType="ReadWrite"` : "";
      out.push(`    <relationship identifier="${relId(r.e.id)}" source="${elId(r.source)}" target="${elId(r.target)}" xsi:type="${r.type}"${access}>`);
      out.push(`      <properties>${prop("pd-csdm-type", r.e.type)}</properties>`);
      out.push(`    </relationship>`);
    }
    out.push(`  </relationships>`);
  }

  out.push(`  <propertyDefinitions>`);
  out.push(`    <propertyDefinition identifier="pd-csdm-class" type="string">${name("CSDM class")}</propertyDefinition>`);
  out.push(`    <propertyDefinition identifier="pd-csdm-type" type="string">${name("CSDM relationship type")}</propertyDefinition>`);
  out.push(`  </propertyDefinitions>`);

  // One diagram with the canvas positions, shifted so every coordinate is non-negative.
  const xs = model.nodes.map((n) => model.layout[n.id]?.x ?? 0);
  const ys = model.nodes.map((n) => model.layout[n.id]?.y ?? 0);
  const dx = MARGIN - (xs.length ? Math.min(...xs) : 0);
  const dy = MARGIN - (ys.length ? Math.min(...ys) : 0);
  out.push(`  <views>`);
  out.push(`    <diagrams>`);
  out.push(`      <view identifier="${uid("view", model.id)}" xsi:type="Diagram">`);
  out.push(`        ${name(model.name || "Untitled model")}`);
  for (const n of model.nodes) {
    const p = model.layout[n.id] ?? { x: 0, y: 0 };
    out.push(
      `        <node identifier="${viewNodeId(n.id)}" elementRef="${elId(n.id)}" xsi:type="Element" x="${Math.round(p.x + dx)}" y="${Math.round(p.y + dy)}" w="${NODE_W}" h="${NODE_H}" />`,
    );
  }
  for (const r of rels) {
    out.push(
      `        <connection identifier="${uid("vc", r.e.id)}" relationshipRef="${relId(r.e.id)}" xsi:type="Relationship" source="${viewNodeId(r.source)}" target="${viewNodeId(r.target)}" />`,
    );
  }
  out.push(`      </view>`);
  out.push(`    </diagrams>`);
  out.push(`  </views>`);
  out.push(`</model>`);
  return `${out.join("\n")}\n`;
}
