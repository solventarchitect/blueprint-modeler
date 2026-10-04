import { isCsdmCore, isExtended, relationships, type ClassDef, type Layer } from "@/metamodel";

/** The guide's sections, in page order: anchors, rail labels and short names. */
export const GUIDE_SECTIONS = [
  { id: "classes", label: "Classes" },
  { id: "relationships", label: "Relationships" },
  { id: "impact", label: "Impact" },
  { id: "hints", label: "Hints" },
  { id: "archimate", label: "ArchiMate mapping" },
] as const;

/** A class's anchor on the guide, e.g. `/guide#business-application`. */
export const classSlug = (id: string) => id.replace(/_/g, "-");

/**
 * What a class is, for the kind chips: `core` when the CSDM white paper defines it, `cmdb` when it
 * comes from ServiceNow's product documentation, and also `extended` when it sits behind
 * View › Extended classes.
 */
export type ClassKind = "core" | "cmdb" | "extended";
export function classKinds(c: ClassDef): ClassKind[] {
  const kinds: ClassKind[] = [isCsdmCore(c) ? "core" : "cmdb"];
  if (isExtended(c)) kinds.push("extended");
  return kinds;
}

/** Every relationship a class takes part in: what it points to, and what points to it. */
export function classLinks(id: string): { out: { to: string; types: readonly string[] }[]; in: { from: string; types: readonly string[] }[] } {
  return {
    out: relationships.filter((r) => r.from === id).map((r) => ({ to: r.to, types: r.types })),
    in: relationships.filter((r) => r.to === id).map((r) => ({ from: r.from, types: r.types })),
  };
}

/** The text a guide entry is found by: its parts, lowercased, on one line. */
export const searchText = (...parts: (string | undefined | null)[]) => parts.filter(Boolean).join(" ").toLowerCase();

export type GuideFilter = { query: string; layers: ReadonlySet<Layer>; kinds: ReadonlySet<ClassKind> };
export type GuideItem = { text: string; layers: readonly Layer[]; kinds: readonly ClassKind[] };

/**
 * Whether an entry shows under a filter. Every word of the query must appear in its text (any
 * order, any case). With layer or kind chips on, an entry must share at least one of them; entries
 * without layers or kinds (hints) answer to the query alone.
 */
export function itemMatches(item: GuideItem, f: GuideFilter): boolean {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((w) => item.text.includes(w))) return false;
  if (f.layers.size && item.layers.length && !item.layers.some((l) => f.layers.has(l))) return false;
  if (f.kinds.size && item.kinds.length && !item.kinds.some((k) => f.kinds.has(k))) return false;
  return true;
}
