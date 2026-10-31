/**
 * Tags (M69): free labels on an element, such as a team, program or cost center. Pure.
 */
import { cleanTags, type Model, type Node } from "./schema";

export { cleanTags };
/** What someone typed as a comma-separated list of tags. */
export const parseTags = (text: string) => cleanTags(text.split(","));
export const tagsOf = (n: Pick<Node, "tags">): string[] => n.tags ?? [];

/** Every tag in a model, once each ignoring case (the first spelling met wins), in alphabetical order. */
export function modelTags(model: Model): string[] {
  const seen = new Map<string, string>();
  for (const n of model.nodes) for (const t of n.tags ?? []) if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
