import { examples, type Example } from "./index";

/** `/editor?example=<id>` opens a shipped example (ids are stable: other sites link to them). */
export const EXAMPLE_PARAM = "example";

/** The longest id shown back in a message; longer ones are cut, ending in "…". */
export const SHOWN_ID_MAX = 64;

/**
 * The example a page's query string asks for. Null when there is no `example` parameter or it is
 * empty. Otherwise the id as given (decoded), the matching example when one has exactly that id
 * (case-sensitive, no guessing), and `shown`: the id cut to SHOWN_ID_MAX characters for messages.
 */
export function exampleFromSearch(search: string): { id: string; shown: string; example?: Example } | null {
  const id = new URLSearchParams(search).get(EXAMPLE_PARAM);
  if (!id) return null;
  const chars = [...id];
  const shown = chars.length > SHOWN_ID_MAX ? `${chars.slice(0, SHOWN_ID_MAX - 1).join("")}…` : id;
  const example = examples.find((e) => e.id === id);
  return example ? { id, shown, example } : { id, shown };
}
