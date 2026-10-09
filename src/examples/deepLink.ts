import { examples, type Example } from "./index";

/** `/editor?example=<id>` opens a shipped example (ids are stable: other sites link to them). */
export const EXAMPLE_PARAM = "example";

/** The longest id shown back in a message; longer ones are cut, ending in "…". */
export const SHOWN_ID_MAX = 64;

/**
 * The example a page's query string asks for. Null when there is no `example` parameter or it is
 * empty or only spaces. Otherwise the id as given (decoded), the matching example when one has exactly that id
 * (case-sensitive, no guessing), and `shown`: the id as it may appear in a message.
 */
export function exampleFromSearch(search: string): { id: string; shown: string; example?: Example } | null {
  const id = new URLSearchParams(search).get(EXAMPLE_PARAM);
  if (!id?.trim()) return null;
  const shown = shownId(id);
  const example = examples.find((e) => e.id === id);
  return example ? { id, shown, example } : { id, shown };
}

/** Control characters, and the bidi marks, embeddings, overrides and isolates that reorder text. */
const UNSAFE = /[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;

/** Text from a link with the characters that could garble or reorder a message removed. */
export const withoutUnsafe = (text: string) => text.replace(UNSAFE, "");

/**
 * An id from a URL, safe to show in a sentence: characters that could garble or reorder the message
 * removed (joiners stay, so an emoji keeps its shape), then cut at a whole character to
 * SHOWN_ID_MAX, ending in "…".
 */
function shownId(id: string): string {
  const clean = withoutUnsafe(id);
  const chars = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(clean)].map((g) => g.segment);
  return chars.length > SHOWN_ID_MAX ? `${chars.slice(0, SHOWN_ID_MAX - 1).join("")}…` : clean;
}
