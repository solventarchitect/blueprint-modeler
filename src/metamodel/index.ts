import { classes, type ClassDef, type ClassId } from "./classes";
import { relationships, type RelDef } from "./relationships";

export * from "./classes";
export * from "./hints";
export * from "./relationships";
export * from "./sources";

const byId = new Map<string, ClassDef>(classes.map((c) => [c.id, c]));

export const isClassId = (id: string): id is ClassId => byId.has(id);
export const classById = (id: string): ClassDef | undefined => byId.get(id);

/** Relationship definitions allowed from `from` to `to` (usually zero or one). */
export function relationshipsBetween(from: string, to: string): readonly RelDef[] {
  return relationships.filter((r) => r.from === from && r.to === to);
}

/** Every type label a new edge from `from` to `to` may use, preferred first. Empty = not allowed. */
export function allowedTypes(from: string, to: string): string[] {
  return relationshipsBetween(from, to).flatMap((r) => [...r.types]);
}

/** Types accepted when loading a file (allowed + legacy). */
export function acceptedTypes(from: string, to: string): string[] {
  return relationshipsBetween(from, to).flatMap((r) => [...r.types, ...(r.legacyTypes ?? [])]);
}
