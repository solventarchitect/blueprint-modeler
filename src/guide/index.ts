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
/** One class an entry is about (a relationship has two): its layer and kinds. */
export type GuideEnd = { layer: Layer; kinds: readonly ClassKind[] };
export type GuideItem = { text: string; ends: readonly GuideEnd[] };

/** The classes an entry is about, as written to `data-ends`: `design:core infrastructure:cmdb,extended`. */
export const encodeEnds = (ends: readonly GuideEnd[]) => [...new Set(ends.map((e) => `${e.layer}:${e.kinds.join(",")}`))].join(" ");
export function decodeEnds(value: string): GuideEnd[] {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      const [layer, kinds = ""] = part.split(":");
      return { layer: layer as Layer, kinds: kinds.split(",").filter(Boolean) as ClassKind[] };
    });
}

/**
 * Whether an entry shows under a filter. Every word of the query must appear in its text (any
 * order, any case). With layer or kind chips on, one of the entry's classes must meet them all: a
 * selected layer and a selected kind on the same end of a relationship. Entries about no class
 * (hints) answer to the query alone.
 */
export function itemMatches(item: GuideItem, f: GuideFilter): boolean {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((w) => item.text.includes(w))) return false;
  if (!item.ends.length || (!f.layers.size && !f.kinds.size)) return true;
  return item.ends.some((e) => (!f.layers.size || f.layers.has(e.layer)) && (!f.kinds.size || e.kinds.some((k) => f.kinds.has(k))));
}
